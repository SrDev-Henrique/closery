# Progress Tracker — Closery

> **Documento vivo + estado da obra.** Atualize **após cada feature** (junto com `ui-registry.md`
> e o log do `architecture.md`). As fases aqui são as mesmas do `build-plan.md`.
>
> Item só fica ✅ com verificação **rodada no terminal** (testes, `check-types`, `lint`, `build`).
>
> **Legenda:** ✅ concluído · 🟡 em andamento · ⬜ pendente · ⛔ bloqueado

---

## ▸ Próximo passo

- **2026-11-28 — Processo visual (branch `chore/processo-visual`, PR B) pronto para o merge.** O Início novo já está na
  `main` (PR #8). Depois do merge, a branch C (Passagens) começa pela skill `/handoff-visual`, que lê o roteiro (fora do
  git, `.git/sdd/roadmap/roteiro.md`: C Passagens, D Passagem de turno, E Solicitações, F detalhe da solicitação, G
  Dashboard). O go-live continua pendente: se o visual entrar antes dele, a migração `0005` vai no passo B4, antes do deploy.
- **2026-11-26 — Fases 0 a 5 concluídas e o código da Fase 6 (Produção) pronto. Próximo: o go-live (Parte B),
  conduzido pelo controlador com o dono, passo a passo e com confirmação do dono em cada passo voltado para
  fora, em `.context/runbook-producao.md`:** proteção da `main` (P62), Neon e Vercel de produção, migração,
  `bun run smoke`, `admin:invite` em produção, aprovação da empresa para `/privacidade` (P64) e só então os
  convites reais e a semana de piloto.
- **Neon ligado** (P1 resolvida, 2026-11-20). P6/P7/P8 só travam Apple, Facebook e "esqueci a
  senha" **por e-mail** (a recuperação é o link do administrador).

---

## Fase 0 — Fundação · ✅

- ✅ Scaffold Next.js 16.4.6 + React 19.3 + Tailwind 4 + Biome + React Compiler + Bun (2026-11-20)
- ✅ shadcn/ui `base-nova` (Base UI) inicializado (2026-11-20)
- ✅ Drizzle + `@neondatabase/serverless` instalados; `src/db/index.ts`, `drizzle.config.ts`,
  `.env.example`, scripts `db:*` e `check-types` (2026-11-20)
- ✅ Correções do scaffold: variável de fonte, `lang="pt-BR"`, página inicial com tokens, assets
  do template removidos (2026-11-20)
- ✅ Contexto: `AGENTS.md`, `CLAUDE.md`, `.context/*`, `memory.md`, skills de projeto em
  `.claude/skills` (copiadas do klauve) (2026-11-20)
- ✅ Análise completa da planilha atual registrada no `about.md` (2026-11-20)
- ✅ Verificado: `check-types` limpo · `lint` limpo · `build` verde (2026-11-20)
- ✅ Neon ligado: `pg` + `attachDatabasePool` (D18), URLs resolvidas por `src/db/databaseUrl.ts`,
  `sslmode=verify-full`, `/api/health` (200 com o banco, 503 sem detalhe sem ele) (2026-11-20)
- ✅ Brainstorm do produto: 18 decisões + spec (2026-11-20)
- ✅ Setup de testes: Vitest 5 (projects `node` e `dom`) + PGlite com dump migrado + Testing Library + Playwright com pglite-socket (2026-11-20)
- ✅ Tokens da D16 (`chart-1..4`, `success`, `warning`, `info`) no `globals.css`, com guarda de paleta (P4 e P9 resolvidas) (2026-11-20)
- ✅ Remoto do Git: GitHub, branch `main` (2026-11-20)
- ✅ CI no GitHub Actions: tipos, lint, Vitest e E2E (com `next build`) em todo PR e push na `main` (2026-11-20)
- ⬜ Deploy na Vercel (movido para a Fase 6 — Produção)

## Fase 1 — Acesso · ✅

