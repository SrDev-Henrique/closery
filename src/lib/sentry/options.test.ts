import * as Sentry from "@sentry/nextjs";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sentryOptions } from "./options";
import { scrubEvent } from "./scrubEvent";

// Prova a captura sem conta: DSN falso + transporte que só guarda o envelope
// (como texto) e nunca abre uma conexão.
const FAKE_DSN = "https://public@o0.ingest.sentry.io/0";

type StartedSentry = { sent: string[] };

function startSentry(
  dsn: string | undefined,
  integrations: Sentry.NodeOptions["integrations"] = [],
): StartedSentry {
  const sent: string[] = [];
  Sentry.init(
    sentryOptions({
      dsn,
      enabled: Boolean(dsn),
      defaultIntegrations: false,
      integrations,
      transport: () => ({
        send: async (envelope) => {
          sent.push(JSON.stringify(envelope));
          return { statusCode: 200 };
        },
        flush: async () => true,
      }),
    }),
  );
  return { sent };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// O envelope é [cabeçalho, [[cabeçalho do item, carga], ...]]: devolve só as
// cargas dos itens do tipo "event".
function sentEvents(sent: string[]): Record<string, unknown>[] {
  const events: Record<string, unknown>[] = [];
  for (const text of sent) {
    const envelope: unknown = JSON.parse(text);
    const items: unknown = Array.isArray(envelope) ? envelope[1] : undefined;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (
        Array.isArray(item) &&
        isRecord(item[0]) &&
        item[0].type === "event" &&
        isRecord(item[1])
      ) {
        events.push(item[1]);
      }
    }
  }
  return events;
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Sentry.close();
});

describe("sentryOptions", () => {
  it("sem DSN fica desligado e nada é enviado", async () => {
    const options = sentryOptions({ dsn: undefined, enabled: false });
    const { sent } = startSentry(undefined);

    Sentry.captureException(new Error("sem dsn"));
    await Sentry.flush(1000);

    expect(options.enabled).toBe(false);
    expect(sent).toEqual([]);
  });

  it("sem NEXT_PUBLIC_SENTRY_DSN o Sentry fica desligado (derivado do ambiente)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    vi.resetModules();
    const { sentryOptions: fromEmptyEnv } = await import("./options");

    expect(fromEmptyEnv().enabled).toBe(false);
    expect(fromEmptyEnv().dsn).toBeFalsy();
  });

  it("com NEXT_PUBLIC_SENTRY_DSN o Sentry liga com esse DSN (derivado do ambiente)", async () => {
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", FAKE_DSN);
    vi.resetModules();
    const { sentryOptions: fromEnv } = await import("./options");

    expect(fromEnv().enabled).toBe(true);
    expect(fromEnv().dsn).toBe(FAKE_DSN);
  });

  it("não envia client reports (só erros saem)", () => {
    expect(sentryOptions().sendClientReports).toBe(false);
  });

  it("não liga performance, replay nem breadcrumbs", () => {
    const options = sentryOptions();

    expect(options.tracesSampleRate).toBe(0);
    expect(options.maxBreadcrumbs).toBe(0);
    expect(options).not.toHaveProperty("replaysSessionSampleRate");
    expect(options).not.toHaveProperty("replaysOnErrorSampleRate");
  });

  it("desliga toda coleta de dados pessoais (dataCollection)", () => {
    expect(sentryOptions().dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
    });
  });

  it("o SDK resolve toda a coleta como desligada", () => {
    startSentry(FAKE_DSN);
    const leaves = (value: unknown): unknown[] =>
      typeof value === "object" && value !== null && !Array.isArray(value)
        ? Object.values(value).flatMap(leaves)
        : [value];
    const resolved = Sentry.getClient()?.getDataCollectionOptions();
    expect(resolved).toBeDefined();
    // `frameContextLines` é um número (linhas de código-fonte ao redor do
    // frame, que o scrubEvent mantém), não uma coleta de dado de pessoa.
    const { frameContextLines: _lines, ...collected } = resolved ?? {};
    for (const leaf of leaves(collected)) {
      expect(leaf === false || (Array.isArray(leaf) && leaf.length === 0)).toBe(
        true,
      );
    }
  });

  it("limpa o evento pelo scrubEvent antes do envio", () => {
    expect(sentryOptions().beforeSend).toBe(scrubEvent);
  });

  it("o ambiente é o da Vercel, ou o do Node fora dela", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(sentryOptions().environment).toBe("production");

    vi.stubEnv("VERCEL_ENV", undefined);
    expect(sentryOptions().environment).toBe("test");
  });

  it("os overrides valem por último", () => {
    const options = sentryOptions({ maxBreadcrumbs: 5, enabled: true });

    expect(options.maxBreadcrumbs).toBe(5);
    expect(options.enabled).toBe(true);
  });

  it("com DSN, um erro lançado vira evento já sem dado pessoal", async () => {
    const { sent } = startSentry(FAKE_DSN);

    Sentry.setUser({
      id: "u1",
      email: "ana@exemplo.test",
      ip_address: "{{auto}}",
    });
    Sentry.addBreadcrumb({ message: "clicou em ana@exemplo.test" });
    Sentry.withScope((scope) => {
      scope.setExtra("corpo", "senha=hunter2");
      scope.setTag("url", "/convite/tok3n");
      Sentry.captureException(
        new Error(
          "falha ao salvar para ana@exemplo.test em /convite/tok3n?x=1",
        ),
      );
    });
    await Sentry.flush(1000);

    const events = sentEvents(sent);
    expect(events).toHaveLength(1);
    const json = JSON.stringify(events[0]);
    expect(json).toContain("falha ao salvar");
    expect(json).not.toMatch(/ana@|hunter2|tok3n|ip_address|clicou/);
    expect(events[0]?.user).toBeUndefined();
    expect(events[0]?.request).toBeUndefined();
  });

  it("o erro do Drizzle sai sem o SQL, sem os parâmetros e sem a causa do pg", async () => {
    const { sent } = startSentry(FAKE_DSN, [Sentry.linkedErrorsIntegration()]);
    const cause = Object.assign(
      new Error(
        'duplicate key value violates unique constraint "user_email_key"\nKey (email)=(ana@exemplo.test) already exists.',
      ),
      { code: "23505" },
    );

    Sentry.captureException(
      new DrizzleQueryError(
        'insert into "user" ("email") values ($1)',
        ["ana@exemplo.test"],
        cause,
      ),
    );
    await Sentry.flush(1000);

    const events = sentEvents(sent);
    expect(events).toHaveLength(1);
    const json = JSON.stringify(events[0]);
    expect(json).toContain("Failed query: [removido]");
    expect(json).toContain("duplicate key value violates unique constraint");
    expect(json).not.toMatch(/insert|\$1|params: ana|ana@/);
  });
});
