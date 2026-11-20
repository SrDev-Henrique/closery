# Closery — Passagem de turno — Design

> **Data:** 2026-11-20 · **Estado:** aprovado seção por seção no brainstorm; aguardando revisão
> da spec escrita.
>
> **Procedência.** Brainstorm de 2026-11-20 com o desenvolvedor (dono do projeto). O pedido
> original veio de um colaborador do setor ULD da LATAM Cargo (o "usuário final"), de forma
> abstrata, junto com a planilha `Latam_Cargo_Controle_ULD_v4.xlsx`. A planilha foi lida célula
> por célula; a análise completa (campos, listas, fórmulas e 13 problemas) está em
> `.context/about.md`. As 18 decisões estão em `.context/build-plan.md §5`, uma linha cada; esta
> spec as consolida e detalha.
>
> **Suposições a validar com o usuário final** estão marcadas com ⚠ e reunidas no §15.

---

## 1. Propósito

**Quem entrega o turno registra em poucos minutos o que aconteceu; quem recebe sabe em segundos o
que está recebendo; e cada passagem vira dado que o dashboard conta — sem ninguém redigitar
nada.**

Regra de ouro: **se aumenta o atrito de quem passa ou recebe o turno, está errado.** Onde
rastreabilidade e velocidade de uso discordarem, nada vira bloqueio na troca de turno (D5).

## 2. O problema, em uma tela

A planilha atual tem formulário, histórico e dashboard, mas **o formulário não grava nada**: o
histórico depende de redigitação, o turno nem é capturado na origem, o mesmo item tem dois nomes,
observações e ocorrências se perdem, "Recebido por" é digitado por quem entrega, e o dashboard lê
só 30 linhas e conta a "semana" a partir do último registro. Detalhe em `.context/about.md`.

## 3. Decisões

| # | Decisão |
|---|---|
| D1 | Itens **cadastráveis por setor** (nome, unidade, tipo controle/estoque, ordem, ativo). Nome/unidade/tipo **congelados** na passagem entregue. ⚠ |
| D2 | **Better Auth**, cadastro **só por convite**. E-mail + senha, Google, Apple, Facebook e **passkey**. |
| D3 | Convite **individual, uso único, 7 dias**, com setor e papel; cancelável; registra quem convidou. |
| D4 | Papéis **Administrador** e **Operador**; operador vê e faz só o do próprio setor. Desativar, nunca apagar. |
| D5 | **Confirmação de recebimento sem bloqueio.** "Recebido por" = quem confirmou. |
| D6 | **Solicitação** é registro com ciclo de vida e tela própria (Quadro · Lista · Tabela), no molde do board de ocorrências do klauve. ⚠ |
| D7 | Quem atende não usa o sistema; a equipe do setor move o status. **Destino** escolhido de uma lista. |
| D8 | **Comentários** (não chat) no detalhe rápido e na página completa; sem tempo real. |
| D9 | **Turnos cadastrados por setor** com horário; data e turno deduzidos; uma passagem por setor + turno + dia operacional. |
| D10 | **Sem imagens** em lugar nenhum. |
| D11 | Item registra **quantidade + observação**; estoque é **só contagem** (sem mínimo — inventário não cabe numa iniciativa própria). |
| D12 | Dois textos livres: **"Ocorrências do turno"** e **"Fica para o próximo turno"** (este em destaque para quem recebe). |
| D13 | **Corrigível até a confirmação;** depois, só admin, com motivo e histórico. |
| D14 | **Tokens padrão do shadcn** (`base-nova`, neutral). |
| D15 | **Server-first:** Server Components + Server Actions; filtros na URL; hospedagem **Vercel**. |
| D16 | Tokens que faltam (`chart-1..4`, `success`, `warning`, `info`) **vêm do klauve**. |
| D17 | Métricas com **KokonutUI** `metric-card` e `spending-ring`, adaptados (tokens, pt-BR, números). |
| D18 | Driver **`pg` + `attachDatabasePool`** (transação interativa; recomendação do Neon para Vercel) em produção; **PGlite** nos testes. *Atualizada ao ligar o Neon — era `neon-serverless`.* |

## 4. Acesso

### 4.1. Papéis e escopo (D4)

