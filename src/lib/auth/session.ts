import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { type Authz, isAdmin, toAuthz } from "@/features/authz/authz";
import { auth } from "@/lib/auth";

// Lê a sessão fresca do banco (sem cookieCache: desativar vale na hora) e
// memoiza por requisição. Chame sempre dentro de <Suspense> (Cache Components);
// nunca de função "use cache".
// `disableRefresh`: o render só lê. Sem isso o Better Auth estenderia
// `expiresAt` no banco e descartaria o Set-Cookie (RSC), e o cookie nunca seria
// renovado. A renovação (banco + cookie) é do SessionKeepAlive, via HTTP.
export const getAuthz: () => Promise<Authz | null> = cache(async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
    query: { disableRefresh: true },
  });
  return toAuthz(session?.user);
});

export async function requireUser(): Promise<Authz> {
  const authz = await getAuthz();
  if (!authz) redirect("/entrar");
  return authz;
}

// Operador em /admin recebe 404, não 403: não revela o que existe (T12).
export async function requireAdmin(): Promise<Authz> {
  const authz = await requireUser();
  if (!isAdmin(authz)) notFound();
  return authz;
}
