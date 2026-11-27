import { describe, expect, it } from "vitest";

import {
  checkHealth,
  checkHsts,
  checkNoindex,
  checkNoReferrer,
  checkPublicPage,
  checkRedirectToSignIn,
  checkRegion,
  checkRobots,
  checkSecurityHeaders,
  formatSmokeReport,
  functionRegionOf,
  parseSmokeArgs,
  SMOKE_LABELS,
  SMOKE_TIMEOUT_MS,
  SMOKE_USAGE,
} from "../scripts/smokeChecks.mjs";

// Guarda das regras puras do smoke test (scripts/smokeChecks.mjs). O CLI
// (scripts/smoke.mjs) só busca as páginas e chama estas funções.

const SECURITY = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy": "frame-ancestors 'none'",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "x-robots-tag": "noindex, nofollow",
};

function without(name: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(SECURITY).filter(([key]) => key !== name),
  );
}

describe("SMOKE_LABELS", () => {
  it("tem os dez rótulos do contrato, congelados", () => {
    expect(Object.keys(SMOKE_LABELS)).toEqual([
      "health",
      "region",
      "hsts",
      "security-headers",
      "noindex",
      "robots",
      "no-referrer-convite",
      "no-referrer-redefinir",
      "redirect",
      "privacy",
    ]);
    expect(Object.isFrozen(SMOKE_LABELS)).toBe(true);
    expect(SMOKE_LABELS.health).toBe(
      "GET /api/health responde 200 com o banco",
    );
  });
});

describe("parseSmokeArgs", () => {
  it("fica só com a origem e descarta caminho e query", () => {
    expect(parseSmokeArgs(["https://x.vercel.app/qualquer?y=1"])).toEqual({
      origin: "https://x.vercel.app",
      local: false,
    });
  });

  it.each([
    ["http://localhost:3201", "http://localhost:3201"],
    ["http://127.0.0.1:3201", "http://127.0.0.1:3201"],
  ])("aceita http só para o próprio computador (%s)", (arg, origin) => {
    expect(parseSmokeArgs([arg, "--local"])).toEqual({ origin, local: true });
  });

  it("lê --local antes ou depois da URL", () => {
    expect(parseSmokeArgs(["--local", "http://localhost:3201"]).local).toBe(
      true,
    );
  });

  it("recusa --local fora do localhost", () => {
    const message = `--local só vale para localhost. ${SMOKE_USAGE}`;
    expect(() => parseSmokeArgs(["https://x.vercel.app", "--local"])).toThrow(
      message,
    );
    expect(() => parseSmokeArgs(["--local", "https://x.vercel.app"])).toThrow(
      message,
    );
  });

  it("recusa http fora do localhost e protocolo que não é web", () => {
    const message = `Use https:// (http só para localhost). ${SMOKE_USAGE}`;
    expect(() => parseSmokeArgs(["http://exemplo.test"])).toThrow(message);
    expect(() => parseSmokeArgs(["ftp://exemplo.test"])).toThrow(message);
  });

  it("recusa sem URL, URL inválida e argumento desconhecido, com o uso", () => {
    expect(() => parseSmokeArgs([])).toThrow(
      `Informe a URL do app. ${SMOKE_USAGE}`,
    );
    expect(() => parseSmokeArgs(["--local"])).toThrow(
      `Informe a URL do app. ${SMOKE_USAGE}`,
    );
    expect(() => parseSmokeArgs(["nao-e-url"])).toThrow(
      `URL inválida: nao-e-url. ${SMOKE_USAGE}`,
    );
    expect(() => parseSmokeArgs(["https://x.vercel.app", "--rapido"])).toThrow(
      `Argumento desconhecido: --rapido. ${SMOKE_USAGE}`,
    );
    expect(() =>
      parseSmokeArgs(["https://x.vercel.app", "https://y.vercel.app"]),
    ).toThrow(`Argumento desconhecido: https://y.vercel.app. ${SMOKE_USAGE}`);
  });
});

describe("checkHealth", () => {
  const good = JSON.stringify({ status: "ok", database: "ok", latencyMs: 12 });

  it("ok com 200 e o JSON do banco ok", () => {
    expect(checkHealth(200, good)).toMatchObject({
      id: "health",
      status: "ok",
      detail: null,
    });
  });

  it("falha com 503 (banco inacessível)", () => {
    expect(
      checkHealth(
        503,
        JSON.stringify({ status: "error", database: "unreachable" }),
      ),
    ).toMatchObject({ status: "falhou", detail: "status 503" });
  });

  it.each([
    ["corpo que não é JSON", "<html>erro</html>"],
    [
      "JSON com o banco diferente de ok",
      JSON.stringify({ status: "ok", database: "slow" }),
    ],
    ["JSON sem os campos", "{}"],
    ["JSON nulo", "null"],
    ["corpo vazio", ""],
  ])("200 com %s é resposta inesperada", (_name, body) => {
    expect(checkHealth(200, body)).toMatchObject({
      status: "falhou",
      detail: "resposta inesperada",
    });
  });
});

