import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/sentry/options";

// Sem Session Replay e sem integrações de performance: só erros do navegador.
// A `BrowserSession` (padrão) manda um envelope de sessão ao sentry.io a cada
// carga de página, mesmo sem erro, com IP e navegador: fica de fora.
Sentry.init(
  sentryOptions({
    integrations: (defaults) =>
      defaults.filter((integration) => integration.name !== "BrowserSession"),
  }),
);

// Inerte com tracesSampleRate 0; fica para quando o tracing for ligado.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
