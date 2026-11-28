# Pendências — Closery

> **Índice único de tudo que está devido e não feito** — defeito, débito, decisão bloqueada.
> Organizado por estado, depois por severidade. Uma pendência **nunca é apagada**: ao mudar de
> estado, ela **muda de seção** e ganha uma `Atualização` datada.

---

## Como adicionar

**Estados** (strings exatas):

| Estado | O que manda fazer |
|---|---|
| `Aberto, não triado` | Triar |
| `Triado, plano pronto` | Implementar |
| `Bloqueado no dono` | Perguntar ao dono (ou ao usuário final) |
| `Teto aceito` | Nada, salvo se o custo mudar |
| `Resolvido` | Nada, é histórico |

**Severidade:** 🔴 Crítico · 🟠 Alto · 🟡 Médio · ⚪ Baixo (o emoji do título é só severidade).

**Ids:** `P<N>` em sequência, nunca renumerados. **Próximo id livre: P119.**

```markdown
#### P999 — Título que nomeia o defeito, não a área 🟠
**Estado:** Aberto, não triado
**Arquivos:** `src/x.ts:12`
**Impacto:** o que quebra, e para quem
**Correção:** o plano — `—` enquanto não triado
**Registrado em:** 2026-11-20
```

---

## Índice

| Id | Título | Sev. | Estado |
|---|---|---|---|
| P1 | Banco Neon não provisionado | 🟠 | Resolvido |
| P2 | Uso da marca LATAM sem autorização confirmada | 🟡 | Bloqueado no dono |
| P3 | Tamanhos do Button abaixo do alvo mínimo de toque | 🟡 | Resolvido |
| P4 | Paleta de gráficos em cinza e sem tokens de status | 🟡 | Resolvido |
| P5 | Glossário do domínio ULD é interpretação, não confirmação | 🟡 | Bloqueado no dono |
| P6 | Login com Apple exige conta paga de desenvolvedor e domínio HTTPS | 🟡 | Bloqueado no dono |
| P7 | Login com Facebook exige app da Meta publicado | 🟡 | Bloqueado no dono |
| P8 | Sem provedor de e-mail, "esqueci a senha" não funciona | 🟠 | Bloqueado no dono |
| P9 | Paleta de gráficos do klauve não foi validada contra as superfícies do shadcn | ⚪ | Resolvido |
| P10 | Credenciais OAuth do Google não criadas | 🟡 | Bloqueado no dono |
| P11 | Sessões abertas de usuário desativado continuam aceitas por /api/auth/* | 🟠 | Resolvido |
| P12 | Tamanhos gerados pelo shadcn abaixo do mínimo de toque | 🟡 | Resolvido |
| P13 | chart-5 ("Outros") quase invisível no tema escuro | 🟡 | Resolvido |
| P14 | Destino perdido no login: depois de entrar a pessoa cai em / | 🟡 | Aberto, não triado |
| P15 | Token bruto do convite gravado em verification.value pelo estado do OAuth | 🟠 | Aberto, não triado |
| P16 | Cookie closery_invite não é limpo depois do cadastro | 🟡 | Resolvido |
| P17 | Tema escuro nunca é ativado | 🟡 | Resolvido |
| P18 | user.role e invite.role sem CHECK no banco | 🟡 | Resolvido |
| P19 | Erro e 404 dentro do app derrubam o shell inteiro | 🟡 | Resolvido |
| P20 | Login social: ajustes antes de ligar | 🟡 | Aberto, não triado |
| P21 | Lacunas do E2E de acesso | 🟡 | Aberto, não triado |
| P22 | Limite de tentativas no piloto: confirmar IP e números | 🟡 | Resolvido |
| P23 | Editar o nome de uma pessoa: falta em /admin/equipe e em /conta | 🟡 | Aberto, não triado |
| P24 | Ordem alfabética das listas do admin ignora acento | 🟡 | Aberto, não triado |
| P25 | Corrida entre cadastro por convite e desativação do setor | 🟡 | Aberto, não triado |
| P26 | Visão geral conta turnos e itens de setores inativos; listas da Fase 3 precisam filtrar setor ativo | 🟡 | Resolvido |
| P27 | Guardas de teste aceitam menos do que deveriam | 🟡 | Resolvido |
| P28 | Formulários de criação perdem o texto digitado ao remontar | ⚪ | Aberto, não triado |
| P29 | Acessibilidade da Equipe e da paginação | 🟡 | Resolvido |
| P30 | Regra de convite pendente duplicada em 6 lugares | 🟡 | Aberto, não triado |
| P31 | Higiene de testes e refatorações pequenas da Fase 2 | ⚪ | Aberto, não triado |
| P32 | Mensagens no feminino e select vazio sem setor ativo | ⚪ | Aberto, não triado |
| P33 | Dois runners de Server Action quase iguais (admin e passagem) | ⚪ | Resolvido |
| P34 | "Sem passagem" usa os horários atuais do turno e some com o turno desativado | 🟡 | Aberto, não triado |
| P35 | Cartão "Passagem para confirmar" não tem teto de idade | 🟡 | Aberto, não triado |
| P36 | Dois operadores no mesmo rascunho: o último a salvar vence, sem aviso | 🟡 | Aberto, não triado |
| P37 | Setor inativo: o resumo oferece Confirmar e Corrigir que sempre falham | 🟡 | Resolvido |
| P38 | Rascunho com mais de 31 dias é editável no domínio, mas inalcançável pela interface | ⚪ | Aberto, não triado |
| P39 | Defesa em profundidade no banco da passagem | ⚪ | Aberto, não triado |
| P40 | Higiene de refatoração da Fase 3 | ⚪ | Resolvido |
| P41 | Higiene de testes da Fase 3 | ⚪ | Aberto, não triado |
| P42 | Guardas de Server Action: varredura de exports por lista negra e exceção do convite no arquivo inteiro | 🟡 | Aberto, não triado |
| P43 | Limites conhecidos do rascunho: item inativo e preenchimento de zeros | ⚪ | Aberto, não triado |
| P44 | Detalhe rápido das solicitações depende do cabeçalho next-url | ⚪ | Aberto, não triado |
| P45 | Trocar de setor em /solicitacoes perde os filtros da URL | 🟡 | Resolvido |
| P46 | Cartão movido para uma coluna aberta e truncada some até a revalidação | ⚪ | Aberto, não triado |
| P47 | X só com ícone do EditDialog continua sem tooltip | ⚪ | Aberto, não triado |
| P48 | Refatorações da Fase 4 para o início da Fase 5 | 🟡 | Resolvido |
| P49 | Higiene de testes da Fase 4 | ⚪ | Aberto, não triado |
| P50 | UX das solicitações: intervalo vazio, "Carregar mais" como link e contrato das escolhas | ⚪ | Aberto, não triado |
| P51 | Defesa em profundidade no banco das solicitações | ⚪ | Aberto, não triado |
| P52 | Desempenho: a CTE `last` das abertas na entrega varre todo o histórico do setor | ⚪ | Aberto, não triado |
| P53 | Item que muda de unidade ou de tipo no período não é tratado pelo dashboard | 🟡 | Aberto, não triado |
| P54 | Erro do detalhe rápido aparece fora do Sheet | ⚪ | Aberto, não triado |
| P55 | Helpers do E2E repetidos nos quatro specs antigos e em helpers.ts | ⚪ | Aberto, não triado |
| P56 | Destino além do teto de 200 escolhas cai do filtro de /solicitacoes | ⚪ | Aberto, não triado |
| P57 | Índices do dashboard só sob medição no Neon | ⚪ | Aberto, não triado |
| P58 | A cor das situações do anel não separa em daltonismo | ⚪ | Aberto, não triado |
| P59 | O CSV se monta inteiro em memória | ⚪ | Aberto, não triado |
| P60 | Duplicações da Fase 5 para um commit só de refatoração | ⚪ | Aberto, não triado |
| P61 | Ajustes de UX da Fase 5 | ⚪ | Aberto, não triado |
| P62 | A `main` não tem proteção: push direto vira deploy sem CI | 🟠 | Aberto, não triado |
| P63 | Comportamento na Vercel só se confirma no primeiro deploy | 🟡 | Aberto, não triado |
| P64 | Aprovação da empresa (LGPD) pendente e /privacidade em rascunho | 🟠 | Aberto, não triado |
| P65 | Riscos aceitos do Hobby e do Neon Free no piloto | 🟠 | Aberto, não triado |
| P66 | Passkeys presas ao host *.vercel.app | 🟡 | Aberto, não triado |
| P67 | Fechar a aba com o salvamento automático na fila perde o que não foi salvo | 🟡 | Aberto, não triado |
| P68 | Sentry sem source maps e com +67 KB gzip de JS no cliente | ⚪ | Aberto, não triado |
| P69 | scrubEvent só limpa padrões conhecidos da mensagem de erro | 🟡 | Aberto, não triado |
| P70 | Alvos de toque medidos só no Chromium emulado | ⚪ | Aberto, não triado |
| P71 | Sem instalação como app (manifest e ícones) | ⚪ | Aberto, não triado |
| P72 | Tempo de preenchimento da passagem sem medição automática | ⚪ | Aberto, não triado |
| P73 | Suíte do Vitest lenta e teste de migração com timeout sob carga | ⚪ | Aberto, não triado |
| P74 | admin:invite não mostra quantos administradores ativos existem | ⚪ | Aberto, não triado |
| P75 | Next imprime o erro não tratado inteiro no log da Vercel | 🟡 | Aberto, não triado |
| P76 | Gerar link de nova senha não deixa registro de quem gerou | 🟡 | Aberto, não triado |
| P77 | Redefinição e desativação não apagam passkeys | 🟡 | Aberto, não triado |
| P78 | createPasswordResetLink não é atômico | ⚪ | Aberto, não triado |
| P79 | React Compiler desiste do SignInPanel inteiro | ⚪ | Aberto, não triado |
| P80 | Nenhum guarda impede script de importar logServerError ou Sentry | ⚪ | Aberto, não triado |
| P81 | `next dev` dá 404 nas páginas fora do grupo (app) por causa do slot @detalhe | 🟡 | Resolvido |
| P82 | Telas sem desenho novo ficam no layout antigo sem prazo: Conta, Administração, entrada, privacidade, erro e 404 | 🟡 | Aberto, não triado |
| P83 | Hover e estado aberto com bg-muted somem dentro de card, Dialog e Sheet | 🟡 | Resolvido |
| P84 | Borda dos campos no tema claro tem 1,36:1, abaixo de 3:1 | 🟡 | Aberto, não triado |
| P85 | Segmento marcado do seletor de setor tem pouco contraste no claro (thumb 1,32:1) | 🟡 | Aberto, não triado |
| P86 | Setas do seletor de setor trocam de setor a cada passo, recarregam a tela e perdem o foco | 🟡 | Aberto, não triado |
| P87 | Crossfade de cor do cartão do turno provavelmente não roda, e a transição da troca de tema não foi conferida | ⚪ | Aberto, não triado |
| P88 | Lista de Setores não mostra a cor de cada setor | ⚪ | Aberto, não triado |
| P89 | "Agora não" do cartão de convite não dá retorno durante o envio | ⚪ | Aberto, não triado |
| P90 | Foco fraco fora dos cartões coloridos, sem indicador no alto contraste do Windows, e borda de erro abaixo de 3:1 no escuro | 🟡 | Aberto, não triado |
| P91 | Variantes destructive sem uso ficam fora do guarda de contraste, e o hover do Badge reprova | ⚪ | Aberto, não triado |
| P92 | Avatares em data URI pesam de 12 a 38 KB e saem duas vezes na página | ⚪ | Aberto, não triado |
| P93 | Satoshi não tem os glifos ª e º | ⚪ | Aberto, não triado |
| P94 | Id de quem salvou o rascunho vai ao navegador sem uso | ⚪ | Aberto, não triado |
| P95 | global-error ignora o tema e as fontes | ⚪ | Aberto, não triado |
| P96 | Início do admin roda 6 contagens a cada carga só para decidir o cartão de convite | ⚪ | Aberto, não triado |
| P97 | uiRegistryDoc não varre src/components/app-shell | ⚪ | Aberto, não triado |
| P98 | Guarda de cor crua não varre .ts, prefixos direcionais nem // dentro de string | ⚪ | Aberto, não triado |
| P99 | Avatar de quem confirmou aparece mesmo quando o nome não é achado ("outra pessoa") | ⚪ | Aberto, não triado |
| P100 | No setor verde (Eco) o bloco "Confirmada" se destaca pouco | ⚪ | Aberto, não triado |
| P101 | No next dev o Strict Mode pode tirar a classe do tema do html | ⚪ | Aberto, não triado |
| P102 | Build e redeploy dependem do Fontshare no ar e com o mesmo arquivo | 🟡 | Aberto, não triado |
| P103 | Borda da amostra marcada do SectorColorChoice provada sem passar pelo CSS gerado | ⚪ | Aberto, não triado |
| P104 | suggestColorForNewSector conta as cores em JS, contra a regra de agregação no SQL | ⚪ | Aberto, não triado |
| P105 | Higiene de testes do visual novo | ⚪ | Aberto, não triado |
| P106 | Sobras de código do visual novo: "use client" sem hook, valores repetidos e mensagens | ⚪ | Aberto, não triado |
| P107 | Mapas do roteiro citam o --destructive de antes do ajuste AA | ⚪ | Aberto, não triado |
| P108 | Setor rosa tem a mesma cor do cartão "Convide sua equipe" | ⚪ | Aberto, não triado |
| P109 | Estado accent sobre fundo accent: o trilho do BarList some no hover da linha e o hover do "Agora não" do PasskeyOffer quase não se vê no escuro | 🟡 | Aberto, não triado |
| P110 | visual:pairs semeia uma vez por estado e guarda o número velho do par que falha | 🟡 | Aberto, não triado |
| P111 | Ferramentas visuais com diagnóstico enganoso e recusas que faltam | ⚪ | Aberto, não triado |
| P112 | check-names --range confere só o diff líquido da branch, não cada commit | 🟡 | Aberto, não triado |
| P113 | Um termo da lista de nomes já está na main, em cinco arquivos do PR A | ⚪ | Aberto, não triado |
| P114 | As cópias do protótipo baixam as fontes da rede a cada captura | ⚪ | Aberto, não triado |
| P115 | Os guardas dos documentos não recusam uma cerca de código solta | ⚪ | Aberto, não triado |
| P116 | A memória de 2 s do SectorColorFade se arma em qualquer desmontagem | ⚪ | Aberto, não triado |
| P117 | Testes e sondas do PR B que provam menos do que dizem | ⚪ | Aberto, não triado |
| P118 | A skill handoff-visual, os modelos e o library-docs §23 divergem das regras em pontos de texto | ⚪ | Aberto, não triado |

---

## 1. Aberto, não triado

#### P14 — Destino perdido no login: depois de entrar a pessoa cai em / 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/proxy.ts` · `src/components/auth/SignInPanel.tsx`
**Impacto:** o proxy manda para `/entrar` sem guardar a rota pedida; depois do login a pessoa cai em `/`, mesmo vindo de um link para outra página.
**Correção:** — (opção: parâmetro de retorno validado (só caminho relativo da mesma origem) lido pelo `SignInPanel` — Fase 3)
**Registrado em:** 2026-11-20

#### P15 — Token bruto do convite gravado em verification.value pelo estado do OAuth 🟠
**Estado:** Aberto, não triado
**Arquivos:** `src/components/auth/InviteSignup.tsx` · `src/lib/auth/createAuth.ts`
**Impacto:** `errorCallbackURL: /convite/<token>` com `storeStateStrategy` "database" grava o token bruto em `verification.value`; fica até 7 dias se o fluxo for abandonado.
**Correção:** — (opção: rota de erro sem token ou `account.storeStateStrategy: "cookie"`)
**Registrado em:** 2026-11-20

#### P20 — Login social: ajustes antes de ligar 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/lib/auth/createAuth.ts` · `src/components/auth/SignInPanel.tsx` · `src/components/auth/InviteSignup.tsx`
**Impacto:** depende de P10 e P7. Erros antes do `state` (`state_not_found`, `invalid_callback_request`) caem na página padrão `/api/auth/error`, em inglês; os botões podem ficar travados ao voltar do provedor pelo bfcache; tokens OAuth ficam em texto puro em `account`.
**Correção:** — (opção: configurar `onAPIError.errorURL = "/entrar"`; handler `pageshow` com `persisted` que zera `pending`; `account.encryptOAuthTokens: true`)
**Registrado em:** 2026-11-20

#### P21 — Lacunas do E2E de acesso 🟡
**Estado:** Aberto, não triado
**Arquivos:** `e2e/auth.spec.ts`
**Impacto:** o cenário "desativado" não afirma a ausência de cookie de sessão; login por passkey depois da desativação não é testado; o caminho do autofill de passkey não tem E2E.
**Correção:** — (opção: acrescentar as três verificações ao E2E)
**Registrado em:** 2026-11-20

#### P23 — Editar o nome de uma pessoa: falta em /admin/equipe e em /conta 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/features/admin/people.ts` · `src/components/admin/team/PersonForm.tsx` · `src/app/(app)/conta/page.tsx`
**Impacto:** o nome vem do cadastro por convite e ninguém o corrige depois: nome digitado errado fica na lista da Equipe, na saudação e nas passagens futuras; nem a pessoa (em `/conta`) nem o administrador (em `/admin/equipe`) têm tela para isso.
**Correção:** — (opção: `renamePerson` no domínio com auditoria quando a Fase 3 passar a citar o nome nas passagens; campo "Nome" no diálogo "Editar pessoa" para o admin e em `/conta` para a própria pessoa)
**Registrado em:** 2026-11-21

#### P24 — Ordem alfabética das listas do admin ignora acento 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/features/admin/people.ts` · `src/features/admin/sectors.ts` · `src/features/admin/destinations.ts`
**Impacto:** com collation `C.UTF-8`, `lower(name)` ordena por ponto de código: nomes com inicial acentuada (Á, É, Ó) vão para o fim das listas e da escolha de setor.
**Correção:** — (opção: `ORDER BY name COLLATE "pt-BR-x-icu"` se o Neon tiver ICU, ou coluna normalizada sem acento)
**Registrado em:** 2026-11-21
**Atualização (2026-11-24):** a Fase 4 repete o padrão nas escolhas de /solicitacoes (`listActiveDestinations`, `listFilterDestinations` e `listRequestCreators` em `src/features/requests/choices.ts` ordenam por `lower(name)` na collation C.UTF-8: "Área 1" sai depois de "Doca 3"); a correção, quando vier, vale para as duas.
**Atualização (2026-11-25):** a Fase 5 repete o padrão nas listas do dashboard (Controles e Estoque ordenam por `lower(sector.name)`, o filtro de itens de /passagens e de /solicitacoes e as colunas do CSV também); a correção, quando vier, vale para todas.

#### P25 — Corrida entre cadastro por convite e desativação do setor 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/features/invites/inviteQueries.ts` (`consumeInvite`) · `src/features/admin/sectors.ts` (`setSectorActive`)
**Impacto:** `consumeInvite` roda no hook `user.create.before`, fora do INSERT do usuário: há uma janela de milissegundos em que `setSectorActive(false)` vê 0 pessoas e 0 convites pendentes e o novo operador cai num setor inativo.
**Correção:** — (opção: acrescentar `sector.active` ao WHERE de `consumeInvite` para convites de operador, falhando fechado; ou aceitar e registrar)
**Registrado em:** 2026-11-21

#### P28 — Formulários de criação perdem o texto digitado ao remontar ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/components/admin/shifts/ShiftsAdmin.tsx:79` · `src/components/admin/items/ItemsAdmin.tsx`
**Impacto:** a `key` de remontagem do formulário de criar muda após ações não relacionadas (em Turnos a chave inclui os padrões, que mudam ao desativar, reativar ou mover; em Itens usa `page.total`) e zera o que a pessoa estava digitando. Baixa frequência.
**Correção:** — (opção: chave só do que realmente exige reiniciar o formulário, ou reiniciar por evento de sucesso da própria criação)
**Registrado em:** 2026-11-21

#### P30 — Regra de convite pendente duplicada em 6 lugares 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/features/invites/inviteQueries.ts` (`consumeInvite`, `cancelInvite`) · `src/features/admin/teamInvites.ts` (`pendingWhere`) · `src/features/admin/sectors.ts:42` · `src/features/admin/overview.ts:45` · `inviteState` (JS)
**Impacto:** a definição de "convite pendente" (não consumido, não cancelado, não expirado) está copiada em seis pontos; mudar uma exige lembrar das outras e o risco é divergirem em silêncio.
**Correção:** — (opção: um helper SQL único de "pendente" usado pelas consultas e pelo `inviteState` em JS, com teste de paridade)
**Registrado em:** 2026-11-21

#### P31 — Higiene de testes e refatorações pequenas da Fase 2 ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/db/schema/migration0002.test.ts` (harness) · `src/db/schema/sectors.test.ts` (`sqlState`) · testes de CHECK de papel · `ConfirmDialog` · `nameTakenFailure` · `PageSkeleton` · limite de toasts · `e2e/cadastros.spec.ts`
**Impacto:** o comentário do harness de migração afirma paridade com `db:migrate`, que na prática roda tudo numa transação; falta o caso de papel desconhecido em `invite`; os testes de CHECK não iteram `ROLES`; os helpers `sqlState` deveriam ser `sqlErrorOf`; `ConfirmDialog` não reaproveita `useAdminAction`; `nameTakenFailure` e `PageSkeleton` estão duplicados; o limite de toasts está duplicado; os helpers do E2E se repetem.
**Correção:** — (opção: um commit de refatoração separado, com testes verdes antes e depois, nunca junto de feature)
**Registrado em:** 2026-11-21

#### P32 — Mensagens no feminino e select vazio sem setor ativo ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/components/admin/ActiveToggleButton.tsx` · `src/components/admin/team/PersonForm.tsx`
**Impacto:** `ActiveToggleButton` fixa o masculino (`${entity} desativado/reativado`): serve para Setor, Turno, Item e Destino, mas erra a concordância com uma entidade feminina futura (ex.: Pessoa → "Pessoa desativada."), então não pode ser reaproveitado na Equipe; com nenhum setor ativo o select de setor do operador aparece vazio.
**Correção:** — (opção: gênero como parâmetro do botão; com 0 setores ativos, mostrar a explicação e o atalho para Setores como no `InviteForm`)
**Registrado em:** 2026-11-21

#### P34 — "Sem passagem" usa os horários atuais do turno e some com o turno desativado 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/features/handovers/history.ts`
**Impacto:** o par (turno × dia) "sem passagem" é calculado com os horários e o estado atuais do turno e só existe a partir do dia em que o turno foi criado: mudar o horário de um turno reescreve o passado e desativar um turno some com os "sem passagem" dele (nada guarda quando ele esteve ativo). O dashboard da Fase 5 herda a mesma definição.
**Correção:** — (opção: aceitar no MVP; se o piloto ou o dashboard exigirem, guardar o histórico de horários e de atividade do turno)
**Registrado em:** 2026-11-21
**Atualização (2026-11-25):** o dashboard da Fase 5 herdou a definição de propósito: "Esperadas" e "Sem passagem" saem da mesma `historySource` da lista (`/passagens`) e do CSV, então os três concordam, mas todos usam os horários e o estado atuais do turno. Quando a P34 for corrigida, a correção vale para os três de uma vez.

#### P35 — Cartão "Passagem para confirmar" não tem teto de idade 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/features/handovers/home.ts` (`getHomeHandovers`)
**Impacto:** uma passagem entregue há semanas e nunca confirmada continua no topo do Início até alguém confirmar; o cartão mostra a data e a hora da entrega, e o histórico a marca "não confirmada" quando surge uma mais nova.
**Correção:** — (opção: se o piloto mostrar ruído, um teto de 72 h entra como mudança de uma linha na consulta do cartão)
**Registrado em:** 2026-11-21

#### P36 — Dois operadores no mesmo rascunho: o último a salvar vence, sem aviso 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/features/handovers/draft.ts` · `src/components/passagens/useHandoverAutosave.ts`
**Impacto:** dois operadores digitando o mesmo campo do mesmo rascunho ao mesmo tempo: o último a salvar sobrescreve o outro por campo, sem aviso de conflito (sem tempo real, spec §6.1); "Último salvamento às HH:mm por {nome}" mostra quem mexeu por último.
**Correção:** — (opção: só se o piloto mostrar perda: versão por campo com aviso "{nome} alterou este campo", ou tempo real)
**Registrado em:** 2026-11-21

#### P38 — Rascunho com mais de 31 dias é editável no domínio, mas inalcançável pela interface ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/features/handovers/shiftSuggestion.ts` (`resolveHandoverTarget`) · `src/components/passagens/HistoryRowItem.tsx` · `src/components/passagens/NewHandover.tsx`
**Impacto:** um rascunho antigo continua editável e entregável no domínio (F3-8b), mas nenhuma tela ou URL o abre: o histórico não oferece o link fora da janela, `/passagens/{id}` de um rascunho redireciona para `/passagens/nova` e ali a data antiga é descartada em favor do turno sugerido.
**Correção:** — (opção: abrir rascunhos antigos pelo id em `/passagens/{id}?editar=1`, ou expirá-los de propósito)
**Registrado em:** 2026-11-21

#### P39 — Defesa em profundidade no banco da passagem ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/db/schema/handovers.ts` · `drizzle/0003_*.sql`
**Impacto:** nenhum caminho do domínio mistura setores, mas o banco não impede: passagem, itens e correções não compartilham o setor por chave composta, e `confirmation_note` fora do CHECK permite nota solta em rascunho ou entregue (só a fixture impede).
**Correção:** — (opção: migração aditiva com FKs compostas (setor) e `confirmation_note` no CHECK `state_consistent`)
**Registrado em:** 2026-11-21

#### P41 — Higiene de testes da Fase 3 ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/db/schema/migration0003.test.ts` · `src/features/handovers/schemas.test.ts` · `src/features/handovers/history.test.ts` · `src/components/passagens/HandoverHistory.test.tsx`
**Impacto:** o teste de FK-restrict do setor não isola a FK da passagem; faltam casos-limite de `correctHandoverSchema` e da correção no limite; o desempate de setor não tem teste; o teste de clamp de página é fraco.
**Correção:** — (opção: reforçar cada um num commit só de testes)
**Registrado em:** 2026-11-21

#### P42 — Guardas de Server Action: varredura de exports por lista negra e exceção do convite no arquivo inteiro 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/app/actionsGuards.test.ts` · `test/actionGuards.ts` · `src/app/(auth)/convite/[token]/actions.ts`
**Impacto:** a varredura de exports proíbe um conjunto conhecido (lista negra) em vez de permitir só o esperado; a exceção do convite vale para o arquivo todo, então uma action nova ali escaparia da guarda de sessão.
**Correção:** — (opção: allowlist por export, com a exceção só para a action de convite)
**Registrado em:** 2026-11-21

#### P43 — Limites conhecidos do rascunho: item inativo e preenchimento de zeros ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/features/handovers/draft.ts` · `src/features/handovers/formState.ts` · `src/components/passagens/HandoverFields.tsx`
**Impacto:** a linha de um item desativado depois de salva no rascunho some do formulário mas é entregue com o valor; o preenchimento com zero na entrega não respeita o teto de 200 itens da lista.
**Correção:** — (opção: aceitar no MVP; ou mostrar a linha inativa no rascunho e limitar itens por setor)
**Registrado em:** 2026-11-21

#### P44 — Detalhe rápido das solicitações depende do cabeçalho next-url ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/app/(app)/@detalhe/(.)solicitacoes/[id]/page.tsx` · `src/app/(app)/layout.tsx`
**Impacto:** a rota interceptada só abre o Sheet quando a requisição chega com o cabeçalho `next-url`; um CDN ou proxy que o descarte (ou que cacheie a resposta sem `Vary`) faz o clique abrir a página completa. Sem perda de dados: a página completa tem tudo, só perde o "sem sair da tela".
**Correção:** — (opção: conferir na Vercel, na Fase 6, que o `Vary: next-url` passa; se não passar, aceitar a página completa como fallback)
**Registrado em:** 2026-11-24
**Atualização (2026-11-27):** o PR B trocou o `@detalhe/[...catchAll]` pelo espelho por segmento (P81, `library-docs.md §14`). A interceptação `(.)solicitacoes/[id]` não mudou e continua dependendo do cabeçalho `next-url`: a pendência segue aberta.

#### P46 — Cartão movido para uma coluna aberta e truncada some até a revalidação ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/features/requests/boardMove.ts` (`applyMove`) · `src/components/solicitacoes/useRequestMove.ts`
**Impacto:** o movimento otimista não insere o cartão numa coluna aberta cujas linhas não estão todas carregadas (para não furar a ordem "mais antigo no status primeiro"): a contagem sobe e o cartão sai da origem, mas só aparece no destino depois da resposta do servidor (ou atrás de "Carregar mais"). Sem perda de dados.
**Correção:** — (opção: inserir no fim da coluna truncada e deixar a revalidação reordenar; ou aceitar)
**Registrado em:** 2026-11-24

#### P47 — X só com ícone do EditDialog continua sem tooltip ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/components/ui/dialog.tsx` · `src/components/admin/EditDialog.tsx`
**Impacto:** o botão X (só ícone) do `DialogContent` não tem tooltip, contra a regra "todo controle só com ícone ganha tooltip"; a Fase 4 resolveu nos diálogos e no Sheet novos com `showCloseButton={false}` e botão com texto, mas o `EditDialog` da Fase 2 (único uso restante) continua assim.
**Correção:** — (opção: `EditDialog` com `showCloseButton={false}` e botão "Voltar", ou tooltip no X do primitivo)
**Registrado em:** 2026-11-24

#### P49 — Higiene de testes da Fase 4 ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/features/admin/runAction.test.ts` · `src/features/handovers/awaiting.test.ts` · `test/fixtures.ts` · `src/db/schema/requests.test.ts` · `src/features/requests/move.test.ts` · `src/features/requests/comments.test.ts` · `src/components/solicitacoes/useRequestMove.test.tsx` · `src/components/solicitacoes/RequestDetail.test.tsx` · `e2e/solicitacoes.spec.ts` · `e2e/start-db.ts`
**Impacto:** lacunas que não escondem defeito conhecido, só deixam uma regressão passar: Tarefa 1: o caso do `redirect()` em `runAction.test.ts` usa `revalidate: null` e não confere que `revalidatePath` não foi chamado; usar `"/(app)/admin"` e acrescentar a asserção; Tarefa 2: o caso de outro setor em `awaiting.test.ts` não chama `pendingIdOf`; acrescentar `expect(await pendingIdOf(biaAuthz, uld.id)).toBe(mine.id)`; Tarefa 4: `insertRequest` (`test/fixtures.ts`) escreve até 4 linhas sem transação; `cancelReason` só de espaços e `destinationOther` só de espaços chegam ao banco em vez de lançar o erro do fixture; entradas contraditórias (`cancelReason` com `events: false`, `statusChangedBy` com status `requested`) são ignoradas em silêncio; Tarefa 4: dois casos de FK restrict em `requests.test.ts` (setor, e "não apaga a pessoa que criou, moveu ou comentou") não provam que foram as FKs novas, porque tabelas antigas também referenciam setor e pessoa (a prova é `migration0004.test`); e o caso do padrão do banco só afirma `statusChangedAt >= createdAt`, então o `now()` do título não é provado; Tarefa 7: sem teste de admin cancelando em qualquer setor nem de admin criando solicitação com origem (`move.test.ts`); Tarefa 8: "o admin apaga só o próprio comentário" só confere `{ ok: true }`: conferir `deleted_at`; faltam escritas de admin em setor inativo (`SECTOR_INACTIVE`) em `comments.test.ts`; Tarefa 11: o ramo `NEXT_REDIRECT` do `useRequestMove` nunca é exercitado (o mock de `unstable_rethrow` existe, nenhum caso rejeita com esse erro); Tarefa 12: faltam o teto de 500 (sem "Ver comentários anteriores" com `commentsLimit` 500 e mais de 500 comentários) e o id malformado no Sheet (`RequestDetail.test.tsx`); Tarefa 14: o E2E (a) não confere no banco a quantidade digitada (12); E2E, log do `[app]` (Tarefa 15, investigado em 2026-11-24): na execução completa apareceu de novo, durante o caso (d), um `ERROR [Better Auth]: INTERNAL_SERVER_ERROR` com `portal "" does not exist` (código `34000`, rotina `exec_execute_message`), na consulta `select … from "session" where "session"."token" = $1` (a leitura da sessão do Better Auth), e todos os 28 testes passaram. Não é um caso negativo provocado: é o protocolo estendido do Postgres perdendo o portal sem nome, porque o `pglite-socket` (`e2e/start-db.ts`, `maxConnections` 20) serve vários clientes sobre um único backend PGlite e intercala as mensagens `Bind` e `Execute` de conexões diferentes; as leituras em paralelo (`Promise.all` do detalhe e dos grupos) aumentam a chance. É infraestrutura do E2E, não de produção (Neon é Postgres de verdade).
**Correção:** — (opção para o último item: pool com `max: 1` só no app do E2E; `maxConnections` 1 no `pglite-socket` não serve, porque derruba a segunda conexão (app mais as conexões do próprio teste, ver `e2e/start-db.ts`); não mexer no pool de produção. Os demais: um commit só de testes)
**Registrado em:** 2026-11-24
**Atualização (2026-11-25):** spike F5-13 sobre o `portal "" does not exist` no log do `[app]` (o dashboard faz várias leituras em paralelo). Seis execuções completas de `bun run test:e2e`: com o pool padrão (10), 2, 2 e 2 ocorrências (soma 6); com `DATABASE_POOL_MAX=1` só no `webServer` do app, 0, 0 e 0 (soma 0). Critério de adoção: a linha de base com pelo menos 1 ocorrência, as três execuções com `max: 1` com 0, e nenhum teste estourando o tempo. Decisão: **adotado.** `poolMaxFrom(process.env)` (`src/db/poolSize.ts`, inteiro de 1 a 10 de `DATABASE_POOL_MAX`, senão 10) é lido por `createPool` e só o `webServer` do app no `playwright.config.ts` define `DATABASE_POOL_MAX: "1"`; o processo de teste, o dev e a Vercel seguem com 10. Cuidado: com uma conexão só, um `db` usado dentro do callback de uma transação travaria (nenhuma das chamadas de `.transaction(` de `src` faz isso; o Better Auth mantém `transaction` desligado). Os demais itens de P49 continuam abertos.
**Atualização (2026-11-25):** a revisão final da Fase 5 mandou para cá estas lacunas de teste (todas sem defeito conhecido): as 8 desativações de setor por SQL cru (`update sector set active = false`) que sobraram nos testes de confirm, correction, deliver, draft e formState (usar `deactivateSector`); os títulos dos testes de `RequestGroupSection`; as lacunas de `screenSector.test`; `loaders.test` é o próprio oráculo; o erro de página do P19 dentro do shell não tem E2E; `lists.test` sem parada/item × destino; o nome de status no `RequestsScreen.test`; os escopos de `expected` em `history.test`, o setor sem itens em `HandoverHistory.test` e o comentário `SEVEN`; a paridade do `criterioDePronto` sem afirmar `setor`; os casos de 93 dias, unicode e rascunho de Controles; os casos que faltam em `requests.test`; o teste do ramo do `DashboardScreen`; o nome do arquivo do CSV a partir do escopo de quem chama; o `scopeOf` escrito 3 vezes; o teste do 413 sem conferir os argumentos.

#### P50 — UX das solicitações: intervalo vazio, "Carregar mais" como link e contrato das escolhas ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/components/solicitacoes/RequestFiltersForm.tsx` · `src/components/solicitacoes/LoadMoreButton.tsx` · `src/features/requests/choices.ts`
**Impacto:** sem perda de dados. "Intervalo" com uma das datas vazia (ou "De" depois de "Até", que o servidor já inverte) volta em silêncio para "Todo o período"; `LoadMoreButton` é um botão com `router.replace` (o plano mandou assim); como é só uma mudança de URL, o certo seria `<Link replace scroll={false}>` com o estilo de botão; as funções de escolha de `choices.ts` recebem `sectorIds` crus: os chamadores de hoje (`RequestsScreen` e `NewHandover`) só passam ids ativos e do escopo da pessoa. Falta registrar isso como contrato em JSDoc.
**Correção:** — (opção: validar as duas datas antes de enviar, ou avisar; trocar o botão por `Link`; escrever a nota de contrato no JSDoc das funções de escolha)
**Registrado em:** 2026-11-24

#### P51 — Defesa em profundidade no banco das solicitações ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/db/schema/requests.ts` · `drizzle/0004_*.sql`
**Impacto:** nenhum caminho do domínio liga um comentário a um evento de outra solicitação, mas o banco não impede: `request_comment.status_event_id` referencia só `request_status_event.id`, então o comentário de motivo da solicitação A poderia apontar para um evento da B (no estilo da P39).
**Correção:** — (opção: migração aditiva com FK composta `(request_id, status_event_id)` → `(request_id, id)` e a restrição única correspondente em `request_status_event`)
**Registrado em:** 2026-11-24

#### P52 — Desempenho: a CTE `last` das abertas na entrega varre todo o histórico do setor ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/features/requests/open.ts:94-117`
**Impacto:** a CTE `last` faz `DISTINCT ON` sobre todos os eventos do setor até o instante T da entrega, então cresce com todo o histórico e roda em cada abertura de um resumo de passagem, inclusive os antigos. Sem defeito de resultado.
**Correção:** — (limite seguro sugerido pela revisão final: acrescentar à CTE `request.created_at <= T and (request.status in ('requested','in_transit') or request.status_changed_at > T)`; vale porque `status_changed_at` sempre é o instante do último evento: uma solicitação hoje fechada com `status_changed_at <= T` estava fechada em T)
**Registrado em:** 2026-11-24

#### P53 — Item que muda de unidade ou de tipo no período não é tratado pelo dashboard 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/features/dashboard/controls.ts` · `src/features/dashboard/stock.ts` · `src/features/dashboard/requests.ts` · `src/features/dashboard/exportCsv.ts`
**Impacto:** o dashboard agrupa por `item_id` e mostra o nome e a unidade do snapshot mais recente do período. Um item cuja unidade mudou no meio do período soma "12 rolos" e "30 peças" no mesmo cartão (o número perde o sentido); um item que passou de controle para estoque entra pelo tipo do snapshot nas linhas e pelo tipo do cadastro na lista de itens ativos. A quantidade pedida das solicitações (`request_item.item_unit_snapshot`) e a coluna do CSV têm a mesma lacuna.
**Correção:** — (opção: agrupar por `(item_id, unidade)` e mostrar uma linha por unidade, ou impedir a troca de unidade e de tipo de um item que já tem histórico)
**Registrado em:** 2026-11-25

#### P54 — Erro do detalhe rápido aparece fora do Sheet ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/app/(app)/error.tsx` · `src/app/(app)/@detalhe/`
**Impacto:** o `(app)/error.tsx` (P19) também envolve o slot `@detalhe` (o `not-found.tsx` só envolve `children`): um erro dentro do Sheet do detalhe rápido mostra "Algo deu errado" no lugar do slot, fora do Sheet, e "Tentar de novo" re-renderiza o slot. Sem perda de dados; a página completa continua certa.
**Correção:** — (opção: um `error.tsx` próprio em `@detalhe`, com o fallback dentro do Sheet)
**Registrado em:** 2026-11-25

#### P55 — Helpers do E2E repetidos nos quatro specs antigos e em helpers.ts ⚪
**Estado:** Aberto, não triado
**Arquivos:** `e2e/helpers.ts` · `e2e/auth.spec.ts` · `e2e/cadastros.spec.ts` · `e2e/passagem.spec.ts` · `e2e/solicitacoes.spec.ts`
**Impacto:** `ipPrefix`/`clientIp`, `text`, `unique`, `uniqueEmail`, `ago`, `signUp*` e `seedSector` existem em cinco arquivos; `e2e/helpers.ts` nasceu só para `dashboard.spec.ts` porque migrar os specs antigos seria refatoração no commit de feature. Uma correção de helper precisa ser feita em cinco lugares.
**Correção:** — (um commit só de refatoração: os quatro specs passam a importar de `e2e/helpers.ts`, sem mudar asserção)
**Registrado em:** 2026-11-25

#### P56 — Destino além do teto de 200 escolhas cai do filtro de /solicitacoes ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/features/requests/choices.ts` (`listFilterDestinations`) · `src/components/solicitacoes/RequestsScreen.tsx`
**Impacto:** o filtro `destino=` só aceita um destino que esteja entre as 200 escolhas do `listFilterDestinations` (ordenadas por `lower(name)`). A barra de destino do dashboard leva a `/solicitacoes?visao=tabela&entrega=…&destino=<uuid>`; com mais de 200 destinos, o destino além do teto é descartado pela tela e a lista deixa de bater com o número do dashboard. Hoje há poucos destinos.
**Correção:** — (opção: validar `?destino=` por existência, como o `?item=` já faz com `listFilterItems(db, actor, sectorId, selectedItemId)`)
**Registrado em:** 2026-11-25

#### P57 — Índices do dashboard só sob medição no Neon ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/db/schema/handovers.ts` · `src/db/schema/requests.ts` · `drizzle/`
**Impacto:** o dashboard só lê, e nenhum índice entrou na Fase 5 (regra: índice só sob medição). Dois candidatos: `handover(operational_date)` para "Todos os setores" (o índice de hoje é `(sector_id, operational_date)`) e `request_status_event(request_id, changed_at) where to_status = 'delivered'` para a primeira entrega (`deliveredBetweenSql` e `firstDeliveredAtSql`). Também a CTE `latest` de `src/features/dashboard/stock.ts`, que não tem limite (varre a última contagem de cada item). Sem medição não se sabe se importam.
**Correção:** — (medir com `EXPLAIN (ANALYZE)` no Neon com o volume do piloto; criar por migração aditiva só o que medir)
**Registrado em:** 2026-11-25

#### P58 — A cor das situações do anel não separa em daltonismo ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/components/dashboard/chartColors.ts` · `src/app/chartPalette.test.ts`
**Impacto:** as fatias do anel usam o `-foreground` do token do selo de cada situação (o fundo pastel do selo não passa 3:1 sobre o card): o ΔE mínimo entre elas é 19,5 em visão normal, e em daltonismo as cores se aproximam. A identidade de cada fatia fica no ícone e no texto da legenda (sempre presentes), nunca só na cor.
**Correção:** — (aceitar enquanto ícone e texto estiverem na legenda; opção: padrões de preenchimento nas fatias)
**Registrado em:** 2026-11-25

#### P59 — O CSV se monta inteiro em memória ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/features/dashboard/exportCsv.ts` · `src/app/api/dashboard/export/route.ts`
**Impacto:** `buildPassagesCsv` lê até 10.000 linhas (`CSV_MAX_ROWS`) e devolve o texto inteiro; acima disso a rota responde 413 e a pessoa precisa escolher um período menor. Sem problema no piloto; um setor com muitas passagens por dia e período de 93 dias pode bater no teto.
**Correção:** — (opção: `ReadableStream` com cursor, ou subir o teto sob medição)
**Registrado em:** 2026-11-25

#### P60 — Duplicações da Fase 5 para um commit só de refatoração ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/features/handovers/history.ts` · `src/features/dashboard/` · `src/features/requests/` · `src/components/dashboard/` · `test/dashboardWorld.ts` · `src/app/(app)/error.tsx` · `src/app/(app)/not-found.tsx`
**Impacto:** sem defeito conhecido; só custo de manutenção. A revisão final listou: os comentários de `historySource`/`historyPairsSql` sobre `sectorId` nulo = "todos" valer só para o admin; `AppError`/`AppNotFound` copiam os arquivos da raiz; `STATUS_FILTERS` escrito 3 vezes; a projeção duplicada de `historyChoices`; `EMPTY` devolvido por referência; `test/dashboardWorld.ts` grande demais (dividir); `.mapWith(Number)` apaga o `| null` do tipo; a duplicação dos blocos de item em controles e estoque e o `inRange(string)` com `sql.raw` (só recebe literal hoje); `requests.ts` com os próprios predicados de status em vez de `statusFilterSql` (a paridade guarda hoje); `screenFilters` copia a validação da tela (extrair `validateRequestFilters`); os casts `as` da Tarefa 10 fora os do shadcn; `ALL_SECTORS_HINT` escrito 3 vezes; `inPeriod` do `exportCsv` copia o `WHERE` da `historySource`.
**Correção:** — (um commit só de refatoração, com os testes verdes antes e depois, nunca junto de uma feature)
**Registrado em:** 2026-11-25

#### P61 — Ajustes de UX da Fase 5 ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/features/requests/choices.ts` · `src/components/solicitacoes/RequestsScreen.tsx` · `src/features/handovers/historyFilters.ts` · `src/components/dashboard/StockTrendChart.tsx` · `src/components/kokonutui/spending-ring.tsx`
**Impacto:** sem perda de dados. (1) Em "Todos os setores" o filtro de item de `/solicitacoes` repete opções de mesmo nome de setores diferentes (ui-rules §2.5: mostrar o que a pessoa reconhece). (2) O subtítulo de `/solicitacoes` com Status = Cancelada não explica a janela. (3) Um `?turno=` de outro setor ainda filtra o histórico (os links do dashboard não são afetados: o turno do segmento é sempre do setor do item). (4) O eixo Y do `StockTrendChart` não tem unidade (ela está no cabeçalho do cartão e na dica). (5) A seleção do anel é guardada por posição e não por fatia (só importa numa atualização com a mesma chave). (6) O nome acessível do total do anel não tem singular (`1 passagens: ver a lista`) e o componente genérico fixa o substantivo "passagens".
**Correção:** — (opções: rótulo com o setor nas opções repetidas; unidade no eixo; guardar a chave da fatia; o nome do total por prop, montado com plural pelo `DashboardPassages`)
**Registrado em:** 2026-11-25

#### P62 — A `main` não tem proteção: push direto vira deploy sem CI 🟠
**Estado:** Aberto, não triado
**Arquivos:** `.github/workflows/ci.yml`
**Impacto:** com a integração Git da Vercel, todo push na `main` publica, inclusive sem o CI verde; "PR só entra com o CI verde" não é imposto pelo GitHub.
**Correção:** — (opção: proteção da `main` com os checks `Tipos, lint e testes` e `E2E (Playwright)`, passo B1 do runbook, antes de ligar a Vercel)
**Registrado em:** 2026-11-26
**Atualização (2026-11-28):** o processo das telas (skill `handoff-visual`, Etapa 11) manda o controlador conferir o CI verde do PR antes de pedir o merge, e o `pre-commit` local do `check-names` (PR B) só cuida de nomes. A proteção da `main` continua decisão do dono.

#### P63 — Comportamento na Vercel só se confirma no primeiro deploy 🟡
**Estado:** Aberto, não triado
**Arquivos:** `vercel.json` · `next.config.ts` · `src/lib/auth/createAuth.ts` · `src/lib/sentry/options.ts`
**Impacto:** a Fase 6 não fez deploy, então ficou sem prova: `gru1` e o formato do `x-vercel-id`, o HSTS da Vercel, o `deploymentEnabled` ignorando as branches, o `bunx bun@1.3.3` na imagem de build, o `engines` sobre a configuração do painel, o IP do rate limit sem o aviso do Better Auth, o envio real e o flush do Sentry, a passkey com a `Permissions-Policy` em navegador real e o detalhe rápido com `next-url` (P44).
**Correção:** — (opção: conferir no primeiro deploy, passos B7 e B9 do runbook, e registrar o resultado aqui)
**Registrado em:** 2026-11-26
**Atualização (2026-11-26):** a sobrescrita do `x-forwarded-for` pela Vercel se apoia na documentação dela, não num teste: o B7 só prova que chega um IP válido. O `x-vercel-id` cru anotado no B7 confirma o formato `<borda>::<região>::<id>`.

#### P64 — Aprovação da empresa (LGPD) pendente e /privacidade em rascunho 🟠
**Estado:** Aberto, não triado
**Arquivos:** `src/features/privacy/privacyContent.ts`
**Impacto:** sem a autorização do controlador dos dados (a empresa) ninguém é convidado; a retenção é "enquanto o uso durar", sem prazo; não existe ação de anonimizar uma pessoa desligada (a conta só se desativa).
**Correção:** — (opção: passo B12 do runbook, com o texto aprovado por escrito e o PR curto de `PRIVACY_DRAFT = false`; depois, uma ação de anonimizar que mantenha o id)
**Registrado em:** 2026-11-26
**Atualização (2026-11-26):** o PR de `PRIVACY_DRAFT = false` leva o que só a empresa pode dizer (B12): quem é a controladora, o contato do encarregado (LGPD art. 41), a base legal (art. 7º) e por quanto tempo ficam as cópias diárias do CSV e os relatórios do Sentry.

#### P65 — Riscos aceitos do Hobby e do Neon Free no piloto 🟠
**Estado:** Aberto, não triado
**Arquivos:** —
**Impacto:** o plano Hobby da Vercel é "personal or non-commercial", guarda logs por 1 hora, só faz rollback para o deploy imediatamente anterior e tem uma região; o Neon Free dá 100 CU-h por mês por projeto, suspende o projeto quando acaba e restaura só até 6 horas atrás.
**Correção:** — (opção: rever no go/no-go da semana de piloto e decidir entre Pro e Launch)
**Registrado em:** 2026-11-26

#### P66 — Passkeys presas ao host *.vercel.app 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/lib/auth/createAuth.ts` (`rpID`)
**Impacto:** o `rpID` das passkeys é o host de `BETTER_AUTH_URL`; trocar para um domínio próprio invalida todas as passkeys (a senha e o link do administrador continuam). Sem domínio próprio também não há e-mail (P8) nem Apple (P6).
**Correção:** — (opção: comprar o domínio antes de crescer além do piloto e pedir às pessoas que criem a passkey de novo)
**Registrado em:** 2026-11-26

#### P67 — Fechar a aba com o salvamento automático na fila perde o que não foi salvo 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/components/passagens/useHandoverAutosave.ts` · `src/components/passagens/HandoverForm.tsx`
**Impacto:** não há guarda `beforeunload`: com sinal fraco no galpão (provável), fechar ou recarregar a aba com salvamentos na fila perde o que ainda não chegou ao servidor.
**Correção:** — (opção: avisar ao sair com salvamento pendente e mostrar o estado "Salvando…" por mais tempo; observar no piloto)
**Registrado em:** 2026-11-26
**Atualização (2026-11-27):** o "não há guarda `beforeunload`" do Impacto está vencido. O aviso ao sair já existe: `useHandoverAutosave.ts:198-207` liga o `beforeunload` enquanto há algo não salvo (`hasUnsaved`). O resto continua valendo: se a pessoa confirma a saída com o sinal fraco, o que ainda não chegou ao servidor se perde, porque nada fica guardado no aparelho. Guardar no aparelho é a decisão T15 do lote 0 do roteiro (`.git/sdd/roadmap/roteiro.md` §4.1, fora do git), que recomenda não prometer isso no texto da tela.

#### P68 — Sentry sem source maps e com +67 KB gzip de JS no cliente ⚪
**Estado:** Aberto, não triado
**Arquivos:** `next.config.ts` · `src/instrumentation-client.ts`
**Impacto:** sem `SENTRY_AUTH_TOKEN` não há source maps: a pilha dos erros do navegador chega minificada. O SDK pesa cerca de 67 KB gzip (+11%) no cliente mesmo desligado.
**Correção:** — (opção: token de upload só na Vercel e `sourcemaps` ligado; avaliar o carregamento tardio do SDK)
**Registrado em:** 2026-11-26

#### P69 — scrubEvent só limpa padrões conhecidos da mensagem de erro 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/lib/sentry/scrubEvent.ts`
**Impacto:** um valor de pessoa fora dos sete padrões (SQL do Drizzle, parâmetros, valor de tipo inválido, token de caminho, fragmento `#token=`, query string e e-mail) sairia para o Sentry, fora do país.
**Correção:** — (opção: revisar os eventos do Sentry na rotina diária do primeiro mês e acrescentar o padrão que aparecer)
**Registrado em:** 2026-11-26

#### P70 — Alvos de toque medidos só no Chromium emulado ⚪
**Estado:** Aberto, não triado
**Arquivos:** `e2e/touch-targets.spec.ts`
**Impacto:** o guarda mede em Chromium emulado a 390×844. iOS e Android reais, o tema escuro e a área do link esticado do cartão da Lista não foram medidos.
**Correção:** — (opção: conferir no celular dos operadores no primeiro dia do piloto)
**Registrado em:** 2026-11-26
**Atualização (2026-11-27):** o "tema escuro não medido" do Impacto está vencido. Com o visual novo, o escuro virou o padrão, e o `e2e/touch-targets.spec.ts`, que não escolhe tema, passou a medir no escuro; o que fica sem medida é o claro. O tema não muda o tamanho dos controles, então o risco é baixo. iOS e Android reais e a área do link esticado da Lista continuam sem medida.

#### P71 — Sem instalação como app (manifest e ícones) ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/app/`
**Impacto:** "Adicionar à tela inicial" cria um atalho sem ícone próprio e a barra do navegador não tem `themeColor`.
**Correção:** — (opção: `manifest.ts` com ícones; testar a passkey no app instalado do iOS antes)
**Registrado em:** 2026-11-26

#### P72 — Tempo de preenchimento da passagem sem medição automática ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/features/handovers/deliver.ts`
**Impacto:** o critério "mais rápida que a planilha" (spec §17) é medido no piloto com cronômetro e observador (C6-6); medir sozinho exigiria gravar o tempo de preenchimento (`fill_ms`), o que pede uma migração.
**Correção:** — (opção: gravar o tempo na entrega, numa fase com migração)
**Registrado em:** 2026-11-26

#### P73 — Suíte do Vitest lenta e teste de migração com timeout sob carga ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/db/schema/migration0002.test.ts` · `.github/workflows/ci.yml`
**Impacto:** a suíte leva cerca de 760 s com a máquina carregada; o `migration0002.test.ts` já estourou o limite de 15 s e o job `checks` do CI tem 15 minutos de teto.
**Correção:** — (opção: dividir a suíte em dois jobs ou subir o teste de migração para um limite maior)
**Registrado em:** 2026-11-26

#### P74 — admin:invite não mostra quantos administradores ativos existem ⚪
**Estado:** Aberto, não triado
**Arquivos:** `scripts/adminInvite.ts`
**Impacto:** um convite de administrador a mais passa despercebido; a trava de host (`--confirmar-host`) cobre o banco errado, não a quantidade de administradores.
**Correção:** — (opção: imprimir a contagem de administradores ativos junto do alvo, antes da confirmação)
**Registrado em:** 2026-11-26

#### P75 — Next imprime o erro não tratado inteiro no log da Vercel 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/instrumentation.ts` · os loaders das páginas (`src/features/**/loaders.ts`, `src/app/(app)/**/page.tsx`)
**Impacto:** um erro não tratado de Server Component ou de rota sai no log do próprio Next como `⨯ Error: Failed query: … params: …`, com o SQL e os parâmetros (e-mail, hash ou texto da passagem); o log da Vercel guarda 1 hora no Hobby. `logServerError` só cobre o erro tratado, o que o `logger` do Better Auth emite e o erro inesperado do `/api/auth` (o embrulho do `route.ts`). A parte do roteador do `better-call` (o `# SERVER_ERROR: <erro>`) foi fechada na rodada da revisão final (`onAPIError: { throw: true }` e o embrulho do `route.ts`); sobra só o log do próprio Next.
**Correção:** — (opções: (1) aceitar no piloto e rever o log em B7 e B15 sem copiar linhas; (2) capturar nos loaders das páginas, chamar `logServerError` e relançar um `Error` neutro, sem a mensagem do Drizzle)
**Registrado em:** 2026-11-26

