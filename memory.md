# Memory — Fases 0 a 6 (código) prontas; Início novo na main; o processo visual (PR B) espera o merge; o go-live continua pendente

Last updated: 2026-11-28 (UTC-3)

---

## Estado para a próxima sessão (2026-11-28)

- **Branch `chore/processo-visual` (PR B): pronta para o PR e o merge.** Ela traz: o espelho exato do slot `@detalhe`
  (uma página nula do slot por página de `(app)`, nenhum catch-all: o `next dev` volta a servir `/entrar`, `/convite`,
  `/redefinir-senha` e `/privacidade`, P81, e o build de produção perde o laço de prefetch que o catch-all do slot
  causava, inclusive o da `main` entre duas `/passagens/<id>`), o guarda que roda o validador de rotas do Next
  (`src/app/routeStructure.test.ts`) e o `e2e/prefetch.spec.ts`, o `e2e/hydration.spec.ts`, o `bg-muted` → `bg-accent`
  com o guarda (P83), as ferramentas visuais permanentes em `scripts/visual/` (`library-docs.md §22`), o `check-names`
  no `pre-commit`, a skill `/handoff-visual` com os oito modelos e o Motion (`motion` 14.14.0: a fundação e os
  componentes que já se mexiam; `library-docs.md §23`, `ui-rules.md §9`). Decisões no `architecture.md §10` ("Processo
  visual (PR B)"), com os desvios que vão ao dono como ciência (o hover escuro do `destructive` em `/18`, o espelho
  exato, o "Agora não" do convite que passou a pedir JS).
- **A próxima branch:** C, Passagens (`feat/visual-passagens`), criada da `main` atualizada depois do merge. Comece por
  `/handoff-visual`: ela lê o roteiro (`.git/sdd/roadmap/roteiro.md`), o mapa (`map-passagens.md`) e o ledger, nessa ordem.
  O mapa ganhou o item 12 dos riscos: o snapshot da pendente no seed visual diz o turno errado, e a branch C corrige.
- **A verificação visual agora é do repositório:** `bun run visual:db`, `. scripts/visual/env.sh`, `visual:seed`,
  `visual:people`, `visual:proto`, `visual:pairs`, `visual:audit`. O app visual sobe com `-H localhost`. O que ela ensinou
  continua valendo: o protótipo renderizado manda; os números finais saem do build de produção; foco, contraste e tamanho
  se provam por estilo calculado; o contraste se mede sobre cada fundo real e estado; nunca a porta 3000; nenhum nome nem
  texto do protótipo no git. Antes dos pares de uma tela com passo que grava (D e E), a P110 (o `pairs.mjs` semeia uma
  vez por estado).
- **A lista de nomes** (`.git/sdd/nomes-proibidos.txt`, fora do git) acumula por branch: cada handoff novo acrescenta os
  nomes, e-mails e textos dele na Etapa 0. O `--range` do portão confere só o diff líquido (P112), e um termo da lista já
  está na `main` em cinco arquivos do PR A (P113): editar uma dessas linhas faz o hook recusar o commit.
- **Antes de planejar D, E e F:** os mapas do roteiro (`map-passagem-de-turno.md`, `map-solicitacao-completa.md` e
  `map-solicitacoes.md`) ainda citam o `--destructive` antigo; o valor atual é `#b80000` no claro e `#ff9393` no escuro,
  com o hover escuro do botão em `/18` (P107).
- **Decisões esperando o dono:** T20 do lote 0 (pedir ao designer as telas sem handoff, P82), P85 (contraste do seletor no
  claro), P86 (setas do seletor), P99 (avatar com "outra pessoa"), P100 (o bloco verde no setor verde), P108 (o setor rosa
  com a cor do cartão de convite) e P113 (o termo da lista na `main`); e, como ciência, os desvios do PR B acima.

## Onde o projeto está

