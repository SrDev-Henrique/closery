// Imagens PNG das ferramentas visuais (spec §5.3): ler, gravar (só dentro de .git/sdd), recortar,
// pintar máscaras, empilhar regiões e montar a folha de contato. Tudo puro, fora readPng e writePng.
// Os testes montam imagens com createPng e não importam o pngjs (library-docs §21).
import { readFileSync } from "node:fs";

import { PNG } from "pngjs";

import { writeInsideSdd } from "./paths.mjs";

/** @typedef {[number, number, number, number]} Rect — [x, y, largura, altura], em px da imagem */
/** @typedef {{ width: number, height: number, data: Buffer }} Png */

/** A cor das máscaras e do que cai fora de uma imagem: magenta opaco, igual nos dois lados. */
export const MASK_RGBA = Object.freeze([255, 0, 255, 255]);
const WHITE = Object.freeze([255, 255, 255, 255]);
const MAX_ZOOM = 16;

/**
 * @param {string} label
 * @param {unknown} value
 * @param {number} min
 */
function assertInt(label, value, min) {
  if (!Number.isInteger(value) || Number(value) < min) {
    throw new Error(`${label} inválido: ${String(value)} (inteiro ≥ ${min})`);
  }
}

/**
 * @param {Png} png
 * @param {number} offset
 * @param {readonly number[]} rgba
 */
function setPixel(png, offset, rgba) {
  png.data[offset] = rgba[0] ?? 0;
  png.data[offset + 1] = rgba[1] ?? 0;
  png.data[offset + 2] = rgba[2] ?? 0;
  png.data[offset + 3] = rgba[3] ?? 255;
}

/**
 * PNG novo, preenchido com uma cor (padrão: branco opaco).
 * @param {number} width
 * @param {number} height
 * @param {readonly number[]} [rgba]
 * @returns {Png}
 */
export function createPng(width, height, rgba = WHITE) {
  assertInt("largura", width, 1);
  assertInt("altura", height, 1);
  const png = new PNG({ width, height });
  for (let offset = 0; offset < png.data.length; offset += 4) {
    setPixel(png, offset, rgba);
  }
  return png;
}

/**
 * @param {string} file
 * @returns {Png}
 */
export function readPng(file) {
  return PNG.sync.read(readFileSync(file));
}

/**
 * Grava o PNG. O destino passa por assertInsideSdd: fora de .git/sdd lança e nada é gravado.
 * @param {string} file
 * @param {Png} png
 */
export function writePng(file, png) {
  writeInsideSdd(file, PNG.sync.write(/** @type {any} */ (png)));
}

/**
 * Copia o retângulo, cortado nas bordas da imagem. Lança se o canto está fora dela.
 * @param {Png} png
 * @param {Rect} rect
 * @returns {Png}
 */
export function cropRect(png, rect) {
  const [x, y, w, h] = rect;
  assertInt("x", x, 0);
  assertInt("y", y, 0);
  assertInt("largura", w, 1);
  assertInt("altura", h, 1);
  if (x >= png.width || y >= png.height) {
    throw new Error(
      `recorte fora da imagem: ${rect.join(",")} em ${png.width}x${png.height}`,
    );
  }
  const width = Math.min(w, png.width - x);
  const height = Math.min(h, png.height - y);
  const out = new PNG({ width, height });
  PNG.bitblt(/** @type {any} */ (png), out, x, y, width, height, 0, 0);
  return out;
}

/**
 * Os primeiros `width` x `height` px (canto de cima à esquerda), sempre numa cópia. Lança se for
 * maior que a imagem.
 * @param {Png} png
 * @param {number} width
 * @param {number} height
 * @returns {Png}
 */
export function cropTo(png, width, height) {
  if (width > png.width || height > png.height) {
    throw new Error(
      `cropTo maior que a imagem: ${width}x${height} em ${png.width}x${png.height}`,
    );
  }
  return cropRect(png, [0, 0, width, height]);
}

/**
 * Pinta os retângulos com MASK_RGBA, cortados nas bordas. `origin` é o canto da imagem na página
 * (para pintar num recorte as máscaras medidas na página). Muda e devolve a própria imagem.
 * @param {Png} png
 * @param {readonly Rect[]} rects
 * @param {readonly [number, number]} [origin]
 * @returns {Png}
 */
export function paintRects(png, rects, origin = [0, 0]) {
  for (const [rx, ry, rw, rh] of rects) {
    const x0 = Math.max(0, Math.round(rx - origin[0]));
    const y0 = Math.max(0, Math.round(ry - origin[1]));
    const x1 = Math.min(png.width, Math.round(rx - origin[0] + rw));
    const y1 = Math.min(png.height, Math.round(ry - origin[1] + rh));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        setPixel(png, (y * png.width + x) * 4, MASK_RGBA);
      }
    }
  }
  return png;
}