#### P76 — Gerar link de nova senha não deixa registro de quem gerou 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/features/admin/passwordReset.ts`
**Impacto:** um administrador pode gerar o link de outro administrador (e assumir a conta) sem rastro de quem gerou, para quem e quando, contra a regra de rastro do projeto.
**Correção:** — (opção: tabela de auditoria dos links gerados; exige migração, fora da Fase 6)
**Registrado em:** 2026-11-26

#### P77 — Redefinição e desativação não apagam passkeys 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/features/admin/passwordReset.ts` · `src/features/admin/people.ts` · `src/lib/auth/createAuth.ts`
**Impacto:** a redefinição pelo administrador e a desativação não apagam passkeys; o administrador não vê nem remove as passkeys de outra pessoa; `/conta` não encerra as outras sessões. Quem usar um link vazado pode criar uma passkey que sobrevive à troca de senha. Hoje: o procedimento de conta tomada do runbook.
**Correção:** — (opção: apagar as passkeys na redefinição gerada pelo administrador ou na desativação, e oferecer "sair dos outros aparelhos" em `/conta`)
**Registrado em:** 2026-11-26

#### P78 — createPasswordResetLink não é atômico ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/features/admin/passwordReset.ts`
**Impacto:** dois administradores ao mesmo tempo podem deixar dois links válidos, e uma desativação concorrente pode deixar um link para a pessoa desativada (volta a valer se ela for reativada em 24 h). Precisa de dois administradores agindo no mesmo instante: no piloto há um.
**Correção:** — (opção: depois de criar, apagar as outras linhas da pessoa e reler `deactivatedAt`, falhando fechado)
**Registrado em:** 2026-11-26

