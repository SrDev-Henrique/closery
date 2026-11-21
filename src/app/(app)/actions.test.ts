import type { PGlite } from "@electric-sql/pglite";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { authzOf } from "../../../test/authz";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertSector } from "../../../test/fixtures";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  cookieSet: vi.fn(),
  database: { current: undefined as unknown },
  touched: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.cookieSet }),
}));
vi.mock("@/db", () => ({
  get db() {
    mocks.touched();
    return mocks.database.current;
  },
}));

import { chooseSectorAction } from "./actions";

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
  mocks.cookieSet.mockReset();
  mocks.touched.mockReset();
  mocks.requireAdmin.mockResolvedValue(authzOf({ role: "admin" }));
});

// redirect() lança um erro cujo `digest` carrega o destino.
async function redirectDigest(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error && "digest" in error) {
      return String(error.digest);
    }
    throw error;
  }
  throw new Error("a action devia redirecionar");
}

describe("chooseSectorAction", () => {
  it("operador recebe notFound e nada é tocado (nem banco, nem cookie)", async () => {
    mocks.requireAdmin.mockRejectedValue(NOT_FOUND);

    await expect(chooseSectorAction({ sectorId: "x", path: "/" })).rejects.toBe(
      NOT_FOUND,
    );

    expect(mocks.touched).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("grava o cookie com os atributos certos e redireciona", async () => {
    const created = await insertSector(db, "ULD");

    const digest = await redirectDigest(
      chooseSectorAction({ sectorId: created.id, path: "/passagens" }),
    );

    expect(digest).toContain(`/passagens?setor=${created.id}`);
    expect(mocks.cookieSet).toHaveBeenCalledWith("closery_setor", created.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 31_536_000,
    });
  });

  it.each([
    "/",
    "/passagens",
    "/passagens/nova",
  ] as const)("redireciona para o caminho permitido %s", async (path) => {
    const created = await insertSector(db);

    const digest = await redirectDigest(
      chooseSectorAction({ sectorId: created.id, path }),
    );

    expect(digest).toContain(`${path}?setor=${created.id}`);
  });

  it("'todos' redireciona sem gravar cookie", async () => {
    const digest = await redirectDigest(
      chooseSectorAction({ sectorId: "todos", path: "/passagens" }),
    );

    expect(digest).toContain("/passagens?setor=todos");
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("caminho fora da lista é entrada inválida (sem cookie, sem redirect)", async () => {
    const created = await insertSector(db);

    const result = await chooseSectorAction({
      sectorId: created.id,
      path: "/admin/setores",
    });

    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("id malformado é entrada inválida", async () => {
    const result = await chooseSectorAction({ sectorId: "abc", path: "/" });

    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });

  it("setor inexistente: NOT_FOUND, sem cookie", async () => {
    const result = await chooseSectorAction({
      sectorId: "99999999-9999-4999-8999-999999999999",
      path: "/",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
      message: "Setor não encontrado. Atualize a página.",
    });
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("setor inativo: SECTOR_INACTIVE, sem cookie", async () => {
    const created = await insertSector(db, "Parado", { active: false });

    const result = await chooseSectorAction({
      sectorId: created.id,
      path: "/",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "SECTOR_INACTIVE",
      message:
        "Este setor está inativo. Peça a um administrador para reativá-lo.",
    });
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });
});
