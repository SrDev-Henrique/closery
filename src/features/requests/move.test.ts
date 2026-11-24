import type { PGlite } from "@electric-sql/pglite";
import { asc, count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  request,
  requestComment,
  requestStatusEvent,
} from "@/db/schema/requests";

import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertRequest,
  insertSector,
  insertUser,
} from "../../../test/fixtures";
import { createRequest } from "./create";
import { cancelRequest, moveRequest } from "./move";

const T0 = spDate("2026-11-21", "10:00");
const T1 = spDate("2026-11-21", "14:05");
const T2 = spDate("2026-11-22", "09:30");

describe("moveRequest e cancelRequest", () => {
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
    const as = (id: string, name: string, sectorId: string) =>
      authzOf({ role: "operator", userId: id, sectorId, name });
    const open = (
      overrides: Partial<
        Omit<Parameters<typeof insertRequest>[1], "sectorId" | "createdBy">
      > = {},
    ) =>
      insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
        createdAt: T0,
        ...overrides,
      });
    return {
      uld,
      outro,
      ana,
      bia,
      caio,
      admin,
      anaAuthz: as(ana.id, "Ana Teste", uld.id),
      biaAuthz: as(bia.id, "Bia Teste", uld.id),
      caioAuthz: as(caio.id, "Caio Teste", outro.id),
      adminAuthz: authzOf({ role: "admin", userId: admin.id }),
      open,
    };
  }

  const statusOf = async (id: string) =>
    (await db.select().from(request).where(eq(request.id, id)))[0];
  const eventsOf = (id: string) =>
    db
      .select()
      .from(requestStatusEvent)
      .where(eq(requestStatusEvent.requestId, id))
      .orderBy(asc(requestStatusEvent.changedAt), asc(requestStatusEvent.seq));
  const commentCount = async () =>
    (await db.select({ n: count() }).from(requestComment))[0]?.n ?? 0;

  describe("moveRequest", () => {
    it("Solicitada → Em separação → Entregue: um evento por passo e status_changed_at = now", async () => {
      const { anaAuthz, biaAuthz, ana, bia, open } = await setup();
      const created = await open();

      const first = await moveRequest(
        db,
        anaAuthz,
        { id: created.id, from: "requested", to: "in_transit" },
        T1,
      );
      const second = await moveRequest(
        db,
        biaAuthz,
        { id: created.id, from: "in_transit", to: "delivered" },
        T2,
      );

      expect(first).toEqual({
        ok: true,
        id: created.id,
        status: "in_transit",
        statusChangedAt: T1,
      });
      expect(second).toMatchObject({ ok: true, status: "delivered" });
      expect(await statusOf(created.id)).toMatchObject({
        status: "delivered",
        statusChangedAt: T2,
      });
      expect(await eventsOf(created.id)).toMatchObject([
        { fromStatus: null, toStatus: "requested", changedBy: ana.id },
        { fromStatus: "requested", toStatus: "in_transit", changedBy: ana.id },
        { fromStatus: "in_transit", toStatus: "delivered", changedBy: bia.id },
      ]);
    });

    it("reabre uma Entregue e uma Cancelada", async () => {
      const { anaAuthz, open } = await setup();
      const entregue = await open({ status: "delivered", statusChangedAt: T1 });
      const cancelada = await open({
        status: "cancelled",
        statusChangedAt: T1,
      });

      const a = await moveRequest(
        db,
        anaAuthz,
        { id: entregue.id, from: "delivered", to: "in_transit" },
        T2,
      );
      const b = await moveRequest(
        db,
        anaAuthz,
        { id: cancelada.id, from: "cancelled", to: "requested" },
        T2,
      );

      expect(a).toMatchObject({ ok: true, status: "in_transit" });
      expect(b).toMatchObject({ ok: true, status: "requested" });
      expect((await statusOf(entregue.id))?.status).toBe("in_transit");
      expect((await statusOf(cancelada.id))?.status).toBe("requested");
    });

    it("from igual a to: NO_CHANGES e nenhum evento", async () => {
      const { anaAuthz, open } = await setup();
      const created = await open();

      const result = await moveRequest(
        db,
        anaAuthz,
        { id: created.id, from: "requested", to: "requested" },
        T1,
      );

      expect(result).toEqual({
        ok: false,
        code: "NO_CHANGES",
        message: "O status desta solicitação já é Solicitada.",
      });
      expect(await eventsOf(created.id)).toHaveLength(1);
    });

    it("dois 'Mover' com o mesmo from, para alvos diferentes: o 2º é STATUS_CONFLICT com nome, data e hora", async () => {
      const { anaAuthz, biaAuthz, open } = await setup();
      const created = await open();
      await moveRequest(
        db,
        anaAuthz,
        { id: created.id, from: "requested", to: "in_transit" },
        T1,
      );

      const late = await moveRequest(
        db,
        biaAuthz,
        { id: created.id, from: "requested", to: "delivered" },
        T2,
      );

      expect(late).toEqual({
        ok: false,
        code: "STATUS_CONFLICT",
        message:
          "Esta solicitação mudou para Em separação / Trânsito por Ana Teste em 21/11/2026 às 14:05. Confira e tente de novo.",
      });
      expect(await eventsOf(created.id)).toHaveLength(2);
      expect((await statusOf(created.id))?.status).toBe("in_transit");
    });

    it("dois 'Mover' com o mesmo from e o mesmo alvo: o 2º é NO_CHANGES 'já foi movida' com quem e quando", async () => {
      const { anaAuthz, biaAuthz, open } = await setup();
      const created = await open();
      await moveRequest(
        db,
        anaAuthz,
        { id: created.id, from: "requested", to: "in_transit" },
        T1,
      );

      const late = await moveRequest(
        db,
        biaAuthz,
        { id: created.id, from: "requested", to: "in_transit" },
        T2,
      );

      expect(late).toEqual({
        ok: false,
        code: "NO_CHANGES",
        message:
          "Esta solicitação já foi movida para Em separação / Trânsito por Ana Teste em 21/11/2026 às 14:05.",
      });
      expect(await eventsOf(created.id)).toHaveLength(2);
    });

    it("criar e mover com o MESMO now: o conflito nomeia quem moveu, nunca quem criou (desempate por seq)", async () => {
      const { anaAuthz, biaAuthz, uld } = await setup();
      const carla = await insertUser(db, {
        role: "operator",
        sectorId: uld.id,
        name: "Carla Teste",
      });
      const carlaAuthz = authzOf({
        role: "operator",
        userId: carla.id,
        sectorId: uld.id,
        name: "Carla Teste",
      });
      for (let round = 0; round < 8; round += 1) {
        // Bia cria, Ana move e Carla ainda vê "Solicitada": tudo no mesmo instante.
        const created = await createRequest(
          db,
          biaAuthz,
          {
            sectorId: uld.id,
            destination: { kind: "other", text: "Doca 3" },
            description: `Rodada ${round}`,
            items: [],
            originRef: null,
          },
          T1,
        );
        if (!created.ok) throw new Error("fixture: criação falhou");
        await moveRequest(
          db,
          anaAuthz,
          { id: created.id, from: "requested", to: "in_transit" },
          T1,
        );

        const late = await moveRequest(
          db,
          carlaAuthz,
          { id: created.id, from: "requested", to: "delivered" },
          T1,
        );

        if (late.ok) throw new Error("o 2º Mover devia falhar");
        expect(late.code).toBe("STATUS_CONFLICT");
        expect(late.message).toContain("por Ana Teste");
        expect(late.message).not.toContain("Bia Teste");
      }
    });

    it("operador de outro setor e id inexistente: NOT_FOUND, nada muda", async () => {
      const { caioAuthz, anaAuthz, open } = await setup();
      const created = await open();

      const stranger = await moveRequest(
        db,
        caioAuthz,
        { id: created.id, from: "requested", to: "in_transit" },
        T1,
      );
      const missing = await moveRequest(
        db,
        anaAuthz,
        {
          id: "00000000-0000-4000-8000-000000000000",
          from: "requested",
          to: "in_transit",
        },
        T1,
      );

      const expected = {
        ok: false,
        code: "NOT_FOUND",
        message: "Solicitação não encontrada. Atualize a página.",
      };
      expect(stranger).toEqual(expected);
      expect(missing).toEqual(expected);
      expect((await statusOf(created.id))?.status).toBe("requested");
      expect(await eventsOf(created.id)).toHaveLength(1);
    });

    it("admin move solicitação de qualquer setor", async () => {
      const { adminAuthz, open } = await setup();
      const created = await open();

      const result = await moveRequest(
        db,
        adminAuthz,
        { id: created.id, from: "requested", to: "in_transit" },
        T1,
      );

      expect(result).toMatchObject({ ok: true });
    });

    it("setor inativo: SECTOR_INACTIVE, nada muda", async () => {
      const { anaAuthz, uld, open } = await setup();
      const created = await open();
      await client.exec(
        `UPDATE "sector" SET "active" = false WHERE "id" = '${uld.id}'`,
      );

      const result = await moveRequest(
        db,
        anaAuthz,
        { id: created.id, from: "requested", to: "in_transit" },
        T1,
      );

      expect(result).toMatchObject({ ok: false, code: "SECTOR_INACTIVE" });
      expect((await statusOf(created.id))?.status).toBe("requested");
      expect(await eventsOf(created.id)).toHaveLength(1);
    });

    it("sem nenhum evento para citar, o conflito diz 'outra pessoa' em vez de falhar", async () => {
      const { anaAuthz, open } = await setup();
      const created = await open({
        status: "in_transit",
        statusChangedAt: T1,
        events: false,
      });

      const result = await moveRequest(
        db,
        anaAuthz,
        { id: created.id, from: "requested", to: "delivered" },
        T2,
      );

      expect(result).toMatchObject({
        ok: false,
        code: "STATUS_CONFLICT",
        message:
          "Esta solicitação mudou para Em separação / Trânsito por outra pessoa em 21/11/2026 às 14:05. Confira e tente de novo.",
      });
    });
  });

  describe("cancelRequest", () => {
    it("cancela: status, evento e comentário do motivo ligado ao evento, com o mesmo now", async () => {
      const { anaAuthz, ana, open } = await setup();
      const created = await open();

      const result = await cancelRequest(
        db,
        anaAuthz,
        { id: created.id, from: "requested", reason: "Pedido duplicado" },
        T1,
      );

      expect(result).toEqual({
        ok: true,
        id: created.id,
        status: "cancelled",
        statusChangedAt: T1,
      });
      expect(await statusOf(created.id)).toMatchObject({
        status: "cancelled",
        statusChangedAt: T1,
      });
      const events = await eventsOf(created.id);
      expect(events).toMatchObject([
        { fromStatus: null },
        { fromStatus: "requested", toStatus: "cancelled", changedAt: T1 },
      ]);
      const comments = await db.select().from(requestComment);
      expect(comments).toMatchObject([
        {
          requestId: created.id,
          authorId: ana.id,
          body: "Pedido duplicado",
          createdAt: T1,
          deletedAt: null,
          statusEventId: events[1]?.id,
        },
      ]);
    });

    it("cancela também uma Entregue (qualquer status vira Cancelada)", async () => {
      const { anaAuthz, open } = await setup();
      const created = await open({ status: "delivered", statusChangedAt: T0 });

      const result = await cancelRequest(
        db,
        anaAuthz,
        { id: created.id, from: "delivered", reason: "Entrega errada" },
        T1,
      );

      expect(result).toMatchObject({ ok: true, status: "cancelled" });
    });

    it("cancelar uma já movida por outra pessoa: STATUS_CONFLICT e nenhum comentário", async () => {
      const { anaAuthz, biaAuthz, open } = await setup();
      const created = await open();
      await moveRequest(
        db,
        anaAuthz,
        { id: created.id, from: "requested", to: "in_transit" },
        T1,
      );

      const late = await cancelRequest(
        db,
        biaAuthz,
        { id: created.id, from: "requested", reason: "Não precisa mais" },
        T2,
      );

      expect(late).toEqual({
        ok: false,
        code: "STATUS_CONFLICT",
        message:
          "Esta solicitação mudou para Em separação / Trânsito por Ana Teste em 21/11/2026 às 14:05. Confira e tente de novo.",
      });
      expect(await commentCount()).toBe(0);
      expect((await statusOf(created.id))?.status).toBe("in_transit");
    });

    it("cancelar duas vezes em sequência: a 2ª é NO_CHANGES, com um só evento e um só motivo", async () => {
      const { anaAuthz, biaAuthz, open } = await setup();
      const created = await open();
      await cancelRequest(
        db,
        anaAuthz,
        { id: created.id, from: "requested", reason: "Primeiro motivo" },
        T1,
      );

      const late = await cancelRequest(
        db,
        biaAuthz,
        { id: created.id, from: "requested", reason: "Segundo motivo" },
        T2,
      );

      expect(late).toEqual({
        ok: false,
        code: "NO_CHANGES",
        message:
          "Esta solicitação já foi cancelada por Ana Teste em 21/11/2026 às 14:05.",
      });
      const events = await eventsOf(created.id);
      expect(events.filter((e) => e.toStatus === "cancelled")).toHaveLength(1);
      expect(await db.select().from(requestComment)).toMatchObject([
        { body: "Primeiro motivo" },
      ]);
    });

    it("from 'cancelled': NO_CHANGES 'já é Cancelada', sem escrita", async () => {
      const { anaAuthz, open } = await setup();
      const created = await open({ status: "cancelled", statusChangedAt: T1 });
      const commentsBefore = await commentCount();

      const result = await cancelRequest(
        db,
        anaAuthz,
        { id: created.id, from: "cancelled", reason: "Outra vez" },
        T2,
      );

      expect(result).toEqual({
        ok: false,
        code: "NO_CHANGES",
        message: "O status desta solicitação já é Cancelada.",
      });
      expect(await commentCount()).toBe(commentsBefore);
    });

    it("operador de outro setor: NOT_FOUND; setor inativo: SECTOR_INACTIVE; nada escrito", async () => {
      const { caioAuthz, anaAuthz, uld, open } = await setup();
      const created = await open();

      const stranger = await cancelRequest(
        db,
        caioAuthz,
        { id: created.id, from: "requested", reason: "Intruso" },
        T1,
      );
      await client.exec(
        `UPDATE "sector" SET "active" = false WHERE "id" = '${uld.id}'`,
      );
      const inactive = await cancelRequest(
        db,
        anaAuthz,
        { id: created.id, from: "requested", reason: "Setor parado" },
        T1,
      );

      expect(stranger).toMatchObject({ ok: false, code: "NOT_FOUND" });
      expect(inactive).toMatchObject({ ok: false, code: "SECTOR_INACTIVE" });
      expect((await statusOf(created.id))?.status).toBe("requested");
      expect(await commentCount()).toBe(0);
    });
  });
});
