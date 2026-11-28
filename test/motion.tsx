import { act } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

import { MotionProvider } from "@/components/motion/MotionProvider";

// Ajuda dos testes de movimento (library-docs §23). O jsdom não tem a Web Animations API: o Motion
// anima em JS, quadro a quadro (o Vitest liga o `pretendToBeVisual`, que dá o requestAnimationFrame),
// e escreve no `style` do elemento. Fora do provider o `m` renderiza o `initial` e nunca anima.

/**
 * O provider do app com o Motion proibido de reduzir sozinho (`reducedMotion="never"`): quem decide o
 * ramo reduzido é o `usePrefersReducedMotion` de cada componente, pelo `matchMedia` do
 * `stubReducedMotion`. O estado de movimento reduzido do próprio Motion é lido uma vez por arquivo e
 * faria um teste depender da ordem dos outros.
 */
export function MotionTree({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
      <MotionConfig reducedMotion="never">{children}</MotionConfig>
    </MotionProvider>
  );
}

const REDUCE_QUERY = /prefers-reduced-motion(?!\s*:\s*no-preference)/;

/** Troca o `window.matchMedia`: "pediu menos movimento" vale `reduce`; o resto, `false`. Devolve o desfazer. */
export function stubReducedMotion(reduce: boolean): () => void {
  const original = window.matchMedia;
  window.matchMedia = (query: string): MediaQueryList => ({
    matches: reduce && REDUCE_QUERY.test(query),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  });
  return () => {
    window.matchMedia = original;
  };
}

/** Espera `ms` dentro de um `act`: atualização do React no meio não vira aviso. */
export async function wait(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
}

type MotionProperty = "transform" | "opacity";

/**
 * Os valores de `property` no `style` do elemento durante `ms` depois do `trigger` (o primeiro é o de
 * antes do gatilho; sem repetir valores seguidos).
 */
export async function recordStyle(
  element: HTMLElement,
  property: MotionProperty,
  ms: number,
  trigger: () => void,
): Promise<string[]> {
  const seen = [element.style[property]];
  const observer = new MutationObserver(() => {
    const value = element.style[property];
    if (seen.at(-1) !== value) seen.push(value);
  });
  observer.observe(element, { attributes: true, attributeFilter: ["style"] });
  try {
    trigger();
    await wait(ms);
  } finally {
    observer.disconnect();
  }
  return seen;
}

/**
 * O `style` do primeiro elemento de `selector` no instante em que ele entra no DOM: o callback do
 * MutationObserver é uma microtarefa e roda antes do primeiro quadro do Motion.
 */
export function styleOnInsert(
  selector: string,
  properties: readonly MotionProperty[],
): Promise<Record<string, string>> {
  const read = (element: HTMLElement) =>
    Object.fromEntries(properties.map((name) => [name, element.style[name]]));
  return new Promise((resolve) => {
    const present = document.querySelector<HTMLElement>(selector);
    if (present) {
      resolve(read(present));
      return;
    }
    const observer = new MutationObserver(() => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return;
      observer.disconnect();
      resolve(read(element));
    });
    observer.observe(document.body, { childList: true, subtree: true });
  });
}

/** O deslocamento de `translateX`/`translateY` num `transform` do `style` (null se não houver). */
export function translateOf(
  transform: string,
  axis: "X" | "Y",
): { value: number; unit: string } | null {
  const match = new RegExp(
    `translate${axis}\\((-?[\\d.]+)(px|%|rem)\\)`,
    "i",
  ).exec(transform);
  return match
    ? { value: Number(match[1]), unit: match[2].toLowerCase() }
    : null;
}

/** A escala de um `transform` do `style` (null se não houver). */
export function scaleOf(transform: string): number | null {
  const match = /scale\((-?[\d.]+)\)/i.exec(transform);
  return match ? Number(match[1]) : null;
}
