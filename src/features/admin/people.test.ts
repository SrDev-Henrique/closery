import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { session, user } from "@/db/schema/auth";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertSector,
  insertSession,
  insertUser,
} from "../../../test/fixtures";
import {
  LAST_ADMIN_MESSAGE,
  PERSON_SECTOR_INACTIVE_MESSAGE,
  SECTOR_INACTIVE_MESSAGE,
  SECTOR_REQUIRED_MESSAGE,
  SELF_DEACTIVATE_MESSAGE,
  SELF_ROLE_MESSAGE,
} from "./messages";
import { PAGE_SIZE } from "./pagination";
import { listPeople, setPersonActive, updatePerson } from "./people";

const NOW = new Date("2026-11-21T12:00:00.000Z");

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
});

async function readUser(id: string) {
  const [row] = await db.select().from(user).where(eq(user.id, id));
  if (!row) throw new Error("usuário não encontrado");
  return row;
}

async function countSessions(userId: string): Promise<number> {
  const rows = await db
    .select({ id: session.id })
    .from(session)
    .where(eq(session.userId, userId));
  return rows.length;
}

describe("listPeople", () => {
  it("lista ativos antes de inativos, depois por nome sem diferença de caixa", async () => {
    const setor = await insertSector(db, "Almoxarifado");
    await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
      name: "bruno Fictício",
    });
    await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
      name: "Ana Fictícia",
      deactivatedAt: NOW,
    });
    await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
      name: "Alvaro Fictício",
    });
    await insertUser(db, {
      role: "admin",
      sectorId: null,
      name: "Carla Admin",
    });

    const page = await listPeople(db, { page: 1 });

    expect(page.rows.map((row) => row.name)).toEqual([
      "Alvaro Fictício",
      "bruno Fictício",
      "Carla Admin",
      "Ana Fictícia",
    ]);
    expect(page.rows.map((row) => row.active)).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(page.total).toBe(4);
    expect(page.pageSize).toBe(PAGE_SIZE);
  });

  it("traz setor e se ele está ativo; admin vem sem setor", async () => {
    const ativo = await insertSector(db, "Ativo");
    const inativo = await insertSector(db, "Inativo", { active: false });
    await insertUser(db, {
      role: "operator",
      sectorId: ativo.id,
      name: "A Operadora",
    });
    await insertUser(db, {
      role: "operator",
      sectorId: inativo.id,
      name: "B Operador",
    });
    await insertUser(db, { role: "admin", sectorId: null, name: "C Admin" });

    const { rows } = await listPeople(db, { page: 1 });

    expect(rows[0]).toMatchObject({
      sectorName: "Ativo",
      sectorActive: true,
      role: "operator",
    });
    expect(rows[1]).toMatchObject({
      sectorName: "Inativo",
      sectorActive: false,
    });
    expect(rows[2]).toMatchObject({
      sectorId: null,
      sectorName: null,
      sectorActive: null,
      role: "admin",
    });
  });

  it("banco vazio: página 1 de 1 sem linhas", async () => {
    const page = await listPeople(db, { page: 1 });
    expect(page).toMatchObject({ rows: [], total: 0, page: 1, pageCount: 1 });
  });

  it("pagina de 50 em 50 e limita a página pedida ao intervalo", async () => {
    const setor = await insertSector(db);
    for (let index = 0; index < PAGE_SIZE + 1; index++) {
      await insertUser(db, {
        role: "operator",
        sectorId: setor.id,
        name: `Pessoa ${String(index).padStart(3, "0")}`,
      });
    }

    const first = await listPeople(db, { page: 1 });
    const second = await listPeople(db, { page: 2 });
    const beyond = await listPeople(db, { page: 99 });

    expect(first.rows).toHaveLength(PAGE_SIZE);
    expect(first.pageCount).toBe(2);
    expect(second.rows).toHaveLength(1);
    expect(second.rows[0]?.name).toBe("Pessoa 050");
    expect(beyond.page).toBe(2);
    expect(beyond.rows).toHaveLength(1);
  });
});

