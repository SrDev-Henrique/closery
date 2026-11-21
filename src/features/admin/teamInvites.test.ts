import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { invite } from "@/db/schema/invites";
import { findInviteByToken } from "@/features/invites/inviteQueries";
import { INVITE_TTL_MS } from "@/features/invites/inviteState";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertInvite, insertSector, insertUser } from "../../../test/fixtures";
import {
  INVITE_LABEL_TOO_LONG_MESSAGE,
  INVITE_NOT_PENDING_MESSAGE,
  SECTOR_INACTIVE_MESSAGE,
  SECTOR_REQUIRED_MESSAGE,
} from "./messages";
import { PAGE_SIZE } from "./pagination";
import {
  cancelPendingInvite,
  createTeamInvite,
  listPendingInvites,
} from "./teamInvites";

const NOW = new Date("2026-11-21T12:00:00.000Z");
const BASE_URL = "https://closery.example.test";

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

async function readInvite(id: string) {
  const [row] = await db.select().from(invite).where(eq(invite.id, id));
  if (!row) throw new Error("convite não encontrado");
  return row;
}

function tokenOf(url: string): string {
  const token = url.split("/convite/")[1];
  if (!token) throw new Error(`link sem token: ${url}`);
  return token;
}

describe("createTeamInvite", () => {
  it("convite de operador: grava setor, rótulo e quem convidou, e o link tem um token que findInviteByToken aceita", async () => {
    const admin = await insertUser(db, {
      role: "admin",
      sectorId: null,
      name: "Carla Admin",
    });
    const setor = await insertSector(db, "Almoxarifado");

    const result = await createTeamInvite(db, {
      actorId: admin.id,
      inviteeLabel: "  Maria   do Turno  ",
      role: "operator",
      sectorId: setor.id,
      baseURL: BASE_URL,
      now: NOW,
    });

    if (!result.ok) throw new Error(result.message);
    expect(result.url).toMatch(
      new RegExp(`^${BASE_URL}/convite/[A-Za-z0-9_-]{43}$`),
    );
    expect(result.expiresAt).toEqual(new Date(NOW.getTime() + INVITE_TTL_MS));

    const found = await findInviteByToken(db, tokenOf(result.url), NOW);
    expect(found).toMatchObject({
      state: "valid",
      role: "operator",
      sectorName: "Almoxarifado",
      inviterName: "Carla Admin",
      inviteeLabel: "Maria do Turno",
    });

    const row = await readInvite(result.id);
    expect(row.invitedBy).toBe(admin.id);
    expect(row.sectorId).toBe(setor.id);
  });

  it("convite de admin ignora o setor enviado e grava null", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);

    const result = await createTeamInvite(db, {
      actorId: admin.id,
      inviteeLabel: null,
      role: "admin",
      sectorId: setor.id,
      baseURL: BASE_URL,
      now: NOW,
    });

    if (!result.ok) throw new Error(result.message);
    expect((await readInvite(result.id)).sectorId).toBeNull();
    const found = await findInviteByToken(db, tokenOf(result.url), NOW);
    expect(found).toMatchObject({ role: "admin", sectorName: null });
  });

  it("operador sem setor: SECTOR_REQUIRED e nenhum convite gravado", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });

    const result = await createTeamInvite(db, {
      actorId: admin.id,
      inviteeLabel: null,
      role: "operator",
      sectorId: null,
      baseURL: BASE_URL,
      now: NOW,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "SECTOR_REQUIRED",
      message: SECTOR_REQUIRED_MESSAGE,
      fieldErrors: { sectorId: SECTOR_REQUIRED_MESSAGE },
    });
    expect(await db.select().from(invite)).toHaveLength(0);
  });

  it("setor inativo: SECTOR_INACTIVE e nenhum convite gravado", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db, "Fechado", { active: false });

    const result = await createTeamInvite(db, {
      actorId: admin.id,
      inviteeLabel: null,
      role: "operator",
      sectorId: setor.id,
      baseURL: BASE_URL,
      now: NOW,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "SECTOR_INACTIVE",
      message: SECTOR_INACTIVE_MESSAGE,
    });
    expect(await db.select().from(invite)).toHaveLength(0);
  });

  it("setor inexistente: NOT_FOUND", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });

    const result = await createTeamInvite(db, {
      actorId: admin.id,
      inviteeLabel: null,
      role: "operator",
      sectorId: "00000000-0000-4000-8000-000000000000",
      baseURL: BASE_URL,
      now: NOW,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
      message: "Setor não encontrado. Atualize a página.",
    });
  });

  it("rótulo vazio ou só espaços vira null", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });

    for (const label of ["", "   ", null]) {
      const result = await createTeamInvite(db, {
        actorId: admin.id,
        inviteeLabel: label,
        role: "admin",
        sectorId: null,
        baseURL: BASE_URL,
        now: NOW,
      });
      if (!result.ok) throw new Error(result.message);
      expect((await readInvite(result.id)).inviteeLabel).toBeNull();
    }
  });

  it("rótulo com 80 caracteres passa; com 81 é recusado (conta pontos de código)", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const input = {
      actorId: admin.id,
      role: "admin",
      sectorId: null,
      baseURL: BASE_URL,
      now: NOW,
    } as const;

    const accepted = await createTeamInvite(db, {
      ...input,
      inviteeLabel: "ã".repeat(80),
    });
    const refused = await createTeamInvite(db, {
      ...input,
      inviteeLabel: "😀".repeat(81),
    });

    expect(accepted.ok).toBe(true);
    expect(refused).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: INVITE_LABEL_TOO_LONG_MESSAGE,
      fieldErrors: { inviteeLabel: INVITE_LABEL_TOO_LONG_MESSAGE },
    });
    expect(await db.select().from(invite)).toHaveLength(1);
  });

  it("URL base inválida lança antes de gravar o convite", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });

    await expect(
      createTeamInvite(db, {
        actorId: admin.id,
        inviteeLabel: null,
        role: "admin",
        sectorId: null,
        baseURL: "localhost:3000",
        now: NOW,
      }),
    ).rejects.toThrow("BETTER_AUTH_URL");
    expect(await db.select().from(invite)).toHaveLength(0);
  });

  it("barra final ou caminho na URL base não duplicam a barra do link", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });

    const result = await createTeamInvite(db, {
      actorId: admin.id,
      inviteeLabel: null,
      role: "admin",
      sectorId: null,
      baseURL: `${BASE_URL}/`,
      now: NOW,
    });

    if (!result.ok) throw new Error(result.message);
    expect(result.url.startsWith(`${BASE_URL}/convite/`)).toBe(true);
  });
});

