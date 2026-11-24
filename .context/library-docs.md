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
- **Fase 2: `toggle-group` (traz `toggle`), `native-select` e `dialog`.** Comando:
  `bunx shadcn add toggle-group native-select dialog --yes --overwrite` e depois
  `git checkout -- src/components/ui/button.tsx`. O `dialog` reinstala o `button.tsx` e o CLI
  pergunta se pode sobrescrever mesmo com `--yes`: sem `--overwrite` o comando trava, e o
  `button.tsx` sobrescrito perde a customização da P3. Os gerados saem com `h-8`/`h-7` e `"Close"`
  em inglês: ajuste para `h-9 max-md:h-11` (ou `size-9 max-md:size-11`), `text-base md:text-sm` no
  select nativo e `"Fechar"` (`touchTargets.test.tsx` e `ptBrLabels.test.tsx` guardam). Não usamos
  `table`, `select` (Base UI), `radio-group` nem `alert-dialog`: lista em linhas, `<select>` nativo
  (abre o seletor do aparelho, 16px) e `Dialog` para confirmar.

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
- **`time` é texto.** O Drizzle e o `pg` devolvem `time` como `"HH:mm:ss"` e aceitam `"HH:mm"` na
  entrada; o app trafega `"HH:mm"` (`fromDbTime`/`toDbTime` em `src/features/admin/timeOfDay.ts`).
  `CHECK` violado = SQLSTATE `23514`; índice único violado = `23505`.
- **Erro do driver embrulhado.** O Drizzle 0.45 coloca o erro do driver em `error.cause`: o SQLSTATE
  e o nome do índice estão em `error.cause.code` e `error.cause.constraint`. Use `sqlStateOf`,
  `constraintOf` e `isUniqueViolation` (`src/features/admin/dbErrors.ts`), nunca `error.code` direto.
- **Nome único sem diferença de caixa** = ``uniqueIndex("…").on(sql`lower(${t.name})`)``; composto por
  setor: ``.on(t.sectorId, sql`lower(${t.name})`)`` (esse índice já cobre a FK `sector_id`, então não
  há `index()` separado). Verificado no Neon de dev: `datcollate = datctype = C.UTF-8` e
  `lower('ÁGUA') = lower('água')`, então "Água" e "ÁGUA" colidem em produção como no PGlite.
- **`FOR UPDATE`:** `tx.select(…).from(t).where(…).for("update")` roda no `pg` e no PGlite; o domínio
  usa para trancar os administradores ativos (último admin) e as linhas de um setor (reordenar).
- **`db.select({ … })` sem `.from()` não executa** nesta versão do Drizzle (o builder não é
  "thenable"). Para um SELECT só de subconsultas use ``.from(sql`(values (1)) as one(n)`)``
  (`getAdminOverviewCounts`). `count(*)` volta como `bigint` (texto no driver): converta com
  `.mapWith(Number)` ou use o `count()` do `drizzle-orm`.
- **Subconsulta correlacionada:** num `SELECT` de uma tabela só o Drizzle tira o prefixo das colunas; dentro de
  ``sql`(select … where u.sector_id = ${sector.id})` `` o `"id"` resolveria para a tabela de dentro. Escreva
  a coluna externa por extenso (`"sector"."id"`) ou use JOIN/GROUP BY, e teste com dois registros de
  contagens diferentes (`listSectors`).
- **`FOR SHARE`:** a checagem de "setor ativo" (`updatePerson`, `setPersonActive`, `createTeamInvite`,
  `createShift`, `createItem`) lê o setor com `.for("share")` dentro de `db.transaction`; serializa com o
  `FOR UPDATE` de `setSectorActive`. Fora de transação a trava some no fim do statement.
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
- **Fase 2:** os schemas das Server Actions de `/admin` ficam em `src/features/admin/schemas.ts` (sem
  `server-only`): o mesmo schema valida no formulário e na action. `firstFieldErrors(error)` percorre
  `error.issues` e guarda a 1ª mensagem por campo (`issue.path[0]`; `z.flattenError` tiparia `fieldErrors` como `{}`); `.refine` com `path` marca o campo certo
  (`endsAt`, `sectorId`, `unitOther`).

