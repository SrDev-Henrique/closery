// Roda uma operação que deve falhar e devolve o SQLSTATE e o nome da
// constraint. O Drizzle 0.45 embrulha o erro do driver: o original fica em
// `error.cause` (F2-18). Se a operação não falhar, lança.
export type SqlError = { code?: string; constraint?: string };

function pick(source: unknown, key: "code" | "constraint"): string | undefined {
  if (typeof source !== "object" || source === null || !(key in source)) {
    return undefined;
  }
  const value: unknown = Reflect.get(source, key);
  return typeof value === "string" ? value : undefined;
}

export async function sqlErrorOf(
  operation: PromiseLike<unknown>,
): Promise<SqlError> {
  try {
    await operation;
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined;
    const source = typeof cause === "object" && cause !== null ? cause : error;
    return {
      code: pick(source, "code"),
      constraint: pick(source, "constraint"),
    };
  }
  throw new Error("a operação deveria ter falhado");
}
