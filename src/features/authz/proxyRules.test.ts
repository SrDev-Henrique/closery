import { describe, expect, it } from "vitest";

import {
  isPublicPath,
  PUBLIC_PATH_PREFIXES,
  shouldRedirectToSignIn,
} from "./proxyRules";

describe("isPublicPath", () => {
  it("os prefixos públicos são /entrar e /convite", () => {
    expect(PUBLIC_PATH_PREFIXES).toEqual(["/entrar", "/convite"]);
  });

  it.each([
    "/entrar",
    "/entrar/",
    "/convite",
    "/convite/abc123",
    "/convite/abc123/",
  ])("%s é pública", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/conta",
    "/admin",
    "/bem-vindo",
    "/entrarx",
    "/entrar-admin",
    "/convites",
    "/convitex/abc",
    "/admin/entrar",
    "//entrar",
    "/Entrar",
    "",
  ])("%s é privada (prefixo parecido não conta)", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });
});

describe("shouldRedirectToSignIn", () => {
  it.each([
    "/",
    "/conta",
    "/admin",
    "/bem-vindo",
    "/passagens/nova",
  ])("rota privada %s sem cookie → redireciona", (pathname) => {
    expect(shouldRedirectToSignIn(pathname, false)).toBe(true);
  });

  it.each([
    "/",
    "/conta",
    "/admin",
    "/bem-vindo",
  ])("rota privada %s com cookie → deixa passar", (pathname) => {
    expect(shouldRedirectToSignIn(pathname, true)).toBe(false);
  });

  it.each([
    "/entrar",
    "/convite/abc123",
  ])("rota pública %s não redireciona, com ou sem cookie", (pathname) => {
    expect(shouldRedirectToSignIn(pathname, false)).toBe(false);
    expect(shouldRedirectToSignIn(pathname, true)).toBe(false);
  });

  it.each([
    "/api",
    "/api/auth/sign-in/email",
    "/api/health",
  ])("%s nunca redireciona", (pathname) => {
    expect(shouldRedirectToSignIn(pathname, false)).toBe(false);
  });

  it.each([
    "/entrarx",
    "/entrar-admin",
    "/apix",
    "/apiary",
    "/convites",
  ])("prefixo parecido %s sem cookie → redireciona", (pathname) => {
    expect(shouldRedirectToSignIn(pathname, false)).toBe(true);
  });
});
