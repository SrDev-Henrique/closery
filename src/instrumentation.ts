import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/sentry/options";

// Roda uma vez por instância do servidor. O proxy.ts do Next 16 roda em Node,
// então não há runtime edge para iniciar. Sem DSN, `enabled: false`: nada sai.
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init(sentryOptions());
  }
}

// Erros de Server Components, Route Handlers, Server Actions e do proxy.
export const onRequestError = Sentry.captureRequestError;
