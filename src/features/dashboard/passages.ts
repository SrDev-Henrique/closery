import "server-only";

import { sql } from "drizzle-orm";

import type { Db } from "@/db/types";
import type { Authz } from "@/features/authz/authz";
import { sectorScopeOf } from "@/features/authz/sectorScope";
import { historySource } from "@/features/handovers/history";

import type { DashboardQuery, PassagesData } from "./types";

const EMPTY: PassagesData = {
  expected: 0,
  delivered: 0,
  confirmed: 0,
  awaiting: 0,
  unconfirmed: 0,
  missing: 0,
  listed: 0,
};

// Uma consulta só sobre a mesma fonte da lista de /passagens: os números
// nunca divergem do que o link abre.
export async function getPassagesData(
  db: Db,
  actor: Authz,
  input: DashboardQuery,
  now: Date,
): Promise<PassagesData> {
  const scope = sectorScopeOf(actor, input.sectorId);
  if (scope.kind === "nothing") return EMPTY;

  const source = historySource(
    { ...input.period, shiftId: null },
    scope.kind === "sector" ? scope.sectorId : null,
    now,
  );
  const [row] = await db
    .select({
      expected: sql<number>`count(*) filter (where u.expected)`.mapWith(Number),
      delivered:
        sql<number>`count(*) filter (where u.situation <> 'missing')`.mapWith(
          Number,
        ),
      confirmed:
        sql<number>`count(*) filter (where u.situation = 'confirmed')`.mapWith(
          Number,
        ),
      awaiting:
        sql<number>`count(*) filter (where u.situation = 'awaiting')`.mapWith(
          Number,
        ),
      unconfirmed:
        sql<number>`count(*) filter (where u.situation = 'unconfirmed')`.mapWith(
          Number,
        ),
      missing:
        sql<number>`count(*) filter (where u.situation = 'missing')`.mapWith(
          Number,
        ),
      listed: sql<number>`count(*)`.mapWith(Number),
    })
    .from(source);
  return row ?? EMPTY;
}
