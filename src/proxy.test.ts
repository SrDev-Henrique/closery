import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "./proxy";

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

describe("proxy", () => {
  it("rota privada sem cookie → 307 para /entrar", () => {
    const response = proxy(request("/conta"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/entrar",
    );
  });

  it("rota privada com cookie de sessão → segue", () => {
    const response = proxy(request("/conta", "better-auth.session_token=abc"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("cookie de sessão com prefixo __Secure- (produção) também vale", () => {
    const response = proxy(
      request("/", "__Secure-better-auth.session_token=abc"),
    );
    expect(response.headers.get("location")).toBeNull();
  });

  it("outro cookie qualquer não vale como sessão", () => {
    const response = proxy(request("/", "closery_invite=abc; theme=dark"));
    expect(response.status).toBe(307);
  });

  it("/entrar e /convite/x sem cookie → segue", () => {
    expect(proxy(request("/entrar")).headers.get("location")).toBeNull();
    expect(
      proxy(request(`/convite/${"A".repeat(43)}`)).headers.get("location"),
    ).toBeNull();
  });

  it("/entrarx sem cookie → /entrar (prefixo parecido não é público)", () => {
    expect(proxy(request("/entrarx")).status).toBe(307);
  });
});

describe("config.matcher", () => {
  const [source] = config.matcher;
  const regex = new RegExp(`^${source}$`);

  it.each([
    "/",
    "/conta",
    "/admin",
    "/bem-vindo",
    "/entrar",
    `/convite/${"A".repeat(43)}`,
    "/apiary",
    "/passagens/nova",
  ])("roda em %s", (pathname) => {
    expect(regex.test(pathname)).toBe(true);
  });

  it.each([
    "/api",
    "/api/auth/sign-in/email",
    "/api/health",
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/favicon.ico",
    "/logo.png",
    "/robots.txt",
    "/fonts/inter.woff2",
  ])("não roda em %s", (pathname) => {
    expect(regex.test(pathname)).toBe(false);
  });
});
