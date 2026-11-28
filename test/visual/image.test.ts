import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  contactSheet,
  createPng,
  cropRect,
  cropTo,
  MASK_RGBA,
  paintRects,
  parseRect,
  stackRegion,
  writePng,
} from "../../scripts/visual/image.mjs";
import { repoRoot } from "../../scripts/visual/paths.mjs";

// As imagens das ferramentas visuais (spec §5.3): recorte, máscara, pilha e folha de
// contato, montadas com createPng (os testes não importam o pngjs).

type Png = { width: number; height: number; data: Buffer };
const WHITE = [255, 255, 255, 255];
const BLACK = [0, 0, 0, 255];
const BLUE = [0, 0, 255, 255];

function pixel(png: Png, x: number, y: number): number[] {
  const offset = (y * png.width + x) * 4;
  return [...png.data.subarray(offset, offset + 4)];
}

function fill(
  png: Png,
  [x, y, w, h]: [number, number, number, number],
  rgba: number[],
) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) png.data.set(rgba, (j * png.width + i) * 4);
  }
}

describe("createPng", () => {
  it("cria no tamanho, branco por padrão ou na cor dada", () => {
    const white = createPng(3, 2);
    expect([white.width, white.height]).toEqual([3, 2]);
    expect(pixel(white, 2, 1)).toEqual(WHITE);
    expect(pixel(createPng(1, 1, BLACK), 0, 0)).toEqual(BLACK);
  });

  it("lança em tamanho zero, negativo ou fracionário", () => {
    expect(() => createPng(0, 1)).toThrow("largura inválido");
    expect(() => createPng(1, -1)).toThrow("altura inválido");
    expect(() => createPng(1.5, 1)).toThrow("largura inválido");
  });
});

describe("cropRect e cropTo", () => {
  it("copia o retângulo de dentro", () => {
    const png = createPng(10, 10);
    fill(png, [4, 4, 1, 1], BLACK);
    const crop = cropRect(png, [3, 3, 3, 3]);
    expect([crop.width, crop.height]).toEqual([3, 3]);
    expect(pixel(crop, 1, 1)).toEqual(BLACK);
    expect(pixel(crop, 0, 0)).toEqual(WHITE);
  });

  it("corta na borda da imagem", () => {
    const crop = cropRect(createPng(10, 10), [8, 7, 5, 5]);
    expect([crop.width, crop.height]).toEqual([2, 3]);
  });

  it("lança com o canto fora da imagem ou tamanho zero", () => {
    expect(() => cropRect(createPng(10, 10), [10, 0, 1, 1])).toThrow(
      "recorte fora da imagem",
    );
    expect(() => cropRect(createPng(10, 10), [0, 0, 0, 1])).toThrow(
      "largura inválido",
    );
    expect(() => cropRect(createPng(10, 10), [-1, 0, 1, 1])).toThrow(
      "x inválido",
    );
  });

  it("cropTo é sempre uma cópia (a original não muda) e recusa maior que a imagem", () => {
    const png = createPng(4, 4);
    const copy = cropTo(png, 4, 4);
    expect(copy).not.toBe(png);
    paintRects(copy, [[0, 0, 4, 4]]);
    expect(pixel(png, 0, 0)).toEqual(WHITE);
    expect(() => cropTo(png, 5, 4)).toThrow("cropTo maior que a imagem");
  });
});

describe("paintRects", () => {
  it("pinta dentro, corta na borda e ignora o que cai fora", () => {
    const png = createPng(5, 5);
    paintRects(png, [
      [1, 1, 1, 1],
      [4, 4, 10, 10],
      [20, 20, 3, 3],
    ]);
    expect(pixel(png, 1, 1)).toEqual([...MASK_RGBA]);
    expect(pixel(png, 4, 4)).toEqual([...MASK_RGBA]);
    expect(pixel(png, 2, 2)).toEqual(WHITE);
  });

  it("com origem, pinta no recorte o retângulo medido na página", () => {
    const crop = createPng(5, 5);
    paintRects(crop, [[12, 12, 2, 2]], [10, 10]);
    expect(pixel(crop, 2, 2)).toEqual([...MASK_RGBA]);
    expect(pixel(crop, 3, 3)).toEqual([...MASK_RGBA]);
    expect(pixel(crop, 1, 1)).toEqual(WHITE);
  });

  it("sem retângulo, nada muda", () => {
    const png = createPng(2, 2);
    expect(paintRects(png, [])).toBe(png);
    expect(pixel(png, 0, 0)).toEqual(WHITE);
  });
});