| Ação | Operador | Admin |
|---|---|---|
| Entregar, receber e ver passagens | do próprio setor | todos os setores |
| Corrigir passagem **antes** da confirmação | só a que ele entregou | todos |
| Corrigir passagem **depois** da confirmação | — | todos, com motivo |
| Criar, mover e comentar solicitações | do próprio setor | todos |
| Ver dashboard | do próprio setor | todos + filtro de setor |
| Setores, turnos, itens, destinos | — | sim |
| Convidar, desativar, mudar setor/papel | — | sim |

- O **escopo por setor é aplicado no servidor** em toda leitura e escrita (nunca só pelo filtro
  da tela). Um operador que monte a URL de outro setor recebe "não encontrado".
- O operador tem **exatamente um setor**; o admin, nenhum (vê todos).
- **Nunca** se desativa nem se rebaixa o **último admin ativo**.
- Pessoa desativada não consegue criar sessão (hook `session.create.before`); suas passagens,
  solicitações e comentários continuam com o nome dela.

### 4.2. Convites (D3)

- Admin abre **Equipe → Convidar**: nome de referência (opcional), setor (obrigatório para
  operador), papel. O sistema gera o link `/convite/<token>`.
- **Token:** 32 bytes aleatórios em base64url. O banco guarda só o **hash SHA-256**.
- O link vale **7 dias**, **uma conta**. Pode ser copiado, compartilhado (Web Share no celular —
  ex.: WhatsApp) ou **cancelado**. A lista de convites pendentes mostra validade e quem convidou.
- **Primeiro convite:** `bun run admin:invite` (script do desenvolvedor) cria um convite de
  admin e imprime o link.
- O convite **não é amarrado a e-mail** (o Apple pode entregar e-mail mascarado). A proteção é
  o uso único.

### 4.3. Cadastro e login (D2)

- **`/convite/[token]`:** valida o convite; se inválido, expirado, usado ou cancelado, explica
  qual dos quatro e orienta pedir outro. Se válido: "**{quem convidou}** te convidou para o
  setor **{setor}** como **{papel}**", com Google · Apple · Facebook · e-mail e senha.
- Ao abrir a página válida, o token vai para um **cookie httpOnly** (`Secure`, `SameSite=Lax`,
  expira com o convite) — sobrevive à ida e volta do OAuth.
- **`databaseHooks.user.create.before`** é o portão único, qualquer que seja o método. Ele
  **consome o convite atomicamente** — `UPDATE invite SET used_at = now() WHERE token_hash = ?
  AND used_at IS NULL AND cancelled_at IS NULL AND expires_at > now() RETURNING role, sector_id` —
  e, se nenhuma linha voltar (inválido, expirado, cancelado ou já usado por um cadastro
  simultâneo), **recusa a criação**. Se voltar, devolve o usuário com `role` e `sector_id` já
  preenchidos: nunca existe conta sem setor. **`user.create.after`** só grava `used_by`.
  Trade-off aceito: se a criação falhar *depois* do consumo (ex.: e-mail já cadastrado — a pessoa
  já tem conta), o convite fica gasto e o admin gera outro.
- A forma de o hook ler o cookie (contexto do endpoint) é conferida na doc instalada do Better
  Auth antes de implementar.
- Provedores sociais com **`disableImplicitSignUp: true`**; a página do convite chama o login com
  `requestSignUp: true`. Login social de quem não tem conta: **"Conta não encontrada. Peça um
  convite."**
- Depois do primeiro acesso: **"Entrar mais rápido da próxima vez?"** → criar passkey (pulável).
- **`/entrar`:** passkey primeiro (preenchimento automático do navegador), depois social, depois
  e-mail e senha com "Esqueci a senha" (depende de e-mail transacional — P8).
- **`/conta`:** nome, passkeys (adicionar/remover), sair. *(Não discutido no brainstorm: é o
  mínimo para gerenciar passkey e encerrar sessão.)*
- Apple e Facebook entram quando P6 e P7 estiverem resolvidas; o resto não depende deles.
- Rate limit do Better Auth ligado nos endpoints de autenticação.

## 5. Cadastros do administrador (`/admin`)

| Cadastro | Campos | Escopo |
|---|---|---|
| **Setores** | nome | global |
| **Turnos** | nome, início, fim (pode atravessar a meia-noite), ordem | por setor |
| **Itens** | nome, unidade, tipo (controle · estoque), ordem | por setor |
| **Destinos** | nome | **global** (o almoxarifado atende todos os setores) |
| **Equipe** | pessoas (setor, papel, situação), convites pendentes, Convidar | — |

