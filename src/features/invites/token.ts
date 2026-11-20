import { createHash, randomBytes } from "node:crypto";

// 32 bytes em base64url, sem preenchimento, dão sempre 43 caracteres.
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
}

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Valida o formato antes de qualquer consulta: lixo vindo de URL ou cookie
// nunca chega ao banco.
export function isWellFormedInviteToken(value: unknown): value is string {
  return typeof value === "string" && INVITE_TOKEN_PATTERN.test(value);
}
