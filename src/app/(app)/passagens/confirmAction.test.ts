import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { db } from "@/db";
import { handover } from "@/db/schema/handovers";
import { authzOf } from "../../../../test/authz";
import { resetDb } from "../../../../test/db";
import {
  insertHandover,
  insertSector,
  insertShift,
  insertUser,
} from "../../../../test/fixtures";
import { confirmHandoverAction } from "./actions";

const mocks = vi.hoisted(
  (): {
    requireUser: Mock;
    revalidatePath: Mock;
    client: PGlite | undefined;
  } => ({
    requireUser: vi.fn(),
    revalidatePath: vi.fn(),
    client: undefined,
  }),
);

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});

const REDIRECT = new Error("NEXT_REDIRECT;/entrar");

// Setor com turno, quem entregou (Ana) e quem pode receber (Bia), mais uma
// passagem entregue.
async function seedDelivered() {
  const sector = await insertSector(db, "ULD");
  const shift = await insertShift(db, { sectorId: sector.id, name: "Manhã" });
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
  const created = await insertHandover(db, {
    sectorId: sector.id,
    shiftId: shift.id,
    status: "delivered",
    deliveredBy: ana.id,
  });
  const asUser = (userId: string, name: string) =>
    authzOf({ role: "operator", userId, sectorId: sector.id, name });
  return { sector, shift, ana, bia, id: created.id, asUser };
}

async function statusOf(id: string) {
  const [row] = await db.select().from(handover).where(eq(handover.id, id));
  return row;
}

describe("confirmHandoverAction", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireUser.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("sem sessão: requireUser redireciona e nada muda", async () => {
    const { id } = await seedDelivered();
    mocks.requireUser.mockRejectedValue(REDIRECT);

    await expect(confirmHandoverAction({ id, note: "" })).rejects.toBe(
      REDIRECT,
    );

    expect((await statusOf(id))?.status).toBe("delivered");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("outra pessoa do setor confirma, grava quem e quando e revalida", async () => {
    const { id, bia, asUser } = await seedDelivered();
    mocks.requireUser.mockResolvedValue(asUser(bia.id, "Bia Teste"));

    const result = await confirmHandoverAction({ id, note: "  Recebi tudo " });

    expect(result).toMatchObject({ ok: true });
    const row = await statusOf(id);
    expect(row).toMatchObject({
      status: "confirmed",
      confirmedBy: bia.id,
      confirmationNote: "Recebi tudo",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)", "layout");
  });

  it("observação só com espaços vira nula", async () => {
    const { id, bia, asUser } = await seedDelivered();
    mocks.requireUser.mockResolvedValue(asUser(bia.id, "Bia Teste"));

    await confirmHandoverAction({ id, note: "   " });

    expect((await statusOf(id))?.confirmationNote).toBeNull();
  });

  it("quem entregou não confirma (OWN_HANDOVER) e não revalida", async () => {
    const { id, ana, asUser } = await seedDelivered();
    mocks.requireUser.mockResolvedValue(asUser(ana.id, "Ana Teste"));

    const result = await confirmHandoverAction({ id, note: "" });

    expect(result).toMatchObject({ ok: false, code: "OWN_HANDOVER" });
    expect((await statusOf(id))?.status).toBe("delivered");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("a segunda confirmação recebe ALREADY_CONFIRMED com nome e hora", async () => {
    const { id, bia, asUser } = await seedDelivered();
    mocks.requireUser.mockResolvedValue(asUser(bia.id, "Bia Teste"));
    await confirmHandoverAction({ id, note: "" });

    const second = await confirmHandoverAction({ id, note: "" });

    expect(second).toMatchObject({
      ok: false,
      code: "ALREADY_CONFIRMED",
      message: expect.stringMatching(
        /^Esta passagem já foi confirmada por Bia Teste às \d{2}:\d{2}\.$/,
      ),
    });
  });

  it("operador de outro setor recebe NOT_FOUND e nada muda", async () => {
    const { id } = await seedDelivered();
    const other = await insertSector(db, "Outro");
    const stranger = await insertUser(db, {
      role: "operator",
      sectorId: other.id,
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: stranger.id, sectorId: other.id }),
    );

    const result = await confirmHandoverAction({ id, note: "" });

    expect(result).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
      message: "Passagem não encontrada. Atualize a página.",
    });
    expect((await statusOf(id))?.status).toBe("delivered");
  });

  it("admin confirma a passagem de qualquer setor", async () => {
    const { id } = await seedDelivered();
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "admin", userId: admin.id }),
    );

    const result = await confirmHandoverAction({ id, note: "" });

    expect(result).toMatchObject({ ok: true });
    expect((await statusOf(id))?.confirmedBy).toBe(admin.id);
  });

  it("rascunho não se confirma (NOT_DELIVERED)", async () => {
    const { sector, shift, bia, asUser } = await seedDelivered();
    const draft = await insertHandover(db, {
      sectorId: sector.id,
      shiftId: shift.id,
      operationalDate: "2026-11-19",
    });
    mocks.requireUser.mockResolvedValue(asUser(bia.id, "Bia Teste"));

    const result = await confirmHandoverAction({ id: draft.id, note: "" });

    expect(result).toMatchObject({ ok: false, code: "NOT_DELIVERED" });
  });

  it.each([
    ["id que não é uuid", { id: "abc", note: "" }],
    ["sem a observação", { id: "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b" }],
    [
      "observação que não é texto",
      {
        id: "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b",
        note: 5,
      },
    ],
  ])("entrada inválida (%s): INVALID_INPUT sem tocar o banco", async (_name, input) => {
    const { bia, asUser } = await seedDelivered();
    mocks.requireUser.mockResolvedValue(asUser(bia.id, "Bia Teste"));

    const result = await confirmHandoverAction(input);

    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("observação com 501 caracteres: erro no campo note; com 500 passa", async () => {
    const { id, bia, asUser } = await seedDelivered();
    mocks.requireUser.mockResolvedValue(asUser(bia.id, "Bia Teste"));

    const tooLong = await confirmHandoverAction({ id, note: "a".repeat(501) });
    expect(tooLong).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { note: "A observação pode ter no máximo 500 caracteres." },
    });
    expect((await statusOf(id))?.status).toBe("delivered");

    const exact = await confirmHandoverAction({ id, note: "a".repeat(500) });
    expect(exact).toMatchObject({ ok: true });
  });
});
