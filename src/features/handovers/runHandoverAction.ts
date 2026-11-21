import "server-only";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";

import { db } from "@/db";
import type { Db } from "@/db/types";
import {
  type AdminResult,
  fail,
  INTERNAL_ERROR_MESSAGE,
  INVALID_INPUT_MESSAGE,
} from "@/features/admin/result";
import { firstFieldErrors } from "@/features/admin/schemas";
import type { Authz } from "@/features/authz/authz";

// Problema na raiz (entrada que nem é objeto) cai na mensagem genérica: o texto
// padrão do Zod é inglês e nunca pode chegar à tela.
function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue && issue.path.length > 0 ? issue.message : INVALID_INPUT_MESSAGE;
}

// Irmão do runAdminAction (F3-13): o mesmo fluxo, com a revalidação como
// parâmetro. O salvamento automático passa `revalidate: false` (revalidar
// re-renderizaria a tela enquanto a pessoa digita); entregar, confirmar e
// corrigir passam `true`. Quem chama (a Server Action) já fez `requireUser()`
// ou `requireAdmin()`; aqui só entra o que vem depois.
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
  const parsed = args.schema.safeParse(args.input);
  if (!parsed.success) {
    return fail(
      "INVALID_INPUT",
      firstIssueMessage(parsed.error),
      firstFieldErrors(parsed.error),
    );
  }

  let result: AdminResult<T>;
  try {
    result = await args.run({
      db,
      now: new Date(),
      actor: args.actor,
      input: parsed.data,
    });
  } catch (error) {
    // redirect() e notFound() são exceções do Next: têm de seguir adiante.
    unstable_rethrow(error);
    console.error("runHandoverAction: falha inesperada", error);
    // Nunca devolve o texto do erro (pode ser do banco).
    return fail("INTERNAL", INTERNAL_ERROR_MESSAGE);
  }

  // Com route group o caminho é o do arquivo (revalidatePath.md).
  if (result.ok && args.revalidate) revalidatePath("/(app)", "layout");
  return result;
}