#### P79 — React Compiler desiste do SignInPanel inteiro ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/components/auth/SignInPanel.tsx`
**Impacto:** o React Compiler desiste do componente inteiro (`SignInPanel.tsx:52-62`: optional chaining dentro de `try`); anterior à Fase 6.
**Correção:** — (opção: ler `PublicKeyCredential?.isConditionalMediationAvailable` antes do `try` e conferir com `bun scripts/rc-check.mjs`)
**Registrado em:** 2026-11-26

#### P80 — Nenhum guarda impede script de importar logServerError ou Sentry ⚪
**Estado:** Aberto, não triado
**Arquivos:** `test/logGuard.test.ts` · `scripts/`
**Impacto:** nada impede que um script de `scripts/*.ts` (rodado pelo Bun) passe a importar `logServerError` ou `@sentry/*`, o que quebraria o `admin:invite` só na hora do go-live (o Bun resolve `@sentry/bun`, que não está instalado). Hoje os dois scripts não chegam lá (conferido com `bun build --target bun`).
**Correção:** — (opção: um caso em `test/logGuard.test.ts` que segue os imports estáticos de `scripts/*.ts`)
**Registrado em:** 2026-11-26

#### P82 — Telas sem desenho novo ficam no layout antigo sem prazo: Conta, Administração, entrada, privacidade, erro e 404 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/app/(auth)/` (entrar, convite, redefinir-senha) · `src/app/(app)/bem-vindo` · `src/app/(app)/conta` · `src/app/(app)/admin/` (visão geral e os 5 cadastros) · `src/app/privacidade` · `src/app/error.tsx` · `src/app/not-found.tsx` · `src/app/global-error.tsx` · `src/app/(app)/error.tsx` · `src/app/(app)/not-found.tsx`
**Impacto:** o visual novo trouxe a paleta, as fontes e o tema escuro para todas as telas (D-V1), mas só o Início e o shell mudaram de layout. Estas telas continuam no layout antigo: cartão pequeno centrado, títulos em Geist, sem a tipografia display nem os raios grandes, botões de 36px no desktop. Os selos `outline` dessas telas (os papéis da Equipe, "Atravessa a meia-noite" nos Turnos e o tipo do item) têm a borda `--border`, de 9% de tinta, tênue nos dois temas; o texto deles é legível. Nenhum handoff do designer as cobre, então o piloto conviveria com dois estilos sem prazo para acabar. As telas que têm handoff (Passagens, Passagem de turno, Solicitações e Dashboard) não entram aqui: a fila do roteiro já as planeja (PRs C a G), inclusive o item 5 do pack de correção (`HandoverDetail`), que é a primeira tarefa da branch D.
**Correção:** — (opção: pedir já ao designer os desenhos dessas telas, para entrarem na fila depois do Dashboard; é a decisão T20 do lote 0 do roteiro, `.git/sdd/roadmap/roteiro.md` §4.1)
**Registrado em:** 2026-11-27

