# Progress Tracker — Closery

> **Documento vivo + estado da obra.** Atualize **após cada feature** (junto com `ui-registry.md`
> e o log do `architecture.md`). As fases aqui são as mesmas do `build-plan.md`.
>
> Item só fica ✅ com verificação **rodada no terminal** (testes, `check-types`, `lint`, `build`).
>
> **Legenda:** ✅ concluído · 🟡 em andamento · ⬜ pendente · ⛔ bloqueado

---

## ▸ Próximo passo

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
