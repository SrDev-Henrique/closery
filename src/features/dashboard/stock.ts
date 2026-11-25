import "server-only";

import { sql } from "drizzle-orm";

import type { Db } from "@/db/types";
import type { Authz } from "@/features/authz/authz";
import { sectorScopeOf } from "@/features/authz/sectorScope";

import { DASHBOARD_ITEM_LIMIT } from "./limits";
import {
  chronologyOrderSql,
  DELIVERED_HANDOVER_SQL,
  handoverScopeSql,
} from "./sql";
import type {
  DashboardQuery,
  StockData,
  StockItemMetric,
  StockPoint,
} from "./types";

const EMPTY: StockData = { items: [], totalItems: 0 };

/**
 * Itens de estoque: a última contagem até o fim do período (mesmo anterior ao
 * início) e, por dia do período, a última contagem do dia (`null` sem contagem).
 * Duas consultas, as duas agregadas no SQL.
 */
export async function getStockData(
  db: Db,
  actor: Authz,
  input: DashboardQuery,
): Promise<StockData> {
  const scope = sectorScopeOf(actor, input.sectorId);
  if (scope.kind === "nothing") return EMPTY;
  const { period } = input;

  const itemScope =
    scope.kind === "all" ? sql`true` : sql`i.sector_id = ${scope.sectorId}`;

  // 1. Itens (ativos do escopo ∪ com contagem no período) e a última contagem.
  const rows = await db
    .select({
      itemId: sql<string>`c.item_id`,
      sectorId: sql<string>`c.sector_id`,
      sectorName: sql<string>`c.sector_name`,
      name: sql<string>`c.name`,
      unit: sql<string>`c.unit`,
      quantity: sql<number | null>`c.quantity`.mapWith(Number),
      operationalDate: sql<string | null>`c.operational_date`,
      shiftName: sql<string | null>`c.shift_name`,
      handoverId: sql<string | null>`c.handover_id`,
      totalItems: sql<number>`c.total_items`.mapWith(Number),
    })
    .from(
      sql`(
        with latest as (
          select distinct on (hi.item_id)
            hi.item_id, hi.quantity,
            hi.item_name_snapshot as name, hi.item_unit_snapshot as unit,
            h.operational_date,
            coalesce(h.shift_name_snapshot, s.name) as shift_name,
            h.id as handover_id
          from handover_item hi
          join handover h on h.id = hi.handover_id
          join shift s on s.id = h.shift_id
          join sector sec on sec.id = h.sector_id
          where hi.item_kind_snapshot = 'stock' and ${DELIVERED_HANDOVER_SQL}
            and h.operational_date <= ${period.to}::date
            and ${handoverScopeSql(scope)}
          order by hi.item_id, ${chronologyOrderSql()}
        ),
        counted as (
          select distinct hi.item_id
          from handover_item hi
          join handover h on h.id = hi.handover_id
          join sector sec on sec.id = h.sector_id
          where hi.item_kind_snapshot = 'stock' and ${DELIVERED_HANDOVER_SQL}
            and h.operational_date between ${period.from}::date and ${period.to}::date
            and ${handoverScopeSql(scope)}
        )
        select i.id as item_id, i.sector_id, sec.name as sector_name,
          coalesce(l.name, i.name) as name, coalesce(l.unit, i.unit) as unit,
          l.quantity, l.operational_date::text as operational_date,
          l.shift_name, l.handover_id,
          count(*) over () as total_items,
          row_number() over (order by lower(sec.name), i.sort_order, i.id) as ord
        from item i
        join sector sec on sec.id = i.sector_id
        left join latest l on l.item_id = i.id
        where sec.active and ${itemScope}
          and ((i.active and i.kind = 'stock') or i.id in (select item_id from counted))
        order by ord
        limit ${DASHBOARD_ITEM_LIMIT}
      ) as c`,
    )
    .orderBy(sql`c.ord`);
  if (rows.length === 0) return EMPTY;

  const idList = sql.join(
    rows.map((row) => sql`${row.itemId}::uuid`),
    sql`, `,
  );

  // 2. Um ponto por item e dia do período: a última contagem do dia (a mesma
  //    ordem cronológica) ou null.
  const pointRows = await db
    .select({
      itemId: sql<string>`c.item_id`,
      date: sql<string>`c.day`,
      quantity: sql<number | null>`c.quantity`.mapWith(Number),
    })
    .from(
      sql`(
        with per_day as (
          select distinct on (hi.item_id, h.operational_date)
            hi.item_id, h.operational_date, hi.quantity
          from handover_item hi
          join handover h on h.id = hi.handover_id
          join shift s on s.id = h.shift_id
          where hi.item_id in (${idList}) and hi.item_kind_snapshot = 'stock'
            and ${DELIVERED_HANDOVER_SQL}
            and h.operational_date between ${period.from}::date and ${period.to}::date
          order by hi.item_id, ${chronologyOrderSql()}
        )
        select x.item_id, d.day::text as day, p.quantity
        from (select unnest(array[${idList}]) as item_id) x
        cross join (
          select g::date as day
          from generate_series(${period.from}::date, ${period.to}::date, interval '1 day') as s(g)
        ) d
        left join per_day p on p.item_id = x.item_id and p.operational_date = d.day
      ) as c`,
    )
    .orderBy(sql`c.item_id`, sql`c.day`);

  const pointsOf = new Map<string, StockPoint[]>();
  for (const row of pointRows) {
    const list = pointsOf.get(row.itemId) ?? [];
    list.push({ date: row.date, quantity: row.quantity });
    pointsOf.set(row.itemId, list);
  }

  const items: StockItemMetric[] = rows.map((row) => ({
    itemId: row.itemId,
    sectorId: row.sectorId,
    sectorName: row.sectorName,
    name: row.name,
    unit: row.unit,
    last:
      row.quantity !== null &&
      row.operationalDate !== null &&
      row.shiftName !== null &&
      row.handoverId !== null
        ? {
            quantity: row.quantity,
            unit: row.unit,
            operationalDate: row.operationalDate,
            shiftName: row.shiftName,
            handoverId: row.handoverId,
          }
        : null,
    lastBeforePeriod:
      row.operationalDate !== null && row.operationalDate < period.from,
    points: pointsOf.get(row.itemId) ?? [],
  }));
  return { items, totalItems: rows[0]?.totalItems ?? 0 };
}
