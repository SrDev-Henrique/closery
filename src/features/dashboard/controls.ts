import "server-only";

import { type SQL, sql } from "drizzle-orm";

import type { Db } from "@/db/types";
import type { Authz } from "@/features/authz/authz";
import { sectorScopeOf } from "@/features/authz/sectorScope";

import { DASHBOARD_ITEM_LIMIT, SEGMENT_SLOTS } from "./limits";
import {
  chronologyOrderSql,
  DELIVERED_HANDOVER_SQL,
  handoverScopeSql,
} from "./sql";
import type {
  ControlItemMetric,
  ControlSegment,
  ControlsData,
  DashboardQuery,
  SegmentSlot,
  SeriesPoint,
} from "./types";

const EMPTY: ControlsData = { items: [], totalItems: 0 };

// 1–4 têm cor própria; do 5º turno em diante a cor é a neutra (slot null),
// mas o turno continua sendo um segmento com a própria linha.
function toSlot(position: number): SegmentSlot {
  if (position > SEGMENT_SLOTS) return null;
  switch (position) {
    case 1:
      return 1;
    case 2:
      return 2;
    case 3:
      return 3;
    case 4:
      return 4;
    default:
      return null;
  }
}

function inRange(column: string, from: string, to: string): SQL {
  return sql`${sql.raw(column)} between ${from}::date and ${to}::date`;
}

/**
 * Itens de controle do período: total, anterior, passagens com o item, média
 * por turno, um segmento por turno e a série diária de 2N dias. No máximo três
 * consultas (itens e totais; segmentos; série dos itens mostrados), todas
 * agregadas no SQL: nada é somado aqui.
 */
