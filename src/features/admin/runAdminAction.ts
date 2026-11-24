import "server-only";

import type { z } from "zod";

import type { Db } from "@/db/types";
import type { Authz } from "@/features/authz/authz";
import type { AdminResult } from "./result";
import { runAction } from "./runAction";

// Embrulho fino do runner único (P33): o painel do admin revalida
// `/(app)/admin`. Quem chama (a Server Action) já fez `requireAdmin()`; aqui só
// entra o que vem depois.
export async function runAdminAction<
  S extends z.ZodType,
  T extends object = object,
>(args: {
  actor: Authz;
  schema: S;
  input: unknown;
  run: (ctx: {
    db: Db;
    now: Date;
    actor: Authz;
    input: z.output<S>;
  }) => Promise<AdminResult<T>>;
}): Promise<AdminResult<T>> {
  return runAction({ ...args, revalidate: "/(app)/admin" });
}
