import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CHOICE_LIST_LIMIT } from "@/features/admin/pagination";
import { authzOf } from "../../../test/authz";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertDestination,
  insertItem,
  insertRequest,
  insertSector,
  insertUser,
} from "../../../test/fixtures";
import {
  getRequestFormChoices,
  listActiveDestinations,
  listFilterDestinations,
  listRequestCreators,
  listRequestStockItems,
  mostUsedDestinations,
} from "./choices";

const DAY = 86_400_000;
const BASE = new Date("2026-11-20T12:00:00Z");
const at = (days: number) => new Date(BASE.getTime() + days * DAY);

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

describe("destinos", () => {
  it("listActiveDestinations: só os ativos, por nome sem diferença de caixa", async () => {
    await insertDestination(db, { name: "doca 9" });
    await insertDestination(db, { name: "Balcão", active: false });
    await insertDestination(db, { name: "Almoxarifado 1" });
    await insertDestination(db, { name: "Doca 3" });

    const result = await listActiveDestinations(db);

    expect(result.map((row) => row.name)).toEqual([
      "Almoxarifado 1",
      "Doca 3",
      "doca 9",
    ]);
  });

  it("listActiveDestinations: vazio sem destinos", async () => {
    expect(await listActiveDestinations(db)).toEqual([]);
  });

  it("listFilterDestinations: todos, os ativos primeiro, e o estado de cada um", async () => {
    await insertDestination(db, { name: "Balcão", active: false });
    await insertDestination(db, { name: "Doca 3" });
    await insertDestination(db, { name: "Almoxarifado 1" });

    const result = await listFilterDestinations(db);

    expect(result.map((row) => [row.name, row.active])).toEqual([
      ["Almoxarifado 1", true],
      ["Doca 3", true],
      ["Balcão", false],
    ]);
  });

  it("as duas listas têm teto de CHOICE_LIST_LIMIT", async () => {
    for (let i = 0; i < CHOICE_LIST_LIMIT + 3; i++) {
      await insertDestination(db, {
        name: `Destino ${String(i).padStart(4, "0")}`,
      });
    }

    expect(await listActiveDestinations(db)).toHaveLength(CHOICE_LIST_LIMIT);
    expect(await listFilterDestinations(db)).toHaveLength(CHOICE_LIST_LIMIT);
  });
});

describe("listRequestStockItems", () => {
  it("só estoque ativo do setor (controle, inativo e outro setor ficam fora), na ordem do setor", async () => {
    const sector = await insertSector(db);
    const other = await insertSector(db);
    await insertItem(db, {
      sectorId: sector.id,
      name: "Fita",
      unit: "rolo",
      kind: "stock",
      sortOrder: 2,
    });
    await insertItem(db, {
      sectorId: sector.id,
      name: "Luva",
      unit: "par",
      kind: "stock",
      sortOrder: 1,
    });
    await insertItem(db, {
      sectorId: sector.id,
      name: "Contagem",
      kind: "control",
    });
    await insertItem(db, {
      sectorId: sector.id,
      name: "Velho",
      kind: "stock",
      active: false,
    });
    await insertItem(db, { sectorId: other.id, name: "Alheio", kind: "stock" });

    const result = await listRequestStockItems(db, [sector.id, other.id]);

    expect(result.get(sector.id)?.map((row) => [row.name, row.unit])).toEqual([
      ["Luva", "par"],
      ["Fita", "rolo"],
    ]);
    expect(result.get(other.id)?.map((row) => row.name)).toEqual(["Alheio"]);
  });

  it("sem setores devolve um mapa vazio; setor sem estoque não entra", async () => {
    const sector = await insertSector(db);

    expect((await listRequestStockItems(db, [])).size).toBe(0);
    expect((await listRequestStockItems(db, [sector.id])).size).toBe(0);
  });

  it("até 200 por setor, mesmo com mais itens cadastrados", async () => {
    const sector = await insertSector(db);
    const other = await insertSector(db);
    for (let i = 0; i < 203; i++) {
      await insertItem(db, {
        sectorId: sector.id,
        name: `Item ${i}`,
        kind: "stock",
      });
    }
    await insertItem(db, { sectorId: other.id, name: "Único", kind: "stock" });

    const result = await listRequestStockItems(db, [sector.id, other.id]);

    expect(result.get(sector.id)).toHaveLength(200);
    expect(result.get(sector.id)?.[0]?.name).toBe("Item 0");
    expect(result.get(other.id)).toHaveLength(1);
  });
});

