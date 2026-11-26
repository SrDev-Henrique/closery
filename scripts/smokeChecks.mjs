// Regras puras do smoke test de produção (scripts/smoke.mjs). Nada aqui faz I/O
// nem lê ambiente: o CLI busca as páginas e passa para estas funções o status,
// os cabeçalhos e o corpo. Os textos são os da seção "Textos de interface" do
// plano da Fase 6.

/** @typedef {"health"|"region"|"hsts"|"security-headers"|"noindex"|"robots"|"no-referrer-convite"|"no-referrer-redefinir"|"redirect"|"privacy"} SmokeId */
/** @typedef {{ id: SmokeId, label: string, status: "ok" | "falhou" | "pulado", detail: string | null }} SmokeResult */
/** @typedef {{ get(name: string): string | null }} HeaderBag */

// Cada GET espera no máximo isto: o smoke sempre termina com um veredito, e a
// página que não responde nesse prazo vira "sem resposta".
export const SMOKE_TIMEOUT_MS = 15_000;

export const SMOKE_USAGE =
  "Uso: bun run smoke <https://<projeto>.vercel.app> [--local]";

/** @type {Readonly<Record<SmokeId, string>>} */
export const SMOKE_LABELS = Object.freeze({
  health: "GET /api/health responde 200 com o banco",
  region: "Função em gru1 (x-vercel-id)",
  hsts: "HSTS enviado pela Vercel",
  "security-headers": "Cabeçalhos de segurança em /entrar",
  noindex: "noindex no cabeçalho e no HTML de /entrar",
  robots: "/robots.txt bloqueia os buscadores",
  "no-referrer-convite": "/convite sem Referer",
  "no-referrer-redefinir": "/redefinir-senha sem Referer",
  redirect: "/ sem sessão vai para /entrar",
  privacy: "/privacidade abre sem sessão",
});

// Os seis cabeçalhos de segurança da F6-3, com os valores exatos.
const SECURITY_HEADERS = [
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Content-Security-Policy", "frame-ancestors 'none'"],
  ["X-Frame-Options", "DENY"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
  ["X-Robots-Tag", "noindex, nofollow"],
];

const NOINDEX_VALUE = "noindex, nofollow";
const ROBOTS_META = '<meta name="robots" content="noindex, nofollow"';
const FUNCTION_REGION = "gru1";

/**
 * @param {SmokeId} id
 * @param {"ok" | "falhou" | "pulado"} status
 * @param {string | null} [detail]
 * @returns {SmokeResult}
 */
function result(id, status, detail = null) {
  return { id, label: SMOKE_LABELS[id], status, detail };
}

/** @param {SmokeId} id */
function ok(id) {
  return result(id, "ok");
}

/**
 * @param {SmokeId} id
 * @param {string} detail
 */
function failed(id, detail) {
  return result(id, "falhou", detail);
}

/**
 * @param {string[]} argv
 * @returns {{ origin: string, local: boolean }}
 */
export function parseSmokeArgs(argv) {
  let rawUrl = null;
  let local = false;
  for (const arg of argv) {
    if (arg === "--local") {
      local = true;
    } else if (arg.startsWith("--") || rawUrl !== null) {
      throw new Error(`Argumento desconhecido: ${arg}. ${SMOKE_USAGE}`);
    } else {
      rawUrl = arg;
    }
  }
  if (rawUrl === null) {
    throw new Error(`Informe a URL do app. ${SMOKE_USAGE}`);
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`URL inválida: ${rawUrl}. ${SMOKE_USAGE}`);
  }
  const isLocalHost =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const allowed =
    url.protocol === "https:" || (url.protocol === "http:" && isLocalHost);
  if (!allowed) {
    throw new Error(`Use https:// (http só para localhost). ${SMOKE_USAGE}`);
  }
  if (local && !isLocalHost) {
    throw new Error(`--local só vale para localhost. ${SMOKE_USAGE}`);
  }
  return { origin: url.origin, local };
}

/**
 * @param {number} status
 * @param {string} bodyText
 * @returns {SmokeResult}
 */
export function checkHealth(status, bodyText) {
  if (status !== 200) return failed("health", `status ${status}`);
  try {
    const body = JSON.parse(bodyText);
    if (body?.status === "ok" && body?.database === "ok") return ok("health");
  } catch {
    // corpo que não é JSON cai na resposta inesperada
  }
  return failed("health", "resposta inesperada");
}

// O x-vercel-id é "<borda>::<região da função>::<id>": a região é o penúltimo
// segmento e o valor precisa ter 3 segmentos ou mais (formato confirmado só no
// primeiro deploy, P63); com menos, a região é desconhecida.
/**
 * @param {string | null | undefined} xVercelId
 * @returns {string | null}
 */
