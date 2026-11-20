# Progress Tracker — Closery

> **Documento vivo + estado da obra.** Atualize **após cada feature** (junto com `ui-registry.md`
> e o log do `architecture.md`). As fases aqui são as mesmas do `build-plan.md`.
>
> Item só fica ✅ com verificação **rodada no terminal** (testes, `check-types`, `lint`, `build`).
>
> **Legenda:** ✅ concluído · 🟡 em andamento · ⬜ pendente · ⛔ bloqueado

---

## ▸ Próximo passo

- **2026-11-20 — Brainstorm concluído; spec escrita, aguardando revisão do dono.**
  `docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md` consolida as 18 decisões (`build-plan.md §5`) e as 6 seções de design aprovadas.
  Depois da revisão: plano de implementação (skill `writing-plans`), começando pela Fase 0.
- **Neon ligado** (P1 resolvida, 2026-11-20). P6/P7/P8 só travam Apple, Facebook e "esqueci a
  senha".

---

## Fase 0 — Fundação · 🟡

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
- ⬜ Setup de testes: PGlite + Vitest + Testing Library + Playwright
- ⬜ Tokens da D16 (`chart-1..4`, `success`, `warning`, `info`) no `globals.css`
- ⬜ Remoto do Git (GitHub) e deploy (provável Vercel)

## Histórico

- **2026-11-20** — Projeto criado; contexto escrito; planilha analisada; brainstorm concluído
  (D1–D18) e spec escrita em `docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md`.
