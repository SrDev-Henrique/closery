import { eq } from "drizzle-orm";
import type { Pool } from "pg";

import { createDb, createPool } from "@/db/client";
import { user } from "@/db/schema";
import type { Db } from "@/db/types";

// Portas e URLs fixas do E2E: o banco (PGlite via socket) e o app (next start).
export const E2E_DB_PORT = 54329;
export const E2E_APP_PORT = 3200;
export const E2E_DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${E2E_DB_PORT}/postgres`;
export const E2E_BASE_URL = `http://localhost:${E2E_APP_PORT}`;

export { buildInviteUrl } from "@/features/invites/inviteUrl";
export { insertInvite, insertSector } from "../test/fixtures";

export function openE2eDb(): { pool: Pool; db: Db } {
  const pool = createPool(E2E_DATABASE_URL);
  return { pool, db: createDb(pool) };
}

export async function deactivateUserByEmail(
  db: Db,
  email: string,
  now: Date = new Date(),
): Promise<void> {
  const rows = await db
    .update(user)
    .set({ deactivatedAt: now })
    .where(eq(user.email, email))
    .returning({ id: user.id });
  if (rows.length !== 1) {
    throw new Error(`Usuário ${email} não encontrado para desativar.`);
  }
}
