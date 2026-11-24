import type { PGlite } from "@electric-sql/pglite";
import { count, eq } from "drizzle-orm";
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

import { handover } from "@/db/schema/handovers";
import {
  request,
  requestComment,
  requestStatusEvent,
} from "@/db/schema/requests";
import { authzOf } from "../../../../test/authz";
import { spDate } from "../../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../../test/db";
import {
  insertDestination,
  insertItem,
  insertRequest,
  insertRequestComment,
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

import {
  addCommentAction,
  cancelRequestAction,
  createRequestAction,
  deleteCommentAction,
  moveRequestAction,
} from "./actions";

const TODAY = "2026-11-21";
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
  vi.setSystemTime(spDate(TODAY, "14:05"));
});

afterEach(() => {
  vi.useRealTimers();
});

async function scenario() {
  const uld = await insertSector(db, "ULD");
  const outro = await insertSector(db, "Rede de proteção");
  const turno = await insertShift(db, { sectorId: uld.id });
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Ana Teste",
  });
  const caio = await insertUser(db, {
    role: "operator",
    sectorId: outro.id,
    name: "Caio Teste",
  });
  const doca = await insertDestination(db, { name: "Doca 3" });
  const fita = await insertItem(db, {
    sectorId: uld.id,
    name: "Fita adesiva",
    unit: "rolo",
    kind: "stock",
  });
  const asAna = () =>
    mocks.requireUser.mockResolvedValue(
      authzOf({
        role: "operator",
        userId: ana.id,
        sectorId: uld.id,
        name: "Ana Teste",
      }),
    );
  const payload = (overrides: Record<string, unknown> = {}) => ({
    sectorId: uld.id,
    destinationId: doca.id,
    destinationOther: "",
    description: "Repor fita",
    items: [{ itemId: fita.id, quantity: 4 }],
    originRef: null,
    ...overrides,
  });
  const ref = {
    sectorId: uld.id,
    shiftId: turno.id,
    operationalDate: TODAY,
  };
  return { uld, outro, turno, ana, caio, doca, fita, asAna, payload, ref };
}

const rows = async (table: typeof request | typeof requestStatusEvent) =>
  (await db.select({ n: count() }).from(table))[0]?.n ?? 0;

