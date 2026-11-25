# Plano de Construção — Closery

> **Documento vivo.** Direção e sequência da construção. O progresso real fica no
> `progress-tracker.md`; as decisões técnicas no `architecture.md §10`; o escopo de produto no
> `about.md`.

---

## 1. Princípio principal

**Substituir a planilha de passagem de turno por algo mais rápido de preencher e que não perde
nada.** O que a pessoa registra ao entregar o turno é, sem nenhuma etapa manual, o dado que o
próximo turno lê e que o dashboard conta.

Regra de ouro: **se aumenta o atrito de quem passa ou recebe o turno, está errado.**

## 2. Objetivo do projeto

Ao final do MVP, a equipe do setor ULD:
1. **Entrega** o turno no sistema (celular ou PC) em poucos minutos, com quantidades,
   observações e ocorrências;
2. **Recebe** o turno sabendo em segundos o que saiu do normal;
3. **Consulta** um dashboard semanal e mensal de quantidades e solicitações — sem planilha.

## 3. Escopo do MVP · 🟢 fechado no brainstorm

Ponto de partida (o que a planilha já faz, sem os defeitos dela):
- **Acesso:** login (Better Auth) por convite individual; papéis administrador e operador (D2–D4).
- **Cadastros do administrador:** setores, turnos, itens e destinos de solicitação (D1, D7, D9).
- **Passagem de turno:** cabeçalho deduzido (data, turno, setor, quem entrega), controles,
  estoque contado, ocorrências, solicitações abertas; entrega → confirmação de recebimento (D5).
  Sem fotos (D10).
- **Solicitações:** tela própria com quadro · lista · tabela, status, histórico e comentários
  (D6–D8).
- **Histórico de passagens** (lista + detalhe imutável).
- **Dashboard:** acumulado semanal e mensal, média por turno, último saldo de estoque,
  solicitações abertas/paradas e tempo até a entrega por destino.

Detalhe completo na spec: `docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md`.

## 4. Fases

| Fase | O quê | Status |
|---|---|---|
| **0 — Fundação** | scaffold e contexto ✅ · Neon + driver `pg` (P1, D18) ✅ · PGlite + Vitest + Playwright ✅ · tokens da D16 ✅ | ✅ |
| **1 — Acesso** | Better Auth (e-mail + senha, Google, passkey; Apple/Facebook quando P6/P7 resolvidas), convites, `admin:invite`, shell de navegação, escopo por setor | ✅ |
| **2 — Cadastros** | setores, turnos, itens, destinos, equipe | ✅ |
| **3 — Passagem** | rascunho, entregar, receber, corrigir, histórico | ✅ |
| **4 — Solicitações** | quadro · lista · tabela, detalhe, comentários, ligação com a passagem | ✅ |
| **5 — Dashboard** | consultas, `metric-card` e `spending-ring` adaptados, CSV | ✅ |
| **6 — Produção** | Vercel, domínio, e-mail (P8), piloto de uma semana com a equipe | ⬜ |

**Metodologia por fase:** schema/servidor → tela → teste. Ao fim de cada fase: atualizar o
tracker, rodar `check-types` + `lint` + `build` + testes, e registrar achados no `pendencias.md`.

## 5. Brainstorm · 🟢 concluído (2026-11-20)

Decisões tomadas entram aqui, uma linha cada, com data. O design final vira spec em
`docs/superpowers/specs/`.

