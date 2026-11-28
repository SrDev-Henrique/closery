import type { Transition } from "motion/react";

// Movimento do Closery (emenda do Motion, 2026-11-27; ui-rules §9, ui-tokens §8, library-docs §23).
// Os números de duração, curva e mola moram só aqui: os componentes usam estes nomes (guarda:
// src/app/motionUsage.test.ts). Curto (nada passa de MOTION_MAX_SECONDS), saída mais curta que a
// entrada, e cada efeito com o ramo de movimento reduzido. O comportamento (o que anima e como reduz)
// segue a ArcUI (https://uiarc.dev, MIT); os valores são nossos. Do Motion, só tipos: o módulo é puro.

/** O teto de qualquer duração ou mola, em segundos: o movimento nunca atrasa a passagem. */
export const MOTION_MAX_SECONDS = 0.45;

/** Durações dos tweens, em segundos. */
export const MOTION_DURATION = {
  /** o fade do ramo reduzido */
  instant: 0.1,
  /** a opacidade de entrada do painel */
  fast: 0.15,
  /** a saída do painel, da gaveta e do véu (mais curta que a entrada) */
  exit: 0.18,
  /** a entrada do tooltip e do véu; a transição padrão */
  base: 0.2,
  /** a troca de cor do cartão do turno */
  fade: 0.4,
} as const;

/** Uma curva cúbica: os quatro números do `cubic-bezier`. */
export type CubicBezier = [number, number, number, number];

/** Curvas dos tweens. */
export const MOTION_EASE: Record<"out" | "in" | "inOut", CubicBezier> = {
  /** entrada (a curva que o knob e a gaveta tinham no CSS) */
  out: [0.2, 0.8, 0.2, 1],
  /** saída: acelera para fora */
  in: [0.4, 0, 1, 1],
  /** o que já está na tela e muda (a cor do cartão) */
  inOut: [0.65, 0, 0.35, 1],
};

/**
 * Molas (`visualDuration` em segundos; `bounce` de 0 a 1). Servem de `transition` e de opção do
 * `useSpring` (o `type` a mais é ignorado ali).
 */
export const MOTION_SPRING = {
  /** o aperto do botão: firme, sem sobra */
  press: { type: "spring", visualDuration: 0.15, bounce: 0 },
  /** o knob do ThemeSwitch */
  knob: { type: "spring", visualDuration: 0.3, bounce: 0.15 },
  /** o thumb do SectorPicker: um pouco de sobra, como a curva do protótipo, cubic-bezier(.3,1.25,.4,1) */
  thumb: { type: "spring", visualDuration: 0.35, bounce: 0.2 },
  /** o painel do Sheet e a gaveta: sem sobra */
  panel: { type: "spring", visualDuration: 0.3, bounce: 0 },
} as const satisfies Record<string, Transition>;

/** O aperto: o botão encolhe para isto. */
export const PRESS_SCALE = 0.97;

/** A transição de quem não declarar nenhuma (o MotionConfig da raiz). */
export const MOTION_DEFAULT_TRANSITION = {
  duration: MOTION_DURATION.base,
  ease: MOTION_EASE.out,
} satisfies Transition;

/** A troca de cor do cartão do turno (a camada do SectorColorFade some). */
export const COLOR_FADE = {
  duration: MOTION_DURATION.fade,
  ease: MOTION_EASE.inOut,
} satisfies Transition;

/** Os valores que um `m.*` recebe em `initial` e nos alvos (só transformação e opacidade). */
export type MotionValues = {
  x?: string | number;
  y?: string | number;
  opacity?: number;
  scale?: number;
};

/** Um alvo com a transição dele. */
export type MotionTarget = MotionValues & { transition?: Transition };

/** A entrada e a saída de um popup: `initial` ao montar, `open` aberto, `closed` fechando. */
export type PopupMotion = {
  initial: MotionValues;
  open: MotionTarget;
  closed: MotionTarget;
};

export type SheetSide = "top" | "right" | "bottom" | "left";

/** `sheet`: o painel chega de perto (40px) com fade; `drawer`: a gaveta do menu vem da borda (105%), opaca. */
export type SheetMotionKind = "sheet" | "drawer";

