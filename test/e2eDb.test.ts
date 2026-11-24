import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  commentsOf,
  countCorrections,
  countRequestEvents,
  countSessionsByEmail,
  handoverOf,
  requestByDescription,
  requestOf,
  userIdByEmail,
} from "../e2e/db";
import { createTestDb, resetDb, type TestDb } from "./db";
import {
  insertHandover,
  insertHandoverCorrection,
  insertRequest,
  insertRequestComment,
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

describe("helpers das solicitações no E2E", () => {
  async function seed() {
    const sector = await insertSector(db, "Setor Teste");
    const other = await insertSector(db, "Outro Setor");
    const ana = await insertUser(db, { role: "operator", sectorId: sector.id });
    const bia = await insertUser(db, { role: "operator", sectorId: sector.id });
    const caio = await insertUser(db, { role: "operator", sectorId: other.id });
    return { sector, other, ana, bia, caio };
  }

  it("requestOf devolve a solicitação e null quando não existe", async () => {
    const { sector, ana } = await seed();
    expect(
      await requestOf(db, "00000000-0000-4000-8000-000000000000"),
    ).toBeNull();

    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Rede para a doca",
      status: "in_transit",
    });
    expect(await requestOf(db, created.id)).toEqual({
      id: created.id,
      status: "in_transit",
      sectorId: sector.id,
      originHandoverId: null,
      description: "Rede para a doca",
    });
  });

  it("requestOf mostra a passagem de origem", async () => {
    const { sector, ana } = await seed();
    const shift = await insertShift(db, { sectorId: sector.id });
    const origin = await insertHandover(db, {
      sectorId: sector.id,
      shiftId: shift.id,
    });
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      originHandoverId: origin.id,
    });
    expect((await requestOf(db, created.id))?.originHandoverId).toBe(origin.id);
  });

  it("requestByDescription acha a mais recente com o texto exato, nunca outra", async () => {
    const { sector, other, ana, caio } = await seed();
    expect(await requestByDescription(db, "Rede única")).toBeNull();

    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Rede única",
      createdAt: new Date("2026-11-19T12:00:00Z"),
    });
    const newest = await insertRequest(db, {
      sectorId: other.id,
      createdBy: caio.id,
      description: "Rede única",
      status: "delivered",
      createdAt: new Date("2026-11-20T12:00:00Z"),
    });
    await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      description: "Rede única e mais",
      createdAt: new Date("2026-11-21T12:00:00Z"),
    });

    expect(await requestByDescription(db, "Rede única")).toEqual({
      id: newest.id,
      status: "delivered",
      originHandoverId: null,
    });
    expect(await requestByDescription(db, "rede única")).toBeNull();
  });

  it("countRequestEvents conta só os eventos daquela solicitação", async () => {
    const { sector, ana, bia } = await seed();
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
    });
    const moved = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      status: "delivered",
      statusChangedBy: bia.id,
    });
    const bare = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      events: false,
    });

    expect(await countRequestEvents(db, created.id)).toBe(1);
    expect(await countRequestEvents(db, moved.id)).toBe(2);
    expect(await countRequestEvents(db, bare.id)).toBe(0);
  });

  it("commentsOf lista do mais antigo ao mais novo, com apagado e motivo marcados", async () => {
    const { sector, ana, bia } = await seed();
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      status: "cancelled",
      statusChangedBy: bia.id,
      cancelReason: "Pedido duplicado",
      statusChangedAt: new Date("2026-11-20T12:00:00Z"),
    });
    const empty = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
    });
    await insertRequestComment(db, {
      requestId: created.id,
      authorId: ana.id,
      body: "Depois",
      createdAt: new Date("2026-11-20T14:00:00Z"),
    });
    await insertRequestComment(db, {
      requestId: created.id,
      authorId: bia.id,
      body: "Apagado",
      createdAt: new Date("2026-11-20T13:00:00Z"),
      deletedAt: new Date("2026-11-20T13:30:00Z"),
    });

    expect(await commentsOf(db, created.id)).toEqual([
      { body: "Pedido duplicado", deleted: false, isReason: true },
      { body: "Apagado", deleted: true, isReason: false },
      { body: "Depois", deleted: false, isReason: false },
    ]);
    expect(await commentsOf(db, empty.id)).toEqual([]);
  });
});
