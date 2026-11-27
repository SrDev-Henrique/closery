import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.get, set: mocks.set }),
}));

import {
  INVITE_CARD_DISMISSED_COOKIE,
  INVITE_CARD_DISMISSED_MAX_AGE_SECONDS,
  readInviteCardDismissed,
  rememberInviteCardDismissed,
  shouldShowInviteCard,
} from "./firstAccess";

describe("shouldShowInviteCard", () => {
  const FIRST = { people: 1, pendingInvites: 0 };

  it("admin sozinho, sem convites e sem dispensa: mostra", () => {
    expect(
      shouldShowInviteCard({ isAdmin: true, counts: FIRST, dismissed: false }),
    ).toBe(true);
  });

  it("operador nunca vê, mesmo com a equipe vazia", () => {
    expect(
      shouldShowInviteCard({ isAdmin: false, counts: FIRST, dismissed: false }),
    ).toBe(false);
  });

  it("2 pessoas: a equipe já existe", () => {
    expect(
      shouldShowInviteCard({
        isAdmin: true,
        counts: { people: 2, pendingInvites: 0 },
        dismissed: false,
      }),
    ).toBe(false);
  });

  it("1 pessoa e 1 convite pendente: já convidou, não mostra", () => {
    expect(
      shouldShowInviteCard({
        isAdmin: true,
        counts: { people: 1, pendingInvites: 1 },
        dismissed: false,
      }),
    ).toBe(false);
  });

  it("dispensado pelo cookie: não mostra", () => {
    expect(
      shouldShowInviteCard({ isAdmin: true, counts: FIRST, dismissed: true }),
    ).toBe(false);
  });

  it("0 pessoas (não acontece, mas não pode mostrar) e muitas pessoas", () => {
    expect(
      shouldShowInviteCard({
        isAdmin: true,
        counts: { people: 0, pendingInvites: 0 },
        dismissed: false,
      }),
    ).toBe(false);
    expect(
      shouldShowInviteCard({
        isAdmin: true,
        counts: { people: 40, pendingInvites: 3 },
        dismissed: false,
      }),
    ).toBe(false);
  });
});

describe("cookie de dispensa", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.set.mockReset();
    vi.unstubAllEnvs();
  });

  it("o nome do cookie e a validade são os da spec", () => {
    expect(INVITE_CARD_DISMISSED_COOKIE).toBe("closery-convite-dispensado");
    expect(INVITE_CARD_DISMISSED_MAX_AGE_SECONDS).toBe(31_536_000);
  });

  it("valor 1: dispensado", async () => {
    mocks.get.mockReturnValue({
      name: INVITE_CARD_DISMISSED_COOKIE,
      value: "1",
    });

    expect(await readInviteCardDismissed()).toBe(true);
    expect(mocks.get).toHaveBeenCalledWith(INVITE_CARD_DISMISSED_COOKIE);
  });

  it("sem cookie ou com outro valor: não dispensado (o cartão aparece)", async () => {
    mocks.get.mockReturnValue(undefined);
    expect(await readInviteCardDismissed()).toBe(false);

    mocks.get.mockReturnValue({
      name: INVITE_CARD_DISMISSED_COOKIE,
      value: "0",
    });
    expect(await readInviteCardDismissed()).toBe(false);

    mocks.get.mockReturnValue({
      name: INVITE_CARD_DISMISSED_COOKIE,
      value: "",
    });
    expect(await readInviteCardDismissed()).toBe(false);
  });

  it("grava com os atributos da spec (fora de produção, sem secure)", async () => {
    vi.stubEnv("NODE_ENV", "test");

    await rememberInviteCardDismissed();

    expect(mocks.set).toHaveBeenCalledWith("closery-convite-dispensado", "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 31_536_000,
    });
  });

  it("em produção o cookie é secure", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await rememberInviteCardDismissed();

    expect(mocks.set).toHaveBeenCalledWith(
      "closery-convite-dispensado",
      "1",
      expect.objectContaining({ secure: true }),
    );
  });
});