describe("updatePerson", () => {
  it("operador troca de setor", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const a = await insertSector(db, "A");
    const b = await insertSector(db, "B");
    const person = await insertUser(db, { role: "operator", sectorId: a.id });

    const result = await updatePerson(db, {
      actorId: admin.id,
      userId: person.id,
      role: "operator",
      sectorId: b.id,
    });

    expect(result).toEqual({ ok: true });
    expect((await readUser(person.id)).sectorId).toBe(b.id);
  });

  it("operador vira administrador e o setor é limpo", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
    });

    const result = await updatePerson(db, {
      actorId: admin.id,
      userId: person.id,
      role: "admin",
      sectorId: setor.id,
    });

    expect(result).toEqual({ ok: true });
    const saved = await readUser(person.id);
    expect(saved.role).toBe("admin");
    expect(saved.sectorId).toBeNull();
  });

  it("administrador vira operador com setor ativo (há outro admin)", async () => {
    const actor = await insertUser(db, { role: "admin", sectorId: null });
    const other = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);

    const result = await updatePerson(db, {
      actorId: actor.id,
      userId: other.id,
      role: "operator",
      sectorId: setor.id,
    });

    expect(result).toEqual({ ok: true });
    expect(await readUser(other.id)).toMatchObject({
      role: "operator",
      sectorId: setor.id,
    });
  });

  it("operador sem setor é recusado (SECTOR_REQUIRED) e nada muda", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
    });

    const result = await updatePerson(db, {
      actorId: admin.id,
      userId: person.id,
      role: "operator",
      sectorId: null,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "SECTOR_REQUIRED",
      message: SECTOR_REQUIRED_MESSAGE,
    });
    expect((await readUser(person.id)).sectorId).toBe(setor.id);
  });

  it("setor inativo é recusado (SECTOR_INACTIVE)", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const ativo = await insertSector(db);
    const inativo = await insertSector(db, "Fechado", { active: false });
    const person = await insertUser(db, {
      role: "operator",
      sectorId: ativo.id,
    });

    const result = await updatePerson(db, {
      actorId: admin.id,
      userId: person.id,
      role: "operator",
      sectorId: inativo.id,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "SECTOR_INACTIVE",
      message: SECTOR_INACTIVE_MESSAGE,
    });
    expect((await readUser(person.id)).sectorId).toBe(ativo.id);
  });

  it("setor inexistente é recusado (NOT_FOUND)", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
    });

    const result = await updatePerson(db, {
      actorId: admin.id,
      userId: person.id,
      role: "operator",
      sectorId: "00000000-0000-4000-8000-000000000000",
    });

    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("pessoa inexistente é recusada (NOT_FOUND)", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });

    const result = await updatePerson(db, {
      actorId: admin.id,
      userId: "nao-existe",
      role: "admin",
      sectorId: null,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
      message: "Pessoa não encontrada. Atualize a página.",
    });
  });

  it("o admin não rebaixa a própria conta (SELF_CHANGE), mesmo havendo outro admin", async () => {
    const me = await insertUser(db, { role: "admin", sectorId: null });
    await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);

    const result = await updatePerson(db, {
      actorId: me.id,
      userId: me.id,
      role: "operator",
      sectorId: setor.id,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "SELF_CHANGE",
      message: SELF_ROLE_MESSAGE,
    });
    expect((await readUser(me.id)).role).toBe("admin");
  });

  it("rebaixar um admin já inativo não toca na regra do último admin e vale", async () => {
    // Único admin ativo é o ator; o alvo está inativo: não conta como "ativo".
    const actor = await insertUser(db, { role: "admin", sectorId: null });
    const dormant = await insertUser(db, {
      role: "admin",
      sectorId: null,
      deactivatedAt: NOW,
    });
    const setor = await insertSector(db);

    const result = await updatePerson(db, {
      actorId: actor.id,
      userId: dormant.id,
      role: "operator",
      sectorId: setor.id,
    });

    expect(result).toEqual({ ok: true });
    expect(await readUser(dormant.id)).toMatchObject({
      role: "operator",
      sectorId: setor.id,
    });
    expect((await readUser(actor.id)).role).toBe("admin");
  });

  it("operador desativado troca para setor ativo e, reativado, segue valendo", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const oldSector = await insertSector(db, undefined, { active: false });
    const newSector = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: oldSector.id,
      deactivatedAt: NOW,
    });

    const edited = await updatePerson(db, {
      actorId: admin.id,
      userId: person.id,
      role: "operator",
      sectorId: newSector.id,
    });
    expect(edited).toEqual({ ok: true });
    expect((await readUser(person.id)).deactivatedAt).not.toBeNull();

    const reactivated = await setPersonActive(
      db,
      { actorId: admin.id, userId: person.id, active: true },
      NOW,
    );

    expect(reactivated).toEqual({ ok: true });
    expect(await readUser(person.id)).toMatchObject({
      sectorId: newSector.id,
      deactivatedAt: null,
    });
  });

  it("não rebaixa o último admin ativo (LAST_ADMIN), ainda que haja admin inativo", async () => {
    const lonely = await insertUser(db, { role: "admin", sectorId: null });
    await insertUser(db, {
      role: "admin",
      sectorId: null,
      deactivatedAt: NOW,
    });
    const setor = await insertSector(db);

    const result = await updatePerson(db, {
      actorId: "outra-conta",
      userId: lonely.id,
      role: "operator",
      sectorId: setor.id,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "LAST_ADMIN",
      message: LAST_ADMIN_MESSAGE,
    });
    expect((await readUser(lonely.id)).role).toBe("admin");
  });

  it("sem mudança real devolve ok e não altera a pessoa", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
    });

    const result = await updatePerson(db, {
      actorId: admin.id,
      userId: person.id,
      role: "operator",
      sectorId: setor.id,
    });

    expect(result).toEqual({ ok: true });
    expect(await readUser(person.id)).toMatchObject({
      role: "operator",
      sectorId: setor.id,
    });
  });

  it("editar-se sem mudar o papel é permitido", async () => {
    const me = await insertUser(db, { role: "admin", sectorId: null });

    const result = await updatePerson(db, {
      actorId: me.id,
      userId: me.id,
      role: "admin",
      sectorId: null,
    });

    expect(result).toEqual({ ok: true });
  });
});

