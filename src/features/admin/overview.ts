import "server-only";

import { type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { user } from "@/db/schema/auth";
import { destination, item, shift } from "@/db/schema/catalog";
import { invite } from "@/db/schema/invites";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";

export type AdminOverviewCounts = {
  sectors: number;
  shifts: number;
  items: number;
  destinations: number;
  people: number;
  pendingInvites: number;
};

// count(*) volta como bigint (texto no driver): mapWith(Number) converte.
function countWhere(from: SQL, where: SQL): SQL<number> {
  return sql<number>`(select count(*) from ${from} where ${where})`.mapWith(
    Number,
  );
}

// P26: turno e item de setor inativo não contam (o setor inteiro está fora de
// uso). A subconsulta nomeia a tabela "sector" por extenso, como em sectors.ts.
function inActiveSector(sectorId: PgColumn): SQL {
  return sql`exists (select 1 from ${sector} where ${sector.id} = ${sectorId} and ${sector.active})`;
}

// Um único SELECT: cada contagem é uma subconsulta count(*) no SQL (a visão
// geral nunca soma linhas em JS). O FROM é uma tabela de uma linha
// (`values (1)`) porque o Drizzle 0.45 só executa select com FROM. "Ativo" =
// active true; pessoa ativa = sem deactivated_at; convite pendente = válido
// agora (mesma regra de expiração do consumeInvite: expires_at > now).
export async function getAdminOverviewCounts(
  db: Db,
  now: Date,
): Promise<AdminOverviewCounts> {
  const [row] = await db
    .select({
      sectors: countWhere(sql`${sector}`, sql`${sector.active}`),
      shifts: countWhere(
        sql`${shift}`,
        sql`${shift.active} and ${inActiveSector(shift.sectorId)}`,
      ),
      items: countWhere(
        sql`${item}`,
        sql`${item.active} and ${inActiveSector(item.sectorId)}`,
      ),
      destinations: countWhere(sql`${destination}`, sql`${destination.active}`),
      people: countWhere(sql`${user}`, sql`${user.deactivatedAt} is null`),
      pendingInvites: countWhere(
        sql`${invite}`,
        sql`${invite.usedAt} is null and ${invite.cancelledAt} is null and ${invite.expiresAt} > ${now.toISOString()}::timestamptz`,
      ),
    })
    .from(sql`(values (1)) as one(n)`);
  if (!row) throw new Error("Contagens da visão geral não retornaram.");
  return row;
}