| # | Pergunta | Decisão |
|---|---|---|
| D1 | Itens contados: fixos ou cadastráveis? (2026-11-20) | **Cadastráveis por setor, de forma simples:** nome, unidade e tipo (controle do turno · estoque), com ordem e ativo/inativo. Nada de construtor genérico de formulários. A passagem **congela** nome e unidade do item no momento da entrega, para que renomear um item depois não reescreva o histórico. *Suposição a validar com o usuário final.* |
| D2 | Como cada pessoa se identifica? (2026-11-20) | **Better Auth, cadastro só por convite.** Sem link de convite válido não se cria conta, por nenhum método. Métodos: **e-mail + senha, Google, Apple, Facebook**, e **passkey** para o login rápido depois do primeiro acesso. Bloqueio do cadastro num ponto único (`databaseHooks.user.create.before` valida o convite) + `disableImplicitSignUp` nos provedores sociais. |
| D3 | Como funcionam os convites? (2026-11-20) | **Um convite por pessoa, de uso único**, com validade de **7 dias**, já carregando **setor e papel**. Pode ser cancelado; registra quem convidou. O primeiro convite (o do administrador inicial) é gerado por um comando do desenvolvedor, não pela interface. |
| D4 | Quais papéis existem? (2026-11-20) | **Dois: Administrador e Operador.** Administrador: setores, itens, convites, desativar pessoas, histórico e dashboard de todos os setores. Operador: entrega e recebe turnos **do próprio setor**, vê histórico e dashboard **do próprio setor**. Pessoa que sai é **desativada, nunca apagada** — o histórico mantém a autoria. |
| D5 | Quem recebe confirma? (2026-11-20) | **Confirmação sem bloqueio.** Entregue, a passagem fica *aguardando recebimento*; quem assume lê o resumo (o que saiu do normal primeiro) e toca **Confirmar recebimento**, com observação opcional. **"Recebido por" = quem confirmou**, com data e hora — ninguém digita esse nome. Sem confirmação, nada trava: a passagem aparece como *não confirmada* no histórico e no dashboard. Uma confirmação por passagem; qualquer operador do setor pode confirmar. |
| D6 | O que é uma solicitação? (2026-11-20) | **Registro próprio com ciclo de vida e tela dedicada** (`/solicitacoes`), no molde do board de ocorrências do klauve: visões **Quadro (kanban por status) · Lista · Tabela**, status atualizável com **histórico de transições** (quem, quando), e **comentários** por solicitação (D8). **Sem fotos nem vídeos.** Status vindos da planilha: Solicitada → Em separação / Trânsito → Entregue, ou Cancelada. As abertas aparecem em toda passagem até serem concluídas; o dashboard conta abertas, paradas e tempo até a entrega. A solicitação semanal de insumos vira um caso disso. Referência: `klauve/.context/ui-screens.md §8.1` e `klauve/apps/web/src/components/occurrences/`. |
| D7 | Quem atende e atualiza as solicitações? (2026-11-20) | **A própria equipe do setor.** Quem atende (almoxarifado, manutenção…) não usa o sistema. Toda solicitação tem um **destino** escolhido numa lista que o **administrador cadastra** (com "Outro"); operadores do setor criam e movem o status. O dashboard mede tempo até a entrega **por destino**. |
| D8 | Comentários e detalhe da solicitação (2026-11-20) | **Comentários, não chat** — como nas ocorrências do klauve: clicar no card abre o **detalhe rápido** sem sair do quadro; o ↗ abre a **página completa** (`/solicitacoes/[id]`) com propriedades, linha do tempo de status e comentários. Comentários carregam ao abrir e se atualizam depois de comentar (`revalidatePath`). **Sem atualização automática nem serviço de tempo real.** |
| D9 | Como os turnos existem? (2026-11-20) | **Cadastrados por setor pelo administrador**, com nome e horário de início e fim (pode atravessar a meia-noite). A passagem deduz **data e turno** pelo horário e já vem preenchida. Turno que vira a meia-noite pertence ao **dia operacional em que começou** (fuso `America/Sao_Paulo`). **Uma passagem por setor + turno + dia operacional** (unique no banco). |
| D10 | A passagem aceita fotos? (2026-11-20) | **Não.** Sem imagens na passagem nem nas solicitações — nenhum serviço de armazenamento de arquivos no MVP. Evidência fica em texto (observação por item e ocorrências). |
| D11 | O que cada item registra? (2026-11-20) | **Quantidade (começa em 0) + observação opcional. Sem situação manual e sem estoque mínimo** — itens de estoque são **só contagem**, como na planilha. Motivo: um mínimo pressupõe inventário, e o sistema é iniciativa do usuário, não pedido da liderança; não cabe exigir esse trabalho. O **tipo** do item (D1) continua decidindo a agregação: **controle** soma no período; **estoque** é fotografia — vale o último valor contado, nunca é somado. |
| D12 | Como ficam as ocorrências na passagem? (2026-11-20) | **Dois campos de texto livre:** **"Ocorrências do turno"** (o que aconteceu) e **"Fica para o próximo turno"** (o que precisa ser feito). O segundo aparece **em destaque no topo** para quem recebe, junto com as solicitações abertas. Sem tipo/categoria e sem contagem no dashboard. |
| D13 | Como se corrige uma passagem entregue? (2026-11-20) | **Corrigível até a confirmação, travada depois.** Antes do recebimento, quem entregou corrige livremente. Depois de confirmada, **só o administrador** corrige, com **motivo obrigatório**; o sistema guarda valor antigo, valor novo, quem e quando, e a passagem exibe "corrigida". O dashboard usa sempre o valor vigente. |
| D14 | Direção visual (2026-11-20) | **Tokens padrão do shadcn** (preset `base-nova`, base `neutral`, claro e escuro) — sem identidade própria e sem reaproveitar a paleta do klauve. Do klauve vem só a **anatomia** das telas (D6). Marca LATAM fora até autorização (P2). |
| D15 | Abordagem de arquitetura (2026-11-20) | **Server-first:** Server Components leem o banco via funções de consulta em `src/features/<domínio>/`; toda escrita é **Server Action** (Zod → permissão → grava → revalida); filtros e visão (Quadro/Lista/Tabela) na **URL**; `useOptimistic` para mover card sem esperar. Sem camada de API separada. Hospedagem proposta: **Vercel**. |
| D16 | Tokens que faltam no shadcn padrão (2026-11-20) | **Vêm do klauve:** `chart-1..4` (série de gráfico validada para daltonismo no klauve), `success`, `warning` e `info` (com `-foreground`), claro e escuro. Complementa a D14 — o resto continua shadcn padrão. Gráfico com várias séries é permitido (até 4, regras do `ui-rules.md §4`); da 5ª categoria em diante agrupa em "Outros" neutro. |
| D17 | Componentes de métrica (2026-11-20) | **KokonutUI** via CLI do shadcn: `@kokonutui/metric-card` (número + linha do período vs. período anterior + decomposição) e `@kokonutui/spending-ring` (anel de parte-do-todo). **Adaptados na instalação**: tokens no lugar das cores cruas (`zinc`, `emerald`, `rose`, `orange`…), textos e `Intl` em pt-BR, formato numérico com unidade em vez de moeda, e o período do `metric-card` **controlado pelo seletor do dashboard** (sem as pílulas internas). |
| D18 | Driver do banco (2026-11-20) | **`node-postgres` (`pg`) com `Pool` + `attachDatabasePool` (`@vercel/functions`) em produção, PGlite nos testes** — os dois têm `db.transaction()` interativa, exigida por entregar, corrigir e mudar status. Substitui o `neon-http` do scaffold (que só tem `db.batch`). **Atualização (2026-11-20):** a decisão do brainstorm era `neon-serverless` (WebSocket); ao ligar o Neon, a skill oficial `neon-postgres` indicou `pg` + `attachDatabasePool` para Vercel Fluid compute — trocado. **Implementado e verificado** (`/api/health`). |

