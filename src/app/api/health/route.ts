import { sql } from "drizzle-orm";
import { connection } from "next/server";

import { db } from "@/db";
import { logServerError } from "@/lib/logServerError";

export async function GET() {
  // Health check nunca é pré-renderizado nem cacheado.
  await connection();

  const startedAt = performance.now();

  try {
    // Transação de propósito: exercita o mesmo caminho que entregar, corrigir
    // e mudar status usam (D18), não só uma query solta.
    await db.transaction(async (tx) => {
      await tx.execute(sql`select 1`);
    });

    return Response.json({
      status: "ok",
      database: "ok",
      latencyMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    // O detalhe vai para o log do servidor, nunca para a resposta.
    logServerError(error, "health");
    return Response.json(
      { status: "error", database: "unreachable" },
      { status: 503 },
    );
  }
}
