import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { destination } from "@/db/schema/catalog";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertDestination } from "../../../test/fixtures";
import {
  createDestination,
  listDestinations,
  renameDestination,
  setDestinationActive,
} from "./destinations";
import { PAGE_SIZE } from "./pagination";

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

async function readDestination(id: string) {
  const [row] = await db
    .select()
    .from(destination)
    .where(eq(destination.id, id));
  if (!row) throw new Error("destino não encontrado");
  return row;
}

describe("createDestination", () => {
  it("cria o destino ativo e normaliza o nome", async () => {
    const result = await createDestination(db, {
      name: "  Almoxarifado   Central ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await readDestination(result.id)).toMatchObject({
      name: "Almoxarifado Central",
      active: true,
    });
  });

  it("recusa nome vazio e nome com 61 caracteres; aceita 60", async () => {
    expect(await createDestination(db, { name: "  " })).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      message: "Informe o nome.",
      fieldErrors: { name: "Informe o nome." },
    });
    expect(await createDestination(db, { name: "x".repeat(61) })).toMatchObject(
      {
        ok: false,
        code: "INVALID_INPUT",
        message: "O nome pode ter no máximo 60 caracteres.",
      },
    );
    expect((await createDestination(db, { name: "x".repeat(60) })).ok).toBe(
      true,
    );
  });

  it("recusa nome repetido sem diferença de caixa", async () => {
    await createDestination(db, { name: "Almoxarifado" });

    expect(await createDestination(db, { name: "ALMOXARIFADO" })).toEqual({
      ok: false,
      code: "NAME_TAKEN",
      message: "Já existe um destino com este nome.",
      fieldErrors: { name: "Já existe um destino com este nome." },
    });
  });

  it("avisa que o destino de mesmo nome está inativo", async () => {
    await insertDestination(db, { name: "Antigo", active: false });

    expect(await createDestination(db, { name: "antigo" })).toMatchObject({
      ok: false,
      code: "NAME_TAKEN",
      message:
        "Já existe um destino com este nome. Ele está inativo: reative-o na lista.",
    });
  });
});

describe("renameDestination", () => {
  it("renomeia, inclusive só a caixa do próprio nome", async () => {
    const created = await insertDestination(db, { name: "almoxarifado" });

    expect(
      await renameDestination(db, { id: created.id, name: "Almoxarifado" }),
    ).toEqual({ ok: true });
    expect((await readDestination(created.id)).name).toBe("Almoxarifado");
  });

  it("recusa o nome de outro destino e nome vazio", async () => {
    await insertDestination(db, { name: "Almoxarifado" });
    const other = await insertDestination(db, { name: "Oficina" });

    expect(
      await renameDestination(db, { id: other.id, name: "almoxarifado" }),
    ).toMatchObject({ ok: false, code: "NAME_TAKEN" });
    expect(
      await renameDestination(db, { id: other.id, name: "" }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect((await readDestination(other.id)).name).toBe("Oficina");
  });

  it("id inexistente é NOT_FOUND", async () => {
    expect(await renameDestination(db, { id: MISSING_ID, name: "X" })).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Destino não encontrado. Atualize a página.",
    });
  });
});

describe("setDestinationActive", () => {
  it("desativa e reativa", async () => {
    const created = await insertDestination(db, { name: "Oficina" });

    expect(
      await setDestinationActive(db, { id: created.id, active: false }),
    ).toEqual({ ok: true });
    expect((await readDestination(created.id)).active).toBe(false);

    expect(
      await setDestinationActive(db, { id: created.id, active: true }),
    ).toEqual({ ok: true });
    expect((await readDestination(created.id)).active).toBe(true);
  });

  it("repetir o mesmo estado é sucesso sem mudança", async () => {
    const created = await insertDestination(db, { name: "Oficina" });

    expect(
      await setDestinationActive(db, { id: created.id, active: true }),
    ).toEqual({ ok: true });
  });

  it("id inexistente é NOT_FOUND", async () => {
    expect(
      await setDestinationActive(db, { id: MISSING_ID, active: false }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("listDestinations", () => {
  it("lista vazia: nenhuma linha, uma página", async () => {
    expect(await listDestinations(db, { page: 1 })).toEqual({
      rows: [],
      total: 0,
      page: 1,
      pageCount: 1,
      pageSize: PAGE_SIZE,
    });
  });

  it("ordena ativos primeiro e depois por nome sem diferença de caixa", async () => {
    await insertDestination(db, { name: "bravo" });
    await insertDestination(db, { name: "Alfa" });
    await insertDestination(db, { name: "Zulu", active: false });

    const page = await listDestinations(db, { page: 1 });

    expect(page.rows.map((row) => [row.name, row.active])).toEqual([
      ["Alfa", true],
      ["bravo", true],
      ["Zulu", false],
    ]);
  });

  it("pagina de 50 em 50 e prende a página pedida no intervalo", async () => {
    for (let index = 0; index < PAGE_SIZE + 1; index++) {
      await insertDestination(db, {
        name: `Destino ${String(index).padStart(3, "0")}`,
      });
    }

    const first = await listDestinations(db, { page: 1 });
    expect(first).toMatchObject({ total: 51, page: 1, pageCount: 2 });
    expect(first.rows).toHaveLength(PAGE_SIZE);

    const beyond = await listDestinations(db, { page: 99 });
    expect(beyond).toMatchObject({ page: 2, pageCount: 2 });
    expect(beyond.rows.map((row) => row.name)).toEqual(["Destino 050"]);
  });
});
