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

import { sector } from "@/db/schema/sectors";
import { authzOf } from "../../../../../test/authz";
import { createTestDb, resetDb, type TestDb } from "../../../../../test/db";
import { insertSector } from "../../../../../test/fixtures";

// Mesmo arranjo de actions.test.ts: o banco de verdade (PGlite) entra no lugar de
// "@/db" por um getter; operador recebe o mesmo 404 do requireAdmin.
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

import { createSectorAction, renameSectorAction } from "./actions";

const NOT_FOUND = Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;404"), {
  digest: "NEXT_HTTP_ERROR_FALLBACK;404",
});
const COLOR_ERROR = "Escolha uma das cores da lista.";

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

async function colorOf(id: string): Promise<string | undefined> {
  const [row] = await db
    .select({ color: sector.color })
    .from(sector)
    .where(eq(sector.id, id));
  return row?.color;
}

describe("a cor nas actions de setor: operador", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockRejectedValue(NOT_FOUND);
  });

  it("createSectorAction com cor recebe notFound e não toca o banco", async () => {
    await expect(
      createSectorAction({ name: "Novo", color: "pink" }),
    ).rejects.toBe(NOT_FOUND);

    expect(mocks.touched).not.toHaveBeenCalled();
    expect(await db.select().from(sector)).toEqual([]);
  });

  it("renameSectorAction com cor recebe notFound e a cor não muda", async () => {
    const created = await insertSector(db, "Original", { color: "sky" });

    await expect(
      renameSectorAction({ id: created.id, name: "Original", color: "pink" }),
    ).rejects.toBe(NOT_FOUND);

    expect(mocks.touched).not.toHaveBeenCalled();
    expect(await colorOf(created.id)).toBe("sky");
  });
});

describe("createSectorAction com cor", () => {
  it("grava a cor escolhida", async () => {
    const result = await createSectorAction({ name: "Pátio", color: "green" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await colorOf(result.id)).toBe("green");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
  });

  it("cor fora da paleta volta INVALID_INPUT no campo color, sem gravar nem revalidar", async () => {
    expect(await createSectorAction({ name: "Pátio", color: "red" })).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      message: COLOR_ERROR,
      fieldErrors: { color: COLOR_ERROR },
    });
    expect(await db.select().from(sector)).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("sem cor (campo ausente) é recusado: o servidor nunca escolhe a cor", async () => {
    expect(await createSectorAction({ name: "Pátio" })).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { color: COLOR_ERROR },
    });
    expect(await db.select().from(sector)).toEqual([]);
  });

  it("cor com tipo errado (número, nulo) é recusada", async () => {
    for (const color of [1, null, ["lilac"], { key: "lilac" }]) {
      expect(await createSectorAction({ name: "Pátio", color })).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
      });
    }
    expect(await db.select().from(sector)).toEqual([]);
  });
});

describe("renameSectorAction com cor", () => {
  it("troca a cor do setor", async () => {
    const created = await insertSector(db, "Pátio", { color: "lilac" });

    expect(
      await renameSectorAction({
        id: created.id,
        name: "Pátio",
        color: "pink",
      }),
    ).toEqual({ ok: true });
    expect(await colorOf(created.id)).toBe("pink");
  });

  it("cor fora da paleta é recusada e a cor atual continua", async () => {
    const created = await insertSector(db, "Pátio", { color: "peach" });

    expect(
      await renameSectorAction({ id: created.id, name: "Pátio", color: "red" }),
    ).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { color: COLOR_ERROR },
    });
    expect(await colorOf(created.id)).toBe("peach");
  });

  it("sem cor é recusado (o formulário sempre manda)", async () => {
    const created = await insertSector(db, "Pátio", { color: "peach" });

    expect(
      await renameSectorAction({ id: created.id, name: "Novo" }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(await colorOf(created.id)).toBe("peach");
  });
});