## 8. Better Auth 1.7 + passkey

> A doc atual é https://www.better-auth.com/docs e o código em `node_modules/better-auth/dist`. A CLI atual é o pacote `auth` (`bunx auth …`), **não** `@better-auth/cli` (defasado). Versão fixada em `1.7.27` junto com `@better-auth/passkey` e `@better-auth/core`.

- **Fábrica, não singleton (T1).** `createAuth(db, env)` recebe o banco; o singleton `auth` de `src/lib/auth/index.ts` só existe no app. Teste e E2E usam a fábrica.
- **Schema à mão + guarda (T3).** `src/db/schema/auth.ts` copia a saída da CLI, trocando `user.sector_id` por `uuid` com FK. A CLI não consegue importar a config (cadeia `server-only` + schema), então o teste guarda com `getAuthTables` compara o schema com o que a lib espera: ao atualizar o Better Auth, rode a CLI numa pasta à parte, compare e ajuste o arquivo.
- **Convite no `user.create.before` (T4, T5).** Consome o convite lido do cookie e injeta `role` e `sectorId` (`inviteSignupData`); **não** força `emailVerified` (o convite não prova o e-mail: fica `false` no e-mail e senha e com o valor do provedor no social); o `after` grava `used_by`. Sem `ctx` o hook recusa. Cadastro por e-mail já existente falha **antes** do hook e não gasta convite (há teste).
- **Adapter sem `transaction` (T6).** Ligado, o hook consultaria fora da transação e o PGlite (uma conexão) travaria.
- **`APIError` com `code`.** Em hook, todo `throw` é `APIError` de `better-auth/api` com `code`; `Error` comum vira 500 sem corpo, e no callback OAuth só `APIError` com `code` vira redirect `?error=<code>`. Na tela, **nunca** renderize `error_description` (texto do servidor na URL): use só `authErrorMessage(code)` (mapa `AUTH_ERROR_MESSAGES`, com fallback).
- **Sem `cookieCache` e sem `nextCookies()` (T7).** Desativação vale na hora. Cadastro, login e passkey vão pelo `authClient` (HTTP, onde o rate limit atua); nenhum `auth.api.sign*` roda em Server Action.
- **Rate limit (T8).** Better Auth com `storage: "database"` (tabela `rate_limit`), ligado só em produção: `/sign-in/email` 30 por 60 s e `/sign-up/email` 10 por 60 s (`customRules` da `createAuth`); os demais `/sign-in*` e `/sign-up*` (social) seguem o padrão do Better Auth, 3 por 10 s; os endpoints de passkey ficam em `/passkey/*` e caem no padrão geral de 100 por 10 s. A janela conta a partir da **última** requisição permitida (cada requisição aceita move `lastRequest`). IP: sem `trustedProxies`, o Better Auth só confia em `x-forwarded-for` quando ele tem **um único valor**; com vários valores todos caem num balde compartilhado por caminho (`no-trusted-ip|<path>`); na Vercel o cabeçalho tem um valor só. No bloqueio (429) a tela mostra `Muitas tentativas nesta rede. Espere um minuto e tente de novo.` (código `RATE_LIMITED`, deduzido de `status === 429` em `errorCodeOf`). Atua só no router HTTP (`/api/auth/*`), nunca em `auth.api.*` chamado direto. Uma `customRules` com a mesma path sobrescreve a regra especial padrão.
- **Vínculo implícito desligado (T13).** `account.accountLinking.disableImplicitLinking: true`; o código `account_not_linked` está no mapa de mensagens.
- **Códigos do WebAuthn (T14).** `signIn.passkey` e `addPasskey` devolvem o código cru do `@simplewebauthn/browser` quando a cerimônia falha no navegador; traduza com `passkeyErrorCode(code, "authenticate" | "register")` antes de `authFormError`. Não acrescente esses códigos ao `AUTH_ERROR_MESSAGES` (os testes da Tarefa 6 comparam as chaves por igualdade).
- **Social (T9).** `disableImplicitSignUp: true`. Em `/entrar` use `requestSignUp: false` (sem conta: `?error=signup_disabled`); no convite use `requestSignUp: true` com o cookie já gravado. Facebook sem e-mail volta `email_not_found`. Apple só na Fase 6 (P6).
- **Cookie do convite (T10).** `closery_invite`, `httpOnly`, `SameSite=Lax` (Strict não volta no callback OAuth), `Secure` em produção, `path=/`, 1 h; gravado por `armInvite`, nunca por página.
- **Campos adicionais** (`role`, `sectorId`, `deactivatedAt`) com `input: false`: o valor enviado pelo cliente é descartado (ou dá 400); só o hook define `role` e `sectorId`.
- **Sessão no servidor.** `getAuthz()` (`cache()` do React) dentro de `<Suspense>` (Cache Components); nunca em função `"use cache"`; Server Component não grava cookie: por isso `getAuthz` lê com `query: { disableRefresh: true }` (sem renovar; a checagem de expiração vem antes) e a única renovação é do `SessionKeepAlive` (cliente, no layout `(app)`): `authClient.getSession()` uma vez ao montar, e o `/api/auth/get-session` HTTP regrava banco e cookie juntos quando a sessão passa do `updateAge` (1 dia). Conferido em `better-auth/dist/api/routes/session.mjs`: expiração ~linhas 156-166, `disableRefresh` ~linhas 171-182 e 187, ramo `needsRefresh` → `updateSession` + `setSessionCookie` ~linhas 201-216.
- **Passkey.** `addPasskey` exige sessão recente (`SESSION_NOT_FRESH`); `rpID` e origem derivam de `BETTER_AUTH_URL`; passkey de `localhost` não vale em produção e o domínio de preview da Vercel é outro. Login: `autoComplete="username webauthn"` + `signIn.passkey({ autoFill: true })` e o botão.
- **Env.** `BETTER_AUTH_SECRET` (≥ 32 caracteres) e `BETTER_AUTH_URL` precisam existir também no build e na Vercel.

