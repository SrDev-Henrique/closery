---
name: handoff-visual
description: Implementar um handoff do Claude Design (README, `.dc.html` e screenshots de uma tela) no Closery, da abertura da branch ao PR, com as ferramentas `visual:*` e os modelos de brief.
---

# Handoff visual: do protótipo ao PR

Um handoff vira uma branch `feat/visual-<slug>` e um PR. O trabalho anda por doze etapas, cada uma com um
**critério de saída**; o **ledger** (`.git/sdd/visual-<slug>/progress.md`) registra cada etapa encerrada e manda sobre
o roteiro quando os dois divergirem. Três ideias guiam tudo:

- **O protótipo renderizado manda** no valor fino. As screenshots do handoff são reduzidas e servem de guia.
- **Texto inventado dos dois lados.** O que tem cara de gente ou de operação real fica em `.git/sdd/`; o repositório
  só vê Ana, Bruno, Carla e Diego Teste e o vocabulário de `scripts/visual/vocabulary.mjs`.
- **Prova por estilo computado.** Foco, contraste e tamanho se provam no navegador (`probe`, `measure`, E2E); a
  string da classe é só o começo.

Marcadores usados aqui e nos modelos: `<slug>` (o nome curto da tela, ex.: `passagens`), `<data>` (AAAA-MM-DD),
`<base>` (o commit da `main` de onde a branch nasceu), `<N>` (o número da tarefa).

## Primeiro passo, sempre

Leia, nesta ordem:

1. `.git/sdd/roadmap/roteiro.md`: a fila (§2.1, a linha desta branch e as pendências dela), as peças compartilhadas
   (§3), as decisões do dono (§4) e o processo (§6).
2. `.git/sdd/roadmap/map-<slug>.md`: o mapa da tela.
3. O ledger `.git/sdd/visual-<slug>/progress.md`, se existir: ele diz em que etapa a branch está.

Os três ficam fora do git. Se o roteiro ou o mapa faltarem, pergunte ao dono antes de seguir.

Saída: você sabe o `<slug>`, a linha da branch no §2.1 (escopo, dependências, pendências) e a etapa em que retoma.

## Papéis

- **Controlador** (a sessão principal, Opus): Etapa 0, perguntas, spec, contrato, montagem, briefs, passes visuais,
  portões, documentos e PR.
- **Sonnet:** redatores do plano, implementadores e revisores de tarefa.
- **Opus:** editor de consistência, revisão da spec, revisão das tarefas de risco (dados, layout raiz ou tema,
  primitivos compartilhados, qualquer coisa acima de `Suspense`), passes de pixel e de legibilidade e a revisão final.
- **O dono:** responde às perguntas (com recomendação) e aprova a spec. Com o plano commitado, a execução vai direto;
  decisão genuína no meio do caminho volta para ele. **O dono faz o merge**, com o CI verde (a `main` não tem
  proteção, P62: confira o CI antes de pedir o merge).

## Pastas

Tudo de trabalho fica em `.git/sdd/visual-<slug>/` (fora do git; o caminho sai de `git rev-parse --git-common-dir`):
`handoff/` (a cópia integral), `proto/` (as cópias com texto inventado), `ref/` (o protótipo renderizado), `pares/`,
`interacoes/`, `legibilidade/`, `medidas/`, `progress.md`, `decisions.md`, `mapa-atual.md`, `plan-contract.md`,
`global-constraints.md`, `draft-*.md`, `consistency-report.md`, `task-<N>-brief.md`, `task-<N>-report.md`,
`review-task-<N>.diff`, `msg-task-<N>.txt`, `pixel.md`, `legibilidade.md`, `review-final.diff`,
`final-review-{A,B,C}.md`, `final-fixes-brief.md` e `final-fixes-report.md`. A lista de nomes é global:
`.git/sdd/nomes-proibidos.txt`. O banco visual é compartilhado: `.git/sdd/visual-db/`.

No git: a spec em `docs/superpowers/specs/<data>-visual-<slug>-design.md`, o plano em
`docs/superpowers/plans/<data>-visual-<slug>.md` e a configuração de tela em `scripts/visual/screens/<slug>.mjs`.