describe("sem sessão", () => {
  beforeEach(() => {
    mocks.requireUser.mockRejectedValue(REDIRECT);
  });

  it.each([
    ["createRequestAction", createRequestAction],
    ["moveRequestAction", moveRequestAction],
    ["cancelRequestAction", cancelRequestAction],
    ["addCommentAction", addCommentAction],
    ["deleteCommentAction", deleteCommentAction],
  ])("%s redireciona e não toca o banco", async (_name, action) => {
    await expect(action({})).rejects.toBe(REDIRECT);

    expect(mocks.touched).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("createRequestAction", () => {
  it("cria, devolve o id e revalida o layout do app", async () => {
    const { asAna, payload, ana } = await scenario();
    asAna();

    const result = await createRequestAction(payload());

    expect(result).toMatchObject({ ok: true });
    const [row] = await db.select().from(request);
    expect(row).toMatchObject({
      status: "requested",
      createdBy: ana.id,
      description: "Repor fita",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)", "layout");
  });

  it("normaliza o texto pelo schema (NFC, quebra de linha, espaços nas pontas)", async () => {
    const { asAna, payload } = await scenario();
    asAna();

    await createRequestAction(
      payload({ description: "  Cafe\u{301}\r\nfim  ", items: [] }),
    );

    const [row] = await db.select().from(request);
    expect(row?.description).toBe("Caf\u{e9}\nfim");
  });

  it("com origem: o servidor cria o rascunho e liga a solicitação", async () => {
    const { asAna, payload, ref } = await scenario();
    asAna();

    const result = await createRequestAction(payload({ originRef: ref }));

    expect(result).toMatchObject({ ok: true });
    const [draft] = await db.select().from(handover);
    const [row] = await db.select().from(request);
    expect(row?.originHandoverId).toBe(draft?.id);
  });

  it.each([
    ["descrição vazia", { description: "   " }, "Descreva a solicitação."],
    [
      "quantidade zero",
      { items: [{ itemId: "x", quantity: 0 }] },
      "Registro inválido. Atualize a página.",
    ],
    [
      "campo ausente",
      { description: undefined },
      "Confira os campos e tente de novo.",
    ],
  ])("entrada inválida (%s): INVALID_INPUT, nada gravado, sem revalidar", async (_label, overrides, message) => {
    const { asAna, payload } = await scenario();
    asAna();

    const result = await createRequestAction(payload(overrides));

    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    if (!result.ok) expect(result.message).toMatch(message);
    expect(await rows(request)).toBe(0);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("limites: 500 pontos de código passam, 501 não; quantidade 99.999 passa, 100.000 não", async () => {
    const { asAna, payload, fita } = await scenario();
    asAna();

    const ok500 = await createRequestAction(
      payload({ description: "😀".repeat(500) }),
    );
    const bad501 = await createRequestAction(
      payload({ description: "😀".repeat(501) }),
    );
    const okMax = await createRequestAction(
      payload({ items: [{ itemId: fita.id, quantity: 99_999 }] }),
    );
    const badMax = await createRequestAction(
      payload({ items: [{ itemId: fita.id, quantity: 100_000 }] }),
    );

    expect(ok500).toMatchObject({ ok: true });
    expect(bad501).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "A descrição pode ter no máximo 500 caracteres.",
    });
    expect(okMax).toMatchObject({ ok: true });
    expect(badMax).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(await rows(request)).toBe(2);
  });

  it("operador de outro setor: NOT_FOUND e sem revalidar", async () => {
    const { payload, caio, outro } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: caio.id, sectorId: outro.id }),
    );

    const result = await createRequestAction(payload());

    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await rows(request)).toBe(0);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("falha inesperada do banco vira INTERNAL sem vazar o texto", async () => {
    const { asAna, payload } = await scenario();
    asAna();
    mocks.database.current = {
      transaction: async () => {
        throw new Error('relation "request" does not exist');
      },
    };
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await createRequestAction(payload());
    mocks.database.current = db;
    consoleError.mockRestore();

    expect(result).toEqual({
      ok: false,
      code: "INTERNAL",
      message: "Não foi possível concluir. Tente de novo.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("moveRequestAction", () => {
  it("move, grava o evento e revalida", async () => {
    const { asAna, uld, ana } = await scenario();
    asAna();
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
    });

    const result = await moveRequestAction({
      id: created.id,
      from: "requested",
      to: "in_transit",
    });

    expect(result).toMatchObject({ ok: true, status: "in_transit" });
    expect(await rows(requestStatusEvent)).toBe(2);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)", "layout");
  });

  it("mover para Cancelada é recusado pelo schema, com a mensagem no campo to", async () => {
    const { asAna, uld, ana } = await scenario();
    asAna();
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
    });

    const result = await moveRequestAction({
      id: created.id,
      from: "requested",
      to: "cancelled",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Para cancelar, use “Cancelar solicitação” e informe o motivo.",
      fieldErrors: {
        to: "Para cancelar, use “Cancelar solicitação” e informe o motivo.",
      },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("status inexistente e id malformado: INVALID_INPUT", async () => {
    const { asAna } = await scenario();
    asAna();

    const badStatus = await moveRequestAction({
      id: "00000000-0000-4000-8000-000000000000",
      from: "requested",
      to: "arquivada",
    });
    const badId = await moveRequestAction({
      id: "x",
      from: "requested",
      to: "delivered",
    });

    expect(badStatus).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Status inválido. Atualize a página.",
    });
    expect(badId).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Registro inválido. Atualize a página.",
    });
  });

  it("operador de outro setor: NOT_FOUND, nada muda, sem revalidar", async () => {
    const { uld, ana, caio, outro } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: caio.id, sectorId: outro.id }),
    );
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
    });

    const result = await moveRequestAction({
      id: created.id,
      from: "requested",
      to: "in_transit",
    });

    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    const [row] = await db.select().from(request);
    expect(row?.status).toBe("requested");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("conflito: STATUS_CONFLICT volta como falha e não revalida", async () => {
    const { asAna, uld, ana } = await scenario();
    asAna();
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
    });
    await moveRequestAction({
      id: created.id,
      from: "requested",
      to: "in_transit",
    });
    mocks.revalidatePath.mockReset();

    const late = await moveRequestAction({
      id: created.id,
      from: "requested",
      to: "delivered",
    });

    expect(late).toMatchObject({ ok: false, code: "STATUS_CONFLICT" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("cancelRequestAction", () => {
  it("cancela com motivo: status, evento e comentário ligado; revalida", async () => {
    const { asAna, uld, ana } = await scenario();
    asAna();
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
    });

    const result = await cancelRequestAction({
      id: created.id,
      from: "requested",
      reason: "  Pedido duplicado  ",
    });

    expect(result).toMatchObject({ ok: true, status: "cancelled" });
    const [comment] = await db
      .select()
      .from(requestComment)
      .where(eq(requestComment.requestId, created.id));
    expect(comment).toMatchObject({ body: "Pedido duplicado" });
    expect(comment?.statusEventId).not.toBeNull();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)", "layout");
  });

  it.each([
    ["vazio", "", "Informe o motivo do cancelamento."],
    ["só espaços", "   ", "Informe o motivo do cancelamento."],
    [
      "501 pontos de código",
      "😀".repeat(501),
      "O motivo pode ter no máximo 500 caracteres.",
    ],
  ])("motivo %s: INVALID_INPUT no campo reason, nada muda", async (_label, reason, message) => {
    const { asAna, uld, ana } = await scenario();
    asAna();
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
    });

    const result = await cancelRequestAction({
      id: created.id,
      from: "requested",
      reason,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message,
      fieldErrors: { reason: message },
    });
    const [row] = await db.select().from(request);
    expect(row?.status).toBe("requested");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("motivo com exatamente 500 pontos de código passa", async () => {
    const { asAna, uld, ana } = await scenario();
    asAna();
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
    });

    const result = await cancelRequestAction({
      id: created.id,
      from: "requested",
      reason: "😀".repeat(500),
    });

    expect(result).toMatchObject({ ok: true });
  });

  it("cancelar duas vezes: a 2ª é NO_CHANGES com quem e quando, sem revalidar", async () => {
    const { asAna, uld, ana } = await scenario();
    asAna();
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
    });
    await cancelRequestAction({
      id: created.id,
      from: "requested",
      reason: "Primeiro",
    });
    mocks.revalidatePath.mockReset();

    const late = await cancelRequestAction({
      id: created.id,
      from: "requested",
      reason: "Segundo",
    });

    expect(late).toEqual({
      ok: false,
      code: "NO_CHANGES",
      message:
        "Esta solicitação já foi cancelada por Ana Teste em 21/11/2026 às 14:05.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("addCommentAction", () => {
  it("comenta, devolve o id e revalida o layout do app", async () => {
    const { asAna, uld, ana } = await scenario();
    asAna();
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
    });

    const result = await addCommentAction({
      requestId: created.id,
      body: "  Fita separada\r\nna doca  ",
    });

    expect(result).toMatchObject({ ok: true });
    const [row] = await db.select().from(requestComment);
    expect(row).toMatchObject({
      authorId: ana.id,
      body: "Fita separada\nna doca",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)", "layout");
  });

  it.each([
    ["vazio", "", "Escreva o comentário."],
    ["só espaços", "   ", "Escreva o comentário."],
    [
      "2.001 pontos de código",
      "😀".repeat(2001),
      "O comentário pode ter no máximo 2.000 caracteres.",
    ],
  ])("comentário %s: INVALID_INPUT no campo body, nada gravado", async (_label, body, message) => {
    const { asAna, uld, ana } = await scenario();
    asAna();
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
    });

    const result = await addCommentAction({ requestId: created.id, body });

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message,
      fieldErrors: { body: message },
    });
    expect(await db.select().from(requestComment)).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("2.000 pontos de código passam", async () => {
    const { asAna, uld, ana } = await scenario();
    asAna();
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
    });

    const result = await addCommentAction({
      requestId: created.id,
      body: "😀".repeat(2000),
    });

    expect(result).toMatchObject({ ok: true });
  });

  it("operador de outro setor: NOT_FOUND; setor inativo: SECTOR_INACTIVE; sem revalidar", async () => {
    const { uld, ana, caio, outro, asAna } = await scenario();
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: caio.id, sectorId: outro.id }),
    );
    const stranger = await addCommentAction({
      requestId: created.id,
      body: "Intruso",
    });
    asAna();
    await client.exec(
      `UPDATE "sector" SET "active" = false WHERE "id" = '${uld.id}'`,
    );
    const inactive = await addCommentAction({
      requestId: created.id,
      body: "Setor parado",
    });

    expect(stranger).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(inactive).toMatchObject({ ok: false, code: "SECTOR_INACTIVE" });
    expect(await db.select().from(requestComment)).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteCommentAction", () => {
  it("apaga o próprio comentário e revalida", async () => {
    const { asAna, uld, ana } = await scenario();
    asAna();
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
    });
    const own = await insertRequestComment(db, {
      requestId: created.id,
      authorId: ana.id,
    });

    const result = await deleteCommentAction({ id: own.id });

    expect(result).toEqual({ ok: true });
    const [row] = await db.select().from(requestComment);
    expect(row?.deletedAt).toEqual(spDate(TODAY, "14:05"));
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)", "layout");
  });

  it("comentário de outra pessoa: FORBIDDEN, nada muda, sem revalidar", async () => {
    const { asAna, uld, ana } = await scenario();
    asAna();
    const colega = await insertUser(db, {
      role: "operator",
      sectorId: uld.id,
      name: "Bia Teste",
    });
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
    });
    const others = await insertRequestComment(db, {
      requestId: created.id,
      authorId: colega.id,
    });

    const result = await deleteCommentAction({ id: others.id });

    expect(result).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
      message: "Só quem escreveu o comentário pode apagá-lo.",
    });
    const [row] = await db.select().from(requestComment);
    expect(row?.deletedAt).toBeNull();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("o motivo do cancelamento: FORBIDDEN até para o autor", async () => {
    const { asAna, uld, ana } = await scenario();
    asAna();
    const cancelled = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
      status: "cancelled",
    });
    const [reason] = await db
      .select()
      .from(requestComment)
      .where(eq(requestComment.requestId, cancelled.id));

    const result = await deleteCommentAction({ id: reason?.id });

    expect(result).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
      message: "O motivo do cancelamento não pode ser apagado.",
    });
  });

  it("id malformado: INVALID_INPUT; apagar duas vezes: NOT_FOUND", async () => {
    const { asAna, uld, ana } = await scenario();
    asAna();
    const created = await insertRequest(db, {
      sectorId: uld.id,
      createdBy: ana.id,
    });
    const own = await insertRequestComment(db, {
      requestId: created.id,
      authorId: ana.id,
    });
    await deleteCommentAction({ id: own.id });
    mocks.revalidatePath.mockReset();

    const malformed = await deleteCommentAction({ id: "x" });
    const twice = await deleteCommentAction({ id: own.id });

    expect(malformed).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Registro inválido. Atualize a página.",
    });
    expect(twice).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
      message: "Comentário não encontrado. Atualize a página.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
