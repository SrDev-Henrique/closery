import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { session, user } from "@/db/schema/auth";
import { authzOf } from "../../../../../test/authz";
import { resetDb } from "../../../../../test/db";
import {
  insertSector,
  insertSession,
  insertUser,
} from "../../../../../test/fixtures";
import { setPersonActiveAction, updatePersonAction } from "./actions";

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
  const admin = await insertUser(db, { role: "admin", sectorId: null });
  const sector = await insertSector(db);
  const person = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
  });
  mocks.requireAdmin.mockResolvedValue(
    authzOf({ role: "admin", userId: admin.id }),
  );
  return { admin, sector, person };
}

describe("updatePersonAction", () => {
  it("operador: requireAdmin lança notFound e o banco não é tocado", async () => {
    const { sector, person } = await setup();
    const other = await insertSector(db);
    mocks.requireAdmin.mockRejectedValue(new Error(NOT_FOUND));

    await expect(
      updatePersonAction({
        userId: person.id,
        role: "operator",
        sectorId: other.id,
      }),
    ).rejects.toThrow(NOT_FOUND);

    const [row] = await db.select().from(user).where(eq(user.id, person.id));
    expect(row?.sectorId).toBe(sector.id);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("entrada inválida volta INVALID_INPUT com o erro no campo", async () => {
    const { person } = await setup();

    const result = await updatePersonAction({
      userId: person.id,
      role: "operator",
      sectorId: null,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Escolha o setor do operador.",
      fieldErrors: { sectorId: "Escolha o setor do operador." },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("lixo no lugar do objeto também volta INVALID_INPUT", async () => {
    await setup();
    const result = await updatePersonAction(null);
    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });

  it("actorId vindo do cliente não substitui o da sessão", async () => {
    const { admin } = await setup();
    const sector = await insertSector(db);

    // Quem age é o admin da sessão; o cliente tenta se passar por outra conta.
    const result = await updatePersonAction({
      userId: admin.id,
      role: "operator",
      sectorId: sector.id,
      actorId: "outra-conta",
    });

    expect(result).toMatchObject({ ok: false, code: "SELF_CHANGE" });
    const [row] = await db.select().from(user).where(eq(user.id, admin.id));
    expect(row?.role).toBe("admin");
  });

  it("admin muda o setor e a tela é revalidada", async () => {
    const { person } = await setup();
    const other = await insertSector(db);

    const result = await updatePersonAction({
      userId: person.id,
      role: "operator",
      sectorId: other.id,
    });

    expect(result).toEqual({ ok: true });
    const [row] = await db.select().from(user).where(eq(user.id, person.id));
    expect(row?.sectorId).toBe(other.id);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
  });

  it("o admin não rebaixa a si mesmo (SELF_CHANGE) e nada é revalidado", async () => {
    const { admin, sector } = await setup();
    await insertUser(db, { role: "admin", sectorId: null });

    const result = await updatePersonAction({
      userId: admin.id,
      role: "operator",
      sectorId: sector.id,
    });

    expect(result).toMatchObject({ ok: false, code: "SELF_CHANGE" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("setPersonActiveAction", () => {
  it("operador: requireAdmin lança notFound e a pessoa continua ativa com a sessão", async () => {
    const { person } = await setup();
    await insertSession(db, { userId: person.id });
    mocks.requireAdmin.mockRejectedValue(new Error(NOT_FOUND));

    await expect(
      setPersonActiveAction({ userId: person.id, active: false }),
    ).rejects.toThrow(NOT_FOUND);

    const [row] = await db.select().from(user).where(eq(user.id, person.id));
    expect(row?.deactivatedAt).toBeNull();
    const sessions = await db
      .select()
      .from(session)
      .where(eq(session.userId, person.id));
    expect(sessions).toHaveLength(1);
  });

  it("desativa, apaga as sessões e revalida", async () => {
    const { person } = await setup();
    await insertSession(db, { userId: person.id });

    const result = await setPersonActiveAction({
      userId: person.id,
      active: false,
    });

    expect(result).toEqual({ ok: true });
    const [row] = await db.select().from(user).where(eq(user.id, person.id));
    expect(row?.deactivatedAt).not.toBeNull();
    const sessions = await db
      .select()
      .from(session)
      .where(eq(session.userId, person.id));
    expect(sessions).toHaveLength(0);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
  });

  it("quem age vem da sessão: um actorId forjado na entrada é ignorado", async () => {
    const { admin } = await setup();
    const other = await insertUser(db, { role: "admin", sectorId: null });

    const result = await setPersonActiveAction({
      userId: admin.id,
      active: false,
      actorId: other.id,
    });

    expect(result).toMatchObject({ ok: false, code: "SELF_CHANGE" });
    const [row] = await db.select().from(user).where(eq(user.id, admin.id));
    expect(row?.deactivatedAt).toBeNull();
  });

  it("entrada inválida (active não booleano) volta INVALID_INPUT", async () => {
    const { person } = await setup();
    const result = await setPersonActiveAction({
      userId: person.id,
      active: "sim",
    });
    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });

  it("último admin ativo não se desativa (LAST_ADMIN)", async () => {
    const { admin } = await setup();
    mocks.requireAdmin.mockResolvedValue(
      authzOf({ role: "admin", userId: "outra-conta" }),
    );

    const result = await setPersonActiveAction({
      userId: admin.id,
      active: false,
    });

    expect(result).toMatchObject({ ok: false, code: "LAST_ADMIN" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
