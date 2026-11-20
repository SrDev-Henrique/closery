import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { findInviteByToken } from "@/features/invites/inviteQueries";
import { INVITE_COOKIE, inviteCookieOptions } from "@/lib/auth/inviteCookie";
import { insertInvite, insertSector } from "../../../../../test/fixtures";
import { armInvite } from "./actions";

const mocks = vi.hoisted(() => ({ set: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.set }),
}));

vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../../../test/db");
  const { db } = await createTestDb();
  return { db };
});

const HINT = "Peça um novo convite a quem te convidou.";
const ABSENT_TOKEN = "A".repeat(43);
const DAY = 24 * 60 * 60 * 1000;

afterEach(() => {
  mocks.set.mockClear();
  vi.unstubAllEnvs();
});

describe("armInvite", () => {
  let sectorId: string;

  beforeAll(async () => {
    sectorId = (await insertSector(db)).id;
  });

  it.each([
    ["vazio", ""],
    ["curto demais", "abc"],
    ["com caractere inválido", `${"A".repeat(42)}!`],
    ["longo demais", "A".repeat(44)],
  ])("token malformado (%s) não grava cookie", async (_label, token) => {
    const result = await armInvite(token);
    expect(result).toEqual({
      ok: false,
      message: `Convite não encontrado. ${HINT}`,
    });
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("token inexistente não grava cookie", async () => {
    const result = await armInvite(ABSENT_TOKEN);
    expect(result).toEqual({
      ok: false,
      message: `Convite não encontrado. ${HINT}`,
    });
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("convite expirado não grava cookie", async () => {
    const { token } = await insertInvite(db, {
      role: "operator",
      sectorId,
      expiresAt: new Date(Date.now() - DAY),
    });
    const result = await armInvite(token);
    expect(result).toEqual({
      ok: false,
      message: `Este convite expirou. ${HINT}`,
    });
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("convite já usado não grava cookie", async () => {
    const { token } = await insertInvite(db, {
      role: "operator",
      sectorId,
      usedAt: new Date(),
    });
    const result = await armInvite(token);
    expect(result).toEqual({
      ok: false,
      message: `Este convite já foi usado. ${HINT}`,
    });
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("convite cancelado não grava cookie", async () => {
    const { token } = await insertInvite(db, {
      role: "operator",
      sectorId,
      cancelledAt: new Date(),
    });
    const result = await armInvite(token);
    expect(result).toEqual({
      ok: false,
      message: `Este convite foi cancelado. ${HINT}`,
    });
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("convite válido grava o cookie com as opções do contrato", async () => {
    const { token } = await insertInvite(db, { role: "operator", sectorId });
    const result = await armInvite(token);
    expect(result).toEqual({ ok: true });
    expect(mocks.set).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledWith(
      INVITE_COOKIE,
      token,
      inviteCookieOptions(false),
    );
  });

  it("em produção o cookie é Secure", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { token } = await insertInvite(db, { role: "admin" });
    await armInvite(token);
    expect(mocks.set).toHaveBeenCalledWith(
      INVITE_COOKIE,
      token,
      expect.objectContaining({
        secure: true,
        httpOnly: true,
        sameSite: "lax",
      }),
    );
  });

  it("nunca consome o convite (prefetch e scanner não gastam)", async () => {
    const { token } = await insertInvite(db, { role: "operator", sectorId });
    await armInvite(token);
    await armInvite(token);
    const details = await findInviteByToken(db, token, new Date());
    expect(details?.state).toBe("valid");
  });
});