**Design aprovado por seção** (consolidado na spec ao final):

- **Seção 1 — ciclo da passagem** (aprovada 2026-11-20): rascunho **compartilhado** no servidor,
  um por setor + turno + dia, com salvamento automático; entregar (cabeçalho deduzido e editável
  para entrega atrasada; "Entregue por" = quem toca o botão; status *aguardando recebimento*);
  receber (pendente no topo da tela inicial; resumo na ordem: fica para o próximo turno →
  solicitações abertas → itens ≠ 0 ou com observação → ocorrências; **quem entregou não confirma a
  própria passagem**); corrigir (D13); turno sem passagem aparece como **"sem passagem"**.
- **Seção 2 — solicitações** (aprovada 2026-11-20): setor, destino, descrição, autor/data, status
  e **linhas opcionais de itens de estoque com quantidade** (a solicitação semanal vira uma
  solicitação com várias linhas; o dashboard soma quanto foi pedido por item); status Solicitada →
  Em separação / Trânsito → Entregue | Cancelada, qualquer transição permitida e registrada,
  **cancelar exige motivo** (vira comentário); **"parada" = aberta sem mudar de status há mais de
  3 dias** (constante); Quadro com 3 colunas (contagem do servidor, paginadas; Entregue mostra 30
  dias; canceladas só na Lista/Tabela); Lista agrupada por status e Tabela; filtros destino,
  período, autor, busca (+ setor para admin); **no celular a Lista é o padrão** e o Quadro mostra
  uma coluna por vez; detalhe rápido + página completa; comentários sem edição, autor pode apagar
  o próprio; na passagem, as abertas aparecem só para leitura + botão "Nova solicitação".
- **Seção 3 — dashboard** (aprovada 2026-11-20, com D16/D17): operador vê o próprio setor, admin
  todos + filtro de setor; período 7 dias · 30 dias · intervalo, pelo calendário em
  `America/Sao_Paulo`. Blocos: **Passagens** (esperadas = turnos × dias · entregues · confirmadas ·
  não confirmadas · sem passagem); **Controles** (total, média por turno, vs. período anterior —
  `metric-card` por item, com os **turnos como segmentos**); **Estoque** (última contagem com data
  e turno + evolução); **Solicitações** (abertas · paradas · entregues · tempo médio até a entrega
  por destino · quantidade pedida por item — `spending-ring` para parte-do-todo com até 4 fatias +
  "Outros"). Todo número leva à lista filtrada; tudo calculado no SQL; gráficos com o `chart` do
  shadcn (Recharts); **exportar CSV** das passagens do período (uma linha por passagem, uma coluna
  por item).