describe("stackRegion", () => {
  it("empilha a mesma região de cada imagem, ampliada, com o espaço entre elas", () => {
    const black = createPng(4, 4, BLACK);
    const out = stackRegion(
      [createPng(4, 4), black, createPng(4, 4, BLUE)],
      [1, 1, 2, 2],
      3,
      6,
    );
    expect([out.width, out.height]).toEqual([6, 6 * 3 + 6 * 2]);
    expect(pixel(out, 5, 5)).toEqual(WHITE);
    expect(pixel(out, 0, 6)).toEqual(WHITE);
    expect(pixel(out, 0, 12)).toEqual(BLACK);
    expect(pixel(out, 5, 24)).toEqual(BLUE);
  });

  it("o que cai fora de uma imagem menor sai em magenta", () => {
    const out = stackRegion([createPng(2, 2)], [1, 1, 2, 2], 1, 0);
    expect(pixel(out, 0, 0)).toEqual(WHITE);
    expect(pixel(out, 1, 1)).toEqual([...MASK_RGBA]);
  });

  it("lança sem imagem, com zoom zero ou acima de 16", () => {
    expect(() => stackRegion([], [0, 0, 1, 1])).toThrow("nenhuma imagem");
    expect(() => stackRegion([createPng(1, 1)], [0, 0, 1, 1], 0)).toThrow(
      "zoom inválido",
    );
    expect(() => stackRegion([createPng(1, 1)], [0, 0, 1, 1], 17)).toThrow(
      "máximo 16",
    );
  });
});

describe("contactSheet", () => {
  it("põe as imagens lado a lado, reduzidas, e corta na altura máxima", () => {
    const sheet = contactSheet(
      [createPng(100, 50), createPng(40, 400, BLACK)],
      0.5,
      150,
      12,
    );
    expect([sheet.width, sheet.height]).toEqual([50 + 12 + 20, 150]);
    expect(pixel(sheet, 0, 0)).toEqual(WHITE);
    expect(pixel(sheet, 0, 30)).toEqual([...MASK_RGBA]);
    expect(pixel(sheet, 62, 10)).toEqual(BLACK);
  });

  it("a redução é a média da caixa (sem serrilhado)", () => {
    const png = createPng(2, 1, WHITE);
    fill(png, [1, 0, 1, 1], BLACK);
    const sheet = contactSheet([png], 0.5, 10, 0);
    expect(pixel(sheet, 0, 0)).toEqual([128, 128, 128, 255]);
  });

  it("lança sem imagem e com escala fora de (0, 1]", () => {
    expect(() => contactSheet([])).toThrow("nenhuma imagem");
    expect(() => contactSheet([createPng(1, 1)], 0)).toThrow("escala inválida");
    expect(() => contactSheet([createPng(1, 1)], 1.5)).toThrow(
      "escala inválida",
    );
  });
});

describe("parseRect", () => {
  it("lê x y largura altura", () => {
    expect(parseRect(["0", "12", "300", "40"])).toEqual([0, 12, 300, 40]);
  });

  it("lança com menos de quatro, negativo, zero ou lixo", () => {
    expect(() => parseRect(["1", "2"])).toThrow("x y largura altura");
    expect(() => parseRect(["-1", "0", "1", "1"])).toThrow(
      "retângulo inválido",
    );
    expect(() => parseRect(["0", "0", "0", "1"])).toThrow("retângulo inválido");
    expect(() => parseRect(["a", "0", "1", "1"])).toThrow("retângulo inválido");
  });
});

describe("writePng", () => {
  it("recusa gravar fora de .git/sdd", () => {
    expect(() =>
      writePng(join(repoRoot(), "fora.png"), createPng(1, 1)),
    ).toThrow("fora de .git/sdd");
  });
});
