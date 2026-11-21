import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { db } from "@/db";
import { listShifts } from "@/features/admin/shifts";
import { authzOf } from "../../../../../test/authz";
import { resetDb } from "../../../../../test/db";
import { insertSector, insertShift } from "../../../../../test/fixtures";
import {
  createShiftAction,
  moveShiftAction,
  setShiftActiveAction,
  updateShiftAction,
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

describe("actions de turnos", () => {
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
      const shiftId = (await insertShift(db, { sectorId: sector.id })).id;
      const valid = {
        sectorId: sector.id,
        name: "Intruso",
        startsAt: "06:00",
        endsAt: "14:00",
      };

      await expect(createShiftAction(valid)).rejects.toBe(NOT_FOUND);
      await expect(updateShiftAction({ ...valid, id: shiftId })).rejects.toBe(
        NOT_FOUND,
      );
      await expect(
        setShiftActiveAction({ id: shiftId, active: false }),
      ).rejects.toBe(NOT_FOUND);
      await expect(
        moveShiftAction({ id: shiftId, direction: "down" }),
      ).rejects.toBe(NOT_FOUND);

      const page = await listShifts(db, { sectorId: sector.id, page: 1 });
      expect(page.rows.map((row) => [row.name, row.active])).toEqual([
        [expect.any(String), true],
      ]);
      expect(page.rows[0]?.name).not.toBe("Intruso");
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
  });

  it("createShiftAction cria, devolve os avisos e revalida /admin", async () => {
    const sector = await insertSector(db, "ULD");
    await insertShift(db, {
      sectorId: sector.id,
      name: "Manhã",
      startsAt: "06:00",
      endsAt: "14:00",
    });

    const result = await createShiftAction({
      sectorId: sector.id,
      name: "  Extra ",
      startsAt: "13:00",
      endsAt: "15:00",
    });

    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.warnings).toHaveLength(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
    const page = await listShifts(db, { sectorId: sector.id, page: 1 });
    expect(page.rows.map((row) => row.name)).toEqual(["Manhã", "Extra"]);
  });

  it("entrada inválida volta INVALID_INPUT sem gravar nem revalidar", async () => {
    const sector = await insertSector(db, "ULD");

    const result = await createShiftAction({
      sectorId: sector.id,
      name: "X",
      startsAt: "06:00",
      endsAt: "06:00",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "O início e o fim não podem ser iguais.",
      fieldErrors: { endsAt: "O início e o fim não podem ser iguais." },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect((await listShifts(db, { sectorId: sector.id, page: 1 })).total).toBe(
      0,
    );
  });

  it("id malformado volta INVALID_INPUT", async () => {
    const result = await setShiftActiveAction({
      id: "nao-e-uuid",
      active: true,
    });
    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Registro inválido. Atualize a página.",
    });
  });

  it("falha de domínio é repassada e não revalida", async () => {
    const off = await insertSector(db, "Parado", { active: false });

    const result = await createShiftAction({
      sectorId: off.id,
      name: "X",
      startsAt: "06:00",
      endsAt: "14:00",
    });

    expect(result).toMatchObject({ ok: false, code: "SECTOR_INACTIVE" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("updateShiftAction, setShiftActiveAction e moveShiftAction funcionam", async () => {
    const sector = await insertSector(db, "ULD");
    const a = await insertShift(db, { sectorId: sector.id, name: "A" });
    const b = await insertShift(db, { sectorId: sector.id, name: "B" });

    expect(
      await updateShiftAction({
        id: a.id,
        name: "A2",
        startsAt: "06:00",
        endsAt: "07:00",
      }),
    ).toMatchObject({ ok: true });
    expect(
      await setShiftActiveAction({ id: b.id, active: false }),
    ).toMatchObject({ ok: true });
    expect(await moveShiftAction({ id: b.id, direction: "up" })).toMatchObject({
      ok: true,
    });

    const page = await listShifts(db, { sectorId: sector.id, page: 1 });
    expect(page.rows.map((row) => [row.name, row.active])).toEqual([
      ["B", false],
      ["A2", true],
    ]);
  });

  it("setor inexistente volta NOT_FOUND (erro esperado, não INTERNAL)", async () => {
    const result = await createShiftAction({
      sectorId: "00000000-0000-4000-8000-000000000000",
      name: "X",
      startsAt: "06:00",
      endsAt: "14:00",
    });
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
