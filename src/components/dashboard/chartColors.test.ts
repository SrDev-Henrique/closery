import { describe, expect, it } from "vitest";

import {
  OTHERS_STROKE,
  OTHERS_SWATCH,
  SHIFT_STROKES,
  SHIFT_SWATCHES,
  SINGLE_BAR_CLASS,
  SINGLE_SERIES_COLOR,
  SITUATION_CHART,
  segmentStroke,
  segmentSwatch,
} from "./chartColors";

describe("cores por entidade", () => {
  it.each([
    [1, "bg-chart-1", "stroke-chart-1"],
    [2, "bg-chart-2", "stroke-chart-2"],
    [3, "bg-chart-3", "stroke-chart-3"],
    [4, "bg-chart-4", "stroke-chart-4"],
  ] as const)("o turno do slot %i tem a cor própria", (slot, swatch, stroke) => {
    expect(segmentSwatch(slot)).toBe(swatch);
    expect(segmentStroke(slot)).toBe(stroke);
  });

  it("do 5º turno em diante (slot nulo) a cor é o neutro foreground, nunca chart-5", () => {
    expect(segmentSwatch(null)).toBe("bg-foreground");
    expect(segmentStroke(null)).toBe("stroke-foreground");
    expect(OTHERS_SWATCH).toBe("bg-foreground");
    expect(OTHERS_STROKE).toBe("stroke-foreground");
  });

  it("as quatro cores de turno são distintas e fixas (nunca ciclam)", () => {
    expect(new Set(SHIFT_SWATCHES).size).toBe(4);
    expect(new Set(SHIFT_STROKES).size).toBe(4);
    expect([...SHIFT_SWATCHES]).toEqual([
      "bg-chart-1",
      "bg-chart-2",
      "bg-chart-3",
      "bg-chart-4",
    ]);
  });

  it("a situação usa o -foreground do selo e o cinza para 'sem passagem'", () => {
    expect(SITUATION_CHART).toEqual({
      confirmed: {
        stroke: "stroke-success-foreground",
        dot: "bg-success-foreground",
      },
      awaiting: { stroke: "stroke-info-foreground", dot: "bg-info-foreground" },
      unconfirmed: {
        stroke: "stroke-warning-foreground",
        dot: "bg-warning-foreground",
      },
      missing: {
        stroke: "stroke-muted-foreground",
        dot: "bg-muted-foreground",
      },
    });
  });

  it("série única e barra única são o foreground", () => {
    expect(SINGLE_SERIES_COLOR).toBe("var(--foreground)");
    expect(SINGLE_BAR_CLASS).toBe("bg-foreground");
  });
});