- ✅ Schema de acesso: `sector`, `user` (papel, setor, desativação), `session`, `account`, `verification`, `passkey`, `rate_limit`, `invite` + migrações versionadas (2026-11-20)
- ✅ Convites: token aleatório com hash, uso único atômico, 7 dias, estados válido/expirado/usado/cancelado, script `admin:invite` (2026-11-20)
- ✅ Better Auth: cadastro só por convite (hook + cookie `closery_invite`), e-mail e senha, passkey, Google e Facebook condicionais ao env (2026-11-20)
- ✅ Papéis `admin`/`operator`: `Authz`, `scopeToSector`, `requireUser`/`requireAdmin`, `proxy.ts`; operador em `/admin` vê "Página não encontrada" (2026-11-20)
- ✅ Telas: `/entrar`, `/convite/[token]`, `/bem-vindo`, `/conta`, Início, `/admin` (placeholder), shell com sidebar, `error` e `not-found` (2026-11-20)
- ✅ Alvos de toque dos primitivos (P3 resolvida) (2026-11-20)
- ✅ Testes: Vitest (node + dom) e E2E com 7 cenários (convite, usado, senha errada, operador sem Administração, passkey, desativado, redirecionamento). Verificado: `check-types`, `lint`, `test`, `test:e2e` (7 passed) e `build` verdes (2026-11-20)
- ⬜ Login social ao vivo (checklist manual da spec §12): depende de P10 (Google) e P7 (Facebook); Apple na Fase 6 (P6)

## Fase 2 — Cadastros · ✅

- ✅ Schema: `shift`, `item`, `destination`, índices únicos em `lower(name)`, CHECKs de papel (P18), de tipo do item e de horário + migração `0002_fase2_cadastros` (2026-11-21)
- ✅ Lógica pura e contrato das actions: nome, horário, sobreposição à meia-noite, unidade, paginação, reordenação, `AdminResult`, `runAdminAction` e os guardas `actionsAuth` e `actionsInventory` (2026-11-21)
- ✅ Primitivos `toggle-group`, `native-select` e `dialog` com alvos de toque e "Fechar", e a UI compartilhada de `/admin` (2026-11-21)
- ✅ Setores, destinos, turnos (aviso de sobreposição, ordem por botões) e itens (unidade por escolha com "Outro") (2026-11-21)
- ✅ Equipe: papel e setor, desativar (derruba as sessões, P11), último admin protegido e convites com link para copiar ou compartilhar (2026-11-21)
- ✅ Visão geral `/admin` com os cinco cartões e guarda de 9 páginas (2026-11-21)
- ✅ P11 e P18 resolvidas; pendências novas P23 (editar o nome de uma pessoa) e P24 (ordem alfabética ignora acento) (2026-11-21)
- ✅ Testes: Vitest (node + dom) com PGlite e Testing Library; E2E com 13 cenários (7 de acesso e 6 de cadastros). Verificado: `check-types`, `lint`, `test`, `test:e2e` (13 passed) e `build` verdes (2026-11-21)

## Fase 3 — Passagem · ✅

- ✅ Schema: `handover`, `handover_item`, `handover_correction`, CHECKs de estado e de quantidade, um índice por FK e migração `0003_fase3_passagem` (2026-11-21)
- ✅ Lógica pura: fuso de São Paulo, dia operacional, turno sugerido, quantidade, permissões (`handoverCapabilities`), diff de correção, situações, filtros do histórico, links e escolha de setor (2026-11-21)
- ✅ Contrato das actions: 10 códigos novos em `AdminErrorCode`, `runHandoverAction` e os guardas da P27 (`actionsGuards.test.ts`, `requireAdmin` em `admin/`) (2026-11-21)
- ✅ Domínio: rascunho sem escrita no GET, salvamento por campo, entregar, confirmar, resumo, correção com motivo e rastro, histórico com "sem passagem" no SQL e cartões do Início (2026-11-21)
- ✅ Telas: Início com os dois cartões, formulário com salvamento automático, resumo com confirmação, correção, histórico com filtros e seletor de setor do admin (2026-11-21)
- ✅ P26 e P27 resolvidas; pendências novas P33–P36 (2026-11-21)
- ✅ Testes: Vitest (node + dom) com PGlite e Testing Library; E2E com 19 cenários (7 de acesso, 6 de cadastros e 6 de passagem). Verificado: `check-types`, `lint`, `test`, `test:e2e` (19 passed) e `build` verdes (2026-11-21)
- ✅ Solicitações na passagem: entraram na Fase 4 (formulário do rascunho e resumo)

