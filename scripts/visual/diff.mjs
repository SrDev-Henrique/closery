// Diferença de pixels entre duas capturas (spec §5.3), com o pixelmatch (threshold 0.1, os padrões
// da biblioteca para o anti-aliasing): recorta as duas ao menor tamanho comum, pinta as máscaras (o
// que depende do "agora") iguais nos dois lados e devolve a porcentagem; regionDiff mede só um
// retângulo (ex.: o cartão do turno). Puro, fora diffFiles e o CLI.
//   node scripts/visual/diff.mjs <a.png> <b.png> <saída.png> [máscaras.json]   (relativos a .git/sdd)
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import pixelmatch from "pixelmatch";

import { parseCliArgs } from "./config.mjs";
import {
  createPng,
  cropRect,
  cropTo,
  paintRects,
  readPng,
  writePng,
} from "./image.mjs";
import { sddPath } from "./paths.mjs";

/** @typedef {import("./image.mjs").Png} Png */
/** @typedef {import("./image.mjs").Rect} Rect */

export const PIXELMATCH_THRESHOLD = 0.1;

const USAGE =
  "uso: node scripts/visual/diff.mjs <a.png> <b.png> <saída.png> [máscaras.json] (caminhos relativos a .git/sdd)";

/**
 * @param {Png} a
 * @param {Png} b
 * @param {Png} out
 * @returns {number}
 */
function countDifferent(a, b, out) {
  return pixelmatch(a.data, b.data, out.data, out.width, out.height, {
    threshold: PIXELMATCH_THRESHOLD,
  });
}

/**
 * A diferença da página inteira, no menor tamanho comum. As entradas não mudam.
 * @param {Png} a
 * @param {Png} b
 * @param {readonly Rect[]} [masks]
 * @returns {{ width: number, height: number, sizes: [string, string], different: number, pct: number, diff: Png }}
 */
export function diffImages(a, b, masks = []) {
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const left = paintRects(cropTo(a, width, height), masks);
  const right = paintRects(cropTo(b, width, height), masks);
  const diff = createPng(width, height);
  const different = countDifferent(left, right, diff);
  return {
    width,
    height,
    sizes: [`${a.width}x${a.height}`, `${b.width}x${b.height}`],
    different,
    pct: (100 * different) / (width * height),
    diff,
  };
}

/**
 * A diferença só dentro de `rect` (em px da página), cortado ao que existe nas duas imagens; as
 * máscaras são as da página, pintadas no recorte.
 * @param {Png} a
 * @param {Png} b
 * @param {Rect} rect
 * @param {readonly Rect[]} [masks]
 * @returns {{ width: number, height: number, different: number, pct: number, crops: { a: Png, b: Png, diff: Png } }}
 */
export function regionDiff(a, b, rect, masks = []) {
  const [x, y, w, h] = rect;
  const width = Math.min(w, a.width - x, b.width - x);
  const height = Math.min(h, a.height - y, b.height - y);
  if (x < 0 || y < 0 || width < 1 || height < 1) {
    throw new Error(`região fora das imagens: ${rect.join(",")}`);
  }
  const box = /** @type {Rect} */ ([x, y, width, height]);
  const left = paintRects(cropRect(a, box), masks, [x, y]);
  const right = paintRects(cropRect(b, box), masks, [x, y]);
  const diff = createPng(width, height);
  const different = countDifferent(left, right, diff);
  return {
    width,
    height,
    different,
    pct: (100 * different) / (width * height),
    crops: { a: left, b: right, diff },
  };
}

/**
 * O menor retângulo que cobre os dois (a região do app e a do protótipo).
 * @param {Rect} a
 * @param {Rect} b
 * @returns {Rect}
 */
export function unionRect(a, b) {
  const x = Math.min(a[0], b[0]);
  const y = Math.min(a[1], b[1]);
  return [
    x,
    y,
    Math.max(a[0] + a[2], b[0] + b[2]) - x,
    Math.max(a[1] + a[3], b[1] + b[3]) - y,
  ];
}

/**
 * Lê as duas capturas, mede e grava a imagem da diferença (dentro de .git/sdd).
 * @param {string} aPath
 * @param {string} bPath
 * @param {string} outPath
 * @param {readonly Rect[]} [masks]
 * @returns {{ width: number, height: number, sizes: [string, string], different: number, pct: number }}
 */
export function diffFiles(aPath, bPath, outPath, masks = []) {
  const { diff, ...result } = diffImages(readPng(aPath), readPng(bPath), masks);
  writePng(outPath, diff);
  return result;
}

function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  if (
    Object.keys(flags).length > 0 ||
    positional.length < 3 ||
    positional.length > 4
  ) {
    throw new Error(USAGE);
  }
  const [a = "", b = "", out = "", maskFile] = positional;
  const masks = maskFile
    ? JSON.parse(readFileSync(sddPath(maskFile), "utf8"))
    : [];
  const result = diffFiles(sddPath(a), sddPath(b), sddPath(out), masks);
  console.log(
    `${result.pct.toFixed(3)}% (${result.different} px de ${result.width}x${result.height}; ${result.sizes.join(" vs ")})`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(
      `diff: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
