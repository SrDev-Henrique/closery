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

**Ids:** `P<N>` em sequência, nunca renumerados. **Próximo id livre: P77.**

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
| P17 | Tema escuro nunca é ativado | 🟡 | Aberto, não triado |
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

#### P17 — Tema escuro nunca é ativado 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/app/globals.css` · `src/app/layout.tsx` · `src/components/ui/sonner.tsx`
**Impacto:** `globals.css` usa a classe `.dark`, mas nada a aplica (sem ThemeProvider) e o Sonner chama `useTheme` sem provider; o tema escuro dos tokens nunca aparece.
**Correção:** — (opção: seguir o sistema ou adicionar `next-themes` com `ThemeProvider`)
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

#### P63 — Comportamento na Vercel só se confirma no primeiro deploy 🟡
**Estado:** Aberto, não triado
**Arquivos:** `vercel.json` · `next.config.ts` · `src/lib/auth/createAuth.ts` · `src/lib/sentry/options.ts`
**Impacto:** a Fase 6 não fez deploy, então ficou sem prova: `gru1` e o formato do `x-vercel-id`, o HSTS da Vercel, o `deploymentEnabled` ignorando as branches, o `bunx bun@1.3.3` na imagem de build, o `engines` sobre a configuração do painel, o IP do rate limit sem o aviso do Better Auth, o envio real e o flush do Sentry, a passkey com a `Permissions-Policy` em navegador real e o detalhe rápido com `next-url` (P44).
**Correção:** — (opção: conferir no primeiro deploy, passos B7 e B9 do runbook, e registrar o resultado aqui)
**Registrado em:** 2026-11-26

#### P64 — Aprovação da empresa (LGPD) pendente e /privacidade em rascunho 🟠
**Estado:** Aberto, não triado
**Arquivos:** `src/features/privacy/privacyContent.ts`
**Impacto:** sem a autorização do controlador dos dados (a empresa) ninguém é convidado; a retenção é "enquanto o uso durar", sem prazo; não existe ação de anonimizar uma pessoa desligada (a conta só se desativa).
**Correção:** — (opção: passo B12 do runbook, com o texto aprovado por escrito e o PR curto de `PRIVACY_DRAFT = false`; depois, uma ação de anonimizar que mantenha o id)
**Registrado em:** 2026-11-26

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
**Arquivos:** `src/instrumentation.ts` · `src/lib/auth/createAuth.ts`
**Impacto:** um erro não tratado de Server Component ou de rota sai no log do próprio Next como `⨯ Error: Failed query: … params: …`, com e-mail, hash ou texto da passagem; o log da Vercel guarda 1 hora no Hobby. `logServerError` só cobre o erro tratado e o que o `logger` do Better Auth emite. O mesmo vale para o roteador do `better-call` (Better Auth): quando a exceção não é `APIError` ele imprime `# SERVER_ERROR: <erro>` com `console.error` por conta própria, fora do `logger`, e o erro do Drizzle sai com o SQL e os parâmetros.
**Correção:** — (opções: aceitar no piloto e rever o log; ou limites de erro por rota que tratam o erro antes de o Next o ver)
**Registrado em:** 2026-11-26

#### P76 — Gerar link de nova senha não deixa registro de quem gerou 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/features/admin/passwordReset.ts`
**Impacto:** um administrador pode gerar o link de outro administrador (e assumir a conta) sem rastro de quem gerou, para quem e quando, contra a regra de rastro do projeto.
**Correção:** — (opção: tabela de auditoria dos links gerados; exige migração, fora da Fase 6)
**Registrado em:** 2026-11-26

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