A referência de cada ferramenta (entradas, saídas, códigos de saída) está em `.context/library-docs.md §22`.

## Etapa 0: abertura (controlador)

1. Com a `main` atualizada depois do merge anterior: `git switch -c feat/visual-<slug>`; `git status` limpo.
2. Copie a pasta do handoff para `.git/sdd/visual-<slug>/handoff/`. Crie o ledger com o commit base.
3. Privacidade:
   - acrescente a `.git/sdd/nomes-proibidos.txt` os nomes e e-mails do protótipo e das screenshots e os textos
     operacionais (descrições, frases de ocorrência e de próximo turno, observações, itens e destinos próprios); as
     palavras do domínio que já estão no código (setor, ULD, pátio) ficam de fora; `!<frase>` libera uma pessoa
     fictícia que contém um nome da lista;
   - `bun run visual:hooks` (idempotente): o `pre-commit` roda o `check-names` em todo commit;
   - escreva `.git/sdd/visual-<slug>/proto.config.mjs` (as trocas usam `ctx.people`, `ctx.avatars`, `ctx.now` e
     `ctx.vocabulary`, com `sectors`, `shifts`, `items`, `destinations` e `texts`; o `out` é `visual-<slug>/proto`) e
     rode `bun run visual:proto --config=visual-<slug>/proto.config.mjs`: termina sem sobra. Ele lê os avatares de
     `.git/sdd/visual-db/avatars.json`: se o arquivo não existir, suba antes o ambiente da Etapa 5 até o
     `bun run visual:seed avatars`;
   - texto novo que o seed precisa entra em `scripts/visual/vocabulary.mjs`, e o mesmo texto entra nas trocas: o
     pixel compara texto igual com texto igual.
4. Referência renderizada: cada estado, controlado pelas props do `.dc.html`, capturado no Chromium com
   `node scripts/visual/capture.mjs proto visual-<slug>/proto/<cópia>.html 1440x900 visual-<slug>/ref/<estado>-1440.png`
   (e `390x844`, e a terceira largura da Etapa 5), nos dois temas.
5. Mapa em dia: um subagente Sonnet confere o `map-<slug>.md` contra o código de agora (`ui-registry.md`, o `git log`
   das branches anteriores, o §3 do roteiro) e grava o delta em `mapa-atual.md`.
6. Medidas e cores:
   - rascunho da configuração de tela em `.git/sdd/visual-<slug>/screen.mjs` (o formato de
     `scripts/visual/screens/inicio.mjs`) e `node scripts/visual/measure.mjs --config=visual-<slug>/screen.mjs
     --state=<estado> --width=1440 --so-proto --out=visual-<slug>` para os px dos elementos principais;
   - a tabela hex → token;
   - o contraste de cada par novo, com o cálculo do `themeContrast.test.ts`, sobre **cada fundo real** da peça
     (`background`, `card`, `accent`, pastel) e nos estados hover, active e disabled;
   - os cortes de área útil da tela e os estados de interação e de falha que as screenshots desenham.

Saída: `ref/` completo, `mapa-atual.md`, a tabela de tokens, o contraste medido e `git status` limpo (nada do
handoff na árvore).

## Etapa 1: perguntas ao dono

Um lote só, com o que o lote 0 do roteiro não cobriu e o que as Etapas 0.5 e 0.6 revelaram; cada pergunta com opções
e uma recomendação. As respostas vão para `decisions.md`.

Saída: nenhuma decisão em aberto que mude a spec.

## Etapa 2: spec

- Estrutura da spec do Início: Objetivo, Decisões, Escopo, Fundação (tokens, formas), Dados, Telas e componentes,
  Interação e acessibilidade, Erros e limites, Testes, Verificação visual, Documentos, Riscos, Critério de pronto.
- Ela traz: os valores do protótipo renderizado e a regra "protótipo manda no valor fino"; os desvios declarados
  (44px, tooltip, token, contraste); os estados e limites (vazio, zero, máximo, nome longo, 5 setores, operador e admin,
  setor inativo, "Todos"); os campos de dados; a lista de pares, com as máscaras do que depende do agora, os estados de
  interação e de falha (com os passos de cada um) e a terceira largura; as pendências da linha da branch, com o que
  cada uma ganha.
