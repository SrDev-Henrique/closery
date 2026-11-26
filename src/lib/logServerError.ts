import * as Sentry from "@sentry/nextjs";

// Log de erro sem vazamento. Um erro do Drizzle carrega no `message` o SQL e os
// parâmetros ("Failed query: ... params: ..."), e esses parâmetros podem ser
// e-mail, hash de token, texto da passagem. Por isso o log nunca recebe o erro
// inteiro nem a mensagem: só o nome da classe, o código (SQLSTATE do Postgres,
// ex.: 23505, ou código de rede, ex.: ECONNREFUSED), o digest do Next e o
// contexto que quem chama escreve. Sem `server-only`: os error boundaries do
// client também usam (lá só o digest existe).
//
// É também o ÚNICO ponto que manda erro TRATADO ao Sentry (o erro lançado no
// servidor chega pelo onRequestError do instrumentation.ts): o que não passa
// por aqui não vai, e o que vai passa pelo scrubEvent. Sem DSN o Sentry nem é
// iniciado e a captura não faz nada.

export type ErrorSummary = {
  name: string;
  code: string | null;
  digest: string | null;
};

const SAFE_NAME = /^[A-Za-z0-9_$.]{1,64}$/;
const SAFE_CODE = /^[A-Za-z0-9_]{1,32}$/;
const SAFE_DIGEST = /^[A-Za-z0-9_-]{1,64}$/;
const CONTEXT_MAX_LENGTH = 80;
const CAUSE_DEPTH = 3;

function pick(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null
    ? Reflect.get(value, key)
    : undefined;
}

function safeString(value: unknown, pattern: RegExp): string | null {
  return typeof value === "string" && pattern.test(value) ? value : null;
}

// O DrizzleQueryError traz o erro do `pg` em `cause`; o SQLSTATE está lá.
function findCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < CAUSE_DEPTH; depth++) {
    const code = safeString(pick(current, "code"), SAFE_CODE);
    if (code) return code;
    current = pick(current, "cause");
    if (current === undefined) break;
  }
  return null;
}

export function summarizeError(error: unknown): ErrorSummary {
  const name =
    error instanceof Error
      ? (safeString(error.name, SAFE_NAME) ?? "Error")
      : "NonError";
  return {
    name,
    code: findCode(error),
    digest: safeString(pick(error, "digest"), SAFE_DIGEST),
  };
}

// Uma linha de JSON: a Vercel indexa os campos e o Sentry (depois) lê igual.
// Captura só erro de verdade (null e undefined, como o aviso de IP do Better
// Auth, só escrevem a linha) e só quando não há digest: um erro com digest
// veio da renderização do servidor, que já o reportou pelo onRequestError, e
// a cópia que chega ao navegador só tem a mensagem genérica.
export function logServerError(error: unknown, context: string): void {
  const safeContext = context.slice(0, CONTEXT_MAX_LENGTH);
  const summary = summarizeError(error);
  console.error(
    JSON.stringify({ level: "error", context: safeContext, ...summary }),
  );
  if (error === null || error === undefined || summary.digest !== null) return;
  try {
    Sentry.captureException(error, { tags: { context: safeContext } });
  } catch {
    // O log nunca pode lançar: a linha acima já foi escrita.
  }
}
