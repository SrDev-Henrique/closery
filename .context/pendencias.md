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

**Ids:** `P<N>` em sequência, nunca renumerados. **Próximo id livre: P44.**

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
| P12 | Tamanhos gerados pelo shadcn abaixo do mínimo de toque | 🟡 | Aberto, não triado |
| P13 | chart-5 ("Outros") quase invisível no tema escuro | 🟡 | Aberto, não triado |
| P14 | Destino perdido no login: depois de entrar a pessoa cai em / | 🟡 | Aberto, não triado |
| P15 | Token bruto do convite gravado em verification.value pelo estado do OAuth | 🟠 | Aberto, não triado |
| P16 | Cookie closery_invite não é limpo depois do cadastro | 🟡 | Aberto, não triado |
| P17 | Tema escuro nunca é ativado | 🟡 | Aberto, não triado |
| P18 | user.role e invite.role sem CHECK no banco | 🟡 | Resolvido |
| P19 | Erro e 404 dentro do app derrubam o shell inteiro | 🟡 | Aberto, não triado |
| P20 | Login social: ajustes antes de ligar | 🟡 | Aberto, não triado |
| P21 | Lacunas do E2E de acesso | 🟡 | Aberto, não triado |
| P22 | Limite de tentativas no piloto: confirmar IP e números | 🟡 | Aberto, não triado |
| P23 | Editar o nome de uma pessoa: falta em /admin/equipe e em /conta | 🟡 | Aberto, não triado |
| P24 | Ordem alfabética das listas do admin ignora acento | 🟡 | Aberto, não triado |
| P25 | Corrida entre cadastro por convite e desativação do setor | 🟡 | Aberto, não triado |
| P26 | Visão geral conta turnos e itens de setores inativos; listas da Fase 3 precisam filtrar setor ativo | 🟡 | Resolvido |
| P27 | Guardas de teste aceitam menos do que deveriam | 🟡 | Resolvido |
| P28 | Formulários de criação perdem o texto digitado ao remontar | ⚪ | Aberto, não triado |
| P29 | Acessibilidade da Equipe e da paginação | 🟡 | Aberto, não triado |
| P30 | Regra de convite pendente duplicada em 6 lugares | 🟡 | Aberto, não triado |
| P31 | Higiene de testes e refatorações pequenas da Fase 2 | ⚪ | Aberto, não triado |
| P32 | Mensagens no feminino e select vazio sem setor ativo | ⚪ | Aberto, não triado |
| P33 | Dois runners de Server Action quase iguais (admin e passagem) | ⚪ | Aberto, não triado |
| P34 | "Sem passagem" usa os horários atuais do turno e some com o turno desativado | 🟡 | Aberto, não triado |
| P35 | Cartão "Passagem para confirmar" não tem teto de idade | 🟡 | Aberto, não triado |
| P36 | Dois operadores no mesmo rascunho: o último a salvar vence, sem aviso | 🟡 | Aberto, não triado |
| P37 | Setor inativo: o resumo oferece Confirmar e Corrigir que sempre falham | 🟡 | Aberto, não triado |
| P38 | Rascunho com mais de 31 dias é editável no domínio, mas inalcançável pela interface | ⚪ | Aberto, não triado |
| P39 | Defesa em profundidade no banco da passagem | ⚪ | Aberto, não triado |
| P40 | Higiene de refatoração da Fase 3 | ⚪ | Aberto, não triado |
| P41 | Higiene de testes da Fase 3 | ⚪ | Aberto, não triado |
| P42 | Guardas de Server Action: varredura de exports por lista negra e exceção do convite no arquivo inteiro | 🟡 | Aberto, não triado |
| P43 | Limites conhecidos do rascunho: item inativo e preenchimento de zeros | ⚪ | Aberto, não triado |

---

## 1. Aberto, não triado

#### P12 — Tamanhos gerados pelo shadcn abaixo do mínimo de toque 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/components/ui/sidebar.tsx` · `src/components/ui/input-group.tsx`
**Impacto:** `SidebarMenuButton` `sm` (h-7) e modo ícone (`size-8!`), `InputGroup` (h-8), `InputGroupButton` `icon-sm` (size-8) e `SidebarInput` (h-8) ficam abaixo de 44px no celular (`ui-rules.md §1.4`); a correção da P3 não os cobriu.
**Correção:** — (opção: aplicar o mesmo padrão `max-md:` da P3 (44px abaixo de `md`) com teste guarda de classes)
**Registrado em:** 2026-11-20

#### P13 — chart-5 ("Outros") quase invisível no tema escuro 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/app/globals.css` (`--chart-5`) · `src/app/chartPalette.test.ts`
**Impacto:** `chart-5` tem 1,19:1 de contraste sobre o card no tema escuro; uma fatia "Outros" some.
**Correção:** — (opção: resolver antes de qualquer gráfico com fatia "Outros" (Fase 5): escolher valor com contraste ≥ 3:1 e medir no guarda)
**Registrado em:** 2026-11-20

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

#### P16 — Cookie closery_invite não é limpo depois do cadastro 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/lib/auth/createAuth.ts` · `src/lib/auth/inviteCookie.ts`
**Impacto:** o cookie com o token do convite fica 1 h no navegador depois do cadastro (aparelho compartilhado).
**Correção:** — (opção: expirar em `user.create.after` com `ctx.setCookie(INVITE_COOKIE, "", { maxAge: 0, path: "/" })`)
**Registrado em:** 2026-11-20