describe("listPendingInvites", () => {
  it("lista só os válidos e esconde usado, cancelado e expirado", async () => {
    const setor = await insertSector(db, "Almoxarifado");
    const admin = await insertUser(db, {
      role: "admin",
      sectorId: null,
      name: "Carla Admin",
    });
    await insertInvite(db, {
      role: "operator",
      sectorId: setor.id,
      inviteeLabel: "Válido",
      invitedBy: admin.id,
      now: NOW,
    });
    await insertInvite(db, {
      inviteeLabel: "Usado",
      usedAt: NOW,
      now: NOW,
    });
    await insertInvite(db, {
      inviteeLabel: "Cancelado",
      cancelledAt: NOW,
      now: NOW,
    });
    await insertInvite(db, {
      inviteeLabel: "Expirado",
      expiresAt: new Date(NOW.getTime() - 1),
      now: NOW,
    });
    await insertInvite(db, {
      inviteeLabel: "Expira agora",
      expiresAt: NOW,
      now: NOW,
    });

    const page = await listPendingInvites(db, { page: 1 }, NOW);

    expect(page.total).toBe(1);
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]).toMatchObject({
      inviteeLabel: "Válido",
      role: "operator",
      sectorName: "Almoxarifado",
      inviterName: "Carla Admin",
    });
    expect(page.rows[0]?.expiresAt).toEqual(
      new Date(NOW.getTime() + INVITE_TTL_MS),
    );
  });

  it("convite do sistema (sem convidante) e de admin (sem setor) vêm com nulos", async () => {
    await insertInvite(db, { now: NOW });

    const { rows } = await listPendingInvites(db, { page: 1 }, NOW);

    expect(rows[0]).toMatchObject({
      inviteeLabel: null,
      role: "admin",
      sectorName: null,
      inviterName: null,
    });
  });

  it("convite cancelado some da lista", async () => {
    const { id } = await insertInvite(db, { now: NOW });
    expect((await listPendingInvites(db, { page: 1 }, NOW)).total).toBe(1);

    await cancelPendingInvite(db, { id }, NOW);

    expect((await listPendingInvites(db, { page: 1 }, NOW)).total).toBe(0);
  });

  it("do mais novo para o mais antigo", async () => {
    for (const label of ["primeiro", "segundo", "terceiro"]) {
      await insertInvite(db, { inviteeLabel: label, now: NOW });
    }

    const { rows } = await listPendingInvites(db, { page: 1 }, NOW);

    expect(rows.map((row) => row.inviteeLabel)).toEqual([
      "terceiro",
      "segundo",
      "primeiro",
    ]);
  });

  it("vazio: página 1 de 1 sem linhas", async () => {
    expect(await listPendingInvites(db, { page: 1 }, NOW)).toMatchObject({
      rows: [],
      total: 0,
      page: 1,
      pageCount: 1,
    });
  });

  it("pagina de 50 em 50 e limita a página pedida ao intervalo", async () => {
    for (let index = 0; index < PAGE_SIZE + 1; index++) {
      await insertInvite(db, { now: NOW });
    }

    const first = await listPendingInvites(db, { page: 1 }, NOW);
    const second = await listPendingInvites(db, { page: 2 }, NOW);
    const beyond = await listPendingInvites(db, { page: 40 }, NOW);

    expect(first.rows).toHaveLength(PAGE_SIZE);
    expect(first.pageCount).toBe(2);
    expect(second.rows).toHaveLength(1);
    expect(beyond.page).toBe(2);
    expect(beyond.rows).toHaveLength(1);
  });
});

describe("cancelPendingInvite", () => {
  it("cancela o convite pendente", async () => {
    const { id } = await insertInvite(db, { now: NOW });

    expect(await cancelPendingInvite(db, { id }, NOW)).toEqual({ ok: true });
    expect((await readInvite(id)).cancelledAt).toEqual(NOW);
  });

  it.each([
    ["usado", { usedAt: NOW }],
    ["já cancelado", { cancelledAt: NOW }],
    ["expirado", { expiresAt: new Date(NOW.getTime() - 1) }],
  ])("convite %s: INVITE_NOT_PENDING", async (_name, state) => {
    const { id } = await insertInvite(db, { now: NOW, ...state });

    expect(await cancelPendingInvite(db, { id }, NOW)).toMatchObject({
      ok: false,
      code: "INVITE_NOT_PENDING",
      message: INVITE_NOT_PENDING_MESSAGE,
    });
  });

  it("id inexistente: INVITE_NOT_PENDING", async () => {
    expect(
      await cancelPendingInvite(
        db,
        { id: "00000000-0000-4000-8000-000000000000" },
        NOW,
      ),
    ).toMatchObject({ ok: false, code: "INVITE_NOT_PENDING" });
  });
});