## Fase 4 — Solicitações · ✅

- ✅ Pendências antes da feature, cada uma no seu commit: P33 (runner único `runAction`), P40 (higiene da Fase 3: `firstValue`, harness de migração, `runInTransaction` e `ensureHandover` em módulos próprios, teste de concordância "awaiting"), P29 (acessibilidade da Equipe e da paginação) e P37 (setor inativo: resumo só leitura) (2026-11-24)
- ✅ Schema: `request`, `request_item`, `request_status_event` (com `seq` identity), `request_comment`, 12 CHECKs, 11 índices, 11 FKs `restrict` e migração `0004_fase4_solicitacoes` só aditiva (2026-11-24)
- ✅ Lógica pura: status, "parada" (72 h), permissões, filtros da URL, busca com dobra de acento, linha do tempo, reducer do movimento otimista, mensagens e links; schemas Zod e os códigos `STATUS_CONFLICT` e `DESTINATION_INACTIVE` (2026-11-24)
- ✅ Domínio: criar (com origem na passagem), mover, cancelar com motivo, comentar e apagar o próprio comentário; leituras do Quadro, da Lista e da Tabela, escolhas do formulário, abertas agora, abertas na entrega e cartão do Início, tudo agregado no SQL com teste de paridade (2026-11-24)
- ✅ Telas: `/solicitacoes` (Quadro com `useOptimistic`, Lista, Tabela com o primitivo `table`, filtros na URL, "Carregar mais"), detalhe rápido em Sheet (rota interceptada `@detalhe`) e página completa, cancelar com motivo, linha do tempo, comentários, "Nova solicitação" (também pela passagem), seção "Solicitações abertas" no formulário e no resumo, cartão no Início e "Solicitações" na navegação (2026-11-24)
- ✅ P29, P33, P37 e P40 resolvidas; pendências novas P44–P47 e, da revisão final, P48–P52 (2026-11-24)
- ✅ Testes: Vitest (node + dom) com PGlite e Testing Library; E2E com 28 cenários (7 de acesso, 6 de cadastros, 6 de passagem e 9 de solicitações). Verificado: `check-types`, `lint`, `test`, `test:e2e` (28 passed) e `build` verdes (2026-11-24)
- ✅ Dashboard e CSV: entraram na Fase 5

## Fase 5 — Dashboard · ✅

- ✅ Pendências antes da feature, cada uma no seu commit: P48 (`resolveScreenSector` e `paginationParams`, `RequestGroupSection`, `destinationNameSql` e `toOpenSummaries`, `loadSector` com trava, `deactivateSector`, a fonte do histórico exportada, `formatDateAtTimeBR`), P13 (`--chart-5` = `--foreground`), P19 (`error.tsx` e `not-found.tsx` dentro do shell) e P45 (trocar de setor preserva os filtros da URL, validados) (2026-11-25)
- ✅ Filtros novos para todo número ser um link: `/solicitacoes` (`status`, `parada`, `entrega`, `item`) e `/passagens` (situações `entregues` e `esperadas`, `item`, turno e item inativos no formulário) (2026-11-25)
- ✅ Domínio (só leitura, sem migração): `resolveDashboardScope`, Passagens sobre a fonte do histórico, Controles (total, média por turno, variação, um segmento por turno, série diária), Estoque (última contagem e pontos do período) e Solicitações (abertas e paradas agora, entregues no período, tempo até a entrega por destino, quantidade pedida por item), tudo agregado no SQL (2026-11-25)
- ✅ KokonutUI `metric-card` e `spending-ring` adaptados (tokens, pt-BR, sem as pílulas, React Compiler), primitivo `chart` (recharts 3.8.0 + react-is 19.3.0), cores por entidade e guarda de paleta estendido (2026-11-25)
- ✅ Tela `/dashboard` (período, blocos independentes com `catchError`, esqueletos, estados vazios), "Dashboard" na navegação e o link "Ver o dashboard" no Início (2026-11-25)
- ✅ `GET /api/dashboard/export`: CSV com BOM, `;`, CRLF e sem injeção de fórmula, mais o guarda de todo `route.ts` (2026-11-25)
- ✅ Critério de pronto (spec §12): cada número bate com um oráculo independente (JS sobre leitores crus), num mundo com passagens confirmadas, aguardando, não confirmadas, sem passagem e uma correção (2026-11-25)
- ✅ P13, P19, P45 e P48 resolvidas; pendências novas P53–P61; P24 e P34 ganharam `Atualização` (2026-11-25)
- ✅ Testes: Vitest (node + dom) com PGlite e Testing Library; E2E com 35 cenários (7 de acesso, 6 de cadastros, 6 de passagem, 9 de solicitações e 7 do dashboard). Verificado: `check-types`, `lint`, `test`, `test:e2e` (35 passed) e `build` verdes (2026-11-25)
- ⬜ Deploy e piloto: Fase 6 (o código está pronto; falta o go-live)

