# Library Docs — Closery

> **Documento vivo + regras por biblioteca.** Aqui ficam as **regras específicas do projeto** para
> cada dependência — não a doc geral da lib. Versões reais: `package.json`.

---

## 0. Protocolo (antes de usar qualquer biblioteca)

1. **Carregue a skill instalada da biblioteca**, quando existir.
2. **Busque a doc atual** para API/sintaxe:
   - **`node_modules/next/dist/docs/`** para Next.js — leia antes de escrever.
   - **context7 MCP** para as demais (Drizzle, Neon, Base UI, Tailwind, Zod…).
3. **Aplique as regras deste arquivo.** O conhecimento prévio pode estar desatualizado; a doc
   instalada é a verdade.

## 1. Next.js 16.4 + React 19.3

- App Router, Turbopack, **React Compiler ligado** (`reactCompiler: true`): não semeie
  `useMemo`/`useCallback`/`memo` por reflexo — só com motivo medido.
- **Cache Components ligado** (`cacheComponents: true` + `partialPrefetching: true`):
  - Dado é **dinâmico por padrão**; nada é cacheado sem pedir. Cache é opt-in com a diretiva
    `"use cache"` (página, componente ou função) + `cacheTag`/`cacheLife`; invalide com
    `revalidateTag` depois de uma escrita.
  - Partial Prerendering é o padrão: a casca estática sai na hora e o dinâmico chega por
    streaming — **acesso a dado dinâmico (cookies, headers, query sem cache) fica dentro de
    `<Suspense>`**.
  - Exige runtime Node.js: **não** exporte `runtime` em segmento de rota.
  - Navegação usa `<Activity>`: a rota anterior fica escondida com estado preservado — efeitos são
    limpos ao esconder e recriados ao voltar. Formulário de passagem meio preenchido sobrevive a
    ir e voltar, mas não a recarregar a página.
  - Guias: `01-app/01-getting-started/08-caching.md`, `09-revalidating.md`,
    `02-guides/authentication-with-cache-components.md`.
- `LayoutProps<"/">` / `PageProps<"/rota">` são tipos globais gerados pelo Next (typed routes).

## 2. shadcn/ui (`base-nova`) + Base UI

- **É Base UI, não Radix.** Composição pela **prop `render`**
  (`<DialogTrigger render={<Button />}>`), **não** `asChild`. Não copie padrões Radix.
- Primitivos em `src/components/ui` (kebab-case), **adicionados pelo CLI**:
  `bunx shadcn@latest add <componente>`. Não escreva primitivo à mão.
- Ajuste visual de primitivo → **edite o primitivo** e registre no `ui-registry.md`; nunca crie
  um paralelo.
- `cn` vem do pacote **`cn`** (utilitário oficial do shadcn, substitui `clsx` + `tailwind-merge`),
  reexportado em `@/lib/utils`.

## 3. Tailwind CSS v4

- Configuração **CSS-first** em `src/app/globals.css` (`@theme inline`, `@custom-variant dark`).
  Não existe `tailwind.config.js`. Token novo entra lá (claro **e** escuro) e é documentado no
  `ui-tokens.md`.
- Só classes semânticas (`bg-background`, `text-muted-foreground`…). Proibido cor crua.
- Fonte: `next/font` define `--font-sans` (Geist) e `--font-geist-mono` no `<html>`; o CSS lê
  essas variáveis. Mudou a fonte? Mude o `variable` no `layout.tsx` junto.

## 4. Biome 2.4

- `bun run lint` = `biome check` (só verifica). `bun run format` grava a formatação.
- Para corrigir só alguns arquivos: `bunx biome check --write <arquivos>`.
- Domínios `next` e `react` ligados no lint.
- A pasta `drizzle/` (migrações geradas) fica **fora** do Biome: o drizzle-kit reescreve esses
  arquivos e não segue a formatação do projeto.
- `biome.json` tem `overrides` que desligam 7 regras (`noDocumentCookie`, `noDoubleEquals`,
  `noArrayIndexKey`, `useSemanticElements`, `useKeyWithClickEvents`, `noLabelWithoutControl`,
  `useExhaustiveDependencies`) **só** em `src/components/ui/**` e `src/hooks/use-mobile.ts`
  (código gerado pelo shadcn). Depois de `bunx shadcn add`, rode `bun run format && bunx biome check --write`.
  O `sonner.tsx` gerado tem dois `as` (`ToasterProps["theme"]`, `React.CSSProperties`): é código
  gerado, fica como está.
- `.gitattributes` força LF (`* text=auto eol=lf`): o Git desta máquina tem `core.autocrlf=true`
  e CRLF reprova o `biome check`.

## 5. Drizzle ORM 0.45 + Neon

