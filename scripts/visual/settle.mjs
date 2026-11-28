// Assentar a página antes de capturar (PB-D6, emenda do Motion; library-docs §23). O getAnimations()
// só vê as animações de CSS e as da Web Animations API (o fade de opacidade do Motion); as molas e as
// cores que o Motion anima em JS aparecem como escritas no atributo `style` a cada quadro. A página
// assenta quando passa STYLE_QUIET_MS sem nenhuma escrita (ou estoura o tempo).

/** Toda captura roda assim (o `reducedMotion` do contexto do Playwright). */
export const CAPTURE_REDUCED_MOTION = "reduce";

/** O silêncio pedido no `style` antes da captura, em ms. */
export const STYLE_QUIET_MS = 200;

/**
 * O veredito de uma amostra: "quiet" (nenhuma escrita há quietMs), "timeout" (estourou) ou "wait".
 * @param {{ now: number, lastWrite: number, startedAt: number, quietMs: number, timeoutMs: number }} sample
 * @returns {"quiet" | "timeout" | "wait"}
 */
export function settleVerdict({
  now,
  lastWrite,
  startedAt,
  quietMs,
  timeoutMs,
}) {
  if (now - lastWrite >= quietMs) return "quiet";
  if (now - startedAt >= timeoutMs) return "timeout";
  return "wait";
}

/**
 * O script da página, para `page.evaluate`: observa as escritas no `style` de qualquer elemento e
 * resolve com o veredito quando ele sai de "wait" (amostra a cada 50 ms). O settleVerdict vai
 * embutido pelo próprio código.
 * @param {number} quietMs
 * @param {number} timeoutMs
 * @returns {string}
 */
export function styleQuietScript(quietMs, timeoutMs) {
  if (!Number.isFinite(quietMs) || quietMs <= 0) {
    throw new Error(`quietMs precisa ser positivo: ${quietMs}`);
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < quietMs) {
    throw new Error(`timeoutMs precisa ser finito e >= quietMs: ${timeoutMs}`);
  }
  return `new Promise((resolve) => {
  const settleVerdict = ${settleVerdict.toString()};
  const startedAt = performance.now();
  let lastWrite = startedAt;
  const observer = new MutationObserver(() => {
    lastWrite = performance.now();
  });
  observer.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ["style"] });
  const check = () => {
    const verdict = settleVerdict({ now: performance.now(), lastWrite, startedAt, quietMs: ${quietMs}, timeoutMs: ${timeoutMs} });
    if (verdict === "wait") {
      setTimeout(check, 50);
      return;
    }
    observer.disconnect();
    resolve(verdict);
  };
  setTimeout(check, 50);
})`;
}
