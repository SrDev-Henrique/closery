"use client";

import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

import { MOTION_DEFAULT_TRANSITION } from "@/lib/motion";

// A camada do Motion no app inteiro (library-docs §23). Só contexto: nenhum elemento e nenhum script
// (a lição do next-themes, library-docs §18), então pode ficar acima dos Suspense. O LazyMotion carrega
// o domAnimation (animações, saídas e os gestos de toque, foco e hover; sem layout nem arrasto) e o
// `strict` lança se alguém usar o `motion` pronto em vez do `m`. O MotionConfig desliga as
// transformações sozinho quando o aparelho pede menos movimento (a rede: cada componente tem o ramo
// reduzido dele) e dá a transição curta a quem não declarar nenhuma.
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={MOTION_DEFAULT_TRANSITION}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