## 9. Vitest + PGlite + Testing Library

- **Comandos:** `bun run test` (= `vitest run`) e `bun run test:watch`. **Nunca `bun test`** (é o runner do Bun). Node ≥ 22.12 (exigência do Vitest 5).
- **`vitest.config.ts`** usa `test.projects`: `node` (`src/**/*.test.ts`, `test/**/*.test.ts`, globalSetup) e `dom` (`src/**/*.test.tsx`, jsdom, setup do Testing Library). `resolve.tsconfigPaths: true` resolve `@/*` (sem `vite-tsconfig-paths`) e não há `@vitejs/plugin-react`. Filtrar: `bunx vitest run --project node`.
- **`server-only`** é trocado por `test/empty.ts` com `test.alias` (caminho absoluto via `fileURLToPath`; `URL.pathname` gera `/C:/…` no Windows).
- **Dump migrado.** `test/global-setup.ts` migra `./drizzle` uma vez e grava `node_modules/.cache/closery-test/migrated.tar`; `createTestDb()` carrega o dump (~1,4 s contra 3 a 6 s de `initdb` + migrate) e é regerado a cada execução. Um PGlite por arquivo de teste (`beforeAll`/`afterAll`).
- **`resetDb(client)`** apaga as linhas de `TABLES` com `session_replication_role = replica`; o teste `test/db.test.ts` compara `TABLES` com `pg_tables`: tabela nova no schema exige atualizar `TABLES`.
- **PGlite não prova concorrência.** É uma conexão só e serializa tudo: `Promise.all` de dois consumos passa até com `SELECT` + `UPDATE` não atômico. Escreva a atomicidade no SQL (um `UPDATE … RETURNING`), teste a invariante em sequência (o segundo consumo devolve 0 linhas) e revise a forma da query; corrida real só contra um Postgres de verdade (branch do Neon), registrada como limite aceito.
- **Injeção de `db`** é o padrão; `vi.mock("@/db", async () => …createTestDb)` (factory assíncrona, `vi.mock` é içado) para a camada fina (actions e route handlers) e para os Server Components de lista que leem o PGlite (`ShiftsAdmin`, `ItemsAdmin`); o projeto `dom` roda o mesmo `globalSetup`, com timeouts de 15 s/30 s.
- **Componentes:** `@testing-library/react` + `user-event` + `@testing-library/jest-dom/vitest`, com `cleanup()` no `afterEach` (sem `globals`). Página assíncrona não renderiza no Vitest; folha assíncrona pode ser testada com `render(await Componente())` e sessão mockada; a composição fica no Playwright.
- **jsdom 28** (o 31 exige Node ≥ 22.22.2). jsdom não tem `window.matchMedia`, que o `useIsMobile` do sidebar chama: `test/setup-dom.ts` faz o polyfill (desktop por padrão). O `hover` do user-event não abre o Tooltip do Base UI: use `fireEvent.pointerEnter` + `mouseEnter`.
- **Auth em teste:** `createTestAuth(db)` e `signUpWithInvite(auth, token, …)` (o convite vai no header `cookie: closery_invite=…`). O rate limit não afeta `auth.api.*`.
- **Permissão em teste de domínio e de action:** `authzOf({ role, … })` (`test/authz.ts`) monta o
  `Authz` (admin sempre com `sectorId` nulo); a action de operador, com `requireAdmin` mockado para
  lançar `notFound`, não toca o banco. **Guardas estáticos** que leem arquivos: `appPagesAuth.test.ts`
  (páginas), `actionsAuth.test.ts`, `actionsInventory.test.ts` e `actionsGuards.test.ts` (actions e
  qualquer `"use server"`), `pendenciasDoc.test.ts` (índice, seções e próximo id de `pendencias.md`) e
  `uiRegistryDoc.test.ts` (todo componente de `/admin` e de `/passagens` aparece em `ui-registry.md`).

