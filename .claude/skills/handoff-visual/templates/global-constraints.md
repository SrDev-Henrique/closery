# Global Constraints: visual de `<slug>` (branch `feat/visual-<slug>`, base `<base>`, <data>)

Vão no cabeçalho do plano e em todo brief. Adapte as linhas marcadas com `<...>` e apague o que não vale para a tela.

## Global Constraints

- A spec manda (`docs/superpowers/specs/<data>-visual-<slug>-design.md`). Quando a spec e o protótipo renderizado
  divergirem num valor fino, o protótipo manda.
- Só tokens: nenhum hex, `rgb()` ou `rgba()` nem classe de cor crua do Tailwind em `.tsx` (exceção: `src/lib/avatar.ts`).
  Sombra e véu são tokens. Tema claro **e** escuro em todo componente.
- O tema é o do projeto (`src/lib/theme.ts`, script no `<head>` do layout raiz). Componente client acima de `Suspense`
  fica sem `<script>`.
- "Celular" é abaixo de **860px**. Abaixo disso, todo controle tem 44px; controle só com ícone tem `aria-label` e
  tooltip; ícones `aria-hidden`.
- Movimento: componente novo ou restilizado nasce com Motion (`ui-rules.md §9`, `library-docs.md §23`): só `m`
  (`motion/react-m`) e os tokens de `src/lib/motion.ts`; nada anima na carga nem na hidratação; com
  `prefers-reduced-motion`, nada desliza, escala nem usa mola: no máximo um fade curto (`MOTION_DURATION.instant`) ou a
  troca na hora; os dois ramos (normal e movimento reduzido) testados com a `MotionTree` e o `stubReducedMotion`
  (`test/motion.tsx`), com o primeiro quadro, um valor no meio e o fim. O comportamento vem da variante da ArcUI listada
  no §23, nunca o estilo nem os valores dela.
- Os cortes de layout são de **área útil** (`@container/main`, invólucro sem padding; a área útil inclui o padding de
  40px). Cortes desta tela: `<cortes>`.
- A Satoshi mora fora do git (`bun run fonts` no `predev`/`prebuild`).
- Avatar gerado no servidor (semente = id do usuário), por mapa deduplicado; id anulável nunca vira semente vazia.
- Pessoas e textos: só Ana, Bruno, Carla e Diego Teste e o vocabulário de `scripts/visual/vocabulary.mjs`, em teste,
  seed, commit e mensagem. Nada do handoff entra no repositório.
- Regra de negócio igual: só campos a mais no `select`; agregação no SQL.
- Mudança de schema só por migração versionada; as tarefas não rodam `db:migrate`.
- `bunx vitest run <arquivo>` (o runner do Bun fica de fora). Porta 3000 nunca. Segredo nunca impresso.
- Commits: mensagem gravada com Write em `.git/sdd/visual-<slug>/msg-task-<N>.txt` e `git commit -F`, com o trailer do
  modelo que implementou. O `pre-commit` roda o `check-names`: um achado é texto a trocar, nunca hook a contornar.
- Toda tarefa termina com `bun run check-types`, `bun run lint` e os testes tocados verdes. Componente visual novo ou
  mudado atualiza o `ui-registry.md` no mesmo commit.
- Peça compartilhada: consulte o §3 do roteiro e o `ui-registry.md` antes de criar; acrescente variante em vez de duplicar.
- Mexeu em peça já verificada no pixel? Rerode os pares da tela dona dela.
- Extrair uma peça que já existe é tarefa `refactor` própria, antes da feature, com testes verdes antes e depois.
- Texto que o protótipo deixa sem `line-height` declarado usa `leading-[normal]`, escrito **depois** de qualquer
  `text-*` na mesma string.
- Pílula e selo vão sem borda transparente (`border-0` no tamanho).
- Fundo de estado dentro de `card` é `accent` (`muted` = `card` na paleta; `src/app/mutedBackground.test.ts`).
- Foco por contorno, com `outline-none` na base, leva `focus-visible:outline-solid`. Foco, contraste e tamanho se
  provam por estilo computado (E2E, `measure` ou `probe`).
- Contraste medido sobre cada fundo real da peça e nos estados hover, active e disabled.
- Página nova em `src/app/(app)` ganha a página nula do slot `@detalhe` no mesmo caminho, com os mesmos nomes de parâmetro; nenhum catch-all no slot (`library-docs.md §1` e `§14`). Se for linkada com buscas diferentes, entra no `PATHS` do `e2e/prefetch.spec.ts`.

## Decisões tomadas na montagem do plano

- `<decisão>`: `<por quê>`.
