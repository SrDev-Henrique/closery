import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { item } from "@/db/schema/catalog";
import { requestStatusEvent } from "@/db/schema/requests";

import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  deactivateSector,
  insertDestination,
  insertHandover,
  insertItem,
  insertRequest,
  insertRequestComment,
  insertRequestEvent,
  insertRequestItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { getRequestDetail, listRequestTimeline } from "./detail";
import { timelineSentence } from "./timeline";

const NIL_ID = "00000000-0000-4000-8000-000000000000";
const T0 = spDate("2026-11-18", "09:00");
const HOUR = 3_600_000;

describe("detalhe da solicitação", () => {
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
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: uld.id,
      name: "Ana Teste",
    });
    const bia = await insertUser(db, {
      role: "operator",
      sectorId: uld.id,
      name: "Bia Teste",
    });
    const caio = await insertUser(db, {
      role: "operator",
      sectorId: outro.id,
      name: "Caio Teste",
    });
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    return {
      uld,
      outro,
      ana,
      bia,
      anaAuthz: authzOf({
        role: "operator",
        userId: ana.id,
        sectorId: uld.id,
        name: "Ana Teste",
      }),
      caioAuthz: authzOf({
        role: "operator",
        userId: caio.id,
        sectorId: outro.id,
      }),
      adminAuthz: authzOf({ role: "admin", userId: admin.id }),
    };
  }

  const detailOf = async (
    actor: ReturnType<typeof authzOf>,
    id: string,
    now = T0,
    commentsLimit = 50,
  ) => {
    const result = await getRequestDetail(
      db,
      actor,
      { id, commentsLimit },
      now,
    );
    if (!result.ok) throw new Error(`getRequestDetail falhou: ${result.code}`);
    return result.detail;
  };

  describe("getRequestDetail", () => {
    it("propriedades com destino da lista, quem criou e o setor", async () => {
      const { uld, ana, anaAuthz } = await setup();
      const doca = await insertDestination(db, { name: "Doca 3" });
      const created = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
        destinationId: doca.id,
        description: "Repor fita\ncom urgência",
        createdAt: T0,
      });

      const detail = await detailOf(anaAuthz, created.id);

      expect(detail).toMatchObject({
        id: created.id,
        sectorId: uld.id,
        sectorName: "ULD",
        sectorActive: true,
        description: "Repor fita\ncom urgência",
        destinationName: "Doca 3",
        destinationIsOther: false,
        status: "requested",
        createdByName: "Ana Teste",
        createdAt: T0,
        statusChangedAt: T0,
        origin: null,
        items: [],
      });
    });

    it("destino 'Outro' mostra o texto digitado", async () => {
      const { uld, ana, anaAuthz } = await setup();
      const created = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
        destinationOther: "Hangar 7",
      });

      const detail = await detailOf(anaAuthz, created.id);

      expect(detail).toMatchObject({
        destinationName: "Hangar 7",
        destinationIsOther: true,
      });
    });

    it("origem: usa o nome do turno gravado na entrega; sem ele, o nome vivo", async () => {
      const { uld, ana, anaAuthz } = await setup();
      const turno = await insertShift(db, { sectorId: uld.id, name: "Dia" });
      const entregue = await insertHandover(db, {
        sectorId: uld.id,
        shiftId: turno.id,
        operationalDate: "2026-11-18",
        status: "delivered",
        deliveredBy: ana.id,
        shiftNameSnapshot: "Turno Dia (antigo)",
      });
      const rascunho = await insertHandover(db, {
        sectorId: uld.id,
        shiftId: turno.id,
        operationalDate: "2026-11-19",
      });
      const comSnapshot = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
        originHandoverId: entregue.id,
      });
      const semSnapshot = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
        originHandoverId: rascunho.id,
      });

      expect((await detailOf(anaAuthz, comSnapshot.id)).origin).toEqual({
        handoverId: entregue.id,
        shiftName: "Turno Dia (antigo)",
        operationalDate: "2026-11-18",
      });
      expect((await detailOf(anaAuthz, semSnapshot.id)).origin).toEqual({
        handoverId: rascunho.id,
        shiftName: "Dia",
        operationalDate: "2026-11-19",
      });
    });

    it("itens vêm dos snapshots (renomear o item depois não muda) na ordem do cadastro", async () => {
      const { uld, ana, anaAuthz } = await setup();
      const segundo = await insertItem(db, {
        sectorId: uld.id,
        name: "Lacre numerado",
        unit: "caixa",
        kind: "stock",
        sortOrder: 2,
      });
      const primeiro = await insertItem(db, {
        sectorId: uld.id,
        name: "Fita adesiva",
        unit: "rolo",
        kind: "stock",
        sortOrder: 1,
      });
      const created = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
      });
      await insertRequestItem(db, {
        requestId: created.id,
        itemId: segundo.id,
        quantity: 3,
      });
      await insertRequestItem(db, {
        requestId: created.id,
        itemId: primeiro.id,
        quantity: 12,
      });
      await db
        .update(item)
        .set({ name: "Fita larga", unit: "metro" })
        .where(eq(item.id, primeiro.id));

      const detail = await detailOf(anaAuthz, created.id);

      expect(detail.items).toEqual([
        {
          itemId: primeiro.id,
          name: "Fita adesiva",
          unit: "rolo",
          quantity: 12,
        },
        {
          itemId: segundo.id,
          name: "Lacre numerado",
          unit: "caixa",
          quantity: 3,
        },
      ]);
    });

    it("linha do tempo com as quatro frases em ordem e o motivo junto do 'cancelou'", async () => {
      const { uld, ana, bia, anaAuthz } = await setup();
      const created = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
        createdAt: T0,
        statusChangedAt: new Date(T0.getTime() + 3 * HOUR),
        events: false,
      });
      const at = (hours: number) => new Date(T0.getTime() + hours * HOUR);
      await insertRequestEvent(db, {
        requestId: created.id,
        fromStatus: null,
        toStatus: "requested",
        changedBy: ana.id,
        changedAt: at(0),
      });
      await insertRequestEvent(db, {
        requestId: created.id,
        fromStatus: "requested",
        toStatus: "in_transit",
        changedBy: bia.id,
        changedAt: at(1),
      });
      const cancel = await insertRequestEvent(db, {
        requestId: created.id,
        fromStatus: "in_transit",
        toStatus: "cancelled",
        changedBy: ana.id,
        changedAt: at(2),
      });
      await insertRequestComment(db, {
        requestId: created.id,
        authorId: ana.id,
        body: "Pedido duplicado",
        createdAt: at(2),
        statusEventId: cancel.id,
      });
      await insertRequestEvent(db, {
        requestId: created.id,
        fromStatus: "cancelled",
        toStatus: "requested",
        changedBy: bia.id,
        changedAt: at(3),
      });

      const detail = await detailOf(anaAuthz, created.id, at(4));

      expect(detail.timeline.map((entry) => timelineSentence(entry))).toEqual([
        "Criada por Ana Teste",
        "Bia Teste moveu para Em separação / Trânsito",
        "Ana Teste cancelou",
        "Bia Teste reabriu como Solicitada",
      ]);
      expect(detail.timeline.map((entry) => entry.reason)).toEqual([
        null,
        null,
        "Pedido duplicado",
        null,
      ]);
      expect(detail.timeline.map((entry) => entry.at)).toEqual([
        at(0),
        at(1),
        at(2),
        at(3),
      ]);
    });

    it("três eventos com o MESMO instante saem na ordem de inserção", async () => {
      const { uld, ana, bia } = await setup();
      const created = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
        createdAt: T0,
        events: false,
      });
      const steps: [
        "requested" | "in_transit" | "delivered" | null,
        "requested" | "in_transit" | "delivered",
        string,
      ][] = [
        [null, "requested", ana.id],
        ["requested", "in_transit", bia.id],
        ["in_transit", "delivered", ana.id],
      ];
      for (const [fromStatus, toStatus, changedBy] of steps) {
        await insertRequestEvent(db, {
          requestId: created.id,
          fromStatus,
          toStatus,
          changedBy,
          changedAt: T0,
        });
      }

      const timeline = await listRequestTimeline(db, created.id);

      expect(timeline.map((entry) => entry.to)).toEqual([
        "requested",
        "in_transit",
        "delivered",
      ]);
    });

    it("201 eventos: os 200 mais recentes, em ordem cronológica", async () => {
      const { uld, ana } = await setup();
      const created = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
        createdAt: T0,
        events: false,
      });
      await db.insert(requestStatusEvent).values(
        Array.from({ length: 201 }, (_, index) => ({
          requestId: created.id,
          fromStatus:
            index === 0
              ? null
              : index % 2 === 1
                ? ("requested" as const)
                : ("in_transit" as const),
          toStatus:
            index % 2 === 0 ? ("requested" as const) : ("in_transit" as const),
          changedBy: ana.id,
          changedAt: new Date(T0.getTime() + index * 60_000),
        })),
      );

      const timeline = await listRequestTimeline(db, created.id);

      expect(timeline).toHaveLength(200);
      expect(timeline[0]?.at).toEqual(new Date(T0.getTime() + 60_000));
      expect(timeline.at(-1)?.at).toEqual(
        new Date(T0.getTime() + 200 * 60_000),
      );
    });

    it("dias no status e 'parada' usam o relógio injetado (72 h exatas não param; +1 ms param)", async () => {
      const { uld, ana, anaAuthz } = await setup();
      const created = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
        createdAt: T0,
      });
      const exact = new Date(T0.getTime() + 72 * HOUR);

      const atLimit = await detailOf(anaAuthz, created.id, exact);
      const over = await detailOf(
        anaAuthz,
        created.id,
        new Date(exact.getTime() + 1),
      );
      const fresh = await detailOf(anaAuthz, created.id, T0);

      expect([atLimit.daysInStatus, atLimit.stale]).toEqual([3, false]);
      expect([over.daysInStatus, over.stale]).toEqual([3, true]);
      expect([fresh.daysInStatus, fresh.stale]).toEqual([0, false]);
    });

    it("Entregue e Cancelada nunca ficam paradas", async () => {
      const { uld, ana, anaAuthz } = await setup();
      const entregue = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
        status: "delivered",
        createdAt: T0,
      });
      const longe = new Date(T0.getTime() + 400 * HOUR);

      const detail = await detailOf(anaAuthz, entregue.id, longe);

      expect(detail).toMatchObject({ stale: false, daysInStatus: 16 });
    });

    it("comentários respeitam commentsLimit e trazem o total", async () => {
      const { uld, ana, anaAuthz } = await setup();
      const created = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
      });
      for (const body of ["a", "b", "c"]) {
        await insertRequestComment(db, {
          requestId: created.id,
          authorId: ana.id,
          body,
          createdAt: new Date(T0.getTime() + body.charCodeAt(0) * 1000),
        });
      }

      const detail = await detailOf(anaAuthz, created.id, T0, 2);

      expect(detail.comments).toMatchObject({
        total: 3,
        hasEarlier: true,
        limit: 2,
      });
      expect(detail.comments.rows.map((row) => row.body)).toEqual(["b", "c"]);
    });
  });

  describe("permissões", () => {
    it.each([
      ["operador do setor, setor ativo", "ana", true, true, true, true],
      ["admin, setor ativo", "admin", true, true, true, true],
      ["operador do setor, setor inativo", "ana", false, true, false, false],
      ["admin, setor inativo", "admin", false, true, false, false],
    ])("%s", async (_label, who, active, canView, canMove, canComment) => {
      const { uld, ana, anaAuthz, adminAuthz } = await setup();
      const created = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
      });
      if (!active) {
        await deactivateSector(db, uld.id);
      }

      const detail = await detailOf(
        who === "ana" ? anaAuthz : adminAuthz,
        created.id,
      );

      expect(detail.sectorActive).toBe(active);
      expect(detail.capabilities).toEqual({
        canView,
        canMove,
        canCancel: canMove,
        canComment,
      });
    });

    it("Cancelada não oferece cancelar de novo", async () => {
      const { uld, ana, anaAuthz } = await setup();
      const created = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
        status: "cancelled",
      });

      const detail = await detailOf(anaAuthz, created.id);

      expect(detail.capabilities).toEqual({
        canView: true,
        canMove: true,
        canCancel: false,
        canComment: true,
      });
    });

    it("operador de outro setor e id inexistente: NOT_FOUND", async () => {
      const { uld, ana, caioAuthz, anaAuthz } = await setup();
      const created = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
      });

      const stranger = await getRequestDetail(
        db,
        caioAuthz,
        { id: created.id, commentsLimit: 50 },
        T0,
      );
      const missing = await getRequestDetail(
        db,
        anaAuthz,
        { id: NIL_ID, commentsLimit: 50 },
        T0,
      );

      const expected = {
        ok: false,
        code: "NOT_FOUND",
        message: "Solicitação não encontrada. Atualize a página.",
      };
      expect(stranger).toEqual(expected);
      expect(missing).toEqual(expected);
    });
  });
});
