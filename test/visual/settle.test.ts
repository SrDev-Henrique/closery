import { describe, expect, it } from "vitest";

import {
  CAPTURE_REDUCED_MOTION,
  STYLE_QUIET_MS,
  settleVerdict,
  styleQuietScript,
} from "../../scripts/visual/settle.mjs";

// O assentar das capturas (PB-D6, emenda do Motion): as molas e as cores que o Motion anima em JS
// não aparecem no getAnimations(), mas escrevem no `style` a cada quadro. Sem navegador: o script da
// página roda com um documento e um MutationObserver falsos.

const BASE = { startedAt: 0, quietMs: 200, timeoutMs: 3000 };

describe("settleVerdict", () => {
  it("assenta com quietMs sem escrita no style (no limite exato)", () => {
    expect(settleVerdict({ ...BASE, now: 200, lastWrite: 0 })).toBe("quiet");
    expect(settleVerdict({ ...BASE, now: 199, lastWrite: 0 })).toBe("wait");
  });

  it("escrita recente reinicia a espera", () => {
    expect(settleVerdict({ ...BASE, now: 1000, lastWrite: 900 })).toBe("wait");
  });

  it("estoura no timeoutMs com escrita contínua: animação infinita não trava a captura", () => {
    expect(settleVerdict({ ...BASE, now: 3000, lastWrite: 2990 })).toBe(
      "timeout",
    );
    expect(settleVerdict({ ...BASE, now: 2999, lastWrite: 2990 })).toBe("wait");
  });

  it("o silêncio vence o tempo quando os dois valem", () => {
    expect(settleVerdict({ ...BASE, now: 3500, lastWrite: 3000 })).toBe(
      "quiet",
    );
  });
});

describe("styleQuietScript", () => {
  it("monta uma expressão que compila, com o settleVerdict embutido e os números pedidos", () => {
    const script = styleQuietScript(STYLE_QUIET_MS, 3000);
    expect(script).toContain("function settleVerdict");
    expect(script).toContain(`quietMs: ${STYLE_QUIET_MS}`);
    expect(script).toContain("timeoutMs: 3000");
    expect(() => new Function(`return ${script};`)).not.toThrow();
  });

  it.each([
    [0, 3000],
    [-1, 3000],
    [Number.NaN, 3000],
    [200, 100],
    [200, Number.POSITIVE_INFINITY],
  ])("recusa quietMs=%s com timeoutMs=%s", (quietMs, timeoutMs) => {
    expect(() => styleQuietScript(quietMs, timeoutMs)).toThrow();
  });

  it("numa página falsa: sem escrita assenta; com escrita contínua estoura", async () => {
    let notify: () => void = () => {};
    class FakeObserver {
      constructor(callback: () => void) {
        notify = callback;
      }
      observe(): void {
        // O teste chama o `notify` no lugar das escritas de verdade.
      }
      disconnect(): void {
        // Nada a soltar.
      }
    }
    const run = (script: string) =>
      new Function("document", "MutationObserver", `return ${script};`)(
        { documentElement: {} },
        FakeObserver,
      ) as Promise<string>;

    await expect(run(styleQuietScript(60, 600))).resolves.toBe("quiet");

    const writer = setInterval(() => notify(), 10);
    try {
      await expect(run(styleQuietScript(60, 300))).resolves.toBe("timeout");
    } finally {
      clearInterval(writer);
    }
  });

  it("as capturas rodam com movimento reduzido", () => {
    expect(CAPTURE_REDUCED_MOTION).toBe("reduce");
  });
});