- **Driver (D18): `drizzle-orm/node-postgres`** + `Pool` do `pg`, registrado com
  **`attachDatabasePool`** do `@vercel/functions` (recomendação da skill oficial do Neon para
  Vercel Fluid compute). Escrita multi-statement em **`db.transaction()`**. Schema em
  `src/db/schema/` (um arquivo por área, reexportado por `index.ts`; passado ao `drizzle()` para a query relacional). O domínio recebe `db: Db` por parâmetro (`src/db/types.ts`); só `src/db/index.ts` importa `server-only` (scripts e E2E usam `src/db/client.ts`).
- **Não troque para `@neondatabase/serverless`** sem motivo: ele é a escolha do Neon para edge e
  serverless sem pool reutilizável, não para a Vercel com Fluid compute.
- **URLs:** `resolveDatabaseUrls()` (`src/db/databaseUrl.ts`) decide — pooler para o app, direta
  para o drizzle-kit — e aceita as duas convenções de nome do Neon. Sempre `sslmode=verify-full`.
- **Channel binding** é `enableChannelBinding: true` no `Pool` — o `pg` não lê o
  `channel_binding=require` da URL.
- **Datas do Better Auth:** as tabelas dele usam `timestamp` sem fuso; o Drizzle grava e lê em UTC (`toISOString`), então não há deslocamento; `defaultNow()` nessas colunas depende do `TimeZone` da sessão do Postgres (o Neon usa UTC).
- **Local = branch de desenvolvimento do Neon;** produção só na Vercel.
- **Pool em dev** fica no `globalThis` para o HMR não vazar conexões.
- **Testes: `drizzle-orm/pglite`** (`@electric-sql/pglite`), Postgres em processo, aplicando as
  migrações de `drizzle/` com o migrator do PGlite. Mesma API de `db.transaction()` — o módulo de
  banco é trocado no teste, o código de domínio não muda.
- **Não use `db.batch`**: ele não existe no driver de teste.
- Convenções de schema: ids `uuid` com `defaultRandom()` (ou `text` se houver motivo); timestamps
  `timestamptz` com `defaultNow()`; `index()` em toda FK e coluna de filtro; nomes de tabela e
  coluna em `snake_case` no banco (`casing: "snake_case"` se adotado — decidir na primeira tabela).
- **Migrações:** `bun run db:generate` → revisar o SQL em `drizzle/` → `bun run db:migrate`
  (usa `DATABASE_URL_UNPOOLED`). `db:push` só em banco de dev descartável. `db:studio` para
  inspecionar.
- `drizzle.config.ts` carrega `.env`/`.env.local` com `@next/env` — mesmas regras do Next — e usa
  a URL **direta** via `resolveDatabaseUrls()`.
- Branch do Neon para dev/preview é a forma barata de ter banco descartável.

## 6. Componentes de registry de terceiros (KokonutUI) — D17

- Entram **pelo CLI**: `bunx shadcn@latest add @kokonutui/<nome>` → `src/components/kokonutui/`.
  Antes de instalar, `bunx shadcn@latest view @kokonutui/<nome>` mostra o código.
- **Adaptação obrigatória na instalação** (o código vem em inglês e com cor crua):
  1. trocar `zinc-*`/`emerald-*`/`rose-*`/`orange-*`/`sky-*`… por tokens (`foreground`,
     `muted-foreground`, `border`, `muted`, `success`, `destructive`, `warning`, `chart-1..4`);
  2. textos e `Intl.NumberFormat`/datas em **pt-BR**;
  3. formato numérico com unidade (o `spending-ring` só formata moeda; o `metric-card` aceita
     `format: "number"`);
  4. `metric-card`: período **controlado** pelo dashboard (prop), sem as pílulas internas; os
     dados precisam cobrir **2× o período** (ele compara com o período anterior).
- São `"use client"` com animação própria (respeitam `prefers-reduced-motion`). Recebem dados
  já agregados no servidor — nunca buscam nada.
- Registre cada um no `ui-registry.md`, com as adaptações feitas.

## 7. Zod 4 · instalado na Fase 1

- Fonte da verdade dos contratos das Server Actions; tipos com `z.infer`.
- O **mesmo** schema valida no servidor e dá feedback no client.
- Em uso: `parseAuthEnv` (`src/lib/auth/env.ts`). API do Zod 4: `z.url()` (não `z.string().url()`) e mensagem por `{ error: "…" }`.

## 8. Better Auth 1.7 + passkey

> A doc atual é https://www.better-auth.com/docs e o código em `node_modules/better-auth/dist`. A CLI atual é o pacote `auth` (`bunx auth …`), **não** `@better-auth/cli` (defasado). Versão fixada em `1.7.27` junto com `@better-auth/passkey` e `@better-auth/core`.

