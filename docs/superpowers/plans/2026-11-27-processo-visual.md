# Processo visual (PR B): 404 do `next dev`, ferramentas permanentes e guardas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** deixar pronto, uma vez, o que as cinco branches de tela seguintes (C a G) repetiriam à mão: o `next dev` volta a servir `/entrar`, `/convite/<token>`, `/redefinir-senha` e `/privacidade` sem mudar a produção; as ferramentas de verificação visual viram código do repositório (`scripts/visual/`); entram três guardas (nomes do protótipo, hidratação e `bg-muted`); e o processo vira a skill `handoff-visual`. Nenhuma tela muda de layout.

**Architecture:** o 404 se corrige trocando o catch-all do slot `@detalhe` por um espelho por segmento, provado por um guarda que roda o validador estrito do próprio Next no Vitest. As ferramentas são um motor versionado em `scripts/visual/`: módulos puros testados no Vitest, CLIs de navegador em `.mjs` rodados com `node` e banco e seed em `.ts` rodados com `bun`, com toda saída (e tudo o que tem original do protótipo) em `.git/sdd/` e um mundo visual inventado (`vocabulary.mjs`) que o seed e as cópias do protótipo usam igual. As guardas são o `check-names` no `pre-commit` local e no portão, o `e2e/hydration.spec.ts` com um verificador puro e o `src/app/mutedBackground.test.ts` com as violações trocadas por `bg-accent`; a skill e os documentos registram o processo, e o controlador prova tudo no C1 reproduzindo os pares do Início com as ferramentas novas.

**Tech Stack:** Next.js 16.4.6 (App Router, Cache Components, Turbopack, validação estrita de rotas), React 19.3, Tailwind CSS 4.3, shadcn base-nova, Drizzle + Postgres (PGlite com `@electric-sql/pglite-socket` no banco visual e nos testes), Better Auth, DiceBear (`@dicebear/core` 10.7.0), Playwright (Chromium só pelo `node`), `pixelmatch` 7.2.0 + `pngjs` 7.0.0 (devDependencies exatas), Vitest 5 + Testing Library, Biome 2.4, Bun, Git Bash no Windows.

**Spec:** `docs/superpowers/specs/2026-11-27-processo-visual-design.md` (commit `8d246e9`). **Fora do git:** o contrato do plano (`.git/sdd/processo/plan-contract.md`), o relatório do editor (`.git/sdd/processo/consistency-report.md`), o ledger (`.git/sdd/processo/progress.md`), o roteiro (`.git/sdd/roadmap/roteiro.md` §6 e §7) e as ferramentas antigas do PR A (`.git/sdd/visual/tools/`, só para portar a lógica, nunca uma string).

## Global Constraints

- A spec manda. Quando a spec e o código divergirem num nome, o contrato manda; registre a divergência.
- Ferramentas: saída só em `.git/sdd/` (via `git rev-parse --path-format=absolute --git-common-dir`, mais `/sdd`, nunca `.git/` fixo nem `new URL("../..")`); todo destino passa por `assertInsideSdd`, e um `--out` fora dele faz o script sair com código 1.
- As duas únicas exceções de destino: `registry.mjs` grava só `.context/ui-registry.md` e `install-hooks.mjs` grava só o `pre-commit` em `git rev-parse --git-path hooks` (respeita `core.hooksPath`).
- Chromium só por `node` (`.mjs`); banco e seed por `bun` (`.ts`).
- Banco PGlite em `127.0.0.1:54332` (`postgres://postgres:postgres@127.0.0.1:54332/postgres`), app em `http://localhost:3202`; `config.mjs` recusa outra URL de banco ou de app.
- Nunca as portas 3000, 3200, 3201, 54329 e 54331 (a 3000 é de outro projeto; 3200 e 54329 são do E2E; 3201 e 54331, do dono).
- Só pessoas e textos inventados: Ana, Bruno, Carla e Diego Teste (`<nome>.teste@example.com`; Ana admin, os outros três operadores do ULD), senha `VISUAL_PASSWORD = "senha-de-teste-123"`, e o vocabulário da spec §5.4, com os valores exatos, em `scripts/visual/vocabulary.mjs` (a única fonte).
- Nada do protótipo, das screenshots ou das ferramentas antigas (nome de pessoa, e-mail, texto operacional) em código, teste, seed, configuração versionada, commit, mensagem, brief ou ledger; o conteúdo de `.git/sdd/nomes-proibidos.txt` nunca sai dela (fora dela, só números: "N termos, M permitidas").
- O `check-names` nunca imprime o termo achado, só `arquivo:linha — termo nº N da lista (linha L)`; códigos 0 limpo, 1 achou, 2 lista ausente ou vazia ou uso errado (PB-D7).
- O hook é exatamente `#!/bin/sh` + `# closery:check-names (instalado por scripts/visual/install-hooks.mjs)` + `exec node scripts/visual/check-names.mjs --staged`; um `pre-commit` sem a marca é recusado (código 1), com a marca é regravado, e `--remove` apaga só o que tem a marca.
- O que é puro tem teste no Vitest (`test/visual/*.test.ts`), no padrão `scripts/smokeChecks.mjs` + `test/smokeChecks.test.ts`; scripts `.mjs` com JSDoc nos exports.
- Os testes TS **não importam `pngjs` nem `pixelmatch` direto** (sem `@types`): usam `createPng` e as funções de `image.mjs`/`diff.mjs`.
- Nada das ferramentas roda no CI além desses testes, que não dependem de navegador, rede, servidor nem da lista de nomes (o que precisa da lista usa `it.skipIf`); nada muda no `.github/workflows/ci.yml`; nenhum teste de screenshot no CI.
- devDependencies exatas: `"pixelmatch": "7.2.0"` e `"pngjs": "7.0.0"`, só por `bun add -d -E pixelmatch@7.2.0 pngjs@7.0.0` (o `bun.lock` muda junto); nenhuma outra dependência; usadas só em `scripts/visual/` e nos testes dele, nunca em `src/`.
- Constantes fixas: `THEME_STORAGE_KEY = "closery-tema"` (= `src/lib/theme.ts`), `VISUAL_INVITE_COOKIE = "closery_invite"` (= `INVITE_COOKIE`), `MOBILE_MAX_WIDTH = 859` ("celular" é abaixo de 860), `PIXELMATCH_THRESHOLD = 0.1`, `HIDE_DEV_CSS = "nextjs-portal{display:none!important}"`, `MASK_RGBA = [255, 0, 255, 255]`.
- Altura comum de um par: a maior altura natural dos dois lados, com mínimo de 844 abaixo de 860px de largura e 900 acima; larguras padrão `[1440, 390]`.
- Capturas com `reducedMotion: "reduce"`, esperando `document.fonts.ready` e as animações terminarem (até 3 s) mais 300 ms (PB-D6).
- Um servidor e um navegador por vez; cada CLI fecha o navegador ao fim de cada estado.
- Nunca imprimir segredo: o do ambiente visual é gerado em `.git/sdd/visual-db/secret` (32 bytes, base64) e só o `env.sh` o lê; nunca imprimir nem ler o `.env.local`.
- `bunx vitest run <arquivo>`, nunca `bun test`.
- Toda tarefa termina com `bun run check-types`, `bun run lint` e os testes tocados verdes (mais os testes existentes que citam o que mudou: `grep -rl <nome> src test e2e`).
- As tarefas não rodam suíte inteira, build, E2E nem servidor (memória de 1 a 3 GB livres): todo passo "Conferência … pelo controlador" fica para o C1 ou o portão do C2, com o comando e a saída esperada escritos na tarefa.
- Ferramenta de navegador (CLI) não tem teste no Vitest: o passo final dela é a conferência manual pelo controlador no C1.
- Testes cobrem erro, limite (vazio, zero, máximo) e recusa (porta errada, destino fora do `.git/sdd`), não só o caminho feliz.
- Arquivos com acento (e todo `.mjs`, `.ts` e `.sh` destas tarefas, porque o heredoc do Git Bash também estraga barra invertida): a ferramenta Write.
- Commit: mensagem gravada com Write em `.git/sdd/processo/msg-task-N.txt` e `git commit -F`, com o trailer do modelo que implementou (`Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` nas tarefas T1 a T10).
- Componente visual mudado atualiza o `ui-registry.md` (`Histórico` datado 2026-11-27) no mesmo commit; os cabeçalhos `###` não diminuem (`test/uiRegistryDoc.test.ts`).
- Pendência: a fechada muda de seção e ganha `Atualização` datada (2026-11-27), nunca é apagada; o índice do topo acompanha (`test/pendenciasDoc.test.ts`); pendência nova entra como "Aberto, não triado".
- `bg-muted` e `hover:bg-muted` nunca são fundo dentro de `card` (`accent`): `bg-muted` vira `bg-accent` com a mesma opacidade e a mesma variante (PB-D8); a única exceção é `src/components/solicitacoes/RequestColumn.tsx` `bg-muted/30`, com o motivo.
- Foco, contraste e tamanho se provam por estilo computado, nunca só pela classe.
- Sem hex cru nem classe de cor crua do Tailwind em `.tsx` (só tokens).
- Rotas: não entram `(app)/default.tsx`, o slot `@detalhe` no layout raiz nem `deprecated.looseRouteMatching`; toda rota nova de primeiro nível em `(app)` ganha o espelho no slot (página nula e, se tiver subrotas, o `[...rest]`).
- Página nula do espelho: exatamente `export default function <Nome>() { return null; }` (pode ter comentário acima), sem import e sem `metadata`.
- Nenhuma tela muda de layout; as únicas mudanças visíveis no app são os hovers e estados do §9 da spec.
- Faixa do pixel (C1): página até o número do PR A **mais 0,02 ponto percentual**, sem passar de 0,11% (o menu aberto, de 0,22%); no pack, o cartão até 0,005%; cada par com a mesma altura nos dois lados.
- Fora deste plano: Motion (emenda depois da T10, antes do C1), proteção da `main` (P62, decisão do dono), apagar `.git/sdd/visual/tools/` (fica como registro do PR A) e guardas do `leading-[normal]` e da borda transparente da pílula (ficam na revisão por tarefa).
- Para qualquer API do Next, leia `node_modules/next/dist/docs/` (rotas paralelas: `01-app/03-api-reference/03-file-conventions/parallel-routes.md`, `default.md`, `route-groups.md`).

## Ordem de execução

**C0 (Steps 1 a 4) → T1 → T2 → T3 → T4 → T5 → T6 → C0 Step 5 (instalar o hook e conferir a lista) → T7 → T8 → T9 → T10 → emenda do Motion (fora deste plano) → C1 → C2.** As tarefas aparecem abaixo nesta ordem. C0, C1 e C2 são do controlador e não têm número, para a emenda do Motion entrar depois da T10 sem renumerar.

| # | Tarefa | Spec | Depende de | Commit |
|---|---|---|---|---|
| C0 | Abertura: ledger e `nomes-proibidos.txt` (com a linha sentinela); hook depois da T6 | §7, §13.7 | — | nenhum |
| 1 | Espelho do `@detalhe` por segmento + `routeStructure.test.ts` + `appPagesAuth` + docs de rota + P81 e P44 | §4, §11 | — | `fix(rotas): espelho do slot @detalhe por segmento (404 do next dev)` |
| 2 | Verificador de hidratação + `e2e/hydration.spec.ts` + `library-docs §10` | §8 | — | `test(e2e): guarda de hidratação nas páginas principais` |
| 3 | Guarda do `bg-muted` + correções + `themeContrast` + registro + P83 | §9 | — (sempre depois da T1, pelo `pendenciasDoc.test.ts`) | `fix(visual): estados e rodapés sobre accent, não muted; guarda do bg-muted` |
| 4 | Base: `paths.mjs`, `config.mjs`, `vocabulary.mjs`, devDependencies exatas, `library-docs §21` | §5.1–5.4 | — | `chore(visual): base das ferramentas (caminhos, portas, vocabulário, pixelmatch e pngjs)` |
| 5 | Banco, ambiente, pessoas e seed + `visual:db`, `visual:seed`, `visual:people` | §5.3, §5.4, §5.7 | T4 | `chore(visual): banco, ambiente, pessoas e seed visual` |
| 6 | `names.mjs`, `check-names.mjs`, `install-hooks.mjs`, `docs.mjs`, `registry.mjs`, `registry-diff.mjs` + `visual:names`, `visual:hooks` | §5.3, §7 | T4 | `chore(visual): check-names, hook local e ferramentas do registro` |
| 7 | `screen`, `capture`, `image`, `diff`, `steps`, `proto`, `pairs`, `screens/inicio` + `visual:proto`, `visual:pairs` | §5.3, §5.5, §5.6, §6 | T4, T5, T6 | `chore(visual): captura, diferença, cópias do protótipo, passos e pares` |
| 8 | `measure`, `probe`, `interact`, `contrast`, `audit`, `sheet`, `sbs`, `crop`, `screens/legibilidade`, `screens/provas` + `visual:audit` | §5.3, §5.5, §6 | T7 | `chore(visual): medida, sonda, interação, auditoria e recortes` |
| 9 | Skill `handoff-visual` (SKILL.md + 8 modelos) + `test/skillHandoffVisual.test.ts` | §10 | T4–T8 (os nomes) | `docs(skill): handoff-visual, o processo das telas do Claude Design` |
| 10 | `AGENTS.md`, `library-docs §22`, `architecture.md` (registro do PR B) | §11 | T1–T9 | `docs: processo visual no AGENTS, library-docs e architecture` |
| C1 | Prova: 404, cópias, pares, falha de rede, hover, legibilidade, conferências das ferramentas, texto plantado, diff da branch | §13, §15 | T1–T10 | nenhum (resultado em `.git/sdd/processo/pixel.md`) |
| C2 | Documentos finais e portão: `progress-tracker.md`, `pendencias.md` (P62), `memory.md`, portão, `check-names --range`, PR | §11, §15 | C1 | `docs: fecha o PR B (progresso, pendências e memória)` |

## Decisões tomadas na montagem do plano

Do editor de consistência (`.git/sdd/processo/consistency-report.md`), as que valem para a execução:

- **T1 antes da T3, sempre:** a T3 acrescenta o P83 ao conjunto `closedByPrB` que a T1 cria no `test/pendenciasDoc.test.ts`, ancorada no texto exato que a T1 escreve.
- **Trailer:** `Claude Sonnet 5.5` nas T1 a T10 (o modelo que implementa); o commit do C2 é do controlador e leva `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Sondas de hover no claro:** em `screens/provas.mjs`, `hover-outline-em-cartao` e `hover-ghost-em-cartao` rodam com `theme: "light"`. No escuro o `outline` usa `dark:hover:bg-input/50` (a T3 não muda) e o `ghost` usa `accent/50`; a sonda compara a string da cor, que no semitransparente sempre difere da do pai, e não distinguiria o antes do depois. No claro os dois são `bg-accent` opaco.
- **`visual:seed avatars` lê os ids no banco pelos e-mails** (o `seed/index.ts` da T5), não no `state.json` como dizia o contrato: segue a ordem da spec §13.1 (`base` → `people` → `avatars`, antes de qualquer `state`).
- **`base` e `people` só na primeira vez:** o banco visual é compartilhado e fica em disco; o `base` repetido sai com 1 (recusa rodar com setores no banco).
- **Quem semeia:** `pairs`, `measure`, `probe` e `interact` semeiam o estado sozinhos; o `audit` não semeia (o C1 semeia `geral:rico` antes); o `measure --so-proto` não semeia.
- **`--out` obrigatório** no `measure` (sempre) e no `probe` sem `--app-only` (as cópias do protótipo moram em `<out>/proto/`).
- **Subida do dev, texto canônico (C1 Step 1 = T1 Step 14):** `. scripts/visual/env.sh && bun run fonts && bunx next dev -p 3202 > .git/sdd/processo/dev.log 2>&1` (o `bunx next dev` pula o `predev`); `/nao-existe` anônimo responde `307` (o `proxy.ts` manda para `/entrar`).
- **Conferências manuais das ferramentas no C1 Step 8:** as linhas da T5 (Step 24), da T7 (Step 27) e da T8 (Step 20) que os Steps 1 a 7 do C1 não cobrem.
- **Arquivos além da lista do contrato, aceitos:** `test/visual/people.test.ts` (T5), `test/visual/tempRepo.ts` (T6; a T4 e a T5 vêm antes e não o importam), `src/components/ui/{table,dialog,field}.test.tsx` (T3), e os exports a mais da T5 e da T7 (`DEFAULT_SECTOR`, `signUpOutcome`, `pickState`, `seedArgs`, `runSeed`, `naturalHeight`, `openState`, `closeState`, `commonHeight`, `parseRect`, `findLeftovers` e os de `states/inicio.ts`), que a T8 e o C1 usam.
- **`ui-rules.md §6` e `ui-tokens.md §7` mudam na T3** (fora da lista do contrato): sem isso os dois documentos ficariam errados depois da correção.
- **Desvio do PB-D8 na `AdminOverview`:** `group-hover:bg-accent` **opaco**, não `/50` (no escuro `accent/50` sobre a página dá exatamente o `--card`, e o hover continuaria invisível); há um caso negativo no `themeContrast.test.ts` e a linha do PB-D8 no `architecture.md` (T10) registra. Vai ao dono como ciência.
- **T6 Step 18 sempre roda:** acrescenta o caso "com a lista presente" ao `vocabulary.test.ts` da T4 (13 testes no arquivo, 12 caminhos no `--staged`), reaproveitando `allStrings(VOCABULARY)`.
- **Ordem final dos atalhos no `package.json`:** `visual:db`, `visual:seed`, `visual:people`, `visual:proto`, `visual:pairs`, `visual:audit`, `visual:names`, `visual:hooks` (a da tabela do `AGENTS.md` da T10); a T6, a T7 e a T8 ancoram o `old_string` no que a tarefa anterior deixou.
- **Lista do C0 contra o vocabulário:** a spec (§5.4) já está no git; cada termo da lista que coincidir com o vocabulário se decide no C0 Step 3 (sai da lista, se é palavra genérica de item ou de turno, ou ganha a linha `!<termo exato do vocabulário>`).
- **Hook numa branch sem `scripts/visual/`** recusa todo commit (o `node` não acha o script); o contorno é `bun run visual:hooks --remove`, documentado no `library-docs.md §22`, no registro de decisões e no `memory.md`.
- **Portão do Vitest em seis partes:** as cinco da spec §15.6 (`src/app`, `src/components`, `src/features`, `src/lib`, `test`) mais `src/db`, `src/instrumentation.test.ts` e `src/proxy.test.ts`, com a soma conferida contra `git ls-files '*.test.ts' '*.test.tsx'`.
- **E2E de hidratação não rodou na redação:** a primeira execução (portão) pode achar `_r_` ou id repetido; investigar com systematic-debugging antes de qualquer entrada no `CLIENT_ONLY_IDS` (só para componente que monta depois da hidratação de propósito, com o motivo).
- **`memory.md`:** o bullet de "Coisas que vão te morder" que descreve o `[...catchAll]` passa a descrever o espelho no C2 Step 6; as menções do `architecture.md` (Fase 4, item d; Fase 5) são histórico e ficam, e o PB-D1 da T10 registra a troca.
- **Guarda de "rodar como script":** o `runsAsScript()` local da T6 e o `import.meta.url === pathToFileURL(process.argv[1]).href` dos CLIs da T5, T7 e T8 valem os dois; não há helper comum.
- **Cercas no plano:** os blocos `~~~~markdown` da T9 (os modelos da skill), do C0 e da T10 contêm linhas `### Task N`, ``### Task `<N>` ``, `### Strengths` e `### 2026-11-27 — …`; qualquer script que liste as tarefas deste plano precisa pular o que está dentro de cerca.

Convenções dos rascunhos que valem para toda tarefa:

- Comandos a partir da raiz do repositório, no Git Bash.
- Formatação antes do lint: `bunx biome check --write <arquivos da tarefa>` (formata, ordena imports, só correções seguras) antes do `bun run lint`, que é `biome check` e reprova formato e ordem de imports.
- Vermelho dos testes novos: o primeiro vermelho é o import que ainda não existe ("Failed to load url …" ou "Cannot find module …", conforme o Vitest 5); o que importa é o arquivo não carregar por causa do módulo que falta.
- O git desta máquina tem `core.autocrlf=true` no sistema e o repositório tem `* text=auto eol=lf`: os testes dos CLIs da T6 rodam num repositório temporário sem a configuração global e a do sistema e sem nenhuma variável `GIT_*` (`test/visual/tempRepo.ts`).
- O `paths.test.ts` grava e apaga `.git/sdd/tmp-testes/paths-*`; a pasta `tmp-testes` vazia fica.

---

### Task C0: Abertura (controlador)

**Spec:** §7, §13.7 · **Redator:** R3 (texto) / controlador · **Depende de:** — · **Commit:** nenhum

**Files** (todos fora do git):
- Modify: `.git/sdd/processo/progress.md` (o ledger)
- Create: `.git/sdd/nomes-proibidos.txt` (a lista)
- Create e Delete: `.git/sdd/processo/termos.tmp` (só na conferência do Step 3)

**Interfaces:**
- Consumes: nada (antes da T1).
- Produces: a lista em `.git/sdd/nomes-proibidos.txt`, no formato que o `parseNamesList` da T6 lê (uma entrada por linha;
  `#` comenta; `!` permite; a **linha sentinela** é a primeira linha não vazia depois do comentário `# sentinela`). Depois
  da T6: o `pre-commit` instalado.

- [ ] **Step 1: Ledger**

Acrescente ao fim de `.git/sdd/processo/progress.md` (ferramenta Edit):

```markdown

## Execução (plano `docs/superpowers/plans/2026-11-27-processo-visual.md`, commit <sha do plano>)

- [ ] C0 abertura: lista de nomes (hook depois da T6)
- [ ] T1 espelho do @detalhe · [ ] T2 hidratação · [ ] T3 bg-muted
- [ ] T4 base · [ ] T5 banco, ambiente, pessoas e seed · [ ] T6 nomes, hook e registro · [ ] hook instalado
- [ ] T7 captura, diferença, cópias e pares · [ ] T8 medida, sonda, interação e auditoria
- [ ] T9 skill · [ ] T10 documentos do processo
- [ ] emenda do Motion
- [ ] C1 prova (resultado em .git/sdd/processo/pixel.md)
- [ ] C2 documentos, portão e PR

### Minor das revisões por tarefa (para a triagem da revisão final)
```

- [ ] **Step 2: Escrever a lista de nomes**

Fontes (todas fora do git; leia como texto): os dois handoffs do Início, `.git/sdd/visual/handoff/` e
`.git/sdd/visual/handoff-correcoes/` (o `README.md`, o `.dc.html` e o que as screenshots mostram), e as strings que as
ferramentas do PR A copiaram do protótipo (`.git/sdd/visual/tools/seed.ts`, `mkproto.mjs`, `mkproto-correcoes.mjs`,
`signup.mjs`, `run.mjs`, `run-correcoes.mjs`). Entra:

- cada pessoa: o nome completo e o primeiro nome (e o sobrenome, quando é raro);
- cada e-mail, inteiro; o domínio próprio de uma empresa, sozinho (domínio genérico de webmail também);
- cada texto operacional: descrições de solicitação, frases de ocorrência e de próximo turno, observações, e os nomes
  próprios de item, destino e setor que o protótipo inventou.

Fica de fora a palavra genérica do domínio que já está no código (setor, ULD, pátio, turno, passagem): ela daria falso
positivo em todo commit.

Grave com a ferramenta **Write** (tem acento), neste formato:

```text
# nomes-proibidos.txt (fora do git). Uma entrada por linha; "#" comenta; "!<frase>" permite.
# Busca sem caixa e sem acento; palavra e frase só inteiras; e-mail (tem @) como trecho.

# Pessoas dos protótipos do Início (nome completo, primeiro nome)
<uma por linha>

# E-mails e domínios
<uma por linha>

# Textos operacionais dos protótipos (descrições, frases, observações, itens, destinos, setores)
<uma por linha>

# Permitidas: pessoa fictícia que contém um termo da lista (uma linha "!" para o nome e outra para o e-mail)
!<Nome> Teste
!<nome>.teste@example.com

# sentinela (só para a prova do C1, spec §13.7)
<uma frase inventada, com acento, que não existe em lugar nenhum do repositório>
```

Regras: as linhas `!` só existem para as pessoas fictícias (Ana, Bruno, Carla e Diego Teste) cujo primeiro nome também é
um termo da lista; a sentinela é a **última** entrada do arquivo. O conteúdo da lista nunca vai para o chat, o ledger, um
brief ou uma mensagem de commit: fora dela, fala-se só em números ("N termos, M permitidas").

- [ ] **Step 3: Conferir falso positivo contra o repositório**

```sh
grep -v -e '^#' -e '^!' -e '^[[:space:]]*$' .git/sdd/nomes-proibidos.txt > .git/sdd/processo/termos.tmp
git grep -l -i -w -F -f .git/sdd/processo/termos.tmp -- . ; echo "código: $?"
rm .git/sdd/processo/termos.tmp
```

Expected: `código: 1` (nenhum arquivo versionado tem um termo). Cada arquivo listado (só o caminho é impresso): abra e
decida pelo termo; palavra genérica sai da lista, pessoa fictícia ganha a linha `!`, e um vazamento de verdade que já está
na `main` vira pendência nova no C2 (o `--range` da branch só confere as linhas acrescentadas). O `git grep` não ignora
acento: a conferência exata vem no Step 5, com o `check-names`.

**O vocabulário inventado já está no git** (a spec, §5.4, commitada em `8d246e9`). Se a spec aparecer na lista do
`git grep`, um termo coincide com o vocabulário que a T4 grava em `scripts/visual/vocabulary.mjs` (itens curtos como os
do ULD, da Carga, das Operações e da Rampa, "Turno 1/2/3", os destinos). Cada coincidência sai da lista (palavra genérica
de item ou de turno) ou ganha a linha `!<termo exato do vocabulário>`; sem isso o caso local do `vocabulary.test.ts`
(T6), o `pre-commit` da T7 e o `--range` do C2 reprovariam o vocabulário que a spec manda usar. Registre só a contagem
no ledger.

- [ ] **Step 4: Registrar no ledger**

Uma linha em `.git/sdd/processo/progress.md`, sem nenhum termo:
`2026-11-27 controlador: C0 lista gravada (N termos, M permitidas, sentinela na última linha); conferência do git grep: <resultado>.`

- [ ] **Step 5: Depois da T6, instalar o hook e conferir a lista** (o passo "instalar o hook" da ordem de execução)

```sh
bun run visual:hooks
bun run visual:names --range=main...HEAD; echo "código: $?"
bun run visual:names --file=.git/sdd/visual/tools/seed.ts; echo "código: $?"
bun run visual:names --file=scripts/visual/vocabulary.mjs; echo "código: $?"
```

Expected, nesta ordem:
1. `hook instalado: <...>/.git/hooks/pre-commit`;
2. `check-names: nada da lista em … linha(s), … caminho(s) e … mensagem(ns).` e `código: 0` (a spec e as tarefas T1 a T6,
   que entraram antes do hook, estão limpas);
3. linhas `.git/sdd/visual/tools/seed.ts:<linha> — termo nº N da lista (linha L)` e `código: 1` (o seed do PR A copiava
   texto do protótipo: a lista o pega);
4. `código: 0`.

Se o 2 sair com 1, o achado é de um commit desta branch: corrija o texto num commit novo antes da T7. Se o 3 sair com 0,
a lista não cobre os textos: volte ao Step 2. Linha no ledger: `hook instalado; --range limpo; a lista pega o seed antigo`.

---

### Task 1: Espelho do slot `@detalhe` por segmento (404 do `next dev`)

**Spec:** §4, §11 · **Redator:** R1 · **Depende de:** —

**Files:**
- Create: `src/app/routeStructure.test.ts`
- Create: `src/app/(app)/@detalhe/admin/page.tsx`
- Create: `src/app/(app)/@detalhe/admin/[...rest]/page.tsx`
- Create: `src/app/(app)/@detalhe/bem-vindo/page.tsx`
- Create: `src/app/(app)/@detalhe/conta/page.tsx`
- Create: `src/app/(app)/@detalhe/dashboard/page.tsx`
- Create: `src/app/(app)/@detalhe/passagens/page.tsx`
- Create: `src/app/(app)/@detalhe/passagens/[...rest]/page.tsx`
- Create: `src/app/(app)/@detalhe/solicitacoes/page.tsx`
- Create: `src/app/(app)/@detalhe/solicitacoes/[...rest]/page.tsx`
- Delete: `src/app/(app)/@detalhe/[...catchAll]/page.tsx`
- Modify: `src/app/appPagesAuth.test.ts` (`NULL_SLOT_PAGES`: sai o `[...catchAll]`, entram as nove; comentário)
- Modify: `test/pendenciasDoc.test.ts` (o laço "P81 a P108 abertas" pula as que o PR B fechou; caso novo do P81 e do P44)
- Modify: `.context/pendencias.md` (P81 para "Resolvido" com `Atualização`; P44 ganha `Atualização`; índice)
- Modify: `.context/library-docs.md` (§1 bullet novo; §9, §10 e §14: as frases do `[...catchAll]` passam a descrever o espelho)
- Test: `src/app/routeStructure.test.ts`, `src/app/appPagesAuth.test.ts`, `test/pendenciasDoc.test.ts`

Testes existentes que mudam (`grep -rln "catchAll\|NULL_SLOT_PAGES" src test e2e` → `src/app/appPagesAuth.test.ts`;
`grep -n "number = 81" test/pendenciasDoc.test.ts` → o laço do P81 ao P108). Não toca `architecture.md` (a T10 registra).

**Interfaces:**
- Consumes: nada.
- Produces:
  - `src/app/routeStructure.test.ts`: `export function listAppRouteFiles(appDir: string): { pages: string[]; defaults: string[] }`
    e `export function validateRoutes(pages: readonly string[], defaults: readonly string[]): { unmatched: string[]; incompatible: unknown[]; routes: Record<string, string[]> }`.
  - `src/app/appPagesAuth.test.ts`: `NULL_SLOT_PAGES` = `"@detalhe/page.tsx"` + as nove páginas do espelho (relativas a
    `src/app/(app)`, com `/`).
  - As nove páginas nulas `DetalheAdmin`, `DetalheAdminRest`, `DetalheBemVindo`, `DetalheConta`, `DetalheDashboard`,
    `DetalhePassagens`, `DetalhePassagensRest`, `DetalheSolicitacoes`, `DetalheSolicitacoesRest`.
  - A regra (para a skill da T9 e o `library-docs.md`): segmento novo de primeiro nível em `(app)` ganha o espelho.

- [ ] **Step 1: Escrever o guarda da estrutura de rotas (o teste que falha)**

Arquivo novo `src/app/routeStructure.test.ts`:

```ts
/**
 * Guarda da estrutura de rotas (PR B, spec §4.6, P81). Roda o validador estrito do próprio Next
 * (`normalizeCatchAllRoutes` com `strictRouteMatching: true`, o que o `next dev` 16.4 chama em
 * `server/lib/router-utils/setup-dev-bundler.js`) sobre a árvore real de `src/app`. Foi ele que
 * derrubou `/entrar`, `/convite/[token]`, `/redefinir-senha` e `/privacidade` no dev: o
 * `@detalhe/[...catchAll]` normaliza para `/[...catchAll]`, é pendurado em toda rota, e a poda
 * estrita apaga a rota inteira quando o `children` de `(app)` não tem página nem `default` nela.
 *
 * Os dois módulos são internos do Next (caminhos fixados na 16.4.6, `library-docs.md §1`). Se uma
 * atualização os mover, o import quebra aqui com a mensagem do Node: atualize o caminho. Se o
 * comportamento mudar, o grupo 5 (a causa, numa árvore sintética) avisa.
 *
 * Rodar: `bunx vitest run src/app/routeStructure.test.ts`
 */
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { normalizeCatchAllRoutes } from "next/dist/server/lib/router-utils/normalize-catchall-routes";
import { normalizeAppPath } from "next/dist/shared/lib/router/utils/app-paths";
import { afterAll, describe, expect, it } from "vitest";

// O Next só lê estes nomes como página e `default` (pageExtensions padrão).
const ROUTE_FILE = /^(page|default)\.(?:tsx|ts|jsx|js)$/;

/**
 * As páginas e os `default` de uma pasta `app`, como o Next os vê: caminho a partir da pasta, sem
 * extensão, com `/` (`"/(app)/admin/page"`, `"/(app)/@detalhe/default"`, `"/privacidade/page"`).
 * Pasta privada (`_nome`) fica fora, como no Next. Ordenados.
 */
export function listAppRouteFiles(appDir: string): {
  pages: string[];
  defaults: string[];
} {
  const pages: string[] = [];
  const defaults: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (!entry.name.startsWith("_")) walk(join(dir, entry.name));
        continue;
      }
      const match = ROUTE_FILE.exec(entry.name);
      if (!match?.[1]) continue;
      const folder = relative(appDir, dir).replaceAll("\\", "/");
      const appPath = `${folder ? `/${folder}` : ""}/${match[1]}`;
      (match[1] === "page" ? pages : defaults).push(appPath);
    }
  };
  walk(appDir);
  return { pages: pages.sort(), defaults: defaults.sort() };
}

/**
 * Roda o validador estrito do Next: monta `{ rota: [páginas] }` como o `next dev` (a rota é o
 * `normalizeAppPath` da página) e devolve as páginas que ficaram sem rota, os slots incompletos e o
 * mapa já podado (o validador muda o mapa no lugar: acrescenta os catch-alls e apaga o que não
 * renderiza).
 */
export function validateRoutes(
  pages: readonly string[],
  defaults: readonly string[],
): {
  unmatched: string[];
  incompatible: unknown[];
  routes: Record<string, string[]>;
} {
  const routes: Record<string, string[]> = {};
  for (const page of pages) {
    const route = normalizeAppPath(page).replace(/%5F/g, "_");
    routes[route] = [...(routes[route] ?? []), page];
  }
  const { unmatchedAppPages, incompatibleParallelRouteSlots } =
    normalizeCatchAllRoutes(routes, undefined, {
      strictRouteMatching: true,
      defaultAppPaths: defaults,
    });
  return {
    unmatched: unmatchedAppPages,
    incompatible: incompatibleParallelRouteSlots,
    routes,
  };
}

const SLOT = "/(app)/@detalhe/";

/** Rota ou página interceptada: `(.)`, `(..)`, `(...)` e `(..)(..)`. */
function isInterception(appPath: string): boolean {
  return /\/\(\.{1,3}\)/.test(appPath);
}

/**
 * As rotas que têm página do grupo `(app)` (o `children`) mas nenhuma página do slot `@detalhe` que
 * não seja a interceptada. Numa navegação no cliente o slot sem página mantém a última ativa: o
 * Sheet do detalhe ficaria aberto sobre essa tela.
 */
function routesWithoutSlotPage(routes: Record<string, string[]>): string[] {
  return Object.entries(routes)
    .filter(([route, appPaths]) => {
      if (isInterception(route)) return false;
      const hasChildrenPage = appPaths.some(
        (appPath) =>
          appPath.startsWith("/(app)/") && !appPath.startsWith("/(app)/@"),
      );
      const hasSlotPage = appPaths.some(
        (appPath) => appPath.startsWith(SLOT) && !isInterception(appPath),
      );
      return hasChildrenPage && !hasSlotPage;
    })
    .map(([route]) => route)
    .sort();
}

/** O espelho que a árvore pede: por segmento de primeiro nível de `(app)` com página. */
function expectedMirror(pages: readonly string[]): string[] {
  const mirror = new Set<string>();
  for (const page of pages) {
    const segments = page.split("/").filter(Boolean);
    // ["(app)", "<segmento>", …, "page"]; a página da raiz ("/(app)/page") é do @detalhe/page.
    if (segments[0] !== "(app)" || segments.length < 3) continue;
    const segment = segments[1] ?? "";
    if (segment.startsWith("@") || segment.startsWith("(")) continue;
    mirror.add(
      segments.length === 3
        ? `${SLOT}${segment}/page`
        : `${SLOT}${segment}/[...rest]/page`,
    );
  }
  return [...mirror].sort();
}

/** As páginas do slot fora da raiz e da interceptada (o espelho que existe). */
function actualMirror(pages: readonly string[]): string[] {
  return pages
    .filter(
      (page) =>
        page.startsWith(SLOT) &&
        page !== `${SLOT}page` &&
        !isInterception(page),
    )
    .sort();
}

const tree = listAppRouteFiles(import.meta.dirname);
const real = validateRoutes(tree.pages, tree.defaults);

/** As quatro páginas de fora de `(app)` que o dev derrubava (P81). */
const OUTSIDE_APP: Record<string, string[]> = {
  "/entrar": ["/(auth)/entrar/page"],
  "/convite/[token]": ["/(auth)/convite/[token]/page"],
  "/redefinir-senha": ["/(auth)/redefinir-senha/page"],
  "/privacidade": ["/privacidade/page"],
};

/** O espelho de hoje (spec §4.5): a branch que criar um segmento acrescenta o dele. */
const MIRROR_TODAY = [
  `${SLOT}admin/page`,
  `${SLOT}admin/[...rest]/page`,
  `${SLOT}bem-vindo/page`,
  `${SLOT}conta/page`,
  `${SLOT}dashboard/page`,
  `${SLOT}passagens/page`,
  `${SLOT}passagens/[...rest]/page`,
  `${SLOT}solicitacoes/page`,
  `${SLOT}solicitacoes/[...rest]/page`,
];

describe("listAppRouteFiles (a árvore como o Next a vê)", () => {
  const dirs: string[] = [];
  afterAll(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  });

  function fakeApp(files: readonly string[]): string {
    const dir = mkdtempSync(join(tmpdir(), "closery-rotas-"));
    dirs.push(dir);
    for (const file of files) {
      mkdirSync(join(dir, file, ".."), { recursive: true });
      writeFileSync(
        join(dir, file),
        "export default function P() { return null; }\n",
      );
    }
    return dir;
  }

  it("pasta vazia: nada", () => {
    expect(listAppRouteFiles(fakeApp([]))).toEqual({ pages: [], defaults: [] });
  });

  it("lê page e default em qualquer extensão do Next, com grupo, slot e catch-all", () => {
    const dir = fakeApp([
      "page.tsx",
      "(g)/a/page.ts",
      "(g)/@s/default.jsx",
      "(g)/@s/[...rest]/page.js",
    ]);
    expect(listAppRouteFiles(dir)).toEqual({
      pages: ["/(g)/@s/[...rest]/page", "/(g)/a/page", "/page"],
      defaults: ["/(g)/@s/default"],
    });
  });

  it("ignora teste, layout, loading, route, pasta privada e outro nome", () => {
    const dir = fakeApp([
      "a/page.test.tsx",
      "a/layout.tsx",
      "a/loading.tsx",
      "a/route.ts",
      "_privado/page.tsx",
      "a/_x/default.tsx",
      "a/pages.tsx",
    ]);
    expect(listAppRouteFiles(dir)).toEqual({ pages: [], defaults: [] });
  });
});

describe("validateRoutes (o validador do Next)", () => {
  it("lista vazia: nada sem rota, nenhum slot incompleto, mapa vazio", () => {
    expect(validateRoutes([], [])).toEqual({
      unmatched: [],
      incompatible: [],
      routes: {},
    });
  });
});

describe("a árvore real de src/app passa no validador estrito do Next", () => {
  it("anti-vacuidade: acha as páginas e o default do slot", () => {
    expect(tree.pages.length).toBeGreaterThanOrEqual(20);
    expect(tree.pages).toEqual(
      expect.arrayContaining([
        "/(app)/page",
        "/(app)/@detalhe/page",
        "/(app)/@detalhe/(.)solicitacoes/[id]/page",
        ...Object.values(OUTSIDE_APP).flat(),
      ]),
    );
    expect(tree.defaults).toContain("/(app)/@detalhe/default");
    expect(tree.pages.some((page) => page.includes(".test"))).toBe(false);
  });

  it("1. nenhuma página fica sem rota e nenhum slot fica incompleto", () => {
    expect(real.unmatched).toEqual([]);
    expect(real.incompatible).toEqual([]);
  });

  it("2. /entrar, /convite/[token], /redefinir-senha e /privacidade são rotas, sem página do @detalhe", () => {
    for (const [route, appPaths] of Object.entries(OUTSIDE_APP)) {
      expect(real.routes[route], route).toEqual(appPaths);
    }
  });

  it("3. nenhuma rota começa com /[...: URL desconhecida continua no 404 da raiz", () => {
    expect(
      Object.keys(real.routes).filter((route) => route.startsWith("/[...")),
    ).toEqual([]);
  });
});

describe("4. o espelho do @detalhe por segmento de (app)", () => {
  it("cada segmento com página tem a página nula do slot; com subrota, também o [...rest]", () => {
    expect(actualMirror(tree.pages)).toEqual(expectedMirror(tree.pages));
  });

  it("o espelho de hoje são as nove páginas da spec §4.5", () => {
    expect(expectedMirror(tree.pages)).toEqual(
      expect.arrayContaining(MIRROR_TODAY),
    );
  });

  it("toda rota do grupo (app) leva uma página do @detalhe que não é a interceptada (o Sheet fecha)", () => {
    expect(routesWithoutSlotPage(real.routes)).toEqual([]);
  });

  it("não existem @detalhe/[...catchAll] nem (app)/default", () => {
    expect(tree.pages).not.toContain(`${SLOT}[...catchAll]/page`);
    expect(tree.defaults).not.toContain("/(app)/default");
  });
});

describe("5. a causa, documentada numa árvore sintética", () => {
  const before = [
    "/(app)/page",
    "/(app)/@detalhe/page",
    "/(app)/@detalhe/[...catchAll]/page",
    "/(app)/conta/page",
    "/(auth)/entrar/page",
  ];
  const slotDefault = ["/(app)/@detalhe/default"];

  it("catch-all na raiz do slot: a página do grupo irmão fica sem rota (o 404 do dev)", () => {
    const result = validateRoutes(before, slotDefault);
    expect(result.unmatched).toEqual(["/(auth)/entrar/page"]);
    expect(result.routes["/entrar"]).toBeUndefined();
    expect(result.routes["/conta"]).toContain(
      "/(app)/@detalhe/[...catchAll]/page",
    );
  });

  it("com (app)/default (a candidata recusada): passa, mas nasce a rota /[...catchAll] e o slot entra em /entrar", () => {
    const result = validateRoutes(before, [...slotDefault, "/(app)/default"]);
    expect(result.unmatched).toEqual([]);
    expect(result.routes["/[...catchAll]"]).toEqual([
      "/(app)/@detalhe/[...catchAll]/page",
    ]);
    expect(result.routes["/entrar"]).toContain(
      "/(app)/@detalhe/[...catchAll]/page",
    );
  });

  it("com o espelho: tudo tem rota e /entrar fica sem o slot", () => {
    const mirror = [
      "/(app)/page",
      "/(app)/@detalhe/page",
      "/(app)/@detalhe/conta/page",
      "/(app)/conta/page",
      "/(auth)/entrar/page",
    ];
    const result = validateRoutes(mirror, slotDefault);
    expect(result.unmatched).toEqual([]);
    expect(result.routes["/entrar"]).toEqual(["/(auth)/entrar/page"]);
    expect(routesWithoutSlotPage(result.routes)).toEqual([]);
  });

  it("segmento novo sem espelho: o validador deixa passar, o guarda do grupo 4 reprova", () => {
    const missing = [
      "/(app)/page",
      "/(app)/@detalhe/page",
      "/(app)/relatorios/page",
      "/(auth)/entrar/page",
    ];
    const result = validateRoutes(missing, slotDefault);
    expect(result.unmatched).toEqual([]);
    expect(routesWithoutSlotPage(result.routes)).toEqual(["/relatorios"]);
    expect(actualMirror(missing)).not.toEqual(expectedMirror(missing));
  });

  it("espelho órfão (o segmento saiu e a página do slot ficou): o validador reprova", () => {
    const orphan = [
      "/(app)/page",
      "/(app)/@detalhe/page",
      "/(app)/@detalhe/relatorios/page",
      "/(auth)/entrar/page",
    ];
    expect(validateRoutes(orphan, slotDefault).unmatched).toEqual([
      "/(app)/@detalhe/relatorios/page",
    ]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar (o vermelho na árvore antiga, para o relatório da tarefa)**

Run: `bunx vitest run src/app/routeStructure.test.ts`
Expected: FAIL, `Tests  4 failed | 13 passed (17)`. As quatro falhas:
- `1. nenhuma página fica sem rota…`: `expected [ Array(4) ] to deeply equal []`, com `"/(auth)/convite/[token]/page"`,
  `"/(auth)/entrar/page"`, `"/(auth)/redefinir-senha/page"`, `"/privacidade/page"`;
- `2. /entrar, /convite/[token]…`: `/entrar: expected undefined to deeply equal [ '/(auth)/entrar/page' ]`;
- `cada segmento com página tem a página nula do slot…`: recebido `["/(app)/@detalhe/[...catchAll]/page"]` contra as nove;
- `não existem @detalhe/[...catchAll] nem (app)/default`: `expected [ …(22) ] to not include '/(app)/@detalhe/[...catchAll]/page'`.

Os grupos `listAppRouteFiles`, `validateRoutes` e `5. a causa…` já passam (são sintéticos). Copie o trecho da falha 1 para o
`task-1-report.md` (critério de pronto §15.1: "o relatório da tarefa mostra o vermelho na árvore antiga").

- [ ] **Step 3: Atualizar a lista fechada de páginas nulas**

Em `src/app/appPagesAuth.test.ts`, troque o bloco (linhas 61 a 68):

```ts
// Páginas de slot (rota paralela) que só devolvem null: não leem nada, então não
// há o que proteger. A lista é fechada de propósito: uma página nula que não
// esteja aqui continua precisando do portão, e o guarda reprova. Caminhos
// relativos a src/app/(app), com "/". Entra o slot @detalhe na Tarefa 12.
export const NULL_SLOT_PAGES: readonly string[] = [
  "@detalhe/page.tsx",
  "@detalhe/[...catchAll]/page.tsx",
];
```

por:

```ts
// Páginas de slot (rota paralela) que só devolvem null: não leem nada, então não
// há o que proteger. A lista é fechada de propósito: uma página nula que não
// esteja aqui continua precisando do portão, e o guarda reprova. Caminhos
// relativos a src/app/(app), com "/". O slot @detalhe tem a página da raiz e,
// desde o PR B, o espelho por segmento de (app) (library-docs.md §14): segmento
// novo entra aqui junto com o espelho dele (routeStructure.test.ts).
export const NULL_SLOT_PAGES: readonly string[] = [
  "@detalhe/page.tsx",
  "@detalhe/admin/page.tsx",
  "@detalhe/admin/[...rest]/page.tsx",
  "@detalhe/bem-vindo/page.tsx",
  "@detalhe/conta/page.tsx",
  "@detalhe/dashboard/page.tsx",
  "@detalhe/passagens/page.tsx",
  "@detalhe/passagens/[...rest]/page.tsx",
  "@detalhe/solicitacoes/page.tsx",
  "@detalhe/solicitacoes/[...rest]/page.tsx",
];
```

- [ ] **Step 4: Rodar e ver falhar**

Run: `bunx vitest run src/app/appPagesAuth.test.ts`
Expected: FAIL em dois testes:
- `a lista fechada de slots nulos: cada entrada é de um slot, existe e só devolve null`: `@detalhe/admin/page.tsx não existe`;
- `src/app/(app)/@detalhe/[...catchAll]/page.tsx`: `… não chama requireUser/requireAdmin … O layout não protege a página.`
  (fora da lista, a página nula volta a precisar do portão: o guarda funciona).

- [ ] **Step 5: Trocar o catch-all pelo espelho**

Apagar o catch-all (Bash, aspas por causa dos colchetes e parênteses):

```bash
rm "src/app/(app)/@detalhe/[...catchAll]/page.tsx" && rmdir "src/app/(app)/@detalhe/[...catchAll]"
```

Criar as nove páginas (ferramenta Write; ela cria as pastas). Cada uma exatamente como abaixo.

`src/app/(app)/@detalhe/admin/page.tsx`:

```tsx
// Espelho do segmento /admin no slot @detalhe: fecha o Sheet ao navegar para cá (library-docs.md §14).
export default function DetalheAdmin() {
  return null;
}
```

`src/app/(app)/@detalhe/admin/[...rest]/page.tsx`:

```tsx
// Espelho de /admin/* no slot @detalhe: fecha o Sheet ao navegar para cá (library-docs.md §14).
export default function DetalheAdminRest() {
  return null;
}
```

`src/app/(app)/@detalhe/bem-vindo/page.tsx`:

```tsx
// Espelho do segmento /bem-vindo no slot @detalhe: fecha o Sheet ao navegar para cá (library-docs.md §14).
export default function DetalheBemVindo() {
  return null;
}
```

`src/app/(app)/@detalhe/conta/page.tsx`:

```tsx
// Espelho do segmento /conta no slot @detalhe: fecha o Sheet ao navegar para cá (library-docs.md §14).
export default function DetalheConta() {
  return null;
}
```

`src/app/(app)/@detalhe/dashboard/page.tsx`:

```tsx
// Espelho do segmento /dashboard no slot @detalhe: fecha o Sheet ao navegar para cá (library-docs.md §14).
export default function DetalheDashboard() {
  return null;
}
```

`src/app/(app)/@detalhe/passagens/page.tsx`:

```tsx
// Espelho do segmento /passagens no slot @detalhe: fecha o Sheet ao navegar para cá (library-docs.md §14).
export default function DetalhePassagens() {
  return null;
}
```

`src/app/(app)/@detalhe/passagens/[...rest]/page.tsx`:

```tsx
// Espelho de /passagens/* no slot @detalhe: fecha o Sheet ao navegar para cá (library-docs.md §14).
export default function DetalhePassagensRest() {
  return null;
}
```

`src/app/(app)/@detalhe/solicitacoes/page.tsx`:

```tsx
// Espelho do segmento /solicitacoes no slot @detalhe: fecha o Sheet ao navegar para cá (library-docs.md §14).
export default function DetalheSolicitacoes() {
  return null;
}
```

`src/app/(app)/@detalhe/solicitacoes/[...rest]/page.tsx`:

```tsx
// Espelho de /solicitacoes/* no slot @detalhe: fecha o Sheet ao navegar para cá. A página completa
// /solicitacoes/[id] cai aqui; o clique no cartão continua pela interceptação (.)solicitacoes/[id].
export default function DetalheSolicitacoesRest() {
  return null;
}
```

Ficam como estão: `@detalhe/default.tsx`, `@detalhe/page.tsx` e `@detalhe/(.)solicitacoes/[id]/page.tsx`.

- [ ] **Step 6: Rodar e ver passar**

Run: `bunx vitest run src/app/routeStructure.test.ts src/app/appPagesAuth.test.ts`
Expected: PASS. `routeStructure.test.ts` com `Tests  17 passed (17)`; `appPagesAuth.test.ts` com `Tests  42 passed (42)`
(o mesmo número de antes: o `it.each` continua com as 16 páginas guardadas; as nulas têm a regra própria).

- [ ] **Step 7: O guarda do `pendencias.md` aceita o P81 resolvido (teste que falha)**

Em `test/pendenciasDoc.test.ts`, troque:

```ts
  it("Visual: P81 a P108 entraram como Aberto, não triado", () => {
    for (let number = 81; number <= 108; number++) {
      const id = `P${number}`;
      const entry = entries.get(id);
```

por:

```ts
  it("Visual: P81 a P108 entraram como Aberto, não triado (menos as que o PR B fechou)", () => {
    const closedByPrB = new Set(["P81"]);
    for (let number = 81; number <= 108; number++) {
      const id = `P${number}`;
      if (closedByPrB.has(id)) continue;
      const entry = entries.get(id);
```

E acrescente, depois do último `it` do arquivo ("Visual: P17 resolvida pelo tema próprio…"), antes do `});` final.
Edit com old_string = o fim do arquivo de hoje (único: só o caso do P17 usa `expect(entry?.updates, id)`):

```ts
      expect(entry?.updates, id).toContain("2026-11-27");
    }
  });
});
```

e new_string = as três primeiras dessas linhas, uma linha em branco, o caso abaixo e o `});` final:

```ts
  it("PR B: P81 resolvida pelo espelho do @detalhe; P44 continua aberta, com Atualização", () => {
    const p81 = entries.get("P81");
    expect(p81?.state, "P81").toBe("Resolvido");
    expect(p81?.section, "P81").toBe("5");
    expect(p81?.updates, "P81").toContain("2026-11-27");
    const p44 = entries.get("P44");
    expect(p44?.state, "P44").toBe("Aberto, não triado");
    expect(p44?.section, "P44").toBe("1");
    expect(p44?.updates, "P44").toContain("2026-11-27");
  });
```

- [ ] **Step 8: Rodar e ver falhar**

Run: `bunx vitest run test/pendenciasDoc.test.ts`
Expected: FAIL só em `PR B: P81 resolvida…`: `P81: expected 'Aberto, não triado' to be 'Resolvido'`.

- [ ] **Step 9: `pendencias.md`: P81 para "Resolvido", P44 com `Atualização`**

Três edições em `.context/pendencias.md` (ferramenta Edit; o arquivo tem acentos).

(a) Índice: troque

````markdown
| P81 | `next dev` dá 404 nas páginas fora do grupo (app) por causa do slot @detalhe | 🟡 | Aberto, não triado |
````

por

````markdown
| P81 | `next dev` dá 404 nas páginas fora do grupo (app) por causa do slot @detalhe | 🟡 | Resolvido |
````

(b) Seção 1: apague o bloco do P81 inteiro, com a linha em branco que o segue (old_string abaixo, new_string vazio):

````markdown
#### P81 — `next dev` dá 404 nas páginas fora do grupo (app) por causa do slot @detalhe 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/app/(app)/@detalhe/` · `src/app/(auth)/entrar` · `src/app/(auth)/convite` · `src/app/(auth)/redefinir-senha` · `src/app/privacidade`
**Impacto:** no `bun run dev` (Next 16.4.6, com strict route matching ligado por padrão), `/entrar`, `/convite/<token>`, `/redefinir-senha` e `/privacidade` dão 404 ou 500, com o aviso "page files do not match any complete route". São as páginas fora do grupo `(app)`, que tem o slot `@detalhe`. Quem usa o `dev` não consegue entrar no app. O defeito já existe na `main` (conferido numa worktree). O build de produção não tem o problema, e o E2E roda em `next start`, por isso nenhum teste pega.
**Correção:** — (o roteiro planeja a correção no PR B, de processo, antes da tela de Passagens: `.git/sdd/roadmap/roteiro.md` §2.1, fora do git; é a decisão T3 do lote 0. Se o dono recusar o PR B, fica aqui)
**Registrado em:** 2026-11-27

````

e cole-o no fim do arquivo (seção 5, depois do P17), com o `Estado` novo e a `Atualização`. Edit com old_string = a última
frase do P17:

````markdown
e o cenário do tema em `e2e/inicio.spec.ts` (escuro por padrão, a troca e a escolha depois de recarregar).
````

e new_string:

````markdown
e o cenário do tema em `e2e/inicio.spec.ts` (escuro por padrão, a troca e a escolha depois de recarregar).

#### P81 — `next dev` dá 404 nas páginas fora do grupo (app) por causa do slot @detalhe 🟡
**Estado:** Resolvido
**Arquivos:** `src/app/(app)/@detalhe/` · `src/app/(auth)/entrar` · `src/app/(auth)/convite` · `src/app/(auth)/redefinir-senha` · `src/app/privacidade`
**Impacto:** no `bun run dev` (Next 16.4.6, com strict route matching ligado por padrão), `/entrar`, `/convite/<token>`, `/redefinir-senha` e `/privacidade` dão 404 ou 500, com o aviso "page files do not match any complete route". São as páginas fora do grupo `(app)`, que tem o slot `@detalhe`. Quem usa o `dev` não consegue entrar no app. O defeito já existe na `main` (conferido numa worktree). O build de produção não tem o problema, e o E2E roda em `next start`, por isso nenhum teste pega.
**Correção:** — (o roteiro planeja a correção no PR B, de processo, antes da tela de Passagens: `.git/sdd/roadmap/roteiro.md` §2.1, fora do git; é a decisão T3 do lote 0. Se o dono recusar o PR B, fica aqui)
**Registrado em:** 2026-11-27
**Atualização (2026-11-27):** resolvida no PR B (`chore/processo-visual`, spec `docs/superpowers/specs/2026-11-27-processo-visual-design.md` §4). Causa: a validação estrita do 16.4 (`normalizeCatchAllRoutes`, que o `next dev` chama) pendurava o `@detalhe/[...catchAll]` (normalizado para `/[...catchAll]`) em toda rota, inclusive nas de fora de `(app)`, e apagava a rota inteira, porque o `children` de `(app)` não tinha página nem `default` nelas. Correção: o catch-all saiu e o slot virou um espelho por segmento de `(app)`, com nove páginas nulas (`admin`, `admin/[...rest]`, `bem-vindo`, `conta`, `dashboard`, `passagens`, `passagens/[...rest]`, `solicitacoes`, `solicitacoes/[...rest]`); `(app)/default.tsx` e `deprecated.looseRouteMatching` foram recusados (`library-docs.md §1` e `§14`). Guarda: `src/app/routeStructure.test.ts` roda o validador do próprio Next sobre a árvore real (vermelho com a árvore antiga: as quatro páginas sem rota) e documenta a causa numa árvore sintética. Na produção nada muda: o Sheet do detalhe continua fechando ao navegar, agora pelo espelho do segmento.
````

(c) P44: Edit com old_string

````markdown
**Correção:** — (opção: conferir na Vercel, na Fase 6, que o `Vary: next-url` passa; se não passar, aceitar a página completa como fallback)
**Registrado em:** 2026-11-24
````

e new_string

````markdown
**Correção:** — (opção: conferir na Vercel, na Fase 6, que o `Vary: next-url` passa; se não passar, aceitar a página completa como fallback)
**Registrado em:** 2026-11-24
**Atualização (2026-11-27):** o PR B trocou o `@detalhe/[...catchAll]` pelo espelho por segmento (P81, `library-docs.md §14`). A interceptação `(.)solicitacoes/[id]` não mudou e continua dependendo do cabeçalho `next-url`: a pendência segue aberta.
````

O "Próximo id livre" não muda (P109).

- [ ] **Step 10: `library-docs.md`: §1, §9, §10 e §14**

Quatro edições em `.context/library-docs.md` (ferramenta Edit).

(§1) old_string:

````markdown
  `test/vercelConfig.test.ts` amarra `vercel.json`, `engines` e o Node do CI.
````

new_string:

````markdown
  `test/vercelConfig.test.ts` amarra `vercel.json`, `engines` e o Node do CI.
- **Rotas paralelas sob validação estrita (PR B, P81).** O 16.4 liga `experimental.strictRouteMatching` por padrão: o
  `next dev` monta as rotas a partir de `normalizeCatchAllRoutes` e apaga a rota **inteira** quando um slot irmão não tem
  página que case nem `default`. Um catch-all na raiz de um slot (`@detalhe/[...catchAll]`, que normaliza para
  `/[...catchAll]`) é pendurado em **toda** rota, inclusive nas de fora do grupo: derrubava `/entrar`, `/convite/[token]`,
  `/redefinir-senha` e `/privacidade` no dev (o build de produção servia as quatro). Por isso o slot `@detalhe` é um
  **espelho por segmento** de `(app)` (§14): **segmento novo de primeiro nível em `(app)` ganha
  `@detalhe/<segmento>/page.tsx` nula e, se tiver subrotas, `@detalhe/<segmento>/[...rest]/page.tsx`**, no mesmo commit.
  Proibidos: `(app)/default.tsx` (cria a rota `/[...catchAll]`: toda URL desconhecida renderiza o shell em vez do 404) e
  `deprecated.looseRouteMatching` (esconde o defeito). O guarda `src/app/routeStructure.test.ts` roda o validador interno
  sobre a árvore real; os caminhos são fixos da 16.4.6 (`next/dist/server/lib/router-utils/normalize-catchall-routes` e
  `next/dist/shared/lib/router/utils/app-paths`): se uma atualização do Next os mover, o import quebra com mensagem clara e
  a correção é atualizar o caminho.
````

(§9) old_string:

````markdown
Na Fase 4 o `appPagesAuth.test.ts` ganhou a lista fechada `NULL_SLOT_PAGES` (páginas do slot `@detalhe` que só devolvem `null`) e o harness dos testes de migração é `test/migrations.ts`.
````

new_string:

````markdown
Na Fase 4 o `appPagesAuth.test.ts` ganhou a lista fechada `NULL_SLOT_PAGES` (páginas do slot `@detalhe` que só devolvem `null`: desde o PR B, `@detalhe/page.tsx` e as nove do espelho por segmento, §14) e o harness dos testes de migração é `test/migrations.ts`. No PR B entrou `src/app/routeStructure.test.ts`, que roda o validador de rotas do próprio Next sobre a árvore real de `src/app` (§1).
````

(§10) old_string:

````markdown
  logado responde 404 com "Página não encontrada": o `[...catchAll]` do slot não engole URL desconhecida.
````

new_string:

````markdown
  logado responde 404 com "Página não encontrada": o espelho do slot (§14) não cria rota para URL desconhecida (nenhuma
  rota começa com `/[...`; `routeStructure.test.ts`).
````

(§14) old_string (a linha inteira do bullet):

````markdown
- **Detalhe rápido = rota interceptada.** O slot `@detalhe` do layout de `(app)` tem `@detalhe/(.)solicitacoes/[id]/page.tsx` (um `Sheet` com o `RequestDetail`) e três arquivos que só devolvem `null`: `default.tsx`, `page.tsx` (rota `/`) e `[...catchAll]/page.tsx`. As duas páginas nulas são **obrigatórias**: numa navegação no cliente o slot mantém a última página ativa e o Sheet ficaria aberto sobre a próxima tela. **Não** existe `(app)/default.tsx` (com ele uma URL desconhecida viraria página em branco em vez do 404). `(.)` conta segmentos de rota, não `@slot` nem grupo. O layout usa `LayoutProps<"/">`, que já tipa `detalhe`. Páginas do slot não exportam `metadata`; as de `/solicitacoes` exportam `metadata` estático.
````

new_string:

````markdown
- **Detalhe rápido = rota interceptada.** O slot `@detalhe` do layout de `(app)` tem `@detalhe/(.)solicitacoes/[id]/page.tsx` (um `Sheet` com o `RequestDetail`), `default.tsx` e `page.tsx` (rota `/`) e, desde o PR B, o **espelho por segmento**: uma página nula por segmento de primeiro nível de `(app)` (`admin`, `bem-vindo`, `conta`, `dashboard`, `passagens`, `solicitacoes`) e um `[...rest]/page.tsx` nulo em cada segmento com subrotas (`admin`, `passagens`, `solicitacoes`). Tudo que não é a interceptada só devolve `null`. As páginas nulas são **obrigatórias**: numa navegação no cliente o slot mantém a última página ativa e o Sheet ficaria aberto sobre a próxima tela. **Segmento novo em `(app)` ganha o espelho no mesmo commit** (o `routeStructure.test.ts` reprova o esquecimento; a página nula entra no `NULL_SLOT_PAGES`). Nada de catch-all na raiz do slot: a validação estrita o pendurava nas rotas de fora de `(app)` e o `next dev` dava 404 nelas (§1, P81). **Não** existe `(app)/default.tsx` (com ele uma URL desconhecida viraria página em branco em vez do 404). `(.)` conta segmentos de rota, não `@slot` nem grupo. O layout usa `LayoutProps<"/">`, que já tipa `detalhe`. Páginas do slot não exportam `metadata`; as de `/solicitacoes` exportam `metadata` estático.
````

- [ ] **Step 11: Rodar e ver passar; nenhuma frase velha sobrando**

Run: `bunx vitest run test/pendenciasDoc.test.ts`
Expected: PASS, `Tests  20 passed (20)`.

Run: `grep -n "\[\.\.\.catchAll\]" .context/library-docs.md`
Expected: só as duas menções do bullet novo do §1, que explicam por que o catch-all saiu (o §9, o §10 e o §14 não o citam
mais).

Run: `grep -rn "catchAll" src test e2e`
Expected: só `src/app/routeStructure.test.ts` (os casos sintéticos e a afirmação de que não existe).

- [ ] **Step 12: Portão da tarefa**

Run: `bunx biome check --write src/app/routeStructure.test.ts src/app/appPagesAuth.test.ts test/pendenciasDoc.test.ts "src/app/(app)/@detalhe"`
Expected: sem erro (só formata, se precisar).

Run: `bun run check-types`
Expected: sai com 0 (o `next typegen` gera os tipos das rotas novas do slot).

Run: `bun run lint`
Expected: `Checked N files … No fixes applied.` e código 0.

Run: `bunx vitest run src/app/routeStructure.test.ts src/app/appPagesAuth.test.ts test/pendenciasDoc.test.ts "src/app/(app)/layout.test.tsx" "src/app/(app)/@detalhe/(.)solicitacoes/[id]/page.test.tsx"`
Expected: PASS nos cinco arquivos (o layout e a interceptada não mudam; ficam como prova).

- [ ] **Step 13: Commit**

Mensagem gravada com Write em `.git/sdd/processo/msg-task-1.txt`:

```text
fix(rotas): espelho do slot @detalhe por segmento (404 do next dev)

O catch-all na raiz do slot @detalhe era pendurado pela validação estrita
do Next 16.4 em toda rota, inclusive /entrar, /convite/[token],
/redefinir-senha e /privacidade, e a poda apagava essas rotas no next dev
(P81). O slot vira um espelho por segmento de (app): nove páginas nulas no
lugar do [...catchAll]. routeStructure.test.ts roda o validador do próprio
Next sobre a árvore real e documenta a causa numa árvore sintética.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run: `git add "src/app/(app)/@detalhe" src/app/routeStructure.test.ts src/app/appPagesAuth.test.ts test/pendenciasDoc.test.ts .context/pendencias.md .context/library-docs.md && git status --short && git commit -F .git/sdd/processo/msg-task-1.txt`
Expected no `git status --short` (antes do commit): `D  src/app/(app)/@detalhe/[...catchAll]/page.tsx`, os nove `A  src/app/(app)/@detalhe/…/page.tsx`,
`A  src/app/routeStructure.test.ts` e `M ` nos outros quatro; nada fora disso.

- [ ] **Step 14: Conferência manual pelo controlador no C1 (não rodar na redação nem na tarefa)**

É o **Step 1 do C1**, com os mesmos comandos (o texto canônico mora lá). Precisa do ambiente visual da T5 (porta 3202;
nunca a 3000). Com o banco visual de pé (`bun run visual:db > .git/sdd/processo/db.log 2>&1`, em segundo plano), em
segundo plano:

```bash
. scripts/visual/env.sh && bun run fonts && bunx next dev -p 3202 > .git/sdd/processo/dev.log 2>&1
```

Depois que o log mostrar `Ready`:

```bash
for p in /entrar /redefinir-senha /privacidade /convite/token-de-teste /nao-existe; do curl -s -o /dev/null --max-time 180 -w "%{http_code} $p\n" "http://localhost:3202$p"; done
grep -c "do not match any complete route" .git/sdd/processo/dev.log
```

Expected: `200 /entrar`, `200 /redefinir-senha`, `200 /privacidade`, `200 /convite/token-de-teste` (a página existe e mostra
"convite não encontrado"), `307 /nao-existe` (o `proxy.ts` manda o anônimo para `/entrar`, como hoje) e o `grep` com `0`.
Derrubar o servidor pelo PID: `netstat -ano | grep -E ':3202\s' | grep LISTEN` e `taskkill //F //T //PID <pid>`.

---

### Task 2: Guarda de hidratação nas páginas principais

**Spec:** §8 · **Redator:** R1 · **Depende de:** —

**Files:**
- Create: `test/hydrationCheck.ts`
- Create: `e2e/hydration.spec.ts`
- Modify: `.context/library-docs.md` (§10: bullet novo do `hydration.spec.ts`)
- Test: `test/hydrationCheck.test.ts` (node), `e2e/hydration.spec.ts` (Playwright, só no portão)

Testes existentes que mudam: nenhum (`grep -rln "hydrationCheck\|snapshotDom" src test e2e` → nada antes desta tarefa).

**Interfaces:**
- Consumes: `e2e/helpers.ts` (`test` com `clientIp`, `seedSector`, `signUpAdmin`, `signUpOperator`); `e2e/db.ts`
  (`openE2eDb`, `insertInvite`, `buildInviteUrl`, `E2E_BASE_URL`).
- Produces (`test/hydrationCheck.ts`):
  ```ts
  export type DomSnapshot = { mains: number; h1PerMain: number[]; ids: string[]; refs: string[] };
  export const CLIENT_ID_PATTERN: RegExp; // /_r_[0-9a-z]*_/
  export function snapshotDom(): DomSnapshot; // roda na página: nada de fora da função
  export function hydrationProblems(snapshot: DomSnapshot, expectedH1: number, consoleErrors: readonly string[]): string[];
  ```

O `h1` de cada página foi conferido lendo o código: `/entrar` (`SignInPanel`), `/redefinir-senha` (`ResetPasswordForm`) e
`/convite/[token]` (`page.tsx`) têm o título num `CardTitle role="heading" aria-level={1}` (um `div`): **0** `<h1>`, dentro
do `<main>` do layout de `(auth)`. `/privacidade` tem o próprio `<main>` com **1** `<h1>`. Em `(app)` o `<main>` é o
`SidebarInset`, e cada tela tem **1** `<h1>`: `Greeting` (`/`), `HandoverHistory` (`/passagens`), o `Header` do
`RequestsScreen` (`/solicitacoes`), o `Header` do `DashboardScreen` (`/dashboard`), `conta/page.tsx`, `AdminOverview`
(`/admin`) e o `AdminPageHeader` do `TeamAdmin` (`/admin/equipe`). `AppHeader` e a sidebar não têm `<h1>`.

- [ ] **Step 1: Escrever o teste do verificador (o teste que falha)**

Arquivo novo `test/hydrationCheck.test.ts`:

```ts
import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";

import {
  CLIENT_ID_PATTERN,
  type DomSnapshot,
  hydrationProblems,
  snapshotDom,
} from "./hydrationCheck";

// O verificador do e2e/hydration.spec.ts com instantâneos sintéticos (sem
// navegador): limpo, duplicado, `_r_`, dois h1 e o console.

function snapshot(overrides: Partial<DomSnapshot> = {}): DomSnapshot {
  return {
    mains: 1,
    h1PerMain: [1],
    ids: ["_R_1a_-senha", "privacidade-onde"],
    refs: ["_R_1a_-senha"],
    ...overrides,
  };
}

describe("hydrationProblems", () => {
  it("página limpa, hidratada no servidor: nenhum problema", () => {
    expect(hydrationProblems(snapshot(), 1, [])).toEqual([]);
  });

  it("tela de auth: um <main> e nenhum <h1> esperado (o título é o CardTitle)", () => {
    expect(hydrationProblems(snapshot({ h1PerMain: [0] }), 0, [])).toEqual([]);
  });

  it("vazio: sem ids, sem referências e sem erros não é problema", () => {
    expect(hydrationProblems(snapshot({ ids: [], refs: [] }), 1, [])).toEqual(
      [],
    );
  });

  it("dois <main>: conteúdo duplicado", () => {
    expect(
      hydrationProblems(snapshot({ mains: 2, h1PerMain: [1, 1] }), 1, []),
    ).toEqual(["2 elementos <main> (esperado 1): conteúdo duplicado"]);
  });

  it("nenhum <main>: o h1 não teria onde ser contado", () => {
    expect(
      hydrationProblems(snapshot({ mains: 0, h1PerMain: [] }), 1, []),
    ).toEqual(["nenhum <main> na página"]);
  });

  it("dois <h1> no mesmo <main>, e zero quando se espera um", () => {
    expect(hydrationProblems(snapshot({ h1PerMain: [2] }), 1, [])).toEqual([
      "<main> 1 com 2 <h1> (esperado 1)",
    ]);
    expect(hydrationProblems(snapshot({ h1PerMain: [0] }), 1, [])).toEqual([
      "<main> 1 com 0 <h1> (esperado 1)",
    ]);
  });

  it("id repetido aparece uma vez, com a contagem", () => {
    expect(
      hydrationProblems(snapshot({ ids: ["a", "b", "a", "a"] }), 1, []),
    ).toEqual(["id repetido 3 vezes: a"]);
  });

  it("id e referência no formato do cliente (_r_…_), inclusive dentro de id composto", () => {
    expect(
      hydrationProblems(
        snapshot({
          ids: ["_r_3_-senha", "base-ui-_r_5_"],
          refs: ["_r_3_-senha"],
        }),
        1,
        [],
      ),
    ).toEqual([
      "id gerado no cliente: _r_3_-senha",
      "id gerado no cliente: base-ui-_r_5_",
      "referência a id gerado no cliente: _r_3_-senha",
    ]);
  });

  it("mensagem de hidratação no console: texto do dev, sem caixa", () => {
    const problems = hydrationProblems(snapshot(), 1, [
      "Uncaught Error: Hydration failed because the server rendered HTML didn't match the client.",
      "HYDRATION MISMATCH",
      "The server could not finish this Suspense boundary. Switched to client rendering.",
    ]);
    expect(problems).toHaveLength(3);
    expect(problems[0]).toMatch(
      /^hidratação no console: Uncaught Error: Hydration failed/,
    );
  });

  it.each([
    "418",
    "419",
    "422",
    "423",
    "424",
  ])("erro minificado da produção (#%s) conta como hidratação", (code) => {
    const message = `Error: Minified React error #${code}; visit https://react.dev/errors/${code}?args[]=HTML&args[]= for the full message`;
    expect(hydrationProblems(snapshot(), 1, [message])).toHaveLength(1);
  });

  it("outros erros não contam (404 de recurso, outro código do React, código mais longo)", () => {
    expect(
      hydrationProblems(snapshot(), 1, [
        "Failed to load resource: the server responded with a status of 404 ()",
        "Error: Minified React error #185; visit https://react.dev/errors/185",
        "Error: visit https://react.dev/errors/4180",
      ]),
    ).toEqual([]);
  });

  it("mensagem longa sai cortada em 200 caracteres", () => {
    const [problem] = hydrationProblems(snapshot(), 1, [
      `Hydration ${"x".repeat(500)}`,
    ]);
    expect(problem).toHaveLength("hidratação no console: ".length + 200);
  });

  it("junta todos os problemas de uma vez", () => {
    expect(
      hydrationProblems(
        { mains: 2, h1PerMain: [1, 0], ids: ["_r_1_", "_r_1_"], refs: [] },
        1,
        ["Hydration failed"],
      ),
    ).toHaveLength(5);
  });

  it.each([-1, 1.5, Number.NaN])("expectedH1 inválido (%s) lança", (value) => {
    expect(() => hydrationProblems(snapshot(), value, [])).toThrow(
      "expectedH1 inválido",
    );
  });
});

describe("CLIENT_ID_PATTERN", () => {
  it.each([
    "_r_0_",
    "_r_1a_",
    "base-ui-_r_5_",
    "_r_3_-senha",
    "_r__",
  ])("%s é do cliente", (id) => {
    expect(CLIENT_ID_PATTERN.test(id)).toBe(true);
  });

  it.each([
    "_R_0_",
    "_R_1aH2_",
    "_R_r_",
    "_R_1r_-senha",
    "privacidade-onde",
    "r_1_",
    "",
  ])("%s não é do cliente", (id) => {
    expect(CLIENT_ID_PATTERN.test(id)).toBe(false);
  });
});

describe("snapshotDom (roda na página: nada de fora da função)", () => {
  type FakeElement = {
    id?: string;
    attrs?: Record<string, string>;
    h1?: number;
  };

  function fakeDocument(parts: {
    mains: FakeElement[];
    withId: FakeElement[];
    referrers: FakeElement[];
  }) {
    const element = (fake: FakeElement) => ({
      id: fake.id ?? "",
      getAttribute: (name: string) => fake.attrs?.[name] ?? null,
      querySelectorAll: (selector: string) =>
        selector === "h1" ? Array.from({ length: fake.h1 ?? 0 }) : [],
    });
    return {
      querySelectorAll: (selector: string) => {
        if (selector === "main") return parts.mains.map(element);
        if (selector === "[id]") return parts.withId.map(element);
        return parts.referrers.map(element);
      },
    };
  }

  // Num contexto novo do `vm` só existe o `document` falso: se a função usasse
  // algo do módulo (uma constante, um import), daria ReferenceError aqui, como
  // daria no navegador.
  function runIsolated(document: unknown): DomSnapshot {
    const result = runInNewContext(`(${snapshotDom.toString()})()`, {
      document,
    });
    return JSON.parse(JSON.stringify(result)) as DomSnapshot;
  }

  it("conta os <main>, os <h1> de cada um, os ids e as referências", () => {
    const document = fakeDocument({
      mains: [{ h1: 1 }],
      withId: [{ id: "_R_1_-email" }, { id: "" }, { id: "secao" }],
      referrers: [
        { attrs: { for: "_R_1_-email" } },
        { attrs: { "aria-describedby": "_R_1_-ajuda  _R_1_-erro" } },
        { attrs: { "aria-labelledby": "secao", "aria-controls": "menu" } },
      ],
    });
    expect(runIsolated(document)).toEqual({
      mains: 1,
      h1PerMain: [1],
      ids: ["_R_1_-email", "secao"],
      refs: ["_R_1_-email", "_R_1_-ajuda", "_R_1_-erro", "secao", "menu"],
    });
  });

  it("página sem nada: zeros e listas vazias", () => {
    expect(
      runIsolated(fakeDocument({ mains: [], withId: [], referrers: [] })),
    ).toEqual({ mains: 0, h1PerMain: [], ids: [], refs: [] });
  });

  it("dois <main> com h1 diferentes", () => {
    const document = fakeDocument({
      mains: [{ h1: 1 }, { h1: 2 }],
      withId: [],
      referrers: [],
    });
    expect(runIsolated(document).h1PerMain).toEqual([1, 2]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bunx vitest run test/hydrationCheck.test.ts`
Expected: FAIL com `Error: Cannot find module './hydrationCheck' imported from …/test/hydrationCheck.test.ts`.

- [ ] **Step 3: Implementar o verificador**

Arquivo novo `test/hydrationCheck.ts`:

```ts
// Verificador puro da hidratação (PR B, spec §8), usado pelo e2e/hydration.spec.ts.
//
// O PR A perdeu horas com conteúdo duplicado: um <script> num componente client acima
// dos <Suspense> fazia o React refazer a página no cliente, com o console vazio. O que
// denunciou foram os ids de `useId`: `_R_…_` (do servidor, que a hidratação preserva)
// contra `_r_…_` (gerados no cliente). `snapshotDom` roda na página; `hydrationProblems`
// é puro e testado em test/hydrationCheck.test.ts.

export type DomSnapshot = {
  mains: number;
  h1PerMain: number[];
  ids: string[];
  refs: string[];
};

/** Id de `useId` gerado no cliente (`_r_…_`; o do servidor é `_R_…_`). Casa dentro de ids compostos (`base-ui-_r_5_`). */
export const CLIENT_ID_PATTERN = /_r_[0-9a-z]*_/;

/**
 * Mensagem de hidratação no console ou num erro da página. No dev o React escreve o texto
 * ("Hydration failed…", "Switched to client rendering"); na produção (o `next start` do E2E) o
 * erro sai minificado, com o código: 418 (HTML diferente), 419 (o servidor não terminou o
 * Suspense), 422 e 423 (erro ao hidratar, refeito no cliente) e 424 (a raiz refeita no cliente).
 */
const HYDRATION_MESSAGE =
  /hydrat|switched to client rendering|react\.dev\/errors\/(?:418|419|422|423|424)(?!\d)/i;

/**
 * O instantâneo do DOM. Roda dentro da página (`page.evaluate(snapshotDom)`): o Playwright manda o
 * texto da função, então ela não pode usar nada de fora dela (nem import, nem constante do módulo).
 */
export function snapshotDom(): DomSnapshot {
  const mains = Array.from(document.querySelectorAll("main"));
  const ids = Array.from(document.querySelectorAll("[id]"))
    .map((element) => element.id)
    .filter((id) => id !== "");
  const refs: string[] = [];
  const names = ["for", "aria-labelledby", "aria-describedby", "aria-controls"];
  const referrers = document.querySelectorAll(
    "[for], [aria-labelledby], [aria-describedby], [aria-controls]",
  );
  for (const element of Array.from(referrers)) {
    for (const name of names) {
      const value = element.getAttribute(name);
      if (value) refs.push(...value.split(/\s+/).filter(Boolean));
    }
  }
  return {
    mains: mains.length,
    h1PerMain: mains.map((main) => main.querySelectorAll("h1").length),
    ids,
    refs,
  };
}

/**
 * Os problemas de hidratação do instantâneo (vazio = ok): nenhum ou mais de um `<main>`, número de
 * `<h1>` por `<main>` diferente do esperado, id repetido, id ou referência no formato do cliente e
 * mensagem de hidratação entre os erros da página. Lança se `expectedH1` não for inteiro ≥ 0.
 */
export function hydrationProblems(
  snapshot: DomSnapshot,
  expectedH1: number,
  consoleErrors: readonly string[],
): string[] {
  if (!Number.isInteger(expectedH1) || expectedH1 < 0) {
    throw new Error(`expectedH1 inválido: ${expectedH1}`);
  }
  const problems: string[] = [];
  if (snapshot.mains === 0) problems.push("nenhum <main> na página");
  if (snapshot.mains > 1) {
    problems.push(
      `${snapshot.mains} elementos <main> (esperado 1): conteúdo duplicado`,
    );
  }
  for (const [index, count] of snapshot.h1PerMain.entries()) {
    if (count !== expectedH1) {
      problems.push(
        `<main> ${index + 1} com ${count} <h1> (esperado ${expectedH1})`,
      );
    }
  }
  const seen = new Map<string, number>();
  for (const id of snapshot.ids) seen.set(id, (seen.get(id) ?? 0) + 1);
  for (const [id, count] of seen) {
    if (count > 1) problems.push(`id repetido ${count} vezes: ${id}`);
    if (CLIENT_ID_PATTERN.test(id)) problems.push(`id gerado no cliente: ${id}`);
  }
  for (const ref of new Set(snapshot.refs)) {
    if (CLIENT_ID_PATTERN.test(ref)) {
      problems.push(`referência a id gerado no cliente: ${ref}`);
    }
  }
  for (const message of consoleErrors) {
    if (HYDRATION_MESSAGE.test(message)) {
      problems.push(`hidratação no console: ${message.slice(0, 200)}`);
    }
  }
  return problems;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bunx vitest run test/hydrationCheck.test.ts`
Expected: PASS, `Tests  35 passed (35)`.

- [ ] **Step 5: Escrever o spec do E2E**

Arquivo novo `e2e/hydration.spec.ts`:

```ts
import { type ConsoleMessage, expect, type Page } from "@playwright/test";
import type { Pool } from "pg";

import type { Db } from "@/db/types";

import {
  CLIENT_ID_PATTERN,
  type DomSnapshot,
  hydrationProblems,
  snapshotDom,
} from "../test/hydrationCheck";
import { buildInviteUrl, E2E_BASE_URL, insertInvite, openE2eDb } from "./db";
import { seedSector, signUpAdmin, signUpOperator, test } from "./helpers";

// Guarda de hidratação (PR B, spec §8). O PR A perdeu horas com conteúdo
// duplicado: um <script> num componente client acima dos <Suspense> fazia o
// React refazer a página no cliente, com o console vazio. O que denunciou foram
// os ids de useId: `_R_…_` (servidor, hidratado) contra `_r_…_` (cliente).
// Cada página abre com page.goto (documento novo: depois de uma navegação no
// cliente a Activity deixa a página anterior escondida no DOM) e é conferida
// antes de qualquer interação. O h1 esperado foi conferido lendo cada página:
// nas de auth o título é um CardTitle com role="heading" (0 <h1>).

type PageCheck = { label: string; url: string; h1: number };

/**
 * Ids `_r_…_` legítimos: componente que só existe no cliente, montado depois da
 * hidratação de propósito. Lista fechada por página (o `label` da tabela), com
 * o seletor do elemento e o motivo; nunca um filtro genérico. Uma entrada cujo
 * seletor não acha mais um id do cliente reprova. Vazia hoje.
 */
const CLIENT_ONLY_IDS: Record<
  string,
  readonly { selector: string; reason: string }[]
> = {};

let pool: Pool;
let db: Db;

test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});

test.afterAll(async () => {
  await pool.end();
});

async function clientOnlyIds(page: Page, label: string): Promise<string[]> {
  const ids: string[] = [];
  for (const { selector, reason } of CLIENT_ONLY_IDS[label] ?? []) {
    const id = (await page.locator(selector).getAttribute("id")) ?? "";
    expect(
      CLIENT_ID_PATTERN.test(id),
      `${label}: a exceção "${reason}" (${selector}) não acha mais um id do cliente; tire-a da lista`,
    ).toBe(true);
    ids.push(id);
  }
  return ids;
}

function withoutIds(
  snapshot: DomSnapshot,
  allowed: readonly string[],
): DomSnapshot {
  if (allowed.length === 0) return snapshot;
  const keep = (value: string) => !allowed.includes(value);
  return {
    ...snapshot,
    ids: snapshot.ids.filter(keep),
    refs: snapshot.refs.filter(keep),
  };
}

// Abre cada página, espera o título e a rede parar e confere o instantâneo.
// `expect.soft`: o relatório lista os problemas de todas as páginas de uma vez.
async function expectHydrated(page: Page, checks: readonly PageCheck[]) {
  const errors: string[] = [];
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === "error") errors.push(message.text());
  };
  // Na produção o Next manda o erro recuperável de hidratação ao reportError:
  // ele chega como pageerror, não como console.error.
  const onPageError = (error: Error) => {
    errors.push(`${error.name}: ${error.message}`);
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  try {
    for (const { label, url, h1 } of checks) {
      errors.length = 0;
      await page.goto(url);
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
        label,
      ).toBeVisible();
      await page.waitForLoadState("networkidle");
      const snapshot = withoutIds(
        await page.evaluate(snapshotDom),
        await clientOnlyIds(page, label),
      );
      expect.soft(hydrationProblems(snapshot, h1, errors), label).toEqual([]);
    }
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  }
}

test("(a) sem sessão: entrada, redefinição, convite e privacidade", async ({
  page,
}) => {
  const { token } = await insertInvite(db, { role: "admin" });
  // A ordem importa: dois goto seguidos que só mudam o fragmento (#token=…) não
  // recarregam a página, então as duas visitas da redefinição ficam separadas.
  await expectHydrated(page, [
    { label: "/redefinir-senha", url: "/redefinir-senha", h1: 0 },
    { label: "/entrar", url: "/entrar", h1: 0 },
    // Com um token no fragmento a página mostra o formulário (o único estado
    // dela com ids de useId). O token só é conferido no envio, que não acontece.
    {
      label: "/redefinir-senha#token",
      url: "/redefinir-senha#token=token-de-teste-0123456789",
      h1: 0,
    },
    {
      label: "/convite/<token>",
      url: buildInviteUrl(E2E_BASE_URL, token),
      h1: 0,
    },
    { label: "/privacidade", url: "/privacidade", h1: 1 },
  ]);
});

test("(b) admin: Início, Passagens, Solicitações, Dashboard, Conta e Administração", async ({
  page,
}) => {
  // Um cadastro e sete páginas: com a máquina carregada os 30 s padrão não bastam.
  test.slow();
  await signUpAdmin(page, db, "Ana Teste");
  await expectHydrated(page, [
    { label: "/", url: "/", h1: 1 },
    { label: "/passagens", url: "/passagens", h1: 1 },
    // Sem `visao` a tela renderiza o Quadro e a Lista (uma escondida): ids
    // repetidos de propósito. A guarda olha uma visão só.
    {
      label: "/solicitacoes?visao=lista",
      url: "/solicitacoes?visao=lista",
      h1: 1,
    },
    { label: "/dashboard", url: "/dashboard", h1: 1 },
    { label: "/conta", url: "/conta", h1: 1 },
    { label: "/admin", url: "/admin", h1: 1 },
    { label: "/admin/equipe", url: "/admin/equipe", h1: 1 },
  ]);
});

test("(c) operador: Início e Passagens", async ({ page }) => {
  const world = await seedSector(db);
  await signUpOperator(page, db, world.sector.id, "Bruno Teste");
  await expectHydrated(page, [
    { label: "/", url: "/", h1: 1 },
    { label: "/passagens", url: "/passagens", h1: 1 },
  ]);
});
```

- [ ] **Step 6: `library-docs.md §10`: o guarda novo**

Edit em `.context/library-docs.md`, old_string:

````markdown
  diálogo `Link de nova senha`. Tela nova entra na lista do spec.
- Duração: cerca de 1 min com o cache do Turbopack; 3 a 4 min na primeira vez.
````

new_string:

````markdown
  diálogo `Link de nova senha`. Tela nova entra na lista do spec.
- **`e2e/hydration.spec.ts` (PR B, guarda de hidratação).** No `next start`, antes de qualquer interação: cada página abre
  com `page.goto` (documento novo: depois de uma navegação no cliente a `Activity` deixa a página anterior escondida no
  DOM, e tudo pareceria duplicado), espera o título de nível 1 e o `networkidle`, tira o instantâneo com `snapshotDom` e
  reprova pelo `hydrationProblems` (os dois em `test/hydrationCheck.ts`, testados em `test/hydrationCheck.test.ts`):
  nenhum ou mais de um `main`, número de `h1` por `main` diferente do esperado, id repetido, id ou referência (`for`,
  `aria-labelledby`, `aria-describedby`, `aria-controls`) no formato do cliente (`_r_…_`; o do servidor é `_R_…_`) e erro
  de hidratação. `snapshotDom` vai como texto para o navegador: não pode usar nada de fora da função. Na produção o
  React 19 minifica o erro, e o Next o manda ao `reportError`: ele chega como `pageerror` com `react.dev/errors/418` (ou
  419, 422, 423, 424), não como `console.error` com "hydrat"; o spec escuta os dois e o verificador casa os dois. Nas
  telas de auth o título é o `CardTitle` com `role="heading"` (0 `h1`). Componente que só existe no cliente de propósito
  e gera `_r_` entra na lista fechada `CLIENT_ONLY_IDS` do spec (página, seletor, motivo), nunca num filtro genérico.
  Página principal nova entra na tabela do spec, com o `h1` conferido no código.
- Duração: cerca de 1 min com o cache do Turbopack; 3 a 4 min na primeira vez.
````

- [ ] **Step 7: Portão da tarefa**

Run: `bunx biome check --write test/hydrationCheck.ts test/hydrationCheck.test.ts e2e/hydration.spec.ts`
Expected: sem erro (formata e ordena os imports, se precisar).

Run: `bun run check-types`
Expected: sai com 0 (o `tsc` também confere o `e2e/hydration.spec.ts`: os tipos do `page.evaluate(snapshotDom)` e do
`ConsoleMessage`).

Run: `bun run lint`
Expected: código 0.

Run: `bunx vitest run test/hydrationCheck.test.ts`
Expected: PASS, `Tests  35 passed (35)`.

- [ ] **Step 8: Commit**

Mensagem gravada com Write em `.git/sdd/processo/msg-task-2.txt`:

```text
test(e2e): guarda de hidratação nas páginas principais

hydrationProblems (puro) reprova main duplicado ou ausente, h1 fora do
esperado, id repetido, id de useId gerado no cliente (_r_) e erro de
hidratação, inclusive os minificados da produção (#418, #419, #422 a
#424). e2e/hydration.spec.ts confere as páginas sem sessão, as do admin e
as do operador no next start, antes de qualquer interação.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run: `git add test/hydrationCheck.ts test/hydrationCheck.test.ts e2e/hydration.spec.ts .context/library-docs.md && git commit -F .git/sdd/processo/msg-task-2.txt`

- [ ] **Step 9: Conferência pelo controlador no portão do E2E (não rodar na tarefa)**

Run: `bunx playwright test e2e/hydration.spec.ts` (sobe o banco do E2E na 54329 e o build na 3200; uns 2 a 4 min)
Expected: `3 passed`. Se aparecer um `_r_`: investigar com systematic-debugging (componente client acima de `Suspense`,
`Date.now`/`matchMedia` no render, `<script>` em componente client) antes de qualquer entrada no `CLIENT_ONLY_IDS`; entrada
só para componente que monta depois da hidratação de propósito, com o motivo.

---

### Task 3: Estados e rodapés sobre `accent`, não `muted`; guarda do `bg-muted`

**Spec:** §9, §11 · **Redator:** R1 · **Depende de:** —

**Files:**
- Create: `src/app/mutedBackground.test.ts`
- Create: `src/components/ui/table.test.tsx`
- Create: `src/components/ui/dialog.test.tsx`
- Create: `src/components/ui/field.test.tsx`
- Modify: `src/components/ui/button.tsx` (`outline` e `ghost`: hover e `aria-expanded`)
- Modify: `src/components/ui/badge.tsx` (`outline` `[a]:hover:`; `ghost` hover e `dark:hover:`)
- Modify: `src/components/ui/table.tsx` (rodapé; hover, `has-aria-expanded` e `data-[state=selected]` da linha)
- Modify: `src/components/ui/card.tsx` (`CardFooter`)
- Modify: `src/components/ui/dialog.tsx` (`DialogFooter`)
- Modify: `src/components/ui/field.tsx` (hover do `FieldLabel` com campo)
- Modify: `src/components/ui/avatar.tsx` (fundo do `AvatarFallback` e do `AvatarGroupCount`)
- Modify: `src/components/app-shell/AdminOverview.tsx` (`group-hover:` do cartão; opaco, ver "Decisões tomadas na montagem do plano")
- Modify: `src/components/dashboard/BarList.tsx`, `src/components/dashboard/StatLink.tsx` (hover da linha)
- Modify: `src/app/themeContrast.test.ts` (texto sobre `accent` e `accent/50`; o estado muda o fundo)
- Modify: `src/components/ui/button.variants.test.ts`, `src/components/ui/badge.test.tsx`, `src/components/ui/card.test.tsx`,
  `src/components/app-shell/AdminOverview.test.tsx`, `src/components/dashboard/BarList.test.tsx`,
  `src/components/dashboard/StatLink.test.tsx` (as classes novas)
- Modify: `test/pendenciasDoc.test.ts` (o P83 entra no conjunto fechado pelo PR B; caso novo)
- Modify: `.context/pendencias.md` (P83 para "Resolvido" com `Atualização`; índice)
- Modify: `.context/ui-registry.md` (`Histórico` 2026-11-27 em Button, Badge, Table, Card, Dialog, Field, Avatar,
  AdminOverview, StatLink, BarList; os `Usa` e o "Como funciona" da AdminOverview)
- Modify: `.context/ui-rules.md` (§6: a frase "Os primitivos ainda têm casos de hover (P83)") e `.context/ui-tokens.md` (§7: o
  `bg-muted` sai do ✅) — fora da lista do contrato, ver "Decisões tomadas na montagem do plano"
- Test: os acima

Testes existentes que citam `bg-muted` (`grep -rln "bg-muted" src test e2e --include="*.test.*" --include="*.spec.ts"`):
`ChoiceGroup.test.tsx`, `BarList.test.tsx`, `chartColors.test.ts`, `metric-card.test.tsx`, `spending-ring.test.tsx`,
`RequestStatusBadge.test.tsx`, `skeleton.test.tsx`. Todos afirmam **ausência** de `bg-muted` (ou `bg-muted-foreground`) e
não mudam; rodam no Step 14 como prova. Nenhum teste afirma `hover:bg-muted` (`grep -rn "hover:bg-muted" src --include="*.test.*"`
→ nada) e não há snapshot no projeto.

**Interfaces:**
- Consumes: `stripComments` de `test/actionGuards.ts` (o do `rawColors.test.ts` é local, não exportado).
- Produces (`src/app/mutedBackground.test.ts`):
  ```ts
  export const MUTED_BG_PATTERN: RegExp; // uma classe (sem aspas nem espaço) cujo utilitário é bg-muted
  export const MUTED_BG_EXCEPTIONS: Record<string, readonly { snippet: string; reason: string }[]>;
  // { "components/solicitacoes/RequestColumn.tsx": [{ snippet: "bg-muted/30", reason: "…" }] }
  export function mutedBackgroundViolations(source: string, key?: string): string[];
  ```
  Para o C1 (R3) e a T8 (R2, `screens/provas.mjs`): os hovers a sondar são o `Button` `outline`/`ghost` dentro de cartão e o
  `StatLink`; o fundo esperado é o `--accent`. O `outline` e o `ghost` se sondam **no claro**, onde o hover é `bg-accent`
  opaco e o `bg-muted` de antes era o próprio card (no escuro o `outline` usa `dark:hover:bg-input/50`, que esta tarefa
  não muda, e o `ghost` usa `accent/50`, semitransparente: a sonda compara só a string da cor e não distinguiria o antes
  do depois). O `StatLink` se sonda no escuro (`hover:bg-accent` opaco nos dois temas).

- [ ] **Step 1: Escrever o guarda do `bg-muted` (o teste que falha)**

Arquivo novo `src/app/mutedBackground.test.ts`:

```ts
/**
 * Guarda do `bg-muted` (PR B, spec §9, P83). Na paleta nova `--muted` = `--card` = `--popover` nos
 * dois temas: dentro de cartão, diálogo ou Sheet, um fundo `bg-muted` (com ou sem opacidade, em
 * repouso, no hover ou aberto) não muda de cor, e o estado ou o rodapé somem. Fundo de estado é
 * `accent` (PB-D8, `ui-rules.md §6`). Varre os `.ts` e `.tsx` de `src/` (fora os `*.test.*`), sem
 * os comentários, como o `rawColors.test.ts`.
 *
 * Exceções numa lista fechada, por arquivo e classe exata, cada uma com o motivo. Uma exceção que
 * não existe mais reprova: apague-a.
 *
 * Rodar: `bunx vitest run src/app/mutedBackground.test.ts`
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import { stripComments } from "../../test/actionGuards";

const SRC = join(import.meta.dirname, "..");

/**
 * Uma classe (já sem aspas nem espaço) cujo utilitário é `bg-muted`: com variantes antes (`hover:`,
 * `aria-expanded:`, `group-hover:`, `[a]:hover:`, `dark:hover:`, `has-[…]:`), opacidade depois
 * (`/50`, `/[0.3]`) e `!`. Nunca `bg-muted-foreground`.
 */
export const MUTED_BG_PATTERN =
  /^(?:\S*:)?!?bg-muted(?:\/(?:\d+|\[[^\]\s]+\]))?!?$/;

/** Chave relativa a `src/`, com `/`. A classe tem de ser exatamente a do `snippet`. */
export const MUTED_BG_EXCEPTIONS: Record<
  string,
  readonly { snippet: string; reason: string }[]
> = {
  "components/solicitacoes/RequestColumn.tsx": [
    {
      snippet: "bg-muted/30",
      reason:
        "a coluna do Quadro fica sobre o background da página (não dentro de cartão) e tem borda; a branch E troca pelo token --column (roteiro §3.1)",
    },
  ],
};

/** As classes `bg-muted` do código (comentários fora), menos as exceções do arquivo. */
export function mutedBackgroundViolations(source: string, key = ""): string[] {
  const allowed = new Set(
    (MUTED_BG_EXCEPTIONS[key] ?? []).map((exception) => exception.snippet),
  );
  return stripComments(source)
    .split(/[\s"'`]+/)
    .filter((token) => MUTED_BG_PATTERN.test(token) && !allowed.has(token));
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(?:ts|tsx)$/.test(entry.name) &&
      !/\.test\.(?:ts|tsx)$/.test(entry.name)
      ? [full]
      : [];
  });
}

const files = sourceFiles(SRC).map((full) => ({
  full,
  key: relative(SRC, full).replaceAll("\\", "/"),
}));

describe("nenhum .ts/.tsx de src/ usa bg-muted como fundo", () => {
  it("anti-vacuidade: acha os arquivos que deve varrer", () => {
    expect(files.length).toBeGreaterThanOrEqual(300);
    const keys = files.map((file) => file.key);
    expect(keys).toContain("components/ui/button.tsx");
    expect(keys).toContain("components/solicitacoes/RequestColumn.tsx");
    expect(keys).toContain("lib/theme.ts");
    expect(keys.some((key) => /\.test\.(?:ts|tsx)$/.test(key))).toBe(false);
  });

  it("todos os arquivos estão limpos", () => {
    const offenders = files.flatMap(({ full, key }) =>
      mutedBackgroundViolations(readFileSync(full, "utf8"), key).map(
        (token) => `${key}: ${token}`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  it("cada exceção está viva: o arquivo existe, tem motivo e, sem a exceção, reprovaria", () => {
    for (const [key, exceptions] of Object.entries(MUTED_BG_EXCEPTIONS)) {
      const file = join(SRC, key);
      expect(existsSync(file), `${key} não existe: apague a exceção`).toBe(
        true,
      );
      const found = mutedBackgroundViolations(readFileSync(file, "utf8"));
      for (const { snippet, reason } of exceptions) {
        expect(reason.length, `${key}: ${snippet} sem motivo`).toBeGreaterThan(
          20,
        );
        expect(
          found,
          `${key} não tem mais ${snippet}: apague a exceção`,
        ).toContain(snippet);
      }
    }
  });

  it("a exceção vale só no arquivo dela e só para a classe exata", () => {
    const column = "components/solicitacoes/RequestColumn.tsx";
    expect(
      mutedBackgroundViolations(
        'className="bg-muted/30"',
        "components/x/Outro.tsx",
      ),
    ).toEqual(["bg-muted/30"]);
    expect(
      mutedBackgroundViolations('className="bg-muted/30"', column),
    ).toEqual([]);
    expect(
      mutedBackgroundViolations(
        'className="hover:bg-muted/30 bg-muted"',
        column,
      ),
    ).toEqual(["hover:bg-muted/30", "bg-muted"]);
  });
});

describe("MUTED_BG_PATTERN reprova o que deve reprovar (casos positivos)", () => {
  it.each([
    "bg-muted",
    "bg-muted/50",
    "bg-muted/30",
    "bg-muted/[0.3]",
    "hover:bg-muted",
    "aria-expanded:bg-muted",
    "group-hover:bg-muted/50",
    "[a]:hover:bg-muted",
    "dark:hover:bg-muted/50",
    "has-aria-expanded:bg-muted/50",
    "data-[state=selected]:bg-muted",
    "has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-muted/50",
    "bg-muted!",
    "!bg-muted",
  ])("%s casa", (token) => {
    expect(MUTED_BG_PATTERN.test(token)).toBe(true);
  });
});

describe("MUTED_BG_PATTERN deixa passar o que não é fundo muted (casos negativos)", () => {
  it.each([
    "bg-muted-foreground",
    "group-hover:bg-muted-foreground",
    "text-muted-foreground",
    "hover:text-muted-foreground",
    "border-muted",
    "bg-accent",
    "hover:bg-accent/50",
    "bg-mutedx",
    "xbg-muted",
    "bg-muted/",
    "",
  ])("%j não casa", (token) => {
    expect(MUTED_BG_PATTERN.test(token)).toBe(false);
  });
});

describe("mutedBackgroundViolations (a varredura de um arquivo)", () => {
  it("comentário não conta", () => {
    expect(
      mutedBackgroundViolations(
        `// hover:bg-muted\n/* bg-muted/50 */\nconst a = "bg-card";`,
      ),
    ).toEqual([]);
  });

  it("acha a classe em className, cn, cva e template literal", () => {
    expect(
      mutedBackgroundViolations(`
        <div className="flex bg-muted/50 p-4" />;
        cn("flex", open && "aria-expanded:bg-muted");
        const v = cva("base", { variants: { ghost: "hover:bg-muted dark:hover:bg-muted/50" } });
        const t = \`p-2 \${active ? "group-hover:bg-muted" : ""}\`;
      `),
    ).toEqual([
      "bg-muted/50",
      "aria-expanded:bg-muted",
      "hover:bg-muted",
      "dark:hover:bg-muted/50",
      "group-hover:bg-muted",
    ]);
  });

  it("código limpo e vazio passam", () => {
    expect(
      mutedBackgroundViolations(
        `const a = "bg-accent hover:bg-accent/50 text-muted-foreground bg-muted-foreground";`,
      ),
    ).toEqual([]);
    expect(mutedBackgroundViolations("")).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bunx vitest run src/app/mutedBackground.test.ts`
Expected: FAIL, `Tests  1 failed | 31 passed (32)`; só `todos os arquivos estão limpos`, com estas 20 entradas:

```text
components/app-shell/AdminOverview.tsx: group-hover:bg-muted/50
components/dashboard/BarList.tsx: hover:bg-muted
components/dashboard/StatLink.tsx: hover:bg-muted
components/ui/avatar.tsx: bg-muted
components/ui/avatar.tsx: bg-muted
components/ui/badge.tsx: [a]:hover:bg-muted
components/ui/badge.tsx: hover:bg-muted
components/ui/badge.tsx: dark:hover:bg-muted/50
components/ui/button.tsx: hover:bg-muted
components/ui/button.tsx: aria-expanded:bg-muted
components/ui/button.tsx: hover:bg-muted
components/ui/button.tsx: aria-expanded:bg-muted
components/ui/button.tsx: dark:hover:bg-muted/50
components/ui/card.tsx: bg-muted/50
components/ui/dialog.tsx: bg-muted/50
components/ui/field.tsx: has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-muted/50
components/ui/table.tsx: bg-muted/50
components/ui/table.tsx: hover:bg-muted/50
components/ui/table.tsx: has-aria-expanded:bg-muted/50
components/ui/table.tsx: data-[state=selected]:bg-muted
```

(O `RequestColumn.tsx` não aparece: a exceção está viva, e o teste dela passa.)

- [ ] **Step 3: Testes das classes novas (os que falham)**

(a) `src/components/ui/button.variants.test.ts`, no fim do arquivo:

```ts
describe("buttonVariants — hover e aberto em accent, não muted (P83)", () => {
  // `--muted` tem o valor do `--card`: dentro de cartão o hover com bg-muted não
  // mudava nada. A prova por estilo calculado é a sonda de hover do C1.
  it("outline: hover e aria-expanded em bg-accent", () => {
    expect(classesOf({ variant: "outline" })).toEqual(
      expect.arrayContaining(["hover:bg-accent", "aria-expanded:bg-accent"]),
    );
  });

  it("ghost: hover e aria-expanded em bg-accent; no escuro, accent/50", () => {
    expect(classesOf({ variant: "ghost" })).toEqual(
      expect.arrayContaining([
        "hover:bg-accent",
        "aria-expanded:bg-accent",
        "dark:hover:bg-accent/50",
      ]),
    );
  });

  it.each(VARIANTS)("variant=%s não usa bg-muted", (variant) => {
    expect(
      classesOf({ variant }).filter((name) =>
        /(?:^|:)bg-muted(?:\/|$)/.test(name),
      ),
    ).toEqual([]);
  });
});
```

(b) `src/components/ui/badge.test.tsx`, no fim do arquivo:

```tsx
describe("Badge — hover em accent, não muted (P83)", () => {
  const VARIANTS = [
    "default",
    "secondary",
    "destructive",
    "outline",
    "ghost",
    "link",
    "warning",
    "info",
    "success",
    "neutral",
  ] as const;

  it("outline num link: hover bg-accent", () => {
    expect(badgeVariants({ variant: "outline" }).split(/\s+/)).toContain(
      "[a]:hover:bg-accent",
    );
  });

  it("ghost: hover bg-accent; no escuro, accent/50", () => {
    expect(badgeVariants({ variant: "ghost" }).split(/\s+/)).toEqual(
      expect.arrayContaining(["hover:bg-accent", "dark:hover:bg-accent/50"]),
    );
  });

  it.each(VARIANTS)("variant=%s não usa bg-muted", (variant) => {
    expect(
      badgeVariants({ variant })
        .split(/\s+/)
        .filter((name) => /(?:^|:)bg-muted(?:\/|$)/.test(name)),
    ).toEqual([]);
  });
});
```

(c) `src/components/ui/card.test.tsx`: troque o import

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "./card";
```

por

```tsx
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./card";
```

e acrescente no fim do arquivo:

```tsx
describe("CardFooter — rodapé em accent (P83)", () => {
  it("se separa do corpo com bg-accent/50 (o bg-muted/50 de antes era o próprio card)", () => {
    render(
      <Card>
        <CardFooter>Rodapé</CardFooter>
      </Card>,
    );
    const footer = screen.getByText("Rodapé");
    expect(footer).toHaveAttribute("data-slot", "card-footer");
    expect(footer).toHaveClass("bg-accent/50");
    expect(footer.className).not.toMatch(/bg-muted/);
  });
});
```

(d) Arquivo novo `src/components/ui/table.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Table, TableBody, TableCell, TableFooter, TableRow } from "./table";

describe("Table — fundos de estado em accent (P83)", () => {
  function renderTable() {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Corpo</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );
  }

  it("linha: hover, aberta e selecionada em accent", () => {
    renderTable();
    const row = screen.getByText("Corpo").closest("tr");
    expect(row).toHaveClass(
      "hover:bg-accent/50",
      "has-aria-expanded:bg-accent/50",
      "data-[state=selected]:bg-accent",
    );
    expect(row?.className).not.toMatch(/bg-muted/);
  });

  it("rodapé em bg-accent/50", () => {
    renderTable();
    const footer = screen.getByText("Total").closest("tfoot");
    expect(footer).toHaveClass("bg-accent/50");
    expect(footer?.className).not.toMatch(/bg-muted/);
  });
});
```

(e) Arquivo novo `src/components/ui/dialog.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DialogFooter } from "./dialog";

describe("DialogFooter — rodapé em accent (P83)", () => {
  it("se separa do corpo com bg-accent/50 (o popover tem o valor do card)", () => {
    render(<DialogFooter>Ações</DialogFooter>);
    const footer = screen.getByText("Ações");
    expect(footer).toHaveAttribute("data-slot", "dialog-footer");
    expect(footer).toHaveClass("bg-accent/50");
    expect(footer.className).not.toMatch(/bg-muted/);
  });
});
```

(f) Arquivo novo `src/components/ui/field.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FieldLabel } from "./field";

describe("FieldLabel — hover do rótulo com campo em accent (P83)", () => {
  it("o rótulo que envolve um campo usa bg-accent/50 no hover", () => {
    render(<FieldLabel>Rótulo</FieldLabel>);
    const label = screen.getByText("Rótulo");
    expect(label).toHaveAttribute("data-slot", "field-label");
    expect(label).toHaveClass(
      "has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-accent/50",
    );
    expect(label.className).not.toMatch(/bg-muted/);
  });
});
```

(g) `src/components/app-shell/AdminOverview.test.tsx`, dentro do `describe("AdminOverview", …)`, depois do teste "mistura
singular e plural na Equipe":

```tsx
  it("o hover do cartão é bg-accent opaco: accent/50 sobre a página escura daria o próprio card (P83)", async () => {
    await renderOverview();
    const link = screen.getByRole("link", { name: /^Setores/ });
    const card = link.querySelector('[data-slot="card"]');
    expect(card).toHaveClass("bg-card", "group-hover:bg-accent");
    expect(card).not.toHaveClass("group-hover:bg-accent/50");
    expect(card?.className).not.toMatch(/bg-muted/);
  });
```

(h) `src/components/dashboard/BarList.test.tsx`, no fim do `describe` (depois do teste do trilho):

```tsx
  it("o hover da linha usa bg-accent (o bg-muted era o próprio card e o hover sumia)", () => {
    renderList();
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(3);
    for (const link of links) {
      expect(link).toHaveClass("bg-card", "hover:bg-accent");
      expect(link).not.toHaveClass("hover:bg-muted");
    }
  });
```

(i) `src/components/dashboard/StatLink.test.tsx`, no fim do `describe("StatLink", …)`:

```tsx
  it("o hover usa bg-accent (o bg-muted era o próprio card e o hover sumia)", () => {
    render(
      <StatLink label="Entregues" value={3} href="/passagens" icon={Clock} />,
    );
    const link = screen.getByRole("link");
    expect(link).toHaveClass("bg-card", "hover:bg-accent");
    expect(link).not.toHaveClass("hover:bg-muted");
  });
```

(O `avatar` não ganha teste de classe: a spec §12 não o lista e o primitivo não tem uso hoje; o `mutedBackground.test.ts`
o cobre.)

- [ ] **Step 4: Rodar e ver falhar**

Run: `bunx vitest run src/components/ui/button.variants.test.ts src/components/ui/badge.test.tsx src/components/ui/card.test.tsx src/components/ui/table.test.tsx src/components/ui/dialog.test.tsx src/components/ui/field.test.tsx src/components/app-shell/AdminOverview.test.tsx src/components/dashboard/BarList.test.tsx src/components/dashboard/StatLink.test.tsx`
Expected: FAIL nos testes novos (os antigos continuam verdes), por exemplo `expected [ …(n) ] to include 'hover:bg-accent'`
no outline, `variant=outline não usa bg-muted` com `["hover:bg-muted", "aria-expanded:bg-muted"]`,
`Expected the element to have class: bg-accent/50` no rodapé, e `group-hover:bg-accent` na AdminOverview.

- [ ] **Step 5: Conferir os consumidores de `outline`/`ghost` (spec §9)**

Run: `grep -rn 'variant="\(outline\|ghost\)"\|variant: "\(outline\|ghost\)"' src --include=*.tsx --include=*.ts | grep -v "\.test\."`
e `grep -rn "bg-accent" src --include=*.tsx --include=*.ts | grep -v "\.test\."`.

Expected (conferido na redação): nenhum `Button` nem `Badge` `outline`/`ghost` fica sobre um fundo `accent`. Os fundos
`accent` são selos e linhas (`HandoverStatusBadge`, `statusStyle`, `Badge neutral`, `Skeleton`, a linha em foco do
`MetricCard` e do `SpendingRing`, o trilho do `BarList`, o contador da `AppSidebar`) e o hover do `OpenRequestItem`, que só
tem `RequestStatusBadge`/`StaleBadge` dentro. Os `Badge variant="outline"` (`ItemsAdmin`, `ShiftsAdmin`, `TeamAdmin`,
`HandoverStatusBadge`) são `<span>`: o `[a]:hover:` não se aplica. Nenhum `Badge variant="ghost"` em uso. Nenhum hover local
a criar. Se o grep mostrar um consumidor novo sobre `accent`, ele ganha um hover local registrado (spec §9) e o
controlador é avisado.

- [ ] **Step 6: Corrigir os primitivos e os componentes (`bg-muted` → `bg-accent`, mesma opacidade e variante)**

Edições (ferramenta Edit):

`src/components/ui/button.tsx`, old_string:

```ts
        outline:
          "border-input bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:bg-input/30 dark:hover:bg-input/50",
```

new_string:

```ts
        // Hover e aberto em `accent`: o `--muted` tem o valor do `--card`, e o
        // hover sumia dentro de cartão, diálogo e Sheet (P83).
        outline:
          "border-input bg-background hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground dark:bg-input/30 dark:hover:bg-input/50",
```

e old_string:

```ts
        ghost:
          "border-transparent hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
```

new_string:

```ts
        ghost:
          "border-transparent hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground dark:hover:bg-accent/50",
```

`src/components/ui/badge.tsx`, old_string:

```ts
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
```

new_string:

```ts
        outline:
          "border-border text-foreground [a]:hover:bg-accent [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-accent hover:text-muted-foreground dark:hover:bg-accent/50",
```

(`text-muted-foreground` sobre `accent` passa: 4,84:1 no claro e 5,10:1 no escuro; sobre `accent/50` em cima do card, 5,39
e 5,55. Medido no Step 8.)

`src/components/ui/table.tsx`, old_string:

```ts
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
```

new_string:

```ts
        "border-t bg-accent/50 font-medium [&>tr]:last:border-b-0",
```

e old_string:

```ts
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
```

new_string:

```ts
        "border-b transition-colors hover:bg-accent/50 has-aria-expanded:bg-accent/50 data-[state=selected]:bg-accent",
```

`src/components/ui/card.tsx`, old_string:

```ts
        "flex items-center rounded-b-xl border-t bg-muted/50 p-(--card-spacing)",
```

new_string:

```ts
        "flex items-center rounded-b-xl border-t bg-accent/50 p-(--card-spacing)",
```

`src/components/ui/dialog.tsx`, old_string:

```ts
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
```

new_string:

```ts
        "-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-accent/50 p-4 sm:flex-row sm:justify-end",
```

`src/components/ui/field.tsx` (dentro da string longa do `FieldLabel`), old_string:

```ts
has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-muted/50
```

new_string:

```ts
has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-accent/50
```

`src/components/ui/avatar.tsx`, Edit com `replace_all: true` (duas ocorrências: `AvatarFallback` e `AvatarGroupCount`),
old_string:

```ts
rounded-full bg-muted text-sm text-muted-foreground
```

new_string:

```ts
rounded-full bg-accent text-sm text-muted-foreground
```

`src/components/app-shell/AdminOverview.tsx`, old_string:

```tsx
              <Card className="h-full transition-colors group-hover:bg-muted/50">
```

new_string (opaco de propósito, ver "Decisões tomadas na montagem do plano"):

```tsx
              {/* Hover opaco: accent/50 sobre a página escura dá exatamente o --card (P83). */}
              <Card className="h-full transition-colors group-hover:bg-accent">
```

`src/components/dashboard/BarList.tsx`, old_string:

```tsx
              className="flex min-h-11 flex-col justify-center gap-1 rounded-lg border bg-card px-3 py-2 text-card-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
```

new_string:

```tsx
              className="flex min-h-11 flex-col justify-center gap-1 rounded-lg border bg-card px-3 py-2 text-card-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
```

`src/components/dashboard/StatLink.tsx`, old_string:

```tsx
      className="flex min-h-11 flex-col gap-1 rounded-lg border bg-card p-3 text-card-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
```

new_string:

```tsx
      className="flex min-h-11 flex-col gap-1 rounded-lg border bg-card p-3 text-card-foreground outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none"
```

O `src/components/solicitacoes/RequestColumn.tsx` **não** muda (exceção viva).

- [ ] **Step 7: Rodar e ver passar**

Run: `bunx vitest run src/app/mutedBackground.test.ts src/components/ui/button.variants.test.ts src/components/ui/badge.test.tsx src/components/ui/card.test.tsx src/components/ui/table.test.tsx src/components/ui/dialog.test.tsx src/components/ui/field.test.tsx src/components/app-shell/AdminOverview.test.tsx src/components/dashboard/BarList.test.tsx src/components/dashboard/StatLink.test.tsx`
Expected: PASS nos dez arquivos; `mutedBackground.test.ts` com `Tests  32 passed (32)`.

- [ ] **Step 8: `themeContrast.test.ts`: texto sobre os fundos de estado e o estado que muda o fundo**

(a) Em `SURFACE_PAIRS`, troque:

```ts
  ["muted-foreground", "accent"],
```

por:

```ts
  ["muted-foreground", "accent"],
  // Texto sobre o fundo de estado opaco (hover e aberto do Button outline e
  // ghost, linha selecionada, BarList, StatLink, cartão da Administração; P83).
  ["foreground", "accent"],
```

(b) No fim do arquivo:

```ts
// ---------------------------------------------------------------- fundos de estado (P83, PR B §9)
/**
 * Os estados e rodapés que eram `bg-muted` viraram `bg-accent` (PB-D8): `--muted` tem o valor do
 * `--card`, e dentro de cartão, diálogo ou Sheet o fundo antigo não mudava nada. Dois guardas, nos
 * dois temas: (1) o texto (`foreground` e `muted-foreground`) sobre `accent/50` composto em cima do
 * card e da página (rodapé do Card e do Dialog, linha da tabela, rótulo com campo, `ghost` no
 * escuro; o `accent` opaco está em SURFACE_PAIRS); (2) cada fundo de estado composto sobre o fundo
 * real muda a cor de repouso daquele lugar (outra cor de 8 bits). Os casos negativos mostram por que
 * o `bg-muted` sumia e por que o cartão da Administração usa `accent` opaco.
 */
const ACCENT_HALF = 0.5;
const STATE_TEXT = ["foreground", "muted-foreground"] as const;
const STATE_BASES = ["card", "background"] as const;
const BOTH_THEMES = [":root", ".dark"] as const;

/** A cor como os 3 bytes que a tela pinta: iguais aqui = a mesma cor na tela. */
function bytes(rgb: Rgb): string {
  return rgb.map((channel) => Math.round(channel * 255)).join(",");
}

/** Um fundo de estado: `accent` com `alpha`, composto sobre `under`; `resting` é o fundo sem o estado. */
type StateCase = {
  name: string;
  alpha: number;
  under: string;
  resting: string;
  themes: readonly string[];
};

const STATE_CASES: StateCase[] = [
  {
    name: "Button outline no hover e aberto, dentro de cartão (repouso bg-background; o escuro usa input/50)",
    alpha: 1,
    under: "card",
    resting: "background",
    themes: [":root"],
  },
  {
    name: "Button e Badge ghost no hover, dentro de cartão",
    alpha: 1,
    under: "card",
    resting: "card",
    themes: [":root"],
  },
  {
    name: "Button e Badge ghost no hover, sobre a página",
    alpha: 1,
    under: "background",
    resting: "background",
    themes: [":root"],
  },
  {
    name: "Button e Badge ghost no hover (dark:hover:bg-accent/50), dentro de cartão",
    alpha: ACCENT_HALF,
    under: "card",
    resting: "card",
    themes: [".dark"],
  },
  {
    name: "Button e Badge ghost no hover (dark:hover:bg-accent/50), sobre a página",
    alpha: ACCENT_HALF,
    under: "background",
    resting: "background",
    themes: [".dark"],
  },
  {
    name: "rodapé do Card e do Dialog, linha da tabela e rótulo com campo (bg-accent/50), dentro de cartão",
    alpha: ACCENT_HALF,
    under: "card",
    resting: "card",
    themes: BOTH_THEMES,
  },
  {
    name: "linha da tabela e rótulo com campo (bg-accent/50), sobre a página",
    alpha: ACCENT_HALF,
    under: "background",
    resting: "background",
    themes: BOTH_THEMES,
  },
  {
    name: "linha do BarList e do StatLink no hover (bg-card para bg-accent)",
    alpha: 1,
    under: "card",
    resting: "card",
    themes: BOTH_THEMES,
  },
  {
    name: "cartão da Administração no hover (bg-card para bg-accent), sobre a página",
    alpha: 1,
    under: "background",
    resting: "card",
    themes: BOTH_THEMES,
  },
];

for (const [theme, selector] of THEMES) {
  describe(`fundos de estado (accent) — tema ${theme}`, () => {
    const token = (name: string) => solid(readToken(css, selector, name), name);
    const accentOver = (alpha: number, under: string) =>
      over({ rgb: token("accent"), alpha }, token(under));

    it.each(
      STATE_TEXT.flatMap((fg) =>
        STATE_BASES.map((base): [string, string] => [fg, base]),
      ),
    )("%s sobre accent/50 composto em cima de --%s (≥4,5:1)", (fg, base) => {
      const ratio = contrast(token(fg), accentOver(ACCENT_HALF, base));
      expect(ratio, `${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(TEXT_MIN);
    });

    it.each(
      STATE_CASES.filter((item) => item.themes.includes(selector)).map(
        (item): [string, StateCase] => [item.name, item],
      ),
    )("%s: o estado muda a cor de repouso", (_name, item) => {
      expect(bytes(accentOver(item.alpha, item.under))).not.toBe(
        bytes(token(item.resting)),
      );
    });

    it("caso negativo: o bg-muted/50 de antes, dentro de cartão, pinta a mesma cor do cartão", () => {
      const old = over(
        { rgb: token("muted"), alpha: ACCENT_HALF },
        token("card"),
      );
      expect(bytes(old)).toBe(bytes(token("card")));
    });
  });
}

describe("caso negativo: o cartão da Administração com accent/50 sumiria no escuro (por isso accent opaco)", () => {
  it("accent/50 sobre a página escura é exatamente o --card", () => {
    const token = (name: string) =>
      solid(readToken(css, ".dark", name), name);
    expect(
      bytes(
        over({ rgb: token("accent"), alpha: ACCENT_HALF }, token("background")),
      ),
    ).toBe(bytes(token("card")));
  });
});
```

- [ ] **Step 9: Rodar e ver passar**

Run: `bunx vitest run src/app/themeContrast.test.ts`
Expected: PASS. Os casos novos já passam com o `globals.css` de hoje (o PR B não muda token): 2 pares a mais em
`SURFACE_PAIRS` (um por tema) e 24 no fim (no claro, 4 de texto + 7 de estado + 1 negativo; no escuro, 4 + 6 + 1; mais o
negativo da Administração). Valores medidos na redação: `foreground` sobre `accent/50` em cima do card 15,52 (claro) e
12,00 (escuro); `muted-foreground` 5,39 e 5,55; em cima da página 5,07 e 6,02.

- [ ] **Step 10: O guarda do `pendencias.md` aceita o P83 resolvido (teste que falha)**

Em `test/pendenciasDoc.test.ts`, troque (a linha que a Task 1 escreveu):

```ts
    const closedByPrB = new Set(["P81"]);
```

por:

```ts
    const closedByPrB = new Set(["P81", "P83"]);
```

e acrescente, depois do teste "PR B: P81 resolvida…" (da Task 1, hoje o último do arquivo). Edit com old_string = as
duas últimas linhas do caso da Task 1 mais o fecho do arquivo (únicas: só ele usa `p44?.updates`):

```ts
    expect(p44?.updates, "P44").toContain("2026-11-27");
  });
});
```

e new_string = as duas primeiras dessas linhas, uma linha em branco, o caso abaixo e o `});` final:

```ts
  it("PR B: P83 resolvida pelo guarda do bg-muted", () => {
    const p83 = entries.get("P83");
    expect(p83?.state, "P83").toBe("Resolvido");
    expect(p83?.section, "P83").toBe("5");
    expect(p83?.updates, "P83").toContain("2026-11-27");
  });
```

- [ ] **Step 11: Rodar e ver falhar**

Run: `bunx vitest run test/pendenciasDoc.test.ts`
Expected: FAIL só em `PR B: P83 resolvida…`: `P83: expected 'Aberto, não triado' to be 'Resolvido'`.

- [ ] **Step 12: `pendencias.md`: P83 para "Resolvido"**

(a) Índice: troque

````markdown
| P83 | Hover e estado aberto com bg-muted somem dentro de card, Dialog e Sheet | 🟡 | Aberto, não triado |
````

por

````markdown
| P83 | Hover e estado aberto com bg-muted somem dentro de card, Dialog e Sheet | 🟡 | Resolvido |
````

(b) Seção 1: apague o bloco do P83 inteiro, com a linha em branco que o segue (old_string abaixo, new_string vazio):

````markdown
#### P83 — Hover e estado aberto com bg-muted somem dentro de card, Dialog e Sheet 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/components/ui/button.tsx` (`outline` e `ghost`: `hover:bg-muted`, `aria-expanded:bg-muted`) · `src/components/ui/badge.tsx` (`outline` e `ghost`) · `src/components/ui/table.tsx` (hover, linha aberta, selecionada e rodapé) · `src/components/ui/card.tsx` e `src/components/ui/dialog.tsx` (rodapé `bg-muted/50`) · `src/components/ui/field.tsx` (hover do rótulo com campo) · `src/components/dashboard/BarList.tsx` · `src/components/dashboard/StatLink.tsx` · `src/components/app-shell/AdminOverview.tsx`
**Impacto:** na paleta nova, `--muted` tem o mesmo valor de `--card` e `--popover`. Dentro de cartão, diálogo ou Sheet, o hover do botão contornado ou fantasma (por exemplo "Tentar de novo" e o menu "…" do `RequestCard`), o da linha de tabela, o das linhas do `BarList` e do `StatLink` e o do cartão da Administração não mudam de cor. O rodapé do `Card` e o do `Dialog` também não se separam do corpo. O passe de legibilidade (Task 15) corrigiu os casos de estado (escolha marcada, selo, esqueleto e destaques do dashboard), mas não os de hover.
**Correção:** — (opção: trocar por `accent` nos primitivos, num commit `fix(visual)` com prova por estilo calculado; o roteiro planeja um guarda que recusa `bg-muted` nos `.tsx` no PR B, `.git/sdd/roadmap/roteiro.md` §7)
**Registrado em:** 2026-11-27

````

e cole-o no fim do arquivo, depois do P81 (que a Task 1 pôs lá). Edit com old_string = a última frase do P81:

````markdown
Na produção nada muda: o Sheet do detalhe continua fechando ao navegar, agora pelo espelho do segmento.
````

e new_string:

````markdown
Na produção nada muda: o Sheet do detalhe continua fechando ao navegar, agora pelo espelho do segmento.

#### P83 — Hover e estado aberto com bg-muted somem dentro de card, Dialog e Sheet 🟡
**Estado:** Resolvido
**Arquivos:** `src/components/ui/button.tsx` (`outline` e `ghost`: `hover:bg-muted`, `aria-expanded:bg-muted`) · `src/components/ui/badge.tsx` (`outline` e `ghost`) · `src/components/ui/table.tsx` (hover, linha aberta, selecionada e rodapé) · `src/components/ui/card.tsx` e `src/components/ui/dialog.tsx` (rodapé `bg-muted/50`) · `src/components/ui/field.tsx` (hover do rótulo com campo) · `src/components/dashboard/BarList.tsx` · `src/components/dashboard/StatLink.tsx` · `src/components/app-shell/AdminOverview.tsx`
**Impacto:** na paleta nova, `--muted` tem o mesmo valor de `--card` e `--popover`. Dentro de cartão, diálogo ou Sheet, o hover do botão contornado ou fantasma (por exemplo "Tentar de novo" e o menu "…" do `RequestCard`), o da linha de tabela, o das linhas do `BarList` e do `StatLink` e o do cartão da Administração não mudam de cor. O rodapé do `Card` e o do `Dialog` também não se separam do corpo. O passe de legibilidade (Task 15) corrigiu os casos de estado (escolha marcada, selo, esqueleto e destaques do dashboard), mas não os de hover.
**Correção:** — (opção: trocar por `accent` nos primitivos, num commit `fix(visual)` com prova por estilo calculado; o roteiro planeja um guarda que recusa `bg-muted` nos `.tsx` no PR B, `.git/sdd/roadmap/roteiro.md` §7)
**Registrado em:** 2026-11-27
**Atualização (2026-11-27):** resolvida no PR B (`chore/processo-visual`, spec §9). Os estados e rodapés trocaram `bg-muted` por `bg-accent` com a mesma opacidade e a mesma variante (PB-D8): `Button` `outline` e `ghost` (hover e `aria-expanded`; `dark:hover:bg-accent/50` no `ghost`), `Badge` `outline` e `ghost`, `Table` (rodapé, hover, linha aberta e selecionada), `CardFooter`, `DialogFooter`, o hover do `FieldLabel` com campo, o `Avatar` (fallback e contador), `BarList` e `StatLink`. Desvio: o cartão da `AdminOverview` usa `group-hover:bg-accent` opaco, porque `accent/50` sobre a página escura dá exatamente o `--card` (caso negativo no `themeContrast.test.ts`). Os consumidores de `Button` e `Badge` `outline`/`ghost` foram conferidos: nenhum fica sobre fundo `accent`. Guarda: `src/app/mutedBackground.test.ts` recusa `bg-muted` (com opacidade e variantes, nunca `bg-muted-foreground`) nos `.ts` e `.tsx` de `src/`, com uma exceção fechada (`RequestColumn`, `bg-muted/30`, sobre a página; a branch E a troca pelo token `--column`). O `themeContrast.test.ts` mede o texto sobre `accent` e `accent/50` e confere que cada fundo de estado muda a cor de repouso. A prova por estilo calculado (hover de um `outline` e de um `ghost` dentro de cartão e de um `StatLink`) fica na prova do PR (C1).
````

- [ ] **Step 13: Registro e regras**

`.context/ui-registry.md` (ferramenta Edit; os cabeçalhos `###` não mudam):

- Button, old_string:
  ```markdown
  - **Usa:** tokens `primary`, `input`, `muted`, `accent`, `card`, `ring`, `destructive`, `on-pastel*`.
  ```
  new_string:
  ```markdown
  - **Usa:** tokens `primary`, `input`, `accent`, `card`, `ring`, `destructive`, `on-pastel*`.
  ```
  e old_string `o \`themeContrast.test.ts\` lê os percentuais desta variante.` → new_string:
  ```markdown
  o `themeContrast.test.ts` lê os percentuais desta variante. 2026-11-27 — PR B (P83): `outline` e `ghost` com hover e `aria-expanded` em `bg-accent` (e `dark:hover:bg-accent/50` no `ghost`); eram `bg-muted`, igual ao card na paleta nova, e o hover sumia dentro de cartão, diálogo e Sheet. Guarda: `src/app/mutedBackground.test.ts`.
  ```
- Badge, old_string `saem as variantes \`pastel-pending\` e \`pastel-confirmed\` e os tokens delas (o cartão de turno passou a usar blocos de largura inteira).` → new_string:
  ```markdown
  saem as variantes `pastel-pending` e `pastel-confirmed` e os tokens delas (o cartão de turno passou a usar blocos de largura inteira). 2026-11-27 — PR B (P83): `outline` (`[a]:hover:`) e `ghost` (hover e `dark:hover:`) em `bg-accent`, com a mesma opacidade (eram `bg-muted`, igual ao card).
  ```
- Field, old_string:
  ```markdown
  - **Usa:** `Label`, `Separator`; tokens `destructive`, `muted-foreground`.
  - **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.
  ```
  new_string:
  ```markdown
  - **Usa:** `Label`, `Separator`; tokens `destructive`, `muted-foreground`, `accent`.
  - **Histórico:** 2026-11-20 — `shadcn add`, sem alteração. 2026-11-27 — PR B (P83): o hover do `FieldLabel` que envolve um campo em `bg-accent/50` (era `bg-muted/50`, igual ao card).
  ```
- Card, old_string:
  ```markdown
  - **Usa:** tokens `card`, `card-foreground`, `border`.
  - **Histórico:** 2026-11-20 — `shadcn add`, sem alteração. 2026-11-27 — Visual do Início (Task 4): variante `feature`; o `default` não mudou.
  ```
  new_string:
  ```markdown
  - **Usa:** tokens `card`, `card-foreground`, `border`, `accent`.
  - **Histórico:** 2026-11-20 — `shadcn add`, sem alteração. 2026-11-27 — Visual do Início (Task 4): variante `feature`; o `default` não mudou. 2026-11-27 — PR B (P83): `CardFooter` com `bg-accent/50` (era `bg-muted/50`: o rodapé não se separava do corpo).
  ```
- Avatar, old_string:
  ```markdown
  - **Usa:** `@base-ui/react/avatar`; tokens `muted`.
  - **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.
  ```
  new_string:
  ```markdown
  - **Usa:** `@base-ui/react/avatar`; tokens `accent`, `muted-foreground`.
  - **Histórico:** 2026-11-20 — `shadcn add`, sem alteração. 2026-11-27 — PR B (P83): fundo do `AvatarFallback` e do `AvatarGroupCount` em `bg-accent` (era `bg-muted`, igual ao card; primitivo sem uso hoje).
  ```
- Dialog, old_string `- **Usa:** \`Button\`; tokens \`popover\`, \`muted\`.` → new_string `- **Usa:** \`Button\`; tokens \`popover\`, \`accent\`.`; e
  old_string `` `git checkout -- src/components/ui/button.tsx` (F2-24).`` → new_string:
  ```markdown
  `git checkout -- src/components/ui/button.tsx` (F2-24). 2026-11-27 — PR B (P83): `DialogFooter` com `bg-accent/50` (era `bg-muted/50`; o `popover` tem o valor do card e o rodapé não se separava).
  ```
- Table, old_string:
  ```markdown
  - **Usa:** tokens `border`, `muted`, `foreground`.
  - **Histórico:** 2026-11-24 — `shadcn add table` na Fase 4 (Tarefa 11).
  ```
  new_string:
  ```markdown
  - **Usa:** tokens `border`, `accent`, `foreground`.
  - **Histórico:** 2026-11-24 — `shadcn add table` na Fase 4 (Tarefa 11). 2026-11-27 — PR B (P83): rodapé, hover e linha aberta (`has-aria-expanded`) em `bg-accent/50` e linha selecionada em `bg-accent` (eram `bg-muted`, igual ao card).
  ```
- AdminOverview, old_string `` `bg-muted/50`). O título fica dentro`` → new_string `` `bg-accent`, opaco). O título fica dentro``; e
  old_string `cartões dos cinco cadastros e contagens.` → new_string:
  ```markdown
  cartões dos cinco cadastros e contagens. 2026-11-27 — PR B (P83): hover do cartão em `group-hover:bg-accent`, opaco (era `bg-muted/50`, igual ao card; com `accent/50` sobre a página escura o resultado seria o próprio `--card` e o hover sumiria de novo).
  ```
- StatLink, old_string:
  ```markdown
  - **Usa:** `Link`, tokens `card`, `muted`, `ring`.
  - **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 11).
  ```
  new_string:
  ```markdown
  - **Usa:** `Link`, tokens `card`, `accent`, `ring`.
  - **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 11). 2026-11-27 — PR B (P83): hover em `bg-accent` (era `bg-muted`, igual ao card).
  ```
- BarList, old_string `o \`bg-muted\` é igual ao card na paleta nova e o trilho sumia).` → new_string:
  ```markdown
  o `bg-muted` é igual ao card na paleta nova e o trilho sumia). 2026-11-27 — PR B (P83): hover da linha em `bg-accent` (era `bg-muted`).
  ```

`.context/ui-rules.md` §6, old_string:

```markdown
  claro o fundo some. Use `accent` para hover e estado, e `primary` para o marcado. Os primitivos
  ainda têm casos de hover (P83).
```

new_string:

```markdown
  claro o fundo some. Use `accent` para hover e estado, e `primary` para o marcado. O guarda
  `src/app/mutedBackground.test.ts` recusa `bg-muted` em `src/`, com lista fechada de exceções (P83).
```

`.context/ui-tokens.md` §7, old_string:

```markdown
✅ `bg-background`, `text-foreground`, `bg-muted`, `text-muted-foreground`, `bg-card`,
```

new_string:

```markdown
✅ `bg-background`, `text-foreground`, `bg-accent` (hover e estado), `text-muted-foreground`, `bg-card`,
```

e old_string:

```markdown
`z-[...]` arbitrário.
```

new_string:

```markdown
`z-[...]` arbitrário, `bg-muted` (tem o valor do `card`: use `bg-accent`; `mutedBackground.test.ts`).
```

- [ ] **Step 14: Rodar os guardas de documento e os testes que citam `bg-muted`**

Run: `bunx vitest run test/pendenciasDoc.test.ts test/uiRegistryDoc.test.ts src/app/rawColors.test.ts src/components/admin/ChoiceGroup.test.tsx src/components/dashboard/chartColors.test.ts src/components/kokonutui/metric-card.test.tsx src/components/kokonutui/spending-ring.test.tsx src/components/solicitacoes/RequestStatusBadge.test.tsx src/components/ui/skeleton.test.tsx src/components/ui/touchTargets.test.tsx`
Expected: PASS em todos; `pendenciasDoc.test.ts` com `Tests  21 passed (21)`.

Run: `grep -c "^### " .context/ui-registry.md` antes (no `HEAD`: `git show HEAD:.context/ui-registry.md | grep -c "^### "`) e
depois.
Expected: o mesmo número.

Run: `grep -rn "bg-muted" src --include=*.tsx --include=*.ts | grep -v "\.test\." | grep -v "muted-foreground"`
Expected: só `src/components/solicitacoes/RequestColumn.tsx` (`bg-muted/30`).

- [ ] **Step 15: Portão da tarefa**

Run: `bunx biome check --write src/app/mutedBackground.test.ts src/app/themeContrast.test.ts src/components/ui src/components/app-shell/AdminOverview.tsx src/components/app-shell/AdminOverview.test.tsx src/components/dashboard/BarList.tsx src/components/dashboard/BarList.test.tsx src/components/dashboard/StatLink.tsx src/components/dashboard/StatLink.test.tsx test/pendenciasDoc.test.ts`
Expected: sem erro.

Run: `bun run check-types`
Expected: sai com 0.

Run: `bun run lint`
Expected: código 0.

Run: `bunx vitest run src/app/mutedBackground.test.ts src/app/themeContrast.test.ts src/components/ui src/components/app-shell/AdminOverview.test.tsx src/components/dashboard`
Expected: PASS em todos.

- [ ] **Step 16: Commit**

Mensagem gravada com Write em `.git/sdd/processo/msg-task-3.txt`:

```text
fix(visual): estados e rodapés sobre accent, não muted; guarda do bg-muted

Na paleta nova --muted tem o valor do --card: o hover do Button outline e
ghost, do Badge, da tabela, do BarList, do StatLink e do cartão da
Administração, e os rodapés do Card e do Dialog, não mudavam de cor dentro
de cartão, diálogo ou Sheet (P83). Viram bg-accent com a mesma opacidade
(o cartão da Administração, opaco: accent/50 sobre a página escura dá o
próprio card). mutedBackground.test.ts recusa bg-muted em src/, com a
coluna do Quadro como exceção fechada; themeContrast mede o texto sobre
accent e accent/50 e confere que cada estado muda o fundo.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run: `git add src/app/mutedBackground.test.ts src/app/themeContrast.test.ts src/components/ui/button.tsx src/components/ui/badge.tsx src/components/ui/table.tsx src/components/ui/card.tsx src/components/ui/dialog.tsx src/components/ui/field.tsx src/components/ui/avatar.tsx src/components/ui/button.variants.test.ts src/components/ui/badge.test.tsx src/components/ui/card.test.tsx src/components/ui/table.test.tsx src/components/ui/dialog.test.tsx src/components/ui/field.test.tsx src/components/app-shell/AdminOverview.tsx src/components/app-shell/AdminOverview.test.tsx src/components/dashboard/BarList.tsx src/components/dashboard/BarList.test.tsx src/components/dashboard/StatLink.tsx src/components/dashboard/StatLink.test.tsx test/pendenciasDoc.test.ts .context/pendencias.md .context/ui-registry.md .context/ui-rules.md .context/ui-tokens.md && git status --short && git commit -F .git/sdd/processo/msg-task-3.txt`
Expected no `git status --short`: só os 26 arquivos acima (`A ` nos quatro testes novos, `M ` nos outros).

---

### Task 4: Base das ferramentas (caminhos, portas, vocabulário, pixelmatch e pngjs)

**Spec:** §5.1–5.4 · **Redator:** R2 · **Depende de:** —

**Files:**
- Create: `scripts/visual/paths.mjs`
- Create: `scripts/visual/config.mjs`
- Create: `scripts/visual/vocabulary.mjs`
- Modify: `package.json` (`devDependencies`: `pixelmatch` 7.2.0 e `pngjs` 7.0.0, exatas)
- Modify: `bun.lock` (muda junto, pelo `bun add`)
- Modify: `.context/library-docs.md` (§21 nova, antes de "Como adicionar uma biblioteca nova")
- Test: `test/visual/paths.test.ts`
- Test: `test/visual/config.test.ts`
- Test: `test/visual/vocabulary.test.ts`

**Interfaces:**
- Consumes: nada de tarefa anterior. Do app: `THEME_STORAGE_KEY` (`src/lib/theme.ts`), `INVITE_COOKIE`
  (`src/lib/auth/inviteCookie.ts`), `SECTOR_COLORS` (`src/features/sectors/colors.ts`) e `REQUEST_STATUSES`
  (`src/lib/requestStatuses.ts`), só nos testes.
- Produces (nomes do contrato):
  - `paths.mjs`: `VISUAL_DB_DIR = "visual-db"`, `VISUAL_DB_FILES = { world, state, avatars, secret, data }`,
    `gitCommonDir(cwd?): string`, `repoRoot(cwd?): string`, `sddDir(cwd?): string`, `isInside(parent, child): boolean`,
    `resolveInside(base, relative): string` (lança `"fora de <base>: <rel>"`), `sddPath(...parts): string`,
    `assertInsideSdd(file): string` (lança `"fora de .git/sdd: <file>"`), `visualDbDir(): string`,
    `writeInsideSdd(file, content): void`, `readJsonInsideSdd(file): unknown` (lança `"arquivo ausente: <abs>"`).
  - `config.mjs`: `VISUAL_DB_HOST`, `VISUAL_DB_PORT = 54332`, `VISUAL_APP_PORT = 3202`, `VISUAL_DB_URL`, `VISUAL_BASE_URL`,
    `FORBIDDEN_PORTS = [3000, 3200, 3201, 54329, 54331]`, `THEME_STORAGE_KEY = "closery-tema"`,
    `VISUAL_INVITE_COOKIE = "closery_invite"`, `MOBILE_MAX_WIDTH = 859`, `assertVisualDbUrl(url): string`,
    `assertVisualBaseUrl(url): string`, `parseCliArgs(argv): { flags, positional }`,
    `parseSizes(value, fallback): number[]`, `fakeClientIp(n): string`.
  - `vocabulary.mjs`: `VISUAL_PEOPLE`, `VISUAL_PASSWORD`, `VISUAL_SECTORS`, `VISUAL_SHIFTS`, `VISUAL_ITEMS`,
    `VISUAL_DESTINATIONS`, `VISUAL_TEXTS` (valores da spec §5.4; congelados em profundidade), com os typedefs JSDoc
    `VisualPersonKey`, `VisualPerson`, `VisualSector`, `VisualShift`, `VisualTexts` (o `keyof typeof VISUAL_PEOPLE` dá
    `"ana" | "bruno" | "carla" | "diego"` e o `role` sai `"admin" | "operator"` no TypeScript).

- [ ] **Step 1: Instalar as duas devDependencies exatas**

Run: `bun add -d -E pixelmatch@7.2.0 pngjs@7.0.0`
Expected: `installed pixelmatch@7.2.0` e `installed pngjs@7.0.0`. Diff esperado do `package.json` (o `bun.lock` muda junto):

```diff
     "jsdom": "^28",
+    "pixelmatch": "7.2.0",
+    "pngjs": "7.0.0",
     "tailwindcss": "4.3.3",
```

Conferir: `git diff --stat` mostra só `package.json` e `bun.lock`; nenhum `^` nas duas linhas.

- [ ] **Step 2: Escrever o teste dos caminhos**

`test/visual/paths.test.ts`:

```ts
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  statSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  assertInsideSdd,
  gitCommonDir,
  isInside,
  readJsonInsideSdd,
  repoRoot,
  resolveInside,
  sddDir,
  sddPath,
  VISUAL_DB_DIR,
  VISUAL_DB_FILES,
  visualDbDir,
  writeInsideSdd,
} from "../../scripts/visual/paths.mjs";

// Guarda dos caminhos das ferramentas visuais (spec §5.1, regra 1): tudo sai em
// <git-common-dir>/sdd, inclusive numa worktree, e nada escapa dela.

describe("isInside", () => {
  it("aceita a própria pasta e o que está dentro", () => {
    expect(isInside("/repo/.git/sdd", "/repo/.git/sdd")).toBe(true);
    expect(isInside("/repo/.git/sdd", "/repo/.git/sdd/processo/a.png")).toBe(
      true,
    );
  });

  it("recusa a fuga por .., o absoluto fora e a pasta irmã de nome parecido", () => {
    expect(
      isInside("/repo/.git/sdd", "/repo/.git/sdd/../hooks/pre-commit"),
    ).toBe(false);
    expect(isInside("/repo/.git/sdd", "/repo/src/app/page.tsx")).toBe(false);
    expect(isInside("/repo/.git/sdd", "/repo/.git/sdd-outra/x")).toBe(false);
  });

  it("uma pasta que começa com dois pontos não é fuga", () => {
    expect(isInside("/repo/.git/sdd", "/repo/.git/sdd/..visual/x")).toBe(true);
  });

  it("no Windows, compara sem caixa e com as duas barras", () => {
    expect(
      isInside(
        "C:\\Users\\Dev\\repo\\.git\\sdd",
        "c:/users/dev/REPO/.git/SDD/processo/a.png",
      ),
    ).toBe(true);
    expect(
      isInside("C:/Users/Dev/repo/.git/sdd", "C:\\Users\\Dev\\repo\\src"),
    ).toBe(false);
    expect(isInside("C:\\repo\\.git\\sdd", "D:\\repo\\.git\\sdd\\x")).toBe(
      false,
    );
  });
});

describe("resolveInside", () => {
  it("resolve o relativo dentro da base", () => {
    expect(resolveInside("/repo/.git/sdd", "processo/pares")).toBe(
      "/repo/.git/sdd/processo/pares",
    );
    expect(resolveInside("/repo/.git/sdd", ".")).toBe("/repo/.git/sdd");
  });

  it("lança na fuga por .. e no absoluto fora, com a base e o relativo na mensagem", () => {
    expect(() => resolveInside("/repo/.git/sdd", "../../src")).toThrow(
      "fora de /repo/.git/sdd: ../../src",
    );
    expect(() => resolveInside("/repo/.git/sdd", "/etc/passwd")).toThrow(
      "fora de /repo/.git/sdd: /etc/passwd",
    );
  });

  it("no Windows, devolve com barra invertida e recusa a fuga", () => {
    expect(resolveInside("C:\\repo\\.git\\sdd", "processo/pares")).toBe(
      "C:\\repo\\.git\\sdd\\processo\\pares",
    );
    expect(() => resolveInside("C:\\repo\\.git\\sdd", "..\\..\\src")).toThrow(
      "fora de",
    );
  });
});

describe("caminhos pelo git (repositório temporário com worktree)", () => {
  const root = realpathSync.native(
    mkdtempSync(join(tmpdir(), "closery-paths-")),
  );
  const main = join(root, "main");
  const worktree = join(root, "wt");
  const git = (cwd: string, ...args: string[]) =>
    execFileSync(
      "git",
      ["-c", "user.name=Teste", "-c", "user.email=teste@example.com", ...args],
      { cwd, stdio: "ignore" },
    );

  beforeAll(() => {
    mkdirSync(main);
    git(main, "init", "-q");
    git(main, "commit", "-q", "--allow-empty", "-m", "inicio");
    git(main, "worktree", "add", "-q", worktree);
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    rmSync(root, { recursive: true, force: true });
  });

  it("sddDir é <git-common-dir>/sdd", () => {
    expect(sddDir(main)).toBe(join(gitCommonDir(main), "sdd"));
    expect(sddDir(main).endsWith(join(".git", "sdd"))).toBe(true);
  });

  it("numa worktree (onde .git é um arquivo), o sdd é o mesmo do repositório principal", () => {
    expect(statSync(join(worktree, ".git")).isFile()).toBe(true);
    expect(sddDir(worktree)).toBe(sddDir(main));
  });

  it("repoRoot é a raiz de cada árvore", () => {
    expect(repoRoot(worktree)).not.toBe(repoRoot(main));
    expect(isInside(root, repoRoot(worktree))).toBe(true);
  });

  it("fora de um repositório, lança com a pasta na mensagem", () => {
    const outside = join(root, "solto");
    mkdirSync(outside);
    vi.stubEnv("GIT_CEILING_DIRECTORIES", root);
    expect(() => gitCommonDir(outside)).toThrow(
      `não é um repositório git: ${outside}`,
    );
  });
});

describe("no repositório atual", () => {
  const scratch = sddPath("tmp-testes", `paths-${process.pid}-${Date.now()}`);

  afterEach(() => {
    rmSync(scratch, { recursive: true, force: true });
  });

  it("sddPath fica dentro do sdd e recusa a fuga", () => {
    expect(isInside(sddDir(), sddPath("processo", "pares"))).toBe(true);
    expect(sddPath()).toBe(sddDir());
    expect(() => sddPath("..", "hooks")).toThrow("fora de");
  });

  it("visualDbDir é <sdd>/visual-db, com os arquivos de sempre", () => {
    expect(visualDbDir()).toBe(join(sddDir(), VISUAL_DB_DIR));
    expect(VISUAL_DB_FILES).toEqual({
      world: "world.json",
      state: "state.json",
      avatars: "avatars.json",
      secret: "secret",
      data: "pgdata",
    });
  });

  it("assertInsideSdd devolve o absoluto e recusa o que está fora", () => {
    const inside = join(sddDir(), "x.json");
    expect(assertInsideSdd(inside)).toBe(inside);
    expect(() => assertInsideSdd(join(repoRoot(), "package.json"))).toThrow(
      "fora de .git/sdd",
    );
  });

  it("writeInsideSdd cria as pastas, e readJsonInsideSdd lê de volta", () => {
    const file = join(scratch, "a", "b.json");
    writeInsideSdd(file, JSON.stringify({ ok: 1 }));
    expect(readJsonInsideSdd(file)).toEqual({ ok: 1 });
  });

  it("writeInsideSdd recusa destino fora e não grava nada", () => {
    const outside = join(tmpdir(), `closery-fora-${process.pid}.txt`);
    expect(() => writeInsideSdd(outside, "x")).toThrow("fora de .git/sdd");
    expect(existsSync(outside)).toBe(false);
  });

  it("readJsonInsideSdd diz qual arquivo falta", () => {
    expect(() => readJsonInsideSdd(join(scratch, "nao-existe.json"))).toThrow(
      "arquivo ausente",
    );
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `bunx vitest run test/visual/paths.test.ts`
Expected: FAIL — o arquivo não carrega: o import `../../scripts/visual/paths.mjs` não existe.

- [ ] **Step 4: Implementar `scripts/visual/paths.mjs`**

```js
// Caminhos das ferramentas do processo visual (spec §5.1 e §5.2). Toda saída vai para
// <git-common-dir>/sdd, achado pelo próprio git: numa worktree o `.git` é um arquivo, então nada
// aqui monta caminho com um ".git/" fixo nem com new URL("../.."). isInside e resolveInside são
// puras (não tocam no disco); as outras chamam o git uma vez por pasta e guardam o resultado.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const VISUAL_DB_DIR = "visual-db";

/** Arquivos do banco visual, dentro de `<sdd>/visual-db/`. */
export const VISUAL_DB_FILES = Object.freeze({
  world: "world.json",
  state: "state.json",
  avatars: "avatars.json",
  secret: "secret",
  data: "pgdata",
});

// Caminho do Windows: "C:\…", "C:/…" (o que o git devolve) ou "\\servidor\…".
const WINDOWS_PATH = /^[a-zA-Z]:[\\/]|^\\\\/;

/**
 * O `path` que entende o caminho: o do Windows compara sem caixa e aceita as duas barras. Escolher
 * pela forma (e não pelo sistema) deixa o teste do Windows rodar no CI Linux.
 * @param {string} sample
 */
function flavorOf(sample) {
  return WINDOWS_PATH.test(sample) ? path.win32 : path.posix;
}

/**
 * `child` está dentro de `parent` (ou é ele)? Puro. No Windows, sem caixa (`C:\A` = `c:\a`).
 * @param {string} parent
 * @param {string} child
 * @returns {boolean}
 */
export function isInside(parent, child) {
  const p = flavorOf(parent);
  const rel = p.relative(p.resolve(parent), p.resolve(parent, child));
  if (rel === "") return true;
  if (p.isAbsolute(rel)) return false;
  return rel !== ".." && !rel.startsWith(`..${p.sep}`);
}

/**
 * Resolve `relative` a partir de `base` e recusa o que escapa dela (`..`, absoluto fora). Puro.
 * @param {string} base
 * @param {string} relative
 * @returns {string} caminho absoluto
 */
export function resolveInside(base, relative) {
  const p = flavorOf(base);
  const resolved = p.resolve(base, relative);
  if (!isInside(base, resolved)) {
    throw new Error(`fora de ${base}: ${relative}`);
  }
  return resolved;
}

/** @type {Map<string, string>} */
const gitCache = new Map();

/**
 * @param {string[]} args
 * @param {string} cwd
 * @returns {string}
 */
function git(args, cwd) {
  const key = `${cwd}\n${args.join(" ")}`;
  const cached = gitCache.get(key);
  if (cached !== undefined) return cached;
  let out;
  try {
    out = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    throw new Error(`não é um repositório git: ${cwd}`);
  }
  gitCache.set(key, out);
  return out;
}

/**
 * `git rev-parse --path-format=absolute --git-common-dir`: o `.git` de verdade, o mesmo em todas as
 * worktrees.
 * @param {string} [cwd]
 * @returns {string}
 */
export function gitCommonDir(cwd = process.cwd()) {
  return path.resolve(
    git(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd),
  );
}

/**
 * `git rev-parse --show-toplevel`: a raiz da árvore de trabalho (a da worktree, numa worktree).
 * @param {string} [cwd]
 * @returns {string}
 */
export function repoRoot(cwd = process.cwd()) {
  return path.resolve(git(["rev-parse", "--show-toplevel"], cwd));
}

/**
 * `<gitCommonDir>/sdd`: a pasta de tudo o que fica fora do git.
 * @param {string} [cwd]
 * @returns {string}
 */
export function sddDir(cwd = process.cwd()) {
  return path.join(gitCommonDir(cwd), "sdd");
}

/**
 * Um caminho dentro de `.git/sdd` (relativo a ela); lança se escapar.
 * @param {...string} parts
 * @returns {string}
 */
export function sddPath(...parts) {
  return resolveInside(sddDir(), path.join(...parts));
}

/**
 * Confere que o arquivo (absoluto, ou relativo à pasta atual) fica dentro de `.git/sdd`.
 * @param {string} file
 * @returns {string} o caminho absoluto
 */
export function assertInsideSdd(file) {
  const resolved = path.resolve(file);
  if (!isInside(sddDir(), resolved)) {
    throw new Error(`fora de .git/sdd: ${file}`);
  }
  return resolved;
}

/** @returns {string} `<sdd>/visual-db` */
export function visualDbDir() {
  return sddPath(VISUAL_DB_DIR);
}

/**
 * Grava dentro de `.git/sdd`, criando as pastas; fora dela lança e nada é gravado.
 * @param {string} file
 * @param {string | Uint8Array} content
 */
export function writeInsideSdd(file, content) {
  const target = assertInsideSdd(file);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

/**
 * Lê um JSON de dentro de `.git/sdd`.
 * @param {string} file
 * @returns {unknown}
 */
export function readJsonInsideSdd(file) {
  const target = assertInsideSdd(file);
  let text;
  try {
    text = readFileSync(target, "utf8");
  } catch {
    throw new Error(`arquivo ausente: ${target}`);
  }
  return JSON.parse(text);
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `bunx vitest run test/visual/paths.test.ts`
Expected: PASS, 17 testes. O `describe` do repositório temporário cria e apaga uma pasta em `os.tmpdir()`; o do
repositório atual grava e apaga `.git/sdd/tmp-testes/paths-<pid>-<agora>/` (fica só a pasta `tmp-testes` vazia).

- [ ] **Step 6: Escrever o teste das portas e dos argumentos**

`test/visual/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { INVITE_COOKIE } from "@/lib/auth/inviteCookie";
import { THEME_STORAGE_KEY as APP_THEME_STORAGE_KEY } from "@/lib/theme";
import {
  assertVisualBaseUrl,
  assertVisualDbUrl,
  FORBIDDEN_PORTS,
  fakeClientIp,
  MOBILE_MAX_WIDTH,
  parseCliArgs,
  parseSizes,
  THEME_STORAGE_KEY,
  VISUAL_APP_PORT,
  VISUAL_BASE_URL,
  VISUAL_DB_HOST,
  VISUAL_DB_PORT,
  VISUAL_DB_URL,
  VISUAL_INVITE_COOKIE,
} from "../../scripts/visual/config.mjs";

// Guarda das portas e dos argumentos das ferramentas visuais (spec §5.1, regra 3):
// banco 54332, app 3202, e nunca as portas dos outros.

function messageOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "";
}

describe("portas e URLs", () => {
  it("o banco é 127.0.0.1:54332 e o app, a 3202, fora das portas proibidas", () => {
    expect(VISUAL_DB_HOST).toBe("127.0.0.1");
    expect(VISUAL_DB_PORT).toBe(54332);
    expect(VISUAL_APP_PORT).toBe(3202);
    expect(FORBIDDEN_PORTS).toEqual([3000, 3200, 3201, 54329, 54331]);
    expect(FORBIDDEN_PORTS).not.toContain(VISUAL_DB_PORT);
    expect(FORBIDDEN_PORTS).not.toContain(VISUAL_APP_PORT);
  });

  it("as URLs padrão passam na própria conferência", () => {
    expect(assertVisualDbUrl(VISUAL_DB_URL)).toBe(VISUAL_DB_URL);
    expect(assertVisualBaseUrl(VISUAL_BASE_URL)).toBe(VISUAL_BASE_URL);
    expect(assertVisualBaseUrl("http://127.0.0.1:3202/")).toBe(
      "http://127.0.0.1:3202/",
    );
  });

  it.each([
    ...FORBIDDEN_PORTS,
  ])("recusa o banco e o app na porta %i", (port) => {
    expect(() =>
      assertVisualDbUrl(
        `postgres://postgres:postgres@127.0.0.1:${port}/postgres`,
      ),
    ).toThrow("banco visual recusado");
    expect(() => assertVisualBaseUrl(`http://localhost:${port}`)).toThrow(
      "app visual recusado",
    );
  });

  it("recusa outro host, outro protocolo, sem porta e lixo, sem mostrar a senha", () => {
    const remote =
      "postgres://dono:segredo-de-teste@ep-exemplo.neon.tech:5432/neondb";
    const message = messageOf(() => assertVisualDbUrl(remote));
    expect(message).toContain("banco visual recusado");
    expect(message).not.toContain("segredo-de-teste");
    expect(() =>
      assertVisualDbUrl(
        "postgres://postgres:postgres@localhost:54332/postgres",
      ),
    ).toThrow("só 127.0.0.1:54332");
    expect(() => assertVisualDbUrl("mysql://root@127.0.0.1:54332/x")).toThrow(
      "protocolo mysql:",
    );
    expect(() =>
      assertVisualDbUrl("postgres://postgres@127.0.0.1/postgres"),
    ).toThrow("sem porta");
    expect(() => assertVisualDbUrl("não é url")).toThrow("URL inválida");
    expect(() => assertVisualBaseUrl("https://localhost:3202")).toThrow(
      "app visual recusado",
    );
    expect(() => assertVisualBaseUrl("http://exemplo.com:3202")).toThrow(
      "app visual recusado",
    );
    expect(() => assertVisualBaseUrl("http://localhost")).toThrow(
      "app visual recusado",
    );
  });

  it("a chave do tema e o cookie do convite são os mesmos do app", () => {
    expect(THEME_STORAGE_KEY).toBe(APP_THEME_STORAGE_KEY);
    expect(VISUAL_INVITE_COOKIE).toBe(INVITE_COOKIE);
  });

  it("celular é até 859px", () => {
    expect(MOBILE_MAX_WIDTH).toBe(859);
  });
});

describe("parseCliArgs", () => {
  it("separa as flags dos posicionais, na ordem", () => {
    expect(
      parseCliArgs(["admin", "--out=processo", "--all", "--sufixo=", "390"]),
    ).toEqual({
      flags: { out: "processo", all: true, sufixo: "" },
      positional: ["admin", "390"],
    });
  });

  it("o valor pode ter '=' (corta só no primeiro)", () => {
    expect(parseCliArgs(["--expr=a=b"]).flags).toEqual({ expr: "a=b" });
  });

  it("sem argumento, nada", () => {
    expect(parseCliArgs([])).toEqual({ flags: {}, positional: [] });
  });

  it("lança em nome inválido e em flag repetida", () => {
    expect(() => parseCliArgs(["--"])).toThrow("argumento inválido: --");
    expect(() => parseCliArgs(["--=x"])).toThrow("argumento inválido");
    expect(() => parseCliArgs(["---x"])).toThrow("argumento inválido");
    expect(() => parseCliArgs(["--__proto__=1"])).toThrow("argumento inválido");
    expect(() => parseCliArgs(["--out=a", "--out=b"])).toThrow(
      "argumento repetido: --out",
    );
  });
});

describe("parseSizes", () => {
  it("sem valor, uma cópia do padrão", () => {
    const fallback = [1440, 390];
    const sizes = parseSizes(undefined, fallback);
    expect(sizes).toEqual([1440, 390]);
    expect(sizes).not.toBe(fallback);
  });

  it("lê a lista, com espaços, até o máximo de 3840", () => {
    expect(parseSizes("1440,390", [])).toEqual([1440, 390]);
    expect(parseSizes(" 820 ", [])).toEqual([820]);
    expect(parseSizes("3840", [])).toEqual([3840]);
  });

  it("lança em vazio, zero, negativo, não inteiro, acima do máximo e buraco na lista", () => {
    expect(() => parseSizes("", [])).toThrow("tamanhos vazios");
    expect(() => parseSizes(" , ", [])).toThrow("tamanhos vazios");
    expect(() => parseSizes("0", [])).toThrow("tamanho inválido: 0");
    expect(() => parseSizes("-390", [])).toThrow('tamanho inválido: "-390"');
    expect(() => parseSizes("1.5", [])).toThrow('tamanho inválido: "1.5"');
    expect(() => parseSizes("3841", [])).toThrow("máximo 3840");
    expect(() => parseSizes("1440,,390", [])).toThrow('tamanho inválido: ""');
  });
});

describe("fakeClientIp", () => {
  it("monta 10.77.<a>.<b>, sem .0 no fim", () => {
    expect(fakeClientIp(0)).toBe("10.77.0.1");
    expect(fakeClientIp(253)).toBe("10.77.0.254");
    expect(fakeClientIp(254)).toBe("10.77.1.1");
    expect(fakeClientIp(65023)).toBe("10.77.255.254");
  });

  it("é diferente para cada n", () => {
    const ips = new Set(
      Array.from({ length: 1000 }, (_, n) => fakeClientIp(n)),
    );
    expect(ips.size).toBe(1000);
  });

  it("lança fora de 0..65023 e em não inteiro", () => {
    expect(() => fakeClientIp(-1)).toThrow("fakeClientIp");
    expect(() => fakeClientIp(1.5)).toThrow("fakeClientIp");
    expect(() => fakeClientIp(65024)).toThrow("fakeClientIp");
  });
});
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `bunx vitest run test/visual/config.test.ts`
Expected: FAIL — o arquivo não carrega: o import `../../scripts/visual/config.mjs` não existe.

- [ ] **Step 8: Implementar `scripts/visual/config.mjs`**

```js
// Portas, URLs e argumentos das ferramentas do processo visual (spec §5.1, regra 3). Puro: nada aqui
// lê o disco, a rede ou o ambiente. O banco visual é o PGlite da 54332 e o app, o `next` da 3202. As
// portas de FORBIDDEN_PORTS são de outros: 3000 de outro projeto, 3200/54329 do E2E, 3201/54331 do dono.

export const VISUAL_DB_HOST = "127.0.0.1";
export const VISUAL_DB_PORT = 54332;
export const VISUAL_APP_PORT = 3202;
export const VISUAL_DB_URL =
  "postgres://postgres:postgres@127.0.0.1:54332/postgres";
export const VISUAL_BASE_URL = "http://localhost:3202";
export const FORBIDDEN_PORTS = Object.freeze([3000, 3200, 3201, 54329, 54331]);
/** Igual a THEME_STORAGE_KEY de src/lib/theme.ts (test/visual/config.test.ts confere). */
export const THEME_STORAGE_KEY = "closery-tema";
/** Igual a INVITE_COOKIE de src/lib/auth/inviteCookie.ts (test/visual/config.test.ts confere). */
export const VISUAL_INVITE_COOKIE = "closery_invite";
/** "Celular" é abaixo de 860px (Global Constraints). */
export const MOBILE_MAX_WIDTH = 859;

const MAX_SIZE = 3840;
const IP_SPACE = 254 * 256;

/**
 * @param {string} url
 * @param {string} label
 * @returns {URL}
 */
function parseUrl(url, label) {
  try {
    return new URL(url);
  } catch {
    throw new Error(`${label} recusado: URL inválida`);
  }
}

/**
 * Confere a URL do banco visual: só `postgres://…@127.0.0.1:54332`. A mensagem nunca traz a senha.
 * @param {string} url
 * @returns {string} a própria URL
 */
export function assertVisualDbUrl(url) {
  const parsed = parseUrl(url, "banco visual");
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error(`banco visual recusado: protocolo ${parsed.protocol}`);
  }
  if (
    parsed.hostname !== VISUAL_DB_HOST ||
    parsed.port !== String(VISUAL_DB_PORT)
  ) {
    const where = `${parsed.hostname}:${parsed.port || "(sem porta)"}`;
    throw new Error(
      `banco visual recusado: ${where} (só ${VISUAL_DB_HOST}:${VISUAL_DB_PORT})`,
    );
  }
  return url;
}

/**
 * Confere a URL do app visual: `http://localhost:3202` ou `http://127.0.0.1:3202`.
 * @param {string} url
 * @returns {string} a própria URL
 */
export function assertVisualBaseUrl(url) {
  const parsed = parseUrl(url, "app visual");
  const localHost =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (
    parsed.protocol !== "http:" ||
    !localHost ||
    parsed.port !== String(VISUAL_APP_PORT)
  ) {
    throw new Error(
      `app visual recusado: ${parsed.origin} (só http://localhost:${VISUAL_APP_PORT})`,
    );
  }
  return url;
}

/**
 * `--nome=valor` vira `flags.nome = "valor"`, `--nome` vira `true`; o resto é posicional, na ordem.
 * Lança em nome inválido (`--`, `--=x`) e em argumento repetido.
 * @param {readonly string[]} argv
 * @returns {{ flags: Record<string, string | true>, positional: string[] }}
 */
export function parseCliArgs(argv) {
  /** @type {Record<string, string | true>} */
  const flags = {};
  /** @type {string[]} */
  const positional = [];
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }
    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
    if (!/^[a-z][a-z0-9-]*$/i.test(name)) {
      throw new Error(`argumento inválido: ${arg}`);
    }
    if (Object.hasOwn(flags, name)) {
      throw new Error(`argumento repetido: --${name}`);
    }
    flags[name] = eq === -1 ? true : arg.slice(eq + 1);
  }
  return { flags, positional };
}

/**
 * Tamanhos separados por vírgula ("1440,390" → [1440, 390]); sem valor, uma cópia do padrão.
 * Lança em lista vazia, zero, negativo, não inteiro e acima de 3840.
 * @param {string | undefined} value
 * @param {readonly number[]} fallback
 * @returns {number[]}
 */
export function parseSizes(value, fallback) {
  if (value === undefined) return [...fallback];
  const parts = String(value)
    .split(",")
    .map((part) => part.trim());
  if (parts.every((part) => part === "")) {
    throw new Error("tamanhos vazios");
  }
  return parts.map((part) => {
    if (!/^\d+$/.test(part)) {
      throw new Error(`tamanho inválido: "${part}" (inteiro positivo)`);
    }
    const size = Number(part);
    if (size === 0) {
      throw new Error("tamanho inválido: 0 (inteiro positivo)");
    }
    if (size > MAX_SIZE) {
      throw new Error(`tamanho inválido: ${size} (máximo ${MAX_SIZE})`);
    }
    return size;
  });
}

/**
 * IP fictício para o `x-forwarded-for` do login e do cadastro (o rate limit do Better Auth é por
 * IP): "10.77.<a>.<b>", um diferente para cada `n` de 0 a 65023.
 * @param {number} n
 * @returns {string}
 */
export function fakeClientIp(n) {
  if (!Number.isInteger(n) || n < 0 || n >= IP_SPACE) {
    throw new RangeError(`fakeClientIp: n fora de 0..${IP_SPACE - 1}: ${n}`);
  }
  return `10.77.${Math.floor(n / 254)}.${(n % 254) + 1}`;
}
```

- [ ] **Step 9: Rodar e ver passar**

Run: `bunx vitest run test/visual/config.test.ts`
Expected: PASS, 20 testes (15 + os 5 do `it.each` das portas proibidas).

- [ ] **Step 10: Escrever o teste do vocabulário**

`test/visual/vocabulary.test.ts` (o caso "com a lista de nomes presente" entra na Task 6, Step 18 do R3, quando o
`names.mjs` existe):

```ts
import { describe, expect, it } from "vitest";

import { SECTOR_COLORS } from "@/features/sectors/colors";
import { REQUEST_STATUSES } from "@/lib/requestStatuses";
import {
  VISUAL_DESTINATIONS,
  VISUAL_ITEMS,
  VISUAL_PASSWORD,
  VISUAL_PEOPLE,
  VISUAL_SECTORS,
  VISUAL_SHIFTS,
  VISUAL_TEXTS,
} from "../../scripts/visual/vocabulary.mjs";

// Guarda do vocabulário inventado do mundo visual (spec §5.4): só pessoas fictícias,
// @example.com, cores da paleta e nada repetido.

/** Todos os textos do vocabulário, para conferir que nenhum está vazio. */
function allStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (value && typeof value === "object") {
    return Object.values(value).flatMap((inner) => allStrings(inner));
  }
  return [];
}

const VOCABULARY = {
  VISUAL_PEOPLE,
  VISUAL_PASSWORD,
  VISUAL_SECTORS,
  VISUAL_SHIFTS,
  VISUAL_ITEMS,
  VISUAL_DESTINATIONS,
  VISUAL_TEXTS,
};

describe("pessoas", () => {
  it("são as quatro fictícias: a Ana admin e três operadores", () => {
    expect(Object.keys(VISUAL_PEOPLE)).toEqual([
      "ana",
      "bruno",
      "carla",
      "diego",
    ]);
    expect(VISUAL_PEOPLE.ana.role).toBe("admin");
    for (const key of ["bruno", "carla", "diego"] as const) {
      expect(VISUAL_PEOPLE[key].role).toBe("operator");
    }
  });

  it("e-mail <nome>.teste@example.com e nome terminado em ' Teste', sem repetir", () => {
    const people = Object.entries(VISUAL_PEOPLE);
    for (const [key, person] of people) {
      expect(person.email).toBe(`${key}.teste@example.com`);
      expect(person.name.endsWith(" Teste")).toBe(true);
    }
    expect(new Set(people.map(([, p]) => p.email)).size).toBe(4);
    expect(new Set(people.map(([, p]) => p.name)).size).toBe(4);
  });

  it("a senha é a do E2E", () => {
    expect(VISUAL_PASSWORD).toBe("senha-de-teste-123");
  });
});

describe("setores, turnos, itens e destinos", () => {
  it("quatro setores com cor da paleta, sem repetir nome nem cor", () => {
    expect(VISUAL_SECTORS.map((s) => s.name)).toEqual([
      "ULD",
      "Carga",
      "Operações",
      "Rampa",
    ]);
    for (const sector of VISUAL_SECTORS) {
      expect(SECTOR_COLORS).toContain(sector.color);
    }
    expect(new Set(VISUAL_SECTORS.map((s) => s.color)).size).toBe(4);
  });

  it("em ordem alfabética, o ULD continua o quarto", () => {
    const sorted = VISUAL_SECTORS.map((s) => s.name).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
    expect(sorted.indexOf("ULD")).toBe(3);
  });

  it("três turnos com HH:MM válido; o 3 atravessa a meia-noite", () => {
    expect(VISUAL_SHIFTS.map((s) => s.name)).toEqual([
      "Turno 1",
      "Turno 2",
      "Turno 3",
    ]);
    for (const turn of VISUAL_SHIFTS) {
      expect(turn.startsAt).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      expect(turn.endsAt).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
    }
    const last = VISUAL_SHIFTS[2];
    expect(last && last.endsAt < last.startsAt).toBe(true);
  });

  it("nove itens, um grupo por setor, sem repetir dentro do setor; o Stretch é do ULD", () => {
    expect(Object.keys(VISUAL_ITEMS)).toEqual(
      VISUAL_SECTORS.map((s) => s.name),
    );
    const items = Object.values(VISUAL_ITEMS);
    expect(items.flat()).toHaveLength(9);
    for (const group of items) expect(new Set(group).size).toBe(group.length);
    expect(VISUAL_ITEMS.ULD).toContain("Stretch");
  });

  it("cinco destinos sem repetir; todo destino dos textos existe", () => {
    expect(VISUAL_DESTINATIONS).toHaveLength(5);
    expect(new Set(VISUAL_DESTINATIONS).size).toBe(5);
    const used = [
      ...VISUAL_TEXTS.staleRequests.map((r) => r.destination),
      VISUAL_TEXTS.recentRequests.destination,
      ...VISUAL_TEXTS.historyRequests.map((r) => r.destination),
    ];
    for (const destination of used)
      expect(VISUAL_DESTINATIONS).toContain(destination);
  });
});

describe("textos", () => {
  it("três paradas e cinco do histórico, com status válidos e uma cancelada", () => {
    expect(VISUAL_TEXTS.staleRequests).toHaveLength(3);
    expect(VISUAL_TEXTS.historyRequests).toHaveLength(5);
    for (const entry of VISUAL_TEXTS.historyRequests) {
      expect(REQUEST_STATUSES).toContain(entry.status);
    }
    expect(
      VISUAL_TEXTS.historyRequests.filter((r) => r.status === "cancelled"),
    ).toHaveLength(1);
    expect(VISUAL_TEXTS.recentRequests.descriptionPrefix).toBe(
      "Pedido recente",
    );
  });

  it("a correção vai do texto antigo para o de ocorrências, que são diferentes", () => {
    expect(VISUAL_TEXTS.history.correctionOld).not.toBe(
      VISUAL_TEXTS.history.occurrences,
    );
  });

  it("nenhum texto vazio nem só de espaços", () => {
    const strings = allStrings(VOCABULARY);
    expect(strings.length).toBeGreaterThan(40);
    for (const text of strings) expect(text.trim()).not.toBe("");
  });

  it("é imutável", () => {
    expect(Object.isFrozen(VISUAL_PEOPLE)).toBe(true);
    expect(Object.isFrozen(VISUAL_PEOPLE.ana)).toBe(true);
    expect(Object.isFrozen(VISUAL_ITEMS.ULD)).toBe(true);
    expect(Object.isFrozen(VISUAL_TEXTS.staleRequests[0])).toBe(true);
  });
});
```

- [ ] **Step 11: Rodar e ver falhar**

Run: `bunx vitest run test/visual/vocabulary.test.ts`
Expected: FAIL — o arquivo não carrega: o import `../../scripts/visual/vocabulary.mjs` não existe.

- [ ] **Step 12: Implementar `scripts/visual/vocabulary.mjs`**

Os valores são exatamente os da spec §5.4 (nenhum vem de protótipo, de screenshot nem do seed antigo):

```js
// O mundo visual inventado (spec §5.4): as pessoas, a senha de teste e os textos que o seed grava e
// que as cópias do protótipo recebem no lugar dos originais. É a única fonte: com o mesmo texto dos
// dois lados, o pixel compara igual com igual. Nada aqui vem de protótipo nem de screenshot.

/** @typedef {"ana" | "bruno" | "carla" | "diego"} VisualPersonKey */
/** @typedef {{ name: string, email: string, role: "admin" | "operator" }} VisualPerson */
/** @typedef {"lilac" | "peach" | "sky" | "green" | "pink"} VisualSectorColor */
/** @typedef {{ name: string, color: VisualSectorColor }} VisualSector */
/** @typedef {{ name: string, startsAt: string, endsAt: string }} VisualShift */
/** @typedef {{ destination: string, description: string }} VisualRequestText */
/** @typedef {{ destination: string, description: string, status: "delivered" | "cancelled" | "in_transit" }} VisualHistoryRequest */
/**
 * @typedef {Object} VisualTexts
 * @property {string} pendingNextShift
 * @property {readonly VisualRequestText[]} staleRequests
 * @property {{ destination: string, descriptionPrefix: string }} recentRequests
 * @property {{ occurrences: string, nextShift: string, note: string, correctionOld: string, correctionReason: string }} history
 * @property {readonly VisualHistoryRequest[]} historyRequests
 * @property {string} cancelReason
 */

/**
 * Congela o objeto e tudo dentro dele.
 * @template T
 * @param {T} value
 * @returns {T}
 */
function freeze(value) {
  if (value && typeof value === "object") {
    for (const inner of Object.values(value)) freeze(inner);
    Object.freeze(value);
  }
  return value;
}

/** @type {Readonly<Record<VisualPersonKey, Readonly<VisualPerson>>>} */
export const VISUAL_PEOPLE = freeze({
  ana: { name: "Ana Teste", email: "ana.teste@example.com", role: "admin" },
  bruno: {
    name: "Bruno Teste",
    email: "bruno.teste@example.com",
    role: "operator",
  },
  carla: {
    name: "Carla Teste",
    email: "carla.teste@example.com",
    role: "operator",
  },
  diego: {
    name: "Diego Teste",
    email: "diego.teste@example.com",
    role: "operator",
  },
});

/** A senha das quatro pessoas: a mesma do E2E (e2e/helpers.ts). */
export const VISUAL_PASSWORD = "senha-de-teste-123";

/** @type {readonly Readonly<VisualSector>[]} */
export const VISUAL_SECTORS = freeze([
  { name: "ULD", color: "lilac" },
  { name: "Carga", color: "peach" },
  { name: "Operações", color: "sky" },
  { name: "Rampa", color: "green" },
]);

/** Os mesmos três turnos em cada setor. @type {readonly Readonly<VisualShift>[]} */
export const VISUAL_SHIFTS = freeze([
  { name: "Turno 1", startsAt: "06:00", endsAt: "14:00" },
  { name: "Turno 2", startsAt: "14:00", endsAt: "22:00" },
  { name: "Turno 3", startsAt: "22:00", endsAt: "06:00" },
]);

/** Itens por setor: todos `control`, unidade `unidade` (no estado rico o Stretch vira `stock` em `rolo`). @type {Readonly<Record<string, readonly string[]>>} */
export const VISUAL_ITEMS = freeze({
  ULD: ["Rede de proteção", "Stretch", "Cinta azul"],
  Carga: ["Palete", "Capa plástica"],
  Operações: ["Cone", "Rádio"],
  Rampa: ["Calço", "Etiqueta"],
});

/** @type {readonly string[]} */
export const VISUAL_DESTINATIONS = freeze([
  "Doca Norte",
  "Doca Sul",
  "Armazém 3",
  "Terminal B",
  "Box 7",
]);

/** @type {Readonly<VisualTexts>} */
export const VISUAL_TEXTS = freeze({
  pendingNextShift:
    "Conferir as duas ULDs da doca norte no começo do turno.\nCapa da posição 6 separada para troca.",
  // Na ordem do seed: solicitada há 4 dias e 2 h; em trânsito (criada há 5 dias, mudou há 3 dias e
  // 5 h); solicitada há 3 dias e 1 h.
  staleRequests: [
    { destination: "Doca Norte", description: "Capas novas para a doca norte" },
    { destination: "Doca Sul", description: "Reposição de cintas azuis" },
    { destination: "Armazém 3", description: "Calços de borracha, 2 caixas" },
  ],
  // "Pedido recente 1" a "Pedido recente 4", criadas há 1 a 4 h.
  recentRequests: {
    destination: "Terminal B",
    descriptionPrefix: "Pedido recente",
  },
  history: {
    occurrences: "Rampa parada por 40 minutos por causa do vento.",
    nextShift: "Conferir as capas da posição 6.\nRepor stretch no box 2.",
    note: "Uma com defeito",
    correctionOld: "Rampa parada.",
    correctionReason: "Faltou o tempo de parada",
  },
  historyRequests: [
    {
      destination: "Doca Norte",
      description: "Cintas azuis, 3 caixas",
      status: "delivered",
    },
    {
      destination: "Doca Sul",
      description: "Capas novas para o box 1",
      status: "delivered",
    },
    {
      destination: "Box 7",
      description: "Calços extras (duplicado)",
      status: "cancelled",
    },
    {
      destination: "Armazém 3",
      description: "Etiquetas de teste",
      status: "in_transit",
    },
    {
      destination: "Terminal B",
      description: "Sacos de teste, 1 fardo",
      status: "delivered",
    },
  ],
  cancelReason: "Pedido duplicado",
});
```

- [ ] **Step 13: Rodar e ver passar**

Run: `bunx vitest run test/visual/vocabulary.test.ts`
Expected: PASS, 12 testes.

- [ ] **Step 14: `library-docs.md` §21**

Edit em `.context/library-docs.md`: `old_string` = `## Como adicionar uma biblioteca nova` (a linha do título, única no
arquivo); `new_string` = o bloco abaixo, uma linha em branco e a mesma linha do título.

```md
## 21. `pixelmatch` 7.2.0 + `pngjs` 7.0.0 · processo visual

- **Versões exatas, sem `^`, só em `devDependencies`** (`bun add -d -E pixelmatch@7.2.0 pngjs@7.0.0`). São as mesmas das
  ferramentas do PR A, com que os números do `pixel.md` do Início foram medidos: trocar de versão exige rerodar os pares do
  Início (`bun run visual:pairs --screen=inicio`) e comparar com eles.
- **Só em `scripts/visual/` e nos testes dele** (`test/visual/`). Nunca em `src/`: nada disso entra no bundle do app.
- **API (conferida no `node_modules` em 2026-11-27):** `import pixelmatch from "pixelmatch"` (ESM, com tipos próprios) e
  `import { PNG } from "pngjs"` (CommonJS, sem `@types`). `pixelmatch(a.data, b.data, saida.data, largura, altura, { threshold })`
  devolve o número de pixels diferentes e **lança** se as duas imagens não têm o mesmo tamanho: quem chama recorta antes
  (`cropTo` de `scripts/visual/image.mjs`). `PNG.sync.read`/`PNG.sync.write` leem e gravam; `PNG.bitblt` recorta;
  `new PNG({ width, height })` nasce transparente (`createPng` preenche).
- **Threshold 0.1** (`PIXELMATCH_THRESHOLD` em `diff.mjs`), com os padrões da biblioteca para o anti-aliasing
  (`includeAA: false`: o pixel de anti-aliasing detectado não conta). É o mesmo de todos os números desde o PR A.
- **Testes:** os `.ts` de `test/visual/` **não importam** `pngjs` nem `pixelmatch` (sem `@types` no `pngjs`, o `tsc` reprovaria):
  montam as imagens com `createPng` e medem com `diffImages`/`regionDiff`. Nada disso roda no CI além desses testes puros
  (sem navegador, rede, servidor nem a lista de nomes).
```

Conferir: `grep -n "^## " .context/library-docs.md` lista `## 20.`, `## 21.` e `## Como adicionar uma biblioteca nova`, nessa
ordem.

- [ ] **Step 15: Formatar, tipos, lint e os testes tocados**

Run: `bunx biome check --write scripts/visual test/visual`
Expected: termina sem erro (pode dizer que corrigiu formatação ou a ordem dos imports).
Run: `bun run check-types`
Expected: sai com 0, sem erro (o `tsc` lê os `.mjs` pelo `allowJs` e usa os tipos do JSDoc; os testes não importam
`pngjs`).
Run: `bun run lint`
Expected: sai com 0.
Run: `bunx vitest run test/visual/paths.test.ts test/visual/config.test.ts test/visual/vocabulary.test.ts`
Expected: PASS, 3 arquivos, 49 testes.

- [ ] **Step 16: Commit**

Mensagem gravada com Write em `.git/sdd/processo/msg-task-4.txt`:

```text
chore(visual): base das ferramentas (caminhos, portas, vocabulário, pixelmatch e pngjs)

scripts/visual/paths.mjs acha o .git/sdd pelo git rev-parse --git-common-dir
(vale em worktree) e recusa destino fora dele; config.mjs fixa o banco
visual na 54332 e o app na 3202 e recusa as portas dos outros; vocabulary.mjs
é o mundo visual inventado da spec §5.4. pixelmatch 7.2.0 e pngjs 7.0.0
exatas, só em devDependencies (library-docs §21). Testes em test/visual/.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run: `git add package.json bun.lock .context/library-docs.md scripts/visual/paths.mjs scripts/visual/config.mjs scripts/visual/vocabulary.mjs test/visual/paths.test.ts test/visual/config.test.ts test/visual/vocabulary.test.ts && git commit -F .git/sdd/processo/msg-task-4.txt`
Expected: um commit com 9 arquivos; `git status` limpo.

---

### Task 5: Banco, ambiente, pessoas e seed visual

**Spec:** §5.3, §5.4, §5.7 · **Redator:** R2 · **Depende de:** T4

**Files:**
- Create: `scripts/visual/seed/avatarArt.ts`
- Create: `scripts/visual/seed/world.ts`
- Create: `scripts/visual/seed/states/inicio.ts`
- Create: `scripts/visual/seed/states/geral.ts`
- Create: `scripts/visual/seed/states/index.ts`
- Create: `scripts/visual/seed/index.ts` (CLI, bun)
- Create: `scripts/visual/env.sh`
- Create: `scripts/visual/people.mjs` (CLI, node)
- Create: `scripts/visual/db.ts` (CLI, bun)
- Modify: `package.json` (`scripts`: `visual:db`, `visual:seed`, `visual:people`)
- Test: `test/visual/avatarArt.test.ts`
- Test: `test/visual/seed.test.ts`
- Test: `test/visual/envScript.test.ts`
- Test: `test/visual/people.test.ts` (fora da lista do contrato: o `signUpOutcome` do `people.mjs` é puro e ganha teste,
  regra 5 da spec §5.1; ver "Decisões tomadas na montagem do plano")

**Interfaces:**
- Consumes (T4): `VISUAL_DB_URL`, `VISUAL_DB_HOST`, `VISUAL_DB_PORT`, `VISUAL_BASE_URL`, `VISUAL_INVITE_COOKIE`,
  `assertVisualDbUrl`, `assertVisualBaseUrl`, `parseCliArgs`, `fakeClientIp` (`config.mjs`); `VISUAL_DB_DIR`,
  `VISUAL_DB_FILES`, `visualDbDir`, `repoRoot`, `writeInsideSdd`, `readJsonInsideSdd` (`paths.mjs`); `VISUAL_PEOPLE`,
  `VISUAL_PASSWORD`, `VISUAL_SECTORS`, `VISUAL_SHIFTS`, `VISUAL_ITEMS`, `VISUAL_DESTINATIONS`, `VISUAL_TEXTS`
  (`vocabulary.mjs`). Do app: `test/fixtures.ts` (`insertSector`, `insertShift`, `insertItem`, `insertDestination`,
  `insertInvite`, `insertHandover`, `insertHandoverItem`, `insertHandoverCorrection`, `insertRequest`), `suggestShift`
  (`src/features/handovers/shiftSuggestion.ts`), `addDays`, `saoPauloParts`, `todayInSaoPaulo`
  (`src/features/handovers/saoPaulo.ts`), `createDb`/`createPool` (`src/db/client.ts`).
- Produces (nomes do contrato):
  - `seed/world.ts`: `type SeedDb = Parameters<typeof insertSector>[0]`, `type PersonKey = keyof typeof VISUAL_PEOPLE`,
    `type WorldFile = { sectors: Record<string, string>; invites: Record<PersonKey, string> }`,
    `seedBase(db): Promise<WorldFile>`, `resetVariable(db): Promise<void>`, `sectorIdByName(db, name): Promise<string>`
    (lança `"setor <nome> não existe"`), `userIdByEmail(db, email): Promise<string>`,
    `destinationIdByName(db, name): Promise<string>`, `saoPauloAt(hhmm, now?): Date`,
    `saoPauloDate(now, offsetDays?): string`. A mais: `DEFAULT_SECTOR = "ULD"`.
  - `seed/states/index.ts`: `type StateContext = { sector: string; now: Date }`,
    `type StateSeeder = (db: SeedDb, ctx: StateContext) => Promise<void>`, `type StateFile = { state, sector, sectorId,
    sectors, users, at }`, `STATES: Record<string, StateSeeder>` ("inicio:admin" … "inicio:sem-turnos", "geral:rico"),
    `seedState(db, name, options?): Promise<StateFile>` (lança `"estado desconhecido: <nome>"`; confere estado, setor e
    pessoas antes de zerar; `resetVariable` + seeder numa transação).
  - `seed/states/inicio.ts`: `INICIO_STATES: Record<"admin" | "primeiro" | "continuar" | "entregue" | "confirmada" |
    "sem-turnos", StateSeeder>`. A mais (o `geral.ts` reaproveita): `suggestedTarget`, `seedPendingFromBruno`,
    `seedStaleRequests`.
  - `seed/states/geral.ts`: `GERAL_STATES: Record<"rico", StateSeeder>`.
  - `seed/avatarArt.ts`: `visualAvatarUri(seed): string`.
  - `people.mjs`: CLI; a mais, `signUpOutcome(status, body): "ok" | "existe" | "falhou"`.
  - `package.json`: `visual:db`, `visual:seed`, `visual:people`.

Notas de porte (do `.git/sdd/visual/tools/`, só a lógica):
- `seed.ts` → `world.ts` + `states/*`: o mesmo mundo e os mesmos estados, com o vocabulário da §5.4, o quarto setor
  **Rampa** e as datas relativas ao `ctx.now` (o antigo fixava o dia e usava o dia UTC). A pendente ocupa o primeiro turno
  ativo que não é o sugerido, de **ontem**; o histórico do rico pula exatamente o turno sugerido e o da pendente (o antigo
  pulava "o terceiro turno de ontem" e engolia o conflito com `.catch`). O `resetVariable` também devolve os itens a
  `control`/`unidade` (o rico deixava o Stretch em `rolo` para os estados seguintes).
- `start-db-pixel.ts` → `db.ts`: pasta por `visualDbDir()`, migrações por `repoRoot()`, recusa de porta e o "já está de pé".
- `env-pixel.sh` → `env.sh`: `.git/sdd` pelo `git rev-parse`, segredo gerado com `node -e`, nunca impresso.
- `signup.mjs` → `people.mjs`: `fetch` do Node, `x-forwarded-for` por pessoa, "já existe" como sucesso.
- `avatars.ts` → `seed/avatarArt.ts` + o comando `avatars` do CLI (os ids vêm do banco pelos e-mails, não do `ids.json`).

- [ ] **Step 1: Escrever o teste da arte dos avatares**

`test/visual/avatarArt.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { avatarDataUri } from "@/lib/avatar";
import { visualAvatarUri } from "../../scripts/visual/seed/avatarArt";

// A arte das cópias do protótipo é a do app: mesma semente (o id do usuário), mesmo
// data URI. Se o src/lib/avatar.ts mudar de fundo ou de estilo, este teste reprova.

describe("visualAvatarUri", () => {
  it.each([
    "0d4f6f1c2a3b4c5d6e7f8091a2b3c4d5",
    "id-com-hifen",
    "X",
  ])("dá a mesma arte do app para a semente %s", (seed) => {
    expect(visualAvatarUri(seed)).toBe(avatarDataUri(seed));
  });

  it("sementes diferentes dão artes diferentes", () => {
    expect(visualAvatarUri("um")).not.toBe(visualAvatarUri("dois"));
  });

  it("é um data URI de SVG", () => {
    expect(visualAvatarUri("abc")).toMatch(/^data:image\/svg\+xml/);
  });

  it("semente vazia ou só de espaços lança, como no app", () => {
    expect(() => visualAvatarUri("")).toThrow("a semente não pode ser vazia");
    expect(() => visualAvatarUri("   ")).toThrow(
      "a semente não pode ser vazia",
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bunx vitest run test/visual/avatarArt.test.ts`
Expected: FAIL — o arquivo não carrega: o import `../../scripts/visual/seed/avatarArt` não existe.

- [ ] **Step 3: Implementar `scripts/visual/seed/avatarArt.ts`**

```ts
// A arte dos avatares para as cópias do protótipo (spec §5.3): a mesma do app (src/lib/avatar.ts),
// para a mesma semente (o id do usuário). O src/lib/avatar.ts é server-only e não roda no bun, então
// o mesmo DiceBear é montado aqui; test/visual/avatarArt.test.ts prova que as duas dão o mesmo data URI.
import { Avatar, Style } from "@dicebear/core";
import notionists from "@dicebear/styles/notionists.json" with { type: "json" };

// Iguais a AVATAR_BACKGROUNDS de src/lib/avatar.ts (dados da arte, não tokens de interface).
const BACKGROUNDS = ["#b6e3f4", "#ffdfbf", "#ffd5dc", "#d1d4f9"] as const;

const style = new Style(notionists);

export function visualAvatarUri(seed: string): string {
  if (seed.trim() === "") {
    throw new Error("visualAvatarUri: a semente não pode ser vazia");
  }
  return new Avatar(style, {
    seed,
    backgroundColor: [...BACKGROUNDS],
  }).toDataUri();
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bunx vitest run test/visual/avatarArt.test.ts`
Expected: PASS, 6 testes.

- [ ] **Step 5: Escrever o teste do seed**

`test/visual/seed.test.ts` (o PGlite dos testes; as quatro pessoas entram por `insertUser` com os e-mails de
`VISUAL_PEOPLE`; o agora é fixo, 12:00 de São Paulo, então o turno sugerido é o Turno 1 de hoje):

```ts
import type { PGlite } from "@electric-sql/pglite";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { user } from "@/db/schema/auth";
import { destination, item, shift } from "@/db/schema/catalog";
import { handover, handoverCorrection } from "@/db/schema/handovers";
import { invite } from "@/db/schema/invites";
import { request } from "@/db/schema/requests";
import { sector } from "@/db/schema/sectors";
import { STALE_AFTER_MS } from "@/features/requests/limits";
import { STATES, seedState } from "../../scripts/visual/seed/states/index";
import {
  type PersonKey,
  saoPauloAt,
  saoPauloDate,
  seedBase,
  type WorldFile,
} from "../../scripts/visual/seed/world";
import {
  VISUAL_PEOPLE,
  VISUAL_TEXTS,
} from "../../scripts/visual/vocabulary.mjs";
import { createTestDb, resetDb, type TestDb } from "../db";
import { insertUser } from "../fixtures";

// Guarda do seed visual (spec §5.4), no PGlite dos testes, com as quatro pessoas
// inseridas direto (o visual:people as cadastra pela API no ambiente de verdade).

// 12:00 de uma sexta em São Paulo: o turno sugerido é o Turno 1 de hoje (fim às 14:00).
const NOW = new Date("2026-11-27T15:00:00Z");

let client: PGlite;
let db: TestDb;
let world: WorldFile;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
  world = await seedBase(db);
  for (const key of Object.keys(VISUAL_PEOPLE) as PersonKey[]) {
    const person = VISUAL_PEOPLE[key];
    await insertUser(db, {
      role: person.role,
      sectorId: person.role === "admin" ? null : (world.sectors.ULD ?? null),
      name: person.name,
      email: person.email,
    });
  }
});

function sectorOf(name: string): string {
  const id = world.sectors[name];
  if (!id) throw new Error(`teste: setor ${name} ausente no world`);
  return id;
}

async function openRequests(sectorId: string) {
  return db
    .select({
      description: request.description,
      statusChangedAt: request.statusChangedAt,
    })
    .from(request)
    .where(
      and(
        eq(request.sectorId, sectorId),
        inArray(request.status, ["requested", "in_transit"]),
      ),
    );
}

describe("seedBase", () => {
  it("cria 4 setores, 12 turnos, 9 itens, 5 destinos e 4 convites", async () => {
    expect(await db.$count(sector)).toBe(4);
    expect(await db.$count(shift)).toBe(12);
    expect(await db.$count(item)).toBe(9);
    expect(await db.$count(destination)).toBe(5);
    expect(await db.$count(invite)).toBe(4);
    expect(Object.keys(world.sectors).sort()).toEqual([
      "Carga",
      "Operações",
      "Rampa",
      "ULD",
    ]);
  });

  it("um convite por pessoa: a Ana admin sem setor, os operadores no ULD", async () => {
    expect(Object.keys(world.invites)).toEqual([
      "ana",
      "bruno",
      "carla",
      "diego",
    ]);
    for (const token of Object.values(world.invites)) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
    const rows = await db
      .select({ role: invite.role, sectorId: invite.sectorId })
      .from(invite);
    expect(rows.filter((r) => r.role === "admin")).toEqual([
      { role: "admin", sectorId: null },
    ]);
    expect(
      rows.filter((r) => r.role === "operator").map((r) => r.sectorId),
    ).toEqual([sectorOf("ULD"), sectorOf("ULD"), sectorOf("ULD")]);
  });

  it("rodar de novo lança e não duplica nada", async () => {
    await expect(seedBase(db)).rejects.toThrow("o banco visual já tem setores");
    expect(await db.$count(sector)).toBe(4);
    expect(await db.$count(invite)).toBe(4);
  });
});

describe("seedState", () => {
  it("STATES tem os seis do Início e o rico", () => {
    expect(Object.keys(STATES).sort()).toEqual([
      "geral:rico",
      "inicio:admin",
      "inicio:confirmada",
      "inicio:continuar",
      "inicio:entregue",
      "inicio:primeiro",
      "inicio:sem-turnos",
    ]);
  });

  it("inicio:admin: 7 abertas, 3 paradas e a pendente do Bruno de ontem", async () => {
    const file = await seedState(db, "inicio:admin", { now: NOW });
    const uld = sectorOf("ULD");
    const open = await openRequests(uld);
    expect(open).toHaveLength(7);
    const stale = open.filter(
      (r) => r.statusChangedAt.getTime() <= NOW.getTime() - STALE_AFTER_MS,
    );
    expect(stale.map((r) => r.description).sort()).toEqual(
      VISUAL_TEXTS.staleRequests.map((r) => r.description).sort(),
    );
    const handovers = await db
      .select({
        status: handover.status,
        deliveredBy: handover.deliveredBy,
        operationalDate: handover.operationalDate,
        nextShiftText: handover.nextShiftText,
      })
      .from(handover);
    expect(handovers).toEqual([
      {
        status: "delivered",
        deliveredBy: file.users.bruno,
        operationalDate: saoPauloDate(NOW, -1),
        nextShiftText: VISUAL_TEXTS.pendingNextShift,
      },
    ]);
    expect(file).toMatchObject({
      state: "inicio:admin",
      sector: "ULD",
      sectorId: uld,
      sectors: world.sectors,
      at: NOW.toISOString(),
    });
    expect(Object.keys(file.users)).toEqual(["ana", "bruno", "carla", "diego"]);
  });

  it("inicio:sem-turnos desliga só os turnos do ULD e mantém as 7 abertas", async () => {
    await seedState(db, "inicio:sem-turnos", { now: NOW });
    const rows = await db
      .select({ sectorId: shift.sectorId, active: shift.active })
      .from(shift);
    const uld = sectorOf("ULD");
    expect(rows.filter((r) => r.sectorId === uld).map((r) => r.active)).toEqual(
      [false, false, false],
    );
    expect(rows.filter((r) => r.sectorId !== uld).every((r) => r.active)).toBe(
      true,
    );
    expect(await db.$count(request)).toBe(7);
  });

  it("inicio:primeiro: só a Ana ativa, sem convite pendente, sem passagem nem solicitação", async () => {
    await seedState(db, "inicio:primeiro", { now: NOW });
    const active = await db
      .select({ email: user.email })
      .from(user)
      .where(isNull(user.deactivatedAt));
    expect(active).toEqual([{ email: VISUAL_PEOPLE.ana.email }]);
    const pending = await db.$count(
      invite,
      and(isNull(invite.usedAt), isNull(invite.cancelledAt)),
    );
    expect(pending).toBe(0);
    expect(await db.$count(handover)).toBe(0);
    expect(await db.$count(request)).toBe(0);
  });

  it("inicio:continuar: rascunho do turno sugerido, salvo pela Carla às 07:58", async () => {
    const file = await seedState(db, "inicio:continuar", { now: NOW });
    const [row] = await db
      .select({
        status: handover.status,
        operationalDate: handover.operationalDate,
        updatedBy: handover.updatedBy,
        updatedAt: handover.updatedAt,
      })
      .from(handover);
    expect(row).toEqual({
      status: "draft",
      operationalDate: "2026-11-27",
      updatedBy: file.users.carla,
      updatedAt: saoPauloAt("07:58", NOW),
    });
  });

  it("inicio:confirmada com o setor Carga: entregue pela Ana às 13:52 e confirmada pelo Diego às 14:06", async () => {
    const file = await seedState(db, "inicio:confirmada", {
      sector: "Carga",
      now: NOW,
    });
    const carga = sectorOf("Carga");
    const [row] = await db
      .select({
        sectorId: handover.sectorId,
        status: handover.status,
        operationalDate: handover.operationalDate,
        deliveredBy: handover.deliveredBy,
        deliveredAt: handover.deliveredAt,
        confirmedBy: handover.confirmedBy,
        confirmedAt: handover.confirmedAt,
      })
      .from(handover);
    expect(row).toEqual({
      sectorId: carga,
      status: "confirmed",
      operationalDate: "2026-11-27",
      deliveredBy: file.users.ana,
      deliveredAt: saoPauloAt("13:52", NOW),
      confirmedBy: file.users.diego,
      confirmedAt: saoPauloAt("14:06", NOW),
    });
    expect(file).toMatchObject({ sector: "Carga", sectorId: carga });
    expect(await openRequests(carga)).toHaveLength(7);
    expect(await openRequests(sectorOf("ULD"))).toHaveLength(0);
  });

  it("geral:rico: 17 confirmadas em 6 dias, a pendente, a correção, o Stretch em rolo e todos os status", async () => {
    await seedState(db, "geral:rico", { now: NOW });
    expect(await db.$count(handover, eq(handover.status, "confirmed"))).toBe(
      17,
    );
    expect(await db.$count(handover, eq(handover.status, "delivered"))).toBe(1);
    const corrections = await db
      .select({
        oldValue: handoverCorrection.oldValue,
        newValue: handoverCorrection.newValue,
        reason: handoverCorrection.reason,
      })
      .from(handoverCorrection);
    expect(corrections).toEqual([
      {
        oldValue: VISUAL_TEXTS.history.correctionOld,
        newValue: VISUAL_TEXTS.history.occurrences,
        reason: VISUAL_TEXTS.history.correctionReason,
      },
    ]);
    const [stretch] = await db
      .select({ kind: item.kind, unit: item.unit })
      .from(item)
      .where(eq(item.name, "Stretch"));
    expect(stretch).toEqual({ kind: "stock", unit: "rolo" });
    expect(await db.$count(request)).toBe(12);
    const statuses = new Set(
      (await db.select({ status: request.status }).from(request)).map(
        (r) => r.status,
      ),
    );
    expect([...statuses].sort()).toEqual([
      "cancelled",
      "delivered",
      "in_transit",
      "requested",
    ]);
  });

  it("o estado seguinte desfaz o anterior (passagens somem, o Stretch volta a control)", async () => {
    await seedState(db, "geral:rico", { now: NOW });
    await seedState(db, "inicio:primeiro", { now: NOW });
    expect(await db.$count(handover)).toBe(0);
    expect(await db.$count(handoverCorrection)).toBe(0);
    const [stretch] = await db
      .select({ kind: item.kind, unit: item.unit })
      .from(item)
      .where(eq(item.name, "Stretch"));
    expect(stretch).toEqual({ kind: "control", unit: "unidade" });
  });

  it("estado desconhecido lança sem apagar nada (inclusive nome herdado do Object)", async () => {
    await seedState(db, "inicio:admin", { now: NOW });
    await expect(
      seedState(db, "inicio:nao-existe", { now: NOW }),
    ).rejects.toThrow("estado desconhecido: inicio:nao-existe");
    await expect(seedState(db, "toString", { now: NOW })).rejects.toThrow(
      "estado desconhecido: toString",
    );
    await expect(seedState(db, "", { now: NOW })).rejects.toThrow(
      "estado desconhecido",
    );
    expect(await db.$count(request)).toBe(7);
  });

  it("setor desconhecido lança sem apagar nada", async () => {
    await seedState(db, "inicio:admin", { now: NOW });
    await expect(
      seedState(db, "inicio:entregue", { sector: "Nada", now: NOW }),
    ).rejects.toThrow("setor Nada não existe");
    expect(await db.$count(request)).toBe(7);
    expect(await db.$count(handover)).toBe(1);
  });

  it("pessoa sem cadastro lança antes de zerar", async () => {
    await seedState(db, "inicio:admin", { now: NOW });
    await db.delete(user).where(eq(user.email, VISUAL_PEOPLE.diego.email));
    await expect(
      seedState(db, "inicio:confirmada", { now: NOW }),
    ).rejects.toThrow(`usuário ${VISUAL_PEOPLE.diego.email} não existe`);
    expect(await db.$count(request)).toBe(7);
  });
});

describe("datas de São Paulo", () => {
  it("saoPauloAt dá o HH:MM de hoje em São Paulo", () => {
    expect(saoPauloAt("13:52", NOW).toISOString()).toBe(
      "2026-11-27T16:52:00.000Z",
    );
    expect(saoPauloAt("00:00", NOW).toISOString()).toBe(
      "2026-11-27T03:00:00.000Z",
    );
    expect(saoPauloAt("23:59", NOW).toISOString()).toBe(
      "2026-11-28T02:59:00.000Z",
    );
  });

  it("às 23:00 de São Paulo (02:00Z do dia seguinte), hoje ainda é o dia anterior", () => {
    expect(
      saoPauloAt("05:58", new Date("2026-11-28T02:00:00Z")).toISOString(),
    ).toBe("2026-11-27T08:58:00.000Z");
  });

  it("saoPauloAt recusa horário inválido", () => {
    for (const bad of ["24:00", "7:58", "", "07:60", "07:58:00"]) {
      expect(() => saoPauloAt(bad, NOW)).toThrow("horário inválido");
    }
  });

  it("saoPauloDate anda em dias de São Paulo, inclusive na virada do mês", () => {
    expect(saoPauloDate(NOW)).toBe("2026-11-27");
    expect(saoPauloDate(NOW, -1)).toBe("2026-11-26");
    expect(saoPauloDate(NOW, -27)).toBe("2026-10-31");
    expect(saoPauloDate(new Date("2026-12-01T02:00:00Z"))).toBe("2026-11-30");
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `bunx vitest run test/visual/seed.test.ts`
Expected: FAIL — o arquivo não carrega: os imports `../../scripts/visual/seed/states/index` e `../../scripts/visual/seed/world`
não existem.

- [ ] **Step 7: Implementar `scripts/visual/seed/world.ts`**

```ts
// O mundo visual (spec §5.4): setores, turnos, itens, destinos e um convite por pessoa fictícia, e a
// parte variável que cada estado zera antes de se montar. Só o vocabulário inventado de
// scripts/visual/vocabulary.mjs, nada de protótipo. Recebe `db` por parâmetro: a CLI passa o banco
// da 54332 (conferido por assertVisualDbUrl), o teste passa o PGlite.
import { and, count, eq, isNull } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { destination, item, shift } from "@/db/schema/catalog";
import {
  handover,
  handoverCorrection,
  handoverItem,
} from "@/db/schema/handovers";
import { invite } from "@/db/schema/invites";
import {
  request,
  requestComment,
  requestItem,
  requestStatusEvent,
} from "@/db/schema/requests";
import { sector } from "@/db/schema/sectors";
import {
  addDays,
  saoPauloParts,
  todayInSaoPaulo,
} from "@/features/handovers/saoPaulo";

import {
  insertDestination,
  insertInvite,
  insertItem,
  insertSector,
  insertShift,
} from "../../../test/fixtures";
import {
  VISUAL_DESTINATIONS,
  VISUAL_ITEMS,
  VISUAL_PEOPLE,
  VISUAL_SECTORS,
  VISUAL_SHIFTS,
} from "../vocabulary.mjs";

export type SeedDb = Parameters<typeof insertSector>[0];
export type PersonKey = keyof typeof VISUAL_PEOPLE;
export type WorldFile = {
  sectors: Record<string, string>;
  invites: Record<PersonKey, string>;
};

/** O setor dos estados quando o `--setor` não vem (e o dos convites dos operadores). */
export const DEFAULT_SECTOR = "ULD";

// Turnos "antigos": o histórico só gera "sem passagem" a partir do createdAt do turno.
const SHIFTS_CREATED_AT = new Date("2026-10-01T12:00:00Z");
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MINUTES_PER_DAY = 1440;

/**
 * O mundo inteiro, uma vez: 4 setores, 3 turnos em cada, 9 itens, 5 destinos e um convite por
 * pessoa (a Ana admin, sem setor; os operadores no ULD). Lança se o banco já tem setores.
 */
export async function seedBase(db: SeedDb): Promise<WorldFile> {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select({ total: count() }).from(sector);
    if ((existing?.total ?? 0) > 0) {
      throw new Error(
        "o banco visual já tem setores: o base roda uma vez (para recomeçar, pare o visual:db e apague .git/sdd/visual-db/pgdata)",
      );
    }

    const sectors: Record<string, string> = {};
    for (const { name, color } of VISUAL_SECTORS) {
      const created = await insertSector(tx, name, { color });
      sectors[name] = created.id;
      for (const [index, turn] of VISUAL_SHIFTS.entries()) {
        await insertShift(tx, {
          sectorId: created.id,
          name: turn.name,
          startsAt: turn.startsAt,
          endsAt: turn.endsAt,
          sortOrder: index + 1,
          createdAt: SHIFTS_CREATED_AT,
        });
      }
      for (const [index, itemName] of (VISUAL_ITEMS[name] ?? []).entries()) {
        await insertItem(tx, {
          sectorId: created.id,
          name: itemName,
          unit: "unidade",
          kind: "control",
          sortOrder: index + 1,
        });
      }
    }
    for (const name of VISUAL_DESTINATIONS) {
      await insertDestination(tx, { name });
    }

    const operatorsSector = sectors[DEFAULT_SECTOR];
    if (!operatorsSector) {
      throw new Error(`setor ${DEFAULT_SECTOR} não existe no vocabulário`);
    }
    const invites = {} as Record<PersonKey, string>;
    for (const key of Object.keys(VISUAL_PEOPLE) as PersonKey[]) {
      const person = VISUAL_PEOPLE[key];
      const { token } = await insertInvite(tx, {
        role: person.role,
        sectorId: person.role === "admin" ? null : operatorsSector,
      });
      invites[key] = token;
    }
    return { sectors, invites };
  });
}

/**
 * A parte variável, zerada antes de cada estado: passagens, solicitações e o histórico delas; todos
 * os turnos ativos; todas as pessoas ativas; os itens de volta a `control` em `unidade`; os convites
 * pendentes cancelados (o primeiro acesso exige zero pendentes).
 */
export async function resetVariable(db: SeedDb): Promise<void> {
  await db.delete(requestComment);
  await db.delete(requestStatusEvent);
  await db.delete(requestItem);
  await db.delete(request);
  await db.delete(handoverCorrection);
  await db.delete(handoverItem);
  await db.delete(handover);
  await db.update(shift).set({ active: true });
  await db.update(user).set({ deactivatedAt: null });
  await db.update(item).set({ kind: "control", unit: "unidade" });
  await db
    .update(invite)
    .set({ cancelledAt: new Date() })
    .where(and(isNull(invite.usedAt), isNull(invite.cancelledAt)));
}

/** Id do setor pelo nome; lança "setor <nome> não existe". */
export async function sectorIdByName(
  db: SeedDb,
  name: string,
): Promise<string> {
  const [row] = await db
    .select({ id: sector.id })
    .from(sector)
    .where(eq(sector.name, name));
  if (!row) throw new Error(`setor ${name} não existe`);
  return row.id;
}

/** Id da pessoa pelo e-mail; lança se ela ainda não se cadastrou. */
export async function userIdByEmail(
  db: SeedDb,
  email: string,
): Promise<string> {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  if (!row) {
    throw new Error(
      `usuário ${email} não existe (cadastre com bun run visual:people)`,
    );
  }
  return row.id;
}

/** Id do destino pelo nome; lança "destino <nome> não existe". */
export async function destinationIdByName(
  db: SeedDb,
  name: string,
): Promise<string> {
  const [row] = await db
    .select({ id: destination.id })
    .from(destination)
    .where(eq(destination.name, name));
  if (!row) throw new Error(`destino ${name} não existe`);
  return row.id;
}

/**
 * Hoje (o dia de São Paulo de `now`) às HH:MM de São Paulo. O palpite é UTC−3; a hora de parede que
 * o Intl devolve corrige se o fuso mudar.
 */
export function saoPauloAt(hhmm: string, now: Date = new Date()): Date {
  const match = HHMM.exec(hhmm);
  if (!match) throw new RangeError(`horário inválido: "${hhmm}" (HH:MM)`);
  const date = todayInSaoPaulo(now);
  const target = Number(match[1]) * 60 + Number(match[2]);
  const guess = new Date(`${date}T${hhmm}:00-03:00`);
  const parts = saoPauloParts(guess);
  let dayShift = 0;
  if (parts.date < date) dayShift = -MINUTES_PER_DAY;
  if (parts.date > date) dayShift = MINUTES_PER_DAY;
  const delta = dayShift + parts.minutes - target;
  return delta === 0 ? guess : new Date(guess.getTime() - delta * 60_000);
}

/** O dia de São Paulo de `now`, andado `offsetDays` dias: "YYYY-MM-DD". */
export function saoPauloDate(now: Date, offsetDays = 0): string {
  return addDays(todayInSaoPaulo(now), offsetDays);
}
```

- [ ] **Step 8: Implementar `scripts/visual/seed/states/inicio.ts`**

```ts
// Os estados do Início (spec §5.4), portados do seed do PR A com o vocabulário inventado e as datas
// relativas ao `ctx.now`. Cada um roda depois do resetVariable (o seedState chama) e usa o setor do
// `ctx` (padrão ULD). O que depende do relógio vai para as máscaras e o patch da tela
// (scripts/visual/screens/inicio.mjs).
import { and, eq, ne } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { shift } from "@/db/schema/catalog";
import { handover } from "@/db/schema/handovers";
import { suggestShift } from "@/features/handovers/shiftSuggestion";

import { insertHandover, insertRequest } from "../../../../test/fixtures";
import {
  VISUAL_PEOPLE,
  VISUAL_SHIFTS,
  VISUAL_TEXTS,
} from "../../vocabulary.mjs";
import {
  destinationIdByName,
  type PersonKey,
  type SeedDb,
  saoPauloAt,
  saoPauloDate,
  sectorIdByName,
  userIdByEmail,
} from "../world";
import type { StateContext, StateSeeder } from "./index";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const RECENT_REQUESTS = 4;

type StaleTiming = {
  by: "bruno" | "carla";
  status: "requested" | "in_transit";
  createdAgo: number;
  changedAgo?: number;
};

// A idade de cada parada, na ordem de VISUAL_TEXTS.staleRequests (spec §5.4).
const STALE_TIMING: readonly StaleTiming[] = [
  { by: "bruno", status: "requested", createdAgo: 4 * DAY_MS + 2 * HOUR_MS },
  {
    by: "carla",
    status: "in_transit",
    createdAgo: 5 * DAY_MS,
    changedAgo: 3 * DAY_MS + 5 * HOUR_MS,
  },
  { by: "bruno", status: "requested", createdAgo: 3 * DAY_MS + HOUR_MS },
];

/** O turno que o app sugere agora no setor (o do fim mais próximo) e os outros turnos ativos. */
export async function suggestedTarget(
  db: SeedDb,
  sectorId: string,
  now: Date,
): Promise<{ shiftId: string; operationalDate: string; others: string[] }> {
  const shifts = await db
    .select({ id: shift.id, startsAt: shift.startsAt, endsAt: shift.endsAt })
    .from(shift)
    .where(and(eq(shift.sectorId, sectorId), eq(shift.active, true)))
    .orderBy(shift.sortOrder);
  const target = suggestShift(shifts, now);
  if (!target) throw new Error("o setor não tem turno ativo para sugerir");
  return {
    ...target,
    others: shifts.filter((s) => s.id !== target.shiftId).map((s) => s.id),
  };
}

/**
 * A pendente do Bruno: entregue às 05:58 de hoje, de ontem, num turno que não é o sugerido, com o
 * nome "Turno 3" no snapshot (o seed não depende da hora em que roda). Devolve o turno e o dia que
 * ela ocupa.
 */
export async function seedPendingFromBruno(
  db: SeedDb,
  ctx: StateContext,
): Promise<{ shiftId: string; operationalDate: string }> {
  const sectorId = await sectorIdByName(db, ctx.sector);
  const target = await suggestedTarget(db, sectorId, ctx.now);
  const shiftId = target.others[0];
  if (!shiftId) {
    throw new Error("a pendente precisa de um segundo turno ativo no setor");
  }
  const bruno = await userIdByEmail(db, VISUAL_PEOPLE.bruno.email);
  const operationalDate = saoPauloDate(ctx.now, -1);
  await insertHandover(db, {
    sectorId,
    shiftId,
    operationalDate,
    status: "delivered",
    deliveredBy: bruno,
    deliveredAt: saoPauloAt("05:58", ctx.now),
    updatedBy: bruno,
    shiftNameSnapshot: VISUAL_SHIFTS[2]?.name ?? "Turno 3",
    nextShiftText: VISUAL_TEXTS.pendingNextShift,
  });
  return { shiftId, operationalDate };
}

/** As 3 paradas (mais de 72 h no mesmo status) e 4 abertas recentes: 7 abertas no setor. */
export async function seedStaleRequests(
  db: SeedDb,
  ctx: StateContext,
): Promise<void> {
  const sectorId = await sectorIdByName(db, ctx.sector);
  const people = {
    bruno: await userIdByEmail(db, VISUAL_PEOPLE.bruno.email),
    carla: await userIdByEmail(db, VISUAL_PEOPLE.carla.email),
  };
  const now = ctx.now.getTime();
  for (const [index, text] of VISUAL_TEXTS.staleRequests.entries()) {
    const timing = STALE_TIMING[index];
    if (!timing) throw new Error(`a parada nº ${index + 1} não tem idade`);
    await insertRequest(db, {
      sectorId,
      createdBy: people[timing.by],
      destinationId: await destinationIdByName(db, text.destination),
      description: text.description,
      status: timing.status,
      createdAt: new Date(now - timing.createdAgo),
      ...(timing.changedAgo === undefined
        ? {}
        : { statusChangedAt: new Date(now - timing.changedAgo) }),
    });
  }
  const recent = VISUAL_TEXTS.recentRequests;
  const destinationId = await destinationIdByName(db, recent.destination);
  for (let n = 1; n <= RECENT_REQUESTS; n++) {
    await insertRequest(db, {
      sectorId,
      createdBy: people.carla,
      destinationId,
      description: `${recent.descriptionPrefix} ${n}`,
      createdAt: new Date(now - n * HOUR_MS),
    });
  }
}

/** A passagem do turno sugerido: rascunho salvo às 07:58, entregue às 13:52, confirmada às 14:06. */
async function seedCurrentHandover(
  db: SeedDb,
  ctx: StateContext,
  status: "draft" | "delivered" | "confirmed",
  by: PersonKey,
  confirmer?: PersonKey,
): Promise<void> {
  const sectorId = await sectorIdByName(db, ctx.sector);
  const target = await suggestedTarget(db, sectorId, ctx.now);
  const byId = await userIdByEmail(db, VISUAL_PEOPLE[by].email);
  const confirmedBy = confirmer
    ? await userIdByEmail(db, VISUAL_PEOPLE[confirmer].email)
    : undefined;
  const created = await insertHandover(db, {
    sectorId,
    shiftId: target.shiftId,
    operationalDate: target.operationalDate,
    status,
    updatedBy: byId,
    ...(status === "draft"
      ? {}
      : { deliveredBy: byId, deliveredAt: saoPauloAt("13:52", ctx.now) }),
    ...(status === "confirmed" && confirmedBy
      ? { confirmedBy, confirmedAt: saoPauloAt("14:06", ctx.now) }
      : {}),
  });
  if (status === "draft") {
    await db
      .update(handover)
      .set({ updatedAt: saoPauloAt("07:58", ctx.now) })
      .where(eq(handover.id, created.id));
  }
}

export const INICIO_STATES: Record<
  "admin" | "primeiro" | "continuar" | "entregue" | "confirmada" | "sem-turnos",
  StateSeeder
> = {
  // A pendente do Bruno e as 7 abertas (3 paradas).
  admin: async (db, ctx) => {
    await seedPendingFromBruno(db, ctx);
    await seedStaleRequests(db, ctx);
  },
  // Primeiro acesso: só a Ana ativa, sem convite pendente, sem passagem nem solicitação.
  primeiro: async (db, ctx) => {
    const ana = await userIdByEmail(db, VISUAL_PEOPLE.ana.email);
    await db
      .update(user)
      .set({ deactivatedAt: ctx.now })
      .where(ne(user.id, ana));
  },
  // Rascunho do turno sugerido, salvo pela Carla.
  continuar: (db, ctx) => seedCurrentHandover(db, ctx, "draft", "carla"),
  // Entregue pela Ana, mais as paradas.
  entregue: async (db, ctx) => {
    await seedCurrentHandover(db, ctx, "delivered", "ana");
    await seedStaleRequests(db, ctx);
  },
  // Entregue pela Ana e confirmada pelo Diego, mais as paradas.
  confirmada: async (db, ctx) => {
    await seedCurrentHandover(db, ctx, "confirmed", "ana", "diego");
    await seedStaleRequests(db, ctx);
  },
  // Os turnos do setor desligados, mais as paradas.
  "sem-turnos": async (db, ctx) => {
    const sectorId = await sectorIdByName(db, ctx.sector);
    await db
      .update(shift)
      .set({ active: false })
      .where(eq(shift.sectorId, sectorId));
    await seedStaleRequests(db, ctx);
  },
};
```

- [ ] **Step 9: Implementar `scripts/visual/seed/states/geral.ts`**

```ts
// O estado "rico" do passe de legibilidade (spec §5.4): a pendente do Bruno, as paradas, seis dias de
// passagens confirmadas com itens e textos, uma correção e solicitações em todos os status. Portado
// do seed do PR A, com o vocabulário inventado e as datas relativas ao `ctx.now`.
import { and, eq } from "drizzle-orm";

import { item, shift } from "@/db/schema/catalog";

import {
  insertHandover,
  insertHandoverCorrection,
  insertHandoverItem,
  insertRequest,
} from "../../../../test/fixtures";
import { VISUAL_PEOPLE, VISUAL_TEXTS } from "../../vocabulary.mjs";
import {
  destinationIdByName,
  type SeedDb,
  saoPauloAt,
  saoPauloDate,
  sectorIdByName,
  userIdByEmail,
} from "../world";
import type { StateContext, StateSeeder } from "./index";
import {
  seedPendingFromBruno,
  seedStaleRequests,
  suggestedTarget,
} from "./inicio";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const HISTORY_DAYS = 6;
// Entrega e confirmação de cada turno (pela posição do turno no setor), no dia da passagem.
const DELIVERED_AT = ["12:55", "13:55", "14:55"] as const;
const CONFIRMED_AT = ["13:05", "14:05", "15:05"] as const;
// O item que vira estoque no estado rico (spec §5.4).
const STOCK_ITEM = "Stretch";
const HISTORY_STATUS_GAP_HOURS = {
  created: [30, 20],
  changed: [10, 5],
} as const;

async function seedHistory(
  db: SeedDb,
  ctx: StateContext,
  pending: { shiftId: string; operationalDate: string },
): Promise<void> {
  const sectorId = await sectorIdByName(db, ctx.sector);
  const ana = await userIdByEmail(db, VISUAL_PEOPLE.ana.email);
  const bruno = await userIdByEmail(db, VISUAL_PEOPLE.bruno.email);
  const carla = await userIdByEmail(db, VISUAL_PEOPLE.carla.email);
  const diego = await userIdByEmail(db, VISUAL_PEOPLE.diego.email);
  const shifts = await db
    .select({ id: shift.id, name: shift.name })
    .from(shift)
    .where(eq(shift.sectorId, sectorId))
    .orderBy(shift.sortOrder);

  // Antes das passagens: o snapshot dos itens já leva o Stretch em rolo.
  await db
    .update(item)
    .set({ kind: "stock", unit: "rolo" })
    .where(and(eq(item.sectorId, sectorId), eq(item.name, STOCK_ITEM)));
  const items = await db
    .select({ id: item.id })
    .from(item)
    .where(eq(item.sectorId, sectorId))
    .orderBy(item.sortOrder);

  const target = await suggestedTarget(db, sectorId, ctx.now);
  const authors = [bruno, carla, diego];
  let first: string | null = null;
  for (let d = 1; d <= HISTORY_DAYS; d++) {
    const date = saoPauloDate(ctx.now, -d);
    const dayNow = new Date(ctx.now.getTime() - d * DAY_MS);
    for (const [i, turn] of shifts.entries()) {
      // O turno sugerido e o da pendente ficam livres (a mesma tripla não pode ter duas passagens).
      const isTarget =
        turn.id === target.shiftId && date === target.operationalDate;
      const isPending =
        turn.id === pending.shiftId && date === pending.operationalDate;
      if (isTarget || isPending) continue;
      const by = authors[i % 3] ?? bruno;
      const confirmer = by === carla ? diego : carla;
      const created = await insertHandover(db, {
        sectorId,
        shiftId: turn.id,
        operationalDate: date,
        status: "confirmed",
        deliveredBy: by,
        deliveredAt: saoPauloAt(DELIVERED_AT[i % 3] ?? "12:55", dayNow),
        confirmedBy: confirmer,
        confirmedAt: saoPauloAt(CONFIRMED_AT[i % 3] ?? "13:05", dayNow),
        updatedBy: by,
        shiftNameSnapshot: turn.name,
        occurrencesText: d % 2 ? VISUAL_TEXTS.history.occurrences : "",
        nextShiftText: d % 3 ? VISUAL_TEXTS.history.nextShift : "",
      });
      first ??= created.id;
      for (const [k, line] of items.entries()) {
        await insertHandoverItem(db, {
          handoverId: created.id,
          itemId: line.id,
          quantity: (d + k * 3) % 9,
          note: k === 0 && d === 2 ? VISUAL_TEXTS.history.note : null,
          snapshot: true,
        });
      }
    }
  }

  // A primeira passagem criada (ontem, com o texto de ocorrências) ganha a correção.
  if (first) {
    await insertHandoverCorrection(db, {
      handoverId: first,
      field: "occurrences_text",
      oldValue: VISUAL_TEXTS.history.correctionOld,
      newValue: VISUAL_TEXTS.history.occurrences,
      reason: VISUAL_TEXTS.history.correctionReason,
      correctedBy: ana,
    });
  }

  // Solicitações em todos os status (Quadro, Tabela e Dashboard).
  const now = ctx.now.getTime();
  const { created, changed } = HISTORY_STATUS_GAP_HOURS;
  for (const [i, entry] of VISUAL_TEXTS.historyRequests.entries()) {
    await insertRequest(db, {
      sectorId,
      createdBy: i % 2 ? bruno : carla,
      destinationId: await destinationIdByName(db, entry.destination),
      description: entry.description,
      status: entry.status,
      createdAt: new Date(now - (created[0] + i * created[1]) * HOUR_MS),
      statusChangedAt: new Date(now - (changed[0] + i * changed[1]) * HOUR_MS),
      statusChangedBy: ana,
      ...(entry.status === "cancelled"
        ? { cancelReason: VISUAL_TEXTS.cancelReason }
        : {}),
    });
  }
}

export const GERAL_STATES: Record<"rico", StateSeeder> = {
  rico: async (db, ctx) => {
    const pending = await seedPendingFromBruno(db, ctx);
    await seedStaleRequests(db, ctx);
    await seedHistory(db, ctx, pending);
  },
};
```

- [ ] **Step 10: Implementar `scripts/visual/seed/states/index.ts`**

O `inicio.ts` e o `geral.ts` importam daqui só tipos (`import type`), então não há ciclo em tempo de execução.

```ts
// O registro dos estados visuais (spec §5.4), com o nome `<tela>:<estado>`. Cada branch de tela
// acrescenta `seed/states/<tela>.ts` e o registra aqui, no STATES.
import { VISUAL_PEOPLE, VISUAL_SECTORS } from "../../vocabulary.mjs";
import {
  DEFAULT_SECTOR,
  type PersonKey,
  resetVariable,
  type SeedDb,
  sectorIdByName,
  userIdByEmail,
} from "../world";
import { GERAL_STATES } from "./geral";
import { INICIO_STATES } from "./inicio";

export type StateContext = { sector: string; now: Date };
export type StateSeeder = (db: SeedDb, ctx: StateContext) => Promise<void>;
export type StateFile = {
  state: string;
  sector: string;
  sectorId: string;
  sectors: Record<string, string>;
  users: Record<PersonKey, string>;
  at: string;
};

function prefixed(
  screen: string,
  states: Record<string, StateSeeder>,
): Record<string, StateSeeder> {
  return Object.fromEntries(
    Object.entries(states).map(([name, seeder]) => [
      `${screen}:${name}`,
      seeder,
    ]),
  );
}

/** "inicio:admin" … "inicio:sem-turnos" e "geral:rico". */
export const STATES: Record<string, StateSeeder> = Object.freeze({
  ...prefixed("inicio", INICIO_STATES),
  ...prefixed("geral", GERAL_STATES),
});

/**
 * Zera a parte variável e monta o estado, numa transação. Confere antes de apagar qualquer coisa:
 * o nome do estado ("estado desconhecido: <nome>"), o setor e as quatro pessoas.
 */
export async function seedState(
  db: SeedDb,
  name: string,
  options: { sector?: string; now?: Date } = {},
): Promise<StateFile> {
  const seeder = Object.hasOwn(STATES, name) ? STATES[name] : undefined;
  if (!seeder) throw new Error(`estado desconhecido: ${name}`);
  const sector = options.sector ?? DEFAULT_SECTOR;
  const now = options.now ?? new Date();

  const sectorId = await sectorIdByName(db, sector);
  const sectors: Record<string, string> = {};
  for (const { name: sectorName } of VISUAL_SECTORS) {
    sectors[sectorName] = await sectorIdByName(db, sectorName);
  }
  const users = {} as Record<PersonKey, string>;
  for (const key of Object.keys(VISUAL_PEOPLE) as PersonKey[]) {
    users[key] = await userIdByEmail(db, VISUAL_PEOPLE[key].email);
  }

  await db.transaction(async (tx) => {
    await resetVariable(tx);
    await seeder(tx, { sector, now });
  });
  return {
    state: name,
    sector,
    sectorId,
    sectors,
    users,
    at: now.toISOString(),
  };
}
```

- [ ] **Step 11: Rodar e ver passar**

Run: `bunx vitest run test/visual/seed.test.ts`
Expected: PASS, 18 testes. (Conferido na redação: com o agora do teste, `inicio:admin` dá 7 abertas, 3 paradas e a
pendente de 2026-11-26; o rico dá 17 confirmadas, 1 entregue, 1 correção, 51 linhas de item e 12 solicitações.)

- [ ] **Step 12: Escrever o teste do `env.sh`**

`test/visual/envScript.test.ts` (o texto é conferido sempre; a execução, só onde há `sh`: no CI Linux sempre; no
Windows, quando o Vitest roda pelo Git Bash):

```ts
import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Guarda do scripts/visual/env.sh (spec §5.3): banco 54332, app 3202, o .git/sdd achado
// pelo git rev-parse e o segredo nunca impresso. O texto é conferido sempre; a execução,
// só onde existe `sh` (no Windows, o Vitest pelo Git Bash).

const ENV_SH = resolve("scripts/visual/env.sh");
const source = readFileSync(ENV_SH, "utf8");
const code = source.split("\n").filter((line) => !line.trim().startsWith("#"));
const hasSh = spawnSync("sh", ["-c", "exit 0"]).status === 0;

describe("env.sh, o texto", () => {
  it("aponta para o banco 54332 e o app 3202, nunca para as portas dos outros", () => {
    expect(code).toContain(
      'export DATABASE_URL="postgres://postgres:postgres@127.0.0.1:54332/postgres"',
    );
    expect(code).toContain('export DATABASE_URL_POOLED="$DATABASE_URL"');
    expect(code).toContain('export DATABASE_POOL_MAX="1"');
    expect(code).toContain('export BETTER_AUTH_URL="http://localhost:3202"');
    for (const port of ["3000", "3200", "3201", "54329", "54331"]) {
      expect(source).not.toContain(`:${port}`);
    }
  });

  it("acha o .git pelo git rev-parse --git-common-dir, nunca por um caminho fixo", () => {
    expect(source).toContain(
      "git rev-parse --path-format=absolute --git-common-dir",
    );
    expect(source).not.toMatch(/\.git\//);
  });

  it("nunca imprime o segredo: nenhum echo/printf com ele; o cat só na atribuição", () => {
    for (const line of code) {
      if (/\b(echo|printf)\b/.test(line)) expect(line).not.toMatch(/secret/i);
    }
    expect(code.filter((line) => /\bcat\b/.test(line))).toEqual([
      'BETTER_AUTH_SECRET="$(cat "$VISUAL_SECRET_FILE")"',
    ]);
  });

  it("esvazia o login social e o Sentry", () => {
    expect(code).toContain(
      'export GOOGLE_CLIENT_ID="" GOOGLE_CLIENT_SECRET="" FACEBOOK_CLIENT_ID="" FACEBOOK_CLIENT_SECRET=""',
    );
    expect(code).toContain(
      'export NEXT_PUBLIC_SENTRY_DSN="" SENTRY_AUTH_TOKEN=""',
    );
  });
});

describe.skipIf(!hasSh)("env.sh, rodando no sh", () => {
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), "closery-env-")));
  const repo = join(root, "repo");
  const outside = join(root, "solto");
  const secretFile = join(repo, ".git", "sdd", "visual-db", "secret");
  // O sh do Git Bash aceita "C:/…"; a barra invertida, não em todo lugar.
  const script = ENV_SH.replaceAll("\\", "/");
  const run = (cwd: string) =>
    spawnSync(
      "sh",
      [
        "-c",
        '. "$ENV_SH" && printf "%s\\n%s\\n" "$DATABASE_URL" "$BETTER_AUTH_URL" && [ -n "$BETTER_AUTH_SECRET" ] && echo com-segredo',
      ],
      {
        cwd,
        encoding: "utf8",
        env: { ...process.env, ENV_SH: script, GIT_CEILING_DIRECTORIES: root },
      },
    );

  beforeAll(() => {
    mkdirSync(repo);
    mkdirSync(outside);
    execFileSync("git", ["init", "-q"], { cwd: repo });
  });

  afterAll(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("gera o segredo em <git-common-dir>/sdd/visual-db/secret, sem imprimi-lo, e exporta as URLs", () => {
    const result = run(repo);
    expect(result.status).toBe(0);
    const secret = readFileSync(secretFile, "utf8");
    expect(Buffer.from(secret, "base64")).toHaveLength(32);
    expect(result.stdout.split(/\r?\n/).slice(0, 3)).toEqual([
      "postgres://postgres:postgres@127.0.0.1:54332/postgres",
      "http://localhost:3202",
      "com-segredo",
    ]);
    expect(`${result.stdout}${result.stderr}`).not.toContain(secret);
  });

  it("na segunda vez, reaproveita o mesmo segredo", () => {
    const before = readFileSync(secretFile, "utf8");
    expect(run(repo).status).toBe(0);
    expect(readFileSync(secretFile, "utf8")).toBe(before);
  });

  it("fora de um repositório, falha com a mensagem e não grava nada", () => {
    const result = run(outside);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("rode dentro do repositório");
    expect(existsSync(join(outside, "sdd"))).toBe(false);
  });
});
```

- [ ] **Step 13: Rodar e ver falhar**

Run: `bunx vitest run test/visual/envScript.test.ts`
Expected: FAIL com `ENOENT: no such file or directory, open '…/scripts/visual/env.sh'` (o `readFileSync` do topo do arquivo).

- [ ] **Step 14: Implementar `scripts/visual/env.sh`**

Sem `.git/` escrito no arquivo (o teste recusa) e sem nenhum `echo`/`printf` do segredo:

```sh
# Ambiente do processo visual (spec §5.3): banco PGlite na 54332 e app na 3202.
# Use com ". scripts/visual/env.sh" de dentro do repositório (ou de uma worktree), antes do
# "bun run build" e do "bunx next start -p 3202". Os valores exportados vencem o .env.local.
# O segredo do Better Auth fica fora do git, em <git-common-dir>/sdd/visual-db/secret: é gerado
# na primeira vez (32 bytes, base64) e nunca é impresso.
VISUAL_GIT_DIR="$(git rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"
if [ -z "$VISUAL_GIT_DIR" ]; then
  echo "env.sh: rode dentro do repositório (o git não achou o diretório do repositório)" >&2
  unset VISUAL_GIT_DIR
  return 1 2>/dev/null || exit 1
fi
VISUAL_SECRET_FILE="$VISUAL_GIT_DIR/sdd/visual-db/secret"
if [ ! -s "$VISUAL_SECRET_FILE" ]; then
  mkdir -p "$VISUAL_GIT_DIR/sdd/visual-db"
  node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("base64"))' >"$VISUAL_SECRET_FILE"
fi
export DATABASE_URL="postgres://postgres:postgres@127.0.0.1:54332/postgres"
export DATABASE_URL_POOLED="$DATABASE_URL"
export DATABASE_POOL_MAX="1"
export BETTER_AUTH_URL="http://localhost:3202"
BETTER_AUTH_SECRET="$(cat "$VISUAL_SECRET_FILE")"
export BETTER_AUTH_SECRET
export GOOGLE_CLIENT_ID="" GOOGLE_CLIENT_SECRET="" FACEBOOK_CLIENT_ID="" FACEBOOK_CLIENT_SECRET=""
export NEXT_PUBLIC_SENTRY_DSN="" SENTRY_AUTH_TOKEN=""
unset VISUAL_GIT_DIR VISUAL_SECRET_FILE
```

- [ ] **Step 15: Rodar e ver passar**

Run: `bunx vitest run test/visual/envScript.test.ts`
Expected: PASS, 7 testes (no Windows fora do Git Bash: 4 passam e 3 ficam `skipped`).

- [ ] **Step 16: Escrever o teste da resposta do cadastro**

`test/visual/people.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { signUpOutcome } from "../../scripts/visual/people.mjs";

// A leitura da resposta do sign-up do visual:people: "já existe" é sucesso (rodar duas
// vezes não quebra); o resto que não é 2xx falha.

describe("signUpOutcome", () => {
  it("2xx é cadastro novo", () => {
    expect(signUpOutcome(200, '{"token":null}')).toBe("ok");
    expect(signUpOutcome(201, "")).toBe("ok");
  });

  it("422 com USER_ALREADY_EXISTS é 'já existe'", () => {
    expect(
      signUpOutcome(
        422,
        '{"code":"USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL","message":"User already exists. Use another email."}',
      ),
    ).toBe("existe");
    expect(signUpOutcome(422, '{"code":"USER_ALREADY_EXISTS"}')).toBe("existe");
  });

  it("o resto falha: 422 de outro motivo, convite recusado, limite e erro do servidor", () => {
    expect(signUpOutcome(422, '{"code":"FAILED_TO_CREATE_USER"}')).toBe(
      "falhou",
    );
    expect(signUpOutcome(403, '{"code":"USER_ALREADY_EXISTS"}')).toBe("falhou");
    expect(signUpOutcome(429, "")).toBe("falhou");
    expect(signUpOutcome(500, "")).toBe("falhou");
    expect(signUpOutcome(0, "")).toBe("falhou");
  });
});
```

- [ ] **Step 17: Rodar e ver falhar**

Run: `bunx vitest run test/visual/people.test.ts`
Expected: FAIL — o arquivo não carrega: o import `../../scripts/visual/people.mjs` não existe.

- [ ] **Step 18: Implementar `scripts/visual/people.mjs`**

O CLI só roda quando o arquivo é o chamado (`import.meta.url` = `process.argv[1]`); importado pelo teste, não faz nada.

```js
// Cadastra as quatro pessoas fictícias no app visual (node; spec §5.3), pela API do Better Auth, com
// o cookie do convite que a página /convite/<token> gravaria. "Já existe" conta como sucesso: rodar
// duas vezes não quebra. Antes: o app de pé na 3202 (com o env.sh) e `bun run visual:seed base`
// (os convites ficam em .git/sdd/visual-db/world.json). Nunca imprime token nem senha.
//   bun run visual:people
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  assertVisualBaseUrl,
  fakeClientIp,
  VISUAL_BASE_URL,
  VISUAL_INVITE_COOKIE,
} from "./config.mjs";
import { readJsonInsideSdd, VISUAL_DB_FILES, visualDbDir } from "./paths.mjs";
import { VISUAL_PASSWORD, VISUAL_PEOPLE } from "./vocabulary.mjs";

// Base dos IPs do cadastro: o rate limit do sign-up é por IP (10 por minuto no `next start`).
const IP_BASE = 100;
const SIGN_UP_TIMEOUT_MS = 180_000;

/**
 * Lê a resposta do sign-up: 2xx é cadastro novo; 422 com o código USER_ALREADY_EXISTS (o Better
 * Auth 1.7 devolve USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL) é "já existe", que também é sucesso; o
 * resto falhou.
 * @param {number} status
 * @param {string} body
 * @returns {"ok" | "existe" | "falhou"}
 */
export function signUpOutcome(status, body) {
  if (status >= 200 && status < 300) return "ok";
  if (status === 422 && /USER_ALREADY_EXISTS/.test(body)) return "existe";
  return "falhou";
}

/**
 * @param {"ok" | "existe" | "falhou"} outcome
 * @param {number} status
 */
function outcomeText(outcome, status) {
  if (outcome === "ok") return "cadastrada";
  if (outcome === "existe") return "já existe";
  return `falhou (HTTP ${status}; convite cancelado por um state? rode bun run visual:seed reopen-invites)`;
}

async function main() {
  const base = assertVisualBaseUrl(VISUAL_BASE_URL);
  const world = /** @type {{ invites?: Record<string, string> }} */ (
    readJsonInsideSdd(join(visualDbDir(), VISUAL_DB_FILES.world))
  );
  let failed = 0;
  for (const [index, [key, person]] of Object.entries(
    VISUAL_PEOPLE,
  ).entries()) {
    const token = world.invites?.[key];
    if (!token) {
      console.log(
        `${key}: sem convite no world.json (rode bun run visual:seed base)`,
      );
      failed += 1;
      continue;
    }
    let response;
    try {
      response = await fetch(`${base}/api/auth/sign-up/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: base,
          "x-forwarded-for": fakeClientIp(IP_BASE + index),
          cookie: `${VISUAL_INVITE_COOKIE}=${token}`,
        },
        body: JSON.stringify({
          name: person.name,
          email: person.email,
          password: VISUAL_PASSWORD,
        }),
        signal: AbortSignal.timeout(SIGN_UP_TIMEOUT_MS),
      });
    } catch {
      console.log(
        `${key}: o app visual não respondeu em ${base} (suba o next na 3202 com o env.sh)`,
      );
      failed += 1;
      continue;
    }
    const outcome = signUpOutcome(response.status, await response.text());
    if (outcome === "falhou") failed += 1;
    console.log(`${key}: ${outcomeText(outcome, response.status)}`);
  }
  if (failed > 0) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      `visual:people: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
```

- [ ] **Step 19: Rodar e ver passar**

Run: `bunx vitest run test/visual/people.test.ts`
Expected: PASS, 3 testes.

- [ ] **Step 20: Implementar `scripts/visual/db.ts`**

Sem teste no Vitest (abre servidor); a conferência é a do Step 24.

```ts
// Banco do ambiente visual (bun; spec §5.3): PGlite gravado em disco, em
// <git-common-dir>/sdd/visual-db/pgdata (sobrevive aos reinícios do harness), com as migrações reais
// de ./drizzle, servido em 127.0.0.1:54332. Idempotente: se a porta já responde como banco, avisa e
// sai com 0. Recusa qualquer outra porta. Para zerar: parar o processo e apagar a pasta pgdata.
//   bun run visual:db
import { mkdirSync } from "node:fs";
import { createConnection } from "node:net";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { Client } from "pg";

import {
  assertVisualDbUrl,
  parseCliArgs,
  VISUAL_DB_HOST,
  VISUAL_DB_PORT,
  VISUAL_DB_URL,
} from "./config.mjs";
import {
  repoRoot,
  VISUAL_DB_DIR,
  VISUAL_DB_FILES,
  visualDbDir,
} from "./paths.mjs";

const USAGE = "uso: bun run visual:db [--port=54332]";

function portInUse(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({
      host: VISUAL_DB_HOST,
      port: VISUAL_DB_PORT,
    });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
  });
}

async function answersSelectOne(): Promise<boolean> {
  const client = new Client({
    connectionString: assertVisualDbUrl(VISUAL_DB_URL),
    connectionTimeoutMillis: 5_000,
  });
  try {
    await client.connect();
    await client.query("select 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

// Devolve o código de saída, ou null quando o servidor fica de pé.
async function main(): Promise<number | null> {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter((name) => name !== "port");
  if (unknown.length > 0 || positional.length > 0) {
    console.error(USAGE);
    return 1;
  }
  if (flags.port !== undefined && flags.port !== String(VISUAL_DB_PORT)) {
    console.error(
      `porta recusada: ${String(flags.port)} (o banco visual só usa a ${VISUAL_DB_PORT})`,
    );
    return 1;
  }

  if (await portInUse()) {
    if (await answersSelectOne()) {
      console.log(
        `banco visual já está de pé em ${VISUAL_DB_HOST}:${VISUAL_DB_PORT}`,
      );
      return 0;
    }
    console.error(
      `porta ${VISUAL_DB_PORT} ocupada por outro processo (não responde como banco)`,
    );
    return 1;
  }

  const dataDir = join(visualDbDir(), VISUAL_DB_FILES.data);
  mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  await migrate(drizzle(client), {
    migrationsFolder: join(repoRoot(), "drizzle"),
  });

  // maxConnections: 20, como no E2E: o Pool do app e o seed abrem conexões próprias.
  const server = new PGLiteSocketServer({
    db: client,
    host: VISUAL_DB_HOST,
    port: VISUAL_DB_PORT,
    maxConnections: 20,
  });
  await server.start();
  console.log(
    `banco visual pronto em ${server.getServerConn()} (dados em .git/sdd/${VISUAL_DB_DIR}/${VISUAL_DB_FILES.data})`,
  );

  const shutdown = async () => {
    await server.stop();
    await client.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  return null;
}

main().then(
  (code) => {
    if (code !== null) process.exit(code);
  },
  (error: unknown) => {
    console.error(
      `visual:db: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  },
);
```

- [ ] **Step 21: Implementar o CLI `scripts/visual/seed/index.ts`**

Sem teste no Vitest (precisa do banco da 54332); as funções que ele chama estão no `seed.test.ts`.

```ts
// CLI do seed visual (bun; spec §5.3). Banco: o PGlite da 54332 (bun run visual:db), conferido por
// assertVisualDbUrl antes de abrir a conexão. Grava em .git/sdd/visual-db/ e nunca imprime token.
//   bun run visual:seed base                                   -> world.json
//   bun run visual:seed state <tela>:<estado> [--setor=<nome>]  -> state.json
//   bun run visual:seed reopen-invites                         -> reabre os convites não usados
//   bun run visual:seed avatars                                -> avatars.json (semente = id)
import { join } from "node:path";

import { isNull } from "drizzle-orm";

import { createDb, createPool } from "@/db/client";
import { invite } from "@/db/schema/invites";

import { assertVisualDbUrl, parseCliArgs, VISUAL_DB_URL } from "../config.mjs";
import { VISUAL_DB_FILES, visualDbDir, writeInsideSdd } from "../paths.mjs";
import { VISUAL_PEOPLE } from "../vocabulary.mjs";
import { visualAvatarUri } from "./avatarArt";
import { STATES, seedState } from "./states/index";
import { type PersonKey, type SeedDb, seedBase, userIdByEmail } from "./world";

const USAGE =
  "uso: bun run visual:seed base | state <tela>:<estado> [--setor=<nome>] | reopen-invites | avatars";

function writeVisualJson(name: string, value: unknown): void {
  writeInsideSdd(
    join(visualDbDir(), name),
    `${JSON.stringify(value, null, 1)}\n`,
  );
}

async function runCommand(
  db: SeedDb,
  command: string | undefined,
  args: string[],
  setor: string | true | undefined,
): Promise<void> {
  if (setor !== undefined && command !== "state") throw new Error(USAGE);

  if (command === "base" && args.length === 0) {
    const world = await seedBase(db);
    writeVisualJson(VISUAL_DB_FILES.world, world);
    console.log(
      `mundo pronto: ${Object.keys(world.sectors).length} setores e ${Object.keys(world.invites).length} convites (em .git/sdd/visual-db/${VISUAL_DB_FILES.world})`,
    );
    return;
  }

  if (command === "state" && args.length === 1) {
    const [name] = args;
    if (!name || !Object.hasOwn(STATES, name)) {
      throw new Error(
        `estado desconhecido: ${String(name)} (estados: ${Object.keys(STATES).join(", ")})`,
      );
    }
    if (setor === true || setor === "") {
      throw new Error("--setor precisa do nome do setor");
    }
    const file = await seedState(db, name, { sector: setor });
    writeVisualJson(VISUAL_DB_FILES.state, file);
    console.log(`estado ${name} pronto (setor ${file.sector})`);
    return;
  }

  if (command === "reopen-invites" && args.length === 0) {
    const rows = await db
      .update(invite)
      .set({ cancelledAt: null })
      .where(isNull(invite.usedAt))
      .returning({ id: invite.id });
    console.log(`convites reabertos: ${rows.length}`);
    return;
  }

  if (command === "avatars" && args.length === 0) {
    const avatars = {} as Record<PersonKey, string>;
    for (const key of Object.keys(VISUAL_PEOPLE) as PersonKey[]) {
      avatars[key] = visualAvatarUri(
        await userIdByEmail(db, VISUAL_PEOPLE[key].email),
      );
    }
    writeVisualJson(VISUAL_DB_FILES.avatars, avatars);
    console.log(`avatares: ${Object.keys(avatars).join(", ")}`);
    return;
  }

  throw new Error(USAGE);
}

async function main(): Promise<void> {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter((name) => name !== "setor");
  if (unknown.length > 0) throw new Error(USAGE);
  const [command, ...args] = positional;
  const pool = createPool(assertVisualDbUrl(VISUAL_DB_URL));
  try {
    await runCommand(createDb(pool), command, args, flags.setor);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  // Só a mensagem: o erro do Drizzle traz o SQL e os parâmetros.
  const message =
    error instanceof Error ? error.message.split("\n")[0] : String(error);
  console.error(`visual:seed: ${message}`);
  process.exitCode = 1;
});
```

- [ ] **Step 22: Atalhos no `package.json`**

Edit em `package.json`: `old_string` = `    "smoke": "bun scripts/smoke.mjs"` (a última linha de `scripts`, hoje sem vírgula);
`new_string`:

```json
    "smoke": "bun scripts/smoke.mjs",
    "visual:db": "bun scripts/visual/db.ts",
    "visual:seed": "bun scripts/visual/seed/index.ts",
    "visual:people": "node scripts/visual/people.mjs"
```

- [ ] **Step 23: Formatar, tipos, lint e os testes tocados**

Run: `bunx biome check --write scripts/visual test/visual package.json`
Expected: termina sem erro.
Run: `bun run check-types`
Expected: sai com 0. (O `db.ts` e o `seed/*` entram no `tsc` pelo `**/*.ts` do `tsconfig.json`; o `@/` resolve pelo `paths`.)
Run: `bun run lint`
Expected: sai com 0.
Run: `bunx vitest run test/visual/avatarArt.test.ts test/visual/seed.test.ts test/visual/envScript.test.ts test/visual/people.test.ts test/visual/vocabulary.test.ts test/fixtures.test.ts`
Expected: PASS, 6 arquivos (o `fixtures.test.ts` entra porque o seed usa as fixtures; ele não muda).

- [ ] **Step 24: Conferência manual pelo controlador no C1 (não rodar na redação nem na tarefa)**

No C1, a subida (banco, build, `next start`, `base`, `people`, `avatars`) é a dos Steps 1 e 2 dele; as outras linhas
abaixo (as repetições, as recusas e o `--setor`) rodam no Step 8 do C1. Um servidor por vez; derrubar pelo PID no fim.
Na ordem:

```sh
bun run visual:db                     # em segundo plano
# Expected: "banco visual pronto em 127.0.0.1:54332 (dados em .git/sdd/visual-db/pgdata)"
bun run visual:db
# Expected (com o primeiro de pé): "banco visual já está de pé em 127.0.0.1:54332", código 0
bun run visual:db --port=54331
# Expected: "porta recusada: 54331 (o banco visual só usa a 54332)", código 1
. scripts/visual/env.sh && bun run build && bunx next start -p 3202   # em segundo plano
bun run visual:seed base
# Expected: "mundo pronto: 4 setores e 4 convites (em .git/sdd/visual-db/world.json)"
bun run visual:seed base
# Expected: "visual:seed: o banco visual já tem setores: …", código 1
bun run visual:people
# Expected: "ana: cadastrada", "bruno: cadastrada", "carla: cadastrada", "diego: cadastrada"; de novo: "… já existe", código 0
bun run visual:seed avatars
# Expected: "avatares: ana, bruno, carla, diego"
bun run visual:seed state inicio:entregue --setor=Carga
# Expected: "estado inicio:entregue pronto (setor Carga)"; .git/sdd/visual-db/state.json com sector "Carga"
bun run visual:seed state inicio:nada
# Expected: "visual:seed: estado desconhecido: inicio:nada (estados: inicio:admin, …, geral:rico)", código 1
```

Conferir também: nenhum token, senha nem segredo na saída; `git status` limpo (tudo em `.git/sdd/visual-db/`).

- [ ] **Step 25: Commit**

Mensagem gravada com Write em `.git/sdd/processo/msg-task-5.txt`:

```text
chore(visual): banco, ambiente, pessoas e seed visual

db.ts (PGlite em .git/sdd/visual-db na 54332, idempotente, recusa outra
porta), env.sh (54332/3202, segredo gerado em .git/sdd e nunca impresso),
people.mjs (as quatro pessoas pela API, "já existe" é sucesso) e o seed:
mundo com Rampa e vocabulário inventado, estados do Início e o rico com
datas relativas ao agora. Atalhos visual:db, visual:seed e visual:people.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run: `git add package.json scripts/visual/db.ts scripts/visual/env.sh scripts/visual/people.mjs scripts/visual/seed test/visual/avatarArt.test.ts test/visual/seed.test.ts test/visual/envScript.test.ts test/visual/people.test.ts && git commit -F .git/sdd/processo/msg-task-5.txt`
Expected: um commit com 14 arquivos; `git status` limpo.

---

### Task 6: `check-names`, hook local e ferramentas do registro

**Spec:** §5.1, §5.3, §7, §12 · **Redator:** R3 · **Depende de:** T4

**Files:**
- Create: `scripts/visual/names.mjs`
- Create: `scripts/visual/check-names.mjs`
- Create: `scripts/visual/install-hooks.mjs`
- Create: `scripts/visual/docs.mjs`
- Create: `scripts/visual/registry.mjs`
- Create: `scripts/visual/registry-diff.mjs`
- Create: `test/visual/tempRepo.ts` (repositório git temporário para os testes dos CLIs; ver "Decisões tomadas na montagem do plano")
- Modify: `package.json` (`scripts`: `visual:names` e `visual:hooks`)
- Modify: `test/visual/vocabulary.test.ts` (da T4: o caso "com a lista presente, nenhum termo dela no vocabulário",
  spec §12; ver "Decisões tomadas na montagem do plano")
- Test: `test/visual/names.test.ts`, `test/visual/installHooks.test.ts`, `test/visual/docs.test.ts`

Testes existentes que mudam: só o `test/visual/vocabulary.test.ts` (Step 18). `grep -rln "package.json" src test e2e`
acha `test/fontsConfig.test.ts` e `test/vercelConfig.test.ts`, que conferem `fonts`, `predev`, `prebuild` e `engines`:
nenhum depende das chaves novas.

**Interfaces:**
- Consumes (T4): `sddPath(...parts: string[]): string` e `repoRoot(cwd?: string): string` de
  `scripts/visual/paths.mjs`; `parseCliArgs(argv: readonly string[]): { flags: Record<string, string | true>; positional:
  string[] }` de `scripts/visual/config.mjs` (lido como: `--x=v` → `flags.x = "v"`, `--x` → `flags.x = true`, o resto em
  `positional`; conferido contra o `config.mjs` da T4); o `test/visual/vocabulary.test.ts` da T4 (o objeto `VOCABULARY` e
  a função `allStrings`, no Step 18).
- Produces:
  ```js
  // scripts/visual/names.mjs
  export const NAMES_LIST_FILE = "nomes-proibidos.txt";
  /** @typedef {{ listLine: number, kind: "palavra" | "frase" | "email", value: string }} NameTerm */
  /** @typedef {{ terms: NameTerm[], allowed: string[] }} NamesList */
  export function normalizeText(text: string): string;
  export function parseNamesList(text: string): NamesList;
  export function findForbidden(text: string, list: NamesList): { line: number, listLine: number }[];
  export function addedLinesFromDiff(diff: string): { file: string, line: number, text: string }[];
  export function namesListPath(): string;      // sddPath(NAMES_LIST_FILE)
  export function loadNamesList(): NamesList | null;
  // scripts/visual/install-hooks.mjs
  export const HOOK_MARKER = "# closery:check-names";
  export function hookScript(): string;
  export function isOurHook(content: string): boolean;
  // scripts/visual/docs.mjs
  export const DOC_HEADING_LEVELS = { ".context/ui-registry.md": 3, ".context/pendencias.md": 4 }; // congelado
  export function headingsOf(text: string, level: number): string[];
  export function editRegistryEntry(text: string, name: string, op: "historico" | "troca", a: string, b?: string): string;
  export function compareHeadings(base: string, head: string, level: number): { removed: string[], added: string[] };
  ```
  CLIs: `check-names.mjs --staged | --range=<a>...<b> | --file=<caminho>` (0 limpo, 1 achou, 2 lista ausente ou vazia,
  ou uso errado); `install-hooks.mjs [--remove]` (0 ok, 1 recusa, 2 uso errado); `registry.mjs <Componente> historico
  "<frase>" | <Componente> troca "<de>" "<para>"` (0 ok, 1 recusada, 2 uso errado); `registry-diff.mjs <base>
  [head=HEAD]` (0, 1 se sumiu, 2 uso ou revisão). `package.json`: `"visual:names": "node scripts/visual/check-names.mjs"`,
  `"visual:hooks": "node scripts/visual/install-hooks.mjs"`. Quem usa depois: a T7 (`loadNamesList` + `findForbidden` no
  `proto.mjs`), a T9 (o teste da skill) e a revisão por tarefa (`registry-diff`).

- [ ] **Step 1: O repositório temporário dos testes dos CLIs**

Crie `test/visual/tempRepo.ts` (ferramenta Write):

```ts
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

// Repositório git descartável para os testes dos CLIs de scripts/visual. A
// configuração do computador fica de fora (sem a global, sem a do sistema e sem
// nenhuma variável GIT_*: um teste rodado de dentro de um hook não enxerga o
// repositório de verdade). A lista de nomes, quando um teste precisa dela, é
// sintética e mora no .git/sdd do repositório temporário.

/** Pasta dos scripts; o Vitest roda na raiz do repositório. */
export const SCRIPTS_DIR = resolve("scripts", "visual");

export type CliResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

export type TempRepo = {
  /** a árvore de trabalho */
  dir: string;
  git: (...args: string[]) => string;
  write: (relative: string, content: string) => void;
  /** roda `node scripts/visual/<script>` com a raiz do repositório temporário como cwd */
  run: (script: string, args?: string[]) => CliResult;
  remove: () => void;
};

export function createTempRepo(): TempRepo {
  const base = mkdtempSync(join(tmpdir(), "closery-visual-"));
  const dir = join(base, "repo");
  mkdirSync(dir);
  const globalConfig = join(base, "gitconfig");
  writeFileSync(globalConfig, "");
  const env: NodeJS.ProcessEnv = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
    ),
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_AUTHOR_NAME: "Ana Teste",
    GIT_AUTHOR_EMAIL: "ana.teste@example.com",
    GIT_COMMITTER_NAME: "Ana Teste",
    GIT_COMMITTER_EMAIL: "ana.teste@example.com",
  };
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: dir,
      env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  const write = (relative: string, content: string) => {
    const file = join(dir, relative);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  };
  const run = (script: string, args: string[] = []): CliResult => {
    const result = spawnSync(
      process.execPath,
      [join(SCRIPTS_DIR, script), ...args],
      { cwd: dir, env, encoding: "utf8" },
    );
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  };
  git("init", "-q", "-b", "main");
  return {
    dir,
    git,
    write,
    run,
    remove: () => rmSync(base, { recursive: true, force: true }),
  };
}
```

- [ ] **Step 2: Escrever o teste da lista, da busca, do diff e do `check-names`**

Crie `test/visual/names.test.ts` (ferramenta Write; os termos são inventados e não estão na lista de verdade):

```ts
import { rmSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  addedLinesFromDiff,
  findForbidden,
  NAMES_LIST_FILE,
  normalizeText,
  parseNamesList,
} from "../../scripts/visual/names.mjs";
import { createTempRepo, type TempRepo } from "./tempRepo";

// Regras do check-names (spec §7) com uma lista sintética de termos inventados.
// Nada aqui lê a lista de verdade (.git/sdd/nomes-proibidos.txt), que só existe
// na máquina do controlador; os CLIs rodam num repositório git temporário.

const LIST_TEXT = [
  "# termos inventados para o teste",
  "",
  "Zorvalda",
  "Lampião Torto",
  "zorvalda.torto@exemplo.test",
  "Ação Ímpar",
  "!Zorvalda Teste",
  "!zorvalda.teste@example.com",
  "!",
].join("\n");

const list = parseNamesList(LIST_TEXT);

describe("normalizeText", () => {
  it("tira acento e caixa", () => {
    expect(normalizeText("Ação ÍMPAR Çedilha")).toBe("acao impar cedilha");
  });

  it("texto vazio continua vazio", () => {
    expect(normalizeText("")).toBe("");
  });
});

describe("parseNamesList", () => {
  it("ignora comentário e linha vazia e guarda a linha de cada termo no arquivo", () => {
    expect(list.terms).toEqual([
      { listLine: 3, kind: "palavra", value: "zorvalda" },
      { listLine: 4, kind: "frase", value: "lampiao torto" },
      { listLine: 5, kind: "email", value: "zorvalda.torto@exemplo.test" },
      { listLine: 6, kind: "frase", value: "acao impar" },
    ]);
  });

  it('"!" marca uma frase permitida; "!" sozinho não conta', () => {
    expect(list.allowed).toEqual([
      "zorvalda teste",
      "zorvalda.teste@example.com",
    ]);
  });

  it("lista vazia ou só com comentários não tem termo", () => {
    expect(parseNamesList("")).toEqual({ terms: [], allowed: [] });
    expect(parseNamesList("# só comentário\n\n   \n").terms).toEqual([]);
  });

  it("aceita CRLF, BOM e espaços repetidos", () => {
    const parsed = parseNamesList("﻿# c\r\n  Lampião    Torto  \r\n");
    expect(parsed.terms).toEqual([
      { listLine: 2, kind: "frase", value: "lampiao torto" },
    ]);
  });
});

describe("findForbidden", () => {
  it("palavra casa só inteira, sem caixa e sem acento", () => {
    expect(findForbidden("a ZÓRVALDA chegou.", list)).toEqual([
      { line: 1, listLine: 3 },
    ]);
    expect(findForbidden("Zorvalda.", list)).toEqual([{ line: 1, listLine: 3 }]);
    expect(findForbidden("Zorvaldas", list)).toEqual([]);
    expect(findForbidden("xzorvalda", list)).toEqual([]);
    expect(findForbidden("zorvalda_2", list)).toEqual([]);
  });

  it("frase casa com qualquer espaço entre as palavras, nunca pela metade", () => {
    expect(findForbidden("o lampiao   TORTO apagou", list)).toEqual([
      { line: 1, listLine: 4 },
    ]);
    expect(findForbidden("acao impar", list)).toEqual([{ line: 1, listLine: 6 }]);
    expect(findForbidden("Lampião", list)).toEqual([]);
    expect(findForbidden("lampião tortos", list)).toEqual([]);
  });

  it("e-mail casa como trecho (e a palavra dentro dele também)", () => {
    expect(findForbidden("<zorvalda.torto@exemplo.test>", list)).toEqual([
      { line: 1, listLine: 3 },
      { line: 1, listLine: 5 },
    ]);
  });

  it("o trecho permitido sai do texto antes da busca", () => {
    expect(findForbidden("Zorvalda Teste assinou", list)).toEqual([]);
    expect(findForbidden("zorvalda.teste@example.com", list)).toEqual([]);
    expect(findForbidden("Zorvalda Teste e Zorvalda", list)).toEqual([
      { line: 1, listLine: 3 },
    ]);
  });

  it("o trecho permitido não junta as palavras dos dois lados numa frase proibida", () => {
    expect(findForbidden("Lampião Zorvalda Teste Torto", list)).toEqual([]);
  });

  it("conta as linhas a partir de 1, com LF ou CRLF", () => {
    expect(findForbidden("ok\nZorvalda\r\nok\nLampião Torto", list)).toEqual([
      { line: 2, listLine: 3 },
      { line: 4, listLine: 4 },
    ]);
  });

  it("caractere especial de regex no termo é literal", () => {
    const special = parseNamesList("C++ (beta)\n[x]*");
    expect(findForbidden("uso C++ (beta) aqui", special)).toEqual([
      { line: 1, listLine: 1 },
    ]);
    expect(findForbidden("C (beta)", special)).toEqual([]);
  });

  it("texto vazio ou lista vazia: nada", () => {
    expect(findForbidden("", list)).toEqual([]);
    expect(findForbidden("Zorvalda", parseNamesList(""))).toEqual([]);
  });
});

describe("addedLinesFromDiff", () => {
  it("lê vários arquivos e hunks do diff -U0, com o número da linha nova", () => {
    const diff = [
      "diff --git a/a.txt b/a.txt",
      "index 1111111..2222222 100644",
      "--- a/a.txt",
      "+++ b/a.txt",
      "@@ -1,0 +2,2 @@",
      "+linha dois",
      "+linha três",
      "@@ -10 +12 @@",
      "-velha",
      "+nova",
      "diff --git a/dir com espaço/b.md b/dir com espaço/b.md",
      "new file mode 100644",
      "index 0000000..3333333",
      "--- /dev/null",
      "+++ b/dir com espaço/b.md\t",
      "@@ -0,0 +1,2 @@",
      "+++ começa com mais",
      "+fim",
      "\\ No newline at end of file",
      "diff --git a/apagado.txt b/apagado.txt",
      "deleted file mode 100644",
      "--- a/apagado.txt",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-adeus",
      "",
    ].join("\n");
    expect(addedLinesFromDiff(diff)).toEqual([
      { file: "a.txt", line: 2, text: "linha dois" },
      { file: "a.txt", line: 3, text: "linha três" },
      { file: "a.txt", line: 12, text: "nova" },
      { file: "dir com espaço/b.md", line: 1, text: "++ começa com mais" },
      { file: "dir com espaço/b.md", line: 2, text: "fim" },
    ]);
  });

  it("caminho entre aspas, com bytes em octal, vira UTF-8", () => {
    const diff = [
      'diff --git "a/acentua\\303\\247\\303\\243o.md" "b/acentua\\303\\247\\303\\243o.md"',
      '+++ "b/acentua\\303\\247\\303\\243o.md"',
      "@@ -0,0 +1 @@",
      "+x",
    ].join("\n");
    expect(addedLinesFromDiff(diff)).toEqual([
      { file: "acentuação.md", line: 1, text: "x" },
    ]);
  });

  it("conta as linhas de contexto quando o diff não é -U0", () => {
    const diff = [
      "+++ b/c.txt",
      "@@ -1,3 +1,4 @@",
      " contexto",
      "+novo",
      " contexto",
      " contexto",
    ].join("\n");
    expect(addedLinesFromDiff(diff)).toEqual([
      { file: "c.txt", line: 2, text: "novo" },
    ]);
  });

  it("diff vazio e arquivo binário não têm linha", () => {
    expect(addedLinesFromDiff("")).toEqual([]);
    expect(
      addedLinesFromDiff(
        "diff --git a/x.png b/x.png\nBinary files /dev/null and b/x.png differ\n",
      ),
    ).toEqual([]);
  });
});

describe("check-names.mjs (CLI)", () => {
  let repo: TempRepo;
  const listFile = () => join(repo.dir, ".git", "sdd", NAMES_LIST_FILE);
  const writeList = (text: string) =>
    repo.write(join(".git", "sdd", NAMES_LIST_FILE), text);
  const output = (result: { stdout: string; stderr: string }) =>
    `${result.stdout}${result.stderr}`;

  beforeAll(() => {
    repo = createTempRepo();
    repo.write("LEIA.md", "repositório de teste\n");
    repo.git("add", "LEIA.md");
    repo.git("commit", "-q", "-m", "inicio");
  });

  afterAll(() => repo.remove());

  beforeEach(() => {
    repo.git("reset", "-q");
    writeList(LIST_TEXT);
  });

  it("sem a lista: código 2, com o caminho dela e a saída do hook", () => {
    rmSync(listFile());
    const result = repo.run("check-names.mjs", ["--staged"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(NAMES_LIST_FILE);
    expect(result.stderr).toContain("bun run visual:hooks --remove");
  });

  it("lista só com comentários conta como vazia: código 2", () => {
    writeList("# nada aqui\n\n!Zorvalda Teste\n");
    expect(repo.run("check-names.mjs", ["--staged"]).status).toBe(2);
  });

  it.each([
    [[]],
    [["--staged", "--file=LEIA.md"]],
    [["--range=main"]],
    [["--range=main..HEAD"]],
    [["--staged=sim"]],
    [["--desconhecido"]],
    [["--staged", "extra"]],
  ])("uso errado %j: código 2 com o uso", (args) => {
    const result = repo.run("check-names.mjs", args);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Uso:");
  });

  it("--staged limpo: código 0", () => {
    repo.write("ok.txt", "nada da lista aqui\nZorvalda Teste assinou\n");
    repo.git("add", "ok.txt");
    const result = repo.run("check-names.mjs", ["--staged"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("nada da lista");
  });

  it("--staged com um termo: código 1, arquivo e linha, sem imprimir o termo", () => {
    repo.write("notas.txt", "linha um\na Zorvalda veio\n");
    repo.git("add", "notas.txt");
    const result = repo.run("check-names.mjs", ["--staged"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "notas.txt:2 — termo nº 1 da lista (linha 3)",
    );
    expect(normalizeText(output(result))).not.toContain("zorvalda");
  });

  it("--staged com o termo no caminho: o caminho vira número e não é impresso", () => {
    repo.write(join("pasta", "Zorvalda.txt"), "conteúdo limpo\n");
    repo.git("add", "pasta");
    const result = repo.run("check-names.mjs", ["--staged"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "caminho nº 1 do diff — termo nº 1 da lista (linha 3)",
    );
    expect(normalizeText(output(result))).not.toContain("zorvalda");
  });

  it("--file confere o arquivo inteiro; arquivo que não existe é uso errado", () => {
    repo.write("conferir.html", "<p>ok</p>\n<p>Ação Ímpar</p>\n");
    const found = repo.run("check-names.mjs", ["--file=conferir.html"]);
    expect(found.status).toBe(1);
    expect(found.stderr).toContain(
      "conferir.html:2 — termo nº 4 da lista (linha 6)",
    );
    expect(normalizeText(output(found))).not.toContain("impar");
    expect(repo.run("check-names.mjs", ["--file=nao-existe.txt"]).status).toBe(2);
  });
});

describe("check-names.mjs --range (CLI)", () => {
  let repo: TempRepo;
  let sha = "";

  beforeAll(() => {
    repo = createTempRepo();
    repo.write(join(".git", "sdd", NAMES_LIST_FILE), LIST_TEXT);
    repo.write("LEIA.md", "repositório de teste\n");
    repo.git("add", "LEIA.md");
    repo.git("commit", "-q", "-m", "inicio");
    repo.git("switch", "-q", "-c", "limpa");
    repo.write("limpo.txt", "nada aqui\n");
    repo.git("add", "limpo.txt");
    repo.git("commit", "-q", "-m", "limpo");
    repo.git("switch", "-q", "-c", "suja");
    repo.write("texto.md", "começo\n\nfim com Lampião Torto\n");
    repo.write(join(".git", "sdd", "msg.txt"), "assunto\n\ncorpo com Zorvalda\n");
    repo.git("add", "texto.md");
    repo.git("commit", "-q", "-F", join(".git", "sdd", "msg.txt"));
    sha = repo.git("rev-parse", "--short=7", "HEAD").trim();
    repo.git("switch", "-q", "main");
  });

  afterAll(() => repo.remove());

  it("diff e mensagens limpos: código 0", () => {
    expect(repo.run("check-names.mjs", ["--range=main...limpa"]).status).toBe(0);
  });

  it("acha no diff e na mensagem do commit, sem imprimir o termo", () => {
    const result = repo.run("check-names.mjs", ["--range=main...suja"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "texto.md:3 — termo nº 2 da lista (linha 4)",
    );
    expect(result.stderr).toContain(
      `mensagem do commit ${sha}, linha 3 — termo nº 1 da lista (linha 3)`,
    );
    expect(normalizeText(`${result.stdout}${result.stderr}`)).not.toMatch(
      /zorvalda|lampiao/,
    );
  });

  it("revisão que não existe: código 2", () => {
    expect(repo.run("check-names.mjs", ["--range=main...nada"]).status).toBe(2);
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `bunx vitest run test/visual/names.test.ts`
Expected: FAIL com `Error: Cannot find module '../../scripts/visual/names.mjs' imported from …/test/visual/names.test.ts`.

- [ ] **Step 4: Implementar `names.mjs`**

Crie `scripts/visual/names.mjs` (ferramenta Write):

```js
// Regras da guarda de nomes (spec §7): ler a lista de nomes, e-mails e textos dos
// protótipos, procurar os termos dela num texto e tirar as linhas acrescentadas
// de um diff. A lista mora fora do git (.git/sdd/nomes-proibidos.txt, achada pelo
// paths.mjs); aqui ninguém imprime um termo: quem acha devolve só o número da
// linha do texto e o da linha da lista (PB-D7). Testado em test/visual/names.test.ts.
import { existsSync, readFileSync } from "node:fs";

import { sddPath } from "./paths.mjs";

export const NAMES_LIST_FILE = "nomes-proibidos.txt";

/** @typedef {{ listLine: number, kind: "palavra" | "frase" | "email", value: string }} NameTerm */
/** @typedef {{ terms: NameTerm[], allowed: string[] }} NamesList */
/** @typedef {{ line: number, listLine: number }} NameHit */
/** @typedef {{ file: string, line: number, text: string }} AddedLine */

// Letra, dígito ou sublinhado: o que não pode encostar numa palavra ou frase.
const WORD_CHAR = String.raw`[\p{L}\p{N}_]`;
// O trecho permitido sai do texto trocado por um caractere que não é letra nem
// espaço: as palavras dos dois lados nunca se juntam numa frase proibida.
const ALLOWED_GAP = "\u0000";

/** @type {WeakMap<NamesList, { terms: { listLine: number, test: RegExp }[], allowed: RegExp[] }>} */
const compiled = new WeakMap();

/**
 * Sem acento e em minúsculas: "Ação" e "acao" casam.
 * @param {string} text
 * @returns {string}
 */
export function normalizeText(text) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** @param {string} value */
function collapse(value) {
  return normalizeText(value).trim().replace(/\s+/g, " ");
}

/**
 * @param {string} value já normalizado
 * @returns {NameTerm["kind"]}
 */
function kindOf(value) {
  if (value.includes("@")) return "email";
  return value.includes(" ") ? "frase" : "palavra";
}

/**
 * Uma entrada por linha. Linha vazia e linha com "#" não contam; "!<frase>" é
 * permitida (sai do texto antes da busca). `listLine` é a linha no arquivo.
 * @param {string} text
 * @returns {NamesList}
 */
export function parseNamesList(text) {
  /** @type {NameTerm[]} */
  const terms = [];
  /** @type {string[]} */
  const allowed = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = (lines[index] ?? "").trim();
    if (line === "" || line.startsWith("#")) continue;
    if (line.startsWith("!")) {
      const value = collapse(line.slice(1));
      if (value !== "") allowed.push(value);
      continue;
    }
    const value = collapse(line);
    terms.push({ listLine: index + 1, kind: kindOf(value), value });
  }
  return { terms, allowed };
}

/**
 * E-mail casa como trecho; palavra e frase, só inteiras (sem letra, dígito ou
 * "_" encostado), com qualquer espaço entre as palavras.
 * @param {string} value normalizado
 * @param {string} flags
 * @returns {RegExp}
 */
function matcherOf(value, flags) {
  const body = value
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/ /g, String.raw`\s+`);
  if (value.includes("@")) return new RegExp(body, flags);
  return new RegExp(`(?<!${WORD_CHAR})${body}(?!${WORD_CHAR})`, flags);
}

/** @param {NamesList} list */
function compile(list) {
  const cached = compiled.get(list);
  if (cached) return cached;
  const result = {
    terms: list.terms.map((term) => ({
      listLine: term.listLine,
      test: matcherOf(term.value, "u"),
    })),
    allowed: list.allowed.map((value) => matcherOf(value, "gu")),
  };
  compiled.set(list, result);
  return result;
}

/**
 * Procura os termos da lista, linha a linha, sem caixa e sem acento.
 * @param {string} text
 * @param {NamesList} list
 * @returns {NameHit[]} um por termo achado em cada linha, na ordem das linhas
 */
export function findForbidden(text, list) {
  const { terms, allowed } = compile(list);
  /** @type {NameHit[]} */
  const hits = [];
  if (terms.length === 0 || text === "") return hits;
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    let line = normalizeText(lines[index] ?? "");
    for (const matcher of allowed) line = line.replace(matcher, ALLOWED_GAP);
    for (const term of terms) {
      if (term.test.test(line)) {
        hits.push({ line: index + 1, listLine: term.listLine });
      }
    }
  }
  return hits;
}

/** @type {Readonly<Record<string, number>>} */
const GIT_ESCAPES = {
  a: 7,
  b: 8,
  t: 9,
  n: 10,
  v: 11,
  f: 12,
  r: 13,
  '"': 34,
  "\\": 92,
};

/**
 * Caminho entre aspas do git ("b/a\303\247\303\243o.md"): escapes do C e bytes
 * em octal, lidos como UTF-8.
 * @param {string} quoted
 * @returns {string}
 */
function unquoteGitPath(quoted) {
  const body = quoted.slice(1, -1);
  const encoder = new TextEncoder();
  /** @type {number[]} */
  const bytes = [];
  let i = 0;
  while (i < body.length) {
    if (body[i] === "\\") {
      const octal = /^[0-7]{3}/.exec(body.slice(i + 1, i + 4));
      if (octal) {
        bytes.push(Number.parseInt(octal[0], 8));
        i += 4;
        continue;
      }
      const escaped = body[i + 1] ?? "";
      bytes.push(GIT_ESCAPES[escaped] ?? escaped.charCodeAt(0));
      i += 2;
      continue;
    }
    const char = String.fromCodePoint(body.codePointAt(i) ?? 0);
    bytes.push(...encoder.encode(char));
    i += char.length;
  }
  return new TextDecoder().decode(Uint8Array.from(bytes));
}

/**
 * O caminho do cabeçalho "+++ b/<caminho>" (com o TAB que o git põe no fim
 * quando o caminho tem espaço, e as aspas quando tem caractere especial).
 * @param {string} rest o que vem depois de "+++ "
 * @returns {string | null} null para "/dev/null" (arquivo apagado)
 */
function pathOfHeader(rest) {
  let path = rest.endsWith("\t") ? rest.slice(0, -1) : rest;
  if (path === "/dev/null") return null;
  if (path.startsWith('"') && path.endsWith('"')) path = unquoteGitPath(path);
  return path.startsWith("b/") ? path.slice(2) : path;
}

/**
 * As linhas acrescentadas de um `git diff` (feito para `-U0`; linhas de
 * contexto também são contadas). Os contadores do cabeçalho do hunk decidem o
 * que é linha do hunk: uma linha acrescentada "++ x" aparece como "+++ x" e
 * não é confundida com o cabeçalho do arquivo.
 * @param {string} diff
 * @returns {AddedLine[]}
 */
export function addedLinesFromDiff(diff) {
  /** @type {AddedLine[]} */
  const added = [];
  /** @type {string | null} */
  let file = null;
  let oldLeft = 0;
  let newLeft = 0;
  let next = 0;
  for (const raw of diff.split("\n")) {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (oldLeft > 0 || newLeft > 0) {
      if (line.startsWith("\\")) continue;
      if (line.startsWith("+")) {
        if (file !== null)
          added.push({ file, line: next, text: line.slice(1) });
        next++;
        newLeft--;
        continue;
      }
      if (line.startsWith("-")) {
        oldLeft--;
        continue;
      }
      if (line.startsWith(" ")) {
        oldLeft--;
        newLeft--;
        next++;
        continue;
      }
      oldLeft = 0;
      newLeft = 0;
    }
    if (line.startsWith("diff --git ")) {
      file = null;
      continue;
    }
    if (line.startsWith("+++ ")) {
      file = pathOfHeader(line.slice(4));
      continue;
    }
    const hunk = /^@@ -\d+(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk) {
      oldLeft = hunk[1] === undefined ? 1 : Number(hunk[1]);
      next = Number(hunk[2]);
      newLeft = hunk[3] === undefined ? 1 : Number(hunk[3]);
    }
  }
  return added;
}

/**
 * Onde a lista mora: `<git-common-dir>/sdd/nomes-proibidos.txt` (vale para
 * worktree, onde `.git` é um arquivo).
 * @returns {string}
 */
export function namesListPath() {
  return sddPath(NAMES_LIST_FILE);
}

/**
 * A lista lida e interpretada, ou `null` quando o arquivo não existe (no CI ele
 * nunca existe: quem depende dele usa `it.skipIf`).
 * @returns {NamesList | null}
 */
export function loadNamesList() {
  const file = namesListPath();
  if (!existsSync(file)) return null;
  return parseNamesList(readFileSync(file, "utf8"));
}
```

- [ ] **Step 5: Rodar e ver as regras passarem (o CLI ainda falta)**

Run: `bunx vitest run test/visual/names.test.ts`
Expected: `Tests  16 failed | 18 passed (34)`; os 16 vermelhos são os dos dois `describe` do CLI, com
`AssertionError: expected 1 to be 2` e afins (o `node` sai com 1 porque `check-names.mjs` não existe).

- [ ] **Step 6: Implementar `check-names.mjs`**

Crie `scripts/visual/check-names.mjs` (ferramenta Write):

```js
// Guarda de nomes (spec §7): nada da lista .git/sdd/nomes-proibidos.txt (nomes,
// e-mails e textos dos protótipos, fora do git) entra num commit.
//   node scripts/visual/check-names.mjs --staged             o pre-commit
//   node scripts/visual/check-names.mjs --range=main...HEAD  o portão (diff e mensagens)
//   node scripts/visual/check-names.mjs --file=<caminho>     conferência avulsa
// Código 0: limpo. 1: achou. 2: lista ausente ou vazia, ou uso errado.
// O relatório nunca leva o termo (PB-D7): só o número dele e a linha da lista.
// As regras moram em names.mjs (testadas); aqui só se lê o git e se imprime.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { parseCliArgs } from "./config.mjs";
import {
  addedLinesFromDiff,
  findForbidden,
  loadNamesList,
  namesListPath,
} from "./names.mjs";

const USAGE =
  "Uso: node scripts/visual/check-names.mjs --staged | --range=<a>...<b> | --file=<caminho>";
const MODES = ["staged", "range", "file"];
// Diff estável qualquer que seja a configuração de quem roda: sem cor, sem
// diff externo, prefixos a/ e b/, caminho da raiz e só as linhas mudadas.
const DIFF_FLAGS = [
  "--no-color",
  "--no-ext-diff",
  "--no-relative",
  "--src-prefix=a/",
  "--dst-prefix=b/",
  "-U0",
];

class UsageError extends Error {}

/**
 * @param {string[]} args
 * @returns {string}
 */
function git(args) {
  return execFileSync("git", ["-c", "core.quotePath=false", ...args], {
    encoding: "utf8",
    maxBuffer: 512 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/**
 * @typedef {{ mode: "staged" } | { mode: "range", from: string, to: string } | { mode: "file", file: string }} Mode
 * @param {string[]} argv
 * @returns {Mode}
 */
function readMode(argv) {
  const { flags, positional } = parseCliArgs(argv);
  const names = Object.keys(flags);
  const chosen = MODES.filter((mode) => names.includes(mode));
  if (
    positional.length > 0 ||
    chosen.length !== 1 ||
    names.length !== chosen.length
  ) {
    throw new UsageError(USAGE);
  }
  const value = flags[chosen[0] ?? ""];
  if (chosen[0] === "staged") {
    if (value !== true) throw new UsageError(USAGE);
    return { mode: "staged" };
  }
  if (typeof value !== "string" || value === "") throw new UsageError(USAGE);
  if (chosen[0] === "file") return { mode: "file", file: value };
  const parts = value.split("...");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new UsageError(`--range pede <a>...<b> (três pontos). ${USAGE}`);
  }
  return { mode: "range", from: parts[0], to: parts[1] };
}

/**
 * @param {string[]} args
 * @returns {string[]}
 */
function changedPaths(args) {
  return git([
    "diff",
    "--name-only",
    "-z",
    "--no-relative",
    "--diff-filter=d",
    ...args,
  ])
    .split("\0")
    .filter((path) => path !== "");
}

/**
 * @param {string} range "<a>..<b>"
 * @returns {{ sha: string, text: string }[]}
 */
function commitMessages(range) {
  return git(["log", "-z", "--format=%H%n%B", range])
    .split("\0")
    .map((chunk) => chunk.replace(/^\n+/, ""))
    .filter((chunk) => chunk !== "")
    .map((chunk) => {
      const end = chunk.indexOf("\n");
      return end < 0
        ? { sha: chunk, text: "" }
        : { sha: chunk.slice(0, end), text: chunk.slice(end + 1) };
    });
}

/**
 * @param {Mode} mode
 * @returns {{ paths: string[], lines: import("./names.mjs").AddedLine[], messages: { sha: string, text: string }[] }}
 */
function collect(mode) {
  if (mode.mode === "staged") {
    return {
      paths: changedPaths(["--cached"]),
      lines: addedLinesFromDiff(git(["diff", "--cached", ...DIFF_FLAGS])),
      messages: [],
    };
  }
  if (mode.mode === "range") {
    const range = `${mode.from}...${mode.to}`;
    return {
      paths: changedPaths([range]),
      lines: addedLinesFromDiff(git(["diff", ...DIFF_FLAGS, range])),
      messages: commitMessages(`${mode.from}..${mode.to}`),
    };
  }
  if (!existsSync(mode.file)) {
    throw new UsageError(`arquivo não encontrado: ${mode.file}`);
  }
  const text = readFileSync(mode.file, "utf8");
  return {
    paths: [],
    lines: text
      .split(/\r?\n/)
      .map((line, index) => ({ file: mode.file, line: index + 1, text: line })),
    messages: [],
  };
}

/**
 * @param {import("./names.mjs").NamesList} list
 * @param {{ paths: string[], lines: import("./names.mjs").AddedLine[], messages: { sha: string, text: string }[] }} sources
 * @returns {string[]}
 */
function findings(list, sources) {
  /** @param {number} listLine */
  const termRef = (listLine) => {
    const number =
      list.terms.findIndex((term) => term.listLine === listLine) + 1;
    return `termo nº ${number} da lista (linha ${listLine})`;
  };
  // Um caminho que tem um termo nunca é impresso: vira o número dele no diff.
  /** @param {string} file */
  const labelOf = (file) => {
    if (findForbidden(file, list).length === 0) return file;
    const index = sources.paths.indexOf(file);
    return index < 0 ? "o arquivo" : `arquivo nº ${index + 1} do diff`;
  };
  /** @type {string[]} */
  const out = [];
  sources.paths.forEach((path, index) => {
    for (const hit of findForbidden(path, list)) {
      out.push(`caminho nº ${index + 1} do diff — ${termRef(hit.listLine)}`);
    }
  });
  /** @type {Map<string, import("./names.mjs").AddedLine[]>} */
  const byFile = new Map();
  for (const line of sources.lines) {
    byFile.set(line.file, [...(byFile.get(line.file) ?? []), line]);
  }
  for (const [file, lines] of byFile) {
    const text = lines.map((line) => line.text).join("\n");
    for (const hit of findForbidden(text, list)) {
      const where = lines[hit.line - 1]?.line ?? hit.line;
      out.push(`${labelOf(file)}:${where} — ${termRef(hit.listLine)}`);
    }
  }
  for (const message of sources.messages) {
    for (const hit of findForbidden(message.text, list)) {
      out.push(
        `mensagem do commit ${message.sha.slice(0, 7)}, linha ${hit.line} — ${termRef(hit.listLine)}`,
      );
    }
  }
  return out;
}

/**
 * @param {string[]} argv
 * @returns {0 | 1 | 2}
 */
function main(argv) {
  let mode;
  try {
    mode = readMode(argv);
  } catch (error) {
    console.error(
      `check-names: ${error instanceof Error ? error.message : USAGE}`,
    );
    return 2;
  }
  let list;
  let sources;
  try {
    list = loadNamesList();
    if (list === null || list.terms.length === 0) {
      console.error(
        `check-names: a lista ${namesListPath()} não existe ou não tem nenhum termo. Crie a lista (uma entrada por linha; library-docs.md §22) ou tire o hook com "bun run visual:hooks --remove".`,
      );
      return 2;
    }
    sources = collect(mode);
  } catch (error) {
    console.error(
      `check-names: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 2;
  }
  const found = findings(list, sources);
  if (found.length === 0) {
    console.log(
      `check-names: nada da lista em ${sources.lines.length} linha(s), ${sources.paths.length} caminho(s) e ${sources.messages.length} mensagem(ns).`,
    );
    return 0;
  }
  for (const line of found) console.error(line);
  console.error(
    `check-names: ${found.length} achado(s). Troque o texto por um inventado (scripts/visual/vocabulary.mjs); falso positivo vira uma linha "!<frase>" na lista (library-docs.md §22).`,
  );
  return 1;
}

process.exitCode = main(process.argv.slice(2));
```

- [ ] **Step 7: Rodar e ver passar**

Run: `bunx vitest run test/visual/names.test.ts`
Expected: `Tests  34 passed (34)` (cerca de 4 s: cada caso do CLI abre um `node` e um `git`).

- [ ] **Step 8: Escrever o teste do hook**

Crie `test/visual/installHooks.test.ts` (ferramenta Write):

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  HOOK_MARKER,
  hookScript,
  isOurHook,
} from "../../scripts/visual/install-hooks.mjs";
import { createTempRepo, type TempRepo } from "./tempRepo";

// O pre-commit do check-names (spec §7): o script, a marca e o CLI que instala,
// regrava e remove só o nosso, num repositório git temporário.

const FOREIGN_HOOK = "#!/bin/sh\nexec npx lint-staged\n";

describe("hookScript", () => {
  it("é o script da spec §7, com LF e a marca na segunda linha", () => {
    expect(HOOK_MARKER).toBe("# closery:check-names");
    expect(hookScript()).toBe(
      "#!/bin/sh\n# closery:check-names (instalado por scripts/visual/install-hooks.mjs)\nexec node scripts/visual/check-names.mjs --staged\n",
    );
    expect(hookScript()).not.toContain("\r");
  });
});

describe("isOurHook", () => {
  it("reconhece o nosso, também com CRLF", () => {
    expect(isOurHook(hookScript())).toBe(true);
    expect(isOurHook(hookScript().replaceAll("\n", "\r\n"))).toBe(true);
    expect(isOurHook(`#!/bin/sh\n${HOOK_MARKER}\n`)).toBe(true);
  });

  it("recusa hook alheio, vazio, marca no meio da linha ou com outro sufixo", () => {
    expect(isOurHook("")).toBe(false);
    expect(isOurHook(FOREIGN_HOOK)).toBe(false);
    expect(isOurHook(`echo '${HOOK_MARKER}'\n`)).toBe(false);
    expect(isOurHook(`${HOOK_MARKER}-outro\n`)).toBe(false);
  });
});

describe("install-hooks.mjs (CLI)", () => {
  let repo: TempRepo;
  const defaultHook = () => join(repo.dir, ".git", "hooks", "pre-commit");

  beforeEach(() => {
    repo = createTempRepo();
  });

  afterEach(() => repo.remove());

  it("instala em .git/hooks/pre-commit e regrava sem erro (idempotente)", () => {
    const first = repo.run("install-hooks.mjs");
    expect(first.status).toBe(0);
    expect(first.stdout).toContain("hook instalado");
    expect(readFileSync(defaultHook(), "utf8")).toBe(hookScript());
    const second = repo.run("install-hooks.mjs");
    expect(second.status).toBe(0);
    expect(second.stdout).toContain("hook regravado");
    expect(readFileSync(defaultHook(), "utf8")).toBe(hookScript());
  });

  it("respeita o core.hooksPath", () => {
    repo.git("config", "core.hooksPath", ".githooks");
    expect(repo.run("install-hooks.mjs").status).toBe(0);
    expect(readFileSync(join(repo.dir, ".githooks", "pre-commit"), "utf8")).toBe(
      hookScript(),
    );
    expect(existsSync(defaultHook())).toBe(false);
  });

  it("recusa um pre-commit alheio com código 1 e não o toca", () => {
    repo.write(join(".git", "hooks", "pre-commit"), FOREIGN_HOOK);
    const result = repo.run("install-hooks.mjs");
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("não é deste projeto");
    expect(readFileSync(defaultHook(), "utf8")).toBe(FOREIGN_HOOK);
  });

  it("--remove apaga o nosso; sem hook não faz nada e sai com 0", () => {
    repo.run("install-hooks.mjs");
    const removed = repo.run("install-hooks.mjs", ["--remove"]);
    expect(removed.status).toBe(0);
    expect(existsSync(defaultHook())).toBe(false);
    const again = repo.run("install-hooks.mjs", ["--remove"]);
    expect(again.status).toBe(0);
    expect(again.stdout).toContain("nada a remover");
  });

  it("--remove recusa o hook alheio (código 1) e o deixa como está", () => {
    repo.write(join(".git", "hooks", "pre-commit"), FOREIGN_HOOK);
    expect(repo.run("install-hooks.mjs", ["--remove"]).status).toBe(1);
    expect(readFileSync(defaultHook(), "utf8")).toBe(FOREIGN_HOOK);
  });

  it.each([[["--forca"]], [["extra"]], [["--remove=sim"]]])(
    "argumento desconhecido %j: código 2 e nada gravado",
    (args) => {
      const result = repo.run("install-hooks.mjs", args);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("Uso:");
      expect(existsSync(defaultHook())).toBe(false);
    },
  );
});
```

- [ ] **Step 9: Rodar e ver falhar**

Run: `bunx vitest run test/visual/installHooks.test.ts`
Expected: FAIL com `Error: Cannot find module '../../scripts/visual/install-hooks.mjs' imported from …/test/visual/installHooks.test.ts`.

- [ ] **Step 10: Implementar `install-hooks.mjs`**

Crie `scripts/visual/install-hooks.mjs` (ferramenta Write):

```js
// Instala o pre-commit que roda o check-names (spec §7):
//   node scripts/visual/install-hooks.mjs           instala ou regrava o nosso
//   node scripts/visual/install-hooks.mjs --remove  apaga só o nosso
// Grava só o arquivo de `git rev-parse --git-path hooks/pre-commit` (respeita o
// core.hooksPath; fora da árvore de trabalho): é a exceção declarada à regra do
// .git/sdd. Um pre-commit que não é deste projeto nunca é tocado (código 1).
import { execFileSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseCliArgs } from "./config.mjs";

export const HOOK_MARKER = "# closery:check-names";

const USAGE = "Uso: node scripts/visual/install-hooks.mjs [--remove]";

/**
 * O pre-commit, com LF (o sh do Git para Windows não aceita CRLF).
 * @returns {string}
 */
export function hookScript() {
  return [
    "#!/bin/sh",
    `${HOOK_MARKER} (instalado por scripts/visual/install-hooks.mjs)`,
    "exec node scripts/visual/check-names.mjs --staged",
    "",
  ].join("\n");
}

/**
 * É o nosso quando uma linha começa pela marca (seguida de espaço ou do fim).
 * @param {string} content
 * @returns {boolean}
 */
export function isOurHook(content) {
  return content
    .split(/\r?\n/)
    .some((line) => line === HOOK_MARKER || line.startsWith(`${HOOK_MARKER} `));
}

/** @returns {string} */
function hookPath() {
  return execFileSync(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-path", "hooks/pre-commit"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
}

/**
 * @param {string[]} argv
 * @returns {0 | 1 | 2}
 */
function main(argv) {
  const { flags, positional } = parseCliArgs(argv);
  const unknown = Object.keys(flags).filter((name) => name !== "remove");
  if (
    positional.length > 0 ||
    unknown.length > 0 ||
    (flags.remove !== undefined && flags.remove !== true)
  ) {
    console.error(USAGE);
    return 2;
  }
  const file = hookPath();
  const current = existsSync(file) ? readFileSync(file, "utf8") : null;
  if (flags.remove === true) {
    if (current === null) {
      console.log(`nenhum pre-commit em ${file}: nada a remover.`);
      return 0;
    }
    if (!isOurHook(current)) {
      console.error(
        `o pre-commit em ${file} não é deste projeto: nada foi removido.`,
      );
      return 1;
    }
    rmSync(file);
    console.log(`hook removido: ${file}`);
    return 0;
  }
  if (current !== null && !isOurHook(current)) {
    console.error(
      `já existe um pre-commit que não é deste projeto em ${file}; nada foi gravado. Junte à mão: acrescente a linha "node scripts/visual/check-names.mjs --staged || exit 1" ao hook que existe.`,
    );
    return 1;
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, hookScript());
  chmodSync(file, 0o755);
  console.log(
    `${current === null ? "hook instalado" : "hook regravado"}: ${file}`,
  );
  return 0;
}

/** Só roda como script (`node scripts/visual/install-hooks.mjs`); importado pelo teste, não faz nada. */
function runsAsScript() {
  const entry = process.argv[1];
  if (!entry) return false;
  const a = resolve(entry);
  const b = fileURLToPath(import.meta.url);
  return process.platform === "win32"
    ? a.toLowerCase() === b.toLowerCase()
    : a === b;
}

if (runsAsScript()) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(
      `install-hooks: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
```

- [ ] **Step 11: Rodar e ver passar**

Run: `bunx vitest run test/visual/installHooks.test.ts`
Expected: `Tests  11 passed (11)`.

- [ ] **Step 12: Escrever o teste do registro e das pendências**

Crie `test/visual/docs.test.ts` (ferramenta Write):

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  compareHeadings,
  DOC_HEADING_LEVELS,
  editRegistryEntry,
  headingsOf,
} from "../../scripts/visual/docs.mjs";
import { createTempRepo, type TempRepo } from "./tempRepo";

// As regras do registro e das pendências (spec §5.3) com documentos sintéticos
// no formato dos de verdade, e os dois CLIs num repositório git temporário.

const REGISTRY = [
  "# UI Registry",
  "",
  "## Como documentar um componente",
  "",
  "```",
  "### <Nome>",
  "- **Histórico:** mudanças relevantes.",
  "```",
  "",
  "## 1. Primitivos",
  "",
  "### Botao",
  "- **Status:** pronto",
  "- **Usa:** tokens `accent`.",
  "- **Histórico:** 2026-11-20 — gerado. 2026-11-21 — segunda",
  "  linha do histórico.",
  "",
  "### Selo",
  "- **Status:** pronto",
  "- **Usa:** tokens `muted`.",
  "",
  "## 2. Aplicação",
  "",
  "### Cartao",
  "- **Usa:** `bg-muted/50` no rodapé e `bg-muted/50` no corpo.",
  "- **Histórico:** 2026-11-20 — criado.",
  "",
].join("\n");

const PENDENCIAS = [
  "# Pendências",
  "",
  "```markdown",
  "#### P999 — Modelo",
  "```",
  "",
  "## 1. Aberto, não triado",
  "",
  "#### P1 — Primeira 🟡",
  "**Estado:** Aberto, não triado",
  "",
  "#### P2 — Segunda ⚪",
  "**Estado:** Aberto, não triado",
  "",
].join("\n");

describe("DOC_HEADING_LEVELS", () => {
  it("são os dois documentos, com o nível de cada um", () => {
    expect(DOC_HEADING_LEVELS).toEqual({
      ".context/ui-registry.md": 3,
      ".context/pendencias.md": 4,
    });
  });
});

describe("headingsOf", () => {
  it("lista os cabeçalhos do nível, fora dos blocos de código", () => {
    expect(headingsOf(REGISTRY, 3)).toEqual(["### Botao", "### Selo", "### Cartao"]);
    expect(headingsOf(REGISTRY, 2)).toEqual([
      "## Como documentar um componente",
      "## 1. Primitivos",
      "## 2. Aplicação",
    ]);
    expect(headingsOf(PENDENCIAS, 4)).toEqual([
      "#### P1 — Primeira 🟡",
      "#### P2 — Segunda ⚪",
    ]);
  });

  it("texto vazio ou sem o nível: lista vazia", () => {
    expect(headingsOf("", 3)).toEqual([]);
    expect(headingsOf(REGISTRY, 4)).toEqual([]);
  });

  it.each([0, 7, 1.5])("nível %s é recusado", (level) => {
    expect(() => headingsOf(REGISTRY, level)).toThrow(
      `nível de cabeçalho inválido: ${level}`,
    );
  });
});

describe("editRegistryEntry", () => {
  it("historico: acrescenta a frase ao fim do parágrafo, sem tocar no resto", () => {
    const out = editRegistryEntry(
      REGISTRY,
      "Botao",
      "historico",
      "2026-11-27 — nova frase.",
    );
    const before = REGISTRY.split("\n");
    const after = out.split("\n");
    expect(after).toHaveLength(before.length);
    const changed = after.flatMap((line, index) =>
      line === before[index] ? [] : [index],
    );
    expect(changed).toEqual([before.indexOf("  linha do histórico.")]);
    expect(out).toContain("  linha do histórico. 2026-11-27 — nova frase.");
  });

  it("historico na última entrada do arquivo", () => {
    const out = editRegistryEntry(REGISTRY, "Cartao", "historico", "2026-11-27 — x.");
    expect(out).toContain("- **Histórico:** 2026-11-20 — criado. 2026-11-27 — x.");
  });

  it("entrada sem Histórico e entrada que não existe são recusadas", () => {
    expect(() => editRegistryEntry(REGISTRY, "Selo", "historico", "x")).toThrow(
      "entrada sem Histórico",
    );
    expect(() =>
      editRegistryEntry(REGISTRY, "Inexistente", "historico", "x"),
    ).toThrow("sem a entrada ### Inexistente");
  });

  it("o modelo dentro do bloco de código não é uma entrada", () => {
    expect(() => editRegistryEntry(REGISTRY, "<Nome>", "historico", "x")).toThrow(
      "sem a entrada ### <Nome>",
    );
  });

  it("troca: um trecho único da entrada; $& e $1 no texto novo ficam literais", () => {
    const out = editRegistryEntry(
      REGISTRY,
      "Botao",
      "troca",
      "tokens `accent`.",
      "tokens `accent` e $& $1.",
    );
    expect(out).toContain("- **Usa:** tokens `accent` e $& $1.");
    expect(out).toContain("- **Usa:** tokens `muted`.");
  });

  it("troca repetida ou ausente na entrada é recusada", () => {
    expect(() =>
      editRegistryEntry(REGISTRY, "Cartao", "troca", "bg-muted/50", "bg-accent/50"),
    ).toThrow('"bg-muted/50" aparece 2 vezes na entrada');
    expect(() =>
      editRegistryEntry(REGISTRY, "Selo", "troca", "accent", "card"),
    ).toThrow('"accent" aparece 0 vezes na entrada');
  });

  it("troca que apaga ou cria um cabeçalho ### é recusada", () => {
    expect(() =>
      editRegistryEntry(REGISTRY, "Botao", "troca", "### Botao", "Botao"),
    ).toThrow("um cabeçalho ### sumiu");
    expect(() =>
      editRegistryEntry(REGISTRY, "Selo", "troca", "- **Status:** pronto", "### Novo"),
    ).toThrow("a troca criou um cabeçalho ###");
  });

  it("op desconhecida e argumentos que faltam são recusados", () => {
    expect(() =>
      // @ts-expect-error: op fora do contrato, de propósito
      editRegistryEntry(REGISTRY, "Botao", "apaga", "x"),
    ).toThrow("op: historico | troca");
    expect(() => editRegistryEntry(REGISTRY, "Botao", "historico", "")).toThrow(
      "historico: falta a frase",
    );
    expect(() => editRegistryEntry(REGISTRY, "Botao", "troca", "accent")).toThrow(
      "troca: falta o trecho de origem ou o novo",
    );
  });

  it("mantém o CRLF de um arquivo com CRLF", () => {
    const crlf = REGISTRY.replaceAll("\n", "\r\n");
    const out = editRegistryEntry(crlf, "Botao", "historico", "x.");
    expect(out.split("\r\n")).toHaveLength(crlf.split("\r\n").length);
    expect(out.replaceAll("\r\n", "")).not.toContain("\n");
  });
});

describe("compareHeadings", () => {
  it("lista o que sumiu e o que apareceu", () => {
    const head = PENDENCIAS.replace("#### P2 — Segunda ⚪", "#### P3 — Terceira ⚪");
    expect(compareHeadings(PENDENCIAS, head, 4)).toEqual({
      removed: ["#### P2 — Segunda ⚪"],
      added: ["#### P3 — Terceira ⚪"],
    });
  });

  it("conta repetidos: dois iguais viram um, e um sumiu", () => {
    expect(compareHeadings("### X\n### X\n", "### X\n", 3)).toEqual({
      removed: ["### X"],
      added: [],
    });
  });

  it("igual, vazio ou só no bloco de código: nada", () => {
    expect(compareHeadings(REGISTRY, REGISTRY, 3)).toEqual({ removed: [], added: [] });
    expect(compareHeadings("", "", 4)).toEqual({ removed: [], added: [] });
    expect(compareHeadings("```\n### X\n```\n", "", 3)).toEqual({
      removed: [],
      added: [],
    });
  });
});

describe("registry.mjs (CLI)", () => {
  let repo: TempRepo;
  const registryFile = () => join(repo.dir, ".context", "ui-registry.md");

  beforeAll(() => {
    repo = createTempRepo();
    repo.write(join(".context", "ui-registry.md"), REGISTRY);
    repo.write(join(".context", "outro.md"), "não muda\n");
    repo.git("add", ".");
    repo.git("commit", "-q", "-m", "inicio");
  });

  afterAll(() => repo.remove());

  it("edita só a entrada pedida e grava só o ui-registry.md", () => {
    const result = repo.run("registry.mjs", [
      "Botao",
      "historico",
      "2026-11-27 — pelo CLI.",
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("ok: Botao (historico)");
    expect(readFileSync(registryFile(), "utf8")).toBe(
      editRegistryEntry(REGISTRY, "Botao", "historico", "2026-11-27 — pelo CLI."),
    );
    expect(repo.git("status", "--porcelain").trim()).toBe(
      "M .context/ui-registry.md",
    );
    repo.git("checkout", "--", ".context/ui-registry.md");
  });

  it("edição recusada: código 1, com o motivo, e nada gravado", () => {
    const result = repo.run("registry.mjs", ["Inexistente", "historico", "x"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("sem a entrada ### Inexistente");
    expect(readFileSync(registryFile(), "utf8")).toBe(REGISTRY);
  });

  it.each([[["Botao"]], [["Botao", "troca", "a"]], [["Botao", "apaga", "a"]], [[]]])(
    "uso errado %j: código 2",
    (args) => {
      const result = repo.run("registry.mjs", args);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("Uso:");
    },
  );
});

describe("registry-diff.mjs (CLI)", () => {
  let repo: TempRepo;

  beforeAll(() => {
    repo = createTempRepo();
    repo.write("LEIA.md", "sem os documentos ainda\n");
    repo.git("add", ".");
    repo.git("commit", "-q", "-m", "c0");
    repo.git("tag", "c0");
    repo.write(join(".context", "ui-registry.md"), REGISTRY);
    repo.write(join(".context", "pendencias.md"), PENDENCIAS);
    repo.git("add", ".");
    repo.git("commit", "-q", "-m", "c1");
    repo.git("tag", "c1");
    const withoutSelo = REGISTRY.replace("### Selo\n", "");
    repo.write(join(".context", "ui-registry.md"), withoutSelo);
    repo.write(
      join(".context", "pendencias.md"),
      `${PENDENCIAS}#### P3 — Terceira ⚪\n**Estado:** Aberto, não triado\n`,
    );
    repo.git("add", ".");
    repo.git("commit", "-q", "-m", "c2");
    repo.git("tag", "c2");
    repo.write(join(".context", "ui-registry.md"), `${withoutSelo}### Novo\n`);
    repo.git("add", ".");
    repo.git("commit", "-q", "-m", "c3");
  });

  afterAll(() => repo.remove());

  it("um cabeçalho sumiu: código 1, com o que sumiu e o que apareceu", () => {
    const result = repo.run("registry-diff.mjs", ["c1", "c2"]);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("SUMIU  ### Selo");
    expect(result.stdout).toContain("NOVO   #### P3 — Terceira ⚪");
    expect(result.stderr).toContain("algum cabeçalho sumiu");
  });

  it("só cabeçalhos novos, ou nada mudou: código 0 (head padrão = HEAD)", () => {
    expect(repo.run("registry-diff.mjs", ["c2"]).status).toBe(0);
    expect(repo.run("registry-diff.mjs", ["c1", "c1"]).status).toBe(0);
  });

  it("documento que não existia na base: tudo é novo, código 0", () => {
    const result = repo.run("registry-diff.mjs", ["c0", "c1"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(".context/ui-registry.md: 0 cabeçalho(s)");
  });

  it.each([[[]], [["c1", "c2", "c3"]], [["--base=c1"]]])(
    "uso errado %j: código 2",
    (args) => {
      expect(repo.run("registry-diff.mjs", args).status).toBe(2);
    },
  );

  it("revisão desconhecida: código 2", () => {
    const result = repo.run("registry-diff.mjs", ["nao-existe"]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("revisão desconhecida: nao-existe");
  });
});
```

- [ ] **Step 13: Rodar e ver falhar**

Run: `bunx vitest run test/visual/docs.test.ts`
Expected: FAIL com `Error: Cannot find module '../../scripts/visual/docs.mjs' imported from …/test/visual/docs.test.ts`.

- [ ] **Step 14: Implementar `docs.mjs`**

Crie `scripts/visual/docs.mjs` (ferramenta Write; a lógica da edição é a do `registry.mjs` do PR A, agora pura, com a
troca literal e as cercas de código respeitadas):

```js
// Regras puras dos dois documentos que as ferramentas editam e comparam (spec
// §5.3): uma entrada do .context/ui-registry.md e os cabeçalhos do registro
// (###) e das pendências (####). Os CLIs (registry.mjs, registry-diff.mjs) só
// leem e gravam. Linhas dentro de bloco de código (```) não contam como
// cabeçalho nem como entrada: o modelo dos dois arquivos mora num bloco.

/** O nível dos cabeçalhos que não podem sumir, por arquivo (caminho da raiz). */
export const DOC_HEADING_LEVELS = Object.freeze({
  ".context/ui-registry.md": 3,
  ".context/pendencias.md": 4,
});

/**
 * @param {string[]} lines
 * @returns {boolean[]} true onde a linha está dentro de um bloco de código (as cercas contam como dentro)
 */
function fenceMap(lines) {
  let inFence = false;
  return lines.map((line) => {
    if (line.startsWith("```")) {
      inFence = !inFence;
      return true;
    }
    return inFence;
  });
}

/**
 * Os cabeçalhos de um nível ("### Button"), na ordem, fora dos blocos de código.
 * @param {string} text
 * @param {number} level de 1 a 6
 * @returns {string[]}
 */
export function headingsOf(text, level) {
  if (!Number.isInteger(level) || level < 1 || level > 6) {
    throw new Error(`nível de cabeçalho inválido: ${level}`);
  }
  const prefix = `${"#".repeat(level)} `;
  const lines = text.split(/\r?\n/);
  const fenced = fenceMap(lines);
  return lines
    .filter((line, index) => !fenced[index] && line.startsWith(prefix))
    .map((line) => line.trimEnd());
}

/**
 * Edita só a entrada `### <name>` do ui-registry.md: "historico" acrescenta a
 * frase ao fim do parágrafo do Histórico; "troca" troca um trecho que aparece
 * uma vez só na entrada. Nenhum cabeçalho ### some nem aparece.
 * @param {string} text
 * @param {string} name
 * @param {"historico" | "troca"} op
 * @param {string} a a frase (historico) ou o trecho de origem (troca)
 * @param {string} [b] o trecho novo (troca)
 * @returns {string}
 */
export function editRegistryEntry(text, name, op, a, b) {
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  const lines = text.split(/\r?\n/);
  const fenced = fenceMap(lines);
  const start = lines.findIndex(
    (line, index) => !fenced[index] && line === `### ${name}`,
  );
  if (start < 0) throw new Error(`sem a entrada ### ${name}`);
  let end = lines.findIndex(
    (line, index) =>
      index > start &&
      !fenced[index] &&
      (line.startsWith("### ") || line.startsWith("## ")),
  );
  if (end < 0) end = lines.length;
  const entry = lines.slice(start, end);
  /** @type {string[]} */
  let next;
  if (op === "historico") {
    if (!a) throw new Error("historico: falta a frase");
    const at = entry.findIndex((line) => line.startsWith("- **Histórico:**"));
    if (at < 0) throw new Error("entrada sem Histórico");
    // O parágrafo do Histórico vai até a linha vazia ou o próximo "- **".
    let last = at;
    while (
      last + 1 < entry.length &&
      (entry[last + 1] ?? "").trim() !== "" &&
      !(entry[last + 1] ?? "").startsWith("- **")
    ) {
      last++;
    }
    next = [...entry];
    next[last] = `${entry[last]} ${a}`;
  } else if (op === "troca") {
    if (!a || b === undefined)
      throw new Error("troca: falta o trecho de origem ou o novo");
    const joined = entry.join("\n");
    const count = joined.split(a).length - 1;
    if (count !== 1) {
      throw new Error(`"${a.slice(0, 60)}" aparece ${count} vezes na entrada`);
    }
    // Função no lugar da string: "$&" e "$1" no texto novo ficam literais.
    next = joined.replace(a, () => b).split("\n");
  } else {
    throw new Error("op: historico | troca");
  }
  const out = [...lines.slice(0, start), ...next, ...lines.slice(end)].join(
    eol,
  );
  const before = headingsOf(text, 3).length;
  const after = headingsOf(out, 3).length;
  if (after < before) throw new Error("um cabeçalho ### sumiu");
  if (after > before) throw new Error("a troca criou um cabeçalho ###");
  return out;
}

/**
 * @param {string[]} from
 * @param {string[]} minus
 * @returns {string[]} o que está em `from` e não em `minus`, contando repetidos
 */
function difference(from, minus) {
  /** @type {Map<string, number>} */
  const left = new Map();
  for (const item of minus) left.set(item, (left.get(item) ?? 0) + 1);
  /** @type {string[]} */
  const out = [];
  for (const item of from) {
    const count = left.get(item) ?? 0;
    if (count > 0) left.set(item, count - 1);
    else out.push(item);
  }
  return out;
}

/**
 * Os cabeçalhos de um nível que sumiram e que apareceram entre dois textos. Um
 * título renomeado aparece nas duas listas.
 * @param {string} base
 * @param {string} head
 * @param {number} level
 * @returns {{ removed: string[], added: string[] }}
 */
export function compareHeadings(base, head, level) {
  const before = headingsOf(base, level);
  const after = headingsOf(head, level);
  return {
    removed: difference(before, after),
    added: difference(after, before),
  };
}
```

- [ ] **Step 15: Rodar e ver as regras passarem (os CLIs ainda faltam)**

Run: `bunx vitest run test/visual/docs.test.ts`
Expected: `Tests  13 failed | 18 passed (31)`; os vermelhos são os dos dois `describe` de CLI (`expected 1 to be +0`,
`expected 1 to be 2`, `expected '' to contain 'SUMIU  ### Selo'`).

- [ ] **Step 16: Implementar `registry.mjs` e `registry-diff.mjs`**

Crie `scripts/visual/registry.mjs` (ferramenta Write):

```js
// Edita uma entrada do .context/ui-registry.md sem tocar nas outras (spec §5.3):
//   node scripts/visual/registry.mjs <Componente> historico "<frase>"
//   node scripts/visual/registry.mjs <Componente> troca "<de>" "<para>"
// Grava só <raiz do repositório>/.context/ui-registry.md: é a exceção declarada
// à regra do .git/sdd (spec §5.1). As regras moram em docs.mjs.
// Código 0: editado. 1: a edição foi recusada (nada gravado). 2: uso errado.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { editRegistryEntry } from "./docs.mjs";
import { repoRoot } from "./paths.mjs";

const USAGE =
  'Uso: node scripts/visual/registry.mjs <Componente> historico "<frase>" | <Componente> troca "<de>" "<para>"';

/**
 * @param {string[]} argv
 * @returns {0 | 1 | 2}
 */
function main(argv) {
  const [name, op, a, b] = argv;
  const arity = op === "historico" ? 3 : op === "troca" ? 4 : 0;
  if (!name || arity === 0 || argv.length !== arity) {
    console.error(USAGE);
    return 2;
  }
  const file = join(repoRoot(), ".context", "ui-registry.md");
  const text = readFileSync(file, "utf8");
  const out = editRegistryEntry(
    text,
    name,
    /** @type {"historico" | "troca"} */ (op),
    a ?? "",
    b,
  );
  writeFileSync(file, out);
  console.log(`ok: ${name} (${op})`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(
    `registry: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
```

Crie `scripts/visual/registry-diff.mjs` (ferramenta Write):

```js
// Compara os cabeçalhos do .context/ui-registry.md (###) e do
// .context/pendencias.md (####) entre dois commits (spec §5.3; a conferência
// da revisão por tarefa):
//   node scripts/visual/registry-diff.mjs <base> [head=HEAD]
// Código 0: nenhum cabeçalho sumiu. 1: algum sumiu. 2: uso errado ou revisão
// desconhecida. Só lê (git show); não grava nada.
import { execFileSync } from "node:child_process";

import { compareHeadings, DOC_HEADING_LEVELS } from "./docs.mjs";

const USAGE = "Uso: node scripts/visual/registry-diff.mjs <base> [head=HEAD]";

/**
 * @param {string[]} args
 * @returns {string}
 */
function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

/** @param {string} rev */
function isCommit(rev) {
  try {
    git(["rev-parse", "--verify", "--quiet", `${rev}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * O arquivo naquela revisão; vazio quando ele não existe lá.
 * @param {string} rev
 * @param {string} file caminho da raiz
 */
function fileAt(rev, file) {
  try {
    return git(["show", `${rev}:${file}`]);
  } catch {
    return "";
  }
}

/**
 * @param {string[]} argv
 * @returns {0 | 1 | 2}
 */
function main(argv) {
  if (
    argv.length < 1 ||
    argv.length > 2 ||
    argv.some((arg) => arg.startsWith("-"))
  ) {
    console.error(USAGE);
    return 2;
  }
  const [base = "", head = "HEAD"] = argv;
  for (const rev of [base, head]) {
    if (!isCommit(rev)) {
      console.error(`registry-diff: revisão desconhecida: ${rev}`);
      return 2;
    }
  }
  let removedTotal = 0;
  for (const [file, level] of Object.entries(DOC_HEADING_LEVELS)) {
    const { removed, added } = compareHeadings(
      fileAt(base, file),
      fileAt(head, file),
      level,
    );
    removedTotal += removed.length;
    console.log(
      `${file}: ${removed.length} cabeçalho(s) ${"#".repeat(level)} sumiu(ram), ${added.length} novo(s)`,
    );
    for (const heading of removed) console.log(`  SUMIU  ${heading}`);
    for (const heading of added) console.log(`  NOVO   ${heading}`);
  }
  if (removedTotal > 0) {
    console.error(
      "registry-diff: algum cabeçalho sumiu. Um título renomeado aparece como SUMIU e NOVO: confira antes de aceitar.",
    );
    return 1;
  }
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(
    `registry-diff: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 2;
}
```

- [ ] **Step 17: Rodar e ver passar**

Run: `bunx vitest run test/visual/docs.test.ts`
Expected: `Tests  31 passed (31)`.

- [ ] **Step 18: O caso da lista no `vocabulary.test.ts` (spec §12)**

A T4 criou o `test/visual/vocabulary.test.ts` **sem** este caso, de propósito (o `names.mjs` só nasce aqui). O caso
reaproveita o que o arquivo da T4 já tem: o objeto `VOCABULARY` (todas as exportações do `vocabulary.mjs`) e a função
`allStrings`. Duas edições (ferramenta Edit).

Edit 1, o import. `old_string` (o bloco que a T4 escreveu):

```ts
import {
  VISUAL_DESTINATIONS,
  VISUAL_ITEMS,
  VISUAL_PASSWORD,
  VISUAL_PEOPLE,
  VISUAL_SECTORS,
  VISUAL_SHIFTS,
  VISUAL_TEXTS,
} from "../../scripts/visual/vocabulary.mjs";
```

`new_string`:

```ts
import { findForbidden, loadNamesList } from "../../scripts/visual/names.mjs";
import {
  VISUAL_DESTINATIONS,
  VISUAL_ITEMS,
  VISUAL_PASSWORD,
  VISUAL_PEOPLE,
  VISUAL_SECTORS,
  VISUAL_SHIFTS,
  VISUAL_TEXTS,
} from "../../scripts/visual/vocabulary.mjs";
```

Edit 2, o fim do arquivo. `old_string` (o fim do caso "é imutável" da T4 e o fecho do `describe("textos")`):

```ts
    expect(Object.isFrozen(VISUAL_TEXTS.staleRequests[0])).toBe(true);
  });
});
```

`new_string`:

```ts
    expect(Object.isFrozen(VISUAL_TEXTS.staleRequests[0])).toBe(true);
  });
});

// A lista de verdade mora em .git/sdd e só existe na máquina do controlador: no
// CI o caso é pulado. O relatório leva só os números das linhas, nunca o termo.
const namesList = loadNamesList();

describe("vocabulário contra a lista de nomes proibidos", () => {
  it.skipIf(namesList === null)(
    "nenhum termo da lista aparece no vocabulário",
    () => {
      const text = allStrings(VOCABULARY).join("\n");
      const hits = findForbidden(text, namesList ?? { terms: [], allowed: [] });
      expect(
        hits.map(
          (hit) => `linha ${hit.line} do texto, linha ${hit.listLine} da lista`,
        ),
      ).toEqual([]);
    },
  );
});
```

Run: `bunx vitest run test/visual/vocabulary.test.ts`
Expected: verde, 13 testes; com a lista do C0 presente, o caso novo roda e passa (sem ela, e no CI, `12 passed | 1
skipped`).

- [ ] **Step 19: Atalhos no `package.json`**

Edite `package.json` (ferramenta Edit). `old_string` (o fim de `scripts` que a T5, Step 22, deixou):

```json
    "visual:people": "node scripts/visual/people.mjs"
  },
```

`new_string`:

```json
    "visual:people": "node scripts/visual/people.mjs",
    "visual:names": "node scripts/visual/check-names.mjs",
    "visual:hooks": "node scripts/visual/install-hooks.mjs"
  },
```

(A T7 insere `visual:proto` e `visual:pairs` entre o `visual:people` e o `visual:names`, e a T8 o `visual:audit` depois
do `visual:pairs`, ancorando nestas linhas.)

Run: `node -e "const s=require('./package.json').scripts; console.log(s['visual:names'], '|', s['visual:hooks'])"`
Expected: `node scripts/visual/check-names.mjs | node scripts/visual/install-hooks.mjs`

- [ ] **Step 20: Formatar, tipos, lint e os testes tocados**

```sh
bunx biome check --write scripts/visual/names.mjs scripts/visual/check-names.mjs scripts/visual/install-hooks.mjs scripts/visual/docs.mjs scripts/visual/registry.mjs scripts/visual/registry-diff.mjs test/visual/tempRepo.ts test/visual/names.test.ts test/visual/installHooks.test.ts test/visual/docs.test.ts test/visual/vocabulary.test.ts
bun run check-types
bun run lint
bunx vitest run test/visual/names.test.ts test/visual/installHooks.test.ts test/visual/docs.test.ts test/visual/vocabulary.test.ts
```

Expected: o `--write` só quebra linhas dos testes; `check-types` sem erro (o `@ts-expect-error` do `docs.test.ts` é usado,
porque o JSDoc do `op` vale como tipo); `lint` com `No fixes applied`; os quatro arquivos verdes (`34`, `11`, `31` e os 13
do `vocabulary.test.ts`).

- [ ] **Step 21: Conferência nos arquivos de verdade (antes do commit)**

Com a lista do C0 presente:

```sh
git add scripts/visual/names.mjs scripts/visual/check-names.mjs scripts/visual/install-hooks.mjs scripts/visual/docs.mjs scripts/visual/registry.mjs scripts/visual/registry-diff.mjs test/visual/tempRepo.ts test/visual/names.test.ts test/visual/installHooks.test.ts test/visual/docs.test.ts test/visual/vocabulary.test.ts package.json
bun run visual:names --staged; echo "código: $?"
node scripts/visual/registry-diff.mjs HEAD; echo "código: $?"
```

Expected: `check-names: nada da lista em … linha(s), 12 caminho(s) e 0 mensagem(ns).` e `código: 0`; o `registry-diff`
imprime `.context/ui-registry.md: 0 cabeçalho(s) ### sumiu(ram), 0 novo(s)` e `.context/pendencias.md: 0 cabeçalho(s)
#### sumiu(ram), 0 novo(s)` e `código: 0`. (O hook ainda não está instalado: ele entra logo depois deste commit, C0
Step 5.)

- [ ] **Step 22: Commit**

Mensagem gravada com Write em `.git/sdd/processo/msg-task-6.txt`:

```text
chore(visual): check-names, hook local e ferramentas do registro

names.mjs lê a lista de nomes (fora do git), procura sem caixa e sem acento e
tira as linhas acrescentadas do diff; check-names.mjs (--staged, --range,
--file) nunca imprime o termo; install-hooks.mjs grava o pre-commit, respeita
o core.hooksPath e recusa hook alheio; docs.mjs, registry.mjs e
registry-diff.mjs editam uma entrada do registro e comparam os cabeçalhos
entre commits. Os CLIs são testados num repositório git temporário.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

`git commit -F .git/sdd/processo/msg-task-6.txt` (os arquivos já estão no índice do Step 21).

---

### Task 7: Captura, diferença, cópias do protótipo, passos e pares

**Spec:** §5.3, §5.5, §5.6, §6 · **Redator:** R2 · **Depende de:** T4, T5, T6

**Files:**
- Create: `scripts/visual/steps.mjs`
- Create: `scripts/visual/image.mjs`
- Create: `scripts/visual/diff.mjs` (módulo + CLI)
- Create: `scripts/visual/screen.mjs`
- Create: `scripts/visual/screens/inicio.mjs`
- Create: `scripts/visual/proto.mjs` (módulo + CLI)
- Create: `scripts/visual/capture.mjs` (módulo + CLI)
- Create: `scripts/visual/pairs.mjs` (CLI)
- Modify: `package.json` (`scripts`: `visual:proto`, `visual:pairs`)
- Test: `test/visual/steps.test.ts`
- Test: `test/visual/image.test.ts`
- Test: `test/visual/diff.test.ts`
- Test: `test/visual/screen.test.ts`
- Test: `test/visual/screens.test.ts`
- Test: `test/visual/proto.test.ts`

**Interfaces:**
- Consumes (T4): `parseCliArgs`, `parseSizes`, `fakeClientIp`, `assertVisualBaseUrl`, `VISUAL_BASE_URL`,
  `THEME_STORAGE_KEY`, `MOBILE_MAX_WIDTH`; `sddPath`, `assertInsideSdd`, `writeInsideSdd`, `readJsonInsideSdd`,
  `repoRoot`, `visualDbDir`, `VISUAL_DB_FILES`; `VISUAL_PEOPLE`, `VISUAL_PASSWORD` e o resto do vocabulário.
  (T5): `STATES` (só o `screens.test.ts`) e o CLI `scripts/visual/seed/index.ts state <nome> [--setor=<nome>]` (o
  `pairs.mjs` chama pelo `runSeed`). (T6): `loadNamesList(): NamesList | null`, `findForbidden(text, list): { line,
  listLine }[]`, `namesListPath(): string` e, nos testes, `parseNamesList(text): NamesList` (`scripts/visual/names.mjs`).
- Produces (nomes do contrato):
  - `steps.mjs`: `STEP_KINDS`, `validateSteps(steps): string[]`, `globToRegExp(glob): RegExp`,
    `requestMatches(match, req: { url, method, headers }): boolean`, `runSteps(page, steps): Promise<StepLog>` com
    `StepLog = { failed: { url, method, error }[], samples: { at, value }[], notes: string[] }`.
  - `image.mjs`: `MASK_RGBA`, `createPng(width, height, rgba?)`, `readPng(file)`, `writePng(file, png)`,
    `cropTo(png, width, height)`, `cropRect(png, rect)`, `paintRects(png, rects, origin?)`,
    `stackRegion(pngs, rect, zoom?, gap?)`, `contactSheet(pngs, scale?, maxHeight?, gap?)`; `Rect = [x, y, w, h]`. A mais:
    `parseRect(values): Rect` (o `sbs` e o `crop` da Task 8 usam).
  - `diff.mjs`: `PIXELMATCH_THRESHOLD = 0.1`, `diffImages(a, b, masks?)`, `regionDiff(a, b, rect, masks?)`,
    `unionRect(a, b)`, `diffFiles(aPath, bPath, outPath, masks?)`; CLI `<a.png> <b.png> <saída.png> [máscaras.json]`
    (caminhos relativos a `.git/sdd`).
  - `screen.mjs`: typedefs `PersonKey`, `Target`, `RequestMatch`, `Step`, `StateConfig`, `AuditScreen`, `ScreenConfig`,
    `StateFile`; `validateScreen(screen): string[]`, `loadScreen({ screen?, config? }): Promise<ScreenConfig>`,
    `resolvePath(template, state)`, `minHeight(width)`, `readState()`, `readAvatars()`, `protoFile(out, screen, stem)`.
    A mais: `pickState(screen, name)`, `seedArgs(state)`, `runSeed(state)`.
  - `capture.mjs`: `HIDE_DEV_CSS`, `launchBrowser()`, `loginAs(context, person)`, `openApp(browser, opts)`,
    `openProto(browser, opts)`, `settle(page)`, `shoot(page, opts)`; CLI `app …` · `proto …`. A mais (a Task 8 usa):
    `naturalHeight(page, kind)`, `openState(browser, { screen, state, path, width, out? })`, `closeState(opened)`,
    `commonHeight(opened, state, width)`.
  - `proto.mjs`: `applyReplacements(html, pairs)`, `readProps(html)`, `setPropDefaults(html, values)`,
    `buildProtoCopies(configRelPath): Promise<string[]>`; CLI `--config=<relativo a .git/sdd>`. A mais:
    `findLeftovers(text, list, extra?)` (puro, testado). O `ctx` de `replacements(ctx)` é `{ avatars, people,
    vocabulary: { sectors, shifts, items, destinations, texts }, now }`; `copies[nome].extra` aceita lista ou `(ctx) =>
    lista`.
  - `pairs.mjs`: CLI `--screen=<nome> | --config=<relativo>`, `--out=<pasta em .git/sdd>`, `[estado …]`, `--sizes=`,
    `--sufixo=`; grava `<out>/pares/<estado>-<largura><sufixo>-{proto,app,diff}.png`, `-<região>-{proto,app,diff}.png`
    e mescla `<out>/pares/results.json` com `{ pct, size, natural: { app, proto }, masks, regions, failed, at }`.
  - `screens/inicio.mjs`: os 11 estados da spec §5.5, `ready`, `patch`, `masks` e a região `cartao`.
  - `package.json`: `visual:proto`, `visual:pairs`.

Notas de porte (só a lógica; nenhuma string dos arquivos antigos): `capture.mjs` (login pela API, tema no
`localStorage`, `nextjs-portal` escondido, altura natural, janela da altura do conteúdo) ganha o `reducedMotion: "reduce"`
e a espera das animações (PB-D6) e o `x-forwarded-for` por login; o `patch` e as máscaras do relógio saem do
`capture.mjs` antigo para o `screens/inicio.mjs`, agora como funções que viram texto; `run.mjs` + `run-correcoes.mjs` →
`pairs.mjs` genérico (estados, passos e regiões vêm da configuração; a região `cartao` usa a união das caixas dos dois
lados, como o antigo); `mkproto*.mjs` → o motor `proto.mjs` (o mapa de trocas fica fora do git, na configuração do C1);
`diff.mjs` vira módulo puro mais CLI. `--sizes` vale para todos os estados escolhidos (o antigo deixava o do estado
vencer); estado com `proto: null` é pulado pelo `pairs` com aviso.

- [ ] **Step 1: Escrever o teste dos passos**

`test/visual/steps.test.ts` (o runner roda numa página falsa: registra as ações e passa as requisições pela rota do
runner, sem navegador):

```ts
import type { Page } from "@playwright/test";
import { describe, expect, it } from "vitest";

import {
  globToRegExp,
  requestMatches,
  runSteps,
  STEP_KINDS,
  validateSteps,
} from "../../scripts/visual/steps.mjs";

// O roteiro de interação (spec §6): validação de cada kind, o casamento de requisição
// e o runner, numa página falsa (sem navegador), com a falha de rede simulada.

describe("validateSteps", () => {
  it("aceita um passo válido de cada kind, e a lista vazia", () => {
    const steps = [
      { kind: "click", target: { role: "button", name: "Agora não" } },
      { kind: "hover", target: { css: '[data-slot="card"]' } },
      { kind: "focus", target: { text: "Ver todas" } },
      { kind: "tab", times: 3 },
      { kind: "press", key: "Escape" },
      {
        kind: "fill",
        target: { role: "textbox", name: "Observação", exact: true },
        value: "",
      },
      { kind: "drag", from: { css: "#a" }, to: { css: "#b" } },
      { kind: "wait", ms: 900 },
      { kind: "waitFor", target: { css: '[role="dialog"]' } },
      {
        kind: "failRequests",
        match: { method: "POST", header: "next-action" },
        times: 1,
      },
      { kind: "restoreRequests" },
      {
        kind: "sample",
        target: { css: "#thumb" },
        read: "x",
        every: 40,
        for: 1000,
      },
    ];
    expect(steps.map((s) => s.kind)).toEqual([...STEP_KINDS]);
    expect(validateSteps(steps)).toEqual([]);
    expect(validateSteps([])).toEqual([]);
  });

  it("não lista, não objeto e kind desconhecido", () => {
    expect(validateSteps("click")).toEqual(["passos: não é uma lista"]);
    expect(validateSteps([7])).toEqual(["passo 1: não é um objeto"]);
    expect(validateSteps([{ kind: "scroll" }])).toEqual([
      "passo 1: kind desconhecido: scroll",
    ]);
  });

  it("campos que faltam e campos a mais", () => {
    expect(validateSteps([{ kind: "click" }])).toEqual([
      "passo 1 (click): falta target",
    ]);
    expect(validateSteps([{ kind: "fill", target: { css: "a" } }])).toEqual([
      "passo 1 (fill): falta value",
    ]);
    expect(validateSteps([{ kind: "drag", from: { css: "a" } }])).toEqual([
      "passo 1 (drag): falta to",
    ]);
    expect(validateSteps([{ kind: "restoreRequests", match: {} }])).toEqual([
      "passo 1 (restoreRequests): campo desconhecido: match",
      "passo 1 (restoreRequests): match vazio (use url, method ou header)",
    ]);
  });

  it("alvo inválido: vazio, sem nome, misturado, desconhecido", () => {
    const errors = validateSteps([
      { kind: "click", target: {} },
      { kind: "click", target: { role: "button" } },
      { kind: "click", target: { css: "a", text: "b" } },
      { kind: "click", target: { role: "button", name: "x", nth: 2 } },
      { kind: "click", target: { css: "" } },
    ]);
    expect(errors).toEqual([
      "passo 1 (click): target: alvo sem role, css nem text",
      "passo 2 (click): target: alvo.name vazio (o nome acessível)",
      "passo 3 (click): target: alvo { css } não aceita outros campos",
      "passo 4 (click): target: alvo com campo desconhecido: nth",
      "passo 5 (click): target: alvo.css vazio",
    ]);
  });

  it("limites: zero, acima do máximo e não inteiro", () => {
    expect(validateSteps([{ kind: "tab", times: 0 }])).toEqual([
      "passo 1 (tab): times inválido: 0 (1 a 50)",
    ]);
    expect(validateSteps([{ kind: "tab", times: 51 }])).toEqual([
      "passo 1 (tab): times inválido: 51 (1 a 50)",
    ]);
    expect(validateSteps([{ kind: "wait", ms: 0 }])).toEqual([
      "passo 1 (wait): ms inválido: 0 (1 a 60000)",
    ]);
    expect(validateSteps([{ kind: "wait", ms: 60_001 }])).toEqual([
      "passo 1 (wait): ms inválido: 60001 (1 a 60000)",
    ]);
    expect(validateSteps([{ kind: "wait", ms: 1.5 }])).toEqual([
      "passo 1 (wait): ms inválido: 1.5 (1 a 60000)",
    ]);
    expect(
      validateSteps([
        { kind: "failRequests", match: { method: "POST" }, times: 0 },
      ]),
    ).toEqual(["passo 1 (failRequests): times inválido: 0 (1 a 1000)"]);
  });

  it("press, failRequests e sample: valores inválidos", () => {
    expect(validateSteps([{ kind: "press", key: "" }])).toEqual([
      "passo 1 (press): key vazia",
    ]);
    expect(
      validateSteps([{ kind: "failRequests", match: { verb: "POST" } }]),
    ).toEqual(["passo 1 (failRequests): match com campo desconhecido: verb"]);
    expect(
      validateSteps([{ kind: "failRequests", match: { url: "/(/" } }]),
    ).toEqual(["passo 1 (failRequests): match.url: regex inválida"]);
    expect(
      validateSteps([
        { kind: "sample", target: { css: "a" }, read: "z", every: 5, for: 100 },
      ]),
    ).toEqual([
      "passo 1 (sample): read inválido: z (x, y, width ou height)",
      "passo 1 (sample): every inválido: 5 (10 até o for)",
    ]);
    expect(
      validateSteps([
        {
          kind: "sample",
          target: { css: "a" },
          read: "x",
          every: 200,
          for: 100,
        },
      ]),
    ).toEqual(["passo 1 (sample): every inválido: 200 (10 até o for)"]);
  });
});

describe("globToRegExp", () => {
  it("** atravessa segmentos, * fica num segmento, o resto é literal", () => {
    const auth = globToRegExp("**/api/auth/*");
    expect(auth.test("http://localhost:3202/api/auth/sign-in")).toBe(true);
    expect(auth.test("http://localhost:3202/api/auth/a/b")).toBe(false);
    expect(globToRegExp("*.png").test("a.png")).toBe(true);
    expect(globToRegExp("*.png").test("a/b.png")).toBe(false);
    expect(globToRegExp("a.b").test("axb")).toBe(false);
    expect(globToRegExp("/?setor=(x)").test("/?setor=(x)")).toBe(true);
  });
});

describe("requestMatches", () => {
  const action = {
    url: "http://localhost:3202/?setor=1",
    method: "POST",
    headers: { "Next-Action": "abc", accept: "text/x-component" },
  };

  it("Server Action: POST com o cabeçalho next-action (sem caixa)", () => {
    expect(
      requestMatches({ method: "post", header: "next-action" }, action),
    ).toBe(true);
  });

  it("todos os campos precisam casar", () => {
    expect(
      requestMatches({ method: "GET", header: "next-action" }, action),
    ).toBe(false);
    expect(requestMatches({ method: "POST", header: "x-nada" }, action)).toBe(
      false,
    );
    expect(requestMatches({ url: "**/api/**", method: "POST" }, action)).toBe(
      false,
    );
  });

  it("url por glob ou por regex entre barras", () => {
    expect(requestMatches({ url: "http://localhost:3202/*" }, action)).toBe(
      true,
    );
    expect(requestMatches({ url: "/setor=\\d/" }, action)).toBe(true);
    expect(requestMatches({ url: "/setor=x/" }, action)).toBe(false);
  });

  it("match vazio ou regex inválida não casam nada", () => {
    expect(requestMatches({}, action)).toBe(false);
    expect(requestMatches({ url: "/(/" }, action)).toBe(false);
  });
});

type FakeRequest = {
  url: string;
  method: string;
  headers: Record<string, string>;
};

/** Uma página falsa: registra as ações e passa as requisições pela rota do runner. */
function fakePage(requestOnClick: FakeRequest | null) {
  const calls: string[] = [];
  const listeners = new Map<string, (request: unknown) => void>();
  let handler: ((route: unknown) => Promise<void>) | null = null;

  async function fire(req: FakeRequest): Promise<"abortada" | "seguiu"> {
    const request = {
      url: () => req.url,
      method: () => req.method,
      headers: () => req.headers,
      failure: () => ({ errorText: "net::ERR_FAILED" }),
    };
    let outcome: "abortada" | "seguiu" = "seguiu";
    if (handler) {
      await handler({
        request: () => request,
        abort: async () => {
          outcome = "abortada";
          listeners.get("requestfailed")?.(request);
        },
        fallback: async () => undefined,
      });
    }
    calls.push(`${outcome} ${req.method}`);
    return outcome;
  }

  function locator(description: string) {
    const self = {
      filter: () => self,
      first: () => self,
      click: async () => {
        calls.push(`click ${description}`);
        if (requestOnClick) await fire(requestOnClick);
      },
      hover: async () => {
        calls.push(`hover ${description}`);
      },
      focus: async () => {
        calls.push(`focus ${description}`);
      },
      fill: async (value: string) => {
        calls.push(`fill ${description} ${value}`);
      },
      dragTo: async () => {
        calls.push(`drag ${description}`);
      },
      waitFor: async () => {
        calls.push(`waitFor ${description}`);
      },
      boundingBox: async () => ({ x: 10.4, y: 0, width: 5, height: 5 }),
    };
    return self;
  }

  const page = {
    getByRole: (role: string, options: { name: string }) =>
      locator(`${role}:${options.name}`),
    locator: (css: string) => locator(`css:${css}`),
    getByText: (text: string) => locator(`text:${text}`),
    keyboard: {
      press: async (key: string) => {
        calls.push(`press ${key}`);
      },
    },
    waitForTimeout: (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
    route: async (_url: string, fn: (route: unknown) => Promise<void>) => {
      handler = fn;
    },
    unroute: async () => {
      handler = null;
    },
    on: (event: string, fn: (request: unknown) => void) => {
      listeners.set(event, fn);
    },
    off: (event: string) => {
      listeners.delete(event);
    },
  };
  return { page: page as unknown as Page, calls, fire };
}

describe("runSteps (página falsa)", () => {
  const serverAction = {
    url: "http://localhost:3202/",
    method: "POST",
    headers: { "next-action": "id" },
  };

  it("falha de rede: aborta só a primeira Server Action (times: 1) e registra a falha", async () => {
    const fake = fakePage(serverAction);
    const log = await runSteps(fake.page, [
      {
        kind: "failRequests",
        match: { method: "POST", header: "next-action" },
        times: 1,
      },
      { kind: "click", target: { role: "button", name: "Agora não" } },
      { kind: "click", target: { css: "#de-novo" } },
      { kind: "wait", ms: 5 },
    ]);
    expect(log.failed).toEqual([
      {
        url: "http://localhost:3202/",
        method: "POST",
        error: "net::ERR_FAILED",
      },
    ]);
    expect(fake.calls).toEqual([
      "click button:Agora não",
      "abortada POST",
      "click css:#de-novo",
      "seguiu POST",
    ]);
  });

  it("restoreRequests tira a falha", async () => {
    const fake = fakePage(null);
    const log = await runSteps(fake.page, [
      { kind: "failRequests", match: { url: "**/api/**" } },
      { kind: "restoreRequests" },
    ]);
    expect(
      await fake.fire({
        url: "http://localhost:3202/api/x",
        method: "GET",
        headers: {},
      }),
    ).toBe("seguiu");
    expect(log.failed).toEqual([]);
  });

  it("tab, press, fill, hover, focus, drag e waitFor chegam à página", async () => {
    const fake = fakePage(null);
    await runSteps(fake.page, [
      { kind: "tab", times: 2 },
      { kind: "press", key: "Enter" },
      { kind: "fill", target: { css: "#campo" }, value: "abc" },
      { kind: "hover", target: { text: "Ver" } },
      { kind: "focus", target: { css: "#a" } },
      { kind: "drag", from: { css: "#a" }, to: { css: "#b" } },
      { kind: "waitFor", target: { css: "#c" } },
    ]);
    expect(fake.calls).toEqual([
      "press Tab",
      "press Tab",
      "press Enter",
      "fill css:#campo abc",
      "hover text:Ver",
      "focus css:#a",
      "drag css:#a",
      "waitFor css:#c",
    ]);
  });

  it("sample guarda a caixa arredondada só quando muda", async () => {
    const fake = fakePage(null);
    const log = await runSteps(fake.page, [
      {
        kind: "sample",
        target: { css: "#thumb" },
        read: "x",
        every: 10,
        for: 40,
      },
    ]);
    expect(log.samples).toHaveLength(1);
    expect(log.samples[0]?.value).toBe(10);
  });

  it("passos inválidos lançam antes de mexer na página", async () => {
    const fake = fakePage(null);
    await expect(runSteps(fake.page, [{ kind: "wait" }])).rejects.toThrow(
      "passo 1 (wait): falta ms",
    );
    expect(fake.calls).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bunx vitest run test/visual/steps.test.ts`
Expected: FAIL — o arquivo não carrega: o import `../../scripts/visual/steps.mjs` não existe.

- [ ] **Step 3: Implementar `scripts/visual/steps.mjs`**

```js
// Roteiro de interação por par (spec §6): os passos que rodam no app e, com outros alvos, no
// protótipo, antes da captura, da sonda ou da medida. validateSteps, globToRegExp e requestMatches são
// puros; runSteps recebe a página do Playwright pronta (este módulo não abre navegador).

/** @typedef {import("./screen.mjs").Target} Target */
/** @typedef {import("./screen.mjs").RequestMatch} RequestMatch */
/** @typedef {import("./screen.mjs").Step} Step */
/** @typedef {{ failed: { url: string, method: string, error: string }[], samples: { at: number, value: number | null }[], notes: string[] }} StepLog */

export const STEP_KINDS = Object.freeze([
  "click",
  "hover",
  "focus",
  "tab",
  "press",
  "fill",
  "drag",
  "wait",
  "waitFor",
  "failRequests",
  "restoreRequests",
  "sample",
]);

/** @type {Readonly<Record<string, { required: readonly string[], optional: readonly string[] }>>} */
const FIELDS = Object.freeze({
  click: { required: ["target"], optional: [] },
  hover: { required: ["target"], optional: [] },
  focus: { required: ["target"], optional: [] },
  tab: { required: ["times"], optional: [] },
  press: { required: ["key"], optional: [] },
  fill: { required: ["target", "value"], optional: [] },
  drag: { required: ["from", "to"], optional: [] },
  wait: { required: ["ms"], optional: [] },
  waitFor: { required: ["target"], optional: [] },
  failRequests: { required: ["match"], optional: ["times"] },
  restoreRequests: { required: [], optional: [] },
  sample: { required: ["target", "read", "every", "for"], optional: [] },
});

const SAMPLE_READS = Object.freeze(["x", "y", "width", "height"]);
const MAX_MS = 60_000;
const MAX_TABS = 50;
const MAX_FAILURES = 1_000;
const MIN_SAMPLE_EVERY = 10;
const WAIT_FOR_TIMEOUT = 60_000;

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} value */
function isMs(value) {
  return (
    Number.isInteger(value) && Number(value) >= 1 && Number(value) <= MAX_MS
  );
}

/**
 * @param {unknown} target
 * @returns {string | null} o erro, ou null se o alvo vale
 */
function targetError(target) {
  if (!isPlainObject(target)) return "alvo não é um objeto";
  const keys = Object.keys(target);
  if ("role" in target) {
    if (typeof target.role !== "string" || target.role === "")
      return "alvo.role vazio";
    if (typeof target.name !== "string" || target.name === "") {
      return "alvo.name vazio (o nome acessível)";
    }
    if ("exact" in target && typeof target.exact !== "boolean") {
      return "alvo.exact não é booleano";
    }
    const extra = keys.filter((k) => !["role", "name", "exact"].includes(k));
    return extra.length > 0
      ? `alvo com campo desconhecido: ${extra.join(", ")}`
      : null;
  }
  for (const kind of ["css", "text"]) {
    if (kind in target) {
      if (typeof target[kind] !== "string" || target[kind] === "")
        return `alvo.${kind} vazio`;
      return keys.length === 1
        ? null
        : `alvo { ${kind} } não aceita outros campos`;
    }
  }
  return "alvo sem role, css nem text";
}

/** @param {string} value */
function isRegexLiteral(value) {
  return value.length > 2 && value.startsWith("/") && value.endsWith("/");
}

/**
 * "/regex/" vira a RegExp de dentro; regex inválida vira null.
 * @param {string} value
 * @returns {RegExp | null}
 */
function regexOf(value) {
  try {
    return new RegExp(value.slice(1, -1));
  } catch {
    return null;
  }
}

/**
 * @param {unknown} match
 * @returns {string | null}
 */
function matchError(match) {
  if (!isPlainObject(match)) return "match não é um objeto";
  const keys = Object.keys(match);
  if (keys.length === 0) return "match vazio (use url, method ou header)";
  const extra = keys.filter((k) => !["url", "method", "header"].includes(k));
  if (extra.length > 0)
    return `match com campo desconhecido: ${extra.join(", ")}`;
  for (const key of keys) {
    if (typeof match[key] !== "string" || match[key] === "")
      return `match.${key} vazio`;
  }
  if (
    typeof match.url === "string" &&
    isRegexLiteral(match.url) &&
    regexOf(match.url) === null
  ) {
    return "match.url: regex inválida";
  }
  return null;
}

/**
 * Valida a lista de passos. Lista vazia vale; a resposta é a lista de erros (vazia = válida), cada um
 * com o número do passo.
 * @param {unknown} steps
 * @returns {string[]}
 */
export function validateSteps(steps) {
  if (!Array.isArray(steps)) return ["passos: não é uma lista"];
  /** @type {string[]} */
  const errors = [];
  for (const [index, step] of steps.entries()) {
    const at = `passo ${index + 1}`;
    if (!isPlainObject(step)) {
      errors.push(`${at}: não é um objeto`);
      continue;
    }
    const kind = step.kind;
    if (typeof kind !== "string" || !STEP_KINDS.includes(kind)) {
      errors.push(`${at}: kind desconhecido: ${String(kind)}`);
      continue;
    }
    const label = `${at} (${kind})`;
    const { required, optional } = FIELDS[kind];
    for (const field of required) {
      if (!(field in step)) errors.push(`${label}: falta ${field}`);
    }
    const extra = Object.keys(step).filter(
      (k) => k !== "kind" && !required.includes(k) && !optional.includes(k),
    );
    if (extra.length > 0)
      errors.push(`${label}: campo desconhecido: ${extra.join(", ")}`);
    for (const field of ["target", "from", "to"]) {
      if (field in step) {
        const error = targetError(step[field]);
        if (error) errors.push(`${label}: ${field}: ${error}`);
      }
    }
    if ("times" in step) {
      const max = kind === "tab" ? MAX_TABS : MAX_FAILURES;
      if (!Number.isInteger(step.times) || step.times < 1 || step.times > max) {
        errors.push(
          `${label}: times inválido: ${String(step.times)} (1 a ${max})`,
        );
      }
    }
    if ("key" in step && (typeof step.key !== "string" || step.key === "")) {
      errors.push(`${label}: key vazia`);
    }
    if ("value" in step && typeof step.value !== "string") {
      errors.push(`${label}: value não é texto`);
    }
    if ("ms" in step && !isMs(step.ms)) {
      errors.push(`${label}: ms inválido: ${String(step.ms)} (1 a ${MAX_MS})`);
    }
    if ("match" in step) {
      const error = matchError(step.match);
      if (error) errors.push(`${label}: ${error}`);
    }
    if (kind === "sample") {
      if ("read" in step && !SAMPLE_READS.includes(step.read)) {
        errors.push(
          `${label}: read inválido: ${String(step.read)} (x, y, width ou height)`,
        );
      }
      if ("for" in step && !isMs(step.for)) {
        errors.push(
          `${label}: for inválido: ${String(step.for)} (1 a ${MAX_MS})`,
        );
      }
      if (
        "every" in step &&
        (!Number.isInteger(step.every) ||
          step.every < MIN_SAMPLE_EVERY ||
          (isMs(step.for) && step.every > step.for))
      ) {
        errors.push(
          `${label}: every inválido: ${String(step.every)} (${MIN_SAMPLE_EVERY} até o for)`,
        );
      }
    }
  }
  return errors;
}

/**
 * Glob de URL em regex ancorada: `**` casa qualquer coisa (inclusive "/"), `*` casa dentro de um
 * segmento; o resto é literal.
 * @param {string} glob
 * @returns {RegExp}
 */
export function globToRegExp(glob) {
  let source = "";
  let i = 0;
  while (i < glob.length) {
    if (glob.startsWith("**", i)) {
      source += ".*";
      i += 2;
    } else if (glob[i] === "*") {
      source += "[^/]*";
      i += 1;
    } else {
      source += glob[i].replace(/[.+?^${}()|[\]\\]/g, "\\$&");
      i += 1;
    }
  }
  return new RegExp(`^${source}$`);
}

/**
 * A requisição casa com o match? Todos os campos dados precisam casar: `url` (glob ou regex entre
 * barras), `method` (sem caixa) e `header` (um nome que precisa existir, sem caixa). Match vazio não
 * casa nada. Server Action = { method: "POST", header: "next-action" }.
 * @param {RequestMatch} match
 * @param {{ url: string, method: string, headers: Record<string, string> }} req
 * @returns {boolean}
 */
export function requestMatches(match, req) {
  if (!isPlainObject(match) || Object.keys(match).length === 0) return false;
  if (typeof match.url === "string") {
    const pattern = isRegexLiteral(match.url)
      ? regexOf(match.url)
      : globToRegExp(match.url);
    if (!pattern || !pattern.test(req.url)) return false;
  }
  if (
    typeof match.method === "string" &&
    match.method.toUpperCase() !== String(req.method).toUpperCase()
  ) {
    return false;
  }
  if (typeof match.header === "string") {
    const wanted = match.header.toLowerCase();
    const names = Object.keys(req.headers ?? {}).map((name) =>
      name.toLowerCase(),
    );
    if (!names.includes(wanted)) return false;
  }
  return true;
}

/**
 * O alvo na página: só o visível (o Next mantém a página anterior escondida na navegação).
 * @param {import("@playwright/test").Page} page
 * @param {Target} target
 */
function locate(page, target) {
  let base;
  if ("role" in target) {
    base = page.getByRole(/** @type {any} */ (target.role), {
      name: target.name,
      exact: target.exact ?? false,
    });
  } else if ("css" in target) {
    base = page.locator(target.css);
  } else {
    base = page.getByText(target.text);
  }
  return base.filter({ visible: true }).first();
}

/**
 * @param {import("@playwright/test").Page} page
 * @param {{ target: Target, read: "x" | "y" | "width" | "height", every: number, for: number }} step
 * @param {StepLog} log
 */
async function sample(page, step, log) {
  const target = locate(page, step.target);
  const start = Date.now();
  /** @type {number | null | undefined} */
  let last;
  while (Date.now() - start < step.for) {
    const box = await target
      .boundingBox({ timeout: step.every })
      .catch(() => null);
    const value = box ? Math.round(box[step.read]) : null;
    if (value !== last) {
      log.samples.push({ at: Date.now() - start, value });
      last = value;
    }
    await page.waitForTimeout(step.every);
  }
}

/**
 * Roda os passos na página e devolve o registro: as requisições que falharam (`requestfailed`), as
 * amostras e as notas. A falha de rede vale do `failRequests` até o `restoreRequests` (ou o fim).
 * @param {import("@playwright/test").Page} page
 * @param {Step[]} steps
 * @returns {Promise<StepLog>}
 */
export async function runSteps(page, steps) {
  const errors = validateSteps(steps);
  if (errors.length > 0) {
    throw new Error(`passos inválidos:\n- ${errors.join("\n- ")}`);
  }
  /** @type {StepLog} */
  const log = { failed: [], samples: [], notes: [] };
  /** @param {import("@playwright/test").Request} request */
  const onFailed = (request) => {
    log.failed.push({
      url: request.url(),
      method: request.method(),
      error: request.failure()?.errorText ?? "desconhecido",
    });
  };
  /** @type {{ match: RequestMatch, remaining: number } | null} */
  let failing = null;
  /** @param {import("@playwright/test").Route} route */
  const handler = async (route) => {
    const request = route.request();
    const hit =
      failing !== null &&
      failing.remaining !== 0 &&
      requestMatches(failing.match, {
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
      });
    if (hit && failing) {
      if (failing.remaining > 0) failing.remaining -= 1;
      log.notes.push(`abortada: ${request.method()} ${request.url()}`);
      await route.abort("failed");
      return;
    }
    await route.fallback();
  };
  let routed = false;
  page.on("requestfailed", onFailed);
  try {
    for (const step of steps) {
      switch (step.kind) {
        case "click":
          await locate(page, step.target).click();
          break;
        case "hover":
          await locate(page, step.target).hover();
          break;
        case "focus":
          await locate(page, step.target).focus();
          break;
        case "tab":
          for (let n = 0; n < step.times; n++) await page.keyboard.press("Tab");
          break;
        case "press":
          await page.keyboard.press(step.key);
          break;
        case "fill":
          await locate(page, step.target).fill(step.value);
          break;
        case "drag":
          await locate(page, step.from).dragTo(locate(page, step.to));
          break;
        case "wait":
          await page.waitForTimeout(step.ms);
          break;
        case "waitFor":
          await locate(page, step.target).waitFor({
            state: "visible",
            timeout: WAIT_FOR_TIMEOUT,
          });
          break;
        case "failRequests":
          failing = { match: step.match, remaining: step.times ?? -1 };
          if (!routed) {
            await page.route("**/*", handler);
            routed = true;
          }
          break;
        case "restoreRequests":
          failing = null;
          if (routed) {
            await page.unroute("**/*", handler);
            routed = false;
          }
          break;
        case "sample":
          await sample(page, step, log);
          break;
        default:
          throw new Error(`kind sem runner: ${String(step.kind)}`);
      }
    }
  } finally {
    page.off("requestfailed", onFailed);
    if (routed) await page.unroute("**/*", handler);
  }
  return log;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bunx vitest run test/visual/steps.test.ts`
Expected: PASS, 16 testes.

- [ ] **Step 5: Escrever o teste das imagens**

`test/visual/image.test.ts`:

```ts
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  contactSheet,
  createPng,
  cropRect,
  cropTo,
  MASK_RGBA,
  paintRects,
  parseRect,
  stackRegion,
  writePng,
} from "../../scripts/visual/image.mjs";
import { repoRoot } from "../../scripts/visual/paths.mjs";

// As imagens das ferramentas visuais (spec §5.3): recorte, máscara, pilha e folha de
// contato, montadas com createPng (os testes não importam o pngjs).

type Png = { width: number; height: number; data: Buffer };
const WHITE = [255, 255, 255, 255];
const BLACK = [0, 0, 0, 255];
const BLUE = [0, 0, 255, 255];

function pixel(png: Png, x: number, y: number): number[] {
  const offset = (y * png.width + x) * 4;
  return [...png.data.subarray(offset, offset + 4)];
}

function fill(
  png: Png,
  [x, y, w, h]: [number, number, number, number],
  rgba: number[],
) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) png.data.set(rgba, (j * png.width + i) * 4);
  }
}

describe("createPng", () => {
  it("cria no tamanho, branco por padrão ou na cor dada", () => {
    const white = createPng(3, 2);
    expect([white.width, white.height]).toEqual([3, 2]);
    expect(pixel(white, 2, 1)).toEqual(WHITE);
    expect(pixel(createPng(1, 1, BLACK), 0, 0)).toEqual(BLACK);
  });

  it("lança em tamanho zero, negativo ou fracionário", () => {
    expect(() => createPng(0, 1)).toThrow("largura inválido");
    expect(() => createPng(1, -1)).toThrow("altura inválido");
    expect(() => createPng(1.5, 1)).toThrow("largura inválido");
  });
});

describe("cropRect e cropTo", () => {
  it("copia o retângulo de dentro", () => {
    const png = createPng(10, 10);
    fill(png, [4, 4, 1, 1], BLACK);
    const crop = cropRect(png, [3, 3, 3, 3]);
    expect([crop.width, crop.height]).toEqual([3, 3]);
    expect(pixel(crop, 1, 1)).toEqual(BLACK);
    expect(pixel(crop, 0, 0)).toEqual(WHITE);
  });

  it("corta na borda da imagem", () => {
    const crop = cropRect(createPng(10, 10), [8, 7, 5, 5]);
    expect([crop.width, crop.height]).toEqual([2, 3]);
  });

  it("lança com o canto fora da imagem ou tamanho zero", () => {
    expect(() => cropRect(createPng(10, 10), [10, 0, 1, 1])).toThrow(
      "recorte fora da imagem",
    );
    expect(() => cropRect(createPng(10, 10), [0, 0, 0, 1])).toThrow(
      "largura inválido",
    );
    expect(() => cropRect(createPng(10, 10), [-1, 0, 1, 1])).toThrow(
      "x inválido",
    );
  });

  it("cropTo é sempre uma cópia (a original não muda) e recusa maior que a imagem", () => {
    const png = createPng(4, 4);
    const copy = cropTo(png, 4, 4);
    expect(copy).not.toBe(png);
    paintRects(copy, [[0, 0, 4, 4]]);
    expect(pixel(png, 0, 0)).toEqual(WHITE);
    expect(() => cropTo(png, 5, 4)).toThrow("cropTo maior que a imagem");
  });
});

describe("paintRects", () => {
  it("pinta dentro, corta na borda e ignora o que cai fora", () => {
    const png = createPng(5, 5);
    paintRects(png, [
      [1, 1, 1, 1],
      [4, 4, 10, 10],
      [20, 20, 3, 3],
    ]);
    expect(pixel(png, 1, 1)).toEqual([...MASK_RGBA]);
    expect(pixel(png, 4, 4)).toEqual([...MASK_RGBA]);
    expect(pixel(png, 2, 2)).toEqual(WHITE);
  });

  it("com origem, pinta no recorte o retângulo medido na página", () => {
    const crop = createPng(5, 5);
    paintRects(crop, [[12, 12, 2, 2]], [10, 10]);
    expect(pixel(crop, 2, 2)).toEqual([...MASK_RGBA]);
    expect(pixel(crop, 3, 3)).toEqual([...MASK_RGBA]);
    expect(pixel(crop, 1, 1)).toEqual(WHITE);
  });

  it("sem retângulo, nada muda", () => {
    const png = createPng(2, 2);
    expect(paintRects(png, [])).toBe(png);
    expect(pixel(png, 0, 0)).toEqual(WHITE);
  });
});

describe("stackRegion", () => {
  it("empilha a mesma região de cada imagem, ampliada, com o espaço entre elas", () => {
    const black = createPng(4, 4, BLACK);
    const out = stackRegion(
      [createPng(4, 4), black, createPng(4, 4, BLUE)],
      [1, 1, 2, 2],
      3,
      6,
    );
    expect([out.width, out.height]).toEqual([6, 6 * 3 + 6 * 2]);
    expect(pixel(out, 5, 5)).toEqual(WHITE);
    expect(pixel(out, 0, 6)).toEqual(WHITE);
    expect(pixel(out, 0, 12)).toEqual(BLACK);
    expect(pixel(out, 5, 24)).toEqual(BLUE);
  });

  it("o que cai fora de uma imagem menor sai em magenta", () => {
    const out = stackRegion([createPng(2, 2)], [1, 1, 2, 2], 1, 0);
    expect(pixel(out, 0, 0)).toEqual(WHITE);
    expect(pixel(out, 1, 1)).toEqual([...MASK_RGBA]);
  });

  it("lança sem imagem, com zoom zero ou acima de 16", () => {
    expect(() => stackRegion([], [0, 0, 1, 1])).toThrow("nenhuma imagem");
    expect(() => stackRegion([createPng(1, 1)], [0, 0, 1, 1], 0)).toThrow(
      "zoom inválido",
    );
    expect(() => stackRegion([createPng(1, 1)], [0, 0, 1, 1], 17)).toThrow(
      "máximo 16",
    );
  });
});

describe("contactSheet", () => {
  it("põe as imagens lado a lado, reduzidas, e corta na altura máxima", () => {
    const sheet = contactSheet(
      [createPng(100, 50), createPng(40, 400, BLACK)],
      0.5,
      150,
      12,
    );
    expect([sheet.width, sheet.height]).toEqual([50 + 12 + 20, 150]);
    expect(pixel(sheet, 0, 0)).toEqual(WHITE);
    expect(pixel(sheet, 0, 30)).toEqual([...MASK_RGBA]);
    expect(pixel(sheet, 62, 10)).toEqual(BLACK);
  });

  it("a redução é a média da caixa (sem serrilhado)", () => {
    const png = createPng(2, 1, WHITE);
    fill(png, [1, 0, 1, 1], BLACK);
    const sheet = contactSheet([png], 0.5, 10, 0);
    expect(pixel(sheet, 0, 0)).toEqual([128, 128, 128, 255]);
  });

  it("lança sem imagem e com escala fora de (0, 1]", () => {
    expect(() => contactSheet([])).toThrow("nenhuma imagem");
    expect(() => contactSheet([createPng(1, 1)], 0)).toThrow("escala inválida");
    expect(() => contactSheet([createPng(1, 1)], 1.5)).toThrow(
      "escala inválida",
    );
  });
});

describe("parseRect", () => {
  it("lê x y largura altura", () => {
    expect(parseRect(["0", "12", "300", "40"])).toEqual([0, 12, 300, 40]);
  });

  it("lança com menos de quatro, negativo, zero ou lixo", () => {
    expect(() => parseRect(["1", "2"])).toThrow("x y largura altura");
    expect(() => parseRect(["-1", "0", "1", "1"])).toThrow(
      "retângulo inválido",
    );
    expect(() => parseRect(["0", "0", "0", "1"])).toThrow("retângulo inválido");
    expect(() => parseRect(["a", "0", "1", "1"])).toThrow("retângulo inválido");
  });
});

describe("writePng", () => {
  it("recusa gravar fora de .git/sdd", () => {
    expect(() =>
      writePng(join(repoRoot(), "fora.png"), createPng(1, 1)),
    ).toThrow("fora de .git/sdd");
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `bunx vitest run test/visual/image.test.ts`
Expected: FAIL — o arquivo não carrega: o import `../../scripts/visual/image.mjs` não existe.

- [ ] **Step 7: Implementar `scripts/visual/image.mjs`**

```js
// Imagens PNG das ferramentas visuais (spec §5.3): ler, gravar (só dentro de .git/sdd), recortar,
// pintar máscaras, empilhar regiões e montar a folha de contato. Tudo puro, fora readPng e writePng.
// Os testes montam imagens com createPng e não importam o pngjs (library-docs §21).
import { readFileSync } from "node:fs";

import { PNG } from "pngjs";

import { writeInsideSdd } from "./paths.mjs";

/** @typedef {[number, number, number, number]} Rect — [x, y, largura, altura], em px da imagem */
/** @typedef {{ width: number, height: number, data: Buffer }} Png */

/** A cor das máscaras e do que cai fora de uma imagem: magenta opaco, igual nos dois lados. */
export const MASK_RGBA = Object.freeze([255, 0, 255, 255]);
const WHITE = Object.freeze([255, 255, 255, 255]);
const MAX_ZOOM = 16;

/**
 * @param {string} label
 * @param {unknown} value
 * @param {number} min
 */
function assertInt(label, value, min) {
  if (!Number.isInteger(value) || Number(value) < min) {
    throw new Error(`${label} inválido: ${String(value)} (inteiro ≥ ${min})`);
  }
}

/**
 * @param {Png} png
 * @param {number} offset
 * @param {readonly number[]} rgba
 */
function setPixel(png, offset, rgba) {
  png.data[offset] = rgba[0] ?? 0;
  png.data[offset + 1] = rgba[1] ?? 0;
  png.data[offset + 2] = rgba[2] ?? 0;
  png.data[offset + 3] = rgba[3] ?? 255;
}

/**
 * PNG novo, preenchido com uma cor (padrão: branco opaco).
 * @param {number} width
 * @param {number} height
 * @param {readonly number[]} [rgba]
 * @returns {Png}
 */
export function createPng(width, height, rgba = WHITE) {
  assertInt("largura", width, 1);
  assertInt("altura", height, 1);
  const png = new PNG({ width, height });
  for (let offset = 0; offset < png.data.length; offset += 4) {
    setPixel(png, offset, rgba);
  }
  return png;
}

/**
 * @param {string} file
 * @returns {Png}
 */
export function readPng(file) {
  return PNG.sync.read(readFileSync(file));
}

/**
 * Grava o PNG. O destino passa por assertInsideSdd: fora de .git/sdd lança e nada é gravado.
 * @param {string} file
 * @param {Png} png
 */
export function writePng(file, png) {
  writeInsideSdd(file, PNG.sync.write(/** @type {any} */ (png)));
}

/**
 * Copia o retângulo, cortado nas bordas da imagem. Lança se o canto está fora dela.
 * @param {Png} png
 * @param {Rect} rect
 * @returns {Png}
 */
export function cropRect(png, rect) {
  const [x, y, w, h] = rect;
  assertInt("x", x, 0);
  assertInt("y", y, 0);
  assertInt("largura", w, 1);
  assertInt("altura", h, 1);
  if (x >= png.width || y >= png.height) {
    throw new Error(
      `recorte fora da imagem: ${rect.join(",")} em ${png.width}x${png.height}`,
    );
  }
  const width = Math.min(w, png.width - x);
  const height = Math.min(h, png.height - y);
  const out = new PNG({ width, height });
  PNG.bitblt(/** @type {any} */ (png), out, x, y, width, height, 0, 0);
  return out;
}

/**
 * Os primeiros `width` x `height` px (canto de cima à esquerda), sempre numa cópia. Lança se for
 * maior que a imagem.
 * @param {Png} png
 * @param {number} width
 * @param {number} height
 * @returns {Png}
 */
export function cropTo(png, width, height) {
  if (width > png.width || height > png.height) {
    throw new Error(
      `cropTo maior que a imagem: ${width}x${height} em ${png.width}x${png.height}`,
    );
  }
  return cropRect(png, [0, 0, width, height]);
}

/**
 * Pinta os retângulos com MASK_RGBA, cortados nas bordas. `origin` é o canto da imagem na página
 * (para pintar num recorte as máscaras medidas na página). Muda e devolve a própria imagem.
 * @param {Png} png
 * @param {readonly Rect[]} rects
 * @param {readonly [number, number]} [origin]
 * @returns {Png}
 */
export function paintRects(png, rects, origin = [0, 0]) {
  for (const [rx, ry, rw, rh] of rects) {
    const x0 = Math.max(0, Math.round(rx - origin[0]));
    const y0 = Math.max(0, Math.round(ry - origin[1]));
    const x1 = Math.min(png.width, Math.round(rx - origin[0] + rw));
    const y1 = Math.min(png.height, Math.round(ry - origin[1] + rh));
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        setPixel(png, (y * png.width + x) * 4, MASK_RGBA);
      }
    }
  }
  return png;
}

/**
 * Empilha a mesma região de cada imagem, de cima para baixo, ampliada `zoom` vezes (sem suavizar),
 * com `gap` px brancos entre elas; o que cai fora de uma imagem sai em MASK_RGBA (o sbs: protótipo,
 * app e diferença).
 * @param {readonly Png[]} pngs
 * @param {Rect} rect
 * @param {number} [zoom]
 * @param {number} [gap]
 * @returns {Png}
 */
export function stackRegion(pngs, rect, zoom = 1, gap = 6) {
  if (pngs.length === 0) throw new Error("stackRegion: nenhuma imagem");
  const [x, y, w, h] = rect;
  assertInt("x", x, 0);
  assertInt("y", y, 0);
  assertInt("largura", w, 1);
  assertInt("altura", h, 1);
  assertInt("zoom", zoom, 1);
  assertInt("gap", gap, 0);
  if (zoom > MAX_ZOOM)
    throw new Error(`zoom inválido: ${zoom} (máximo ${MAX_ZOOM})`);
  const block = h * zoom + gap;
  const out = createPng(w * zoom, block * pngs.length - gap);
  for (const [n, png] of pngs.entries()) {
    for (let j = 0; j < h * zoom; j++) {
      for (let i = 0; i < w * zoom; i++) {
        const sx = x + Math.floor(i / zoom);
        const sy = y + Math.floor(j / zoom);
        const offset = ((n * block + j) * out.width + i) * 4;
        if (sx >= png.width || sy >= png.height) {
          setPixel(out, offset, MASK_RGBA);
          continue;
        }
        const source = (sy * png.width + sx) * 4;
        out.data[offset] = png.data[source] ?? 0;
        out.data[offset + 1] = png.data[source + 1] ?? 0;
        out.data[offset + 2] = png.data[source + 2] ?? 0;
        out.data[offset + 3] = 255;
      }
    }
  }
  return out;
}

/**
 * Folha de contato: as imagens lado a lado, reduzidas por `scale` (média da caixa de origem, sem
 * serrilhado), cortadas em `maxHeight`, com `gap` px entre elas, sobre fundo MASK_RGBA.
 * @param {readonly Png[]} pngs
 * @param {number} [scale]
 * @param {number} [maxHeight]
 * @param {number} [gap]
 * @returns {Png}
 */
export function contactSheet(pngs, scale = 0.5, maxHeight = 1800, gap = 12) {
  if (pngs.length === 0) throw new Error("contactSheet: nenhuma imagem");
  if (!(scale > 0 && scale <= 1))
    throw new Error(`escala inválida: ${scale} (de 0 a 1)`);
  assertInt("altura máxima", maxHeight, 1);
  assertInt("gap", gap, 0);
  const sizes = pngs.map((png) => ({
    w: Math.max(1, Math.round(png.width * scale)),
    h: Math.max(1, Math.round(png.height * scale)),
  }));
  const width =
    sizes.reduce((sum, size) => sum + size.w, 0) + gap * (pngs.length - 1);
  const height = Math.min(maxHeight, Math.max(...sizes.map((size) => size.h)));
  const out = createPng(width, height, MASK_RGBA);
  let left = 0;
  for (const [n, png] of pngs.entries()) {
    const size = sizes[n] ?? { w: 1, h: 1 };
    const rows = Math.min(height, size.h);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < size.w; x++) {
        const sx0 = Math.floor(x / scale);
        const sy0 = Math.floor(y / scale);
        const sx1 = Math.min(
          png.width,
          Math.max(sx0 + 1, Math.floor((x + 1) / scale)),
        );
        const sy1 = Math.min(
          png.height,
          Math.max(sy0 + 1, Math.floor((y + 1) / scale)),
        );
        let r = 0;
        let g = 0;
        let b = 0;
        let count = 0;
        for (let yy = sy0; yy < sy1; yy++) {
          for (let xx = sx0; xx < sx1; xx++) {
            const source = (yy * png.width + xx) * 4;
            r += png.data[source] ?? 0;
            g += png.data[source + 1] ?? 0;
            b += png.data[source + 2] ?? 0;
            count += 1;
          }
        }
        if (count === 0) continue;
        const offset = (y * width + left + x) * 4;
        out.data[offset] = Math.round(r / count);
        out.data[offset + 1] = Math.round(g / count);
        out.data[offset + 2] = Math.round(b / count);
        out.data[offset + 3] = 255;
      }
    }
    left += size.w + gap;
  }
  return out;
}

/**
 * "x y largura altura" da linha de comando: inteiros, x e y ≥ 0, largura e altura ≥ 1.
 * @param {readonly (string | undefined)[]} values
 * @returns {Rect}
 */
export function parseRect(values) {
  if (values.length !== 4) throw new Error("retângulo: x y largura altura");
  const numbers = values.map((value) =>
    typeof value === "string" && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN,
  );
  const [x = Number.NaN, y = Number.NaN, w = Number.NaN, h = Number.NaN] =
    numbers;
  if (numbers.some((n) => Number.isNaN(n)) || w < 1 || h < 1) {
    throw new Error(
      `retângulo inválido: ${values.join(" ")} (x e y ≥ 0; largura e altura ≥ 1)`,
    );
  }
  return [x, y, w, h];
}
```

- [ ] **Step 8: Rodar e ver passar**

Run: `bunx vitest run test/visual/image.test.ts`
Expected: PASS, 18 testes.

- [ ] **Step 9: Escrever o teste da diferença**

`test/visual/diff.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  diffImages,
  PIXELMATCH_THRESHOLD,
  regionDiff,
  unionRect,
} from "../../scripts/visual/diff.mjs";
import { createPng } from "../../scripts/visual/image.mjs";

// A medida do pixel (spec §5.3): pixelmatch com threshold 0.1, recorte ao menor tamanho
// comum e as máscaras pintadas iguais nos dois lados.

type Png = { width: number; height: number; data: Buffer };
const BLACK = [0, 0, 0, 255];

function withBlock(
  width: number,
  height: number,
  rect: [number, number, number, number],
): Png {
  const png = createPng(width, height);
  const [x, y, w, h] = rect;
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) png.data.set(BLACK, (j * width + i) * 4);
  }
  return png;
}

describe("diffImages", () => {
  it("o threshold é o do PR A", () => {
    expect(PIXELMATCH_THRESHOLD).toBe(0.1);
  });

  it("iguais: zero", () => {
    const result = diffImages(createPng(10, 10), createPng(10, 10));
    expect(result).toMatchObject({
      width: 10,
      height: 10,
      different: 0,
      pct: 0,
    });
    expect(result.sizes).toEqual(["10x10", "10x10"]);
  });

  it("tudo diferente: 100%", () => {
    expect(diffImages(createPng(4, 4), createPng(4, 4, BLACK)).pct).toBe(100);
  });

  it("um bloco 4x4 diferente conta 16 px, e a imagem da diferença tem o tamanho comum", () => {
    const result = diffImages(
      createPng(10, 10),
      withBlock(10, 10, [2, 2, 4, 4]),
    );
    expect(result.different).toBe(16);
    expect(result.pct).toBeCloseTo(16, 5);
    expect([result.diff.width, result.diff.height]).toEqual([10, 10]);
  });

  it("a máscara cobre a diferença inteira (zero) ou metade (só a outra metade conta)", () => {
    const changed = withBlock(10, 10, [2, 2, 4, 4]);
    expect(
      diffImages(createPng(10, 10), changed, [[2, 2, 4, 4]]).different,
    ).toBe(0);
    expect(
      diffImages(createPng(10, 10), changed, [[2, 2, 2, 4]]).different,
    ).toBe(8);
  });

  it("tamanhos diferentes: mede no menor comum, informa os dois e não muda as entradas", () => {
    const tall = createPng(10, 12);
    const small = createPng(8, 10);
    const result = diffImages(tall, small, [[0, 0, 3, 3]]);
    expect([result.width, result.height]).toEqual([8, 10]);
    expect(result.sizes).toEqual(["10x12", "8x10"]);
    expect([...tall.data.subarray(0, 4)]).toEqual([255, 255, 255, 255]);
  });
});

describe("regionDiff", () => {
  const plain = createPng(10, 10);
  const changed = withBlock(10, 10, [2, 2, 4, 4]);

  it("mede só dentro da região", () => {
    expect(regionDiff(plain, changed, [0, 0, 5, 5]).different).toBe(9);
    expect(regionDiff(plain, changed, [6, 6, 4, 4]).different).toBe(0);
  });

  it("corta a região no que existe nas duas imagens e devolve os recortes", () => {
    const result = regionDiff(plain, createPng(8, 8), [6, 6, 10, 10]);
    expect([result.width, result.height]).toEqual([2, 2]);
    expect([
      result.crops.a.width,
      result.crops.b.width,
      result.crops.diff.width,
    ]).toEqual([2, 2, 2]);
  });

  it("as máscaras da página valem no recorte", () => {
    expect(
      regionDiff(plain, changed, [2, 2, 4, 4], [[2, 2, 2, 4]]).different,
    ).toBe(8);
  });

  it("lança com a região fora das imagens", () => {
    expect(() => regionDiff(plain, changed, [20, 20, 2, 2])).toThrow(
      "região fora das imagens",
    );
    expect(() => regionDiff(plain, changed, [-1, 0, 2, 2])).toThrow(
      "região fora das imagens",
    );
  });
});

describe("unionRect", () => {
  it("cobre os dois retângulos", () => {
    expect(unionRect([10, 10, 5, 5], [8, 12, 10, 2])).toEqual([8, 10, 10, 5]);
  });

  it("de um retângulo com ele mesmo é ele mesmo", () => {
    expect(unionRect([1, 2, 3, 4], [1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
  });
});
```

- [ ] **Step 10: Rodar e ver falhar**

Run: `bunx vitest run test/visual/diff.test.ts`
Expected: FAIL — o arquivo não carrega: o import `../../scripts/visual/diff.mjs` não existe.

- [ ] **Step 11: Implementar `scripts/visual/diff.mjs`**

```js
// Diferença de pixels entre duas capturas (spec §5.3), com o pixelmatch (threshold 0.1, os padrões
// da biblioteca para o anti-aliasing): recorta as duas ao menor tamanho comum, pinta as máscaras (o
// que depende do "agora") iguais nos dois lados e devolve a porcentagem; regionDiff mede só um
// retângulo (ex.: o cartão do turno). Puro, fora diffFiles e o CLI.
//   node scripts/visual/diff.mjs <a.png> <b.png> <saída.png> [máscaras.json]   (relativos a .git/sdd)
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import pixelmatch from "pixelmatch";

import { parseCliArgs } from "./config.mjs";
import {
  createPng,
  cropRect,
  cropTo,
  paintRects,
  readPng,
  writePng,
} from "./image.mjs";
import { sddPath } from "./paths.mjs";

/** @typedef {import("./image.mjs").Png} Png */
/** @typedef {import("./image.mjs").Rect} Rect */

export const PIXELMATCH_THRESHOLD = 0.1;

const USAGE =
  "uso: node scripts/visual/diff.mjs <a.png> <b.png> <saída.png> [máscaras.json] (caminhos relativos a .git/sdd)";

/**
 * @param {Png} a
 * @param {Png} b
 * @param {Png} out
 * @returns {number}
 */
function countDifferent(a, b, out) {
  return pixelmatch(a.data, b.data, out.data, out.width, out.height, {
    threshold: PIXELMATCH_THRESHOLD,
  });
}

/**
 * A diferença da página inteira, no menor tamanho comum. As entradas não mudam.
 * @param {Png} a
 * @param {Png} b
 * @param {readonly Rect[]} [masks]
 * @returns {{ width: number, height: number, sizes: [string, string], different: number, pct: number, diff: Png }}
 */
export function diffImages(a, b, masks = []) {
  const width = Math.min(a.width, b.width);
  const height = Math.min(a.height, b.height);
  const left = paintRects(cropTo(a, width, height), masks);
  const right = paintRects(cropTo(b, width, height), masks);
  const diff = createPng(width, height);
  const different = countDifferent(left, right, diff);
  return {
    width,
    height,
    sizes: [`${a.width}x${a.height}`, `${b.width}x${b.height}`],
    different,
    pct: (100 * different) / (width * height),
    diff,
  };
}

/**
 * A diferença só dentro de `rect` (em px da página), cortado ao que existe nas duas imagens; as
 * máscaras são as da página, pintadas no recorte.
 * @param {Png} a
 * @param {Png} b
 * @param {Rect} rect
 * @param {readonly Rect[]} [masks]
 * @returns {{ width: number, height: number, different: number, pct: number, crops: { a: Png, b: Png, diff: Png } }}
 */
export function regionDiff(a, b, rect, masks = []) {
  const [x, y, w, h] = rect;
  const width = Math.min(w, a.width - x, b.width - x);
  const height = Math.min(h, a.height - y, b.height - y);
  if (x < 0 || y < 0 || width < 1 || height < 1) {
    throw new Error(`região fora das imagens: ${rect.join(",")}`);
  }
  const box = /** @type {Rect} */ ([x, y, width, height]);
  const left = paintRects(cropRect(a, box), masks, [x, y]);
  const right = paintRects(cropRect(b, box), masks, [x, y]);
  const diff = createPng(width, height);
  const different = countDifferent(left, right, diff);
  return {
    width,
    height,
    different,
    pct: (100 * different) / (width * height),
    crops: { a: left, b: right, diff },
  };
}

/**
 * O menor retângulo que cobre os dois (a região do app e a do protótipo).
 * @param {Rect} a
 * @param {Rect} b
 * @returns {Rect}
 */
export function unionRect(a, b) {
  const x = Math.min(a[0], b[0]);
  const y = Math.min(a[1], b[1]);
  return [
    x,
    y,
    Math.max(a[0] + a[2], b[0] + b[2]) - x,
    Math.max(a[1] + a[3], b[1] + b[3]) - y,
  ];
}

/**
 * Lê as duas capturas, mede e grava a imagem da diferença (dentro de .git/sdd).
 * @param {string} aPath
 * @param {string} bPath
 * @param {string} outPath
 * @param {readonly Rect[]} [masks]
 * @returns {{ width: number, height: number, sizes: [string, string], different: number, pct: number }}
 */
export function diffFiles(aPath, bPath, outPath, masks = []) {
  const { diff, ...result } = diffImages(readPng(aPath), readPng(bPath), masks);
  writePng(outPath, diff);
  return result;
}

function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  if (
    Object.keys(flags).length > 0 ||
    positional.length < 3 ||
    positional.length > 4
  ) {
    throw new Error(USAGE);
  }
  const [a = "", b = "", out = "", maskFile] = positional;
  const masks = maskFile
    ? JSON.parse(readFileSync(sddPath(maskFile), "utf8"))
    : [];
  const result = diffFiles(sddPath(a), sddPath(b), sddPath(out), masks);
  console.log(
    `${result.pct.toFixed(3)}% (${result.different} px de ${result.width}x${result.height}; ${result.sizes.join(" vs ")})`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(
      `diff: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
```

- [ ] **Step 12: Rodar e ver passar**

Run: `bunx vitest run test/visual/diff.test.ts`
Expected: PASS, 12 testes.

- [ ] **Step 13: Escrever os testes da configuração de tela e da tela do Início**

`test/visual/screen.test.ts`:

```ts
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { sddDir } from "../../scripts/visual/paths.mjs";
import {
  loadScreen,
  minHeight,
  pickState,
  protoFile,
  resolvePath,
  seedArgs,
  validateScreen,
} from "../../scripts/visual/screen.mjs";

// A configuração de tela (spec §5.5): validação, caminho com marcadores, altura mínima,
// o arquivo da cópia do protótipo e o comando do seed.

const STATE = {
  seed: "inicio:admin",
  person: "ana",
  theme: "dark",
  path: "/?setor={setor}",
  proto: "proto-admin-escuro",
};

function screenWith(
  states: Record<string, unknown>,
  extra: Record<string, unknown> = {},
) {
  return { name: "teste", ready: "main", states, ...extra };
}

describe("validateScreen", () => {
  it("uma tela mínima é válida", () => {
    expect(validateScreen(screenWith({ admin: STATE }))).toEqual([]);
  });

  it("não objeto, sem estados nem audit, sem ready e campo desconhecido", () => {
    expect(validateScreen(null)).toEqual(["a configuração não é um objeto"]);
    expect(validateScreen({ name: "teste", states: {} })).toEqual([
      "a tela precisa de states ou de audit",
    ]);
    expect(validateScreen({ name: "teste", states: { admin: STATE } })).toEqual(
      ["ready: o seletor que diz que a página do app carregou"],
    );
    expect(
      validateScreen(screenWith({ admin: STATE }, { prontos: "x" })),
    ).toEqual(["tela: campo desconhecido: prontos"]);
    expect(
      validateScreen(screenWith({ admin: STATE }, { name: "Tela 1" })),
    ).toEqual(["name: letras minúsculas, números e hífen"]);
  });

  it("pessoa, tema, caminho, cópia e seed", () => {
    const errors = validateScreen(
      screenWith({
        a: { ...STATE, person: "maria" },
        b: { ...STATE, theme: "sepia" },
        c: { ...STATE, path: "https://exemplo.test/" },
        d: { ...STATE, proto: "Proto Admin.html" },
        e: { ...STATE, seed: "admin" },
        f: { seed: "inicio:admin", person: "ana", theme: "dark", path: "/" },
      }),
    );
    expect(errors).toEqual([
      "estado a: person desconhecida: maria (ana, bruno, carla, diego)",
      "estado b: theme é dark ou light",
      "estado c: path é um caminho do app começando com /",
      "estado d: proto é o nome da cópia sem .html, ou null",
      "estado e: seed no formato <tela>:<estado>",
      "estado f: falta proto (o nome da cópia, ou null para só o app)",
    ]);
  });

  it("larguras: vazia, zero, abaixo de 320, acima de 3840, repetida", () => {
    const errors = validateScreen(
      screenWith({
        a: { ...STATE, sizes: [] },
        b: { ...STATE, sizes: [0] },
        c: { ...STATE, sizes: [319, 3841] },
        d: { ...STATE, sizes: [390, 390] },
      }),
    );
    expect(errors).toEqual([
      "estado a: sizes: lista de larguras vazia",
      "estado b: sizes: largura inválida: 0 (320 a 3840)",
      "estado c: sizes: largura inválida: 319 (320 a 3840)",
      "estado c: sizes: largura inválida: 3841 (320 a 3840)",
      "estado d: sizes: largura repetida",
    ]);
  });

  it("passos: os erros do validateSteps com o lado; protótipo nulo não tem passos nem regiões", () => {
    const errors = validateScreen(
      screenWith({
        a: { ...STATE, steps: { app: [{ kind: "wait" }] } },
        b: {
          ...STATE,
          proto: null,
          steps: { proto: [] },
          regions: { cartao: "x" },
        },
        c: { ...STATE, steps: { meio: [] } },
      }),
    );
    expect(errors).toEqual([
      "estado a: steps.app: passo 1 (wait): falta ms",
      "estado b: steps.proto sem cópia do protótipo",
      "estado b: região sem cópia do protótipo",
      "estado c: steps: campo desconhecido: meio",
    ]);
  });

  it("expect.failedRequests exige um passo failRequests no app e um inteiro ≥ 1", () => {
    const fail = {
      kind: "failRequests",
      match: { method: "POST", header: "next-action" },
    };
    expect(
      validateScreen(
        screenWith({
          a: {
            ...STATE,
            proto: null,
            steps: { app: [fail] },
            expect: { failedRequests: 1 },
          },
        }),
      ),
    ).toEqual([]);
    expect(
      validateScreen(
        screenWith({ a: { ...STATE, expect: { failedRequests: 1 } } }),
      ),
    ).toEqual([
      "estado a: expect.failedRequests sem um passo failRequests no app",
    ]);
    expect(
      validateScreen(
        screenWith({
          a: {
            ...STATE,
            steps: { app: [fail] },
            expect: { failedRequests: 0 },
          },
        }),
      ),
    ).toEqual(["estado a: expect.failedRequests inválido: 0 (inteiro ≥ 1)"]);
  });

  it("patch, masks, protoDir e região com nome ou expressão inválidos", () => {
    const errors = validateScreen(
      screenWith(
        { a: { ...STATE, regions: { Cartão: "" } } },
        { patch: { read: "x" }, masks: "", protoDir: "../fora" },
      ),
    );
    expect(errors).toEqual([
      "protoDir: pasta relativa ao --out, sem ..",
      "estado a: região Cartão: nome inválido",
      "estado a: região Cartão: a expressão que devolve [x, y, w, h]",
      "patch: { read, write }, as duas expressões",
      "masks: a expressão que devolve os retângulos",
    ]);
  });

  it("audit: pessoa nula vale, nome repetido e caminho inválido não", () => {
    const audit = [
      { name: "entrar", path: "/entrar", person: null },
      { name: "entrar", path: "/conta", person: "ana", extraWidths: [820] },
      { name: "conta", path: "conta", person: "zé" },
    ];
    expect(validateScreen({ name: "leg", states: {}, audit })).toEqual([
      "audit 2: name repetido: entrar",
      "audit 3: path é um caminho do app começando com /",
      "audit 3: person desconhecida: zé (ou null, sem sessão)",
    ]);
    expect(
      validateScreen({ name: "leg", states: {}, audit: audit.slice(0, 1) }),
    ).toEqual([]);
  });
});

describe("pickState", () => {
  const screen = {
    name: "teste",
    ready: "main",
    states: { admin: STATE },
  } as never;

  it("devolve o estado pelo nome", () => {
    expect(pickState(screen, "admin")).toBe(STATE);
  });

  it("estado desconhecido (ou herdado do Object) lança com os nomes que existem", () => {
    expect(() => pickState(screen, "menu")).toThrow(
      "estado desconhecido na tela teste: menu (estados: admin)",
    );
    expect(() => pickState(screen, "toString")).toThrow("estado desconhecido");
    expect(() => pickState(screen, undefined)).toThrow("estado desconhecido");
  });
});

describe("resolvePath", () => {
  it("troca {setor} pelo id, codificado", () => {
    expect(resolvePath("/?setor={setor}", { sectorId: "a b" })).toBe(
      "/?setor=a%20b",
    );
    expect(resolvePath("/conta", { sectorId: "" })).toBe("/conta");
  });

  it("os outros marcadores vêm do segundo argumento", () => {
    expect(
      resolvePath("/passagens/{pendente}?setor={setor}", {
        sectorId: "s1",
        pendente: "p1",
      }),
    ).toBe("/passagens/p1?setor=s1");
  });

  it("marcador sem valor lança", () => {
    expect(() => resolvePath("/?setor={setor}", { sectorId: "" })).toThrow(
      "marcador sem valor: {setor}",
    );
    expect(() =>
      resolvePath("/solicitacoes/{solicitacao}", { sectorId: "s1" }),
    ).toThrow("marcador sem valor: {solicitacao}");
  });
});

describe("minHeight", () => {
  it("844 até 859px, 900 a partir de 860", () => {
    expect(minHeight(390)).toBe(844);
    expect(minHeight(859)).toBe(844);
    expect(minHeight(860)).toBe(900);
    expect(minHeight(1440)).toBe(900);
  });
});

describe("protoFile", () => {
  it("monta <sdd>/<out>/<protoDir>/<cópia>.html, com proto por padrão", () => {
    expect(protoFile("processo", {}, "proto-admin-escuro")).toBe(
      join(sddDir(), "processo", "proto", "proto-admin-escuro.html"),
    );
    expect(protoFile("processo", { protoDir: "proto-pack" }, "proto-x")).toBe(
      join(sddDir(), "processo", "proto-pack", "proto-x.html"),
    );
  });

  it("recusa out fora de .git/sdd e nome de cópia com caminho", () => {
    expect(() => protoFile("../..", {}, "proto-x")).toThrow("fora de");
    expect(() => protoFile("processo", {}, "../proto-x")).toThrow(
      "cópia do protótipo inválida",
    );
  });
});

describe("seedArgs", () => {
  it("o comando do seed, com o --setor só quando o estado tem setor", () => {
    expect(seedArgs({ seed: "inicio:admin" })).toEqual([
      "scripts/visual/seed/index.ts",
      "state",
      "inicio:admin",
    ]);
    expect(seedArgs({ seed: "inicio:entregue", sector: "Operações" })).toEqual([
      "scripts/visual/seed/index.ts",
      "state",
      "inicio:entregue",
      "--setor=Operações",
    ]);
  });
});

describe("loadScreen", () => {
  it("carrega a tela versionada pelo nome", async () => {
    const screen = await loadScreen({ screen: "inicio" });
    expect(screen.name).toBe("inicio");
  });

  it("exige um dos dois, recusa nome com caminho e config fora de .git/sdd", async () => {
    await expect(loadScreen({})).rejects.toThrow(
      "use --screen=<nome> ou --config=",
    );
    await expect(
      loadScreen({ screen: "inicio", config: "x.mjs" }),
    ).rejects.toThrow("um dos dois");
    await expect(loadScreen({ screen: "../inicio" })).rejects.toThrow(
      "nome de tela inválido",
    );
    await expect(loadScreen({ config: "../../package.json" })).rejects.toThrow(
      "fora de",
    );
  });

  it("tela que não existe: diz qual", async () => {
    await expect(loadScreen({ screen: "nao-existe" })).rejects.toThrow(
      "não consegui carregar screens/nao-existe.mjs",
    );
  });
});
```

`test/visual/screens.test.ts` (nesta tarefa, só o Início; a Task 8 acrescenta a legibilidade e as provas):

```ts
import { Script } from "node:vm";
import { describe, expect, it } from "vitest";

import { validateScreen } from "../../scripts/visual/screen.mjs";
import inicio from "../../scripts/visual/screens/inicio.mjs";
import { STATES } from "../../scripts/visual/seed/states/index";

// As configurações de tela versionadas (spec §5.5) são válidas, e cada semente existe.

const INICIO_COPIES = [
  "proto-admin-escuro",
  "proto-admin-claro",
  "proto-primeiro-escuro",
  "proto-primeiro-claro",
  "proto-continuar",
  "proto-sem-turnos",
  "proto-entregue-escuro-uld",
  "proto-confirmada-escuro-uld",
  "proto-entregue-claro-carga",
  "proto-confirmada-claro-operacoes",
];

/** A expressão é JavaScript que o navegador consegue ler: só compila, não roda. */
function parses(source: string): boolean {
  if (source === "") return false;
  try {
    return new Script(`(${source});`) instanceof Script;
  } catch {
    return false;
  }
}

describe("screens/inicio.mjs", () => {
  const states = Object.entries(inicio.states);

  it("é válida", () => {
    expect(validateScreen(inicio)).toEqual([]);
  });

  it("tem os 11 estados da spec §5.5, todos com a Ana em /?setor={setor}", () => {
    expect(Object.keys(inicio.states)).toEqual([
      "admin-escuro",
      "admin-claro",
      "primeiro-escuro",
      "primeiro-claro",
      "continuar",
      "sem-turnos",
      "menu",
      "entregue-escuro-uld",
      "confirmada-escuro-uld",
      "entregue-claro-carga",
      "confirmada-claro-operacoes",
    ]);
    for (const [, state] of states) {
      expect(state.person).toBe("ana");
      expect(state.path).toBe("/?setor={setor}");
    }
  });

  it("cada semente existe em STATES", () => {
    for (const [name, state] of states) {
      expect(Object.keys(STATES), name).toContain(state.seed);
    }
  });

  it("usa exatamente as dez cópias do protótipo", () => {
    expect(new Set(states.map(([, state]) => state.proto))).toEqual(
      new Set(INICIO_COPIES),
    );
  });

  it("os quatro do pack medem a região cartao; os outros, não", () => {
    const withCard = states
      .filter(([, state]) => state.regions?.cartao)
      .map(([name]) => name);
    expect(withCard).toEqual([
      "entregue-escuro-uld",
      "confirmada-escuro-uld",
      "entregue-claro-carga",
      "confirmada-claro-operacoes",
    ]);
  });

  it("o menu é só 390, só a janela, aberto pelos passos dos dois lados", () => {
    const menu = inicio.states.menu;
    expect(menu?.sizes).toEqual([390]);
    expect(menu?.viewportOnly).toBe(true);
    expect(menu?.steps?.app?.[0]).toMatchObject({ kind: "click" });
    expect(menu?.steps?.proto?.[0]).toMatchObject({ kind: "click" });
  });

  it("os do pack em Carga e Operações são só 1440, no setor certo", () => {
    expect(inicio.states["entregue-claro-carga"]).toMatchObject({
      sector: "Carga",
      sizes: [1440],
    });
    expect(inicio.states["confirmada-claro-operacoes"]).toMatchObject({
      sector: "Operações",
      sizes: [1440],
    });
  });

  it("patch, máscaras e região são JavaScript que o navegador lê", () => {
    expect(parses(inicio.patch?.read ?? "")).toBe(true);
    expect(parses(inicio.patch?.write ?? "")).toBe(true);
    expect(parses(inicio.masks ?? "")).toBe(true);
    expect(
      parses(inicio.states["entregue-escuro-uld"]?.regions?.cartao ?? ""),
    ).toBe(true);
  });
});
```

- [ ] **Step 14: Rodar e ver falhar**

Run: `bunx vitest run test/visual/screen.test.ts test/visual/screens.test.ts`
Expected: FAIL — os dois arquivos não carregam: os imports `../../scripts/visual/screen.mjs` e
`../../scripts/visual/screens/inicio.mjs` não existem.

- [ ] **Step 15: Implementar `scripts/visual/screen.mjs`**

```js
// Configuração de tela do processo visual (spec §5.5): carrega scripts/visual/screens/<tela>.mjs
// (versionada, sem nome de pessoa) ou um arquivo de .git/sdd (--config, fora do git), valida e
// resolve o que o estado precisa (caminho, altura mínima, cópia do protótipo, os arquivos do banco
// visual, o comando do seed). validateScreen é puro.
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { MOBILE_MAX_WIDTH } from "./config.mjs";
import {
  readJsonInsideSdd,
  repoRoot,
  sddPath,
  VISUAL_DB_FILES,
  visualDbDir,
} from "./paths.mjs";
import { validateSteps } from "./steps.mjs";
import { VISUAL_PEOPLE } from "./vocabulary.mjs";

/** @typedef {"ana" | "bruno" | "carla" | "diego"} PersonKey */
/** @typedef {{ role: string, name: string, exact?: boolean } | { css: string } | { text: string }} Target */
/** @typedef {{ url?: string, method?: string, header?: string }} RequestMatch */
/**
 * Um passo do roteiro (spec §6), com `kind` em STEP_KINDS: click/hover/focus { target }, tab { times },
 * press { key }, fill { target, value }, drag { from, to }, wait { ms }, waitFor { target },
 * failRequests { match, times? }, restoreRequests {}, sample { target, read, every, for }.
 * @typedef {{ kind: string, [field: string]: unknown }} Step
 */
/**
 * @typedef {Object} StateConfig
 * @property {string} seed            nome em STATES ("<tela>:<estado>")
 * @property {string} [sector]        nome do setor (padrão ULD)
 * @property {PersonKey} person
 * @property {"dark" | "light"} theme
 * @property {string} path            caminho do app, com {setor}
 * @property {number[]} [sizes]       padrão [1440, 390]
 * @property {boolean} [viewportOnly] só a janela, sem igualar a altura
 * @property {string | null} proto    nome da cópia, sem .html; null = só o app
 * @property {{ app?: Step[], proto?: Step[] }} [steps]
 * @property {string} [css]           simulação de medida, nunca correção
 * @property {Record<string, string>} [regions] expressão que devolve [x, y, w, h]
 * @property {{ failedRequests?: number }} [expect]
 */
/**
 * @typedef {Object} AuditScreen
 * @property {string} name
 * @property {string} path            com {setor}, {pendente}, {corrigida}, {solicitacao}
 * @property {PersonKey | null} person
 * @property {number[]} [extraWidths]
 * @property {Step[]} [steps]
 * @property {boolean} [viewportOnly]
 */
/**
 * @typedef {Object} ScreenConfig
 * @property {string} name
 * @property {string} [ready]         seletor que diz que a página do app carregou
 * @property {string} [protoDir]      padrão "proto", relativo ao --out
 * @property {Record<string, StateConfig>} states
 * @property {{ read: string, write: string }} [patch]
 * @property {string} [masks]
 * @property {AuditScreen[]} [audit]
 */
/** @typedef {{ state: string, sector: string, sectorId: string, sectors: Record<string, string>, users: Record<PersonKey, string>, at: string }} StateFile */

const PEOPLE = Object.freeze(Object.keys(VISUAL_PEOPLE));
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEED_NAME = /^[a-z0-9-]+:[a-z0-9-]+$/;
const SCREEN_FIELDS = [
  "name",
  "ready",
  "protoDir",
  "states",
  "patch",
  "masks",
  "audit",
];
const STATE_FIELDS = [
  "seed",
  "sector",
  "person",
  "theme",
  "path",
  "sizes",
  "viewportOnly",
  "proto",
  "steps",
  "css",
  "regions",
  "expect",
];
const AUDIT_FIELDS = [
  "name",
  "path",
  "person",
  "extraWidths",
  "steps",
  "viewportOnly",
];
const MIN_WIDTH = 320;
const MAX_WIDTH = 3840;

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} value */
function isText(value) {
  return typeof value === "string" && value.trim() !== "";
}

/** @param {unknown} value */
function isSlug(value) {
  return typeof value === "string" && SLUG.test(value);
}

/**
 * @param {Record<string, unknown>} value
 * @param {readonly string[]} allowed
 * @param {string} at
 * @param {string[]} errors
 */
function unknownFields(value, allowed, at, errors) {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length > 0)
    errors.push(`${at}: campo desconhecido: ${extra.join(", ")}`);
}

/**
 * @param {unknown} path
 * @param {string} at
 * @param {string[]} errors
 */
function pathErrors(path, at, errors) {
  if (
    typeof path !== "string" ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("://")
  ) {
    errors.push(`${at}: path é um caminho do app começando com /`);
  }
}

/**
 * @param {unknown} widths
 * @param {string} at
 * @param {string[]} errors
 */
function widthErrors(widths, at, errors) {
  if (!Array.isArray(widths) || widths.length === 0) {
    errors.push(`${at}: lista de larguras vazia`);
    return;
  }
  for (const width of widths) {
    if (!Number.isInteger(width) || width < MIN_WIDTH || width > MAX_WIDTH) {
      errors.push(
        `${at}: largura inválida: ${String(width)} (${MIN_WIDTH} a ${MAX_WIDTH})`,
      );
    }
  }
  if (new Set(widths).size !== widths.length)
    errors.push(`${at}: largura repetida`);
}

/**
 * @param {string} name
 * @param {unknown} state
 * @param {string[]} errors
 */
function validateState(name, state, errors) {
  const at = `estado ${name}`;
  if (!isSlug(name))
    errors.push(`${at}: nome com letras minúsculas, números e hífen`);
  if (!isPlainObject(state)) {
    errors.push(`${at}: não é um objeto`);
    return;
  }
  unknownFields(state, STATE_FIELDS, at, errors);
  if (typeof state.seed !== "string" || !SEED_NAME.test(state.seed)) {
    errors.push(`${at}: seed no formato <tela>:<estado>`);
  }
  if (state.sector !== undefined && !isText(state.sector))
    errors.push(`${at}: sector vazio`);
  if (!PEOPLE.includes(state.person)) {
    errors.push(
      `${at}: person desconhecida: ${String(state.person)} (${PEOPLE.join(", ")})`,
    );
  }
  if (state.theme !== "dark" && state.theme !== "light") {
    errors.push(`${at}: theme é dark ou light`);
  }
  pathErrors(state.path, at, errors);
  if (state.sizes !== undefined)
    widthErrors(state.sizes, `${at}: sizes`, errors);
  if (
    state.viewportOnly !== undefined &&
    typeof state.viewportOnly !== "boolean"
  ) {
    errors.push(`${at}: viewportOnly é booleano`);
  }
  if (!("proto" in state)) {
    errors.push(`${at}: falta proto (o nome da cópia, ou null para só o app)`);
  } else if (state.proto !== null && !isSlug(state.proto)) {
    errors.push(`${at}: proto é o nome da cópia sem .html, ou null`);
  }
  if (state.steps !== undefined) {
    if (!isPlainObject(state.steps)) {
      errors.push(`${at}: steps é { app?, proto? }`);
    } else {
      unknownFields(state.steps, ["app", "proto"], `${at}: steps`, errors);
      for (const side of ["app", "proto"]) {
        if (state.steps[side] === undefined) continue;
        for (const error of validateSteps(state.steps[side])) {
          errors.push(`${at}: steps.${side}: ${error}`);
        }
      }
      if (state.proto === null && state.steps.proto !== undefined) {
        errors.push(`${at}: steps.proto sem cópia do protótipo`);
      }
    }
  }
  if (state.css !== undefined && typeof state.css !== "string")
    errors.push(`${at}: css é texto`);
  if (state.regions !== undefined) {
    if (!isPlainObject(state.regions)) {
      errors.push(`${at}: regions é { <nome>: <expressão> }`);
    } else {
      if (state.proto === null)
        errors.push(`${at}: região sem cópia do protótipo`);
      for (const [region, expr] of Object.entries(state.regions)) {
        if (!isSlug(region))
          errors.push(`${at}: região ${region}: nome inválido`);
        if (!isText(expr)) {
          errors.push(
            `${at}: região ${region}: a expressão que devolve [x, y, w, h]`,
          );
        }
      }
    }
  }
  if (state.expect !== undefined) {
    if (!isPlainObject(state.expect)) {
      errors.push(`${at}: expect é { failedRequests? }`);
      return;
    }
    unknownFields(state.expect, ["failedRequests"], `${at}: expect`, errors);
    const wanted = state.expect.failedRequests;
    if (wanted !== undefined) {
      if (!Number.isInteger(wanted) || wanted < 1) {
        errors.push(
          `${at}: expect.failedRequests inválido: ${String(wanted)} (inteiro ≥ 1)`,
        );
      }
      const app = isPlainObject(state.steps) ? state.steps.app : undefined;
      const failing =
        Array.isArray(app) &&
        app.some((step) => isPlainObject(step) && step.kind === "failRequests");
      if (!failing)
        errors.push(
          `${at}: expect.failedRequests sem um passo failRequests no app`,
        );
    }
  }
}

/**
 * @param {unknown} audit
 * @param {string[]} errors
 */
function validateAudit(audit, errors) {
  if (!Array.isArray(audit)) {
    errors.push("audit: não é uma lista");
    return;
  }
  /** @type {Set<string>} */
  const names = new Set();
  for (const [index, entry] of audit.entries()) {
    const at = `audit ${index + 1}`;
    if (!isPlainObject(entry)) {
      errors.push(`${at}: não é um objeto`);
      continue;
    }
    unknownFields(entry, AUDIT_FIELDS, at, errors);
    if (!isSlug(entry.name))
      errors.push(`${at}: name com letras minúsculas, números e hífen`);
    else if (names.has(entry.name))
      errors.push(`${at}: name repetido: ${entry.name}`);
    else names.add(entry.name);
    pathErrors(entry.path, at, errors);
    if (entry.person !== null && !PEOPLE.includes(entry.person)) {
      errors.push(
        `${at}: person desconhecida: ${String(entry.person)} (ou null, sem sessão)`,
      );
    }
    if (entry.extraWidths !== undefined)
      widthErrors(entry.extraWidths, `${at}: extraWidths`, errors);
    if (entry.steps !== undefined) {
      for (const error of validateSteps(entry.steps))
        errors.push(`${at}: ${error}`);
    }
    if (
      entry.viewportOnly !== undefined &&
      typeof entry.viewportOnly !== "boolean"
    ) {
      errors.push(`${at}: viewportOnly é booleano`);
    }
  }
}

/**
 * Valida a configuração de tela. Devolve a lista de erros (vazia = válida).
 * @param {unknown} screen
 * @returns {string[]}
 */
export function validateScreen(screen) {
  if (!isPlainObject(screen)) return ["a configuração não é um objeto"];
  /** @type {string[]} */
  const errors = [];
  unknownFields(screen, SCREEN_FIELDS, "tela", errors);
  if (!isSlug(screen.name))
    errors.push("name: letras minúsculas, números e hífen");
  if (
    screen.protoDir !== undefined &&
    (typeof screen.protoDir !== "string" ||
      screen.protoDir === "" ||
      screen.protoDir.startsWith("/") ||
      screen.protoDir.split(/[\\/]/).includes(".."))
  ) {
    errors.push("protoDir: pasta relativa ao --out, sem ..");
  }
  const states = isPlainObject(screen.states) ? screen.states : null;
  if (!states) errors.push("states: não é um objeto");
  const stateNames = states ? Object.keys(states) : [];
  const hasAudit = Array.isArray(screen.audit) && screen.audit.length > 0;
  if (stateNames.length === 0 && !hasAudit)
    errors.push("a tela precisa de states ou de audit");
  if (stateNames.length > 0 && !isText(screen.ready)) {
    errors.push("ready: o seletor que diz que a página do app carregou");
  }
  for (const name of stateNames) validateState(name, states?.[name], errors);
  if (screen.patch !== undefined) {
    if (
      !isPlainObject(screen.patch) ||
      !isText(screen.patch.read) ||
      !isText(screen.patch.write)
    ) {
      errors.push("patch: { read, write }, as duas expressões");
    } else {
      unknownFields(screen.patch, ["read", "write"], "patch", errors);
    }
  }
  if (screen.masks !== undefined && !isText(screen.masks)) {
    errors.push("masks: a expressão que devolve os retângulos");
  }
  if (screen.audit !== undefined) validateAudit(screen.audit, errors);
  return errors;
}

/**
 * Carrega a configuração: `screen` → scripts/visual/screens/<nome>.mjs; `config` → um caminho
 * relativo a .git/sdd. Um dos dois. Lança com a lista de erros da validação.
 * @param {{ screen?: string, config?: string }} opts
 * @returns {Promise<ScreenConfig>}
 */
export async function loadScreen(opts) {
  const { screen, config } = opts;
  if ((screen === undefined) === (config === undefined)) {
    throw new Error(
      "use --screen=<nome> ou --config=<caminho relativo a .git/sdd> (um dos dois)",
    );
  }
  let file;
  let label;
  if (screen !== undefined) {
    if (!isSlug(screen))
      throw new Error(`nome de tela inválido: ${String(screen)}`);
    file = join(repoRoot(), "scripts", "visual", "screens", `${screen}.mjs`);
    label = `screens/${screen}.mjs`;
  } else {
    if (!isText(config)) throw new Error("--config vazio");
    file = sddPath(String(config));
    label = String(config);
  }
  let loaded;
  try {
    loaded = await import(pathToFileURL(file).href);
  } catch (error) {
    throw new Error(
      `não consegui carregar ${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const errors = validateScreen(loaded.default);
  if (errors.length > 0) {
    throw new Error(
      `configuração inválida (${label}):\n- ${errors.join("\n- ")}`,
    );
  }
  return loaded.default;
}

/**
 * O estado da tela pelo nome; lança com os nomes que existem.
 * @param {ScreenConfig} screen
 * @param {unknown} name
 * @returns {StateConfig}
 */
export function pickState(screen, name) {
  if (typeof name !== "string" || !Object.hasOwn(screen.states, name)) {
    throw new Error(
      `estado desconhecido na tela ${screen.name}: ${String(name)} (estados: ${Object.keys(screen.states).join(", ")})`,
    );
  }
  return screen.states[name];
}

/**
 * Troca os marcadores do caminho: `{setor}` pelo `sectorId`; qualquer outro `{nome}` pelo valor de
 * mesmo nome no segundo argumento (a auditoria passa `pendente`, `corrigida` e `solicitacao`).
 * Marcador sem valor lança "marcador sem valor: {nome}".
 * @param {string} template
 * @param {{ sectorId: string } & Record<string, unknown>} state
 * @returns {string}
 */
export function resolvePath(template, state) {
  return template.replace(/\{([a-z]+)\}/g, (_, key) => {
    const value = key === "setor" ? state.sectorId : state[key];
    if (typeof value !== "string" || value === "") {
      throw new Error(`marcador sem valor: {${key}}`);
    }
    return encodeURIComponent(value);
  });
}

/**
 * A altura mínima da captura: 844 no celular (abaixo de 860), 900 acima.
 * @param {number} width
 * @returns {number}
 */
export function minHeight(width) {
  return width <= MOBILE_MAX_WIDTH ? 844 : 900;
}

/**
 * Os argumentos do `bun` que semeiam o estado (o pairs, o measure, o probe e o interact usam).
 * @param {Pick<StateConfig, "seed" | "sector">} state
 * @returns {string[]}
 */
export function seedArgs(state) {
  return [
    "scripts/visual/seed/index.ts",
    "state",
    state.seed,
    ...(state.sector ? [`--setor=${state.sector}`] : []),
  ];
}

/**
 * Semeia o estado no banco visual (bun, na raiz do repositório), mostrando a saída do seed.
 * @param {Pick<StateConfig, "seed" | "sector">} state
 */
export function runSeed(state) {
  execFileSync("bun", seedArgs(state), { cwd: repoRoot(), stdio: "inherit" });
}

/** @returns {StateFile} o .git/sdd/visual-db/state.json do último `visual:seed state` */
export function readState() {
  const state = readJsonInsideSdd(join(visualDbDir(), VISUAL_DB_FILES.state));
  if (
    !isPlainObject(state) ||
    typeof state.sectorId !== "string" ||
    !isPlainObject(state.users)
  ) {
    throw new Error(
      "state.json inválido: rode bun run visual:seed state <tela>:<estado>",
    );
  }
  return /** @type {StateFile} */ (state);
}

/** @returns {Record<PersonKey, string>} o .git/sdd/visual-db/avatars.json */
export function readAvatars() {
  const avatars = readJsonInsideSdd(
    join(visualDbDir(), VISUAL_DB_FILES.avatars),
  );
  if (
    !isPlainObject(avatars) ||
    PEOPLE.some((key) => typeof avatars[key] !== "string")
  ) {
    throw new Error("avatars.json inválido: rode bun run visual:seed avatars");
  }
  return /** @type {Record<PersonKey, string>} */ (avatars);
}

/**
 * O arquivo da cópia do protótipo: <sdd>/<out>/<protoDir>/<stem>.html.
 * @param {string} out pasta relativa a .git/sdd
 * @param {Pick<ScreenConfig, "protoDir">} screen
 * @param {string} stem
 * @returns {string}
 */
export function protoFile(out, screen, stem) {
  if (!isSlug(stem))
    throw new Error(`cópia do protótipo inválida: ${String(stem)}`);
  return sddPath(out, screen.protoDir ?? "proto", `${stem}.html`);
}
```

- [ ] **Step 16: Implementar `scripts/visual/screens/inicio.mjs`**

Sem nenhum nome de pessoa nem texto do protótipo: os rótulos que aparecem aqui ("Alternar menu", "Abrir menu",
"Passagem do meu turno", "agora HH:MM") são de interface, e o "34%" é a largura da barra no protótipo, que o `patch`
troca pela do app.

```js
// Pares do Início (spec §5.5): os do PR A que o pack de correção não tocou e os quatro do pack.
// Versionado e sem nome de pessoa: as cópias do protótipo (já com as pessoas e os textos trocados
// pelo vocabulário) ficam em .git/sdd/<out>/proto/, feitas pelo proto.mjs com a configuração da
// branch, que fica fora do git.
//
// As quatro funções abaixo rodam DENTRO da página (viram texto com String(fn)): não usam nada de
// fora delas. O cartão do turno tem a mesma estrutura nos dois lados: nome, horário e data em
// spans irmãos, e a linha "início · agora · fim" logo abaixo do trilho da barra.

/** No app: o que depende do relógio no cartão do turno. */
function readShift() {
  const spans = [...document.querySelectorAll("span")];
  const time = spans.find((s) =>
    /^\d\d:\d\d–\d\d:\d\d$/.test(s.textContent.trim()),
  );
  const now = spans.find((s) => /^agora \d\d:\d\d$/.test(s.textContent.trim()));
  const fill = document.querySelector('[role="progressbar"] > div');
  const text = (el) => (el ? el.textContent : null);
  return {
    pct: fill instanceof HTMLElement ? fill.style.width : null,
    texts: {
      name: text(time?.previousElementSibling),
      time: text(time),
      date: text(time?.nextElementSibling),
      start: text(now?.previousElementSibling),
      now: text(now),
      end: text(now?.nextElementSibling),
    },
  };
}

/** No protótipo: escreve o que o app leu (o mesmo texto e a mesma largura da barra). */
function writeShift(value) {
  if (!value) return;
  const spans = [...document.querySelectorAll("span")];
  const time = spans.find((s) =>
    /^\d\d:\d\d–\d\d:\d\d$/.test(s.textContent.trim()),
  );
  const now = spans.find((s) => /^agora \d\d:\d\d$/.test(s.textContent.trim()));
  const targets = {
    name: time?.previousElementSibling,
    time,
    date: time?.nextElementSibling,
    start: now?.previousElementSibling,
    now,
    end: now?.nextElementSibling,
  };
  const fill = [...document.querySelectorAll("div")].find(
    (d) => d.style.width === "34%" && d.style.background,
  );
  for (const [key, el] of Object.entries(targets)) {
    const next = value.texts ? value.texts[key] : null;
    if (el && typeof next === "string") el.textContent = next;
  }
  if (fill && value.pct) fill.style.width = value.pct;
}

/** Nos dois lados: a linha "início · agora · fim" e o trilho da barra, que dependem do agora. */
function clockRects() {
  const out = [];
  const now = [...document.querySelectorAll("span")].find((s) =>
    /^agora \d\d:\d\d$/.test(s.textContent.trim()),
  );
  if (now?.parentElement) {
    const row = now.parentElement.getBoundingClientRect();
    out.push([row.x, row.y, row.width, row.height]);
    const track = now.parentElement.previousElementSibling;
    if (track) {
      const box = track.getBoundingClientRect();
      out.push([box.x, box.y, box.width, box.height]);
    }
  }
  return out.map((rect) => rect.map((v) => Math.round(v)));
}

/** Nos dois lados: o cartão "Passagem do meu turno" (o <h2> fica numa linha filha do cartão). */
function shiftCardRect() {
  const title = [...document.querySelectorAll("h2")].find(
    (h) => h.textContent.trim() === "Passagem do meu turno",
  );
  const card = title?.parentElement?.parentElement;
  if (!card) return null;
  const box = card.getBoundingClientRect();
  return [box.x, box.y, box.width, box.height];
}

const HOME = "/?setor={setor}";
const CARD = { cartao: `(${shiftCardRect})()` };

/**
 * Um par visto pela Ana no Início.
 * @param {string} seed
 * @param {"dark" | "light"} theme
 * @param {string} proto
 * @param {Partial<import("../screen.mjs").StateConfig>} [extra]
 * @returns {import("../screen.mjs").StateConfig}
 */
function pair(seed, theme, proto, extra = {}) {
  return { seed, person: "ana", theme, path: HOME, proto, ...extra };
}

/** @type {import("../screen.mjs").ScreenConfig} */
const inicio = {
  name: "inicio",
  ready: '[data-slot="home-cards"], [data-slot="home-hero-row"]',
  patch: { read: `(${readShift})()`, write: String(writeShift) },
  masks: `(${clockRects})()`,
  states: {
    "admin-escuro": pair("inicio:admin", "dark", "proto-admin-escuro"),
    "admin-claro": pair("inicio:admin", "light", "proto-admin-claro"),
    "primeiro-escuro": pair("inicio:primeiro", "dark", "proto-primeiro-escuro"),
    "primeiro-claro": pair("inicio:primeiro", "light", "proto-primeiro-claro"),
    continuar: pair("inicio:continuar", "dark", "proto-continuar"),
    "sem-turnos": pair("inicio:sem-turnos", "dark", "proto-sem-turnos"),
    // Celular com o menu aberto: só 390, só a janela (844), os dois lados abertos pelos passos.
    menu: pair("inicio:admin", "dark", "proto-admin-escuro", {
      sizes: [390],
      viewportOnly: true,
      steps: {
        app: [
          { kind: "click", target: { role: "button", name: "Alternar menu" } },
          { kind: "wait", ms: 900 },
        ],
        proto: [
          { kind: "click", target: { role: "button", name: "Abrir menu" } },
          { kind: "wait", ms: 900 },
        ],
      },
    }),
    // O pack de correção: a página e o cartão do turno.
    "entregue-escuro-uld": pair(
      "inicio:entregue",
      "dark",
      "proto-entregue-escuro-uld",
      {
        sector: "ULD",
        regions: CARD,
      },
    ),
    "confirmada-escuro-uld": pair(
      "inicio:confirmada",
      "dark",
      "proto-confirmada-escuro-uld",
      {
        sector: "ULD",
        regions: CARD,
      },
    ),
    "entregue-claro-carga": pair(
      "inicio:entregue",
      "light",
      "proto-entregue-claro-carga",
      {
        sector: "Carga",
        sizes: [1440],
        regions: CARD,
      },
    ),
    "confirmada-claro-operacoes": pair(
      "inicio:confirmada",
      "light",
      "proto-confirmada-claro-operacoes",
      { sector: "Operações", sizes: [1440], regions: CARD },
    ),
  },
};

export default inicio;
```

- [ ] **Step 17: Rodar e ver passar**

Run: `bunx vitest run test/visual/screen.test.ts test/visual/screens.test.ts`
Expected: PASS, 2 arquivos, 28 testes (20 + 8).

- [ ] **Step 18: Escrever o teste do motor das cópias**

`test/visual/proto.test.ts` (HTML sintético e uma lista sintética, só com termos inventados; a linha de cada termo é a
que o `parseNamesList` da Task 6 devolve, sem número fixo no teste):

```ts
import { describe, expect, it } from "vitest";

import { parseNamesList } from "../../scripts/visual/names.mjs";
import {
  applyReplacements,
  findLeftovers,
  readProps,
  setPropDefaults,
} from "../../scripts/visual/proto.mjs";

// O motor das cópias do protótipo (spec §5.6), com HTML sintético e uma lista sintética
// de termos inventados. Os erros dizem o número da troca ou da linha da lista, nunca o texto.

const PROPS = {
  tema: { editor: "enum", options: ["Escuro", "Claro"], default: "Escuro" },
  pendente: { editor: "boolean", default: false },
};

function encode(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function page(
  props: unknown = PROPS,
  body = "<p>Fulano Inventado & cia</p>",
): string {
  return `<!doctype html><div data-props="${encode(JSON.stringify(props))}">${body}</div>`;
}

function messageOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  return "";
}

describe("applyReplacements", () => {
  it("troca todas as ocorrências, na ordem (a segunda vê o resultado da primeira)", () => {
    expect(
      applyReplacements("a-b-a", [
        ["a", "x"],
        ["x-b", "y"],
      ]),
    ).toBe("y-x");
  });

  it("sem troca, devolve o mesmo texto", () => {
    expect(applyReplacements("abc", [])).toBe("abc");
  });

  it("troca ausente: erro com o número, sem o texto original", () => {
    const message = messageOf(() =>
      applyReplacements("abc", [
        ["a", "x"],
        ["Original Secreto", "y"],
      ]),
    );
    expect(message).toBe("troca nº 2 não encontrada");
    expect(message).not.toContain("Original Secreto");
  });

  it("troca mal formada e lista que não é lista", () => {
    expect(() => applyReplacements("abc", [["", "x"]])).toThrow(
      "troca nº 1 inválida",
    );
    expect(() => applyReplacements("abc", [["a"]])).toThrow(
      "troca nº 1 inválida",
    );
    expect(() => applyReplacements("abc", "a")).toThrow("não são uma lista");
  });
});

describe("readProps e setPropDefaults", () => {
  it("lê o data-props decodificado", () => {
    expect(readProps(page())).toEqual(PROPS);
  });

  it("muda o default e mantém o resto da página e das props", () => {
    const html = setPropDefaults(page(), { tema: "Claro", pendente: true });
    expect(readProps(html)).toEqual({
      tema: { ...PROPS.tema, default: "Claro" },
      pendente: { ...PROPS.pendente, default: true },
    });
    expect(html).toContain("<p>Fulano Inventado & cia</p>");
    expect(html.startsWith("<!doctype html><div data-props=")).toBe(true);
  });

  it("prop desconhecida, valor fora das opções e tipo errado lançam", () => {
    expect(() => setPropDefaults(page(), { perfil: "Colega" })).toThrow(
      "prop desconhecida: perfil",
    );
    expect(() => setPropDefaults(page(), { tema: "Sépia" })).toThrow(
      "valor fora das opções da prop tema",
    );
    expect(() => setPropDefaults(page(), { pendente: "sim" })).toThrow(
      "a prop pendente é booleana",
    );
  });

  it("sem data-props, com dois, ou com JSON quebrado: lança", () => {
    expect(() => readProps("<div></div>")).toThrow(
      "a cópia não tem data-props",
    );
    expect(() => readProps(`${page()}${page()}`)).toThrow(
      "a cópia tem 2 data-props",
    );
    expect(() => readProps('<div data-props="{nada"></div>')).toThrow(
      "data-props não é um JSON válido",
    );
    expect(() => readProps('<div data-props="[1]"></div>')).toThrow(
      "data-props não é um objeto",
    );
  });
});

describe("findLeftovers", () => {
  const list = parseNamesList(
    [
      "# lista sintética, só com termos inventados",
      "Fulano Inventado",
      "!Fulano Inventado de Teste",
      "pessoa.inventada@exemplo.test",
    ].join("\n"),
  );
  const nameLine = list.terms[0]?.listLine;
  const emailLine = list.terms[1]?.listLine;

  it("acha o termo da lista pela linha da lista, sem caixa", () => {
    expect(findLeftovers("<p>FULANO INVENTADO</p>", list)).toEqual([
      { kind: "lista", listLine: nameLine, line: 1 },
    ]);
    expect(findLeftovers("a\nPessoa.Inventada@exemplo.test", list)).toEqual([
      { kind: "lista", listLine: emailLine, line: 2 },
    ]);
  });

  it("a frase permitida (!) não conta, e texto limpo não acha nada", () => {
    expect(findLeftovers("Fulano Inventado de Teste", list)).toEqual([]);
    expect(findLeftovers("Ana Teste e Bruno Teste", list)).toEqual([]);
  });

  it("os leftovers extras contam pelo número, sem caixa", () => {
    expect(
      findLeftovers("img de api.exemplo.test", list, [
        "outro.test",
        "API.EXEMPLO.TEST",
      ]),
    ).toEqual([{ kind: "extra", index: 2 }]);
  });
});
```

- [ ] **Step 19: Rodar e ver falhar**

Run: `bunx vitest run test/visual/proto.test.ts`
Expected: FAIL — o arquivo não carrega: o import `../../scripts/visual/proto.mjs` não existe.

- [ ] **Step 20: Implementar `scripts/visual/proto.mjs`**

```js
// Motor das cópias do protótipo (spec §5.6). A configuração da branch fica fora do git (tem os
// originais do protótipo) e devolve as trocas; o motor aplica as trocas na ordem, ajusta os padrões
// das props do data-props por cópia, procura em cada cópia todos os termos de nomes-proibidos.txt
// (o mesmo names.mjs do check-names) e os `leftovers`, e só então grava as cópias e os arquivos de
// apoio. Os erros dizem o NÚMERO da troca ou da linha da lista, nunca o texto (que é o original).
//   node scripts/visual/proto.mjs --config=<caminho relativo a .git/sdd>
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { parseCliArgs } from "./config.mjs";
import { findForbidden, loadNamesList, namesListPath } from "./names.mjs";
import { sddPath, writeInsideSdd } from "./paths.mjs";
import { readAvatars } from "./screen.mjs";
import {
  VISUAL_DESTINATIONS,
  VISUAL_ITEMS,
  VISUAL_PEOPLE,
  VISUAL_SECTORS,
  VISUAL_SHIFTS,
  VISUAL_TEXTS,
} from "./vocabulary.mjs";

/** @typedef {import("./names.mjs").NamesList} NamesList */
/** @typedef {[string, string]} Replacement */
/**
 * O que a configuração recebe em `replacements(ctx)` (e em `extra(ctx)`, quando é função).
 * @typedef {Object} ProtoContext
 * @property {Record<string, string>} avatars  data URI por pessoa (avatars.json)
 * @property {typeof VISUAL_PEOPLE} people
 * @property {{ sectors: typeof VISUAL_SECTORS, shifts: typeof VISUAL_SHIFTS, items: typeof VISUAL_ITEMS, destinations: typeof VISUAL_DESTINATIONS, texts: typeof VISUAL_TEXTS }} vocabulary
 * @property {Date} now
 */
/** @typedef {{ kind: "lista", listLine: number, line: number } | { kind: "extra", index: number }} Leftover */

const PROPS_ATTR = /data-props="([^"]*)"/g;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const USAGE =
  "uso: node scripts/visual/proto.mjs --config=<caminho relativo a .git/sdd>";

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** @param {unknown} error */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Aplica as trocas [original, troca] na ordem, cada uma em todas as ocorrências. Uma troca cujo
 * original não existe é erro "troca nº N não encontrada" (pelo número, nunca pelo texto).
 * @param {string} html
 * @param {unknown} pairs
 * @returns {string}
 */
export function applyReplacements(html, pairs) {
  if (!Array.isArray(pairs))
    throw new Error("as trocas não são uma lista de [original, troca]");
  let out = html;
  for (const [index, pair] of pairs.entries()) {
    const n = index + 1;
    if (
      !Array.isArray(pair) ||
      pair.length !== 2 ||
      typeof pair[0] !== "string" ||
      pair[0] === "" ||
      typeof pair[1] !== "string"
    ) {
      throw new Error(
        `troca nº ${n} inválida (use [original, troca], dois textos)`,
      );
    }
    if (!out.includes(pair[0])) throw new Error(`troca nº ${n} não encontrada`);
    out = out.split(pair[0]).join(pair[1]);
  }
  return out;
}

/** @param {string} value */
function decodeAttribute(value) {
  return value
    .replaceAll("&quot;", '"')
    .replaceAll("&#34;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
}

/** @param {string} value */
function encodeAttribute(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

/** @param {string} html */
function propsMatch(html) {
  const matches = [...html.matchAll(PROPS_ATTR)];
  const [first] = matches;
  if (!first) throw new Error("a cópia não tem data-props");
  if (matches.length > 1)
    throw new Error(`a cópia tem ${matches.length} data-props (esperado 1)`);
  return first;
}

/**
 * As props do `data-props` do `.dc.html` (o JSON do atributo, já decodificado).
 * @param {string} html
 * @returns {Record<string, any>}
 */
export function readProps(html) {
  const match = propsMatch(html);
  let props;
  try {
    props = JSON.parse(decodeAttribute(match[1] ?? ""));
  } catch {
    throw new Error("data-props não é um JSON válido");
  }
  if (!isPlainObject(props)) throw new Error("data-props não é um objeto");
  return props;
}

/**
 * Muda o `default` das props dadas. Lança "prop desconhecida: <nome>", e no valor fora das
 * `options` ou de tipo diferente do padrão (booleano).
 * @param {string} html
 * @param {Record<string, unknown>} values
 * @returns {string}
 */
export function setPropDefaults(html, values) {
  const props = readProps(html);
  for (const [name, value] of Object.entries(values)) {
    if (!Object.hasOwn(props, name))
      throw new Error(`prop desconhecida: ${name}`);
    const prop = isPlainObject(props[name]) ? props[name] : {};
    if (Array.isArray(prop.options) && !prop.options.includes(value)) {
      throw new Error(`valor fora das opções da prop ${name}`);
    }
    if (typeof prop.default === "boolean" && typeof value !== "boolean") {
      throw new Error(`a prop ${name} é booleana`);
    }
    props[name] = { ...prop, default: value };
  }
  const match = propsMatch(html);
  const start = match.index ?? 0;
  return `${html.slice(0, start)}data-props="${encodeAttribute(JSON.stringify(props))}"${html.slice(start + match[0].length)}`;
}

/**
 * O que sobrou no texto: os termos da lista (pela linha da lista) e os `extra` da configuração
 * (pelo número, sem caixa).
 * @param {string} text
 * @param {NamesList} list
 * @param {readonly string[]} [extra]
 * @returns {Leftover[]}
 */
export function findLeftovers(text, list, extra = []) {
  /** @type {Leftover[]} */
  const hits = findForbidden(text, list).map((hit) => ({
    kind: "lista",
    listLine: hit.listLine,
    line: hit.line,
  }));
  const lower = text.toLowerCase();
  for (const [index, term] of extra.entries()) {
    if (
      typeof term === "string" &&
      term !== "" &&
      lower.includes(term.toLowerCase())
    ) {
      hits.push({ kind: "extra", index: index + 1 });
    }
  }
  return hits;
}

/**
 * @param {string} label
 * @param {string} text
 * @param {NamesList} list
 * @param {readonly string[]} extra
 */
function assertClean(label, text, list, extra) {
  const hits = findLeftovers(text, list, extra);
  if (hits.length === 0) return;
  const lines = hits
    .slice(0, 10)
    .map((hit) =>
      hit.kind === "lista"
        ? `${label}: sobrou o termo da linha ${hit.listLine} da lista (linha ${hit.line} da cópia)`
        : `${label}: sobrou o termo extra nº ${hit.index} dos leftovers`,
    );
  if (hits.length > 10) lines.push(`… e mais ${hits.length - 10}`);
  throw new Error(lines.join("\n"));
}

/** @param {unknown} value */
function isRelativeInside(value) {
  return (
    typeof value === "string" &&
    value !== "" &&
    !value.startsWith("/") &&
    !/^[a-zA-Z]:/.test(value) &&
    !value.split(/[\\/]/).includes("..")
  );
}

/**
 * @param {unknown} config
 * @returns {string[]}
 */
function validateProtoConfig(config) {
  if (!isPlainObject(config))
    return ["a configuração não é um objeto (export default)"];
  /** @type {string[]} */
  const errors = [];
  const extraKeys = Object.keys(config).filter(
    (k) => !["out", "sources", "leftovers"].includes(k),
  );
  if (extraKeys.length > 0)
    errors.push(`campo desconhecido: ${extraKeys.join(", ")}`);
  if (!isRelativeInside(config.out))
    errors.push("out: pasta relativa a .git/sdd, sem ..");
  if (
    config.leftovers !== undefined &&
    (!Array.isArray(config.leftovers) ||
      config.leftovers.some((t) => typeof t !== "string" || t === ""))
  ) {
    errors.push("leftovers: lista de textos");
  }
  if (!Array.isArray(config.sources) || config.sources.length === 0) {
    errors.push("sources: lista com pelo menos uma fonte");
    return errors;
  }
  for (const [index, source] of config.sources.entries()) {
    const at = `fonte ${index + 1}`;
    if (!isPlainObject(source)) {
      errors.push(`${at}: não é um objeto`);
      continue;
    }
    if (!isRelativeInside(source.file))
      errors.push(`${at}: file relativo a .git/sdd, sem ..`);
    if (
      source.support !== undefined &&
      (!Array.isArray(source.support) ||
        source.support.some((s) => !isRelativeInside(s)))
    ) {
      errors.push(`${at}: support é uma lista de arquivos ao lado do file`);
    }
    if (typeof source.replacements !== "function")
      errors.push(`${at}: replacements(ctx) é uma função`);
    if (
      !isPlainObject(source.copies) ||
      Object.keys(source.copies).length === 0
    ) {
      errors.push(`${at}: copies com pelo menos uma cópia`);
      continue;
    }
    for (const [name, copy] of Object.entries(source.copies)) {
      if (!SLUG.test(name)) errors.push(`${at}: cópia ${name}: nome inválido`);
      if (!isPlainObject(copy)) {
        errors.push(`${at}: cópia ${name}: não é um objeto`);
        continue;
      }
      if (copy.props !== undefined && !isPlainObject(copy.props)) {
        errors.push(`${at}: cópia ${name}: props é um objeto`);
      }
      if (
        copy.extra !== undefined &&
        !Array.isArray(copy.extra) &&
        typeof copy.extra !== "function"
      ) {
        errors.push(
          `${at}: cópia ${name}: extra é uma lista de trocas ou uma função(ctx)`,
        );
      }
    }
  }
  return errors;
}

/**
 * Gera as cópias da configuração (um caminho relativo a .git/sdd). Nada é gravado se uma cópia
 * falhar. Devolve os arquivos gravados.
 * @param {string} configRelPath
 * @returns {Promise<string[]>}
 */
export async function buildProtoCopies(configRelPath) {
  if (typeof configRelPath !== "string" || configRelPath === "")
    throw new Error(USAGE);
  const configFile = sddPath(configRelPath);
  let config;
  try {
    config = (await import(pathToFileURL(configFile).href)).default;
  } catch (error) {
    throw new Error(
      `não consegui carregar ${configRelPath}: ${messageOf(error)}`,
    );
  }
  const errors = validateProtoConfig(config);
  if (errors.length > 0) {
    throw new Error(
      `configuração inválida (${configRelPath}):\n- ${errors.join("\n- ")}`,
    );
  }
  const list = loadNamesList();
  if (list === null) {
    throw new Error(
      `lista de nomes ausente: ${namesListPath()} (grave antes de gerar as cópias)`,
    );
  }
  if (list.terms.length === 0)
    throw new Error(`lista de nomes vazia: ${namesListPath()}`);

  /** @type {ProtoContext} */
  const ctx = {
    avatars: readAvatars(),
    people: VISUAL_PEOPLE,
    vocabulary: {
      sectors: VISUAL_SECTORS,
      shifts: VISUAL_SHIFTS,
      items: VISUAL_ITEMS,
      destinations: VISUAL_DESTINATIONS,
      texts: VISUAL_TEXTS,
    },
    now: new Date(),
  };
  const outDir = sddPath(config.out);
  /** @type {readonly string[]} */
  const leftovers = config.leftovers ?? [];
  /** @type {Map<string, Buffer | string>} */
  const writes = new Map();

  for (const [index, source] of config.sources.entries()) {
    const label = `fonte ${index + 1}`;
    const original = readFileSync(sddPath(source.file), "utf8");
    let base;
    try {
      base = applyReplacements(original, source.replacements(ctx));
    } catch (error) {
      throw new Error(`${label}: ${messageOf(error)}`);
    }
    for (const [name, copy] of Object.entries(source.copies)) {
      const file = join(outDir, `${name}.html`);
      if (writes.has(file)) throw new Error(`cópia repetida: ${name}`);
      let html;
      try {
        html = copy.props ? setPropDefaults(base, copy.props) : base;
        const extra =
          typeof copy.extra === "function"
            ? copy.extra(ctx)
            : (copy.extra ?? []);
        html = applyReplacements(html, extra);
      } catch (error) {
        throw new Error(`${label}, cópia ${name}: ${messageOf(error)}`);
      }
      assertClean(`cópia ${name}`, html, list, leftovers);
      writes.set(file, html);
    }
    for (const support of source.support ?? []) {
      const content = readFileSync(sddPath(dirname(source.file), support));
      assertClean(
        `apoio ${basename(support)}`,
        content.toString("utf8"),
        list,
        leftovers,
      );
      const file = join(outDir, basename(support));
      const previous = writes.get(file);
      if (Buffer.isBuffer(previous) && !previous.equals(content)) {
        throw new Error(
          `apoio ${basename(support)} diferente entre as fontes: use um out para cada`,
        );
      }
      writes.set(file, content);
    }
  }

  for (const [file, content] of writes) writeInsideSdd(file, content);
  return [...writes.keys()];
}

async function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter((name) => name !== "config");
  if (
    unknown.length > 0 ||
    positional.length > 0 ||
    typeof flags.config !== "string"
  ) {
    throw new Error(USAGE);
  }
  const files = await buildProtoCopies(flags.config);
  const copies = files
    .filter((file) => file.endsWith(".html"))
    .map((file) => basename(file, ".html"));
  console.log(
    `cópias: ${copies.length} (${copies.join(", ")}), sem sobra de nenhum termo da lista`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(`visual:proto: ${messageOf(error)}`);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 21: Rodar e ver passar**

Run: `bunx vitest run test/visual/proto.test.ts`
Expected: PASS, 11 testes.

- [ ] **Step 22: Implementar `scripts/visual/capture.mjs`**

Sem teste no Vitest (abre o Chromium); a conferência é a do Step 27. O `openState`/`closeState`/`commonHeight` juntam
o que o `pairs`, o `measure`, o `probe` e o `interact` fazem igual (abrir o estado, aplicar o patch, rodar os passos,
igualar a altura).

```js
// Captura do app (3202) e do protótipo (a cópia em .git/sdd) no mesmo tamanho (spec §5.3). Rodar com
// node: o Chromium do Playwright não abre pelo Bun no Windows. Login pela API (cada login sai de um
// IP próprio, por causa do rate limit do `next start`), tema no localStorage antes da página,
// indicador do `next dev` escondido, movimento reduzido (PB-D6) e espera das fontes e das animações.
// "Página inteira" é uma janela da altura do conteúdo, não o fullPage do Playwright: a moldura do
// protótipo é 100vh com o <main> rolando por dentro, e a sidebar (100svh) vai até o fim nos dois lados.
//   node scripts/visual/capture.mjs app <caminho> <LxA> <dark|light> <saída> [pessoa]
//   node scripts/visual/capture.mjs proto <arquivo> <LxA> <saída>
// (arquivo e saída relativos a .git/sdd; a altura final é a maior entre A e a do conteúdo)
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import { chromium } from "@playwright/test";

import {
  assertVisualBaseUrl,
  fakeClientIp,
  parseCliArgs,
  parseSizes,
  THEME_STORAGE_KEY,
  VISUAL_BASE_URL,
} from "./config.mjs";
import { assertInsideSdd, sddPath } from "./paths.mjs";
import { minHeight, protoFile } from "./screen.mjs";
import { runSteps } from "./steps.mjs";
import { VISUAL_PASSWORD, VISUAL_PEOPLE } from "./vocabulary.mjs";

/** @typedef {import("@playwright/test").Browser} Browser */
/** @typedef {import("@playwright/test").BrowserContext} BrowserContext */
/** @typedef {import("@playwright/test").Page} Page */
/** @typedef {import("./screen.mjs").PersonKey} PersonKey */
/** @typedef {import("./screen.mjs").ScreenConfig} ScreenConfig */
/** @typedef {import("./screen.mjs").StateConfig} StateConfig */
/** @typedef {import("./steps.mjs").StepLog} StepLog */
/** @typedef {{ context: BrowserContext, page: Page, height: number }} Opened */

/** O indicador do `next dev` (canto inferior) não existe em produção. */
export const HIDE_DEV_CSS = "nextjs-portal{display:none!important}";

const BASE = assertVisualBaseUrl(VISUAL_BASE_URL);
const LOAD_TIMEOUT_MS = 180_000;
const PROTO_TIMEOUT_MS = 120_000;
const ANIMATIONS_TIMEOUT_MS = 3_000;
const SETTLE_MS = 300;
const IP_SPACE = 65_024;
const USAGE =
  "uso: node scripts/visual/capture.mjs app <caminho> <LxA> <dark|light> <saída> [pessoa] | proto <arquivo> <LxA> <saída> (arquivo e saída relativos a .git/sdd)";

// Base aleatória: duas rodadas seguidas não repetem os IPs dentro da janela do rate limit.
let nextIp = Math.floor(Math.random() * 60_000);

/** @returns {Promise<Browser>} */
export async function launchBrowser() {
  return chromium.launch();
}

/**
 * Entra como a pessoa pela API do Better Auth; o cookie da sessão fica no contexto.
 * @param {BrowserContext} context
 * @param {PersonKey} person
 */
export async function loginAs(context, person) {
  if (!Object.hasOwn(VISUAL_PEOPLE, person)) {
    throw new Error(`pessoa desconhecida: ${String(person)}`);
  }
  const ip = fakeClientIp(nextIp % IP_SPACE);
  nextIp += 1;
  const response = await context.request.post(
    `${BASE}/api/auth/sign-in/email`,
    {
      data: { email: VISUAL_PEOPLE[person].email, password: VISUAL_PASSWORD },
      headers: { origin: BASE, "x-forwarded-for": ip },
      timeout: LOAD_TIMEOUT_MS,
    },
  );
  if (!response.ok()) {
    throw new Error(
      `login de ${person}: HTTP ${response.status()} (rodou o bun run visual:people?)`,
    );
  }
}

/**
 * @param {Browser} browser
 * @param {number} width
 * @param {"reduce" | "no-preference" | undefined} reducedMotion
 */
function newContext(browser, width, reducedMotion) {
  return browser.newContext({
    viewport: { width, height: minHeight(width) },
    deviceScaleFactor: 1,
    reducedMotion: reducedMotion ?? "reduce",
  });
}

/**
 * Espera as fontes, as animações pararem (até 3 s; uma infinita não trava) e mais 300 ms.
 * @param {Page} page
 */
export async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page
    .waitForFunction(
      () => document.getAnimations().every((a) => a.playState !== "running"),
      null,
      { timeout: ANIMATIONS_TIMEOUT_MS, polling: 100 },
    )
    .catch(() => {
      // Animação infinita (ou que não terminou em 3 s): a captura segue assim mesmo.
    });
  await page.waitForTimeout(SETTLE_MS);
}

/**
 * A altura do conteúdo: no app, a do documento; no protótipo, a do <main> que rola por dentro da
 * moldura de 100vh (no mínimo a janela).
 * @param {Page} page
 * @param {"app" | "proto"} kind
 * @returns {Promise<number>}
 */
export async function naturalHeight(page, kind) {
  return page.evaluate((side) => {
    if (side === "proto") {
      const main = document.querySelector("main");
      return Math.max(main ? main.scrollHeight : 0, window.innerHeight);
    }
    return document.documentElement.scrollHeight;
  }, kind);
}

/**
 * Abre o app logado, no tema, e espera o seletor `ready`.
 * @param {Browser} browser
 * @param {{ path: string, width: number, theme: "dark" | "light", person: PersonKey | null, ready: string, css?: string, reducedMotion?: "reduce" | "no-preference" }} opts
 * @returns {Promise<{ context: BrowserContext, page: Page, height: number }>}
 */
export async function openApp(browser, opts) {
  const { path, width, theme, person, ready, css = "", reducedMotion } = opts;
  if (!path.startsWith("/"))
    throw new Error(`caminho do app começa com /: ${path}`);
  const context = await newContext(browser, width, reducedMotion);
  try {
    if (person) await loginAs(context, person);
    await context.addInitScript(
      ({ key, value }) => {
        try {
          localStorage.setItem(key, value);
        } catch {
          // Storage bloqueado: a página fica no tema padrão (escuro).
        }
      },
      { key: THEME_STORAGE_KEY, value: theme },
    );
    const page = await context.newPage();
    await page.goto(new URL(path, BASE).href, {
      waitUntil: "load",
      timeout: LOAD_TIMEOUT_MS,
    });
    await page.addStyleTag({ content: HIDE_DEV_CSS + css });
    await page
      .locator(ready)
      .first()
      .waitFor({ state: "attached", timeout: LOAD_TIMEOUT_MS });
    await settle(page);
    return { context, page, height: await naturalHeight(page, "app") };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/**
 * Abre a cópia do protótipo (um arquivo dentro de .git/sdd).
 * @param {Browser} browser
 * @param {{ file: string, width: number, reducedMotion?: "reduce" | "no-preference" }} opts
 * @returns {Promise<{ context: BrowserContext, page: Page, height: number }>}
 */
export async function openProto(browser, opts) {
  const { file, width, reducedMotion } = opts;
  const target = assertInsideSdd(file);
  const context = await newContext(browser, width, reducedMotion);
  try {
    const page = await context.newPage();
    await page.goto(pathToFileURL(target).href, {
      waitUntil: "networkidle",
      timeout: PROTO_TIMEOUT_MS,
    });
    await page
      .locator("main")
      .first()
      .waitFor({ state: "attached", timeout: PROTO_TIMEOUT_MS });
    await settle(page);
    return { context, page, height: await naturalHeight(page, "proto") };
  } catch (error) {
    await context.close();
    throw error;
  }
}

/**
 * Abre o estado de uma tela: o app (logado, no tema, com o `css` do estado) e, se `out` vier e o
 * estado tiver cópia, o protótipo; copia o `patch` do app para o protótipo; com `viewportOnly`,
 * põe a janela na altura mínima; e roda os passos dos dois lados. Quem chama fecha com closeState.
 * @param {Browser} browser
 * @param {{ screen: ScreenConfig, state: StateConfig, path: string, width: number, out?: string }} opts
 * @returns {Promise<{ app: Opened, proto: Opened | null, logs: { app: StepLog, proto: StepLog | null } }>}
 */
export async function openState(browser, opts) {
  const { screen, state, path, width, out } = opts;
  const app = await openApp(browser, {
    path,
    width,
    theme: state.theme,
    person: state.person,
    ready: screen.ready ?? "body",
    css: state.css,
    reducedMotion: "reduce",
  });
  /** @type {Opened | null} */
  let proto = null;
  try {
    if (out !== undefined && state.proto) {
      proto = await openProto(browser, {
        file: protoFile(out, screen, state.proto),
        width,
        reducedMotion: "reduce",
      });
      if (screen.patch) {
        const value = await app.page.evaluate(screen.patch.read);
        await proto.page.evaluate(
          `(${screen.patch.write})(${JSON.stringify(value)})`,
        );
      }
    }
    if (state.viewportOnly) {
      const height = minHeight(width);
      await app.page.setViewportSize({ width, height });
      if (proto) await proto.page.setViewportSize({ width, height });
    }
    const appLog = await runSteps(app.page, state.steps?.app ?? []);
    const protoLog = proto
      ? await runSteps(proto.page, state.steps?.proto ?? [])
      : null;
    return { app, proto, logs: { app: appLog, proto: protoLog } };
  } catch (error) {
    await closeState({ app, proto });
    throw error;
  }
}

/**
 * Fecha o que o openState abriu.
 * @param {{ app: Opened, proto: Opened | null }} opened
 */
export async function closeState(opened) {
  await opened.app.context.close();
  if (opened.proto) await opened.proto.context.close();
}

/**
 * A altura comum da captura: com `viewportOnly`, a mínima; senão, a maior das alturas naturais
 * (depois dos passos), no mínimo a mínima.
 * @param {{ app: Opened, proto: Opened | null }} opened
 * @param {Pick<StateConfig, "viewportOnly">} state
 * @param {number} width
 * @returns {Promise<{ height: number, natural: { app: number, proto: number | null } }>}
 */
export async function commonHeight(opened, state, width) {
  const natural = {
    app: await naturalHeight(opened.app.page, "app"),
    proto: opened.proto
      ? await naturalHeight(opened.proto.page, "proto")
      : null,
  };
  const height = state.viewportOnly
    ? minHeight(width)
    : Math.max(natural.app, natural.proto ?? 0, minHeight(width));
  return { height, natural };
}

/**
 * Põe a janela no tamanho, espera assentar e grava o PNG (destino conferido por assertInsideSdd).
 * @param {Page} page
 * @param {{ width: number, height: number, out: string, clip?: { x: number, y: number, width: number, height: number } }} opts
 */
export async function shoot(page, opts) {
  const { width, height, out, clip } = opts;
  const target = assertInsideSdd(out);
  mkdirSync(dirname(target), { recursive: true });
  await page.setViewportSize({ width, height });
  await settle(page);
  await page.screenshot({ path: target, ...(clip ? { clip } : {}) });
}

/**
 * @param {string | undefined} value
 * @returns {{ width: number, height: number }}
 */
function parseSize(value) {
  const match = /^(\d+)x(\d+)$/.exec(value ?? "");
  if (!match)
    throw new Error(`tamanho no formato LxA: ${String(value)}\n${USAGE}`);
  const [width = 0] = parseSizes(match[1], []);
  const [height = 0] = parseSizes(match[2], []);
  return { width, height };
}

async function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  if (Object.keys(flags).length > 0) throw new Error(USAGE);
  const [kind, target, size, ...rest] = positional;
  const { width, height } = parseSize(size);
  if (kind === "app") {
    const [theme, out, person = "ana"] = rest;
    if (
      (theme !== "dark" && theme !== "light") ||
      !out ||
      !target ||
      rest.length > 3
    ) {
      throw new Error(USAGE);
    }
    if (!Object.hasOwn(VISUAL_PEOPLE, person))
      throw new Error(`pessoa desconhecida: ${person}`);
    const outFile = sddPath(out);
    const browser = await launchBrowser();
    try {
      const opened = await openApp(browser, {
        path: target,
        width,
        theme,
        person: /** @type {PersonKey} */ (person),
        ready: "body",
      });
      const finalHeight = Math.max(height, opened.height);
      await shoot(opened.page, { width, height: finalHeight, out: outFile });
      console.log(`gravado ${out} (${width}x${finalHeight})`);
    } finally {
      await browser.close();
    }
    return;
  }
  if (kind === "proto") {
    const [out] = rest;
    if (!out || !target || rest.length > 1) throw new Error(USAGE);
    const file = sddPath(target);
    const outFile = sddPath(out);
    const browser = await launchBrowser();
    try {
      const opened = await openProto(browser, { file, width });
      const finalHeight = Math.max(height, opened.height);
      await shoot(opened.page, { width, height: finalHeight, out: outFile });
      console.log(`gravado ${out} (${width}x${finalHeight})`);
    } finally {
      await browser.close();
    }
    return;
  }
  throw new Error(USAGE);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      `capture: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
```

- [ ] **Step 23: Implementar `scripts/visual/pairs.mjs`**

```js
// Os pares do pixel (spec §5.3 e §5.5): para cada estado, semeia o banco visual, abre o app e a cópia
// do protótipo na mesma largura, copia para o protótipo o que depende do relógio (patch), roda os
// passos dos dois lados, iguala a altura (a maior das duas, com o mínimo de 844/900), captura,
// mascara e mede a página inteira e cada região. Rodar com node; um navegador por estado.
//   node scripts/visual/pairs.mjs --screen=inicio --out=processo [estado …] [--sizes=1440,390] [--sufixo=-antes]
// Grava <out>/pares/<estado>-<largura><sufixo>-{proto,app,diff}.png, -<região>-{proto,app,diff}.png
// e mescla <out>/pares/results.json. --sizes vale para todos os estados escolhidos.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  closeState,
  commonHeight,
  launchBrowser,
  openState,
  shoot,
} from "./capture.mjs";
import { parseCliArgs, parseSizes } from "./config.mjs";
import { diffFiles, regionDiff, unionRect } from "./diff.mjs";
import { readPng, writePng } from "./image.mjs";
import { readJsonInsideSdd, sddPath, writeInsideSdd } from "./paths.mjs";
import {
  loadScreen,
  pickState,
  readState,
  resolvePath,
  runSeed,
} from "./screen.mjs";

/** @typedef {import("./screen.mjs").ScreenConfig} ScreenConfig */
/** @typedef {import("./screen.mjs").StateConfig} StateConfig */
/** @typedef {import("./image.mjs").Rect} Rect */
/** @typedef {import("@playwright/test").Page} Page */

const USAGE =
  "uso: node scripts/visual/pairs.mjs --screen=<nome> | --config=<relativo a .git/sdd> --out=<pasta em .git/sdd> [estado …] [--sizes=1440,390] [--sufixo=<texto>]";
const DEFAULT_SIZES = [1440, 390];
const KNOWN_FLAGS = ["screen", "config", "out", "sizes", "sufixo"];

/** @param {unknown} error */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Os retângulos que a expressão de máscara devolve na página, arredondados.
 * @param {Page} page
 * @param {string | undefined} expr
 * @returns {Promise<Rect[]>}
 */
async function rectsOf(page, expr) {
  if (!expr) return [];
  const rects = await page.evaluate(expr);
  if (!Array.isArray(rects)) {
    throw new Error(
      "masks: a expressão não devolveu uma lista de [x, y, w, h]",
    );
  }
  return rects.map(
    (rect) => /** @type {Rect} */ (rect.map((v) => Math.round(v))),
  );
}

/**
 * @param {Page} page
 * @param {string} expr
 * @returns {Promise<Rect | null>}
 */
async function regionOf(page, expr) {
  const rect = await page.evaluate(expr);
  if (!Array.isArray(rect) || rect.length !== 4) return null;
  return /** @type {Rect} */ (rect.map((v) => Math.round(v)));
}

/**
 * Um par: as duas capturas, a diferença da página e a de cada região.
 * @param {import("@playwright/test").Browser} browser
 * @param {{ screen: ScreenConfig, state: StateConfig, out: string, path: string, width: number, tag: string, pairsDir: string }} job
 */
async function measurePair(browser, job) {
  const { screen, state, out, path, width, tag, pairsDir } = job;
  const opened = await openState(browser, { screen, state, path, width, out });
  try {
    const { app, proto } = opened;
    if (!proto)
      throw new Error(`o estado não tem cópia do protótipo: ${state.proto}`);
    const { height, natural } = await commonHeight(opened, state, width);
    const files = {
      proto: join(pairsDir, `${tag}-proto.png`),
      app: join(pairsDir, `${tag}-app.png`),
      diff: join(pairsDir, `${tag}-diff.png`),
    };
    await shoot(app.page, { width, height, out: files.app });
    await shoot(proto.page, { width, height, out: files.proto });
    const masks = [
      ...(await rectsOf(app.page, screen.masks)),
      ...(await rectsOf(proto.page, screen.masks)),
    ];
    const page = diffFiles(files.proto, files.app, files.diff, masks);

    /** @type {Record<string, number | null>} */
    const regions = {};
    for (const [region, expr] of Object.entries(state.regions ?? {})) {
      const inApp = await regionOf(app.page, expr);
      const inProto = await regionOf(proto.page, expr);
      if (!inApp || !inProto) {
        regions[region] = null;
        console.log(`${tag}: a região ${region} não apareceu nos dois lados`);
        continue;
      }
      const result = regionDiff(
        readPng(files.proto),
        readPng(files.app),
        unionRect(inProto, inApp),
        masks,
      );
      writePng(join(pairsDir, `${tag}-${region}-proto.png`), result.crops.a);
      writePng(join(pairsDir, `${tag}-${region}-app.png`), result.crops.b);
      writePng(join(pairsDir, `${tag}-${region}-diff.png`), result.crops.diff);
      regions[region] = Number(result.pct.toFixed(3));
    }
    return {
      pct: Number(page.pct.toFixed(3)),
      size: `${width}x${height}`,
      natural,
      masks,
      regions,
      failed: opened.logs.app.failed,
      at: new Date().toISOString(),
    };
  } finally {
    await closeState(opened);
  }
}

async function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter(
    (name) => !KNOWN_FLAGS.includes(name),
  );
  if (unknown.length > 0)
    throw new Error(`argumento desconhecido: --${unknown[0]}\n${USAGE}`);
  if (typeof flags.out !== "string" || flags.out === "")
    throw new Error(`falta --out\n${USAGE}`);
  const out = flags.out;
  const pairsDir = sddPath(out, "pares");
  const screen = await loadScreen({
    screen: /** @type {string | undefined} */ (flags.screen),
    config: /** @type {string | undefined} */ (flags.config),
  });
  const sizes =
    flags.sizes === undefined
      ? null
      : parseSizes(String(flags.sizes), DEFAULT_SIZES);
  if (flags.sufixo === true || !/^[a-z0-9-]*$/.test(flags.sufixo ?? "")) {
    throw new Error(
      "--sufixo: letras minúsculas, números e hífen (ex.: --sufixo=-antes)",
    );
  }
  const suffix = typeof flags.sufixo === "string" ? flags.sufixo : "";
  const names = positional.length > 0 ? positional : Object.keys(screen.states);
  for (const name of names) pickState(screen, name);

  const resultsFile = join(pairsDir, "results.json");
  /** @type {Record<string, unknown>} */
  const results = existsSync(resultsFile)
    ? /** @type {Record<string, unknown>} */ (readJsonInsideSdd(resultsFile))
    : {};
  let failures = 0;
  let seeded = "";
  for (const name of names) {
    const state = pickState(screen, name);
    if (state.proto === null) {
      console.log(
        `${name}: pulado (sem protótipo; use interact.mjs ou probe.mjs --app-only)`,
      );
      continue;
    }
    const seedKey = `${state.seed}|${state.sector ?? ""}`;
    if (seeded !== seedKey) {
      runSeed(state);
      seeded = seedKey;
    }
    const path = resolvePath(state.path, readState());
    const browser = await launchBrowser();
    try {
      for (const width of sizes ?? state.sizes ?? DEFAULT_SIZES) {
        const tag = `${name}-${width}${suffix}`;
        try {
          const result = await measurePair(browser, {
            screen,
            state,
            out,
            path,
            width,
            tag,
            pairsDir,
          });
          results[tag] = result;
          const regions = Object.entries(result.regions)
            .map(
              ([region, pct]) =>
                `  ${region} ${pct === null ? "-" : `${pct.toFixed(3)}%`}`,
            )
            .join("");
          console.log(
            `${tag}: ${result.pct.toFixed(3)}%${regions}  (${result.size}; app ${result.natural.app}px, proto ${result.natural.proto}px)`,
          );
        } catch (error) {
          failures += 1;
          console.log(`${tag}: ERRO ${messageOf(error)}`);
        }
      }
    } finally {
      await browser.close();
    }
    writeInsideSdd(resultsFile, `${JSON.stringify(results, null, 1)}\n`);
  }
  if (failures > 0) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(`visual:pairs: ${messageOf(error)}`);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 24: Atalhos no `package.json`**

Edit em `package.json`. O `old_string` é o que a Task 6 (Step 19) deixou logo depois da linha da Task 5:

```json
    "visual:people": "node scripts/visual/people.mjs",
    "visual:names": "node scripts/visual/check-names.mjs",
```

`new_string`:

```json
    "visual:people": "node scripts/visual/people.mjs",
    "visual:proto": "node scripts/visual/proto.mjs",
    "visual:pairs": "node scripts/visual/pairs.mjs",
    "visual:names": "node scripts/visual/check-names.mjs",
```

Depois desta tarefa, o fim de `scripts` é:

```json
    "smoke": "bun scripts/smoke.mjs",
    "visual:db": "bun scripts/visual/db.ts",
    "visual:seed": "bun scripts/visual/seed/index.ts",
    "visual:people": "node scripts/visual/people.mjs",
    "visual:proto": "node scripts/visual/proto.mjs",
    "visual:pairs": "node scripts/visual/pairs.mjs",
    "visual:names": "node scripts/visual/check-names.mjs",
    "visual:hooks": "node scripts/visual/install-hooks.mjs"
  },
```

Conferir: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` não lança.

- [ ] **Step 25: Formatar, tipos, lint e os testes tocados**

Run: `bunx biome check --write scripts/visual test/visual package.json`
Expected: termina sem erro.
Run: `bun run check-types`
Expected: sai com 0. (O `steps.test.ts` passa a página falsa como `Page` por `as unknown as Page`; o typedef `Step`
aceita os campos de cada kind.)
Run: `bun run lint`
Expected: sai com 0.
Run: `bunx vitest run test/visual`
Expected: PASS, todos os arquivos de `test/visual/` (os da T4, T5, T6 e desta), nenhum vermelho.

- [ ] **Step 26: Os CLIs recusam destino fora de `.git/sdd` (sem navegador)**

Run: `node scripts/visual/pairs.mjs --screen=inicio --out=../../fora; echo "código $?"`
Expected: `visual:pairs: fora de <…>/.git/sdd: ../../fora/pares` e `código 1`; nada criado fora (`git status` limpo).
Run: `node scripts/visual/diff.mjs a.png b.png; echo "código $?"`
Expected: `diff: uso: …` e `código 1`.
Run: `node scripts/visual/proto.mjs; echo "código $?"`
Expected: `visual:proto: uso: node scripts/visual/proto.mjs --config=<caminho relativo a .git/sdd>` e `código 1`.

- [ ] **Step 27: Conferência manual pelo controlador no C1 (não rodar na redação nem na tarefa)**

No C1, o `visual:proto` e o `visual:pairs` completos são os Steps 3 e 4 dele; a captura avulsa, a recusa, o `menu
--sufixo=-x` e o `diff.mjs` rodam no Step 8 do C1. Com o ambiente da Task 5 de pé (banco 54332, `next start -p 3202`,
`visual:seed base`, `visual:people`, `visual:seed avatars`) e a lista `.git/sdd/nomes-proibidos.txt` gravada (C0):

```sh
bun run visual:seed state inicio:admin
node scripts/visual/capture.mjs app "/?setor=<id do ULD em .git/sdd/visual-db/state.json>" 1440x900 dark processo/avulsas/inicio.png
# Expected: "gravado processo/avulsas/inicio.png (1440xH)", H a altura do conteúdo (1199 no PR A)
node scripts/visual/capture.mjs app / 1440x900 dark ../../fora.png
# Expected: "capture: fora de …: ../../fora.png", código 1
bun run visual:proto --config=processo/proto.config.mjs
# Expected: "cópias: 10 (proto-admin-escuro, …, proto-confirmada-claro-operacoes), sem sobra de nenhum termo da lista"
bun run visual:pairs --screen=inicio --out=processo
# Expected: 19 linhas "<estado>-<largura>: N.NNN%  …(LxA; app Hpx, proto Hpx)", as 6 do pack com "cartao N.NNN%",
# app e proto com a mesma altura; .git/sdd/processo/pares/results.json com as 19 entradas; código 0
bun run visual:pairs --screen=inicio --out=processo menu --sufixo=-x
# Expected: só "menu-390-x: …" (só a janela: 390x844)
node scripts/visual/diff.mjs processo/pares/admin-escuro-1440-proto.png processo/pares/admin-escuro-1440-app.png processo/pares/conferencia-diff.png
# Expected: "N.NNN% (… px de 1440xH; 1440xH vs 1440xH)"
```

Os números de cada par vão para o `.git/sdd/processo/pixel.md` (C1), contra a tabela da spec §15.2.

- [ ] **Step 28: Commit**

Mensagem gravada com Write em `.git/sdd/processo/msg-task-7.txt`:

```text
chore(visual): captura, diferença, cópias do protótipo, passos e pares

steps.mjs (roteiro de interação com falha de rede injetada), image.mjs e
diff.mjs (pixelmatch 0.1, recorte, máscaras, regiões), screen.mjs
(configuração de tela validada), proto.mjs (motor das cópias: erro pelo
número da troca, sobra procurada na lista de nomes), capture.mjs (movimento
reduzido e espera das animações) e pairs.mjs. screens/inicio.mjs com os
11 estados do Início. Atalhos visual:proto e visual:pairs.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run: `git add package.json scripts/visual/steps.mjs scripts/visual/image.mjs scripts/visual/diff.mjs scripts/visual/screen.mjs scripts/visual/screens/inicio.mjs scripts/visual/proto.mjs scripts/visual/capture.mjs scripts/visual/pairs.mjs test/visual/steps.test.ts test/visual/image.test.ts test/visual/diff.test.ts test/visual/screen.test.ts test/visual/screens.test.ts test/visual/proto.test.ts && git commit -F .git/sdd/processo/msg-task-7.txt`
Expected: o `pre-commit` (instalado depois da Task 6) passa; um commit com 15 arquivos; `git status` limpo.

---

### Task 8: Medida, sonda, interação, auditoria e recortes

**Spec:** §5.3, §5.5, §6 · **Redator:** R2 · **Depende de:** T7

**Files:**
- Create: `scripts/visual/contrast.mjs`
- Create: `scripts/visual/screens/legibilidade.mjs`
- Create: `scripts/visual/screens/provas.mjs`
- Create: `scripts/visual/measure.mjs` (CLI)
- Create: `scripts/visual/probe.mjs` (CLI)
- Create: `scripts/visual/interact.mjs` (CLI)
- Create: `scripts/visual/audit.mjs` (CLI)
- Create: `scripts/visual/sheet.mjs` (CLI)
- Create: `scripts/visual/sbs.mjs` (CLI)
- Create: `scripts/visual/crop.mjs` (CLI)
- Modify: `package.json` (`scripts`: `visual:audit`)
- Modify: `test/visual/screens.test.ts` (valida também `legibilidade` e `provas`)
- Test: `test/visual/contrast.test.ts`

**Interfaces:**
- Consumes (T4): `parseCliArgs`, `parseSizes`, `assertVisualBaseUrl`, `assertVisualDbUrl`, `VISUAL_BASE_URL`,
  `VISUAL_DB_URL`, `THEME_STORAGE_KEY`; `sddPath`, `assertInsideSdd`, `writeInsideSdd`, `readJsonInsideSdd`.
  (T5): `STATES` (só o teste). (T7): `HIDE_DEV_CSS`, `launchBrowser`, `loginAs`, `settle`, `openProto`, `openState`,
  `closeState`, `commonHeight`, `shoot` (`capture.mjs`); `loadScreen`, `pickState`, `resolvePath`, `readState`,
  `protoFile`, `runSeed`, `validateScreen` e os typedefs `ScreenConfig`/`AuditScreen` (`screen.mjs`); `runSteps`
  (`steps.mjs`); `contactSheet`, `stackRegion`, `cropRect`, `parseRect`, `readPng`, `writePng` (`image.mjs`).
- Produces (nomes do contrato):
  - `contrast.mjs`: `parseColor(css): [r, g, b, a] | null`, `over(top, bottom)`, `luminance(rgb)`, `contrastRatio(a, b)`,
    `requiredRatio(fontSizePx, fontWeight): 3 | 4.5`, `auditScript(): string` (o script da página, montado com
    `String(fn)` das mesmas funções e da auditoria, sem closure).
  - CLIs (todos com `--screen=<nome> | --config=<relativo>` onde há tela): `measure.mjs --state= --width= --out=
    [--root=<css>] [--all] [--so-proto]` · `probe.mjs --state= --width= [--out=] [--app-only] "<expressão>"` (imprime
    `PROTO <json>` e `APP <json>`) · `interact.mjs --state= --out= [--width=1440]` (grava
    `<out>/interacoes/<estado>-<largura>-{app,proto}.png` e `<estado>-<largura>.json`; código 1 se o
    `expect.failedRequests` não foi atingido) · `audit.mjs --out= [--only=a,b] [--themes=dark,light]
    [--sizes=1440x900,390x844] [--dir=legibilidade]` · `sheet.mjs <prefixo> --dir= [--scale=0.5] [--max=1800]
    [--widths=1440,820,390]` · `sbs.mjs <tag> <x> <y> <w> <h> [zoom] --dir=` · `crop.mjs <arquivo> <x> <y> <w> <h> [saída]
    --dir=`. Todo `--dir`/`--out` é relativo a `.git/sdd` e recusado fora dele.
  - `screens/legibilidade.mjs`: `audit` com as 27 telas (spec §5.5); `{setor}` vem do `state.json`, `{pendente}`,
    `{corrigida}` e `{solicitacao}` de consultas ao banco visual (`pg`, URL conferida por `assertVisualDbUrl`).
  - `screens/provas.mjs`: `falha-de-rede` e os três hovers (spec §13.4 e §13.5), todos com `proto: null`.
  - `package.json`: `visual:audit`.

Notas de porte: `screens.mjs` antigo → `audit.mjs` (a lista de telas sai para `screens/legibilidade.mjs`; o script de
auditoria vira `contrast.mjs`, com as mesmas regras: contraste composto sobre o fundo real, alvo de 44px abaixo de 860px
com a exceção do link dentro de frase, rolagem, borda e preenchimento de campo, fundo igual ao do pai); `measure.mjs` +
o `--medir` do `run-correcoes.mjs` → `measure.mjs` (a coleta do antigo, mais fundo, raio, padding, rotação e gap, e o
`--root`); `probe.mjs`, `interact.mjs`, `sheet.mjs`, `sbs.mjs` e `crop.mjs` viram genéricos sobre a configuração e o
`image.mjs`. O `probe.mjs` ganha `--out` (as cópias do protótipo ficam em `<out>/proto/`), dispensado com `--app-only`.
O `measure`, o `probe` e o `interact` semeiam o estado antes de abrir o app (como o `pairs`); o `--so-proto` não semeia.

Alvos das provas, escolhidos lendo as telas (spec §5.5 manda o redator escolher):
- **outline dentro de cartão:** o "Editar" do `EditDialog` (`Button variant="outline" size="sm"`, `aria-label="Editar
  <nome>"`) numa linha de `/admin/destinos`, que é um `AdminListRow` (`bg-card`): o alvo é o botão "Editar Doca Norte"
  (destino do vocabulário).
- **ghost dentro de cartão:** o ↗ "Abrir página completa de …" (`buttonVariants({ variant: "ghost", size: "icon-sm" })`)
  do `RequestCard` (`bg-card`) no Quadro de `/solicitacoes`: alvo por CSS, pelo começo do `aria-label`, sem depender da
  descrição.
- **StatLink:** o "Abertas agora" do Dashboard (`StatLink`, `bg-card` com `hover:bg-muted` hoje).
- **falha de rede:** o "Agora não" do `InviteTeamCard` (um `<form action={dismissInviteCardAction}>`: a Server Action vai
  num `POST` com o cabeçalho `next-action`), no estado `inicio:primeiro`. O `ready` da tela é `main h1` (o Início, o
  Dashboard, `/admin/destinos` e `/solicitacoes` têm um `h1` no `main`).

- [ ] **Step 1: Escrever o teste do contraste**

`test/visual/contrast.test.ts`:

```ts
import { runInNewContext, Script } from "node:vm";
import { describe, expect, it } from "vitest";

import {
  auditScript,
  contrastRatio,
  luminance,
  over,
  parseColor,
  requiredRatio,
} from "../../scripts/visual/contrast.mjs";

// As contas da auditoria de legibilidade (spec §5.3): as mesmas funções rodam no Vitest e,
// montadas pelo auditScript(), dentro da página.

describe("parseColor", () => {
  it("lê rgb, rgba, a sintaxe com espaço e barra, e transparent", () => {
    expect(parseColor("rgb(1, 2, 3)")).toEqual([1, 2, 3, 1]);
    expect(parseColor("rgba(255, 0, 255, 0.5)")).toEqual([255, 0, 255, 0.5]);
    expect(parseColor("rgb(10 20 30 / 0.25)")).toEqual([10, 20, 30, 0.25]);
    expect(parseColor("rgb(10 20 30 / 50%)")).toEqual([10, 20, 30, 0.5]);
    expect(parseColor(" RGB(0, 0, 0) ")).toEqual([0, 0, 0, 1]);
    expect(parseColor("transparent")).toEqual([0, 0, 0, 0]);
  });

  it("o que não é sRGB, fora da faixa ou lixo vira null", () => {
    expect(parseColor("oklch(0.5 0.1 200)")).toBeNull();
    expect(parseColor("#ffffff")).toBeNull();
    expect(parseColor("rgb(256, 0, 0)")).toBeNull();
    expect(parseColor("rgba(0, 0, 0, 2)")).toBeNull();
    expect(parseColor("rgb(1, 2)")).toBeNull();
    expect(parseColor("rgb(a, b, c)")).toBeNull();
    expect(parseColor("")).toBeNull();
    expect(parseColor(undefined)).toBeNull();
  });
});

describe("over", () => {
  it("opaco fica como está; transparente mostra o de baixo; metade mistura", () => {
    expect(over([10, 20, 30, 1], [200, 200, 200, 1])).toEqual([10, 20, 30, 1]);
    expect(over([10, 20, 30, 0], [200, 200, 200, 1])).toEqual([
      200, 200, 200, 1,
    ]);
    expect(over([0, 0, 0, 0.5], [255, 255, 255, 1])).toEqual([
      127.5, 127.5, 127.5, 1,
    ]);
  });
});

describe("luminance e contrastRatio", () => {
  it("preto é 0, branco é 1", () => {
    expect(luminance([0, 0, 0])).toBe(0);
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 10);
  });

  it("razões conhecidas: 21 no máximo, 1 com a mesma cor, simétrica", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrastRatio([119, 119, 119], [119, 119, 119])).toBe(1);
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5);
    // #777 sobre branco: 4,48 (o caso clássico que reprova no AA por pouco).
    expect(contrastRatio([119, 119, 119], [255, 255, 255])).toBeCloseTo(
      4.48,
      2,
    );
  });
});

describe("requiredRatio", () => {
  it("4,5 para texto normal; 3 para grande (24px, ou 18,66px em negrito)", () => {
    expect(requiredRatio(16, 400)).toBe(4.5);
    expect(requiredRatio(23.9, 900)).toBe(3);
    expect(requiredRatio(24, 400)).toBe(3);
    expect(requiredRatio(18.66, 700)).toBe(3);
    expect(requiredRatio(18.66, 600)).toBe(4.5);
    expect(requiredRatio(18, 700)).toBe(4.5);
    expect(requiredRatio(0, 0)).toBe(4.5);
  });
});

describe("auditScript", () => {
  it("é uma expressão que compila, com as seis funções dentro", () => {
    const script = auditScript();
    expect(() => new Script(script)).not.toThrow();
    for (const name of [
      "parseColor",
      "over",
      "luminance",
      "contrastRatio",
      "requiredRatio",
      "auditPage",
    ]) {
      expect(script).toContain(`function ${name}(`);
    }
  });

  it("as funções de cor não dependem de nada de fora (rodam sozinhas, num contexto vazio)", () => {
    const source = `${String(parseColor)}\n${String(over)}\n${String(luminance)}\n${String(contrastRatio)}\n${String(requiredRatio)}\n[parseColor("rgba(0, 0, 0, 0.5)"), contrastRatio([0, 0, 0], [255, 255, 255]), requiredRatio(24, 400)]`;
    const [color, ratio, need] = runInNewContext(source, {}) as [
      number[],
      number,
      number,
    ];
    expect([...color]).toEqual([0, 0, 0, 0.5]);
    expect(ratio).toBeCloseTo(21, 5);
    expect(need).toBe(3);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bunx vitest run test/visual/contrast.test.ts`
Expected: FAIL — o arquivo não carrega: o import `../../scripts/visual/contrast.mjs` não existe.

- [ ] **Step 3: Implementar `scripts/visual/contrast.mjs`**

```js
// Contraste e auditoria de legibilidade (spec §5.3). As cinco funções de cor são puras e sem
// closure: o auditScript() monta o script da página com String(fn) delas mesmas, então a página e o
// teste calculam com o mesmo código. A conta é a do WCAG 2.x (a mesma do themeContrast.test.ts).

/** @typedef {[number, number, number, number]} Rgba — r, g, b de 0 a 255; alfa de 0 a 1 */

/**
 * Cor computada do navegador ("rgb(…)", "rgba(…)", "rgb(r g b / a)", "transparent") em [r, g, b, a];
 * o que não for sRGB (oklch, lab, lixo) vira null.
 * @param {unknown} css
 * @returns {Rgba | null}
 */
export function parseColor(css) {
  if (typeof css !== "string") return null;
  const value = css.trim().toLowerCase();
  if (value === "transparent") return [0, 0, 0, 0];
  const match = /^rgba?\(([^)]+)\)$/.exec(value);
  if (!match) return null;
  const parts = match[1].split(/[\s,/]+/).filter(Boolean);
  if (parts.length < 3 || parts.length > 4) return null;
  const numbers = parts.map((part, index) =>
    index === 3 && part.endsWith("%")
      ? Number(part.slice(0, -1)) / 100
      : Number(part),
  );
  if (numbers.some((n) => !Number.isFinite(n))) return null;
  const [r, g, b, a = 1] = numbers;
  if ([r, g, b].some((c) => c < 0 || c > 255) || a < 0 || a > 1) return null;
  return [r, g, b, a];
}

/**
 * Compõe a cor de cima (com alfa) sobre a de baixo (opaca).
 * @param {Rgba} top
 * @param {Rgba} bottom
 * @returns {Rgba}
 */
export function over(top, bottom) {
  const a = top[3];
  return [
    top[0] * a + bottom[0] * (1 - a),
    top[1] * a + bottom[1] * (1 - a),
    top[2] * a + bottom[2] * (1 - a),
    1,
  ];
}

/**
 * Luminância relativa (WCAG 2.x), de 0 (preto) a 1 (branco).
 * @param {readonly number[]} rgb
 * @returns {number}
 */
export function luminance(rgb) {
  const channel = (value) => {
    const v = value / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(rgb[0]) +
    0.7152 * channel(rgb[1]) +
    0.0722 * channel(rgb[2])
  );
}

/**
 * Razão de contraste entre duas cores opacas, de 1 a 21.
 * @param {readonly number[]} a
 * @param {readonly number[]} b
 * @returns {number}
 */
export function contrastRatio(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/**
 * O mínimo do WCAG AA: 3 para texto grande (24px, ou 18,66px em negrito), 4,5 para o resto.
 * @param {number} fontSizePx
 * @param {number} fontWeight
 * @returns {3 | 4.5}
 */
export function requiredRatio(fontSizePx, fontWeight) {
  return fontSizePx >= 24 || (fontWeight >= 700 && fontSizePx >= 18.66)
    ? 3
    : 4.5;
}

// Roda na página (dentro do auditScript): contraste de texto, alvo de toque abaixo de 860px,
// rolagem horizontal, borda e preenchimento de campo e fundo que some no do pai. Usa só as funções
// acima e o DOM.
function auditPage() {
  const backgroundOf = (element) => {
    const chain = [];
    for (let e = element; e; e = e.parentElement) {
      const style = getComputedStyle(e);
      const image = style.backgroundImage;
      if (image && image !== "none" && !image.startsWith("linear-gradient"))
        return null;
      const color = parseColor(style.backgroundColor);
      if (color && color[3] > 0) {
        chain.push(color);
        if (color[3] >= 1) break;
      }
    }
    let base = [255, 255, 255, 1];
    if (chain.length > 0 && chain[chain.length - 1][3] >= 1) {
      base = chain.pop();
    } else {
      const body = parseColor(getComputedStyle(document.body).backgroundColor);
      if (body) base = body;
    }
    for (let i = chain.length - 1; i >= 0; i--) base = over(chain[i], base);
    return base;
  };
  const visible = (element) => {
    const box = element.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return false;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") return false;
    return !element.closest(
      "[aria-hidden=true],.sr-only,[hidden],nextjs-portal",
    );
  };
  const dimmed = (element) => {
    for (let e = element; e; e = e.parentElement) {
      if (Number(getComputedStyle(e).opacity) < 1) return true;
    }
    return false;
  };
  const label = (element) => {
    const slot = element.getAttribute("data-slot");
    return element.tagName.toLowerCase() + (slot ? `[${slot}]` : "");
  };
  const rgb = (color) => `rgb(${color.slice(0, 3).map(Math.round).join(",")})`;
  const round = (value) => Math.round(value * 100) / 100;

  const out = {
    contrast: [],
    targets: [],
    overflow: null,
    inputs: [],
    sameBg: [],
  };
  const viewport = window.innerWidth;
  if (document.documentElement.scrollWidth > viewport + 1) {
    out.overflow = document.documentElement.scrollWidth;
  }
  for (const element of document.querySelectorAll("body *")) {
    if (!visible(element)) continue;
    const style = getComputedStyle(element);

    const own = [...element.childNodes]
      .filter((node) => node.nodeType === 3 && node.textContent.trim())
      .map((node) => node.textContent.trim())
      .join(" ");
    const isField =
      element.tagName === "INPUT" || element.tagName === "TEXTAREA";
    const placeholder =
      isField && element.placeholder && !element.value
        ? element.placeholder
        : "";
    if ((own || placeholder) && !element.disabled && !dimmed(element)) {
      const background = backgroundOf(element);
      const raw = parseColor(
        placeholder
          ? getComputedStyle(element, "::placeholder").color
          : style.color,
      );
      if (background && raw) {
        const ratio = contrastRatio(over(raw, background), background);
        const need = requiredRatio(
          parseFloat(style.fontSize),
          Number(style.fontWeight),
        );
        if (ratio < need) {
          out.contrast.push({
            text: (placeholder ? `[placeholder] ${placeholder}` : own).slice(
              0,
              60,
            ),
            el: label(element),
            ratio: round(ratio),
            need,
            fg: style.color,
            bg: rgb(background),
          });
        }
      }
    }

    const interactive = element.matches(
      "a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=radio],[role=checkbox],[role=switch],[role=tab],[role=combobox],summary",
    );
    if (interactive && viewport < 860 && !element.disabled) {
      const box = element.getBoundingClientRect();
      if (box.height < 44 || box.width < 44) {
        // Link dentro de uma frase é exceção do WCAG 2.5.8: marcado como "inline".
        const parentText = element.parentElement
          ? element.parentElement.textContent.trim()
          : "";
        const inline =
          element.tagName === "A" &&
          style.display === "inline" &&
          parentText.length > element.textContent.trim().length + 10;
        out.targets.push({
          el: label(element),
          text: (
            element.getAttribute("aria-label") ||
            element.textContent ||
            element.getAttribute("type") ||
            ""
          )
            .trim()
            .slice(0, 40),
          w: Math.round(box.width),
          h: Math.round(box.height),
          inline,
        });
      }
    }

    if (
      element.matches(
        "input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea,[data-slot=select-trigger],[data-slot=input-group]",
      )
    ) {
      const parentBackground = element.parentElement
        ? backgroundOf(element.parentElement)
        : null;
      const ownBackground = backgroundOf(element);
      const borderColor = parseColor(style.borderTopColor);
      if (parentBackground && ownBackground && borderColor) {
        const borderWidth = parseFloat(style.borderTopWidth);
        const border =
          borderWidth > 0
            ? contrastRatio(
                over(borderColor, parentBackground),
                parentBackground,
              )
            : 1;
        out.inputs.push({
          el: label(element),
          name:
            element.name ||
            element.id ||
            element.getAttribute("aria-label") ||
            "",
          border: round(border),
          fill: round(contrastRatio(ownBackground, parentBackground)),
        });
      }
    }

    // Fundo próprio igual ao do pai (o bloco some), com área relevante e sem borda nem sombra.
    const color = parseColor(style.backgroundColor);
    if (color && color[3] > 0 && element.parentElement) {
      const box = element.getBoundingClientRect();
      if (
        box.width * box.height > 1200 &&
        parseFloat(style.borderTopWidth) === 0 &&
        style.boxShadow === "none"
      ) {
        const parentBackground = backgroundOf(element.parentElement);
        const ownBackground = backgroundOf(element);
        if (
          parentBackground &&
          ownBackground &&
          contrastRatio(parentBackground, ownBackground) < 1.03 &&
          style.backgroundColor !==
            getComputedStyle(element.parentElement).backgroundColor
        ) {
          const classes =
            typeof element.className === "string" ? element.className : "";
          out.sameBg.push({
            el: label(element),
            cls: classes
              .split(" ")
              .filter((name) => /^(bg-|hover:bg|rounded)/.test(name))
              .join(" ")
              .slice(0, 80),
            text: element.textContent.trim().slice(0, 40),
            w: Math.round(box.width),
            h: Math.round(box.height),
          });
        }
      }
    }
  }
  return out;
}

/**
 * O script da auditoria para o `page.evaluate`: as funções de cor e a auditoria, montadas com
 * String(fn), numa expressão que devolve o resultado.
 * @returns {string}
 */
export function auditScript() {
  const parts = [
    parseColor,
    over,
    luminance,
    contrastRatio,
    requiredRatio,
    auditPage,
  ].map(String);
  return `(() => {\n${parts.join("\n")}\nreturn auditPage();\n})()`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `bunx vitest run test/visual/contrast.test.ts`
Expected: PASS, 8 testes.

- [ ] **Step 5: `screens.test.ts` valida também a legibilidade e as provas**

Edit 1 em `test/visual/screens.test.ts`: `old_string` = `import inicio from "../../scripts/visual/screens/inicio.mjs";`;
`new_string`:

```ts
import inicio from "../../scripts/visual/screens/inicio.mjs";
import legibilidade from "../../scripts/visual/screens/legibilidade.mjs";
import provas from "../../scripts/visual/screens/provas.mjs";
```

Edit 2: acrescentar ao fim do arquivo, depois do `describe("screens/inicio.mjs", …)`. `old_string` = as três últimas
linhas do arquivo (únicas: o fim do caso "patch, máscaras e região…"):

```ts
    ).toBe(true);
  });
});
```

`new_string` = as mesmas três linhas, uma linha em branco e o bloco:

```ts
describe("screens/legibilidade.mjs", () => {
  const audit = legibilidade.audit ?? [];

  it("é válida e só tem audit (nenhum par)", () => {
    expect(validateScreen(legibilidade)).toEqual([]);
    expect(Object.keys(legibilidade.states)).toEqual([]);
  });

  it("tem as 27 telas do passe do PR A, sem repetir", () => {
    expect(audit).toHaveLength(27);
    expect(new Set(audit.map((entry) => entry.name)).size).toBe(27);
  });

  it("as quatro de fora do (app) vão sem sessão; o resto, com a Ana ou a Carla", () => {
    expect(
      audit.filter((entry) => entry.person === null).map((entry) => entry.name),
    ).toEqual(["entrar", "convite-invalido", "redefinir-senha", "privacidade"]);
    for (const entry of audit) {
      expect([null, "ana", "carla"]).toContain(entry.person);
    }
  });

  it("820 onde há tabela ou lista", () => {
    expect(
      audit
        .filter((entry) => entry.extraWidths?.includes(820))
        .map((entry) => entry.name),
    ).toEqual([
      "passagens",
      "passagens-operador",
      "nova-passagem",
      "solicitacoes-quadro",
      "solicitacoes-lista",
      "solicitacoes-tabela",
      "solicitacoes-operador",
      "dashboard",
      "admin-setores",
      "admin-turnos",
      "admin-itens",
      "admin-destinos",
      "admin-equipe",
    ]);
  });

  it("só usa os marcadores que o audit.mjs resolve", () => {
    const used = new Set(
      audit.flatMap((entry) =>
        [...entry.path.matchAll(/\{([a-z]+)\}/g)].map((m) => m[1]),
      ),
    );
    expect([...used].sort()).toEqual([
      "corrigida",
      "pendente",
      "setor",
      "solicitacao",
    ]);
  });

  it("o Sheet do detalhe é só a janela, aberto pelos passos", () => {
    const sheet = audit.find((entry) => entry.name === "solicitacao-sheet");
    expect(sheet?.viewportOnly).toBe(true);
    expect(sheet?.steps?.map((step) => step.kind)).toEqual([
      "click",
      "waitFor",
    ]);
  });
});

describe("screens/provas.mjs", () => {
  const states = Object.entries(provas.states);

  it("é válida", () => {
    expect(validateScreen(provas)).toEqual([]);
  });

  it("os quatro estados da prova, todos só do app e com semente existente", () => {
    expect(Object.keys(provas.states)).toEqual([
      "falha-de-rede",
      "hover-outline-em-cartao",
      "hover-ghost-em-cartao",
      "hover-statlink",
    ]);
    for (const [name, state] of states) {
      expect(state.proto, name).toBeNull();
      expect(Object.keys(STATES), name).toContain(state.seed);
    }
  });

  it("a falha de rede aborta uma Server Action do 'Agora não' e exige o registro dela", () => {
    const state = provas.states["falha-de-rede"];
    expect(state).toMatchObject({
      seed: "inicio:primeiro",
      person: "ana",
      theme: "dark",
      path: "/",
    });
    expect(state?.steps?.app).toEqual([
      {
        kind: "failRequests",
        match: { method: "POST", header: "next-action" },
        times: 1,
      },
      { kind: "click", target: { role: "button", name: "Agora não" } },
      { kind: "wait", ms: 1500 },
    ]);
    expect(state?.expect).toEqual({ failedRequests: 1 });
  });

  it("os três hovers passam o mouse num alvo e esperam, no estado rico", () => {
    for (const name of [
      "hover-outline-em-cartao",
      "hover-ghost-em-cartao",
      "hover-statlink",
    ]) {
      const state = provas.states[name];
      expect(state?.seed, name).toBe("geral:rico");
      expect(
        state?.steps?.app?.map((step) => step.kind),
        name,
      ).toEqual(["hover", "wait"]);
    }
    // No claro o hover do outline e do ghost é bg-accent opaco: a sonda distingue o antes do depois.
    expect(provas.states["hover-outline-em-cartao"]?.theme).toBe("light");
    expect(provas.states["hover-ghost-em-cartao"]?.theme).toBe("light");
  });
});
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `bunx vitest run test/visual/screens.test.ts`
Expected: FAIL — o arquivo não carrega: os imports `../../scripts/visual/screens/legibilidade.mjs` e
`../../scripts/visual/screens/provas.mjs` não existem.

- [ ] **Step 7: Implementar `scripts/visual/screens/legibilidade.mjs`**

```js
// As 27 telas do passe de legibilidade do PR A (spec §5.5), para o audit.mjs. Semeie antes o estado
// rico (bun run visual:seed state geral:rico): {setor} vem do state.json; {pendente}, {corrigida} e
// {solicitacao} saem de consultas ao banco visual. Larguras extras de 820 onde há tabela ou lista.
// Sem nome de pessoa: quem vê é a Ana (admin) ou a Carla (operadora), e null é sem sessão.

const SETOR = "setor={setor}";
const WITH_LIST = [820];

/** @type {import("../screen.mjs").ScreenConfig} */
const legibilidade = {
  name: "legibilidade",
  states: {},
  audit: [
    { name: "entrar", path: "/entrar", person: null },
    {
      name: "convite-invalido",
      path: "/convite/token-invalido-de-teste",
      person: null,
    },
    { name: "redefinir-senha", path: "/redefinir-senha", person: null },
    { name: "privacidade", path: "/privacidade", person: null },
    { name: "bem-vindo", path: "/bem-vindo", person: "ana" },
    {
      name: "passagens",
      path: `/passagens?${SETOR}`,
      person: "ana",
      extraWidths: WITH_LIST,
    },
    {
      name: "passagens-operador",
      path: "/passagens",
      person: "carla",
      extraWidths: WITH_LIST,
    },
    {
      name: "nova-passagem",
      path: `/?${SETOR}`,
      person: "ana",
      extraWidths: WITH_LIST,
      steps: [
        { kind: "click", target: { role: "link", name: "Começar passagem" } },
        {
          kind: "waitFor",
          target: { role: "heading", name: "Passagem de turno" },
        },
      ],
    },
    { name: "passagem-pendente", path: "/passagens/{pendente}", person: "ana" },
    {
      name: "passagem-corrigida",
      path: "/passagens/{corrigida}",
      person: "ana",
    },
    {
      name: "passagem-operador",
      path: "/passagens/{corrigida}",
      person: "carla",
    },
    {
      name: "solicitacoes-quadro",
      path: `/solicitacoes?${SETOR}&visao=quadro`,
      person: "ana",
      extraWidths: WITH_LIST,
    },
    {
      name: "solicitacoes-lista",
      path: `/solicitacoes?${SETOR}&visao=lista`,
      person: "ana",
      extraWidths: WITH_LIST,
    },
    {
      name: "solicitacoes-tabela",
      path: `/solicitacoes?${SETOR}&visao=tabela`,
      person: "ana",
      extraWidths: WITH_LIST,
    },
    {
      name: "solicitacoes-operador",
      path: "/solicitacoes",
      person: "carla",
      extraWidths: WITH_LIST,
    },
    {
      // O detalhe rápido abre num Sheet pela navegação no cliente: a captura é só a janela.
      name: "solicitacao-sheet",
      path: `/solicitacoes?${SETOR}&visao=lista`,
      person: "ana",
      viewportOnly: true,
      steps: [
        { kind: "click", target: { css: 'a[href^="/solicitacoes/"]' } },
        { kind: "waitFor", target: { css: '[role="dialog"]' } },
      ],
    },
    {
      name: "solicitacao-pagina",
      path: "/solicitacoes/{solicitacao}",
      person: "carla",
    },
    {
      name: "dashboard",
      path: `/dashboard?${SETOR}`,
      person: "ana",
      extraWidths: WITH_LIST,
    },
    { name: "dashboard-operador", path: "/dashboard", person: "carla" },
    { name: "conta", path: "/conta", person: "ana" },
    { name: "conta-operador", path: "/conta", person: "carla" },
    { name: "admin", path: "/admin", person: "ana" },
    {
      name: "admin-setores",
      path: "/admin/setores",
      person: "ana",
      extraWidths: WITH_LIST,
    },
    {
      name: "admin-turnos",
      path: `/admin/turnos?${SETOR}`,
      person: "ana",
      extraWidths: WITH_LIST,
    },
    {
      name: "admin-itens",
      path: `/admin/itens?${SETOR}`,
      person: "ana",
      extraWidths: WITH_LIST,
    },
    {
      name: "admin-destinos",
      path: "/admin/destinos",
      person: "ana",
      extraWidths: WITH_LIST,
    },
    {
      name: "admin-equipe",
      path: "/admin/equipe",
      person: "ana",
      extraWidths: WITH_LIST,
    },
  ],
};

export default legibilidade;
```

- [ ] **Step 8: Implementar `scripts/visual/screens/provas.mjs`**

```js
// Os estados só do app que provam o PR B (spec §13): a falha de rede injetada numa Server Action e
// os hovers que antes sumiam dentro de cartão (bg-muted = card). Sem cópia do protótipo (proto: null):
// rodam no interact.mjs e no probe.mjs --app-only. Alvos escolhidos lendo as telas:
// - falha-de-rede: o "Agora não" do cartão "Convide sua equipe" (InviteTeamCard, uma Server Action);
// - hover-outline-em-cartao: o "Editar" (Button outline do EditDialog) de uma linha de destino, que é
//   um cartão (AdminListRow, bg-card), em /admin/destinos;
// - hover-ghost-em-cartao: o ↗ "Abrir página completa" (buttonVariants ghost) de um cartão do Quadro
//   (RequestCard, bg-card);
// - hover-statlink: o número "Abertas agora" do Dashboard (StatLink).
// O outline e o ghost vão no CLARO: lá o hover é bg-accent opaco e o bg-muted de antes era o próprio
// card, então a sonda distingue o antes do depois. No escuro o outline usa dark:hover:bg-input/50 (a
// Task 3 não muda) e o ghost usa accent/50, semitransparente (a string da cor sempre difere da do
// pai). O StatLink usa hover:bg-accent opaco nos dois temas e fica no escuro.

const HOVER_WAIT = { kind: "wait", ms: 300 };

/** @type {import("../screen.mjs").ScreenConfig} */
const provas = {
  name: "provas",
  ready: "main h1",
  states: {
    "falha-de-rede": {
      seed: "inicio:primeiro",
      person: "ana",
      theme: "dark",
      path: "/",
      sizes: [1440],
      proto: null,
      steps: {
        app: [
          {
            kind: "failRequests",
            match: { method: "POST", header: "next-action" },
            times: 1,
          },
          { kind: "click", target: { role: "button", name: "Agora não" } },
          { kind: "wait", ms: 1500 },
        ],
      },
      expect: { failedRequests: 1 },
    },
    "hover-outline-em-cartao": {
      seed: "geral:rico",
      person: "ana",
      theme: "light",
      path: "/admin/destinos",
      sizes: [1440],
      proto: null,
      steps: {
        app: [
          {
            kind: "hover",
            target: { role: "button", name: "Editar Doca Norte" },
          },
          HOVER_WAIT,
        ],
      },
    },
    "hover-ghost-em-cartao": {
      seed: "geral:rico",
      person: "ana",
      theme: "light",
      path: "/solicitacoes?setor={setor}&visao=quadro",
      sizes: [1440],
      proto: null,
      steps: {
        app: [
          {
            kind: "hover",
            target: { css: 'a[aria-label^="Abrir página completa de"]' },
          },
          HOVER_WAIT,
        ],
      },
    },
    "hover-statlink": {
      seed: "geral:rico",
      person: "ana",
      theme: "dark",
      path: "/dashboard?setor={setor}",
      sizes: [1440],
      proto: null,
      steps: {
        app: [{ kind: "hover", target: { text: "Abertas agora" } }, HOVER_WAIT],
      },
    },
  },
};

export default provas;
```

- [ ] **Step 9: Rodar e ver passar**

Run: `bunx vitest run test/visual/screens.test.ts`
Expected: PASS, 18 testes (8 do Início + 6 da legibilidade + 4 das provas).

- [ ] **Step 10: Implementar `scripts/visual/measure.mjs`**

```js
// Medida no DOM (spec §5.3): no mesmo estado e largura, para cada elemento folha de texto (pelo
// texto), a caixa, o controle em volta, a tipografia, a cor, o fundo, o raio, o padding, a rotação e
// o gap, no app e no protótipo, e lista só o que difere (tudo, com --all). --root=<css> limita a um
// trecho (ex.: o cartão). --so-proto mede só o protótipo, para extrair os px dele (Etapa 0.6). Rodar
// com node; semeia o estado antes de abrir o app.
//   node scripts/visual/measure.mjs --screen=inicio --state=admin-escuro --width=1440 --out=processo [--root=<css>] [--all]
//   node scripts/visual/measure.mjs --screen=inicio --state=admin-escuro --width=1440 --out=processo --so-proto
// Grava <out>/medidas/<estado>-<largura>.json.
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  closeState,
  commonHeight,
  launchBrowser,
  openProto,
  openState,
} from "./capture.mjs";
import { parseCliArgs, parseSizes } from "./config.mjs";
import { sddPath, writeInsideSdd } from "./paths.mjs";
import {
  loadScreen,
  pickState,
  protoFile,
  readState,
  resolvePath,
  runSeed,
} from "./screen.mjs";
import { runSteps } from "./steps.mjs";

const USAGE =
  "uso: node scripts/visual/measure.mjs --screen=<nome> | --config=<relativo> --state=<estado> --width=<px> --out=<pasta em .git/sdd> [--root=<css>] [--all] [--so-proto]";
const KNOWN_FLAGS = [
  "screen",
  "config",
  "state",
  "width",
  "out",
  "root",
  "all",
  "so-proto",
];
// Diferença de caixa abaixo disto é arredondamento.
const BOX_TOLERANCE_PX = 0.6;
const COMPARED = [
  "font",
  "color",
  "bg",
  "radius",
  "pad",
  "transform",
  "gap",
  "ctlBg",
  "ctlPad",
  "ctlRadius",
];

// Roda na página (page.evaluate com o argumento): não usa nada de fora dela.
function collectBoxes(root) {
  const scope = root ? document.querySelector(root) : document.body;
  if (!scope) return null;
  const round = (value) => Math.round(value * 10) / 10;
  const box = (rect) => [rect.x, rect.y, rect.width, rect.height].map(round);
  const info = (element) => {
    const style = getComputedStyle(element);
    const control = element.closest(
      "a,button,[role=radio],[role=switch],[role=tab],[role=checkbox]",
    );
    const controlStyle = control ? getComputedStyle(control) : null;
    return {
      tag: element.tagName.toLowerCase(),
      box: box(element.getBoundingClientRect()),
      ctl: control ? box(control.getBoundingClientRect()) : null,
      ctlBg: controlStyle ? controlStyle.backgroundColor : null,
      ctlPad: controlStyle ? controlStyle.padding : null,
      ctlRadius: controlStyle ? controlStyle.borderRadius : null,
      font: [
        style.fontFamily.split(",")[0].replace(/"/g, ""),
        style.fontSize,
        style.fontWeight,
        style.lineHeight,
        style.letterSpacing,
      ].join(" "),
      color: style.color,
      bg: style.backgroundColor,
      radius: style.borderRadius,
      pad: style.padding,
      transform: style.transform,
      gap: style.gap,
    };
  };
  const out = {};
  if (root) out["(raiz)"] = info(scope);
  for (const element of scope.querySelectorAll("*")) {
    if (["SCRIPT", "STYLE", "NEXTJS-PORTAL"].includes(element.tagName))
      continue;
    if (element instanceof SVGElement) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (element.closest("[aria-hidden=true],.sr-only")) continue;
    const style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") continue;
    const text = element.textContent.replace(/\s+/g, " ").trim();
    if (!text || text.length > 120) continue;
    // O mais interno com aquele texto.
    if (
      [...element.children].some(
        (child) => child.textContent.replace(/\s+/g, " ").trim() === text,
      )
    ) {
      continue;
    }
    const key = text.toLowerCase();
    if (!out[key]) out[key] = info(element);
  }
  for (const [index, image] of [...scope.querySelectorAll("img")].entries()) {
    out[`(img ${index})`] = info(image);
    if (image.parentElement)
      out[`(moldura ${index})`] = info(image.parentElement);
  }
  for (const [index, svg] of [...scope.querySelectorAll("svg")].entries()) {
    out[`(svg ${index})`] = info(svg);
  }
  return out;
}

/**
 * As linhas da comparação, protótipo → app.
 * @param {Record<string, any>} proto
 * @param {Record<string, any>} app
 * @param {boolean} all
 * @returns {string[]}
 */
function compare(proto, app, all) {
  const fmt = (box) => (box ? box.join(",") : "-");
  const near = (a, b) =>
    a.every((v, i) => Math.abs(v - b[i]) <= BOX_TOLERANCE_PX);
  const lines = [];
  for (const [key, p] of Object.entries(proto)) {
    const a = app[key];
    if (!a) {
      lines.push(`SÓ NO PROTÓTIPO  "${key}"  ${fmt(p.box)}`);
      continue;
    }
    const diffs = [];
    if (!near(p.box, a.box)) diffs.push(`box ${fmt(p.box)} -> ${fmt(a.box)}`);
    if (p.ctl && a.ctl && !near(p.ctl, a.ctl))
      diffs.push(`ctl ${fmt(p.ctl)} -> ${fmt(a.ctl)}`);
    for (const field of COMPARED) {
      // A família da fonte muda de nome entre o protótipo e o app (next/font); o resto conta.
      const left =
        field === "font" ? String(p.font).replace(/^\S+ /, "") : p[field];
      const right =
        field === "font" ? String(a.font).replace(/^\S+ /, "") : a[field];
      if (left !== right) diffs.push(`${field} ${p[field]} -> ${a[field]}`);
    }
    if (diffs.length > 0 || all) {
      lines.push(
        `"${key}" <${p.tag}/${a.tag}>\n   ${diffs.join("\n   ") || "igual"}`,
      );
    }
  }
  for (const [key, a] of Object.entries(app)) {
    if (!proto[key]) lines.push(`SÓ NO APP  "${key}"  ${fmt(a.box)}`);
  }
  return lines;
}

/**
 * @param {import("@playwright/test").Page} page
 * @param {string | null} root
 */
async function collect(page, root) {
  const found = await page.evaluate(collectBoxes, root);
  if (!found) throw new Error(`--root não achou nada: ${root}`);
  return found;
}

async function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter(
    (name) => !KNOWN_FLAGS.includes(name),
  );
  if (unknown.length > 0 || positional.length > 0) throw new Error(USAGE);
  if (typeof flags.out !== "string" || flags.out === "")
    throw new Error(`falta --out\n${USAGE}`);
  const out = flags.out;
  const screen = await loadScreen({
    screen: /** @type {string | undefined} */ (flags.screen),
    config: /** @type {string | undefined} */ (flags.config),
  });
  const stateName = String(flags.state ?? "");
  const state = pickState(screen, stateName);
  if (flags.width === undefined)
    throw new Error(`falta --width
${USAGE}`);
  const [width = 0] = parseSizes(String(flags.width), []);
  const root =
    typeof flags.root === "string" && flags.root !== "" ? flags.root : null;
  const file = join(sddPath(out, "medidas"), `${stateName}-${width}.json`);
  if (!state.proto)
    throw new Error(
      `o estado ${stateName} não tem cópia do protótipo para comparar`,
    );

  const browser = await launchBrowser();
  try {
    if (flags["so-proto"] === true) {
      const proto = await openProto(browser, {
        file: protoFile(out, screen, state.proto),
        width,
        reducedMotion: "reduce",
      });
      try {
        await runSteps(proto.page, state.steps?.proto ?? []);
        const found = await collect(proto.page, root);
        writeInsideSdd(file, `${JSON.stringify({ proto: found }, null, 1)}\n`);
        console.log(
          `gravado ${out}/medidas/${stateName}-${width}.json (${Object.keys(found).length} elementos do protótipo)`,
        );
      } finally {
        await proto.context.close();
      }
      return;
    }

    runSeed(state);
    const path = resolvePath(state.path, readState());
    const opened = await openState(browser, {
      screen,
      state,
      path,
      width,
      out,
    });
    try {
      const { height } = await commonHeight(opened, state, width);
      await opened.app.page.setViewportSize({ width, height });
      await opened.proto?.page.setViewportSize({ width, height });
      const app = await collect(opened.app.page, root);
      const proto = opened.proto ? await collect(opened.proto.page, root) : {};
      for (const line of compare(proto, app, flags.all === true))
        console.log(line);
      writeInsideSdd(file, `${JSON.stringify({ proto, app }, null, 1)}\n`);
      console.log(`gravado ${out}/medidas/${stateName}-${width}.json`);
    } finally {
      await closeState(opened);
    }
  } finally {
    await browser.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      `measure: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
```

- [ ] **Step 11: Implementar `scripts/visual/probe.mjs`**

```js
// Sonda (spec §5.3): avalia uma expressão nas duas páginas do estado (ou só no app, com --app-only)
// depois do patch e dos passos, e imprime lado a lado. É a prova por estilo computado (foco,
// contraste, tamanho, hover): nunca só a string da classe. Rodar com node; semeia o estado antes.
//   node scripts/visual/probe.mjs --screen=inicio --state=admin-escuro --width=1440 --out=processo "<expressão>"
//   node scripts/visual/probe.mjs --screen=provas --state=hover-statlink --width=1440 --app-only "<expressão>"
// Imprime "PROTO <json>" e "APP <json>". O --out (onde estão as cópias) só é exigido sem --app-only.
import { pathToFileURL } from "node:url";

import { closeState, launchBrowser, openState } from "./capture.mjs";
import { parseCliArgs, parseSizes } from "./config.mjs";
import {
  loadScreen,
  pickState,
  readState,
  resolvePath,
  runSeed,
} from "./screen.mjs";

const USAGE =
  'uso: node scripts/visual/probe.mjs --screen=<nome> | --config=<relativo> --state=<estado> --width=<px> [--out=<pasta em .git/sdd>] [--app-only] "<expressão>"';
const KNOWN_FLAGS = ["screen", "config", "state", "width", "out", "app-only"];

async function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter(
    (name) => !KNOWN_FLAGS.includes(name),
  );
  const [expression] = positional;
  if (unknown.length > 0 || positional.length !== 1 || !expression)
    throw new Error(USAGE);
  const appOnly = flags["app-only"] === true;
  const out =
    typeof flags.out === "string" && flags.out !== "" ? flags.out : undefined;
  if (!appOnly && out === undefined)
    throw new Error(`falta --out (ou use --app-only)\n${USAGE}`);
  const screen = await loadScreen({
    screen: /** @type {string | undefined} */ (flags.screen),
    config: /** @type {string | undefined} */ (flags.config),
  });
  const stateName = String(flags.state ?? "");
  const state = pickState(screen, stateName);
  if (!appOnly && !state.proto) {
    throw new Error(
      `o estado ${stateName} não tem cópia do protótipo: use --app-only`,
    );
  }
  if (flags.width === undefined) throw new Error(`falta --width\n${USAGE}`);
  const [width = 0] = parseSizes(String(flags.width), []);

  runSeed(state);
  const path = resolvePath(state.path, readState());
  const browser = await launchBrowser();
  try {
    const opened = await openState(browser, {
      screen,
      state,
      path,
      width,
      out: appOnly ? undefined : out,
    });
    try {
      if (opened.proto) {
        console.log(
          `PROTO ${JSON.stringify(await opened.proto.page.evaluate(expression))}`,
        );
      }
      console.log(
        `APP ${JSON.stringify(await opened.app.page.evaluate(expression))}`,
      );
    } finally {
      await closeState(opened);
    }
  } finally {
    await browser.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      `probe: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
```

- [ ] **Step 12: Implementar `scripts/visual/interact.mjs`**

```js
// Interação (spec §5.3 e §6): roda os passos de um estado no app (e no protótipo, se houver cópia),
// registra o que aconteceu (requisições falhadas, amostras, notas) e captura os dois lados. Código 1
// se o `expect.failedRequests` do estado não foi atingido. Rodar com node; semeia o estado antes.
//   node scripts/visual/interact.mjs --screen=provas --state=falha-de-rede --out=processo [--width=1440]
// Grava <out>/interacoes/<estado>-<largura>-{app,proto}.png e <estado>-<largura>.json.
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import {
  closeState,
  commonHeight,
  launchBrowser,
  openState,
  shoot,
} from "./capture.mjs";
import { parseCliArgs, parseSizes } from "./config.mjs";
import { sddPath, writeInsideSdd } from "./paths.mjs";
import {
  loadScreen,
  pickState,
  readState,
  resolvePath,
  runSeed,
} from "./screen.mjs";

const USAGE =
  "uso: node scripts/visual/interact.mjs --screen=<nome> | --config=<relativo> --state=<estado> --out=<pasta em .git/sdd> [--width=1440]";
const KNOWN_FLAGS = ["screen", "config", "state", "out", "width"];

async function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter(
    (name) => !KNOWN_FLAGS.includes(name),
  );
  if (unknown.length > 0 || positional.length > 0) throw new Error(USAGE);
  if (typeof flags.out !== "string" || flags.out === "")
    throw new Error(`falta --out\n${USAGE}`);
  const out = flags.out;
  const dir = sddPath(out, "interacoes");
  const screen = await loadScreen({
    screen: /** @type {string | undefined} */ (flags.screen),
    config: /** @type {string | undefined} */ (flags.config),
  });
  const stateName = String(flags.state ?? "");
  const state = pickState(screen, stateName);
  const [width = 1440] = parseSizes(
    flags.width === undefined ? undefined : String(flags.width),
    [1440],
  );
  const tag = `${stateName}-${width}`;

  runSeed(state);
  const path = resolvePath(state.path, readState());
  const browser = await launchBrowser();
  let failedCount = 0;
  try {
    const opened = await openState(browser, {
      screen,
      state,
      path,
      width,
      out,
    });
    try {
      const { height } = await commonHeight(opened, state, width);
      await shoot(opened.app.page, {
        width,
        height,
        out: join(dir, `${tag}-app.png`),
      });
      if (opened.proto) {
        await shoot(opened.proto.page, {
          width,
          height,
          out: join(dir, `${tag}-proto.png`),
        });
      }
      failedCount = opened.logs.app.failed.length;
      writeInsideSdd(
        join(dir, `${tag}.json`),
        `${JSON.stringify({ state: stateName, width, expect: state.expect ?? null, app: opened.logs.app, proto: opened.logs.proto, at: new Date().toISOString() }, null, 1)}\n`,
      );
      for (const failure of opened.logs.app.failed) {
        console.log(
          `falhou: ${failure.method} ${failure.url} (${failure.error})`,
        );
      }
      for (const sample of opened.logs.app.samples)
        console.log(`amostra ${sample.at}ms: ${sample.value}`);
      console.log(
        `gravado ${out}/interacoes/${tag}-app.png${opened.proto ? " e -proto.png" : ""} e ${tag}.json`,
      );
    } finally {
      await closeState(opened);
    }
  } finally {
    await browser.close();
  }

  const wanted = state.expect?.failedRequests;
  if (wanted !== undefined) {
    if (failedCount < wanted) {
      console.error(
        `esperava ao menos ${wanted} requisição(ões) falhada(s); houve ${failedCount}`,
      );
      process.exitCode = 1;
    } else {
      console.log(
        `requisições falhadas: ${failedCount} (esperado ao menos ${wanted})`,
      );
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      `interact: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  });
}
```

- [ ] **Step 13: Implementar `scripts/visual/audit.mjs`**

```js
// Auditoria de legibilidade (spec §5.3): para cada tela do `audit` da configuração, em cada tema e
// tamanho, captura a página e mede no próprio DOM o contraste do texto, o alvo de toque abaixo de
// 860px, a rolagem horizontal, a borda de campo e o fundo que some no do pai (contrast.mjs). Rodar
// com node, com o estado semeado antes (bun run visual:seed state geral:rico). Uma sessão por pessoa,
// reaproveitada; um contexto por captura.
//   node scripts/visual/audit.mjs --screen=legibilidade --out=processo [--only=a,b] [--themes=dark,light] [--sizes=1440x900,390x844] [--dir=legibilidade]
// Grava <out>/<dir>/<tela>-<escuro|claro>-<largura>.png e mescla <out>/<dir>/audit.json.
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import pg from "pg";

import { HIDE_DEV_CSS, launchBrowser, loginAs, settle } from "./capture.mjs";
import {
  assertVisualBaseUrl,
  assertVisualDbUrl,
  parseCliArgs,
  parseSizes,
  THEME_STORAGE_KEY,
  VISUAL_BASE_URL,
  VISUAL_DB_URL,
} from "./config.mjs";
import { auditScript } from "./contrast.mjs";
import {
  assertInsideSdd,
  readJsonInsideSdd,
  sddPath,
  writeInsideSdd,
} from "./paths.mjs";
import { loadScreen, readState, resolvePath } from "./screen.mjs";
import { runSteps } from "./steps.mjs";

/** @typedef {import("./screen.mjs").AuditScreen} AuditScreen */
/** @typedef {import("./screen.mjs").PersonKey} PersonKey */

const USAGE =
  "uso: node scripts/visual/audit.mjs --screen=<nome> | --config=<relativo> --out=<pasta em .git/sdd> [--only=a,b] [--themes=dark,light] [--sizes=1440x900,390x844] [--dir=legibilidade]";
const KNOWN_FLAGS = [
  "screen",
  "config",
  "out",
  "only",
  "themes",
  "sizes",
  "dir",
];
const BASE = assertVisualBaseUrl(VISUAL_BASE_URL);
const LOAD_TIMEOUT_MS = 120_000;
const EXTRA_WIDTH_HEIGHT = 900;
const AFTER_SETTLE_MS = 600;
// Os marcadores que a auditoria resolve no banco visual (o {setor} vem do state.json).
const ID_QUERIES = {
  pendente:
    "select id from handover where status = 'delivered' order by delivered_at desc limit 1",
  corrigida:
    "select handover_id as id from handover_correction order by corrected_at limit 1",
  solicitacao:
    "select id from request where status = 'requested' order by status_changed_at limit 1",
};

/** @param {unknown} error */
function messageOf(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * @param {string | true | undefined} value
 * @returns {("dark" | "light")[]}
 */
function parseThemes(value) {
  const themes = String(value ?? "dark,light")
    .split(",")
    .map((t) => t.trim());
  for (const theme of themes) {
    if (theme !== "dark" && theme !== "light")
      throw new Error(`tema inválido: ${theme}`);
  }
  return /** @type {("dark" | "light")[]} */ (themes);
}

/**
 * "1440x900,390x844" → [[1440, 900], [390, 844]].
 * @param {string | true | undefined} value
 * @returns {[number, number][]}
 */
function parseViewports(value) {
  return String(value ?? "1440x900,390x844")
    .split(",")
    .map((token) => {
      const match = /^(\d+)x(\d+)$/.exec(token.trim());
      if (!match) throw new Error(`tamanho no formato LxA: ${token}`);
      const [width = 0] = parseSizes(match[1], []);
      const [height = 0] = parseSizes(match[2], []);
      return /** @type {[number, number]} */ ([width, height]);
    });
}

/**
 * Os ids que os caminhos escolhidos pedem, por consulta ao banco visual.
 * @param {readonly AuditScreen[]} entries
 * @returns {Promise<Record<string, string>>}
 */
async function resolveIds(entries) {
  const wanted = Object.keys(ID_QUERIES).filter((key) =>
    entries.some((entry) => entry.path.includes(`{${key}}`)),
  );
  if (wanted.length === 0) return {};
  const client = new pg.Client({
    connectionString: assertVisualDbUrl(VISUAL_DB_URL),
  });
  await client.connect();
  try {
    /** @type {Record<string, string>} */
    const ids = {};
    for (const key of wanted) {
      const result = await client.query(
        ID_QUERIES[/** @type {keyof typeof ID_QUERIES} */ (key)],
      );
      const id = result.rows[0]?.id;
      if (typeof id !== "string") {
        throw new Error(
          `sem valor para {${key}} no banco visual (semeie geral:rico)`,
        );
      }
      ids[key] = id;
    }
    return ids;
  } finally {
    await client.end();
  }
}

async function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter(
    (name) => !KNOWN_FLAGS.includes(name),
  );
  if (unknown.length > 0 || positional.length > 0) throw new Error(USAGE);
  if (typeof flags.out !== "string" || flags.out === "")
    throw new Error(`falta --out\n${USAGE}`);
  const dirName =
    typeof flags.dir === "string" && flags.dir !== ""
      ? flags.dir
      : "legibilidade";
  const dir = sddPath(flags.out, dirName);
  const screen = await loadScreen({
    screen: /** @type {string | undefined} */ (flags.screen),
    config: /** @type {string | undefined} */ (flags.config),
  });
  const audit = screen.audit ?? [];
  if (audit.length === 0)
    throw new Error(`a tela ${screen.name} não tem audit`);
  const only =
    typeof flags.only === "string"
      ? flags.only
          .split(",")
          .map((name) => name.trim())
          .filter(Boolean)
      : null;
  const missing = (only ?? []).filter(
    (name) => !audit.some((entry) => entry.name === name),
  );
  if (missing.length > 0)
    throw new Error(`tela desconhecida no audit: ${missing.join(", ")}`);
  const entries = only
    ? audit.filter((entry) => only.includes(entry.name))
    : audit;
  const themes = parseThemes(flags.themes);
  const viewports = parseViewports(flags.sizes);

  const state = readState();
  console.log(`estado do banco: ${state.state} (setor ${state.sector})`);
  const values = { sectorId: state.sectorId, ...(await resolveIds(entries)) };

  const auditFile = join(dir, "audit.json");
  /** @type {Record<string, unknown>} */
  const results = existsSync(auditFile)
    ? /** @type {Record<string, unknown>} */ (readJsonInsideSdd(auditFile))
    : {};
  /** @type {Partial<Record<PersonKey, Awaited<ReturnType<import("@playwright/test").BrowserContext["storageState"]>>>>} */
  const sessions = {};
  let failures = 0;

  const browser = await launchBrowser();
  /** @param {PersonKey} person */
  const sessionOf = async (person) => {
    const cached = sessions[person];
    if (cached) return cached;
    const context = await browser.newContext();
    try {
      await loginAs(context, person);
      const storage = await context.storageState();
      sessions[person] = storage;
      return storage;
    } finally {
      await context.close();
    }
  };

  try {
    for (const entry of entries) {
      const sizes = [
        ...viewports,
        ...(entry.extraWidths ?? []).map(
          (w) => /** @type {[number, number]} */ ([w, EXTRA_WIDTH_HEIGHT]),
        ),
      ];
      for (const theme of themes) {
        for (const [width, height] of sizes) {
          const tag = `${entry.name}-${theme === "dark" ? "escuro" : "claro"}-${width}`;
          const context = await browser.newContext({
            viewport: { width, height },
            deviceScaleFactor: 1,
            reducedMotion: "reduce",
            ...(entry.person
              ? { storageState: await sessionOf(entry.person) }
              : {}),
          });
          try {
            await context.addInitScript(
              ({ key, value }) => {
                try {
                  localStorage.setItem(key, value);
                } catch {
                  // Storage bloqueado: fica o tema padrão (escuro).
                }
              },
              { key: THEME_STORAGE_KEY, value: theme },
            );
            const page = await context.newPage();
            await page.goto(
              new URL(resolvePath(entry.path, values), BASE).href,
              {
                waitUntil: "load",
                timeout: LOAD_TIMEOUT_MS,
              },
            );
            await page.addStyleTag({ content: HIDE_DEV_CSS });
            if (entry.steps) {
              await runSteps(page, entry.steps);
              // Um passo que navega perde o estilo: põe de novo.
              await page.addStyleTag({ content: HIDE_DEV_CSS });
            }
            await settle(page);
            await page.waitForTimeout(AFTER_SETTLE_MS);
            const file = assertInsideSdd(join(dir, `${tag}.png`));
            mkdirSync(dirname(file), { recursive: true });
            await page.screenshot({
              path: file,
              fullPage: !entry.viewportOnly,
            });
            const found = await page.evaluate(auditScript());
            results[tag] = found;
            const weakFields = found.inputs.filter(
              (i) => i.border < 1.3 && i.fill < 1.1,
            ).length;
            console.log(
              `${tag}: contraste ${found.contrast.length}, alvos ${found.targets.length}, campos ${weakFields}, some ${found.sameBg.length}${found.overflow ? `, ROLA ${found.overflow}px` : ""}`,
            );
          } catch (error) {
            failures += 1;
            console.log(`${tag}: ERRO ${messageOf(error).slice(0, 200)}`);
          } finally {
            await context.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
    writeInsideSdd(auditFile, `${JSON.stringify(results, null, 1)}\n`);
  }
  if (failures > 0) process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(`visual:audit: ${messageOf(error)}`);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 14: Implementar `scripts/visual/sheet.mjs`**

```js
// Folha de contato (spec §5.3): junta lado a lado as capturas de uma tela (escuro e claro, em cada
// largura), reduzidas, para olhar tudo de uma vez. Lê e grava só dentro de .git/sdd.
//   node scripts/visual/sheet.mjs <prefixo> --dir=<relativo a .git/sdd> [--scale=0.5] [--max=1800] [--widths=1440,820,390]
// Lê <dir>/<prefixo>-{escuro,claro}-<largura>.png e grava <dir>/_sheet-<prefixo>.png.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { parseCliArgs, parseSizes } from "./config.mjs";
import { contactSheet, readPng, writePng } from "./image.mjs";
import { sddPath } from "./paths.mjs";

const USAGE =
  "uso: node scripts/visual/sheet.mjs <prefixo> --dir=<relativo a .git/sdd> [--scale=0.5] [--max=1800] [--widths=1440,820,390]";
const KNOWN_FLAGS = ["dir", "scale", "max", "widths"];
const NAME = /^[a-z0-9][a-z0-9-]*$/;

function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter(
    (name) => !KNOWN_FLAGS.includes(name),
  );
  const [prefix] = positional;
  if (
    unknown.length > 0 ||
    positional.length !== 1 ||
    !prefix ||
    !NAME.test(prefix)
  ) {
    throw new Error(USAGE);
  }
  if (typeof flags.dir !== "string" || flags.dir === "")
    throw new Error(`falta --dir\n${USAGE}`);
  const dir = sddPath(flags.dir);
  const scale = flags.scale === undefined ? 0.5 : Number(flags.scale);
  const max = flags.max === undefined ? 1800 : Number(flags.max);
  if (!Number.isInteger(max) || max < 1)
    throw new Error(`--max inválido: ${String(flags.max)}`);
  const widths = parseSizes(
    flags.widths === undefined ? undefined : String(flags.widths),
    [1440, 820, 390],
  );
  const files = [];
  for (const width of widths) {
    for (const theme of ["escuro", "claro"]) {
      const name = `${prefix}-${theme}-${width}.png`;
      if (existsSync(join(dir, name))) files.push(name);
    }
  }
  if (files.length === 0) {
    throw new Error(
      `nenhuma captura ${prefix}-{escuro,claro}-<largura>.png em ${flags.dir}`,
    );
  }
  const sheet = contactSheet(
    files.map((name) => readPng(join(dir, name))),
    scale,
    max,
  );
  const target = join(dir, `_sheet-${prefix}.png`);
  writePng(target, sheet);
  console.log(`gravado ${flags.dir}/_sheet-${prefix}.png (${files.join(" ")})`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(
      `sheet: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
```

- [ ] **Step 15: Implementar `scripts/visual/sbs.mjs`**

```js
// Lado a lado com zoom (spec §5.3): recorta a mesma região do protótipo, do app e da diferença de
// um par e empilha (protótipo em cima, app no meio, diferença embaixo), ampliada sem suavizar.
//   node scripts/visual/sbs.mjs <tag> <x> <y> <w> <h> [zoom] --dir=<relativo a .git/sdd>
// Lê <dir>/<tag>-{proto,app,diff}.png e grava <dir>/<tag>-zoom.png.
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { parseCliArgs, parseSizes } from "./config.mjs";
import { parseRect, readPng, stackRegion, writePng } from "./image.mjs";
import { sddPath } from "./paths.mjs";

const USAGE =
  "uso: node scripts/visual/sbs.mjs <tag> <x> <y> <w> <h> [zoom] --dir=<relativo a .git/sdd>";
const NAME = /^[a-z0-9][a-z0-9-]*$/;

function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter((name) => name !== "dir");
  const [tag, ...numbers] = positional;
  if (
    unknown.length > 0 ||
    !tag ||
    !NAME.test(tag) ||
    numbers.length < 4 ||
    numbers.length > 5
  ) {
    throw new Error(USAGE);
  }
  if (typeof flags.dir !== "string" || flags.dir === "")
    throw new Error(`falta --dir\n${USAGE}`);
  const dir = sddPath(flags.dir);
  const rect = parseRect(numbers.slice(0, 4));
  const [zoom = 1] = parseSizes(numbers[4], [1]);
  const parts = ["proto", "app", "diff"].map((side) =>
    readPng(join(dir, `${tag}-${side}.png`)),
  );
  const target = join(dir, `${tag}-zoom.png`);
  writePng(target, stackRegion(parts, rect, zoom));
  console.log(`gravado ${flags.dir}/${tag}-zoom.png`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(
      `sbs: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
```

- [ ] **Step 16: Implementar `scripts/visual/crop.mjs`**

```js
// Recorte em tamanho real (spec §5.3) de uma captura, cortado nas bordas.
//   node scripts/visual/crop.mjs <arquivo> <x> <y> <w> <h> [saída] --dir=<relativo a .git/sdd>
// Lê <dir>/<arquivo> e grava <dir>/<saída> (padrão: <arquivo sem .png>-recorte.png).
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { parseCliArgs } from "./config.mjs";
import { cropRect, parseRect, readPng, writePng } from "./image.mjs";
import { sddPath } from "./paths.mjs";

const USAGE =
  "uso: node scripts/visual/crop.mjs <arquivo.png> <x> <y> <w> <h> [saída.png] --dir=<relativo a .git/sdd>";
const PNG_NAME = /^[^/\\]+\.png$/;

function main() {
  const { flags, positional } = parseCliArgs(process.argv.slice(2));
  const unknown = Object.keys(flags).filter((name) => name !== "dir");
  const [file, x, y, w, h, output] = positional;
  if (unknown.length > 0 || positional.length < 5 || positional.length > 6)
    throw new Error(USAGE);
  if (
    !file ||
    !PNG_NAME.test(file) ||
    (output !== undefined && !PNG_NAME.test(output))
  ) {
    throw new Error(`arquivo e saída são nomes .png dentro do --dir\n${USAGE}`);
  }
  if (typeof flags.dir !== "string" || flags.dir === "")
    throw new Error(`falta --dir\n${USAGE}`);
  const dir = sddPath(flags.dir);
  const cropped = cropRect(readPng(join(dir, file)), parseRect([x, y, w, h]));
  const name = output ?? file.replace(/\.png$/, "-recorte.png");
  writePng(join(dir, name), cropped);
  console.log(
    `gravado ${flags.dir}/${name} (${cropped.width}x${cropped.height})`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(
      `crop: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
```

- [ ] **Step 17: Atalho no `package.json`**

Edit em `package.json`. O `old_string` é o que a Task 7 (Step 24) deixou:

```json
    "visual:pairs": "node scripts/visual/pairs.mjs",
    "visual:names": "node scripts/visual/check-names.mjs",
```

`new_string`:

```json
    "visual:pairs": "node scripts/visual/pairs.mjs",
    "visual:audit": "node scripts/visual/audit.mjs",
    "visual:names": "node scripts/visual/check-names.mjs",
```

Depois desta tarefa, o fim de `scripts` é (os oito atalhos da spec §5.7, na ordem que o `AGENTS.md` da Task 10 lista):

```json
    "smoke": "bun scripts/smoke.mjs",
    "visual:db": "bun scripts/visual/db.ts",
    "visual:seed": "bun scripts/visual/seed/index.ts",
    "visual:people": "node scripts/visual/people.mjs",
    "visual:proto": "node scripts/visual/proto.mjs",
    "visual:pairs": "node scripts/visual/pairs.mjs",
    "visual:audit": "node scripts/visual/audit.mjs",
    "visual:names": "node scripts/visual/check-names.mjs",
    "visual:hooks": "node scripts/visual/install-hooks.mjs"
  },
```

Conferir: `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` não lança.

- [ ] **Step 18: Formatar, tipos, lint e os testes tocados**

Run: `bunx biome check --write scripts/visual test/visual package.json`
Expected: termina sem erro.
Run: `bun run check-types`
Expected: sai com 0.
Run: `bun run lint`
Expected: sai com 0.
Run: `bunx vitest run test/visual`
Expected: PASS, todos os arquivos de `test/visual/`.

- [ ] **Step 19: Os CLIs recusam uso errado e destino fora de `.git/sdd` (sem navegador)**

Run: `node scripts/visual/sheet.mjs; echo "código $?"`
Expected: `sheet: uso: …` e `código 1`.
Run: `node scripts/visual/crop.mjs ../x.png 0 0 1 1 --dir=processo; echo "código $?"`
Expected: `crop: arquivo e saída são nomes .png dentro do --dir` e `código 1`.
Run: `node scripts/visual/sbs.mjs tag 0 0 1 --dir=processo; echo "código $?"`
Expected: `sbs: uso: …` e `código 1`.
Run: `node scripts/visual/audit.mjs --screen=legibilidade --out=../../fora; echo "código $?"`
Expected: `visual:audit: fora de <…>/.git/sdd: ../../fora/legibilidade` e `código 1`.
Run: `node scripts/visual/probe.mjs --screen=provas --state=hover-statlink --width=1440 "1"; echo "código $?"`
Expected: `probe: falta --out (ou use --app-only)` e `código 1`.

- [ ] **Step 20: Conferência manual pelo controlador no C1 (não rodar na redação nem na tarefa)**

No C1, o `interact`, as três sondas de hover e o `visual:audit` são os Steps 5, 6 e 7 dele (a expressão da sonda é o
`hover.js` do C1); os dois `measure`, o `sheet`, o `sbs` e o `crop` rodam no Step 8 do C1. Com o ambiente de pé (Task 5)
e as cópias do Início geradas (Task 7):

```sh
node scripts/visual/interact.mjs --screen=provas --state=falha-de-rede --out=processo
# Expected: "falhou: POST http://localhost:3202/ (net::ERR_FAILED)" (pelo menos uma), "gravado processo/interacoes/
# falha-de-rede-1440-app.png e falha-de-rede-1440.json", "requisições falhadas: 1 (esperado ao menos 1)", código 0;
# na captura, o cartão "Convide sua equipe" continua na tela
node scripts/visual/probe.mjs --screen=provas --state=hover-statlink --width=1440 --app-only "(() => { const el = [...document.querySelectorAll('a:hover')].pop(); if (!el) return null; let p = el.parentElement; while (p && getComputedStyle(p).backgroundColor === 'rgba(0, 0, 0, 0)') p = p.parentElement; return { hover: getComputedStyle(el).backgroundColor, pai: p ? getComputedStyle(p).backgroundColor : null }; })()"
# Expected: "APP {\"hover\":\"rgb(…)\",\"pai\":\"rgb(…)\"}" com o hover diferente do fundo opaco do pai (depois da
# Task 3); a expressão exata de cada um dos três hovers é do C1 (R3)
node scripts/visual/measure.mjs --screen=inicio --state=entregue-escuro-uld --width=1440 --out=processo --root="main"
# Expected: as linhas que diferem ("<texto>" <tag/tag> …) ou nenhuma; "gravado processo/medidas/entregue-escuro-uld-1440.json"
node scripts/visual/measure.mjs --screen=inicio --state=admin-escuro --width=1440 --out=processo --so-proto
# Expected: "gravado processo/medidas/admin-escuro-1440.json (N elementos do protótipo)"
bun run visual:seed state geral:rico
bun run visual:audit --screen=legibilidade --out=processo --only=conta,dashboard,admin-destinos
# Expected: "estado do banco: geral:rico (setor ULD)" e uma linha "<tela>-<tema>-<largura>: contraste N, alvos N,
# campos N, some N" por captura (2 temas × 1440 e 390, mais 820 onde há); .git/sdd/processo/legibilidade/audit.json
node scripts/visual/sheet.mjs conta --dir=processo/legibilidade
# Expected: "gravado processo/legibilidade/_sheet-conta.png (conta-escuro-1440.png conta-claro-1440.png …)"
node scripts/visual/sbs.mjs admin-escuro-390 0 0 390 120 3 --dir=processo/pares
# Expected: "gravado processo/pares/admin-escuro-390-zoom.png"
node scripts/visual/crop.mjs conta-escuro-390.png 0 0 390 300 --dir=processo/legibilidade
# Expected: "gravado processo/legibilidade/conta-escuro-390-recorte.png (390x300)"
```

- [ ] **Step 21: Commit**

Mensagem gravada com Write em `.git/sdd/processo/msg-task-8.txt`:

```text
chore(visual): medida, sonda, interação, auditoria e recortes

contrast.mjs (as contas do WCAG e o script da auditoria, montado com as
mesmas funções), measure.mjs, probe.mjs, interact.mjs (código 1 sem a
falha de rede esperada), audit.mjs, sheet.mjs, sbs.mjs e crop.mjs, todos
gravando só em .git/sdd. screens/legibilidade.mjs (as 27 telas do PR A) e
screens/provas.mjs (falha de rede e os três hovers). Atalho visual:audit.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

Run: `git add package.json scripts/visual/contrast.mjs scripts/visual/screens/legibilidade.mjs scripts/visual/screens/provas.mjs scripts/visual/measure.mjs scripts/visual/probe.mjs scripts/visual/interact.mjs scripts/visual/audit.mjs scripts/visual/sheet.mjs scripts/visual/sbs.mjs scripts/visual/crop.mjs test/visual/contrast.test.ts test/visual/screens.test.ts && git commit -F .git/sdd/processo/msg-task-8.txt`
Expected: o `pre-commit` passa; um commit com 13 arquivos; `git status` limpo.

---

### Task 9: Skill `handoff-visual`

**Spec:** §10 · **Redator:** R3 · **Depende de:** T4 a T8 (só os nomes)

**Files:**
- Create: `.claude/skills/handoff-visual/SKILL.md`
- Create: `.claude/skills/handoff-visual/templates/global-constraints.md`
- Create: `.claude/skills/handoff-visual/templates/plan-contract.md`
- Create: `.claude/skills/handoff-visual/templates/task-brief.md`
- Create: `.claude/skills/handoff-visual/templates/review-brief.md`
- Create: `.claude/skills/handoff-visual/templates/final-review-brief.md`
- Create: `.claude/skills/handoff-visual/templates/pixel-brief.md`
- Create: `.claude/skills/handoff-visual/templates/legibilidade-brief.md`
- Create: `.claude/skills/handoff-visual/templates/pr-body.md`
- Test: `test/skillHandoffVisual.test.ts`

Testes existentes que mudam: nenhum (o `vitest.config.ts` exclui `.claude/**` como pasta de testes; o teste novo mora em
`test/` e só lê os arquivos da skill). O Biome ignora `.md`.

**Interfaces:**
- Consumes: `loadNamesList(): NamesList | null` e `findForbidden(text, list)` (T6); os atalhos `visual:db`,
  `visual:seed`, `visual:people` (T5), `visual:proto`, `visual:pairs` (T7), `visual:audit` (T8), `visual:names`,
  `visual:hooks` (T6); os arquivos citados pela skill: `scripts/visual/vocabulary.mjs` (T4), `env.sh` (T5),
  `capture.mjs`, `screens/inicio.mjs` (T7), `measure.mjs`, `probe.mjs`, `sbs.mjs`, `crop.mjs`, `sheet.mjs`,
  `screens/legibilidade.mjs` (T8), `registry.mjs`, `registry-diff.mjs` (T6).
- Produces: a skill `/handoff-visual` (frontmatter `name: handoff-visual`) e os oito modelos, com os marcadores
  `<slug>`, `<data>`, `<base>` e `<N>`. Quem usa: a T10 (o `AGENTS.md` cita a skill) e as branches C a G.

- [ ] **Step 1: Carregar as regras de escrita para agentes**

Se a skill `mattpocock-skills:writing-for-agents` existir, carregue-a (Skill tool) antes de escrever. O texto abaixo já
segue as regras dela: a descrição começa pelo gatilho, cada etapa termina num critério de saída, a referência das
ferramentas mora num lugar só (`library-docs.md §22`) e os modelos ficam atrás de ponteiros.

- [ ] **Step 2: Escrever o teste que falha**

Crie `test/skillHandoffVisual.test.ts` (ferramenta Write):

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { findForbidden, loadNamesList } from "../scripts/visual/names.mjs";

// Guarda da skill handoff-visual (spec §10): o frontmatter, os oito modelos
// citados e presentes, e nenhuma referência velha (comando visual:* que não
// existe no package.json, ferramenta que não existe em scripts/visual). Com a
// lista de nomes presente (só na máquina do controlador), nenhum termo dela.

const SKILL_DIR = join(".claude", "skills", "handoff-visual");
const TEMPLATES = [
  "global-constraints",
  "plan-contract",
  "task-brief",
  "review-brief",
  "final-review-brief",
  "pixel-brief",
  "legibilidade-brief",
  "pr-body",
];

const skill = readFileSync(join(SKILL_DIR, "SKILL.md"), "utf8");
const templateFiles = existsSync(join(SKILL_DIR, "templates"))
  ? readdirSync(join(SKILL_DIR, "templates")).sort()
  : [];
const documents: [string, string][] = [
  ["SKILL.md", skill],
  ...templateFiles.map((file): [string, string] => [
    `templates/${file}`,
    readFileSync(join(SKILL_DIR, "templates", file), "utf8"),
  ]),
];
const scripts = Object.keys(
  (
    JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    }
  ).scripts,
);
const namesList = loadNamesList();

function frontmatter(text: string): Record<string, string> {
  const block = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text)?.[1] ?? "";
  return Object.fromEntries(
    block.split(/\r?\n/).flatMap((line) => {
      const match = /^([a-z-]+):\s*(.+)$/.exec(line);
      return match?.[1] && match[2] ? [[match[1], match[2].trim()]] : [];
    }),
  );
}

describe("skill handoff-visual", () => {
  it("abre com o frontmatter: name e description com o gatilho", () => {
    const meta = frontmatter(skill);
    expect(meta.name).toBe("handoff-visual");
    expect(meta.description).toMatch(/handoff do Claude Design/);
  });

  it("o primeiro passo manda ler o roteiro e o mapa da tela", () => {
    expect(skill).toContain(".git/sdd/roadmap/roteiro.md");
    expect(skill).toContain(".git/sdd/roadmap/map-<slug>.md");
  });

  it.each(TEMPLATES)("cita templates/%s.md, e o arquivo existe", (name) => {
    expect(skill).toContain(`templates/${name}.md`);
    expect(existsSync(join(SKILL_DIR, "templates", `${name}.md`))).toBe(true);
  });

  it("a pasta templates tem só os oito modelos", () => {
    expect(templateFiles).toEqual(TEMPLATES.map((name) => `${name}.md`).sort());
  });

  it.each(TEMPLATES)("o modelo %s usa o marcador <slug>", (name) => {
    const text = readFileSync(
      join(SKILL_DIR, "templates", `${name}.md`),
      "utf8",
    );
    expect(text).toContain("<slug>");
  });

  it.each(
    documents,
  )("%s: todo `bun run visual:*` existe no package.json", (_file, text) => {
    const cited = [...text.matchAll(/bun run (visual:[\w-]+)/g)].map(
      (match) => match[1] ?? "",
    );
    expect(cited.filter((name) => !scripts.includes(name))).toEqual([]);
  });

  it.each(
    documents,
  )("%s: toda ferramenta de scripts/visual citada existe", (_file, text) => {
    const cited = [
      ...text.matchAll(/scripts\/visual\/[\w./-]+\.(?:mjs|ts|sh)\b/g),
    ].map((match) => match[0]);
    expect(cited.filter((path) => !existsSync(path))).toEqual([]);
  });

  it.skipIf(namesList === null)(
    "nenhum termo da lista de nomes proibidos aparece na skill",
    () => {
      const list = namesList ?? { terms: [], allowed: [] };
      const hits = documents.flatMap(([file, text]) =>
        findForbidden(text, list).map(
          (hit) => `${file}:${hit.line} — linha ${hit.listLine} da lista`,
        ),
      );
      expect(hits).toEqual([]);
    },
  );
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `bunx vitest run test/skillHandoffVisual.test.ts`
Expected: FAIL com `Error: ENOENT: no such file or directory, open '…\.claude\skills\handoff-visual\SKILL.md'`
(`Tests  no tests`).

- [ ] **Step 4: Escrever o `SKILL.md`**

Crie `.claude/skills/handoff-visual/SKILL.md` (ferramenta Write):

~~~~markdown
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
bunx vitest run src/db src/instrumentation.test.ts src/proxy.test.ts && bunx vitest run test
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
~~~~

- [ ] **Step 5: Rodar e ver os modelos faltarem**

Run: `bunx vitest run test/skillHandoffVisual.test.ts`
Expected: `Tests  17 failed | 4 passed | 1 skipped (22)` sem a lista (com a lista: `17 failed | 5 passed`); os vermelhos
são os oito "cita templates/…", a pasta e os oito "usa o marcador <slug>" (`ENOENT`, `expected false to be true`).

- [ ] **Step 6: Escrever os oito modelos**

Crie cada arquivo com a ferramenta Write.

`.claude/skills/handoff-visual/templates/global-constraints.md`:

~~~~markdown
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
  tooltip; ícones `aria-hidden`; `prefers-reduced-motion` desliga as animações.
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
- Rota nova de primeiro nível em `src/app/(app)` ganha o espelho no slot `@detalhe` (`library-docs.md §1`).

## Decisões tomadas na montagem do plano

- `<decisão>`: `<por quê>`.
~~~~

`.claude/skills/handoff-visual/templates/plan-contract.md`:

~~~~markdown
# Contrato do plano: visual de `<slug>` (`feat/visual-<slug>`, base `<base>`)

Você vai **redigir** tarefas de um plano de implementação, não implementar. O plano final junta os rascunhos de vários
redatores; por isso todos seguem **este contrato** (nomes, tipos, props, arquivos, comandos e ordem). Se um nome daqui
não servir, siga com o nome do contrato e registre o problema em "Dúvidas para o controlador" no seu rascunho.

## Fontes de verdade (leia antes)

- **Spec:** `docs/superpowers/specs/<data>-visual-<slug>-design.md`. **A spec manda.** As seções que cada tarefa
  implementa estão na tabela de tarefas.
- **Handoff** (fora do git): `.git/sdd/visual-<slug>/handoff/README.md`, o protótipo `.dc.html` (leia como TEXTO: CSS
  e marcação de referência) e as screenshots (escala reduzida; só para entender o visual). Os valores finos vêm do
  protótipo renderizado (`.git/sdd/visual-<slug>/ref/`) e das medidas da spec.
- **Roteiro e mapa** (fora do git): `.git/sdd/roadmap/roteiro.md` (§3, as peças compartilhadas) e
  `.git/sdd/visual-<slug>/mapa-atual.md`. Contexto, não fonte de nomes: os nomes são os deste contrato.
- **Regras:** `AGENTS.md` (no seu contexto), `.context/ui-rules.md`, `.context/ui-tokens.md`, `.context/ui-registry.md`,
  `.context/code-standards.md`, `.context/library-docs.md`, `.context/architecture.md`, `.context/pendencias.md`
  (cabeçalho "Como adicionar").
- **Next.js:** para qualquer API do Next, leia `node_modules/next/dist/docs/`.
- **O código atual:** leia CADA arquivo que a sua tarefa toca antes de escrever o passo que o muda.

## Proibições

- Pessoas e textos: só Ana, Bruno, Carla e Diego Teste e o vocabulário de `scripts/visual/vocabulary.mjs`. Nome de
  pessoa, e-mail ou texto operacional (descrição, frase, item, destino) do protótipo e das screenshots nunca entra no
  rascunho.
- Sem suíte inteira, build, E2E nem servidor (pouca memória). Pode rodar `git`, `grep`, `ls` e, para confirmar uma API,
  um teste de UM arquivo (`bunx vitest run <arquivo>`).
- O seu único arquivo de saída é o rascunho: nenhum arquivo do repositório muda.
- Porta 3000 nunca. Segredo e `.env.local` nunca impressos.
- Só tokens em `.tsx` (nenhum hex cru nem classe de cor crua do Tailwind).

## Global Constraints

As de `.git/sdd/visual-<slug>/global-constraints.md` (vão no cabeçalho do plano e em todo brief).

## Formato de cada tarefa (obrigatório)

````markdown
### Task N: <título curto>

**Spec:** §x.y · **Redator:** Rx · **Depende de:** Tn

**Files:**
- Create: `caminho/exato`
- Modify: `caminho/exato` (o que muda)
- Delete: `caminho/exato`
- Test: `caminho/exato.test.ts(x)`

**Interfaces:**
- Consumes: <nomes e assinaturas exatas de tarefas anteriores, deste contrato>
- Produces: <nomes e assinaturas exatas que tarefas seguintes usam, deste contrato>

- [ ] **Step 1: Escrever o teste que falha**

```ts
// código COMPLETO do teste
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bunx vitest run caminho/arquivo.test.ts`
Expected: FAIL com "<mensagem>"

- [ ] **Step 3: Implementar**

```tsx
// código COMPLETO do arquivo (ou do trecho, com o contexto para achar o lugar exato)
```

- [ ] **Step 4: Rodar e ver passar**
...
- [ ] **Step N: Commit**

Mensagem gravada com Write em `.git/sdd/visual-<slug>/msg-task-N.txt`;
`git add <arquivos> && git commit -F .git/sdd/visual-<slug>/msg-task-N.txt`.
Mensagem: `<tipo>(<escopo>): <resumo em pt-BR>` + corpo curto + linha final
`Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
````

Regras do formato:
- Passos de 2 a 5 minutos. TDD: teste antes do código. **Código completo em todo passo que muda código** ("igual à
  tarefa X", "adicione validação", "TODO" e "TBD" não contam como código).
- Testes cobrem erro, limite (vazio, zero, máximo, nome longo, 5 setores) e permissão negada (`code-standards.md §7`),
  além do caminho feliz. Teste de componente segue o `*.test.tsx` vizinho.
- Foco, contraste e tamanho ganham prova por estilo computado (E2E ou `probe`), além do teste de classe.
- Cada tarefa lista os testes existentes que mudam (`grep -rl <nome> src test e2e`) e mostra a mudança.
- Componente visual novo ou mudado: entrada nova ou `Histórico` datado (<data>) no `ui-registry.md`, no mesmo commit.
- Arquivo com acento: a ferramenta Write.

## Tarefas, donos e dependências

As extrações de peça que já existe vêm primeiro, como tarefas `refactor` próprias, cada uma com os pares da tela dona
rerodados. As tarefas do controlador (sem número) ficam no fim.

| # | Tarefa | Spec | Redator | Depende de | Commit |
|---|---|---|---|---|---|
| 1 | `<extração>` | §x | R1 | — | `refactor(<escopo>): …` |
| 2 | `<tarefa>` | §x | R1 | 1 | `feat(<escopo>): …` |
| C1 | E2E completo com build | §x | controlador | `<N>` | nenhum |
| C2 | Passe de legibilidade | §x | controlador | C1 | `fix(visual): …` por tela |
| C3 | Pixel perfect | §x | controlador | C2 | `fix(visual): …` |
| C4 | Documentos e portão | §x | controlador | C3 | `docs: …` |

Rascunhos: R1 → `.git/sdd/visual-<slug>/draft-R1.md` (`<tarefas>`); R2 → `draft-R2.md` (`<tarefas>`).

## Interfaces (nomes exatos)

### Task `<N>` — `<título>`

- **`<caminho>`:**
  ```ts
  export function <Nome>(props: <Props>): <Retorno>;
  ```
- Props, tokens novos (`--<token>` e o utilitário `bg-<token>`), estados (`data-state`), textos de interface.
- Testes que a tarefa cria e os existentes que muda.

## Rascunho: o que entregar

Um arquivo markdown no caminho do seu pedido, com:
1. As tarefas no formato acima, completas, em ordem.
2. "Dúvidas para o controlador": conflitos entre spec, contrato e código; nomes que não existem.
3. "Arquivos lidos": a lista do que você leu.

A sua resposta final é curta: o caminho do rascunho, quantos passos e as dúvidas em uma linha cada.
~~~~

`.claude/skills/handoff-visual/templates/task-brief.md`:

~~~~markdown
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
com a linha final `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Relatório

Grave `.git/sdd/visual-<slug>/task-<N>-report.md` com: o sha do commit; os comandos rodados e a saída de cada um
(vermelho e verde, com a contagem de testes); os testes existentes que mudaram; os desvios do plano, com o porquê; as
dúvidas. A resposta final é curta: o sha, os testes (N passed) e os desvios em uma linha cada.
~~~~

`.claude/skills/handoff-visual/templates/review-brief.md`:

~~~~markdown
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
- Segmento novo em `src/app/(app)` tem o espelho no `@detalhe`.
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
~~~~

`.claude/skills/handoff-visual/templates/final-review-brief.md`:

~~~~markdown
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
~~~~

`.claude/skills/handoff-visual/templates/pixel-brief.md`:

~~~~markdown
# Pixel perfect do visual de `<slug>` (`feat/visual-<slug>`, <data>)

Você conduz o passe de pixel: compara o protótipo renderizado com o app, estado por estado, e corrige o que difere.
A referência é o protótipo renderizado (`.git/sdd/visual-<slug>/ref/`), nunca as screenshots do handoff.

## Ambiente (um servidor e um navegador por vez)

1. Portas livres: `netstat -ano | grep -E ':(3202|54332)\s' | grep LISTEN` (de pé com o banco visual, o script avisa e
   segue).
2. Banco visual, em segundo plano: `bun run visual:db`.
3. App de produção, em segundo plano: `. scripts/visual/env.sh && bun run build && bunx next start -p 3202` (para
   iterar numa correção, `. scripts/visual/env.sh && bunx next dev -p 3202`; os números finais são do build).
4. Mundo e pessoas, só na primeira vez (o banco visual fica em disco e é compartilhado entre as branches):
   `bun run visual:seed base` e `bun run visual:people`; depois, `bun run visual:seed avatars`. O estado de cada par o
   `visual:pairs` (e o `measure`, o `probe` e o `interact`) semeia sozinho.
5. Cópias do protótipo: `bun run visual:proto --config=visual-<slug>/proto.config.mjs` (sem sobra da lista).

## Pares

- A configuração da tela é `scripts/visual/screens/<slug>.mjs`: estados (semente, setor, pessoa, tema, caminho,
  larguras, cópia, passos), `patch` e `masks` do que depende do agora, regiões.
- Antes de mexer: `bun run visual:pairs --screen=<slug> --out=visual-<slug> --sufixo=-antes`.
- Cada estado × 1440×900 e 390×844 × escuro e claro, mais:
  - a terceira largura, entre os cortes de área útil da tela (`<largura>`), só nos estados cujo layout muda no corte;
  - a tela com a sidebar recolhida, em um estado;
  - os estados de interação e de falha, com os passos (`click`, `hover`, `focus`, `tab`, `drag`, `failRequests`…) dos
    dois lados.
- Diferença acima da meta: `node scripts/visual/measure.mjs --screen=<slug> --state=<estado> --width=<L> --out=visual-<slug>` (caixa,
  tipografia, cor, raio e padding pelo texto), `node scripts/visual/sbs.mjs` (protótipo, app e diferença empilhados com
  zoom), `node scripts/visual/crop.mjs` e `node scripts/visual/probe.mjs --out=visual-<slug>` (uma expressão nas duas
  páginas; `--app-only` dispensa o `--out`).
- As correções saem como `fix(visual): …`, uma por causa, com o teste. Divergência que pede escolha (ícone, texto,
  comportamento) vai ao dono; texto diferente entre os lados é defeito da cópia ou do seed.
- Regressão: mexeu numa peça de outra tela? Rerode os pares da tela dona dela (ex.: `--screen=inicio`).

## Meta e resíduos

- Até cerca de 0,1 a 0,2% por par, com a mesma altura nos dois lados.
- Resíduos aceitos, cada um com a causa: anti-aliasing do texto, versão do lucide, truncamento intencional, a gaveta em
  escala de cinza.

## Saída

`.git/sdd/visual-<slug>/pixel.md`:

| Par | Largura | Tema | Antes | Depois | Altura (app / protótipo) | O que sobra e por quê |
|---|---:|---|---:|---:|---|---|

Mais: os commits de correção, as decisões pedidas ao dono e os servidores derrubados pelo PID no fim. A resposta
final é curta: o maior par, quantos commits e as decisões pendentes.
~~~~

`.claude/skills/handoff-visual/templates/legibilidade-brief.md`:

~~~~markdown
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
~~~~

`.claude/skills/handoff-visual/templates/pr-body.md`:

~~~~markdown
## Resumo

Visual novo de **`<slug>`**, a partir do handoff do Claude Design (spec
`docs/superpowers/specs/<data>-visual-<slug>-design.md`, plano `docs/superpowers/plans/<data>-visual-<slug>.md`),
sobre a `main` em `<base>`.

```text
<caminho>   # o que mudou ali, numa linha
```

## Decisões

- **`<decisão>`** (dono | controlador): `<o que e por quê>`.

## Desvios da spec

- `<desvio>`: `<por quê; onde está registrado>`.

## Pixel perfect

Contra o protótipo renderizado, com `pixelmatch` (threshold 0.1) e as máscaras do que depende do agora.

| Par | 1440 | `<terceira>` | 390 |
|---|---:|---:|---:|
| `<estado>` | `<antes → depois>` | | |

Resíduos aceitos: `<anti-aliasing, lucide, truncamento>`.

## Plano de teste

- [x] `bun run check-types` e `bun run lint`
- [x] Vitest em partes: `<arquivos · testes>`
- [x] `bun run test:e2e`: `<N passed>`
- [x] `bun run build`
- [x] `bun run visual:names --range=main...HEAD`: 0
- [x] Legibilidade: `<telas e capturas>`, `<correções>`
- [ ] CI verde no PR

## Pendências

- Fechadas: `<Pnn>`. Com `Atualização`: `<Pnn>`. Novas: `<Pnn a Pmm>`.

## Merge

`<migração? ordem de deploy? o que o dono confere>`. O merge é do dono, com o CI verde.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
~~~~

- [ ] **Step 7: Rodar e ver passar**

Run: `bunx vitest run test/skillHandoffVisual.test.ts`
Expected: `Tests  38 passed (38)` com a lista do C0 presente (no CI: `37 passed | 1 skipped`). Se o caso "toda ferramenta
de scripts/visual citada existe" reprovar, o nome de um arquivo da T7 ou da T8 mudou: corrija a skill (ou o modelo), não
o teste.

- [ ] **Step 8: Formatar, tipos e lint**

```sh
bunx biome check --write test/skillHandoffVisual.test.ts
bun run check-types
bun run lint
```

Expected: sem erro (o Biome não lê `.md`).

- [ ] **Step 9: Commit**

Mensagem gravada com Write em `.git/sdd/processo/msg-task-9.txt`:

```text
docs(skill): handoff-visual, o processo das telas do Claude Design

As Etapas 0 a 11 do processo, cada uma com o critério de saída e os comandos
visual:*, as regras da máquina, onde cada lição do Início entra e oito
modelos (Global Constraints, contrato do plano, brief de tarefa, de revisão,
de revisão final, de pixel, de legibilidade e o corpo do PR). O teste confere
o frontmatter, os modelos e que todo comando e ferramenta citados existem.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

`git add .claude/skills/handoff-visual test/skillHandoffVisual.test.ts && git commit -F .git/sdd/processo/msg-task-9.txt`
Expected: o `pre-commit` imprime `check-names: nada da lista …` e o commit passa.

---

### Task 10: Documentos do processo (`AGENTS.md`, `library-docs.md §22`, `architecture.md`)

**Spec:** §5.1, §5.2, §7, §11 · **Redator:** R3 · **Depende de:** T1 a T9

**Files:**
- Modify: `AGENTS.md` (tabela "Comandos": os oito `visual:*` e a nota do `node`; "Skills disponíveis": `/handoff-visual`;
  o bloco gerado no topo fica como está)
- Modify: `.context/library-docs.md` (§22 nova, depois da §21 da T4 e antes de "Como adicionar uma biblioteca nova")
- Modify: `.context/architecture.md` (§10: a entrada `### 2026-11-27 — Processo visual (PR B)`, no fim do arquivo)

Testes existentes que mudam: nenhum. `grep -rln "AGENTS.md\|library-docs\|architecture.md" src test e2e` só acha
comentários (`src/app/rawColors.test.ts` e quatro arquivos de `src/`); nenhum teste lê esses documentos.

**Interfaces:**
- Consumes: os nomes de T1 a T9 (atalhos, arquivos, guardas, a skill).
- Produces: documentos. O C2 acrescenta à entrada do `architecture.md` as linhas "Desvios registrados" e "Verificado".

- [ ] **Step 1: Ler os três arquivos como estão depois da T9**

`AGENTS.md` (a tabela "Comandos" termina na linha do `db:hosts`; "Skills disponíveis" termina em `/remember restore`),
`.context/library-docs.md` (a §21 da T4, o bullet do `hydration.spec.ts` da T2 na §10 e as frases da T1 nas §1, §9, §10
e §14) e o fim de `.context/architecture.md` (a última entrada é `### 2026-11-27 — Visual novo do Início e do shell`, e a
última linha do arquivo é o `- **Verificado:** …` dela, que termina em "(host conferido pelo `db:hosts`).").

- [ ] **Step 2: `AGENTS.md`, a tabela "Comandos"**

Edite `AGENTS.md` (ferramenta Edit). Troque:

```markdown
| `bun run db:hosts` | mostra só o host do banco da aplicação e o das migrações (conferir antes do `db:migrate`) |

O CI (`.github/workflows/ci.yml`) roda `check-types`, `lint`, `test` e `test:e2e` em todo PR e
```

por:

```markdown
| `bun run db:hosts` | mostra só o host do banco da aplicação e o das migrações (conferir antes do `db:migrate`) |
| `bun run visual:db` | banco visual: PGlite em disco (`.git/sdd/visual-db/`), com as migrações, na porta 54332; idempotente. O app visual sobe com `. scripts/visual/env.sh` na porta 3202 |
| `bun run visual:seed <base \| state <tela>:<estado> [--setor=<nome>] \| reopen-invites \| avatars>` | o mundo visual, o estado de uma tela e os avatares, só com pessoas e textos inventados |
| `bun run visual:people` | cadastra Ana, Bruno, Carla e Diego Teste pela API do app visual |
| `bun run visual:proto --config=<caminho em .git/sdd>` | cópias do protótipo com pessoas, avatares e textos inventados; erro se sobrar um termo da lista de nomes |
| `bun run visual:pairs --screen=<tela> --out=<pasta em .git/sdd>` | pares protótipo × app (página e regiões), com a diferença e o `results.json` |
| `bun run visual:audit --screen=legibilidade --out=<pasta em .git/sdd>` | auditoria de legibilidade: contraste, alvo de toque, rolagem horizontal, borda de campo e fundo que some |
| `bun run visual:names --staged \| --range=main...HEAD \| --file=<caminho>` | nenhum termo de `.git/sdd/nomes-proibidos.txt` no diff, nas mensagens ou no arquivo; código 0 limpo, 1 achou, 2 lista ausente ou uso errado; nunca imprime o termo |
| `bun run visual:hooks [--remove]` | instala (ou tira) o `pre-commit` que roda o `visual:names --staged` |

As ferramentas de `scripts/visual/` gravam só em `.git/sdd/` e nunca rodam no CI; as que abrem o navegador são `.mjs`
e rodam com `node` (o Chromium do Playwright não abre pelo Bun no Windows): `node scripts/visual/<ferramenta>.mjs`.
Referência: `library-docs.md §22`; o processo: `/handoff-visual`.

O CI (`.github/workflows/ci.yml`) roda `check-types`, `lint`, `test` e `test:e2e` em todo PR e
```

- [ ] **Step 3: `AGENTS.md`, "Skills disponíveis"**

Troque:

```markdown
- `/remember restore` — ao voltar para uma feature de várias sessões.
```

por:

```markdown
- `/remember restore` — ao voltar para uma feature de várias sessões.
- `/handoff-visual` — para implementar um handoff do Claude Design (README, `.dc.html` e screenshots de uma tela), da
  abertura da branch ao PR.
```

Run:

```sh
grep -c "^| \`bun run visual:" AGENTS.md
git show HEAD:AGENTS.md | sed -n 1,9p > .git/sdd/processo/agents-topo.txt; sed -n 1,9p AGENTS.md | diff - .git/sdd/processo/agents-topo.txt && echo "topo igual"; rm .git/sdd/processo/agents-topo.txt
```

Expected: `8` e `topo igual` (o bloco do `next dev`, linhas 1 a 9, não mudou).

- [ ] **Step 4: `library-docs.md §22`**

Edite `.context/library-docs.md` (ferramenta Edit). Troque a linha `## Como adicionar uma biblioteca nova` por:

````markdown
## 22. Ferramentas do processo visual (`scripts/visual/`) · PR B

O motor da verificação visual das telas do Claude Design é versionado; tudo o que tem original do protótipo (mapa de
trocas, cópias, capturas e a lista de nomes) fica em `.git/sdd/`. O processo que usa as ferramentas é a skill
`/handoff-visual` (`.claude/skills/handoff-visual/`). Decisão: `architecture.md §10` (2026-11-27, "Processo visual").

- **Saída só em `.git/sdd/`.** O caminho sai de `git rev-parse --path-format=absolute --git-common-dir` mais `/sdd`
  (vale em worktree, onde `.git` é um arquivo), pelo `scripts/visual/paths.mjs`: todo destino passa por
  `assertInsideSdd`, e um `--out` fora dele sai com código 1. Duas exceções, declaradas: `registry.mjs` grava só
  `.context/ui-registry.md`, e `install-hooks.mjs` grava só o `pre-commit` de `git rev-parse --git-path
  hooks/pre-commit` (fora da árvore).
- **Node para o Chromium, Bun para o banco e o seed.** O Chromium do Playwright não abre pelo Bun no Windows: tudo o que
  abre navegador é `.mjs` rodado com `node` (os atalhos `visual:*` já chamam o certo); `db.ts` e `seed/*.ts` rodam com
  `bun`.
- **Portas fixas** (`config.mjs`): banco PGlite em `127.0.0.1:54332`, app em `localhost:3202`; outra URL de banco ou de
  app é recusada. As portas 3000 (outro projeto), 3200 e 54329 (E2E) e 3201 e 54331 (o dono) nunca são usadas.
- **Pessoas e textos inventados.** `scripts/visual/vocabulary.mjs` é a fonte única: Ana, Bruno, Carla e Diego Teste
  (`@example.com`, senha `senha-de-teste-123`), os setores ULD, Carga, Operações e Rampa, os turnos, itens, destinos e
  textos. O seed escreve com ele, e o mapa de trocas do protótipo troca os originais por ele: o pixel compara texto
  igual com texto igual. Texto novo entra ali, e nunca um texto do protótipo.
- **Puro tem teste** em `test/visual/*.test.ts` (o padrão `scripts/smokeChecks.mjs`): sem navegador, rede, servidor nem
  a lista de nomes (o caso que precisa dela usa `it.skipIf`); os testes não importam `pngjs` nem `pixelmatch` direto
  (usam `createPng` e as funções de `image.mjs` e `diff.mjs`). Os CLIs do git e do registro (`check-names`,
  `install-hooks`, `registry`, `registry-diff`) são testados num repositório temporário (`test/visual/tempRepo.ts`),
  sem a configuração global do git. **Nada mais das ferramentas roda no CI.**
- **Um servidor e um navegador por vez**; cada CLI fecha o navegador ao fim de cada estado. As capturas rodam com
  `reducedMotion: "reduce"` e esperam as animações terminarem.
- **Segredo:** o do ambiente visual é gerado em `.git/sdd/visual-db/secret` e só o `env.sh` o lê; nada o imprime.
- **devDependencies exatas:** `pixelmatch` e `pngjs` (§21), só em `scripts/visual/` e nos testes dele.

**Pastas fora do git:**

```
.git/sdd/
  nomes-proibidos.txt     lista de nomes, e-mails e textos dos protótipos (global, acumula por branch)
  visual-db/              banco visual compartilhado: pgdata/, secret, world.json, state.json, avatars.json
  processo/               o PR B: ledger, proto.config.mjs, proto/, pares/, interacoes/, legibilidade/, medidas/
  visual-<slug>/          cada branch de tela, com a mesma forma
```

**As ferramentas:**

| Ferramenta | O que faz | Como chamar |
|---|---|---|
| `paths.mjs`, `config.mjs`, `vocabulary.mjs` | caminhos conferidos; portas, URLs e argumentos; o vocabulário | importados |
| `db.ts` (bun) | PGlite em disco com as migrações de `./drizzle`, servido na 54332; porta de pé com o banco visual: avisa e sai 0 | `bun run visual:db` |
| `env.sh` | exporta `DATABASE_URL` e `DATABASE_URL_POOLED` (54332), `DATABASE_POOL_MAX=1`, `BETTER_AUTH_URL` (3202) e o segredo; esvazia social e Sentry | `. scripts/visual/env.sh` |
| `seed/index.ts` (bun) | `base` (`world.json`), `state <tela>:<estado> [--setor=<nome>]` (`state.json`), `reopen-invites`, `avatars` (`avatars.json`) | `bun run visual:seed …` |
| `people.mjs` | cadastra as 4 pessoas pela API, com o cookie do convite; "já existe" conta como sucesso | `bun run visual:people` |
| `proto.mjs` | cópias do protótipo: as trocas na ordem (erro pelo número da troca), os `default` do `data-props`, sobra de termo da lista = erro | `bun run visual:proto --config=<relativo a .git/sdd>` |
| `capture.mjs` | captura avulsa do app ou de uma cópia | `node scripts/visual/capture.mjs app <caminho> <LxA> <dark\|light> <saída> [pessoa]` · `… proto <arquivo> <LxA> <saída>` |
| `pairs.mjs` | semeia cada estado, roda os passos, captura os dois lados na mesma altura, mascara e mede página e regiões | `bun run visual:pairs --screen=<tela> --out=<pasta> [estado …] [--sizes=] [--sufixo=]` |
| `measure.mjs` | caixa, tipografia, cor, fundo, raio e padding pelo texto, app contra protótipo; `--so-proto` extrai os px do protótipo | `node scripts/visual/measure.mjs --screen=<tela> --state=<estado> --width=<L> --out=<pasta> [--root=<css>] [--all] [--so-proto]` |
| `probe.mjs` | avalia uma expressão nas duas páginas (ou só no app) depois dos passos: a prova por estilo computado | `node scripts/visual/probe.mjs --screen=<tela> --state=<estado> --width=<L> (--out=<pasta> \| --app-only) "<expressão>"` |
| `interact.mjs` | roda os passos (inclusive a falha de rede) e registra em `<pasta>/interacoes/<estado>-<L>.json`; código 1 se o `expect` do estado falhar | `node scripts/visual/interact.mjs --screen=<tela> --state=<estado> --out=<pasta> [--width=1440]` |
| `audit.mjs` | contraste de texto, alvo de toque abaixo de 860px, rolagem horizontal, borda de campo, fundo que some no do pai | `bun run visual:audit --screen=legibilidade --out=<pasta> [--only=] [--themes=] [--sizes=] [--dir=]` |
| `diff.mjs` | `pixelmatch` (threshold 0.1), recorte ao menor tamanho comum, máscaras iguais nos dois lados | `node scripts/visual/diff.mjs <a.png> <b.png> <saída.png> [máscaras.json]` |
| `sheet.mjs`, `sbs.mjs`, `crop.mjs` | folha de contato; protótipo, app e diferença empilhados com zoom; recorte em tamanho real | `node scripts/visual/<ferramenta>.mjs … --dir=<relativo a .git/sdd>` |
| `check-names.mjs`, `install-hooks.mjs` | a guarda de nomes e o hook (abaixo) | `bun run visual:names …` · `bun run visual:hooks [--remove]` |
| `registry.mjs`, `registry-diff.mjs` | uma entrada do registro; os cabeçalhos entre commits (abaixo) | `node scripts/visual/registry.mjs …` · `node scripts/visual/registry-diff.mjs …` |

Onde a tabela diz `--screen=<tela>`, vale também `--config=<arquivo relativo a .git/sdd>` (uma configuração de rascunho,
fora do git). O `pairs`, o `measure`, o `probe` e o `interact` semeiam o estado de cada par antes de abrir o app (o
`measure --so-proto` não abre o app nem semeia); o `audit` usa o estado que estiver no banco (semeie `geral:rico` antes).
O `visual:proto` lê os avatares do `.git/sdd/visual-db/avatars.json` (`bun run visual:seed avatars`).

**Configuração de tela:** `scripts/visual/screens/<tela>.mjs`, um `export default` validado por `validateScreen`
(`test/visual/screens.test.ts` valida todas e confere cada `seed` em `STATES`), com os estados, o `patch` e as `masks`
do que depende do agora, as regiões e a lista `audit`. Sem nenhum nome: o que identifica pessoa mora no mapa de trocas,
fora do git. Cada branch acrescenta `seed/states/<tela>.ts` e o registra em `seed/states/index.ts`. Os passos de
interação (`steps.mjs`): `click`, `hover`, `focus`, `tab`, `press`, `fill`, `drag`, `wait`, `waitFor`, `failRequests`,
`restoreRequests` e `sample`; a Server Action é `{ method: "POST", header: "next-action" }`.

**`check-names` e o hook** (spec §7):

- **A lista** (`.git/sdd/nomes-proibidos.txt`): uma entrada por linha; linha vazia e `#` não contam; `!<frase>` é
  permitida (sai do texto antes da busca: para a pessoa fictícia que contém um nome da lista). A busca ignora caixa e
  acento; palavra e frase casam só inteiras; e-mail (tem `@`) casa como trecho. Entram os nomes e e-mails do protótipo e
  das screenshots **e os textos operacionais** (descrições, frases, observações, itens e destinos próprios); a palavra
  genérica do domínio que já está no código (setor, ULD, pátio) fica de fora.
- **Os modos:** `--staged` (linhas acrescentadas e caminhos de `git diff --cached`: o `pre-commit`), `--range=<a>...<b>`
  (o diff da branch e as mensagens de `git log <a>..<b>`: o portão, `--range=main...HEAD`) e `--file=<caminho>` (o
  arquivo inteiro, ex.: uma cópia do protótipo).
- **A saída** é `arquivo:linha — termo nº N da lista (linha L)`, `caminho nº K do diff — …` ou `mensagem do commit
  <sha>, linha L — …`: **nunca o termo**, e o caminho que contém um termo vira o número dele. Códigos: 0 limpo, 1 achou,
  2 lista ausente ou vazia ou uso errado (a mensagem diz como criar a lista ou tirar o hook). Falso positivo vira uma
  linha `!<frase>`.
- **O hook:** `bun run visual:hooks` grava em `git rev-parse --git-path hooks/pre-commit` (respeita o `core.hooksPath`)
  o script `exec node scripts/visual/check-names.mjs --staged`, marcado com `# closery:check-names`; regravar é
  idempotente; um `pre-commit` sem a marca é recusado (código 1) e fica para juntar à mão; `--remove` apaga só o nosso.
  Um achado é texto a trocar, nunca hook a contornar.
- **Branch sem `scripts/visual/`** (uma branch antiga, ou a `main` antes do merge do PR B): o hook não acha o script e
  recusa o commit. Tire o hook antes de trocar para ela (`bun run visual:hooks --remove`) e reinstale ao voltar.
- **Testes:** `test/visual/names.test.ts` e `test/visual/installHooks.test.ts`.

**O registro:** `node scripts/visual/registry.mjs <Componente> historico "<frase>"` acrescenta a frase ao fim do
`Histórico` da entrada; `… <Componente> troca "<de>" "<para>"` troca um trecho que aparece uma vez só na entrada; os dois
recusam sumir ou criar um cabeçalho `###`. `node scripts/visual/registry-diff.mjs <base> [head]` compara os `###` do
`ui-registry.md` e os `####` do `pendencias.md` entre dois commits e sai com 1 se algum sumiu (um título renomeado
aparece como SUMIU e NOVO): é a conferência de toda revisão por tarefa. Teste: `test/visual/docs.test.ts`.

## Como adicionar uma biblioteca nova
````

- [ ] **Step 5: `architecture.md`, a entrada do PR B**

Edite `.context/architecture.md` (ferramenta Edit): acrescente ao fim do arquivo, depois da linha `- **Verificado:** …`
da entrada `### 2026-11-27 — Visual novo do Início e do shell`, uma linha vazia e o bloco abaixo. `old_string` = o fim
daquela linha (único no arquivo):

```markdown
A migração `0005` foi aplicada no banco de dev (host conferido pelo `db:hosts`).
```

`new_string` = a mesma frase, uma linha vazia e:

```markdown
### 2026-11-27 — Processo visual (PR B)

- **Decisão:** antes das branches de tela do roteiro (C a G), deixar pronto o que elas repetiriam à mão. Spec em `docs/superpowers/specs/2026-11-27-processo-visual-design.md` e plano em `docs/superpowers/plans/2026-11-27-processo-visual.md`.
  - Decisão do dono: **T3 do lote 0**, o PR B entra antes da branch de Passagens (o lote 0 foi aceito como recomendado). O **Motion** foi decidido no mesmo dia (fundação nesta branch) e entra por emenda, depois da Task 10.
  - Decisões desta branch (engenharia, levadas ao dono como ciência):
    - **PB-D1, espelho por segmento:** o `next dev` (16.4.6, validação estrita de rotas) dava 404 em `/entrar`, `/convite/<token>`, `/redefinir-senha` e `/privacidade` (P81), porque o `@detalhe/[...catchAll]` do grupo `(app)` era pendurado em toda rota e a poda estrita apagava as de fora do grupo. Sai o catch-all; entram nove páginas nulas, uma por segmento de primeiro nível de `(app)` (`admin`, `bem-vindo`, `conta`, `dashboard`, `passagens`, `solicitacoes`) e um `[...rest]` onde o segmento tem subrotas. A produção não muda: o Sheet do detalhe rápido continua pela interceptação e fecha ao navegar. Recusadas: `(app)/default.tsx` (cria `/[...catchAll]` e engole a URL desconhecida), o slot no layout raiz (muda a árvore de produção), `deprecated.looseRouteMatching` (esconde o defeito) e fechar o Sheet pelo `usePathname` (muda o mecanismo que o E2E prova). Regra nova: rota de primeiro nível nova em `(app)` ganha o espelho.
    - **PB-D2, o validador do Next no Vitest:** `src/app/routeStructure.test.ts` roda o `normalizeCatchAllRoutes` do Next com `strictRouteMatching` sobre a árvore real e sobre uma sintética igual à de antes (a causa documentada em teste).
    - **PB-D3, motor no git, originais fora:** `scripts/visual/` é versionado; o mapa de trocas, as cópias, as capturas e a lista de nomes ficam em `.git/sdd/`, achado por `git rev-parse --git-common-dir`; toda saída vai para lá, e outro destino é recusado (exceções: o `registry.mjs` e o `install-hooks.mjs`).
    - **PB-D4, mundo visual inventado:** `scripts/visual/vocabulary.mjs` (pessoas, setores com Rampa como o quarto, turnos, itens, destinos e textos) é usado igual pelo seed e pelas cópias do protótipo.
    - **PB-D5, configuração de tela versionada:** `scripts/visual/screens/<tela>.mjs`, sem nenhum nome.
    - **PB-D6, capturas com movimento reduzido:** `reducedMotion: "reduce"` e espera das animações (a regra de pixel da decisão do Motion).
    - **PB-D7, o `check-names` não imprime o termo:** só o número da linha da lista; lista ausente ou vazia reprova.
    - **PB-D8, `bg-muted` vira `bg-accent`** com a mesma opacidade e variante nos estados e rodapés que sumiam dentro de cartão, diálogo e Sheet (P83); fica uma exceção, o `bg-muted/30` do `RequestColumn` (sobre o fundo da página, até a branch E). Um desvio da mesma opacidade: o cartão da `AdminOverview` vai a `group-hover:bg-accent` opaco, porque `accent/50` sobre a página escura dá exatamente o `--card` (caso negativo no `themeContrast.test.ts`).
    - **PB-D9, divisão do plano:** o `check-names`, o hook e as ferramentas do registro ficaram com o redator da skill.
  - Guardas novos: `src/app/routeStructure.test.ts`, `src/app/mutedBackground.test.ts`, `e2e/hydration.spec.ts` (com o verificador puro `test/hydrationCheck.ts`), o `pre-commit` local do `check-names` e os testes puros de `test/visual/`.
  - devDependencies novas, **exatas**: `pixelmatch` 7.2.0 e `pngjs` 7.0.0, só em `scripts/visual/` e nos testes dele (`library-docs.md §21`). As ferramentas e as regras delas: `library-docs.md §22`. O processo: a skill `handoff-visual` (`.claude/skills/handoff-visual/`, com oito modelos).
- **Por quê:** no Início, o que custou foi o trabalho do controlador depois da execução (cerca de 5h50 contra 1h25 das tarefas), com ferramentas escritas à mão, fora do git, que copiavam texto do protótipo; o `next dev` não servia as páginas de entrada; a duplicação do conteúdo pelo `next-themes` custou duas horas e meia sem nenhum guarda que a apontasse; e 4 dos 7 commits de legibilidade eram `bg-muted` dentro de cartão. As cinco branches seguintes repetiriam tudo isso.
- **Trade-offs aceitos:**
  1. O guarda de rotas importa dois módulos internos do Next (caminhos fixados na 16.4.6, `library-docs.md §1`). Numa atualização o import quebra com mensagem clara, e a árvore sintética avisa se o comportamento do validador mudar.
  2. A guarda de nomes é local: a lista tem nomes reais e não pode ir para o CI. Valem o `pre-commit` e o `--range=main...HEAD` no portão de cada branch. Numa branch sem `scripts/visual/`, o hook não acha o script e recusa o commit: tire-o antes (`bun run visual:hooks --remove`).
  3. As ferramentas nunca rodam no CI (C-V7: sem teste de screenshot); só os testes puros delas.
  4. Rota nova de primeiro nível em `(app)` exige o espelho no slot; o guarda reprova o esquecimento.
```

O C2 acrescenta, no fim desta entrada, as linhas `- **Desvios registrados:** …` e `- **Verificado:** …`.

- [ ] **Step 6: Conferir, tipos e lint**

```sh
grep -n "^## 2[12]\. \|^## Como adicionar" .context/library-docs.md
grep -c "^### 2026-11-27 — Processo visual (PR B)" .context/architecture.md
bun run check-types
bun run lint
bunx vitest run test/skillHandoffVisual.test.ts test/pendenciasDoc.test.ts test/uiRegistryDoc.test.ts
```

Expected: `## 21. …`, `## 22. Ferramentas do processo visual (…)` e `## Como adicionar uma biblioteca nova`, nesta ordem;
`1`; tipos e lint sem erro; os três testes verdes (nenhum deles muda nesta tarefa).

- [ ] **Step 7: Commit**

Mensagem gravada com Write em `.git/sdd/processo/msg-task-10.txt`:

```text
docs: processo visual no AGENTS, library-docs e architecture

AGENTS.md ganha os oito atalhos visual:* (uma linha cada), a nota de que as
ferramentas de navegador rodam com node e a skill /handoff-visual.
library-docs.md §22 descreve as ferramentas de scripts/visual: saída só em
.git/sdd, portas, vocabulário inventado, testes puros, check-names e o hook.
architecture.md registra as decisões PB-D1 a PB-D9 e as duas
devDependencies exatas.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

`git add AGENTS.md .context/library-docs.md .context/architecture.md && git commit -F .git/sdd/processo/msg-task-10.txt`
Expected: o `pre-commit` passa (`check-names: nada da lista …`).

---

### Task C1: Prova (controlador)

**Spec:** §13, §15 · **Redator:** R3 (texto) / controlador · **Depende de:** T1 a T10 e a emenda do Motion ·
**Commit:** nenhum (resultado em `.git/sdd/processo/pixel.md`)

**Files** (todos fora do git, em `.git/sdd/processo/`): Create `proto.config.mjs`, `tabela-pixel.mjs`, `hover.js`,
`pixel.md`; as saídas `proto/`, `pares/`, `interacoes/`, `legibilidade/`, `medidas/`, `avulsas/` e os logs `db.log`,
`dev.log`, `build.log`, `app.log`, `pairs.log`.

**Interfaces:**
- Consumes: os oito `visual:*`, `node scripts/visual/interact.mjs` e `probe.mjs` (T8), `scripts/visual/screens/inicio.mjs`
  (T7), `screens/provas.mjs` e `screens/legibilidade.mjs` (T8), o `results.json` do `pairs.mjs` (chave
  `<estado>-<largura><sufixo>`, `{ pct, size, natural: { app, proto }, regions: { cartao }, … }`, `pct` em porcento, como
  no PR A), o JSON do `interact.mjs` (`{ state, width, expect, app: { failed, samples, notes }, proto, at }`), o hook
  (C0 Step 5), a sentinela da lista (C0 Step 2) e as conferências manuais das tarefas (T1 Step 14, T5 Step 24, T7
  Step 27, T8 Step 20).
- Produces: `.git/sdd/processo/pixel.md` (a tabela da spec §15.2 e as provas de §13.4 a §13.8), lido pelo C2 e pela revisão.

Regras deste passo: um servidor e um navegador por vez; os comandos longos rodam em segundo plano (`run_in_background`)
e se acompanham pelo log; os comandos com caminho `.git/sdd/…` rodam da raiz do checkout principal.

- [ ] **Step 1: O 404 do `next dev` (spec §15.1)**

```sh
git status --short                                             # vazio
netstat -ano | grep -E ':(3202|54332)\s' | grep LISTEN         # vazio
```

Em segundo plano: `bun run visual:db > .git/sdd/processo/db.log 2>&1`. Espere a mensagem de pronto do `db.ts` no log.
Depois (primeiro plano): `bun run visual:seed base` (com o banco visual já semeado numa rodada anterior, ele sai com 1 e
diz isso: siga). Em segundo plano:
`. scripts/visual/env.sh && bun run fonts && bunx next dev -p 3202 > .git/sdd/processo/dev.log 2>&1` (o `bun run fonts`
é o `predev` que o `bunx next dev` pula). Quando o log mostrar `Ready` (é a conferência do T1 Step 14):

```sh
for p in /entrar /redefinir-senha /privacidade /convite/token-de-teste /nao-existe; do curl -s -o /dev/null --max-time 180 -w "%{http_code} $p\n" "http://localhost:3202$p"; done
grep -c "do not match any complete route" .git/sdd/processo/dev.log
```

Expected: `200 /entrar`, `200 /redefinir-senha`, `200 /privacidade`, `200 /convite/token-de-teste` (o convite inválido
renderiza a página dele; o que se prova é que a rota casa), `307 /nao-existe` (o `proxy.ts` manda o anônimo para
`/entrar`, como hoje: a URL desconhecida não ganhou rota) e `0`. Derrube o dev pelo PID:
`netstat -ano | grep -E ':3202\s' | grep LISTEN` → `taskkill //F //T //PID <pid>`; a porta 3202 fica vazia.

- [ ] **Step 2: Build de produção e app (spec §13.1)**

Primeiro plano, até 10 min: `. scripts/visual/env.sh && bun run build > .git/sdd/processo/build.log 2>&1; echo "código: $?"`
→ `código: 0` (o `prebuild` baixa ou confere a Satoshi). Em segundo plano:
`. scripts/visual/env.sh && bunx next start -p 3202 > .git/sdd/processo/app.log 2>&1`. Depois:

```sh
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3202/api/health
bun run visual:people
bun run visual:seed avatars
```

Expected: `200`; `ana: cadastrada` … `diego: cadastrada` (ou "já existe"); `avatares: ana, bruno, carla, diego` e o
`avatars.json` escrito. O `avatars` lê os ids das pessoas no banco, pelos e-mails (T5), e não precisa de um `state`
antes (a ordem da spec §13.1). Cada ferramenta do Step 4 em diante semeia o estado dela sozinha (o `audit`, não).

- [ ] **Step 3: As cópias do Início (spec §13.2)**

Escreva `.git/sdd/processo/proto.config.mjs` com a ferramenta Write. Ele contém os originais do protótipo: **fica fora do
git e nunca é colado em chat, brief ou commit**. Porte as trocas de `.git/sdd/visual/tools/mkproto.mjs` e
`mkproto-correcoes.mjs`, na mesma ordem, trocando cada valor fictício escrito à mão pelo do `ctx` e cada texto
operacional pelo do vocabulário (spec §5.4). A forma:

```js
// .git/sdd/processo/proto.config.mjs — FORA DO GIT: tem os originais dos dois handoffs do Início.
export default {
  out: "processo/proto",
  sources: [
    {
      file: "visual/handoff/Inicio.dc.html",
      support: ["support.js"],
      replacements: (ctx) => [
        // As trocas do mkproto.mjs, na ordem, cada uma [original, troca]:
        // 1. avatares: cada URL de api.dicebear.com do protótipo → ctx.avatars.<pessoa>
        // 2. pessoas: o nome completo e o primeiro nome → ctx.people.<pessoa>.name (e o primeiro nome dele)
        // 3. e-mails → ctx.people.<pessoa>.email
        // 4. a data do eyebrow → a de hoje em São Paulo (a partir de ctx.now)
        // 5. setores: a lista na ordem do app (alfabética, com Rampa no lugar do quarto setor) e o índice do selecionado
        // 6. "Parada há N dias" → o mínimo do app (mais de 72 h: 3 dias)
        // 7. textos operacionais → ctx.vocabulary.texts (pendingNextShift, staleRequests, recentRequests) e
        //    ctx.vocabulary.destinations, exatamente como o seed `inicio:*` os escreve (ctx.vocabulary também tem
        //    sectors, shifts e items: o motor da T7 monta { sectors, shifts, items, destinations, texts })
      ],
      copies: {
        // os seis estados do PR A que o pack não tocou; props = os defaults de STATES no mkproto.mjs
        "proto-admin-escuro": { props: {}, extra: [] },
        "proto-admin-claro": { props: {}, extra: [] },
        "proto-primeiro-escuro": { props: {}, extra: [] },
        "proto-primeiro-claro": { props: {}, extra: [] },
        "proto-continuar": { props: {}, extra: [] },
        "proto-sem-turnos": { props: {}, extra: [] },
      },
    },
    {
      file: "visual/handoff-correcoes/<o .dc.html do pack>",
      support: ["<os arquivos de apoio do pack>"],
      replacements: (ctx) => [
        // as trocas do mkproto-correcoes.mjs, na ordem, com o mesmo ctx
      ],
      copies: {
        // os quatro estados do pack; props = os do mkproto-correcoes.mjs
        "proto-entregue-escuro-uld": { props: {}, extra: [] },
        "proto-confirmada-escuro-uld": { props: {}, extra: [] },
        "proto-entregue-claro-carga": { props: {}, extra: [] },
        "proto-confirmada-claro-operacoes": { props: {}, extra: [] },
      },
    },
  ],
  leftovers: ["api.dicebear.com"],
};
```

Depois:

```sh
bun run visual:proto --config=processo/proto.config.mjs; echo "código: $?"
for f in .git/sdd/processo/proto/*.html; do bun run visual:names --file="$f" > /dev/null 2>&1 || echo "SOBRA: $f"; done; echo "conferido"
```

Expected: as dez cópias listadas e `código: 0`; só `conferido` (nenhuma linha `SOBRA:`). Uma troca que falha sai com o
número dela (spec §5.6): corrija o mapa, nunca a cópia.

- [ ] **Step 4: Os pares do Início (spec §13.3)**

Em segundo plano (19 pares; vários minutos): `bun run visual:pairs --screen=inicio --out=processo > .git/sdd/processo/pairs.log 2>&1`.
Ao fim, escreva `.git/sdd/processo/tabela-pixel.mjs` com a ferramenta Write:

```js
// Tabela do C1 (spec §15.2): os pares do Início pelas ferramentas permanentes
// contra os números do PR A. Fora do git. Uso: node .git/sdd/processo/tabela-pixel.mjs
import { readFileSync } from "node:fs";

const RESULTS = new URL("./pares/results.json", import.meta.url);

// [página, cartão] do PR A, em porcento (spec §15.2); null = o par não tem a região cartao.
const REFERENCE = {
  "admin-escuro-1440": [0.001, null],
  "admin-escuro-390": [0.073, null],
  "admin-claro-1440": [0.0, null],
  "admin-claro-390": [0.066, null],
  "primeiro-escuro-1440": [0.054, null],
  "primeiro-escuro-390": [0.069, null],
  "primeiro-claro-1440": [0.054, null],
  "primeiro-claro-390": [0.062, null],
  "continuar-1440": [0.001, null],
  "continuar-390": [0.107, null],
  "sem-turnos-1440": [0.001, null],
  "sem-turnos-390": [0.103, null],
  "menu-390": [0.214, null],
  "entregue-escuro-uld-1440": [0.001, 0.0],
  "entregue-escuro-uld-390": [0.093, 0.0],
  "confirmada-escuro-uld-1440": [0.001, 0.001],
  "confirmada-escuro-uld-390": [0.092, 0.002],
  "entregue-claro-carga-1440": [0.0, 0.0],
  "confirmada-claro-operacoes-1440": [0.0, 0.001],
};
const PAGE_MARGIN = 0.02; // pontos percentuais acima do PR A
const PAGE_CEILING = 0.11; // teto da página (o menu aberto: 0,22)
const MENU_CEILING = 0.22;
const CARD_CEILING = 0.005;
const EPSILON = 1e-9;

const results = JSON.parse(readFileSync(RESULTS, "utf8"));
const pct = (value) =>
  value === null || value === undefined
    ? "—"
    : `${value.toFixed(3).replace(".", ",")}%`;
const signed = (value) =>
  `${value < 0 ? "−" : "+"}${Math.abs(value).toFixed(3).replace(".", ",")} pp`;

let failures = 0;
console.log(
  "| Par | PR A | PR B | Diferença | Altura (app / protótipo) | Cartão (PR A → PR B) | Na faixa |",
);
console.log("|---|---:|---:|---:|---|---|---|");
for (const [key, [page, card]] of Object.entries(REFERENCE)) {
  const result = results[key];
  if (!result) {
    failures++;
    console.log(`| ${key} | ${pct(page)} | ausente | | | | ✗ |`);
    continue;
  }
  const ceiling = key.startsWith("menu-") ? MENU_CEILING : PAGE_CEILING;
  const pageOk = result.pct <= Math.min(page + PAGE_MARGIN, ceiling) + EPSILON;
  const cardNow = result.regions?.cartao ?? null;
  const cardOk =
    card === null || (cardNow !== null && cardNow <= CARD_CEILING + EPSILON);
  const heightOk = result.natural?.app === result.natural?.proto;
  const ok = pageOk && cardOk && heightOk;
  if (!ok) failures++;
  const cardText = card === null ? "—" : `${pct(card)} → ${pct(cardNow)}`;
  console.log(
    `| ${key} | ${pct(page)} | ${pct(result.pct)} | ${signed(result.pct - page)} | ${result.natural?.app} / ${result.natural?.proto} | ${cardText} | ${ok ? "✓" : "✗"} |`,
  );
}
console.log(
  `\n${failures === 0 ? "Todos os pares na faixa." : `${failures} par(es) fora da faixa ou ausente(s).`}`,
);
process.exitCode = failures === 0 ? 0 : 1;
```

Run: `node .git/sdd/processo/tabela-pixel.mjs; echo "código: $?"`
Expected: a tabela com os 19 pares, todos `✓`, `Todos os pares na faixa.` e `código: 0`. Par fora da faixa: investigue
com `node scripts/visual/measure.mjs --screen=inicio --state=<estado> --width=<L> --out=processo` e `node scripts/visual/sbs.mjs` antes
de aceitar (spec §14: texto diferente entre os lados é defeito da cópia ou do seed); o que mudar no código sai como
`fix(visual): …` com teste, e os pares rodam de novo.

- [ ] **Step 5: A falha de rede (spec §13.4)**

O `interact` semeia sozinho o estado do `screens/provas.mjs` (`inicio:primeiro`) antes de abrir o app.

```sh
node scripts/visual/interact.mjs --screen=provas --state=falha-de-rede --out=processo; echo "código: $?"
node -e "const r=JSON.parse(require('fs').readFileSync('.git/sdd/processo/interacoes/falha-de-rede-1440.json','utf8')); console.log(r.app.failed.length, r.app.failed.map((f)=>f.method+' '+f.error).join('; '))"
```

Expected: o `interact` imprime `falhou: POST http://localhost:3202/ (net::ERR_FAILED)` e `requisições falhadas: 1
(esperado ao menos 1)`, e `código: 0`; o `node -e` imprime `1 POST net::ERR_FAILED` (pelo menos uma; o método é `POST`;
o registro do app fica em `app.failed`). Abra a captura
`.git/sdd/processo/interacoes/falha-de-rede-1440-app.png` (Read): o cartão "Convide sua equipe" continua na tela.

- [ ] **Step 6: Os hovers (spec §13.5)**

Escreva `.git/sdd/processo/hover.js` com a ferramenta Write (a expressão que o `probe` avalia no app depois dos passos do
estado: o alvo mais fundo sob o mouse e o primeiro ancestral de fundo opaco):

```js
(() => {
  const alpha = (color) => {
    const rgb = /rgba?\(([^)]+)\)/.exec(color);
    if (rgb) {
      const parts = rgb[1].split(",");
      return parts.length === 4 ? Number(parts[3]) : 1;
    }
    const slash = /\/\s*([\d.]+)(%?)\s*\)$/.exec(color);
    if (!slash) return 1;
    return slash[2] === "%" ? Number(slash[1]) / 100 : Number(slash[1]);
  };
  const bg = (el) => getComputedStyle(el).backgroundColor;
  const hovered = [...document.querySelectorAll(":hover")].reverse();
  const target = hovered.find((el) =>
    el.matches("button, a, [role=button], [data-slot]"),
  );
  if (!target) return { erro: "nada sob o mouse" };
  let parent = target.parentElement;
  while (parent && alpha(bg(parent)) < 1) parent = parent.parentElement;
  return {
    alvo: `${target.tagName.toLowerCase()}[${target.getAttribute("data-slot") ?? ""}]`,
    fundo: bg(target),
    pai: parent ? bg(parent) : null,
    diferente:
      parent !== null && alpha(bg(target)) > 0 && bg(target) !== bg(parent),
  };
})()
```

Depois (o `probe` semeia sozinho o `geral:rico` de cada estado):

```sh
for s in hover-outline-em-cartao hover-ghost-em-cartao hover-statlink; do node scripts/visual/probe.mjs --screen=provas --state=$s --width=1440 --app-only "$(cat .git/sdd/processo/hover.js)"; done
```

Expected: três linhas `APP {"alvo":"…","fundo":"…","pai":"…","diferente":true}`, com `fundo` diferente de `pai` em cada
uma. `diferente: false` é o P83 de volta: defeito a corrigir antes do C2. O `outline` e o `ghost` rodam no **claro**
(`screens/provas.mjs`): lá o hover é `bg-accent` opaco, e o `bg-muted` de antes daria o próprio card (`diferente: false`);
no escuro o `outline` usa `dark:hover:bg-input/50` (a T3 não o muda) e o `ghost` usa `accent/50`, cuja string sempre
difere da do pai, e a sonda não distinguiria o antes do depois. O `StatLink` roda no escuro (`hover:bg-accent` opaco).

- [ ] **Step 7: Legibilidade das telas tocadas pelo §9 (spec §13.6)**

O `audit` não semeia: o estado é o que estiver no banco. As telas: as que têm `Button outline`/`ghost`, tabela, rodapé de
cartão ou de diálogo, o Dashboard e a Administração (com `admin-destinos`, a tela da sonda do `outline`). Confira a
lista com `grep -rln "CardFooter\|DialogFooter\|TableRow\|BarList\|StatLink\|AdminOverview" src/components src/app` e
acrescente a tela que faltar (os nomes são os do `audit` de `scripts/visual/screens/legibilidade.mjs`).

```sh
bun run visual:seed state geral:rico
bun run visual:audit --screen=legibilidade --out=processo --only=conta,passagem-corrigida,solicitacoes-quadro,solicitacoes-tabela,solicitacao-sheet,dashboard,dashboard-operador,admin,admin-equipe,admin-itens,admin-destinos --themes=dark,light; echo "código: $?"
```

Expected: `código: 0` e, no `.git/sdd/processo/legibilidade/audit.json`, nenhum achado de contraste ou de fundo que some
que o PR A não tinha nas mesmas telas, temas e larguras (compare com `.git/sdd/visual/legibilidade-depois/audit.json` e,
para as telas que o PR A não recapturou, `.git/sdd/visual/legibilidade/audit.json`). Achado novo é defeito: `fix(visual):
<tela> …` com teste, e o passo roda de novo.

- [ ] **Step 8: As conferências manuais das tarefas**

As linhas das conferências manuais da T5 (Step 24), da T7 (Step 27) e da T8 (Step 20) que os Steps 1 a 7 não cobriram;
cada `Expected` é o do passo de origem. Ainda com o banco e o `next start` de pé:

```sh
# T5 Step 24: idempotência, recusas e --setor
bun run visual:db; echo "código: $?"                       # já de pé: avisa e sai 0
bun run visual:db --port=54331; echo "código: $?"          # porta recusada, código 1
bun run visual:seed base; echo "código: $?"                # já tem setores, código 1
bun run visual:people; echo "código: $?"                   # "… já existe" nas quatro, código 0
bun run visual:seed state inicio:entregue --setor=Carga    # state.json com sector "Carga"
bun run visual:seed state inicio:nada; echo "código: $?"   # estado desconhecido, com a lista, código 1
# T7 Step 27: captura avulsa e recusa, o par do menu com sufixo e o diff.mjs
bun run visual:seed state inicio:admin
node scripts/visual/capture.mjs app "/?setor=<id do ULD em .git/sdd/visual-db/state.json>" 1440x900 dark processo/avulsas/inicio.png
node scripts/visual/capture.mjs app / 1440x900 dark ../../fora.png; echo "código: $?"
bun run visual:pairs --screen=inicio --out=processo menu --sufixo=-x
node scripts/visual/diff.mjs processo/pares/admin-escuro-1440-proto.png processo/pares/admin-escuro-1440-app.png processo/pares/conferencia-diff.png
# T8 Step 20: medida, folha de contato, pilha com zoom e recorte
node scripts/visual/measure.mjs --screen=inicio --state=entregue-escuro-uld --width=1440 --out=processo --root="main"
node scripts/visual/measure.mjs --screen=inicio --state=admin-escuro --width=1440 --out=processo --so-proto
node scripts/visual/sheet.mjs conta --dir=processo/legibilidade
node scripts/visual/sbs.mjs admin-escuro-390 0 0 390 120 3 --dir=processo/pares
node scripts/visual/crop.mjs conta-escuro-390.png 0 0 390 300 --dir=processo/legibilidade
git status --short                                          # vazio: nada fora de .git/sdd
```

Uma saída diferente do `Expected` de origem é defeito da ferramenta: `fix(visual): …` com teste (o puro) e a linha roda
de novo. O resumo vai para a seção "Conferências das ferramentas" do `pixel.md` (Step 11).

- [ ] **Step 9: O texto plantado (spec §13.7)**

```sh
sed -n '/^# sentinela/{n;p;q}' .git/sdd/nomes-proibidos.txt > plantado-c1.txt
git add plantado-c1.txt
git commit -m "teste do hook"; echo "código: $?"
bun run visual:names --staged; echo "código: $?"
git restore --staged plantado-c1.txt && rm plantado-c1.txt
git status --short
```

Expected: o `git commit` imprime `plantado-c1.txt:1 — termo nº N da lista (linha L)` (sem o texto) e `código: 1`; o
`visual:names --staged` imprime a mesma linha e `código: 1`; o `git status --short` sai vazio. **Se o commit passar** (o
hook falhou): `git reset -q --soft HEAD~1`, `git restore --staged plantado-c1.txt`, `rm plantado-c1.txt`, e investigue
antes de seguir (o commit de teste nunca vai para o push).

- [ ] **Step 10: O diff da branch (spec §13.8)**

Run: `bun run visual:names --range=main...HEAD; echo "código: $?"`
Expected: `check-names: nada da lista em … linha(s), … caminho(s) e … mensagem(ns).` e `código: 0`.

- [ ] **Step 11: `pixel.md`, servidores e ledger**

Grave `.git/sdd/processo/pixel.md` (ferramenta Write) com:

```markdown
# C1: prova do PR B (`chore/processo-visual`, <sha do HEAD>, <data>)

Build de produção (`next start -p 3202`), banco visual na 54332, Chromium do Playwright pelo `node`, `deviceScaleFactor` 1,
Windows. Pessoas e textos do `scripts/visual/vocabulary.mjs`.

## 404 do `next dev` (§15.1)
<as quatro páginas e o código de cada uma, o 307 do /nao-existe; a contagem do aviso no log>

## Pares do Início (§15.2)
<a tabela do tabela-pixel.mjs, colada>
<o que sobra em cada par acima de 0,05% e por quê>

## Falha de rede (§13.4)
<o registro: N requisições POST falhadas; a captura com o cartão>

## Hovers (§13.5)
<as três linhas APP>

## Legibilidade das telas tocadas (§13.6)
<as telas, os temas, a comparação com o PR A>

## Conferências das ferramentas (T5, T7, T8)
<cada linha do Step 8 e se bateu com o Expected de origem>

## Texto plantado (§13.7) e diff da branch (§13.8)
<os códigos de saída>

## Commits de correção feitos no C1
<sha e resumo, ou "nenhum">
```

Derrube os servidores pelo PID: `netstat -ano | grep -E ':(3202|54332)\s' | grep LISTEN` → `taskkill //F //T //PID <pid>`
para cada um; a saída fica vazia. Linha no ledger: `2026-11-27 controlador: C1 feito; pixel.md gravado; <maior par>;
servidores derrubados`.

---

### Task C2: Documentos finais, portão e PR (controlador)

**Spec:** §11, §15 · **Redator:** R3 (texto) / controlador · **Depende de:** C1 ·
**Commit:** `docs: fecha o PR B (progresso, pendências e memória)`

**Files:**
- Modify: `.context/progress-tracker.md` ("▸ Próximo passo", a seção "Visual novo", a seção nova "Processo visual",
  "Histórico")
- Modify: `.context/pendencias.md` (P62 com `Atualização`; as pendências novas do C1, se houver; "Próximo id livre")
- Modify: `test/pendenciasDoc.test.ts` (o caso da P62 e, se houver, o das novas)
- Modify: `memory.md`
- Modify: `.context/architecture.md` (as linhas "Desvios registrados" e "Verificado" da entrada do PR B)
- Fora do git: `.git/sdd/processo/pr-body.md`; o roteiro `.git/sdd/roadmap/roteiro.md` §2 e §3 (depois do merge)

**Interfaces:**
- Consumes: `pixel.md` do C1, o ledger e os totais do portão.
- Produces: o PR.

- [ ] **Step 1: O portão (spec §15.6)**

Com os servidores visuais derrubados (memória), um comando por vez:

```sh
bun run check-types
bun run lint
bunx vitest run src/app
bunx vitest run src/components
bunx vitest run src/features
bunx vitest run src/lib
bunx vitest run src/db src/instrumentation.test.ts src/proxy.test.ts
bunx vitest run test
bun run test:e2e
bun run build
git ls-files '*.test.ts' '*.test.tsx' | wc -l
```

Expected: tudo verde; a soma dos arquivos das seis partes do Vitest é igual ao último número (352 antes desta branch, mais
os arquivos de teste novos dela); o E2E inclui o `hydration.spec.ts`, as Solicitações (b) e (e) e o "Página não
encontrada". Anote os totais (arquivos e testes do Vitest, cenários do E2E): entram nos documentos abaixo.

- [ ] **Step 2: `pendencias.md`**

Ferramenta Edit. Na P62, depois da linha `**Registrado em:** 2026-11-26`, acrescente a `Atualização`. `old_string` (as
duas últimas linhas da P62; a de `Correção` é só dela, e `**Registrado em:** 2026-11-26` sozinha aparece 19 vezes):

```markdown
**Correção:** — (opção: proteção da `main` com os checks `Tipos, lint e testes` e `E2E (Playwright)`, passo B1 do runbook, antes de ligar a Vercel)
**Registrado em:** 2026-11-26
```

`new_string` = as mesmas duas linhas e, logo abaixo:

```markdown
**Atualização (2026-11-27):** o processo das telas (skill `handoff-visual`, Etapa 11) manda o controlador conferir o CI verde do PR antes de pedir o merge, e o `pre-commit` local do `check-names` (PR B) só cuida de nomes. A proteção da `main` continua decisão do dono.
```

A P62 continua em "1. Aberto, não triado" (o índice não muda). Cada pendência nova que o C1 tiver aberto entra no fim da
seção "1. Aberto, não triado" e no índice, no formato do modelo, com `**Registrado em:** 2026-11-27`, e o
`**Próximo id livre: P<N>.**` sobe. Confira P81 e P83 em "5. Resolvido" (T1 e T3) e a `Atualização` da P44 (T1).

- [ ] **Step 3: `test/pendenciasDoc.test.ts`**

Ferramenta Edit: antes do `});` que fecha o `describe(".context/pendencias.md", …)`, depois do caso do P83 que a T3
pôs no fim. `old_string` (o fim do arquivo depois da T3):

```ts
    expect(p83?.updates, "P83").toContain("2026-11-27");
  });
});
```

`new_string` = as duas primeiras dessas linhas, uma linha em branco, o caso abaixo (e, se houver, o das novas) e o
`});` final:

```ts
  it("Processo visual: P62 ganhou a Atualização de 2026-11-27 e continua aberta", () => {
    const entry = entries.get("P62");
    expect(entry?.state).toBe("Aberto, não triado");
    expect(entry?.section).toBe("1");
    expect(entry?.updates).toContain("2026-11-27");
  });
```

Se o C1 abriu pendências novas (de `P<a>` a `P<b>`), acrescente também:

```ts
  it("Processo visual: P<a> a P<b> entraram como Aberto, não triado", () => {
    for (let number = <a>; number <= <b>; number++) {
      const id = `P${number}`;
      expect(entries.get(id)?.state, id).toBe("Aberto, não triado");
      expect(entries.get(id)?.section, id).toBe("1");
      expect(index.get(id), `${id}: índice`).toBe("Aberto, não triado");
    }
  });
```

Run: `bunx vitest run test/pendenciasDoc.test.ts` → verde.

- [ ] **Step 4: `progress-tracker.md`**

Ferramenta Edit, quatro trechos:

1. Em "▸ Próximo passo", troque o primeiro item (o do `feat/visual-inicio` "pronto para o PR depois do portão") por:

```markdown
- **2026-11-27 — Processo visual (branch `chore/processo-visual`, PR B) pronto para o merge.** O Início novo já está na
  `main` (PR #8). Depois do merge, a branch C (Passagens) começa pela skill `/handoff-visual`, que lê o roteiro (fora do
  git, `.git/sdd/roadmap/roteiro.md`: C Passagens, D Passagem de turno, E Solicitações, F detalhe da solicitação, G
  Dashboard). O go-live continua pendente: se o visual entrar antes dele, a migração `0005` vai no passo B4, antes do deploy.
```

2. Na seção `## Visual novo (Início e shell) · 🟡`: o título vira `· ✅`, e a linha `- ⬜ PR da \`feat/visual-inicio\` e o
   merge pelo dono` vira `- ✅ PR #8 (\`feat/visual-inicio\`) mergeado pelo dono (2026-11-27)`.

3. Antes de `## Histórico`, a seção nova:

```markdown
## Processo visual (PR B) · ✅

Spec em `docs/superpowers/specs/2026-11-27-processo-visual-design.md`, plano em
`docs/superpowers/plans/2026-11-27-processo-visual.md` e a decisão no `architecture.md §10` (2026-11-27, "Processo
visual (PR B)").

- ✅ 404 do `next dev` corrigido: o espelho do slot `@detalhe` por segmento, com o guarda que roda o validador do Next (`src/app/routeStructure.test.ts`); P81 resolvida, P44 com `Atualização` (2026-11-27)
- ✅ Guarda de hidratação: `e2e/hydration.spec.ts`, com o verificador puro `test/hydrationCheck.ts` (2026-11-27)
- ✅ `bg-muted` → `bg-accent` nos estados e rodapés dentro de cartão, com o guarda `src/app/mutedBackground.test.ts` e a exceção do `RequestColumn`; P83 resolvida (2026-11-27)
- ✅ Ferramentas visuais permanentes em `scripts/visual/` (banco 54332, app 3202, pessoas e textos inventados, cópias do protótipo, captura, diferença, pares, medida, sonda, interação com falha de rede, auditoria, recortes e registro), com `pixelmatch` 7.2.0 e `pngjs` 7.0.0 exatas e os testes puros em `test/visual/` (2026-11-27)
- ✅ `check-names` no `pre-commit` local e no portão (`--range=main...HEAD`), sem imprimir o termo (2026-11-27)
- ✅ Skill `handoff-visual` com os oito modelos (2026-11-27)
- ✅ <a linha da emenda do Motion, escrita pela emenda>
- ✅ Prova: os pares do Início pelas ferramentas permanentes (o maior, <par> com <N>%, dentro da faixa da spec §15.2), a falha de rede injetada, os três hovers com fundo diferente do pai e o texto plantado recusado pelo hook (`.git/sdd/processo/pixel.md`, fora do git) (2026-11-27)
- ✅ Testes: Vitest <N> testes em <M> arquivos (em seis partes); E2E com <K> cenários. Verificado: `check-types`, `lint`, `test`, `test:e2e` (<K> passed) e `build` verdes (2026-11-27)
- ⬜ PR da `chore/processo-visual` e o merge pelo dono
```

4. No fim de `## Histórico`:

```markdown
- **2026-11-27** — Processo visual (PR B): o 404 do `next dev` corrigido pelo espelho do slot `@detalhe`, as ferramentas visuais permanentes em `scripts/visual/`, as guardas de nomes, de hidratação e do `bg-muted`, e a skill `handoff-visual`; P81 e P83 resolvidas, P44 e P62 com `Atualização`. Plano em `docs/superpowers/plans/2026-11-27-processo-visual.md`.
```

- [ ] **Step 5: `architecture.md`, o fecho da entrada do PR B**

Ferramenta Edit: no fim da entrada `### 2026-11-27 — Processo visual (PR B)` (T10), acrescente as duas linhas abaixo.
`old_string` = a última linha que a T10 escreveu (a última do arquivo):

```markdown
  4. Rota nova de primeiro nível em `(app)` exige o espelho no slot; o guarda reprova o esquecimento.
```

`new_string` = a mesma linha e, logo abaixo:

```markdown
- **Desvios registrados:** <os desvios das tarefas, dos relatórios e do C1, cada um com o porquê; "nenhum" se não houve>.
- **Verificado:** `check-types`, `lint`, `test` (<N> testes em <M> arquivos, em seis partes), `build` e `test:e2e` (<K> passed) verdes em 2026-11-27. Os pares do Início pelas ferramentas permanentes ficaram dentro da faixa da spec §15.2 (o maior, <par> com <N>%), a falha de rede injetada derrubou a Server Action do "Agora não" e o cartão ficou na tela, os três hovers dentro de cartão mudam o fundo, e o hook recusou o texto plantado. P81 e P83 resolvidas; P44 e P62 com `Atualização`.
```

- [ ] **Step 6: `memory.md`**

Ferramenta Edit:

1. O título vira `# Memory — Fases 0 a 6 (código) prontas; Início novo na main; o processo visual (PR B) espera o merge; o go-live continua pendente`.
2. O conteúdo de `## Estado para a próxima sessão (2026-11-27)` (até antes de `## Onde o projeto está`) vira:

```markdown
- **Branch `chore/processo-visual` (PR B): pronta para o merge**, PR <link>. Ela traz: o espelho do slot `@detalhe` por
  segmento (o `next dev` volta a servir `/entrar`, `/convite`, `/redefinir-senha` e `/privacidade`; P81), o guarda que
  roda o validador de rotas do Next (`src/app/routeStructure.test.ts`), o `e2e/hydration.spec.ts`, o `bg-muted` → `bg-accent`
  com o guarda (P83), as ferramentas visuais permanentes em `scripts/visual/` (`library-docs.md §22`), o `check-names`
  no `pre-commit` e a skill `/handoff-visual` com os oito modelos. Decisões no `architecture.md §10` ("Processo visual (PR B)").
- **A próxima branch:** C, Passagens (`feat/visual-passagens`), criada da `main` atualizada depois do merge. Comece por
  `/handoff-visual`: ela lê o roteiro (`.git/sdd/roadmap/roteiro.md`), o mapa (`map-passagens.md`) e o ledger, nessa ordem.
- **A verificação visual agora é do repositório:** `bun run visual:db`, `. scripts/visual/env.sh`, `visual:seed`,
  `visual:people`, `visual:proto`, `visual:pairs`, `visual:audit`. O que ela ensinou continua valendo: o protótipo
  renderizado manda; os números finais saem do build de produção; foco, contraste e tamanho se provam por estilo
  calculado; o contraste se mede sobre cada fundo real e estado; nunca a porta 3000; nenhum nome nem texto do protótipo no git.
- **A lista de nomes** (`.git/sdd/nomes-proibidos.txt`, fora do git) acumula por branch: cada handoff novo acrescenta os
  nomes, e-mails e textos dele na Etapa 0.
- **Decisões esperando o dono:** <as que sobraram do lote 0 e das pendências, ex.: T20 (pedir ao designer as telas sem
  handoff, P82), P85, P86, P99, P100, P108>.
```

3. Em `## Onde o projeto está`, o parágrafo `**Visual novo do Início e do shell (2026-11-27, ainda na branch …)**` passa a
   começar por `**Visual novo do Início e do shell (2026-11-27, na main pelo PR #8).**`, e depois dele entra:

```markdown
**Processo visual (PR B, 2026-11-27).** O `next dev` serve as páginas de entrada de novo (o espelho do slot `@detalhe`).
A verificação visual das telas do Claude Design mora em `scripts/visual/` (banco 54332, app 3202, pessoas e textos
inventados, pares, auditoria e as guardas), descrita no `library-docs.md §22`, e o processo inteiro está na skill
`/handoff-visual`. O `pre-commit` local recusa qualquer termo da lista de nomes.
```

4. Em `## O que está esperando`, o primeiro item vira `- **Processo visual:** o merge do PR B (ver "Estado para a próxima sessão").`
5. Em `## Coisas que vão te morder se ninguém avisar`, acrescente:

```markdown
- **O `pre-commit` do `check-names` recusa commit numa branch sem `scripts/visual/`** (uma branch antiga): tire o hook
  antes de trocar para ela (`bun run visual:hooks --remove`) e reinstale ao voltar. Um achado do hook é texto a trocar
  por um inventado (`scripts/visual/vocabulary.mjs`), nunca motivo para contornar o hook.
```

6. Na mesma seção, o bullet do slot `@detalhe` ainda descreve o `[...catchAll]`, que o PR B tirou. `old_string`:

```markdown
- **Solicitações (Fase 4):** o detalhe rápido é o slot `@detalhe` do layout de `(app)`: ele **precisa** de
  `default.tsx`, `page.tsx` e `[...catchAll]/page.tsx` que só devolvem `null` (sem as duas páginas nulas o Sheet fica
  aberto sobre a tela seguinte) e **não** pode haver `(app)/default.tsx` (a URL desconhecida deixaria de dar 404).
```

`new_string`:

```markdown
- **Solicitações (Fase 4; o slot mudou no PR B):** o detalhe rápido é o slot `@detalhe` do layout de `(app)`: além de
  `default.tsx` e `page.tsx` (rota `/`), ele tem o **espelho por segmento**, uma página nula por segmento de primeiro
  nível de `(app)` e um `[...rest]` onde há subrotas (`library-docs.md §14`). Segmento novo ganha o espelho no mesmo
  commit, senão o Sheet fica aberto sobre a tela nova (o `routeStructure.test.ts` reprova). Nada de catch-all na raiz
  do slot (o `next dev` dava 404 fora de `(app)`, P81) e **não** pode haver `(app)/default.tsx` (a URL desconhecida
  deixaria de dar 404).
```

- [ ] **Step 7: Conferir e commitar os documentos**

```sh
bunx vitest run test/pendenciasDoc.test.ts test/uiRegistryDoc.test.ts
node scripts/visual/registry-diff.mjs main; echo "código: $?"
bun run lint
```

Expected: verdes; o `registry-diff` sem nenhuma linha `SUMIU` e `código: 0`.

Mensagem gravada com Write em `.git/sdd/processo/msg-c2.txt`:

```text
docs: fecha o PR B (progresso, pendências e memória)

progress-tracker.md ganha a seção do processo visual e o PR #8 como
mergeado; P62 ganha a Atualização do processo (o CI conferido antes do
merge); memory.md aponta a próxima branch pela skill handoff-visual; o
registro do architecture.md ganha os desvios e o que foi verificado.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
```

`git add .context/progress-tracker.md .context/pendencias.md test/pendenciasDoc.test.ts memory.md .context/architecture.md && git commit -F .git/sdd/processo/msg-c2.txt`

- [ ] **Step 8: O fecho do portão**

```sh
bun run visual:names --range=main...HEAD; echo "código: $?"
node scripts/visual/registry-diff.mjs main; echo "código: $?"
git ls-files | grep -iE '\.(woff2?|ttf|otf|png|jpe?g)$|\.dc\.html$|handoff/|screenshots/'; echo "código: $?"
git status --short
```

Expected: `código: 0`; `código: 0`; nenhuma linha e `código: 1` (o `grep` não achou nada); `git status` vazio.

- [ ] **Step 9: O PR**

Corpo em `.git/sdd/processo/pr-body.md` (ferramenta Write), a partir de `.claude/skills/handoff-visual/templates/pr-body.md`,
com: o resumo (o 404, as ferramentas, as três guardas, a skill), as decisões PB-D1 a PB-D9, os desvios, a tabela do
`pixel.md` (PR A → PR B), o plano de teste com os totais do Step 1, as pendências (P81 e P83 fechadas; P44 e P62 com
`Atualização`; as novas) e a linha final de atribuição do modelo. Depois:

```sh
git push -u origin chore/processo-visual
gh pr create --base main --head chore/processo-visual --title "chore: processo visual (404 do next dev, ferramentas, guardas e skill)" --body-file .git/sdd/processo/pr-body.md
gh pr checks --watch
```

Expected: o link do PR; os checks `Tipos, lint e testes` e `E2E (Playwright)` verdes. Entregue o link ao dono: **o merge é
dele**.

- [ ] **Step 10: Depois do merge (fora do git)**

No roteiro `.git/sdd/roadmap/roteiro.md`: no §2.1, a linha **B** ganha "feito em <data>, PR #<n>" com o que nasceu de fato
(o espelho do slot, `scripts/visual/`, as três guardas, a skill) e as pendências que fechou; no §3, as ferramentas e a
skill entram como peças compartilhadas que já existem; no §6 e no §7, a nota de que o processo e as ferramentas agora
são a skill `/handoff-visual` e o `library-docs.md §22`. Linha final no ledger: `PR B mergeado; roteiro §2 e §3 em dia`.
