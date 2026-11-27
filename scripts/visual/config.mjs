// Portas, URLs e argumentos das ferramentas do processo visual (spec §5.1, regra 3). Puro: nada aqui
// lê o disco, a rede ou o ambiente. O banco visual é o PGlite da 54332 e o app, o `next` da 3202. As
// portas de FORBIDDEN_PORTS são de outros: 3000 de outro projeto, 3200/54329 do E2E, 3201/54331 do dono.

export const VISUAL_DB_HOST = "127.0.0.1";
export const VISUAL_DB_PORT = 54332;
export const VISUAL_APP_PORT = 3202;
export const VISUAL_DB_URL =
  "postgres://postgres:postgres@127.0.0.1:54332/postgres";
export const VISUAL_BASE_URL = "http://localhost:3202";
export const FORBIDDEN_PORTS = Object.freeze([3000, 3200, 3201, 54329, 54331]);
/** Igual a THEME_STORAGE_KEY de src/lib/theme.ts (test/visual/config.test.ts confere). */
export const THEME_STORAGE_KEY = "closery-tema";
/** Igual a INVITE_COOKIE de src/lib/auth/inviteCookie.ts (test/visual/config.test.ts confere). */
export const VISUAL_INVITE_COOKIE = "closery_invite";
/** "Celular" é abaixo de 860px (Global Constraints). */
export const MOBILE_MAX_WIDTH = 859;

const MAX_SIZE = 3840;
const IP_SPACE = 254 * 256;

/**
 * @param {string} url
 * @param {string} label
 * @returns {URL}
 */
function parseUrl(url, label) {
  try {
    return new URL(url);
  } catch {
    throw new Error(`${label} recusado: URL inválida`);
  }
}

/**
 * Confere a URL do banco visual: só `postgres://…@127.0.0.1:54332`. A mensagem nunca traz a senha.
 * @param {string} url
 * @returns {string} a própria URL
 */
export function assertVisualDbUrl(url) {
  const parsed = parseUrl(url, "banco visual");
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`banco visual recusado: protocolo ${parsed.protocol}`);
  }
  if (
    parsed.hostname !== VISUAL_DB_HOST ||
    parsed.port !== String(VISUAL_DB_PORT)
  ) {
    const where = `${parsed.hostname}:${parsed.port || "(sem porta)"}`;
    throw new Error(
      `banco visual recusado: ${where} (só ${VISUAL_DB_HOST}:${VISUAL_DB_PORT})`,
    );
  }
  return url;
}

/**
 * Confere a URL do app visual: `http://localhost:3202` ou `http://127.0.0.1:3202`.
 * @param {string} url
 * @returns {string} a própria URL
 */
export function assertVisualBaseUrl(url) {
  const parsed = parseUrl(url, "app visual");
  const localHost =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (
    parsed.protocol !== "http:" ||
    !localHost ||
    parsed.port !== String(VISUAL_APP_PORT)
  ) {
    throw new Error(
      `app visual recusado: ${parsed.origin} (só http://localhost:${VISUAL_APP_PORT})`,
    );
  }
  return url;
}

/**
 * `--nome=valor` vira `flags.nome = "valor"`, `--nome` vira `true`; o resto é posicional, na ordem.
 * Lança em nome inválido (`--`, `--=x`) e em argumento repetido.
 * @param {readonly string[]} argv
 * @returns {{ flags: Record<string, string | true>, positional: string[] }}
 */
export function parseCliArgs(argv) {
  /** @type {Record<string, string | true>} */
  const flags = {};
  /** @type {string[]} */
  const positional = [];
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (!/^[a-z][a-z0-9-]*$/i.test(name)) {
      throw new Error(`argumento inválido: ${arg}`);
    }
    if (Object.hasOwn(flags, name)) {
      throw new Error(`argumento repetido: --${name}`);
    }
    flags[name] = eq === -1 ? true : arg.slice(eq + 1);
  }
  return { flags, positional };
}

/**
 * Tamanhos separados por vírgula ("1440,390" → [1440, 390]); sem valor, uma cópia do padrão.
 * Lança em lista vazia, zero, negativo, não inteiro e acima de 3840.
 * @param {string | undefined} value
 * @param {readonly number[]} fallback
 * @returns {number[]}
 */
export function parseSizes(value, fallback) {
  if (value === undefined) return [...fallback];
  const parts = String(value)
    .split(",")
    .map((part) => part.trim());
  if (parts.every((part) => part === "")) {
    throw new Error("tamanhos vazios");
  }
  return parts.map((part) => {
    if (!/^\d+$/.test(part)) {
      throw new Error(`tamanho inválido: "${part}" (inteiro positivo)`);
    }
    const size = Number(part);
    if (size === 0) {
      throw new Error("tamanho inválido: 0 (inteiro positivo)");
    }
    if (size > MAX_SIZE) {
      throw new Error(`tamanho inválido: ${size} (máximo ${MAX_SIZE})`);
    }
    return size;
  });
}

/**
 * IP fictício para o `x-forwarded-for` do login e do cadastro (o rate limit do Better Auth é por
 * IP): "10.77.<a>.<b>", um diferente para cada `n` de 0 a 65023.
 * @param {number} n
 * @returns {string}
 */
export function fakeClientIp(n) {
  if (!Number.isInteger(n) || n < 0 || n >= IP_SPACE) {
    throw new RangeError(`fakeClientIp: n fora de 0..${IP_SPACE - 1}: ${n}`);
  }
  return `10.77.${Math.floor(n / 254)}.${(n % 254) + 1}`;
}
