import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { destination } from "@/db/schema/catalog";
import { authzOf } from "../../../../../test/authz";
import { createTestDb, resetDb, type TestDb } from "../../../../../test/db";
import { insertDestination } from "../../../../../test/fixtures";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  database: { current: undefined as unknown },
  touched: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", () => ({
  get db() {
    mocks.touched();
    return mocks.database.current;
  },
}));

import {
  createDestinationAction,
  renameDestinationAction,
  setDestinationActiveAction,
} from "./actions";

const NOT_FOUND = Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;404"), {
  digest: "NEXT_HTTP_ERROR_FALLBACK;404",
});

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
  mocks.database.current = db;
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
  mocks.requireAdmin.mockReset();
  mocks.revalidatePath.mockReset();
  mocks.touched.mockReset();
  mocks.requireAdmin.mockResolvedValue(authzOf({ role: "admin" }));
});

describe("actions de destino: operador", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockRejectedValue(NOT_FOUND);
  });

  it("nenhuma action toca o banco quando o guarda recusa", async () => {
    const created = await insertDestination(db, { name: "Oficina" });

    await expect(createDestinationAction({ name: "Novo" })).rejects.toBe(
      NOT_FOUND,
    );
    await expect(
      renameDestinationAction({ id: created.id, name: "Trocado" }),
    ).rejects.toBe(NOT_FOUND);
    await expect(
      setDestinationActiveAction({ id: created.id, active: false }),
    ).rejects.toBe(NOT_FOUND);

    expect(mocks.touched).not.toHaveBeenCalled();
    const rows = await db.select().from(destination);
    expect(rows).toMatchObject([{ name: "Oficina", active: true }]);
  });
});

describe("createDestinationAction", () => {
  it("cria o destino e revalida o /admin", async () => {
    const result = await createDestinationAction({ name: " Almoxarifado " });

    expect(result.ok).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
    const rows = await db.select().from(destination);
    expect(rows.map((row) => row.name)).toEqual(["Almoxarifado"]);
  });

  it("entrada inválida e nome repetido não gravam nem revalidam", async () => {
    await insertDestination(db, { name: "Oficina" });

    expect(await createDestinationAction({ name: "" })).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Informe o nome.",
    });
    expect(await createDestinationAction({ name: "OFICINA" })).toMatchObject({
      ok: false,
      code: "NAME_TAKEN",
    });
    expect(await db.select().from(destination)).toHaveLength(1);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("renameDestinationAction e setDestinationActiveAction", () => {
  it("renomeia e desativa", async () => {
    const created = await insertDestination(db, { name: "Velho" });

    expect(
      await renameDestinationAction({ id: created.id, name: "Novo" }),
    ).toEqual({ ok: true });
    expect(
      await setDestinationActiveAction({ id: created.id, active: false }),
    ).toEqual({ ok: true });
    const [row] = await db
      .select()
      .from(destination)
      .where(eq(destination.id, created.id));
    expect(row).toMatchObject({ name: "Novo", active: false });
  });

  it("id malformado é recusado antes do banco", async () => {
    expect(
      await setDestinationActiveAction({ id: "abc", active: false }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });
});
