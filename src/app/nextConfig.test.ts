import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("next.config headers", () => {
  it("/convite/* envia Referrer-Policy: no-referrer", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const rule = rules.find((r) => r.source === "/convite/:path*");
    expect(rule?.headers ?? []).toContainEqual({
      key: "Referrer-Policy",
      value: "no-referrer",
    });
  });

  it("não aplica a política às demais rotas", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules.map((r) => r.source)).toEqual(["/convite/:path*"]);
  });

  it("mantém as opções anteriores do arquivo", () => {
    expect(nextConfig.cacheComponents).toBe(true);
    expect(nextConfig.reactCompiler).toBe(true);
  });
});
