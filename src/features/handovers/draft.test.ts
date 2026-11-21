import type { PGlite } from "@electric-sql/pglite";
import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { item, shift } from "@/db/schema/catalog";
import {
  handover,
  handoverCorrection,
  handoverItem,
} from "@/db/schema/handovers";

import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { saveHandoverField } from "./draft";
import type { FieldChange, SaveFieldInput } from "./types";

const NOW = spDate("2026-11-21", "14:05");
const LATER = spDate("2026-11-21", "14:20");
const DAY = "2026-11-21";

describe("saveHandoverField", () => {
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

  async function world() {
    const sector = await insertSector(db, "ULD");
    const turno = await insertShift(db, { sectorId: sector.id, name: "Manhã" });
    const rede = await insertItem(db, {
      sectorId: sector.id,
      name: "Rede de proteção",
      kind: "control",
    });
    const rolo = await insertItem(db, {
      sectorId: sector.id,
      name: "Rolo de fita",
      kind: "stock",
    });
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
    const ref = {
      sectorId: sector.id,
      shiftId: turno.id,
      operationalDate: DAY,
    };
    const operatorAna = authzOf({
      role: "operator",
      sectorId: sector.id,
      userId: ana.id,
      name: "Ana Teste",
    });
    const operatorBia = authzOf({
      role: "operator",
      sectorId: sector.id,
      userId: bia.id,
      name: "Bia Teste",
    });
    const adminUser = await insertUser(db, {
      role: "admin",
      sectorId: null,
      name: "Admin",
    });
    const admin = authzOf({
      role: "admin",
      userId: adminUser.id,
      name: "Admin",
    });
    return {
      sector,
      turno,
      rede,
      rolo,
      ana,
      bia,
      ref,
      operatorAna,
      operatorBia,
      admin,
    };
  }

  async function counts() {
    const [h] = await db.select({ total: count() }).from(handover);
    const [i] = await db.select({ total: count() }).from(handoverItem);
    const [c] = await db.select({ total: count() }).from(handoverCorrection);
    return {
      handovers: h?.total ?? 0,
      items: i?.total ?? 0,
      corrections: c?.total ?? 0,
    };
  }

  async function onlyHandover() {
    const [row] = await db.select().from(handover);
    if (!row) throw new Error("passagem ausente");
    return row;
  }

  describe("criação e reaproveitamento do rascunho", () => {
    it("o primeiro salvamento cria o rascunho e devolve id, hora e nome; o segundo reaproveita (uma linha só)", async () => {
      const { ref, operatorAna } = await world();

      const first = await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "occurrences", value: "Chuva forte" },
        NOW,
      );
      const second = await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "nextShift", value: "Conferir a doca" },
        LATER,
      );

      expect(first).toEqual({
        ok: true,
        handoverId: expect.any(String),
        savedAt: NOW,
        savedByName: "Ana Teste",
      });
      expect(second).toMatchObject({ ok: true, savedAt: LATER });
      if (first.ok && second.ok) {
        expect(second.handoverId).toBe(first.handoverId);
      }
      expect((await counts()).handovers).toBe(1);
      const row = await onlyHandover();
      expect(row).toMatchObject({
        status: "draft",
        occurrencesText: "Chuva forte",
        nextShiftText: "Conferir a doca",
        updatedBy: operatorAna.userId,
        deliveredBy: null,
      });
      expect(row.updatedAt.toISOString()).toBe(LATER.toISOString());
    });

    it("dois operadores no mesmo rascunho: cada campo guarda o último a salvar", async () => {
      const { ref, operatorAna, operatorBia } = await world();

      await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "occurrences", value: "versão da Ana" },
        NOW,
      );
      await saveHandoverField(
        db,
        operatorBia,
        { ...ref, field: "occurrences", value: "versão da Bia" },
        LATER,
      );
      await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "nextShift", value: "só da Ana" },
        LATER,
      );

      const row = await onlyHandover();
      expect(row).toMatchObject({
        occurrencesText: "versão da Bia",
        nextShiftText: "só da Ana",
        updatedBy: operatorAna.userId,
      });
      expect((await counts()).handovers).toBe(1);
    });

    it("o admin também salva (qualquer setor)", async () => {
      const { ref, admin } = await world();

      const result = await saveHandoverField(
        db,
        admin,
        { ...ref, field: "occurrences", value: "feito pelo admin" },
        NOW,
      );

      expect(result).toMatchObject({ ok: true, savedByName: "Admin" });
    });
  });

  describe("campos", () => {
    it("quantidade cria a linha do item; o segundo valor atualiza a mesma linha", async () => {
      const { ref, operatorAna, rede } = await world();
      const save = (value: number) =>
        saveHandoverField(
          db,
          operatorAna,
          { ...ref, field: "quantity", itemId: rede.id, value },
          NOW,
        );

      expect(await save(5)).toMatchObject({ ok: true });
      expect(await save(8)).toMatchObject({ ok: true });
      expect(await save(0)).toMatchObject({ ok: true });

      const lines = await db.select().from(handoverItem);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({ itemId: rede.id, quantity: 0 });
    });

    it("quantidade no teto passa; observação guarda o texto limpo e '' vira sem observação", async () => {
      const { ref, operatorAna, rede } = await world();

      await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "quantity", itemId: rede.id, value: 99_999 },
        NOW,
      );
      await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "note", itemId: rede.id, value: "  duas   rasgadas " },
        NOW,
      );
      let [line] = await db.select().from(handoverItem);
      expect(line).toMatchObject({ quantity: 99_999, note: "duas rasgadas" });

      await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "note", itemId: rede.id, value: "   " },
        NOW,
      );
      [line] = await db.select().from(handoverItem);
      expect(line).toMatchObject({ quantity: 99_999, note: null });
    });

    it("observação sozinha cria a linha com quantidade 0", async () => {
      const { ref, operatorAna, rolo } = await world();

      await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "note", itemId: rolo.id, value: "caixa molhada" },
        NOW,
      );

      const [line] = await db.select().from(handoverItem);
      expect(line).toMatchObject({ quantity: 0, note: "caixa molhada" });
    });

    it("texto livre é guardado como digitado: NFC, quebra de linha normalizada, sem trim", async () => {
      const { ref, operatorAna } = await world();

      await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "occurrences", value: "  e\u{301}\r\nlinha 2  " },
        NOW,
      );

      expect((await onlyHandover()).occurrencesText).toBe(
        "  \u{e9}\nlinha 2  ",
      );
    });

    it("texto vazio apaga o campo", async () => {
      const { ref, operatorAna } = await world();
      await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "nextShift", value: "algo" },
        NOW,
      );

      await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "nextShift", value: "" },
        NOW,
      );

      expect((await onlyHandover()).nextShiftText).toBe("");
    });

    it("texto com 2.000 pontos de código passa", async () => {
      const { ref, operatorAna } = await world();

      const result = await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "occurrences", value: "😀".repeat(2000) },
        NOW,
      );

      expect(result).toMatchObject({ ok: true });
    });
  });

  describe("entrada inválida (revalidada no servidor) não cria nada", () => {
    const invalid: [string, FieldChange][] = [
      ["quantidade negativa", { field: "quantity", itemId: "", value: -1 }],
      ["quantidade decimal", { field: "quantity", itemId: "", value: 1.5 }],
      [
        "quantidade acima do teto",
        { field: "quantity", itemId: "", value: 100_000 },
      ],
      [
        "texto de 2.001 pontos de código",
        { field: "occurrences", value: "😀".repeat(2001) },
      ],
      [
        "observação de 201 caracteres",
        { field: "note", itemId: "", value: "a".repeat(201) },
      ],
    ];

    it.each(
      invalid,
    )("%s → INVALID_INPUT em value, sem rascunho", async (_name, change) => {
      const { ref, operatorAna, rede } = await world();
      // O itemId real entra aqui; a tabela só descreve o valor inválido.
      const input: SaveFieldInput =
        change.field === "quantity" || change.field === "note"
          ? { ...ref, ...change, itemId: rede.id }
          : { ...ref, ...change };

      const result = await saveHandoverField(db, operatorAna, input, NOW);

      expect(result).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { value: expect.any(String) },
      });
      expect(await counts()).toEqual({
        handovers: 0,
        items: 0,
        corrections: 0,
      });
    });
  });

  describe("escopo e permissão", () => {
    it("operador de outro setor: NOT_FOUND, nada criado", async () => {
      const { ref } = await world();
      const otherSector = await insertSector(db, "Outro");
      const stranger = authzOf({ role: "operator", sectorId: otherSector.id });

      const result = await saveHandoverField(
        db,
        stranger,
        { ...ref, field: "occurrences", value: "invasão" },
        NOW,
      );

      expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
      expect((await counts()).handovers).toBe(0);
    });

    it("item de outro setor e item inexistente: NOT_FOUND, e o rascunho recém-criado é desfeito", async () => {
      const { ref, operatorAna } = await world();
      const otherSector = await insertSector(db, "Outro");
      const foreign = await insertItem(db, { sectorId: otherSector.id });

      for (const itemId of [
        foreign.id,
        "00000000-0000-4000-8000-000000000000",
      ]) {
        const result = await saveHandoverField(
          db,
          operatorAna,
          { ...ref, field: "quantity", itemId, value: 3 },
          NOW,
        );
        expect(result).toMatchObject({
          ok: false,
          code: "NOT_FOUND",
          message: "Item não encontrado. Atualize a página.",
        });
      }
      expect(await counts()).toEqual({
        handovers: 0,
        items: 0,
        corrections: 0,
      });
    });

    it("item inativo não entra em rascunho: NOT_FOUND", async () => {
      const { ref, operatorAna, rede } = await world();
      await db.update(item).set({ active: false }).where(eq(item.id, rede.id));

      const result = await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "quantity", itemId: rede.id, value: 3 },
        NOW,
      );

      expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
      expect((await counts()).items).toBe(0);
    });

    it("entregue: só quem entregou e o admin salvam; outra pessoa do setor recebe FORBIDDEN; nunca gera linha de correção", async () => {
      const { sector, turno, ref, ana, rede, operatorAna, operatorBia, admin } =
        await world();
      const delivered = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: DAY,
        status: "delivered",
        deliveredBy: ana.id,
      });
      await insertHandoverItem(db, {
        handoverId: delivered.id,
        itemId: rede.id,
        quantity: 2,
        snapshot: true,
      });
      const change = (value: number): SaveFieldInput => ({
        ...ref,
        field: "quantity",
        itemId: rede.id,
        value,
      });

      expect(await saveHandoverField(db, operatorBia, change(9), NOW)).toEqual({
        ok: false,
        code: "FORBIDDEN",
        message:
          "Só quem entregou o turno ou um administrador pode editar esta passagem.",
      });
      expect((await db.select().from(handoverItem))[0]?.quantity).toBe(2);

      expect(
        await saveHandoverField(db, operatorAna, change(5), NOW),
      ).toMatchObject({
        ok: true,
      });
      expect((await db.select().from(handoverItem))[0]?.quantity).toBe(5);
      expect(
        await saveHandoverField(db, admin, change(6), LATER),
      ).toMatchObject({
        ok: true,
      });
      expect((await db.select().from(handoverItem))[0]?.quantity).toBe(6);
      expect((await counts()).corrections).toBe(0);
      expect((await onlyHandover()).status).toBe("delivered");
    });

    it("entregue: o texto também salva direto, e item sem linha na passagem é NOT_FOUND", async () => {
      const { sector, turno, ref, ana, rolo, operatorAna } = await world();
      await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: DAY,
        status: "delivered",
        deliveredBy: ana.id,
      });

      const text = await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "nextShift", value: "corrigido na hora" },
        NOW,
      );
      const missingLine = await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "quantity", itemId: rolo.id, value: 1 },
        NOW,
      );

      expect(text).toMatchObject({ ok: true });
      expect((await onlyHandover()).nextShiftText).toBe("corrigido na hora");
      expect(missingLine).toMatchObject({ ok: false, code: "NOT_FOUND" });
      expect((await counts()).items).toBe(0);
    });

    it("confirmada: HANDOVER_LOCKED para operador E para admin; nada muda", async () => {
      const { sector, turno, ref, ana, bia, operatorAna, operatorBia, admin } =
        await world();
      await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: DAY,
        status: "confirmed",
        deliveredBy: ana.id,
        confirmedBy: bia.id,
        occurrencesText: "original",
      });

      for (const actor of [operatorAna, operatorBia, admin]) {
        const result = await saveHandoverField(
          db,
          actor,
          { ...ref, field: "occurrences", value: "adulterado" },
          NOW,
        );
        expect(result).toEqual({
          ok: false,
          code: "HANDOVER_LOCKED",
          message:
            "Esta passagem já foi confirmada. Só um administrador corrige, com motivo.",
        });
      }
      expect((await onlyHandover()).occurrencesText).toBe("original");
      expect((await counts()).corrections).toBe(0);
    });
  });

  describe("regras de criação (só ao criar)", () => {
    it("data futura, de 32 dias atrás e lixo: DATE_OUT_OF_RANGE, nada criado; 31 dias atrás passa", async () => {
      const { ref, operatorAna } = await world();
      const save = (operationalDate: string) =>
        saveHandoverField(
          db,
          operatorAna,
          { ...ref, operationalDate, field: "occurrences", value: "x" },
          NOW,
        );

      for (const operationalDate of [
        "2026-11-22",
        "2026-10-20",
        "2026-02-30",
      ]) {
        expect(await save(operationalDate)).toMatchObject({
          ok: false,
          code: "DATE_OUT_OF_RANGE",
        });
      }
      expect((await counts()).handovers).toBe(0);
      expect(await save("2026-10-21")).toMatchObject({ ok: true });
    });

    it("turno inativo ao criar: SHIFT_INACTIVE", async () => {
      const { ref, operatorAna, turno } = await world();
      await db
        .update(shift)
        .set({ active: false })
        .where(eq(shift.id, turno.id));

      const result = await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "occurrences", value: "x" },
        NOW,
      );

      expect(result).toMatchObject({ ok: false, code: "SHIFT_INACTIVE" });
      expect((await counts()).handovers).toBe(0);
    });

    it("rascunho que já existe continua salvando mesmo com turno inativo e data antiga", async () => {
      const { sector, turno, ref, operatorAna } = await world();
      await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: "2026-09-01",
      });
      await db
        .update(shift)
        .set({ active: false })
        .where(eq(shift.id, turno.id));

      const result = await saveHandoverField(
        db,
        operatorAna,
        {
          ...ref,
          operationalDate: "2026-09-01",
          field: "occurrences",
          value: "ainda vale",
        },
        NOW,
      );

      expect(result).toMatchObject({ ok: true });
      expect((await onlyHandover()).occurrencesText).toBe("ainda vale");
    });

    it("rascunho existente de setor inativo: SECTOR_INACTIVE e nada muda (setor inativo é só leitura, P26)", async () => {
      const { sector, turno, ref, operatorAna } = await world();
      await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: ref.operationalDate,
      });
      await client.query("update sector set active = false where id = $1", [
        sector.id,
      ]);

      const result = await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "occurrences", value: "x" },
        NOW,
      );

      expect(result).toMatchObject({ ok: false, code: "SECTOR_INACTIVE" });
      expect((await onlyHandover()).occurrencesText).toBe("");
    });

    it("setor inativo ao criar: SECTOR_INACTIVE", async () => {
      const { sector, ref, operatorAna } = await world();
      await client.query("update sector set active = false where id = $1", [
        sector.id,
      ]);

      const result = await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "occurrences", value: "x" },
        NOW,
      );

      expect(result).toMatchObject({ ok: false, code: "SECTOR_INACTIVE" });
    });
  });
});
