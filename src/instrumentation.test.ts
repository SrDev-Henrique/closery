import type { NodeOptions } from "@sentry/nextjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { scrubEvent } from "@/lib/sentry/scrubEvent";

import { onRequestError, register } from "./instrumentation";

// O SDK é trocado por espiões: o teste prova só a fiação (quando inicia e com
// quais opções), nunca fala com o Sentry. A captura de verdade está provada em
// src/lib/sentry/options.test.ts.
const sentry = vi.hoisted(() => ({
  init: vi.fn<(options: NodeOptions) => void>(),
  captureRequestError: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => sentry);

beforeEach(() => {
  sentry.init.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("instrumentation.ts (servidor)", () => {
  it("inicia o Sentry uma vez no runtime nodejs, com o scrubEvent", () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");

    register();

    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init.mock.calls[0]?.[0].beforeSend).toBe(scrubEvent);
  });

  it("não inicia no runtime edge", () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");

    register();

    expect(sentry.init).not.toHaveBeenCalled();
  });

  it("não inicia quando o runtime não está definido", () => {
    vi.stubEnv("NEXT_RUNTIME", undefined);

    register();

    expect(sentry.init).not.toHaveBeenCalled();
  });

  it("o erro lançado no servidor chega pelo captureRequestError", () => {
    expect(onRequestError).toBe(sentry.captureRequestError);
  });
});

describe("instrumentation-client.ts (navegador)", () => {
  // O resetModules faz o módulo do cliente enxergar uma cópia nova do
  // scrubEvent: o teste lê a mesma cópia depois de carregar o cliente.
  async function loadClient() {
    vi.resetModules();
    const client = await import("./instrumentation-client");
    const { scrubEvent: loadedScrubEvent } = await import(
      "@/lib/sentry/scrubEvent"
    );
    return { client, loadedScrubEvent };
  }

  it("inicia o Sentry uma vez ao carregar, com o scrubEvent", async () => {
    const { loadedScrubEvent } = await loadClient();

    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init.mock.calls[0]?.[0].beforeSend).toBe(loadedScrubEvent);
  });

  it("tira a integração BrowserSession (sessão a cada página) e mantém as outras", async () => {
    await loadClient();

    const integrations = sentry.init.mock.calls[0]?.[0].integrations;
    if (typeof integrations !== "function") {
      throw new Error("integrations deveria ser uma função");
    }
    const names = integrations([
      { name: "BrowserSession" },
      { name: "GlobalHandlers" },
      { name: "LinkedErrors" },
    ]).map((integration) => integration.name);

    expect(names).toEqual(["GlobalHandlers", "LinkedErrors"]);
  });

  it("exporta o gancho de navegação do SDK", async () => {
    const { client } = await loadClient();

    expect(client.onRouterTransitionStart).toBe(
      sentry.captureRouterTransitionStart,
    );
  });
});