- **Nada em uso é apagado — é desativado.** O histórico continua apontando para o registro;
  listas de escolha mostram só os ativos.
- Itens de **controle** somam no período ("redes danificadas"); itens de **estoque** são
  fotografia — vale a última contagem, nunca a soma (D11).
- Turnos de um mesmo setor não devem se sobrepor; o cadastro avisa se sobrepuserem.

## 6. Passagem de turno

### 6.1. Ciclo

```
rascunho ──(Entregar turno)──▶ aguardando recebimento ──(Confirmar recebimento)──▶ confirmada
   ▲  edição livre pela equipe       ▲ quem entregou ainda corrige        │ só admin corrige,
   └──────────────────────────────── ┘                                    ▼ com motivo
```

1. **Rascunho compartilhado.** Nasce no servidor quando alguém do setor começa a passagem do
   turno. É **um por setor + turno + dia operacional** (único no banco); qualquer operador do
   setor continua de onde o outro parou. Salva sozinho (por campo, com debounce); mostra "salvo
   às HH:MM". Falha de rede: o que foi digitado fica na tela, com "não salvo — tentar de novo"; ao
   sair com algo não salvo, o navegador avisa.
2. **Entregar turno.** Uma transação: muda `draft → delivered` **só se** ainda for rascunho
   (`UPDATE … WHERE status = 'draft'`), grava quem entregou e quando, congela nome do turno e
   nome/unidade/tipo de cada item ativo (os não tocados entram com `0`). Sem diálogo de
   confirmação — ainda dá para corrigir até alguém confirmar.
3. **Receber.** Para o setor, a **passagem entregue mais recente ainda não confirmada** aparece
   **no topo da tela inicial** — exceto para quem a entregou. Passagens mais antigas não
   confirmadas ficam no histórico como "não confirmada", sem cobrar na entrada do turno.
4. **Confirmar recebimento.** Observação opcional. Uma transação: `delivered → confirmed` só se
   ainda `delivered`. `CHECK` no banco: quem confirma ≠ quem entregou. "Recebido por" = quem
   confirmou, com data e hora.
5. **Corrigir (D13).** Até a confirmação, **quem entregou** corrige livremente (o admin também). Depois, **só admin**, com **motivo obrigatório**; cada campo alterado gera uma
   linha em `handover_correction` (antigo, novo, motivo, quem, quando) na mesma transação. A
   passagem exibe **"corrigida"** e lista as correções. O dashboard usa sempre o valor vigente.
6. **Turno sem passagem.** Turno encerrado sem passagem entregue aparece como **"sem passagem"**
   no histórico e no dashboard. Rascunho nunca entregue conta como sem passagem.

### 6.2. Dedução de data e turno (D9)

- Fuso da operação: **`America/Sao_Paulo`**. Datas gravadas em UTC (`timestamptz`).
- **Turno sugerido = o turno ativo do setor cujo fim está mais próximo de agora** (antes ou
  depois). A passagem é feita no fim do turno — às 14:05, o turno das 06–14 (terminou há 5 min)
  vence o das 14–22. Turno e data podem ser trocados no formulário (entrega atrasada).
- **Dia operacional** de um turno que atravessa a meia-noite = o dia em que ele **começou**.

### 6.3. O formulário (`/passagens/nova` → rascunho do turno)

Ordem: cabeçalho (setor · turno · data, deduzidos e editáveis) → **Controles** (cada item: nome,
unidade, contador com −/+ e digitação, observação opcional) → **Estoque** (idem) →
**Solicitações abertas** do setor (só leitura, link para cada uma, botão **Nova solicitação** que
abre o mesmo formulário da tela de solicitações sem sair da passagem) → **Ocorrências do turno** →
**Fica para o próximo turno** → botão **Entregar turno**.

Regras de UI que valem aqui: números começam em `0`; −/+ com alvo ≥ 44px no celular; valor
digitável `text-base`; nada a digitar que possa ser escolhido.

### 6.4. O resumo para quem recebe (`/passagens/[id]`)