- Segmento novo de primeiro nível em `src/app/(app)` ganha o espelho no slot `@detalhe` (`library-docs.md §1`).
- Revisão por um Opus contra o README, o mapa e as regras; o dono aprova; commit `docs(spec): …`.

Saída: a spec commitada e aprovada pelo dono.

## Etapa 3: plano

1. O controlador escreve `plan-contract.md` a partir de `templates/plan-contract.md` e `global-constraints.md` a
   partir de `templates/global-constraints.md`. Extração de peça que já existe é tarefa `refactor` própria, antes da
   feature, com os pares da tela dona rerodados.
2. Redatores Sonnet em paralelo, 2 ou 3 tarefas cada, cada um no seu `draft-<X>.md`.
3. Editor de consistência (Opus): cruza nomes, assinaturas, imports, arquivos, ordem, testes tocados por dois
   rascunhos e as classes que o `cn` funde; corrige no lugar e grava `consistency-report.md`.
4. Montagem: cabeçalho com as Global Constraints e as decisões da montagem, as tarefas em ordem e as do controlador
   (E2E, legibilidade, pixel, documentos e portão). Um script confere que todo `### Task N` está lá, em ordem. Número
   ou literal calculado (dashboard, paridade) o redator valida no clone integrado. Commit `docs: plano …`.

Saída: o plano commitado; a execução começa direto.

## Etapa 4: execução por subagentes

1. Por tarefa: `task-<N>-brief.md` a partir de `templates/task-brief.md`, o implementador (Sonnet), o commit
   (mensagem gravada com Write em `msg-task-<N>.txt` e `git commit -F`) e o `task-<N>-report.md`.
2. Revisão por tarefa sobre `review-task-<N>.diff` (`git diff <antes>..<depois> > .git/sdd/visual-<slug>/review-task-<N>.diff`),
   com o brief de `templates/review-brief.md`: Critical ou Important voltam ao mesmo implementador e a tarefa é
   revisada de novo; Minor vai para o ledger, para a triagem da revisão final.
3. A revisão roda `node scripts/visual/registry-diff.mjs <antes> <depois>`: nenhum cabeçalho `###` do registro nem
   `####` das pendências some.
4. E2E completo com build (`bun run test:e2e`) cedo: depois das tarefas de fundação (tokens, primitivos, layout), na
   metade do plano e antes dos passes visuais. Página nova entra no `e2e/hydration.spec.ts`. Conteúdo duplicado ou ids
   `_r_` do cliente onde deveria haver `_R_` do servidor apontam renderização no cliente: investigue com
   systematic-debugging antes de corrigir.

Saída: todas as tarefas revisadas e limpas, e o E2E verde.

## Etapa 5: pixel perfect (controlador, Opus)

O brief é `templates/pixel-brief.md`. Em resumo:

```sh
bun run visual:db                                   # em segundo plano; idempotente
. scripts/visual/env.sh && bun run build && bunx next start -p 3202   # em segundo plano (next dev -p 3202 para iterar)
bun run visual:seed base       # só na primeira vez: o banco visual fica em disco e é compartilhado (já semeado: sai com 1)
bun run visual:people          # só na primeira vez (de novo: "já existe")
bun run visual:seed avatars
bun run visual:proto --config=visual-<slug>/proto.config.mjs
bun run visual:pairs --screen=<slug> --out=visual-<slug> --sufixo=-antes   # semeia o estado de cada par sozinho
```

- Antes de mexer, `node scripts/visual/measure.mjs` lista as diferenças de caixa e de tipografia; as correções saem
  como `fix(visual): …`. Divergência que pede escolha vai ao dono.
- Cada estado × 1440×900 e 390×844 × escuro e claro, mais a terceira largura (só nos estados cujo layout muda no
  corte) e a tela com a sidebar recolhida em um estado.
- Meta: cerca de 0,1 a 0,2% por par, com os resíduos aceitos listados.
- Regressão: mexeu numa peça já medida? Rerode os pares da tela dona dela.