#### P17 — Tema escuro nunca é ativado 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/app/globals.css` · `src/app/layout.tsx` · `src/components/ui/sonner.tsx`
**Impacto:** `globals.css` usa a classe `.dark`, mas nada a aplica (sem ThemeProvider) e o Sonner chama `useTheme` sem provider; o tema escuro dos tokens nunca aparece.
**Correção:** — (opção: seguir o sistema ou adicionar `next-themes` com `ThemeProvider`)
**Registrado em:** 2026-11-20

#### P19 — Erro e 404 dentro do app derrubam o shell inteiro 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/app/error.tsx` · `src/app/not-found.tsx`
**Impacto:** os boundaries só existem na raiz: um erro ou 404 numa página do grupo `(app)` troca o shell (barra lateral) pela página de erro.
**Correção:** — (opção: considerar `(app)/error.tsx` e `(app)/not-found.tsx` sem `<main>` próprio)
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

#### P22 — Limite de tentativas no piloto: confirmar IP e números 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/lib/auth/createAuth.ts` (`rateLimit`)
**Impacto:** na Vercel o IP do cliente precisa ser lido (sem o aviso de IP não determinado) e 30/10 por minuto podem não bastar na troca de turno com rede única (vários operadores no mesmo IP).
**Correção:** — (opção: Fase 6: confirmar na Vercel e ajustar os números)
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

#### P29 — Acessibilidade da Equipe e da paginação 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/app/(app)/admin/equipe/page.tsx` · `src/components/admin/team/TeamAdmin.tsx` · `src/components/admin/team/InviteForm.tsx` · `src/components/admin/Pagination.tsx`
**Impacto:** `/admin/equipe` pode ter dois `<nav aria-label="Paginação">`; "Convidar pessoa" não é `h2` e há um `h3` órfão; ao trocar entre o formulário e o cartão do link o foco se perde (e o link aparece uma vez só); Anterior/Próxima desativados são `<span aria-disabled>`.
**Correção:** — (opção: prop opcional `aria-label` em Pagination; revisar níveis de título; mover o foco ao cartão do link e de volta ao formulário; fazer o desativado ser botão `disabled` ou manter o texto lido)
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

#### P33 — Dois runners de Server Action quase iguais (admin e passagem) ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/features/admin/runAdminAction.ts` · `src/features/handovers/runHandoverAction.ts`
**Impacto:** cerca de 25 linhas do fluxo (Zod → domínio → `unstable_rethrow` → `INTERNAL`) estão duplicadas; mudar o tratamento de erro num runner exige lembrar do outro e os dois podem divergir em silêncio.
**Correção:** — (opção: uma refatoração separada, com testes verdes antes e depois: um runner só, com o `revalidatePath` como parâmetro; nunca no mesmo commit de uma feature)
**Registrado em:** 2026-11-21

#### P34 — "Sem passagem" usa os horários atuais do turno e some com o turno desativado 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/features/handovers/history.ts`
**Impacto:** o par (turno × dia) "sem passagem" é calculado com os horários e o estado atuais do turno e só existe a partir do dia em que o turno foi criado: mudar o horário de um turno reescreve o passado e desativar um turno some com os "sem passagem" dele (nada guarda quando ele esteve ativo). O dashboard da Fase 5 herda a mesma definição.
**Correção:** — (opção: aceitar no MVP; se o piloto ou o dashboard exigirem, guardar o histórico de horários e de atividade do turno)
**Registrado em:** 2026-11-21

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

#### P37 — Setor inativo: o resumo oferece Confirmar e Corrigir que sempre falham 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/features/handovers/summary.ts` (`capabilities`) · `src/components/passagens/HandoverDetail.tsx`
**Impacto:** `capabilities` ignora `sector.active`: num setor inativo o resumo mostra "Confirmar recebimento", "Corrigir" e "Corrigir com motivo", e todos devolvem `SECTOR_INACTIVE`; `?editar=1` volta ao resumo em silêncio. Sem risco de dados, só atrito.
**Correção:** — (opção: `sectorActive` em `HandoverSummary` e esconder as ações, com um aviso "Setor inativo: só leitura")
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

#### P40 — Higiene de refatoração da Fase 3 ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/db/schema/migration0003.test.ts` e demais testes de migração · `src/features/handovers/*` (`firstValue`, `loaders.ts`, `creationRefusal`) · testes das guardas (`stripComments`, `findPages`) · `HandoverHeader.tsx` (rótulo "Setor")
**Impacto:** helpers de migração duplicados entre testes; `firstValue` copiado 3 vezes; `stripComments`/`findPages` duplicados; a recusa de criação escrita 2 vezes; `loaders.ts` faz três trabalhos; a regra "awaiting" escrita 3 vezes (hoje equivalentes, sem teste de concordância); o rótulo "Setor" do cabeçalho não tem controle associado (ver P29).
**Correção:** — (opção: um commit só de refatoração antes da Fase 4, testes verdes antes e depois, com um teste de concordância das três regras "awaiting"; o rótulo entra com P29)
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