#### P84 — Borda dos campos no tema claro tem 1,36:1, abaixo de 3:1 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/app/globals.css` (`--input`) · `src/components/ui/input.tsx` · `src/components/ui/textarea.tsx` · `src/components/ui/native-select.tsx`
**Impacto:** no claro, a borda `--input` (15% de tinta) mede 1,36:1 sobre o branco. O campo é visível, mas fica abaixo dos 3:1 do WCAG 1.4.11 para o contorno de um controle. Os campos do shadcn de antes eram iguais. O valor veio da spec, para as telas que ainda não têm handoff.
**Correção:** — (opção: no handoff de cada tela com formulário, a variante `surface` de `Input` e `Textarea` (decisão PT-D12 do roteiro) ou um `--input` mais forte, medido no guarda de contraste)
**Registrado em:** 2026-11-27

#### P85 — Segmento marcado do seletor de setor tem pouco contraste no claro (thumb 1,32:1) 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/components/passagens/SectorPicker.tsx` · `src/app/globals.css` (`--seg`, `--thumb`)
**Impacto:** no tema claro, o thumb branco contra o trilho (`--seg`) mede 1,32:1, e o trilho contra a página, 1,17:1. O segmento marcado se apoia no peso da fonte (700 contra 500) e na sombra, abaixo dos 3:1 do WCAG 1.4.11 para indicador de estado. É o desenho do protótipo. No escuro, o anel de foco do segmento marcado (`ring-ring` por dentro, sobre o thumb creme) mede 2,16:1.
**Correção:** — (decisão do dono. Opções: um `--seg` claro mais escuro, ou `ring-1 ring-foreground/10` no thumb do claro; no anel, `ring-thumb-foreground/60` quando `aria-checked`)
**Registrado em:** 2026-11-27

#### P86 — Setas do seletor de setor trocam de setor a cada passo, recarregam a tela e perdem o foco 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/components/passagens/SectorPicker.tsx` · `src/app/(app)/actions.ts` (`chooseSectorAction`)
**Impacto:** no Base UI 1.9, a seleção do grupo de rádio segue o foco. Cada seta chama o `chooseSectorAction`, e o grupo fica desabilitado até o redirecionamento: ir do 1º ao 4º setor custa 3 idas ao servidor. A cada troca, a árvore do `HomeHandovers` remonta e o foco volta ao `body` (com os botões antigos já era assim). Quem usa teclado perde o lugar a cada passo.
**Correção:** — (decisão do dono. Opções: trocar de setor só com Espaço ou Enter, ou só depois de uns 400 ms sem tecla)
**Registrado em:** 2026-11-27

#### P87 — Crossfade de cor do cartão do turno provavelmente não roda, e a transição da troca de tema não foi conferida ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/components/passagens/MyShiftCard.tsx` (`transition-colors duration-[450ms]`) · `src/lib/theme.ts`
**Impacto:** a spec §7 promete que o cartão "Passagem do meu turno" faz crossfade da cor quando o admin troca de setor. Como a troca remonta o cartão (P86), ele já nasce com a cor nova e a transição não tem de onde animar. A verificação visual não conferiu o crossfade nem a transição de cor na troca de tema (sem `disableTransitionOnChange`, as cores com transição mudam devagar). Sem efeito na operação.
**Correção:** — (opção: conferir as duas no navegador; se o crossfade não roda, tirar a promessa da spec e do registro, ou manter o nó do cartão entre as trocas)
**Registrado em:** 2026-11-27
**Atualização (2026-11-27):** a troca de cor do cartão passou ao Motion na emenda do PR B (`SectorColorFade`): uma camada com a cor de antes some em 0,4 s, também quando o cartão remonta (a cor do último cartão vale por até 2 s), e troca na hora com movimento reduzido. Provada em `SectorColorFade.test.tsx` (troca no mesmo cartão e remontagem) e no Chromium (`e2e/motion.spec.ts`). Continua aberta: a transição de cor na troca de tema não foi conferida.

#### P88 — Lista de Setores não mostra a cor de cada setor ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/components/admin/sectors/SectorsAdmin.tsx` · `src/components/admin/AdminListRow.tsx`
**Impacto:** a cor virou parte da identidade do setor (seletor de setor e cartão do turno), mas para saber a cor de um setor o admin precisa abrir "Editar" (`ui-rules.md §2.5`: mostrar o que a pessoa reconhece).
**Correção:** — (opção: a amostra `SECTOR_COLOR_BG` e o nome da cor no subtítulo do `AdminListRow`)
**Registrado em:** 2026-11-27

#### P89 — "Agora não" do cartão de convite não dá retorno durante o envio ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/components/app-shell/InviteTeamCard.tsx` · `src/components/app-shell/DismissInviteCardForm.tsx`
**Impacto:** o `<form action>` de Server Component não desabilita o botão durante o envio. Até o `revalidatePath` redesenhar, nada muda na tela, e dá para clicar de novo (é inofensivo: só grava o cookie outra vez). Falta o retorno de ação de `ui-rules.md §3`.
**Correção:** — (opção: um filho client pequeno com `useFormStatus`, que desabilita o botão e mostra "Dispensando…")
**Registrado em:** 2026-11-27
**Atualização (2026-11-27):** a prova do PR B (C1, falha de rede) achou o caso de erro: com a requisição da ação abortada, o erro subia até o `error.tsx` de (app) e o Início virava "Algo deu errado". O `<form>` passou ao filho client `src/components/app-shell/DismissInviteCardForm.tsx`, que pega a falha (toast genérico e o cartão fica), com teste no `InviteTeamCard.test.tsx`. Continua aberta: o botão ainda não dá retorno durante o envio; o `useFormStatus` da opção entra nesse filho.

#### P90 — Foco fraco fora dos cartões coloridos, sem indicador no alto contraste do Windows, e borda de erro abaixo de 3:1 no escuro 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/components/ui/button.tsx` (base com `outline-none` e `ring-ring/50`; `destructive` com `ring-destructive/20`) · `src/components/ui/input.tsx` (o mesmo padrão e `dark:aria-invalid:border-destructive/50`) · os outros primitivos com `outline-none`
**Impacto:** o anel `ring-ring/50` mede de 2,05:1 a 2,73:1 contra o vizinho, e o do `destructive`, 1,46:1 no claro (2,37:1 no escuro). No Tailwind 4, o `outline-none` não tem a reserva de `forced-colors`: com o alto contraste do Windows ligado, o `box-shadow` é zerado e esses controles ficam sem indicador de foco. A borda de erro do campo no escuro mede 2,98:1 contra a página (2,85:1 contra o fundo do campo), abaixo dos 3:1 do WCAG 1.4.11; o erro também chega pelo texto do `FieldError`. Nada disso reprova o WCAG 2.4.7, que não tem limiar, e não é regressão desta branch: os botões dos cartões coloridos já usam contorno sólido (G1).
**Correção:** — (opção: `outline-hidden` na base, ou contorno sólido também no `destructive` e nos campos, provado por estilo calculado; a borda de erro mais forte medida no guarda)
**Registrado em:** 2026-11-27

#### P91 — Variantes destructive sem uso ficam fora do guarda de contraste, e o hover do Badge reprova ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/components/ui/badge.tsx` (`destructive`) · `src/components/ui/dropdown-menu.tsx` (item `destructive`) · `src/components/ui/alert.tsx` (`text-destructive/90`) · `src/app/themeContrast.test.ts`
**Impacto:** o guarda mede o `--destructive` no texto e no `Button`, nos dois temas, em repouso e no hover. Duas variantes sem uso hoje ficam de fora: o hover `[a]:hover:bg-destructive/20` do `Badge` mede 4,20:1 sobre a página no claro (reprova), e o item `destructive` do `DropdownMenu` passa (5,72:1 e 4,72:1 sobre o `popover`). O primeiro `<Badge variant="destructive">` num link entraria abaixo do AA sem o guarda acusar. A descrição do `Alert` (`text-destructive/90`, usada no `DashboardBlockBoundary`) passa (6,22:1 no claro, 5,95:1 no escuro), mas também não é medida.
**Correção:** — (opção: medir as duas variantes e o `/90` no `themeContrast.test.ts`, ou um `it.todo` até o primeiro uso; o `--danger` da decisão T9 do roteiro entra na branch D)
**Registrado em:** 2026-11-27

#### P92 — Avatares em data URI pesam de 12 a 38 KB e saem duas vezes na página ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/lib/avatar.ts` · `src/components/passagens/HomeCards.tsx` · `src/components/app-shell/AuthedSidebar.tsx`
**Impacto:** cada avatar do DiceBear é um data URI de 12 a 38 KB (cerca de 16 KB na mediana, medido com 40 sementes em 2026-11-27) e sai duas vezes: no atributo do HTML e no payload RSC. O avatar da mesma pessoa se repete na sidebar, no "Convide sua equipe" e nas "Solicitações" vazias. No primeiro acesso do admin, ou com pendente e `continue`, são dezenas de KB só de avatar (o brotli da Vercel reduz bem). O comentário de `avatar.ts` ainda diz "~26 KB".
**Correção:** — (opção: medir no celular do piloto; se pesar, um `GET` autenticado que devolve o SVG com `Cache-Control: immutable`, ou um avatar menor. A decisão T11 do lote 0 do roteiro mede de novo nas branches C e F, com teto de uns 300 KB de avatar por página)
**Registrado em:** 2026-11-27

#### P93 — Satoshi não tem os glifos ª e º ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/app/layout.tsx` (`localFont`) · `.context/library-docs.md §17`
**Impacto:** num texto em Satoshi (`font-heading`), `ª` e `º` caem na fonte seguinte da pilha (Geist) e destoam. Nenhum texto de display usa os dois hoje.
**Correção:** — (opção: evitar `ª` e `º` em texto display; a licença proíbe editar ou converter a fonte)
**Registrado em:** 2026-11-27

#### P94 — Id de quem salvou o rascunho vai ao navegador sem uso ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/features/handovers/types.ts` (`SavedMark.byId`) · `src/features/handovers/draft.ts` (`savedById`) · `src/features/handovers/formState.ts` · `src/components/passagens/useHandoverAutosave.ts`
**Impacto:** só o `HomeCards` (servidor) usa o id de quem salvou, como semente do avatar do estado `continue`. Mesmo assim, o `SavedMark` compartilhado leva o id, e por isso o estado do `HandoverForm` (client) e a resposta da Server Action do salvamento automático mandam o id ao navegador. Fere a minimização de dados (LGPD, princípio da necessidade), mas o id não é segredo. Os ids de quem entregou e de quem confirmou ficam no servidor (`MyShiftCard` e `PendingHandoverCard` são Server Components).
**Correção:** — (opção: o `SavedMark` volta a `{ at, byName }` e o id fica só no `MyShiftState` `continue`)
**Registrado em:** 2026-11-27

#### P95 — global-error ignora o tema e as fontes ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/app/global-error.tsx`
**Impacto:** quando o próprio layout raiz quebra, o `<html>` do `global-error` substitui o do layout e sai sem a classe `dark` e sem as variáveis de fonte. Com o escuro como padrão, quem nunca escolheu o tema vê a tela de erro clara, na fonte do sistema. É raro e só visual.
**Correção:** — (opção: `className="dark"` no `<html>` e um `useLayoutEffect` com a regra do `THEME_INIT_SCRIPT` (só `"light"` guardado tira a classe); as variáveis de fonte, se valer a pena)
**Registrado em:** 2026-11-27

#### P96 — Início do admin roda 6 contagens a cada carga só para decidir o cartão de convite ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/components/passagens/HomeHandovers.tsx` (`getAdminOverviewCounts`) · `src/features/admin/overview.ts`
**Impacto:** o `getAdminOverviewCounts` (6 subconsultas de contagem, 2 com `EXISTS`) roda em toda carga do Início do admin, só para decidir um cartão que aparece com 1 pessoa ativa e nenhum convite pendente. Com os dados do piloto é barato.
**Correção:** — (opção: contar primeiro as pessoas ativas e só buscar o resto com 1 pessoa; ou deixar como está)
**Registrado em:** 2026-11-27

#### P97 — uiRegistryDoc não varre src/components/app-shell ⚪
**Estado:** Aberto, não triado
**Arquivos:** `test/uiRegistryDoc.test.ts`
**Impacto:** `ThemeSwitch`, `UserAvatar`, `AvatarStack`, `InviteTeamCard`, `AppHeader` e os outros componentes do shell entraram no `ui-registry.md` à mão. Nada impede que o próximo componente do shell fique fora do registro, e os nomes deles não estão na lista de cabeçalho próprio. Hoje todos têm `###`.
**Correção:** — (opção: pôr `app-shell` no `sourceFiles` e os nomes na lista de cabeçalhos)
**Registrado em:** 2026-11-27

#### P98 — Guarda de cor crua não varre .ts, prefixos direcionais nem // dentro de string ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/app/rawColors.test.ts`
**Impacto:** o guarda só lê `.tsx`. `statusStyle.ts`, `chartColors.ts` e `features/sectors/colors.ts` guardam strings de classe e são `.ts`. `border-t-*`, `border-x-*`, `inset-ring-*` e `drop-shadow-*` não estão no `CLASS_PREFIX`. O `stripComments` pode esconder um hex que venha depois de `//` dentro de uma string. Hoje não há violação (conferido com `grep` em `src`).
**Correção:** — (opção: varrer também os `.ts`, com `avatar.ts` como exceção, e acrescentar os prefixos)
**Registrado em:** 2026-11-27