Saída: `pixel.md` com antes e depois de cada par, as alturas dos dois lados e cada resíduo explicado.

## Etapa 6: legibilidade (Opus)

O brief é `templates/legibilidade-brief.md`: `bun run visual:audit --screen=legibilidade --out=visual-<slug>
--only=<telas>` nas telas da branch e nas vizinhas tocadas por mudança global, a 1440, 820 e 390, nos dois temas. As
correções saem como `fix(visual)`.

Saída: `legibilidade.md` com os achados e os commits, e a lista "Só layout antigo" em dia.

## Etapa 7: revisão final em 3 lentes (Opus, em paralelo)

- O pacote `review-final.diff`: commits, stat e diff de `<base>..HEAD`, sem `docs/superpowers` e sem `bun.lock`.
- O brief é `templates/final-review-brief.md`, com as evidências (E2E, `pixel.md`, `legibilidade.md`, ledger).
- Lentes: **A** dados, servidor e segurança; **B** interface, acessibilidade e regras de UI; **C** testes,
  documentação e aderência ao plano, mais a triagem dos Minor do ledger.

Saída: os três relatórios, cada um com o veredito de merge.

## Etapa 8: rodada de correções

- Um brief consolidado (`final-fixes-brief.md`), F1 a Fn, já com as decisões do dono; cada item com RED e GREEN (o
  RED de foco, contraste ou tamanho é por estilo computado) e um relatório no fim.
- Depois, uma re-revisão curta em 3 lentes sobre o delta.
- Rodada extra quando aparece um Critical, ou um Important que seja regressão ou "não resolvido".
- Um item que volta da re-revisão sem solução é o mesmo problema depois de um prompt corretivo: pare, rode
  `/recover`, registre o diagnóstico no ledger e só então corrija de novo.

Saída: re-revisão sem Critical e sem Important aberto.

## Etapa 9: documentos

- `ui-registry.md` (entradas novas e `Histórico` datado; `node scripts/visual/registry.mjs <Componente> historico
  "<frase>"` edita uma entrada sem tocar nas outras), `ui-tokens.md`, `ui-rules.md`, `library-docs.md`,
  `architecture.md` (registro de decisões), `progress-tracker.md`, o runbook (se a ordem de deploy importar) e
  `memory.md`.
- `pendencias.md`: pendência nova entra como "Aberto, não triado"; a fechada muda de seção e ganha `Atualização`
  datada. Cada pendência da linha da branch no §2.1 ganha o fechamento ou a `Atualização`.
- O walkthrough didático no chat (`code-standards.md §9`).

Saída: `node scripts/visual/registry-diff.mjs <base>` sai com 0 e os guardas `uiRegistryDoc` e `pendenciasDoc` estão
verdes.

## Etapa 10: portão

```sh
bun run check-types && bun run lint
bunx vitest run src/app && bunx vitest run src/components && bunx vitest run src/features && bunx vitest run src/lib
bunx vitest run src/db src/instrumentation.test.ts src/proxy.test.ts && bunx vitest run test/
git ls-files '*.test.ts' '*.test.tsx' | wc -l    # = a soma dos arquivos das seis partes
bun run test:e2e && bun run build
bun run visual:names --range=main...HEAD
git ls-files | grep -iE '\.(woff2?|ttf|otf|png|jpe?g)$|\.dc\.html$|handoff/|screenshots/'   # vazio
git status --short                                                                        # vazio
```

Migração, se houver: o controlador roda no dev, com `bun run db:hosts` e o host conferido.

Saída: tudo verde, o `check-names` com 0 no diff inteiro da branch e a árvore limpa.

## Etapa 11: PR

- `git push -u origin feat/visual-<slug>` e `gh pr create`, com o corpo de `templates/pr-body.md`.
- CI verde (check-types, lint, test, test:e2e). O dono faz o merge.
- Depois do merge: atualize o §2 e o §3 do roteiro com o que nasceu de fato e abra a próxima branch da `main`.

Saída: o PR aberto com o CI verde e o link entregue ao dono.

## Regras da máquina