describe("functionRegionOf", () => {
  it.each([
    ["gru1::gru1::abc-1700000000000-def", "gru1"],
    ["gru1::iad1::abc-1700000000000-def", "iad1"],
    ["gru1::iad1", null],
    ["gru1::", null],
    ["gru1::abc-123", null],
    ["gru1", null],
    ["", null],
    [null, null],
    [undefined, null],
  ])("%s → %s", (value, expected) => {
    expect(functionRegionOf(value)).toBe(expected);
  });
});

describe("checkRegion", () => {
  it("local fica pulado, com ou sem cabeçalho", () => {
    expect(checkRegion(null, true).status).toBe("pulado");
    expect(checkRegion("gru1::iad1::x", true).status).toBe("pulado");
  });

  it("ok quando a função roda em gru1", () => {
    expect(checkRegion("gru1::gru1::abc-1", false)).toMatchObject({
      id: "region",
      status: "ok",
    });
  });

  it("falha sem o cabeçalho, em outra região e com formato desconhecido", () => {
    expect(checkRegion(null, false)).toMatchObject({
      status: "falhou",
      detail: "sem x-vercel-id",
    });
    expect(checkRegion("gru1::iad1::abc-1", false)).toMatchObject({
      status: "falhou",
      detail: "região iad1 (x-vercel-id: gru1::iad1::abc-1)",
    });
    expect(checkRegion("abc", false)).toMatchObject({
      status: "falhou",
      detail: "região desconhecida (x-vercel-id: abc)",
    });
  });
});

describe("checkHsts", () => {
  it("local fica pulado", () => {
    expect(checkHsts(new Headers(), true).status).toBe("pulado");
  });

  it("ok com max-age", () => {
    const headers = new Headers({
      "strict-transport-security":
        "max-age=63072000; includeSubDomains; preload",
    });
    expect(checkHsts(headers, false)).toMatchObject({
      id: "hsts",
      status: "ok",
    });
  });

  it("falha sem o cabeçalho e com valor sem max-age", () => {
    expect(checkHsts(new Headers(), false)).toMatchObject({
      status: "falhou",
      detail: "sem Strict-Transport-Security",
    });
    expect(
      checkHsts(new Headers({ "strict-transport-security": "preload" }), false),
    ).toMatchObject({
      status: "falhou",
      detail: "Strict-Transport-Security sem max-age: preload",
    });
  });
});

describe("checkSecurityHeaders", () => {
  it("ok com os seis valores exatos e status 200", () => {
    expect(checkSecurityHeaders(200, new Headers(SECURITY))).toMatchObject({
      id: "security-headers",
      status: "ok",
    });
  });

  it("falha com status diferente de 200, antes de olhar os cabeçalhos", () => {
    expect(checkSecurityHeaders(307, new Headers(SECURITY))).toMatchObject({
      status: "falhou",
      detail: "status 307",
    });
  });

  it("falha dizendo qual cabeçalho falta", () => {
    expect(
      checkSecurityHeaders(200, new Headers(without("x-frame-options"))),
    ).toMatchObject({ status: "falhou", detail: "falta X-Frame-Options" });
  });

  it("falha dizendo o cabeçalho e o valor errado (inclusive CSP com script-src)", () => {
    expect(
      checkSecurityHeaders(
        200,
        new Headers({
          ...SECURITY,
          "content-security-policy": "default-src 'self'",
        }),
      ),
    ).toMatchObject({
      status: "falhou",
      detail: "Content-Security-Policy: default-src 'self'",
    });
  });
});

describe("checkNoindex", () => {
  const html = '<head><meta name="robots" content="noindex, nofollow"/></head>';
  const header = new Headers({ "x-robots-tag": "noindex, nofollow" });

  it("ok com o cabeçalho e a meta", () => {
    expect(checkNoindex(header, html)).toMatchObject({
      id: "noindex",
      status: "ok",
    });
  });

  it("cabeçalho sem a meta falha", () => {
    expect(checkNoindex(header, "<head></head>")).toMatchObject({
      status: "falhou",
      detail: "falta a meta robots no HTML",
    });
  });

  it("meta sem o cabeçalho falha, e o valor errado também", () => {
    expect(checkNoindex(new Headers(), html)).toMatchObject({
      status: "falhou",
      detail: "X-Robots-Tag: ausente",
    });
    expect(
      checkNoindex(new Headers({ "x-robots-tag": "noindex" }), html),
    ).toMatchObject({ status: "falhou", detail: "X-Robots-Tag: noindex" });
  });
});

