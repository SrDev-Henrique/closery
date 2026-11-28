"use client";

import { cn } from "cn";
import * as m from "motion/react-m";
import { useLayoutEffect, useRef, useState } from "react";

import { SECTOR_COLOR_BG, type SectorColor } from "@/features/sectors/colors";
import { COLOR_FADE } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/lib/usePrefersReducedMotion";

/** Por quanto tempo a cor de um cartão que saiu vale para o próximo que montar, em ms. */
export const REMOUNT_WINDOW_MS = 2000;

// A cor do último cartão desta aba e quando ele saiu. A troca de setor remonta o cartão (P86, P87): a
// cor de antes não sobrevive dentro do componente. Só os efeitos (no cliente) leem e escrevem; o
// servidor nunca toca nela.
let memory: { color: SectorColor; leftAt: number } | null = null;

/** Esquece a cor do último cartão (os testes chamam antes de cada caso). */
export function resetSectorColorMemory(): void {
  memory = null;
}

// A troca de cor do cartão do turno (MyShiftCard) quando o admin muda de setor (emenda do Motion). O
// cartão já pinta a cor nova pela classe, no servidor; esta camada, por baixo do conteúdo (`-z-10`
// dentro do cartão `relative isolate`), mostra a cor de antes e some em COLOR_FADE, e sai do DOM ao
// terminar. Vale para a troca no mesmo cartão e para o cartão que monta logo depois de outro sair (até
// REMOUNT_WINDOW_MS). No primeiro render não existe: não está no HTML do servidor nem anima na
// hidratação. Com movimento reduzido, a cor troca na hora (como o `motion-reduce` de antes).
export function SectorColorFade({ color }: { color: SectorColor }) {
  const reduce = usePrefersReducedMotion();
  const shown = useRef<SectorColor | null>(null);
  const [fading, setFading] = useState<{
    color: SectorColor;
    id: number;
  } | null>(null);

  // Efeito de layout: decide antes da pintura (a cor nova não pisca sem a camada por cima).
  useLayoutEffect(() => {
    const remembered =
      memory !== null && Date.now() - memory.leftAt <= REMOUNT_WINDOW_MS
        ? memory.color
        : null;
    const previous = shown.current ?? remembered;
    shown.current = color;
    memory = null;
    if (previous === null || previous === color || reduce) return;
    setFading((current) => ({ color: previous, id: (current?.id ?? 0) + 1 }));
  }, [color, reduce]);

  // Ao sair (desmontar, ou esconder na Activity), deixa a cor para o próximo cartão. A limpeza de um
  // efeito de layout roda antes dos efeitos do cartão novo no mesmo commit.
  useLayoutEffect(
    () => () => {
      if (shown.current !== null) {
        memory = { color: shown.current, leftAt: Date.now() };
      }
    },
    [],
  );

  if (fading === null) return null;
  return (
    <m.span
      key={fading.id}
      aria-hidden="true"
      data-slot="sector-color-fade"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={COLOR_FADE}
      onAnimationComplete={() => setFading(null)}
      className={cn(
        "pointer-events-none absolute inset-0 -z-10",
        SECTOR_COLOR_BG[fading.color],
      )}
    />
  );
}
