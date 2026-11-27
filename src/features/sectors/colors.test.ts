import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  isSectorColor,
  SECTOR_COLOR_BG,
  SECTOR_COLOR_LABELS,
  SECTOR_COLORS,
  type SectorColor,
  suggestSectorColor,
} from "./colors";

describe("a paleta", () => {
  it("tem as cinco chaves, nesta ordem", () => {
    expect([...SECTOR_COLORS]).toEqual([
      "lilac",
      "peach",
      "sky",
      "green",
      "pink",
    ]);
  });

  it("cada chave tem rótulo em português e classe de fundo própria", () => {
    expect(SECTOR_COLOR_LABELS).toEqual({
      lilac: "Lilás",
      peach: "Pêssego",
      sky: "Azul",
      green: "Verde",
      pink: "Rosa",
    });
    expect(SECTOR_COLOR_BG).toEqual({
      lilac: "bg-sector-lilac",
      peach: "bg-sector-peach",
      sky: "bg-sector-sky",
      green: "bg-sector-green",
      pink: "bg-sector-pink",
    });
  });

  it("cada cor tem o token --color-sector-* declarado em globals.css (a classe bg-sector-* existe)", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    for (const color of SECTOR_COLORS) {
      expect(css, color).toContain(`--color-sector-${color}`);
    }
  });
});

describe("isSectorColor", () => {
  it("aceita as cinco chaves", () => {
    for (const color of SECTOR_COLORS) expect(isSectorColor(color)).toBe(true);
  });

  it.each([
    "red",
    "",
    "Lilac",
    "lilas",
    " lilac",
    null,
    undefined,
    1,
    {},
    ["lilac"],
  ])("recusa %j", (value) => {
    expect(isSectorColor(value)).toBe(false);
  });
});

describe("suggestSectorColor", () => {
  it("nenhum setor ativo: a primeira da paleta (lilac)", () => {
    expect(suggestSectorColor([])).toBe("lilac");
  });

  it("devolve a primeira cor livre, na ordem da paleta", () => {
    expect(suggestSectorColor(["lilac"])).toBe("peach");
    expect(suggestSectorColor(["lilac", "peach"])).toBe("sky");
    expect(suggestSectorColor(["peach", "sky"])).toBe("lilac");
    expect(suggestSectorColor(["lilac", "sky"])).toBe("peach");
    expect(suggestSectorColor(["lilac", "peach", "sky", "green"])).toBe("pink");
  });

  it("a ordem da lista de entrada não importa", () => {
    expect(suggestSectorColor(["sky", "lilac"])).toBe("peach");
  });

  it("cor repetida não esconde uma livre", () => {
    expect(suggestSectorColor(["lilac", "lilac", "lilac"])).toBe("peach");
  });

  it("todas em uso: a menos usada", () => {
    const all: SectorColor[] = ["lilac", "peach", "sky", "green", "pink"];
    // lilac e peach duas vezes; sky, green e pink uma: a menos usada, na ordem da paleta, é sky.
    expect(suggestSectorColor([...all, "lilac", "peach"])).toBe("sky");
    // só pink tem uma; as outras duas.
    expect(
      suggestSectorColor([
        "lilac",
        "lilac",
        "peach",
        "peach",
        "sky",
        "sky",
        "green",
        "green",
        "pink",
      ]),
    ).toBe("pink");
  });

  it("todas em uso e empatadas: a primeira da paleta", () => {
    expect(suggestSectorColor(["lilac", "peach", "sky", "green", "pink"])).toBe(
      "lilac",
    );
    expect(
      suggestSectorColor([
        "pink",
        "green",
        "sky",
        "peach",
        "lilac",
        "pink",
        "green",
        "sky",
        "peach",
        "lilac",
      ]),
    ).toBe("lilac");
  });
});
