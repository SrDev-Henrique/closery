# Task <N> do visual de `<slug>` (`feat/visual-<slug>`)

Você é o implementador da Task <N>. Implemente exatamente o texto abaixo, em TDD, e faça um commit. O plano completo
está em `docs/superpowers/plans/<data>-visual-<slug>.md`; esta tarefa é a única que você executa.

## Onde você está

- Repositório: a raiz do `closery`; branch `feat/visual-<slug>`, nascida de `<base>`; HEAD antes desta tarefa:
  `<sha>`.
- Next.js 16 com Cache Components, React 19, Tailwind 4, Bun, Vitest + PGlite, Playwright; Windows com Git Bash.
- Pasta de trabalho (fora do git): `.git/sdd/visual-<slug>/`.

## Global Constraints

`<cole aqui o bloco de .git/sdd/visual-<slug>/global-constraints.md>`

## A tarefa

`<cole aqui o texto inteiro da Task <N> do plano, do cabeçalho ao commit>`

## Como trabalhar

- Siga os passos na ordem. O teste falha antes do código e passa depois; mostre as duas saídas no relatório.
- `bunx vitest run <arquivo>` só dos arquivos tocados e dos testes existentes que citam o que mudou
  (`grep -rl <nome> src test e2e`). Suíte inteira, build e E2E ficam para o controlador.
- No fim: `bun run check-types` e `bun run lint` verdes.
- Arquivo com acento ou barra invertida: a ferramenta Write.
- O `pre-commit` roda o `check-names`. Um achado (`arquivo:linha — termo nº N da lista`) é texto a trocar por um
  inventado; o hook fica ligado.
- Divergência entre o plano e o código: siga a spec, registre no relatório e, se ela muda comportamento, pare e
  pergunte ao controlador.

## Commit

Mensagem gravada com Write em `.git/sdd/visual-<slug>/msg-task-<N>.txt`, depois
`git add <os arquivos da tarefa> && git commit -F .git/sdd/visual-<slug>/msg-task-<N>.txt`. A mensagem é a do plano,
com a linha final `Co-Authored-By: Claude <modelo> <noreply@anthropic.com>`, onde `<modelo>` é o seu, o do modelo que
implementa (o controlador preenche aqui; por padrão o Sonnet, como nos Papéis da skill).

## Relatório

Grave `.git/sdd/visual-<slug>/task-<N>-report.md` com: o sha do commit; os comandos rodados e a saída de cada um
(vermelho e verde, com a contagem de testes); os testes existentes que mudaram; os desvios do plano, com o porquê; as
dúvidas. A resposta final é curta: o sha, os testes (N passed) e os desvios em uma linha cada.