## 10. Playwright + pglite-socket

- **Comando:** `bun run test:e2e` (= `playwright test`); Chromium (`bunx playwright install chromium`; no CI Linux, `--with-deps`).
- **`playwright.config.ts`:** `webServer` em **array** e em ordem: (1) `bun e2e/start-db.ts` com `port: 54329` (espera TCP; `port` consta como obsoleto na doc, mas o banco não fala HTTP), `reuseExistingServer: false`; (2) `bun run build && bun run start -p 3200` com `url` em `/api/health`, timeout de 300 s. `use.baseURL` explícito (obrigatório com array) e `workers: 1` (um PGlite serializa tudo).
- **Env do `webServer`** é mesclado a `process.env` e o Next não sobrescreve variável já definida (nem string vazia): `DATABASE_URL` e `DATABASE_URL_POOLED` apontam para o socket (o E2E nunca toca o Neon) e `GOOGLE_*`/`FACEBOOK_*` = `""` desligam o social mesmo com credenciais no `.env.local`.
- **pglite-socket:** `maxConnections` precisa ser maior que o `max` do Pool do app (10) mais as conexões do teste (usamos 20); com o padrão (1), a segunda conexão cai com `Connection terminated unexpectedly`. Banco em memória, descartado a cada execução.
- **Produção no E2E.** O app roda com `next start` (`NODE_ENV=production`), então o rate limit está ligado (cadastro por e-mail: 10 por 60 s por IP): cada teste manda `x-forwarded-for` próprio (fixture `clientIp`, repetida em `auth.spec.ts` e `cadastros.spec.ts`) e nenhum faz mais de 2 cadastros.
- **Passkey:** autenticador virtual via CDP (`e2e/virtual-authenticator.ts`), só Chromium, criado **antes** do clique que dispara o WebAuthn. Com ele o autofill de `/entrar` entra sozinho ao abrir a página; o teste do botão desliga `isConditionalMediationAvailable` com `addInitScript`.
- **Base UI:** navegação com cara de botão é `<Link className={buttonVariants()}>` (role link); `Button render={<Link />}` daria role=button e não é usado para navegação. No spec: `getByRole("link")` para "Agora não" e para os itens da sidebar.
- **`/admin` do operador:** confira o texto "Página não encontrada" e o `<title>`, nunca o status (com streaming é 200).
- Cada teste cria os próprios dados (e-mail único, nomes fictícios). Login social ao vivo é checklist manual.
- **`e2e/cadastros.spec.ts`:** a linha de uma lista é um `<li>` dentro de `<main>` (`rowWith(page, texto)`),
  para não casar com a barra lateral; o link do convite sai do campo `Link do convite`;
  `countSessionsByEmail` (`e2e/db.ts`) prova que desativar apaga as sessões (P11). Setor, turno, item
  e destino de cada teste têm nome único (sufixo aleatório): o banco só é limpo entre execuções.