#### P99 — Avatar de quem confirmou aparece mesmo quando o nome não é achado ("outra pessoa") ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/components/passagens/HomeCards.tsx` · `src/components/passagens/MyShiftCard.tsx` · `src/components/passagens/HomeCards.test.tsx`
**Impacto:** na passagem confirmada, sem o nome de quem confirmou, a frase diz "Confirmada por outra pessoa às …" e a pilha mostra o avatar gerado do id. O avatar é decorativo (`alt=""`), mas põe um rosto ao lado de "outra pessoa". O `HomeCards.test.tsx` documenta o comportamento de hoje.
**Correção:** — (decisão do dono: esconder o avatar quando o nome não é achado; o teste muda junto)
**Registrado em:** 2026-11-27

#### P100 — No setor verde (Eco) o bloco "Confirmada" se destaca pouco ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/components/passagens/MyShiftCard.tsx` (`STATUS_TONE`) · `src/app/globals.css` (`--on-pastel-success`, `--on-pastel-success-soft`)
**Impacto:** o bloco verde "Confirmada" segue a regra geral (o mesmo bloco em todo setor) e passa no contraste (6,01:1 no verde). Sobre o setor verde, porém, verde sobre verde chama menos atenção que nos outros setores.
**Correção:** — (decisão do dono na conferência visual. A alternativa do pack de correção, fundo `#1f5131` com texto `#d3eedd` só no setor verde, não foi implementada; spec §6.4.1 e PK-D4 do roteiro)
**Registrado em:** 2026-11-27

#### P101 — No next dev o Strict Mode pode tirar a classe do tema do html ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/lib/theme.ts` · `src/lib/useTheme.ts` · `src/app/layout.tsx`
**Impacto:** só em desenvolvimento: depois de uma remontagem do Strict Mode, o React pode limpar a classe `dark` do `<html>`, e o switch passa a mostrar o claro até recarregar. Em produção não acontece (`library-docs.md §18`).
**Correção:** — (opção: reaplicar a classe num efeito do `useTheme`; ou aceitar, por ser só do dev)
**Registrado em:** 2026-11-27

#### P102 — Build e redeploy dependem do Fontshare no ar e com o mesmo arquivo 🟡
**Estado:** Aberto, não triado
**Arquivos:** `scripts/fetchFonts.mjs` · `scripts/fontsCheck.mjs` · `package.json` (`prebuild`) · `.context/runbook-producao.md` (B5, B17 e "Se algo der errado no meio")
**Impacto:** na Vercel a pasta `src/fonts/satoshi` não sobrevive entre builds: todo deploy baixa a Satoshi de `api.fontshare.com` e `cdn.fontshare.com` e exige o mesmo SHA-256. Com o Fontshare fora, ou com o arquivo trocado, o build para com código 1. Isso vale também para o redeploy da rotação urgente de segredo (B17), e o rollback não serve depois de mudar uma variável (B16). O mesmo acontece no CI quando o cache da fonte falha.
**Correção:** — (opção: um espelho privado, por exemplo um `SATOSHI_MIRROR_URL` não público com o mesmo SHA-256, porque a licença só proíbe repositório público; até lá, o procedimento de "Se algo der errado no meio" do runbook)
**Registrado em:** 2026-11-27

#### P103 — Borda da amostra marcada do SectorColorChoice provada sem passar pelo CSS gerado ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/components/admin/sectors/SectorColorChoice.test.tsx` · `src/app/themeContrast.test.ts`
**Impacto:** os testes provam as classes (`group/color` na pílula e `group-data-checked/color:border-primary-foreground` na amostra), o `data-checked` só na marcada e o contraste do par `primary-foreground` sobre `primary`. Nenhum teste prova que a variante compila e se aplica: isso só foi medido num script avulso e na revisão. É a mesma lacuna que deixou a primeira correção do foco (F1) passar com o defeito. O risco é baixo.
**Correção:** — (opção: um caso no E2E de cadastros que lê o estilo calculado da borda da amostra marcada)
**Registrado em:** 2026-11-27

#### P104 — suggestColorForNewSector conta as cores em JS, contra a regra de agregação no SQL ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/features/admin/sectors.ts` (`suggestColorForNewSector`)
**Impacto:** a função lê a cor de todos os setores ativos, sem limite, e a função pura conta as cores em JS. São poucos setores, mas a regra do projeto manda agregar no SQL. Veio do plano.
**Correção:** — (opção: `group by color` no SQL; o desempate pela ordem da paleta continua na função pura)
**Registrado em:** 2026-11-27

#### P105 — Higiene de testes do visual novo ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/app/themeContrast.test.ts` e `src/app/chartPalette.test.ts` · `test/fontsConfig.test.ts` · `src/components/app-shell/ThemeSwitch.test.tsx` · `src/components/ui/button.test.ts` e `src/components/ui/button.variants.test.ts` · `src/components/admin/sectors/SectorsAdmin.test.tsx` · `src/lib/avatar.test.ts` · `src/components/passagens/SectorPicker.test.tsx` · `src/components/solicitacoes/OpenRequestItem.test.tsx` e `RequestsHomeCard.test.tsx` · `src/components/admin/sectors/SectorColorChoice.test.tsx`
**Impacto:** sem defeito conhecido: são testes que provam menos do que o nome diz, ou que vazam estado depois de uma falha. A revisão final listou: a matemática de cor duplicada entre os dois guardas; a ordem do cache do CI conferida por `indexOf`; o `afterEach` do `ThemeSwitch` que afirma antes de restaurar o espião, e a hidratação sem `finally`; `SIZES` e `VARIANTS` escritos em dois testes do `Button`; um teste duplicado e um token conferido por substring no `SectorsAdmin`; o cache do avatar não afirmado; o teste do redirecionamento do seletor que não afirma o thumb; os testes de destino longo e de zero abertas, fracos; o `SectorColorChoice` sem teste das setas do teclado; e testes por classe em px onde o jsdom não mede layout.
**Correção:** — (um commit só de testes; extrair a matemática de cor para `test/colorMath.ts` num commit de refatoração próprio)
**Registrado em:** 2026-11-27

#### P106 — Sobras de código do visual novo: "use client" sem hook, valores repetidos e mensagens ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/components/app-shell/AppHeader.tsx` · `src/components/app-shell/SidebarSkeleton.tsx` · `src/components/app-shell/InviteTeamCard.tsx` · `src/components/app-shell/MenuToggle.tsx` · `src/components/passagens/SectorPicker.tsx` · `src/components/passagens/MyShiftCard.tsx` · `src/components/admin/sectors/SectorColorChoice.tsx` · `src/components/admin/NameForm.tsx` · `scripts/fetchFonts.mjs`
**Impacto:** sem perda de dados; cada item é pequeno. O `AppHeader` tem `"use client"` sem hook (veio do plano). O `SidebarSkeleton` reserva 264px fixos, e no admin, que tem dois grupos, a sidebar salta ao carregar. O `mt-auto` do `InviteTeamCard` não tem efeito. O `MenuToggle` repete "Alternar menu" num `sr-only` que o `aria-label` já dá. O `6.5rem` do `SectorPicker` está escrito 3 vezes nas classes (e uma no comentário). No estado `delivered` do `MyShiftCard`, o leitor de tela ouve "Aguardando recebimento" duas vezes (no bloco e na frase). O `SectorColorChoice` tem a prop `disabled` sem uso e nomeia o grupo duas vezes: a `legend` do `fieldset` e o `aria-labelledby` do `radiogroup` apontam para o mesmo "Cor", e o leitor de tela pode ler "Cor" duas vezes. No `NameForm`, um erro de `color` vindo do servidor cairia no campo nome (não se alcança pela tela). A mensagem de erro do `fetchFonts` pode sair com "..", e o script rodado por um caminho com link simbólico sai com código 0 sem baixar nada (o caminho documentado é `bun run fonts`).
**Correção:** — (opção: um commit de limpeza para cada arquivo, com os testes verdes antes e depois)
**Registrado em:** 2026-11-27

#### P107 — Mapas do roteiro citam o --destructive de antes do ajuste AA ⚪
**Estado:** Aberto, não triado
**Arquivos:** `.git/sdd/roadmap/map-passagem-de-turno.md` · `.git/sdd/roadmap/map-solicitacao-completa.md` · `.git/sdd/roadmap/map-solicitacoes.md` (fora do git)
**Impacto:** os três mapas dos handoffs das branches D, E e F dizem que o `--destructive` é `#d60000` no claro e `#ff8a8a` no escuro. O valor do ajuste AA (`architecture.md §10`, 2026-11-27, desvio f) é `#b80000` e `#ff9393`, com o fundo do botão em `/10` e hover `/15` no claro e em `/15` e hover `/20` no escuro; no PR B o hover escuro passou a `/18` (ver a Atualização). Quem planejar essas branches pelos mapas compara os tons de erro dos handoffs (`--err`, `--dang`) com um valor que não existe mais. A revisão do delta apontou; o `memory.md` também avisa.
**Correção:** — (opção: trocar os valores nos três mapas antes de planejar a branch D)
**Registrado em:** 2026-11-27
**Atualização (2026-11-27):** no PR B (P83) o hover escuro do `destructive` passou de `/20` para `/18` (`dark:hover:bg-destructive/18`): sobre o rodapé `accent/50` o `/20` media 4,38:1. O valor atual a gravar nos mapas é `#b80000` / `#ff9393`, fundo `/10` e hover `/15` no claro, `/15` e hover `/18` no escuro.

#### P108 — Setor rosa tem a mesma cor do cartão "Convide sua equipe" ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/app/globals.css` (`--invite` e `--sector-pink`, os dois `#f2a7c6`) · `src/components/passagens/HomeCards.tsx` · `src/components/app-shell/InviteTeamCard.tsx`
**Impacto:** a spec deu o mesmo valor aos dois tokens. No primeiro acesso do admin, com o setor escolhido em rosa, o "Convide sua equipe" fica logo acima do "Passagem do meu turno", e os dois têm o mesmo rosa. Sem borda nem sombra, os cartões coloridos se separam pela cor (`ui-rules.md §6`), e a regra "rosa só para o convite" não vale nesse caso. O rosa é a última cor da sugestão: só aparece a partir do 5º setor ativo ou por escolha do admin.
**Correção:** — (decisão do dono. Opções: outro tom para o `--invite`, outro rosa na paleta do setor, ou aceitar)
**Registrado em:** 2026-11-27

#### P109 — Estado accent sobre fundo accent: o trilho do BarList some no hover da linha e o hover do "Agora não" do PasskeyOffer quase não se vê no escuro 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/components/dashboard/BarList.tsx` (a linha com `hover:bg-accent`, o trilho com `bg-accent`) · `src/components/auth/PasskeyOffer.tsx` ("Agora não", `ghost` dentro do `CardFooter`) · `src/components/ui/card.tsx` (`CardFooter` com `bg-accent/50`) · `src/components/ui/button.tsx` (`ghost`, `dark:hover:bg-accent/50`) · `src/app/themeContrast.test.ts` (`STATE_CASES` e o caso do rodapé do `destructive`)
**Impacto:** é o caso que a spec do PR B (§14) previa, o `accent` que some onde o fundo já é `accent`, em três pontos que a revisão final achou. (1) No `BarList` com barras (o `DashboardRequests` usa), a parte vazia da barra é `bg-accent` opaco, e no hover a linha vira o mesmo `bg-accent`, nos dois temas: o trilho some, e a referência do 100% desaparece justo quando a pessoa aponta. Antes do PR B o hover não mudava nada (P83) e o trilho continuava visível. (2) O "Agora não" do `PasskeyOffer` é `ghost` dentro do rodapé `accent/50`: no escuro o hover põe outro `accent/50` por cima e vai de `rgb(46,45,41)` a `rgb(49,48,44)`, 1,04:1 (no claro, 1,11:1). Não é regressão (antes era 0), e a tela aparece uma vez. (3) O guarda dos fundos de estado aceita qualquer diferença de 1 nível de 8 bits: os `/50` no escuro dentro de cartão (`ghost`, `Badge` `ghost`, linha de tabela, `FieldLabel`) passam com 1,08:1, que mal se vê, e nenhuma prova por estilo calculado cobre o escuro (as sondas do C1 rodaram o `ghost` no claro de propósito). Os alfas dos `STATE_CASES` e do rodapé do `destructive` estão escritos à mão (não saem das classes, como os do `destructiveButtonAlphas()`), e o título do caso do rodapé cita "rodape", um token que não existe.
**Correção:** — (opção: o trilho com outro fundo no hover da linha, por exemplo `group-hover:bg-background`, medido nos dois temas; um hover local no "Agora não" (`dark:hover:bg-accent` opaco, 1,12:1 sobre o rodapé), registrado no `ui-registry.md`; no guarda, os alfas lidos das classes, os casos "ghost sobre o rodapé" e "trilho no hover da linha" e um piso de perceptibilidade para fundo de estado (por exemplo 1,1:1 contra o repouso, o critério que escolheu o opaco da `AdminOverview`). O piso é escolha de desenho)
**Registrado em:** 2026-11-28
**Atualização (2026-11-28):** resolvidos os itens (1) e (2) e a parte do guarda do item (3); fica aberta pelo que o piso achou nos casos que já existiam. (1) O trilho do `BarList` troca para `bg-card` no hover da linha (`group/bar-row` na linha, `group-hover/bar-row:bg-card` no trilho): as duas cores trocam de lugar, 1,23:1 no claro e 1,18:1 no escuro, em repouso e no hover. (2) O "Agora não" do `PasskeyOffer` ganhou o hover local `dark:hover:bg-input/50` (o do `outline` no escuro): 1,26:1 sobre o rodapé no escuro (era 1,04:1); no claro fica o `hover:bg-accent` do `ghost`, 1,11:1. O `accent` opaco sugerido aqui dava 1,09:1 no escuro, não 1,12:1, e ficaria abaixo do piso. (3) O `themeContrast.test.ts` ganhou o piso `STATE_MIN` = 1,1:1 (documentado no teste, no `ui-rules.md §6` e com a tabela medida no `ui-tokens.md`) e lê o token e o alfa de cada fundo das classes que o componente renderiza (`renderToStaticMarkup` do `CardFooter`, `DialogFooter`, `TableRow`, `FieldLabel`, `BarList`, `StatLink`, `PasskeyOffer` e do `Card` da `AdminOverview`, com o `className` tirado do código-fonte) ou da variante (`buttonVariants`, `badgeVariants`); nenhum alfa à mão, o rodapé do `destructive` inclusive, e o título não cita mais o "rodape". Entraram os casos "trilho no hover da linha" e "ghost sobre o rodapé", e também o `outline` sobre o rodapé do `DialogFooter` (o "Cancelar" do `ConfirmDialog` e do `CancelRequestDialog`) e o `outline` aberto. Prova por estilo calculado (`probe.mjs` no `next start` da 3202, estados `hover-barlist-*` e `hover-agora-nao-*` do `screens/provas.mjs`, nos dois temas): trilho contra a linha no hover 1,234:1 e 1,181:1, "Agora não" contra o rodapé 1,113:1 e 1,268:1, iguais ao guarda. Commits `55f3d6f`, `3acfbe6`, `c4c7b49`, `eec2fd8` e `7a5f263`. **O que ficou:** quinze combinações de caso e tema que já existiam (sete no claro, oito no escuro) ficam abaixo do piso e estão listados no guarda (`belowFloor`, que confere os dois lados: o listado continua abaixo e um caso novo abaixo falha). No claro: `outline` no hover e aberto dentro de cartão e sobre o rodapé do `DialogFooter` (1,09:1), `ghost` e `Badge` `ghost` sobre a página (1,09:1), linha de tabela e rótulo com campo sobre a página (1,05:1). No escuro: o `outline` aberto dentro de cartão (1,03:1, achado novo: o `aria-expanded:bg-accent` fica quase igual ao `dark:bg-input/30` do repouso), `ghost` e `Badge` `ghost` dentro de cartão, linha de tabela e rótulo com campo dentro de cartão, e o rodapé do `CardFooter` e do `DialogFooter` contra o corpo (1,08:1), além do `ghost` puro sobre o rodapé (1,04:1; o único consumidor, o "Agora não", tem hover local). Trocar esses fundos nos primitivos é decisão de desenho do dono (o piso pede, por exemplo, `accent` opaco no lugar dos `/50` no escuro e outro fundo para o hover sobre a página no claro), e esses casos não têm prova por estilo calculado: o guarda mede tokens e classes.

#### P110 — visual:pairs semeia uma vez por estado e guarda o número velho do par que falha 🟡
**Estado:** Aberto, não triado
**Arquivos:** `scripts/visual/pairs.mjs` (o laço dos estados, `seeded`, e o `results[tag]` no `catch`)
**Impacto:** o `pairs.mjs` semeia o estado uma vez e mede todas as larguras em seguida, e pula a semente quando dois estados seguidos têm a mesma; a spec do PR B (§5.3) diz que ele semeia cada estado. No Início só há leitura, e os 19 pares do C1 foram reprodutíveis. Com passos que gravam (o salvamento automático da branch D, mover cartão na E), a segunda largura captura o banco já mudado, e o par deixa de ser reprodutível. Um par que falha deixa no `results.json` o número da rodada anterior, que parece atual. O código veio do plano (Task 7).
**Correção:** — (opção: semear por largura quando o estado tem passo que não é só leitura, ou sempre; gravar `{ error, at }` no par que falha. Antes dos pares da branch D)
**Registrado em:** 2026-11-28

