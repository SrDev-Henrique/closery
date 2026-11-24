import "server-only";

import type { z } from "zod";

import type { Db } from "@/db/types";
import type { AdminResult } from "@/features/admin/result";
import { runAction } from "@/features/admin/runAction";
import type { Authz } from "@/features/authz/authz";

// Embrulho fino do runner único (P33), com a revalidação como booleano. O
// salvamento automático passa `revalidate: false` (revalidar re-renderizaria a
// tela enquanto a pessoa digita); entregar, confirmar e corrigir passam `true`.
// Quem chama (a Server Action) já fez `requireUser()` ou `requireAdmin()`; aqui
// só entra o que vem depois.
export async function runHandoverAction<
  S extends z.ZodType,
  T extends object = object,
>(args: {
  actor: Authz;
  schema: S;
  input: unknown;
  revalidate: boolean;
  run: (ctx: {
    db: Db;
    now: Date;
    actor: Authz;
    input: z.output<S>;
  }) => Promise<AdminResult<T>>;
}): Promise<AdminResult<T>> {
  return runAction({
    actor: args.actor,
    schema: args.schema,
    input: args.input,
    run: args.run,
    revalidate: args.revalidate ? "/(app)" : null,
  });
}
