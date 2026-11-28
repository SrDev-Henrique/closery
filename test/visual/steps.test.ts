import type { Page } from "@playwright/test";
import { describe, expect, it } from "vitest";

import {
  globToRegExp,
  requestMatches,
  runSteps,
  STEP_KINDS,
  validateSteps,
} from "../../scripts/visual/steps.mjs";

// O roteiro de interação (spec §6): validação de cada kind, o casamento de requisição
// e o runner, numa página falsa (sem navegador), com a falha de rede simulada.

describe("validateSteps", () => {
  it("aceita um passo válido de cada kind, e a lista vazia", () => {
    const steps = [
      { kind: "click", target: { role: "button", name: "Agora não" } },
      { kind: "hover", target: { css: '[data-slot="card"]' } },
      { kind: "focus", target: { text: "Ver todas" } },
      { kind: "tab", times: 3 },
      { kind: "press", key: "Escape" },
      {
        kind: "fill",
        target: { role: "textbox", name: "Observação", exact: true },
        value: "",
      },
      { kind: "drag", from: { css: "#a" }, to: { css: "#b" } },
      { kind: "wait", ms: 900 },
      { kind: "waitFor", target: { css: '[role="dialog"]' } },
      {
        kind: "failRequests",
        match: { method: "POST", header: "next-action" },
        times: 1,
      },
      { kind: "restoreRequests" },
      {
        kind: "sample",
        target: { css: "#thumb" },
        read: "x",
        every: 40,
        for: 1000,
      },
    ];
    expect(steps.map((s) => s.kind)).toEqual([...STEP_KINDS]);
    expect(validateSteps(steps)).toEqual([]);
    expect(validateSteps([])).toEqual([]);
  });

  it("não lista, não objeto e kind desconhecido", () => {
    expect(validateSteps("click")).toEqual(["passos: não é uma lista"]);
    expect(validateSteps([7])).toEqual(["passo 1: não é um objeto"]);
    expect(validateSteps([{ kind: "scroll" }])).toEqual([
      "passo 1: kind desconhecido: scroll",
    ]);
  });

  it("campos que faltam e campos a mais", () => {
    expect(validateSteps([{ kind: "click" }])).toEqual([
      "passo 1 (click): falta target",
    ]);
    expect(validateSteps([{ kind: "fill", target: { css: "a" } }])).toEqual([
      "passo 1 (fill): falta value",
    ]);
    expect(validateSteps([{ kind: "drag", from: { css: "a" } }])).toEqual([
      "passo 1 (drag): falta to",
    ]);
    expect(validateSteps([{ kind: "restoreRequests", match: {} }])).toEqual([
      "passo 1 (restoreRequests): campo desconhecido: match",
      "passo 1 (restoreRequests): match vazio (use url, method ou header)",
    ]);
  });

  it("alvo inválido: vazio, sem nome, misturado, desconhecido", () => {
    const errors = validateSteps([
      { kind: "click", target: {} },
      { kind: "click", target: { role: "button" } },
      { kind: "click", target: { css: "a", text: "b" } },
      { kind: "click", target: { role: "button", name: "x", nth: 2 } },
      { kind: "click", target: { css: "" } },
    ]);
    expect(errors).toEqual([
      "passo 1 (click): target: alvo sem role, css nem text",
      "passo 2 (click): target: alvo.name vazio (o nome acessível)",
      "passo 3 (click): target: alvo { css } não aceita outros campos",
      "passo 4 (click): target: alvo com campo desconhecido: nth",
      "passo 5 (click): target: alvo.css vazio",
    ]);
  });

  it("limites: zero, acima do máximo e não inteiro", () => {
    expect(validateSteps([{ kind: "tab", times: 0 }])).toEqual([
      "passo 1 (tab): times inválido: 0 (1 a 50)",
    ]);
    expect(validateSteps([{ kind: "tab", times: 51 }])).toEqual([
      "passo 1 (tab): times inválido: 51 (1 a 50)",
    ]);
    expect(validateSteps([{ kind: "wait", ms: 0 }])).toEqual([
      "passo 1 (wait): ms inválido: 0 (1 a 60000)",
    ]);
    expect(validateSteps([{ kind: "wait", ms: 60_001 }])).toEqual([
      "passo 1 (wait): ms inválido: 60001 (1 a 60000)",
    ]);
    expect(validateSteps([{ kind: "wait", ms: 1.5 }])).toEqual([
      "passo 1 (wait): ms inválido: 1.5 (1 a 60000)",
    ]);
    expect(
      validateSteps([
        { kind: "failRequests", match: { method: "POST" }, times: 0 },
      ]),
    ).toEqual(["passo 1 (failRequests): times inválido: 0 (1 a 1000)"]);
  });

  it("press, failRequests e sample: valores inválidos", () => {
    expect(validateSteps([{ kind: "press", key: "" }])).toEqual([
      "passo 1 (press): key vazia",
    ]);
    expect(
      validateSteps([{ kind: "failRequests", match: { verb: "POST" } }]),
    ).toEqual(["passo 1 (failRequests): match com campo desconhecido: verb"]);
    expect(
      validateSteps([{ kind: "failRequests", match: { url: "/(/" } }]),
    ).toEqual(["passo 1 (failRequests): match.url: regex inválida"]);
    expect(
      validateSteps([
        { kind: "sample", target: { css: "a" }, read: "z", every: 5, for: 100 },
      ]),
    ).toEqual([
      "passo 1 (sample): read inválido: z (x, y, width ou height)",
      "passo 1 (sample): every inválido: 5 (10 até o for)",
    ]);
    expect(
      validateSteps([
        {
          kind: "sample",
          target: { css: "a" },
          read: "x",
          every: 200,
          for: 100,
        },
      ]),
    ).toEqual(["passo 1 (sample): every inválido: 200 (10 até o for)"]);
  });
});

