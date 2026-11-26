# Fase 6 — Produção — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o código do Closery pronto para o piloto de uma semana em produção — Vercel **Hobby** no domínio `*.vercel.app` (D-F6-1, D-F6-3), Neon **Free** num projeto novo em `sa-east-1` (D-F6-4, C6-4) e **Sentry grátis** (D-F6-5) — sem tocar produção nem serviço externo nesta parte. Entregas: (1) configuração de produção: `vercel.json` (`gru1`, Bun fixado, previews desligados), `engines.node` `22.x`, cabeçalhos de segurança em toda rota e noindex em três camadas; (2) erro inesperado registrado por um ponto só (`logServerError`), sem mensagem, pilha nem parâmetro de SQL; (3) trava de host no `admin:invite` (`--confirmar-host`) e o `db:hosts` para conferir o banco da migração; (4) Better Auth endurecido: IP do rate limit explícito (P22), cookie do convite apagado no cadastro (P16), identificador da redefinição guardado com hash e sessões revogadas ao redefinir; (5) **link de redefinição de senha gerado pelo admin** em `/admin/equipe` e compartilhado como o convite (D-F6-2), com a página pública `/redefinir-senha` e o texto "Esqueceu a senha?" no `/entrar` (P8 continua bloqueada, com `Atualização`); (6) Sentry desligado sem DSN, sem dado pessoal no evento e com a mensagem do Drizzle limpa; (7) alvos de toque de 44 px nos links soltos e um guarda E2E que mede as telas (P12); (8) página pública `/privacidade` (rascunho até a empresa aprovar, C6-5), o link para ela e os textos do primeiro acesso; (9) E2E do link de redefinição e das páginas públicas; (10) runbook de produção, `scripts/smoke.mjs` e a documentação. A **Parte B (go-live)** — deploy, variáveis, migração de produção, `admin:invite` em produção, proteção da `main`, convites reais — é um checklist do controlador com o dono, fora do SDD, com confirmação do dono em cada passo voltado para fora (C6-7).

**Architecture:** Nada muda no modelo de dados: **nenhuma migração** nesta fase. A configuração de produção vive em arquivos versionados (`vercel.json`, `package.json`, `next.config.ts`, `src/app/robots.ts`, `metadata` do layout raiz) com testes que leem os próprios arquivos. O log de erro passa por `src/lib/logServerError.ts` (uma linha JSON com contexto, nome, SQLSTATE e digest; sem `server-only`, porque os limites de erro do cliente também usam), que na Tarefa 6 também é o ponto único de captura no Sentry para erro **tratado**; erro **lançado** no servidor chega pelo `onRequestError` do `instrumentation.ts`, e os limites de erro (`error.tsx`, `(app)/error.tsx`, `global-error.tsx`) chamam o mesmo `logServerError`. O `scrubEvent` (`beforeSend`) é a última barreira antes do envio. A redefinição de senha não usa e-mail: o domínio `createPasswordResetLink` (só admin) grava o token pelo `internalAdapter.createVerificationValue` do Better Auth (que aplica o `storeIdentifier` com hash), e o `POST /api/auth/reset-password` padrão do Better Auth o consome; o token viaja no **fragmento** da URL (`#token=`), que nunca chega ao servidor. As páginas novas (`/redefinir-senha`, `/privacidade`) são estáticas, fora de `(app)`, e entram na lista pública do proxy. O `admin:invite` imprime o alvo e recusa escrever sem a confirmação exata do host. O smoke test é um script `.mjs` sem credencial, com as regras puras num módulo testado.

**Tech Stack:** Next.js 16.4.6 (`cacheComponents`, `partialPrefetching`, `reactCompiler`) · React 19.3 · TypeScript 5.9 · Bun 1.3.3 · Drizzle 0.45.4 + `pg` 8.23 (Neon, `attachDatabasePool`) · Better Auth 1.7.27 (+ `@better-auth/passkey`) · Zod 4 · shadcn/ui `base-nova` (Base UI 1.9) · Tailwind 4.3.3 · Vitest 5.1.1 + jsdom 28 + Testing Library · PGlite 0.5.17 (+ `pglite-socket` 0.2.20 no E2E) · Playwright 1.65.1 · Biome 2.4.2. **Uma biblioteca nova:** `@sentry/nextjs` `11.18.0` exato (Tarefa 6; `bun add --exact`, peer `next ^16.0.0-0` atendido).

**Spec:** `docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md` (§4.3 login e "Esqueci a senha", §8 dados, §13 Fase 6, §15 suposições, §17 critério de pronto). Decisões do dono (D-F6-1..5) e padrões do controlador (C6-1..8), **vinculantes**: `.git/sdd/fase6-decisions.md`. **O plano é autocontido:** a pesquisa (`fase6-research/`) e os quatro spikes (`fase6-spike/{reset,config,sentry,mobile}`, feitos em clones separados a partir da mesma `main` 959c5e4) ficam citados só como **origem**; o código que a execução precisa vem completo em cada tarefa, já com a fusão dos spikes e as adaptações registradas abaixo (F6-21, F6-22).

## Global Constraints

- Leia `AGENTS.md` e os arquivos de `.context/` antes de começar; as regras de lá valem em toda tarefa. Antes de escrever código de Next, confira em `node_modules/next/dist/docs/`: `01-app/03-api-reference/05-config/01-next-config-js/headers.md`, `01-app/03-api-reference/03-file-conventions/{error,instrumentation,instrumentation-client,route-groups,proxy}.md`, `01-app/03-api-reference/03-file-conventions/01-metadata/robots.md`, `01-app/02-guides/{content-security-policy,instrumentation,production-checklist}.md`. Antes do Better Auth e do Sentry, a skill instalada de cada um e `library-docs.md`.
- Node **22** (`engines.node` passa a `"22.x"` na Tarefa 1; o Vitest 5 exige ≥ 22.12, a máquina local tem 22.12). Bun é o gerenciador e o runner; **nunca** `bun test` — use `bun run test`.
- Biome é a lei de formatação: espaços (2), aspas duplas, ponto e vírgula, imports organizados. Depois de código gerado: `bunx biome check --write <arquivos>`.
- TypeScript strict: sem `any`, sem `!` de conveniência, sem `as` para calar erro, **em código e em teste**. O único `as` aceito é o precedente do repositório `client: null as PGlite | null` dentro de `vi.hoisted` nos testes de action. Os casts dos spikes saem (F6-22).
- Named exports em tudo, exceto entry files do Next (`page.tsx`, `layout.tsx`, `route.ts`, `error.tsx`, `global-error.tsx`, `not-found.tsx`, `robots.ts`) e os exports nomeados que o Next exige (`register`, `onRequestError` em `instrumentation.ts`; `onRouterTransitionStart` em `instrumentation-client.ts`). Componentes em `PascalCase.tsx`, utilitários e hooks em `camelCase.ts`, scripts em `scripts/` (`.ts` rodados por `bun`, `.mjs` só para o smoke).
- Base UI, não Radix (composição pela prop `render`; navegação com cara de botão é `<Link className={buttonVariants({ … })}>`). Só tokens de cor, nunca hex nem cor crua do Tailwind; tema claro **e** escuro. Alvo de toque ≥ 44 px abaixo de `md` (`max-md:h-11` / `max-md:min-h-11`; link solto: `max-md:inline-flex max-md:min-h-11 max-md:items-center`). Controle só com ícone ganha tooltip **e** `aria-label`. Campo digitável com `text-base`.
- Server Components por padrão; `"use client"` só em `ResetPasswordForm`, `PasswordResetLinkButton`, no hook `useShareLink` e nos limites de erro. Código de banco nunca vaza para o cliente (`import "server-only"` em `features/admin/passwordReset.ts`).
- Cache Components ligado: nenhuma página nova lê `cookies()`, `headers()`, `searchParams` ou sessão. `/redefinir-senha` e `/privacidade` são **estáticas** (o `bun run build` as lista com `○`); nenhum `export const dynamic`/`runtime`/`revalidate`; nada de `"use cache"`.
- **Portão:** a Server Action nova `createPasswordResetLinkAction` chama `requireAdmin()` na primeira instrução (guarda `actionsGuards.test.ts`) e entra em `actionsInventory.test.ts`; o domínio refaz a checagem (`FORBIDDEN` para operador). **Nenhum `route.ts` novo** (o Sentry vai sem `tunnelRoute`; `routeHandlersAuth.test.ts` continua com a lista fechada `api/auth/[...all]`, `api/health`). As únicas rotas públicas novas são `/redefinir-senha` e `/privacidade` (`PUBLIC_PATH_PREFIXES`); as duas ficam fora de `(app)`, então `appPagesAuth.test.ts` não muda.
- **Sem migração:** nenhuma tabela, coluna, índice ou `CHECK` novo. A redefinição usa a tabela `verification` que já existe. Se uma tarefa precisar mudar o schema, **pare e reporte BLOCKED**.
- **Nada de produção nem de serviço externo:** nenhuma tarefa faz deploy, mexe em configuração da Vercel, do Neon, do Sentry ou do GitHub (proteção de branch, secrets), roda migração ou `admin:invite` contra produção, mexe em DNS ou envia convite real. Rede só para `bun add --exact @sentry/nextjs@11.18.0` (Tarefa 6; rode com `run_in_background` desde o início: no spike o `bun add` morreu quando o shell o mandou para segundo plano por tempo). O `next build` (inclusive o que o `test:e2e` roda) também baixa as fontes do `next/font/google` (Geist): isso é permitido, já era assim. Nenhum `curl`/`fetch` para `*.vercel.app`, `*.sentry.io` ou `*.neon.tech`. Servidores locais só em `localhost`: E2E na **3200** (app) e **54329** (banco); verificação manual com `next start` na **3201**. A porta **3000** pertence a outro processo: nunca a use nem a encerre.
- **Segredos:** nunca imprima o `.env.local` (nem com `cat`, `grep`, `env` ou `printenv`); nunca imprima connection string, secret, DSN ou token. O servidor local de verificação (3201) roda com env fictícia, e **a ferramenta Bash não guarda variáveis entre chamadas**: todo bloco que constrói ou sobe o servidor (Tarefas 1, 2 e 5 a 10) **começa com os 5 `export` abaixo e roda inteiro numa chamada só** (sem os `export` no mesmo bloco, o `next start` carrega o `.env.local` e fala com o Neon de desenvolvimento, um serviço externo proibido). A espera pelo servidor é `curl -s -o /dev/null --retry 60 --retry-delay 1 --retry-connrefused http://localhost:3201/robots.txt` (nunca `sleep` em primeiro plano: o harness o bloqueia). A env fictícia: `DATABASE_URL="postgresql://closery:fake@127.0.0.1:1/closery?sslmode=disable"`, `DATABASE_URL_POOLED` igual, `BETTER_AUTH_URL="http://localhost:3201"`, `BETTER_AUTH_SECRET="segredo-local-de-teste-nao-usar-0123456789abcdef"`, `NEXT_PUBLIC_SENTRY_DSN=""` (o banco recusa na hora, `ECONNREFUSED`). Encerrar: `netstat -ano | grep ':3201' | grep LISTENING` e `taskkill //PID <pid> //F` só desse PID.
- **Log:** em `src/`, só `src/lib/logServerError.ts` escreve no console (guarda `test/logGuard.test.ts`, Tarefa 2); o log nunca leva `message`, `stack` nem o objeto do erro. Na Tarefa 6 o guarda também exige que `@sentry/nextjs` só seja importado por `src/lib/sentry/*`, `src/instrumentation.ts`, `src/instrumentation-client.ts` e `src/lib/logServerError.ts`.
- **Sentry:** sem `NEXT_PUBLIC_SENTRY_DSN` nada é iniciado nem enviado. O E2E e o CI rodam com DSN vazio (`playwright.config.ts` fixa `NEXT_PUBLIC_SENTRY_DSN: ""` e `SENTRY_AUTH_TOKEN: ""`); `SENTRY_AUTH_TOKEN` nunca entra no CI nem no `.env.local`.
- Nenhum nome real de funcionário, foto ou dado da planilha em código, teste, fixture, runbook ou commit; nomes fictícios ("Ana Teste", "Bia Teste", "Caio Teste", "Bruno Fictício", "Gabriela Cadastros"), e-mails `@example.test`/`@exemplo.test`. O repositório é público: nenhum host de banco de produção, DSN, domínio de produção real ou link de convite em arquivo versionado (o runbook usa `<projeto>.vercel.app` e `<host do pooler>`).
- Textos de interface e de CLI em pt-BR, **exatamente** como na seção **Textos de interface** (testes e E2E dependem deles). Rótulos de ação nomeiam o resultado ("Trocar a senha", "Copiar link", "Tentar de novo"; nunca "Enviar", "OK", "Salvar").
- **Teste:** erro, limites (vazio, `0`, `1`, máximo e máximo + 1, unicode, 24 h exatas) e permissão negada sempre; cada tarefa traz as provas negativas da seção **Casos**. Relógio injetado (`now: Date`) no domínio; teste de validade usa `Date` fixo. jsdom não tem RSC: componente servidor async se testa com `render(await Componente(props))`. No jsdom o React 19 renderiza `<html>`/`<body>` como singletons do `document`: o `global-error.test.tsx` só aceita o aviso `In HTML, %s cannot be a child of <%s>` no `console.error` (espiado e filtrado) e reprova qualquer outro.
- **Linha de base do Vitest:** o Step 0 da Tarefa 1 roda `bun run test` uma vez e anota o total de arquivos e testes; cada tarefa diz quantos testes acrescenta por arquivo, e o total do fim de cada tarefa = o anterior + os acrescentados (o `migration0002.test.ts` pode estourar 15 s com a máquina carregada: repita só ele, `bunx vitest run src/db/schema/migration0002.test.ts`; se falhar isolado, BLOCKED).
- Toda tarefa termina com `bun run check-types`, `bun run lint` e `bun run test` verdes e um commit na branch `feat/fase-6-producao`. **Build e E2E:** as Tarefas **1, 5, 6, 7, 9 e 10** terminam também com `bun run build` e `bun run test:e2e` **inteiro**; as Tarefas **2 e 4** com `bun run build` e o subconjunto `bun run test:e2e -- e2e/auth.spec.ts e2e/passagem.spec.ts e2e/solicitacoes.spec.ts`; a Tarefa **8** com `bun run build` e `bun run test:e2e -- e2e/auth.spec.ts e2e/passagem.spec.ts e2e/solicitacoes.spec.ts e2e/touch-targets.spec.ts`; a Tarefa **3** sem build nem E2E (script e lógica pura), com a execução real do script com env fictícia. **Contagens do E2E (medidas no estado real):** o subconjunto `auth passagem solicitacoes` tem **22** (7 + 6 + 9) em todas as tarefas; o inteiro tem **35** (7 `auth` + 6 `cadastros` + 7 `dashboard` + 6 `passagem` + 9 `solicitacoes`) até a Tarefa 6, **37** depois da Tarefa 7 (+2 de `touch-targets`), **37** na Tarefa 8 (só acrescenta um caminho) e **43** depois da Tarefa 9 (+3 de `redefinir-senha` e +3 de `publico`); o subconjunto da Tarefa 8 tem **24**. O log do `[app]` pode mostrar `portal "" does not exist` (P49) sem reprovar teste. Se uma contagem divergir do número escrito, pare e reporte BLOCKED com o número medido (o executor nunca edita o plano).
- **Commits:** mensagens em pt-BR (`tipo(escopo): resumo`) terminando com a linha `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; a mensagem é escrita com a ferramenta Write em `.git/sdd/f6/msg-task-N.txt` (`msg-task-5a.txt` e `msg-task-5b.txt` na Tarefa 5) e o commit é `git commit -F .git/sdd/f6/msg-task-N.txt` (heredoc com acento falha no Git Bash); crie a pasta no Step 0 da Tarefa 1 (`mkdir -p .git/sdd/f6`). Nunca `--no-verify`, nunca `--amend`, nunca commitar `.env.local`. **Refatoração nunca no mesmo commit de feature:** a Tarefa 5 tem **dois commits**: (A) `refactor(equipe)`, só a extração do `useShareLink` com testes **novos** (nenhum teste existente do `InviteLinkCard` muda), e (B) `feat(equipe)`, o link de redefinição. As outras tarefas são um commit só. Uma tarefa que muda um contrato pode editar os testes do que muda (dito em cada tarefa: `nextConfig.test.ts` nas Tarefas 1 e 5; `error.test.tsx`, `(app)/error.test.tsx` e `runAction.test.ts` na 2; `adminInvite.test.ts` na 3; `people.test.ts`, `TeamAdmin.test.tsx`, `PersonRowActions.test.tsx`, `SignInPanel.test.tsx`, `proxyRules.test.ts`, `result.test.ts`, `messages.test.ts`, `schemas.test.ts`, `errors.test.ts`, `errorCodesContract.test.ts`, `actionsInventory.test.ts` e `e2e/cadastros.spec.ts` (e) na 5; `logServerError.test.ts` na 6; os testes dos 4 componentes na 7; `SignInPanel.test.tsx`, `PasskeyOffer.test.tsx`, `proxyRules.test.ts`, `uiRegistryDoc.test.ts` e `e2e/touch-targets.spec.ts` na 8; `e2e/helpers.ts` na 9).
- **Datas (regra única):** toda `**Atualização (…):**`, bloco de Histórico, ADR e o `PRIVACY_UPDATED_AT` usam a **data do dia da execução**, obtida com `bun -e 'console.log(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()))'` (o Git Bash desta máquina ignora o `TZ`; nunca `date +%F`). Os guardas não fixam a data: `updates.some((date) => date >= "2026-11-25")`.
- **Shell:** comandos deste plano são bash (Git Bash), nunca PowerShell. Arquivo com texto acentuado se cria com a ferramenta Write, não com heredoc. Em código que testa caractere especial, use escape com chaves (`\u{2013}`, `\u{a0}`).
- **Worktree:** se a execução usar `git worktree`, copie o `.env.local` do checkout principal antes da Tarefa 1 (o `build` precisa dele) **sem imprimir o conteúdo**; em worktree, `.git` é arquivo: use `$(git rev-parse --git-common-dir)/sdd/f6/` no lugar de `.git/sdd/f6/`.
- **Pendências:** mudam de seção na tarefa que as fecha, com `**Atualização (data):**` e o caso no `test/pendenciasDoc.test.ts` (padrão da Fase 5): P16 e P22 → `Resolvido` na Tarefa 4; P12 → `Resolvido` na Tarefa 7; P8 continua `Bloqueado no dono` e ganha `Atualização` na Tarefa 5; P7 ganha `Atualização` na Tarefa 8; P1, P6 e P10 ganham `Atualização` na Tarefa 10, que também registra as novas **P62 a P76** como `Aberto, não triado` (o próximo id livre passa de **P62** a **P77**). Nunca se apaga uma pendência.
- **Tracker e walkthrough (exceção registrada):** a fase inteira é a feature; o `progress-tracker.md` e o walkthrough didático (`code-standards.md §9`) são feitos **só na Tarefa 10**, não ao fim de cada tarefa (as Tarefas 1 a 9 atualizam os arquivos de `.context/` que o texto delas manda: catálogo, pendências, `library-docs`, arquitetura).
- **Este arquivo** entra no repositório num commit do controlador antes da Tarefa 1 (`docs(plano): Fase 6`); nenhuma tarefa o edita. O PR só abre com o CI (`checks` + `e2e`) verde.

---

## Decisões técnicas deste plano

`D-F6-n` = decisão do dono e `C6-n` = padrão do controlador (vinculantes, `.git/sdd/fase6-decisions.md`). `F6-n` = decisão técnica deste plano, provada num spike (o "Por quê" diz onde) ou tomada aqui (marcada **nova**).

| # | Decisão | Por quê |
|---|---|---|
| F6-1 | **`vercel.json`** (Tarefa 1), exatamente: `{"$schema":"https://openapi.vercel.sh/vercel.json","regions":["gru1"],"installCommand":"bunx bun@1.3.3 install --frozen-lockfile","buildCommand":"bun run build","git":{"deploymentEnabled":{"**":false,"main":true}}}` (formatado com 2 espaços). `"**"` e não `"*"`: o padrão é minimatch e `*` não casa `/`, então `feat/x` escaparia e faria preview. Sem `bunVersion` (é o runtime das funções, que rodam em Node). O `installCommand` fixa o Bun do `packageManager` só na instalação (a Vercel detecta o `bun.lock` e usa o "Bun 1" da imagem no build); o teste `test/vercelConfig.test.ts` amarra a versão ao `packageManager` | Spike `config`: validado contra o schema oficial (draft-04) com ajv; sintaxe de `deploymentEnabled` conferida na doc da Vercel. C6-2 (previews desligados: o build de Preview falharia sem `BETTER_AUTH_*`/`DATABASE_URL*`, que são validados no import). C6-8 (`gru1`, perto do Neon `sa-east-1`). Não verificado sem deploy (P63) |
| F6-2 | **`engines.node: "22.x"`** (era `>=22.12`). O teste lê o `.github/workflows/ci.yml` e exige que todo `node-version` tenha o mesmo major (zero ocorrências reprova) | A Vercel mapeia `>=22.0.0` para a 26.x mais recente: produção rodaria numa major que o CI nunca testou (síntese C7). `22.x` aceita 22.0–22.11, que o Vitest 5 recusa, mas a Vercel resolve para o último 22 |
| F6-3 | **Cabeçalhos de segurança** em `/:path*`, na ordem: `X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin-when-cross-origin` · `Content-Security-Policy: frame-ancestors 'none'` · `X-Frame-Options: DENY` · `Permissions-Policy: camera=(), microphone=(), geolocation=()` · `X-Robots-Tag: noindex, nofollow`. Depois da regra global vêm `/convite/:path*` (Tarefa 1) e `/redefinir-senha/:path*` (Tarefa 5) com `Referrer-Policy: no-referrer` (mesma chave, a regra posterior vence). `:path*` casa também o caminho sem segmento (`headers.md`: "`/blog/:slug*` matches `/blog`"), então `/redefinir-senha/:path*` cobre `/redefinir-senha`. `publickey-credentials-get/create` **ficam fora** da `Permissions-Policy` (o padrão `self` mantém as passkeys). **Sem HSTS** (a Vercel já envia `max-age=63072000; includeSubDomains; preload` em `*.vercel.app`). **Sem CSP de scripts** | Spike `config` (curl no `next start`: global em `/` e `/entrar`, `no-referrer` em `/convite/x`). CSP com nonce exige renderização dinâmica (`content-security-policy.md`), o que derruba o shell estático e o prefetch parcial do `cacheComponents` e custa CPU no Hobby; o app é interno, sem script de terceiro nem HTML de usuário. `frame-ancestors` (moderno) + `X-Frame-Options` (navegador antigo) não precisam de nonce. Reavaliar com SRI (`experimental.sri`) se virar requisito; se um dia houver CSP, liberar `connect-src https://*.ingest.sentry.io`. ADR na Tarefa 10 |
| F6-4 | **Noindex em três camadas:** `src/app/robots.ts` → `{ rules: { userAgent: "*", disallow: "/" } }`; `metadata.robots: { index: false, follow: false }` no layout raiz (nenhuma página define `robots` próprio); e o `X-Robots-Tag` da F6-3 | O `Disallow` impede o rastreio (o crawler nem vê o `noindex`); o cabeçalho e a meta cobrem a URL que alguém linkar. Spike `config`: `/robots.txt` sai estático (`○`) e o HTML de `/entrar` traz `<meta name="robots" content="noindex, nofollow"/>` |
| F6-5 | **`logServerError(error, context)`** escreve **uma** linha JSON `{"level":"error","context","name","code","digest"}` com `console.error` e nada mais: nunca `message`, `stack` nem o objeto. `name` só se casar `^[A-Za-z0-9_$.]{1,64}$` (senão `"Error"`; não-`Error` vira `"NonError"`); `code` (SQLSTATE do Postgres, ex.: `23505`, ou de rede, ex.: `ECONNREFUSED`) procurado em `error.code` e em até **3** níveis de `cause`, só se casar `^[A-Za-z0-9_]{1,32}$`; `digest` só se casar `^[A-Za-z0-9_-]{1,64}$`; `context` cortado em **80**. Sem `server-only` (os limites de erro do cliente também usam). Contextos fixos: `"runAction"`, `"health"`, `"error-boundary"` (Tarefa 2), `"better-auth"` e `"better-auth:ip-desconhecido"` (Tarefa 4; `error` pode ser `null` nesse segundo) e `"global-error"` (Tarefa 6). **Limite honesto (P75):** o log que o próprio Next imprime para erro **não tratado** de Server Component e de rota (`⨯ Error: Failed query: … params: …`) não passa por aqui; `logServerError` é o único ponto para erro **tratado** e para o que o `logger` do Better Auth emite (F6-7); o `# SERVER_ERROR: <erro>` que o roteador do `better-call` imprime por conta própria com `console.error` (exceção que não é `APIError`; `better-call/dist/router.mjs`), fora do `logger`, e o log do próprio Next ficam de fora (P75). `pick` lê propriedade com `Reflect.get` depois de `typeof value === "object" && value !== null` (sem `as`) | Spike `config`: o `DrizzleQueryError` carrega no `message` o SQL e os parâmetros (`Failed query: … params: …`), que podem ser e-mail, hash de token ou texto da passagem; o `name` dele é `"Error"` e o que identifica o erro é o `code` da `cause`. C6-8 (log sanitizado, `runAction.ts:67`) |
| F6-6 | **`admin:invite --confirmar-host=<host>`**: antes de qualquer escrita o script imprime só `Banco de destino: <host>` e `BETTER_AUTH_URL:  <url>` e exige a flag igual (sem diferença de caixa, comparação exata: prefixo e sufixo são recusados) ao host de `resolveDatabaseUrls(env).runtime` (o do pooler, se houver: `-pooler` faz parte do host). Sem a flag ou com host diferente: `Erro: …`, código 1, nada criado, nenhuma conexão aberta. Exigida também em dev. Uso sem `--` (`bun run admin:invite --confirmar-host=…`; o Bun repassa as flags). **Não** recusa um segundo admin. **Nova:** `databaseHostOf` vai para `src/db/databaseHost.ts` (o spike o pôs em `adminInvite.ts`) e ganha o vizinho `formatDatabaseHosts`, usado pelo script novo `bun run db:hosts`, que imprime o host da aplicação e o das migrações (nunca usuário, senha nem banco) — é a "trava de host" da migração de produção (C6-3): o `drizzle-kit` não tem trava, então o runbook manda conferir o host impresso antes do `db:migrate` | Síntese C8 e G-K (exportar só `DATABASE_URL` deixa o pooler de **dev** do `.env.local` valendo e o convite iria para o banco de dev com link de produção, sem erro). O script é o caminho de recuperação se o único admin perder o acesso: recusar criaria um impasse; a defesa é a trava de host + convite de uso único por 7 dias. A contagem de admins ativos fica como P74 |
| F6-7 | **IP do rate limit (P22):** `advanced: { ipAddress: { ipAddressHeaders: ["x-forwarded-for"] } }`, **só** esse cabeçalho, sem `trustedProxies`. Os números ficam: `/sign-in/email` 30 por 60 s e `/sign-up/email` 10 por 60 s por IP (padrão 100 por 10 s). **Logger do Better Auth (R4):** o logger padrão dele imprime o erro cru com `console.error` (o roteador e chamadas como `Better auth was unable to query your database.`), e o erro do Drizzle carrega o `Failed query … params: <token de sessão>, <IP>, <e-mail ou hash>`; por isso `createAuth` define `logger: { log }` que desvia só o nível `error` para `logServerError(<o Error dos argumentos ou null>, "better-auth")` e o aviso `Rate limiting could not determine a client IP` para `logServerError(null, "better-auth:ip-desconhecido")`; os demais avisos são descartados. O `# SERVER_ERROR` do `better-call` não passa pelo `logger` e fica de fora (P75). A conferência do log sem `better-auth:ip-desconhecido`, e sem linhas `SERVER_ERROR` ou `Failed query`, é passo da Parte B (B7) | Spike `reset` (`hardening.test.ts`, 8 casos com a tabela `rate_limit` real): a chave do balde é `<ip>\|/sign-in/email`; o 31º login do mesmo IP toma 429 e outro IP passa; `x-real-ip` e `x-vercel-forwarded-for` não escolhem o balde (fora da Vercel o cliente os forja); cabeçalho ausente ou lista `"1.1.1.1, 2.2.2.2"` caem **num** balde global, nunca num balde por valor forjado. A Vercel sobrescreve o `x-forwarded-for` com um IP só, que o Better Auth aceita; o E2E manda o seu próprio e continua funcionando |
| F6-8 | **P16:** no `databaseHooks.user.create.after`, depois de `recordInviteUser`, `ctx?.setCookie(INVITE_COOKIE, "", { ...inviteCookieOptions(process.env.NODE_ENV === "production"), maxAge: 0 })` | Spike `reset`: o `POST /sign-up/email` devolve `closery_invite=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax` junto do cookie de sessão (com `Secure` em produção); cadastro recusado (403) não mexe no cookie. Nenhuma action nem tela muda |
| F6-9 | **Redefinição no Better Auth (Tarefa 4):** `emailAndPassword: { enabled: true, minPasswordLength: 8, revokeSessionsOnPasswordReset: true }` (continua **sem** `sendResetPassword`: o `POST /request-password-reset` segue respondendo `RESET_PASSWORD_DISABLED`); `verification: { storeIdentifier: { default: "plain", overrides: { "reset-password:": "hashed" } } }`, com o prefixo exportado como `RESET_PASSWORD_PREFIX` | Spike `reset`: o `POST /reset-password` só procura a `verification` com o identificador `reset-password:<token>` e o valor = userId; a exigência de `sendResetPassword` existe só no `/request-password-reset`. Com o override, `verification.identifier` guarda só o hash: vazamento do banco ou um log "Failed query … params" nunca expõe o token. As outras verificações (desafio de passkey, estado de OAuth) continuam `plain` |
| F6-10 | **Link de redefinição gerado pelo admin (D-F6-2, Tarefa 5):** `createPasswordResetLink(db, auth, { actor, userId, baseURL }, now)` em `src/features/admin/passwordReset.ts` (`server-only`). Ordem: (1) `actor.role !== "admin"` → `FORBIDDEN` (defesa em profundidade; a action já fez `requireAdmin()`); (2) `baseURL` não absoluta → **lança** (nunca grava link sem URL para mostrar); (3) pessoa inexistente → `NOT_FOUND`; desativada → `PERSON_INACTIVE` (código novo de `AdminErrorCode`); (4) apaga as `verification` com `value = userId` (só a redefinição guarda o userId cru em `value`; as outras guardam JSON); (5) grava `{ identifier: RESET_PASSWORD_PREFIX + token, value: userId, expiresAt: now + PASSWORD_RESET_TTL_MS }` pelo `(await auth.$context).internalAdapter.createVerificationValue` (respeita o hash). Token = `randomBytes(32).toString("base64url")` (43 caracteres). URL = `${new URL(baseURL).origin}/redefinir-senha#token=<token>`. **`PASSWORD_RESET_TTL_MS = 24 h`**. Link novo derruba o anterior; links de pessoas diferentes são independentes. Quem só tem passkey ganha uma conta `credential` na redefinição. **Desativada depois de gerar: o link deixa de valer.** O `setPersonActive` (`src/features/admin/people.ts`), no ramo da desativação, logo depois de apagar as sessões e **na mesma transação**, apaga também as `verification` com `value = userId` (mesma regra do item 4: só a redefinição guarda o userId cru em `value`); assim, reativar a conta dentro das 24 h não ressuscita um link que já circulava no WhatsApp (se um link sobrevivesse, p. ex. por um `UPDATE` cru em `deactivatedAt`, o login continuaria 403: defesa em profundidade, com caso próprio). O reset responde `INVALID_TOKEN`, `deactivatedAt` continua preenchido e o login segue 403 `ACCOUNT_DEACTIVATED`. Admin pode gerar para si e para outro admin. **Nova (desvio do spike):** apagar **antes** de criar (o spike criava e depois apagava os outros): a criação passa pelo adapter do Better Auth, que não entra numa transação nossa, então a ordem é a que falha fechado (se a criação falhar, a pessoa fica sem link e o admin gera outro; nunca ficam dois links válidos). Exceção documentada à regra de `db.transaction()` (comentário no código e ADR) | Spike `reset` (17 casos com o `auth.handler` real: nova senha entra, antiga 401, sessões revogadas, vencido/inexistente/reusado `INVALID_TOKEN`, 7 caracteres `PASSWORD_TOO_SHORT` com o link ainda valendo). 24 h e não 1 h (padrão do e-mail no Better Auth): o link vai por WhatsApp e pode ser lido em outro turno. Mitigações: uso único, link novo derruba o anterior, desativar derruba o link, sessões revogadas, hash no banco, token no fragmento. Risco residual (link no histórico do WhatsApp por até 24 h) no ADR; 8 h é uma constante só. Acoplado ao formato interno do Better Auth: o teste com PGlite faz o reset real e é o guarda contra mudança de versão |
| F6-11 | **Telas da redefinição (Tarefa 5):** `src/app/(auth)/redefinir-senha/page.tsx` estática (`metadata` `Redefinir senha`, nada de `searchParams`) com o cliente `ResetPasswordForm`: lê o fragmento uma vez num `useEffect` (`/^#token=([A-Za-z0-9_-]{16,256})$/`), guarda o token no estado e apaga o fragmento com `history.replaceState(null, "", pathname + search)`; em StrictMode o segundo efeito não acha o fragmento e não zera o token; chama `authClient.resetPassword({ newPassword, token })`; não entra sozinho (as sessões foram revogadas). `"/redefinir-senha"` entra em `PUBLIC_PATH_PREFIXES` (sem isso o proxy manda para `/entrar`). Na Equipe, `PasswordResetLinkButton` ("Nova senha") nas pessoas **ativas** e **também na linha da própria conta**: um clique gera o link e abre um diálogo com o link, a validade, `Copiar link` e `Compartilhar` (se `navigator.share` existir), pelo hook `useShareLink` extraído do `InviteLinkCard` no commit A. Fechar o diálogo descarta o link (aparece uma vez só). O `/entrar` ganha `Esqueceu a senha? Peça ao administrador um link para criar outra.` | Spike `reset`. O token no fragmento nunca chega ao servidor: fica fora do log da Vercel e do `Referer`. **Nova:** a linha própria ganha o botão (o spike não tocava nela; hoje ela não tem botão nenhum, porque os outros sempre falhariam): sem e-mail, o admin que esqueceu a senha e ainda tem sessão por passkey se recupera sozinho, e a Parte B (B9) faz o autoteste do link em produção na própria conta. **Nova:** `Compartilhar`, porque D-F6-2 diz "compartilhado como o convite", que tem esse botão; extrair antes (refatoração) evita a segunda cópia da lógica de copiar/compartilhar. O rótulo do envio é `Trocar a senha` (o spike usava "Salvar senha", que a regra de rótulos proíbe) |
| F6-12 | **Sentry: instalação e opções (Tarefa 6):** `@sentry/nextjs` `11.18.0` exato. Uma variável só, `NEXT_PUBLIC_SENTRY_DSN` (público por natureza; gravado no build: trocar o DSN exige novo deploy). `sentryOptions(overrides)` em `src/lib/sentry/options.ts`: `dsn`, `enabled: Boolean(SENTRY_DSN)`, `environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV`, `tracesSampleRate: 0`, `maxBreadcrumbs: 0`, **sem** Replay, `dataCollection` todo desligado (`userInfo`, `cookies`, `httpHeaders`, `urlQueryParams`, `databaseQueryData`, `queues`, `stackFrameVariables` `false`; `httpBodies: []`; `graphQL: { document: false, variables: false }`, `genAI: { inputs: false, outputs: false }`, `mcp: { inputs: false, outputs: false }`), `beforeSend: scrubEvent`. `src/instrumentation.ts`: `register()` inicia só com `NEXT_RUNTIME === "nodejs"` (o `proxy.ts` do Next 16 roda em Node); `export const onRequestError = Sentry.captureRequestError`. `src/instrumentation-client.ts`: `Sentry.init(sentryOptions({ integrations: (defaults) => defaults.filter((integration) => integration.name !== "BrowserSession") }))` (a `browserSessionIntegration` padrão manda um envelope de sessão ao `sentry.io` a cada carga de página, mesmo sem erro, levando IP e navegador: contra a minimização e contra o texto de `/privacidade`; o nome da integração se confirma em `node_modules` na execução) e `export const onRouterTransitionStart = Sentry.captureRouterTransitionStart` (inerte com `tracesSampleRate: 0`). `next.config.ts`: `export default withSentryConfig(nextConfig, { silent: true, telemetry: false, sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN } })`, importado de `"@sentry/nextjs/config"`. **Sem `tunnelRoute`** | Spike `sentry`. Pegadinhas da v11: `withSentryConfig` saiu do pacote raiz; `sendDefaultPii` **não existe** mais e o padrão de `dataCollection` coleta tudo; `tunnelRoute` está obsoleto (e criaria rota); o plugin liga `experimental.clientTraceMetadata` sozinho e não envia nada sem token; o Turbopack não embrulha rotas nem o proxy (os erros chegam pelo `onRequestError`). Sem token há 0 arquivos `.map` em `.next/static` (o Turbopack escreve cerca de 360 `.map` de servidor em `.next/server`, que não vão para o navegador). Rotas do build iguais às de antes. Custo medido: +67 KB gzip de JS no cliente (+11%) mesmo desligado (P68). D-F6-5 (sem DSN nada é enviado, como os provedores sociais) |
| F6-13 | **Pontos de captura:** (a) erro **tratado** → `logServerError` (Tarefa 6 acrescenta `Sentry.captureException(error, { tags: { context } })` depois da linha de log, dentro de `try/catch` para o log nunca lançar, e **pula** a captura quando o erro é `null`/`undefined` (o aviso de IP do Better Auth não tem erro) ou tem `digest`: esse erro veio da renderização do servidor, que já o reportou pelo `onRequestError`, e a cópia do cliente só tem a mensagem genérica); (b) erro **lançado** no servidor (Server Component, Server Action, Route Handler, proxy) → `onRequestError`; (c) limites de erro (`src/app/error.tsx`, `src/app/(app)/error.tsx`, `src/app/global-error.tsx`) → `logServerError(error, "error-boundary" \| "global-error")`. Nenhum outro arquivo chama `Sentry.*` (guarda) | **Nova** (o spike chamava `Sentry.captureException` direto no `global-error` e deixava o `error.tsx` só com `console.error`). Um ponto só para erro tratado: o que não for logado não vai ao Sentry, e o que for logado vai limpo. Sem o pulo do `digest`, cada erro de renderização contaria duas vezes na cota de 5 mil por mês |
| F6-14 | **`scrubEvent` (beforeSend, puro, sem import de runtime):** apaga `user`, `request` inteiro (URL, query, cookies, cabeçalhos, corpo), `server_name`, `breadcrumbs`, `extra`, `logentry` (message, formatted, params), as `vars` de cada frame (mantém os frames, com `filename`, `abs_path` e `module` higienizados pelo `scrubText`: um script embutido do navegador carrega a URL da página, com `?query`, `/convite/<token>` ou `#token=`), **força** `sdk.settings.infer_ip = "never"` (o `BrowserClient` do `@sentry/browser` 11.18 grava `infer_ip` e o core mescla essa metadata de volta depois do `beforeSend`: apagar a chave não muda o envelope, e sem ela o Relay inferiria o IP; a segunda camada é a opção "Prevent Storing of IP Addresses" do projeto, B3), o `mechanism.data` de cada exceção, todos os `contexts` exceto `trace`, as tags cuja chave contém `url` e, nas demais tags, o valor passa pelo `scrubText`; **não muta o evento original** (a cópia é rasa, então `sdk` é refeito: `if (scrubbed.sdk) { const { settings: _settings, ...sdk } = scrubbed.sdk; scrubbed.sdk = { ...sdk, settings: { infer_ip: "never" } }; }`, nunca `delete scrubbed.sdk.settings`, que mudaria o objeto do original; o mesmo vale para `exception.values`, `mechanism` e frames). `scrubText`, aplicado a `message`, `transaction`, ao `value` de **toda** exceção (inclusive as causas que o `linkedErrors` junta), ao `filename`/`abs_path`/`module` de cada frame e ao valor de cada tag, nesta ordem: (1) `Failed query:` até o fim do texto → `Failed query: [removido]` (o SQL e os `params` do Drizzle **nunca** saem); (2) `params:` até o fim → `params: [removido]` (mensagem reembrulhada); (3) `invalid input (syntax\|value) for (type\|enum) <nome>: "…"` → o valor entre aspas vira `[removido]`; (4) `/(convite\|redefinir-senha)/<segmento>` → `/$1/[removido]`; (5) `#token=…` → `#token=[removido]`; (6) query string (`?…`) removida; (7) e-mail → `[removido]` | Spike `sentry` (7 casos + prova com DSN falso e transporte falso: o envelope não tem e-mail, IP, token, senha nem breadcrumb). **Nova:** as regras (1), (2), (3) e (5): o spike só limpava e-mail, token de caminho e query, e uma mensagem `Failed query … params: ana@…` sairia inteira; o token da redefinição vai no fragmento, que o SDK do navegador poria em `request.url` (apagado) e em mensagem. O que escapa desses padrões fica como P69 |
| F6-15 | **`global-error.tsx`** (Tarefa 6): cliente; `<html lang="pt-BR"><body className="flex min-h-full flex-col">` próprios; importa `./globals.css` (o layout não está ativo); `<title>Algo deu errado</title>` (sem `metadata` em limite de erro); `<main>` com `Algo deu errado` e o `Button` do shadcn `Tentar de novo` (`retry()`, nome no Next 16.4); `useEffect` → `logServerError(error, "global-error")`; nunca mostra a mensagem do erro | Spike `sentry` (compila no React Compiler: `bun scripts/rc-check.mjs src/app/global-error.tsx`). `error.md`: o `global-error` substitui o layout raiz e precisa do próprio documento. **Nova:** `Button` do shadcn em vez do `<button>` nativo do spike (reuso do primitivo) e o `<title>`. Teste verificado no planejamento: no jsdom o React 19 renderiza `<html>`/`<body>` nos singletons do `document`, o efeito roda e o clique funciona, com um único aviso `In HTML, %s cannot be a child of <%s>` no console |
| F6-16 | **Alvos de toque (P12, Tarefa 7):** link solto (sozinho numa linha ou célula, não dentro de frase) ganha `max-md:inline-flex max-md:min-h-11 max-md:items-center` (e `max-md:min-w-11` quando o conteúdo é curto; `max-md:justify-end` quando o número é alinhado à direita); a classe do desktop não muda. Correções: `kokonutui/spending-ring.tsx` (`TOTAL_LINK`, 8,6×44 → `max-md:min-w-11 max-md:justify-end`), `dashboard/DashboardStock.tsx` (link da última contagem, 80×32), `solicitacoes/RequestDetail.tsx` (`Ver todas as solicitações`, 159×20) e `app-shell/Greeting.tsx` (`Ver o dashboard`, 120×21). Exceção justificada: o link esticado do `RequestCard` (`after:absolute after:inset-0`), cuja área é o cartão inteiro. Guarda permanente `e2e/touch-targets.spec.ts` (viewport 390×844, `hasTouch`): mede todo controle visível depois de **500 ms** (diálogo e menu em animação medem 43 px), ignora link `inline` dentro de frase e o link esticado. **A isenção do link em frase é estrita (desvio do spike):** `const block = el.closest("p, li, label"); if (el.tagName === "A" && style.display === "inline" && block !== null && (block.textContent ?? "").trim() !== (el.textContent ?? "").trim()) continue;` (o spike comparava `closest(...)?.textContent !== el.textContent`, que vale `undefined !== texto`, isto é, `true`, quando não há ancestral `p`/`li`/`label`: qualquer `<a>` `inline` dentro de `div`, `td`, `span` ou `header` ficava isento, e mover "Ver o dashboard" para um `<div>` passaria). Antes das correções, o passo vermelho **re-mede todas as telas com esta regra** e anota qualquer achado novo (por exemplo um link em `td` ou `div`), corrigindo-o ou justificando-o. P12 fecha pelo guarda: os primitivos citados nela (`SidebarMenuButton` `sm`/ícone, `InputGroup`, `SidebarInput`) não aparecem em nenhuma tela, e o guarda reprova se um deles aparecer | Spike `mobile`: 36 telas e estados, 315 controles; 7 achados, todos em componentes nossos; depois das 4 correções, 0. Com as 4 correções revertidas o guarda falha com `a "Ver o dashboard" 120x21`. Os testes de classe de `ui/` só cobrem primitivos e não pegariam nenhum dos 7 |
| F6-17 | **`/privacidade` (Tarefa 8):** página pública estática em `src/app/privacidade/page.tsx` (fora de `(app)` e `(auth)`; `metadata` `Privacidade`), com o texto em `src/features/privacy/privacyContent.ts` (`PRIVACY_DRAFT`, `PRIVACY_UPDATED_AT`, `PRIVACY_INTRO`, `PRIVACY_SECTIONS`). Enquanto `PRIVACY_DRAFT` for `true` a página mostra o alerta `Rascunho aguardando aprovação`; o dono aprova o texto no PR (C6-5) e a troca para `false` é um PR curto depois da aprovação da empresa (Parte B, B12). `"/privacidade"` entra em `PUBLIC_PATH_PREFIXES`. `PrivacyLink` (`Privacidade e seus dados`) no rodapé do `/entrar`, no `CardFooter` do convite válido e em `/conta`. O `PasskeyOffer` diz que a passkey é a forma mais rápida e que a recuperação é pelo admin | Spike `mobile` (6 casos da página, 2 do link; `/privacidade` sai `○ Static`). C6-5. **Nova:** o item do IP diz que o IP **e o navegador** de cada acesso ficam guardados (a tabela `session` guarda IP e user agent; o texto do spike citava só o limite de tentativas). **Revisão (R6):** o texto não promete mais do que a configuração garante: só as funções ficam em `gru1` (a Vercel guarda por 1 h registros técnicos de acesso no Hobby); o Sentry "limpa antes do envio" (o `scrubEvent` só remove padrões conhecidos, P69) e fica fora do Brasil com o endereço de rede descartado; quem vê inclui "o responsável pelo sistema (o dono do produto)", que pode não ser funcionário da empresa; e a cópia diária do resumo das passagens (B15) tem item próprio. As afirmações de região dependem de `gru1` e do projeto novo em `sa-east-1` |
| F6-18 | **Smoke test (Tarefa 10):** `scripts/smoke.mjs <origem> [--local]` (CLI, sem credencial, só `GET` com `redirect: "manual"`) e as regras puras em `scripts/smokeChecks.mjs` (JSDoc, testadas por `test/smokeChecks.test.ts`; o `tsconfig` tem `allowJs`). Dez verificações em ordem fixa (`health`, `region`, `hsts`, `security-headers`, `noindex`, `robots`, `no-referrer-convite`, `no-referrer-redefinir`, `redirect`, `privacy`); com `--local`, `region` e `hsts` ficam `PULADO`. Código de saída 0 só sem `FALHOU`. `http://` só para `localhost`/`127.0.0.1`. Script `bun run smoke` no `package.json` | Síntese §5 passo 6. Na Tarefa 10 o CLI roda de verdade contra o `next start` local (3201, banco inacessível): 7 OK, 1 FALHOU (`/api/health` 503), 2 PULADO, código 1. `x-vercel-id` lido como `<borda>::<função>::<id>` (a região da função é o penúltimo segmento; formato confirmado só no primeiro deploy, P63: o smoke imprime o valor cru quando falha) |
| F6-19 | **Runbook** `.context/runbook-producao.md` (Tarefa 10): o passo a passo da Parte B com os comandos exatos, quem faz e onde o dono confirma; regras que nunca mudam (a URL de produção só no Git Bash que o **Dono** abre fora da sessão do agente e fecha no fim, lida com `read -rs` para não ir ao histórico; o controlador dita os comandos e nunca os roda nem recebe a saída do `openssl` ou do `admin:invite` com sucesso; nunca `BETTER_AUTH_SECRETS`; nunca "Reset from parent" levando dado real para dev; nenhuma passagem de teste em produção); rollback e rotação de segredos | C6-3, C6-7, síntese G-F, G-G, G-H |
| F6-20 | **Pendências:** P16 e P22 fecham na Tarefa 4, P12 na 7 (cada uma com o caso no `pendenciasDoc.test.ts`); P8 continua `Bloqueado no dono` (e-mail exige domínio próprio, D-F6-1) com `Atualização` na Tarefa 5; P7 com `Atualização` na 8 (a página de privacidade que a Meta pede existe; falta a de exclusão de dados e o app publicado); P1, P6 e P10 com `Atualização` na 10; novas P62–P76 na 10 (lista no Contrato, Tarefa 10) | AGENTS.md: pendência fechada muda de seção na tarefa que a fecha, nunca é apagada |
| F6-21 | **Conflitos entre os spikes** (editaram os mesmos arquivos a partir da mesma `main`): ver a tabela "Quem é dono de cada mudança" logo abaixo | Os quatro spikes foram feitos em clones separados |
| F6-22 | **Casts dos spikes que saem:** `logServerError.test.ts` (`spy.mock.calls[0]?.[0] as string` → `String(spy.mock.calls[0]?.[0])`); `logServerError.ts` (`(value as Record<string, unknown>)[key]` → `Reflect.get(value, key)` depois do `typeof`); `hardening.test.ts` (`auth.options as { advanced?: … }` → `auth.options.advanced?.ipAddress?.ipAddressHeaders`, tipado pelo próprio objeto de opções); `passwordReset.test.ts` (`(await res.json()) as { code?: string }` → `errorCode(res)` com guarda de tipo: `const body: unknown = await res.json(); return typeof body === "object" && body !== null && "code" in body && typeof body.code === "string" ? body.code : undefined`); `scrubEvent.test.ts` (`{ … } as ErrorEvent` → objetos anotados `const event: ErrorEvent = { type: undefined, … }`); `options.test.ts` (`envelope as unknown as Envelope` → o transporte falso guarda `JSON.stringify(envelope)` e o teste afirma sobre o texto e sobre `JSON.parse` com guarda de tipo) | Global Constraints (sem `as` em código e em teste) |
| F6-23 | **Arquivos dos testes de configuração:** `test/vercelConfig.test.ts` (o spike o pôs em `src/`; lê `vercel.json`, `package.json` e `.github/workflows/ci.yml` pelo caminho relativo à raiz, como `pendenciasDoc.test.ts`); `src/app/robots.test.ts` separado do `nextConfig.test.ts` (o spike juntava os dois); `src/app/api/health/route.test.ts` novo (a rota não tinha teste) | Um arquivo por assunto |

### Quem é dono de cada mudança (F6-21)

| Arquivo | Tarefa e mudança (conteúdo final) |
|---|---|
| `next.config.ts` | **T1:** `securityHeaders` e `noReferrer` (consts locais) e `headers()` → `[{ source: "/:path*", headers: securityHeaders }, { source: "/convite/:path*", headers: noReferrer }]` (spike `config`). **T5:** acrescenta `{ source: "/redefinir-senha/:path*", headers: noReferrer }` no fim (a forma `:path*` do spike `config`; o `source: "/redefinir-senha"` exato do spike `reset` **não** entra). **T6:** `import { withSentryConfig } from "@sentry/nextjs/config"` e o `export default withSentryConfig(…)` (spike `sentry`) |
| `src/app/nextConfig.test.ts` | **T1:** reescrito como no spike `config`, mas só com `/convite/:path*` no caso do `no-referrer` e na ordem (`["/:path*", "/convite/:path*"]`) e sem o `describe("robots")` (vai para `robots.test.ts`). **T5:** os dois casos passam a incluir `/redefinir-senha/:path*`. **T6:** não muda (o spike provou que o `withSentryConfig` mantém `headers()`, `cacheComponents` e `reactCompiler`) |
| `src/features/authz/proxyRules.ts` (+ teste) | **T5:** `["/entrar", "/convite", "/redefinir-senha"]`. **T8:** `["/entrar", "/convite", "/redefinir-senha", "/privacidade"]`. Cada tarefa troca a igualdade do teste e acrescenta os casos público (`/redefinir-senha`, `/privacidade`) e não público (`/redefinir-senhas`, `/privacidades`) |
| `src/components/auth/SignInPanel.tsx` (+ teste) | **T5:** `<CardFooter className="flex flex-col items-start gap-1">` com dois parágrafos, nesta ordem: `O acesso é só por convite.` (inalterado: o teste de unidade e o `e2e/auth.spec.ts:103` continuam iguais) e `Esqueceu a senha? Peça ao administrador um link para criar outra.`. **T8:** acrescenta `<PrivacyLink />` depois deles. O parágrafo único do spike `mobile` **não** entra |
| `src/lib/auth/errors.ts` (+ `errorCodesContract.test.ts`) | **T5:** só `INVALID_TOKEN` (spike `reset`) |
| `src/lib/auth/createAuth.ts` | **T4** inteira: `revokeSessionsOnPasswordReset`, `verification.storeIdentifier`, `advanced.ipAddress`, o `setCookie` do P16 e o `RESET_PASSWORD_PREFIX` exportado, com o comentário final (o spike `reset` fez tudo junto com a feature). **T5** não toca o arquivo |
| `src/app/error.tsx`, `src/app/(app)/error.tsx` (+ testes) | **T2:** `logServerError(error, "error-boundary")` no lugar de `console.error(error)` (spike `config`). **T6** não toca (a captura mora dentro do `logServerError`) |
| `src/app/global-error.tsx` | **T6** (novo; spike `sentry` com as mudanças da F6-13 e da F6-15) |
| `src/lib/logServerError.ts` (+ teste) | **T2** cria (spike `config`, com o `Reflect.get`). **T6** acrescenta a captura (F6-13) |
| `package.json` | **T1:** `engines.node`. **T3:** script `db:hosts`. **T6:** `@sentry/nextjs` `11.18.0` (com `bun.lock`). **T10:** script `smoke` |
| `e2e/touch-targets.spec.ts` | **T7** cria (spike `mobile`, mais o teste do admin e `/redefinir-senha`). **T8** acrescenta `/privacidade` |
| `.env.example` | **T1:** o comentário "em cada Preview da Vercel" passa a dizer que os previews estão desligados. **T6:** `NEXT_PUBLIC_SENTRY_DSN=""` com o comentário |

### Fluxo do link de redefinição (referência)

1. Admin em `/admin/equipe` → `Nova senha` na pessoa → `createPasswordResetLinkAction({ userId })` → `requireAdmin()` → `runAdminAction` (Zod `createPasswordResetLinkSchema`) → `createPasswordResetLink(db, auth, { actor, userId, baseURL: authEnv.baseURL }, now)`.
2. O diálogo mostra `https://<origem>/redefinir-senha#token=<43 caracteres>` e a validade; o admin copia ou compartilha (WhatsApp).
3. A pessoa abre o link → `/redefinir-senha` (pública, estática, `Referrer-Policy: no-referrer`) → `ResetPasswordForm` tira o token do fragmento e apaga o fragmento → digita a senha nova → `authClient.resetPassword` → `POST /api/auth/reset-password` (Better Auth, rate limit padrão) acha a `verification` pelo hash, troca a senha (cria a conta `credential` se não houver), apaga a `verification` e revoga todas as sessões → `Senha alterada` → `Entrar`.

---

## Estrutura de arquivos

```
vercel.json                                              (criar)     F6-1                                                     [1]
package.json                                             (modificar) engines.node "22.x" [1]; "db:hosts" [3]; @sentry/nextjs 11.18.0 [6]; "smoke" [10]
bun.lock                                                 (modificar) @sentry/nextjs e dependências                                [6]
next.config.ts                                           (modificar) securityHeaders, noReferrer, headers() [1]; /redefinir-senha [5]; withSentryConfig [6]
src/app/nextConfig.test.ts                               (modificar) reescrito [1]; /redefinir-senha [5]                         [1, 5]
src/app/robots.ts                                        (criar)     Disallow /                                                   [1]
src/app/robots.test.ts                                   (criar)                                                                   [1]
src/app/layout.tsx                                       (modificar) metadata.robots                                              [1]
test/vercelConfig.test.ts                                (criar)     vercel.json, engines e o major do CI                          [1]
.github/workflows/ci.yml                                 (modificar) só o comentário do Node (engines "22.x")                      [1]
.env.example                                             (modificar) comentário dos previews [1]; NEXT_PUBLIC_SENTRY_DSN [6]       [1, 6]
.context/library-docs.md                                 (modificar) §1 cabeçalhos/robots/vercel.json [1]; §8 Better Auth [4, 5]; §10 guarda de toque [7]; §16 Sentry (nova) [6]
src/lib/logServerError.ts                                (criar)     summarizeError, logServerError [2]; captura no Sentry [6]    [2, 6]
src/lib/logServerError.test.ts                           (criar)     [2]; casos da captura [6]                                    [2, 6]
src/features/admin/runAction.ts                          (modificar) logServerError(error, "runAction")                           [2]
src/features/admin/runAction.test.ts                     (modificar) a linha do log sem o segredo e com o contexto                 [2]
src/app/api/health/route.ts                              (modificar) logServerError(error, "health")                              [2]
src/app/api/health/route.test.ts                         (criar)     200 com o banco; 503 e a linha do log sem detalhe              [2]
src/app/error.tsx                                        (modificar) logServerError(error, "error-boundary")                      [2]
src/app/error.test.tsx                                   (modificar) o console recebe só o resumo                                 [2]
src/app/(app)/error.tsx                                  (modificar) idem                                                         [2]
src/app/(app)/error.test.tsx                             (modificar) idem                                                         [2]
test/logGuard.test.ts                                    (criar)     console só no logServerError [2]; @sentry/nextjs só nos 5 arquivos [6]  [2, 6]
.context/code-standards.md                               (modificar) §6: erro inesperado só por logServerError                    [2]
src/db/databaseHost.ts                                   (criar)     databaseHostOf, formatDatabaseHosts (sem server-only)         [3]
src/db/databaseHost.test.ts                              (criar)                                                                   [3]
src/features/invites/adminInvite.ts                      (modificar) parseAdminInviteArgs com confirmHost, assertHostConfirmed, formatAdminInviteTarget, formatAdminInviteError  [3]
src/features/invites/adminInvite.test.ts                 (modificar) casos novos (inclusive formatAdminInviteError, 2); os literais de parseAdminInviteArgs ganham confirmHost: null  [3]
scripts/adminInvite.ts                                   (modificar) imprime o alvo e exige a confirmação antes do pool            [3]
scripts/dbHosts.ts                                       (criar)     bun run db:hosts                                             [3]
AGENTS.md                                                (modificar) tabela de comandos: admin:invite com --confirmar-host, db:hosts [3]; smoke [10]  [3, 10]
.context/architecture.md                                 (modificar) §4 e §7 primeiro admin [3]; §7 e §9 redefinição [5]; §2 Sentry [6]; §8 e §9 privacidade [8]; §5, §9 e §10 (ADR) [10]
src/lib/auth/createAuth.ts                               (modificar) F6-7 (inclusive o logger), F6-8, F6-9 e RESET_PASSWORD_PREFIX [4]
src/lib/auth/hardening.test.ts                           (criar)     rate limit por IP, P16, hash do identificador, sessões revogadas [4]
src/lib/auth/ipUnknown.test.ts                           (criar)     P22 sem IP em produção (NODE_ENV/TEST em vi.hoisted) [4]
.context/pendencias.md                                   (modificar) P16, P22 → Resolvido [4]; P8 [5]; P12 → Resolvido [7]; P7 [8]; P1, P6, P10 e P62–P76 [10]
test/pendenciasDoc.test.ts                               (modificar) casos da Fase 6                                              [4, 5, 7, 10]
src/components/admin/team/useShareLink.ts                (criar)     copiar e compartilhar (commit A)                             [5]
src/components/admin/team/useShareLink.test.tsx          (criar)     (commit A)                                                   [5]
src/components/admin/team/InviteLinkCard.tsx             (modificar) usa useShareLink, sem mudar comportamento (commit A)          [5]
src/features/admin/people.ts                             (modificar) setPersonActive: ao desativar, apaga as verification do userId (F6-10)  [5]
src/features/admin/people.test.ts                        (modificar) caso: desativar derruba o link de redefinição  [5]
src/features/admin/passwordReset.ts                      (criar)     server-only: PASSWORD_RESET_TTL_MS, buildPasswordResetUrl, createPasswordResetLink  [5]
src/features/admin/passwordReset.test.ts                 (criar)     PGlite + auth.handler real                                    [5]
src/features/admin/result.ts                             (modificar) "PERSON_INACTIVE"                                            [5]
src/features/admin/result.test.ts                        (modificar) PERSON_INACTIVE: true no Record                              [5]
src/features/admin/messages.ts                           (modificar) PERSON_RESET_INACTIVE_MESSAGE, PASSWORD_RESET_FORBIDDEN_MESSAGE (+ messages.test.ts) [5]
src/features/admin/schemas.ts                            (modificar) createPasswordResetLinkSchema (+ schemas.test.ts)             [5]
src/app/(app)/admin/equipe/actions.ts                    (modificar) createPasswordResetLinkAction                                [5]
src/app/(app)/admin/equipe/passwordResetAction.test.ts   (criar)                                                                   [5]
src/app/(app)/admin/actionsInventory.test.ts             (modificar) o nome novo                                                  [5]
src/components/admin/team/PasswordResetLinkButton.tsx    (criar)     "use client"                                                 [5]
src/components/admin/team/PasswordResetLinkButton.test.tsx (criar)                                                                 [5]
src/components/admin/team/PersonRowActions.tsx           (modificar) "Nova senha" nas pessoas ativas (+ teste)                    [5]
src/components/admin/team/TeamAdmin.tsx                  (modificar) a linha própria ganha só "Nova senha" (+ teste)               [5]
src/components/auth/ResetPasswordForm.tsx                (criar)     "use client": takeTokenFromLocation, ResetPasswordForm        [5]
src/components/auth/ResetPasswordForm.test.tsx           (criar)                                                                   [5]
src/app/(auth)/redefinir-senha/page.tsx                  (criar)     estática, metadata "Redefinir senha"                          [5]
src/app/(auth)/redefinir-senha/page.test.tsx             (criar)                                                                   [5]
src/features/authz/proxyRules.ts                         (modificar) /redefinir-senha [5]; /privacidade [8]                        [5, 8]
src/features/authz/proxyRules.test.ts                    (modificar)                                                               [5, 8]
src/lib/auth/errors.ts                                   (modificar) INVALID_TOKEN (+ errors.test.ts)                              [5]
src/lib/auth/errorCodesContract.test.ts                  (modificar) INVALID_TOKEN em CORE_CODES                                  [5]
src/components/auth/SignInPanel.tsx                      (modificar) "Esqueceu a senha?" [5]; PrivacyLink [8]                     [5, 8]
src/components/auth/SignInPanel.test.tsx                 (modificar)                                                               [5, 8]
e2e/cadastros.spec.ts                                    (modificar) (e): a linha própria tem só o botão "Nova senha"              [5]
test/uiRegistryDoc.test.ts                               (modificar) cabeçalhos de ResetPasswordForm e PasswordResetLinkButton [5]; pasta privacy e PrivacyLink [8]  [5, 8]
.context/ui-registry.md                                  (modificar) useShareLink e InviteLinkCard [5A]; PasswordResetLinkButton, ResetPasswordForm, PersonRowActions, TeamAdmin, SignInPanel [5B]; AppError e GlobalError [6]; Greeting, DashboardStock, SpendingRing, RequestDetail [7]; PrivacyLink, SignInPanel, PasskeyOffer, InviteSignup (convite), conta [8]; AppError (log) [2]
src/lib/sentry/options.ts                                (criar)     SENTRY_DSN, sentryOptions                                    [6]
src/lib/sentry/options.test.ts                           (criar)     DSN falso + transporte falso; DrizzleQueryError com linkedErrors [6]
src/lib/sentry/scrubEvent.ts                             (criar)     REDACTED, scrubText, scrubEvent                              [6]
src/lib/sentry/scrubEvent.test.ts                        (criar)                                                                   [6]
src/instrumentation.ts                                   (criar)     register, onRequestError                                     [6]
src/instrumentation.test.ts                              (criar)     init só em nodejs; onRequestError                             [6]
src/instrumentation-client.ts                            (criar)     init + onRouterTransitionStart                               [6]
src/app/global-error.tsx                                 (criar)     "use client"                                                 [6]
src/app/global-error.test.tsx                            (criar)                                                                   [6]
playwright.config.ts                                     (modificar) NEXT_PUBLIC_SENTRY_DSN: "" e SENTRY_AUTH_TOKEN: "" no env do app [6]
src/components/kokonutui/spending-ring.tsx               (modificar) TOTAL_LINK (+ spending-ring.test.tsx)                         [7]
src/components/dashboard/DashboardStock.tsx              (modificar) link da última contagem (+ DashboardStock.test.tsx)           [7]
src/components/solicitacoes/RequestDetail.tsx            (modificar) "Ver todas as solicitações" (+ RequestDetail.test.tsx)        [7]
src/components/app-shell/Greeting.tsx                    (modificar) "Ver o dashboard" (+ Greeting.test.tsx)                       [7]
e2e/touch-targets.spec.ts                                (criar)     2 testes [7]; /privacidade [8]                               [7, 8]
.context/ui-rules.md                                     (modificar) §1.4 o padrão do link solto                                  [7]
src/features/privacy/privacyContent.ts                   (criar)     PRIVACY_DRAFT, PRIVACY_UPDATED_AT, PRIVACY_INTRO, PRIVACY_SECTIONS [8]
src/app/privacidade/page.tsx                             (criar)     pública e estática                                           [8]
src/app/privacidade/page.test.tsx                        (criar)                                                                   [8]
src/components/privacy/PrivacyLink.tsx                   (criar)                                                                   [8]
src/components/privacy/PrivacyLink.test.tsx              (criar)                                                                   [8]
src/app/(auth)/convite/[token]/page.tsx                  (modificar) CardFooter com PrivacyLink no convite válido                  [8]
src/app/(app)/conta/page.tsx                             (modificar) PrivacyLink depois de "Sair"                                 [8]
src/components/auth/PasskeyOffer.tsx                     (modificar) a descrição nova (+ PasskeyOffer.test.tsx)                    [8]
e2e/helpers.ts                                           (modificar) signUpOperator e signUpAdmin devolvem o e-mail                [9]
e2e/redefinir-senha.spec.ts                              (criar)     3 testes                                                     [9]
e2e/publico.spec.ts                                      (criar)     3 testes                                                     [9]
scripts/smokeChecks.mjs                                  (criar)     regras puras do smoke (JSDoc)                                [10]
scripts/smoke.mjs                                        (criar)     CLI do smoke                                                 [10]
test/smokeChecks.test.ts                                 (criar)                                                                   [10]
.context/runbook-producao.md                             (criar)     o passo a passo da Parte B                                   [10]
.context/progress-tracker.md                             (modificar) seção da Fase 6, próximo passo e histórico                    [10]
.context/build-plan.md                                   (modificar) Fase 6 🟡 (código pronto; go-live pendente)                   [10]
memory.md                                                (modificar) handoff: o que falta é a Parte B                              [10]
```

---

## Contrato de interfaces

Toda tarefa usa **exatamente** estes nomes e assinaturas. Uma tarefa que precise de algo fora daqui o declara no bloco **Interfaces → Produces** dela. Componentes de cliente importam dos módulos de domínio **só tipos**; nunca de módulo `server-only` (`features/admin/passwordReset.ts`).

### Dependências

Uma biblioteca nova: `@sentry/nextjs` `11.18.0` exato (Tarefa 6): `bun add --exact @sentry/nextjs@11.18.0` (cerca de 41 pacotes; `run_in_background` desde o início). Depois: `git status` mostra só `package.json` e `bun.lock`; `bun install --frozen-lockfile` passa. Primitivos shadcn usados, já presentes: `Button`, `buttonVariants`, `Card*`, `Dialog*`, `Input`, `Field*`, `Alert*`. Nenhum `shadcn add` nesta fase.

### Configuração de produção — Tarefa 1

```ts
// vercel.json — conteúdo exato (F6-1), 2 espaços:
// { "$schema": "https://openapi.vercel.sh/vercel.json", "regions": ["gru1"],
//   "installCommand": "bunx bun@1.3.3 install --frozen-lockfile", "buildCommand": "bun run build",
//   "git": { "deploymentEnabled": { "**": false, "main": true } } }

// package.json: "engines": { "node": "22.x" }

// next.config.ts (consts locais, não exportadas)
const securityHeaders: { key: string; value: string }[]; // os 6 da F6-3, nesta ordem
const noReferrer: { key: string; value: string }[];      // [{ key: "Referrer-Policy", value: "no-referrer" }]
// headers(): [{ source: "/:path*", headers: securityHeaders }, { source: "/convite/:path*", headers: noReferrer }]
// o resto do objeto (cacheComponents, partialPrefetching, reactCompiler, turbopack) não muda

// src/app/robots.ts (entry file)
export default function robots(): MetadataRoute.Robots; // { rules: { userAgent: "*", disallow: "/" } }

// src/app/layout.tsx — metadata ganha só: robots: { index: false, follow: false }
```
**Consome:** nada. **Produz:** `vercel.json`; `securityHeaders`/`noReferrer` (a T5 reusa `noReferrer`; a T6 embrulha o export).

### `logServerError` — Tarefa 2 (captura: Tarefa 6)

```ts
// src/lib/logServerError.ts (sem server-only; sem import de runtime na T2; @sentry/nextjs na T6)
export type ErrorSummary = { name: string; code: string | null; digest: string | null };
export function summarizeError(error: unknown): ErrorSummary;
// name: error instanceof Error ? (SAFE_NAME casa ? error.name : "Error") : "NonError"
// code: o primeiro que casar SAFE_CODE em error.code, error.cause.code, error.cause.cause.code (CAUSE_DEPTH = 3; ciclo não trava)
// digest: Reflect.get(error, "digest") se casar SAFE_DIGEST; senão null
export function logServerError(error: unknown, context: string): void;
// T2: console.error(JSON.stringify({ level: "error", context: context.slice(0, 80), ...summarizeError(error) })) — um argumento só
// T6: depois da linha, se error != null && summarizeError(error).digest === null: try { Sentry.captureException(error, { tags: { context } }) } catch {}
// Chamadas: runAction.ts (catch, depois de unstable_rethrow) → "runAction"; api/health/route.ts (catch) → "health";
//           error.tsx e (app)/error.tsx (useEffect) → "error-boundary"; global-error.tsx (T6) → "global-error";
//           createAuth.ts logger (T4) → "better-auth" (o Error dos argumentos ou null) e "better-auth:ip-desconhecido" (null)
```
`test/logGuard.test.ts` (usa `listSourceFiles` e `stripComments` de `test/actionGuards.ts`): em `src/**/*.{ts,tsx}` fora de `*.test.*`, `console.` só aparece em `src/lib/logServerError.ts`; na T6 acrescenta que `from "@sentry/nextjs"` só aparece em `src/lib/sentry/options.ts`, `src/lib/sentry/scrubEvent.ts` (só `import type`), `src/instrumentation.ts`, `src/instrumentation-client.ts` e `src/lib/logServerError.ts`.
**Consome:** nada. **Produz:** `logServerError`, `summarizeError` (a T6 os consome).

### Trava de host — Tarefa 3

```ts
// src/db/databaseHost.ts (sem server-only: scripts importam)
export function databaseHostOf(connectionString: string): string;
// new URL(connectionString).hostname.toLowerCase(); vazio ou URL inválida → throw new Error("DATABASE_URL não é uma URL de conexão válida.") (nunca repete a string: ela tem a senha)
export function formatDatabaseHosts(urls: DatabaseUrls): string; // DatabaseUrls de "@/db/databaseUrl"
// duas linhas (Textos); cada uma: o host, "ausente" (undefined) ou "inválida" (databaseHostOf lançou)

// src/features/invites/adminInvite.ts (o que já existe continua; ADMIN_INVITE_LABEL_MAX_LENGTH = 80)
export type AdminInviteArgs = { label: string | null; confirmHost: string | null };
export function parseAdminInviteArgs(argv: string[]): AdminInviteArgs;
// --label e --confirmar-host, cada um como "--flag valor" ou "--flag=valor"; aparado; vazio → null;
// sem valor → "Falta o valor de <flag>. <USAGE>"; repetido → "<flag> foi informado mais de uma vez. <USAGE>";
// outro argumento → "Argumento desconhecido: <arg>. <USAGE>"; label > 80 → "--label aceita no máximo 80 caracteres."
export function assertHostConfirmed(databaseHost: string, confirmHost: string | null): void; // mensagens em Textos
export function formatAdminInviteTarget(input: { databaseHost: string; baseURL: string }): string;
export function formatAdminInviteError(error: unknown): string;
// `Erro: ${message}` só quando Object.getPrototypeOf(error) === Error.prototype (os erros do próprio script); qualquer outro (o DrizzleQueryError carrega o SQL e os params, com o hash do token)
//   → `Erro: falha inesperada ao gravar o convite (<constructor.name>[, código <code>]). Confira no banco se o convite foi criado antes de rodar de novo.`;
//   <code> = `code` do erro ou de `cause`, lido com Reflect.get e só se casar /^[A-Za-z0-9_]{1,32}$/; sem importar logServerError (na T6 aquele módulo carrega o @sentry/nextjs)

// scripts/adminInvite.ts — ordem: loadEnvConfig → parseAdminInviteArgs → BETTER_AUTH_URL (erro de hoje) → runtime URL (erro de hoje)
//   → databaseHost = databaseHostOf(url) → console.log(formatAdminInviteTarget(…)) → assertHostConfirmed(…) → só então createPool/createAdminInvite
//   → o catch do main imprime console.error(formatAdminInviteError(error)) e define process.exitCode = 1
// scripts/dbHosts.ts — loadEnvConfig(process.cwd()); console.log(formatDatabaseHosts(resolveDatabaseUrls(process.env)))
// package.json: "db:hosts": "bun scripts/dbHosts.ts"
```
**Consome:** `resolveDatabaseUrls`. **Produz:** `databaseHostOf`, `formatDatabaseHosts` (o runbook da T10 usa o `db:hosts`).

### Better Auth endurecido — Tarefa 4

```ts
// src/lib/auth/createAuth.ts
export const RESET_PASSWORD_PREFIX = "reset-password:"; // o identificador que o /reset-password do Better Auth monta
// betterAuth({ …
//   emailAndPassword: { enabled: true, minPasswordLength: 8, revokeSessionsOnPasswordReset: true },   // sem sendResetPassword
//   verification: { storeIdentifier: { default: "plain", overrides: { [RESET_PASSWORD_PREFIX]: "hashed" } } },
//   advanced: { ipAddress: { ipAddressHeaders: ["x-forwarded-for"] } },
//   databaseHooks.user.create.after: depois de recordInviteUser →
//     ctx?.setCookie(INVITE_COOKIE, "", { ...inviteCookieOptions(process.env.NODE_ENV === "production"), maxAge: 0 })
//   rateLimit: igual (30/60 sign-in, 10/60 sign-up, 100/10 padrão, storage "database", só em produção)
//   logger: { log: (level, message, ...args) => {
//     if (level === "error") logServerError(args.find((arg) => arg instanceof Error) ?? null, "better-auth");
//     else if (message.startsWith("Rate limiting could not determine a client IP")) logServerError(null, "better-auth:ip-desconhecido");
//   } }   // os outros avisos são descartados; o log padrão do Better Auth imprimia o erro cru com o SQL e os params
//   … })
// imports novos: inviteCookieOptions de "./inviteCookie"; logServerError de "@/lib/logServerError"
```
`src/lib/auth/hardening.test.ts`: `productionAuth()` cria o auth com `vi.stubEnv("NODE_ENV", "production")` e desfaz logo depois (`vi.unstubAllEnvs()` no `finally`); `post(auth, path, body, headers)` faz `auth.handler(new Request(\`${TEST_AUTH_ENV.baseURL}/api/auth${path}\`, { method: "POST", headers: { "content-type": "application/json", origin: TEST_AUTH_ENV.baseURL, ...headers }, body }))`.
**Consome:** `INVITE_COOKIE`, `inviteCookieOptions`. **Produz:** `RESET_PASSWORD_PREFIX` e a configuração (a T5 depende do hash e da revogação).

### Link de redefinição — Tarefa 5

```ts
// src/components/admin/team/useShareLink.ts — commit A (refatoração)
export function useShareLink(input: { url: string; shareTitle: string; shareText: string }): {
  canShare: boolean;             // false no servidor e antes de montar; typeof navigator.share === "function" depois (useEffect)
  copy: () => Promise<void>;     // navigator.clipboard.writeText(url) → toast.success("Link copiado."); falha → toast.error("Não foi possível copiar. Selecione o link e copie.")
  share: () => Promise<void>;    // navigator.share({ title, text, url }); AbortError (DOMException) silencioso; outra falha → copy()
};
// InviteLinkCard passa a usar useShareLink({ url, shareTitle: "Convite para o Closery", shareText: "Você foi convidado para o Closery." });
// o resto do cartão (foco no título, textos, "Gerar outro convite") igual; InviteLinkCard.test.tsx sem nenhuma edição

// src/features/admin/passwordReset.ts — commit B (server-only)
export const PASSWORD_RESET_TTL_MS = 24 * 60 * 60 * 1000;
export function buildPasswordResetUrl(baseURL: string, token: string): string;
// isHttpUrl(baseURL) (de @/features/invites/inviteUrl) senão throw new Error(`URL base inválida para a redefinição: "${baseURL}".`);
// `${new URL(baseURL).origin}/redefinir-senha#token=${token}`
export async function createPasswordResetLink(
  db: Db,
  auth: Pick<Auth, "$context">,
  input: { actor: Authz; userId: string; baseURL: string },
  now: Date,
): Promise<AdminResult<{ url: string; expiresAt: Date }>>;
// ordem da F6-10; fail("FORBIDDEN", PASSWORD_RESET_FORBIDDEN_MESSAGE); throw new Error(`BETTER_AUTH_URL não é uma URL absoluta: "${baseURL}".`);
// fail("NOT_FOUND", notFoundMessage("pessoa")); fail("PERSON_INACTIVE", PERSON_RESET_INACTIVE_MESSAGE);
// db.delete(verification).where(eq(verification.value, person.id)) ANTES de internalAdapter.createVerificationValue(…); ok({ url, expiresAt })

// src/features/admin/people.ts: setPersonActive, no ramo !input.active, logo depois de
//   await tx.delete(session).where(eq(session.userId, input.userId));  (mesma transação)
//   await tx.delete(verification).where(eq(verification.value, input.userId));  // import { session, user, verification } de "@/db/schema/auth"
//   (F6-10: só a redefinição guarda o userId cru em `value`)
// src/features/admin/result.ts: AdminErrorCode ganha "PERSON_INACTIVE"
// src/features/admin/messages.ts:
export const PERSON_RESET_INACTIVE_MESSAGE: string;     // Textos
export const PASSWORD_RESET_FORBIDDEN_MESSAGE: string;  // Textos
// src/features/admin/schemas.ts:
export const createPasswordResetLinkSchema = z.object({ userId: userIdSchema });
export type CreatePasswordResetLinkInput = z.infer<typeof createPasswordResetLinkSchema>;

// src/app/(app)/admin/equipe/actions.ts ("use server")
export async function createPasswordResetLinkAction(input: unknown): Promise<AdminResult<{ url: string; expiresAt: Date }>>;
// const actor = await requireAdmin(); return runAdminAction({ actor, schema: createPasswordResetLinkSchema, input,
//   run: ({ db, now, actor: current, input: data }) => createPasswordResetLink(db, auth, { actor: current, userId: data.userId, baseURL: authEnv.baseURL }, now) });
// import { auth, authEnv } from "@/lib/auth"

// src/components/admin/team/PasswordResetLinkButton.tsx ("use client")
export function PasswordResetLinkButton(props: { personId: string; personName: string }): JSX.Element;
// Button variant="outline" size="sm" disabled={pending} → run(() => createPasswordResetLinkAction({ userId })) (useAdminAction; o erro vira toast);
// ok → Dialog aberto com Input readOnly (seleciona ao focar), a validade (formatDateTimeBR), "Copiar link" e "Compartilhar" (useShareLink;
// shareTitle "Nova senha do Closery", shareText "Abra este link para criar uma senha nova no Closery."); onOpenChange(false) → link = null
// PersonRowActions: {person.active && <PasswordResetLinkButton personId={person.id} personName={person.name} />} entre "Editar" e "Desativar"
// TeamAdmin: actions={isSelf ? <PasswordResetLinkButton … /> : <PersonRowActions … />}; a nota "Peça a outro administrador…" continua

// src/components/auth/ResetPasswordForm.tsx ("use client")
export function takeTokenFromLocation(
  location: Pick<Location, "hash" | "pathname" | "search">,
  history: Pick<History, "replaceState">,
): string | null; // casa /^#token=([A-Za-z0-9_-]{16,256})$/ → replaceState(null, "", pathname + search) e devolve o token; senão null sem chamar replaceState
export function ResetPasswordForm(): JSX.Element;
// fases "reading" | "ready" | "missing" | "done"; erro: authErrorMessage(errorCodeOf(error)); exceção de rede: authErrorMessage(null);
// Input type="password" autoComplete="new-password" required minLength={8} maxLength={128}

// src/app/(auth)/redefinir-senha/page.tsx: export const metadata: Metadata = { title: "Redefinir senha" }; export default function Page() → <ResetPasswordForm />
// src/features/authz/proxyRules.ts: PUBLIC_PATH_PREFIXES = ["/entrar", "/convite", "/redefinir-senha"]
// next.config.ts: + { source: "/redefinir-senha/:path*", headers: noReferrer }
// src/lib/auth/errors.ts: AUTH_ERROR_MESSAGES.INVALID_TOKEN (Textos); errorCodesContract.test.ts: "INVALID_TOKEN" em CORE_CODES
```
`passwordReset.test.ts` (PGlite, `createTestAuth(db)`, `signUpWithInvite`, `insertInvite`, `insertSector`, `insertUser`; `insertSector(db, name?)` recebe o nome como 2º argumento): `link(userId, now)`, `http(path, body)` com o cabeçalho `origin` (o `auth.handler` exige), `resetWith(token, senha)`, `signIn(email, senha)`, `errorCode(res)` com guarda de tipo (F6-22). O `passwordResetAction.test.ts` segue o molde dos testes de action da Equipe (`vi.hoisted` com `client: null as PGlite | null`, mock de `@/lib/auth/session`, `next/cache`, `@/db` e `@/lib/auth` com `createTestAuth` e `TEST_AUTH_ENV`).
**Consome:** `RESET_PASSWORD_PREFIX` e a configuração da T4; `noReferrer` da T1; `runAdminAction`, `useAdminAction`, `formatDateTimeBR`, `isHttpUrl`, `notFoundMessage`, `authErrorMessage`, `errorCodeOf`. **Produz:** a rota `/redefinir-senha`, o botão "Nova senha" e o rótulo `Link para copiar` (a T7 e a T9 os usam).

### Sentry — Tarefa 6

```ts
// src/lib/sentry/options.ts
export const SENTRY_DSN: string | undefined; // = process.env.NEXT_PUBLIC_SENTRY_DSN
export function sentryOptions(overrides?: Partial<NodeOptions>): NodeOptions; // F6-12; `...overrides` por último
// src/lib/sentry/scrubEvent.ts (só `import type { ErrorEvent } from "@sentry/nextjs"`)
export const REDACTED = "[removido]";
export function scrubText(text: string): string;                 // as 7 regras da F6-14, nesta ordem
export function scrubEvent<T extends ErrorEvent>(event: T): T;   // cópia rasa; F6-14
// src/instrumentation.ts
export function register(): void;                                // if (process.env.NEXT_RUNTIME === "nodejs") Sentry.init(sentryOptions())
export const onRequestError: typeof Sentry.captureRequestError;  // = Sentry.captureRequestError
// src/instrumentation-client.ts: Sentry.init(sentryOptions({ integrations: (defaults) => defaults.filter((integration) => integration.name !== "BrowserSession") })); export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
// src/app/global-error.tsx ("use client"; entry file)
export default function GlobalError(props: { error: unknown; retry: () => void }): JSX.Element; // F6-15
// next.config.ts: export default withSentryConfig(nextConfig, { silent: true, telemetry: false, sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN } });
// playwright.config.ts (webServer "app", env): NEXT_PUBLIC_SENTRY_DSN: "", SENTRY_AUTH_TOKEN: ""
// .env.example: NEXT_PUBLIC_SENTRY_DSN="" com o comentário (Textos não se aplica: comentário livre em pt-BR; "deixe vazio em dev")
```
`options.test.ts`: `startSentry(dsn, integrations)` chama `Sentry.init(sentryOptions({ dsn, enabled: Boolean(dsn), defaultIntegrations: false, integrations, transport: () => ({ send: async (envelope) => { sent.push(JSON.stringify(envelope)); return { statusCode: 200 }; }, flush: async () => true }) }))`; `afterEach(() => Sentry.close())`. O caso do Drizzle usa `integrations: [Sentry.linkedErrorsIntegration()]` (export conferido na 11.18.0) e `new DrizzleQueryError("insert into \"user\" (\"email\") values ($1)", ["ana@exemplo.test"], causaDoPg)`.
**Consome:** `logServerError` (T2); `next.config.ts` (T1/T5). **Produz:** o envio para o Sentry quando houver DSN (Parte B).

### Alvos de toque — Tarefa 7

```ts
// classes finais (a do desktop fica igual; só acrescenta o que está depois do "+")
// Greeting.tsx, link "Ver o dashboard": "underline underline-offset-4 hover:text-foreground" + " max-md:inline-flex max-md:min-h-11 max-md:items-center"
// DashboardStock.tsx, link da última contagem: "w-fit text-2xl font-semibold tabular-nums underline-offset-4 hover:underline" + " max-md:inline-flex max-md:min-h-11 max-md:items-center"
// RequestDetail.tsx, "Ver todas as solicitações": "w-fit text-sm underline underline-offset-4" + " max-md:inline-flex max-md:min-h-11 max-md:items-center"
// spending-ring.tsx, TOTAL_LINK: "rounded-sm font-medium text-sm tabular-nums outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring max-md:inline-flex max-md:min-h-11 max-md:items-center" + " max-md:min-w-11 max-md:justify-end"
```
`e2e/touch-targets.spec.ts`: `test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })`; `MIN = 44`; `smallTargets(page)` (espera 500 ms; seletor `a, button, input, select, textarea, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=switch], [role=checkbox], [role=option], [role=combobox], [role=radio]`; ignora invisível, fora da tela, `aria-hidden`/`inert` fora de diálogo, classe com `after:inset-0` e **só** o link `inline` que está dentro de um `p`/`li`/`label` com mais texto que ele: `const block = el.closest("p, li, label"); if (el.tagName === "A" && style.display === "inline" && block !== null && (block.textContent ?? "").trim() !== (el.textContent ?? "").trim()) continue;` (sem ancestral `p`/`li`/`label` não há isenção, F6-16); devolve `"<tag> \"<rótulo até 40>\" <L>x<A>"`); `expectTouchSized(page, path)` (`goto`, `networkidle`, `expect(await smallTargets(page), \`${path} no celular\`).toEqual([])`). Usa `test`, `seedSector`, `signUpOperator`, `signUpAdmin`, `ago` de `./helpers` e `openE2eDb`, `insertUser`, `insertRequest`, `insertRequestItem` de `./db`.
**Consome:** o botão "Nova senha" e `/redefinir-senha` (T5). **Produz:** o guarda (a T8 acrescenta `/privacidade`).

### Privacidade — Tarefa 8

```ts
// src/features/privacy/privacyContent.ts (sem I/O)
export const PRIVACY_DRAFT: boolean = true;   // anotado como boolean (sem estreitar para o literal true)
export const PRIVACY_UPDATED_AT: string;      // a data do dia da execução por extenso, ex.: "25 de novembro de 2026"
export type PrivacySection = { id: string; title: string; paragraphs?: readonly string[]; items?: readonly string[] };
export const PRIVACY_INTRO: string;
export const PRIVACY_SECTIONS: readonly PrivacySection[]; // ids: "dados", "motivo", "quem-ve", "onde", "prazo", "direitos" (textos em Textos)
// src/app/privacidade/page.tsx: export const metadata: Metadata = { title: "Privacidade" }; Page estática:
//   <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 p-4 md:py-10"> "Closery", h1, Alert (se PRIVACY_DRAFT), intro,
//   uma <section aria-labelledby="privacidade-<id>"> com <h2 id=…> por seção (parágrafos e lista), "Última atualização: …", link "Voltar para a entrada" (/entrar, com o padrão do link solto)
// src/components/privacy/PrivacyLink.tsx
export function PrivacyLink(props: { className?: string }): JSX.Element;
// <Link href="/privacidade" className={cn("w-fit text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground max-md:inline-flex max-md:min-h-11 max-md:items-center", className)}>
// proxyRules: PUBLIC_PATH_PREFIXES = ["/entrar", "/convite", "/redefinir-senha", "/privacidade"]
// SignInPanel: <PrivacyLink /> no fim do CardFooter; convite válido: <CardFooter><PrivacyLink /></CardFooter>; /conta: <PrivacyLink /> depois de <SignOutButton />
// uiRegistryDoc.test.ts: privacyFiles = sourceFiles(join("src", "components", "privacy")) entra na varredura; "PrivacyLink" na lista de cabeçalhos próprios
```
**Consome:** `SignInPanel` da T5; `touch-targets.spec.ts` da T7. **Produz:** `/privacidade` (a T9 a testa).

### E2E — Tarefa 9

```ts
// e2e/helpers.ts — contrato que muda (nenhum chamador existente muda: todos ignoram o retorno)
export async function signUpOperator(page: Page, db: Db, sectorId: string, name: string): Promise<string>; // devolve o e-mail usado
export async function signUpAdmin(page: Page, db: Db, name: string): Promise<string>;                      // idem
```
Nomes dos testes (exatos): `e2e/redefinir-senha.spec.ts` — `(a) admin gera o link de nova senha e o operador troca a senha: a nova entra e a antiga não`, `(b) o link usado de novo diz que venceu ou já foi usado, e sem o fragmento diz Link incompleto`, `(c) trocar a senha pelo link encerra a sessão aberta em outro navegador`; `e2e/publico.spec.ts` — `(a) /privacidade abre sem sessão e é linkada de /entrar, do convite e de /conta`, `(b) cabeçalhos de segurança, noindex e sem Referer no convite e na redefinição`, `(c) /robots.txt bloqueia todos os buscadores`. O link sai do campo `Link para copiar`; cada teste usa o `clientIp` próprio do `test` de `./helpers`; o (b) da publico usa `request.get(path, { maxRedirects: 0 })`.
**Consome:** T1, T5, T8. **Produz:** a contagem 43.

### Smoke, runbook e pendências — Tarefa 10

```js
// scripts/smokeChecks.mjs (puro; tipos em JSDoc)
/** @typedef {"health"|"region"|"hsts"|"security-headers"|"noindex"|"robots"|"no-referrer-convite"|"no-referrer-redefinir"|"redirect"|"privacy"} SmokeId */
/** @typedef {{ id: SmokeId, label: string, status: "ok" | "falhou" | "pulado", detail: string | null }} SmokeResult */
/** @typedef {{ get(name: string): string | null }} HeaderBag */   // aceita um Headers
export const SMOKE_USAGE;                 // Textos
export const SMOKE_LABELS;                // Object.freeze({ [SmokeId]: label }) — Textos
export function parseSmokeArgs(argv);     // → { origin: string, local: boolean }; https qualquer host; http só localhost/127.0.0.1; caminho/query descartados (origin); sem URL, URL inválida, http fora do local ou argumento desconhecido → throw new Error(…) (Textos)
export function checkHealth(status, bodyText);           // ok: 200 e JSON { status: "ok", database: "ok" }; falhou: "status <n>" | "resposta inesperada"
export function functionRegionOf(xVercelId);             // "gru1::gru1::abc-1" → "gru1" (penúltimo segmento); null/vazio/menos de 2 segmentos → null
export function checkRegion(xVercelId, local);           // local → pulado; null → falhou "sem x-vercel-id"; ≠ "gru1" → falhou "região <r> (x-vercel-id: <valor>)"
export function checkHsts(headers, local);               // local → pulado; exige Strict-Transport-Security com max-age
export function checkSecurityHeaders(status, headers);   // 200 e os 6 valores exatos da F6-3; falhou: "falta <cabeçalho>" | "<cabeçalho>: <valor>" | "status <n>"
export function checkNoindex(headers, html);             // X-Robots-Tag "noindex, nofollow" e <meta name="robots" content="noindex, nofollow"
export function checkRobots(status, text);               // 200, "User-Agent: *" e "Disallow: /"
export function checkNoReferrer(id, headers);            // id "no-referrer-convite" | "no-referrer-redefinir"; Referrer-Policy "no-referrer"
export function checkRedirectToSignIn(status, location); // 307 e location termina em "/entrar"
export function checkPublicPage(status);                 // id "privacy"; 200
export function formatSmokeReport(results);              // → { text: string, exitCode: 0 | 1 }; linhas e resumo em Textos
// scripts/smoke.mjs — parseSmokeArgs(process.argv.slice(2)); GET (redirect: "manual", cache: "no-store", user-agent "closery-smoke") em:
//   /api/health (health, region), /entrar (hsts, security-headers, noindex), /robots.txt, /convite/smoke-token-inexistente, /redefinir-senha, / (redirect), /privacidade
//   falha de rede → as verificações daquela URL ficam "falhou" com "sem resposta"; imprime formatSmokeReport(…).text; process.exitCode = exitCode
// package.json: "smoke": "bun scripts/smoke.mjs"
```
**Pendências novas (Tarefa 10; P62 a P76)**, todas `Aberto, não triado`, `**Registrado em:**` = a data da execução, `**Correção:** —` salvo onde a nota diz a opção:

| Id | Título | Sev. | Arquivos | Impacto (resumo) |
|---|---|---|---|---|
| P62 | A `main` não tem proteção: push direto vira deploy sem CI | 🟠 | `.github/workflows/ci.yml` | com a integração Git da Vercel, todo push na `main` publica, inclusive sem CI; "PR só com CI verde" não é imposto (opção: proteção com os checks `Tipos, lint e testes` e `E2E (Playwright)`, passo B1) |
| P63 | Comportamento na Vercel só se confirma no primeiro deploy | 🟡 | `vercel.json` · `next.config.ts` · `src/lib/auth/createAuth.ts` · `src/lib/sentry/options.ts` | `gru1` e o formato do `x-vercel-id`, HSTS, `deploymentEnabled` ignorando branches, `bunx bun@1.3.3` na imagem, `engines` sobre o painel, IP do rate limit sem o aviso, envio real e flush do Sentry, passkey com a `Permissions-Policy` em navegador real, detalhe rápido com `next-url` (P44) (opção: B7 e B9) |
| P64 | Aprovação da empresa (LGPD) pendente e /privacidade em rascunho | 🟠 | `src/features/privacy/privacyContent.ts` | sem a autorização do controlador (a empresa) não se convida ninguém; retenção sem prazo; não existe "anonimizar" pessoa desligada (opção: B12; ação de anonimizar mantendo o id) |
| P65 | Riscos aceitos do Hobby e do Neon Free no piloto | 🟠 | — | termos "personal or non-commercial", logs de 1 h, rollback só para o deploy anterior, uma região; 100 CU-h por mês por projeto com suspensão ao acabar, restauração de 6 h (opção: rever no go/no-go) |
| P66 | Passkeys presas ao host *.vercel.app | 🟡 | `src/lib/auth/createAuth.ts` (`rpID`) | trocar para domínio próprio invalida todas as passkeys (senha e link do admin continuam); sem domínio não há e-mail (P8) nem Apple (P6) |
| P67 | Fechar a aba com o salvamento automático na fila perde o que não foi salvo | 🟡 | `src/components/passagens/useHandoverAutosave.ts` · `src/components/passagens/HandoverForm.tsx` | não há guarda `beforeunload`; sinal fraco no galpão é provável |
| P68 | Sentry sem source maps e com +67 KB gzip de JS no cliente | ⚪ | `next.config.ts` · `src/instrumentation-client.ts` | pilha minificada nos erros do navegador; o pacote pesa mesmo desligado |
| P69 | scrubEvent só limpa padrões conhecidos da mensagem de erro | 🟡 | `src/lib/sentry/scrubEvent.ts` | valor de pessoa fora dos 7 padrões sairia para o Sentry, fora do país (opção: revisar os eventos no primeiro mês) |
| P70 | Alvos de toque medidos só no Chromium emulado | ⚪ | `e2e/touch-targets.spec.ts` | iOS e Android reais, tema escuro e o contêiner do link esticado na Lista não foram medidos |
| P71 | Sem instalação como app (manifest e ícones) | ⚪ | `src/app/` | "Adicionar à tela inicial" cria atalho sem ícone; sem `themeColor` (opção: `manifest.ts` + ícones; testar passkey no app instalado do iOS) |
| P72 | Tempo de preenchimento da passagem sem medição automática | ⚪ | `src/features/handovers/deliver.ts` | o piloto mede com cronômetro e observador (C6-6); `fill_ms` exigiria migração |
| P73 | Suíte do Vitest lenta e teste de migração com timeout sob carga | ⚪ | `src/db/schema/migration0002.test.ts` · `.github/workflows/ci.yml` | cerca de 760 s com a máquina carregada; o `migration0002` estourou 15 s; o job `checks` tem 15 min |
| P74 | admin:invite não mostra quantos administradores ativos existem | ⚪ | `scripts/adminInvite.ts` | um convite de admin a mais passa despercebido (a trava de host não cobre) |
| P75 | Next imprime o erro não tratado inteiro no log da Vercel | 🟡 | `src/instrumentation.ts` · `src/lib/auth/createAuth.ts` | uncaught em Server Component e em rota sai como `⨯ Error: Failed query: … params: …` no log (1 h no Hobby), com e-mail, hash ou texto da passagem; o mesmo vale para o `# SERVER_ERROR` do `better-call` (Better Auth), que o roteador imprime com `console.error` fora do `logger`; `logServerError` só cobre o erro tratado e o que o `logger` do Better Auth emite (opções: aceitar no piloto e rever o log; ou limites de erro por rota que tratam o erro antes de o Next o ver) |
| P76 | Gerar link de nova senha não deixa registro de quem gerou | 🟡 | `src/features/admin/passwordReset.ts` | um admin pode gerar o link de outro admin (e assumir a conta) sem rastro de quem, para quem e quando, contra a regra de rastro do projeto (opção: tabela de auditoria; exige migração, fora desta fase) |

`Atualização` da Tarefa 10: P1 (produção num projeto Neon novo, C6-4; na Vercel só `DATABASE_URL_POOLED`; a URL direta só no shell da migração; as URLs comentadas do `.env.local` saem, passo do dono B2), P6 (D-F6-1: só `*.vercel.app` no piloto, Apple segue bloqueada), P10 (C6-1: Google desligado no piloto). Casos novos no guarda: `Fase 6: P62 a P76 entraram como Aberto, não triado`.

### Quem pode o quê (resumo)

| Ação | Admin | Operador | Sem sessão |
|---|---|---|---|
| Gerar link de nova senha (`createPasswordResetLinkAction`) | sim (inclusive para si e para outro admin; não para desativado) | `notFound()` do `requireAdmin` e, no domínio, `FORBIDDEN` | proxy → `/entrar` |
| Abrir `/redefinir-senha` e trocar a senha com o token | sim | sim | sim (pública) |
| Abrir `/privacidade` | sim | sim | sim (pública) |
| `POST /api/auth/request-password-reset` | `RESET_PASSWORD_DISABLED` | idem | idem |

---

## Textos de interface (exatos — testes e E2E dependem deles)

**`/entrar` — rodapé do `SignInPanel`** (nesta ordem): `O acesso é só por convite.` · `Esqueceu a senha? Peça ao administrador um link para criar outra.` (T5) · link `Privacidade e seus dados` → `/privacidade` (T8). Nunca `Esqueci a senha`.

**`/bem-vindo` — `PasskeyOffer`** (T8): título `Conta criada` (igual); descrição `A passkey é a forma mais rápida de entrar: você usa a digital, o rosto ou o PIN do aparelho, sem digitar senha. Se esquecer a senha, peça ao administrador um link para criar outra.`

**`/admin/equipe` — `PasswordResetLinkButton`** (T5): botão `Nova senha`, `aria-label` `Gerar link de nova senha para {nome}`; diálogo com título `Link de nova senha` e descrição `{nome}`; campo somente leitura com `aria-label` `Link para copiar` (diferente do título, senão o teste acha dois elementos); texto `Válido até {data e hora}, uma vez só. Quem abrir o link troca a senha e todos os acessos abertos dessa pessoa são encerrados. O link aparece só agora: se perder, gere outro (o anterior deixa de valer).` (`{data e hora}` = `formatDateTimeBR(expiresAt)`); botões `Copiar link` e `Compartilhar` (só com `navigator.share`); toasts `Link copiado.` e `Não foi possível copiar. Selecione o link e copie.`; compartilhar: título `Nova senha do Closery`, texto `Abra este link para criar uma senha nova no Closery.`. A nota da linha própria continua `Peça a outro administrador para mudar a sua conta.`

**Mensagens do domínio** (T5): `FORBIDDEN` → `Só administradores geram links de redefinição.` · `NOT_FOUND` → `Pessoa não encontrada. Atualize a página.` (o `notFoundMessage("pessoa")` de hoje) · `PERSON_INACTIVE` → `Esta conta está desativada. Reative antes de gerar um link de redefinição.` · `INVALID_INPUT` → o texto de hoje. Exceções (não chegam à tela; viram `INTERNAL`): `BETTER_AUTH_URL não é uma URL absoluta: "{valor}".` e `URL base inválida para a redefinição: "{valor}".`

**`/redefinir-senha` — `ResetPasswordForm`** (T5; `metadata` `Redefinir senha`): lendo → cartão vazio com `aria-busy="true"`; sem token → título `Link incompleto`, descrição `Abra o link de redefinição completo, do jeito que o administrador enviou. Se ele não funcionar, peça outro.`, link-botão `Ir para a entrada` (`/entrar`); formulário → título `Criar uma senha nova`, descrição `Use pelo menos 8 caracteres.`, rótulo `Senha nova`, botão `Trocar a senha`; feito → título `Senha alterada`, descrição `Por segurança, todos os acessos abertos foram encerrados. Entre com a senha nova.`, link-botão `Entrar` (`/entrar`). Erros (`AUTH_ERROR_MESSAGES`): `INVALID_TOKEN` → `Este link de redefinição venceu ou já foi usado. Peça outro ao administrador.` (novo) · `PASSWORD_TOO_SHORT` → `A senha precisa ter pelo menos 8 caracteres.` · `PASSWORD_TOO_LONG` → `A senha pode ter no máximo 128 caracteres.` · `RATE_LIMITED` → `Muitas tentativas nesta rede. Espere um minuto e tente de novo.` · rede ou código desconhecido → `Não foi possível concluir. Tente de novo.` (`FALLBACK_AUTH_ERROR`).

**`global-error.tsx`** (T6): `<title>Algo deu errado</title>`, título `Algo deu errado`, botão `Tentar de novo`.

**`/privacidade`** (T8; `metadata` `Privacidade`): marca `Closery`; título `Privacidade e seus dados`; alerta (só com `PRIVACY_DRAFT`) `Rascunho aguardando aprovação` / `Este texto ainda não foi aprovado pelo dono do produto nem pela empresa.`; introdução `O Closery registra a passagem de turno da operação. Esta página explica, em poucas linhas, quais dados ficam guardados, para quê, quem vê e como pedir ajuda.`; seções:
- `O que guardamos` (itens): `Seu nome e seu e-mail.` · `Como você entra: a senha (guardada de forma que ninguém consegue ler) e as passkeys que você cadastrar.` · `As passagens de turno, as solicitações e os comentários que você escreve, cada um com o seu nome e o horário.` · `O endereço de rede (IP) e o navegador de cada acesso, para manter a sessão segura e limitar tentativas em excesso.` · `Relatórios de erro do sistema, limpos antes do envio ao Sentry para não levar nome, e-mail nem o conteúdo das passagens.`
- `Para que usamos` (parágrafo): `Para você entrar com segurança, para a equipe saber quem passou e quem recebeu cada turno, para acompanhar as solicitações e para corrigir falhas do sistema. Não usamos seus dados para publicidade nem os vendemos.`
- `Quem vê` (itens): `Operador: vê os dados do próprio setor.` · `Administrador: vê os dados de todos os setores e cuida das contas.` · `Fora a equipe, só o responsável pelo sistema (o dono do produto) e os serviços listados abaixo, que guardam os dados apenas para o sistema funcionar.`
- `Onde ficam` (itens, nesta ordem): `Aplicação: Vercel, com o processamento em São Paulo (Brasil); a Vercel guarda por 1 hora registros técnicos de acesso.` · `Banco de dados: Neon, em São Paulo (Brasil).` · `Relatórios de erro: Sentry, fora do Brasil, com o endereço de rede descartado.` · `Cópia de segurança: durante o piloto, o administrador baixa todo dia o resumo das passagens (com os nomes de quem entregou e recebeu) e o guarda numa pasta privada.`
- `Por quanto tempo` (parágrafo): `Enquanto o piloto e o uso do sistema durarem. Quando alguém deixa a equipe, a conta é desativada e não apagada, para que as passagens e solicitações continuem mostrando quem as fez. Quem deixa a equipe perde o acesso na hora.`
- `Seus direitos e contato` (parágrafo): `Você pode pedir para ver seus dados, corrigir um dado errado ou tirar uma dúvida sobre esta página. Fale com o administrador do seu setor: ele atende o pedido ou leva à empresa. Registros de passagens já confirmadas só mudam por correção do administrador, com motivo anotado.`
- rodapé: `Última atualização: {PRIVACY_UPDATED_AT}.` e o link `Voltar para a entrada` (`/entrar`).

**`PrivacyLink`** (T8): `Privacidade e seus dados`.

**`bun run admin:invite`** (T3): uso `Uso: bun run admin:invite --confirmar-host=<host do banco> [--label "Nome de referência"]`; alvo, antes de qualquer escrita, em duas linhas: `Banco de destino: {host}` e `BETTER_AUTH_URL:  {url}` (dois espaços depois dos dois-pontos); erros (o script prefixa `Erro: ` e sai com código 1): `Confirme o banco de destino: rode de novo com --confirmar-host={host}` · `--confirmar-host não confere com o banco de destino ({host}). Nada foi criado.` · `Falta o valor de --confirmar-host. {uso}` · `--confirmar-host foi informado mais de uma vez. {uso}` · `Falta o valor de --label. {uso}` · `--label foi informado mais de uma vez. {uso}` · `Argumento desconhecido: {arg}. {uso}` · `--label aceita no máximo 80 caracteres.` · `DATABASE_URL não é uma URL de conexão válida.` · qualquer outro erro (do banco, por exemplo; nunca o SQL, os parâmetros nem a mensagem do driver): `Erro: falha inesperada ao gravar o convite ({nome do erro}[, código {código}]). Confira no banco se o convite foi criado antes de rodar de novo.`; a saída de sucesso é a de hoje (`Convite de administrador criado.` … `O link vale para uma conta só e não é exibido de novo: copie agora.`).

**`bun run db:hosts`** (T3): `Banco da aplicação (runtime): {host | ausente | inválida}` e `Banco das migrações (drizzle-kit): {host | ausente | inválida}`.

**`bun run smoke`** (T10): uso `Uso: bun run smoke <https://<projeto>.vercel.app> [--local]`; erros de argumento: `Informe a URL do app. {uso}` · `URL inválida: {arg}. {uso}` · `Use https:// (http só para localhost). {uso}` · `Argumento desconhecido: {arg}. {uso}`; rótulos: `health` `GET /api/health responde 200 com o banco` · `region` `Função em gru1 (x-vercel-id)` · `hsts` `HSTS enviado pela Vercel` · `security-headers` `Cabeçalhos de segurança em /entrar` · `noindex` `noindex no cabeçalho e no HTML de /entrar` · `robots` `/robots.txt bloqueia os buscadores` · `no-referrer-convite` `/convite sem Referer` · `no-referrer-redefinir` `/redefinir-senha sem Referer` · `redirect` `/ sem sessão vai para /entrar` · `privacy` `/privacidade abre sem sessão`; linhas `[OK] {rótulo}`, `[FALHOU] {rótulo}: {detalhe}`, `[PULADO] {rótulo} (só na Vercel)`; resumo `Resultado: {n} OK, {n} FALHOU, {n} PULADO.`

---

## Tarefas

| # | Tarefa e entrega | Arquivos principais | Depende de | Fim |
|---|---|---|---|---|
| 1 | **Config de produção** (`chore(producao)`): Step 0 (pasta `.git/sdd/f6`, data do dia, linha de base do Vitest); `vercel.json` (F6-1) e `test/vercelConfig.test.ts`; `engines.node` `22.x` (F6-2) e o comentário do CI; cabeçalhos de segurança + `no-referrer` do convite (F6-3) com `nextConfig.test.ts` reescrito; `robots.ts` + `metadata.robots` (F6-4); `.env.example`; `library-docs §1`; conferência manual no `next start` da 3201 (curl dos cabeçalhos, `/robots.txt`, meta robots) | `vercel.json`, `package.json`, `next.config.ts`, `src/app/{nextConfig.test,robots,robots.test,layout}.ts(x)`, `test/vercelConfig.test.ts`, `.github/workflows/ci.yml`, `.env.example`, `library-docs.md` | — | build + E2E inteiro (35) |
| 2 | **`logServerError` nos 4 lugares** (`fix(log)`): `summarizeError`/`logServerError` (F6-5); `runAction`, `/api/health` (com o teste novo da rota), `error.tsx`, `(app)/error.tsx`; `test/logGuard.test.ts`; `code-standards §6`; `ui-registry` (AppError: o log) | `src/lib/logServerError.ts` (+ teste), `features/admin/runAction.ts` (+ teste), `app/api/health/route.ts` (+ teste novo), `app/error.tsx`, `app/(app)/error.tsx` (+ testes), `test/logGuard.test.ts`, `code-standards.md`, `ui-registry.md` | — | build + subconjunto (22) |
| 3 | **Trava de host do `admin:invite`** (`feat(admin-invite)`): `parseAdminInviteArgs` com `confirmHost`, `assertHostConfirmed`, `formatAdminInviteTarget`, `databaseHostOf` e `formatDatabaseHosts` em `src/db/databaseHost.ts`, o script na ordem nova, `scripts/dbHosts.ts` + `db:hosts`; execução real com env fictícia; `AGENTS.md` (comandos) e `architecture §7` | `src/db/databaseHost.ts` (+ teste), `features/invites/adminInvite.ts` (+ teste), `scripts/{adminInvite,dbHosts}.ts`, `package.json`, `AGENTS.md`, `architecture.md` | — | sem build/E2E; script real |
| 4 | **Better Auth endurecido** (`fix(auth)`): `ipAddressHeaders` (P22), `setCookie` do convite (P16), `storeIdentifier` com hash para `reset-password:`, `revokeSessionsOnPasswordReset`, `RESET_PASSWORD_PREFIX`, `logger` que passa o erro do Better Auth por `logServerError`; `hardening.test.ts`; P16 e P22 → `Resolvido` + caso no guarda; `library-docs §8` | `src/lib/auth/createAuth.ts`, `src/lib/auth/hardening.test.ts`, `.context/pendencias.md`, `test/pendenciasDoc.test.ts`, `library-docs.md` | — | build + subconjunto (22) |
| 5 | **Link de redefinição pelo admin**, **2 commits**: (A) `refactor(equipe)`: `useShareLink` extraído do `InviteLinkCard` (testes novos do hook; nenhum teste existente muda; `ui-registry`); (B) `feat(equipe)`: `createPasswordResetLink` (F6-10), desativar derruba o link (`setPersonActive`, F6-10), `PERSON_INACTIVE`, mensagens, schema, `createPasswordResetLinkAction` (+ inventário), `PasswordResetLinkButton` em `PersonRowActions` e na linha própria do `TeamAdmin`, `ResetPasswordForm` + `/redefinir-senha`, `PUBLIC_PATH_PREFIXES`, `no-referrer` da rota, `INVALID_TOKEN`, rodapé do `/entrar`, `e2e/cadastros.spec.ts` (e), `uiRegistryDoc`, `ui-registry`, P8 `Atualização` + caso no guarda, `architecture §7/§9`, `library-docs §8` | (A) `components/admin/team/{useShareLink,InviteLinkCard}` (+ teste do hook), `ui-registry.md`; (B) `features/admin/{passwordReset,people,result,messages,schemas}.ts` (+ testes; `people.ts` só ganha o apagamento das `verification` ao desativar), `app/(app)/admin/equipe/{actions.ts,passwordResetAction.test.ts}`, `actionsInventory.test.ts`, `components/admin/team/{PasswordResetLinkButton,PersonRowActions,TeamAdmin}.tsx` (+ testes), `components/auth/{ResetPasswordForm,SignInPanel}.tsx` (+ testes), `app/(auth)/redefinir-senha/page.tsx` (+ teste), `features/authz/proxyRules.ts` (+ teste), `next.config.ts`, `nextConfig.test.ts`, `lib/auth/{errors.ts,errors.test.ts,errorCodesContract.test.ts}`, `e2e/cadastros.spec.ts`, `test/{uiRegistryDoc,pendenciasDoc}.test.ts`, `.context/{ui-registry,pendencias,architecture,library-docs}.md` | 1, 4 | build + E2E inteiro (35), nos dois commits |
| 6 | **Sentry** (`feat(observabilidade)`): `bun add --exact @sentry/nextjs@11.18.0`; `sentryOptions` (F6-12), `scrubEvent`/`scrubText` (F6-14), `instrumentation.ts` (+ teste), `instrumentation-client.ts`, `global-error.tsx` (+ teste; F6-15), captura no `logServerError` (F6-13), `withSentryConfig`, `playwright.config.ts` e `.env.example` com DSN vazio, `logGuard` estendido; `rc-check` do `global-error`; build sem `.map` e com as mesmas rotas; `library-docs §16`, `architecture §2`, `ui-registry` | `package.json`, `bun.lock`, `src/lib/sentry/{options,scrubEvent}.ts` (+ testes), `src/instrumentation{,-client}.ts`, `src/instrumentation.test.ts`, `src/app/global-error.tsx` (+ teste), `src/lib/logServerError.ts` (+ teste), `next.config.ts`, `playwright.config.ts`, `.env.example`, `test/logGuard.test.ts`, `.context/{library-docs,architecture,ui-registry}.md` | 1, 2, 5 | build + E2E inteiro (35) |
| 7 | **Alvos de toque (P12) + guarda E2E** (`fix(ui)`): `e2e/touch-targets.spec.ts` (2 testes) primeiro, vermelho; as 4 correções (F6-16) com os testes de classe dos 4 componentes; `rc-check` do `spending-ring`; `ui-rules §1.4`, `ui-registry`, `library-docs §10`; P12 → `Resolvido` + caso no guarda | `e2e/touch-targets.spec.ts`, `components/{kokonutui/spending-ring,dashboard/DashboardStock,solicitacoes/RequestDetail,app-shell/Greeting}.tsx` (+ testes), `.context/{ui-rules,ui-registry,library-docs,pendencias}.md`, `test/pendenciasDoc.test.ts` | 5 | build + E2E inteiro (37) |
| 8 | **`/privacidade` + `PrivacyLink` + textos do primeiro acesso** (`feat(privacidade)`): `privacyContent.ts`, a página (+ teste), `PrivacyLink` (+ teste), `/privacidade` pública, o link no `/entrar`, no convite válido e em `/conta`, o `PasskeyOffer`; `/privacidade` no `touch-targets.spec.ts`; `uiRegistryDoc` com a pasta `privacy`; `ui-registry`, `architecture §8/§9`; P7 `Atualização` | `features/privacy/privacyContent.ts`, `app/privacidade/page.tsx` (+ teste), `components/privacy/PrivacyLink.tsx` (+ teste), `features/authz/proxyRules.ts` (+ teste), `components/auth/{SignInPanel,PasskeyOffer}.tsx` (+ testes), `app/(auth)/convite/[token]/page.tsx`, `app/(app)/conta/page.tsx`, `e2e/touch-targets.spec.ts`, `test/uiRegistryDoc.test.ts`, `.context/{ui-registry,architecture,pendencias}.md` | 5, 7 | build + subconjunto com `touch-targets` (24) |
| 9 | **E2E do link de redefinição e das páginas públicas** (`test(e2e)`): `signUpOperator`/`signUpAdmin` devolvem o e-mail; `e2e/redefinir-senha.spec.ts` (3) e `e2e/publico.spec.ts` (3); E2E inteiro | `e2e/{helpers,redefinir-senha.spec,publico.spec}.ts` | 1, 5, 8 | build + E2E inteiro (43) |
| 10 | **Runbook, smoke, documentação e verificação final** (`docs(producao)`): `scripts/smokeChecks.mjs` (+ `test/smokeChecks.test.ts`) e `scripts/smoke.mjs` + `bun run smoke`; execução real contra o `next start` local (3201, banco inacessível); `.context/runbook-producao.md`; pendências P62–P76 e as `Atualização` de P1, P6 e P10 + caso no guarda; `architecture` (§5 banco de produção, §9 rotas públicas, §10 ADR da Fase 6 com os desvios e os riscos residuais P75 e P76), `progress-tracker`, `build-plan`, `AGENTS.md` (smoke), `library-docs` (conferência), `memory.md`; walkthrough; verificação final | `scripts/{smokeChecks,smoke}.mjs`, `test/smokeChecks.test.ts`, `package.json`, `.context/{runbook-producao,pendencias,architecture,progress-tracker,build-plan,library-docs}.md`, `AGENTS.md`, `memory.md`, `test/pendenciasDoc.test.ts` | 1–9 | build + E2E inteiro (43) + smoke local |

**Casos que cada tarefa precisa provar**

*Tarefa 1*
1. `vercel.json`: `regions` = `["gru1"]`; `installCommand` = `bunx bun@${versão do packageManager} install --frozen-lockfile` (o teste lê o `packageManager`, não um literal); `buildCommand` = `bun run build`; `git.deploymentEnabled` igual a `{ "**": false, main: true }` (a chave `"**"` exata); sem `bunVersion`.
2. `engines.node` = `"22.x"`; o `ci.yml` tem ao menos uma ocorrência de `node-version` e todas com o major `22` (zero ocorrências reprova).
3. Ordem das regras `["/:path*", "/convite/:path*"]` — **falha** com a config de hoje (`["/convite/:path*"]`); os valores exatos de `X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy`, `X-Frame-Options` e `X-Robots-Tag` na regra global; `Permissions-Policy` contém `camera=()`, `microphone=()`, `geolocation=()` e **não** contém `publickey-credentials`; CSP sem `script-src`, `default-src` nem `style-src`; sem `Strict-Transport-Security`; `/convite/:path*` com `no-referrer`; as opções de antes (`cacheComponents`, `reactCompiler`) continuam.
4. `robots()` igual a `{ rules: { userAgent: "*", disallow: "/" } }`.
5. `next start` na 3201 com a env fictícia: `curl -sI` em `/` (307 para `/entrar` com os 6 cabeçalhos), `/entrar` (200, `strict-origin-when-cross-origin`), `/convite/x` (200, `no-referrer`), `/robots.txt` (`User-Agent: *` e `Disallow: /`), o HTML de `/entrar` com `<meta name="robots" content="noindex, nofollow"/>`; `/api/health` 503 sem detalhe. Servidor encerrado pelo PID da 3201.
6. E2E inteiro (35) verde, inclusive o cenário da passkey (`auth.spec.ts`: a `Permissions-Policy` não bloqueia o WebAuthn).

*Tarefa 2*
1. `summarizeError` de um `DrizzleQueryError` real (`drizzle-orm/errors`) com causa do pg (`code: "23505"`, mensagem com `ana@exemplo.test`): `{ name: "Error", code: "23505", digest: null }` e o e-mail ausente do resumo (e presente na `message` do erro: a prova de que havia o que vazar).
2. `code` direto (`ECONNREFUSED`) e `digest` do Next passam.
3. Não-`Error` (`string` com o e-mail, `null`, `undefined`, `42`, `{ message }`) → `NonError`, sem conteúdo.
4. `code`, `digest` e `name` com espaço ou e-mail são descartados (`code: null`, `digest: null`, `name: "Error"`).
5. Ciclo de `cause` não trava; `code` além de 3 níveis → `null`.
6. `logServerError` escreve **uma** chamada com **um** argumento, o JSON exato `{ level, context, name, code, digest }`, sem o e-mail e sem `select`; o erro original nunca é o argumento; contexto de 500 caracteres sai com 80.
7. `runAction` em falha inesperada: `INTERNAL`, o resultado sem `hunter2`, uma linha no console com `runAction` e sem `hunter2`.
8. `GET /api/health`: com o banco, 200 `{ status: "ok", database: "ok", latencyMs: número }`; com o banco recusando, 503 `{ status: "error", database: "unreachable" }` e a linha com `"context":"health"` e o `code`, sem a mensagem do erro.
9. `error.tsx` e `(app)/error.tsx`: a mensagem não aparece na tela; uma chamada ao console com `error-boundary` e sem `hunter2`; `retry` continua.
10. `test/logGuard.test.ts` **falha** antes das trocas listando os 4 arquivos e passa depois.

*Tarefa 3*
1. `parseAdminInviteArgs`: `--confirmar-host=x` e `--confirmar-host x`, junto com `--label`; vazio → `null`; sem valor, repetido e argumento desconhecido lançam com as mensagens exatas (o uso novo); os casos de `--label` de hoje continuam com `confirmHost: null` (máximo 80 aceito, 81 recusado, `=` e unicode preservados).
2. `databaseHostOf`: só o host em minúsculas, sem usuário, senha, porta nem banco; URL inválida lança sem repetir o texto (`s3nha` ausente da mensagem).
3. `assertHostConfirmed`: igual sem diferença de caixa passa; `null` recusa dizendo como confirmar; diferente, com sufixo (`db.example.com.evil`) e com prefixo (`db.example`) recusam com `não confere`.
4. `formatAdminInviteTarget` e `formatDatabaseHosts` (host, `ausente`, `inválida`; nunca usuário nem senha).
5. Script real com `DATABASE_URL_POOLED="postgresql://u:s3nha@db.invalid/x"` e `BETTER_AUTH_URL="http://localhost:3201"` exportados no shell: sem a flag → imprime `Banco de destino: db.invalid`, `Erro: Confirme o banco de destino…`, código 1; com `--confirmar-host=outro.invalid` → `não confere`, código 1; `s3nha` ausente da saída nos dois; nenhuma conexão (o host `.invalid` nem é resolvido, porque o pool não é criado). `bun run db:hosts` com a mesma env imprime `db.invalid` nas duas linhas.
6. `createAdminInvite` e `formatAdminInviteOutput` continuam com os testes de hoje.
7. `formatAdminInviteError`: o erro do próprio script (`Error` puro) mantém a mensagem (`Erro: …`); um `DrizzleQueryError` com `params: ["ana@exemplo.test"]` e causa com `code: "23505"` vira a linha `Erro: falha inesperada ao gravar o convite (DrizzleQueryError, código 23505). Confira no banco se o convite foi criado antes de rodar de novo.`, sem o e-mail e sem `insert`. O script real, no caminho de sucesso com host `.invalid`, mostrou `código ENOTFOUND` na mesma linha limpa (medido no planejamento; o passo do plano não o roda).

*Tarefa 4*
1. `createTestAuth(db).options.advanced?.ipAddress?.ipAddressHeaders` = `["x-forwarded-for"]` (tipado, sem `as`).
2. Produção: a chave do balde é `203.0.113.7|/sign-in/email`; dois IPs, dois baldes; contagem 2 no primeiro.
3. 31 logins do mesmo IP: os 30 primeiros sem 429, o 31º com 429; outro IP passa.
4. `x-real-ip` e `x-vercel-forwarded-for` não escolhem o balde.
5. Sem cabeçalho e com a lista `"1.1.1.1, 2.2.2.2"`: **um** balde (contagem 2), sem `1.1.1.1` na chave.
6. P16: cadastro com sucesso devolve `Set-Cookie` `closery_invite=;` com `Max-Age=0`, `Path=/`, `HttpOnly`, `SameSite=Lax` e o cookie de sessão junto; em produção com `Secure`; cadastro recusado (convite inválido, 403) não manda o `Set-Cookie` do convite.
7. `createVerificationValue({ identifier: "reset-password:<token>", … })` grava um `identifier` sem o token e sem `reset-password`; `identifier: "outro:abc"` fica `outro:abc` (o resto continua `plain`).
8. Pessoa com 2 sessões, token gravado pelo `internalAdapter` → `POST /reset-password` 200 e 0 sessões.
9. `POST /request-password-reset` continua `RESET_PASSWORD_DISABLED` (caso em `hardening.test.ts` e em `passwordReset.test.ts`).
10. Os casos 1, 6, 7, 8 e 12 **falham** antes da mudança no `createAuth.ts` (com a mensagem real anotada no step); os casos 2 a 5 já passam antes (o padrão já lê `x-forwarded-for`) e ficam como guarda.
11. Guarda: `Fase 6: P16 e P22 resolvidas` falha antes de mover as duas e passa depois.
12. Logger (R4): um `db` cuja consulta lança `DrizzleQueryError` com `ana@exemplo.test` nos `params`; `POST /sign-in/email` responde 500 e o `console.error` recebe **exatamente uma** linha JSON com `"context":"better-auth"`, o `name` e o `code`, sem o e-mail, sem `Failed query` e sem `insert`; o aviso `Rate limiting could not determine a client IP` (sem cabeçalho de IP, em produção) vira uma linha `"context":"better-auth:ip-desconhecido"` e nada mais; um aviso qualquer do Better Auth não escreve nada.

*Tarefa 5*
1. (A) `useShareLink`: copiar com sucesso e com falha (toasts); `canShare` falso sem `navigator.share` e verdadeiro com ele, só depois de montar; `AbortError` silencioso; outra falha de `share` cai em copiar. `InviteLinkCard.test.tsx` passa **sem edição** antes e depois.
2. Link: começa com `${baseURL}/redefinir-senha#token=`, token ≥ 43 caracteres `base64url`, `expiresAt = now + 24 h` exato.
3. Banco: uma `verification`, `identifier` sem o token e sem `reset-password`, `value` = userId.
4. Recusas sem gravar nada: operador (`FORBIDDEN`), pessoa desativada antes (`PERSON_INACTIVE` com a mensagem exata), `baseURL` sem protocolo (lança, cita `BETTER_AUTH_URL`); inexistente → `NOT_FOUND`.
5. Reset real: 200; nova senha entra (200), antiga 401; sessões revogadas.
6. Uso único: segunda vez `INVALID_TOKEN` e a senha fica a da primeira. Vencido (gerado em `Date.now() − TTL − 1 min`) → `INVALID_TOKEN` e a senha não muda; limite: gerado em `Date.now() − TTL + 1 min` ainda vale (200). Token que nunca existiu → `INVALID_TOKEN`.
7. Senha de 7 → `PASSWORD_TOO_SHORT` e o link continua valendo; de 8 → aceita; de 129 → `PASSWORD_TOO_LONG` e o link continua valendo.
8. Link novo derruba o anterior (uma linha; o antigo `INVALID_TOKEN`, o novo 200); links de duas pessoas são independentes; uma `verification` de outro tipo (`value` em JSON com o userId dentro) continua lá depois de gerar.
9. Quem só tem passkey (sem `account`) ganha uma conta `credential` (`accountId` = userId) e entra com a senha.
10. Desativada **depois** de gerar (pelo `setPersonActive`): o link deixa de valer (`INVALID_TOKEN`, a senha não muda), `deactivatedAt` continua preenchido e o login é 403 `ACCOUNT_DEACTIVATED`; reativar a conta **não** ressuscita o link (continua `INVALID_TOKEN`); a `verification` do userId some (`select` vazio). Defesa em profundidade: com `UPDATE` cru em `deactivatedAt` (o link sobrevive), o reset ainda responde 200, mas o login com a senha nova é 403 `ACCOUNT_DEACTIVATED`. Em `people.test.ts`: desativar apaga as `verification` do userId e **mantém** uma `verification` de outro tipo (`value` em JSON) e a de outra pessoa; reativar não cria nada.
11. `POST /request-password-reset` continua `RESET_PASSWORD_DISABLED`.
12. Action: `requireAdmin` rejeitando (operador) → lança e nada é gravado; admin → URL do ambiente e o token redefine de verdade; desativada → `PERSON_INACTIVE`; `{}` → `INVALID_INPUT` sem tocar o banco; `userId` inexistente → `NOT_FOUND`. `actionsInventory.test.ts` **falha** antes de listar o nome novo; `actionsGuards.test.ts` verde.
13. `PasswordResetLinkButton`: um clique chama a action com `{ userId }` e mostra o link no campo `Link para copiar` com `Válido até`; falha → toast com a mensagem e nenhum link; fechar descarta o link; botão desabilitado enquanto pendente. `PersonRowActions`: ativa mostra `Nova senha`, inativa não. `TeamAdmin`: a linha própria tem a nota e **só** o botão `Gerar link de nova senha para {nome}`.
14. `ResetPasswordForm`: `takeTokenFromLocation` com token válido (devolve e apaga o fragmento) e com `""`, `"#"`, `"#token="`, token curto, outro parâmetro, espaço e 257 caracteres (devolve `null` sem `replaceState`); sem token → `Link incompleto` e nenhum campo; com token → o fragmento some, envia `{ newPassword, token }`, `Senha alterada` e o link `Entrar`; `INVALID_TOKEN` → a mensagem e o campo habilitado; exceção de rede → a mensagem genérica e o botão liberado; em `<StrictMode>` o token lido não se perde.
15. Página: renderiza o formulário; `metadata.title` = `Redefinir senha`.
16. Proxy: `/redefinir-senha` e `/redefinir-senha/` públicas; `/redefinir-senhas` não; `shouldRedirectToSignIn("/redefinir-senha", false)` = `false`.
17. `next.config`: `/redefinir-senha/:path*` com `no-referrer` e a ordem `["/:path*", "/convite/:path*", "/redefinir-senha/:path*"]`.
18. `INVALID_TOKEN` no mapa e no contrato de códigos (o contrato **falha** antes).
19. `SignInPanel`: os dois parágrafos exatos e nenhum `Esqueci a senha`.
20. `uiRegistryDoc.test.ts` **falha** sem as entradas de `PasswordResetLinkButton` (varredura da pasta) e de `ResetPasswordForm` (cabeçalho próprio).
21. Guarda: `Fase 6: P8 continua bloqueada no dono e ganhou a Atualização do link do admin` (`Bloqueado no dono`, seção 3, uma `Atualização` ≥ `2026-11-25`) falha antes e passa depois.
22. `bun run build` lista `○ /redefinir-senha`; E2E inteiro (35) com `cadastros.spec.ts` (e) novo.

*Tarefa 6*
1. Sem DSN: `enabled: false` e 0 envelopes depois de `captureException` + `flush`.
2. `tracesSampleRate` 0, `maxBreadcrumbs` 0, sem `replaysSessionSampleRate`/`replaysOnErrorSampleRate`; `dataCollection` igual ao objeto da F6-12 **e**, com o SDK iniciado, `getClient().getDataCollectionOptions()` resolve toda chave como `false` ou `[]` (menos `frameContextLines`, que é um número de linhas de código-fonte).
3. Com DSN falso e transporte falso: `setUser` (e-mail e IP), breadcrumb, `extra`, tag `url` e mensagem com e-mail e `/convite/tok3n?x=1` → 1 evento com `falha ao salvar` e sem `ana@`, `hunter2`, `tok3n`, `ip_address`, `clicou`; `user` e `request` ausentes.
4. `DrizzleQueryError` real com causa do pg e `linkedErrors`: o texto enviado contém `Failed query: [removido]` e **não** contém `insert`, `$1`, `params: ana`, `ana@exemplo.test`.
5. `scrubEvent`: os 7 casos do spike (usuário, IP, cookies, cabeçalhos, corpo, query, servidor e breadcrumbs removidos; mensagem e `transaction` higienizadas; `vars` removidas e frames mantidos; tipo, pilha, `trace` e tags sem URL mantidos; evento original intacto; evento mínimo e exceção sem valor aceitos) + `Failed query`, `params:` sozinho, `invalid input syntax for type uuid: "abc"`, `#token=…` e e-mail com `+`; `filename`, `abs_path` e `module` de um frame com URL (`#token=`, `?pagina=2&busca=Ana`, `/convite/<token>`) saem higienizados e o valor de uma tag com e-mail ou `/convite/<token>` também (tags de chave `url` continuam descartadas); um `logentry` com e-mail é removido; `mechanism.data` some; e `original.sdk.settings` continua intacto depois do `scrubEvent` (o original não é mutado).
6. `logServerError` (T6): `captureException` uma vez com o erro e `{ tags: { context } }`; com `digest` não captura (a linha continua); `captureException` que lança não quebra o log nem lança.
7. `global-error`: `lang="pt-BR"` no documento, o título, `Tentar de novo` chama `retry`, `logServerError(error, "global-error")` uma vez, a mensagem do erro não aparece; o único `console.error` é o aviso de `<html>`.
8. `instrumentation`: `register()` com `NEXT_RUNTIME` `nodejs` chama `init` uma vez; com `edge` ou ausente, nenhuma; `onRequestError` é `Sentry.captureRequestError`. `instrumentation-client`: as opções passadas ao `init` não trazem a integração `BrowserSession` (o teste filtra as integrações padrão e afirma a ausência; o nome se confirma em `node_modules` na execução). `logServerError(null, "better-auth:ip-desconhecido")` escreve a linha e **não** chama `captureException`.
9. `logGuard` (T6): `@sentry/nextjs` só nos 5 arquivos; **falha** se o `global-error` importasse o Sentry direto.
10. Build: as mesmas rotas de antes (lista anotada no step), nenhum `route.ts` novo, `find .next/static -name "*.map" | wc -l` = 0 e `grep -rl sourceMappingURL .next/static --include=*.js | wc -l` = 0 sem token; `bun scripts/rc-check.mjs src/app/global-error.tsx` → `compiled: 1`; E2E inteiro (35) com o DSN vazio.

*Tarefa 7*
1. `e2e/touch-targets.spec.ts` **falha** antes das correções, **já com a isenção estrita** (F6-16: sem ancestral `p`/`li`/`label` o link `inline` é medido); o teste do operador lista `a "Ver o dashboard" 120x21` e os demais achados, anotados no step com as medidas reais, **inclusive qualquer link novo que a regra antiga escondia** (em `td`, `div`, `span` ou `header`), cada um corrigido ou justificado. Prova de que o guarda pega regressão: mover o link para dentro de um `<div>` continua reprovando.
2. Depois: os 2 testes verdes. Operador: `/entrar`, `/redefinir-senha` (sem fragmento: `Link incompleto`), `/`, `/passagens`, `/passagens/nova?turno=&data=`, `/solicitacoes?visao=lista`, `/solicitacoes/<id>`, `/dashboard`, `/conta`, o menu lateral aberto e o diálogo `Nova solicitação`. Admin: `/admin`, `/admin/setores`, `/admin/turnos`, `/admin/itens`, `/admin/destinos`, `/admin/equipe` e o diálogo `Link de nova senha` aberto numa pessoa.
3. Testes de unidade dos 4 componentes afirmam as classes `max-md:min-h-11` e `max-md:inline-flex` (e `max-md:min-w-11` no `TOTAL_LINK`).
4. Exceções medidas e justificadas: link `inline` dentro de frase e o link esticado (`after:inset-0`).
5. `bun scripts/rc-check.mjs src/components/kokonutui/spending-ring.tsx` → `compiled` ≥ 1.
6. Guarda: `Fase 6: P12 resolvida` falha antes e passa depois. E2E inteiro (37).

*Tarefa 8*
1. Página: um `h1` `Privacidade e seus dados` e um `h2` por seção; cada seção é `region` com o nome do título; `Onde ficam` tem os 4 itens exatos de Textos (`Vercel, com o processamento em São Paulo (Brasil)` e a hora de registros, `Neon, em São Paulo (Brasil)`, `Sentry, fora do Brasil, com o endereço de rede descartado` e a `Cópia de segurança`); `Quem vê` cita `o responsável pelo sistema (o dono do produto)` e não diz "ninguém de fora da empresa"; `O que guardamos` não diz "sem nenhum dado" nem "sem dados pessoais"; o contato é o administrador do setor; `a conta é desativada e não apagada`; o item do IP e do navegador; `Última atualização: {PRIVACY_UPDATED_AT}.`; o alerta aparece se e só se `PRIVACY_DRAFT`; o link `Voltar para a entrada` → `/entrar`.
2. A página não chama `requireUser` nem lê sessão (estática: `○ /privacidade` no build); proxy: `/privacidade` pública, `/privacidades` não.
3. `PrivacyLink`: `href="/privacidade"` e as classes do link solto.
4. `SignInPanel`: o link `Privacidade e seus dados` → `/privacidade`, depois dos dois parágrafos (que continuam exatos).
5. `PasskeyOffer`: a descrição nova exata.
6. `uiRegistryDoc.test.ts` **falha** com a pasta `privacy` na varredura antes da entrada `PrivacyLink`.
7. `touch-targets.spec.ts` com `/privacidade` verde; subconjunto (24).

*Tarefa 9*
1. `redefinir-senha` (a): o admin gera o link na linha do operador; outro contexto, sem sessão, abre o link; a URL fica sem o fragmento; troca a senha; `Senha alterada`; entra com a nova; com a antiga, `E-mail ou senha incorretos.`
2. (b): o mesmo link de novo mostra `Este link de redefinição venceu ou já foi usado. Peça outro ao administrador.`; `/redefinir-senha` sem fragmento mostra `Link incompleto`.
3. (c): o operador com sessão aberta num contexto; a troca pelo link em outro contexto; a próxima navegação do primeiro vai para `/entrar` (`countSessionsByEmail` 0 antes de entrar de novo).
4. `publico` (a): `/privacidade` sem sessão; o link de `/entrar`, do convite válido e de `/conta` levam a ela.
5. (b): em `/entrar` os 6 cabeçalhos da F6-3; `/convite/<token qualquer>` e `/redefinir-senha` com `Referrer-Policy: no-referrer`; o HTML de `/entrar` com a meta robots.
6. (c): `/robots.txt` 200 com `User-Agent: *` e `Disallow: /`.
7. E2E inteiro: **43** testes.

*Tarefa 10*
1. `parseSmokeArgs`: `https://x.vercel.app/qualquer?y` → origem `https://x.vercel.app`; `http://localhost:3201` e `http://127.0.0.1:3201` aceitos; `http://exemplo.test` recusado; sem URL, URL inválida e argumento desconhecido recusados (mensagens exatas); `--local` lido.
2. `checkHealth` (200 ok; 503; corpo que não é JSON; JSON com `database` diferente de `ok`); `functionRegionOf` (3 segmentos, 2 segmentos, 1, vazio, `null`); `checkRegion` e `checkHsts` (local → `pulado`; ausente; errado; certo); `checkSecurityHeaders` (todos certos; falta um; valor errado; status ≠ 200); `checkNoindex` (cabeçalho sem meta e meta sem cabeçalho falham); `checkRobots`; `checkNoReferrer`; `checkRedirectToSignIn` (307 + `/entrar`; 200; 307 para outro lugar); `checkPublicPage`; `formatSmokeReport` (linhas e resumo exatos; código 1 com qualquer `falhou`, 0 sem nenhum; `pulado` não reprova).
3. CLI real contra o `next start` da 3201 (env fictícia, banco inacessível): `bun run smoke http://localhost:3201 --local` → `Resultado: 7 OK, 1 FALHOU, 2 PULADO.` (o `FALHOU` é `/api/health` com `status 503`) e código de saída 1; sem `--local`, `region` e `hsts` viram `FALHOU` (código 1).
4. Guarda: `Fase 6: P62 a P76 entraram como Aberto, não triado` falha antes e passa depois; o próximo id livre `P77` (caso de hoje). O ADR da §10 cita P75 e P76.
5. Final: `check-types`, `lint`, `test` (total = linha de base + todos os acrescentados, anotado), `build` (`○ /redefinir-senha`, `○ /privacidade`, `○ /robots.txt`, nenhuma rota nova de API) e E2E inteiro (43) verdes.

**Fatias de redação:** [1, 2, 3] · [4, 5] · [6, 7] · [8, 9, 10].

---

## Parte B — Go-live (controlador e dono; fora do SDD)

Executada **depois** do merge da Fase 6, pelo controlador junto com o dono, seguindo `.context/runbook-producao.md` (Tarefa 10). Todo passo marcado **[confirmação do dono na hora]** só acontece com o "sim" explícito do dono naquele momento (C6-7); "Dono" = só o dono pode fazer (conta, pagamento, console, pessoas); "Controlador" = o agente, que **dita** os comandos do runbook e confere os resultados que o Dono repassa. O **Dono**, num Git Bash aberto por ele **fora da sessão do agente**, digita os comandos que o controlador dita. O controlador **nunca** roda esses comandos pela ferramenta Bash (ela não é interativa: `read -rs` recebe EOF) e **nunca** recebe a saída do `openssl` nem a do `admin:invite` com sucesso (o link de convite é um segredo). O Dono só repassa o host impresso e o código de saída. Nunca se imprime connection string, secret, DSN ou link de convite em chat ou log.

0. **PR da Fase 6** — Controlador abre o PR (corpo com os desvios: domínio `*.vercel.app`, P8 pelo link do admin, Hobby, Neon Free, sem CSP completa, Sentry fora do país); CI `checks` + `e2e` verde; **Dono** aprova o texto de `/privacidade` (C6-5) e o merge. **[confirmação do dono na hora]** (ainda não há Vercel ligada: o merge não publica nada).
1. **Proteção da `main`** (P62) — Controlador: `gh api -X PUT "repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/branches/main/protection" --input <arquivo>` com `required_status_checks: { strict: true, checks: [{ context: "Tipos, lint e testes" }, { context: "E2E (Playwright)" }] }`, `enforce_admins: true`, `required_pull_request_reviews: null`, `restrictions: null`; conferir com `gh api …/branches/main/protection`. **[confirmação do dono na hora]**. Antes de ligar a Vercel (a integração publica todo push na `main`).
2. **Neon** — Dono: projeto **novo** de produção (C6-4) no plano Free, região AWS São Paulo (`sa-east-1`), mesma versão do Postgres da dev; autoscaling 0,25–0,25 CU, scale-to-zero ligado; nenhum monitor que consulte o banco (D-F6-4); copiar as duas connection strings (pooler e direta) trocando `sslmode=require` por `sslmode=verify-full` (C14) e guardar **só** no gerenciador de senhas; tirar do `.env.local` as URLs de produção comentadas (G-B; o dono edita, ninguém imprime o arquivo).
3. **Sentry** — Dono: conta grátis, projeto Next.js, copiar o DSN; em Security & Privacy: Data Scrubber e Default Scrubbers ligados, "Prevent Storing of IP Addresses" ligado; anotar a região de dados da organização (fora do Brasil, como diz `/privacidade`).
4. **Migração de produção** (C6-3) — no Neon (Dono), branch de segurança a partir da `main` do projeto novo; o **Dono** abre um Git Bash novo, na pasta do repositório, **fora da sessão do agente**, cola a URL **direta** em `read -rs DATABASE_URL_UNPOOLED` (fora do histórico) e digita o que o controlador dita: `export DATABASE_URL_UNPOOLED DATABASE_URL="$DATABASE_URL_UNPOOLED"`; `bun run db:hosts` → o Dono compara **só a linha `Banco das migrações`** com o host do console do Neon (a linha `Banco da aplicação (runtime)` mostra o pooler de **dev** do `.env.local`, como esperado: ignorar); **[confirmação do dono na hora]** → o Dono digita `bun run db:migrate`; conferir no SQL Editor `select count(*) from drizzle.__drizzle_migrations` = **5**; `exit` (a URL some com o shell). Nunca no build nem no CI.
5. **Vercel** — Dono: plano Hobby (D-F6-3, riscos aceitos: P65); importar o repositório; Framework Next.js; os comandos e a região vêm do `vercel.json`; conferir Node 22.x; Fluid compute ligado (padrão); variáveis **só** de Production: `DATABASE_URL_POOLED` (Sensitive), `BETTER_AUTH_SECRET` novo (o **Dono** roda `openssl rand -base64 32` no próprio Git Bash, fora da sessão do agente, e cola direto no campo da Vercel; o controlador não vê o valor; Sensitive), `BETTER_AUTH_URL=https://<projeto>.vercel.app` (o domínio de produção, sem barra final), `NEXT_PUBLIC_SENTRY_DSN`; **nunca** `DATABASE_URL`/`DATABASE_URL_UNPOOLED`, `BETTER_AUTH_SECRETS` (o Better Auth a lê sozinho), `SENTRY_AUTH_TOKEN`, `GOOGLE_*`, `FACEBOOK_*`, `DATABASE_POOL_MAX`; Deployment Protection no padrão. **[confirmação do dono na hora]** para o primeiro deploy, com o dono olhando.
6. **Domínio de produção = `BETTER_AUTH_URL`** — Dono confere o domínio que a Vercel atribuiu; se diferente, corrige a variável e faz redeploy **antes de qualquer conta** (o `rpID` das passkeys é esse host, D-F6-1, P66). **[confirmação do dono na hora]** para o redeploy.
7. **Smoke** — Controlador: `bun run smoke https://<projeto>.vercel.app` → `Resultado: 10 OK, 0 FALHOU, 0 PULADO.`; nos logs da Vercel (guardam só 1 h no Hobby), depois de uma tentativa de login, nenhuma linha com `better-auth:ip-desconhecido` (P22; o aviso original do Better Auth foi trocado por esse contexto, F6-7); anotar o `x-vercel-id` (P63). Depois do primeiro PR pós-go-live, conferir que a branch dele não gerou deployment (previews desligados).
8. **`admin:invite` em produção** — o **Dono** abre um Git Bash novo, na pasta do repositório, **fora da sessão do agente**, cola a URL do **pooler** em `read -rs DATABASE_URL_POOLED` e digita o que o controlador dita: `export DATABASE_URL_POOLED BETTER_AUTH_URL=https://<projeto>.vercel.app`; `bun run admin:invite` (sem a flag) → o Dono repassa só o host impresso e o controlador compara com o do pooler no Neon; **[confirmação do dono na hora]** → o Dono digita `bun run admin:invite --confirmar-host=<host impresso> --label "Administrador"`; o link de convite aparece **só** na tela do Dono (7 dias, uso único), que repassa só o código de saída; `exit`. O controlador nunca recebe a saída de sucesso.
9. **Primeiro admin** — Dono: abre o link, cadastra e-mail e senha, cria a passkey no celular e uma **segunda** em outro aparelho (`/conta` mostra 2); autoteste: `/admin/equipe` → `Nova senha` na própria linha → abre o link numa janela anônima → troca a senha → `Senha alterada` → todas as sessões caem → entra de novo com a passkey e com a senha nova; conferir no DevTools o cookie `__Secure-…session_token`; o detalhe rápido de uma solicitação abre no Sheet (P44). Controlador guia, sem ver senha nem link.
10. **Cadastro inicial** — Dono (admin): setor ULD, turnos reais, itens e destinos validados com o usuário final (P5, spec §15), **pela interface**; nada vem do repositório; **nenhuma passagem de teste em produção**.
11. **Ensaio funcional** — Controlador + Dono: localmente, `bun run build && bun run start -p 3201` contra a branch de **dev** do Neon (nunca a 3000), uma passagem completa (rascunho → entregar → outra conta confirma) e uma solicitação.
12. **LGPD** (P64) — Dono: aprovação escrita da empresa (controlador dos dados); Controlador: PR curto com `PRIVACY_DRAFT = false` e `PRIVACY_UPDATED_AT` do dia, CI verde; **[confirmação do dono na hora]** para o merge (vira deploy). Sem essa aprovação, ninguém é convidado.
13. **Calendário do piloto** — Dono com a liderança do setor: dia 0 (segunda); dia −2 linha de base na planilha com cronômetro (C6-6); dia −1 convites; dias 0–7 com a planilha em paralelo; observador nos dias 1, 3 e 5; corte para a planilha com o app fora por mais de 15 min no horário da passagem; revisão de saída no dia 7 ou 8.
14. **Convites reais** (dia −1) — Dono (admin): um convite por operador em `/admin/equipe`, entregue em mãos ou por WhatsApp; cada um cria a passkey no próprio celular; cartão de treinamento de 5 linhas (como entregar, como receber, o dia operacional é o dia em que o turno começou, "Esqueceu a senha? peça o link ao administrador", onde ver `/privacidade`). **[confirmação do dono na hora]** antes do primeiro convite.
15. **Rotina diária** (Dono/admin, 10 min): `/dashboard` (últimos 7 dias): esperadas × entregues × confirmadas, sem passagem, não confirmadas, paradas; baixar o CSV do dia para uma pasta privada fora do repositório (cópia diária: mitigação do restore de 6 h do Free); Sentry: eventos novos (revisar se algum traz dado de pessoa, P69); Neon: consumo de CU-h do mês (100 no Free) — acima de 70% avisar o controlador; problemas no canal privado da equipe, nunca em issue pública. **Durante o piloto (C6-8):** anotar cada ocorrência de P23, P34, P35, P36, P44 e P53 numa `Atualização`; P57: um `EXPLAIN ANALYZE` das consultas do dashboard no SQL Editor do Neon, uma vez, fora do horário da passagem (gasta CU-h).
16. **Rollback** — app: Instant Rollback da Vercel (Hobby: só o deploy imediatamente anterior), depois promover o deploy bom (a atribuição automática do domínio desliga até alguém promover; as variáveis não voltam junto); banco: restaurar pela branch de segurança ou pelo restore de 6 h do Free; migração futura sempre expand-then-contract, com branch de segurança antes. **[confirmação do dono na hora]** em qualquer rollback.
17. **Rotação de segredos** (quando preciso) — `BETTER_AUTH_SECRET` novo na Vercel + redeploy (desloga todos; senhas e passkeys não dependem dele); senha do Neon: reset no console, atualizar `DATABASE_URL_POOLED` na Vercel, redeploy; DSN: trocar e redeploy. **[confirmação do dono na hora]**.
18. **Revisão de saída** (dia 7 ou 8) — Dono + equipe: tempo (mediana planilha × app), perda de informação, dias sem passagem, go/no-go; Controlador registra cada achado em `pendencias.md` como `Aberto, não triado` e revisa P65 (Pro e Launch).

---

## Perguntas resolvidas (2026-11-25)

Ambiguidades das decisões, da pesquisa e dos spikes que este plano resolveu; viram regras do plano.

1. **`/redefinir-senha` ou `/redefinir-senha/:path*` no cabeçalho.** `:path*` (spike `config`, igual ao convite): a doc instalada diz que `/blog/:slug*` casa `/blog`, então cobre a rota sem segmento; o E2E (T9) e o smoke (T10) conferem no caminho exato `/redefinir-senha`.
2. **Rodapé do `/entrar`: um parágrafo ou dois.** Dois (spike `reset`): `O acesso é só por convite.` continua sozinho e exato, então o `SignInPanel.test.tsx` e o `e2e/auth.spec.ts:103` não mudam; o `PrivacyLink` vem depois (T8).
3. **Quem chama o Sentry.** Só o `logServerError` (erro tratado, o do Better Auth e os limites de erro) e o `onRequestError` (erro lançado). O `global-error` do spike chamava `Sentry.captureException` direto e o `error.tsx` só logava: com um ponto só, nada é enviado sem passar pelo resumo do log, e o guarda impede um terceiro caminho. Erro com `digest` não é capturado de novo no cliente (o servidor já o reportou).
4. **Mensagem do Drizzle no Sentry.** O `scrubText` corta tudo a partir de `Failed query:` e de `params:`; o teste com `DrizzleQueryError` real e `linkedErrors` prova que nem o SQL nem os parâmetros saem. O spike não tratava isso.
5. **Criar e depois apagar, ou apagar e depois criar.** Apagar antes (falha fechado): a escrita do Better Auth não entra na nossa transação; se a criação falhar, não sobra link nenhum e o admin gera outro. Exceção à regra de `db.transaction()` registrada no código e no ADR.
6. **Linha da própria conta na Equipe.** Ganha só `Nova senha`: é a única ação que funciona para si mesmo, dá ao admin sem e-mail um caminho de recuperação enquanto houver uma sessão por passkey e permite o autoteste da Parte B (B9). Mudam o caso de `TeamAdmin.test.tsx` e o `e2e/cadastros.spec.ts` (e) (contrato da T5); a nota da linha continua.
7. **Compartilhar o link de nova senha.** Sim, como o convite (D-F6-2), pelo `useShareLink` extraído do `InviteLinkCard` num commit só de refatoração (T5-A) antes da feature (T5-B).
8. **Rótulo do envio da senha nova.** `Trocar a senha` (o resultado), não `Salvar senha` (ui-rules §2.4).
9. **Validade do link.** 24 h (`PASSWORD_RESET_TTL_MS`): o link vai por WhatsApp e pode ser lido no turno seguinte; 1 h obrigaria o admin a gerar de novo; 8 h é a alternativa conservadora, uma constante só.
10. **Como P12 fecha.** Pelo guarda E2E das telas: os tamanhos citados na pendência são de primitivos que nenhuma tela usa, e os achados reais do spike estavam todos em componentes nossos (4 lugares corrigidos e 1 exceção justificada, o link esticado). Se um primitivo abaixo de 44 px aparecer numa tela, o guarda reprova.
11. **Em que tarefa cada pendência muda.** Na que a fecha: P16 e P22 na T4, P12 na T7; P8 ganha a `Atualização` na T5 (é ali que o link do admin passa a existir), não na T10; P7 na T8 (a página de privacidade que a Meta pede passa a existir). A T10 só registra as novas e as `Atualização` de P1, P6 e P10.
12. **P22 fecha sem ver a Vercel.** Fecha no código (cabeçalho explícito, testado com a tabela `rate_limit` real); a conferência do log no primeiro deploy é passo da Parte B (B7) e fica listada em P63.
13. **`global-error` e o teste.** `Button` do shadcn e `<title>` próprio; testado no jsdom (verificado no planejamento: o React 19 usa os singletons do `document`, o efeito roda, o clique funciona e o único aviso é o de `<html>` dentro de `<div>`).
14. **Trava de host da migração (C6-3).** O `drizzle-kit` não tem trava; a trava é a conferência do host impresso pelo `bun run db:hosts` antes do `db:migrate`, com a URL direta lida por `read -rs` só naquele shell. Exportar `DATABASE_URL_UNPOOLED` (e `DATABASE_URL` igual) garante que nenhuma variável do `.env.local` vença.
15. **`--` no `admin:invite`.** Não: `bun run admin:invite --confirmar-host=…` repassa as flags ao script (comprovado na Fase 1 com `--label` e `--foo`); com `--` o script receberia um argumento `--` e recusaria.
16. **Contagem de admins no `admin:invite`.** Fora desta fase (P74): a trava de host cobre o erro grave (banco errado).
17. **Texto do IP em `/privacidade`.** Diz IP **e** navegador de cada acesso (a `session` guarda os dois); o spike dizia só o limite de tentativas.
18. **`PRIVACY_UPDATED_AT`.** A data do dia da execução, por extenso (`25 de novembro de 2026`); a troca de `PRIVACY_DRAFT` para `false` é um PR depois da aprovação da empresa (B12), nunca nesta fase.
19. **Smoke em `.mjs`.** O pedido é `scripts/smoke.mjs`; as regras puras vão em `scripts/smokeChecks.mjs` (sem efeito ao importar) e o teste em `test/smokeChecks.test.ts` importa o `.mjs` (o `tsconfig` tem `allowJs`; tipos em JSDoc).
20. **Onde ficam os testes de configuração.** `test/vercelConfig.test.ts` (configuração do repositório, como `pendenciasDoc`) e `src/app/robots.test.ts` separado do `nextConfig.test.ts`.
21. **`.github/workflows/ci.yml`.** Só o comentário do Node muda (o `engines` agora é `22.x`); nenhum job, passo ou permissão do CI muda, e nada é configurado no GitHub nesta fase.
22. **CSP completa.** Não no piloto (F6-3; ADR na T10).
23. **`environment` do Sentry.** `VERCEL_ENV ?? NODE_ENV`: no servidor da Vercel vale `production`; no navegador o `VERCEL_ENV` não é embutido e vale o `NODE_ENV` (`production`).
24. **`onRouterTransitionStart`.** Fica, como no spike: é inerte com `tracesSampleRate: 0` e evita reconfigurar quando o tracing for ligado.
25. **Contagens do E2E.** 35 até a T6, 37 depois da T7 (2 de `touch-targets`), 43 depois da T9 (3 de `redefinir-senha` + 3 de `publico`); subconjunto 22 (24 na T8, com `touch-targets`).

### Task 1: Configuração de produção (`vercel.json`, Node 22.x, cabeçalhos de segurança e noindex)

**Files:**
- Create: `vercel.json`
- Create: `src/app/robots.ts`
- Create: `src/app/robots.test.ts`
- Create: `test/vercelConfig.test.ts`
- Modify: `package.json` (só `engines.node`)
- Modify: `.github/workflows/ci.yml` (só o comentário do Node)
- Modify: `next.config.ts`
- Modify: `src/app/nextConfig.test.ts` (reescrito)
- Modify: `src/app/layout.tsx` (só `metadata.robots`)
- Modify: `.env.example` (só o comentário do `BETTER_AUTH_SECRET`)
- Modify: `.context/library-docs.md` (§1)

Nenhuma migração, nenhuma rota nova de API e nenhum teste existente além do `nextConfig.test.ts` muda. A tarefa não faz deploy nem fala com a Vercel: ela só deixa os arquivos de configuração prontos e provados por teste. O `vercel.json` só passa a valer quando o dono ligar a Vercel (Parte B, passo 5).

**Interfaces:**
- Consumes: nada.
- Produces: `vercel.json` (F6-1); `engines.node` `"22.x"` (F6-2); em `next.config.ts` as consts locais `securityHeaders` (os 6 cabeçalhos da F6-3, nesta ordem) e `noReferrer` (`[{ key: "Referrer-Policy", value: "no-referrer" }]`) e `headers()` → `[{ source: "/:path*", headers: securityHeaders }, { source: "/convite/:path*", headers: noReferrer }]` (a Tarefa 5 acrescenta a terceira regra; a 6 embrulha o `export default`); `src/app/robots.ts` (`export default function robots(): MetadataRoute.Robots`); `metadata.robots: { index: false, follow: false }` no layout raiz.

- [ ] **Step 0: Preparar a execução e medir a linha de base**

Rode, na raiz do repositório, na branch `feat/fase-6-producao`:

```bash
git branch --show-current
mkdir -p .git/sdd/f6
bun -e 'console.log(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()))'
bun run test
```

Expected: a branch `feat/fase-6-producao`; a data de hoje no formato `AAAA-MM-DD` (é a **DATA** das `Atualização`, do histórico e do ADR; onde as tarefas abaixo escrevem `<DATA>` entra a sua DATA; **substitua só os `<DATA>`: datas que já existem nos arquivos, como `2026-11-25` de um histórico antigo, ficam como estão**); e a suíte verde. No planejamento a linha de base foi **301 arquivos e 4194 testes** (`Test Files  301 passed (301)` e `Tests  4194 passed (4194)`); **anote os seus dois números**, porque o fim de cada tarefa abaixo diz o quanto ela acrescenta. Se o `migration0002.test.ts` estourar 15 s com a máquina carregada, repita só ele (`bunx vitest run src/db/schema/migration0002.test.ts`); se falhar isolado, BLOCKED.

- [ ] **Step 1: Conferir a documentação instalada do Next**

Leia, em `node_modules/next/dist/docs/01-app/`: `03-api-reference/05-config/01-next-config-js/headers.md` (o `:path*` casa também o caminho sem segmento; a regra posterior sobrescreve a anterior na mesma chave), `03-api-reference/03-file-conventions/01-metadata/robots.md` e `02-guides/content-security-policy.md` (CSP com nonce exige renderização dinâmica: por isso este plano **não** adota CSP de scripts). Nada a editar neste passo.

- [ ] **Step 2: Escrever o teste do `vercel.json`, do `engines` e do Node do CI (falhando)**

Crie `test/vercelConfig.test.ts` (o arquivo lê os próprios arquivos do repositório pelo caminho relativo à raiz, como o `test/pendenciasDoc.test.ts`):

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Guarda da configuração de produção: lê os próprios arquivos do repositório
// (caminho relativo à raiz, como o pendenciasDoc.test.ts).
function readJson(file: string) {
  return JSON.parse(readFileSync(file, "utf8"));
}

const vercel = readJson("vercel.json");
const pkg = readJson("package.json");

describe("vercel.json", () => {
  it("roda as funções em São Paulo (gru1), perto do Neon em sa-east-1", () => {
    expect(vercel.regions).toEqual(["gru1"]);
  });

  it("instala com o Bun do packageManager e lockfile congelado", () => {
    const bunVersion = String(pkg.packageManager).replace("bun@", "");
    expect(vercel.installCommand).toBe(
      `bunx bun@${bunVersion} install --frozen-lockfile`,
    );
  });

  it("builda com o script do projeto", () => {
    expect(vercel.buildCommand).toBe("bun run build");
  });

  it("só a main faz deploy (previews desligados); '**' casa branch com barra", () => {
    expect(vercel.git.deploymentEnabled).toEqual({ "**": false, main: true });
  });

  it("não fixa bunVersion: as funções rodam em Node", () => {
    expect(vercel.bunVersion).toBeUndefined();
  });
});

describe("package.json engines e CI", () => {
  it("fixa o Node 22.x (o padrão da Vercel não pode mudar a major sozinho)", () => {
    expect(pkg.engines.node).toBe("22.x");
  });

  it("o CI usa a mesma major do Node e tem ao menos um node-version", () => {
    const ci = readFileSync(".github/workflows/ci.yml", "utf8");
    const majors = [...ci.matchAll(/node-version:\s*"?(\d+)/g)].map(
      (match) => match[1],
    );
    expect(majors.length).toBeGreaterThan(0);
    for (const major of majors) {
      expect(major).toBe(String(pkg.engines.node).split(".")[0]);
    }
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `bun run test -- test/vercelConfig.test.ts`
Expected: FAIL: `Test Files  1 failed (1)`, `Tests  no tests`, com `Error: ENOENT: no such file or directory, open '<raiz do repositório>\vercel.json'` (o `readJson("vercel.json")` roda na carga do arquivo, então nenhum teste chega a rodar).

- [ ] **Step 4: Criar o `vercel.json`, fixar o Node e alinhar o comentário do CI**

Crie `vercel.json` com este conteúdo exato (2 espaços; `"**"` e não `"*"`: o padrão é minimatch e `*` não casa `/`, então uma branch `feat/x` escaparia e faria preview):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["gru1"],
  "installCommand": "bunx bun@1.3.3 install --frozen-lockfile",
  "buildCommand": "bun run build",
  "git": {
    "deploymentEnabled": {
      "**": false,
      "main": true
    }
  }
}
```

Em `package.json`, com a ferramenta Edit:

Edit em `package.json`:

`old_string`:

```json
    "node": ">=22.12"
```

`new_string`:

```json
    "node": "22.x"
```

Em `.github/workflows/ci.yml` (só o comentário; nenhum job, passo ou permissão do CI muda), com a ferramenta Edit (o texto tem acento: não use heredoc):

Edit em `.github/workflows/ci.yml`:

`old_string`:

```yaml
      # Vitest 5 exige Node >= 22.12 (engines do package.json).
```

`new_string`:

```yaml
      # A major do Node é a do engines.node ("22.x"); o Vitest 5 exige >= 22.12 (test/vercelConfig.test.ts amarra os dois).
```

Run: `bun run test -- test/vercelConfig.test.ts && git diff --quiet -- bun.lock && echo "bun.lock intacto"`
Expected: PASS (1 arquivo, 7 testes) e `bun.lock intacto` (o `engines` não mexe no lockfile; nenhum `install` roda aqui, a tarefa não usa a rede).

- [ ] **Step 5: Reescrever o teste dos cabeçalhos e escrever o do `robots` (falhando)**

Substitua o conteúdo de `src/app/nextConfig.test.ts` (o caso do `/convite` passa a conviver com a regra global; o `describe("robots")` não entra aqui, vai para o arquivo próprio):

```ts
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

async function rules() {
  return (await nextConfig.headers?.()) ?? [];
}

function headerValue(
  headers: { key: string; value: string }[] | undefined,
  key: string,
) {
  return headers?.find((header) => header.key === key)?.value;
}

async function globalHeaders() {
  return (await rules()).find((rule) => rule.source === "/:path*")?.headers;
}

describe("next.config headers", () => {
  it("/convite/* envia Referrer-Policy: no-referrer", async () => {
    const rule = (await rules()).find(
      (candidate) => candidate.source === "/convite/:path*",
    );
    expect(headerValue(rule?.headers, "Referrer-Policy")).toBe("no-referrer");
  });

  it("a regra de no-referrer vem depois da global (a posterior vence)", async () => {
    const sources = (await rules()).map((rule) => rule.source);
    expect(sources).toEqual(["/:path*", "/convite/:path*"]);
  });

  it("todas as rotas recebem os cabeçalhos de segurança", async () => {
    const headers = await globalHeaders();
    expect(headerValue(headers, "X-Content-Type-Options")).toBe("nosniff");
    expect(headerValue(headers, "Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headerValue(headers, "Content-Security-Policy")).toBe(
      "frame-ancestors 'none'",
    );
    expect(headerValue(headers, "X-Frame-Options")).toBe("DENY");
    expect(headerValue(headers, "X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it("Permissions-Policy desliga câmera, microfone e geolocalização", async () => {
    const policy = headerValue(await globalHeaders(), "Permissions-Policy");
    for (const feature of ["camera", "microphone", "geolocation"]) {
      expect(policy).toContain(`${feature}=()`);
    }
  });

  it("não bloqueia as passkeys: publickey-credentials-* ficam fora da política", async () => {
    const policy = headerValue(await globalHeaders(), "Permissions-Policy");
    expect(policy).not.toContain("publickey-credentials");
  });

  it("CSP só com frame-ancestors: um CSP de scripts exigiria nonce e renderização dinâmica", async () => {
    const csp = headerValue(await globalHeaders(), "Content-Security-Policy");
    expect(csp).not.toMatch(/script-src|default-src|style-src/);
  });

  it("não define HSTS: a Vercel já envia em *.vercel.app", async () => {
    expect(
      headerValue(await globalHeaders(), "Strict-Transport-Security"),
    ).toBeUndefined();
  });

  it("mantém as opções anteriores do arquivo", () => {
    expect(nextConfig.cacheComponents).toBe(true);
    expect(nextConfig.reactCompiler).toBe(true);
  });
});
```

Crie `src/app/robots.test.ts` (o layout importa `next/font/google`, que o Vitest não resolve: o caso do `metadata.robots` lê o texto do arquivo; o smoke da Tarefa 10 e o E2E da Tarefa 9 conferem a meta no HTML de verdade):

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import robots from "./robots";

describe("robots.txt", () => {
  it("proíbe todos os buscadores em todo o site", () => {
    expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
  });
});

describe("metadata do layout raiz", () => {
  // O layout importa next/font/google, que o Vitest não resolve: o guarda lê o
  // texto do arquivo (a meta sai no HTML; o smoke e o E2E conferem a página).
  it("pede noindex e nofollow", () => {
    const layout = readFileSync("src/app/layout.tsx", "utf8");
    expect(layout).toMatch(/robots:\s*\{\s*index:\s*false,\s*follow:\s*false/);
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `bun run test -- src/app/nextConfig.test.ts src/app/robots.test.ts`
Expected: FAIL. `nextConfig.test.ts (8 tests | 5 failed)`: o de ordem com `AssertionError: expected [ '/convite/:path*' ] to deeply equal [ '/:path*', '/convite/:path*' ]`, o dos seis cabeçalhos (`expected undefined to be 'nosniff'`) e os de `Permissions-Policy`, passkeys e CSP; `robots.test.ts` com `Error: Cannot find module './robots' imported from …/src/app/robots.test.ts`.

- [ ] **Step 7: Implementar os cabeçalhos, o `robots.ts` e a meta do layout**

Substitua o conteúdo de `next.config.ts` (as opções de antes ficam como estão; só entram as duas consts e o `headers()`). Sem CSP de scripts, sem HSTS (a Vercel já envia em `*.vercel.app`) e sem `publickey-credentials-*` na `Permissions-Policy`, para não bloquear as passkeys:

```ts
import type { NextConfig } from "next";

// Cabeçalhos de segurança de todas as rotas. Sem CSP de scripts: um CSP com
// nonce obriga renderização dinâmica em toda página e desliga o que o
// cacheComponents/PPR entrega (content-security-policy.md). Aqui só
// `frame-ancestors`, que não precisa de nonce. O HSTS a Vercel já envia
// (max-age=63072000; includeSubDomains; preload) em *.vercel.app.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Anti-clickjacking: CSP moderno + X-Frame-Options para navegador antigo.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  // Passkeys (WebAuthn) usam publickey-credentials-get/create, que por padrão
  // valem para a própria origem: por isso ficam fora desta lista.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Piloto interno: nada de buscador (o robots.txt é a outra metade).
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

// Tokens vão na URL: não podem vazar no Referer. Vem DEPOIS da regra global,
// que ela sobrescreve (mesma chave, regra posterior vence).
const noReferrer = [{ key: "Referrer-Policy", value: "no-referrer" }];

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
      { source: "/:path*", headers: securityHeaders },
      { source: "/convite/:path*", headers: noReferrer },
    ];
  },
};

export default nextConfig;
```

Crie `src/app/robots.ts` (entry file: `export default`):

```ts
import type { MetadataRoute } from "next";

// Piloto interno: nenhum buscador indexa nada (par do X-Robots-Tag e do
// metadata.robots do layout raiz).
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
```

Em `src/app/layout.tsx`, com a ferramenta Edit (a meta sai como `<meta name="robots" content="noindex, nofollow"/>` em toda página, porque nenhuma define `robots` próprio):

Edit em `src/app/layout.tsx`:

`old_string`:

```tsx
  description: "Passagem de turno simples, detalhada e rastreável.",
```

`new_string`:

```tsx
  description: "Passagem de turno simples, detalhada e rastreável.",
  // Piloto interno: fora dos buscadores (par do robots.ts e do X-Robots-Tag).
  robots: { index: false, follow: false },
```

Run: `bun run test -- src/app/nextConfig.test.ts src/app/robots.test.ts`
Expected: PASS (2 arquivos, 10 testes: 8 + 2).

- [ ] **Step 8: Documentar (`.env.example` e `library-docs.md` §1)**

Com a ferramenta Edit, em `.env.example`:

Edit em `.env.example`:

`old_string`:

```
# Em produção e em cada Preview da Vercel, use um valor próprio.
```

`new_string`:

```
# Em produção use um valor próprio (os previews da Vercel ficam desligados: vercel.json).
```

E em `.context/library-docs.md`, na seção 1 (Next.js), logo depois do item dos tipos globais:

Edit em `.context/library-docs.md`:

`old_string`:

```markdown
- `LayoutProps<"/">` / `PageProps<"/rota">` são tipos globais gerados pelo Next (typed routes).
```

`new_string`:

```markdown
- `LayoutProps<"/">` / `PageProps<"/rota">` são tipos globais gerados pelo Next (typed routes).
- **Cabeçalhos e robots (Fase 6).** `next.config.ts` envia os seis cabeçalhos de segurança em `/:path*`
  (`nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'`,
  `X-Frame-Options: DENY`, `Permissions-Policy` sem câmera, microfone e geolocalização, e
  `X-Robots-Tag: noindex, nofollow`) e `Referrer-Policy: no-referrer` em `/convite/:path*`; a regra
  posterior vence a global, então a ordem importa (`nextConfig.test.ts`). **Sem CSP de scripts** (nonce
  obriga renderização dinâmica e derruba o shell estático do `cacheComponents`) e **sem HSTS** (a
  Vercel já envia em `*.vercel.app`). `publickey-credentials-*` ficam fora da `Permissions-Policy` de
  propósito: o padrão `self` mantém as passkeys. Noindex em três camadas: `src/app/robots.ts`
  (`Disallow: /`), `metadata.robots` no layout raiz e o `X-Robots-Tag`.
- **`vercel.json` (Fase 6).** `regions: ["gru1"]`, `installCommand` com `bunx bun@<packageManager>`,
  `buildCommand: "bun run build"` e `git.deploymentEnabled: { "**": false, "main": true }` (previews
  desligados; `"**"` e não `"*"`, que não casa `/`). Sem `bunVersion` (é o runtime das funções, que
  rodam em Node). `engines.node` é `"22.x"`: `>=22.12` faria a Vercel subir para a major mais recente.
  `test/vercelConfig.test.ts` amarra `vercel.json`, `engines` e o Node do CI.
```

- [ ] **Step 9: Formatar, tipos, lint e suíte inteira**

Run: `bunx biome check --write vercel.json next.config.ts src/app test && bun run check-types && bun run lint && bun run test`
Expected: Biome sem pendência, `✓ Types generated successfully` e o `tsc` sem erro, lint verde e a suíte verde com **303 arquivos e 4208 testes** (a linha de base + 2 arquivos e + 14 testes: `vercelConfig` 7, `robots` 2 e `nextConfig` de 3 para 8, isto é, + 5). Se a sua linha de base for outra, o fim é a sua + 2 arquivos e + 14 testes.

- [ ] **Step 10: Build e conferência manual dos cabeçalhos num servidor de produção local**

Rode o bloco abaixo **inteiro numa chamada só** da ferramenta Bash: ela não guarda variáveis entre chamadas, e sem os `export` no mesmo bloco o `next start` leria o `.env.local` e falaria com o Neon de desenvolvimento (um serviço externo; o `/api/health` responderia 200 e os Expected abaixo não bateriam). O banco fictício recusa na hora (`ECONNREFUSED`), então nada toca o Neon. O bloco constrói, sobe o servidor na porta **3201** (a 3000 é de outro processo: nunca a use) e confere:

```bash
export DATABASE_URL="postgresql://closery:fake@127.0.0.1:1/closery?sslmode=disable"
export DATABASE_URL_POOLED="$DATABASE_URL"
export BETTER_AUTH_URL="http://localhost:3201"
export BETTER_AUTH_SECRET="segredo-local-de-teste-nao-usar-0123456789abcdef"
export NEXT_PUBLIC_SENTRY_DSN=""
bun run build
(bun run start -p 3201 > .git/sdd/f6/start-3201.log 2>&1 &)
curl -s -o /dev/null --retry 60 --retry-delay 1 --retry-connrefused http://localhost:3201/robots.txt
for p in / /entrar /convite/x; do echo "=== $p"; curl -sI "http://localhost:3201$p" | tr -d '\r' | grep -iE "^HTTP|^location|x-content|referrer|content-security|x-frame|permissions|x-robots"; done
echo "=== robots.txt"; curl -s http://localhost:3201/robots.txt
echo "=== meta"; curl -s http://localhost:3201/entrar | grep -o '<meta name="robots"[^>]*>'
echo "=== health"; curl -s -w " %{http_code}\n" http://localhost:3201/api/health
```

O build termina com: `✓ Compiled successfully`, `Finished TypeScript` e a tabela de rotas **igual à de antes** mais uma linha: `○ /robots.txt` (estática). As demais continuam como estavam (`◐` nas páginas, `ƒ /api/auth/[...all]`, `ƒ /api/dashboard/export`, `ƒ /api/health`, `ƒ Proxy (Middleware)`).

Saída esperada dos `curl` do mesmo bloco:

```text
=== /
HTTP/1.1 307 Temporary Redirect
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: frame-ancestors 'none'
X-Frame-Options: DENY
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-Robots-Tag: noindex, nofollow
location: /entrar
=== /entrar
HTTP/1.1 200 OK
(os mesmos 6 cabeçalhos, com Referrer-Policy: strict-origin-when-cross-origin)
=== /convite/x
HTTP/1.1 200 OK
(os mesmos 6 cabeçalhos, mas com Referrer-Policy: no-referrer)
=== robots.txt
User-Agent: *
Disallow: /

=== meta
<meta name="robots" content="noindex, nofollow"/>
=== health
{"status":"error","database":"unreachable"} 503
```

Encerre **só** o servidor da 3201:

```bash
PID=$(netstat -ano | grep ':3201' | grep LISTENING | awk '{print $5}' | head -1); taskkill //PID "$PID" //F
```

Expected: `ÊXITO: o processo com PID … foi finalizado.` e `netstat -ano | grep ':3201' | grep LISTENING` sem saída. Feche o shell da env fictícia.

- [ ] **Step 11: E2E inteiro (inclui o cenário da passkey)**

Em um shell **sem** as variáveis do passo anterior e com as portas 3200 e 54329 livres (`netstat -ano | grep -E ':(3200|54329)'` sem saída):

Run: `bun run test:e2e`
Expected: **35 passed** (7 `auth` + 6 `cadastros` + 7 `dashboard` + 6 `passagem` + 9 `solicitacoes`), em cerca de 1 minuto. O cenário de passkey do `auth.spec.ts` prova que a `Permissions-Policy` não bloqueia o WebAuthn. O log do `[app]` pode mostrar `portal "" does not exist` (P49) sem reprovar teste. Contagem diferente: BLOCKED com o número medido.

- [ ] **Step 12: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/f6/msg-task-1.txt` (texto exato abaixo) e rode:

```bash
git add vercel.json package.json .github/workflows/ci.yml next.config.ts src/app/nextConfig.test.ts src/app/robots.ts src/app/robots.test.ts src/app/layout.tsx test/vercelConfig.test.ts .env.example .context/library-docs.md
git commit -F .git/sdd/f6/msg-task-1.txt
```

Mensagem:

```text
chore(producao): configuração de produção

vercel.json com gru1, Bun fixado na instalação e previews desligados;
engines.node 22.x (o mesmo major do CI); cabeçalhos de segurança em toda
rota (nosniff, referrer, frame-ancestors, X-Frame-Options, permissions e
noindex) e Referrer-Policy no-referrer no convite; robots.txt e meta
robots. Sem CSP de scripts e sem HSTS, de propósito. Testes leem os
próprios arquivos de configuração.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 2: `logServerError` nos quatro lugares que escrevem no console

**Files:**
- Create: `src/lib/logServerError.ts`
- Create: `src/lib/logServerError.test.ts`
- Create: `src/app/api/health/route.test.ts`
- Create: `test/logGuard.test.ts`
- Modify: `src/features/admin/runAction.ts`
- Modify: `src/features/admin/runAction.test.ts`
- Modify: `src/app/api/health/route.ts`
- Modify: `src/app/error.tsx`
- Modify: `src/app/error.test.tsx`
- Modify: `src/app/(app)/error.tsx`
- Modify: `src/app/(app)/error.test.tsx`
- Modify: `.context/code-standards.md` (§6)
- Modify: `.context/ui-registry.md` (`AppError e AppNotFound`)

Um erro do Drizzle carrega no `message` o SQL e os parâmetros (`Failed query: … params: …`), e os parâmetros podem ser e-mail, hash de token ou texto da passagem. Hoje quatro lugares escrevem o erro inteiro no console (`runAction.ts:67`, `api/health/route.ts:26`, `error.tsx:14` e `(app)/error.tsx:17`). A tarefa cria o ponto único de log e passa os quatro por ele; a Tarefa 6 acrescenta a captura no Sentry dentro do mesmo arquivo.

**Interfaces:**
- Consumes: nada.
- Produces (assinaturas do Contrato): `export type ErrorSummary = { name: string; code: string | null; digest: string | null }`; `summarizeError(error: unknown): ErrorSummary`; `logServerError(error: unknown, context: string): void`. Contextos fixos desta tarefa: `"runAction"`, `"health"`, `"error-boundary"` (a Tarefa 6 acrescenta `"global-error"`). O módulo **não** tem `server-only` (os limites de erro do cliente também o usam) e não importa nada em tempo de execução.

- [ ] **Step 1: Escrever o teste do `logServerError` (falhando)**

Crie `src/lib/logServerError.test.ts` (o teste monta um `DrizzleQueryError` de verdade, com a causa do `pg`, para provar que o e-mail estava na mensagem e **não** sai no resumo):

```ts
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logServerError, summarizeError } from "./logServerError";

const SECRET = "ana@exemplo.test";

function pgError(code: string): Error {
  const error = new Error(`duplicate key value (${SECRET})`);
  error.name = "error";
  Object.assign(error, { code });
  return error;
}

describe("summarizeError", () => {
  it("erro do Drizzle: pega o SQLSTATE de cause.code e nunca a mensagem", () => {
    const error = new DrizzleQueryError(
      "insert into user values ($1)",
      [SECRET],
      pgError("23505"),
    );
    const summary = summarizeError(error);

    expect(summary).toEqual({
      name: "Error",
      code: "23505",
      digest: null,
    });
    expect(JSON.stringify(summary)).not.toContain(SECRET);
    expect(error.message).toContain(SECRET);
  });

  it("código direto no erro (rede) e digest do Next", () => {
    const error = Object.assign(new Error("boom"), {
      code: "ECONNREFUSED",
      digest: "1234567890",
    });
    expect(summarizeError(error)).toEqual({
      name: "Error",
      code: "ECONNREFUSED",
      digest: "1234567890",
    });
  });

  it("não-Error (string, null, objeto) vira NonError sem conteúdo", () => {
    for (const value of [SECRET, null, undefined, 42, { message: SECRET }]) {
      const summary = summarizeError(value);
      expect(summary.name).toBe("NonError");
      expect(JSON.stringify(summary)).not.toContain(SECRET);
    }
  });

  it("descarta code, digest e name com formato suspeito", () => {
    const error = Object.assign(new Error("x"), {
      code: `bad code ${SECRET}`,
      digest: `d ${SECRET}`,
    });
    error.name = `Nome ${SECRET}`;
    expect(summarizeError(error)).toEqual({
      name: "Error",
      code: null,
      digest: null,
    });
  });

  it("limita a profundidade da cadeia de causas e tolera ciclo", () => {
    const a: Record<string, unknown> = {};
    a.cause = a;
    expect(
      summarizeError(Object.assign(new Error("x"), { cause: a })).code,
    ).toBe(null);

    const deep = { cause: { cause: { cause: { code: "23505" } } } };
    expect(summarizeError(Object.assign(new Error("x"), deep)).code).toBeNull();
  });
});

describe("logServerError", () => {
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    spy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  it("escreve uma linha de JSON com contexto, nome, code e digest", () => {
    logServerError(
      new DrizzleQueryError("select $1", [SECRET], pgError("40001")),
      "runAction",
    );

    expect(spy).toHaveBeenCalledTimes(1);
    const line = String(spy.mock.calls[0]?.[0]);
    expect(JSON.parse(line)).toEqual({
      level: "error",
      context: "runAction",
      name: "Error",
      code: "40001",
      digest: null,
    });
    expect(line).not.toContain(SECRET);
    expect(line).not.toContain("select");
  });

  it("nada além da linha: o erro original nunca vai ao console", () => {
    const error = new Error(SECRET);
    logServerError(error, "x");
    expect(spy.mock.calls[0]).toHaveLength(1);
    expect(spy.mock.calls[0]?.[0]).not.toBe(error);
  });

  it("corta contexto longo", () => {
    logServerError(new Error("x"), "c".repeat(500));
    const line = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(line.context).toHaveLength(80);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bun run test -- src/lib/logServerError.test.ts`
Expected: FAIL: `Test Files  1 failed (1)`, `Tests  no tests`, com `Error: Cannot find module './logServerError' imported from …/src/lib/logServerError.test.ts`.

- [ ] **Step 3: Implementar `logServerError.ts`**

Crie `src/lib/logServerError.ts`. O `pick` usa `Reflect.get` depois do `typeof value === "object" && value !== null` (sem `as`); `name`, `code` e `digest` só passam se casarem com uma expressão segura; o `code` é procurado em `error.code` e em até 3 níveis de `cause` (o `DrizzleQueryError` guarda o SQLSTATE do Postgres na causa, e o `name` dele é só `"Error"`):

```ts
// Log de erro sem vazamento. Um erro do Drizzle carrega no `message` o SQL e os
// parâmetros ("Failed query: ... params: ..."), e esses parâmetros podem ser
// e-mail, hash de token, texto da passagem. Por isso o log nunca recebe o erro
// inteiro nem a mensagem: só o nome da classe, o código (SQLSTATE do Postgres,
// ex.: 23505, ou código de rede, ex.: ECONNREFUSED), o digest do Next e o
// contexto que quem chama escreve. Sem `server-only`: os error boundaries do
// client também usam (lá só o digest existe).

export type ErrorSummary = {
  name: string;
  code: string | null;
  digest: string | null;
};

const SAFE_NAME = /^[A-Za-z0-9_$.]{1,64}$/;
const SAFE_CODE = /^[A-Za-z0-9_]{1,32}$/;
const SAFE_DIGEST = /^[A-Za-z0-9_-]{1,64}$/;
const CONTEXT_MAX_LENGTH = 80;
const CAUSE_DEPTH = 3;

function pick(value: unknown, key: string): unknown {
  return typeof value === "object" && value !== null
    ? Reflect.get(value, key)
    : undefined;
}

function safeString(value: unknown, pattern: RegExp): string | null {
  return typeof value === "string" && pattern.test(value) ? value : null;
}

// O DrizzleQueryError traz o erro do `pg` em `cause`; o SQLSTATE está lá.
function findCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < CAUSE_DEPTH; depth++) {
    const code = safeString(pick(current, "code"), SAFE_CODE);
    if (code) return code;
    current = pick(current, "cause");
    if (current === undefined) break;
  }
  return null;
}

export function summarizeError(error: unknown): ErrorSummary {
  const name =
    error instanceof Error
      ? (safeString(error.name, SAFE_NAME) ?? "Error")
      : "NonError";
  return {
    name,
    code: findCode(error),
    digest: safeString(pick(error, "digest"), SAFE_DIGEST),
  };
}

// Uma linha de JSON: a Vercel indexa os campos e o Sentry (depois) lê igual.
export function logServerError(error: unknown, context: string): void {
  console.error(
    JSON.stringify({
      level: "error",
      context: context.slice(0, CONTEXT_MAX_LENGTH),
      ...summarizeError(error),
    }),
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bun run test -- src/lib/logServerError.test.ts`
Expected: PASS (1 arquivo, 8 testes).

- [ ] **Step 5: Escrever o teste do `GET /api/health` (a rota não tinha teste)**

Crie `src/app/api/health/route.test.ts`. O banco de verdade (PGlite) entra no lugar de `@/db` por um getter, como nos testes de action; no caso de falha o banco é trocado por um que recusa com um `DrizzleQueryError`. O `connection()` do Next só existe dentro de uma requisição e é simulado:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { DrizzleQueryError } from "drizzle-orm/errors";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

import { createTestDb, type TestDb } from "../../../../test/db";

// O banco de verdade (PGlite) entra no lugar de "@/db" por um getter, como nos
// testes de action; o caso de falha troca o banco por um que recusa.
const mocks = vi.hoisted(() => {
  const database: { current: unknown } = { current: undefined };
  return { database };
});

vi.mock("@/db", () => ({
  get db() {
    return mocks.database.current;
  },
}));
// connection() só existe dentro de uma requisição do Next.
vi.mock("next/server", () => ({ connection: async () => {} }));

import { GET } from "./route";

const SECRET = "ana@exemplo.test";

let client: PGlite;
let db: TestDb;
let consoleError: MockInstance;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(() => {
  mocks.database.current = db;
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("GET /api/health", () => {
  it("com o banco no ar: 200 com a latência em milissegundos", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.database).toBe("ok");
    expect(typeof body.latencyMs).toBe("number");
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("com o banco recusando: 503 sem detalhe e uma linha de log sem a mensagem do erro", async () => {
    const pgError = Object.assign(new Error(`connect failed (${SECRET})`), {
      code: "ECONNREFUSED",
    });
    mocks.database.current = {
      transaction: async () => {
        throw new DrizzleQueryError("select 1", [SECRET], pgError);
      },
    };

    const response = await GET();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      status: "error",
      database: "unreachable",
    });
    expect(consoleError).toHaveBeenCalledTimes(1);
    const line = String(consoleError.mock.calls[0]?.[0]);
    expect(JSON.parse(line)).toEqual({
      level: "error",
      context: "health",
      name: "Error",
      code: "ECONNREFUSED",
      digest: null,
    });
    expect(line).not.toContain(SECRET);
  });
});
```

Run: `bun run test -- src/app/api/health/route.test.ts`
Expected: FAIL parcial: `Tests  1 failed | 1 passed (2)`. O caso do 200 passa (a rota já responde com o banco); o do 503 falha com `SyntaxError: Unexpected token 'h', "[health] fa"... is not valid JSON` (a linha de hoje é o texto `[health] falha ao consultar o banco`, com o erro como segundo argumento, e não uma linha JSON).

- [ ] **Step 6: Escrever as provas dos outros três lugares e o guarda do console (falhando)**

Em `src/features/admin/runAction.test.ts`, no caso `exceção inesperada vira INTERNAL sem vazar o texto do erro`, com a ferramenta Edit (a linha de log passa a ser **um** argumento, JSON, com o contexto e sem o segredo):

Edit em `src/features/admin/runAction.test.ts`:

`old_string`:

```ts
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("valor que não é Error também vira INTERNAL"
```

`new_string`:

```ts
    expect(consoleError).toHaveBeenCalledTimes(1);
    const logged = consoleError.mock.calls[0] ?? [];
    expect(logged).toHaveLength(1);
    expect(String(logged[0])).not.toContain("hunter2");
    expect(JSON.parse(String(logged[0])).context).toBe("runAction");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("valor que não é Error também vira INTERNAL"
```

Em `src/app/error.test.tsx`, com a ferramenta Edit:

Edit em `src/app/error.test.tsx`:

`old_string`:

```tsx
  it("não vaza a mensagem do erro na tela, mas registra no console", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const error = new Error("senha do banco: hunter2");
    render(<ErrorPage error={error} retry={vi.fn()} />);

    expect(screen.queryByText(/hunter2/)).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(error);
  });
```

`new_string`:

```tsx
  it("não vaza a mensagem do erro na tela, mas registra só o resumo no console", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const error = new Error("senha do banco: hunter2");
    render(<ErrorPage error={error} retry={vi.fn()} />);

    expect(screen.queryByText(/hunter2/)).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledTimes(1);
    const logged = String(consoleError.mock.calls[0]?.[0]);
    expect(logged).toContain("error-boundary");
    expect(logged).not.toContain("hunter2");
  });
```

Em `src/app/(app)/error.test.tsx`, com a ferramenta Edit:

Edit em `src/app/(app)/error.test.tsx`:

`old_string`:

```tsx
  it("não vaza a mensagem do erro na tela, mas registra no console", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const error = new Error("senha do banco: hunter2");
    render(<AppError error={error} retry={vi.fn()} />);

    expect(screen.queryByText(/hunter2/)).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledWith(error);
  });
```

`new_string`:

```tsx
  it("não vaza a mensagem do erro na tela, mas registra só o resumo no console", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const error = new Error("senha do banco: hunter2");
    render(<AppError error={error} retry={vi.fn()} />);

    expect(screen.queryByText(/hunter2/)).not.toBeInTheDocument();
    expect(consoleError).toHaveBeenCalledTimes(1);
    const logged = String(consoleError.mock.calls[0]?.[0]);
    expect(logged).toContain("error-boundary");
    expect(logged).not.toContain("hunter2");
  });
```

Crie `test/logGuard.test.ts` (usa `listSourceFiles` e `stripComments` de `test/actionGuards.ts`; em `src/` fora dos `*.test.*`, `console.` só pode aparecer em `src/lib/logServerError.ts`):

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { listSourceFiles, stripComments } from "./actionGuards";

// Guarda do log: um erro do Drizzle carrega SQL e parâmetros na mensagem, então
// nada em src/ escreve no console por conta própria. Todo erro inesperado passa
// por src/lib/logServerError.ts (resumo sem mensagem, pilha nem objeto).

const LOGGER = "src/lib/logServerError.ts";

function productionFiles(): string[] {
  return listSourceFiles(
    "src",
    (name) => /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name),
  ).map((file) => file.replaceAll("\\", "/"));
}

function code(file: string): string {
  return stripComments(readFileSync(file, "utf8"));
}

describe("log de erro", () => {
  it("só o logServerError escreve no console em src/", () => {
    const offenders = productionFiles().filter(
      (file) => file !== LOGGER && /\bconsole\./.test(code(file)),
    );
    expect(offenders).toEqual([]);
  });

  it("o logServerError é o único que escreve, e escreve uma vez", () => {
    expect(code(LOGGER).match(/\bconsole\./g)).toHaveLength(1);
  });

  it("a varredura enxerga os arquivos de produção (não passa por estar vazia)", () => {
    const files = productionFiles();
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain(LOGGER);
  });
});
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `bun run test -- src/features/admin/runAction.test.ts src/app/error.test.tsx "src/app/(app)/error.test.tsx" src/app/api/health/route.test.ts test/logGuard.test.ts`
Expected: FAIL: `Test Files  5 failed (5)` e `Tests  5 failed | 20 passed (25)`. As cinco falhas: `error.tsx` e `(app)/error.tsx` com `AssertionError: expected 'Error: senha do banco: hunter2' to contain 'error-boundary'` (o console recebe hoje o próprio erro); `runAction.test.ts` com `AssertionError: expected [ 'runAction: falha inesperada', …(1) ] to have a length of 1 but got 2`; `route.test.ts` com o `SyntaxError` do Step 5; e `test/logGuard.test.ts > só o logServerError escreve no console em src/` com `expected [ 'src/app/(app)/error.tsx', …(3) ] to deeply equal []` e, no diff, exatamente os quatro arquivos: `src/app/(app)/error.tsx`, `src/app/api/health/route.ts`, `src/app/error.tsx` e `src/features/admin/runAction.ts`. Os outros dois casos do `logGuard` já passam (o `logServerError.ts` existe e é o único que escreve).

- [ ] **Step 8: Trocar os quatro lugares por `logServerError`**

`src/features/admin/runAction.ts` (a linha fica **depois** do `unstable_rethrow(error)`, que deixa passar o `redirect()` e o `notFound()`), com a ferramenta Edit, nesta ordem:

Edit em `src/features/admin/runAction.ts`:

`old_string`:

```ts
import type { Authz } from "@/features/authz/authz";
```

`new_string`:

```ts
import type { Authz } from "@/features/authz/authz";
import { logServerError } from "@/lib/logServerError";
```

Edit em `src/features/admin/runAction.ts`:

`old_string`:

```ts
    console.error("runAction: falha inesperada", error);
```

`new_string`:

```ts
    logServerError(error, "runAction");
```

`src/app/api/health/route.ts`:

Edit em `src/app/api/health/route.ts`:

`old_string`:

```ts
import { db } from "@/db";
```

`new_string`:

```ts
import { db } from "@/db";
import { logServerError } from "@/lib/logServerError";
```

Edit em `src/app/api/health/route.ts`:

`old_string`:

```ts
    console.error("[health] falha ao consultar o banco", error);
```

`new_string`:

```ts
    logServerError(error, "health");
```

`src/app/error.tsx`:

Edit em `src/app/error.tsx`:

`old_string`:

```tsx
import { Button } from "@/components/ui/button";
```

`new_string`:

```tsx
import { Button } from "@/components/ui/button";
import { logServerError } from "@/lib/logServerError";
```

Edit em `src/app/error.tsx`:

`old_string`:

```tsx
    console.error(error);
```

`new_string`:

```tsx
    logServerError(error, "error-boundary");
```

`src/app/(app)/error.tsx`:

Edit em `src/app/(app)/error.tsx`:

`old_string`:

```tsx
import { Button } from "@/components/ui/button";
```

`new_string`:

```tsx
import { Button } from "@/components/ui/button";
import { logServerError } from "@/lib/logServerError";
```

Edit em `src/app/(app)/error.tsx`:

`old_string`:

```tsx
    console.error(error);
```

`new_string`:

```tsx
    logServerError(error, "error-boundary");
```

Run: `bun run test -- src/lib/logServerError.test.ts src/features/admin/runAction.test.ts src/app/error.test.tsx "src/app/(app)/error.test.tsx" src/app/api/health/route.test.ts test/logGuard.test.ts`
Expected: PASS (6 arquivos, 33 testes: 8 + 11 + 4 + 5 + 2 + 3; o `runAction.test.ts` continua com os 11 de antes).

- [ ] **Step 9: Documentar (`code-standards.md` §6 e `ui-registry.md`)**

Em `.context/code-standards.md`, na seção 6, com a ferramenta Edit:

Edit em `.context/code-standards.md`:

`old_string`:

```markdown
- **Escrita multi-statement roda em `db.transaction()`** (`library-docs.md §5`, D18).
```

`new_string`:

```markdown
- **Escrita multi-statement roda em `db.transaction()`** (`library-docs.md §5`, D18).
- **Erro inesperado só por `logServerError(error, contexto)`** (`src/lib/logServerError.ts`): uma linha
  JSON com contexto, nome da classe, código (SQLSTATE ou de rede) e digest, **nunca** `message`, pilha
  nem o objeto do erro (o `DrizzleQueryError` leva o SQL e os parâmetros na mensagem). Em `src/`
  nenhum outro arquivo chama `console.*` (guarda `test/logGuard.test.ts`).
```

Em `.context/ui-registry.md`, na entrada `AppError e AppNotFound`, com a ferramenta Edit (duas edições; a data do histórico é a **DATA** do Step 0 da Tarefa 1):

Edit em `.context/ui-registry.md`:

`old_string`:

```markdown
(`retry()`; o erro vai para o `console.error` e a mensagem nunca aparece)
```

`new_string`:

```markdown
(`retry()`; o erro vai para `logServerError(error, "error-boundary")`, que escreve só o resumo, e a mensagem nunca aparece)
```

Edit em `.context/ui-registry.md`:

`old_string`:

```markdown
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 3, P19).
```

`new_string`:

```markdown
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 3, P19). <DATA> — Fase 6 (Tarefa 2): o `useEffect` deste arquivo e o do `error.tsx` da raiz chamam `logServerError(error, "error-boundary")` no lugar de `console.error(error)`; a tela não muda.
```

- [ ] **Step 10: Formatar, tipos, lint e suíte inteira**

Run: `bunx biome check --write src test && bun run check-types && bun run lint && bun run test`
Expected: tudo verde; **306 arquivos e 4221 testes** (o fim da Tarefa 1 + 3 arquivos e + 13 testes: `logServerError` 8, `health` 2 e `logGuard` 3; nenhum teste existente some).

- [ ] **Step 11: Build e a linha real do log**

Rode o bloco abaixo **inteiro numa chamada só** da ferramenta Bash (ela não guarda variáveis entre chamadas: sem os `export` aqui dentro o `next start` leria o `.env.local` e falaria com o Neon de desenvolvimento). A env fictícia é a do Step 10 da Tarefa 1:

```bash
export DATABASE_URL="postgresql://closery:fake@127.0.0.1:1/closery?sslmode=disable"
export DATABASE_URL_POOLED="$DATABASE_URL"
export BETTER_AUTH_URL="http://localhost:3201"
export BETTER_AUTH_SECRET="segredo-local-de-teste-nao-usar-0123456789abcdef"
export NEXT_PUBLIC_SENTRY_DSN=""
bun run build
(bun run start -p 3201 > .git/sdd/f6/start-3201.log 2>&1 &)
curl -s -o /dev/null --retry 60 --retry-delay 1 --retry-connrefused http://localhost:3201/robots.txt
curl -s -w " %{http_code}\n" http://localhost:3201/api/health
tail -n 1 .git/sdd/f6/start-3201.log
PID=$(netstat -ano | grep ':3201' | grep LISTENING | awk '{print $5}' | head -1); taskkill //PID "$PID" //F
```

Expected: o build verde com as mesmas rotas; a resposta `{"status":"error","database":"unreachable"} 503` e, no log, **uma linha** `{"level":"error","context":"health","name":"Error","code":"ECONNREFUSED","digest":null}` (nenhuma mensagem, pilha nem objeto). Feche o shell da env fictícia.

- [ ] **Step 12: E2E do subconjunto**

Em um shell sem as variáveis fictícias, com as portas 3200 e 54329 livres:

Run: `bun run test:e2e -- e2e/auth.spec.ts e2e/passagem.spec.ts e2e/solicitacoes.spec.ts`
Expected: **22 passed** (7 + 6 + 9).

- [ ] **Step 13: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/f6/msg-task-2.txt` e rode:

```bash
git add src/lib/logServerError.ts src/lib/logServerError.test.ts src/features/admin/runAction.ts src/features/admin/runAction.test.ts src/app/api/health src/app/error.tsx src/app/error.test.tsx "src/app/(app)/error.tsx" "src/app/(app)/error.test.tsx" test/logGuard.test.ts .context/code-standards.md .context/ui-registry.md
git commit -F .git/sdd/f6/msg-task-2.txt
```

Mensagem:

```text
fix(log): erro inesperado só por logServerError

O DrizzleQueryError leva o SQL e os parâmetros na mensagem. O log passa a
escrever uma linha JSON com contexto, nome, código e digest, nunca a
mensagem, a pilha nem o objeto. runAction, /api/health e os dois limites
de erro usam o ponto único; test/logGuard.test.ts impede console.* fora
dele. Teste novo da rota de saúde.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 3: Trava de host do `admin:invite` e `db:hosts`

**Files:**
- Create: `src/db/databaseHost.ts`
- Create: `src/db/databaseHost.test.ts`
- Create: `scripts/dbHosts.ts`
- Modify: `src/features/invites/adminInvite.ts`
- Modify: `src/features/invites/adminInvite.test.ts`
- Modify: `scripts/adminInvite.ts`
- Modify: `package.json` (script `db:hosts`)
- Modify: `AGENTS.md` (tabela de comandos)
- Modify: `.context/architecture.md` (§4 e §7)

Exportar só `DATABASE_URL` não basta: o `resolveDatabaseUrls` prefere `DATABASE_URL_POOLED`, e um `.env.local` com o pooler de **desenvolvimento** faria o convite do primeiro administrador ir para o banco de dev com o link de produção, sem erro nenhum. A trava obriga quem roda a dizer, por extenso, em qual banco está escrevendo, e o `db:hosts` dá a mesma conferência para a migração (o `drizzle-kit` não tem trava). Nada de produção é tocado: o script real roda com uma env fictícia e **recusa antes de abrir qualquer conexão**.

**Interfaces:**
- Consumes: `resolveDatabaseUrls` e o tipo `DatabaseUrls` de `@/db/databaseUrl`; `createInvite`, `buildInviteUrl`, `isHttpUrl` (já usados pelo `adminInvite.ts`).
- Produces: `databaseHostOf(connectionString: string): string` e `formatDatabaseHosts(urls: DatabaseUrls): string` (em `src/db/databaseHost.ts`, sem `server-only`); `AdminInviteArgs = { label: string | null; confirmHost: string | null }`, `parseAdminInviteArgs(argv): AdminInviteArgs`, `assertHostConfirmed(databaseHost, confirmHost): void` e `formatAdminInviteTarget({ databaseHost, baseURL }): string` e `formatAdminInviteError(error: unknown): string` (em `adminInvite.ts`; o script imprime só a mensagem dos erros próprios e, para qualquer outro erro, uma linha sem SQL nem parâmetros); o script `bun run db:hosts`. `createAdminInvite` e `formatAdminInviteOutput` não mudam. A Tarefa 10 (runbook) usa o `db:hosts`.

- [ ] **Step 1: Escrever o teste de `databaseHostOf` e `formatDatabaseHosts` (falhando)**

Crie `src/db/databaseHost.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { databaseHostOf, formatDatabaseHosts } from "./databaseHost";

describe("databaseHostOf", () => {
  it("devolve só o host, em minúsculas, sem usuário, senha, porta ou banco", () => {
    expect(
      databaseHostOf(
        "postgres://usr:s3nha@EP-abc-pooler.sa-east-1.aws.neon.tech:5432/db?sslmode=require",
      ),
    ).toBe("ep-abc-pooler.sa-east-1.aws.neon.tech");
  });

  it("o -pooler faz parte do host", () => {
    expect(databaseHostOf("postgresql://u:p@ep-a-pooler.example.test/db")).toBe(
      "ep-a-pooler.example.test",
    );
    expect(databaseHostOf("postgresql://u:p@ep-a.example.test/db")).toBe(
      "ep-a.example.test",
    );
  });

  it("string inválida ou vazia lança sem repetir o conteúdo (pode ter senha)", () => {
    for (const value of ["nao-e-url-s3nha", "", "postgres://u:s3nha@/db"]) {
      expect(() => databaseHostOf(value)).toThrow(
        "DATABASE_URL não é uma URL de conexão válida.",
      );
      try {
        databaseHostOf(value);
      } catch (error) {
        expect(String(error)).not.toContain("s3nha");
      }
    }
  });
});

describe("formatDatabaseHosts", () => {
  it("duas linhas: o host da aplicação e o das migrações, nunca usuário nem senha", () => {
    const text = formatDatabaseHosts({
      runtime: "postgresql://usr:s3nha@ep-a-pooler.example.test/db",
      migration: "postgresql://usr:s3nha@ep-a.example.test/db",
    });
    expect(text).toBe(
      [
        "Banco da aplicação (runtime): ep-a-pooler.example.test",
        "Banco das migrações (drizzle-kit): ep-a.example.test",
      ].join("\n"),
    );
    expect(text).not.toContain("s3nha");
    expect(text).not.toContain("usr");
  });

  it("variável ausente vira 'ausente' e URL inválida vira 'inválida'", () => {
    expect(
      formatDatabaseHosts({ runtime: undefined, migration: "lixo-s3nha" }),
    ).toBe(
      [
        "Banco da aplicação (runtime): ausente",
        "Banco das migrações (drizzle-kit): inválida",
      ].join("\n"),
    );
  });
});
```

Run: `bun run test -- src/db/databaseHost.test.ts`
Expected: FAIL: `Test Files  1 failed (1)`, `Tests  no tests`, com `Error: Cannot find module './databaseHost' imported from …/src/db/databaseHost.test.ts`.

- [ ] **Step 2: Reescrever o teste dos argumentos e da trava (falhando)**

Substitua o conteúdo de `src/features/invites/adminInvite.test.ts`. Os casos de `--label` de hoje continuam, agora com `confirmHost: null` no resultado (máximo de 80 aceito, 81 recusado, `=` e unicode preservados); entram os da `--confirmar-host`, os da `assertHostConfirmed` (inclusive prefixo e sufixo) e o do `formatAdminInviteTarget`. Os casos de `createAdminInvite` e `formatAdminInviteOutput` não mudam; entra no fim do arquivo o `describe("formatAdminInviteError")` (2 casos: o erro do próprio script mantém a mensagem; o `DrizzleQueryError` com `params` de e-mail vira uma linha sem e-mail nem SQL e com o código `23505`):

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { invite } from "@/db/schema/invites";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  ADMIN_INVITE_LABEL_MAX_LENGTH,
  assertHostConfirmed,
  createAdminInvite,
  formatAdminInviteError,
  formatAdminInviteOutput,
  formatAdminInviteTarget,
  parseAdminInviteArgs,
} from "./adminInvite";
import { consumeInvite, findInviteByToken } from "./inviteQueries";
import { INVITE_TTL_MS } from "./inviteState";
import { hashInviteToken } from "./token";

const NOW = new Date("2026-11-20T12:00:00.000Z");

describe("parseAdminInviteArgs: --confirmar-host", () => {
  it("aceita as duas formas e convive com --label", () => {
    expect(parseAdminInviteArgs(["--confirmar-host=db.example.com"])).toEqual({
      label: null,
      confirmHost: "db.example.com",
    });
    expect(
      parseAdminInviteArgs(["--confirmar-host", "db.example.com", "--label=A"]),
    ).toEqual({ label: "A", confirmHost: "db.example.com" });
  });

  it("vazio vira nulo; sem valor e repetido lançam", () => {
    expect(
      parseAdminInviteArgs(["--confirmar-host=  "]).confirmHost,
    ).toBeNull();
    expect(() => parseAdminInviteArgs(["--confirmar-host"])).toThrow(
      "Falta o valor de --confirmar-host.",
    );
    expect(() =>
      parseAdminInviteArgs(["--confirmar-host=a", "--confirmar-host=b"]),
    ).toThrow("--confirmar-host foi informado mais de uma vez.");
  });

  it("as mensagens trazem o uso novo, com a flag obrigatória", () => {
    expect(() => parseAdminInviteArgs(["--confirmar-host"])).toThrow(
      'Falta o valor de --confirmar-host. Uso: bun run admin:invite --confirmar-host=<host do banco> [--label "Nome de referência"]',
    );
  });

  it("flag com o nome parecido não vale como --confirmar-host", () => {
    expect(() => parseAdminInviteArgs(["--confirmar-hostx=a"])).toThrow(
      "Argumento desconhecido: --confirmar-hostx=a.",
    );
  });
});

describe("assertHostConfirmed", () => {
  it("passa quando confere, ignorando maiúsculas", () => {
    expect(() =>
      assertHostConfirmed("db.example.com", "DB.example.com"),
    ).not.toThrow();
  });

  it("sem confirmação recusa e diz como confirmar", () => {
    expect(() => assertHostConfirmed("db.example.com", null)).toThrow(
      "--confirmar-host=db.example.com",
    );
  });

  it("host diferente recusa (inclusive prefixo e sufixo)", () => {
    expect(() =>
      assertHostConfirmed("db.example.com", "outro.example.com"),
    ).toThrow("não confere");
    expect(() =>
      assertHostConfirmed("db.example.com", "db.example.com.evil"),
    ).toThrow("não confere");
    expect(() => assertHostConfirmed("db.example.com", "db.example")).toThrow(
      "não confere",
    );
  });
});

describe("formatAdminInviteTarget", () => {
  it("mostra só o host do banco e a BETTER_AUTH_URL", () => {
    const text = formatAdminInviteTarget({
      databaseHost: "db.example.com",
      baseURL: "https://app.vercel.app",
    });
    expect(text).toContain("Banco de destino: db.example.com");
    expect(text).toContain("BETTER_AUTH_URL:  https://app.vercel.app");
  });
});

describe("parseAdminInviteArgs", () => {
  it("sem argumentos: label nulo", () => {
    expect(parseAdminInviteArgs([])).toEqual({
      label: null,
      confirmHost: null,
    });
  });

  it("aceita --label Nome e --label=Nome", () => {
    expect(parseAdminInviteArgs(["--label", "Dono do sistema"])).toEqual({
      label: "Dono do sistema",
      confirmHost: null,
    });
    expect(parseAdminInviteArgs(["--label=Dono do sistema"])).toEqual({
      label: "Dono do sistema",
      confirmHost: null,
    });
  });

  it("apara espaços e trata vazio como nulo", () => {
    expect(parseAdminInviteArgs(["--label", "  Nome  "])).toEqual({
      label: "Nome",
      confirmHost: null,
    });
    expect(parseAdminInviteArgs(["--label="])).toEqual({
      label: null,
      confirmHost: null,
    });
    expect(parseAdminInviteArgs(["--label", "   "])).toEqual({
      label: null,
      confirmHost: null,
    });
  });

  it("preserva '=' e unicode dentro do valor", () => {
    expect(parseAdminInviteArgs(["--label=a=b ção"])).toEqual({
      label: "a=b ção",
      confirmHost: null,
    });
  });

  it("aceita exatamente o tamanho máximo e rejeita um a mais", () => {
    const max = "x".repeat(ADMIN_INVITE_LABEL_MAX_LENGTH);

    expect(parseAdminInviteArgs([`--label=${max}`])).toEqual({
      label: max,
      confirmHost: null,
    });
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

describe("formatAdminInviteError", () => {
  it("mantém a mensagem dos erros do próprio script", () => {
    expect(
      formatAdminInviteError(new Error("--confirmar-host não confere.")),
    ).toBe("Erro: --confirmar-host não confere.");
  });

  it("erro do banco vira uma linha sem SQL, parâmetros nem e-mail, com o código", () => {
    const cause = Object.assign(new Error("duplicate key value"), {
      code: "23505",
    });
    const error = new DrizzleQueryError(
      'insert into "invite" ("token_hash") values ($1)',
      ["ana@exemplo.test"],
      cause,
    );

    const text = formatAdminInviteError(error);

    expect(text).toBe(
      "Erro: falha inesperada ao gravar o convite (DrizzleQueryError, código 23505). Confira no banco se o convite foi criado antes de rodar de novo.",
    );
    expect(text).not.toContain("ana@exemplo.test");
    expect(text).not.toContain("insert");
  });
});
```

Run: `bun run test -- src/features/invites/adminInvite.test.ts`
Expected: FAIL: `Test Files  1 failed (1)` e `Tests  14 failed | 10 passed (24)`: os de `--confirmar-host` falham com `Error: Argumento desconhecido: --confirmar-host=db.example.com. Uso: bun run admin:invite [--label "Nome de referência"]` (o parser de hoje só conhece `--label`); os de `assertHostConfirmed` com `TypeError: (0 , __vite_ssr_import_5__.assertHostConfirmed) is not a function` o de `formatAdminInviteTarget` com `TypeError: formatAdminInviteTarget is not a function` e os dois de `formatAdminInviteError` com `TypeError: formatAdminInviteError is not a function` (ainda não existem); os de `--label` com `expected { label: null } to deeply equal { label: null, confirmHost: null }`. Os de `formatAdminInviteOutput` e `createAdminInvite` continuam passando.

- [ ] **Step 3: Implementar `databaseHost.ts` e a nova `adminInvite.ts`**

Crie `src/db/databaseHost.ts` (o `databaseHostOf` nunca repete a string: ela tem a senha; URL vazia ou sem host vira o mesmo erro):

```ts
import type { DatabaseUrls } from "./databaseUrl";

// Sem `server-only`: os scripts de linha de comando (admin:invite, db:hosts)
// importam este módulo fora do Next.

// Só o host: a connection string tem usuário e senha e nunca é impressa.
export function databaseHostOf(connectionString: string): string {
  try {
    const host = new URL(connectionString).hostname.toLowerCase();
    if (host !== "") return host;
  } catch {
    // cai no erro abaixo, sem repetir a string (ela tem a senha)
  }
  throw new Error("DATABASE_URL não é uma URL de conexão válida.");
}

function hostOrMarker(connectionString: string | undefined): string {
  if (connectionString === undefined) return "ausente";
  try {
    return databaseHostOf(connectionString);
  } catch {
    return "inválida";
  }
}

// Para conferir, antes da migração de produção, em qual banco o drizzle-kit
// vai escrever (`bun run db:hosts`): o drizzle-kit não tem trava de host.
export function formatDatabaseHosts(urls: DatabaseUrls): string {
  return [
    `Banco da aplicação (runtime): ${hostOrMarker(urls.runtime)}`,
    `Banco das migrações (drizzle-kit): ${hostOrMarker(urls.migration)}`,
  ].join("\n");
}
```

Substitua o conteúdo de `src/features/invites/adminInvite.ts` (`readFlag` lê `--flag valor` e `--flag=valor`; a comparação do host é exata, sem diferença de caixa, então sufixo e prefixo são recusados; o uso agora cita a flag obrigatória):

```ts
import type { Db } from "@/db/types";

import { createInvite } from "./inviteQueries";
import { buildInviteUrl, isHttpUrl } from "./inviteUrl";

export const ADMIN_INVITE_LABEL_MAX_LENGTH = 80;

const USAGE =
  'Uso: bun run admin:invite --confirmar-host=<host do banco> [--label "Nome de referência"]';

const CONFIRM_FLAG = "--confirmar-host";

export type AdminInviteArgs = {
  label: string | null;
  confirmHost: string | null;
};

// Lê `--flag valor` ou `--flag=valor`; devolve o valor e quantos argumentos
// consumiu (null se o argumento não é essa flag).
function readFlag(
  argv: string[],
  i: number,
  flag: string,
): { value: string; consumed: number } | null {
  const arg = argv[i] ?? "";
  if (arg === flag) {
    const next = argv[i + 1];
    if (next === undefined) {
      throw new Error(`Falta o valor de ${flag}. ${USAGE}`);
    }
    return { value: next, consumed: 2 };
  }
  if (arg.startsWith(`${flag}=`)) {
    return { value: arg.slice(flag.length + 1), consumed: 1 };
  }
  return null;
}

export function parseAdminInviteArgs(argv: string[]): AdminInviteArgs {
  let label: string | null = null;
  let labelSeen = false;
  let confirmHost: string | null = null;
  let confirmSeen = false;

  for (let i = 0; i < argv.length; ) {
    const asLabel = readFlag(argv, i, "--label");
    if (asLabel) {
      if (labelSeen) {
        throw new Error(`--label foi informado mais de uma vez. ${USAGE}`);
      }
      labelSeen = true;
      const trimmed = asLabel.value.trim();
      if (trimmed.length > ADMIN_INVITE_LABEL_MAX_LENGTH) {
        throw new Error(
          `--label aceita no máximo ${ADMIN_INVITE_LABEL_MAX_LENGTH} caracteres.`,
        );
      }
      label = trimmed === "" ? null : trimmed;
      i += asLabel.consumed;
      continue;
    }

    const asConfirm = readFlag(argv, i, CONFIRM_FLAG);
    if (asConfirm) {
      if (confirmSeen) {
        throw new Error(
          `${CONFIRM_FLAG} foi informado mais de uma vez. ${USAGE}`,
        );
      }
      confirmSeen = true;
      const trimmed = asConfirm.value.trim();
      confirmHost = trimmed === "" ? null : trimmed;
      i += asConfirm.consumed;
      continue;
    }

    throw new Error(`Argumento desconhecido: ${argv[i]}. ${USAGE}`);
  }

  return { label, confirmHost };
}

// Trava de host: o convite de administrador só é criado se quem roda disse,
// por extenso, em qual banco está escrevendo. Evita criar o admin no banco
// errado (dev x produção). O host vem do banco que o script vai usar (o do
// pooler, se houver: `-pooler` faz parte do host).
export function assertHostConfirmed(
  databaseHost: string,
  confirmHost: string | null,
): void {
  if (confirmHost === null) {
    throw new Error(
      `Confirme o banco de destino: rode de novo com ${CONFIRM_FLAG}=${databaseHost}`,
    );
  }
  if (confirmHost.toLowerCase() !== databaseHost.toLowerCase()) {
    throw new Error(
      `${CONFIRM_FLAG} não confere com o banco de destino (${databaseHost}). Nada foi criado.`,
    );
  }
}

export function formatAdminInviteTarget(input: {
  databaseHost: string;
  baseURL: string;
}): string {
  return [
    `Banco de destino: ${input.databaseHost}`,
    `BETTER_AUTH_URL:  ${input.baseURL}`,
  ].join("\n");
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

const SAFE_ERROR_CODE = /^[A-Za-z0-9_]{1,32}$/;

function safeCodeOf(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const code: unknown = Reflect.get(value, "code");
  return typeof code === "string" && SAFE_ERROR_CODE.test(code) ? code : null;
}

// Só os erros do próprio script (Error puro: argumento, host, URL) mostram a
// mensagem. Qualquer outro erro (o DrizzleQueryError traz o SQL e os params,
// com o hash do token) vira uma linha sem conteúdo. Não importa
// logServerError: na Tarefa 6 aquele módulo carrega o @sentry/nextjs.
export function formatAdminInviteError(error: unknown): string {
  if (
    error instanceof Error &&
    Object.getPrototypeOf(error) === Error.prototype
  ) {
    return `Erro: ${error.message}`;
  }

  const name = error instanceof Error ? error.constructor.name : "NonError";
  const code =
    safeCodeOf(error) ??
    safeCodeOf(error instanceof Error ? error.cause : null);
  const detail = code === null ? name : `${name}, código ${code}`;

  return `Erro: falha inesperada ao gravar o convite (${detail}). Confira no banco se o convite foi criado antes de rodar de novo.`;
}
```

Run: `bun run test -- src/db/databaseHost.test.ts src/features/invites/adminInvite.test.ts`
Expected: PASS (2 arquivos, 29 testes: 5 + 24).

- [ ] **Step 4: Ligar o script e criar o `db:hosts`**

Substitua o conteúdo de `scripts/adminInvite.ts` (a ordem é: argumentos → `BETTER_AUTH_URL` → URL do banco → **imprime o alvo e confere o host** → só então cria o pool; os erros de hoje continuam os mesmos):

```ts
import { loadEnvConfig } from "@next/env";

import { createDb, createPool } from "@/db/client";
import { databaseHostOf } from "@/db/databaseHost";
import { resolveDatabaseUrls } from "@/db/databaseUrl";
import {
  assertHostConfirmed,
  createAdminInvite,
  formatAdminInviteError,
  formatAdminInviteOutput,
  formatAdminInviteTarget,
  parseAdminInviteArgs,
} from "@/features/invites/adminInvite";

// Roda fora do Next: carrega .env/.env.local com as mesmas regras e importa só
// módulos sem `server-only`.
async function main(): Promise<void> {
  loadEnvConfig(process.cwd());

  const { label, confirmHost } = parseAdminInviteArgs(process.argv.slice(2));

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

  // Antes de qualquer escrita: mostra o alvo e exige a confirmação do host.
  const databaseHost = databaseHostOf(connectionString);
  console.log(formatAdminInviteTarget({ databaseHost, baseURL }));
  assertHostConfirmed(databaseHost, confirmHost);

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
  // Só a mensagem dos erros do próprio script; o erro do banco (Drizzle) traz
  // o SQL e os parâmetros, com o hash do token, e nunca vai para o terminal.
  console.error(formatAdminInviteError(error));
  process.exitCode = 1;
});
```

Crie `scripts/dbHosts.ts`:

```ts
import { loadEnvConfig } from "@next/env";

import { formatDatabaseHosts } from "@/db/databaseHost";
import { resolveDatabaseUrls } from "@/db/databaseUrl";

// Só o host de cada banco, nunca usuário, senha nem o nome do banco: serve para
// conferir o alvo antes de `bun run db:migrate` (o drizzle-kit não tem trava).
loadEnvConfig(process.cwd());
console.log(formatDatabaseHosts(resolveDatabaseUrls(process.env)));
```

Em `package.json`, com a ferramenta Edit, o script novo (logo depois do `admin:invite`):

Edit em `package.json`:

`old_string`:

```json
    "admin:invite": "bun scripts/adminInvite.ts",
```

`new_string`:

```json
    "admin:invite": "bun scripts/adminInvite.ts",
    "db:hosts": "bun scripts/dbHosts.ts",
```

- [ ] **Step 5: Rodar o script de verdade com uma env fictícia**

Rode o bloco abaixo **inteiro numa chamada só** da ferramenta Bash (ela não guarda variáveis entre chamadas) e exporte uma env fictícia: o host `db.invalid` nunca é resolvido (o pool nem é criado, porque a trava recusa antes) e **nada do `.env.local` pode aparecer** (por isso `DATABASE_URL` também é exportada: o `loadEnvConfig` não sobrescreve variável já exportada):

```bash
export DATABASE_URL="postgresql://u:s3nha@db.invalid/x"
export DATABASE_URL_POOLED="postgresql://u:s3nha@db.invalid/x"
export DATABASE_URL_UNPOOLED="postgresql://u:s3nha@db.invalid/x"
export BETTER_AUTH_URL="http://localhost:3201"
bun run admin:invite; echo "código=$?"
bun run admin:invite --confirmar-host=outro.invalid; echo "código=$?"
bun run admin:invite --confirmar-host=db.invalid.evil; echo "código=$?"
bun run admin:invite --confirmar-host; echo "código=$?"
bun run db:hosts; echo "código=$?"
bun run admin:invite 2>&1 | grep -c s3nha
```

Expected (o `error: script "admin:invite" exited with code 1` do Bun aparece depois de cada erro):

```text
$ bun scripts/adminInvite.ts
Banco de destino: db.invalid
BETTER_AUTH_URL:  http://localhost:3201
Erro: Confirme o banco de destino: rode de novo com --confirmar-host=db.invalid
código=1
$ bun scripts/adminInvite.ts "--confirmar-host=outro.invalid"
Banco de destino: db.invalid
BETTER_AUTH_URL:  http://localhost:3201
Erro: --confirmar-host não confere com o banco de destino (db.invalid). Nada foi criado.
código=1
$ bun scripts/adminInvite.ts "--confirmar-host=db.invalid.evil"
Banco de destino: db.invalid
BETTER_AUTH_URL:  http://localhost:3201
Erro: --confirmar-host não confere com o banco de destino (db.invalid). Nada foi criado.
código=1
$ bun scripts/adminInvite.ts --confirmar-host
Erro: Falta o valor de --confirmar-host. Uso: bun run admin:invite --confirmar-host=<host do banco> [--label "Nome de referência"]
código=1
$ bun scripts/dbHosts.ts
Banco da aplicação (runtime): db.invalid
Banco das migrações (drizzle-kit): db.invalid
código=0
0
```

O `0` do fim é a contagem de linhas com `s3nha`: a senha nunca aparece. **Não** rode o caminho de sucesso (`--confirmar-host=db.invalid`): ele tentaria conectar e falharia; com o `formatAdminInviteError` a saída é só `Erro: falha inesperada ao gravar o convite (DrizzleQueryError, código ENOTFOUND). Confira no banco se o convite foi criado antes de rodar de novo.` (medido no planejamento), sem SQL nem parâmetros. Mesmo assim o passo não o roda: ele faria uma consulta de DNS. O sucesso (convite gravado, link, validade) é coberto pelos testes de `createAdminInvite` com PGlite e pelo passo B8 da Parte B. Feche o shell.

- [ ] **Step 6: Documentar (`AGENTS.md` e `architecture.md`)**

Em `AGENTS.md`, na tabela de comandos, com a ferramenta Edit (só a linha do `admin:invite` e a nova do `db:hosts`; o resto do arquivo, inclusive o bloco do `next dev`, não se mexe):

Edit em `AGENTS.md`:

`old_string`:

```markdown
| `bun run admin:invite` | gera o link de convite do primeiro administrador |
```

`new_string`:

```markdown
| `bun run admin:invite --confirmar-host=<host>` | gera o link de convite do primeiro administrador; sem a flag, mostra o banco de destino e recusa |
| `bun run db:hosts` | mostra só o host do banco da aplicação e o das migrações (conferir antes do `db:migrate`) |
```

Em `.context/architecture.md`, com a ferramenta Edit (duas edições: §4 árvore de scripts e §7 primeiro administrador):

Edit em `.context/architecture.md`:

`old_string`:

```markdown
- **Primeiro administrador.** `bun run admin:invite` (`scripts/adminInvite.ts`) gera o link do convite de administrador.
```

`new_string`:

```markdown
- **Primeiro administrador.** `bun run admin:invite --confirmar-host=<host>` (`scripts/adminInvite.ts`) gera o link do convite de administrador. **Trava de host (Fase 6):** antes de qualquer escrita o script imprime só `Banco de destino: <host>` e `BETTER_AUTH_URL:  <url>` e exige a flag igual ao host que ele vai usar (o do pooler, se houver; comparação exata, sem diferença de caixa); sem a flag ou com host diferente sai com `Erro: …`, código 1, sem abrir conexão. Vale também em desenvolvimento. O script não recusa um segundo administrador: é o caminho de recuperação se o único admin perder o acesso; a defesa é a trava de host e o convite de uso único por 7 dias. `bun run db:hosts` imprime o host da aplicação e o das migrações (o `drizzle-kit` não tem trava): é a conferência antes do `db:migrate` de produção.
```

Edit em `.context/architecture.md`:

`old_string`:

```markdown
scripts/                  scripts do desenvolvedor (admin:invite)
```

`new_string`:

```markdown
scripts/                  scripts do desenvolvedor (admin:invite, db:hosts)
```

- [ ] **Step 7: Formatar, tipos, lint e suíte inteira**

Run: `bunx biome check --write src scripts package.json && bun run check-types && bun run lint && bun run test`
Expected: tudo verde; **307 arquivos e 4236 testes** (o fim da Tarefa 2 + 1 arquivo e + 15 testes: `databaseHost` 5 e `adminInvite` de 14 para 24, isto é, + 10). Sem build nem E2E nesta tarefa (script e lógica pura; nenhuma tela muda). Com a máquina carregada o `migration0002.test.ts` pode estourar o limite de 15 s (nas medições do planejamento, 3 dos 4 testes dele na suíte inteira); rode `bunx vitest run src/db/schema/migration0002.test.ts` e, se passar isolado (4 testes), a suíte conta como verde; se falhar isolado, BLOCKED.

- [ ] **Step 8: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/f6/msg-task-3.txt` e rode:

```bash
git add src/db/databaseHost.ts src/db/databaseHost.test.ts src/features/invites/adminInvite.ts src/features/invites/adminInvite.test.ts scripts/adminInvite.ts scripts/dbHosts.ts package.json AGENTS.md .context/architecture.md
git commit -F .git/sdd/f6/msg-task-3.txt
```

Mensagem:

```text
feat(admin-invite): trava de host e db:hosts

O admin:invite imprime o banco de destino e a BETTER_AUTH_URL antes de
qualquer escrita e só segue com --confirmar-host igual ao host do banco
que vai usar (sem abrir conexão se não conferir). O db:hosts mostra só o
host da aplicação e o das migrações, para conferir o alvo antes do
db:migrate. databaseHostOf vai para src/db/databaseHost.ts.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

### Task 4: Better Auth endurecido (`fix(auth)`)

**Files:**
- Modify: `src/lib/auth/createAuth.ts`
- Create: `src/lib/auth/hardening.test.ts`
- Create: `src/lib/auth/ipUnknown.test.ts`
- Modify: `.context/pendencias.md` (P16 e P22 → `Resolvido`, pelo script temporário `.git/sdd/f6/t4-pendencias.mjs`)
- Modify: `test/pendenciasDoc.test.ts`
- Modify: `.context/library-docs.md` (§8)
- Temporário (não vai para o commit): `.git/sdd/f6/t4-pendencias.mjs`, `.git/sdd/f6/msg-task-4.txt`

Nenhum teste existente muda. Nenhuma migração. Nenhuma tela muda.

**Interfaces:**
- Consumes: `INVITE_COOKIE` e `inviteCookieOptions(secure: boolean)` de `src/lib/auth/inviteCookie.ts`; `logServerError(error: unknown, context: string): void` de `src/lib/logServerError.ts` (Tarefa 2); `createTestAuth`, `TEST_AUTH_ENV` de `test/auth.ts`; `createTestDb`, `resetDb` de `test/db.ts`; `insertInvite`, `insertSession`, `insertUser` de `test/fixtures.ts`.
- Produces: `RESET_PASSWORD_PREFIX = "reset-password:"` (exportado de `createAuth.ts`; a Tarefa 5 o importa) e a configuração do Better Auth do contrato (`revokeSessionsOnPasswordReset`, `verification.storeIdentifier`, `advanced.ipAddress`, o `setCookie` do P16 e o `logger`), da qual a Tarefa 5 depende (hash do token e revogação das sessões).

**Antes de começar:** carregue a skill instalada do Better Auth e releia `.context/library-docs.md §8`. Três fatos medidos no planejamento mudam o que os testes podem afirmar (estão nos comentários dos arquivos):
1. **`isTest()` do Better Auth.** O pacote decide "é teste?" quando o módulo carrega (`NODE_ENV=test` ou `TEST` verdadeiro; o Vitest define `TEST=true`) e, sendo teste, devolve `127.0.0.1` quando não acha IP: no Vitest o pedido sem cabeçalho **nunca** cai no balde `no-trusted-ip` nem emite o aviso de IP. Por isso a prova do P22 sem IP vive num arquivo próprio (`ipUnknown.test.ts`) que fixa `NODE_ENV=production` e `TEST` vazio dentro de `vi.hoisted`, antes de qualquer import (o aviso também sai uma vez por processo: flag de módulo).
2. **Quatro dos casos do rate limit já passam antes da mudança** (a chave `203.0.113.7|/sign-in/email`, o 31º login, `x-real-ip`/`x-vercel-forwarded-for` ignorados): o padrão do Better Auth já lia o `x-forwarded-for`. Eles não são vermelhos: são o guarda que impede alguém de trocar o cabeçalho depois. O que fica vermelho é a declaração explícita (caso 1) e o que depende do `createAuth` novo.
3. **Resíduo (P75).** O roteador do `better-call` imprime `# SERVER_ERROR: <erro>` com `console.error` por conta própria quando a exceção não é `APIError` (`node_modules/better-call/dist/router.mjs`, linha 94), fora do alcance do `logger` do Better Auth. O erro do Drizzle chega por esse caminho com o SQL e os parâmetros. O teste do logger só afirma sobre as linhas JSON do `logServerError` e o comentário dele registra o resíduo; **não há como fechá-lo dentro desta tarefa** sem remendar o `console` (a Tarefa 10 amplia o texto de P75 e o ADR). O B7 da Parte B confere o log da Vercel.

- [ ] **Step 1: Escrever `src/lib/auth/hardening.test.ts` (falhando)**

Crie com a ferramenta Write:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { DrizzleQueryError } from "drizzle-orm/errors";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { rateLimit, session, verification } from "@/db/schema/auth";
import { createTestAuth, TEST_AUTH_ENV } from "../../../test/auth";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertInvite,
  insertSession,
  insertUser,
} from "../../../test/fixtures";
import { INVITE_COOKIE } from "./inviteCookie";

const BASE_URL = TEST_AUTH_ENV.baseURL;

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

afterEach(() => {
  vi.restoreAllMocks();
});

function post(
  auth: ReturnType<typeof createTestAuth>,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE_URL,
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );
}

// Em produção o limiter liga (P22). O auth é criado com NODE_ENV=production
// e o env volta ao normal logo depois: o limiter lê a opção já resolvida.
function productionAuth() {
  vi.stubEnv("NODE_ENV", "production");
  try {
    return createTestAuth(db);
  } finally {
    vi.unstubAllEnvs();
  }
}

async function hammerSignIn(
  auth: ReturnType<typeof createTestAuth>,
  headers: Record<string, string>,
  times: number,
) {
  const statuses: number[] = [];
  for (let i = 0; i < times; i += 1) {
    const res = await post(
      auth,
      "/sign-in/email",
      { email: "ninguem@example.test", password: "senha-qualquer-1" },
      headers,
    );
    statuses.push(res.status);
  }
  return statuses;
}

// Os dois primeiros casos com logins fazem até 32 logins de verdade: com a
// máquina carregada (a suíte inteira) passam dos 15 s padrão, e o que sobra de
// um caso que estourou o tempo vaza para o seguinte. Daí os 60 s.
describe("rate limit por IP (advanced.ipAddress.ipAddressHeaders)", () => {
  it("declara x-forwarded-for explicitamente", () => {
    const auth = createTestAuth(db);
    expect(auth.options.advanced?.ipAddress?.ipAddressHeaders).toEqual([
      "x-forwarded-for",
    ]);
  });

  it("a chave do balde é o IP do x-forwarded-for (um balde por cliente)", async () => {
    const auth = productionAuth();
    await hammerSignIn(auth, { "x-forwarded-for": "203.0.113.7" }, 2);
    await hammerSignIn(auth, { "x-forwarded-for": "203.0.113.8" }, 1);
    const rows = await db.select().from(rateLimit);
    expect(rows.map((row) => row.key).sort()).toEqual([
      "203.0.113.7|/sign-in/email",
      "203.0.113.8|/sign-in/email",
    ]);
    const mine = rows.find((row) => row.key === "203.0.113.7|/sign-in/email");
    expect(mine?.count).toBe(2);
  }, 60_000);

  it("30 por minuto por IP: o 31º toma 429 e outro IP segue livre", async () => {
    const auth = productionAuth();
    const statuses = await hammerSignIn(
      auth,
      { "x-forwarded-for": "198.51.100.1" },
      31,
    );
    expect(statuses.slice(0, 30).every((status) => status !== 429)).toBe(true);
    expect(statuses[30]).toBe(429);
    const other = await hammerSignIn(
      auth,
      { "x-forwarded-for": "198.51.100.2" },
      1,
    );
    expect(other[0]).not.toBe(429);
  }, 60_000);

  it("x-real-ip e x-vercel-forwarded-for não escolhem o balde", async () => {
    const auth = productionAuth();
    await hammerSignIn(
      auth,
      {
        "x-forwarded-for": "192.0.2.10",
        "x-real-ip": "10.9.9.9",
        "x-vercel-forwarded-for": "10.8.8.8",
      },
      1,
    );
    const keys = (await db.select().from(rateLimit)).map((row) => row.key);
    expect(keys).toEqual(["192.0.2.10|/sign-in/email"]);
  });
});

describe("P16: o cookie do convite é apagado depois do cadastro", () => {
  async function signUp(
    auth: ReturnType<typeof createTestAuth>,
    token: string,
    email: string,
  ) {
    return post(
      auth,
      "/sign-up/email",
      { name: "Ana Teste", email, password: "senha-segura-123" },
      { cookie: `${INVITE_COOKIE}=${token}` },
    );
  }

  function inviteSetCookie(res: Response): string | undefined {
    return res.headers
      .getSetCookie()
      .find((line) => line.startsWith(`${INVITE_COOKIE}=`));
  }

  it("cadastro com sucesso devolve o Set-Cookie do convite vazio e com Max-Age=0", async () => {
    const auth = createTestAuth(db);
    const { token } = await insertInvite(db, {
      role: "admin",
      now: new Date(),
    });
    const res = await signUp(auth, token, "a@example.test");
    expect(res.status).toBe(200);
    const line = inviteSetCookie(res);
    expect(line).toBeDefined();
    expect(line).toMatch(/^closery_invite=;/);
    expect(line).toMatch(/Max-Age=0/i);
    expect(line).toMatch(/Path=\//);
    expect(line).toMatch(/HttpOnly/i);
    expect(line).toMatch(/SameSite=Lax/i);
    // O cookie de sessão continua vindo junto.
    expect(
      res.headers
        .getSetCookie()
        .some((entry) => entry.includes("session_token")),
    ).toBe(true);
  });

  it("em produção o cookie apagado também leva Secure", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const auth = createTestAuth(db);
      const { token } = await insertInvite(db, {
        role: "admin",
        now: new Date(),
      });
      const res = await signUp(auth, token, "b@example.test");
      expect(res.status).toBe(200);
      expect(inviteSetCookie(res)).toMatch(/Secure/i);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("cadastro recusado (convite inválido) não mexe no cookie", async () => {
    const auth = createTestAuth(db);
    const res = await signUp(auth, "A".repeat(43), "c@example.test");
    expect(res.status).toBe(403);
    expect(inviteSetCookie(res)).toBeUndefined();
  });
});

describe("redefinição de senha: hash do identificador e sessões revogadas", () => {
  async function storeValue(identifier: string, value: string) {
    const { internalAdapter } = await createTestAuth(db).$context;
    return internalAdapter.createVerificationValue({
      identifier,
      value,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
  }

  it("o identificador reset-password: fica no banco só como hash", async () => {
    const token = "tokenSecretoDeTeste0123456789abcdefghijklmn";
    await storeValue(`reset-password:${token}`, "usuario-1");
    const rows = await db.select().from(verification);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.identifier).not.toContain(token);
    expect(rows[0]?.identifier).not.toContain("reset-password");
    expect(rows[0]?.value).toBe("usuario-1");
  });

  it("os outros identificadores continuam em texto puro", async () => {
    await storeValue("outro:abc", "{}");
    const rows = await db.select().from(verification);
    expect(rows.map((row) => row.identifier)).toEqual(["outro:abc"]);
  });

  it("redefinir a senha revoga todas as sessões da pessoa", async () => {
    const auth = createTestAuth(db);
    const person = await insertUser(db, { role: "admin", sectorId: null });
    await insertSession(db, { userId: person.id });
    await insertSession(db, { userId: person.id });
    expect(
      await db.select().from(session).where(eq(session.userId, person.id)),
    ).toHaveLength(2);
    const token = "tokenDeRedefinicao0123456789abcdefghijklmnopq";
    await storeValue(`reset-password:${token}`, person.id);

    const res = await post(auth, "/reset-password", {
      token,
      newPassword: "senha-nova-4567",
    });

    expect(res.status).toBe(200);
    expect(
      await db.select().from(session).where(eq(session.userId, person.id)),
    ).toHaveLength(0);
  });

  it("o pedido por e-mail continua desligado (sem provedor de e-mail, P8)", async () => {
    const auth = createTestAuth(db);
    const res = await post(auth, "/request-password-reset", {
      email: "ana@example.test",
    });
    expect(res.status).toBe(400);
    const body: unknown = await res.json();
    expect(body).toMatchObject({ code: "RESET_PASSWORD_DISABLED" });
  });
});

// R4: o log padrão do Better Auth imprime o erro cru, e o erro do Drizzle
// carrega o SQL e os parâmetros (e-mail, hash, IP).
describe("logger do Better Auth passa por logServerError", () => {
  const SECRET_EMAIL = "ana@exemplo.test";

  // `db` cuja consulta falha como o driver falharia: o erro é lançado ao
  // aguardar qualquer encadeamento de `select(...).from(...)...`.
  function failingDb() {
    const cause = Object.assign(new Error(`duplicate key (${SECRET_EMAIL})`), {
      code: "23505",
    });
    const failure = new DrizzleQueryError(
      'select "id" from "user" where "email" = $1',
      [SECRET_EMAIL],
      cause,
    );
    const chain: unknown = new Proxy(() => undefined, {
      get: (_target, prop) =>
        prop === "then"
          ? (_resolve: unknown, reject: (reason: unknown) => void) =>
              reject(failure)
          : chain,
      apply: () => chain,
    });
    return new Proxy(db, {
      get: (target, prop) =>
        prop === "select" ? () => chain : Reflect.get(target, prop),
    });
  }

  // Só as linhas do logServerError (JSON). O roteador do better-call ainda
  // imprime "# SERVER_ERROR: <erro>" por conta própria para exceção que não é
  // APIError, fora do alcance do logger do Better Auth: resíduo da P75.
  function loggedLines(spy: { mock: { calls: unknown[][] } }): string[] {
    return spy.mock.calls
      .map((call) => call.map(String).join(" "))
      .filter((line) => line.startsWith("{"));
  }

  it("erro de banco: uma linha JSON com contexto, nome e código, sem SQL nem e-mail", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const auth = createTestAuth(failingDb());

    const res = await post(auth, "/sign-in/email", {
      email: SECRET_EMAIL,
      password: "senha-qualquer-1",
    });

    expect(res.status).toBe(500);
    const lines = loggedLines(spy);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({
      level: "error",
      context: "better-auth",
      code: "23505",
    });
    expect(lines[0]).not.toContain(SECRET_EMAIL);
    expect(lines[0]).not.toContain("Failed query");
    expect(lines[0]).not.toContain("select");
  });

  it("um aviso qualquer do Better Auth não escreve nada", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { logger } = await createTestAuth(db).$context;

    logger.warn("Um aviso qualquer com ana@exemplo.test");

    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Escrever `src/lib/auth/ipUnknown.test.ts` (falhando)**

```ts
import type { PGlite } from "@electric-sql/pglite";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { rateLimit } from "@/db/schema/auth";
import { createTestAuth, TEST_AUTH_ENV } from "../../../test/auth";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";

// O Better Auth decide "é teste?" quando o módulo carrega: com NODE_ENV=test e
// sem IP no pedido ele inventa 127.0.0.1 e nunca cai no balde global nem avisa.
// Este arquivo existe para provar o comportamento de produção, então o
// NODE_ENV=production e TEST vazio (o Vitest define TEST=true, que também conta
// como teste) valem ANTES de qualquer import. Arquivo próprio: o aviso
// sai uma vez por processo (flag de módulo) e o NODE_ENV não vaza para os demais.
vi.hoisted(() => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("TEST", "");
});

const BASE_URL = TEST_AUTH_ENV.baseURL;

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
  vi.unstubAllEnvs();
});

beforeEach(async () => {
  await resetDb(client);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function signIn(
  auth: ReturnType<typeof createTestAuth>,
  headers: Record<string, string>,
) {
  return auth.handler(
    new Request(`${BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE_URL,
        ...headers,
      },
      body: JSON.stringify({
        email: "ninguem@example.test",
        password: "senha-qualquer-1",
      }),
    }),
  );
}

describe("P22: sem IP resolvível, em produção", () => {
  it("cabeçalho ausente ou lista de vários cai num balde global, e o aviso vira uma linha só", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const auth = createTestAuth(db);

    await signIn(auth, {});
    await signIn(auth, { "x-forwarded-for": "1.1.1.1, 2.2.2.2" });
    await signIn(auth, {});

    // Um balde só por rota, nunca um por valor forjado pelo cliente.
    const rows = await db.select().from(rateLimit);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.key).toBe("no-trusted-ip|/sign-in/email");
    expect(rows[0]?.count).toBe(3);
    // O aviso sai uma vez por processo e passa por logServerError.
    const lines = error.mock.calls
      .map((call) => call.map(String).join(" "))
      .filter((line) => line.startsWith("{"));
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({
      level: "error",
      context: "better-auth:ip-desconhecido",
    });
    expect(warn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `bunx vitest run src/lib/auth/hardening.test.ts src/lib/auth/ipUnknown.test.ts`
Expected: FAIL, `Test Files  2 failed (2)` e `Tests  8 failed | 6 passed (14)`. Os 8 vermelhos e a mensagem de cada um:
- `declara x-forwarded-for explicitamente`: `expected undefined to deeply equal [ 'x-forwarded-for' ]`.
- `cadastro com sucesso devolve o Set-Cookie do convite vazio e com Max-Age=0`: `expected undefined to be defined`.
- `em produção o cookie apagado também leva Secure`: `.toMatch() expects to receive a string, but got undefined`.
- `o identificador reset-password: fica no banco só como hash`: `expected 'reset-password:tokenSecretoDeTeste012…' not to contain 'tokenSecretoDeTeste0123456789abcdefgh…'`.
- `redefinir a senha revoga todas as sessões da pessoa`: `expected [ { …(8) }, { …(8) } ] to have a length of +0 but got 2`.
- `erro de banco: uma linha JSON com contexto, nome e código, sem SQL nem e-mail`: `expected [] to have a length of 1 but got +0` (o logger padrão não passa pelo `logServerError`).
- `um aviso qualquer do Better Auth não escreve nada`: `expected "warn" to not be called at all, but actually been called 1 times`.
- `ipUnknown.test.ts`: `expected [] to have a length of 1 but got +0`.

Os 6 verdes são o guarda descrito no ponto 2 acima (`a chave do balde…`, `30 por minuto…`, `x-real-ip…`), mais `cadastro recusado…`, `os outros identificadores continuam em texto puro` e `o pedido por e-mail continua desligado`.

- [ ] **Step 4: Endurecer o `createAuth.ts`**

Edite `src/lib/auth/createAuth.ts` (três trechos):

Troque:

```ts
import type { Role } from "@/lib/roles";

import type { AuthEnv } from "./env";
import { INVITE_COOKIE } from "./inviteCookie";
```

por:

```ts
import { logServerError } from "@/lib/logServerError";
import type { Role } from "@/lib/roles";

import type { AuthEnv } from "./env";
import { INVITE_COOKIE, inviteCookieOptions } from "./inviteCookie";

// O identificador que o /reset-password do Better Auth monta (`reset-password:<token>`).
// A configuração `verification.storeIdentifier` usa o mesmo prefixo para guardar só o hash.
export const RESET_PASSWORD_PREFIX = "reset-password:";
```

Troque:

```ts
      // Sem `sendResetPassword`: ainda não há e-mail transacional (P8). O
      // endpoint responde RESET_PASSWORD_DISABLED e a tela não oferece o link.
    },
```

por:

```ts
      // Sem `sendResetPassword` (sem e-mail transacional, P8): o endpoint de
      // pedido responde RESET_PASSWORD_DISABLED. O link nasce no admin
      // (features/admin/passwordReset.ts) e só POST /reset-password o consome.
      // Redefinir a senha derruba todas as sessões da pessoa.
      revokeSessionsOnPasswordReset: true,
    },

    // O token de redefinição fica no banco só como hash: vazamento do banco ou
    // um log "Failed query ... params" nunca expõe o token. O resto (desafio de
    // passkey, estado de OAuth) segue em texto puro, como o padrão.
    verification: {
      storeIdentifier: {
        default: "plain",
        overrides: { [RESET_PASSWORD_PREFIX]: "hashed" },
      },
    },

    // Por trás da Vercel o x-forwarded-for chega sobrescrito com o IP do
    // cliente (um valor só, que o Better Auth aceita). Só ele: x-real-ip e
    // x-vercel-forwarded-for seriam forjáveis fora da Vercel. Explícito para o
    // rate limit nunca cair no balde global por rota (P22).
    advanced: { ipAddress: { ipAddressHeaders: ["x-forwarded-for"] } },

    // O logger padrão imprime o erro cru, e o erro do Drizzle carrega o SQL e os
    // parâmetros (token de sessão, IP, e-mail ou hash). Só o nível `error` e o
    // aviso de IP desconhecido passam, e passam por logServerError.
    logger: {
      log: (level, message, ...args) => {
        if (level === "error") {
          logServerError(
            args.find((arg) => arg instanceof Error) ?? null,
            "better-auth",
          );
        } else if (
          message.startsWith("Rate limiting could not determine a client IP")
        ) {
          logServerError(null, "better-auth:ip-desconhecido");
        }
      },
    },
```

Troque:

```ts
            await recordInviteUser(db, token, createdUser.id);
```

por:

```ts
            await recordInviteUser(db, token, createdUser.id);
            // O convite já foi gasto: o cookie não tem mais serventia (P16).
            ctx?.setCookie(INVITE_COOKIE, "", {
              ...inviteCookieOptions(process.env.NODE_ENV === "production"),
              maxAge: 0,
            });
```

(O quarto trecho do contrato, o `RESET_PASSWORD_PREFIX`, já está no primeiro bloco acima.) Depois: `bunx biome check --write src/lib/auth`.

- [ ] **Step 5: Rodar e ver passar**

Run: `bunx vitest run src/lib/auth/hardening.test.ts src/lib/auth/ipUnknown.test.ts`
Expected: PASS, `Test Files  2 passed (2)` e `Tests  14 passed (14)` (13 em `hardening.test.ts` e 1 em `ipUnknown.test.ts`). Se algum teste de `hardening.test.ts` falhar só com `src/lib/auth` inteiro mas passar isolado, repita só ele: a máquina carregada estoura o tempo do PGlite.

- [ ] **Step 6: Escrever o caso do guarda de pendências (falhando)**

Em `test/pendenciasDoc.test.ts`, acrescente o caso abaixo logo depois do último `it` do `describe` (antes do `});` que fecha o arquivo):

Troque:

```ts
      expect(entry?.state, id).toBe("Aberto, não triado");
      expect(entry?.section, id).toBe("1");
    }
  });
});
```

por:

```ts
      expect(entry?.state, id).toBe("Aberto, não triado");
      expect(entry?.section, id).toBe("1");
    }
  });

  it("Fase 6: P16 e P22 resolvidas", () => {
    for (const id of ["P16", "P22"]) {
      const entry = entries.get(id);
      expect(entry?.state, id).toBe("Resolvido");
      expect(entry?.section, id).toBe("5");
      expect(
        entry?.updates.some((date) => date >= "2026-11-25"),
        id,
      ).toBe(true);
    }
  });
});
```

Run: `bunx vitest run test/pendenciasDoc.test.ts`
Expected: FAIL, `Tests  1 failed | 12 passed (13)`, `AssertionError: P16: expected 'Aberto, não triado' to be 'Resolvido'`.

- [ ] **Step 7: Mover P16 e P22 para "Resolvido"**

Crie `.git/sdd/f6/t4-pendencias.mjs` com a ferramenta Write (o script move os dois blocos da seção 1 para o fim da seção 5, troca o `**Estado:**`, acrescenta a `Atualização` datada e troca o estado nas duas linhas do índice; falha alto se algo não estiver como esperado):

```js
// Tarefa 4: P16 e P22 saem da seção 1 e vão para o fim da seção 5 (Resolvido),
// com a Atualização datada; as linhas do índice trocam o estado.
// Uso: bun .git/sdd/f6/t4-pendencias.mjs <data AAAA-MM-DD>
import { readFileSync, writeFileSync } from "node:fs";

const DATE = process.argv[2];
if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE ?? "")) {
  throw new Error("Informe a data do dia no formato AAAA-MM-DD.");
}

const FILE = ".context/pendencias.md";
let text = readFileSync(FILE, "utf8");

const UPDATES = {
  P16: `**Atualização (${DATE}):** resolvida na Fase 6: o hook \`user.create.after\` apaga o cookie \`closery_invite\` (\`setCookie\` com \`maxAge: 0\` e os mesmos atributos do cookie original, com \`Secure\` em produção) logo depois de gastar o convite; o cadastro recusado não mexe nele. Teste: \`src/lib/auth/hardening.test.ts\`.`,
  P22: `**Atualização (${DATE}):** resolvida no código na Fase 6: \`advanced.ipAddress.ipAddressHeaders: ["x-forwarded-for"]\`, só ele (a Vercel o sobrescreve com o IP do cliente; \`x-real-ip\` e \`x-vercel-forwarded-for\` seriam forjáveis fora dela). Sem IP resolvível o limite cai num balde global por rota, nunca num balde por valor forjado, e o aviso do Better Auth sai pelo \`logServerError\` como \`better-auth:ip-desconhecido\`. Os números ficam (30 por minuto no login, 10 no cadastro por IP): vários operadores atrás do mesmo IP do galpão dividem o balde, e se isso atrapalhar no piloto basta subir o número. Testes: \`hardening.test.ts\` e \`ipUnknown.test.ts\`. A conferência no primeiro deploy (nenhuma linha \`better-auth:ip-desconhecido\` no log da Vercel depois de uma tentativa de login) é o passo B7 da Parte B.`,
};

for (const id of ["P16", "P22"]) {
  const start = text.indexOf(`#### ${id} — `);
  if (start < 0) throw new Error(`${id} não está no arquivo.`);
  const next = text.indexOf("\n#### ", start + 1);
  const end = next < 0 ? text.length : next + 1;
  let block = text.slice(start, end);
  text = text.slice(0, start) + text.slice(end);

  if (!block.includes("**Estado:** Aberto, não triado")) {
    throw new Error(`${id} não estava como Aberto, não triado.`);
  }
  block = block.replace(
    "**Estado:** Aberto, não triado",
    "**Estado:** Resolvido",
  );
  block = `${block.trimEnd()}\n${UPDATES[id]}\n`;
  text = `${text.trimEnd()}\n\n${block}`;

  const row = new RegExp(`^(\\| ${id} \\| .+ \\| \\S+ \\| )Aberto, não triado \\|$`, "m");
  if (!row.test(text)) throw new Error(`Linha do índice de ${id} não achada.`);
  text = text.replace(row, "$1Resolvido |");
}

writeFileSync(FILE, text);
console.log("P16 e P22 movidas para a seção 5.");
```

Obtenha a data do dia e rode o script (o `<DATA>` é a saída do primeiro comando):

```bash
bun -e 'console.log(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()))'
bun .git/sdd/f6/t4-pendencias.mjs <DATA>
```

Expected: `P16 e P22 movidas para a seção 5.` Confira: `git diff --stat .context/pendencias.md` mostra só esse arquivo; `grep -n "^| P16\|^| P22" .context/pendencias.md` mostra as duas linhas com `Resolvido`; o `**Próximo id livre: P62.**` não muda.

Run: `bunx vitest run test/pendenciasDoc.test.ts`
Expected: PASS, `Tests  13 passed (13)`.

- [ ] **Step 8: `library-docs.md §8`**

Em `.context/library-docs.md`, na seção `## 8. Better Auth 1.7 + passkey`:

Troque:

```markdown
- **Vínculo implícito desligado (T13).**
```

por:

```markdown
- **Endurecimento da Fase 6 (`createAuth.ts`).** (1) `advanced.ipAddress.ipAddressHeaders: ["x-forwarded-for"]`, só ele: a Vercel o sobrescreve com o IP do cliente; `x-real-ip` e `x-vercel-forwarded-for` seriam forjáveis fora dela (P22). (2) `verification.storeIdentifier` com `overrides: { "reset-password:": "hashed" }` (`RESET_PASSWORD_PREFIX`): o banco guarda só o hash do token de redefinição; o resto continua `plain`. (3) `emailAndPassword.revokeSessionsOnPasswordReset: true`; continua **sem** `sendResetPassword` (`POST /request-password-reset` responde `RESET_PASSWORD_DISABLED`). (4) `user.create.after` apaga o cookie `closery_invite` com `setCookie(..., { ...inviteCookieOptions(...), maxAge: 0 })` (P16). (5) `logger: { log }`: o logger padrão imprime o erro cru e o erro do Drizzle carrega o SQL e os parâmetros; só o nível `error` (com o `Error` dos argumentos ou `null`) e o aviso `Rate limiting could not determine a client IP` passam, os dois por `logServerError` (contextos `better-auth` e `better-auth:ip-desconhecido`); os outros avisos são descartados. **Resíduo (P75):** o roteador do `better-call` imprime `# SERVER_ERROR: <erro>` com `console.error` por conta própria quando a exceção não é `APIError`, fora do alcance do logger; o log da Vercel pode mostrar o `Failed query ... params` por esse caminho.
- **Teste de IP (`ipUnknown.test.ts`).** O Better Auth decide "é teste?" quando o módulo carrega (`NODE_ENV=test` ou `TEST` verdadeiro; o Vitest define `TEST=true`) e, sendo teste, devolve `127.0.0.1` em vez de cair no balde `no-trusted-ip`. Para provar o comportamento de produção o teste fixa `NODE_ENV=production` e `TEST` vazio dentro de `vi.hoisted`, em arquivo próprio (o aviso de IP sai uma vez por processo).
- **Vínculo implícito desligado (T13).**
```

Troque:

```markdown
`Secure` em produção, `path=/`, 1 h; gravado por `armInvite`, nunca por página.
```

por:

```markdown
`Secure` em produção, `path=/`, 1 h; gravado por `armInvite`, nunca por página; apagado no `user.create.after` depois do cadastro (P16).
```

- [ ] **Step 9: Portões**

```bash
bun run check-types
bun run lint
bunx vitest run src/lib/auth test/pendenciasDoc.test.ts
```

Expected: `check-types` sem erro; `lint`: `Checked <n> files … No fixes applied.`; Vitest: **todos** os arquivos passam (medido na máquina do planejamento: `Test Files  12 passed (12)`, `Tests  163 passed (163)` para `src/lib/auth` e `test/pendenciasDoc.test.ts` juntos, conferido na validação; o que importa é zero falha). Em seguida o `bun run test` inteiro: total = o da Tarefa 3 + **2 arquivos** (`hardening.test.ts` e `ipUnknown.test.ts`) e + **15 testes** (13 em `hardening.test.ts`, 1 em `ipUnknown.test.ts`, 1 em `pendenciasDoc.test.ts`); anote os dois números (`Test Files` e `Tests`).

- [ ] **Step 10: Build e E2E**

Todo o bloco numa chamada só, com a env fictícia (o `.env.local` aponta para o Neon de desenvolvimento e não pode ser usado aqui):

```bash
export DATABASE_URL="postgresql://closery:fake@127.0.0.1:1/closery?sslmode=disable"
export DATABASE_URL_POOLED="$DATABASE_URL"
export BETTER_AUTH_URL="http://localhost:3201"
export BETTER_AUTH_SECRET="segredo-local-de-teste-nao-usar-0123456789abcdef"
export NEXT_PUBLIC_SENTRY_DSN=""
bun run build
```

Expected: `✓ Compiled successfully`, `Finished TypeScript`, `✓ Generating static pages` e a lista de rotas **sem nenhuma rota nova** (a medida do planejamento, antes da Tarefa 1: `/`, `/_not-found`, `/(.)solicitacoes/[id]`, `/admin` e as cinco páginas de cadastro, `/api/auth/[...all]` `ƒ`, `/api/dashboard/export` `ƒ`, `/api/health` `ƒ`, `/bem-vindo`, `/conta`, `/convite/[token]`, `/dashboard`, `/entrar`, `/passagens`, `/passagens/[id]`, `/passagens/nova`, `/solicitacoes`, `/solicitacoes/[id]`; com a Tarefa 1 entra `○ /robots.txt`).

Depois o subconjunto do E2E (porta 3200 do app e 54329 do banco; confira antes que as duas estão livres: `netstat -ano | grep -E ':3200|:54329' | grep LISTENING` sem saída):

Run: `bun run test:e2e -- e2e/auth.spec.ts e2e/passagem.spec.ts e2e/solicitacoes.spec.ts`
Expected: `22 passed` (7 + 6 + 9). Se o número divergir, pare e reporte BLOCKED com o número medido.

- [ ] **Step 11: Commit**

Crie `.git/sdd/f6/msg-task-4.txt` com a ferramenta Write:

```text
fix(auth): endurece o Better Auth para a produção (P16, P22)

- IP do rate limit explícito: advanced.ipAddress.ipAddressHeaders
  ["x-forwarded-for"], só ele (P22)
- cookie closery_invite apagado no user.create.after (P16)
- verification.storeIdentifier com hash para reset-password: e
  revokeSessionsOnPasswordReset (a Tarefa 5 depende dos dois)
- logger do Better Auth passa por logServerError: sem SQL nem
  parâmetros no log (o resíduo do better-call é a P75)
- RESET_PASSWORD_PREFIX exportado
- P16 e P22 -> Resolvido; library-docs §8

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

```bash
git add src/lib/auth/createAuth.ts src/lib/auth/hardening.test.ts src/lib/auth/ipUnknown.test.ts test/pendenciasDoc.test.ts .context/pendencias.md .context/library-docs.md
git status --short
git commit -F .git/sdd/f6/msg-task-4.txt
```

Expected: `git status --short` lista só esses seis caminhos antes do commit; o commit passa nos hooks (se algum hook falhar, corrija a causa e crie um commit novo, nunca `--no-verify`).

### Task 5: Link de redefinição de senha gerado pelo admin (`refactor(equipe)` + `feat(equipe)`)

**Dois commits** (regra "refatoração nunca no mesmo commit de feature"): **(A)** `refactor(equipe)`: só a extração do `useShareLink` do `InviteLinkCard`, com testes **novos** do hook (nenhum teste existente do `InviteLinkCard` muda); **(B)** `feat(equipe)`: o link de redefinição inteiro. Depende das Tarefas 1 e 4 (a `noReferrer` e a lista de regras do `next.config.ts`; o hash do token, a revogação das sessões e o `RESET_PASSWORD_PREFIX`).

**Files (A):**
- Create: `src/components/admin/team/useShareLink.ts`, `src/components/admin/team/useShareLink.test.tsx`
- Modify: `src/components/admin/team/InviteLinkCard.tsx` (sem mudar comportamento; `InviteLinkCard.test.tsx` **não** muda)
- Modify: `.context/ui-registry.md` (`useShareLink` novo e `InviteLinkCard`)

**Files (B):**
- Create: `src/features/admin/passwordReset.ts` (+ `passwordReset.test.ts`), `src/app/(app)/admin/equipe/passwordResetAction.test.ts`, `src/components/admin/team/PasswordResetLinkButton.tsx` (+ teste), `src/components/auth/ResetPasswordForm.tsx` (+ teste), `src/app/(auth)/redefinir-senha/page.tsx` (+ `page.test.tsx`)
- Modify: `src/features/admin/{people,result,messages,schemas}.ts` e os quatro testes (`people.test.ts`, `result.test.ts`, `messages.test.ts`, `schemas.test.ts`); `src/app/(app)/admin/equipe/actions.ts`; `src/app/(app)/admin/actionsInventory.test.ts`; `src/components/admin/team/{PersonRowActions,TeamAdmin}.tsx` e os dois testes; `src/components/auth/SignInPanel.tsx` (+ teste); `src/features/authz/proxyRules.ts` (+ teste); `next.config.ts` e `src/app/nextConfig.test.ts`; `src/lib/auth/errors.ts`, `errors.test.ts`, `errorCodesContract.test.ts`; `e2e/cadastros.spec.ts`; `test/uiRegistryDoc.test.ts`; `test/pendenciasDoc.test.ts`; `.context/{ui-registry,pendencias,architecture,library-docs}.md`

Nenhuma migração: a redefinição usa a tabela `verification` que já existe.

**Interfaces:**
- Consumes: `RESET_PASSWORD_PREFIX` e a configuração do Better Auth da Tarefa 4; `noReferrer` do `next.config.ts` (Tarefa 1); `runAdminAction` (`src/features/admin/runAdminAction.ts`), `useAdminAction` (`src/components/admin/useAdminAction.ts`), `formatDateTimeBR` (`@/lib/dateTime`), `isHttpUrl` (`@/features/invites/inviteUrl`), `notFoundMessage` (`messages.ts`), `authErrorMessage` e `errorCodeOf` (`@/lib/auth/errors`, `authFormError`), `createTestAuth`, `signUpWithInvite`, `TEST_AUTH_ENV`, `insertInvite`, `insertSector`, `insertUser`, `insertSession`, `authzOf` (`test/authz.ts`).
- Produces (nomes e assinaturas do **Contrato de interfaces → Link de redefinição**): `useShareLink({ url, shareTitle, shareText })` → `{ canShare, copy, share }`; `PASSWORD_RESET_TTL_MS`, `buildPasswordResetUrl`, `createPasswordResetLink`; o código `PERSON_INACTIVE` e as mensagens `PERSON_RESET_INACTIVE_MESSAGE` e `PASSWORD_RESET_FORBIDDEN_MESSAGE`; `createPasswordResetLinkSchema`; `createPasswordResetLinkAction`; `PasswordResetLinkButton`; `takeTokenFromLocation` e `ResetPasswordForm`; a rota pública estática `/redefinir-senha`; o rótulo do campo `Link para copiar` e o botão `Nova senha` (a Tarefa 7 e a Tarefa 9 os usam).

**Antes de começar:** carregue a skill instalada do Better Auth e leia `.context/library-docs.md §8` (inclusive os bullets que a Tarefa 4 acrescentou); leia também, em `node_modules/next/dist/docs/`, `01-app/03-api-reference/05-config/01-next-config-js/headers.md` e `01-app/03-api-reference/03-file-conventions/proxy.md`. Confira que as Tarefas 1 e 4 estão no histórico: `grep -n "RESET_PASSWORD_PREFIX" src/lib/auth/createAuth.ts` e `grep -n "convite/:path" next.config.ts` devem achar uma linha cada. Obtenha a data do dia (o `<DATA>` abaixo):

```bash
bun -e 'console.log(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()))'
```

**Fatos medidos no planejamento que moldam o código:**
1. `POST /api/auth/reset-password` só procura a `verification` `reset-password:<token>` (guardada com hash pela Tarefa 4) com `value = userId`; a exigência de `sendResetPassword` existe só no `/request-password-reset`, que segue respondendo `RESET_PASSWORD_DISABLED`. O `auth.handler` exige o cabeçalho `origin`.
2. `userEvent.setup()` instala o próprio `navigator.clipboard`: o espião de `writeText` tem que ser definido **depois** do `setup()` (nos testes do botão).
3. Com o diálogo do Base UI aberto, o resto da página fica `aria-hidden`: afirmações sobre o botão que abriu o diálogo usam `getByRole(..., { hidden: true })`.
4. `insertSector(db, name?)` recebe o nome como segundo argumento (não um objeto).

## Commit A — `refactor(equipe)`: extrair o `useShareLink`

- [ ] **Step A1: Escrever o teste do hook (falhando)**

Crie `src/components/admin/team/useShareLink.test.tsx` com a ferramenta Write:

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useShareLink } from "./useShareLink";

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  writeText: vi.fn(),
  share: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const URL_OF_LINK = "https://closery.example.test/convite/token-de-teste";
const INPUT = {
  url: URL_OF_LINK,
  shareTitle: "Título de teste",
  shareText: "Texto de teste.",
};

function defineNavigator(name: "clipboard" | "share", value: unknown) {
  Object.defineProperty(navigator, name, { configurable: true, value });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.writeText.mockResolvedValue(undefined);
  mocks.share.mockResolvedValue(undefined);
  defineNavigator("clipboard", { writeText: mocks.writeText });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
  Reflect.deleteProperty(navigator, "share");
});

describe("useShareLink: copiar", () => {
  it("copia o link e avisa", async () => {
    const { result } = renderHook(() => useShareLink(INPUT));

    await act(async () => {
      await result.current.copy();
    });

    expect(mocks.writeText).toHaveBeenCalledWith(URL_OF_LINK);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Link copiado.");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("copiar recusado pelo navegador avisa como copiar à mão", async () => {
    mocks.writeText.mockRejectedValue(
      new DOMException("negado", "NotAllowedError"),
    );
    const { result } = renderHook(() => useShareLink(INPUT));

    await act(async () => {
      await result.current.copy();
    });

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Não foi possível copiar. Selecione o link e copie.",
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("sem navigator.clipboard (contexto inseguro) avisa sem lançar", async () => {
    Reflect.deleteProperty(navigator, "clipboard");
    const { result } = renderHook(() => useShareLink(INPUT));

    await act(async () => {
      await result.current.copy();
    });

    expect(mocks.toastError).toHaveBeenCalledWith(
      "Não foi possível copiar. Selecione o link e copie.",
    );
  });

  it("copia o link novo quando a url muda", async () => {
    const { result, rerender } = renderHook(
      (props: typeof INPUT) => useShareLink(props),
      { initialProps: INPUT },
    );

    rerender({ ...INPUT, url: "https://closery.example.test/outro" });
    await act(async () => {
      await result.current.copy();
    });

    expect(mocks.writeText).toHaveBeenCalledWith(
      "https://closery.example.test/outro",
    );
  });
});

describe("useShareLink: canShare", () => {
  it("é falso sem navigator.share", () => {
    const { result } = renderHook(() => useShareLink(INPUT));
    expect(result.current.canShare).toBe(false);
  });

  it("é verdadeiro com navigator.share, só depois de montar", async () => {
    defineNavigator("share", mocks.share);
    const { result } = renderHook(() => useShareLink(INPUT));

    await waitFor(() => expect(result.current.canShare).toBe(true));
  });

  it("no servidor (renderToString) é falso mesmo com navigator.share", () => {
    defineNavigator("share", mocks.share);
    function Probe() {
      const { canShare } = useShareLink(INPUT);
      return <span>{canShare ? "pode" : "nao-pode"}</span>;
    }

    expect(renderToString(<Probe />)).toContain("nao-pode");
  });
});

describe("useShareLink: compartilhar", () => {
  it("envia título, texto e link", async () => {
    defineNavigator("share", mocks.share);
    const { result } = renderHook(() => useShareLink(INPUT));

    await act(async () => {
      await result.current.share();
    });

    expect(mocks.share).toHaveBeenCalledWith({
      title: "Título de teste",
      text: "Texto de teste.",
      url: URL_OF_LINK,
    });
    expect(mocks.writeText).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("fechar a folha de compartilhamento (AbortError) é silencioso", async () => {
    mocks.share.mockRejectedValue(new DOMException("fechou", "AbortError"));
    defineNavigator("share", mocks.share);
    const { result } = renderHook(() => useShareLink(INPUT));

    await act(async () => {
      await result.current.share();
    });

    expect(mocks.writeText).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("falha real ao compartilhar cai para copiar o link", async () => {
    mocks.share.mockRejectedValue(
      new DOMException("sem app", "NotAllowedError"),
    );
    defineNavigator("share", mocks.share);
    const { result } = renderHook(() => useShareLink(INPUT));

    await act(async () => {
      await result.current.share();
    });

    expect(mocks.writeText).toHaveBeenCalledWith(URL_OF_LINK);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Link copiado.");
  });

  it("falha que não é DOMException também cai para copiar", async () => {
    mocks.share.mockRejectedValue(new TypeError("estranho"));
    defineNavigator("share", mocks.share);
    const { result } = renderHook(() => useShareLink(INPUT));

    await act(async () => {
      await result.current.share();
    });

    expect(mocks.writeText).toHaveBeenCalledWith(URL_OF_LINK);
  });
});
```

- [ ] **Step A2: Rodar e ver falhar**

Run: `bunx vitest run src/components/admin/team/useShareLink.test.tsx`
Expected: FAIL, `Test Files  1 failed (1)`, `Tests  no tests`, com `Error: Failed to resolve import "./useShareLink" from "src/components/admin/team/useShareLink.test.tsx". Does the file exist?`.

- [ ] **Step A3: Implementar `useShareLink.ts`**

Crie `src/components/admin/team/useShareLink.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

// Copiar e compartilhar um link que aparece uma vez só (convite, nova senha).
// `canShare` só vale depois de montar: no servidor `navigator` não existe e o
// HTML inicial precisa ser igual ao do cliente.
export function useShareLink({
  url,
  shareTitle,
  shareText,
}: {
  url: string;
  shareTitle: string;
  shareText: string;
}) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie.");
    }
  }

  async function share() {
    try {
      await navigator.share({ title: shareTitle, text: shareText, url });
    } catch (error) {
      // Fechar a folha de compartilhamento não é erro.
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copy();
    }
  }

  return { canShare, copy, share };
}
```

Run: `bunx vitest run src/components/admin/team/useShareLink.test.tsx src/components/admin/team/InviteLinkCard.test.tsx`
Expected: PASS, `Test Files  2 passed (2)` e `Tests  21 passed (21)` (11 do hook e os 10 de sempre do cartão: o cartão ainda tem a cópia própria da lógica).

- [ ] **Step A4: Fazer o `InviteLinkCard` usar o hook**

Troque:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTimeBR } from "@/lib/dateTime";

export function InviteLinkCard({
  url,
```

por:

```tsx
"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTimeBR } from "@/lib/dateTime";
import { useShareLink } from "./useShareLink";

export function InviteLinkCard({
  url,
```

Troque:

```tsx
  expiresAt: Date;
  onReset: () => void;
}) {
  // Só depois de montar: no servidor `navigator` não existe e o HTML inicial
  // precisa ser igual ao do cliente.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  // O cartão substitui o formulário que tinha o foco: leva o foco ao título
  // (leitor de tela anuncia "Convite gerado" e a pessoa segue dali).
```

por:

```tsx
  expiresAt: Date;
  onReset: () => void;
}) {
  const { canShare, copy, share } = useShareLink({
    url,
    shareTitle: "Convite para o Closery",
    shareText: "Você foi convidado para o Closery.",
  });

  // O cartão substitui o formulário que tinha o foco: leva o foco ao título
  // (leitor de tela anuncia "Convite gerado" e a pessoa segue dali).
```

Troque:

```tsx
    titleRef.current?.focus();
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie.");
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: "Convite para o Closery",
        text: "Você foi convidado para o Closery.",
        url,
      });
    } catch (error) {
      // Fechar a folha de compartilhamento não é erro.
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copy();
    }
  }

  return (
    <section
      className="flex flex-col gap-4"
```

por:

```tsx
    titleRef.current?.focus();
  }, []);

  return (
    <section
      className="flex flex-col gap-4"
```

Run: `bunx biome check --write src/components/admin/team` e depois `git diff --stat -- src/components/admin/team/InviteLinkCard.test.tsx`
Expected: o Biome sem correção pendente e o `git diff --stat` **sem saída** (o teste do cartão não pode mudar nesta refatoração).

Run: `bunx vitest run src/components/admin/team/useShareLink.test.tsx src/components/admin/team/InviteLinkCard.test.tsx src/components/admin/team/InviteForm.test.tsx`
Expected: PASS, `Test Files  3 passed (3)` e `Tests  39 passed (39)`: os 10 testes do `InviteLinkCard` passam **sem edição**.

- [ ] **Step A5: O guarda do catálogo pede a entrada nova (falhando) e a entrada**

Run: `bunx vitest run test/uiRegistryDoc.test.ts`
Expected: FAIL, `Tests  1 failed | 118 passed (119)` com `src\components\admin\team\useShareLink.ts está no catálogo` e `nenhuma menção a "UseShareLink" em .context/ui-registry.md`.

Em `.context/ui-registry.md` (onde aparece `<DATA>` entra a data do dia da execução; **substitua só os `<DATA>`: datas que já existem, como `2026-11-21` e `2026-11-24`, ficam**):

Troque:

```markdown
- **Como funciona:** `"use client"`; campo somente leitura "Link do convite" (seleciona ao focar); "Copiar link" usa `navigator.clipboard` e avisa por toast (falha ou contexto sem clipboard = toast com instrução de copiar à mão); "Compartilhar" só aparece se `navigator.share` existir (detectado depois de montar, sem divergir do HTML do servidor), `AbortError` é silencioso e qualquer outra falha cai em copiar; mostra a validade em horário de Brasília e o aviso de que o link não volta; "Gerar outro convite" chama `onReset`; ao montar, o foco vai ao título "Convite gerado" (`h3`, `tabIndex={-1}`).
- **Usa:** `Button`, `Input`, `sonner`, `formatDateTimeBR`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 10). 2026-11-24 — Fase 4 (Tarefa 3, P29): foco no título ao montar.
```

por:

```markdown
- **Como funciona:** `"use client"`; campo somente leitura "Link do convite" (seleciona ao focar); "Copiar link" usa `navigator.clipboard` e avisa por toast (falha ou contexto sem clipboard = toast com instrução de copiar à mão); "Compartilhar" só aparece se `navigator.share` existir (detectado depois de montar, sem divergir do HTML do servidor), `AbortError` é silencioso e qualquer outra falha cai em copiar; mostra a validade em horário de Brasília e o aviso de que o link não volta; "Gerar outro convite" chama `onReset`; ao montar, o foco vai ao título "Convite gerado" (`h3`, `tabIndex={-1}`).
- **Usa:** `Button`, `Input`, `useShareLink`, `formatDateTimeBR`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 10). 2026-11-24 — Fase 4 (Tarefa 3, P29): foco no título ao montar. <DATA> — Fase 6 (Tarefa 5): copiar e compartilhar passaram para o `useShareLink` (refatoração, o comportamento e o teste não mudaram).

### useShareLink
- **Status:** ✅ pronto (<DATA>)
- **Local:** `src/components/admin/team/useShareLink.ts`
- **Propósito:** copiar e compartilhar um link que aparece uma vez só (convite e, a partir da Tarefa 5 da Fase 6, nova senha), sem repetir a lógica em cada cartão.
- **Como funciona:** `"use client"`; `useShareLink({ url, shareTitle, shareText })` devolve `{ canShare, copy, share }`. `canShare` é falso no servidor e antes de montar e só vira `true` num `useEffect` quando `navigator.share` existe (o HTML do servidor não diverge do cliente). `copy` usa `navigator.clipboard.writeText` e avisa por toast (`Link copiado.`; falha ou contexto sem clipboard = `Não foi possível copiar. Selecione o link e copie.`). `share` chama `navigator.share({ title, text, url })`; `AbortError` (fechar a folha) é silencioso e qualquer outra falha cai em `copy`.
- **Usa:** `sonner`.
- **Histórico:** <DATA> — extraído do `InviteLinkCard` na Fase 6 (Tarefa 5, commit de refatoração).
```

Run: `bunx vitest run test/uiRegistryDoc.test.ts`
Expected: PASS, `Tests  119 passed (119)`.

- [ ] **Step A6: Portões**

```bash
bun run check-types
bun run lint
bunx vitest run src/components/admin test/uiRegistryDoc.test.ts
```

Expected: sem erro de tipo; `lint` sem correção pendente; Vitest `Test Files  35 passed (35)` e `Tests  383 passed (383)` (medido: o conjunto `src/components/admin` + `test/uiRegistryDoc.test.ts` na máquina do planejamento). Depois o `bun run test` inteiro: total = o do fim da Tarefa 4 + 1 arquivo e + **12** testes (11 do hook e 1 do `uiRegistryDoc`, que passa a varrer `useShareLink.ts`); anote os dois números (`Test Files` e `Tests`).

Build e E2E inteiro (35), numa chamada só, com a env fictícia:

```bash
export DATABASE_URL="postgresql://closery:fake@127.0.0.1:1/closery?sslmode=disable"
export DATABASE_URL_POOLED="$DATABASE_URL"
export BETTER_AUTH_URL="http://localhost:3201"
export BETTER_AUTH_SECRET="segredo-local-de-teste-nao-usar-0123456789abcdef"
export NEXT_PUBLIC_SENTRY_DSN=""
bun run build
```

Expected: build verde, mesmas rotas de antes (nenhuma nova). Confira que as portas 3200 e 54329 estão livres (`netstat -ano | grep -E ':3200|:54329' | grep LISTENING` sem saída) e rode `bun run test:e2e`: `35 passed`. Se divergir, pare e reporte BLOCKED com o número medido.

- [ ] **Step A7: Commit A**

Crie `.git/sdd/f6/msg-task-5a.txt` com a ferramenta Write:

```text
refactor(equipe): extrai o useShareLink do InviteLinkCard

Copiar e compartilhar o link passam para um hook, para o link de nova
senha (commit seguinte) não repetir a lógica. Nenhum comportamento muda
e o InviteLinkCard.test.tsx continua sem nenhuma edição; o hook tem
testes novos. ui-registry atualizado.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

```bash
git add src/components/admin/team/useShareLink.ts src/components/admin/team/useShareLink.test.tsx src/components/admin/team/InviteLinkCard.tsx .context/ui-registry.md
git status --short
git commit -F .git/sdd/f6/msg-task-5a.txt
```

Expected: `git status --short` lista só esses quatro caminhos antes do commit.

## Commit B — `feat(equipe)`: o link de redefinição

- [ ] **Step B1: `INVALID_TOKEN` no mapa de erros (teste primeiro)**

Em `src/lib/auth/errors.test.ts` (o mapa passa de 20 para 21 códigos) e em `src/lib/auth/errorCodesContract.test.ts`:

Troque:

```ts
  ],
  ["INVALID_EMAIL_OR_PASSWORD", "E-mail ou senha incorretos."],
  ["INVALID_EMAIL", "Informe um e-mail válido."],
  ["PASSWORD_TOO_SHORT", "A senha precisa ter pelo menos 8 caracteres."],
  ["PASSWORD_TOO_LONG", "A senha pode ter no máximo 128 caracteres."],
  [
```

por:

```ts
  ],
  ["INVALID_EMAIL_OR_PASSWORD", "E-mail ou senha incorretos."],
  ["INVALID_EMAIL", "Informe um e-mail válido."],
  [
    "INVALID_TOKEN",
    "Este link de redefinição venceu ou já foi usado. Peça outro ao administrador.",
  ],
  ["PASSWORD_TOO_SHORT", "A senha precisa ter pelo menos 8 caracteres."],
  ["PASSWORD_TOO_LONG", "A senha pode ter no máximo 128 caracteres."],
  [
```

Troque:

```ts
    );
  });

  it("o mapa tem exatamente os 20 códigos do contrato", () => {
    expect(Object.keys(AUTH_ERROR_MESSAGES).sort()).toEqual(
      EXPECTED.map(([code]) => code).sort(),
    );
```

por:

```ts
    );
  });

  it("o mapa tem exatamente os 21 códigos do contrato", () => {
    expect(Object.keys(AUTH_ERROR_MESSAGES).sort()).toEqual(
      EXPECTED.map(([code]) => code).sort(),
    );
```

Troque:

```ts
  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
  "INVALID_EMAIL_OR_PASSWORD",
  "INVALID_EMAIL",
  "PASSWORD_TOO_SHORT",
  "PASSWORD_TOO_LONG",
  "SESSION_NOT_FRESH",
```

por:

```ts
  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
  "INVALID_EMAIL_OR_PASSWORD",
  "INVALID_EMAIL",
  "INVALID_TOKEN",
  "PASSWORD_TOO_SHORT",
  "PASSWORD_TOO_LONG",
  "SESSION_NOT_FRESH",
```

Run: `bunx vitest run src/lib/auth/errors.test.ts src/lib/auth/errorCodesContract.test.ts`
Expected: FAIL, 3 testes: `o mapa tem exatamente os 21 códigos do contrato`, `traduz INVALID_TOKEN` (`expected 'Não foi possível concluir. Tente de n…' to be 'Este link de redefinição venceu ou já…'`) e `todo código do mapa é coberto por um dos grupos acima (e vice-versa)`.

Em `src/lib/auth/errors.ts`:

Troque:

```ts
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: ALREADY_EXISTS,
    INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
    INVALID_EMAIL: "Informe um e-mail válido.",
    PASSWORD_TOO_SHORT: "A senha precisa ter pelo menos 8 caracteres.",
    PASSWORD_TOO_LONG: "A senha pode ter no máximo 128 caracteres.",
    email_not_found:
```

por:

```ts
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: ALREADY_EXISTS,
    INVALID_EMAIL_OR_PASSWORD: "E-mail ou senha incorretos.",
    INVALID_EMAIL: "Informe um e-mail válido.",
    INVALID_TOKEN:
      "Este link de redefinição venceu ou já foi usado. Peça outro ao administrador.",
    PASSWORD_TOO_SHORT: "A senha precisa ter pelo menos 8 caracteres.",
    PASSWORD_TOO_LONG: "A senha pode ter no máximo 128 caracteres.",
    email_not_found:
```

Run: `bunx vitest run src/lib/auth/errors.test.ts src/lib/auth/errorCodesContract.test.ts`
Expected: PASS (os dois arquivos).

- [ ] **Step B2: `PERSON_INACTIVE`, as mensagens e o schema (testes primeiro)**

Testes:

Troque:

```ts
    SECTOR_INACTIVE: true,
    SECTOR_IN_USE: true,
    SELF_CHANGE: true,
    LAST_ADMIN: true,
    INVITE_NOT_PENDING: true,
    SHIFT_INACTIVE: true,
```

por:

```ts
    SECTOR_INACTIVE: true,
    SECTOR_IN_USE: true,
    SELF_CHANGE: true,
    PERSON_INACTIVE: true,
    LAST_ADMIN: true,
    INVITE_NOT_PENDING: true,
    SHIFT_INACTIVE: true,
```

Troque:

```ts
    INTERNAL: true,
  };

  it("a lista do contrato tem os 22 códigos, sem repetição", () => {
    expect(Object.keys(CONTRACT)).toHaveLength(22);
  });

  it("fail aceita os 2 códigos novos e os de antes continuam valendo", () => {
```

por:

```ts
    INTERNAL: true,
  };

  it("a lista do contrato tem os 23 códigos, sem repetição", () => {
    expect(Object.keys(CONTRACT)).toHaveLength(23);
  });

  it("fail aceita os 2 códigos novos e os de antes continuam valendo", () => {
```

Troque:

```ts
  LAST_ADMIN_MESSAGE,
  nameTakenMessage,
  notFoundMessage,
  PERSON_SECTOR_INACTIVE_MESSAGE,
  SECTOR_INACTIVE_MESSAGE,
  SECTOR_REQUIRED_MESSAGE,
```

por:

```ts
  LAST_ADMIN_MESSAGE,
  nameTakenMessage,
  notFoundMessage,
  PASSWORD_RESET_FORBIDDEN_MESSAGE,
  PERSON_RESET_INACTIVE_MESSAGE,
  PERSON_SECTOR_INACTIVE_MESSAGE,
  SECTOR_INACTIVE_MESSAGE,
  SECTOR_REQUIRED_MESSAGE,
```

Troque:

```ts
    expect(PERSON_SECTOR_INACTIVE_MESSAGE).toBe(
      "O setor desta pessoa está inativo. Edite a pessoa e escolha outro setor antes de reativar.",
    );
  });
});
```

por:

```ts
    expect(PERSON_SECTOR_INACTIVE_MESSAGE).toBe(
      "O setor desta pessoa está inativo. Edite a pessoa e escolha outro setor antes de reativar.",
    );
    expect(PERSON_RESET_INACTIVE_MESSAGE).toBe(
      "Esta conta está desativada. Reative antes de gerar um link de redefinição.",
    );
    expect(PASSWORD_RESET_FORBIDDEN_MESSAGE).toBe(
      "Só administradores geram links de redefinição.",
    );
  });
});
```

Troque:

```ts
  createDestinationSchema,
  createInviteSchema,
  createItemSchema,
  createSectorSchema,
  createShiftSchema,
  firstFieldErrors,
```

por:

```ts
  createDestinationSchema,
  createInviteSchema,
  createItemSchema,
  createPasswordResetLinkSchema,
  createSectorSchema,
  createShiftSchema,
  firstFieldErrors,
```

Troque:

```ts
  });
});

describe("convites", () => {
  const valid = {
    inviteeLabel: "Turno da noite",
```

por:

```ts
  });
});

describe("createPasswordResetLinkSchema", () => {
  it("aceita um userId de texto livre", () => {
    expect(
      createPasswordResetLinkSchema.safeParse({ userId: "abc123" }).success,
    ).toBe(true);
  });

  it("userId vazio, ausente ou de outro tipo é recusado em português", () => {
    for (const input of [{ userId: "" }, {}, { userId: 1 }]) {
      expect(errorsOf(createPasswordResetLinkSchema, input)).toEqual({
        userId: "Confira os campos e tente de novo.",
      });
    }
  });
});

describe("convites", () => {
  const valid = {
    inviteeLabel: "Turno da noite",
```

Troque:

```ts
    updateItemSchema,
    updatePersonSchema,
    setPersonActiveSchema,
    createInviteSchema,
    cancelInviteSchema,
  };
```

por:

```ts
    updateItemSchema,
    updatePersonSchema,
    setPersonActiveSchema,
    createPasswordResetLinkSchema,
    createInviteSchema,
    cancelInviteSchema,
  };
```

Run: `bunx vitest run src/features/admin/result.test.ts src/features/admin/messages.test.ts src/features/admin/schemas.test.ts`
Expected: FAIL, `Test Files  2 failed | 1 passed (3)` e `Tests  4 failed | 62 passed (66)`: `são os textos da tabela de mensagens de domínio` (`expected undefined to be 'Esta conta está desativada. …'`) e os três casos de `createPasswordResetLinkSchema` (`Cannot read properties of undefined (reading 'safeParse')`). O `result.test.ts` passa em tempo de execução (o contrato `Record<AdminErrorCode, true>` é conferido pelo compilador): o vermelho dele aparece no `bun run check-types` do Step B11 se `PERSON_INACTIVE` faltar na união.

Código:

Troque:

```ts
  | "SECTOR_INACTIVE"
  | "SECTOR_IN_USE"
  | "SELF_CHANGE"
  | "LAST_ADMIN"
  | "INVITE_NOT_PENDING"
  | "SHIFT_INACTIVE"
```

por:

```ts
  | "SECTOR_INACTIVE"
  | "SECTOR_IN_USE"
  | "SELF_CHANGE"
  | "PERSON_INACTIVE"
  | "LAST_ADMIN"
  | "INVITE_NOT_PENDING"
  | "SHIFT_INACTIVE"
```

Troque:

```ts
  "O nome de referência pode ter no máximo 80 caracteres.";
export const PERSON_SECTOR_INACTIVE_MESSAGE =
  "O setor desta pessoa está inativo. Edite a pessoa e escolha outro setor antes de reativar.";
```

por:

```ts
  "O nome de referência pode ter no máximo 80 caracteres.";
export const PERSON_SECTOR_INACTIVE_MESSAGE =
  "O setor desta pessoa está inativo. Edite a pessoa e escolha outro setor antes de reativar.";
export const PERSON_RESET_INACTIVE_MESSAGE =
  "Esta conta está desativada. Reative antes de gerar um link de redefinição.";
export const PASSWORD_RESET_FORBIDDEN_MESSAGE =
  "Só administradores geram links de redefinição.";
```

Troque:

```ts
  active: activeSchema,
});

const inviteeLabelSchema = z
  .string({ error: INVALID_INPUT_MESSAGE })
  .transform((raw, ctx) => {
```

por:

```ts
  active: activeSchema,
});

export const createPasswordResetLinkSchema = z.object({ userId: userIdSchema });

const inviteeLabelSchema = z
  .string({ error: INVALID_INPUT_MESSAGE })
  .transform((raw, ctx) => {
```

Troque:

```ts
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type SetPersonActiveInput = z.infer<typeof setPersonActiveSchema>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type CancelInviteInput = z.infer<typeof cancelInviteSchema>;
```

por:

```ts
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type SetPersonActiveInput = z.infer<typeof setPersonActiveSchema>;
export type CreatePasswordResetLinkInput = z.infer<
  typeof createPasswordResetLinkSchema
>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type CancelInviteInput = z.infer<typeof cancelInviteSchema>;
```

Run: `bunx vitest run src/lib/auth/errors.test.ts src/lib/auth/errorCodesContract.test.ts src/features/admin/result.test.ts src/features/admin/messages.test.ts src/features/admin/schemas.test.ts`
Expected: PASS, `Test Files  5 passed (5)` e `Tests  122 passed (122)`.

- [ ] **Step B3: Desativar derruba o link de redefinição (teste primeiro)**

Em `src/features/admin/people.test.ts` (três casos novos no `describe("setPersonActive")`, antes de `recusa não apaga sessões (SELF_CHANGE)`):

Troque:

```ts
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { session, user } from "@/db/schema/auth";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertSector,
```

por:

```ts
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { session, user, verification } from "@/db/schema/auth";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertSector,
```

Troque:

```ts
    expect(await countSessions(admin.id)).toBe(1);
  });

  it("recusa não apaga sessões (SELF_CHANGE)", async () => {
    const me = await insertUser(db, { role: "admin", sectorId: null });
    await insertUser(db, { role: "admin", sectorId: null });
```

por:

```ts
    expect(await countSessions(admin.id)).toBe(1);
  });

  it("desativar derruba o link de redefinição da pessoa e só o dela, mantendo as verificações de outro tipo", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
    });
    const bystander = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
    });
    const expiresAt = new Date(NOW.getTime() + 60 * 60 * 1000);
    await db.insert(verification).values([
      { id: "v-pessoa", identifier: "hash-1", value: person.id, expiresAt },
      { id: "v-outra", identifier: "hash-2", value: bystander.id, expiresAt },
      {
        id: "v-json",
        identifier: "passkey-challenge:x",
        value: JSON.stringify({ userId: person.id, challenge: "abc" }),
        expiresAt,
      },
    ]);

    await setPersonActive(
      db,
      { actorId: admin.id, userId: person.id, active: false },
      NOW,
    );

    const ids = (await db.select().from(verification))
      .map((row) => row.id)
      .sort();
    expect(ids).toEqual(["v-json", "v-outra"]);
  });

  it("reativar não cria link de redefinição", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
      deactivatedAt: NOW,
    });

    const result = await setPersonActive(
      db,
      { actorId: admin.id, userId: person.id, active: true },
      NOW,
    );

    expect(result).toEqual({ ok: true });
    expect(await db.select().from(verification)).toHaveLength(0);
  });

  it("recusa não apaga o link de redefinição (SELF_CHANGE)", async () => {
    const me = await insertUser(db, { role: "admin", sectorId: null });
    await insertUser(db, { role: "admin", sectorId: null });
    await db.insert(verification).values({
      id: "v-meu",
      identifier: "hash-3",
      value: me.id,
      expiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
    });

    const result = await setPersonActive(
      db,
      { actorId: me.id, userId: me.id, active: false },
      NOW,
    );

    expect(result).toMatchObject({ ok: false, code: "SELF_CHANGE" });
    expect(await db.select().from(verification)).toHaveLength(1);
  });

  it("recusa não apaga sessões (SELF_CHANGE)", async () => {
    const me = await insertUser(db, { role: "admin", sectorId: null });
    await insertUser(db, { role: "admin", sectorId: null });
```

Run: `bunx vitest run src/features/admin/people.test.ts`
Expected: FAIL, `Tests  1 failed | 31 passed (32)`: `desativar derruba o link de redefinição da pessoa e só o dela, mantendo as verificações de outro tipo` com `expected [ 'v-json', 'v-outra', 'v-pessoa' ] to deeply equal [ 'v-json', 'v-outra' ]` (os outros dois casos novos já passam: são os que garantem que reativar e a recusa não mexem em nada).

Em `src/features/admin/people.ts` (`setPersonActive`, ramo da desativação, na mesma transação):

Troque:

```ts

import { and, asc, count, eq, isNull, sql } from "drizzle-orm";

import { session, user } from "@/db/schema/auth";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import type { Role } from "@/lib/roles";
```

por:

```ts

import { and, asc, count, eq, isNull, sql } from "drizzle-orm";

import { session, user, verification } from "@/db/schema/auth";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import type { Role } from "@/lib/roles";
```

Troque:

```ts
      // P11: sem isto a pessoa desativada seguiria logada até a sessão vencer.
      // Apaga mesmo se ela já estava desativada (sobra de antes da P11).
      await tx.delete(session).where(eq(session.userId, input.userId));
      return ok();
    }
```

por:

```ts
      // P11: sem isto a pessoa desativada seguiria logada até a sessão vencer.
      // Apaga mesmo se ela já estava desativada (sobra de antes da P11).
      await tx.delete(session).where(eq(session.userId, input.userId));
      // Link de nova senha que ainda circula (WhatsApp) morre junto: reativar
      // dentro das 24 h não pode ressuscitá-lo. Só a redefinição guarda o userId
      // cru em `value` (as outras verificações guardam JSON).
      await tx.delete(verification).where(eq(verification.value, input.userId));
      return ok();
    }
```

Run: `bunx vitest run src/features/admin/people.test.ts`
Expected: PASS, `Tests  32 passed (32)`.

- [ ] **Step B4: `createPasswordResetLink` (teste primeiro, com o Better Auth de verdade)**

Crie `src/features/admin/passwordReset.test.ts`. Ele faz o reset **de verdade** pelo `auth.handler` (a Tarefa 4 guarda o hash e revoga as sessões): é o guarda contra mudança do formato interno do Better Auth em upgrade.

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { account, session, user, verification } from "@/db/schema/auth";
import type { Authz } from "@/features/authz/authz";
import {
  createTestAuth,
  signUpWithInvite,
  TEST_AUTH_ENV,
} from "../../../test/auth";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertInvite, insertSector, insertUser } from "../../../test/fixtures";
import {
  PASSWORD_RESET_FORBIDDEN_MESSAGE,
  PERSON_RESET_INACTIVE_MESSAGE,
} from "./messages";
import {
  buildPasswordResetUrl,
  createPasswordResetLink,
  PASSWORD_RESET_TTL_MS,
} from "./passwordReset";
import { setPersonActive } from "./people";

const NOW = new Date("2026-11-25T12:00:00.000Z");
const BASE_URL = TEST_AUTH_ENV.baseURL;
const OLD_PASSWORD = "senha-antiga-123";
const NEW_PASSWORD = "senha-nova-4567";

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

function adminActor(userId = "admin-1"): Authz {
  return {
    userId,
    name: "Admin Teste",
    email: "admin@example.test",
    role: "admin",
    sectorId: null,
  };
}

function operatorActor(): Authz {
  return {
    userId: "op-1",
    name: "Operador Teste",
    email: "op@example.test",
    role: "operator",
    sectorId: "s",
  };
}

// Pessoa real: cadastro pelo portão do convite (cria user + conta credential).
async function signedUpOperator(email = "ana@example.test") {
  const sector = await insertSector(db);
  const { token } = await insertInvite(db, {
    role: "operator",
    sectorId: sector.id,
    now: new Date(),
  });
  await signUpWithInvite(auth, token, {
    name: "Ana Teste",
    email,
    password: OLD_PASSWORD,
  });
  const [row] = await db.select().from(user).where(eq(user.email, email));
  if (!row) throw new Error("usuário não criado");
  return row;
}

function tokenOf(url: string): string {
  const token = new URL(url).hash.replace("#token=", "");
  if (!token) throw new Error(`link sem token: ${url}`);
  return token;
}

async function link(userId: string, now = NOW) {
  const result = await createPasswordResetLink(
    db,
    auth,
    { actor: adminActor(), userId, baseURL: BASE_URL },
    now,
  );
  if (!result.ok) throw new Error(`link falhou: ${result.message}`);
  return { ...result, token: tokenOf(result.url) };
}

function http(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return auth.handler(
    new Request(`${BASE_URL}/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: BASE_URL,
        ...headers,
      },
      body: JSON.stringify(body),
    }),
  );
}

const resetWith = (token: string, newPassword = NEW_PASSWORD) =>
  http("/reset-password", { token, newPassword });

const signIn = (email: string, password: string) =>
  http("/sign-in/email", { email, password });

async function errorCode(res: Response): Promise<string | undefined> {
  const body: unknown = await res.json();
  return typeof body === "object" &&
    body !== null &&
    "code" in body &&
    typeof body.code === "string"
    ? body.code
    : undefined;
}

describe("buildPasswordResetUrl", () => {
  it("usa só a origem e põe o token no fragmento", () => {
    expect(
      buildPasswordResetUrl(
        "https://closery.example.test/qualquer/coisa",
        "abc",
      ),
    ).toBe("https://closery.example.test/redefinir-senha#token=abc");
  });

  it("URL sem protocolo lança", () => {
    expect(() => buildPasswordResetUrl("localhost:3000", "abc")).toThrow(
      /URL base inválida/,
    );
  });
});

describe("createPasswordResetLink", () => {
  it("devolve o link com o token no fragmento e validade de 24 h exatas", async () => {
    const person = await signedUpOperator();
    const made = await link(person.id);
    expect(made.url.startsWith(`${BASE_URL}/redefinir-senha#token=`)).toBe(
      true,
    );
    expect(made.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(made.expiresAt.getTime()).toBe(
      NOW.getTime() + PASSWORD_RESET_TTL_MS,
    );
  });

  it("o banco guarda só o hash do token, e o value é o userId", async () => {
    const person = await signedUpOperator();
    const made = await link(person.id);
    const rows = await db.select().from(verification);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.identifier).not.toContain(made.token);
    expect(rows[0]?.identifier).not.toContain("reset-password");
    expect(rows[0]?.value).toBe(person.id);
  });

  it("operador não gera (FORBIDDEN, com a mensagem) e nada é gravado", async () => {
    const person = await signedUpOperator();
    const result = await createPasswordResetLink(
      db,
      auth,
      { actor: operatorActor(), userId: person.id, baseURL: BASE_URL },
      NOW,
    );
    expect(result).toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: PASSWORD_RESET_FORBIDDEN_MESSAGE,
    });
    expect(await db.select().from(verification)).toHaveLength(0);
  });

  it("pessoa inexistente: NOT_FOUND e nada é gravado", async () => {
    const result = await createPasswordResetLink(
      db,
      auth,
      { actor: adminActor(), userId: "nao-existe", baseURL: BASE_URL },
      NOW,
    );
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await db.select().from(verification)).toHaveLength(0);
  });

  it("pessoa desativada: PERSON_INACTIVE com a mensagem exata e nada é gravado", async () => {
    const person = await signedUpOperator();
    await db
      .update(user)
      .set({ deactivatedAt: NOW })
      .where(eq(user.id, person.id));
    const result = await createPasswordResetLink(
      db,
      auth,
      { actor: adminActor(), userId: person.id, baseURL: BASE_URL },
      NOW,
    );
    expect(result).toEqual({
      ok: false,
      code: "PERSON_INACTIVE",
      message: PERSON_RESET_INACTIVE_MESSAGE,
    });
    expect(await db.select().from(verification)).toHaveLength(0);
  });

  it("baseURL sem protocolo lança (nunca grava link sem URL para mostrar)", async () => {
    const person = await signedUpOperator();
    await expect(
      createPasswordResetLink(
        db,
        auth,
        { actor: adminActor(), userId: person.id, baseURL: "localhost:3000" },
        NOW,
      ),
    ).rejects.toThrow(/BETTER_AUTH_URL/);
    expect(await db.select().from(verification)).toHaveLength(0);
  });

  it("link novo derruba o anterior e deixa as verificações de outro tipo", async () => {
    const person = await signedUpOperator();
    await db.insert(verification).values({
      id: "outra-verificacao",
      identifier: "passkey-challenge:xyz",
      value: JSON.stringify({ userId: person.id, challenge: "abc" }),
      expiresAt: new Date(Date.now() + 60_000),
    });
    await link(person.id, new Date());
    await link(person.id, new Date());
    const rows = await db.select().from(verification);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toContain("outra-verificacao");
  });
});

describe("redefinição de verdade (POST /api/auth/reset-password)", () => {
  it("troca a senha: a nova entra, a antiga não", async () => {
    const person = await signedUpOperator();
    const made = await link(person.id, new Date());
    expect((await resetWith(made.token)).status).toBe(200);
    expect((await signIn(person.email, NEW_PASSWORD)).status).toBe(200);
    expect((await signIn(person.email, OLD_PASSWORD)).status).toBe(401);
  });

  it("revoga as sessões antigas", async () => {
    const person = await signedUpOperator();
    expect((await signIn(person.email, OLD_PASSWORD)).status).toBe(200);
    expect(
      (await db.select().from(session).where(eq(session.userId, person.id)))
        .length,
    ).toBeGreaterThan(0);
    const made = await link(person.id, new Date());
    expect((await resetWith(made.token)).status).toBe(200);
    expect(
      await db.select().from(session).where(eq(session.userId, person.id)),
    ).toHaveLength(0);
  });

  it("uso único: a segunda vez é INVALID_TOKEN e a senha fica a da primeira", async () => {
    const person = await signedUpOperator();
    const made = await link(person.id, new Date());
    expect((await resetWith(made.token)).status).toBe(200);
    const again = await resetWith(made.token, "outra-senha-9999");
    expect(again.status).toBe(400);
    expect(await errorCode(again)).toBe("INVALID_TOKEN");
    expect((await signIn(person.email, NEW_PASSWORD)).status).toBe(200);
  });

  it("vencido há 1 min: INVALID_TOKEN e a senha não muda", async () => {
    const person = await signedUpOperator();
    const made = await link(
      person.id,
      new Date(Date.now() - PASSWORD_RESET_TTL_MS - 60_000),
    );
    const res = await resetWith(made.token);
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("INVALID_TOKEN");
    expect((await signIn(person.email, OLD_PASSWORD)).status).toBe(200);
  });

  it("faltando 1 min para vencer: ainda vale", async () => {
    const person = await signedUpOperator();
    const made = await link(
      person.id,
      new Date(Date.now() - PASSWORD_RESET_TTL_MS + 60_000),
    );
    expect((await resetWith(made.token)).status).toBe(200);
  });

  it("token que nunca existiu: INVALID_TOKEN", async () => {
    await signedUpOperator();
    const res = await resetWith("x".repeat(43));
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("INVALID_TOKEN");
  });

  it("senha de 7: PASSWORD_TOO_SHORT e o link continua valendo; de 8 passa", async () => {
    const person = await signedUpOperator();
    const made = await link(person.id, new Date());
    const short = await resetWith(made.token, "1234567");
    expect(short.status).toBe(400);
    expect(await errorCode(short)).toBe("PASSWORD_TOO_SHORT");
    expect((await resetWith(made.token, "12345678")).status).toBe(200);
  });

  it("senha de 129: PASSWORD_TOO_LONG e o link continua valendo", async () => {
    const person = await signedUpOperator();
    const made = await link(person.id, new Date());
    const long = await resetWith(made.token, "a".repeat(129));
    expect(long.status).toBe(400);
    expect(await errorCode(long)).toBe("PASSWORD_TOO_LONG");
    expect((await resetWith(made.token)).status).toBe(200);
  });

  it("link novo derruba o anterior", async () => {
    const person = await signedUpOperator();
    const first = await link(person.id, new Date());
    const second = await link(person.id, new Date());
    expect(await db.select().from(verification)).toHaveLength(1);
    const res = await resetWith(first.token);
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("INVALID_TOKEN");
    expect((await resetWith(second.token)).status).toBe(200);
  });

  it("o link de uma pessoa não mexe no link de outra", async () => {
    const a = await signedUpOperator("a@example.test");
    const b = await signedUpOperator("b@example.test");
    const linkA = await link(a.id, new Date());
    const linkB = await link(b.id, new Date());
    expect(await db.select().from(verification)).toHaveLength(2);
    expect((await resetWith(linkA.token)).status).toBe(200);
    expect((await resetWith(linkB.token)).status).toBe(200);
  });

  it("quem só tem passkey (sem conta credential) ganha uma conta de senha", async () => {
    const sector = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      email: "so-passkey@example.test",
    });
    expect(
      await db.select().from(account).where(eq(account.userId, person.id)),
    ).toHaveLength(0);
    const made = await link(person.id, new Date());
    expect((await resetWith(made.token)).status).toBe(200);
    const [created] = await db
      .select()
      .from(account)
      .where(eq(account.userId, person.id));
    expect(created).toMatchObject({
      providerId: "credential",
      accountId: person.id,
    });
    expect((await signIn("so-passkey@example.test", NEW_PASSWORD)).status).toBe(
      200,
    );
  });

  it("desativada DEPOIS de gerar: o link deixa de valer, a conta segue desativada e reativar não o ressuscita", async () => {
    const person = await signedUpOperator();
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const made = await link(person.id, new Date());

    expect(
      await setPersonActive(
        db,
        { actorId: admin.id, userId: person.id, active: false },
        new Date(),
      ),
    ).toEqual({ ok: true });
    expect(
      await db
        .select()
        .from(verification)
        .where(eq(verification.value, person.id)),
    ).toHaveLength(0);

    const res = await resetWith(made.token);
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("INVALID_TOKEN");
    const [row] = await db.select().from(user).where(eq(user.id, person.id));
    expect(row?.deactivatedAt).toBeInstanceOf(Date);
    const login = await signIn(person.email, OLD_PASSWORD);
    expect(login.status).toBe(403);
    expect(await errorCode(login)).toBe("ACCOUNT_DEACTIVATED");

    expect(
      await setPersonActive(
        db,
        { actorId: admin.id, userId: person.id, active: true },
        new Date(),
      ),
    ).toEqual({ ok: true });
    const afterReactivation = await resetWith(made.token);
    expect(afterReactivation.status).toBe(400);
    expect(await errorCode(afterReactivation)).toBe("INVALID_TOKEN");
    expect((await signIn(person.email, OLD_PASSWORD)).status).toBe(200);
  });

  it("defesa em profundidade: se o link sobrevive à desativação (UPDATE cru), a conta segue sem entrar", async () => {
    const person = await signedUpOperator();
    const made = await link(person.id, new Date());
    await db
      .update(user)
      .set({ deactivatedAt: new Date() })
      .where(eq(user.id, person.id));

    expect((await resetWith(made.token)).status).toBe(200);

    const login = await signIn(person.email, NEW_PASSWORD);
    expect(login.status).toBe(403);
    expect(await errorCode(login)).toBe("ACCOUNT_DEACTIVATED");
  });

  it("o pedido por e-mail continua desligado", async () => {
    const res = await http("/request-password-reset", {
      email: "ana@example.test",
    });
    expect(res.status).toBe(400);
    expect(await errorCode(res)).toBe("RESET_PASSWORD_DISABLED");
  });
});
```

Run: `bunx vitest run src/features/admin/passwordReset.test.ts`
Expected: FAIL, `Test Files  1 failed (1)`, `Tests  no tests`, com `Error: Cannot find module './passwordReset' imported from …/src/features/admin/passwordReset.test.ts`.

Crie `src/features/admin/passwordReset.ts`:

```ts
import "server-only";

import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { user, verification } from "@/db/schema/auth";
import type { Db } from "@/db/types";
import type { Authz } from "@/features/authz/authz";
import { isHttpUrl } from "@/features/invites/inviteUrl";
import { type Auth, RESET_PASSWORD_PREFIX } from "@/lib/auth/createAuth";
import {
  notFoundMessage,
  PASSWORD_RESET_FORBIDDEN_MESSAGE,
  PERSON_RESET_INACTIVE_MESSAGE,
} from "./messages";
import { type AdminResult, fail, ok } from "./result";

// Quanto vale o link de redefinição. 24 h: o link vai por WhatsApp e a pessoa
// pode estar em outro turno; é uso único, o link novo derruba o anterior,
// desativar a pessoa derruba o link e redefinir revoga todas as sessões. Mais
// longo que isso é só janela de risco (8 h é a alternativa: uma constante só).
export const PASSWORD_RESET_TTL_MS = 24 * 60 * 60 * 1000;

// O token vai no fragmento (#): fragmento nunca chega ao servidor, então não
// aparece em log da Vercel nem no Referer.
export function buildPasswordResetUrl(baseURL: string, token: string): string {
  if (!isHttpUrl(baseURL)) {
    throw new Error(`URL base inválida para a redefinição: "${baseURL}".`);
  }
  return `${new URL(baseURL).origin}/redefinir-senha#token=${token}`;
}

// Gera o link de redefinição de senha de uma pessoa, no formato que
// POST /api/auth/reset-password espera. Só admin (defesa em profundidade: a
// Server Action já fez requireAdmin()). Nunca loga nem devolve o token fora da
// URL.
//
// Exceção à regra de db.transaction(): a criação passa pelo adapter do Better
// Auth, que não entra numa transação nossa. Por isso a ordem é a que falha
// fechado: apaga os links antigos ANTES de criar o novo. Se a criação falhar,
// a pessoa fica sem link e o admin gera outro; nunca ficam dois links válidos.
export async function createPasswordResetLink(
  db: Db,
  auth: Pick<Auth, "$context">,
  input: { actor: Authz; userId: string; baseURL: string },
  now: Date,
): Promise<AdminResult<{ url: string; expiresAt: Date }>> {
  if (input.actor.role !== "admin") {
    return fail("FORBIDDEN", PASSWORD_RESET_FORBIDDEN_MESSAGE);
  }
  if (!isHttpUrl(input.baseURL)) {
    throw new Error(
      `BETTER_AUTH_URL não é uma URL absoluta: "${input.baseURL}".`,
    );
  }

  const [person] = await db
    .select({ id: user.id, deactivatedAt: user.deactivatedAt })
    .from(user)
    .where(eq(user.id, input.userId))
    .limit(1);
  if (!person) return fail("NOT_FOUND", notFoundMessage("pessoa"));
  if (person.deactivatedAt) {
    return fail("PERSON_INACTIVE", PERSON_RESET_INACTIVE_MESSAGE);
  }

  // Link novo derruba o anterior (e os vencidos da mesma pessoa): só o último
  // vale. `value = userId` só existe em linhas de redefinição; as outras
  // verificações (desafio de passkey, estado de OAuth) guardam JSON.
  await db.delete(verification).where(eq(verification.value, person.id));

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_TTL_MS);
  const { internalAdapter } = await auth.$context;
  await internalAdapter.createVerificationValue({
    identifier: `${RESET_PASSWORD_PREFIX}${token}`,
    value: person.id,
    expiresAt,
  });

  return ok({ url: buildPasswordResetUrl(input.baseURL, token), expiresAt });
}
```

Run: `bunx vitest run src/features/admin/passwordReset.test.ts`
Expected: PASS, `Tests  23 passed (23)` (2 de `buildPasswordResetUrl`, 7 de `createPasswordResetLink`, 14 da redefinição de verdade).

- [ ] **Step B5: A Server Action (teste primeiro) e o inventário**

Crie `src/app/(app)/admin/equipe/passwordResetAction.test.ts` (molde dos testes de action da Equipe: `vi.hoisted` com `client: null as PGlite | null`, `@/lib/auth/session`, `next/cache`, `@/db` e `@/lib/auth` com o `createTestAuth`):

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { user, verification } from "@/db/schema/auth";
import { auth } from "@/lib/auth";
import { authzOf } from "../../../../../test/authz";
import { resetDb } from "../../../../../test/db";
import { insertSector, insertUser } from "../../../../../test/fixtures";
import { createPasswordResetLinkAction } from "./actions";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  client: null as PGlite | null,
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../../../test/db");
  const created = await createTestDb();
  mocks.client = created.client;
  return { db: created.db };
});
vi.mock("@/lib/auth", async () => {
  const { db: testDb } = await import("@/db");
  const { createTestAuth, TEST_AUTH_ENV } = await import(
    "../../../../../test/auth"
  );
  return { authEnv: TEST_AUTH_ENV, auth: createTestAuth(testDb) };
});

const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";

beforeEach(async () => {
  if (!mocks.client) throw new Error("PGlite nao iniciou");
  await resetDb(mocks.client);
  mocks.requireAdmin.mockReset();
  mocks.revalidatePath.mockReset();
});

async function setup() {
  const admin = await insertUser(db, { role: "admin", sectorId: null });
  const sector = await insertSector(db);
  const person = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
  });
  mocks.requireAdmin.mockResolvedValue(
    authzOf({ role: "admin", userId: admin.id }),
  );
  return { person };
}

describe("createPasswordResetLinkAction", () => {
  it("operador: requireAdmin lanca notFound e nada e gravado", async () => {
    const { person } = await setup();
    mocks.requireAdmin.mockRejectedValue(new Error(NOT_FOUND));

    await expect(
      createPasswordResetLinkAction({ userId: person.id }),
    ).rejects.toThrow(NOT_FOUND);
    expect(await db.select().from(verification)).toHaveLength(0);
  });

  it("admin: devolve o link com a URL do ambiente e o token redefine de verdade", async () => {
    const { person } = await setup();

    const result = await createPasswordResetLinkAction({ userId: person.id });

    if (!result.ok) throw new Error(result.message);
    expect(
      result.url.startsWith("http://localhost:3000/redefinir-senha#token="),
    ).toBe(true);
    const token = new URL(result.url).hash.replace("#token=", "");
    const res = await auth.handler(
      new Request("http://localhost:3000/api/auth/reset-password", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
        },
        body: JSON.stringify({ token, newPassword: "senha-nova-4567" }),
      }),
    );
    expect(res.status).toBe(200);
  });

  it("pessoa desativada: PERSON_INACTIVE", async () => {
    const { person } = await setup();
    await db
      .update(user)
      .set({ deactivatedAt: new Date() })
      .where(eq(user.id, person.id));
    const result = await createPasswordResetLinkAction({ userId: person.id });
    expect(result).toMatchObject({ ok: false, code: "PERSON_INACTIVE" });
    expect(await db.select().from(verification)).toHaveLength(0);
  });

  it("entrada invalida: INVALID_INPUT, sem tocar no banco", async () => {
    await setup();
    const result = await createPasswordResetLinkAction({});
    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(await db.select().from(verification)).toHaveLength(0);
  });

  it("pessoa inexistente: NOT_FOUND", async () => {
    await setup();
    const result = await createPasswordResetLinkAction({ userId: "ninguem" });
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});
```

Run: `bunx vitest run "src/app/(app)/admin/equipe/passwordResetAction.test.ts"`
Expected: FAIL, `Tests  5 failed (5)` (`createPasswordResetLinkAction` ainda não existe em `actions.ts`).

Em `src/app/(app)/admin/equipe/actions.ts`:

Troque:

```ts
"use server";

import { setPersonActive, updatePerson } from "@/features/admin/people";
import type { AdminResult } from "@/features/admin/result";
import { runAdminAction } from "@/features/admin/runAdminAction";
import {
  cancelInviteSchema,
  createInviteSchema,
  setPersonActiveSchema,
  updatePersonSchema,
} from "@/features/admin/schemas";
```

por:

```ts
"use server";

import { createPasswordResetLink } from "@/features/admin/passwordReset";
import { setPersonActive, updatePerson } from "@/features/admin/people";
import type { AdminResult } from "@/features/admin/result";
import { runAdminAction } from "@/features/admin/runAdminAction";
import {
  cancelInviteSchema,
  createInviteSchema,
  createPasswordResetLinkSchema,
  setPersonActiveSchema,
  updatePersonSchema,
} from "@/features/admin/schemas";
```

Troque:

```ts
  cancelPendingInvite,
  createTeamInvite,
} from "@/features/admin/teamInvites";
import { authEnv } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/session";

// `input: unknown` é o objeto do formulário (UpdatePersonInput); o schema Zod
```

por:

```ts
  cancelPendingInvite,
  createTeamInvite,
} from "@/features/admin/teamInvites";
import { auth, authEnv } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/session";

// `input: unknown` é o objeto do formulário (UpdatePersonInput); o schema Zod
```

Troque:

```ts
      cancelPendingInvite(db, { id: data.id }, now),
  });
}
```

por:

```ts
      cancelPendingInvite(db, { id: data.id }, now),
  });
}

// Como o convite: o link nasce aqui e volta uma vez só (o banco guarda só o hash
// do token). Quem gera é sempre admin; o domínio confere de novo.
export async function createPasswordResetLinkAction(
  input: unknown,
): Promise<AdminResult<{ url: string; expiresAt: Date }>> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: createPasswordResetLinkSchema,
    input,
    run: ({ db, now, actor: current, input: data }) =>
      createPasswordResetLink(
        db,
        auth,
        { actor: current, userId: data.userId, baseURL: authEnv.baseURL },
        now,
      ),
  });
}
```

Run: `bunx vitest run "src/app/(app)/admin"`
Expected: FAIL, só o `actionsInventory.test.ts`: `equipe/actions.ts exporta só as actions do contrato` (`expected [ 'cancelInviteAction', …(4) ] to deeply equal [ 'cancelInviteAction', …(3) ]`): o inventário é a trava que obriga o nome novo a entrar de propósito. Em `src/app/(app)/admin/actionsInventory.test.ts`:

Troque:

```ts
  "equipe/actions.ts": [
    "cancelInviteAction",
    "createInviteAction",
    "setPersonActiveAction",
    "updatePersonAction",
  ],
```

por:

```ts
  "equipe/actions.ts": [
    "cancelInviteAction",
    "createInviteAction",
    "createPasswordResetLinkAction",
    "setPersonActiveAction",
    "updatePersonAction",
  ],
```

Run: `bunx vitest run "src/app/(app)/admin"`
Expected: PASS, `Test Files  12 passed (12)` e `Tests  92 passed (92)` (inclusive `actionsAuth.test.ts`, que confere o `requireAdmin()` na primeira instrução da action nova).

- [ ] **Step B6: `PasswordResetLinkButton`, em `PersonRowActions` e na linha própria do `TeamAdmin` (testes primeiro)**

Crie `src/components/admin/team/PasswordResetLinkButton.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fail } from "@/features/admin/result";
import { PasswordResetLinkButton } from "./PasswordResetLinkButton";

const mocks = vi.hoisted(() => ({
  createPasswordResetLinkAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  writeText: vi.fn(),
  share: vi.fn(),
}));

vi.mock("@/app/(app)/admin/equipe/actions", () => ({
  createPasswordResetLinkAction: mocks.createPasswordResetLinkAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const URL_OK = "https://closery.example.test/redefinir-senha#token=abc";
// 12:00 UTC = 09:00 em São Paulo (UTC-3, sem horário de verão em 2026).
const EXPIRES_AT = new Date("2026-11-26T12:00:00.000Z");
const GENERATE = {
  name: "Gerar link de nova senha para Bruno Fictício",
};

function defineNavigator(name: "clipboard" | "share", value: unknown) {
  Object.defineProperty(navigator, name, { configurable: true, value });
}

function renderButton() {
  const user = userEvent.setup();
  // O userEvent.setup() instala o próprio clipboard: o espião entra depois.
  defineNavigator("clipboard", { writeText: mocks.writeText });
  render(<PasswordResetLinkButton personId="p1" personName="Bruno Fictício" />);
  return { user };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createPasswordResetLinkAction.mockResolvedValue({
    ok: true,
    url: URL_OK,
    expiresAt: EXPIRES_AT,
  });
  mocks.writeText.mockResolvedValue(undefined);
  mocks.share.mockResolvedValue(undefined);
  defineNavigator("clipboard", { writeText: mocks.writeText });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
  Reflect.deleteProperty(navigator, "share");
});

describe("PasswordResetLinkButton", () => {
  it("antes do clique não chama a action nem mostra o diálogo", () => {
    renderButton();

    expect(screen.getByRole("button", GENERATE)).toHaveTextContent(
      "Nova senha",
    );
    expect(mocks.createPasswordResetLinkAction).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("um clique gera o link e mostra o link, o nome e a validade", async () => {
    const { user } = renderButton();

    await user.click(screen.getByRole("button", GENERATE));

    expect(mocks.createPasswordResetLinkAction).toHaveBeenCalledTimes(1);
    expect(mocks.createPasswordResetLinkAction).toHaveBeenCalledWith({
      userId: "p1",
    });
    const dialog = await screen.findByRole("dialog", {
      name: "Link de nova senha",
    });
    expect(dialog).toHaveTextContent("Bruno Fictício");
    const field = screen.getByLabelText("Link para copiar");
    expect(field).toHaveValue(URL_OK);
    expect(field).toHaveAttribute("readonly");
    expect(
      screen.getByText(
        "Válido até 26/11/2026, 09:00, uma vez só. Quem abrir o link troca a senha e todos os acessos abertos dessa pessoa são encerrados. O link aparece só agora: se perder, gere outro (o anterior deixa de valer).",
      ),
    ).toBeInTheDocument();
  });

  it("falha do servidor vira toast e nenhum link aparece", async () => {
    mocks.createPasswordResetLinkAction.mockResolvedValue(
      fail(
        "PERSON_INACTIVE",
        "Esta conta está desativada. Reative antes de gerar um link de redefinição.",
      ),
    );
    const { user } = renderButton();

    await user.click(screen.getByRole("button", GENERATE));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Esta conta está desativada. Reative antes de gerar um link de redefinição.",
      ),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Link para copiar")).toBeNull();
  });

  it("exceção da action (rede) vira o toast genérico", async () => {
    mocks.createPasswordResetLinkAction.mockRejectedValue(new Error("rede"));
    const { user } = renderButton();

    await user.click(screen.getByRole("button", GENERATE));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("o botão fica desabilitado enquanto a action roda", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.createPasswordResetLinkAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { user } = renderButton();

    await user.click(screen.getByRole("button", GENERATE));

    expect(screen.getByRole("button", GENERATE)).toBeDisabled();
    finish({ ok: true, url: URL_OK, expiresAt: EXPIRES_AT });
    await screen.findByRole("dialog");
    // Com o diálogo aberto o resto da página fica aria-hidden.
    expect(
      screen.getByRole("button", { ...GENERATE, hidden: true }),
    ).toBeEnabled();
  });

  it("Copiar link copia o link e avisa", async () => {
    const { user } = renderButton();
    await user.click(screen.getByRole("button", GENERATE));
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: "Copiar link" }));

    expect(mocks.writeText).toHaveBeenCalledWith(URL_OK);
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Link copiado.");
  });

  it("sem navigator.share não mostra Compartilhar", async () => {
    const { user } = renderButton();
    await user.click(screen.getByRole("button", GENERATE));
    await screen.findByRole("dialog");

    expect(
      screen.queryByRole("button", { name: "Compartilhar" }),
    ).not.toBeInTheDocument();
  });

  it("com navigator.share, Compartilhar envia o título e o texto da nova senha", async () => {
    defineNavigator("share", mocks.share);
    const { user } = renderButton();
    await user.click(screen.getByRole("button", GENERATE));

    await user.click(
      await screen.findByRole("button", { name: "Compartilhar" }),
    );

    expect(mocks.share).toHaveBeenCalledWith({
      title: "Nova senha do Closery",
      text: "Abra este link para criar uma senha nova no Closery.",
      url: URL_OK,
    });
  });

  it("fechar o diálogo descarta o link: gerar de novo chama a action outra vez", async () => {
    const { user } = renderButton();
    await user.click(screen.getByRole("button", GENERATE));
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: "Fechar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.queryByLabelText("Link para copiar")).toBeNull();

    await user.click(screen.getByRole("button", GENERATE));
    await screen.findByRole("dialog");
    expect(mocks.createPasswordResetLinkAction).toHaveBeenCalledTimes(2);
  });
});
```

Nos dois testes existentes (cada um ganha o mock da action nova e os casos novos):

Troque:

```tsx
const mocks = vi.hoisted(() => ({
  setPersonActiveAction: vi.fn(),
  updatePersonAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
```

por:

```tsx
const mocks = vi.hoisted(() => ({
  setPersonActiveAction: vi.fn(),
  updatePersonAction: vi.fn(),
  createPasswordResetLinkAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
```

Troque:

```tsx
vi.mock("@/app/(app)/admin/equipe/actions", () => ({
  setPersonActiveAction: mocks.setPersonActiveAction,
  updatePersonAction: mocks.updatePersonAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
```

por:

```tsx
vi.mock("@/app/(app)/admin/equipe/actions", () => ({
  setPersonActiveAction: mocks.setPersonActiveAction,
  updatePersonAction: mocks.updatePersonAction,
  createPasswordResetLinkAction: mocks.createPasswordResetLinkAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
```

Troque:

```tsx
    ).not.toBeInTheDocument();
  });

  it("pessoa inativa: Editar e Reativar, sem Desativar", () => {
    setup(person({ active: false }));
```

por:

```tsx
    ).not.toBeInTheDocument();
  });

  it("pessoa ativa tem Nova senha entre Editar e Desativar; inativa não tem", () => {
    const { unmount } = render(
      <PersonRowActions person={person()} sectors={[SECTOR]} />,
    );
    expect(
      screen
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual([
      "Editar Bruno Fictício",
      "Gerar link de nova senha para Bruno Fictício",
      "Desativar Bruno Fictício",
    ]);
    unmount();

    render(
      <PersonRowActions
        person={person({ active: false })}
        sectors={[SECTOR]}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Gerar link de nova senha/ }),
    ).not.toBeInTheDocument();
  });

  it("Nova senha chama a action com o id da pessoa e mostra o link", async () => {
    mocks.createPasswordResetLinkAction.mockResolvedValue({
      ok: true,
      url: "https://closery.example.test/redefinir-senha#token=abc",
      expiresAt: new Date("2026-11-26T12:00:00.000Z"),
    });
    const { user } = setup();

    await user.click(
      screen.getByRole("button", {
        name: "Gerar link de nova senha para Bruno Fictício",
      }),
    );

    expect(mocks.createPasswordResetLinkAction).toHaveBeenCalledWith({
      userId: "pessoa-1",
    });
    expect(await screen.findByLabelText("Link para copiar")).toHaveValue(
      "https://closery.example.test/redefinir-senha#token=abc",
    );
  });

  it("pessoa inativa: Editar e Reativar, sem Desativar", () => {
    setup(person({ active: false }));
```

Troque:

```tsx
vi.mock("@/app/(app)/admin/equipe/actions", () => ({
  updatePersonAction: vi.fn(),
  setPersonActiveAction: vi.fn(),
  createInviteAction: vi.fn(),
  cancelInviteAction: vi.fn(),
}));
```

por:

```tsx
vi.mock("@/app/(app)/admin/equipe/actions", () => ({
  updatePersonAction: vi.fn(),
  setPersonActiveAction: vi.fn(),
  createPasswordResetLinkAction: vi.fn(),
  createInviteAction: vi.fn(),
  cancelInviteAction: vi.fn(),
}));
```

Troque:

```tsx
      expect(within(row).queryByText("Inativo")).not.toBeInTheDocument();
    });

    it("a própria conta mostra Você e o texto de ajuda, sem nenhum botão", async () => {
      mocks.listPeople.mockResolvedValue(
        page([
          person({
```

por:

```tsx
      expect(within(row).queryByText("Inativo")).not.toBeInTheDocument();
    });

    it("a própria conta mostra Você, o texto de ajuda e só o botão de nova senha", async () => {
      mocks.listPeople.mockResolvedValue(
        page([
          person({
```

Troque:

```tsx
          "Peça a outro administrador para mudar a sua conta.",
        ),
      ).toBeInTheDocument();
      expect(within(row).queryByRole("button")).not.toBeInTheDocument();
    });

    it("pessoa inativa mostra o selo e Reativar", async () => {
```

por:

```tsx
          "Peça a outro administrador para mudar a sua conta.",
        ),
      ).toBeInTheDocument();
      expect(
        within(row)
          .getAllByRole("button")
          .map((button) => button.getAttribute("aria-label")),
      ).toEqual(["Gerar link de nova senha para Carla Admin"]);
    });

    it("a linha de outra pessoa ativa ganha Nova senha ao lado de Editar e Desativar", async () => {
      await renderTeam();

      const row = peopleSection().getByRole("listitem");
      expect(
        within(row).getByRole("button", {
          name: "Gerar link de nova senha para Bruno Fictício",
        }),
      ).toBeInTheDocument();
    });

    it("pessoa inativa mostra o selo e Reativar", async () => {
```

Run: `bunx vitest run src/components/admin/team/PasswordResetLinkButton.test.tsx src/components/admin/team/PersonRowActions.test.tsx src/components/admin/team/TeamAdmin.test.tsx`
Expected: FAIL, `Test Files  3 failed (3)` e `Tests  4 failed | 24 passed (28)`: o do botão por `Failed to resolve import "./PasswordResetLinkButton" from "src/components/admin/team/PasswordResetLinkButton.test.tsx". Does the file exist?` (suíte sem testes); em `PersonRowActions.test.tsx` os dois casos novos (`expected [ 'Editar Bruno Fictício', …(1) ] to deeply equal [ …(2) ]` e `Unable to find an accessible element with the role "button" and name "Gerar link de nova senha para Bruno Fictício"`); em `TeamAdmin.test.tsx` os dois casos novos (`Unable to find an accessible element with the role "button"`).

Crie `src/components/admin/team/PasswordResetLinkButton.tsx` (cliente; o corpo do diálogo é um componente à parte porque o `useShareLink` não pode ser chamado condicionalmente):

```tsx
"use client";

import { useState } from "react";

import { createPasswordResetLinkAction } from "@/app/(app)/admin/equipe/actions";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatDateTimeBR } from "@/lib/dateTime";
import { useShareLink } from "./useShareLink";

type ResetLink = { url: string; expiresAt: Date };

// Um clique gera o link e já mostra: o admin só precisa copiar ou compartilhar
// e mandar. O link aparece uma vez (o banco guarda só o hash); fechar o diálogo
// o descarta e gerar outro invalida o anterior.
export function PasswordResetLinkButton({
  personId,
  personName,
}: {
  personId: string;
  personName: string;
}) {
  const { pending, run } = useAdminAction();
  const [link, setLink] = useState<ResetLink | null>(null);

  async function generate() {
    const result = await run(() =>
      createPasswordResetLinkAction({ userId: personId }),
    );
    if (result.ok) setLink({ url: result.url, expiresAt: result.expiresAt });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={pending}
        aria-label={`Gerar link de nova senha para ${personName}`}
        onClick={generate}
      >
        Nova senha
      </Button>
      <Dialog
        open={link !== null}
        onOpenChange={(open) => {
          if (!open) setLink(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link de nova senha</DialogTitle>
            <DialogDescription>{personName}</DialogDescription>
          </DialogHeader>
          {link && <ResetLinkBody url={link.url} expiresAt={link.expiresAt} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ResetLinkBody({ url, expiresAt }: ResetLink) {
  const { canShare, copy, share } = useShareLink({
    url,
    shareTitle: "Nova senha do Closery",
    shareText: "Abra este link para criar uma senha nova no Closery.",
  });

  return (
    <div className="flex flex-col gap-4">
      <Input
        readOnly
        value={url}
        aria-label="Link para copiar"
        onFocus={(event) => event.currentTarget.select()}
      />
      <p className="text-sm text-muted-foreground">
        Válido até {formatDateTimeBR(expiresAt)}, uma vez só. Quem abrir o link
        troca a senha e todos os acessos abertos dessa pessoa são encerrados. O
        link aparece só agora: se perder, gere outro (o anterior deixa de
        valer).
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={copy}>
          Copiar link
        </Button>
        {canShare && (
          <Button type="button" variant="outline" onClick={share}>
            Compartilhar
          </Button>
        )}
      </div>
    </div>
  );
}
```

Ligue o botão nas duas linhas: em `PersonRowActions` só para pessoa **ativa**, entre "Editar" e "Desativar"; no `TeamAdmin` a linha própria troca `undefined` por ele (a nota "Peça a outro administrador…" continua).

Troque:

```tsx
import { Button } from "@/components/ui/button";
import type { PersonRow } from "@/features/admin/people";
import type { SectorChoice } from "@/features/admin/sectors";
import { PersonForm } from "./PersonForm";

export function PersonRowActions({
```

por:

```tsx
import { Button } from "@/components/ui/button";
import type { PersonRow } from "@/features/admin/people";
import type { SectorChoice } from "@/features/admin/sectors";
import { PasswordResetLinkButton } from "./PasswordResetLinkButton";
import { PersonForm } from "./PersonForm";

export function PersonRowActions({
```

Troque:

```tsx
        )}
      </EditDialog>

      {person.active ? (
        <ConfirmDialog
          trigger={
```

por:

```tsx
        )}
      </EditDialog>

      {person.active && (
        <PasswordResetLinkButton
          personId={person.id}
          personName={person.name}
        />
      )}

      {person.active ? (
        <ConfirmDialog
          trigger={
```

Troque:

```tsx
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTimeBR } from "@/lib/dateTime";
import { InviteForm } from "./InviteForm";
import { PendingInviteActions } from "./PendingInviteActions";
import { PersonRowActions } from "./PersonRowActions";
import { ROLE_LABELS } from "./roleOptions";
```

por:

```tsx
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTimeBR } from "@/lib/dateTime";
import { InviteForm } from "./InviteForm";
import { PasswordResetLinkButton } from "./PasswordResetLinkButton";
import { PendingInviteActions } from "./PendingInviteActions";
import { PersonRowActions } from "./PersonRowActions";
import { ROLE_LABELS } from "./roleOptions";
```

Troque:

```tsx
                    ) : undefined
                  }
                  actions={
                    isSelf ? undefined : (
                      <PersonRowActions person={person} sectors={sectors} />
                    )
                  }
```

por:

```tsx
                    ) : undefined
                  }
                  actions={
                    isSelf ? (
                      <PasswordResetLinkButton
                        personId={person.id}
                        personName={person.name}
                      />
                    ) : (
                      <PersonRowActions person={person} sectors={sectors} />
                    )
                  }
```

Run: `bunx biome check --write src/components/admin` e depois `bunx vitest run src/components/admin/team`
Expected: PASS, `Test Files  8 passed (8)` e `Tests  95 passed (95)`.

- [ ] **Step B7: `ResetPasswordForm` e a página `/redefinir-senha` (testes primeiro)**

Crie `src/components/auth/ResetPasswordForm.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ResetPasswordForm, takeTokenFromLocation } from "./ResetPasswordForm";

const mocks = vi.hoisted(() => ({ resetPassword: vi.fn() }));

vi.mock("@/lib/auth/client", () => ({
  authClient: { resetPassword: mocks.resetPassword },
}));

const TOKEN = "AbCdEf0123456789_-AbCdEf0123456789_-AbCdEf0123";
const LOCATION = { pathname: "/redefinir-senha", search: "" };

function setHash(hash: string) {
  window.history.replaceState(null, "", `/redefinir-senha${hash}`);
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.resetPassword.mockResolvedValue({
    data: { status: true },
    error: null,
  });
});

afterEach(() => {
  setHash("");
});

describe("takeTokenFromLocation", () => {
  it("lê o token do fragmento e apaga o fragmento, mantendo o caminho e a query", () => {
    const replaceState = vi.fn();
    const token = takeTokenFromLocation(
      { hash: `#token=${TOKEN}`, pathname: "/redefinir-senha", search: "?a=1" },
      { replaceState },
    );
    expect(token).toBe(TOKEN);
    expect(replaceState).toHaveBeenCalledWith(null, "", "/redefinir-senha?a=1");
  });

  it("aceita os limites: 16 e 256 caracteres", () => {
    for (const size of [16, 256]) {
      const replaceState = vi.fn();
      const token = "a".repeat(size);
      expect(
        takeTokenFromLocation(
          { ...LOCATION, hash: `#token=${token}` },
          { replaceState },
        ),
      ).toBe(token);
    }
  });

  it.each([
    ["vazio", ""],
    ["só o #", "#"],
    ["sem valor", "#token="],
    ["15 caracteres", `#token=${"a".repeat(15)}`],
    ["257 caracteres", `#token=${"a".repeat(257)}`],
    ["outro parâmetro", `#outro=${TOKEN}`],
    ["espaço", "#token=a b"],
    ["parâmetro a mais", `#token=${TOKEN}&x=1`],
    ["unicode", `#token=${"é".repeat(20)}`],
  ])("fragmento %s não é token: devolve null sem mexer na barra", (_name, hash) => {
    const replaceState = vi.fn();
    expect(
      takeTokenFromLocation({ ...LOCATION, hash }, { replaceState }),
    ).toBeNull();
    expect(replaceState).not.toHaveBeenCalled();
  });
});

describe("ResetPasswordForm", () => {
  it("lendo (primeira renderização, no servidor): cartão vazio e ocupado, sem formulário", () => {
    const html = renderToString(<ResetPasswordForm />);

    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain("Senha nova");
    expect(html).not.toContain("Link incompleto");
  });

  it("sem token: mostra link incompleto, sem formulário, e o botão leva à entrada", async () => {
    setHash("");
    render(<ResetPasswordForm />);

    expect(
      await screen.findByRole("heading", { name: "Link incompleto" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Abra o link de redefinição completo, do jeito que o administrador enviou. Se ele não funcionar, peça outro.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Senha nova")).toBeNull();
    expect(
      screen.getByRole("link", { name: "Ir para a entrada" }),
    ).toHaveAttribute("href", "/entrar");
  });

  it("com token: tira o fragmento da barra de endereço e envia a senha nova", async () => {
    setHash(`#token=${TOKEN}`);
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    expect(
      await screen.findByRole("heading", { name: "Criar uma senha nova" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Use pelo menos 8 caracteres."),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe("");
    await user.type(screen.getByLabelText("Senha nova"), "senha-nova-4567");
    await user.click(screen.getByRole("button", { name: "Trocar a senha" }));

    expect(mocks.resetPassword).toHaveBeenCalledTimes(1);
    expect(mocks.resetPassword).toHaveBeenCalledWith({
      newPassword: "senha-nova-4567",
      token: TOKEN,
    });
    expect(
      await screen.findByRole("heading", { name: "Senha alterada" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Por segurança, todos os acessos abertos foram encerrados. Entre com a senha nova.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute(
      "href",
      "/entrar",
    );
  });

  it("o campo é de senha nova, obrigatório, de 8 a 128 caracteres", async () => {
    setHash(`#token=${TOKEN}`);
    render(<ResetPasswordForm />);

    const field = await screen.findByLabelText("Senha nova");
    expect(field).toHaveAttribute("type", "password");
    expect(field).toHaveAttribute("autocomplete", "new-password");
    expect(field).toBeRequired();
    expect(field).toHaveAttribute("minlength", "8");
    expect(field).toHaveAttribute("maxlength", "128");
  });

  it("em StrictMode o token lido na primeira passada não se perde", async () => {
    setHash(`#token=${TOKEN}`);
    const user = userEvent.setup();
    render(
      <StrictMode>
        <ResetPasswordForm />
      </StrictMode>,
    );

    await user.type(
      await screen.findByLabelText("Senha nova"),
      "senha-nova-4567",
    );
    await user.click(screen.getByRole("button", { name: "Trocar a senha" }));

    expect(mocks.resetPassword).toHaveBeenCalledWith({
      newPassword: "senha-nova-4567",
      token: TOKEN,
    });
  });

  it("token vencido ou usado: mensagem em português e o formulário continua", async () => {
    setHash(`#token=${TOKEN}`);
    mocks.resetPassword.mockResolvedValue({
      data: null,
      error: { code: "INVALID_TOKEN", status: 400 },
    });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(
      await screen.findByLabelText("Senha nova"),
      "senha-nova-4567",
    );
    await user.click(screen.getByRole("button", { name: "Trocar a senha" }));

    expect(
      await screen.findByText(
        "Este link de redefinição venceu ou já foi usado. Peça outro ao administrador.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Senha nova")).toBeEnabled();
    expect(screen.getByLabelText("Senha nova")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("senha curta devolvida pelo servidor: mensagem do código", async () => {
    setHash(`#token=${TOKEN}`);
    mocks.resetPassword.mockResolvedValue({
      data: null,
      error: { code: "PASSWORD_TOO_SHORT", status: 400 },
    });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(await screen.findByLabelText("Senha nova"), "12345678");
    await user.click(screen.getByRole("button", { name: "Trocar a senha" }));

    expect(
      await screen.findByText("A senha precisa ter pelo menos 8 caracteres."),
    ).toBeInTheDocument();
  });

  it("429: mensagem de muitas tentativas", async () => {
    setHash(`#token=${TOKEN}`);
    mocks.resetPassword.mockResolvedValue({
      data: null,
      error: { status: 429 },
    });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(
      await screen.findByLabelText("Senha nova"),
      "senha-nova-4567",
    );
    await user.click(screen.getByRole("button", { name: "Trocar a senha" }));

    expect(
      await screen.findByText(
        "Muitas tentativas nesta rede. Espere um minuto e tente de novo.",
      ),
    ).toBeInTheDocument();
  });

  it("falha de rede: mensagem genérica e botão liberado", async () => {
    setHash(`#token=${TOKEN}`);
    mocks.resetPassword.mockRejectedValue(new Error("rede"));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await user.type(
      await screen.findByLabelText("Senha nova"),
      "senha-nova-4567",
    );
    await user.click(screen.getByRole("button", { name: "Trocar a senha" }));

    expect(
      await screen.findByText("Não foi possível concluir. Tente de novo."),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Trocar a senha" }),
      ).toBeEnabled(),
    );
  });
});
```

Crie `src/app/(auth)/redefinir-senha/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Page, { metadata } from "./page";

vi.mock("@/lib/auth/client", () => ({
  authClient: { resetPassword: vi.fn() },
}));

describe("/redefinir-senha", () => {
  it("o título da aba é Redefinir senha", () => {
    expect(metadata.title).toBe("Redefinir senha");
  });

  it("renderiza o formulário de redefinição (sem fragmento: link incompleto)", async () => {
    render(<Page />);

    expect(
      await screen.findByRole("heading", { name: "Link incompleto" }),
    ).toBeInTheDocument();
  });
});
```

Run: `bunx vitest run src/components/auth/ResetPasswordForm.test.tsx "src/app/(auth)/redefinir-senha"`
Expected: FAIL, `Test Files  2 failed (2)`, `Tests  no tests`, com `Failed to resolve import "./ResetPasswordForm" from "src/components/auth/ResetPasswordForm.test.tsx". Does the file exist?` e `Failed to resolve import "./page" from "src/app/(auth)/redefinir-senha/page.test.tsx". Does the file exist?`.

Crie `src/components/auth/ResetPasswordForm.tsx`. O token vem do **fragmento** (`#token=`), que o navegador nunca envia ao servidor; é lido uma vez e o fragmento é apagado da barra:

```tsx
"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useId, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
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
import { authErrorMessage } from "@/lib/auth/errors";
import { errorCodeOf } from "./authFormError";

const TOKEN_FRAGMENT = /^#token=([A-Za-z0-9_-]{16,256})$/;

// O token vem no fragmento (#token=...): o navegador nunca o envia ao servidor,
// então ele não entra em log da Vercel nem no Referer. Lido uma vez e apagado
// da barra de endereço (history.replaceState) para não ficar no histórico.
export function takeTokenFromLocation(
  location: Pick<Location, "hash" | "pathname" | "search">,
  history: Pick<History, "replaceState">,
): string | null {
  const match = TOKEN_FRAGMENT.exec(location.hash);
  if (!match?.[1]) return null;
  history.replaceState(null, "", `${location.pathname}${location.search}`);
  return match[1];
}

type Phase = "reading" | "ready" | "missing" | "done";

export function ResetPasswordForm() {
  const uid = useId();
  const [phase, setPhase] = useState<Phase>("reading");
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Só no cliente e só depois de montar: o fragmento não existe no servidor.
  // Em StrictMode o efeito roda duas vezes; a segunda não acha mais o
  // fragmento (já apagado) e por isso nunca zera o token lido na primeira.
  useEffect(() => {
    const found = takeTokenFromLocation(window.location, window.history);
    if (found) {
      setToken(found);
      setPhase("ready");
    } else {
      setPhase((current) => (current === "reading" ? "missing" : current));
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !token) return;
    setPending(true);
    setError(null);
    try {
      const { error: resetError } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (resetError) {
        setError(authErrorMessage(errorCodeOf(resetError)));
        setPending(false);
        return;
      }
      setPassword("");
      setPhase("done");
    } catch {
      setError(authErrorMessage(null));
      setPending(false);
    }
  }

  if (phase === "reading") {
    return <Card aria-busy="true" className="min-h-48" />;
  }

  if (phase === "missing") {
    return (
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={1}>
            Link incompleto
          </CardTitle>
          <CardDescription>
            Abra o link de redefinição completo, do jeito que o administrador
            enviou. Se ele não funcionar, peça outro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/entrar"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Ir para a entrada
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (phase === "done") {
    return (
      <Card>
        <CardHeader>
          <CardTitle role="heading" aria-level={1}>
            Senha alterada
          </CardTitle>
          <CardDescription>
            Por segurança, todos os acessos abertos foram encerrados. Entre com
            a senha nova.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/entrar" className={buttonVariants({ size: "lg" })}>
            Entrar
          </Link>
        </CardContent>
      </Card>
    );
  }

  const errorId = `${uid}-error`;
  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={1}>
          Criar uma senha nova
        </CardTitle>
        <CardDescription>Use pelo menos 8 caracteres.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor={`${uid}-password`}>Senha nova</FieldLabel>
              <Input
                id={`${uid}-password`}
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
              />
              {error && <FieldError id={errorId}>{error}</FieldError>}
            </Field>
            <Button type="submit" size="lg" disabled={pending}>
              Trocar a senha
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
```

Crie `src/app/(auth)/redefinir-senha/page.tsx` (estática: nada de `searchParams`, `cookies()` nem `headers()`):

```tsx
import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/ResetPasswordForm";

export const metadata: Metadata = { title: "Redefinir senha" };

// Página estática: o token vem no fragmento da URL (#token=...), que só o
// navegador enxerga. Nada de searchParams aqui, então nada do token passa pelo
// servidor, por log ou por cache.
export default function Page() {
  return <ResetPasswordForm />;
}
```

Run: `bunx biome check --write src/components/auth "src/app/(auth)"` e depois `bunx vitest run src/components/auth/ResetPasswordForm.test.tsx "src/app/(auth)/redefinir-senha"`
Expected: PASS, `Test Files  2 passed (2)` e `Tests  22 passed (22)` (20 do formulário e 2 da página).

- [ ] **Step B8: Rota pública, `no-referrer` e o rodapé do `/entrar` (testes primeiro)**

Testes:

Troque:

```ts
} from "./proxyRules";

describe("isPublicPath", () => {
  it("os prefixos públicos são /entrar e /convite", () => {
    expect(PUBLIC_PATH_PREFIXES).toEqual(["/entrar", "/convite"]);
  });

  it.each([
```

por:

```ts
} from "./proxyRules";

describe("isPublicPath", () => {
  it("os prefixos públicos são /entrar, /convite e /redefinir-senha", () => {
    expect(PUBLIC_PATH_PREFIXES).toEqual([
      "/entrar",
      "/convite",
      "/redefinir-senha",
    ]);
  });

  it.each([
```

Troque:

```ts
    "/convite",
    "/convite/abc123",
    "/convite/abc123/",
  ])("%s é pública", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });
```

por:

```ts
    "/convite",
    "/convite/abc123",
    "/convite/abc123/",
    "/redefinir-senha",
    "/redefinir-senha/",
  ])("%s é pública", (pathname) => {
    expect(isPublicPath(pathname)).toBe(true);
  });
```

Troque:

```ts
    "/entrar-admin",
    "/convites",
    "/convitex/abc",
    "/admin/entrar",
    "//entrar",
    "/Entrar",
```

por:

```ts
    "/entrar-admin",
    "/convites",
    "/convitex/abc",
    "/redefinir-senhas",
    "/redefinir-senha-x",
    "/admin/entrar",
    "//entrar",
    "/Entrar",
```

Troque:

```ts
  it.each([
    "/entrar",
    "/convite/abc123",
  ])("rota pública %s não redireciona, com ou sem cookie", (pathname) => {
    expect(shouldRedirectToSignIn(pathname, false)).toBe(false);
    expect(shouldRedirectToSignIn(pathname, true)).toBe(false);
```

por:

```ts
  it.each([
    "/entrar",
    "/convite/abc123",
    "/redefinir-senha",
  ])("rota pública %s não redireciona, com ou sem cookie", (pathname) => {
    expect(shouldRedirectToSignIn(pathname, false)).toBe(false);
    expect(shouldRedirectToSignIn(pathname, true)).toBe(false);
```

Troque:

```ts
    "/apix",
    "/apiary",
    "/convites",
  ])("prefixo parecido %s sem cookie → redireciona", (pathname) => {
    expect(shouldRedirectToSignIn(pathname, false)).toBe(true);
  });
```

por:

```ts
    "/apix",
    "/apiary",
    "/convites",
    "/redefinir-senhas",
  ])("prefixo parecido %s sem cookie → redireciona", (pathname) => {
    expect(shouldRedirectToSignIn(pathname, false)).toBe(true);
  });
```

Troque:

```ts
}

describe("next.config headers", () => {
  it("/convite/* envia Referrer-Policy: no-referrer", async () => {
    const rule = (await rules()).find(
      (candidate) => candidate.source === "/convite/:path*",
    );
    expect(headerValue(rule?.headers, "Referrer-Policy")).toBe("no-referrer");
  });

  it("a regra de no-referrer vem depois da global (a posterior vence)", async () => {
    const sources = (await rules()).map((rule) => rule.source);
    expect(sources).toEqual(["/:path*", "/convite/:path*"]);
  });

  it("todas as rotas recebem os cabeçalhos de segurança", async () => {
```

por:

```ts
}

describe("next.config headers", () => {
  it("/convite/* e /redefinir-senha/* enviam Referrer-Policy: no-referrer", async () => {
    const all = await rules();
    for (const source of ["/convite/:path*", "/redefinir-senha/:path*"]) {
      const rule = all.find((candidate) => candidate.source === source);
      expect(headerValue(rule?.headers, "Referrer-Policy"), source).toBe(
        "no-referrer",
      );
    }
  });

  it("as regras de no-referrer vêm depois da global (a posterior vence)", async () => {
    const sources = (await rules()).map((rule) => rule.source);
    expect(sources).toEqual([
      "/:path*",
      "/convite/:path*",
      "/redefinir-senha/:path*",
    ]);
  });

  it("todas as rotas recebem os cabeçalhos de segurança", async () => {
```

Troque:

```tsx
    expect(screen.getByText("O acesso é só por convite.")).toBeInTheDocument();
  });

  it("e-mail aceita autofill de passkey e senha usa o autocomplete certo", () => {
    setup();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute(
```

por:

```tsx
    expect(screen.getByText("O acesso é só por convite.")).toBeInTheDocument();
  });

  it("o rodapé diz que a senha esquecida se resolve com o administrador, depois do aviso do convite", () => {
    setup();
    const notes = screen
      .getAllByText(/convite.|Esqueceu a senha?/)
      .map((node) => node.textContent);
    expect(notes).toEqual([
      "O acesso é só por convite.",
      "Esqueceu a senha? Peça ao administrador um link para criar outra.",
    ]);
    expect(screen.queryByText(/Esqueci a senha/)).not.toBeInTheDocument();
  });

  it("e-mail aceita autofill de passkey e senha usa o autocomplete certo", () => {
    setup();
    expect(screen.getByLabelText("E-mail")).toHaveAttribute(
```

Run: `bunx vitest run src/features/authz/proxyRules.test.ts src/app/nextConfig.test.ts src/components/auth/SignInPanel.test.tsx`
Expected: FAIL, `Tests  7 failed | 74 passed (81)`: `/redefinir-senha e /redefinir-senha/ são públicas`, `os prefixos públicos são /entrar, /convite e /redefinir-senha`, `rota pública /redefinir-senha não redireciona, com ou sem cookie`, os dois do `next.config` (`/redefinir-senha/:path*: expected undefined to be 'no-referrer'` e a ordem das regras) e o do rodapé (`expected [ 'O acesso é só por convite.' ] to deeply equal [ 'O acesso é só por convite.', …(1) ]`).

Código (sem o `/redefinir-senha` no `PUBLIC_PATH_PREFIXES` o proxy mandaria a pessoa para `/entrar`; o parágrafo de convite continua **primeiro** e exato, para o teste de unidade e o `e2e/auth.spec.ts` não mudarem):

Troque:

```ts
export const PUBLIC_PATH_PREFIXES: readonly string[] = ["/entrar", "/convite"];

function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
```

por:

```ts
export const PUBLIC_PATH_PREFIXES: readonly string[] = [
  "/entrar",
  "/convite",
  "/redefinir-senha",
];

function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
```

Troque:

```ts
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/convite/:path*", headers: noReferrer },
    ];
  },
};
```

por:

```ts
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/convite/:path*", headers: noReferrer },
      { source: "/redefinir-senha/:path*", headers: noReferrer },
    ];
  },
};
```

Troque:

```tsx
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
```

por:

```tsx
          disabled={pending}
        />
      </CardContent>
      <CardFooter className="flex flex-col items-start gap-1">
        <p className="text-sm text-muted-foreground">
          O acesso é só por convite.
        </p>
        <p className="text-sm text-muted-foreground">
          Esqueceu a senha? Peça ao administrador um link para criar outra.
        </p>
      </CardFooter>
    </Card>
  );
```

Run: `bunx biome check --write next.config.ts src` e depois `bunx vitest run src/features/authz/proxyRules.test.ts src/app/nextConfig.test.ts src/components/auth/SignInPanel.test.tsx`
Expected: PASS, `Test Files  3 passed (3)` e `Tests  81 passed (81)`.

- [ ] **Step B9: E2E de cadastros: a linha própria tem o botão "Nova senha"**

O cenário (e) de `e2e/cadastros.spec.ts` afirmava "nenhum botão" na linha da própria conta; agora afirma exatamente um, o de nova senha (contrato da Tarefa 5: `nextConfig.test.ts`, `TeamAdmin.test.tsx` e este cenário mudam por causa disso):

Troque:

```ts
  }
});

test("(e) a linha da própria conta do admin mostra Você, a ajuda e nenhum botão", async ({
  page,
}) => {
  const email = uniqueEmail();
```

por:

```ts
  }
});

test("(e) a linha da própria conta do admin mostra Você, a ajuda e só o botão Nova senha", async ({
  page,
}) => {
  const email = uniqueEmail();
```

Troque:

```ts
  await expect(ownRow).toContainText(
    "Peça a outro administrador para mudar a sua conta.",
  );
  await expect(ownRow.getByRole("button")).toHaveCount(0);
});

test("(f) setor com operador ativo não se desativa e mostra o motivo", async ({
```

por:

```ts
  await expect(ownRow).toContainText(
    "Peça a outro administrador para mudar a sua conta.",
  );
  await expect(ownRow.getByRole("button")).toHaveCount(1);
  await expect(
    ownRow.getByRole("button", { name: /^Gerar link de nova senha para / }),
  ).toBeVisible();
});

test("(f) setor com operador ativo não se desativa e mostra o motivo", async ({
```

Run: `bunx biome check --write e2e`
Expected: `Checked 9 files … No fixes applied.` O E2E roda no Step B11.

- [ ] **Step B10: Catálogo de componentes, P8, arquitetura e `library-docs`**

Primeiro o guarda (falhando): em `test/uiRegistryDoc.test.ts` os dois nomes entram na lista de cabeçalhos próprios, e em `test/pendenciasDoc.test.ts` o caso do P8:

Troque:

```ts
    "chartColors",
    "usePrefersReducedMotion",
    "StockTrendChart",
  ])("%s tem cabeçalho próprio no catálogo (a menção solta não basta)", (name) => {
    expect(registry).toMatch(new RegExp(`^### ${name}(?![\\w])`, "m"));
  });
```

por:

```ts
    "chartColors",
    "usePrefersReducedMotion",
    "StockTrendChart",
    "ResetPasswordForm",
    "PasswordResetLinkButton",
  ])("%s tem cabeçalho próprio no catálogo (a menção solta não basta)", (name) => {
    expect(registry).toMatch(new RegExp(`^### ${name}(?![\\w])`, "m"));
  });
```

Troque:

```ts
      ).toBe(true);
    }
  });
});
```

por:

```ts
      ).toBe(true);
    }
  });

  it("Fase 6: P8 continua bloqueada no dono e ganhou a Atualização do link do admin", () => {
    const entry = entries.get("P8");
    expect(entry?.state).toBe("Bloqueado no dono");
    expect(entry?.section).toBe("3");
    expect(entry?.updates.some((date) => date >= "2026-11-25")).toBe(true);
  });
});
```

Run: `bunx vitest run test/uiRegistryDoc.test.ts test/pendenciasDoc.test.ts`
Expected: FAIL, `Test Files  2 failed (2)` e `Tests  4 failed | 132 passed (136)`: `src\components\admin\team\PasswordResetLinkButton.tsx está no catálogo` (`nenhuma menção a "PasswordResetLinkButton"`), `ResetPasswordForm tem cabeçalho próprio no catálogo`, `PasswordResetLinkButton tem cabeçalho próprio no catálogo` e `Fase 6: P8 continua bloqueada no dono e ganhou a Atualização do link do admin`.

`.context/ui-registry.md` (entradas novas de `PasswordResetLinkButton` e `ResetPasswordForm`; `TeamAdmin`, `PersonRowActions` e `SignInPanel` ganham o que mudou, com `Histórico` datado):

Troque:

```markdown
  `?error=`; erros por `authFormError(errorCodeOf(erro))`/`passkeyErrorCode`. O formulário vem primeiro porque o
  autofill de passkey vive no campo de e-mail.
- **Usa:** `Card*`, `Field*`, `Input`, `Button`, `SocialButtons`.
- **Histórico:** 2026-11-20 — criado na Fase 1.
```

por:

```markdown
  `?error=`; erros por `authFormError(errorCodeOf(erro))`/`passkeyErrorCode`. O formulário vem primeiro porque o
  autofill de passkey vive no campo de e-mail. O rodapé tem dois parágrafos, nesta ordem: "O acesso é só por convite." e (Fase 6) "Esqueceu a senha? Peça ao administrador um link para criar outra." (nunca "Esqueci a senha": não há e-mail, o link vem do admin).
- **Usa:** `Card*`, `Field*`, `Input`, `Button`, `SocialButtons`.
- **Histórico:** 2026-11-20 — criado na Fase 1. <DATA> — Fase 6 (Tarefa 5): aviso de senha esquecida no rodapé.

### ResetPasswordForm
- **Status:** ✅ pronto (<DATA>)
- **Local:** `src/components/auth/ResetPasswordForm.tsx` (página estática `src/app/(auth)/redefinir-senha/page.tsx`)
- **Propósito:** a pessoa criar a senha nova com o link que o administrador mandou.
- **Como funciona:** `"use client"`; `takeTokenFromLocation(location, history)` lê o token do **fragmento** (`#token=`, 16 a 256 caracteres `A-Za-z0-9_-`) e apaga o fragmento da barra com `history.replaceState`; o fragmento nunca chega ao servidor (fora do log e do `Referer`). Fases: lendo (cartão vazio com `aria-busy`), sem token ("Link incompleto" e o link-botão "Ir para a entrada"), formulário ("Criar uma senha nova", campo "Senha nova", `type="password"`, `autoComplete="new-password"`, 8 a 128, botão "Trocar a senha") e feito ("Senha alterada" e o link-botão "Entrar"; não entra sozinho, as sessões foram revogadas). Chama `authClient.resetPassword({ newPassword, token })`; o erro vira `authErrorMessage(errorCodeOf(error))` e a exceção de rede a mensagem genérica. Em StrictMode o segundo efeito não acha o fragmento e não zera o token.
- **Usa:** `Card*`, `Field*`, `Input`, `Button`, `buttonVariants`, `authClient`, `authErrorMessage`.
- **Histórico:** <DATA> — criado na Fase 6 (Tarefa 5).
```

Troque:

```markdown
- **Propósito:** conteúdo de `/admin/equipe`: convidar, acompanhar convites pendentes e gerir as pessoas do sistema.
- **Como funciona:** Server Component async; chama `requireAdmin()` e lê `listPeople` (`?pagina=`), `listPendingInvites` (`?convites=`) e `listActiveSectors`. Ordem na tela: `InviteForm`, "Convites pendentes" (só válidos, com `PendingInviteActions`) e "Pessoas". A própria conta mostra o selo "Você" e o texto de ajuda, **sem botões**; pessoa inativa fica esmaecida (`InactiveBadge`) com "Reativar"; setor inativo aparece como "(inativo)"; duas `Pagination` independentes (cada uma preserva o parâmetro da outra); estados vazios.
- **Usa:** `AdminPageHeader`, `AdminListRow`, `EmptyState`, `Pagination`, `Badge`, `InviteForm`, `PendingInviteActions`, `PersonRowActions`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 9, só Pessoas); Tarefa 10 acrescenta convites.
```

por:

```markdown
- **Propósito:** conteúdo de `/admin/equipe`: convidar, acompanhar convites pendentes e gerir as pessoas do sistema.
- **Como funciona:** Server Component async; chama `requireAdmin()` e lê `listPeople` (`?pagina=`), `listPendingInvites` (`?convites=`) e `listActiveSectors`. Ordem na tela: `InviteForm`, "Convites pendentes" (só válidos, com `PendingInviteActions`) e "Pessoas". A própria conta mostra o selo "Você", o texto de ajuda e **só** o `PasswordResetLinkButton` ("Nova senha": é a única ação que vale para si mesmo e dá ao admin sem e-mail um caminho de recuperação); pessoa inativa fica esmaecida (`InactiveBadge`) com "Reativar"; setor inativo aparece como "(inativo)"; duas `Pagination` independentes (cada uma preserva o parâmetro da outra); estados vazios.
- **Usa:** `AdminPageHeader`, `AdminListRow`, `EmptyState`, `Pagination`, `Badge`, `InviteForm`, `PendingInviteActions`, `PersonRowActions`, `PasswordResetLinkButton`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 9, só Pessoas); Tarefa 10 acrescenta convites. <DATA> — Fase 6 (Tarefa 5): a linha da própria conta ganha o botão "Nova senha" (antes ficava sem botões).
```

Troque:

```markdown
- **Local:** `src/components/admin/team/PersonRowActions.tsx`
- **Propósito:** ações de uma linha de pessoa: editar, desativar (com confirmação) e reativar.
- **Como funciona:** `"use client"`; `EditDialog` "Editar pessoa" com `PersonForm`; "Desativar" abre `ConfirmDialog` (texto: perde o acesso agora, sessões encerradas, histórico continua) e mostra a recusa do servidor dentro do diálogo; "Reativar" age direto e leva o erro para o toast. `aria-label` com o nome da pessoa em todos os botões.
- **Usa:** `EditDialog`, `ConfirmDialog`, `PersonForm`, `useAdminAction`, `Button`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 9).
```

por:

```markdown
- **Local:** `src/components/admin/team/PersonRowActions.tsx`
- **Propósito:** ações de uma linha de pessoa: editar, gerar link de nova senha, desativar (com confirmação) e reativar.
- **Como funciona:** `"use client"`; `EditDialog` "Editar pessoa" com `PersonForm`; "Desativar" abre `ConfirmDialog` (texto: perde o acesso agora, sessões encerradas, histórico continua) e mostra a recusa do servidor dentro do diálogo; "Reativar" age direto e leva o erro para o toast. `aria-label` com o nome da pessoa em todos os botões. Fase 6: pessoa **ativa** ganha o `PasswordResetLinkButton` entre "Editar" e "Desativar" (a inativa não: o domínio recusaria).
- **Usa:** `EditDialog`, `ConfirmDialog`, `PersonForm`, `PasswordResetLinkButton`, `useAdminAction`, `Button`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 9). <DATA> — Fase 6 (Tarefa 5): botão "Nova senha".

### PasswordResetLinkButton
- **Status:** ✅ pronto (<DATA>)
- **Local:** `src/components/admin/team/PasswordResetLinkButton.tsx`
- **Propósito:** o admin gerar o link de nova senha de uma pessoa (sem e-mail, D-F6-2) e mandá-lo como o convite, por cópia ou WhatsApp.
- **Como funciona:** `"use client"`; botão "Nova senha" (`variant="outline"`, `size="sm"`, `aria-label` `Gerar link de nova senha para {nome}`, desabilitado enquanto a action roda). Um clique chama `createPasswordResetLinkAction({ userId })` por `useAdminAction` (o erro vira toast, nenhum diálogo abre). No sucesso abre um `Dialog` "Link de nova senha" (descrição = o nome) com o campo somente leitura `Link para copiar` (seleciona ao focar), o texto "Válido até {data e hora}, uma vez só…", "Copiar link" e "Compartilhar" (só com `navigator.share`, pelo `useShareLink`). Fechar o diálogo descarta o link: ele aparece uma vez só e gerar outro derruba o anterior.
- **Usa:** `useAdminAction`, `useShareLink`, `Dialog*`, `Input`, `Button`, `formatDateTimeBR`.
- **Histórico:** <DATA> — criado na Fase 6 (Tarefa 5).
```

`.context/pendencias.md` (P8 continua `Bloqueado no dono`, na seção 3; ganha só a `Atualização`):

Troque:

```markdown
**Atualização (2026-11-20):** corrigido o item acima: o hook deixou de forçar `emailVerified` (`inviteSignupData` em `src/lib/auth/createAuth.ts`); cadastro por e-mail e senha fica `false` e o login social mantém o valor do provedor. Quando houver provedor de e-mail, a verificação de verdade (e o "esqueci a senha") entra por aqui; P8 continua bloqueada.
```

por:

```markdown
**Atualização (2026-11-20):** corrigido o item acima: o hook deixou de forçar `emailVerified` (`inviteSignupData` em `src/lib/auth/createAuth.ts`); cadastro por e-mail e senha fica `false` e o login social mantém o valor do provedor. Quando houver provedor de e-mail, a verificação de verdade (e o "esqueci a senha") entra por aqui; P8 continua bloqueada.
**Atualização (<DATA>):** Fase 6 (D-F6-2): sem provedor de e-mail, a recuperação passou a ser o **link de nova senha gerado pelo administrador** em `/admin/equipe` ("Nova senha", `createPasswordResetLink`, válido por 24 h, uso único, compartilhado como o convite) e a página pública `/redefinir-senha`; o `/entrar` diz "Esqueceu a senha? Peça ao administrador um link para criar outra.". O pedido por e-mail (`/request-password-reset`) continua respondendo `RESET_PASSWORD_DISABLED`. P8 continua **bloqueada no dono**: e-mail transacional exige domínio próprio (D-F6-1, só `*.vercel.app` no piloto), e a verificação de e-mail e o "esqueci a senha" por e-mail seguem para depois.
```

`.context/architecture.md` (§7: o bullet do link de redefinição; §9: a rota nova e a lista de rotas públicas):

Troque:

```markdown
- **Passkey.** `rpID` e origem vêm de `BETTER_AUTH_URL` (passkey de `localhost` não vale em produção); criada em `/bem-vindo` ou `/conta` (exige sessão recente); login pelo autofill do campo de e-mail e pelo botão "Entrar com passkey".
```

por:

```markdown
- **Passkey.** `rpID` e origem vêm de `BETTER_AUTH_URL` (passkey de `localhost` não vale em produção); criada em `/bem-vindo` ou `/conta` (exige sessão recente); login pelo autofill do campo de e-mail e pelo botão "Entrar com passkey".
- **Redefinição de senha pelo administrador (Fase 6, D-F6-2).** Sem e-mail transacional (P8), o admin gera o link em `/admin/equipe` (`createPasswordResetLinkAction`, `requireAdmin()` na primeira instrução; o domínio `createPasswordResetLink` confere o papel de novo). O token (`randomBytes(32)`, base64url) vai pelo `internalAdapter.createVerificationValue` do Better Auth como `reset-password:<token>` com `value = userId` e **só o hash** fica no banco (`verification.storeIdentifier`); vale **24 h**, uso único, e o link novo derruba o anterior. Desativar a pessoa apaga as `verification` dela (`setPersonActive`, na mesma transação), então reativar não ressuscita um link que circulava. A URL é `/redefinir-senha#token=…`: o token fica no **fragmento**, que o navegador nunca envia (fora do log da Vercel e do `Referer`; a rota ainda manda `Referrer-Policy: no-referrer`). A página pública e estática `ResetPasswordForm` lê o fragmento, apaga-o da barra e chama `POST /api/auth/reset-password`; o Better Auth troca a senha (cria a conta `credential` de quem só tinha passkey) e revoga todas as sessões (`revokeSessionsOnPasswordReset`). Admin pode gerar para si e para outro admin; não para conta desativada. **Exceção à regra de `db.transaction()`:** a criação passa pelo adapter do Better Auth, que não entra numa transação nossa; por isso o domínio apaga os links antigos **antes** de criar o novo (falha fechado). Risco residual: o link fica no histórico do WhatsApp por até 24 h (8 h é uma constante só) e não há registro de quem gerou o link de quem (P76).
```

Troque:

```markdown
| `/convite/[token]` | convite (válido, expirado, usado, cancelado, inexistente) + cadastro; `armInvite` grava o cookie. Pública | ✅ Fase 1 |
| `/bem-vindo` | oferta de passkey logo depois do cadastro | ✅ Fase 1 |
```

por:

```markdown
| `/convite/[token]` | convite (válido, expirado, usado, cancelado, inexistente) + cadastro; `armInvite` grava o cookie. Pública | ✅ Fase 1 |
| `/redefinir-senha` | criar a senha nova com o link do administrador (`#token=` no fragmento; sem fragmento mostra "Link incompleto"). Estática e pública; `Referrer-Policy: no-referrer` | ✅ Fase 6 |
| `/bem-vindo` | oferta de passkey logo depois do cadastro | ✅ Fase 1 |
```

Troque:

```markdown

Rotas públicas: `/entrar`, `/convite/[token]`, `/api/auth/*` e `/api/health`. Todo o resto exige sessão (`src/proxy.ts` + `requireUser()`).
```

por:

```markdown

Rotas públicas: `/entrar`, `/convite/[token]`, `/redefinir-senha`, `/api/auth/*` e `/api/health`. Todo o resto exige sessão (`src/proxy.ts` + `requireUser()`).
```

`.context/library-docs.md` (§8):

Troque:

```markdown
- **Endurecimento da Fase 6 (`createAuth.ts`).** (1) `advanced.ipAddress.ipAddressHeaders: ["x-forwarded-for"]`, só ele: a Vercel o sobrescreve com o IP do cliente; `x-real-ip` e `x-vercel-forwarded-for` seriam forjáveis fora dela (P22). (2) `verification.storeIdentifier` com `overrides: { "reset-password:": "hashed" }` (`RESET_PASSWORD_PREFIX`): o banco guarda só o hash do token de redefinição; o resto continua `plain`. (3) `emailAndPassword.revokeSessionsOnPasswordReset: true`; continua **sem** `sendResetPassword` (`POST /request-password-reset` responde `RESET_PASSWORD_DISABLED`). (4) `user.create.after` apaga o cookie `closery_invite` com `setCookie(..., { ...inviteCookieOptions(...), maxAge: 0 })` (P16). (5) `logger: { log }`: o logger padrão imprime o erro cru e o erro do Drizzle carrega o SQL e os parâmetros; só o nível `error` (com o `Error` dos argumentos ou `null`) e o aviso `Rate limiting could not determine a client IP` passam, os dois por `logServerError` (contextos `better-auth` e `better-auth:ip-desconhecido`); os outros avisos são descartados. **Resíduo (P75):** o roteador do `better-call` imprime `# SERVER_ERROR: <erro>` com `console.error` por conta própria quando a exceção não é `APIError`, fora do alcance do logger; o log da Vercel pode mostrar o `Failed query ... params` por esse caminho.
- **Teste de IP (`ipUnknown.test.ts`).** O Better Auth decide "é teste?" quando o módulo carrega (`NODE_ENV=test` ou `TEST` verdadeiro; o Vitest define `TEST=true`) e, sendo teste, devolve `127.0.0.1` em vez de cair no balde `no-trusted-ip`. Para provar o comportamento de produção o teste fixa `NODE_ENV=production` e `TEST` vazio dentro de `vi.hoisted`, em arquivo próprio (o aviso de IP sai uma vez por processo).
```

por:

```markdown
- **Endurecimento da Fase 6 (`createAuth.ts`).** (1) `advanced.ipAddress.ipAddressHeaders: ["x-forwarded-for"]`, só ele: a Vercel o sobrescreve com o IP do cliente; `x-real-ip` e `x-vercel-forwarded-for` seriam forjáveis fora dela (P22). (2) `verification.storeIdentifier` com `overrides: { "reset-password:": "hashed" }` (`RESET_PASSWORD_PREFIX`): o banco guarda só o hash do token de redefinição; o resto continua `plain`. (3) `emailAndPassword.revokeSessionsOnPasswordReset: true`; continua **sem** `sendResetPassword` (`POST /request-password-reset` responde `RESET_PASSWORD_DISABLED`). (4) `user.create.after` apaga o cookie `closery_invite` com `setCookie(..., { ...inviteCookieOptions(...), maxAge: 0 })` (P16). (5) `logger: { log }`: o logger padrão imprime o erro cru e o erro do Drizzle carrega o SQL e os parâmetros; só o nível `error` (com o `Error` dos argumentos ou `null`) e o aviso `Rate limiting could not determine a client IP` passam, os dois por `logServerError` (contextos `better-auth` e `better-auth:ip-desconhecido`); os outros avisos são descartados. **Resíduo (P75):** o roteador do `better-call` imprime `# SERVER_ERROR: <erro>` com `console.error` por conta própria quando a exceção não é `APIError`, fora do alcance do logger; o log da Vercel pode mostrar o `Failed query ... params` por esse caminho.
- **Redefinição pelo admin (Fase 6, T5).** O `POST /reset-password` só procura a `verification` `reset-password:<token>` (hash, por causa do `storeIdentifier`) com `value = userId`; a exigência de `sendResetPassword` existe só no `/request-password-reset`. Quem grava é sempre o `(await auth.$context).internalAdapter.createVerificationValue` (respeita o hash): nunca `db.insert(verification)` com o token cru. O erro de token vencido, usado ou inexistente é `INVALID_TOKEN` (400; mapeado em `AUTH_ERROR_MESSAGES`). Os testes do `createPasswordResetLink` fazem o reset de verdade pelo `auth.handler` (precisa do cabeçalho `origin`) e são o guarda contra mudança do formato interno em upgrade do Better Auth.
- **Teste de IP (`ipUnknown.test.ts`).** O Better Auth decide "é teste?" quando o módulo carrega (`NODE_ENV=test` ou `TEST` verdadeiro; o Vitest define `TEST=true`) e, sendo teste, devolve `127.0.0.1` em vez de cair no balde `no-trusted-ip`. Para provar o comportamento de produção o teste fixa `NODE_ENV=production` e `TEST` vazio dentro de `vi.hoisted`, em arquivo próprio (o aviso de IP sai uma vez por processo).
```

Troque, em todas as inserções acima, **só os `<DATA>`** pela data do dia da execução (o `Histórico` do `ui-registry`, o status `✅ pronto (<DATA>)` das entradas novas e a `Atualização` do P8); datas que já existem nos arquivos ficam como estão. O guarda de pendências aceita qualquer data `>= 2026-11-25`.

Run: `bunx vitest run test/uiRegistryDoc.test.ts test/pendenciasDoc.test.ts`
Expected: PASS, `Test Files  2 passed (2)` e `Tests  136 passed (136)`.

- [ ] **Step B11: Portões**

```bash
bun run check-types
bun run lint
bun run test
```

Expected: `check-types` sem erro; `lint` sem correção pendente; `bun run test`: todos os arquivos passam, total = o do fim do commit A + **5 arquivos** (`passwordReset.test.ts`, `passwordResetAction.test.ts`, `PasswordResetLinkButton.test.tsx`, `ResetPasswordForm.test.tsx` e `redefinir-senha/page.test.tsx`) e + **82 testes** (medido, por arquivo: `passwordReset.test.ts` +23, `ResetPasswordForm.test.tsx` +20, `PasswordResetLinkButton.test.tsx` +9, `proxyRules.test.ts` +6, `passwordResetAction.test.ts` +5, `people.test.ts` +3, `schemas.test.ts` +3, `uiRegistryDoc.test.ts` +3, `PersonRowActions.test.tsx` +2, `errorCodesContract.test.ts` +2, `page.test.tsx` +2, `TeamAdmin.test.tsx` +1, `SignInPanel.test.tsx` +1, `errors.test.ts` +1, `pendenciasDoc.test.ts` +1; `actionsInventory`, `nextConfig`, `messages` e `result` mudam só dentro de testes que já existiam). Anote o total. O `migration0002.test.ts` pode estourar 15 s com a máquina carregada: repita só ele, `bunx vitest run src/db/schema/migration0002.test.ts`; se falhar isolado, BLOCKED.

Build (a página nova tem de sair **estática**):

```bash
export DATABASE_URL="postgresql://closery:fake@127.0.0.1:1/closery?sslmode=disable"
export DATABASE_URL_POOLED="$DATABASE_URL"
export BETTER_AUTH_URL="http://localhost:3201"
export BETTER_AUTH_SECRET="segredo-local-de-teste-nao-usar-0123456789abcdef"
export NEXT_PUBLIC_SENTRY_DSN=""
bun run build
```

Expected: build verde e, na lista de rotas, `○ /redefinir-senha` (estática, `○`); `ƒ /api/auth/[...all]`, `ƒ /api/dashboard/export` e `ƒ /api/health` continuam as únicas rotas de API (**nenhum `route.ts` novo**).

E2E inteiro (portas 3200 e 54329 livres; `netstat -ano | grep -E ':3200|:54329' | grep LISTENING` sem saída):

Run: `bun run test:e2e`
Expected: `35 passed` (7 `auth` + 6 `cadastros` + 7 `dashboard` + 6 `passagem` + 9 `solicitacoes`), com o cenário (e) de `cadastros.spec.ts` já na versão nova. Se divergir, pare e reporte BLOCKED com o número medido.

- [ ] **Step B12: Commit B**

Crie `.git/sdd/f6/msg-task-5b.txt` com a ferramenta Write:

```text
feat(equipe): link de nova senha gerado pelo administrador (D-F6-2)

Sem e-mail transacional (P8), o admin gera em /admin/equipe um link de
nova senha, válido por 24 h e de uso único, e o compartilha como o
convite.

- createPasswordResetLink: grava pelo internalAdapter do Better Auth
  (só o hash no banco), apaga os links antigos antes de criar (falha
  fechado, exceção documentada a db.transaction()), recusa conta
  desativada (PERSON_INACTIVE) e operador (FORBIDDEN)
- setPersonActive derruba o link ao desativar
- createPasswordResetLinkAction (requireAdmin) e o botão Nova senha em
  PersonRowActions e na linha da própria conta
- /redefinir-senha: página pública estática; o token vai no fragmento
  (#token=) e nunca chega ao servidor; Referrer-Policy no-referrer
- INVALID_TOKEN no mapa de erros e rodapé do /entrar
- P8 segue bloqueada no dono, com Atualização

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

```bash
git add src/features/admin/passwordReset.ts src/features/admin/passwordReset.test.ts \
  src/features/admin/people.ts src/features/admin/people.test.ts \
  src/features/admin/result.ts src/features/admin/result.test.ts \
  src/features/admin/messages.ts src/features/admin/messages.test.ts \
  src/features/admin/schemas.ts src/features/admin/schemas.test.ts \
  "src/app/(app)/admin/equipe/actions.ts" "src/app/(app)/admin/equipe/passwordResetAction.test.ts" \
  "src/app/(app)/admin/actionsInventory.test.ts" \
  src/components/admin/team/PasswordResetLinkButton.tsx src/components/admin/team/PasswordResetLinkButton.test.tsx \
  src/components/admin/team/PersonRowActions.tsx src/components/admin/team/PersonRowActions.test.tsx \
  src/components/admin/team/TeamAdmin.tsx src/components/admin/team/TeamAdmin.test.tsx \
  src/components/auth/ResetPasswordForm.tsx src/components/auth/ResetPasswordForm.test.tsx \
  src/components/auth/SignInPanel.tsx src/components/auth/SignInPanel.test.tsx \
  "src/app/(auth)/redefinir-senha/page.tsx" "src/app/(auth)/redefinir-senha/page.test.tsx" \
  src/features/authz/proxyRules.ts src/features/authz/proxyRules.test.ts \
  next.config.ts src/app/nextConfig.test.ts \
  src/lib/auth/errors.ts src/lib/auth/errors.test.ts src/lib/auth/errorCodesContract.test.ts \
  e2e/cadastros.spec.ts test/uiRegistryDoc.test.ts test/pendenciasDoc.test.ts \
  .context/ui-registry.md .context/pendencias.md .context/architecture.md .context/library-docs.md
git status --short
git commit -F .git/sdd/f6/msg-task-5b.txt
```

Expected: `git status --short` lista só arquivos desta tarefa (nada de `.env.local`, `.next`, `test-results` nem `.git/sdd`); o commit passa nos hooks.


### Task 6: Sentry (desligado sem DSN, sem dado pessoal no evento)

**Files:**
- Create: `src/lib/sentry/scrubEvent.ts`
- Create: `src/lib/sentry/scrubEvent.test.ts`
- Create: `src/lib/sentry/options.ts`
- Create: `src/lib/sentry/options.test.ts`
- Create: `src/instrumentation.ts`
- Create: `src/instrumentation.test.ts`
- Create: `src/instrumentation-client.ts`
- Create: `src/app/global-error.tsx`
- Create: `src/app/global-error.test.tsx`
- Modify: `package.json` e `bun.lock` (só pelo `bun add`)
- Modify: `src/lib/logServerError.ts`
- Modify: `src/lib/logServerError.test.ts`
- Modify: `test/logGuard.test.ts`
- Modify: `next.config.ts`
- Modify: `playwright.config.ts`
- Modify: `.env.example`
- Modify: `.context/library-docs.md` (§16, nova), `.context/architecture.md` (§2) e `.context/ui-registry.md` (`AppError` e `GlobalError`)

Nenhuma migração, nenhuma rota nova (**nenhum `route.ts`**: sem `tunnelRoute`) e nenhum serviço externo: o Sentry fica **desligado** sem `NEXT_PUBLIC_SENTRY_DSN`, e esta tarefa nunca cria conta, projeto nem DSN (isso é a Parte B, passo 3). A captura de verdade é provada **sem conta**: DSN falso e transporte falso que só guarda o envelope como texto. O único acesso à rede é o `bun add --exact`.

**Interfaces:**
- Consumes: `logServerError` e `summarizeError` (Tarefa 2); o `next.config.ts` das Tarefas 1 e 5 (`securityHeaders`, `noReferrer`, `headers()` com três regras); o `playwright.config.ts` de hoje.
- Produces (assinaturas do Contrato): `SENTRY_DSN`, `sentryOptions(overrides?: Partial<NodeOptions>): NodeOptions` (`src/lib/sentry/options.ts`); `REDACTED`, `scrubText(text: string): string`, `scrubEvent<T extends ErrorEvent>(event: T): T` (`src/lib/sentry/scrubEvent.ts`; só `import type` do Sentry); `register(): void` e `onRequestError` (`src/instrumentation.ts`); `onRouterTransitionStart` (`src/instrumentation-client.ts`); `GlobalError` (`src/app/global-error.tsx`); `logServerError` passa a capturar (F6-13); `export default withSentryConfig(nextConfig, …)`. O `logGuard` passa a exigir que `@sentry/nextjs` só seja importado por `src/lib/sentry/options.ts`, `src/lib/sentry/scrubEvent.ts` (só tipo), `src/instrumentation.ts`, `src/instrumentation-client.ts` e `src/lib/logServerError.ts`.

- [ ] **Step 0: Conferir o ponto de partida**

Rode, na raiz do repositório:

```bash
git branch --show-current
git status --short
git log --oneline -8
ls src/lib/logServerError.ts src/app/error.tsx "src/app/(app)/error.tsx" "src/app/(auth)/redefinir-senha/page.tsx"
bun -e 'console.log(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()))'
```

Expected: a branch `feat/fase-6-producao`; `git status` vazio; os commits das Tarefas 1, 2, 3, 4 e 5 (A e B) no log; os quatro arquivos existem; a data de hoje (a **DATA** das `Atualização` e dos históricos abaixo, onde as tarefas escrevem `<DATA>` entra a sua DATA; **substitua só os `<DATA>`: datas que já existem nos arquivos ficam como estão**). Se algum commit ou arquivo faltar, pare e reporte BLOCKED.

- [ ] **Step 1: Ler a documentação instalada e as regras da biblioteca**

Leia, em `node_modules/next/dist/docs/01-app/`: `03-api-reference/03-file-conventions/instrumentation.md` (`register` roda uma vez por instância; `onRequestError` recebe o erro lançado em Server Component, rota, Server Action e proxy), `03-api-reference/03-file-conventions/instrumentation-client.md` (roda antes da hidratação; `onRouterTransitionStart`), `03-api-reference/03-file-conventions/error.md` (o `global-error` substitui o layout raiz e precisa do próprio `<html>` e `<body>`; a prop de nova tentativa chama-se `retry` no Next 16.4) e `02-guides/instrumentation.md`. Depois, `.context/library-docs.md` (§0: se houver uma skill do Sentry instalada, carregue-a antes; confira a API na doc atual do pacote, porque a v11 mudou: `withSentryConfig` saiu do pacote raiz, `sendDefaultPii` não existe mais e o padrão de `dataCollection` coleta tudo). Nada a editar neste passo.

- [ ] **Step 2: Instalar `@sentry/nextjs` 11.18.0 (única chamada de rede da tarefa)**

Rode **em segundo plano desde o início** (no spike, o `bun add` morreu quando o shell o mandou para segundo plano por tempo):

```bash
bun add --exact @sentry/nextjs@11.18.0
```

Expected: `installed @sentry/nextjs@11.18.0` e `41 packages installed` (cerca de 13 s com o cache quente; no spike, 53 s). Depois confira o que mudou e as três coisas que o plano afirma sobre o pacote:

```bash
git status --short
git diff package.json
bun install --frozen-lockfile
grep -n 'name: "BrowserSession"' node_modules/@sentry/browser/build/npm/esm/prod/integrations/browsersession.js
grep -c "captureRouterTransitionStart" node_modules/@sentry/nextjs/build/esm/client/index.js
node --input-type=module -e 'const m = await import("@sentry/nextjs"); const c = await import("@sentry/nextjs/config"); console.log(typeof m.init, typeof m.captureException, typeof m.captureRequestError, typeof m.linkedErrorsIntegration, typeof c.withSentryConfig)'
```

Expected: `git status` mostra só ` M bun.lock` e ` M package.json`; o `diff` acrescenta só `"@sentry/nextjs": "11.18.0",` (sem `^`) em `dependencies`; `bun install --frozen-lockfile` termina sem erro e sem mudar o `bun.lock` (`git status` continua com os mesmos dois arquivos); o `grep -n` acha a linha 15 (`name: "BrowserSession",`, o nome que o `instrumentation-client.ts` filtra, Step 13; se o nome for outro, pare e reporte BLOCKED); o `grep -c` imprime `2` (o `captureRouterTransitionStart` existe no pacote do navegador); a última linha imprime `function function function function function`. O último comando usa o **Node**, de propósito: o `bun -e` escolhe a condição `bun` do pacote e procura um `@sentry/bun` que não está instalado (o Next e o Vitest rodam em Node).

- [ ] **Step 3: Escrever o teste do `scrubEvent` (falhando)**

Crie `src/lib/sentry/scrubEvent.test.ts`. Os eventos são objetos anotados como `ErrorEvent` (sem `as`) e os dados são fictícios; o teste cobre as sete regras do `scrubText`, o que o `scrubEvent` apaga, o que ele mantém (inclusive o caminho dos frames e o valor das tags, que passam pelo `scrubText`) e que o evento original nunca é mutado:

```ts
import type { ErrorEvent } from "@sentry/nextjs";
import { describe, expect, it } from "vitest";

import { REDACTED, scrubEvent, scrubText } from "./scrubEvent";

// Dados fictícios.
function fullEvent(): ErrorEvent {
  return {
    type: undefined,
    event_id: "abc",
    message: "falha para ana@exemplo.test em /convite/tok3n-secreto?x=1",
    logentry: {
      message: "falha para %s",
      params: ["ana@exemplo.test"],
    },
    transaction: "/convite/tok3n-secreto",
    server_name: "host-interno",
    sdk: {
      name: "sentry.javascript.nextjs",
      version: "11.18.0",
      settings: { infer_ip: "auto" },
    },
    user: { id: "u1", email: "ana@exemplo.test", ip_address: "10.0.0.1" },
    request: {
      url: "https://closery.vercel.app/convite/tok3n-secreto?email=a@b.test",
      query_string: "email=a@b.test",
      cookies: { "better-auth.session_token": "segredo" },
      headers: { cookie: "x=1", authorization: "Bearer y" },
      data: { senha: "hunter2" },
    },
    breadcrumbs: [{ category: "fetch", data: { url: "/api/x?token=1" } }],
    extra: { corpo: "livre" },
    tags: { url: "/convite/tok3n-secreto", runtime: "node" },
    contexts: {
      trace: { trace_id: "t", span_id: "s" },
      device: { name: "notebook da Ana" },
      os: { name: "Windows" },
    },
    exception: {
      values: [
        {
          type: "Error",
          value: "duplicado: ana@exemplo.test em /redefinir-senha/abc123?z=1",
          mechanism: {
            type: "auto.node.onerror",
            handled: false,
            data: { email: "ana@exemplo.test" },
          },
          stacktrace: {
            frames: [
              { filename: "app/a.ts", lineno: 1, vars: { senha: "hunter2" } },
            ],
          },
        },
      ],
    },
  };
}

describe("scrubText", () => {
  it("corta o SQL e os parâmetros do erro do Drizzle", () => {
    const text =
      'Failed query: insert into "user" ("email") values ($1)\nparams: ana@exemplo.test';

    expect(scrubText(text)).toBe(`Failed query: ${REDACTED}`);
  });

  it("corta tudo depois de `params:` numa mensagem reembrulhada", () => {
    expect(scrubText("falha ao salvar, params: ana@exemplo.test,x")).toBe(
      `falha ao salvar, params: ${REDACTED}`,
    );
  });

  it("esconde o valor que o Postgres repete em erro de tipo e de enum", () => {
    expect(scrubText('invalid input syntax for type uuid: "abc-da-ana"')).toBe(
      `invalid input syntax for type uuid: "${REDACTED}"`,
    );
    expect(scrubText('invalid input value for enum user_role: "chefe"')).toBe(
      `invalid input value for enum user_role: "${REDACTED}"`,
    );
  });

  it("esconde o token do caminho, do fragmento e a query string", () => {
    expect(scrubText("em /convite/tok3n e /redefinir-senha/abc?x=1")).toBe(
      `em /convite/${REDACTED} e /redefinir-senha/${REDACTED}`,
    );
    expect(scrubText("em /redefinir-senha#token=AbC_123-xyz ok")).toBe(
      `em /redefinir-senha#token=${REDACTED} ok`,
    );
  });

  it("esconde e-mail, inclusive com + e subdomínio", () => {
    expect(scrubText("a ana+piloto@mail.exemplo.test b")).toBe(
      `a ${REDACTED} b`,
    );
  });

  it("deixa em paz o texto sem dado de pessoa (inclusive `?` solto e vazio)", () => {
    expect(scrubText("Algo deu errado. E agora? Tente de novo")).toBe(
      "Algo deu errado. E agora? Tente de novo",
    );
    expect(scrubText("")).toBe("");
  });
});

describe("scrubEvent", () => {
  it("remove usuário, IP, cookies, cabeçalhos, corpo, query e servidor", () => {
    const out = scrubEvent(fullEvent());

    expect(out.user).toBeUndefined();
    expect(out.request).toBeUndefined();
    expect(out.server_name).toBeUndefined();
    expect(out.breadcrumbs).toBeUndefined();
    expect(out.extra).toBeUndefined();
    expect(JSON.stringify(out)).not.toMatch(
      /ana@|10\.0\.0\.1|hunter2|segredo|tok3n|abc123|Bearer|notebook/,
    );
    expect(out.sdk?.settings).toEqual({ infer_ip: "never" });
  });

  it("higieniza e-mail, token de rota e query na mensagem e no transaction", () => {
    const out = scrubEvent(fullEvent());

    expect(out.message).toBe(`falha para ${REDACTED} em /convite/${REDACTED}`);
    expect(out.transaction).toBe(`/convite/${REDACTED}`);
    expect(out.exception?.values?.[0]?.value).toBe(
      `duplicado: ${REDACTED} em /redefinir-senha/${REDACTED}`,
    );
  });

  it("higieniza o valor de toda exceção, inclusive as causas encadeadas", () => {
    const event = fullEvent();
    event.exception = {
      values: [
        {
          type: "Error",
          value: "Failed query: select 1 params: ana@exemplo.test",
        },
        { type: "Error", value: "causa: ana@exemplo.test" },
      ],
    };

    const values = scrubEvent(event).exception?.values ?? [];

    expect(values.map((value) => value.value)).toEqual([
      `Failed query: ${REDACTED}`,
      `causa: ${REDACTED}`,
    ]);
  });

  it("remove o logentry, os dados do mecanismo e as configurações do SDK", () => {
    const out = scrubEvent(fullEvent());

    expect(out.logentry).toBeUndefined();
    expect(out.exception?.values?.[0]?.mechanism).toEqual({
      type: "auto.node.onerror",
      handled: false,
    });
    expect(out.sdk).toEqual({
      name: "sentry.javascript.nextjs",
      version: "11.18.0",
      settings: { infer_ip: "never" },
    });
  });

  it("remove variáveis locais da pilha, mas mantém os frames", () => {
    const frame = scrubEvent(fullEvent()).exception?.values?.[0]?.stacktrace
      ?.frames?.[0];

    expect(frame).toEqual({ filename: "app/a.ts", lineno: 1 });
  });

  it("higieniza filename, abs_path e module de cada frame", () => {
    const event = fullEvent();
    const frames = event.exception?.values?.[0]?.stacktrace?.frames;
    frames?.push({
      abs_path: "https://app.example/redefinir-senha#token=abc123XYZ",
      filename: "https://app.example/equipe?pagina=2&busca=Ana",
      module: "https://app.example/convite/tok3n-secreto",
      lineno: 7,
    });

    const out = scrubEvent(event).exception?.values?.[0]?.stacktrace?.frames;

    expect(out?.[1]).toEqual({
      abs_path: "https://app.example/redefinir-senha#token=[removido]",
      filename: "https://app.example/equipe",
      module: "https://app.example/convite/[removido]",
      lineno: 7,
    });
    expect(JSON.stringify(out)).not.toMatch(/abc123XYZ|busca=Ana|tok3n/);
  });

  it("higieniza o valor de toda tag, não só as de chave com url", () => {
    const event = fullEvent();
    event.tags = {
      ...event.tags,
      rota: "/convite/tok3n-secreto",
      quem: "ana@exemplo.test",
      runtime: "node",
    };

    const out = scrubEvent(event);

    expect(out.tags).toEqual({
      rota: "/convite/[removido]",
      quem: "[removido]",
      runtime: "node",
    });
  });

  it("mantém o que ajuda a investigar: tipo, pilha, trace e tags sem URL", () => {
    const out = scrubEvent(fullEvent());

    expect(out.exception?.values?.[0]?.type).toBe("Error");
    expect(out.contexts).toEqual({
      trace: { trace_id: "t", span_id: "s" },
    });
    expect(out.tags).toEqual({ runtime: "node" });
  });

  it("não muta o evento original (nem o sdk, o mecanismo e os frames)", () => {
    const event = fullEvent();
    scrubEvent(event);

    expect(event.user).toBeDefined();
    expect(event.logentry).toBeDefined();
    expect(event.message).toContain("ana@");
    expect(event.sdk?.settings).toEqual({ infer_ip: "auto" });
    expect(event.exception?.values?.[0]?.mechanism?.data).toEqual({
      email: "ana@exemplo.test",
    });
    expect(event.exception?.values?.[0]?.stacktrace?.frames?.[0]?.vars).toEqual(
      { senha: "hunter2" },
    );
  });

  it("aceita evento mínimo, sem exception, tags nem contexts", () => {
    const event: ErrorEvent = { type: undefined, event_id: "x" };

    const out = scrubEvent(event);

    expect(out.event_id).toBe("x");
    expect(out.contexts).toEqual({});
  });

  it("aceita exception sem valor, sem pilha e sem mecanismo", () => {
    const event: ErrorEvent = {
      type: undefined,
      exception: { values: [{ type: "Error" }] },
    };

    const out = scrubEvent(event);

    expect(out.exception?.values?.[0]).toEqual({ type: "Error" });
  });
});
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `bun run test -- src/lib/sentry/scrubEvent.test.ts`
Expected: FAIL: `Test Files  1 failed (1)`, `Tests  no tests`, com `Error: Cannot find module './scrubEvent' imported from …/src/lib/sentry/scrubEvent.test.ts`.

- [ ] **Step 5: Implementar o `scrubEvent`**

Crie `src/lib/sentry/scrubEvent.ts`. A função é pura e **sem import de runtime** (só `import type`), porque roda no servidor e no navegador. A ordem do `scrubText` importa: o SQL e os parâmetros do Drizzle saem primeiro (o `DrizzleQueryError` carrega no `message` `Failed query: <sql> params: <valores>`, que podem ser e-mail, hash de token ou texto da passagem), antes de qualquer outro padrão. A cópia do evento é **rasa**: `sdk`, `exception`, o mecanismo e os frames são refeitos, nunca alterados no objeto original (`delete scrubbed.sdk.settings` mudaria o objeto do original, porque `sdk` é compartilhado). O `sdk.settings` **não é apagado, é forçado a `{ infer_ip: "never" }`**: o `BrowserClient` do `@sentry/browser` 11.18 grava `sdk.settings = { infer_ip: userInfo ? "auto" : "never" }` e o core mescla essa metadata de volta no evento depois do `beforeSend`, então apagar a chave não muda o envelope e, se a mescla mudasse, o Relay inferiria o IP (plataforma `javascript` sem a configuração). A segunda camada é a opção "Prevent Storing of IP Addresses" do projeto (runbook, B3):

```ts
import type { ErrorEvent } from "@sentry/nextjs";

// Função pura, sem import de runtime: roda no servidor e no navegador. Última
// barreira antes do envio ao Sentry (LGPD: o serviço fica fora do país). O
// evento sai só com tipo do erro, mensagem já higienizada, pilha, rota e
// ambiente; nada de pessoa, IP, cookie, cabeçalho, corpo ou query string.
// Só limpa os padrões conhecidos abaixo (P69): o que escapar deles sai.

export const REDACTED = "[removido]";

// O erro do Drizzle carrega no `message` o SQL e os parâmetros inteiros
// ("Failed query: ... params: ..."), com e-mail, hash de token, texto da
// passagem. Tudo do `Failed query:` em diante é descartado.
const FAILED_QUERY = /Failed query:[\s\S]*/g;
// Mensagem reembrulhada por outra camada: só os parâmetros chegam.
const PARAMS = /params:[\s\S]*/g;
// O Postgres repete o valor que recusou: `invalid input syntax for type uuid: "x"`.
const INVALID_INPUT =
  /(invalid input (?:syntax|value) for (?:type|enum) [^\s:]+: )"[^"]*"/g;
// O token do convite e do link de redefinição vai no caminho da URL.
const TOKEN_PATH = /\/(convite|redefinir-senha)\/[^/?#\s"']+/g;
// ...e o do link de redefinição, no fragmento (`#token=`).
const TOKEN_FRAGMENT = /#token=[^\s"']*/g;
const QUERY = /\?[^\s"']+/g;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

// A ordem importa: o SQL e os parâmetros saem antes de qualquer outro padrão.
export function scrubText(text: string): string {
  return text
    .replace(FAILED_QUERY, `Failed query: ${REDACTED}`)
    .replace(PARAMS, `params: ${REDACTED}`)
    .replace(INVALID_INPUT, `$1"${REDACTED}"`)
    .replace(TOKEN_PATH, `/$1/${REDACTED}`)
    .replace(TOKEN_FRAGMENT, `#token=${REDACTED}`)
    .replace(QUERY, "")
    .replace(EMAIL, REDACTED);
}

type ExceptionValue = NonNullable<
  NonNullable<ErrorEvent["exception"]>["values"]
>[number];

type Frame = NonNullable<
  NonNullable<ExceptionValue["stacktrace"]>["frames"]
>[number];

// Num script embutido do navegador o frame carrega a URL da página (com
// `?query`, `/convite/<token>` ou `#token=`): os três campos de caminho passam
// pelo mesmo scrubText.
function scrubFrame(frame: Frame): Frame {
  const scrubbed: Frame = { ...frame };
  if (frame.filename !== undefined) {
    scrubbed.filename = scrubText(frame.filename);
  }
  if (frame.abs_path !== undefined) {
    scrubbed.abs_path = scrubText(frame.abs_path);
  }
  if (frame.module !== undefined) scrubbed.module = scrubText(frame.module);
  return scrubbed;
}

// Uma exceção (a principal e cada causa que o linkedErrors junta): o texto
// higienizado, sem os dados do mecanismo e sem as variáveis locais da pilha.
function scrubException(value: ExceptionValue): ExceptionValue {
  const { mechanism, stacktrace, ...rest } = value;
  const scrubbed: ExceptionValue = { ...rest };
  if (value.value !== undefined) scrubbed.value = scrubText(value.value);
  if (mechanism) {
    const { data: _data, ...safeMechanism } = mechanism;
    scrubbed.mechanism = safeMechanism;
  }
  if (stacktrace) {
    scrubbed.stacktrace = {
      ...stacktrace,
      frames: stacktrace.frames?.map(({ vars: _vars, ...frame }) =>
        scrubFrame(frame),
      ),
    };
  }
  return scrubbed;
}

// Cópia rasa: tudo o que muda é refeito (sdk, exception, mecanismo, frames),
// nunca alterado no objeto original.
export function scrubEvent<T extends ErrorEvent>(event: T): T {
  const scrubbed: T = { ...event };

  delete scrubbed.user;
  delete scrubbed.request;
  delete scrubbed.server_name;
  delete scrubbed.breadcrumbs;
  delete scrubbed.extra;
  delete scrubbed.logentry;

  if (scrubbed.sdk) {
    // O cliente do navegador põe `sdk.settings.infer_ip` ("auto" se houver
    // usuário) e o core o mescla de volta depois do beforeSend; apagar a chave
    // não adianta e, sem ela, o Relay inferiria o IP: força "never".
    const { settings: _settings, ...sdk } = scrubbed.sdk;
    scrubbed.sdk = { ...sdk, settings: { infer_ip: "never" } };
  }

  if (scrubbed.message) scrubbed.message = scrubText(scrubbed.message);
  if (scrubbed.transaction) {
    scrubbed.transaction = scrubText(scrubbed.transaction);
  }

  if (scrubbed.exception?.values) {
    scrubbed.exception = {
      ...scrubbed.exception,
      values: scrubbed.exception.values.map(scrubException),
    };
  }

  // Só o que ajuda a achar o erro; contextos de dispositivo, SO, culture etc.
  // e tags com URL ficam de fora; o valor das demais tags passa pelo scrubText.
  scrubbed.contexts = scrubbed.contexts?.trace
    ? { trace: scrubbed.contexts.trace }
    : {};
  if (scrubbed.tags) {
    scrubbed.tags = Object.fromEntries(
      Object.entries(scrubbed.tags)
        .filter(([key]) => !key.toLowerCase().includes("url"))
        .map(([key, value]) => [
          key,
          typeof value === "string" ? scrubText(value) : value,
        ]),
    );
  }

  return scrubbed;
}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `bun run test -- src/lib/sentry/scrubEvent.test.ts`
Expected: PASS: `Test Files  1 passed (1)` e `Tests  17 passed (17)`.

- [ ] **Step 7: Escrever o teste do `sentryOptions` e da captura sem conta (falhando)**

Crie `src/lib/sentry/options.test.ts`. O transporte falso guarda `JSON.stringify(envelope)` (nunca abre conexão) e o teste afirma sobre o **texto** e sobre um `JSON.parse` com guarda de tipo (sem `as`). O caso do Drizzle usa um `DrizzleQueryError` real, com a causa do `pg`, e a `linkedErrorsIntegration` (que junta a causa como segunda exceção do evento): é a prova de que nem o SQL, nem o parâmetro `ana@exemplo.test`, nem o e-mail da mensagem do Postgres saem:

```ts
import * as Sentry from "@sentry/nextjs";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterEach, describe, expect, it, vi } from "vitest";

import { sentryOptions } from "./options";
import { scrubEvent } from "./scrubEvent";

// Prova a captura sem conta: DSN falso + transporte que só guarda o envelope
// (como texto) e nunca abre uma conexão.
const FAKE_DSN = "https://public@o0.ingest.sentry.io/0";

type StartedSentry = { sent: string[] };

function startSentry(
  dsn: string | undefined,
  integrations: Sentry.NodeOptions["integrations"] = [],
): StartedSentry {
  const sent: string[] = [];
  Sentry.init(
    sentryOptions({
      dsn,
      enabled: Boolean(dsn),
      defaultIntegrations: false,
      integrations,
      transport: () => ({
        send: async (envelope) => {
          sent.push(JSON.stringify(envelope));
          return { statusCode: 200 };
        },
        flush: async () => true,
      }),
    }),
  );
  return { sent };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// O envelope é [cabeçalho, [[cabeçalho do item, carga], ...]]: devolve só as
// cargas dos itens do tipo "event".
function sentEvents(sent: string[]): Record<string, unknown>[] {
  const events: Record<string, unknown>[] = [];
  for (const text of sent) {
    const envelope: unknown = JSON.parse(text);
    const items: unknown = Array.isArray(envelope) ? envelope[1] : undefined;
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      if (
        Array.isArray(item) &&
        isRecord(item[0]) &&
        item[0].type === "event" &&
        isRecord(item[1])
      ) {
        events.push(item[1]);
      }
    }
  }
  return events;
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await Sentry.close();
});

describe("sentryOptions", () => {
  it("sem DSN fica desligado e nada é enviado", async () => {
    const options = sentryOptions({ dsn: undefined, enabled: false });
    const { sent } = startSentry(undefined);

    Sentry.captureException(new Error("sem dsn"));
    await Sentry.flush(1000);

    expect(options.enabled).toBe(false);
    expect(sent).toEqual([]);
  });

  it("não liga performance, replay nem breadcrumbs", () => {
    const options = sentryOptions();

    expect(options.tracesSampleRate).toBe(0);
    expect(options.maxBreadcrumbs).toBe(0);
    expect(options).not.toHaveProperty("replaysSessionSampleRate");
    expect(options).not.toHaveProperty("replaysOnErrorSampleRate");
  });

  it("desliga toda coleta de dados pessoais (dataCollection)", () => {
    expect(sentryOptions().dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
    });
  });

  it("o SDK resolve toda a coleta como desligada", () => {
    startSentry(FAKE_DSN);
    const leaves = (value: unknown): unknown[] =>
      typeof value === "object" && value !== null && !Array.isArray(value)
        ? Object.values(value).flatMap(leaves)
        : [value];
    const resolved = Sentry.getClient()?.getDataCollectionOptions();
    expect(resolved).toBeDefined();
    // `frameContextLines` é um número (linhas de código-fonte ao redor do
    // frame, que o scrubEvent mantém), não uma coleta de dado de pessoa.
    const { frameContextLines: _lines, ...collected } = resolved ?? {};
    for (const leaf of leaves(collected)) {
      expect(leaf === false || (Array.isArray(leaf) && leaf.length === 0)).toBe(
        true,
      );
    }
  });

  it("limpa o evento pelo scrubEvent antes do envio", () => {
    expect(sentryOptions().beforeSend).toBe(scrubEvent);
  });

  it("o ambiente é o da Vercel, ou o do Node fora dela", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect(sentryOptions().environment).toBe("production");

    vi.stubEnv("VERCEL_ENV", undefined);
    expect(sentryOptions().environment).toBe("test");
  });

  it("os overrides valem por último", () => {
    const options = sentryOptions({ maxBreadcrumbs: 5, enabled: true });

    expect(options.maxBreadcrumbs).toBe(5);
    expect(options.enabled).toBe(true);
  });

  it("com DSN, um erro lançado vira evento já sem dado pessoal", async () => {
    const { sent } = startSentry(FAKE_DSN);

    Sentry.setUser({
      id: "u1",
      email: "ana@exemplo.test",
      ip_address: "{{auto}}",
    });
    Sentry.addBreadcrumb({ message: "clicou em ana@exemplo.test" });
    Sentry.withScope((scope) => {
      scope.setExtra("corpo", "senha=hunter2");
      scope.setTag("url", "/convite/tok3n");
      Sentry.captureException(
        new Error(
          "falha ao salvar para ana@exemplo.test em /convite/tok3n?x=1",
        ),
      );
    });
    await Sentry.flush(1000);

    const events = sentEvents(sent);
    expect(events).toHaveLength(1);
    const json = JSON.stringify(events[0]);
    expect(json).toContain("falha ao salvar");
    expect(json).not.toMatch(/ana@|hunter2|tok3n|ip_address|clicou/);
    expect(events[0]?.user).toBeUndefined();
    expect(events[0]?.request).toBeUndefined();
  });

  it("o erro do Drizzle sai sem o SQL, sem os parâmetros e sem a causa do pg", async () => {
    const { sent } = startSentry(FAKE_DSN, [Sentry.linkedErrorsIntegration()]);
    const cause = Object.assign(
      new Error(
        'duplicate key value violates unique constraint "user_email_key"\nKey (email)=(ana@exemplo.test) already exists.',
      ),
      { code: "23505" },
    );

    Sentry.captureException(
      new DrizzleQueryError(
        'insert into "user" ("email") values ($1)',
        ["ana@exemplo.test"],
        cause,
      ),
    );
    await Sentry.flush(1000);

    const events = sentEvents(sent);
    expect(events).toHaveLength(1);
    const json = JSON.stringify(events[0]);
    expect(json).toContain("Failed query: [removido]");
    expect(json).toContain("duplicate key value violates unique constraint");
    expect(json).not.toMatch(/insert|\$1|params: ana|ana@/);
  });
});
```

- [ ] **Step 8: Rodar e ver falhar**

Run: `bun run test -- src/lib/sentry/options.test.ts`
Expected: FAIL: `Test Files  1 failed (1)`, `Tests  no tests`, com `Error: Cannot find module './options' imported from …/src/lib/sentry/options.test.ts`.

- [ ] **Step 9: Implementar o `sentryOptions`**

Crie `src/lib/sentry/options.ts`. No `@sentry/nextjs` 11 o `sendDefaultPii` **não existe mais** e o padrão de `dataCollection` coleta tudo; por isso o objeto abaixo desliga cada chave por nome (o teste `desliga toda coleta de dados pessoais` compara o objeto que passamos; o teste `o SDK resolve toda a coleta como desligada` pergunta ao cliente iniciado o que ele resolveu e reprova se uma versão futura acrescentar uma chave com padrão "coletar"). Sem Replay, sem tracing, sem breadcrumbs:

```ts
import type { NodeOptions } from "@sentry/nextjs";

import { scrubEvent } from "./scrubEvent";

// Um DSN só, público por natureza (só permite ENVIAR eventos). Sem a variável
// o Sentry não é iniciado e nada sai da máquina. Como NEXT_PUBLIC_*, o valor é
// gravado no build: trocar o DSN exige novo deploy.
export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

// Opções comuns ao servidor e ao navegador. No @sentry/nextjs 11 o
// `sendDefaultPii` não existe mais e o padrão de `dataCollection` coleta TUDO
// (cookies, cabeçalhos, corpos, query); por isso fica tudo desligado aqui.
export function sentryOptions(
  overrides: Partial<NodeOptions> = {},
): NodeOptions {
  return {
    dsn: SENTRY_DSN,
    enabled: Boolean(SENTRY_DSN),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    maxBreadcrumbs: 0,
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
      databaseQueryData: false,
      queues: false,
      stackFrameVariables: false,
      graphQL: { document: false, variables: false },
      genAI: { inputs: false, outputs: false },
      mcp: { inputs: false, outputs: false },
    },
    beforeSend: scrubEvent,
    ...overrides,
  };
}
```

- [ ] **Step 10: Rodar e ver passar; provar que o teste pega o defeito**

Run: `bun run test -- src/lib/sentry/options.test.ts`
Expected: PASS: `Test Files  1 passed (1)` e `Tests  9 passed (9)`.

Agora a prova de que a captura de verdade passa pelo `scrubEvent` (e que o teste não é decorativo). Troque **temporariamente** em `src/lib/sentry/options.ts` a linha `beforeSend: scrubEvent,` por `beforeSend: (event) => event,` e rode de novo:

Run: `bun run test -- src/lib/sentry/options.test.ts`
Expected: FAIL com 3 testes: `limpa o evento pelo scrubEvent antes do envio` (`expected [Function beforeSend] to be [Function scrubEvent]`), `com DSN, um erro lançado vira evento já sem dado pessoal` (`expected '{"exception":{"values":[{"type":"Erro…' not to match /ana@|hunter2|tok3n|ip_address|clicou/`) e `o erro do Drizzle sai sem o SQL…` (`expected '{"exception":{"values":[{"type":"Erro…' to contain 'Failed query: [removido]'`). **Desfaça a troca** (volte a `beforeSend: scrubEvent,`) e rode uma última vez: `Tests  9 passed (9)`.

- [ ] **Step 11: Escrever o teste do `instrumentation` e do `instrumentation-client` (falhando)**

Crie `src/instrumentation.test.ts`. O SDK é trocado por espiões (`vi.mock("@sentry/nextjs")`): o teste prova só a fiação, a captura de verdade já está no Step 7. O cliente é carregado com `vi.resetModules()` + `import()` dinâmico, porque o arquivo chama `Sentry.init` ao ser importado; o `scrubEvent` que o teste compara é lido **depois** do reset (o reset dá ao cliente uma cópia nova do módulo). O nome `BrowserSession` é o confirmado no Step 2: a `browserSessionIntegration` padrão manda um envelope de sessão ao `sentry.io` a **cada carga de página**, mesmo sem erro, com IP e navegador (contra a minimização e contra o texto de `/privacidade`):

```ts
import type { NodeOptions } from "@sentry/nextjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { scrubEvent } from "@/lib/sentry/scrubEvent";

import { onRequestError, register } from "./instrumentation";

// O SDK é trocado por espiões: o teste prova só a fiação (quando inicia e com
// quais opções), nunca fala com o Sentry. A captura de verdade está provada em
// src/lib/sentry/options.test.ts.
const sentry = vi.hoisted(() => ({
  init: vi.fn<(options: NodeOptions) => void>(),
  captureRequestError: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => sentry);

beforeEach(() => {
  sentry.init.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("instrumentation.ts (servidor)", () => {
  it("inicia o Sentry uma vez no runtime nodejs, com o scrubEvent", () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");

    register();

    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init.mock.calls[0]?.[0].beforeSend).toBe(scrubEvent);
  });

  it("não inicia no runtime edge", () => {
    vi.stubEnv("NEXT_RUNTIME", "edge");

    register();

    expect(sentry.init).not.toHaveBeenCalled();
  });

  it("não inicia quando o runtime não está definido", () => {
    vi.stubEnv("NEXT_RUNTIME", undefined);

    register();

    expect(sentry.init).not.toHaveBeenCalled();
  });

  it("o erro lançado no servidor chega pelo captureRequestError", () => {
    expect(onRequestError).toBe(sentry.captureRequestError);
  });
});

describe("instrumentation-client.ts (navegador)", () => {
  // O resetModules faz o módulo do cliente enxergar uma cópia nova do
  // scrubEvent: o teste lê a mesma cópia depois de carregar o cliente.
  async function loadClient() {
    vi.resetModules();
    const client = await import("./instrumentation-client");
    const { scrubEvent: loadedScrubEvent } = await import(
      "@/lib/sentry/scrubEvent"
    );
    return { client, loadedScrubEvent };
  }

  it("inicia o Sentry uma vez ao carregar, com o scrubEvent", async () => {
    const { loadedScrubEvent } = await loadClient();

    expect(sentry.init).toHaveBeenCalledTimes(1);
    expect(sentry.init.mock.calls[0]?.[0].beforeSend).toBe(loadedScrubEvent);
  });

  it("tira a integração BrowserSession (sessão a cada página) e mantém as outras", async () => {
    await loadClient();

    const integrations = sentry.init.mock.calls[0]?.[0].integrations;
    if (typeof integrations !== "function") {
      throw new Error("integrations deveria ser uma função");
    }
    const names = integrations([
      { name: "BrowserSession" },
      { name: "GlobalHandlers" },
      { name: "LinkedErrors" },
    ]).map((integration) => integration.name);

    expect(names).toEqual(["GlobalHandlers", "LinkedErrors"]);
  });

  it("exporta o gancho de navegação do SDK", async () => {
    const { client } = await loadClient();

    expect(client.onRouterTransitionStart).toBe(
      sentry.captureRouterTransitionStart,
    );
  });
});
```

- [ ] **Step 12: Rodar e ver falhar**

Run: `bun run test -- src/instrumentation.test.ts`
Expected: FAIL: `Test Files  1 failed (1)`, `Tests  no tests`, com `Error: Cannot find module '/src/instrumentation' imported from …/src/instrumentation.test.ts`.

- [ ] **Step 13: Implementar `instrumentation.ts` e `instrumentation-client.ts`**

Crie `src/instrumentation.ts`. O `proxy.ts` do Next 16 roda em Node, então só o runtime `nodejs` inicia o SDK; `onRequestError` recebe o erro **lançado** no servidor (Server Component, Server Action, Route Handler e proxy; o Turbopack não embrulha rotas nem o proxy, o `onRequestError` é o caminho):

```ts
import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/sentry/options";

// Roda uma vez por instância do servidor. O proxy.ts do Next 16 roda em Node,
// então não há runtime edge para iniciar. Sem DSN, `enabled: false`: nada sai.
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init(sentryOptions());
  }
}

// Erros de Server Components, Route Handlers, Server Actions e do proxy.
export const onRequestError = Sentry.captureRequestError;
```

Crie `src/instrumentation-client.ts`:

```ts
import * as Sentry from "@sentry/nextjs";

import { sentryOptions } from "@/lib/sentry/options";

// Sem Session Replay e sem integrações de performance: só erros do navegador.
// A `BrowserSession` (padrão) manda um envelope de sessão ao sentry.io a cada
// carga de página, mesmo sem erro, com IP e navegador: fica de fora.
Sentry.init(
  sentryOptions({
    integrations: (defaults) =>
      defaults.filter((integration) => integration.name !== "BrowserSession"),
  }),
);

// Inerte com tracesSampleRate 0; fica para quando o tracing for ligado.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```

- [ ] **Step 14: Rodar e ver passar**

Run: `bun run test -- src/instrumentation.test.ts`
Expected: PASS: `Test Files  1 passed (1)` e `Tests  7 passed (7)`.

- [ ] **Step 15: Escrever as provas da captura no `logServerError` (falhando)**

Edite `src/lib/logServerError.test.ts` em três pontos. Primeiro, o espião do SDK, logo antes de `SECRET` (o arquivo todo passa a depender de `vi.mock`, içado pelo Vitest):

Edit em `src/lib/logServerError.test.ts`:

`old_string`:

```ts
import { logServerError, summarizeError } from "./logServerError";

const SECRET = "ana@exemplo.test";
```

`new_string`:

```ts
import { logServerError, summarizeError } from "./logServerError";

// O SDK é trocado por um espião: aqui só se prova QUANDO o log captura no
// Sentry; o que sai no evento está provado em src/lib/sentry/options.test.ts.
const sentry = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => sentry);

const SECRET = "ana@exemplo.test";
```

Depois, o `beforeEach` do `describe` de hoje zera o espião (os testes antigos continuam como estão):

Edit em `src/lib/logServerError.test.ts`:

`old_string`:

```ts
describe("logServerError", () => {
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    spy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
```

`new_string`:

```ts
describe("logServerError", () => {
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    spy = vi.spyOn(console, "error").mockImplementation(() => {});
    sentry.captureException.mockReset();
  });
```

Por fim, acrescente **no fim do arquivo**, depois do último `});` e de uma linha em branco, o `describe` novo:

````ts
describe("logServerError: captura no Sentry (Fase 6)", () => {
  let spy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    spy = vi.spyOn(console, "error").mockImplementation(() => {});
    sentry.captureException.mockReset();
  });
  afterEach(() => spy.mockRestore());

  it("captura uma vez, com o erro e o contexto como tag", () => {
    const error = new Error("falha");

    logServerError(error, "runAction");

    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { context: "runAction" },
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("a tag leva o contexto já cortado em 80 caracteres", () => {
    logServerError(new Error("x"), "c".repeat(500));

    expect(sentry.captureException).toHaveBeenCalledWith(expect.any(Error), {
      tags: { context: "c".repeat(80) },
    });
  });

  it("erro com digest não é capturado de novo (o servidor já o reportou), mas a linha sai", () => {
    const error = Object.assign(new Error("render"), { digest: "123456" });

    logServerError(error, "error-boundary");

    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("sem erro (null ou undefined) escreve a linha e não captura", () => {
    logServerError(null, "better-auth:ip-desconhecido");
    logServerError(undefined, "x");

    expect(sentry.captureException).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(spy.mock.calls[0]?.[0]))).toEqual({
      level: "error",
      context: "better-auth:ip-desconhecido",
      name: "NonError",
      code: null,
      digest: null,
    });
  });

  it("valor que não é Error também é capturado (só o erro null e undefined não)", () => {
    logServerError("texto solto", "x");
    logServerError(0, "x");

    expect(sentry.captureException).toHaveBeenCalledTimes(2);
  });

  it("captureException que lança não quebra o log nem lança", () => {
    sentry.captureException.mockImplementation(() => {
      throw new Error("sentry fora do ar");
    });

    expect(() => logServerError(new Error("falha"), "runAction")).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
````

- [ ] **Step 16: Rodar e ver falhar**

Run: `bun run test -- src/lib/logServerError.test.ts`
Expected: FAIL: `Test Files  1 failed (1)` e `Tests  3 failed | 11 passed (14)`: falham `captura uma vez, com o erro e o contexto como tag` (`expected "vi.fn()" to be called 1 times, but got 0 times`), `a tag leva o contexto já cortado em 80 caracteres` (`expected "vi.fn()" to be called with arguments: [ Any<Error>, …(1) ]`) e `valor que não é Error também é capturado…` (`expected "vi.fn()" to be called 2 times, but got 0 times`). Os outros 11 (os 8 de hoje e os 3 que provam que **não** captura) passam hoje por não haver captura nenhuma: são as provas negativas, que só valem depois do Step 17.

- [ ] **Step 17: Capturar no `logServerError`**

Edite `src/lib/logServerError.ts` em três pontos. O import (o módulo passa a ter **um** import de runtime; os limites de erro do cliente também o usam, e o pacote já está no bundle do navegador pelo `instrumentation-client.ts`):

Edit em `src/lib/logServerError.ts`:

`old_string`:

```ts
// Log de erro sem vazamento. Um erro do Drizzle carrega no `message` o SQL e os
```

`new_string`:

```ts
import * as Sentry from "@sentry/nextjs";

// Log de erro sem vazamento. Um erro do Drizzle carrega no `message` o SQL e os
```

O comentário do cabeçalho:

Edit em `src/lib/logServerError.ts`:

`old_string`:

```ts
// client também usam (lá só o digest existe).
```

`new_string`:

```ts
// client também usam (lá só o digest existe).
//
// É também o ÚNICO ponto que manda erro TRATADO ao Sentry (o erro lançado no
// servidor chega pelo onRequestError do instrumentation.ts): o que não passa
// por aqui não vai, e o que vai passa pelo scrubEvent. Sem DSN o Sentry nem é
// iniciado e a captura não faz nada.
```

E a função. Calcula-se o contexto cortado e o resumo **uma vez** e usam-se nas duas saídas; `null`/`undefined` (o aviso de IP do Better Auth, Tarefa 4) só escrevem a linha; erro com `digest` veio da renderização do servidor, que já o reportou pelo `onRequestError` (sem este pulo, cada erro de renderização contaria duas vezes na cota de 5 mil por mês); o `try/catch` garante que o log nunca lança:

Edit em `src/lib/logServerError.ts`:

`old_string`:

```ts
// Uma linha de JSON: a Vercel indexa os campos e o Sentry (depois) lê igual.
export function logServerError(error: unknown, context: string): void {
  console.error(
    JSON.stringify({
      level: "error",
      context: context.slice(0, CONTEXT_MAX_LENGTH),
      ...summarizeError(error),
    }),
  );
}
```

`new_string`:

```ts
// Uma linha de JSON: a Vercel indexa os campos e o Sentry (depois) lê igual.
// Captura só erro de verdade (null e undefined, como o aviso de IP do Better
// Auth, só escrevem a linha) e só quando não há digest: um erro com digest
// veio da renderização do servidor, que já o reportou pelo onRequestError, e
// a cópia que chega ao navegador só tem a mensagem genérica.
export function logServerError(error: unknown, context: string): void {
  const safeContext = context.slice(0, CONTEXT_MAX_LENGTH);
  const summary = summarizeError(error);
  console.error(
    JSON.stringify({ level: "error", context: safeContext, ...summary }),
  );
  if (error === null || error === undefined || summary.digest !== null) return;
  try {
    Sentry.captureException(error, { tags: { context: safeContext } });
  } catch {
    // O log nunca pode lançar: a linha acima já foi escrita.
  }
}
```

- [ ] **Step 18: Rodar e ver passar (e os vizinhos do `logServerError`)**

Run: `bun run test -- src/lib/logServerError.test.ts`
Expected: PASS: `Test Files  1 passed (1)` e `Tests  14 passed (14)`.

Os arquivos que chamam o `logServerError` agora carregam o `@sentry/nextjs` de verdade (sem `init`, `captureException` não faz nada); confirme que continuam verdes, inclusive no jsdom dos limites de erro:

Run: `bun run test -- src/app/error.test.tsx "src/app/(app)/error.test.tsx" src/features/admin/runAction.test.ts src/app/api/health/route.test.ts src/lib/auth`
Expected: PASS em todos os arquivos (`Test Files  15 passed (15)` e `Tests  175 passed (175)`, medido na validação com as Tarefas 4 e 5 reais; **nenhum** falha).

- [ ] **Step 19: Escrever o teste do `global-error` (falhando)**

Crie `src/app/global-error.test.tsx`. O `logServerError` é trocado por um espião (a captura já está provada no Step 15). No jsdom o React 19 renderiza `<html>` e `<body>` nos singletons do `document` (não há RSC): o único `console.error` aceito é o aviso `In HTML, %s cannot be a child of <%s>`, e o `afterEach` reprova qualquer outro. O `<title>` do React 19 vai para o `<head>`, então `document.title` o enxerga:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";

import GlobalError from "@/app/global-error";

// O limite de erro é trocado por um espião: aqui só se prova que o
// global-error chama o ponto único de log (a captura no Sentry mora lá).
const logging = vi.hoisted(() => ({ logServerError: vi.fn() }));
vi.mock("@/lib/logServerError", () => logging);

// No jsdom o React 19 renderiza <html> e <body> nos singletons do document
// (não há RSC). O único aviso aceito é o de <html> dentro de <div>: qualquer
// outro console.error reprova o teste.
const HTML_NESTING_WARNING = "In HTML, %s cannot be a child of <%s>";

let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  logging.logServerError.mockClear();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  const unexpected = consoleError.mock.calls.filter(
    ([message]) =>
      typeof message !== "string" || !message.startsWith(HTML_NESTING_WARNING),
  );
  consoleError.mockRestore();
  expect(unexpected).toEqual([]);
});

describe("global-error.tsx", () => {
  it("é o documento inteiro: lang pt-BR, título e a mensagem", () => {
    render(<GlobalError error={new Error("falha")} retry={vi.fn()} />);

    expect(document.documentElement.lang).toBe("pt-BR");
    expect(document.title).toBe("Algo deu errado");
    expect(
      screen.getByRole("heading", { name: "Algo deu errado" }),
    ).toBeInTheDocument();
  });

  it("'Tentar de novo' chama retry uma vez", async () => {
    const retry = vi.fn();
    render(<GlobalError error={new Error("falha")} retry={retry} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" }),
    );

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("registra o erro uma vez pelo logServerError, com o contexto global-error", () => {
    const error = new Error("falha");

    render(<GlobalError error={error} retry={vi.fn()} />);

    expect(logging.logServerError).toHaveBeenCalledTimes(1);
    expect(logging.logServerError).toHaveBeenCalledWith(error, "global-error");
  });

  it("nunca mostra a mensagem do erro", () => {
    render(
      <GlobalError
        error={new Error("senha do banco: hunter2")}
        retry={vi.fn()}
      />,
    );

    expect(screen.queryByText(/hunter2/)).not.toBeInTheDocument();
  });

  it("aceita erro que não é Error (o tipo da prop é unknown)", () => {
    render(<GlobalError error="texto solto" retry={vi.fn()} />);

    expect(screen.getByText("Algo deu errado")).toBeInTheDocument();
    expect(logging.logServerError).toHaveBeenCalledWith(
      "texto solto",
      "global-error",
    );
  });
});
```

- [ ] **Step 20: Rodar e ver falhar**

Run: `bun run test -- src/app/global-error.test.tsx`
Expected: FAIL: `Test Files  1 failed (1)`, `Tests  no tests`, com `Error: Failed to resolve import "@/app/global-error" from "src/app/global-error.test.tsx". Does the file exist?`.

- [ ] **Step 21: Implementar o `global-error.tsx`**

Crie `src/app/global-error.tsx`. É o último limite de erro: substitui o layout raiz, por isso traz o próprio documento e importa o CSS global (o layout não está ativo). Usa o `Button` do shadcn (não um `<button>` cru), o `<title>` do React 19 (limite de erro não aceita `metadata`) e **não** chama o Sentry direto: o erro vai pelo `logServerError`, o ponto único (F6-13), e a mensagem do erro nunca aparece:

```tsx
"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { logServerError } from "@/lib/logServerError";

import "./globals.css";

type GlobalErrorProps = {
  error: unknown;
  retry: () => void;
};

// Substitui o layout raiz quando ele mesmo quebra: precisa do próprio
// <html><body> e importa o CSS global (o layout não está ativo). Limite de erro
// não aceita `metadata`: o <title> é o do React 19 (vai para o <head>). O erro
// vai pelo logServerError (ponto único do log e do Sentry) e a mensagem dele
// nunca aparece na tela.
export default function GlobalError({ error, retry }: GlobalErrorProps) {
  useEffect(() => {
    logServerError(error, "global-error");
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className="flex min-h-full flex-col">
        <title>Algo deu errado</title>
        <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Algo deu errado
          </h1>
          <Button onClick={() => retry()}>Tentar de novo</Button>
        </main>
      </body>
    </html>
  );
}
```

- [ ] **Step 22: Rodar e ver passar; conferir o React Compiler**

Run: `bun run test -- src/app/global-error.test.tsx`
Expected: PASS: `Test Files  1 passed (1)` e `Tests  5 passed (5)`.

Run: `bun scripts/rc-check.mjs src/app/global-error.tsx`
Expected: `src/app/global-error.tsx compiled: 1 other events: []` e código de saída 0 (o React Compiler desiste em silêncio de um componente que não consegue compilar; o `bun run build` não avisa).

- [ ] **Step 23: Estender o guarda do console para o Sentry**

Edite `test/logGuard.test.ts`. O cabeçalho e a lista dos cinco arquivos que podem importar o Sentry:

Edit em `test/logGuard.test.ts`:

`old_string`:

```ts
// por src/lib/logServerError.ts (resumo sem mensagem, pilha nem objeto).

const LOGGER = "src/lib/logServerError.ts";
```

`new_string`:

```ts
// por src/lib/logServerError.ts (resumo sem mensagem, pilha nem objeto). O
// mesmo vale para o Sentry: nenhum outro arquivo o importa, então nada sai sem
// passar pelo scrubEvent (beforeSend) nem pelo resumo do log.

const LOGGER = "src/lib/logServerError.ts";
const SENTRY_IMPORTERS = [
  "src/instrumentation-client.ts",
  "src/instrumentation.ts",
  "src/lib/logServerError.ts",
  "src/lib/sentry/options.ts",
  "src/lib/sentry/scrubEvent.ts",
];
```

E os dois testes novos, no fim do `describe`:

Edit em `test/logGuard.test.ts`:

`old_string`:

```ts
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain(LOGGER);
  });
});
```

`new_string`:

```ts
    expect(files.length).toBeGreaterThan(100);
    expect(files).toContain(LOGGER);
  });

  it("@sentry/nextjs só entra pelos 5 arquivos da integração", () => {
    const importers = productionFiles().filter((file) =>
      code(file).includes("@sentry/"),
    );
    expect(importers.sort()).toEqual(SENTRY_IMPORTERS);
  });

  it("o scrubEvent só importa tipo do Sentry (sem código de runtime)", () => {
    const source = code("src/lib/sentry/scrubEvent.ts");
    expect(source).toContain(
      'import type { ErrorEvent } from "@sentry/nextjs";',
    );
    expect(source.split("@sentry/")).toHaveLength(2);
  });
});
```

Run: `bun run test -- test/logGuard.test.ts`
Expected: PASS: `Test Files  1 passed (1)` e `Tests  5 passed (5)`.

Prova de que o guarda pega o desvio que o plano proíbe (o `global-error` do spike chamava o Sentry direto). Acrescente **temporariamente** na linha 3 de `src/app/global-error.tsx` o texto `import * as Sentry from "@sentry/nextjs";` e rode:

Run: `bun run test -- test/logGuard.test.ts`
Expected: FAIL: `Tests  1 failed | 4 passed (5)` em `@sentry/nextjs só entra pelos 5 arquivos da integração`, com `expected [ 'src/app/global-error.tsx', …(5) ] to deeply equal [ …(5) ]`. **Desfaça** (apague a linha) e rode de novo: `Tests  5 passed (5)`.

- [ ] **Step 24: Ligar o Sentry ao build, ao E2E e ao `.env.example`**

Edite `next.config.ts`. O import vem de `@sentry/nextjs/config` (a v11 tirou `withSentryConfig` do pacote raiz):

Edit em `next.config.ts`:

`old_string`:

```ts
import type { NextConfig } from "next";
```

`new_string`:

```ts
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";
```

E o export. Sem `SENTRY_AUTH_TOKEN` o plugin não envia nada e não gera `.map`; sem `tunnelRoute` nenhuma rota nasce:

Edit em `next.config.ts`:

`old_string`:

```ts
export default nextConfig;
```

`new_string`:

```ts
// Sem SENTRY_AUTH_TOKEN (CI e máquina local) nada é enviado no build: sem upload
// de source maps, sem telemetria do plugin e sem logs. Sem tunnelRoute: o
// navegador fala direto com o Sentry (não cria route.ts nem passa pelo proxy).
export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
```

Edite `playwright.config.ts`: o E2E e o CI rodam com DSN vazio e nunca com o token de upload (o Next não sobrescreve variável que já existe no ambiente, nem string vazia, então estas valem mais que o `.env.local`):

Edit em `playwright.config.ts`:

`old_string`:

```ts
        FACEBOOK_CLIENT_SECRET: "",
      },
```

`new_string`:

```ts
        FACEBOOK_CLIENT_SECRET: "",
        // Sentry desligado no E2E (sem DSN nada é iniciado nem enviado) e sem
        // token de upload de source maps, mesmo que o shell do dev tenha um.
        NEXT_PUBLIC_SENTRY_DSN: "",
        SENTRY_AUTH_TOKEN: "",
      },
```

Edite `.env.example` (no fim do arquivo):

Edit em `.env.example`:

`old_string`:

```
FACEBOOK_CLIENT_ID=""
FACEBOOK_CLIENT_SECRET=""
```

`new_string`:

```
FACEBOOK_CLIENT_ID=""
FACEBOOK_CLIENT_SECRET=""

# --- Monitoramento de erros (Sentry, opcional) ---
# DSN do projeto Sentry. Deixe VAZIO em desenvolvimento e no CI: sem DSN nada é
# iniciado nem enviado. Em produção vai só na Vercel (Production). O valor é
# gravado no build (NEXT_PUBLIC_*): trocar o DSN exige novo deploy. O token de
# upload de source maps (SENTRY_AUTH_TOKEN) nunca entra neste arquivo nem no CI.
NEXT_PUBLIC_SENTRY_DSN=""
```

Run: `bun run test -- src/app/nextConfig.test.ts`
Expected: PASS sem mudar o teste (o `withSentryConfig` mantém `headers()`, `cacheComponents` e `reactCompiler`): `Test Files  1 passed (1)` e `Tests  8 passed (8)`.

- [ ] **Step 25: Documentar (`library-docs` §16, `architecture` §2, `ui-registry`)**

Em `.context/library-docs.md`, acrescente a seção nova antes de `## Como adicionar uma biblioteca nova`:

Edit em `.context/library-docs.md`:

`old_string`:

```markdown
## Como adicionar uma biblioteca nova
```

`new_string`:

```markdown
## 16. Sentry (`@sentry/nextjs`) · Fase 6

- **Versão exata `11.18.0`** (`bun add --exact`). Antes de mexer, a skill instalada do Sentry (se
  houver) e a doc atual (context7): a v11 mudou o que a doc antiga ensina. `withSentryConfig`
  saiu do pacote raiz (`import { withSentryConfig } from "@sentry/nextjs/config"`); `sendDefaultPii`
  **não existe mais** e o padrão de `dataCollection` coleta **tudo** (cookies, cabeçalhos, corpos,
  query, variáveis de pilha, usuário); `tunnelRoute` está obsoleto (e criaria um `route.ts`).
- **Desligado por padrão.** Uma variável só, `NEXT_PUBLIC_SENTRY_DSN` (público por natureza; gravada
  no build: trocar o DSN exige novo deploy). Sem ela `enabled: false` e nada é iniciado nem enviado
  (dev, CI e E2E rodam assim; `playwright.config.ts` fixa DSN e `SENTRY_AUTH_TOKEN` vazios).
- **Opções num lugar só:** `sentryOptions()` em `src/lib/sentry/options.ts` (servidor e navegador):
  `tracesSampleRate: 0`, `maxBreadcrumbs: 0`, sem Replay, `dataCollection` todo desligado,
  `beforeSend: scrubEvent`. No navegador, `instrumentation-client.ts` tira a integração
  `BrowserSession` (manda um envelope de sessão a cada página, com IP e navegador, mesmo sem erro).
  `register()` só inicia com `NEXT_RUNTIME === "nodejs"` (o `proxy.ts` do Next 16 roda em Node).
- **Um ponto de captura para erro tratado:** `logServerError` (escreve a linha de log e chama
  `Sentry.captureException(error, { tags: { context } })`; pula `null`/`undefined` e erro com
  `digest`). Erro **lançado** no servidor chega pelo `onRequestError` do `instrumentation.ts`.
  Ninguém mais importa `@sentry/nextjs` (guarda `test/logGuard.test.ts`: só `src/lib/sentry/*`,
  `src/instrumentation.ts`, `src/instrumentation-client.ts` e `src/lib/logServerError.ts`).
- **`scrubEvent` é a última barreira, não a primeira:** apaga usuário, `request`, servidor,
  breadcrumbs, extras, `logentry`, dados do mecanismo, variáveis de pilha, contextos (menos `trace`)
  e tags com `url` (o valor das demais tags e o `filename`, `abs_path` e `module` de cada frame passam pelo `scrubText`); força `sdk.settings.infer_ip = "never"` (o core mescla a metadata do cliente depois
  do `beforeSend`: apagar a chave não adianta e o Relay inferiria o IP); higieniza `message`, `transaction` e o valor de **toda** exceção (inclusive as
  causas do `linkedErrors`): o SQL e os `params` do Drizzle (`Failed query:` / `params:`), o valor que o
  Postgres repete, token de caminho e de fragmento, query string e e-mail. O que escapar desses
  padrões sai (P69).
- **Build:** sem `SENTRY_AUTH_TOKEN` não há upload nem arquivo `.map` (`sourcemaps.disable`);
  `telemetry: false`; o plugin liga `experimental.clientTraceMetadata` sozinho (aparece em
  "Experiments" no build). `SENTRY_AUTH_TOKEN` nunca entra no CI nem no `.env.local`. Custo medido:
  +67 KB gzip de JS no cliente mesmo desligado (P68).
- **Teste:** nunca fale com o Sentry de verdade. A captura se prova com DSN falso e transporte falso
  (`options.test.ts`: o envelope vira texto e o teste afirma sobre ele); o resto troca o SDK por espião
  (`vi.mock("@sentry/nextjs")`). Se um dia houver CSP, liberar `connect-src https://*.ingest.sentry.io`.

## Como adicionar uma biblioteca nova
```

Em `.context/architecture.md`, a linha do Sentry na tabela da §2 (a de `Hospedagem` continua para a Tarefa 10):

Edit em `.context/architecture.md`:

`old_string`:

```markdown
| Hospedagem |
```

`new_string`:

```markdown
| Monitoramento de erros | **Sentry** (`@sentry/nextjs`), desligado sem `NEXT_PUBLIC_SENTRY_DSN`; um ponto de captura (`logServerError`) + `onRequestError`; `scrubEvent` antes do envio (Fase 6) | 11.18.0 (exata) |
| Hospedagem |
```

Em `.context/ui-registry.md`, o histórico do `AppError` ganha a linha da tarefa e entra a ficha do `GlobalError`:

Edit em `.context/ui-registry.md`:

`old_string`:

```markdown
a tela não muda.

### AdminOverview
```

`new_string`:

```markdown
a tela não muda. <DATA> — Fase 6 (Tarefa 6): a captura no Sentry mora dentro do `logServerError`; este arquivo não muda.

### GlobalError
- **Status:** ✅ pronto (<DATA>)
- **Local:** `src/app/global-error.tsx` (`"use client"`; arquivo de convenção do Next, não componente de `src/components`)
- **Propósito:** o último limite de erro: aparece quando o próprio layout raiz quebra (a barra lateral, o tema e o CSS do layout não existem mais).
- **Como funciona:** substitui o layout raiz, então traz o próprio `<html lang="pt-BR">` e `<body className="flex min-h-full flex-col">` e importa `./globals.css`. O `<title>Algo deu errado</title>` é o do React 19 (limite de erro não aceita `metadata`). `<main>` com o título `Algo deu errado` e o `Button` `Tentar de novo` (`retry()`, o nome da prop no Next 16.4). O `useEffect` chama `logServerError(error, "global-error")` (a linha de log e o Sentry; erro com `digest` não vai de novo ao Sentry); a mensagem do erro nunca aparece. Testado no jsdom: o React 19 renderiza `<html>`/`<body>` nos singletons do `document`, e o único `console.error` aceito é o aviso `In HTML, %s cannot be a child of <%s>`. `bun scripts/rc-check.mjs src/app/global-error.tsx` confere que o React Compiler o compila.
- **Usa:** `Button`, `logServerError`.
- **Histórico:** <DATA> — criado na Fase 6 (Tarefa 6).

### AdminOverview
```

- [ ] **Step 26: Formatar, tipos, lint e suíte inteira**

```bash
bunx biome check --write src test next.config.ts playwright.config.ts
bun run check-types
bun run lint
bun run test
```

Expected: o Biome sem arquivo corrigido (os blocos acima já estão formatados); `check-types` e `lint` sem erro; a suíte verde com **o total do fim da Tarefa 5 acrescido de 4 arquivos e 46 testes (no planejamento, com as Tarefas 4 e 5 reconstruídas só por aproximação, a suíte tinha 316 arquivos e 4325 testes; as únicas falhas foram 5 timeouts de 15 s sob carga, que passam isolados, e 2 lacunas da própria reconstrução)**. A tarefa acrescenta **46 testes em 4 arquivos novos**: `scrubEvent.test.ts` 17, `options.test.ts` 9, `instrumentation.test.ts` 7, `global-error.test.tsx` 5, mais 6 em `logServerError.test.ts` (de 8 para 14) e 2 em `logGuard.test.ts` (de 3 para 5); o total do fim da tarefa = o do fim da Tarefa 5 + 46 testes e + 4 arquivos. Se o `migration0002.test.ts` estourar 15 s com a máquina carregada, repita só ele; se falhar isolado, BLOCKED.

- [ ] **Step 27: Build de produção: mesmas rotas, nenhum `.map` no navegador, nenhuma rota nova**

Este bloco **começa com os `export`** e roda inteiro numa chamada só (a ferramenta Bash não guarda variáveis entre chamadas; sem os `export` o build carregaria o `.env.local`):

```bash
export DATABASE_URL="postgresql://closery:fake@127.0.0.1:1/closery?sslmode=disable"
export DATABASE_URL_POOLED="$DATABASE_URL"
export BETTER_AUTH_URL="http://localhost:3201"
export BETTER_AUTH_SECRET="segredo-local-de-teste-nao-usar-0123456789abcdef"
export NEXT_PUBLIC_SENTRY_DSN=""
bun run build
find .next/static -name "*.map" | wc -l
grep -rl "sourceMappingURL" .next/static --include=*.js | wc -l
find src/app/api -name route.ts
```

Expected: o build termina sem erro e sem aviso novo além do bloco `Experiments (use with caution): · clientTraceMetadata` (o plugin liga `experimental.clientTraceMetadata` sozinho) e de `Completed runAfterProductionCompile in …` (cerca de 0,4 s, sem upload porque não há token); a lista de rotas é **a mesma de antes da tarefa** (nenhuma rota nova de API, nenhum aviso de rota), no estado do planejamento:

```
Route (app)
┌ ◐ /
├ ○ /_not-found
├   /(.)solicitacoes/[id]
│ └ ◐ /(.)solicitacoes/[id]
├ ◐ /admin
├ ◐ /admin/destinos
├ ◐ /admin/equipe
├ ◐ /admin/itens
├ ◐ /admin/setores
├ ◐ /admin/turnos
├ ƒ /api/auth/[...all]
├ ƒ /api/dashboard/export
├ ƒ /api/health
├ ◐ /bem-vindo
├ ◐ /conta
├   /convite/[token]
│ └ ◐ /convite/[token]
├ ◐ /dashboard
├ ◐ /entrar
├ ◐ /passagens
├   /passagens/[id]
│ └ ◐ /passagens/[id]
├ ◐ /passagens/nova
├ ○ /redefinir-senha
├ ○ /robots.txt
├ ◐ /solicitacoes
└   /solicitacoes/[id]
  └ ◐ /solicitacoes/[id]

ƒ Proxy (Middleware)
```

Os dois `0` (nenhum `.map` e nenhum `sourceMappingURL` em `.next/static`: o navegador não recebe mapa de fonte sem token) e exatamente três `route.ts`: `src/app/api/auth/[...all]/route.ts`, `src/app/api/dashboard/export/route.ts` e `src/app/api/health/route.ts`. (A pasta `.next/server` tem cerca de 360 `.map` do próprio Turbopack, para o servidor: não são do plugin e nunca chegam ao navegador; por isso a medida é `.next/static`, e não `.next` inteiro.) Se a lista de rotas divergir (rota nova, rota que sumiu), pare e reporte BLOCKED.

- [ ] **Step 28: E2E inteiro (35)**

Antes de rodar, confira que as portas estão livres (a 3200 e a 54329 do E2E; a 3000 é de outro processo e nunca se usa):

```bash
netstat -ano | grep -E ':3200|:54329' | grep LISTENING
```

Se aparecer alguma linha, outro E2E está rodando: espere e confira de novo (nunca encerre processo que não é seu). Com as portas livres:

Run: `bun run test:e2e`
Expected: `35 passed` (7 `auth` + 6 `cadastros` + 7 `dashboard` + 6 `passagem` + 9 `solicitacoes`), cerca de 5 min com o build; o app do E2E sobe com `NEXT_PUBLIC_SENTRY_DSN=""` (nada é iniciado nem enviado). O log do `[app]` pode mostrar `portal "" does not exist` (P49), que não reprova teste. Se a contagem divergir de 35, pare e reporte BLOCKED com o número medido.

- [ ] **Step 29: Commit**

Crie `.git/sdd/f6/msg-task-6.txt` com a ferramenta Write, com este conteúdo:

```text
feat(observabilidade): Sentry desligado sem DSN e sem dado pessoal no evento

- @sentry/nextjs 11.18.0 (exato); sentryOptions com dataCollection todo desligado
- scrubEvent/scrubText: SQL e params do Drizzle, token, e-mail, query e variáveis de pilha fora do evento
- instrumentation.ts (onRequestError), instrumentation-client.ts (sem BrowserSession) e global-error.tsx
- logServerError passa a ser o ponto único de captura de erro tratado
- withSentryConfig sem upload de source maps sem token; E2E com DSN vazio

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Depois:

```bash
git add package.json bun.lock next.config.ts playwright.config.ts .env.example src/lib/sentry src/instrumentation.ts src/instrumentation.test.ts src/instrumentation-client.ts src/app/global-error.tsx src/app/global-error.test.tsx src/lib/logServerError.ts src/lib/logServerError.test.ts test/logGuard.test.ts .context/library-docs.md .context/architecture.md .context/ui-registry.md
git status --short
git commit -F .git/sdd/f6/msg-task-6.txt
```

Expected: o `git status` lista só os arquivos acima (nenhum `.env.local`); o commit entra na branch `feat/fase-6-producao`.

### Task 7: Alvos de toque de 44 px (P12) e o guarda permanente no E2E

**Files:**
- Create: `e2e/touch-targets.spec.ts`
- Modify: `src/components/app-shell/Greeting.tsx` e `Greeting.test.tsx`
- Modify: `src/components/dashboard/DashboardStock.tsx` e `DashboardStock.test.tsx`
- Modify: `src/components/solicitacoes/RequestDetail.tsx` e `RequestDetail.test.tsx`
- Modify: `src/components/kokonutui/spending-ring.tsx` e `spending-ring.test.tsx`
- Modify: `test/pendenciasDoc.test.ts`
- Modify: `.context/pendencias.md` (P12 → `Resolvido`), `.context/ui-rules.md` (§1, item 4), `.context/library-docs.md` (§10) e `.context/ui-registry.md` (os quatro componentes)

Nenhuma migração, nenhuma rota nova e nenhum primitivo do shadcn muda. A P12 foi registrada como "primitivos do shadcn abaixo de 44 px" (`SidebarMenuButton` `sm` e ícone, `InputGroup`, `InputGroupButton` `icon-sm`, `SidebarInput`), mas esses primitivos **não aparecem em nenhuma tela**; o que o celular mostra de pequeno são **links soltos de componentes nossos**. Os testes de classe de `ui/` só cobrem primitivos e não pegariam nenhum deles; o jeito de achar é medir a tela de verdade. A tarefa escreve o guarda primeiro (vermelho), corrige os quatro links, e o guarda fica no repositório.

**Interfaces:**
- Consumes: o botão `Nova senha` (`aria-label` `Gerar link de nova senha para {nome}`) e o diálogo `Link de nova senha` da Tarefa 5; `/redefinir-senha` (Tarefa 5); de `e2e/helpers.ts`: `test`, `seedSector`, `signUpOperator`, `signUpAdmin`, `ago`, `unique`; de `e2e/db.ts`: `openE2eDb`, `insertUser`, `insertRequest`, `insertRequestItem`, `insertHandover`, `insertHandoverItem`; `addDays` de `@/features/handovers/saoPaulo`.
- Produces: o guarda `e2e/touch-targets.spec.ts` (2 testes; a Tarefa 8 acrescenta `/privacidade`) e as classes finais do Contrato: `Greeting` e `RequestDetail` e `DashboardStock` ganham ` max-md:inline-flex max-md:min-h-11 max-md:items-center` (a classe do desktop não muda); o `TOTAL_LINK` do `spending-ring` ganha ` max-md:min-w-11 max-md:justify-end`. O padrão do link solto entra em `ui-rules.md` §1, item 4.

- [ ] **Step 0: Conferir o ponto de partida**

```bash
git branch --show-current
git status --short
git log --oneline -3
ls "src/app/(auth)/redefinir-senha/page.tsx" src/components/admin/team/PasswordResetLinkButton.tsx
bun -e 'console.log(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()))'
```

Expected: a branch `feat/fase-6-producao`; `git status` vazio; o commit da Tarefa 6 no topo do log; os dois arquivos da Tarefa 5 existem; a data de hoje (a **DATA** das `Atualização` e dos históricos abaixo, onde as tarefas escrevem `<DATA>` entra a sua DATA; **substitua só os `<DATA>`: datas que já existem nos arquivos ficam como estão**). Se faltar commit ou arquivo, pare e reporte BLOCKED.

- [ ] **Step 1: Ler as regras**

Leia `.context/ui-rules.md` (§1 item 4, §5 e o checklist da §7), `.context/library-docs.md` §10 (E2E: o app roda em produção com rate limit, cada teste usa o `clientIp` do `test` de `./helpers`; o banco do E2E só é limpo entre execuções) e a entrada da P12 e da P3 em `.context/pendencias.md`. Nada a editar neste passo.

- [ ] **Step 2: Escrever o guarda (vermelho)**

Crie `e2e/touch-targets.spec.ts`. O que importa na medição:

- **Viewport 390x844 com `hasTouch`**, e **500 ms de espera** antes de medir (um diálogo ou menu em animação mede 43 px).
- O seletor cobre `a`, `button`, `input`, `select`, `textarea`, `summary` e os papéis de controle; ignora o invisível, o que está fora da tela e o `aria-hidden`/`inert` que não está dentro de um diálogo.
- **A isenção do link em frase é estrita.** Só o link `inline` que está dentro de um `p`, `li` ou `label` **com mais texto que ele** é isento: `const block = el.closest("p, li, label"); if (el.tagName === "A" && style.display === "inline" && block !== null && (block.textContent ?? "").trim() !== (el.textContent ?? "").trim()) continue;`. (A versão do spike comparava `closest(...)?.textContent !== el.textContent`, que vale `undefined !== texto`, isto é, `true`, quando não há ancestral: qualquer `<a>` `inline` dentro de `div`, `td`, `span` ou `header` ficava isento e mover "Ver o dashboard" para um `<div>` passaria.)
- O **link esticado** do cartão (`after:inset-0`) também é isento: a área de toque dele é o cartão inteiro.
- `expect.soft` por tela, para o relatório listar **todos** os achados de uma vez em vez de parar no primeiro.
- O operador precisa de uma **passagem entregue ontem com contagem** (sem ela o `/dashboard` mostra o estado vazio e nem o link da última contagem nem o total do anel aparecem; "ontem" porque hoje deve ficar livre para `/passagens/nova` abrir o formulário do turno) e de uma solicitação. O admin abre o diálogo `Link de nova senha`; o nome da pessoa é único e começa por `Aaa` (o banco do E2E só é limpo entre execuções e a Equipe pagina de 50 em 50 em ordem alfabética: com um nome fixo, o botão apareceria em nove linhas depois dos outros specs).

```ts
import { expect, type Page } from "@playwright/test";
import type { Pool } from "pg";

import type { Db } from "@/db/types";
import { addDays } from "@/features/handovers/saoPaulo";

import {
  insertHandover,
  insertHandoverItem,
  insertRequest,
  insertRequestItem,
  insertUser,
  openE2eDb,
} from "./db";
import {
  ago,
  seedSector,
  signUpAdmin,
  signUpOperator,
  test,
  unique,
} from "./helpers";

// Guarda de alvos de toque (P12, ui-rules §1.4): no celular (390x844) todo
// controle visível mede pelo menos 44x44. Os testes de classe (touchTargets
// do ui/) cobrem só os primitivos; os links soltos dos nossos componentes só
// aparecem medindo a tela de verdade. Os primitivos que a P12 citava
// (SidebarMenuButton sm e ícone, InputGroup, SidebarInput) não aparecem em
// nenhuma tela: se um aparecer, este guarda reprova.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

let pool: Pool;
let db: Db;
test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});
test.afterAll(async () => {
  await pool.end();
});

const MIN = 44;

// Um token no formato do link de redefinição (43 caracteres base64url): só
// abre o formulário, nenhuma requisição é feita até a pessoa enviar.
const FORMAT_ONLY_TOKEN = "a".repeat(43);

// Lista os controles visíveis menores que 44px. Ficam de fora: o link `inline`
// no meio de uma frase (dentro de p, li ou label que tem mais texto que ele; um
// link `inline` sozinho numa linha, ou dentro de div, td ou span, é medido) e o
// "link esticado" do cartão (after:inset-0), cuja área de toque é o cartão
// inteiro.
async function smallTargets(page: Page): Promise<string[]> {
  // Diálogo e menu entram com zoom/deslize: medir no meio da animação dá 43px.
  await page.waitForTimeout(500);
  return page.evaluate((min) => {
    const selector =
      "a, button, input, select, textarea, summary, [role=button], [role=link], [role=tab], [role=menuitem], [role=switch], [role=checkbox], [role=option], [role=combobox], [role=radio]";
    const small: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (
        el.closest("[aria-hidden=true],[inert],[hidden]") &&
        !el.closest("[role=dialog]")
      )
        continue;
      if (rect.right < 0 || rect.left > window.innerWidth) continue;
      if (rect.width >= min && rect.height >= min) continue;
      const block = el.closest("p, li, label");
      if (
        el.tagName === "A" &&
        style.display === "inline" &&
        block !== null &&
        (block.textContent ?? "").trim() !== (el.textContent ?? "").trim()
      )
        continue;
      if ((el.getAttribute("class") ?? "").includes("after:inset-0")) continue;
      const label = (
        el.getAttribute("aria-label") ??
        el.textContent ??
        el.tagName
      )
        .trim()
        .slice(0, 40);
      small.push(
        `${el.tagName.toLowerCase()} "${label}" ${Math.round(rect.width)}x${Math.round(rect.height)}`,
      );
    }
    return small;
  }, MIN);
}

// `expect.soft`: o teste continua nas outras telas e o relatório lista todos os
// achados de uma vez (uma tela por linha), em vez de parar no primeiro.
async function expectTouchSized(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  expect.soft(await smallTargets(page), `${path} no celular`).toEqual([]);
}

test("operador: telas públicas e do operador, menu e diálogo têm alvos de toque de 44px", async ({
  page,
}) => {
  // Cada teste mede dezenas de telas (500 ms de espera e networkidle em cada
  // uma): com a máquina carregada os 30 s padrão não bastam.
  test.slow();
  const world = await seedSector(db);
  const caio = await insertUser(db, {
    role: "operator",
    sectorId: world.sector.id,
    name: "Caio Teste",
  });
  const request = await insertRequest(db, {
    sectorId: world.sector.id,
    createdBy: caio.id,
    destinationId: world.destination.id,
    description: "Repor stretch",
    createdAt: ago(2 * 3_600_000),
  });
  await insertRequestItem(db, {
    requestId: request.id,
    itemId: world.stretch.id,
    quantity: 12,
  });
  // Uma passagem entregue ontem, com contagem: sem ela o /dashboard mostra o
  // estado vazio e nem o link da última contagem nem o total do anel aparecem
  // (hoje fica livre: /passagens/nova abre o formulário do turno).
  const handover = await insertHandover(db, {
    sectorId: world.sector.id,
    shiftId: world.shift.id,
    operationalDate: addDays(world.today, -1),
    status: "delivered",
    deliveredBy: caio.id,
    deliveredAt: ago(24 * 3_600_000),
    nextShiftText: "Conferir o lacre do ULD 12",
    occurrencesText: "Carga atrasada no portão 3",
    shiftNameSnapshot: "Turno Dia",
  });
  await insertHandoverItem(db, {
    handoverId: handover.id,
    itemId: world.stretch.id,
    quantity: 12,
    snapshot: true,
  });
  await insertHandoverItem(db, {
    handoverId: handover.id,
    itemId: world.net.id,
    quantity: 2,
    note: "Rasgada",
    snapshot: true,
  });

  // Antes de entrar: sem o fragmento (Link incompleto), com ele (o formulário).
  // A página anterior é sempre outra, senão a troca de fragmento não recarrega.
  await expectTouchSized(page, "/redefinir-senha");
  await expectTouchSized(page, "/entrar");
  await expectTouchSized(page, `/redefinir-senha#token=${FORMAT_ONLY_TOKEN}`);
  await signUpOperator(page, db, world.sector.id, "Ana Teste");

  for (const path of [
    "/",
    "/passagens",
    `/passagens/nova?turno=${world.shift.id}&data=${world.today}`,
    `/passagens/${handover.id}`,
    "/solicitacoes?visao=lista",
    `/solicitacoes/${request.id}`,
    "/dashboard",
    "/conta",
  ]) {
    await expectTouchSized(page, path);
  }

  await page.goto("/");
  await page.getByRole("button", { name: "Alternar menu" }).click();
  expect.soft(await smallTargets(page), "menu lateral").toEqual([]);
  await page.keyboard.press("Escape");

  await page.goto("/solicitacoes?visao=lista");
  await page.getByRole("button", { name: "Nova solicitação" }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect.soft(await smallTargets(page), "diálogo Nova solicitação").toEqual([]);
});

test("admin: telas de cadastro e o diálogo do link de nova senha têm alvos de toque de 44px", async ({
  page,
}) => {
  // Cada teste mede dezenas de telas (500 ms de espera e networkidle em cada
  // uma): com a máquina carregada os 30 s padrão não bastam.
  test.slow();
  const world = await seedSector(db);
  // O banco do E2E só é limpo entre execuções e a Equipe pagina de 50 em 50,
  // em ordem alfabética: o nome é único e começa por "Aaa" para ficar na
  // primeira página mesmo depois dos outros specs.
  const personName = `Aaa Teste ${unique()}`;
  await insertUser(db, {
    role: "operator",
    sectorId: world.sector.id,
    name: personName,
  });
  await signUpAdmin(page, db, "Gabriela Cadastros");

  for (const path of [
    "/admin",
    "/admin/setores",
    "/admin/turnos",
    "/admin/itens",
    "/admin/destinos",
    "/admin/equipe",
  ]) {
    await expectTouchSized(page, path);
  }

  await page.goto("/admin/equipe");
  await page
    .getByRole("button", {
      name: `Gerar link de nova senha para ${personName}`,
    })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Link de nova senha" }),
  ).toBeVisible();
  expect
    .soft(await smallTargets(page), "diálogo Link de nova senha")
    .toEqual([]);
});
```

- [ ] **Step 3: Rodar o guarda e ver falhar (re-medir todas as telas)**

Este passo mede as telas com a regra estrita e **anota todo achado**, inclusive um que a regra antiga escondia (um link em `td`, `div` ou `span`). Confira antes que as portas 3200 e 54329 estão livres (`netstat -ano | grep -E ':3200|:54329' | grep LISTENING`; se houver linha, outro E2E está rodando: espere, nunca encerre processo alheio) e rode:

Run: `bun run test:e2e -- e2e/touch-targets.spec.ts`
Expected: FAIL: `1 failed` (o teste do operador) e `1 passed` (o do admin), cerca de 2 min com o build. O relatório lista, no estado do planejamento, **três telas e quatro achados**:

```text
Error: / no celular
  Received: ["a \"Ver o dashboard\" 120x21"]
Error: /solicitacoes/<uuid> no celular
  Received: ["a \"Ver todas as solicitações\" 159x20"]
Error: /dashboard no celular
  Received: ["a \"1 passagens: ver a lista\" 9x44", "a \"12 rolo\" 80x32"]
```

Esses quatro são todos em componentes nossos (`Greeting`, `RequestDetail`, o total do `SpendingRing` e o `DashboardStock`); **nenhum** é um primitivo do shadcn, e nenhum é um link em `td`/`div`/`span` escondido pela regra antiga. O link esticado do `RequestCard` (`after:inset-0`, 24 px de altura de texto, mas a área de toque é o cartão inteiro) é a exceção justificada. Se aparecer um achado **a mais** (outro componente, ou o diálogo `Link de nova senha` do admin), pare: corrija-o com o mesmo padrão no Step 5 e acrescente a linha dele ao passo e ao `ui-registry`; se o achado for em primitivo do shadcn, pare e reporte (a P12 mudaria de natureza).

- [ ] **Step 4: Escrever os testes de classe dos quatro componentes (falhando)**

Cada teste afirma as classes novas **e** que as do desktop continuam. Inclua cada um logo antes do teste indicado.

`src/components/app-shell/Greeting.test.tsx`, antes de `nome vazio não deixa vírgula solta`:

Edit em `src/components/app-shell/Greeting.test.tsx`:

`old_string`:

```tsx
  it("nome vazio não deixa vírgula solta", async () => {
```

`new_string`:

```tsx
  it("o link do dashboard tem alvo de toque de 44px no celular e a classe do desktop continua (P12)", async () => {
    mocks.requireUser.mockResolvedValue(authz());

    render(await Greeting());

    const link = screen.getByRole("link", { name: "Ver o dashboard" });
    expect(link).toHaveClass(
      "max-md:inline-flex",
      "max-md:min-h-11",
      "max-md:items-center",
    );
    expect(link).toHaveClass(
      "underline",
      "underline-offset-4",
      "hover:text-foreground",
    );
  });

  it("nome vazio não deixa vírgula solta", async () => {
```

`src/components/dashboard/DashboardStock.test.tsx`, antes da evolução do Stretch:

Edit em `src/components/dashboard/DashboardStock.test.tsx`:

`old_string`:

```tsx
  it("a evolução do Stretch tem um dia por linha e 'sem contagem' no dia sem contagem (18/11)", async () => {
```

`new_string`:

```tsx
  it("o link da última contagem tem alvo de toque de 44px no celular e a classe do desktop continua (P12)", async () => {
    const region = await renderBlock(
      world.people.ana,
      worldScope(world, "operator"),
    );

    const link = within(cardOf(region, "Stretch")).getByRole("link", {
      name: "12 rolo",
    });
    expect(link).toHaveClass(
      "max-md:inline-flex",
      "max-md:min-h-11",
      "max-md:items-center",
    );
    expect(link).toHaveClass("w-fit", "text-2xl", "hover:underline");
  });

  it("a evolução do Stretch tem um dia por linha e 'sem contagem' no dia sem contagem (18/11)", async () => {
```

`src/components/solicitacoes/RequestDetail.test.tsx`, antes de `página do admin`:

Edit em `src/components/solicitacoes/RequestDetail.test.tsx`:

`old_string`:

```tsx
  it("página do admin: mostra o setor e o link leva ao setor da solicitação", async () => {
```

`new_string`:

```tsx
  it("página: 'Ver todas as solicitações' tem alvo de toque de 44px no celular e a classe do desktop continua (P12)", async () => {
    const { sector, ana, doca } = await seed();
    const created = await insertRequest(db, {
      sectorId: sector.id,
      createdBy: ana.id,
      destinationId: doca.id,
    });
    as("operator", sector.id, ana.id);

    await page(created.id);

    const link = screen.getByRole("link", {
      name: "Ver todas as solicitações",
    });
    expect(link).toHaveClass(
      "max-md:inline-flex",
      "max-md:min-h-11",
      "max-md:items-center",
    );
    expect(link).toHaveClass("w-fit", "text-sm", "underline");
  });

  it("página do admin: mostra o setor e o link leva ao setor da solicitação", async () => {
```

`src/components/kokonutui/spending-ring.test.tsx`, antes de `total 0: o 0 também é um link para a lista` (o total `0` é o caso curto que media 9x44 com `1`):

Edit em `src/components/kokonutui/spending-ring.test.tsx`:

`old_string`:

```tsx
  it("total 0: o 0 também é um link para a lista", () => {
```

`new_string`:

```tsx
  it("o total do cabeçalho tem alvo de toque de 44px no celular, inclusive para o 0, que é curto (P12)", () => {
    render(<SpendingRing {...ring({ total: 0 })} />);

    const link = screen.getByRole("link", { name: /passagens: ver a lista/ });
    expect(link).toHaveClass(
      "max-md:inline-flex",
      "max-md:min-h-11",
      "max-md:min-w-11",
      "max-md:items-center",
      "max-md:justify-end",
    );
    expect(link).toHaveClass("tabular-nums", "hover:underline");
  });

  it("total 0: o 0 também é um link para a lista", () => {
```

Run: `bun run test -- src/components/app-shell/Greeting.test.tsx src/components/dashboard/DashboardStock.test.tsx src/components/solicitacoes/RequestDetail.test.tsx src/components/kokonutui/spending-ring.test.tsx`
Expected: FAIL: `Test Files  4 failed (4)` e `Tests  4 failed | 46 passed (50)`, os quatro testes novos, cada um com `expect(element).toHaveClass("max-md:inline-flex max-md:min-h-11 max-md:items-center")` (o do anel inclui `max-md:min-w-11` e `max-md:justify-end`).

- [ ] **Step 5: Corrigir os quatro links**

A classe do desktop **não muda**; só se acrescenta o que está depois. `Greeting.tsx`, o link "Ver o dashboard":

Edit em `src/components/app-shell/Greeting.tsx`:

`old_string`:

```tsx
          className="underline underline-offset-4 hover:text-foreground"
```

`new_string`:

```tsx
          className="underline underline-offset-4 hover:text-foreground max-md:inline-flex max-md:min-h-11 max-md:items-center"
```

`DashboardStock.tsx`, o link da última contagem:

Edit em `src/components/dashboard/DashboardStock.tsx`:

`old_string`:

```tsx
                        className="w-fit text-2xl font-semibold tabular-nums underline-offset-4 hover:underline"
```

`new_string`:

```tsx
                        className="w-fit text-2xl font-semibold tabular-nums underline-offset-4 hover:underline max-md:inline-flex max-md:min-h-11 max-md:items-center"
```

`RequestDetail.tsx`, "Ver todas as solicitações":

Edit em `src/components/solicitacoes/RequestDetail.tsx`:

`old_string`:

```tsx
            className="w-fit text-sm underline underline-offset-4"
```

`new_string`:

```tsx
            className="w-fit text-sm underline underline-offset-4 max-md:inline-flex max-md:min-h-11 max-md:items-center"
```

`spending-ring.tsx`, o `TOTAL_LINK` (já tinha as três classes de altura; falta a largura e o alinhamento do número curto):

Edit em `src/components/kokonutui/spending-ring.tsx`:

`old_string`:

```tsx
focus-visible:ring-ring max-md:inline-flex max-md:min-h-11 max-md:items-center";
```

`new_string`:

```tsx
focus-visible:ring-ring max-md:inline-flex max-md:min-h-11 max-md:items-center max-md:min-w-11 max-md:justify-end";
```

- [ ] **Step 6: Rodar os testes de classe e conferir o React Compiler**

Run: `bun run test -- src/components/app-shell/Greeting.test.tsx src/components/dashboard/DashboardStock.test.tsx src/components/solicitacoes/RequestDetail.test.tsx src/components/kokonutui/spending-ring.test.tsx`
Expected: PASS: `Test Files  4 passed (4)` e `Tests  50 passed (50)`.

Run: `bun scripts/rc-check.mjs src/components/kokonutui/spending-ring.tsx src/components/dashboard/DashboardStock.tsx src/components/solicitacoes/RequestDetail.tsx src/components/app-shell/Greeting.tsx`
Expected: uma linha `compiled: N other events: []` por arquivo (`spending-ring.tsx compiled: 3`, os outros três `compiled: 1`) e nenhuma menção a "bailout" (o `spending-ring` cru fazia o Compiler desistir em silêncio; aqui só uma classe mudou, e `compiled` ≥ 1 prova que ele continua compilando).

- [ ] **Step 7: Rodar o guarda e ver passar; provar que ele pega a regressão**

Run: `bun run test:e2e -- e2e/touch-targets.spec.ts`
Expected: PASS: `2 passed` (cerca de 1,5 min).

Prova de que a isenção estrita funciona. Em `src/components/app-shell/Greeting.tsx`, desfaça **temporariamente** a correção (tire ` max-md:inline-flex max-md:min-h-11 max-md:items-center` do `className` do link) **e** troque o `<p className="text-muted-foreground">` por `<div className="text-muted-foreground">` (e o `</p>` por `</div>`): o link volta a ser `inline`, agora dentro de um `div`, o caso que a regra antiga isentava por engano. Rode de novo:

Run: `bun run test:e2e -- e2e/touch-targets.spec.ts`
Expected: FAIL: `1 failed` e `1 passed`, com `Error: / no celular` e `a "Ver o dashboard" 120x21`. **Desfaça as duas mudanças** (volte ao Step 5) e confirme com `git diff src/components/app-shell/Greeting.tsx` que sobra só a linha da classe nova.

- [ ] **Step 8: Escrever o caso do guarda de pendências (falhando)**

Edite `test/pendenciasDoc.test.ts`, antes do caso `Fase 4: P44, P46 e P47 entraram como Aberto, não triado`:

Edit em `test/pendenciasDoc.test.ts`:

`old_string`:

```ts
  it("Fase 4: P44, P46 e P47 entraram como Aberto, não triado", () => {
```

`new_string`:

```ts
  it("Fase 6: P12 resolvida pelo guarda de alvos de toque", () => {
    const entry = entries.get("P12");
    expect(entry?.state, "P12").toBe("Resolvido");
    expect(entry?.section, "P12").toBe("5");
    expect(
      entry?.updates.some((date) => date >= "2026-11-25"),
      "P12",
    ).toBe(true);
  });

  it("Fase 4: P44, P46 e P47 entraram como Aberto, não triado", () => {
```

Run: `bun run test -- test/pendenciasDoc.test.ts`
Expected: FAIL: `Tests  1 failed | 14 passed (15)`, `Fase 6: P12 resolvida pelo guarda de alvos de toque` com `AssertionError: P12: expected 'Aberto, não triado' to be 'Resolvido'`.

- [ ] **Step 9: Fechar a P12 e documentar o padrão**

Em `.context/pendencias.md`, a P12 **muda de seção** (nunca se apaga). O índice:

Edit em `.context/pendencias.md`:

`old_string`:

```markdown
| P12 | Tamanhos gerados pelo shadcn abaixo do mínimo de toque | 🟡 | Aberto, não triado |
```

`new_string`:

```markdown
| P12 | Tamanhos gerados pelo shadcn abaixo do mínimo de toque | 🟡 | Resolvido |
```

Apague o bloco da P12 da seção `## 1. Aberto, não triado` (o `old_string` leva junto o título da P14, que vem logo depois, para não deixar duas linhas em branco seguidas):

Edit em `.context/pendencias.md`:

`old_string`:

```markdown
#### P12 — Tamanhos gerados pelo shadcn abaixo do mínimo de toque 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/components/ui/sidebar.tsx` · `src/components/ui/input-group.tsx`
**Impacto:** `SidebarMenuButton` `sm` (h-7) e modo ícone (`size-8!`), `InputGroup` (h-8), `InputGroupButton` `icon-sm` (size-8) e `SidebarInput` (h-8) ficam abaixo de 44px no celular (`ui-rules.md §1.4`); a correção da P3 não os cobriu.
**Correção:** — (opção: aplicar o mesmo padrão `max-md:` da P3 (44px abaixo de `md`) com teste guarda de classes)
**Registrado em:** 2026-11-20

#### P14 — Destino perdido no login: depois de entrar a pessoa cai em / 🟡
```

`new_string`:

```markdown
#### P14 — Destino perdido no login: depois de entrar a pessoa cai em / 🟡
```

E acrescente o bloco, resolvido e com a `Atualização`, **no fim do arquivo** (a seção `## 5. Resolvido` é a última e cresce em ordem de resolução), com o Edit: `old_string` = a última frase que a Tarefa 4 escreveu no fim do arquivo (`é o passo B7 da Parte B.`, que aparece uma vez só) e `new_string` = essa mesma frase, uma linha em branco e o bloco abaixo. Acrescente exatamente:

Texto a acrescentar no fim de `.context/pendencias.md`:

```markdown
#### P12 — Tamanhos gerados pelo shadcn abaixo do mínimo de toque 🟡
**Estado:** Resolvido
**Arquivos:** `src/components/ui/sidebar.tsx` · `src/components/ui/input-group.tsx`
**Impacto:** `SidebarMenuButton` `sm` (h-7) e modo ícone (`size-8!`), `InputGroup` (h-8), `InputGroupButton` `icon-sm` (size-8) e `SidebarInput` (h-8) ficam abaixo de 44px no celular (`ui-rules.md §1.4`); a correção da P3 não os cobriu.
**Correção:** — (opção: aplicar o mesmo padrão `max-md:` da P3 (44px abaixo de `md`) com teste guarda de classes)
**Registrado em:** 2026-11-20
**Atualização (<DATA>):** resolvida na Fase 6 (Tarefa 7). A pendência estava desatualizada: `Input`, `NativeSelect`, `Button` e o `SidebarMenuButton` padrão já têm `max-md:h-11` (P3), e os primitivos que ela cita (`SidebarMenuButton` `sm` e ícone, `InputGroup`, `InputGroupButton` `icon-sm`, `SidebarInput`) não aparecem em nenhuma tela. Os achados reais eram links soltos de componentes nossos, medidos a 390x844: `Greeting` ("Ver o dashboard", 120x21), `RequestDetail` ("Ver todas as solicitações", 159x20), `DashboardStock` (link da última contagem, 80x32) e o total do `SpendingRing` (9x44); os quatro ganharam o padrão do link solto (`ui-rules.md §1.4`). O guarda permanente `e2e/touch-targets.spec.ts` mede as telas do operador e do admin (e os diálogos) e reprova qualquer controle abaixo de 44 px, inclusive um primitivo da lista acima se um dia aparecer numa tela. Exceções medidas e justificadas: o link `inline` dentro de uma frase e o link esticado do `RequestCard` (`after:inset-0`, cuja área é o cartão inteiro). Não medido: iOS e Android reais, tema escuro e o contêiner do link esticado na Lista (ver P70).
```

Em `.context/ui-rules.md`, o item 4 do §1 ganha o padrão do link solto, as isenções e o guarda:

Edit em `.context/ui-rules.md`:

`old_string`:

```markdown
4. **Confortável de ler e tocar.** Corpo `text-sm`+, botões `h-9`+; abaixo de `md`, alvo de toque
   ≥ 44px.
```

`new_string`:

```markdown
4. **Confortável de ler e tocar.** Corpo `text-sm`+, botões `h-9`+; abaixo de `md`, alvo de toque
   ≥ 44px.
   - **Link solto** (sozinho numa linha ou célula, não dentro de uma frase): mantém a classe do desktop
     e ganha `max-md:inline-flex max-md:min-h-11 max-md:items-center`; `max-md:min-w-11` quando o
     conteúdo é curto (um número) e `max-md:justify-end` quando ele se alinha à direita.
   - **Isentos:** o link `inline` no meio de uma frase (dentro de `p`, `li` ou `label` com mais texto
     que ele) e o link esticado do cartão (`after:inset-0`), cuja área de toque é o cartão inteiro.
   - **Guarda:** `e2e/touch-targets.spec.ts` mede as telas a 390x844 e reprova controle visível abaixo
     de 44px; tela nova entra na lista dele. Os testes de classe de `ui/` só cobrem primitivos.
```

Em `.context/library-docs.md`, na §10 (antes da linha `Duração`):

Edit em `.context/library-docs.md`:

`old_string`:

```markdown
- Duração: cerca de 1 min com o cache do Turbopack; 3 a 4 min na primeira vez.
```

`new_string`:

```markdown
- **`e2e/touch-targets.spec.ts` (Fase 6, P12).** Viewport 390x844 com `hasTouch`; `smallTargets(page)` espera 500 ms (diálogo e menu em
  animação medem 43 px) e lista todo controle visível com menos de 44 px. Isenta só o link `inline` dentro de `p`/`li`/`label` com mais texto
  que ele (sem esse ancestral não há isenção: um `<a>` em `div`, `td` ou `span` é medido) e o link esticado (`after:inset-0`). `expect.soft` por
  tela: o relatório lista todos os achados de uma vez. O operador precisa de uma passagem entregue **ontem** com contagem (sem ela o
  `/dashboard` mostra o estado vazio e nem o link da última contagem nem o total do anel aparecem) e de uma solicitação; o admin abre o
  diálogo `Link de nova senha`. Tela nova entra na lista do spec.
- Duração: cerca de 1 min com o cache do Turbopack; 3 a 4 min na primeira vez.
```

Em `.context/ui-registry.md`, a linha de histórico dos quatro componentes:

Edit em `.context/ui-registry.md`:

`old_string`:

```markdown
o segundo parágrafo vira o link "Ver o dashboard" (`/dashboard`); o "Em breve" saiu.
```

`new_string`:

```markdown
o segundo parágrafo vira o link "Ver o dashboard" (`/dashboard`); o "Em breve" saiu. <DATA> — Fase 6 (Tarefa 7, P12): o link ganha `max-md:inline-flex max-md:min-h-11 max-md:items-center` (alvo de toque de 44 px no celular; o desktop não muda).
```

Edit em `.context/ui-registry.md`:

`old_string`:

```markdown
- **Usa:** `Card`, `StockTrendChart`, `lastCountHref`, `EmptyState`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 11).
```

`new_string`:

```markdown
- **Usa:** `Card`, `StockTrendChart`, `lastCountHref`, `EmptyState`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 11). <DATA> — Fase 6 (Tarefa 7, P12): o link da última contagem ganha `max-md:inline-flex max-md:min-h-11 max-md:items-center` (era 80x32 no celular).
```

Edit em `.context/ui-registry.md`:

`old_string`:

```markdown
- **Usa:** `Link`, `sharePercent`, `formatInteger`, `cn`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 10).
```

`new_string`:

```markdown
- **Usa:** `Link`, `sharePercent`, `formatInteger`, `cn`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 10). <DATA> — Fase 6 (Tarefa 7, P12): o total do cabeçalho (`TOTAL_LINK`) ganha `max-md:min-w-11 max-md:justify-end` (um número curto como `1` ou `0` media 9x44 no celular).
```

Edit em `.context/ui-registry.md`:

`old_string`:

```markdown
criado na Fase 4 (Tarefa 12). 2026-11-25 — Fase 5 (Tarefa 1, P48): "Criada por {nome} em {data} às {hora}" vem de `formatDateAtTimeBR` (a cópia local `dateAndTime` saiu; o texto é o mesmo).
```

`new_string`:

```markdown
criado na Fase 4 (Tarefa 12). 2026-11-25 — Fase 5 (Tarefa 1, P48): "Criada por {nome} em {data} às {hora}" vem de `formatDateAtTimeBR` (a cópia local `dateAndTime` saiu; o texto é o mesmo). <DATA> — Fase 6 (Tarefa 7, P12): "Ver todas as solicitações" ganha `max-md:inline-flex max-md:min-h-11 max-md:items-center` (era 159x20 no celular).
```

Run: `bun run test -- test/pendenciasDoc.test.ts`
Expected: PASS: `Test Files  1 passed (1)` e `Tests  15 passed (15)` (os 14 de antes, 12 originais, 1 da Tarefa 4 e 1 da Tarefa 5, e o novo; o índice e as seções continuam iguais e o próximo id livre continua `P62`).

- [ ] **Step 10: Formatar, tipos, lint e suíte inteira**

```bash
bunx biome check --write src test e2e
bun run check-types
bun run lint
bun run test
```

Expected: o Biome sem arquivo corrigido; `check-types` e `lint` sem erro; a suíte verde com **o total do fim da Tarefa 6 acrescido de 5 testes e nenhum arquivo (no planejamento: 316 arquivos e 4330 testes, `Test Files  316 passed` fora as 2 lacunas da reconstrução, `result.test.ts` e `uiRegistryDoc.test.ts`, que a Tarefa 5 real cobre)**. A tarefa acrescenta **5 testes e nenhum arquivo de teste de unidade**: 4 de classe (um em cada arquivo dos quatro componentes) e 1 em `pendenciasDoc.test.ts`; o `touch-targets.spec.ts` é do Playwright e não conta no Vitest. O total do fim da tarefa = o do fim da Tarefa 6 + 5 testes (mesmos arquivos). Se um teste de componente ou o `migration0002.test.ts` estourar o tempo (15 s) com a máquina carregada, repita só o arquivo dele; se falhar isolado, BLOCKED.

- [ ] **Step 11: Build e E2E inteiro (37)**

Os `export` abaixo vão **no mesmo bloco** do `build` (a ferramenta Bash não guarda variáveis entre chamadas; sem eles o build carregaria o `.env.local`):

```bash
export DATABASE_URL="postgresql://closery:fake@127.0.0.1:1/closery?sslmode=disable"
export DATABASE_URL_POOLED="$DATABASE_URL"
export BETTER_AUTH_URL="http://localhost:3201"
export BETTER_AUTH_SECRET="segredo-local-de-teste-nao-usar-0123456789abcdef"
export NEXT_PUBLIC_SENTRY_DSN=""
bun run build
```

Expected: o build termina sem erro e com **as mesmas rotas do fim da Tarefa 6** (`○ /redefinir-senha`, `○ /robots.txt`, nenhuma rota nova: a tarefa só muda classes).

Confira as portas livres (`netstat -ano | grep -E ':3200|:54329' | grep LISTENING`) e rode:

Run: `bun run test:e2e`
Expected: `37 passed` (7 `auth` + 6 `cadastros` + 7 `dashboard` + 6 `passagem` + 9 `solicitacoes` + 2 `touch-targets`), cerca de 3 a 5 min com o build. O log do `[app]` pode mostrar `portal "" does not exist` (P49), que não reprova teste. Se a contagem divergir de 37, pare e reporte BLOCKED com o número medido.

- [ ] **Step 12: Commit**

Crie `.git/sdd/f6/msg-task-7.txt` com a ferramenta Write, com este conteúdo:

```text
fix(ui): alvos de toque de 44 px nos links soltos e guarda E2E das telas (P12)

- Greeting, DashboardStock, RequestDetail e o total do SpendingRing ganham o padrão max-md do link solto
- e2e/touch-targets.spec.ts mede as telas do operador e do admin a 390x844 e reprova controle abaixo de 44 px
- a isenção do link em frase é estrita: só dentro de p/li/label com mais texto que o link
- P12 resolvida; ui-rules 1.4, library-docs 10 e ui-registry atualizados

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Depois:

```bash
git add e2e/touch-targets.spec.ts src/components/app-shell/Greeting.tsx src/components/app-shell/Greeting.test.tsx src/components/dashboard/DashboardStock.tsx src/components/dashboard/DashboardStock.test.tsx src/components/solicitacoes/RequestDetail.tsx src/components/solicitacoes/RequestDetail.test.tsx src/components/kokonutui/spending-ring.tsx src/components/kokonutui/spending-ring.test.tsx test/pendenciasDoc.test.ts .context/pendencias.md .context/ui-rules.md .context/library-docs.md .context/ui-registry.md
git status --short
git commit -F .git/sdd/f6/msg-task-7.txt
```

Expected: o `git status` lista só os arquivos acima; o commit entra na branch `feat/fase-6-producao`.

### Task 8: Página `/privacidade`, `PrivacyLink` e os textos do primeiro acesso

**Files:**
- Create: `src/features/privacy/privacyContent.ts`
- Create: `src/app/privacidade/page.tsx`
- Create: `src/app/privacidade/page.test.tsx`
- Create: `src/components/privacy/PrivacyLink.tsx`
- Create: `src/components/privacy/PrivacyLink.test.tsx`
- Create: `.git/sdd/f6/registry-history.mjs` (auxiliar descartável, fora do commit)
- Modify: `src/features/authz/proxyRules.ts`
- Modify: `src/features/authz/proxyRules.test.ts`
- Modify: `src/components/auth/SignInPanel.tsx`
- Modify: `src/components/auth/SignInPanel.test.tsx`
- Modify: `src/components/auth/PasskeyOffer.tsx`
- Modify: `src/components/auth/PasskeyOffer.test.tsx`
- Modify: `src/app/(auth)/convite/[token]/page.tsx`
- Modify: `src/app/(app)/conta/page.tsx`
- Modify: `e2e/touch-targets.spec.ts`
- Modify: `test/uiRegistryDoc.test.ts`
- Modify: `.context/ui-registry.md`
- Modify: `.context/architecture.md` (§8 e §9)
- Modify: `.context/pendencias.md` (só a `Atualização` da P7)

Nenhuma migração e nenhuma rota de API nova. A página é **estática** (nada de sessão, `cookies()`, `headers()` nem `searchParams`: o build a lista com `○`) e pública (entra em `PUBLIC_PATH_PREFIXES`). O texto é **rascunho** (`PRIVACY_DRAFT = true`, com alerta visível) até o dono e a empresa o aprovarem (C6-5); a troca para `false` é um PR curto depois da aprovação (runbook, passo B12), **nunca nesta tarefa**. Cada frase da página só afirma o que a configuração garante (F6-17, R6): as afirmações de região dependem do `gru1` do `vercel.json` e do projeto Neon novo em `sa-east-1`.

**Interfaces:**
- Consumes: `SignInPanel` com o rodapé de dois parágrafos (Tarefa 5: `O acesso é só por convite.` e `Esqueceu a senha? Peça ao administrador um link para criar outra.`); `e2e/touch-targets.spec.ts` (Tarefa 7); `PUBLIC_PATH_PREFIXES` com `/redefinir-senha` (Tarefa 5); `Alert`, `AlertTitle`, `AlertDescription` e `Card*` do shadcn (já existem).
- Produces: `PRIVACY_DRAFT: boolean`, `PRIVACY_UPDATED_AT`, `PrivacySection`, `PRIVACY_INTRO`, `PRIVACY_SECTIONS` (ids `dados`, `motivo`, `quem-ve`, `onde`, `prazo`, `direitos`); a rota pública `/privacidade`; `PrivacyLink(props: { className?: string })`; `PUBLIC_PATH_PREFIXES = ["/entrar", "/convite", "/redefinir-senha", "/privacidade"]`. A Tarefa 9 testa a página e os três links.

- [ ] **Step 1: Conferir a documentação instalada do Next**

Leia `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md` e `.../01-metadata/index.md` (o `metadata` estático de uma página). Nada a editar. O ponto que importa: uma página sem `async`, sem `params`, sem `searchParams` e sem leitura de sessão sai do build como estática (`○`).

- [ ] **Step 2: Escrever o teste da página (falhando)**

Crie `src/app/privacidade/page.test.tsx`. O teste importa `Page` e `metadata` da página que ainda não existe e prova, pelos textos exatos da seção **Textos de interface** do plano, o que a página diz e o que ela **não** diz (nada de "ninguém de fora", "sem nenhum dado", "sem dados pessoais"):

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  PRIVACY_DRAFT,
  PRIVACY_SECTIONS,
  PRIVACY_UPDATED_AT,
} from "@/features/privacy/privacyContent";
import Page, { metadata } from "./page";

describe("/privacidade", () => {
  it("o título da aba é Privacidade", () => {
    expect(metadata.title).toBe("Privacidade");
  });

  it("tem um h1 e uma seção (h2, region) para cada assunto", () => {
    render(<Page />);
    expect(
      screen.getAllByRole("heading", { level: 1 }).map((h) => h.textContent),
    ).toEqual(["Privacidade e seus dados"]);
    expect(PRIVACY_SECTIONS.map((section) => section.id)).toEqual([
      "dados",
      "motivo",
      "quem-ve",
      "onde",
      "prazo",
      "direitos",
    ]);
    for (const section of PRIVACY_SECTIONS) {
      expect(
        screen.getByRole("heading", { level: 2, name: section.title }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("region", { name: section.title }),
      ).toBeInTheDocument();
    }
  });

  it("o que guardamos diz IP e navegador de cada acesso e não promete ausência de dado pessoal", () => {
    render(<Page />);
    const stored = screen.getByRole("region", { name: "O que guardamos" });
    expect(
      within(stored).getByText(
        "O endereço de rede (IP) e o navegador de cada acesso, para manter a sessão segura e limitar tentativas em excesso.",
      ),
    ).toBeInTheDocument();
    expect(
      within(stored).getByText(
        "Relatórios de erro do sistema, limpos antes do envio ao Sentry para não levar nome, e-mail nem o conteúdo das passagens.",
      ),
    ).toBeInTheDocument();
    expect(stored.textContent).not.toMatch(/sem nenhum dado/i);
    expect(stored.textContent).not.toMatch(/sem dados pessoais/i);
  });

  it("quem vê cita o responsável pelo sistema e não diz que ninguém de fora da empresa vê", () => {
    render(<Page />);
    const who = screen.getByRole("region", { name: "Quem vê" });
    expect(
      within(who).getByText(
        "Fora a equipe, só o responsável pelo sistema (o dono do produto) e os serviços listados abaixo, que guardam os dados apenas para o sistema funcionar.",
      ),
    ).toBeInTheDocument();
    expect(who.textContent).not.toMatch(/ninguém de fora/i);
  });

  it("onde ficam: os quatro itens, na ordem, sem prometer mais do que a configuração garante", () => {
    render(<Page />);
    const where = screen.getByRole("region", { name: "Onde ficam" });
    expect(
      within(where)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Aplicação: Vercel, com o processamento em São Paulo (Brasil); a Vercel guarda por 1 hora registros técnicos de acesso.",
      "Banco de dados: Neon, em São Paulo (Brasil).",
      "Relatórios de erro: Sentry, fora do Brasil, com o endereço de rede descartado.",
      "Cópia de segurança: durante o piloto, o administrador baixa todo dia o resumo das passagens (com os nomes de quem entregou e recebeu) e o guarda numa pasta privada.",
    ]);
  });

  it("diz que o contato é o administrador do setor e que a conta é desativada, não apagada", () => {
    render(<Page />);
    expect(
      screen.getByText(/Fale com o administrador do seu setor/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/a conta é desativada e não apagada/),
    ).toBeInTheDocument();
  });

  it("mostra a data da última atualização", () => {
    render(<Page />);
    expect(
      screen.getByText(`Última atualização: ${PRIVACY_UPDATED_AT}.`),
    ).toBeInTheDocument();
  });

  it("o alerta de rascunho aparece se e só se PRIVACY_DRAFT é verdadeiro", () => {
    render(<Page />);
    const notice = screen.queryByText("Rascunho aguardando aprovação");
    if (PRIVACY_DRAFT) {
      expect(notice).toBeInTheDocument();
      expect(
        screen.getByText(
          "Este texto ainda não foi aprovado pelo dono do produto nem pela empresa.",
        ),
      ).toBeInTheDocument();
    } else {
      expect(notice).not.toBeInTheDocument();
    }
  });

  it("tem o link para voltar à entrada", () => {
    render(<Page />);
    expect(
      screen.getByRole("link", { name: "Voltar para a entrada" }),
    ).toHaveAttribute("href", "/entrar");
  });
});
```

- [ ] **Step 3: Rodar o teste e ver falhar**

```bash
bunx vitest run src/app/privacidade/page.test.tsx
```

Expected: FAIL, com `Error: Failed to resolve import "./page" from "src/app/privacidade/page.test.tsx". Does the file exist?`, `Test Files  1 failed (1)` e `Tests  no tests`.

- [ ] **Step 4: Criar o texto e a página**

Crie `src/features/privacy/privacyContent.ts`. `PRIVACY_DRAFT` é anotado como `boolean` (sem estreitar para o literal `true`, senão o `if` do teste e o `&&` da página virariam código morto para o TypeScript). `PRIVACY_UPDATED_AT` é **a data do dia da execução por extenso**: o exemplo abaixo está com `25 de novembro de 2026`, que era o dia do planejamento; se o `bun -e` do Step 0 da Tarefa 1 deu outro dia, escreva o seu (ex.: `3 de dezembro de 2026`).

```ts
// Texto da página /privacidade. RASCUNHO: o dono do produto precisa aprovar
// (decisão C6-5) e a empresa também, antes de convidar a primeira pessoa.
// Ao aprovar, troque PRIVACY_DRAFT para false (some o aviso da página) e
// atualize PRIVACY_UPDATED_AT, num PR curto depois da aprovação da empresa.
// Cada frase aqui só diz o que a configuração garante (runbook, passo B12).
export const PRIVACY_DRAFT: boolean = true;
export const PRIVACY_UPDATED_AT = "25 de novembro de 2026";

export type PrivacySection = {
  id: string;
  title: string;
  paragraphs?: readonly string[];
  items?: readonly string[];
};

export const PRIVACY_INTRO =
  "O Closery registra a passagem de turno da operação. Esta página explica, em poucas linhas, quais dados ficam guardados, para quê, quem vê e como pedir ajuda.";

export const PRIVACY_SECTIONS: readonly PrivacySection[] = [
  {
    id: "dados",
    title: "O que guardamos",
    items: [
      "Seu nome e seu e-mail.",
      "Como você entra: a senha (guardada de forma que ninguém consegue ler) e as passkeys que você cadastrar.",
      "As passagens de turno, as solicitações e os comentários que você escreve, cada um com o seu nome e o horário.",
      "O endereço de rede (IP) e o navegador de cada acesso, para manter a sessão segura e limitar tentativas em excesso.",
      "Relatórios de erro do sistema, limpos antes do envio ao Sentry para não levar nome, e-mail nem o conteúdo das passagens.",
    ],
  },
  {
    id: "motivo",
    title: "Para que usamos",
    paragraphs: [
      "Para você entrar com segurança, para a equipe saber quem passou e quem recebeu cada turno, para acompanhar as solicitações e para corrigir falhas do sistema. Não usamos seus dados para publicidade nem os vendemos.",
    ],
  },
  {
    id: "quem-ve",
    title: "Quem vê",
    items: [
      "Operador: vê os dados do próprio setor.",
      "Administrador: vê os dados de todos os setores e cuida das contas.",
      "Fora a equipe, só o responsável pelo sistema (o dono do produto) e os serviços listados abaixo, que guardam os dados apenas para o sistema funcionar.",
    ],
  },
  {
    id: "onde",
    title: "Onde ficam",
    items: [
      "Aplicação: Vercel, com o processamento em São Paulo (Brasil); a Vercel guarda por 1 hora registros técnicos de acesso.",
      "Banco de dados: Neon, em São Paulo (Brasil).",
      "Relatórios de erro: Sentry, fora do Brasil, com o endereço de rede descartado.",
      "Cópia de segurança: durante o piloto, o administrador baixa todo dia o resumo das passagens (com os nomes de quem entregou e recebeu) e o guarda numa pasta privada.",
    ],
  },
  {
    id: "prazo",
    title: "Por quanto tempo",
    paragraphs: [
      "Enquanto o piloto e o uso do sistema durarem. Quando alguém deixa a equipe, a conta é desativada e não apagada, para que as passagens e solicitações continuem mostrando quem as fez. Quem deixa a equipe perde o acesso na hora.",
    ],
  },
  {
    id: "direitos",
    title: "Seus direitos e contato",
    paragraphs: [
      "Você pode pedir para ver seus dados, corrigir um dado errado ou tirar uma dúvida sobre esta página. Fale com o administrador do seu setor: ele atende o pedido ou leva à empresa. Registros de passagens já confirmadas só mudam por correção do administrador, com motivo anotado.",
    ],
  },
];
```

Crie `src/app/privacidade/page.tsx` (entry file do Next: o único `export default` permitido aqui). Fica fora de `(app)` e de `(auth)` de propósito: não tem sidebar nem o cartão de entrada, e é a mesma página para quem entrou e para quem não entrou.

```tsx
import type { Metadata } from "next";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  PRIVACY_DRAFT,
  PRIVACY_INTRO,
  PRIVACY_SECTIONS,
  PRIVACY_UPDATED_AT,
} from "@/features/privacy/privacyContent";

export const metadata: Metadata = { title: "Privacidade" };

// Página pública (fora de (app), liberada no proxy): quem ainda não entrou
// também precisa poder ler antes de aceitar um convite. Estática: sem sessão,
// sem banco.
export default function Page() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-6 p-4 md:py-10">
      <p className="text-lg font-semibold">Closery</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        Privacidade e seus dados
      </h1>

      {PRIVACY_DRAFT && (
        <Alert>
          <AlertTitle>Rascunho aguardando aprovação</AlertTitle>
          <AlertDescription>
            Este texto ainda não foi aprovado pelo dono do produto nem pela
            empresa.
          </AlertDescription>
        </Alert>
      )}

      <p className="text-muted-foreground">{PRIVACY_INTRO}</p>

      {PRIVACY_SECTIONS.map((section) => (
        <section
          key={section.id}
          aria-labelledby={`privacidade-${section.id}`}
          className="flex flex-col gap-2"
        >
          <h2
            id={`privacidade-${section.id}`}
            className="text-lg font-semibold"
          >
            {section.title}
          </h2>
          {section.paragraphs?.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.items && (
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <p className="text-sm text-muted-foreground">
        Última atualização: {PRIVACY_UPDATED_AT}.
      </p>
      <Link
        href="/entrar"
        className="w-fit text-sm underline underline-offset-4 max-md:inline-flex max-md:min-h-11 max-md:items-center"
      >
        Voltar para a entrada
      </Link>
    </main>
  );
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

```bash
bunx vitest run src/app/privacidade/page.test.tsx
```

Expected: PASS, `Test Files  1 passed (1)` e `Tests  9 passed (9)`.

- [ ] **Step 6: Escrever o teste do `PrivacyLink` (falhando)**

Crie `src/components/privacy/PrivacyLink.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PrivacyLink } from "./PrivacyLink";

describe("PrivacyLink", () => {
  it("aponta para /privacidade", () => {
    render(<PrivacyLink />);
    expect(
      screen.getByRole("link", { name: "Privacidade e seus dados" }),
    ).toHaveAttribute("href", "/privacidade");
  });

  it("tem 44px de altura mínima abaixo de md (ui-rules §1.4)", () => {
    render(<PrivacyLink />);
    const classes = screen
      .getByRole("link", { name: "Privacidade e seus dados" })
      .className.split(" ");
    expect(classes).toContain("max-md:min-h-11");
    expect(classes).toContain("max-md:inline-flex");
  });
});
```

```bash
bunx vitest run src/components/privacy
```

Expected: FAIL, com `Error: Failed to resolve import "./PrivacyLink" from "src/components/privacy/PrivacyLink.test.tsx". Does the file exist?`.

- [ ] **Step 7: Criar o `PrivacyLink`**

Crie `src/components/privacy/PrivacyLink.tsx`. É o padrão do link solto (F6-16, `ui-rules §1.4`): sozinho numa linha, ganha `max-md:inline-flex max-md:min-h-11 max-md:items-center` e a classe do desktop não muda. Não precisa de `"use client"`.

```tsx
import Link from "next/link";

import { cn } from "@/lib/utils";

// Link para a página pública de privacidade. Sozinho numa linha, então ganha
// o alvo de toque de 44px abaixo de md (ui-rules §1.4).
export function PrivacyLink({ className }: { className?: string }) {
  return (
    <Link
      href="/privacidade"
      className={cn(
        "w-fit text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground max-md:inline-flex max-md:min-h-11 max-md:items-center",
        className,
      )}
    >
      Privacidade e seus dados
    </Link>
  );
}
```

```bash
bunx vitest run src/components/privacy
```

Expected: PASS, `Test Files  1 passed (1)` e `Tests  2 passed (2)`.

- [ ] **Step 8: Tornar `/privacidade` pública: teste do proxy (falhando)**

Substitua **o arquivo inteiro** `src/features/authz/proxyRules.test.ts` por esta versão (ela inclui os casos de `/redefinir-senha` da Tarefa 5, que continuam, e acrescenta os de `/privacidade`: 2 públicos, 2 privados de prefixo parecido e 1 de `shouldRedirectToSignIn`; no total, **5 testes a mais** que no fim da Tarefa 5):

```ts
import { describe, expect, it } from "vitest";

import {
  isPublicPath,
  PUBLIC_PATH_PREFIXES,
  shouldRedirectToSignIn,
} from "./proxyRules";

describe("isPublicPath", () => {
  it("os prefixos públicos são /entrar, /convite, /redefinir-senha e /privacidade", () => {
    expect(PUBLIC_PATH_PREFIXES).toEqual([
      "/entrar",
      "/convite",
      "/redefinir-senha",
      "/privacidade",
    ]);
  });

  it.each([
    "/entrar",
    "/entrar/",
    "/convite",
    "/convite/abc123",
    "/convite/abc123/",
    "/redefinir-senha",
    "/redefinir-senha/",
    "/privacidade",
    "/privacidade/",
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
    "/redefinir-senhas",
    "/redefinir-senha-x",
    "/privacidades",
    "/privacidade-x",
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
    "/redefinir-senha",
    "/privacidade",
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
    "/redefinir-senhas",
  ])("prefixo parecido %s sem cookie → redireciona", (pathname) => {
    expect(shouldRedirectToSignIn(pathname, false)).toBe(true);
  });
});
```

```bash
bunx vitest run src/features/authz/proxyRules.test.ts
```

Expected: FAIL, `Tests  4 failed | 44 passed (48)`: `os prefixos públicos são /entrar, /convite, /redefinir-senha e /privacidade` (`AssertionError: expected [ '/entrar', '/convite', …(1) ] to deeply equal [ '/entrar', '/convite', …(2) ]`), `/privacidade é pública` e `/privacidade/ é pública` (`expected false to be true`) e `rota pública /privacidade não redireciona, com ou sem cookie` (`expected true to be false`).

- [ ] **Step 9: Acrescentar `/privacidade` ao proxy**

Edite `src/features/authz/proxyRules.ts`: troque

```ts
  "/redefinir-senha",
];
```

por

```ts
  "/redefinir-senha",
  "/privacidade",
];
```

```bash
bunx vitest run src/features/authz/proxyRules.test.ts
```

Expected: PASS, `Tests  48 passed (48)`.

- [ ] **Step 10: Rodapé do `/entrar`: teste (falhando)**

Em `src/components/auth/SignInPanel.test.tsx`, **antes** do teste `it("e-mail aceita autofill de passkey e senha usa o autocomplete certo", () => {`, insira (a posição relativa nos dois parágrafos é o que o teste afirma; o teste "mostra os textos do contrato" não muda):

```tsx
  it("o rodapé tem o link para a página de privacidade, depois dos dois parágrafos", () => {
    setup();
    const link = screen.getByRole("link", { name: "Privacidade e seus dados" });
    expect(link).toHaveAttribute("href", "/privacidade");
    for (const text of [
      "O acesso é só por convite.",
      "Esqueceu a senha? Peça ao administrador um link para criar outra.",
    ]) {
      const paragraph = screen.getByText(text);
      expect(
        paragraph.compareDocumentPosition(link) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

```

```bash
bunx vitest run src/components/auth/SignInPanel.test.tsx
```

Expected: FAIL, `Tests  1 failed | 30 passed (31)` (29 do arquivo de hoje, 1 da Tarefa 5 e o novo; o que vale é **1** reprovado, o novo) com `TestingLibraryElementError: Unable to find an accessible element with the role "link" and name "Privacidade e seus dados"`.

- [ ] **Step 11: Pôr o `PrivacyLink` no rodapé do `SignInPanel`**

Em `src/components/auth/SignInPanel.tsx`, duas edições. Primeiro o import (a ordem alfabética de caminhos que o Biome impõe põe `privacy` antes de `ui`): troque

```tsx
import { Button } from "@/components/ui/button";
```

por

```tsx
import { PrivacyLink } from "@/components/privacy/PrivacyLink";
import { Button } from "@/components/ui/button";
```

Depois, o rodapé: troque

```tsx
          Esqueceu a senha? Peça ao administrador um link para criar outra.
        </p>
      </CardFooter>
```

por

```tsx
          Esqueceu a senha? Peça ao administrador um link para criar outra.
        </p>
        <PrivacyLink />
      </CardFooter>
```

```bash
bunx vitest run src/components/auth/SignInPanel.test.tsx
```

Expected: PASS, `Tests  31 passed (31)`.

- [ ] **Step 12: `PasskeyOffer`: teste (falhando)**

Em `src/components/auth/PasskeyOffer.test.tsx`, no teste `mostra os textos do contrato`, troque a string

```
"Quer entrar mais rápido da próxima vez? Crie uma passkey: você entra com a digital, o rosto ou o PIN do aparelho."
```

por

```
"A passkey é a forma mais rápida de entrar: você usa a digital, o rosto ou o PIN do aparelho, sem digitar senha. Se esquecer a senha, peça ao administrador um link para criar outra."
```

```bash
bunx vitest run src/components/auth/PasskeyOffer.test.tsx
```

Expected: FAIL, `Tests  1 failed | 10 passed (11)` com `TestingLibraryElementError: Unable to find an element with the text: A passkey é a forma mais rápida de entrar: você usa a digital, o rosto ou o PIN do aparelho, sem digitar senha. Se esquecer a senha, peça ao administrador um link para criar outra.`.

- [ ] **Step 13: `PasskeyOffer`: o texto novo**

Em `src/components/auth/PasskeyOffer.tsx`, troque o conteúdo do `CardDescription`:

```tsx
          Quer entrar mais rápido da próxima vez? Crie uma passkey: você entra
          com a digital, o rosto ou o PIN do aparelho.
```

por

```tsx
          A passkey é a forma mais rápida de entrar: você usa a digital, o rosto
          ou o PIN do aparelho, sem digitar senha. Se esquecer a senha, peça ao
          administrador um link para criar outra.
```

```bash
bunx vitest run src/components/auth/PasskeyOffer.test.tsx
```

Expected: PASS, `Tests  11 passed (11)`.

- [ ] **Step 14: O link no convite válido e em `/conta`**

Nenhuma das duas páginas tem teste de unidade (leem banco e sessão no servidor); a prova dos dois links é o E2E `publico (a)` da Tarefa 9, e o `touch-targets` mede `/conta`. Aqui só se edita e se confere os tipos.

Em `src/app/(auth)/convite/[token]/page.tsx`, três edições. (1) Depois do import de `InviteUnavailable`, acrescente o import do link:

```tsx
import { InviteUnavailable } from "@/components/auth/InviteUnavailable";
import { PrivacyLink } from "@/components/privacy/PrivacyLink";
```

(2) No import de `@/components/ui/card`, acrescente `CardFooter` entre `CardDescription` e `CardHeader`:

```tsx
  CardDescription,
  CardFooter,
  CardHeader,
```

(3) No cartão do convite **válido** (o que tem o `InviteSignup`; não no `InviteFallback`), depois do `CardContent` e antes do `</Card>`, o rodapé: troque

```tsx
          }
        />
      </CardContent>
    </Card>
```

por

```tsx
          }
        />
      </CardContent>
      <CardFooter>
        <PrivacyLink />
      </CardFooter>
    </Card>
```

Em `src/app/(app)/conta/page.tsx`, duas edições: o import (depois do de `SignOutButton`)

```tsx
import { SignOutButton } from "@/components/auth/SignOutButton";
import { PrivacyLink } from "@/components/privacy/PrivacyLink";
```

e o link depois do botão "Sair": troque

```tsx
      <SignOutButton />
    </>
```

por

```tsx
      <SignOutButton />
      <PrivacyLink />
    </>
```

```bash
bunx biome check --write "src/app/(auth)/convite/[token]/page.tsx" "src/app/(app)/conta/page.tsx"
bun run check-types
```

Expected: `Checked 2 files` sem erro e o `check-types` sem erro.

- [ ] **Step 15: A página entra no guarda de alvos de toque**

Em `e2e/touch-targets.spec.ts`, no teste do operador, logo depois da linha `await expectTouchSized(page, "/entrar");` (e antes da que mede `/redefinir-senha`, se a Tarefa 7 a pôs aí), acrescente:

```ts
  await expectTouchSized(page, "/privacidade");
```

Sem sessão, a página é aberta como visitante (a Tarefa 7 mede `/entrar` antes do cadastro). O link `Voltar para a entrada` e o `PrivacyLink` já têm o padrão do link solto.

- [ ] **Step 16: O catálogo de componentes: teste (falhando)**

Em `test/uiRegistryDoc.test.ts`, três edições. (1) Depois de `const dashboardFiles = …`, a varredura da pasta nova:

```ts
const privacyFiles = sourceFiles(join("src", "components", "privacy"));
```

(2) No `it.each` de arquivos, depois de `...dashboardFiles,`:

```ts
      ...dashboardFiles,
      ...privacyFiles,
      ...primitiveFiles,
```

(3) Na lista de cabeçalhos próprios, depois de `"StockTrendChart",`:

```ts
    "StockTrendChart",
    "PrivacyLink",
```

```bash
bunx vitest run test/uiRegistryDoc.test.ts
```

Expected: FAIL, `2 failed | 122 passed (124)`: `src\components\privacy\PrivacyLink.tsx está no catálogo` (`nenhuma menção a "PrivacyLink" em .context/ui-registry.md`) e `PrivacyLink tem cabeçalho próprio no catálogo (a menção solta não basta)`.

- [ ] **Step 17: Documentar no catálogo**

Crie o auxiliar `.git/sdd/f6/registry-history.mjs` com a ferramenta Write (ele acrescenta, ao fim da linha `- **Histórico:**` de cada um dos três blocos `###` do catálogo, o texto que está dentro dele, qualquer que seja o estado em que as tarefas anteriores deixaram o catálogo; falha se um bloco não existir; os textos ficam dentro do arquivo porque o Git Bash desta máquina corrompe acentos em argumentos). Fica fora do commit (`.git/`):

```js
// Uso: node .git/sdd/f6/registry-history.mjs <arquivo> <AAAA-MM-DD>
// Acrescenta "<data> — <texto>" ao fim da linha "- **Histórico:**" de cada bloco de ENTRIES;
// falha se um bloco ou a linha não existir. Os textos ficam aqui (e não na linha de comando)
// porque o Git Bash desta máquina corrompe acentos em argumentos.
import { readFileSync, writeFileSync } from "node:fs";

const ENTRIES = [
  ["SignInPanel", "Fase 6 (Tarefa 8): o rodapé termina com o `PrivacyLink` (`Privacidade e seus dados`), depois de `O acesso é só por convite.` e de `Esqueceu a senha? Peça ao administrador um link para criar outra.`."],
  ["PasskeyOffer", "Fase 6 (Tarefa 8): a descrição diz que a passkey é a forma mais rápida de entrar e que a recuperação é pelo administrador (`A passkey é a forma mais rápida de entrar: você usa a digital, o rosto ou o PIN do aparelho, sem digitar senha. Se esquecer a senha, peça ao administrador um link para criar outra.`); botões e comportamento iguais."],
  ["InviteSignup", "Fase 6 (Tarefa 8): o componente não muda; a página do convite válido (`/convite/[token]`) ganha um `CardFooter` com o `PrivacyLink`."],
];

const [file, date] = process.argv.slice(2);
if (!file || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
  console.error("Uso: node registry-history.mjs <arquivo> <AAAA-MM-DD>");
  process.exit(1);
}
const lines = readFileSync(file, "utf8").split("\n");
for (const [heading, text] of ENTRIES) {
  const start = lines.findIndex((line) => line === `### ${heading}`);
  if (start === -1) {
    console.error(`Bloco "### ${heading}" não encontrado em ${file}.`);
    process.exit(1);
  }
  let done = false;
  for (let i = start + 1; i < lines.length && !lines[i].startsWith("### "); i++) {
    if (lines[i].startsWith("- **Histórico:**")) {
      lines[i] = `${lines[i].trimEnd()} ${date} — ${text}`;
      done = true;
      break;
    }
  }
  if (!done) {
    console.error(`Bloco "### ${heading}" sem linha "- **Histórico:**".`);
    process.exit(1);
  }
  console.log(`Histórico de ${heading} atualizado.`);
}
writeFileSync(file, lines.join("\n"));
```

Em `.context/ui-registry.md`, **antes** do bloco `### PasskeyManager`, insira o bloco novo (Edit com `old_string` = `### PasskeyManager` seguido de quebra de linha, que aparece uma vez só, e `new_string` = o bloco abaixo seguido de `### PasskeyManager`):

```markdown
### PrivacyLink
- **Status:** ✅ pronto (<DATA>)
- **Local:** `src/components/privacy/PrivacyLink.tsx`
- **Propósito:** o link `Privacidade e seus dados` para a página pública `/privacidade`.
- **Como funciona:** Server Component (sem estado); `<Link href="/privacidade">` com `className` opcional (`cn`). Fica sozinho numa linha, então usa o padrão do link solto (`max-md:inline-flex max-md:min-h-11 max-md:items-center`, ui-rules §1.4). Aparece em três lugares: o rodapé do `SignInPanel` (`/entrar`), o `CardFooter` do convite válido (`/convite/[token]`) e `/conta` (depois de "Sair"). Não aparece no convite inválido nem dentro do shell (`/privacidade` é pública e tem o próprio link de volta para `/entrar`).
- **Usa:** `next/link`, `cn`.
- **Histórico:** <DATA> — criado na Fase 6 (Tarefa 8).

```

Substitua **só os `<DATA>`** (no bloco acima e na linha `Status`) pela **data do dia da execução** (a mesma do Step 0 da Tarefa 1); datas já existentes no arquivo ficam como estão. Depois acrescente o histórico dos três componentes que mudam de texto ou de vizinhança (a data é o único argumento além do arquivo; os textos acentuados estão no auxiliar):

```bash
node .git/sdd/f6/registry-history.mjs .context/ui-registry.md <DATA>
grep -c "Fase 6 (Tarefa 8)" .context/ui-registry.md
bunx vitest run test/uiRegistryDoc.test.ts
```

Expected: três linhas `Histórico de … atualizado.`, o `grep -c` com **4 ou mais** (a ficha nova e os três históricos; confirma que os acentos chegaram inteiros: `git diff .context/ui-registry.md` não pode mostrar `?` nem caracteres quebrados) e `Tests  124 passed (124)` (os 122 de antes, 119 do fim da Tarefa 5A mais 3 da 5B, e os 2 que estavam reprovados; o que vale é **0** reprovados).

- [ ] **Step 18: Arquitetura e P7**

Em `.context/architecture.md`:

1. §8, depois da linha `- **Sem upload de arquivos** no MVP (D10) — nenhum armazenamento de mídia.`, acrescente o item:

```markdown
- **Página de privacidade pública** (`/privacidade`, Fase 6): diz o que fica guardado (nome, e-mail,
  senha e passkeys, passagens e comentários com autoria, o IP e o navegador de cada acesso, relatórios
  de erro limpos), para quê, quem vê, onde fica (Vercel e Neon com o processamento em São Paulo, Sentry
  fora do Brasil), por quanto tempo (conta desativada, nunca apagada) e como pedir ajuda (o
  administrador do setor). O texto mora em `src/features/privacy/privacyContent.ts` e é **rascunho**
  (`PRIVACY_DRAFT = true`, com alerta visível) até o dono e a empresa aprovarem (C6-5); a troca para
  `false` é um PR curto depois da aprovação (runbook, passo B12). Cada frase só afirma o que a
  configuração garante: as afirmações de região dependem de `gru1` e do projeto Neon em `sa-east-1`.
  O link `Privacidade e seus dados` aparece em `/entrar`, no convite válido e em `/conta`.
```

2. §9, antes da linha da tabela que começa com ``| `/api/auth/[...all]` |``, a linha nova:

```markdown
| `/privacidade` | privacidade e seus dados: o que fica guardado, para quê, quem vê, onde fica, por quanto tempo e a quem pedir ajuda; alerta de rascunho enquanto `PRIVACY_DRAFT`. Estática (○ no build), fora de `(app)` e de `(auth)`. Pública | ✅ Fase 6 |
```

3. §9, a linha `Rotas públicas:` (rode `grep -n "^Rotas públicas" .context/architecture.md` para ver o estado em que a Tarefa 5 a deixou) passa a listar também `/privacidade`; por exemplo, se estiver como na Tarefa 5, a linha inteira fica:

```markdown
Rotas públicas: `/entrar`, `/convite/[token]`, `/redefinir-senha`, `/privacidade`, `/api/auth/*` e `/api/health`. Todo o resto exige sessão (`src/proxy.ts` + `requireUser()`).
```

Em `.context/pendencias.md`, na P7, com o Edit: `old_string` = `Falta o app da Meta publicado (privacidade e exclusão de dados); continua bloqueada.` (aparece uma vez só, no fim da última `Atualização`) e `new_string` = essa mesma frase, uma quebra de linha e o bloco abaixo (troque só o `<DATA>` pela data do dia; a `Atualização (2026-11-20)` que já existe fica):

```markdown
**Atualização (<DATA>):** a Fase 6 criou a página pública `/privacidade` (a URL de política de privacidade que a Meta pede), ainda em rascunho até o dono e a empresa aprovarem (`PRIVACY_DRAFT`). Continua bloqueada: faltam a página de instrução de exclusão de dados, o app da Meta publicado e, para ele, um domínio próprio (o piloto roda em `*.vercel.app`, D-F6-1).
```

```bash
bunx vitest run test/pendenciasDoc.test.ts
grep -n "^Rotas públicas" .context/architecture.md
```

Expected: `Tests  … passed` sem reprovado (a P7 continua `Bloqueado no dono`; o guarda só exige que o estado, a seção e o índice concordem) e a linha das rotas públicas com `/privacidade`.

- [ ] **Step 19: Verificação da tarefa**

```bash
bunx biome check --write .
bun run check-types
bun run lint
bun run test
```

Expected: `Fixed 0 files` (ou só formatação dos arquivos desta tarefa), `check-types` e `lint` sem erro, e `bun run test` verde: **2 arquivos e 19 testes a mais** que no fim da Tarefa 7 (`page.test.tsx` 9 + `PrivacyLink.test.tsx` 2 + `proxyRules` 5 + `SignInPanel` 1 + `uiRegistryDoc` 2; o `PasskeyOffer.test.tsx` só troca um texto). Anote os dois totais (`Test Files` e `Tests`): o fim da Tarefa 10 usa os seus. Se o `migration0002.test.ts` estourar 15 s, repita só ele (`bunx vitest run src/db/schema/migration0002.test.ts`).

Agora o build e o subconjunto do E2E (**um bloco só**, com a env fictícia: sem ela o build carrega o `.env.local` e fala com o Neon de desenvolvimento):

```bash
export DATABASE_URL="postgresql://closery:fake@127.0.0.1:1/closery?sslmode=disable" DATABASE_URL_POOLED="postgresql://closery:fake@127.0.0.1:1/closery?sslmode=disable" BETTER_AUTH_URL="http://localhost:3201" BETTER_AUTH_SECRET="segredo-local-de-teste-nao-usar-0123456789abcdef" NEXT_PUBLIC_SENTRY_DSN=""
bun run build
```

Expected: o build verde e a lista de rotas com `├ ○ /privacidade` e `├ ○ /redefinir-senha` (estáticas), sem nenhuma rota de API nova. Depois (as portas 3200 e 54329 precisam estar livres: `netstat -ano | grep -E ':(3200|54329) ' | grep LISTENING` sem saída):

```bash
bun run test:e2e -- e2e/auth.spec.ts e2e/passagem.spec.ts e2e/solicitacoes.spec.ts e2e/touch-targets.spec.ts
```

Expected: `24 passed` (7 + 6 + 9 do subconjunto de sempre e os 2 do `touch-targets`, o primeiro agora com `/privacidade`; o log do `[app]` pode mostrar `portal "" does not exist` sem reprovar teste). Se a contagem divergir, pare e reporte BLOCKED com o número medido.

- [ ] **Step 20: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/f6/msg-task-8.txt` (texto exato abaixo) e rode:

```bash
git add src/features/privacy src/app/privacidade src/components/privacy src/features/authz src/components/auth src/app/\(auth\)/convite src/app/\(app\)/conta e2e/touch-targets.spec.ts test/uiRegistryDoc.test.ts .context/ui-registry.md .context/architecture.md .context/pendencias.md
git status --short
git commit -F .git/sdd/f6/msg-task-8.txt
```

`git status --short` não pode listar nada fora desta tarefa (o auxiliar de `.git/sdd/` não aparece). Mensagem:

```text
feat(privacidade): página pública /privacidade e o link para ela

Página estática e pública (rascunho até a empresa aprovar) com o que fica
guardado, para quê, quem vê, onde fica, por quanto tempo e a quem pedir
ajuda, sem prometer mais do que a configuração garante. PrivacyLink no
rodapé do /entrar, no convite válido e em /conta; /privacidade entra na
lista pública do proxy. O PasskeyOffer diz que a recuperação da senha é
pelo administrador. Alvos de toque medidos também em /privacidade.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 9: E2E do link de redefinição e das páginas públicas

**Files:**
- Modify: `e2e/helpers.ts`
- Create: `e2e/redefinir-senha.spec.ts`
- Create: `e2e/publico.spec.ts`

Só testes de ponta a ponta: nenhuma linha de `src/` muda. A tarefa prova, no app em produção (`next start`, rate limit ligado) e com o Better Auth real, os caminhos que os testes de unidade só cobrem em pedaços: o administrador gera o link, outra pessoa troca a senha por ele, a antiga deixa de entrar, o link não vale duas vezes, a sessão aberta em outro navegador cai, e a página de privacidade, os cabeçalhos, o noindex e o `robots.txt` aparecem do jeito que a F6-3 e a F6-4 dizem.

**Interfaces:**
- Consumes: o botão `Nova senha` (`aria-label` `Gerar link de nova senha para {nome}`), o diálogo `Link de nova senha` com o campo `Link para copiar` e `Válido até` (Tarefa 5); `/redefinir-senha` com os títulos `Criar uma senha nova`, `Senha alterada` e `Link incompleto`, o campo `Senha nova` e o botão `Trocar a senha` (Tarefa 5); a mensagem `Este link de redefinição venceu ou já foi usado. Peça outro ao administrador.` (`INVALID_TOKEN`); `/privacidade` e `PrivacyLink` (Tarefa 8); os cabeçalhos, o `robots.ts` e a meta robots (Tarefa 1); `test`, `seedSector`, `unique`, `PASSWORD`, `signUpOperator`, `signUpAdmin` de `./helpers` e `countSessionsByEmail`, `openE2eDb`, `insertInvite`, `buildInviteUrl`, `E2E_BASE_URL` de `./db`.
- Produces: `signUpOperator(page, db, sectorId, name): Promise<string>` e `signUpAdmin(page, db, name): Promise<string>` devolvem o e-mail usado (nenhum chamador existente muda: todos ignoram o retorno); os 6 testes novos (a contagem do E2E inteiro vai a **43**).

- [ ] **Step 1: Escrever o primeiro spec (ele ainda não compila)**

Crie `e2e/redefinir-senha.spec.ts`. Cada teste cria os próprios dados (e-mails e nomes únicos, fictícios) e usa o `clientIp` do `test` de `./helpers` (um IP por teste: o rate limit do app em produção é por IP). Os operadores se cadastram num navegador à parte (`visitor`) e o administrador na `page` do teste. Os nomes começam com `Aa` porque a Equipe lista as pessoas ativas em ordem alfabética, 50 por página, e o banco do E2E vai enchendo com os outros specs: com `Aa` a pessoa está sempre na primeira página. Cada teste leva `test.slow()` (o limite de 30 s do Playwright triplica): cada um cadastra duas pessoas e abre até quatro navegadores, e na medição do planejamento, com a máquina carregada por outros processos, o (a) passou de 30 s (44 s) sem nenhum defeito (descarregada, 14 s).

```ts
import { type Browser, expect, type Page } from "@playwright/test";
import type { Pool } from "pg";

import type { Db } from "@/db/types";

import { countSessionsByEmail, openE2eDb } from "./db";
import {
  PASSWORD,
  seedSector,
  signUpAdmin,
  signUpOperator,
  test,
  unique,
} from "./helpers";

// Redefinição de senha pelo link do admin (D-F6-2): sem e-mail, o admin gera o
// link em /admin/equipe e a pessoa troca a senha em /redefinir-senha. O token
// viaja no fragmento (#token=...), que nunca chega ao servidor.

const NEW_PASSWORD = "outra-senha-de-teste-456";
const EXPIRED_MESSAGE =
  "Este link de redefinição venceu ou já foi usado. Peça outro ao administrador.";

let pool: Pool;
let db: Db;

test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});

test.afterAll(async () => {
  await pool.end();
});

// Navegador sem sessão e com o IP do teste (o app roda em produção, com rate
// limit por IP).
function visitor(browser: Browser, clientIp: string) {
  return browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": clientIp },
  });
}

// O admin abre a Equipe e gera o link de nova senha da pessoa. As pessoas ativas
// vêm em ordem alfabética (50 por página): nomes que começam com "Aa" ficam na
// primeira página mesmo com o banco cheio dos outros testes.
async function generateResetLink(
  adminPage: Page,
  person: { name: string; email: string },
): Promise<string> {
  await adminPage.goto("/admin/equipe");
  const row = adminPage
    .getByRole("main")
    .getByRole("listitem")
    .filter({ hasText: person.email });
  await row
    .getByRole("button", {
      name: `Gerar link de nova senha para ${person.name}`,
    })
    .click();
  const dialog = adminPage.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Link de nova senha" }),
  ).toBeVisible();
  await expect(dialog).toContainText("Válido até");
  const url = await dialog.getByLabel("Link para copiar").inputValue();
  expect(url).toMatch(/\/redefinir-senha#token=[A-Za-z0-9_-]{43}$/);
  return url;
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

async function resetWithLink(page: Page, url: string, password: string) {
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: "Criar uma senha nova" }),
  ).toBeVisible();
  await page.getByLabel("Senha nova").fill(password);
  await page.getByRole("button", { name: "Trocar a senha" }).click();
}

test("(a) admin gera o link de nova senha e o operador troca a senha: a nova entra e a antiga não", async ({
  page,
  browser,
  clientIp,
}) => {
  // Cada teste cadastra duas pessoas e abre até quatro navegadores: com a máquina
  // carregada os 30 s padrão não bastam.
  test.slow();
  const world = await seedSector(db);
  const operator = { name: `Aa Reset ${unique()}`, email: "" };
  const operatorContext = await visitor(browser, clientIp);
  operator.email = await signUpOperator(
    await operatorContext.newPage(),
    db,
    world.sector.id,
    operator.name,
  );
  await operatorContext.close();
  await signUpAdmin(page, db, `Aa Admin ${unique()}`);

  const url = await generateResetLink(page, operator);

  // Outro navegador, sem sessão, abre o link: o fragmento some da barra de
  // endereço assim que o formulário lê o token.
  const other = await visitor(browser, clientIp);
  const otherPage = await other.newPage();
  await resetWithLink(otherPage, url, NEW_PASSWORD);
  await expect(otherPage).toHaveURL(/\/redefinir-senha$/);
  await expect(
    otherPage.getByRole("heading", { name: "Senha alterada" }),
  ).toBeVisible();

  // A senha nova entra pelo link "Entrar" da própria tela.
  await otherPage.getByRole("link", { name: "Entrar", exact: true }).click();
  await expect(otherPage).toHaveURL(/\/entrar$/);
  await signIn(otherPage, operator.email, NEW_PASSWORD);
  await expect(otherPage).toHaveURL(/\/$/);
  await other.close();

  // A antiga não entra mais.
  const old = await visitor(browser, clientIp);
  const oldPage = await old.newPage();
  await signIn(oldPage, operator.email, PASSWORD);
  await expect(oldPage.getByText("E-mail ou senha incorretos.")).toBeVisible();
  await expect(oldPage).toHaveURL(/\/entrar$/);
  await old.close();
});

test("(b) o link usado de novo diz que venceu ou já foi usado, e sem o fragmento diz Link incompleto", async ({
  page,
  browser,
  clientIp,
}) => {
  // Cada teste cadastra duas pessoas e abre até quatro navegadores: com a máquina
  // carregada os 30 s padrão não bastam.
  test.slow();
  const world = await seedSector(db);
  const operator = { name: `Aa Reset ${unique()}`, email: "" };
  const operatorContext = await visitor(browser, clientIp);
  operator.email = await signUpOperator(
    await operatorContext.newPage(),
    db,
    world.sector.id,
    operator.name,
  );
  await operatorContext.close();
  await signUpAdmin(page, db, `Aa Admin ${unique()}`);
  const url = await generateResetLink(page, operator);

  const first = await visitor(browser, clientIp);
  const firstPage = await first.newPage();
  await resetWithLink(firstPage, url, NEW_PASSWORD);
  await expect(
    firstPage.getByRole("heading", { name: "Senha alterada" }),
  ).toBeVisible();
  await first.close();

  // O mesmo link de novo: o formulário abre (o token é lido do fragmento), mas
  // o servidor o recusa. O campo continua habilitado para o caso de typo.
  const again = await visitor(browser, clientIp);
  const againPage = await again.newPage();
  await resetWithLink(againPage, url, "mais-uma-senha-789");
  await expect(againPage.getByText(EXPIRED_MESSAGE)).toBeVisible();
  await expect(againPage.getByLabel("Senha nova")).toBeEnabled();
  await again.close();

  // A senha da primeira troca continua valendo.
  const check = await visitor(browser, clientIp);
  const checkPage = await check.newPage();
  await signIn(checkPage, operator.email, NEW_PASSWORD);
  await expect(checkPage).toHaveURL(/\/$/);
  await check.close();

  // Sem o fragmento não há o que trocar.
  const bare = await visitor(browser, clientIp);
  const barePage = await bare.newPage();
  await barePage.goto("/redefinir-senha");
  await expect(
    barePage.getByRole("heading", { name: "Link incompleto" }),
  ).toBeVisible();
  await expect(barePage.getByLabel("Senha nova")).toHaveCount(0);
  await expect(
    barePage.getByRole("link", { name: "Ir para a entrada" }),
  ).toHaveAttribute("href", "/entrar");
  await bare.close();
});

test("(c) trocar a senha pelo link encerra a sessão aberta em outro navegador", async ({
  page,
  browser,
  clientIp,
}) => {
  // Cada teste cadastra duas pessoas e abre até quatro navegadores: com a máquina
  // carregada os 30 s padrão não bastam.
  test.slow();
  const world = await seedSector(db);
  const operator = { name: `Aa Reset ${unique()}`, email: "" };
  // O operador fica com a sessão aberta neste navegador.
  const operatorContext = await visitor(browser, clientIp);
  const operatorPage = await operatorContext.newPage();
  operator.email = await signUpOperator(
    operatorPage,
    db,
    world.sector.id,
    operator.name,
  );
  expect(await countSessionsByEmail(db, operator.email)).toBe(1);

  await signUpAdmin(page, db, `Aa Admin ${unique()}`);
  const url = await generateResetLink(page, operator);

  const other = await visitor(browser, clientIp);
  const otherPage = await other.newPage();
  await resetWithLink(otherPage, url, NEW_PASSWORD);
  await expect(
    otherPage.getByRole("heading", { name: "Senha alterada" }),
  ).toBeVisible();
  await other.close();

  // A troca apagou a sessão do outro navegador (revokeSessionsOnPasswordReset).
  expect(await countSessionsByEmail(db, operator.email)).toBe(0);
  await operatorPage.goto("/");
  await expect(operatorPage).toHaveURL(/\/entrar$/);
  await operatorContext.close();
});
```

- [ ] **Step 2: Rodar a checagem de tipos e ver falhar**

```bash
bun run check-types
```

Expected: FAIL, com três erros `e2e/redefinir-senha.spec.ts(<linha>,3): error TS2322: Type 'void' is not assignable to type 'string'.` (as três atribuições `operator.email = await signUpOperator(`: hoje o helper devolve `Promise<void>`).

- [ ] **Step 3: Os helpers devolvem o e-mail**

Em `e2e/helpers.ts`, troque as duas funções `signUpOperator` e `signUpAdmin` (com o comentário que antecede a primeira) por:

```ts
// Cadastra um operador do setor pelo convite e deixa a sessão aberta no Início.
// Devolve o e-mail usado (o teste da redefinição de senha precisa dele).
export async function signUpOperator(
  page: Page,
  db: Db,
  sectorId: string,
  name: string,
): Promise<string> {
  const { token } = await insertInvite(db, { role: "operator", sectorId });
  const email = uniqueEmail();
  await signUpWithInviteToken(page, token, { name, email });
  await page.getByRole("link", { name: "Agora não" }).click();
  await expect(page).toHaveURL(/\/$/);
  return email;
}

// Cadastra um administrador pelo convite. Devolve o e-mail usado.
export async function signUpAdmin(
  page: Page,
  db: Db,
  name: string,
): Promise<string> {
  const { token } = await insertInvite(db, { role: "admin" });
  const email = uniqueEmail();
  await signUpWithInviteToken(page, token, { name, email });
  await page.getByRole("link", { name: "Agora não" }).click();
  await expect(page).toHaveURL(/\/$/);
  return email;
}
```

```bash
bunx biome check --write e2e
bun run check-types
```

Expected: `check-types` sem erro (os chamadores antigos continuam compilando: todos ignoram o retorno).

- [ ] **Step 4: Escrever o segundo spec**

Crie `e2e/publico.spec.ts`. O teste (b) usa `request.get(path, { maxRedirects: 0 })`: o `request` do Playwright herda o `x-forwarded-for` do `test` de `./helpers`, e o `maxRedirects: 0` garante que se vê a resposta da própria URL (nada de seguir o redirecionamento de `/` para `/entrar`).

```ts
import { expect } from "@playwright/test";
import type { Pool } from "pg";

import type { Db } from "@/db/types";

import { buildInviteUrl, E2E_BASE_URL, insertInvite, openE2eDb } from "./db";
import { seedSector, signUpOperator, test } from "./helpers";

// Páginas e cabeçalhos públicos da Fase 6: /privacidade, os cabeçalhos de
// segurança, o noindex e o Referrer-Policy das páginas que carregam token.

let pool: Pool;
let db: Db;

test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});

test.afterAll(async () => {
  await pool.end();
});

test("(a) /privacidade abre sem sessão e é linkada de /entrar, do convite e de /conta", async ({
  page,
}) => {
  // Visita cinco páginas e cadastra um operador: com a máquina carregada os 30 s
  // padrão não bastam.
  test.slow();
  // Direto, sem sessão: o proxy não redireciona para /entrar.
  await page.goto("/privacidade");
  await expect(page).toHaveURL(/\/privacidade$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Privacidade e seus dados" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Onde ficam" }),
  ).toBeVisible();

  // De /entrar.
  await page.goto("/entrar");
  await page.getByRole("link", { name: "Privacidade e seus dados" }).click();
  await expect(page).toHaveURL(/\/privacidade$/);
  await page.getByRole("link", { name: "Voltar para a entrada" }).click();
  await expect(page).toHaveURL(/\/entrar$/);

  // Do convite válido (o convite não é usado: só se abre a página).
  const { token } = await insertInvite(db, { role: "admin" });
  await page.goto(buildInviteUrl(E2E_BASE_URL, token));
  await expect(
    page.getByRole("heading", { name: "Você foi convidado" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Privacidade e seus dados" }).click();
  await expect(page).toHaveURL(/\/privacidade$/);

  // De /conta, logado.
  const world = await seedSector(db);
  await signUpOperator(page, db, world.sector.id, "Ana Teste");
  await page.goto("/conta");
  await page.getByRole("link", { name: "Privacidade e seus dados" }).click();
  await expect(page).toHaveURL(/\/privacidade$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Privacidade e seus dados" }),
  ).toBeVisible();
});

test("(b) cabeçalhos de segurança, noindex e sem Referer no convite e na redefinição", async ({
  request,
}) => {
  const entrar = await request.get("/entrar", { maxRedirects: 0 });
  expect(entrar.status()).toBe(200);
  const headers = entrar.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["content-security-policy"]).toBe("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["permissions-policy"]).toBe(
    "camera=(), microphone=(), geolocation=()",
  );
  expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
  // A meta robots do layout raiz é a terceira camada do noindex.
  expect(await entrar.text()).toContain(
    '<meta name="robots" content="noindex, nofollow"/>',
  );

  // Páginas cujo endereço carrega um token: nada de Referer para fora.
  for (const path of ["/convite/token-que-nao-existe", "/redefinir-senha"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(200);
    expect(response.headers()["referrer-policy"], path).toBe("no-referrer");
    // A regra global continua valendo junto da específica.
    expect(response.headers()["x-frame-options"], path).toBe("DENY");
  }
});

test("(c) /robots.txt bloqueia todos os buscadores", async ({ request }) => {
  const response = await request.get("/robots.txt", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("User-Agent: *");
  expect(body).toContain("Disallow: /");
});
```

- [ ] **Step 5: Rodar os dois specs e o guarda de toque**

As portas 3200 e 54329 precisam estar livres (`netstat -ano | grep -E ':(3200|54329) ' | grep LISTENING` sem saída). O comando constrói o app (cerca de 3 min nesta máquina) e roda os três arquivos:

```bash
bun run test:e2e -- e2e/redefinir-senha.spec.ts e2e/publico.spec.ts e2e/touch-targets.spec.ts
```

Expected: `8 passed`: os 3 de `publico.spec.ts` (a, b e c), os 3 de `redefinir-senha.spec.ts` (a, b e c) e os 2 de `touch-targets.spec.ts`. O log do `[app]` não mostra `WARN [Better Auth]` cru (o logger da Tarefa 4 descarta os avisos); no máximo uma linha JSON `{"level":"error","context":"better-auth",…}` (o login com a senha antiga do teste (a) é esperado).

Se o `(b)` de `publico` reprovar com `Referrer-Policy` duplicado (`no-referrer, strict-origin-when-cross-origin`), a ordem das regras do `next.config.ts` não está como a F6-3 manda (global primeiro, `no-referrer` depois): confira a Tarefa 1 e a 5 antes de mexer neste teste.

- [ ] **Step 6: Verificação da tarefa**

```bash
bun run lint
bun run check-types
bun run test
```

Expected: tudo verde e o `bun run test` com os **mesmos totais** do fim da Tarefa 8 (esta tarefa não acrescenta teste ao Vitest). Depois, com as portas livres, o E2E **inteiro**:

```bash
bun run test:e2e
```

Expected: `43 passed` (7 `auth` + 6 `cadastros` + 7 `dashboard` + 6 `passagem` + 3 `publico` + 3 `redefinir-senha` + 9 `solicitacoes` + 2 `touch-targets`). Se divergir, pare e reporte BLOCKED com o número medido.

- [ ] **Step 7: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/f6/msg-task-9.txt` e rode (o `git status --short` só pode listar os três arquivos de `e2e/`):

```bash
git add e2e/helpers.ts e2e/redefinir-senha.spec.ts e2e/publico.spec.ts
git status --short
git commit -F .git/sdd/f6/msg-task-9.txt
```

Mensagem:

```text
test(e2e): link de redefinição de senha e páginas públicas

Três cenários da redefinição pelo link do administrador (a senha nova
entra e a antiga não; link usado de novo e sem fragmento; a sessão aberta
em outro navegador cai) e três das páginas públicas (/privacidade e seus
links; cabeçalhos de segurança, noindex e no-referrer; robots.txt). Os
helpers de cadastro passam a devolver o e-mail usado.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 10: Runbook de produção, smoke test, documentação, pendências e verificação final

**Files:**
- Create: `scripts/smokeChecks.mjs`
- Create: `scripts/smoke.mjs`
- Create: `test/smokeChecks.test.ts`
- Create: `.context/runbook-producao.md`
- Create: `.git/sdd/f6/pendencia-update.mjs`, `.git/sdd/f6/guard-t10.txt`, `.git/sdd/f6/docs-fase6.mjs` (auxiliares descartáveis, fora do commit)
- Modify: `package.json` (só o script `smoke`)
- Modify: `.context/pendencias.md` (P62–P76 e as `Atualização` de P1, P6 e P10)
- Modify: `test/pendenciasDoc.test.ts`
- Modify: `.context/architecture.md` (§5, §9 e §10)
- Modify: `.context/progress-tracker.md`, `.context/build-plan.md`, `memory.md`, `AGENTS.md`
- Confere (sem editar, salvo falha): `.context/library-docs.md`

Esta é a última tarefa do SDD: depois dela o código está pronto e o que falta é a **Parte B (go-live)**, que o controlador conduz com o dono pelo runbook. **Nada aqui toca produção nem serviço externo:** o smoke roda só contra o `next start` local (3201, banco inacessível), e o runbook é só texto (sem host, DSN, domínio real nem link de convite: o repositório é público).

**Interfaces:**
- Consumes: as Tarefas 1 a 9 (`vercel.json`, `next.config.ts` com os cabeçalhos, `robots.ts`, `/api/health`, `/privacidade`, `/redefinir-senha`, o `admin:invite --confirmar-host` e o `db:hosts` da Tarefa 3, o `createPasswordResetLink` da Tarefa 5, o Sentry da Tarefa 6).
- Produces: `bun run smoke <url> [--local]` (`scripts/smoke.mjs`) e as regras puras de `scripts/smokeChecks.mjs` (`SMOKE_USAGE`, `SMOKE_LABELS`, `parseSmokeArgs`, `checkHealth`, `functionRegionOf`, `checkRegion`, `checkHsts`, `checkSecurityHeaders`, `checkNoindex`, `checkRobots`, `checkNoReferrer`, `checkRedirectToSignIn`, `checkPublicPage`, `formatSmokeReport`); `.context/runbook-producao.md`; as pendências P62 a P76 (o próximo id livre passa a **P77**).

- [ ] **Step 1: Escrever o teste das regras do smoke (falhando)**

Crie `test/smokeChecks.test.ts`. Ele importa o `.mjs` (o `tsconfig` tem `allowJs`, então os tipos vêm do JSDoc do módulo) e cobre, para cada regra, o caso bom e as falhas: argumentos (`https` qualquer, `http` só para o próprio computador, caminho descartado, sem URL, URL inválida, argumento desconhecido), saúde do banco (200 ok; 503; corpo que não é JSON; JSON errado), região (3, 2, 1 segmento, vazio, `null`), HSTS, os seis cabeçalhos, noindex (cabeçalho sem meta e meta sem cabeçalho), `robots.txt`, `no-referrer`, redirecionamento, página pública e o relatório (linhas, resumo e código de saída).

```ts
import { describe, expect, it } from "vitest";

import {
  checkHealth,
  checkHsts,
  checkNoindex,
  checkNoReferrer,
  checkPublicPage,
  checkRedirectToSignIn,
  checkRegion,
  checkRobots,
  checkSecurityHeaders,
  formatSmokeReport,
  functionRegionOf,
  parseSmokeArgs,
  SMOKE_LABELS,
  SMOKE_USAGE,
} from "../scripts/smokeChecks.mjs";

// Guarda das regras puras do smoke test (scripts/smokeChecks.mjs). O CLI
// (scripts/smoke.mjs) só busca as páginas e chama estas funções.

const SECURITY = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "content-security-policy": "frame-ancestors 'none'",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "x-robots-tag": "noindex, nofollow",
};

function without(name: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(SECURITY).filter(([key]) => key !== name),
  );
}

describe("SMOKE_LABELS", () => {
  it("tem os dez rótulos do contrato, congelados", () => {
    expect(Object.keys(SMOKE_LABELS)).toEqual([
      "health",
      "region",
      "hsts",
      "security-headers",
      "noindex",
      "robots",
      "no-referrer-convite",
      "no-referrer-redefinir",
      "redirect",
      "privacy",
    ]);
    expect(Object.isFrozen(SMOKE_LABELS)).toBe(true);
    expect(SMOKE_LABELS.health).toBe(
      "GET /api/health responde 200 com o banco",
    );
  });
});

describe("parseSmokeArgs", () => {
  it("fica só com a origem e descarta caminho e query", () => {
    expect(parseSmokeArgs(["https://x.vercel.app/qualquer?y=1"])).toEqual({
      origin: "https://x.vercel.app",
      local: false,
    });
  });

  it.each([
    ["http://localhost:3201", "http://localhost:3201"],
    ["http://127.0.0.1:3201", "http://127.0.0.1:3201"],
  ])("aceita http só para o próprio computador (%s)", (arg, origin) => {
    expect(parseSmokeArgs([arg, "--local"])).toEqual({ origin, local: true });
  });

  it("lê --local antes ou depois da URL", () => {
    expect(parseSmokeArgs(["--local", "http://localhost:3201"]).local).toBe(
      true,
    );
  });

  it("recusa http fora do localhost e protocolo que não é web", () => {
    const message = `Use https:// (http só para localhost). ${SMOKE_USAGE}`;
    expect(() => parseSmokeArgs(["http://exemplo.test"])).toThrow(message);
    expect(() => parseSmokeArgs(["ftp://exemplo.test"])).toThrow(message);
  });

  it("recusa sem URL, URL inválida e argumento desconhecido, com o uso", () => {
    expect(() => parseSmokeArgs([])).toThrow(
      `Informe a URL do app. ${SMOKE_USAGE}`,
    );
    expect(() => parseSmokeArgs(["--local"])).toThrow(
      `Informe a URL do app. ${SMOKE_USAGE}`,
    );
    expect(() => parseSmokeArgs(["nao-e-url"])).toThrow(
      `URL inválida: nao-e-url. ${SMOKE_USAGE}`,
    );
    expect(() => parseSmokeArgs(["https://x.vercel.app", "--rapido"])).toThrow(
      `Argumento desconhecido: --rapido. ${SMOKE_USAGE}`,
    );
    expect(() =>
      parseSmokeArgs(["https://x.vercel.app", "https://y.vercel.app"]),
    ).toThrow(`Argumento desconhecido: https://y.vercel.app. ${SMOKE_USAGE}`);
  });
});

describe("checkHealth", () => {
  const good = JSON.stringify({ status: "ok", database: "ok", latencyMs: 12 });

  it("ok com 200 e o JSON do banco ok", () => {
    expect(checkHealth(200, good)).toMatchObject({
      id: "health",
      status: "ok",
      detail: null,
    });
  });

  it("falha com 503 (banco inacessível)", () => {
    expect(
      checkHealth(
        503,
        JSON.stringify({ status: "error", database: "unreachable" }),
      ),
    ).toMatchObject({ status: "falhou", detail: "status 503" });
  });

  it.each([
    ["corpo que não é JSON", "<html>erro</html>"],
    [
      "JSON com o banco diferente de ok",
      JSON.stringify({ status: "ok", database: "slow" }),
    ],
    ["JSON sem os campos", "{}"],
    ["JSON nulo", "null"],
    ["corpo vazio", ""],
  ])("200 com %s é resposta inesperada", (_name, body) => {
    expect(checkHealth(200, body)).toMatchObject({
      status: "falhou",
      detail: "resposta inesperada",
    });
  });
});

describe("functionRegionOf", () => {
  it.each([
    ["gru1::gru1::abc-1700000000000-def", "gru1"],
    ["gru1::iad1::abc-1700000000000-def", "iad1"],
    ["gru1::iad1", "gru1"],
    ["gru1", null],
    ["", null],
    [null, null],
    [undefined, null],
  ])("%s → %s", (value, expected) => {
    expect(functionRegionOf(value)).toBe(expected);
  });
});

describe("checkRegion", () => {
  it("local fica pulado, com ou sem cabeçalho", () => {
    expect(checkRegion(null, true).status).toBe("pulado");
    expect(checkRegion("gru1::iad1::x", true).status).toBe("pulado");
  });

  it("ok quando a função roda em gru1", () => {
    expect(checkRegion("gru1::gru1::abc-1", false)).toMatchObject({
      id: "region",
      status: "ok",
    });
  });

  it("falha sem o cabeçalho, em outra região e com formato desconhecido", () => {
    expect(checkRegion(null, false)).toMatchObject({
      status: "falhou",
      detail: "sem x-vercel-id",
    });
    expect(checkRegion("gru1::iad1::abc-1", false)).toMatchObject({
      status: "falhou",
      detail: "região iad1 (x-vercel-id: gru1::iad1::abc-1)",
    });
    expect(checkRegion("abc", false)).toMatchObject({
      status: "falhou",
      detail: "região desconhecida (x-vercel-id: abc)",
    });
  });
});

describe("checkHsts", () => {
  it("local fica pulado", () => {
    expect(checkHsts(new Headers(), true).status).toBe("pulado");
  });

  it("ok com max-age", () => {
    const headers = new Headers({
      "strict-transport-security":
        "max-age=63072000; includeSubDomains; preload",
    });
    expect(checkHsts(headers, false)).toMatchObject({
      id: "hsts",
      status: "ok",
    });
  });

  it("falha sem o cabeçalho e com valor sem max-age", () => {
    expect(checkHsts(new Headers(), false)).toMatchObject({
      status: "falhou",
      detail: "sem Strict-Transport-Security",
    });
    expect(
      checkHsts(new Headers({ "strict-transport-security": "preload" }), false),
    ).toMatchObject({
      status: "falhou",
      detail: "Strict-Transport-Security sem max-age: preload",
    });
  });
});

describe("checkSecurityHeaders", () => {
  it("ok com os seis valores exatos e status 200", () => {
    expect(checkSecurityHeaders(200, new Headers(SECURITY))).toMatchObject({
      id: "security-headers",
      status: "ok",
    });
  });

  it("falha com status diferente de 200, antes de olhar os cabeçalhos", () => {
    expect(checkSecurityHeaders(307, new Headers(SECURITY))).toMatchObject({
      status: "falhou",
      detail: "status 307",
    });
  });

  it("falha dizendo qual cabeçalho falta", () => {
    expect(
      checkSecurityHeaders(200, new Headers(without("x-frame-options"))),
    ).toMatchObject({ status: "falhou", detail: "falta X-Frame-Options" });
  });

  it("falha dizendo o cabeçalho e o valor errado (inclusive CSP com script-src)", () => {
    expect(
      checkSecurityHeaders(
        200,
        new Headers({
          ...SECURITY,
          "content-security-policy": "default-src 'self'",
        }),
      ),
    ).toMatchObject({
      status: "falhou",
      detail: "Content-Security-Policy: default-src 'self'",
    });
  });
});

describe("checkNoindex", () => {
  const html = '<head><meta name="robots" content="noindex, nofollow"/></head>';
  const header = new Headers({ "x-robots-tag": "noindex, nofollow" });

  it("ok com o cabeçalho e a meta", () => {
    expect(checkNoindex(header, html)).toMatchObject({
      id: "noindex",
      status: "ok",
    });
  });

  it("cabeçalho sem a meta falha", () => {
    expect(checkNoindex(header, "<head></head>")).toMatchObject({
      status: "falhou",
      detail: "falta a meta robots no HTML",
    });
  });

  it("meta sem o cabeçalho falha, e o valor errado também", () => {
    expect(checkNoindex(new Headers(), html)).toMatchObject({
      status: "falhou",
      detail: "X-Robots-Tag: ausente",
    });
    expect(
      checkNoindex(new Headers({ "x-robots-tag": "noindex" }), html),
    ).toMatchObject({ status: "falhou", detail: "X-Robots-Tag: noindex" });
  });
});

describe("checkRobots", () => {
  it("ok com 200, User-Agent * e Disallow /", () => {
    expect(checkRobots(200, "User-Agent: *\nDisallow: /\n")).toMatchObject({
      id: "robots",
      status: "ok",
    });
  });

  it("falha com status diferente de 200 e com robots.txt que libera", () => {
    expect(checkRobots(404, "")).toMatchObject({
      status: "falhou",
      detail: "status 404",
    });
    expect(checkRobots(200, "User-Agent: *\nAllow: /\n")).toMatchObject({
      status: "falhou",
      detail: "o robots.txt não bloqueia tudo",
    });
  });
});

describe("checkNoReferrer", () => {
  it.each<"no-referrer-convite" | "no-referrer-redefinir">([
    "no-referrer-convite",
    "no-referrer-redefinir",
  ])("%s: ok com no-referrer", (id) => {
    expect(
      checkNoReferrer(id, new Headers({ "referrer-policy": "no-referrer" })),
    ).toMatchObject({ id, status: "ok" });
  });

  it("falha com a política global e sem o cabeçalho", () => {
    expect(
      checkNoReferrer(
        "no-referrer-convite",
        new Headers({ "referrer-policy": "strict-origin-when-cross-origin" }),
      ),
    ).toMatchObject({
      status: "falhou",
      detail: "Referrer-Policy: strict-origin-when-cross-origin",
    });
    expect(
      checkNoReferrer("no-referrer-redefinir", new Headers()),
    ).toMatchObject({
      status: "falhou",
      detail: "Referrer-Policy: ausente",
    });
  });
});

describe("checkRedirectToSignIn", () => {
  it.each([
    "/entrar",
    "https://x.vercel.app/entrar",
  ])("307 para %s é ok", (location) => {
    expect(checkRedirectToSignIn(307, location)).toMatchObject({
      id: "redirect",
      status: "ok",
    });
  });

  it("200 falha", () => {
    expect(checkRedirectToSignIn(200, null)).toMatchObject({
      status: "falhou",
      detail: "status 200",
    });
  });

  it("307 para outro lugar e 307 sem Location falham", () => {
    expect(checkRedirectToSignIn(307, "/login")).toMatchObject({
      status: "falhou",
      detail: "Location: /login",
    });
    expect(checkRedirectToSignIn(307, null)).toMatchObject({
      status: "falhou",
      detail: "sem Location",
    });
  });
});

describe("checkPublicPage", () => {
  it("200 é ok; redirecionamento e erro falham", () => {
    expect(checkPublicPage(200)).toMatchObject({ id: "privacy", status: "ok" });
    expect(checkPublicPage(307)).toMatchObject({
      status: "falhou",
      detail: "status 307",
    });
    expect(checkPublicPage(500)).toMatchObject({
      status: "falhou",
      detail: "status 500",
    });
  });
});

describe("formatSmokeReport", () => {
  const okResult = checkPublicPage(200);
  const failResult = checkPublicPage(503);
  const skipped = checkRegion(null, true);

  it("escreve uma linha por verificação e o resumo, e sai com 0 sem falha", () => {
    expect(formatSmokeReport([okResult, skipped])).toEqual({
      text: [
        "[OK] /privacidade abre sem sessão",
        "[PULADO] Função em gru1 (x-vercel-id) (só na Vercel)",
        "Resultado: 1 OK, 0 FALHOU, 1 PULADO.",
      ].join("\n"),
      exitCode: 0,
    });
  });

  it("qualquer FALHOU leva o código de saída a 1", () => {
    expect(formatSmokeReport([okResult, failResult, skipped])).toEqual({
      text: [
        "[OK] /privacidade abre sem sessão",
        "[FALHOU] /privacidade abre sem sessão: status 503",
        "[PULADO] Função em gru1 (x-vercel-id) (só na Vercel)",
        "Resultado: 1 OK, 1 FALHOU, 1 PULADO.",
      ].join("\n"),
      exitCode: 1,
    });
  });

  it("sem verificações o resumo é zero e o código é 0", () => {
    expect(formatSmokeReport([])).toEqual({
      text: "Resultado: 0 OK, 0 FALHOU, 0 PULADO.",
      exitCode: 0,
    });
  });
});
```

```bash
bunx vitest run test/smokeChecks.test.ts
```

Expected: FAIL, `Error: Cannot find module '../scripts/smokeChecks.mjs' imported from …/test/smokeChecks.test.ts`, `Test Files  1 failed (1)` e `Tests  no tests`.

- [ ] **Step 2: Implementar as regras puras**

Crie `scripts/smokeChecks.mjs`. É JavaScript com tipos em JSDoc (o pedido do plano é um `.mjs`); nada aqui faz I/O nem lê ambiente, então o teste é determinístico. O `x-vercel-id` tem o formato `<borda>::<função>::<id>`: a região da função é o **penúltimo** segmento (formato confirmado só no primeiro deploy, P63; o CLI imprime o valor cru quando a região falha).

```js
// Regras puras do smoke test de produção (scripts/smoke.mjs). Nada aqui faz I/O
// nem lê ambiente: o CLI busca as páginas e passa para estas funções o status,
// os cabeçalhos e o corpo. Os textos são os da seção "Textos de interface" do
// plano da Fase 6.

/** @typedef {"health"|"region"|"hsts"|"security-headers"|"noindex"|"robots"|"no-referrer-convite"|"no-referrer-redefinir"|"redirect"|"privacy"} SmokeId */
/** @typedef {{ id: SmokeId, label: string, status: "ok" | "falhou" | "pulado", detail: string | null }} SmokeResult */
/** @typedef {{ get(name: string): string | null }} HeaderBag */

export const SMOKE_USAGE =
  "Uso: bun run smoke <https://<projeto>.vercel.app> [--local]";

/** @type {Readonly<Record<SmokeId, string>>} */
export const SMOKE_LABELS = Object.freeze({
  health: "GET /api/health responde 200 com o banco",
  region: "Função em gru1 (x-vercel-id)",
  hsts: "HSTS enviado pela Vercel",
  "security-headers": "Cabeçalhos de segurança em /entrar",
  noindex: "noindex no cabeçalho e no HTML de /entrar",
  robots: "/robots.txt bloqueia os buscadores",
  "no-referrer-convite": "/convite sem Referer",
  "no-referrer-redefinir": "/redefinir-senha sem Referer",
  redirect: "/ sem sessão vai para /entrar",
  privacy: "/privacidade abre sem sessão",
});

// Os seis cabeçalhos de segurança da F6-3, com os valores exatos.
const SECURITY_HEADERS = [
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  ["Content-Security-Policy", "frame-ancestors 'none'"],
  ["X-Frame-Options", "DENY"],
  ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
  ["X-Robots-Tag", "noindex, nofollow"],
];

const NOINDEX_VALUE = "noindex, nofollow";
const ROBOTS_META = '<meta name="robots" content="noindex, nofollow"';
const FUNCTION_REGION = "gru1";

/**
 * @param {SmokeId} id
 * @param {"ok" | "falhou" | "pulado"} status
 * @param {string | null} [detail]
 * @returns {SmokeResult}
 */
function result(id, status, detail = null) {
  return { id, label: SMOKE_LABELS[id], status, detail };
}

/** @param {SmokeId} id */
function ok(id) {
  return result(id, "ok");
}

/**
 * @param {SmokeId} id
 * @param {string} detail
 */
function failed(id, detail) {
  return result(id, "falhou", detail);
}

/**
 * @param {string[]} argv
 * @returns {{ origin: string, local: boolean }}
 */
export function parseSmokeArgs(argv) {
  let rawUrl = null;
  let local = false;
  for (const arg of argv) {
    if (arg === "--local") {
      local = true;
    } else if (arg.startsWith("--") || rawUrl !== null) {
      throw new Error(`Argumento desconhecido: ${arg}. ${SMOKE_USAGE}`);
    } else {
      rawUrl = arg;
    }
  }
  if (rawUrl === null) {
    throw new Error(`Informe a URL do app. ${SMOKE_USAGE}`);
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`URL inválida: ${rawUrl}. ${SMOKE_USAGE}`);
  }
  const isLocalHost =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";
  const allowed =
    url.protocol === "https:" || (url.protocol === "http:" && isLocalHost);
  if (!allowed) {
    throw new Error(`Use https:// (http só para localhost). ${SMOKE_USAGE}`);
  }
  return { origin: url.origin, local };
}

/**
 * @param {number} status
 * @param {string} bodyText
 * @returns {SmokeResult}
 */
export function checkHealth(status, bodyText) {
  if (status !== 200) return failed("health", `status ${status}`);
  try {
    const body = JSON.parse(bodyText);
    if (body?.status === "ok" && body?.database === "ok") return ok("health");
  } catch {
    // corpo que não é JSON cai na resposta inesperada
  }
  return failed("health", "resposta inesperada");
}

// O x-vercel-id é "<borda>::<função>::<id>": a região da função é o penúltimo
// segmento (formato confirmado só no primeiro deploy, P63).
/**
 * @param {string | null | undefined} xVercelId
 * @returns {string | null}
 */
export function functionRegionOf(xVercelId) {
  if (!xVercelId) return null;
  const segments = xVercelId.split("::");
  if (segments.length < 2) return null;
  return segments[segments.length - 2] || null;
}

/**
 * @param {string | null | undefined} xVercelId
 * @param {boolean} local
 * @returns {SmokeResult}
 */
export function checkRegion(xVercelId, local) {
  if (local) return result("region", "pulado");
  if (!xVercelId) return failed("region", "sem x-vercel-id");
  const region = functionRegionOf(xVercelId);
  if (region === null) {
    return failed("region", `região desconhecida (x-vercel-id: ${xVercelId})`);
  }
  if (region !== FUNCTION_REGION) {
    return failed("region", `região ${region} (x-vercel-id: ${xVercelId})`);
  }
  return ok("region");
}

/**
 * @param {HeaderBag} headers
 * @param {boolean} local
 * @returns {SmokeResult}
 */
export function checkHsts(headers, local) {
  if (local) return result("hsts", "pulado");
  const value = headers.get("strict-transport-security");
  if (!value) return failed("hsts", "sem Strict-Transport-Security");
  if (!/max-age=\d+/i.test(value)) {
    return failed("hsts", `Strict-Transport-Security sem max-age: ${value}`);
  }
  return ok("hsts");
}

/**
 * @param {number} status
 * @param {HeaderBag} headers
 * @returns {SmokeResult}
 */
export function checkSecurityHeaders(status, headers) {
  if (status !== 200) return failed("security-headers", `status ${status}`);
  for (const [name, expected] of SECURITY_HEADERS) {
    const value = headers.get(name);
    if (value === null) return failed("security-headers", `falta ${name}`);
    if (value !== expected) {
      return failed("security-headers", `${name}: ${value}`);
    }
  }
  return ok("security-headers");
}

/**
 * @param {HeaderBag} headers
 * @param {string} html
 * @returns {SmokeResult}
 */
export function checkNoindex(headers, html) {
  const header = headers.get("x-robots-tag");
  if (header !== NOINDEX_VALUE) {
    return failed("noindex", `X-Robots-Tag: ${header ?? "ausente"}`);
  }
  if (!html.includes(ROBOTS_META)) {
    return failed("noindex", "falta a meta robots no HTML");
  }
  return ok("noindex");
}

/**
 * @param {number} status
 * @param {string} text
 * @returns {SmokeResult}
 */
export function checkRobots(status, text) {
  if (status !== 200) return failed("robots", `status ${status}`);
  if (!text.includes("User-Agent: *") || !text.includes("Disallow: /")) {
    return failed("robots", "o robots.txt não bloqueia tudo");
  }
  return ok("robots");
}

/**
 * @param {"no-referrer-convite" | "no-referrer-redefinir"} id
 * @param {HeaderBag} headers
 * @returns {SmokeResult}
 */
export function checkNoReferrer(id, headers) {
  const value = headers.get("referrer-policy");
  if (value !== "no-referrer") {
    return failed(id, `Referrer-Policy: ${value ?? "ausente"}`);
  }
  return ok(id);
}

/**
 * @param {number} status
 * @param {string | null} location
 * @returns {SmokeResult}
 */
export function checkRedirectToSignIn(status, location) {
  if (status !== 307) return failed("redirect", `status ${status}`);
  if (location === null) return failed("redirect", "sem Location");
  if (!location.endsWith("/entrar")) {
    return failed("redirect", `Location: ${location}`);
  }
  return ok("redirect");
}

/**
 * @param {number} status
 * @returns {SmokeResult}
 */
export function checkPublicPage(status) {
  if (status !== 200) return failed("privacy", `status ${status}`);
  return ok("privacy");
}

/**
 * @param {SmokeResult[]} results
 * @returns {{ text: string, exitCode: 0 | 1 }}
 */
export function formatSmokeReport(results) {
  const lines = results.map((entry) => {
    if (entry.status === "ok") return `[OK] ${entry.label}`;
    if (entry.status === "pulado")
      return `[PULADO] ${entry.label} (só na Vercel)`;
    return `[FALHOU] ${entry.label}: ${entry.detail}`;
  });
  const count = (/** @type {SmokeResult["status"]} */ status) =>
    results.filter((entry) => entry.status === status).length;
  lines.push(
    `Resultado: ${count("ok")} OK, ${count("falhou")} FALHOU, ${count("pulado")} PULADO.`,
  );
  return {
    text: lines.join("\n"),
    exitCode: count("falhou") > 0 ? 1 : 0,
  };
}
```

```bash
bunx vitest run test/smokeChecks.test.ts
```

Expected: PASS, `Test Files  1 passed (1)` e `Tests  47 passed (47)`.

- [ ] **Step 3: O CLI e o script `smoke` (vermelho primeiro)**

Antes de criar o script, confirme que ele ainda não existe:

```bash
bun run smoke
```

Expected: FAIL, `error: Script not found "smoke"`.

Crie `scripts/smoke.mjs`. Só `GET`, sem credencial, sem seguir redirecionamento (`redirect: "manual"`), sem cache (`cache: "no-store"`), com o `user-agent` `closery-smoke`. Cada página é buscada **uma vez** e alimenta as verificações dela; uma página que não respondeu reprova as verificações dela com `sem resposta` (menos `region` e `hsts` com `--local`, que ficam `PULADO` de qualquer jeito).

```js
// Smoke test de produção: `bun run smoke https://<projeto>.vercel.app`.
// Só GET, sem credencial e sem seguir redirecionamento. As regras vivem em
// scripts/smokeChecks.mjs (testadas); aqui só se busca cada página uma vez e se
// repassa o resultado. Use --local para o `next start` do próprio computador
// (as verificações que só a Vercel responde ficam PULADO).
import {
  checkHealth,
  checkHsts,
  checkNoindex,
  checkNoReferrer,
  checkPublicPage,
  checkRedirectToSignIn,
  checkRegion,
  checkRobots,
  checkSecurityHeaders,
  formatSmokeReport,
  parseSmokeArgs,
  SMOKE_LABELS,
} from "./smokeChecks.mjs";

/**
 * @param {string} origin
 * @param {string} path
 * @returns {Promise<{ status: number, headers: Headers, body: string } | null>}
 */
async function fetchPage(origin, path) {
  try {
    const response = await fetch(`${origin}${path}`, {
      redirect: "manual",
      cache: "no-store",
      headers: { "user-agent": "closery-smoke" },
    });
    return {
      status: response.status,
      headers: response.headers,
      body: await response.text(),
    };
  } catch {
    return null;
  }
}

/**
 * A página que não respondeu reprova todas as verificações dela.
 * @typedef {{ status: number, headers: Headers, body: string }} Page
 * @param {import("./smokeChecks.mjs").SmokeId} id
 * @param {Page | null} page
 * @param {(page: Page) => import("./smokeChecks.mjs").SmokeResult} check
 * @returns {import("./smokeChecks.mjs").SmokeResult}
 */
function runCheck(id, page, check) {
  if (page === null) {
    return {
      id,
      label: SMOKE_LABELS[id],
      status: "falhou",
      detail: "sem resposta",
    };
  }
  return check(page);
}

async function main() {
  const { origin, local } = parseSmokeArgs(process.argv.slice(2));

  const health = await fetchPage(origin, "/api/health");
  const signIn = await fetchPage(origin, "/entrar");
  const robots = await fetchPage(origin, "/robots.txt");
  const invite = await fetchPage(origin, "/convite/smoke-token-inexistente");
  const reset = await fetchPage(origin, "/redefinir-senha");
  const home = await fetchPage(origin, "/");
  const privacy = await fetchPage(origin, "/privacidade");

  // Com --local, região e HSTS só a Vercel responde: ficam PULADO mesmo que a
  // página não tenha respondido.
  const results = [
    runCheck("health", health, (page) => checkHealth(page.status, page.body)),
    local
      ? checkRegion(null, true)
      : runCheck("region", health, (page) =>
          checkRegion(page.headers.get("x-vercel-id"), false),
        ),
    local
      ? checkHsts(new Headers(), true)
      : runCheck("hsts", signIn, (page) => checkHsts(page.headers, false)),
    runCheck("security-headers", signIn, (page) =>
      checkSecurityHeaders(page.status, page.headers),
    ),
    runCheck("noindex", signIn, (page) =>
      checkNoindex(page.headers, page.body),
    ),
    runCheck("robots", robots, (page) => checkRobots(page.status, page.body)),
    runCheck("no-referrer-convite", invite, (page) =>
      checkNoReferrer("no-referrer-convite", page.headers),
    ),
    runCheck("no-referrer-redefinir", reset, (page) =>
      checkNoReferrer("no-referrer-redefinir", page.headers),
    ),
    runCheck("redirect", home, (page) =>
      checkRedirectToSignIn(page.status, page.headers.get("location")),
    ),
    runCheck("privacy", privacy, (page) => checkPublicPage(page.status)),
  ];

  const report = formatSmokeReport(results);
  console.log(report.text);
  process.exitCode = report.exitCode;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha inesperada.");
  process.exitCode = 1;
});
```

Em `package.json`, acrescente o script depois de `"test:e2e": "playwright test"` (não esqueça a vírgula nessa linha):

```json
    "test:e2e": "playwright test",
    "smoke": "bun scripts/smoke.mjs"
```

```bash
bunx biome check --write scripts test/smokeChecks.test.ts package.json
```

Expected: `Checked … files` sem erro (o Biome reformata os dois `.mjs` e o teste conforme o `biome.json`; os arquivos deste plano já estão no formato dele).

- [ ] **Step 4: Rodar o CLI de verdade contra o `next start` local**

Um bloco só, **com a env fictícia no começo** (sem ela o `next start` carregaria o `.env.local` e falaria com o Neon de desenvolvimento, um serviço externo proibido; o banco fictício recusa na hora, `ECONNREFUSED`). A porta 3000 é de outro processo: use a 3201. Se já houver `.next` (o build do E2E da Tarefa 9), ele serve; senão rode `bun run build` antes (com a mesma env).

```bash
export DATABASE_URL="postgresql://closery:fake@127.0.0.1:1/closery?sslmode=disable" DATABASE_URL_POOLED="postgresql://closery:fake@127.0.0.1:1/closery?sslmode=disable" BETTER_AUTH_URL="http://localhost:3201" BETTER_AUTH_SECRET="segredo-local-de-teste-nao-usar-0123456789abcdef" NEXT_PUBLIC_SENTRY_DSN=""
test -f .next/BUILD_ID || bun run build
(bun run start -p 3201 > .git/sdd/f6/start-3201.log 2>&1 &)
curl -s -o /dev/null --retry 60 --retry-delay 1 --retry-connrefused http://localhost:3201/robots.txt
bun run smoke http://localhost:3201 --local; echo "código $?"
echo ---
bun run smoke http://localhost:3201; echo "código $?"
echo ---
bun run smoke http://localhost:3299 --local; echo "código $?"
echo ---
bun run smoke; echo "código $?"
bun run smoke http://exemplo.test; echo "código $?"
```

Expected, nesta ordem:

1. Com `--local`: `[FALHOU] GET /api/health responde 200 com o banco: status 503`, `[PULADO] Função em gru1 (x-vercel-id) (só na Vercel)`, `[PULADO] HSTS enviado pela Vercel (só na Vercel)`, sete linhas `[OK]` (`Cabeçalhos de segurança em /entrar`, `noindex no cabeçalho e no HTML de /entrar`, `/robots.txt bloqueia os buscadores`, `/convite sem Referer`, `/redefinir-senha sem Referer`, `/ sem sessão vai para /entrar`, `/privacidade abre sem sessão`) e `Resultado: 7 OK, 1 FALHOU, 2 PULADO.`, `código 1`. O 503 é o esperado: o banco fictício recusa, e é a prova de que o `/api/health` não responde 200 sem banco.
2. Sem `--local`: `[FALHOU] Função em gru1 (x-vercel-id): sem x-vercel-id` e `[FALHOU] HSTS enviado pela Vercel: sem Strict-Transport-Security` (só a Vercel os manda) e `Resultado: 7 OK, 3 FALHOU, 0 PULADO.`, `código 1`.
3. Porta sem servidor, com `--local`: oito linhas `[FALHOU] …: sem resposta`, as duas `[PULADO]` e `Resultado: 0 OK, 8 FALHOU, 2 PULADO.`, `código 1`.
4. Sem argumento: `Informe a URL do app. Uso: bun run smoke <https://<projeto>.vercel.app> [--local]`, `código 1`; com `http://exemplo.test`: `Use https:// (http só para localhost). Uso: bun run smoke <https://<projeto>.vercel.app> [--local]`, `código 1`.

Se a ordem ou o número de linhas for outro, pare e reporte BLOCKED com a saída. Depois, **encerre só o servidor da 3201**:

```bash
netstat -ano | grep ':3201' | grep LISTENING
taskkill //PID <pid da linha acima> //F
```

Expected: o processo finalizado e nenhuma linha em `netstat -ano | grep ':3201 ' | grep LISTENING`. (A 3000 não é sua: não a toque.)

- [ ] **Step 5: O runbook de produção**

Crie `.context/runbook-producao.md` com a ferramenta Write (o texto é a Parte B do plano, passo a passo, com os comandos exatos, quem faz cada coisa e onde o dono confirma). As cercas externas abaixo têm quatro crases porque o arquivo tem blocos de três dentro:

````markdown
# Runbook de produção — Closery

> **Passo a passo do go-live e da semana de piloto.** É a Parte B da Fase 6: o que acontece
> **depois** que o código da Fase 6 está na `main`. Nada daqui roda em teste automatizado nem em
> tarefa de subagente. Decisões que mandam aqui: D-F6-1 a D-F6-5 (dono) e C6-1 a C6-8
> (controlador), em `docs/superpowers/plans/2026-11-25-fase-6-producao.md`.
>
> **O repositório é público:** este arquivo nunca leva host de banco, connection string, DSN,
> domínio real de produção nem link de convite. Onde falta um valor, aparece `<projeto>.vercel.app`
> ou `<host do pooler>`.

---

## Regras que nunca mudam

1. **Confirmação na hora.** Todo passo marcado **[confirma]** (deploy, variável, migração de
   produção, `admin:invite` em produção, proteção da `main`, rollback, rotação de segredo, convite
   real) só acontece com o "sim" explícito do dono **naquele momento** (C6-7). Um "sim" antigo não
   vale.
2. **Quem digita o quê.** O **Dono** abre um Git Bash **fora da sessão do agente** e digita os
   comandos que o **Controlador** (o agente) dita. O Controlador **nunca** roda os comandos que
   carregam segredo pela ferramenta Bash (ela não é interativa: o `read -rs` recebe EOF) e **nunca**
   recebe a saída do `openssl` nem a do `admin:invite` com sucesso (o link de convite é um segredo).
   O Dono repassa só o host impresso e o código de saída.
3. **A URL de produção só no shell que o Dono abre** e fecha no fim (`exit`). Lida com
   `read -rs` para não ir ao histórico. Nunca em arquivo, nunca no `.env.local`, nunca em chat.
4. **Nunca `BETTER_AUTH_SECRETS`** (o Better Auth a lê sozinha do ambiente e passaria a aceitar
   segredos antigos). Só `BETTER_AUTH_SECRET`.
5. **Nunca "Reset from parent"** no Neon levando dado real de produção para a branch de dev.
6. **Nenhuma passagem de teste em produção.** O ensaio funcional é local, contra a branch de dev
   (passo B11).
7. **Nunca a porta 3000.** Ela pertence a outro processo; as verificações locais usam a 3201.
8. **Segredo nunca é impresso.** Nem connection string, nem `BETTER_AUTH_SECRET`, nem DSN, nem
   token, nem link de convite ou de nova senha, nem o `.env.local`.

## Variáveis da Vercel (só o ambiente Production)

| Variável | Valor | Observação |
|---|---|---|
| `DATABASE_URL_POOLED` | URL **com pooler** do projeto Neon de produção, `sslmode=verify-full` | Sensitive. É a única URL de banco na Vercel |
| `BETTER_AUTH_SECRET` | 32 bytes aleatórios em base64 | Sensitive. O Dono gera e cola direto no campo (B5) |
| `BETTER_AUTH_URL` | `https://<projeto>.vercel.app`, sem barra final | O host vira o `rpID` das passkeys (P66) |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN do projeto no Sentry | Público por natureza; gravado no build: trocar exige novo deploy |

**Nunca na Vercel:** `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (a URL direta só existe no shell da
migração), `BETTER_AUTH_SECRETS`, `SENTRY_AUTH_TOKEN`, `GOOGLE_*`, `FACEBOOK_*` (o Google e o
Facebook ficam desligados no piloto, C6-1) e `DATABASE_POOL_MAX` (é só do E2E).

---

## Passos

### B0. PR da Fase 6

- **Controlador:** abre o PR da `feat/fase-6-producao` na `main` com os desvios no corpo: domínio
  `*.vercel.app`, recuperação de senha pelo link do administrador (P8 segue aberta), Hobby, Neon
  Free, sem CSP de scripts, Sentry fora do país.
- Espera o CI (`Tipos, lint e testes` e `E2E (Playwright)`) verde.
- **Dono:** lê e aprova o texto de `/privacidade` (C6-5) e aprova o merge. **[confirma]** Ainda não
  há Vercel ligada: o merge não publica nada.

### B1. Proteção da `main` (P62)

Antes de ligar a Vercel (a integração publica todo push na `main`).

- **Controlador** escreve `.git/sdd/f6/protecao-main.json` com a ferramenta Write:

```json
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "Tipos, lint e testes" },
      { "context": "E2E (Playwright)" }
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null
}
```

- **[confirma]**, depois:

```bash
gh api -X PUT "repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/branches/main/protection" --input .git/sdd/f6/protecao-main.json
gh api "repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/branches/main/protection" -q '.required_status_checks.checks[].context'
```

Esperado: os dois nomes de check impressos.

### B2. Neon de produção

**Dono**, no console do Neon:

1. Projeto **novo** de produção (C6-4), plano Free, região AWS São Paulo (`sa-east-1`), a mesma
   versão do Postgres da dev.
2. Autoscaling 0,25–0,25 CU, scale-to-zero ligado, nenhum monitor que consulte o banco (D-F6-4).
3. Copiar as duas connection strings (pooler e direta) trocando `sslmode=require` por
   `sslmode=verify-full` e guardar **só** no gerenciador de senhas.
4. Tirar do `.env.local` as URLs de produção comentadas (o Dono edita; ninguém imprime o arquivo).

### B3. Sentry

**Dono:** conta grátis, projeto Next.js, copiar o DSN. Em Security & Privacy: Data Scrubber e
Default Scrubbers ligados, "Prevent Storing of IP Addresses" ligado. Anotar a região de dados da
organização (fora do Brasil, como diz `/privacidade`).

### B4. Migração de produção (C6-3)

Nunca no build nem no CI. O `drizzle-kit` não tem trava de host: a trava é conferir o host impresso
pelo `db:hosts` antes do `db:migrate`.

1. **Dono**, no console do Neon: uma branch de segurança a partir da `main` do projeto novo.
2. **Dono** abre um Git Bash novo, na pasta do repositório, **fora da sessão do agente**, e cola a
   URL **direta** (não imprime nada):

```bash
read -rs DATABASE_URL_UNPOOLED
export DATABASE_URL_UNPOOLED DATABASE_URL="$DATABASE_URL_UNPOOLED"
bun run db:hosts
```

3. O Dono compara **só a linha `Banco das migrações (drizzle-kit)`** com o host do console do Neon.
   A linha `Banco da aplicação (runtime)` mostra o pooler de **dev** do `.env.local`: é esperado,
   ignore. Se o host das migrações não for o do projeto novo: **pare** e `exit`.
4. **[confirma]**, depois:

```bash
bun run db:migrate
```

5. No SQL Editor do Neon (projeto de produção): `select count(*) from drizzle.__drizzle_migrations;`
   deve dar **5**.
6. `exit` (a URL some com o shell).

### B5. Vercel

**Dono**, no painel da Vercel:

1. Plano Hobby (D-F6-3; riscos aceitos em P65). Importar o repositório; Framework Next.js. Os
   comandos de instalação e de build e a região (`gru1`) vêm do `vercel.json`. Conferir Node 22.x e
   Fluid compute ligado (padrão).
2. Variáveis **só de Production**, as da tabela acima. Para o segredo, no próprio Git Bash do Dono,
   fora da sessão do agente: `openssl rand -base64 32` e colar direto no campo da Vercel (marcar
   Sensitive). O Controlador não vê o valor.
3. Deployment Protection no padrão.
4. **[confirma]** o primeiro deploy, com o Dono olhando o painel.

### B6. O domínio de produção é o `BETTER_AUTH_URL`

**Dono:** conferir o domínio que a Vercel atribuiu. Se for diferente do `BETTER_AUTH_URL`,
corrigir a variável e fazer redeploy **antes de qualquer conta** (o `rpID` das passkeys é esse
host, D-F6-1 e P66). **[confirma]** o redeploy.

Use e divulgue só `https://<projeto>.vercel.app` (o mesmo do `BETTER_AUTH_URL`): os aliases
`<projeto>-<escopo>.vercel.app` e `<projeto>-git-main-<escopo>.vercel.app` não servem para entrar
(o login e as passkeys só valem no host do `BETTER_AUTH_URL`).

### B7. Smoke

**Controlador** (só `GET`, sem credencial):

```bash
bun run smoke https://<projeto>.vercel.app
```

Esperado: `Resultado: 10 OK, 0 FALHOU, 0 PULADO.` Se `region` falhar, o script imprime o
`x-vercel-id` cru: anote-o em P63 (o formato só se confirma no primeiro deploy).

Depois de uma tentativa de login (qualquer e-mail), nos logs da Vercel (guardam só 1 hora no
Hobby): **nenhuma** linha com `better-auth:ip-desconhecido` (P22; o aviso do Better Auth sobre IP
foi trocado por esse contexto). Anotar o resultado em P63. Depois do primeiro PR pós-go-live,
conferir que a branch dele **não** gerou deployment (previews desligados). Procure também no log
da Vercel linhas com `SERVER_ERROR` ou `Failed query` (o `# SERVER_ERROR` do `better-call` e o
`⨯ Error` do Next saem com o erro cru) e registre o que achar em P75.

### B8. `admin:invite` em produção

1. **Dono** abre um Git Bash novo, na pasta do repositório, **fora da sessão do agente**, e cola a
   URL do **pooler**:

```bash
read -rs DATABASE_URL_POOLED
export DATABASE_URL_POOLED BETTER_AUTH_URL=https://<projeto>.vercel.app
bun run admin:invite
```

2. Sem a flag, o script imprime `Banco de destino: <host>` e para com erro. O Dono repassa **só o
   host**; o Dono compara o host impresso com o host do pooler no console do Neon (ou repassa os
   dois ao Controlador). Diferente: **pare** e `exit`.
3. **[confirma]**, depois:

```bash
bun run admin:invite --confirmar-host=<host impresso> --label "Administrador"
```

4. O link de convite aparece **só** na tela do Dono (vale 7 dias, uma conta só). O Dono repassa
   apenas o código de saída (`echo $?`). `exit`. O Controlador nunca recebe a saída de sucesso.

### B9. Primeiro administrador

**Dono** (o Controlador guia, sem ver senha nem link):

1. Abre o link, cadastra e-mail e senha e cria a passkey no celular; cria uma **segunda** passkey em
   outro aparelho (`/conta` mostra 2).
2. Autoteste da redefinição: `/admin/equipe` → `Nova senha` na própria linha → abre o link numa
   janela anônima → troca a senha → `Senha alterada` → todas as sessões caem → entra de novo com a
   passkey e com a senha nova.
3. Conferir no DevTools que o cookie de sessão é o `__Secure-…session_token`.
4. Abrir o detalhe rápido de uma solicitação e conferir que abre no painel lateral (P44).

### B10. Cadastro inicial

**Dono** (administrador), **pela interface**: setor ULD, turnos reais, itens e destinos validados
com o usuário final (P5, spec §15). Nada vem do repositório. **Nenhuma passagem de teste em
produção.**

### B11. Ensaio funcional

**Controlador + Dono**, localmente (nunca a 3000), contra a branch de **dev** do Neon:

```bash
bun run build && bun run start -p 3201
```

Uma passagem completa (rascunho → entregar → outra conta confirma) e uma solicitação.

### B12. LGPD (P64)

1. **Dono:** aprovação **por escrito** da empresa (controladora dos dados).
2. **Controlador:** PR curto com `PRIVACY_DRAFT = false` e `PRIVACY_UPDATED_AT` do dia em
   `src/features/privacy/privacyContent.ts`, CI verde. **[confirma]** o merge (vira deploy).

**Sem essa aprovação, ninguém é convidado.**

### B13. Calendário do piloto

**Dono**, com a liderança do setor:

- Dia −2: linha de base na planilha, com cronômetro (C6-6).
- Dia −1: convites.
- Dias 0 a 7: o app **e** a planilha em paralelo; observador nos dias 1, 3 e 5.
- Corte para a planilha se o app ficar fora por mais de 15 minutos no horário da passagem.
- Revisão de saída no dia 7 ou 8 (B18).

### B14. Convites reais (dia −1)

**Dono** (administrador): um convite por operador em `/admin/equipe`, entregue em mãos ou por
WhatsApp; cada pessoa cria a passkey no próprio celular. **[confirma]** antes do primeiro convite.

Cartão de treinamento, 5 linhas: como entregar o turno; como receber; o dia operacional é o dia em
que o turno **começou**; "Esqueceu a senha? Peça o link ao administrador"; onde ver a página
`/privacidade`; o endereço do app é só `https://<projeto>.vercel.app` (nunca os aliases
`-<escopo>` e `-git-main-`, onde o login e as passkeys não funcionam).

### B15. Rotina diária (10 minutos)

**Dono/administrador:**

- `/dashboard` (últimos 7 dias): esperadas × entregues × confirmadas, sem passagem, não
  confirmadas, paradas.
- Baixar o CSV do dia para uma pasta privada **fora do repositório** (cópia diária; mitigação do
  restore de 6 horas do Free).
- Sentry: eventos novos; revisar se algum traz dado de pessoa (P69).
- Neon: consumo de CU-h do mês (100 no Free); acima de 70% avisar o Controlador.
- Problemas no canal privado da equipe, **nunca** em issue pública.

**Durante o piloto (C6-8):** anotar cada ocorrência de P23, P34, P35, P36, P44 e P53 numa
`Atualização`. P57: um `EXPLAIN ANALYZE` das consultas do dashboard no SQL Editor do Neon, uma vez,
fora do horário da passagem (gasta CU-h).

### B16. Rollback

- **App:** Instant Rollback da Vercel (no Hobby, só para o deploy imediatamente anterior); depois
  promover o deploy bom (a atribuição automática do domínio desliga até alguém promover; as
  variáveis **não** voltam junto).
- **Banco:** restaurar pela branch de segurança ou pelo restore de 6 horas do Free. Migração
  futura sempre expand-then-contract, com branch de segurança antes.
- **[confirma]** em qualquer rollback.

### B17. Rotação de segredos

**[confirma]** em cada um:

- `BETTER_AUTH_SECRET`: valor novo na Vercel + redeploy (desloga todos; senhas e passkeys não
  dependem dele).
- Senha do Neon: reset no console, atualizar `DATABASE_URL_POOLED` na Vercel, redeploy.
- DSN do Sentry: trocar na Vercel e fazer redeploy (o DSN vai no build).

### B18. Revisão de saída (dia 7 ou 8)

**Dono + equipe:** tempo (mediana da planilha × a do app), perda de informação, dias sem passagem,
go/no-go. **Controlador:** registra cada achado em `.context/pendencias.md` como
`Aberto, não triado` e revisa P65 (Pro e Launch).

---

## Se algo der errado no meio

- O host impresso não confere: **pare**, `exit`, nada foi escrito (o `db:migrate` e o
  `admin:invite` só rodam depois da conferência).
- O smoke reprova: leia a linha `[FALHOU]`; o `x-vercel-id` cru entra em P63. Não convide ninguém
  antes de o smoke dar `10 OK`.
- O link de nova senha de alguém vazou: gere outro (o anterior deixa de valer na hora). Desativar a
  conta também derruba o link.
- Suspeita de segredo exposto: B17 e, se for a URL do banco, resetar a senha no Neon primeiro.
````

Confira que o arquivo não tem segredo nem endereço real (o repositório é público):

```bash
grep -nE "postgres(ql)?://|neon\.tech|sntrys_|https://[a-z0-9]+@|sentry\.io|\.vercel\.app" .context/runbook-producao.md | grep -vE "<projeto>|\*\.vercel\.app" || true
```

Expected: nenhuma linha (só aparecem `<projeto>.vercel.app` e a menção genérica `*.vercel.app`).

- [ ] **Step 6: Pendências P62 a P76: o guarda (falhando)**

Crie o auxiliar `.git/sdd/f6/guard-t10.txt` com a ferramenta Write (o texto dos dois casos novos do guarda; ele **começa** com uma linha em branco e é inserido antes do `});` final de `test/pendenciasDoc.test.ts`):

```text


  it("Fase 6: P62 a P76 entraram como Aberto, não triado", () => {
    for (let number = 62; number <= 76; number++) {
      const id = `P${number}`;
      const entry = entries.get(id);
      expect(entry?.state, id).toBe("Aberto, não triado");
      expect(entry?.section, id).toBe("1");
      expect(index.get(id), `${id}: índice`).toBe("Aberto, não triado");
    }
  });

  it("Fase 6: P1, P6 e P10 ganharam a Atualização da produção", () => {
    for (const id of ["P1", "P6", "P10"]) {
      expect(
        entries.get(id)?.updates.some((date) => date >= "2026-11-25"),
        id,
      ).toBe(true);
    }
    expect(entries.get("P6")?.state).toBe("Bloqueado no dono");
    expect(entries.get("P10")?.state).toBe("Bloqueado no dono");
    expect(entries.get("P1")?.state).toBe("Resolvido");
  });
```

```bash
node -e 'const fs=require("fs");const p="test/pendenciasDoc.test.ts";const s=fs.readFileSync(p,"utf8");const add=fs.readFileSync(".git/sdd/f6/guard-t10.txt","utf8").trimEnd();const i=s.lastIndexOf("\n});");if(i<0)throw new Error("fim do describe não encontrado");fs.writeFileSync(p,s.slice(0,i)+add+s.slice(i));'
bunx biome check test/pendenciasDoc.test.ts
bunx vitest run test/pendenciasDoc.test.ts
```

Expected: o Biome sem erro e o Vitest FAIL com `2 failed`: `Fase 6: P62 a P76 entraram como Aberto, não triado` (`AssertionError: P62: expected undefined to be 'Aberto, não triado'`) e `Fase 6: P1, P6 e P10 ganharam a Atualização da produção` (`AssertionError: P1: expected false to be true`). Os outros casos continuam verdes.

- [ ] **Step 7: Registrar as pendências**

Em `.context/pendencias.md`, quatro edições. As datas (`**Registrado em:**` e as `Atualização`) são a **data do dia da execução** (os blocos abaixo trazem `2026-11-25`, o dia do planejamento).

1. A linha `**Ids:** …` passa de **Próximo id livre: P62** a **P77**: troque `**Próximo id livre: P62.**` por `**Próximo id livre: P77.**`.

2. No índice, depois da linha `| P61 | Ajustes de UX da Fase 5 | ⚪ | Aberto, não triado |`, acrescente:

```markdown
| P62 | A `main` não tem proteção: push direto vira deploy sem CI | 🟠 | Aberto, não triado |
| P63 | Comportamento na Vercel só se confirma no primeiro deploy | 🟡 | Aberto, não triado |
| P64 | Aprovação da empresa (LGPD) pendente e /privacidade em rascunho | 🟠 | Aberto, não triado |
| P65 | Riscos aceitos do Hobby e do Neon Free no piloto | 🟠 | Aberto, não triado |
| P66 | Passkeys presas ao host *.vercel.app | 🟡 | Aberto, não triado |
| P67 | Fechar a aba com o salvamento automático na fila perde o que não foi salvo | 🟡 | Aberto, não triado |
| P68 | Sentry sem source maps e com +67 KB gzip de JS no cliente | ⚪ | Aberto, não triado |
| P69 | scrubEvent só limpa padrões conhecidos da mensagem de erro | 🟡 | Aberto, não triado |
| P70 | Alvos de toque medidos só no Chromium emulado | ⚪ | Aberto, não triado |
| P71 | Sem instalação como app (manifest e ícones) | ⚪ | Aberto, não triado |
| P72 | Tempo de preenchimento da passagem sem medição automática | ⚪ | Aberto, não triado |
| P73 | Suíte do Vitest lenta e teste de migração com timeout sob carga | ⚪ | Aberto, não triado |
| P74 | admin:invite não mostra quantos administradores ativos existem | ⚪ | Aberto, não triado |
| P75 | Next imprime o erro não tratado inteiro no log da Vercel | 🟡 | Aberto, não triado |
| P76 | Gerar link de nova senha não deixa registro de quem gerou | 🟡 | Aberto, não triado |
```

3. Na seção `## 1. Aberto, não triado`, **antes** da linha `## 2. Triado, plano pronto` (isto é, depois do bloco da P61), insira as quinze pendências (o bloco termina com uma linha em branco, que separa da seção seguinte):

````markdown
#### P62 — A `main` não tem proteção: push direto vira deploy sem CI 🟠
**Estado:** Aberto, não triado
**Arquivos:** `.github/workflows/ci.yml`
**Impacto:** com a integração Git da Vercel, todo push na `main` publica, inclusive sem o CI verde; "PR só entra com o CI verde" não é imposto pelo GitHub.
**Correção:** — (opção: proteção da `main` com os checks `Tipos, lint e testes` e `E2E (Playwright)`, passo B1 do runbook, antes de ligar a Vercel)
**Registrado em:** 2026-11-25

#### P63 — Comportamento na Vercel só se confirma no primeiro deploy 🟡
**Estado:** Aberto, não triado
**Arquivos:** `vercel.json` · `next.config.ts` · `src/lib/auth/createAuth.ts` · `src/lib/sentry/options.ts`
**Impacto:** a Fase 6 não fez deploy, então ficou sem prova: `gru1` e o formato do `x-vercel-id`, o HSTS da Vercel, o `deploymentEnabled` ignorando as branches, o `bunx bun@1.3.3` na imagem de build, o `engines` sobre a configuração do painel, o IP do rate limit sem o aviso do Better Auth, o envio real e o flush do Sentry, a passkey com a `Permissions-Policy` em navegador real e o detalhe rápido com `next-url` (P44).
**Correção:** — (opção: conferir no primeiro deploy, passos B7 e B9 do runbook, e registrar o resultado aqui)
**Registrado em:** 2026-11-25

#### P64 — Aprovação da empresa (LGPD) pendente e /privacidade em rascunho 🟠
**Estado:** Aberto, não triado
**Arquivos:** `src/features/privacy/privacyContent.ts`
**Impacto:** sem a autorização do controlador dos dados (a empresa) ninguém é convidado; a retenção é "enquanto o uso durar", sem prazo; não existe ação de anonimizar uma pessoa desligada (a conta só se desativa).
**Correção:** — (opção: passo B12 do runbook, com o texto aprovado por escrito e o PR curto de `PRIVACY_DRAFT = false`; depois, uma ação de anonimizar que mantenha o id)
**Registrado em:** 2026-11-25

#### P65 — Riscos aceitos do Hobby e do Neon Free no piloto 🟠
**Estado:** Aberto, não triado
**Arquivos:** —
**Impacto:** o plano Hobby da Vercel é "personal or non-commercial", guarda logs por 1 hora, só faz rollback para o deploy imediatamente anterior e tem uma região; o Neon Free dá 100 CU-h por mês por projeto, suspende o projeto quando acaba e restaura só até 6 horas atrás.
**Correção:** — (opção: rever no go/no-go da semana de piloto e decidir entre Pro e Launch)
**Registrado em:** 2026-11-25

#### P66 — Passkeys presas ao host *.vercel.app 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/lib/auth/createAuth.ts` (`rpID`)
**Impacto:** o `rpID` das passkeys é o host de `BETTER_AUTH_URL`; trocar para um domínio próprio invalida todas as passkeys (a senha e o link do administrador continuam). Sem domínio próprio também não há e-mail (P8) nem Apple (P6).
**Correção:** — (opção: comprar o domínio antes de crescer além do piloto e pedir às pessoas que criem a passkey de novo)
**Registrado em:** 2026-11-25

#### P67 — Fechar a aba com o salvamento automático na fila perde o que não foi salvo 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/components/passagens/useHandoverAutosave.ts` · `src/components/passagens/HandoverForm.tsx`
**Impacto:** não há guarda `beforeunload`: com sinal fraco no galpão (provável), fechar ou recarregar a aba com salvamentos na fila perde o que ainda não chegou ao servidor.
**Correção:** — (opção: avisar ao sair com salvamento pendente e mostrar o estado "Salvando…" por mais tempo; observar no piloto)
**Registrado em:** 2026-11-25

#### P68 — Sentry sem source maps e com +67 KB gzip de JS no cliente ⚪
**Estado:** Aberto, não triado
**Arquivos:** `next.config.ts` · `src/instrumentation-client.ts`
**Impacto:** sem `SENTRY_AUTH_TOKEN` não há source maps: a pilha dos erros do navegador chega minificada. O SDK pesa cerca de 67 KB gzip (+11%) no cliente mesmo desligado.
**Correção:** — (opção: token de upload só na Vercel e `sourcemaps` ligado; avaliar o carregamento tardio do SDK)
**Registrado em:** 2026-11-25

#### P69 — scrubEvent só limpa padrões conhecidos da mensagem de erro 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/lib/sentry/scrubEvent.ts`
**Impacto:** um valor de pessoa fora dos sete padrões (SQL do Drizzle, parâmetros, valor de tipo inválido, token de caminho, fragmento `#token=`, query string e e-mail) sairia para o Sentry, fora do país.
**Correção:** — (opção: revisar os eventos do Sentry na rotina diária do primeiro mês e acrescentar o padrão que aparecer)
**Registrado em:** 2026-11-25

#### P70 — Alvos de toque medidos só no Chromium emulado ⚪
**Estado:** Aberto, não triado
**Arquivos:** `e2e/touch-targets.spec.ts`
**Impacto:** o guarda mede em Chromium emulado a 390×844. iOS e Android reais, o tema escuro e a área do link esticado do cartão da Lista não foram medidos.
**Correção:** — (opção: conferir no celular dos operadores no primeiro dia do piloto)
**Registrado em:** 2026-11-25

#### P71 — Sem instalação como app (manifest e ícones) ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/app/`
**Impacto:** "Adicionar à tela inicial" cria um atalho sem ícone próprio e a barra do navegador não tem `themeColor`.
**Correção:** — (opção: `manifest.ts` com ícones; testar a passkey no app instalado do iOS antes)
**Registrado em:** 2026-11-25

#### P72 — Tempo de preenchimento da passagem sem medição automática ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/features/handovers/deliver.ts`
**Impacto:** o critério "mais rápida que a planilha" (spec §17) é medido no piloto com cronômetro e observador (C6-6); medir sozinho exigiria gravar o tempo de preenchimento (`fill_ms`), o que pede uma migração.
**Correção:** — (opção: gravar o tempo na entrega, numa fase com migração)
**Registrado em:** 2026-11-25

#### P73 — Suíte do Vitest lenta e teste de migração com timeout sob carga ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/db/schema/migration0002.test.ts` · `.github/workflows/ci.yml`
**Impacto:** a suíte leva cerca de 760 s com a máquina carregada; o `migration0002.test.ts` já estourou o limite de 15 s e o job `checks` do CI tem 15 minutos de teto.
**Correção:** — (opção: dividir a suíte em dois jobs ou subir o teste de migração para um limite maior)
**Registrado em:** 2026-11-25

#### P74 — admin:invite não mostra quantos administradores ativos existem ⚪
**Estado:** Aberto, não triado
**Arquivos:** `scripts/adminInvite.ts`
**Impacto:** um convite de administrador a mais passa despercebido; a trava de host (`--confirmar-host`) cobre o banco errado, não a quantidade de administradores.
**Correção:** — (opção: imprimir a contagem de administradores ativos junto do alvo, antes da confirmação)
**Registrado em:** 2026-11-25

#### P75 — Next imprime o erro não tratado inteiro no log da Vercel 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/instrumentation.ts` · `src/lib/auth/createAuth.ts`
**Impacto:** um erro não tratado de Server Component ou de rota sai no log do próprio Next como `⨯ Error: Failed query: … params: …`, com e-mail, hash ou texto da passagem; o log da Vercel guarda 1 hora no Hobby. `logServerError` só cobre o erro tratado e o que o `logger` do Better Auth emite. O mesmo vale para o roteador do `better-call` (Better Auth): quando a exceção não é `APIError` ele imprime `# SERVER_ERROR: <erro>` com `console.error` por conta própria, fora do `logger`, e o erro do Drizzle sai com o SQL e os parâmetros.
**Correção:** — (opções: aceitar no piloto e rever o log; ou limites de erro por rota que tratam o erro antes de o Next o ver)
**Registrado em:** 2026-11-25

#### P76 — Gerar link de nova senha não deixa registro de quem gerou 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/features/admin/passwordReset.ts`
**Impacto:** um administrador pode gerar o link de outro administrador (e assumir a conta) sem rastro de quem gerou, para quem e quando, contra a regra de rastro do projeto.
**Correção:** — (opção: tabela de auditoria dos links gerados; exige migração, fora da Fase 6)
**Registrado em:** 2026-11-25
````

4. As `Atualização` de P1 (seção Resolvido), P6 e P10 (seção Bloqueado no dono). Crie o auxiliar `.git/sdd/f6/pendencia-update.mjs` com a ferramenta Write (acrescenta uma `Atualização` ao fim do bloco de cada uma das três pendências, sem mudá-las de seção) e use-o:

```js
// Uso: F6_DATE=AAAA-MM-DD node .git/sdd/f6/pendencia-update.mjs
// Acrescenta "**Atualização (<data>):** <texto>" ao fim do bloco de cada pendência de UPDATES,
// sem mudar o estado nem a seção. Os textos ficam aqui (e não na linha de comando) porque o
// Git Bash desta máquina corrompe acentos em argumentos.
import { readFileSync, writeFileSync } from "node:fs";

const UPDATES = {
  P1: "a produção usa um projeto Neon **novo** (C6-4, região `sa-east-1`, plano Free), não a branch de desenvolvimento deste `.env.local`. Na Vercel entra só `DATABASE_URL_POOLED`; a URL direta fica só no shell da migração (runbook, passo B4). As URLs de produção comentadas do `.env.local` saem por mão do dono (passo B2). O que falta é a Parte B (go-live), fora do código.",
  P6: "D-F6-1: o piloto roda só em `*.vercel.app`, sem domínio próprio; \"Entrar com Apple\" segue bloqueado (precisa do Apple Developer Program e de um domínio verificado, e a troca de domínio invalida as passkeys, P66).",
  P10: "C6-1: o Google fica desligado no piloto (sem `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` na Vercel o botão não aparece); entrar é por e-mail e senha ou passkey. A pendência continua bloqueada no dono.",
};

const date = process.env.F6_DATE;
if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) {
  console.error("Uso: F6_DATE=AAAA-MM-DD node pendencia-update.mjs");
  process.exit(1);
}
const file = ".context/pendencias.md";
const lines = readFileSync(file, "utf8").split("\n");
for (const [id, text] of Object.entries(UPDATES)) {
  const start = lines.findIndex((line) => line.startsWith(`#### ${id} — `));
  if (start === -1) {
    console.error(`Pendência ${id} não encontrada em ${file}.`);
    process.exit(1);
  }
  let end = start + 1;
  while (
    end < lines.length &&
    !lines[end].startsWith("#### ") &&
    !lines[end].startsWith("## ")
  ) {
    end++;
  }
  let last = end - 1;
  while (lines[last].trim() === "") last--;
  lines.splice(last + 1, 0, `**Atualização (${date}):** ${text}`);
  console.log(`Atualização acrescentada a ${id}.`);
}
writeFileSync(file, lines.join("\n"));
```

```bash
F6_DATE=<DATA> node .git/sdd/f6/pendencia-update.mjs
grep -c "Atualização (<DATA>)" .context/pendencias.md
git diff .context/pendencias.md
```

(Troque só o `<DATA>` pela data do dia da execução. Os três textos ficam dentro do auxiliar; o `grep -c` tem de dar **3 ou mais** e o `git diff` tem de mostrar as três `Atualização` com os acentos intactos, sem `?` nem caracteres quebrados: as guardas de documentação só conferem ids e datas, então mojibake passaria em silêncio.)

```bash
bunx vitest run test/pendenciasDoc.test.ts
```

Expected: PASS, `Tests  17 passed (17)` (os 15 do fim da Tarefa 7 e os **2** desta tarefa). Os dois casos novos e os de sempre (o índice e as seções listam as mesmas pendências; o próximo id livre é o maior id mais um, agora **P77**).

- [ ] **Step 8: Verificação final, parte 1: tipos, lint e Vitest**

```bash
bunx biome check --write .
bun run check-types
bun run lint
bun run test
```

Expected: `check-types` e `lint` sem erro e `bun run test` verde. **Anote os dois totais** (`Test Files  <ARQUIVOS> passed` e `Tests  <TESTES> passed`): eles têm de ser a **linha de base do Step 0 da Tarefa 1** mais tudo que as Tarefas 1 a 10 acrescentaram (nesta tarefa: `+1` arquivo e `+49` testes, 47 de `smokeChecks.test.ts` e 2 de `pendenciasDoc.test.ts`; na Tarefa 8, `+2` arquivos e `+19` testes). Se `migration0002.test.ts` estourar 15 s, repita só ele (`bunx vitest run src/db/schema/migration0002.test.ts`); se falhar isolado, BLOCKED. Esta é a rodada lenta (cerca de 13 minutos nesta máquina): rode-a **uma vez**, em primeiro plano ou com `run_in_background`.

- [ ] **Step 9: Verificação final, parte 2: build e o E2E inteiro**

Um bloco só (a env fictícia vem primeiro). As portas 3200 e 54329 livres.

```bash
export DATABASE_URL="postgresql://closery:fake@127.0.0.1:1/closery?sslmode=disable" DATABASE_URL_POOLED="postgresql://closery:fake@127.0.0.1:1/closery?sslmode=disable" BETTER_AUTH_URL="http://localhost:3201" BETTER_AUTH_SECRET="segredo-local-de-teste-nao-usar-0123456789abcdef" NEXT_PUBLIC_SENTRY_DSN=""
bun run build
```

Expected: o build verde, com `○ /privacidade`, `○ /redefinir-senha` e `○ /robots.txt` na lista, e as rotas de API **iguais** às de antes da fase (`ƒ /api/auth/[...all]`, `ƒ /api/dashboard/export`, `ƒ /api/health`: nenhuma rota nova). Depois:

```bash
bun run test:e2e
```

Expected: `43 passed` (7 `auth` + 6 `cadastros` + 7 `dashboard` + 6 `passagem` + 3 `publico` + 3 `redefinir-senha` + 9 `solicitacoes` + 2 `touch-targets`), com o DSN do Sentry vazio. Se divergir, pare e reporte BLOCKED com o número medido.

- [ ] **Step 10: Conferir o `library-docs.md`**

A tarefa não escreve em `.context/library-docs.md`: as Tarefas 1, 4, 5, 6 e 7 já acrescentaram as regras delas. Confirme que estão lá:

```bash
grep -n "^## 16\. Sentry\|^## 1\. Next\|^## 8\. Better\|^## 10\. Playwright" .context/library-docs.md
grep -c "vercel.json" .context/library-docs.md
```

Expected: as quatro linhas de cabeçalho (incluindo `## 16. Sentry`, que a Tarefa 6 criou) e o `grep -c` com 1 ou mais. Se faltar a §16 ou o `vercel.json`, a tarefa anterior ficou incompleta: BLOCKED.

- [ ] **Step 11: A documentação do estado final**

Crie o auxiliar `.git/sdd/f6/docs-fase6.mjs` com a ferramenta Write. Ele faz as edições de `AGENTS.md` (a linha do `smoke` na tabela de comandos e o runbook na lista de leitura), `.context/build-plan.md` (a Fase 6 vira 🟡), `.context/architecture.md` (§5 banco de produção, a linha `/robots.txt` e o cabeçalho de §9, e o ADR da §10, que cita os desvios e os riscos residuais **P75** e **P76**), `.context/progress-tracker.md` (o próximo passo, a seção da Fase 6 e o histórico) e `memory.md` (o handoff). Cada trecho tem uma âncora exata e **falha com mensagem clara** se a âncora não existir ou se repetir (por exemplo, se uma tarefa anterior já mudou o cabeçalho `Fases 1 a 5 prontas` da §9: ajuste a linha correspondente do script ao texto que está lá). A data do dia da execução entra só pela variável `F6_DATE` (nada de `sed` no script: as âncoras antigas, como a do `progress-tracker.md`, trazem `2026-11-25` e **não** podem mudar; o nome do arquivo do plano também fica).

```js
import { readFileSync, writeFileSync } from "node:fs";

// Edições de documentação da Tarefa 10 (AGENTS, build-plan, architecture, progress-tracker, memory).
// Uso: F6_DATE=<AAAA-MM-DD> F6_TESTS=<testes> F6_FILES=<arquivos> node .git/sdd/f6/docs-fase6.mjs
const DATE = process.env.F6_DATE;
if (!/^\d{4}-\d{2}-\d{2}$/.test(DATE ?? "")) {
  console.error("Informe F6_DATE=AAAA-MM-DD.");
  process.exit(1);
}
const TESTS = process.env.F6_TESTS;
const FILES = process.env.F6_FILES;
if (!TESTS || !FILES) {
  console.error("Informe F6_TESTS e F6_FILES (os totais do Vitest).");
  process.exit(1);
}

function edit(file, pairs) {
  let s = readFileSync(file, "utf8");
  for (const [a, b] of pairs) {
    if (s.split(a).length !== 2) throw new Error(`${file}: âncora ausente ou repetida: ${a.slice(0, 70)}`);
    s = s.replace(a, b);
  }
  writeFileSync(file, s);
}

edit("AGENTS.md", [
  [
    "10. `.context/pendencias.md` — tudo que está devido e não feito\n",
    "10. `.context/pendencias.md` — tudo que está devido e não feito\n11. `.context/runbook-producao.md` — o go-live e a semana de piloto (só quando for pôr em produção)\n",
  ],
  [
    "| `bun run test:e2e` | Playwright com banco efêmero (pglite-socket) e build de produção; cerca de 1 min |\n",
    "| `bun run test:e2e` | Playwright com banco efêmero (pglite-socket) e build de produção; cerca de 1 min |\n| `bun run smoke <https://<projeto>.vercel.app> [--local]` | confere uma produção (ou o `next start` local, com `--local`) só com `GET`: saúde do banco, região, cabeçalhos de segurança, noindex, redirecionamento e `/privacidade`; código de saída 1 se algo falhar |\n",
  ],
]);

edit(".context/build-plan.md", [
  [
    "| **6 — Produção** | Vercel, domínio, e-mail (P8), piloto de uma semana com a equipe | ⬜ |",
    "| **6 — Produção** | código pronto: configuração da Vercel, cabeçalhos de segurança, log sem dado de pessoa, Sentry, redefinição de senha pelo link do administrador, `/privacidade`, smoke e runbook ✅ · go-live (Neon e Vercel de produção, migração, primeiro administrador, aprovação da empresa) e o piloto de uma semana: `.context/runbook-producao.md` ⬜ | 🟡 |",
  ],
]);



edit(".context/architecture.md", [
  [
    "  `db:push` só em banco de dev descartável.\n",
    "  `db:push` só em banco de dev descartável.\n- **Produção (Fase 6):** um projeto Neon **novo** em `sa-east-1` (plano Free, 0,25 CU, scale-to-zero), separado\n  do de desenvolvimento, com roles, senha e cota de CU-h próprios (C6-4). Na Vercel entra só\n  `DATABASE_URL_POOLED`; a URL direta existe só no shell da migração, que nunca roda no build nem no CI. A\n  \"trava de host\" é humana: `bun run db:hosts` imprime o host da aplicação e o das migrações (nunca usuário,\n  senha nem banco) e o dono confere o das migrações com o console do Neon antes do `db:migrate` (C6-3); o\n  `admin:invite` exige `--confirmar-host=<host>` igual ao do banco de destino. Passo a passo em\n  `.context/runbook-producao.md`.\n",
  ],
  ["Fases 1 a 5 prontas", "Fases 1 a 6 prontas"],
  [
    "| Hospedagem | *🟡 provável Vercel (par natural de Next + Neon) — confirmar* | — |",
    "| Hospedagem | **Vercel Hobby** (D-F6-3): funções em `gru1` (`vercel.json`), previews desligados, Bun fixado na instalação; go-live na Parte B (`.context/runbook-producao.md`) | — |",
  ],
  [
    "## 7. Autenticação e autorização · 🟢 implementado na Fase 1 (Apple na Fase 6)",
    "## 7. Autenticação e autorização · 🟢 implementado na Fase 1 (Apple adiada: P6, D-F6-1)",
  ],
  [
    "| `/api/auth/[...all]` |",
    "| `/robots.txt` | `Disallow: /` para todos os buscadores (`src/app/robots.ts`); o `noindex` também vai no cabeçalho `X-Robots-Tag` e na meta `robots` do layout raiz. Estática. Pública | ✅ Fase 6 |\n| `/api/auth/[...all]` |",
  ],
]);

const adr = `
### ${DATE} — Fase 6: produção

- **Decisão:** o código fica pronto para o piloto de uma semana em produção, sem tocar produção nem serviço externo: \`vercel.json\` (\`gru1\`, Bun fixado na instalação, previews desligados), \`engines.node\` \`22.x\` (o mesmo major do CI), cabeçalhos de segurança em toda rota (\`nosniff\`, \`Referrer-Policy\`, \`frame-ancestors 'none'\` e \`X-Frame-Options\`, \`Permissions-Policy\` sem as passkeys, \`X-Robots-Tag\`) e \`no-referrer\` no convite e na redefinição, noindex em três camadas (\`robots.ts\`, meta e cabeçalho); erro inesperado registrado por um ponto só (\`logServerError\`: nome, SQLSTATE e digest, nunca a mensagem, a pilha nem os parâmetros do SQL); trava de host no \`admin:invite\` (\`--confirmar-host\`) e \`db:hosts\` para a migração; Better Auth endurecido (IP do rate limit explícito, P22; cookie do convite apagado no cadastro, P16; identificador da redefinição guardado com hash; sessões revogadas ao redefinir; logger que não imprime o erro cru); redefinição de senha por link gerado pelo administrador; Sentry sem DSN desligado e com \`scrubEvent\`; alvos de toque de 44 px com um guarda E2E (P12); \`/privacidade\` em rascunho; \`scripts/smoke.mjs\` e o runbook. **Nenhuma migração** na fase. Decisões do dono: D-F6-1 (só \`*.vercel.app\`), D-F6-2 (link do administrador, sem e-mail), D-F6-3 (Vercel Hobby), D-F6-4 (Neon Free), D-F6-5 (Sentry grátis). Decisões do controlador: C6-1 a C6-8.
- **Por quê:** a spec §13 pede produção e piloto; o dono escolheu custo zero e nenhum domínio próprio. Sem domínio não há e-mail transacional, então a recuperação de senha passa pelo administrador (D-F6-2, desvio da spec §4.3, que previa "Esqueci a senha" por e-mail; P8 continua bloqueada). O repositório é público e o serviço de erros fica fora do país: por isso o log e o evento do Sentry nunca levam dado de pessoa.
- **Trade-offs aceitos:** (1) Hobby é "personal or non-commercial", guarda logs por 1 hora e só faz rollback para o deploy anterior; Neon Free dá 100 CU-h por mês e restaura só 6 horas atrás (P65; a cópia diária do CSV do dashboard e a planilha em paralelo mitigam). (2) As passkeys ficam presas ao host \`*.vercel.app\`: trocar de domínio as invalida (P66). (3) **Sem CSP de scripts** e sem HSTS próprio: CSP com nonce obriga renderização dinâmica e derruba o shell estático e o prefetch parcial do \`cacheComponents\`; o HSTS a Vercel já envia em \`*.vercel.app\`; ficam \`frame-ancestors\` e \`X-Frame-Options\`, que não precisam de nonce (reavaliar com SRI e liberar \`connect-src\` do Sentry se houver CSP). (4) **O link de nova senha vale 24 horas** (\`PASSWORD_RESET_TTL_MS\`; 1 hora obrigaria o administrador a gerar de novo para quem lê no turno seguinte): risco residual do link no histórico do WhatsApp; mitigações: uso único, link novo derruba o anterior, desativar a conta derruba o link, sessões revogadas, hash no banco e token no fragmento da URL (nunca chega ao servidor); 8 horas é uma constante. (5) **Exceção à regra de \`db.transaction()\`:** o link é gravado pelo adapter do Better Auth, que não entra numa transação nossa; a ordem é a que falha fechado (apaga os links antigos antes de criar o novo). (6) **P75:** o log que o próprio Next imprime para erro não tratado de Server Component e de rota (\`Failed query … params: …\`) não passa pelo \`logServerError\` e fica 1 hora no log da Vercel; o piloto aceita e revê o log. O mesmo vale para o roteador do \`better-call\` (Better Auth): quando a exceção não é \`APIError\` ele imprime \`# SERVER_ERROR: <erro>\` com \`console.error\` por conta própria, fora do \`logger\`, e o erro do Drizzle sai com o SQL e os parâmetros. (7) **P76:** gerar o link de nova senha não grava quem, para quem nem quando; exige tabela de auditoria e migração, fora desta fase. (8) O Sentry fica fora do país e o \`scrubEvent\` só remove padrões conhecidos (P69); o SDK pesa +67 KB gzip no cliente e não há source maps sem token (P68). (9) O comportamento na Vercel só se confirma no primeiro deploy (P63) e o texto de \`/privacidade\` é rascunho até a empresa aprovar (P64).
- **Desvios registrados:** (a) \`tunnelRoute\` do Sentry não é usado (criaria rota; \`route.ts\` novo fora da lista fechada reprova o guarda). (b) \`createPasswordResetLink\` apaga antes de criar (o spike criava e depois apagava). (c) A linha da própria conta na Equipe ganhou "Nova senha": sem e-mail, o administrador que esqueceu a senha e ainda tem sessão por passkey se recupera sozinho. (d) A isenção do guarda de toque para link em frase é estrita (o spike isentava qualquer \`<a>\` inline fora de \`p\`, \`li\` e \`label\`). (e) O \`browserSessionIntegration\` do Sentry é removido no cliente (mandava um envelope por carga de página, com IP e navegador). (f) \`scripts/smoke.mjs\` fica em \`.mjs\` (pedido do plano) e as regras puras em \`scripts/smokeChecks.mjs\`, testadas.
- **Verificado:** \`check-types\`, \`lint\`, \`test\` (${TESTS} testes em ${FILES} arquivos), \`build\` (\`○ /redefinir-senha\`, \`○ /privacidade\`, \`○ /robots.txt\`, nenhuma rota de API nova) e \`test:e2e\` (43 passed) verdes; \`bun run smoke http://localhost:3201 --local\` contra o \`next start\` com banco inacessível: 7 OK, 1 FALHOU (\`/api/health\` 503, esperado), 2 PULADO. P16, P22 e P12 resolvidas; P62 a P76 registradas; P1, P6, P7, P8 e P10 ganharam \`Atualização\`. **Falta o go-live (Parte B):** \`.context/runbook-producao.md\`.
`;
{
  const file = ".context/architecture.md";
  const s = readFileSync(file, "utf8");
  writeFileSync(file, `${s.trimEnd()}\n${adr}`);
}

edit(".context/progress-tracker.md", [
  [
    "- **2026-11-25 — Fases 0, 1, 2, 3, 4 e 5 concluídas. Próximo: plano de implementação da Fase 6\n  (Produção: Vercel, domínio, e-mail transacional (P8) e o piloto de uma semana com a equipe)** com a\n  skill `writing-plans`, a partir da spec §13 (`docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md`).\n  O produto está completo para o piloto: passagem, solicitações e dashboard com CSV.\n",
    "- **" + DATE + " — Fases 0 a 5 concluídas e o código da Fase 6 (Produção) pronto. Próximo: o go-live (Parte B),\n  conduzido pelo controlador com o dono, passo a passo e com confirmação do dono em cada passo voltado para\n  fora, em `.context/runbook-producao.md`:** proteção da `main` (P62), Neon e Vercel de produção, migração,\n  `bun run smoke`, `admin:invite` em produção, aprovação da empresa para `/privacidade` (P64) e só então os\n  convites reais e a semana de piloto.\n",
  ],
  [
    "- ⬜ Deploy, domínio, e-mail e piloto: Fase 6\n",
    `- ⬜ Deploy e piloto: Fase 6 (o código está pronto; falta o go-live)

## Fase 6 — Produção · 🟡

- ✅ Configuração de produção: \`vercel.json\` (\`gru1\`, Bun fixado, previews desligados), \`engines.node\` \`22.x\`, cabeçalhos de segurança e noindex em três camadas (${DATE})
- ✅ \`logServerError\`: erro inesperado sem mensagem, pilha nem parâmetro de SQL, em \`runAction\`, \`/api/health\` e nos limites de erro (${DATE})
- ✅ \`admin:invite --confirmar-host\` e \`bun run db:hosts\` (a trava de host da migração) (${DATE})
- ✅ Better Auth endurecido: IP do rate limit explícito (P22), cookie do convite apagado no cadastro (P16), identificador da redefinição com hash, sessões revogadas ao redefinir (${DATE})
- ✅ Redefinição de senha por link gerado pelo administrador (24 h, uso único) e a página \`/redefinir-senha\`; "Esqueceu a senha?" no \`/entrar\` (${DATE})
- ✅ Sentry só com DSN, \`scrubEvent\` e \`global-error.tsx\` (${DATE})
- ✅ Alvos de toque de 44 px e o guarda E2E \`touch-targets\` (P12) (${DATE})
- ✅ \`/privacidade\` (rascunho até a empresa aprovar) e os textos do primeiro acesso (${DATE})
- ✅ \`scripts/smoke.mjs\` (\`bun run smoke\`) e \`.context/runbook-producao.md\` (${DATE})
- ✅ P16, P22 e P12 resolvidas; pendências novas P62–P76; P1, P6, P7, P8 e P10 ganharam \`Atualização\` (${DATE})
- ✅ Testes: Vitest ${TESTS} testes em ${FILES} arquivos; E2E com 43 cenários (os 35 de antes, 2 de alvos de toque, 3 da redefinição de senha e 3 das páginas públicas). Verificado: \`check-types\`, \`lint\`, \`test\`, \`test:e2e\` (43 passed) e \`build\` verdes (${DATE})
- ⬜ Go-live (Parte B): proteção da \`main\`, Neon e Vercel de produção, migração, primeiro administrador, aprovação da empresa (P64), convites e a semana de piloto
`,
  ],
]);
{
  const file = ".context/progress-tracker.md";
  const s = readFileSync(file, "utf8");
  const entry =
    "- **" + DATE + "** — Fase 6 (código) concluída: configuração de produção, log sanitizado, trava de host, Better Auth endurecido, redefinição de senha pelo link do administrador, Sentry, alvos de toque, `/privacidade`, smoke e runbook; P16, P22 e P12 resolvidas. Falta o go-live (Parte B). Plano em `docs/superpowers/plans/2026-11-25-fase-6-producao.md`.\n";
  writeFileSync(file, `${s.trimEnd()}\n${entry}`);
}

edit("memory.md", [
  [
    "# Memory — Fases 0 a 5 concluídas; o próximo passo é o plano da Fase 6",
    "# Memory — Fases 0 a 5 concluídas e o código da Fase 6 pronto; o que falta é o go-live",
  ],
  [
    "O design do produto está na spec (",
    "**Produção: código pronto (Fase 6).** O app tem `vercel.json` (`gru1`, previews desligados), cabeçalhos de segurança e\nnoindex, log sem dado de pessoa (`logServerError`), `admin:invite --confirmar-host` e `bun run db:hosts`, Better Auth\nendurecido, **redefinição de senha pelo link que o administrador gera em `/admin/equipe`** (sem e-mail: P8 segue aberta),\nSentry (só com `NEXT_PUBLIC_SENTRY_DSN`), alvos de toque de 44 px, a página pública `/privacidade` (rascunho até a empresa\naprovar) e `bun run smoke <url>`. **Nada foi para produção:** o go-live (Neon e Vercel novos, migração, primeiro\nadministrador, convites) é o passo a passo de `.context/runbook-producao.md`, conduzido com o dono, com confirmação dele\nem cada passo voltado para fora. Plano executado em `docs/superpowers/plans/2026-11-25-fase-6-producao.md`.\n\nO design do produto está na spec (",
  ],
  [
    "- **Plano da Fase 6 (skill `writing-plans`):** Produção — Vercel, domínio, e-mail transacional (P8) e o piloto de uma\n  semana com a equipe (spec §13). O deploy ainda não foi feito: `next build` e o E2E já rodam no CI.\n",
    "- **Go-live da Fase 6 (Parte B):** seguir `.context/runbook-producao.md` com o dono (B0 a B18). O deploy ainda não foi feito;\n  nada é publicado sem o \"sim\" explícito do dono naquele momento. Sem a aprovação da empresa para `/privacidade` (P64)\n  ninguém é convidado.\n- **P62–P76 (Fase 6):** `main` sem proteção (P62); o que só o primeiro deploy confirma (P63); LGPD (P64); riscos do Hobby e do Neon\n  Free (P65); passkeys presas ao `*.vercel.app` (P66); aba fechada com salvamento na fila (P67); Sentry sem source maps (P68);\n  `scrubEvent` só limpa padrões conhecidos (P69); toque só medido no Chromium (P70); sem manifest (P71); tempo de preenchimento\n  sem medição (P72); suíte lenta (P73); `admin:invite` sem contagem de administradores (P74); o Next imprime o erro não tratado\n  inteiro (P75); o link de nova senha não deixa registro de quem gerou (P76). Próximo id livre: P77.\n",
  ],
]);

{
  const file = "memory.md";
  const s = readFileSync(file, "utf8");
  const lastUpdated = /^Last updated: \d{4}-\d{2}-\d{2} \(UTC-3\)$/m;
  if (!lastUpdated.test(s)) {
    throw new Error("memory.md: linha Last updated não encontrada");
  }
  writeFileSync(file, s.replace(lastUpdated, `Last updated: ${DATE} (UTC-3)`));
}
```

```bash
F6_DATE=<DATA> F6_TESTS=<TESTES> F6_FILES=<ARQUIVOS> node .git/sdd/f6/docs-fase6.mjs
git diff --stat AGENTS.md .context/build-plan.md .context/architecture.md .context/progress-tracker.md memory.md
```

(`<DATA>` é a data do dia da execução, `AAAA-MM-DD`; `<TESTES>` e `<ARQUIVOS>` são os totais do Step 8.) Expected: o `git diff --stat` com os cinco arquivos alterados e nenhuma mensagem de âncora. Sem `F6_DATE` (`Informe F6_DATE=AAAA-MM-DD.`) ou sem as duas variáveis de total (`Informe F6_TESTS e F6_FILES (os totais do Vitest).`) o script recusa **antes** de editar qualquer arquivo.

- [ ] **Step 12: Conferir os guardas de documentação e os textos**

```bash
bunx vitest run test/pendenciasDoc.test.ts test/uiRegistryDoc.test.ts
bun run lint
grep -n "P75\|P76" .context/architecture.md | head -3
grep -n "Próximo id livre" .context/pendencias.md
git status --short
```

Expected: os dois arquivos de teste verdes, `lint` sem erro, o ADR da §10 citando P75 e P76, `**Próximo id livre: P77.**` e, no `git status`, só os arquivos desta tarefa (os auxiliares de `.git/sdd/` não aparecem).

- [ ] **Step 13: O walkthrough didático (toda feature termina com um)**

`code-standards.md §9` manda fechar a feature com um walkthrough para o desenvolvedor. Não é arquivo: é a **resposta final** do executor ao controlador (e do controlador ao dono), em português simples, na ordem de uma pessoa que nunca viu o código: (1) o que mudou na fase em 6 a 8 linhas, uma por entrega (configuração de produção, log limpo, trava de host, Better Auth endurecido, link de nova senha, Sentry, toque de 44 px, privacidade, smoke e runbook), cada uma dizendo **onde olhar** (arquivo) e **como ver funcionando** (um comando ou uma tela); (2) o que **não** foi feito de propósito e por quê (sem CSP de scripts, sem e-mail, sem deploy, sem migração; P62 a P76); (3) o caminho de um link de nova senha, do clique em `Nova senha` até `Senha alterada`, em cinco frases; (4) o que o dono precisa fazer a seguir (o runbook, B0 a B18, com o "sim" dele em cada passo voltado para fora). Termine com os números medidos (testes do Vitest, `43 passed` do E2E, o resultado do smoke local).

- [ ] **Step 14: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/f6/msg-task-10.txt` e rode:

```bash
git add scripts/smoke.mjs scripts/smokeChecks.mjs test/smokeChecks.test.ts package.json test/pendenciasDoc.test.ts .context/runbook-producao.md .context/pendencias.md .context/architecture.md .context/progress-tracker.md .context/build-plan.md memory.md AGENTS.md
git status --short
git commit -F .git/sdd/f6/msg-task-10.txt
```

`git status --short` não pode listar nada fora desta tarefa. Mensagem:

```text
docs(producao): runbook de produção, smoke test e documentação da Fase 6

scripts/smoke.mjs (bun run smoke) confere uma produção só com GET: saúde
do banco, região, HSTS, cabeçalhos de segurança, noindex, robots.txt,
no-referrer do convite e da redefinição, redirecionamento e /privacidade;
as regras puras ficam em scripts/smokeChecks.mjs, testadas. O runbook
em .context/runbook-producao.md é o passo a passo do go-live. Pendências
P62 a P76 registradas e P1, P6 e P10 atualizadas; ADR da Fase 6, tracker,
plano de fases, handoff e AGENTS.md atualizados. Nada foi para produção.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```
