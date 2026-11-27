import "server-only";

import { asc, count, desc, eq, sql } from "drizzle-orm";

import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import {
  isSectorColor,
  type SectorColor,
  suggestSectorColor,
} from "@/features/sectors/colors";
import { isUniqueViolation } from "./dbErrors";
import {
  nameTakenMessage,
  notFoundMessage,
  SECTOR_COLOR_INVALID_MESSAGE,
  sectorBlockedMessage,
} from "./messages";
import { validateName } from "./names";
import {
  CHOICE_LIST_LIMIT,
  PAGE_SIZE,
  type Page,
  resolvePage,
} from "./pagination";
import { type AdminResult, fail, ok } from "./result";

export type SectorRow = {
  id: string;
  name: string;
  color: SectorColor;
  active: boolean;
  activePeople: number;
  pendingInvites: number;
};

export type SectorChoice = { id: string; name: string; color: SectorColor };
// Subconsultas correlacionadas escritas com a tabela "sector" por extenso: o
// Drizzle tira o prefixo das colunas num SELECT de uma tabela só, e um "id"
// sem prefixo dentro da subconsulta apontaria para "user".
function activePeopleSql() {
  return sql<number>`(
    select count(*)::int from "user" u
    where u.sector_id = "sector"."id" and u.deactivated_at is null
  )`;
}

function pendingInvitesSql(now: Date) {
  return sql<number>`(
    select count(*)::int from "invite" i
    where i.sector_id = "sector"."id"
      and i.used_at is null
      and i.cancelled_at is null
      and i.expires_at > ${now.toISOString()}::timestamptz
  )`;
}

export async function listSectors(
  db: Db,
  input: { page: number },
  now: Date,
): Promise<Page<SectorRow>> {
  const [totals] = await db.select({ total: count() }).from(sector);
  const total = totals?.total ?? 0;
  const { page, pageCount, offset } = resolvePage(total, input.page);

  const rows = await db
    .select({
      id: sector.id,
      name: sector.name,
      color: sector.color,
      active: sector.active,
      activePeople: activePeopleSql(),
      pendingInvites: pendingInvitesSql(now),
    })
    .from(sector)
    .orderBy(desc(sector.active), sql`lower(${sector.name})`, asc(sector.id))
    .limit(PAGE_SIZE)
    .offset(offset);

  return { rows, total, page, pageCount, pageSize: PAGE_SIZE };
}

export async function listActiveSectors(db: Db): Promise<SectorChoice[]> {
  return db
    .select({ id: sector.id, name: sector.name, color: sector.color })
    .from(sector)
    .where(eq(sector.active, true))
    .orderBy(sql`lower(${sector.name})`, asc(sector.id))
    .limit(CHOICE_LIST_LIMIT);
}

// Cor que a tela de criação já traz marcada (o formulário nunca começa em branco): a primeira
// da paleta que nenhum setor ativo usa; se todas estão em uso, a menos usada. A regra é pura
// (`suggestSectorColor`); aqui só entram as cores dos setores ativos.
export async function suggestColorForNewSector(db: Db): Promise<SectorColor> {
  const rows = await db
    .select({ color: sector.color })
    .from(sector)
    .where(eq(sector.active, true));
  return suggestSectorColor(rows.map((row) => row.color));
}

// Setor do filtro `?setor=`: o da URL se estiver na lista (de ativos); senão o
// primeiro; sem setores, null.
export function resolveSectorFilter(
  sectors: readonly SectorChoice[],
  raw: string | string[] | undefined,
): SectorChoice | null {
  const wanted = Array.isArray(raw) ? raw[0] : raw;
  const found = wanted ? sectors.find((choice) => choice.id === wanted) : null;
  return found ?? sectors[0] ?? null;
}

async function nameTakenFailure(db: Db, name: string) {
  const [existing] = await db
    .select({ active: sector.active })
    .from(sector)
    .where(sql`lower(${sector.name}) = lower(${name})`)
    .limit(1);
  const message = nameTakenMessage("setor", existing?.active === false);
  return fail("NAME_TAKEN", message, { name: message });
}

function colorFailure() {
  return fail("INVALID_INPUT", SECTOR_COLOR_INVALID_MESSAGE, {
    color: SECTOR_COLOR_INVALID_MESSAGE,
  });
}

export async function createSector(
  db: Db,
  input: { name: string; color: SectorColor },
): Promise<AdminResult<{ id: string }>> {
  const checked = validateName(input.name);
  if (!checked.ok) {
    return fail("INVALID_INPUT", checked.message, { name: checked.message });
  }
  // A action já valida com o schema; isto protege quem chamar o domínio direto (o check do
  // banco é a última barreira e viraria erro 500).
  if (!isSectorColor(input.color)) return colorFailure();
  try {
    const [created] = await db
      .insert(sector)
      .values({ name: checked.name, color: input.color })
      .returning({ id: sector.id });
    if (!created) throw new Error("setor não criado");
    return ok({ id: created.id });
  } catch (error) {
    if (isUniqueViolation(error)) return nameTakenFailure(db, checked.name);
    throw error;
  }
}

// Edita nome e cor do setor (o nome da função vem da Fase 2; a cor entrou em 2026-11-27).
export async function renameSector(
  db: Db,
  input: { id: string; name: string; color: SectorColor },
): Promise<AdminResult> {
  const checked = validateName(input.name);
  if (!checked.ok) {
    return fail("INVALID_INPUT", checked.message, { name: checked.message });
  }
  if (!isSectorColor(input.color)) return colorFailure();
  try {
    const updated = await db
      .update(sector)
      .set({ name: checked.name, color: input.color })
      .where(eq(sector.id, input.id))
      .returning({ id: sector.id });
    if (updated.length === 0) {
      return fail("NOT_FOUND", notFoundMessage("setor"));
    }
    return ok();
  } catch (error) {
    if (isUniqueViolation(error)) return nameTakenFailure(db, checked.name);
    throw error;
  }
}

// Desativar com gente dentro é bloqueado (D-F2-2): operador ativo ou convite
// pendente ficaria num setor inativo. Reativar sempre passa. Contagem, trava da
// linha e UPDATE rodam na mesma transação.
export async function setSectorActive(
  db: Db,
  input: { id: string; active: boolean },
  now: Date,
): Promise<AdminResult> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ active: sector.active })
      .from(sector)
      .where(eq(sector.id, input.id))
      .for("update");
    if (!current) return fail("NOT_FOUND", notFoundMessage("setor"));
    if (current.active === input.active) return ok();

    if (!input.active) {
      const [counts] = await tx
        .select({
          people: activePeopleSql(),
          invites: pendingInvitesSql(now),
        })
        .from(sector)
        .where(eq(sector.id, input.id));
      const people = counts?.people ?? 0;
      const invites = counts?.invites ?? 0;
      if (people > 0 || invites > 0) {
        return fail("SECTOR_IN_USE", sectorBlockedMessage(people, invites));
      }
    }

    await tx
      .update(sector)
      .set({ active: input.active })
      .where(eq(sector.id, input.id));
    return ok();
  });
}
