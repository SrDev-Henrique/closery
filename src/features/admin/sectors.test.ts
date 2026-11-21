import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { sector } from "@/db/schema/sectors";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertInvite, insertSector, insertUser } from "../../../test/fixtures";
import { PAGE_SIZE } from "./pagination";
import {
  createSector,
  listActiveSectors,
  listSectors,
  renameSector,
  resolveSectorFilter,
  setSectorActive,
} from "./sectors";

const NOW = new Date("2026-11-21T12:00:00.000Z");
const DAY = 86_400_000;
const MISSING_ID = "00000000-0000-4000-8000-000000000000";

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

async function readSector(id: string) {
  const [row] = await db.select().from(sector).where(eq(sector.id, id));
  if (!row) throw new Error("setor não encontrado");
  return row;
}

describe("createSector", () => {
  it("cria o setor ativo e devolve o id", async () => {
    const result = await createSector(db, { name: "Almoxarifado" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const row = await readSector(result.id);
    expect(row).toMatchObject({ name: "Almoxarifado", active: true });
  });

  it("normaliza o nome antes de gravar", async () => {
    const result = await createSector(db, { name: "  Carga   Aérea  " });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((await readSector(result.id)).name).toBe("Carga Aérea");
  });

  it("recusa nome vazio ou só com espaços, com o erro no campo name", async () => {
    for (const name of ["", "   "]) {
      expect(await createSector(db, { name })).toEqual({
        ok: false,
        code: "INVALID_INPUT",
        message: "Informe o nome.",
        fieldErrors: { name: "Informe o nome." },
      });
    }
    expect(await db.select().from(sector)).toEqual([]);
  });

  it("aceita 60 caracteres e recusa 61", async () => {
    expect((await createSector(db, { name: "a".repeat(60) })).ok).toBe(true);

    const tooLong = await createSector(db, { name: "b".repeat(61) });
    expect(tooLong).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "O nome pode ter no máximo 60 caracteres.",
    });
  });

  it("recusa nome repetido sem diferença de caixa", async () => {
    await createSector(db, { name: "ULD" });

    expect(await createSector(db, { name: "uld" })).toEqual({
      ok: false,
      code: "NAME_TAKEN",
      message: "Já existe um setor com este nome.",
      fieldErrors: { name: "Já existe um setor com este nome." },
    });
  });

  it("recusa nome repetido com acento em caixa diferente", async () => {
    await createSector(db, { name: "Água" });

    const result = await createSector(db, { name: "ÁGUA" });

    expect(result).toMatchObject({ ok: false, code: "NAME_TAKEN" });
  });

  it("avisa que o setor de mesmo nome está inativo", async () => {
    await insertSector(db, "Antigo", { active: false });

    const result = await createSector(db, { name: "antigo" });

    expect(result).toMatchObject({
      ok: false,
      code: "NAME_TAKEN",
      message:
        "Já existe um setor com este nome. Ele está inativo: reative-o na lista.",
    });
  });
});

describe("renameSector", () => {
  it("renomeia e normaliza", async () => {
    const created = await insertSector(db, "Velho");

    const result = await renameSector(db, {
      id: created.id,
      name: "  Novo   nome ",
    });

    expect(result).toEqual({ ok: true });
    expect((await readSector(created.id)).name).toBe("Novo nome");
  });

  it("deixa trocar só a caixa do próprio nome", async () => {
    const created = await insertSector(db, "uld");

    expect(await renameSector(db, { id: created.id, name: "ULD" })).toEqual({
      ok: true,
    });
    expect((await readSector(created.id)).name).toBe("ULD");
  });

  it("recusa o nome de outro setor", async () => {
    await insertSector(db, "ULD");
    const other = await insertSector(db, "Pátio");

    const result = await renameSector(db, { id: other.id, name: "uld" });

    expect(result).toMatchObject({ ok: false, code: "NAME_TAKEN" });
    expect((await readSector(other.id)).name).toBe("Pátio");
  });

  it("recusa nome vazio sem tocar no registro", async () => {
    const created = await insertSector(db, "Pátio");

    const result = await renameSector(db, { id: created.id, name: " " });

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Informe o nome.",
    });
    expect((await readSector(created.id)).name).toBe("Pátio");
  });

  it("id inexistente é NOT_FOUND", async () => {
    expect(await renameSector(db, { id: MISSING_ID, name: "X" })).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Setor não encontrado. Atualize a página.",
    });
  });
});

