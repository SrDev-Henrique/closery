import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/sentry/options";

// Só erros do navegador: sem Session Replay, sem tracing e sem client reports.
// A `BrowserSession` (padrão) manda um envelope de sessão ao sentry.io a cada
// carga de página, mesmo sem erro, com IP e navegador. A `BrowserTracing`
// (que o @sentry/nextjs acrescenta às padrão) manda um `client_report` ao
// fechar a página, mesmo sem erro, e a página /privacidade só promete
// relatórios de erro: as duas ficam de fora.
const OFF = new Set(["BrowserSession", "BrowserTracing"]);

Sentry.init(
  sentryOptions({
    integrations: (defaults) =>
      defaults.filter((integration) => !OFF.has(integration.name)),
  }),
);

// Gancho de navegação do SDK; inofensivo sem a integração de tracing (que
// está desligada acima), fica para quando o tracing for ligado.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