describe("globToRegExp", () => {
  it("** atravessa segmentos, * fica num segmento, o resto é literal", () => {
    const auth = globToRegExp("**/api/auth/*");
    expect(auth.test("http://localhost:3202/api/auth/sign-in")).toBe(true);
    expect(auth.test("http://localhost:3202/api/auth/a/b")).toBe(false);
    expect(globToRegExp("*.png").test("a.png")).toBe(true);
    expect(globToRegExp("*.png").test("a/b.png")).toBe(false);
    expect(globToRegExp("a.b").test("axb")).toBe(false);
    expect(globToRegExp("/?setor=(x)").test("/?setor=(x)")).toBe(true);
  });
});

describe("requestMatches", () => {
  const action = {
    url: "http://localhost:3202/?setor=1",
    method: "POST",
    headers: { "Next-Action": "abc", accept: "text/x-component" },
  };

  it("Server Action: POST com o cabeçalho next-action (sem caixa)", () => {
    expect(
      requestMatches({ method: "post", header: "next-action" }, action),
    ).toBe(true);
  });

  it("todos os campos precisam casar", () => {
    expect(
      requestMatches({ method: "GET", header: "next-action" }, action),
    ).toBe(false);
    expect(requestMatches({ method: "POST", header: "x-nada" }, action)).toBe(
      false,
    );
    expect(requestMatches({ url: "**/api/**", method: "POST" }, action)).toBe(
      false,
    );
  });

  it("url por glob ou por regex entre barras", () => {
    expect(requestMatches({ url: "http://localhost:3202/*" }, action)).toBe(
      true,
    );
    expect(requestMatches({ url: "/setor=\\d/" }, action)).toBe(true);
    expect(requestMatches({ url: "/setor=x/" }, action)).toBe(false);
  });

  it("match vazio ou regex inválida não casam nada", () => {
    expect(requestMatches({}, action)).toBe(false);
    expect(requestMatches({ url: "/(/" }, action)).toBe(false);
  });
});

type FakeRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
};

