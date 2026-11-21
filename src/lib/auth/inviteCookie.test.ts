import { describe, expect, it } from "vitest";

import {
  INVITE_COOKIE,
  INVITE_COOKIE_MAX_AGE_SECONDS,
  inviteCookieOptions,
} from "./inviteCookie";

describe("inviteCookie", () => {
  it("usa o nome fixo do contrato e dura 1 hora", () => {
    expect(INVITE_COOKIE).toBe("closery_invite");
    expect(INVITE_COOKIE_MAX_AGE_SECONDS).toBe(3600);
  });

  it("em produção: httpOnly, lax, secure, path / e maxAge de 1 h", () => {
    expect(inviteCookieOptions(true)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 3600,
    });
  });

  it("fora de produção: secure desligado (http://localhost)", () => {
    expect(inviteCookieOptions(false).secure).toBe(false);
  });

  it("nunca é Strict (o retorno do OAuth não levaria o cookie)", () => {
    expect(inviteCookieOptions(true).sameSite).toBe("lax");
    expect(inviteCookieOptions(false).sameSite).toBe("lax");
  });
});
