import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  COLOR_FADE,
  MOTION_DEFAULT_TRANSITION,
  MOTION_DURATION,
  MOTION_EASE,
  MOTION_MAX_SECONDS,
  MOTION_SPRING,
  overlayMotion,
  PRESS_SCALE,
  sheetMotion,
  tooltipMotion,
} from "./motion";

// Os tokens e os presets de movimento (emenda do Motion, ui-rules §9): curtos, saída mais curta que a
// entrada, e o ramo reduzido de cada preset sem deslize nem escala.

const REDUCED_FADE = {
  duration: MOTION_DURATION.instant,
  ease: MOTION_EASE.out,
};
const EXIT = { duration: MOTION_DURATION.exit, ease: MOTION_EASE.in };
const FADE_ONLY = {
  initial: { opacity: 0 },
  open: { opacity: 1, transition: REDUCED_FADE },
  closed: { opacity: 0, transition: REDUCED_FADE },
};

describe("tokens de movimento", () => {
  it("toda duração é positiva e cabe no teto (curto)", () => {
    for (const [name, seconds] of Object.entries(MOTION_DURATION)) {
      expect(seconds, name).toBeGreaterThan(0);
      expect(seconds, name).toBeLessThanOrEqual(MOTION_MAX_SECONDS);
    }
  });

  it("toda mola cabe no teto e tem pouca ou nenhuma sobra", () => {
    for (const [name, spring] of Object.entries(MOTION_SPRING)) {
      expect(spring.type, name).toBe("spring");
      expect(spring.visualDuration, name).toBeGreaterThan(0);
      expect(spring.visualDuration, name).toBeLessThanOrEqual(
        MOTION_MAX_SECONDS,
      );
      expect(spring.bounce, name).toBeGreaterThanOrEqual(0);
      expect(spring.bounce, name).toBeLessThanOrEqual(0.25);
    }
  });

  it("a saída é mais curta que a entrada (do painel e do véu)", () => {
    expect(MOTION_DURATION.exit).toBeLessThan(
      MOTION_SPRING.panel.visualDuration,
    );
    expect(MOTION_DURATION.exit).toBeLessThan(MOTION_DURATION.base);
  });

  it("as curvas são cubic-bezier com x entre 0 e 1", () => {
    for (const [name, curve] of Object.entries(MOTION_EASE)) {
      expect(curve, name).toHaveLength(4);
      for (const x of [curve[0], curve[2]]) {
        expect(x, name).toBeGreaterThanOrEqual(0);
        expect(x, name).toBeLessThanOrEqual(1);
      }
    }
  });

  it("o aperto encolhe pouco: de 0,95 a 1 (sem chegar a 1)", () => {
    expect(PRESS_SCALE).toBeGreaterThanOrEqual(0.95);
    expect(PRESS_SCALE).toBeLessThan(1);
  });

  it("a transição padrão e a troca de cor são tweens dos tokens", () => {
    expect(MOTION_DEFAULT_TRANSITION).toEqual({
      duration: MOTION_DURATION.base,
      ease: MOTION_EASE.out,
    });
    expect(COLOR_FADE).toEqual({
      duration: MOTION_DURATION.fade,
      ease: MOTION_EASE.inOut,
    });
  });

  it("o módulo é puro: do Motion, só tipos", () => {
    const source = readFileSync(join(import.meta.dirname, "motion.ts"), "utf8");
    expect(source.match(/^import .*$/gm) ?? []).toEqual([
      'import type { Transition } from "motion/react";',
    ]);
  });
});

describe("sheetMotion", () => {
  it.each([
    ["right", { x: 40 }, { x: 0 }],
    ["left", { x: -40 }, { x: 0 }],
    ["top", { y: -40 }, { y: 0 }],
    ["bottom", { y: 40 }, { y: 0 }],
  ] as const)("painel à %s: chega de 40px com fade e sai pelo mesmo lado", (side, away, home) => {
    const preset = sheetMotion(side, "sheet", false);
    expect(preset.initial).toEqual({ ...away, opacity: 0 });
    expect(preset.open).toEqual({
      ...home,
      opacity: 1,
      transition: {
        default: MOTION_SPRING.panel,
        opacity: { duration: MOTION_DURATION.fast, ease: MOTION_EASE.out },
      },
    });
    expect(preset.closed).toEqual({ ...away, opacity: 0, transition: EXIT });
  });

  it.each([
    ["left", "-105%"],
    ["right", "105%"],
  ] as const)("gaveta à %s: vem da borda (%s), opaca, e sai com fade (a opacidade é o que o Base UI espera)", (side, away) => {
    const preset = sheetMotion(side, "drawer", false);
    expect(preset.initial).toEqual({ x: away, opacity: 1 });
    expect(preset.open).toMatchObject({ x: "0%", opacity: 1 });
    expect(preset.closed).toEqual({ x: away, opacity: 0, transition: EXIT });
  });

  it("gaveta em cima ou embaixo anda no y", () => {
    expect(sheetMotion("top", "drawer", false).initial).toEqual({
      y: "-105%",
      opacity: 1,
    });
    expect(sheetMotion("bottom", "drawer", false).closed).toMatchObject({
      y: "105%",
      opacity: 0,
    });
  });

  it.each([
    "top",
    "right",
    "bottom",
    "left",
  ] as const)("com movimento reduzido (%s): só o fade curto, sem x nem y", (side) => {
    expect(sheetMotion(side, "sheet", true)).toEqual(FADE_ONLY);
    expect(sheetMotion(side, "drawer", true)).toEqual(FADE_ONLY);
  });
});

describe("overlayMotion", () => {
  it("o véu entra em fade e sai mais rápido", () => {
    expect(overlayMotion(false)).toEqual({
      initial: { opacity: 0 },
      open: {
        opacity: 1,
        transition: { duration: MOTION_DURATION.base, ease: MOTION_EASE.out },
      },
      closed: { opacity: 0, transition: EXIT },
    });
  });

  it("com movimento reduzido, o fade curto", () => {
    expect(overlayMotion(true)).toEqual(FADE_ONLY);
  });
});

describe("tooltipMotion", () => {
  it.each([
    ["top", { y: 4 }],
    ["bottom", { y: -4 }],
    ["left", { x: 4 }],
    ["inline-start", { x: 4 }],
    ["right", { x: -4 }],
    ["inline-end", { x: -4 }],
  ] as const)("à %s: sai do gatilho (4px) crescendo de 0,96 até o lugar", (side, offset) => {
    const preset = tooltipMotion(side, false);
    expect(preset.initial).toEqual({ opacity: 0, scale: 0.96, ...offset });
    expect(preset.animate).toEqual({
      opacity: 1,
      scale: 1,
      x: 0,
      y: 0,
      transition: { duration: MOTION_DURATION.base, ease: MOTION_EASE.out },
    });
  });

  it("com movimento reduzido, só o fade curto (sem deslocamento nem escala)", () => {
    expect(tooltipMotion("top", true)).toEqual({
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: REDUCED_FADE },
    });
  });
});