**Fundação de testes e acesso prontos.** O app Next.js 16.4.6 tem testes automatizados de verdade
(Vitest com PGlite e Testing Library; Playwright com banco efêmero via pglite-socket) e acesso completo: cadastro só
por convite (e-mail e senha, Google e Facebook condicionais ao env), login com passkey, papéis
admin/operador escopados por setor, telas `/entrar`, `/convite/[token]`, `/bem-vindo`, `/conta`,
Início, `/admin` e o shell com sidebar.

**Cadastros prontos (Fase 2).** `/admin` tem os cinco cartões e as telas `/admin/setores`,
`/admin/turnos`, `/admin/itens`, `/admin/destinos` e `/admin/equipe`: nada se apaga (só desativa),
turno avisa sobreposição, ordem por botões ↑ ↓, unidade do item por escolha com "Outro", equipe com
papel, setor, desativação (que derruba as sessões, P11) e convites com link para copiar ou compartilhar.
Plano executado em `docs/superpowers/plans/2026-11-21-fase-2-cadastros.md`.

**Passagem pronta (Fase 3).** O Início (`/`) mostra "Passagem para confirmar" (a mais recente entregue do
setor, para quem não a entregou) e "Passagem do meu turno"; `/passagens/nova` abre o formulário do turno
certo sem digitar nada (turno e dia sugeridos pelo relógio de São Paulo, números em `0`) com salvamento
automático por campo e "Entregar turno"; `/passagens/[id]` é o resumo na ordem do briefing com "Confirmar
recebimento" (quem entregou não confirma); quem entregou ainda edita até a confirmação, depois só o admin
corrige, com motivo e uma linha de rastro por campo; `/passagens` é o histórico com filtros na URL, "sem
passagem", "não confirmada" e o selo "Corrigida". O admin escolhe o setor na tela (URL + cookie). Plano executado em
`docs/superpowers/plans/2026-11-21-fase-3-passagem.md`.

**Solicitações prontas (Fase 4).** `/solicitacoes` mostra as solicitações do setor em Quadro (três colunas com a
contagem do servidor e "Carregar mais"), Lista (quatro grupos; padrão no celular) e Tabela (paginada), com filtros
na URL; "Nova solicitação" é um diálogo que nunca começa em branco (destino da lista ou "Outro", itens de estoque
com quantidade); "Mover para …" troca o cartão de coluna antes da resposta (`useOptimistic`) e cancelar exige o
motivo. Clicar numa solicitação abre o detalhe num Sheet sobre a tela (rota interceptada `@detalhe`); recarregar abre a
página completa. A passagem mostra "Solicitações abertas": no formulário, as de agora (com "Nova solicitação" ligada
à passagem); no resumo, as que estavam abertas **no instante da entrega**, com o status daquele instante. O Início
ganhou o cartão "Solicitações". Solicitação não se edita (D-F4-1). Plano executado em
`docs/superpowers/plans/2026-11-23-fase-4-solicitacoes.md`.

**Dashboard pronto (Fase 5).** `/dashboard` (todos os papéis; o operador vê o próprio setor, o admin escolhe o setor ou
"Todos os setores") mostra o período no topo (últimos 7 dias, últimos 30 dias ou intervalo de até 93 dias) e quatro blocos:
Passagens (esperadas, entregues, confirmadas, aguardando recebimento, não confirmadas e sem passagem, com o anel de 4 fatias),
Controles (um `metric-card` por item: total, média por turno, variação contra o período anterior, um segmento por turno), Estoque
(última contagem e a linha do período) e Solicitações (abertas e paradas agora, entregues no período, tempo até a entrega por destino,
quantidade pedida por item). **Todo número é um link** para a lista filtrada que conta exatamente aquilo (`/passagens` e
`/solicitacoes` ganharam os filtros que faltavam). "Exportar CSV" baixa as passagens do período e do escopo da tela
(`GET /api/dashboard/export`). Só leitura, sem migração. Plano executado em `docs/superpowers/plans/2026-11-24-fase-5-dashboard.md`.

