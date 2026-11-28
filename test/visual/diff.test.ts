import { describe, expect, it } from "vitest";

import {
  diffImages,
  PIXELMATCH_THRESHOLD,
  regionDiff,
  unionRect,
} from "../../scripts/visual/diff.mjs";
import { createPng } from "../../scripts/visual/image.mjs";

// A medida do pixel (spec §5.3): pixelmatch com threshold 0.1, recorte ao menor tamanho
// comum e as máscaras pintadas iguais nos dois lados.

type Png = { width: number; height: number; data: Buffer };
const BLACK = [0, 0, 0, 255];

function withBlock(
  width: number,
  height: number,
  rect: [number, number, number, number],
): Png {
  const png = createPng(width, height);
  const [x, y, w, h] = rect;
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) png.data.set(BLACK, (j * width + i) * 4);
  }
  return png;
}

describe("diffImages", () => {
  it("o threshold é o do PR A", () => {
    expect(PIXELMATCH_THRESHOLD).toBe(0.1);
  });

  it("iguais: zero", () => {
    const result = diffImages(createPng(10, 10), createPng(10, 10));
    expect(result).toMatchObject({
      width: 10,
      height: 10,
      different: 0,
      pct: 0,
    });
    expect(result.sizes).toEqual(["10x10", "10x10"]);
  });

  it("tudo diferente: 100%", () => {
    expect(diffImages(createPng(4, 4), createPng(4, 4, BLACK)).pct).toBe(100);
  });

  it("um bloco 4x4 diferente conta 16 px, e a imagem da diferença tem o tamanho comum", () => {
    const result = diffImages(
      createPng(10, 10),
      withBlock(10, 10, [2, 2, 4, 4]),
    );
    expect(result.different).toBe(16);
    expect(result.pct).toBeCloseTo(16, 5);
    expect([result.diff.width, result.diff.height]).toEqual([10, 10]);
  });

  it("a máscara cobre a diferença inteira (zero) ou metade (só a outra metade conta)", () => {
    const changed = withBlock(10, 10, [2, 2, 4, 4]);
    expect(
      diffImages(createPng(10, 10), changed, [[2, 2, 4, 4]]).different,
    ).toBe(0);
    expect(
      diffImages(createPng(10, 10), changed, [[2, 2, 2, 4]]).different,
    ).toBe(8);
  });

  it("tamanhos diferentes: mede no menor comum, informa os dois e não muda as entradas", () => {
    const tall = createPng(10, 12);
    const small = createPng(8, 10);
    const result = diffImages(tall, small, [[0, 0, 3, 3]]);
    expect([result.width, result.height]).toEqual([8, 10]);
    expect(result.sizes).toEqual(["10x12", "8x10"]);
    expect([...tall.data.subarray(0, 4)]).toEqual([255, 255, 255, 255]);
  });
});

describe("regionDiff", () => {
  const plain = createPng(10, 10);
  const changed = withBlock(10, 10, [2, 2, 4, 4]);

  it("mede só dentro da região", () => {
    expect(regionDiff(plain, changed, [0, 0, 5, 5]).different).toBe(9);
    expect(regionDiff(plain, changed, [6, 6, 4, 4]).different).toBe(0);
  });

  it("corta a região no que existe nas duas imagens e devolve os recortes", () => {
    const result = regionDiff(plain, createPng(8, 8), [6, 6, 10, 10]);
    expect([result.width, result.height]).toEqual([2, 2]);
    expect([
      result.crops.a.width,
      result.crops.b.width,
      result.crops.diff.width,
    ]).toEqual([2, 2, 2]);
  });

  it("as máscaras da página valem no recorte", () => {
    expect(
      regionDiff(plain, changed, [2, 2, 4, 4], [[2, 2, 2, 4]]).different,
    ).toBe(8);
  });

  it("lança com a região fora das imagens", () => {
    expect(() => regionDiff(plain, changed, [20, 20, 2, 2])).toThrow(
      "região fora das imagens",
    );
    expect(() => regionDiff(plain, changed, [-1, 0, 2, 2])).toThrow(
      "região fora das imagens",
    );
  });
});

describe("unionRect", () => {
  it("cobre os dois retângulos", () => {
    expect(unionRect([10, 10, 5, 5], [8, 12, 10, 2])).toEqual([8, 10, 10, 5]);
  });

  it("de um retângulo com ele mesmo é ele mesmo", () => {
    expect(unionRect([1, 2, 3, 4], [1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });
});