## Fase 6 — Produção · 🟡

- ✅ Configuração de produção: `vercel.json` (`gru1`, Bun fixado, previews desligados), `engines.node` `22.x`, cabeçalhos de segurança e noindex em três camadas (2026-11-26)
- ✅ `logServerError`: erro inesperado sem mensagem, pilha nem parâmetro de SQL, em `runAction`, `/api/health` e nos limites de erro (2026-11-26)
- ✅ `admin:invite --confirmar-host` e `bun run db:hosts` (a trava de host da migração) (2026-11-26)
- ✅ Better Auth endurecido: IP do rate limit explícito (P22), cookie do convite apagado no cadastro (P16), identificador da redefinição com hash, sessões revogadas ao redefinir (2026-11-26)
- ✅ Redefinição de senha por link gerado pelo administrador (24 h, uso único) e a página `/redefinir-senha`; "Esqueceu a senha?" no `/entrar` (2026-11-26)
- ✅ Sentry só com DSN, `scrubEvent` e `global-error.tsx` (2026-11-26)
- ✅ Alvos de toque de 44 px e o guarda E2E `touch-targets` (P12) (2026-11-26)
- ✅ `/privacidade` (rascunho até a empresa aprovar) e os textos do primeiro acesso (2026-11-26)
- ✅ `scripts/smoke.mjs` (`bun run smoke`) e `.context/runbook-producao.md` (2026-11-26)
- ✅ P16, P22 e P12 resolvidas; pendências novas P62–P76; P1, P6, P7, P8 e P10 ganharam `Atualização` (2026-11-26)
- ✅ Revisão final (três lentes) e a rodada de correções: o erro inesperado do Better Auth sai só pelo `logServerError` (`onAPIError.throw` + embrulho do `route.ts`), o `logServerError` nunca lança, o Sentry sem `BrowserTracing` nem client reports, o smoke com timeout, `--local` só em localhost e robots por linha, o `Voltar` de `/privacidade` (`BackLink`) e três textos da página mais fiéis à configuração, o guarda de 44 px medindo o convite e o `/bem-vindo`; o runbook ganhou o procedimento de conta tomada (P77) e outros acertos; pendências novas P77 a P80 (2026-11-26)
- ✅ Testes: Vitest 4488 testes em 324 arquivos; E2E com 44 cenários (os 35 de antes, 2 de alvos de toque, 3 da redefinição de senha e 4 das páginas públicas). Verificado: `check-types`, `lint`, `test`, `test:e2e` (44 passed), `build` e o smoke local (7 OK, 1 FALHOU esperado, 2 PULADO) verdes (2026-11-27)
- ⬜ Go-live (Parte B): proteção da `main`, Neon e Vercel de produção, migração, primeiro administrador, aprovação da empresa (P64), convites e a semana de piloto