export async function getControlsData(
  db: Db,
  actor: Authz,
  input: DashboardQuery,
): Promise<ControlsData> {
  const scope = sectorScopeOf(actor, input.sectorId);
  if (scope.kind === "nothing") return EMPTY;
  const { period, previous } = input;

  const itemScope =
    scope.kind === "all" ? sql`true` : sql`i.sector_id = ${scope.sectorId}`;
  const current = inRange("operational_date", period.from, period.to);
  const before = inRange("operational_date", previous.from, previous.to);

  // 1. Itens (ativos do escopo ∪ com linha na janela) e os totais, numa passada.
  const items = await db
    .select({
      itemId: sql<string>`c.item_id`,
      sectorId: sql<string>`c.sector_id`,
      sectorName: sql<string>`c.sector_name`,
      name: sql<string>`c.name`,
      unit: sql<string>`c.unit`,
      total: sql<number>`c.total`.mapWith(Number),
      previousTotal: sql<number>`c.previous_total`.mapWith(Number),
      handoverCount: sql<number>`c.handover_count`.mapWith(Number),
      average: sql<number | null>`c.average`.mapWith(Number),
      totalItems: sql<number>`c.total_items`.mapWith(Number),
    })
    .from(
      sql`(
        with lines as (
          select hi.item_id, hi.quantity, hi.item_name_snapshot, hi.item_unit_snapshot,
            h.operational_date,
            row_number() over (partition by hi.item_id order by ${chronologyOrderSql()}) as rn
          from handover_item hi
          join handover h on h.id = hi.handover_id
          join shift s on s.id = h.shift_id
          join sector sec on sec.id = h.sector_id
          where hi.item_kind_snapshot = 'control' and ${DELIVERED_HANDOVER_SQL}
            and h.operational_date between ${previous.from}::date and ${period.to}::date
            and ${handoverScopeSql(scope)}
        ),
        totals as (
          select item_id,
            sum(quantity) filter (where ${current}) as total,
            sum(quantity) filter (where ${before}) as previous_total,
            count(*) filter (where ${current}) as handover_count,
            max(item_name_snapshot) filter (where rn = 1) as name,
            max(item_unit_snapshot) filter (where rn = 1) as unit
          from lines
          group by item_id
        )
        select i.id as item_id, i.sector_id, sec.name as sector_name,
          coalesce(t.name, i.name) as name, coalesce(t.unit, i.unit) as unit,
          coalesce(t.total, 0) as total,
          coalesce(t.previous_total, 0) as previous_total,
          coalesce(t.handover_count, 0) as handover_count,
          round(t.total::numeric / nullif(t.handover_count, 0), 1)::float8 as average,
          count(*) over () as total_items,
          row_number() over (order by lower(sec.name), i.sort_order, i.id) as ord
        from item i
        join sector sec on sec.id = i.sector_id
        left join totals t on t.item_id = i.id
        where sec.active and ${itemScope}
          and ((i.active and i.kind = 'control') or t.item_id is not null)
        order by ord
        limit ${DASHBOARD_ITEM_LIMIT}
      ) as c`,
    )
    .orderBy(sql`c.ord`);
  if (items.length === 0) return EMPTY;

  const idList = sql.join(
    items.map((row) => sql`${row.itemId}::uuid`),
    sql`, `,
  );

  // 2. Um segmento por turno: os ativos do setor do item ∪ os inativos com
  //    linha do item na janela; slot = posição entre TODOS os turnos do setor.
  const segmentRows = await db
    .select({
      itemId: sql<string>`c.item_id`,
      shiftId: sql<string>`c.shift_id`,
      label: sql<string>`c.label`,
      slot: sql<number>`c.slot`.mapWith(Number),
      total: sql<number>`c.total`.mapWith(Number),
      previousTotal: sql<number>`c.previous_total`.mapWith(Number),
    })
    .from(
      sql`(
        with ranked as (
          select s.id as shift_id, s.name, s.sector_id, s.active,
            row_number() over (
              partition by s.sector_id order by s.active desc, s.sort_order, s.created_at, s.id
            ) as slot
          from shift s
          where s.sector_id in (select sector_id from item where id in (${idList}))
        ),
        sums as (
          select hi.item_id, h.shift_id,
            sum(hi.quantity) filter (where ${current}) as total,
            sum(hi.quantity) filter (where ${before}) as previous_total
          from handover_item hi
          join handover h on h.id = hi.handover_id
          where hi.item_id in (${idList}) and hi.item_kind_snapshot = 'control'
            and ${DELIVERED_HANDOVER_SQL}
            and h.operational_date between ${previous.from}::date and ${period.to}::date
          group by hi.item_id, h.shift_id
        )
        select i.id as item_id, r.shift_id, r.name as label, r.slot,
          coalesce(m.total, 0) as total,
          coalesce(m.previous_total, 0) as previous_total
        from item i
        join ranked r on r.sector_id = i.sector_id
        left join sums m on m.item_id = i.id and m.shift_id = r.shift_id
        where i.id in (${idList}) and (r.active or m.shift_id is not null)
      ) as c`,
    )
    .orderBy(sql`c.item_id`, sql`c.slot`);

  const segmentsOf = new Map<string, ControlSegment[]>();
  const pairs: SQL[] = [];
  for (const row of segmentRows) {
    const list = segmentsOf.get(row.itemId) ?? [];
    list.push({
      key: row.shiftId,
      shiftId: row.shiftId,
      label: row.label,
      slot: toSlot(row.slot),
      total: row.total,
      previousTotal: row.previousTotal,
    });
    segmentsOf.set(row.itemId, list);
    pairs.push(
      sql`(${row.itemId}::uuid, ${row.shiftId}::uuid, ${row.slot}::int)`,
    );
  }

  // 3. A série dos itens mostrados: um ponto por dia de [anterior, atual] (2N),
  //    com os zeros e o total do dia somados no SQL; `parts` na ordem dos segmentos.
  const seriesOf = new Map<string, SeriesPoint[]>();
  if (pairs.length > 0) {
    const seriesRows = await db
      .select({
        itemId: sql<string>`c.item_id`,
        date: sql<string>`c.day`,
        total: sql<number>`c.total`.mapWith(Number),
        parts: sql<number[]>`c.parts`,
      })
      .from(
        sql`(
          with segs(item_id, shift_id, slot) as (values ${sql.join(pairs, sql`, `)}),
          days as (
            select d::date as day
            from generate_series(${previous.from}::date, ${period.to}::date, interval '1 day') as g(d)
          ),
          cells as (
            select sg.item_id, dd.day, sg.slot,
              coalesce(sum(hi.quantity), 0) as quantity
            from segs sg
            cross join days dd
            left join handover h
              on h.shift_id = sg.shift_id and h.operational_date = dd.day
              and ${DELIVERED_HANDOVER_SQL}
            left join handover_item hi
              on hi.handover_id = h.id and hi.item_id = sg.item_id
              and hi.item_kind_snapshot = 'control'
            group by sg.item_id, dd.day, sg.slot
          )
          select item_id, day::text as day,
            sum(quantity)::int as total,
            array_agg(quantity::int order by slot) as parts
          from cells
          group by item_id, day
        ) as c`,
      )
      .orderBy(sql`c.item_id`, sql`c.day`);
    for (const row of seriesRows) {
      const list = seriesOf.get(row.itemId) ?? [];
      list.push({ date: row.date, total: row.total, parts: row.parts });
      seriesOf.set(row.itemId, list);
    }
  }

  const metrics: ControlItemMetric[] = items.map((row) => ({
    itemId: row.itemId,
    sectorId: row.sectorId,
    sectorName: row.sectorName,
    name: row.name,
    unit: row.unit,
    total: row.total,
    previousTotal: row.previousTotal,
    handoverCount: row.handoverCount,
    average: row.average,
    segments: segmentsOf.get(row.itemId) ?? [],
    series: seriesOf.get(row.itemId) ?? [],
  }));
  return { items: metrics, totalItems: items[0]?.totalItems ?? 0 };
}
