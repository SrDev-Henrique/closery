type Env = Record<string, string | undefined>;

export type DatabaseUrls = {
  /** Com pooler (PgBouncer): tráfego normal da aplicação. */
  runtime: string | undefined;
  /** Direta, sem pooler: migrações do drizzle-kit. */
  migration: string | undefined;
};

// Aceita as duas convenções de nome do Neon:
// - DATABASE_URL (direta) + DATABASE_URL_POOLED (pooler) — a do .env.local atual;
// - DATABASE_URL (pooler) + DATABASE_URL_UNPOOLED (direta) — a do `neon env pull`.
// Em ambas, a variável com sufixo explícito vence o DATABASE_URL genérico.
export function resolveDatabaseUrls(env: Env): DatabaseUrls {
  return {
    runtime: env.DATABASE_URL_POOLED ?? env.DATABASE_URL,
    migration: env.DATABASE_URL_UNPOOLED ?? env.DATABASE_URL,
  };
}
