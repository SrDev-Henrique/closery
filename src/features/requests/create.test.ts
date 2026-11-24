import type { PGlite } from "@electric-sql/pglite";
import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { handover } from "@/db/schema/handovers";
import { request, requestItem, requestStatusEvent } from "@/db/schema/requests";

import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertDestination,
  insertHandover,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { createRequest } from "./create";
import type { CreateRequestInput } from "./schemas";

const NOW = spDate("2026-11-21", "14:05");
const TODAY = "2026-11-21";
const NIL_ID = "00000000-0000-4000-8000-000000000000";

describe("createRequest", () => {
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

  async function setup() {
    const uld = await insertSector(db, "ULD");
    const outro = await insertSector(db, "Rede de proteção");
    const turno = await insertShift(db, { sectorId: uld.id });
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: uld.id,
      name: "Ana Teste",
    });
    const bia = await insertUser(db, {
      role: "operator",
      sectorId: outro.id,
      name: "Bia Teste",
    });
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const doca = await insertDestination(db, { name: "Doca 3" });
    const fita = await insertItem(db, {
      sectorId: uld.id,
      name: "Fita adesiva",
      unit: "rolo",
      kind: "stock",
    });
    const lacre = await insertItem(db, {
      sectorId: uld.id,
      name: "Lacre numerado",
      unit: "caixa",
      kind: "stock",
    });
    const anaAuthz = authzOf({
      role: "operator",
      userId: ana.id,
      sectorId: uld.id,
      name: "Ana Teste",
    });
    const input = (
      overrides: Partial<CreateRequestInput> = {},
    ): CreateRequestInput => ({
      sectorId: uld.id,
      destination: { kind: "list", destinationId: doca.id },
      description: "Repor fita para o turno da noite",
      items: [],
      originRef: null,
      ...overrides,
    });
    const ref = {
      sectorId: uld.id,
      shiftId: turno.id,
      operationalDate: TODAY,
    };
    return {
      uld,
      outro,
      turno,
      ana,
      bia,
      admin,
      doca,
      fita,
      lacre,
      anaAuthz,
      adminAuthz: authzOf({ role: "admin", userId: admin.id }),
      biaAuthz: authzOf({
        role: "operator",
        userId: bia.id,
        sectorId: outro.id,
      }),
      input,
      ref,
    };
  }

  const countOf = async (table: typeof request | typeof requestStatusEvent) =>
    (await db.select({ n: count() }).from(table))[0]?.n ?? 0;
  const handoverCount = async () =>
    (await db.select({ n: count() }).from(handover))[0]?.n ?? 0;

  describe("criação", () => {
    it("grava a solicitação, os itens com nome e unidade da época e o evento de criação", async () => {
      const { anaAuthz, ana, uld, doca, fita, lacre, input } = await setup();

      const result = await createRequest(
        db,
        anaAuthz,
        input({
          items: [
            { itemId: fita.id, quantity: 12 },
            { itemId: lacre.id, quantity: 99_999 },
          ],
        }),
        NOW,
      );

      expect(result).toMatchObject({ ok: true });
      if (!result.ok) return;
      const [row] = await db
        .select()
        .from(request)
        .where(eq(request.id, result.id));
      expect(row).toMatchObject({
        sectorId: uld.id,
        destinationId: doca.id,
        destinationOther: null,
        description: "Repor fita para o turno da noite",
        status: "requested",
        createdBy: ana.id,
        createdAt: NOW,
        statusChangedAt: NOW,
        originHandoverId: null,
      });
      const items = await db
        .select()
        .from(requestItem)
        .where(eq(requestItem.requestId, result.id));
      expect(items).toHaveLength(2);
      expect(items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            itemId: fita.id,
            itemNameSnapshot: "Fita adesiva",
            itemUnitSnapshot: "rolo",
            quantity: 12,
          }),
          expect.objectContaining({
            itemId: lacre.id,
            itemNameSnapshot: "Lacre numerado",
            itemUnitSnapshot: "caixa",
            quantity: 99_999,
          }),
        ]),
      );
      const events = await db.select().from(requestStatusEvent);
      expect(events).toMatchObject([
        {
          requestId: result.id,
          fromStatus: null,
          toStatus: "requested",
          changedBy: ana.id,
          changedAt: NOW,
        },
      ]);
    });

    it("destino 'Outro' sem itens", async () => {
      const { anaAuthz, input } = await setup();

      const result = await createRequest(
        db,
        anaAuthz,
        input({ destination: { kind: "other", text: "Hangar 7" } }),
        NOW,
      );

      expect(result).toMatchObject({ ok: true });
      const [row] = await db.select().from(request);
      expect(row).toMatchObject({
        destinationId: null,
        destinationOther: "Hangar 7",
      });
      expect(await db.select().from(requestItem)).toEqual([]);
    });

    it("admin cria em qualquer setor ativo", async () => {
      const { adminAuthz, admin, outro, input } = await setup();

      const result = await createRequest(
        db,
        adminAuthz,
        input({ sectorId: outro.id }),
        NOW,
      );

      expect(result).toMatchObject({ ok: true });
      const [row] = await db.select().from(request);
      expect(row).toMatchObject({ sectorId: outro.id, createdBy: admin.id });
    });
  });

  describe("escopo e setor", () => {
    it("operador de outro setor: NOT_FOUND e nada gravado", async () => {
      const { biaAuthz, input } = await setup();

      const result = await createRequest(db, biaAuthz, input(), NOW);

      expect(result).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
        message: "Setor não encontrado. Atualize a página.",
      });
      expect(await countOf(request)).toBe(0);
      expect(await countOf(requestStatusEvent)).toBe(0);
    });

    it("setor inexistente: NOT_FOUND", async () => {
      const { adminAuthz, input } = await setup();

      const result = await createRequest(
        db,
        adminAuthz,
        input({ sectorId: NIL_ID }),
        NOW,
      );

      expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    });

    it("setor inativo: SECTOR_INACTIVE, até para o admin", async () => {
      const { adminAuthz, input } = await setup();
      const parado = await insertSector(db, "Setor parado", { active: false });

      const result = await createRequest(
        db,
        adminAuthz,
        input({ sectorId: parado.id }),
        NOW,
      );

      expect(result).toMatchObject({
        ok: false,
        code: "SECTOR_INACTIVE",
        message:
          "Este setor está inativo. Peça a um administrador para reativá-lo.",
      });
      expect(await countOf(request)).toBe(0);
    });
  });

  describe("destino", () => {
    it("destino inexistente: NOT_FOUND no campo destinationId", async () => {
      const { anaAuthz, input } = await setup();

      const result = await createRequest(
        db,
        anaAuthz,
        input({ destination: { kind: "list", destinationId: NIL_ID } }),
        NOW,
      );

      expect(result).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
        message: "Destino não encontrado. Atualize a página.",
        fieldErrors: {
          destinationId: "Destino não encontrado. Atualize a página.",
        },
      });
    });

    it("destino inativo: DESTINATION_INACTIVE e nada gravado", async () => {
      const { anaAuthz, input } = await setup();
      const velho = await insertDestination(db, {
        name: "Doca antiga",
        active: false,
      });

      const result = await createRequest(
        db,
        anaAuthz,
        input({ destination: { kind: "list", destinationId: velho.id } }),
        NOW,
      );

      expect(result).toMatchObject({
        ok: false,
        code: "DESTINATION_INACTIVE",
        message: "Este destino está inativo. Escolha outro.",
        fieldErrors: {
          destinationId: "Este destino está inativo. Escolha outro.",
        },
      });
      expect(await countOf(request)).toBe(0);
    });
  });

  describe("itens", () => {
    it.each([
      ["de outro setor", "other-sector"],
      ["de controle", "control"],
      ["inativo", "inactive"],
      ["inexistente", "missing"],
    ])("item %s: INVALID_INPUT em items, a mesma mensagem, nada gravado", async (_label, kind) => {
      const { anaAuthz, outro, uld, fita, input } = await setup();
      const bad =
        kind === "other-sector"
          ? (await insertItem(db, { sectorId: outro.id, kind: "stock" })).id
          : kind === "control"
            ? (await insertItem(db, { sectorId: uld.id, kind: "control" })).id
            : kind === "inactive"
              ? (
                  await insertItem(db, {
                    sectorId: uld.id,
                    kind: "stock",
                    active: false,
                  })
                ).id
              : NIL_ID;

      const result = await createRequest(
        db,
        anaAuthz,
        input({
          items: [
            { itemId: fita.id, quantity: 1 },
            { itemId: bad, quantity: 1 },
          ],
        }),
        NOW,
      );

      expect(result).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        message: "Escolha um item de estoque ativo deste setor.",
        fieldErrors: { items: "Escolha um item de estoque ativo deste setor." },
      });
      expect(await countOf(request)).toBe(0);
      expect(await db.select().from(requestItem)).toEqual([]);
    });

    it("item repetido: INVALID_INPUT em items (o schema já barra; o domínio não confia)", async () => {
      const { anaAuthz, fita, input } = await setup();

      const result = await createRequest(
        db,
        anaAuthz,
        input({
          items: [
            { itemId: fita.id, quantity: 1 },
            { itemId: fita.id, quantity: 2 },
          ],
        }),
        NOW,
      );

      expect(result).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        message: "Item repetido. Atualize a página.",
      });
      expect(await countOf(request)).toBe(0);
    });
  });

  describe("origem na passagem", () => {
    it("sem rascunho: cria o rascunho na mesma transação e liga a solicitação", async () => {
      const { anaAuthz, input, ref } = await setup();
      expect(await handoverCount()).toBe(0);

      const result = await createRequest(
        db,
        anaAuthz,
        input({ originRef: ref }),
        NOW,
      );

      expect(result).toMatchObject({ ok: true });
      const [draft] = await db.select().from(handover);
      expect(draft).toMatchObject({ status: "draft", operationalDate: TODAY });
      const [row] = await db.select().from(request);
      expect(row?.originHandoverId).toBe(draft?.id);
    });

    it("rascunho existente: reaproveita (continua 1)", async () => {
      const { anaAuthz, ana, uld, turno, input, ref } = await setup();
      const existing = await insertHandover(db, {
        sectorId: uld.id,
        shiftId: turno.id,
        operationalDate: TODAY,
        updatedBy: ana.id,
      });

      const result = await createRequest(
        db,
        anaAuthz,
        input({ originRef: ref }),
        NOW,
      );

      expect(result).toMatchObject({ ok: true });
      expect(await handoverCount()).toBe(1);
      const [row] = await db.select().from(request);
      expect(row?.originHandoverId).toBe(existing.id);
    });

    it("passagem entregue por outra pessoa: aceita e a linha de handover fica idêntica", async () => {
      const { anaAuthz, uld, turno, input, ref } = await setup();
      const colega = await insertUser(db, {
        role: "operator",
        sectorId: uld.id,
        name: "Caio Teste",
      });
      const delivered = await insertHandover(db, {
        sectorId: uld.id,
        shiftId: turno.id,
        operationalDate: TODAY,
        status: "delivered",
        deliveredBy: colega.id,
        deliveredAt: spDate(TODAY, "13:00"),
      });
      const [before] = await db
        .select()
        .from(handover)
        .where(eq(handover.id, delivered.id));

      const result = await createRequest(
        db,
        anaAuthz,
        input({ originRef: ref }),
        NOW,
      );

      expect(result).toMatchObject({ ok: true });
      const [after] = await db
        .select()
        .from(handover)
        .where(eq(handover.id, delivered.id));
      expect(after).toEqual(before);
      const [row] = await db.select().from(request);
      expect(row?.originHandoverId).toBe(delivered.id);
    });

    it("passagem confirmada: HANDOVER_LOCKED, sem solicitação nem evento", async () => {
      const { anaAuthz, uld, turno, input, ref } = await setup();
      const colega = await insertUser(db, {
        role: "operator",
        sectorId: uld.id,
        name: "Caio Teste",
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: turno.id,
        operationalDate: TODAY,
        status: "confirmed",
        deliveredBy: colega.id,
        confirmedBy: (await insertUser(db, { role: "admin", sectorId: null }))
          .id,
      });

      const result = await createRequest(
        db,
        anaAuthz,
        input({ originRef: ref }),
        NOW,
      );

      expect(result).toMatchObject({
        ok: false,
        code: "HANDOVER_LOCKED",
        message:
          "Esta passagem já foi confirmada. Crie a solicitação pela tela Solicitações.",
      });
      expect(await countOf(request)).toBe(0);
      expect(await countOf(requestStatusEvent)).toBe(0);
    });

    it("turno inativo: SHIFT_INACTIVE sem solicitação nem rascunho", async () => {
      const { anaAuthz, uld, input } = await setup();
      const velho = await insertShift(db, { sectorId: uld.id, active: false });

      const result = await createRequest(
        db,
        anaAuthz,
        input({
          originRef: {
            sectorId: uld.id,
            shiftId: velho.id,
            operationalDate: TODAY,
          },
        }),
        NOW,
      );

      expect(result).toMatchObject({ ok: false, code: "SHIFT_INACTIVE" });
      expect(await countOf(request)).toBe(0);
      expect(await handoverCount()).toBe(0);
    });

    it("data fora da janela: DATE_OUT_OF_RANGE sem solicitação nem rascunho", async () => {
      const { anaAuthz, input, ref } = await setup();

      const result = await createRequest(
        db,
        anaAuthz,
        input({ originRef: { ...ref, operationalDate: "2026-09-01" } }),
        NOW,
      );

      expect(result).toMatchObject({ ok: false, code: "DATE_OUT_OF_RANGE" });
      expect(await countOf(request)).toBe(0);
      expect(await handoverCount()).toBe(0);
    });

    it("turno de outro setor: NOT_FOUND de turno, nada criado", async () => {
      const { anaAuthz, outro, input, ref } = await setup();
      const alheio = await insertShift(db, { sectorId: outro.id });

      const result = await createRequest(
        db,
        anaAuthz,
        input({ originRef: { ...ref, shiftId: alheio.id } }),
        NOW,
      );

      expect(result).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
        message: "Turno não encontrado. Atualize a página.",
      });
      expect(await handoverCount()).toBe(0);
    });

    it("origem de outro setor que o da solicitação: INVALID_INPUT em sectorId", async () => {
      const { anaAuthz, outro, input, ref } = await setup();

      const result = await createRequest(
        db,
        anaAuthz,
        input({ originRef: { ...ref, sectorId: outro.id } }),
        NOW,
      );

      expect(result).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: {
          sectorId:
            "A solicitação precisa ser do setor da passagem. Atualize a página.",
        },
      });
      expect(await handoverCount()).toBe(0);
    });

    it("falha depois do rascunho (destino inativo) desfaz o rascunho recém-criado", async () => {
      const { anaAuthz, input, ref } = await setup();
      const velho = await insertDestination(db, { active: false });

      const result = await createRequest(
        db,
        anaAuthz,
        input({
          originRef: ref,
          destination: { kind: "list", destinationId: velho.id },
        }),
        NOW,
      );

      expect(result).toMatchObject({
        ok: false,
        code: "DESTINATION_INACTIVE",
      });
      expect(await handoverCount()).toBe(0);
      expect(await countOf(request)).toBe(0);
    });
  });
});
