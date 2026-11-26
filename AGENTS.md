<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Closery — passagem de turno

Sistema de **passagem de turno** para a operação de carga aérea (primeiro setor: **ULD**).
Substitui uma planilha Excel que não registra, não consolida e não rastreia. Next.js (front e
back) + shadcn/ui + Neon (Postgres) + Drizzle.

## Leia antes de qualquer coisa

Leia nesta ordem antes de qualquer implementação:

1. `.context/about.md` — visão, domínio, a planilha atual e o que ela ensina
2. `.context/architecture.md` — stack, estrutura, dados, decisões (log no fim)
3. `.context/ui-tokens.md` — valores visuais (cor, raio, tipografia)
4. `.context/ui-rules.md` — como componentes e telas são construídos
5. `.context/ui-registry.md` — catálogo de componentes (consulte antes de criar um)
6. `.context/code-standards.md` — como escrevemos código aqui
7. `.context/library-docs.md` — regras do projeto por biblioteca
8. `.context/build-plan.md` — fases e sequência
9. `.context/progress-tracker.md` — estado real da obra
10. `.context/pendencias.md` — tudo que está devido e não feito

`memory.md` (raiz) é o handoff entre sessões: leia quando retomar um trabalho de várias sessões.

## Comandos

| Comando | Para quê |
|---|---|
| `bun run dev` | servidor de desenvolvimento (http://localhost:3000) |
| `bun run check-types` · `bun run lint` · `bun run format` | tipos · Biome (só verifica) · Biome (grava) |
| `bun run test` · `bun run test:watch` | Vitest (PGlite + Testing Library). **Nunca `bun test`** |
| `bun run test:e2e` | Playwright com banco efêmero (pglite-socket) e build de produção; cerca de 1 min |
| `bun run build` | build de produção (exige `BETTER_AUTH_URL` e `BETTER_AUTH_SECRET` no `.env.local`) |
| `bun run db:generate` → revisar → `bun run db:migrate` | migração versionada do Drizzle |
| `bun run admin:invite --confirmar-host=<host>` | gera o link de convite do primeiro administrador; sem a flag, mostra o banco de destino e recusa |
| `bun run db:hosts` | mostra só o host do banco da aplicação e o das migrações (conferir antes do `db:migrate`) |

O CI (`.github/workflows/ci.yml`) roda `check-types`, `lint`, `test` e `test:e2e` em todo PR e
push na `main`; PR só entra com o CI verde (`library-docs.md §11`).

## Regras que nunca mudam

- **Regra de ouro: se aumenta o atrito de quem passa ou recebe o turno, está errado.** A
  passagem tem que ser mais rápida no sistema do que na planilha (`build-plan.md §1`)
- Nunca hex cru nem classe de cor crua do Tailwind (`text-red-500`, `bg-[#...]`) — só tokens
  (`ui-tokens.md`). Tema claro **e** escuro em todo componente
- Formulários nunca começam em branco: usuário = **usuário atual**, número = **`0`, nunca vazio**,
  conjunto fechado = valor mais comum (`ui-rules.md §2.2`)
- Um conjunto conhecido de respostas é uma **escolha**, nunca um campo de texto — pessoas, setores,
  turnos, status. Ofereça "Outro" onde uma exceção for possível (`ui-rules.md §2.1`)
- Rótulos de ação nomeiam o resultado, não o mecanismo — "Entregar turno", nunca "Enviar"
  (`ui-rules.md §2.4`)
- Mostre o que a pessoa reconhece (nome, foto, rótulo), nunca o identificador que ela teria que
  lembrar (`ui-rules.md §2.5`)
- Todo controle só com ícone ganha tooltip, além de `aria-label`
- Em tabelas, números alinhados à direita com `tabular-nums`; dado ordenado no tempo é linha do
  tempo, não tabela
- Gráficos: a forma segue a pergunta, escala rotulada quando responde "quanto", legenda para ≥2
  séries, a cor pertence à entidade e **nunca é ciclada** (`ui-rules.md §4`)
- **Passagem confirmada não muda em silêncio.** Depois do recebimento, só o administrador
  corrige, com motivo, e toda correção gera registro (antigo, novo, quem, quando) — nunca `UPDATE`
  sem rastro (`architecture.md §3`, D13)
- Quantidade é sempre inteiro ≥ 0 com unidade declarada; nunca texto livre num campo de contagem
- Mudança de schema passa por migração versionada do Drizzle (`db:generate` → revisar → `db:migrate`);
  `db:push` é só para banco de dev descartável
- Toda lista paginada; **agregação no SQL** (o dashboard nunca soma linhas em JS); escrita de
  vários statements roda em `db.transaction()` (driver `pg` + `attachDatabasePool`, PGlite nos testes —
  `library-docs.md §5`, D18)
- Server Components por padrão; `"use client"` só quando necessário; código de banco nunca vaza
  para o client (`import "server-only"`)
- Teste que só cobre o caminho feliz não conta — erro, limites (vazio, zero, máximo) e permissão
  negada sempre (`code-standards.md §7`)
- Refatorar nunca muda comportamento: testes verdes antes e depois, nunca no mesmo commit de uma
  feature
- Antes de qualquer biblioteca de terceiros — carregue a skill instalada dela, depois leia
  `.context/library-docs.md`; para API e sintaxe, consulte a doc atual (context7 /
  `node_modules/next/dist/docs/`)
- Atualize `progress-tracker.md`, `ui-registry.md` e `pendencias.md` após cada feature. Pendência
  nova entra como `Aberto, não triado`; uma fechada **muda de seção e ganha uma `Atualização`
  datada** — nunca é apagada
- Se o mesmo problema persistir depois de um prompt corretivo — pare e rode `/recover`
- Toda feature termina com um walkthrough didático para o desenvolvedor (`code-standards.md §9`)
- Nenhum nome real de funcionário, foto ou dado operacional da planilha original entra em commit,
  seed ou teste — use dados fictícios (`architecture.md §8`)

## Skills disponíveis

- `/architect` — antes de qualquer feature complexa. Pense antes de construir.
- `/grill-me` — para estressar um plano ou decisão antes de executar.
- `/imprint` — depois de qualquer componente de UI novo. Capture os padrões.
- `/review` — antes de demo ou quando algo parecer errado.
- `/recover` — quando algo quebra depois de uma correção que falhou.
- `/remember save` — quando uma feature atravessa várias sessões.
- `/remember restore` — ao voltar para uma feature de várias sessões.
