import type { PGlite } from "@electric-sql/pglite";
import { count } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { handover } from "@/db/schema/handovers";

import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertSector,
  insertShift,
} from "../../../test/fixtures";
import { creationRefusal, ensureHandover } from "./ensureHandover";

const NIL_ID = "00000000-0000-4000-8000-000000000000";
const NOW = spDate("2026-11-21", "14:05");

describe("ensureHandover", () => {
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

  async function rowCount(): Promise<number> {
    const [row] = await db.select({ total: count() }).from(handover);
    return row?.total ?? 0;
  }

  async function setup() {
    const sector = await insertSector(db, "ULD");
    const turno = await insertShift(db, { sectorId: sector.id });
    const operator = authzOf({ role: "operator", sectorId: sector.id });
    const ref = {
      sectorId: sector.id,
      shiftId: turno.id,
      operationalDate: "2026-11-21",
    };
    return { sector, turno, operator, ref };
  }

  it("cria o rascunho na primeira vez (created: true) e reaproveita na segunda (created: false)", async () => {
    const { operator, ref } = await setup();

    const first = await db.transaction((tx) =>
      ensureHandover(tx, operator, ref, NOW),
    );
    expect(first).toMatchObject({
      ok: true,
      created: true,
      row: { status: "draft", operationalDate: "2026-11-21" },
    });
    const second = await db.transaction((tx) =>
      ensureHandover(tx, operator, ref, NOW),
    );
    expect(second).toMatchObject({ ok: true, created: false });
    expect(await rowCount()).toBe(1);
    if (first.ok && second.ok) expect(second.row.id).toBe(first.row.id);
  });

  it("operador de outro setor e setor inexistente: NOT_FOUND, nada criado", async () => {
    const { ref } = await setup();
    const stranger = authzOf({
      role: "operator",
      sectorId: "00000000-0000-4000-8000-0000000000b2",
    });

    for (const actor of [stranger, authzOf({ role: "admin" })]) {
      const result = await db.transaction((tx) =>
        ensureHandover(tx, actor, { ...ref, sectorId: NIL_ID }, NOW),
      );
      expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    }
    const denied = await db.transaction((tx) =>
      ensureHandover(tx, stranger, ref, NOW),
    );
    expect(denied).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
      message: "Setor não encontrado. Atualize a página.",
    });
    expect(await rowCount()).toBe(0);
  });

  it("setor inativo ao criar: SECTOR_INACTIVE", async () => {
    const sector = await insertSector(db, "Antigo", { active: false });
    const turno = await insertShift(db, { sectorId: sector.id });

    const result = await db.transaction((tx) =>
      ensureHandover(
        tx,
        authzOf({ role: "admin" }),
        {
          sectorId: sector.id,
          shiftId: turno.id,
          operationalDate: "2026-11-21",
        },
        NOW,
      ),
    );
    expect(result).toMatchObject({
      ok: false,
      code: "SECTOR_INACTIVE",
      message:
        "Este setor está inativo. Peça a um administrador para reativá-lo.",
    });
  });

  it("turno de outro setor ou inexistente: NOT_FOUND com a mensagem do turno", async () => {
    const { operator, ref } = await setup();
    const other = await insertSector(db, "Outro");
    const foreignShift = await insertShift(db, { sectorId: other.id });

    for (const shiftId of [foreignShift.id, NIL_ID]) {
      const result = await db.transaction((tx) =>
        ensureHandover(tx, operator, { ...ref, shiftId }, NOW),
      );
      expect(result).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
        message: "Turno não encontrado. Atualize a página.",
      });
    }
  });

  it("turno inativo ao criar: SHIFT_INACTIVE; com a linha já existente, continua valendo", async () => {
    const { sector, operator, ref } = await setup();
    const inactive = await insertShift(db, {
      sectorId: sector.id,
      active: false,
    });
    const inactiveRef = { ...ref, shiftId: inactive.id };

    const refused = await db.transaction((tx) =>
      ensureHandover(tx, operator, inactiveRef, NOW),
    );
    expect(refused).toMatchObject({
      ok: false,
      code: "SHIFT_INACTIVE",
      message: "Este turno está inativo. Escolha outro turno.",
    });

    await insertHandover(db, {
      sectorId: sector.id,
      shiftId: inactive.id,
      operationalDate: "2026-11-21",
    });
    const existing = await db.transaction((tx) =>
      ensureHandover(tx, operator, inactiveRef, NOW),
    );
    expect(existing).toMatchObject({ ok: true, created: false });
  });

  it("data: hoje e 31 dias atrás passam; amanhã, 32 dias atrás e lixo viram DATE_OUT_OF_RANGE", async () => {
    const { operator, ref } = await setup();

    for (const operationalDate of ["2026-11-21", "2026-10-21"]) {
      const result = await db.transaction((tx) =>
        ensureHandover(tx, operator, { ...ref, operationalDate }, NOW),
      );
      expect(result).toMatchObject({ ok: true, created: true });
    }
    for (const operationalDate of [
      "2026-11-22",
      "2026-10-20",
      "2026-02-30",
      "ontem",
    ]) {
      const result = await db.transaction((tx) =>
        ensureHandover(tx, operator, { ...ref, operationalDate }, NOW),
      );
      expect(result).toMatchObject({
        ok: false,
        code: "DATE_OUT_OF_RANGE",
        message: "Escolha uma data de hoje ou dos últimos 31 dias.",
      });
    }
    expect(await rowCount()).toBe(2);
  });

  it("rascunho antigo (mais de 31 dias) que já existe continua acessível", async () => {
    const { sector, turno, operator } = await setup();
    await insertHandover(db, {
      sectorId: sector.id,
      shiftId: turno.id,
      operationalDate: "2026-09-01",
    });

    const result = await db.transaction((tx) =>
      ensureHandover(
        tx,
        operator,
        {
          sectorId: sector.id,
          shiftId: turno.id,
          operationalDate: "2026-09-01",
        },
        NOW,
      ),
    );
    expect(result).toMatchObject({ ok: true, created: false });
  });
});

describe("creationRefusal", () => {
  const ref = {
    sectorId: NIL_ID,
    shiftId: NIL_ID,
    operationalDate: "2026-11-21",
  };

  it("turno que não existe no setor: NOT_FOUND com a mensagem do turno", () => {
    expect(creationRefusal(null, ref, NOW)).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Turno não encontrado. Atualize a página.",
    });
  });

  it("turno inativo: SHIFT_INACTIVE, antes de olhar a data", () => {
    expect(
      creationRefusal(
        { active: false },
        { ...ref, operationalDate: "2026-02-30" },
        NOW,
      ),
    ).toEqual({
      ok: false,
      code: "SHIFT_INACTIVE",
      message: "Este turno está inativo. Escolha outro turno.",
    });
  });

  it("data fora da janela: DATE_OUT_OF_RANGE (amanhã e 32 dias atrás)", () => {
    for (const operationalDate of ["2026-11-22", "2026-10-20"]) {
      expect(
        creationRefusal({ active: true }, { ...ref, operationalDate }, NOW),
      ).toEqual({
        ok: false,
        code: "DATE_OUT_OF_RANGE",
        message: "Escolha uma data de hoje ou dos últimos 31 dias.",
      });
    }
  });

  it("turno ativo e data dentro da janela (hoje e 31 dias atrás): null", () => {
    for (const operationalDate of ["2026-11-21", "2026-10-21"]) {
      expect(
        creationRefusal({ active: true }, { ...ref, operationalDate }, NOW),
      ).toBeNull();
    }
  });
});