- **Fábrica, não singleton (T1).** `createAuth(db, env)` recebe o banco; o singleton `auth` de `src/lib/auth/index.ts` só existe no app. Teste e E2E usam a fábrica.
- **Schema à mão + guarda (T3).** `src/db/schema/auth.ts` copia a saída da CLI, trocando `user.sector_id` por `uuid` com FK. A CLI não consegue importar a config (cadeia `server-only` + schema), então o teste guarda com `getAuthTables` compara o schema com o que a lib espera: ao atualizar o Better Auth, rode a CLI numa pasta à parte, compare e ajuste o arquivo.
- **Convite no `user.create.before` (T4, T5).** Consome o convite lido do cookie e injeta `role`, `sectorId` e `emailVerified`; o `after` grava `used_by`. Sem `ctx` o hook recusa. Cadastro por e-mail já existente falha **antes** do hook e não gasta convite (há teste).
- **Adapter sem `transaction` (T6).** Ligado, o hook consultaria fora da transação e o PGlite (uma conexão) travaria.
- **`APIError` com `code`.** Em hook, todo `throw` é `APIError` de `better-auth/api` com `code`; `Error` comum vira 500 sem corpo, e no callback OAuth só `APIError` com `code` vira redirect `?error=<code>`. Na tela, **nunca** renderize `error_description` (texto do servidor na URL): use só `authErrorMessage(code)` (mapa `AUTH_ERROR_MESSAGES`, com fallback).
- **Sem `cookieCache` e sem `nextCookies()` (T7).** Desativação vale na hora. Cadastro, login e passkey vão pelo `authClient` (HTTP, onde o rate limit atua); nenhum `auth.api.sign*` roda em Server Action.
- **Rate limit (T8).** Better Auth com `storage: "database"` (tabela `rate_limit`), ligado só em produção: `/sign-in/email` 30 por 60 s e `/sign-up/email` 10 por 60 s (`customRules` da `createAuth`); os demais `/sign-in*` e `/sign-up*` (social) seguem o padrão do Better Auth, 3 por 10 s; os endpoints de passkey ficam em `/passkey/*` e caem no padrão geral de 100 por 10 s. A janela conta a partir da **última** requisição permitida (cada requisição aceita move `lastRequest`). IP: sem `trustedProxies`, o Better Auth só confia em `x-forwarded-for` quando ele tem **um único valor**; com vários valores todos caem num balde compartilhado por caminho (`no-trusted-ip|<path>`); na Vercel o cabeçalho tem um valor só. No bloqueio (429) a tela mostra `Muitas tentativas nesta rede. Espere um minuto e tente de novo.` (código `RATE_LIMITED`, deduzido de `status === 429` em `errorCodeOf`). Atua só no router HTTP (`/api/auth/*`), nunca em `auth.api.*` chamado direto. Uma `customRules` com a mesma path sobrescreve a regra especial padrão.
- **Vínculo implícito desligado (T13).** `account.accountLinking.disableImplicitLinking: true`; o código `account_not_linked` está no mapa de mensagens.
- **Códigos do WebAuthn (T14).** `signIn.passkey` e `addPasskey` devolvem o código cru do `@simplewebauthn/browser` quando a cerimônia falha no navegador; traduza com `passkeyErrorCode(code, "authenticate" | "register")` antes de `authFormError`. Não acrescente esses códigos ao `AUTH_ERROR_MESSAGES` (os testes da Tarefa 6 comparam as chaves por igualdade).
- **Social (T9).** `disableImplicitSignUp: true`. Em `/entrar` use `requestSignUp: false` (sem conta: `?error=signup_disabled`); no convite use `requestSignUp: true` com o cookie já gravado. Facebook sem e-mail volta `email_not_found`. Apple só na Fase 6 (P6).
- **Cookie do convite (T10).** `closery_invite`, `httpOnly`, `SameSite=Lax` (Strict não volta no callback OAuth), `Secure` em produção, `path=/`, 1 h; gravado por `armInvite`, nunca por página.
- **Campos adicionais** (`role`, `sectorId`, `deactivatedAt`) com `input: false`: o valor enviado pelo cliente é descartado (ou dá 400); só o hook define `role` e `sectorId`.
- **Sessão no servidor.** `getAuthz()` (`cache()` do React) dentro de `<Suspense>` (Cache Components); nunca em função `"use cache"`; Server Component não grava cookie: por isso `SessionKeepAlive` (cliente, no layout `(app)`) chama `authClient.getSession()` uma vez ao montar, e o `/api/auth/get-session` HTTP regrava o cookie quando a sessão passa do `updateAge` (conferido em `better-auth/dist/api/routes/session.mjs`, ramo `needsRefresh` → `setSessionCookie`).
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

## Como adicionar uma biblioteca nova

1. Justifique (o que resolve que o stack atual não resolve?) — YAGNI.
2. Instale com `bun add` e registre aqui uma seção com as regras do projeto.
3. Registre a decisão no `architecture.md §10`.
