import "server-only";

import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { user, verification } from "@/db/schema/auth";
import type { Db } from "@/db/types";
import type { Authz } from "@/features/authz/authz";
import { isHttpUrl } from "@/features/invites/inviteUrl";
import { type Auth, RESET_PASSWORD_PREFIX } from "@/lib/auth/createAuth";
import {
  notFoundMessage,
  PASSWORD_RESET_FORBIDDEN_MESSAGE,
  PERSON_RESET_INACTIVE_MESSAGE,
} from "./messages";
import { type AdminResult, fail, ok } from "./result";

// Quanto vale o link de redefinição. 24 h: o link vai por WhatsApp e a pessoa
// pode estar em outro turno; é uso único, o link novo derruba o anterior,
// desativar a pessoa derruba o link e redefinir revoga todas as sessões. Mais
// longo que isso é só janela de risco (8 h é a alternativa: uma constante só).
export const PASSWORD_RESET_TTL_MS = 24 * 60 * 60 * 1000;

// O token vai no fragmento (#): fragmento nunca chega ao servidor, então não
// aparece em log da Vercel nem no Referer.
export function buildPasswordResetUrl(baseURL: string, token: string): string {
  if (!isHttpUrl(baseURL)) {
    throw new Error(`URL base inválida para a redefinição: "${baseURL}".`);
  }
  return `${new URL(baseURL).origin}/redefinir-senha#token=${token}`;
}

// Gera o link de redefinição de senha de uma pessoa, no formato que
// POST /api/auth/reset-password espera. Só admin (defesa em profundidade: a
// Server Action já fez requireAdmin()). Nunca loga nem devolve o token fora da
// URL.
//
// Exceção à regra de db.transaction(): a criação passa pelo adapter do Better
// Auth, que não entra numa transação nossa. Por isso a ordem é a que falha
// fechado: apaga os links antigos ANTES de criar o novo. Se a criação falhar,
// a pessoa fica sem link e o admin gera outro; nunca ficam dois links válidos.
export async function createPasswordResetLink(
  db: Db,
  auth: Pick<Auth, "$context">,
  input: { actor: Authz; userId: string; baseURL: string },
  now: Date,
): Promise<AdminResult<{ url: string; expiresAt: Date }>> {
  if (input.actor.role !== "admin") {
    return fail("FORBIDDEN", PASSWORD_RESET_FORBIDDEN_MESSAGE);
  }
  if (!isHttpUrl(input.baseURL)) {
    throw new Error(
      `BETTER_AUTH_URL não é uma URL absoluta: "${input.baseURL}".`,
    );
  }

  const [person] = await db
    .select({ id: user.id, deactivatedAt: user.deactivatedAt })
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1);
  if (!person) return fail("NOT_FOUND", notFoundMessage("pessoa"));
  if (person.deactivatedAt) {
    return fail("PERSON_INACTIVE", PERSON_RESET_INACTIVE_MESSAGE);
  }

  // Link novo derruba o anterior (e os vencidos da mesma pessoa): só o último
  // vale. `value = userId` só existe em linhas de redefinição; as outras
  // verificações (desafio de passkey, estado de OAuth) guardam JSON.
  await db.delete(verification).where(eq(verification.value, person.id));

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);
  const { internalAdapter } = await auth.$context;
  await internalAdapter.createVerificationValue({
    identifier: `${RESET_PASSWORD_PREFIX}${token}`,
    value: person.id,
    expiresAt,
  });

  return ok({ url: buildPasswordResetUrl(input.baseURL, token), expiresAt });
}
