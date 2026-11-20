import type { Db } from "@/db/types";
import { type Auth, createAuth } from "@/lib/auth/createAuth";
import type { AuthEnv } from "@/lib/auth/env";
import { INVITE_COOKIE } from "@/lib/auth/inviteCookie";

export const TEST_AUTH_ENV: AuthEnv = {
  secret: "test-secret-with-at-least-32-characters-long",
  baseURL: "http://localhost:3000",
  google: null,
  facebook: null,
};

export function createTestAuth(db: Db, env: Partial<AuthEnv> = {}): Auth {
  return createAuth(db, { ...TEST_AUTH_ENV, ...env });
}

// Cadastra por e-mail como o navegador faria: o convite vai no cookie.
// Devolve o resultado do Better Auth; erro vira APIError (lançado).
export async function signUpWithInvite(
  auth: Auth,
  token: string | null,
  input: { name: string; email: string; password: string },
): Promise<unknown> {
  const headers = new Headers();
  if (token) headers.set("cookie", `${INVITE_COOKIE}=${token}`);
  return auth.api.signUpEmail({ body: input, headers });
}

// Monta o header `cookie` a partir dos `set-cookie` de uma resposta
// (ex.: signInEmail com `returnHeaders: true`).
export function sessionCookieOf(headers: Headers): string {
  return headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
}
