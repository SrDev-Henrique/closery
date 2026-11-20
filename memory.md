# Memory — Brainstorm concluído; a spec espera revisão, depois vem o plano

Last updated: 2026-11-20 (UTC-3)

---

## Onde o projeto está

**Fundação pronta e design fechado.** O app Next.js 16.4.6 compila e passa no lint; shadcn
(`base-nova`, Base UI) e Drizzle + Neon instalados; `.context/` escrito no formato do klauve.

**O brainstorm terminou** com 18 decisões (`.context/build-plan.md §5`, D1–D18) e 6 seções de
design aprovadas uma a uma. Tudo está consolidado na spec:
`docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md`.

Em uma frase: passagem de turno com rascunho compartilhado, entrega e confirmação de recebimento
sem bloqueio; solicitações com quadro · lista · tabela e comentários (molde: ocorrências do
klauve); dashboard semanal/mensal com `metric-card` e `spending-ring` do KokonutUI; acesso por
Better Auth só com convite; papéis admin e operador escopados por setor.

## O que está esperando

- **Revisão da spec pelo dono.** Depois: plano de implementação (skill `writing-plans`), Fase 0.
- ~~P1~~ **Neon ligado** (2026-11-20): `pg` + `attachDatabasePool`, `/api/health` verde.
- **P6/P7/P8:** Apple Developer, app da Meta, provedor de e-mail — só travam esses três recursos.
- **Suposições a validar com o usuário final:** spec §15 (glossário, horários dos turnos, o que é
  solicitação, passagem feita no fim do turno, quem recebe).
- Nada foi commitado além do commit inicial do `create-next-app` — o dono ainda não pediu commit.

## Coisas que vão te morder se ninguém avisar

- **Driver é `pg` + `attachDatabasePool`** (D18 atualizada pela skill do Neon para Vercel), não
  `neon-serverless`. Escrita multi-statement em `db.transaction()`; nada de `db.batch`.
- **`.env.local` aponta para a branch de DESENVOLVIMENTO do Neon** (`ep-blue-voice-…`); as URLs
  de produção estão comentadas no arquivo até irem para a Vercel. Channel binding ligado no pool.
- **`.env.local` usa `DATABASE_URL` (direta) + `DATABASE_URL_POOLED`** — o contrário da convenção do
  `neon env pull`. `src/db/databaseUrl.ts` aceita as duas. Sempre `sslmode=verify-full`.
- **A CLI `neon` está com a sessão expirada** (`neon login` resolve). O plugin `neon-postgres` foi
  instalado no nível do usuário (Claude Code, Codex, Cursor, VS Code) e aparece nas próximas sessões.
- **Cache Components está ligado:** dado dinâmico por padrão, `"use cache"` é opt-in, acesso
  dinâmico dentro de `<Suspense>`. Ver `library-docs.md §1`.
- **É Base UI, não Radix:** `render`, não `asChild`. O `cn` vem do pacote `cn`.
- **Componentes KokonutUI vêm com cor crua e em inglês** — adaptar na instalação
  (`library-docs.md §6`).
- O Playwright MCP grava artefatos em `.playwright-mcp/` (ignorado no git).
- **Nenhum dado real da planilha** (nomes das pessoas) entra em commit, seed ou teste.