## Visual novo (Início e shell) · ✅

Spec em `docs/superpowers/specs/2026-11-27-visual-inicio-design.md`, plano em `docs/superpowers/plans/2026-11-27-visual-inicio.md`
(Tasks 1 a 18) e a decisão no `architecture.md §10` (2026-11-27). O go-live (Fase 6, Parte B) continua pendente.

- ✅ Tokens e tema: a paleta nova nos dois temas, o "celular" abaixo de 860px, as cores fixas dos cartões coloridos e do setor, e o tema próprio com o escuro padrão e o `ThemeSwitch` (sem `next-themes`, que duplicava o conteúdo da página; P17 resolvida). Guardas novos: `rawColors` (nenhuma cor crua nos `.tsx`) e `themeContrast` (os pares dos dois temas e dos cartões coloridos) (2026-11-27)
- ✅ Satoshi: baixada do Fontshare no `predev` e no `prebuild` (`bun run fonts`), conferida por SHA-256, fora do git por licença, servida por `next/font/local`, com o cache no CI e o trace do CI sem a fonte (2026-11-27)
- ✅ Variantes: `Button` em pílula (`pill`, `icon-pill`, `surface`, `on-pastel` e `on-pastel-secondary`, com contorno sólido de foco sobre o pastel), `Badge` em pílula (`warning`, `info`, `success`, `neutral`) e `Card feature` (2026-11-27)
- ✅ Cor do setor: a coluna `sector.color` com o check `sector_color_valid` e o backfill único (migração `0005_cor_do_setor`), a cor sugerida e a escolha "Cor" na tela Setores (2026-11-27)
- ✅ Seletor de setor deslizante: o `SectorPicker` como `radiogroup` em todas as telas que escolhem setor, com "Todos" (D-V4) e a rolagem só do trilho (2026-11-27)
- ✅ Avatares: DiceBear `notionists` gerado no servidor (`avatarDataUri`), `UserAvatar` e `AvatarStack` (2026-11-27)
- ✅ Shell: a sidebar de 280px com os grupos e o card do usuário, o cabeçalho com o `MenuToggle` e o `ThemeSwitch`, e a gaveta no celular (2026-11-27)
- ✅ Início: a saudação com a data, "Passagem para confirmar", "Convide sua equipe" com o "Agora não", "Passagem do meu turno" na cor do setor com a barra do turno, "Solicitações", os esqueletos e as container queries (2026-11-27)
- ✅ Pack de correção do cartão "Passagem do meu turno": o bloco de status de largura inteira, a linha de entrega com avatares e os ids no `MyShiftState` (spec §6.4.1). O item 5 (`HandoverDetail`) fica para a branch D do roteiro (2026-11-27)
- ✅ Legibilidade: 27 telas em 136 capturas, nos dois temas; 7 correções (borda do `outline`, selo "Sem passagem", destaques do dashboard, escolha marcada, Sheet no celular, esqueletos) (2026-11-27)
- ✅ Pixel perfect contra o protótipo renderizado: todos os pares do Início e do shell em até 0,107% (a gaveta aberta, 0,214%, por anti-aliasing); o cartão do pack em até 0,002% (2026-11-27)
- ✅ Revisões: a final em 3 lentes, a re-revisão em 3 lentes e a revisão do delta em 2 lentes, com duas rodadas de correção (foco dos cartões coloridos provado por E2E, `--destructive` com AA, rolagem do seletor, trace do CI sem a fonte); sem Critical e sem Important aberto (2026-11-27)
- ✅ Documentos: ADR, `ui-rules.md §6`, `library-docs.md` (§3 e §17 a §20), runbook (a Satoshi em todo build e a `0005` antes do deploy), pendências novas P81 a P108, P17 resolvida e P67 e P70 com `Atualização` (2026-11-27)
- ✅ Migração `0005` no banco de dev, com o host conferido pelo `db:hosts` antes do `db:migrate` (2026-11-27)
- ✅ Testes: Vitest 5248 testes em 352 arquivos; E2E com 49 cenários (os 44 de antes, 4 do Início novo e 1 de toque). Verificado: `check-types`, `lint`, `test`, `build` e `test:e2e` (49 passed) verdes (2026-11-27)
- ✅ PR #8 (`feat/visual-inicio`) mergeado pelo dono (2026-11-27)
- ⬜ Os próximos handoffs, na fila do roteiro (`.git/sdd/roadmap/roteiro.md`, fora do git): C Passagens, D Passagem de turno, E Solicitações, F detalhe da solicitação, G Dashboard (o B, o processo, é a seção abaixo)