describe("setPersonActive", () => {
  it("desativa o operador e grava a hora", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
    });

    const result = await setPersonActive(
      db,
      { actorId: admin.id, userId: person.id, active: false },
      NOW,
    );

    expect(result).toEqual({ ok: true });
    expect((await readUser(person.id)).deactivatedAt).toEqual(NOW);
  });

  it("P11: apaga TODAS as sessões da pessoa e só as dela", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
    });
    const bystander = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
    });
    await insertSession(db, { userId: person.id });
    await insertSession(db, { userId: person.id });
    await insertSession(db, { userId: person.id });
    await insertSession(db, { userId: bystander.id });
    await insertSession(db, { userId: admin.id });

    await setPersonActive(
      db,
      { actorId: admin.id, userId: person.id, active: false },
      NOW,
    );

    expect(await countSessions(person.id)).toBe(0);
    expect(await countSessions(bystander.id)).toBe(1);
    expect(await countSessions(admin.id)).toBe(1);
  });

  it("recusa não apaga sessões (SELF_CHANGE)", async () => {
    const me = await insertUser(db, { role: "admin", sectorId: null });
    await insertUser(db, { role: "admin", sectorId: null });
    await insertSession(db, { userId: me.id });

    const result = await setPersonActive(
      db,
      { actorId: me.id, userId: me.id, active: false },
      NOW,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "SELF_CHANGE",
      message: SELF_DEACTIVATE_MESSAGE,
    });
    expect(await countSessions(me.id)).toBe(1);
    expect((await readUser(me.id)).deactivatedAt).toBeNull();
  });

  it("dois admins que se desativam em sequência: o segundo é recusado (LAST_ADMIN)", async () => {
    const a = await insertUser(db, { role: "admin", sectorId: null });
    const b = await insertUser(db, { role: "admin", sectorId: null });
    await insertSession(db, { userId: a.id });

    const first = await setPersonActive(
      db,
      { actorId: a.id, userId: b.id, active: false },
      NOW,
    );
    const second = await setPersonActive(
      db,
      { actorId: b.id, userId: a.id, active: false },
      NOW,
    );

    expect(first).toEqual({ ok: true });
    expect(second).toMatchObject({
      ok: false,
      code: "LAST_ADMIN",
      message: LAST_ADMIN_MESSAGE,
    });
    expect((await readUser(a.id)).deactivatedAt).toBeNull();
    expect(await countSessions(a.id)).toBe(1);
  });

  it("não desativa o único admin ativo (LAST_ADMIN)", async () => {
    const lonely = await insertUser(db, { role: "admin", sectorId: null });

    const result = await setPersonActive(
      db,
      { actorId: "outra-conta", userId: lonely.id, active: false },
      NOW,
    );

    expect(result).toMatchObject({ ok: false, code: "LAST_ADMIN" });
    expect((await readUser(lonely.id)).deactivatedAt).toBeNull();
  });

  it("pessoa inexistente: NOT_FOUND", async () => {
    const result = await setPersonActive(
      db,
      { actorId: "x", userId: "nao-existe", active: false },
      NOW,
    );
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("idempotente: desativar quem já está inativo é ok, mantém a hora e limpa sessões que sobraram", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const earlier = new Date("2026-11-01T00:00:00.000Z");
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
      deactivatedAt: earlier,
    });
    await insertSession(db, { userId: person.id });

    const result = await setPersonActive(
      db,
      { actorId: admin.id, userId: person.id, active: false },
      NOW,
    );

    expect(result).toEqual({ ok: true });
    expect((await readUser(person.id)).deactivatedAt).toEqual(earlier);
    expect(await countSessions(person.id)).toBe(0);
  });

  it("idempotente: desativar admin já inativo não cai em LAST_ADMIN", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const gone = await insertUser(db, {
      role: "admin",
      sectorId: null,
      deactivatedAt: NOW,
    });

    const result = await setPersonActive(
      db,
      { actorId: admin.id, userId: gone.id, active: false },
      NOW,
    );

    expect(result).toEqual({ ok: true });
  });

  it("reativa o operador (setor ativo)", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
      deactivatedAt: NOW,
    });

    const result = await setPersonActive(
      db,
      { actorId: admin.id, userId: person.id, active: true },
      NOW,
    );

    expect(result).toEqual({ ok: true });
    expect((await readUser(person.id)).deactivatedAt).toBeNull();
  });

  it("reativar operador com setor inativo é recusado (SECTOR_INACTIVE)", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db, "Fechado", { active: false });
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
      deactivatedAt: NOW,
    });

    const result = await setPersonActive(
      db,
      { actorId: admin.id, userId: person.id, active: true },
      NOW,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "SECTOR_INACTIVE",
      message: PERSON_SECTOR_INACTIVE_MESSAGE,
    });
    expect((await readUser(person.id)).deactivatedAt).toEqual(NOW);
  });

  it("reativar admin não olha setor", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const gone = await insertUser(db, {
      role: "admin",
      sectorId: null,
      deactivatedAt: NOW,
    });

    const result = await setPersonActive(
      db,
      { actorId: admin.id, userId: gone.id, active: true },
      NOW,
    );

    expect(result).toEqual({ ok: true });
    expect((await readUser(gone.id)).deactivatedAt).toBeNull();
  });

  it("idempotente: reativar quem já está ativo é ok", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
    });

    const result = await setPersonActive(
      db,
      { actorId: admin.id, userId: person.id, active: true },
      NOW,
    );

    expect(result).toEqual({ ok: true });
  });
});
