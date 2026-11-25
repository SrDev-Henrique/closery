import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { CHOICE_LIST_LIMIT } from "@/features/admin/pagination";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  deactivateSector,
  insertItem,
  insertSector,
  insertShift,
} from "../../../test/fixtures";
import { listHistoryItems, listHistoryShifts } from "./historyChoices";

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
});

describe("listHistoryShifts", () => {
  async function world() {
    const uld = await insertSector(db, "ULD Teste");
    const other = await insertSector(db, "Câmara Teste");
    const manha = await insertShift(db, {
      sectorId: uld.id,
      name: "Manhã",
      startsAt: "06:00",
      endsAt: "14:00",
      sortOrder: 1,
    });
    const noite = await insertShift(db, {
      sectorId: uld.id,
      name: "Noite",
      startsAt: "22:00",
      endsAt: "06:00",
      sortOrder: 2,
    });
    const antigo = await insertShift(db, {
      sectorId: uld.id,
      name: "Turno Antigo",
      startsAt: "10:00",
      endsAt: "18:00",
      sortOrder: 0,
      active: false,
    });
    const dia = await insertShift(db, {
      sectorId: other.id,
      name: "Dia",
      startsAt: "07:00",
      endsAt: "19:00",
    });
    return { uld, other, manha, noite, antigo, dia };
  }

  it("sem turno escolhido: só os ativos, na ordem do setor, todos com active true", async () => {
    const w = await world();

    const result = await listHistoryShifts(db, w.uld.id, null);

    expect(result).toEqual([
      {
        id: w.manha.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
        active: true,
      },
      {
        id: w.noite.id,
        name: "Noite",
        startsAt: "22:00",
        endsAt: "06:00",
        active: true,
      },
    ]);
  });

  it("o turno inativo escolhido entra no fim com active false", async () => {
    const w = await world();

    const result = await listHistoryShifts(db, w.uld.id, w.antigo.id);

    expect(result.map((row) => [row.name, row.active])).toEqual([
      ["Manhã", true],
      ["Noite", true],
      ["Turno Antigo", false],
    ]);
    expect(result.at(-1)).toMatchObject({
      startsAt: "10:00",
      endsAt: "18:00",
    });
  });

  it("o turno ativo escolhido não duplica", async () => {
    const w = await world();

    const result = await listHistoryShifts(db, w.uld.id, w.manha.id);

    expect(result.map((row) => row.name)).toEqual(["Manhã", "Noite"]);
  });

  it("turno de outro setor e turno inexistente não entram", async () => {
    const w = await world();
    const inactiveOther = await insertShift(db, {
      sectorId: w.other.id,
      name: "Antigo da Câmara",
      active: false,
    });

    for (const selected of [w.dia.id, inactiveOther.id, NIL_ID]) {
      const result = await listHistoryShifts(db, w.uld.id, selected);
      expect(result.map((row) => row.name)).toEqual(["Manhã", "Noite"]);
    }
  });

  it("setor inativo: nenhuma escolha, nem o turno escolhido", async () => {
    const w = await world();
    await deactivateSector(db, w.uld.id);

    expect(await listHistoryShifts(db, w.uld.id, null)).toEqual([]);
    expect(await listHistoryShifts(db, w.uld.id, w.antigo.id)).toEqual([]);
  });

  it("setor inexistente: vazio, sem erro", async () => {
    await world();

    expect(await listHistoryShifts(db, NIL_ID, null)).toEqual([]);
  });
});

describe("listHistoryItems", () => {
  async function world() {
    const uld = await insertSector(db, "ULD Teste");
    const other = await insertSector(db, "Câmara Teste");
    const rede = await insertItem(db, {
      sectorId: uld.id,
      name: "Rede de proteção",
      unit: "rede",
      kind: "control",
      sortOrder: 1,
    });
    const stretch = await insertItem(db, {
      sectorId: uld.id,
      name: "Stretch",
      unit: "rolo",
      kind: "stock",
      sortOrder: 2,
    });
    const antiga = await insertItem(db, {
      sectorId: uld.id,
      name: "Cinta antiga",
      unit: "peça",
      kind: "control",
      sortOrder: 3,
      active: false,
    });
    const lacre = await insertItem(db, {
      sectorId: other.id,
      name: "Lacre",
      unit: "unidade",
    });
    return { uld, other, rede, stretch, antiga, lacre };
  }

  it("sem item escolhido: os ativos (controle e estoque) na ordem do setor, com active true", async () => {
    const w = await world();

    const result = await listHistoryItems(db, w.uld.id, null);

    expect(result).toEqual([
      { id: w.rede.id, name: "Rede de proteção", unit: "rede", active: true },
      { id: w.stretch.id, name: "Stretch", unit: "rolo", active: true },
    ]);
  });

  it("o item inativo escolhido entra no fim com active false", async () => {
    const w = await world();

    const result = await listHistoryItems(db, w.uld.id, w.antiga.id);

    expect(result.map((row) => [row.name, row.active])).toEqual([
      ["Rede de proteção", true],
      ["Stretch", true],
      ["Cinta antiga", false],
    ]);
    expect(result.at(-1)).toMatchObject({ unit: "peça" });
  });

  it("o item ativo escolhido não duplica", async () => {
    const w = await world();

    const result = await listHistoryItems(db, w.uld.id, w.stretch.id);

    expect(result.map((row) => row.name)).toEqual([
      "Rede de proteção",
      "Stretch",
    ]);
  });

  it("item de outro setor e item inexistente não entram", async () => {
    const w = await world();

    for (const selected of [w.lacre.id, NIL_ID]) {
      const result = await listHistoryItems(db, w.uld.id, selected);
      expect(result.map((row) => row.name)).toEqual([
        "Rede de proteção",
        "Stretch",
      ]);
    }
  });

  it("setor inativo: nenhuma escolha, nem o item escolhido", async () => {
    const w = await world();
    await deactivateSector(db, w.uld.id);

    expect(await listHistoryItems(db, w.uld.id, null)).toEqual([]);
    expect(await listHistoryItems(db, w.uld.id, w.antiga.id)).toEqual([]);
  });

  it("setor sem itens: vazio", async () => {
    const empty = await insertSector(db, "Setor Vazio");

    expect(await listHistoryItems(db, empty.id, null)).toEqual([]);
  });

  it("teto de CHOICE_LIST_LIMIT; o item escolhido além do teto entra no fim", async () => {
    const sector = await insertSector(db, "Setor Cheio");
    const ids: string[] = [];
    for (let index = 0; index <= CHOICE_LIST_LIMIT; index++) {
      const created = await insertItem(db, {
        sectorId: sector.id,
        name: `Item ${String(index).padStart(3, "0")}`,
        sortOrder: index + 1,
      });
      ids.push(created.id);
    }
    const lastId = ids[CHOICE_LIST_LIMIT] ?? "";

    const capped = await listHistoryItems(db, sector.id, null);
    expect(capped).toHaveLength(CHOICE_LIST_LIMIT);
    expect(capped.some((row) => row.id === lastId)).toBe(false);

    const selected = await listHistoryItems(db, sector.id, lastId);
    expect(selected).toHaveLength(CHOICE_LIST_LIMIT + 1);
    expect(selected.at(-1)).toMatchObject({ id: lastId, active: true });
  }, 60_000);
});
