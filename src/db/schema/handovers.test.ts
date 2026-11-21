import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverCorrection,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { sqlErrorOf } from "../../../test/sqlError";
import { handover, handoverCorrection, handoverItem } from "./handovers";

const STATE = "handover_state_consistent";
const T1 = "2026-11-20T17:00:00Z";
const T2 = "2026-11-20T18:00:00Z";
const MISSING = "00000000-0000-4000-8000-000000000000";

describe("tabelas da passagem", () => {
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
    const shift = await insertShift(db, { sectorId: sector.id });
    const item = await insertItem(db, { sectorId: sector.id });
    const role = "operator";
    const ana = await insertUser(db, { role, sectorId: sector.id });
    const bia = await insertUser(db, { role, sectorId: sector.id });
    const base = { sectorId: sector.id, shiftId: shift.id };
    return { sector, shift, item, ana, bia, base };
  }

  // SQL cru, para montar estados que o tipo do Drizzle e as fixtures não
  // deixam passar. "$ana" e "$bia" viram os ids das duas pessoas.
  async function rawHandover(
    extra: Record<string, string>,
    context?: Awaited<ReturnType<typeof scenario>>,
  ) {
    const { base, ana, bia } = context ?? (await scenario());
    const ids: Record<string, string> = { $ana: ana.id, $bia: bia.id };
    const row: Record<string, string> = {
      sector_id: base.sectorId,
      shift_id: base.shiftId,
      operational_date: "2026-11-20",
      ...Object.fromEntries(
        Object.entries(extra).map(([key, value]) => [key, ids[value] ?? value]),
      ),
    };
    const columns = Object.keys(row);
    const marks = columns.map((_, index) => `$${index + 1}`).join(", ");
    return client.query(
      `INSERT INTO handover (${columns.join(", ")}) VALUES (${marks})`,
      Object.values(row),
    );
  }

  describe("handover", () => {
    it("grava com os padrões: rascunho, textos vazios, dia como texto", async () => {
      const { base } = await scenario();
      const created = await insertHandover(db, base);
      const [row] = await db
        .select()
        .from(handover)
        .where(eq(handover.id, created.id));
      expect(row).toMatchObject({
        status: "draft",
        occurrencesText: "",
        nextShiftText: "",
        operationalDate: "2026-11-20",
        deliveredBy: null,
        updatedBy: null,
      });
      expect(row?.updatedAt).toBeInstanceOf(Date);
    });

    it.each([
      ["entregue sem delivered_by", { status: "delivered", delivered_at: T1 }],
      [
        "entregue sem delivered_at",
        { status: "delivered", delivered_by: "$ana" },
      ],
      ["rascunho com confirmed_by", { confirmed_by: "$bia" }],
      ["rascunho com delivered_by", { delivered_by: "$ana" }],
      [
        "entregue que já tem confirmação",
        {
          status: "delivered",
          delivered_by: "$ana",
          delivered_at: T1,
          confirmed_by: "$bia",
          confirmed_at: T2,
        },
      ],
      [
        "confirmada sem confirmed_at",
        {
          status: "confirmed",
          delivered_by: "$ana",
          delivered_at: T1,
          confirmed_by: "$bia",
        },
      ],
    ])("recusa %s com 23514 (state_consistent)", async (_label, extra) => {
      const failure = await sqlErrorOf(rawHandover(extra));
      expect(failure).toEqual({ code: "23514", constraint: STATE });
    });

    it("recusa status fora da lista com 23514 (e handover_status_valid existe)", async () => {
      const failure = await sqlErrorOf(rawHandover({ status: "archived" }));
      // O Postgres reporta o primeiro CHECK que falha, em ordem de nome:
      // state_consistent vem antes de status_valid, e os dois recusam.
      expect(failure.code).toBe("23514");
      expect([STATE, "handover_status_valid"]).toContain(failure.constraint);
      const { rows } = await client.query(
        "SELECT 1 FROM pg_constraint WHERE conname = 'handover_status_valid'",
      );
      expect(rows).toHaveLength(1);
    });

    it("recusa quem confirmou = quem entregou com 23514, no INSERT e no UPDATE", async () => {
      const constraint = "handover_confirmer_ne_deliverer";
      const context = await scenario();
      const { base, ana } = context;
      const insert = await sqlErrorOf(
        rawHandover(
          {
            status: "confirmed",
            delivered_by: "$ana",
            delivered_at: T1,
            confirmed_by: "$ana",
            confirmed_at: T2,
          },
          context,
        ),
      );
      expect(insert).toEqual({ code: "23514", constraint });

      const created = await insertHandover(db, {
        ...base,
        status: "delivered",
        deliveredBy: ana.id,
      });
      const update = await sqlErrorOf(
        client.query(
          "UPDATE handover SET status = 'confirmed', confirmed_by = $2, confirmed_at = now() WHERE id = $1",
          [created.id, ana.id],
        ),
      );
      expect(update).toEqual({ code: "23514", constraint });
    });

    it("aceita as três combinações válidas; repetir a tripla dá 23505", async () => {
      const { base, ana, bia } = await scenario();
      await insertHandover(db, { ...base, operationalDate: "2026-11-18" });
      await insertHandover(db, {
        ...base,
        operationalDate: "2026-11-19",
        status: "delivered",
        deliveredBy: ana.id,
      });
      await insertHandover(db, {
        ...base,
        status: "confirmed",
        deliveredBy: ana.id,
        confirmedBy: bia.id,
      });
      const rows = await db.select({ status: handover.status }).from(handover);
      expect(rows.map((row) => row.status).sort()).toEqual([
        "confirmed",
        "delivered",
        "draft",
      ]);
      const failure = await sqlErrorOf(insertHandover(db, base));
      expect(failure).toEqual({
        code: "23505",
        constraint: "handover_sector_shift_date_uq",
      });
    });

    it("ON CONFLICT DO NOTHING RETURNING devolve a linha na 1ª vez e [] na 2ª", async () => {
      const { base } = await scenario();
      const insert = () =>
        db
          .insert(handover)
          .values({ ...base, operationalDate: "2026-11-20" })
          .onConflictDoNothing()
          .returning({ id: handover.id });
      expect(await insert()).toHaveLength(1);
      expect(await insert()).toEqual([]);
    });

    it("SELECT … FOR UPDATE devolve o dia como texto e updatedAt como Date", async () => {
      const { base } = await scenario();
      const created = await insertHandover(db, base);
      const rows = await db.transaction((tx) =>
        tx
          .select()
          .from(handover)
          .where(eq(handover.id, created.id))
          .for("update"),
      );
      expect(rows[0]?.operationalDate).toBe("2026-11-20");
      expect(rows[0]?.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("handover_item", () => {
    async function withHandover() {
      const context = await scenario();
      const created = await insertHandover(db, context.base);
      return { ...context, handoverId: created.id };
    }

    it("quantidade começa em 0, observação nula; snapshot: true copia o item", async () => {
      const { handoverId, item, sector } = await withHandover();
      await insertHandoverItem(db, { handoverId, itemId: item.id });
      const stock = await insertItem(db, {
        sectorId: sector.id,
        name: "Rede de proteção",
        unit: "rolo",
        kind: "stock",
      });
      await insertHandoverItem(db, {
        handoverId,
        itemId: stock.id,
        quantity: 3,
        snapshot: true,
      });
      const rows = await db.select().from(handoverItem);
      expect(rows.find((row) => row.itemId === item.id)).toMatchObject({
        quantity: 0,
        note: null,
        itemNameSnapshot: null,
      });
      expect(rows.find((row) => row.itemId === stock.id)).toMatchObject({
        quantity: 3,
        itemNameSnapshot: "Rede de proteção",
        itemUnitSnapshot: "rolo",
        itemKindSnapshot: "stock",
      });
    });

    it("aceita quantidade grande e recusa -1 com 23514", async () => {
      const { handoverId, item, sector } = await withHandover();
      await insertHandoverItem(db, {
        handoverId,
        itemId: item.id,
        quantity: 2_147_483_647,
      });
      const other = await insertItem(db, { sectorId: sector.id });
      const failure = await sqlErrorOf(
        insertHandoverItem(db, {
          handoverId,
          itemId: other.id,
          quantity: -1,
        }),
      );
      expect(failure).toEqual({
        code: "23514",
        constraint: "handover_item_quantity_nonneg",
      });
    });

    it("recusa tipo de snapshot inválido com 23514", async () => {
      const { handoverId, item } = await withHandover();
      const failure = await sqlErrorOf(
        client.query(
          "INSERT INTO handover_item (handover_id, item_id, item_kind_snapshot) VALUES ($1, $2, 'misto')",
          [handoverId, item.id],
        ),
      );
      expect(failure).toEqual({
        code: "23514",
        constraint: "handover_item_kind_snapshot_valid",
      });
    });

    it("recusa o mesmo item duas vezes com 23505; o upsert troca a quantidade", async () => {
      const { handoverId, item } = await withHandover();
      await insertHandoverItem(db, { handoverId, itemId: item.id });
      const failure = await sqlErrorOf(
        insertHandoverItem(db, { handoverId, itemId: item.id }),
      );
      expect(failure).toEqual({
        code: "23505",
        constraint: "handover_item_handover_id_item_id_pk",
      });
      await db
        .insert(handoverItem)
        .values({ handoverId, itemId: item.id, quantity: 7 })
        .onConflictDoUpdate({
          target: [handoverItem.handoverId, handoverItem.itemId],
          set: { quantity: 7 },
        });
      const rows = await db.select().from(handoverItem);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.quantity).toBe(7);
    });

    it("recusa item inexistente com 23503", async () => {
      const { handoverId } = await withHandover();
      const failure = await sqlErrorOf(
        insertHandoverItem(db, { handoverId, itemId: MISSING }),
      );
      expect(failure.code).toBe("23503");
    });
  });

  describe("handover_correction", () => {
    async function confirmed() {
      const context = await scenario();
      const created = await insertHandover(db, {
        ...context.base,
        status: "confirmed",
        deliveredBy: context.ana.id,
        confirmedBy: context.bia.id,
      });
      return { ...context, handoverId: created.id };
    }

    it("grava correção de item e de texto (inclusive valor antigo vazio)", async () => {
      const { handoverId, item, bia } = await confirmed();
      await insertHandoverCorrection(db, {
        handoverId,
        field: "item_quantity",
        itemId: item.id,
        oldValue: "3",
        newValue: "4",
        correctedBy: bia.id,
      });
      await insertHandoverCorrection(db, {
        handoverId,
        field: "next_shift_text",
        oldValue: "",
        newValue: "Conferir a rede",
        correctedBy: bia.id,
      });
      const rows = await db.select().from(handoverCorrection);
      expect(rows).toHaveLength(2);
      expect(rows[0]?.correctedAt).toBeInstanceOf(Date);
      expect(rows.some((row) => row.oldValue === "")).toBe(true);
    });

    it.each([
      [
        "campo de item sem item_id",
        "'item_quantity', NULL, 'Motivo'",
        "item_matches_field",
      ],
      [
        "campo de texto com item_id",
        "'next_shift_text', $3, 'Motivo'",
        "item_matches_field",
      ],
      ["campo fora da lista", "'status', NULL, 'Motivo'", "field_valid"],
      [
        "motivo só com espaços",
        "'occurrences_text', NULL, '   '",
        "reason_not_blank",
      ],
      ["motivo vazio", "'occurrences_text', NULL, ''", "reason_not_blank"],
    ])("recusa %s com 23514", async (_label, values, suffix) => {
      const { handoverId, item, bia } = await confirmed();
      const failure = await sqlErrorOf(
        client.query(
          `INSERT INTO handover_correction (handover_id, corrected_by, field, item_id, reason, old_value, new_value) VALUES ($1, $2, ${values.replace("$3", `'${item.id}'`)}, 'a', 'b')`,
          [handoverId, bia.id],
        ),
      );
      expect(failure).toEqual({
        code: "23514",
        constraint: `handover_correction_${suffix}`,
      });
    });
  });

  describe("FK restrict (23001)", () => {
    async function delivered() {
      const context = await scenario();
      const created = await insertHandover(db, {
        ...context.base,
        status: "delivered",
        deliveredBy: context.ana.id,
      });
      await insertHandoverItem(db, {
        handoverId: created.id,
        itemId: context.item.id,
      });
      return { ...context, handoverId: created.id };
    }

    it.each([
      ["shift", "handover_shift_id_shift_id_fk"],
      ["item", "handover_item_item_id_item_id_fk"],
      ["sector", undefined],
      ["user", "handover_delivered_by_user_id_fk"],
      ["handover", "handover_item_handover_id_handover_id_fk"],
    ] as const)("não apaga %s referenciado por passagem", async (table, constraint) => {
      const context = await delivered();
      const ids = {
        shift: context.shift.id,
        item: context.item.id,
        sector: context.sector.id,
        user: context.ana.id,
        handover: context.handoverId,
      };
      const failure = await sqlErrorOf(
        client.query(`DELETE FROM "${table}" WHERE id = $1`, [ids[table]]),
      );
      expect(failure.code).toBe("23001");
      if (constraint) expect(failure.constraint).toBe(constraint);
    });

    it("não apaga quem corrigiu nem a passagem que tem correção", async () => {
      const { handoverId, bia } = await delivered();
      await insertHandoverCorrection(db, {
        handoverId,
        field: "occurrences_text",
        correctedBy: bia.id,
      });
      const user = await sqlErrorOf(
        client.query(`DELETE FROM "user" WHERE id = $1`, [bia.id]),
      );
      expect(user.constraint).toBe(
        "handover_correction_corrected_by_user_id_fk",
      );
      await client.query("DELETE FROM handover_item");
      const parent = await sqlErrorOf(
        client.query("DELETE FROM handover WHERE id = $1", [handoverId]),
      );
      expect(parent.constraint).toBe(
        "handover_correction_handover_id_handover_id_fk",
      );
    });
  });

  describe("fixtures", () => {
    it("insertHandover lança para estado impossível e usa datas padrão", async () => {
      const { base, ana, bia } = await scenario();
      const confirmedBase = { ...base, status: "confirmed" as const };
      const cases = [
        [{ status: "delivered" as const }, "exige deliveredBy"],
        [{ ...confirmedBase, deliveredBy: ana.id }, "exige confirmedBy"],
        [
          { ...confirmedBase, deliveredBy: ana.id, confirmedBy: ana.id },
          "quem entregou não confirma",
        ],
        [{ deliveredBy: ana.id }, "rascunho não tem entrega"],
        [{ confirmedBy: bia.id }, "rascunho não tem confirmação"],
        [
          {
            status: "delivered" as const,
            deliveredBy: ana.id,
            confirmedBy: bia.id,
          },
          "entregue não tem confirmação",
        ],
      ] as const;
      for (const [input, message] of cases) {
        await expect(insertHandover(db, { ...base, ...input })).rejects.toThrow(
          message,
        );
      }
      expect(await db.select().from(handover)).toHaveLength(0);

      const created = await insertHandover(db, {
        ...confirmedBase,
        deliveredBy: ana.id,
        confirmedBy: bia.id,
      });
      const [row] = await db
        .select()
        .from(handover)
        .where(eq(handover.id, created.id));
      expect(row?.deliveredAt?.toISOString()).toBe("2026-11-20T17:00:00.000Z");
      expect(row?.confirmedAt?.toISOString()).toBe("2026-11-20T18:00:00.000Z");
    });

    it("insertHandoverItem e insertHandoverCorrection lançam para estado impossível", async () => {
      const { base, item, bia } = await scenario();
      const { id } = await insertHandover(db, base);
      await expect(
        insertHandoverItem(db, {
          handoverId: id,
          itemId: MISSING,
          snapshot: true,
        }),
      ).rejects.toThrow("item do snapshot não existe");
      await expect(
        insertHandoverCorrection(db, {
          handoverId: id,
          field: "item_note",
          correctedBy: bia.id,
        }),
      ).rejects.toThrow("exige itemId");
      await expect(
        insertHandoverCorrection(db, {
          handoverId: id,
          field: "occurrences_text",
          itemId: item.id,
          correctedBy: bia.id,
        }),
      ).rejects.toThrow("não aceita itemId");
    });

    it("insertShift aceita createdAt (turno antigo)", async () => {
      const { sector } = await scenario();
      const created = await insertShift(db, {
        sectorId: sector.id,
        createdAt: new Date("2026-01-05T12:00:00Z"),
      });
      const { rows } = await client.query<{ created_at: string }>(
        "SELECT created_at FROM shift WHERE id = $1",
        [created.id],
      );
      expect(new Date(rows[0]?.created_at ?? "").toISOString()).toBe(
        "2026-01-05T12:00:00.000Z",
      );
    });
  });
});