/**
 * Empilha a mesma região de cada imagem, de cima para baixo, ampliada `zoom` vezes (sem suavizar),
 * com `gap` px brancos entre elas; o que cai fora de uma imagem sai em MASK_RGBA (o sbs: protótipo,
 * app e diferença).
 * @param {readonly Png[]} pngs
 * @param {Rect} rect
 * @param {number} [zoom]
 * @param {number} [gap]
 * @returns {Png}
 */
export function stackRegion(pngs, rect, zoom = 1, gap = 6) {
  if (pngs.length === 0) throw new Error("stackRegion: nenhuma imagem");
  const [x, y, w, h] = rect;
  assertInt("x", x, 0);
  assertInt("y", y, 0);
  assertInt("largura", w, 1);
  assertInt("altura", h, 1);
  assertInt("zoom", zoom, 1);
  assertInt("gap", gap, 0);
  if (zoom > MAX_ZOOM)
    throw new Error(`zoom inválido: ${zoom} (máximo ${MAX_ZOOM})`);
  const block = h * zoom + gap;
  const out = createPng(w * zoom, block * pngs.length - gap);
  for (const [n, png] of pngs.entries()) {
    for (let j = 0; j < h * zoom; j++) {
      for (let i = 0; i < w * zoom; i++) {
        const sx = x + Math.floor(i / zoom);
        const sy = y + Math.floor(j / zoom);
        const offset = ((n * block + j) * out.width + i) * 4;
        if (sx >= png.width || sy >= png.height) {
          setPixel(out, offset, MASK_RGBA);
          continue;
        }
        const source = (sy * png.width + sx) * 4;
        out.data[offset] = png.data[source] ?? 0;
        out.data[offset + 1] = png.data[source + 1] ?? 0;
        out.data[offset + 2] = png.data[source + 2] ?? 0;
        out.data[offset + 3] = 255;
      }
    }
  }
  return out;
}

/**
 * Folha de contato: as imagens lado a lado, reduzidas por `scale` (média da caixa de origem, sem
 * serrilhado), cortadas em `maxHeight`, com `gap` px entre elas, sobre fundo MASK_RGBA.
 * @param {readonly Png[]} pngs
 * @param {number} [scale]
 * @param {number} [maxHeight]
 * @param {number} [gap]
 * @returns {Png}
 */
export function contactSheet(pngs, scale = 0.5, maxHeight = 1800, gap = 12) {
  if (pngs.length === 0) throw new Error("contactSheet: nenhuma imagem");
  if (!(scale > 0 && scale <= 1))
    throw new Error(`escala inválida: ${scale} (de 0 a 1)`);
  assertInt("altura máxima", maxHeight, 1);
  assertInt("gap", gap, 0);
  const sizes = pngs.map((png) => ({
    w: Math.max(1, Math.round(png.width * scale)),
    h: Math.max(1, Math.round(png.height * scale)),
  }));
  const width =
    sizes.reduce((sum, size) => sum + size.w, 0) + gap * (pngs.length - 1);
  const height = Math.min(maxHeight, Math.max(...sizes.map((size) => size.h)));
  const out = createPng(width, height, MASK_RGBA);
  let left = 0;
  for (const [n, png] of pngs.entries()) {
    const size = sizes[n] ?? { w: 1, h: 1 };
    const rows = Math.min(height, size.h);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < size.w; x++) {
        const sx0 = Math.floor(x / scale);
        const sy0 = Math.floor(y / scale);
        const sx1 = Math.min(
          png.width,
          Math.max(sx0 + 1, Math.floor((x + 1) / scale)),
        );
        const sy1 = Math.min(
          png.height,
          Math.max(sy0 + 1, Math.floor((y + 1) / scale)),
        );
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let yy = sy0; yy < sy1; yy++) {
          for (let xx = sx0; xx < sx1; xx++) {
            const source = (yy * png.width + xx) * 4;
            r += png.data[source] ?? 0;
            g += png.data[source + 1] ?? 0;
            b += png.data[source + 2] ?? 0;
            count += 1;
          }
        }
        if (count === 0) continue;
        const offset = (y * width + left + x) * 4;
        out.data[offset] = Math.round(r / count);
        out.data[offset + 1] = Math.round(g / count);
        out.data[offset + 2] = Math.round(b / count);
        out.data[offset + 3] = 255;
      }
    }
    left += size.w + gap;
  }
  return out;
}

/**
 * "x y largura altura" da linha de comando: inteiros, x e y ≥ 0, largura e altura ≥ 1.
 * @param {readonly (string | undefined)[]} values
 * @returns {Rect}
 */
export function parseRect(values) {
  if (values.length !== 4) throw new Error("retângulo: x y largura altura");
  const numbers = values.map((value) =>
    typeof value === "string" && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN,
  );
  const [x = Number.NaN, y = Number.NaN, w = Number.NaN, h = Number.NaN] =
    numbers;
  if (numbers.some((n) => Number.isNaN(n)) || w < 1 || h < 1) {
    throw new Error(
      `retângulo inválido: ${values.join(" ")} (x e y ≥ 0; largura e altura ≥ 1)`,
    );
  }
  return [x, y, w, h];
}
