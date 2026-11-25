import "server-only";

import { type SQL, sql } from "drizzle-orm";

import { handover } from "@/db/schema/handovers";
import type { Db } from "@/db/types";
import { PAGE_SIZE, type Page, resolvePage } from "@/features/admin/pagination";
import type { Authz } from "@/features/authz/authz";
import { sectorScopeOf } from "@/features/authz/sectorScope";

import type { HistoryFilters } from "./historyFilters";
import { SAO_PAULO_TIME_ZONE } from "./saoPaulo";
import type { HistorySituation } from "./status";

export type HistoryRow = {
  key: string;
  operationalDate: string;
  shiftId: string;
  shiftName: string;
  sectorId: string;
  sectorName: string;
  handoverId: string | null;
  situation: HistorySituation;
  corrected: boolean;
  hasDraft: boolean;
  deliveredByName: string | null;
  deliveredAt: Date | null;
  confirmedByName: string | null;
  confirmedAt: Date | null;
};

type HistoryQuery = {
  filters: HistoryFilters;
  sectorId: string | null;
  page: number;
};

function emptyPage(): Page<HistoryRow> {
  return { rows: [], total: 0, page: 1, pageCount: 1, pageSize: PAGE_SIZE };
}

// O que a fonte precisa saber do filtro (HistoryFilters é atribuível a este tipo).
export type HistorySourceInput = {
  from: string;
  to: string;
  shiftId: string | null;
};

// Fim do turno em hora de parede (timestamp sem fuso): dia operacional (+1 dia
// se o turno atravessa a meia-noite) + hora de término. Comparado com "agora"
// em São Paulo, é a mesma regra de hasShiftEnded (shiftSuggestion.ts). Usa o
// alias "s" da tabela shift.
export function endsLocalSql(day: SQL): SQL {
  return sql`((${day} + (case when s.ends_at < s.starts_at then 1 else 0 end)) + s.ends_at)`;
}

// "Agora" em hora de parede de São Paulo (timestamp sem fuso), para comparar
// com endsLocalSql.
export function nowLocalSql(now: Date): SQL {
  return sql`(${now.toISOString()}::timestamptz at time zone ${SAO_PAULO_TIME_ZONE})`;
}

function scopeSql(sectorId: string | null): SQL {
  return sectorId === null ? sql`true` : sql`sec.id = ${sectorId}`;
}

function shiftScopeSql(shiftId: string | null): SQL {
  return shiftId === null ? sql`true` : sql`s.id = ${shiftId}`;
}

// Os pares (setor, turno, dia) do período: turno ativo de setor ativo, em cada
// dia a partir do dia em que o turno foi criado (São Paulo). É só o SELECT, sem
// parênteses e sem `with`: colunas sector_id, sector_name, shift_id,
// shift_name, shift_order, operational_date e ends_local.
export function historyPairsSql(
  input: HistorySourceInput,
  sectorId: string | null,
): SQL {
  return sql`select
        sec.id as sector_id, sec.name as sector_name,
        s.id as shift_id, s.name as shift_name, s.sort_order as shift_order,
        d.day::date as operational_date,
        ${endsLocalSql(sql`d.day::date`)} as ends_local
      from generate_series(${input.from}::timestamp, ${input.to}::timestamp, interval '1 day') as d(day)
      cross join shift s
      join sector sec on sec.id = s.sector_id
      where s.active and sec.active
        and ${scopeSql(sectorId)} and ${shiftScopeSql(input.shiftId)}
        and d.day::date >= (s.created_at at time zone ${SAO_PAULO_TIME_ZONE})::date`;
}