- Duração: cerca de 1 min com o cache do Turbopack; 3 a 4 min na primeira vez.

## 11. GitHub Actions (CI)

- **Arquivo:** `.github/workflows/ci.yml`. Roda em todo `pull_request` e em `push` na `main`;
  `permissions: contents: read`; um push novo cancela a execução anterior do mesmo ref.
- **Dois jobs em paralelo (Ubuntu):** `checks` (`check-types`, `lint`, `test`) e `e2e`
  (`playwright install --with-deps chromium` + `test:e2e`, que já inclui o `next build`). O
  relatório do Playwright vira artefato por 7 dias.
- **Versões:** Bun `1.3.3` (igual ao `packageManager`) e Node 22 (Vitest 5 exige ≥ 22.12).
  Ações do GitHub pela tag de major (`checkout@v7`, `setup-node@v7`, `cache@v6`,
  `upload-artifact@v7`); ação de terceiro (`oven-sh/setup-bun`) **fixada por SHA de commit**.
  Ao atualizar, troque o SHA e o comentário da versão juntos.
- **Sem segredos.** O CI não usa o Neon nem credencial nenhuma: os testes usam PGlite e o E2E usa o
  `env` do `playwright.config.ts`. Nunca adicione `DATABASE_URL` real como secret do CI para
  testes.
- **Cache:** `~/.bun/install/cache` e `~/.cache/ms-playwright` pela hash do `bun.lock`;
  `.next/cache` pela hash de `bun.lock` + `src/**` + `next.config.ts`.
- **Linux pega o que o Windows esconde:** caminho de import com caixa errada passa no Windows e
  quebra no CI. Se o CI falhar e local passar, desconfie primeiro disso.

## 12. Server Actions do admin (Fase 2)

- **Onde:** `src/app/(app)/admin/<cadastro>/actions.ts` (`"use server"`), uma por página; a regra de
  negócio fica em `src/features/admin/<cadastro>.ts` (recebe `db` e `now`). O arquivo só exporta
  funções `async`: tipos, constantes e schemas vivem fora dele.
- **Padrão de cada função exportada:** `requireAdmin()` na **primeira linha** (guarda
  `actionsAuth.test.ts`), depois `runAdminAction`:

  ```ts
  export async function createSectorAction(input: unknown) {
    const actor = await requireAdmin();
    return runAdminAction({
      actor,
      schema: createSectorSchema,
      input,
      run: ({ db, input }) => createSector(db, input),
    });
  }
  ```

- **`runAdminAction`** (`src/features/admin/runAdminAction.ts`, `server-only`): `schema.safeParse` →
  falha vira `INVALID_INPUT` com `fieldErrors`; `run({ db, now, actor, input })`; `revalidatePath("/(app)/admin",
  "layout")` só quando `ok` (com route group o caminho é o do arquivo, como em `revalidatePath.md`); exceção inesperada passa por `unstable_rethrow` (deixa `redirect` e
  `notFound` seguirem) e, se for outra, vira `INTERNAL` com `console.error` e texto fixo. Nunca devolve
  texto do banco.
- **Erro esperado volta como `AdminResult`** (`ok: false`, `code`, `message` pt-BR pronta); `throw` só para
  falha interna. Erro de nome repetido (23505) consulta o registro conflitante para dizer se ele está
  inativo.
- **Formulário controlado:** o componente guarda o estado, chama a action com um **objeto tipado** dentro de
  `useAdminAction` e só limpa o campo no sucesso; erro de campo vem de `fieldErrors`. Não use
  `useActionState`/`FormData` aqui: o React 19 limpa o formulário não controlado depois do envio.
- **Tempo e paginação:** o domínio recebe `now: Date` quando o tempo importa; listas usam `PAGE_SIZE = 50`
  e `?pagina=`, e a página fora do intervalo é clampada.

## 13. Passagem de turno (Fase 3)