describe("mostUsedDestinations", () => {
  it("o destino ativo mais usado pelo setor", async () => {
    const sector = await insertSector(db);
    const author = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
    });
    const doca = await insertDestination(db, { name: "Doca 3" });
    const balcao = await insertDestination(db, { name: "Balcão" });
    for (const destinationId of [doca.id, balcao.id, balcao.id]) {
      await insertRequest(db, {
        sectorId: sector.id,
        createdBy: author.id,
        destinationId,
      });
    }

    const result = await mostUsedDestinations(db, [sector.id]);

    expect(result.get(sector.id)).toBe(balcao.id);
  });

  it("empate: o uso mais recente; depois o menor id", async () => {
    const sector = await insertSector(db);
    const author = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
    });
    const older = await insertDestination(db, { name: "Antigo" });
    const newer = await insertDestination(db, { name: "Recente" });
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: author.id,
      destinationId: older.id,
      createdAt: at(0),
    });
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: author.id,
      destinationId: newer.id,
      createdAt: at(1),
    });

    expect((await mostUsedDestinations(db, [sector.id])).get(sector.id)).toBe(
      newer.id,
    );

    // Mesmo instante: desempata pelo id.
    await resetDb(client);
    const sector2 = await insertSector(db);
    const author2 = await insertUser(db, {
      role: "operator",
      sectorId: sector2.id,
    });
    const a = await insertDestination(db, { name: "A" });
    const b = await insertDestination(db, { name: "B" });
    for (const destinationId of [a.id, b.id]) {
      await insertRequest(db, {
        sectorId: sector2.id,
        createdBy: author2.id,
        destinationId,
        createdAt: at(0),
      });
    }

    expect((await mostUsedDestinations(db, [sector2.id])).get(sector2.id)).toBe(
      [a.id, b.id].sort()[0],
    );
  });

  it("destino inativo nunca é o padrão, mesmo o mais usado; 'Outro' não conta", async () => {
    const sector = await insertSector(db);
    const author = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
    });
    const gone = await insertDestination(db, {
      name: "Desativado",
      active: false,
    });
    const live = await insertDestination(db, { name: "Ativo" });
    for (const destinationId of [gone.id, gone.id, gone.id, live.id]) {
      await insertRequest(db, {
        sectorId: sector.id,
        createdBy: author.id,
        destinationId,
      });
    }
    for (let i = 0; i < 5; i++) {
      await insertRequest(db, {
        sectorId: sector.id,
        createdBy: author.id,
        destinationOther: "Fora da lista",
      });
    }

    expect((await mostUsedDestinations(db, [sector.id])).get(sector.id)).toBe(
      live.id,
    );
  });

  it("cada setor tem o seu; setor sem histórico não entra; sem ids, mapa vazio", async () => {
    const one = await insertSector(db);
    const two = await insertSector(db);
    const author = await insertUser(db, { role: "operator", sectorId: one.id });
    const doca = await insertDestination(db, { name: "Doca 3" });
    await insertRequest(db, {
      sectorId: one.id,
      createdBy: author.id,
      destinationId: doca.id,
    });

    const result = await mostUsedDestinations(db, [one.id, two.id]);

    expect(result.get(one.id)).toBe(doca.id);
    expect(result.has(two.id)).toBe(false);
    expect((await mostUsedDestinations(db, [])).size).toBe(0);
  });
});

