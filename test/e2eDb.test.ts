import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  countCorrections,
  countSessionsByEmail,
  handoverOf,
  userIdByEmail,
} from "../e2e/db";
import { createTestDb, resetDb, type TestDb } from "./db";
import {
  insertHandover,
  insertHandoverCorrection,
  insertSector,
  insertSession,
  insertShift,
  insertUser,
} from "./fixtures";

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

describe("countSessionsByEmail (helper do E2E)", () => {
  it("conta só as sessões da pessoa com aquele e-mail", async () => {
    const ana = await insertUser(db, {
      role: "admin",
      sectorId: null,
      email: "ana@example.test",
    });
    const davi = await insertUser(db, {
      role: "admin",
      sectorId: null,
      email: "davi@example.test",
    });
    await insertSession(db, { userId: ana.id });
    await insertSession(db, { userId: ana.id });
    await insertSession(db, { userId: davi.id });

    expect(await countSessionsByEmail(db, "ana@example.test")).toBe(2);
    expect(await countSessionsByEmail(db, "davi@example.test")).toBe(1);
  });

  it("zero quando a pessoa não tem sessão", async () => {
    await insertUser(db, {
      role: "admin",
      sectorId: null,
      email: "sem-sessao@example.test",
    });

    expect(await countSessionsByEmail(db, "sem-sessao@example.test")).toBe(0);
  });

  it("zero quando o e-mail não existe (nunca lança)", async () => {
    expect(await countSessionsByEmail(db, "ninguem@example.test")).toBe(0);
  });

  it("a caixa do e-mail conta: o e-mail é comparado como foi gravado", async () => {
    const ana = await insertUser(db, {
      role: "admin",
      sectorId: null,
      email: "ana@example.test",
    });
    await insertSession(db, { userId: ana.id });

    expect(await countSessionsByEmail(db, "ANA@example.test")).toBe(0);
  });
});

describe("helpers da passagem no E2E", () => {
  async function seed() {
    const sector = await insertSector(db, "Setor Teste");
    const shift = await insertShift(db, { sectorId: sector.id });
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      email: "ana@example.test",
    });
    const bia = await insertUser(db, { role: "operator", sectorId: sector.id });
    return { sector, shift, ana, bia };
  }

  it("userIdByEmail devolve o id e lança para e-mail desconhecido", async () => {
    const { ana } = await seed();
    expect(await userIdByEmail(db, "ana@example.test")).toBe(ana.id);
    await expect(userIdByEmail(db, "ninguem@example.test")).rejects.toThrow(
      "Pessoa ninguem@example.test não encontrada.",
    );
  });

  it("handoverOf acha a passagem pela tripla e devolve null quando não existe", async () => {
    const { sector, shift, ana, bia } = await seed();
    const ref = {
      sectorId: sector.id,
      shiftId: shift.id,
      operationalDate: "2026-11-20",
    };
    expect(await handoverOf(db, ref)).toBeNull();

    const created = await insertHandover(db, {
      sectorId: sector.id,
      shiftId: shift.id,
      operationalDate: "2026-11-20",
      status: "confirmed",
      deliveredBy: ana.id,
      confirmedBy: bia.id,
      nextShiftText: "Conferir o lacre",
    });
    expect(await handoverOf(db, ref)).toEqual({
      id: created.id,
      status: "confirmed",
      deliveredBy: ana.id,
      confirmedBy: bia.id,
      occurrencesText: "",
      nextShiftText: "Conferir o lacre",
    });
    expect(
      await handoverOf(db, { ...ref, operationalDate: "2026-11-19" }),
    ).toBeNull();
  });

  it("countCorrections conta só as correções daquela passagem", async () => {
    const { sector, shift, ana, bia } = await seed();
    const first = await insertHandover(db, {
      sectorId: sector.id,
      shiftId: shift.id,
      operationalDate: "2026-11-20",
      status: "confirmed",
      deliveredBy: ana.id,
      confirmedBy: bia.id,
    });
    const second = await insertHandover(db, {
      sectorId: sector.id,
      shiftId: shift.id,
      operationalDate: "2026-11-19",
      status: "confirmed",
      deliveredBy: ana.id,
      confirmedBy: bia.id,
    });
    await insertHandoverCorrection(db, {
      handoverId: first.id,
      field: "occurrences_text",
      correctedBy: bia.id,
    });
    await insertHandoverCorrection(db, {
      handoverId: first.id,
      field: "next_shift_text",
      correctedBy: bia.id,
    });

    expect(await countCorrections(db, first.id)).toBe(2);
    expect(await countCorrections(db, second.id)).toBe(0);
  });
});