// Uma linha por par (setor, turno, dia) do período: as passagens entregues ou
// confirmadas (situação real) mais os pares já encerrados sem nenhuma delas
// ("missing"). A origem da leitura é este SELECT inteiro como tabela derivada
// (alias "u"): colunas sector_id, sector_name, shift_id, shift_name,
// shift_order, operational_date, ends_local, handover_id, situation, corrected,
// has_draft, delivered_by_name, delivered_at, confirmed_by_name, confirmed_at, expected.
export function historySource(
  input: HistorySourceInput,
  sectorId: string | null,
  now: Date,
): SQL {
  const nowLocal = nowLocalSql(now);
  const scope = scopeSql(sectorId);
  const shiftScope = shiftScopeSql(input.shiftId);

  return sql`(
    with pairs as (
      ${historyPairsSql(input, sectorId)}
    )
    select
      h.sector_id, sec.name as sector_name,
      h.shift_id, coalesce(h.shift_name_snapshot, s.name) as shift_name,
      s.sort_order as shift_order, h.operational_date,
      ${endsLocalSql(sql`h.operational_date`)} as ends_local,
      h.id as handover_id,
      case
        when h.status = 'confirmed' then 'confirmed'
        when not exists (
          select 1 from handover n
          where n.sector_id = h.sector_id and n.status in ('delivered', 'confirmed')
            and (n.delivered_at, n.id) > (h.delivered_at, h.id)
        ) then 'awaiting'
        else 'unconfirmed'
      end as situation,
      exists (select 1 from handover_correction c where c.handover_id = h.id) as corrected,
      false as has_draft,
      du.name as delivered_by_name, h.delivered_at,
      cu.name as confirmed_by_name, h.confirmed_at,
      (
        s.active
        and h.operational_date >= (s.created_at at time zone ${SAO_PAULO_TIME_ZONE})::date
        and ${endsLocalSql(sql`h.operational_date`)} <= ${nowLocalSql(now)}
      ) as expected
    from handover h
    join sector sec on sec.id = h.sector_id
    join shift s on s.id = h.shift_id
    left join "user" du on du.id = h.delivered_by
    left join "user" cu on cu.id = h.confirmed_by
    where h.status in ('delivered', 'confirmed')
      and h.operational_date between ${input.from}::date and ${input.to}::date
      and sec.active and ${scope} and ${shiftScope}
    union all
    select
      p.sector_id, p.sector_name, p.shift_id, p.shift_name, p.shift_order,
      p.operational_date, p.ends_local,
      null::uuid, 'missing',
      false,
      exists (
        select 1 from handover d
        where d.sector_id = p.sector_id and d.shift_id = p.shift_id
          and d.operational_date = p.operational_date
      ),
      null::text, null::timestamptz, null::text, null::timestamptz,
      true
    from pairs p
    where p.ends_local <= ${nowLocal}
      and not exists (
        select 1 from handover h
        where h.sector_id = p.sector_id and h.shift_id = p.shift_id
          and h.operational_date = p.operational_date
          and h.status in ('delivered', 'confirmed')
      )
  ) as u`;
}

function situationWhere(filters: HistoryFilters): SQL {
  if (filters.situation === "all") return sql`true`;
  if (filters.situation === "corrected") return sql`u.corrected`;
  // Tudo que foi entregue (confirmada, aguardando e não confirmada).
  if (filters.situation === "delivered") return sql`u.situation <> 'missing'`;
  // Os pares de turno já encerrados: a entregue de cada um ou "sem passagem".
  if (filters.situation === "expected") return sql`u.expected`;
  return sql`u.situation = ${filters.situation}`;
}

// Só as passagens que têm linha desse item (a "sem passagem" não tem passagem
// e sai; item de outro setor não casa com nenhuma). Fica fora da `historySource`
// de propósito: o dashboard e o CSV não filtram por item.
function itemWhere(itemId: string | null): SQL {
  if (itemId === null) return sql`true`;
  return sql`exists (select 1 from handover_item hi where hi.handover_id = u.handover_id and hi.item_id = ${itemId})`;
}

export async function listHandoverHistory(
  db: Db,
  actor: Authz,
  input: HistoryQuery,
  now: Date,
): Promise<Page<HistoryRow>> {
  // Operador é forçado ao próprio setor; o valor que veio da URL é ignorado.
  const scope = sectorScopeOf(actor, input.sectorId);
  if (scope.kind === "nothing") return emptyPage();
  const sectorId = scope.kind === "sector" ? scope.sectorId : null;

  const source = historySource(input.filters, sectorId, now);
  const where = sql`${situationWhere(input.filters)} and ${itemWhere(input.filters.itemId)}`;

  const [counted] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(source)
    .where(where);
  const total = counted?.total ?? 0;
  const { page, pageCount, offset } = resolvePage(total, input.page);

  const rows = await db
    .select({
      sectorId: sql<string>`u.sector_id`,
      sectorName: sql<string>`u.sector_name`,
      shiftId: sql<string>`u.shift_id`,
      shiftName: sql<string>`u.shift_name`,
      operationalDate: sql<string>`u.operational_date::text`,
      handoverId: sql<string | null>`u.handover_id`,
      situation: sql<HistorySituation>`u.situation`,
      corrected: sql<boolean>`u.corrected`,
      hasDraft: sql<boolean>`u.has_draft`,
      deliveredByName: sql<string | null>`u.delivered_by_name`,
      deliveredAt: sql<Date | null>`u.delivered_at`.mapWith(
        handover.deliveredAt,
      ),
      confirmedByName: sql<string | null>`u.confirmed_by_name`,
      confirmedAt: sql<Date | null>`u.confirmed_at`.mapWith(
        handover.confirmedAt,
      ),
    })
    .from(source)
    .where(where)
    .orderBy(
      sql`u.operational_date desc`,
      sql`u.ends_local desc`,
      sql`lower(u.sector_name)`,
      sql`u.shift_order`,
      sql`u.shift_id`,
    )
    .limit(PAGE_SIZE)
    .offset(offset);

  return {
    rows: rows.map((row) => ({
      ...row,
      key: `${row.sectorId}:${row.shiftId}:${row.operationalDate}`,
    })),
    total,
    page,
    pageCount,
    pageSize: PAGE_SIZE,
  };
}