- **Onde:** domínio em `src/features/handovers/*` (recebe `db: Db` e, quando o tempo importa, `now: Date`; devolve `AdminResult` com mensagem pt-BR pronta); Server Actions em `src/app/(app)/passagens/actions.ts` e `src/app/(app)/actions.ts`; telas em `src/components/passagens/*`. O arquivo `actions.ts` só exporta funções `async`; tipos, constantes e schemas vivem fora dele.
- **`runHandoverAction`** (`src/features/handovers/runHandoverAction.ts`, `server-only`): irmão do `runAdminAction` (§12). `schema.safeParse` → `run({ db, now, actor, input })` → `unstable_rethrow` (deixa `redirect` e `notFound` passarem) → `INTERNAL` com texto fixo. A diferença é o parâmetro `revalidate`: `false` no salvamento automático (revalidar re-renderizaria a tela enquanto a pessoa digita), `true` em entregar, confirmar e corrigir (`revalidatePath("/(app)", "layout")`, só quando `ok`). Cada action começa por `requireUser()` (a do setor, `requireAdmin()`).
- **Salvamento automático** (`useHandoverAutosave`): debounce de 800 ms **por campo**, **fila serial** (uma requisição em voo, porque duas Server Actions não têm ordem garantida e o valor velho poderia sobrescrever o novo) e coalescência (o valor mais novo de cada campo vence). `onBlur` envia já; falha mantém o que foi digitado, para a fila e mostra "Não salvo." com "Tentar de novo"; o evento `online` reenvia; `beforeunload` só enquanto houver algo não salvo; ao desmontar envia o pendente. "Entregar turno" e a troca de turno ou dia chamam `flush()` antes.
- **SQL do histórico** (`history.ts`): ``db.select({ … sql<string>`u.col` }).from(sql`(WITH … SELECT * FROM u) as u`)``, sem `db.execute` (o `Db` genérico não tipa o resultado). `timestamptz` cru volta como texto (`"2026-11-21 11:54:27.517+00"`) nos dois drivers: mapeie com ``sql<Date | null>`u.delivered_at`.mapWith(handover.deliveredAt)`` (a coluna do schema traz o decoder); `date` e `timestamp` sem fuso voltam como texto. O total (`count()`) e a página saem do mesmo CTE. O teste de paridade compara `hasShiftEnded` (JS) com o SQL de pares encerrados numa grade de horários (fim == agora conta como encerrado).
- **Cookie do setor** (`sectorCookie.ts`): `cookies().set` só em Server Function ou Route Handler, nunca em Server Component nem no `proxy.ts`; a leitura (`readRememberedSector`) fica dentro de `<Suspense>`. `chooseSectorAction` grava o cookie (`httpOnly`, `sameSite: "lax"`, `secure` em produção, `path: "/"`, 1 ano) e faz `redirect` **fora** de `try/catch`; "Todos os setores" não grava.
- **Fuso e datas:** `America/Sao_Paulo` via `Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23" }).formatToParts` (`saoPaulo.ts`); `operational_date` é texto `"YYYY-MM-DD"`. Teste de tempo usa o relógio injetado (`spDate()` em `test/clock.ts`), nunca o relógio real; o E2E usa turno `00:00–23:59` e a data de hoje na URL.
- **P27 (guardas):** `test/actionGuards.ts` guarda a varredura de actions (extraída de `actionsAuth.test.ts`); `actionsGuards.test.ts` reprova `"use server"` fora de `actions.ts`, action sem `requireUser`/`requireAdmin` na primeira instrução e `admin/**` sem `requireAdmin`; `appPagesAuth.test.ts` exige `requireAdmin` nas páginas de `admin/`.
- **E2E (`e2e/passagem.spec.ts`):** o Next mantém a página anterior escondida ao navegar; `getByText` também casa texto escondido e o modo estrito reprova. Use consultas por papel ou o helper `text()` do spec (`.filter({ visible: true })`) e `{ exact: true }` quando um texto contém o outro ("2 rolo" × "12 rolo").

## Como adicionar uma biblioteca nova

1. Justifique (o que resolve que o stack atual não resolve?) — YAGNI.
2. Instale com `bun add` e registre aqui uma seção com as regras do projeto.
3. Registre a decisão no `architecture.md §10`.
