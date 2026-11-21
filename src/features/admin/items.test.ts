import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertItem, insertSector } from "../../../test/fixtures";
import {
  createItem,
  listItems,
  moveItem,
  setItemActive,
  updateItem,
} from "./items";
import { PAGE_SIZE } from "./pagination";

const NIL_ID = "00000000-0000-4000-8000-000000000000";

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("valor ausente no teste");
  return value;
}

describe("itens (domínio)", () => {
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

  async function orderOf(sectorId: string): Promise<string[]> {
    const page = await listItems(db, { sectorId, page: 1 });
    return page.rows.map((row) => row.name);
  }

  describe("listItems", () => {
    it("lista só o setor pedido, por ordem, com unidade e tipo", async () => {
      const uld = await insertSector(db, "ULD");
      const other = await insertSector(db, "Outro");
      await insertItem(db, {
        sectorId: uld.id,
        name: "Estoque de rolos",
        unit: "rolo",
        kind: "stock",
      });
      await insertItem(db, {
        sectorId: uld.id,
        name: "Redes danificadas",
        sortOrder: 0,
      });
      await insertItem(db, { sectorId: other.id, name: "Alheio" });

      const page = await listItems(db, { sectorId: uld.id, page: 1 });

      expect(page.total).toBe(2);
      expect(page.rows.map((row) => row.name)).toEqual([
        "Redes danificadas",
        "Estoque de rolos",
      ]);
      expect(page.rows[1]).toMatchObject({
        unit: "rolo",
        kind: "stock",
        active: true,
      });
    });

    it("setor sem itens devolve página vazia com pageCount 1", async () => {
      const uld = await insertSector(db, "ULD");
      expect(await listItems(db, { sectorId: uld.id, page: 1 })).toMatchObject({
        rows: [],
        total: 0,
        page: 1,
        pageCount: 1,
      });
    });

    it("lista ativos e inativos", async () => {
      const uld = await insertSector(db, "ULD");
      await insertItem(db, { sectorId: uld.id, name: "A" });
      await insertItem(db, { sectorId: uld.id, name: "B", active: false });
      const page = await listItems(db, { sectorId: uld.id, page: 1 });
      expect(page.rows.map((row) => row.active)).toEqual([true, false]);
    });

    it("canMoveUp/canMoveDown valem para a lista inteira, não para a página", async () => {
      const uld = await insertSector(db, "ULD");
      for (let n = 1; n <= PAGE_SIZE + 2; n += 1) {
        await insertItem(db, {
          sectorId: uld.id,
          name: `I${String(n).padStart(3, "0")}`,
        });
      }
      const first = await listItems(db, { sectorId: uld.id, page: 1 });
      const second = await listItems(db, { sectorId: uld.id, page: 2 });

      expect(first.rows).toHaveLength(PAGE_SIZE);
      expect(second.rows).toHaveLength(2);
      expect(first.rows[0]).toMatchObject({
        canMoveUp: false,
        canMoveDown: true,
      });
      expect(first.rows.at(-1)).toMatchObject({
        canMoveUp: true,
        canMoveDown: true,
      });
      expect(second.rows[0]).toMatchObject({
        canMoveUp: true,
        canMoveDown: true,
      });
      expect(second.rows.at(-1)).toMatchObject({
        canMoveUp: true,
        canMoveDown: false,
      });
    });

    it("item único não sobe nem desce", async () => {
      const uld = await insertSector(db, "ULD");
      await insertItem(db, { sectorId: uld.id });
      const page = await listItems(db, { sectorId: uld.id, page: 1 });
      expect(page.rows[0]).toMatchObject({
        canMoveUp: false,
        canMoveDown: false,
      });
    });

    it("página além do fim é clampada para a última", async () => {
      const uld = await insertSector(db, "ULD");
      await insertItem(db, { sectorId: uld.id });
      const page = await listItems(db, { sectorId: uld.id, page: 99 });
      expect(page.page).toBe(1);
      expect(page.rows).toHaveLength(1);
    });
  });

  describe("createItem", () => {
    it("cria no fim da ordem com unidade e tipo", async () => {
      const uld = await insertSector(db, "ULD");
      await insertItem(db, { sectorId: uld.id, name: "Primeiro" });

      const result = await createItem(db, {
        sectorId: uld.id,
        name: "  Rede   de proteção ",
        unit: "unidade",
        kind: "control",
      });

      expect(result).toMatchObject({ ok: true });
      expect(await orderOf(uld.id)).toEqual(["Primeiro", "Rede de proteção"]);
    });

    it("o primeiro item do setor recebe sortOrder 1; a ordem é por setor", async () => {
      const uld = await insertSector(db, "ULD");
      const other = await insertSector(db, "Outro");
      await insertItem(db, { sectorId: other.id, sortOrder: 7 });
      await createItem(db, {
        sectorId: uld.id,
        name: "A",
        unit: "kg",
        kind: "stock",
      });
      const page = await listItems(db, { sectorId: uld.id, page: 1 });
      expect(page.rows[0]).toMatchObject({
        sortOrder: 1,
        unit: "kg",
        kind: "stock",
      });
    });

    it("aceita unidade livre (Outro) com Unicode e 20 caracteres", async () => {
      const uld = await insertSector(db, "ULD");
      const unit = "ç".repeat(20);
      const result = await createItem(db, {
        sectorId: uld.id,
        name: "A",
        unit,
        kind: "control",
      });
      expect(result.ok).toBe(true);
      expect(
        (await listItems(db, { sectorId: uld.id, page: 1 })).rows[0]?.unit,
      ).toBe(unit);
    });

    it("unidade vazia, só espaços ou com 21 caracteres é INVALID_INPUT em unitOther", async () => {
      const uld = await insertSector(db, "ULD");
      const empty = await createItem(db, {
        sectorId: uld.id,
        name: "A",
        unit: "   ",
        kind: "control",
      });
      const long = await createItem(db, {
        sectorId: uld.id,
        name: "B",
        unit: "x".repeat(21),
        kind: "control",
      });
      expect(empty).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        message: "Informe a unidade.",
        fieldErrors: { unitOther: "Informe a unidade." },
      });
      expect(long).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: {
          unitOther: "A unidade pode ter no máximo 20 caracteres.",
        },
      });
      expect((await listItems(db, { sectorId: uld.id, page: 1 })).total).toBe(
        0,
      );
    });

    it("nome vazio e nome longo viram INVALID_INPUT no campo name", async () => {
      const uld = await insertSector(db, "ULD");
      const empty = await createItem(db, {
        sectorId: uld.id,
        name: " ",
        unit: "kg",
        kind: "control",
      });
      const long = await createItem(db, {
        sectorId: uld.id,
        name: "x".repeat(61),
        unit: "kg",
        kind: "control",
      });
      expect(empty).toMatchObject({
        ok: false,
        fieldErrors: { name: "Informe o nome." },
      });
      expect(long).toMatchObject({
        ok: false,
        fieldErrors: { name: "O nome pode ter no máximo 60 caracteres." },
      });
    });

    it("setor inexistente é NOT_FOUND", async () => {
      const result = await createItem(db, {
        sectorId: NIL_ID,
        name: "A",
        unit: "kg",
        kind: "control",
      });
      expect(result).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
        message: "Setor não encontrado. Atualize a página.",
      });
    });

    it("setor inativo é SECTOR_INACTIVE e nada é gravado", async () => {
      const off = await insertSector(db, "Parado", { active: false });
      const result = await createItem(db, {
        sectorId: off.id,
        name: "A",
        unit: "kg",
        kind: "control",
      });
      expect(result).toMatchObject({
        ok: false,
        code: "SECTOR_INACTIVE",
        message: "Este setor está inativo. Reative-o para cadastrar itens.",
      });
      expect((await listItems(db, { sectorId: off.id, page: 1 })).total).toBe(
        0,
      );
    });

    it("nome repetido no setor (outra caixa) é NAME_TAKEN", async () => {
      const uld = await insertSector(db, "ULD");
      await insertItem(db, { sectorId: uld.id, name: "Água" });
      const result = await createItem(db, {
        sectorId: uld.id,
        name: "ÁGUA",
        unit: "kg",
        kind: "control",
      });
      expect(result).toEqual({
        ok: false,
        code: "NAME_TAKEN",
        message: "Já existe um item com este nome neste setor.",
        fieldErrors: { name: "Já existe um item com este nome neste setor." },
      });
    });

    it("avisa quando o nome repetido é de um item inativo", async () => {
      const uld = await insertSector(db, "ULD");
      await insertItem(db, { sectorId: uld.id, name: "Rede", active: false });
      const result = await createItem(db, {
        sectorId: uld.id,
        name: "rede",
        unit: "kg",
        kind: "control",
      });
      expect(result).toMatchObject({
        ok: false,
        code: "NAME_TAKEN",
        message:
          "Já existe um item com este nome neste setor. Ele está inativo: reative-o na lista.",
      });
    });

    it("o mesmo nome em outro setor passa", async () => {
      const uld = await insertSector(db, "ULD");
      const other = await insertSector(db, "Outro");
      await insertItem(db, { sectorId: other.id, name: "Rede" });
      const result = await createItem(db, {
        sectorId: uld.id,
        name: "Rede",
        unit: "kg",
        kind: "control",
      });
      expect(result.ok).toBe(true);
    });
  });

  describe("updateItem", () => {
    it("altera nome, unidade e tipo", async () => {
      const uld = await insertSector(db, "ULD");
      const rede = await insertItem(db, { sectorId: uld.id, name: "Rede" });

      const result = await updateItem(db, {
        id: rede.id,
        name: "Rede nova",
        unit: "pç grande",
        kind: "stock",
      });

      expect(result).toEqual({ ok: true });
      expect(
        (await listItems(db, { sectorId: uld.id, page: 1 })).rows[0],
      ).toMatchObject({
        name: "Rede nova",
        unit: "pç grande",
        kind: "stock",
      });
    });

    it("trocar só a caixa do próprio nome é permitido", async () => {
      const uld = await insertSector(db, "ULD");
      const rede = await insertItem(db, { sectorId: uld.id, name: "rede" });
      expect(
        await updateItem(db, {
          id: rede.id,
          name: "Rede",
          unit: "unidade",
          kind: "control",
        }),
      ).toEqual({ ok: true });
    });

    it("nome de outro item do setor é NAME_TAKEN e o item não muda", async () => {
      const uld = await insertSector(db, "ULD");
      await insertItem(db, { sectorId: uld.id, name: "Rede" });
      const rolo = await insertItem(db, { sectorId: uld.id, name: "Rolo" });
      const result = await updateItem(db, {
        id: rolo.id,
        name: "REDE",
        unit: "kg",
        kind: "control",
      });
      expect(result).toMatchObject({ ok: false, code: "NAME_TAKEN" });
      expect(await orderOf(uld.id)).toEqual(["Rede", "Rolo"]);
    });

    it("unidade inválida é recusada", async () => {
      const uld = await insertSector(db, "ULD");
      const rede = await insertItem(db, { sectorId: uld.id, name: "Rede" });
      expect(
        await updateItem(db, {
          id: rede.id,
          name: "Rede",
          unit: "",
          kind: "control",
        }),
      ).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { unitOther: "Informe a unidade." },
      });
    });

    it("id inexistente é NOT_FOUND", async () => {
      expect(
        await updateItem(db, {
          id: NIL_ID,
          name: "A",
          unit: "kg",
          kind: "control",
        }),
      ).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
        message: "Item não encontrado. Atualize a página.",
      });
    });
  });

  describe("setItemActive", () => {
    it("desativa e reativa", async () => {
      const uld = await insertSector(db, "ULD");
      const rede = await insertItem(db, { sectorId: uld.id });
      expect(await setItemActive(db, { id: rede.id, active: false })).toEqual({
        ok: true,
      });
      expect(
        (await listItems(db, { sectorId: uld.id, page: 1 })).rows[0]?.active,
      ).toBe(false);
      expect(await setItemActive(db, { id: rede.id, active: true })).toEqual({
        ok: true,
      });
      expect(
        (await listItems(db, { sectorId: uld.id, page: 1 })).rows[0]?.active,
      ).toBe(true);
    });

    it("é idempotente: desativar de novo é sucesso sem mudança", async () => {
      const uld = await insertSector(db, "ULD");
      const rede = await insertItem(db, { sectorId: uld.id, active: false });
      expect(await setItemActive(db, { id: rede.id, active: false })).toEqual({
        ok: true,
      });
    });

    it("id inexistente é NOT_FOUND", async () => {
      expect(
        await setItemActive(db, { id: NIL_ID, active: true }),
      ).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
      });
    });
  });

  describe("moveItem", () => {
    async function seed(names: string[]) {
      const uld = await insertSector(db, "ULD");
      const ids: string[] = [];
      for (const name of names) {
        ids.push((await insertItem(db, { sectorId: uld.id, name })).id);
      }
      return { sectorId: uld.id, ids };
    }

    it("sobe e desce trocando com o vizinho", async () => {
      const { sectorId, ids } = await seed(["A", "B", "C"]);
      await moveItem(db, { id: must(ids[2]), direction: "up" });
      expect(await orderOf(sectorId)).toEqual(["A", "C", "B"]);
      await moveItem(db, { id: must(ids[0]), direction: "down" });
      expect(await orderOf(sectorId)).toEqual(["C", "A", "B"]);
    });

    it("no topo ou no fim é sucesso sem mudança", async () => {
      const { sectorId, ids } = await seed(["A", "B"]);
      expect(await moveItem(db, { id: must(ids[0]), direction: "up" })).toEqual(
        { ok: true },
      );
      expect(
        await moveItem(db, { id: must(ids[1]), direction: "down" }),
      ).toEqual({ ok: true });
      expect(await orderOf(sectorId)).toEqual(["A", "B"]);
    });

    it("com sortOrder duplicado renumera 1..n e move", async () => {
      const uld = await insertSector(db, "ULD");
      await insertItem(db, { sectorId: uld.id, name: "A", sortOrder: 1 });
      const b = await insertItem(db, {
        sectorId: uld.id,
        name: "B",
        sortOrder: 1,
      });
      await insertItem(db, { sectorId: uld.id, name: "C", sortOrder: 2 });

      await moveItem(db, { id: b.id, direction: "up" });

      const page = await listItems(db, { sectorId: uld.id, page: 1 });
      expect(page.rows.map((row) => [row.name, row.sortOrder])).toEqual([
        ["B", 1],
        ["A", 2],
        ["C", 3],
      ]);
    });

    it("não mexe na ordem de outro setor", async () => {
      const { ids } = await seed(["A", "B"]);
      const other = await insertSector(db, "Outro");
      await insertItem(db, { sectorId: other.id, name: "X", sortOrder: 5 });
      await insertItem(db, { sectorId: other.id, name: "Y", sortOrder: 9 });
      await moveItem(db, { id: must(ids[1]), direction: "up" });
      const page = await listItems(db, { sectorId: other.id, page: 1 });
      expect(page.rows.map((row) => [row.name, row.sortOrder])).toEqual([
        ["X", 5],
        ["Y", 9],
      ]);
    });

    it("id inexistente é NOT_FOUND", async () => {
      expect(await moveItem(db, { id: NIL_ID, direction: "up" })).toMatchObject(
        {
          ok: false,
          code: "NOT_FOUND",
          message: "Item não encontrado. Atualize a página.",
        },
      );
    });
  });
});
