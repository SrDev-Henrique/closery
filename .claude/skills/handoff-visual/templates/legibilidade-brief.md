# Legibilidade do visual de `<slug>` (`feat/visual-<slug>`, <data>)

Você conduz o passe de legibilidade: as telas da branch e as vizinhas que uma mudança global tocou (toast, Dialog,
tokens, primitivos) precisam continuar legíveis, nos dois temas e nas três larguras. Layout antigo não é defeito: ele
vai para a lista "Só layout antigo".

## Ambiente

O mesmo do pixel (`templates/pixel-brief.md`, "Ambiente"), com o estado rico: `bun run visual:seed state geral:rico`
(mais o estado da tela, se ela tiver um).

## Auditoria

```sh
bun run visual:audit --screen=legibilidade --out=visual-<slug> --only=<telas> --themes=dark,light --sizes=1440x900,390x844
```

- `<telas>`: as da branch e as vizinhas (`<lista>`); tela nova entra em `scripts/visual/screens/legibilidade.mjs`, com
  `extraWidths: [820]` onde há tabela ou lista (a 820 vem de lá; repetida no `--sizes`, a captura sairia duas vezes).
- O `audit` não semeia: o estado é o que estiver no banco (o `geral:rico` acima).
- O `audit.json` aponta: texto abaixo de 4,5:1 (3:1 no texto grande) contra o fundo efetivo, alvo menor que 44px abaixo
  de 860px, rolagem horizontal, borda de campo abaixo de 3:1 e bloco cujo fundo é igual ao do pai.
- Olhe todas as capturas em folhas de contato (`node scripts/visual/sheet.mjs <prefixo> --dir=visual-<slug>/legibilidade`)
  e amplie cada ponto suspeito (`node scripts/visual/crop.mjs`).

## Correções

- Uma por tela, `fix(visual): <tela> …`, com o teste que falha antes (o par em `src/app/themeContrast.test.ts`, ou o
  teste do componente) e a prova por estilo computado quando for foco, contraste ou tamanho.
- Só tokens; fundo de estado dentro de `card` é `accent`.
- `Histórico` datado no `ui-registry.md` de cada componente tocado.

## Saída

`.git/sdd/visual-<slug>/legibilidade.md`:

| Tela | Defeito | Commit |
|---|---|---|

Mais a lista **"Só layout antigo"** (o que fica para o handoff da tela), lida pela próxima branch. A resposta final é
curta: quantas telas e capturas, quantas correções e o que foi para a lista.
