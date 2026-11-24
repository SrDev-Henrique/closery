import type { PGlite } from "@electric-sql/pglite";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
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
import { sqlErrorOf } from "../../../test/sqlError";
import {
  request,
  requestComment,
  requestItem,
  requestStatusEvent,
} from "./requests";

const MISSING = "00000000-0000-4000-8000-000000000000";
const T1 = "2026-11-20T12:00:00Z";
const T2 = "2026-11-21T12:00:00Z";

describe("tabelas da solicitação", () => {
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

  async function scenario() {
    const sector = await insertSector(db, "ULD");
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      name: "Ana Teste",
    });
    const bia = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      name: "Bia Teste",
    });
    const destination = await insertDestination(db, { name: "Doca 3" });
    const stock = await insertItem(db, {
      sectorId: sector.id,
      name: "Rede de proteção",
      unit: "rolo",
      kind: "stock",
    });
    return { sector, ana, bia, destination, stock };
  }

  // SQL cru, para montar estados que o tipo do Drizzle e as fixtures não
  // deixam passar. Cada caso muda UMA coisa e deixa o resto válido: o
  // Postgres reporta o primeiro CHECK que falha em ordem alfabética de nome,
  // então só assim o CHECK alvo aparece no erro.
  async function rawRequest(
    context: Awaited<ReturnType<typeof scenario>>,
    overrides: Record<string, string | null>,
  ) {
    const row: Record<string, string | null> = {
      sector_id: context.sector.id,
      destination_id: context.destination.id,
      description: "Rede para a doca",
      created_by: context.ana.id,
      created_at: T1,
      status_changed_at: T1,
      ...overrides,
    };
    const columns = Object.keys(row);
    const marks = columns.map((_, index) => `$${index + 1}`).join(", ");
    return client.query(
      `INSERT INTO request (${columns.join(", ")}) VALUES (${marks})`,
      Object.values(row),
    );
  }

  describe("request", () => {
    it("grava com os padrões: Solicitada, destino da lista, datas Date", async () => {
      const context = await scenario();
      const created = await insertRequest(db, {
        sectorId: context.sector.id,
        createdBy: context.ana.id,
        destinationId: context.destination.id,
      });
      const [row] = await db
        .select()
        .from(request)
        .where(eq(request.id, created.id));
      expect(row).toMatchObject({
        status: "requested",
        destinationId: context.destination.id,
        destinationOther: null,
        description: "Solicitação de teste",
        originHandoverId: null,
      });
      expect(row?.createdAt).toBeInstanceOf(Date);
      expect(row?.statusChangedAt).toBeInstanceOf(Date);
    });

    it("o padrão do banco para status é requested e as datas são now()", async () => {
      const context = await scenario();
      await client.query(
        "INSERT INTO request (sector_id, destination_other, description, created_by) VALUES ($1, 'Doca 9', 'Rede', $2)",
        [context.sector.id, context.ana.id],
      );
      const [row] = await db.select().from(request);
      expect(row?.status).toBe("requested");
      expect(row?.statusChangedAt.getTime()).toBeGreaterThanOrEqual(
        row?.createdAt.getTime() ?? Number.POSITIVE_INFINITY,
      );
    });

    it.each([
      ["status fora da lista", { status: "archived" }, "request_status_valid"],
      [
        "os dois destinos",
        { destination_other: "Doca 9" },
        "request_destination_exactly_one",
      ],
      [
        "nenhum destino",
        { destination_id: null },
        "request_destination_exactly_one",
      ],
      [
        "texto do Outro só com espaços",
        { destination_id: null, destination_other: "   " },
        "request_destination_other_not_blank",
      ],
      [
        "texto do Outro só com quebras de linha",
        { destination_id: null, destination_other: "\n\n" },
        "request_destination_other_not_blank",
      ],
      [
        "texto do Outro vazio",
        { destination_id: null, destination_other: "" },
        "request_destination_other_not_blank",
      ],
      [
        "descrição só com espaços",
        { description: "   " },
        "request_description_not_blank",
      ],
      [
        "descrição só com quebras de linha e tabulação",
        { description: " \t\r\n\n" },
        "request_description_not_blank",
      ],
      ["descrição vazia", { description: "" }, "request_description_not_blank"],
      [
        "status_changed_at antes de created_at",
        { created_at: T2, status_changed_at: T1 },
        "request_status_changed_after_created",
      ],
    ])("recusa %s com 23514 (%#)", async (_label, overrides, constraint) => {
      const context = await scenario();
      const failure = await sqlErrorOf(rawRequest(context, overrides));
      expect(failure).toEqual({ code: "23514", constraint });
    });

    it("aceita o texto do Outro sem destino da lista e datas iguais", async () => {
      const context = await scenario();
      await rawRequest(context, {
        destination_id: null,
        destination_other: "Doca 9",
      });
      const [row] = await db.select().from(request);
      expect(row?.destinationOther).toBe("Doca 9");
      expect(row?.createdAt.getTime()).toBe(row?.statusChangedAt.getTime());
    });

    it("recusa setor, destino, usuário e passagem inexistentes com 23503", async () => {
      const context = await scenario();
      for (const column of [
        "sector_id",
        "destination_id",
        "created_by",
      ] as const) {
        const failure = await sqlErrorOf(
          rawRequest(context, { [column]: MISSING }),
        );
        expect(failure.code, column).toBe("23503");
      }
      const origin = await sqlErrorOf(
        rawRequest(context, { origin_handover_id: MISSING }),
      );
      expect(origin).toEqual({
        code: "23503",
        constraint: "request_origin_handover_id_handover_id_fk",
      });
    });
  });

  describe("request_item", () => {
    it("grava os snapshots do cadastro; renomear o item depois não muda a linha", async () => {
      const context = await scenario();
      const created = await insertRequest(db, {
        sectorId: context.sector.id,
        createdBy: context.ana.id,
      });
      await insertRequestItem(db, {
        requestId: created.id,
        itemId: context.stock.id,
        quantity: 12,
      });
      await client.query("UPDATE item SET name = 'Outro nome' WHERE id = $1", [
        context.stock.id,
      ]);
      const [row] = await db.select().from(requestItem);
      expect(row).toMatchObject({
        itemNameSnapshot: "Rede de proteção",
        itemUnitSnapshot: "rolo",
        quantity: 12,
      });
    });

    it.each([
      ["zero", 0],
      ["negativa", -1],
    ])("recusa quantidade %s com 23514", async (_label, quantity) => {
      const context = await scenario();
      const created = await insertRequest(db, {
        sectorId: context.sector.id,
        createdBy: context.ana.id,
      });
      const failure = await sqlErrorOf(
        insertRequestItem(db, {
          requestId: created.id,
          itemId: context.stock.id,
          quantity,
        }),
      );
      expect(failure).toEqual({
        code: "23514",
        constraint: "request_item_quantity_positive",
      });
    });

    it("o teto fica no domínio: 100000 passa no banco", async () => {
      const context = await scenario();
      const created = await insertRequest(db, {
        sectorId: context.sector.id,
        createdBy: context.ana.id,
      });
      await insertRequestItem(db, {
        requestId: created.id,
        itemId: context.stock.id,
        quantity: 100_000,
      });
      const [row] = await db.select().from(requestItem);
      expect(row?.quantity).toBe(100_000);
    });

    it("recusa o mesmo item duas vezes na solicitação com 23505", async () => {
      const context = await scenario();
      const created = await insertRequest(db, {
        sectorId: context.sector.id,
        createdBy: context.ana.id,
      });
      await insertRequestItem(db, {
        requestId: created.id,
        itemId: context.stock.id,
      });
      const failure = await sqlErrorOf(
        insertRequestItem(db, {
          requestId: created.id,
          itemId: context.stock.id,
        }),
      );
      expect(failure).toEqual({
        code: "23505",
        constraint: "request_item_request_id_item_id_pk",
      });
    });
  });

  describe("request_status_event", () => {
    async function withRequest() {
      const context = await scenario();
      const created = await insertRequest(db, {
        sectorId: context.sector.id,
        createdBy: context.ana.id,
        events: false,
      });
      return { ...context, requestId: created.id };
    }

    async function rawEvent(
      requestId: string,
      userId: string,
      overrides: Record<string, string | null>,
    ) {
      const row: Record<string, string | null> = {
        request_id: requestId,
        from_status: "requested",
        to_status: "in_transit",
        changed_by: userId,
        changed_at: T1,
        ...overrides,
      };
      const columns = Object.keys(row);
      const marks = columns.map((_, index) => `$${index + 1}`).join(", ");
      return client.query(
        `INSERT INTO request_status_event (${columns.join(", ")}) VALUES (${marks})`,
        Object.values(row),
      );
    }

    it.each([
      [
        "from fora da lista",
        { from_status: "archived", to_status: "delivered" },
        "request_status_event_from_valid",
      ],
      [
        "to fora da lista",
        { from_status: "requested", to_status: "archived" },
        "request_status_event_to_valid",
      ],
      [
        "from igual a to",
        { from_status: "in_transit", to_status: "in_transit" },
        "request_status_event_changes",
      ],
      [
        "criação (from nulo) que não vai para requested",
        { from_status: null, to_status: "in_transit" },
        "request_status_event_creation_requested",
      ],
    ])("recusa %s com 23514", async (_label, overrides, constraint) => {
      const { requestId, ana } = await withRequest();
      const failure = await sqlErrorOf(rawEvent(requestId, ana.id, overrides));
      expect(failure).toEqual({ code: "23514", constraint });
    });

    it("aceita a criação (NULL → requested) e a reabertura (delivered → requested)", async () => {
      const { requestId, ana } = await withRequest();
      await rawEvent(requestId, ana.id, {
        from_status: null,
        to_status: "requested",
      });
      await rawEvent(requestId, ana.id, {
        from_status: "delivered",
        to_status: "requested",
      });
      expect(await db.select().from(requestStatusEvent)).toHaveLength(2);
    });

    it("seq cresce na ordem de inserção: o empate de changed_at sai por seq, nunca por id", async () => {
      const { requestId, ana, bia } = await withRequest();
      const at = new Date(T1);
      const kinds = [
        [null, "requested"],
        ["requested", "in_transit"],
        ["in_transit", "delivered"],
        ["delivered", "requested"],
      ] as const;
      for (const [from, to] of kinds) {
        await insertRequestEvent(db, {
          requestId,
          fromStatus: from,
          toStatus: to,
          changedBy: from === null ? ana.id : bia.id,
          changedAt: at,
        });
      }
      const rows = await db
        .select({
          to: requestStatusEvent.toStatus,
          seq: requestStatusEvent.seq,
        })
        .from(requestStatusEvent)
        .orderBy(
          asc(requestStatusEvent.changedAt),
          asc(requestStatusEvent.seq),
        );
      expect(rows.map((row) => row.to)).toEqual([
        "requested",
        "in_transit",
        "delivered",
        "requested",
      ]);
      const seqs = rows.map((row) => row.seq);
      expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
      expect(new Set(seqs).size).toBe(4);
    });

    it("recusa seq explícito com 428C9 (identity ALWAYS)", async () => {
      const { requestId, ana } = await withRequest();
      const failure = await sqlErrorOf(
        client.query(
          "INSERT INTO request_status_event (request_id, seq, from_status, to_status, changed_by) VALUES ($1, 99, NULL, 'requested', $2)",
          [requestId, ana.id],
        ),
      );
      expect(failure.code).toBe("428C9");
    });

    it("recusa solicitação e pessoa inexistentes com 23503", async () => {
      const { requestId, ana } = await withRequest();
      expect((await sqlErrorOf(rawEvent(MISSING, ana.id, {}))).code).toBe(
        "23503",
      );
      expect((await sqlErrorOf(rawEvent(requestId, "ninguem", {}))).code).toBe(
        "23503",
      );
    });
  });

  describe("request_comment", () => {
    async function withEvent() {
      const context = await scenario();
      const created = await insertRequest(db, {
        sectorId: context.sector.id,
        createdBy: context.ana.id,
      });
      const event = await insertRequestEvent(db, {
        requestId: created.id,
        fromStatus: "requested",
        toStatus: "cancelled",
        changedBy: context.bia.id,
      });
      return { ...context, requestId: created.id, eventId: event.id };
    }

    it("grava comentário comum: sem apagar, sem evento, createdAt Date", async () => {
      const { requestId, bia } = await withEvent();
      const created = await insertRequestComment(db, {
        requestId,
        authorId: bia.id,
      });
      const [row] = await db
        .select()
        .from(requestComment)
        .where(eq(requestComment.id, created.id));
      expect(row).toMatchObject({
        body: "Comentário de teste",
        deletedAt: null,
        statusEventId: null,
      });
      expect(row?.createdAt).toBeInstanceOf(Date);
    });

    it.each([
      ["vazio", ""],
      ["só com espaços", "   "],
      ["só com quebras de linha", "\n\n"],
    ])("recusa comentário %s com 23514", async (_label, body) => {
      const { requestId, bia } = await withEvent();
      const failure = await sqlErrorOf(
        insertRequestComment(db, { requestId, authorId: bia.id, body }),
      );
      expect(failure).toEqual({
        code: "23514",
        constraint: "request_comment_body_not_blank",
      });
    });

    it("recusa motivo de cancelamento com deleted_at, no INSERT e no UPDATE", async () => {
      const { requestId, bia, eventId } = await withEvent();
      const insert = await sqlErrorOf(
        client.query(
          "INSERT INTO request_comment (request_id, author_id, body, status_event_id, deleted_at) VALUES ($1, $2, 'Motivo', $3, now())",
          [requestId, bia.id, eventId],
        ),
      );
      expect(insert).toEqual({
        code: "23514",
        constraint: "request_comment_reason_not_deleted",
      });

      const reason = await insertRequestComment(db, {
        requestId,
        authorId: bia.id,
        body: "Motivo",
        statusEventId: eventId,
      });
      const update = await sqlErrorOf(
        client.query(
          "UPDATE request_comment SET deleted_at = now() WHERE id = $1",
          [reason.id],
        ),
      );
      expect(update).toEqual({
        code: "23514",
        constraint: "request_comment_reason_not_deleted",
      });
    });

    it("o comentário comum pode ser apagado por UPDATE de deleted_at", async () => {
      const { requestId, bia } = await withEvent();
      const created = await insertRequestComment(db, {
        requestId,
        authorId: bia.id,
      });
      await client.query(
        "UPDATE request_comment SET deleted_at = now() WHERE id = $1",
        [created.id],
      );
      const [row] = await db
        .select()
        .from(requestComment)
        .where(eq(requestComment.id, created.id));
      expect(row?.deletedAt).toBeInstanceOf(Date);
    });

    it("dois comentários no mesmo evento dão 23505; vários sem evento passam", async () => {
      const { requestId, bia, eventId } = await withEvent();
      await insertRequestComment(db, {
        requestId,
        authorId: bia.id,
        statusEventId: eventId,
      });
      const failure = await sqlErrorOf(
        insertRequestComment(db, {
          requestId,
          authorId: bia.id,
          statusEventId: eventId,
        }),
      );
      expect(failure).toEqual({
        code: "23505",
        constraint: "request_comment_status_event_uq",
      });
      await insertRequestComment(db, { requestId, authorId: bia.id });
      await insertRequestComment(db, { requestId, authorId: bia.id });
      expect(await db.select().from(requestComment)).toHaveLength(3);
    });

    it("recusa evento, solicitação e autor inexistentes com 23503", async () => {
      const { requestId, bia } = await withEvent();
      const event = await sqlErrorOf(
        insertRequestComment(db, {
          requestId,
          authorId: bia.id,
          statusEventId: MISSING,
        }),
      );
      expect(event.code).toBe("23503");
      const parent = await sqlErrorOf(
        insertRequestComment(db, { requestId: MISSING, authorId: bia.id }),
      );
      expect(parent.code).toBe("23503");
      const author = await sqlErrorOf(
        insertRequestComment(db, { requestId, authorId: "ninguem" }),
      );
      expect(author.code).toBe("23503");
    });
  });

  describe("FK restrict (23001)", () => {
    async function full() {
      const context = await scenario();
      const shift = await insertShift(db, { sectorId: context.sector.id });
      const origin = await insertHandover(db, {
        sectorId: context.sector.id,
        shiftId: shift.id,
      });
      const created = await insertRequest(db, {
        sectorId: context.sector.id,
        createdBy: context.ana.id,
        destinationId: context.destination.id,
        originHandoverId: origin.id,
        status: "cancelled",
        statusChangedBy: context.bia.id,
      });
      await insertRequestItem(db, {
        requestId: created.id,
        itemId: context.stock.id,
      });
      const [event] = await db
        .select({ id: requestStatusEvent.id })
        .from(requestStatusEvent)
        .where(eq(requestStatusEvent.toStatus, "cancelled"));
      return {
        ...context,
        requestId: created.id,
        originId: origin.id,
        eventId: event?.id ?? MISSING,
      };
    }

    it.each([
      ["sector", undefined],
      ["destination", "request_destination_id_destination_id_fk"],
      ["item", "request_item_item_id_item_id_fk"],
      ["handover", "request_origin_handover_id_handover_id_fk"],
      ["request", undefined],
      ["event", "request_comment_status_event_id_request_status_event_id_fk"],
    ] as const)("não apaga %s referenciado por solicitação", async (table, constraint) => {
      const context = await full();
      const target = {
        sector: ["sector", context.sector.id],
        destination: ["destination", context.destination.id],
        item: ["item", context.stock.id],
        handover: ["handover", context.originId],
        request: ["request", context.requestId],
        event: ["request_status_event", context.eventId],
      }[table];
      const failure = await sqlErrorOf(
        client.query(`DELETE FROM "${target[0]}" WHERE id = $1`, [target[1]]),
      );
      expect(failure.code).toBe("23001");
      expect(failure.constraint).toBeDefined();
      // Setor e solicitação têm vários filhos: o Postgres cita qualquer FK deles.
      if (constraint) expect(failure.constraint).toBe(constraint);
    });

    it("não apaga a pessoa que criou, moveu ou comentou", async () => {
      const context = await full();
      for (const userId of [context.ana.id, context.bia.id]) {
        const failure = await sqlErrorOf(
          client.query(`DELETE FROM "user" WHERE id = $1`, [userId]),
        );
        expect(failure.code).toBe("23001");
      }
    });
  });

  describe("fixtures", () => {
    it("insertRequest lança para estado impossível e não grava nada", async () => {
      const context = await scenario();
      const base = { sectorId: context.sector.id, createdBy: context.ana.id };
      const cases = [
        [
          {
            destinationId: context.destination.id,
            destinationOther: "Doca 9",
          },
          "destino é o da lista OU",
        ],
        [{ description: "   " }, "descrição não pode ser só espaços"],
        [
          {
            createdAt: new Date(T2),
            statusChangedAt: new Date(T1),
          },
          "statusChangedAt não pode ser anterior a createdAt",
        ],
        [
          { cancelReason: "Porque sim" },
          "cancelReason só vale com status cancelled",
        ],
        [
          {
            status: "delivered" as const,
            cancelReason: "Porque sim",
          },
          "cancelReason só vale com status cancelled",
        ],
        [
          {
            createdAt: new Date(T1),
            statusChangedAt: new Date(T2),
          },
          "não tem histórico",
        ],
      ] as const;
      for (const [input, message] of cases) {
        await expect(insertRequest(db, { ...base, ...input })).rejects.toThrow(
          message,
        );
      }
      expect(await db.select().from(request)).toHaveLength(0);
      expect(await db.select().from(requestStatusEvent)).toHaveLength(0);
    });

    it("insertRequest requested com datas diferentes passa com events: false", async () => {
      const context = await scenario();
      await insertRequest(db, {
        sectorId: context.sector.id,
        createdBy: context.ana.id,
        createdAt: new Date(T1),
        statusChangedAt: new Date(T2),
        events: false,
      });
      expect(await db.select().from(requestStatusEvent)).toHaveLength(0);
    });

    it("sem destino usa o texto do Outro padrão; só statusChangedAt vale também para createdAt", async () => {
      const context = await scenario();
      const created = await insertRequest(db, {
        sectorId: context.sector.id,
        createdBy: context.ana.id,
        statusChangedAt: new Date(T2),
        status: "in_transit",
      });
      const [row] = await db
        .select()
        .from(request)
        .where(eq(request.id, created.id));
      expect(row?.destinationOther).toBe("Destino Teste");
      expect(row?.destinationId).toBeNull();
      expect(row?.createdAt.toISOString()).toBe("2026-11-21T12:00:00.000Z");
      expect(row?.statusChangedAt.toISOString()).toBe(
        "2026-11-21T12:00:00.000Z",
      );
    });

    it("o padrão de datas é 2026-11-20T12:00:00Z", async () => {
      const context = await scenario();
      const created = await insertRequest(db, {
        sectorId: context.sector.id,
        createdBy: context.ana.id,
      });
      const [row] = await db
        .select()
        .from(request)
        .where(eq(request.id, created.id));
      expect(row?.createdAt.toISOString()).toBe("2026-11-20T12:00:00.000Z");
      expect(row?.statusChangedAt.toISOString()).toBe(
        "2026-11-20T12:00:00.000Z",
      );
    });

    it("insertRequest grava os eventos na ordem, mesmo com o mesmo instante", async () => {
      const context = await scenario();
      const created = await insertRequest(db, {
        sectorId: context.sector.id,
        createdBy: context.ana.id,
        status: "in_transit",
        statusChangedBy: context.bia.id,
      });
      const rows = await db
        .select()
        .from(requestStatusEvent)
        .where(eq(requestStatusEvent.requestId, created.id))
        .orderBy(
          asc(requestStatusEvent.changedAt),
          asc(requestStatusEvent.seq),
        );
      expect(rows.map((row) => [row.fromStatus, row.toStatus])).toEqual([
        [null, "requested"],
        ["requested", "in_transit"],
      ]);
      expect(rows.map((row) => row.changedBy)).toEqual([
        context.ana.id,
        context.bia.id,
      ]);
      expect(rows[0]?.changedAt.getTime()).toBe(rows[1]?.changedAt.getTime());
    });

    it("insertRequest cancelada grava o evento e o comentário ligado a ele", async () => {
      const context = await scenario();
      const created = await insertRequest(db, {
        sectorId: context.sector.id,
        createdBy: context.ana.id,
        status: "cancelled",
        statusChangedBy: context.bia.id,
        cancelReason: "Pedido em duplicidade",
      });
      const comments = await db
        .select()
        .from(requestComment)
        .where(eq(requestComment.requestId, created.id));
      expect(comments).toHaveLength(1);
      expect(comments[0]).toMatchObject({
        body: "Pedido em duplicidade",
        authorId: context.bia.id,
        deletedAt: null,
      });
      const [cancel] = await db
        .select()
        .from(requestStatusEvent)
        .where(eq(requestStatusEvent.toStatus, "cancelled"));
      expect(comments[0]?.statusEventId).toBe(cancel?.id);

      const defaults = await insertRequest(db, {
        sectorId: context.sector.id,
        createdBy: context.ana.id,
        status: "cancelled",
      });
      const [fallback] = await db
        .select()
        .from(requestComment)
        .where(eq(requestComment.requestId, defaults.id));
      expect(fallback?.body).toBe("Motivo de teste");
    });

    it("insertRequestItem, insertRequestEvent e insertRequestComment lançam para estado impossível", async () => {
      const context = await scenario();
      const created = await insertRequest(db, {
        sectorId: context.sector.id,
        createdBy: context.ana.id,
      });
      await expect(
        insertRequestItem(db, { requestId: created.id, itemId: MISSING }),
      ).rejects.toThrow("item do snapshot não existe");
      await expect(
        insertRequestEvent(db, {
          requestId: created.id,
          fromStatus: "delivered",
          toStatus: "delivered",
          changedBy: context.ana.id,
        }),
      ).rejects.toThrow("from = to");
      const event = await insertRequestEvent(db, {
        requestId: created.id,
        fromStatus: "requested",
        toStatus: "cancelled",
        changedBy: context.ana.id,
      });
      await expect(
        insertRequestComment(db, {
          requestId: created.id,
          authorId: context.ana.id,
          statusEventId: event.id,
          deletedAt: new Date(T1),
        }),
      ).rejects.toThrow("o motivo de cancelamento não se apaga");
    });
  });
});
