import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { handover, handoverItem } from "@/db/schema/handovers";
import { authzOf } from "../../../../test/authz";
import { spDate } from "../../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../../test/db";
import {
  insertHandover,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../../test/fixtures";

// O banco de verdade (PGlite) entra no lugar de "@/db" por um getter; o
// guarda de acesso é simulado: sem sessão o requireUser redireciona.
const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  database: { current: undefined as unknown },
  touched: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", () => ({
  get db() {
    mocks.touched();
    return mocks.database.current;
  },
}));

import { deliverHandoverAction, saveHandoverFieldAction } from "./actions";

const TODAY = "2026-11-20";
const REDIRECT = Object.assign(new Error("NEXT_REDIRECT"), {
  digest: "NEXT_REDIRECT;replace;/entrar;307;",
});

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
  mocks.database.current = db;
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
  mocks.requireUser.mockReset();
  mocks.revalidatePath.mockReset();
  mocks.touched.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(spDate(TODAY, "10:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

async function scenario() {
  const uld = await insertSector(db, "ULD");
  const shiftRow = await insertShift(db, { sectorId: uld.id });
  const rede = await insertItem(db, {
    sectorId: uld.id,
    name: "Rede de proteção",
  });
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Ana Teste",
  });
  const ref = {
    sectorId: uld.id,
    shiftId: shiftRow.id,
    operationalDate: TODAY,
  };
  return { uld, shiftRow, rede, ana, ref };
}

describe("sem sessão", () => {
  beforeEach(() => {
    mocks.requireUser.mockRejectedValue(REDIRECT);
  });

  it("saveHandoverFieldAction redireciona e não toca o banco", async () => {
    await expect(
      saveHandoverFieldAction({ field: "occurrences", value: "x" }),
    ).rejects.toBe(REDIRECT);

    expect(mocks.touched).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("deliverHandoverAction redireciona e não toca o banco", async () => {
    await expect(deliverHandoverAction({})).rejects.toBe(REDIRECT);

    expect(mocks.touched).not.toHaveBeenCalled();
  });
});

describe("saveHandoverFieldAction", () => {
  it("operador do setor salva; o rascunho nasce e a tela não é revalidada", async () => {
    const { ana, ref, rede } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({
        role: "operator",
        userId: ana.id,
        sectorId: ref.sectorId,
        name: "Ana Teste",
      }),
    );

    const result = await saveHandoverFieldAction({
      ...ref,
      field: "quantity",
      itemId: rede.id,
      value: 4,
    });

    expect(result).toMatchObject({ ok: true, savedByName: "Ana Teste" });
    const rows = await db.select().from(handover);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "draft", updatedBy: ana.id });
    const items = await db.select().from(handoverItem);
    expect(items).toMatchObject([{ itemId: rede.id, quantity: 4 }]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("texto é normalizado pelo schema (NFC, quebra de linha)", async () => {
    const { ana, ref } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: ref.sectorId }),
    );

    await saveHandoverFieldAction({
      ...ref,
      field: "occurrences",
      value: "Cafe\u{301}\r\nfim",
    });

    const [row] = await db.select().from(handover);
    expect(row?.occurrencesText).toBe("Caf\u{e9}\nfim");
  });

  it.each([
    [-1],
    [1.5],
    [100_000],
    ["3"],
  ])("quantidade %j é entrada inválida e não cria rascunho", async (value) => {
    const { ana, ref, rede } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: ref.sectorId }),
    );

    const result = await saveHandoverFieldAction({
      ...ref,
      field: "quantity",
      itemId: rede.id,
      value,
    });

    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(await db.select().from(handover)).toEqual([]);
  });

  it("limite exato: 99.999 passa, 2.000 pontos de código passam e 2.001 não", async () => {
    const { ana, ref, rede } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: ref.sectorId }),
    );

    expect(
      await saveHandoverFieldAction({
        ...ref,
        field: "quantity",
        itemId: rede.id,
        value: 99_999,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await saveHandoverFieldAction({
        ...ref,
        field: "occurrences",
        value: "\u{1F600}".repeat(2000),
      }),
    ).toMatchObject({ ok: true });

    const tooLong = await saveHandoverFieldAction({
      ...ref,
      field: "occurrences",
      value: "\u{1F600}".repeat(2001),
    });
    expect(tooLong).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "O texto pode ter no máximo 2.000 caracteres.",
      fieldErrors: { value: "O texto pode ter no máximo 2.000 caracteres." },
    });
  });

  it("data malformada: INVALID_INPUT com 'Data inválida.'", async () => {
    const { ana, ref } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: ref.sectorId }),
    );

    const result = await saveHandoverFieldAction({
      ...ref,
      operationalDate: "2026-02-30",
      field: "occurrences",
      value: "x",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Data inválida.",
    });
  });

  it("operador de outro setor recebe NOT_FOUND e nada é gravado", async () => {
    const { ref } = await scenario();
    const carga = await insertSector(db, "Carga");
    const intruso = await insertUser(db, {
      role: "operator",
      sectorId: carga.id,
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: intruso.id, sectorId: carga.id }),
    );

    const result = await saveHandoverFieldAction({
      ...ref,
      field: "occurrences",
      value: "invasão",
    });

    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await db.select().from(handover)).toEqual([]);
  });

  it("passagem confirmada recusa até o admin (HANDOVER_LOCKED)", async () => {
    const { uld, shiftRow, ana } = await scenario();
    const bia = await insertUser(db, { role: "operator", sectorId: uld.id });
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    await insertHandover(db, {
      sectorId: uld.id,
      shiftId: shiftRow.id,
      operationalDate: TODAY,
      status: "confirmed",
      deliveredBy: ana.id,
      confirmedBy: bia.id,
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "admin", userId: admin.id }),
    );

    const result = await saveHandoverFieldAction({
      sectorId: uld.id,
      shiftId: shiftRow.id,
      operationalDate: TODAY,
      field: "occurrences",
      value: "tentativa",
    });

    expect(result).toMatchObject({ ok: false, code: "HANDOVER_LOCKED" });
  });

  it("falha inesperada do banco vira INTERNAL sem vazar o texto", async () => {
    const { ana, ref } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: ref.sectorId }),
    );
    mocks.database.current = {
      transaction: async () => {
        throw new Error('relation "handover" does not exist');
      },
    };
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await saveHandoverFieldAction({
      ...ref,
      field: "occurrences",
      value: "x",
    });
    mocks.database.current = db;
    consoleError.mockRestore();

    expect(result).toEqual({
      ok: false,
      code: "INTERNAL",
      message: "Não foi possível concluir. Tente de novo.",
    });
  });
});