## Processo visual (PR B) · ✅

Spec em `docs/superpowers/specs/2026-11-27-processo-visual-design.md`, plano em
`docs/superpowers/plans/2026-11-27-processo-visual.md` e a decisão no `architecture.md §10` (2026-11-27, "Processo
visual (PR B)").

- ✅ 404 do `next dev` corrigido: o espelho exato do slot `@detalhe` (uma página nula do slot por página de `(app)`, nenhum catch-all), com o guarda que roda o validador do Next (`src/app/routeStructure.test.ts`); o laço de prefetch que o catch-all do slot causava no build de produção (também o da `main`, entre duas `/passagens/<id>`) saiu junto, com o guarda `e2e/prefetch.spec.ts`; P81 resolvida e P44 com `Atualização` (2026-11-27; o espelho exato e a segunda `Atualização` da P81, 2026-11-28)
- ✅ Guarda de hidratação: `e2e/hydration.spec.ts`, com o verificador puro `test/hydrationCheck.ts` (2026-11-27)
- ✅ `bg-muted` → `bg-accent` nos estados e rodapés dentro de cartão, com o guarda `src/app/mutedBackground.test.ts` e a exceção do `RequestColumn`; P83 resolvida; os casos de `accent` sobre `accent` que sobraram são a P109 (2026-11-27)
- ✅ Ferramentas visuais permanentes em `scripts/visual/` (banco 54332, app 3202 só no `localhost`, pessoas e textos inventados, cópias do protótipo, captura, diferença, pares, medida, sonda, interação com falha de rede, auditoria, recortes e registro), com `pixelmatch` 7.2.0 e `pngjs` 7.0.0 exatas e os testes puros em `test/visual/` (2026-11-27)
- ✅ `check-names` no `pre-commit` local e no portão (`--range=main...HEAD`), sem imprimir o termo; numa branch sem `scripts/visual/` o hook avisa e deixa passar (2026-11-27)
- ✅ Skill `handoff-visual` com os oito modelos (2026-11-27)
- ✅ Motion (`motion` 14.14.0 exata): a fundação (`MotionProvider` no `RootLayout`, tokens em `src/lib/motion.ts`, guarda `src/app/motionUsage.test.ts`, capturas sempre com movimento reduzido e espera do `style`) e os componentes que já se mexiam (`Button`, `ThemeSwitch`, `SectorPicker`, `Sheet` e gaveta, cor do `MyShiftCard`, `Tooltip`), com os dois ramos provados por teste e `e2e/motion.spec.ts`; P87 com `Atualização` (2026-11-27)
- ✅ Prova: os 19 pares do Início pelas ferramentas permanentes (o maior, menu-390 com 0,210%, dentro da faixa da spec §15.2), a falha de rede injetada (que achou o "Agora não" caindo no `error.tsx`, corrigido no `DismissInviteCardForm`; P89 com `Atualização`), os hovers do `outline` e do `ghost` dentro de cartão com o fundo diferente do pai e o texto plantado recusado pelo hook (`.git/sdd/processo/pixel.md`, fora do git) (2026-11-27)
- ✅ Revisão final em 3 lentes, com uma rodada de correções (o laço de prefetch e o texto do hook na spec e no plano) e, no fecho, o guarda de hidratação e os textos; sem Critical. O que não foi corrigido (os dois Important da lente de interface, de `accent` sobre `accent`, e os Minor) virou as pendências P109 a P118; P62 com `Atualização`, e P107 com a frase corrigida (2026-11-28)
- ✅ Testes: Vitest 5795 testes em 383 arquivos (em seis partes; a soma bate com o `git ls-files` dos testes); E2E com 56 cenários (os 49 de antes, 3 de hidratação, 3 do Motion e 1 do laço de prefetch). Verificado: `check-types`, `lint`, `test`, `test:e2e` (56 passed) e `build` verdes (2026-11-28)
- ⬜ PR da `chore/processo-visual` e o merge pelo dono

## Histórico

- **2026-11-20** — Projeto criado; contexto escrito; planilha analisada; brainstorm concluído
  (D1–D18) e spec escrita em `docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md`.
- **2026-11-20** — Fases 0 e 1 concluídas: fundação de testes (Vitest, PGlite, Testing Library, Playwright) e acesso por convite (Better Auth, papéis por setor, telas e shell). Plano em `docs/superpowers/plans/2026-11-20-fase-0-1-fundacao-e-acesso.md`.
- **2026-11-20** — Correções da revisão final: renovação da sessão (servidor lê sem refresh, `SessionKeepAlive` renova banco e cookie), limite de tentativas 30/10 com mensagem própria (`RATE_LIMITED`), link "Entrar" nos convites e no e-mail já cadastrado, testes de escalonamento, guarda de páginas `appPagesAuth.test.ts` (no lugar do `RequireUser`) e pendências P11–P22.
- **2026-11-21** — Fase 2 concluída: cadastros e equipe em `/admin` (setores, turnos, itens, destinos, pessoas e convites), P11 e P18 resolvidas. Plano em `docs/superpowers/plans/2026-11-21-fase-2-cadastros.md`.
- **2026-11-21** — Fase 3 concluída: passagem de turno de ponta a ponta (rascunho com salvamento automático, entregar, receber, corrigir com motivo e histórico), P26 e P27 resolvidas. Plano em `docs/superpowers/plans/2026-11-21-fase-3-passagem.md`.
- **2026-11-24** — Fase 4 concluída: solicitações de ponta a ponta (Quadro, Lista e Tabela, detalhe rápido em Sheet, cancelar com motivo, comentários, ligação com a passagem e o Início), P29, P33, P37 e P40 resolvidas. Plano em `docs/superpowers/plans/2026-11-23-fase-4-solicitacoes.md`.
- **2026-11-25** — Fase 5 concluída: dashboard de ponta a ponta (passagens, controles, estoque e solicitações, com período, comparação e todo número como link para a lista filtrada) e exportação CSV; P13, P19, P45 e P48 resolvidas. Plano em `docs/superpowers/plans/2026-11-24-fase-5-dashboard.md`.
- **2026-11-26** — Fase 6 (código) concluída: configuração de produção, log sanitizado, trava de host, Better Auth endurecido, redefinição de senha pelo link do administrador, Sentry, alvos de toque, `/privacidade`, smoke e runbook; P16, P22 e P12 resolvidas. Falta o go-live (Parte B). Plano em `docs/superpowers/plans/2026-11-25-fase-6-producao.md`.
- **2026-11-27** — Visual novo do Início e do shell (paleta e tema escuro padrão no app inteiro, Satoshi, cor do setor, seletor deslizante, avatares, shell e Início, mais o pack de correção do cartão do turno), revisado e documentado, com a `0005` aplicada no banco de dev; P17 resolvida e P81 a P108 registradas. Falta o portão e o PR; o go-live continua pendente. Plano em `docs/superpowers/plans/2026-11-27-visual-inicio.md`.
- **2026-11-28** — Processo visual (PR B): o 404 do `next dev` corrigido pelo espelho exato do slot `@detalhe` (que tirou também o laço de prefetch do build de produção), as ferramentas visuais permanentes em `scripts/visual/`, as guardas de nomes, de hidratação e do `bg-muted`, a skill `handoff-visual` e o Motion (a fundação e os componentes que já se mexiam); P81 e P83 resolvidas, P44, P62, P87, P89 e P107 com `Atualização`, P109 a P118 registradas. Plano em `docs/superpowers/plans/2026-11-27-processo-visual.md`.