export function functionRegionOf(xVercelId) {
  if (!xVercelId) return null;
  const segments = xVercelId.split("::");
  if (segments.length < 3) return null;
  return segments[segments.length - 2] || null;
}

/**
 * @param {string | null | undefined} xVercelId
 * @param {boolean} local
 * @returns {SmokeResult}
 */
export function checkRegion(xVercelId, local) {
  if (local) return result("region", "pulado");
  if (!xVercelId) return failed("region", "sem x-vercel-id");
  const region = functionRegionOf(xVercelId);
  if (region === null) {
    return failed("region", `região desconhecida (x-vercel-id: ${xVercelId})`);
  }
  if (region !== FUNCTION_REGION) {
    return failed("region", `região ${region} (x-vercel-id: ${xVercelId})`);
  }
  return ok("region");
}

/**
 * @param {HeaderBag} headers
 * @param {boolean} local
 * @returns {SmokeResult}
 */
export function checkHsts(headers, local) {
  if (local) return result("hsts", "pulado");
  const value = headers.get("strict-transport-security");
  if (!value) return failed("hsts", "sem Strict-Transport-Security");
  if (!/max-age=\d+/i.test(value)) {
    return failed("hsts", `Strict-Transport-Security sem max-age: ${value}`);
  }
  return ok("hsts");
}

/**
 * @param {number} status
 * @param {HeaderBag} headers
 * @returns {SmokeResult}
 */
export function checkSecurityHeaders(status, headers) {
  if (status !== 200) return failed("security-headers", `status ${status}`);
  for (const [name, expected] of SECURITY_HEADERS) {
    const value = headers.get(name);
    if (value === null) return failed("security-headers", `falta ${name}`);
    if (value !== expected) {
      return failed("security-headers", `${name}: ${value}`);
    }
  }
  return ok("security-headers");
}

/**
 * @param {HeaderBag} headers
 * @param {string} html
 * @returns {SmokeResult}
 */
export function checkNoindex(headers, html) {
  const header = headers.get("x-robots-tag");
  if (header !== NOINDEX_VALUE) {
    return failed("noindex", `X-Robots-Tag: ${header ?? "ausente"}`);
  }
  if (!html.includes(ROBOTS_META)) {
    return failed("noindex", "falta a meta robots no HTML");
  }
  return ok("noindex");
}

/**
 * @param {number} status
 * @param {string} text
 * @returns {SmokeResult}
 */
export function checkRobots(status, text) {
  if (status !== 200) return failed("robots", `status ${status}`);
  // Por linha: "Disallow: /admin" não bloqueia o site todo.
  if (
    !/^User-Agent:\s*\*\s*$/im.test(text) ||
    !/^Disallow:\s*\/\s*$/im.test(text)
  ) {
    return failed("robots", "o robots.txt não bloqueia tudo");
  }
  return ok("robots");
}

/**
 * @param {"no-referrer-convite" | "no-referrer-redefinir"} id
 * @param {HeaderBag} headers
 * @returns {SmokeResult}
 */
export function checkNoReferrer(id, headers) {
  const value = headers.get("referrer-policy");
  if (value !== "no-referrer") {
    return failed(id, `Referrer-Policy: ${value ?? "ausente"}`);
  }
  return ok(id);
}

/**
 * @param {number} status
 * @param {string | null} location
 * @returns {SmokeResult}
 */
export function checkRedirectToSignIn(status, location) {
  if (status !== 307) return failed("redirect", `status ${status}`);
  if (location === null) return failed("redirect", "sem Location");
  if (!location.endsWith("/entrar")) {
    return failed("redirect", `Location: ${location}`);
  }
  return ok("redirect");
}

/**
 * @param {number} status
 * @returns {SmokeResult}
 */
export function checkPublicPage(status) {
  if (status !== 200) return failed("privacy", `status ${status}`);
  return ok("privacy");
}

/**
 * @param {SmokeResult[]} results
 * @returns {{ text: string, exitCode: 0 | 1 }}
 */
export function formatSmokeReport(results) {
  const lines = results.map((entry) => {
    if (entry.status === "ok") return `[OK] ${entry.label}`;
    if (entry.status === "pulado")
      return `[PULADO] ${entry.label} (só na Vercel)`;
    return `[FALHOU] ${entry.label}: ${entry.detail}`;
  });
  const count = (/** @type {SmokeResult["status"]} */ status) =>
    results.filter((entry) => entry.status === status).length;
  lines.push(
    `Resultado: ${count("ok")} OK, ${count("falhou")} FALHOU, ${count("pulado")} PULADO.`,
  );
  return {
    text: lines.join("\n"),
    exitCode: count("falhou") > 0 ? 1 : 0,
  };
}
