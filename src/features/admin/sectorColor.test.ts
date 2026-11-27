import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { sector } from "@/db/schema/sectors";
import type { SectorColor } from "@/features/sectors/colors";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertSector } from "../../../test/fixtures";
import { SECTOR_COLOR_INVALID_MESSAGE } from "./messages";
import {
  createSector,
  listActiveSectors,
  listSectors,
  renameSector,
  suggestColorForNewSector,
} from "./sectors";

const NOW = new Date("2026-11-27T12:00:00.000Z");
const INVALID = "red" as unknown as SectorColor;

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

async function colorOf(id: string): Promise<string | undefined> {
  const [row] = await db
    .select({ color: sector.color })
    .from(sector)
    .where(eq(sector.id, id));
  return row?.color;
}

describe("createSector com cor", () => {
  it("grava a cor escolhida", async () => {
    const result = await createSector(db, { name: "Pátio", color: "green" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await colorOf(result.id)).toBe("green");
  });

  it("cor fora da paleta volta INVALID_INPUT no campo color e não grava", async () => {
    expect(await createSector(db, { name: "Pátio", color: INVALID })).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      message: SECTOR_COLOR_INVALID_MESSAGE,
      fieldErrors: { color: SECTOR_COLOR_INVALID_MESSAGE },
    });
    expect(await db.select().from(sector)).toEqual([]);
  });

  it("cor repetida entre setores é permitida (a paleta só tem 5)", async () => {
    await createSector(db, { name: "Um", color: "sky" });

    expect((await createSector(db, { name: "Dois", color: "sky" })).ok).toBe(
      true,
    );
  });

  it("com nome vazio e cor inválida, o erro do nome vem primeiro e a cor não é gravada", async () => {
    const result = await createSector(db, { name: " ", color: INVALID });

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Informe o nome.",
    });
    expect(await db.select().from(sector)).toEqual([]);
  });
});

describe("renameSector com cor", () => {
  it("troca nome e cor juntos", async () => {
    const created = await insertSector(db, "Velho", { color: "lilac" });

    const result = await renameSector(db, {
      id: created.id,
      name: "Novo",
      color: "pink",
    });

    expect(result).toEqual({ ok: true });
    const [row] = await db
      .select()
      .from(sector)
      .where(eq(sector.id, created.id));
    expect(row).toMatchObject({ name: "Novo", color: "pink" });
  });

  it("troca só a cor (o nome fica igual e não colide com ele mesmo)", async () => {
    const created = await insertSector(db, "Pátio", { color: "lilac" });

    const result = await renameSector(db, {
      id: created.id,
      name: "Pátio",
      color: "sky",
    });

    expect(result).toEqual({ ok: true });
    expect(await colorOf(created.id)).toBe("sky");
  });

  it("cor fora da paleta volta INVALID_INPUT e não mexe no setor", async () => {
    const created = await insertSector(db, "Pátio", { color: "peach" });

    const result = await renameSector(db, {
      id: created.id,
      name: "Outro",
      color: INVALID,
    });

    expect(result).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      message: SECTOR_COLOR_INVALID_MESSAGE,
      fieldErrors: { color: SECTOR_COLOR_INVALID_MESSAGE },
    });
    const [row] = await db
      .select()
      .from(sector)
      .where(eq(sector.id, created.id));
    expect(row).toMatchObject({ name: "Pátio", color: "peach" });
  });

  it("nome repetido não troca a cor", async () => {
    await insertSector(db, "ULD", { color: "lilac" });
    const other = await insertSector(db, "Pátio", { color: "peach" });

    const result = await renameSector(db, {
      id: other.id,
      name: "uld",
      color: "pink",
    });

    expect(result).toMatchObject({ ok: false, code: "NAME_TAKEN" });
    expect(await colorOf(other.id)).toBe("peach");
  });

  it("id inexistente é NOT_FOUND", async () => {
    expect(
      await renameSector(db, {
        id: "00000000-0000-4000-8000-000000000000",
        name: "X",
        color: "sky",
      }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("a cor nas listas", () => {
  it("listSectors devolve a cor de cada setor", async () => {
    await insertSector(db, "Alfa", { color: "green" });
    await insertSector(db, "Bravo", { color: "pink", active: false });

    const page = await listSectors(db, { page: 1 }, NOW);

    expect(page.rows.map((row) => [row.name, row.color])).toEqual([
      ["Alfa", "green"],
      ["Bravo", "pink"],
    ]);
  });

  it("listActiveSectors devolve a cor e deixa os inativos de fora", async () => {
    const alfa = await insertSector(db, "Alfa", { color: "sky" });
    await insertSector(db, "Inativo", { color: "pink", active: false });

    expect(await listActiveSectors(db)).toEqual([
      { id: alfa.id, name: "Alfa", color: "sky" },
    ]);
  });
});

describe("suggestColorForNewSector", () => {
  it("nenhum setor: lilac", async () => {
    expect(await suggestColorForNewSector(db)).toBe("lilac");
  });

  it("devolve a primeira cor livre da paleta entre os setores ativos", async () => {
    await insertSector(db, "A", { color: "lilac" });
    expect(await suggestColorForNewSector(db)).toBe("peach");

    await insertSector(db, "B", { color: "sky" });
    expect(await suggestColorForNewSector(db)).toBe("peach");

    await insertSector(db, "C", { color: "peach" });
    expect(await suggestColorForNewSector(db)).toBe("green");
  });

  it("ignora os setores inativos (a cor deles volta a ficar livre)", async () => {
    await insertSector(db, "Ativo", { color: "peach" });
    await insertSector(db, "Parado", { color: "lilac", active: false });

    expect(await suggestColorForNewSector(db)).toBe("lilac");
  });

  it("todas em uso: a menos usada entre os ativos, empate pela ordem da paleta", async () => {
    const colors: SectorColor[] = ["lilac", "peach", "sky", "green", "pink"];
    for (const color of colors) {
      await insertSector(db, `Setor ${color}`, { color });
    }
    // Empate total: a primeira da paleta.
    expect(await suggestColorForNewSector(db)).toBe("lilac");

    await insertSector(db, "Mais um lilás", { color: "lilac" });
    await insertSector(db, "Mais um pêssego", { color: "peach" });
    // lilac e peach duas vezes; sky, green e pink uma: sky vem primeiro na paleta.
    expect(await suggestColorForNewSector(db)).toBe("sky");
  });

  it("todas em uso só porque há inativos: a cor livre ainda aparece", async () => {
    const colors: SectorColor[] = ["lilac", "peach", "sky", "green", "pink"];
    for (const color of colors) {
      await insertSector(db, `Setor ${color}`, {
        color,
        active: color !== "green",
      });
    }

    expect(await suggestColorForNewSector(db)).toBe("green");
  });
});
