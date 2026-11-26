// Log de erro sem vazamento. Um erro do Drizzle carrega no `message` o SQL e os
// parâmetros ("Failed query: ... params: ..."), e esses parâmetros podem ser
// e-mail, hash de token, texto da passagem. Por isso o log nunca recebe o erro
// inteiro nem a mensagem: só o nome da classe, o código (SQLSTATE do Postgres,
// ex.: 23505, ou código de rede, ex.: ECONNREFUSED), o digest do Next e o
// contexto que quem chama escreve. Sem `server-only`: os error boundaries do
// client também usam (lá só o digest existe).

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
export function logServerError(error: unknown, context: string): void {
  console.error(
    JSON.stringify({
      level: "error",
      context: context.slice(0, CONTEXT_MAX_LENGTH),
      ...summarizeError(error),
    }),
  );
}
