import type { PGlite } from "@electric-sql/pglite";
import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { requestComment } from "@/db/schema/requests";

import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  deactivateSector,
  insertRequest,
  insertRequestComment,
  insertSector,
  insertUser,
} from "../../../test/fixtures";
import { sqlErrorOf } from "../../../test/sqlError";
import { addComment, deleteComment, listRequestComments } from "./comments";

const NIL_ID = "00000000-0000-4000-8000-000000000000";
const T0 = spDate("2026-11-21", "10:00");
const NOW = spDate("2026-11-21", "14:05");

describe("comentários das solicitações", () => {
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
    const admin = await insertUser(db, {
      role: "admin",
      sectorId: null,
      name: "Dora Admin",
    });
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
      createdAt: T0,
    });
    return {
      uld,
      ana,
      bia,
      caio,
      admin,
      requestId: created.id,
      anaAuthz: authzOf({
        role: "operator",
        userId: ana.id,
        sectorId: uld.id,
        name: "Ana Teste",
      }),
      biaAuthz: authzOf({
        role: "operator",
        userId: bia.id,
        sectorId: uld.id,
        name: "Bia Teste",
      }),
      caioAuthz: authzOf({
        role: "operator",
        userId: caio.id,
        sectorId: outro.id,
      }),
      adminAuthz: authzOf({
        role: "admin",
        userId: admin.id,
        name: "Dora Admin",
      }),
    };
  }

  const total = async () =>
    (await db.select({ n: count() }).from(requestComment))[0]?.n ?? 0;

  describe("addComment", () => {
    it("grava com o autor e created_at = now", async () => {
      const { anaAuthz, ana, requestId } = await setup();

      const result = await addComment(
        db,
        anaAuthz,
        { requestId, body: "Fita separada na doca" },
        NOW,
      );

      expect(result).toMatchObject({ ok: true, createdAt: NOW });
      const [row] = await db.select().from(requestComment);
      expect(row).toMatchObject({
        requestId,
        authorId: ana.id,
        body: "Fita separada na doca",
        createdAt: NOW,
        deletedAt: null,
        statusEventId: null,
      });
      if (result.ok) expect(row?.id).toBe(result.id);
    });

    it("o admin comenta em solicitação de qualquer setor", async () => {
      const { adminAuthz, admin, requestId } = await setup();

      const result = await addComment(
        db,
        adminAuthz,
        { requestId, body: "Acompanhando" },
        NOW,
      );

      expect(result).toMatchObject({ ok: true });
      const [row] = await db.select().from(requestComment);
      expect(row?.authorId).toBe(admin.id);
    });

    it("operador de outro setor e solicitação inexistente: NOT_FOUND, nada gravado", async () => {
      const { caioAuthz, anaAuthz, requestId } = await setup();

      const stranger = await addComment(
        db,
        caioAuthz,
        { requestId, body: "Intruso" },
        NOW,
      );
      const missing = await addComment(
        db,
        anaAuthz,
        { requestId: NIL_ID, body: "Fantasma" },
        NOW,
      );

      const expected = {
        ok: false,
        code: "NOT_FOUND",
        message: "Solicitação não encontrada. Atualize a página.",
      };
      expect(stranger).toEqual(expected);
      expect(missing).toEqual(expected);
      expect(await total()).toBe(0);
    });

    it("setor inativo: SECTOR_INACTIVE, nada gravado", async () => {
      const { anaAuthz, uld, requestId } = await setup();
      await deactivateSector(db, uld.id);

      const result = await addComment(
        db,
        anaAuthz,
        { requestId, body: "Tarde demais" },
        NOW,
      );

      expect(result).toMatchObject({ ok: false, code: "SECTOR_INACTIVE" });
      expect(await total()).toBe(0);
    });
  });

  describe("deleteComment", () => {
    it("o autor apaga o próprio: deleted_at = now e ele sai da lista", async () => {
      const { anaAuthz, ana, requestId } = await setup();
      const own = await insertRequestComment(db, {
        requestId,
        authorId: ana.id,
        body: "Erro de digitação",
      });

      const result = await deleteComment(db, anaAuthz, { id: own.id }, NOW);

      expect(result).toEqual({ ok: true });
      const [row] = await db
        .select()
        .from(requestComment)
        .where(eq(requestComment.id, own.id));
      expect(row?.deletedAt).toEqual(NOW);
      const page = await listRequestComments(db, anaAuthz, {
        requestId,
        limit: 50,
        sectorActive: true,
      });
      expect(page).toMatchObject({ rows: [], total: 0, hasEarlier: false });
    });

    it("o admin apaga só o próprio comentário", async () => {
      const { adminAuthz, admin, requestId } = await setup();
      const own = await insertRequestComment(db, {
        requestId,
        authorId: admin.id,
      });

      const result = await deleteComment(db, adminAuthz, { id: own.id }, NOW);

      expect(result).toEqual({ ok: true });
    });

    it("comentário de outra pessoa: FORBIDDEN, para o colega e para o admin", async () => {
      const { biaAuthz, adminAuthz, ana, requestId } = await setup();
      const others = await insertRequestComment(db, {
        requestId,
        authorId: ana.id,
      });

      const byPeer = await deleteComment(db, biaAuthz, { id: others.id }, NOW);
      const byAdmin = await deleteComment(
        db,
        adminAuthz,
        { id: others.id },
        NOW,
      );

      const expected = {
        ok: false,
        code: "FORBIDDEN",
        message: "Só quem escreveu o comentário pode apagá-lo.",
      };
      expect(byPeer).toEqual(expected);
      expect(byAdmin).toEqual(expected);
      const [row] = await db.select().from(requestComment);
      expect(row?.deletedAt).toBeNull();
    });

    it("o motivo de um cancelamento: FORBIDDEN até para o autor e para o admin", async () => {
      const { anaAuthz, adminAuthz, uld, ana } = await setup();
      const cancelled = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
        createdAt: T0,
        status: "cancelled",
        statusChangedAt: T0,
      });
      const [reason] = await db
        .select()
        .from(requestComment)
        .where(eq(requestComment.requestId, cancelled.id));
      if (!reason) throw new Error("fixture: motivo não criado");

      const byAuthor = await deleteComment(
        db,
        anaAuthz,
        { id: reason.id },
        NOW,
      );
      const byAdmin = await deleteComment(
        db,
        adminAuthz,
        { id: reason.id },
        NOW,
      );

      const expected = {
        ok: false,
        code: "FORBIDDEN",
        message: "O motivo do cancelamento não pode ser apagado.",
      };
      expect(byAuthor).toEqual(expected);
      expect(byAdmin).toEqual(expected);
    });

    it("apagar duas vezes: a 2ª é NOT_FOUND e deleted_at não muda", async () => {
      const { anaAuthz, ana, requestId } = await setup();
      const own = await insertRequestComment(db, {
        requestId,
        authorId: ana.id,
      });
      await deleteComment(db, anaAuthz, { id: own.id }, T0);

      const late = await deleteComment(db, anaAuthz, { id: own.id }, NOW);

      expect(late).toEqual({
        ok: false,
        code: "NOT_FOUND",
        message: "Comentário não encontrado. Atualize a página.",
      });
      const [row] = await db.select().from(requestComment);
      expect(row?.deletedAt).toEqual(T0);
    });

    it("outro setor e id inexistente: NOT_FOUND (inclusive para o motivo de outro setor)", async () => {
      const { caioAuthz, anaAuthz, uld, ana, requestId } = await setup();
      const own = await insertRequestComment(db, {
        requestId,
        authorId: ana.id,
      });
      const cancelled = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
        createdAt: T0,
        status: "cancelled",
        statusChangedAt: T0,
      });
      const [reason] = await db
        .select()
        .from(requestComment)
        .where(eq(requestComment.requestId, cancelled.id));
      if (!reason) throw new Error("fixture: motivo não criado");

      const stranger = await deleteComment(db, caioAuthz, { id: own.id }, NOW);
      const strangerReason = await deleteComment(
        db,
        caioAuthz,
        { id: reason.id },
        NOW,
      );
      const missing = await deleteComment(db, anaAuthz, { id: NIL_ID }, NOW);

      for (const result of [stranger, strangerReason, missing]) {
        expect(result).toEqual({
          ok: false,
          code: "NOT_FOUND",
          message: "Comentário não encontrado. Atualize a página.",
        });
      }
      const [row] = await db
        .select()
        .from(requestComment)
        .where(eq(requestComment.id, own.id));
      expect(row?.deletedAt).toBeNull();
    });

    it("setor inativo: SECTOR_INACTIVE e o comentário continua", async () => {
      const { anaAuthz, uld, ana, requestId } = await setup();
      const own = await insertRequestComment(db, {
        requestId,
        authorId: ana.id,
      });
      await deactivateSector(db, uld.id);

      const result = await deleteComment(db, anaAuthz, { id: own.id }, NOW);

      expect(result).toMatchObject({ ok: false, code: "SECTOR_INACTIVE" });
      const [row] = await db.select().from(requestComment);
      expect(row?.deletedAt).toBeNull();
    });

    it("o banco também recusa apagar o motivo por UPDATE direto", async () => {
      const { uld, ana } = await setup();
      const cancelled = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
        createdAt: T0,
        status: "cancelled",
        statusChangedAt: T0,
      });

      const error = await sqlErrorOf(
        db
          .update(requestComment)
          .set({ deletedAt: NOW })
          .where(eq(requestComment.requestId, cancelled.id)),
      );

      expect(error).toEqual({
        code: "23514",
        constraint: "request_comment_reason_not_deleted",
      });
    });
  });

  describe("listRequestComments", () => {
    it("ordem cronológica, sem apagados, com autor, e vazio devolve página vazia", async () => {
      const { anaAuthz, ana, bia, requestId } = await setup();
      expect(
        await listRequestComments(db, anaAuthz, {
          requestId,
          limit: 50,
          sectorActive: true,
        }),
      ).toEqual({ rows: [], total: 0, hasEarlier: false, limit: 50 });
      await insertRequestComment(db, {
        requestId,
        authorId: bia.id,
        body: "Segundo",
        createdAt: spDate("2026-11-21", "11:00"),
      });
      await insertRequestComment(db, {
        requestId,
        authorId: ana.id,
        body: "Primeiro",
        createdAt: spDate("2026-11-21", "10:30"),
      });
      await insertRequestComment(db, {
        requestId,
        authorId: ana.id,
        body: "Apagado",
        createdAt: spDate("2026-11-21", "10:45"),
        deletedAt: NOW,
      });

      const page = await listRequestComments(db, anaAuthz, {
        requestId,
        limit: 50,
        sectorActive: true,
      });

      expect(page.rows.map((row) => [row.body, row.authorName])).toEqual([
        ["Primeiro", "Ana Teste"],
        ["Segundo", "Bia Teste"],
      ]);
      expect(page).toMatchObject({ total: 2, hasEarlier: false });
    });

    it("51 comentários com limit 50: os 50 mais novos, hasEarlier e total 51", async () => {
      const { anaAuthz, ana, requestId } = await setup();
      for (let minute = 0; minute < 51; minute += 1) {
        await insertRequestComment(db, {
          requestId,
          authorId: ana.id,
          body: `Comentário ${minute}`,
          createdAt: new Date(T0.getTime() + minute * 60_000),
        });
      }

      const page = await listRequestComments(db, anaAuthz, {
        requestId,
        limit: 50,
        sectorActive: true,
      });

      expect(page.rows).toHaveLength(50);
      expect(page.total).toBe(51);
      expect(page.hasEarlier).toBe(true);
      expect(page.rows[0]?.body).toBe("Comentário 1");
      expect(page.rows.at(-1)?.body).toBe("Comentário 50");
    });

    it("canDelete e isCancelReason por linha; setor inativo tira o Apagar de todos", async () => {
      const { anaAuthz, uld, ana, bia } = await setup();
      const cancelled = await insertRequest(db, {
        sectorId: uld.id,
        createdBy: ana.id,
        createdAt: T0,
        status: "cancelled",
        statusChangedAt: T0,
      });
      await insertRequestComment(db, {
        requestId: cancelled.id,
        authorId: bia.id,
        body: "Do colega",
        createdAt: spDate("2026-11-21", "11:00"),
      });
      await insertRequestComment(db, {
        requestId: cancelled.id,
        authorId: ana.id,
        body: "Meu",
        createdAt: spDate("2026-11-21", "12:00"),
      });

      const active = await listRequestComments(db, anaAuthz, {
        requestId: cancelled.id,
        limit: 50,
        sectorActive: true,
      });
      const readOnly = await listRequestComments(db, anaAuthz, {
        requestId: cancelled.id,
        limit: 50,
        sectorActive: false,
      });

      expect(
        active.rows.map((row) => [row.body, row.isCancelReason, row.canDelete]),
      ).toEqual([
        ["Motivo de teste", true, false],
        ["Do colega", false, false],
        ["Meu", false, true],
      ]);
      expect(readOnly.rows.every((row) => !row.canDelete)).toBe(true);
    });
  });
});