#### P111 — Ferramentas visuais com diagnóstico enganoso e recusas que faltam ⚪
**Estado:** Aberto, não triado
**Arquivos:** `scripts/visual/config.mjs` (`assertVisualDbUrl`) · `scripts/visual/interact.mjs` · `scripts/visual/install-hooks.mjs` · `scripts/visual/paths.mjs` · `scripts/visual/capture.mjs` · `scripts/visual/pairs.mjs` · `scripts/visual/probe.mjs` · `scripts/visual/env.sh` · `scripts/visual/db.ts` · `scripts/visual/seed/` · `test/visual/envScript.test.ts`
**Impacto:** nenhum dado se perde e o C1 rodou tudo sem corrigir ferramenta; são lacunas que custam tempo a quem diagnostica, ou recusas que os chamadores de hoje não precisam. A revisão final listou: o `assertVisualDbUrl` aceita query string, e o `pg` deixa o `?host=` trocar o host (`postgres://…@127.0.0.1:54332/postgres?host=ep-exemplo.neon.tech` passa, e o `pg-connection-string` lê o host `ep-exemplo.neon.tech`; os quatro chamadores de hoje usam a constante `VISUAL_DB_URL`); a prova de falha de rede do `interact.mjs` conta qualquer `requestfailed` (um `ERR_ABORTED` de prefetch passaria o `expect.failedRequests`), e não só os que o `failRequests` abortou; o `install-hooks.mjs` sai com 1 no uso errado, e o contrato diz 2; o `readJsonInsideSdd` chama todo erro de "arquivo ausente", e o `git()` diz "não é repositório" quando o git não está instalado; o `capture.mjs` aceita um caminho com `//host` e não pega o erro do `evaluate`; o `pairs.mjs` não recusa uma caixa de região com tamanho zero, máscaras sem formato nem `--sizes` fora da faixa; o `probe.mjs` recusa o `--out` só depois de semear, aceita `--width` com lista e fora da faixa e `--only` vazio, e a lógica pura dele não tem teste pelo CLI; o `env.sh` não confere o `node -e` que gera o segredo nem usa `umask 077`; o `db.ts` derruba pelo PID (frágil no Windows) e aceita qualquer Postgres na 54332; o `envScript.test.ts` roda um comando na coleta; o caminho feliz do `inicio:entregue`, a atomicidade do `seedState` e o `reopen-invites` não têm teste.
**Correção:** — (opção: o `?host=` primeiro (recusar `search` não vazio, com um caso de teste) e a contagem do `interact.mjs` pelas requisições abortadas; o resto num commit por ferramenta, com o teste puro de cada recusa)
**Registrado em:** 2026-11-28

#### P112 — check-names --range confere só o diff líquido da branch, não cada commit 🟡
**Estado:** Aberto, não triado
**Arquivos:** `scripts/visual/check-names.mjs` (`collect()`, modo `range`)
**Impacto:** o portão (`--range=main...HEAD`) lê o `git diff main...HEAD` e as mensagens do `git log main..HEAD`. Um termo que entra num commit intermediário e sai depois não aparece no diff líquido, passa no portão e fica no histórico da branch publicada (a aba de commits do PR guarda os commits mesmo com squash). Acontece com um commit feito com `--no-verify` ou antes de o termo entrar na lista, que cresce a cada branch. No PR B não houve vazamento: a revisão final rodou o `--range=<c>^...<c>` em cada um dos 24 commits, todos com código 0.
**Correção:** — (opção: o `--range` conferir commit a commit, com o `git rev-list` e o diff de cada commit contra o pai, ou um `--per-commit` usado pelo portão da skill)
**Registrado em:** 2026-11-28

#### P113 — Um termo da lista de nomes já está na main, em cinco arquivos do PR A ⚪
**Estado:** Aberto, não triado
**Arquivos:** `.context/pendencias.md` (o título da P100, no índice e na seção) · `memory.md` · `src/components/passagens/SectorPicker.test.tsx` · `docs/superpowers/specs/2026-11-27-visual-inicio-design.md` · `docs/superpowers/plans/2026-11-27-visual-inicio.md`
**Impacto:** a abertura do PR B (C0) achou o termo da linha 23 da lista (fora do git; vem dos protótipos) nesses cinco arquivos, todos do PR A e já na `main`, fora do diff desta branch. O hook e o `--range` só olham o que muda, então ele fica onde está, e quem editar uma dessas linhas é recusado pelo hook (por exemplo, o título da P100).
**Correção:** — (decisão do dono: trocar o texto nos cinco arquivos por um inventado do `scripts/visual/vocabulary.mjs`, sabendo que a história do git continua com ele; ou, se for palavra genérica do domínio, uma linha `!` na lista, pela regra da spec do PR B §5.4)
**Registrado em:** 2026-11-28

#### P114 — As cópias do protótipo baixam as fontes da rede a cada captura ⚪
**Estado:** Aberto, não triado
**Arquivos:** `scripts/visual/capture.mjs` (`openProto`) · as cópias do protótipo em `.git/sdd/` (fora do git)
**Impacto:** a cópia do protótipo carrega a Geist do Google Fonts e a Satoshi do Fontshare a cada captura. Na primeira rodada completa do C1, o par sem-turnos-390 deu 0,129% (fora da faixa): o lado do app saiu idêntico (0 px de diferença entre as rodadas) e o do protótipo diferiu em 140 px, só nas três linhas de solicitação; seis repetições deram 0,101%. A causa provável, não provada, é a fonte vinda da rede. Cada oscilação custa uma investigação, e sem rede as capturas do protótipo não saem. É a mesma dependência do build na P102, do lado do protótipo.
**Correção:** — (opção: servir as fontes do protótipo localmente, com uma rota no `openProto` que entrega as do `src/fonts/` e do `node_modules`, para tirar a rede das capturas)
**Registrado em:** 2026-11-28

#### P115 — Os guardas dos documentos não recusam uma cerca de código solta ⚪
**Estado:** Aberto, não triado
**Arquivos:** `test/uiRegistryDoc.test.ts` · `test/pendenciasDoc.test.ts`
**Impacto:** os dois guardas alternam o estado "dentro de código" a cada linha que começa com três crases. Com uma cerca solta (número ímpar), o resto do documento vira código e os cabeçalhos dali em diante somem da leitura. Foi o defeito do `4d5f3bf` no `ui-registry.md`, achado pelo `registry-diff` e pela revisão, depois do commit.
**Correção:** — (opção: um caso em cada guarda que conta as linhas de cerca e exige número par)
**Registrado em:** 2026-11-28

#### P116 — A memória de 2 s do SectorColorFade se arma em qualquer desmontagem ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/components/passagens/SectorColorFade.tsx` (a cor guardada na limpeza do efeito)
**Impacto:** plausível, não medido. A cor do último cartão fica guardada por 2 s em toda limpeza do efeito: desmontar ou esconder na `Activity`, não só trocar de setor. No Início com um setor, a pessoa abre Passagens e, em menos de 2 s, volta ao Início por um link que abre outro setor: o cartão novo monta e faz o fade de uma cor para a outra depois de uma navegação, contra a regra "nada anima na carga" do `ui-rules.md §9`. A volta para a mesma instância escondida na `Activity` está certa (nada anima).
**Correção:** — (opção: armar a memória só pela troca no `SectorPicker`, com um sinal explícito, ou guardar o caminho junto da cor; ou aceitar e escrever o caso no comentário e no registro)
**Registrado em:** 2026-11-28

#### P117 — Testes e sondas do PR B que provam menos do que dizem ⚪
**Estado:** Aberto, não triado
**Arquivos:** `scripts/visual/screens/provas.mjs` (`hover-statlink`) · `src/components/auth/PasskeyManager.test.tsx` · `src/components/ui/sheet.test.tsx` · `src/components/ui/tooltip.test.tsx` · `src/components/ui/button.test.tsx` · `test/visual/settle.test.ts` · `test/visual/contrast.test.ts` · `src/app/motionUsage.test.ts` · `e2e/solicitacoes.spec.ts` (cenário i) · `test/visual/installHooks.test.ts` · `test/visual/steps.test.ts` · `test/visual/paths.test.ts`
**Impacto:** sem defeito conhecido no app. A revisão final listou: a sonda `hover-statlink` compara o fundo do hover com o do pai opaco (a página), e não com o repouso do próprio `StatLink` (`bg-card`), então daria "diferente" também com o `hover:bg-muted` antigo (só as sondas do `outline` e do `ghost`, no claro, distinguem o antes do depois); o `PasskeyManager.test.tsx` trocou `toBeVisible()` por `toBeInTheDocument()` na M2, sem dizer no commit; os testes do Motion do `Sheet`, do `Tooltip` e do `Button` olham o primeiro quadro e o fim, sem o valor no meio que o `ui-rules.md §9` pede (uma duração 0 passaria); o `settle.test.ts` usa o relógio real e roda no CI (uma pausa de 60 ms no laço de eventos daria "quiet" em vez de "timeout"); dois testes do `contrast.test.ts` conferem string (`toContain("skipped")` passa sem a contagem), e o matiz do `oklch` não tem vetor; o `motionUsage.test.ts` só reconhece `motion/react` e `motion/react-m` (`import { animate } from "motion"`, `motion/react-mini`, `framer-motion/…` e `import * as X from "motion/react"` escapam); o E2E do 404 só confere URL desconhecida no primeiro nível (`/admin/nao-existe` e `/passagens/a/b` deram 404 numa medida do build, sem teste); o `installHooks.test.ts` prova o "regrava" só com conteúdo idêntico, o `sample` do `steps.test.ts` usa uma caixa constante, e o `paths.test.ts` prova o `repoRoot` só como "diferente" e "dentro".
**Correção:** — (um commit só de testes, com o vermelho conferido em cada caso: a sonda lê o fundo do mesmo elemento antes e depois do `hover`; a `MotionTree` com `waitFor(… toBeVisible())`; o `recordStyle` com um valor no meio; o relógio falso; o `auditScript()` com `lab(50 0 0)` esperando 1 pulado e o vetor `oklch(0.627955 0.257683 29.2339)` perto de `[255, 0, 0]`; o guarda do Motion recusando os outros pontos de entrada; `/admin/nao-existe` e `/passagens/a/b` no cenário i)
**Registrado em:** 2026-11-28

#### P118 — A skill handoff-visual, os modelos e o library-docs §23 divergem das regras em pontos de texto ⚪
**Estado:** Aberto, não triado
**Arquivos:** `.claude/skills/handoff-visual/SKILL.md` · `.claude/skills/handoff-visual/templates/review-brief.md` · `templates/global-constraints.md` · `templates/task-brief.md` · `templates/plan-contract.md` · `.context/library-docs.md` (§22 e §23) · `test/visual/screens.test.ts`
**Impacto:** quem planejar a branch C pelos modelos copia o erro. O `review-brief.md` sugere que os guardas moram em `src/app/` ("`bunx vitest run src/app/rawColors.test.ts` etc.", mas o `uiRegistryDoc` e o `pendenciasDoc` moram em `test/`) e não lista o `motionUsage.test.ts` nem as conferências do Motion (ramo reduzido testado, nada na carga, só tokens). O `global-constraints.md` diz que o movimento reduzido "desliga as animações", contra o `ui-rules.md §9` (no máximo um fade curto). O `task-brief.md` e o `plan-contract.md` fixam o trailer de um modelo, e a Global Constraint diz "o modelo que implementou". O `plan-contract.md` tem um E2E só, no fim das tarefas, e a legibilidade antes do pixel, contra a ordem da skill (E2E depois da fundação, na metade e antes dos passes; pixel na Etapa 5, legibilidade na 6). A skill põe o rascunho da configuração de tela em `.git/sdd/visual-<slug>/screen.mjs` e a versão em `scripts/visual/screens/<slug>.mjs` sem o passo que promove um no outro nem o registro do `seed/states/<tela>.ts` no `index.ts`; o `screens.test.ts` importa as três configurações pelo nome, e o `library-docs.md §22` diz que ele valida todas. No `library-docs.md §23`, o `useReducedMotion` do Motion não lê "uma vez por módulo" (também assina o `change`; a conclusão sobre o stub continua certa), e falta dizer o que o `whileTap` muda no teclado (a revisão da M2 apontou; conferir na fonte antes de escrever).
**Correção:** — (opção: um commit de texto antes da branch C, com o `skillHandoffVisual.test.ts` verde, e o `screens.test.ts` lendo a pasta `scripts/visual/screens/`)
**Registrado em:** 2026-11-28

## 2. Triado, plano pronto

*(nenhuma)*

## 3. Bloqueado no dono

#### P2 — Uso da marca LATAM sem autorização confirmada 🟡
**Estado:** Bloqueado no dono
**Arquivos:** —
**Impacto:** a planilha usa logo e cores da LATAM Cargo. Reproduzir a marca num sistema não
oficial pode criar problema para quem usa.
**Correção:** perguntar se há autorização; sem ela, identidade própria e neutra (o sistema
continua servindo a operação).
**Registrado em:** 2026-11-20

#### P5 — Glossário do domínio ULD é interpretação, não confirmação 🟡
**Estado:** Bloqueado no dono
**Arquivos:** `.context/about.md` › Glossário operacional
**Impacto:** redes, fitas, stretch, sacos de ráfia — se a interpretação estiver errada, rótulos e
agrupamentos do sistema confundem quem opera.
**Correção:** validar o glossário com o usuário final.
**Registrado em:** 2026-11-20

#### P6 — Login com Apple exige conta paga de desenvolvedor e domínio HTTPS 🟡
**Estado:** Bloqueado no dono
**Arquivos:** `src/lib/auth/createAuth.ts` · `src/lib/auth/env.ts`
**Impacto:** "Entrar com Apple" depende do Apple Developer Program (anuidade paga), de um Services
ID com domínio verificado e de URL de retorno HTTPS — não funciona em `localhost`. Sem isso, o
botão não pode ir ao ar.
**Correção:** decidir se a conta Apple Developer existe ou será criada; se não, lançar sem Apple
e adicionar depois (o resto não depende dela).
**Registrado em:** 2026-11-20
**Atualização (2026-11-20):** o Better Auth já está instalado (Fase 1) e o fluxo de convite não depende de Apple. Apple ficou fora da Fase 1 e entra na Fase 6, junto do domínio HTTPS e da conta de desenvolvedor; continua bloqueada.
**Atualização (2026-11-26):** D-F6-1: o piloto roda só em `*.vercel.app`, sem domínio próprio; "Entrar com Apple" segue bloqueado (precisa do Apple Developer Program e de um domínio verificado, e a troca de domínio invalida as passkeys, P66).

#### P7 — Login com Facebook exige app da Meta publicado 🟡
**Estado:** Bloqueado no dono
**Arquivos:** `src/lib/auth/createAuth.ts` · `src/lib/auth/env.ts`
**Impacto:** o app da Meta só aceita usuários fora da lista de testadores em modo Live, que exige
URL de política de privacidade e instrução de exclusão de dados. Contas do Facebook podem não ter
e-mail — o cadastro precisa tratar e-mail ausente.
**Correção:** criar o app na Meta, publicar as duas páginas (privacidade, exclusão de dados) e
tratar `email` nulo no cadastro.
**Registrado em:** 2026-11-20
**Atualização (2026-11-20):** o botão "Continuar com Facebook" já existe e só aparece com `FACEBOOK_CLIENT_ID` e `FACEBOOK_CLIENT_SECRET`; e-mail ausente volta como `email_not_found` ("Essa conta não informou um e-mail. Use outro jeito de entrar."). Falta o app da Meta publicado (privacidade e exclusão de dados); continua bloqueada.
**Atualização (2026-11-26):** a Fase 6 criou a página pública `/privacidade` (a URL de política de privacidade que a Meta pede), ainda em rascunho até o dono e a empresa aprovarem (`PRIVACY_DRAFT`). Continua bloqueada: faltam a página de instrução de exclusão de dados, o app da Meta publicado e, para ele, um domínio próprio (o piloto roda em `*.vercel.app`, D-F6-1).

#### P8 — Sem provedor de e-mail, "esqueci a senha" não funciona 🟠
**Estado:** Bloqueado no dono
**Arquivos:** `src/lib/auth/createAuth.ts` · `src/lib/auth/env.ts`
**Impacto:** quem cadastrou com e-mail + senha e esqueceu a senha fica trancado para fora (a
passkey ajuda, mas não cobre aparelho novo). Verificação de e-mail também depende disso.
**Correção:** escolher um provedor transacional (sugestão: Resend, plano gratuito cobre o volume)
e um domínio remetente.
**Registrado em:** 2026-11-20
**Atualização (2026-11-20):** o Better Auth está sem `sendResetPassword` e a tela `/entrar` não oferece "esqueci a senha" (a passkey cobre quem a criou). Continua bloqueada até haver provedor de e-mail.
**Atualização (2026-11-20):** o hook de cadastro marca `emailVerified: true` sem verificação real do e-mail (o convite não é atrelado a e-mail); rever junto com "esqueci a senha".
**Atualização (2026-11-20):** corrigido o item acima: o hook deixou de forçar `emailVerified` (`inviteSignupData` em `src/lib/auth/createAuth.ts`); cadastro por e-mail e senha fica `false` e o login social mantém o valor do provedor. Quando houver provedor de e-mail, a verificação de verdade (e o "esqueci a senha") entra por aqui; P8 continua bloqueada.
**Atualização (2026-11-26):** Fase 6 (D-F6-2): sem provedor de e-mail, a recuperação passou a ser o **link de nova senha gerado pelo administrador** em `/admin/equipe` ("Nova senha", `createPasswordResetLink`, válido por 24 h, uso único, compartilhado como o convite) e a página pública `/redefinir-senha`; o `/entrar` diz "Esqueceu a senha? Peça ao administrador um link para criar outra.". O pedido por e-mail (`/request-password-reset`) continua respondendo `RESET_PASSWORD_DISABLED`. P8 continua **bloqueada no dono**: e-mail transacional exige domínio próprio (D-F6-1, só `*.vercel.app` no piloto), e a verificação de e-mail e o "esqueci a senha" por e-mail seguem para depois.

#### P10 — Credenciais OAuth do Google não criadas 🟡
**Estado:** Bloqueado no dono
**Arquivos:** `.env.example` · `src/lib/auth/env.ts` · `src/components/auth/SocialButtons.tsx`
**Impacto:** sem `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` o botão "Continuar com Google" não aparece
(o botão é condicional ao env) e o login social não tem teste ao vivo: que o cookie `closery_invite`
chega ao hook no callback do Google é dedução do código do Better Auth, não observação.
**Correção:** criar o projeto no Google Cloud, configurar a tela de consentimento e um ID de cliente
OAuth do tipo Web com os URIs de redirecionamento `http://localhost:3000/api/auth/callback/google` e
`https://<domínio>/api/auth/callback/google`; preencher as duas variáveis no `.env.local` e na Vercel;
rodar o checklist manual de login social (spec §12), incluindo convite novo, usuário existente e
usuário sem conta (deve voltar com "Conta não encontrada. Peça um convite.").
**Registrado em:** 2026-11-20
**Atualização (2026-11-26):** C6-1: o Google fica desligado no piloto (sem `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` na Vercel o botão não aparece); entrar é por e-mail e senha ou passkey. A pendência continua bloqueada no dono.

## 4. Teto aceito

*(nenhuma)*

## 5. Resolvido

