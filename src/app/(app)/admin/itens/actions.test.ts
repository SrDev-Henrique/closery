import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { db } from "@/db";
import { listItems } from "@/features/admin/items";
import { authzOf } from "../../../../../test/authz";
import { resetDb } from "../../../../../test/db";
import { insertItem, insertSector } from "../../../../../test/fixtures";
import {
  createItemAction,
  moveItemAction,
  setItemActiveAction,
  updateItemAction,
} from "./actions";

const mocks = vi.hoisted(
  (): {
    requireAdmin: Mock;
    revalidatePath: Mock;
    client: PGlite | undefined;
  } => ({
    requireAdmin: vi.fn(),
    revalidatePath: vi.fn(),
    client: undefined,
  }),
);

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});

const NOT_FOUND = new Error("NEXT_HTTP_ERROR_FALLBACK;404");

function itemInput(sectorId: string, overrides: Record<string, string> = {}) {
  return {
    sectorId,
    name: "Rede de proteção",
    unitChoice: "unidade",
    unitOther: "",
    kind: "control",
    ...overrides,
  };
}

describe("actions de itens", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireAdmin.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.requireAdmin.mockResolvedValue(authzOf({ role: "admin" }));
  });

  describe("operador (permissão negada)", () => {
    beforeEach(() => {
      mocks.requireAdmin.mockRejectedValue(NOT_FOUND);
    });

    it("nenhuma action toca o banco nem revalida", async () => {
      const sector = await insertSector(db, "ULD");
      const existing = await insertItem(db, {
        sectorId: sector.id,
        name: "Antigo",
      });

      await expect(createItemAction(itemInput(sector.id))).rejects.toBe(
        NOT_FOUND,
      );
      await expect(
        updateItemAction({
          id: existing.id,
          ...itemInput(sector.id, { name: "Hackeado" }),
        }),
      ).rejects.toBe(NOT_FOUND);
      await expect(
        setItemActiveAction({ id: existing.id, active: false }),
      ).rejects.toBe(NOT_FOUND);
      await expect(
        moveItemAction({ id: existing.id, direction: "down" }),
      ).rejects.toBe(NOT_FOUND);

      const page = await listItems(db, { sectorId: sector.id, page: 1 });
      expect(page.rows.map((row) => [row.name, row.active])).toEqual([
        ["Antigo", true],
      ]);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
  });

  it("createItemAction com unidade da lista grava o valor da lista e revalida", async () => {
    const sector = await insertSector(db, "ULD");

    const result = await createItemAction(
      itemInput(sector.id, { unitChoice: "rolo", kind: "stock" }),
    );

    expect(result).toMatchObject({ ok: true });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
    const page = await listItems(db, { sectorId: sector.id, page: 1 });
    expect(page.rows[0]).toMatchObject({
      name: "Rede de proteção",
      unit: "rolo",
      kind: "stock",
    });
  });

  it("'Outro' grava o texto normalizado", async () => {
    const sector = await insertSector(db, "ULD");
    await createItemAction(
      itemInput(sector.id, {
        unitChoice: "outro",
        unitOther: "  folha   grande ",
      }),
    );
    const page = await listItems(db, { sectorId: sector.id, page: 1 });
    expect(page.rows[0]?.unit).toBe("folha grande");
  });

  it("'Outro' igual a uma unidade da lista grava o valor da lista", async () => {
    const sector = await insertSector(db, "ULD");
    await createItemAction(
      itemInput(sector.id, { unitChoice: "outro", unitOther: "ROLO" }),
    );
    const page = await listItems(db, { sectorId: sector.id, page: 1 });
    expect(page.rows[0]?.unit).toBe("rolo");
  });

  it("'Outro' vazio ou longo volta INVALID_INPUT em unitOther, sem gravar", async () => {
    const sector = await insertSector(db, "ULD");
    const empty = await createItemAction(
      itemInput(sector.id, { unitChoice: "outro", unitOther: "  " }),
    );
    const long = await createItemAction(
      itemInput(sector.id, { unitChoice: "outro", unitOther: "x".repeat(21) }),
    );
    expect(empty).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { unitOther: "Informe a unidade." },
    });
    expect(long).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { unitOther: "A unidade pode ter no máximo 20 caracteres." },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect((await listItems(db, { sectorId: sector.id, page: 1 })).total).toBe(
      0,
    );
  });

  it("unidade desconhecida volta INVALID_INPUT em unitChoice", async () => {
    const sector = await insertSector(db, "ULD");
    const result = await createItemAction(
      itemInput(sector.id, { unitChoice: "tonelada" }),
    );
    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { unitChoice: "Escolha uma unidade." },
    });
  });

  it("tipo fora de Controle/Estoque volta INVALID_INPUT", async () => {
    const sector = await insertSector(db, "ULD");
    const result = await createItemAction(
      itemInput(sector.id, { kind: "outro" }),
    );
    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });

  it("nome vazio volta INVALID_INPUT no campo name", async () => {
    const sector = await insertSector(db, "ULD");
    const result = await createItemAction(itemInput(sector.id, { name: "  " }));
    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { name: "Informe o nome." },
    });
  });

  it("falha de domínio é repassada e não revalida", async () => {
    const off = await insertSector(db, "Parado", { active: false });
    const result = await createItemAction(itemInput(off.id));
    expect(result).toMatchObject({ ok: false, code: "SECTOR_INACTIVE" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("updateItemAction resolve a unidade e grava", async () => {
    const sector = await insertSector(db, "ULD");
    const existing = await insertItem(db, {
      sectorId: sector.id,
      name: "Rede",
    });

    const result = await updateItemAction({
      id: existing.id,
      name: "Rede nova",
      unitChoice: "outro",
      unitOther: "pç grande",
      kind: "stock",
    });

    expect(result).toEqual({ ok: true });
    const page = await listItems(db, { sectorId: sector.id, page: 1 });
    expect(page.rows[0]).toMatchObject({
      name: "Rede nova",
      unit: "pç grande",
      kind: "stock",
    });
  });

  it("setItemActiveAction e moveItemAction funcionam", async () => {
    const sector = await insertSector(db, "ULD");
    await insertItem(db, { sectorId: sector.id, name: "A" });
    const b = await insertItem(db, { sectorId: sector.id, name: "B" });

    expect(await setItemActiveAction({ id: b.id, active: false })).toEqual({
      ok: true,
    });
    expect(await moveItemAction({ id: b.id, direction: "up" })).toEqual({
      ok: true,
    });

    const page = await listItems(db, { sectorId: sector.id, page: 1 });
    expect(page.rows.map((row) => [row.name, row.active])).toEqual([
      ["B", false],
      ["A", true],
    ]);
  });

  it("id malformado volta INVALID_INPUT", async () => {
    expect(await moveItemAction({ id: "x", direction: "up" })).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Registro inválido. Atualize a página.",
    });
  });
});
