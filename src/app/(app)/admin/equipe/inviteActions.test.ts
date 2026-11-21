import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { invite } from "@/db/schema/invites";
import { findInviteByToken } from "@/features/invites/inviteQueries";
import { authzOf } from "../../../../../test/authz";
import { resetDb } from "../../../../../test/db";
import {
  insertInvite,
  insertSector,
  insertUser,
} from "../../../../../test/fixtures";
import { cancelInviteAction, createInviteAction } from "./actions";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  client: null as PGlite | null,
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/auth", () => ({
  authEnv: { baseURL: "https://closery.example.test" },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../../../test/db");
  const created = await createTestDb();
  mocks.client = created.client;
  return { db: created.db };
});

const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";

beforeEach(async () => {
  if (!mocks.client) throw new Error("PGlite não iniciou");
  await resetDb(mocks.client);
  mocks.requireAdmin.mockReset();
  mocks.revalidatePath.mockReset();
});

async function setup() {
  const admin = await insertUser(db, {
    role: "admin",
    sectorId: null,
    name: "Carla Admin",
  });
  const sector = await insertSector(db, "Almoxarifado");
  mocks.requireAdmin.mockResolvedValue(
    authzOf({ role: "admin", userId: admin.id }),
  );
  return { admin, sector };
}

describe("createInviteAction", () => {
  it("operador: requireAdmin lança notFound e nenhum convite é criado", async () => {
    const { sector } = await setup();
    mocks.requireAdmin.mockRejectedValue(new Error(NOT_FOUND));

    await expect(
      createInviteAction({
        inviteeLabel: "",
        role: "operator",
        sectorId: sector.id,
      }),
    ).rejects.toThrow(NOT_FOUND);

    expect(await db.select().from(invite)).toHaveLength(0);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("devolve o link com a URL do ambiente, aceito por findInviteByToken, convidado pelo admin da sessão", async () => {
    const { admin, sector } = await setup();

    const result = await createInviteAction({
      inviteeLabel: "  Maria  ",
      role: "operator",
      sectorId: sector.id,
    });

    if (!result.ok) throw new Error(result.message);
    expect(result.url.startsWith("https://closery.example.test/convite/")).toBe(
      true,
    );
    expect(result.expiresAt).toBeInstanceOf(Date);
    const token = result.url.split("/convite/")[1] ?? "";
    expect(await findInviteByToken(db, token, new Date())).toMatchObject({
      state: "valid",
      role: "operator",
      sectorName: "Almoxarifado",
      inviterName: "Carla Admin",
      inviteeLabel: "Maria",
    });
    const [row] = await db
      .select()
      .from(invite)
      .where(eq(invite.id, result.id));
    expect(row?.invitedBy).toBe(admin.id);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
  });

  it("convite de administrador não precisa de setor", async () => {
    await setup();

    const result = await createInviteAction({
      inviteeLabel: "",
      role: "admin",
      sectorId: null,
    });

    expect(result.ok).toBe(true);
  });

  it("operador sem setor volta SECTOR_REQUIRED no campo", async () => {
    await setup();

    const result = await createInviteAction({
      inviteeLabel: "",
      role: "operator",
      sectorId: null,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "SECTOR_REQUIRED",
      fieldErrors: { sectorId: "Escolha o setor do operador." },
    });
    expect(await db.select().from(invite)).toHaveLength(0);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("nome de referência acima de 80 caracteres volta INVALID_INPUT no campo", async () => {
    await setup();

    const result = await createInviteAction({
      inviteeLabel: "a".repeat(81),
      role: "admin",
      sectorId: null,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: {
        inviteeLabel: "O nome de referência pode ter no máximo 80 caracteres.",
      },
    });
  });

  it("papel desconhecido e lixo voltam INVALID_INPUT", async () => {
    await setup();

    expect(
      await createInviteAction({
        inviteeLabel: "",
        role: "dono",
        sectorId: null,
      }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(await createInviteAction(undefined)).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
    });
  });
});

describe("cancelInviteAction", () => {
  it("operador: requireAdmin lança notFound e o convite continua pendente", async () => {
    await setup();
    const { id } = await insertInvite(db);
    mocks.requireAdmin.mockRejectedValue(new Error(NOT_FOUND));

    await expect(cancelInviteAction({ id })).rejects.toThrow(NOT_FOUND);

    const [row] = await db.select().from(invite).where(eq(invite.id, id));
    expect(row?.cancelledAt).toBeNull();
  });

  it("cancela o convite pendente e revalida", async () => {
    await setup();
    const { id } = await insertInvite(db);

    const result = await cancelInviteAction({ id });

    expect(result).toEqual({ ok: true });
    const [row] = await db.select().from(invite).where(eq(invite.id, id));
    expect(row?.cancelledAt).not.toBeNull();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
  });

  it("cancelar de novo volta INVITE_NOT_PENDING sem revalidar", async () => {
    await setup();
    const { id } = await insertInvite(db, { cancelledAt: new Date() });

    const result = await cancelInviteAction({ id });

    expect(result).toMatchObject({ ok: false, code: "INVITE_NOT_PENDING" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("id malformado volta INVALID_INPUT sem consultar o banco", async () => {
    await setup();

    expect(await cancelInviteAction({ id: "não-é-uuid" })).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Registro inválido. Atualize a página.",
    });
  });
});