- Pouca memória (1 a 3 GB livres): um servidor e um navegador por vez; o Vitest por pasta ou arquivo; build e E2E só
  nos portões.
- O harness derruba processo ocioso em segundo plano: o banco visual fica em disco e os scripts de subida são
  idempotentes; antes de cada rodada, confira as portas (`netstat -ano | grep LISTEN`) e, no fim, derrube os servidores
  pelo PID.
- O Chromium do Playwright abre pelo `node` (as ferramentas de navegador são `.mjs`); banco e seed rodam com `bun`.
- `bunx vitest run <arquivo>`; o runner de testes do Bun fica de fora.
- Portas: o ambiente visual usa 54332 (banco) e 3202 (app); o E2E usa 54329 e 3200; o dono usa 54331 e 3201; a 3000 é de
  outro projeto.
- Arquivo e mensagem de commit com acento (ou com barra invertida) são escritos com a ferramenta Write: o heredoc do
  Git Bash os quebra.
- O segredo do ambiente visual mora em `.git/sdd/visual-db/secret` e só o `env.sh` o lê; o `.env.local` fica fechado.

## Onde cada lição entra

| Lição | Onde o processo a aplica |
|---|---|
| Pouca memória; processos ociosos derrubados; Vitest em partes | Regras da máquina; Etapas 4, 5 e 10 |
| O Chromium não abre pelo Bun no Windows | Regras da máquina; ferramentas de navegador em `.mjs` com `node` |
| Ambiente visual isolado (54332/3202), banco do dono intocado | Etapa 5; `config.mjs` recusa outra porta e outro host |
| Página fora de `(app)` dava 404 no `next dev` por causa do slot `@detalhe` | o espelho por segmento (`library-docs.md §1`); segmento novo ganha o espelho (Etapa 2) |
| Protótipo com cara de gente real | Etapa 0.3 (lista, hook, cópias inventadas); Etapa 10 (`--range`); contrato do plano |
| A Satoshi fora do git e de artefato público | Global Constraints; Etapa 10 (`git ls-files`) |
| `<script>` em componente client acima de `Suspense` duplicava o conteúdo | Global Constraints; revisão por tarefa; `e2e/hydration.spec.ts` |
| Container query mede a área útil, com o padding | Global Constraints; os cortes da spec são de área útil |
| O protótipo manda no valor fino; as screenshots são reduzidas | Etapas 0.4 e 2 |
| Hex do README vira token; contraste AA medido em cada fundo real e estado | Etapa 0.6; revisão por tarefa |
| Redatores em paralelo precisam de um editor de consistência | Etapa 3 |
| A revisão por tarefa pegou um registro corrompido | Etapa 4 (`registry-diff`) |
| Ids `_R_` e `_r_` denunciam renderização no cliente | Etapa 4 (E2E cedo) e `e2e/hydration.spec.ts` |
| Pixel com ferramentas, seed inventado, pares 1440 e 390 nos dois temas, máscaras | Etapa 5 |
| Teste que só conferia a classe passou com o defeito | Etapa 4 (revisão) e Etapa 8 (RED por estilo computado) |
| O guarda de contraste media o botão só sobre o `card` | Etapa 0.6 e revisão por tarefa |
| As armadilhas do Tailwind 4 e do twMerge (`outline-solid`, `ring-0` depois do `ring-3`, `leading` antes do `text-*`, `buttonVariants` cru) | Global Constraints; revisão por tarefa |
| `leading-[normal]` e a pílula sem borda transparente | Global Constraints; revisão por tarefa |
| `bg-muted` some dentro de cartão (`muted` = `card`) | `src/app/mutedBackground.test.ts`; Global Constraints |
| O mesmo problema voltou depois de um prompt corretivo | Etapa 8 (rodada extra e `/recover`) |
| O custo está no controlador, não na execução | estimativa por etapa e por número de pares (roteiro §8) |
| O seed copiava texto do protótipo | Etapa 0.3 (lista com textos, vocabulário inventado); Etapa 10 |
| Duas obras sobre os mesmos arquivos em paralelo | uma por vez, em série; o roteiro é relido contra o ledger antes de cada passo |