#### P1 — Banco Neon não provisionado 🟠
**Estado:** Resolvido
**Arquivos:** `.env.example` · `src/db/index.ts` · `drizzle.config.ts`
**Impacto:** sem `DATABASE_URL` nenhuma migração roda e qualquer import de `@/db` lança erro.
**Correção:** criar o projeto no Neon (região `sa-east-1`, São Paulo, se disponível), copiar as
connection strings (com e sem pooler) para `.env.local`.
**Registrado em:** 2026-11-20
**Atualização (2026-11-20):** o dono preencheu o `.env.local` (`DATABASE_URL` direta +
`DATABASE_URL_POOLED`); `sslmode` trocado para `verify-full`; driver `pg` + `attachDatabasePool`
(D18); `/api/health` responde 200 com o banco. **Na Vercel**, cadastrar as mesmas duas variáveis,
também com `verify-full`.
**Atualização (2026-11-20):** o local passou para a branch de **desenvolvimento** do Neon; as URLs de
produção ficaram comentadas no `.env.local` — mover para a Vercel e apagar de lá.
**Atualização (2026-11-26):** a produção usa um projeto Neon **novo** (C6-4, região `sa-east-1`, plano Free), não a branch de desenvolvimento deste `.env.local`. Na Vercel entra só `DATABASE_URL_POOLED`; a URL direta fica só no shell da migração (runbook, passo B4). As URLs de produção comentadas do `.env.local` saem por mão do dono (passo B2). O que falta é a Parte B (go-live), fora do código.

#### P3 — Tamanhos do Button abaixo do alvo mínimo de toque 🟡
**Estado:** Resolvido
**Arquivos:** `src/components/ui/button.tsx` · `src/components/ui/input.tsx` ·
`src/components/ui/sidebar.tsx` · `src/components/ui/button.test.ts`
**Impacto:** `default` (h-8), `xs`, `sm` e `icon` ficavam abaixo de h-9 / 44px no celular
(`ui-rules.md §1.4`) — toque errado na correria do fim de turno.
**Correção:** cada tamanho do `Button` sobe para h-9 / size-9 no desktop e ganha `max-md:h-11` /
`max-md:size-11` (44px abaixo de `md`); `lg` e `icon-lg` já são 44px. O mesmo vale para o `Input`
(`h-9 max-md:h-11`) e para o `SidebarMenuButton` default.
**Registrado em:** 2026-11-20
**Atualização (2026-11-20):** resolvida na Fase 1. Testes guardam as classes (`button.test.ts`,
`input.test.tsx`, `sidebar.test.tsx`): se um `shadcn add` sobrescrever o arquivo e perder o ajuste,
o teste falha. O modificador `max-md:` sobrevive a overrides de altura em `className` (o `cn`
não o remove). Tamanhos `xs`/`sm`/`icon-xs`/`icon-sm` foram mantidos (usados por `input-group`,
`sheet` e `sidebar`) e também chegam a 44px no celular.
**Atualização (2026-11-20):** a afirmação acima vale só para o `Button`: outros tamanhos gerados pelo shadcn continuam abaixo de 44px (`SidebarMenuButton` `sm` e modo ícone, `InputGroup`, `InputGroupButton` `icon-sm`, `SidebarInput`); ver P12.

#### P4 — Paleta de gráficos em cinza e sem tokens de status 🟡
**Estado:** Resolvido
**Arquivos:** `src/app/globals.css` (`--chart-1..5`)
**Impacto:** o dashboard é central e os tokens `chart-*` do preset são tons de cinza — séries
indistinguíveis. Não existem `success`/`warning` para status de item e de solicitação.
**Correção:** copiar do klauve `chart-1..4`, `success`, `warning`, `info` (+ `-foreground`), claro e
escuro, para o `globals.css` e o `@theme inline` (D16; valores em `ui-tokens.md §2`).
**Registrado em:** 2026-11-20
**Atualização (2026-11-20):** triada no brainstorm — D14 manteve o shadcn padrão e D16 trouxe do
klauve os tokens que faltavam.
**Atualização (2026-11-20):** `chart-1..4`, `success`, `warning`, `info` (+ `-foreground`) entraram no
`src/app/globals.css` (claro e escuro) e no `@theme inline`, com os valores do klauve copiados como
estão (D16). `chart-5` ficou como o shadcn gerou. `ui-tokens.md §2` agora descreve tokens que existem.

#### P9 — Paleta de gráficos do klauve não foi validada contra as superfícies do shadcn ⚪
**Estado:** Resolvido
**Arquivos:** `src/app/globals.css` · `src/app/chartPalette.test.ts`
**Impacto:** no klauve, `chart-1..4` passou por teste de contraste ≥3:1 sobre o card e de
distinção para daltonismo, medido contra os cards **do klauve** (`#fefefe` / `#1e1e21`). Os cards
do shadcn neutral são próximos (branco / `oklch(0.205 0 0)`), mas não iguais — a garantia não se
transfere automaticamente.
**Correção:** — (opção: portar o `chartPaletteGuard.test.ts` do klauve e rodar contra o
`globals.css` daqui)
**Registrado em:** 2026-11-20
**Atualização (2026-11-20):** o guarda do klauve foi portado para `src/app/chartPalette.test.ts` (lê
hex e `oklch`) e roda contra o `globals.css` daqui: a série `chart-1..4` passa todos os pisos nos dois
temas contra os cards do shadcn, sem ajuste de cor (contraste ≥ 3,71:1; ΔE2000 mínimo 17,5 em
deuteranopia). Números completos em `ui-tokens.md §2`. Ressalva registrada lá: `chart-5` ("Outros") não é
medido e some no tema escuro (1,19:1 sobre o card).

#### P11 — Sessões abertas de usuário desativado continuam aceitas por /api/auth/* 🟠
**Estado:** Resolvido
**Arquivos:** `src/lib/auth/createAuth.ts` · `src/lib/auth/session.ts`
**Impacto:** uma pessoa desativada com sessão já aberta ainda consegue chamar `/api/auth/*` (adicionar passkey, mudar nome, listar sessões); as páginas recusam, a API de auth não.
**Correção:** — (opção: a ação "desativar" da Fase 2 deve apagar as sessões do usuário na mesma transação em que preenche `deactivatedAt`)
**Registrado em:** 2026-11-20
**Atualização (2026-11-21):** resolvida na Fase 2. `setPersonActive({ active: false })` (`src/features/admin/people.ts`) preenche `deactivated_at` e apaga todas as linhas de `session` da pessoa na mesma transação; as sessões saem até quando a pessoa já estava desativada. Teste de domínio (só as sessões dela somem) e E2E (`countSessionsByEmail` = 0 e a próxima navegação vai para `/entrar`).

#### P18 — user.role e invite.role sem CHECK no banco 🟡
**Estado:** Resolvido
**Arquivos:** `src/db/schema/auth.ts` · `src/db/schema/invites.ts`
**Impacto:** `toAuthz` falha fechado, mas as escritas de admin da Fase 2 ganham com a garantia no banco.
**Correção:** — (opção: uma migração com `CHECK (role IN ('admin','operator'))` nas duas colunas)
**Registrado em:** 2026-11-20
**Atualização (2026-11-21):** resolvida na Fase 2. A migração `0002_fase2_cadastros` acrescenta `CHECK` de papel em `user` (`user_role_valid`) e em `invite` (`invite_role_valid`); o teste de schema prova que o banco recusa um papel fora de `admin`/`operator` (SQLSTATE 23514).

#### P26 — Visão geral conta turnos e itens de setores inativos; listas da Fase 3 precisam filtrar setor ativo 🟡
**Estado:** Resolvido
**Arquivos:** `src/features/admin/overview.ts:39-40` · `src/app/(app)/admin/turnos` · `src/app/(app)/admin/itens`
**Impacto:** as contagens do `/admin` incluem turnos e itens ativos de setores inativos, que `/admin/turnos` e `/admin/itens` não conseguem mostrar (o seletor lista só setores ativos). As listas de escolha da Fase 3 (passagem) também precisam filtrar `sector.active`.
**Correção:** — (opção: juntar `sector` e filtrar `sector.active` nas contagens; registrar o filtro no plano da Fase 3)
**Registrado em:** 2026-11-21
**Atualização (2026-11-21):** resolvida na Fase 3. `getAdminOverviewCounts` (`src/features/admin/overview.ts`) passou a contar turnos e itens só de setores ativos, e as listas e escolhas da passagem (turnos, itens, histórico, Início e formulário novo) juntam `sector.active`: turno inativo não entra em escolha nem em "sem passagem", item inativo não entra no formulário e o histórico só lista setores ativos. Escrever numa passagem existente de setor inativo (salvar, entregar, confirmar, corrigir) é recusado com `SECTOR_INACTIVE`; o resumo dela continua legível. Testes: `overview.test.ts` (turno e item de setor inativo ficam de fora) e os testes de domínio e de componente da passagem.

#### P27 — Guardas de teste aceitam menos do que deveriam 🟡
**Estado:** Resolvido
**Arquivos:** `src/app/appPagesAuth.test.ts:13` · teste de inventário das actions (`actionsAuth`)
**Impacto:** a guarda de páginas aceita `requireUser` em páginas de `admin/` (basta `require(User|Admin)`), então uma página admin que só chamasse `requireUser` passaria; a guarda das actions só varre arquivos chamados `actions.ts`, e um `"use server"` em outro nome ou inline escaparia.
**Correção:** — (opção: exigir `requireAdmin` para arquivos sob `admin/`; ampliar a varredura a qualquer `.ts/.tsx` com `"use server"` de arquivo ou inline, na primeira tarefa da Fase 3)
**Registrado em:** 2026-11-21
**Atualização (2026-11-21):** resolvida na Fase 3 (Tarefa 3). `appPagesAuth.test.ts` passou a exigir `requireAdmin` nas páginas sob `admin/`; o novo `src/app/actionsGuards.test.ts` varre todo `.ts`/`.tsx` de `src` com `"use server"` (de arquivo ou inline), exige que o arquivo se chame `actions.ts` sob `src/app/(app)/**` (exceção documentada: `(auth)/convite/[token]/actions.ts`), `requireAdmin()` em `admin/**` e `requireUser()` ou `requireAdmin()` na primeira instrução do resto. A varredura vive em `test/actionGuards.ts` (extraída de `actionsAuth.test.ts` em commit próprio, só refatoração).

#### P33 — Dois runners de Server Action quase iguais (admin e passagem) ⚪
**Estado:** Resolvido
**Arquivos:** `src/features/admin/runAdminAction.ts` · `src/features/handovers/runHandoverAction.ts`
**Impacto:** cerca de 25 linhas do fluxo (Zod → domínio → `unstable_rethrow` → `INTERNAL`) estão duplicadas; mudar o tratamento de erro num runner exige lembrar do outro e os dois podem divergir em silêncio.
**Correção:** — (opção: uma refatoração separada, com testes verdes antes e depois: um runner só, com o `revalidatePath` como parâmetro; nunca no mesmo commit de uma feature)
**Registrado em:** 2026-11-21
**Atualização (2026-11-24):** resolvida na Fase 4 (Tarefa 1), em commit só de refatoração. `runAction` (`src/features/admin/runAction.ts`) é o runner único (Zod → domínio → `unstable_rethrow` → `INTERNAL` → `revalidatePath` só em `ok`), com `revalidate: "/(app)" | "/(app)/admin" | null` como parâmetro. `runAdminAction` e `runHandoverAction` ficaram como embrulhos finos com a mesma assinatura de antes, e os testes dos dois passaram sem nenhuma edição. As Server Actions da Fase 4 chamam `runAction` direto.

#### P40 — Higiene de refatoração da Fase 3 ⚪
**Estado:** Resolvido
**Arquivos:** `src/db/schema/migration0003.test.ts` e demais testes de migração · `src/features/handovers/*` (`firstValue`, `loaders.ts`, `creationRefusal`) · testes das guardas (`stripComments`, `findPages`) · `HandoverHeader.tsx` (rótulo "Setor")
**Impacto:** helpers de migração duplicados entre testes; `firstValue` copiado 3 vezes; `stripComments`/`findPages` duplicados; a recusa de criação escrita 2 vezes; `loaders.ts` faz três trabalhos; a regra "awaiting" escrita 3 vezes (hoje equivalentes, sem teste de concordância); o rótulo "Setor" do cabeçalho não tem controle associado (ver P29).
**Correção:** — (opção: um commit só de refatoração antes da Fase 4, testes verdes antes e depois, com um teste de concordância das três regras "awaiting"; o rótulo entra com P29)
**Registrado em:** 2026-11-21
**Atualização (2026-11-24):** resolvida na Fase 4 (Tarefa 2), em commit só de refatoração: `firstValue` vive uma vez em `src/lib/searchParams.ts`; o harness de migração em `test/migrations.ts` (usado por `migration0002` e `migration0003`; a `0004` o reutiliza); `appPagesAuth.test.ts` usa `stripComments` e `listSourceFiles` de `test/actionGuards.ts`; `runInTransaction` foi para `src/features/admin/transaction.ts`; `ensureHandover` e `creationRefusal` (a recusa de criação que `formState.ts` repetia) para `src/features/handovers/ensureHandover.ts`, e `loaders.ts` ficou só com leituras. O novo `awaiting.test.ts` faz as três regras "awaiting" (resumo, histórico, Início) concordarem. Os casos de `loaders.test.ts` só mudaram de arquivo, sem mudar asserção. O rótulo "Setor" do cabeçalho entra com P29 (Tarefa 3).

#### P29 — Acessibilidade da Equipe e da paginação 🟡
**Estado:** Resolvido
**Arquivos:** `src/app/(app)/admin/equipe/page.tsx` · `src/components/admin/team/TeamAdmin.tsx` · `src/components/admin/team/InviteForm.tsx` · `src/components/admin/Pagination.tsx`
**Impacto:** `/admin/equipe` pode ter dois `<nav aria-label="Paginação">`; "Convidar pessoa" não é `h2` e há um `h3` órfão; ao trocar entre o formulário e o cartão do link o foco se perde (e o link aparece uma vez só); Anterior/Próxima desativados são `<span aria-disabled>`.
**Correção:** — (opção: prop opcional `aria-label` em Pagination; revisar níveis de título; mover o foco ao cartão do link e de volta ao formulário; fazer o desativado ser botão `disabled` ou manter o texto lido)
**Registrado em:** 2026-11-21
**Atualização (2026-11-24):** resolvida na Fase 4 (Tarefa 3). `Pagination` ganhou a prop `label` (padrão "Paginação") e o lado sem destino virou `<Button disabled>`; a Equipe nomeia as duas paginações ("Paginação dos convites pendentes" e "Paginação das pessoas"). "Convidar pessoa" é `h2`; ao gerar o convite o foco vai ao título "Convite gerado" e "Gerar outro convite" devolve o foco ao campo "Nome de referência (opcional)". O "Setor" do cabeçalho da passagem (a parte de P40) deixou de ser `<label>` sem controle (`FieldTitle`). "O link aparece uma vez só" é intencional (o token bruto só existe na criação) e não mudou.

#### P37 — Setor inativo: o resumo oferece Confirmar e Corrigir que sempre falham 🟡
**Estado:** Resolvido
**Arquivos:** `src/features/handovers/summary.ts` (`capabilities`) · `src/components/passagens/HandoverDetail.tsx`
**Impacto:** `capabilities` ignora `sector.active`: num setor inativo o resumo mostra "Confirmar recebimento", "Corrigir" e "Corrigir com motivo", e todos devolvem `SECTOR_INACTIVE`; `?editar=1` volta ao resumo em silêncio. Sem risco de dados, só atrito.
**Correção:** — (opção: `sectorActive` em `HandoverSummary` e esconder as ações, com um aviso "Setor inativo: só leitura")
**Registrado em:** 2026-11-21
**Atualização (2026-11-24):** resolvida na Fase 4 (Tarefa 3). `HandoverSummary` ganhou `sectorActive`; em setor inativo o resumo mostra o aviso `ReadOnlySectorNotice` ("Setor inativo: só leitura.") e esconde "Confirmar recebimento", "Corrigir", "Corrigir com motivo" e "Você entregou este turno…", para operador e admin, na entregue e na confirmada; `?editar=1` cai no resumo com o aviso. O comportamento de setor ativo não mudou.

#### P48 — Refatorações da Fase 4 para o início da Fase 5 🟡
**Estado:** Resolvido
**Arquivos:** `src/components/solicitacoes/RequestsScreen.tsx` · `src/features/requests/loaders.ts` · `src/features/requests/lists.ts` · `src/features/requests/home.ts` · `src/features/requests/open.ts` · `src/components/solicitacoes/RequestList.tsx` · `src/components/solicitacoes/RequestColumn.tsx` · `src/components/solicitacoes/RequestDetail.tsx` · `src/features/requests/messages.ts` · `src/features/handovers/loaders.ts` (`loadSector`) · `src/components/passagens/HandoverDetail.tsx` (`dateAndTime`) · `src/components/passagens/HandoverHistory.tsx`, `HomeHandovers.tsx` e `NewHandover.tsx` (as outras cópias da resolução de setor) · `test/`
**Impacto:** nenhum defeito de comportamento; duplicações que o painel da Fase 5 copiaria e que deixam duas cópias da mesma regra divergirem. Em ordem de prioridade: (1) `resolveScreenSector` e `paginationParams`: a resolução de setor do `RequestsScreen` é a 4ª cópia (as outras estão nas telas de passagens, como `HandoverHistory.tsx`); o painel da Fase 5 seria a 5ª. Maior prioridade: extrair antes de qualquer tela nova; (2) `destinationNameSql` e `toOpenSummaries` compartilhados entre `home.ts` e `open.ts`: o `coalesce` do nome do destino está escrito 4 vezes; (3) A seção compartilhada, com `renderRow`, entre `ListGroup` (`RequestList`) e `RequestColumn`: a contagem do E2E depende das duas cópias; (4) `lockSectorShare` duplica o corpo de `loadSector` (Tarefa 7): o select, o `where` e o `canAccessSector` só diferem pelo `.for("share")`; (5) O fixture `deactivateSector` (SQL cru com interpolação) repetido em 5 arquivos de teste (Tarefa 8); (6) O `Promise.all` posicional (desestruturação por índice) em `lists.ts` (Tarefa 9); (7) `dateAndTime` copiado 3 vezes (`RequestDetail.tsx`, `whenLabel` em `messages.ts` e `HandoverDetail.tsx`) (Tarefa 12).
**Correção:** — (um commit só de refatoração, sem feature e sem mudar asserção, como o primeiro da Fase 5, no modelo de P33 e P40)
**Registrado em:** 2026-11-24
**Atualização (2026-11-25):** itens 1, 3 e 7 feitos na Fase 5 (Tarefa 1), em commit só de refatoração: `resolveScreenSector` (`src/features/handovers/screenSector.ts`) e `paginationParams` (`src/lib/searchParams.ts`) nas quatro telas (`HandoverHistory`, `RequestsScreen`, `HomeHandovers`, `NewHandover`); `RequestGroupSection` compartilhada por `RequestColumn` e `RequestList`; `formatDateAtTimeBR` (`saoPaulo.ts`) no lugar das três cópias de `dateAndTime`. Os testes existentes passaram sem nenhuma edição. Faltam os itens 2, 4, 5 e 6 (Tarefa 2); a pendência continua aberta.
**Atualização (2026-11-25):** resolvida na Fase 5 (Tarefa 2), em commit só de refatoração. `destinationNameSql` (`src/features/requests/sql.ts`) e `toOpenSummaries` (`src/features/requests/open.ts`) substituem as 4 cópias do `coalesce` do destino e as 3 do filtro de status aberto (item 2); `lockSectorShare` é `loadSector(…, { lock: "share" })` (item 4); o fixture `deactivateSector` (`test/fixtures.ts`) substitui o SQL cru dos 4 arquivos de teste que o repetiam (item 5); `getRequestGroups` nomeia as quatro leituras do `Promise.all` (item 6). Os itens 1, 3 e 7 estão na Atualização anterior (Tarefa 1). Junto, o que o dashboard reaproveita: `sectorScopeOf`, a fonte do histórico exportada (`historySource`, `historyPairsSql`, `endsLocalSql`, `nowLocalSql`) e `parseHistoryPeriod`/`appendPeriodParams`. Os testes existentes passaram sem mudar nenhuma asserção (só o helper que cada um usa).

