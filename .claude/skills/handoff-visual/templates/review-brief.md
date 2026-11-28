# Revisão da Task <N> do visual de `<slug>` (`<antes>..<depois>`)

Você é o revisor da Task <N>. É só leitura: a árvore, o índice, o HEAD e as branches ficam como estão (para ver outra
revisão do código, `git show` e `git diff`).

## Entrada

- O texto da tarefa: `docs/superpowers/plans/<data>-visual-<slug>.md`, `### Task <N>`.
- A spec: `docs/superpowers/specs/<data>-visual-<slug>-design.md`; as Global Constraints:
  `.git/sdd/visual-<slug>/global-constraints.md`.
- O diff: `.git/sdd/visual-<slug>/review-task-<N>.diff` (commits, stat e diff de `<antes>..<depois>`).
- O relatório do implementador: `.git/sdd/visual-<slug>/task-<N>-report.md`.

## Os dois eixos

1. **Aderência:** tudo o que a tarefa e a spec pedem está lá, com os nomes do plano; nada além disso.
2. **Qualidade:** correção, limites (vazio, zero, máximo, nome longo, 5 setores), permissão negada, acessibilidade,
   clareza e testes que provam o comportamento.

## Conferências de toda revisão

- `node scripts/visual/registry-diff.mjs <antes> <depois>` sai com 0 (nenhum `###` do registro nem `####` das
  pendências sumiu).
- Os guardas `rawColors`, `themeContrast`, `mutedBackground`, `uiRegistryDoc` e `pendenciasDoc` ficam verdes
  (`bunx vitest run src/app/rawColors.test.ts` etc.).
- Componente client acima de `Suspense` sem `<script>`; render sem `Date.now`, `Math.random` ou `matchMedia`.
- Nenhuma cor literal em `.tsx`.
- Foco, contraste e tamanho provados por estilo computado (`probe`, `measure` ou E2E); teste que só confere a string da
  classe não basta.
- Contraste de cada peça nova ou mudada medido sobre cada fundo real (`background`, `card`, `accent`, pastel) e nos
  estados hover, active e disabled.
- As armadilhas do Tailwind 4 e do twMerge:
  - `outline-none` na base mais `focus-visible:outline-2` pede `focus-visible:outline-solid`;
  - o `cn` descarta o `ring-3` quando um `ring-0` vem depois;
  - o twMerge descarta o `leading-*` que vem antes de um `text-*`: o `leading` vai depois;
  - `buttonVariants` cru num `Link`, sem twMerge, deixa a ordem do CSS decidir.
- `leading-[normal]` onde o protótipo não declara `line-height`; pílula e selo sem borda transparente.
- Fundo de estado dentro de `card` é `accent`, nunca `bg-muted` nem `hover:bg-muted`.
- Componente visual mudado tem `Histórico` datado no `ui-registry.md` no mesmo commit.
- Página nova em `src/app/(app)` tem a página nula do `@detalhe` no mesmo caminho, e o slot não tem catch-all.
- Nenhum nome, e-mail ou texto do protótipo no diff (o `pre-commit` confere; desconfie de texto que não está no
  vocabulário de `scripts/visual/vocabulary.mjs`).

## Saída

Grave `.git/sdd/visual-<slug>/review-task-<N>.md`:

```markdown
### Strengths
### Issues
#### Critical (Must Fix)
#### Important (Should Fix)
#### Minor (Nice to Have)
(cada um: arquivo:linha, o que está errado, por que importa, como corrigir)
### Assessment
**Ready to merge?** Yes | No | With fixes
**Reasoning:** 1 a 2 frases
```

Calibre a severidade de verdade. Achado que contradiz o texto do plano ou da spec: marque "plan-mandated" (o dono
decide). A resposta final é curta: o caminho do relatório e a contagem por severidade.