- **Seção 4 — administração e convites** (aprovada 2026-11-20): primeiro convite (admin) sai de
  `bun run admin:invite`; `/convite/[token]` mostra quem convidou, setor e papel + Google · Apple ·
  Facebook · e-mail e senha; token em **cookie httpOnly** (sobrevive ao OAuth) validado no
  `user.create.before`; consumo do convite **atômico** (`UPDATE … WHERE used_at IS NULL`, dois
  cadastros simultâneos → só um passa); convite **não amarrado a e-mail** (Apple pode mascarar);
  após cadastro, oferta de passkey (pulável); `/entrar` com passkey primeiro (autofill), depois
  social, depois e-mail e senha + "Esqueci a senha" (P8); social sem conta → "Conta não
  encontrada. Peça um convite."; `/admin` com Setores, Turnos (por setor), Itens (por setor),
  **Destinos (lista global)**, Equipe (pessoas, convites pendentes com copiar/compartilhar/
  cancelar, Convidar); **nada em uso é apagado — desativa**; não se desativa nem rebaixa o
  **último admin**; operador tem **exatamente um setor**, admin nenhum.
- **Seção 5 — modelo de dados** (aprovada 2026-11-20): nomes em inglês no código/banco, UI em
  pt-BR. Better Auth (`user`, `session`, `account`, `verification`, `passkey`) com `user` +
  `role` (`admin`/`operator`), `sector_id` (obrigatório p/ operador), `deactivated_at` (hook na
  criação de sessão barra desativado). Cadastros: `sector`; `shift` (setor, nome, início, fim,
  ordem, ativo); `item` (setor, nome, unidade, `kind` `control`/`stock`, ordem, ativo);
  `destination` (global); `invite` (hash do token único, papel, setor, quem convidou, nome de
  referência, expira/usado/usado por/cancelado). Passagem: `handover` (setor, turno,
  `operational_date`, `status` `draft`/`delivered`/`confirmed`, dois textos, entregue por/em,
  confirmado por/em/observação, nome do turno congelado; `UNIQUE (setor, turno, operational_date)`
  e `CHECK` confirmador ≠ entregador); `handover_item` (PK passagem+item, quantidade int ≥ 0
  padrão 0, observação, nome/unidade/tipo congelados); `handover_correction` (campo, item,
  antigo, novo, motivo, quem, quando). Solicitações: `request` (setor, destino, texto de "Outro",
  descrição, `status` `requested`/`in_transit`/`delivered`/`cancelled`, criador/data, status
  mudou em, passagem de origem opcional); `request_item` (item com nome congelado, quantidade
  > 0); `request_status_event` (de, para, quem, quando); `request_comment` (autor, texto,
  `deleted_at`). Derivados só no SQL: esperados = turnos ativos × dias; sem passagem = esperados −
  entregues/confirmadas (rascunho conta como sem passagem); tempo até entrega = criação → primeiro
  evento para `delivered`. Índices: toda FK + `handover(sector_id, operational_date)`,
  `request(sector_id, status)`, `request_comment(request_id, created_at)`.
- **Seção 6 — testes e fases** (aprovada 2026-11-20): D18; Vitest + PGlite (domínio, Server
  Actions com erro + outro setor + convite concorrente, consultas do dashboard com o teste do
  critério de pronto); Testing Library (formulário, −/+, estados, card); Playwright (convite →
  cadastro → entregar; confirmar; solicitação até Entregue no dashboard; operador barrado em
  outro setor; passkey via autenticador virtual; social em checklist manual). Fases 0–6 no §4.

**Spec consolidada:** `docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md`.

## 6. Fora do MVP

Integração com sistemas da LATAM; escala/RH; estoque com movimentação (entrada/consumo);
notificações push/e-mail; multi-empresa; app nativo.

## 7. Critério de pronto (MVP)

- A equipe consegue abandonar a planilha por uma semana inteira sem perder informação.
- Uma passagem completa leva **menos tempo** que na planilha (medir com quem usa).
- Os números do dashboard batem com a soma das passagens do período (teste automatizado).
- `check-types`, `lint`, `build` e testes verdes.