Na ordem do briefing: **Fica para o próximo turno** → **Solicitações abertas** (paradas
destacadas) → **itens com valor ≠ 0 ou com observação** (os zerados recolhidos em "demais itens:
0") → **Ocorrências do turno** → quem entregou e quando → **Confirmar recebimento**.

### 6.5. Histórico (`/passagens`)

Lista paginada por dia operacional, mais recente primeiro; cada linha: dia, turno, setor (admin),
quem entregou, situação (aguardando · confirmada por X · **não confirmada** · **sem passagem** ·
corrigida). Filtros: período, turno, situação, setor (admin).

## 7. Solicitações (`/solicitacoes`)

- **Campos:** setor, **destino** (lista global; ou "Outro" com texto), **descrição**, quem criou e
  quando, **status**, e **itens de estoque com quantidade** (opcional, 0..n linhas — a solicitação
  semanal de insumos vira uma solicitação com várias linhas). Passagem de origem, quando criada a
  partir de uma.
- **Status:** Solicitada → Em separação / Trânsito → Entregue, ou **Cancelada**. Qualquer
  transição é permitida e vira evento (de, para, quem, quando). **Cancelar exige motivo**, gravado
  como comentário na mesma transação.
- **"Parada":** aberta (Solicitada ou Em separação/Trânsito) sem mudar de status há **mais de 3
  dias** — constante `STALE_AFTER_DAYS = 3`. Selo "parada há N dias".
- **Quadro:** três colunas (Solicitada · Em separação/Trânsito · Entregue), cada uma com ícone,
  nome e **contagem do servidor**, paginada ("carregar mais"). Entregue mostra os últimos 30 dias.
  Canceladas só na Lista e na Tabela. Mover: botão **"Mover para {status}"** na cor do destino,
  com `useOptimistic` (o card muda de coluna antes da resposta; volta com erro se falhar).
- **Lista** agrupada por status; **Tabela** com descrição, destino, itens, quem criou, criada em,
  status, dias no status (números à direita, `tabular-nums`). **No celular a Lista é o padrão**;
  o Quadro mostra uma coluna por vez.
- **Filtros** na URL: visão, destino, período, quem criou, busca por texto; setor (admin).
- **Detalhe rápido** (clique no card, sem sair da tela) e **página completa**
  (`/solicitacoes/[id]`, pelo ↗): propriedades, linha do tempo de status, comentários.
- **Comentários:** texto; sem edição; o autor pode apagar o próprio (`deleted_at`, some da
  tela). Carregam ao abrir e se atualizam após comentar (`revalidatePath`). Sem tempo real.
- **Referência visual:** `klauve/.context/ui-screens.md §8.1` e
  `klauve/apps/web/src/components/occurrences/` — copiar anatomia e regras, não código.

## 8. Dashboard (`/dashboard`)

- **Escopo:** operador, o próprio setor; admin, todos + filtro de setor.
- **Período:** 7 dias · 30 dias · intervalo, pelo calendário em `America/Sao_Paulo`, visível no
  topo ("últimos 7 dias · 14–20 nov"). Controla todos os blocos, inclusive os `metric-card`.

| Bloco | Conteúdo | Forma |
|---|---|---|
| **Passagens** | esperadas · entregues · confirmadas · **não confirmadas** · **sem passagem** | números + `spending-ring` (confirmadas · não confirmadas · sem passagem) |
| **Controles** | por item: total do período, média por turno, vs. período anterior | `metric-card` por item, **segmentos = turnos** |
| **Estoque** | por item: última contagem (data e turno) e evolução no período | número + linha (`chart` do shadcn) |
| **Solicitações** | abertas · paradas · entregues no período · tempo médio até a entrega **por destino** · quantidade pedida **por item** | números + barras; `spending-ring` para parte-do-todo (até 4 fatias + "Outros") |

- **Definições (no SQL, nunca guardadas):**
  - *esperadas* = pares (turno ativo do setor × dia do período) **já encerrados**;
  - *sem passagem* = pares esperados **sem** passagem entregue ou confirmada (contado por par,
    nunca por subtração — uma entrega antecipada não gera número negativo);
  - *média por turno* = total ÷ passagens entregues ou confirmadas;
  - *tempo até a entrega* = criação → primeiro evento para `delivered`;
  - *vs. período anterior* = mesmo número de dias imediatamente antes.
- **Todo número é clicável** e leva à lista filtrada correspondente.
- **Exportar CSV** das passagens do período: uma linha por passagem (dia, turno, setor, entregue
  por, recebido por, situação, uma coluna por item, os dois textos). Separador `;` e BOM UTF-8
  (abre direto no Excel em pt-BR).
- Gráficos: até 4 séries com `chart-1..4` (D16); a cor pertence à entidade e não é ciclada.

## 9. Modelo de dados

Nomes em inglês no banco e no código; interface em pt-BR. Ids `uuid`; datas `timestamptz` em
UTC; `operational_date` é `date`. Índice em toda FK.

**Better Auth:** `user`, `session`, `account`, `verification`, `passkey`. `user` ganha (via
`additionalFields`): `role` (`admin` | `operator`), `sector_id` (obrigatório para operador),
`deactivated_at`.

```
sector              id, name, active, created_at
shift               id, sector_id, name, starts_at (time), ends_at (time), sort_order, active
item                id, sector_id, name, unit, kind (control|stock), sort_order, active
destination         id, name, active
invite              id, token_hash UNIQUE, role, sector_id?, invitee_label?, invited_by?,
                    expires_at, used_at?, used_by?, cancelled_at?, created_at

handover            id, sector_id, shift_id, operational_date, status (draft|delivered|confirmed),
                    shift_name_snapshot?, occurrences_text, next_shift_text,
                    delivered_by?, delivered_at?, confirmed_by?, confirmed_at?, confirmation_note?,
                    created_at, updated_at
                    UNIQUE (sector_id, shift_id, operational_date)
                    CHECK (confirmed_by IS NULL OR confirmed_by <> delivered_by)
                    INDEX (sector_id, operational_date)
handover_item       handover_id, item_id, quantity int ≥ 0 DEFAULT 0, note?,
                    item_name_snapshot?, item_unit_snapshot?, item_kind_snapshot?
                    PK (handover_id, item_id)
handover_correction id, handover_id, field, item_id?, old_value, new_value, reason,
                    corrected_by, corrected_at

request             id, sector_id, destination_id?, destination_other?, description,
                    status (requested|in_transit|delivered|cancelled), created_by, created_at,
                    status_changed_at, origin_handover_id?
                    CHECK (exatamente um entre destination_id e destination_other)
                    INDEX (sector_id, status)
request_item        request_id, item_id, item_name_snapshot, quantity int > 0
                    PK (request_id, item_id)
request_status_event id, request_id, from_status?, to_status, changed_by, changed_at
request_comment     id, request_id, author_id, body, created_at, deleted_at?
                    INDEX (request_id, created_at)
```

Snapshots (`*_snapshot`) são preenchidos na **entrega** (passagem) ou na **criação**
(solicitação); enquanto rascunho, a tela lê o cadastro vivo.

## 10. Arquitetura técnica

- **Server-first (D15).** Leitura em Server Components via funções de consulta em
  `src/features/<domínio>/`; escrita em **Server Actions**: Zod → sessão + papel + **setor** →
  transação → `revalidatePath`/`revalidateTag` → resultado tipado (`{ ok: true } | { ok: false,
  error }`). Erro esperado volta como resultado; `throw` só para falha interna.
- **Banco (D18).** `drizzle-orm/node-postgres` com `Pool` + `attachDatabasePool`; toda escrita
  multi-statement em `db.transaction()`. Transições de estado com `UPDATE … WHERE status = '<esperado>'` conferindo as
  linhas afetadas. Migrações versionadas (`db:generate` → revisar → `db:migrate`).
- **Cache Components ligado:** dado é dinâmico por padrão; acesso a sessão/cookies dentro de
  `<Suspense>`; nada de `"use cache"` em dado escopado por usuário.
- **Fatias:** `features/auth`, `features/admin`, `features/handovers`, `features/requests`,
  `features/dashboard`. Lógica pura (dedução de turno, dia operacional, "parada") em módulos sem
  I/O, testáveis isoladamente.
- **Rotas:**

| Rota | O quê |
|---|---|
| `/entrar`, `/convite/[token]`, `/conta` | acesso |
| `/` | início: passagem para confirmar (topo), passagem do meu turno, solicitações abertas/paradas |
| `/passagens`, `/passagens/nova`, `/passagens/[id]` | histórico, formulário do turno, detalhe/receber/corrigir |
| `/solicitacoes`, `/solicitacoes/[id]` | quadro · lista · tabela; página completa |
| `/dashboard` | métricas |
| `/admin/setores`, `/admin/turnos`, `/admin/itens`, `/admin/destinos`, `/admin/equipe` | cadastros |

## 11. UI

- **Tokens:** shadcn padrão (D14) + do klauve `chart-1..4`, `success`, `warning`, `info` (D16;
  valores em `.context/ui-tokens.md §2`). Status sempre com ícone + texto, nunca só cor.
- **KokonutUI (D17):** `metric-card` e `spending-ring` instalados pelo CLI e adaptados — tokens no
  lugar das cores cruas, pt-BR, números com unidade, período controlado pelo dashboard
  (`.context/library-docs.md §6`).
- **Regras:** `.context/ui-rules.md` (nunca em branco, escolha em vez de texto, rótulo de
  resultado, alvos de 44px no celular, estados carregando/vazio/erro).
- **Celular primeiro** para passagem e solicitações; dashboard pensado para o desktop, legível no
  celular.

## 12. Testes

- **Vitest + PGlite** (migrações reais, sem rede): dedução de turno e dia operacional (incluindo
  meia-noite e o "fim mais próximo"); "parada"; Server Actions com feliz + entrada inválida +
  **operador em outro setor** + papel errado + corrida (dois "Entregar", duas confirmações, convite
  usado duas vezes); consultas do dashboard com o **teste do critério de pronto** (números = soma
  das passagens do período, incluindo sem passagem e correções).
- **Testing Library:** formulário (começa em 0, −/+, nunca em branco), estados, card que muda de
  coluna e volta com erro.
- **Playwright:** convite → cadastro (e-mail e senha) → entregar; outra pessoa confirma;
  solicitação até Entregue aparece no dashboard; operador barrado em outro setor; passkey com
  autenticador virtual do Chromium. Login social: checklist manual.

## 13. Fases

| Fase | Entrega |
|---|---|
| **0 — Fundação** | ~~Neon (P1); driver (D18)~~ ✅; PGlite + Vitest + Testing Library + Playwright; tokens D16 |
| **1 — Acesso** | Better Auth (e-mail e senha, Google, passkey), convites, `admin:invite`, `/entrar`, `/convite`, `/conta`, shell de navegação, escopo por setor |
| **2 — Cadastros** | setores, turnos, itens, destinos, equipe |
| **3 — Passagem** | rascunho, entregar, receber, corrigir, histórico, início |
| **4 — Solicitações** | quadro · lista · tabela, detalhe, comentários, ligação com a passagem |
| **5 — Dashboard** | consultas, `metric-card` e `spending-ring` adaptados, CSV |
| **6 — Produção** | Vercel, domínio (Apple e passkey), e-mail (P8), Apple/Facebook (P6/P7), **piloto de uma semana** |

Cada fase termina com `check-types`, `lint`, testes e `build` verdes, `progress-tracker.md` e
`ui-registry.md` atualizados e achados no `pendencias.md`.

## 14. Fora do escopo

Imagens e vídeos; estoque com mínimo, entradas e consumo; chat ou tempo real; quem atende
solicitações usando o sistema; ocorrências estruturadas/contadas; notificações push ou e-mail
(exceto recuperação de senha); integração com sistemas da LATAM; marca LATAM (P2); multi-empresa;
app nativo.

## 15. Suposições a validar com o usuário final ⚠

1. Os itens e nomes da planilha (glossário em `.context/about.md`, P5) — e que "sacos de cebola" e
   "sacos de ráfia" são o mesmo item.
2. Os horários reais dos turnos do setor ULD.
3. Que "solicitações" são pedidos de insumos/reparos a outras áreas (D6) — e quais são os destinos.
4. Que a passagem é feita **no fim** do turno (base da regra "fim mais próximo", §6.2).
5. Que qualquer operador do setor pode receber a passagem (D5) e editar o rascunho do turno.

## 16. Dependências externas

| Id | O quê | Bloqueia |
|---|---|---|
| P2 | Autorização de uso da marca LATAM | nada (sem marca por padrão) |
| P6 | Apple Developer Program + domínio HTTPS | só o botão Apple |
| P7 | App da Meta publicado (privacidade, exclusão de dados) | só o botão Facebook |
| P8 | Provedor de e-mail transacional | "Esqueci a senha" |

## 17. Critério de pronto (MVP)

- A equipe abandona a planilha por **uma semana inteira** sem perder informação.
- Uma passagem completa leva **menos tempo** que na planilha (medido com quem usa).
- Os números do dashboard **batem com a soma** das passagens do período (teste automatizado).
- `check-types`, `lint`, testes e `build` verdes.
