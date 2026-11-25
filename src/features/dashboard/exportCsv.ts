import "server-only";

import { sql } from "drizzle-orm";

import type { Db } from "@/db/types";
import type { Authz } from "@/features/authz/authz";
import { sectorScopeOf } from "@/features/authz/sectorScope";
import { endsLocalSql, historySource } from "@/features/handovers/history";
import { formatDateBR } from "@/features/handovers/saoPaulo";
import {
  type HistorySituation,
  situationLabel,
} from "@/features/handovers/status";

import {
  csvDocument,
  csvNumberCell,
  csvPlainCell,
  csvTextCell,
  type ExportFilename,
  exportFilename,
} from "./csv";
import { CSV_MAX_ROWS } from "./limits";
import type { DashboardScope } from "./types";

export const CSV_NO_SECTOR_MESSAGE = "Nenhum setor disponível para exportar.";
export const CSV_TOO_LARGE_MESSAGE =
  "Período grande demais para exportar. Escolha um intervalo menor.";

export type PassagesCsv =
  | { ok: true; body: string; filename: ExportFilename; rows: number }
  | { ok: false; reason: "too_large"; rows: number };

type Cell = { quantity: number; note: string | null };

/**
 * CSV das passagens do período, uma linha por linha do histórico (as mesmas de
 * /passagens, na mesma ordem). Só lê: o JS monta a listagem, nunca soma.
 * `rows` em "too_large" é `maxRows + 1`: o SQL para no primeiro excedente.
 */
export async function buildPassagesCsv(
  db: Db,
  actor: Authz,
  scope: DashboardScope,
  now: Date,
  options: { maxRows?: number } = {},
): Promise<PassagesCsv> {
  const maxRows = options.maxRows ?? CSV_MAX_ROWS;
  const filename = exportFilename(scope.sectorName, scope.period);
  const access = sectorScopeOf(actor, scope.sectorId);
  const sectorId = access.kind === "sector" ? access.sectorId : null;
  const showSector = access.kind === "all";
  const { from, to } = scope.period;

  const rows =
    access.kind === "nothing"
      ? []
      : await db
          .select({
            operationalDate: sql<string>`u.operational_date::text`,
            sectorName: sql<string>`u.sector_name`,
            shiftName: sql<string>`u.shift_name`,
            handoverId: sql<string | null>`u.handover_id`,
            situation: sql<HistorySituation>`u.situation`,
            corrected: sql<boolean>`u.corrected`,
            deliveredByName: sql<string | null>`u.delivered_by_name`,
            confirmedByName: sql<string | null>`u.confirmed_by_name`,
            nextShiftText: sql<
              string | null
            >`(select h.next_shift_text from handover h where h.id = u.handover_id)`,
            occurrencesText: sql<
              string | null
            >`(select h.occurrences_text from handover h where h.id = u.handover_id)`,
          })
          .from(historySource({ from, to, shiftId: null }, sectorId, now))
          .orderBy(
            sql`u.operational_date desc`,
            sql`u.ends_local desc`,
            sql`lower(u.sector_name)`,
            sql`u.shift_order`,
            sql`u.shift_id`,
          )
          .limit(maxRows + 1);
  if (rows.length > maxRows) {
    return { ok: false, reason: "too_large", rows: rows.length };
  }

  const sectorFilter =
    sectorId === null ? sql`true` : sql`sec.id = ${sectorId}`;
  const inPeriod = sql`h.status in ('delivered', 'confirmed')
    and h.operational_date between ${from}::date and ${to}::date
    and sec.active and ${sectorFilter}`;

  const [columns, lines] =
    access.kind === "nothing"
      ? [[], []]
      : await Promise.all([
          db
            .select({
              itemId: sql<string>`t.item_id`,
              sectorName: sql<string>`t.sector_name`,
              name: sql<string>`t.name`,
              unit: sql<string>`t.unit`,
            })
            .from(
              sql`(
                select distinct on (hi.item_id)
                  hi.item_id, sec.name as sector_name,
                  coalesce(hi.item_name_snapshot, i.name) as name,
                  coalesce(hi.item_unit_snapshot, i.unit) as unit,
                  coalesce(hi.item_kind_snapshot, i.kind) as kind,
                  i.sort_order
                from handover_item hi
                join handover h on h.id = hi.handover_id
                join shift s on s.id = h.shift_id
                join sector sec on sec.id = h.sector_id
                join item i on i.id = hi.item_id
                where ${inPeriod}
                order by hi.item_id, h.operational_date desc,
                  ${endsLocalSql(sql`h.operational_date`)} desc,
                  h.delivered_at desc, h.id desc
              ) as t`,
            )
            .orderBy(
              sql`lower(t.sector_name)`,
              sql`(t.kind = 'stock')`,
              sql`t.sort_order`,
              sql`t.item_id`,
            ),
          db
            .select({
              handoverId: sql<string>`l.handover_id`,
              itemId: sql<string>`l.item_id`,
              quantity: sql<number>`l.quantity`.mapWith(Number),
              note: sql<string | null>`l.note`,
            })
            .from(
              sql`(
                select hi.handover_id, hi.item_id, hi.quantity, hi.note
                from handover_item hi
                join handover h on h.id = hi.handover_id
                join sector sec on sec.id = h.sector_id
                where ${inPeriod}
              ) as l`,
            ),
        ]);

  const cells = new Map<string, Map<string, Cell>>();
  for (const line of lines) {
    const byItem = cells.get(line.handoverId) ?? new Map<string, Cell>();
    byItem.set(line.itemId, { quantity: line.quantity, note: line.note });
    cells.set(line.handoverId, byItem);
  }

  const header = [
    "Dia",
    "Turno",
    "Setor",
    "Entregue por",
    "Recebido por",
    "Situação",
    "Corrigida",
    ...columns.map((column) =>
      showSector
        ? `${column.sectorName} · ${column.name} (${column.unit})`
        : `${column.name} (${column.unit})`,
    ),
    "Observações dos itens",
    "Fica para o próximo turno",
    "Ocorrências do turno",
  ];

  const body = rows.map((row) => {
    const own = row.handoverId === null ? undefined : cells.get(row.handoverId);
    const notes: string[] = [];
    const itemCells = columns.map((column) => {
      const cell = own?.get(column.itemId);
      if (!cell) return "";
      if (cell.note) notes.push(`${column.name}: ${cell.note}`);
      return csvNumberCell(cell.quantity);
    });
    return [
      csvPlainCell(formatDateBR(row.operationalDate)),
      csvTextCell(row.shiftName),
      csvTextCell(row.sectorName),
      csvTextCell(row.deliveredByName ?? ""),
      csvTextCell(
        row.situation === "confirmed" ? (row.confirmedByName ?? "") : "",
      ),
      csvPlainCell(situationLabel(row.situation)),
      csvPlainCell(
        row.situation === "missing" ? "" : row.corrected ? "Sim" : "Não",
      ),
      ...itemCells,
      csvTextCell(notes.join("\n")),
      csvTextCell(row.nextShiftText ?? ""),
      csvTextCell(row.occurrencesText ?? ""),
    ];
  });

  return {
    ok: true,
    body: csvDocument(header, body),
    filename,
    rows: rows.length,
  };
}