describe("setSectorActive", () => {
  it("desativa um setor sem pessoas nem convites", async () => {
    const created = await insertSector(db, "Vazio");

    expect(
      await setSectorActive(db, { id: created.id, active: false }, NOW),
    ).toEqual({ ok: true });
    expect((await readSector(created.id)).active).toBe(false);
  });

  it("bloqueia com pessoas ativas e convites pendentes e mostra as contagens", async () => {
    const busy = await insertSector(db, "Ocupado");
    for (let index = 0; index < 3; index++) {
      await insertUser(db, { role: "operator", sectorId: busy.id });
    }
    await insertInvite(db, { role: "operator", sectorId: busy.id, now: NOW });

    const result = await setSectorActive(
      db,
      { id: busy.id, active: false },
      NOW,
    );

    expect(result).toEqual({
      ok: false,
      code: "SECTOR_IN_USE",
      message:
        "Este setor tem 3 pessoas ativas e 1 convite pendente. Mova, desative ou cancele antes.",
    });
    expect((await readSector(busy.id)).active).toBe(true);
  });

  it("bloqueia só por pessoa ativa (singular)", async () => {
    const busy = await insertSector(db, "Ocupado");
    await insertUser(db, { role: "operator", sectorId: busy.id });

    const result = await setSectorActive(
      db,
      { id: busy.id, active: false },
      NOW,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "SECTOR_IN_USE",
      message: "Este setor tem 1 pessoa ativa. Mova ou desative antes.",
    });
  });

  it("bloqueia só por convites pendentes (plural)", async () => {
    const busy = await insertSector(db, "Ocupado");
    await insertInvite(db, { role: "operator", sectorId: busy.id, now: NOW });
    await insertInvite(db, { role: "operator", sectorId: busy.id, now: NOW });

    const result = await setSectorActive(
      db,
      { id: busy.id, active: false },
      NOW,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "SECTOR_IN_USE",
      message: "Este setor tem 2 convites pendentes. Cancele antes.",
    });
  });

  it("não bloqueia por pessoa desativada nem por convite expirado, usado ou cancelado", async () => {
    const calm = await insertSector(db, "Calmo");
    await insertUser(db, {
      role: "operator",
      sectorId: calm.id,
      deactivatedAt: new Date(NOW.getTime() - DAY),
    });
    const invites = { role: "operator", sectorId: calm.id, now: NOW } as const;
    await insertInvite(db, {
      ...invites,
      expiresAt: new Date(NOW.getTime() - 1),
    });
    await insertInvite(db, { ...invites, usedAt: NOW });
    await insertInvite(db, { ...invites, cancelledAt: NOW });

    expect(
      await setSectorActive(db, { id: calm.id, active: false }, NOW),
    ).toEqual({ ok: true });
    expect((await readSector(calm.id)).active).toBe(false);
  });

  it("convite que expira exatamente em `now` já não bloqueia", async () => {
    const edge = await insertSector(db, "Limite");
    await insertInvite(db, {
      role: "operator",
      sectorId: edge.id,
      now: NOW,
      expiresAt: NOW,
    });

    expect(
      await setSectorActive(db, { id: edge.id, active: false }, NOW),
    ).toEqual({ ok: true });
  });

  it("pessoa e convite de outro setor não bloqueiam este", async () => {
    const mine = await insertSector(db, "Meu");
    const other = await insertSector(db, "Outro");
    await insertUser(db, { role: "operator", sectorId: other.id });
    await insertInvite(db, { role: "operator", sectorId: other.id, now: NOW });

    expect(
      await setSectorActive(db, { id: mine.id, active: false }, NOW),
    ).toEqual({ ok: true });
  });

  it("reativar sempre passa", async () => {
    const off = await insertSector(db, "Desligado", { active: false });

    expect(
      await setSectorActive(db, { id: off.id, active: true }, NOW),
    ).toEqual({ ok: true });
    expect((await readSector(off.id)).active).toBe(true);
  });

  it("repetir o mesmo estado é sucesso sem mudança (idempotente)", async () => {
    const on = await insertSector(db, "Ligado");
    const off = await insertSector(db, "Desligado", { active: false });

    expect(await setSectorActive(db, { id: on.id, active: true }, NOW)).toEqual(
      { ok: true },
    );
    expect(
      await setSectorActive(db, { id: off.id, active: false }, NOW),
    ).toEqual({ ok: true });
  });

  it("id inexistente é NOT_FOUND", async () => {
    expect(
      await setSectorActive(db, { id: MISSING_ID, active: false }, NOW),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("listSectors", () => {
  it("lista vazia: nenhuma linha, uma página", async () => {
    expect(await listSectors(db, { page: 1 }, NOW)).toEqual({
      rows: [],
      total: 0,
      page: 1,
      pageCount: 1,
      pageSize: PAGE_SIZE,
    });
  });

  it("ordena ativos primeiro e depois por nome sem diferença de caixa", async () => {
    await insertSector(db, "bravo");
    await insertSector(db, "Alfa");
    await insertSector(db, "Zulu", { active: false });
    await insertSector(db, "Charlie");

    const page = await listSectors(db, { page: 1 }, NOW);

    expect(page.rows.map((row) => row.name)).toEqual([
      "Alfa",
      "bravo",
      "Charlie",
      "Zulu",
    ]);
    expect(page.rows.map((row) => row.active)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("conta pessoas ativas e convites pendentes de cada setor, só os válidos", async () => {
    const alfa = await insertSector(db, "Alfa");
    const bravo = await insertSector(db, "Bravo");
    await insertUser(db, { role: "operator", sectorId: alfa.id });
    await insertUser(db, { role: "operator", sectorId: alfa.id });
    await insertUser(db, {
      role: "operator",
      sectorId: alfa.id,
      deactivatedAt: NOW,
    });
    await insertUser(db, { role: "admin", sectorId: null });
    await insertInvite(db, { role: "operator", sectorId: alfa.id, now: NOW });
    await insertInvite(db, {
      role: "operator",
      sectorId: alfa.id,
      now: NOW,
      expiresAt: new Date(NOW.getTime() - 1),
    });
    await insertInvite(db, {
      role: "operator",
      sectorId: bravo.id,
      now: NOW,
      cancelledAt: NOW,
    });
    await insertInvite(db, { role: "admin", sectorId: null, now: NOW });

    const page = await listSectors(db, { page: 1 }, NOW);

    expect(page.rows).toEqual([
      {
        id: alfa.id,
        name: "Alfa",
        active: true,
        activePeople: 2,
        pendingInvites: 1,
      },
      {
        id: bravo.id,
        name: "Bravo",
        active: true,
        activePeople: 0,
        pendingInvites: 0,
      },
    ]);
  });

  it("pagina de 50 em 50 e prende a página pedida no intervalo", async () => {
    for (let index = 0; index < PAGE_SIZE + 1; index++) {
      await insertSector(db, `Setor ${String(index).padStart(3, "0")}`);
    }

    const first = await listSectors(db, { page: 1 }, NOW);
    expect(first).toMatchObject({ total: 51, page: 1, pageCount: 2 });
    expect(first.rows).toHaveLength(PAGE_SIZE);

    const second = await listSectors(db, { page: 2 }, NOW);
    expect(second.rows.map((row) => row.name)).toEqual(["Setor 050"]);

    const beyond = await listSectors(db, { page: 99 }, NOW);
    expect(beyond).toMatchObject({ page: 2, pageCount: 2 });
    expect(beyond.rows).toHaveLength(1);
  });
});

describe("listActiveSectors", () => {
  it("devolve só os ativos, por nome sem diferença de caixa", async () => {
    await insertSector(db, "bravo");
    await insertSector(db, "Alfa");
    await insertSector(db, "Inativo", { active: false });

    expect((await listActiveSectors(db)).map((choice) => choice.name)).toEqual([
      "Alfa",
      "bravo",
    ]);
  });

  it("devolve só id e name", async () => {
    const created = await insertSector(db, "Alfa");

    expect(await listActiveSectors(db)).toEqual([
      { id: created.id, name: "Alfa" },
    ]);
  });

  it("sem setores devolve lista vazia", async () => {
    expect(await listActiveSectors(db)).toEqual([]);
  });
});

describe("resolveSectorFilter", () => {
  const alfa = { id: "a", name: "Alfa" };
  const bravo = { id: "b", name: "Bravo" };

  it("usa o id da URL quando ele está na lista", () => {
    expect(resolveSectorFilter([alfa, bravo], "b")).toBe(bravo);
  });

  it("cai no primeiro setor sem parâmetro, com id desconhecido ou inativo", () => {
    expect(resolveSectorFilter([alfa, bravo], undefined)).toBe(alfa);
    expect(resolveSectorFilter([alfa, bravo], "x")).toBe(alfa);
    expect(resolveSectorFilter([alfa, bravo], "")).toBe(alfa);
  });

  it("usa o primeiro valor quando o parâmetro se repete", () => {
    expect(resolveSectorFilter([alfa, bravo], ["b", "a"])).toBe(bravo);
    expect(resolveSectorFilter([alfa, bravo], [])).toBe(alfa);
  });

  it("sem setores devolve null", () => {
    expect(resolveSectorFilter([], "a")).toBeNull();
    expect(resolveSectorFilter([], undefined)).toBeNull();
  });
});
