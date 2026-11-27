import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import { REDACTED, scrubEvent, scrubText } from "./scrubEvent";

// Dados fictícios.
function fullEvent(): ErrorEvent {
  return {
    type: undefined,
    event_id: "abc",
    message: "falha para ana@exemplo.test em /convite/tok3n-secreto?x=1",
    logentry: {
      message: "falha para %s",
      params: ["ana@exemplo.test"],
    },
    transaction: "/convite/tok3n-secreto",
    server_name: "host-interno",
    sdk: {
      name: "sentry.javascript.nextjs",
      version: "11.18.0",
      settings: { infer_ip: "auto" },
    },
    user: { id: "u1", email: "ana@exemplo.test", ip_address: "10.0.0.1" },
    request: {
      url: "https://closery.vercel.app/convite/tok3n-secreto?email=a@b.test",
      query_string: "email=a@b.test",
      cookies: { "better-auth.session_token": "segredo" },
      headers: { cookie: "x=1", authorization: "Bearer y" },
      data: { senha: "hunter2" },
    },
    breadcrumbs: [{ category: "fetch", data: { url: "/api/x?token=1" } }],
    extra: { corpo: "livre" },
    tags: { url: "/convite/tok3n-secreto", runtime: "node" },
    contexts: {
      trace: { trace_id: "t", span_id: "s" },
      device: { name: "notebook da Ana" },
      os: { name: "Windows" },
    },
    exception: {
      values: [
        {
          type: "Error",
          value: "duplicado: ana@exemplo.test em /redefinir-senha/abc123?z=1",
          mechanism: {
            type: "auto.node.onerror",
            handled: false,
            data: { email: "ana@exemplo.test" },
          },
          stacktrace: {
            frames: [
              { filename: "app/a.ts", lineno: 1, vars: { senha: "hunter2" } },
            ],
          },
        },
      ],
    },
  };
}

describe("scrubText", () => {
  it("corta o SQL e os parâmetros do erro do Drizzle", () => {
    const text =
      'Failed query: insert into "user" ("email") values ($1)\nparams: ana@exemplo.test';

    expect(scrubText(text)).toBe(`Failed query: ${REDACTED}`);
  });

  it("corta tudo depois de `params:` numa mensagem reembrulhada", () => {
    expect(scrubText("falha ao salvar, params: ana@exemplo.test,x")).toBe(
      `falha ao salvar, params: ${REDACTED}`,
    );
  });

  it("esconde o valor que o Postgres repete em erro de tipo e de enum", () => {
    expect(scrubText('invalid input syntax for type uuid: "abc-da-ana"')).toBe(
      `invalid input syntax for type uuid: "${REDACTED}"`,
    );
    expect(scrubText('invalid input value for enum user_role: "chefe"')).toBe(
      `invalid input value for enum user_role: "${REDACTED}"`,
    );
  });

  it("esconde o token do caminho, do fragmento e a query string", () => {
    expect(scrubText("em /convite/tok3n e /redefinir-senha/abc?x=1")).toBe(
      `em /convite/${REDACTED} e /redefinir-senha/${REDACTED}`,
    );
    expect(scrubText("em /redefinir-senha#token=AbC_123-xyz ok")).toBe(
      `em /redefinir-senha#token=${REDACTED} ok`,
    );
  });

  it("esconde e-mail, inclusive com + e subdomínio", () => {
    expect(scrubText("a ana+piloto@mail.exemplo.test b")).toBe(
      `a ${REDACTED} b`,
    );
  });

  it("deixa em paz o texto sem dado de pessoa (inclusive `?` solto e vazio)", () => {
    expect(scrubText("Algo deu errado. E agora? Tente de novo")).toBe(
      "Algo deu errado. E agora? Tente de novo",
    );
    expect(scrubText("")).toBe("");
  });
});

