// O Drizzle 0.45 embrulha o erro do driver: o SQLSTATE e o nome da constraint
// ficam em `error.cause` (F2-18). Olhamos o erro e até dois níveis de `cause`.
const MAX_DEPTH = 3;
const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/;

function read(error: unknown, key: "code" | "constraint"): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    if (typeof current !== "object" || current === null) return undefined;
    const value: unknown = Reflect.get(current, key);
    if (typeof value === "string") {
      // Códigos do Node ("ECONNRESET") não são SQLSTATE: seguem para a cause.
      if (key !== "code" || SQLSTATE_PATTERN.test(value)) return value;
    }
    current = Reflect.get(current, "cause");
  }
  return undefined;
}

export function sqlStateOf(error: unknown): string | undefined {
  return read(error, "code");
}

export function constraintOf(error: unknown): string | undefined {
  return read(error, "constraint");
}

/** SQLSTATE 23505: índice ou constraint única violada. */
export function isUniqueViolation(error: unknown): boolean {
  return sqlStateOf(error) === "23505";
}