describe("deliverHandoverAction", () => {
  it("entrega, devolve o id e revalida a tela", async () => {
    const { ana, ref, rede } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: ref.sectorId }),
    );

    const result = await deliverHandoverAction(ref);

    expect(result).toMatchObject({ ok: true });
    const [row] = await db.select().from(handover);
    expect(row).toMatchObject({ status: "delivered", deliveredBy: ana.id });
    // Item ativo que faltava entra com 0.
    const items = await db
      .select()
      .from(handoverItem)
      .where(eq(handoverItem.itemId, rede.id));
    expect(items).toMatchObject([{ quantity: 0 }]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)", "layout");
  });

  it("segunda entrega: ALREADY_DELIVERED com nome e hora, sem revalidar", async () => {
    const { ana, ref } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: ref.sectorId }),
    );
    await deliverHandoverAction(ref);
    mocks.revalidatePath.mockReset();

    const result = await deliverHandoverAction(ref);

    expect(result).toMatchObject({
      ok: false,
      code: "ALREADY_DELIVERED",
      message: "Esta passagem já foi entregue por Ana Teste às 10:00.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("operador de outro setor recebe NOT_FOUND", async () => {
    const { ref } = await scenario();
    const carga = await insertSector(db, "Carga");
    const intruso = await insertUser(db, {
      role: "operator",
      sectorId: carga.id,
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: intruso.id, sectorId: carga.id }),
    );

    const result = await deliverHandoverAction(ref);

    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await db.select().from(handover)).toEqual([]);
  });

  it("entrada inválida: id fora do formato", async () => {
    const { ana, ref } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: ref.sectorId }),
    );

    const result = await deliverHandoverAction({ ...ref, shiftId: "abc" });

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Registro inválido. Atualize a página.",
    });
  });

  it("data futura: DATE_OUT_OF_RANGE e nada é criado", async () => {
    const { ana, ref } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: ref.sectorId }),
    );

    const result = await deliverHandoverAction({
      ...ref,
      operationalDate: "2026-11-21",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "DATE_OUT_OF_RANGE",
      message: "Escolha uma data de hoje ou dos últimos 31 dias.",
    });
    expect(await db.select().from(handover)).toEqual([]);
  });
});
