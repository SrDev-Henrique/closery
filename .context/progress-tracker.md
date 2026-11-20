# Progress Tracker — Closery

> **Documento vivo + estado da obra.** Atualize **após cada feature** (junto com `ui-registry.md`
> e o log do `architecture.md`). As fases aqui são as mesmas do `build-plan.md`.
>
> Item só fica ✅ com verificação **rodada no terminal** (testes, `check-types`, `lint`, `build`).
>
> **Legenda:** ✅ concluído · 🟡 em andamento · ⬜ pendente · ⛔ bloqueado

---

## ▸ Próximo passo

- **2026-11-20 — Fases 0 e 1 concluídas. Próximo: plano de implementação da Fase 2 (Cadastros:
  setores, turnos, itens, destinos, equipe)** com a skill `writing-plans`, a partir da spec §13
  (`docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md`). O `/admin` já existe
  como placeholder e recebe as telas; o convite de operador já exige setor (`sector`).
- **Neon ligado** (P1 resolvida, 2026-11-20). P6/P7/P8 só travam Apple, Facebook e "esqueci a
  senha".

---

## Fase 0 — Fundação · ✅

- ✅ Scaffold Next.js 16.4.6 + React 19.3 + Tailwind 4 + Biome + React Compiler + Bun (2026-11-20)
- ✅ shadcn/ui `base-nova` (Base UI) inicializado (2026-11-20)
- ✅ Drizzle + `@neondatabase/serverless` instalados; `src/db/index.ts`, `drizzle.config.ts`,
  `.env.example`, scripts `db:*` e `check-types` (2026-11-20)
- ✅ Correções do scaffold: variável de fonte, `lang="pt-BR"`, página inicial com tokens, assets
  do template removidos (2026-11-20)
- ✅ Contexto: `AGENTS.md`, `CLAUDE.md`, `.context/*`, `memory.md`, skills de projeto em
  `.claude/skills` (copiadas do klauve) (2026-11-20)
- ✅ Análise completa da planilha atual registrada no `about.md` (2026-11-20)
- ✅ Verificado: `check-types` limpo · `lint` limpo · `build` verde (2026-11-20)
- ✅ Neon ligado: `pg` + `attachDatabasePool` (D18), URLs resolvidas por `src/db/databaseUrl.ts`,
  `sslmode=verify-full`, `/api/health` (200 com o banco, 503 sem detalhe sem ele) (2026-11-20)
- ✅ Brainstorm do produto: 18 decisões + spec (2026-11-20)
- ✅ Setup de testes: Vitest 5 (projects `node` e `dom`) + PGlite com dump migrado + Testing Library + Playwright com pglite-socket (2026-11-20)
- ✅ Tokens da D16 (`chart-1..4`, `success`, `warning`, `info`) no `globals.css`, com guarda de paleta (P4 e P9 resolvidas) (2026-11-20)
- ✅ Remoto do Git: GitHub, branch `main` (2026-11-20)
- ⬜ Deploy na Vercel (movido para a Fase 6 — Produção)

## Fase 1 — Acesso · ✅

- ✅ Schema de acesso: `sector`, `user` (papel, setor, desativação), `session`, `account`, `verification`, `passkey`, `rate_limit`, `invite` + migrações versionadas (2026-11-20)
- ✅ Convites: token aleatório com hash, uso único atômico, 7 dias, estados válido/expirado/usado/cancelado, script `admin:invite` (2026-11-20)
- ✅ Better Auth: cadastro só por convite (hook + cookie `closery_invite`), e-mail e senha, passkey, Google e Facebook condicionais ao env (2026-11-20)
- ✅ Papéis `admin`/`operator`: `Authz`, `scopeToSector`, `requireUser`/`requireAdmin`, `proxy.ts`; operador em `/admin` vê "Página não encontrada" (2026-11-20)
- ✅ Telas: `/entrar`, `/convite/[token]`, `/bem-vindo`, `/conta`, Início, `/admin` (placeholder), shell com sidebar, `error` e `not-found` (2026-11-20)
- ✅ Alvos de toque dos primitivos (P3 resolvida) (2026-11-20)
- ✅ Testes: Vitest (node + dom) e E2E com 7 cenários (convite, usado, senha errada, operador sem Administração, passkey, desativado, redirecionamento). Verificado: `check-types`, `lint`, `test`, `test:e2e` (7 passed) e `build` verdes (2026-11-20)
- ⬜ Login social ao vivo (checklist manual da spec §12): depende de P10 (Google) e P7 (Facebook); Apple na Fase 6 (P6)

## Histórico

- **2026-11-20** — Projeto criado; contexto escrito; planilha analisada; brainstorm concluído
  (D1–D18) e spec escrita em `docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md`.
- **2026-11-20** — Fases 0 e 1 concluídas: fundação de testes (Vitest, PGlite, Testing Library, Playwright) e acesso por convite (Better Auth, papéis por setor, telas e shell). Plano em `docs/superpowers/plans/2026-11-20-fase-0-1-fundacao-e-acesso.md`.
- **2026-11-20** — Correções da revisão final: renovação da sessão (servidor lê sem refresh, `SessionKeepAlive` renova banco e cookie), limite de tentativas 30/10 com mensagem própria (`RATE_LIMITED`), link "Entrar" nos convites e no e-mail já cadastrado, testes de escalonamento, guarda de páginas `appPagesAuth.test.ts` (no lugar do `RequireUser`) e pendências P11–P22.