#### P13 — chart-5 ("Outros") quase invisível no tema escuro 🟡
**Estado:** Resolvido
**Arquivos:** `src/app/globals.css` (`--chart-5`) · `src/app/chartPalette.test.ts`
**Impacto:** `chart-5` tem 1,19:1 de contraste sobre o card no tema escuro; uma fatia "Outros" some.
**Correção:** — (opção: resolver antes de qualquer gráfico com fatia "Outros" (Fase 5): escolher valor com contraste ≥ 3:1 e medir no guarda)
**Registrado em:** 2026-11-20
**Atualização (2026-11-25):** resolvida na Fase 5 (Tarefa 3). `--chart-5` passou a ter o valor de `--foreground` em cada tema (`oklch(0.145 0 0)` no claro, `oklch(0.985 0 0)` no escuro) e `src/app/chartPalette.test.ts` o mede: contraste 19,79 (claro) e 17,16 (escuro) sobre o card e ΔE2000 mínimo de 20,6 contra `chart-1..4` nas quatro visões. O valor antigo e o `muted-foreground` ficam como casos negativos do guarda (1,19:1 no escuro; ΔE 8,6 e 6,8 em tritanopia contra `chart-4`). `ui-tokens.md §2` descreve o neutro. Nenhum componente usa `chart-5`: o gráfico que precisar de "Outros" usa `foreground` direto.

#### P19 — Erro e 404 dentro do app derrubam o shell inteiro 🟡
**Estado:** Resolvido
**Arquivos:** `src/app/error.tsx` · `src/app/not-found.tsx`
**Impacto:** os boundaries só existem na raiz: um erro ou 404 numa página do grupo `(app)` troca o shell (barra lateral) pela página de erro.
**Correção:** — (opção: considerar `(app)/error.tsx` e `(app)/not-found.tsx` sem `<main>` próprio)
**Registrado em:** 2026-11-20
**Atualização (2026-11-25):** resolvida na Fase 5 (Tarefa 3). `src/app/(app)/error.tsx` e `src/app/(app)/not-found.tsx` (`<div>`, sem `<main>`) mantêm o shell no erro e no 404 de uma página de `(app)`. O erro era o que trocava a barra lateral pela página de erro da raiz (o `error.tsx` da raiz envolve o layout de `(app)`; o de `(app)` envolve só a página). No 404 a barra lateral já ficava (o Next renderiza o `not-found` da raiz dentro do layout mais próximo), mas com um `<main>` dentro do `<main>` do `SidebarInset`; agora há um só, e a URL sem rota continua com o 404 de verdade da raiz. Efeito aceito: o `error.tsx` de `(app)` também envolve o slot `@detalhe`, então um erro dentro do Sheet do detalhe rápido aparece fora do Sheet; vira pendência nova no fim da Fase 5.

#### P45 — Trocar de setor em /solicitacoes perde os filtros da URL 🟡
**Estado:** Resolvido
**Arquivos:** `src/app/(app)/actions.ts` (`chooseSectorAction`) · `src/components/passagens/SectorPicker.tsx` · `src/components/solicitacoes/RequestsScreen.tsx`
**Impacto:** o admin que troca de setor volta para `/solicitacoes?setor={id}`: a visão, o destino, o período, quem criou e a busca somem, porque o `chooseSectorAction` só leva `?setor=`.
**Correção:** — (opção: o `SectorPicker` repassar os parâmetros atuais da URL, validados, ao `chooseSectorAction`)
**Registrado em:** 2026-11-24
**Atualização (2026-11-25):** resolvida na Fase 5 (Tarefa 3). O `SectorPicker` ganhou a prop `query` (o query canônico dos filtros da tela, sem o setor) e o `chooseSectorSchema` a aceita (texto de até 2.000 caracteres). O servidor nunca usa a URL do cliente: `sectorRedirectHref` (`src/features/handovers/sectorRedirect.ts`) reinterpreta o query pelo mesmo parse da tela, que nunca lança, e remonta o href com o setor novo. Em `/passagens` seguem o período e a situação e caem o turno e a página; em `/solicitacoes` seguem a visão, o destino, o período e a busca e caem o criador e a paginação (o item de cada tela, que é do setor antigo, entra nessa lista nas Tarefas 5 e 6); `/` e `/passagens/nova` ignoram o query. Sem `query` o destino é o de sempre.

#### P16 — Cookie closery_invite não é limpo depois do cadastro 🟡
**Estado:** Resolvido
**Arquivos:** `src/lib/auth/createAuth.ts` · `src/lib/auth/inviteCookie.ts`
**Impacto:** o cookie com o token do convite fica 1 h no navegador depois do cadastro (aparelho compartilhado).
**Correção:** — (opção: expirar em `user.create.after` com `ctx.setCookie(INVITE_COOKIE, "", { maxAge: 0, path: "/" })`)
**Registrado em:** 2026-11-20
**Atualização (2026-11-26):** resolvida na Fase 6: o hook `user.create.after` apaga o cookie `closery_invite` (`setCookie` com `maxAge: 0` e os mesmos atributos do cookie original, com `Secure` em produção) logo depois de gastar o convite; o cadastro recusado não mexe nele. Teste: `src/lib/auth/hardening.test.ts`.

#### P22 — Limite de tentativas no piloto: confirmar IP e números 🟡
**Estado:** Resolvido
**Arquivos:** `src/lib/auth/createAuth.ts` (`rateLimit`)
**Impacto:** na Vercel o IP do cliente precisa ser lido (sem o aviso de IP não determinado) e 30/10 por minuto podem não bastar na troca de turno com rede única (vários operadores no mesmo IP).
**Correção:** — (opção: Fase 6: confirmar na Vercel e ajustar os números)
**Registrado em:** 2026-11-20
**Atualização (2026-11-26):** resolvida no código na Fase 6: `advanced.ipAddress.ipAddressHeaders: ["x-forwarded-for"]`, só ele (a Vercel o sobrescreve com o IP do cliente; `x-real-ip` e `x-vercel-forwarded-for` seriam forjáveis fora dela). Sem IP resolvível o limite cai num balde global por rota, nunca num balde por valor forjado, e o aviso do Better Auth sai pelo `logServerError` como `better-auth:ip-desconhecido`. Os números ficam (30 por minuto no login, 10 no cadastro por IP): vários operadores atrás do mesmo IP do galpão dividem o balde, e se isso atrapalhar no piloto basta subir o número. Testes: `hardening.test.ts` e `ipUnknown.test.ts`. A conferência no primeiro deploy (nenhuma linha `better-auth:ip-desconhecido` no log da Vercel depois de uma tentativa de login) é o passo B7 da Parte B.

#### P12 — Tamanhos gerados pelo shadcn abaixo do mínimo de toque 🟡
**Estado:** Resolvido
**Arquivos:** `src/components/ui/sidebar.tsx` · `src/components/ui/input-group.tsx`
**Impacto:** `SidebarMenuButton` `sm` (h-7) e modo ícone (`size-8!`), `InputGroup` (h-8), `InputGroupButton` `icon-sm` (size-8) e `SidebarInput` (h-8) ficam abaixo de 44px no celular (`ui-rules.md §1.4`); a correção da P3 não os cobriu.
**Correção:** — (opção: aplicar o mesmo padrão `max-md:` da P3 (44px abaixo de `md`) com teste guarda de classes)
**Registrado em:** 2026-11-20
**Atualização (2026-11-26):** resolvida na Fase 6 (Tarefa 7). A pendência estava desatualizada: `Input`, `NativeSelect`, `Button` e o `SidebarMenuButton` padrão já têm `max-md:h-11` (P3), e os primitivos que ela cita (`SidebarMenuButton` `sm` e ícone, `InputGroup`, `InputGroupButton` `icon-sm`, `SidebarInput`) não aparecem em nenhuma tela. Os achados reais eram links soltos de componentes nossos, medidos a 390x844: `Greeting` ("Ver o dashboard", 120x21), `RequestDetail` ("Ver todas as solicitações", 159x20), `DashboardStock` (link da última contagem, 80x32) e o total do `SpendingRing` (9x44); os quatro ganharam o padrão do link solto (`ui-rules.md §1.4`). O guarda permanente `e2e/touch-targets.spec.ts` mede as telas do operador e do admin (e os diálogos) e reprova qualquer controle abaixo de 44 px, inclusive um primitivo da lista acima se um dia aparecer numa tela. Exceções medidas e justificadas: o link `inline` dentro de uma frase e o link esticado do `RequestCard` (`after:inset-0`, cuja área é o cartão inteiro). Não medido: iOS e Android reais, tema escuro e o contêiner do link esticado na Lista (ver P70).

#### P17 — Tema escuro nunca é ativado 🟡
**Estado:** Resolvido
**Arquivos:** `src/app/globals.css` · `src/app/layout.tsx` · `src/components/ui/sonner.tsx`
**Impacto:** `globals.css` usa a classe `.dark`, mas nada a aplica (sem ThemeProvider) e o Sonner chama `useTheme` sem provider; o tema escuro dos tokens nunca aparece.
**Correção:** — (opção: seguir o sistema ou adicionar `next-themes` com `ThemeProvider`)
**Registrado em:** 2026-11-20
**Atualização (2026-11-27):** resolvida no visual novo do Início e do shell (branch `feat/visual-inicio`). O tema escuro passou a ser o padrão, e o claro sai por um switch no cabeçalho (`ThemeSwitch`). O tema não segue o sistema, e a escolha fica no navegador. Não foi com `next-themes`: o script dele, dentro de um componente client, fazia o React 19 com Cache Components duplicar o conteúdo dinâmico da página. O tema é próprio: `src/lib/theme.ts` (com o script anti-flash no `<head>` do layout raiz) e o hook `src/lib/useTheme.ts`, que o Sonner também lê (`library-docs.md §18`). Testes: `src/lib/theme.test.ts`, `src/components/app-shell/ThemeSwitch.test.tsx` e o cenário do tema em `e2e/inicio.spec.ts` (escuro por padrão, a troca e a escolha depois de recarregar).

#### P81 — `next dev` dá 404 nas páginas fora do grupo (app) por causa do slot @detalhe 🟡
**Estado:** Resolvido
**Arquivos:** `src/app/(app)/@detalhe/` · `src/app/(auth)/entrar` · `src/app/(auth)/convite` · `src/app/(auth)/redefinir-senha` · `src/app/privacidade`
**Impacto:** no `bun run dev` (Next 16.4.6, com strict route matching ligado por padrão), `/entrar`, `/convite/<token>`, `/redefinir-senha` e `/privacidade` dão 404 ou 500, com o aviso "page files do not match any complete route". São as páginas fora do grupo `(app)`, que tem o slot `@detalhe`. Quem usa o `dev` não consegue entrar no app. O defeito já existe na `main` (conferido numa worktree). O build de produção não tem o problema, e o E2E roda em `next start`, por isso nenhum teste pega.
**Correção:** — (o roteiro planeja a correção no PR B, de processo, antes da tela de Passagens: `.git/sdd/roadmap/roteiro.md` §2.1, fora do git; é a decisão T3 do lote 0. Se o dono recusar o PR B, fica aqui)
**Registrado em:** 2026-11-27
**Atualização (2026-11-27):** resolvida no PR B (`chore/processo-visual`, spec `docs/superpowers/specs/2026-11-27-processo-visual-design.md` §4). Causa: a validação estrita do 16.4 (`normalizeCatchAllRoutes`, que o `next dev` chama) pendurava o `@detalhe/[...catchAll]` (normalizado para `/[...catchAll]`) em toda rota, inclusive nas de fora de `(app)`, e apagava a rota inteira, porque o `children` de `(app)` não tinha página nem `default` nelas. Correção: o catch-all saiu e o slot virou um espelho por segmento de `(app)`, com nove páginas nulas (`admin`, `admin/[...rest]`, `bem-vindo`, `conta`, `dashboard`, `passagens`, `passagens/[...rest]`, `solicitacoes`, `solicitacoes/[...rest]`); `(app)/default.tsx` e `deprecated.looseRouteMatching` foram recusados (`library-docs.md §1` e `§14`). Guarda: `src/app/routeStructure.test.ts` roda o validador do próprio Next sobre a árvore real (vermelho com a árvore antiga: as quatro páginas sem rota) e documenta a causa numa árvore sintética. Na produção nada muda: o Sheet do detalhe continua fechando ao navegar, agora pelo espelho do segmento.
**Atualização (2026-11-28):** na revisão final do PR B o espelho virou **exato**: os três `[...rest]` (`admin`, `passagens`, `solicitacoes`) saíram e entrou uma página nula do slot por página de `(app)`, no mesmo caminho e com os mesmos nomes de parâmetro (14 no total). No build de produção, o `[...rest]` fazia o segundo link para o mesmo caminho com outra busca entrar num laço de prefetch (cerca de 50 renderizações por segundo no servidor), pela previsão de rota do cliente do Next 16.4.6 com `partialPrefetching`. O `@detalhe/[...catchAll]` da `main` fazia o mesmo entre duas `/passagens/<id>`. Regra: nenhum catch-all no slot, em nenhum nível (`library-docs.md §14`). Guardas: o `routeStructure.test.ts` (grupo 4) e o `e2e/prefetch.spec.ts`. A P81 continua resolvida.

#### P83 — Hover e estado aberto com bg-muted somem dentro de card, Dialog e Sheet 🟡
**Estado:** Resolvido
**Arquivos:** `src/components/ui/button.tsx` (`outline` e `ghost`: `hover:bg-muted`, `aria-expanded:bg-muted`) · `src/components/ui/badge.tsx` (`outline` e `ghost`) · `src/components/ui/table.tsx` (hover, linha aberta, selecionada e rodapé) · `src/components/ui/card.tsx` e `src/components/ui/dialog.tsx` (rodapé `bg-muted/50`) · `src/components/ui/field.tsx` (hover do rótulo com campo) · `src/components/dashboard/BarList.tsx` · `src/components/dashboard/StatLink.tsx` · `src/components/app-shell/AdminOverview.tsx`
**Impacto:** na paleta nova, `--muted` tem o mesmo valor de `--card` e `--popover`. Dentro de cartão, diálogo ou Sheet, o hover do botão contornado ou fantasma (por exemplo "Tentar de novo" e o menu "…" do `RequestCard`), o da linha de tabela, o das linhas do `BarList` e do `StatLink` e o do cartão da Administração não mudam de cor. O rodapé do `Card` e o do `Dialog` também não se separam do corpo. O passe de legibilidade (Task 15) corrigiu os casos de estado (escolha marcada, selo, esqueleto e destaques do dashboard), mas não os de hover.
**Correção:** — (opção: trocar por `accent` nos primitivos, num commit `fix(visual)` com prova por estilo calculado; o roteiro planeja um guarda que recusa `bg-muted` nos `.tsx` no PR B, `.git/sdd/roadmap/roteiro.md` §7)
**Registrado em:** 2026-11-27
**Atualização (2026-11-27):** resolvida no PR B (`chore/processo-visual`, spec §9). Os estados e rodapés trocaram `bg-muted` por `bg-accent` com a mesma opacidade e a mesma variante (PB-D8): `Button` `outline` e `ghost` (hover e `aria-expanded`; `dark:hover:bg-accent/50` no `ghost`), `Badge` `outline` e `ghost`, `Table` (rodapé, hover, linha aberta e selecionada), `CardFooter`, `DialogFooter`, o hover do `FieldLabel` com campo, o `Avatar` (fallback e contador), `BarList` e `StatLink`. Desvio: o cartão da `AdminOverview` usa `group-hover:bg-accent` opaco, porque `accent/50` sobre a página escura dá exatamente o `--card` (caso negativo no `themeContrast.test.ts`). Os consumidores de `Button` e `Badge` `outline`/`ghost` foram conferidos contra fundo `accent` opaco; a revisão final achou dois casos de `accent` sobre `accent` que a conferência não cruzou, o trilho do `BarList` no hover da linha e o "Agora não" fantasma do `PasskeyOffer` sobre o rodapé `accent/50` (P109). Guarda: `src/app/mutedBackground.test.ts` recusa `bg-muted` (com opacidade e variantes, nunca `bg-muted-foreground`) nos `.ts` e `.tsx` de `src/`, com uma exceção fechada (`RequestColumn`, `bg-muted/30`, sobre a página; a branch E a troca pelo token `--column`). O `themeContrast.test.ts` mede o texto sobre `accent` e `accent/50` e confere que cada fundo de estado muda a cor de repouso. A prova por estilo calculado (hover de um `outline` e de um `ghost` dentro de cartão e de um `StatLink`) fica na prova do PR (C1); a do `StatLink` não distingue o antes do depois (P117). Efeito colateral: o `Button` `destructive` passou de `dark:hover:bg-destructive/20` para `dark:hover:bg-destructive/18`, porque sobre o rodapé `accent/50` o `/20` media 4,38:1 (o `themeContrast.test.ts` agora mede o rodapé).
