// Sem `server-only`: `createPool` também roda em scripts e no E2E.
const DEFAULT_POOL_MAX = 10;

/**
 * Tamanho do pool. `DATABASE_POOL_MAX` só existe no `env` do `webServer` do app
 * no Playwright (`playwright.config.ts`), nunca na Vercel nem no `.env.local`:
 * qualquer valor que não seja um inteiro de 1 a 10 volta ao padrão.
 */
export function poolMaxFrom(
  env: Readonly<Record<string, string | undefined>>,
): number {
  const { DATABASE_POOL_MAX: raw } = env;
  if (raw === undefined || !/^[0-9]{1,2}$/.test(raw)) return DEFAULT_POOL_MAX;
  const value = Number(raw);
  return value >= 1 && value <= DEFAULT_POOL_MAX ? value : DEFAULT_POOL_MAX;
}