describe("scrubEvent", () => {
  it("remove usuário, IP, cookies, cabeçalhos, corpo, query e servidor", () => {
    const out = scrubEvent(fullEvent());

    expect(out.user).toBeUndefined();
    expect(out.request).toBeUndefined();
    expect(out.server_name).toBeUndefined();
    expect(out.breadcrumbs).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(JSON.stringify(out)).not.toMatch(
      /ana@|10\.0\.0\.1|hunter2|segredo|tok3n|abc123|Bearer|notebook/,
    );
    expect(out.sdk?.settings).toEqual({ infer_ip: "never" });
  });

  it("higieniza e-mail, token de rota e query na mensagem e no transaction", () => {
    const out = scrubEvent(fullEvent());

    expect(out.message).toBe(`falha para ${REDACTED} em /convite/${REDACTED}`);
    expect(out.transaction).toBe(`/convite/${REDACTED}`);
    expect(out.exception?.values?.[0]?.value).toBe(
      `duplicado: ${REDACTED} em /redefinir-senha/${REDACTED}`,
    );
  });

  it("higieniza o valor de toda exceção, inclusive as causas encadeadas", () => {
    const event = fullEvent();
    event.exception = {
      values: [
        {
          type: "Error",
          value: "Failed query: select 1 params: ana@exemplo.test",
        },
        { type: "Error", value: "causa: ana@exemplo.test" },
      ],
    };

    const values = scrubEvent(event).exception?.values ?? [];

    expect(values.map((value) => value.value)).toEqual([
      `Failed query: ${REDACTED}`,
      `causa: ${REDACTED}`,
    ]);
  });

  it("remove o logentry, os dados do mecanismo e as configurações do SDK", () => {
    const out = scrubEvent(fullEvent());

    expect(out.logentry).toBeUndefined();
    expect(out.exception?.values?.[0]?.mechanism).toEqual({
      type: "auto.node.onerror",
      handled: false,
    });
    expect(out.sdk).toEqual({
      name: "sentry.javascript.nextjs",
      version: "11.18.0",
      settings: { infer_ip: "never" },
    });
  });

  it("remove variáveis locais da pilha, mas mantém os frames", () => {
    const frame = scrubEvent(fullEvent()).exception?.values?.[0]?.stacktrace
      ?.frames?.[0];

    expect(frame).toEqual({ filename: "app/a.ts", lineno: 1 });
  });

  it("higieniza filename, abs_path e module de cada frame", () => {
    const event = fullEvent();
    const frames = event.exception?.values?.[0]?.stacktrace?.frames;
    frames?.push({
      abs_path: "https://app.example/redefinir-senha#token=abc123XYZ",
      filename: "https://app.example/equipe?pagina=2&busca=Ana",
      module: "https://app.example/convite/tok3n-secreto",
      lineno: 7,
    });

    const out = scrubEvent(event).exception?.values?.[0]?.stacktrace?.frames;

    expect(out?.[1]).toEqual({
      abs_path: "https://app.example/redefinir-senha#token=[removido]",
      filename: "https://app.example/equipe",
      module: "https://app.example/convite/[removido]",
      lineno: 7,
    });
    expect(JSON.stringify(out)).not.toMatch(/abc123XYZ|busca=Ana|tok3n/);
  });

  it("higieniza o valor de toda tag, não só as de chave com url", () => {
    const event = fullEvent();
    event.tags = {
      ...event.tags,
      rota: "/convite/tok3n-secreto",
      quem: "ana@exemplo.test",
      runtime: "node",
    };

    const out = scrubEvent(event);

    expect(out.tags).toEqual({
      rota: "/convite/[removido]",
      quem: "[removido]",
      runtime: "node",
    });
  });

  it("mantém o que ajuda a investigar: tipo, pilha, trace e tags sem URL", () => {
    const out = scrubEvent(fullEvent());

    expect(out.exception?.values?.[0]?.type).toBe("Error");
    expect(out.contexts).toEqual({
      trace: { trace_id: "t", span_id: "s" },
    });
    expect(out.tags).toEqual({ runtime: "node" });
  });

  it("não muta o evento original (nem o sdk, o mecanismo e os frames)", () => {
    const event = fullEvent();
    scrubEvent(event);

    expect(event.user).toBeDefined();
    expect(event.logentry).toBeDefined();
    expect(event.message).toContain("ana@");
    expect(event.sdk?.settings).toEqual({ infer_ip: "auto" });
    expect(event.exception?.values?.[0]?.mechanism?.data).toEqual({
      email: "ana@exemplo.test",
    });
    expect(event.exception?.values?.[0]?.stacktrace?.frames?.[0]?.vars).toEqual(
      { senha: "hunter2" },
    );
  });

  it("aceita evento mínimo, sem exception, tags nem contexts", () => {
    const event: ErrorEvent = { type: undefined, event_id: "x" };

    const out = scrubEvent(event);

    expect(out.event_id).toBe("x");
    expect(out.contexts).toEqual({});
  });

  it("aceita exception sem valor, sem pilha e sem mecanismo", () => {
    const event: ErrorEvent = {
      type: undefined,
      exception: { values: [{ type: "Error" }] },
    };

    const out = scrubEvent(event);

    expect(out.exception?.values?.[0]).toEqual({ type: "Error" });
  });
});
