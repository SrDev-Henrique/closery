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

import type { Authz } from "@/features/authz/authz";
import { authzOf } from "../../../test/authz";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertSector } from "../../../test/fixtures";

const mocks = vi.hoisted(() => ({
  cookie: { value: undefined as string | undefined },
  reads: { count: 0 },
}));

vi.mock("next/headers", () => ({
  cookies: async () => {
    mocks.reads.count += 1;
    return {
      get: (name: string) =>
        name === "closery_setor" && mocks.cookie.value !== undefined
          ? { name, value: mocks.cookie.value }
          : undefined,
    };
  },
}));

import { resolveScreenSector } from "./screenSector";

const NIL_ID = "00000000-0000-4000-8000-000000000000";

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
  mocks.cookie.value = undefined;
  mocks.reads.count = 0;
});

const admin = authzOf({ role: "admin" });

describe("resolveScreenSector — admin", () => {
  it("sem nenhum setor ativo, devolve none", async () => {
    await insertSector(db, "Setor Parado", { active: false });

    expect(
      await resolveScreenSector(db, admin, { url: undefined, allowAll: true }),
    ).toEqual({ kind: "none" });
  });

  it("?setor= de um setor ativo devolve o setor com id, nome, lista e cookie", async () => {
    const uld = await insertSector(db, "ULD Teste");
    const camara = await insertSector(db, "Câmara Teste");
    mocks.cookie.value = uld.id;

    const result = await resolveScreenSector(db, admin, {
      url: camara.id,
      allowAll: true,
    });

    expect(result).toEqual({
      kind: "sector",
      sectorId: camara.id,
      sectorName: "Câmara Teste",
      sectorParam: camara.id,
      sectors: [
        { id: camara.id, name: "Câmara Teste" },
        { id: uld.id, name: "ULD Teste" },
      ],
      cookie: uld.id,
    });
  });

  it("?setor=todos com allowAll devolve all", async () => {
    const uld = await insertSector(db, "ULD Teste");

    expect(
      await resolveScreenSector(db, admin, { url: "todos", allowAll: true }),
    ).toEqual({
      kind: "all",
      sectorId: null,
      sectorName: null,
      sectorParam: "todos",
      sectors: [{ id: uld.id, name: "ULD Teste" }],
      cookie: undefined,
    });
  });

  it("?setor=todos sem allowAll cai no cookie e depois no primeiro", async () => {
    const camara = await insertSector(db, "Câmara Teste");
    const uld = await insertSector(db, "ULD Teste");

    const semCookie = await resolveScreenSector(db, admin, {
      url: "todos",
      allowAll: false,
    });
    expect(semCookie.kind).toBe("sector");
    if (semCookie.kind === "sector") expect(semCookie.sectorId).toBe(camara.id);

    mocks.cookie.value = uld.id;
    const comCookie = await resolveScreenSector(db, admin, {
      url: "todos",
      allowAll: false,
    });
    expect(comCookie.kind).toBe("sector");
    if (comCookie.kind === "sector") expect(comCookie.sectorId).toBe(uld.id);
  });

  it("?setor= inativo, inexistente ou lixo cai no cookie e depois no primeiro", async () => {
    const parado = await insertSector(db, "Setor Parado", { active: false });
    const camara = await insertSector(db, "Câmara Teste");
    const uld = await insertSector(db, "ULD Teste");

    for (const url of [parado.id, NIL_ID, "lixo", ["lixo"], undefined]) {
      mocks.cookie.value = undefined;
      const first = await resolveScreenSector(db, admin, {
        url,
        allowAll: true,
      });
      expect(first.kind).toBe("sector");
      if (first.kind === "sector") expect(first.sectorId).toBe(camara.id);
    }

    mocks.cookie.value = uld.id;
    const remembered = await resolveScreenSector(db, admin, {
      url: parado.id,
      allowAll: true,
    });
    expect(remembered.kind).toBe("sector");
    if (remembered.kind === "sector") expect(remembered.sectorId).toBe(uld.id);
  });

  it("cookie de setor inativo é ignorado", async () => {
    const parado = await insertSector(db, "Setor Parado", { active: false });
    const uld = await insertSector(db, "ULD Teste");
    mocks.cookie.value = parado.id;

    const result = await resolveScreenSector(db, admin, {
      url: undefined,
      allowAll: true,
    });

    expect(result.kind).toBe("sector");
    if (result.kind === "sector") expect(result.sectorId).toBe(uld.id);
  });

  it("parâmetro repetido vale o primeiro", async () => {
    const camara = await insertSector(db, "Câmara Teste");
    const uld = await insertSector(db, "ULD Teste");

    const result = await resolveScreenSector(db, admin, {
      url: [uld.id, camara.id],
      allowAll: true,
    });

    expect(result.kind).toBe("sector");
    if (result.kind === "sector") expect(result.sectorId).toBe(uld.id);
  });
});

describe("resolveScreenSector — operador", () => {
  it("setor ativo: devolve o próprio, sem lista, sem seletor e sem ler o cookie", async () => {
    const uld = await insertSector(db, "ULD Teste");
    const outro = await insertSector(db, "Câmara Teste");
    mocks.cookie.value = outro.id;
    const ana = authzOf({ role: "operator", sectorId: uld.id });

    const result = await resolveScreenSector(db, ana, {
      url: undefined,
      allowAll: true,
    });

    expect(result).toEqual({
      kind: "sector",
      sectorId: uld.id,
      sectorName: "ULD Teste",
      sectorParam: null,
      sectors: [],
      cookie: undefined,
    });
    expect(mocks.reads.count).toBe(0);
  });

  it("?setor= de outro setor (ou todos) nunca vale: devolve o próprio", async () => {
    const uld = await insertSector(db, "ULD Teste");
    const outro = await insertSector(db, "Câmara Teste");
    const ana = authzOf({ role: "operator", sectorId: uld.id });

    for (const url of [outro.id, "todos"]) {
      const result = await resolveScreenSector(db, ana, {
        url,
        allowAll: true,
      });
      expect(result.kind).toBe("sector");
      if (result.kind === "sector") expect(result.sectorId).toBe(uld.id);
    }
  });

  it("setor inativo: inactive", async () => {
    const parado = await insertSector(db, "Setor Parado", { active: false });
    const ana = authzOf({ role: "operator", sectorId: parado.id });

    expect(
      await resolveScreenSector(db, ana, { url: undefined, allowAll: true }),
    ).toEqual({ kind: "inactive" });
  });

  it("setor que não existe: missing", async () => {
    const ana = authzOf({ role: "operator", sectorId: NIL_ID });

    expect(
      await resolveScreenSector(db, ana, { url: undefined, allowAll: false }),
    ).toEqual({ kind: "missing" });
  });

  it("operador sem setor (Authz montado no teste): missing", async () => {
    const semSetor: Authz = {
      userId: "user-sem-setor",
      name: "Cris Teste",
      email: "cris@example.test",
      role: "operator",
      sectorId: null,
    };

    expect(
      await resolveScreenSector(db, semSetor, {
        url: undefined,
        allowAll: false,
      }),
    ).toEqual({ kind: "missing" });
  });
});
