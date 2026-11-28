# Revisão final da branch `feat/visual-<slug>` (`<base>..<head>`), lente `<A | B | C>`

Você é um revisor sênior. Revise o trabalho concluído contra o plano e a spec e ache os problemas antes do merge. É só
leitura: a árvore, o índice, o HEAD e as branches ficam como estão (`git show` e `git diff` para ver outra revisão).

## O que foi construído

`<um parágrafo: a tela, o handoff, as peças novas e mudadas, os dados, os passes visuais>`

## Requisitos

- Spec: `docs/superpowers/specs/<data>-visual-<slug>-design.md` (decisões e desvios registrados nela).
- Plano: `docs/superpowers/plans/<data>-visual-<slug>.md` (o cabeçalho tem as Global Constraints e as decisões da
  montagem).
- Regras: `AGENTS.md` (no seu contexto) e `.context/*.md`.
- Ledger: `.git/sdd/visual-<slug>/progress.md`, com os Minor de cada revisão de tarefa.
- Relatórios dos passes: `.git/sdd/visual-<slug>/pixel.md` e `.git/sdd/visual-<slug>/legibilidade.md`.

## Diff

Pacote único (commits, stat e diff com contexto, sem `docs/superpowers` e sem `bun.lock`):
`.git/sdd/visual-<slug>/review-final.diff`. Leia em partes (offset e limit). Arquivo fora do pacote só para checar um
risco concreto: diga qual risco e o que conferiu.

## Evidência já reunida

- E2E: `<N passed>` em `<data>`, com o build de produção.
- Pixel: `<o maior par e o resíduo>`; legibilidade: `<telas e capturas>`.
- `<achados fora do escopo que já viraram pendência>`.

## A sua lente

- **A, dados, servidor e segurança:** consultas e agregação no SQL, `select` só com campos a mais, permissão por papel e
  setor, Server Actions guardadas, transação em escrita de vários statements, migração, nada de `server-only` vazando,
  erros que não imprimem dado de pessoa.
- **B, interface, acessibilidade e regras de UI:** fidelidade ao protótipo, tokens nos dois temas, contraste em cada
  fundo real e estado, foco visível provado por estilo computado, alvo de 44px abaixo de 860px, tooltip e
  `aria-label` em controle só com ícone, `prefers-reduced-motion`, as armadilhas do Tailwind 4 e do twMerge, `accent`
  como fundo de estado dentro de `card`, hidratação (nenhum `<script>` client acima de `Suspense`).
- **C, testes, documentos e plano:** testes de erro, limite e permissão; prova por estilo computado; aderência ao plano
  tarefa a tarefa; `ui-registry.md`, `pendencias.md`, `architecture.md`, `library-docs.md`, `progress-tracker.md`;
  **e a triagem de cada Minor do ledger** (corrigir antes do merge, e por quê, ou virar pendência).

## Não rode

Suíte inteira, build, E2E, `db:migrate` nem `db:push`. Um teste focado (`bunx vitest run <arquivo>`) só para uma
dúvida concreta.

## Saída

Grave `.git/sdd/visual-<slug>/final-review-<lente>.md`:

```markdown
### Strengths
### Issues
#### Critical (Must Fix)
#### Important (Should Fix)
#### Minor (Nice to Have)
(cada um: arquivo:linha, o que está errado, por que importa, como corrigir)
### Triagem dos Minor do ledger (só a lente C)
### Assessment
**Ready to merge?** Yes | No | With fixes
**Reasoning:** 1 a 2 frases
```

Calibre a severidade de verdade. Achado que contradiz o plano ou a spec: marque "plan-mandated" (o dono decide). A
resposta final é curta: o caminho do relatório e a contagem por severidade.
