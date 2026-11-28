# Processo visual: correção do 404 do `next dev`, ferramentas permanentes e guardas (PR B)

- **Data:** 2026-11-27
- **Branch:** `chore/processo-visual`, nascida de `ad49dc3` (a `main` com o PR #8, o visual novo do Início).
- **Status:** escopo aceito pelo dono (decisão T3 do lote 0: "PR B de processo antes de Passagens"). Esta spec fixa o
  desenho; o plano sai dela.
- **Origem:** o roteiro das próximas telas (fora do git, em `.git/sdd/roadmap/roteiro.md`: §2 linha B, §3.2, §6, §7 e
  §9 item 3), as ferramentas escritas à mão no PR A (fora do git, em `.git/sdd/visual/tools/`), os relatórios de pixel e
  de legibilidade do PR A e as pendências P81, P83 e P44.
- **Privacidade:** nenhum nome, e-mail ou texto operacional dos protótipos aparece aqui nem em arquivo versionado. As
  pessoas são Ana, Bruno, Carla e Diego Teste; os textos do mundo visual foram inventados nesta spec (§5.4).

## 1. Objetivo

Deixar pronto, uma vez, o que as cinco branches de tela seguintes (C a G) repetiriam à mão:

1. **O `next dev` volta a servir** `/entrar`, `/convite/<token>`, `/redefinir-senha` e `/privacidade`, sem mudar o que a
   produção faz (o detalhe rápido da solicitação continua abrindo num Sheet pela rota interceptada).
2. **As ferramentas de verificação visual viram código do repositório** (`scripts/visual/`): banco e ambiente isolados,
   pessoas e seed fictícios, cópias do protótipo, captura, diferença, pares, medida, sonda, interação com falha de rede,
   auditoria de legibilidade, recortes e as ferramentas do registro.
3. **Três guardas que o PR A ensinou:** nenhum nome ou texto do protótipo entra num commit (`check-names` no `pre-commit`
   local e no portão); nenhuma página renderiza no cliente por erro de hidratação (`e2e/hydration.spec.ts`); nenhum
   `bg-muted` some dentro de um cartão (`src/app/mutedBackground.test.ts`, com as violações corrigidas).
4. **O processo vira uma skill** (`.claude/skills/handoff-visual/`), com os modelos de brief, de contrato e de PR.

Nenhuma tela muda de layout. As únicas mudanças visíveis no app são os hovers e estados que hoje somem dentro de
cartões (§9) e, pela emenda do Motion (§16), o movimento dos componentes que já se mexiam; em repouso, nada muda.

## 2. Decisões

**Do dono:**
- **T3 (a):** o PR B entra antes da branch de Passagens. O lote 0 inteiro foi aceito como recomendado.
- **Motion:** decidido em 2026-11-27 (fundação e componentes que já se mexem nesta branch). Entrou por emenda: §16.

**Desta spec (engenharia; vão ao dono como ciência):**

| # | Decisão | Por quê |
|---|---|---|
| PB-D1 | O 404 se corrige trocando o `@detalhe/[...catchAll]` por um **espelho por segmento** do grupo `(app)` (§4.5). Não entram `(app)/default.tsx`, o slot na raiz nem `deprecated.looseRouteMatching` | é a única candidata que satisfaz o validador sem mudar nenhuma árvore de renderização (§4.4) |
| PB-D2 | O guarda da estrutura de rotas roda **o validador do próprio Next** no Vitest, sobre a árvore real | prova a causa e impede a volta; o dev deixa de ser a única testemunha |
| PB-D3 | Ferramentas: o **motor** é versionado; tudo o que tem original do protótipo (mapa de trocas, cópias, capturas, lista de nomes) fica em `.git/sdd/`. Toda saída vai para `.git/sdd/…`, achada por `git rev-parse --git-common-dir`; o script recusa outro destino | privacidade e worktrees (`.git` pode ser arquivo) |
| PB-D4 | Um **mundo visual novo**, com vocabulário inventado (§5.4) num módulo versionado que o seed e as cópias do protótipo usam igual. O quarto setor passa a ser **Rampa** (verde), e os destinos são inventados | o seed antigo copiava textos do protótipo; com texto igual dos dois lados, o pixel continua comparando igual com igual |
| PB-D5 | A configuração de cada tela (estados, sementes, pessoas, larguras, passos, máscaras, regiões) é **versionada** em `scripts/visual/screens/<tela>.mjs`, sem nenhum nome; o mapa de trocas do protótipo fica fora do git | a próxima branch copia um exemplo que funciona; o que identifica pessoa nunca entra |
| PB-D6 | As capturas rodam com `reducedMotion: "reduce"` e esperam as animações terminarem | é a regra de pixel da decisão do Motion; vale já para o Início |
| PB-D7 | O `check-names` **não imprime o termo** achado, só o número da linha da lista; lista ausente ou vazia reprova | a lista tem nomes reais: o relatório não pode espalhá-los por logs e transcrições |
| PB-D8 | `bg-muted` vira `bg-accent` **com a mesma opacidade** nos estados e rodapés que hoje somem; fica uma exceção (`RequestColumn`), justificada | `--muted` = `--card` na paleta nova; `accent` é a "segunda superfície" do protótipo |
| PB-D9 | O `check-names`, o instalador do hook e as ferramentas do registro são do redator R3, junto da skill | equilibra os três redatores; são as guardas que a skill descreve |

## 3. Escopo

**Dentro:**
- A correção do 404 com o guarda de estrutura (§4).
- `scripts/visual/` inteiro (§5), o roteiro de interação com falha de rede (§6), o `check-names` e o instalador do hook
  (§7).
- `e2e/hydration.spec.ts` com o verificador puro (§8).
- O guarda do `bg-muted` e a correção das violações que são defeito (§9).
- A skill `handoff-visual` com os oito modelos (§10).
- `AGENTS.md`, `library-docs.md`, `architecture.md`, `pendencias.md`, `ui-registry.md` e `progress-tracker.md` (§11).
- A prova: os pares do Início reproduzidos pelas ferramentas permanentes, a falha de rede e o texto plantado (§13).
- A emenda do Motion: a fundação e os componentes que já se mexem (§16).

**Fora:**
- Teste de screenshot no CI: as ferramentas nunca rodam no CI (só os testes puros delas, no Vitest).
- Proteção da `main` (P62): configuração do repositório, decisão do dono.
- Qualquer tela nova ou mudança de layout.
- Guardas do `leading-[normal]` e da borda transparente da pílula: dependem do protótipo e ficam na revisão por tarefa.
- Apagar `.git/sdd/visual/tools/`: as ferramentas antigas ficam onde estão, como registro do PR A.

## 4. A correção do 404 do `next dev`

### 4.1 Sintoma

No `next dev` (16.4.6, Turbopack), as quatro páginas fora do grupo `(app)` dão 404, com o aviso:

```
The following page files do not match any complete route:
- src/app/(auth)/convite/[token]/page.tsx
- src/app/(auth)/entrar/page.tsx
- src/app/(auth)/redefinir-senha/page.tsx
- src/app/privacidade/page.tsx
```

O build de produção serve as quatro (o E2E roda em `next start`, e o passe de legibilidade as capturou), por isso nenhum
teste pegou.

### 4.2 Diagnóstico

A validação estrita de rotas do 16.4 (`experimental.strictRouteMatching`, ligada por padrão) mora em
`node_modules/next/dist/server/lib/router-utils/normalize-catchall-routes.js`, chamada por
`server/lib/router-utils/setup-dev-bundler.js`. O dev monta as definições de rota (`appRouteDefinitions`) **a partir do
resultado dela**, então uma rota podada ali vira 404.

1. **O catch-all do slot é pendurado em toda rota.** Grupos não contam na URL, então
   `/(app)/@detalhe/[...catchAll]/page` normaliza para `/[...catchAll]`, com base `/`. A função acrescenta esse catch-all
   a toda rota que começa com `/`, inclusive `/entrar`, `/convite/[token]`, `/redefinir-senha` e `/privacidade`.
2. **A poda estrita olha a árvore de pastas.** Para cada rota que ganhou um catch-all, ela confere o nível onde o slot
   mora (o pai `(app)`): todo slot irmão (`children` e `@detalhe`) precisa de uma página que case ou de um `default`.
   Em `/entrar`, o `children` de `(app)` não tem página (a página é de `(auth)`) nem `(app)/default.tsx`.
3. **A rota inteira é apagada**, não só o catch-all: como as duas entradas da rota são páginas, nada sobra, e
   `/(auth)/entrar/page` vira "página que não casa com nenhuma rota completa". No dev, 404.

Nas rotas de dentro de `(app)` (`/conta`, `/admin/turnos` etc.) o `children` casa, e nada é podado.

### 4.3 Experimento (só leitura e um dev curto, já desfeito)

- **O validador, sozinho:** um script rodou `normalizeCatchAllRoutes(…, { strictRouteMatching: true })` sobre a lista
  real de páginas e de `default`s do projeto. Com a árvore de hoje: as quatro páginas não casam e as quatro rotas somem.
- **Cada candidata** passou pelo mesmo script (tabela abaixo).
- **O espelho no dev de verdade:** aplicado na árvore de trabalho, `next dev -p 3203` com o ambiente visual: `/privacidade`,
  `/entrar`, `/redefinir-senha` e `/convite/<token>` responderam **200**, sem o aviso de rotas, e uma URL desconhecida foi
  redirecionada a `/entrar` pelo `proxy.ts` (anônimo), como hoje. Servidor derrubado pelo PID; árvore de volta ao `HEAD`.

### 4.4 Candidatas

| Candidata | Validador | Efeito colateral | Veredito |
|---|---|---|---|
| C1. `(app)/default.tsx` | passa | cria a rota `/[...catchAll]`: toda URL desconhecida passa a casar e renderiza o shell do app com o `default`, em vez do 404 da raiz. `architecture.md` (Fase 4, item d) e `library-docs.md §14` já proíbem este arquivo pelo mesmo motivo | recusada |
| C5. Slot `@detalhe` no layout raiz | passa | muda o layout raiz (risco de hidratação, lição do PR A) e tira o Sheet do `SidebarProvider` e do `SidebarInset`: muda a árvore de produção | recusada |
| C8. `deprecated.looseRouteMatching: true` | desliga a validação | esconde o defeito de estrutura com uma opção marcada como obsoleta | recusada |
| C7. Sem catch-all; o `RequestSheet` se fecha pelo `usePathname` | passa | muda o mecanismo de fechar o Sheet, que o E2E de Solicitações (b) e (e) prova hoje | recusada |
| **C2. Espelho por segmento** | **passa** | nenhum: as rotas de `(app)` continuam com uma página nula do slot, e as de fora deixam de carregar um catch-all que o layout delas nem tem | **escolhida** (PB-D1) |

### 4.5 A correção

**Sai:** `src/app/(app)/@detalhe/[...catchAll]/page.tsx`.

**Entram** nove páginas nulas, uma por segmento de primeiro nível do grupo `(app)`, mais um catch-all onde o segmento tem
subrotas:

| Arquivo | Cobre | Nome do componente |
|---|---|---|
| `src/app/(app)/@detalhe/admin/page.tsx` | `/admin` | `DetalheAdmin` |
| `src/app/(app)/@detalhe/admin/[...rest]/page.tsx` | `/admin/*` | `DetalheAdminRest` |
| `src/app/(app)/@detalhe/bem-vindo/page.tsx` | `/bem-vindo` | `DetalheBemVindo` |
| `src/app/(app)/@detalhe/conta/page.tsx` | `/conta` | `DetalheConta` |
| `src/app/(app)/@detalhe/dashboard/page.tsx` | `/dashboard` | `DetalheDashboard` |
| `src/app/(app)/@detalhe/passagens/page.tsx` | `/passagens` | `DetalhePassagens` |
| `src/app/(app)/@detalhe/passagens/[...rest]/page.tsx` | `/passagens/*` | `DetalhePassagensRest` |
| `src/app/(app)/@detalhe/solicitacoes/page.tsx` | `/solicitacoes` | `DetalheSolicitacoes` |
| `src/app/(app)/@detalhe/solicitacoes/[...rest]/page.tsx` | `/solicitacoes/*` | `DetalheSolicitacoesRest` |

Cada uma é exatamente `export default function <Nome>() { return null; }` (o `rendersNothing` do `appPagesAuth.test.ts`
confere), sem import e sem `metadata`. Ficam como estão `@detalhe/default.tsx`, `@detalhe/page.tsx` (rota `/`) e
`@detalhe/(.)solicitacoes/[id]/page.tsx`.

**Regra que nasce:** toda rota nova de primeiro nível em `(app)` ganha o seu espelho no slot (página nula e, se tiver
subrotas, o `[...rest]`). Sem ele, o Sheet ficaria aberto sobre a tela nova numa navegação no cliente. O guarda (§4.6)
reprova o esquecimento. As branches C a G não criam segmento novo (`/passagens`, `/solicitacoes` e `/dashboard` já existem).

**Emenda de 2026-11-28 (revisão final do PR B): o espelho é exato, sem catch-all.** No build de produção, os três
`[...rest]` da tabela acima faziam o segundo link para o mesmo caminho com outra busca entrar num laço de prefetch: cerca
de 50 pedidos por segundo, cada um uma renderização no servidor. Os casos eram os "Entregar turno" do histórico em
`/passagens` e os `?setor=` do `/admin/itens`. A causa é a previsão de rota do cliente do Next 16.4.6 com
`partialPrefetching`. A segunda URL reaproveita a árvore da primeira e só resolve os parâmetros do ramo que casou a URL;
o catch-all do slot fica sem valor, e a chave do segmento nunca bate com a resposta. No A/B com a `ad49dc3`, o
`@detalhe/[...catchAll]` antigo fazia o mesmo entre duas `/passagens/<id>`. Os `[...rest]` saem, e entra uma página nula
do slot por página de `(app)`, no mesmo caminho e com os mesmos nomes de parâmetro:
`@detalhe/admin/{destinos,equipe,itens,setores,turnos}/page.tsx`, `@detalhe/passagens/nova/page.tsx`,
`@detalhe/passagens/[id]/page.tsx` e `@detalhe/solicitacoes/[id]/page.tsx`, ao lado da interceptada. São 14 páginas
nulas. A regra passa a ser: **toda página nova de `(app)` ganha a página nula do slot no mesmo caminho, e o slot não tem
catch-all em nenhum nível**. O guarda (§4.6, item 4) confere as duas coisas, e o `e2e/prefetch.spec.ts` prova a ausência
do laço no build de produção.

### 4.6 Guardas

- **`src/app/routeStructure.test.ts` (novo).** Monta a lista de páginas e de `default`s de `src/app` como o Next as vê
  (`/(app)/admin/page`, `/(app)/@detalhe/default`…), importa `normalizeCatchAllRoutes`
  (`next/dist/server/lib/router-utils/normalize-catchall-routes`) e `normalizeAppPath`
  (`next/dist/shared/lib/router/utils/app-paths`) e afirma:
  1. com `strictRouteMatching: true`, `unmatchedAppPages` e `incompatibleParallelRouteSlots` vazios;
  2. `/entrar`, `/convite/[token]`, `/redefinir-senha` e `/privacidade` existem como rota, e nenhuma página do
     `@detalhe` está nelas;
  3. nenhuma rota começa com `/[...` (URL desconhecida continua no 404 da raiz);
  4. o espelho: todo segmento de primeiro nível de `(app)` com `page.tsx` tem `@detalhe/<segmento>/page.tsx`; todo
     segmento com página mais funda tem `@detalhe/<segmento>/[...rest]/page.tsx`; não existem `@detalhe/[...catchAll]` nem
     `(app)/default.tsx` (emenda de 2026-11-28, §4.5: toda página de `(app)` tem a do slot no mesmo caminho, e o slot não
     tem catch-all em nenhum nível);
  5. **a causa, documentada em teste:** com uma árvore sintética igual à de antes (catch-all na raiz do slot e uma página
     num grupo irmão), o validador reprova a página do grupo irmão; com `(app)/default.tsx` acrescentado, aparece a rota
     `/[...catchAll]`. Se um dia o Next mudar o validador, este caso avisa.
  O passo vermelho do TDD é o item 1 sobre a árvore de hoje (as quatro páginas aparecem). Se o Next mover os dois
  módulos internos, o import quebra com mensagem clara, e a correção é atualizar o caminho (registrado no
  `library-docs.md §1`).
- **`src/app/appPagesAuth.test.ts`:** `NULL_SLOT_PAGES` troca `@detalhe/[...catchAll]/page.tsx` pelas nove páginas novas
  (fica `@detalhe/page.tsx`).

### 4.7 O que não muda na produção

- O detalhe rápido: clicar numa solicitação abre o Sheet pela interceptação `(.)solicitacoes/[id]`; recarregar abre a
  página completa; o Sheet fecha ao navegar para qualquer rota de `(app)` (agora pelo espelho do segmento, antes pelo
  catch-all). Provas: E2E de Solicitações (b) e (e), sem mudança.
- URL desconhecida: o 404 da raiz (o E2E "`/nao-existe` logado responde Página não encontrada" continua).
- P44 continua aberta: a interceptação ainda depende do cabeçalho `next-url` (ganha uma `Atualização` datada).

## 5. Ferramentas permanentes (`scripts/visual/`)

### 5.1 Regras

1. **Saída só em `.git/sdd/`.** O caminho sai de `git rev-parse --path-format=absolute --git-common-dir` (mais `/sdd`),
   nunca de `.git/` fixo nem de `new URL("../..")`. Todo destino passa por `assertInsideSdd`, e um `--out` fora dele faz
   o script sair com código 1. **Duas exceções, declaradas:** `registry.mjs` grava só `.context/ui-registry.md` (é a
   função dele) e `install-hooks.mjs` grava só o `pre-commit` em `git rev-parse --git-path hooks` (fora da árvore).
2. **Node para o Chromium, Bun para o banco e o seed.** O Chromium do Playwright não abre pelo Bun no Windows: tudo o que
   abre navegador é `.mjs` rodado com `node`; `db.ts`, `seed/*.ts` rodam com `bun`.
3. **Portas fixas.** Banco PGlite na **54332**, app na **3202**. `config.mjs` recusa outra URL de banco ou de app; as
   portas 3000, 3200, 3201, 54329 e 54331 nunca são usadas (a 3000 é de outro projeto; 3200/54329 são do E2E;
   3201/54331, do dono).
4. **Pessoas e textos inventados.** Só Ana, Bruno, Carla e Diego Teste (`@example.com`) e o vocabulário do §5.4.
5. **Puro tem teste.** Toda lógica sem navegador (caminhos, portas, argumentos, validação de configuração, recorte,
   máscara, diferença, contraste, trocas do protótipo, passos, casamento de requisição, lista de nomes, diff, cabeçalhos)
   fica em módulo próprio, testado no Vitest em `test/visual/*.test.ts` (o padrão `scripts/smokeChecks.mjs` +
   `test/smokeChecks.test.ts`).
6. **Nada roda no CI** além desses testes puros (rápidos, sem navegador, sem rede, sem a lista de nomes).
7. **Um servidor e um navegador por vez.** Cada CLI fecha o navegador ao fim de cada estado.
8. **Nunca imprimir segredo.** O segredo do ambiente visual é gerado em `.git/sdd/visual-db/secret` e só é lido pelo
   `env.sh`.
9. **devDependencies exatas:** `pixelmatch` **7.2.0** e `pngjs` **7.0.0** (`bun add -d -E`). Usadas só em
   `scripts/visual/` e nos testes dele; nunca em `src/`.

### 5.2 Pastas fora do git

```
.git/sdd/
  nomes-proibidos.txt     lista de nomes, e-mails e textos dos protótipos (global, acumula por branch)
  visual-db/              banco visual compartilhado: pgdata/, secret, world.json, state.json, avatars.json
  processo/               esta branch: ledger, proto.config.mjs, proto/, pares/, interacoes/, legibilidade/, medidas/
  visual-<slug>/          cada branch de tela, com a mesma forma (roteiro §6.2)
```

### 5.3 As ferramentas

| Arquivo | O que faz | Entrada | Saída |
|---|---|---|---|
| `paths.mjs` (puro + `git`) | `gitCommonDir`, `repoRoot`, `sddDir`, `sddPath`, `assertInsideSdd`, `isInside`, `resolveInside`, `visualDbDir` | — | caminhos absolutos conferidos |
| `config.mjs` (puro) | portas, URLs, chave do tema, cookie do convite, `assertVisualDbUrl`, `assertVisualBaseUrl`, `parseCliArgs`, `parseSizes`, `fakeClientIp` | — | constantes e validações |
| `screen.mjs` | carrega a configuração de tela (§5.5), valida (`validateScreen`, puro, com os tipos em JSDoc), troca `{setor}` no caminho, dá a altura mínima e lê o `state.json` e o `avatars.json` | `--screen` ou `--config` | a configuração validada |
| `vocabulary.mjs` (puro) | as pessoas, a senha de teste e o vocabulário inventado (§5.4) | — | constantes |
| `db.ts` (bun) | PGlite em disco com as migrações de `./drizzle`, servido na 54332; idempotente (porta já de pé com o banco visual: avisa e sai 0) | — | `.git/sdd/visual-db/pgdata/` |
| `env.sh` (sh) | `. scripts/visual/env.sh`: exporta `DATABASE_URL` e `DATABASE_URL_POOLED` (54332), `DATABASE_POOL_MAX=1`, `BETTER_AUTH_URL=http://localhost:3202`, o segredo (gerado se faltar, nunca impresso) e esvazia social e Sentry | — | variáveis do shell |
| `people.mjs` (node) | cadastra as 4 pessoas pela API (`/api/auth/sign-up/email` com o cookie do convite); "já existe" conta como sucesso | `world.json` | relatório por pessoa |
| `seed/index.ts` (bun) | `base` · `state <tela>:<estado> [--setor=<nome>]` · `reopen-invites` · `avatars` | banco 54332 | `world.json`, `state.json`, `avatars.json` |
| `seed/world.ts`, `seed/states/*.ts`, `seed/avatarArt.ts` | o mundo (`seedBase`), a parte variável (`resetVariable`), os estados por tela (`STATES`, `seedState`) e a arte do avatar igual à do app | `SeedDb` | linhas no banco |
| `capture.mjs` (node) | login pela API, tema no `localStorage`, indicador do dev escondido, `reducedMotion`, espera de fontes e animações, altura natural, captura; CLI de captura avulsa | caminho, largura, tema, pessoa | PNG em `.git/sdd/…` |
| `image.mjs` (puro) | `readPng`, `writePng`, `cropTo`, `cropRect`, `paintRects`, `stackRegion`, `contactSheet` | PNG | PNG |
| `diff.mjs` (puro + CLI) | `pixelmatch` com threshold 0.1, recorte ao menor tamanho comum, máscaras pintadas iguais nos dois lados, diferença por região | dois PNG, máscaras | porcentagem e PNG da diferença |
| `proto.mjs` (node) | o motor das cópias do protótipo (§5.6) | `--config=<caminho em .git/sdd>` | `<out>/proto/<cópia>.html` + arquivos de apoio |
| `steps.mjs` (puro + runner) | o roteiro de interação (§6) | passos | registro do que aconteceu |
| `pairs.mjs` (node) | semeia cada estado, abre app e protótipo, roda os passos, iguala a altura, captura, mascara, mede página e regiões | `--screen`/`--config`, `--out`, estados, `--sizes`, `--sufixo` | `<out>/pares/<estado>-<largura><sufixo>-{proto,app,diff}.png` e `results.json` |
| `measure.mjs` (node) | caixa, tipografia, cor, fundo, raio e padding pelo texto, app contra protótipo; `--so-proto` extrai os px do protótipo (Etapa 0.6) | tela, estado, largura, `--root` | diferenças no terminal; `<out>/medidas/<estado>-<largura>.json` |
| `probe.mjs` (node) | avalia uma expressão nas duas páginas (ou só no app, `--app-only`) depois dos passos do estado: a prova por estilo computado | tela, estado, largura, expressão | `PROTO <json>` / `APP <json>` |
| `interact.mjs` (node) | roda os passos de um estado e registra (falhas de rede, amostras), com captura | tela, estado, `--out`, `--width` | `<out>/interacoes/<estado>-<largura>-{app,proto}.png` e `.json`; código 1 se o `expect` falhar |
| `contrast.mjs` (puro) | `parseColor`, `over`, `luminance`, `contrastRatio`, `requiredRatio` e `auditScript()` (o script da página, montado com essas mesmas funções) | cores | razões |
| `audit.mjs` (node) | a auditoria de legibilidade: contraste de texto, alvo de toque abaixo de 860px, rolagem horizontal, borda de campo, fundo que some no do pai | `--screen=legibilidade`, `--out`, `--only`, `--themes`, `--sizes`, `--dir` | `<out>/<dir>/<tela>-<tema>-<largura>.png` e `audit.json` |
| `sheet.mjs`, `sbs.mjs`, `crop.mjs` (node) | folha de contato; protótipo, app e diferença empilhados com zoom; recorte em tamanho real | PNG em `.git/sdd/…` | PNG em `.git/sdd/…` |
| `names.mjs` (puro), `check-names.mjs`, `install-hooks.mjs` | §7 | — | — |
| `docs.mjs` (puro), `registry.mjs`, `registry-diff.mjs` | editar uma entrada do `ui-registry.md` sem mexer nas outras; comparar os cabeçalhos do `ui-registry.md` (`###`) e do `pendencias.md` (`####`) entre dois commits | entrada e operação; `<base> [head]` | o arquivo editado; código 1 se um cabeçalho sumiu |
| `screens/inicio.mjs`, `screens/legibilidade.mjs`, `screens/provas.mjs` | configurações versionadas (§5.5) | — | — |

### 5.4 O mundo visual e o vocabulário inventado

`scripts/visual/vocabulary.mjs` é a única fonte. O seed escreve com ele; o `proto.mjs` o entrega à configuração das
cópias, que troca os textos do protótipo por estes mesmos.

- **Pessoas** (`VISUAL_PEOPLE`): `ana` (Ana Teste, `ana.teste@example.com`, admin), `bruno`, `carla` e `diego`
  (operadores do ULD), com o e-mail no mesmo formato. Senha `VISUAL_PASSWORD = "senha-de-teste-123"` (a do E2E).
- **Setores** (`VISUAL_SECTORS`): ULD (lilac), Carga (peach), Operações (sky), **Rampa** (green). Em ordem alfabética o
  ULD continua o quarto.
- **Turnos** (`VISUAL_SHIFTS`), em cada setor: Turno 1 06:00–14:00, Turno 2 14:00–22:00, Turno 3 22:00–06:00.
- **Itens** (`VISUAL_ITEMS`): ULD: Rede de proteção, Stretch, Cinta azul · Carga: Palete, Capa plástica ·
  Operações: Cone, Rádio · Rampa: Calço, Etiqueta. Todos `control`, unidade `unidade`; no estado rico o Stretch vira
  `stock` em `rolo`.
- **Destinos** (`VISUAL_DESTINATIONS`): Doca Norte, Doca Sul, Armazém 3, Terminal B, Box 7.
- **Textos** (`VISUAL_TEXTS`):
  - `pendingNextShift`: "Conferir as duas ULDs da doca norte no começo do turno.\nCapa da posição 6 separada para troca."
  - `staleRequests` (paradas, na ordem do seed): Doca Norte / "Capas novas para a doca norte" (solicitada, 4 dias e 2 h);
    Doca Sul / "Reposição de cintas azuis" (em trânsito, criada há 5 dias, mudou há 3 dias e 5 h); Armazém 3 /
    "Calços de borracha, 2 caixas" (solicitada, 3 dias e 1 h).
  - `recentRequests`: "Pedido recente 1" a "Pedido recente 4", para Terminal B, criadas há 1 a 4 h.
  - `history`: ocorrências "Rampa parada por 40 minutos por causa do vento."; próximo turno "Conferir as capas da
    posição 6.\nRepor stretch no box 2."; observação de item "Uma com defeito"; correção de "Rampa parada." para o texto
    de ocorrências, motivo "Faltou o tempo de parada".
  - `historyRequests`: Doca Norte / "Cintas azuis, 3 caixas" (entregue); Doca Sul / "Capas novas para o box 1"
    (entregue); Box 7 / "Calços extras (duplicado)" (cancelada, motivo "Pedido duplicado"); Armazém 3 / "Etiquetas de
    teste" (em trânsito); Terminal B / "Sacos de teste, 1 fardo" (entregue).

**Datas relativas ao agora** (fuso de São Paulo): a passagem do turno sugerido usa o dia operacional que o
`suggestShift` devolve; a pendente é de ontem; os horários fixos ("13:52", "14:06", "05:58", "07:58") são de hoje. O que
depende do relógio vai para as máscaras e para o `patch` (§5.5).

**Estados** (`STATES`, nome `<tela>:<estado>`):
- `inicio:admin`, `inicio:primeiro`, `inicio:continuar`, `inicio:entregue`, `inicio:confirmada`, `inicio:sem-turnos`:
  os do PR A, com o mesmo conteúdo e o vocabulário novo. `entregue` e `confirmada` aceitam `--setor`.
- `geral:rico`: o estado do passe de legibilidade (pendente, paradas, solicitações em todos os status, seis dias de
  passagens com itens, textos e uma correção).
Cada branch acrescenta `seed/states/<tela>.ts` e o registra em `seed/states/index.ts`.

**Arquivos do banco visual** (`.git/sdd/visual-db/`):
- `world.json`: `{ sectors: { <nome>: <id> }, invites: { <pessoa>: <token> } }`, escrito pelo `base`;
- `state.json`: `{ state, sector, sectorId, sectors, users: { <pessoa>: <id> }, at }`, escrito por cada `state`;
- `avatars.json`: `{ <pessoa>: <data URI> }`, escrito pelo `avatars` (semente = id do usuário, como o app).

### 5.5 Configuração de tela (`scripts/visual/screens/<tela>.mjs`)

Um módulo com `export default` validado por `validateScreen` (lista de erros; vazia = válida). Campos:

- `name`; `ready` (seletor que diz que a página do app carregou); `protoDir` (padrão `"proto"`, relativo ao `--out`).
- `states`: `{ <estado>: StateConfig }`, cada um com:
  - `seed` (nome de `STATES`), `sector?` (nome do setor; padrão ULD), `person` (`ana | bruno | carla | diego`),
    `theme` (`dark | light`);
  - `path`, com `{setor}` trocado pelo id do setor do estado (ex.: `"/?setor={setor}"`);
  - `sizes?` (padrão `[1440, 390]`), `viewportOnly?` (só a janela, sem igualar a altura);
  - `proto` (o nome da cópia, sem `.html`; `null` = só o app);
  - `steps?: { app?: Step[], proto?: Step[] }` (§6), `css?` (simulação de medida, nunca correção);
  - `regions?: { <nome>: <expressão que devolve [x, y, w, h]> }` (ex.: o cartão do turno no pack);
  - `expect?: { failedRequests?: number }`.
- `patch?: { read, write }`: `read` é uma expressão avaliada no app; `write`, a fonte de uma função avaliada no
  protótipo com o valor lido (no Início: nome, horário e data do turno sugerido, "agora HH:MM" e a largura da barra).
- `masks?`: expressão que devolve os retângulos do que depende do agora, avaliada nos dois lados (a união vai para os dois).
- `audit?`: a lista de telas da auditoria (`{ name, path, person | null, extraWidths?, steps? }`), com `{setor}`,
  `{pendente}`, `{corrigida}` e `{solicitacao}` resolvidos por consulta ao banco visual.

Altura comum: a maior altura natural dos dois lados, com mínimo de 844 abaixo de 860px de largura e 900 acima.

**`screens/inicio.mjs`** traz os pares do PR A que o pack não tocou e os do pack:

| Estado | Semente | Tema | Larguras | Cópia do protótipo |
|---|---|---|---|---|
| `admin-escuro` / `admin-claro` | `inicio:admin` | escuro / claro | 1440, 390 | `proto-admin-escuro` / `proto-admin-claro` |
| `primeiro-escuro` / `primeiro-claro` | `inicio:primeiro` | escuro / claro | 1440, 390 | `proto-primeiro-escuro` / `proto-primeiro-claro` |
| `continuar` | `inicio:continuar` | escuro | 1440, 390 | `proto-continuar` |
| `sem-turnos` | `inicio:sem-turnos` | escuro | 1440, 390 | `proto-sem-turnos` |
| `menu` | `inicio:admin` | escuro | 390, só a janela (844) | `proto-admin-escuro`, com o menu aberto pelos passos dos dois lados |
| `entregue-escuro-uld` / `confirmada-escuro-uld` | `inicio:entregue` / `inicio:confirmada` | escuro | 1440, 390 | `proto-entregue-escuro-uld` / `proto-confirmada-escuro-uld` |
| `entregue-claro-carga` | `inicio:entregue`, setor Carga | claro | 1440 | `proto-entregue-claro-carga` |
| `confirmada-claro-operacoes` | `inicio:confirmada`, setor Operações | claro | 1440 | `proto-confirmada-claro-operacoes` |

Todos com a Ana em `/?setor={setor}`; os quatro do pack têm a região `cartao` (o cartão "Passagem do meu turno").

**`screens/legibilidade.mjs`**: as 27 telas do passe do PR A (entrada, convite inválido, redefinição, privacidade,
boas-vindas, Passagens, nova passagem, detalhes, Solicitações nas três visões e no Sheet, página da solicitação,
Dashboard, Conta, Administração e os 5 cadastros), com as larguras extras de 820 onde há tabela ou lista.

**`screens/provas.mjs`**: os estados só do app que provam a branch (§13): `falha-de-rede`, `hover-outline-em-cartao`,
`hover-ghost-em-cartao` e `hover-statlink`.

### 5.6 Cópias do protótipo

`node scripts/visual/proto.mjs --config=<caminho relativo a .git/sdd>` importa a configuração (fora do git, porque tem os
originais) e chama `replacements(ctx)` com `ctx = { avatars, people, vocabulary, now }`. A configuração devolve:

```js
export default {
  out: "processo/proto",
  sources: [
    {
      file: "visual/handoff/Inicio.dc.html",
      support: ["support.js"],
      replacements: (ctx) => [/* [original, troca], … */],
      copies: { "proto-admin-escuro": { props: { /* defaults do data-props */ }, extra: [] } },
    },
  ],
  leftovers: [/* termos extras que não podem sobrar, ex.: domínios externos */],
};
```

O motor:
1. aplica as trocas na ordem; uma troca cujo original não existe é erro, **identificado pelo número da troca**, nunca
   pelo texto;
2. para cada cópia, muda os `default` do `data-props` (erro se a prop não existe) e aplica as trocas extras;
3. procura na cópia **todos os termos de `nomes-proibidos.txt`** (pelo mesmo `names.mjs` do §7) e os `leftovers`; sobra
   = erro com o número da linha da lista;
4. grava a cópia e os arquivos de apoio no `out`.

O mapa de trocas do Início (C1, §13) troca os nomes e e-mails pelas pessoas fictícias, os avatares pelos do app, a data
pelo dia de hoje, os setores pela ordem e pelos nomes do app (com Rampa), o "Parada há N dias" pelo mínimo do app
(mais de 72 h) e **os textos operacionais pelos do §5.4**.

### 5.7 Atalhos no `package.json`

| Script | Comando |
|---|---|
| `visual:db` | `bun scripts/visual/db.ts` |
| `visual:seed` | `bun scripts/visual/seed/index.ts` |
| `visual:people` | `node scripts/visual/people.mjs` |
| `visual:proto` | `node scripts/visual/proto.mjs` |
| `visual:pairs` | `node scripts/visual/pairs.mjs` |
| `visual:audit` | `node scripts/visual/audit.mjs` |
| `visual:names` | `node scripts/visual/check-names.mjs` |
| `visual:hooks` | `node scripts/visual/install-hooks.mjs` |

O resto se chama direto: `node scripts/visual/<ferramenta>.mjs`.

## 6. Roteiro de interação por par e falha de rede

Boa parte dos estados desenhados nos handoffs é de interação ou de falha (menu aberto, foco, hover, arrasto, autosave com
erro). Cada estado ganha passos, executados no app e, com outros alvos, no protótipo, antes da captura, da sonda ou da
medida.

**Passos** (`steps.mjs`, validados por `validateSteps`):

| `kind` | Campos | Efeito |
|---|---|---|
| `click`, `hover`, `focus` | `target` | clica, passa o mouse, foca |
| `tab` | `times` | aperta Tab N vezes (foco pelo teclado, para o `:focus-visible`) |
| `press` | `key` | uma tecla |
| `fill` | `target`, `value` | preenche um campo |
| `drag` | `from`, `to` | arrasta de um alvo a outro |
| `wait` | `ms` | espera |
| `waitFor` | `target` | espera o alvo ficar visível |
| `failRequests` | `match`, `times?` | a partir daqui, aborta (`route.abort("failed")`) as requisições que casam, no máximo `times` vezes |
| `restoreRequests` | — | tira a falha |
| `sample` | `target`, `read` (`x`, `y`, `width`, `height`), `every`, `for` | amostra a caixa do alvo no tempo (ex.: o thumb do seletor) |

- **Alvo:** `{ role, name, exact? }`, `{ css }` ou `{ text }`.
- **Casamento de requisição** (`requestMatches`, puro): `{ url?, method?, header? }`. `url` é um glob (`*` num segmento,
  `**` em vários) ou uma regex entre barras; `header` é um nome que precisa existir na requisição. **Server Action** é
  `{ method: "POST", header: "next-action" }`; uma rota de API é `{ url: "**/api/…" }`.
- **Registro:** o runner liga `page.on("requestfailed")` e devolve `{ failed: [{ url, method, error }], samples, notes }`.
  `expect.failedRequests` exige pelo menos esse número de falhas; o `interact.mjs` sai com 1 se não houve.
- **No protótipo, o estado de falha é uma prop do `.dc.html`** (uma cópia própria). No app, é a falha injetada.

## 7. `check-names` e o hook local

**A lista** (`.git/sdd/nomes-proibidos.txt`, fora do git, achada pelo `paths.mjs`):
- uma entrada por linha; linhas vazias e as que começam com `#` não contam;
- `!<frase>` é **permitida**: sai do texto antes da busca (para um nome fictício que contém um nome proibido);
- a busca ignora caixa e acento; palavra e frase casam só inteiras (com borda de palavra); e-mail (tem `@`) casa como
  trecho.

Entram os nomes e e-mails do protótipo e das screenshots **e os textos operacionais** (descrições, frases de ocorrência e
de próximo turno, observações, itens e destinos próprios). Não entram palavras genéricas do domínio que já estão no
código (setor, ULD, pátio), que dariam falso positivo.

**`names.mjs` (puro):** `normalizeText`, `parseNamesList`, `findForbidden`, `addedLinesFromDiff`.

**`check-names.mjs`:**

| Modo | Confere | Uso |
|---|---|---|
| `--staged` | linhas acrescentadas e caminhos de `git diff --cached` | o `pre-commit` |
| `--range=<a>...<b>` | linhas acrescentadas e caminhos de `git diff <a>...<b>`, mais as mensagens de `git log <a>..<b>` | o portão (`--range=main...HEAD`) |
| `--file=<caminho>` | o arquivo inteiro | conferência avulsa (ex.: cópia do protótipo) |

Saída: `arquivo:linha — termo nº N da lista (linha L)`, sem o termo (PB-D7). Códigos: 0 limpo; 1 achou; 2 lista ausente
ou vazia, ou uso errado, em qualquer modo, com a instrução de criar a lista ou de tirar o hook.

**`install-hooks.mjs`:** grava em `git rev-parse --git-path hooks/pre-commit` (respeita `core.hooksPath`):

```sh
#!/bin/sh
# closery:check-names (instalado por scripts/visual/install-hooks.mjs)
if [ ! -f scripts/visual/check-names.mjs ]; then
  echo "aviso (closery:check-names): esta branch não tem scripts/visual/check-names.mjs; o commit segue sem a conferência da lista de nomes." >&2
  exit 0
fi
exec node scripts/visual/check-names.mjs --staged
```

Se já existe um `pre-commit` sem a marca, recusa (código 1) e diz para juntar à mão. Com a marca, regrava (idempotente).
`--remove` apaga só o hook com a marca. Puro: `HOOK_MARKER`, `hookScript()`, `isOurHook(texto)`.

**Emenda de 2026-11-28 (desvio da decisão 9 do controlador, `d3fa951`):** o esboço original era só a linha do `exec`, e
numa branch sem `scripts/visual/` (uma branch antiga, ou a `main` antes do merge) o `node` não achava o script e recusava
todo commit. O hook entregue confere o arquivo antes: sem ele, avisa no stderr e sai com 0 (não há hook a tirar nem a
reinstalar); com ele, o código é o do `check-names --staged`. O portão `--range=main...HEAD` continua valendo na branch que
tem as ferramentas. Lista ausente ou vazia continua recusando (código 2).

O controlador grava a lista antes da primeira tarefa e instala o hook logo depois da tarefa que o cria; daí em diante,
todo commit da branch passa por ele.

## 8. Guarda de hidratação (`e2e/hydration.spec.ts`)

O PR A perdeu duas horas e meia com conteúdo duplicado: o `next-themes` punha um `<script>` dentro da árvore client acima
dos `Suspense`, o React refazia a página no cliente e o console ficava vazio. O que denunciou foram os ids de `useId`:
`_R_…` (do servidor, hidratado) contra `_r_…` (do cliente).

**Verificador puro** em `test/hydrationCheck.ts`:
- `snapshotDom()` (roda na página; sem nada de fora da função): `{ mains, h1PerMain, ids, refs }`, com os ids de todo
  `[id]` e as referências de `for`, `aria-labelledby`, `aria-describedby` e `aria-controls`;
- `hydrationProblems(snapshot, expectedH1, consoleErrors)`: lista de problemas (vazia = ok): mais de um `main`; `h1` por
  `main` diferente do esperado; id repetido; id ou referência no formato do cliente (`_r_…_`); mensagem de hidratação no
  console (`hydrat`, sem caixa).
- Testado em `test/hydrationCheck.test.ts` com instantâneos sintéticos (limpo, duplicado, `_r_`, dois `h1`, console).

**O spec**, no `next start` do E2E, antes de qualquer interação:

| Pessoa | Páginas | `h1` esperado |
|---|---|---|
| anônimo | `/entrar`, `/redefinir-senha`, `/convite/<token válido>` | 0 (o título é o do cartão) |
| anônimo | `/privacidade` | 1 |
| admin | `/`, `/passagens`, `/solicitacoes?visao=lista`, `/dashboard`, `/conta`, `/admin`, `/admin/equipe` | 1 |
| operador | `/`, `/passagens` | 1 |

O redator confere cada `h1` lendo a página antes de fixar a tabela. Se um componente que só existe no cliente (montado
depois da hidratação, de propósito) gerar um `_r_`, ele entra numa lista fechada no próprio spec, com o motivo; nunca um
filtro genérico. Usa os helpers de `e2e/helpers.ts` (`test` com `clientIp`, `signUpAdmin`, `signUpOperator`,
`seedSector`) e no máximo dois cadastros por teste (rate limit).

## 9. Guarda do `bg-muted`

Na paleta nova `--muted` = `--card` = `--popover` nos dois temas. Dentro de cartão, diálogo ou Sheet, o hover e o estado
aberto com `bg-muted` não mudam de cor, e os rodapés não se separam do corpo (P83; 4 dos 7 commits de legibilidade do
PR A eram isso).

**`src/app/mutedBackground.test.ts`** (como o `rawColors`): varre os `.ts` e `.tsx` de `src/` (fora os `*.test.*`), sem os
comentários, e recusa `bg-muted` com opacidade ou variante (`hover:`, `aria-expanded:`, `group-hover:`, `[a]:hover:`,
`dark:hover:`), sem pegar `bg-muted-foreground`. Casos negativos e positivos testados na própria expressão. Exceções numa
lista fechada, por arquivo e trecho, cada uma com o motivo; uma exceção que não existe mais reprova:

| Arquivo | Trecho | Motivo |
|---|---|---|
| `src/components/solicitacoes/RequestColumn.tsx` | `bg-muted/30` | a coluna do Quadro fica sobre o `background` da página (não dentro de cartão) e tem borda; a branch E troca pelo token `--column` (roteiro §3.1) |

**Correções** (PB-D8: `bg-muted` → `bg-accent`, mesma opacidade e mesma variante):

| Arquivo | Onde |
|---|---|
| `src/components/ui/button.tsx` | `outline` e `ghost`: hover e `aria-expanded` |
| `src/components/ui/badge.tsx` | `outline` (`[a]:hover:`) e `ghost` (hover e `dark:hover:`) |
| `src/components/ui/table.tsx` | rodapé; hover, `has-aria-expanded` e `data-[state=selected]` da linha |
| `src/components/ui/card.tsx` | `CardFooter` |
| `src/components/ui/dialog.tsx` | `DialogFooter` |
| `src/components/ui/field.tsx` | hover do rótulo com campo |
| `src/components/ui/avatar.tsx` | o fundo do fallback e o contador do grupo (primitivo sem uso hoje) |
| `src/components/app-shell/AdminOverview.tsx` | `group-hover:` do cartão |
| `src/components/dashboard/BarList.tsx`, `src/components/dashboard/StatLink.tsx` | hover da linha |

- O redator lista os consumidores de `Button` `outline`/`ghost` e de `Badge` `outline`/`ghost` e confere que nenhum fica
  sobre um fundo `accent` (lá o hover sumiria de novo). Se achar um, o consumidor ganha um hover local, registrado.
- O `themeContrast.test.ts` ganha os pares que faltarem para o texto sobre esses fundos de estado, nos dois temas:
  `foreground` e `muted-foreground` sobre `accent`, e sobre `accent/50` composto sobre `card`. Se o `muted-foreground`
  reprovar, o hover usa `text-foreground`.
- Os testes existentes que afirmam as classes antigas mudam no mesmo commit (`grep` por `bg-muted` nos testes).
- Cada componente tocado ganha `Histórico` datado no `ui-registry.md`.
- A prova por estilo computado fica no C1 (§13): hover de um `outline` e de um `ghost` dentro de cartão e de um `StatLink`.
- P83 muda para "Resolvido", com `Atualização` datada.

## 10. Skill `handoff-visual`

`.claude/skills/handoff-visual/SKILL.md` + `templates/`, escrita como as outras do projeto e seguindo as regras de escrita
para agentes (`writing-for-agents`), **sem nenhum nome de protótipo**.

- **Gatilho:** "implementar um handoff do Claude Design" (uma tela com README, `.dc.html` e screenshots).
- **Primeiro passo, sempre:** ler o roteiro (`.git/sdd/roadmap/roteiro.md`) e o mapa da tela (`map-<slug>.md`), e o
  ledger da branch se existir. Fora do git: se faltarem, perguntar ao dono antes de seguir.
- **Corpo:** as Etapas 0 a 11 do roteiro §6.3, cada uma com o critério de saída, os comandos `visual:*` de cada etapa,
  as regras da máquina (§6.4 do roteiro) e a tabela "onde cada lição entra" (§6.5).
- **Modelos** (`templates/`), com marcadores `<slug>`, `<data>` e `<base>`:

| Modelo | Base |
|---|---|
| `global-constraints.md` | roteiro §6.6 |
| `plan-contract.md` | o contrato do plano do PR A, generalizado (fontes, proibições, formato de tarefa, tabela de donos, interfaces) |
| `task-brief.md` | o brief por tarefa (texto da tarefa, Global Constraints, caminhos, como commitar) |
| `review-brief.md` | os dois eixos e as conferências da Etapa 4.3 (registro com `registry-diff`, guardas, `<script>` acima de `Suspense`, render sem relógio, cor literal, estilo computado, contraste nos fundos reais e estados, as quatro armadilhas do Tailwind 4 e do twMerge, `leading-[normal]`, pílula sem borda, `bg-muted`) |
| `final-review-brief.md` | as três lentes (A dados e segurança; B interface e acessibilidade; C testes, documentos e plano) |
| `pixel-brief.md` | Etapa 5: ambiente, seed, cópias, pares, terceira largura, sidebar recolhida, meta e resíduos aceitos |
| `legibilidade-brief.md` | Etapa 6: `visual:audit`, telas vizinhas, lista "Só layout antigo" |
| `pr-body.md` | resumo, decisões, desvios, tabela do pixel, plano de teste, atribuição |

## 11. Documentos

- **`AGENTS.md`:** "Skills disponíveis" ganha `/handoff-visual`; "Comandos" ganha os oito `visual:*` (o que cada um faz,
  numa linha) e a nota de que as ferramentas de navegador rodam com `node`. O bloco gerado pelo `next dev` no topo fica
  como está.
- **`.context/library-docs.md`:**
  - §1: "rotas paralelas sob validação estrita": o espelho por segmento, a regra do segmento novo, o guarda que roda o
    validador interno do Next (caminho fixado na 16.4.6), e as candidatas proibidas (`(app)/default.tsx`,
    `looseRouteMatching`);
  - §9, §10 e §14: as frases sobre o `[...catchAll]` passam a descrever o espelho; o §10 ganha o `hydration.spec.ts`;
  - **§21 (nova):** `pixelmatch` 7.2.0 + `pngjs` 7.0.0, exatas, só em `scripts/visual/`;
  - **§22 (nova):** as ferramentas do processo visual (regras do §5.1, pastas do §5.2, `check-names` e hook).
- **`.context/architecture.md`:** uma entrada no registro de decisões para o PR B (PB-D1 a PB-D9 e as duas devDependencies).
- **`.context/pendencias.md`:** P81 → "Resolvido"; P83 → "Resolvido"; P44 e P62 ganham `Atualização` datada (P62 como
  ciência: o processo manda conferir o CI antes de pedir o merge). Pendência nova entra como "Aberto, não triado".
- **`.context/ui-registry.md`:** os `Histórico` dos componentes do §9.
- **`.context/progress-tracker.md`** e **`memory.md`**: no fim, pelo controlador.
- **Fora do git:** o roteiro §2 e §3 depois do merge (o que nasceu de fato).

## 12. Testes

| Arquivo | Cobre |
|---|---|
| `src/app/routeStructure.test.ts` | §4.6, itens 1 a 5 (inclui a causa sintética) |
| `src/app/appPagesAuth.test.ts` | a lista fechada nova de páginas nulas |
| `src/app/mutedBackground.test.ts` | a expressão (casos positivos e negativos), a varredura e as exceções vivas |
| `src/app/themeContrast.test.ts` | os pares novos de texto sobre `accent` e `accent/50` |
| testes de `button`, `badge`, `table`, `card`, `dialog`, `field`, `AdminOverview`, `BarList`, `StatLink` | as classes novas |
| `test/hydrationCheck.test.ts` | o verificador puro |
| `e2e/hydration.spec.ts` | as páginas da tabela do §8 |
| `test/visual/paths.test.ts` | `isInside`, `resolveInside` (fuga por `..`, absoluto fora, maiúsculas no Windows) |
| `test/visual/config.test.ts` | as URLs aceitas e recusadas, portas proibidas, `parseCliArgs`, `parseSizes` (vazio, zero, negativo), `fakeClientIp`, a chave do tema igual a `THEME_STORAGE_KEY` e o cookie igual a `INVITE_COOKIE` |
| `test/visual/screen.test.ts` | `validateScreen` (pessoa, tema, largura, caminho, cópia, passos), `resolvePath`, `minHeight` |
| `test/visual/vocabulary.test.ts` | e-mails só `@example.com`, nomes terminados em " Teste", cores válidas, sem repetição; **com a lista presente** (só local), nenhum termo dela no vocabulário |
| `test/visual/seed.test.ts` | no PGlite dos testes: `seedBase` cria 4 setores, 12 turnos, 9 itens, 5 destinos e 4 convites; `inicio:admin` monta 7 abertas, 3 paradas e a pendente do Bruno; `inicio:sem-turnos` desliga os turnos do ULD; estado e setor desconhecidos lançam |
| `test/visual/avatarArt.test.ts` | a arte do seed é igual à do `avatarDataUri` do app para a mesma semente |
| `test/visual/envScript.test.ts` | o `env.sh` usa a 54332 e a 3202, acha o `.git/sdd` pelo `git rev-parse` e nunca imprime o segredo |
| `test/visual/image.test.ts`, `test/visual/diff.test.ts` | recorte, máscara (dentro, na borda, fora), pilha, folha de contato; diferença zero, total e com máscara; tamanhos diferentes |
| `test/visual/proto.test.ts` | troca ausente (erro com o número), `data-props` lido e escrito, prop desconhecida, sobra de termo da lista |
| `test/visual/steps.test.ts` | `validateSteps` (cada `kind`, campos que faltam), `requestMatches` (glob, regex, método, cabeçalho), `globToRegExp` |
| `test/visual/screens.test.ts` | as três configurações versionadas são válidas e cada `seed` existe em `STATES` |
| `test/visual/contrast.test.ts` | cores (`rgb`, `rgba`, lixo), composição, razões conhecidas, texto grande, o `auditScript()` montável |
| `test/visual/names.test.ts` | lista (comentário, vazia, `!`), acento e caixa, palavra inteira, frase, e-mail, permitido que contém proibido, diff com vários arquivos e hunks |
| `test/visual/installHooks.test.ts` | o script do hook e a marca |
| `test/visual/docs.test.ts` | edição de entrada (histórico, troca única, troca repetida, entrada sem histórico), cabeçalhos sumidos e novos |
| `test/skillHandoffVisual.test.ts` | o `SKILL.md` tem `name` e `description`, cita os oito modelos e cada modelo existe |

## 13. Prova (controlador, depois das tarefas)

1. **Ambiente:** `bun run visual:db` em segundo plano; `. scripts/visual/env.sh && bun run build && bunx next start -p 3202`
   (os números finais são de produção); `bun run visual:seed base`, `bun run visual:people`, `bun run visual:seed avatars`.
2. **Cópias do Início:** o controlador escreve `.git/sdd/processo/proto.config.mjs` com os dois handoffs do Início
   (`.git/sdd/visual/handoff/` e `.git/sdd/visual/handoff-correcoes/`) e as dez cópias do §5.5; `bun run visual:proto
   --config=processo/proto.config.mjs` termina sem sobra de nenhum termo da lista.
3. **Pares:** `bun run visual:pairs --screen=inicio --out=processo`. Resultado em `.git/sdd/processo/pixel.md`, com a
   tabela contra os números do PR A (§15).
4. **Falha de rede:** `node scripts/visual/interact.mjs --screen=provas --state=falha-de-rede --out=processo`: com a
   Server Action do "Agora não" abortada, o registro mostra pelo menos uma requisição `POST` com `next-action` falhada e
   o cartão "Convide sua equipe" continua na tela (captura).
5. **Hover:** `probe.mjs --app-only` nos três estados de hover do `screens/provas.mjs`: o `backgroundColor` computado com
   o mouse em cima é diferente do fundo opaco do pai.
6. **Legibilidade das telas tocadas pelo §9:** `bun run visual:audit --screen=legibilidade --out=processo
   --only=<as telas com Button outline/ghost, tabela, rodapé de cartão ou de diálogo, Dashboard e Administração>`, nos
   dois temas: nenhum achado novo de contraste ou de fundo que some.
7. **Texto plantado:** com o hook instalado, um arquivo temporário com a linha sentinela da lista (uma frase inventada,
   gravada na lista só para isto) é posto no índice: `git commit` é recusado pelo hook e `bun run visual:names --staged`
   sai com 1. Depois, o arquivo sai do índice e do disco.
8. **Diff da branch:** `bun run visual:names --range=main...HEAD` sai com 0.

## 14. Riscos

| Risco | Mitigação |
|---|---|
| O guarda importa módulos internos do Next, que podem mudar de lugar numa atualização | o teste quebra com mensagem clara; o caminho fica no `library-docs.md §1`; a causa sintética avisa se o comportamento mudar |
| Esquecer o espelho ao criar um segmento novo em `(app)` | o guarda reprova; a regra está no `library-docs.md` e na skill |
| O build de produção (Turbopack) tratar o espelho de outro jeito que o dev | E2E de Solicitações (b) e (e) e o "Página não encontrada" no portão; o `hydration.spec.ts` passa nas quatro páginas de fora |
| Generalizar demais as ferramentas | só os passos e campos que o PR A usou ou que o roteiro já pede (falha de rede, amostra, arrasto); nada de "plugin" |
| Os números do pixel mudarem com o vocabulário novo, o movimento reduzido ou a segunda rodada do PR A | faixa de tolerância (§15) e investigação com `measure`/`sbs` antes de aceitar; texto diferente entre os lados é defeito da ferramenta |
| O `bg-accent` sumir onde o fundo já é `accent` | conferência dos consumidores (§9) e as sondas de hover (§13) |
| Falso positivo do `check-names` com nomes fictícios | linhas `!` na lista; o relatório aponta a linha |
| O hook travar commits sem a lista | mensagem com o caminho da lista e o `visual:hooks --remove` |
| Memória (1 a 3 GB livres) | um servidor e um navegador por vez; Vitest por arquivo; build e E2E só no portão |
| A emenda do Motion mexer nos mesmos arquivos (`Button`, `Sheet`) | ela entra no plano depois da T10 (M1 e M2), em série, e o C1 reroda os pares do Início pelas ferramentas deste PR já com ela (§16.7) |

## 15. Critério de pronto

1. **404:** no `bun run dev`, `/entrar`, `/convite/<token>`, `/redefinir-senha` e `/privacidade` respondem 200 e o log não
   tem "do not match any complete route"; o `routeStructure.test.ts` está verde (e o relatório da tarefa mostra o vermelho
   na árvore antiga); E2E de Solicitações (b) e (e) e o "Página não encontrada" verdes.
2. **Pares do Início pelas ferramentas permanentes** (build de produção), cada par com a mesma altura nos dois lados e
   dentro da faixa: página até o número do PR A **mais 0,02 ponto percentual**, sem passar de 0,11% (o menu aberto, de
   0,22%); no pack, o cartão até 0,005%. Os números de referência:

   | Par | 1440 | 390 |
   |---|---:|---:|
   | admin-escuro | 0,001% | 0,073% |
   | admin-claro | 0,000% | 0,066% |
   | primeiro-escuro | 0,054% | 0,069% |
   | primeiro-claro | 0,054% | 0,062% |
   | continuar | 0,001% | 0,107% |
   | sem-turnos | 0,001% | 0,103% |
   | menu (só 390, a janela) | — | 0,214% |
   | entregue-escuro-uld (página / cartão) | 0,001% / 0,000% | 0,093% / 0,000% |
   | confirmada-escuro-uld (página / cartão) | 0,001% / 0,001% | 0,092% / 0,002% |
   | entregue-claro-carga (página / cartão) | 0,000% / 0,000% | — |
   | confirmada-claro-operacoes (página / cartão) | 0,000% / 0,001% | — |

   Os estados `entregue` e `confirmada-operador` do protótipo antigo não entram: o pack os substituiu.
3. **Falha de rede:** a prova do §13.4 registra a requisição abortada e o `interact.mjs` sai com 0.
4. **Nomes:** a prova do §13.7 recusa o commit; o `--range=main...HEAD` sai com 0.
5. **Guardas verdes:** `routeStructure`, `appPagesAuth`, `mutedBackground` (com a exceção viva), `themeContrast`,
   `rawColors`, `uiRegistryDoc`, `pendenciasDoc` e os `test/visual/*`; o `e2e/hydration.spec.ts` verde; as sondas de hover
   do §13.5 com fundo diferente do pai.
6. **Portão:** `bun run check-types`, `bun run lint`, o Vitest em partes (`src/app`, `src/components`, `src/features`,
   `src/lib`, `test`), `bun run test:e2e` e `bun run build` verdes; `git ls-files` sem fonte, protótipo ou screenshot;
   `git status` limpo.
7. **Documentos** do §11 feitos, com as pendências na seção certa.

## 16. Motion (emenda de 2026-11-27)

**Origem:** a decisão do dono "Motion nos componentes" (2026-11-27, fora do git em `.git/sdd/roadmap/decisions.md`), com a
ArcUI (https://uiarc.dev, itens livres sob MIT) como referência e a forma por conta do Claude. O PB-D6 (§2) continua e ganha
a espera do `style` (§16.2, regra 6).

O que a pesquisa da emenda mudou no desenho (vai ao dono como ciência, com o §16.1):

- O `domAnimation` não traz `layout` nem `layoutId` (só o `domMax`): o thumb do `SectorPicker` e o knob do `ThemeSwitch`
  deslizam por FLIP com `useSpring`; o repouso continua no CSS, como hoje, e só a troca anima.
- O Base UI só espera a saída de um popup se ela tiver opacidade (o Motion a roda pela Web Animations API, que o
  `getAnimations()` vê): a gaveta, que hoje só desliza, passa a sair com fade. Sem `keepMounted`: o popup montaria depois
  da hidratação, com ids `_r_`, e o guarda do §8 reprovaria.
- O `useReducedMotion` do Motion lê o `matchMedia` uma vez por módulo: o ramo reduzido de cada componente vem do
  `usePrefersReducedMotion` do projeto, e o `MotionConfig reducedMotion="user"` da raiz fica como rede.
- A troca de setor remonta o cartão do turno (P86, P87): a camada de cor lembra a cor do último cartão por até 2 s, senão o
  crossfade nunca rodaria.
- O jsdom não tem `Element.animate` nem `getAnimations`: lá o Motion anima em JS e o Base UI desmonta na hora. A saída
  esperada pelo Base UI só se prova no Chromium (`e2e/motion.spec.ts`).

### 16.1 Decisões (engenharia; vão ao dono como ciência)

| # | Decisão | Por quê |
|---|---|---|
| PB-D10 | **`motion` 14.14.0, exata** (2026-11-13), em `dependencies`; `LazyMotion features={domAnimation} strict` e só `m` (`import * as m from "motion/react-m"`) | o `m` com o `domAnimation` pesa cerca de um terço do `motion` pronto, e o `strict` lança se alguém usar o `motion` pronto; o `domMax` (layout e arrasto) dobraria o peso e nada daqui precisa dele |
| PB-D11 | `MotionConfig reducedMotion="user"` e a transição padrão curta num **provider client só de contexto** (`src/components/motion/MotionProvider.tsx`) no `<body>` do `RootLayout`, por fora do `TooltipProvider` e do `Toaster`; **nenhum `<script>`** | a lição do `next-themes` (`library-docs.md §18`): o que fica acima dos `Suspense` não renderiza script; os portais herdam o contexto |
| PB-D12 | durações, curvas, molas e os presets por componente (`sheetMotion`, `overlayMotion`, `tooltipMotion`) num módulo puro, **`src/lib/motion.ts`**; guarda **`src/app/motionUsage.test.ts`** | um lugar só para os números; o guarda recusa número solto, o `motion` pronto e o `framer-motion` |
| PB-D13 | o ramo reduzido de cada componente vem do **`usePrefersReducedMotion`** (sai de `src/components/dashboard/` para `src/lib/`, num refactor à parte); o `MotionConfig "user"` é a rede | o hook relê o `matchMedia` a cada render (testável por stub); o do Motion lê uma vez por módulo e avisa no console |
| PB-D14 | **Base UI + Motion pela função `render`** do `Popup`/`Backdrop`, com `state.open`; a saída sempre leva opacidade; **sem `keepMounted`**. Sem animação de layout: o que desliza usa **FLIP com `useSpring`** e o repouso fica no CSS | o Base UI espera a saída pela opacidade (Web Animations); popup montado depois da hidratação teria ids `_r_` (§8); repouso no CSS deixa o pixel e o HTML do servidor iguais aos de hoje |
| PB-D15 | a ArcUI é **referência de comportamento, não dependência**: nada dela é instalado; trecho de código copiado leva o aviso de copyright MIT num comentário | ela usa Radix e CSS modules com tokens próprios (dois primitivos lado a lado, fora dos guardas de token e contraste) |

Nenhum trecho de código da ArcUI entra nesta emenda (as páginas dela só descrevem o comportamento): nenhum aviso MIT no
código, e os valores (durações, molas, deslocamentos) são nossos.

### 16.2 Regras (vão para o `ui-rules.md §9`)

1. **Curto e nunca no caminho da passagem:** nenhuma duração ou mola passa de 0,45 s; a saída é mais curta que a entrada;
   nada espera uma animação para liberar um clique, um envio ou uma navegação (regra de ouro).
2. **Nada anima na carga nem na hidratação:** o que vem do servidor sai do HTML no lugar (repouso no CSS com `x = 0`, ou
   `initial={false}`); valor em `initial` só em quem monta no cliente depois de uma ação.
3. **Sempre respeita o movimento reduzido:** sem deslize, escala nem mola; no máximo um fade de 0,1 s, ou a troca na hora.
4. **Só `transform` e `opacity`;** a cor troca por uma camada com opacidade. Mola no que pode voltar no meio; tween no fade.
5. **Um dono por propriedade:** elemento que o Motion anima não tem `transition` de CSS na mesma propriedade.
6. **As capturas do processo visual rodam com movimento reduzido e esperam as animações:** todo contexto do Playwright em
   `reducedMotion: "reduce"`, sem opção para desligar (o `newContext` do `capture.mjs`, que o `openApp`, o `openProto` e o
   `openState` usam, e o contexto que o `audit.mjs` monta, pela mesma constante `CAPTURE_REDUCED_MOTION` de
   `scripts/visual/settle.mjs`); o `settle` do `capture.mjs` (que o `shoot` e o `audit.mjs` chamam) espera o
   `getAnimations()` (CSS e Web Animations) e depois 200 ms sem escrita no `style` de nenhum elemento (as molas e cores que
   o Motion anima em JS), até 3 s, mais os 300 ms de antes.

### 16.3 Os componentes que já se mexem

| Componente | O que anima | Normal | Movimento reduzido | Prova |
|---|---|---|---|---|
| `Button` (o elemento vira `PressButton`) | aperto | escala 0,97 na mola `press` (0,15 s); nunca no gatilho de popup (`aria-haspopup`), que responde só com a cor | sem escala | `button.test.tsx`, `e2e/motion.spec.ts` |
| `ThemeSwitch` | knob | repouso no CSS (`left-1`, `dark:left-9`); no clique, FLIP pelo `offsetLeft` e mola `knob` (0,3 s, sobra 0,15) | troca na hora | `ThemeSwitch.test.tsx` |
| `SectorPicker` | thumb | repouso no CSS (`--i`, `--n`, como hoje); na troca, FLIP pela largura do thumb e mola `thumb` (0,35 s, sobra 0,2, como a curva do protótipo) | vai direto | `SectorPicker.test.tsx` |
| `Sheet` e a gaveta do menu | painel e véu | painel chega de 40px (a gaveta, da borda: −105%, opaca) pela mola `panel`, com fade de 0,15 s; sai em 0,18 s com fade; véu em fade | fade de 0,1 s | `sheet.test.tsx`, `AppSidebar.test.tsx`, `e2e/motion.spec.ts` |
| `MyShiftCard` (camada `SectorColorFade`) | troca de cor do setor | a cor de antes por baixo do conteúdo some em 0,4 s, também quando o cartão remonta (até 2 s) | troca na hora | `SectorColorFade.test.tsx`, `MyShiftCard.test.tsx`, `e2e/motion.spec.ts` |
| `Tooltip` | entrada | sai do gatilho (4px) crescendo de 0,96, em 0,2 s; fecha na hora | fade de 0,1 s | `tooltip.test.tsx` |

Em repouso todo elemento fica onde o CSS o põe (`transform: none`, opacidade 1): os pares do Início continuam dentro da faixa
do §15.2. O `button.tsx` continua sem `"use client"` (o `buttonVariants` é chamado em Server Components) e passa o
`PressButton` (client) como elemento pelo `render`; o `<Link>` cru com `buttonVariants` continua com o aperto de CSS
(`not-data-[press]`), sem Motion.

### 16.4 Documentos

- `library-docs.md §23` (nova): versão, `LazyMotion` e `m`, provider, hidratação, ramo reduzido, Base UI, CSS × Motion,
  testes, capturas, guarda e a ArcUI (com o que as branches C a G vão olhar nela). No §22, a linha das capturas aponta o
  §23.
- `ui-rules.md §9` (nova) e um item no checklist do §8; `ui-tokens.md §8` (nova); `AGENTS.md`, uma linha em "Regras que
  nunca mudam"; `architecture.md`, PB-D10 a PB-D15 na entrada do PR B, a dependência e um trade-off (o peso).
- A skill `handoff-visual`: uma linha de movimento no modelo `templates/global-constraints.md`, para as branches C a G
  fazerem cada componente novo ou restilizado nascer com Motion, olhando a variante da ArcUI.
- `ui-registry.md`: entradas novas `MotionProvider`, `PressButton` e `SectorColorFade`; `Histórico` datado em `Button`,
  `ThemeSwitch`, `SectorPicker`, `Sheet`, `Sidebar`, `Tooltip`, `MyShiftCard` e `usePrefersReducedMotion`.
- `pendencias.md`: a P87 ganha `Atualização` (o crossfade passa a rodar, também na remontagem) e continua aberta (a
  transição na troca de tema não foi conferida).

### 16.5 Testes (somam ao §12)

| Arquivo | Cobre |
|---|---|
| `src/lib/motion.test.ts` | tokens no teto, saída mais curta, curvas válidas, aperto, presets por lado e tipo, ramo reduzido sem deslize, módulo só com tipos do Motion |
| `src/components/motion/MotionProvider.test.tsx` | só contexto (o HTML é o dos filhos), `reducedMotion: "user"` e a transição padrão, features carregadas, `strict` |
| `src/app/motionUsage.test.ts` | as regras (positivos e negativos), a varredura de `src/`, os arquivos que usam o Motion e o `RootLayout` com o provider e um script só |
| `test/visual/settle.test.ts` | o veredito do silêncio (limite, escrita recente, estouro), o script montado e rodado numa página falsa, a recusa de números ruins |
| `button.test.tsx`, `button.variants.test.ts`, `ThemeSwitch.test.tsx`, `SectorPicker.test.tsx`, `sheet.test.tsx`, `AppSidebar.test.tsx`, `SectorColorFade.test.tsx`, `MyShiftCard.test.tsx`, `tooltip.test.tsx` | o HTML do servidor sem animação, o primeiro quadro, o valor no meio (ramo normal) e o pulo direto (ramo reduzido), o fim no lugar |
| `e2e/motion.spec.ts` | no Chromium: o aperto (`matrix(0.97…)`), a gaveta que entra da borda e ainda está no DOM depois do Escape, o ramo reduzido, e a camada de cor na troca de setor |

### 16.6 Critério de pronto (soma ao §15)

1. `"motion": "14.14.0"` no `package.json` (sem `^`) e o `bun.lock` junto.
2. Os testes do §16.5 verdes; o `e2e/motion.spec.ts` e o `e2e/hydration.spec.ts` verdes no portão.
3. Os pares do Início (C1) dentro da faixa do §15.2 com o Motion já aplicado.

### 16.7 Riscos

| Risco | Mitigação |
|---|---|
| O Motion mexer no pixel em repouso | repouso no CSS e `transform: none`; capturas com movimento reduzido; pares do C1 depois da emenda |
| O Base UI desmontar antes da saída | a saída leva opacidade; o `e2e/motion.spec.ts` confere a gaveta ainda no DOM depois do Escape |
| Peso em toda página | `LazyMotion` + `m` + `domAnimation`, nada de `domMax` (cerca de 25 KB comprimidos, pela doc do Motion) |
| A API do Motion mudar numa atualização | versão exata; os testes de componente e o E2E pegam; a API da 14.14.0 foi conferida na doc e se confirma no `check-types` da M1 e da M2 |
| CSS e Motion na mesma propriedade (a animação "arrasta") | regra 5, as classes de transição saíram dos componentes do §16.3, e o `Button` lista as transições sem `transform` |