/** Uma página falsa: registra as ações e passa as requisições pela rota do runner. */
function fakePage(requestOnClick: FakeRequest | null) {
  const calls: string[] = [];
  const listeners = new Map<string, (request: unknown) => void>();
  let handler: ((route: unknown) => Promise<void>) | null = null;

  async function fire(req: FakeRequest): Promise<"abortada" | "seguiu"> {
    const request = {
      url: () => req.url,
      method: () => req.method,
      headers: () => req.headers,
      failure: () => ({ errorText: "net::ERR_FAILED" }),
    };
    let outcome: "abortada" | "seguiu" = "seguiu";
    if (handler) {
      await handler({
        request: () => request,
        abort: async () => {
          outcome = "abortada";
          listeners.get("requestfailed")?.(request);
        },
        fallback: async () => undefined,
      });
    }
    calls.push(`${outcome} ${req.method}`);
    return outcome;
  }

  function locator(description: string) {
    const self = {
      filter: () => self,
      first: () => self,
      click: async () => {
        calls.push(`click ${description}`);
        if (requestOnClick) await fire(requestOnClick);
      },
      hover: async () => {
        calls.push(`hover ${description}`);
      },
      focus: async () => {
        calls.push(`focus ${description}`);
      },
      fill: async (value: string) => {
        calls.push(`fill ${description} ${value}`);
      },
      dragTo: async () => {
        calls.push(`drag ${description}`);
      },
      waitFor: async () => {
        calls.push(`waitFor ${description}`);
      },
      boundingBox: async () => ({ x: 10.4, y: 0, width: 5, height: 5 }),
    };
    return self;
  }

  const page = {
    getByRole: (role: string, options: { name: string }) =>
      locator(`${role}:${options.name}`),
    locator: (css: string) => locator(`css:${css}`),
    getByText: (text: string) => locator(`text:${text}`),
    keyboard: {
      press: async (key: string) => {
        calls.push(`press ${key}`);
      },
    },
    waitForTimeout: (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
    route: async (_url: string, fn: (route: unknown) => Promise<void>) => {
      handler = fn;
    },
    unroute: async () => {
      handler = null;
    },
    on: (event: string, fn: (request: unknown) => void) => {
      listeners.set(event, fn);
    },
    off: (event: string) => {
      listeners.delete(event);
    },
  };
  return { page: page as unknown as Page, calls, fire };
}

describe("runSteps (página falsa)", () => {
  const serverAction = {
    url: "http://localhost:3202/",
    method: "POST",
    headers: { "next-action": "id" },
  };

  it("falha de rede: aborta só a primeira Server Action (times: 1) e registra a falha", async () => {
    const fake = fakePage(serverAction);
    const log = await runSteps(fake.page, [
      {
        kind: "failRequests",
        match: { method: "POST", header: "next-action" },
        times: 1,
      },
      { kind: "click", target: { role: "button", name: "Agora não" } },
      { kind: "click", target: { css: "#de-novo" } },
      { kind: "wait", ms: 5 },
    ]);
    expect(log.failed).toEqual([
      {
        url: "http://localhost:3202/",
        method: "POST",
        error: "net::ERR_FAILED",
      },
    ]);
    expect(fake.calls).toEqual([
      "click button:Agora não",
      "abortada POST",
      "click css:#de-novo",
      "seguiu POST",
    ]);
  });

  it("restoreRequests tira a falha", async () => {
    const fake = fakePage(null);
    const log = await runSteps(fake.page, [
      { kind: "failRequests", match: { url: "**/api/**" } },
      { kind: "restoreRequests" },
    ]);
    expect(
      await fake.fire({
        url: "http://localhost:3202/api/x",
        method: "GET",
        headers: {},
      }),
    ).toBe("seguiu");
    expect(log.failed).toEqual([]);
  });

  it("tab, press, fill, hover, focus, drag e waitFor chegam à página", async () => {
    const fake = fakePage(null);
    await runSteps(fake.page, [
      { kind: "tab", times: 2 },
      { kind: "press", key: "Enter" },
      { kind: "fill", target: { css: "#campo" }, value: "abc" },
      { kind: "hover", target: { text: "Ver" } },
      { kind: "focus", target: { css: "#a" } },
      { kind: "drag", from: { css: "#a" }, to: { css: "#b" } },
      { kind: "waitFor", target: { css: "#c" } },
    ]);
    expect(fake.calls).toEqual([
      "press Tab",
      "press Tab",
      "press Enter",
      "fill css:#campo abc",
      "hover text:Ver",
      "focus css:#a",
      "drag css:#a",
      "waitFor css:#c",
    ]);
  });

  it("sample guarda a caixa arredondada só quando muda", async () => {
    const fake = fakePage(null);
    const log = await runSteps(fake.page, [
      {
        kind: "sample",
        target: { css: "#thumb" },
        read: "x",
        every: 10,
        for: 40,
      },
    ]);
    expect(log.samples).toHaveLength(1);
    expect(log.samples[0]?.value).toBe(10);
  });

  it("passos inválidos lançam antes de mexer na página", async () => {
    const fake = fakePage(null);
    await expect(runSteps(fake.page, [{ kind: "wait" }])).rejects.toThrow(
      "passo 1 (wait): falta ms",
    );
    expect(fake.calls).toEqual([]);
  });
});
