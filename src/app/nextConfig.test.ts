import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

async function rules() {
  return (await nextConfig.headers?.()) ?? [];
}

function headerValue(
  headers: { key: string; value: string }[] | undefined,
  key: string,
) {
  return headers?.find((header) => header.key === key)?.value;
}

async function globalHeaders() {
  return (await rules()).find((rule) => rule.source === "/:path*")?.headers;
}

describe("next.config headers", () => {
  it("/convite/* e /redefinir-senha/* enviam Referrer-Policy: no-referrer", async () => {
    const all = await rules();
    for (const source of ["/convite/:path*", "/redefinir-senha/:path*"]) {
      const rule = all.find((candidate) => candidate.source === source);
      expect(headerValue(rule?.headers, "Referrer-Policy"), source).toBe(
        "no-referrer",
      );
    }
  });

  it("as regras de no-referrer vêm depois da global (a posterior vence)", async () => {
    const sources = (await rules()).map((rule) => rule.source);
    expect(sources).toEqual([
      "/:path*",
      "/convite/:path*",
      "/redefinir-senha/:path*",
    ]);
  });

  it("todas as rotas recebem os cabeçalhos de segurança", async () => {
    const headers = await globalHeaders();
    expect(headerValue(headers, "X-Content-Type-Options")).toBe("nosniff");
    expect(headerValue(headers, "Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headerValue(headers, "Content-Security-Policy")).toBe(
      "frame-ancestors 'none'",
    );
    expect(headerValue(headers, "X-Frame-Options")).toBe("DENY");
    expect(headerValue(headers, "X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("Permissions-Policy desliga câmera, microfone e geolocalização", async () => {
    const policy = headerValue(await globalHeaders(), "Permissions-Policy");
    for (const feature of ["camera", "microphone", "geolocation"]) {
      expect(policy).toContain(`${feature}=()`);
    }
  });

  it("não bloqueia as passkeys: publickey-credentials-* ficam fora da política", async () => {
    const policy = headerValue(await globalHeaders(), "Permissions-Policy");
    expect(policy).not.toContain("publickey-credentials");
  });

  it("CSP só com frame-ancestors: um CSP de scripts exigiria nonce e renderização dinâmica", async () => {
    const csp = headerValue(await globalHeaders(), "Content-Security-Policy");
    expect(csp).not.toMatch(/script-src|default-src|style-src/);
  });

  it("não define HSTS: a Vercel já envia em *.vercel.app", async () => {
    expect(
      headerValue(await globalHeaders(), "Strict-Transport-Security"),
    ).toBeUndefined();
  });

  it("mantém as opções anteriores do arquivo", () => {
    expect(nextConfig.cacheComponents).toBe(true);
    expect(nextConfig.reactCompiler).toBe(true);
  });
});