describe("getRequestFormChoices", () => {
  it("sem setores: só os destinos ativos", async () => {
    const doca = await insertDestination(db, { name: "Doca 3" });
    await insertDestination(db, { name: "Inativo", active: false });

    const result = await getRequestFormChoices(db, []);

    expect(result).toEqual({
      destinations: [{ id: doca.id, name: "Doca 3" }],
      bySector: {},
    });
  });

  it("por setor: itens de estoque e o destino padrão (o mais usado)", async () => {
    const sector = await insertSector(db);
    const author = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
    });
    const first = await insertDestination(db, { name: "Almoxarifado 1" });
    const used = await insertDestination(db, { name: "Doca 3" });
    const luva = await insertItem(db, {
      sectorId: sector.id,
      name: "Luva",
      unit: "par",
      kind: "stock",
    });
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: author.id,
      destinationId: used.id,
    });

    const result = await getRequestFormChoices(db, [sector.id]);

    expect(result.destinations.map((row) => row.id)).toEqual([
      first.id,
      used.id,
    ]);
    expect(result.bySector[sector.id]).toEqual({
      stockItems: [{ id: luva.id, name: "Luva", unit: "par" }],
      defaultDestinationId: used.id,
    });
  });

  it("sem histórico: o primeiro destino ativo; sem destinos ativos: null (Outro)", async () => {
    const sector = await insertSector(db);
    const first = await insertDestination(db, { name: "Almoxarifado 1" });
    await insertDestination(db, { name: "Doca 3" });

    const withDestinations = await getRequestFormChoices(db, [sector.id]);
    expect(withDestinations.bySector[sector.id]).toEqual({
      stockItems: [],
      defaultDestinationId: first.id,
    });

    await resetDb(client);
    const lonely = await insertSector(db);
    await insertDestination(db, { name: "Só inativo", active: false });
    const without = await getRequestFormChoices(db, [lonely.id]);
    expect(without.destinations).toEqual([]);
    expect(without.bySector[lonely.id]).toEqual({
      stockItems: [],
      defaultDestinationId: null,
    });
  });

  it("vários setores (admin em 'Todos'): uma entrada por setor", async () => {
    const one = await insertSector(db);
    const two = await insertSector(db);
    await insertItem(db, { sectorId: one.id, name: "Luva", kind: "stock" });
    await insertItem(db, { sectorId: two.id, name: "Fita", kind: "stock" });

    const result = await getRequestFormChoices(db, [one.id, two.id]);

    expect(Object.keys(result.bySector).sort()).toEqual(
      [one.id, two.id].sort(),
    );
    expect(result.bySector[one.id]?.stockItems.map((row) => row.name)).toEqual([
      "Luva",
    ]);
    expect(result.bySector[two.id]?.stockItems.map((row) => row.name)).toEqual([
      "Fita",
    ]);
  });
});

describe("listRequestCreators", () => {
  it("quem criou no escopo, uma vez cada, por nome; sem vazar outro setor", async () => {
    const sector = await insertSector(db);
    const other = await insertSector(db);
    const bia = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      name: "Bia Teste",
    });
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      name: "ana Teste",
    });
    const carlos = await insertUser(db, {
      role: "operator",
      sectorId: other.id,
      name: "Carlos Teste",
    });
    await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      name: "Dani Teste",
    });
    for (const createdBy of [bia.id, ana.id, bia.id]) {
      await insertRequest(db, { sectorId: sector.id, createdBy });
    }
    await insertRequest(db, { sectorId: other.id, createdBy: carlos.id });

    const operator = authzOf({
      role: "operator",
      userId: bia.id,
      sectorId: sector.id,
    });
    const result = await listRequestCreators(db, operator, other.id);

    expect(result).toEqual([
      { id: ana.id, name: "ana Teste" },
      { id: bia.id, name: "Bia Teste" },
    ]);
  });

  it("admin: todos os setores ou só o escolhido; setor inativo fica de fora; vazio sem solicitações", async () => {
    const sector = await insertSector(db);
    const other = await insertSector(db);
    const inactive = await insertSector(db, "Inativo", { active: false });
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      name: "Ana Teste",
    });
    const carlos = await insertUser(db, {
      role: "operator",
      sectorId: other.id,
      name: "Carlos Teste",
    });
    const gone = await insertUser(db, {
      role: "operator",
      sectorId: inactive.id,
      name: "Zé Teste",
    });
    const admin = authzOf({ role: "admin" });

    expect(await listRequestCreators(db, admin, null)).toEqual([]);

    await insertRequest(db, { sectorId: sector.id, createdBy: ana.id });
    await insertRequest(db, { sectorId: other.id, createdBy: carlos.id });
    await insertRequest(db, { sectorId: inactive.id, createdBy: gone.id });

    expect(
      (await listRequestCreators(db, admin, null)).map((p) => p.name),
    ).toEqual(["Ana Teste", "Carlos Teste"]);
    expect(
      (await listRequestCreators(db, admin, other.id)).map((p) => p.name),
    ).toEqual(["Carlos Teste"]);
  });
});
