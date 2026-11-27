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
import {
  insertInvite,
  insertSector,
  insertUser,
} from "../../../../../test/fixtures";

// O banco de verdade (PGlite) entra no lugar de "@/db" por um getter; o
// guarda de acesso é simulado: operador recebe o mesmo 404 do requireAdmin.
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
  createSectorAction,
  renameSectorAction,
  setSectorActiveAction,
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

describe("actions de setor: operador", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockRejectedValue(NOT_FOUND);
  });

  it("createSectorAction recebe notFound e não toca o banco", async () => {
    await expect(
      createSectorAction({ name: "Novo", color: "lilac" }),
    ).rejects.toBe(NOT_FOUND);

    expect(mocks.touched).not.toHaveBeenCalled();
    expect(await db.select().from(sector)).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("renameSectorAction recebe notFound e não toca o banco", async () => {
    const created = await insertSector(db, "Original");

    await expect(
      renameSectorAction({ id: created.id, name: "Trocado", color: "lilac" }),
    ).rejects.toBe(NOT_FOUND);

    expect(mocks.touched).not.toHaveBeenCalled();
    const [row] = await db
      .select()
      .from(sector)
      .where(eq(sector.id, created.id));
    expect(row?.name).toBe("Original");
  });

  it("setSectorActiveAction recebe notFound e não toca o banco", async () => {
    const created = await insertSector(db, "Ativo");

    await expect(
      setSectorActiveAction({ id: created.id, active: false }),
    ).rejects.toBe(NOT_FOUND);

    expect(mocks.touched).not.toHaveBeenCalled();
    const [row] = await db
      .select()
      .from(sector)
      .where(eq(sector.id, created.id));
    expect(row?.active).toBe(true);
  });
});

describe("createSectorAction", () => {
  it("cria o setor e revalida o /admin", async () => {
    const result = await createSectorAction({
      name: "  Almoxarifado ",
      color: "lilac",
    });

    expect(result.ok).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
    const rows = await db.select().from(sector);
    expect(rows.map((row) => row.name)).toEqual(["Almoxarifado"]);
  });

  it("entrada inválida volta com a mensagem no campo e sem gravar", async () => {
    expect(await createSectorAction({ name: "   ", color: "lilac" })).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      message: "Informe o nome.",
      fieldErrors: { name: "Informe o nome." },
    });
    expect(await createSectorAction({})).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
    });
    expect(await createSectorAction(null)).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
    });
    expect(await db.select().from(sector)).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("nome repetido volta NAME_TAKEN e não revalida", async () => {
    await insertSector(db, "ULD");

    expect(
      await createSectorAction({ name: "uld", color: "lilac" }),
    ).toMatchObject({
      ok: false,
      code: "NAME_TAKEN",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("renameSectorAction", () => {
  it("renomeia o setor", async () => {
    const created = await insertSector(db, "Velho");

    expect(
      await renameSectorAction({
        id: created.id,
        name: "Novo",
        color: "lilac",
      }),
    ).toEqual({
      ok: true,
    });
    const [row] = await db
      .select()
      .from(sector)
      .where(eq(sector.id, created.id));
    expect(row?.name).toBe("Novo");
  });

  it("id malformado é recusado antes do banco", async () => {
    expect(
      await renameSectorAction({ id: "abc", name: "Novo", color: "lilac" }),
    ).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Registro inválido. Atualize a página.",
    });
  });
});

describe("setSectorActiveAction", () => {
  it("desativa um setor vazio e reativa", async () => {
    const created = await insertSector(db, "Vazio");

    expect(
      await setSectorActiveAction({ id: created.id, active: false }),
    ).toEqual({ ok: true });
    expect(
      await setSectorActiveAction({ id: created.id, active: true }),
    ).toEqual({ ok: true });
  });

  it("setor com operador ativo e convite pendente devolve SECTOR_IN_USE", async () => {
    const busy = await insertSector(db, "Ocupado");
    await insertUser(db, { role: "operator", sectorId: busy.id });
    await insertInvite(db, { role: "operator", sectorId: busy.id });

    expect(await setSectorActiveAction({ id: busy.id, active: false })).toEqual(
      {
        ok: false,
        code: "SECTOR_IN_USE",
        message:
          "Este setor tem 1 pessoa ativa e 1 convite pendente. Mova, desative ou cancele antes.",
      },
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("active que não é booleano é recusado", async () => {
    const created = await insertSector(db, "Qualquer");

    expect(
      await setSectorActiveAction({ id: created.id, active: "false" }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });
});

describe("falha inesperada", () => {
  it("vira INTERNAL sem vazar o texto do erro", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.database.current = {
      transaction: () => {
        throw new Error("senha do banco: segredo");
      },
    };
    try {
      const created = await insertSector(db, "Qualquer");
      const result = await setSectorActiveAction({
        id: created.id,
        active: false,
      });

      expect(result).toEqual({
        ok: false,
        code: "INTERNAL",
        message: "Não foi possível concluir. Tente de novo.",
      });
    } finally {
      mocks.database.current = db;
      vi.restoreAllMocks();
    }
  });
});
