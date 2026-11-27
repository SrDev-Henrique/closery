import { beforeEach, describe, expect, it, vi } from "vitest";

import { authzOf } from "../../../test/authz";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  cookieSet: vi.fn(),
  revalidatePath: vi.fn(),
  touched: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.cookieSet }),
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", () => ({
  get db() {
    mocks.touched();
    return {};
  },
}));

import { dismissInviteCardAction } from "./actions";

const NOT_FOUND = Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;404"), {
  digest: "NEXT_HTTP_ERROR_FALLBACK;404",
});
const REDIRECT = Object.assign(new Error("NEXT_REDIRECT"), {
  digest: "NEXT_REDIRECT;replace;/entrar;307;",
});

describe("dismissInviteCardAction", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mocks.requireAdmin.mockReset();
    mocks.cookieSet.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.touched.mockReset();
    mocks.requireAdmin.mockResolvedValue(authzOf({ role: "admin" }));
  });

  it("admin: grava o cookie com os atributos exatos, atualiza o Início e não devolve nada (vai direto no <form action>)", async () => {
    vi.stubEnv("NODE_ENV", "test");

    const result = await dismissInviteCardAction();

    expect(result).toBeUndefined();
    expect(mocks.cookieSet).toHaveBeenCalledTimes(1);
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      "closery-convite-dispensado",
      "1",
      {
        httpOnly: true,
        sameSite: "lax",
        secure: false,
        path: "/",
        maxAge: 31_536_000,
      },
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
  });

  it("em produção o cookie é secure", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await dismissInviteCardAction();

    expect(mocks.cookieSet).toHaveBeenCalledWith(
      "closery-convite-dispensado",
      "1",
      expect.objectContaining({ secure: true }),
    );
  });

  it("operador: recebe notFound; nada é gravado nem atualizado", async () => {
    mocks.requireAdmin.mockRejectedValue(NOT_FOUND);

    await expect(dismissInviteCardAction()).rejects.toBe(NOT_FOUND);

    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("sem sessão: recebe o redirect de entrada; nada é gravado nem atualizado", async () => {
    mocks.requireAdmin.mockRejectedValue(REDIRECT);

    await expect(dismissInviteCardAction()).rejects.toBe(REDIRECT);

    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("não toca o banco (a dispensa é só do navegador)", async () => {
    await dismissInviteCardAction();

    expect(mocks.touched).not.toHaveBeenCalled();
  });
});
