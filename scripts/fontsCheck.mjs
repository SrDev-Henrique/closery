// Regras puras da fonte Satoshi (scripts/fetchFonts.mjs). Nada aqui faz I/O de rede nem de disco: o CLI
// baixa e grava, e passa para estas funções o CSS, o peso e os bytes.
//
// A Satoshi (ITF Free Font License) pode ser servida pelo próprio site, mas os arquivos NÃO podem ir
// para o repositório (ele é público). Por isso o script baixa da Fontshare antes do dev e do build e
// confere o SHA-256 contra os valores fixados abaixo. Sem subset nem conversão: a licença proíbe.
// Ao mudar os hashes, confira a licença de novo (.context/library-docs.md, seção Satoshi).
import { createHash } from "node:crypto";

/** O CSS da Fontshare para os três pesos (cada bloco @font-face traz woff2, woff e ttf). */
export const FONTSHARE_CSS_URL =
  "https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&display=swap";

/** Os pesos da Satoshi que o app usa (500 texto de apoio, 700 rótulos, 900 títulos). */
export const SATOSHI_WEIGHTS = Object.freeze([500, 700, 900]);

/**
 * SHA-256 de cada woff2, conferidos em 2026-11-27 contra a CDN da Fontshare.
 * @type {Readonly<Record<500 | 700 | 900, string>>}
 */
export const SATOSHI_SHA256 = Object.freeze({
  500: "af02a72246f53ad49c44a591921edbd39ec8258a03d8cc2e0532aa1e497e85b4",
  700: "353a7fbfb4475f0c31470a7449226006cb64211c71055ca9db860a8acdaa9f68",
  900: "bd11b5820231420e78046c611aebdd628dc17ad67788258ffe3fe902253efd3b",
});

const CDN_HOST = "cdn.fontshare.com";

/**
 * Caminho do arquivo a partir da raiz do repositório, sempre com `/` (vale no Windows e no Linux:
 * o CLI o resolve com `new URL(..., import.meta.url)`).
 * @param {500 | 700 | 900} weight
 * @returns {string}
 */
export function satoshiPath(weight) {
  if (!(weight in SATOSHI_SHA256)) {
    throw new Error(`Peso da Satoshi não suportado: ${weight}`);
  }
  return `src/fonts/satoshi/Satoshi-${weight}.woff2`;
}

/**
 * @param {Uint8Array} bytes
 * @returns {string} o SHA-256 em hexadecimal minúsculo
 */
export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Os bytes são o arquivo oficial desse peso?
 * @param {500 | 700 | 900} weight
 * @param {Uint8Array} bytes
 * @param {Readonly<Record<500 | 700 | 900, string>>} [expected] os hashes (o padrão são os fixados acima)
 * @returns {boolean}
 */
export function isSatoshiFileValid(weight, bytes, expected = SATOSHI_SHA256) {
  return sha256Hex(bytes) === expected[weight];
}

/** `//cdn.fontshare.com/...` vira `https://...`; só a CDN da Fontshare passa. */
function toHttps(url) {
  const absolute = url.startsWith("//") ? `https:${url}` : url;
  let parsed;
  try {
    parsed = new URL(absolute);
  } catch {
    throw new Error(`URL de fonte inesperada: ${url}`);
  }
  if (parsed.protocol !== "https:" || parsed.hostname !== CDN_HOST) {
    throw new Error(`URL de fonte inesperada: ${url}`);
  }
  return absolute;
}

const FONT_FACE = /@font-face\s*\{([^}]*)\}/g;
const FONT_WEIGHT = /font-weight:\s*(\d+)/;
const WOFF2_URL =
  /url\(\s*['"]?([^'")\s]+)['"]?\s*\)\s*format\(\s*['"]woff2['"]\s*\)/;

/**
 * Lê o CSS da Fontshare e devolve peso → URL `https:` do woff2.
 * @param {string} css
 * @returns {Map<number, string>}
 */
export function parseFontshareCss(css) {
  /** @type {Map<number, string>} */
  const urls = new Map();
  let blocks = 0;
  for (const block of css.matchAll(FONT_FACE)) {
    blocks += 1;
    const body = block[1] ?? "";
    const weight = FONT_WEIGHT.exec(body)?.[1];
    if (!weight) continue;
    const woff2 = WOFF2_URL.exec(body)?.[1];
    if (!woff2) throw new Error(`sem woff2 no peso ${weight}`);
    urls.set(Number(weight), toHttps(woff2));
  }
  if (blocks === 0) {
    throw new Error("nenhum @font-face na resposta da Fontshare");
  }
  return urls;
}
