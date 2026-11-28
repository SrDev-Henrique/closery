"use client";

import type { HTMLMotionProps } from "motion/react";
import * as m from "motion/react-m";

import { MOTION_SPRING, PRESS_SCALE } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

const PRESS = { scale: PRESS_SCALE };

// O elemento de todo `Button` (src/components/ui/button.tsx, pela prop `render` do Base UI): um
// <button> do Motion que encolhe ao apertar (PRESS_SCALE, mola `press`) e volta ao soltar. Não encolhe
// com movimento reduzido nem quando abre um popup (`aria-haspopup`): o popup se posiciona contra o
// tamanho do gatilho, que responde só com a cor. `data-press` desliga o aperto de CSS do
// `buttonVariants`, que fica só para o <Link> cru. Sem valor inicial: o HTML do servidor é um <button>
// sem estilo, e o `button.tsx` continua sem "use client" (o `buttonVariants` serve Server Components).
export function PressButton(props: HTMLMotionProps<"button">) {
  const reduce = usePrefersReducedMotion();
  const popup = props["aria-haspopup"];
  const anchorsPopup =
    popup !== undefined && popup !== false && popup !== "false";
  return (
    <m.button
      data-press="motion"
      whileTap={reduce || anchorsPopup ? undefined : PRESS}
      transition={MOTION_SPRING.press}
      {...props}
    />
  );
}
