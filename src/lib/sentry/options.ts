import type { NodeOptions } from "@sentry/nextjs";

import { scrubEvent } from "./scrubEvent";

// Um DSN só, público por natureza (só permite ENVIAR eventos). Sem a variável
// o Sentry não é iniciado e nada sai da máquina. Como NEXT_PUBLIC_*, o valor é
// gravado no build: trocar o DSN exige novo deploy.
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Opções comuns ao servidor e ao navegador. No @sentry/nextjs 11 o
// `sendDefaultPii` não existe mais e o padrão de `dataCollection` coleta TUDO
// (cookies, cabeçalhos, corpos, query); por isso fica tudo desligado aqui.
export function sentryOptions(
  overrides: Partial<NodeOptions> = {},
): NodeOptions {
  return {
    dsn: SENTRY_DSN,
    enabled: Boolean(SENTRY_DSN),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    maxBreadcrumbs: 0,
    // Só erros saem: nem o relatório de eventos descartados (client_report).
    sendClientReports: false,
    dataCollection: {
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
    },
    beforeSend: scrubEvent,
    ...overrides,
  };
}
