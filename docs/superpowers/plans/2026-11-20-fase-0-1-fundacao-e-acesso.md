# Fase 0 + Fase 1 — Fundação de testes e Acesso — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o Closery com testes automatizados de verdade (unidade, componente, integração com banco e E2E) e com acesso completo: cadastro só por convite (e-mail e senha, Google, Facebook), login com passkey, papéis admin/operador escopados por setor, script `admin:invite`, telas `/entrar`, `/convite/[token]`, `/bem-vindo`, `/conta` e o shell de navegação.

**Architecture:** Next.js 16 server-first. Domínio em funções puras que recebem `db` por parâmetro (testadas com PGlite em processo); Better Auth montado por uma fábrica `createAuth(db, env)` (a mesma fábrica no app, nos testes e no E2E); o portão de cadastro é `databaseHooks.user.create.before`, que consome o convite lido do cookie `closery_invite` com um `UPDATE … RETURNING` atômico. Sessão lida fresca do banco a cada requisição (sem `cookieCache`), atrás de `<Suspense>` por causa do Cache Components.

**Tech Stack:** Next.js 16.4.6 · React 19.3 · TypeScript 5.9 · Bun 1.3.3 · Drizzle 0.45.4 + `pg` 8.23 (Neon) · Better Auth 1.7.27 + `@better-auth/passkey` 1.7.27 · Zod 4 · shadcn/ui `base-nova` (Base UI) · Tailwind 4 · Vitest 5.1.1 + jsdom 28 + Testing Library · PGlite 0.5.17 (+ `pglite-socket` 0.2.20 no E2E) · Playwright 1.65.1 · Biome 2.4.

**Spec:** `docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md` (§4 Acesso, §9 Modelo de dados, §10 Arquitetura, §12 Testes, §13 Fases).

## Global Constraints

- Leia `AGENTS.md` e os arquivos de `.context/` antes de começar; as regras de lá valem em toda tarefa.
- Node **≥ 22.12** (exigência do Vitest 5). Bun é o gerenciador e o runner de scripts; **nunca** `bun test` (é o runner do Bun, não o Vitest) — use `bun run test`.
- Biome é a lei de formatação: espaços (2), aspas duplas, ponto e vírgula. Rode `bun run format` depois de qualquer `shadcn add` ou código gerado.
- TypeScript strict: sem `any`, sem `!` non-null de conveniência, sem `as` para calar erro (exceto o cast documentado em teste de contrato).
- Named exports em tudo, exceto entry files do Next (`page.tsx`, `layout.tsx`, `route.ts`, `error.tsx`, `not-found.tsx`, `proxy.ts`). Componentes em `PascalCase.tsx`; utilitários em `camelCase.ts`; primitivos shadcn em `kebab-case.tsx`.
- Base UI, não Radix: composição pela prop `render`. Navegação com cara de botão é `<Link href=… className={buttonVariants({ … })}>` (continua com role `link`; testes e E2E usam `getByRole("link")`). `Button render={<Link …/>}` (com `nativeButton={false}`) vira `role="button"` e só se usa quando o papel de botão for o desejado.
- Só tokens de cor (`bg-background`, `text-muted-foreground`, `bg-success`…); nunca hex nem cor crua do Tailwind em componente.
- Cache Components ligado: `cookies()`, `headers()`, `await params`/`searchParams` e qualquer leitura de sessão **só dentro de `<Suspense>`**; nunca em função `"use cache"`; nunca `await` de sessão no topo de layout.
- Erro esperado é **retornado** (`{ ok: false, … }`); `throw` só para falha interna. Dentro de hook do Better Auth, todo throw é `APIError` com `code` (nunca `Error`).
- Textos de interface em pt-BR, exatamente como na seção **Textos de interface** abaixo (testes e E2E dependem deles).
- Nenhum dado real da planilha original (nomes de pessoas) em código, seed, teste ou fixture.
- Datas: `timestamptz` nas tabelas do domínio; funções de domínio recebem `now: Date` por parâmetro (testes determinísticos).
- Toda tarefa termina com: `bun run check-types`, `bun run lint`, `bun run test` verdes e commit. Mensagens de commit em pt-BR (`tipo(escopo): resumo`) terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (use `git commit -F - <<'EOF' … EOF`; nunca `--no-verify`).
- **Shell:** todos os comandos deste plano são bash. Rode-os no Git Bash (ferramenta Bash), nunca no PowerShell (`sed -i`, `VAR=x cmd`, heredoc e `&` não existem lá). Para subir um servidor e esperar, use a opção de background da ferramenta (ou `&`) e `curl -s -o /dev/null --retry 30 --retry-connrefused --retry-delay 1 <url>`; nunca `sleep` em primeiro plano.
- **Worktree:** se a execução usar `git worktree`, copie o `.env.local` do checkout principal para a worktree antes da Tarefa 1 (ele é ignorado pelo git e `db:migrate`, `admin:invite` e `build` precisam dele). O `.gitattributes` da Tarefa 1 garante LF mesmo com `core.autocrlf=true`; numa worktree criada **antes** da Tarefa 1, rode `git add --renormalize . && git status` depois dela.

---

## Decisões técnicas deste plano (complementam a spec)

| # | Decisão | Por quê |
|---|---|---|
| T1 | Domínio recebe `db: Db` por parâmetro; `src/db/index.ts` (com `server-only`) só monta o singleton | Testável com PGlite sem mock; scripts usam `src/db/client.ts` |
| T2 | `Db = PgDatabase<PgQueryResultHKT, Schema>` (de `drizzle-orm/pg-core`) | `NodePgDatabase<Schema>` e `PgliteDatabase<Schema>` são atribuíveis a ele. A união dos dois (padrão do klauve) quebra `.returning({ … })` com TS2554 |
| T3 | Schema do Better Auth **escrito à mão** em `src/db/schema/auth.ts`, copiando a saída real da CLI `auth generate` 1.7.27, com `user.sector_id` como `uuid` FK para `sector` | A CLI não consegue importar a config (cadeia `server-only`/schema); um teste guarda com `getAuthTables` prova que o schema bate com o que o Better Auth espera |
| T4 | Convite consumido no `user.create.before` (spec §4.3); `user.create.after` grava `used_by` | Atômico no banco. Sign-up por e-mail checa e-mail existente **antes** do hook, então "e-mail já cadastrado" não gasta convite (teste prova) |
| T5 | Hook **sem** `ctx` (fora de endpoint) recusa a criação (fail-closed) | Nenhum caminho legítimo cria usuário fora de requisição |
| T6 | Adapter Drizzle com `transaction` no padrão (desligado) | Ligado, o hook consulta fora da transação e o PGlite (uma conexão) trava |
| T7 | Sem `session.cookieCache` e sem `nextCookies()` | Desativação vale na hora (spec §4.1); cadastro/login vão pelo `authClient` via HTTP (onde o rate limit atua), então nenhum `auth.api.sign*` roda em Server Action |
| T8 | Rate limit do Better Auth com `storage: "database"` (tabela `rate_limit`), ligado só em produção | `memory` não serve em serverless |
| T9 | Apple fica para a Fase 6 (P6); Google e Facebook entram condicionais às env vars | Spec §4.3 |
| T10 | Cookie `closery_invite` = token bruto, `httpOnly`, `SameSite=Lax`, `Secure` em produção, `path=/`, 1 h; gravado por Server Action `armInvite` | `Lax` volta no callback OAuth; página só lê, nunca grava (prefetch/scanner não gastam convite) |
| T11 | E2E com PGlite servido por `pglite-socket` (porta 54329, `maxConnections: 20`) | Banco efêmero, sem credenciais, sem tocar o Neon |
| T12 | `/admin` por operador cai em `notFound()` e vê "Página não encontrada"; a página **não** exporta `metadata` (o título fica "Closery") | Spec §4.1: não revelar o que existe. Com Cache Components e a sessão dentro de `<Suspense>`, o shell já saiu quando `notFound()` roda: o status HTTP é 200 e o HTML traz `noindex`. O E2E confere o texto, não o status |
| T13 | `account.accountLinking.disableImplicitLinking: true` | (Atualizado depois da Fase 1: o hook não força mais `emailVerified`; o e-mail do cadastro por senha não é verificado.) Vincular login social pelo e-mail abriria tomada de conta. Quem criou conta por e-mail e tenta Google recebe `account_not_linked` |
| T14 | Códigos do WebAuthn traduzidos na borda por `passkeyErrorCode` (Tarefa 9), não no mapa de erros | O cliente de passkey repassa o código do `@simplewebauthn/browser`: fechar o diálogo vira `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY` e abort vira `ERROR_CEREMONY_ABORTED`. O mapa `AUTH_ERROR_MESSAGES` fica igual ao contrato |
| T15 | `package.json` com `"type": "module"`; ambiente dom = **jsdom 28** + polyfill de `matchMedia` em `test/setup-dom.ts` | jsdom 31 exige Node ≥ 22.22.2 e não sobe no 22.12. jsdom não implementa `matchMedia`, que o `useIsMobile` do sidebar chama. `"type": "module"` tira o aviso do Vite; build, drizzle-kit e Playwright foram validados com ele |
| T16 | Tabelas do Better Auth com `timestamp` **sem** fuso (fiel à CLI); domínio com `timestamptz` | O Drizzle grava `toISOString()` e lê como UTC nos dois sentidos, então não há deslocamento por fuso do processo |
| T17 | `check-types` = `next typegen && tsc --noEmit`; `.gitattributes` com `* text=auto eol=lf` | `LayoutProps`/`PageProps` vêm de `.next/types`, que não existe em checkout limpo. O Git desta máquina tem `core.autocrlf=true` e CRLF reprova o Biome |

---

## Estrutura de arquivos

```
.gitattributes                                (criar)  * text=auto eol=lf (T17)                          [1]
.env.example                                  (modificar) + BETTER_AUTH_SECRET, BETTER_AUTH_URL, GOOGLE_*, FACEBOOK_* [6]
.gitignore                                    (modificar) artefatos do Playwright                        [12]
biome.json                                    (modificar) overrides só para código gerado do shadcn      [3]
next.config.ts                                (modificar) headers(): Referrer-Policy no-referrer em /convite/:path* [9]
package.json                                  (modificar) type module, scripts, engines, deps            [1, 3, 4, 5, 6, 12]
vitest.config.ts                              (criar)  projects node + dom                               [1]
playwright.config.ts                          (criar)                                                    [12]
drizzle/0000_*.sql, drizzle/0001_auth_e_convites.sql (gerar) migrações versionadas                       [1, 4]
test/empty.ts                                 (criar)  substitui "server-only" nos testes                [1]
test/setup-dom.ts                             (criar)  jest-dom, cleanup, polyfill de matchMedia         [1]
test/global-setup.ts                          (criar)  migra ./drizzle 1x e grava o dump do PGlite       [1]
test/db.ts                                    (criar)  createTestDb, resetDb, TABLES                     [1, 4]
test/db.test.ts                               (criar)  guarda: TABLES == pg_tables                       [1]
test/touchTargets.ts                          (criar)  asserções de alvo de toque (P3)                   [3]
test/fixtures.ts                              (criar)  insertSector, insertUser, insertInvite            [4]
test/auth.ts                                  (criar)  TEST_AUTH_ENV, createTestAuth, signUpWithInvite, sessionCookieOf [6]
e2e/start-db.ts                               (criar)  PGlite migrado + pglite-socket                    [12]
e2e/db.ts                                     (criar)  conexão do teste ao banco do E2E + seed + deactivateUserByEmail [12]
e2e/virtual-authenticator.ts                  (criar)                                                    [12]
e2e/auth.spec.ts                              (criar)                                                    [12]
scripts/adminInvite.ts                        (criar)  CLI fina sobre createAdminInvite                  [5]
src/proxy.ts                                  (criar)                                                    [7]
src/hooks/use-mobile.ts                       (criar via shadcn add)                                     [3]
src/db/client.ts                              (criar)  createPool, createDb (sem server-only)            [1]
src/db/index.ts                               (modificar) usa client.ts                                  [1]
src/db/types.ts                               (criar)  Schema, Db                                        [1]
src/db/schema.ts                              (apagar) → vira a pasta src/db/schema/                     [1]
src/db/schema/index.ts                        (criar)                                                    [1, 4]
src/db/schema/sectors.ts                      (criar)                                                    [1]
src/db/schema/auth.ts                         (criar)                                                    [4]
src/db/schema/invites.ts                      (criar)                                                    [4]
src/db/databaseUrl.test.ts                    (criar)                                                    [1]
src/lib/roles.ts                              (criar)                                                    [4]
src/lib/names.ts                              (criar)  firstName                                         [8]
src/lib/auth/env.ts                           (criar)                                                    [6]
src/lib/auth/inviteCookie.ts                  (criar)                                                    [6]
src/lib/auth/errors.ts                        (criar)                                                    [6]
src/lib/auth/createAuth.ts                    (criar)                                                    [6]
src/lib/auth/index.ts                         (criar)  server-only: singleton auth                       [6]
src/lib/auth/client.ts                        (criar)  "use client": authClient                          [6]
src/lib/auth/session.ts                       (criar)  server-only: getAuthz, requireUser, requireAdmin  [7]
src/features/invites/token.ts                 (criar)                                                    [4]
src/features/invites/inviteState.ts           (criar)                                                    [4]
src/features/invites/inviteQueries.ts         (criar)                                                    [4]
src/features/invites/inviteUrl.ts             (criar)  buildInviteUrl, isHttpUrl                         [4]
src/features/invites/adminInvite.ts           (criar)  createAdminInvite (lógica testável do script)     [5]
src/features/invites/inviteSentence.ts        (criar)  frase "… te convidou …"                           [9]
src/features/invites/inviteMessages.ts        (criar)  textos dos estados inválidos                      [9]
src/features/authz/authz.ts                   (criar)                                                    [7]
src/features/authz/sectorScope.ts             (criar)                                                    [7]
src/features/authz/proxyRules.ts              (criar)                                                    [7]
src/app/globals.css                           (modificar) tokens D16                                     [2]
src/app/chartPalette.test.ts                  (criar)  guarda de paleta (P9)                             [2]
src/app/layout.tsx                            (modificar) title template, TooltipProvider, Toaster       [8]
src/app/page.tsx                              (apagar) → src/app/(app)/page.tsx                          [8]
src/app/error.tsx                             (criar)  "use client", prop retry                          [8]
src/app/not-found.tsx                         (criar)                                                    [8]
src/app/api/auth/[...all]/route.ts            (criar)                                                    [6]
src/app/(app)/layout.tsx                      (criar)  shell autenticado                                 [8]
src/app/(app)/page.tsx                        (criar)  Início                                            [8]
src/app/(app)/admin/page.tsx                  (criar)  sem metadata (T12)                                [8]
src/app/(app)/bem-vindo/page.tsx              (criar)                                                    [11]
src/app/(app)/conta/page.tsx                  (criar)                                                    [11]
src/app/(auth)/layout.tsx                     (criar)  layout centrado sem shell                         [9]
src/app/(auth)/entrar/page.tsx                (criar)                                                    [10]
src/app/(auth)/convite/[token]/page.tsx       (criar)                                                    [9]
src/app/(auth)/convite/[token]/actions.ts     (criar)  armInvite                                         [9]
src/components/ui/*                           (criar via shadcn add) + ajustes P3 em button/input/sidebar; textos pt-BR em sheet/sidebar [3, 8]
src/components/app-shell/navItems.ts          (criar)                                                    [8]
src/components/app-shell/AppSidebar.tsx       (criar)                                                    [8]
src/components/app-shell/AuthedSidebar.tsx    (criar)  folha async com a sessão                          [8]
src/components/app-shell/SidebarSkeleton.tsx  (criar)                                                    [8]
src/components/app-shell/MenuToggle.tsx       (criar)  SidebarTrigger com tooltip                        [8]
src/components/app-shell/Greeting.tsx         (criar)                                                    [8]
src/components/app-shell/AdminOverview.tsx    (criar)                                                    [8]
src/components/auth/authFormError.ts          (criar)  authFormError, errorCodeOf                        [9]
src/components/auth/passkeyErrorCode.ts       (criar)  traduz códigos do WebAuthn (T14)                  [9]
src/components/auth/passkeyDate.ts            (criar)                                                    [11]
src/components/auth/SocialButtons.tsx         (criar)                                                    [9]
src/components/auth/InviteUnavailable.tsx     (criar)                                                    [9]
src/components/auth/InviteSignup.tsx          (criar)                                                    [9]
src/components/auth/SignInPanel.tsx           (criar)                                                    [10]
src/components/auth/PasskeyOffer.tsx          (criar)                                                    [11]
src/components/auth/PasskeyManager.tsx        (criar)                                                    [11]
src/components/auth/SignOutButton.tsx         (criar)                                                    [11]
```

Os números entre colchetes são as tarefas que criam ou mudam o arquivo. Arquivos de teste (`*.test.ts[x]`) ficam ao lado do código e aparecem na lista **Files** de cada tarefa.

---

## Contrato de interfaces

Toda tarefa usa **exatamente** estes nomes e assinaturas. Uma tarefa que precise de algo fora daqui o declara no bloco **Interfaces → Produces** dela.

### Dependências (versões fixadas)

- Runtime: `better-auth@1.7.27`, `@better-auth/passkey@1.7.27`, `@better-auth/core@1.7.27` (peer do passkey), `zod@^4`, `sonner` e `next-themes` (trazidos pelo `shadcn add`).
- Dev: `vitest@^5.1.1`, `jsdom@^28` (o 31 não sobe no Node 22.12; T15), `@testing-library/react@^16.3.3`, `@testing-library/dom@^10.4.2`, `@testing-library/user-event@^14.6.13`, `@testing-library/jest-dom@^8.0.0`, `@electric-sql/pglite@^0.5.17`, `@electric-sql/pglite-socket@^0.2.20`, `@playwright/test@^1.65.1`, `@types/node@^22`.

### `src/lib/roles.ts`
```ts
export const ROLES = ["admin", "operator"] as const;
export type Role = (typeof ROLES)[number];
export function isRole(value: unknown): value is Role;
```

### `src/db/types.ts`
```ts
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";
export type Schema = typeof schema;
export type Db = PgDatabase<PgQueryResultHKT, Schema>; // NodePgDatabase<Schema> e PgliteDatabase<Schema> são atribuíveis (T2)
```
`package.json` tem `"type": "module"` (T15).

### `src/db/client.ts` (sem `server-only`)
```ts
export function createPool(connectionString: string): Pool; // max 10, enableChannelBinding true
export function createDb(pool: Pool): NodePgDatabase<Schema>;
```
`src/db/index.ts` mantém o singleton (globalThis em dev, `attachDatabasePool`) e exporta `db` e `pool`.

### Schema (`src/db/schema/*`, reexportado por `src/db/schema/index.ts`)
- `sector`: `id uuid pk defaultRandom`, `name text not null unique`, `active boolean not null default true`, `created_at timestamptz not null default now`.
- `user`, `session`, `account`, `verification`, `passkey`, `rateLimit` (tabela `rate_limit`): cópia fiel da saída da CLI `auth generate` 1.7.27 (ver T3), com estas diferenças em `user`: `sectorId: uuid("sector_id").references(() => sector.id, { onDelete: "restrict" })`, índice `user_sector_id_idx`, e `check("user_operator_needs_sector", sql\`${t.role} = 'admin' or ${t.sectorId} is not null\`)`. Chaves TS exatamente como a CLI gera (inclusive `credentialID` em `passkey`).
- `invite`: `id uuid pk defaultRandom`, `tokenHash text not null unique`, `role text enum ROLES not null`, `sectorId uuid FK sector restrict`, `inviteeLabel text`, `invitedBy text FK user set null`, `expiresAt timestamptz not null`, `usedAt timestamptz`, `usedBy text FK user set null`, `cancelledAt timestamptz`, `createdAt timestamptz not null default now`; índices em `sector_id`, `invited_by`, `used_by`; `check("invite_operator_needs_sector", …)`.

### `src/features/invites/token.ts`
```ts
export const INVITE_TOKEN_PATTERN: RegExp; // /^[A-Za-z0-9_-]{43}$/
export function generateInviteToken(): { token: string; tokenHash: string }; // 32 bytes base64url
export function hashInviteToken(token: string): string; // sha256 hex
export function isWellFormedInviteToken(value: unknown): value is string;
```

### `src/features/invites/inviteState.ts`
```ts
export const INVITE_TTL_MS: number; // 7 dias
export type InviteState = "valid" | "expired" | "used" | "cancelled";
export function inviteState(
  row: { expiresAt: Date; usedAt: Date | null; cancelledAt: Date | null },
  now: Date,
): InviteState; // ordem: cancelled > used > expired > valid
```

### `src/features/invites/inviteQueries.ts`
```ts
export type CreateInviteInput = {
  role: Role;
  sectorId: string | null; // obrigatório para operator (lança Error se faltar)
  inviteeLabel: string | null;
  invitedBy: string | null; // null = script admin:invite
  now: Date;
};
export async function createInvite(db: Db, input: CreateInviteInput): Promise<{ id: string; token: string; expiresAt: Date }>;

export type InviteDetails = {
  state: InviteState;
  role: Role;
  sectorName: string | null;
  inviterName: string | null;
  inviteeLabel: string | null;
  expiresAt: Date;
};
export async function findInviteByToken(db: Db, token: string, now: Date): Promise<InviteDetails | null>; // null = malformado ou inexistente

export async function consumeInvite(db: Db, token: string, now: Date): Promise<{ role: Role; sectorId: string | null } | null>;
// UPDATE invite SET used_at = now WHERE token_hash = hash(token) AND used_at IS NULL AND cancelled_at IS NULL AND expires_at > now RETURNING role, sector_id

export async function recordInviteUser(db: Db, token: string, userId: string): Promise<void>;
// UPDATE invite SET used_by = userId WHERE token_hash = hash(token) AND used_by IS NULL
```

### `src/features/invites/inviteUrl.ts`
```ts
export function buildInviteUrl(baseURL: string, token: string): string; // `${origin}/convite/${token}`, sem barra dupla
export function isHttpUrl(value: string): boolean; // só http: e https: ("localhost:3000" sem esquema é recusado)
```

### `src/features/invites/adminInvite.ts` (lógica do script `admin:invite`, Tarefa 5)
Valida a base com `isHttpUrl` **antes** de gravar o convite; o script `scripts/adminInvite.ts` só lê argumentos e env e chama esta função.

### `src/features/authz/authz.ts` (puro)
```ts
export type Authz = { userId: string; name: string; email: string; role: Role; sectorId: string | null };
export type SessionUserLike = {
  id: string; name: string; email: string;
  role?: unknown; sectorId?: unknown; deactivatedAt?: unknown;
};
export function toAuthz(user: SessionUserLike | null | undefined): Authz | null;
// null se: ausente, deactivatedAt preenchido, role desconhecido, ou operator sem sectorId
// admin sempre sai com sectorId null (vê todos os setores; spec §4.1)
export function isAdmin(authz: Authz): boolean;
export function canAccessSector(authz: Authz, sectorId: string): boolean; // admin: true; operator: igual ao próprio
```

### `src/features/authz/sectorScope.ts`
```ts
export function scopeToSector(authz: Authz, column: PgColumn): SQL | undefined; // admin: undefined; operator: eq(column, authz.sectorId)
// operator com sectorId null (impossível via toAuthz) devolve sql`false`, nunca undefined: nunca vira "vê tudo"
```

### `src/features/authz/proxyRules.ts` (puro)
```ts
export const PUBLIC_PATH_PREFIXES: readonly string[]; // ["/entrar", "/convite"]
export function isPublicPath(pathname: string): boolean;
export function shouldRedirectToSignIn(pathname: string, hasSessionCookie: boolean): boolean;
// /api e /api/* nunca redirecionam (route handlers respondem 401/403 por conta própria)
```
O `matcher` de `src/proxy.ts` também exclui `api` com `api(?:/|$)`, para não excluir uma página como `/apiary`.

### `src/lib/auth/env.ts` (puro, Zod 4)
```ts
export type SocialProvider = "google" | "facebook";
export type AuthEnv = {
  secret: string;   // BETTER_AUTH_SECRET, mínimo 32 caracteres
  baseURL: string;  // BETTER_AUTH_URL, só http(s); normalizada para a origem (new URL(x).origin), caminho descartado
  google: { clientId: string; clientSecret: string } | null;   // GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (os dois ou nenhum)
  facebook: { clientId: string; clientSecret: string } | null; // FACEBOOK_CLIENT_ID + FACEBOOK_CLIENT_SECRET
};
export function parseAuthEnv(env: Record<string, string | undefined>): AuthEnv; // lança Error em pt-BR listando o que falta
export function enabledSocialProviders(env: AuthEnv): SocialProvider[];
```

### `src/lib/auth/inviteCookie.ts`
```ts
export const INVITE_COOKIE = "closery_invite";
export const INVITE_COOKIE_MAX_AGE_SECONDS = 3600;
export function inviteCookieOptions(isProduction: boolean): {
  httpOnly: true; sameSite: "lax"; secure: boolean; path: "/"; maxAge: number;
};
```

### `src/lib/auth/errors.ts` (puro)
```ts
export const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>>; // ver "Textos de interface"
export const FALLBACK_AUTH_ERROR: string;
export function authErrorMessage(code: string | null | undefined): string; // nunca devolve texto cru do servidor
```

### `src/lib/auth/createAuth.ts` (sem `server-only`)
```ts
export function createAuth(db: Db, env: AuthEnv); // retorno INFERIDO (ver Tarefa 6): anotar ReturnType<typeof betterAuth> não compila e apaga role/sectorId do tipo do cliente
export type Auth = ReturnType<typeof createAuth>;
export const AUTH_USER_ADDITIONAL_FIELDS: { role: …; sectorId: …; deactivatedAt: … }; // usados também pelo teste guarda
```
Erros lançados nos hooks: `APIError("FORBIDDEN", { message, code: "SIGNUP_INVITE_ONLY" })` e `APIError("FORBIDDEN", { message, code: "ACCOUNT_DEACTIVATED" })`.
Também: `account.accountLinking.disableImplicitLinking: true` (T13) e rate limit ligado só em produção, `storage: "database"`, com `customRules` `/sign-in/email` 30 por 60 s e `/sign-up/email` 10 por 60 s, por IP. Os demais `/sign-in*` e `/sign-up*` (social) seguem o padrão do Better Auth, 3 por 10 s; os endpoints de passkey ficam em `/passkey/*` e caem no padrão geral de 100 por 10 s. A janela conta a partir da **última** requisição permitida. IP: sem `trustedProxies`, o Better Auth só confia em `x-forwarded-for` quando ele tem um único valor; com vários valores todos caem num balde compartilhado por caminho (`no-trusted-ip|<path>`); na Vercel o cabeçalho tem um valor só. No bloqueio (429) a tela mostra `Muitas tentativas nesta rede. Espere um minuto e tente de novo.`

### `src/lib/auth/index.ts` (`server-only`)
```ts
export const auth: Auth; // createAuth(db, parseAuthEnv(process.env))
export const authEnv: AuthEnv;
```

### `src/lib/auth/client.ts` (`"use client"`)
```ts
export const authClient; // createAuthClient({ plugins: [inferAdditionalFields<Auth>(), passkeyClient()] }) de "better-auth/react"
```

### `src/lib/auth/session.ts` (`server-only`)
```ts
export const getAuthz: () => Promise<Authz | null>; // React cache(); auth.api.getSession({ headers: await headers() }) → toAuthz
export async function requireUser(): Promise<Authz>;  // redirect("/entrar") se null
export async function requireAdmin(): Promise<Authz>; // requireUser + notFound() se não admin
```

### `src/app/(auth)/convite/[token]/actions.ts` (`"use server"`)
```ts
export async function armInvite(token: string): Promise<{ ok: true } | { ok: false; message: string }>;
// revalida formato + estado "valid" e grava o cookie closery_invite; nunca consome
// message = motivo + " Peça um novo convite a quem te convidou." (ex.: "Este convite expirou. Peça um novo convite a quem te convidou.")
```

### `src/components/auth/authFormError.ts` e `passkeyErrorCode.ts` (Tarefa 9; usados pelas Tarefas 10 e 11)
```ts
export type AuthFormError = { message: string; field: "email" | "password" | null };
export function authFormError(code: string | null | undefined): AuthFormError; // message vem do mapa, nunca texto cru
export function errorCodeOf(error: object): string | null; // lê error.code de respostas do authClient
export function passkeyErrorCode(code: string | null, ceremony: "register" | "authenticate"): string | null;
// ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED → PREVIOUSLY_REGISTERED
// ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY | ERROR_CEREMONY_ABORTED → REGISTRATION_CANCELLED (register) / AUTH_CANCELLED (authenticate)
// qualquer outro código passa sem mudança
```

### Helpers de teste
```ts
// test/db.ts
export type TestDb = PgliteDatabase<Schema>;
export const TABLES: readonly string[]; // todas as tabelas, em qualquer ordem
export async function createTestDb(): Promise<{ client: PGlite; db: TestDb }>;
export async function resetDb(client: PGlite): Promise<void>; // DELETE com session_replication_role = replica

// test/fixtures.ts
export async function insertSector(db: Db, name?: string): Promise<{ id: string; name: string }>;
export async function insertUser(db: Db, input: { role: Role; sectorId: string | null; name?: string; email?: string; deactivatedAt?: Date | null }): Promise<{ id: string }>;
export async function insertInvite(db: Db, input: Partial<CreateInviteInput> & { usedAt?: Date | null; cancelledAt?: Date | null; expiresAt?: Date }): Promise<{ id: string; token: string }>;

// test/auth.ts
export const TEST_AUTH_ENV: AuthEnv; // secret de 32+ chars fixo, baseURL "http://localhost:3000", sem social
export function createTestAuth(db: Db, env?: Partial<AuthEnv>): Auth;
export async function signUpWithInvite(auth: Auth, token: string | null, input: { name: string; email: string; password: string }): Promise<unknown>;
export function sessionCookieOf(headers: Headers): string; // monta o header cookie a partir de set-cookie

// e2e/db.ts (só o E2E usa; detalhes na Tarefa 12)
export async function deactivateUserByEmail(db: Db, email: string, now?: Date): Promise<void>;
```

### Portas, rotas e nomes fixos
- Dev: `http://localhost:3000`. E2E: app em `http://localhost:3200`, banco `postgres://postgres:postgres@127.0.0.1:54329/postgres`.
- Cookie de sessão do Better Auth: ler com `getSessionCookie(request)` de `better-auth/cookies` (cuida do prefixo `__Secure-`).
- Rotas públicas: `/entrar`, `/convite/[token]`, `/api/auth/*`, `/api/health`. Todo o resto exige sessão.

---

## Textos de interface (exatos — testes e E2E dependem deles)

**Navegação (sidebar):** `Início` (`/`) · `Conta` (`/conta`) · `Administração` (`/admin`, só admin).

**`/entrar`:** título `Entrar no Closery` · rótulos `E-mail`, `Senha` · botão `Entrar` · botão `Entrar com passkey` · botões `Continuar com Google` / `Continuar com Facebook` (só se habilitados) · rodapé `O acesso é só por convite.`

**`/convite/[token]` válido:** título `Você foi convidado` · frase `{quem convidou} te convidou para o setor {setor} como {papel}.` (admin: `… te convidou como Administrador.`; script sem convidante: `Você foi convidado como Administrador.`, `Você foi convidado para o setor {setor} como Operador.` e, sem nome de setor, `Você foi convidado como Operador.`) · papéis `Administrador`, `Operador` · rótulos `Nome`, `E-mail`, `Senha` · botão `Criar conta` · botões sociais `Continuar com Google` / `Continuar com Facebook`.
**Estados inválidos (título `Convite indisponível`):** `expired` → `Este convite expirou.` · `used` → `Este convite já foi usado.` · `cancelled` → `Este convite foi cancelado.` · inexistente/malformado → `Convite não encontrado.` · sempre seguido de `Peça um novo convite a quem te convidou.`, `Já tem conta?` e o link com cara de botão `Entrar` (vai para `/entrar`). No cadastro, `USER_ALREADY_EXISTS*` mostra o mesmo link `Entrar` abaixo da mensagem

**`/bem-vindo`:** título `Conta criada` · texto `Quer entrar mais rápido da próxima vez? Crie uma passkey: você entra com a digital, o rosto ou o PIN do aparelho.` · botão `Criar passkey` e link com cara de botão `Agora não` (vai para `/`) · sucesso: toast `Passkey criada.` e vai para `/`.

**`/conta`:** título `Conta` · seção `Passkeys` · vazio `Nenhuma passkey ainda.` · botão `Criar passkey` · por item, botão ícone com `aria-label` e tooltip `Remover passkey` · toasts `Passkey criada.` / `Passkey removida.` · botão `Sair`.

**Início (`/`):** título `Olá, {primeiro nome}` · texto `Em breve: passagem de turno, solicitações e dashboard.`

**`/admin`:** título `Administração` · texto `Setores, turnos, itens, destinos e equipe chegam na próxima etapa.`

**`not-found`:** título `Página não encontrada` · link `Voltar ao início`.
**`error`:** título `Algo deu errado` · botão `Tentar de novo`.

**Mensagens de erro (`AUTH_ERROR_MESSAGES`):**
| Código | Mensagem |
|---|---|
| `SIGNUP_INVITE_ONLY` | `O cadastro é só por convite. Abra de novo o link que você recebeu.` |
| `signup_disabled` | `Conta não encontrada. Peça um convite.` |
| `ACCOUNT_DEACTIVATED` | `Esta conta foi desativada. Fale com o administrador.` |
| `USER_ALREADY_EXISTS` | `Já existe uma conta com este e-mail. Entre por "Entrar".` |
| `USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL` | `Já existe uma conta com este e-mail. Entre por "Entrar".` |
| `INVALID_EMAIL_OR_PASSWORD` | `E-mail ou senha incorretos.` |
| `INVALID_EMAIL` | `Informe um e-mail válido.` |
| `PASSWORD_TOO_SHORT` | `A senha precisa ter pelo menos 8 caracteres.` |
| `PASSWORD_TOO_LONG` | `A senha pode ter no máximo 128 caracteres.` |
| `email_not_found` | `Essa conta não informou um e-mail. Use outro jeito de entrar.` |
| `account_not_linked` | `Esse e-mail já tem conta com outro jeito de entrar. Entre como da primeira vez.` |
| `unable_to_create_user` | `Não foi possível criar a conta. Tente de novo.` |
| `access_denied` | `Você cancelou o acesso. Tente de novo quando quiser.` |
| `SESSION_NOT_FRESH` | `Por segurança, entre de novo antes de criar uma passkey.` |
| `AUTH_CANCELLED` | `Login com passkey cancelado.` |
| `REGISTRATION_CANCELLED` | `Criação da passkey cancelada.` |
| `PREVIOUSLY_REGISTERED` | `Esta passkey já está cadastrada.` |
| `AUTHENTICATION_FAILED` | `Não foi possível entrar com a passkey.` |
| `PASSKEY_NOT_FOUND` | `Passkey não encontrada.` |
| `RATE_LIMITED` | `Muitas tentativas nesta rede. Espere um minuto e tente de novo.` (código só do cliente: `errorCodeOf` o deduz de `status === 429`) |
| *(fallback)* | `Não foi possível concluir. Tente de novo.` |

Os códigos crus do WebAuthn (`ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`, `ERROR_CEREMONY_ABORTED`, `ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED`) **não** entram neste mapa: `passkeyErrorCode` os traduz para `AUTH_CANCELLED`, `REGISTRATION_CANCELLED` e `PREVIOUSLY_REGISTERED` antes de `authFormError` (T14).

---

## Tarefas

| # | Tarefa | Depende de |
|---|---|---|
| 1 | Harness de testes (Vitest node + dom, PGlite, `Db`, `client.ts`, tabela `sector` + migração 0000) | — |
| 2 | Tokens D16 + guarda de paleta (P4, P9) | 1 |
| 3 | Primitivos shadcn da Fase 1 + alvos de toque (P3) | 1 |
| 4 | Schema de auth e convites + domínio de convites | 1 |
| 5 | Script `admin:invite` | 4 |
| 6 | Better Auth: `createAuth`, hooks do convite, route handler, cliente, mensagens | 4 |
| 7 | Autorização: `Authz`, escopo por setor, sessão no servidor, `proxy.ts` | 6 |
| 8 | Shell autenticado, Início, `/admin`, `error`/`not-found`, metadata | 3, 7 |
| 9 | `/convite/[token]` + `armInvite` | 6, 8 |
| 10 | `/entrar` (e-mail, social, passkey com autofill) | 6, 8, 9 |
| 11 | `/bem-vindo` e `/conta` (passkeys, sair) | 6, 8, 9 |
| 12 | E2E com Playwright + `pglite-socket` | 5, 9, 10, 11 |
| 13 | Documentação de contexto e verificação final | 1–12 |

<!-- As tarefas detalhadas entram abaixo. -->

### Task 1: Harness de testes (Vitest node + dom, PGlite, `Db`, `client.ts`, tabela `sector` + migração 0000)

**Files:**
- Create: `vitest.config.ts`
- Create: `test/empty.ts`
- Create: `test/setup-dom.ts`
- Create: `test/global-setup.ts`
- Create: `test/db.ts`
- Create: `test/db.test.ts`
- Create: `src/db/types.ts`
- Create: `src/db/client.ts`
- Create: `src/db/schema/index.ts`
- Create: `src/db/schema/sectors.ts`
- Create: `drizzle/0000_<nome-gerado>.sql` (gerado por `bun run db:generate`; o nome muda a cada geração) e `drizzle/meta/0000_snapshot.json`
- Create: `.gitattributes`
- Modify: `package.json` (devDependencies, `"type": "module"`, scripts `test`, `test:watch` e `check-types`, `engines`)
- Modify: `src/db/index.ts` (passa a usar `client.ts`; mantém `globalThis`, `attachDatabasePool` e a mensagem de erro)
- Modify: `drizzle.config.ts` (linha `schema:`)
- Modify: `drizzle/meta/_journal.json` (gerado)
- Delete: `src/db/schema.ts` (vira a pasta `src/db/schema/`)
- Test: `src/db/databaseUrl.test.ts`
- Test: `src/db/schema/sectors.test.ts`
- Test: `src/components/ui/button.test.tsx`
- Test: `test/db.test.ts`

**Interfaces:**
- Consumes: `resolveDatabaseUrls(env: Record<string, string | undefined>): { runtime: string | undefined; migration: string | undefined }` de `src/db/databaseUrl.ts` (já existe, não muda); `Button` de `src/components/ui/button.tsx` (já existe).
- Produces:
  - `src/db/types.ts`: `export type Schema = typeof schema; export type Db = PgDatabase<PgQueryResultHKT, Schema>;` (T2)
  - `src/db/client.ts`: `createPool(connectionString: string): Pool` e `createDb(pool: Pool): NodePgDatabase<Schema>` (sem `server-only`)
  - `src/db/index.ts`: continua exportando `db` e agora também `pool`
  - `src/db/schema/index.ts` (reexporta `sectors.ts`) e `src/db/schema/sectors.ts`: `export const sector` (`id uuid pk defaultRandom`, `name text not null unique`, `active boolean not null default true`, `createdAt` -> coluna `created_at timestamptz not null default now`)
  - `test/db.ts`: `type TestDb = PgliteDatabase<Schema>`, `const TABLES: readonly string[]`, `createTestDb(): Promise<{ client: PGlite; db: TestDb }>`, `resetDb(client: PGlite): Promise<void>`
  - Scripts: `bun run test` (= `vitest run`), `bun run test:watch`. Projeto `node` (`src/**/*.test.ts`, `test/**/*.test.ts`) e projeto `dom` (`src/**/*.test.tsx`, jsdom).
  - **Regra para as tarefas seguintes:** toda tabela nova entra em `TABLES` de `test/db.ts` na mesma tarefa; `test/db.test.ts` reprova se a lista divergir de `pg_tables`.

- [ ] **Step 1: Instalar as dependências de desenvolvimento**

Run:
```bash
bun add -d vitest@^5.1.1 jsdom@^28 @testing-library/react@^16.3.3 @testing-library/dom@^10.4.2 @testing-library/user-event@^14.6.13 @testing-library/jest-dom@^8.0.0 @electric-sql/pglite@^0.5.17 @types/node@^22
```
Expected: `installed vitest@5.1.1`, `installed jsdom@28.x`, `installed @electric-sql/pglite@0.5.17`, `installed @types/node@22.x` e `Saved lockfile`.

Por que `jsdom@^28` (T15): o jsdom 31 exige Node `^22.22.2 || ^24.15.0` e quebra em Node 22.12 (a máquina e o `engines` do plano) com `TypeError: Cannot read properties of undefined (reading 'bind')` em `undici/lib/interceptor/decompress.js`. O jsdom 28 aceita `^22.12.0` e funciona com Vitest 5 (peer `jsdom: *`).

- [ ] **Step 2: Ajustar o `package.json` (módulo ESM, scripts, engines)**

Em `package.json`:
1. logo depois de `"private": true,` acrescente `"type": "module",` (sem isso o Vitest/Vite avisa a cada execução que `vitest.config.ts` é ESM carregado como CommonJS; `next build` continua passando, verificado);
2. em `"scripts"`, depois de `"db:studio": "drizzle-kit studio"`, troque o fim por:
```json
    "db:studio": "drizzle-kit studio",
    "test": "vitest run",
    "test:watch": "vitest"
```
3. logo depois de `"packageManager": "bun@1.3.3",` acrescente:
```json
  "engines": {
    "node": ">=22.12"
  },
```
4. troque `"check-types": "tsc --noEmit"` por:
```json
    "check-types": "next typegen && tsc --noEmit",
```
(os tipos globais `LayoutProps`/`PageProps` vêm de `.next/types`, que não existe em checkout limpo e fica obsoleto quando uma página some; o `next typegen` regenera antes de cada checagem — T17).

Crie também `.gitattributes` na raiz (o Git desta máquina tem `core.autocrlf=true`; sem isto, um checkout ou worktree novo sai em CRLF e o Biome reprova ~11 arquivos):
```
* text=auto eol=lf
*.ico binary
*.png binary
```

Run: `bun run check-types && git add --renormalize . && git status --short`
Expected: `check-types` sem erro; o `git status` só mostra `package.json`, `bun.lock` e `.gitattributes` (o repositório já está em LF, então a renormalização não muda nada).

- [ ] **Step 3: Criar a configuração do Vitest e os arquivos de apoio**

`vitest.config.ts`:
```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Substitui o pacote "server-only" (que lança fora do Next). Caminho absoluto
// via fileURLToPath: URL.pathname gera "/C:/..." no Windows.
const empty = fileURLToPath(new URL("./test/empty.ts", import.meta.url));

export default defineConfig({
  // Resolve "@/*" do tsconfig.json nativamente (Vite 8); sem plugin.
  resolve: { tsconfigPaths: true },
  test: {
    exclude: ["e2e/**", ".claude/**", "node_modules/**"],
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts", "test/**/*.test.ts"],
          globalSetup: ["./test/global-setup.ts"],
          alias: { "server-only": empty },
          testTimeout: 15_000,
          hookTimeout: 30_000,
        },
      },
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./test/setup-dom.ts"],
          alias: { "server-only": empty },
        },
      },
    ],
  },
});
```

`test/empty.ts`:
```ts
export {};
```

`test/setup-dom.ts`:
```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Sem `globals: true` o Testing Library não registra o cleanup sozinho.
afterEach(() => {
  cleanup();
});

// jsdom não implementa window.matchMedia; o useIsMobile do shadcn (SidebarProvider)
// chama no efeito. Desktop por padrão (matches: false).
if (typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string): MediaQueryList => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
```

`test/global-setup.ts`:
```ts
import { mkdirSync, readdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const MIGRATIONS_FOLDER = "./drizzle";
export const DUMP_PATH = "node_modules/.cache/closery-test/migrated.tar";

// Migra ./drizzle uma única vez por execução e grava o dump do banco pronto.
// Cada arquivo de teste carrega o dump (~1,4 s) em vez de migrar do zero
// (3–6 s). O dump é regenerado sempre, então nunca serve schema velho.
export default async function setup() {
  const hasMigrations = readdirSync(MIGRATIONS_FOLDER).some((file) =>
    file.endsWith(".sql"),
  );
  if (!hasMigrations) {
    throw new Error(
      `Nenhuma migração .sql em ${MIGRATIONS_FOLDER}: rode "bun run db:generate" antes de "bun run test".`,
    );
  }

  const client = new PGlite();
  await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
  const dump = await client.dumpDataDir("none");
  await client.close();

  mkdirSync(dirname(DUMP_PATH), { recursive: true });
  await writeFile(DUMP_PATH, Buffer.from(await dump.arrayBuffer()));
}
```

- [ ] **Step 4: Write the failing test (helper de banco, guarda de TABLES e testes)**

`test/db.ts` (o helper importa o schema, que ainda não existe: faz parte do vermelho):
```ts
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import * as schema from "@/db/schema";
import type { Schema } from "@/db/types";

const DUMP_PATH = "node_modules/.cache/closery-test/migrated.tar";

export type TestDb = PgliteDatabase<Schema>;

// Todas as tabelas do schema "public". test/db.test.ts garante que esta lista
// bate com o banco migrado: tabela nova sem entrada aqui reprova o teste.
export const TABLES: readonly string[] = ["sector"];

// O dump migrado é lido uma vez por processo de worker.
let dump: Blob | undefined;

export async function createTestDb(): Promise<{
  client: PGlite;
  db: TestDb;
}> {
  dump ??= new Blob([readFileSync(DUMP_PATH)]);
  const client = new PGlite({ loadDataDir: dump });
  const db = drizzle(client, { schema });
  await client.waitReady;
  return { client, db };
}

// Limpa os dados sem se preocupar com a ordem das FKs: em modo "replica" o
// Postgres não dispara os gatilhos de FK, então DELETE vale em qualquer ordem.
export async function resetDb(client: PGlite): Promise<void> {
  await client.exec("SET session_replication_role = replica");
  try {
    for (const table of TABLES) {
      await client.exec(`DELETE FROM "${table}"`);
    }
  } finally {
    await client.exec("SET session_replication_role = DEFAULT");
  }
}
```

`test/db.test.ts`:
```ts
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestDb, resetDb, TABLES } from "./db";

describe("harness de banco", () => {
  let client: PGlite;

  beforeAll(async () => {
    ({ client } = await createTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  it("TABLES lista exatamente as tabelas do schema public", async () => {
    const { rows } = await client.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public'",
    );
    const actual = rows.map((row) => row.tablename).sort();
    expect([...TABLES].sort()).toEqual(actual);
  });

  it("resetDb apaga os dados de todas as tabelas", async () => {
    await client.exec("INSERT INTO sector (name) VALUES ('ULD')");
    await resetDb(client);
    const { rows } = await client.query("SELECT 1 FROM sector");
    expect(rows).toHaveLength(0);
  });
});
```

`src/db/databaseUrl.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import { resolveDatabaseUrls } from "./databaseUrl";

describe("resolveDatabaseUrls", () => {
  it("convenção A: DATABASE_URL direta + DATABASE_URL_POOLED", () => {
    expect(
      resolveDatabaseUrls({
        DATABASE_URL: "postgres://direta",
        DATABASE_URL_POOLED: "postgres://pooler",
      }),
    ).toEqual({ runtime: "postgres://pooler", migration: "postgres://direta" });
  });

  it("convenção B (neon env pull): DATABASE_URL pooler + DATABASE_URL_UNPOOLED", () => {
    expect(
      resolveDatabaseUrls({
        DATABASE_URL: "postgres://pooler",
        DATABASE_URL_UNPOOLED: "postgres://direta",
      }),
    ).toEqual({ runtime: "postgres://pooler", migration: "postgres://direta" });
  });

  it("só DATABASE_URL: usa a mesma para runtime e migração", () => {
    expect(resolveDatabaseUrls({ DATABASE_URL: "postgres://unica" })).toEqual({
      runtime: "postgres://unica",
      migration: "postgres://unica",
    });
  });

  it("a variável com sufixo vence o DATABASE_URL genérico", () => {
    const urls = resolveDatabaseUrls({
      DATABASE_URL: "postgres://generica",
      DATABASE_URL_POOLED: "postgres://pooler",
      DATABASE_URL_UNPOOLED: "postgres://direta",
    });
    expect(urls.runtime).toBe("postgres://pooler");
    expect(urls.migration).toBe("postgres://direta");
  });

  it("ausência total: ambos undefined", () => {
    expect(resolveDatabaseUrls({})).toEqual({
      runtime: undefined,
      migration: undefined,
    });
  });

  it("só as variáveis com sufixo: cada uma cobre o seu uso", () => {
    expect(
      resolveDatabaseUrls({ DATABASE_URL_POOLED: "postgres://pooler" }),
    ).toEqual({ runtime: "postgres://pooler", migration: undefined });
    expect(
      resolveDatabaseUrls({ DATABASE_URL_UNPOOLED: "postgres://direta" }),
    ).toEqual({ runtime: undefined, migration: "postgres://direta" });
  });
});
```

`src/db/schema/sectors.test.ts`:
```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { sector } from "./sectors";

// Código SQLSTATE do erro. O driver do PGlite o expõe em `code`; o drizzle
// 0.45 pode embrulhar o erro original em `cause`, então olhamos os dois.
function sqlState(error: unknown): string | undefined {
  const candidates = [error, error instanceof Error ? error.cause : undefined];
  for (const candidate of candidates) {
    if (
      typeof candidate === "object" &&
      candidate !== null &&
      "code" in candidate &&
      typeof candidate.code === "string"
    ) {
      return candidate.code;
    }
  }
  return undefined;
}

describe("tabela sector", () => {
  let client: PGlite;
  let db: TestDb;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    await resetDb(client);
  });

  it("insere e lê com id gerado, active=true e createdAt preenchido", async () => {
    const [inserted] = await db
      .insert(sector)
      .values({ name: "ULD" })
      .returning();
    expect(inserted?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(inserted?.active).toBe(true);
    expect(inserted?.createdAt).toBeInstanceOf(Date);

    const rows = await db.select().from(sector).where(eq(sector.name, "ULD"));
    expect(rows).toHaveLength(1);
  });

  it("recusa nome repetido com o código 23505 (unique)", async () => {
    await db.insert(sector).values({ name: "ULD" });
    const attempt = await db
      .insert(sector)
      .values({ name: "ULD" })
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(sqlState(attempt)).toBe("23505");
  });

  it("recusa nome nulo", async () => {
    const attempt = await client
      .query("INSERT INTO sector (name) VALUES (NULL)")
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(sqlState(attempt)).toBe("23502");
  });

  it("transação que lança é revertida por inteiro", async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.insert(sector).values({ name: "Revertido" });
        throw new Error("falha interna");
      }),
    ).rejects.toThrow("falha interna");

    const rows = await db.select().from(sector);
    expect(rows).toEqual([]);
  });

  it("transação bem-sucedida confirma os dados", async () => {
    await db.transaction(async (tx) => {
      await tx.insert(sector).values({ name: "Confirmado" });
    });
    const rows = await db.select().from(sector);
    expect(rows.map((row) => row.name)).toEqual(["Confirmado"]);
  });
});
```

`src/components/ui/button.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renderiza o rótulo como botão acessível", () => {
    render(<Button>Entregar turno</Button>);
    expect(
      screen.getByRole("button", { name: "Entregar turno" }),
    ).toBeInTheDocument();
  });

  it("dispara onClick ao clicar", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Salvar</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("desabilitado não dispara onClick", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Salvar
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `bun run test`
Expected: FAIL com `Error: Nenhuma migração .sql em ./drizzle: rode "bun run db:generate" antes de "bun run test".` (o `globalSetup` aborta a execução; ainda não há schema nem migração).

- [ ] **Step 6: Write minimal implementation (tipos, cliente, schema, `index.ts`, drizzle config)**

Apague o schema antigo: `git rm src/db/schema.ts`.

`src/db/schema/sectors.ts`:
```ts
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Setor da operação (primeiro: ULD). Operador pertence a um setor; admin vê todos.
export const sector = pgTable("sector", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
```

`src/db/schema/index.ts`:
```ts
// Schema do banco (Drizzle). Mudou aqui? bun run db:generate → revisar o SQL
// → bun run db:migrate.
export * from "./sectors";
```

`src/db/types.ts`:
```ts
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type * as schema from "./schema";

export type Schema = typeof schema;

// Domínio recebe `db: Db` por parâmetro: o app passa o Pool do Neon, os testes
// passam o PGlite, e o mesmo código roda nos dois. NodePgDatabase<Schema> e
// PgliteDatabase<Schema> são atribuíveis a este tipo; a união dos dois quebra
// `.returning({ ... })` (TS2554).
export type Db = PgDatabase<PgQueryResultHKT, Schema>;
```

`src/db/client.ts`:
```ts
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";
import type { Schema } from "./types";

// Sem `server-only`: scripts (admin:invite) e o E2E também montam o cliente.

export function createPool(connectionString: string): Pool {
  // enableChannelBinding: o pg ignora o `channel_binding=require` da URL; esta
  // opção é que liga o SCRAM-SHA-256-PLUS que o Neon oferece.
  return new Pool({ connectionString, max: 10, enableChannelBinding: true });
}

// node-postgres + Pool (D18): suporta db.transaction() interativa, exigida por
// entregar, corrigir e mudar status. Ver .context/library-docs.md §5.
export function createDb(pool: Pool): NodePgDatabase<Schema> {
  return drizzle({ client: pool, schema });
}
```

`src/db/index.ts` (substitui o arquivo inteiro):
```ts
import "server-only";

import { attachDatabasePool } from "@vercel/functions";
import type { Pool } from "pg";

import { createDb, createPool } from "./client";
import { resolveDatabaseUrls } from "./databaseUrl";

const { runtime: connectionString } = resolveDatabaseUrls(process.env);

if (!connectionString) {
  throw new Error(
    "DATABASE_URL ausente: copie .env.example para .env.local e preencha com as connection strings do Neon.",
  );
}

// Em dev, o HMR reavalia este módulo a cada edição; guardar o pool no
// globalThis evita abrir um pool novo (e vazar conexões) a cada recarga.
const globalForDb = globalThis as unknown as { closeryPool?: Pool };

function createAttachedPool(url: string): Pool {
  const created = createPool(url);
  // Vercel Fluid compute: libera conexões ociosas antes de a função suspender.
  // Fora da Vercel é inofensivo.
  attachDatabasePool(created);
  return created;
}

export const pool =
  globalForDb.closeryPool ?? createAttachedPool(connectionString);

if (process.env.NODE_ENV !== "production") {
  globalForDb.closeryPool = pool;
}

export const db = createDb(pool);
```

`drizzle.config.ts`: troque a linha `schema: "./src/db/schema.ts",` por:
```ts
  schema: "./src/db/schema/index.ts",
```

- [ ] **Step 7: Gerar a migração 0000 e conferir o SQL**

Run: `bun run db:generate`
Expected: `1 tables`, `sector 4 columns 0 indexes 0 fks` e `[✓] Your SQL migration file ➜ drizzle\0000_<nome-aleatório>.sql`. O nome muda a cada geração; nenhuma tarefa deve citar o nome do arquivo, só `0000_*.sql`.

Abra o `drizzle/0000_*.sql` e confirme que o conteúdo é exatamente este (se divergir, pare e revise o schema):
```sql
CREATE TABLE "sector" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sector_name_unique" UNIQUE("name")
);
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun run test`
Expected: PASS (4 arquivos, 16 testes: `databaseUrl` 6, `sectors` 5, `db` 2, `button` 3). Na primeira execução o `globalSetup` leva alguns segundos (initdb do PGlite em WASM) e grava `node_modules/.cache/closery-test/migrated.tar`.

- [ ] **Step 9: Aplicar a migração na branch de desenvolvimento do Neon**

Confirme que `.env.local` aponta para a branch **de dev** (as URLs de produção estão comentadas), depois:

Run: `bun run db:migrate`
Expected: o drizzle-kit conecta pela conexão direta (`DATABASE_URL` / `DATABASE_URL_UNPOOLED`) e termina com `[✓] migrations applied successfully!`. Rode uma segunda vez para provar a idempotência: a saída continua de sucesso, sem recriar a tabela.

- [ ] **Step 10: Verificação completa**

Run: `bun run check-types && bun run lint && bun run test`
Expected: os três verdes (`Checked N files ... No fixes applied.` no Biome; 16 testes passando). Se o `lint` reclamar de formatação, rode `bun run format` e repita.

- [ ] **Step 11: Commit**

```bash
git add .gitattributes package.json bun.lock vitest.config.ts test src/db src/components/ui/button.test.tsx drizzle drizzle.config.ts
git commit -F - <<'EOF'
feat(testes): harness Vitest com PGlite e tabela sector

Projetos node e dom, dump migrado do PGlite gerado uma vez por execução,
tipo Db compartilhado entre Neon e PGlite, client.ts sem server-only,
schema em pasta e migração 0000 com a tabela sector.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 2: Tokens D16 + guarda de paleta (P4, P9)

**Files:**
- Create: `src/app/chartPalette.test.ts`
- Modify: `src/app/globals.css` (três trechos: `@theme inline`, `:root`, `.dark`)
- Modify: `.context/ui-tokens.md` (§2: tokens passam a existir; guarda e medidas)
- Modify: `.context/pendencias.md` (P4 e P9 → Resolvido, seção 5, com Atualização datada)
- Test: `src/app/chartPalette.test.ts` (projeto `node`)

**Interfaces:**
- Consumes: o harness da Task 1 (`bun run test`, projeto `node` com `include: src/**/*.test.ts`). O teste só usa `node:fs`, `node:path` e `vitest`; não usa banco nem `@/`.
- Produces: tokens CSS `--chart-1..4`, `--success`, `--success-foreground`, `--warning`, `--warning-foreground`, `--info`, `--info-foreground` em `:root` e `.dark`, e as pontes `--color-success`, `--color-success-foreground`, `--color-warning`, `--color-warning-foreground`, `--color-info`, `--color-info-foreground` no `@theme inline`. Classes Tailwind resultantes: `bg-success text-success-foreground`, `bg-warning …`, `bg-info …`, `bg-chart-1..4`. O guarda `src/app/chartPalette.test.ts` reprova qualquer troca futura que desrespeite os pisos.

- [ ] **Step 1: Write the failing test**

`src/app/chartPalette.test.ts`:
```ts
/**
 * Guarda EXECUTÁVEL da paleta (pendências P4 e P9): lê `src/app/globals.css` e mede, nos dois
 * temas, (1) a série `--chart-1..4` e (2) os pares `success`/`warning`/`info` com o `-foreground`.
 *
 * Portado do `chartPaletteGuard.test.ts` do klauve. Os pisos são os de lá, medidos agora contra
 * as superfícies do shadcn neutral (P9). Ficou de fora o que é do klauve (severidade, status de
 * ocorrências, anel do chip, mídia) e a leitura de componentes de gráfico.
 *
 * Rodar: `bun run test -- src/app/chartPalette.test.ts`
 * (`VITEST_PRINT_PALETTE=1` imprime a matriz medida, para colar em `.context/ui-tokens.md`).
 *
 * Os tokens podem estar em hex (`#8d3e0f`) ou em `oklch(L C H)` (os neutros do shadcn). O CSS é
 * lido por regex, não por parser: se a folha ganhar nesting que quebre o corte, o teste falha
 * alto (fail-closed), que é o comportamento desejado.
 *
 * Piso nunca se afrouxa para a paleta passar: reprovou, ajuste o token.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Nº de cores da série. `chart-5` é o cinza de "Outros" e NÃO é série. */
const SERIES = 4;
/** Pisos: banda de lightness OKLCH, croma mínimo, contraste WCAG (não-texto) e ΔE2000. */
const L_BAND = [0.43, 0.77] as const;
const C_MIN = 0.06;
const CONTRAST_MIN = 3;
const DELTA_E_MIN = 15;
/** Texto normal (WCAG AA): vale para os pares `-foreground` de status. */
const TEXT_MIN = 4.5;

// ---------------------------------------------------------------- cor
/** sRGB codificado (gama aplicada), cada canal em 0..1. */
type Rgb = [number, number, number];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const toLin = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const toSrgb = (c: number) =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
const toLinRgb = (rgb: Rgb): Rgb => [
  toLin(rgb[0]),
  toLin(rgb[1]),
  toLin(rgb[2]),
];

const HEX = /^#([0-9a-fA-F]{6})$/;
const OKLCH =
  /^oklch\(\s*(-?[\d.]+)(%?)\s+(-?[\d.]+)\s+(-?[\d.]+)(?:deg)?\s*\)$/;

/** oklch → sRGB pela matriz de Ottosson; o que cai fora do gamut é recortado (clamp). */
function oklchToRgb(L: number, C: number, hueDegrees: number): Rgb {
  const h = (hueDegrees * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  return [toSrgb(clamp01(r)), toSrgb(clamp01(g)), toSrgb(clamp01(bl))];
}

/** Aceita `#rrggbb` e `oklch(L C H)`. Qualquer outra forma (inclusive com alfa) lança. */
function parseColor(value: string): Rgb {
  const text = value.trim();
  const hex = HEX.exec(text);
  if (hex?.[1]) {
    const digits = hex[1];
    const channel = (i: number) =>
      Number.parseInt(digits.slice(i, i + 2), 16) / 255;
    return [channel(0), channel(2), channel(4)];
  }
  const oklch = OKLCH.exec(text);
  if (oklch) {
    const lightness = Number(oklch[1]) / (oklch[2] === "%" ? 100 : 1);
    return oklchToRgb(lightness, Number(oklch[3]), Number(oklch[4]));
  }
  throw new Error(`cor não suportada pelo guarda: "${value}"`);
}

function relLuminance(rgb: Rgb) {
  const [r, g, b] = toLinRgb(rgb);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG entre duas cores. */
function contrast(a: Rgb, b: Rgb) {
  const [hi, lo] = [relLuminance(a), relLuminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

/** OKLab (Ottosson): daqui saem a lightness e o croma. */
function oklchOf(rgb: Rgb) {
  const [r, g, b] = toLinRgb(rgb);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B) };
}

/** Simulação de dicromacia: Viénot, Brettel & Mollon (1999), em RGB linear. */
const CVD = {
  normal: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  deuteranopia: [
    [0.29275, 0.70725, 0],
    [0.29275, 0.70725, 0],
    [-0.02234, 0.02234, 1],
  ],
  protanopia: [
    [0.11238, 0.88762, 0],
    [0.11238, 0.88762, 0],
    [0.00401, -0.00401, 1],
  ],
  tritanopia: [
    [1, 0.14461, -0.14461],
    [0, 0.85659, 0.14341],
    [0, 0.85659, 0.14341],
  ],
} as const;
type Vision = keyof typeof CVD;
const VISIONS = Object.keys(CVD) as Vision[];

function simulate(rgb: Rgb, vision: Vision): Rgb {
  const lin = toLinRgb(rgb);
  const [r, g, b] = CVD[vision].map((row) =>
    toSrgb(clamp01(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2])),
  );
  return [r ?? 0, g ?? 0, b ?? 0];
}

/** CIELab (D65). */
function lab(rgb: Rgb): [number, number, number] {
  const [r, g, b] = toLinRgb(rgb);
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const Y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const Z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) =>
    t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function deltaE2000(p: [number, number, number], q: [number, number, number]) {
  const rad = Math.PI / 180;
  const [L1, a1, b1] = p;
  const [L2, a2, b2] = q;
  const Cbar = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1;
  const ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1);
  const Cp2 = Math.hypot(ap2, b2);
  const ang = (y: number, x: number) => {
    if (y === 0 && x === 0) return 0;
    const d = Math.atan2(y, x) / rad;
    return d >= 0 ? d : d + 360;
  };
  const hp1 = ang(b1, ap1);
  const hp2 = ang(b2, ap2);
  const dLp = L2 - L1;
  const dCp = Cp2 - Cp1;
  let dhp = 0;
  if (Cp1 * Cp2 !== 0) {
    dhp = hp2 - hp1;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dhp * rad) / 2);
  const Lbp = (L1 + L2) / 2;
  const Cbp = (Cp1 + Cp2) / 2;
  let hbp = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(hp1 - hp2) > 180) hbp += hp1 + hp2 < 360 ? 360 : -360;
    hbp /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos((hbp - 30) * rad) +
    0.24 * Math.cos(2 * hbp * rad) +
    0.32 * Math.cos((3 * hbp + 6) * rad) -
    0.2 * Math.cos((4 * hbp - 63) * rad);
  const Rc = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const Sc = 1 + 0.045 * Cbp;
  const Sh = 1 + 0.015 * Cbp * T;
  const Rt =
    -Math.sin(2 * (30 * Math.exp(-(((hbp - 275) / 25) ** 2))) * rad) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 +
      (dCp / Sc) ** 2 +
      (dHp / Sh) ** 2 +
      Rt * (dCp / Sc) * (dHp / Sh),
  );
}

const pairDeltaE = (a: Rgb, b: Rgb, vision: Vision) =>
  deltaE2000(lab(simulate(a, vision)), lab(simulate(b, vision)));

// ---------------------------------------------------------------- leitura do CSS
/** Lê `--name` do corpo de um seletor de topo (`:root` / `.dark`). Falha alto se faltar. */
function readToken(css: string, selector: string, name: string): Rgb {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`seletor ${selector} não encontrado`);
  const body = css.slice(start, css.indexOf("\n}", start));
  // `\s` antes do `--` impede casar `--color-chart-1` ao procurar `--chart-1`.
  const hit = new RegExp(`\\s--${name}:\\s*([^;]+);`).exec(body);
  if (!hit?.[1]) throw new Error(`--${name} ausente em ${selector}`);
  return parseColor(hit[1]);
}

const cssPath = join(import.meta.dirname, "globals.css");
// CRLF (checkout no Windows) vira LF: o corte por "\n}" depende disso.
const css = readFileSync(cssPath, "utf8").replaceAll("\r\n", "\n");

const THEMES = [
  ["claro", ":root"],
  ["escuro", ".dark"],
] as const;

const PAIRS: [number, number][] = [];
for (let i = 0; i < SERIES; i++)
  for (let j = i + 1; j < SERIES; j++) PAIRS.push([i, j]);

// ---------------------------------------------------------------- testes da matemática
describe("parseColor", () => {
  it("lê hex de 6 dígitos", () => {
    expect(parseColor("#ff0000")).toEqual([1, 0, 0]);
    expect(parseColor(" #000000 ")).toEqual([0, 0, 0]);
  });

  it("oklch(1 0 0) é branco e oklch(0 0 0) é preto", () => {
    for (const c of parseColor("oklch(1 0 0)")) expect(c).toBeCloseTo(1, 3);
    for (const c of parseColor("oklch(0 0 0)")) expect(c).toBeCloseTo(0, 3);
  });

  it("oklch neutro do shadcn dá o cinza esperado (0.205 ≈ #171717)", () => {
    for (const c of parseColor("oklch(0.205 0 0)"))
      expect(Math.round(c * 255)).toBe(0x17);
  });

  it("oklch cromático bate com a referência (vermelho do shadcn ≈ rgb(231, 0, 11))", () => {
    const [r, g, b] = parseColor("oklch(0.577 0.245 27.325)").map((c) =>
      Math.round(c * 255),
    );
    expect(Math.abs((r ?? 0) - 231)).toBeLessThanOrEqual(2);
    expect(g).toBe(0);
    expect(Math.abs((b ?? 0) - 11)).toBeLessThanOrEqual(3);
  });

  it("recorta (clamp) o que cai fora do gamut sRGB", () => {
    for (const c of parseColor("oklch(0.7 0.4 150)")) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  it("aceita lightness em porcentagem", () => {
    expect(parseColor("oklch(50% 0 0)")).toEqual(parseColor("oklch(0.5 0 0)"));
  });

  it.each([
    "red",
    "#fff",
    "rgb(1, 2, 3)",
    "oklch(1 0 0 / 10%)",
    "",
  ])("lança para a forma não suportada %j", (value) => {
    expect(() => parseColor(value)).toThrow("cor não suportada");
  });
});

describe("readToken", () => {
  const sample =
    ":root {\n  --color-chart-1: #000000;\n  --chart-1: #ffffff;\n}\n";

  it("não confunde --chart-1 com --color-chart-1", () => {
    expect(readToken(sample, ":root", "chart-1")).toEqual([1, 1, 1]);
  });

  it("falha alto quando o token ou o seletor não existem", () => {
    expect(() => readToken(sample, ":root", "chart-9")).toThrow(
      "--chart-9 ausente",
    );
    expect(() => readToken(sample, ".dark", "chart-1")).toThrow(
      "seletor .dark não encontrado",
    );
  });
});

// ---------------------------------------------------------------- série chart-1..4
for (const [theme, selector] of THEMES) {
  describe(`série de gráfico (chart-1..${SERIES}) — tema ${theme}`, () => {
    const card = readToken(css, selector, "card");
    const series = Array.from({ length: SERIES }, (_, i) =>
      readToken(css, selector, `chart-${i + 1}`),
    );

    if (process.env.VITEST_PRINT_PALETTE) {
      it("imprime a matriz medida", () => {
        const lines = series.map((rgb, i) => {
          const { L, C } = oklchOf(rgb);
          return `chart-${i + 1}  L ${L.toFixed(3)}  C ${C.toFixed(3)}  contraste/card ${contrast(rgb, card).toFixed(2)}:1`;
        });
        for (const vision of VISIONS) {
          const des = PAIRS.map(([i, j]) =>
            pairDeltaE(series[i] ?? card, series[j] ?? card, vision),
          );
          lines.push(`${vision}: ΔE2000 mínimo ${Math.min(...des).toFixed(1)}`);
        }
        console.log(`\n[${theme}]\n${lines.join("\n")}`);
        expect(series).toHaveLength(SERIES);
      });
    }

    it.each(
      Array.from({ length: SERIES }, (_, i) => i + 1),
    )("chart-%i fica na banda de lightness e tem croma suficiente", (n) => {
      const { L, C } = oklchOf(series[n - 1] ?? card);
      expect(L, `chart-${n} L`).toBeGreaterThanOrEqual(L_BAND[0]);
      expect(L, `chart-${n} L`).toBeLessThanOrEqual(L_BAND[1]);
      expect(C, `chart-${n} croma`).toBeGreaterThanOrEqual(C_MIN);
    });

    it.each(
      Array.from({ length: SERIES }, (_, i) => i + 1),
    )("chart-%i tem contraste ≥3:1 sobre o card do tema", (n) => {
      const ratio = contrast(series[n - 1] ?? card, card);
      expect(
        ratio,
        `chart-${n} sobre card: ${ratio.toFixed(2)}:1`,
      ).toBeGreaterThanOrEqual(CONTRAST_MIN);
    });

    it.each(VISIONS)("separa todos os pares em %s (ΔE2000 ≥ 15)", (vision) => {
      for (const [i, j] of PAIRS) {
        const de = pairDeltaE(series[i] ?? card, series[j] ?? card, vision);
        expect(
          de,
          `chart-${i + 1} × chart-${j + 1} em ${vision}: ΔE ${de.toFixed(1)}`,
        ).toBeGreaterThanOrEqual(DELTA_E_MIN);
      }
    });
  });
}

// ---------------------------------------------------------------- pares de status
const STATUS_TOKENS = ["success", "warning", "info"] as const;

for (const [theme, selector] of THEMES) {
  describe(`pares de status — tema ${theme}`, () => {
    if (process.env.VITEST_PRINT_PALETTE) {
      it("imprime a matriz de status medida", () => {
        const lines = STATUS_TOKENS.map((name) => {
          const ratio = contrast(
            readToken(css, selector, `${name}-foreground`),
            readToken(css, selector, name),
          );
          return `${name}-foreground sobre ${name}: ${ratio.toFixed(2)}:1`;
        });
        console.log(`\n[status · ${theme}]\n${lines.join("\n")}`);
        expect(lines).toHaveLength(STATUS_TOKENS.length);
      });
    }

    it.each(
      STATUS_TOKENS,
    )("%s-foreground lê sobre o fundo do par (≥4,5:1)", (name) => {
      const ratio = contrast(
        readToken(css, selector, `${name}-foreground`),
        readToken(css, selector, name),
      );
      expect(ratio, `${name}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(
        TEXT_MIN,
      );
    });
  });
}

describe("os tokens de status têm a ponte no @theme inline", () => {
  it.each([
    "success",
    "success-foreground",
    "warning",
    "warning-foreground",
    "info",
    "info-foreground",
  ])("a ponte --color-%s existe", (name) => {
    // Sem a ponte, `bg-success` não gera CSS e o fundo sai transparente, em silêncio.
    const start = css.indexOf("@theme inline {");
    if (start < 0) throw new Error("@theme inline não encontrado");
    const theme = css.slice(start, css.indexOf("\n}", start));
    expect(theme).toMatch(
      new RegExp(`--color-${name}:\\s*var\\(\\s*--${name}\\s*\\)\\s*;`),
    );
  });
});

// ---------------------------------------------------------------- o validador reprova o que deve
/**
 * O CASO NEGATIVO. Sem ele, todo o bloco de daltonismo acima poderia virar uma constante e os
 * testes seguiriam verdes: o guarda, que existe para reprovar paleta ruim, autorizaria qualquer
 * uma. O par é o vermelho e o verde clássicos do matplotlib, indistinguíveis em deuteranopia.
 */
describe("o validador reprova o que deve reprovar", () => {
  const VERMELHO = parseColor("#d62728");
  const VERDE = parseColor("#2ca02c");

  it("separa o par em visão normal", () => {
    expect(pairDeltaE(VERMELHO, VERDE, "normal")).toBeGreaterThan(60);
  });

  it("e o REPROVA em deuteranopia: a simulação está viva", () => {
    expect(pairDeltaE(VERMELHO, VERDE, "deuteranopia")).toBeLessThan(
      DELTA_E_MIN,
    );
  });

  it("reprova contraste insuficiente sobre o card", () => {
    expect(contrast(parseColor("#e8e8e8"), parseColor("#fdfcf9"))).toBeLessThan(
      CONTRAST_MIN,
    );
  });

  it("reprova texto de status sem contraste (cinza claro sobre branco)", () => {
    expect(contrast(parseColor("#cccccc"), parseColor("#ffffff"))).toBeLessThan(
      TEXT_MIN,
    );
  });

  it("a série antiga (cinzas do shadcn) reprova o piso de croma: P4 detectado", () => {
    // Era o valor de chart-1..4 antes da D16: cinza puro, croma 0.
    for (const old of [
      "oklch(0.87 0 0)",
      "oklch(0.556 0 0)",
      "oklch(0.439 0 0)",
      "oklch(0.371 0 0)",
    ]) {
      expect(oklchOf(parseColor(old)).C).toBeLessThan(C_MIN);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/app/chartPalette.test.ts`
Expected: FAIL, `Tests  31 failed | 23 passed (54)`. Os cinzas antigos reprovam com mensagens como `AssertionError: chart-1 L: expected 0.8699999943219852 to be less than or equal to 0.77` e `chart-2 croma: expected 2.07e-8 to be greater than or equal to 0.06`; os pares de status e as pontes falham com `--success-foreground ausente em :root` e a mensagem do `toMatch` das pontes. Os testes de `parseColor`, `readToken` e o bloco "reprova o que deve reprovar" já passam: eles não dependem do CSS.

- [ ] **Step 3: Write minimal implementation (tokens no `globals.css`)**

Em `src/app/globals.css`, três edições. Os valores são os do klauve, copiados como estão (D16), não ajustados a olho.

3a. No `@theme inline`, logo depois da linha `  --color-chart-1: var(--chart-1);`, acrescente:
```css
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
```

3b. Em `:root`, troque este trecho (único, termina em `--radius`):
```css
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --radius: 0.625rem;
```
por:
```css
  --chart-1: #8d3e0f;
  --chart-2: #2c8faf;
  --chart-3: #7235a6;
  --chart-4: #738c57;
  --chart-5: oklch(0.269 0 0);
  --success: #d3eedd;
  --success-foreground: #1f5131;
  --warning: #f5e0bc;
  --warning-foreground: #6a451b;
  --info: #cbe4f6;
  --info-foreground: #1d4a72;
  --radius: 0.625rem;
```

3c. Em `.dark`, troque este trecho (único, termina em `--sidebar: oklch(0.205 0 0);`):
```css
  --chart-1: oklch(0.87 0 0);
  --chart-2: oklch(0.556 0 0);
  --chart-3: oklch(0.439 0 0);
  --chart-4: oklch(0.371 0 0);
  --chart-5: oklch(0.269 0 0);
  --sidebar: oklch(0.205 0 0);
```
por:
```css
  --chart-1: #c3550c;
  --chart-2: #56badd;
  --chart-3: #836b9f;
  --chart-4: #95b278;
  --chart-5: oklch(0.269 0 0);
  --success: #1d3526;
  --success-foreground: #75d799;
  --warning: #372d1b;
  --warning-foreground: #e4bb67;
  --info: #1b2a37;
  --info-foreground: #74b1e7;
  --sidebar: oklch(0.205 0 0);
```

`--chart-5` fica como o shadcn gerou (cinza, só para "Outros").

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- src/app/chartPalette.test.ts`
Expected: PASS (54 testes). Nenhum piso foi afrouxado e nenhum hex foi ajustado: a série do klauve passa contra os cards do shadcn.

- [ ] **Step 5: Conferir os números medidos**

Run: `VITEST_PRINT_PALETTE=1 bunx vitest run src/app/chartPalette.test.ts --project node --reporter=verbose`
Expected (nos blocos `stdout`): 
```
[claro]
chart-1  L 0.462  C 0.121  contraste/card 7.42:1
chart-2  L 0.608  C 0.100  contraste/card 3.71:1
chart-3  L 0.467  C 0.175  contraste/card 7.57:1
chart-4  L 0.607  C 0.081  contraste/card 3.74:1
normal: ΔE2000 mínimo 34.5
deuteranopia: ΔE2000 mínimo 17.6
protanopia: ΔE2000 mínimo 23.2
tritanopia: ΔE2000 mínimo 17.7

[escuro]
chart-1  L 0.581  C 0.158  contraste/card 3.95:1
chart-2  L 0.743  C 0.105  contraste/card 8.07:1
chart-3  L 0.571  C 0.083  contraste/card 3.90:1
chart-4  L 0.727  C 0.086  contraste/card 7.61:1
normal: ΔE2000 mínimo 35.6
deuteranopia: ΔE2000 mínimo 17.5
protanopia: ΔE2000 mínimo 22.4
tritanopia: ΔE2000 mínimo 17.6

[status · claro]  success 7.48:1 · warning 6.56:1 · info 7.02:1
[status · escuro] success 7.51:1 · warning 7.47:1 · info 6.41:1
```
(com `VITEST_PRINT_PALETTE=1` o total sobe para 58 testes: 4 de impressão).

- [ ] **Step 6: Provar que o guarda morde (mutação descartável)**

Run (troca dois valores, mede e restaura):
```bash
cp src/app/globals.css /tmp/globals.ok.css
sed -i 's/--chart-2: #2c8faf;/--chart-2: #8d4e1f;/; s/--success-foreground: #1f5131;/--success-foreground: #7fb08f;/' src/app/globals.css
bun run test -- src/app/chartPalette.test.ts
cp /tmp/globals.ok.css src/app/globals.css
git diff --stat src/app/globals.css
```
Expected: o teste FALHA (5 falhas: `chart-1 × chart-2 em normal: ΔE 5.2`, o mesmo em deuteranopia, protanopia e tritanopia, e `success: 2.00:1 ... to be greater than or equal to 4.5`); depois da restauração, `git diff --stat` mostra só as edições do Step 3 e `bun run test -- src/app/chartPalette.test.ts` volta a passar.

- [ ] **Step 7: Atualizar `.context/ui-tokens.md`**

7a. Na tabela de §2, logo depois da linha `| \`destructive\` | erro, ação destrutiva |`, acrescente:
```markdown
| `success` / `success-foreground` | estado ok (item conferido, solicitação atendida) — sempre com ícone + texto |
| `warning` / `warning-foreground` | atenção (pendente, em andamento) — sempre com ícone + texto |
| `info` / `info-foreground` | informação neutra (solicitação aberta) — sempre com ícone + texto |
```

7b. Troque o parágrafo
```markdown
**A adicionar com a primeira tela que usar (D16, valores do klauve):** `success` / `success-foreground`,
`warning` / `warning-foreground`, `info` / `info-foreground` — claro e escuro, expostos no
`@theme inline`. Uso: estados de solicitação e de passagem, sempre com ícone + texto junto.
```
por:
```markdown
**Existem desde 2026-11-20 (D16, valores do klauve; P4 resolvida):** `chart-1..4`, `success`,
`warning`, `info` e os `-foreground`, claro e escuro, expostos no `@theme inline`
(`bg-success text-success-foreground`). Uso: estados de solicitação e de passagem, sempre com
ícone + texto junto.
```

7c. Troque o último parágrafo da §2 (`A validação da série ... superfícies são as do shadcn neutral (P9).`) por:
```markdown
**Guarda de paleta (P9, resolvida 2026-11-20):** `src/app/chartPalette.test.ts` lê o `globals.css`
(hex e `oklch`) e reprova, nos dois temas, série fora da banda de lightness OKLCH 0,43–0,77, croma
< 0,06, contraste < 3:1 sobre `--card`, ΔE2000 < 15 entre qualquer par (visão normal, deuteranopia,
protanopia, tritanopia) e `-foreground` de status < 4,5:1 sobre o fundo do par. Medido contra os
cards do shadcn neutral (`oklch(1 0 0)` claro, `oklch(0.205 0 0)` escuro):

| | Claro | Escuro |
|---|---|---|
| contraste `chart-1..4` sobre o card | 7,42 · 3,71 · 7,57 · 3,74 | 3,95 · 8,07 · 3,90 · 7,61 |
| ΔE2000 mínimo (normal / deuter. / protan. / tritan.) | 34,5 / 17,6 / 23,2 / 17,7 | 35,6 / 17,5 / 22,4 / 17,6 |
| `success` / `warning` / `info` (`-foreground` sobre o fundo) | 7,48 · 6,56 · 7,02 | 7,51 · 7,47 · 6,41 |

Mudou um valor de cor? Rode `bun run test -- src/app/chartPalette.test.ts`; piso que reprova se
corrige no token, nunca no teste. `VITEST_PRINT_PALETTE=1` imprime a matriz.

**Fora da série:** `chart-5` (cinza do shadcn, "Outros") **não** é medido pelo guarda. No tema
escuro ele tem 1,19:1 sobre o card — some. Antes de qualquer gráfico usar uma fatia "Outros",
escolher e medir um neutro que passe 3:1 sobre o card e ΔE ≥ 15 da série.
```

- [ ] **Step 8: Atualizar `.context/pendencias.md` (P4 e P9 → Resolvido, seção 5)**

8a. No índice, troque o estado de P4 e de P9:
```markdown
| P4 | Paleta de gráficos em cinza e sem tokens de status | 🟡 | Resolvido |
```
```markdown
| P9 | Paleta de gráficos do klauve não foi validada contra as superfícies do shadcn | ⚪ | Resolvido |
```

8b. Seção 1: apague o bloco inteiro de P9 (de `#### P9 — Paleta de gráficos do klauve não foi validada contra as superfícies do shadcn ⚪` até a linha `globals.css\` daqui)`), deixando só P3 na seção.

8c. Seção 2: apague o bloco inteiro de P4 (de `#### P4 — Paleta de gráficos em cinza e sem tokens de status 🟡` até `klauve os tokens que faltavam.`) e deixe a seção assim:
```markdown
## 2. Triado, plano pronto

*(nenhuma)*
```

8d. No fim do arquivo (depois da última `Atualização` de P1, na seção 5), acrescente, separados por linha em branco:
````markdown
#### P4 — Paleta de gráficos em cinza e sem tokens de status 🟡
**Estado:** Resolvido
**Arquivos:** `src/app/globals.css` (`--chart-1..5`)
**Impacto:** o dashboard é central e os tokens `chart-*` do preset são tons de cinza — séries
indistinguíveis. Não existem `success`/`warning` para status de item e de solicitação.
**Correção:** copiar do klauve `chart-1..4`, `success`, `warning`, `info` (+ `-foreground`), claro e
escuro, para o `globals.css` e o `@theme inline` (D16; valores em `ui-tokens.md §2`).
**Registrado em:** 2026-11-20
**Atualização (2026-11-20):** triada no brainstorm — D14 manteve o shadcn padrão e D16 trouxe do
klauve os tokens que faltavam.
**Atualização (2026-11-20):** `chart-1..4`, `success`, `warning`, `info` (+ `-foreground`) entraram no
`src/app/globals.css` (claro e escuro) e no `@theme inline`, com os valores do klauve copiados como
estão (D16). `chart-5` ficou como o shadcn gerou. `ui-tokens.md §2` agora descreve tokens que existem.

#### P9 — Paleta de gráficos do klauve não foi validada contra as superfícies do shadcn ⚪
**Estado:** Resolvido
**Arquivos:** `src/app/globals.css` (quando os tokens da D16 entrarem)
**Impacto:** no klauve, `chart-1..4` passou por teste de contraste ≥3:1 sobre o card e de
distinção para daltonismo, medido contra os cards **do klauve** (`#fefefe` / `#1e1e21`). Os cards
do shadcn neutral são próximos (branco / `oklch(0.205 0 0)`), mas não iguais — a garantia não se
transfere automaticamente.
**Correção:** — (opção: portar o `chartPaletteGuard.test.ts` do klauve e rodar contra o
`globals.css` daqui)
**Registrado em:** 2026-11-20
**Atualização (2026-11-20):** o guarda do klauve foi portado para `src/app/chartPalette.test.ts` (lê
hex e `oklch`) e roda contra o `globals.css` daqui: a série `chart-1..4` passa todos os pisos nos dois
temas contra os cards do shadcn, sem ajuste de cor (contraste ≥ 3,71:1; ΔE2000 mínimo 17,5 em
deuteranopia). Números completos em `ui-tokens.md §2`. Ressalva registrada lá: `chart-5` ("Outros") não é
medido e some no tema escuro (1,19:1 sobre o card).
````
O "Próximo id livre" continua `P10` (nenhuma pendência nova nasceu aqui).

- [ ] **Step 9: Verificação completa**

Run: `bun run check-types && bun run lint && bun run test`
Expected: os três verdes. O Biome aceita as cores em hex no CSS e o teste usa `import.meta.dirname` (disponível no Node ≥ 22.12). Total esperado depois das Tasks 1 e 2: 5 arquivos, 70 testes.

- [ ] **Step 10: Commit**

```bash
git add src/app/globals.css src/app/chartPalette.test.ts .context/ui-tokens.md .context/pendencias.md
git commit -F - <<'EOF'
feat(ui): tokens D16 e guarda de paleta de gráficos

chart-1..4 do klauve e success/warning/info (+ foreground) no globals.css,
claro e escuro. O guarda portado do klauve lê hex e oklch e valida a série e
os pares de status contra os cards do shadcn. P4 e P9 resolvidas.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 3: Primitivos shadcn da Fase 1 + alvos de toque (P3)

**Files:**
- Create: `test/touchTargets.ts` (helper dos testes de alvo de toque)
- Create: `src/components/ui/alert.tsx`, `avatar.tsx`, `badge.tsx`, `card.tsx`, `dropdown-menu.tsx`, `field.tsx`, `input-group.tsx`, `input.tsx`, `label.tsx`, `separator.tsx`, `sheet.tsx`, `sidebar.tsx`, `skeleton.tsx`, `sonner.tsx`, `textarea.tsx`, `tooltip.tsx` (todos gerados por `shadcn add`; `textarea` entra por dependência do `input-group`)
- Create: `src/hooks/use-mobile.ts` (gerado pelo `shadcn add`, dependência do `sidebar`)
- Modify: `src/components/ui/button.tsx` (o `shadcn add` sobrescreve só com formatação; depois o bloco `size: { … }` do `cva` recebe os alvos de toque)
- Modify: `src/components/ui/input.tsx` (`h-8` vira `h-9 … max-md:h-11`)
- Modify: `src/components/ui/sidebar.tsx` (`SidebarMenuButton` tamanho `default`: `h-8 text-sm` vira `h-9 text-sm max-md:h-11`)
- Modify: `biome.json` (bloco `overrides` para o código gerado em `src/components/ui/**` e `src/hooks/use-mobile.ts`)
- Modify: `package.json` e `bun.lock` (o `shadcn add` traz `sonner` e `next-themes`)
- Modify: `.context/ui-registry.md` (catálogo dos primitivos; Button ganha histórico)
- Modify: `.context/pendencias.md` (P3 → Resolvido, movida para a seção 5, com Atualização datada)
- Test: `src/components/ui/button.test.ts`, `src/components/ui/input.test.tsx`, `src/components/ui/sidebar.test.tsx`

**Interfaces:**
- Consumes: projeto Vitest da Task 1 (`bun run test`, projeto `node` para `*.test.ts`, projeto `dom` para `*.test.tsx`, `test/setup-dom.ts` com `@testing-library/jest-dom/vitest` e `cleanup`). `components.json` já existente (`style: base-nova`).
- Produces (usados pelas Tasks 8–11):
  - `Button`, `buttonVariants` de `@/components/ui/button` com tamanhos `default | xs | sm | lg | icon | icon-xs | icon-sm | icon-lg`; todos com altura ≥ h-9 / size-9 e `max-md:` 44px (exceto `lg` e `icon-lg`, que já são h-11 / size-11).
  - `Input` (h-9, `max-md:h-11`, `text-base md:text-sm`).
  - `Field, FieldGroup, FieldLabel, FieldDescription, FieldError, FieldSet, FieldLegend, FieldContent, FieldTitle, FieldSeparator` de `@/components/ui/field` (não ligam `id`/`aria-*` sozinhos).
  - `Label`, `Card*`, `Separator`, `Avatar*`, `DropdownMenu*`, `Tooltip, TooltipTrigger, TooltipContent, TooltipProvider`, `Sheet*`, `Skeleton`, `Alert*`, `Badge`, `InputGroup*`, `Textarea`.
  - `Toaster` de `@/components/ui/sonner` + `toast` de `sonner`.
  - `SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarInset, SidebarTrigger, SidebarRail, useSidebar` de `@/components/ui/sidebar`.
  - `test/touchTargets.ts`: `MIN_DESKTOP_UNIT = 9`, `TOUCH_UNIT = 11`, `heightUnit(className: string, prefix: "" | "max-md:"): number | null`.

- [ ] **Step 1: Write the failing test**

Crie o helper (a escala do Tailwind é 1 unidade = 4px: h-9 = 36px, h-11 = 44px):

```ts
// test/touchTargets.ts
// Escala do Tailwind: 1 unidade = 4px (h-9 = 36px, h-11 = 44px).
export const MIN_DESKTOP_UNIT = 9;
export const TOUCH_UNIT = 11;

/**
 * Lê a altura (h-N ou size-N) de uma string de classes, só da variante pedida:
 * "" para a classe pura, "max-md:" para o modificador de celular.
 */
export function heightUnit(
  className: string,
  prefix: "" | "max-md:",
): number | null {
  const pattern = new RegExp(`^${prefix}(?:h|size)-([0-9]+(?:[.][0-9]+)?)$`);
  for (const name of className.split(" ")) {
    const match = pattern.exec(name);
    if (match) return Number(match[1]);
  }
  return null;
}
```

Teste do `Button` (projeto `node`: só inspeciona a string de classes do `cva`):

```ts
// src/components/ui/button.test.ts
import { describe, expect, it } from "vitest";

import { buttonVariants } from "@/components/ui/button";
import {
  heightUnit,
  MIN_DESKTOP_UNIT,
  TOUCH_UNIT,
} from "../../../test/touchTargets";

const SIZES = [
  "default",
  "xs",
  "sm",
  "lg",
  "icon",
  "icon-xs",
  "icon-sm",
  "icon-lg",
] as const;

// Estes já são 44px em qualquer tela; os demais ganham o modificador max-md.
const ALWAYS_TOUCH_SIZED = ["lg", "icon-lg"] as const;
const SCALING_SIZES = SIZES.filter(
  (size) => !(ALWAYS_TOUCH_SIZED as readonly string[]).includes(size),
);

describe("buttonVariants — alvos de toque (ui-rules §1.4)", () => {
  it.each(
    SIZES,
  )("size=%s tem pelo menos 36px (h-9 / size-9) no desktop", (size) => {
    const unit = heightUnit(buttonVariants({ size }), "");
    expect(unit).not.toBeNull();
    expect(unit).toBeGreaterThanOrEqual(MIN_DESKTOP_UNIT);
  });

  it.each(SCALING_SIZES)("size=%s sobe para 44px abaixo de md", (size) => {
    expect(heightUnit(buttonVariants({ size }), "max-md:")).toBe(TOUCH_UNIT);
  });

  it.each(ALWAYS_TOUCH_SIZED)("size=%s já é 44px em qualquer tela", (size) => {
    expect(heightUnit(buttonVariants({ size }), "")).toBe(TOUCH_UNIT);
  });

  it("override de altura em className não remove o alvo de toque do celular", () => {
    const className = buttonVariants({ size: "default", className: "h-6" });
    expect(heightUnit(className, "max-md:")).toBe(TOUCH_UNIT);
  });
});
```

Teste do `Input` (projeto `dom`):

```tsx
// src/components/ui/input.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Input } from "@/components/ui/input";
import {
  heightUnit,
  MIN_DESKTOP_UNIT,
  TOUCH_UNIT,
} from "../../../test/touchTargets";

function renderedClassName(): string {
  render(<Input aria-label="Campo" />);
  return screen.getByRole("textbox", { name: "Campo" }).className;
}

describe("Input — alvos de toque (ui-rules §1.4)", () => {
  it("tem pelo menos 36px (h-9) no desktop e 44px (h-11) abaixo de md", () => {
    const className = renderedClassName();
    expect(heightUnit(className, "")).toBeGreaterThanOrEqual(MIN_DESKTOP_UNIT);
    expect(heightUnit(className, "max-md:")).toBe(TOUCH_UNIT);
  });

  it("mantém o texto de 16px no celular (evita zoom do iOS)", () => {
    const classes = renderedClassName().split(" ");
    expect(classes).toContain("text-base");
    expect(classes).toContain("md:text-sm");
  });

  it("override de altura em className não remove o alvo de toque do celular", () => {
    render(<Input aria-label="Campo" className="h-6" />);
    const className = screen.getByRole("textbox", { name: "Campo" }).className;
    expect(heightUnit(className, "max-md:")).toBe(TOUCH_UNIT);
  });
});
```

Teste do `SidebarMenuButton` (projeto `dom`):

```tsx
// src/components/ui/sidebar.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  heightUnit,
  MIN_DESKTOP_UNIT,
  TOUCH_UNIT,
} from "../../../test/touchTargets";

describe("SidebarMenuButton — alvos de toque (ui-rules §1.4)", () => {
  it("o tamanho default tem h-9 no desktop e h-11 abaixo de md", () => {
    render(
      <TooltipProvider>
        <SidebarProvider>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>Início</SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarProvider>
      </TooltipProvider>,
    );
    const className = screen.getByRole("button", { name: "Início" }).className;
    expect(heightUnit(className, "")).toBeGreaterThanOrEqual(MIN_DESKTOP_UNIT);
    expect(heightUnit(className, "max-md:")).toBe(TOUCH_UNIT);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/components/ui/button.test.ts src/components/ui/input.test.tsx src/components/ui/sidebar.test.tsx`
Expected: FAIL. `button.test.ts`: 15 falhas (os tamanhos `default`, `xs`, `sm`, `icon`, `icon-xs`, `icon-sm` não têm h-9 nem `max-md:`; `lg` e `icon-lg` ainda são h-9 / size-9, então só falham no teste "já é 44px"), 2 passam. `input.test.tsx` e `sidebar.test.tsx`: `Failed to resolve import "@/components/ui/input"` e `"@/components/ui/sidebar"` (os arquivos ainda não existem).

- [ ] **Step 3: Write minimal implementation (instalar os primitivos)**

O CLI aceita `-y/--yes` (pula a confirmação) e `-o/--overwrite` (sobrescreve; o único arquivo existente que muda é `button.tsx`, só com formatação). Verificado com `bunx shadcn add --help` (CLI 4.23.0). Use o CLI **local** (`shadcn@^4.23.0` já está em `dependencies`), nunca `shadcn@latest`: um CLI mais novo pode gerar código diferente e o `old_string` do Step 5 deixaria de casar.

Run:
```bash
bunx shadcn add sidebar field input label card separator sonner avatar dropdown-menu tooltip sheet skeleton alert badge input-group --yes --overwrite
bun run format
bunx biome check --write
```
Expected: o CLI lista 17 arquivos novos (16 em `src/components/ui` + `src/hooks/use-mobile.ts`), 1 sobrescrito (`button.tsx`) e instala `sonner` e `next-themes`. `bun run format` ("Fixed N files") tira o código gerado do estilo shadcn (sem `;`, aspas) e `biome check --write` organiza os imports (sem isso o `lint` acusa `organizeImports`). Sobram 9 erros de lint no código gerado (regras `a11y`/`suspicious`/`correctness` que o shadcn não respeita); eles são tratados no próximo passo.

- [ ] **Step 4: Silenciar o lint só no código gerado e confirmar que o `button.tsx` voltou idêntico**

Edite `biome.json` com a ferramenta Edit: troque `  "assist": {` por (o `overrides` fica entre `linter` e `assist`):

```json
  "overrides": [
    {
      "includes": ["src/components/ui/**", "src/hooks/use-mobile.ts"],
      "linter": {
        "rules": {
          "suspicious": {
            "noDocumentCookie": "off",
            "noDoubleEquals": "off",
            "noArrayIndexKey": "off"
          },
          "a11y": {
            "useSemanticElements": "off",
            "useKeyWithClickEvents": "off",
            "noLabelWithoutControl": "off"
          },
          "correctness": {
            "useExhaustiveDependencies": "off"
          }
        }
      }
    }
  ],
  "assist": {
```

Run:
```bash
bunx biome format --write biome.json
bun run lint
git diff --exit-code src/components/ui/button.tsx
```
Expected: `bun run lint` termina com `Checked N files … No fixes applied.` e sem erros; `git diff --exit-code` sai com 0 e sem saída (o overwrite do `button.tsx` virou no-op depois do Biome).

- [ ] **Step 5: Aplicar os ajustes P3 (button, input, sidebar)**

Com a ferramenta Edit, em `src/components/ui/button.tsx` troque o bloco `size: { … }` (arquivo já formatado pelo Biome) por:

Trecho atual (`old_string`):
```ts
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
```

Trecho novo (`new_string`):
```ts
      size: {
        default:
          "h-9 gap-1.5 px-3 max-md:h-11 has-data-[icon=inline-end]:pr-2.5 has-data-[icon=inline-start]:pl-2.5",
        xs: "h-9 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs max-md:h-11 in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-9 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] max-md:h-11 in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-11 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        icon: "size-9 max-md:size-11",
        "icon-xs":
          "size-9 rounded-[min(var(--radius-md),10px)] max-md:size-11 in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-9 rounded-[min(var(--radius-md),12px)] max-md:size-11 in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-11",
      },
```

Se o `old_string` não casar (o registry do `base-nova` mudou o código gerado), aplique a mesma regra a cada tamanho à mão: h-9/size-9 no desktop + `max-md:h-11`/`max-md:size-11`, e `lg`/`icon-lg` = h-11/size-11. Os testes do Step 1 são o critério.

Por quê: nada abaixo de 36px no desktop; 44px abaixo de `md` (mesmo breakpoint do `useIsMobile` e do `md` do Tailwind). Os tamanhos `xs`/`sm`/`icon-xs`/`icon-sm` ficam (o `input-group`, o `sheet` e o `sidebar` usam) e também chegam a 44px no celular. O `cn` mantém `max-md:h-11` mesmo quando um `className` traz `h-6`.

Em `src/components/ui/input.tsx` (Edit): troque `"h-8 w-full min-w-0` por `"h-9 w-full min-w-0 max-md:h-11` (o resto da string de classes continua igual: `text-base … md:text-sm` já mantém 16px no celular).

Em `src/components/ui/sidebar.tsx` (Edit): troque `default: "h-8 text-sm",` por `default: "h-9 text-sm max-md:h-11",` (é a única ocorrência, dentro de `sidebarMenuButtonVariants`).

Run: `bunx biome check --write src`
Expected: `No fixes applied.` (nenhuma reformatação necessária; se o Biome reformatar alguma linha, aceite).

- [ ] **Step 6: Run test to verify it passes**

Run: `bun run test -- src/components/ui`
Expected: PASS (4 arquivos, 24 testes: 17 em `button.test.ts`, 3 em `button.test.tsx` da Tarefa 1, 3 em `input.test.tsx`, 1 em `sidebar.test.tsx`; o filtro do Vitest casa por trecho do caminho).

- [ ] **Step 7: Atualizar `.context/ui-registry.md`**

Com a ferramenta Edit, em `.context/ui-registry.md`, no "Como funciona" do item Button, troque `` `lg` (h-9) `` por `` `lg` (h-11) `` (o tamanho mudou no Step 5). Depois troque este trecho do mesmo item:

```
- **Atenção:** os tamanhos gerados (`default`, `xs`, `sm`, `icon`) ficam abaixo do mínimo do
  `ui-rules.md §1.4` (h-9+, 44px no celular) — ajuste pendente (P3 em `pendencias.md`).
- **Usa:** tokens `primary`, `border`, `muted`, `ring`, `destructive`.
- **Histórico:** 2026-11-20 — gerado pelo `shadcn init` (sem alteração).
```

por este (Button atualizado + um item por primitivo novo, no template do arquivo):

```
- **Atenção:** todo tamanho tem h-9 / size-9 no desktop e `max-md:h-11` / `max-md:size-11` no
  celular (`lg` e `icon-lg` são 44px sempre). Teste: `button.test.ts`. Para navegação use
  `<Link className={buttonVariants()}>` (continua role link); `render={<Link />}` (com
  `nativeButton={false}`) vira role=button e só serve quando o papel de botão é o desejado.
- **Usa:** tokens `primary`, `border`, `muted`, `ring`, `destructive`.
- **Histórico:** 2026-11-20 — gerado pelo `shadcn init` (sem alteração). 2026-11-20 — P3: alvos de
  toque (h-9 desktop, 44px no celular).

### Input
- **Status:** ✏️ estendido
- **Local:** `src/components/ui/input.tsx`
- **Propósito:** campo de texto de uma linha.
- **Como funciona:** `@base-ui/react/input`; `text-base` no celular (16px, sem zoom do iOS) e
  `md:text-sm`; estilo `aria-invalid` pronto. Altura `h-9 max-md:h-11`.
- **Usa:** tokens `input`, `ring`, `destructive`, `muted-foreground`.
- **Histórico:** 2026-11-20 — `shadcn add`; altura sobe de h-8 para `h-9 max-md:h-11` (P3).

### Label
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/label.tsx`
- **Propósito:** rótulo de campo (`<label>` simples).
- **Como funciona:** HTML puro; use `htmlFor` casando com o `id` do campo. Dentro de formulário,
  prefira `FieldLabel`.
- **Usa:** tokens de texto.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### Field (FieldGroup, FieldLabel, FieldDescription, FieldError…)
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/field.tsx`
- **Propósito:** estrutura de formulário acessível: rótulo, campo, ajuda e erro.
- **Como funciona:** HTML puro; **não** liga `id`/`aria-*` sozinho — passe `htmlFor`/`id`,
  `aria-invalid` no `Input` e `aria-describedby` apontando para o `FieldError`. `Field
  data-invalid` pinta o rótulo de `destructive`. `FieldError` renderiza `role="alert"` e retorna
  `null` se vazio.
- **Usa:** `Label`, `Separator`; tokens `destructive`, `muted-foreground`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### InputGroup
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/input-group.tsx` (traz `textarea.tsx`)
- **Propósito:** campo com adornos (ícone, texto, botão) dentro da mesma borda.
- **Como funciona:** `InputGroup`, `InputGroupAddon`, `InputGroupButton`, `InputGroupText`,
  `InputGroupInput`, `InputGroupTextarea`. O `InputGroupButton` sobrescreve a altura do `Button`,
  mas o `max-md:` do P3 sobrevive: no celular o botão pode ficar mais alto que o campo.
- **Usa:** `Button`, `Input`, `Textarea`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### Textarea
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/textarea.tsx`
- **Propósito:** campo de texto de várias linhas (veio como dependência do `InputGroup`).
- **Como funciona:** `<textarea>` estilizado igual ao `Input`.
- **Usa:** tokens `input`, `ring`, `destructive`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### Card
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/card.tsx`
- **Propósito:** superfície que agrupa um bloco de conteúdo.
- **Como funciona:** `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`,
  `CardContent`, `CardFooter`; HTML puro.
- **Usa:** tokens `card`, `card-foreground`, `border`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### Separator
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/separator.tsx`
- **Propósito:** linha divisória horizontal ou vertical.
- **Como funciona:** `@base-ui/react/separator`; prop `orientation`.
- **Usa:** token `border`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### Sidebar
- **Status:** ✏️ estendido
- **Local:** `src/components/ui/sidebar.tsx` (traz `src/hooks/use-mobile.ts`)
- **Propósito:** navegação lateral do app; vira gaveta (`Sheet`) no celular.
- **Como funciona:** `SidebarProvider` > `Sidebar` > `SidebarHeader`/`SidebarContent`/
  `SidebarFooter`, com `SidebarInset` ao lado e `SidebarTrigger` (Ctrl/Cmd+B). `SidebarMenuButton`
  aceita `isActive` e `render={<Link />}`; `useSidebar().setOpenMobile(false)` fecha a gaveta
  após navegar. Breakpoint do celular: 768px (igual ao `md`). O primeiro render é sempre desktop
  (`useIsMobile` começa `false`). Exige `TooltipProvider` acima. Ler `cookies()` para
  `defaultOpen` exigiria `Suspense`; use `defaultOpen` fixo.
- **Usa:** `Button`, `Input`, `Separator`, `Sheet`, `Skeleton`, `Tooltip`; tokens `sidebar-*`.
- **Histórico:** 2026-11-20 — `shadcn add`; `SidebarMenuButton` default sobe de h-8 para
  `h-9 max-md:h-11` (P3).

### Sheet
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/sheet.tsx`
- **Propósito:** painel que desliza da borda (gaveta de navegação no celular, painéis laterais).
- **Como funciona:** `@base-ui/react/dialog`; `side` = `top|right|bottom|left`; `SheetHeader`,
  `SheetTitle`, `SheetDescription`, `SheetFooter`, `SheetClose`. O botão de fechar usa
  `Button size="icon-sm"` (44px no celular).
- **Usa:** `Button`; tokens `background`, `border`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### Tooltip
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/tooltip.tsx`
- **Propósito:** rótulo curto de controle só com ícone (regra do `AGENTS.md`).
- **Como funciona:** `@base-ui/react/tooltip`; `TooltipProvider` uma vez no layout raiz
  (sem ele o Base UI lança erro); `TooltipTrigger render={<Button … />}`.
- **Usa:** tokens `foreground`, `background`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### Sonner (Toaster)
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/sonner.tsx`
- **Propósito:** toasts de confirmação ("Passkey criada.").
- **Como funciona:** um `<Toaster />` no layout raiz; dispare com `toast.success(...)` de
  `sonner`. Lê o tema via `next-themes` (sem `ThemeProvider` cai em `system`).
- **Usa:** tokens `popover`, `border`.
- **Histórico:** 2026-11-20 — `shadcn add` (traz `sonner` e `next-themes`).

### Avatar
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/avatar.tsx`
- **Propósito:** foto ou iniciais de uma pessoa.
- **Como funciona:** `Avatar`, `AvatarImage`, `AvatarFallback`, `AvatarGroup`, `AvatarBadge`;
  `size` = `default|sm|lg`.
- **Usa:** `@base-ui/react/avatar`; tokens `muted`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### DropdownMenu
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/dropdown-menu.tsx`
- **Propósito:** menu de ações de um botão.
- **Como funciona:** `@base-ui/react/menu`. `DropdownMenuLabel` precisa estar dentro de
  `DropdownMenuGroup`. `DropdownMenuItem` aceita `render={<Link />}` direto (não é nativo).
- **Usa:** tokens `popover`, `accent`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### Skeleton
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/skeleton.tsx`
- **Propósito:** estado de carregamento (fallback de `Suspense`).
- **Como funciona:** `div` pulsante; dê o tamanho por `className`.
- **Usa:** token `muted`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### Alert
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/alert.tsx`
- **Propósito:** aviso em linha dentro da tela (erro de formulário, informação).
- **Como funciona:** `Alert`, `AlertTitle`, `AlertDescription`, `AlertAction`; variantes
  `default` e `destructive` apenas. Status `success`/`warning`/`info` pedem classes com os tokens
  novos, sempre com ícone + texto.
- **Usa:** tokens `card`, `destructive`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### Badge
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/badge.tsx`
- **Propósito:** etiqueta curta de estado ou papel.
- **Como funciona:** variantes `default`, `secondary`, `destructive`, `outline`, `ghost`, `link`;
  aceita `render`.
- **Usa:** tokens `primary`, `secondary`, `destructive`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.
```

- [ ] **Step 8: Fechar a P3 em `.context/pendencias.md`**

Com a ferramenta Edit, em `.context/pendencias.md`, quatro mudanças:

(a) Na tabela do Índice, troque `| P3 | Tamanhos do Button abaixo do alvo mínimo de toque | 🟡 | Aberto, não triado |` por `| P3 | Tamanhos do Button abaixo do alvo mínimo de toque | 🟡 | Resolvido |`.

(b) Na seção `## 1. Aberto, não triado` (a Tarefa 2 já tirou a P9 dali; só resta a P3), troque o bloco inteiro da P3 (até a linha em branco depois dele, inclusive) por `*(nenhuma)*` seguido de uma linha em branco, no padrão das outras seções vazias do arquivo. Bloco a trocar:
```
#### P3 — Tamanhos do Button abaixo do alvo mínimo de toque 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/components/ui/button.tsx:22-32`
**Impacto:** `default` (h-8), `xs`, `sm` e `icon` ficam abaixo de h-9 / 44px no celular
(`ui-rules.md §1.4`) — toque errado na correria do fim de turno.
**Correção:** —
**Registrado em:** 2026-11-20

```
A seção fica assim:
```
## 1. Aberto, não triado

*(nenhuma)*

```

(c) Na seção `## 5. Resolvido`, depois da última Atualização da P1 (`produção ficaram comentadas no `.env.local` — mover para a Vercel e apagar de lá.`) e antes da P4 que a Tarefa 2 acrescentou (a ordem fica P1, P3, P4, P9), acrescente:
```

#### P3 — Tamanhos do Button abaixo do alvo mínimo de toque 🟡
**Estado:** Resolvido
**Arquivos:** `src/components/ui/button.tsx` · `src/components/ui/input.tsx` ·
`src/components/ui/sidebar.tsx` · `src/components/ui/button.test.ts`
**Impacto:** `default` (h-8), `xs`, `sm` e `icon` ficavam abaixo de h-9 / 44px no celular
(`ui-rules.md §1.4`) — toque errado na correria do fim de turno.
**Correção:** cada tamanho do `Button` sobe para h-9 / size-9 no desktop e ganha `max-md:h-11` /
`max-md:size-11` (44px abaixo de `md`); `lg` e `icon-lg` já são 44px. O mesmo vale para o `Input`
(`h-9 max-md:h-11`) e para o `SidebarMenuButton` default.
**Registrado em:** 2026-11-20
**Atualização (2026-11-20):** resolvida na Fase 1. Testes guardam as classes (`button.test.ts`,
`input.test.tsx`, `sidebar.test.tsx`): se um `shadcn add` sobrescrever o arquivo e perder o ajuste,
o teste falha. O modificador `max-md:` sobrevive a overrides de altura em `className` (o `cn`
não o remove). Tamanhos `xs`/`sm`/`icon-xs`/`icon-sm` foram mantidos (usados por `input-group`,
`sheet` e `sidebar`) e também chegam a 44px no celular.
```

(d) Confira:
```bash
sed -n '/^## 1\./,/^## 2\./p' .context/pendencias.md
grep -n "^#### P3 \|^#### P4 \|^#### P9 \|^## 5\." .context/pendencias.md
grep -c "| P3 |" .context/pendencias.md
```
Expected: a seção 1 mostra só `*(nenhuma)*`; as três linhas `#### P3`, `#### P4` e `#### P9` aparecem **depois** de `## 5. Resolvido`; o `grep -c` dá `1`.

- [ ] **Step 9: Verificação completa**

Run: `bun run check-types && bun run lint && bun run test`
Expected: os três verdes (todos os testes das Tasks anteriores + 21 desta tarefa passam).

- [ ] **Step 10: Commit**

```bash
git add biome.json package.json bun.lock test/touchTargets.ts src/components/ui src/hooks .context/ui-registry.md .context/pendencias.md
git commit -F - <<'EOF'
feat(ui): primitivos shadcn da Fase 1 e alvos de toque (P3)

Adiciona sidebar, field, input, label, card, separator, sonner, avatar,
dropdown-menu, tooltip, sheet, skeleton, alert, badge e input-group.
Button, Input e SidebarMenuButton passam a ter h-9 no desktop e 44px
abaixo de md, guardados por testes. Biome ignora regras que o código
gerado do shadcn não respeita, só em src/components/ui.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

---

### Task 4: Schema de auth e convites + domínio de convites

**Files:**
- Create: `src/lib/roles.ts`
- Create: `src/db/schema/auth.ts`
- Create: `src/db/schema/invites.ts`
- Create: `drizzle/0001_auth_e_convites.sql` (gerado por `drizzle-kit`; mais `drizzle/meta/0001_snapshot.json` e a entrada nova em `drizzle/meta/_journal.json`)
- Create: `src/features/invites/token.ts`
- Create: `src/features/invites/inviteState.ts`
- Create: `src/features/invites/inviteUrl.ts`
- Create: `src/features/invites/inviteQueries.ts`
- Create: `test/fixtures.ts`
- Modify: `src/db/schema/index.ts` (acrescentar `export * from "./auth";` e `export * from "./invites";` ao `export * from "./sectors";` da Task 1)
- Modify: `test/db.ts` (trocar `TABLES` pela lista das 8 tabelas)
- Test: `src/lib/roles.test.ts`
- Test: `src/features/invites/token.test.ts`
- Test: `src/features/invites/inviteState.test.ts`
- Test: `src/features/invites/inviteUrl.test.ts`
- Test: `src/features/invites/inviteQueries.test.ts`
- Test (guarda já existente da Task 1, que passa a cobrar as 8 tabelas): `test/db.test.ts`

**Interfaces:**
- Consumes (Task 1): `Db`, `Schema` de `src/db/types.ts`; `sector` de `src/db/schema/sectors.ts`; `createTestDb(): Promise<{ client: PGlite; db: TestDb }>`, `resetDb(client: PGlite): Promise<void>`, `TABLES` de `test/db.ts`; `globalSetup` que migra `./drizzle` (e portanto já aplica a `0001` desta tarefa).
- Produces:
  - `src/lib/roles.ts`: `ROLES`, `type Role`, `isRole(value: unknown): value is Role`.
  - `src/db/schema/auth.ts`: `user`, `session`, `account`, `verification`, `passkey`, `rateLimit`, `userRelations`, `sessionRelations`, `accountRelations`, `passkeyRelations`. `src/db/schema/invites.ts`: `invite`. `src/db/schema/index.ts` reexporta `auth`, `invites`, `sectors`.
  - `src/features/invites/token.ts`: `INVITE_TOKEN_PATTERN`, `generateInviteToken()`, `hashInviteToken(token)`, `isWellFormedInviteToken(value)`.
  - `src/features/invites/inviteState.ts`: `INVITE_TTL_MS`, `type InviteState`, `inviteState(row, now)`.
  - `src/features/invites/inviteUrl.ts`: `buildInviteUrl(baseURL, token)` e, além do contrato, `isHttpUrl(value: string): boolean` (usada pela Task 5).
  - `src/features/invites/inviteQueries.ts`: `CreateInviteInput`, `createInvite`, `InviteDetails`, `findInviteByToken`, `consumeInvite`, `recordInviteUser` (assinaturas exatamente as do contrato).
  - `test/fixtures.ts`: `insertSector(db, name?)`, `insertUser(db, input)`, `insertInvite(db, input?)` (assinaturas do contrato; `insertInvite` aceita chamada sem objeto).

**Por que o schema de auth é escrito à mão (decisão T3).** A CLI `auth generate` do Better Auth precisa importar a configuração do `auth` para saber quais plugins e `additionalFields` existem. Essa configuração depende de `createAuth(db, env)`, que depende do próprio schema que a CLI quer gerar (ciclo), de `server-only` e do alias `@/`. Por isso o arquivo foi gerado uma vez com a CLI 1.7.27 num projeto de experimento, e `src/db/schema/auth.ts` é essa saída copiada **fielmente** (inclui `rate_limit`, `passkey` com a chave TS `credentialID`, e as `relations`), com só estas diferenças do contrato em `user`: `role` usa `ROLES` de `@/lib/roles`; `sectorId` passa de `text` solto a `uuid` com FK para `sector` (`onDelete: "restrict"`); índice `user_sector_id_idx`; check `user_operator_needs_sector`. Quem garante que o schema bate com o que o Better Auth espera é o teste guarda com `getAuthTables` da Task 6; se a versão do Better Auth subir, regere a saída num projeto de experimento e reaplique estas diferenças.

**Por que `isHttpUrl`.** `buildInviteUrl` com `new URL(baseURL).origin` devolveria `"null/convite/…"` quando `baseURL` é `localhost:3000` (sem `http://`), porque `new URL("localhost:3000")` é uma URL válida de esquema `localhost:`. Por isso `inviteUrl.ts` ganha `isHttpUrl` e lança erro para base que não é http(s).

- [ ] **Step 1: Conferir o tipo `Db` da Tarefa 1**

O domínio desta tarefa usa `.insert(...).returning({ ... })` e `.update(...).returning({ ... })`, que só compilam com `Db = PgDatabase<PgQueryResultHKT, Schema>` (T2; a união `NodePgDatabase | PgliteDatabase` dá TS2554).

Run: `grep -n "export type Db" src/db/types.ts`
Expected: `export type Db = PgDatabase<PgQueryResultHKT, Schema>;`. Se aparecer a união, troque por essa linha (com `import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";`) antes de seguir.

- [ ] **Step 2: Write the failing test do `roles`**

Crie `src/lib/roles.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { isRole, ROLES } from "./roles";

describe("isRole", () => {
  it("aceita os papéis conhecidos", () => {
    for (const role of ROLES) {
      expect(isRole(role)).toBe(true);
    }
  });

  it("rejeita papel desconhecido, caixa diferente, vazio e não-string", () => {
    expect(isRole("owner")).toBe(false);
    expect(isRole("Admin")).toBe(false);
    expect(isRole("")).toBe(false);
    expect(isRole(null)).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(1)).toBe(false);
    expect(isRole({ role: "admin" })).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test -- src/lib/roles.test.ts`
Expected: FAIL com `Error: Cannot find module './roles' imported from …/src/lib/roles.test.ts`

- [ ] **Step 4: Write minimal implementation do `roles`**

Crie `src/lib/roles.ts`:

```ts
export const ROLES = ["admin", "operator"] as const;

export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test -- src/lib/roles.test.ts`
Expected: PASS (2 testes)

- [ ] **Step 6: Write the failing test do schema (guarda das tabelas)**

O guarda `test/db.test.ts` (Task 1) compara `TABLES` com `pg_tables` do banco migrado. Primeiro declare as 8 tabelas em `TABLES`. Em `test/db.ts`, troque a constante `TABLES` por:

```ts
export const TABLES: readonly string[] = [
  "sector",
  "user",
  "session",
  "account",
  "verification",
  "passkey",
  "rate_limit",
  "invite",
];
```

- [ ] **Step 7: Run test to verify it fails**

Run: `bun run test -- test/db.test.ts`
Expected: FAIL com `AssertionError: expected [ Array(8) ] to deeply equal [ 'sector' ]` (o banco migrado ainda só tem `sector`)

- [ ] **Step 8: Write minimal implementation do schema**

Crie `src/db/schema/auth.ts` (saída da CLI `auth generate` 1.7.27 + as diferenças da decisão T3: import de `ROLES`, `sectorId`, o índice e o `check` em `user`):

```ts
import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { ROLES } from "@/lib/roles";

import { sector } from "./sectors";

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    role: text("role", { enum: ROLES }).default("operator").notNull(),
    sectorId: uuid("sector_id").references(() => sector.id, {
      onDelete: "restrict",
    }),
    deactivatedAt: timestamp("deactivated_at"),
  },
  (table) => [
    index("user_sector_id_idx").on(table.sectorId),
    check(
      "user_operator_needs_sector",
      sql`${table.role} = 'admin' or ${table.sectorId} is not null`,
    ),
  ],
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const passkey = pgTable(
  "passkey",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    publicKey: text("public_key").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    credentialID: text("credential_id").notNull(),
    counter: integer("counter").notNull(),
    deviceType: text("device_type").notNull(),
    backedUp: boolean("backed_up").notNull(),
    transports: text("transports"),
    createdAt: timestamp("created_at"),
    aaguid: text("aaguid"),
  },
  (table) => [
    index("passkey_userId_idx").on(table.userId),
    index("passkey_credentialID_idx").on(table.credentialID),
  ],
);

export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
  accounts: many(account),
  passkeys: many(passkey),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const passkeyRelations = relations(passkey, ({ one }) => ({
  user: one(user, {
    fields: [passkey.userId],
    references: [user.id],
  }),
}));
```

Crie `src/db/schema/invites.ts`:

```ts
import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { ROLES } from "@/lib/roles";

import { user } from "./auth";
import { sector } from "./sectors";

export const invite = pgTable(
  "invite",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Só o hash SHA-256 do token; o token bruto nunca é gravado.
    tokenHash: text("token_hash").notNull().unique(),
    role: text("role", { enum: ROLES }).notNull(),
    sectorId: uuid("sector_id").references(() => sector.id, {
      onDelete: "restrict",
    }),
    inviteeLabel: text("invitee_label"),
    invitedBy: text("invited_by").references(() => user.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedBy: text("used_by").references(() => user.id, {
      onDelete: "set null",
    }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("invite_sector_id_idx").on(table.sectorId),
    index("invite_invited_by_idx").on(table.invitedBy),
    index("invite_used_by_idx").on(table.usedBy),
    check(
      "invite_operator_needs_sector",
      sql`${table.role} = 'admin' or ${table.sectorId} is not null`,
    ),
  ],
);
```

Substitua `src/db/schema/index.ts` por (a Task 1 só tinha `sectors`):

```ts
export * from "./auth";
export * from "./invites";
export * from "./sectors";
```

- [ ] **Step 9: Gerar a migração e revisar o SQL**

Run: `bunx drizzle-kit generate --name auth_e_convites`
Expected: termina com `[✓] Your SQL migration file ➜ drizzle\0001_auth_e_convites.sql 🚀`, listando as 7 tabelas novas: `account 13 columns 1 indexes 1 fks`, `passkey 11 columns 2 indexes 1 fks`, `rate_limit 4 columns 0 indexes 0 fks`, `session 8 columns 1 indexes 1 fks`, `user 10 columns 1 indexes 1 fks`, `verification 6 columns 1 indexes 0 fks`, `invite 11 columns 3 indexes 3 fks`.

(O `drizzle-kit` resolve o alias `@/lib/roles` do `auth.ts` sem configuração extra; foi verificado.) O arquivo gerado deve ser exatamente este; **revise antes de seguir**:

```sql
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkey" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" text NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer NOT NULL,
	"device_type" text NOT NULL,
	"backed_up" boolean NOT NULL,
	"transports" text,
	"created_at" timestamp,
	"aaguid" text
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"role" text DEFAULT 'operator' NOT NULL,
	"sector_id" uuid,
	"deactivated_at" timestamp,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_operator_needs_sector" CHECK ("user"."role" = 'admin' or "user"."sector_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"role" text NOT NULL,
	"sector_id" uuid,
	"invitee_label" text,
	"invited_by" text,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"used_by" text,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invite_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "invite_operator_needs_sector" CHECK ("invite"."role" = 'admin' or "invite"."sector_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_sector_id_sector_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sector"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_sector_id_sector_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sector"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invite" ADD CONSTRAINT "invite_used_by_user_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_userId_idx" ON "passkey" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "passkey_credentialID_idx" ON "passkey" USING btree ("credential_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_sector_id_idx" ON "user" USING btree ("sector_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "invite_sector_id_idx" ON "invite" USING btree ("sector_id");--> statement-breakpoint
CREATE INDEX "invite_invited_by_idx" ON "invite" USING btree ("invited_by");--> statement-breakpoint
CREATE INDEX "invite_used_by_idx" ON "invite" USING btree ("used_by");
```

O que conferir no SQL (se algo divergir, corrija o schema e gere de novo; nunca edite o `.sql` à mão):
- **FKs:** `user.sector_id` e `invite.sector_id` com `ON DELETE restrict` (setor com gente ou convite não some); `invite.invited_by` e `invite.used_by` com `ON DELETE set null` (apagar a pessoa não apaga o histórico do convite); `session`, `account` e `passkey` com `ON DELETE cascade` (o que a CLI gera).
- **Checks:** `user_operator_needs_sector` e `invite_operator_needs_sector`, os dois no formato `role = 'admin' or sector_id is not null`.
- **Índices:** um para cada FK (`user_sector_id_idx`, `invite_sector_id_idx`, `invite_invited_by_idx`, `invite_used_by_idx`, mais os da CLI: `session_userId_idx`, `account_userId_idx`, `passkey_userId_idx`, `passkey_credentialID_idx`, `verification_identifier_idx`). `invite.token_hash`, `user.email`, `session.token` e `rate_limit.key` ficam com `UNIQUE`.
- **Tipos:** `user.sector_id` é `uuid` (igual a `sector.id`); `user.id` e `invite.invited_by`/`used_by` são `text` (ids do Better Auth); `invite` usa `timestamp with time zone`. Nota: as tabelas do Better Auth usam `timestamp` **sem** fuso (saída fiel da CLI); o `pg` grava e lê `Date` no fuso do processo, então não troque o fuso do ambiente depois que houver dados (ver `contractIssues`).

- [ ] **Step 10: Run test to verify it passes**

Run: `bun run test -- test/db.test.ts`
Expected: PASS (2 testes, os dois de `test/db.test.ts`). O `globalSetup` migra `./drizzle` de novo a cada execução, então a `0001` já vale.

- [ ] **Step 11: Aplicar a migração na branch de dev do Neon**

O `.env.local` aponta para a branch de **dev** (nunca rode isto com a URL de produção).

Run: `bun run db:migrate`
Expected: o `drizzle-kit` lê `drizzle.config.ts`, aplica a `0001_auth_e_convites` e termina sem erro, com a mensagem de sucesso de migrações aplicadas. No console do Neon (branch de dev) devem existir as tabelas `sector`, `user`, `session`, `account`, `verification`, `passkey`, `rate_limit` e `invite`. (A mesma migração já roda no PGlite a cada `bun run test`; este passo é o primeiro contato dela com o Neon.)

- [ ] **Step 12: Write the failing test do `token`**

Crie `src/features/invites/token.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  generateInviteToken,
  hashInviteToken,
  INVITE_TOKEN_PATTERN,
  isWellFormedInviteToken,
} from "./token";

describe("generateInviteToken", () => {
  it("gera token base64url de 43 caracteres e hash sha256 hex de 64", () => {
    const { token, tokenHash } = generateInviteToken();

    expect(token).toHaveLength(43);
    expect(token).toMatch(INVITE_TOKEN_PATTERN);
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("devolve o hash do próprio token", () => {
    const { token, tokenHash } = generateInviteToken();

    expect(hashInviteToken(token)).toBe(tokenHash);
  });

  it("gera tokens e hashes diferentes a cada chamada", () => {
    const tokens = new Set<string>();
    const hashes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const { token, tokenHash } = generateInviteToken();
      tokens.add(token);
      hashes.add(tokenHash);
    }

    expect(tokens.size).toBe(50);
    expect(hashes.size).toBe(50);
  });
});

describe("hashInviteToken", () => {
  it("é determinístico e não devolve o token", () => {
    const token = "a".repeat(43);

    expect(hashInviteToken(token)).toBe(hashInviteToken(token));
    expect(hashInviteToken(token)).not.toContain(token);
  });

  it("muda quando o token muda em um caractere", () => {
    expect(hashInviteToken("a".repeat(43))).not.toBe(
      hashInviteToken(`${"a".repeat(42)}b`),
    );
  });

  it("bate com o vetor conhecido do SHA-256", () => {
    expect(hashInviteToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("isWellFormedInviteToken", () => {
  it("aceita token gerado e os limites do alfabeto base64url", () => {
    expect(isWellFormedInviteToken(generateInviteToken().token)).toBe(true);
    expect(isWellFormedInviteToken("-".repeat(43))).toBe(true);
    expect(isWellFormedInviteToken("_".repeat(43))).toBe(true);
  });

  it("rejeita token curto, longo e vazio", () => {
    expect(isWellFormedInviteToken("a".repeat(42))).toBe(false);
    expect(isWellFormedInviteToken("a".repeat(44))).toBe(false);
    expect(isWellFormedInviteToken("")).toBe(false);
  });

  it("rejeita caracteres fora do alfabeto, inclusive quebra de linha final", () => {
    expect(isWellFormedInviteToken(`${"a".repeat(42)}+`)).toBe(false);
    expect(isWellFormedInviteToken(`${"a".repeat(42)}/`)).toBe(false);
    expect(isWellFormedInviteToken(`${"a".repeat(42)}=`)).toBe(false);
    expect(isWellFormedInviteToken(`${"a".repeat(42)} `)).toBe(false);
    expect(isWellFormedInviteToken(`${"a".repeat(42)}\n`)).toBe(false);
    expect(isWellFormedInviteToken(`${"a".repeat(42)}é`)).toBe(false);
  });

  it("rejeita o que não é string", () => {
    expect(isWellFormedInviteToken(undefined)).toBe(false);
    expect(isWellFormedInviteToken(null)).toBe(false);
    expect(isWellFormedInviteToken(123)).toBe(false);
    expect(isWellFormedInviteToken(["a".repeat(43)])).toBe(false);
    expect(isWellFormedInviteToken({})).toBe(false);
  });
});
```

Run: `bun run test -- src/features/invites/token.test.ts`
Expected: FAIL com `Error: Cannot find module './token' imported from …/token.test.ts`

- [ ] **Step 13: Write minimal implementation do `token`**

Crie `src/features/invites/token.ts`:

```ts
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
```

Run: `bun run test -- src/features/invites/token.test.ts`
Expected: PASS (10 testes)

- [ ] **Step 14: Teste e implementação do `inviteState`**

Crie `src/features/invites/inviteState.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { INVITE_TTL_MS, inviteState } from "./inviteState";

const NOW = new Date("2026-11-20T12:00:00.000Z");
const FUTURE = new Date(NOW.getTime() + 1);
const PAST = new Date(NOW.getTime() - 1);

describe("INVITE_TTL_MS", () => {
  it("é de 7 dias", () => {
    expect(INVITE_TTL_MS).toBe(604_800_000);
  });
});

describe("inviteState", () => {
  it("valid: no futuro, sem uso e sem cancelamento", () => {
    expect(
      inviteState({ expiresAt: FUTURE, usedAt: null, cancelledAt: null }, NOW),
    ).toBe("valid");
  });

  it("expired: no passado", () => {
    expect(
      inviteState({ expiresAt: PAST, usedAt: null, cancelledAt: null }, NOW),
    ).toBe("expired");
  });

  it("expired: expiresAt exatamente igual a now", () => {
    expect(
      inviteState({ expiresAt: NOW, usedAt: null, cancelledAt: null }, NOW),
    ).toBe("expired");
  });

  it("used: usedAt preenchido", () => {
    expect(
      inviteState({ expiresAt: FUTURE, usedAt: PAST, cancelledAt: null }, NOW),
    ).toBe("used");
  });

  it("cancelled: cancelledAt preenchido", () => {
    expect(
      inviteState({ expiresAt: FUTURE, usedAt: null, cancelledAt: PAST }, NOW),
    ).toBe("cancelled");
  });

  it("used vence expired", () => {
    expect(
      inviteState({ expiresAt: PAST, usedAt: PAST, cancelledAt: null }, NOW),
    ).toBe("used");
  });

  it("cancelled vence used e expired", () => {
    expect(
      inviteState({ expiresAt: PAST, usedAt: PAST, cancelledAt: PAST }, NOW),
    ).toBe("cancelled");
    expect(
      inviteState({ expiresAt: FUTURE, usedAt: PAST, cancelledAt: PAST }, NOW),
    ).toBe("cancelled");
  });
});
```

Run: `bun run test -- src/features/invites/inviteState.test.ts`
Expected: FAIL com `Error: Cannot find module './inviteState' imported from …/inviteState.test.ts`

Crie `src/features/invites/inviteState.ts`:

```ts
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type InviteState = "valid" | "expired" | "used" | "cancelled";

// Precedência: cancelled > used > expired > valid. O instante exato de
// expiração já conta como expirado (mesma regra do `expires_at > now` do SQL
// em consumeInvite).
export function inviteState(
  row: { expiresAt: Date; usedAt: Date | null; cancelledAt: Date | null },
  now: Date,
): InviteState {
  if (row.cancelledAt) return "cancelled";
  if (row.usedAt) return "used";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}
```

Run: `bun run test -- src/features/invites/inviteState.test.ts`
Expected: PASS (8 testes)

- [ ] **Step 15: Teste e implementação do `inviteUrl`**

Crie `src/features/invites/inviteUrl.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { buildInviteUrl, isHttpUrl } from "./inviteUrl";

const TOKEN = "t".repeat(43);

describe("buildInviteUrl", () => {
  it("monta o link a partir da origem", () => {
    expect(buildInviteUrl("http://localhost:3000", TOKEN)).toBe(
      `http://localhost:3000/convite/${TOKEN}`,
    );
  });

  it("não duplica a barra quando baseURL termina em /", () => {
    expect(buildInviteUrl("https://closery.example/", TOKEN)).toBe(
      `https://closery.example/convite/${TOKEN}`,
    );
  });

  it("ignora caminho, query e hash de baseURL", () => {
    expect(buildInviteUrl("https://closery.example/app?x=1#y", TOKEN)).toBe(
      `https://closery.example/convite/${TOKEN}`,
    );
  });

  it("lança para baseURL que não é URL http(s) absoluta", () => {
    expect(() => buildInviteUrl("closery.example", TOKEN)).toThrow();
    expect(() => buildInviteUrl("", TOKEN)).toThrow();
    expect(() => buildInviteUrl("localhost:3000", TOKEN)).toThrow(
      "URL base inválida para o convite",
    );
    expect(() => buildInviteUrl("ftp://closery.example", TOKEN)).toThrow();
  });
});

describe("isHttpUrl", () => {
  it("aceita http e https", () => {
    expect(isHttpUrl("http://localhost:3000")).toBe(true);
    expect(isHttpUrl("https://closery.example/x")).toBe(true);
  });

  it("rejeita sem esquema, outros esquemas e lixo", () => {
    expect(isHttpUrl("localhost:3000")).toBe(false);
    expect(isHttpUrl("closery.example")).toBe(false);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("")).toBe(false);
  });
});
```

Run: `bun run test -- src/features/invites/inviteUrl.test.ts`
Expected: FAIL com `Error: Cannot find module './inviteUrl' imported from …/inviteUrl.test.ts`

Crie `src/features/invites/inviteUrl.ts`:

```ts
// "localhost:3000" é uma URL válida para o parser (esquema "localhost:"), mas
// sua origem é "null". Só http(s) serve de base de um link de convite.
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

// Usa só a origem: barra final ou caminho em baseURL não geram "//convite".
export function buildInviteUrl(baseURL: string, token: string): string {
  if (!isHttpUrl(baseURL)) {
    throw new Error(`URL base inválida para o convite: "${baseURL}".`);
  }
  return `${new URL(baseURL).origin}/convite/${token}`;
}
```

Run: `bun run test -- src/features/invites/inviteUrl.test.ts`
Expected: PASS (6 testes)

- [ ] **Step 16: Fixtures de teste**

Crie `test/fixtures.ts` (usado pelos testes de `inviteQueries` e pelas tarefas seguintes). `insertInvite` insere direto na tabela, sem passar por `createInvite`, para montar estados que o domínio não produz sozinho (usado, cancelado, expirado) e usa `generateInviteToken`; os defaults são explícitos: papel `"admin"`, sem setor, sem convidante, válido por 7 dias a partir de `now` (ou de `new Date()`). `insertUser` gera id texto aleatório e e-mail único por padrão (`<id>@example.test`).

```ts
import { randomUUID } from "node:crypto";

import { user } from "@/db/schema/auth";
import { invite } from "@/db/schema/invites";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import type { CreateInviteInput } from "@/features/invites/inviteQueries";
import { INVITE_TTL_MS } from "@/features/invites/inviteState";
import { generateInviteToken } from "@/features/invites/token";
import type { Role } from "@/lib/roles";

export async function insertSector(
  db: Db,
  name = `Setor ${randomUUID().slice(0, 8)}`,
): Promise<{ id: string; name: string }> {
  const [created] = await db
    .insert(sector)
    .values({ name })
    .returning({ id: sector.id, name: sector.name });
  if (!created) throw new Error("fixture: setor não criado");
  return created;
}

export async function insertUser(
  db: Db,
  input: {
    role: Role;
    sectorId: string | null;
    name?: string;
    email?: string;
    deactivatedAt?: Date | null;
  },
): Promise<{ id: string }> {
  const id = randomUUID().replaceAll("-", "");
  const [created] = await db
    .insert(user)
    .values({
      id,
      name: input.name ?? "Pessoa Teste",
      email: input.email ?? `${id}@example.test`,
      role: input.role,
      sectorId: input.sectorId,
      deactivatedAt: input.deactivatedAt ?? null,
    })
    .returning({ id: user.id });
  if (!created) throw new Error("fixture: usuário não criado");
  return created;
}

// Insere direto na tabela (sem passar por createInvite) para poder montar
// estados que o domínio não produz sozinho: usado, cancelado, expirado.
// Defaults explícitos: admin, sem setor, válido por 7 dias a partir de `now`.
export async function insertInvite(
  db: Db,
  input: Partial<CreateInviteInput> & {
    usedAt?: Date | null;
    cancelledAt?: Date | null;
    expiresAt?: Date;
  } = {},
): Promise<{ id: string; token: string }> {
  const { token, tokenHash } = generateInviteToken();
  const now = input.now ?? new Date();
  const [created] = await db
    .insert(invite)
    .values({
      tokenHash,
      role: input.role ?? "admin",
      sectorId: input.sectorId ?? null,
      inviteeLabel: input.inviteeLabel ?? null,
      invitedBy: input.invitedBy ?? null,
      expiresAt: input.expiresAt ?? new Date(now.getTime() + INVITE_TTL_MS),
      usedAt: input.usedAt ?? null,
      cancelledAt: input.cancelledAt ?? null,
    })
    .returning({ id: invite.id });
  if (!created) throw new Error("fixture: convite não criado");
  return { id: created.id, token };
}
```

- [ ] **Step 17: Write the failing test do `inviteQueries`**

Crie `src/features/invites/inviteQueries.test.ts`. Sobre concorrência: o PGlite tem uma conexão só e serializa tudo, então `Promise.all` de dois consumos passaria até com um SELECT+UPDATE não atômico e não prova nada; por isso o arquivo não tem teste de corrida, testa a sequência e a **forma** da query (um único `update`, nenhum `select`). A corrida real só se prova contra Postgres de verdade.

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { invite } from "@/db/schema/invites";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertInvite, insertSector, insertUser } from "../../../test/fixtures";
import {
  consumeInvite,
  createInvite,
  findInviteByToken,
  recordInviteUser,
} from "./inviteQueries";
import { INVITE_TTL_MS } from "./inviteState";
import { generateInviteToken, hashInviteToken } from "./token";

// PGlite é uma conexão só e serializa tudo: Promise.all de dois consumos
// passaria mesmo com um SELECT+UPDATE não atômico, então não prova nada. A
// atomicidade vem de ser um único UPDATE condicional; aqui testamos a
// sequência (segundo consumo devolve null) e a forma da query.

const NOW = new Date("2026-11-20T12:00:00.000Z");
const ONE_MINUTE = 60_000;
const MALFORMED_TOKENS = [
  "",
  "curto",
  "a".repeat(44),
  `${"a".repeat(42)}+`,
  `${"a".repeat(42)}\n`,
];

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
  vi.restoreAllMocks();
});

async function readInvite(id: string) {
  const [row] = await db.select().from(invite).where(eq(invite.id, id));
  if (!row) throw new Error("convite não encontrado");
  return row;
}

describe("createInvite", () => {
  it("cria convite de admin sem setor, válido por 7 dias", async () => {
    const created = await createInvite(db, {
      role: "admin",
      sectorId: null,
      inviteeLabel: null,
      invitedBy: null,
      now: NOW,
    });

    expect(created.expiresAt).toEqual(new Date(NOW.getTime() + INVITE_TTL_MS));
    const row = await readInvite(created.id);
    expect(row.role).toBe("admin");
    expect(row.sectorId).toBeNull();
    expect(row.expiresAt).toEqual(created.expiresAt);
    expect(row.usedAt).toBeNull();
    expect(row.cancelledAt).toBeNull();
  });

  it("cria convite de operador com setor, rótulo e quem convidou", async () => {
    const setor = await insertSector(db);
    const admin = await insertUser(db, { role: "admin", sectorId: null });

    const created = await createInvite(db, {
      role: "operator",
      sectorId: setor.id,
      inviteeLabel: "Turno da manhã",
      invitedBy: admin.id,
      now: NOW,
    });

    const row = await readInvite(created.id);
    expect(row.role).toBe("operator");
    expect(row.sectorId).toBe(setor.id);
    expect(row.inviteeLabel).toBe("Turno da manhã");
    expect(row.invitedBy).toBe(admin.id);
  });

  it("lança para operador sem setor e não grava nada", async () => {
    await expect(
      createInvite(db, {
        role: "operator",
        sectorId: null,
        inviteeLabel: null,
        invitedBy: null,
        now: NOW,
      }),
    ).rejects.toThrow("Convite de operador exige um setor.");

    expect(await db.select().from(invite)).toHaveLength(0);
  });

  it("grava só o hash; o token bruto não aparece em nenhuma coluna", async () => {
    const created = await createInvite(db, {
      role: "admin",
      sectorId: null,
      inviteeLabel: null,
      invitedBy: null,
      now: NOW,
    });

    const row = await readInvite(created.id);
    expect(row.tokenHash).toBe(hashInviteToken(created.token));
    expect(JSON.stringify(row)).not.toContain(created.token);
  });

  it("gera um token diferente a cada convite", async () => {
    const input = {
      role: "admin",
      sectorId: null,
      inviteeLabel: null,
      invitedBy: null,
      now: NOW,
    } as const;

    const first = await createInvite(db, input);
    const second = await createInvite(db, input);

    expect(first.token).not.toBe(second.token);
    expect(first.id).not.toBe(second.id);
  });
});

describe("findInviteByToken", () => {
  it("valid: devolve papel, setor e quem convidou", async () => {
    const setor = await insertSector(db, "ULD");
    const admin = await insertUser(db, {
      role: "admin",
      sectorId: null,
      name: "Admin Teste",
    });
    const { token } = await insertInvite(db, {
      role: "operator",
      sectorId: setor.id,
      invitedBy: admin.id,
      inviteeLabel: "Fulano",
      now: NOW,
    });

    const found = await findInviteByToken(db, token, NOW);

    expect(found).toEqual({
      state: "valid",
      role: "operator",
      sectorName: "ULD",
      inviterName: "Admin Teste",
      inviteeLabel: "Fulano",
      expiresAt: new Date(NOW.getTime() + INVITE_TTL_MS),
    });
  });

  it("convite de admin do script: sectorName e inviterName nulos", async () => {
    const { token } = await insertInvite(db, { now: NOW });

    const found = await findInviteByToken(db, token, NOW);

    expect(found?.state).toBe("valid");
    expect(found?.role).toBe("admin");
    expect(found?.sectorName).toBeNull();
    expect(found?.inviterName).toBeNull();
    expect(found?.inviteeLabel).toBeNull();
  });

  it("expired: expiresAt no passado e exatamente igual a now", async () => {
    const past = await insertInvite(db, {
      expiresAt: new Date(NOW.getTime() - ONE_MINUTE),
    });
    const boundary = await insertInvite(db, { expiresAt: NOW });

    expect((await findInviteByToken(db, past.token, NOW))?.state).toBe(
      "expired",
    );
    expect((await findInviteByToken(db, boundary.token, NOW))?.state).toBe(
      "expired",
    );
  });

  it("used e cancelled", async () => {
    const used = await insertInvite(db, {
      now: NOW,
      usedAt: new Date(NOW.getTime() - ONE_MINUTE),
    });
    const cancelled = await insertInvite(db, {
      now: NOW,
      cancelledAt: new Date(NOW.getTime() - ONE_MINUTE),
    });

    expect((await findInviteByToken(db, used.token, NOW))?.state).toBe("used");
    expect((await findInviteByToken(db, cancelled.token, NOW))?.state).toBe(
      "cancelled",
    );
  });

  it("cancelled vence used quando os dois estão preenchidos", async () => {
    const both = await insertInvite(db, {
      now: NOW,
      usedAt: new Date(NOW.getTime() - ONE_MINUTE),
      cancelledAt: new Date(NOW.getTime() - ONE_MINUTE),
    });

    expect((await findInviteByToken(db, both.token, NOW))?.state).toBe(
      "cancelled",
    );
  });

  it("token bem formado mas inexistente devolve null", async () => {
    await insertInvite(db, { now: NOW });

    expect(
      await findInviteByToken(db, generateInviteToken().token, NOW),
    ).toBeNull();
  });

  it("token malformado devolve null sem consultar o banco", async () => {
    const select = vi.spyOn(db, "select");

    for (const token of MALFORMED_TOKENS) {
      expect(await findInviteByToken(db, token, NOW)).toBeNull();
    }
    expect(select).not.toHaveBeenCalled();
  });

  it("não encontra pelo hash: o hash não serve como token", async () => {
    const { token } = await insertInvite(db, { now: NOW });

    expect(await findInviteByToken(db, hashInviteToken(token), NOW)).toBeNull();
  });
});

describe("consumeInvite", () => {
  it("válido: devolve papel e setor e preenche used_at", async () => {
    const setor = await insertSector(db);
    const { id, token } = await insertInvite(db, {
      role: "operator",
      sectorId: setor.id,
      now: NOW,
    });

    const consumed = await consumeInvite(db, token, NOW);

    expect(consumed).toEqual({ role: "operator", sectorId: setor.id });
    expect((await readInvite(id)).usedAt).toEqual(NOW);
  });

  it("convite de admin devolve sectorId nulo", async () => {
    const { token } = await insertInvite(db, { now: NOW });

    expect(await consumeInvite(db, token, NOW)).toEqual({
      role: "admin",
      sectorId: null,
    });
  });

  it("segundo consumo devolve null e não altera used_at", async () => {
    const { id, token } = await insertInvite(db, { now: NOW });
    const later = new Date(NOW.getTime() + ONE_MINUTE);

    expect(await consumeInvite(db, token, NOW)).not.toBeNull();
    expect(await consumeInvite(db, token, later)).toBeNull();
    expect((await readInvite(id)).usedAt).toEqual(NOW);
  });

  it("expirado, inclusive no instante exato, devolve null e não marca uso", async () => {
    const past = await insertInvite(db, {
      expiresAt: new Date(NOW.getTime() - ONE_MINUTE),
    });
    const boundary = await insertInvite(db, { expiresAt: NOW });

    expect(await consumeInvite(db, past.token, NOW)).toBeNull();
    expect(await consumeInvite(db, boundary.token, NOW)).toBeNull();
    expect((await readInvite(past.id)).usedAt).toBeNull();
    expect((await readInvite(boundary.id)).usedAt).toBeNull();
  });

  it("um milissegundo antes de expirar ainda consome", async () => {
    const { token } = await insertInvite(db, {
      expiresAt: new Date(NOW.getTime() + 1),
    });

    expect(await consumeInvite(db, token, NOW)).not.toBeNull();
  });

  it("cancelado devolve null e não marca uso", async () => {
    const { id, token } = await insertInvite(db, {
      now: NOW,
      cancelledAt: new Date(NOW.getTime() - ONE_MINUTE),
    });

    expect(await consumeInvite(db, token, NOW)).toBeNull();
    expect((await readInvite(id)).usedAt).toBeNull();
  });

  it("inexistente devolve null", async () => {
    expect(
      await consumeInvite(db, generateInviteToken().token, NOW),
    ).toBeNull();
  });

  it("token malformado devolve null sem consultar o banco", async () => {
    const update = vi.spyOn(db, "update");

    for (const token of MALFORMED_TOKENS) {
      expect(await consumeInvite(db, token, NOW)).toBeNull();
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("é um único UPDATE condicional (sem SELECT antes)", async () => {
    const { token } = await insertInvite(db, { now: NOW });
    const select = vi.spyOn(db, "select");
    const update = vi.spyOn(db, "update");

    await consumeInvite(db, token, NOW);

    expect(update).toHaveBeenCalledTimes(1);
    expect(select).not.toHaveBeenCalled();
  });
});

describe("recordInviteUser", () => {
  it("grava used_by uma vez e não sobrescreve", async () => {
    const first = await insertUser(db, { role: "admin", sectorId: null });
    const second = await insertUser(db, { role: "admin", sectorId: null });
    const { id, token } = await insertInvite(db, { now: NOW });

    await recordInviteUser(db, token, first.id);
    await recordInviteUser(db, token, second.id);

    expect((await readInvite(id)).usedBy).toBe(first.id);
  });

  it("token inexistente não altera nada e não lança", async () => {
    const user = await insertUser(db, { role: "admin", sectorId: null });
    const { id } = await insertInvite(db, { now: NOW });

    await recordInviteUser(db, generateInviteToken().token, user.id);

    expect((await readInvite(id)).usedBy).toBeNull();
  });

  it("token malformado não consulta o banco", async () => {
    const update = vi.spyOn(db, "update");

    for (const token of MALFORMED_TOKENS) {
      await recordInviteUser(db, token, "qualquer");
    }
    expect(update).not.toHaveBeenCalled();
  });

  it("fluxo completo: consumir e depois registrar quem usou", async () => {
    const user = await insertUser(db, { role: "admin", sectorId: null });
    const { id, token } = await insertInvite(db, { now: NOW });

    await consumeInvite(db, token, NOW);
    await recordInviteUser(db, token, user.id);

    const row = await readInvite(id);
    expect(row.usedAt).toEqual(NOW);
    expect(row.usedBy).toBe(user.id);
  });
});

describe("constraints do banco", () => {
  function pgCode(error: unknown): string | undefined {
    const source =
      error instanceof Error && error.cause !== undefined ? error.cause : error;
    if (typeof source === "object" && source !== null && "code" in source) {
      return String(source.code);
    }
    return undefined;
  }

  it("invite de operador sem setor viola o check (23514)", async () => {
    const { tokenHash } = generateInviteToken();

    const attempt = db
      .insert(invite)
      .values({
        tokenHash,
        role: "operator",
        sectorId: null,
        expiresAt: new Date(NOW.getTime() + INVITE_TTL_MS),
      })
      .then(
        () => undefined,
        (error: unknown) => error,
      );
    const error = await attempt;

    expect(pgCode(error)).toBe("23514");
  });

  it("user operador sem setor viola o check (23514)", async () => {
    const error = await insertUser(db, {
      role: "operator",
      sectorId: null,
    }).then(
      () => undefined,
      (caught: unknown) => caught,
    );

    expect(pgCode(error)).toBe("23514");
  });

  it("não deixa apagar setor que tem convite (FK restrict, 23001)", async () => {
    const setor = await insertSector(db);
    await insertInvite(db, { role: "operator", sectorId: setor.id, now: NOW });

    const error = await client
      .query("DELETE FROM sector WHERE id = $1", [setor.id])
      .then(
        () => undefined,
        (caught: unknown) => caught,
      );

    expect(pgCode(error)).toBe("23001");
  });

  it("apagar quem convidou mantém o convite (set null)", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const { id } = await insertInvite(db, { invitedBy: admin.id, now: NOW });

    await client.query('DELETE FROM "user" WHERE id = $1', [admin.id]);

    expect((await readInvite(id)).invitedBy).toBeNull();
  });
});
```

- [ ] **Step 18: Run test to verify it fails**

Run: `bun run test -- src/features/invites/inviteQueries.test.ts`
Expected: FAIL com `Error: Cannot find module './inviteQueries' imported from …/inviteQueries.test.ts`

- [ ] **Step 19: Write minimal implementation do `inviteQueries`**

Crie `src/features/invites/inviteQueries.ts`:

```ts
import { and, eq, gt, isNull } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { invite } from "@/db/schema/invites";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import type { Role } from "@/lib/roles";

import { INVITE_TTL_MS, type InviteState, inviteState } from "./inviteState";
import {
  generateInviteToken,
  hashInviteToken,
  isWellFormedInviteToken,
} from "./token";

export type CreateInviteInput = {
  role: Role;
  sectorId: string | null;
  inviteeLabel: string | null;
  invitedBy: string | null;
  now: Date;
};

export async function createInvite(
  db: Db,
  input: CreateInviteInput,
): Promise<{ id: string; token: string; expiresAt: Date }> {
  if (input.role === "operator" && !input.sectorId) {
    throw new Error("Convite de operador exige um setor.");
  }

  const { token, tokenHash } = generateInviteToken();
  const expiresAt = new Date(input.now.getTime() + INVITE_TTL_MS);

  const [created] = await db
    .insert(invite)
    .values({
      tokenHash,
      role: input.role,
      sectorId: input.sectorId,
      inviteeLabel: input.inviteeLabel,
      invitedBy: input.invitedBy,
      expiresAt,
    })
    .returning({ id: invite.id });

  if (!created) {
    throw new Error("Falha ao criar o convite.");
  }

  return { id: created.id, token, expiresAt };
}

export type InviteDetails = {
  state: InviteState;
  role: Role;
  sectorName: string | null;
  inviterName: string | null;
  inviteeLabel: string | null;
  expiresAt: Date;
};

// null = token malformado (sem consultar o banco) ou inexistente.
export async function findInviteByToken(
  db: Db,
  token: string,
  now: Date,
): Promise<InviteDetails | null> {
  if (!isWellFormedInviteToken(token)) return null;

  const [row] = await db
    .select({
      role: invite.role,
      inviteeLabel: invite.inviteeLabel,
      expiresAt: invite.expiresAt,
      usedAt: invite.usedAt,
      cancelledAt: invite.cancelledAt,
      sectorName: sector.name,
      inviterName: user.name,
    })
    .from(invite)
    .leftJoin(sector, eq(invite.sectorId, sector.id))
    .leftJoin(user, eq(invite.invitedBy, user.id))
    .where(eq(invite.tokenHash, hashInviteToken(token)))
    .limit(1);

  if (!row) return null;

  return {
    state: inviteState(row, now),
    role: row.role,
    sectorName: row.sectorName,
    inviterName: row.inviterName,
    inviteeLabel: row.inviteeLabel,
    expiresAt: row.expiresAt,
  };
}

// Consumo atômico: um único UPDATE condicional. A validade e a marcação de uso
// acontecem na mesma instrução, então duas tentativas simultâneas não passam
// as duas. Nunca troque por SELECT seguido de UPDATE.
export async function consumeInvite(
  db: Db,
  token: string,
  now: Date,
): Promise<{ role: Role; sectorId: string | null } | null> {
  if (!isWellFormedInviteToken(token)) return null;

  const [consumed] = await db
    .update(invite)
    .set({ usedAt: now })
    .where(
      and(
        eq(invite.tokenHash, hashInviteToken(token)),
        isNull(invite.usedAt),
        isNull(invite.cancelledAt),
        gt(invite.expiresAt, now),
      ),
    )
    .returning({ role: invite.role, sectorId: invite.sectorId });

  return consumed ?? null;
}

// Grava quem usou o convite. Só preenche uma vez (used_by IS NULL).
export async function recordInviteUser(
  db: Db,
  token: string,
  userId: string,
): Promise<void> {
  if (!isWellFormedInviteToken(token)) return;

  await db
    .update(invite)
    .set({ usedBy: userId })
    .where(
      and(eq(invite.tokenHash, hashInviteToken(token)), isNull(invite.usedBy)),
    );
}
```

- [ ] **Step 20: Run test to verify it passes**

Run: `bun run test -- src/features/invites/inviteQueries.test.ts`
Expected: PASS (30 testes)

Os testes de constraint usam o código SQLSTATE: `23514` (check) e `23001` (restrict; não `23503`, que é o de FK sem `restrict` explícito). O `drizzle-orm` embrulha o erro do driver em `DrizzleQueryError`; o helper `pgCode` do teste lê o código em `error.cause` e também aceita o erro sem embrulho (`client.query` direto).

- [ ] **Step 21: Verificação completa**

Run: `bun run format && bun run check-types && bun run lint && bun run test`
Expected: `check-types` e `lint` sem erros; vitest todo verde. Os arquivos desta tarefa somam 58 testes (roles 2, token 10, inviteState 8, inviteUrl 6, inviteQueries 30, guarda de tabelas 2); o total do projeto é a soma com os testes das tarefas anteriores.

- [ ] **Step 22: Commit**

```bash
git add src/lib/roles.ts src/lib/roles.test.ts src/db/schema/auth.ts src/db/schema/invites.ts src/db/schema/index.ts drizzle test/db.ts test/fixtures.ts src/features/invites/token.ts src/features/invites/token.test.ts src/features/invites/inviteState.ts src/features/invites/inviteState.test.ts src/features/invites/inviteUrl.ts src/features/invites/inviteUrl.test.ts src/features/invites/inviteQueries.ts src/features/invites/inviteQueries.test.ts
git commit -F - <<'EOF'
feat(convites): schema de auth e convites e domínio de convites

Schema do Better Auth copiado da CLI 1.7.27 (user.sector_id uuid com FK e
check de operador sem setor), tabela invite, token com hash SHA-256,
estado do convite, consumo atômico por UPDATE condicional e fixtures.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 5: Script `admin:invite`

**Files:**
- Create: `src/features/invites/adminInvite.ts`
- Create: `scripts/adminInvite.ts`
- Modify: `package.json` (em `scripts`, acrescentar `"admin:invite": "bun scripts/adminInvite.ts"`)
- Test: `src/features/invites/adminInvite.test.ts`

**Interfaces:**
- Consumes (Task 4): `createInvite(db: Db, input: CreateInviteInput)`, `buildInviteUrl(baseURL, token)`, `isHttpUrl(value)`, `INVITE_TTL_MS`; `findInviteByToken`, `consumeInvite` (só nos testes); (Task 1) `createTestDb`, `resetDb`, `TestDb`, `createPool(connectionString): Pool`, `createDb(pool)` de `src/db/client.ts`, `resolveDatabaseUrls(env)` de `src/db/databaseUrl.ts`.
- Produces:
  - `parseAdminInviteArgs(argv: string[]): { label: string | null }` (lança `Error` em pt-BR)
  - `createAdminInvite(db: Db, input: { label: string | null; baseURL: string; now: Date }): Promise<{ url: string; expiresAt: Date }>`
  - Além do contrato: `ADMIN_INVITE_LABEL_MAX_LENGTH = 80` e `formatAdminInviteOutput(result: { url: string; expiresAt: Date }): string` (o texto que o script imprime, testável sem rodar o script).
  - Comando `bun run admin:invite [--label "Nome"]`.

O script importa **só** módulos sem `server-only` (`@/db/client`, `@/db/databaseUrl`, `@/features/invites/*`); `src/db/index.ts` (com `server-only`) nunca é importado aqui. O alias `@/` funciona no Bun lendo o `tsconfig.json`. `@next/env` já é devDependency do projeto.

- [ ] **Step 1: Write the failing test**

Crie `src/features/invites/adminInvite.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { invite } from "@/db/schema/invites";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  ADMIN_INVITE_LABEL_MAX_LENGTH,
  createAdminInvite,
  formatAdminInviteOutput,
  parseAdminInviteArgs,
} from "./adminInvite";
import { consumeInvite, findInviteByToken } from "./inviteQueries";
import { INVITE_TTL_MS } from "./inviteState";
import { hashInviteToken } from "./token";

const NOW = new Date("2026-11-20T12:00:00.000Z");

describe("parseAdminInviteArgs", () => {
  it("sem argumentos: label nulo", () => {
    expect(parseAdminInviteArgs([])).toEqual({ label: null });
  });

  it("aceita --label Nome e --label=Nome", () => {
    expect(parseAdminInviteArgs(["--label", "Dono do sistema"])).toEqual({
      label: "Dono do sistema",
    });
    expect(parseAdminInviteArgs(["--label=Dono do sistema"])).toEqual({
      label: "Dono do sistema",
    });
  });

  it("apara espaços e trata vazio como nulo", () => {
    expect(parseAdminInviteArgs(["--label", "  Nome  "])).toEqual({
      label: "Nome",
    });
    expect(parseAdminInviteArgs(["--label="])).toEqual({ label: null });
    expect(parseAdminInviteArgs(["--label", "   "])).toEqual({ label: null });
  });

  it("preserva '=' e unicode dentro do valor", () => {
    expect(parseAdminInviteArgs(["--label=a=b ção"])).toEqual({
      label: "a=b ção",
    });
  });

  it("aceita exatamente o tamanho máximo e rejeita um a mais", () => {
    const max = "x".repeat(ADMIN_INVITE_LABEL_MAX_LENGTH);

    expect(parseAdminInviteArgs([`--label=${max}`])).toEqual({ label: max });
    expect(() => parseAdminInviteArgs([`--label=${max}x`])).toThrow(
      `--label aceita no máximo ${ADMIN_INVITE_LABEL_MAX_LENGTH} caracteres.`,
    );
  });

  it("argumento desconhecido lança Error em português", () => {
    expect(() => parseAdminInviteArgs(["--foo"])).toThrow(
      "Argumento desconhecido: --foo.",
    );
    expect(() => parseAdminInviteArgs(["Nome"])).toThrow(
      "Argumento desconhecido: Nome.",
    );
    expect(() => parseAdminInviteArgs(["--label", "a", "extra"])).toThrow(
      "Argumento desconhecido: extra.",
    );
  });

  it("--label sem valor lança", () => {
    expect(() => parseAdminInviteArgs(["--label"])).toThrow(
      "Falta o valor de --label.",
    );
  });

  it("--label repetido lança", () => {
    expect(() => parseAdminInviteArgs(["--label=a", "--label=b"])).toThrow(
      "--label foi informado mais de uma vez.",
    );
  });
});

describe("formatAdminInviteOutput", () => {
  it("mostra o link e a validade no horário de Brasília", () => {
    const text = formatAdminInviteOutput({
      url: "http://localhost:3000/convite/abc",
      expiresAt: new Date("2026-11-27T15:30:00.000Z"),
    });

    expect(text).toContain("Convite de administrador criado.");
    expect(text).toContain("Link: http://localhost:3000/convite/abc");
    expect(text).toMatch(
      /Válido até: 27\/11\/2026,? 12:30 \(horário de Brasília\)/,
    );
  });
});

describe("createAdminInvite", () => {
  let client: PGlite;
  let db: TestDb;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    await resetDb(client);
  });

  it("cria convite de admin e devolve link e validade de 7 dias", async () => {
    const result = await createAdminInvite(db, {
      label: "Dono do sistema",
      baseURL: "http://localhost:3000",
      now: NOW,
    });

    expect(result.expiresAt).toEqual(new Date(NOW.getTime() + INVITE_TTL_MS));
    expect(result.url).toMatch(
      /^http:\/\/localhost:3000\/convite\/[A-Za-z0-9_-]{43}$/,
    );
  });

  it("o link devolvido abre um convite válido de admin, sem setor nem convidante", async () => {
    const result = await createAdminInvite(db, {
      label: "Dono do sistema",
      baseURL: "http://localhost:3000/",
      now: NOW,
    });
    const token = result.url.split("/convite/")[1] ?? "";

    expect(await findInviteByToken(db, token, NOW)).toEqual({
      state: "valid",
      role: "admin",
      sectorName: null,
      inviterName: null,
      inviteeLabel: "Dono do sistema",
      expiresAt: result.expiresAt,
    });
    expect(await consumeInvite(db, token, NOW)).toEqual({
      role: "admin",
      sectorId: null,
    });
  });

  it("grava só o hash do token do link", async () => {
    const result = await createAdminInvite(db, {
      label: null,
      baseURL: "https://closery.example",
      now: NOW,
    });
    const token = result.url.split("/convite/")[1] ?? "";

    const rows = await db.select().from(invite);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).toBe(hashInviteToken(token));
    expect(JSON.stringify(rows)).not.toContain(token);
    expect(rows[0]?.inviteeLabel).toBeNull();
  });

  it("dois convites seguidos geram links diferentes", async () => {
    const input = { label: null, baseURL: "http://localhost:3000", now: NOW };

    const first = await createAdminInvite(db, input);
    const second = await createAdminInvite(db, input);

    expect(first.url).not.toBe(second.url);
    expect(await db.select().from(invite)).toHaveLength(2);
  });

  it("baseURL inválida lança em português e não grava convite", async () => {
    await expect(
      createAdminInvite(db, {
        label: null,
        baseURL: "localhost:3000 sem esquema",
        now: NOW,
      }),
    ).rejects.toThrow("BETTER_AUTH_URL não é uma URL absoluta");

    expect(
      await db.select().from(invite).where(eq(invite.role, "admin")),
    ).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/features/invites/adminInvite.test.ts`
Expected: FAIL com `Error: Cannot find module './adminInvite' imported from …/adminInvite.test.ts`

- [ ] **Step 3: Write minimal implementation (núcleo testável)**

Crie `src/features/invites/adminInvite.ts`. Pontos de projeto: a URL base é validada **antes** de gravar o convite (senão um `BETTER_AUTH_URL` ruim criaria um convite sem link imprimível); `--label` vazio vira `null`; `--label` repetido, sem valor ou acima de 80 caracteres lança erro.

```ts
import type { Db } from "@/db/types";

import { createInvite } from "./inviteQueries";
import { buildInviteUrl, isHttpUrl } from "./inviteUrl";

export const ADMIN_INVITE_LABEL_MAX_LENGTH = 80;

const USAGE = 'Uso: bun run admin:invite [--label "Nome de referência"]';

export function parseAdminInviteArgs(argv: string[]): {
  label: string | null;
} {
  let label: string | null = null;
  let labelSeen = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    let value: string;

    if (arg === "--label") {
      const next = argv[i + 1];
      if (next === undefined) {
        throw new Error(`Falta o valor de --label. ${USAGE}`);
      }
      value = next;
      i++;
    } else if (arg.startsWith("--label=")) {
      value = arg.slice("--label=".length);
    } else {
      throw new Error(`Argumento desconhecido: ${arg}. ${USAGE}`);
    }

    if (labelSeen) {
      throw new Error(`--label foi informado mais de uma vez. ${USAGE}`);
    }
    labelSeen = true;

    const trimmed = value.trim();
    if (trimmed.length > ADMIN_INVITE_LABEL_MAX_LENGTH) {
      throw new Error(
        `--label aceita no máximo ${ADMIN_INVITE_LABEL_MAX_LENGTH} caracteres.`,
      );
    }
    label = trimmed === "" ? null : trimmed;
  }

  return { label };
}

export async function createAdminInvite(
  db: Db,
  input: { label: string | null; baseURL: string; now: Date },
): Promise<{ url: string; expiresAt: Date }> {
  // Valida a URL antes de gravar: senão o convite nasceria sem link imprimível.
  if (!isHttpUrl(input.baseURL)) {
    throw new Error(
      `BETTER_AUTH_URL não é uma URL absoluta (ex.: http://localhost:3000): "${input.baseURL}".`,
    );
  }

  const { token, expiresAt } = await createInvite(db, {
    role: "admin",
    sectorId: null,
    inviteeLabel: input.label,
    invitedBy: null,
    now: input.now,
  });

  return { url: buildInviteUrl(input.baseURL, token), expiresAt };
}

export function formatAdminInviteOutput(result: {
  url: string;
  expiresAt: Date;
}): string {
  const expires = result.expiresAt.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });

  return [
    "Convite de administrador criado.",
    "",
    `Link: ${result.url}`,
    `Válido até: ${expires} (horário de Brasília)`,
    "",
    "O link vale para uma conta só e não é exibido de novo: copie agora.",
  ].join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- src/features/invites/adminInvite.test.ts`
Expected: PASS (14 testes)

- [ ] **Step 5: Escrever o script e registrar o comando**

Crie `scripts/adminInvite.ts`:

```ts
import { loadEnvConfig } from "@next/env";

import { createDb, createPool } from "@/db/client";
import { resolveDatabaseUrls } from "@/db/databaseUrl";
import {
  createAdminInvite,
  formatAdminInviteOutput,
  parseAdminInviteArgs,
} from "@/features/invites/adminInvite";

// Roda fora do Next: carrega .env/.env.local com as mesmas regras e importa só
// módulos sem `server-only`.
async function main(): Promise<void> {
  loadEnvConfig(process.cwd());

  const { label } = parseAdminInviteArgs(process.argv.slice(2));

  const baseURL = process.env.BETTER_AUTH_URL;
  if (!baseURL) {
    throw new Error(
      "BETTER_AUTH_URL ausente: adicione BETTER_AUTH_URL=http://localhost:3000 ao .env.local (em produção, a URL pública do app).",
    );
  }

  const connectionString = resolveDatabaseUrls(process.env).runtime;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL ausente: copie .env.example para .env.local e preencha com as connection strings do Neon.",
    );
  }

  const pool = createPool(connectionString);
  try {
    const result = await createAdminInvite(createDb(pool), {
      label,
      baseURL,
      now: new Date(),
    });
    console.log(formatAdminInviteOutput(result));
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Erro: ${message}`);
  process.exitCode = 1;
});
```

Em `package.json`, dentro de `"scripts"`, acrescente a linha (depois de `"db:studio"`, lembrando da vírgula na linha anterior):

```json
"admin:invite": "bun scripts/adminInvite.ts"
```

- [ ] **Step 6: Verificar os caminhos de erro do script (sem banco)**

Estes três erram antes de abrir qualquer conexão. Rode com `BETTER_AUTH_URL` ausente do ambiente e do `.env.local` (a Task 6 é quem o cria; se você já o definiu, remova-o para este passo).

Run: `bun run admin:invite --foo`
Expected: `Erro: Argumento desconhecido: --foo. Uso: bun run admin:invite [--label "Nome de referência"]` e código de saída 1 (`echo $?` imprime `1`).

Run: `bun run admin:invite`
Expected (sem `BETTER_AUTH_URL`): `Erro: BETTER_AUTH_URL ausente: adicione BETTER_AUTH_URL=http://localhost:3000 ao .env.local (em produção, a URL pública do app).` e código 1.

Run: `BETTER_AUTH_URL=localhost:3000 bun run admin:invite`
Expected: `Erro: BETTER_AUTH_URL não é uma URL absoluta (ex.: http://localhost:3000): "localhost:3000".` e código 1, sem criar convite.

(As três mensagens foram conferidas com um banco PGlite servido por socket.)

- [ ] **Step 7: Passo manual contra a branch de dev do Neon**

Se a Task 6 ainda não rodou, o `.env.local` não tem `BETTER_AUTH_URL`: acrescente a linha `BETTER_AUTH_URL=http://localhost:3000` ao `.env.local` (arquivo ignorado pelo git; a Task 6 também a define, então confira para não duplicar). A migração da Task 4 já precisa ter sido aplicada na dev (`bun run db:migrate`).

Run: `bun run admin:invite --label "Dono do sistema"`
Expected: código de saída 0 e o processo termina sozinho (o pool é fechado). O token muda a cada execução; a validade é 7 dias à frente, em horário de Brasília:

```
Convite de administrador criado.

Link: http://localhost:3000/convite/H74aupIEwzCT_kHH97upOpxyx9HiTefxLHjy1R5FVqk
Válido até: 27/11/2026, 17:01 (horário de Brasília)

O link vale para uma conta só e não é exibido de novo: copie agora.
```

O token tem 43 caracteres. Para conferir no banco (Neon, branch de dev): `SELECT role, sector_id, invitee_label, invited_by, expires_at, used_at FROM invite ORDER BY created_at DESC LIMIT 1;` deve mostrar `admin`, `NULL`, `Dono do sistema`, `NULL`, a validade e `NULL`. A página `/convite/<token>` só abre depois da Task 9.

- [ ] **Step 8: Verificação completa**

Run: `bun run format && bun run check-types && bun run lint && bun run test`
Expected: `check-types` e `lint` sem erros; os arquivos de teste desta tarefa passam com 14 testes (o total do projeto é a soma com as Tasks anteriores).

- [ ] **Step 9: Commit**

```bash
git add src/features/invites/adminInvite.ts src/features/invites/adminInvite.test.ts scripts/adminInvite.ts package.json
git commit -F - <<'EOF'
feat(convites): script admin:invite para o primeiro convite de admin

Núcleo testável (parse de argumentos, criação do convite e texto de saída) em
src/features/invites e script que carrega o .env, exige BETTER_AUTH_URL,
cria o convite e imprime o link com a validade.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 6: Better Auth (`createAuth`, portão do convite, rota, cliente e mensagens)

**Files:**
- Create: `src/lib/auth/env.ts`
- Create: `src/lib/auth/inviteCookie.ts`
- Create: `src/lib/auth/errors.ts`
- Create: `src/lib/auth/createAuth.ts`
- Create: `src/lib/auth/index.ts`
- Create: `src/lib/auth/client.ts`
- Create: `src/app/api/auth/[...all]/route.ts`
- Create: `test/auth.ts`
- Modify: `package.json` e `bun.lock` (via `bun add`, Step 1)
- Modify: `.env.example` (acrescentar o bloco de autenticação ao fim)
- Modify (só local, nunca commitado): `.env.local` (acrescentar `BETTER_AUTH_SECRET` e `BETTER_AUTH_URL`)
- Test: `src/lib/auth/env.test.ts`
- Test: `src/lib/auth/inviteCookie.test.ts`
- Test: `src/lib/auth/errors.test.ts`
- Test: `src/lib/auth/errorCodesContract.test.ts`
- Test: `src/lib/auth/createAuth.test.ts`
- Test: `src/lib/auth/schemaGuard.test.ts`
- Test: `src/lib/auth/clientTypes.test.ts` (teste de tipos, verificado por `bun run check-types`)

**Interfaces:**
- Consumes (Tarefa 1): `createTestDb(): Promise<{ client: PGlite; db: TestDb }>`, `resetDb(client: PGlite): Promise<void>`, `type TestDb` de `test/db.ts`; `insertSector`, `insertUser`, `insertInvite` de `test/fixtures.ts`; o projeto `node` do Vitest (`globalSetup` migra `./drizzle` uma vez).
- Consumes (Tarefa 4): `import * as schema from "@/db/schema"` (tabelas `user`, `session`, `account`, `verification`, `passkey`, `rateLimit`, `invite`, `sector`); `consumeInvite(db: Db, token: string, now: Date): Promise<{ role: Role; sectorId: string | null } | null>` e `recordInviteUser(db: Db, token: string, userId: string): Promise<void>` de `@/features/invites/inviteQueries`; `type Db` de `@/db/types`; `src/db/index.ts` exportando `db`.
- Produces: `parseAuthEnv(env: Record<string, string | undefined>): AuthEnv`, `enabledSocialProviders(env: AuthEnv): SocialProvider[]`, `type AuthEnv`, `type SocialProvider` (`src/lib/auth/env.ts`); `INVITE_COOKIE`, `INVITE_COOKIE_MAX_AGE_SECONDS`, `inviteCookieOptions(isProduction: boolean)` (`inviteCookie.ts`); `AUTH_ERROR_MESSAGES`, `FALLBACK_AUTH_ERROR`, `authErrorMessage(code: string | null | undefined): string` (`errors.ts`); `createAuth(db: Db, env: AuthEnv)` (retorno **inferido**, ver observação abaixo), `type Auth = ReturnType<typeof createAuth>`, `AUTH_USER_ADDITIONAL_FIELDS` (`createAuth.ts`); `auth`, `authEnv` (`index.ts`, `server-only`); `authClient` (`client.ts`); `TEST_AUTH_ENV`, `createTestAuth(db: Db, env?: Partial<AuthEnv>): Auth`, `signUpWithInvite(auth: Auth, token: string | null, input: { name: string; email: string; password: string }): Promise<unknown>`, `sessionCookieOf(headers: Headers): string` (`test/auth.ts`).

> **Desvio do contrato (já validado no clone):** `createAuth` **não** anota o retorno como `ReturnType<typeof betterAuth>`. Essa anotação nem compila (`Auth<{...}>` não é atribuível a `Auth<BetterAuthOptions>`) e, mesmo se compilasse, apagaria `role`/`sectorId` do tipo que `inferAdditionalFields<Auth>()` lê no cliente. O tipo `Auth = ReturnType<typeof createAuth>` continua igual para quem consome.

> **Decisões desta tarefa que o contrato não fixava:** (a) `account.accountLinking.disableImplicitLinking: true`: o convite marca o e-mail como verificado, então vincular login social a conta existente pelo e-mail abriria tomada de conta; quem tem conta entra "como da primeira vez" (`account_not_linked`, já no mapa de mensagens). (b) `parseAuthEnv` devolve `baseURL` normalizada para a **origem** (`https://closery.app/` vira `https://closery.app`), porque `trustedOrigins` e o `origin` do passkey comparam por origem exata.

- [ ] **Step 1: Instalar as dependências**

```bash
bun add better-auth@1.7.27 @better-auth/passkey@1.7.27 @better-auth/core@1.7.27 "zod@^4"
```
Expected: `installed better-auth@1.7.27`, `installed @better-auth/passkey@1.7.27`, `installed @better-auth/core@1.7.27`, `installed zod@4.x.x`. Confira com `grep -E '"(better-auth|@better-auth/[a-z]+|zod)"' package.json`: as três do Better Auth ficam **sem `^`** (versão exata) e `zod` fica `"^4"`.

- [ ] **Step 2: Write the failing test (`env`)**

Crie `src/lib/auth/env.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import { enabledSocialProviders, parseAuthEnv } from "./env";

const SECRET = "x".repeat(32);

const VALID = {
  BETTER_AUTH_SECRET: SECRET,
  BETTER_AUTH_URL: "http://localhost:3000",
};

describe("parseAuthEnv", () => {
  it("aceita o mínimo e deixa os provedores sociais como null", () => {
    expect(parseAuthEnv(VALID)).toEqual({
      secret: SECRET,
      baseURL: "http://localhost:3000",
      google: null,
      facebook: null,
    });
  });

  it("normaliza a URL para a origem (sem barra final nem caminho)", () => {
    const env = parseAuthEnv({
      ...VALID,
      BETTER_AUTH_URL: "https://closery.app/",
    });
    expect(env.baseURL).toBe("https://closery.app");
  });

  it("falha dizendo que BETTER_AUTH_SECRET está ausente", () => {
    expect(() =>
      parseAuthEnv({ BETTER_AUTH_URL: VALID.BETTER_AUTH_URL }),
    ).toThrow(/BETTER_AUTH_SECRET.*ausente/);
  });

  it("trata string vazia como ausente", () => {
    expect(() => parseAuthEnv({ ...VALID, BETTER_AUTH_SECRET: "" })).toThrow(
      /BETTER_AUTH_SECRET.*ausente/,
    );
    expect(() => parseAuthEnv({ ...VALID, BETTER_AUTH_SECRET: "   " })).toThrow(
      /BETTER_AUTH_SECRET.*ausente/,
    );
  });

  it("recusa secret com menos de 32 caracteres (limite: 31 falha, 32 passa)", () => {
    expect(() =>
      parseAuthEnv({ ...VALID, BETTER_AUTH_SECRET: "x".repeat(31) }),
    ).toThrow(/BETTER_AUTH_SECRET.*32 caracteres/);
    expect(
      parseAuthEnv({ ...VALID, BETTER_AUTH_SECRET: "x".repeat(32) }).secret,
    ).toHaveLength(32);
  });

  it("falha quando BETTER_AUTH_URL está ausente", () => {
    expect(() => parseAuthEnv({ BETTER_AUTH_SECRET: SECRET })).toThrow(
      /BETTER_AUTH_URL.*ausente/,
    );
  });

  it.each([
    "not-a-url",
    "localhost:3000",
    "ftp://closery.app",
    "javascript:alert(1)",
  ])("recusa BETTER_AUTH_URL inválida: %s", (value) => {
    expect(() => parseAuthEnv({ ...VALID, BETTER_AUTH_URL: value })).toThrow(
      /BETTER_AUTH_URL/,
    );
  });

  it("lista todos os problemas de uma vez", () => {
    expect(() => parseAuthEnv({})).toThrow(
      /BETTER_AUTH_SECRET[\s\S]*BETTER_AUTH_URL/,
    );
  });

  it("habilita Google quando id e secret estão completos", () => {
    const env = parseAuthEnv({
      ...VALID,
      GOOGLE_CLIENT_ID: "gid",
      GOOGLE_CLIENT_SECRET: "gsecret",
    });
    expect(env.google).toEqual({ clientId: "gid", clientSecret: "gsecret" });
    expect(env.facebook).toBeNull();
    expect(enabledSocialProviders(env)).toEqual(["google"]);
  });

  it("habilita os dois provedores, na ordem google, facebook", () => {
    const env = parseAuthEnv({
      ...VALID,
      GOOGLE_CLIENT_ID: "gid",
      GOOGLE_CLIENT_SECRET: "gsecret",
      FACEBOOK_CLIENT_ID: "fid",
      FACEBOOK_CLIENT_SECRET: "fsecret",
    });
    expect(enabledSocialProviders(env)).toEqual(["google", "facebook"]);
  });

  it("sem nenhum provedor, enabledSocialProviders é vazio", () => {
    expect(enabledSocialProviders(parseAuthEnv(VALID))).toEqual([]);
  });

  it("recusa par incompleto: só o id do Google", () => {
    expect(() => parseAuthEnv({ ...VALID, GOOGLE_CLIENT_ID: "gid" })).toThrow(
      /GOOGLE_CLIENT_SECRET.*ausente/,
    );
  });

  it("recusa par incompleto: só o secret do Facebook", () => {
    expect(() =>
      parseAuthEnv({ ...VALID, FACEBOOK_CLIENT_SECRET: "fsecret" }),
    ).toThrow(/FACEBOOK_CLIENT_ID.*ausente/);
  });

  it("par com um lado vazio conta como incompleto", () => {
    expect(() =>
      parseAuthEnv({
        ...VALID,
        GOOGLE_CLIENT_ID: "gid",
        GOOGLE_CLIENT_SECRET: "",
      }),
    ).toThrow(/GOOGLE_CLIENT_SECRET.*ausente/);
  });

  it("par totalmente vazio conta como provedor desligado", () => {
    const env = parseAuthEnv({
      ...VALID,
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    });
    expect(env.google).toBeNull();
  });

  it("a mensagem de erro nunca contém o valor do secret", () => {
    const secret = "curto-demais-mas-sigiloso";
    try {
      parseAuthEnv({ ...VALID, BETTER_AUTH_SECRET: secret });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain(secret);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test src/lib/auth/env.test.ts`
Expected: FAIL com `Cannot find module './env'`

- [ ] **Step 4: Write minimal implementation (`env`)**

Crie `src/lib/auth/env.ts`:
```ts
import { z } from "zod";

export type SocialProvider = "google" | "facebook";

export type AuthEnv = {
  secret: string;
  baseURL: string;
  google: { clientId: string; clientSecret: string } | null;
  facebook: { clientId: string; clientSecret: string } | null;
};

type RawEnv = Record<string, string | undefined>;

// Variável vazia ("FOO=") é o mesmo que ausente.
const blankAsMissing = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = z.preprocess(blankAsMissing, z.string().optional());

const authEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.preprocess(
    blankAsMissing,
    z
      .string({ error: "ausente" })
      .min(32, "precisa ter pelo menos 32 caracteres"),
  ),
  BETTER_AUTH_URL: z.preprocess(
    blankAsMissing,
    z.string({ error: "ausente" }).pipe(
      z.url({
        protocol: /^https?$/,
        error:
          "precisa ser uma URL absoluta http(s), ex.: http://localhost:3000",
      }),
    ),
  ),
  GOOGLE_CLIENT_ID: optionalText,
  GOOGLE_CLIENT_SECRET: optionalText,
  FACEBOOK_CLIENT_ID: optionalText,
  FACEBOOK_CLIENT_SECRET: optionalText,
});

function pair(
  idName: string,
  secretName: string,
  id: string | undefined,
  secret: string | undefined,
  problems: string[],
): { clientId: string; clientSecret: string } | null {
  if (id && secret) return { clientId: id, clientSecret: secret };
  if (id && !secret)
    problems.push(`${secretName}: ausente (${idName} foi informado)`);
  if (!id && secret)
    problems.push(`${idName}: ausente (${secretName} foi informado)`);
  return null;
}

// Lança Error em pt-BR listando tudo que está errado. Nunca inclui o valor das
// variáveis na mensagem (o secret não pode vazar para log).
export function parseAuthEnv(env: RawEnv): AuthEnv {
  const parsed = authEnvSchema.safeParse(env);
  const problems: string[] = [];

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const name = String(issue.path[0] ?? "ambiente");
      problems.push(`${name}: ${issue.message}`);
    }
  }

  const data = parsed.success ? parsed.data : null;
  const google = pair(
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    data?.GOOGLE_CLIENT_ID,
    data?.GOOGLE_CLIENT_SECRET,
    problems,
  );
  const facebook = pair(
    "FACEBOOK_CLIENT_ID",
    "FACEBOOK_CLIENT_SECRET",
    data?.FACEBOOK_CLIENT_ID,
    data?.FACEBOOK_CLIENT_SECRET,
    problems,
  );

  if (!data || problems.length > 0) {
    throw new Error(
      `Variáveis de ambiente de autenticação inválidas:\n${problems
        .map((problem) => `- ${problem}`)
        .join("\n")}\nVeja .env.example.`,
    );
  }

  return {
    secret: data.BETTER_AUTH_SECRET,
    baseURL: new URL(data.BETTER_AUTH_URL).origin,
    google,
    facebook,
  };
}

export function enabledSocialProviders(env: AuthEnv): SocialProvider[] {
  const providers: SocialProvider[] = [];
  if (env.google) providers.push("google");
  if (env.facebook) providers.push("facebook");
  return providers;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test src/lib/auth/env.test.ts`
Expected: PASS (19 testes)

- [ ] **Step 6: Write the failing tests (`inviteCookie`, `errors` e contrato dos códigos)**

Crie `src/lib/auth/inviteCookie.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import {
  INVITE_COOKIE,
  INVITE_COOKIE_MAX_AGE_SECONDS,
  inviteCookieOptions,
} from "./inviteCookie";

describe("inviteCookie", () => {
  it("usa o nome fixo do contrato e dura 1 hora", () => {
    expect(INVITE_COOKIE).toBe("closery_invite");
    expect(INVITE_COOKIE_MAX_AGE_SECONDS).toBe(3600);
  });

  it("em produção: httpOnly, lax, secure, path / e maxAge de 1 h", () => {
    expect(inviteCookieOptions(true)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 3600,
    });
  });

  it("fora de produção: secure desligado (http://localhost)", () => {
    expect(inviteCookieOptions(false).secure).toBe(false);
  });

  it("nunca é Strict (o retorno do OAuth não levaria o cookie)", () => {
    expect(inviteCookieOptions(true).sameSite).toBe("lax");
    expect(inviteCookieOptions(false).sameSite).toBe("lax");
  });
});
```

Crie `src/lib/auth/errors.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import {
  AUTH_ERROR_MESSAGES,
  authErrorMessage,
  FALLBACK_AUTH_ERROR,
} from "./errors";

const EXPECTED: ReadonlyArray<readonly [string, string]> = [
  [
    "SIGNUP_INVITE_ONLY",
    "O cadastro é só por convite. Abra de novo o link que você recebeu.",
  ],
  ["signup_disabled", "Conta não encontrada. Peça um convite."],
  [
    "ACCOUNT_DEACTIVATED",
    "Esta conta foi desativada. Fale com o administrador.",
  ],
  [
    "USER_ALREADY_EXISTS",
    'Já existe uma conta com este e-mail. Entre por "Entrar".',
  ],
  [
    "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
    'Já existe uma conta com este e-mail. Entre por "Entrar".',
  ],
  ["INVALID_EMAIL_OR_PASSWORD", "E-mail ou senha incorretos."],
  ["INVALID_EMAIL", "Informe um e-mail válido."],
  ["PASSWORD_TOO_SHORT", "A senha precisa ter pelo menos 8 caracteres."],
  ["PASSWORD_TOO_LONG", "A senha pode ter no máximo 128 caracteres."],
  [
    "email_not_found",
    "Essa conta não informou um e-mail. Use outro jeito de entrar.",
  ],
  [
    "account_not_linked",
    "Esse e-mail já tem conta com outro jeito de entrar. Entre como da primeira vez.",
  ],
  ["unable_to_create_user", "Não foi possível criar a conta. Tente de novo."],
  ["access_denied", "Você cancelou o acesso. Tente de novo quando quiser."],
  [
    "SESSION_NOT_FRESH",
    "Por segurança, entre de novo antes de criar uma passkey.",
  ],
  ["AUTH_CANCELLED", "Login com passkey cancelado."],
  ["REGISTRATION_CANCELLED", "Criação da passkey cancelada."],
  ["PREVIOUSLY_REGISTERED", "Esta passkey já está cadastrada."],
  ["AUTHENTICATION_FAILED", "Não foi possível entrar com a passkey."],
  ["PASSKEY_NOT_FOUND", "Passkey não encontrada."],
];

describe("authErrorMessage", () => {
  it("o fallback é o texto do contrato", () => {
    expect(FALLBACK_AUTH_ERROR).toBe(
      "Não foi possível concluir. Tente de novo.",
    );
  });

  it("o mapa tem exatamente os 20 códigos do contrato", () => {
    expect(Object.keys(AUTH_ERROR_MESSAGES).sort()).toEqual(
      EXPECTED.map(([code]) => code).sort(),
    );
  });

  it.each(EXPECTED)("traduz %s", (code, message) => {
    expect(authErrorMessage(code)).toBe(message);
  });

  it.each([
    undefined,
    null,
    "",
    "CODIGO_QUE_NAO_EXISTE",
    "signup_Disabled",
  ])("devolve o fallback para %s", (code) => {
    expect(authErrorMessage(code)).toBe(FALLBACK_AUTH_ERROR);
  });

  it.each([
    "toString",
    "constructor",
    "__proto__",
    "hasOwnProperty",
  ])("não confunde %s (propriedade herdada) com um código", (code) => {
    expect(authErrorMessage(code)).toBe(FALLBACK_AUTH_ERROR);
  });

  it("nunca devolve o código cru nem texto do servidor", () => {
    const hostile = "<script>alert(1)</script> Sua conta foi hackeada";
    expect(authErrorMessage(hostile)).toBe(FALLBACK_AUTH_ERROR);
    for (const [code] of EXPECTED) {
      expect(authErrorMessage(code)).not.toBe(code);
    }
  });

  it("o mapa é imutável", () => {
    expect(Object.isFrozen(AUTH_ERROR_MESSAGES)).toBe(true);
  });
});
```

Crie `src/lib/auth/errorCodesContract.test.ts`. Ele lê os códigos direto dos pacotes (`BASE_ERROR_CODES` do core e `PASSKEY_ERROR_CODES` do passkey), no mesmo espírito do `invitationErrors.test.ts` do klauve: se um upgrade renomear um código, este teste cai antes de a tela mostrar o texto genérico em silêncio.
```ts
import { BASE_ERROR_CODES } from "@better-auth/core/error";
import { PASSKEY_ERROR_CODES } from "@better-auth/passkey";
import { APIError } from "better-auth/api";
import { describe, expect, it } from "vitest";

import { AUTH_ERROR_MESSAGES } from "./errors";

// Se um upgrade do Better Auth renomear um código, este teste cai antes de a
// tela passar a mostrar o texto genérico em silêncio.

const CORE_CODES = [
  "USER_ALREADY_EXISTS",
  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
  "INVALID_EMAIL_OR_PASSWORD",
  "INVALID_EMAIL",
  "PASSWORD_TOO_SHORT",
  "PASSWORD_TOO_LONG",
  "SESSION_NOT_FRESH",
] as const;

const PASSKEY_CODES = [
  "PREVIOUSLY_REGISTERED",
  "REGISTRATION_CANCELLED",
  "AUTH_CANCELLED",
  "AUTHENTICATION_FAILED",
  "PASSKEY_NOT_FOUND",
] as const;

// Códigos nossos (lançados em createAuth) e de redirect do OAuth (texto fixo no
// Better Auth, sem objeto de erro exportado).
const OWN_OR_OAUTH_CODES = [
  "SIGNUP_INVITE_ONLY",
  "ACCOUNT_DEACTIVATED",
  "signup_disabled",
  "email_not_found",
  "account_not_linked",
  "unable_to_create_user",
  "access_denied",
] as const;

describe("contrato dos códigos de erro do Better Auth", () => {
  it.each(CORE_CODES)("o core ainda exporta %s", (code) => {
    expect(BASE_ERROR_CODES[code].code).toBe(code);
  });

  it.each(PASSKEY_CODES)("o plugin passkey ainda exporta %s", (code) => {
    expect(PASSKEY_ERROR_CODES[code].code).toBe(code);
  });

  it.each(CORE_CODES)("APIError.from carrega body.code %s", (code) => {
    const error = APIError.from("BAD_REQUEST", BASE_ERROR_CODES[code]);
    expect((error.body as { code?: string }).code).toBe(code);
  });

  it("todo código do mapa é coberto por um dos grupos acima (e vice-versa)", () => {
    const covered = [...CORE_CODES, ...PASSKEY_CODES, ...OWN_OR_OAUTH_CODES];
    expect(Object.keys(AUTH_ERROR_MESSAGES).sort()).toEqual(
      [...covered].sort(),
    );
  });
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `bun run test src/lib/auth/inviteCookie.test.ts src/lib/auth/errors.test.ts src/lib/auth/errorCodesContract.test.ts`
Expected: FAIL (3 arquivos) com `Cannot find module './inviteCookie'` e `Cannot find module './errors'`

- [ ] **Step 8: Write minimal implementation (`inviteCookie`, `errors`)**

Crie `src/lib/auth/inviteCookie.ts`:
```ts
export const INVITE_COOKIE = "closery_invite";
export const INVITE_COOKIE_MAX_AGE_SECONDS = 3600;

// SameSite=Lax (nunca Strict): o cookie precisa voltar no redirect de retorno
// do Google/Facebook, que é uma navegação top-level GET.
export function inviteCookieOptions(isProduction: boolean): {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: INVITE_COOKIE_MAX_AGE_SECONDS,
  };
}
```

Crie `src/lib/auth/errors.ts`:
```ts
export const FALLBACK_AUTH_ERROR = "Não foi possível concluir. Tente de novo.";

const ALREADY_EXISTS =
  'Já existe uma conta com este e-mail. Entre por "Entrar".';

export const AUTH_ERROR_MESSAGES: Readonly<Record<string, string>> =
  Object.freeze({
    SIGNUP_INVITE_ONLY:
      "O cadastro é só por convite. Abra de novo o link que você recebeu.",
    signup_disabled: "Conta não encontrada. Peça um convite.",
    ACCOUNT_DEACTIVATED: "Esta conta foi desativada. Fale com o administrador.",
    USER_ALREADY_EXISTS: ALREADY_EXISTS,
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: ALREADY_EXISTS,
    INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
    INVALID_EMAIL: "Informe um e-mail válido.",
    PASSWORD_TOO_SHORT: "A senha precisa ter pelo menos 8 caracteres.",
    PASSWORD_TOO_LONG: "A senha pode ter no máximo 128 caracteres.",
    email_not_found:
      "Essa conta não informou um e-mail. Use outro jeito de entrar.",
    account_not_linked:
      "Esse e-mail já tem conta com outro jeito de entrar. Entre como da primeira vez.",
    unable_to_create_user: "Não foi possível criar a conta. Tente de novo.",
    access_denied: "Você cancelou o acesso. Tente de novo quando quiser.",
    SESSION_NOT_FRESH:
      "Por segurança, entre de novo antes de criar uma passkey.",
    AUTH_CANCELLED: "Login com passkey cancelado.",
    REGISTRATION_CANCELLED: "Criação da passkey cancelada.",
    PREVIOUSLY_REGISTERED: "Esta passkey já está cadastrada.",
    AUTHENTICATION_FAILED: "Não foi possível entrar com a passkey.",
    PASSKEY_NOT_FOUND: "Passkey não encontrada.",
  });

// Sempre devolve texto do mapa ou o fallback: o texto cru do servidor (por
// exemplo `error_description` na URL de retorno do OAuth) nunca chega à tela.
export function authErrorMessage(code: string | null | undefined): string {
  if (!code || !Object.hasOwn(AUTH_ERROR_MESSAGES, code)) {
    return FALLBACK_AUTH_ERROR;
  }
  return AUTH_ERROR_MESSAGES[code] ?? FALLBACK_AUTH_ERROR;
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `bun run test src/lib/auth/inviteCookie.test.ts src/lib/auth/errors.test.ts src/lib/auth/errorCodesContract.test.ts`
Expected: PASS (56 testes: 4 + 32 + 20)

- [ ] **Step 10: Criar o helper de teste `test/auth.ts`**

É código de apoio (não tem teste próprio; é exercitado pelos testes dos Steps 11 e 16). `sessionCookieOf` monta o header `cookie` a partir dos `set-cookie` de `signInEmail({ returnHeaders: true })`; `getSetCookie()` evita o problema de vírgulas dentro de `Expires`.

Crie `test/auth.ts`:
```ts
import type { Db } from "@/db/types";
import { type Auth, createAuth } from "@/lib/auth/createAuth";
import type { AuthEnv } from "@/lib/auth/env";
import { INVITE_COOKIE } from "@/lib/auth/inviteCookie";

export const TEST_AUTH_ENV: AuthEnv = {
  secret: "test-secret-with-at-least-32-characters-long",
  baseURL: "http://localhost:3000",
  google: null,
  facebook: null,
};

export function createTestAuth(db: Db, env: Partial<AuthEnv> = {}): Auth {
  return createAuth(db, { ...TEST_AUTH_ENV, ...env });
}

// Cadastra por e-mail como o navegador faria: o convite vai no cookie.
// Devolve o resultado do Better Auth; erro vira APIError (lançado).
export async function signUpWithInvite(
  auth: Auth,
  token: string | null,
  input: { name: string; email: string; password: string },
): Promise<unknown> {
  const headers = new Headers();
  if (token) headers.set("cookie", `${INVITE_COOKIE}=${token}`);
  return auth.api.signUpEmail({ body: input, headers });
}

// Monta o header `cookie` a partir dos `set-cookie` de uma resposta
// (ex.: signInEmail com `returnHeaders: true`).
export function sessionCookieOf(headers: Headers): string {
  return headers
    .getSetCookie()
    .map((line) => line.split(";")[0])
    .join("; ");
}
```

- [ ] **Step 11: Write the failing tests (`createAuth` e guarda de schema)**

`createAuth.test.ts` cobre o portão do convite (sem cookie, token malformado, inexistente, expirado, usado, cancelado, reuso, e-mail já cadastrado sem gastar o convite, tentativa de impor `role` e `sectorId`, senha curta, criação fora de requisição), login e sessão (incluindo desativado) e a configuração (social condicional, sem `cookieCache`, sem `nextCookies`, rate limit só em produção).

Crie `src/lib/auth/createAuth.test.ts`:
```ts
import type { PGlite } from "@electric-sql/pglite";
import type { BetterAuthOptions } from "better-auth";
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { invite, user } from "@/db/schema";
import { enabledSocialProviders } from "@/lib/auth/env";
import { INVITE_COOKIE } from "@/lib/auth/inviteCookie";
import {
  createTestAuth,
  sessionCookieOf,
  signUpWithInvite,
  TEST_AUTH_ENV,
} from "../../../test/auth";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertInvite, insertSector, insertUser } from "../../../test/fixtures";
import { createAuth } from "./createAuth";

const PASSWORD = "senha-segura-123";

let client: PGlite;
let db: TestDb;
let auth: ReturnType<typeof createTestAuth>;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
  auth = createTestAuth(db);
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
});

// `auth.options` tem o tipo literal da configuração; aqui só lemos como o
// tipo geral para inspecionar campos opcionais.
function optionsOf(instance: {
  options: BetterAuthOptions;
}): BetterAuthOptions {
  return instance.options;
}

function newPerson(email: string) {
  return { name: "Pessoa Teste", email, password: PASSWORD };
}

async function allUsers() {
  return db.select().from(user);
}

async function inviteRow(id: string) {
  const [row] = await db.select().from(invite).where(eq(invite.id, id));
  if (!row) throw new Error("convite sumiu");
  return row;
}

describe("cadastro: o convite é o portão", () => {
  it("sem cookie: 403 SIGNUP_INVITE_ONLY e nada é criado", async () => {
    await expect(
      signUpWithInvite(auth, null, newPerson("a@example.com")),
    ).rejects.toMatchObject({
      statusCode: 403,
      body: { code: "SIGNUP_INVITE_ONLY" },
    });
    expect(await allUsers()).toHaveLength(0);
  });

  it("cookie com lixo (token malformado): 403 e nada é criado", async () => {
    await expect(
      signUpWithInvite(auth, "isto-nao-e-um-token", newPerson("a@example.com")),
    ).rejects.toMatchObject({
      statusCode: 403,
      body: { code: "SIGNUP_INVITE_ONLY" },
    });
    expect(await allUsers()).toHaveLength(0);
  });

  it("token bem formado mas inexistente: 403", async () => {
    await expect(
      signUpWithInvite(auth, "A".repeat(43), newPerson("a@example.com")),
    ).rejects.toMatchObject({
      statusCode: 403,
      body: { code: "SIGNUP_INVITE_ONLY" },
    });
    expect(await allUsers()).toHaveLength(0);
  });

  it("convite de admin: user.role admin, sectorId null, e-mail verificado, convite gasto e ligado ao usuário", async () => {
    const { id, token } = await insertInvite(db, {
      role: "admin",
      now: new Date(),
    });

    await signUpWithInvite(auth, token, newPerson("admin@example.com"));

    const [created] = await allUsers();
    expect(created).toMatchObject({
      email: "admin@example.com",
      role: "admin",
      sectorId: null,
      emailVerified: true,
      deactivatedAt: null,
    });
    const row = await inviteRow(id);
    expect(row.usedAt).toBeInstanceOf(Date);
    expect(row.usedBy).toBe(created?.id);
  });

  it("convite de operador: herda o setor do convite", async () => {
    const sector = await insertSector(db, "Setor do convite");
    const { token } = await insertInvite(db, {
      role: "operator",
      sectorId: sector.id,
      now: new Date(),
    });

    await signUpWithInvite(auth, token, newPerson("op@example.com"));

    const [created] = await allUsers();
    expect(created).toMatchObject({ role: "operator", sectorId: sector.id });
  });

  it.each([
    ["expirado", { expiresAt: new Date(Date.now() - 1000) }],
    ["já usado", { usedAt: new Date() }],
    ["cancelado", { cancelledAt: new Date() }],
  ])("convite %s: 403 e nada é criado", async (_label, patch) => {
    const { id, token } = await insertInvite(db, { role: "admin", ...patch });
    const before = await inviteRow(id);

    await expect(
      signUpWithInvite(auth, token, newPerson("x@example.com")),
    ).rejects.toMatchObject({
      statusCode: 403,
      body: { code: "SIGNUP_INVITE_ONLY" },
    });

    expect(await allUsers()).toHaveLength(0);
    expect(await inviteRow(id)).toEqual(before);
  });

  it("o mesmo convite não serve para duas contas", async () => {
    const { token } = await insertInvite(db, { role: "admin" });
    await signUpWithInvite(auth, token, newPerson("primeira@example.com"));

    await expect(
      signUpWithInvite(auth, token, newPerson("segunda@example.com")),
    ).rejects.toMatchObject({
      statusCode: 403,
      body: { code: "SIGNUP_INVITE_ONLY" },
    });
    expect(await allUsers()).toHaveLength(1);
  });

  it("e-mail já cadastrado: erro USER_ALREADY_EXISTS* e o convite NÃO é gasto", async () => {
    const first = await insertInvite(db, { role: "admin" });
    await signUpWithInvite(auth, first.token, newPerson("dono@example.com"));
    const second = await insertInvite(db, { role: "admin" });

    await expect(
      signUpWithInvite(auth, second.token, newPerson("dono@example.com")),
    ).rejects.toMatchObject({
      body: { code: expect.stringMatching(/^USER_ALREADY_EXISTS/) },
    });
    // maiúsculas no e-mail não burlam a checagem
    await expect(
      signUpWithInvite(auth, second.token, newPerson("DONO@Example.com")),
    ).rejects.toMatchObject({
      body: { code: expect.stringMatching(/^USER_ALREADY_EXISTS/) },
    });

    const row = await inviteRow(second.id);
    expect(row.usedAt).toBeNull();
    expect(row.usedBy).toBeNull();

    // o segundo convite continua servindo para outra pessoa
    await signUpWithInvite(auth, second.token, newPerson("outra@example.com"));
    expect(await allUsers()).toHaveLength(2);
  });

  it("o cliente não escolhe o papel: role admin no body com convite de operador continua operator", async () => {
    const sector = await insertSector(db);
    const { token } = await insertInvite(db, {
      role: "operator",
      sectorId: sector.id,
    });

    const body = { ...newPerson("op@example.com"), role: "admin" };
    await auth.api.signUpEmail({
      body,
      headers: new Headers({ cookie: `${INVITE_COOKIE}=${token}` }),
    });

    const [created] = await allUsers();
    expect(created).toMatchObject({ role: "operator", sectorId: sector.id });
  });

  it("o cliente não escolhe o setor: sectorId no body é recusado e o convite não é gasto", async () => {
    const own = await insertSector(db);
    const other = await insertSector(db);
    const { id, token } = await insertInvite(db, {
      role: "operator",
      sectorId: own.id,
    });

    const body = { ...newPerson("op@example.com"), sectorId: other.id };
    await expect(
      auth.api.signUpEmail({
        body,
        headers: new Headers({ cookie: `${INVITE_COOKIE}=${token}` }),
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(await allUsers()).toHaveLength(0);
    expect((await inviteRow(id)).usedAt).toBeNull();
  });

  it("senha curta (7) é recusada antes de gastar o convite; 8 passa", async () => {
    const { id, token } = await insertInvite(db, { role: "admin" });

    await expect(
      signUpWithInvite(auth, token, {
        ...newPerson("a@example.com"),
        password: "1234567",
      }),
    ).rejects.toMatchObject({ body: { code: "PASSWORD_TOO_SHORT" } });
    expect((await inviteRow(id)).usedAt).toBeNull();

    await signUpWithInvite(auth, token, {
      ...newPerson("a@example.com"),
      password: "12345678",
    });
    expect(await allUsers()).toHaveLength(1);
  });

  it("fora de uma requisição (sem contexto) a criação de usuário é recusada", async () => {
    const context = await auth.$context;
    await expect(
      context.internalAdapter.createUser(
        {
          name: "Sem Contexto",
          email: "semcontexto@example.com",
          emailVerified: true,
        },
        { method: "email-password" },
      ),
    ).rejects.toMatchObject({ body: { code: "SIGNUP_INVITE_ONLY" } });
    expect(await allUsers()).toHaveLength(0);
  });
});

describe("login e sessão", () => {
  it("getSession com o cookie de sessão traz role e sectorId", async () => {
    const sector = await insertSector(db);
    const { token } = await insertInvite(db, {
      role: "operator",
      sectorId: sector.id,
    });
    await signUpWithInvite(auth, token, newPerson("op@example.com"));

    const { headers } = await auth.api.signInEmail({
      body: { email: "op@example.com", password: PASSWORD },
      returnHeaders: true,
    });
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: sessionCookieOf(headers) }),
    });

    expect(session?.user).toMatchObject({
      email: "op@example.com",
      role: "operator",
      sectorId: sector.id,
      deactivatedAt: null,
    });
  });

  it("sem cookie de sessão, getSession devolve null", async () => {
    expect(await auth.api.getSession({ headers: new Headers() })).toBeNull();
  });

  it("senha errada: 401 INVALID_EMAIL_OR_PASSWORD", async () => {
    const { token } = await insertInvite(db, { role: "admin" });
    await signUpWithInvite(auth, token, newPerson("a@example.com"));

    await expect(
      auth.api.signInEmail({
        body: { email: "a@example.com", password: "senha-errada-123" },
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      body: { code: "INVALID_EMAIL_OR_PASSWORD" },
    });
  });

  it("usuário desativado: signInEmail responde 403 ACCOUNT_DEACTIVATED e não abre sessão", async () => {
    const { token } = await insertInvite(db, { role: "admin" });
    await signUpWithInvite(auth, token, newPerson("a@example.com"));
    await db.update(user).set({ deactivatedAt: new Date() });

    await expect(
      auth.api.signInEmail({
        body: { email: "a@example.com", password: PASSWORD },
      }),
    ).rejects.toMatchObject({
      statusCode: 403,
      body: { code: "ACCOUNT_DEACTIVATED" },
    });
    const sessions = await client.query(
      "SELECT count(*)::int AS n FROM session",
    );
    // só a sessão aberta pelo cadastro; o login recusado não criou outra
    expect(sessions.rows).toEqual([{ n: 1 }]);
  });

  it("e-mail sem conta de senha: INVALID_EMAIL_OR_PASSWORD, sem revelar se o e-mail existe", async () => {
    await insertUser(db, {
      role: "admin",
      sectorId: null,
      email: "so-banco@example.com",
    });
    await expect(
      auth.api.signInEmail({
        body: { email: "so-banco@example.com", password: PASSWORD },
      }),
    ).rejects.toMatchObject({ body: { code: "INVALID_EMAIL_OR_PASSWORD" } });
  });
});

describe("configuração", () => {
  it("sem variáveis sociais, nenhum provedor está ligado", () => {
    expect(optionsOf(auth).socialProviders).toEqual({});
    expect(enabledSocialProviders(TEST_AUTH_ENV)).toEqual([]);
  });

  it("com google e facebook, ambos ligados com disableImplicitSignUp", () => {
    const social = createTestAuth(db, {
      google: { clientId: "gid", clientSecret: "gsecret" },
      facebook: { clientId: "fid", clientSecret: "fsecret" },
    });
    expect(optionsOf(social).socialProviders).toEqual({
      google: {
        clientId: "gid",
        clientSecret: "gsecret",
        disableImplicitSignUp: true,
      },
      facebook: {
        clientId: "fid",
        clientSecret: "fsecret",
        disableImplicitSignUp: true,
      },
    });
  });

  it("só google configurado não liga o facebook", () => {
    const social = createTestAuth(db, {
      google: { clientId: "gid", clientSecret: "gsecret" },
    });
    expect(Object.keys(optionsOf(social).socialProviders ?? {})).toEqual([
      "google",
    ]);
  });

  it("e-mail e senha: mínimo 8 e sem recuperação de senha por e-mail", () => {
    expect(optionsOf(auth).emailAndPassword).toMatchObject({
      enabled: true,
      minPasswordLength: 8,
    });
    expect(optionsOf(auth).emailAndPassword?.sendResetPassword).toBeUndefined();
  });

  it("sem cookieCache e sem nextCookies (T7)", () => {
    expect(optionsOf(auth).session?.cookieCache).toBeUndefined();
    const ids = (optionsOf(auth).plugins ?? []).map((plugin) => plugin.id);
    expect(ids).toContain("passkey");
    expect(ids).not.toContain("next-cookies");
  });

  it("origem confiável é só a baseURL", () => {
    const custom = createTestAuth(db, { baseURL: "https://closery.app" });
    expect(optionsOf(custom).trustedOrigins).toEqual(["https://closery.app"]);
    expect(optionsOf(custom).baseURL).toBe("https://closery.app");
  });

  it("login social nunca vincula conta existente sozinho", () => {
    expect(
      optionsOf(auth).account?.accountLinking?.disableImplicitLinking,
    ).toBe(true);
  });

  it("rate limit: desligado fora de produção, ligado em produção com storage database", () => {
    expect(optionsOf(auth).rateLimit?.enabled).toBe(false);
    vi.stubEnv("NODE_ENV", "production");
    try {
      const prod = createAuth(db, TEST_AUTH_ENV);
      expect(optionsOf(prod).rateLimit).toMatchObject({
        enabled: true,
        storage: "database",
        window: 10,
        max: 100,
        customRules: {
          "/sign-in/email": { window: 60, max: 30 },
          "/sign-up/email": { window: 60, max: 10 },
        },
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
```

`schemaGuard.test.ts` é a guarda da decisão T3 (schema escrito à mão): `getAuthTables(auth.options)` (de `@better-auth/core/db`) devolve `Record<chave, { modelName, fields: Record<chave, { fieldName?, … }> }>`. Para cada tabela e campo, tem de existir `schema[modelName][fieldName ?? chave]`; o `id` implícito também; e a coluna tem de existir no banco migrado.

Crie `src/lib/auth/schemaGuard.test.ts`:
```ts
import { getAuthTables } from "@better-auth/core/db";
import type { PGlite } from "@electric-sql/pglite";
import { getTableColumns, getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { createTestAuth } from "../../../test/auth";
import { createTestDb, type TestDb } from "../../../test/db";
import { AUTH_USER_ADDITIONAL_FIELDS } from "./createAuth";

let client: PGlite;
let db: TestDb;
let tables: ReturnType<typeof getAuthTables>;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
  const auth = createTestAuth(db, {
    google: { clientId: "gid", clientSecret: "gsecret" },
  });
  tables = getAuthTables(auth.options);
});

afterAll(async () => {
  await client.close();
});

type Loose = Record<string, unknown>;

describe("guarda de schema: o que o Better Auth espera existe no Drizzle", () => {
  it("o Better Auth declara as 6 tabelas que escrevemos à mão", () => {
    const modelNames = Object.values(tables)
      .map((table) => table.modelName)
      .sort();
    expect(modelNames).toEqual(
      [
        "account",
        "passkey",
        "rateLimit",
        "session",
        "user",
        "verification",
      ].sort(),
    );
  });

  it("para cada tabela, existe schema[modelName] com todas as colunas esperadas", () => {
    const loose: Loose = schema;
    const missing: string[] = [];

    for (const table of Object.values(tables)) {
      const drizzleTable = loose[table.modelName];
      if (!is(drizzleTable, PgTable)) {
        missing.push(`tabela ${table.modelName}`);
        continue;
      }
      const columns = getTableColumns(drizzleTable);
      // o Better Auth sempre grava e lê `id`, mesmo sem declará-lo em `fields`
      if (!("id" in columns)) missing.push(`${table.modelName}.id`);
      for (const [fieldKey, field] of Object.entries(table.fields)) {
        const key = field.fieldName ?? fieldKey;
        if (!(key in columns)) missing.push(`${table.modelName}.${key}`);
      }
    }

    expect(missing).toEqual([]);
  });

  it("cada coluna esperada existe de fato no banco migrado", async () => {
    const loose: Loose = schema;
    const missing: string[] = [];

    for (const table of Object.values(tables)) {
      const drizzleTable = loose[table.modelName];
      if (!is(drizzleTable, PgTable)) continue;
      const columns = getTableColumns(drizzleTable);
      const result = await client.query<{ column_name: string }>(
        "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
        [getTableName(drizzleTable)],
      );
      const inDb = new Set(result.rows.map((row) => row.column_name));
      for (const [fieldKey, field] of Object.entries(table.fields)) {
        const column = columns[field.fieldName ?? fieldKey];
        if (column && !inDb.has(column.name)) {
          missing.push(`${getTableName(drizzleTable)}.${column.name}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("os campos extras do usuário (role, sectorId, deactivatedAt) existem em schema.user", () => {
    const columns = getTableColumns(schema.user);
    for (const key of Object.keys(AUTH_USER_ADDITIONAL_FIELDS)) {
      expect(columns).toHaveProperty(key);
    }
  });

  it("o campo extra role aceita exatamente os papéis do app", () => {
    expect(AUTH_USER_ADDITIONAL_FIELDS.role.type).toEqual([
      "admin",
      "operator",
    ]);
    expect(getTableColumns(schema.user).role.enumValues).toEqual([
      "admin",
      "operator",
    ]);
  });
});
```

- [ ] **Step 12: Run tests to verify they fail**

Run: `bun run test src/lib/auth/createAuth.test.ts src/lib/auth/schemaGuard.test.ts`
Expected: FAIL com `Cannot find package '@/lib/auth/createAuth' imported from .../test/auth.ts` e `Cannot find package '@/lib/auth/env'`

- [ ] **Step 13: Write minimal implementation (`createAuth`)**

Pontos que não são óbvios no código (cada um foi verificado no clone com PGlite):
- `drizzleAdapter` **sem** `transaction` (T6): ligado, o hook consultaria fora da transação e o PGlite travaria.
- `user.create.before` sem `ctx` **recusa** (T5); o erro é sempre `APIError` com `code` (um `Error` comum viraria 500 sem corpo, e no callback OAuth só `APIError` com `code` vira redirect `?error=<code>`).
- O convite é consumido no `before` (spec §4.3); e-mail duplicado e senha curta são recusados **antes** do hook, então não gastam o convite (testes provam).
- `AUTH_USER_ADDITIONAL_FIELDS` usa `satisfies Record<string, DBFieldAttribute>` (não `as const`): o tipo `type: ["admin", "operator"]` do Better Auth exige array mutável.
- Sem `cookieCache` e sem `nextCookies()` (T7).

Crie `src/lib/auth/createAuth.ts`:
```ts
import type { DBFieldAttribute } from "@better-auth/core/db";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { eq } from "drizzle-orm";

import * as schema from "@/db/schema";
import type { Db } from "@/db/types";
import {
  consumeInvite,
  recordInviteUser,
} from "@/features/invites/inviteQueries";

import type { AuthEnv } from "./env";
import { INVITE_COOKIE } from "./inviteCookie";

// Também usado pelo teste guarda de schema (schemaGuard.test.ts).
export const AUTH_USER_ADDITIONAL_FIELDS = {
  role: {
    type: ["admin", "operator"],
    required: true,
    defaultValue: "operator",
    input: false,
  },
  sectorId: { type: "string", required: false, input: false },
  deactivatedAt: { type: "date", required: false, input: false },
} satisfies Record<string, DBFieldAttribute>;

function inviteOnlyError(): APIError {
  return new APIError("FORBIDDEN", {
    message: "O cadastro é só por convite.",
    code: "SIGNUP_INVITE_ONLY",
  });
}

function accountDeactivatedError(): APIError {
  return new APIError("FORBIDDEN", {
    message: "Esta conta foi desativada.",
    code: "ACCOUNT_DEACTIVATED",
  });
}

// O tipo de retorno é inferido de propósito: `inferAdditionalFields<Auth>()` no
// cliente precisa do tipo exato (campos extras e plugin), que `ReturnType<typeof
// betterAuth>` apagaria.
export function createAuth(db: Db, env: AuthEnv) {
  const baseURL = env.baseURL;

  return betterAuth({
    appName: "Closery",
    secret: env.secret,
    baseURL,
    trustedOrigins: [baseURL],

    // Sem `transaction` (padrão: desligado). Ligado, o hook do convite consulta
    // fora da transação do adapter e o PGlite (uma conexão) travaria.
    database: drizzleAdapter(db, { provider: "pg", schema }),

    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // Sem `sendResetPassword`: ainda não há e-mail transacional (P8). O
      // endpoint responde RESET_PASSWORD_DISABLED e a tela não oferece o link.
    },

    socialProviders: {
      ...(env.google
        ? {
            google: {
              clientId: env.google.clientId,
              clientSecret: env.google.clientSecret,
              disableImplicitSignUp: true,
            },
          }
        : {}),
      ...(env.facebook
        ? {
            facebook: {
              clientId: env.facebook.clientId,
              clientSecret: env.facebook.clientSecret,
              disableImplicitSignUp: true,
            },
          }
        : {}),
    },

    // Login social nunca vincula sozinho a uma conta existente: o e-mail dos
    // convidados é marcado como verificado pelo convite, então vincular pelo
    // e-mail abriria tomada de conta. Quem tem conta entra "como da primeira
    // vez" (erro account_not_linked).
    account: { accountLinking: { disableImplicitLinking: true } },

    user: { additionalFields: AUTH_USER_ADDITIONAL_FIELDS },

    // Sem `session.cookieCache`: desativar uma pessoa ou mudar papel/setor vale
    // na próxima requisição (spec §4.1); a sessão é lida fresca do banco.
    // Sem o plugin `nextCookies()`: cadastro e login passam pelo `authClient`
    // (HTTP, onde o rate limit atua), então nenhum `auth.api.sign*` roda em
    // Server Action e não há cookie a repassar ao `cookies()` do Next (T7).

    databaseHooks: {
      user: {
        create: {
          // Portão único do cadastro, qualquer que seja o método (e-mail,
          // Google, Facebook). Consome o convite do cookie de forma atômica.
          before: async (newUser, ctx) => {
            // Fora de uma requisição não há cookie: recusa (fail-closed).
            if (!ctx) throw inviteOnlyError();
            const token = ctx.getCookie(INVITE_COOKIE);
            if (!token) throw inviteOnlyError();
            const consumed = await consumeInvite(db, token, new Date());
            if (!consumed) throw inviteOnlyError();
            return {
              data: {
                ...newUser,
                role: consumed.role,
                sectorId: consumed.sectorId,
                emailVerified: true,
              },
            };
          },
          after: async (createdUser, ctx) => {
            const token = ctx?.getCookie(INVITE_COOKIE);
            if (!token) return;
            await recordInviteUser(db, token, createdUser.id);
          },
        },
      },
      session: {
        create: {
          // Vale para e-mail e senha, OAuth e passkey: todo caminho que abre
          // sessão passa por aqui.
          before: async (newSession) => {
            const [row] = await db
              .select({ deactivatedAt: schema.user.deactivatedAt })
              .from(schema.user)
              .where(eq(schema.user.id, newSession.userId))
              .limit(1);
            if (row?.deactivatedAt) throw accountDeactivatedError();
          },
        },
      },
    },

    // Em serverless, `memory` é por instância e não limita nada: usa a tabela
    // rate_limit. O limiter só atua no router HTTP (/api/auth/*).
    rateLimit: {
      enabled: process.env.NODE_ENV === "production",
      storage: "database",
      window: 10,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 30 },
        "/sign-up/email": { window: 60, max: 10 },
      },
    },

    plugins: [
      passkey({
        rpID: new URL(baseURL).hostname,
        rpName: "Closery",
        origin: baseURL,
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
```

- [ ] **Step 14: Run tests to verify they pass**

Run: `bun run test src/lib/auth/createAuth.test.ts src/lib/auth/schemaGuard.test.ts`
Expected: PASS (32 testes: 27 + 5)

Se o Better Auth falhar sob Vitest/Node (a pesquisa original só rodou com Bun): **não falhou** no clone (Node 22.12.0, Vitest 5.1.1, PGlite 0.5.17, Windows 11). Sem workaround necessário.

- [ ] **Step 15: Provar que o portão é real (mutação, não commitar)**

Desligue o portão por 1 minuto e veja os testes caírem:

```bash
cp src/lib/auth/createAuth.ts /tmp/createAuth.bak
sed -i 's#if (!consumed) throw inviteOnlyError();#if (!consumed) return { data: { ...newUser } };#' src/lib/auth/createAuth.ts
bun run test src/lib/auth/createAuth.test.ts
cp /tmp/createAuth.bak src/lib/auth/createAuth.ts
```
Expected: FAIL com `6 failed | 21 passed` (token malformado, inexistente, expirado, usado, cancelado e reuso do convite). Depois do `cp` final, rode `bun run test src/lib/auth/createAuth.test.ts` de novo: PASS (27 testes).

- [ ] **Step 16: Write the failing test (tipos do cliente)**

Crie `src/lib/auth/clientTypes.test.ts`. Ele só tem asserções de tipo (`expectTypeOf`), checadas por `tsc`; em runtime é um teste vazio que passa.
```ts
import { describe, expectTypeOf, it } from "vitest";

import type { authClient } from "./client";

// Prova em tempo de tipo (rodado por `bun run check-types`) que o cliente
// enxerga os campos extras do usuário.
describe("tipos do authClient", () => {
  it("useSession traz role, sectorId e deactivatedAt tipados", () => {
    type SessionUser = NonNullable<
      ReturnType<typeof authClient.useSession>["data"]
    >["user"];
    expectTypeOf<SessionUser["role"]>().toEqualTypeOf<"admin" | "operator">();
    expectTypeOf<SessionUser["sectorId"]>().toEqualTypeOf<
      string | null | undefined
    >();
  });
});
```

- [ ] **Step 17: Run check to verify it fails**

Run: `bun run check-types`
Expected: FAIL com `src/lib/auth/clientTypes.test.ts(3,33): error TS2307: Cannot find module './client'`

- [ ] **Step 18: Write minimal implementation (`index`, rota e `client`)**

`index.ts` é o singleton do app (`server-only`): `parseAuthEnv` lança na subida se faltar variável, com a lista do que falta. A rota usa só `GET` e `POST`, que são os métodos que o Better Auth usa.

Crie `src/lib/auth/index.ts`:
```ts
import "server-only";

import { db } from "@/db";

import { createAuth } from "./createAuth";
import { parseAuthEnv } from "./env";

export const authEnv = parseAuthEnv(process.env);
export const auth = createAuth(db, authEnv);
```

Crie `src/app/api/auth/[...all]/route.ts`:
```ts
import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
```

Crie `src/lib/auth/client.ts`:
```ts
"use client";

import { passkeyClient } from "@better-auth/passkey/client";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import type { Auth } from "./createAuth";

// Mesma origem do app: sem baseURL, o cliente usa a origem da página.
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>(), passkeyClient()],
});
```

- [ ] **Step 19: Run check to verify it passes**

Run: `bun run check-types`
Expected: PASS (sem saída de erro; `role` é `"admin" | "operator"` e `sectorId` é `string | null | undefined` no usuário da sessão do cliente)

- [ ] **Step 20: Documentar as variáveis em `.env.example`**

Acrescente ao fim do arquivo (não apague nada):

```bash
cat >> .env.example <<'EOF'

# --- Autenticação (Better Auth) ---
# Segredo que assina sessões e tokens. Mínimo 32 caracteres. Gere com:
#   openssl rand -base64 32
# Em produção e em cada Preview da Vercel, use um valor próprio.
BETTER_AUTH_SECRET=""

# URL pública do app, sem barra final. Passkeys e callbacks de login social
# dependem dela. Local: http://localhost:3000
BETTER_AUTH_URL="http://localhost:3000"

# Login com Google (opcional). Preencha os DOIS ou deixe os dois vazios.
# Console do Google Cloud → Credenciais → ID do cliente OAuth (aplicativo da Web).
# URI de redirecionamento: <BETTER_AUTH_URL>/api/auth/callback/google
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Login com Facebook (opcional). Preencha os DOIS ou deixe os dois vazios.
# Meta for Developers → app → Login do Facebook.
# URI de redirecionamento: <BETTER_AUTH_URL>/api/auth/callback/facebook
FACEBOOK_CLIENT_ID=""
FACEBOOK_CLIENT_SECRET=""
EOF
```
Expected: `tail -n 5 .env.example` mostra as linhas de `FACEBOOK_*`. Um `BETTER_AUTH_SECRET=""` vazio conta como ausente: copiar o exemplo sem preencher faz o app falhar na subida com a mensagem `BETTER_AUTH_SECRET: ausente`.

- [ ] **Step 21: Gerar o segredo local (sem imprimir o valor)**

No Git Bash, na raiz do projeto. Os dois comandos só acrescentam se a variável ainda não existir (pode rodar de novo sem duplicar) e **não imprimem o segredo**:

```bash
grep -q '^BETTER_AUTH_SECRET=' .env.local || printf '\nBETTER_AUTH_SECRET="%s"\n' "$(openssl rand -base64 32)" >> .env.local
grep -q '^BETTER_AUTH_URL=' .env.local || printf 'BETTER_AUTH_URL="http://localhost:3000"\n' >> .env.local
```
Verifique sem expor o valor: `sed -E 's/(SECRET=").{6}.*/\1******"/' .env.local | grep BETTER_AUTH`
Expected: `BETTER_AUTH_SECRET="******"` e `BETTER_AUTH_URL="http://localhost:3000"`. O `.env.local` já é ignorado pelo git (`.env*` no `.gitignore`); confirme com `git status --short` (o arquivo não aparece).

- [ ] **Step 22: Verificar que o app compila com a rota de autenticação**

Rode com variáveis temporárias na própria linha (nada é gravado; o banco falso não é consultado no build):

```bash
BETTER_AUTH_SECRET="$(openssl rand -base64 32)" BETTER_AUTH_URL=http://localhost:3000 DATABASE_URL=postgres://u:p@127.0.0.1:5999/x bunx next build
```
Expected: `✓ Compiled successfully` e `ƒ /api/auth/[...all]` na lista de rotas (as outras rotas das tarefas anteriores também aparecem).

- [ ] **Step 23: Run the full gates**

Run: `bun run check-types && bun run lint && bun run test`
Expected: PASS nos três. Os arquivos desta tarefa somam 108 testes (19 + 4 + 32 + 20 + 27 + 5 + 1). Se o `lint` reclamar de formatação nos arquivos novos: `bunx biome check --write src/lib/auth test/auth.ts "src/app/api/auth/[...all]/route.ts"` e rode de novo.

- [ ] **Step 24: Commit**

```bash
git add package.json bun.lock .env.example src/lib/auth "src/app/api/auth/[...all]/route.ts" test/auth.ts
git commit -F - <<'EOF'
feat(auth): Better Auth com cadastro só por convite, passkey e mensagens em pt-BR

createAuth(db, env) monta e-mail e senha, Google e Facebook condicionais,
passkey e rate limit em banco. O convite do cookie closery_invite é consumido
no user.create.before; desativado não abre sessão. Guarda de schema compara o
que o Better Auth espera com o Drizzle escrito à mão.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 7: Autorização (`Authz`, escopo por setor, sessão no servidor e `proxy.ts`)

**Files:**
- Create: `src/features/authz/authz.ts`
- Create: `src/features/authz/sectorScope.ts`
- Create: `src/features/authz/proxyRules.ts`
- Create: `src/lib/auth/session.ts`
- Create: `src/proxy.ts`
- Test: `src/features/authz/authz.test.ts`
- Test: `src/features/authz/sectorScope.test.ts`
- Test: `src/features/authz/proxyRules.test.ts`
- Test: `src/lib/auth/session.test.ts`
- Test: `src/proxy.test.ts`

**Interfaces:**
- Consumes (Tarefa 6): `createAuth`, `type Auth` (`@/lib/auth/createAuth`); `auth` (`@/lib/auth`, mockado nos testes de `session.ts`); `createTestAuth`, `signUpWithInvite`, `sessionCookieOf` (`test/auth.ts`).
- Consumes (Tarefas 1 e 4): `isRole`, `type Role` (`@/lib/roles`); `schema.sector`, `schema.user` (`@/db/schema`); `createTestDb`, `resetDb`, `type TestDb` (`test/db.ts`); `insertSector`, `insertInvite` (`test/fixtures.ts`).
- Produces: `type Authz`, `type SessionUserLike`, `toAuthz(user: SessionUserLike | null | undefined): Authz | null`, `isAdmin(authz: Authz): boolean`, `canAccessSector(authz: Authz, sectorId: string): boolean` (`authz.ts`); `scopeToSector(authz: Authz, column: PgColumn): SQL | undefined` (`sectorScope.ts`); `PUBLIC_PATH_PREFIXES`, `isPublicPath(pathname: string): boolean`, `shouldRedirectToSignIn(pathname: string, hasSessionCookie: boolean): boolean` (`proxyRules.ts`); `getAuthz: () => Promise<Authz | null>`, `requireUser(): Promise<Authz>`, `requireAdmin(): Promise<Authz>` (`session.ts`, `server-only`); `proxy(request: NextRequest): NextResponse` e `config.matcher` (`src/proxy.ts`).

> **Decisões desta tarefa que o contrato não fixava:** (a) `toAuthz` devolve `sectorId: null` para **admin** mesmo que o banco guarde um setor (spec §4.1: o admin não tem setor e vê todos). (b) `scopeToSector` de operador **sem** setor (estado que `toAuthz` já recusa) devolve a condição SQL `false` em vez de `undefined`: nunca vira "vê tudo". (c) `shouldRedirectToSignIn` nunca redireciona `/api` e `/api/*` (defesa em profundidade; o `matcher` já os exclui). (d) O `matcher` usa `api(?:/|$)`, e não `api`, para não excluir uma página futura como `/apiary`.

- [ ] **Step 1: Write the failing test (`authz`)**

Crie `src/features/authz/authz.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import { type Authz, canAccessSector, isAdmin, toAuthz } from "./authz";

const SECTOR_A = "11111111-1111-4111-8111-111111111111";
const SECTOR_B = "22222222-2222-4222-8222-222222222222";

const BASE = { id: "u1", name: "Pessoa Um", email: "um@example.com" };

describe("toAuthz", () => {
  it("admin vira Authz com sectorId null", () => {
    expect(toAuthz({ ...BASE, role: "admin", sectorId: null })).toEqual({
      userId: "u1",
      name: "Pessoa Um",
      email: "um@example.com",
      role: "admin",
      sectorId: null,
    });
  });

  it("admin com setor gravado no banco continua sem setor (admin vê todos)", () => {
    expect(
      toAuthz({ ...BASE, role: "admin", sectorId: SECTOR_A })?.sectorId,
    ).toBe(null);
  });

  it("operador com setor mantém o setor", () => {
    expect(toAuthz({ ...BASE, role: "operator", sectorId: SECTOR_A })).toEqual({
      userId: "u1",
      name: "Pessoa Um",
      email: "um@example.com",
      role: "operator",
      sectorId: SECTOR_A,
    });
  });

  it.each([
    ["null", null],
    ["undefined", undefined],
    ["string vazia", ""],
  ])("operador com sectorId %s → null", (_label, sectorId) => {
    expect(toAuthz({ ...BASE, role: "operator", sectorId })).toBeNull();
  });

  it("operador com sectorId que não é string → null", () => {
    expect(toAuthz({ ...BASE, role: "operator", sectorId: 42 })).toBeNull();
  });

  it("desativado (Date) → null, mesmo sendo admin", () => {
    expect(
      toAuthz({
        ...BASE,
        role: "admin",
        sectorId: null,
        deactivatedAt: new Date(0),
      }),
    ).toBeNull();
  });

  it("desativado (string ISO) → null", () => {
    expect(
      toAuthz({
        ...BASE,
        role: "operator",
        sectorId: SECTOR_A,
        deactivatedAt: "2026-11-20T00:00:00.000Z",
      }),
    ).toBeNull();
  });

  it("deactivatedAt null ou ausente não desativa", () => {
    expect(
      toAuthz({ ...BASE, role: "admin", sectorId: null, deactivatedAt: null }),
    ).not.toBeNull();
    expect(toAuthz({ ...BASE, role: "admin", sectorId: null })).not.toBeNull();
  });

  it.each([
    ["superuser"],
    ["ADMIN"],
    [""],
    [null],
    [undefined],
    [1],
    [{ toString: () => "admin" }],
  ])("role desconhecido (%j) → null", (role) => {
    expect(toAuthz({ ...BASE, role, sectorId: SECTOR_A })).toBeNull();
  });

  it("sem role → null", () => {
    expect(toAuthz({ ...BASE, sectorId: SECTOR_A })).toBeNull();
  });

  it.each([null, undefined])("user %s → null", (user) => {
    expect(toAuthz(user)).toBeNull();
  });
});

describe("isAdmin", () => {
  const admin: Authz = {
    userId: "a",
    name: "A",
    email: "a@example.com",
    role: "admin",
    sectorId: null,
  };
  const operator: Authz = { ...admin, role: "operator", sectorId: SECTOR_A };

  it("é true só para admin", () => {
    expect(isAdmin(admin)).toBe(true);
    expect(isAdmin(operator)).toBe(false);
  });

  describe("canAccessSector", () => {
    it("admin acessa qualquer setor", () => {
      expect(canAccessSector(admin, SECTOR_A)).toBe(true);
      expect(canAccessSector(admin, SECTOR_B)).toBe(true);
    });

    it("operador acessa só o próprio setor", () => {
      expect(canAccessSector(operator, SECTOR_A)).toBe(true);
      expect(canAccessSector(operator, SECTOR_B)).toBe(false);
    });

    it("operador não acessa setor vazio", () => {
      expect(canAccessSector(operator, "")).toBe(false);
    });

    it("operador sem setor (estado inválido) não acessa nada", () => {
      const broken: Authz = { ...operator, sectorId: null };
      expect(canAccessSector(broken, SECTOR_A)).toBe(false);
      expect(canAccessSector(broken, "")).toBe(false);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test src/features/authz/authz.test.ts`
Expected: FAIL com `Cannot find module './authz'`

- [ ] **Step 3: Write minimal implementation (`authz`)**

Crie `src/features/authz/authz.ts`:
```ts
import { isRole, type Role } from "@/lib/roles";

export type Authz = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  sectorId: string | null;
};

export type SessionUserLike = {
  id: string;
  name: string;
  email: string;
  role?: unknown;
  sectorId?: unknown;
  deactivatedAt?: unknown;
};

// Fail-closed: qualquer dúvida sobre quem é a pessoa vira `null` (sem acesso).
export function toAuthz(
  user: SessionUserLike | null | undefined,
): Authz | null {
  if (!user) return null;
  if (user.deactivatedAt !== null && user.deactivatedAt !== undefined) {
    return null;
  }
  if (!isRole(user.role)) return null;

  const base = { userId: user.id, name: user.name, email: user.email };

  // O admin não tem setor (vê todos), mesmo que o banco guarde um.
  if (user.role === "admin") return { ...base, role: "admin", sectorId: null };

  if (typeof user.sectorId !== "string" || user.sectorId === "") return null;
  return { ...base, role: "operator", sectorId: user.sectorId };
}

export function isAdmin(authz: Authz): boolean {
  return authz.role === "admin";
}

export function canAccessSector(authz: Authz, sectorId: string): boolean {
  if (isAdmin(authz)) return true;
  return authz.sectorId !== null && authz.sectorId === sectorId;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test src/features/authz/authz.test.ts`
Expected: PASS (25 testes)

- [ ] **Step 5: Write the failing test (`scopeToSector` com PGlite)**

Crie `src/features/authz/sectorScope.test.ts`:
```ts
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { sector } from "@/db/schema";

import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertSector } from "../../../test/fixtures";
import type { Authz } from "./authz";
import { scopeToSector } from "./sectorScope";

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
});

function authzOf(role: Authz["role"], sectorId: string | null): Authz {
  return {
    userId: "u1",
    name: "Pessoa",
    email: "p@example.com",
    role,
    sectorId,
  };
}

async function visibleSectorNames(authz: Authz): Promise<string[]> {
  const rows = await db
    .select({ name: sector.name })
    .from(sector)
    .where(scopeToSector(authz, sector.id))
    .orderBy(sector.name);
  return rows.map((row) => row.name);
}

describe("scopeToSector (PGlite, query real em sector)", () => {
  it("operador só vê o próprio setor", async () => {
    const own = await insertSector(db, "Alfa");
    await insertSector(db, "Beta");
    await insertSector(db, "Gama");

    expect(await visibleSectorNames(authzOf("operator", own.id))).toEqual([
      "Alfa",
    ]);
  });

  it("admin vê todos os setores", async () => {
    await insertSector(db, "Alfa");
    await insertSector(db, "Beta");

    expect(await visibleSectorNames(authzOf("admin", null))).toEqual([
      "Alfa",
      "Beta",
    ]);
  });

  it("admin não gera condição (undefined), operador gera", () => {
    expect(scopeToSector(authzOf("admin", null), sector.id)).toBeUndefined();
    expect(
      scopeToSector(
        authzOf("operator", "11111111-1111-4111-8111-111111111111"),
        sector.id,
      ),
    ).toBeDefined();
  });

  it("operador de um setor que não existe não vê nada", async () => {
    await insertSector(db, "Alfa");

    expect(
      await visibleSectorNames(
        authzOf("operator", "99999999-9999-4999-8999-999999999999"),
      ),
    ).toEqual([]);
  });

  it("operador sem setor (estado inválido) não vê nada, em vez de ver tudo", async () => {
    await insertSector(db, "Alfa");

    expect(await visibleSectorNames(authzOf("operator", null))).toEqual([]);
  });

  it("sem nenhum setor cadastrado, ninguém vê nada", async () => {
    expect(await visibleSectorNames(authzOf("admin", null))).toEqual([]);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bun run test src/features/authz/sectorScope.test.ts`
Expected: FAIL com `Cannot find module './sectorScope'`

- [ ] **Step 7: Write minimal implementation (`sectorScope`)**

Crie `src/features/authz/sectorScope.ts`:
```ts
import { eq, type SQL, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { type Authz, isAdmin } from "./authz";

// Condição de escopo por setor para um WHERE (passe a coluna `sector_id` da
// tabela consultada). Admin: sem condição. Operador: só o próprio setor.
// Operador sem setor (estado que `toAuthz` já recusa) não enxerga nada.
export function scopeToSector(authz: Authz, column: PgColumn): SQL | undefined {
  if (isAdmin(authz)) return undefined;
  if (authz.sectorId === null) return sql`false`;
  return eq(column, authz.sectorId);
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun run test src/features/authz/sectorScope.test.ts`
Expected: PASS (6 testes)

- [ ] **Step 9: Write the failing test (`proxyRules`)**

Crie `src/features/authz/proxyRules.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import {
  isPublicPath,
  PUBLIC_PATH_PREFIXES,
  shouldRedirectToSignIn,
} from "./proxyRules";

describe("isPublicPath", () => {
  it("os prefixos públicos são /entrar e /convite", () => {
    expect(PUBLIC_PATH_PREFIXES).toEqual(["/entrar", "/convite"]);
  });

  it.each([
    "/entrar",
    "/entrar/",
    "/convite",
    "/convite/abc123",
    "/convite/abc123/",
  ])("%s é pública", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });

  it.each([
    "/",
    "/conta",
    "/admin",
    "/bem-vindo",
    "/entrarx",
    "/entrar-admin",
    "/convites",
    "/convitex/abc",
    "/admin/entrar",
    "//entrar",
    "/Entrar",
    "",
  ])("%s é privada (prefixo parecido não conta)", (pathname) => {
    expect(isPublicPath(pathname)).toBe(false);
  });
});

describe("shouldRedirectToSignIn", () => {
  it.each([
    "/",
    "/conta",
    "/admin",
    "/bem-vindo",
    "/passagens/nova",
  ])("rota privada %s sem cookie → redireciona", (pathname) => {
    expect(shouldRedirectToSignIn(pathname, false)).toBe(true);
  });

  it.each([
    "/",
    "/conta",
    "/admin",
    "/bem-vindo",
  ])("rota privada %s com cookie → deixa passar", (pathname) => {
    expect(shouldRedirectToSignIn(pathname, true)).toBe(false);
  });

  it.each([
    "/entrar",
    "/convite/abc123",
  ])("rota pública %s não redireciona, com ou sem cookie", (pathname) => {
    expect(shouldRedirectToSignIn(pathname, false)).toBe(false);
    expect(shouldRedirectToSignIn(pathname, true)).toBe(false);
  });

  it.each([
    "/api",
    "/api/auth/sign-in/email",
    "/api/health",
  ])("%s nunca redireciona", (pathname) => {
    expect(shouldRedirectToSignIn(pathname, false)).toBe(false);
  });

  it.each([
    "/entrarx",
    "/entrar-admin",
    "/apix",
    "/apiary",
    "/convites",
  ])("prefixo parecido %s sem cookie → redireciona", (pathname) => {
    expect(shouldRedirectToSignIn(pathname, false)).toBe(true);
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `bun run test src/features/authz/proxyRules.test.ts`
Expected: FAIL com `Cannot find module './proxyRules'`

- [ ] **Step 11: Write minimal implementation (`proxyRules`)**

Crie `src/features/authz/proxyRules.ts`:
```ts
export const PUBLIC_PATH_PREFIXES: readonly string[] = ["/entrar", "/convite"];

function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

// Casa o prefixo por segmento inteiro: "/entrar" e "/entrar/x" são públicos,
// "/entrarx" não é.
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

// Decisão otimista do proxy: só olha se existe cookie de sessão, não se ele é
// válido. `/api/*` nunca redireciona (cada rota de API se autentica sozinha e
// o Better Auth precisa responder a quem ainda não tem sessão).
export function shouldRedirectToSignIn(
  pathname: string,
  hasSessionCookie: boolean,
): boolean {
  if (hasSessionCookie) return false;
  if (isApiPath(pathname)) return false;
  return !isPublicPath(pathname);
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `bun run test src/features/authz/proxyRules.test.ts`
Expected: PASS (37 testes)

- [ ] **Step 13: Write the failing test (`session.ts`)**

`session.ts` depende de `next/headers`, `next/navigation` e do singleton `@/lib/auth`; o teste troca os três por mocks (`redirect` e `notFound` lançam, como no Next) e injeta um `createTestAuth` sobre PGlite no lugar do singleton. A sessão é real (cadastro por convite, `signInEmail`, cookie), então os testes provam que **desativar** ou **trocar o setor** vale na próxima leitura, sem cache.

Crie `src/lib/auth/session.test.ts`:
```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { user } from "@/db/schema";

import {
  createTestAuth,
  sessionCookieOf,
  signUpWithInvite,
} from "../../../test/auth";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertInvite, insertSector } from "../../../test/fixtures";
import type { Auth } from "./createAuth";

const holder: { auth: Auth | null; headers: Headers } = vi.hoisted(() => ({
  auth: null,
  headers: new Headers(),
}));

vi.mock("@/lib/auth", () => ({
  get auth() {
    return holder.auth;
  },
}));

vi.mock("next/headers", () => ({
  headers: async () => holder.headers,
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { getAuthz, requireAdmin, requireUser } = await import("./session");

const PASSWORD = "senha-segura-123";

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
  holder.auth = createTestAuth(db);
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
  holder.headers = new Headers();
});

async function signUpAndLogin(
  role: "admin" | "operator",
  email: string,
): Promise<{ sectorId: string | null }> {
  const auth = holder.auth;
  if (!auth) throw new Error("auth não montado");
  const sector = role === "operator" ? await insertSector(db) : null;
  const { token } = await insertInvite(db, {
    role,
    sectorId: sector?.id ?? null,
  });
  await signUpWithInvite(auth, token, {
    name: "Pessoa Teste",
    email,
    password: PASSWORD,
  });
  const { headers } = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    returnHeaders: true,
  });
  holder.headers = new Headers({ cookie: sessionCookieOf(headers) });
  return { sectorId: sector?.id ?? null };
}

describe("getAuthz", () => {
  it("sem cookie → null", async () => {
    expect(await getAuthz()).toBeNull();
  });

  it("cookie de sessão inventado → null", async () => {
    holder.headers = new Headers({
      cookie: "better-auth.session_token=falso.falso",
    });
    expect(await getAuthz()).toBeNull();
  });

  it("operador logado → Authz com papel e setor", async () => {
    const { sectorId } = await signUpAndLogin("operator", "op@example.com");

    expect(await getAuthz()).toMatchObject({
      email: "op@example.com",
      role: "operator",
      sectorId,
    });
  });

  it("admin logado → Authz sem setor", async () => {
    await signUpAndLogin("admin", "admin@example.com");

    expect(await getAuthz()).toMatchObject({ role: "admin", sectorId: null });
  });

  it("desativar a pessoa vale na próxima leitura, com a sessão ainda aberta", async () => {
    await signUpAndLogin("admin", "admin@example.com");
    expect(await getAuthz()).not.toBeNull();

    await db.update(user).set({ deactivatedAt: new Date() });

    expect(await getAuthz()).toBeNull();
  });

  it("mudar o setor vale na próxima leitura (sem cache de sessão)", async () => {
    await signUpAndLogin("operator", "op@example.com");
    const other = await insertSector(db, "Outro setor");
    await db
      .update(user)
      .set({ sectorId: other.id })
      .where(eq(user.email, "op@example.com"));

    expect(await getAuthz()).toMatchObject({ sectorId: other.id });
  });
});

describe("requireUser", () => {
  it("sem sessão redireciona para /entrar", async () => {
    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT /entrar");
  });

  it("desativado redireciona para /entrar", async () => {
    await signUpAndLogin("operator", "op@example.com");
    await db.update(user).set({ deactivatedAt: new Date() });

    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT /entrar");
  });

  it("com sessão devolve o Authz", async () => {
    await signUpAndLogin("operator", "op@example.com");

    await expect(requireUser()).resolves.toMatchObject({ role: "operator" });
  });
});

describe("requireAdmin", () => {
  it("sem sessão redireciona para /entrar (não 404)", async () => {
    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT /entrar");
  });

  it("operador recebe 404 (notFound)", async () => {
    await signUpAndLogin("operator", "op@example.com");

    await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("admin passa", async () => {
    await signUpAndLogin("admin", "admin@example.com");

    await expect(requireAdmin()).resolves.toMatchObject({ role: "admin" });
  });

  it("admin desativado com sessão aberta é barrado", async () => {
    await signUpAndLogin("admin", "admin@example.com");
    await db.update(user).set({ deactivatedAt: new Date() });

    await expect(requireAdmin()).rejects.toThrow("NEXT_REDIRECT /entrar");
  });
});
```

- [ ] **Step 14: Run test to verify it fails**

Run: `bun run test src/lib/auth/session.test.ts`
Expected: FAIL com `Cannot find module '/src/lib/auth/session' imported from .../src/lib/auth/session.test.ts`

- [ ] **Step 15: Write minimal implementation (`session.ts`)**

Sem `cookieCache` (T7), então `getSession` já lê fresco do banco. `cache()` do React só deduplica dentro de uma requisição. `requireAdmin` usa `notFound()` (T12): operador em `/admin` recebe 404, não 403.

Crie `src/lib/auth/session.ts`:
```ts
import "server-only";

import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { type Authz, isAdmin, toAuthz } from "@/features/authz/authz";
import { auth } from "@/lib/auth";

// Lê a sessão fresca do banco (sem cookieCache: desativar vale na hora) e
// memoiza por requisição. Chame sempre dentro de <Suspense> (Cache Components);
// nunca de função "use cache".
export const getAuthz: () => Promise<Authz | null> = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return toAuthz(session?.user);
});

export async function requireUser(): Promise<Authz> {
  const authz = await getAuthz();
  if (!authz) redirect("/entrar");
  return authz;
}

// Operador em /admin recebe 404, não 403: não revela o que existe (T12).
export async function requireAdmin(): Promise<Authz> {
  const authz = await requireUser();
  if (!isAdmin(authz)) notFound();
  return authz;
}
```

- [ ] **Step 16: Run test to verify it passes**

Run: `bun run test src/lib/auth/session.test.ts`
Expected: PASS (13 testes)

- [ ] **Step 17: Write the failing test (`proxy`)**

O teste chama `proxy()` com `NextRequest` de verdade (roda no projeto `node`) e confere o `config.matcher` como regex ancorada: o mesmo texto serve para o Next (path-to-regexp) e para `RegExp`.

Crie `src/proxy.test.ts`:
```ts
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { config, proxy } from "./proxy";

function request(path: string, cookie?: string): NextRequest {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  });
}

describe("proxy", () => {
  it("rota privada sem cookie → 307 para /entrar", () => {
    const response = proxy(request("/conta"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/entrar",
    );
  });

  it("rota privada com cookie de sessão → segue", () => {
    const response = proxy(request("/conta", "better-auth.session_token=abc"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("cookie de sessão com prefixo __Secure- (produção) também vale", () => {
    const response = proxy(
      request("/", "__Secure-better-auth.session_token=abc"),
    );
    expect(response.headers.get("location")).toBeNull();
  });

  it("outro cookie qualquer não vale como sessão", () => {
    const response = proxy(request("/", "closery_invite=abc; theme=dark"));
    expect(response.status).toBe(307);
  });

  it("/entrar e /convite/x sem cookie → segue", () => {
    expect(proxy(request("/entrar")).headers.get("location")).toBeNull();
    expect(
      proxy(request(`/convite/${"A".repeat(43)}`)).headers.get("location"),
    ).toBeNull();
  });

  it("/entrarx sem cookie → /entrar (prefixo parecido não é público)", () => {
    expect(proxy(request("/entrarx")).status).toBe(307);
  });
});

describe("config.matcher", () => {
  const [source] = config.matcher;
  const regex = new RegExp(`^${source}$`);

  it.each([
    "/",
    "/conta",
    "/admin",
    "/bem-vindo",
    "/entrar",
    `/convite/${"A".repeat(43)}`,
    "/apiary",
    "/passagens/nova",
  ])("roda em %s", (pathname) => {
    expect(regex.test(pathname)).toBe(true);
  });

  it.each([
    "/api",
    "/api/auth/sign-in/email",
    "/api/health",
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/favicon.ico",
    "/logo.png",
    "/robots.txt",
    "/fonts/inter.woff2",
  ])("não roda em %s", (pathname) => {
    expect(regex.test(pathname)).toBe(false);
  });
});
```

- [ ] **Step 18: Run test to verify it fails**

Run: `bun run test src/proxy.test.ts`
Expected: FAIL com `Cannot find module './proxy'`

- [ ] **Step 19: Confirmar na doc instalada onde o `proxy.ts` mora**

Run: `grep -n "inside .src.\|named .proxy.\|Node.js runtime" node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md | head -5`
Expected (trechos): linha 25 "Create a proxy.ts (or .js) file in the project root, or inside src if applicable, so that it is located at the same level as pages or app."; linha 60 "The file must export a single function, either as a default export or named proxy."; linha 257 "Proxy defaults to using the Node.js runtime." Como o projeto usa `src/app`, o arquivo é `src/proxy.ts`, com `export function proxy`. A doc também avisa (linha 251) que um `matcher` que exclui um caminho também pula as Server Functions desse caminho; por isso **toda** Server Action revalida sessão, papel e setor sozinha (via `session.ts`) e o proxy é só otimista.

- [ ] **Step 20: Write minimal implementation (`proxy.ts`)**

Crie `src/proxy.ts`:
```ts
import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

import { shouldRedirectToSignIn } from "@/features/authz/proxyRules";

// Barreira OTIMISTA: só olha se existe um cookie de sessão, sem consultar o
// banco nem validar a assinatura. Serve para mandar quem claramente não entrou
// para /entrar sem renderizar nada. A autorização de verdade (sessão válida,
// papel, setor) acontece em cada página e Server Action, via session.ts.
export function proxy(request: NextRequest) {
  const hasSessionCookie = Boolean(getSessionCookie(request));

  if (shouldRedirectToSignIn(request.nextUrl.pathname, hasSessionCookie)) {
    return NextResponse.redirect(new URL("/entrar", request.url));
  }
  return NextResponse.next();
}

// Fica de fora: /api (cada rota se autentica), arquivos do Next, favicon e
// qualquer arquivo com extensão (public/). `api(?:/|$)` não pega "/apiary".
export const config = {
  matcher: [
    "/((?!api(?:/|$)|_next/static|_next/image|favicon\\.ico|.*\\.[^/]+$).*)",
  ],
};
```

- [ ] **Step 21: Run test to verify it passes**

Run: `bun run test src/proxy.test.ts`
Expected: PASS (23 testes)

- [ ] **Step 22: Fumaça real do proxy (build + servidor)**

O proxy só olha o cookie; não consulta o banco, então um `DATABASE_URL` falso basta. O servidor sobe em segundo plano com o PID guardado, para encerrar só ele.

```bash
export BETTER_AUTH_SECRET="$(openssl rand -base64 32)" BETTER_AUTH_URL=http://localhost:3391 DATABASE_URL=postgres://u:p@127.0.0.1:5999/x
bunx next build
node node_modules/next/dist/bin/next start -p 3391 > /tmp/closery-smoke.log 2>&1 &
PID=$!
# espera o servidor aceitar conexão (qualquer resposta HTTP serve; /api/health dá 503 com o banco falso)
curl -s -o /dev/null --retry 30 --retry-connrefused --retry-delay 1 http://localhost:3391/api/health
for p in / /conta /entrar /logo.png; do echo -n "$p -> "; curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "http://localhost:3391$p"; done
echo -n "/ com cookie -> "; curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -H "cookie: better-auth.session_token=x" http://localhost:3391/
kill $PID
```
Expected: o `next build` lista `ƒ Proxy (Middleware)`; `/ -> 307 http://localhost:3391/entrar`; `/conta -> 307 http://localhost:3391/entrar`; `/entrar -> 404` e `/logo.png -> 404` (não é 307: são públicas ou fora do `matcher`; 404 porque a página e o arquivo ainda não existem); `/ com cookie -> 200`. (O cookie falso só prova o comportamento otimista: quem o valida é `session.ts`.)

- [ ] **Step 23: Run the full gates**

Run: `bun run check-types && bun run lint && bun run test`
Expected: PASS nos três. Os arquivos desta tarefa somam 104 testes (25 + 6 + 37 + 13 + 23). Se o `lint` reclamar de formatação: `bunx biome check --write src/features/authz src/lib/auth/session.ts src/lib/auth/session.test.ts src/proxy.ts src/proxy.test.ts` e rode de novo.

- [ ] **Step 24: Commit**

```bash
git add src/features/authz src/lib/auth/session.ts src/lib/auth/session.test.ts src/proxy.ts src/proxy.test.ts
git commit -F - <<'EOF'
feat(authz): papéis, escopo por setor, sessão no servidor e proxy otimista

toAuthz falha fechado (desativado, papel desconhecido ou operador sem setor
viram null). scopeToSector restringe o operador ao próprio setor na query.
getAuthz lê a sessão fresca (sem cookieCache); requireAdmin responde 404 a
operador. proxy.ts só redireciona quem não tem cookie de sessão.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 8: Shell autenticado, Início, `/admin`, `error` e `not-found`

**Files:**
- Create: `src/lib/names.ts`
- Create: `src/components/app-shell/navItems.ts`
- Create: `src/components/app-shell/AppSidebar.tsx`
- Create: `src/components/app-shell/AuthedSidebar.tsx`
- Create: `src/components/app-shell/SidebarSkeleton.tsx`
- Create: `src/components/app-shell/MenuToggle.tsx` (+ `MenuToggle.test.tsx`)
- Create: `src/components/app-shell/Greeting.tsx`
- Create: `src/components/app-shell/AdminOverview.tsx`
- Create: `src/app/error.tsx`
- Create: `src/app/not-found.tsx`
- Create: `src/app/(app)/layout.tsx`
- Create: `src/app/(app)/page.tsx`
- Create: `src/app/(app)/admin/page.tsx`
- Modify: `src/app/layout.tsx` (title template, `TooltipProvider`, `Toaster`)
- Modify: `src/components/ui/sidebar.tsx` (textos acessíveis em pt-BR: "Alternar menu", gaveta "Menu")
- Modify: `src/components/ui/sheet.tsx` (`sr-only` "Close" vira "Fechar")
- Modify: `.context/ui-registry.md` (itens de `app-shell`; histórico de Sidebar e Sheet)
- Delete: `src/app/page.tsx` (vira `src/app/(app)/page.tsx`)
- Test: `src/lib/names.test.ts`, `src/components/app-shell/navItems.test.ts`, `src/components/app-shell/AppSidebar.test.tsx`, `src/components/app-shell/Greeting.test.tsx`, `src/components/app-shell/AdminOverview.test.tsx`, `src/components/app-shell/AuthedSidebar.test.tsx`, `src/components/app-shell/SidebarSkeleton.test.tsx`, `src/components/ui/ptBrLabels.test.tsx`, `src/app/error.test.tsx`, `src/app/not-found.test.tsx`

**Interfaces:**
- Consumes:
  - Task 3: `Sidebar*`, `SidebarProvider`, `SidebarInset`, `SidebarTrigger`, `SidebarRail`, `useSidebar`, `Skeleton`, `Sheet*`, `TooltipProvider`, `Toaster`, `Button`, `buttonVariants`.
  - Task 7 (`src/lib/auth/session.ts`, `server-only`): `requireUser(): Promise<Authz>` (`redirect("/entrar")` se sem sessão) e `requireAdmin(): Promise<Authz>` (`requireUser` + `notFound()` se não admin).
  - Task 7 (`src/features/authz/authz.ts`): `type Authz = { userId: string; name: string; email: string; role: Role; sectorId: string | null }`.
  - Task 1: projetos Vitest `node` (`*.test.ts`) e `dom` (`*.test.tsx`), alias `server-only`.
- Produces:
  - `src/lib/names.ts`: `firstName(fullName: string): string` e `greetingTitle(fullName: string): string` (`"Olá, Maria"`; nome vazio devolve `"Olá"`).
  - `src/components/app-shell/navItems.ts`: `type NavItem = { href: string; label: string; icon: LucideIcon; adminOnly: boolean }`, `NAV_ITEMS: readonly NavItem[]`, `visibleNavItems(isAdmin: boolean): NavItem[]`, `isNavItemActive(pathname: string, href: string): boolean`.
  - `src/components/app-shell/AppSidebar.tsx`: `AppSidebar({ isAdmin, userName, userEmail }: { isAdmin: boolean; userName: string; userEmail: string })` (`"use client"`).
  - `src/components/app-shell/AuthedSidebar.tsx`: `AuthedSidebar(): Promise<JSX.Element>` (servidor).
  - `src/components/app-shell/SidebarSkeleton.tsx`: `SidebarSkeleton()`.
  - `src/components/app-shell/Greeting.tsx`: `Greeting(): Promise<JSX.Element>`; `src/components/app-shell/AdminOverview.tsx`: `AdminOverview(): Promise<JSX.Element>`.
  - Layout `src/app/(app)/layout.tsx`: toda página do grupo `(app)` (Início, `/admin`, e as `/bem-vindo` e `/conta` das Tasks 11) renderiza dentro do shell. As Tasks 9–11 criam páginas fora do shell em `(auth)`.
  - Regra de uso para as Tasks 9–11: link com aparência de botão = `<Link href=… className={buttonVariants({ … })}>` (não `Button render={<Link />}`, que põe `role="button"` no `<a>`).

- [ ] **Step 1: Write the failing test (helpers puros)**

```ts
// src/lib/names.test.ts
import { describe, expect, it } from "vitest";

import { firstName, greetingTitle } from "@/lib/names";

describe("firstName", () => {
  it("devolve a primeira palavra do nome", () => {
    expect(firstName("Maria Souza")).toBe("Maria");
  });

  it("devolve o nome inteiro quando há uma palavra só", () => {
    expect(firstName("Ana")).toBe("Ana");
  });

  it("ignora espaços nas pontas e repetidos", () => {
    expect(firstName("   Ana    Paula  ")).toBe("Ana");
  });

  it("trata quebra de linha e tabulação como separador", () => {
    expect(firstName("Ana\tPaula")).toBe("Ana");
    expect(firstName("Ana\nPaula")).toBe("Ana");
  });

  it("preserva acentos e caracteres fora do latim básico", () => {
    expect(firstName("José Álvaro")).toBe("José");
    expect(firstName("李 雷")).toBe("李");
  });

  it("devolve texto vazio para nome vazio ou só de espaços", () => {
    expect(firstName("")).toBe("");
    expect(firstName("   ")).toBe("");
  });
});

describe("greetingTitle", () => {
  it("monta 'Olá, {primeiro nome}'", () => {
    expect(greetingTitle("Maria Souza")).toBe("Olá, Maria");
  });

  it("cai para 'Olá' sem vírgula solta quando o nome está vazio", () => {
    expect(greetingTitle("")).toBe("Olá");
    expect(greetingTitle("  ")).toBe("Olá");
  });
});
```

```ts
// src/components/app-shell/navItems.test.ts
import { describe, expect, it } from "vitest";

import {
  isNavItemActive,
  NAV_ITEMS,
  visibleNavItems,
} from "@/components/app-shell/navItems";

describe("visibleNavItems", () => {
  it("operador vê Início e Conta, sem Administração", () => {
    expect(visibleNavItems(false).map((item) => item.label)).toEqual([
      "Início",
      "Conta",
    ]);
  });

  it("admin vê também Administração, por último", () => {
    expect(visibleNavItems(true).map((item) => item.label)).toEqual([
      "Início",
      "Conta",
      "Administração",
    ]);
  });

  it("as rotas são as do contrato", () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([
      "/",
      "/conta",
      "/admin",
    ]);
  });

  it("só Administração é restrita a admin", () => {
    expect(
      NAV_ITEMS.filter((item) => item.adminOnly).map((item) => item.href),
    ).toEqual(["/admin"]);
  });
});

describe("isNavItemActive", () => {
  it("Início só é ativo na raiz exata", () => {
    expect(isNavItemActive("/", "/")).toBe(true);
    expect(isNavItemActive("/conta", "/")).toBe(false);
    expect(isNavItemActive("/admin/equipe", "/")).toBe(false);
  });

  it("rota própria e subrotas são ativas", () => {
    expect(isNavItemActive("/conta", "/conta")).toBe(true);
    expect(isNavItemActive("/admin", "/admin")).toBe(true);
    expect(isNavItemActive("/admin/setores", "/admin")).toBe(true);
  });

  it("prefixo parecido que não é subrota não é ativo", () => {
    expect(isNavItemActive("/contabilidade", "/conta")).toBe(false);
    expect(isNavItemActive("/administrador", "/admin")).toBe(false);
  });

  it("rota diferente não é ativa", () => {
    expect(isNavItemActive("/entrar", "/conta")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/lib/names.test.ts src/components/app-shell/navItems.test.ts`
Expected: FAIL com `Cannot find package '@/lib/names'` e `Cannot find package '@/components/app-shell/navItems'` (2 arquivos falhando, "no tests").

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/names.ts
/** Primeira palavra do nome; vazio se o nome for vazio ou só espaços. */
export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

/** Título do Início: "Olá, Maria"; sem nome, "Olá" (nunca "Olá, "). */
export function greetingTitle(fullName: string): string {
  const name = firstName(fullName);
  return name ? `Olá, ${name}` : "Olá";
}
```

```ts
// src/components/app-shell/navItems.ts
import { House, type LucideIcon, ShieldCheck, UserRound } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly: boolean;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Início", icon: House, adminOnly: false },
  { href: "/conta", label: "Conta", icon: UserRound, adminOnly: false },
  {
    href: "/admin",
    label: "Administração",
    icon: ShieldCheck,
    adminOnly: true,
  },
];

export function visibleNavItems(isAdmin: boolean): NavItem[] {
  return NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly);
}

/** "/" só é ativo na raiz; as demais valem para a rota e suas subrotas. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx biome check --write src && bun run test -- src/lib/names.test.ts src/components/app-shell/navItems.test.ts`
Expected: PASS (2 arquivos, 16 testes: 8 em `names.test.ts`, 8 em `navItems.test.ts`).

- [ ] **Step 5: Write the failing test (AppSidebar)**

```tsx
// src/components/app-shell/AppSidebar.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

const mocks = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

// Expõe o estado da gaveta do celular e deixa o teste abri-la.
function MobileSheetProbe() {
  const { openMobile, setOpenMobile } = useSidebar();
  return (
    <>
      <output aria-label="gaveta">{openMobile ? "aberta" : "fechada"}</output>
      <button type="button" onClick={() => setOpenMobile(true)}>
        abrir gaveta
      </button>
    </>
  );
}

function renderSidebar(props: Partial<Parameters<typeof AppSidebar>[0]> = {}) {
  return render(
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar
          isAdmin={false}
          userName="Maria Souza"
          userEmail="maria@example.com"
          {...props}
        />
        <MobileSheetProbe />
      </SidebarProvider>
    </TooltipProvider>,
  );
}

describe("AppSidebar", () => {
  beforeEach(() => {
    mocks.pathname = "/";
  });

  it("operador vê Início e Conta, e não vê Administração", () => {
    renderSidebar({ isAdmin: false });

    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getByRole("link", { name: "Conta" })).toHaveAttribute(
      "href",
      "/conta",
    );
    expect(
      screen.queryByRole("link", { name: "Administração" }),
    ).not.toBeInTheDocument();
  });

  it("admin vê Administração apontando para /admin", () => {
    renderSidebar({ isAdmin: true });

    expect(screen.getByRole("link", { name: "Administração" })).toHaveAttribute(
      "href",
      "/admin",
    );
  });

  it("marca só o item da rota atual com aria-current", () => {
    mocks.pathname = "/conta";
    renderSidebar({ isAdmin: true });

    expect(screen.getByRole("link", { name: "Conta" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Início" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(
      screen.getByRole("link", { name: "Administração" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("Início fica ativo na raiz", () => {
    mocks.pathname = "/";
    renderSidebar();

    expect(screen.getByRole("link", { name: "Início" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("subrota de /admin mantém Administração ativo", () => {
    mocks.pathname = "/admin/equipe";
    renderSidebar({ isAdmin: true });

    expect(screen.getByRole("link", { name: "Administração" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("rota fora do menu não marca nenhum item", () => {
    mocks.pathname = "/bem-vindo";
    renderSidebar({ isAdmin: true });

    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });

  it("mostra nome e e-mail da pessoa no rodapé", () => {
    renderSidebar({ userName: "Maria Souza", userEmail: "maria@example.com" });

    expect(screen.getByText("Maria Souza")).toBeInTheDocument();
    expect(screen.getByText("maria@example.com")).toBeInTheDocument();
  });

  it("fecha a gaveta do celular ao navegar", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole("button", { name: "abrir gaveta" }));
    expect(screen.getByLabelText("gaveta")).toHaveTextContent("aberta");

    await user.click(screen.getByRole("link", { name: "Conta" }));
    expect(screen.getByLabelText("gaveta")).toHaveTextContent("fechada");
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bun run test -- src/components/app-shell/AppSidebar.test.tsx`
Expected: FAIL com `Failed to resolve import "@/components/app-shell/AppSidebar"`.

- [ ] **Step 7: Write minimal implementation**

```tsx
// src/components/app-shell/AppSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  isNavItemActive,
  visibleNavItems,
} from "@/components/app-shell/navItems";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

type AppSidebarProps = {
  isAdmin: boolean;
  userName: string;
  userEmail: string;
};

export function AppSidebar({ isAdmin, userName, userEmail }: AppSidebarProps) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();

  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-3 text-base font-semibold">
        Closery
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNavItems(isAdmin).map(({ href, label, icon: Icon }) => {
                const isActive = isNavItemActive(pathname, href);
                return (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={
                        <Link
                          href={href}
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => setOpenMobile(false)}
                        />
                      }
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-4 py-3">
        <p className="truncate text-sm font-medium">{userName}</p>
        <p className="truncate text-xs text-sidebar-foreground/70">
          {userEmail}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bunx biome check --write src && bun run test -- src/components/app-shell/AppSidebar.test.tsx`
Expected: PASS (8 testes). O `next/link` funciona sem roteador no ambiente de teste (renderiza `<a>`), então o clique no link dispara o `onClick` que fecha a gaveta. Sanidade opcional: apagar a linha `onClick={() => setOpenMobile(false)}` faz só o teste "fecha a gaveta do celular ao navegar" falhar.

- [ ] **Step 9: Write the failing test (textos acessíveis em pt-BR dos primitivos)**

O shadcn entrega `sr-only`/`aria-label` em inglês ("Toggle Sidebar", "Close", gaveta "Sidebar"). O leitor de tela da operação precisa ler pt-BR.

```tsx
// src/components/ui/ptBrLabels.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";

// Os primitivos do shadcn vêm em inglês; o que o leitor de tela lê tem que ser pt-BR.
describe("rótulos acessíveis dos primitivos em pt-BR", () => {
  it("SidebarTrigger e SidebarRail se chamam 'Alternar menu'", () => {
    render(
      <SidebarProvider>
        <SidebarTrigger />
        <SidebarRail />
      </SidebarProvider>,
    );

    expect(
      screen.getAllByRole("button", { name: "Alternar menu" }),
    ).toHaveLength(2);
    expect(screen.queryByText("Toggle Sidebar")).not.toBeInTheDocument();
  });

  it("o botão de fechar do Sheet se chama 'Fechar'", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Título</SheetTitle>
          <SheetDescription>Descrição</SheetDescription>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    expect(screen.queryByText("Close")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `bun run test -- src/components/ui/ptBrLabels.test.tsx`
Expected: FAIL com `Unable to find an accessible element with the role "button" and name "Alternar menu"` e `… name "Fechar"` (2 testes falhando).

- [ ] **Step 11: Write minimal implementation (traduzir)**

Run:
```bash
sed -i 's/Toggle Sidebar/Alternar menu/g; s#<SheetTitle>Sidebar</SheetTitle>#<SheetTitle>Menu</SheetTitle>#; s#Displays the mobile sidebar\.#Navegação do aplicativo.#' src/components/ui/sidebar.tsx
sed -i 's#<span className="sr-only">Close</span>#<span className="sr-only">Fechar</span>#' src/components/ui/sheet.tsx
git diff --stat src/components/ui/sidebar.tsx src/components/ui/sheet.tsx
```
Expected: `git diff --stat` mostra `sidebar.tsx` com 4 linhas trocadas (`SheetTitle`, `SheetDescription`, o `sr-only` do `SidebarTrigger`, e `aria-label`+`title` do `SidebarRail`, somando 5 linhas de diff) e `sheet.tsx` com 1.

- [ ] **Step 12: Run test to verify it passes**

Run: `bun run test -- src/components/ui`
Expected: PASS (5 arquivos, 26 testes: os 24 de `src/components/ui` das Tarefas 1 e 3 + 2 de `ptBrLabels.test.tsx`).

- [ ] **Step 13: Write the failing test (error.tsx e not-found.tsx)**

```tsx
// src/app/error.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import ErrorPage from "@/app/error";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("error.tsx", () => {
  it("mostra o título e o botão 'Tentar de novo'", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorPage error={new Error("falha interna")} retry={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: "Algo deu errado" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Tentar de novo" }),
    ).toBeInTheDocument();
  });

  it("clicar em 'Tentar de novo' chama retry uma vez", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    render(<ErrorPage error={new Error("falha interna")} retry={retry} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" }),
    );

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("não vaza a mensagem do erro na tela, mas registra no console", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const error = new Error("senha do banco: hunter2");
    render(<ErrorPage error={error} retry={vi.fn()} />);

    expect(screen.queryByText(/hunter2/)).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(error);
  });

  it("aceita erro que não é Error (o tipo da prop é unknown)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorPage error="texto solto" retry={vi.fn()} />);

    expect(screen.getByText("Algo deu errado")).toBeInTheDocument();
  });
});
```

```tsx
// src/app/not-found.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import NotFound from "@/app/not-found";

describe("not-found.tsx", () => {
  it("mostra o título 'Página não encontrada'", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("heading", { name: "Página não encontrada" }),
    ).toBeInTheDocument();
  });

  it("o link 'Voltar ao início' aponta para / e é um link, não um botão", () => {
    render(<NotFound />);

    expect(
      screen.getByRole("link", { name: "Voltar ao início" }),
    ).toHaveAttribute("href", "/");
  });
});
```

- [ ] **Step 14: Run test to verify it fails**

Run: `bun run test -- src/app`
Expected: FAIL com `Failed to resolve import "@/app/error"` e `"@/app/not-found"`.

- [ ] **Step 15: Write minimal implementation**

A prop é `retry` (Next 16.3+; fonte: `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md`, tabela de versões: "`v16.3.0` `retry` prop became stable"), não `reset`.

```tsx
// src/app/error.tsx
"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

type ErrorPageProps = {
  error: unknown;
  retry: () => void;
};

export default function ErrorPage({ error, retry }: ErrorPageProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Algo deu errado</h1>
      <Button onClick={() => retry()}>Tentar de novo</Button>
    </main>
  );
}
```

```tsx
// src/app/not-found.tsx
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Página não encontrada
      </h1>
      {/* buttonVariants em vez de Button render={<Link />}: o Button do Base UI
          põe role="button" no <a>, e navegação tem que continuar sendo link. */}
      <Link href="/" className={buttonVariants()}>
        Voltar ao início
      </Link>
    </main>
  );
}
```

- [ ] **Step 16: Run test to verify it passes**

Run: `bunx biome check --write src && bun run test -- src/app`
Expected: PASS (2 arquivos, 6 testes: 4 em `error.test.tsx`, 2 em `not-found.test.tsx`). `not-found.tsx` é Server Component e só renderiza `Link` e a string de `buttonVariants` (nenhuma função de módulo `"use client"` é chamada).

- [ ] **Step 17: Write the failing test (Greeting, AdminOverview, AuthedSidebar, SidebarSkeleton)**

Componentes servidor assíncronos folha são testados chamando `await Componente()` e renderizando o resultado; a sessão é simulada com `vi.mock("@/lib/auth/session")` (o módulo real é `server-only` e depende de `cookies()`).

```tsx
// src/components/app-shell/Greeting.test.tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Greeting } from "@/components/app-shell/Greeting";
import type { Authz } from "@/features/authz/authz";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));

function authz(overrides: Partial<Authz> = {}): Authz {
  return {
    userId: "u1",
    name: "Maria Souza",
    email: "maria@example.com",
    role: "operator",
    sectorId: "s1",
    ...overrides,
  };
}

describe("Greeting", () => {
  beforeEach(() => {
    mocks.requireUser.mockReset();
  });

  it("mostra 'Olá, {primeiro nome}' e o texto do Início", async () => {
    mocks.requireUser.mockResolvedValue(authz({ name: "Maria Souza" }));

    render(await Greeting());

    expect(
      screen.getByRole("heading", { level: 1, name: "Olá, Maria" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Em breve: passagem de turno, solicitações e dashboard."),
    ).toBeInTheDocument();
  });

  it("nome vazio não deixa vírgula solta", async () => {
    mocks.requireUser.mockResolvedValue(authz({ name: "  " }));

    render(await Greeting());

    expect(
      screen.getByRole("heading", { level: 1, name: "Olá" }),
    ).toBeInTheDocument();
  });

  it("sem sessão, propaga o redirect de requireUser (não renderiza)", async () => {
    mocks.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(Greeting()).rejects.toThrow("NEXT_REDIRECT");
  });
});
```

```tsx
// src/components/app-shell/AdminOverview.test.tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminOverview } from "@/components/app-shell/AdminOverview";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));

describe("AdminOverview", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset();
  });

  it("admin vê o título e o texto de Administração", async () => {
    mocks.requireAdmin.mockResolvedValue({ role: "admin" });

    render(await AdminOverview());

    expect(
      screen.getByRole("heading", { level: 1, name: "Administração" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Setores, turnos, itens, destinos e equipe chegam na próxima etapa.",
      ),
    ).toBeInTheDocument();
  });

  it("operador: requireAdmin lança (notFound) e nada é renderizado", async () => {
    mocks.requireAdmin.mockRejectedValue(
      new Error("NEXT_HTTP_ERROR_FALLBACK;404"),
    );

    await expect(AdminOverview()).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
  });
});
```

```tsx
// src/components/app-shell/AuthedSidebar.test.tsx
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { AuthedSidebar } from "@/components/app-shell/AuthedSidebar";
import type { Authz } from "@/features/authz/authz";

const mocks = vi.hoisted(() => ({ requireUser: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));

function authz(overrides: Partial<Authz> = {}): Authz {
  return {
    userId: "u1",
    name: "Maria Souza",
    email: "maria@example.com",
    role: "operator",
    sectorId: "s1",
    ...overrides,
  };
}

describe("AuthedSidebar", () => {
  beforeEach(() => {
    mocks.requireUser.mockReset();
  });

  it("operador: isAdmin false, com nome e e-mail da sessão", async () => {
    mocks.requireUser.mockResolvedValue(authz());

    const element = await AuthedSidebar();

    expect(isValidElement(element)).toBe(true);
    expect(element.type).toBe(AppSidebar);
    expect(element.props).toEqual({
      isAdmin: false,
      userName: "Maria Souza",
      userEmail: "maria@example.com",
    });
  });

  it("admin: isAdmin true", async () => {
    mocks.requireUser.mockResolvedValue(
      authz({ role: "admin", sectorId: null }),
    );

    const element = await AuthedSidebar();

    expect(element.props.isAdmin).toBe(true);
  });

  it("sem sessão, propaga o redirect de requireUser", async () => {
    mocks.requireUser.mockRejectedValue(new Error("NEXT_REDIRECT"));

    await expect(AuthedSidebar()).rejects.toThrow("NEXT_REDIRECT");
  });
});
```

```tsx
// src/components/app-shell/SidebarSkeleton.test.tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SidebarSkeleton } from "@/components/app-shell/SidebarSkeleton";

describe("SidebarSkeleton", () => {
  it("fica escondido de leitores de tela e não tem texto nem links", () => {
    const { container } = render(<SidebarSkeleton />);
    const root = container.firstElementChild;

    expect(root).toHaveAttribute("aria-hidden", "true");
    expect(root).toHaveTextContent("");
    expect(container.querySelector("a, button")).toBeNull();
  });

  it("só aparece no desktop (no celular a barra é uma gaveta)", () => {
    const { container } = render(<SidebarSkeleton />);
    const classes = (container.firstElementChild?.className ?? "").split(" ");

    expect(classes).toContain("hidden");
    expect(classes).toContain("md:flex");
  });
});
```

- [ ] **Step 18: Run test to verify it fails**

Run: `bun run test -- src/components/app-shell`
Expected: FAIL com `Failed to resolve import "@/components/app-shell/Greeting"`, `"…/AdminOverview"`, `"…/AuthedSidebar"` e `"…/SidebarSkeleton"` (4 arquivos novos falhando; `names`, `navItems` e `AppSidebar` seguem passando).

- [ ] **Step 19: Write minimal implementation**

```tsx
// src/components/app-shell/Greeting.tsx
import { requireUser } from "@/lib/auth/session";
import { greetingTitle } from "@/lib/names";

export async function Greeting() {
  const authz = await requireUser();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">
        {greetingTitle(authz.name)}
      </h1>
      <p className="text-muted-foreground">
        Em breve: passagem de turno, solicitações e dashboard.
      </p>
    </div>
  );
}
```

```tsx
// src/components/app-shell/AdminOverview.tsx
import { requireAdmin } from "@/lib/auth/session";

export async function AdminOverview() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
      <p className="text-muted-foreground">
        Setores, turnos, itens, destinos e equipe chegam na próxima etapa.
      </p>
    </div>
  );
}
```

```tsx
// src/components/app-shell/AuthedSidebar.tsx
import { AppSidebar } from "@/components/app-shell/AppSidebar";
import { requireUser } from "@/lib/auth/session";

// Lê a sessão no servidor, por isso vive atrás de <Suspense> no layout.
export async function AuthedSidebar() {
  const authz = await requireUser();

  return (
    <AppSidebar
      isAdmin={authz.role === "admin"}
      userName={authz.name}
      userEmail={authz.email}
    />
  );
}
```

```tsx
// src/components/app-shell/SidebarSkeleton.tsx
import { Skeleton } from "@/components/ui/skeleton";

// Ocupa o lugar da barra lateral enquanto a sessão carrega (só no desktop;
// no celular a barra é uma gaveta e não ocupa espaço).
export function SidebarSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="hidden w-(--sidebar-width) shrink-0 flex-col gap-3 border-r bg-sidebar p-4 md:flex"
    >
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
```

- [ ] **Step 20: Run test to verify it passes**

Run: `bunx biome check --write src && bun run test -- src/components/app-shell`
Expected: PASS (6 arquivos, 26 testes: `navItems` 8, `AppSidebar` 8, `Greeting` 3, `AdminOverview` 2, `AuthedSidebar` 3, `SidebarSkeleton` 2; `names` fica em `src/lib`, fora do filtro)

- [ ] **Step 20a: Write the failing test (MenuToggle: botão do cabeçalho com tooltip)**

O `SidebarTrigger` do cabeçalho é um botão só com ícone; a regra do AGENTS.md exige tooltip além do `aria-label`.

```tsx
// src/components/app-shell/MenuToggle.test.tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MenuToggle } from "@/components/app-shell/MenuToggle";
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

function SidebarState() {
  const { state } = useSidebar();
  return <output aria-label="estado da barra">{state}</output>;
}

function setup() {
  return render(
    <TooltipProvider>
      <SidebarProvider>
        <MenuToggle />
        <SidebarState />
      </SidebarProvider>
    </TooltipProvider>,
  );
}

describe("MenuToggle", () => {
  it("é um botão chamado 'Alternar menu'", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "Alternar menu" }),
    ).toBeInTheDocument();
  });

  it("mostra o tooltip 'Alternar menu' ao passar o mouse", async () => {
    setup();
    const button = screen.getByRole("button", { name: "Alternar menu" });
    // Antes do hover só existe o texto sr-only do próprio botão.
    expect(screen.getAllByText("Alternar menu")).toHaveLength(1);
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    fireEvent.mouseEnter(button);
    fireEvent.pointerMove(button, { pointerType: "mouse" });
    fireEvent.mouseMove(button);
    await waitFor(() =>
      expect(screen.getAllByText("Alternar menu")).toHaveLength(2),
    );
  });

  it("clicar alterna a barra lateral", async () => {
    setup();
    const state = screen.getByLabelText("estado da barra");
    expect(state).toHaveTextContent("expanded");
    await userEvent.click(
      screen.getByRole("button", { name: "Alternar menu" }),
    );
    expect(state).toHaveTextContent("collapsed");
  });
});
```

Run: `bun run test -- src/components/app-shell/MenuToggle`
Expected: FAIL com `Failed to resolve import "@/components/app-shell/MenuToggle"`.

- [ ] **Step 20b: Implementar o MenuToggle**

```tsx
// src/components/app-shell/MenuToggle.tsx
"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Botão só com ícone: aria-label + tooltip (regra do AGENTS.md).
export function MenuToggle() {
  return (
    <Tooltip>
      <TooltipTrigger render={<SidebarTrigger aria-label="Alternar menu" />} />
      <TooltipContent>Alternar menu</TooltipContent>
    </Tooltip>
  );
}
```

O hover do user-event não abre o Tooltip do Base UI no ambiente de teste; por isso o teste usa `fireEvent.pointerEnter/mouseEnter` (mesma técnica do `PasskeyManager.test.tsx` da Tarefa 11).

Run: `bun run test -- src/components/app-shell/MenuToggle`
Expected: PASS (3 testes). Validado em clone com jsdom 28 + o polyfill de `matchMedia` da Tarefa 1; `biome check` limpo..

- [ ] **Step 21: Layouts e páginas (sem `await` no topo; sessão só dentro de `<Suspense>`)**

Apague a página provisória e crie as rotas do grupo `(app)`:

Run: `git rm src/app/page.tsx`
Expected: `rm 'src/app/page.tsx'`.

Layout raiz (título com template, `TooltipProvider` e `Toaster`; as fontes `--font-sans` e `lang="pt-BR"` continuam):

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

// A variável precisa ser --font-sans: é o nome que o globals.css (shadcn) lê.
const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { template: "%s | Closery", default: "Closery" },
  description: "Passagem de turno simples, detalhada e rastreável.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
```

Shell (`SidebarInset` já renderiza `<main>`; por isso o conteúdo vai num `div`, nunca em outro `main`):

```tsx
// src/app/(app)/layout.tsx
import { Suspense } from "react";

import { AuthedSidebar } from "@/components/app-shell/AuthedSidebar";
import { MenuToggle } from "@/components/app-shell/MenuToggle";
import { SidebarSkeleton } from "@/components/app-shell/SidebarSkeleton";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

// Sem await aqui: a sessão é lida dentro do <Suspense> (Cache Components),
// então o esqueleto da página sai no primeiro byte.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <Suspense fallback={<SidebarSkeleton />}>
        <AuthedSidebar />
      </Suspense>
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 max-md:h-14">
          <MenuToggle />
        </header>
        <div className="flex flex-1 flex-col p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

```tsx
// src/app/(app)/page.tsx
import type { Metadata } from "next";
import { Suspense } from "react";

import { Greeting } from "@/components/app-shell/Greeting";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Início" };

export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Greeting />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-5 w-80 max-w-full" />
    </div>
  );
}
```

```tsx
// src/app/(app)/admin/page.tsx
import { Suspense } from "react";

import { AdminOverview } from "@/components/app-shell/AdminOverview";
import { Skeleton } from "@/components/ui/skeleton";

// Sem `metadata` de propósito: o <title> sai antes do portão e diria
// "Administração | Closery" ao operador (T12). O título visível fica dentro do
// Suspense: quem não é admin vê "Página não encontrada" sem ver "Administração"
// piscar antes (spec §4.1: não revelar o que existe).
export default function AdminPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminOverview />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-5 w-96 max-w-full" />
    </div>
  );
}
```

Run: `bunx biome check --write src`
Expected: sem erros. (O `check-types` do próximo passo roda `next typegen` antes do `tsc`, então o `validator.ts` antigo, que ainda citava `src/app/page.js`, é regenerado sozinho.)

- [ ] **Step 22: Verificação completa (testes, tipos, lint)**

Run: `bun run check-types && bun run lint && bun run test`
Expected: os três verdes. Os testes desta tarefa somam 45 (names 8, navItems 8, AppSidebar 8, ptBrLabels 2, error 4, not-found 2, Greeting 3, AdminOverview 2, AuthedSidebar 3, SidebarSkeleton 2, MenuToggle 3).

- [ ] **Step 23: Verificar a estrutura de Cache Components com build e requisição real**

O build prova que `usePathname` (dentro do `AppSidebar`) e as leituras de sessão estão atrás de `<Suspense>` (sem isso o Next 16 falha o build com `Uncached data was accessed outside of <Suspense>`).

Run: `bun run build`
Expected: build conclui sem erro; a tabela de rotas mostra `◐ /` e `◐ /admin` (Partial Prerender: shell estático + sessão em streaming) e `ƒ /api/health`. (Usa o `.env.local`: `DATABASE_URL`, `DATABASE_URL_POOLED` e as variáveis `BETTER_AUTH_*` da Task 6 precisam estar preenchidas, senão `src/db/index.ts` ou `parseAuthEnv` lançam ao coletar os dados da página.)

Run:
```bash
bun run start > /tmp/closery-start.log 2>&1 &
PID=$!
curl -s -o /dev/null --retry 30 --retry-connrefused --retry-delay 1 http://localhost:3000/api/health
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/health
kill $PID
```
Expected: `200` (o `/api/health` consulta a branch de dev do Neon pelo `.env.local`). Confirma só que o app está de pé; as asserções de redirecionamento/404 por papel ficam no E2E da Task 12 (precisam do banco e do proxy da Task 7). Se `kill $PID` não derrubar o processo filho no Git Bash, use `npx kill-port 3000`.

- [ ] **Step 24: Atualizar `.context/ui-registry.md`**

Com a ferramenta Edit, em `.context/ui-registry.md`:

(a) No item **Sidebar**, troque a linha de histórico
```
- **Histórico:** 2026-11-20 — `shadcn add`; `SidebarMenuButton` default sobe de h-8 para
  `h-9 max-md:h-11` (P3).
```
por
```
- **Histórico:** 2026-11-20 — `shadcn add`; `SidebarMenuButton` default sobe de h-8 para
  `h-9 max-md:h-11` (P3); textos acessíveis em pt-BR ("Alternar menu", gaveta "Menu").
```

(b) No item **Sheet**, troque
```
- **Usa:** `Button`; tokens `background`, `border`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.
```
por
```
- **Usa:** `Button`; tokens `background`, `border`.
- **Histórico:** 2026-11-20 — `shadcn add`; o `sr-only` do botão de fechar passa a "Fechar".
```

(c) Troque a seção 2 inteira:
```
## 2. Componentes de aplicação — `src/components/<área>`

*(nenhum ainda)*
```
por
```
## 2. Componentes de aplicação — `src/components/<área>`

### AppSidebar
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/AppSidebar.tsx` (itens em `navItems.ts`)
- **Propósito:** navegação lateral do app autenticado: Início, Conta e, só para admin, Administração.
- **Como funciona:** `"use client"`; recebe `isAdmin`, `userName`, `userEmail`. Item ativo por
  `usePathname` (`/` só na raiz exata; os demais valem para a rota e subrotas) com `isActive` +
  `aria-current="page"`. Cada item é `SidebarMenuButton render={<Link />}`; ao navegar fecha a
  gaveta do celular (`setOpenMobile(false)`). Rodapé com nome e e-mail truncados. O Início fica
  atrás de `<Suspense>` no layout (o `usePathname` suspende em rota dinâmica).
- **Usa:** `Sidebar*`, `lucide-react`; tokens `sidebar-*`.
- **Histórico:** 2026-11-20 — criado na Fase 1.

### AuthedSidebar
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/AuthedSidebar.tsx`
- **Propósito:** liga a sessão ao menu.
- **Como funciona:** Server Component assíncrono; `requireUser()` e devolve `<AppSidebar />`.
  Sempre dentro de `<Suspense fallback={<SidebarSkeleton />}>` no layout `(app)`.
- **Usa:** `AppSidebar`, `requireUser`.
- **Histórico:** 2026-11-20 — criado na Fase 1.

### SidebarSkeleton
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/SidebarSkeleton.tsx`
- **Propósito:** reserva o espaço da barra lateral enquanto a sessão carrega.
- **Como funciona:** só no desktop (`hidden md:flex`), `aria-hidden`, largura `--sidebar-width`.
- **Usa:** `Skeleton`; token `sidebar`.
- **Histórico:** 2026-11-20 — criado na Fase 1.

### MenuToggle
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/MenuToggle.tsx`
- **Propósito:** botão do cabeçalho que abre e fecha a barra lateral.
- **Como funciona:** `"use client"`; `SidebarTrigger` (só ícone) dentro de `TooltipTrigger render`,
  com `aria-label` e tooltip "Alternar menu". Testado com `fireEvent.pointerEnter/mouseEnter`.
- **Usa:** `SidebarTrigger`, `Tooltip*`.
- **Histórico:** 2026-11-20 — criado na Fase 1.

### Greeting
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/Greeting.tsx`
- **Propósito:** título "Olá, {primeiro nome}" e texto do Início.
- **Como funciona:** Server Component assíncrono (`requireUser`); usa `greetingTitle` de
  `src/lib/names.ts`. Dentro de `<Suspense>` na página.
- **Usa:** `requireUser`, `greetingTitle`.
- **Histórico:** 2026-11-20 — criado na Fase 1 (substitui o texto provisório do scaffold).

### AdminOverview
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/AdminOverview.tsx`
- **Propósito:** conteúdo provisório de `/admin` e portão de acesso.
- **Como funciona:** Server Component assíncrono; `requireAdmin()` (operador cai em `notFound()`).
  O título fica dentro do `<Suspense>` para o operador não ver "Administração" antes do 404, e a
  página não exporta `metadata` (o `<title>` revelaria a rota; T12).
- **Usa:** `requireAdmin`.
- **Histórico:** 2026-11-20 — criado na Fase 1.
```

Run: `grep -c "^### " .context/ui-registry.md`
Expected: um número maior que 18 (Button + 16 primitivos + 6 de aplicação = 23 itens `###`, mais o bloco de template que também começa com `### <Nome>` dentro de cercas = 24).

- [ ] **Step 25: Commit**

```bash
git add src/lib/names.ts src/lib/names.test.ts src/components/app-shell src/components/ui/sidebar.tsx src/components/ui/sheet.tsx src/components/ui/ptBrLabels.test.tsx src/app/layout.tsx "src/app/(app)" src/app/error.tsx src/app/error.test.tsx src/app/not-found.tsx src/app/not-found.test.tsx .context/ui-registry.md
git commit -F - <<'EOF'
feat(app): shell autenticado, Início, /admin, error e not-found

Layout (app) com SidebarProvider e a barra lateral lida atrás de Suspense
(Cache Components); AppSidebar com Início, Conta e Administração (só
admin), item ativo com aria-current e gaveta que fecha ao navegar.
Início saúda pelo primeiro nome; /admin mostra "Página não encontrada" ao
operador, sem título que revele a rota. Títulos com template "%s | Closery",
TooltipProvider e Toaster no layout raiz. Botão do menu com tooltip e
rótulos acessíveis do sidebar e do sheet traduzidos para pt-BR.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 9: Tela de convite `/convite/[token]` e `armInvite`

**Files:**
- Create: `src/features/invites/inviteSentence.ts`
- Create: `src/features/invites/inviteMessages.ts`
- Create: `src/components/auth/authFormError.ts`
- Create: `src/components/auth/passkeyErrorCode.ts` (+ `passkeyErrorCode.test.ts`; T14)
- Create: `src/components/auth/SocialButtons.tsx`
- Create: `src/components/auth/InviteUnavailable.tsx`
- Create: `src/components/auth/InviteSignup.tsx`
- Create: `src/app/(auth)/convite/[token]/actions.ts`
- Create: `src/app/(auth)/convite/[token]/page.tsx`
- Create: `src/app/(auth)/layout.tsx`
- Modify: `next.config.ts` (acrescentar `async headers()` ao objeto `nextConfig`, mantendo `cacheComponents`, `partialPrefetching`, `reactCompiler` e `turbopack`)
- Modify: `.context/ui-registry.md` (SocialButtons, InviteUnavailable, InviteSignup)
- Test: `src/features/invites/inviteSentence.test.ts`
- Test: `src/features/invites/inviteMessages.test.ts`
- Test: `src/components/auth/authFormError.test.ts`
- Test: `src/app/(auth)/convite/[token]/actions.test.ts` (projeto `node`, com PGlite)
- Test: `src/app/nextConfig.test.ts`
- Test: `src/components/auth/SocialButtons.test.tsx`, `src/components/auth/InviteUnavailable.test.tsx`, `src/components/auth/InviteSignup.test.tsx` (projeto `dom`)

**Interfaces:**
- Consumes (Tarefas 1–8, pelo contrato):
  - `createTestDb(): Promise<{ client: PGlite; db: TestDb }>` de `test/db.ts`; `insertSector(db, name?)` e `insertInvite(db, input)` de `test/fixtures.ts`.
  - `db` de `@/db` (singleton `server-only`; nos testes é trocado por `vi.mock`).
  - `findInviteByToken(db: Db, token: string, now: Date): Promise<InviteDetails | null>` e o tipo `InviteDetails` de `@/features/invites/inviteQueries`; `InviteState` de `inviteState.ts`.
  - `INVITE_COOKIE`, `inviteCookieOptions(isProduction: boolean)` de `@/lib/auth/inviteCookie`.
  - `authErrorMessage(code)` e `FALLBACK_AUTH_ERROR` de `@/lib/auth/errors`.
  - `authEnv` de `@/lib/auth`; `enabledSocialProviders(env)` e o tipo `SocialProvider` de `@/lib/auth/env`.
  - `authClient` de `@/lib/auth/client` (`signUp.email`, `signIn.social`).
  - Primitivos shadcn da Tarefa 3: `Button`, `Card*`, `Field*`, `FieldSeparator`, `Input`, `Skeleton`.
  - Vitest com os projetos `node` e `dom` e o `setup-dom.ts` da Tarefa 1; `bun run check-types` roda `next typegen` antes do `tsc`, então os tipos globais `PageProps<"/convite/[token]">` existem.
- Produces:
  - `inviteSentence(d: Pick<InviteDetails, "role" | "sectorName" | "inviterName">): string` em `@/features/invites/inviteSentence`.
  - `type InviteUnavailableReason = "expired" | "used" | "cancelled" | "not_found"`, `inviteUnavailableMessage(reason): string`, `INVITE_UNAVAILABLE_TITLE`, `INVITE_UNAVAILABLE_HINT` em `@/features/invites/inviteMessages`.
  - `type AuthFormError = { message: string; field: "email" | "password" | null }`, `authFormError(code: string | null | undefined): AuthFormError` e `errorCodeOf(error: object): string | null` em `@/components/auth/authFormError` (as Tarefas 10 e 11 reusam).
  - `passkeyErrorCode(code: string | null, ceremony: "register" | "authenticate"): string | null` em `@/components/auth/passkeyErrorCode` (T14; as Tarefas 10 e 11 chamam antes de `authFormError` em toda falha de passkey).
  - `SocialButtons({ providers: readonly SocialProvider[]; onSelect(provider: SocialProvider): void; disabled: boolean })` em `@/components/auth/SocialButtons` (a Tarefa 10 reusa).
  - `InviteSignup({ token: string; providers: readonly SocialProvider[]; defaultName: string; initialErrorCode: string | null })`, `InviteUnavailable({ reason })`.
  - `armInvite(token: string): Promise<{ ok: true } | { ok: false; message: string }>`; a `message` já traz a dica "Peça um novo convite a quem te convidou.".
  - Cabeçalho `Referrer-Policy: no-referrer` em `/convite/:path*`.

Decisões desta tarefa: a página só lê (nunca grava nem consome) — quem grava o cookie é a Server Action `armInvite`, disparada pelo clique; quem consome é o hook da Tarefa 6. O formulário usa estado controlado porque o React 19 limpa formulários não controlados depois de um submit e a pessoa perderia o que digitou quando o servidor recusa. O texto de erro vem sempre do mapa do contrato (`authErrorMessage`), nunca cru do servidor.

- [ ] **Step 1: Write the failing test — frase do convite e textos de convite indisponível**
`src/features/invites/inviteSentence.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { inviteSentence } from "./inviteSentence";

describe("inviteSentence", () => {
  it("operador convidado por alguém: setor e papel", () => {
    expect(
      inviteSentence({
        role: "operator",
        sectorName: "ULD",
        inviterName: "Marta Teste",
      }),
    ).toBe("Marta Teste te convidou para o setor ULD como Operador.");
  });

  it("administrador convidado por alguém: sem setor", () => {
    expect(
      inviteSentence({
        role: "admin",
        sectorName: null,
        inviterName: "Marta Teste",
      }),
    ).toBe("Marta Teste te convidou como Administrador.");
  });

  it("administrador criado pelo script (sem convidante)", () => {
    expect(
      inviteSentence({ role: "admin", sectorName: null, inviterName: null }),
    ).toBe("Você foi convidado como Administrador.");
  });

  it("operador criado pelo script (sem convidante) mantém o setor", () => {
    expect(
      inviteSentence({
        role: "operator",
        sectorName: "ULD",
        inviterName: null,
      }),
    ).toBe("Você foi convidado para o setor ULD como Operador.");
  });

  it("administrador ignora o setor, mesmo que exista", () => {
    expect(
      inviteSentence({ role: "admin", sectorName: "ULD", inviterName: "Ana" }),
    ).toBe("Ana te convidou como Administrador.");
  });

  it("operador sem nome de setor não inventa um setor", () => {
    expect(
      inviteSentence({
        role: "operator",
        sectorName: null,
        inviterName: "Ana",
      }),
    ).toBe("Ana te convidou como Operador.");
  });

  it("preserva nomes com acento e emoji sem alterar", () => {
    expect(
      inviteSentence({
        role: "operator",
        sectorName: "Armazém Ç",
        inviterName: "José 🚀",
      }),
    ).toBe("José 🚀 te convidou para o setor Armazém Ç como Operador.");
  });
});
```
`src/features/invites/inviteMessages.test.ts`
```ts
import { describe, expect, it } from "vitest";
import {
  INVITE_UNAVAILABLE_HINT,
  INVITE_UNAVAILABLE_TITLE,
  inviteUnavailableMessage,
} from "./inviteMessages";

describe("inviteUnavailableMessage", () => {
  it.each([
    ["expired", "Este convite expirou."],
    ["used", "Este convite já foi usado."],
    ["cancelled", "Este convite foi cancelado."],
    ["not_found", "Convite não encontrado."],
  ] as const)("%s -> %s", (reason, message) => {
    expect(inviteUnavailableMessage(reason)).toBe(message);
  });

  it("expõe título e dica fixos", () => {
    expect(INVITE_UNAVAILABLE_TITLE).toBe("Convite indisponível");
    expect(INVITE_UNAVAILABLE_HINT).toBe(
      "Peça um novo convite a quem te convidou.",
    );
  });
});
```
- [ ] **Step 2: Run test to verify it fails**
Run: `bun run test -- inviteSentence inviteMessages`
Expected: FAIL com `Cannot find module './inviteSentence'` e `Cannot find module './inviteMessages'`
- [ ] **Step 3: Write minimal implementation**
`src/features/invites/inviteSentence.ts`
```ts
import type { InviteDetails } from "./inviteQueries";

const ROLE_LABEL = { admin: "Administrador", operator: "Operador" } as const;

export function inviteSentence(
  details: Pick<InviteDetails, "role" | "sectorName" | "inviterName">,
): string {
  const role = ROLE_LABEL[details.role];
  // Só operador pertence a um setor; para administrador o setor é ignorado.
  const sector =
    details.role === "operator" && details.sectorName
      ? ` para o setor ${details.sectorName}`
      : "";
  if (details.inviterName) {
    return `${details.inviterName} te convidou${sector} como ${role}.`;
  }
  return `Você foi convidado${sector} como ${role}.`;
}
```
`src/features/invites/inviteMessages.ts`
```ts
import type { InviteState } from "./inviteState";

export type InviteUnavailableReason =
  | Exclude<InviteState, "valid">
  | "not_found";

export const INVITE_UNAVAILABLE_TITLE = "Convite indisponível";
export const INVITE_UNAVAILABLE_HINT =
  "Peça um novo convite a quem te convidou.";

const MESSAGES: Record<InviteUnavailableReason, string> = {
  expired: "Este convite expirou.",
  used: "Este convite já foi usado.",
  cancelled: "Este convite foi cancelado.",
  not_found: "Convite não encontrado.",
};

export function inviteUnavailableMessage(
  reason: InviteUnavailableReason,
): string {
  return MESSAGES[reason];
}
```
- [ ] **Step 4: Run test to verify it passes**
Run: `bun run test -- inviteSentence inviteMessages`
Expected: PASS (12 testes: 7 + 5)
- [ ] **Step 5: Write the failing test — mapa de erro por campo**
`src/components/auth/authFormError.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { FALLBACK_AUTH_ERROR } from "@/lib/auth/errors";
import { authFormError, errorCodeOf } from "./authFormError";

describe("authFormError", () => {
  it.each([
    ["INVALID_EMAIL", "email"],
    ["USER_ALREADY_EXISTS", "email"],
    ["USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", "email"],
    ["PASSWORD_TOO_SHORT", "password"],
    ["PASSWORD_TOO_LONG", "password"],
  ] as const)("%s aponta para o campo %s", (code, field) => {
    expect(authFormError(code).field).toBe(field);
  });

  it("erros gerais não apontam para campo", () => {
    expect(authFormError("INVALID_EMAIL_OR_PASSWORD")).toEqual({
      message: "E-mail ou senha incorretos.",
      field: null,
    });
  });

  it("código desconhecido, vazio ou ausente cai no texto padrão", () => {
    for (const code of ["QUALQUER_COISA", "", null, undefined]) {
      expect(authFormError(code)).toEqual({
        message: FALLBACK_AUTH_ERROR,
        field: null,
      });
    }
  });

  it("nunca repassa texto cru do servidor", () => {
    expect(authFormError("<script>alert(1)</script>").message).toBe(
      FALLBACK_AUTH_ERROR,
    );
  });
});

describe("errorCodeOf", () => {
  it("lê o code quando é texto", () => {
    expect(errorCodeOf({ code: "AUTH_CANCELLED", status: 400 })).toBe(
      "AUTH_CANCELLED",
    );
  });

  it("devolve null sem code ou com code que não é texto", () => {
    expect(errorCodeOf({ status: 500 })).toBeNull();
    expect(errorCodeOf({ code: 42 })).toBeNull();
    expect(errorCodeOf({})).toBeNull();
  });
});
```
- [ ] **Step 6: Run test to verify it fails**
Run: `bun run test -- authFormError`
Expected: FAIL com `Cannot find module './authFormError'`
- [ ] **Step 7: Write minimal implementation**
`src/components/auth/authFormError.ts`
```ts
import { authErrorMessage } from "@/lib/auth/errors";

export type AuthFieldName = "email" | "password";
export type AuthFormError = { message: string; field: AuthFieldName | null };

const FIELD_BY_CODE: Readonly<Record<string, AuthFieldName>> = {
  INVALID_EMAIL: "email",
  USER_ALREADY_EXISTS: "email",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "email",
  PASSWORD_TOO_SHORT: "password",
  PASSWORD_TOO_LONG: "password",
};

// Mensagem em pt-BR + o campo que deve receber aria-invalid. O texto vem
// sempre do mapa do contrato, nunca cru do servidor.
export function authFormError(code: string | null | undefined): AuthFormError {
  const field =
    code && Object.hasOwn(FIELD_BY_CODE, code)
      ? (FIELD_BY_CODE[code] ?? null)
      : null;
  return { message: authErrorMessage(code), field };
}

// Alguns erros do Better Auth (ex.: signIn.passkey) vêm sem `code` no tipo.
export function errorCodeOf(error: object): string | null {
  return "code" in error && typeof error.code === "string" ? error.code : null;
}
```
- [ ] **Step 8: Run test to verify it passes**
Run: `bun run test -- authFormError`
Expected: PASS (10 testes)
- [ ] **Step 9: Write the failing test — `armInvite` (PGlite) e cabeçalho do `next.config.ts`**
`src/app/(auth)/convite/[token]/actions.test.ts`
```ts
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { findInviteByToken } from "@/features/invites/inviteQueries";
import { INVITE_COOKIE, inviteCookieOptions } from "@/lib/auth/inviteCookie";
import { insertInvite, insertSector } from "../../../../../test/fixtures";
import { armInvite } from "./actions";

const mocks = vi.hoisted(() => ({ set: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.set }),
}));

vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../../../test/db");
  const { db } = await createTestDb();
  return { db };
});

const HINT = "Peça um novo convite a quem te convidou.";
const ABSENT_TOKEN = "A".repeat(43);
const DAY = 24 * 60 * 60 * 1000;

afterEach(() => {
  mocks.set.mockClear();
  vi.unstubAllEnvs();
});

describe("armInvite", () => {
  let sectorId: string;

  beforeAll(async () => {
    sectorId = (await insertSector(db)).id;
  });

  it.each([
    ["vazio", ""],
    ["curto demais", "abc"],
    ["com caractere inválido", `${"A".repeat(42)}!`],
    ["longo demais", "A".repeat(44)],
  ])("token malformado (%s) não grava cookie", async (_label, token) => {
    const result = await armInvite(token);
    expect(result).toEqual({
      ok: false,
      message: `Convite não encontrado. ${HINT}`,
    });
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("token inexistente não grava cookie", async () => {
    const result = await armInvite(ABSENT_TOKEN);
    expect(result).toEqual({
      ok: false,
      message: `Convite não encontrado. ${HINT}`,
    });
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("convite expirado não grava cookie", async () => {
    const { token } = await insertInvite(db, {
      role: "operator",
      sectorId,
      expiresAt: new Date(Date.now() - DAY),
    });
    const result = await armInvite(token);
    expect(result).toEqual({
      ok: false,
      message: `Este convite expirou. ${HINT}`,
    });
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("convite já usado não grava cookie", async () => {
    const { token } = await insertInvite(db, {
      role: "operator",
      sectorId,
      usedAt: new Date(),
    });
    const result = await armInvite(token);
    expect(result).toEqual({
      ok: false,
      message: `Este convite já foi usado. ${HINT}`,
    });
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("convite cancelado não grava cookie", async () => {
    const { token } = await insertInvite(db, {
      role: "operator",
      sectorId,
      cancelledAt: new Date(),
    });
    const result = await armInvite(token);
    expect(result).toEqual({
      ok: false,
      message: `Este convite foi cancelado. ${HINT}`,
    });
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("convite válido grava o cookie com as opções do contrato", async () => {
    const { token } = await insertInvite(db, { role: "operator", sectorId });
    const result = await armInvite(token);
    expect(result).toEqual({ ok: true });
    expect(mocks.set).toHaveBeenCalledTimes(1);
    expect(mocks.set).toHaveBeenCalledWith(
      INVITE_COOKIE,
      token,
      inviteCookieOptions(false),
    );
  });

  it("em produção o cookie é Secure", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { token } = await insertInvite(db, { role: "admin" });
    await armInvite(token);
    expect(mocks.set).toHaveBeenCalledWith(
      INVITE_COOKIE,
      token,
      expect.objectContaining({
        secure: true,
        httpOnly: true,
        sameSite: "lax",
      }),
    );
  });

  it("nunca consome o convite (prefetch e scanner não gastam)", async () => {
    const { token } = await insertInvite(db, { role: "operator", sectorId });
    await armInvite(token);
    await armInvite(token);
    const details = await findInviteByToken(db, token, new Date());
    expect(details?.state).toBe("valid");
  });
});
```
`src/app/nextConfig.test.ts`
```ts
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("next.config headers", () => {
  it("/convite/* envia Referrer-Policy: no-referrer", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const rule = rules.find((r) => r.source === "/convite/:path*");
    expect(rule?.headers ?? []).toContainEqual({
      key: "Referrer-Policy",
      value: "no-referrer",
    });
  });

  it("não aplica a política às demais rotas", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    expect(rules.map((r) => r.source)).toEqual(["/convite/:path*"]);
  });

  it("mantém as opções anteriores do arquivo", () => {
    expect(nextConfig.cacheComponents).toBe(true);
    expect(nextConfig.reactCompiler).toBe(true);
  });
});
```
- [ ] **Step 10: Run test to verify it fails**
Run: `bun run test -- "convite/[token]/actions" nextConfig`
Expected: FAIL — `Cannot find module '…/convite/[token]/actions'` e, em `nextConfig.test.ts`, `AssertionError: expected [] to deeply equal [ '/convite/:path*' ]`
- [ ] **Step 11: Write minimal implementation**
`src/app/(auth)/convite/[token]/actions.ts`
```ts
"use server";

import { cookies } from "next/headers";
import { db } from "@/db";
import {
  INVITE_UNAVAILABLE_HINT,
  inviteUnavailableMessage,
} from "@/features/invites/inviteMessages";
import { findInviteByToken } from "@/features/invites/inviteQueries";
import { INVITE_COOKIE, inviteCookieOptions } from "@/lib/auth/inviteCookie";

type ArmInviteResult = { ok: true } | { ok: false; message: string };

function unavailable(
  reason: Parameters<typeof inviteUnavailableMessage>[0],
): ArmInviteResult {
  return {
    ok: false,
    message: `${inviteUnavailableMessage(reason)} ${INVITE_UNAVAILABLE_HINT}`,
  };
}

// Arma o cookie do convite antes do cadastro. Só revalida e grava; quem
// consome o convite é o hook de criação de usuário (nunca a página nem esta
// action), então prefetch e scanners de link não gastam o convite.
export async function armInvite(token: string): Promise<ArmInviteResult> {
  const details = await findInviteByToken(db, token, new Date());
  if (!details) return unavailable("not_found");
  if (details.state !== "valid") return unavailable(details.state);

  const jar = await cookies();
  jar.set(
    INVITE_COOKIE,
    token,
    inviteCookieOptions(process.env.NODE_ENV === "production"),
  );
  return { ok: true };
}
```
`next.config.ts` (arquivo inteiro; só `headers` é novo)
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        // O token do convite vai na URL: não pode vazar no Referer.
        source: "/convite/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
```
- [ ] **Step 12: Run test to verify it passes**
Run: `bun run test -- "convite/[token]/actions" nextConfig`
Expected: PASS (14 testes: 11 + 3)
- [ ] **Step 13: Write the failing test — componentes do convite**
`src/components/auth/SocialButtons.test.tsx`
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SocialButtons } from "./SocialButtons";

describe("SocialButtons", () => {
  it("não renderiza nada sem provedores habilitados", () => {
    const { container } = render(
      <SocialButtons providers={[]} onSelect={vi.fn()} disabled={false} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra só os provedores habilitados, na ordem recebida", () => {
    render(
      <SocialButtons
        providers={["google", "facebook"]}
        onSelect={vi.fn()}
        disabled={false}
      />,
    );
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual([
      "Continuar com Google",
      "Continuar com Facebook",
    ]);
  });

  it("apenas Facebook habilitado esconde o Google", () => {
    render(
      <SocialButtons
        providers={["facebook"]}
        onSelect={vi.fn()}
        disabled={false}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Continuar com Google" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continuar com Facebook" }),
    ).toBeInTheDocument();
  });

  it("chama onSelect com o provedor clicado", async () => {
    const onSelect = vi.fn();
    render(
      <SocialButtons
        providers={["google", "facebook"]}
        onSelect={onSelect}
        disabled={false}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Continuar com Facebook" }),
    );
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("facebook");
  });

  it("desabilita todos os botões e não chama onSelect quando disabled", async () => {
    const onSelect = vi.fn();
    render(
      <SocialButtons
        providers={["google", "facebook"]}
        onSelect={onSelect}
        disabled
      />,
    );
    for (const button of screen.getAllByRole("button")) {
      expect(button).toBeDisabled();
    }
    await userEvent.click(
      screen.getByRole("button", { name: "Continuar com Google" }),
    );
    expect(onSelect).not.toHaveBeenCalled();
  });
});
```
`src/components/auth/InviteUnavailable.test.tsx`
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InviteUnavailable } from "./InviteUnavailable";

describe("InviteUnavailable", () => {
  it.each([
    ["expired", "Este convite expirou."],
    ["used", "Este convite já foi usado."],
    ["cancelled", "Este convite foi cancelado."],
    ["not_found", "Convite não encontrado."],
  ] as const)("%s mostra título, motivo e a dica", (reason, message) => {
    render(<InviteUnavailable reason={reason} />);
    expect(
      screen.getByRole("heading", { name: "Convite indisponível" }),
    ).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(
      screen.getByText("Peça um novo convite a quem te convidou."),
    ).toBeInTheDocument();
  });

  it("não oferece formulário nem botão de cadastro", () => {
    render(<InviteUnavailable reason="expired" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("E-mail")).not.toBeInTheDocument();
  });
});
```
`src/components/auth/InviteSignup.test.tsx`
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InviteSignup } from "./InviteSignup";

const mocks = vi.hoisted(() => ({
  armInvite: vi.fn(),
  signUpEmail: vi.fn(),
  signInSocial: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/app/(auth)/convite/[token]/actions", () => ({
  armInvite: mocks.armInvite,
}));
vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signUp: { email: mocks.signUpEmail },
    signIn: { social: mocks.signInSocial },
  },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

const TOKEN = "T".repeat(43);
const FALLBACK = "Não foi possível concluir. Tente de novo.";

type Props = Partial<Parameters<typeof InviteSignup>[0]>;

function setup(props: Props = {}) {
  return render(
    <InviteSignup
      token={TOKEN}
      providers={[]}
      defaultName=""
      initialErrorCode={null}
      {...props}
    />,
  );
}

async function fillAndSubmit(name = "Ana Teste") {
  const user = userEvent.setup();
  const nameInput = screen.getByLabelText("Nome");
  await user.clear(nameInput);
  await user.type(nameInput, name);
  await user.type(screen.getByLabelText("E-mail"), "ana@example.com");
  await user.type(screen.getByLabelText("Senha"), "senha-segura-1");
  await user.click(screen.getByRole("button", { name: "Criar conta" }));
  return user;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.armInvite.mockResolvedValue({ ok: true });
  mocks.signUpEmail.mockResolvedValue({ data: {}, error: null });
  mocks.signInSocial.mockResolvedValue({ data: {}, error: null });
});

describe("InviteSignup", () => {
  it("começa com o nome sugerido e e-mail/senha vazios", () => {
    setup({ defaultName: "Maria Convidada" });
    expect(screen.getByLabelText("Nome")).toHaveValue("Maria Convidada");
    expect(screen.getByLabelText("E-mail")).toHaveValue("");
    expect(screen.getByLabelText("Senha")).toHaveValue("");
  });

  it("campos de digitação têm o tipo e o autocomplete certos", () => {
    setup();
    expect(screen.getByLabelText("Nome")).toHaveAttribute(
      "autocomplete",
      "name",
    );
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("E-mail")).toHaveAttribute(
      "autocomplete",
      "email",
    );
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    expect(screen.getByLabelText("Senha")).toHaveAttribute(
      "autocomplete",
      "new-password",
    );
  });

  it("arma o convite, cria a conta e vai para /bem-vindo", async () => {
    setup();
    await fillAndSubmit();

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/bem-vindo"));
    expect(mocks.armInvite).toHaveBeenCalledWith(TOKEN);
    expect(mocks.signUpEmail).toHaveBeenCalledWith({
      name: "Ana Teste",
      email: "ana@example.com",
      password: "senha-segura-1",
    });
    expect(mocks.armInvite.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signUpEmail.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("convite que deixou de valer: mostra o motivo e não cria conta", async () => {
    mocks.armInvite.mockResolvedValue({
      ok: false,
      message: "Este convite expirou. Peça um novo convite a quem te convidou.",
    });
    setup();
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este convite expirou. Peça um novo convite a quem te convidou.",
    );
    expect(mocks.signUpEmail).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeEnabled();
  });

  it("e-mail já cadastrado: mensagem mapeada, campo marcado e valores preservados", async () => {
    mocks.signUpEmail.mockResolvedValue({
      data: null,
      error: { code: "USER_ALREADY_EXISTS", message: "texto cru do servidor" },
    });
    setup();
    await fillAndSubmit();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      'Já existe uma conta com este e-mail. Entre por "Entrar".',
    );
    expect(screen.queryByText("texto cru do servidor")).not.toBeInTheDocument();
    const email = screen.getByLabelText("E-mail");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email.getAttribute("aria-describedby")).toBe(alert.id);
    expect(screen.getByLabelText("Senha")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(email).toHaveValue("ana@example.com");
    expect(screen.getByLabelText("Nome")).toHaveValue("Ana Teste");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("senha curta: erro aponta para o campo de senha", async () => {
    mocks.signUpEmail.mockResolvedValue({
      data: null,
      error: { code: "PASSWORD_TOO_SHORT" },
    });
    setup();
    await fillAndSubmit();

    await screen.findByRole("alert");
    expect(screen.getByLabelText("Senha")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText("E-mail")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("código desconhecido cai no texto padrão, nunca no texto do servidor", async () => {
    mocks.signUpEmail.mockResolvedValue({
      data: null,
      error: { code: "COISA_NOVA", message: "stack trace" },
    });
    setup();
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(FALLBACK);
    expect(screen.queryByText("stack trace")).not.toBeInTheDocument();
  });

  it("falha de rede (promessa rejeitada) mostra o texto padrão e libera o botão", async () => {
    mocks.signUpEmail.mockRejectedValue(new Error("Failed to fetch"));
    setup();
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(FALLBACK);
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeEnabled();
  });

  it("trava o duplo clique: botão desabilitado e uma única criação enquanto pendente", async () => {
    let resolveSignUp: (value: unknown) => void = () => {};
    mocks.signUpEmail.mockReturnValue(
      new Promise((resolve) => {
        resolveSignUp = resolve;
      }),
    );
    setup();
    const user = await fillAndSubmit();

    const submit = screen.getByRole("button", { name: "Criar conta" });
    await waitFor(() => expect(submit).toBeDisabled());
    await user.click(submit);
    await user.keyboard("{Enter}");
    expect(mocks.signUpEmail).toHaveBeenCalledTimes(1);
    expect(mocks.armInvite).toHaveBeenCalledTimes(1);

    resolveSignUp({ data: {}, error: null });
    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
  });

  it("mostra o erro inicial vindo de ?error= já traduzido", () => {
    setup({ initialErrorCode: "SIGNUP_INVITE_ONLY" });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "O cadastro é só por convite. Abra de novo o link que você recebeu.",
    );
  });

  it("erro inicial desconhecido vira o texto padrão", () => {
    setup({ initialErrorCode: "xyz" });
    expect(screen.getByRole("alert")).toHaveTextContent(FALLBACK);
  });

  it("sem erro inicial não há alerta", () => {
    setup();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sem provedores não mostra botões sociais", () => {
    setup({ providers: [] });
    expect(screen.queryByText(/Continuar com/)).not.toBeInTheDocument();
  });

  it("social: arma o convite e chama signIn.social com requestSignUp", async () => {
    setup({ providers: ["google", "facebook"] });
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Continuar com Google" }),
    );

    await waitFor(() => expect(mocks.signInSocial).toHaveBeenCalledTimes(1));
    expect(mocks.armInvite).toHaveBeenCalledWith(TOKEN);
    expect(mocks.signInSocial).toHaveBeenCalledWith({
      provider: "google",
      requestSignUp: true,
      callbackURL: "/",
      newUserCallbackURL: "/bem-vindo",
      errorCallbackURL: `/convite/${TOKEN}`,
    });
    expect(mocks.signUpEmail).not.toHaveBeenCalled();
    expect(mocks.armInvite.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signInSocial.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("social com Facebook usa o provedor certo", async () => {
    setup({ providers: ["facebook"] });
    await userEvent.click(
      screen.getByRole("button", { name: "Continuar com Facebook" }),
    );
    await waitFor(() => expect(mocks.signInSocial).toHaveBeenCalled());
    expect(mocks.signInSocial).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "facebook", requestSignUp: true }),
    );
  });

  it("social com convite inválido: mostra o motivo e não inicia o OAuth", async () => {
    mocks.armInvite.mockResolvedValue({
      ok: false,
      message:
        "Este convite já foi usado. Peça um novo convite a quem te convidou.",
    });
    setup({ providers: ["google"] });
    await userEvent.click(
      screen.getByRole("button", { name: "Continuar com Google" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este convite já foi usado.",
    );
    expect(mocks.signInSocial).not.toHaveBeenCalled();
  });

  it("social com erro devolvido mostra a mensagem mapeada", async () => {
    mocks.signInSocial.mockResolvedValue({
      data: null,
      error: { code: "unable_to_create_user" },
    });
    setup({ providers: ["google"] });
    await userEvent.click(
      screen.getByRole("button", { name: "Continuar com Google" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível criar a conta. Tente de novo.",
    );
    expect(screen.getByRole("button", { name: "Criar conta" })).toBeEnabled();
  });

  it("enquanto o cadastro está pendente os botões sociais ficam desabilitados", async () => {
    mocks.signUpEmail.mockReturnValue(new Promise(() => {}));
    setup({ providers: ["google"] });
    await fillAndSubmit();

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Continuar com Google" }),
      ).toBeDisabled(),
    );
  });
});
```
- [ ] **Step 14: Run test to verify it fails**
Run: `bun run test -- SocialButtons InviteUnavailable InviteSignup`
Expected: FAIL com `Failed to resolve import "./SocialButtons" from "src/components/auth/SocialButtons.test.tsx"` (e o mesmo para os outros dois)
- [ ] **Step 15: Write minimal implementation**
`src/components/auth/SocialButtons.tsx`
```tsx
"use client";

import { Button } from "@/components/ui/button";
import { FieldSeparator } from "@/components/ui/field";
import type { SocialProvider } from "@/lib/auth/env";

const LABELS: Record<SocialProvider, string> = {
  google: "Continuar com Google",
  facebook: "Continuar com Facebook",
};

type SocialButtonsProps = {
  providers: readonly SocialProvider[];
  onSelect: (provider: SocialProvider) => void;
  disabled: boolean;
};

export function SocialButtons({
  providers,
  onSelect,
  disabled,
}: SocialButtonsProps) {
  if (providers.length === 0) return null;

  return (
    <div className="flex flex-col gap-4">
      <FieldSeparator>ou</FieldSeparator>
      <div className="flex flex-col gap-2">
        {providers.map((provider) => (
          <Button
            key={provider}
            type="button"
            variant="outline"
            size="lg"
            disabled={disabled}
            onClick={() => onSelect(provider)}
          >
            {LABELS[provider]}
          </Button>
        ))}
      </div>
    </div>
  );
}
```
`src/components/auth/InviteUnavailable.tsx`
```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  INVITE_UNAVAILABLE_HINT,
  INVITE_UNAVAILABLE_TITLE,
  type InviteUnavailableReason,
  inviteUnavailableMessage,
} from "@/features/invites/inviteMessages";

export function InviteUnavailable({
  reason,
}: {
  reason: InviteUnavailableReason;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={1}>
          {INVITE_UNAVAILABLE_TITLE}
        </CardTitle>
        <CardDescription>{inviteUnavailableMessage(reason)}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {INVITE_UNAVAILABLE_HINT}
        </p>
      </CardContent>
    </Card>
  );
}
```
`src/components/auth/InviteSignup.tsx`
```tsx
"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";
import { armInvite } from "@/app/(auth)/convite/[token]/actions";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import type { SocialProvider } from "@/lib/auth/env";
import { type AuthFormError, authFormError } from "./authFormError";
import { SocialButtons } from "./SocialButtons";

type InviteSignupProps = {
  token: string;
  providers: readonly SocialProvider[];
  defaultName: string;
  initialErrorCode: string | null;
};

export function InviteSignup({
  token,
  providers,
  defaultName,
  initialErrorCode,
}: InviteSignupProps) {
  const router = useRouter();
  const uid = useId();
  // Estado controlado: o React 19 limpa formulários não controlados depois
  // de um submit e a pessoa perderia o que digitou quando o servidor recusa.
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AuthFormError | null>(
    initialErrorCode ? authFormError(initialErrorCode) : null,
  );

  const errorId = `${uid}-error`;

  // Revalida o convite e grava o cookie antes de qualquer cadastro.
  async function arm(): Promise<boolean> {
    const armed = await armInvite(token);
    if (!armed.ok) {
      setError({ message: armed.message, field: null });
      return false;
    }
    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      if (!(await arm())) {
        setPending(false);
        return;
      }
      const { error: signUpError } = await authClient.signUp.email({
        name,
        email,
        password,
      });
      if (signUpError) {
        setError(authFormError(signUpError.code));
        setPending(false);
        return;
      }
      // Sucesso: o botão fica travado até a navegação terminar.
      router.push("/bem-vindo");
    } catch {
      setError(authFormError(null));
      setPending(false);
    }
  }

  async function handleSocial(provider: SocialProvider) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      if (!(await arm())) {
        setPending(false);
        return;
      }
      const { error: socialError } = await authClient.signIn.social({
        provider,
        requestSignUp: true,
        callbackURL: "/",
        newUserCallbackURL: "/bem-vindo",
        errorCallbackURL: `/convite/${token}`,
      });
      if (socialError) {
        setError(authFormError(socialError.code));
        setPending(false);
      }
      // Sem erro, o navegador está indo para o provedor: mantém travado.
    } catch {
      setError(authFormError(null));
      setPending(false);
    }
  }

  const fieldError = (field: "email" | "password") =>
    error?.field === field ? error : null;

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${uid}-name`}>Nome</FieldLabel>
            <Input
              id={`${uid}-name`}
              name="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Field data-invalid={fieldError("email") ? true : undefined}>
            <FieldLabel htmlFor={`${uid}-email`}>E-mail</FieldLabel>
            <Input
              id={`${uid}-email`}
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={fieldError("email") ? true : undefined}
              aria-describedby={fieldError("email") ? errorId : undefined}
            />
            {fieldError("email") && (
              <FieldError id={errorId}>{error?.message}</FieldError>
            )}
          </Field>

          <Field data-invalid={fieldError("password") ? true : undefined}>
            <FieldLabel htmlFor={`${uid}-password`}>Senha</FieldLabel>
            <Input
              id={`${uid}-password`}
              name="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={fieldError("password") ? true : undefined}
              aria-describedby={fieldError("password") ? errorId : undefined}
            />
            {fieldError("password") && (
              <FieldError id={errorId}>{error?.message}</FieldError>
            )}
          </Field>

          {error && error.field === null && (
            <FieldError id={errorId}>{error.message}</FieldError>
          )}

          <Button type="submit" size="lg" disabled={pending}>
            Criar conta
          </Button>
        </FieldGroup>
      </form>

      <SocialButtons
        providers={providers}
        onSelect={handleSocial}
        disabled={pending}
      />
    </div>
  );
}
```
- [ ] **Step 16: Run test to verify it passes**
Run: `bun run test -- SocialButtons InviteUnavailable InviteSignup`
Expected: PASS (28 testes: 5 + 5 + 18)
- [ ] **Step 17: Criar o layout do grupo `(auth)` e a página do convite**
`src/app/(auth)/layout.tsx`
```tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center gap-6 p-4">
      <p className="text-center text-lg font-semibold">Closery</p>
      {children}
    </main>
  );
}
```
`src/app/(auth)/convite/[token]/page.tsx` — `Page` não faz `await`: repassa as Promises para um componente dentro de `<Suspense>`.
```tsx
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { InviteSignup } from "@/components/auth/InviteSignup";
import { InviteUnavailable } from "@/components/auth/InviteUnavailable";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { db } from "@/db";
import { findInviteByToken } from "@/features/invites/inviteQueries";
import { inviteSentence } from "@/features/invites/inviteSentence";
import { authEnv } from "@/lib/auth";
import { enabledSocialProviders } from "@/lib/auth/env";

export const metadata: Metadata = { title: "Convite" };

type InvitePageProps = PageProps<"/convite/[token]">;

// Page não lê params/searchParams: eles são dados de requisição e só podem
// ser aguardados dentro do <Suspense> (Cache Components).
export default function Page(props: InvitePageProps) {
  return (
    <Suspense fallback={<InviteFallback />}>
      <InviteContent params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function InviteContent({
  params,
  searchParams,
}: {
  params: InvitePageProps["params"];
  searchParams: InvitePageProps["searchParams"];
}) {
  const { token } = await params;
  const query = await searchParams;
  // new Date() só depois de marcar a renderização como dinâmica (Cache
  // Components). Aguardar params/searchParams não basta: sem isto o servidor
  // registra "encountered the unstable value new Date()" a cada requisição.
  await connection();
  const details = await findInviteByToken(db, token, new Date());

  if (!details) return <InviteUnavailable reason="not_found" />;
  if (details.state !== "valid") {
    return <InviteUnavailable reason={details.state} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={1}>
          Você foi convidado
        </CardTitle>
        <CardDescription>{inviteSentence(details)}</CardDescription>
      </CardHeader>
      <CardContent>
        <InviteSignup
          token={token}
          providers={enabledSocialProviders(authEnv)}
          defaultName={details.inviteeLabel ?? ""}
          initialErrorCode={
            typeof query.error === "string" ? query.error : null
          }
        />
      </CardContent>
    </Card>
  );
}

function InviteFallback() {
  return (
    <Card aria-busy="true">
      <CardHeader>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-11 w-full" />
      </CardContent>
    </Card>
  );
}
```
- [ ] **Step 17a: Write the failing test — `passkeyErrorCode` (usado pelas Tarefas 10 e 11)**

O cliente de passkey (`@better-auth/passkey` 1.7.27) repassa o código do `@simplewebauthn/browser` quando a cerimônia falha no navegador: fechar o diálogo (`NotAllowedError`) vira `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`, abort por `AbortSignal` vira `ERROR_CEREMONY_ABORTED`, e passkey repetida vira `ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED`. Sem tradução, a pessoa que cancela vê o fallback em vez de "Login com passkey cancelado." (T14). A tradução fica na borda, sem mexer no `AUTH_ERROR_MESSAGES` da Tarefa 6.

`src/components/auth/passkeyErrorCode.test.ts`
```ts
import { describe, expect, it } from "vitest";

import { passkeyErrorCode } from "./passkeyErrorCode";

describe("passkeyErrorCode", () => {
  it.each([
    ["ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", "authenticate", "AUTH_CANCELLED"],
    ["ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", "register", "REGISTRATION_CANCELLED"],
    ["ERROR_CEREMONY_ABORTED", "authenticate", "AUTH_CANCELLED"],
    ["ERROR_CEREMONY_ABORTED", "register", "REGISTRATION_CANCELLED"],
    ["ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED", "register", "PREVIOUSLY_REGISTERED"],
    ["ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED", "authenticate", "PREVIOUSLY_REGISTERED"],
  ] as const)("%s em %s vira %s", (code, ceremony, expected) => {
    expect(passkeyErrorCode(code, ceremony)).toBe(expected);
  });

  it("códigos do Better Auth passam sem mudança", () => {
    expect(passkeyErrorCode("SESSION_NOT_FRESH", "register")).toBe(
      "SESSION_NOT_FRESH",
    );
    expect(passkeyErrorCode("AUTH_CANCELLED", "authenticate")).toBe(
      "AUTH_CANCELLED",
    );
  });

  it("null continua null (o fallback é de authFormError)", () => {
    expect(passkeyErrorCode(null, "authenticate")).toBeNull();
    expect(passkeyErrorCode(null, "register")).toBeNull();
  });
});
```

Run: `bun run test -- src/components/auth/passkeyErrorCode`
Expected: FAIL com `Cannot find module './passkeyErrorCode'`.

- [ ] **Step 17b: Implementar `passkeyErrorCode`**

`src/components/auth/passkeyErrorCode.ts`
```ts
// O cliente de passkey repassa o código do @simplewebauthn/browser quando a
// cerimônia falha no navegador: fechar o diálogo (NotAllowedError) vira
// ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY e AbortSignal vira ERROR_CEREMONY_ABORTED.
// Traduzimos aqui para os códigos do mapa de mensagens (T14).
export function passkeyErrorCode(
  code: string | null,
  ceremony: "register" | "authenticate",
): string | null {
  if (code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED") {
    return "PREVIOUSLY_REGISTERED";
  }
  if (
    code === "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY" ||
    code === "ERROR_CEREMONY_ABORTED"
  ) {
    return ceremony === "register" ? "REGISTRATION_CANCELLED" : "AUTH_CANCELLED";
  }
  return code;
}
```

Run: `bun run test -- src/components/auth/passkeyErrorCode`
Expected: PASS (8 testes).

- [ ] **Step 17c: Atualizar `.context/ui-registry.md`**

Com a ferramenta Edit, acrescente ao fim da seção `## 2. Componentes de aplicação — `src/components/<área>`` (depois do último item que a Tarefa 8 registrou, `AdminOverview`):

```
### SocialButtons
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/auth/SocialButtons.tsx`
- **Propósito:** botões "Continuar com Google/Facebook", só dos provedores habilitados no env.
- **Como funciona:** `"use client"`; props `providers`, `onSelect`, `disabled`; lista vazia não
  renderiza nada; separador "ou".
- **Usa:** `Button` (`outline`, `lg`), `FieldSeparator`.
- **Histórico:** 2026-11-20 — criado na Fase 1.

### InviteUnavailable
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/auth/InviteUnavailable.tsx`
- **Propósito:** convite expirado, usado, cancelado ou inexistente.
- **Como funciona:** Server Component; `reason` → texto de `inviteMessages.ts` + "Peça um novo
  convite a quem te convidou."; sem formulário.
- **Usa:** `Card*`.
- **Histórico:** 2026-11-20 — criado na Fase 1.

### InviteSignup
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/auth/InviteSignup.tsx`
- **Propósito:** cadastro por convite (nome, e-mail, senha e social).
- **Como funciona:** `"use client"`; estado controlado; `armInvite` antes de
  `signUp.email`/`signIn.social` (`requestSignUp: true`); erro só por `authFormError`, com
  `aria-invalid`/`aria-describedby` no campo; trava duplo clique.
- **Usa:** `Field*`, `Input`, `Button`, `SocialButtons`.
- **Histórico:** 2026-11-20 — criado na Fase 1.
```

Run: `grep -c "^### SocialButtons\|^### InviteUnavailable\|^### InviteSignup" .context/ui-registry.md`
Expected: `3`.

- [ ] **Step 18: Verificar tipos, lint, testes e o build**
Run: `bun run check-types && bun run lint && bun run test`
Expected: tudo verde. Os arquivos desta tarefa somam 72 testes (inviteSentence 7, inviteMessages 5, authFormError 10, actions 11, nextConfig 3, SocialButtons 5, InviteUnavailable 5, InviteSignup 18, passkeyErrorCode 8); o total da suíte inclui os testes das tarefas anteriores.
Run: `bun run build` (com `DATABASE_URL`, `BETTER_AUTH_SECRET` de 32+ caracteres e `BETTER_AUTH_URL` definidos no ambiente)
Expected: build conclui e a rota aparece como `◐ /convite/[token]` (Partial Prerender). Sem o `<Suspense>` o build falha por `await params`/`searchParams` fora dele.
- [ ] **Step 19: Commit**
```bash
git add "next.config.ts" "src/features/invites/inviteSentence.ts" "src/features/invites/inviteSentence.test.ts" "src/features/invites/inviteMessages.ts" "src/features/invites/inviteMessages.test.ts" "src/components/auth/authFormError.ts" "src/components/auth/authFormError.test.ts" "src/components/auth/SocialButtons.tsx" "src/components/auth/SocialButtons.test.tsx" "src/components/auth/InviteUnavailable.tsx" "src/components/auth/InviteUnavailable.test.tsx" "src/components/auth/InviteSignup.tsx" "src/components/auth/InviteSignup.test.tsx" "src/app/(auth)/convite/[token]/actions.ts" "src/app/(auth)/convite/[token]/actions.test.ts" "src/app/(auth)/convite/[token]/page.tsx" "src/app/(auth)/layout.tsx" "src/app/nextConfig.test.ts" "src/components/auth/passkeyErrorCode.ts" "src/components/auth/passkeyErrorCode.test.ts" ".context/ui-registry.md"
git commit -F - <<'EOF'
feat(convite): tela de convite com cadastro por e-mail e social

Página /convite/[token] só lê o convite; a Server Action armInvite
revalida e grava o cookie closery_invite sem consumir. Referrer-Policy
no-referrer em /convite/* para o token não vazar.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 10: Tela de entrada `/entrar`

**Files:**
- Create: `src/components/auth/SignInPanel.tsx`
- Create: `src/app/(auth)/entrar/page.tsx`
- Modify: `.context/ui-registry.md` (SignInPanel)
- Test: `src/components/auth/SignInPanel.test.tsx` (projeto `dom`)

**Interfaces:**
- Consumes:
  - Da Tarefa 9: `SocialButtons`, `authFormError`, `errorCodeOf`, `passkeyErrorCode` (`src/components/auth`), layout `(auth)`.
  - `authClient.signIn.email({ email, password })`, `authClient.signIn.passkey(opts?: { autoFill?: boolean })`, `authClient.signIn.social({ provider, requestSignUp, callbackURL, errorCallbackURL })` de `@/lib/auth/client`.
  - `getAuthz(): Promise<Authz | null>` de `@/lib/auth/session`; `authEnv` de `@/lib/auth`; `enabledSocialProviders` de `@/lib/auth/env`.
  - Primitivos shadcn: `Button`, `Card*`, `Field*`, `Input`, `Skeleton`.
- Produces:
  - `SignInPanel({ providers: readonly SocialProvider[]; initialErrorCode: string | null })` — o painel inteiro (título, formulário, passkey, social, rodapé).
  - Página `/entrar` (metadata `Entrar`); quem já tem sessão válida é redirecionado para `/`.

Decisões: o autofill condicional de passkey roda no `useEffect` só se `PublicKeyCredential.isConditionalMediationAvailable` existir e responder `true`; qualquer cancelamento ou erro nele é silencioso (a pessoa ainda tem e-mail e senha) e ele **não** trava os botões. O botão "Entrar com passkey" chama `signIn.passkey()` sem `autoFill`. Falha na cerimônia do WebAuthn chega com o código do `@simplewebauthn/browser` (cancelar o diálogo = `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`); `passkeyErrorCode(…, "authenticate")` da Tarefa 9 traduz para `AUTH_CANCELLED` antes de `authFormError` (T14). Ordem da tela: a spec §4.3 pede "passkey primeiro (autofill), depois social, depois e-mail e senha". A passkey aparece primeiro **pelo autofill**, que vive no campo de e-mail (o primeiro da tela); por isso o formulário vem no topo, seguido do botão "Entrar com passkey" e dos sociais. O desvio fica registrado no log do `architecture.md` (Tarefa 13).

- [ ] **Step 1: Write the failing test**
`src/components/auth/SignInPanel.test.tsx`
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignInPanel } from "./SignInPanel";

const mocks = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signInPasskey: vi.fn(),
  signInSocial: vi.fn(),
  router: { push: vi.fn(), refresh: vi.fn() },
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    signIn: {
      email: mocks.signInEmail,
      passkey: mocks.signInPasskey,
      social: mocks.signInSocial,
    },
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));

const FALLBACK = "Não foi possível concluir. Tente de novo.";

type Props = Partial<Parameters<typeof SignInPanel>[0]>;

function setup(props: Props = {}) {
  return render(
    <SignInPanel providers={[]} initialErrorCode={null} {...props} />,
  );
}

async function fillAndSubmit() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("E-mail"), "ana@example.com");
  await user.type(screen.getByLabelText("Senha"), "senha-segura-1");
  await user.click(screen.getByRole("button", { name: "Entrar" }));
  return user;
}

function stubConditionalMediation(available: boolean | "throws") {
  const isConditionalMediationAvailable =
    available === "throws"
      ? vi.fn().mockRejectedValue(new Error("boom"))
      : vi.fn().mockResolvedValue(available);
  vi.stubGlobal("PublicKeyCredential", { isConditionalMediationAvailable });
  return isConditionalMediationAvailable;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.signInEmail.mockResolvedValue({ data: {}, error: null });
  mocks.signInPasskey.mockResolvedValue({ data: {}, error: null });
  mocks.signInSocial.mockResolvedValue({ data: {}, error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignInPanel", () => {
  it("mostra os textos do contrato", () => {
    setup();
    expect(
      screen.getByRole("heading", { name: "Entrar no Closery" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Entrar com passkey" }),
    ).toBeInTheDocument();
    expect(screen.getByText("O acesso é só por convite.")).toBeInTheDocument();
  });

  it("e-mail aceita autofill de passkey e senha usa o autocomplete certo", () => {
    setup();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute(
      "autocomplete",
      "username webauthn",
    );
    expect(screen.getByLabelText("E-mail")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Senha")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
  });

  it("entra com e-mail e senha e vai para o início atualizando a sessão", async () => {
    setup();
    await fillAndSubmit();

    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith("/"));
    expect(mocks.signInEmail).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "senha-segura-1",
    });
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
  });

  it("senha errada: mensagem mapeada, valores preservados, sem navegar", async () => {
    mocks.signInEmail.mockResolvedValue({
      data: null,
      error: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid password" },
    });
    setup();
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "E-mail ou senha incorretos.",
    );
    expect(screen.queryByText("Invalid password")).not.toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveValue("ana@example.com");
    expect(screen.getByLabelText("Senha")).toHaveValue("senha-segura-1");
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("conta desativada mostra a mensagem do contrato", async () => {
    mocks.signInEmail.mockResolvedValue({
      data: null,
      error: { code: "ACCOUNT_DEACTIVATED" },
    });
    setup();
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Esta conta foi desativada. Fale com o administrador.",
    );
  });

  it("e-mail inválido marca o campo de e-mail", async () => {
    mocks.signInEmail.mockResolvedValue({
      data: null,
      error: { code: "INVALID_EMAIL" },
    });
    setup();
    await fillAndSubmit();

    const alert = await screen.findByRole("alert");
    const email = screen.getByLabelText("E-mail");
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(email.getAttribute("aria-describedby")).toBe(alert.id);
  });

  it("falha de rede mostra o texto padrão e libera o botão", async () => {
    mocks.signInEmail.mockRejectedValue(new Error("Failed to fetch"));
    setup();
    await fillAndSubmit();

    expect(await screen.findByRole("alert")).toHaveTextContent(FALLBACK);
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  it("trava o duplo clique enquanto o login está pendente", async () => {
    let resolveSignIn: (value: unknown) => void = () => {};
    mocks.signInEmail.mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      }),
    );
    setup();
    const user = await fillAndSubmit();

    const submit = screen.getByRole("button", { name: "Entrar" });
    await waitFor(() => expect(submit).toBeDisabled());
    expect(
      screen.getByRole("button", { name: "Entrar com passkey" }),
    ).toBeDisabled();
    await user.click(submit);
    await user.keyboard("{Enter}");
    expect(mocks.signInEmail).toHaveBeenCalledTimes(1);

    resolveSignIn({ data: {}, error: null });
    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledTimes(1));
  });

  it("botão de passkey chama signIn.passkey sem autofill e entra", async () => {
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Entrar com passkey" }),
    );

    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith("/"));
    expect(mocks.signInPasskey).toHaveBeenCalledTimes(1);
    expect(mocks.signInPasskey).toHaveBeenCalledWith();
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.signInEmail).not.toHaveBeenCalled();
  });

  it("passkey cancelada mostra a mensagem mapeada e libera os botões", async () => {
    mocks.signInPasskey.mockResolvedValue({
      data: null,
      error: { code: "AUTH_CANCELLED", message: "cancelled" },
    });
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Entrar com passkey" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Login com passkey cancelado.",
    );
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("cancelar o diálogo do WebAuthn mostra 'Login com passkey cancelado.'", async () => {
    // Código real do @simplewebauthn/browser para NotAllowedError (T14).
    mocks.signInPasskey.mockResolvedValue({
      data: null,
      error: { code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", message: "x" },
    });
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Entrar com passkey" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Login com passkey cancelado.",
    );
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("passkey com erro desconhecido usa o texto padrão", async () => {
    mocks.signInPasskey.mockResolvedValue({
      data: null,
      error: { code: "ALGO_NOVO" },
    });
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Entrar com passkey" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(FALLBACK);
  });

  it("passkey que lança exceção usa o texto padrão e libera os botões", async () => {
    mocks.signInPasskey.mockRejectedValue(new Error("boom"));
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Entrar com passkey" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(FALLBACK);
    expect(
      screen.getByRole("button", { name: "Entrar com passkey" }),
    ).toBeEnabled();
  });

  it("sem provedores sociais habilitados não mostra botões sociais", () => {
    setup({ providers: [] });
    expect(screen.queryByText(/Continuar com/)).not.toBeInTheDocument();
  });

  it("social: entra sem criar conta (requestSignUp false)", async () => {
    setup({ providers: ["google", "facebook"] });
    await userEvent.click(
      screen.getByRole("button", { name: "Continuar com Google" }),
    );

    await waitFor(() => expect(mocks.signInSocial).toHaveBeenCalledTimes(1));
    expect(mocks.signInSocial).toHaveBeenCalledWith({
      provider: "google",
      requestSignUp: false,
      callbackURL: "/",
      errorCallbackURL: "/entrar",
    });
  });

  it("social com erro devolvido mostra a mensagem mapeada", async () => {
    mocks.signInSocial.mockResolvedValue({
      data: null,
      error: { code: "signup_disabled" },
    });
    setup({ providers: ["facebook"] });
    await userEvent.click(
      screen.getByRole("button", { name: "Continuar com Facebook" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Conta não encontrada. Peça um convite.",
    );
    expect(mocks.signInSocial).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "facebook" }),
    );
  });

  it("erro inicial vindo de ?error= aparece traduzido", () => {
    setup({ initialErrorCode: "access_denied" });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Você cancelou o acesso. Tente de novo quando quiser.",
    );
  });

  it("erro inicial desconhecido vira o texto padrão e nunca o texto cru", () => {
    setup({ initialErrorCode: "<img src=x onerror=alert(1)>" });
    expect(screen.getByRole("alert")).toHaveTextContent(FALLBACK);
  });

  it("sem erro inicial não há alerta", () => {
    setup();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  describe("autofill condicional de passkey", () => {
    it("não chama signIn.passkey em ambiente sem WebAuthn", async () => {
      vi.stubGlobal("PublicKeyCredential", undefined);
      setup();
      await Promise.resolve();
      expect(mocks.signInPasskey).not.toHaveBeenCalled();
    });

    it("não chama quando o navegador não oferece mediação condicional", async () => {
      const check = stubConditionalMediation(false);
      setup();
      await waitFor(() => expect(check).toHaveBeenCalled());
      expect(mocks.signInPasskey).not.toHaveBeenCalled();
    });

    it("não chama quando a API existe sem isConditionalMediationAvailable", async () => {
      vi.stubGlobal("PublicKeyCredential", {});
      setup();
      await Promise.resolve();
      expect(mocks.signInPasskey).not.toHaveBeenCalled();
    });

    it("chama signIn.passkey({ autoFill: true }) quando há suporte", async () => {
      stubConditionalMediation(true);
      setup();
      await waitFor(() =>
        expect(mocks.signInPasskey).toHaveBeenCalledWith({ autoFill: true }),
      );
      expect(mocks.signInPasskey).toHaveBeenCalledTimes(1);
    });

    it("autofill bem-sucedido entra e atualiza a sessão", async () => {
      stubConditionalMediation(true);
      setup();
      await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith("/"));
      expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
    });

    it("autofill cancelado ou com erro é silencioso", async () => {
      stubConditionalMediation(true);
      mocks.signInPasskey.mockResolvedValue({
        data: null,
        error: { code: "AUTH_CANCELLED" },
      });
      setup();
      await waitFor(() => expect(mocks.signInPasskey).toHaveBeenCalled());
      await Promise.resolve();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(mocks.router.push).not.toHaveBeenCalled();
    });

    it("exceção ao checar suporte não quebra a tela", async () => {
      const check = stubConditionalMediation("throws");
      setup();
      await waitFor(() => expect(check).toHaveBeenCalled());
      expect(mocks.signInPasskey).not.toHaveBeenCalled();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
    });

    it("o autofill não trava os botões da tela", async () => {
      stubConditionalMediation(true);
      mocks.signInPasskey.mockReturnValue(new Promise(() => {}));
      setup();
      await waitFor(() => expect(mocks.signInPasskey).toHaveBeenCalled());
      expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Entrar com passkey" }),
      ).toBeEnabled();
    });
  });
});
```
- [ ] **Step 2: Run test to verify it fails**
Run: `bun run test -- SignInPanel`
Expected: FAIL com `Failed to resolve import "./SignInPanel" from "src/components/auth/SignInPanel.test.tsx"`
- [ ] **Step 3: Write minimal implementation**
`src/components/auth/SignInPanel.tsx`
```tsx
"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import type { SocialProvider } from "@/lib/auth/env";
import {
  type AuthFormError,
  authFormError,
  errorCodeOf,
} from "./authFormError";
import { passkeyErrorCode } from "./passkeyErrorCode";
import { SocialButtons } from "./SocialButtons";

type SignInPanelProps = {
  providers: readonly SocialProvider[];
  initialErrorCode: string | null;
};

export function SignInPanel({ providers, initialErrorCode }: SignInPanelProps) {
  const router = useRouter();
  const uid = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AuthFormError | null>(
    initialErrorCode ? authFormError(initialErrorCode) : null,
  );

  const errorId = `${uid}-error`;

  // Autofill condicional: o navegador oferece as passkeys no campo de e-mail.
  // Só roda onde existe WebAuthn com mediação condicional (nunca no SSR nem no
  // ambiente de teste); cancelar ou falhar aqui é normal e fica em silêncio.
  useEffect(() => {
    let active = true;
    async function startAutofill() {
      try {
        const available =
          await globalThis.PublicKeyCredential?.isConditionalMediationAvailable?.();
        if (!available || !active) return;
        const result = await authClient.signIn.passkey({ autoFill: true });
        if (active && result?.data) {
          router.push("/");
          router.refresh();
        }
      } catch {
        // Sem suporte ou ceremony abortada: o login por e-mail segue disponível.
      }
    }
    void startAutofill();
    return () => {
      active = false;
    };
  }, [router]);

  function finishSignIn() {
    router.push("/");
    router.refresh();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
      });
      if (signInError) {
        setError(authFormError(signInError.code));
        setPending(false);
        return;
      }
      finishSignIn();
    } catch {
      setError(authFormError(null));
      setPending(false);
    }
  }

  async function handlePasskey() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { error: passkeyError } = await authClient.signIn.passkey();
      if (passkeyError) {
        setError(
          authFormError(
            passkeyErrorCode(errorCodeOf(passkeyError), "authenticate"),
          ),
        );
        setPending(false);
        return;
      }
      finishSignIn();
    } catch {
      setError(authFormError(null));
      setPending(false);
    }
  }

  async function handleSocial(provider: SocialProvider) {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { error: socialError } = await authClient.signIn.social({
        provider,
        requestSignUp: false,
        callbackURL: "/",
        errorCallbackURL: "/entrar",
      });
      if (socialError) {
        setError(authFormError(socialError.code));
        setPending(false);
      }
      // Sem erro, o navegador está indo para o provedor: mantém travado.
    } catch {
      setError(authFormError(null));
      setPending(false);
    }
  }

  const emailError = error?.field === "email";

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={1}>
          Entrar no Closery
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={emailError ? true : undefined}>
              <FieldLabel htmlFor={`${uid}-email`}>E-mail</FieldLabel>
              <Input
                id={`${uid}-email`}
                name="email"
                type="email"
                autoComplete="username webauthn"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? errorId : undefined}
              />
              {emailError && (
                <FieldError id={errorId}>{error?.message}</FieldError>
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor={`${uid}-password`}>Senha</FieldLabel>
              <Input
                id={`${uid}-password`}
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>

            {error && !emailError && (
              <FieldError id={errorId}>{error.message}</FieldError>
            )}

            <Button type="submit" size="lg" disabled={pending}>
              Entrar
            </Button>
          </FieldGroup>
        </form>

        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={pending}
          onClick={handlePasskey}
        >
          Entrar com passkey
        </Button>

        <SocialButtons
          providers={providers}
          onSelect={handleSocial}
          disabled={pending}
        />
      </CardContent>
      <CardFooter>
        <p className="text-sm text-muted-foreground">
          O acesso é só por convite.
        </p>
      </CardFooter>
    </Card>
  );
}
```
`src/app/(auth)/entrar/page.tsx`
```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignInPanel } from "@/components/auth/SignInPanel";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { authEnv } from "@/lib/auth";
import { enabledSocialProviders } from "@/lib/auth/env";
import { getAuthz } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Entrar" };

// Page não lê sessão nem searchParams: ambos são dados de requisição e só
// podem ser aguardados dentro do <Suspense> (Cache Components).
export default function Page(props: PageProps<"/entrar">) {
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function SignInContent({
  searchParams,
}: {
  searchParams: PageProps<"/entrar">["searchParams"];
}) {
  // Quem já está logado não precisa da tela de entrada.
  if (await getAuthz()) redirect("/");

  const query = await searchParams;
  return (
    <SignInPanel
      providers={enabledSocialProviders(authEnv)}
      initialErrorCode={typeof query.error === "string" ? query.error : null}
    />
  );
}

function SignInFallback() {
  return (
    <Card aria-busy="true">
      <CardHeader>
        <Skeleton className="h-5 w-44" />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </CardContent>
    </Card>
  );
}
```
- [ ] **Step 4: Run test to verify it passes**
Run: `bun run test -- SignInPanel`
Expected: PASS (27 testes)
- [ ] **Step 4a: Atualizar `.context/ui-registry.md`**

Com a ferramenta Edit, acrescente ao fim da seção `## 2. Componentes de aplicação — `src/components/<área>`` (depois de `InviteSignup`, da Tarefa 9):

```
### SignInPanel
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/auth/SignInPanel.tsx`
- **Propósito:** tela de entrada (e-mail e senha, passkey, social).
- **Como funciona:** `"use client"`; autofill condicional de passkey no mount (silencioso, não
  trava botões); botão "Entrar com passkey"; social com `requestSignUp: false`; erro inicial de
  `?error=`; erros por `authFormError`/`passkeyErrorCode`. O formulário vem primeiro porque o
  autofill de passkey vive no campo de e-mail.
- **Usa:** `Card*`, `Field*`, `Input`, `Button`, `SocialButtons`.
- **Histórico:** 2026-11-20 — criado na Fase 1.
```

Run: `grep -c "^### SignInPanel" .context/ui-registry.md`
Expected: `1`.
- [ ] **Step 5: Verificar tipos, lint, testes e build**
Run: `bun run check-types && bun run lint && bun run test && bun run build`
Expected: tudo verde; `◐ /entrar` na lista de rotas (Partial Prerender).
- [ ] **Step 6: Commit**
```bash
git add "src/components/auth/SignInPanel.tsx" "src/components/auth/SignInPanel.test.tsx" "src/app/(auth)/entrar/page.tsx" ".context/ui-registry.md"
git commit -F - <<'EOF'
feat(entrar): tela de entrada com e-mail, passkey e social

Autofill condicional de passkey protegido para ambientes sem WebAuthn;
erros sempre traduzidos pelo mapa do contrato.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

### Task 11: `/bem-vindo` e `/conta` (passkeys e sair)

**Files:**
- Create: `src/components/auth/passkeyDate.ts`
- Create: `src/components/auth/PasskeyOffer.tsx`
- Create: `src/components/auth/PasskeyManager.tsx`
- Create: `src/components/auth/SignOutButton.tsx`
- Create: `src/app/(app)/bem-vindo/page.tsx`
- Create: `src/app/(app)/conta/page.tsx`
- Modify: `.context/ui-registry.md` (PasskeyOffer, PasskeyManager, SignOutButton)
- Test: `src/components/auth/passkeyDate.test.ts` (projeto `node`)
- Test: `src/components/auth/PasskeyOffer.test.tsx`, `src/components/auth/PasskeyManager.test.tsx`, `src/components/auth/SignOutButton.test.tsx` (projeto `dom`)

**Interfaces:**
- Consumes:
  - Da Tarefa 9: `authFormError`, `errorCodeOf`, `passkeyErrorCode`.
  - `authClient.passkey.addPasskey()`, `authClient.passkey.deletePasskey({ id })`, `authClient.useListPasskeys()` (devolve `{ data, isPending, error, refetch }`) e `authClient.signOut()` de `@/lib/auth/client`.
  - `requireUser(): Promise<Authz>` de `@/lib/auth/session` (`Authz` tem `name` e `email`).
  - Do layout `(app)` (Tarefa 8): o shell autenticado e o `<Toaster />` do `sonner`; `TooltipProvider` de `@/components/ui/tooltip` (nos testes de `PasskeyManager` ele é colocado em volta do componente).
  - Primitivos shadcn: `Button`, `buttonVariants`, `Card*`, `FieldError`, `Skeleton`, `Tooltip*`; `toast` de `sonner`; `cn` de `@/lib/utils`; `Trash2` de `lucide-react`.
- Produces:
  - `PasskeyOffer()`, `PasskeyManager()`, `SignOutButton()` em `src/components/auth/`.
  - `formatPasskeyDate(value: string | Date | null | undefined): string` — dia no fuso `America/Sao_Paulo`, vazio se ausente ou inválido.
  - Rotas `/bem-vindo` (metadata `Bem-vindo`) e `/conta` (metadata `Conta`), ambas protegidas por `requireUser()` dentro de `<Suspense>`.
  - `AUTH_ERROR_MESSAGES` **não** muda: o `addPasskey` do cliente devolve códigos crus do WebAuthn, e `passkeyErrorCode(…, "register")` da Tarefa 9 os traduz antes de `authFormError` (T14).

Decisões: "Agora não" é um `<Link>` estilizado com `buttonVariants` (link de verdade, `role="link"`), e não `Button render={<Link/>}` (que vira `role="button"`). Em `/conta` criar e remover passkey não navegam: o próprio `useListPasskeys` se atualiza (o plugin dispara o sinal `$listPasskeys`); o toast confirma. Erros de ação aparecem em um `FieldError` (`role="alert"`) com o texto do mapa; falha de carregar a lista tem "Tentar de novo". Os botões de remover ficam desabilitados enquanto qualquer criação/remoção está pendente (trava de duplo clique e de ações concorrentes). O tooltip do botão de ícone é verificado com `fireEvent.pointerEnter/mouseEnter` (o `hover` do user-event não dispara a abertura do Tooltip do Base UI no ambiente de teste, jsdom 28).

- [ ] **Step 1: Write the failing test — data de criação da passkey**
`src/components/auth/passkeyDate.test.ts`
```ts
import { describe, expect, it } from "vitest";
import { formatPasskeyDate } from "./passkeyDate";

describe("formatPasskeyDate", () => {
  it("formata em pt-BR", () => {
    expect(formatPasskeyDate("2026-03-15T15:00:00.000Z")).toBe(
      "15 de mar. de 2026",
    );
  });

  it("aceita Date", () => {
    expect(formatPasskeyDate(new Date("2026-11-20T12:00:00.000Z"))).toBe(
      "20 de nov. de 2026",
    );
  });

  it("usa o dia no fuso America/Sao_Paulo, não o UTC", () => {
    // 01:30 UTC de 16/mar ainda é 22:30 de 15/mar em São Paulo.
    expect(formatPasskeyDate("2026-03-16T01:30:00.000Z")).toBe(
      "15 de mar. de 2026",
    );
  });

  it("devolve texto vazio para ausente ou data inválida", () => {
    expect(formatPasskeyDate(null)).toBe("");
    expect(formatPasskeyDate(undefined)).toBe("");
    expect(formatPasskeyDate("não é data")).toBe("");
  });
});
```
- [ ] **Step 2: Run test to verify it fails**
Run: `bun run test -- passkeyDate`
Expected: FAIL — `Cannot find module './passkeyDate'`
- [ ] **Step 3: Write minimal implementation**
`src/components/auth/passkeyDate.ts`
```ts
const formatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "medium",
  timeZone: "America/Sao_Paulo",
});

// O dia mostrado é o do fuso da operação, não o do servidor nem o do aparelho.
export function formatPasskeyDate(
  value: string | Date | null | undefined,
): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatter.format(date);
}
```
Não mexa em `src/lib/auth/errors.ts`: os testes da Tarefa 6 comparam as chaves do mapa por igualdade exata. Os códigos crus do WebAuthn são traduzidos por `passkeyErrorCode` (Tarefa 9).
- [ ] **Step 4: Run test to verify it passes**
Run: `bun run test -- passkeyDate`
Expected: PASS (4 testes)
- [ ] **Step 5: Write the failing test — oferta de passkey e botão sair**
`src/components/auth/PasskeyOffer.test.tsx`
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PasskeyOffer } from "./PasskeyOffer";

const mocks = vi.hoisted(() => ({
  addPasskey: vi.fn(),
  toastSuccess: vi.fn(),
  router: { push: vi.fn(), refresh: vi.fn() },
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: { passkey: { addPasskey: mocks.addPasskey } },
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess } }));

const FALLBACK = "Não foi possível concluir. Tente de novo.";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.addPasskey.mockResolvedValue({ data: {}, error: null });
});

describe("PasskeyOffer", () => {
  it("mostra os textos do contrato", () => {
    render(<PasskeyOffer />);
    expect(
      screen.getByRole("heading", { name: "Conta criada" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Quer entrar mais rápido da próxima vez? Crie uma passkey: você entra com a digital, o rosto ou o PIN do aparelho.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Criar passkey" }),
    ).toBeInTheDocument();
  });

  it("'Agora não' é um link para o início", () => {
    render(<PasskeyOffer />);
    expect(screen.getByRole("link", { name: "Agora não" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("cria a passkey, avisa e vai para o início", async () => {
    render(<PasskeyOffer />);
    await userEvent.click(
      screen.getByRole("button", { name: "Criar passkey" }),
    );

    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledWith("/"));
    expect(mocks.addPasskey).toHaveBeenCalledTimes(1);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Passkey criada.");
  });

  it.each([
    ["REGISTRATION_CANCELLED", "Criação da passkey cancelada."],
    ["ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", "Criação da passkey cancelada."],
    ["ERROR_CEREMONY_ABORTED", "Criação da passkey cancelada."],
    ["PREVIOUSLY_REGISTERED", "Esta passkey já está cadastrada."],
    ["ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED", "Esta passkey já está cadastrada."],
    [
      "SESSION_NOT_FRESH",
      "Por segurança, entre de novo antes de criar uma passkey.",
    ],
  ])("erro %s mostra a mensagem mapeada e não navega", async (code, message) => {
    mocks.addPasskey.mockResolvedValue({
      data: null,
      error: { code, message: "texto cru" },
    });
    render(<PasskeyOffer />);
    await userEvent.click(
      screen.getByRole("button", { name: "Criar passkey" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.queryByText("texto cru")).not.toBeInTheDocument();
    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Criar passkey" })).toBeEnabled();
  });

  it("código desconhecido ou exceção usa o texto padrão e libera o botão", async () => {
    mocks.addPasskey.mockRejectedValue(new Error("boom"));
    render(<PasskeyOffer />);
    await userEvent.click(
      screen.getByRole("button", { name: "Criar passkey" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(FALLBACK);
    expect(screen.getByRole("button", { name: "Criar passkey" })).toBeEnabled();
  });

  it("trava o duplo clique enquanto a criação está pendente", async () => {
    let resolveAdd: (value: unknown) => void = () => {};
    mocks.addPasskey.mockReturnValue(
      new Promise((resolve) => {
        resolveAdd = resolve;
      }),
    );
    render(<PasskeyOffer />);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Criar passkey" });
    await user.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    await user.click(button);
    expect(mocks.addPasskey).toHaveBeenCalledTimes(1);

    resolveAdd({ data: {}, error: null });
    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledTimes(1));
  });
});
```
`src/components/auth/SignOutButton.test.tsx`
```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignOutButton } from "./SignOutButton";

const mocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  router: { push: vi.fn(), refresh: vi.fn() },
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: { signOut: mocks.signOut },
}));
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.signOut.mockResolvedValue({ data: { success: true }, error: null });
});

describe("SignOutButton", () => {
  it("sai, vai para /entrar e atualiza a sessão", async () => {
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    await waitFor(() =>
      expect(mocks.router.push).toHaveBeenCalledWith("/entrar"),
    );
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    expect(mocks.router.refresh).toHaveBeenCalledTimes(1);
  });

  it("erro devolvido: mostra o texto padrão, não navega e libera o botão", async () => {
    mocks.signOut.mockResolvedValue({
      data: null,
      error: { status: 500, statusText: "x", message: "texto cru" },
    });
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir. Tente de novo.",
    );
    expect(screen.queryByText("texto cru")).not.toBeInTheDocument();
    expect(mocks.router.push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sair" })).toBeEnabled();
  });

  it("falha de rede (exceção) mostra o texto padrão", async () => {
    mocks.signOut.mockRejectedValue(new Error("Failed to fetch"));
    render(<SignOutButton />);
    await userEvent.click(screen.getByRole("button", { name: "Sair" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(mocks.router.push).not.toHaveBeenCalled();
  });

  it("trava o duplo clique enquanto pendente", async () => {
    let resolveOut: (value: unknown) => void = () => {};
    mocks.signOut.mockReturnValue(
      new Promise((resolve) => {
        resolveOut = resolve;
      }),
    );
    render(<SignOutButton />);
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Sair" });
    await user.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    await user.click(button);
    expect(mocks.signOut).toHaveBeenCalledTimes(1);

    resolveOut({ data: { success: true }, error: null });
    await waitFor(() => expect(mocks.router.push).toHaveBeenCalledTimes(1));
  });
});
```
- [ ] **Step 6: Run test to verify it fails**
Run: `bun run test -- PasskeyOffer SignOutButton`
Expected: FAIL com `Failed to resolve import "./PasskeyOffer" from "src/components/auth/PasskeyOffer.test.tsx"` (e o mesmo para `SignOutButton`)
- [ ] **Step 7: Write minimal implementation**
`src/components/auth/PasskeyOffer.tsx`
```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";
import { cn } from "@/lib/utils";
import { authFormError, errorCodeOf } from "./authFormError";
import { passkeyErrorCode } from "./passkeyErrorCode";

export function PasskeyOffer() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { error: passkeyError } = await authClient.passkey.addPasskey();
      if (passkeyError) {
        setError(
          authFormError(passkeyErrorCode(errorCodeOf(passkeyError), "register"))
            .message,
        );
        setPending(false);
        return;
      }
      toast.success("Passkey criada.");
      router.push("/");
    } catch {
      setError(authFormError(null).message);
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={1}>
          Conta criada
        </CardTitle>
        <CardDescription>
          Quer entrar mais rápido da próxima vez? Crie uma passkey: você entra
          com a digital, o rosto ou o PIN do aparelho.
        </CardDescription>
      </CardHeader>
      {error && (
        <CardContent>
          <FieldError>{error}</FieldError>
        </CardContent>
      )}
      <CardFooter className="flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          size="lg"
          className="w-full sm:w-auto"
          disabled={pending}
          onClick={handleCreate}
        >
          Criar passkey
        </Button>
        <Link
          href="/"
          className={cn(
            buttonVariants({ variant: "ghost", size: "lg" }),
            "w-full sm:w-auto",
          )}
        >
          Agora não
        </Link>
      </CardFooter>
    </Card>
  );
}
```
`src/components/auth/SignOutButton.tsx`
```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { authClient } from "@/lib/auth/client";
import { authFormError } from "./authFormError";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignOut() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const { error: signOutError } = await authClient.signOut();
      if (signOutError) {
        setError(authFormError(null).message);
        setPending(false);
        return;
      }
      router.push("/entrar");
      router.refresh();
    } catch {
      setError(authFormError(null).message);
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full sm:w-auto"
        disabled={pending}
        onClick={handleSignOut}
      >
        Sair
      </Button>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
```
- [ ] **Step 8: Run test to verify it passes**
Run: `bun run test -- PasskeyOffer SignOutButton`
Expected: PASS (15 testes: 11 em `PasskeyOffer.test.tsx` + 4 em `SignOutButton.test.tsx`)
- [ ] **Step 9: Write the failing test — gerenciador de passkeys**
`src/components/auth/PasskeyManager.test.tsx`
```tsx
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PasskeyManager } from "./PasskeyManager";

type ListState = {
  data: { id: string; name: string | null; createdAt: string | null }[] | null;
  isPending: boolean;
  error: { message?: string } | null;
  refetch: () => void;
};

const mocks = vi.hoisted(() => ({
  useListPasskeys: vi.fn(),
  addPasskey: vi.fn(),
  deletePasskey: vi.fn(),
  refetch: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/auth/client", () => ({
  authClient: {
    useListPasskeys: mocks.useListPasskeys,
    passkey: {
      addPasskey: mocks.addPasskey,
      deletePasskey: mocks.deletePasskey,
    },
  },
}));
vi.mock("sonner", () => ({ toast: { success: mocks.toastSuccess } }));

const FALLBACK = "Não foi possível concluir. Tente de novo.";

function listState(overrides: Partial<ListState> = {}): ListState {
  return {
    data: [],
    isPending: false,
    error: null,
    refetch: mocks.refetch,
    ...overrides,
  };
}

function setup(state: ListState = listState()) {
  mocks.useListPasskeys.mockReturnValue(state);
  return render(
    <TooltipProvider>
      <PasskeyManager />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.addPasskey.mockResolvedValue({ data: {}, error: null });
  mocks.deletePasskey.mockResolvedValue({
    data: { status: true },
    error: null,
  });
});

describe("PasskeyManager", () => {
  it("mostra a seção, o estado vazio e o botão de criar", () => {
    setup();
    expect(
      screen.getByRole("heading", { name: "Passkeys" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nenhuma passkey ainda.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Criar passkey" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("carregando: mostra esqueleto e não afirma que está vazio", () => {
    setup(listState({ data: null, isPending: true }));
    expect(
      screen.queryByText("Nenhuma passkey ainda."),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("passkeys-loading")).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("lista nome e data de criação em pt-BR", () => {
    setup(
      listState({
        data: [
          { id: "p1", name: "Notebook", createdAt: "2026-03-15T15:00:00.000Z" },
          { id: "p2", name: null, createdAt: null },
        ],
      }),
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByText("Notebook")).toBeVisible();
    expect(
      within(items[0] as HTMLElement).getByText(/15 de mar\. de 2026/),
    ).toBeVisible();
    // Sem nome e sem data: rótulo padrão, sem inventar data.
    expect(within(items[1] as HTMLElement).getByText("Passkey")).toBeVisible();
    expect(
      screen.queryByText("Nenhuma passkey ainda."),
    ).not.toBeInTheDocument();
  });

  it("falha ao carregar: mostra o texto padrão e permite tentar de novo", async () => {
    setup(listState({ data: null, error: { message: "texto cru" } }));
    expect(screen.getByRole("alert")).toHaveTextContent(FALLBACK);
    expect(screen.queryByText("texto cru")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" }),
    );
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it("criar passkey: avisa com toast e fica na tela", async () => {
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Criar passkey" }),
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Passkey criada."),
    );
    expect(mocks.addPasskey).toHaveBeenCalledTimes(1);
  });

  it("criar passkey com erro mostra a mensagem mapeada, sem toast", async () => {
    mocks.addPasskey.mockResolvedValue({
      data: null,
      error: { code: "SESSION_NOT_FRESH", message: "texto cru" },
    });
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Criar passkey" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Por segurança, entre de novo antes de criar uma passkey.",
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Criar passkey" })).toBeEnabled();
  });

  it("cancelar o diálogo do WebAuthn mostra 'Criação da passkey cancelada.'", async () => {
    // Código real do @simplewebauthn/browser para NotAllowedError (T14).
    mocks.addPasskey.mockResolvedValue({
      data: null,
      error: { code: "ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY", message: "x" },
    });
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Criar passkey" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Criação da passkey cancelada.",
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("criar passkey que lança exceção usa o texto padrão", async () => {
    mocks.addPasskey.mockRejectedValue(new Error("boom"));
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Criar passkey" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(FALLBACK);
  });

  it("trava o duplo clique ao criar", async () => {
    mocks.addPasskey.mockReturnValue(new Promise(() => {}));
    setup();
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Criar passkey" });
    await user.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    await user.click(button);
    expect(mocks.addPasskey).toHaveBeenCalledTimes(1);
  });

  it("remover: botão de ícone com aria-label, chama deletePasskey e avisa", async () => {
    setup(
      listState({
        data: [{ id: "p1", name: "Notebook", createdAt: null }],
      }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remover passkey" }),
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Passkey removida."),
    );
    expect(mocks.deletePasskey).toHaveBeenCalledWith({ id: "p1" });
  });

  it("remover mostra o tooltip 'Remover passkey' ao passar o mouse", async () => {
    setup(
      listState({ data: [{ id: "p1", name: "Notebook", createdAt: null }] }),
    );
    const button = screen.getByRole("button", { name: "Remover passkey" });
    fireEvent.pointerEnter(button, { pointerType: "mouse" });
    fireEvent.mouseEnter(button);
    fireEvent.pointerMove(button, { pointerType: "mouse" });
    fireEvent.mouseMove(button);
    expect(await screen.findByText("Remover passkey")).toBeVisible();
  });

  it("remover só afeta o item clicado", async () => {
    setup(
      listState({
        data: [
          { id: "p1", name: "Notebook", createdAt: null },
          { id: "p2", name: "Celular", createdAt: null },
        ],
      }),
    );
    const items = screen.getAllByRole("listitem");
    await userEvent.click(
      within(items[1] as HTMLElement).getByRole("button", {
        name: "Remover passkey",
      }),
    );
    await waitFor(() => expect(mocks.deletePasskey).toHaveBeenCalled());
    expect(mocks.deletePasskey).toHaveBeenCalledWith({ id: "p2" });
    expect(mocks.deletePasskey).toHaveBeenCalledTimes(1);
  });

  it("remover com erro mostra a mensagem mapeada, sem toast", async () => {
    mocks.deletePasskey.mockResolvedValue({
      data: null,
      error: { code: "PASSKEY_NOT_FOUND", message: "texto cru" },
    });
    setup(
      listState({ data: [{ id: "p1", name: "Notebook", createdAt: null }] }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Remover passkey" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Passkey não encontrada.",
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Remover passkey" }),
    ).toBeEnabled();
  });

  it("trava o duplo clique ao remover", async () => {
    mocks.deletePasskey.mockReturnValue(new Promise(() => {}));
    setup(
      listState({ data: [{ id: "p1", name: "Notebook", createdAt: null }] }),
    );
    const user = userEvent.setup();
    const button = screen.getByRole("button", { name: "Remover passkey" });
    await user.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    await user.click(button);
    expect(mocks.deletePasskey).toHaveBeenCalledTimes(1);
  });
});
```
- [ ] **Step 10: Run test to verify it fails**
Run: `bun run test -- PasskeyManager`
Expected: FAIL com `Failed to resolve import "./PasskeyManager" from "src/components/auth/PasskeyManager.test.tsx"`
- [ ] **Step 11: Write minimal implementation**
`src/components/auth/PasskeyManager.tsx`
```tsx
"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient } from "@/lib/auth/client";
import { authFormError, errorCodeOf } from "./authFormError";
import { formatPasskeyDate } from "./passkeyDate";
import { passkeyErrorCode } from "./passkeyErrorCode";

export function PasskeyManager() {
  const {
    data,
    isPending: isLoading,
    error: loadError,
    refetch,
  } = authClient.useListPasskeys();
  const [creating, setCreating] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const busy = creating || removingId !== null;

  async function handleCreate() {
    if (busy) return;
    setCreating(true);
    setError(null);
    try {
      const { error: passkeyError } = await authClient.passkey.addPasskey();
      if (passkeyError) {
        setError(
          authFormError(passkeyErrorCode(errorCodeOf(passkeyError), "register"))
            .message,
        );
        return;
      }
      toast.success("Passkey criada.");
    } catch {
      setError(authFormError(null).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleRemove(id: string) {
    if (busy) return;
    setRemovingId(id);
    setError(null);
    try {
      const { error: removeError } = await authClient.passkey.deletePasskey({
        id,
      });
      if (removeError) {
        setError(authFormError(errorCodeOf(removeError)).message);
        return;
      }
      toast.success("Passkey removida.");
    } catch {
      setError(authFormError(null).message);
    } finally {
      setRemovingId(null);
    }
  }

  const passkeys = data ?? [];

  return (
    <section className="flex flex-col gap-4" aria-labelledby="passkeys-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="passkeys-title" className="text-base font-medium">
          Passkeys
        </h2>
        <Button
          type="button"
          variant="outline"
          disabled={creating}
          onClick={handleCreate}
        >
          Criar passkey
        </Button>
      </div>

      {error && <FieldError>{error}</FieldError>}

      {loadError ? (
        <div className="flex flex-col items-start gap-2">
          <FieldError>{authFormError(null).message}</FieldError>
          <Button type="button" variant="outline" onClick={() => refetch()}>
            Tentar de novo
          </Button>
        </div>
      ) : isLoading ? (
        <div
          data-testid="passkeys-loading"
          aria-busy="true"
          className="flex flex-col gap-2"
        >
          <Skeleton className="h-12 w-full" />
        </div>
      ) : passkeys.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma passkey ainda.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {passkeys.map((passkey) => {
            const created = formatPasskeyDate(passkey.createdAt);
            return (
              <li
                key={passkey.id}
                className="flex items-center justify-between gap-2 rounded-lg border p-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {passkey.name || "Passkey"}
                  </span>
                  {created && (
                    <span className="text-sm text-muted-foreground">
                      Criada em {created}
                    </span>
                  )}
                </div>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remover passkey"
                        disabled={busy}
                        onClick={() => handleRemove(passkey.id)}
                      />
                    }
                  >
                    <Trash2 />
                  </TooltipTrigger>
                  <TooltipContent>Remover passkey</TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
```
- [ ] **Step 12: Run test to verify it passes**
Run: `bun run test -- PasskeyManager`
Expected: PASS (14 testes)
- [ ] **Step 13: Criar as páginas `/bem-vindo` e `/conta`**
`src/app/(app)/bem-vindo/page.tsx`
```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { PasskeyOffer } from "@/components/auth/PasskeyOffer";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Bem-vindo" };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-md">
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <WelcomeContent />
      </Suspense>
    </div>
  );
}

// A sessão é dado de requisição: só pode ser lida dentro do <Suspense>.
async function WelcomeContent() {
  await requireUser();
  return <PasskeyOffer />;
}
```
`src/app/(app)/conta/page.tsx`
```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { PasskeyManager } from "@/components/auth/PasskeyManager";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Conta" };

export default function Page() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <h1 className="text-xl font-semibold">Conta</h1>
      <Suspense fallback={<AccountFallback />}>
        <AccountContent />
      </Suspense>
    </div>
  );
}

// A sessão é dado de requisição: só pode ser lida dentro do <Suspense>.
async function AccountContent() {
  const { name, email } = await requireUser();
  return (
    <>
      <div className="flex flex-col">
        <span className="text-base font-medium">{name}</span>
        <span className="text-sm text-muted-foreground">{email}</span>
      </div>
      <PasskeyManager />
      <SignOutButton />
    </>
  );
}

function AccountFallback() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
```
- [ ] **Step 14: Verificar tipos, lint, testes e build**
Run: `bun run check-types && bun run lint && bun run test && bun run build`
Expected: tudo verde; `◐ /bem-vindo` e `◐ /conta` na lista de rotas (Partial Prerender).
- [ ] **Step 14a: Atualizar `.context/ui-registry.md`**

Com a ferramenta Edit, acrescente ao fim da seção `## 2. Componentes de aplicação — `src/components/<área>`` (depois de `SignInPanel`, da Tarefa 10):

```
### PasskeyOffer
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/auth/PasskeyOffer.tsx`
- **Propósito:** oferta de passkey em `/bem-vindo`.
- **Como funciona:** `"use client"`; "Criar passkey" (toast "Passkey criada." e vai para `/`);
  "Agora não" é `<Link className={buttonVariants()}>` (role link); erros por
  `passkeyErrorCode(…, "register")` + `authFormError`.
- **Usa:** `Card*`, `Button`, `buttonVariants`, `FieldError`, `sonner`.
- **Histórico:** 2026-11-20 — criado na Fase 1.

### PasskeyManager
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/auth/PasskeyManager.tsx`
- **Propósito:** lista, cria e remove passkeys em `/conta`.
- **Como funciona:** `"use client"`; `authClient.useListPasskeys()` (atualiza sozinho pelo sinal
  do plugin); estados carregando/vazio/erro com "Tentar de novo"; remover = botão de ícone com
  `aria-label` + Tooltip "Remover passkey"; ações travadas enquanto pendentes; toasts.
- **Usa:** `Button`, `Tooltip*`, `Skeleton`, `FieldError`, `sonner`.
- **Histórico:** 2026-11-20 — criado na Fase 1.

### SignOutButton
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/auth/SignOutButton.tsx`
- **Propósito:** botão "Sair".
- **Como funciona:** `"use client"`; `authClient.signOut()` → `/entrar` + `router.refresh()`; erro
  mostra o fallback.
- **Usa:** `Button`, `FieldError`.
- **Histórico:** 2026-11-20 — criado na Fase 1.
```

Run: `grep -c "^### PasskeyOffer\|^### PasskeyManager\|^### SignOutButton" .context/ui-registry.md`
Expected: `3`.
- [ ] **Step 15: Commit**
```bash
git add "src/components/auth/passkeyDate.ts" "src/components/auth/passkeyDate.test.ts" "src/components/auth/PasskeyOffer.tsx" "src/components/auth/PasskeyOffer.test.tsx" "src/components/auth/PasskeyManager.tsx" "src/components/auth/PasskeyManager.test.tsx" "src/components/auth/SignOutButton.tsx" "src/components/auth/SignOutButton.test.tsx" "src/app/(app)/bem-vindo/page.tsx" "src/app/(app)/conta/page.tsx" ".context/ui-registry.md"
git commit -F - <<'EOF'
feat(conta): oferta de passkey, gerenciador de passkeys e sair

Páginas /bem-vindo e /conta; códigos crus do WebAuthn traduzidos por
passkeyErrorCode antes do mapa de mensagens.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 12: E2E com Playwright + pglite-socket

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/db.ts`
- Create: `e2e/virtual-authenticator.ts`
- Create: `e2e/start-db.ts`
- Create: `e2e/auth.spec.ts`
- Modify: `package.json` (devDependencies via `bun add -d`; script `"test:e2e": "playwright test"` dentro de `scripts`)
- Modify: `.gitignore` (acrescentar `playwright-report/`, `test-results/`, `blob-report/` no fim)
- Test: `e2e/auth.spec.ts`

**Interfaces:**
- Consumes (de tarefas anteriores, exatamente como no contrato):
  - `createPool(connectionString: string): Pool` e `createDb(pool: Pool): NodePgDatabase<Schema>` de `src/db/client.ts` (Tarefa 1)
  - `Db` de `src/db/types.ts` (Tarefa 1)
  - `insertSector(db: Db, name?: string): Promise<{ id: string; name: string }>` e `insertInvite(db: Db, input: Partial<CreateInviteInput> & { usedAt?; cancelledAt?; expiresAt? }): Promise<{ id: string; token: string }>` de `test/fixtures.ts` (Tarefas 1 e 4)
  - `buildInviteUrl(baseURL: string, token: string): string` de `src/features/invites/inviteUrl.ts` (Tarefa 4)
  - `user` de `src/db/schema` (Tarefa 4) e as migrações de `./drizzle` (Tarefas 1 e 4)
  - Telas e textos das Tarefas 8 a 11 (seção "Textos de interface" do contrato) e `GET /api/health` (já existe)
- Produces (para a Tarefa 13 e para specs futuros):
  - script `bun run test:e2e` (= `playwright test`)
  - `e2e/db.ts`: `E2E_DB_PORT = 54329`, `E2E_APP_PORT = 3200`, `E2E_DATABASE_URL: string`, `E2E_BASE_URL: string`, `openE2eDb(): { pool: Pool; db: Db }`, `deactivateUserByEmail(db: Db, email: string, now?: Date): Promise<void>` e reexports `buildInviteUrl`, `insertInvite`, `insertSector`
  - `e2e/virtual-authenticator.ts`: `addVirtualAuthenticator(context: BrowserContext, page: Page): Promise<VirtualAuthenticator>`
  - `e2e/start-db.ts`: processo que sobe PGlite em memória migrado e o serve em `127.0.0.1:54329` (log `pglite-socket pronto …`)

Decisões desta tarefa (verificadas no clone, ver notas de validação):
- `webServer` aceita **array**; os itens sobem **em ordem** e cada um espera o anterior ficar pronto. O banco usa `port` (espera TCP em `127.0.0.1`/`::1`); a doc 1.65 marca `port` como obsoleto, mas `url` exige resposta HTTP e o banco fala o protocolo do Postgres, então `port` é o único jeito. Com array, `use.baseURL` precisa ser explícito.
- O `env` do `webServer` é mesclado a `process.env`, e o Next **não sobrescreve** variável que já existe no ambiente (nem string vazia). Por isso `DATABASE_URL*` apontam para o socket (o E2E nunca toca o Neon) e `GOOGLE_*`/`FACEBOOK_*` = `""` desligam o login social mesmo com credenciais no `.env.local`.
- O app roda com `next start` (`NODE_ENV=production`), então o **rate limit do Better Auth está ligado**: `/sign-in/email` 30 por 60 s e `/sign-up/email` 10 por 60 s por IP (`customRules` da Tarefa 6); os demais `/sign-in*` e `/sign-up*` (social) seguem o padrão do Better Auth, 3 por 10 s. Cada teste chega com um IP próprio (mantém os cenários independentes do limite, como atrás da Vercel) no header `x-forwarded-for` (fixture `clientIp`); sem isso, num bloqueio, a UI mostra "Muitas tentativas nesta rede…" (código `RATE_LIMITED`), não o fallback.
- "Agora não" é `<Link className={buttonVariants()}>` (role link, regra das Global Constraints e da Tarefa 11); o spec usa `getByRole("link", { name: "Agora não" })`. Itens da sidebar também são `link`.
- Com autenticador virtual o autofill (conditional UI) de `/entrar` entra sozinho ao abrir a página e corre contra o clique em "Entrar com passkey" (flaky). O teste de passkey desliga `PublicKeyCredential.isConditionalMediationAvailable` com `addInitScript` para exercitar o botão de forma determinística.

- [ ] **Step 1: Instalar dependências, navegador, script e `.gitignore`**

Run:
```bash
bun add -d @playwright/test@^1.65.1 @electric-sql/pglite-socket@^0.2.20
bunx playwright install chromium
node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.scripts['test:e2e']='playwright test';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n')"
```
Expected: `installed @playwright/test@1.65.1` e `installed @electric-sql/pglite-socket@0.2.20`; o `playwright install` baixa (ou informa que já tem) o Chromium e o headless shell. No CI Linux use `bunx playwright install --with-deps chromium`. O `node -e` é idempotente: se a Tarefa 1 já tiver criado `test:e2e`, nada muda.

Acrescente ao **fim** de `.gitignore` (depois da linha `.playwright-mcp/`):
```gitignore

# playwright
playwright-report/
test-results/
blob-report/
```

- [ ] **Step 2: Write the failing test (specs, helpers e config; sem o servidor do banco)**

Crie `e2e/db.ts`:
```ts
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
```

Crie `e2e/virtual-authenticator.ts`:
```ts
import type { BrowserContext, CDPSession, Page } from "@playwright/test";

export type VirtualAuthenticator = {
  cdp: CDPSession;
  authenticatorId: string;
  credentials: () => Promise<unknown[]>;
  setUserVerified: (isUserVerified: boolean) => Promise<void>;
  remove: () => Promise<void>;
};

/** Só Chromium. Chamar ANTES de a página disparar navigator.credentials.*. */
export async function addVirtualAuthenticator(
  context: BrowserContext,
  page: Page,
): Promise<VirtualAuthenticator> {
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  const { authenticatorId } = await cdp.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    },
  );
  return {
    cdp,
    authenticatorId,
    credentials: async () =>
      (await cdp.send("WebAuthn.getCredentials", { authenticatorId }))
        .credentials,
    setUserVerified: async (isUserVerified) => {
      await cdp.send("WebAuthn.setUserVerified", {
        authenticatorId,
        isUserVerified,
      });
    },
    remove: async () => {
      await cdp.send("WebAuthn.removeVirtualAuthenticator", {
        authenticatorId,
      });
      await cdp.send("WebAuthn.disable");
    },
  };
}
```

Crie `playwright.config.ts`:
```ts
import { defineConfig, devices } from "@playwright/test";

import { E2E_APP_PORT, E2E_DATABASE_URL, E2E_DB_PORT } from "./e2e/db";

const APP_URL = `http://localhost:${E2E_APP_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Um único PGlite serializa tudo: testes em paralelo só se atrapalhariam.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: APP_URL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Em array os servidores sobem em ordem e cada um espera o anterior ficar
  // pronto: primeiro o banco, depois o app (o build já precisa do banco).
  webServer: [
    {
      name: "banco",
      command: "bun e2e/start-db.ts",
      // O banco fala o protocolo do Postgres, não HTTP: só dá para esperar a
      // porta TCP. (`port` consta como obsoleto na doc, mas é o único modo.)
      port: E2E_DB_PORT,
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "pipe",
    },
    {
      name: "app",
      command: "bun run build && bun run start -p 3200",
      url: `${APP_URL}/api/health`,
      reuseExistingServer: false,
      timeout: 300_000,
      stdout: "pipe",
      // O Next não sobrescreve variável que já existe no ambiente, então estas
      // valem mais que o .env.local (que aponta para o Neon de dev).
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        DATABASE_URL_POOLED: E2E_DATABASE_URL,
        BETTER_AUTH_URL: APP_URL,
        BETTER_AUTH_SECRET:
          "e2e-segredo-de-teste-nao-usar-em-producao-0123456789",
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        FACEBOOK_CLIENT_ID: "",
        FACEBOOK_CLIENT_SECRET: "",
      },
    },
  ],
});
```

Crie `e2e/auth.spec.ts`:
```ts
import { randomUUID } from "node:crypto";

import {
  type Browser,
  test as base,
  expect,
  type Page,
} from "@playwright/test";
import type { Pool } from "pg";

import type { Db } from "@/db/types";

import {
  buildInviteUrl,
  deactivateUserByEmail,
  E2E_BASE_URL,
  insertInvite,
  insertSector,
  openE2eDb,
} from "./db";
import { addVirtualAuthenticator } from "./virtual-authenticator";

const PASSWORD = "senha-de-teste-123";

// O app roda em produção (`next start`), então o rate limit do Better Auth
// (cadastro: 10 por 60 s por IP; login por e-mail: 30 por 60 s) está ligado. Os 6
// cenários com cadastro estourariam o limite sem IP próprio: cada teste chega
// com um IP próprio no x-forwarded-for, como chegaria atrás da Vercel.
// A base aleatória evita reaproveitar um IP já contado numa execução anterior.
const ipPrefix = `10.${Math.floor(Math.random() * 200) + 20}.${Math.floor(Math.random() * 250)}`;
let nextClientIp = 1;

const test = base.extend<{ clientIp: string }>({
  // biome-ignore lint/correctness/noEmptyPattern: o Playwright exige o padrão de desestruturação.
  clientIp: async ({}, use) => {
    await use(`${ipPrefix}.${nextClientIp++}`);
  },
  extraHTTPHeaders: async ({ clientIp }, use) => {
    await use({ "x-forwarded-for": clientIp });
  },
});

function visitor(browser: Browser, clientIp: string) {
  return browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": clientIp },
  });
}

let pool: Pool;
let db: Db;

test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});

test.afterAll(async () => {
  await pool.end();
});

// Cada teste cria os próprios dados: e-mail único, nome fictício.
function uniqueEmail(): string {
  return `e2e-${randomUUID()}@example.com`;
}

async function signUpWithInviteToken(
  page: Page,
  token: string,
  person: { name: string; email: string },
) {
  await page.goto(buildInviteUrl(E2E_BASE_URL, token));
  await expect(
    page.getByRole("heading", { name: "Você foi convidado" }),
  ).toBeVisible();
  await page.getByLabel("Nome").fill(person.name);
  await page.getByLabel("E-mail").fill(person.email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/bem-vindo$/);
  await expect(
    page.getByRole("heading", { name: "Conta criada" }),
  ).toBeVisible();
}

async function registerAdmin(page: Page, name: string, email: string) {
  const { token } = await insertInvite(db, { role: "admin" });
  await signUpWithInviteToken(page, token, { name, email });
  return { token };
}

async function signInWithPassword(page: Page, email: string, password: string) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

test("sem sessão, / redireciona para /entrar", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(
    page.getByRole("heading", { name: "Entrar no Closery" }),
  ).toBeVisible();
  await expect(page.getByText("O acesso é só por convite.")).toBeVisible();
});

test("convite de admin: cadastro por e-mail e senha, Início e Administração", async ({
  page,
}) => {
  await registerAdmin(page, "Ana Teste", uniqueEmail());

  await page.getByRole("link", { name: "Agora não" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Olá, Ana" })).toBeVisible();
  await expect(
    page.getByText("Em breve: passagem de turno, solicitações e dashboard."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Administração" })).toBeVisible();
});

test("convite já usado mostra que não está mais disponível", async ({
  page,
  browser,
  clientIp,
}) => {
  const { token } = await registerAdmin(page, "Bruno Teste", uniqueEmail());

  const other = await visitor(browser, clientIp);
  const otherPage = await other.newPage();
  await otherPage.goto(buildInviteUrl(E2E_BASE_URL, token));

  await expect(
    otherPage.getByRole("heading", { name: "Convite indisponível" }),
  ).toBeVisible();
  await expect(otherPage.getByText("Este convite já foi usado.")).toBeVisible();
  await expect(
    otherPage.getByText("Peça um novo convite a quem te convidou."),
  ).toBeVisible();
  await other.close();
});

test("login com senha errada mostra a mensagem em português", async ({
  page,
  browser,
  clientIp,
}) => {
  const email = uniqueEmail();
  await registerAdmin(page, "Carla Teste", email);

  const other = await visitor(browser, clientIp);
  const otherPage = await other.newPage();
  await signInWithPassword(otherPage, email, "senha-errada-999");

  await expect(
    otherPage.getByText("E-mail ou senha incorretos."),
  ).toBeVisible();
  await expect(otherPage).toHaveURL(/\/entrar$/);
  await other.close();
});

test("operador cadastra, não vê Administração e /admin responde página não encontrada", async ({
  page,
}) => {
  const sector = await insertSector(db);
  const { token } = await insertInvite(db, {
    role: "operator",
    sectorId: sector.id,
  });
  await signUpWithInviteToken(page, token, {
    name: "Davi Teste",
    email: uniqueEmail(),
  });

  await page.getByRole("link", { name: "Agora não" }).click();
  await expect(page.getByRole("heading", { name: "Olá, Davi" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Conta" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Administração" })).toHaveCount(
    0,
  );

  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Página não encontrada" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Administração" }),
  ).toHaveCount(0);
  // O <title> também não pode revelar a rota (T12: /admin não exporta metadata).
  await expect(page).not.toHaveTitle(/Administração/);
});

test("passkey: criar em /conta, sair e entrar com a passkey", async ({
  page,
  context,
}) => {
  // Com um autenticador virtual, o preenchimento automático (conditional UI) de
  // /entrar entra sozinho assim que a página abre e corre contra o clique. Aqui
  // queremos exercitar o botão, então o navegador "não oferece" o autofill.
  await context.addInitScript(() => {
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isConditionalMediationAvailable = async () => false;
    }
  });
  const authenticator = await addVirtualAuthenticator(context, page);
  await registerAdmin(page, "Elisa Teste", uniqueEmail());
  await page.getByRole("link", { name: "Agora não" }).click();
  await expect(page.getByRole("heading", { name: "Olá, Elisa" })).toBeVisible();

  await page.getByRole("link", { name: "Conta" }).click();
  await expect(page.getByRole("heading", { name: "Conta" })).toBeVisible();
  await expect(page.getByText("Nenhuma passkey ainda.")).toBeVisible();

  await page.getByRole("button", { name: "Criar passkey" }).click();
  await expect(
    page.getByRole("button", { name: "Remover passkey" }),
  ).toBeVisible();
  await expect(page.getByText("Nenhuma passkey ainda.")).toHaveCount(0);
  expect(await authenticator.credentials()).toHaveLength(1);

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/entrar$/);

  await page.getByRole("button", { name: "Entrar com passkey" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Olá, Elisa" })).toBeVisible();

  await authenticator.remove();
});

test("usuário desativado não entra", async ({ page, browser, clientIp }) => {
  const email = uniqueEmail();
  await registerAdmin(page, "Fábio Teste", email);

  await deactivateUserByEmail(db, email);

  // A sessão que já existia também deixa de valer na hora (sem cookieCache).
  await page.goto("/");
  await expect(page).toHaveURL(/\/entrar$/);

  const other = await visitor(browser, clientIp);
  const otherPage = await other.newPage();
  await signInWithPassword(otherPage, email, PASSWORD);
  await expect(
    otherPage.getByText("Esta conta foi desativada. Fale com o administrador."),
  ).toBeVisible();
  await expect(otherPage).toHaveURL(/\/entrar$/);
  await other.close();
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test:e2e`
Expected: FAIL em poucos segundos, antes de qualquer teste rodar:
```
[banco] error: Module not found "e2e/start-db.ts"
Error: Process from config.webServer was not able to start. Exit code: 1
```
(o banco do E2E ainda não existe).

- [ ] **Step 4: Write minimal implementation (banco efêmero do E2E)**

Crie `e2e/start-db.ts`:
```ts
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

// Mesma porta de e2e/db.ts (não importamos de lá para este processo não
// carregar o driver `pg` à toa).
const PORT = 54329;

// Banco efêmero: PGlite em memória, com as migrações reais de ./drizzle.
const client = new PGlite();
await migrate(drizzle(client), { migrationsFolder: "./drizzle" });

// O Pool do app tem max 10 e o teste abre conexões próprias; com o padrão
// (maxConnections: 1) a segunda conexão é derrubada.
const server = new PGLiteSocketServer({
  db: client,
  host: "127.0.0.1",
  port: PORT,
  maxConnections: 20,
});
await server.start();
console.log("pglite-socket pronto", server.getServerConn());

async function shutdown() {
  await server.stop();
  await client.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test:e2e`
Expected: PASS. Saída (trecho):
```
[banco] pglite-socket pronto 127.0.0.1:54329
[app] $ next build
...
Running 7 tests using 1 worker
  ✓  1 [chromium] › e2e\auth.spec.ts › sem sessão, / redireciona para /entrar
  ✓  2 [chromium] › e2e\auth.spec.ts › convite de admin: cadastro por e-mail e senha, Início e Administração
  ✓  3 [chromium] › e2e\auth.spec.ts › convite já usado mostra que não está mais disponível
  ✓  4 [chromium] › e2e\auth.spec.ts › login com senha errada mostra a mensagem em português
  ✓  5 [chromium] › e2e\auth.spec.ts › operador cadastra, não vê Administração e /admin responde página não encontrada
  ✓  6 [chromium] › e2e\auth.spec.ts › passkey: criar em /conta, sair e entrar com a passkey
  ✓  7 [chromium] › e2e\auth.spec.ts › usuário desativado não entra
  7 passed
```
**Tempo esperado (build incluído):** cerca de 40 a 55 s com o cache do Turbopack aquecido; 3 a 4 min na primeira execução (build frio + download do navegador já feito no Step 1). Os testes em si levam 2 a 3 s cada. Ao terminar, as portas 3200 e 54329 ficam livres (`netstat -ano | grep -E ":(3200|54329) .*LISTEN"` não devolve nada). Se uma execução anterior travou e deixou processo escutando, o Playwright falha com `... is already used` (`reuseExistingServer: false` é de propósito: nunca testar contra um servidor que não subimos); encerre o processo e rode de novo.

- [ ] **Step 6: Provar que o env do `webServer` vence o `.env.local` (e que o E2E não toca o Neon)**

Crie o arquivo temporário `.env.production.local` (o Next o carrega no `next build`/`next start` e ele **não** é o seu `.env.local`; `.env*` já está no `.gitignore`), com valores que quebrariam o teste se valessem:
```bash
printf 'DATABASE_URL=postgres://bad:bad@127.0.0.1:1/bad\nDATABASE_URL_POOLED=postgres://bad:bad@127.0.0.1:1/bad\nBETTER_AUTH_URL=http://localhost:9999\nBETTER_AUTH_SECRET=outro-segredo-que-nao-deve-valer-0123456789abcdef\nGOOGLE_CLIENT_ID=x\nGOOGLE_CLIENT_SECRET=y\n' > .env.production.local
bun run test:e2e
rm .env.production.local
```
Expected: `7 passed` do mesmo jeito (banco inexistente, URL e secret errados e Google "configurado" no arquivo não têm efeito). Se algum teste falhar aqui, o `env` do `webServer` não está cobrindo uma variável: corrija em `playwright.config.ts` antes de seguir. Confirme que o arquivo temporário sumiu: `git status --short | grep -i env` não devolve nada.

- [ ] **Step 7: Formatar e rodar as verificações da tarefa**

Run: `bunx biome check --write e2e playwright.config.ts && bun run check-types && bun run lint && bun run test`
Expected: `Checked N files … No fixes applied.` (ou `Fixed 1 file` na primeira passada), `check-types` sem saída de erro, `lint` limpo e a suíte do Vitest verde (o E2E não faz parte de `bun run test`: o Vitest só inclui `src/**` e `test/**`).

- [ ] **Step 8: Commit**
```bash
git add package.json bun.lock .gitignore playwright.config.ts e2e
git commit -F - <<'EOF'
test(e2e): Playwright com banco efêmero e fluxos de acesso

Sobe PGlite em memória migrado e servido por pglite-socket (porta 54329) e
o app com next build + next start (porta 3200); os dois entram no webServer
em ordem. Sete cenários: redirecionamento sem sessão, cadastro por convite,
convite já usado, senha errada, operador sem Administração (404 em /admin),
passkey com autenticador virtual e usuário desativado. Cada teste usa dados
e IP próprios por causa do rate limit do Better Auth.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```

---

### Task 13: Documentação de contexto e verificação final

**Files:**
- Modify: `.context/architecture.md` (§2 stack; §4 estrutura; §6 tabelas; §7 detalhes implementados; §9 rotas; §10 log)
- Modify: `.context/library-docs.md` (§4 overrides do Biome e LF; §5 caminho do schema; §7 Zod; seções novas §8, §9, §10)
- Modify: `.context/code-standards.md` (§7 Testes: comandos reais)
- Modify: `AGENTS.md` (seção curta "Comandos")
- Modify: `.context/progress-tracker.md` (Próximo passo; Fase 0 ✅; Fase 1 ✅; Histórico)
- Modify: `.context/pendencias.md` (próximo id; índice; P10; atualizações de P6, P7, P8)
- Modify: `memory.md` (handoff, arquivo inteiro)
- Modify (somente se faltar algo): `.context/ui-registry.md`
- Test: verificação por `grep` (Steps 1 e 11) e o gate completo (Step 12: check-types, lint, test, test:e2e, build)

**Interfaces:**
- Consumes: tudo das Tarefas 1 a 12 (nomes, rotas, textos e comandos do contrato). Os arquivos de `.context/` seguem os formatos existentes (estados da `pendencias.md`, legenda do `progress-tracker.md`).
- Produces: documentação alinhada ao código; `Próximo passo` = plano da Fase 2; próximo id de pendência = P11.

Datas abaixo estão como `2026-11-20` (dia da spec e do plano); se a execução cair em outro dia, troque a data em todos os trechos desta tarefa.

- [ ] **Step 1: Write the failing test (a documentação ainda não menciona a Fase 0+1)**

Run:
```bash
grep -cF "pglite-socket" .context/architecture.md .context/library-docs.md .context/code-standards.md AGENTS.md memory.md
grep -cF "| P10 | Credenciais OAuth do Google" .context/pendencias.md
grep -cF "## Fase 1 — Acesso · ✅" .context/progress-tracker.md
grep -cF "Fase 0 + Fase 1: fundação de testes e acesso" .context/architecture.md
```
Expected: FAIL (todas as contagens `0`), por exemplo `.context/architecture.md:0`, `.context/library-docs.md:0`, `.context/code-standards.md:0`, `AGENTS.md:0`, `memory.md:0`, `0`, `0`, `0`.

- [ ] **Step 2: `.context/architecture.md` §2 (stack)**

Em `## 2. Stack`, substitua as três linhas abaixo (texto atual exato):
```
| Validação | Zod — *a instalar com o primeiro formulário* | — |
| Testes | Vitest + Testing Library; Playwright para E2E — *a instalar na Fase 0* | — |
| Auth | *🟡 decidir no brainstorm* | — |
```
por:
```
| Validação | **Zod 4** (env de acesso, contratos das Server Actions) | 4.x |
| Testes (unidade, integração, componente) | **Vitest** (projects `node` e `dom`) + jsdom + Testing Library + **PGlite** (Postgres em processo, com as migrações reais) | Vitest 5.1.1 · jsdom 28 (sem `matchMedia`: polyfill em `test/setup-dom.ts`) · Testing Library react 16.3 · PGlite 0.5.17 |
| Testes E2E | **Playwright** (Chromium) + PGlite servido por **pglite-socket** | Playwright 1.65.1 · pglite-socket 0.2.20 |
| Auth | **Better Auth** (adapter Drizzle) + plugin **passkey** | better-auth 1.7.27 · @better-auth/passkey 1.7.27 |
```

- [ ] **Step 3: `.context/architecture.md` §4 (estrutura), §6 (tabelas) e §7 (implementação)**

§4: dentro do bloco de código de `## 4. Estrutura de pastas`, substitua
```
  db/
    index.ts              conexão Drizzle + Neon (server-only)
    schema.ts             tabelas (quebrar em schema/ quando crescer)
  lib/                    utilitários puros (camelCase)
drizzle/                  migrações SQL geradas (versionadas)
```
por
````
  db/
    index.ts              singleton do pool + db (server-only)
    client.ts             createPool/createDb (sem server-only: scripts e E2E)
    types.ts              Db (tipo comum a pg e PGlite)
    schema/               tabelas por área (sectors, auth, invites) + index.ts
  lib/                    utilitários puros (camelCase)
    auth/                 Better Auth: createAuth, env, erros, cliente, sessão
drizzle/                  migrações SQL geradas (versionadas)
test/                     helpers do Vitest (PGlite, fixtures, auth de teste)
e2e/                      Playwright (banco efêmero, autenticador virtual, specs)
scripts/                  scripts do desenvolvedor (admin:invite)
````

§6: troque o título `## 6. Modelo de dados · 🟡 a fechar na spec (decisões em `build-plan.md §5`)` por `## 6. Modelo de dados · 🟡 em construção (acesso e convite ✅ na Fase 1)` e, logo depois do parágrafo (a última linha dele é `(D6–D8), e as tabelas do Better Auth + **convite** (D2–D4). Sem fotos (D10).`), acrescente:
```

**Tabelas criadas até a Fase 1** (migrações versionadas em `drizzle/`):

| Tabela | O que guarda | Chave |
|---|---|---|
| `sector` | setor: nome único, `active` | `uuid` |
| `user` | pessoa (Better Auth) + `role` (`admin`/`operator`), `sector_id` (FK `sector`, `restrict`), `deactivated_at`; check `user_operator_needs_sector` (operador exige setor) | `text` |
| `session`, `account`, `verification`, `passkey`, `rate_limit` | tabelas do Better Auth, cópia fiel da CLI 1.7.27 | `text` |
| `invite` | convite: `token_hash` único, `role`, `sector_id`, `invitee_label`, `invited_by`, `expires_at`, `used_at`, `used_by`, `cancelled_at`; check `invite_operator_needs_sector` | `uuid` |

As tabelas do Better Auth usam `timestamp` sem fuso (é o que a CLI gera); as do domínio (`sector`, `invite`) usam `timestamptz`. As demais entidades acima chegam nas Fases 2 a 4.
```

§7: troque o título `## 7. Autenticação e autorização · 🟢 métodos definidos (D2) / 🟡 convite e papéis em aberto` por `## 7. Autenticação e autorização · 🟢 implementado na Fase 1 (Apple na Fase 6)` e, depois da última linha da seção (`  setores e itens. Usuário desativado não loga, mas continua referenciado pelas passagens.`), acrescente:
```

### Como ficou implementado (Fase 1)

- **Fábrica única.** `createAuth(db, env)` (`src/lib/auth/createAuth.ts`) monta o Better Auth; o app (`src/lib/auth/index.ts`, `server-only`), os testes (`test/auth.ts`) e o E2E usam a mesma fábrica. O env passa por `parseAuthEnv` (Zod): `BETTER_AUTH_SECRET` (mínimo 32 caracteres) e `BETTER_AUTH_URL` são obrigatórios e **o `next build` falha sem eles**; Google e Facebook só ligam com `*_CLIENT_ID` + `*_CLIENT_SECRET` (os dois ou nenhum).
- **Ids.** As tabelas do Better Auth usam `text` (32 caracteres gerados pela lib); as do domínio usam `uuid`. `user.sector_id` é `uuid` com FK para `sector`, por isso o schema de auth é escrito à mão em `src/db/schema/auth.ts` (copiando a saída da CLI `auth generate` 1.7.27) e um teste guarda, com `getAuthTables`, prova que ele bate com o que a lib espera.
- **Consumo do convite.** No `databaseHooks.user.create.before`: `UPDATE invite SET used_at … WHERE token_hash = … AND used_at IS NULL AND cancelled_at IS NULL AND expires_at > now RETURNING role, sector_id` (atômico no banco). O hook injeta `role`, `sector_id` e `emailVerified: true`; `user.create.after` grava `used_by`. O cadastro por e-mail checa e-mail repetido **antes** do hook, então e-mail já cadastrado não gasta convite. Sem `ctx` (fora de uma requisição) o hook recusa (fail-closed). Todo erro de hook é `APIError` com `code` (`SIGNUP_INVITE_ONLY`, `ACCOUNT_DEACTIVATED`).
- **Cookie `closery_invite`.** Token bruto, `httpOnly`, `SameSite=Lax` (volta no callback OAuth), `Secure` em produção, `path=/`, 1 h. Só a Server Action `armInvite` grava; a página `/convite/[token]` apenas lê (prefetch e scanner de link não gastam convite). A rota responde com `Referrer-Policy: no-referrer`.
- **Sem `cookieCache`.** A sessão é lida do banco a cada requisição (`getAuthz`, com `cache()` do React) para que desativação e mudança de papel ou setor valham na hora; `session.create.before` barra usuário desativado em e-mail, social e passkey. Sem `nextCookies()`: cadastro e login vão pelo `authClient` (HTTP), onde o rate limit atua.
- **Rate limit** do Better Auth com `storage: "database"` (tabela `rate_limit`): rate limit ligado só em produção: `/sign-in/email` 30 por 60 s e `/sign-up/email` 10 por 60 s (`customRules` da `createAuth`); os demais `/sign-in*` e `/sign-up*` (social) seguem o padrão do Better Auth, 3 por 10 s; os endpoints de passkey ficam em `/passkey/*` e caem no padrão geral de 100 por 10 s. A janela conta a partir da **última** requisição permitida. IP: sem `trustedProxies`, o Better Auth só confia em `x-forwarded-for` quando ele tem um único valor; com vários valores todos caem num balde compartilhado por caminho (`no-trusted-ip|<path>`); na Vercel o cabeçalho tem um valor só. No bloqueio (429) a tela mostra `Muitas tentativas nesta rede. Espere um minuto e tente de novo.`
- **Autorização.** `toAuthz` (puro) produz `Authz`; `requireUser()` redireciona para `/entrar`; `requireAdmin()` chama `notFound()` para operador, que vê "Página não encontrada" (com streaming o status HTTP é 200 e o HTML traz `noindex`; `/admin` não exporta `metadata`, para o `<title>` não revelar a rota); `scopeToSector(authz, coluna)` escopa as queries por setor. `src/proxy.ts` só faz o redirecionamento otimista pelo cookie; a regra real vive no servidor.
- **Passkey.** `rpID` e origem vêm de `BETTER_AUTH_URL` (passkey de `localhost` não vale em produção); criada em `/bem-vindo` ou `/conta` (exige sessão recente); login pelo autofill do campo de e-mail e pelo botão "Entrar com passkey".
- **Primeiro administrador.** `bun run admin:invite` (`scripts/adminInvite.ts`) gera o link do convite de administrador.
- **Vínculo de contas desligado.** `account.accountLinking.disableImplicitLinking: true`: o convite marca o e-mail como verificado, e vincular login social pelo e-mail abriria tomada de conta. Quem criou conta por e-mail e tenta Google recebe `account_not_linked` ("Entre como da primeira vez").
- **Erros do WebAuthn.** O cliente de passkey repassa o código do `@simplewebauthn/browser` (fechar o diálogo = `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`); `passkeyErrorCode` (`src/components/auth/passkeyErrorCode.ts`) traduz para `AUTH_CANCELLED`/`REGISTRATION_CANCELLED`/`PREVIOUSLY_REGISTERED` antes do mapa de mensagens.
```

- [ ] **Step 4: `.context/architecture.md` §9 (rotas) e §10 (log)**

§9: substitua a linha
```
| `/` | placeholder | ✅ scaffold |
```
por
```
| `/entrar` | login: e-mail e senha, passkey (autofill e botão), Google/Facebook se habilitados. Pública | ✅ Fase 1 |
| `/convite/[token]` | convite (válido, expirado, usado, cancelado, inexistente) + cadastro; `armInvite` grava o cookie. Pública | ✅ Fase 1 |
| `/bem-vindo` | oferta de passkey logo depois do cadastro | ✅ Fase 1 |
| `/` | Início: saudação (a passagem de turno entra na Fase 3) | ✅ Fase 1 |
| `/conta` | passkeys (criar e remover) e "Sair" | ✅ Fase 1 |
| `/admin` | Administração (placeholder até a Fase 2); operador vê "Página não encontrada" | ✅ Fase 1 |
| `/api/auth/[...all]` | handler do Better Auth. Pública | ✅ Fase 1 |
```
(mantenha a linha de `/api/health` logo abaixo) e, imediatamente antes de `## 10. Log de evolução (ADR leve)`, insira:
```
Rotas públicas: `/entrar`, `/convite/[token]`, `/api/auth/*` e `/api/health`. Todo o resto exige sessão (`src/proxy.ts` + `requireUser()`).

```

§10: acrescente **no fim do arquivo** (depois do último parágrafo do log, `Verificado de novo: …`):
```

### 2026-11-20 — Fase 0 + Fase 1: fundação de testes e acesso

- **Decisão:** Vitest 5 com dois projects (`node` para domínio e servidor, `dom` para componentes) e PGlite com as migrações reais (dump migrado uma vez por execução); Playwright com o app em `next build` + `next start` sobre PGlite servido por pglite-socket. Better Auth 1.7.27 com cadastro só por convite (cookie `closery_invite` + hook `user.create.before` que consome o convite com `UPDATE … RETURNING`), e-mail e senha, passkey e Google/Facebook condicionais ao env; papéis `admin`/`operator` escopados por setor no servidor.
- **Por quê:** o domínio recebe `db` por parâmetro, então os mesmos testes valem com PGlite e com `pg`; o convite consumido no banco é atômico e não depende de estado da aplicação; ler a sessão fresca do banco faz a desativação valer na hora (spec §4.1).
- **Trade-offs aceitos:** (1) PGlite tem uma conexão só e serializa tudo, então os testes provam lógica, SQL e constraints, **não** corrida; a atomicidade vem do `UPDATE … RETURNING` e é revisada na forma da query. (2) Sem `cookieCache`: uma ida ao banco por requisição em troca de desativação imediata. (3) O E2E compila e sobe o app de produção (cerca de 1 min), por isso o rate limit está ligado (cadastro: 5 por 60 s por IP) e cada teste usa um IP próprio. (4) Apple fica para a Fase 6 (P6); Google sem credenciais (P10), então o login social não tem teste ao vivo (checklist manual da spec §12).
- **Desvios e detalhes registrados:** (a) `/entrar` mostra o formulário de e-mail primeiro, e não a passkey como na spec §4.3: o autofill de passkey vive no campo de e-mail, então a passkey continua sendo a primeira oferta. (b) As tabelas do Better Auth usam `timestamp` sem fuso (fiel à CLI); o Drizzle grava `toISOString()` e lê como UTC, então não há deslocamento por fuso do processo. (c) `/admin` para operador responde 200 com "Página não encontrada" (streaming), não 404 de status. (d) `Db = PgDatabase<PgQueryResultHKT, Schema>`: a união `NodePgDatabase | PgliteDatabase` quebra `.returning({ … })`. (e) jsdom 28 (o 31 exige Node ≥ 22.22.2) e `package.json` com `"type": "module"`. (f) `check-types` = `next typegen && tsc --noEmit` e `.gitattributes` com LF.
- **Verificado:** `check-types`, `lint`, `test`, `test:e2e` (7 passed) e `build` verdes.
```

- [ ] **Step 5: `.context/library-docs.md`**

(a) No §5 (Drizzle), substitua a linha
```
  `src/db/schema.ts` (passado ao `drizzle()` para a query relacional).
```
por
```
  `src/db/schema/` (um arquivo por área, reexportado por `index.ts`; passado ao `drizzle()` para a query relacional). O domínio recebe `db: Db` por parâmetro (`src/db/types.ts`); só `src/db/index.ts` importa `server-only` (scripts e E2E usam `src/db/client.ts`).
```

(b) Substitua o título `## 7. Zod · a instalar com o primeiro formulário` por `## 7. Zod 4 · instalado na Fase 1` e, depois do bullet `- O **mesmo** schema valida no servidor e dá feedback no client.`, acrescente:
```
- Em uso: `parseAuthEnv` (`src/lib/auth/env.ts`). API do Zod 4: `z.url()` (não `z.string().url()`) e mensagem por `{ error: "…" }`.
```

(b2) No §4 (Biome), depois do bullet que termina em `arquivos e não segue a formatação do projeto.`, acrescente:
```
- `biome.json` tem `overrides` que desligam 7 regras (`noDocumentCookie`, `noDoubleEquals`,
  `noArrayIndexKey`, `useSemanticElements`, `useKeyWithClickEvents`, `noLabelWithoutControl`,
  `useExhaustiveDependencies`) **só** em `src/components/ui/**` e `src/hooks/use-mobile.ts`
  (código gerado pelo shadcn). Depois de `bunx shadcn add`, rode `bun run format && bunx biome check --write`.
  O `sonner.tsx` gerado tem dois `as` (`ToasterProps["theme"]`, `React.CSSProperties`): é código
  gerado, fica como está.
- `.gitattributes` força LF (`* text=auto eol=lf`): o Git desta máquina tem `core.autocrlf=true`
  e CRLF reprova o `biome check`.
```

(c) Antes de `## Como adicionar uma biblioteca nova`, insira as três seções:
```
## 8. Better Auth 1.7 + passkey

> A doc atual é https://www.better-auth.com/docs e o código em `node_modules/better-auth/dist`. A CLI atual é o pacote `auth` (`bunx auth …`), **não** `@better-auth/cli` (defasado). Versão fixada em `1.7.27` junto com `@better-auth/passkey` e `@better-auth/core`.

- **Fábrica, não singleton (T1).** `createAuth(db, env)` recebe o banco; o singleton `auth` de `src/lib/auth/index.ts` só existe no app. Teste e E2E usam a fábrica.
- **Schema à mão + guarda (T3).** `src/db/schema/auth.ts` copia a saída da CLI, trocando `user.sector_id` por `uuid` com FK. A CLI não consegue importar a config (cadeia `server-only` + schema), então o teste guarda com `getAuthTables` compara o schema com o que a lib espera: ao atualizar o Better Auth, rode a CLI numa pasta à parte, compare e ajuste o arquivo.
- **Convite no `user.create.before` (T4, T5).** Consome o convite lido do cookie e injeta `role`, `sectorId` e `emailVerified`; o `after` grava `used_by`. Sem `ctx` o hook recusa. Cadastro por e-mail já existente falha **antes** do hook e não gasta convite (há teste).
- **Adapter sem `transaction` (T6).** Ligado, o hook consultaria fora da transação e o PGlite (uma conexão) travaria.
- **`APIError` com `code`.** Em hook, todo `throw` é `APIError` de `better-auth/api` com `code`; `Error` comum vira 500 sem corpo, e no callback OAuth só `APIError` com `code` vira redirect `?error=<code>`. Na tela, **nunca** renderize `error_description` (texto do servidor na URL): use só `authErrorMessage(code)` (mapa `AUTH_ERROR_MESSAGES`, com fallback).
- **Sem `cookieCache` e sem `nextCookies()` (T7).** Desativação vale na hora. Cadastro, login e passkey vão pelo `authClient` (HTTP, onde o rate limit atua); nenhum `auth.api.sign*` roda em Server Action.
- **Rate limit (T8).** `storage: "database"` (tabela `rate_limit`); rate limit ligado só em produção: `/sign-in/email` 30 por 60 s e `/sign-up/email` 10 por 60 s (`customRules` da `createAuth`); os demais `/sign-in*` e `/sign-up*` (social) seguem o padrão do Better Auth, 3 por 10 s; os endpoints de passkey ficam em `/passkey/*` e caem no padrão geral de 100 por 10 s. A janela conta a partir da **última** requisição permitida. IP: sem `trustedProxies`, o Better Auth só confia em `x-forwarded-for` quando ele tem um único valor; com vários valores todos caem num balde compartilhado por caminho (`no-trusted-ip|<path>`); na Vercel o cabeçalho tem um valor só. No bloqueio (429) a tela mostra `Muitas tentativas nesta rede. Espere um minuto e tente de novo.` Atua só no router HTTP (`/api/auth/*`), nunca em `auth.api.*` chamado direto. Uma `customRules` com a mesma path sobrescreve a regra especial padrão.
- **Vínculo implícito desligado (T13).** `account.accountLinking.disableImplicitLinking: true`; o código `account_not_linked` está no mapa de mensagens.
- **Códigos do WebAuthn (T14).** `signIn.passkey` e `addPasskey` devolvem o código cru do `@simplewebauthn/browser` quando a cerimônia falha no navegador; traduza com `passkeyErrorCode(code, "authenticate" | "register")` antes de `authFormError`. Não acrescente esses códigos ao `AUTH_ERROR_MESSAGES` (os testes da Tarefa 6 comparam as chaves por igualdade).
- **Social (T9).** `disableImplicitSignUp: true`. Em `/entrar` use `requestSignUp: false` (sem conta: `?error=signup_disabled`); no convite use `requestSignUp: true` com o cookie já gravado. Facebook sem e-mail volta `email_not_found`. Apple só na Fase 6 (P6).
- **Cookie do convite (T10).** `closery_invite`, `httpOnly`, `SameSite=Lax` (Strict não volta no callback OAuth), `Secure` em produção, `path=/`, 1 h; gravado por `armInvite`, nunca por página.
- **Campos adicionais** (`role`, `sectorId`, `deactivatedAt`) com `input: false`: o valor enviado pelo cliente é descartado (ou dá 400); só o hook define `role` e `sectorId`.
- **Sessão no servidor.** `getAuthz()` (`cache()` do React) dentro de `<Suspense>` (Cache Components); nunca em função `"use cache"`; Server Component não grava cookie.
- **Passkey.** `addPasskey` exige sessão recente (`SESSION_NOT_FRESH`); `rpID` e origem derivam de `BETTER_AUTH_URL`; passkey de `localhost` não vale em produção e o domínio de preview da Vercel é outro. Login: `autoComplete="username webauthn"` + `signIn.passkey({ autoFill: true })` e o botão.
- **Env.** `BETTER_AUTH_SECRET` (≥ 32 caracteres) e `BETTER_AUTH_URL` precisam existir também no build e na Vercel.

## 9. Vitest + PGlite + Testing Library

- **Comandos:** `bun run test` (= `vitest run`) e `bun run test:watch`. **Nunca `bun test`** (é o runner do Bun). Node ≥ 22.12 (exigência do Vitest 5).
- **`vitest.config.ts`** usa `test.projects`: `node` (`src/**/*.test.ts`, `test/**/*.test.ts`, globalSetup) e `dom` (`src/**/*.test.tsx`, jsdom, setup do Testing Library). `resolve.tsconfigPaths: true` resolve `@/*` (sem `vite-tsconfig-paths`) e não há `@vitejs/plugin-react`. Filtrar: `bunx vitest run --project node`.
- **`server-only`** é trocado por `test/empty.ts` com `test.alias` (caminho absoluto via `fileURLToPath`; `URL.pathname` gera `/C:/…` no Windows).
- **Dump migrado.** `test/global-setup.ts` migra `./drizzle` uma vez e grava `node_modules/.cache/closery-test/migrated.tar`; `createTestDb()` carrega o dump (~1,4 s contra 3 a 6 s de `initdb` + migrate) e é regerado a cada execução. Um PGlite por arquivo de teste (`beforeAll`/`afterAll`).
- **`resetDb(client)`** apaga as linhas de `TABLES` com `session_replication_role = replica`; o teste `test/db.test.ts` compara `TABLES` com `pg_tables`: tabela nova no schema exige atualizar `TABLES`.
- **PGlite não prova concorrência.** É uma conexão só e serializa tudo: `Promise.all` de dois consumos passa até com `SELECT` + `UPDATE` não atômico. Escreva a atomicidade no SQL (um `UPDATE … RETURNING`), teste a invariante em sequência (o segundo consumo devolve 0 linhas) e revise a forma da query; corrida real só contra um Postgres de verdade (branch do Neon), registrada como limite aceito.
- **Injeção de `db`** é o padrão; `vi.mock("@/db", async () => …createTestDb)` (factory assíncrona, `vi.mock` é içado) só para a camada fina (actions e route handlers).
- **Componentes:** `@testing-library/react` + `user-event` + `@testing-library/jest-dom/vitest`, com `cleanup()` no `afterEach` (sem `globals`). Página assíncrona não renderiza no Vitest; folha assíncrona pode ser testada com `render(await Componente())` e sessão mockada; a composição fica no Playwright.
- **jsdom 28** (o 31 exige Node ≥ 22.22.2). jsdom não tem `window.matchMedia`, que o `useIsMobile` do sidebar chama: `test/setup-dom.ts` faz o polyfill (desktop por padrão). O `hover` do user-event não abre o Tooltip do Base UI: use `fireEvent.pointerEnter` + `mouseEnter`.
- **Auth em teste:** `createTestAuth(db)` e `signUpWithInvite(auth, token, …)` (o convite vai no header `cookie: closery_invite=…`). O rate limit não afeta `auth.api.*`.

## 10. Playwright + pglite-socket

- **Comando:** `bun run test:e2e` (= `playwright test`); Chromium (`bunx playwright install chromium`; no CI Linux, `--with-deps`).
- **`playwright.config.ts`:** `webServer` em **array** e em ordem: (1) `bun e2e/start-db.ts` com `port: 54329` (espera TCP; `port` consta como obsoleto na doc, mas o banco não fala HTTP), `reuseExistingServer: false`; (2) `bun run build && bun run start -p 3200` com `url` em `/api/health`, timeout de 300 s. `use.baseURL` explícito (obrigatório com array) e `workers: 1` (um PGlite serializa tudo).
- **Env do `webServer`** é mesclado a `process.env` e o Next não sobrescreve variável já definida (nem string vazia): `DATABASE_URL` e `DATABASE_URL_POOLED` apontam para o socket (o E2E nunca toca o Neon) e `GOOGLE_*`/`FACEBOOK_*` = `""` desligam o social mesmo com credenciais no `.env.local`.
- **pglite-socket:** `maxConnections` precisa ser maior que o `max` do Pool do app (10) mais as conexões do teste (usamos 20); com o padrão (1), a segunda conexão cai com `Connection terminated unexpectedly`. Banco em memória, descartado a cada execução.
- **Produção no E2E.** O app roda com `next start` (`NODE_ENV=production`), então o rate limit está ligado (cadastro por e-mail: 10 por 60 s por IP; a suíte faz 6 cadastros): cada teste manda `x-forwarded-for` próprio (fixture `clientIp`).
- **Passkey:** autenticador virtual via CDP (`e2e/virtual-authenticator.ts`), só Chromium, criado **antes** do clique que dispara o WebAuthn. Com ele o autofill de `/entrar` entra sozinho ao abrir a página; o teste do botão desliga `isConditionalMediationAvailable` com `addInitScript`.
- **Base UI:** navegação com cara de botão é `<Link className={buttonVariants()}>` (role link); `Button render={<Link />}` daria role=button e não é usado para navegação. No spec: `getByRole("link")` para "Agora não" e para os itens da sidebar.
- **`/admin` do operador:** confira o texto "Página não encontrada" e o `<title>`, nunca o status (com streaming é 200).
- Cada teste cria os próprios dados (e-mail único, nomes fictícios). Login social ao vivo é checklist manual.
- Duração: cerca de 1 min com o cache do Turbopack; 3 a 4 min na primeira vez.

```

- [ ] **Step 6: `.context/code-standards.md` §7 e `AGENTS.md`**

`code-standards.md` §7: substitua os três bullets
```
- **Vitest** — lógica de domínio, schemas, queries de agregação, Server Actions.
- **Vitest + Testing Library** — componentes (comportamento e estados, não implementação).
- **Playwright** — E2E dos fluxos críticos: entregar um turno, receber/confirmar, ver o dashboard.
```
por
```
- **Vitest** — `bun run test` (= `vitest run`; `bun run test:watch` enquanto desenvolve). Project `node`
  (`*.test.ts`: domínio, schemas, queries de agregação, Server Actions, sempre com PGlite e as
  migrações reais) e project `dom` (`*.test.tsx`: Testing Library — comportamento e estados, não
  implementação). **Nunca `bun test`** (é o runner do Bun, não o Vitest).
- **PGlite não prova concorrência** (uma conexão, tudo serializado): a atomicidade vai no SQL
  (`UPDATE … RETURNING`) e o teste prova a invariante em sequência. Ver `library-docs.md §9`.
- **Playwright** — `bun run test:e2e`: sobe PGlite (pglite-socket) + `next build` + `next start`
  (cerca de 1 min) e cobre os fluxos críticos: acesso por convite, passkey, permissão por papel e,
  nas próximas fases, entregar um turno, receber/confirmar e ver o dashboard. Rode antes de fechar
  qualquer fase que mexa em rota, login ou permissão. Ver `library-docs.md §10`.
```

`AGENTS.md`: imediatamente antes de `## Regras que nunca mudam`, insira:
```
## Comandos

| Comando | Para quê |
|---|---|
| `bun run dev` | servidor de desenvolvimento (http://localhost:3000) |
| `bun run check-types` · `bun run lint` · `bun run format` | tipos · Biome (só verifica) · Biome (grava) |
| `bun run test` · `bun run test:watch` | Vitest (PGlite + Testing Library). **Nunca `bun test`** |
| `bun run test:e2e` | Playwright com banco efêmero (pglite-socket) e build de produção; cerca de 1 min |
| `bun run build` | build de produção (exige `BETTER_AUTH_URL` e `BETTER_AUTH_SECRET` no `.env.local`) |
| `bun run db:generate` → revisar → `bun run db:migrate` | migração versionada do Drizzle |
| `bun run admin:invite` | gera o link de convite do primeiro administrador |

```

- [ ] **Step 7: `.context/progress-tracker.md`**

(a) Em `## ▸ Próximo passo`, substitua as três linhas do primeiro item
```
- **2026-11-20 — Brainstorm concluído; spec escrita, aguardando revisão do dono.**
  `docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md` consolida as 18 decisões (`build-plan.md §5`) e as 6 seções de design aprovadas.
  Depois da revisão: plano de implementação (skill `writing-plans`), começando pela Fase 0.
```
por
```
- **2026-11-20 — Fases 0 e 1 concluídas. Próximo: plano de implementação da Fase 2 (Cadastros:
  setores, turnos, itens, destinos, equipe)** com a skill `writing-plans`, a partir da spec §13
  (`docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md`). O `/admin` já existe
  como placeholder e recebe as telas; o convite de operador já exige setor (`sector`).
```

(b) Troque `## Fase 0 — Fundação · 🟡` por `## Fase 0 — Fundação · ✅` e substitua as três linhas finais da seção
```
- ⬜ Setup de testes: PGlite + Vitest + Testing Library + Playwright
- ⬜ Tokens da D16 (`chart-1..4`, `success`, `warning`, `info`) no `globals.css`
- ⬜ Remoto do Git (GitHub) e deploy (provável Vercel)
```
por
```
- ✅ Setup de testes: Vitest 5 (projects `node` e `dom`) + PGlite com dump migrado + Testing Library + Playwright com pglite-socket (2026-11-20)
- ✅ Tokens da D16 (`chart-1..4`, `success`, `warning`, `info`) no `globals.css`, com guarda de paleta (P4 e P9 resolvidas) (2026-11-20)
- ✅ Remoto do Git: GitHub, branch `main` (2026-11-20)
- ⬜ Deploy na Vercel (movido para a Fase 6 — Produção)
```

(c) Antes de `## Histórico`, insira:
```
## Fase 1 — Acesso · ✅

- ✅ Schema de acesso: `sector`, `user` (papel, setor, desativação), `session`, `account`, `verification`, `passkey`, `rate_limit`, `invite` + migrações versionadas (2026-11-20)
- ✅ Convites: token aleatório com hash, uso único atômico, 7 dias, estados válido/expirado/usado/cancelado, script `admin:invite` (2026-11-20)
- ✅ Better Auth: cadastro só por convite (hook + cookie `closery_invite`), e-mail e senha, passkey, Google e Facebook condicionais ao env (2026-11-20)
- ✅ Papéis `admin`/`operator`: `Authz`, `scopeToSector`, `requireUser`/`requireAdmin`, `proxy.ts`; operador em `/admin` vê "Página não encontrada" (2026-11-20)
- ✅ Telas: `/entrar`, `/convite/[token]`, `/bem-vindo`, `/conta`, Início, `/admin` (placeholder), shell com sidebar, `error` e `not-found` (2026-11-20)
- ✅ Alvos de toque dos primitivos (P3 resolvida) (2026-11-20)
- ✅ Testes: Vitest (node + dom) e E2E com 7 cenários (convite, usado, senha errada, operador sem Administração, passkey, desativado, redirecionamento). Verificado: `check-types`, `lint`, `test`, `test:e2e` (7 passed) e `build` verdes (2026-11-20)
- ⬜ Login social ao vivo (checklist manual da spec §12): depende de P10 (Google) e P7 (Facebook); Apple na Fase 6 (P6)

```

(d) No fim do arquivo (lista de `## Histórico`), acrescente:
```
- **2026-11-20** — Fases 0 e 1 concluídas: fundação de testes (Vitest, PGlite, Testing Library, Playwright) e acesso por convite (Better Auth, papéis por setor, telas e shell). Plano em `docs/superpowers/plans/2026-11-20-fase-0-1-fundacao-e-acesso.md`.
```

- [ ] **Step 8: `.context/pendencias.md`**

(a) Em `**Ids:** … **Próximo id livre: P10.**` troque `**Próximo id livre: P10.**` por `**Próximo id livre: P11.**`.

(b) Na tabela `## Índice`, logo depois da última linha da tabela (a que começa com `| P9 |`), insira:
```
| P10 | Credenciais OAuth do Google não criadas | 🟡 | Bloqueado no dono |
```

(c) Em `## 3. Bloqueado no dono`, imediatamente antes de `## 4. Teto aceito`, insira:
```
#### P10 — Credenciais OAuth do Google não criadas 🟡
**Estado:** Bloqueado no dono
**Arquivos:** `.env.example` · `src/lib/auth/env.ts` · `src/components/auth/SocialButtons.tsx`
**Impacto:** sem `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` o botão "Continuar com Google" não aparece
(o botão é condicional ao env) e o login social não tem teste ao vivo: que o cookie `closery_invite`
chega ao hook no callback do Google é dedução do código do Better Auth, não observação.
**Correção:** criar o projeto no Google Cloud, configurar a tela de consentimento e um ID de cliente
OAuth do tipo Web com os URIs de redirecionamento `http://localhost:3000/api/auth/callback/google` e
`https://<domínio>/api/auth/callback/google`; preencher as duas variáveis no `.env.local` e na Vercel;
rodar o checklist manual de login social (spec §12), incluindo convite novo, usuário existente e
usuário sem conta (deve voltar com "Conta não encontrada. Peça um convite.").
**Registrado em:** 2026-11-20

```

(d) Nas pendências P6, P7 e P8, troque a linha `**Arquivos:** — (configuração do Better Auth, ainda não instalado)` por `` **Arquivos:** `src/lib/auth/createAuth.ts` · `src/lib/auth/env.ts` ``, e acrescente linhas de `Atualização` (cada uma logo depois da linha `**Registrado em:** 2026-11-20` da respectiva pendência):
- P6 (a que vem depois de `e adicionar depois (o resto não depende dela).`):
```
**Atualização (2026-11-20):** o Better Auth já está instalado (Fase 1) e o fluxo de convite não depende de Apple. Apple ficou fora da Fase 1 e entra na Fase 6, junto do domínio HTTPS e da conta de desenvolvedor; continua bloqueada.
```
- P7 (a que vem depois de `e tratar `email` nulo no cadastro.`):
```
**Atualização (2026-11-20):** o botão "Continuar com Facebook" já existe e só aparece com `FACEBOOK_CLIENT_ID` e `FACEBOOK_CLIENT_SECRET`; e-mail ausente volta como `email_not_found` ("Essa conta não informou um e-mail. Use outro jeito de entrar."). Falta o app da Meta publicado (privacidade e exclusão de dados); continua bloqueada.
```
- P8 (a que vem depois de `e um domínio remetente.`):
```
**Atualização (2026-11-20):** o Better Auth está sem `sendResetPassword` e a tela `/entrar` não oferece "esqueci a senha" (a passkey cobre quem a criou). Continua bloqueada até haver provedor de e-mail.
```

(e) Confira que P3, P4 e P9 estão em `## 5. Resolvido` com `Atualização` datada (as Tarefas 2 e 3 devem tê-las fechado): `grep -n "^#### P3 \|^#### P4 \|^#### P9 " .context/pendencias.md` deve listar as três **depois** da linha `## 5. Resolvido`. Se alguma ainda estiver em outra seção, mova-a para `## 5. Resolvido`, troque `**Estado:**` por `Resolvido`, atualize a linha do índice e acrescente `**Atualização (2026-11-20):** fechada na Fase 0/1 (tokens D16 e guarda de paleta; alvos de toque dos primitivos).`

- [ ] **Step 9: `memory.md` (handoff, substitua o arquivo inteiro)**

```markdown
# Memory — Fases 0 e 1 concluídas; o próximo passo é o plano da Fase 2

Last updated: 2026-11-20 (UTC-3)

---

## Onde o projeto está

**Fundação de testes e acesso prontos.** O app Next.js 16.4.6 tem testes automatizados de verdade
(Vitest com PGlite e Testing Library; Playwright com banco efêmero via pglite-socket) e acesso completo: cadastro só
por convite (e-mail e senha, Google e Facebook condicionais ao env), login com passkey, papéis
admin/operador escopados por setor, telas `/entrar`, `/convite/[token]`, `/bem-vindo`, `/conta`,
Início, `/admin` (placeholder) e o shell com sidebar.

O design do produto está na spec (`docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md`,
18 decisões em `.context/build-plan.md §5`) e o plano executado em
`docs/superpowers/plans/2026-11-20-fase-0-1-fundacao-e-acesso.md`.

## O que está esperando

- **Plano da Fase 2 (skill `writing-plans`):** Cadastros — setores, turnos, itens, destinos de
  solicitação, equipe. O `/admin` já existe como placeholder.
- **P10:** credenciais OAuth do Google não criadas (login social sem teste ao vivo).
  **P6/P7/P8:** Apple Developer, app da Meta, provedor de e-mail — só travam Apple, Facebook e "esqueci a senha".
- **Suposições a validar com o usuário final:** spec §15 (glossário, horários dos turnos, o que é
  solicitação, passagem feita no fim do turno, quem recebe).
- **Remoto:** `origin` = GitHub (`main`, repositório **público**). Commit e push só com pedido do dono;
  nunca `.env.local` nem segredo em commit.

## Coisas que vão te morder se ninguém avisar

- **Testes:** `bun run test` (Vitest) e `bun run test:e2e` (Playwright). **Nunca `bun test`.** Node ≥ 22.12.
- **PGlite não prova corrida:** uma conexão só, serializa tudo. Atomicidade vai no SQL (`UPDATE … RETURNING`).
- **`next build` exige `BETTER_AUTH_URL` e `BETTER_AUTH_SECRET`** (≥ 32 caracteres) no `.env.local` e
  na Vercel; sem eles falha com `Failed to collect page data for /api/health`.
- **O E2E roda o app em produção:** o rate limit do Better Auth está ligado (`/sign-up/email` 10 por
  60 s e `/sign-in/email` 30 por 60 s, por IP); cada teste manda um `x-forwarded-for` próprio. O env do
  `webServer` vence o `.env.local`, então o E2E nunca toca o Neon.
- **Better Auth:** schema de auth escrito à mão (`src/db/schema/auth.ts`) com teste guarda; erro de
  hook é sempre `APIError` com `code`; sem `cookieCache` e sem `nextCookies()`; cadastro e login pelo
  `authClient` (HTTP). Nunca renderizar `error_description` da URL.
- **Cache Components:** sessão (`getAuthz`) só dentro de `<Suspense>`, nunca em `"use cache"`.
- **Base UI, não Radix:** `render`, não `asChild`; navegação com cara de botão é
  `<Link className={buttonVariants()}>`, porque `Button render={<Link />}` vira `role="button"`.
- **jsdom 28 + polyfill de `matchMedia`** (`test/setup-dom.ts`); `check-types` roda `next typegen` antes.
- **Passkey cancelada** chega como `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`: traduza com `passkeyErrorCode`.
- **Passkey:** `rpID` vem de `BETTER_AUTH_URL`; passkey de `localhost` não vale em produção.
- **Primeiro administrador:** `bun run admin:invite` imprime o link do convite.
- **Driver é `pg` + `attachDatabasePool`** (D18), não `neon-serverless`. Escrita multi-statement em
  `db.transaction()`; nada de `db.batch`.
- **`.env.local` aponta para a branch de DESENVOLVIMENTO do Neon**; as URLs de
  produção estão comentadas até irem para a Vercel. Usa `DATABASE_URL` (direta) + `DATABASE_URL_POOLED`
  (o contrário da convenção do `neon env pull`); `src/db/databaseUrl.ts` aceita as duas. Sempre `sslmode=verify-full`.
- **A CLI `neon` está com a sessão expirada** (`neon login` resolve).
- **Componentes KokonutUI vêm com cor crua e em inglês** — adaptar na instalação (`library-docs.md §6`).
- O Playwright MCP grava artefatos em `.playwright-mcp/` (ignorado no git).
- **Nenhum dado real da planilha** (nomes das pessoas) entra em commit, seed ou teste.
```

- [ ] **Step 10: Conferir o `ui-registry.md`**

Run: `grep -cE "^### (AppSidebar|AuthedSidebar|SidebarSkeleton|MenuToggle|Greeting|AdminOverview|SocialButtons|InviteUnavailable|InviteSignup|SignInPanel|PasskeyOffer|PasskeyManager|SignOutButton)$" .context/ui-registry.md`
Expected: `13` (6 da Tarefa 8, 3 da Tarefa 9, 1 da Tarefa 10, 3 da Tarefa 11). Se der menos, a tarefa que deixou de registrar está incompleta: volte a ela.

- [ ] **Step 11: Run test to verify it passes (a documentação agora fala da Fase 0+1)**

Run:
```bash
grep -cF "pglite-socket" .context/architecture.md .context/library-docs.md .context/code-standards.md AGENTS.md memory.md
grep -cF "| P10 | Credenciais OAuth do Google" .context/pendencias.md
grep -cF "## Fase 1 — Acesso · ✅" .context/progress-tracker.md
grep -cF "Fase 0 + Fase 1: fundação de testes e acesso" .context/architecture.md
grep -n "Próximo id livre" .context/pendencias.md
```
Expected: PASS: toda contagem ≥ 1 (`architecture.md:2` ou mais, `library-docs.md:3` ou mais, `code-standards.md:1`, `AGENTS.md:1`, `memory.md:1`), `1`, `1`, `1`, e a última linha mostra `Próximo id livre: P11`.

- [ ] **Step 12: Verificação final (gate da Fase 0+1)**

Garanta as variáveis de acesso no `.env.local` (arquivo não versionado; não cole o segredo em lugar nenhum):
```bash
grep -q "^BETTER_AUTH_URL=" .env.local || printf '\nBETTER_AUTH_URL=http://localhost:3000\n' >> .env.local
grep -q "^BETTER_AUTH_SECRET=" .env.local || printf 'BETTER_AUTH_SECRET=%s\n' "$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")" >> .env.local
```
Depois rode, nesta ordem:

1. `bun run check-types`
   Expected: `$ next typegen && tsc --noEmit`, `✓ Types generated successfully` e nenhuma linha de erro (exit 0).
2. `bun run lint`
   Expected: `Checked N files in Xms. No fixes applied.` (0 erros, 0 avisos).
3. `bun run test`
   Expected: `Test Files  N passed (N)` e `Tests  M passed (M)`, 0 failed, nos projects `node` e `dom`; cerca de 10 a 40 s.
4. `bun run test:e2e`
   Expected: `7 passed`; cerca de 1 min (3 a 4 min na primeira vez), com `[banco] pglite-socket pronto 127.0.0.1:54329` no início.
5. `bun run build`
   Expected: `✓ Compiled successfully`, sem erro de TypeScript e a tabela de rotas com `/`, `/admin`, `/bem-vindo`, `/conta`, `/entrar`, `/convite/[token]`, `ƒ /api/auth/[...all]`, `ƒ /api/health` e `ƒ Proxy (Middleware)`. Se aparecer `Failed to collect page data for /api/health`, faltam `BETTER_AUTH_URL`/`BETTER_AUTH_SECRET` no ambiente.

Registre o resultado real no chat (`progress-tracker.md` já diz "verdes": só mantenha essa frase se os cinco comandos passaram).

- [ ] **Step 13: Commit final (sem push)**
```bash
git add AGENTS.md memory.md .context
git commit -F - <<'EOF'
docs: fecha as Fases 0 e 1 no contexto do projeto

Atualiza arquitetura (stack, tabelas, autenticação implementada, rotas e
log), library-docs (Better Auth, Vitest + PGlite, Playwright +
pglite-socket), padrões de teste, comandos do AGENTS.md, tracker,
pendências (P10 do Google, atualizações de P6, P7 e P8) e o handoff. O
próximo passo passa a ser o plano da Fase 2.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
```
Não faça `git push`: só com pedido do dono.

- [ ] **Step 14: Walkthrough didático das Fases 0 e 1 (`code-standards.md §9`)**

Entregue no chat (não em arquivo) um walkthrough curto, nas quatro partes da regra:
1. **O que foi construído e onde vivem as peças:** harness de testes (`vitest.config.ts`, `test/`, `e2e/`), schema e convites (`src/db/schema/`, `src/features/invites/`), Better Auth (`src/lib/auth/`), autorização (`src/features/authz/`, `src/proxy.ts`), telas (`src/app/(auth)/`, `src/app/(app)/`) e componentes (`src/components/auth/`, `src/components/app-shell/`).
2. **Decisões e trade-offs:** T1–T17 deste plano, com destaque para o consumo do convite no hook (atômico, mas gasto se a criação falhar depois), sessão lida do banco a cada requisição (sem `cookieCache`), PGlite que não prova corrida e `/admin` com status 200.
3. **Como debugar:** login recusado → código em `AUTH_ERROR_MESSAGES` e o hook em `createAuth.ts`; convite → `inviteState`/`findInviteByToken`; redirecionamento → `proxyRules.ts` e `session.ts`; E2E → `playwright-report/` e o log do `webServer`.
4. **O que entender antes de aprovar:** Cache Components (sessão só dentro de `<Suspense>`), a injeção de `db` (mesmo código em `pg` e PGlite) e a tradução de códigos do WebAuthn (`passkeyErrorCode`).