describe("checkRobots", () => {
  it("ok com 200, User-Agent * e Disallow /", () => {
    expect(checkRobots(200, "User-Agent: *\nDisallow: /\n")).toMatchObject({
      id: "robots",
      status: "ok",
    });
  });

  it("falha com status diferente de 200 e com robots.txt que libera", () => {
    expect(checkRobots(404, "")).toMatchObject({
      status: "falhou",
      detail: "status 404",
    });
    expect(checkRobots(200, "User-Agent: *\nAllow: /\n")).toMatchObject({
      status: "falhou",
      detail: "o robots.txt não bloqueia tudo",
    });
  });

  it("falha quando o Disallow é de um caminho e não da raiz", () => {
    expect(
      checkRobots(200, "User-Agent: *\nDisallow: /admin\nAllow: /\n"),
    ).toMatchObject({
      status: "falhou",
      detail: "o robots.txt não bloqueia tudo",
    });
  });

  it("aceita User-agent em outra caixa e espaços no fim da linha", () => {
    expect(
      checkRobots(200, "user-agent: *  \r\ndisallow: /  \r\n"),
    ).toMatchObject({ status: "ok" });
  });
});

describe("checkNoReferrer", () => {
  it.each<"no-referrer-convite" | "no-referrer-redefinir">([
    "no-referrer-convite",
    "no-referrer-redefinir",
  ])("%s: ok com no-referrer", (id) => {
    expect(
      checkNoReferrer(id, new Headers({ "referrer-policy": "no-referrer" })),
    ).toMatchObject({ id, status: "ok" });
  });

  it("falha com a política global e sem o cabeçalho", () => {
    expect(
      checkNoReferrer(
        "no-referrer-convite",
        new Headers({ "referrer-policy": "strict-origin-when-cross-origin" }),
      ),
    ).toMatchObject({
      status: "falhou",
      detail: "Referrer-Policy: strict-origin-when-cross-origin",
    });
    expect(
      checkNoReferrer("no-referrer-redefinir", new Headers()),
    ).toMatchObject({
      status: "falhou",
      detail: "Referrer-Policy: ausente",
    });
  });
});

describe("checkRedirectToSignIn", () => {
  it.each([
    "/entrar",
    "https://x.vercel.app/entrar",
  ])("307 para %s é ok", (location) => {
    expect(checkRedirectToSignIn(307, location)).toMatchObject({
      id: "redirect",
      status: "ok",
    });
  });

  it("200 falha", () => {
    expect(checkRedirectToSignIn(200, null)).toMatchObject({
      status: "falhou",
      detail: "status 200",
    });
  });

  it("307 para outro lugar e 307 sem Location falham", () => {
    expect(checkRedirectToSignIn(307, "/login")).toMatchObject({
      status: "falhou",
      detail: "Location: /login",
    });
    expect(checkRedirectToSignIn(307, null)).toMatchObject({
      status: "falhou",
      detail: "sem Location",
    });
  });
});

describe("checkPublicPage", () => {
  it("200 é ok; redirecionamento e erro falham", () => {
    expect(checkPublicPage(200)).toMatchObject({ id: "privacy", status: "ok" });
    expect(checkPublicPage(307)).toMatchObject({
      status: "falhou",
      detail: "status 307",
    });
    expect(checkPublicPage(500)).toMatchObject({
      status: "falhou",
      detail: "status 500",
    });
  });
});

describe("formatSmokeReport", () => {
  const okResult = checkPublicPage(200);
  const failResult = checkPublicPage(503);
  const skipped = checkRegion(null, true);

  it("escreve uma linha por verificação e o resumo, e sai com 0 sem falha", () => {
    expect(formatSmokeReport([okResult, skipped])).toEqual({
      text: [
        "[OK] /privacidade abre sem sessão",
        "[PULADO] Função em gru1 (x-vercel-id) (só na Vercel)",
        "Resultado: 1 OK, 0 FALHOU, 1 PULADO.",
      ].join("\n"),
      exitCode: 0,
    });
  });

  it("qualquer FALHOU leva o código de saída a 1", () => {
    expect(formatSmokeReport([okResult, failResult, skipped])).toEqual({
      text: [
        "[OK] /privacidade abre sem sessão",
        "[FALHOU] /privacidade abre sem sessão: status 503",
        "[PULADO] Função em gru1 (x-vercel-id) (só na Vercel)",
        "Resultado: 1 OK, 1 FALHOU, 1 PULADO.",
      ].join("\n"),
      exitCode: 1,
    });
  });

  it("sem verificações o resumo é zero e o código é 0", () => {
    expect(formatSmokeReport([])).toEqual({
      text: "Resultado: 0 OK, 0 FALHOU, 0 PULADO.",
      exitCode: 0,
    });
  });
});

describe("SMOKE_TIMEOUT_MS", () => {
  it("cada GET tem um prazo finito, para o smoke sempre terminar com veredito", () => {
    expect(SMOKE_TIMEOUT_MS).toBe(15_000);
  });
});
