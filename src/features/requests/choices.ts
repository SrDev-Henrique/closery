import "server-only";

import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { destination, item } from "@/db/schema/catalog";
import { request } from "@/db/schema/requests";
import type { Db } from "@/db/types";
import { CHOICE_LIST_LIMIT } from "@/features/admin/pagination";
import type { Authz } from "@/features/authz/authz";

import { requestScopeSql } from "./sql";
import type {
  DestinationChoice,
  FilterDestination,
  PersonChoice,
  RequestFormChoices,
  StockItemChoice,
} from "./types";

// Destinos para CRIAR: só os ativos.
export async function listActiveDestinations(
  db: Db,
): Promise<DestinationChoice[]> {
  return db
    .select({ id: destination.id, name: destination.name })
    .from(destination)
    .where(eq(destination.active, true))
    .orderBy(sql`lower(${destination.name})`, asc(destination.id))
    .limit(CHOICE_LIST_LIMIT);
}

// Destinos para FILTRAR: todos (solicitações antigas usam os inativos).
export async function listFilterDestinations(
  db: Db,
): Promise<FilterDestination[]> {
  return db
    .select({
      id: destination.id,
      name: destination.name,
      active: destination.active,
    })
    .from(destination)
    .orderBy(
      desc(destination.active),
      sql`lower(${destination.name})`,
      asc(destination.id),
    )
    .limit(CHOICE_LIST_LIMIT);
}

// Itens de ESTOQUE ativos de cada setor, na ordem do setor, até 200 por setor
// (`row_number() over (partition by sector_id …)`).
export async function listRequestStockItems(
  db: Db,
  sectorIds: readonly string[],
): Promise<Map<string, StockItemChoice[]>> {
  const result = new Map<string, StockItemChoice[]>();
  if (sectorIds.length === 0) return result;

  const ranked = db
    .select({
      id: item.id,
      sectorId: item.sectorId,
      name: item.name,
      unit: item.unit,
      rank: sql<number>`row_number() over (partition by ${item.sectorId} order by ${item.sortOrder}, ${item.createdAt}, ${item.id})`
        .mapWith(Number)
        .as("rank"),
    })
    .from(item)
    .where(
      and(
        inArray(item.sectorId, [...sectorIds]),
        eq(item.kind, "stock"),
        eq(item.active, true),
      ),
    )
    .as("ranked");

  const rows = await db
    .select({
      id: ranked.id,
      sectorId: ranked.sectorId,
      name: ranked.name,
      unit: ranked.unit,
    })
    .from(ranked)
    .where(lte(ranked.rank, CHOICE_LIST_LIMIT))
    .orderBy(asc(ranked.sectorId), asc(ranked.rank));

  for (const row of rows) {
    const list = result.get(row.sectorId) ?? [];
    list.push({ id: row.id, name: row.name, unit: row.unit });
    result.set(row.sectorId, list);
  }
  return result;
}

// Setor → destino ATIVO mais usado nas solicitações dele (contagem desc, uso
// mais recente desc, id). Setor sem histórico não entra no mapa.
export async function mostUsedDestinations(
  db: Db,
  sectorIds: readonly string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (sectorIds.length === 0) return result;

  const usage = db
    .select({
      sectorId: request.sectorId,
      destinationId: destination.id,
      uses: sql<number>`count(*)`.mapWith(Number).as("uses"),
      lastUsed: sql`max(${request.createdAt})`.as("last_used"),
    })
    .from(request)
    .innerJoin(destination, eq(destination.id, request.destinationId))
    .where(
      and(
        inArray(request.sectorId, [...sectorIds]),
        eq(destination.active, true),
      ),
    )
    .groupBy(request.sectorId, destination.id)
    .as("usage");

  const rows = await db
    .selectDistinctOn([usage.sectorId], {
      sectorId: usage.sectorId,
      destinationId: usage.destinationId,
    })
    .from(usage)
    .orderBy(
      asc(usage.sectorId),
      desc(usage.uses),
      desc(usage.lastUsed),
      asc(usage.destinationId),
    );

  for (const row of rows) result.set(row.sectorId, row.destinationId);
  return result;
}

// F4-21: destinos ativos uma vez e, por setor, os itens de estoque e o destino
// padrão (o mais usado; sem histórico, o primeiro ativo; sem ativos, null =
// "Outro"). Ids vazios: só os destinos.
export async function getRequestFormChoices(
  db: Db,
  sectorIds: readonly string[],
): Promise<RequestFormChoices> {
  const destinations = await listActiveDestinations(db);
  if (sectorIds.length === 0) return { destinations, bySector: {} };

  const [stock, mostUsed] = await Promise.all([
    listRequestStockItems(db, sectorIds),
    mostUsedDestinations(db, sectorIds),
  ]);
  const fallback = destinations[0]?.id ?? null;
  const bySector: RequestFormChoices["bySector"] = {};
  for (const sectorId of sectorIds) {
    bySector[sectorId] = {
      stockItems: stock.get(sectorId) ?? [],
      defaultDestinationId: mostUsed.get(sectorId) ?? fallback,
    };
  }
  return { destinations, bySector };
}

// Quem criou solicitações no escopo (setor escolhido ou todos; só setores
// ativos), SEM aplicar os outros filtros.
export async function listRequestCreators(
  db: Db,
  actor: Authz,
  sectorId: string | null,
): Promise<PersonChoice[]> {
  return db
    .select({ id: user.id, name: user.name })
    .from(request)
    .innerJoin(user, eq(user.id, request.createdBy))
    .where(requestScopeSql(actor, sectorId))
    .groupBy(user.id, user.name)
    .orderBy(sql`lower(${user.name})`, asc(user.id))
    .limit(CHOICE_LIST_LIMIT);
}
