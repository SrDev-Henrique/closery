import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { user, verification } from "@/db/schema/auth";
import { auth } from "@/lib/auth";
import { authzOf } from "../../../../../test/authz";
import { resetDb } from "../../../../../test/db";
import { insertSector, insertUser } from "../../../../../test/fixtures";
import { createPasswordResetLinkAction } from "./actions";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  client: null as PGlite | null,
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../../../test/db");
  const created = await createTestDb();
  mocks.client = created.client;
  return { db: created.db };
});
vi.mock("@/lib/auth", async () => {
  const { db: testDb } = await import("@/db");
  const { createTestAuth, TEST_AUTH_ENV } = await import(
    "../../../../../test/auth"
  );
  return { authEnv: TEST_AUTH_ENV, auth: createTestAuth(testDb) };
});

const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";

beforeEach(async () => {
  if (!mocks.client) throw new Error("PGlite nao iniciou");
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
  return { person };
}

describe("createPasswordResetLinkAction", () => {
  it("operador: requireAdmin lanca notFound e nada e gravado", async () => {
    const { person } = await setup();
    mocks.requireAdmin.mockRejectedValue(new Error(NOT_FOUND));

    await expect(
      createPasswordResetLinkAction({ userId: person.id }),
    ).rejects.toThrow(NOT_FOUND);
    expect(await db.select().from(verification)).toHaveLength(0);
  });

  it("admin: devolve o link com a URL do ambiente e o token redefine de verdade", async () => {
    const { person } = await setup();

    const result = await createPasswordResetLinkAction({ userId: person.id });

    if (!result.ok) throw new Error(result.message);
    expect(
      result.url.startsWith("http://localhost:3000/redefinir-senha#token="),
    ).toBe(true);
    const token = new URL(result.url).hash.replace("#token=", "");
    const res = await auth.handler(
      new Request("http://localhost:3000/api/auth/reset-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ token, newPassword: "senha-nova-4567" }),
      }),
    );
    expect(res.status).toBe(200);
  });

  it("pessoa desativada: PERSON_INACTIVE", async () => {
    const { person } = await setup();
    await db
      .update(user)
      .set({ deactivatedAt: new Date() })
      .where(eq(user.id, person.id));
    const result = await createPasswordResetLinkAction({ userId: person.id });
    expect(result).toMatchObject({ ok: false, code: "PERSON_INACTIVE" });
    expect(await db.select().from(verification)).toHaveLength(0);
  });

  it("entrada invalida: INVALID_INPUT, sem tocar no banco", async () => {
    await setup();
    const result = await createPasswordResetLinkAction({});
    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(await db.select().from(verification)).toHaveLength(0);
  });

  it("pessoa inexistente: NOT_FOUND", async () => {
    await setup();
    const result = await createPasswordResetLinkAction({ userId: "ninguem" });
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});