**Produção: código pronto (Fase 6).** O app tem `vercel.json` (`gru1`, previews desligados), cabeçalhos de segurança e
noindex, log sem dado de pessoa (`logServerError`), `admin:invite --confirmar-host` e `bun run db:hosts`, Better Auth
endurecido, **redefinição de senha pelo link que o administrador gera em `/admin/equipe`** (sem e-mail: P8 segue aberta),
Sentry (só com `NEXT_PUBLIC_SENTRY_DSN`), alvos de toque de 44 px, a página pública `/privacidade` (rascunho até a empresa
aprovar) e `bun run smoke <url>`. **Nada foi para produção:** o go-live (Neon e Vercel novos, migração, primeiro
administrador, convites) é o passo a passo de `.context/runbook-producao.md`, conduzido com o dono, com confirmação dele
em cada passo voltado para fora. Plano executado em `docs/superpowers/plans/2026-11-25-fase-6-producao.md`.

**Visual novo do Início e do shell (2026-11-27, na main pelo PR #8).** O tema escuro é o padrão, com um switch
para o claro, e a paleta nova vale para todas as telas; só o Início e o shell mudaram de layout. O Início mostra a saudação com a
data, o seletor de setor deslizante (admin), "Passagem para confirmar" (amarelo: só o que precisa de atenção), "Convide sua equipe"
(primeiro acesso do admin), "Passagem do meu turno" na cor do setor (`sector.color`) e "Solicitações". As outras telas seguem no
layout antigo até os handoffs delas (fila do roteiro e P82).

**Processo visual (PR B, 2026-11-28).** O `next dev` serve as páginas de entrada de novo (o espelho exato do slot `@detalhe`).
A verificação visual das telas do Claude Design mora em `scripts/visual/` (banco 54332, app 3202, pessoas e textos
inventados, pares, auditoria e as guardas), descrita no `library-docs.md §22`, e o processo inteiro está na skill
`/handoff-visual`. O `pre-commit` local recusa qualquer termo da lista de nomes. O movimento é do Motion (`m` de
`motion/react-m`, tokens em `src/lib/motion.ts`, sempre com o ramo reduzido): componente novo ou restilizado das
branches C a G nasce com ele, olhando a variante da ArcUI (`library-docs.md §23`).

O design do produto está na spec (`docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md`,
18 decisões em `.context/build-plan.md §5`) e o plano executado em
`docs/superpowers/plans/2026-11-20-fase-0-1-fundacao-e-acesso.md`.

## O que está esperando

- **Processo visual:** o merge do PR B (ver "Estado para a próxima sessão").
- **P81–P108 (visual novo):** o `next dev` dá 404 fora de `(app)` (P81, resolvida no PR B); telas sem desenho novo (P82); `bg-muted`
  some dentro de card (P83, resolvida no PR B); borda dos campos no claro (P84); contraste do seletor no claro (P85); setas do seletor (P86); crossfade e transição de
  tema não conferidos (P87); cor na lista de Setores (P88); "Agora não" sem retorno (P89); foco fraco e borda de erro (P90); variantes
  `destructive` fora do guarda (P91); peso dos avatares (P92); `ª`/`º` na Satoshi (P93); id de quem salvou no navegador (P94);
  `global-error` sem tema (P95); 6 contagens no Início do admin (P96); `uiRegistryDoc` sem `app-shell` (P97); `rawColors` sem `.ts`
  (P98); avatar com "outra pessoa" (P99); o bloco verde no setor Eco (P100); tema no Strict Mode do dev (P101); build dependente do
  Fontshare (P102); a prova da borda da amostra (P103); `suggestColorForNewSector` em JS (P104); higiene de testes (P105); sobras de
  código (P106); os mapas do roteiro com o `--destructive` antigo (P107); o setor rosa com a cor do cartão de convite (P108).
- **P109–P118 (processo visual, da revisão final do PR B):** `accent` sobre `accent` (o trilho do `BarList` no hover, o "Agora
  não" do `PasskeyOffer` no escuro e o guarda de estado sem piso; P109); `visual:pairs` semeia uma vez por estado (P110);
  diagnóstico e recusas das ferramentas visuais, com o `?host=` do banco visual (P111); `check-names --range` só no diff
  líquido (P112); um termo da lista já na `main` (P113); as fontes do protótipo vindas da rede (P114); cerca de código solta
  nos documentos (P115); a memória de 2 s do `SectorColorFade` (P116); testes e sondas que provam menos do que dizem (P117);
  o texto da skill, dos modelos e do `library-docs.md §23` (P118). Próximo id livre: P119.
- **Go-live da Fase 6 (Parte B):** seguir `.context/runbook-producao.md` com o dono (B0 a B18). O deploy ainda não foi feito;
  nada é publicado sem o "sim" explícito do dono naquele momento. Sem a aprovação da empresa para `/privacidade` (P64)
  ninguém é convidado.
- **P62–P80 (Fase 6):** `main` sem proteção (P62); o que só o primeiro deploy confirma (P63); LGPD (P64); riscos do Hobby e do Neon
  Free (P65); passkeys presas ao `*.vercel.app` (P66); aba fechada com salvamento na fila (P67); Sentry sem source maps (P68);
  `scrubEvent` só limpa padrões conhecidos (P69); toque só medido no Chromium (P70); sem manifest (P71); tempo de preenchimento
  sem medição (P72); suíte lenta (P73); `admin:invite` sem contagem de administradores (P74); o Next imprime o erro não tratado
  inteiro (P75); o link de nova senha não deixa registro de quem gerou (P76); a redefinição e a desativação não apagam passkeys (P77); `createPasswordResetLink` não é atômico (P78); o React Compiler desiste do `SignInPanel` (P79); nenhum guarda impede um script de importar `logServerError` ou `@sentry/*` (P80). A P67 ganhou uma `Atualização` em 2026-11-27: o aviso ao sair já existe. A P70 também: com o escuro como padrão, o guarda de toque mede no escuro, e o claro é que fica sem medida.
- **P34–P36 (Fase 3):** "sem passagem" usa os horários atuais do turno (P34); o cartão "Passagem para
  confirmar" não tem teto de idade (P35); dois operadores no mesmo rascunho: o último a salvar vence (P36).
- **P44, P46, P47 (Fase 4):** o detalhe rápido depende do cabeçalho `next-url` (P44); um cartão movido para uma coluna
  aberta e truncada só aparece depois da revalidação (P46); o X só com ícone do `EditDialog` continua sem tooltip (P47).
  (P45, o seletor de setor que perdia os filtros de `/solicitacoes`, foi resolvida na Fase 5.)
- **P49–P52 (revisão final da Fase 4):** higiene de testes e o erro `portal "" does not exist` do `pglite-socket` no log
  do E2E (P49); UX (P50); FK composta do comentário (P51); CTE `last` das abertas (P52). (P48, extrair
  `resolveScreenSector`/`paginationParams`, foi resolvida na Fase 5.)
- **P53–P61 (Fase 5):** item que muda de unidade ou de tipo no período não é tratado (P53); o erro do detalhe rápido aparece
  fora do Sheet (P54); helpers do E2E repetidos (P55); destino além do teto de 200 escolhas cai do filtro (P56); índices do
  dashboard só sob medição no Neon (P57); a cor das situações do anel não separa em daltonismo (P58); o CSV se monta em
  memória (P59); duplicações para um commit só de refatoração (P60); ajustes de UX (P61).
- **P23:** editar o nome de uma pessoa (o admin em `/admin/equipe`, a própria pessoa em `/conta`).
- **P24:** a ordem alfabética das listas do admin ignora acento (`C.UTF-8` ordena por ponto de código).
  (P24 e P34 ganharam uma `Atualização` datada de 2026-11-25 na Fase 5; seguem abertas.)
- **P10:** credenciais OAuth do Google não criadas (login social sem teste ao vivo).
  **P6/P7/P8:** Apple Developer, app da Meta, provedor de e-mail — só travam Apple, Facebook e "esqueci a senha" **por e-mail** (a recuperação é o link do administrador).
- **Suposições a validar com o usuário final:** spec §15 (glossário, horários dos turnos, o que é
  solicitação, passagem feita no fim do turno, quem recebe).
- **Remoto:** `origin` = GitHub (`main`, repositório **público**). Commit e push só com pedido do dono;
  nunca `.env.local` nem segredo em commit.

## Coisas que vão te morder se ninguém avisar

- **Testes:** `bun run test` (Vitest) e `bun run test:e2e` (Playwright). **Nunca `bun test`.** Node ≥ 22.12.
- **PGlite não prova corrida:** uma conexão só, serializa tudo. Atomicidade vai no SQL (`UPDATE … RETURNING`).
- **`next build` exige `BETTER_AUTH_URL` e `BETTER_AUTH_SECRET`** (≥ 32 caracteres) no `.env.local` e
  na Vercel; sem eles falha com `Failed to collect page data for /api/health`.
- **O E2E roda o app em produção:** o rate limit do Better Auth está ligado (`/sign-up/email` 10 por
  60 s e `/sign-in/email` 30 por 60 s, por IP); cada teste manda um `x-forwarded-for` próprio. O env do
  `webServer` vence o `.env.local`, então o E2E nunca toca o Neon.
- **Better Auth:** schema de auth escrito à mão (`src/db/schema/auth.ts`) com teste guarda; erro de
  hook é sempre `APIError` com `code`; sem `cookieCache` e sem `nextCookies()`; cadastro e login pelo
  `authClient` (HTTP). Nunca renderizar `error_description` da URL.
- **Cache Components:** sessão (`getAuthz`) só dentro de `<Suspense>`, nunca em `"use cache"`.
- **Base UI, não Radix:** `render`, não `asChild`; navegação com cara de botão é
  `<Link className={buttonVariants()}>`, porque `Button render={<Link />}` vira `role="button"`.
- **jsdom 28 + polyfill de `matchMedia`** (`test/setup-dom.ts`); `check-types` roda `next typegen` antes.
- **Passkey cancelada** chega como `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`: traduza com `passkeyErrorCode`.
- **Passkey:** `rpID` vem de `BETTER_AUTH_URL`; passkey de `localhost` não vale em produção.
- **Primeiro administrador:** `bun run admin:invite --confirmar-host=<host>` (sem a flag mostra o banco de destino e recusa; `bun run db:hosts` mostra os hosts antes do `db:migrate`) imprime o link do convite.
- **Driver é `pg` + `attachDatabasePool`** (D18), não `neon-serverless`. Escrita multi-statement em
  `db.transaction()`; nada de `db.batch`.
- **`.env.local` aponta para a branch de DESENVOLVIMENTO do Neon**; as URLs comentadas no `.env.local` são de um projeto que **não** é o de produção e saem
  no passo B2 (produção = projeto Neon novo, C6-4). Usa `DATABASE_URL` (direta) + `DATABASE_URL_POOLED`
  (o contrário da convenção do `neon env pull`); `src/db/databaseUrl.ts` aceita as duas. Sempre `sslmode=verify-full`.
- **A CLI `neon` está com a sessão expirada** (`neon login` resolve).
- **Componentes KokonutUI vêm com cor crua e em inglês** — adaptar na instalação (`library-docs.md §6`).
- O Playwright MCP grava artefatos em `.playwright-mcp/` (ignorado no git).
- **Nenhum dado real da planilha** (nomes das pessoas) entra em commit, seed ou teste.
- **Server Actions de `/admin`:** `requireAdmin()` na primeira linha de **cada** função exportada (guarda
  `actionsAuth.test.ts`); `actions.ts` só exporta funções `async`; o formulário é controlado e chama a action
  com objeto tipado; `runAdminAction` devolve `AdminResult` (`library-docs.md §12`).
- **`/admin` não tem `layout.tsx` nem `metadata`:** os dois sairiam antes do `notFound()` e revelariam a
  rota ao operador. `<h1>` sempre dentro do `<Suspense>`.
- **`shadcn add dialog` reinstala `button.tsx`** e trava no prompt sem `--overwrite`: rode com `--overwrite`
  e depois `git checkout -- src/components/ui/button.tsx` (customização da P3).
- **`time` é texto** (`"HH:mm:ss"` do banco, `"HH:mm"` no app) e o erro do driver vem embrulhado em
  `error.cause` (SQLSTATE em `error.cause.code`).
- **PGlite não prova o "último admin"**: a garantia é `SELECT … FOR UPDATE` no SQL, provada em sequência.
- **Neon de dev:** collation `C.UTF-8`; `lower('ÁGUA') = lower('água')`, então nomes acentuados colidem
  sem diferença de caixa também em produção.
- **Passagem (Fase 3):** GET nunca escreve: o rascunho nasce no primeiro salvamento e a identidade dele é
  setor + turno + dia operacional (nunca um id guardado no cliente). O salvamento automático **não** chama
  `revalidatePath` (re-renderizaria a tela enquanto a pessoa digita); só entregar, confirmar e corrigir
  revalidam. Confirmada não muda: só `correctHandover` (admin, motivo, uma linha por campo).
- **Dia operacional** de um turno que atravessa a meia-noite é o dia em que ele **começou**; o fuso é
  `America/Sao_Paulo` via `Intl`. Teste de tempo usa `spDate()` (`test/clock.ts`), nunca o relógio real.
- **Next 16 mantém a página anterior escondida** ao navegar: no Playwright `getByText` casa texto
  escondido e o modo estrito reprova; use `.filter({ visible: true })` (helper `text()` de
  `e2e/passagem.spec.ts`) e consultas por papel.
- **E2E da passagem não depende do relógio:** turno `00:00–23:59` e `?turno=&data=` de hoje em São
  Paulo; só o cenário do cartão do Início usa o relógio real.
- **Setor do admin** vem de `?setor=` e do cookie `closery_setor` (gravado só por Server Action, lido
  dentro de `<Suspense>`); "Todos os setores" é só do histórico e não grava cookie.
- **Solicitações (Fase 4; o slot mudou no PR B):** o detalhe rápido é o slot `@detalhe` do layout de `(app)`: além de
  `default.tsx` e `page.tsx` (rota `/`), ele tem o **espelho exato**, uma página nula do slot para cada página de
  `(app)`, no mesmo caminho e com os mesmos nomes de parâmetro (`library-docs.md §14`). Página nova ganha o espelho no
  mesmo commit, senão o Sheet fica aberto sobre a tela nova (o `routeStructure.test.ts` reprova). Nenhum catch-all no
  slot, em nenhum nível: na raiz, o `next dev` dava 404 fora de `(app)` (P81); abaixo dela, o build de produção entra
  num laço de prefetch no segundo link para o mesmo caminho com outra busca (`e2e/prefetch.spec.ts`). E **não** pode
  haver `(app)/default.tsx` (a URL desconhecida deixaria de dar 404).
  `<Link scroll={false}>` abre o Sheet; a página completa (↗) é `<a href>`, senão a navegação seria interceptada de novo.
- **`useOptimistic` só dentro de `startTransition`**, antes do primeiro `await`; `revalidatePath` só em `ok`; em conflito
  o cliente faz `router.refresh()`. Eventos de status se ordenam por `changed_at, seq` (nunca por `id`): `seq` é identity.
- **Escrita de solicitação lê o setor com `FOR SHARE`** (`lockSectorShare`); setor inativo é só leitura (`SECTOR_INACTIVE`).
  Operador de outro setor recebe "não encontrada", nunca "sem permissão".
- **E2E das solicitações:** abra `?visao=quadro` ou `?visao=lista` (sem `visao` as duas visões estão no DOM); com o Sheet
  aberto só `page.getByRole("dialog")` enxerga dentro e o resto da página vira `aria-hidden` (use `page.locator` por baixo);
  fixture sempre com datas relativas a `Date.now()`.
- **Dashboard (Fase 5):** todo número é um `<Link>` gerado por `src/features/dashboard/links.ts` para a lista que conta
  exatamente aquilo, e o teste prova `número = total da lista`; o escopo (setor e período) é `resolveDashboardScope`, o mesmo da
  página e do CSV; o operador que monta `?setor=` de outro setor vê o próprio. "Sem passagem", "esperadas" e as situações saem da
  mesma `historySource` da lista `/passagens` (herda P34). O critério de pronto usa um mundo só (`test/dashboardWorld.ts`) e
  oráculos em JS sobre leitores crus, nunca a SQL do painel.
- **Route Handler (`/api/dashboard/export`):** `requireUser()` na primeira instrução (guarda `routeHandlersAuth.test.ts`: todo
  `route.ts` fora da lista fechada exporta só `GET`); o BOM se prova em bytes (`arrayBuffer`), nunca por `res.text()`; o gatilho é
  `<a href download>`, nunca `next/link`.
- **`chart` do shadcn:** `echo n | bunx shadcn@latest add chart --yes` (o `--yes` sozinho aborta no prompt de sobrescrever
  `card.tsx`) e `react-is` 19.3.0 exato no mesmo commit do recharts. O React Compiler desiste em silêncio do `spending-ring` cru:
  confira com `bun scripts/rc-check.mjs <arquivos>`. "Outros" e o 5º turno em diante são `foreground` (`chart-5` = `foreground`, nunca usado).
- **Blocos do dashboard:** cada um num `catchError` com `key` do período e do setor **no limite**, e a `<Suspense>` com esqueleto
  dentro dele; o `catchError` só limpa o erro quando muda o pathname.
- **Satoshi (visual novo):** o `predev` e o `prebuild` rodam `bun run fonts`, que baixa a fonte do Fontshare e confere o SHA-256;
  sem rede na primeira vez, o `dev` e o `build` não sobem. O `.woff2` nunca entra no git nem em artefato público (licença,
  `library-docs.md §17`). Hash diferente: não aceite no automático.
- **Tema (visual novo):** é próprio (`src/lib/theme.ts` e `useTheme`), sem `next-themes`: o script dele dentro de componente
  client duplicava o conteúdo dinâmico. Escuro padrão, não segue o sistema. O valor do tema em JS só pelo `useTheme()`.
- **`sector.color` exige a `0005`:** sem a migração, toda tela que lê setor quebra (`column "color" does not exist`). No dev,
  `db:migrate` antes do `bun run dev`; em produção, a `0005` vai antes do deploy (runbook B4).
- **Paleta nova:** `--muted` = `--card` = `--popover`, então `bg-muted` dentro de card some (use `accent`); sobre os cartões
  coloridos o foco é `outline-solid` + `ring-0!` (o `outline-none` da base engole o `outline-2`). As armadilhas do Tailwind 4 e do
  `cn` estão em `library-docs.md §3`.
- **Avatares:** `src/lib/avatar.ts` é `server-only` (semente = id do usuário); o componente recebe o data URI pronto.
- **O `pre-commit` do `check-names` numa branch sem `scripts/visual/`** (uma branch antiga): avisa no stderr e deixa o
  commit passar (emenda da spec §7 do PR B); não há hook a tirar nem a reinstalar, e o `--range=main...HEAD` do portão
  continua valendo na branch que tem as ferramentas. Lista ausente ou vazia recusa (código 2). Um achado do hook é texto a
  trocar por um inventado (`scripts/visual/vocabulary.mjs`), nunca motivo para contornar o hook.
- **Motion:** só `m` de `motion/react-m` dentro do `MotionProvider` (o `strict` recusa o `motion` pronto) e só os nomes de
  `src/lib/motion.ts` (guarda `src/app/motionUsage.test.ts`); o teto de 0,45 s vale para o tempo visual da mola, que
  assenta um pouco depois. Elemento que o Motion anima não tem `transition` de CSS na mesma propriedade (`ui-rules.md §9`).