const SHEET_TRAVEL_PX = 40;
const DRAWER_TRAVEL_PCT = 105;

const ENTER_FADE = {
  duration: MOTION_DURATION.fast,
  ease: MOTION_EASE.out,
} satisfies Transition;
const EXIT = {
  duration: MOTION_DURATION.exit,
  ease: MOTION_EASE.in,
} satisfies Transition;
const REDUCED_FADE = {
  duration: MOTION_DURATION.instant,
  ease: MOTION_EASE.out,
} satisfies Transition;

/** O ramo reduzido de todo popup: um fade curto, sem deslize nem escala. */
const FADE_ONLY: PopupMotion = {
  initial: { opacity: 0 },
  open: { opacity: 1, transition: REDUCED_FADE },
  closed: { opacity: 0, transition: REDUCED_FADE },
};

/**
 * Entrada e saída do painel do Sheet e da gaveta. A entrada é a mola `panel` (a opacidade, um fade
 * curto); a saída, um tween mais curto que leva a opacidade a 0: é por ela que o Base UI espera a
 * animação antes de desmontar (library-docs §23). Com movimento reduzido, só o fade.
 */
export function sheetMotion(
  side: SheetSide,
  kind: SheetMotionKind,
  reduce: boolean,
): PopupMotion {
  if (reduce) return FADE_ONLY;
  const sign = side === "left" || side === "top" ? -1 : 1;
  const away =
    kind === "drawer" ? `${sign * DRAWER_TRAVEL_PCT}%` : sign * SHEET_TRAVEL_PX;
  const home = kind === "drawer" ? "0%" : 0;
  const horizontal = side === "left" || side === "right";
  const at = (value: string | number): MotionValues =>
    horizontal ? { x: value } : { y: value };
  return {
    initial: { ...at(away), opacity: kind === "drawer" ? 1 : 0 },
    open: {
      ...at(home),
      opacity: 1,
      transition: { default: MOTION_SPRING.panel, opacity: ENTER_FADE },
    },
    closed: { ...at(away), opacity: 0, transition: EXIT },
  };
}

/** O véu do Sheet: fade de entrada e de saída (no reduzido, o fade curto). */
export function overlayMotion(reduce: boolean): PopupMotion {
  if (reduce) return FADE_ONLY;
  return {
    initial: { opacity: 0 },
    open: {
      opacity: 1,
      transition: { duration: MOTION_DURATION.base, ease: MOTION_EASE.out },
    },
    closed: { opacity: 0, transition: EXIT },
  };
}

export type TooltipSide =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "inline-start"
  | "inline-end";

const TOOLTIP_TRAVEL_PX = 4;
const TOOLTIP_FROM_SCALE = 0.96;

/** De onde o tooltip sai: 4px para o lado do gatilho. */
const TOOLTIP_FROM: Record<TooltipSide, MotionValues> = {
  top: { y: TOOLTIP_TRAVEL_PX },
  bottom: { y: -TOOLTIP_TRAVEL_PX },
  left: { x: TOOLTIP_TRAVEL_PX },
  "inline-start": { x: TOOLTIP_TRAVEL_PX },
  right: { x: -TOOLTIP_TRAVEL_PX },
  "inline-end": { x: -TOOLTIP_TRAVEL_PX },
};

/**
 * Entrada do tooltip: sai do gatilho (4px) crescendo de 0,96; no reduzido, só o fade curto. A saída é
 * imediata (o tooltip fecha na hora).
 */
export function tooltipMotion(
  side: TooltipSide,
  reduce: boolean,
): { initial: MotionValues; animate: MotionTarget } {
  if (reduce) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1, transition: REDUCED_FADE },
    };
  }
  return {
    initial: { opacity: 0, scale: TOOLTIP_FROM_SCALE, ...TOOLTIP_FROM[side] },
    animate: {
      opacity: 1,
      scale: 1,
      x: 0,
      y: 0,
      transition: { duration: MOTION_DURATION.base, ease: MOTION_EASE.out },
    },
  };
}
