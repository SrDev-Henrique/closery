# Fase 3 — Passagem de turno — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a passagem de turno de ponta a ponta: o operador (ou o admin) abre o formulário do turno certo sem digitar nada, preenche contagens com −/+ e dois textos que se salvam sozinhos, entrega o turno; outra pessoa do setor vê no Início a passagem para confirmar, lê o resumo na ordem do briefing e confirma o recebimento; quem entregou ainda corrige até a confirmação; depois dela só o admin corrige, com motivo e rastro; o histórico mostra o que foi entregue, o que ficou "não confirmada" e os turnos "sem passagem". Fecha as pendências P26 e P27. Solicitações ficam para a Fase 4.

**Architecture:** Next.js 16 server-first, igual às Fases 1 e 2. Regra de negócio em funções de domínio (`src/features/handovers/*`) que recebem `db: Db` e, quando o tempo importa, `now: Date`, e devolvem `AdminResult` (resultado tipado com mensagem pt-BR pronta; a união de códigos ganha os códigos da passagem). Lógica pura (fuso de São Paulo, dia operacional, turno sugerido, quantidade, diff de correção, permissões, filtros do histórico) em módulos sem I/O. As Server Actions ficam em `src/app/(app)/passagens/actions.ts` e `src/app/(app)/actions.ts`; cada função começa por `requireUser()` (ou `requireAdmin()`) e passa por `runHandoverAction` (Zod → domínio → `revalidatePath` só nas transições). GET nunca escreve: o rascunho nasce no primeiro salvamento (upsert idempotente pela tripla setor + turno + dia). Páginas leem no servidor dentro de `<Suspense>` e passam dados a componentes de cliente controlados (salvamento automático por campo). O histórico (inclusive "sem passagem") é uma consulta SQL única (`generate_series` × turnos ativos, `LEFT JOIN`/`NOT EXISTS`). Migração versionada `0003`, gerada pelo drizzle-kit.

**Tech Stack:** Next.js 16.4.6 · React 19.3 · TypeScript 5.9 · Bun 1.3.3 · Drizzle 0.45.4 + `pg` 8.23 (Neon) · Better Auth 1.7.27 · Zod 4 · shadcn/ui `base-nova` (Base UI) · Tailwind 4 · Vitest 5.1.1 + jsdom 28 + Testing Library · PGlite 0.5.17 (+ `pglite-socket` 0.2.20 no E2E) · Playwright 1.65.1 · Biome 2.4. Nenhuma biblioteca nova, nenhum componente shadcn novo.

**Spec:** `docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md` (§4.1 papéis, §6 passagem inteira, §9 modelo de dados, §10 arquitetura e rotas, §11 UI, §12 testes, §13 fases). Escopo e decisões do dono: `.git/sdd/fase3-decisions.md`.

## Global Constraints

- Leia `AGENTS.md` e os arquivos de `.context/` antes de começar; as regras de lá valem em toda tarefa. Antes de escrever código de Next, confira o guia em `node_modules/next/dist/docs/` (esta versão tem quebras).
- Node **≥ 22.12**. Bun é o gerenciador e o runner de scripts; **nunca** `bun test` — use `bun run test`.
- Biome é a lei de formatação: espaços (2), aspas duplas, ponto e vírgula. Depois de código gerado rode `bunx biome check --write src`.
- TypeScript strict: sem `any`, sem `!` non-null de conveniência, sem `as` para calar erro (exceto o cast documentado em teste de contrato).
- Named exports em tudo, exceto entry files do Next (`page.tsx`, `layout.tsx`, `route.ts`, `error.tsx`, `not-found.tsx`, `proxy.ts`). Componentes em `PascalCase.tsx`; utilitários em `camelCase.ts`; primitivos shadcn em `kebab-case.tsx`. Arquivo `actions.ts` só exporta funções `async` (regra do `"use server"`); tipos e constantes vivem fora dele.
- Base UI, não Radix: composição pela prop `render`. Navegação com cara de botão é `<Link className={buttonVariants({ … })}>`. Só tokens de cor (`bg-background`, `text-muted-foreground`, `bg-warning`, `text-success-foreground`…); nunca hex nem cor crua do Tailwind; tema claro **e** escuro. Status sempre com ícone **e** texto, nunca só cor.
- Cache Components ligado: `cookies()`, `headers()`, `await params`/`searchParams` e qualquer leitura de sessão **só dentro de `<Suspense>`**; nunca em função `"use cache"`; nada de `"use cache"` em dado escopado por usuário. Páginas de passagem **podem** exportar `metadata` estático (não são de admin): `Passagens`, `Nova passagem`, `Passagem`; nenhum `generateMetadata`.
- **Portão em três camadas:** (1) toda página nova de `src/app/(app)/**` chama `requireUser()` por um componente importado de `@/components/...` (guarda `appPagesAuth.test.ts`); (2) toda Server Action exportada chama `requireUser()` (ou `requireAdmin()`) como **primeira instrução** (guarda novo `actionsGuards.test.ts`, que também reprova `"use server"` fora de `actions.ts`); (3) o domínio nunca confia na tela: revalida escopo de setor, papel, estado e limites. Operador que monte a URL ou a action de outro setor recebe `NOT_FOUND` / `notFound()` ("Página não encontrada"), nunca "sem permissão" (não revela o que existe).
- **GET nunca escreve.** Abrir, recarregar e pré-carregar `/passagens/nova` não cria linha. O rascunho nasce no primeiro salvamento (`INSERT … ON CONFLICT DO NOTHING` + leitura da linha existente).
- **Passagem confirmada não muda em silêncio:** depois da confirmação só `correctHandover` altera dados de passagem, só para admin, com motivo, uma linha de `handover_correction` por campo alterado na mesma transação. Nunca `UPDATE` de conteúdo sem rastro depois de `confirmed`.
- Transição de estado é `UPDATE … WHERE status = '<esperado>'` conferindo as linhas afetadas, dentro de `db.transaction()`, com a linha travada por `FOR UPDATE` antes de decidir a mensagem. Corrida perdida devolve a mensagem clara do vencedor (quem e quando), nunca erro genérico.
- Erro esperado é **retornado** (`AdminResult` com `ok: false`); `throw` só para falha interna. Mensagem de erro é texto pt-BR pronto para a tela, nunca texto cru do banco. O salvamento automático **não** chama `revalidatePath` (re-renderizaria a tela enquanto a pessoa digita); só entregar, confirmar e corrigir revalidam.
- Textos de interface em pt-BR, exatamente como na seção **Textos de interface** abaixo (testes e E2E dependem deles). Rótulos de ação nomeiam o resultado ("Entregar turno", "Confirmar recebimento", "Registrar correção"; nunca "Enviar", "OK"); número nunca em branco (`0`); conjunto fechado é escolha; controle só com ícone ganha tooltip **e** `aria-label`; campo digitável usa `text-base`; alvo ≥ 44px abaixo de `md` (`h-9 max-md:h-11` / `size-9 max-md:size-11`).
- Toda lista é paginada (`PAGE_SIZE = 50`, `?pagina=`); agregação e "sem passagem" no SQL; escrita de vários statements em `db.transaction()`. **Setor ativo (P26):** as listas e escolhas da passagem (turnos, itens, histórico, Início e formulário novo) juntam `sector.active`; turno inativo não entra em escolha nem em "sem passagem". **Setor inativo é só leitura:** salvar, entregar, confirmar ou corrigir uma passagem existente dele é recusado com `SECTOR_INACTIVE`; o resumo continua legível.
- Mudança de schema só por migração versionada (`bun run db:generate -- --name fase3_passagem` → revisar o SQL → `bun run db:migrate`); nunca `db:push`.
- Datas: `timestamptz` no domínio; `operational_date` é `date` e trafega como texto `"YYYY-MM-DD"` (Drizzle `date({ mode: "string" })`; o driver `pg` e o PGlite devolvem texto também em SQL cru). Horário de turno trafega como `"HH:mm"` (`fromDbTime`). Fuso da operação `America/Sao_Paulo` calculado com `Intl` (sem biblioteca nova). Funções de domínio recebem `now: Date`; nenhum `new Date()` dentro de função pura ou de domínio.
- Nenhum nome real de funcionário, foto ou dado da planilha em código, seed, teste ou fixture; use nomes fictícios ("Turno Manhã", "Rede de proteção", "Ana Teste", "Bia Teste").
- **Teste:** erro, limites (vazio, `0`, máximo, unicode, meia-noite, virada de dia) e permissão negada sempre; PGlite não prova concorrência — a atomicidade vai no SQL e o teste prova a invariante **em sequência** (dois "Entregar", duas confirmações, quem entregou tentando confirmar, correção sem motivo, correção por operador). Teste de tempo usa `spDate()` (`test/clock.ts`), nunca o relógio real.
- Toda tarefa termina com: `bun run check-types`, `bun run lint`, `bun run test` verdes e commit na branch `feat/fase-3-passagem`. Mensagens em pt-BR (`tipo(escopo): resumo`) terminando com a linha `Co-Authored-By:` do modelo que executou (hoje `Claude Sonnet 5.5 <noreply@anthropic.com>`); mensagem escrita com a ferramenta Write em `.git/sdd/msg-task-N.txt` e `git commit -F .git/sdd/msg-task-N.txt` (heredoc com acento falha na ferramenta Bash); nunca `--no-verify`. **Refatoração nunca no mesmo commit de feature** (a extração do helper de guardas na Tarefa 3 é o seu próprio commit). O PR só abre com o CI (`checks` + `e2e`) verde.
- **Shell:** comandos deste plano são bash (Git Bash), nunca PowerShell. Arquivos com texto acentuado se criam com a ferramenta Write, não com heredoc. Em código que testa NFC, travessão ou espaço sem quebra, escreva o caractere com chaves (`\u{301}`, `\u{2013}`, `\u{a0}`): as ferramentas de escrita convertem `\uXXXX` de 4 dígitos no caractere literal.
- **Worktree:** se a execução usar `git worktree`, copie o `.env.local` do checkout principal antes da Tarefa 1 (`db:migrate` e `build` precisam dele). Em worktree, `.git` é arquivo: use `$(git rev-parse --git-common-dir)/sdd/` no lugar de `.git/sdd/`, ou execute no checkout principal.

---

## Decisões técnicas deste plano (complementam a spec)

`D-F3-n` = decisão do dono (vinculante). `F3-n` = decisão do controlador, mantida ou refinada aqui (o "Por quê" diz o que mudou). "Verificado" = conferido num clone de trabalho (`scratchpad/fase3-skeleton`) com Drizzle 0.45.4, drizzle-kit 0.31, PGlite 0.5.17, Node 22.12 e a doc instalada do Next 16.4.6.

| # | Decisão | Por quê |
|---|---|---|
| D-F3-1 | Solicitações ficam para a Fase 4: formulário e resumo **sem** "Solicitações abertas"; o Início desta fase **não** mostra solicitações | Dono. A Fase 4 acrescenta a seção e a ligação passagem → solicitação |
| D-F3-2 | Trocar turno ou data abre o rascunho **daquele** turno/dia (navega para `?turno=&data=`); nunca move nem mistura rascunhos; o rascunho só nasce quando alguém salvar algo | Dono |
| D-F3-3 | Admin escolhe o setor na tela (Início, Nova passagem e Histórico), só setores **ativos**; a escolha vive na URL (`?setor=`) e é lembrada num cookie como padrão da próxima visita; operador usa sempre o próprio setor e nunca vê o seletor | Dono. Ver F3-15 (como o cookie é gravado) |
| F3-1 | Migração `0003_fase3_passagem`, gerada pelo drizzle-kit: `handover`, `handover_item` (PK `(handover_id, item_id)`), `handover_correction`. **Refina:** `updated_by` e `updated_at` em `handover` (alimentam "Salvo às HH:mm por {nome}"); `CHECK handover_state_consistent` (rascunho sem quem/quando de entrega e confirmação; entregue com entrega e sem confirmação; confirmada com os quatro campos) **além** de `handover_confirmer_ne_deliverer`; `CHECK` do tipo do snapshot do item; `CHECK` de campo e de "item só nos campos de item" e de motivo não vazio em `handover_correction`; um índice por FK (`handover_shift_id_idx`, `handover_delivered_by_idx`, `handover_confirmed_by_idx`, `handover_updated_by_idx`, `handover_item_item_id_idx`, `handover_correction_*`); `handover_sector_date_idx (sector_id, operational_date)` para o histórico | **Verificado:** `bunx drizzle-kit generate --name fase3_passagem` emite exatamente isso (10 índices, 10 FKs `restrict`, 8 `CHECK`s, `PRIMARY KEY("handover_id","item_id")`); no PGlite `confirmed_by = delivered_by` → `23514`, `delivered` sem `delivered_by` → `23514`, `quantity = -1` → `23514 handover_item_quantity_nonneg`, PK duplicada → `23505 handover_item_handover_id_item_id_pk`, correção de item sem `item_id` → `23514`. O `CHECK confirmed_by <> delivered_by` sozinho passa quando `delivered_by` é `NULL` (comparação com `NULL`); o `state_consistent` fecha esse buraco. Quantidade ≥ 0 no banco; o **teto** (`MAX_QUANTITY`) fica no domínio (mudar o teto não exige migração) |
| F3-2 | GET nunca escreve. A identidade do rascunho é a **tripla** `{ sectorId, shiftId, operationalDate }` (`HandoverRef`), nunca um id que o cliente teria de guardar: salvar, entregar e abrir são idempotentes. Criação = `INSERT … ON CONFLICT DO NOTHING RETURNING id`; se não voltou linha, lê a existente com `SELECT … FOR UPDATE` | **Verificado:** com `.onConflictDoNothing().returning({ id })` a 1ª inserção devolve 1 linha e a 2ª devolve `[]` (ler a linha existente é obrigatório); `.select().from(handover).where(…).for("update")` roda no PGlite e devolve `operationalDate` como `string` `"2026-11-20"` e `updatedAt` como `Date` |
| F3-3 | Salvamento automático por campo, debounce `AUTOSAVE_DEBOUNCE_MS = 800`, **fila serial** (uma requisição em voo; o valor mais novo de cada campo vence), `onBlur` envia já, ao desmontar envia o pendente, `beforeunload` enquanto houver algo não salvo, `online` reenvia o que falhou, falha mostra "Não salvo." + "Tentar de novo" e **mantém o digitado**. A Server Action devolve `{ handoverId, savedAt, savedByName }` e **não revalida** | Fila serial: duas requisições de Server Action não têm ordem garantida; sem ela o valor velho poderia sobrescrever o novo. Sem `revalidatePath` o Next não re-renderiza a página a cada salvamento. Último a salvar vence por campo; sem tempo real (spec §6.1) |
| F3-4 | Quem edita: **rascunho** → qualquer pessoa do setor e o admin; **entregue** → só quem entregou e o admin, **direto** (mesmo salvamento automático, sem linha de correção); **confirmada** → o salvamento automático recusa **todos, inclusive admin** (`HANDOVER_LOCKED`); só `correctHandover` (admin, motivo) altera. Uma função pura `handoverCapabilities` decide e é usada pelo domínio e pela UI | Uma fonte da regra evita tela e servidor divergirem; admin corrige confirmada só pelo fluxo com rastro (D13) |
| F3-5 | `deliverHandover` numa transação: cria o rascunho se não existe, trava a linha, `UPDATE … SET status='delivered', delivered_by, delivered_at, shift_name_snapshot, updated_at, updated_by WHERE id AND status='draft'`, insere `handover_item` com `0` para todo item **ativo** do setor que faltar, preenche os snapshots de **todas** as linhas. Linha de item já existente cujo item foi desativado depois **fica** (o dado digitado não se perde) e ganha snapshot do cadastro vivo. Sem diálogo de confirmação. Entregar tudo zerado e sem texto é permitido (nada vira bloqueio, D5). Segunda entrega: `ALREADY_DELIVERED` com "por {nome} às HH:mm" | Regra de ouro: zerar tudo é informação ("nada aconteceu") |
| F3-6 | Receber: o cartão do Início é a passagem **mais recente do setor entre as `delivered` e as `confirmed`** (`delivered_at desc, id desc`); só aparece se ela estiver `delivered` e não for de quem olha: uma confirmada mais nova esconde as entregues antigas, e a que o usuário entregou some **sem** cair para uma mais antiga; **sem teto de idade** (ver Perguntas). `confirmHandover`: `UPDATE … WHERE id AND status='delivered' AND delivered_by <> $actor`; "Recebido por" = quem confirmou. Admin pode confirmar (escopo "todos"). Mais antigas não confirmadas viram "não confirmada" no histórico | Spec §6.1 itens 3 e 4 |
| F3-7 | Correção (D13): `correctHandover` recebe o estado **completo** desejado (`occurrencesText`, `nextShiftText`, `items[]` com quantidade e observação) + `reason`; o **servidor** calcula o diff (`diffHandover`, pura) e grava uma linha por campo alterado: `occurrences_text`, `next_shift_text`, `item_quantity`, `item_note`. Observação nula e vazia são o mesmo valor (`""`). Sem alteração → `NO_CHANGES` (nenhuma linha). Item que a passagem não tem → `NOT_FOUND`. Selo "Corrigida" = existe ≥ 1 linha de correção | O cliente não decide o que mudou; evita rastro forjado ou omitido |
| F3-8 | Dedução (§6.2) em módulo puro: considera, para cada turno **ativo**, as ocorrências que **começam** em `ontem` e `hoje` (São Paulo; uma que começa amanhã nunca é sugerida, porque a data seria recusada por F3-8b); fim = início + `(fim − início) mod 24 h`; vence a menor distância `|fim − agora|`; **empate:** (1) o que já terminou vence o que ainda vai terminar, (2) menor posição na lista do setor (`sort_order`, `created_at`, `id`). O dia operacional é o dia em que a ocorrência **começou** (turno 22:00–06:00 que termina às 06:05 de hoje → dia de **ontem**). `resolveHandoverTarget`: se a URL traz `turno` **e** `data` válidos, usa; senão sugere (a tela sempre manda os dois juntos) | **Verificado** com `Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", hourCycle: "h23" }).formatToParts`: 14:05 → Manhã (hoje); 06:05 → Noite (ontem); 23:30 → Tarde (hoje); 00:10 → Tarde (ontem); 22:00 exatos → Tarde (do mesmo dia, distância 0); `02:59Z`→`2026-11-20 23:59` e `03:00Z`→`2026-11-21 00:00`; dois fins iguais → o primeiro da lista; fim 13:00 × 15:00 às 14:00 → o 13:00 (já terminou); sem turnos → `null`. `Intl.supportedValuesOf("timeZone")` inclui `America/Sao_Paulo` no Node 22.12 (ICU completo). O Brasil não tem horário de verão desde 2019 e o cálculo compara hora de parede em São Paulo, sem somar offset fixo; o código comenta isso |
| F3-8b | Data operacional aceita: `hoje − 31 dias` até `hoje` (São Paulo). Futura ou mais antiga que 31 dias: o formulário volta à sugestão; a escrita recusa com `DATE_OUT_OF_RANGE` **só ao criar** (um rascunho antigo já existente continua editável e entregável). Turno inativo: não é escolhível; criar rascunho nele → `SHIFT_INACTIVE`; um rascunho que já existe continua entregável | Entrega atrasada é suportada (spec §6.2) sem aceitar lixo na URL; rascunho existente nunca fica preso |
| F3-9 | Histórico `/passagens`: **paginado por linhas** (`PAGE_SIZE = 50`, `?pagina=`), ordenado por dia operacional desc, fim do turno desc, setor, turno. **Refina** "paginado por dia": com filtros, uma página de "dias" ficaria vazia ou desigual; a ordem já agrupa por dia. Filtros na URL em pt-BR: `periodo` (`7`·`30`·`intervalo`), `de`, `ate`, `turno`, `situacao`, `setor`, `pagina`. Período máximo `HISTORY_MAX_DAYS = 93`. Admin ganha a opção **"Todos os setores"** (`?setor=todos`, não vai para o cookie) só aqui | Spec §6.5 + F3-9 do controlador. "Todos os setores" cobre o filtro "setor (admin)" da spec sem outro controle |
| F3-9b | Situação: `confirmed` · `awaiting` (entregue **e** a mais recente do setor entre entregues e confirmadas, a do cartão do Início) · `unconfirmed` (entregue, com outra entregue **ou confirmada** mais nova no setor) · `missing` (par turno ativo × dia **já encerrado** sem passagem entregue/confirmada, mesmo com rascunho). `corrected` é um **selo** à parte (e um filtro). Rascunho de turno **ainda em andamento** não aparece | **Verificado** no PGlite: `generate_series(from::timestamp, to::timestamp, interval '1 day')` (o dia vem de `d.day::date`) × `shift` ativo de `sector` ativo (a passagem já entregue de um turno depois desativado continua no histórico; só os pares `missing` exigem turno ativo), `ends_local = dia + (0 ou 1 dia) + ends_at` (`timestamp` sem fuso) comparado a `now AT TIME ZONE 'America/Sao_Paulo'`; `NOT EXISTS` para o par sem entregue/confirmada; `UNION ALL` com as passagens reais; `unconfirmed` por `NOT EXISTS (… n.status IN ('delivered','confirmed') AND (n.delivered_at, n.id) > (h.delivered_at, h.id))`; `exists(handover_correction)` para `corrected`; `ORDER BY … LIMIT/OFFSET` e `count(*)` sobre o mesmo CTE rodam no PGlite (Manhã 21/11 às 14:30 = `missing`; Noite 21/11 ainda não terminou = fora; rascunho de Noite 20/11 = `missing` com `has_draft`). O par só existe a partir do dia (São Paulo) de `shift.created_at` (turno novo não gera 30 dias de "sem passagem") |
| F3-9c | Leitura SQL: `db.select({ … sql<string>\`u.col\` }).from(sql\`(WITH … SELECT * FROM u) AS u\`)` — sem `db.execute` (o `Db` genérico não tipa o resultado). `timestamptz` cru volta como texto (`"2026-11-21 11:54:27.517+00"`): mapeie com `sql<Date>\`…\`.mapWith(handover.deliveredAt)`; `date` e `timestamp` sem fuso voltam como texto | **Verificado** nos dois drivers: `drizzle-orm/node-postgres/session.js` e `pglite/session.js` devolvem `TIMESTAMPTZ`, `TIMESTAMP`, `DATE` e `INTERVAL` como texto; `.mapWith(coluna)` devolve `Date` (testado). `tsc` aceita as consultas com o tipo `Db` |
| F3-10 | Resumo `/passagens/[id]` na ordem do briefing (sem solicitações): "Fica para o próximo turno" em destaque → itens com valor ≠ 0 **ou** observação (Controles e Estoque) com os zerados recolhidos em `<details>` "Demais itens: 0 ({n})" → "Ocorrências do turno" → quem entregou e quando → recebimento/"Confirmar recebimento" → "Correções" (linha do tempo). Rascunho aberto por id **redireciona** para `/passagens/nova?turno=&data=` | Spec §6.4 |
| F3-11 | Início `/`: (1) "Passagem para confirmar" (topo), (2) "Passagem do meu turno" (turno sugerido agora: Começar / Continuar / Entregue / Confirmada), (3) sem turnos: estado vazio (admin: link para `/admin/turnos?setor=`). Admin vê o seletor de setor. A saudação continua; seu 2º parágrafo passa a `Em breve: solicitações e dashboard.` | Spec F3-11; a passagem deixa de ser "em breve" |
| F3-12 | Formulário `/passagens/nova`: cabeçalho (setor · `Turno` · `Data`) → Controles → Estoque → Ocorrências → Fica para o próximo turno → `Entregar turno`. Quantidade: `0`…`MAX_QUANTITY = 99_999`, só dígitos; campo vazio ao sair vira `0` e **só então** é salvo; −/+ travam em 0 e no teto. Observação do item recolhida atrás de "Adicionar observação" (abre sozinha se já existe). Textos: `TEXT_MAX_LENGTH = 2000`; observação do item `200`; observação do recebimento `500`; motivo `500` (caracteres = pontos de código). Texto livre guardado como digitado (NFC, `\r\n` → `\n`), sem `trim` (o salvamento acontece enquanto a pessoa digita) | Spec §6.3, `ui-rules §2.2` |
| F3-13 | **Runner irmão, não generalização:** `runHandoverAction` (`src/features/handovers/runHandoverAction.ts`) copia o fluxo do `runAdminAction` (Zod → `run({ db, now, actor, input })` → `unstable_rethrow` → `INTERNAL`) e troca o `revalidatePath` fixo do admin por um parâmetro `revalidate: boolean` (`revalidatePath("/(app)", "layout")`). `AdminErrorCode` **ganha** 10 códigos (aditivo) e `AdminResult`, `ok`, `fail`, `firstFieldErrors`, `useAdminAction` e `ConfirmDialog` são **reaproveitados** sem renomear | Generalizar o `runAdminAction` mudaria a assinatura e os testes da Fase 2 (refatoração junto de feature é proibida) e o autosave precisa **não** revalidar. **Verificado:** `AdminErrorCode` só é referenciado em `result.ts` (nenhum `switch` exaustivo a quebrar). A duplicação de ~25 linhas vira a pendência P33 (unificar os runners numa refatoração à parte) |
| F3-13b | P27 entra aqui (Tarefa 3): (a) `appPagesAuth.test.ts` passa a exigir `requireAdmin` nas páginas sob `admin/`; (b) novo `src/app/actionsGuards.test.ts` varre **todo** `.ts/.tsx` de `src` que contenha `"use server"` (diretiva de arquivo ou inline), exige que o arquivo se chame `actions.ts` e esteja em `src/app/(app)/**` (exceção documentada: `src/app/(auth)/convite/[token]/actions.ts`, pública por natureza), que `admin/**` use `requireAdmin()` e o resto `requireUser()` ou `requireAdmin()` na **primeira** instrução. O código de varredura de `admin/actionsAuth.test.ts` é extraído (commit próprio, só refatoração) para `test/actionGuards.ts` | `.context/pendencias.md` P27 pede exatamente isso "na primeira tarefa da Fase 3"; sem o guarda uma action de passagem sem portão passaria despercebida |
| F3-14 | Testes (§12): dedução com meia-noite, fim mais próximo, empates, virada UTC; domínio com PGlite (feliz + inválido + outro setor + papel errado + corridas em sequência); histórico com `missing`/`unconfirmed`/`awaiting`, filtros e paginação; **paridade** entre `hasShiftEnded` (JS) e o SQL de pares encerrados numa grade de horários; componentes; E2E. **E2E não depende do relógio:** usa um turno `00:00–23:59` e abre `/passagens/nova?turno=<id>&data=<hoje em São Paulo>`; só um cenário passa pelo cartão do Início (que usa o relógio real e funciona com um único turno) | Determinismo: o servidor do E2E usa `new Date()` de verdade |
| F3-15 | Lembrar o setor do admin: **Server Action `chooseSectorAction`** grava o cookie `closery_setor` (`httpOnly`, `sameSite: "lax"`, `secure` em produção, `path: "/"`, 1 ano) e faz `redirect(\`${path}?setor=${id}\`)`; `path` é uma lista fechada (`/`, `/passagens`, `/passagens/nova`). A leitura (`readRememberedSector`) acontece **dentro de `<Suspense>`**. O seletor é um componente de cliente novo, `SectorPicker`; o `SectorSwitcher` (links) do admin **não muda** | **Verificado na doc instalada** (`cookies.md`, `redirect.md`): `.set` só em Server Function/Route Handler; "In a Server Action, `redirect` performs a client-side navigation when JavaScript is available"; ler `cookies()` dentro de `<Suspense>` com Cache Components faz streaming só da subárvore (o `getAuthz` do projeto já lê `headers()` assim). **Descartado:** gravar no `proxy.ts` (o Next **pré-carrega** cada link de setor e o cookie viraria o último setor pré-carregado) e gravar em `onClick` + link (corrida entre a action e a navegação) |
| F3-16 | Editar uma entregue e corrigir uma confirmada vivem em **`/passagens/[id]?editar=1`** (a mesma rota, sem rota nova): a página mostra o formulário se a pessoa pode e o resumo se não puder. `/passagens/nova` com combinação já entregue/confirmada **redireciona** para `/passagens/{id}` | Sem rota fora da spec §10; o guarda de páginas continua com 12 páginas |
| F3-17 | Escopo: `loadSector(db, actor, sectorId)` devolve `null` para setor inexistente **ou** fora do escopo do operador (mesma resposta), e todo domínio traduz isso em `NOT_FOUND`. `scopeToSector` entra nas consultas de lista (histórico, Início); leitura por id usa `canAccessSector` | Spec §4.1; `NOT_FOUND` igual nos dois casos não revela setores |
| F3-18 | P26 (Fase 3): as listas e escolhas da passagem (turnos, itens, histórico, Início, formulário novo) juntam `sector.active`/`shift.active`/`item.active`; escrever numa passagem existente de setor inativo (salvar, entregar, confirmar, corrigir) é recusado com `SECTOR_INACTIVE` e o resumo dela continua legível; as contagens de `getAdminOverviewCounts` passam a contar turnos e itens só de setores ativos (commit pequeno e separado, Tarefa 6) | `.context/pendencias.md` P26 |

---

## Estrutura de arquivos

```
drizzle/0003_fase3_passagem.sql                         (gerar)  + drizzle/meta/0003_snapshot.json, _journal.json      [1]
src/db/schema/handovers.ts                              (criar)  handover, handoverItem, handoverCorrection            [1]
src/db/schema/index.ts                                  (modificar) + export handovers                                 [1]
src/db/schema/handovers.test.ts                         (criar)                                                        [1]
src/db/schema/migration0003.test.ts                     (criar)                                                        [1]
test/db.ts                                              (modificar) TABLES + handover, handover_item, handover_correction [1]
test/fixtures.ts                                        (modificar) insertHandover, insertHandoverItem, insertHandoverCorrection; insertShift(createdAt) [1]
test/clock.ts                                           (criar)  spDate                                                [1]
src/features/handovers/limits.ts                        (criar)  constantes                                            [2]
src/features/handovers/types.ts                         (criar)  tipos compartilhados (client-safe)                    [2]
src/features/handovers/saoPaulo.ts                      (criar)                                                        [2]
src/features/handovers/shiftSuggestion.ts               (criar)                                                        [2]
src/features/handovers/quantity.ts                      (criar)                                                        [2]
src/features/handovers/fieldRules.ts                    (criar)  normalização e limites dos campos                     [2]
src/features/handovers/access.ts                        (criar)  handoverCapabilities, formModeOf                      [2]
src/features/handovers/diff.ts                          (criar)  diffHandover, rótulos de correção                     [2]
src/features/handovers/status.ts                        (criar)  situações, rótulos                                    [2]
src/features/handovers/historyFilters.ts                (criar)                                                        [2]
src/features/handovers/urls.ts                          (criar)  newHandoverHref, handoverHref                         [2]
src/features/handovers/sectorChoice.ts                  (criar)  resolveHandoverSector (puro)                          [2]
src/features/handovers/messages.ts                      (criar)                                                        [2]
src/features/handovers/*.test.ts                        (criar)  um teste por módulo puro                              [2]
src/features/admin/result.ts                            (modificar) + 10 códigos em AdminErrorCode                     [3]
src/features/handovers/schemas.ts                       (criar)  schemas Zod das actions                               [3]
src/features/handovers/runHandoverAction.ts             (criar)  server-only                                           [3]
test/actionGuards.ts                                    (criar)  helper de varredura extraído de admin/actionsAuth     [3]
src/app/(app)/admin/actionsAuth.test.ts                 (modificar) usa test/actionGuards.ts (refatoração isolada)     [3]
src/app/actionsGuards.test.ts                           (criar)  guarda de toda action e de "use server" solto         [3, 7, 8]
src/app/appPagesAuth.test.ts                            (modificar) admin/ exige requireAdmin; rotas e mínimo           [3, 8, 9, 10]
src/features/handovers/loaders.ts                       (criar)  server-only: loadSector, findHandoverByRef, lockHandover… [4]
src/features/handovers/targets.ts                       (criar)  server-only: listActiveShifts                         [4]
src/features/handovers/formState.ts                     (criar)  server-only                                           [4]
src/features/handovers/draft.ts                         (criar)  server-only: saveHandoverField                        [4]
src/features/handovers/deliver.ts                       (criar)  server-only                                           [4]
src/features/handovers/confirm.ts                       (criar)  server-only                                           [5]
src/features/handovers/summary.ts                       (criar)  server-only                                           [5]
src/features/handovers/correction.ts                    (criar)  server-only                                           [5]
src/features/handovers/history.ts                       (criar)  server-only                                           [6]
src/features/handovers/home.ts                          (criar)  server-only                                           [6]
src/features/admin/overview.ts                          (modificar) só setores ativos (P26)                            [6]
src/features/handovers/sectorCookie.ts                  (criar)  server-only: readRememberedSector, rememberSector     [7]
src/app/(app)/actions.ts                                (criar)  chooseSectorAction                                    [7]
src/components/passagens/SectorPicker.tsx               (criar)  client                                                [7]
src/components/passagens/HomeHandovers.tsx              (criar)  server (async)                                        [7]
src/components/passagens/PendingHandoverCard.tsx        (criar)  server-safe                                           [7]
src/components/passagens/MyShiftCard.tsx                (criar)  server-safe                                           [7]
src/components/passagens/HandoverStatusBadge.tsx        (criar)  server-safe                                           [7]
src/components/app-shell/navItems.ts                    (modificar) + Passagens                                        [7]
src/components/app-shell/Greeting.tsx                   (modificar) 2º parágrafo                                       [7]
src/app/(app)/page.tsx                                  (modificar) searchParams + HomeHandovers                       [7]
src/components/passagens/useHandoverAutosave.ts         (criar)  client                                                [8]
src/components/passagens/AutosaveIndicator.tsx          (criar)  client                                                [8]
src/components/passagens/QuantityCounter.tsx            (criar)  client                                                [8]
src/components/passagens/ItemLineField.tsx              (criar)  client                                                [8]
src/components/passagens/HandoverFields.tsx             (criar)  client (apresentação, sem estado)                     [8]
src/components/passagens/HandoverHeader.tsx             (criar)  client                                                [8]
src/components/passagens/HandoverForm.tsx               (criar)  client                                                [8]
src/components/passagens/NewHandover.tsx                (criar)  server (async)                                        [8]
src/app/(app)/passagens/actions.ts                      (criar)  saveHandoverFieldAction, deliverHandoverAction [8]; confirmHandoverAction [9]; correctHandoverAction [11] [8, 9, 11]
src/app/(app)/passagens/nova/page.tsx                   (criar)                                                        [8]
src/components/passagens/HandoverDetail.tsx             (criar)  server (async)                                        [9, 11]
src/components/passagens/SummaryItemList.tsx            (criar)  server-safe                                           [9]
src/components/passagens/CorrectionsTimeline.tsx        (criar)  server-safe                                           [9]
src/components/passagens/ConfirmReceiptForm.tsx         (criar)  client                                                [9]
src/app/(app)/passagens/[id]/page.tsx                   (criar)                                                        [9, 11]
src/components/passagens/HandoverHistory.tsx            (criar)  server (async)                                        [10]
src/components/passagens/HistoryFilters.tsx             (criar)  client                                                [10]
src/components/passagens/HistoryRowItem.tsx             (criar)  server-safe                                           [10]
src/app/(app)/passagens/page.tsx                        (criar)                                                        [10]
src/components/passagens/CorrectionForm.tsx             (criar)  client                                                [11]
e2e/db.ts                                               (modificar) + insertShift, insertItem, insertHandover…, handoverOf [12]
e2e/passagem.spec.ts                                    (criar)                                                        [12]
.context/{progress-tracker,ui-registry,pendencias,architecture,library-docs,build-plan,code-standards}.md (modificar)   [13]
memory.md                                               (modificar)                                                    [13]
```

Os números entre colchetes são as tarefas que criam ou mudam o arquivo. Arquivos de teste (`*.test.ts[x]`) ficam ao lado do código e aparecem na lista **Files** de cada tarefa. `src/proxy.ts` **não muda** (toda rota nova exige sessão e nenhuma é pública). `SectorSwitcher`, `Pagination`, `ChoiceGroup`, `SelectField`, `EmptyState`, `AdminListRow`, `useAdminAction` **não mudam** e são reaproveitados.

---

## Contrato de interfaces

Toda tarefa usa **exatamente** estes nomes e assinaturas. Uma tarefa que precise de algo fora daqui o declara no bloco **Interfaces → Produces** dela. Componentes de cliente importam dos módulos de domínio **só tipos** (`import type`) e dos módulos puros (`limits`, `types`, `quantity`, `fieldRules`, `saoPaulo`, `urls`, `status`, `diff`); nunca de módulo `server-only`.

### Dependências

Nenhuma nova. Primitivos shadcn já presentes e usados: `Button`, `Input`, `Textarea`, `Field*`, `Card`, `Badge`, `Alert`, `Skeleton`, `Tooltip`, `ToggleGroup`, `NativeSelect`, `Separator`.

### Schema (`src/db/schema/handovers.ts`, migração `0003_fase3_passagem`)

```ts
export const HANDOVER_STATUSES = ["draft", "delivered", "confirmed"] as const;
export type HandoverStatus = (typeof HANDOVER_STATUSES)[number];
export const CORRECTION_FIELDS = ["occurrences_text", "next_shift_text", "item_quantity", "item_note"] as const;
export type CorrectionField = (typeof CORRECTION_FIELDS)[number];
// src/db/schema/index.ts reexporta ./handovers
```

- `handover`: `id uuid pk defaultRandom` · `sectorId uuid not null FK sector (restrict)` (`sector_id`) · `shiftId uuid not null FK shift (restrict)` (`shift_id`) · `operationalDate date({ mode: "string" }) not null` (`operational_date`) · `status text enum HANDOVER_STATUSES not null default 'draft'` · `shiftNameSnapshot text` (`shift_name_snapshot`) · `occurrencesText text not null default ''` (`occurrences_text`) · `nextShiftText text not null default ''` (`next_shift_text`) · `deliveredBy text FK user (restrict)` (`delivered_by`) · `deliveredAt timestamptz` · `confirmedBy text FK user (restrict)` · `confirmedAt timestamptz` · `confirmationNote text` (`confirmation_note`) · `updatedBy text FK user (restrict)` (`updated_by`) · `createdAt timestamptz not null default now` · `updatedAt timestamptz not null default now`.
  - Índices: `uniqueIndex("handover_sector_shift_date_uq").on(sectorId, shiftId, operationalDate)` · `index("handover_sector_date_idx").on(sectorId, operationalDate)` · `index("handover_shift_id_idx")` · `index("handover_delivered_by_idx")` · `index("handover_confirmed_by_idx")` · `index("handover_updated_by_idx")`.
  - `CHECK`s: `handover_status_valid` (`status in ('draft','delivered','confirmed')`) · `handover_confirmer_ne_deliverer` (`confirmed_by is null or confirmed_by <> delivered_by`) · `handover_state_consistent` (as três combinações de F3-1).
- `handover_item`: `handoverId uuid not null FK handover (restrict)` · `itemId uuid not null FK item (restrict)` · `quantity integer not null default 0` · `note text` · `itemNameSnapshot text` · `itemUnitSnapshot text` · `itemKindSnapshot text enum ITEM_KINDS` (colunas `item_name_snapshot`, `item_unit_snapshot`, `item_kind_snapshot`). `primaryKey({ columns: [handoverId, itemId] })` · `index("handover_item_item_id_idx")` · `CHECK handover_item_quantity_nonneg (quantity >= 0)` · `CHECK handover_item_kind_snapshot_valid (null ou 'control'/'stock')`.
- `handover_correction`: `id uuid pk` · `handoverId uuid not null FK handover (restrict)` · `field text enum CORRECTION_FIELDS not null` · `itemId uuid FK item (restrict)` · `oldValue text not null` · `newValue text not null` · `reason text not null` · `correctedBy text not null FK user (restrict)` · `correctedAt timestamptz not null default now`. Índices `handover_correction_handover_idx (handover_id, corrected_at)`, `handover_correction_item_id_idx`, `handover_correction_corrected_by_idx`. `CHECK`s `handover_correction_field_valid`, `handover_correction_item_matches_field` (`(field in ('item_quantity','item_note')) = (item_id is not null)`), `handover_correction_reason_not_blank` (`char_length(btrim(reason)) > 0`).

### Constantes — `src/features/handovers/limits.ts` (sem I/O; importável no cliente)

```ts
export const MAX_QUANTITY = 99_999;
export const TEXT_MAX_LENGTH = 2000;              // Ocorrências e Fica para o próximo turno
export const ITEM_NOTE_MAX_LENGTH = 200;
export const CONFIRMATION_NOTE_MAX_LENGTH = 500;
export const REASON_MAX_LENGTH = 500;
export const MAX_DAYS_BACK = 31;                  // F3-8b
export const HISTORY_MAX_DAYS = 93;
export const HISTORY_DEFAULT_DAYS = 7;
export const AUTOSAVE_DEBOUNCE_MS = 800;
export const SECTOR_COOKIE = "closery_setor";
export const SECTOR_COOKIE_MAX_AGE_SECONDS = 31_536_000;
export const ALL_SECTORS = "todos";               // valor de ?setor= no histórico do admin
export const NEXT_SHIFT_PREVIEW_LENGTH = 200;     // trecho no cartão do Início
```

### Tipos compartilhados — `src/features/handovers/types.ts` (sem I/O)

```ts
import type { ItemKind } from "@/lib/itemKinds";

export type HandoverRef = { sectorId: string; shiftId: string; operationalDate: string }; // "YYYY-MM-DD"
export type ShiftChoice = { id: string; name: string; startsAt: string; endsAt: string };  // "HH:mm"
export type FormMode = "draft" | "edit" | "correction";
export type ItemLine = { itemId: string; name: string; unit: string; kind: ItemKind; quantity: number; note: string }; // note "" = sem observação
export type FieldChange =
  | { field: "occurrences"; value: string }
  | { field: "nextShift"; value: string }
  | { field: "quantity"; itemId: string; value: number }
  | { field: "note"; itemId: string; value: string };
export type SaveFieldInput = HandoverRef & FieldChange;
export type FieldValues = {                       // estado controlado do formulário
  occurrencesText: string;
  nextShiftText: string;
  quantities: Record<string, number>;             // por itemId
  notes: Record<string, string>;                  // por itemId, "" = sem observação
};
export type SavedMark = { at: Date; byName: string };
```

### Fuso e datas — `src/features/handovers/saoPaulo.ts` (puro)

```ts
export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";
export function saoPauloParts(now: Date): { date: string; minutes: number };  // date "YYYY-MM-DD", minutes 0..1439 em hora de parede de São Paulo
export function todayInSaoPaulo(now: Date): string;                          // = saoPauloParts(now).date
export function isIsoDate(value: string): boolean;                           // formato E data real: "2026-02-30" → false
export function addDays(date: string, days: number): string;                 // "2026-11-30" + 1 → "2026-12-01"; aceita negativo
export function daysBetween(from: string, to: string): number;               // to − from, em dias inteiros (pode ser negativo)
export function isOperationalDateAllowed(date: string, now: Date): boolean;  // isIsoDate e hoje − MAX_DAYS_BACK ≤ date ≤ hoje
export function formatTimeBR(date: Date): string;                            // "14:05", São Paulo
export function formatDateBR(isoDate: string): string;                       // "2026-11-21" → "21/11/2026" (só reformata o texto)
// Comentário obrigatório no código: o cálculo compara hora de parede em São Paulo (sem somar offset fixo); o Brasil não tem horário de verão desde 2019.
```

### Turno sugerido — `src/features/handovers/shiftSuggestion.ts` (puro)

```ts
export type SuggestableShift = { id: string; startsAt: string; endsAt: string }; // "HH:mm"; chega na ordem da lista do setor (sort_order, created_at, id)
export type HandoverTarget = { shiftId: string; operationalDate: string };
export function shiftEnd(operationalDate: string, shift: SuggestableShift): { date: string; minutes: number };
// fim em hora de parede: dia = operationalDate (+1 se atravessa a meia-noite), minutes = minutos de endsAt
export function hasShiftEnded(operationalDate: string, shift: SuggestableShift, now: Date): boolean;
// fim ≤ agora (fim == agora conta como encerrado; mesma regra do SQL de pares encerrados)
export function suggestShift(shifts: readonly SuggestableShift[], now: Date): HandoverTarget | null; // F3-8; [] → null
export function resolveHandoverTarget(
  shifts: readonly SuggestableShift[],
  now: Date,
  requested: { shiftId?: string | string[]; date?: string | string[] },
): (HandoverTarget & { suggested: boolean }) | null;
// turno E data válidos (shiftId na lista; isOperationalDateAllowed) → { …, suggested: false }; qualquer outra coisa → sugestão com suggested: true; sem turnos → null
```

### Quantidade e campos — `quantity.ts`, `fieldRules.ts` (puros)

```ts
// quantity.ts
export function sanitizeQuantityInput(raw: string): string;       // só dígitos, sem zeros à esquerda ("007" → "7"), no máximo 5 dígitos; "" fica ""
export function parseQuantity(raw: string): number | null;        // "" → null; "12" → 12; acima de MAX_QUANTITY → MAX_QUANTITY
export function stepQuantity(value: number, delta: 1 | -1): number; // trava em 0 e em MAX_QUANTITY
export function formatQuantity(value: number): string;            // pt-BR: 1234 → "1.234"

// fieldRules.ts
export function codePointLength(value: string): number;           // conta pontos de código, não unidades UTF-16
export function normalizeFreeText(raw: string): string;           // NFC + "\r\n"/"\r" → "\n"; sem trim
export function normalizeItemNote(raw: string): string | null;    // NFC + espaços colapsados + trim; vazio → null
export function normalizeOptionalText(raw: string): string | null;// NFC + "\r\n" → "\n" + trim; vazio → null (observação do recebimento)
export function normalizeReason(raw: string): string;             // NFC + "\r\n" → "\n" + trim (pode sobrar "")
export function validateFieldChange(change: FieldChange):
  | { ok: true; change: FieldChange }                              // valor normalizado (nota: "" no lugar de null)
  | { ok: false; message: string };
// quantity: inteiro 0..MAX_QUANTITY, senão QUANTITY_MESSAGE; occurrences/nextShift: ≤ TEXT_MAX_LENGTH, senão TEXT_TOO_LONG_MESSAGE; note: ≤ ITEM_NOTE_MAX_LENGTH, senão NOTE_TOO_LONG_MESSAGE
```

### Permissões — `access.ts` (puro)

```ts
export type HandoverCapabilities = {
  canView: boolean;                // canAccessSector(actor, sectorId)
  canEditDirectly: boolean;        // rascunho: canView; entregue: admin OU quem entregou; confirmada: false
  canDeliver: boolean;             // status draft && canView
  canConfirm: boolean;             // status delivered && canView && deliveredBy !== actor.userId
  canCorrectWithReason: boolean;   // status confirmed && admin
};
export function handoverCapabilities(
  actor: Authz,
  handover: { status: HandoverStatus; sectorId: string; deliveredBy: string | null },
): HandoverCapabilities;
export function formModeOf(status: HandoverStatus | null, capabilities: HandoverCapabilities): FormMode | null;
// null/draft + canEditDirectly → "draft"; delivered + canEditDirectly → "edit"; confirmed + canCorrectWithReason → "correction"; senão null
```

### Correção — `diff.ts` (puro)

```ts
export type HandoverValues = {
  occurrencesText: string;
  nextShiftText: string;
  items: readonly { itemId: string; quantity: number; note: string | null }[];
};
export type CorrectionChange = { field: CorrectionField; itemId: string | null; oldValue: string; newValue: string };
export function diffHandover(current: HandoverValues, next: HandoverValues): CorrectionChange[];
// ordem: occurrences_text, next_shift_text, depois cada item de `current` na ordem recebida: item_quantity, item_note; textos comparados após normalizeFreeText; nota null == ""; quantidade vira String(n); item ausente em `next` = inalterado; item só em `next` é ignorado (o domínio recusa antes)
export function correctionFieldLabel(field: CorrectionField, itemName: string | null): string;
// "Ocorrências do turno" · "Fica para o próximo turno" · `${itemName}: quantidade` · `${itemName}: observação`
export function displayCorrectionValue(value: string): string; // "" → "(vazio)"
```

### Situações — `status.ts` (puro)

```ts
export const HISTORY_SITUATIONS = ["awaiting", "confirmed", "unconfirmed", "missing"] as const;
export type HistorySituation = (typeof HISTORY_SITUATIONS)[number];
export function situationLabel(situation: HistorySituation, confirmedByName?: string | null): string;
// awaiting "Aguardando recebimento" · confirmed `Confirmada por ${nome}` (sem nome: "Confirmada") · unconfirmed "Não confirmada" · missing "Sem passagem"
export const CORRECTED_LABEL = "Corrigida";
export const STATUS_DESCRIPTION: Readonly<Record<HandoverStatus, string>>; // draft "Rascunho" · delivered "Entregue" · confirmed "Confirmada"
```

### Filtros do histórico — `historyFilters.ts` (puro)

```ts
export type HistoryPeriod = "7" | "30" | "range";
export type HistorySituationFilter = "all" | HistorySituation | "corrected";
export const SITUATION_PARAM: Readonly<Record<HistorySituationFilter, string>>;
// all "todas" · awaiting "aguardando" · confirmed "confirmada" · unconfirmed "nao-confirmada" · missing "sem-passagem" · corrected "corrigida"
export type HistoryFilters = { period: HistoryPeriod; from: string; to: string; shiftId: string | null; situation: HistorySituationFilter };
export function parseHistoryFilters(params: Record<string, string | string[] | undefined>, today: string): HistoryFilters;
// periodo: "7" (padrão) → [hoje−6, hoje]; "30" → [hoje−29, hoje]; "intervalo" → `de`/`ate` válidos (isIsoDate), `ate` ≤ hoje (um `ate` futuro é cortado em hoje; intervalo todo no futuro ou incompleto cai em "7"), `de`/`ate` invertidos são trocados, extensão máxima HISTORY_MAX_DAYS (mais de 93 dias corta o `de`); intervalo inválido ou ausente cai em "7"; parâmetro de URL repetido vale o primeiro valor; `turno` só se for uuid; `situacao` desconhecida → "all"
export function buildHistoryHref(filters: HistoryFilters, extras?: { sector?: string; page?: number }): string;
// "/passagens?periodo=…&de=…&ate=…&turno=…&situacao=…&setor=…&pagina=…": omite o que é padrão (período 7, situação todas, turno nulo, página 1); `de`/`ate` só em "range"
```

### Links — `urls.ts` (puro)

```ts
export function newHandoverHref(ref: HandoverRef, sector?: string): string;
// `/passagens/nova?turno=${shiftId}&data=${operationalDate}` + (sector ? `&setor=${sector}` : "")
export function handoverHref(id: string, options?: { edit?: boolean }): string; // `/passagens/${id}` ou `/passagens/${id}?editar=1`
export function chooseSectorPath(path: SectorPickerPath, sectorId: string): string; // `${path}?setor=${sectorId}`
export const SECTOR_PICKER_PATHS = ["/", "/passagens", "/passagens/nova"] as const;
export type SectorPickerPath = (typeof SECTOR_PICKER_PATHS)[number];
```

### Escolha de setor — `sectorChoice.ts` (puro)

```ts
export type SectorSelection = { kind: "sector"; sector: SectorChoice } | { kind: "all" } | { kind: "none" };
export function resolveHandoverSector(
  sectors: readonly SectorChoice[],                                  // só ativos, lower(name)
  sources: { url: string | string[] | undefined; cookie: string | undefined },
  options?: { allowAll?: boolean },                                  // padrão false
): SectorSelection;
// ordem: url "todos" (se allowAll) → all · url na lista → ele · cookie na lista → ele · primeiro da lista · lista vazia → none
// Operador não usa esta função: o setor dele é actor.sectorId (a página confere se está ativo).
```

### Mensagens — `messages.ts` (puro)

```ts
export const HANDOVER_NOT_FOUND_MESSAGE: string;       // "Passagem não encontrada. Atualize a página."
export const SECTOR_INACTIVE_HANDOVER_MESSAGE: string; // "Este setor está inativo. Peça a um administrador para reativá-lo."
export const SHIFT_INACTIVE_MESSAGE: string;           // "Este turno está inativo. Escolha outro turno."
export const DATE_OUT_OF_RANGE_MESSAGE: string;        // "Escolha uma data de hoje ou dos últimos 31 dias."
export const EDIT_FORBIDDEN_MESSAGE: string;           // "Só quem entregou o turno ou um administrador pode editar esta passagem."
export const HANDOVER_LOCKED_MESSAGE: string;          // "Esta passagem já foi confirmada. Só um administrador corrige, com motivo."
export const NOT_DELIVERED_MESSAGE: string;            // "Esta passagem ainda não foi entregue."
export const OWN_HANDOVER_MESSAGE: string;             // "Quem entregou o turno não pode confirmar o recebimento. Peça a outra pessoa do setor."
export const NOT_CONFIRMED_MESSAGE: string;            // "Só passagens confirmadas passam pela correção com motivo. Edite a passagem direto."
export const CORRECTION_FORBIDDEN_MESSAGE: string;     // "Só um administrador pode corrigir uma passagem confirmada."
export const NO_CHANGES_MESSAGE: string;               // "Nada foi alterado. Mude algum campo para registrar a correção."
export const REASON_REQUIRED_MESSAGE: string;          // "Informe o motivo da correção."
export const REASON_TOO_LONG_MESSAGE: string;          // "O motivo pode ter no máximo 500 caracteres."
export const QUANTITY_MESSAGE: string;                 // "Informe um número inteiro de 0 a 99.999."
export const TEXT_TOO_LONG_MESSAGE: string;            // "O texto pode ter no máximo 2.000 caracteres."
export const NOTE_TOO_LONG_MESSAGE: string;            // "A observação pode ter no máximo 200 caracteres."
export const CONFIRMATION_NOTE_TOO_LONG_MESSAGE: string; // "A observação pode ter no máximo 500 caracteres."
export const INVALID_DATE_MESSAGE: string;             // "Data inválida."
export const DUPLICATE_ITEM_MESSAGE: string;           // "Item repetido. Atualize a página."
export const UNSAVED_DELIVER_MESSAGE: string;          // "Há alterações sem salvar. Toque em “Tentar de novo” e entregue de novo." (usada em HandoverForm)
export const SWITCH_FAILED_MESSAGE: string;            // "Não foi possível salvar. Tente de novo antes de trocar de turno." (usada em HandoverHeader)
export function alreadyDeliveredMessage(deliveredByName: string, deliveredAt: Date): string; // "Esta passagem já foi entregue por {nome} às {HH:mm}."
export function alreadyConfirmedMessage(confirmedByName: string, confirmedAt: Date): string; // "Esta passagem já foi confirmada por {nome} às {HH:mm}."
// o "às HH:mm" usa formatTimeBR
```

### Resultado e códigos — `src/features/admin/result.ts` (modificar, aditivo)

`AdminErrorCode` ganha, **sem renomear nada**:

```ts
  | "SHIFT_INACTIVE" | "DATE_OUT_OF_RANGE" | "FORBIDDEN" | "HANDOVER_LOCKED"
  | "ALREADY_DELIVERED" | "NOT_DELIVERED" | "ALREADY_CONFIRMED" | "OWN_HANDOVER"
  | "NOT_CONFIRMED" | "NO_CHANGES"
```

Uso: `NOT_FOUND` = setor, turno, item ou passagem inexistente **ou fora do escopo** (mensagem `notFoundMessage(...)` de `src/features/admin/messages.ts` para setor/turno/item e `HANDOVER_NOT_FOUND_MESSAGE` para passagem); `SECTOR_INACTIVE` = `SECTOR_INACTIVE_HANDOVER_MESSAGE`; `INVALID_INPUT` com `fieldErrors` para valores fora dos limites (campo `value`, `reason`, `note`, `items`).

### Schemas Zod — `src/features/handovers/schemas.ts` (sem `server-only`; mesmo schema no cliente e no servidor)

```ts
export const isoDateSchema: z.ZodString;                       // isIsoDate; erro INVALID_DATE_MESSAGE
export const handoverRefSchema = z.object({ sectorId: idSchema, shiftId: idSchema, operationalDate: isoDateSchema });
export const saveFieldSchema = z.discriminatedUnion("field", [
  handoverRefSchema.extend({ field: z.literal("occurrences"), value: z.string() }),
  handoverRefSchema.extend({ field: z.literal("nextShift"),   value: z.string() }),
  handoverRefSchema.extend({ field: z.literal("quantity"),    itemId: idSchema, value: z.number() }),
  handoverRefSchema.extend({ field: z.literal("note"),        itemId: idSchema, value: z.string() }),
]).transform(…); // discriminatedUnion + transform (ZodPipe): validateFieldChange → erro no campo `value` com a mensagem dele (ctx.addIssue); a saída traz o valor normalizado
export const deliverHandoverSchema = handoverRefSchema;
export const confirmHandoverSchema = z.object({ id: idSchema, note: z.string() }); // note: normalizeOptionalText, ≤ CONFIRMATION_NOTE_MAX_LENGTH (erro em `note`); saída: note: string | null
export const correctHandoverSchema = z.object({
  id: idSchema,
  reason: z.string(),                                           // normalizeReason; "" → REASON_REQUIRED_MESSAGE; > 500 → REASON_TOO_LONG_MESSAGE (erro em `reason`)
  occurrencesText: z.string(), nextShiftText: z.string(),       // ≤ TEXT_MAX_LENGTH
  items: z.array(z.object({ itemId: idSchema, quantity: z.number().int().min(0).max(MAX_QUANTITY), note: z.string() })).max(CHOICE_LIST_LIMIT), // itemId repetido → DUPLICATE_ITEM_MESSAGE em `items`; note: normalizeItemNote ≤ 200
});
export const chooseSectorSchema = z.object({ sectorId: z.union([idSchema, z.literal(ALL_SECTORS)]), path: z.enum(SECTOR_PICKER_PATHS) });
// tipos (z.infer, como em features/admin/schemas.ts): SaveFieldInputParsed (a saída do transform), DeliverHandoverInput, ConfirmHandoverInput, CorrectHandoverInput, ChooseSectorInput
// fieldErrors da correção: `reason`, `occurrencesText`, `nextShiftText`, `items`
```

### `src/features/handovers/runHandoverAction.ts` (`server-only`)

```ts
export async function runHandoverAction<S extends z.ZodType, T extends object = object>(args: {
  actor: Authz;
  schema: S;
  input: unknown;
  revalidate: boolean;   // false no salvamento automático; true em entregar, confirmar e corrigir
  run: (ctx: { db: Db; now: Date; actor: Authz; input: z.output<S> }) => Promise<AdminResult<T>>;
}): Promise<AdminResult<T>>;
```
Fluxo idêntico ao `runAdminAction` (F3-13): `safeParse` → `INVALID_INPUT` com a 1ª mensagem do campo e `firstFieldErrors` · `run` · exceção: `unstable_rethrow(error)` e depois `console.error` + `fail("INTERNAL", INTERNAL_ERROR_MESSAGE)` · se `ok && revalidate` → `revalidatePath("/(app)", "layout")`. Nunca devolve texto do banco.

### Guardas — `test/actionGuards.ts` e `src/app/actionsGuards.test.ts`

```ts
// test/actionGuards.ts (extraído de admin/actionsAuth.test.ts; mesmo comportamento)
export type GuardName = "requireAdmin" | "requireUser";
export function stripComments(source: string): string;
export function actionsMissingGuard(source: string, allowed: readonly GuardName[]): string[];
// nomes de toda `export async function` cujo corpo não começa por `await <guarda>()` (com ou sem `const x =`) e de todo export de runtime que não seja `export async function`; [] = ok
export function startsWithUseServer(source: string): boolean;
export function hasUseServerDirective(source: string): boolean; // diretiva de arquivo OU inline (`"use server"` dentro de função), comentários removidos
export function listSourceFiles(dir: string, filter: (name: string) => boolean): string[];

// src/app/actionsGuards.test.ts exige:
// (1) todo arquivo de src/ com hasUseServerDirective é `actions.ts` sob `src/app/(app)/`, ou está em AUTH_ACTION_FILES = ["src/app/(auth)/convite/[token]/actions.ts"];
// (2) sob (app)/admin: actionsMissingGuard(source, ["requireAdmin"]) = [];  sob (app) fora do admin: ["requireUser", "requireAdmin"];
// (3) começa com "use server"; (4) MIN_ADMIN_ACTION_FILES = 5 e MIN_APP_ACTION_FILES = 0 na Tarefa 3, 1 na 7, 2 na 8
// a varredura cobre todo .ts/.tsx de src que **não** seja `*.test.ts[x]`; actionsGuards.test.ts exporta `AUTH_ACTION_FILES` e `actionFileProblems(path, source): string[]`
// casos negativos: action sem guarda; guarda só em comentário; "use server" inline em arquivo que não é actions.ts; arquivo fora de (app)
```
`src/app/(app)/admin/actionsAuth.test.ts` passa a importar de `test/actionGuards.ts` e continua exportando `actionsMissingAdminGuard = (s) => actionsMissingGuard(s, ["requireAdmin"])` (os casos dele não mudam).

`appPagesAuth.test.ts`: `pageCallsAuthGuard(pageSource, readComponent, accepted = ["requireUser", "requireAdmin"])`; as páginas sob `admin/` passam `["requireAdmin"]`; lista de rotas esperadas ganha `passagens/page.tsx`, `passagens/nova/page.tsx`, `passagens/[id]/page.tsx`; mínimo de páginas 9 → 12 (a Tarefa 10 sobe o número; as rotas de `/passagens` vivem num `it("inclui a página de cada rota de /passagens")` criado na Tarefa 8, e cada tarefa de página acrescenta a sua a essa lista).

### Carregadores internos — `src/features/handovers/loaders.ts` (`server-only`)

```ts
export type SectorRow = { id: string; name: string; active: boolean };
export type HandoverRow = typeof handover.$inferSelect;
export async function loadSector(db: Db, actor: Authz, sectorId: string): Promise<SectorRow | null>;
// null se o setor não existe OU o operador não pode acessá-lo (canAccessSector)
export async function findHandoverByRef(db: Db, ref: HandoverRef): Promise<HandoverRow | null>;
export async function findHandoverById(db: Db, actor: Authz, id: string): Promise<HandoverRow | null>; // null se não existe ou fora do escopo
export async function lockHandover(tx: Db, id: string): Promise<HandoverRow | null>;                    // SELECT … FOR UPDATE
export async function userNames(db: Db, ids: readonly string[]): Promise<Map<string, string>>;         // id → nome (vazio em ids vazios, sem consulta)
export async function ensureHandover(
  tx: Db, actor: Authz, ref: HandoverRef, now: Date,
): Promise<AdminResult<{ row: HandoverRow; created: boolean }>>;
// dentro da transação do chamador: (1) setor via loadSector → NOT_FOUND; setor inativo → SECTOR_INACTIVE (setor inativo é só leitura: vale também com a linha já existente); (1b) data que não passa em isIsoDate → DATE_OUT_OF_RANGE; (2) se a linha da tripla já existe → trava e devolve (created:false), sem revalidar turno nem data; (3) senão exige: turno do setor (NOT_FOUND notFoundMessage("turno")) e ativo (SHIFT_INACTIVE), isOperationalDateAllowed (DATE_OUT_OF_RANGE); INSERT … ON CONFLICT DO NOTHING RETURNING; sem linha devolvida → SELECT … FOR UPDATE da existente
export async function runInTransaction<T extends object>(db: Db, work: (tx: Db) => Promise<AdminResult<T>>): Promise<AdminResult<T>>;
// db.transaction() em que `work` devolver ok:false DESFAZ tudo e devolve a falha intacta; obrigatório quando há escrita antes de uma falha esperada (draft e deliver); confirmHandover e correctHandover usam db.transaction() nu, porque toda recusa deles vem antes da 1ª escrita
```

### Domínio — leitura do formulário (`targets.ts`, `formState.ts`) — Tarefa 4

```ts
// targets.ts
export async function listActiveShifts(db: Db, sectorId: string): Promise<ShiftChoice[]>;
// turnos ativos de setor ativo, ORDER BY sort_order, created_at, id, até CHOICE_LIST_LIMIT, horários "HH:mm" (fromDbTime)

// formState.ts
export type HandoverFormState = {
  ref: HandoverRef;
  handoverId: string | null;            // null = ainda não existe rascunho (nada salvo)
  status: HandoverStatus | null;        // null junto com handoverId null
  sectorName: string;
  shiftName: string;
  occurrencesText: string;
  nextShiftText: string;
  controls: ItemLine[];                 // kind "control", por item.sort_order
  stock: ItemLine[];                    // kind "stock"
  saved: SavedMark | null;              // updated_at + nome de updated_by (null se não existe linha)
  deliveredByName: string | null;
  deliveredAt: Date | null;
  mode: FormMode | null;                // F3-4/F3-16; null = a pessoa não pode editar (a página mostra o resumo)
};
export async function getHandoverFormState(db: Db, actor: Authz, ref: HandoverRef, now: Date): Promise<AdminResult<{ state: HandoverFormState }>>;
export async function getHandoverFormStateById(db: Db, actor: Authz, id: string): Promise<AdminResult<{ state: HandoverFormState }>>;
```
`getHandoverFormState`: setor via `loadSector` (`NOT_FOUND`; inativo → `SECTOR_INACTIVE`), turno do setor (`NOT_FOUND`); sem linha, a combinação precisa poder ser criada: turno inativo → `SHIFT_INACTIVE`; data fora de `isOperationalDateAllowed` ou que não seja ISO → `DATE_OUT_OF_RANGE`; sem linha: valores padrão (`0`, `""`) e `mode: "draft"`; **nunca escreve**. Itens: com linha em `draft`/inexistente → **itens ativos do setor** (`LEFT JOIN handover_item`), quantidade `0` e nota `""` quando não há linha; com `delivered`/`confirmed` → as **linhas** de `handover_item` com `coalesce(snapshot, cadastro vivo)`. `getHandoverFormStateById`: `findHandoverById` (`NOT_FOUND`), mesmo corpo, `shiftName` = `shift_name_snapshot ?? shift.name`.

### Domínio — salvar e entregar (`draft.ts`, `deliver.ts`) — Tarefa 4

```ts
export type SavedField = { handoverId: string; savedAt: Date; savedByName: string };
export async function saveHandoverField(db: Db, actor: Authz, input: SaveFieldInput, now: Date): Promise<AdminResult<SavedField>>;
export type Delivered = { id: string; deliveredAt: Date };
export async function deliverHandover(db: Db, actor: Authz, ref: HandoverRef, now: Date): Promise<AdminResult<Delivered>>;
```
`saveHandoverField` (uma transação): `ensureHandover` → `capabilities = handoverCapabilities(actor, row)`; `confirmed` → `HANDOVER_LOCKED` (**inclusive admin**); `!canEditDirectly` → `FORBIDDEN` (`EDIT_FORBIDDEN_MESSAGE`) → `validateFieldChange` (revalida; `INVALID_INPUT` com `fieldErrors.value`) → texto: `UPDATE handover SET occurrences_text|next_shift_text`; quantidade/nota: item do setor (`NOT_FOUND` `notFoundMessage("item")`; em `draft` o item precisa estar **ativo**; em `delivered` precisa já ter linha) e `INSERT … ON CONFLICT (handover_id, item_id) DO UPDATE SET quantity|note` (em `delivered` só `UPDATE` da linha existente) → `UPDATE handover SET updated_at = now, updated_by = actor.userId` → `ok({ handoverId, savedAt: now, savedByName: actor.name })`.
`deliverHandover` (uma transação): `ensureHandover` → `status !== 'draft'` ou `UPDATE … WHERE id AND status='draft' RETURNING` sem linha → `fail("ALREADY_DELIVERED", alreadyDeliveredMessage(nome de delivered_by, delivered_at))` (relê a linha para o texto) → insere `handover_item (quantity 0)` dos itens **ativos** do setor sem linha (`INSERT … SELECT … ON CONFLICT DO NOTHING`) → `UPDATE handover_item` preenche `item_name_snapshot`, `item_unit_snapshot`, `item_kind_snapshot` de **todas** as linhas a partir de `item` → `ok({ id, deliveredAt: now })`. Quem pode: `canDeliver` (qualquer pessoa do setor, admin); senão `NOT_FOUND`.

### Domínio — confirmar, resumo e correção (`confirm.ts`, `summary.ts`, `correction.ts`) — Tarefa 5

```ts
export type Confirmed = { confirmedAt: Date };
export async function confirmHandover(db: Db, actor: Authz, input: { id: string; note: string | null }, now: Date): Promise<AdminResult<Confirmed>>;
// ordem de checagem: findHandoverById (NOT_FOUND) → setor inativo: SECTOR_INACTIVE (só leitura, P26) → draft: NOT_DELIVERED → confirmed: ALREADY_CONFIRMED (alreadyConfirmedMessage) → deliveredBy === actor.userId: OWN_HANDOVER → UPDATE … WHERE id AND status='delivered' AND delivered_by <> actor.userId RETURNING; 0 linhas → relê e devolve o código correspondente ao estado novo (ALREADY_CONFIRMED / OWN_HANDOVER)

export type SummaryItem = { itemId: string; name: string; unit: string; kind: ItemKind; quantity: number; note: string | null };
export type SummaryCorrection = { id: string; field: CorrectionField; itemName: string | null; oldValue: string; newValue: string; reason: string; correctedByName: string; correctedAt: Date };
export type HandoverSummary = {
  id: string;
  ref: HandoverRef;
  status: HandoverStatus;
  situation: "awaiting" | "confirmed" | "unconfirmed" | null;   // null em rascunho
  corrected: boolean;
  sectorName: string;
  shiftName: string;                                            // shift_name_snapshot ?? nome vivo
  nextShiftText: string;
  occurrencesText: string;
  highlighted: { controls: SummaryItem[]; stock: SummaryItem[] }; // quantity ≠ 0 OU note ≠ null; ordem item.sort_order
  zeroed: { count: number; names: string[] };                    // as demais linhas (quantity 0 e sem nota)
  deliveredByName: string | null; deliveredAt: Date | null;
  confirmedByName: string | null; confirmedAt: Date | null; confirmationNote: string | null;
  corrections: SummaryCorrection[];                              // corrected_at asc, id
  capabilities: HandoverCapabilities;
};
export async function getHandoverSummary(db: Db, actor: Authz, id: string): Promise<AdminResult<{ summary: HandoverSummary }>>;
// o resumo continua legível para setor inativo (P26 só recusa escrita); nomes e unidades vêm dos snapshots (coalesce com o cadastro vivo só no rascunho); correções com nome do item (snapshot da linha, senão cadastro)

export type CorrectionInput = {
  id: string; reason: string;
  occurrencesText: string; nextShiftText: string;
  items: { itemId: string; quantity: number; note: string }[];
};
export async function correctHandover(db: Db, actor: Authz, input: CorrectionInput, now: Date): Promise<AdminResult<{ changes: number }>>;
// ordem: findHandoverById (NOT_FOUND) → !admin: FORBIDDEN (CORRECTION_FORBIDDEN_MESSAGE) → setor inativo: SECTOR_INACTIVE (só leitura, P26) → motivo vazio/longo: INVALID_INPUT em `reason` → status ≠ confirmed (relido com FOR UPDATE): NOT_CONFIRMED → item fora da passagem: NOT_FOUND (notFoundMessage("item")) → diffHandover vazio: NO_CHANGES → UPDATEs + INSERT em handover_correction (corrected_by = actor.userId, corrected_at = now, reason) + UPDATE handover.updated_at/updated_by, tudo na mesma transação → ok({ changes })
```

### Domínio — histórico e Início (`history.ts`, `home.ts`) — Tarefa 6

```ts
export type HistoryRow = {
  key: string;                         // `${sectorId}:${shiftId}:${operationalDate}`
  operationalDate: string; shiftId: string; shiftName: string; sectorId: string; sectorName: string;
  handoverId: string | null;           // null em "missing"
  situation: HistorySituation;
  corrected: boolean;
  hasDraft: boolean;                   // só em "missing"
  deliveredByName: string | null; deliveredAt: Date | null;
  confirmedByName: string | null; confirmedAt: Date | null;
};
export async function listHandoverHistory(
  db: Db, actor: Authz,
  input: { filters: HistoryFilters; sectorId: string | null; page: number },  // sectorId null = todos (só admin; operador é forçado ao próprio setor, ignorando o valor)
  now: Date,
): Promise<Page<HistoryRow>>;
// ordem: operational_date desc, ends_local desc, sector_name, shift.sort_order, shift_id; PAGE_SIZE; página clampada (resolvePage); count(*) e página sobre o mesmo CTE; SQL de F3-9b

export type PendingHandover = {
  id: string; sectorName: string; shiftName: string; operationalDate: string;
  deliveredByName: string; deliveredAt: Date; nextShiftPreview: string | null; // nextShiftText com ≤ NEXT_SHIFT_PREVIEW_LENGTH pontos de código (corte + "…"); null se vazio
};
export type MyShiftState =
  | { kind: "no-shifts" }
  | { kind: "start" | "continue"; ref: HandoverRef; shift: ShiftChoice; saved: SavedMark | null }                        // continue = rascunho existe
  | { kind: "delivered" | "confirmed"; handoverId: string; ref: HandoverRef; shift: ShiftChoice; deliveredByName: string; deliveredAt: Date; confirmedByName: string | null; confirmedAt: Date | null };
export type HomeHandovers = { sector: { id: string; name: string }; pending: PendingHandover | null; mine: MyShiftState };
export async function getHomeHandovers(db: Db, actor: Authz, sectorId: string, now: Date): Promise<AdminResult<{ home: HomeHandovers }>>;
// sectorId via loadSector (NOT_FOUND; inativo → SECTOR_INACTIVE); pending = a passagem mais recente do setor entre status 'delivered' e 'confirmed' (delivered_at desc, id desc), só se estiver 'delivered' e delivered_by ≠ actor (uma confirmada mais nova esconde as entregues antigas; nunca cai para a anterior); mine = suggestShift(listActiveShifts, now) + findHandoverByRef
```
`getAdminOverviewCounts` (modificar): `shifts` e `items` contam só linhas de setores ativos (`EXISTS (select 1 from sector where id = shift.sector_id and active)`).

### Cookie e Server Actions

```ts
// src/features/handovers/sectorCookie.ts (server-only)
export async function readRememberedSector(): Promise<string | undefined>;   // (await cookies()).get(SECTOR_COOKIE)?.value; chame dentro de <Suspense>
export async function rememberSector(sectorId: string): Promise<void>;       // cookies().set(SECTOR_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: SECTOR_COOKIE_MAX_AGE_SECONDS }); só dentro de Server Action
```

| Arquivo | Função | Input (schema) | Retorno |
|---|---|---|---|
| `(app)/actions.ts` | `chooseSectorAction` | `chooseSectorSchema` | `Promise<AdminResult>` — só devolve falha; em sucesso faz `redirect(chooseSectorPath(path, sectorId))` (sector `todos` → `${path}?setor=todos` e **não** grava cookie); `requireAdmin()` na 1ª linha; setor precisa existir e estar ativo (`NOT_FOUND`/`SECTOR_INACTIVE`) |
| `(app)/passagens/actions.ts` | `saveHandoverFieldAction` | `saveFieldSchema` | `AdminResult<SavedField>` · `revalidate: false` |
| | `deliverHandoverAction` | `deliverHandoverSchema` | `AdminResult<Delivered>` · `revalidate: true` |
| | `confirmHandoverAction` | `confirmHandoverSchema` | `AdminResult<Confirmed>` · `revalidate: true` |
| | `correctHandoverAction` | `correctHandoverSchema` | `AdminResult<{ changes: number }>` · `revalidate: true` |

Cada função: `const actor = await requireUser();` (a de sector: `requireAdmin()`) como **primeira instrução** → `return runHandoverAction({ actor, schema, input, revalidate, run })`. `chooseSectorAction` não usa o runner: valida com `chooseSectorSchema.safeParse`, confere o setor, chama `rememberSector`, faz `redirect` **fora** de `try/catch`.

### Componentes de cliente e hooks (`src/components/passagens/*`)

Server-safe = sem `"use client"`.

```ts
// useHandoverAutosave.ts ("use client", arquivo .ts)
export type AutosaveStatus =
  | { kind: "idle" } | { kind: "saving" }                       // "saving" cobre aguardando o debounce, na fila e em voo
  | { kind: "saved"; at: Date } | { kind: "error"; message: string };
export type HandoverAutosave = {
  status: AutosaveStatus;
  lastSaved: SavedMark | null;                                  // começa em `initial`; atualiza a cada sucesso (byName do resultado)
  hasUnsaved: boolean;                                          // pendente, na fila, em voo ou com falha
  change(change: FieldChange): void;                            // agenda o campo (debounce AUTOSAVE_DEBOUNCE_MS por campo; mesmo campo troca o valor pendente)
  commit(field: FieldChange): void;                             // onBlur: envia já o campo (cancela o debounce dele)
  flush(): Promise<boolean>;                                    // envia tudo que está pendente e espera a fila esvaziar; true = nada ficou sem salvar
  retry(): void;                                                // reenvia o que falhou
};
export function useHandoverAutosave(options: {
  ref: HandoverRef;
  save: (input: SaveFieldInput) => Promise<AdminResult<SavedField>>;  // a action; injetável nos testes
  initial: SavedMark | null;
  debounceMs?: number;                                          // padrão AUTOSAVE_DEBOUNCE_MS
}): HandoverAutosave;
// regras: fila serial (uma requisição em voo); coalescência por chave de campo (`occurrences`, `nextShift`, `quantity:${itemId}`, `note:${itemId}`); falha (resultado ok:false ou exceção) → status error com a message (ou INTERNAL_ERROR_MESSAGE), mantém o payload e **para a fila** até retry(); `window` "online" → retry(); "beforeunload" registrado só enquanto hasUnsaved (preventDefault + returnValue ""); ao desmontar envia o pendente sem esperar; nunca lança

// AutosaveIndicator.tsx ("use client")
AutosaveIndicator(props: { status: AutosaveStatus; lastSaved: SavedMark | null; onRetry: () => void })
// <output aria-live="polite"> (papel status; o Biome reprova `div role="status"`); textos em "Textos de interface"; no estado error o botão "Tentar de novo" é <Button variant="outline" size="sm">

// QuantityCounter.tsx ("use client")
QuantityCounter(props: { label: string; unit: string; value: number; onChange: (value: number) => void; onCommit?: (value: number) => void; disabled?: boolean })
// <fieldset> + <legend className="sr-only">{label}</legend> (papel group; o Biome reprova `div role="group"`): botão − (aria-label `Diminuir ${label}`, tooltip "Diminuir", Minus), <Input inputMode="numeric" pattern="[0-9]*" maxLength={5} className="text-base tabular-nums text-center" aria-label={`Quantidade de ${label}`}>, botão + (aria-label `Aumentar ${label}`, tooltip "Aumentar", Plus), unidade em texto ao lado;
// − desabilita em 0, + em MAX_QUANTITY; digitar usa sanitizeQuantityInput e chama onChange a cada valor válido; campo vazio durante a digitação é permitido SÓ no buffer: ao sair (blur) vira 0 e chama onChange(0) + onCommit(0); −/+ chamam onChange e onCommit; alvos size-9 max-md:size-11

// ItemLineField.tsx ("use client")
ItemLineField(props: { line: ItemLine; quantity: number; note: string; onQuantityChange: (value: number) => void; onQuantityCommit: (value: number) => void; onNoteChange: (value: string) => void; onNoteCommit: (value: string) => void; disabled?: boolean })
// nome (font-medium) + QuantityCounter + botão "Adicionar observação" (aria-label `Adicionar observação em ${name}`) que revela <Input maxLength={200} text-base aria-label={`Observação de ${name}`}>; já vem aberto se note !== ""

// HandoverFields.tsx ("use client", sem estado próprio)
HandoverFields(props: {
  controls: readonly ItemLine[]; stock: readonly ItemLine[];
  values: FieldValues; onChange: (change: FieldChange) => void; onCommit: (change: FieldChange) => void;
  disabled?: boolean; canManageCatalog: boolean; itemsHref: string;   // itemsHref = `/admin/itens?setor=${sectorId}`
})
// Seções Controles, Estoque, Ocorrências do turno, Fica para o próximo turno (Textarea text-base, `maxLength` = TEXT_MAX_LENGTH, contador só ao passar de 90%); estado vazio de itens; "Fica para o próximo turno" com destaque (borda `border-warning`, ícone)

// HandoverHeader.tsx ("use client")
HandoverHeader(props: {
  sectorId: string; sectorName: string; shifts: readonly ShiftChoice[]; shiftId: string; operationalDate: string;
  today: string; minDate: string;                                       // limites do <input type="date"> (São Paulo)
  sectorParam: string | null;                                           // preserva ?setor= do admin
  beforeNavigate?: () => Promise<boolean>;                              // false cancela a troca e mostra o toast de erro
})
// "Setor" (texto), SelectField "Turno" (`${name} (${startsAt}–${endsAt})`), <Input type="date" min max> "Data"; ao mudar: await beforeNavigate() → router.push(newHandoverHref({ sectorId… }, sectorParam)); a troca de turno mantém a data e a de data mantém o turno (D-F3-2)

// HandoverForm.tsx ("use client")
HandoverForm(props: {
  state: HandoverFormState & { mode: FormMode };                        // a página já tratou mode null
  shifts: readonly ShiftChoice[]; today: string; minDate: string;
  sectorParam: string | null; canManageCatalog: boolean;
})
// mode "draft": HandoverHeader + HandoverFields + AutosaveIndicator + botão "Entregar turno" (useAdminAction; flush() antes; sucesso → toast "Turno entregue." + router.push(handoverHref(id)); falha → alerta inline)
// mode "edit" (entregue, via /passagens/[id]?editar=1): sem cabeçalho de troca; HandoverFields + AutosaveIndicator + link "Ver resumo"
// o <form> ganha key={`${shiftId}:${operationalDate}`} no chamador, para remontar ao trocar turno/data

// CorrectionForm.tsx ("use client")  — Tarefa 11
CorrectionForm(props: { state: HandoverFormState & { mode: "correction" } })
// HandoverFields (sem autosave, estado local) + Textarea "Motivo da correção" + botão "Registrar correção" (useAdminAction → correctHandoverAction; sucesso: toast "Correção registrada." + router.push(handoverHref(id))) + link "Cancelar"; erros de campo (reason, items) vêm de fieldErrors; o que foi digitado nunca se perde

// NewHandover.tsx (server, async)  NewHandover(props: { searchParams: Promise<Record<string, string | string[] | undefined>> })
// requireUser() → setor (operador: actor.sectorId; admin: resolveHandoverSector + SectorPicker) → listActiveShifts → resolveHandoverTarget → getHandoverFormState; status ≠ null/draft → redirect(handoverHref(id)); sem turnos/sem setor/setor inativo → EmptyState

// HandoverDetail.tsx (server, async)  HandoverDetail(props: { id: string; searchParams: Promise<Record<string, string | string[] | undefined>> })
// valida o id (idSchema; não uuid → notFound()) → requireUser() → getHandoverSummary (NOT_FOUND → notFound()); status draft → redirect(newHandoverHref(summary.ref, summary.ref.sectorId)); `editar=1` e mode permitido → <HandoverForm mode edit> ou <CorrectionForm>; senão resumo

// SummaryItemList.tsx (server-safe)  SummaryItemList(props: { title: string; items: readonly SummaryItem[] })
// <section aria-labelledby>: título + <ul> (nome, `${formatQuantity(q)} ${unit}` com tabular-nums à direita, observação em text-muted-foreground); vazio → nada
// CorrectionsTimeline.tsx (server-safe)  CorrectionsTimeline(props: { corrections: readonly SummaryCorrection[] })  // <ol> linha do tempo
// ConfirmReceiptForm.tsx ("use client")  ConfirmReceiptForm(props: { id: string })
// HandoverStatusBadge.tsx (server-safe)  HandoverStatusBadge(props: { situation: HistorySituation; confirmedByName?: string | null; corrected?: boolean })
// ícone + texto: awaiting Clock (tokens info), confirmed CircleCheck (success), unconfirmed TriangleAlert (warning), missing CircleSlash (muted/destructive); "Corrigida" PencilLine em <Badge variant="outline"> ao lado

// SectorPicker.tsx ("use client")
SectorPicker(props: { sectors: readonly SectorChoice[]; selectedId: string | typeof ALL_SECTORS; path: SectorPickerPath; allowAll?: boolean })
// <FieldSet> + <FieldLegend className="sr-only">Setor</FieldLegend> (papel group, nome "Setor"): um <Button variant={selected ? "default" : "outline"} aria-pressed> por setor (e "Todos os setores" se allowAll); clique → useTransition + chooseSectorAction({ sectorId, path }); falha → toast.error(message); clicar no já selecionado não faz nada

// HomeHandovers.tsx (server, async)  HomeHandovers(props: { searchParams: Promise<Record<string, string | string[] | undefined>> })
// requireUser() → setor (operador: actor.sectorId; admin: resolveHandoverSector com readRememberedSector, dentro do <Suspense>, + SectorPicker) → getHomeHandovers
// PendingHandoverCard.tsx (server-safe)  PendingHandoverCard(props: { pending: PendingHandover })   // os cartões do Início usam <CardTitle><h2>…</h2></CardTitle>
// MyShiftCard.tsx (server-safe)  MyShiftCard(props: { state: MyShiftState; sectorId: string; canManageCatalog: boolean; sectorParam: string | null })

// HandoverHistory.tsx (server, async)  HandoverHistory(props: { searchParams: Promise<Record<string, string | string[] | undefined>> })
// HistoryFilters.tsx ("use client")
HistoryFilters(props: { filters: HistoryFilters; shifts: readonly ShiftChoice[] /* [] quando "todos os setores" */; sectorParam: string | null })
// controlado; "Aplicar filtros" → router.push(buildHistoryHref(filters, { sector })); "Limpar filtros" é <Link href="/passagens"> (preserva só ?setor=)
// HistoryRowItem.tsx (server-safe)  HistoryRowItem(props: { row: HistoryRow; showSector: boolean; sectorParam: string | null })
```

Páginas (`src/app/(app)/…`) são finas: `page.tsx` com `metadata` estático, `<Suspense fallback={<PageSkeleton />}>` e o componente servidor acima. `passagens/[id]/page.tsx`: `params: Promise<{ id: string }>`; id que não é uuid → `notFound()` dentro do `<Suspense>`.

### Helpers de teste

```ts
// test/clock.ts
export function spDate(isoDate: string, hhmm: string): Date;
// hora de parede de São Paulo → Date: new Date(`${isoDate}T${hhmm}:00-03:00`); o Brasil não tem horário de verão desde 2019 (comentar)

// test/db.ts
export const TABLES: readonly string[]; // + "handover", "handover_item", "handover_correction" (test/db.test.ts compara com pg_tables)

// test/fixtures.ts
export async function insertShift(db: Db, input: { …existente…; createdAt?: Date }): Promise<{ id: string; name: string }>;  // createdAt novo, para simular turno antigo
export async function insertHandover(db: Db, input: {
  sectorId: string; shiftId: string; operationalDate?: string;       // padrão "2026-11-20"
  status?: HandoverStatus;                                           // padrão "draft"
  occurrencesText?: string; nextShiftText?: string;
  deliveredBy?: string; deliveredAt?: Date;                          // status ≠ draft exige deliveredBy (a fixture lança); rascunho com entrega ou confirmação também lança; deliveredAt padrão 2026-11-20T17:00:00Z
  confirmedBy?: string; confirmedAt?: Date; confirmationNote?: string; // status confirmed exige confirmedBy; entregue com confirmação lança; confirmedBy = deliveredBy lança; confirmedAt padrão = deliveredAt + 1 h
  updatedBy?: string; shiftNameSnapshot?: string;
}): Promise<{ id: string }>;
export async function insertHandoverItem(db: Db, input: { handoverId: string; itemId: string; quantity?: number; note?: string | null; snapshot?: boolean }): Promise<void>; // snapshot true copia nome/unidade/tipo do item
export async function insertHandoverCorrection(db: Db, input: { handoverId: string; field: CorrectionField; itemId?: string; oldValue?: string; newValue?: string; reason?: string; correctedBy: string; correctedAt?: Date }): Promise<{ id: string }>;

// e2e/db.ts (acrescenta, reexportando de ../test/fixtures)
export { insertShift, insertItem, insertHandover, insertHandoverItem } from "../test/fixtures";
export async function handoverOf(db: Db, ref: HandoverRef): Promise<{ id: string; status: HandoverStatus; deliveredBy: string | null; confirmedBy: string | null; occurrencesText: string; nextShiftText: string } | null>;
export async function countCorrections(db: Db, handoverId: string): Promise<number>;
export async function userIdByEmail(db: Db, email: string): Promise<string>; // lança `Pessoa {email} não encontrada.`
```

### Rotas e nomes fixos

- Rotas novas: `/passagens`, `/passagens/nova`, `/passagens/[id]` (`?editar=1`). Parâmetros: `/` → `?setor=`; `/passagens/nova` → `?turno=<uuid>&data=YYYY-MM-DD&setor=`; `/passagens` → `?periodo=7|30|intervalo&de=&ate=&turno=<uuid>&situacao=&setor=<uuid|todos>&pagina=`.
- `src/components/app-shell/navItems.ts`: `NAV_ITEMS` ganha, **depois de Início**, `{ href: "/passagens", label: "Passagens", icon: ClipboardList, adminOnly: false }`; `isNavItemActive("/passagens/nova", "/passagens")` já é `true` pela regra existente.
- Todas exigem sessão pelo `proxy.ts` e `requireUser()` na página.
- E2E: a mesma infraestrutura (app em `http://localhost:3200`, banco em `54329`).

### Quem pode o quê (resumo; a fonte é `handoverCapabilities`)

| Função | Operador do setor | Operador de outro setor | Admin |
|---|---|---|---|
| Ver formulário, resumo, histórico, Início | sim | `NOT_FOUND` | sim (todos) |
| `saveHandoverField` rascunho | sim | `NOT_FOUND` | sim |
| `saveHandoverField` entregue | só quem entregou, senão `FORBIDDEN` | `NOT_FOUND` | sim |
| `saveHandoverField` confirmada | `HANDOVER_LOCKED` | `NOT_FOUND` | `HANDOVER_LOCKED` |
| `deliverHandover` | sim | `NOT_FOUND` | sim |
| `confirmHandover` | sim, **menos** quem entregou (`OWN_HANDOVER`) | `NOT_FOUND` | sim, menos quem entregou |
| `correctHandover` | `FORBIDDEN` | `NOT_FOUND` | sim, com motivo |
| `chooseSectorAction` | `notFound()` (`requireAdmin`) | `notFound()` | sim |

---

## Textos de interface (exatos — testes e E2E dependem deles)

**Navegação:** item `Passagens` (ícone `ClipboardList`), depois de `Início`.

**Comuns:** formato de data `dd/mm/aaaa` (`formatDateBR`); hora `HH:mm` (`formatTimeBR`, São Paulo); data e hora `formatDateTimeBR`. Valor vazio de correção: `(vazio)`. Rótulo de unidade: o texto cadastrado (`rolo`, `par`…). Toasts: `Turno entregue.` · `Recebimento confirmado.` · `Correção registrada.` · erro de ação = `message` do resultado em `toast.error` (menos nos formulários, que mostram o erro no próprio campo).

**`/` (Início):**
- Título `Olá, {primeiro nome}` · texto `Em breve: solicitações e dashboard.`
- Admin: grupo `Setor` (`SectorPicker`).
- Cartão `Passagem para confirmar`: linha `{turno} · {dd/mm/aaaa}`; `Entregue às {HH:mm} por {nome}`; rótulo `Fica para o próximo turno`; trecho do texto (ou `Nada registrado para o próximo turno.`); link-botão `Ver passagem`.
- Cartão `Passagem do meu turno`: linha `{turno} · {início}–{fim} · {dd/mm/aaaa}` (início–fim com `tabular-nums`) e `Turno sugerido pelo horário de agora.`; estados:
  - `start`: botão-link `Começar passagem`.
  - `continue`: `Rascunho salvo às {HH:mm} por {nome}` + botão-link `Continuar passagem`.
  - `delivered`: `Entregue às {HH:mm} por {nome}. Aguardando recebimento.` + link `Ver passagem`.
  - `confirmed`: `Entregue por {nome} às {HH:mm}. Confirmada por {nome} às {HH:mm}.` + link `Ver passagem`.
  - Link secundário nos quatro estados: `Ver todas as passagens` (→ `/passagens`).
- Sem turnos: título `Nenhum turno neste setor.`; operador: `Peça a um administrador para cadastrar os turnos do setor.`; admin: `Cadastre os turnos do setor para começar a passagem.` + link `Ir para Turnos` (→ `/admin/turnos?setor={id}`).
- Admin sem setor ativo: `Nenhum setor ativo.` / `Cadastre ou reative um setor para usar a passagem de turno.` + link `Ir para Setores`.
- Operador com setor inativo: `Seu setor está inativo.` / `Peça a um administrador para reativá-lo.`

**`/passagens/nova`:**
- Título `Passagem de turno` · texto `Registre o que aconteceu no turno. Tudo é salvo sozinho.`
- Admin: `SectorPicker` (grupo `Setor`).
- Cabeçalho: `Setor` (valor em texto) · `Turno` (opções `{nome} ({início}–{fim})`) · `Data`.
- Seções: `Controles` (ajuda `Soma no período, como redes danificadas.`) · `Estoque` (ajuda `Contagem de agora. Vale a última, nunca a soma.`) · `Ocorrências do turno` (campo com o mesmo rótulo; descrição `Opcional. Conte o que saiu do normal.`) · `Fica para o próximo turno` (descrição `Opcional. O que quem recebe precisa saber primeiro.`).
- Item: nome · contador (`Diminuir {nome}`, `Aumentar {nome}`, `Quantidade de {nome}`, tooltips `Diminuir` / `Aumentar`) · unidade · botão `Adicionar observação` (aria-label `Adicionar observação em {nome}`) · campo `Observação de {nome}`.
- Sem itens ativos: título `Nenhum item neste setor.`; operador `Peça a um administrador para cadastrar os itens. Você ainda pode entregar o turno com as ocorrências.`; admin `Cadastre os itens do setor para contá-los na passagem.` + link `Ir para Itens` (→ `/admin/itens?setor={id}`).
- Sem turnos / sem setor / setor inativo: os mesmos estados vazios do Início.
- Autosave: `Salvando…` · `Salvo às {HH:mm}` · `Último salvamento às {HH:mm} por {nome}` (estado inicial vindo do servidor) · `Não salvo.` + a mensagem do resultado + botão `Tentar de novo` · sem nada salvo e sem rascunho: `Nada salvo ainda.`
- Botão `Entregar turno` (pendente: `Entregando…`) · ajuda `Você ainda pode corrigir até alguém confirmar o recebimento.` · erro de flush: `Há alterações sem salvar. Toque em “Tentar de novo” e entregue de novo.` · troca de turno/data com falha de salvamento: toast `Não foi possível salvar. Tente de novo antes de trocar de turno.`

**`/passagens/[id]` (resumo):**
- Título `Passagem de turno` · subtítulo `{setor} · {turno} · {dd/mm/aaaa}` · selo de situação (`HandoverStatusBadge`) e, se houver correção, selo `Corrigida`.
- Seções: `Fica para o próximo turno` (em destaque; vazio `Nada registrado para o próximo turno.`) · `Controles` · `Estoque` (só os com valor ≠ 0 ou observação; ao fim `<details>` `Demais itens: 0 ({n})` com os nomes; nenhum destacado: `Nenhum item com valor ou observação.`) · `Ocorrências do turno` (vazio `Nenhuma ocorrência registrada.`) · `Entrega` (`Entregue por {nome} em {dd/mm/aaaa} às {HH:mm}.`; confirmada acrescenta `Recebido por {nome} em {dd/mm/aaaa} às {HH:mm}.` e, se houver, `Observação do recebimento: {texto}`) · `Correções`.
- Receber: campo `Observação do recebimento (opcional)` · botão `Confirmar recebimento` (pendente `Confirmando…`). Quem entregou, vendo a entregue: `Você entregou este turno. Outra pessoa do setor confirma o recebimento.`
- Links: `Corrigir` (entregue; quem entregou e admin → `?editar=1`) · `Corrigir com motivo` (confirmada; admin → `?editar=1`) · `Ver todas as passagens`.
- Correções (linha do tempo, uma por campo): `{rótulo do campo}` · `{antigo} → {novo}` · `Motivo: {motivo}` · `{nome} · {dd/mm/aaaa, HH:mm}`.
- Edição de entregue (`?editar=1`): título `Corrigir passagem` · texto `As alterações valem na hora. Quem recebe vê a versão atual.` · autosave como acima · link `Ver resumo`.
- Correção de confirmada (`?editar=1`): título `Corrigir passagem` · texto `Esta passagem já foi confirmada. A correção fica registrada com o motivo.` · campo `Motivo da correção` (descrição `Obrigatório. Aparece na lista de correções.`) · botão `Registrar correção` (pendente `Registrando…`) · link `Cancelar`.
- Passagem fora do escopo ou inexistente: a página `Página não encontrada` do app.

**`/passagens` (histórico):**
- Título `Passagens` · texto `Histórico de passagens de turno, do dia mais recente ao mais antigo.`
- Admin: `SectorPicker` com `Todos os setores`.
- Filtros: `Período` (`Últimos 7 dias`, `Últimos 30 dias`, `Intervalo`) · `De` e `Até` (só em Intervalo) · `Turno` (`Todos os turnos` + turnos do setor; ausente em "Todos os setores") · `Situação` (`Todas`, `Aguardando`, `Confirmada`, `Não confirmada`, `Sem passagem`, `Corrigida`) · botão `Aplicar filtros` · link `Limpar filtros`.
- Legenda do período: `Período: {dd/mm/aaaa} a {dd/mm/aaaa}`.
- Linha: dia `{dd/mm/aaaa}` · `{turno}` · `{setor}` (só admin em "Todos os setores") · `Entregue por {nome} às {HH:mm}` (ausente em sem passagem) · selo de situação (+ `Corrigida`). Link da linha: `Abrir` (aria-label `Abrir passagem de {turno} em {dd/mm/aaaa}`); em `missing`: link `Entregar turno` (→ nova passagem daquele turno/dia) ou, com `hasDraft`, `Continuar passagem`.
- Vazio: `Nenhuma passagem neste período.` / `Mude o período ou os filtros para ver mais.`

**Mensagens de domínio (`message` do `AdminResult`):**

| Código / origem | Mensagem |
|---|---|
| `INVALID_INPUT` (geral) | `Confira os campos e tente de novo.` |
| quantidade fora do limite | `Informe um número inteiro de 0 a 99.999.` (campo `value`) |
| texto longo | `O texto pode ter no máximo 2.000 caracteres.` (campo `value`) |
| observação do item longa | `A observação pode ter no máximo 200 caracteres.` (campo `value` / `items`) |
| observação do recebimento longa | `A observação pode ter no máximo 500 caracteres.` (campo `note`) |
| motivo vazio / longo | `Informe o motivo da correção.` · `O motivo pode ter no máximo 500 caracteres.` (campo `reason`) |
| data malformada | `Data inválida.` |
| id malformado | `Registro inválido. Atualize a página.` |
| item repetido na correção | `Item repetido. Atualize a página.` |
| `NOT_FOUND` | `Passagem não encontrada. Atualize a página.` · `Setor não encontrado. Atualize a página.` · `Turno não encontrado. Atualize a página.` · `Item não encontrado. Atualize a página.` |
| `SECTOR_INACTIVE` | `Este setor está inativo. Peça a um administrador para reativá-lo.` |
| `SHIFT_INACTIVE` | `Este turno está inativo. Escolha outro turno.` |
| `DATE_OUT_OF_RANGE` | `Escolha uma data de hoje ou dos últimos 31 dias.` |
| `FORBIDDEN` | edição de entregue: `Só quem entregou o turno ou um administrador pode editar esta passagem.` · correção: `Só um administrador pode corrigir uma passagem confirmada.` |
| `HANDOVER_LOCKED` | `Esta passagem já foi confirmada. Só um administrador corrige, com motivo.` |
| `ALREADY_DELIVERED` | `Esta passagem já foi entregue por {nome} às {HH:mm}.` |
| `NOT_DELIVERED` | `Esta passagem ainda não foi entregue.` |
| `ALREADY_CONFIRMED` | `Esta passagem já foi confirmada por {nome} às {HH:mm}.` |
| `OWN_HANDOVER` | `Quem entregou o turno não pode confirmar o recebimento. Peça a outra pessoa do setor.` |
| `NOT_CONFIRMED` | `Só passagens confirmadas passam pela correção com motivo. Edite a passagem direto.` |
| `NO_CHANGES` | `Nada foi alterado. Mude algum campo para registrar a correção.` |
| `INTERNAL` | `Não foi possível concluir. Tente de novo.` |

---

## Tarefas

| # | Tarefa | Depende de |
|---|---|---|
| 1 | Schema e migração `0003`: `handover`, `handover_item`, `handover_correction`, `CHECK`s, índices, fixtures, `test/clock.ts`, `TABLES` | — |
| 2 | Lógica pura: fuso de São Paulo, dia operacional, turno sugerido, quantidade, regras de campo, permissões, diff de correção, situações, filtros do histórico, links, escolha de setor, mensagens | 1 |
| 3 | Contrato das actions: novos códigos em `AdminErrorCode`, schemas Zod, `runHandoverAction`, guardas (P27): helper extraído (refatoração isolada), `actionsGuards.test.ts`, `appPagesAuth` | 1, 2 |
| 4 | Domínio do rascunho: carregadores, turnos ativos, estado do formulário, salvar campo, entregar turno | 1, 2, 3 |
| 5 | Domínio do recebimento: confirmar, resumo, correção com motivo e diff | 1, 2, 3, 4 |
| 6 | Domínio das leituras: histórico (SQL com "sem passagem") e cartões do Início; P26 nas contagens do `/admin` | 1, 2, 4 |
| 7 | Escolha de setor do admin, navegação, Início (`/`) com os dois cartões | 2, 3, 6 |
| 8 | Formulário `/passagens/nova`: autosave, contador, campos, cabeçalho, entregar (actions `saveHandoverFieldAction` e `deliverHandoverAction`) | 2, 3, 4, 7 |
| 9 | Resumo `/passagens/[id]` e Confirmar recebimento (action `confirmHandoverAction`) | 2, 3, 5, 7 |
| 10 | Histórico `/passagens`: filtros, linhas, situação, paginação | 2, 6, 7 |
| 11 | Editar antes da confirmação e corrigir com motivo (`?editar=1`; action `correctHandoverAction`) | 5, 8, 9 |
| 12 | E2E Playwright da passagem | 7–11 |
| 13 | Documentação de contexto, pendências (P26, P27 fechadas; P33–P36 abertas), walkthrough e verificação final | 1–12 |

**Casos que cada tarefa precisa provar (além do feliz):**
1. `CHECK`s recusam (`23514`): status inválido, `confirmed_by = delivered_by`, `delivered` sem `delivered_by`, rascunho com `confirmed_by`, quantidade `-1`, snapshot de tipo inválido, correção de item sem `item_id`, correção de texto com `item_id`, motivo só com espaços; PK duplicada `23505`; tripla duplicada `23505 handover_sector_shift_date_uq`; `INSERT … ON CONFLICT DO NOTHING RETURNING` devolve `[]` na 2ª vez; FK `restrict` (apagar setor, turno, item ou usuário com passagem → `23001`); `operationalDate` volta `string`; `TABLES` bate com `pg_tables`; a migração 0003 aplica sobre os dados da 0002; fixtures lançam para estado impossível.
2. Cada função pura com vazio, zero, máximo, unicode e fronteira. **Turno sugerido:** 06:05 → turno 22–06 do dia anterior; 14:05 → 06–14; 14:00 exato (distância 0, já terminou); 23:30; 00:10; empate de fim igual (primeiro da lista); empate passado × futuro (o passado); um turno só; zero turnos; turno que atravessa a meia-noite; virada UTC (`02:59Z` × `03:00Z`). `resolveHandoverTarget` com turno de outro setor, data futura, data de 32 dias atrás, `2026-02-30`, parâmetros em array, só um dos dois parâmetros. `parseQuantity("")`, `"007"`, `"100000"`, `"abc"`, colagem com espaços. `handoverCapabilities` em tabela (papel × estado × quem entregou × setor). `diffHandover` com nota `null` × `""`, texto igual após NFC, item ausente, quantidade igual. `parseHistoryFilters` com intervalo invertido, no futuro, maior que 93 dias, lixo.
3. `AdminErrorCode` aceita os 10 códigos novos sem quebrar a Fase 2 (testes verdes antes e depois); schemas: `saveFieldSchema` por campo (quantidade `-1`, `1.5`, `100000`, `"3"`; texto de 2.001 pontos de código com emoji; nota com quebra de linha), `confirmHandoverSchema`, `correctHandoverSchema` (item repetido, motivo vazio); `runHandoverAction`: entrada inválida, falha de domínio repassada, exceção inesperada vira `INTERNAL` sem vazar texto, `notFound`/`redirect` passam intactos, `revalidatePath` só com `revalidate: true` **e** `ok`; guardas reprovam action sem `requireUser`, guarda só em comentário, `"use server"` inline fora de `actions.ts`, arquivo fora de `(app)`; `admin/` exige `requireAdmin`; a extração do helper mantém **todos** os casos antigos do `actionsAuth.test.ts` verdes.
4. `getHandoverFormState` **não escreve** (contagem de linhas antes = depois) e devolve `0`/`""`; operador de outro setor `NOT_FOUND`; setor inativo `SECTOR_INACTIVE`; item inativo fora do formulário; `saveHandoverField`: 1º salvamento cria, 2º reaproveita (uma linha só); quantidade, nota, dois textos; entregue por outra pessoa → `FORBIDDEN`; confirmada → `HANDOVER_LOCKED` (operador **e** admin); data futura / 32 dias / turno inativo ao **criar** recusam, mas rascunho existente de turno inativo ainda salva e entrega; item de outro setor `NOT_FOUND`; `deliverHandover`: cria quando não há rascunho, completa com `0` os itens ativos, **mantém** linha de item desativado, snapshots de todas as linhas, segundo "Entregar" devolve `ALREADY_DELIVERED` com nome e hora, entrega tudo zerado e sem texto passa, outro setor `NOT_FOUND`.
5. `confirmHandover`: feliz; quem entregou → `OWN_HANDOVER`; segunda confirmação → `ALREADY_CONFIRMED` com nome e hora; rascunho → `NOT_DELIVERED`; outro setor `NOT_FOUND`; admin confirma; observação normalizada/vazia → `null`; o `CHECK` do banco recusa o bypass por `UPDATE` direto. `getHandoverSummary`: itens zerados recolhidos, item zerado **com** observação destacado, snapshot vence renomeação posterior do item, `situation` `awaiting` × `unconfirmed` × `confirmed`, correções em ordem com nome do item. `correctHandover`: operador (do setor e de outro) → `FORBIDDEN`/`NOT_FOUND`; sem motivo; só espaços; motivo 501; passagem entregue → `NOT_CONFIRMED`; nada mudou → `NO_CHANGES` (0 linhas); mudança em texto, quantidade e nota → 1 linha por campo com antigo/novo/motivo/quem/quando; item fora da passagem `NOT_FOUND`; corrigir duas vezes encadeia o antigo; valores vigentes são os corrigidos.
6. Histórico: `missing` só para pares **encerrados** (fim == agora conta), turno que atravessa a meia-noite, turno novo sem dias antes de `created_at`, turno e setor inativos fora, par com rascunho = `missing` com `hasDraft`, `awaiting` × `unconfirmed` por setor, `corrected`, filtros (turno, situação, período), paginação clampada, operador só do próprio setor (parâmetro de outro setor ignorado), admin "todos", ordem, **paridade** JS × SQL numa grade de horários (`hasShiftEnded`). Início: `pending` some para quem entregou e não cai para a anterior, escolhe a mais recente por `delivered_at`, outro setor não vaza, `mine` nos 5 estados, sem turnos, turno sugerido vira o dia. `getAdminOverviewCounts` ignora turnos e itens de setor inativo.
7. `resolveHandoverSector` (URL × cookie × primeiro × `todos` × vazio); `chooseSectorAction`: operador → `notFound`, setor inativo/inexistente, grava o cookie com os atributos certos, `todos` não grava, redireciona só para os 3 caminhos permitidos; `SectorPicker` (selecionado `aria-pressed`, clique chama a action, falha vira toast, clicar no atual não chama); cartões do Início nos 5 estados, sem turnos (operador × admin), nenhum cartão de solicitação; item `Passagens` na sidebar; `Greeting` com o texto novo.
8. `QuantityCounter`: começa em `0`, − trava em 0, + trava em 99.999, digitar `abc` ignora, digitar vazio e sair volta a `0` e salva `0`, `007` → `7`, alvos ≥ 44px abaixo de `md`, tooltips + `aria-label`; `useHandoverAutosave` (relógio falso): debounce de 800 ms agrupa digitação, `commit` envia já, fila serial (a 2ª só sai depois da 1ª), valor mais novo do mesmo campo vence, falha mantém o payload e para a fila, `retry`, evento `online`, `beforeunload` só com algo não salvo, desmontar envia o pendente, exceção da action vira erro sem lançar; `AutosaveIndicator` nos 4 estados; `HandoverForm`: nunca em branco, "Entregar turno" faz `flush` antes, falha de flush bloqueia e mostra o texto, entrega com sucesso navega, `ALREADY_DELIVERED` aparece inline, trocar turno/data chama `flush` e navega com `turno`+`data`+`setor`, o que foi digitado não se perde no erro; actions: operador de outro setor, entrada inválida, `requireUser` redireciona; `/passagens/nova` redireciona quando já entregue.
9. Resumo: ordem das seções, itens zerados recolhidos, "Demais itens: 0 (n)", selo certo por situação, "Confirmar recebimento" só para quem pode (não para quem entregou, não para confirmada), observação opcional, `ConfirmReceiptForm` (pendente, erro inline, toast), correções em linha do tempo, rascunho redireciona para a nova passagem, id inválido e outro setor → `notFound`.
10. Histórico: filtros na URL ida e volta (`buildHistoryHref` × `parseHistoryFilters`), "Limpar filtros", seletor com "Todos os setores", linhas com cada situação e selo "Corrigida", link `Entregar turno` / `Continuar passagem` em `missing`, vazio, paginação preserva filtros, operador sem seletor, `appPagesAuth` com 12 páginas.
11. `?editar=1`: quem entregou edita a entregue com autosave; outro operador cai no resumo; admin edita a entregue; confirmada: só admin vê o formulário de correção; `CorrectionForm`: motivo obrigatório (erro inline, digitado preservado), sem alteração → mensagem de `NO_CHANGES`, sucesso volta ao resumo com "Corrigida" e a correção na lista; operador tentando a action → `FORBIDDEN`.
12. Cenários E2E (dados próprios e IP próprio, como nas Fases 1 e 2): (a) operador A preenche (−/+, observação, textos), recarrega e vê tudo salvo, entrega; (b) operador B, no Início, vê "Passagem para confirmar", lê o resumo e confirma; (c) operador A (quem entregou) não vê "Confirmar recebimento"; (d) operador de outro setor abre a URL da passagem e vê "Página não encontrada", e a URL de nova passagem com o setor de A não mostra o setor de A; (e) admin escolhe o setor no seletor, corrige a confirmada com motivo e o histórico mostra "Corrigida" e a correção aparece no resumo; (f) o cartão do Início mostra "Começar passagem" → "Continuar passagem" depois do primeiro salvamento.
13. Todos os comandos verdes, `build` e `test:e2e` verdes, docs coerentes com o código, walkthrough entregue.

**Fatias de redação sugeridas** (para 6 redatores em paralelo): [1, 2] · [3, 4] · [5, 6] · [7, 8] · [9, 11] · [10, 12, 13]. As tarefas 7–11 só dependem do **contrato** (tipos, assinaturas e textos acima), não do código das anteriores; a fatia [7, 8] concentra o cliente mais pesado (autosave, contador, formulário) e a fatia [9, 11] reaproveita `HandoverFields` e `useAdminAction` pelo contrato.

---

## Perguntas resolvidas (2026-11-21)

As nove recomendações abaixo foram **aceitas** pelo controlador; viram regras do plano (P33–P36 entram como pendências `Aberto, não triado` na Tarefa 13).

1. **Teto de idade do cartão "Passagem para confirmar".** A spec e o controlador não limitam: uma passagem entregue há semanas e nunca confirmada continuaria no topo do Início até alguém confirmar. **Recomendação:** sem teto nesta fase (fiel à spec; o cartão mostra a data e a hora da entrega, e o histórico já a marca "não confirmada" quando surge uma mais nova). Se o piloto mostrar ruído, um teto de 72 h entra como mudança de uma linha em `getHomeHandovers`. Registrar como P35.
2. **"Todos os setores" no histórico do admin** é uma extensão de D-F3-3 (o dono pediu o seletor de setor; "Todos" cobre o filtro "setor (admin)" da spec §6.5). **Recomendação:** manter, sem gravar no cookie.
3. **Limites numéricos e de texto** (`MAX_QUANTITY = 99.999`, textos de 2.000 caracteres, observação de item de 200, observação do recebimento e motivo de 500) são palpite razoável, não vêm da spec. **Recomendação:** manter; valem só no domínio (mudar não exige migração).
4. **Janela de entrega atrasada de 31 dias** (data futura recusada). **Recomendação:** manter; a spec pede "entrega atrasada" sem prazo.
5. **"Sem passagem" usa os horários atuais do turno** e só existe a partir do dia em que o turno foi criado; desativar um turno some com os "sem passagem" dele (nada guarda quando o turno esteve ativo). **Recomendação:** aceitar para o MVP e registrar como P34; a Fase 5 (dashboard) herda a mesma definição e é onde um histórico de horários, se necessário, entraria.
6. **Rascunho de turno ainda em andamento** não aparece no histórico (só no cartão do Início, como "Continuar passagem"). **Recomendação:** manter; rascunho nunca entregue de turno encerrado conta como "sem passagem" (spec §6.1.6), com o link "Continuar passagem".
7. **Unificar `runAdminAction` e `runHandoverAction`** fica para uma refatoração separada (P33). Sem ação nesta fase.
8. **Concorrência no mesmo rascunho:** dois operadores digitando o mesmo campo ao mesmo tempo: o último a salvar vence, sem aviso de conflito (spec §6.1; sem tempo real). **Recomendação:** aceitar e registrar como P36; "Último salvamento às {HH:mm} por {nome}" já mostra quem mexeu por último.
9. **Collation do Neon** (herdada da Fase 2, P24): ordenar setores e nomes por `lower(name)` ordena por ponto de código; nada novo aqui, só citado porque o seletor de setor e o histórico ordenam por nome de setor.

**Decisões do controlador na revisão do plano (2026-11-21, vinculantes):**

- **"Passagem para confirmar" e `awaiting`:** "a mais recente" é calculada entre as passagens do setor com `status IN ('delivered','confirmed')`, ordenadas por `(delivered_at desc, id desc)`. O cartão só aparece se a mais recente estiver `delivered` e não for de quem olha; `unconfirmed` = entregue com outra entregue **ou confirmada** mais nova no setor (F3-6, F3-9b; `home.ts`, `summary.ts`, `history.ts`).
- **Setor inativo é só leitura (P26):** as listas e escolhas (turnos, itens, histórico, Início, formulário novo) juntam `sector.active`; escrever numa passagem existente de setor inativo (salvar, entregar, confirmar, corrigir) é recusado com `SECTOR_INACTIVE`; o resumo dela continua legível.
- **`sectorChoice.ts` tem um dono só, a Tarefa 2** (lista vazia devolve `none`, mesmo com `?setor=todos`); a Tarefa 7 só consome.
- **Apontamento descartado:** a observação de que `kind: "start" | "continue"` e `kind: "delivered" | "confirmed"` não estreitariam o tipo `MyShiftState` está errada (o TypeScript trata união de literais como discriminante; `check-types` verde com o `MyShiftCard` da Tarefa 7). O contrato e o cartão não mudam.

<!-- As tarefas detalhadas entram abaixo. -->

### Task 1: Schema e migração `0003` (handover, handover_item, handover_correction), fixtures, `TABLES` e `test/clock.ts`

**Files:**
- Create: `src/db/schema/handovers.ts`
- Modify: `src/db/schema/index.ts` (reexporta `./handovers`)
- Create: `drizzle/0003_fase3_passagem.sql`, `drizzle/meta/0003_snapshot.json` (gerados pelo drizzle-kit)
- Modify: `drizzle/meta/_journal.json` (gerado: entrada `0003_fase3_passagem`)
- Modify: `test/db.ts` (`TABLES` + `"handover"`, `"handover_item"`, `"handover_correction"`)
- Modify: `test/fixtures.ts` (imports; `insertShift` aceita `createdAt`; novos `insertHandover`, `insertHandoverItem`, `insertHandoverCorrection`). **LEIA o arquivo antes de editar.**
- Create: `test/clock.ts`
- Test: `test/clock.test.ts`, `src/db/schema/handovers.test.ts`, `src/db/schema/migration0003.test.ts` (novos); `test/db.test.ts` (já existe; passa a provar o novo `TABLES` sem mudar o código)

**Interfaces:**
- Consumes: `createTestDb`, `resetDb`, `TestDb`, `TABLES` (`test/db.ts`); `insertSector`, `insertShift`, `insertItem`, `insertUser` (`test/fixtures.ts`); `sqlErrorOf` (`test/sqlError.ts`); `ITEM_KINDS`, `ItemKind` (`@/lib/itemKinds`); tabelas `user`, `sector`, `shift`, `item`.
- Produces:
  - `src/db/schema/handovers.ts`: `HANDOVER_STATUSES`, `HandoverStatus`, `CORRECTION_FIELDS`, `CorrectionField`, tabelas `handover`, `handoverItem`, `handoverCorrection` (reexportadas por `@/db/schema`); `operationalDate` é `date({ mode: "string" })`. Índices e CHECKs com os nomes do contrato (F3-1).
  - `test/fixtures.ts`: `insertShift(db, { …existente…; createdAt?: Date })`, `insertHandover(db, input): Promise<{ id: string }>`, `insertHandoverItem(db, input): Promise<void>`, `insertHandoverCorrection(db, input): Promise<{ id: string }>`; as três lançam `Error("fixture: …")` para estado impossível. `confirmedAt` padrão = `deliveredAt` + 1 h (`2026-11-20T18:00:00Z`).
  - `test/clock.ts`: `spDate(isoDate: string, hhmm: string): Date` (lança `RangeError` para data inexistente ou hora fora de `HH:mm`). `TABLES` passa a ter 14 nomes.
- Fatos verificados no clone (Drizzle 0.45.4, drizzle-kit 0.31, PGlite 0.5.17): o Postgres reporta o **primeiro CHECK que falha, em ordem alfabética de nome**: um status inválido cai em `handover_state_consistent` (vem antes de `handover_status_valid`, que fica como defesa em profundidade; o teste prova só que ele existe); `confirmed_by = delivered_by` com os quatro campos preenchidos só falha em `handover_confirmer_ne_deliverer`; `DELETE` de linha referenciada por FK `restrict` dá SQLSTATE `23001`; `bun run db:generate` não conecta ao banco.

- [ ] **Step 1: Write the failing tests**

Crie `test/clock.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { spDate } from "./clock";

describe("spDate", () => {
  it("converte hora de parede de São Paulo para UTC (+3 h)", () => {
    expect(spDate("2026-11-20", "14:05").toISOString()).toBe(
      "2026-11-20T17:05:00.000Z",
    );
  });

  it("23:59 em São Paulo já é o dia seguinte em UTC", () => {
    expect(spDate("2026-11-20", "23:59").toISOString()).toBe(
      "2026-11-21T02:59:00.000Z",
    );
  });

  it("00:00 em São Paulo é 03:00 UTC do mesmo dia", () => {
    expect(spDate("2026-11-21", "00:00").toISOString()).toBe(
      "2026-11-21T03:00:00.000Z",
    );
  });

  it("lança para data inexistente ou hora inválida", () => {
    expect(() => spDate("2026-02-30", "10:00")).toThrow(RangeError);
    expect(() => spDate("2026-11-20", "25:00")).toThrow(RangeError);
    expect(() => spDate("lixo", "10:00")).toThrow(RangeError);
  });
});
```

Crie `src/db/schema/handovers.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverCorrection,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { sqlErrorOf } from "../../../test/sqlError";
import { handover, handoverCorrection, handoverItem } from "./handovers";

const STATE = "handover_state_consistent";
const T1 = "2026-11-20T17:00:00Z";
const T2 = "2026-11-20T18:00:00Z";
const MISSING = "00000000-0000-4000-8000-000000000000";

describe("tabelas da passagem", () => {
  let client: PGlite;
  let db: TestDb;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    await resetDb(client);
  });

  async function scenario() {
    const sector = await insertSector(db, "ULD");
    const shift = await insertShift(db, { sectorId: sector.id });
    const item = await insertItem(db, { sectorId: sector.id });
    const role = "operator";
    const ana = await insertUser(db, { role, sectorId: sector.id });
    const bia = await insertUser(db, { role, sectorId: sector.id });
    const base = { sectorId: sector.id, shiftId: shift.id };
    return { sector, shift, item, ana, bia, base };
  }

  // SQL cru, para montar estados que o tipo do Drizzle e as fixtures não
  // deixam passar. "$ana" e "$bia" viram os ids das duas pessoas.
  async function rawHandover(
    extra: Record<string, string>,
    context?: Awaited<ReturnType<typeof scenario>>,
  ) {
    const { base, ana, bia } = context ?? (await scenario());
    const ids: Record<string, string> = { $ana: ana.id, $bia: bia.id };
    const row: Record<string, string> = {
      sector_id: base.sectorId,
      shift_id: base.shiftId,
      operational_date: "2026-11-20",
      ...Object.fromEntries(
        Object.entries(extra).map(([key, value]) => [key, ids[value] ?? value]),
      ),
    };
    const columns = Object.keys(row);
    const marks = columns.map((_, index) => `$${index + 1}`).join(", ");
    return client.query(
      `INSERT INTO handover (${columns.join(", ")}) VALUES (${marks})`,
      Object.values(row),
    );
  }

  describe("handover", () => {
    it("grava com os padrões: rascunho, textos vazios, dia como texto", async () => {
      const { base } = await scenario();
      const created = await insertHandover(db, base);
      const [row] = await db
        .select()
        .from(handover)
        .where(eq(handover.id, created.id));
      expect(row).toMatchObject({
        status: "draft",
        occurrencesText: "",
        nextShiftText: "",
        operationalDate: "2026-11-20",
        deliveredBy: null,
        updatedBy: null,
      });
      expect(row?.updatedAt).toBeInstanceOf(Date);
    });

    it.each([
      ["entregue sem delivered_by", { status: "delivered", delivered_at: T1 }],
      [
        "entregue sem delivered_at",
        { status: "delivered", delivered_by: "$ana" },
      ],
      ["rascunho com confirmed_by", { confirmed_by: "$bia" }],
      ["rascunho com delivered_by", { delivered_by: "$ana" }],
      [
        "entregue que já tem confirmação",
        {
          status: "delivered",
          delivered_by: "$ana",
          delivered_at: T1,
          confirmed_by: "$bia",
          confirmed_at: T2,
        },
      ],
      [
        "confirmada sem confirmed_at",
        {
          status: "confirmed",
          delivered_by: "$ana",
          delivered_at: T1,
          confirmed_by: "$bia",
        },
      ],
    ])("recusa %s com 23514 (state_consistent)", async (_label, extra) => {
      const failure = await sqlErrorOf(rawHandover(extra));
      expect(failure).toEqual({ code: "23514", constraint: STATE });
    });

    it("recusa status fora da lista com 23514 (e handover_status_valid existe)", async () => {
      const failure = await sqlErrorOf(rawHandover({ status: "archived" }));
      // O Postgres reporta o primeiro CHECK que falha, em ordem de nome:
      // state_consistent vem antes de status_valid, e os dois recusam.
      expect(failure.code).toBe("23514");
      expect([STATE, "handover_status_valid"]).toContain(failure.constraint);
      const { rows } = await client.query(
        "SELECT 1 FROM pg_constraint WHERE conname = 'handover_status_valid'",
      );
      expect(rows).toHaveLength(1);
    });

    it("recusa quem confirmou = quem entregou com 23514, no INSERT e no UPDATE", async () => {
      const constraint = "handover_confirmer_ne_deliverer";
      const context = await scenario();
      const { base, ana } = context;
      const insert = await sqlErrorOf(
        rawHandover(
          {
            status: "confirmed",
            delivered_by: "$ana",
            delivered_at: T1,
            confirmed_by: "$ana",
            confirmed_at: T2,
          },
          context,
        ),
      );
      expect(insert).toEqual({ code: "23514", constraint });

      const created = await insertHandover(db, {
        ...base,
        status: "delivered",
        deliveredBy: ana.id,
      });
      const update = await sqlErrorOf(
        client.query(
          "UPDATE handover SET status = 'confirmed', confirmed_by = $2, confirmed_at = now() WHERE id = $1",
          [created.id, ana.id],
        ),
      );
      expect(update).toEqual({ code: "23514", constraint });
    });

    it("aceita as três combinações válidas; repetir a tripla dá 23505", async () => {
      const { base, ana, bia } = await scenario();
      await insertHandover(db, { ...base, operationalDate: "2026-11-18" });
      await insertHandover(db, {
        ...base,
        operationalDate: "2026-11-19",
        status: "delivered",
        deliveredBy: ana.id,
      });
      await insertHandover(db, {
        ...base,
        status: "confirmed",
        deliveredBy: ana.id,
        confirmedBy: bia.id,
      });
      const rows = await db.select({ status: handover.status }).from(handover);
      expect(rows.map((row) => row.status).sort()).toEqual([
        "confirmed",
        "delivered",
        "draft",
      ]);
      const failure = await sqlErrorOf(insertHandover(db, base));
      expect(failure).toEqual({
        code: "23505",
        constraint: "handover_sector_shift_date_uq",
      });
    });

    it("ON CONFLICT DO NOTHING RETURNING devolve a linha na 1ª vez e [] na 2ª", async () => {
      const { base } = await scenario();
      const insert = () =>
        db
          .insert(handover)
          .values({ ...base, operationalDate: "2026-11-20" })
          .onConflictDoNothing()
          .returning({ id: handover.id });
      expect(await insert()).toHaveLength(1);
      expect(await insert()).toEqual([]);
    });

    it("SELECT … FOR UPDATE devolve o dia como texto e updatedAt como Date", async () => {
      const { base } = await scenario();
      const created = await insertHandover(db, base);
      const rows = await db.transaction((tx) =>
        tx
          .select()
          .from(handover)
          .where(eq(handover.id, created.id))
          .for("update"),
      );
      expect(rows[0]?.operationalDate).toBe("2026-11-20");
      expect(rows[0]?.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("handover_item", () => {
    async function withHandover() {
      const context = await scenario();
      const created = await insertHandover(db, context.base);
      return { ...context, handoverId: created.id };
    }

    it("quantidade começa em 0, observação nula; snapshot: true copia o item", async () => {
      const { handoverId, item, sector } = await withHandover();
      await insertHandoverItem(db, { handoverId, itemId: item.id });
      const stock = await insertItem(db, {
        sectorId: sector.id,
        name: "Rede de proteção",
        unit: "rolo",
        kind: "stock",
      });
      await insertHandoverItem(db, {
        handoverId,
        itemId: stock.id,
        quantity: 3,
        snapshot: true,
      });
      const rows = await db.select().from(handoverItem);
      expect(rows.find((row) => row.itemId === item.id)).toMatchObject({
        quantity: 0,
        note: null,
        itemNameSnapshot: null,
      });
      expect(rows.find((row) => row.itemId === stock.id)).toMatchObject({
        quantity: 3,
        itemNameSnapshot: "Rede de proteção",
        itemUnitSnapshot: "rolo",
        itemKindSnapshot: "stock",
      });
    });

    it("aceita quantidade grande e recusa -1 com 23514", async () => {
      const { handoverId, item, sector } = await withHandover();
      await insertHandoverItem(db, {
        handoverId,
        itemId: item.id,
        quantity: 2_147_483_647,
      });
      const other = await insertItem(db, { sectorId: sector.id });
      const failure = await sqlErrorOf(
        insertHandoverItem(db, {
          handoverId,
          itemId: other.id,
          quantity: -1,
        }),
      );
      expect(failure).toEqual({
        code: "23514",
        constraint: "handover_item_quantity_nonneg",
      });
    });

    it("recusa tipo de snapshot inválido com 23514", async () => {
      const { handoverId, item } = await withHandover();
      const failure = await sqlErrorOf(
        client.query(
          "INSERT INTO handover_item (handover_id, item_id, item_kind_snapshot) VALUES ($1, $2, 'misto')",
          [handoverId, item.id],
        ),
      );
      expect(failure).toEqual({
        code: "23514",
        constraint: "handover_item_kind_snapshot_valid",
      });
    });

    it("recusa o mesmo item duas vezes com 23505; o upsert troca a quantidade", async () => {
      const { handoverId, item } = await withHandover();
      await insertHandoverItem(db, { handoverId, itemId: item.id });
      const failure = await sqlErrorOf(
        insertHandoverItem(db, { handoverId, itemId: item.id }),
      );
      expect(failure).toEqual({
        code: "23505",
        constraint: "handover_item_handover_id_item_id_pk",
      });
      await db
        .insert(handoverItem)
        .values({ handoverId, itemId: item.id, quantity: 7 })
        .onConflictDoUpdate({
          target: [handoverItem.handoverId, handoverItem.itemId],
          set: { quantity: 7 },
        });
      const rows = await db.select().from(handoverItem);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.quantity).toBe(7);
    });

    it("recusa item inexistente com 23503", async () => {
      const { handoverId } = await withHandover();
      const failure = await sqlErrorOf(
        insertHandoverItem(db, { handoverId, itemId: MISSING }),
      );
      expect(failure.code).toBe("23503");
    });
  });

  describe("handover_correction", () => {
    async function confirmed() {
      const context = await scenario();
      const created = await insertHandover(db, {
        ...context.base,
        status: "confirmed",
        deliveredBy: context.ana.id,
        confirmedBy: context.bia.id,
      });
      return { ...context, handoverId: created.id };
    }

    it("grava correção de item e de texto (inclusive valor antigo vazio)", async () => {
      const { handoverId, item, bia } = await confirmed();
      await insertHandoverCorrection(db, {
        handoverId,
        field: "item_quantity",
        itemId: item.id,
        oldValue: "3",
        newValue: "4",
        correctedBy: bia.id,
      });
      await insertHandoverCorrection(db, {
        handoverId,
        field: "next_shift_text",
        oldValue: "",
        newValue: "Conferir a rede",
        correctedBy: bia.id,
      });
      const rows = await db.select().from(handoverCorrection);
      expect(rows).toHaveLength(2);
      expect(rows[0]?.correctedAt).toBeInstanceOf(Date);
      expect(rows.some((row) => row.oldValue === "")).toBe(true);
    });

    it.each([
      [
        "campo de item sem item_id",
        "'item_quantity', NULL, 'Motivo'",
        "item_matches_field",
      ],
      [
        "campo de texto com item_id",
        "'next_shift_text', $3, 'Motivo'",
        "item_matches_field",
      ],
      ["campo fora da lista", "'status', NULL, 'Motivo'", "field_valid"],
      [
        "motivo só com espaços",
        "'occurrences_text', NULL, '   '",
        "reason_not_blank",
      ],
      ["motivo vazio", "'occurrences_text', NULL, ''", "reason_not_blank"],
    ])("recusa %s com 23514", async (_label, values, suffix) => {
      const { handoverId, item, bia } = await confirmed();
      const failure = await sqlErrorOf(
        client.query(
          `INSERT INTO handover_correction (handover_id, corrected_by, field, item_id, reason, old_value, new_value) VALUES ($1, $2, ${values.replace("$3", `'${item.id}'`)}, 'a', 'b')`,
          [handoverId, bia.id],
        ),
      );
      expect(failure).toEqual({
        code: "23514",
        constraint: `handover_correction_${suffix}`,
      });
    });
  });

  describe("FK restrict (23001)", () => {
    async function delivered() {
      const context = await scenario();
      const created = await insertHandover(db, {
        ...context.base,
        status: "delivered",
        deliveredBy: context.ana.id,
      });
      await insertHandoverItem(db, {
        handoverId: created.id,
        itemId: context.item.id,
      });
      return { ...context, handoverId: created.id };
    }

    it.each([
      ["shift", "handover_shift_id_shift_id_fk"],
      ["item", "handover_item_item_id_item_id_fk"],
      ["sector", undefined],
      ["user", "handover_delivered_by_user_id_fk"],
      ["handover", "handover_item_handover_id_handover_id_fk"],
    ] as const)("não apaga %s referenciado por passagem", async (table, constraint) => {
      const context = await delivered();
      const ids = {
        shift: context.shift.id,
        item: context.item.id,
        sector: context.sector.id,
        user: context.ana.id,
        handover: context.handoverId,
      };
      const failure = await sqlErrorOf(
        client.query(`DELETE FROM "${table}" WHERE id = $1`, [ids[table]]),
      );
      expect(failure.code).toBe("23001");
      if (constraint) expect(failure.constraint).toBe(constraint);
    });

    it("não apaga quem corrigiu nem a passagem que tem correção", async () => {
      const { handoverId, bia } = await delivered();
      await insertHandoverCorrection(db, {
        handoverId,
        field: "occurrences_text",
        correctedBy: bia.id,
      });
      const user = await sqlErrorOf(
        client.query(`DELETE FROM "user" WHERE id = $1`, [bia.id]),
      );
      expect(user.constraint).toBe(
        "handover_correction_corrected_by_user_id_fk",
      );
      await client.query("DELETE FROM handover_item");
      const parent = await sqlErrorOf(
        client.query("DELETE FROM handover WHERE id = $1", [handoverId]),
      );
      expect(parent.constraint).toBe(
        "handover_correction_handover_id_handover_id_fk",
      );
    });
  });

  describe("fixtures", () => {
    it("insertHandover lança para estado impossível e usa datas padrão", async () => {
      const { base, ana, bia } = await scenario();
      const confirmedBase = { ...base, status: "confirmed" as const };
      const cases = [
        [{ status: "delivered" as const }, "exige deliveredBy"],
        [{ ...confirmedBase, deliveredBy: ana.id }, "exige confirmedBy"],
        [
          { ...confirmedBase, deliveredBy: ana.id, confirmedBy: ana.id },
          "quem entregou não confirma",
        ],
        [{ deliveredBy: ana.id }, "rascunho não tem entrega"],
        [{ confirmedBy: bia.id }, "rascunho não tem confirmação"],
        [
          {
            status: "delivered" as const,
            deliveredBy: ana.id,
            confirmedBy: bia.id,
          },
          "entregue não tem confirmação",
        ],
      ] as const;
      for (const [input, message] of cases) {
        await expect(insertHandover(db, { ...base, ...input })).rejects.toThrow(
          message,
        );
      }
      expect(await db.select().from(handover)).toHaveLength(0);

      const created = await insertHandover(db, {
        ...confirmedBase,
        deliveredBy: ana.id,
        confirmedBy: bia.id,
      });
      const [row] = await db
        .select()
        .from(handover)
        .where(eq(handover.id, created.id));
      expect(row?.deliveredAt?.toISOString()).toBe("2026-11-20T17:00:00.000Z");
      expect(row?.confirmedAt?.toISOString()).toBe("2026-11-20T18:00:00.000Z");
    });

    it("insertHandoverItem e insertHandoverCorrection lançam para estado impossível", async () => {
      const { base, item, bia } = await scenario();
      const { id } = await insertHandover(db, base);
      await expect(
        insertHandoverItem(db, {
          handoverId: id,
          itemId: MISSING,
          snapshot: true,
        }),
      ).rejects.toThrow("item do snapshot não existe");
      await expect(
        insertHandoverCorrection(db, {
          handoverId: id,
          field: "item_note",
          correctedBy: bia.id,
        }),
      ).rejects.toThrow("exige itemId");
      await expect(
        insertHandoverCorrection(db, {
          handoverId: id,
          field: "occurrences_text",
          itemId: item.id,
          correctedBy: bia.id,
        }),
      ).rejects.toThrow("não aceita itemId");
    });

    it("insertShift aceita createdAt (turno antigo)", async () => {
      const { sector } = await scenario();
      const created = await insertShift(db, {
        sectorId: sector.id,
        createdAt: new Date("2026-01-05T12:00:00Z"),
      });
      const { rows } = await client.query<{ created_at: string }>(
        "SELECT created_at FROM shift WHERE id = $1",
        [created.id],
      );
      expect(new Date(rows[0]?.created_at ?? "").toISOString()).toBe(
        "2026-01-05T12:00:00.000Z",
      );
    });
  });
});
```

Crie `src/db/schema/migration0003.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

// Aplica 0000–0002 (o banco como está depois da Fase 2), insere dados e aplica
// a 0003 por cima: é o que o db:migrate faz no Neon.
const MIGRATIONS = readdirSync("drizzle")
  .filter((file) => file.endsWith(".sql"))
  .sort();

const SECTOR = "11111111-1111-4111-8111-111111111111";
const SHIFT = "22222222-2222-4222-8222-222222222222";
const ITEM = "33333333-3333-4333-8333-333333333333";

function migrationFile(prefix: string): string {
  const file = MIGRATIONS.find((name) => name.startsWith(prefix));
  if (!file) throw new Error(`migração ${prefix} não encontrada`);
  return file;
}

function statementsOf(file: string): string[] {
  return readFileSync(`drizzle/${file}`, "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement !== "");
}

async function applyMigration(client: PGlite, file: string): Promise<void> {
  for (const statement of statementsOf(file)) {
    await client.exec(statement);
  }
}

// Cada teste cria um PGlite novo e aplica todas as migrações: sob carga passa
// dos 15 s padrão (mesmo padrão da migration0002), então o describe leva 60 s.
describe("migração 0003 sobre os dados da 0002", { timeout: 60_000 }, () => {
  let client: PGlite | undefined;

  afterEach(async () => {
    await client?.close();
    client = undefined;
  });

  async function dbAtPhase2(): Promise<PGlite> {
    const created = new PGlite();
    client = created;
    await created.waitReady;
    for (const prefix of ["0000", "0001", "0002"]) {
      await applyMigration(created, migrationFile(prefix));
    }
    await created.exec(`
      INSERT INTO sector (id, name) VALUES ('${SECTOR}', 'ULD');
      INSERT INTO "user" (id, name, email, role, sector_id)
        VALUES ('u-admin', 'Admin Teste', 'admin@example.test', 'admin', NULL),
               ('u-op', 'Operador Teste', 'op@example.test', 'operator', '${SECTOR}');
      INSERT INTO shift (id, sector_id, name, starts_at, ends_at, sort_order)
        VALUES ('${SHIFT}', '${SECTOR}', 'Turno Manhã', '06:00', '14:00', 1);
      INSERT INTO item (id, sector_id, name, unit, kind, sort_order)
        VALUES ('${ITEM}', '${SECTOR}', 'Rede de proteção', 'rolo', 'stock', 1);
      INSERT INTO destination (name) VALUES ('Destino Teste');
    `);
    return created;
  }

  it("é só aditiva: cria tabelas, constraints e índices, sem apagar nem alterar nada", () => {
    const statements = statementsOf(migrationFile("0003"));
    expect(statements.length).toBeGreaterThan(0);
    for (const statement of statements) {
      expect(statement).toMatch(
        /^(CREATE TABLE|ALTER TABLE "[a-z_]+" ADD CONSTRAINT|CREATE (UNIQUE )?INDEX)/,
      );
    }
  });

  it("aplica e preserva setor, turno, item, destino e usuários existentes", async () => {
    const pg = await dbAtPhase2();
    await applyMigration(pg, migrationFile("0003"));

    expect((await pg.query("SELECT name FROM sector")).rows).toEqual([
      { name: "ULD" },
    ]);
    expect((await pg.query("SELECT name FROM shift")).rows).toEqual([
      { name: "Turno Manhã" },
    ]);
    expect((await pg.query("SELECT name FROM item")).rows).toEqual([
      { name: "Rede de proteção" },
    ]);
    expect((await pg.query("SELECT name FROM destination")).rows).toEqual([
      { name: "Destino Teste" },
    ]);
    expect((await pg.query(`SELECT id FROM "user"`)).rows).toHaveLength(2);

    const tables = await pg.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'handover%' ORDER BY tablename",
    );
    expect(tables.rows.map((row) => row.tablename)).toEqual([
      "handover",
      "handover_correction",
      "handover_item",
    ]);
  });

  it("as tabelas novas começam vazias e já referenciam os turnos e itens da 0002", async () => {
    const pg = await dbAtPhase2();
    await applyMigration(pg, migrationFile("0003"));
    expect((await pg.query("SELECT 1 FROM handover")).rows).toHaveLength(0);

    await pg.exec(`
      INSERT INTO handover (id, sector_id, shift_id, operational_date)
        VALUES ('44444444-4444-4444-8444-444444444444', '${SECTOR}', '${SHIFT}', '2026-11-20');
      INSERT INTO handover_item (handover_id, item_id, quantity)
        VALUES ('44444444-4444-4444-8444-444444444444', '${ITEM}', 2);
    `);
    const rows = await pg.query<{ operational_date: string; quantity: number }>(
      "SELECT h.operational_date::text AS operational_date, i.quantity FROM handover h JOIN handover_item i ON i.handover_id = h.id",
    );
    expect(rows.rows).toEqual([
      { operational_date: "2026-11-20", quantity: 2 },
    ]);
  });

  it("cria os 8 CHECKs, os 10 índices e as 10 FKs restrict do contrato", async () => {
    const pg = await dbAtPhase2();
    await applyMigration(pg, migrationFile("0003"));

    const checks = await pg.query<{ conname: string }>(
      "SELECT conname FROM pg_constraint WHERE contype = 'c' AND conname LIKE 'handover%' ORDER BY conname",
    );
    expect(checks.rows.map((row) => row.conname)).toEqual([
      "handover_confirmer_ne_deliverer",
      "handover_correction_field_valid",
      "handover_correction_item_matches_field",
      "handover_correction_reason_not_blank",
      "handover_item_kind_snapshot_valid",
      "handover_item_quantity_nonneg",
      "handover_state_consistent",
      "handover_status_valid",
    ]);

    const indexes = await pg.query<{ indexname: string }>(
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename LIKE 'handover%' AND indexname NOT LIKE '%_pkey' AND indexname NOT LIKE '%_pk' ORDER BY indexname",
    );
    expect(indexes.rows.map((row) => row.indexname)).toEqual([
      "handover_confirmed_by_idx",
      "handover_correction_corrected_by_idx",
      "handover_correction_handover_idx",
      "handover_correction_item_id_idx",
      "handover_delivered_by_idx",
      "handover_item_item_id_idx",
      "handover_sector_date_idx",
      "handover_sector_shift_date_uq",
      "handover_shift_id_idx",
      "handover_updated_by_idx",
    ]);

    const fks = await pg.query<{ confdeltype: string }>(
      "SELECT confdeltype FROM pg_constraint WHERE contype = 'f' AND conrelid::regclass::text LIKE 'handover%'",
    );
    expect(fks.rows).toHaveLength(10);
    // 'r' = RESTRICT
    expect(new Set(fks.rows.map((row) => row.confdeltype))).toEqual(
      new Set(["r"]),
    );
  });
});
```

- [ ] **Step 2: Escrever o apoio dos testes (`TABLES` e fixtures)**

Em `test/db.ts`, **leia o arquivo** e acrescente os três nomes ao fim de `TABLES`:

```ts
  "destination",
  "handover",
  "handover_item",
  "handover_correction",
];
```

Em `test/fixtures.ts`, **leia o arquivo** e faça quatro edições.

(a) Imports: troque `import { sql } from "drizzle-orm";` por `import { eq, sql } from "drizzle-orm";` e acrescente, logo depois do import de `@/db/schema/catalog`:

```ts
import {
  type CorrectionField,
  type HandoverStatus,
  handover,
  handoverCorrection,
  handoverItem,
} from "@/db/schema/handovers";
```

(b) Em `insertShift`, acrescente `createdAt?: Date;` ao fim do tipo de `input` (depois de `active?: boolean;`) e, em `.values({ … })`, depois de `active: input.active ?? true,`:

```ts
      ...(input.createdAt ? { createdAt: input.createdAt } : {}),
```

(c) Troque o comentário de `insertShift`, `// Turno do setor. Padrões: nome único, 06:00–14:00, ordem = maior do setor + 1.`, por:

```ts
// Turno do setor. Padrões: nome único, 06:00–14:00, ordem = maior do setor + 1;
// `createdAt` opcional simula um turno antigo (o histórico só gera "sem passagem" a partir dele).
```

(d) Acrescente ao **fim** do arquivo:

```ts
const DEFAULT_DELIVERED_AT = new Date("2026-11-20T17:00:00Z");
const HOUR_MS = 60 * 60 * 1000;

// Passagem direto na tabela. Lança para estado impossível (o banco também
// recusaria): rascunho com entrega/confirmação, entregue sem quem entregou,
// confirmada sem quem confirmou, quem confirmou = quem entregou. Para provar
// os CHECKs do banco, insira com SQL cru.
export async function insertHandover(
  db: Db,
  input: {
    sectorId: string;
    shiftId: string;
    operationalDate?: string;
    status?: HandoverStatus;
    occurrencesText?: string;
    nextShiftText?: string;
    deliveredBy?: string;
    deliveredAt?: Date;
    confirmedBy?: string;
    confirmedAt?: Date;
    confirmationNote?: string;
    updatedBy?: string;
    shiftNameSnapshot?: string;
  },
): Promise<{ id: string }> {
  const status = input.status ?? "draft";
  if (status === "draft") {
    if (input.deliveredBy || input.deliveredAt) {
      throw new Error("fixture: rascunho não tem entrega");
    }
    if (input.confirmedBy || input.confirmedAt || input.confirmationNote) {
      throw new Error("fixture: rascunho não tem confirmação");
    }
  } else {
    if (!input.deliveredBy) {
      throw new Error(`fixture: passagem ${status} exige deliveredBy`);
    }
    if (status === "delivered") {
      if (input.confirmedBy || input.confirmedAt || input.confirmationNote) {
        throw new Error("fixture: passagem entregue não tem confirmação");
      }
    } else {
      if (!input.confirmedBy) {
        throw new Error("fixture: passagem confirmed exige confirmedBy");
      }
      if (input.confirmedBy === input.deliveredBy) {
        throw new Error("fixture: quem entregou não confirma");
      }
    }
  }
  const deliveredAt =
    status === "draft" ? null : (input.deliveredAt ?? DEFAULT_DELIVERED_AT);
  const confirmedAt =
    status === "confirmed" && deliveredAt
      ? (input.confirmedAt ?? new Date(deliveredAt.getTime() + HOUR_MS))
      : null;
  const [created] = await db
    .insert(handover)
    .values({
      sectorId: input.sectorId,
      shiftId: input.shiftId,
      operationalDate: input.operationalDate ?? "2026-11-20",
      status,
      occurrencesText: input.occurrencesText ?? "",
      nextShiftText: input.nextShiftText ?? "",
      deliveredBy: status === "draft" ? null : (input.deliveredBy ?? null),
      deliveredAt,
      confirmedBy: status === "confirmed" ? (input.confirmedBy ?? null) : null,
      confirmedAt,
      confirmationNote: input.confirmationNote ?? null,
      updatedBy: input.updatedBy ?? null,
      shiftNameSnapshot: input.shiftNameSnapshot ?? null,
    })
    .returning({ id: handover.id });
  if (!created) throw new Error("fixture: passagem não criada");
  return created;
}

// Linha de item da passagem. `snapshot: true` copia nome, unidade e tipo do
// item (o que a entrega faz).
export async function insertHandoverItem(
  db: Db,
  input: {
    handoverId: string;
    itemId: string;
    quantity?: number;
    note?: string | null;
    snapshot?: boolean;
  },
): Promise<void> {
  let snapshot: {
    itemNameSnapshot: string;
    itemUnitSnapshot: string;
    itemKindSnapshot: ItemKind;
  } | null = null;
  if (input.snapshot) {
    const [source] = await db
      .select({ name: item.name, unit: item.unit, kind: item.kind })
      .from(item)
      .where(eq(item.id, input.itemId));
    if (!source) throw new Error("fixture: item do snapshot não existe");
    snapshot = {
      itemNameSnapshot: source.name,
      itemUnitSnapshot: source.unit,
      itemKindSnapshot: source.kind,
    };
  }
  await db.insert(handoverItem).values({
    handoverId: input.handoverId,
    itemId: input.itemId,
    quantity: input.quantity ?? 0,
    note: input.note ?? null,
    ...(snapshot ?? {}),
  });
}

// Linha de correção. Campo de item exige itemId; campo de texto não aceita.
export async function insertHandoverCorrection(
  db: Db,
  input: {
    handoverId: string;
    field: CorrectionField;
    itemId?: string;
    oldValue?: string;
    newValue?: string;
    reason?: string;
    correctedBy: string;
    correctedAt?: Date;
  },
): Promise<{ id: string }> {
  const isItemField =
    input.field === "item_quantity" || input.field === "item_note";
  if (isItemField && !input.itemId) {
    throw new Error(`fixture: o campo ${input.field} exige itemId`);
  }
  if (!isItemField && input.itemId) {
    throw new Error(`fixture: o campo ${input.field} não aceita itemId`);
  }
  const [created] = await db
    .insert(handoverCorrection)
    .values({
      handoverId: input.handoverId,
      field: input.field,
      itemId: input.itemId ?? null,
      oldValue: input.oldValue ?? "antes",
      newValue: input.newValue ?? "depois",
      reason: input.reason ?? "Motivo de teste",
      correctedBy: input.correctedBy,
      ...(input.correctedAt ? { correctedAt: input.correctedAt } : {}),
    })
    .returning({ id: handoverCorrection.id });
  if (!created) throw new Error("fixture: correção não criada");
  return created;
}
```

`test/clock.ts` só é criado no Step 4 (o `test/clock.test.ts` precisa falhar antes).

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test -- test/clock.test.ts src/db/schema/handovers.test.ts src/db/schema/migration0003.test.ts test/db.test.ts`
Expected: FAIL nos quatro arquivos:
- `test/clock.test.ts`: `Cannot find module './clock' imported from …/test/clock.test.ts`;
- `src/db/schema/handovers.test.ts`: `Cannot find package '@/db/schema/handovers' imported from …/test/fixtures.ts`;
- `src/db/schema/migration0003.test.ts`: 4 testes com `Error: migração 0003 não encontrada`;
- `test/db.test.ts`: `TABLES lista exatamente as tabelas do schema public` com `AssertionError` (o banco migrado ainda não tem as três tabelas).

- [ ] **Step 4: Write minimal implementation (schema, index e relógio de teste)**

Crie `src/db/schema/handovers.ts`:

```ts
import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { ITEM_KINDS } from "@/lib/itemKinds";

import { user } from "./auth";
import { item, shift } from "./catalog";
import { sector } from "./sectors";

export const HANDOVER_STATUSES = ["draft", "delivered", "confirmed"] as const;
export type HandoverStatus = (typeof HANDOVER_STATUSES)[number];

export const CORRECTION_FIELDS = [
  "occurrences_text",
  "next_shift_text",
  "item_quantity",
  "item_note",
] as const;
export type CorrectionField = (typeof CORRECTION_FIELDS)[number];

// Passagem de turno: uma por setor + turno + dia operacional (UNIQUE). O dia
// operacional é `date` e trafega como texto "YYYY-MM-DD" (nunca vira Date).
export const handover = pgTable(
  "handover",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectorId: uuid("sector_id")
      .notNull()
      .references(() => sector.id, { onDelete: "restrict" }),
    shiftId: uuid("shift_id")
      .notNull()
      .references(() => shift.id, { onDelete: "restrict" }),
    operationalDate: date("operational_date", { mode: "string" }).notNull(),
    status: text("status", { enum: HANDOVER_STATUSES })
      .notNull()
      .default("draft"),
    // Nome do turno no momento da entrega: renomear o turno depois não muda o
    // que foi entregue.
    shiftNameSnapshot: text("shift_name_snapshot"),
    occurrencesText: text("occurrences_text").notNull().default(""),
    nextShiftText: text("next_shift_text").notNull().default(""),
    deliveredBy: text("delivered_by").references(() => user.id, {
      onDelete: "restrict",
    }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    confirmedBy: text("confirmed_by").references(() => user.id, {
      onDelete: "restrict",
    }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    confirmationNote: text("confirmation_note"),
    // Quem salvou por último: alimenta "Salvo às HH:mm por {nome}".
    updatedBy: text("updated_by").references(() => user.id, {
      onDelete: "restrict",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("handover_sector_shift_date_uq").on(
      table.sectorId,
      table.shiftId,
      table.operationalDate,
    ),
    // Histórico: filtra por setor e período.
    index("handover_sector_date_idx").on(table.sectorId, table.operationalDate),
    // Um índice por FK que o UNIQUE acima não cobre.
    index("handover_shift_id_idx").on(table.shiftId),
    index("handover_delivered_by_idx").on(table.deliveredBy),
    index("handover_confirmed_by_idx").on(table.confirmedBy),
    index("handover_updated_by_idx").on(table.updatedBy),
    check(
      "handover_status_valid",
      sql`${table.status} in ('draft', 'delivered', 'confirmed')`,
    ),
    // Quem entregou nunca confirma. Sozinho passa quando delivered_by é NULL
    // (comparação com NULL); handover_state_consistent fecha esse buraco.
    check(
      "handover_confirmer_ne_deliverer",
      sql`${table.confirmedBy} is null or ${table.confirmedBy} <> ${table.deliveredBy}`,
    ),
    check(
      "handover_state_consistent",
      sql`(${table.status} = 'draft' and ${table.deliveredBy} is null and ${table.deliveredAt} is null and ${table.confirmedBy} is null and ${table.confirmedAt} is null) or (${table.status} = 'delivered' and ${table.deliveredBy} is not null and ${table.deliveredAt} is not null and ${table.confirmedBy} is null and ${table.confirmedAt} is null) or (${table.status} = 'confirmed' and ${table.deliveredBy} is not null and ${table.deliveredAt} is not null and ${table.confirmedBy} is not null and ${table.confirmedAt} is not null)`,
    ),
  ],
);

// Contagem de um item na passagem. Os snapshots (nome, unidade, tipo) ficam
// nulos no rascunho e são preenchidos na entrega.
export const handoverItem = pgTable(
  "handover_item",
  {
    handoverId: uuid("handover_id")
      .notNull()
      .references(() => handover.id, { onDelete: "restrict" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => item.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull().default(0),
    note: text("note"),
    itemNameSnapshot: text("item_name_snapshot"),
    itemUnitSnapshot: text("item_unit_snapshot"),
    itemKindSnapshot: text("item_kind_snapshot", { enum: ITEM_KINDS }),
  },
  (table) => [
    primaryKey({ columns: [table.handoverId, table.itemId] }),
    index("handover_item_item_id_idx").on(table.itemId),
    // O teto (MAX_QUANTITY) fica no domínio: mudar o teto não exige migração.
    check("handover_item_quantity_nonneg", sql`${table.quantity} >= 0`),
    check(
      "handover_item_kind_snapshot_valid",
      sql`${table.itemKindSnapshot} is null or ${table.itemKindSnapshot} in ('control', 'stock')`,
    ),
  ],
);

// Rastro de correção depois da confirmação (D13): uma linha por campo
// alterado. Nunca UPDATE nem DELETE.
export const handoverCorrection = pgTable(
  "handover_correction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    handoverId: uuid("handover_id")
      .notNull()
      .references(() => handover.id, { onDelete: "restrict" }),
    field: text("field", { enum: CORRECTION_FIELDS }).notNull(),
    itemId: uuid("item_id").references(() => item.id, {
      onDelete: "restrict",
    }),
    oldValue: text("old_value").notNull(),
    newValue: text("new_value").notNull(),
    reason: text("reason").notNull(),
    correctedBy: text("corrected_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    correctedAt: timestamp("corrected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("handover_correction_handover_idx").on(
      table.handoverId,
      table.correctedAt,
    ),
    index("handover_correction_item_id_idx").on(table.itemId),
    index("handover_correction_corrected_by_idx").on(table.correctedBy),
    check(
      "handover_correction_field_valid",
      sql`${table.field} in ('occurrences_text', 'next_shift_text', 'item_quantity', 'item_note')`,
    ),
    // Campo de item exige item_id; campo de texto não pode ter item_id.
    check(
      "handover_correction_item_matches_field",
      sql`(${table.field} in ('item_quantity', 'item_note')) = (${table.itemId} is not null)`,
    ),
    check(
      "handover_correction_reason_not_blank",
      sql`char_length(btrim(${table.reason})) > 0`,
    ),
  ],
);
```

Em `src/db/schema/index.ts`, acrescente a linha `export * from "./handovers";` (em ordem alfabética, depois de `./catalog`):

```ts
export * from "./auth";
export * from "./catalog";
export * from "./handovers";
export * from "./invites";
export * from "./sectors";
```

Crie `test/clock.ts`:

```ts
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

// O V8 aceita "2026-02-30" e rola para março; aqui a data tem de existir.
function isRealDate(isoDate: string): boolean {
  const match = ISO_DATE.exec(isoDate);
  if (!match) return false;
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

// Hora de parede de São Paulo → Date, para testes de tempo (nunca o relógio
// real). O Brasil não tem horário de verão desde 2019, então o offset é fixo
// em -03:00; se isso mudar, esta é a única linha a rever.
export function spDate(isoDate: string, hhmm: string): Date {
  if (!isRealDate(isoDate) || !HH_MM.test(hhmm)) {
    throw new RangeError(`spDate: data ou hora inválida: ${isoDate} ${hhmm}`);
  }
  return new Date(`${isoDate}T${hhmm}:00-03:00`);
}
```

- [ ] **Step 5: Gerar a migração e revisar o SQL**

Run: `bun run db:generate -- --name fase3_passagem`
Expected: `14 tables`, as linhas `handover 16 columns 6 indexes 5 fks`, `handover_correction 9 columns 3 indexes 3 fks`, `handover_item 7 columns 1 indexes 2 fks` e `[✓] Your SQL migration file ➜ drizzle\0003_fase3_passagem.sql 🚀` (o drizzle-kit também cria `drizzle/meta/0003_snapshot.json` e acrescenta `0003_fase3_passagem` em `drizzle/meta/_journal.json`). O `.sql` tem 23 statements (3 `CREATE TABLE`, 10 `ALTER TABLE … ADD CONSTRAINT … FOREIGN KEY`, 10 `CREATE INDEX`/`CREATE UNIQUE INDEX`); o primeiro é:

```sql
CREATE TABLE "handover" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sector_id" uuid NOT NULL,
	"shift_id" uuid NOT NULL,
	"operational_date" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"shift_name_snapshot" text,
	"occurrences_text" text DEFAULT '' NOT NULL,
	"next_shift_text" text DEFAULT '' NOT NULL,
	"delivered_by" text,
	"delivered_at" timestamp with time zone,
	"confirmed_by" text,
	"confirmed_at" timestamp with time zone,
	"confirmation_note" text,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "handover_status_valid" CHECK ("handover"."status" in ('draft', 'delivered', 'confirmed')),
	CONSTRAINT "handover_confirmer_ne_deliverer" CHECK ("handover"."confirmed_by" is null or "handover"."confirmed_by" <> "handover"."delivered_by"),
	CONSTRAINT "handover_state_consistent" CHECK (( … as três combinações: draft, delivered, confirmed … ))
);
```

**O que revisar no SQL antes de seguir** (`db:generate` → revisar → `db:migrate`):
1. Só `CREATE TABLE`, `ALTER TABLE … ADD CONSTRAINT` e `CREATE INDEX`: nada de `DROP` nem `ALTER COLUMN` em tabela existente (o `migration0003.test.ts` trava isso).
2. Dez FKs, todas `ON DELETE restrict` (nada de `cascade`: passagem e rastro nunca somem por tabela filha).
3. Oito CHECKs com os nomes do contrato (três em `handover`, dois em `handover_item`, três em `handover_correction`); `handover_state_consistent` tem as três combinações e `handover_confirmer_ne_deliverer` está presente.
4. Dez índices, um por FK que o `UNIQUE (sector_id, shift_id, operational_date)` não cobre, mais `handover_sector_date_idx` para o histórico.
5. `operational_date` é `date NOT NULL` (sem fuso); entrega, confirmação e correção são `timestamp with time zone`.
6. Limitação conhecida: o `btrim` do CHECK de motivo só apara espaços; um motivo só de tabulação passa no banco (o domínio normaliza com `trim()` antes, Tarefa 3).

- [ ] **Step 6: Run test to verify it passes**

Run: `bun run test -- test/clock.test.ts src/db/schema/handovers.test.ts src/db/schema/migration0003.test.ts test/db.test.ts`
Expected: PASS (42 testes: 4 em `clock.test.ts`, 32 em `handovers.test.ts`, 4 em `migration0003.test.ts`, 2 em `db.test.ts`).

- [ ] **Step 7: Formatar e rodar a verificação completa**

Run: `bunx biome check --write src test && bun run check-types && bun run lint && bun run test`
Expected: sem erros de tipo, Biome sem pendências e a suíte inteira verde (Fases 0–2 continuam passando: a migração só acrescenta tabelas). Em máquina sob carga o Vitest pode registrar `Failed to start forks worker … Timeout waiting for worker to respond` num `.test.tsx` aleatório; é a partida do worker, não falha de teste: rode `bun run test -- --maxWorkers=4`. `TestTimeoutError` em `migration000*.test.ts` sob carga também é infraestrutura: rode o arquivo isolado.

- [ ] **Step 8: Aplicar a migração no Neon de dev (passo manual do desenvolvedor)**

**Não rode no clone de redação do plano.** No checkout de trabalho (com `.env.local`; em worktree, copie-o antes):

Run: `bun run db:migrate`
Expected: o drizzle-kit aplica `0003_fase3_passagem` e termina sem erro. A migração só cria objetos novos, então rodar de novo diz que não há migração pendente. Confira no Neon (ou `bun run db:studio`) que existem `handover`, `handover_item` e `handover_correction`. Testes e E2E usam PGlite e não dependem deste passo.

- [ ] **Step 9: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-1.txt` (texto exato abaixo) e rode:

```bash
git add src/db/schema/handovers.ts src/db/schema/index.ts src/db/schema/handovers.test.ts src/db/schema/migration0003.test.ts drizzle/0003_fase3_passagem.sql drizzle/meta/0003_snapshot.json drizzle/meta/_journal.json test/db.ts test/fixtures.ts test/clock.ts test/clock.test.ts
git commit -F .git/sdd/msg-task-1.txt
```

Mensagem:

```text
feat(db): tabelas da passagem de turno (migração 0003)

handover, handover_item e handover_correction com CHECKs de estado
(rascunho, entregue, confirmada), quem confirmou diferente de quem
entregou, quantidade não negativa e motivo obrigatório; FKs restrict e
um índice por FK. Fixtures que lançam para estado impossível, TABLES e
test/clock.ts (spDate). Testes provam cada CHECK (23514), a PK e a
tripla (23505), restrict (23001) e a migração sobre os dados da 0002.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 2: Lógica pura da passagem (fuso, turno sugerido, quantidade, campos, permissões, diff, situações, filtros, links, setor, mensagens)

**Files:**
- Create: `src/features/handovers/limits.ts`, `types.ts`, `saoPaulo.ts`, `quantity.ts`, `messages.ts`, `fieldRules.ts`, `shiftSuggestion.ts`, `access.ts`, `diff.ts`, `status.ts`, `historyFilters.ts`, `urls.ts`, `sectorChoice.ts`
- Test: `src/features/handovers/limits.test.ts`, `saoPaulo.test.ts`, `quantity.test.ts`, `messages.test.ts`, `fieldRules.test.ts`, `shiftSuggestion.test.ts`, `access.test.ts`, `diff.test.ts`, `status.test.ts`, `historyFilters.test.ts`, `urls.test.ts`, `sectorChoice.test.ts` (`types.ts` só tem tipos: o `check-types` dos consumidores o prova)

**Interfaces:**
- Consumes: `HandoverStatus`, `CorrectionField` (`@/db/schema/handovers`, só `import type`); `ItemKind` (`@/lib/itemKinds`); `Authz`, `canAccessSector`, `isAdmin` (`@/features/authz/authz`); `MINUTES_PER_DAY`, `parseTimeOfDay` (`@/features/admin/timeOfDay`); `SectorChoice` (`@/features/admin/sectors`, só `import type`); `spDate` (`test/clock.ts`, só nos testes).
- Produces: **exatamente** as assinaturas do contrato, nos módulos do contrato: `limits` (13 constantes), `types` (`HandoverRef`, `ShiftChoice`, `FormMode`, `ItemLine`, `FieldChange`, `SaveFieldInput`, `FieldValues`, `SavedMark`), `saoPaulo`, `shiftSuggestion`, `quantity`, `fieldRules`, `access`, `diff`, `status`, `historyFilters`, `urls` (`SECTOR_PICKER_PATHS` é tupla `as const`), `sectorChoice`, `messages` (19 constantes + `alreadyDeliveredMessage`, `alreadyConfirmedMessage`).
- Decisões provadas nos testes e herdadas pelas tarefas seguintes: `suggestShift` considera **só ontem e hoje** como dia operacional (ver `contractIssues`); parâmetro repetido na URL vale o **primeiro** valor (como `parsePage`); `parseQuantity` ignora o que não é dígito e limita ao teto; em `parseHistoryFilters` intervalo todo no futuro ou incompleto cai em 7 dias, `ate` futuro vira hoje, pontas invertidas são trocadas, mais de 93 dias corta o `de`; `isIsoDate` e `addDays` rejeitam `"2026-02-30"` (o `Date` do V8 o rola para março).
- Observação de formato: os blocos abaixo são o código validado; o Biome pode reajustar quebras de linha, por isso o Step 10 roda `biome check --write` antes do lint.

- [ ] **Step 1: Write the failing tests (tempo e números)**

Crie `src/features/handovers/saoPaulo.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { spDate } from "../../../test/clock";
import {
  addDays,
  daysBetween,
  formatDateBR,
  formatTimeBR,
  isIsoDate,
  isOperationalDateAllowed,
  saoPauloParts,
} from "./saoPaulo";

describe("saoPauloParts", () => {
  it("devolve dia e minutos em hora de parede (17:05Z = 14:05)", () => {
    expect(saoPauloParts(new Date("2026-11-20T17:05:00Z"))).toEqual({
      date: "2026-11-20",
      minutes: 14 * 60 + 5,
    });
  });

  it("virada UTC: 02:59Z ainda é 23:59 do dia anterior; 03:00Z já é 00:00", () => {
    expect(saoPauloParts(new Date("2026-11-21T02:59:00Z"))).toEqual({
      date: "2026-11-20",
      minutes: 1439,
    });
    expect(saoPauloParts(new Date("2026-11-21T03:00:00Z"))).toEqual({
      date: "2026-11-21",
      minutes: 0,
    });
  });
});

describe("isIsoDate", () => {
  it.each([
    "2026-11-21",
    "2024-02-29",
    "2026-12-31",
    "2026-01-01",
  ])("aceita %s", (value) => {
    expect(isIsoDate(value)).toBe(true);
  });

  it.each([
    ["2026-02-30", "30 de fevereiro"],
    ["2026-02-29", "29/02 em ano comum"],
    ["2026-13-01", "mês 13"],
    ["2026-00-10", "mês 0"],
    ["2026-11-00", "dia 0"],
    ["2026-11-31", "31 de novembro"],
    ["2026-1-5", "sem zero à esquerda"],
    ["20261121", "sem hífens"],
    ["2026-11-21T10:00", "com hora"],
    [" 2026-11-21", "com espaço"],
    ["2026-11-21\n", "com quebra de linha"],
    ["", "vazio"],
    ["lixo", "texto"],
  ])("recusa %s (%s)", (value) => {
    expect(isIsoDate(value)).toBe(false);
  });
});

describe("addDays", () => {
  it("avança para o mês e o ano seguintes", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("aceita negativo e zero", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-11-21", 0)).toBe("2026-11-21");
    expect(addDays("2026-11-21", -31)).toBe("2026-10-21");
  });

  it("lança RangeError para data inválida", () => {
    expect(() => addDays("2026-02-30", 1)).toThrow(RangeError);
    expect(() => addDays("lixo", 1)).toThrow(RangeError);
  });
});

describe("daysBetween", () => {
  it("conta dias inteiros de from até to (negativo se to é anterior)", () => {
    expect(daysBetween("2026-11-21", "2026-11-21")).toBe(0);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2026-10-21", "2026-11-21")).toBe(31);
    expect(daysBetween("2026-11-21", "2026-11-18")).toBe(-3);
  });

  it("lança RangeError para data inválida", () => {
    expect(() => daysBetween("2026-02-30", "2026-03-01")).toThrow(RangeError);
  });
});

describe("isOperationalDateAllowed", () => {
  const now = spDate("2026-11-21", "10:00");

  it("aceita hoje e os últimos 31 dias", () => {
    expect(isOperationalDateAllowed("2026-11-21", now)).toBe(true);
    expect(isOperationalDateAllowed("2026-11-20", now)).toBe(true);
    expect(isOperationalDateAllowed("2026-10-21", now)).toBe(true);
  });

  it("recusa 32 dias atrás e a data futura", () => {
    expect(isOperationalDateAllowed("2026-10-20", now)).toBe(false);
    expect(isOperationalDateAllowed("2026-11-22", now)).toBe(false);
  });

  it("recusa data inexistente e lixo", () => {
    expect(isOperationalDateAllowed("2026-02-30", now)).toBe(false);
    expect(isOperationalDateAllowed("lixo", now)).toBe(false);
    expect(isOperationalDateAllowed("", now)).toBe(false);
  });

  it("hoje é o dia de São Paulo, não o de UTC (02:59Z × 03:00Z)", () => {
    const before = new Date("2026-11-21T02:59:00Z");
    const after = new Date("2026-11-21T03:00:00Z");
    expect(isOperationalDateAllowed("2026-11-21", before)).toBe(false);
    expect(isOperationalDateAllowed("2026-11-20", before)).toBe(true);
    expect(isOperationalDateAllowed("2026-11-21", after)).toBe(true);
  });
});

describe("formatTimeBR", () => {
  it("mostra HH:mm em São Paulo", () => {
    expect(formatTimeBR(new Date("2026-11-20T17:05:00Z"))).toBe("14:05");
    expect(formatTimeBR(new Date("2026-11-21T03:00:00Z"))).toBe("00:00");
    expect(formatTimeBR(new Date("2026-11-21T02:59:00Z"))).toBe("23:59");
  });
});

describe("formatDateBR", () => {
  it("reformata o texto, sem passar por Date", () => {
    expect(formatDateBR("2026-11-21")).toBe("21/11/2026");
    expect(formatDateBR("2026-01-05")).toBe("05/01/2026");
  });

  it("lança RangeError para data inválida", () => {
    expect(() => formatDateBR("2026-02-30")).toThrow(RangeError);
    expect(() => formatDateBR("21/11/2026")).toThrow(RangeError);
  });
});
```

Crie `src/features/handovers/shiftSuggestion.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { spDate } from "../../../test/clock";
import {
  hasShiftEnded,
  resolveHandoverTarget,
  type SuggestableShift,
  shiftEnd,
  suggestShift,
} from "./shiftSuggestion";

const shift = (id: string, startsAt: string, endsAt: string) => ({
  id,
  startsAt,
  endsAt,
});
const MANHA = shift("manha", "06:00", "14:00");
const TARDE = shift("tarde", "14:00", "22:00");
const NOITE = shift("noite", "22:00", "06:00");
const SHIFTS: SuggestableShift[] = [MANHA, TARDE, NOITE];
const TODAY = "2026-11-21";
const YESTERDAY = "2026-11-20";
const at = (hhmm: string, date = TODAY) => spDate(date, hhmm);

describe("shiftEnd", () => {
  it.each([
    [MANHA, "2026-11-20", "2026-11-20", 840],
    [NOITE, "2026-11-20", "2026-11-21", 360],
    [shift("x", "18:00", "00:00"), "2026-11-30", "2026-12-01", 0],
    [shift("x", "06:00:00", "14:00:00"), "2026-11-20", "2026-11-20", 840],
  ])("turno %j começando em %s", (turn, date, endDate, minutes) => {
    expect(shiftEnd(date, turn)).toEqual({ date: endDate, minutes });
  });

  it("lança RangeError para horário inválido", () => {
    expect(() => shiftEnd("2026-11-20", shift("x", "06:00", "25:00"))).toThrow(
      RangeError,
    );
  });
});

describe("hasShiftEnded", () => {
  it.each([
    [MANHA, YESTERDAY, YESTERDAY, "13:59", false],
    [MANHA, YESTERDAY, YESTERDAY, "14:00", true],
    [MANHA, YESTERDAY, YESTERDAY, "14:01", true],
    [NOITE, YESTERDAY, YESTERDAY, "23:59", false],
    [NOITE, YESTERDAY, TODAY, "05:59", false],
    [NOITE, YESTERDAY, TODAY, "06:00", true],
    [MANHA, "2026-11-22", TODAY, "23:59", false],
    [MANHA, "2026-11-01", TODAY, "00:00", true],
  ])("turno %j no dia %s, agora %s %s: encerrado = %s", (turn, day, nowDay, nowTime, ended) => {
    expect(hasShiftEnded(day, turn, at(nowTime, nowDay))).toBe(ended);
  });

  it("segundos não mudam o fim e a virada UTC usa o dia de São Paulo", () => {
    expect(
      hasShiftEnded(YESTERDAY, MANHA, new Date("2026-11-20T16:59:59.999Z")),
    ).toBe(false);
    expect(
      hasShiftEnded(YESTERDAY, MANHA, new Date("2026-11-20T17:00:00.000Z")),
    ).toBe(true);
    const late = shift("x", "18:00", "23:59");
    expect(
      hasShiftEnded(YESTERDAY, late, new Date("2026-11-21T02:58:00Z")),
    ).toBe(false);
    expect(
      hasShiftEnded(YESTERDAY, late, new Date("2026-11-21T02:59:00Z")),
    ).toBe(true);
  });
});

describe("suggestShift", () => {
  it.each([
    ["14:05", TODAY, "manha", TODAY],
    ["06:05", TODAY, "noite", YESTERDAY],
    ["14:00", TODAY, "manha", TODAY],
    ["22:00", TODAY, "tarde", TODAY],
    ["23:30", TODAY, "tarde", TODAY],
    ["00:10", TODAY, "tarde", YESTERDAY],
    ["00:10", "2026-01-01", "tarde", "2025-12-31"],
  ])("às %s de %s: %s no dia %s", (time, day, shiftId, operationalDate) => {
    expect(suggestShift(SHIFTS, at(time, day))).toEqual({
      shiftId,
      operationalDate,
    });
  });

  it("sem turnos devolve null", () => {
    expect(suggestShift([], at("10:00"))).toBeNull();
  });

  it("com um turno só escolhe o fim mais próximo entre ontem e hoje", () => {
    expect(suggestShift([MANHA], at("09:00"))).toEqual({
      shiftId: "manha",
      operationalDate: TODAY,
    });
    expect(suggestShift([MANHA], at("00:10"))).toEqual({
      shiftId: "manha",
      operationalDate: YESTERDAY,
    });
    expect(suggestShift([NOITE], at("12:00"))).toEqual({
      shiftId: "noite",
      operationalDate: YESTERDAY,
    });
  });

  it("nunca sugere um dia operacional futuro (turno de amanhã)", () => {
    const early = shift("x", "00:30", "08:00");
    expect(suggestShift([early], at("23:50"))).toEqual({
      shiftId: "x",
      operationalDate: TODAY,
    });
  });

  it("empate de fim igual: vence o primeiro da lista", () => {
    const first = shift("a", "06:00", "14:00");
    const second = shift("b", "10:00", "14:00");
    expect(suggestShift([first, second], at("14:00"))?.shiftId).toBe("a");
    expect(suggestShift([second, first], at("14:00"))?.shiftId).toBe("b");
  });

  it("empate passado × futuro: o que já terminou vence, em qualquer ordem", () => {
    const ended = shift("passado", "05:00", "13:00");
    const upcoming = shift("futuro", "07:00", "15:00");
    expect(suggestShift([upcoming, ended], at("14:00"))?.shiftId).toBe(
      "passado",
    );
    expect(suggestShift([ended, upcoming], at("14:00"))?.shiftId).toBe(
      "passado",
    );
  });

  it("virada UTC: 02:59Z e 03:00Z de um turno que termina às 23:59", () => {
    const last = shift("z", "18:00", "23:59");
    for (const iso of ["2026-11-21T02:59:00Z", "2026-11-21T03:00:00Z"]) {
      expect(suggestShift([last], new Date(iso))).toEqual({
        shiftId: "z",
        operationalDate: YESTERDAY,
      });
    }
  });
});

describe("resolveHandoverTarget", () => {
  const now = at("14:05");
  const suggestion = {
    shiftId: "manha",
    operationalDate: TODAY,
    suggested: true,
  };

  it("turno e data válidos: usa o pedido; 31 dias atrás ainda vale", () => {
    for (const date of ["2026-11-19", "2026-10-21"]) {
      expect(
        resolveHandoverTarget(SHIFTS, now, { shiftId: "noite", date }),
      ).toEqual({ shiftId: "noite", operationalDate: date, suggested: false });
    }
  });

  it.each([
    ["sem parâmetros", {}],
    ["turno de outro setor", { shiftId: "outro", date: YESTERDAY }],
    ["data futura", { shiftId: "tarde", date: "2026-11-22" }],
    ["32 dias atrás", { shiftId: "tarde", date: "2026-10-20" }],
    ["data inexistente", { shiftId: "tarde", date: "2026-02-30" }],
    ["data malformada", { shiftId: "tarde", date: "ontem" }],
    ["só o turno", { shiftId: "tarde" }],
    ["só a data", { date: "2026-11-19" }],
    ["arrays com lixo no primeiro", { shiftId: ["lixo", "tarde"], date: [] }],
  ])("%s: sugere", (_label, requested) => {
    expect(resolveHandoverTarget(SHIFTS, now, requested)).toEqual(suggestion);
  });

  it("parâmetro repetido (array): vale o primeiro valor", () => {
    expect(
      resolveHandoverTarget(SHIFTS, now, {
        shiftId: ["noite", "tarde"],
        date: ["2026-11-19", "2026-11-20"],
      }),
    ).toEqual({
      shiftId: "noite",
      operationalDate: "2026-11-19",
      suggested: false,
    });
  });

  it("sem turnos: null, mesmo com parâmetros", () => {
    expect(resolveHandoverTarget([], now, {})).toBeNull();
    expect(
      resolveHandoverTarget([], now, { shiftId: "manha", date: TODAY }),
    ).toBeNull();
  });

  it("a data de UTC não vale enquanto em São Paulo ainda é o dia anterior", () => {
    const request = { shiftId: "manha", date: TODAY };
    const before = new Date("2026-11-21T02:59:00Z");
    const after = new Date("2026-11-21T03:00:00Z");
    expect(resolveHandoverTarget(SHIFTS, before, request)?.suggested).toBe(
      true,
    );
    expect(resolveHandoverTarget(SHIFTS, after, request)?.suggested).toBe(
      false,
    );
  });
});
```

Crie `src/features/handovers/quantity.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { MAX_QUANTITY } from "./limits";
import {
  formatQuantity,
  parseQuantity,
  sanitizeQuantityInput,
  stepQuantity,
} from "./quantity";

describe("sanitizeQuantityInput", () => {
  it("mantém só dígitos", () => {
    expect(sanitizeQuantityInput("12")).toBe("12");
    expect(sanitizeQuantityInput("abc")).toBe("");
    expect(sanitizeQuantityInput("1a2b3")).toBe("123");
    expect(sanitizeQuantityInput("-5")).toBe("5");
    expect(sanitizeQuantityInput("1,5")).toBe("15");
  });

  it("tira zeros à esquerda, mas preserva o zero sozinho", () => {
    expect(sanitizeQuantityInput("007")).toBe("7");
    expect(sanitizeQuantityInput("000")).toBe("0");
    expect(sanitizeQuantityInput("0")).toBe("0");
    expect(sanitizeQuantityInput("00012")).toBe("12");
  });

  it("vazio continua vazio (o campo pode ficar vazio enquanto se digita)", () => {
    expect(sanitizeQuantityInput("")).toBe("");
  });

  it("colagem com espaços e quebras vira só os dígitos", () => {
    expect(sanitizeQuantityInput(" 1 2 3 ")).toBe("123");
    expect(sanitizeQuantityInput("1\n2\t3")).toBe("123");
    expect(sanitizeQuantityInput("1\u{a0}2")).toBe("12");
  });

  it("no máximo 5 dígitos", () => {
    expect(sanitizeQuantityInput("99999")).toBe("99999");
    expect(sanitizeQuantityInput("123456")).toBe("12345");
    expect(sanitizeQuantityInput("0000123456")).toBe("12345");
  });

  it("ignora dígitos de outros alfabetos e emoji", () => {
    expect(sanitizeQuantityInput("\u{663}\u{664}")).toBe("");
    expect(sanitizeQuantityInput("5\u{1f600}")).toBe("5");
  });
});

describe("parseQuantity", () => {
  it('"" e texto sem dígitos → null', () => {
    expect(parseQuantity("")).toBeNull();
    expect(parseQuantity("abc")).toBeNull();
    expect(parseQuantity("  ")).toBeNull();
  });

  it("número comum, zeros à esquerda e colagem com espaços", () => {
    expect(parseQuantity("12")).toBe(12);
    expect(parseQuantity("0")).toBe(0);
    expect(parseQuantity("007")).toBe(7);
    expect(parseQuantity(" 1 2 ")).toBe(12);
  });

  it("acima do teto vira o teto", () => {
    expect(parseQuantity("99999")).toBe(MAX_QUANTITY);
    expect(parseQuantity("100000")).toBe(MAX_QUANTITY);
    expect(parseQuantity("99999999999999999999999")).toBe(MAX_QUANTITY);
  });
});

describe("stepQuantity", () => {
  it("soma e subtrai 1", () => {
    expect(stepQuantity(5, 1)).toBe(6);
    expect(stepQuantity(5, -1)).toBe(4);
  });

  it("trava em 0 e no teto", () => {
    expect(stepQuantity(0, -1)).toBe(0);
    expect(stepQuantity(MAX_QUANTITY, 1)).toBe(MAX_QUANTITY);
    expect(stepQuantity(MAX_QUANTITY - 1, 1)).toBe(MAX_QUANTITY);
  });

  it("valor fora da faixa volta para dentro", () => {
    expect(stepQuantity(-3, 1)).toBe(0);
    expect(stepQuantity(MAX_QUANTITY + 10, -1)).toBe(MAX_QUANTITY);
  });
});

describe("formatQuantity", () => {
  it("usa o ponto como separador de milhar (pt-BR)", () => {
    expect(formatQuantity(0)).toBe("0");
    expect(formatQuantity(999)).toBe("999");
    expect(formatQuantity(1234)).toBe("1.234");
    expect(formatQuantity(99999)).toBe("99.999");
  });
});
```

- [ ] **Step 2: Write the failing tests (campos, permissões e diff)**

Crie `src/features/handovers/fieldRules.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  codePointLength,
  normalizeFreeText,
  normalizeItemNote,
  normalizeOptionalText,
  normalizeReason,
  validateFieldChange,
} from "./fieldRules";
import { ITEM_NOTE_MAX_LENGTH, MAX_QUANTITY, TEXT_MAX_LENGTH } from "./limits";
import {
  NOTE_TOO_LONG_MESSAGE,
  QUANTITY_MESSAGE,
  TEXT_TOO_LONG_MESSAGE,
} from "./messages";

const ITEM_ID = "33333333-3333-4333-8333-333333333333";
// "e" + acento combinante: a forma decomposta (NFD) de "é".
const E_DECOMPOSED = "e\u{301}";
const E_COMPOSED = "\u{e9}";

describe("codePointLength", () => {
  it("conta pontos de código, não unidades UTF-16", () => {
    expect(codePointLength("")).toBe(0);
    expect(codePointLength("abc")).toBe(3);
    expect(codePointLength("\u{1f600}")).toBe(1);
    expect("\u{1f600}".length).toBe(2);
    expect(codePointLength("a\u{1f600}b")).toBe(3);
  });
});

describe("normalizeFreeText", () => {
  it("troca \\r\\n e \\r por \\n", () => {
    expect(normalizeFreeText("a\r\nb\rc\nd")).toBe("a\nb\nc\nd");
  });

  it("não faz trim: o texto vale como foi digitado", () => {
    expect(normalizeFreeText("  oi  \n")).toBe("  oi  \n");
    expect(normalizeFreeText("")).toBe("");
  });
});

describe("normalizeItemNote", () => {
  it("colapsa espaços e quebras e faz trim", () => {
    expect(normalizeItemNote("  rede   rasgada \n no canto ")).toBe(
      "rede rasgada no canto",
    );
  });

  it("vazio ou só espaços vira null", () => {
    expect(normalizeItemNote("")).toBeNull();
    expect(normalizeItemNote("   \n\t ")).toBeNull();
    expect(normalizeItemNote("\u{a0}")).toBeNull();
  });
});

describe("normalizeOptionalText", () => {
  it("faz trim, preserva as quebras de linha e troca \\r\\n", () => {
    expect(normalizeOptionalText("  linha 1\r\nlinha 2  ")).toBe(
      "linha 1\nlinha 2",
    );
  });

  it("vazio ou só espaços vira null", () => {
    expect(normalizeOptionalText("")).toBeNull();
    expect(normalizeOptionalText("  \n ")).toBeNull();
  });
});

describe("normalizeReason", () => {
  it("faz trim, NFC e \\r\\n; pode sobrar string vazia", () => {
    expect(normalizeReason(`  ${E_DECOMPOSED}rro\r\nde digitação `)).toBe(
      `${E_COMPOSED}rro\nde digitação`,
    );
    expect(normalizeReason("   ")).toBe("");
    expect(normalizeReason("")).toBe("");
  });
});

describe("validateFieldChange", () => {
  describe("quantidade", () => {
    it.each([0, 1, 12, MAX_QUANTITY])("aceita %i", (value) => {
      expect(
        validateFieldChange({ field: "quantity", itemId: ITEM_ID, value }),
      ).toEqual({
        ok: true,
        change: { field: "quantity", itemId: ITEM_ID, value },
      });
    });

    it.each([
      -1,
      1.5,
      MAX_QUANTITY + 1,
      Number.NaN,
      Number.POSITIVE_INFINITY,
    ])("recusa %s", (value) => {
      expect(
        validateFieldChange({ field: "quantity", itemId: ITEM_ID, value }),
      ).toEqual({ ok: false, message: QUANTITY_MESSAGE });
    });
  });

  describe("textos livres", () => {
    it.each(["occurrences", "nextShift"] as const)(
      "%s: aceita vazio e devolve o texto normalizado (NFC e \\n)",
      (field) => {
        expect(validateFieldChange({ field, value: "" })).toEqual({
          ok: true,
          change: { field, value: "" },
        });
        expect(
          validateFieldChange({ field, value: `${E_DECOMPOSED}\r\n ok ` }),
        ).toEqual({
          ok: true,
          change: { field, value: `${E_COMPOSED}\n ok ` },
        });
      },
    );

    it("aceita exatamente 2.000 pontos de código e recusa 2.001", () => {
      const limit = "a".repeat(TEXT_MAX_LENGTH);
      expect(
        validateFieldChange({ field: "occurrences", value: limit }).ok,
      ).toBe(true);
      expect(
        validateFieldChange({ field: "occurrences", value: `${limit}a` }),
      ).toEqual({ ok: false, message: TEXT_TOO_LONG_MESSAGE });
    });

    it("conta emoji como 1: 2.000 emojis passam, 2.001 não", () => {
      const emoji = "\u{1f600}";
      expect(
        validateFieldChange({
          field: "nextShift",
          value: emoji.repeat(TEXT_MAX_LENGTH),
        }).ok,
      ).toBe(true);
      expect(
        validateFieldChange({
          field: "nextShift",
          value: emoji.repeat(TEXT_MAX_LENGTH + 1),
        }),
      ).toEqual({ ok: false, message: TEXT_TOO_LONG_MESSAGE });
    });
  });

  describe("observação do item", () => {
    it('devolve a nota normalizada, com "" no lugar de null', () => {
      expect(
        validateFieldChange({
          field: "note",
          itemId: ITEM_ID,
          value: "  rede   rasgada ",
        }),
      ).toEqual({
        ok: true,
        change: { field: "note", itemId: ITEM_ID, value: "rede rasgada" },
      });
      expect(
        validateFieldChange({ field: "note", itemId: ITEM_ID, value: "   " }),
      ).toEqual({
        ok: true,
        change: { field: "note", itemId: ITEM_ID, value: "" },
      });
    });

    it("aceita 200 e recusa 201 caracteres", () => {
      expect(
        validateFieldChange({
          field: "note",
          itemId: ITEM_ID,
          value: "n".repeat(ITEM_NOTE_MAX_LENGTH),
        }).ok,
      ).toBe(true);
      expect(
        validateFieldChange({
          field: "note",
          itemId: ITEM_ID,
          value: "n".repeat(ITEM_NOTE_MAX_LENGTH + 1),
        }),
      ).toEqual({ ok: false, message: NOTE_TOO_LONG_MESSAGE });
    });
  });
});
```

Crie `src/features/handovers/access.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import type { HandoverStatus } from "@/db/schema/handovers";
import type { Authz } from "@/features/authz/authz";

import {
  formModeOf,
  type HandoverCapabilities,
  handoverCapabilities,
} from "./access";

const SECTOR_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SECTOR_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function operator(userId: string, sectorId: string): Authz {
  return {
    userId,
    name: "Ana Teste",
    email: `${userId}@example.test`,
    role: "operator",
    sectorId,
  };
}

const ANA = operator("ana", SECTOR_A); // quem entregou
const BIA = operator("bia", SECTOR_A); // outra pessoa do mesmo setor
const CAIO = operator("caio", SECTOR_B); // outro setor
const ADMIN: Authz = {
  userId: "admin",
  name: "Admin Teste",
  email: "admin@example.test",
  role: "admin",
  sectorId: null,
};

const NOTHING: HandoverCapabilities = {
  canView: false,
  canEditDirectly: false,
  canDeliver: false,
  canConfirm: false,
  canCorrectWithReason: false,
};

function caps(
  actor: Authz,
  status: HandoverStatus,
  deliveredBy: string | null,
): HandoverCapabilities {
  return handoverCapabilities(actor, {
    status,
    sectorId: SECTOR_A,
    deliveredBy,
  });
}

describe("handoverCapabilities", () => {
  it.each(["draft", "delivered", "confirmed"] as const)(
    "operador de outro setor não pode nada (%s)",
    (status) => {
      expect(caps(CAIO, status, "ana")).toEqual(NOTHING);
    },
  );

  describe("rascunho", () => {
    it.each([
      ["operador do setor", ANA],
      ["outra pessoa do setor", BIA],
      ["admin", ADMIN],
    ])("%s: vê, edita direto e entrega; não confirma nem corrige", (_label, actor) => {
      expect(caps(actor, "draft", null)).toEqual({
        canView: true,
        canEditDirectly: true,
        canDeliver: true,
        canConfirm: false,
        canCorrectWithReason: false,
      });
    });
  });

  describe("entregue", () => {
    it("quem entregou: vê e edita direto; não entrega de novo, não confirma", () => {
      expect(caps(ANA, "delivered", "ana")).toEqual({
        canView: true,
        canEditDirectly: true,
        canDeliver: false,
        canConfirm: false,
        canCorrectWithReason: false,
      });
    });

    it("outra pessoa do setor: vê e confirma; não edita", () => {
      expect(caps(BIA, "delivered", "ana")).toEqual({
        canView: true,
        canEditDirectly: false,
        canDeliver: false,
        canConfirm: true,
        canCorrectWithReason: false,
      });
    });

    it("admin: edita direto e confirma (se não foi ele quem entregou)", () => {
      expect(caps(ADMIN, "delivered", "ana")).toEqual({
        canView: true,
        canEditDirectly: true,
        canDeliver: false,
        canConfirm: true,
        canCorrectWithReason: false,
      });
    });
  });

  describe("confirmada", () => {
    it.each([
      ["quem entregou", ANA],
      ["outra pessoa do setor", BIA],
    ])("%s: só vê", (_label, actor) => {
      expect(caps(actor, "confirmed", "ana")).toEqual({
        canView: true,
        canEditDirectly: false,
        canDeliver: false,
        canConfirm: false,
        canCorrectWithReason: false,
      });
    });

    it("admin: não edita direto; só corrige com motivo", () => {
      expect(caps(ADMIN, "confirmed", "ana")).toEqual({
        canView: true,
        canEditDirectly: false,
        canDeliver: false,
        canConfirm: false,
        canCorrectWithReason: true,
      });
    });
  });
});

describe("formModeOf", () => {
  const draftCaps = caps(BIA, "draft", null);

  it("sem passagem ou rascunho + pode editar → draft", () => {
    expect(formModeOf(null, draftCaps)).toBe("draft");
    expect(formModeOf("draft", draftCaps)).toBe("draft");
  });

  it("sem passagem e sem permissão → null", () => {
    expect(formModeOf(null, NOTHING)).toBeNull();
    expect(formModeOf("draft", NOTHING)).toBeNull();
  });

  it("entregue: quem entregou e o admin editam; os outros não", () => {
    expect(formModeOf("delivered", caps(ANA, "delivered", "ana"))).toBe("edit");
    expect(formModeOf("delivered", caps(ADMIN, "delivered", "ana"))).toBe(
      "edit",
    );
    expect(formModeOf("delivered", caps(BIA, "delivered", "ana"))).toBeNull();
    expect(formModeOf("delivered", caps(CAIO, "delivered", "ana"))).toBeNull();
  });

  it("confirmada: só o admin corrige", () => {
    expect(formModeOf("confirmed", caps(ADMIN, "confirmed", "ana"))).toBe(
      "correction",
    );
    expect(formModeOf("confirmed", caps(ANA, "confirmed", "ana"))).toBeNull();
    expect(formModeOf("confirmed", caps(CAIO, "confirmed", "ana"))).toBeNull();
  });
});
```

Crie `src/features/handovers/diff.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  correctionFieldLabel,
  diffHandover,
  displayCorrectionValue,
  type HandoverValues,
} from "./diff";

const ITEM_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ITEM_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const E_DECOMPOSED = "e\u{301}";
const E_COMPOSED = "\u{e9}";

const CURRENT: HandoverValues = {
  occurrencesText: "Nada de especial",
  nextShiftText: "Conferir a rede",
  items: [
    { itemId: ITEM_A, quantity: 3, note: null },
    { itemId: ITEM_B, quantity: 10, note: "caixa aberta" },
  ],
};

function next(overrides: Partial<HandoverValues>): HandoverValues {
  return { ...CURRENT, ...overrides };
}

describe("diffHandover", () => {
  it("sem nenhuma mudança: []", () => {
    expect(diffHandover(CURRENT, CURRENT)).toEqual([]);
  });

  it("muda o texto de ocorrências", () => {
    expect(
      diffHandover(CURRENT, next({ occurrencesText: "Rede rasgada" })),
    ).toEqual([
      {
        field: "occurrences_text",
        itemId: null,
        oldValue: "Nada de especial",
        newValue: "Rede rasgada",
      },
    ]);
  });

  it("texto igual depois da normalização (NFC e \\r\\n) não é mudança", () => {
    expect(
      diffHandover(
        { ...CURRENT, occurrencesText: `caf${E_COMPOSED}\nfim` },
        { ...CURRENT, occurrencesText: `caf${E_DECOMPOSED}\r\nfim` },
      ),
    ).toEqual([]);
  });

  it("muda a quantidade: antigo e novo como texto (zerar também é mudança)", () => {
    expect(
      diffHandover(
        CURRENT,
        next({
          items: [
            { itemId: ITEM_A, quantity: 4, note: null },
            { itemId: ITEM_B, quantity: 0, note: "caixa aberta" },
          ],
        }),
      ),
    ).toEqual([
      { field: "item_quantity", itemId: ITEM_A, oldValue: "3", newValue: "4" },
      { field: "item_quantity", itemId: ITEM_B, oldValue: "10", newValue: "0" },
    ]);
  });

  it("nota null e nota vazia são o mesmo valor", () => {
    expect(
      diffHandover(CURRENT, {
        ...CURRENT,
        items: [
          { itemId: ITEM_A, quantity: 3, note: "" },
          { itemId: ITEM_B, quantity: 10, note: "caixa aberta" },
        ],
      }),
    ).toEqual([]);
    expect(
      diffHandover(
        { ...CURRENT, items: [{ itemId: ITEM_A, quantity: 3, note: "" }] },
        { ...CURRENT, items: [{ itemId: ITEM_A, quantity: 3, note: null }] },
      ),
    ).toEqual([]);
  });

  it("nota nova, nota trocada e nota apagada", () => {
    expect(
      diffHandover(
        CURRENT,
        next({
          items: [
            { itemId: ITEM_A, quantity: 3, note: "rasgada" },
            { itemId: ITEM_B, quantity: 10, note: null },
          ],
        }),
      ),
    ).toEqual([
      { field: "item_note", itemId: ITEM_A, oldValue: "", newValue: "rasgada" },
      {
        field: "item_note",
        itemId: ITEM_B,
        oldValue: "caixa aberta",
        newValue: "",
      },
    ]);
  });

  it("ordem: ocorrências, próximo turno, depois cada item (quantidade e nota)", () => {
    const result = diffHandover(CURRENT, {
      occurrencesText: "X",
      nextShiftText: "Y",
      items: [
        { itemId: ITEM_B, quantity: 11, note: "outra" },
        { itemId: ITEM_A, quantity: 5, note: "nova" },
      ],
    });
    expect(result.map((change) => [change.field, change.itemId])).toEqual([
      ["occurrences_text", null],
      ["next_shift_text", null],
      ["item_quantity", ITEM_A],
      ["item_note", ITEM_A],
      ["item_quantity", ITEM_B],
      ["item_note", ITEM_B],
    ]);
  });

  it("item ausente em `next` fica inalterado", () => {
    expect(
      diffHandover(
        CURRENT,
        next({ items: [{ itemId: ITEM_A, quantity: 3, note: null }] }),
      ),
    ).toEqual([]);
    expect(diffHandover(CURRENT, next({ items: [] }))).toEqual([]);
  });
});

describe("correctionFieldLabel", () => {
  it("rótulos dos campos de texto", () => {
    expect(correctionFieldLabel("occurrences_text", null)).toBe(
      "Ocorrências do turno",
    );
    expect(correctionFieldLabel("next_shift_text", null)).toBe(
      "Fica para o próximo turno",
    );
  });

  it("rótulos dos campos de item levam o nome do item", () => {
    expect(correctionFieldLabel("item_quantity", "Rede de proteção")).toBe(
      "Rede de proteção: quantidade",
    );
    expect(correctionFieldLabel("item_note", "Rede de proteção")).toBe(
      "Rede de proteção: observação",
    );
  });

  it('item sem nome conhecido cai para "Item"', () => {
    expect(correctionFieldLabel("item_quantity", null)).toBe(
      "Item: quantidade",
    );
  });
});

describe("displayCorrectionValue", () => {
  it("vazio vira (vazio); o resto passa direto", () => {
    expect(displayCorrectionValue("")).toBe("(vazio)");
    expect(displayCorrectionValue("0")).toBe("0");
    expect(displayCorrectionValue("texto")).toBe("texto");
  });
});
```

- [ ] **Step 3: Write the failing tests (situações, filtros, links, setor, mensagens, limites)**

Crie `src/features/handovers/status.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  CORRECTED_LABEL,
  HISTORY_SITUATIONS,
  STATUS_DESCRIPTION,
  situationLabel,
} from "./status";

describe("situationLabel", () => {
  it("rótulo de cada situação", () => {
    expect(situationLabel("awaiting")).toBe("Aguardando recebimento");
    expect(situationLabel("unconfirmed")).toBe("Não confirmada");
    expect(situationLabel("missing")).toBe("Sem passagem");
  });

  it("confirmada leva o nome de quem confirmou", () => {
    expect(situationLabel("confirmed", "Bia Teste")).toBe(
      "Confirmada por Bia Teste",
    );
  });

  it('confirmada sem nome (null, undefined ou vazio): só "Confirmada"', () => {
    expect(situationLabel("confirmed")).toBe("Confirmada");
    expect(situationLabel("confirmed", null)).toBe("Confirmada");
    expect(situationLabel("confirmed", "")).toBe("Confirmada");
    expect(situationLabel("confirmed", "   ")).toBe("Confirmada");
  });

  it("o nome só entra na situação confirmada", () => {
    expect(situationLabel("awaiting", "Bia Teste")).toBe(
      "Aguardando recebimento",
    );
  });

  it("toda situação tem rótulo não vazio", () => {
    for (const situation of HISTORY_SITUATIONS) {
      expect(situationLabel(situation, "Bia Teste")).not.toBe("");
    }
  });
});

describe("constantes", () => {
  it("lista as quatro situações do histórico", () => {
    expect([...HISTORY_SITUATIONS]).toEqual([
      "awaiting",
      "confirmed",
      "unconfirmed",
      "missing",
    ]);
  });

  it("selo de correção", () => {
    expect(CORRECTED_LABEL).toBe("Corrigida");
  });

  it("descrição de cada status da passagem", () => {
    expect(STATUS_DESCRIPTION).toEqual({
      draft: "Rascunho",
      delivered: "Entregue",
      confirmed: "Confirmada",
    });
  });
});
```

Crie `src/features/handovers/historyFilters.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  buildHistoryHref,
  type HistoryFilters,
  parseHistoryFilters,
  SITUATION_PARAM,
} from "./historyFilters";
import { HISTORY_MAX_DAYS } from "./limits";
import { daysBetween } from "./saoPaulo";

const TODAY = "2026-11-21";
const SHIFT = "11111111-1111-4111-8111-111111111111";

const DEFAULTS: HistoryFilters = {
  period: "7",
  from: "2026-11-15",
  to: TODAY,
  shiftId: null,
  situation: "all",
};

describe("parseHistoryFilters", () => {
  it("sem parâmetros: últimos 7 dias, todos os turnos e situações", () => {
    expect(parseHistoryFilters({}, TODAY)).toEqual(DEFAULTS);
  });

  it("periodo=30: hoje − 29 até hoje; período desconhecido cai em 7", () => {
    expect(parseHistoryFilters({ periodo: "30" }, TODAY)).toEqual({
      ...DEFAULTS,
      period: "30",
      from: "2026-10-23",
    });
    expect(parseHistoryFilters({ periodo: "90" }, TODAY).period).toBe("7");
    expect(parseHistoryFilters({ periodo: "<script>" }, TODAY).period).toBe(
      "7",
    );
  });

  describe("intervalo", () => {
    function range(de: string | undefined, ate: string | undefined) {
      return parseHistoryFilters({ periodo: "intervalo", de, ate }, TODAY);
    }

    it("de e ate válidos", () => {
      expect(range("2026-11-01", "2026-11-10")).toEqual({
        ...DEFAULTS,
        period: "range",
        from: "2026-11-01",
        to: "2026-11-10",
      });
    });

    it("intervalo invertido: as pontas são trocadas", () => {
      expect(range("2026-11-10", "2026-11-01")).toMatchObject({
        period: "range",
        from: "2026-11-01",
        to: "2026-11-10",
      });
    });

    it("ate no futuro é cortado em hoje", () => {
      expect(range("2026-11-15", "2026-12-31")).toMatchObject({
        period: "range",
        from: "2026-11-15",
        to: TODAY,
      });
    });

    it("intervalo inteiro no futuro cai em 7 dias", () => {
      expect(range("2026-12-01", "2026-12-05")).toEqual(DEFAULTS);
    });

    it("ausente, pela metade ou inválido cai em 7 dias", () => {
      expect(range(undefined, undefined)).toEqual(DEFAULTS);
      expect(range("2026-11-01", undefined)).toEqual(DEFAULTS);
      expect(range(undefined, "2026-11-10")).toEqual(DEFAULTS);
      expect(range("2026-02-30", "2026-11-10")).toEqual(DEFAULTS);
      expect(range("lixo", "2026-11-10")).toEqual(DEFAULTS);
      expect(range("", "")).toEqual(DEFAULTS);
    });

    it("extensão máxima de 93 dias: corta o `de`", () => {
      const result = range("2025-01-01", "2026-11-10");
      expect(result).toMatchObject({ period: "range", to: "2026-11-10" });
      expect(daysBetween(result.from, result.to) + 1).toBe(HISTORY_MAX_DAYS);
      expect(result.from).toBe("2026-08-10");
    });

    it("de e ate só valem como texto único (array: vale o primeiro)", () => {
      const result = parseHistoryFilters(
        {
          periodo: ["intervalo", "30"],
          de: ["2026-11-01", "2026-01-01"],
          ate: ["2026-11-10"],
        },
        TODAY,
      );
      expect(result).toMatchObject({
        period: "range",
        from: "2026-11-01",
        to: "2026-11-10",
      });
    });
  });

  describe("turno", () => {
    it("aceita uuid", () => {
      expect(parseHistoryFilters({ turno: SHIFT }, TODAY).shiftId).toBe(SHIFT);
    });

    it.each([
      "lixo",
      "",
      "1",
      `${SHIFT}x`,
      "'; drop table shift; --",
    ])("recusa %j", (value) => {
      expect(parseHistoryFilters({ turno: value }, TODAY).shiftId).toBeNull();
    });
  });

  describe("situacao", () => {
    it.each(
      Object.entries(SITUATION_PARAM),
    )("%s ↔ %s", (situation, param) => {
      expect(parseHistoryFilters({ situacao: param }, TODAY).situation).toBe(
        situation,
      );
    });

    it("desconhecida ou lixo cai em todas", () => {
      for (const value of ["xyz", "awaiting", "", "toString"]) {
        expect(
          parseHistoryFilters({ situacao: value }, TODAY).situation,
        ).toBe("all");
      }
    });
  });
});

describe("SITUATION_PARAM", () => {
  it("valores em pt-BR de URL", () => {
    expect(SITUATION_PARAM).toEqual({
      all: "todas",
      awaiting: "aguardando",
      confirmed: "confirmada",
      unconfirmed: "nao-confirmada",
      missing: "sem-passagem",
      corrected: "corrigida",
    });
  });
});

describe("buildHistoryHref", () => {
  it("filtros padrão: só /passagens", () => {
    expect(buildHistoryHref(DEFAULTS)).toBe("/passagens");
  });

  it("intervalo leva de e ate", () => {
    expect(
      buildHistoryHref({
        ...DEFAULTS,
        period: "range",
        from: "2026-11-01",
        to: "2026-11-10",
      }),
    ).toBe("/passagens?periodo=intervalo&de=2026-11-01&ate=2026-11-10");
  });

  it("turno, situação, setor e página, nessa ordem", () => {
    expect(
      buildHistoryHref(
        { ...DEFAULTS, shiftId: SHIFT, situation: "unconfirmed" },
        { sector: "todos", page: 3 },
      ),
    ).toBe(
      `/passagens?turno=${SHIFT}&situacao=nao-confirmada&setor=todos&pagina=3`,
    );
  });

  it("omite página 1, página inválida e setor ausente", () => {
    expect(buildHistoryHref(DEFAULTS, { page: 1 })).toBe("/passagens");
    expect(buildHistoryHref(DEFAULTS, { page: 0 })).toBe("/passagens");
    expect(buildHistoryHref(DEFAULTS, { page: -2 })).toBe("/passagens");
    expect(buildHistoryHref(DEFAULTS, {})).toBe("/passagens");
  });

  it("ida e volta: o que build escreve, parse devolve", () => {
    const filters: HistoryFilters = {
      period: "range",
      from: "2026-11-01",
      to: "2026-11-10",
      shiftId: SHIFT,
      situation: "corrected",
    };
    const href = buildHistoryHref(filters, { sector: SHIFT, page: 2 });
    const params = Object.fromEntries(new URL(href, "http://x").searchParams);
    expect(parseHistoryFilters(params, TODAY)).toEqual(filters);
  });
});
```

Crie `src/features/handovers/urls.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  chooseSectorPath,
  handoverHref,
  newHandoverHref,
  SECTOR_PICKER_PATHS,
} from "./urls";

const REF = {
  sectorId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  shiftId: "11111111-1111-4111-8111-111111111111",
  operationalDate: "2026-11-21",
};

describe("newHandoverHref", () => {
  it("leva turno e data juntos", () => {
    expect(newHandoverHref(REF)).toBe(
      "/passagens/nova?turno=11111111-1111-4111-8111-111111111111&data=2026-11-21",
    );
  });

  it("preserva o setor do admin quando informado", () => {
    expect(newHandoverHref(REF, REF.sectorId)).toBe(
      `/passagens/nova?turno=${REF.shiftId}&data=2026-11-21&setor=${REF.sectorId}`,
    );
  });

  it("setor vazio ou ausente não entra na URL", () => {
    expect(newHandoverHref(REF, undefined)).toBe(newHandoverHref(REF));
    expect(newHandoverHref(REF, "")).toBe(newHandoverHref(REF));
  });
});

describe("handoverHref", () => {
  it("resumo e edição", () => {
    expect(handoverHref("abc")).toBe("/passagens/abc");
    expect(handoverHref("abc", {})).toBe("/passagens/abc");
    expect(handoverHref("abc", { edit: false })).toBe("/passagens/abc");
    expect(handoverHref("abc", { edit: true })).toBe("/passagens/abc?editar=1");
  });
});

describe("chooseSectorPath", () => {
  it("anexa ?setor= ao caminho", () => {
    expect(chooseSectorPath("/", "s1")).toBe("/?setor=s1");
    expect(chooseSectorPath("/passagens", "todos")).toBe(
      "/passagens?setor=todos",
    );
    expect(chooseSectorPath("/passagens/nova", "s1")).toBe(
      "/passagens/nova?setor=s1",
    );
  });
});

describe("SECTOR_PICKER_PATHS", () => {
  it("lista fechada de três caminhos", () => {
    expect([...SECTOR_PICKER_PATHS]).toEqual([
      "/",
      "/passagens",
      "/passagens/nova",
    ]);
  });
});
```

Crie `src/features/handovers/sectorChoice.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { resolveHandoverSector } from "./sectorChoice";

const ULD = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "ULD" };
const CARGA = { id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", name: "Carga" };
const SECTORS = [CARGA, ULD];
const OTHER = "99999999-9999-4999-8999-999999999999";
const pick = (sector: typeof ULD) => ({ kind: "sector", sector });

describe("resolveHandoverSector", () => {
  it("o setor da URL vence o cookie", () => {
    expect(
      resolveHandoverSector(SECTORS, { url: ULD.id, cookie: CARGA.id }),
    ).toEqual(pick(ULD));
  });

  it("sem URL, vale o cookie; sem os dois, o primeiro da lista", () => {
    expect(
      resolveHandoverSector(SECTORS, { url: undefined, cookie: ULD.id }),
    ).toEqual(pick(ULD));
    expect(
      resolveHandoverSector(SECTORS, { url: undefined, cookie: undefined }),
    ).toEqual(pick(CARGA));
  });

  it("URL ou cookie fora da lista (inexistente, inativo, lixo) são ignorados", () => {
    expect(
      resolveHandoverSector(SECTORS, { url: OTHER, cookie: ULD.id }),
    ).toEqual(pick(ULD));
    expect(
      resolveHandoverSector(SECTORS, { url: undefined, cookie: OTHER }),
    ).toEqual(pick(CARGA));
    expect(resolveHandoverSector(SECTORS, { url: "lixo", cookie: "" })).toEqual(
      pick(CARGA),
    );
  });

  it("lista vazia: none, mesmo com URL e cookie", () => {
    expect(resolveHandoverSector([], { url: ULD.id, cookie: ULD.id })).toEqual({
      kind: "none",
    });
    expect(
      resolveHandoverSector(
        [],
        { url: "todos", cookie: undefined },
        { allowAll: true },
      ),
    ).toEqual({ kind: "none" });
  });

  it("url=todos só vale com allowAll", () => {
    const sources = { url: "todos", cookie: ULD.id };
    expect(resolveHandoverSector(SECTORS, sources, { allowAll: true })).toEqual(
      { kind: "all" },
    );
    expect(resolveHandoverSector(SECTORS, sources)).toEqual(pick(ULD));
    expect(
      resolveHandoverSector(SECTORS, sources, { allowAll: false }),
    ).toEqual(pick(ULD));
  });

  it("cookie=todos nunca vale (não é gravado) e cai no primeiro", () => {
    expect(
      resolveHandoverSector(
        SECTORS,
        { url: undefined, cookie: "todos" },
        { allowAll: true },
      ),
    ).toEqual(pick(CARGA));
  });

  it("URL repetida (array): vale o primeiro valor", () => {
    expect(
      resolveHandoverSector(SECTORS, {
        url: [ULD.id, CARGA.id],
        cookie: undefined,
      }),
    ).toEqual(pick(ULD));
    expect(
      resolveHandoverSector(
        SECTORS,
        { url: ["todos", ULD.id], cookie: undefined },
        { allowAll: true },
      ),
    ).toEqual({ kind: "all" });
    expect(resolveHandoverSector(SECTORS, { url: [], cookie: ULD.id })).toEqual(
      pick(ULD),
    );
  });
});
```

Crie `src/features/handovers/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  CONFIRMATION_NOTE_MAX_LENGTH,
  ITEM_NOTE_MAX_LENGTH,
  MAX_DAYS_BACK,
  MAX_QUANTITY,
  REASON_MAX_LENGTH,
  TEXT_MAX_LENGTH,
} from "./limits";
import {
  alreadyConfirmedMessage,
  alreadyDeliveredMessage,
  CONFIRMATION_NOTE_TOO_LONG_MESSAGE,
  CORRECTION_FORBIDDEN_MESSAGE,
  DATE_OUT_OF_RANGE_MESSAGE,
  DUPLICATE_ITEM_MESSAGE,
  EDIT_FORBIDDEN_MESSAGE,
  HANDOVER_LOCKED_MESSAGE,
  HANDOVER_NOT_FOUND_MESSAGE,
  INVALID_DATE_MESSAGE,
  NO_CHANGES_MESSAGE,
  NOT_CONFIRMED_MESSAGE,
  NOT_DELIVERED_MESSAGE,
  NOTE_TOO_LONG_MESSAGE,
  OWN_HANDOVER_MESSAGE,
  QUANTITY_MESSAGE,
  REASON_REQUIRED_MESSAGE,
  REASON_TOO_LONG_MESSAGE,
  SECTOR_INACTIVE_HANDOVER_MESSAGE,
  SHIFT_INACTIVE_MESSAGE,
  SWITCH_FAILED_MESSAGE,
  TEXT_TOO_LONG_MESSAGE,
  UNSAVED_DELIVER_MESSAGE,
} from "./messages";
import { formatQuantity } from "./quantity";

describe("mensagens fixas (os testes de tela e o E2E dependem do texto exato)", () => {
  it.each([
    [HANDOVER_NOT_FOUND_MESSAGE, "Passagem não encontrada. Atualize a página."],
    [
      SECTOR_INACTIVE_HANDOVER_MESSAGE,
      "Este setor está inativo. Peça a um administrador para reativá-lo.",
    ],
    [SHIFT_INACTIVE_MESSAGE, "Este turno está inativo. Escolha outro turno."],
    [
      DATE_OUT_OF_RANGE_MESSAGE,
      "Escolha uma data de hoje ou dos últimos 31 dias.",
    ],
    [
      EDIT_FORBIDDEN_MESSAGE,
      "Só quem entregou o turno ou um administrador pode editar esta passagem.",
    ],
    [
      HANDOVER_LOCKED_MESSAGE,
      "Esta passagem já foi confirmada. Só um administrador corrige, com motivo.",
    ],
    [NOT_DELIVERED_MESSAGE, "Esta passagem ainda não foi entregue."],
    [
      OWN_HANDOVER_MESSAGE,
      "Quem entregou o turno não pode confirmar o recebimento. Peça a outra pessoa do setor.",
    ],
    [
      NOT_CONFIRMED_MESSAGE,
      "Só passagens confirmadas passam pela correção com motivo. Edite a passagem direto.",
    ],
    [
      CORRECTION_FORBIDDEN_MESSAGE,
      "Só um administrador pode corrigir uma passagem confirmada.",
    ],
    [
      NO_CHANGES_MESSAGE,
      "Nada foi alterado. Mude algum campo para registrar a correção.",
    ],
    [REASON_REQUIRED_MESSAGE, "Informe o motivo da correção."],
    [REASON_TOO_LONG_MESSAGE, "O motivo pode ter no máximo 500 caracteres."],
    [QUANTITY_MESSAGE, "Informe um número inteiro de 0 a 99.999."],
    [TEXT_TOO_LONG_MESSAGE, "O texto pode ter no máximo 2.000 caracteres."],
    [
      NOTE_TOO_LONG_MESSAGE,
      "A observação pode ter no máximo 200 caracteres.",
    ],
    [
      CONFIRMATION_NOTE_TOO_LONG_MESSAGE,
      "A observação pode ter no máximo 500 caracteres.",
    ],
    [INVALID_DATE_MESSAGE, "Data inválida."],
    [DUPLICATE_ITEM_MESSAGE, "Item repetido. Atualize a página."],
    [
      UNSAVED_DELIVER_MESSAGE,
      "Há alterações sem salvar. Toque em “Tentar de novo” e entregue de novo.",
    ],
    [
      SWITCH_FAILED_MESSAGE,
      "Não foi possível salvar. Tente de novo antes de trocar de turno.",
    ],
  ])("%s", (actual, expected) => {
    expect(actual).toBe(expected);
  });

  it("os números das mensagens batem com os limites", () => {
    expect(QUANTITY_MESSAGE).toContain(formatQuantity(MAX_QUANTITY));
    expect(TEXT_TOO_LONG_MESSAGE).toContain(formatQuantity(TEXT_MAX_LENGTH));
    expect(NOTE_TOO_LONG_MESSAGE).toContain(String(ITEM_NOTE_MAX_LENGTH));
    expect(CONFIRMATION_NOTE_TOO_LONG_MESSAGE).toContain(
      String(CONFIRMATION_NOTE_MAX_LENGTH),
    );
    expect(REASON_TOO_LONG_MESSAGE).toContain(String(REASON_MAX_LENGTH));
    expect(DATE_OUT_OF_RANGE_MESSAGE).toContain(String(MAX_DAYS_BACK));
  });
});

describe("mensagens com nome e hora", () => {
  it("alreadyDeliveredMessage usa a hora de São Paulo", () => {
    expect(
      alreadyDeliveredMessage("Ana Teste", new Date("2026-11-20T17:05:00Z")),
    ).toBe("Esta passagem já foi entregue por Ana Teste às 14:05.");
  });

  it("alreadyConfirmedMessage usa a hora de São Paulo", () => {
    expect(
      alreadyConfirmedMessage("Bia Teste", new Date("2026-11-21T02:59:00Z")),
    ).toBe("Esta passagem já foi confirmada por Bia Teste às 23:59.");
  });
});
```

Crie `src/features/handovers/limits.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import * as limits from "./limits";

describe("limites da passagem", () => {
  it("valores combinados (o teto vale só no domínio; mudar não exige migração)", () => {
    expect({ ...limits }).toEqual({
      MAX_QUANTITY: 99_999,
      TEXT_MAX_LENGTH: 2000,
      ITEM_NOTE_MAX_LENGTH: 200,
      CONFIRMATION_NOTE_MAX_LENGTH: 500,
      REASON_MAX_LENGTH: 500,
      MAX_DAYS_BACK: 31,
      HISTORY_MAX_DAYS: 93,
      HISTORY_DEFAULT_DAYS: 7,
      AUTOSAVE_DEBOUNCE_MS: 800,
      SECTOR_COOKIE: "closery_setor",
      SECTOR_COOKIE_MAX_AGE_SECONDS: 31_536_000,
      ALL_SECTORS: "todos",
      NEXT_SHIFT_PREVIEW_LENGTH: 200,
    });
  });

  it("o cookie dura um ano", () => {
    expect(limits.SECTOR_COOKIE_MAX_AGE_SECONDS).toBe(365 * 24 * 60 * 60);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `bun run test -- src/features/handovers`
Expected: FAIL nos 12 arquivos, todos "Failed Suites" por import relativo ausente, por exemplo `Error: Cannot find module './saoPaulo' imported from …/src/features/handovers/saoPaulo.test.ts`, e igualmente `'./access'`, `'./diff'`, `'./fieldRules'`, `'./historyFilters'`, `'./limits'` (também em `quantity.test.ts`), `'./messages'`, `'./sectorChoice'`, `'./shiftSuggestion'`, `'./status'`, `'./urls'`. Resumo: `Test Files  12 failed (12)`, `Tests  no tests`.

- [ ] **Step 5: Write minimal implementation (constantes, tipos, fuso, quantidade, mensagens)**

Crie `src/features/handovers/limits.ts`:

```ts
// Constantes da passagem. Sem I/O: o cliente também importa daqui.
export const MAX_QUANTITY = 99_999;
export const TEXT_MAX_LENGTH = 2000; // Ocorrências e Fica para o próximo turno
export const ITEM_NOTE_MAX_LENGTH = 200;
export const CONFIRMATION_NOTE_MAX_LENGTH = 500;
export const REASON_MAX_LENGTH = 500;
export const MAX_DAYS_BACK = 31;
export const HISTORY_MAX_DAYS = 93;
export const HISTORY_DEFAULT_DAYS = 7;
export const AUTOSAVE_DEBOUNCE_MS = 800;
export const SECTOR_COOKIE = "closery_setor";
export const SECTOR_COOKIE_MAX_AGE_SECONDS = 31_536_000;
export const ALL_SECTORS = "todos"; // valor de ?setor= no histórico do admin
export const NEXT_SHIFT_PREVIEW_LENGTH = 200; // trecho no cartão do Início
```

Crie `src/features/handovers/types.ts`:

```ts
import type { ItemKind } from "@/lib/itemKinds";

// Tipos compartilhados da passagem. Sem I/O: o cliente também importa daqui.

export type HandoverRef = {
  sectorId: string;
  shiftId: string;
  operationalDate: string; // "YYYY-MM-DD"
};

export type ShiftChoice = {
  id: string;
  name: string;
  startsAt: string; // "HH:mm"
  endsAt: string; // "HH:mm"
};

export type FormMode = "draft" | "edit" | "correction";

// note "" = sem observação.
export type ItemLine = {
  itemId: string;
  name: string;
  unit: string;
  kind: ItemKind;
  quantity: number;
  note: string;
};

export type FieldChange =
  | { field: "occurrences"; value: string }
  | { field: "nextShift"; value: string }
  | { field: "quantity"; itemId: string; value: number }
  | { field: "note"; itemId: string; value: string };

export type SaveFieldInput = HandoverRef & FieldChange;

// Estado controlado do formulário.
export type FieldValues = {
  occurrencesText: string;
  nextShiftText: string;
  quantities: Record<string, number>; // por itemId
  notes: Record<string, string>; // por itemId, "" = sem observação
};

export type SavedMark = { at: Date; byName: string };
```

Crie `src/features/handovers/saoPaulo.ts`:

```ts
import { MAX_DAYS_BACK } from "./limits";

// O cálculo compara a hora de parede em São Paulo (via Intl), sem somar um
// offset fixo. O Brasil não tem horário de verão desde 2019, mas o código não
// depende disso: se a regra voltar, o Intl acompanha.
export const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";

const PARTS_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: SAO_PAULO_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const TIME_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: SAO_PAULO_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

/** Dia ("YYYY-MM-DD") e minutos desde 00:00 (0..1439) em hora de parede de São Paulo. */
export function saoPauloParts(now: Date): { date: string; minutes: number } {
  const parts = new Map<string, string>();
  for (const part of PARTS_FORMAT.formatToParts(now)) {
    parts.set(part.type, part.value);
  }
  const hour = Number(parts.get("hour")) % 24;
  const minute = Number(parts.get("minute"));
  return {
    date: `${parts.get("year")}-${parts.get("month")}-${parts.get("day")}`,
    minutes: hour * 60 + minute,
  };
}

export function todayInSaoPaulo(now: Date): string {
  return saoPauloParts(now).date;
}

function utcMillis(isoDate: string): number | null {
  const match = ISO_DATE.exec(isoDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const millis = Date.UTC(year, month - 1, day);
  const probe = new Date(millis);
  // O Date rola "2026-02-30" para março; a data só vale se sobreviver à ida e volta.
  const real =
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day;
  return real ? millis : null;
}

function requireMillis(isoDate: string): number {
  const millis = utcMillis(isoDate);
  if (millis === null) {
    throw new RangeError(`Data inválida: "${isoDate}"`);
  }
  return millis;
}

/** Formato "YYYY-MM-DD" E data real: "2026-02-30" é falso. */
export function isIsoDate(value: string): boolean {
  return utcMillis(value) !== null;
}

/** "2026-11-30" + 1 → "2026-12-01"; aceita negativo. Lança RangeError se a data for inválida. */
export function addDays(date: string, days: number): string {
  const shifted = new Date(requireMillis(date) + days * MS_PER_DAY);
  return shifted.toISOString().slice(0, 10);
}

/** to − from, em dias inteiros (negativo se `to` for anterior). Lança RangeError se alguma data for inválida. */
export function daysBetween(from: string, to: string): number {
  return Math.round((requireMillis(to) - requireMillis(from)) / MS_PER_DAY);
}

/** Data real entre (hoje − 31 dias) e hoje, no dia de São Paulo. */
export function isOperationalDateAllowed(date: string, now: Date): boolean {
  if (!isIsoDate(date)) return false;
  const today = todayInSaoPaulo(now);
  return date >= addDays(today, -MAX_DAYS_BACK) && date <= today;
}

/** "14:05", em São Paulo. */
export function formatTimeBR(date: Date): string {
  return TIME_FORMAT.format(date);
}

/** "2026-11-21" → "21/11/2026". Só reformata o texto (nunca passa por Date). */
export function formatDateBR(isoDate: string): string {
  const match = ISO_DATE.exec(isoDate);
  if (!match || !isIsoDate(isoDate)) {
    throw new RangeError(`Data inválida: "${isoDate}"`);
  }
  return `${match[3]}/${match[2]}/${match[1]}`;
}
```

Crie `src/features/handovers/quantity.ts`:

```ts
import { MAX_QUANTITY } from "./limits";

const MAX_DIGITS = String(MAX_QUANTITY).length;
const NUMBER_FORMAT = new Intl.NumberFormat("pt-BR");

/** Só dígitos, sem zeros à esquerda ("007" → "7", "000" → "0"), no máximo 5 dígitos. "" fica "". */
export function sanitizeQuantityInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits.slice(0, MAX_DIGITS);
}

/** "" → null; "12" → 12; acima do teto → MAX_QUANTITY. Ignora tudo que não é dígito. */
export function parseQuantity(raw: string): number | null {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return null;
  return Math.min(Number(digits), MAX_QUANTITY);
}

/** Soma ou subtrai 1; trava em 0 e em MAX_QUANTITY. */
export function stepQuantity(value: number, delta: 1 | -1): number {
  return Math.min(Math.max(value + delta, 0), MAX_QUANTITY);
}

/** pt-BR: 1234 → "1.234". */
export function formatQuantity(value: number): string {
  return NUMBER_FORMAT.format(value);
}
```

Crie `src/features/handovers/messages.ts`:

```ts
import { formatTimeBR } from "./saoPaulo";

// Mensagens da passagem, prontas para a tela. Os testes e o E2E dependem do
// texto exato; os números batem com ./limits (messages.test.ts confere).
export const HANDOVER_NOT_FOUND_MESSAGE =
  "Passagem não encontrada. Atualize a página.";
export const SECTOR_INACTIVE_HANDOVER_MESSAGE =
  "Este setor está inativo. Peça a um administrador para reativá-lo.";
export const SHIFT_INACTIVE_MESSAGE =
  "Este turno está inativo. Escolha outro turno.";
export const DATE_OUT_OF_RANGE_MESSAGE =
  "Escolha uma data de hoje ou dos últimos 31 dias.";
export const EDIT_FORBIDDEN_MESSAGE =
  "Só quem entregou o turno ou um administrador pode editar esta passagem.";
export const HANDOVER_LOCKED_MESSAGE =
  "Esta passagem já foi confirmada. Só um administrador corrige, com motivo.";
export const NOT_DELIVERED_MESSAGE = "Esta passagem ainda não foi entregue.";
export const OWN_HANDOVER_MESSAGE =
  "Quem entregou o turno não pode confirmar o recebimento. Peça a outra pessoa do setor.";
export const NOT_CONFIRMED_MESSAGE =
  "Só passagens confirmadas passam pela correção com motivo. Edite a passagem direto.";
export const CORRECTION_FORBIDDEN_MESSAGE =
  "Só um administrador pode corrigir uma passagem confirmada.";
export const NO_CHANGES_MESSAGE =
  "Nada foi alterado. Mude algum campo para registrar a correção.";
export const REASON_REQUIRED_MESSAGE = "Informe o motivo da correção.";
export const REASON_TOO_LONG_MESSAGE =
  "O motivo pode ter no máximo 500 caracteres.";
export const QUANTITY_MESSAGE = "Informe um número inteiro de 0 a 99.999.";
export const TEXT_TOO_LONG_MESSAGE =
  "O texto pode ter no máximo 2.000 caracteres.";
export const NOTE_TOO_LONG_MESSAGE =
  "A observação pode ter no máximo 200 caracteres.";
export const CONFIRMATION_NOTE_TOO_LONG_MESSAGE =
  "A observação pode ter no máximo 500 caracteres.";
export const INVALID_DATE_MESSAGE = "Data inválida.";
export const DUPLICATE_ITEM_MESSAGE = "Item repetido. Atualize a página.";
export const UNSAVED_DELIVER_MESSAGE =
  "Há alterações sem salvar. Toque em “Tentar de novo” e entregue de novo.";
export const SWITCH_FAILED_MESSAGE =
  "Não foi possível salvar. Tente de novo antes de trocar de turno.";

/** "Esta passagem já foi entregue por {nome} às {HH:mm}." (hora de São Paulo) */
export function alreadyDeliveredMessage(
  deliveredByName: string,
  deliveredAt: Date,
): string {
  return `Esta passagem já foi entregue por ${deliveredByName} às ${formatTimeBR(deliveredAt)}.`;
}

/** "Esta passagem já foi confirmada por {nome} às {HH:mm}." (hora de São Paulo) */
export function alreadyConfirmedMessage(
  confirmedByName: string,
  confirmedAt: Date,
): string {
  return `Esta passagem já foi confirmada por ${confirmedByName} às ${formatTimeBR(confirmedAt)}.`;
}
```

- [ ] **Step 6: Write minimal implementation (campos e turno sugerido)**

Crie `src/features/handovers/fieldRules.ts`:

```ts
import { ITEM_NOTE_MAX_LENGTH, MAX_QUANTITY, TEXT_MAX_LENGTH } from "./limits";
import {
  NOTE_TOO_LONG_MESSAGE,
  QUANTITY_MESSAGE,
  TEXT_TOO_LONG_MESSAGE,
} from "./messages";
import type { FieldChange } from "./types";

/** Conta pontos de código, não unidades UTF-16 (um emoji conta 1). */
export function codePointLength(value: string): number {
  let length = 0;
  for (const _ of value) length += 1;
  return length;
}

function normalizeLineBreaks(value: string): string {
  return value.normalize("NFC").replace(/\r\n?/g, "\n");
}

/** Texto livre guardado como digitado: NFC e quebras de linha \n; sem trim (salva enquanto a pessoa digita). */
export function normalizeFreeText(raw: string): string {
  return normalizeLineBreaks(raw);
}

/** Observação de item: NFC, qualquer sequência de espaços/quebras vira um espaço, trim. Vazio → null. */
export function normalizeItemNote(raw: string): string | null {
  const note = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  return note === "" ? null : note;
}

/** Observação do recebimento: NFC, \n, trim. Vazio → null. */
export function normalizeOptionalText(raw: string): string | null {
  const text = normalizeLineBreaks(raw).trim();
  return text === "" ? null : text;
}

/** Motivo da correção: NFC, \n, trim (pode sobrar ""). */
export function normalizeReason(raw: string): string {
  return normalizeLineBreaks(raw).trim();
}

/**
 * Revalida e normaliza um campo salvo pelo formulário. Devolve o valor
 * normalizado (a observação do item vira "" no lugar de null). O cliente e o
 * servidor usam esta mesma função.
 */
export function validateFieldChange(
  change: FieldChange,
): { ok: true; change: FieldChange } | { ok: false; message: string } {
  switch (change.field) {
    case "quantity": {
      const valid =
        Number.isInteger(change.value) &&
        change.value >= 0 &&
        change.value <= MAX_QUANTITY;
      return valid
        ? { ok: true, change }
        : { ok: false, message: QUANTITY_MESSAGE };
    }
    case "occurrences":
    case "nextShift": {
      const value = normalizeFreeText(change.value);
      if (codePointLength(value) > TEXT_MAX_LENGTH) {
        return { ok: false, message: TEXT_TOO_LONG_MESSAGE };
      }
      return { ok: true, change: { field: change.field, value } };
    }
    case "note": {
      const value = normalizeItemNote(change.value) ?? "";
      if (codePointLength(value) > ITEM_NOTE_MAX_LENGTH) {
        return { ok: false, message: NOTE_TOO_LONG_MESSAGE };
      }
      return {
        ok: true,
        change: { field: "note", itemId: change.itemId, value },
      };
    }
  }
}
```

Crie `src/features/handovers/shiftSuggestion.ts`:

```ts
import { MINUTES_PER_DAY, parseTimeOfDay } from "@/features/admin/timeOfDay";

import {
  addDays,
  daysBetween,
  isOperationalDateAllowed,
  saoPauloParts,
} from "./saoPaulo";

// Chega na ordem da lista do setor (sort_order, created_at, id): a posição
// desempata dois turnos com o mesmo fim.
export type SuggestableShift = { id: string; startsAt: string; endsAt: string };
export type HandoverTarget = { shiftId: string; operationalDate: string };

function minutesOf(value: string): number {
  const minutes = parseTimeOfDay(value);
  if (minutes === null) {
    throw new RangeError(`Horário inválido: "${value}"`);
  }
  return minutes;
}

/**
 * Fim do turno em hora de parede: o dia é o operacional (+1 se o turno
 * atravessa a meia-noite) e `minutes` são os minutos do fim.
 */
export function shiftEnd(
  operationalDate: string,
  shift: SuggestableShift,
): { date: string; minutes: number } {
  const start = minutesOf(shift.startsAt);
  const end = minutesOf(shift.endsAt);
  return {
    date: end < start ? addDays(operationalDate, 1) : operationalDate,
    minutes: end,
  };
}

/** Fim ≤ agora (fim == agora conta como encerrado; mesma regra do SQL do histórico). */
export function hasShiftEnded(
  operationalDate: string,
  shift: SuggestableShift,
  now: Date,
): boolean {
  const end = shiftEnd(operationalDate, shift);
  const current = saoPauloParts(now);
  if (end.date !== current.date) return end.date < current.date;
  return end.minutes <= current.minutes;
}

type Candidate = {
  shiftId: string;
  operationalDate: string;
  distance: number;
  ended: boolean;
  position: number;
};

// Só ontem e hoje: um turno que começa amanhã não pode ter passagem ainda, e a
// data de amanhã seria recusada por isOperationalDateAllowed.
const CANDIDATE_DAY_OFFSETS = [-1, 0] as const;

function isBetter(a: Candidate, b: Candidate): boolean {
  if (a.distance !== b.distance) return a.distance < b.distance;
  // Empate de distância: o que já terminou vence o que ainda vai terminar.
  if (a.ended !== b.ended) return a.ended;
  if (a.position !== b.position) return a.position < b.position;
  return a.operationalDate < b.operationalDate;
}

/**
 * Turno sugerido agora: o do fim mais próximo de agora (antes ou depois).
 * O dia operacional é o dia em que o turno COMEÇOU (turno 22:00–06:00 que
 * termina às 06:05 de hoje → dia de ontem). Sem turnos → null.
 */
export function suggestShift(
  shifts: readonly SuggestableShift[],
  now: Date,
): HandoverTarget | null {
  const current = saoPauloParts(now);
  let best: Candidate | null = null;

  for (const [position, shift] of shifts.entries()) {
    for (const offset of CANDIDATE_DAY_OFFSETS) {
      const operationalDate = addDays(current.date, offset);
      const end = shiftEnd(operationalDate, shift);
      const endAt =
        daysBetween(current.date, end.date) * MINUTES_PER_DAY + end.minutes;
      const candidate: Candidate = {
        shiftId: shift.id,
        operationalDate,
        distance: Math.abs(endAt - current.minutes),
        ended: endAt <= current.minutes,
        position,
      };
      if (best === null || isBetter(candidate, best)) best = candidate;
    }
  }

  if (best === null) return null;
  return { shiftId: best.shiftId, operationalDate: best.operationalDate };
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Turno E data válidos na URL → usa; qualquer outra coisa → sugestão
 * (`suggested: true`). Sem turnos → null. Parâmetro repetido vale o primeiro.
 */
export function resolveHandoverTarget(
  shifts: readonly SuggestableShift[],
  now: Date,
  requested: { shiftId?: string | string[]; date?: string | string[] },
): (HandoverTarget & { suggested: boolean }) | null {
  if (shifts.length === 0) return null;

  const shiftId = firstValue(requested.shiftId);
  const date = firstValue(requested.date);
  if (
    shiftId !== undefined &&
    date !== undefined &&
    shifts.some((shift) => shift.id === shiftId) &&
    isOperationalDateAllowed(date, now)
  ) {
    return { shiftId, operationalDate: date, suggested: false };
  }

  const suggestion = suggestShift(shifts, now);
  return suggestion === null ? null : { ...suggestion, suggested: true };
}
```

- [ ] **Step 7: Write minimal implementation (permissões, diff e situações)**

Crie `src/features/handovers/access.ts`:

```ts
import type { HandoverStatus } from "@/db/schema/handovers";
import { type Authz, canAccessSector, isAdmin } from "@/features/authz/authz";

import type { FormMode } from "./types";

export type HandoverCapabilities = {
  canView: boolean; // canAccessSector(actor, sectorId)
  canEditDirectly: boolean; // rascunho: canView; entregue: admin OU quem entregou; confirmada: false
  canDeliver: boolean; // status draft && canView
  canConfirm: boolean; // status delivered && canView && deliveredBy !== actor.userId
  canCorrectWithReason: boolean; // status confirmed && admin
};

/**
 * Única fonte da regra de quem pode o quê numa passagem: o domínio e a tela
 * usam esta função, para nunca divergirem (F3-4).
 */
export function handoverCapabilities(
  actor: Authz,
  handover: {
    status: HandoverStatus;
    sectorId: string;
    deliveredBy: string | null;
  },
): HandoverCapabilities {
  const canView = canAccessSector(actor, handover.sectorId);
  const admin = isAdmin(actor);
  const isDeliverer =
    handover.deliveredBy !== null && handover.deliveredBy === actor.userId;

  return {
    canView,
    canEditDirectly:
      canView &&
      (handover.status === "draft" ||
        (handover.status === "delivered" && (admin || isDeliverer))),
    canDeliver: canView && handover.status === "draft",
    canConfirm: canView && handover.status === "delivered" && !isDeliverer,
    canCorrectWithReason: canView && handover.status === "confirmed" && admin,
  };
}

/** Qual formulário a pessoa vê; null = nenhum (a página mostra o resumo). */
export function formModeOf(
  status: HandoverStatus | null,
  capabilities: HandoverCapabilities,
): FormMode | null {
  if ((status === null || status === "draft") && capabilities.canEditDirectly) {
    return "draft";
  }
  if (status === "delivered" && capabilities.canEditDirectly) return "edit";
  if (status === "confirmed" && capabilities.canCorrectWithReason) {
    return "correction";
  }
  return null;
}
```

Crie `src/features/handovers/diff.ts`:

```ts
import type { CorrectionField } from "@/db/schema/handovers";

import { normalizeFreeText, normalizeItemNote } from "./fieldRules";

export type HandoverValues = {
  occurrencesText: string;
  nextShiftText: string;
  items: readonly { itemId: string; quantity: number; note: string | null }[];
};

export type CorrectionChange = {
  field: CorrectionField;
  itemId: string | null;
  oldValue: string;
  newValue: string;
};

/**
 * O que mudou entre a passagem atual e o estado desejado: uma linha por campo
 * alterado, na ordem ocorrências, próximo turno e depois cada item de
 * `current` (quantidade, observação). Textos são comparados depois da
 * normalização; observação null e "" são o mesmo valor. Item ausente em
 * `next` fica inalterado; item só em `next` é ignorado (o domínio recusa antes).
 */
export function diffHandover(
  current: HandoverValues,
  next: HandoverValues,
): CorrectionChange[] {
  const changes: CorrectionChange[] = [];

  const newOccurrences = normalizeFreeText(next.occurrencesText);
  if (normalizeFreeText(current.occurrencesText) !== newOccurrences) {
    changes.push({
      field: "occurrences_text",
      itemId: null,
      oldValue: current.occurrencesText,
      newValue: newOccurrences,
    });
  }

  const newNextShift = normalizeFreeText(next.nextShiftText);
  if (normalizeFreeText(current.nextShiftText) !== newNextShift) {
    changes.push({
      field: "next_shift_text",
      itemId: null,
      oldValue: current.nextShiftText,
      newValue: newNextShift,
    });
  }

  for (const before of current.items) {
    const after = next.items.find((item) => item.itemId === before.itemId);
    if (after === undefined) continue;

    if (before.quantity !== after.quantity) {
      changes.push({
        field: "item_quantity",
        itemId: before.itemId,
        oldValue: String(before.quantity),
        newValue: String(after.quantity),
      });
    }

    const oldNote = normalizeItemNote(before.note ?? "") ?? "";
    const newNote = normalizeItemNote(after.note ?? "") ?? "";
    if (oldNote !== newNote) {
      changes.push({
        field: "item_note",
        itemId: before.itemId,
        oldValue: before.note ?? "",
        newValue: newNote,
      });
    }
  }

  return changes;
}

/** "Ocorrências do turno" · "Fica para o próximo turno" · "{item}: quantidade" · "{item}: observação". */
export function correctionFieldLabel(
  field: CorrectionField,
  itemName: string | null,
): string {
  switch (field) {
    case "occurrences_text":
      return "Ocorrências do turno";
    case "next_shift_text":
      return "Fica para o próximo turno";
    case "item_quantity":
      return `${itemName ?? "Item"}: quantidade`;
    case "item_note":
      return `${itemName ?? "Item"}: observação`;
  }
}

/** Valor vazio aparece como "(vazio)" na lista de correções. */
export function displayCorrectionValue(value: string): string {
  return value === "" ? "(vazio)" : value;
}
```

Crie `src/features/handovers/status.ts`:

```ts
import type { HandoverStatus } from "@/db/schema/handovers";

export const HISTORY_SITUATIONS = [
  "awaiting",
  "confirmed",
  "unconfirmed",
  "missing",
] as const;
export type HistorySituation = (typeof HISTORY_SITUATIONS)[number];

/** Rótulo da situação. "Confirmada por {nome}" quando o nome é conhecido. */
export function situationLabel(
  situation: HistorySituation,
  confirmedByName?: string | null,
): string {
  switch (situation) {
    case "awaiting":
      return "Aguardando recebimento";
    case "confirmed": {
      const name = confirmedByName?.trim();
      return name ? `Confirmada por ${name}` : "Confirmada";
    }
    case "unconfirmed":
      return "Não confirmada";
    case "missing":
      return "Sem passagem";
  }
}

// Selo à parte (uma passagem confirmada pode ser também "Corrigida").
export const CORRECTED_LABEL = "Corrigida";

export const STATUS_DESCRIPTION: Readonly<Record<HandoverStatus, string>> = {
  draft: "Rascunho",
  delivered: "Entregue",
  confirmed: "Confirmada",
};
```

- [ ] **Step 8: Write minimal implementation (filtros, links e escolha de setor)**

Crie `src/features/handovers/historyFilters.ts`:

```ts
import { HISTORY_MAX_DAYS } from "./limits";
import { addDays, daysBetween, isIsoDate } from "./saoPaulo";
import type { HistorySituation } from "./status";

export type HistoryPeriod = "7" | "30" | "range";
export type HistorySituationFilter = "all" | HistorySituation | "corrected";

// Valor de ?situacao= na URL (pt-BR).
export const SITUATION_PARAM: Readonly<Record<HistorySituationFilter, string>> =
  {
    all: "todas",
    awaiting: "aguardando",
    confirmed: "confirmada",
    unconfirmed: "nao-confirmada",
    missing: "sem-passagem",
    corrected: "corrigida",
  };

export type HistoryFilters = {
  period: HistoryPeriod;
  from: string; // "YYYY-MM-DD"
  to: string; // "YYYY-MM-DD"
  shiftId: string | null;
  situation: HistorySituationFilter;
};

type Params = Record<string, string | string[] | undefined>;

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function situationFromParam(
  param: string | undefined,
): HistorySituationFilter {
  const entry = Object.entries(SITUATION_PARAM).find(
    ([, value]) => value === param,
  );
  const key = entry?.[0];
  switch (key) {
    case "awaiting":
    case "confirmed":
    case "unconfirmed":
    case "missing":
    case "corrected":
      return key;
    default:
      return "all";
  }
}

function lastDays(today: string, days: number): { from: string; to: string } {
  return { from: addDays(today, -(days - 1)), to: today };
}

// null = intervalo ausente ou inválido (cai nos últimos 7 dias).
function parseRange(
  params: Params,
  today: string,
): { from: string; to: string } | null {
  const rawFrom = firstValue(params.de);
  const rawTo = firstValue(params.ate);
  if (
    rawFrom === undefined ||
    rawTo === undefined ||
    !isIsoDate(rawFrom) ||
    !isIsoDate(rawTo)
  ) {
    return null;
  }
  // Pontas invertidas são trocadas.
  const [low, high] = rawFrom <= rawTo ? [rawFrom, rawTo] : [rawTo, rawFrom];
  // Intervalo inteiro no futuro não diz nada: volta ao padrão.
  if (low > today) return null;
  const to = high > today ? today : high;
  let from = low;
  if (daysBetween(from, to) + 1 > HISTORY_MAX_DAYS) {
    from = addDays(to, -(HISTORY_MAX_DAYS - 1));
  }
  return { from, to };
}

/**
 * Lê os filtros da URL. Nada aqui lança: valor desconhecido cai no padrão
 * (últimos 7 dias, todos os turnos, todas as situações).
 */
export function parseHistoryFilters(
  params: Params,
  today: string,
): HistoryFilters {
  const period = firstValue(params.periodo);
  let resolved: Pick<HistoryFilters, "period" | "from" | "to">;
  if (period === "30") {
    resolved = { period: "30", ...lastDays(today, 30) };
  } else {
    const range = period === "intervalo" ? parseRange(params, today) : null;
    resolved = range
      ? { period: "range", ...range }
      : { period: "7", ...lastDays(today, 7) };
  }

  const shift = firstValue(params.turno);
  return {
    ...resolved,
    shiftId:
      shift !== undefined && UUID.test(shift) ? shift.toLowerCase() : null,
    situation: situationFromParam(firstValue(params.situacao)),
  };
}

/** URL do histórico; omite o que é padrão (período 7, situação todas, sem turno, página 1). */
export function buildHistoryHref(
  filters: HistoryFilters,
  extras: { sector?: string; page?: number } = {},
): string {
  const query = new URLSearchParams();
  if (filters.period === "30") query.set("periodo", "30");
  if (filters.period === "range") {
    query.set("periodo", "intervalo");
    query.set("de", filters.from);
    query.set("ate", filters.to);
  }
  if (filters.shiftId) query.set("turno", filters.shiftId);
  if (filters.situation !== "all") {
    query.set("situacao", SITUATION_PARAM[filters.situation]);
  }
  if (extras.sector) query.set("setor", extras.sector);
  if (extras.page !== undefined && extras.page > 1) {
    query.set("pagina", String(extras.page));
  }
  const text = query.toString();
  return text === "" ? "/passagens" : `/passagens?${text}`;
}
```

Crie `src/features/handovers/urls.ts`:

```ts
import type { HandoverRef } from "./types";

// Lista fechada de caminhos onde o seletor de setor aparece: a Server Action
// só redireciona para um destes (nunca para um caminho vindo do cliente).
export const SECTOR_PICKER_PATHS = [
  "/",
  "/passagens",
  "/passagens/nova",
] as const;
export type SectorPickerPath = (typeof SECTOR_PICKER_PATHS)[number];

/** Nova passagem de um turno e dia; `sector` preserva o ?setor= do admin. */
export function newHandoverHref(ref: HandoverRef, sector?: string): string {
  const base = `/passagens/nova?turno=${encodeURIComponent(ref.shiftId)}&data=${encodeURIComponent(ref.operationalDate)}`;
  return sector ? `${base}&setor=${encodeURIComponent(sector)}` : base;
}

/** Resumo da passagem, ou o formulário de edição (`?editar=1`). */
export function handoverHref(
  id: string,
  options: { edit?: boolean } = {},
): string {
  const base = `/passagens/${id}`;
  return options.edit ? `${base}?editar=1` : base;
}

export function chooseSectorPath(
  path: SectorPickerPath,
  sectorId: string,
): string {
  return `${path}?setor=${sectorId}`;
}
```

Crie `src/features/handovers/sectorChoice.ts`:

```ts
import type { SectorChoice } from "@/features/admin/sectors";

import { ALL_SECTORS } from "./limits";

export type SectorSelection =
  | { kind: "sector"; sector: SectorChoice }
  | { kind: "all" }
  | { kind: "none" };

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Setor que o admin vê: URL "todos" (só com allowAll) → todos; URL na lista →
 * ele; cookie na lista → ele; senão o primeiro da lista; lista vazia → none.
 * `sectors` são só os ativos. O operador não usa esta função: o setor dele é
 * actor.sectorId (a página confere se está ativo).
 */
export function resolveHandoverSector(
  sectors: readonly SectorChoice[],
  sources: { url: string | string[] | undefined; cookie: string | undefined },
  options: { allowAll?: boolean } = {},
): SectorSelection {
  const first = sectors[0];
  if (first === undefined) return { kind: "none" };

  const url = firstValue(sources.url);
  if (options.allowAll && url === ALL_SECTORS) return { kind: "all" };

  const fromUrl = sectors.find((sector) => sector.id === url);
  if (fromUrl) return { kind: "sector", sector: fromUrl };

  const fromCookie = sectors.find((sector) => sector.id === sources.cookie);
  if (fromCookie) return { kind: "sector", sector: fromCookie };

  return { kind: "sector", sector: first };
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `bun run test -- src/features/handovers`
Expected: PASS (`Test Files  12 passed (12)`, 217 testes: `limits` 2, `saoPaulo` 31, `quantity` 16, `messages` 25, `fieldRules` 23, `shiftSuggestion` 40, `access` 16, `diff` 12, `status` 8, `historyFilters` 28, `urls` 6, `sectorChoice` 10).

- [ ] **Step 10: Formatar e rodar a verificação completa**

Run: `bunx biome check --write src test && bun run check-types && bun run lint && bun run test`
Expected: sem erros de tipo, Biome sem pendências e a suíte inteira verde (mesma observação do Step 7 da Tarefa 1 sobre `Timeout waiting for worker to respond`). Se o Biome reformatar quebras de linha, o comportamento não muda; o `--write` já deixa o arquivo no formato do projeto antes do commit.

- [ ] **Step 11: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-2.txt` (texto exato abaixo) e rode:

```bash
git add src/features/handovers
git commit -F .git/sdd/msg-task-2.txt
```

Mensagem:

```text
feat(passagem): lógica pura de fuso, turno sugerido, campos e permissões

Fuso de São Paulo via Intl, dia operacional, turno sugerido (fim mais
próximo, com desempates), quantidade, regras de campo, permissões por
papel e estado, diff de correção, situações do histórico, filtros da URL,
links, escolha de setor do admin e mensagens. Tudo sem I/O e com testes
de fronteira (virada UTC, meia-noite, empates, 2026-02-30, NFC, teto).

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 3: Contrato das actions e guardas (P27)

Esta tarefa tem **três commits**, nesta ordem: (A) refatoração isolada do helper de varredura, (B) códigos novos + schemas + `runHandoverAction`, (C) guardas novos. Nenhuma tela é criada; nenhum componente de UI muda (sem `ui-registry.md`).

**Files:**
- Create: `test/actionGuards.ts`
- Modify: `src/app/(app)/admin/actionsAuth.test.ts` (LER antes; troca só o cabeçalho, do início até antes de `describe("todo actions.ts do admin chama requireAdmin() primeiro"`; todos os casos continuam)
- Modify: `src/features/admin/result.ts` (LER antes; 10 códigos novos em `AdminErrorCode`)
- Modify: `src/features/admin/result.test.ts` (LER antes; import + um `describe` no fim)
- Modify: `src/features/handovers/urls.ts` (criado na Tarefa 2; LER antes; só se `SECTOR_PICKER_PATHS` não for uma tupla `as const`, ver Step 10)
- Create: `src/features/handovers/schemas.ts`
- Create: `src/features/handovers/runHandoverAction.ts`
- Create: `src/app/actionsGuards.test.ts`
- Modify: `src/app/appPagesAuth.test.ts` (LER antes; guarda de páginas aceita lista de guardas; `admin/` exige `requireAdmin`)
- Test: `src/features/admin/result.test.ts`, `src/features/handovers/schemas.test.ts`, `src/features/handovers/runHandoverAction.test.ts`, `src/app/actionsGuards.test.ts`, `src/app/appPagesAuth.test.ts`, `src/app/(app)/admin/actionsAuth.test.ts`

**Interfaces:**
- Consumes (Tarefas 1 e 2, nomes e assinaturas do contrato): `@/features/handovers/limits` (`ALL_SECTORS`, `CONFIRMATION_NOTE_MAX_LENGTH`, `ITEM_NOTE_MAX_LENGTH`, `MAX_QUANTITY`, `REASON_MAX_LENGTH`, `TEXT_MAX_LENGTH`); `@/features/handovers/messages` (`CONFIRMATION_NOTE_TOO_LONG_MESSAGE`, `DUPLICATE_ITEM_MESSAGE`, `INVALID_DATE_MESSAGE`, `NOTE_TOO_LONG_MESSAGE`, `QUANTITY_MESSAGE`, `REASON_REQUIRED_MESSAGE`, `REASON_TOO_LONG_MESSAGE`, `TEXT_TOO_LONG_MESSAGE`); `@/features/handovers/fieldRules` (`codePointLength`, `normalizeFreeText`, `normalizeItemNote`, `normalizeOptionalText`, `normalizeReason`, `validateFieldChange(change: FieldChange)`); `@/features/handovers/saoPaulo` (`isIsoDate`); `@/features/handovers/urls` (`SECTOR_PICKER_PATHS`); de `@/features/admin`: `idSchema`, `firstFieldErrors`, `CHOICE_LIST_LIMIT`, `fail`, `INTERNAL_ERROR_MESSAGE`, `INVALID_INPUT_MESSAGE`, `AdminResult`; `Authz` de `@/features/authz/authz`; `test/authz.ts` (`authzOf`).
- Produces:
  - `AdminErrorCode` ganha `"SHIFT_INACTIVE" | "DATE_OUT_OF_RANGE" | "FORBIDDEN" | "HANDOVER_LOCKED" | "ALREADY_DELIVERED" | "NOT_DELIVERED" | "ALREADY_CONFIRMED" | "OWN_HANDOVER" | "NOT_CONFIRMED" | "NO_CHANGES"`.
  - `src/features/handovers/schemas.ts`: `isoDateSchema`, `handoverRefSchema`, `saveFieldSchema`, `deliverHandoverSchema`, `confirmHandoverSchema`, `correctHandoverSchema`, `chooseSectorSchema` e os tipos `SaveFieldInputParsed`, `DeliverHandoverInput`, `ConfirmHandoverInput`, `CorrectHandoverInput`, `ChooseSectorInput` (`z.infer`, isto é, a saída já normalizada). Saídas relevantes: `saveFieldSchema` → `SaveFieldInput` com `value` normalizado (nota vazia = `""`); `confirmHandoverSchema` → `{ id: string; note: string | null }`; `correctHandoverSchema` → `{ id, reason (aparado, não vazio), occurrencesText, nextShiftText, items: { itemId; quantity; note: string }[] }` (nota nula vira `""`).
  - `runHandoverAction<S, T>(args: { actor: Authz; schema: S; input: unknown; revalidate: boolean; run: (ctx: { db: Db; now: Date; actor: Authz; input: z.output<S> }) => Promise<AdminResult<T>> }): Promise<AdminResult<T>>` (`server-only`).
  - `test/actionGuards.ts`: `GuardName`, `stripComments`, `actionsMissingGuard(source, allowed)`, `startsWithUseServer`, `hasUseServerDirective`, `listSourceFiles(dir, filter)`.
  - `src/app/actionsGuards.test.ts` exporta `AUTH_ACTION_FILES` e `actionFileProblems(path, source)`; as Tarefas 7 e 8 só **sobem** `MIN_APP_ACTION_FILES` (para 1 e 2) neste arquivo.
  - `src/app/appPagesAuth.test.ts`: `pageCallsAuthGuard(pageSource, readComponent, accepted = ["requireUser", "requireAdmin"])`; páginas sob `admin/` são checadas com `["requireAdmin"]`. A Tarefa 8 cria o teste `it("inclui a página de cada rota de /passagens")` (uma lista própria, separada da de `/admin`); as Tarefas 9 e 10 acrescentam a rota delas a **essa** lista, e a 10 sobe o mínimo para 12.

#### Parte A: refatoração isolada (commit só de refatoração)

- [ ] **Step 1: Baseline verde antes de mexer**

Run: `bun run test -- "src/app/(app)/admin/actionsAuth.test.ts"`
Expected: PASS (20 testes). Anote: o mesmo arquivo tem de continuar com 20 testes e os mesmos nomes no fim da Parte A.

- [ ] **Step 2: Criar o helper extraído**

Crie `test/actionGuards.ts` (mesmo comportamento do código atual de `actionsAuth.test.ts`; as únicas generalizações são a lista de guardas aceitos e a detecção de `"use server"` inline):

```ts
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Varredura das Server Actions, compartilhada pelos guardas. Uma Server Action
// é um endpoint público: cada função exportada autoriza por conta própria, com
// o guarda como PRIMEIRA instrução (F2-7, F3-13b).

export type GuardName = "requireAdmin" | "requireUser";

export function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// Índice do `}` que fecha o `{` em `open` (ignora chaves dentro de strings).
function matchingBrace(source: string, open: number): number {
  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < source.length; i++) {
    const char = source.charAt(i);
    if (quote) {
      if (char === "\\") i++;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) return i;
  }
  return -1;
}

// Índice do `{` que abre o corpo da função: depois dos parênteses dos
// parâmetros, pulando chaves de tipos como `Promise<AdminResult<{ id: string }>>`.
function bodyStart(source: string, afterName: number): number {
  const paramsOpen = source.indexOf("(", afterName);
  if (paramsOpen === -1) return -1;
  let depth = 0;
  let i = paramsOpen;
  for (; i < source.length; i++) {
    const char = source.charAt(i);
    if (char === "(") depth++;
    else if (char === ")" && --depth === 0) break;
  }
  let angle = 0;
  for (i += 1; i < source.length; i++) {
    const char = source.charAt(i);
    if (char === "<") angle++;
    else if (char === ">" && source.charAt(i - 1) !== "=") angle--;
    else if (char === "{" && angle === 0) return i;
  }
  return -1;
}

function firstStatementGuard(allowed: readonly GuardName[]): RegExp {
  return new RegExp(
    `^\\s*(?:const\\s+[\\w$]+\\s*=\\s*)?await\\s+(?:${allowed.join("|")})\\s*\\(\\s*\\)`,
  );
}

/**
 * Nomes dos exports de um actions.ts que não cumprem o contrato: função
 * `export async function` cujo corpo não começa com `await <guarda>()`
 * (comentários removidos), ou qualquer outro export em tempo de execução
 * (`const`, `function` síncrona, `default`, `{ … }`). [] = tudo certo.
 */
export function actionsMissingGuard(
  source: string,
  allowed: readonly GuardName[],
): string[] {
  const code = stripComments(source);
  const guard = firstStatementGuard(allowed);
  const offenders: string[] = [];

  for (const match of code.matchAll(
    /^export\s+(async\s+function\s+([\w$]+)|default\b|(?:const|let|var|function|class)\s+([\w$]+)|\{|\*)/gm,
  )) {
    const name = match[2] ?? match[3] ?? match[1] ?? "export";
    if (match[2] === undefined) {
      offenders.push(name.trim());
      continue;
    }
    const start = match.index + match[0].length;
    const open = bodyStart(code, start);
    const close = open === -1 ? -1 : matchingBrace(code, open);
    const body = open === -1 || close === -1 ? "" : code.slice(open + 1, close);
    if (!guard.test(body)) offenders.push(match[2]);
  }
  return offenders;
}

export function startsWithUseServer(source: string): boolean {
  return /^\s*(["'])use server\1/.test(stripComments(source));
}

/** Diretiva de arquivo OU inline (`"use server"` como primeira instrução de uma função). */
export function hasUseServerDirective(source: string): boolean {
  return /(?:^|[;{}\n])\s*(["'])use server\1/.test(stripComments(source));
}

/** Arquivos de `dir` (recursivo) cujo nome passa em `filter`, caminho completo. */
export function listSourceFiles(
  dir: string,
  filter: (name: string) => boolean,
): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listSourceFiles(full, filter);
    return filter(name) ? [full] : [];
  });
}
```

- [ ] **Step 3: Trocar o cabeçalho de `actionsAuth.test.ts`**

Leia `src/app/(app)/admin/actionsAuth.test.ts`. Apague tudo que vem **antes** da linha `describe("todo actions.ts do admin chama requireAdmin() primeiro", () => {` (imports, constantes e as funções `stripComments`, `matchingBrace`, `bodyStart`, `actionsMissingAdminGuard`, `startsWithUseServer`, `findActionFiles`) e coloque no lugar exatamente isto (o resto do arquivo, a partir do `describe`, não muda):

```ts
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import {
  actionsMissingGuard,
  listSourceFiles,
  startsWithUseServer,
} from "../../../../test/actionGuards";

// Guarda das Server Actions do admin. Uma Server Action é um endpoint público:
// pode ser chamada de qualquer rota, então cada função exportada autoriza por
// conta própria, com `requireAdmin()` como PRIMEIRA instrução (F2-7). A
// varredura vive em test/actionGuards.ts, compartilhada com src/app/actionsGuards.test.ts.

const ROOT = process.cwd();
const ADMIN_DIR = join(ROOT, "src", "app", "(app)", "admin");

// Sobe para 5 na Tarefa 11, quando existirem os cinco actions.ts (setores,
// destinos, turnos, itens, equipe).
const MIN_ACTION_FILES = 5;

/** Nomes dos exports que não cumprem o contrato do admin ([] = tudo certo). */
export function actionsMissingAdminGuard(source: string): string[] {
  return actionsMissingGuard(source, ["requireAdmin"]);
}

function findActionFiles(dir: string): string[] {
  return listSourceFiles(dir, (name) => name === "actions.ts");
}

```

- [ ] **Step 4: Rodar a suíte antiga e a verificação**

Run: `bunx biome check --write test/actionGuards.ts "src/app/(app)/admin/actionsAuth.test.ts" && bun run test -- "src/app/(app)/admin/actionsAuth.test.ts" && bun run check-types && bun run lint`
Expected: PASS (20 testes, os mesmos de antes), `check-types` e `lint` sem erro. Se algum caso antigo falhar, a extração mudou comportamento: corrija o helper, nunca o teste.

- [ ] **Step 5: Commit (só refatoração)**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-3-refactor.txt` (texto exato abaixo) e rode:
```bash
git add test/actionGuards.ts "src/app/(app)/admin/actionsAuth.test.ts"
git commit -F .git/sdd/msg-task-3-refactor.txt
```
Mensagem:
```text
refactor(test): extrai a varredura de Server Actions para test/actionGuards.ts

Move o código de varredura de admin/actionsAuth.test.ts para um helper
compartilhado (lista de guardas aceitos e detecção de "use server" inline),
sem mudar comportamento: os 20 casos antigos continuam verdes. Prepara o
guarda de todas as actions (P27).

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

#### Parte B: códigos, schemas e runner

- [ ] **Step 6: Escrever o teste dos códigos novos**

Leia `src/features/admin/result.test.ts`. No import de `@/features/admin/result`, acrescente `type AdminErrorCode,` antes de `fail,`:

```ts
import {
  type AdminErrorCode,
  fail,
  INTERNAL_ERROR_MESSAGE,
  INVALID_INPUT_MESSAGE,
  ok,
} from "@/features/admin/result";
```

e acrescente no **fim** do arquivo:

```ts

describe("códigos da passagem (aditivos)", () => {
  it("fail aceita os 10 códigos novos e os da Fase 2 continuam valendo", () => {
    const codes: AdminErrorCode[] = [
      "SHIFT_INACTIVE",
      "DATE_OUT_OF_RANGE",
      "FORBIDDEN",
      "HANDOVER_LOCKED",
      "ALREADY_DELIVERED",
      "NOT_DELIVERED",
      "ALREADY_CONFIRMED",
      "OWN_HANDOVER",
      "NOT_CONFIRMED",
      "NO_CHANGES",
      "NOT_FOUND",
      "INTERNAL",
    ];
    for (const code of codes) {
      expect(fail(code, "x")).toEqual({ ok: false, code, message: "x" });
    }
  });
});
```

- [ ] **Step 7: Ver o tipo falhar**

Run: `bun run check-types`
Expected: FAIL com 10 erros, um por código novo, em `src/features/admin/result.test.ts`, a começar por `error TS2322: Type '"SHIFT_INACTIVE"' is not assignable to type 'AdminErrorCode'.` (os outros nove: `DATE_OUT_OF_RANGE`, `FORBIDDEN`, `HANDOVER_LOCKED`, `ALREADY_DELIVERED`, `NOT_DELIVERED`, `ALREADY_CONFIRMED`, `OWN_HANDOVER`, `NOT_CONFIRMED` e `NO_CHANGES`). O vitest sozinho não pega: união de tipos só falha no `tsc`.

- [ ] **Step 8: Acrescentar os códigos**

Em `src/features/admin/result.ts`, troque o fim da união (`| "INVITE_NOT_PENDING"` seguido de `| "INTERNAL";`) por:

```ts
  | "INVITE_NOT_PENDING"
  | "SHIFT_INACTIVE"
  | "DATE_OUT_OF_RANGE"
  | "FORBIDDEN"
  | "HANDOVER_LOCKED"
  | "ALREADY_DELIVERED"
  | "NOT_DELIVERED"
  | "ALREADY_CONFIRMED"
  | "OWN_HANDOVER"
  | "NOT_CONFIRMED"
  | "NO_CHANGES"
  | "INTERNAL";
```

- [ ] **Step 9: Ver passar**

Run: `bun run check-types && bun run test -- src/features/admin/result.test.ts`
Expected: `check-types` sem erro; PASS (7 testes).

- [ ] **Step 10: Garantir a tupla `as const` em `urls.ts`**

Leia `src/features/handovers/urls.ts` (Tarefa 2). O `z.enum` de `chooseSectorSchema` exige uma **tupla**, não `readonly SectorPickerPath[]`. Se `SECTOR_PICKER_PATHS` já for `[...] as const` (com `SectorPickerPath = (typeof SECTOR_PICKER_PATHS)[number]`), não mude nada. Senão troque a declaração do tipo e da constante por (continua atribuível a `readonly SectorPickerPath[]`; os testes da Tarefa 2 seguem verdes):

```ts
// Tupla `as const`: o z.enum do schema exige uma tupla, e ela continua
// atribuível a `readonly SectorPickerPath[]`.
export const SECTOR_PICKER_PATHS = [
  "/",
  "/passagens",
  "/passagens/nova",
] as const;
export type SectorPickerPath = (typeof SECTOR_PICKER_PATHS)[number];
```

Run: `bun run check-types && bun run test -- src/features/handovers/urls.test.ts`
Expected: sem erro; PASS (os testes de `urls` da Tarefa 2).

- [ ] **Step 11: Escrever o teste dos schemas**

Crie `src/features/handovers/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";

import type { FieldErrors } from "@/features/admin/result";
import { firstFieldErrors } from "@/features/admin/schemas";

import {
  chooseSectorSchema,
  confirmHandoverSchema,
  correctHandoverSchema,
  deliverHandoverSchema,
  handoverRefSchema,
  isoDateSchema,
  saveFieldSchema,
} from "./schemas";

const SECTOR = "00000000-0000-4000-8000-000000000001";
const SHIFT = "00000000-0000-4000-8000-000000000002";
const ITEM = "00000000-0000-4000-8000-000000000003";
const OTHER_ITEM = "00000000-0000-4000-8000-000000000004";
const HANDOVER = "00000000-0000-4000-8000-000000000005";
const REF = { sectorId: SECTOR, shiftId: SHIFT, operationalDate: "2026-11-20" };

function errorsOf(schema: ZodType, input: unknown): FieldErrors {
  const parsed = schema.safeParse(input);
  return parsed.success ? {} : firstFieldErrors(parsed.error);
}

describe("isoDateSchema", () => {
  it("aceita data real", () => {
    expect(isoDateSchema.safeParse("2026-11-20").success).toBe(true);
  });

  it.each([
    "2026-02-30",
    "20/11/2026",
    "",
    "2026-13-01",
    "2026-11-2",
  ])("recusa %j com a mensagem em pt-BR", (value) => {
    const parsed = isoDateSchema.safeParse(value);
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe("Data inválida.");
  });

  it("recusa o que nem é texto", () => {
    expect(isoDateSchema.safeParse(20261120).success).toBe(false);
  });
});

describe("handoverRefSchema e deliverHandoverSchema", () => {
  it("aceita a tripla", () => {
    expect(handoverRefSchema.parse(REF)).toEqual(REF);
    expect(deliverHandoverSchema.parse(REF)).toEqual(REF);
  });

  it("id malformado e data inválida dão mensagens por campo", () => {
    expect(
      errorsOf(handoverRefSchema, {
        sectorId: "x",
        shiftId: SHIFT,
        operationalDate: "2026-02-30",
      }),
    ).toEqual({
      sectorId: "Registro inválido. Atualize a página.",
      operationalDate: "Data inválida.",
    });
  });
});

describe("saveFieldSchema", () => {
  it("quantidade: 0 e o teto passam", () => {
    for (const value of [0, 1, 99_999]) {
      const parsed = saveFieldSchema.parse({
        ...REF,
        field: "quantity",
        itemId: ITEM,
        value,
      });
      expect(parsed).toEqual({
        ...REF,
        field: "quantity",
        itemId: ITEM,
        value,
      });
    }
  });

  it.each([
    -1,
    1.5,
    100_000,
    Number.NaN,
    "3",
    null,
  ])("quantidade %j é recusada com a mensagem do campo value", (value) => {
    expect(
      errorsOf(saveFieldSchema, {
        ...REF,
        field: "quantity",
        itemId: ITEM,
        value,
      }),
    ).toEqual({ value: "Informe um número inteiro de 0 a 99.999." });
  });

  it("texto: devolve o valor normalizado (NFC, quebra de linha), sem trim", () => {
    const parsed = saveFieldSchema.parse({
      ...REF,
      field: "occurrences",
      value: "  e\u{301}\r\nlinha  ",
    });
    expect(parsed).toEqual({
      ...REF,
      field: "occurrences",
      value: "  \u{e9}\nlinha  ",
    });
  });

  it("texto: 2.000 pontos de código passam; 2.001 com emoji não", () => {
    const limit = "😀".repeat(2000);
    expect(
      saveFieldSchema.safeParse({ ...REF, field: "nextShift", value: limit })
        .success,
    ).toBe(true);
    expect(
      errorsOf(saveFieldSchema, {
        ...REF,
        field: "nextShift",
        value: `${limit}😀`,
      }),
    ).toEqual({ value: "O texto pode ter no máximo 2.000 caracteres." });
  });

  it("nota: espaços colapsam, quebra de linha vira espaço, vazio vira ''", () => {
    const parsed = saveFieldSchema.parse({
      ...REF,
      field: "note",
      itemId: ITEM,
      value: "  rede\n  rasgada  ",
    });
    expect(parsed).toMatchObject({ field: "note", value: "rede rasgada" });
    const empty = saveFieldSchema.parse({
      ...REF,
      field: "note",
      itemId: ITEM,
      value: "   ",
    });
    expect(empty).toMatchObject({ value: "" });
  });

  it("nota: 201 caracteres é recusada", () => {
    expect(
      errorsOf(saveFieldSchema, {
        ...REF,
        field: "note",
        itemId: ITEM,
        value: "a".repeat(201),
      }),
    ).toEqual({ value: "A observação pode ter no máximo 200 caracteres." });
  });

  it("campo desconhecido, item sem id e tripla inválida são recusados", () => {
    expect(
      saveFieldSchema.safeParse({ ...REF, field: "outro", value: "x" }).success,
    ).toBe(false);
    expect(
      saveFieldSchema.safeParse({ ...REF, field: "quantity", value: 1 })
        .success,
    ).toBe(false);
    expect(
      saveFieldSchema.safeParse({
        ...REF,
        operationalDate: "2026-02-30",
        field: "occurrences",
        value: "",
      }).success,
    ).toBe(false);
  });
});

describe("confirmHandoverSchema", () => {
  it("observação vazia ou só espaços vira null; texto sai aparado", () => {
    expect(confirmHandoverSchema.parse({ id: HANDOVER, note: "   " })).toEqual({
      id: HANDOVER,
      note: null,
    });
    expect(
      confirmHandoverSchema.parse({ id: HANDOVER, note: "  tudo certo \r\n" }),
    ).toEqual({ id: HANDOVER, note: "tudo certo" });
  });

  it("500 caracteres passam; 501 não, com erro no campo note", () => {
    expect(
      confirmHandoverSchema.safeParse({ id: HANDOVER, note: "a".repeat(500) })
        .success,
    ).toBe(true);
    expect(
      errorsOf(confirmHandoverSchema, { id: HANDOVER, note: "a".repeat(501) }),
    ).toEqual({ note: "A observação pode ter no máximo 500 caracteres." });
  });

  it("id malformado é recusado", () => {
    expect(errorsOf(confirmHandoverSchema, { id: "x", note: "" })).toEqual({
      id: "Registro inválido. Atualize a página.",
    });
  });
});

describe("correctHandoverSchema", () => {
  const valid = {
    id: HANDOVER,
    reason: "  Contagem errada  ",
    occurrencesText: "a",
    nextShiftText: "b",
    items: [{ itemId: ITEM, quantity: 3, note: "  obs  " }],
  };

  it("normaliza motivo e nota; mantém textos e quantidade", () => {
    expect(correctHandoverSchema.parse(valid)).toEqual({
      ...valid,
      reason: "Contagem errada",
      items: [{ itemId: ITEM, quantity: 3, note: "obs" }],
    });
  });

  it("nota vazia vira string vazia (nunca null)", () => {
    const parsed = correctHandoverSchema.parse({
      ...valid,
      items: [{ itemId: ITEM, quantity: 0, note: "  " }],
    });
    expect(parsed.items[0]?.note).toBe("");
  });

  it("motivo vazio ou só espaços: Informe o motivo da correção.", () => {
    for (const reason of ["", "   \n "]) {
      expect(errorsOf(correctHandoverSchema, { ...valid, reason })).toEqual({
        reason: "Informe o motivo da correção.",
      });
    }
  });

  it("motivo: 500 passam; 501 não", () => {
    expect(
      correctHandoverSchema.safeParse({ ...valid, reason: "a".repeat(500) })
        .success,
    ).toBe(true);
    expect(
      errorsOf(correctHandoverSchema, { ...valid, reason: "a".repeat(501) }),
    ).toEqual({ reason: "O motivo pode ter no máximo 500 caracteres." });
  });

  it("item repetido recusa com a mensagem em items", () => {
    expect(
      errorsOf(correctHandoverSchema, {
        ...valid,
        items: [
          { itemId: ITEM, quantity: 1, note: "" },
          { itemId: ITEM, quantity: 2, note: "" },
        ],
      }),
    ).toEqual({ items: "Item repetido. Atualize a página." });
  });

  it("quantidade fora do limite e nota longa recusam em items", () => {
    expect(
      errorsOf(correctHandoverSchema, {
        ...valid,
        items: [{ itemId: ITEM, quantity: 100_000, note: "" }],
      }),
    ).toEqual({ items: "Informe um número inteiro de 0 a 99.999." });
    expect(
      errorsOf(correctHandoverSchema, {
        ...valid,
        items: [{ itemId: ITEM, quantity: 1, note: "a".repeat(201) }],
      }),
    ).toEqual({ items: "A observação pode ter no máximo 200 caracteres." });
  });

  it("texto acima de 2.000 pontos de código recusa; lista vazia é permitida", () => {
    expect(
      errorsOf(correctHandoverSchema, {
        ...valid,
        occurrencesText: "a".repeat(2001),
      }),
    ).toEqual({
      occurrencesText: "O texto pode ter no máximo 2.000 caracteres.",
    });
    expect(
      correctHandoverSchema.safeParse({ ...valid, items: [] }).success,
    ).toBe(true);
  });

  it("dois itens diferentes passam", () => {
    expect(
      correctHandoverSchema.safeParse({
        ...valid,
        items: [
          { itemId: ITEM, quantity: 1, note: "" },
          { itemId: OTHER_ITEM, quantity: 2, note: "" },
        ],
      }).success,
    ).toBe(true);
  });
});

describe("chooseSectorSchema", () => {
  it("aceita setor, 'todos' e os três caminhos", () => {
    for (const path of ["/", "/passagens", "/passagens/nova"]) {
      expect(
        chooseSectorSchema.safeParse({ sectorId: SECTOR, path }).success,
      ).toBe(true);
    }
    expect(
      chooseSectorSchema.safeParse({ sectorId: "todos", path: "/passagens" })
        .success,
    ).toBe(true);
  });

  it("recusa caminho fora da lista e setor malformado", () => {
    expect(
      chooseSectorSchema.safeParse({ sectorId: SECTOR, path: "//evil.test" })
        .success,
    ).toBe(false);
    expect(
      chooseSectorSchema.safeParse({ sectorId: "x", path: "/" }).success,
    ).toBe(false);
  });
});
```

- [ ] **Step 12: Ver falhar**

Run: `bun run test -- src/features/handovers/schemas.test.ts`
Expected: FAIL com `Error: Cannot find module './schemas' imported from …/src/features/handovers/schemas.test.ts`.

- [ ] **Step 13: Implementar os schemas**

Crie `src/features/handovers/schemas.ts`:

```ts
import { z } from "zod";

import { CHOICE_LIST_LIMIT } from "@/features/admin/pagination";
import { INVALID_INPUT_MESSAGE } from "@/features/admin/result";
import { idSchema } from "@/features/admin/schemas";

import {
  codePointLength,
  normalizeFreeText,
  normalizeItemNote,
  normalizeOptionalText,
  normalizeReason,
  validateFieldChange,
} from "./fieldRules";
import {
  ALL_SECTORS,
  CONFIRMATION_NOTE_MAX_LENGTH,
  ITEM_NOTE_MAX_LENGTH,
  MAX_QUANTITY,
  REASON_MAX_LENGTH,
  TEXT_MAX_LENGTH,
} from "./limits";
import {
  CONFIRMATION_NOTE_TOO_LONG_MESSAGE,
  DUPLICATE_ITEM_MESSAGE,
  INVALID_DATE_MESSAGE,
  NOTE_TOO_LONG_MESSAGE,
  QUANTITY_MESSAGE,
  REASON_REQUIRED_MESSAGE,
  REASON_TOO_LONG_MESSAGE,
  TEXT_TOO_LONG_MESSAGE,
} from "./messages";
import { isIsoDate } from "./saoPaulo";
import { SECTOR_PICKER_PATHS } from "./urls";

// Todo campo tem mensagem em pt-BR própria: o texto padrão do Zod é inglês e
// nunca pode chegar à tela.
const textSchema = z.string({ error: INVALID_INPUT_MESSAGE });

export const isoDateSchema = z
  .string({ error: INVALID_DATE_MESSAGE })
  .refine(isIsoDate, { error: INVALID_DATE_MESSAGE });

export const handoverRefSchema = z.object({
  sectorId: idSchema,
  shiftId: idSchema,
  operationalDate: isoDateSchema,
});

export const saveFieldSchema = z
  .discriminatedUnion("field", [
    handoverRefSchema.extend({
      field: z.literal("occurrences"),
      value: textSchema,
    }),
    handoverRefSchema.extend({
      field: z.literal("nextShift"),
      value: textSchema,
    }),
    handoverRefSchema.extend({
      field: z.literal("quantity"),
      itemId: idSchema,
      value: z.number({ error: QUANTITY_MESSAGE }),
    }),
    handoverRefSchema.extend({
      field: z.literal("note"),
      itemId: idSchema,
      value: textSchema,
    }),
  ])
  .transform((input, ctx) => {
    const validated = validateFieldChange(input);
    if (!validated.ok) {
      ctx.addIssue({
        code: "custom",
        message: validated.message,
        path: ["value"],
      });
      return z.NEVER;
    }
    return {
      sectorId: input.sectorId,
      shiftId: input.shiftId,
      operationalDate: input.operationalDate,
      ...validated.change,
    };
  });

export const deliverHandoverSchema = handoverRefSchema;

export const confirmHandoverSchema = z.object({
  id: idSchema,
  note: textSchema.transform((raw, ctx) => {
    const note = normalizeOptionalText(raw);
    if (note !== null && codePointLength(note) > CONFIRMATION_NOTE_MAX_LENGTH) {
      ctx.addIssue({
        code: "custom",
        message: CONFIRMATION_NOTE_TOO_LONG_MESSAGE,
      });
      return z.NEVER;
    }
    return note;
  }),
});

const reasonSchema = textSchema.transform((raw, ctx) => {
  const reason = normalizeReason(raw);
  if (reason === "") {
    ctx.addIssue({ code: "custom", message: REASON_REQUIRED_MESSAGE });
    return z.NEVER;
  }
  if (codePointLength(reason) > REASON_MAX_LENGTH) {
    ctx.addIssue({ code: "custom", message: REASON_TOO_LONG_MESSAGE });
    return z.NEVER;
  }
  return reason;
});

const longTextSchema = textSchema.transform((raw, ctx) => {
  const text = normalizeFreeText(raw);
  if (codePointLength(text) > TEXT_MAX_LENGTH) {
    ctx.addIssue({ code: "custom", message: TEXT_TOO_LONG_MESSAGE });
    return z.NEVER;
  }
  return text;
});

const correctionItemSchema = z.object({
  itemId: idSchema,
  quantity: z
    .number({ error: QUANTITY_MESSAGE })
    .int({ error: QUANTITY_MESSAGE })
    .min(0, { error: QUANTITY_MESSAGE })
    .max(MAX_QUANTITY, { error: QUANTITY_MESSAGE }),
  note: textSchema.transform((raw, ctx) => {
    const note = normalizeItemNote(raw) ?? "";
    if (codePointLength(note) > ITEM_NOTE_MAX_LENGTH) {
      ctx.addIssue({ code: "custom", message: NOTE_TOO_LONG_MESSAGE });
      return z.NEVER;
    }
    return note;
  }),
});

export const correctHandoverSchema = z.object({
  id: idSchema,
  reason: reasonSchema,
  occurrencesText: longTextSchema,
  nextShiftText: longTextSchema,
  items: z
    .array(correctionItemSchema, { error: INVALID_INPUT_MESSAGE })
    .max(CHOICE_LIST_LIMIT, { error: INVALID_INPUT_MESSAGE })
    .refine(
      (items) =>
        new Set(items.map((line) => line.itemId)).size === items.length,
      { error: DUPLICATE_ITEM_MESSAGE },
    ),
});

export const chooseSectorSchema = z.object({
  sectorId: z.union([idSchema, z.literal(ALL_SECTORS)]),
  path: z.enum(SECTOR_PICKER_PATHS, { error: INVALID_INPUT_MESSAGE }),
});

export type SaveFieldInputParsed = z.infer<typeof saveFieldSchema>;
export type DeliverHandoverInput = z.infer<typeof deliverHandoverSchema>;
export type ConfirmHandoverInput = z.infer<typeof confirmHandoverSchema>;
export type CorrectHandoverInput = z.infer<typeof correctHandoverSchema>;
export type ChooseSectorInput = z.infer<typeof chooseSectorSchema>;
```

Run: `bunx biome check --write src/features/handovers/schemas.ts src/features/handovers/schemas.test.ts && bun run test -- src/features/handovers/schemas.test.ts`
Expected: PASS (34 testes).

- [ ] **Step 14: Escrever o teste do runner**

Crie `src/features/handovers/runHandoverAction.test.ts`:

```ts
import { notFound, redirect } from "next/navigation";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import { z } from "zod";

import { fail, ok } from "@/features/admin/result";
import type { Authz } from "@/features/authz/authz";

import { authzOf } from "../../../test/authz";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  fakeDb: { marker: "fake-db" },
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
// O módulo de banco real exige DATABASE_URL; aqui só passa uma identidade.
vi.mock("@/db", () => ({ db: mocks.fakeDb }));

const { runHandoverAction } = await import("./runHandoverAction");

const schema = z.object({
  name: z
    .string({ error: "Informe o nome." })
    .min(1, { error: "Informe o nome." }),
});
const actor = authzOf({ role: "operator" });

type RunContext = { db: unknown; now: Date; actor: Authz; input: unknown };

describe("runHandoverAction", () => {
  let consoleError: MockInstance;

  beforeEach(() => {
    mocks.revalidatePath.mockReset();
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it("entrada inválida: INVALID_INPUT com a mensagem do campo, sem rodar nem revalidar", async () => {
    const run = vi.fn();

    const result = await runHandoverAction({
      actor,
      schema,
      input: { name: "" },
      revalidate: true,
      run,
    });

    expect(result).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      message: "Informe o nome.",
      fieldErrors: { name: "Informe o nome." },
    });
    expect(run).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("entrada que nem é objeto: mensagem genérica em pt-BR, nunca o texto do Zod", async () => {
    const run = vi.fn();

    for (const input of [null, undefined, 42, "texto", []]) {
      const result = await runHandoverAction({
        actor,
        schema,
        input,
        revalidate: false,
        run,
      });
      expect(result).toEqual({
        ok: false,
        code: "INVALID_INPUT",
        message: "Confira os campos e tente de novo.",
        fieldErrors: {},
      });
    }
    expect(run).not.toHaveBeenCalled();
  });

  it("sucesso: passa db, now, actor e a entrada já validada; com revalidate revalida o layout (app) uma vez", async () => {
    const run = vi.fn(async (_ctx: RunContext) => ok({ id: "abc" }));
    const before = Date.now();

    const result = await runHandoverAction({
      actor,
      schema: z.object({ name: z.string().transform((value) => value.trim()) }),
      input: { name: "  ULD  ", extra: "descartado" },
      revalidate: true,
      run,
    });

    expect(result).toEqual({ ok: true, id: "abc" });
    expect(run).toHaveBeenCalledTimes(1);
    const ctx = run.mock.calls[0]?.[0];
    expect(ctx?.db).toBe(mocks.fakeDb);
    expect(ctx?.actor).toBe(actor);
    expect(ctx?.input).toEqual({ name: "ULD" });
    expect(ctx?.now).toBeInstanceOf(Date);
    expect(ctx?.now.getTime()).toBeGreaterThanOrEqual(before);
    expect(ctx?.now.getTime()).toBeLessThanOrEqual(Date.now());
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)", "layout");
  });

  it("sucesso com revalidate false (salvamento automático): nunca revalida", async () => {
    const result = await runHandoverAction({
      actor,
      schema,
      input: { name: "ULD" },
      revalidate: false,
      run: async () => ok({ id: "abc" }),
    });

    expect(result).toEqual({ ok: true, id: "abc" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("falha de domínio é repassada como veio e não revalida, mesmo com revalidate", async () => {
    const failure = fail(
      "ALREADY_DELIVERED",
      "Esta passagem já foi entregue por Ana Teste às 14:05.",
    );

    const result = await runHandoverAction({
      actor,
      schema,
      input: { name: "ULD" },
      revalidate: true,
      run: async () => failure,
    });

    expect(result).toBe(failure);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("exceção inesperada vira INTERNAL sem vazar o texto do erro", async () => {
    const secret =
      'duplicate key value violates unique constraint "handover_sector_shift_date_uq" (senha=hunter2)';

    const result = await runHandoverAction({
      actor,
      schema,
      input: { name: "ULD" },
      revalidate: true,
      run: async () => {
        throw new Error(secret);
      },
    });

    expect(result).toEqual({
      ok: false,
      code: "INTERNAL",
      message: "Não foi possível concluir. Tente de novo.",
    });
    expect(JSON.stringify(result)).not.toContain("hunter2");
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("valor que não é Error também vira INTERNAL", async () => {
    const result = await runHandoverAction({
      actor,
      schema,
      input: { name: "ULD" },
      revalidate: false,
      run: async () => {
        throw "texto solto";
      },
    });

    expect(result).toMatchObject({ ok: false, code: "INTERNAL" });
  });

  it("notFound() passa intacto: a página 404 aparece, nada de INTERNAL", async () => {
    let thrown: unknown;
    try {
      notFound();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeDefined();

    await expect(
      runHandoverAction({
        actor,
        schema,
        input: { name: "ULD" },
        revalidate: true,
        run: async () => {
          throw thrown;
        },
      }),
    ).rejects.toBe(thrown);
    expect(consoleError).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("redirect() passa intacto", async () => {
    let thrown: unknown;
    try {
      redirect("/entrar");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeDefined();

    await expect(
      runHandoverAction({
        actor,
        schema,
        input: { name: "ULD" },
        revalidate: true,
        run: async () => {
          throw thrown;
        },
      }),
    ).rejects.toBe(thrown);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 15: Ver falhar**

Run: `bun run test -- src/features/handovers/runHandoverAction.test.ts`
Expected: FAIL com `Error: Cannot find module '/src/features/handovers/runHandoverAction' imported from …/runHandoverAction.test.ts` (o import é dinâmico, por isso o caminho vem absoluto a partir da raiz).

- [ ] **Step 16: Implementar o runner**

Crie `src/features/handovers/runHandoverAction.ts`:

```ts
import "server-only";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";

import { db } from "@/db";
import type { Db } from "@/db/types";
import {
  type AdminResult,
  fail,
  INTERNAL_ERROR_MESSAGE,
  INVALID_INPUT_MESSAGE,
} from "@/features/admin/result";
import { firstFieldErrors } from "@/features/admin/schemas";
import type { Authz } from "@/features/authz/authz";

// Problema na raiz (entrada que nem é objeto) cai na mensagem genérica: o texto
// padrão do Zod é inglês e nunca pode chegar à tela.
function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue && issue.path.length > 0 ? issue.message : INVALID_INPUT_MESSAGE;
}

// Irmão do runAdminAction (F3-13): o mesmo fluxo, com a revalidação como
// parâmetro. O salvamento automático passa `revalidate: false` (revalidar
// re-renderizaria a tela enquanto a pessoa digita); entregar, confirmar e
// corrigir passam `true`. Quem chama (a Server Action) já fez `requireUser()`
// ou `requireAdmin()`; aqui só entra o que vem depois.
export async function runHandoverAction<
  S extends z.ZodType,
  T extends object = object,
>(args: {
  actor: Authz;
  schema: S;
  input: unknown;
  revalidate: boolean;
  run: (ctx: {
    db: Db;
    now: Date;
    actor: Authz;
    input: z.output<S>;
  }) => Promise<AdminResult<T>>;
}): Promise<AdminResult<T>> {
  const parsed = args.schema.safeParse(args.input);
  if (!parsed.success) {
    return fail(
      "INVALID_INPUT",
      firstIssueMessage(parsed.error),
      firstFieldErrors(parsed.error),
    );
  }

  let result: AdminResult<T>;
  try {
    result = await args.run({
      db,
      now: new Date(),
      actor: args.actor,
      input: parsed.data,
    });
  } catch (error) {
    // redirect() e notFound() são exceções do Next: têm de seguir adiante.
    unstable_rethrow(error);
    console.error("runHandoverAction: falha inesperada", error);
    // Nunca devolve o texto do erro (pode ser do banco).
    return fail("INTERNAL", INTERNAL_ERROR_MESSAGE);
  }

  // Com route group o caminho é o do arquivo (revalidatePath.md).
  if (result.ok && args.revalidate) revalidatePath("/(app)", "layout");
  return result;
}
```

Run: `bunx biome check --write src/features/handovers/runHandoverAction.ts src/features/handovers/runHandoverAction.test.ts && bun run test -- src/features/handovers/runHandoverAction.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 17: Verificação da Parte B e commit**

Run: `bun run check-types && bun run lint && bun run test -- src/features/admin/result.test.ts src/features/handovers/schemas.test.ts src/features/handovers/runHandoverAction.test.ts`
Expected: sem erro; PASS (7 + 34 + 9 testes).

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-3-schemas.txt` e rode:
```bash
git add src/features/admin/result.ts src/features/admin/result.test.ts src/features/handovers/urls.ts src/features/handovers/schemas.ts src/features/handovers/schemas.test.ts src/features/handovers/runHandoverAction.ts src/features/handovers/runHandoverAction.test.ts
git commit -F .git/sdd/msg-task-3-schemas.txt
```
(Se o Step 10 não mudou `urls.ts`, o `git add` dele é inofensivo.) Mensagem:
```text
feat(passagem): códigos novos, schemas Zod e runHandoverAction

AdminErrorCode ganha os 10 códigos da passagem (aditivo). Os schemas das
actions normalizam e limitam os campos com mensagens em pt-BR. O
runHandoverAction repete o fluxo do runAdminAction e troca a revalidação
fixa por um parâmetro: o salvamento automático nunca revalida.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

#### Parte C: guardas (P27)

- [ ] **Step 18: Escrever os casos novos do guarda de páginas**

Leia `src/app/appPagesAuth.test.ts`. No `describe("pageCallsAuthGuard (o guarda de fato falha)")`, troque o último teste (`chamada no componente importado → true`) e o `});` que fecha o describe por:

```ts
  it("chamada no componente importado → true", () => {
    const page = `import { Lista } from "@/components/x/Lista";`;
    expect(pageCallsAuthGuard(page, () => "await requireAdmin();")).toBe(true);
  });

  it("com ['requireAdmin'], só requireUser não basta (página de admin)", () => {
    const page = `async function C() { await requireUser(); }`;
    expect(pageCallsAuthGuard(page, noComponents, ["requireAdmin"])).toBe(
      false,
    );
    const viaComponent = `import { Lista } from "@/components/x/Lista";`;
    expect(
      pageCallsAuthGuard(viaComponent, () => "await requireUser();", [
        "requireAdmin",
      ]),
    ).toBe(false);
  });

  it("com ['requireAdmin'], requireAdmin na página ou no componente passa", () => {
    expect(
      pageCallsAuthGuard("await requireAdmin();", noComponents, [
        "requireAdmin",
      ]),
    ).toBe(true);
    const viaComponent = `import { Lista } from "@/components/x/Lista";`;
    expect(
      pageCallsAuthGuard(viaComponent, () => "await requireAdmin();", [
        "requireAdmin",
      ]),
    ).toBe(true);
  });

  it("o padrão aceita requireUser; um nome parecido não conta", () => {
    expect(pageCallsAuthGuard("await requireUser();", noComponents)).toBe(true);
    expect(pageCallsAuthGuard("await requireUserOrNot();", noComponents)).toBe(
      false,
    );
  });
});
```

- [ ] **Step 19: Ver falhar**

Run: `bun run test -- src/app/appPagesAuth.test.ts`
Expected: FAIL (1 falha, 19 passam, de 20): `pageCallsAuthGuard (o guarda de fato falha) > com ['requireAdmin'], só requireUser não basta (página de admin)` com `AssertionError: expected true to be false` (a função antiga ignora o 3º argumento).

- [ ] **Step 20: Implementar o guarda por papel**

Substitua o conteúdo de `src/app/appPagesAuth.test.ts` por (as páginas sob `admin/` passam a ser checadas só com `requireAdmin`; a lista de rotas esperadas e o mínimo de 9 páginas **não mudam** aqui, as Tarefas 8 a 10 os sobem):

```ts
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Guarda do grupo (app): o layout não protege a página (o Next roda a página
// mesmo que o layout troque o conteúdo, e o layout não re-renderiza na
// navegação no cliente). Toda página precisa chamar requireUser/requireAdmin
// ela mesma ou num componente que importa direto de "@/components/...". Sob
// admin/ só requireAdmin vale (P27): requireUser deixaria um operador abrir a
// tela do administrador.

const ROOT = process.cwd();
const APP_GROUP = join(ROOT, "src", "app", "(app)");

type PageGuard = "requireUser" | "requireAdmin";
const ANY_GUARD: readonly PageGuard[] = ["requireUser", "requireAdmin"];

function guardCall(accepted: readonly PageGuard[]): RegExp {
  return new RegExp(`\\b(?:${accepted.join("|")})\\s*\\(`);
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function componentImports(source: string): string[] {
  const found: string[] = [];
  const pattern = /from\s+["']@\/(components\/[^"']+)["']/g;
  for (const match of stripComments(source).matchAll(pattern)) {
    if (match[1]) found.push(match[1]);
  }
  return found;
}

function resolveComponent(path: string): string | null {
  for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
    const file = join(ROOT, "src", `${path}${ext}`);
    if (existsSync(file)) return file;
  }
  return null;
}

// Verdadeiro se a página, ou um componente que ela importa direto, chama um dos
// guardas aceitos.
export function pageCallsAuthGuard(
  pageSource: string,
  readComponent: (path: string) => string | null,
  accepted: readonly PageGuard[] = ANY_GUARD,
): boolean {
  const call = guardCall(accepted);
  if (call.test(stripComments(pageSource))) return true;
  return componentImports(pageSource).some((path) => {
    const source = readComponent(path);
    return source !== null && call.test(stripComments(source));
  });
}

function readComponentFromDisk(path: string): string | null {
  const file = resolveComponent(path);
  return file ? readFileSync(file, "utf8") : null;
}

function findPages(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return findPages(full);
    return name === "page.tsx" ? [full] : [];
  });
}

function isAdminPage(file: string): boolean {
  return relative(APP_GROUP, file).replaceAll("\\", "/").startsWith("admin/");
}

describe("toda página do grupo (app) chama requireUser ou requireAdmin", () => {
  const pages = findPages(APP_GROUP);

  it("encontra as páginas do grupo", () => {
    expect(pages.length).toBeGreaterThanOrEqual(9);
  });

  it("inclui a página de cada rota de /admin", () => {
    const routes = pages.map((file) =>
      relative(APP_GROUP, file).replaceAll("\\", "/"),
    );
    for (const route of [
      "admin/page.tsx",
      "admin/setores/page.tsx",
      "admin/turnos/page.tsx",
      "admin/itens/page.tsx",
      "admin/destinos/page.tsx",
      "admin/equipe/page.tsx",
    ]) {
      expect(routes).toContain(route);
    }
  });

  it("nenhuma página de /admin exporta metadata (T12)", () => {
    for (const file of pages.filter(isAdminPage)) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(
        /export\s+(const\s+metadata|(async\s+)?function\s+generateMetadata)\b/,
      );
    }
  });

  it.each(
    pages.map((file) => [relative(ROOT, file).replaceAll("\\", "/"), file]),
  )("%s", (name, file) => {
    const admin = isAdminPage(file as string);
    const ok = pageCallsAuthGuard(
      readFileSync(file as string, "utf8"),
      readComponentFromDisk,
      admin ? ["requireAdmin"] : ANY_GUARD,
    );
    expect(
      ok,
      admin
        ? `${name} não chama requireAdmin (nem direto, nem num componente importado de @/components). Sob admin/ só requireAdmin vale.`
        : `${name} não chama requireUser/requireAdmin (nem direto, nem num componente importado de @/components). O layout não protege a página.`,
    ).toBe(true);
  });
});

describe("pageCallsAuthGuard (o guarda de fato falha)", () => {
  const noComponents = () => null;

  it("página fictícia sem chamada de sessão → false", () => {
    const fake = `export default function Page() { return <p>dados</p>; }`;
    expect(pageCallsAuthGuard(fake, noComponents)).toBe(false);
  });

  it("chamada só em comentário não conta", () => {
    const fake = `// await requireUser();\n/* requireAdmin() */\nexport default function Page() { return null; }`;
    expect(pageCallsAuthGuard(fake, noComponents)).toBe(false);
  });

  it("componente importado sem chamada → false", () => {
    const fake = `import { Lista } from "@/components/x/Lista";\nexport default () => <Lista />;`;
    expect(
      pageCallsAuthGuard(fake, () => "export const Lista = () => null;"),
    ).toBe(false);
  });

  it("chamada na própria página → true", () => {
    const page = `async function C() { await requireUser(); }`;
    expect(pageCallsAuthGuard(page, noComponents)).toBe(true);
  });

  it("chamada no componente importado → true", () => {
    const page = `import { Lista } from "@/components/x/Lista";`;
    expect(pageCallsAuthGuard(page, () => "await requireAdmin();")).toBe(true);
  });

  it("com ['requireAdmin'], só requireUser não basta (página de admin)", () => {
    const page = `async function C() { await requireUser(); }`;
    expect(pageCallsAuthGuard(page, noComponents, ["requireAdmin"])).toBe(
      false,
    );
    const viaComponent = `import { Lista } from "@/components/x/Lista";`;
    expect(
      pageCallsAuthGuard(viaComponent, () => "await requireUser();", [
        "requireAdmin",
      ]),
    ).toBe(false);
  });

  it("com ['requireAdmin'], requireAdmin na página ou no componente passa", () => {
    expect(
      pageCallsAuthGuard("await requireAdmin();", noComponents, [
        "requireAdmin",
      ]),
    ).toBe(true);
    const viaComponent = `import { Lista } from "@/components/x/Lista";`;
    expect(
      pageCallsAuthGuard(viaComponent, () => "await requireAdmin();", [
        "requireAdmin",
      ]),
    ).toBe(true);
  });

  it("o padrão aceita requireUser; um nome parecido não conta", () => {
    expect(pageCallsAuthGuard("await requireUser();", noComponents)).toBe(true);
    expect(pageCallsAuthGuard("await requireUserOrNot();", noComponents)).toBe(
      false,
    );
  });
});
```

Run: `bunx biome check --write src/app/appPagesAuth.test.ts && bun run test -- src/app/appPagesAuth.test.ts`
Expected: PASS (20 testes).

- [ ] **Step 21: Criar o guarda de todas as actions**

Crie `src/app/actionsGuards.test.ts` (o guarda varre `.ts/.tsx` de `src` que não sejam de teste: arquivos de teste citam `"use server"` dentro de texto de exemplo):

```ts
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

import {
  actionsMissingGuard,
  hasUseServerDirective,
  listSourceFiles,
  startsWithUseServer,
} from "../../test/actionGuards";

// Guarda de toda Server Action do projeto (P27). Uma Server Action é um
// endpoint público: qualquer arquivo com "use server" tem de ser um actions.ts
// do grupo (app), cada função exportada autoriza por conta própria
// (`requireAdmin()` sob admin/, `requireUser()` ou `requireAdmin()` no resto)
// como PRIMEIRA instrução, e nada além de funções async é exportado.

const ROOT = process.cwd();
const SRC = join(ROOT, "src");

// Pública por natureza: quem abre o convite ainda não tem sessão. A action só
// valida o token e grava o cookie do convite. Qualquer outra exceção é
// decisão de segurança e entra aqui com o motivo.
export const AUTH_ACTION_FILES: readonly string[] = [
  "src/app/(auth)/convite/[token]/actions.ts",
];

// Quantos actions.ts o guarda precisa achar (um número que só sobe: se cair, a
// varredura parou de enxergar algum arquivo). Sobe para 1 na Tarefa 7
// (src/app/(app)/actions.ts) e para 2 na Tarefa 8 (passagens/actions.ts).
const MIN_ADMIN_ACTION_FILES = 5;
const MIN_APP_ACTION_FILES = 0;

const APP_PREFIX = "src/app/(app)/";
const ADMIN_PREFIX = "src/app/(app)/admin/";

/**
 * Problemas de um arquivo com "use server", dado o caminho (relativo à raiz,
 * com "/") e o código. [] = tudo certo. Só faz sentido para arquivos em que
 * `hasUseServerDirective` é verdadeiro.
 */
export function actionFileProblems(path: string, source: string): string[] {
  if (AUTH_ACTION_FILES.includes(path)) return [];

  const problems: string[] = [];
  const isAppActions =
    path.startsWith(APP_PREFIX) && path.split("/").at(-1) === "actions.ts";
  if (!isAppActions) {
    problems.push(
      `"use server" só pode existir em um actions.ts sob ${APP_PREFIX}: ${path}`,
    );
    return problems;
  }
  if (!startsWithUseServer(source)) {
    problems.push(`${path} precisa começar com "use server".`);
  }
  const allowed = path.startsWith(ADMIN_PREFIX)
    ? (["requireAdmin"] as const)
    : (["requireUser", "requireAdmin"] as const);
  for (const name of actionsMissingGuard(source, allowed)) {
    problems.push(
      `${path}: ${name} não começa com ${allowed.join("() ou ")}() (e só funções async podem ser exportadas).`,
    );
  }
  return problems;
}

function isRuntimeSource(name: string): boolean {
  return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name);
}

function relativePath(file: string): string {
  return relative(ROOT, file).replaceAll("\\", "/");
}

describe("todo arquivo com 'use server' passa pelo guarda", () => {
  const files = listSourceFiles(SRC, isRuntimeSource)
    .map((file) => ({ path: relativePath(file), file }))
    .filter(({ file }) => hasUseServerDirective(readFileSync(file, "utf8")));

  it("encontra os arquivos de actions", () => {
    const admin = files.filter(({ path }) => path.startsWith(ADMIN_PREFIX));
    const app = files.filter(
      ({ path }) =>
        path.startsWith(APP_PREFIX) && !path.startsWith(ADMIN_PREFIX),
    );
    expect(admin.length).toBeGreaterThanOrEqual(MIN_ADMIN_ACTION_FILES);
    expect(app.length).toBeGreaterThanOrEqual(MIN_APP_ACTION_FILES);
  });

  it("as exceções documentadas existem e continuam sendo 'use server'", () => {
    const paths = files.map(({ path }) => path);
    for (const exception of AUTH_ACTION_FILES) {
      expect(paths, `${exception} deixou de ser uma action`).toContain(
        exception,
      );
    }
  });

  it.each(files.map(({ path, file }) => [path, file]))("%s", (path, file) => {
    expect(
      actionFileProblems(path as string, readFileSync(file as string, "utf8")),
    ).toEqual([]);
  });
});

describe("actionFileProblems (o guarda de fato falha)", () => {
  const goodUser = `"use server";
export async function saveAction(input: unknown) {
  const actor = await requireUser();
  return run({ actor, input });
}`;

  it("action de passagem com requireUser na primeira linha → []", () => {
    expect(
      actionFileProblems("src/app/(app)/passagens/actions.ts", goodUser),
    ).toEqual([]);
  });

  it("action fora do admin pode usar requireAdmin", () => {
    const source = `"use server";
export async function chooseSectorAction(input: unknown) {
  await requireAdmin();
}`;
    expect(actionFileProblems("src/app/(app)/actions.ts", source)).toEqual([]);
  });

  it("action sem guarda → problema com o nome dela", () => {
    const source = `"use server";
export async function saveAction(input: unknown) {
  return run({ input });
}`;
    const problems = actionFileProblems(
      "src/app/(app)/passagens/actions.ts",
      source,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("saveAction");
  });

  it("guarda só em comentário não conta", () => {
    const source = `"use server";
export async function saveAction() {
  // const actor = await requireUser();
  return 1;
}`;
    expect(
      actionFileProblems("src/app/(app)/passagens/actions.ts", source),
    ).toHaveLength(1);
  });

  it("guarda depois de outro trabalho não vale: tem de ser a primeira instrução", () => {
    const source = `"use server";
export async function saveAction(input: unknown) {
  await save(input);
  await requireUser();
}`;
    expect(
      actionFileProblems("src/app/(app)/passagens/actions.ts", source),
    ).toHaveLength(1);
  });

  it("sob admin/ só requireAdmin vale: requireUser reprova", () => {
    expect(
      actionFileProblems("src/app/(app)/admin/setores/actions.ts", goodUser),
    ).toHaveLength(1);
    const admin = goodUser.replace("requireUser", "requireAdmin");
    expect(
      actionFileProblems("src/app/(app)/admin/setores/actions.ts", admin),
    ).toEqual([]);
  });

  it("export que não é função async reprova (constante, função síncrona)", () => {
    const source = `"use server";
export const LIMIT = 3;
export function helper() { return 1; }
export async function saveAction() {
  await requireUser();
}`;
    expect(
      actionFileProblems("src/app/(app)/passagens/actions.ts", source),
    ).toHaveLength(2);
  });

  it("arquivo sem a diretiva no topo reprova", () => {
    const source = `import { x } from "y";
export async function saveAction() {
  await requireUser();
}`;
    const problems = actionFileProblems(
      "src/app/(app)/passagens/actions.ts",
      source,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('começar com "use server"');
  });

  it("'use server' inline em arquivo que não é actions.ts reprova", () => {
    const source = `export async function sneaky() {
  "use server";
  return 1;
}`;
    expect(hasUseServerDirective(source)).toBe(true);
    expect(
      actionFileProblems("src/features/handovers/sneaky.ts", source),
    ).toHaveLength(1);
    expect(
      actionFileProblems("src/app/(app)/passagens/helpers.ts", source),
    ).toHaveLength(1);
  });

  it("actions.ts fora do grupo (app) reprova", () => {
    expect(
      actionFileProblems("src/features/handovers/actions.ts", goodUser),
    ).toHaveLength(1);
    expect(
      actionFileProblems("src/app/(auth)/outra/actions.ts", goodUser),
    ).toHaveLength(1);
    expect(actionFileProblems("src/app/api/actions.ts", goodUser)).toHaveLength(
      1,
    );
  });

  it("a exceção documentada do convite passa sem guarda; outro arquivo de (auth) não", () => {
    const publicAction = `"use server";
export async function armInvite(token: string) {
  return { ok: true };
}`;
    expect(
      actionFileProblems(
        "src/app/(auth)/convite/[token]/actions.ts",
        publicAction,
      ),
    ).toEqual([]);
    expect(
      actionFileProblems("src/app/(auth)/entrar/actions.ts", publicAction),
    ).toHaveLength(1);
  });
});

describe("hasUseServerDirective", () => {
  it("vê a diretiva de arquivo, com aspas simples ou duplas, depois de comentário", () => {
    expect(hasUseServerDirective(`"use server";\nexport {}`)).toBe(true);
    expect(hasUseServerDirective(`// ações\n'use server'\n`)).toBe(true);
  });

  it("vê a diretiva inline dentro de função", () => {
    expect(
      hasUseServerDirective(
        `export function a() {\n  async function b() {\n    "use server";\n  }\n}`,
      ),
    ).toBe(true);
  });

  it("ignora comentário, 'use client' e texto no meio de uma frase", () => {
    expect(hasUseServerDirective(`// "use server"\n`)).toBe(false);
    expect(hasUseServerDirective(`/* "use server" */`)).toBe(false);
    expect(hasUseServerDirective(`"use client";\nexport {}`)).toBe(false);
    expect(
      hasUseServerDirective(`const x = 'não use "use server" aqui';`),
    ).toBe(false);
  });
});
```

Run: `bunx biome check --write src/app/actionsGuards.test.ts && bun run test -- src/app/actionsGuards.test.ts`
Expected: PASS (22 testes: 2 de cobertura, 6 arquivos reais (5 de `admin/` + o convite), 11 casos negativos e positivos de `actionFileProblems`, 3 de `hasUseServerDirective`). Este arquivo nasce verde porque as actions atuais já cumprem a regra; a prova de que ele falha de verdade é o próximo passo.

- [ ] **Step 22: Provar que o guarda reprova uma action real sem guarda**

Run:
```bash
sed -i '0,/await requireAdmin()/s//await Promise.resolve()/' "src/app/(app)/admin/destinos/actions.ts"
bun run test -- src/app/actionsGuards.test.ts
git checkout -- "src/app/(app)/admin/destinos/actions.ts"
```
Expected: o `bun run test` FALHA com `FAIL … > src/app/(app)/admin/destinos/actions.ts` e `AssertionError: expected [ Array(1) ] to deeply equal []`; o `git checkout` desfaz a sabotagem. Confira com `git status --short` que `destinos/actions.ts` não aparece como modificado.

- [ ] **Step 23: Verificação da Parte C e commit**

Run: `bun run check-types && bun run lint && bun run test -- src/app/actionsGuards.test.ts src/app/appPagesAuth.test.ts "src/app/(app)/admin/actionsAuth.test.ts" && bun run test`
Expected: sem erro; PASS (22 + 20 + 20 testes nos três arquivos) e depois a suíte inteira verde (se aparecer "Timeout waiting for worker to respond", rode de novo com `--maxWorkers=4`).

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-3-guards.txt` e rode:
```bash
git add src/app/actionsGuards.test.ts src/app/appPagesAuth.test.ts
git commit -F .git/sdd/msg-task-3-guards.txt
```
Mensagem:
```text
test(guardas): exige guarda em toda Server Action e requireAdmin sob admin/ (P27)

actionsGuards.test.ts varre todo "use server" de src: só actions.ts sob
(app), com requireUser/requireAdmin (requireAdmin sob admin/) como
primeira instrução; a única exceção documentada é a action pública do
convite. O guarda de páginas passa a exigir requireAdmin sob admin/.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 4: Domínio do rascunho (carregadores, turnos ativos, estado do formulário, salvar campo, entregar turno)

Três commits: (A) `loaders` + `targets`, (B) `formState`, (C) `draft` + `deliver`. Todos os módulos começam com `import "server-only"` e recebem `db: Db` (e `now: Date` onde o tempo importa). Nenhum componente de UI (sem `ui-registry.md`).

**Files:**
- Create: `src/features/handovers/loaders.ts`
- Create: `src/features/handovers/targets.ts`
- Create: `src/features/handovers/formState.ts`
- Create: `src/features/handovers/draft.ts`
- Create: `src/features/handovers/deliver.ts`
- Test: `src/features/handovers/loaders.test.ts`, `src/features/handovers/targets.test.ts`, `src/features/handovers/formState.test.ts`, `src/features/handovers/draft.test.ts`, `src/features/handovers/deliver.test.ts`

**Interfaces:**
- Consumes (Tarefas 1 a 3): `handover`, `handoverItem`, `handoverCorrection`, `HandoverStatus` (`@/db/schema/handovers`); `shift`, `item` (`@/db/schema/catalog`); `user` (`@/db/schema/auth`); `sector`; fixtures `insertSector`, `insertShift` (com `createdAt`), `insertItem`, `insertUser`, `insertHandover`, `insertHandoverItem`; `test/clock.ts` `spDate(isoDate, hhmm)`; `authzOf`; `handoverCapabilities`, `formModeOf` (`./access`); `validateFieldChange` (`./fieldRules`); `isIsoDate`, `isOperationalDateAllowed` (`./saoPaulo`); mensagens de `./messages` (`HANDOVER_NOT_FOUND_MESSAGE`, `SECTOR_INACTIVE_HANDOVER_MESSAGE`, `SHIFT_INACTIVE_MESSAGE`, `DATE_OUT_OF_RANGE_MESSAGE`, `EDIT_FORBIDDEN_MESSAGE`, `HANDOVER_LOCKED_MESSAGE`, `alreadyDeliveredMessage`); tipos de `./types` (`HandoverRef`, `ShiftChoice`, `FormMode`, `ItemLine`, `FieldChange`, `SaveFieldInput`, `SavedMark`); `fromDbTime` (`@/features/admin/timeOfDay`); `notFoundMessage`, `CHOICE_LIST_LIMIT`, `AdminResult`/`ok`/`fail`/`INVALID_INPUT_MESSAGE`; `canAccessSector` (`@/features/authz/authz`); os códigos novos de `AdminErrorCode` (Tarefa 3).
- Produces (assinaturas do contrato, mais um helper novo):
  - `loaders.ts`: `SectorRow`, `HandoverRow`, `loadSector(db, actor, sectorId)`, `findHandoverByRef(db, ref)`, `findHandoverById(db, actor, id)`, `lockHandover(tx, id)`, `userNames(db, ids)`, `ensureHandover(tx, actor, ref, now)` e **`runInTransaction<T extends object>(db: Db, work: (tx: Db) => Promise<AdminResult<T>>): Promise<AdminResult<T>>`**: `db.transaction()` em que `work` devolver `ok: false` **desfaz** a transação inteira e devolve a falha intacta. `runInTransaction` é obrigatório quando há escrita antes de uma falha esperada (`ensureHandover` em `draft` e `deliver`); `confirmHandover` e `correctHandover` (Tarefa 5) podem usar `db.transaction()` porque toda recusa delas vem antes da primeira escrita.
  - `targets.ts`: `listActiveShifts(db: Db, sectorId: string): Promise<ShiftChoice[]>`.
  - `formState.ts`: `HandoverFormState`, `getHandoverFormState(db, actor, ref, now)`, `getHandoverFormStateById(db, actor, id)`; **além** de `NOT_FOUND` e `SECTOR_INACTIVE`, devolvem `DATE_OUT_OF_RANGE` (data malformada, ou data fora da janela **sem linha existente**) e `SHIFT_INACTIVE` (turno inativo **sem linha existente**); a Tarefa 8 não os recebe na prática (`resolveHandoverTarget` só entrega turno ativo e data válida) e, se vierem, responde `notFound()`.
  - `draft.ts`: `SavedField = { handoverId: string; savedAt: Date; savedByName: string }`, `saveHandoverField(db, actor, input, now)`.
  - `deliver.ts`: `Delivered = { id: string; deliveredAt: Date }`, `deliverHandover(db, actor, ref, now)`.

#### Parte A: `loaders` e `targets`

- [ ] **Step 1: Escrever o teste dos carregadores**

Crie `src/features/handovers/loaders.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { count } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { handover } from "@/db/schema/handovers";

import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { ok } from "../admin/result";
import {
  ensureHandover,
  findHandoverById,
  findHandoverByRef,
  loadSector,
  lockHandover,
  runInTransaction,
  userNames,
} from "./loaders";

const NIL_ID = "00000000-0000-4000-8000-000000000000";
const NOW = spDate("2026-11-21", "14:05");

describe("loaders da passagem", () => {
  let client: PGlite;
  let db: TestDb;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    await resetDb(client);
  });

  async function rowCount(): Promise<number> {
    const [row] = await db.select({ total: count() }).from(handover);
    return row?.total ?? 0;
  }

  describe("loadSector", () => {
    it("admin lê qualquer setor, ativo ou não", async () => {
      const active = await insertSector(db, "ULD");
      const inactive = await insertSector(db, "Antigo", { active: false });
      const admin = authzOf({ role: "admin" });

      expect(await loadSector(db, admin, active.id)).toEqual({
        id: active.id,
        name: "ULD",
        active: true,
      });
      expect(await loadSector(db, admin, inactive.id)).toMatchObject({
        active: false,
      });
    });

    it("operador lê só o próprio setor; outro setor e setor inexistente dão a mesma resposta (null)", async () => {
      const own = await insertSector(db, "ULD");
      const other = await insertSector(db, "Outro");
      const operator = authzOf({ role: "operator", sectorId: own.id });

      expect(await loadSector(db, operator, own.id)).toMatchObject({
        id: own.id,
      });
      expect(await loadSector(db, operator, other.id)).toBeNull();
      expect(await loadSector(db, operator, NIL_ID)).toBeNull();
    });
  });

  describe("findHandoverByRef / findHandoverById / lockHandover", () => {
    it("acham pela tripla e pelo id; ausência vira null", async () => {
      const sector = await insertSector(db);
      const turno = await insertShift(db, { sectorId: sector.id });
      const created = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
      });
      const ref = {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: "2026-11-20",
      };
      const admin = authzOf({ role: "admin" });

      expect(await findHandoverByRef(db, ref)).toMatchObject({
        id: created.id,
        operationalDate: "2026-11-20",
      });
      expect(
        await findHandoverByRef(db, { ...ref, operationalDate: "2026-11-19" }),
      ).toBeNull();
      expect(await findHandoverById(db, admin, created.id)).toMatchObject({
        id: created.id,
      });
      expect(await findHandoverById(db, admin, NIL_ID)).toBeNull();
      expect(await lockHandover(db, created.id)).toMatchObject({
        id: created.id,
      });
      expect(await lockHandover(db, NIL_ID)).toBeNull();
    });

    it("findHandoverById: operador de outro setor recebe null", async () => {
      const sector = await insertSector(db);
      const other = await insertSector(db);
      const turno = await insertShift(db, { sectorId: sector.id });
      const created = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
      });

      expect(
        await findHandoverById(
          db,
          authzOf({ role: "operator", sectorId: other.id }),
          created.id,
        ),
      ).toBeNull();
      expect(
        await findHandoverById(
          db,
          authzOf({ role: "operator", sectorId: sector.id }),
          created.id,
        ),
      ).toMatchObject({ id: created.id });
    });
  });

  describe("userNames", () => {
    it("mapeia id → nome, sem repetir consulta de id repetido", async () => {
      const ana = await insertUser(db, {
        role: "admin",
        sectorId: null,
        name: "Ana Teste",
      });
      const bia = await insertUser(db, {
        role: "admin",
        sectorId: null,
        name: "Bia Teste",
      });

      const names = await userNames(db, [ana.id, bia.id, ana.id]);
      expect(names.get(ana.id)).toBe("Ana Teste");
      expect(names.get(bia.id)).toBe("Bia Teste");
      expect(names.size).toBe(2);
    });

    it("lista vazia devolve mapa vazio sem consultar; id desconhecido fica de fora", async () => {
      expect((await userNames(db, [])).size).toBe(0);
      expect((await userNames(db, ["nao-existe"])).size).toBe(0);
    });
  });

  describe("ensureHandover", () => {
    async function setup() {
      const sector = await insertSector(db, "ULD");
      const turno = await insertShift(db, { sectorId: sector.id });
      const operator = authzOf({ role: "operator", sectorId: sector.id });
      const ref = {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: "2026-11-21",
      };
      return { sector, turno, operator, ref };
    }

    it("cria o rascunho na primeira vez (created: true) e reaproveita na segunda (created: false)", async () => {
      const { operator, ref } = await setup();

      const first = await db.transaction((tx) =>
        ensureHandover(tx, operator, ref, NOW),
      );
      expect(first).toMatchObject({
        ok: true,
        created: true,
        row: { status: "draft", operationalDate: "2026-11-21" },
      });
      const second = await db.transaction((tx) =>
        ensureHandover(tx, operator, ref, NOW),
      );
      expect(second).toMatchObject({ ok: true, created: false });
      expect(await rowCount()).toBe(1);
      if (first.ok && second.ok) expect(second.row.id).toBe(first.row.id);
    });

    it("operador de outro setor e setor inexistente: NOT_FOUND, nada criado", async () => {
      const { ref } = await setup();
      const stranger = authzOf({
        role: "operator",
        sectorId: "00000000-0000-4000-8000-0000000000b2",
      });

      for (const actor of [stranger, authzOf({ role: "admin" })]) {
        const result = await db.transaction((tx) =>
          ensureHandover(tx, actor, { ...ref, sectorId: NIL_ID }, NOW),
        );
        expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
      }
      const denied = await db.transaction((tx) =>
        ensureHandover(tx, stranger, ref, NOW),
      );
      expect(denied).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
        message: "Setor não encontrado. Atualize a página.",
      });
      expect(await rowCount()).toBe(0);
    });

    it("setor inativo ao criar: SECTOR_INACTIVE", async () => {
      const sector = await insertSector(db, "Antigo", { active: false });
      const turno = await insertShift(db, { sectorId: sector.id });

      const result = await db.transaction((tx) =>
        ensureHandover(
          tx,
          authzOf({ role: "admin" }),
          {
            sectorId: sector.id,
            shiftId: turno.id,
            operationalDate: "2026-11-21",
          },
          NOW,
        ),
      );
      expect(result).toMatchObject({
        ok: false,
        code: "SECTOR_INACTIVE",
        message:
          "Este setor está inativo. Peça a um administrador para reativá-lo.",
      });
    });

    it("turno de outro setor ou inexistente: NOT_FOUND com a mensagem do turno", async () => {
      const { operator, ref } = await setup();
      const other = await insertSector(db, "Outro");
      const foreignShift = await insertShift(db, { sectorId: other.id });

      for (const shiftId of [foreignShift.id, NIL_ID]) {
        const result = await db.transaction((tx) =>
          ensureHandover(tx, operator, { ...ref, shiftId }, NOW),
        );
        expect(result).toMatchObject({
          ok: false,
          code: "NOT_FOUND",
          message: "Turno não encontrado. Atualize a página.",
        });
      }
    });

    it("turno inativo ao criar: SHIFT_INACTIVE; com a linha já existente, continua valendo", async () => {
      const { sector, operator, ref } = await setup();
      const inactive = await insertShift(db, {
        sectorId: sector.id,
        active: false,
      });
      const inactiveRef = { ...ref, shiftId: inactive.id };

      const refused = await db.transaction((tx) =>
        ensureHandover(tx, operator, inactiveRef, NOW),
      );
      expect(refused).toMatchObject({
        ok: false,
        code: "SHIFT_INACTIVE",
        message: "Este turno está inativo. Escolha outro turno.",
      });

      await insertHandover(db, {
        sectorId: sector.id,
        shiftId: inactive.id,
        operationalDate: "2026-11-21",
      });
      const existing = await db.transaction((tx) =>
        ensureHandover(tx, operator, inactiveRef, NOW),
      );
      expect(existing).toMatchObject({ ok: true, created: false });
    });

    it("data: hoje e 31 dias atrás passam; amanhã, 32 dias atrás e lixo viram DATE_OUT_OF_RANGE", async () => {
      const { operator, ref } = await setup();

      for (const operationalDate of ["2026-11-21", "2026-10-21"]) {
        const result = await db.transaction((tx) =>
          ensureHandover(tx, operator, { ...ref, operationalDate }, NOW),
        );
        expect(result).toMatchObject({ ok: true, created: true });
      }
      for (const operationalDate of [
        "2026-11-22",
        "2026-10-20",
        "2026-02-30",
        "ontem",
      ]) {
        const result = await db.transaction((tx) =>
          ensureHandover(tx, operator, { ...ref, operationalDate }, NOW),
        );
        expect(result).toMatchObject({
          ok: false,
          code: "DATE_OUT_OF_RANGE",
          message: "Escolha uma data de hoje ou dos últimos 31 dias.",
        });
      }
      expect(await rowCount()).toBe(2);
    });

    it("rascunho antigo (mais de 31 dias) que já existe continua acessível", async () => {
      const { sector, turno, operator } = await setup();
      await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: "2026-09-01",
      });

      const result = await db.transaction((tx) =>
        ensureHandover(
          tx,
          operator,
          {
            sectorId: sector.id,
            shiftId: turno.id,
            operationalDate: "2026-09-01",
          },
          NOW,
        ),
      );
      expect(result).toMatchObject({ ok: true, created: false });
    });
  });

  describe("runInTransaction", () => {
    it("sucesso confirma a escrita", async () => {
      const sector = await insertSector(db);
      const turno = await insertShift(db, { sectorId: sector.id });
      const operator = authzOf({ role: "operator", sectorId: sector.id });

      const result = await runInTransaction(db, async (tx) => {
        const ensured = await ensureHandover(
          tx,
          operator,
          {
            sectorId: sector.id,
            shiftId: turno.id,
            operationalDate: "2026-11-21",
          },
          NOW,
        );
        return ensured.ok ? ok({ id: ensured.row.id }) : ensured;
      });

      expect(result.ok).toBe(true);
      expect(await rowCount()).toBe(1);
    });

    it("falha esperada desfaz o que foi escrito antes dela e devolve a falha intacta", async () => {
      const sector = await insertSector(db);
      const turno = await insertShift(db, { sectorId: sector.id });
      const operator = authzOf({ role: "operator", sectorId: sector.id });

      const result = await runInTransaction(db, async (tx) => {
        await ensureHandover(
          tx,
          operator,
          {
            sectorId: sector.id,
            shiftId: turno.id,
            operationalDate: "2026-11-21",
          },
          NOW,
        );
        return { ok: false as const, code: "FORBIDDEN" as const, message: "x" };
      });

      expect(result).toEqual({ ok: false, code: "FORBIDDEN", message: "x" });
      expect(await rowCount()).toBe(0);
    });

    it("exceção inesperada passa adiante e também desfaz", async () => {
      const sector = await insertSector(db);
      const turno = await insertShift(db, { sectorId: sector.id });
      const operator = authzOf({ role: "operator", sectorId: sector.id });

      await expect(
        runInTransaction(db, async (tx) => {
          await ensureHandover(
            tx,
            operator,
            {
              sectorId: sector.id,
              shiftId: turno.id,
              operationalDate: "2026-11-21",
            },
            NOW,
          );
          throw new Error("falha interna");
        }),
      ).rejects.toThrow("falha interna");
      expect(await rowCount()).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Ver falhar**

Run: `bun run test -- src/features/handovers/loaders.test.ts`
Expected: FAIL com `Error: Cannot find module './loaders' imported from …/src/features/handovers/loaders.test.ts`.

- [ ] **Step 3: Implementar os carregadores**

Crie `src/features/handovers/loaders.ts`:

```ts
import "server-only";

import { and, eq, inArray } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { shift } from "@/db/schema/catalog";
import { handover } from "@/db/schema/handovers";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import { notFoundMessage } from "@/features/admin/messages";
import {
  type AdminFailure,
  type AdminResult,
  fail,
  ok,
} from "@/features/admin/result";
import { type Authz, canAccessSector } from "@/features/authz/authz";

import {
  DATE_OUT_OF_RANGE_MESSAGE,
  SECTOR_INACTIVE_HANDOVER_MESSAGE,
  SHIFT_INACTIVE_MESSAGE,
} from "./messages";
import { isIsoDate, isOperationalDateAllowed } from "./saoPaulo";
import type { HandoverRef } from "./types";

export type SectorRow = { id: string; name: string; active: boolean };
export type HandoverRow = typeof handover.$inferSelect;

const sameRef = (ref: HandoverRef) =>
  and(
    eq(handover.sectorId, ref.sectorId),
    eq(handover.shiftId, ref.shiftId),
    eq(handover.operationalDate, ref.operationalDate),
  );

/** null se o setor não existe OU o operador não pode acessá-lo (a mesma resposta: não revela o que existe). */
export async function loadSector(
  db: Db,
  actor: Authz,
  sectorId: string,
): Promise<SectorRow | null> {
  const [row] = await db
    .select({ id: sector.id, name: sector.name, active: sector.active })
    .from(sector)
    .where(eq(sector.id, sectorId));
  if (!row || !canAccessSector(actor, row.id)) return null;
  return row;
}

export async function findHandoverByRef(
  db: Db,
  ref: HandoverRef,
): Promise<HandoverRow | null> {
  const [row] = await db.select().from(handover).where(sameRef(ref));
  return row ?? null;
}

/** null se não existe ou está fora do escopo do operador. */
export async function findHandoverById(
  db: Db,
  actor: Authz,
  id: string,
): Promise<HandoverRow | null> {
  const [row] = await db.select().from(handover).where(eq(handover.id, id));
  if (!row || !canAccessSector(actor, row.sectorId)) return null;
  return row;
}

/** `SELECT … FOR UPDATE`: use dentro da transação, antes de decidir a mensagem. */
export async function lockHandover(
  tx: Db,
  id: string,
): Promise<HandoverRow | null> {
  const [row] = await tx
    .select()
    .from(handover)
    .where(eq(handover.id, id))
    .for("update");
  return row ?? null;
}

/** id → nome. Sem ids, nem consulta. */
export async function userNames(
  db: Db,
  ids: readonly string[],
): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(inArray(user.id, [...new Set(ids)]));
  return new Map(rows.map((row) => [row.id, row.name]));
}

// Sinal interno: desfaz a transação quando o trabalho termina em falha esperada.
class RollbackSignal extends Error {
  constructor(readonly failure: AdminFailure) {
    super("rollback");
  }
}

/**
 * `db.transaction()` em que uma falha esperada (`ok: false`) DESFAZ tudo:
 * um rascunho criado por `ensureHandover` não sobrevive a um salvamento
 * recusado (o rascunho só nasce no primeiro salvamento que dá certo).
 * Exceção inesperada segue adiante, também com rollback.
 */
export async function runInTransaction<T extends object>(
  db: Db,
  work: (tx: Db) => Promise<AdminResult<T>>,
): Promise<AdminResult<T>> {
  try {
    return await db.transaction(async (tx) => {
      const result = await work(tx);
      if (!result.ok) throw new RollbackSignal(result);
      return result;
    });
  } catch (error) {
    if (error instanceof RollbackSignal) return error.failure;
    throw error;
  }
}

/**
 * Dentro da transação do chamador. Setor inativo é só leitura (P26): recusa
 * com `SECTOR_INACTIVE` mesmo que a linha já exista. Linha já existente: trava
 * e devolve sem revalidar turno nem data (um rascunho antigo continua editável
 * e entregável). Linha nova: exige turno do setor e ativo, data dentro da janela;
 * `INSERT … ON CONFLICT DO NOTHING` e, se outra pessoa chegou antes, trava a dela.
 */
export async function ensureHandover(
  tx: Db,
  actor: Authz,
  ref: HandoverRef,
  now: Date,
): Promise<AdminResult<{ row: HandoverRow; created: boolean }>> {
  const owner = await loadSector(tx, actor, ref.sectorId);
  if (!owner) return fail("NOT_FOUND", notFoundMessage("setor"));
  if (!owner.active) {
    return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_HANDOVER_MESSAGE);
  }
  if (!isIsoDate(ref.operationalDate)) {
    return fail("DATE_OUT_OF_RANGE", DATE_OUT_OF_RANGE_MESSAGE);
  }

  const lockByRef = async () => {
    const [row] = await tx
      .select()
      .from(handover)
      .where(sameRef(ref))
      .for("update");
    return row ?? null;
  };

  const existing = await lockByRef();
  if (existing) return ok({ row: existing, created: false });

  const [target] = await tx
    .select({ active: shift.active })
    .from(shift)
    .where(and(eq(shift.id, ref.shiftId), eq(shift.sectorId, ref.sectorId)));
  if (!target) return fail("NOT_FOUND", notFoundMessage("turno"));
  if (!target.active) return fail("SHIFT_INACTIVE", SHIFT_INACTIVE_MESSAGE);
  if (!isOperationalDateAllowed(ref.operationalDate, now)) {
    return fail("DATE_OUT_OF_RANGE", DATE_OUT_OF_RANGE_MESSAGE);
  }

  const [inserted] = await tx
    .insert(handover)
    .values({
      sectorId: ref.sectorId,
      shiftId: ref.shiftId,
      operationalDate: ref.operationalDate,
    })
    .onConflictDoNothing()
    .returning();
  if (inserted) return ok({ row: inserted, created: true });

  const raced = await lockByRef();
  if (!raced) throw new Error("ensureHandover: a linha sumiu após o conflito");
  return ok({ row: raced, created: false });
}
```

- [ ] **Step 4: Ver passar**

Run: `bunx biome check --write src/features/handovers/loaders.ts src/features/handovers/loaders.test.ts && bun run test -- src/features/handovers/loaders.test.ts`
Expected: PASS (16 testes).

- [ ] **Step 5: Escrever o teste de `targets`**

Crie `src/features/handovers/targets.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertSector, insertShift } from "../../../test/fixtures";
import { listActiveShifts } from "./targets";

describe("listActiveShifts", () => {
  let client: PGlite;
  let db: TestDb;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    await resetDb(client);
  });

  it("devolve só turnos ativos do setor, na ordem da lista, com horário HH:mm", async () => {
    const sector = await insertSector(db, "ULD");
    const other = await insertSector(db, "Outro");
    await insertShift(db, {
      sectorId: sector.id,
      name: "Tarde",
      startsAt: "14:00",
      endsAt: "22:00",
      sortOrder: 2,
    });
    await insertShift(db, {
      sectorId: sector.id,
      name: "Manhã",
      startsAt: "06:00",
      endsAt: "14:00",
      sortOrder: 1,
    });
    await insertShift(db, {
      sectorId: sector.id,
      name: "Noite",
      startsAt: "22:00",
      endsAt: "06:00",
      sortOrder: 3,
      active: false,
    });
    await insertShift(db, { sectorId: other.id, name: "De outro setor" });

    const shifts = await listActiveShifts(db, sector.id);

    expect(shifts.map((row) => row.name)).toEqual(["Manhã", "Tarde"]);
    expect(shifts[0]).toMatchObject({ startsAt: "06:00", endsAt: "14:00" });
    expect(shifts[1]).toMatchObject({ startsAt: "14:00", endsAt: "22:00" });
  });

  it("empate de sort_order desempata por created_at e depois por id", async () => {
    const sector = await insertSector(db);
    await insertShift(db, {
      sectorId: sector.id,
      name: "B",
      sortOrder: 1,
      createdAt: new Date("2026-01-02T00:00:00Z"),
    });
    await insertShift(db, {
      sectorId: sector.id,
      name: "A",
      sortOrder: 1,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    });

    const shifts = await listActiveShifts(db, sector.id);

    expect(shifts.map((row) => row.name)).toEqual(["A", "B"]);
  });

  it("setor inativo (P26): nenhum turno, mesmo ativo", async () => {
    const sector = await insertSector(db, "Antigo", { active: false });
    await insertShift(db, { sectorId: sector.id });

    expect(await listActiveShifts(db, sector.id)).toEqual([]);
  });

  it("setor sem turnos ou inexistente: lista vazia", async () => {
    const sector = await insertSector(db);

    expect(await listActiveShifts(db, sector.id)).toEqual([]);
    expect(
      await listActiveShifts(db, "00000000-0000-4000-8000-000000000000"),
    ).toEqual([]);
  });

  it("turno que atravessa a meia-noite mantém os dois horários", async () => {
    const sector = await insertSector(db);
    await insertShift(db, {
      sectorId: sector.id,
      startsAt: "22:00",
      endsAt: "06:00",
    });

    expect((await listActiveShifts(db, sector.id))[0]).toMatchObject({
      startsAt: "22:00",
      endsAt: "06:00",
    });
  });
});
```

- [ ] **Step 6: Ver falhar**

Run: `bun run test -- src/features/handovers/targets.test.ts`
Expected: FAIL com `Error: Cannot find module './targets' imported from …/targets.test.ts`.

- [ ] **Step 7: Implementar `targets`**

Crie `src/features/handovers/targets.ts`:

```ts
import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { shift } from "@/db/schema/catalog";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import { CHOICE_LIST_LIMIT } from "@/features/admin/pagination";
import { fromDbTime } from "@/features/admin/timeOfDay";

import type { ShiftChoice } from "./types";

/**
 * Turnos ativos de um setor ativo, na ordem da lista (`sort_order`,
 * `created_at`, `id`), com horário "HH:mm". Setor inativo ou inexistente → [].
 */
export async function listActiveShifts(
  db: Db,
  sectorId: string,
): Promise<ShiftChoice[]> {
  const rows = await db
    .select({
      id: shift.id,
      name: shift.name,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
    })
    .from(shift)
    .innerJoin(sector, eq(sector.id, shift.sectorId))
    .where(
      and(
        eq(shift.sectorId, sectorId),
        eq(shift.active, true),
        eq(sector.active, true),
      ),
    )
    .orderBy(asc(shift.sortOrder), asc(shift.createdAt), asc(shift.id))
    .limit(CHOICE_LIST_LIMIT);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    startsAt: fromDbTime(row.startsAt),
    endsAt: fromDbTime(row.endsAt),
  }));
}
```

- [ ] **Step 8: Ver passar e commitar a Parte A**

Run: `bunx biome check --write src/features/handovers/targets.ts src/features/handovers/targets.test.ts && bun run test -- src/features/handovers/targets.test.ts && bun run check-types && bun run lint`
Expected: PASS (5 testes); `check-types` e `lint` sem erro.

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-4-loaders.txt` e rode:
```bash
git add src/features/handovers/loaders.ts src/features/handovers/loaders.test.ts src/features/handovers/targets.ts src/features/handovers/targets.test.ts
git commit -F .git/sdd/msg-task-4-loaders.txt
```
Mensagem:
```text
feat(passagem): carregadores com escopo de setor e turnos ativos

loadSector devolve null para setor inexistente ou fora do escopo (mesma
resposta). ensureHandover cria o rascunho com INSERT … ON CONFLICT DO
NOTHING e só valida turno e data ao criar. runInTransaction desfaz tudo
quando o trabalho devolve falha esperada. listActiveShifts só lê turnos
ativos de setor ativo (P26).

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

#### Parte B: estado do formulário

- [ ] **Step 9: Escrever o teste do estado do formulário**

Crie `src/features/handovers/formState.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { item, shift } from "@/db/schema/catalog";
import { handover, handoverItem } from "@/db/schema/handovers";

import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import {
  getHandoverFormState,
  getHandoverFormStateById,
  type HandoverFormState,
} from "./formState";

const NIL_ID = "00000000-0000-4000-8000-000000000000";
const NOW = spDate("2026-11-21", "14:05");
const DAY = "2026-11-21";

function stateOf(
  result: { ok: true; state: HandoverFormState } | { ok: false },
): HandoverFormState {
  if (!result.ok) throw new Error("esperava ok");
  return result.state;
}

describe("estado do formulário da passagem", () => {
  let client: PGlite;
  let db: TestDb;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    await resetDb(client);
  });

  async function world() {
    const sector = await insertSector(db, "ULD");
    const turno = await insertShift(db, { sectorId: sector.id, name: "Manhã" });
    const rede = await insertItem(db, {
      sectorId: sector.id,
      name: "Rede de proteção",
      unit: "rede",
      kind: "control",
    });
    const rolo = await insertItem(db, {
      sectorId: sector.id,
      name: "Rolo de fita",
      unit: "rolo",
      kind: "stock",
    });
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      name: "Ana Teste",
    });
    const bia = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      name: "Bia Teste",
    });
    const ref = {
      sectorId: sector.id,
      shiftId: turno.id,
      operationalDate: DAY,
    };
    const operator = authzOf({
      role: "operator",
      sectorId: sector.id,
      userId: ana.id,
      name: "Ana Teste",
    });
    const other = authzOf({
      role: "operator",
      sectorId: sector.id,
      userId: bia.id,
      name: "Bia Teste",
    });
    return { sector, turno, rede, rolo, ana, bia, ref, operator, other };
  }

  async function totals() {
    const [h] = await db.select({ total: count() }).from(handover);
    const [i] = await db.select({ total: count() }).from(handoverItem);
    return { handovers: h?.total ?? 0, items: i?.total ?? 0 };
  }

  describe("getHandoverFormState", () => {
    it("sem linha: valores padrão (0 e vazio), mode draft, e NÃO escreve nada", async () => {
      const { ref, operator, rede, rolo } = await world();
      const before = await totals();

      const first = stateOf(await getHandoverFormState(db, operator, ref, NOW));
      const second = stateOf(
        await getHandoverFormState(db, operator, ref, NOW),
      );

      expect(first).toEqual(second);
      expect(first).toMatchObject({
        ref,
        handoverId: null,
        status: null,
        sectorName: "ULD",
        shiftName: "Manhã",
        occurrencesText: "",
        nextShiftText: "",
        saved: null,
        deliveredByName: null,
        deliveredAt: null,
        mode: "draft",
      });
      expect(first.controls).toEqual([
        {
          itemId: rede.id,
          name: "Rede de proteção",
          unit: "rede",
          kind: "control",
          quantity: 0,
          note: "",
        },
      ]);
      expect(first.stock).toEqual([
        {
          itemId: rolo.id,
          name: "Rolo de fita",
          unit: "rolo",
          kind: "stock",
          quantity: 0,
          note: "",
        },
      ]);
      expect(await totals()).toEqual(before);
    });

    it("itens inativos ficam fora; a ordem é a do cadastro", async () => {
      const { sector, ref, operator } = await world();
      await insertItem(db, {
        sectorId: sector.id,
        name: "Item antigo",
        active: false,
      });
      const first = await insertItem(db, {
        sectorId: sector.id,
        name: "Primeiro",
        sortOrder: 0,
      });

      const state = stateOf(await getHandoverFormState(db, operator, ref, NOW));

      expect(state.controls.map((line) => line.name)).toEqual([
        "Primeiro",
        "Rede de proteção",
      ]);
      expect(state.controls[0]?.itemId).toBe(first.id);
    });

    it("rascunho salvo: traz quantidades, observações e 'salvo por'", async () => {
      const { sector, turno, ref, operator, rede, ana } = await world();
      const draft = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: DAY,
        occurrencesText: "Chuva forte",
        nextShiftText: "Conferir a doca",
        updatedBy: ana.id,
      });
      await insertHandoverItem(db, {
        handoverId: draft.id,
        itemId: rede.id,
        quantity: 7,
        note: "duas rasgadas",
      });

      const state = stateOf(await getHandoverFormState(db, operator, ref, NOW));

      expect(state).toMatchObject({
        handoverId: draft.id,
        status: "draft",
        occurrencesText: "Chuva forte",
        nextShiftText: "Conferir a doca",
        mode: "draft",
      });
      expect(state.controls[0]).toMatchObject({
        quantity: 7,
        note: "duas rasgadas",
      });
      expect(state.stock[0]).toMatchObject({ quantity: 0, note: "" });
      expect(state.saved).toMatchObject({ byName: "Ana Teste" });
      expect(state.saved?.at).toBeInstanceOf(Date);
    });

    it("rascunho com linha de item que foi desativado: o item não aparece", async () => {
      const { sector, turno, ref, operator, rede } = await world();
      const draft = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: DAY,
      });
      await insertHandoverItem(db, {
        handoverId: draft.id,
        itemId: rede.id,
        quantity: 4,
      });
      await db.update(item).set({ active: false }).where(eq(item.id, rede.id));

      const state = stateOf(await getHandoverFormState(db, operator, ref, NOW));

      expect(state.controls).toEqual([]);
    });

    it("entregue: usa os snapshots (renomear o item depois não muda) e mantém a linha do item desativado", async () => {
      const { sector, turno, ref, rede, ana, other } = await world();
      const delivered = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: DAY,
        status: "delivered",
        deliveredBy: ana.id,
        deliveredAt: spDate(DAY, "14:00"),
        shiftNameSnapshot: "Turno da Manhã",
        updatedBy: ana.id,
      });
      await insertHandoverItem(db, {
        handoverId: delivered.id,
        itemId: rede.id,
        quantity: 3,
        snapshot: true,
      });
      await db
        .update(item)
        .set({ name: "Rede nova", unit: "peça", active: false })
        .where(eq(item.id, rede.id));

      const state = stateOf(await getHandoverFormState(db, other, ref, NOW));

      expect(state.shiftName).toBe("Turno da Manhã");
      expect(state.controls).toEqual([
        {
          itemId: rede.id,
          name: "Rede de proteção",
          unit: "rede",
          kind: "control",
          quantity: 3,
          note: "",
        },
      ]);
      expect(state.stock).toEqual([]);
      expect(state).toMatchObject({
        status: "delivered",
        deliveredByName: "Ana Teste",
        mode: null,
      });
      expect(state.deliveredAt?.toISOString()).toBe(
        spDate(DAY, "14:00").toISOString(),
      );
    });

    it("entregue sem snapshot (dado antigo): cai para o cadastro vivo", async () => {
      const { sector, turno, ref, rede, ana, operator } = await world();
      const delivered = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: DAY,
        status: "delivered",
        deliveredBy: ana.id,
      });
      await insertHandoverItem(db, {
        handoverId: delivered.id,
        itemId: rede.id,
        quantity: 2,
      });

      const state = stateOf(await getHandoverFormState(db, operator, ref, NOW));

      expect(state.controls[0]).toMatchObject({
        name: "Rede de proteção",
        unit: "rede",
        quantity: 2,
      });
    });

    it("modo por papel e estado: entregue (quem entregou e admin editam), confirmada (só admin corrige)", async () => {
      const { sector, turno, ref, ana, bia, operator, other } = await world();
      const admin = authzOf({ role: "admin" });
      const row = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: DAY,
        status: "delivered",
        deliveredBy: ana.id,
      });

      const modes = async (actor: typeof operator) =>
        stateOf(await getHandoverFormState(db, actor, ref, NOW)).mode;
      expect(await modes(operator)).toBe("edit");
      expect(await modes(other)).toBeNull();
      expect(await modes(admin)).toBe("edit");

      await db
        .update(handover)
        .set({
          status: "confirmed",
          confirmedBy: bia.id,
          confirmedAt: spDate(DAY, "14:10"),
        })
        .where(eq(handover.id, row.id));
      expect(await modes(operator)).toBeNull();
      expect(await modes(other)).toBeNull();
      expect(await modes(admin)).toBe("correction");
    });

    it("operador de outro setor e setor inexistente: NOT_FOUND", async () => {
      const { ref } = await world();
      const otherSector = await insertSector(db, "Outro");
      const stranger = authzOf({ role: "operator", sectorId: otherSector.id });

      expect(await getHandoverFormState(db, stranger, ref, NOW)).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
      });
      expect(
        await getHandoverFormState(
          db,
          authzOf({ role: "admin" }),
          { ...ref, sectorId: NIL_ID },
          NOW,
        ),
      ).toMatchObject({ ok: false, code: "NOT_FOUND" });
    });

    it("setor inativo: SECTOR_INACTIVE", async () => {
      const { sector, ref, operator } = await world();
      await client.query("update sector set active = false where id = $1", [
        sector.id,
      ]);

      expect(await getHandoverFormState(db, operator, ref, NOW)).toMatchObject({
        ok: false,
        code: "SECTOR_INACTIVE",
      });
    });

    it("turno de outro setor ou inexistente: NOT_FOUND", async () => {
      const { ref, operator } = await world();
      const otherSector = await insertSector(db, "Outro");
      const foreign = await insertShift(db, { sectorId: otherSector.id });

      for (const shiftId of [foreign.id, NIL_ID]) {
        expect(
          await getHandoverFormState(db, operator, { ...ref, shiftId }, NOW),
        ).toMatchObject({ ok: false, code: "NOT_FOUND" });
      }
    });

    it("sem linha: turno inativo e data fora da janela são recusados; com linha, continua legível", async () => {
      const { sector, turno, ref, operator } = await world();

      for (const operationalDate of [
        "2026-11-22",
        "2026-10-20",
        "2026-02-30",
      ]) {
        expect(
          await getHandoverFormState(
            db,
            operator,
            { ...ref, operationalDate },
            NOW,
          ),
        ).toMatchObject({ ok: false, code: "DATE_OUT_OF_RANGE" });
      }

      await db
        .update(shift)
        .set({ active: false })
        .where(eq(shift.id, turno.id));
      expect(await getHandoverFormState(db, operator, ref, NOW)).toMatchObject({
        ok: false,
        code: "SHIFT_INACTIVE",
      });

      await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: "2026-09-01",
      });
      const old = await getHandoverFormState(
        db,
        operator,
        { ...ref, operationalDate: "2026-09-01" },
        NOW,
      );
      expect(old).toMatchObject({ ok: true });
      expect(stateOf(old).mode).toBe("draft");
    });
  });

  describe("getHandoverFormStateById", () => {
    it("lê pelo id, com o nome do turno do snapshot quando existe", async () => {
      const { sector, turno, operator, ana, ref } = await world();
      const row = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: DAY,
        status: "delivered",
        deliveredBy: ana.id,
        shiftNameSnapshot: "Manhã (antigo)",
      });

      const state = stateOf(
        await getHandoverFormStateById(db, operator, row.id),
      );

      expect(state).toMatchObject({
        handoverId: row.id,
        ref,
        shiftName: "Manhã (antigo)",
        status: "delivered",
        mode: "edit",
      });
    });

    it("sem snapshot usa o nome vivo do turno", async () => {
      const { sector, turno, operator } = await world();
      const row = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
      });

      const state = stateOf(
        await getHandoverFormStateById(db, operator, row.id),
      );

      expect(state.shiftName).toBe("Manhã");
    });

    it("id inexistente e operador de outro setor: NOT_FOUND com a mesma mensagem", async () => {
      const { sector, turno } = await world();
      const row = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
      });
      const otherSector = await insertSector(db, "Outro");
      const stranger = authzOf({ role: "operator", sectorId: otherSector.id });

      const missing = await getHandoverFormStateById(db, stranger, NIL_ID);
      const foreign = await getHandoverFormStateById(db, stranger, row.id);

      expect(missing).toEqual({
        ok: false,
        code: "NOT_FOUND",
        message: "Passagem não encontrada. Atualize a página.",
      });
      expect(foreign).toEqual(missing);
    });

    it("setor inativo: SECTOR_INACTIVE", async () => {
      const { sector, turno } = await world();
      const row = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
      });
      await client.query("update sector set active = false where id = $1", [
        sector.id,
      ]);

      expect(
        await getHandoverFormStateById(db, authzOf({ role: "admin" }), row.id),
      ).toMatchObject({ ok: false, code: "SECTOR_INACTIVE" });
    });
  });
});
```

- [ ] **Step 10: Ver falhar**

Run: `bun run test -- src/features/handovers/formState.test.ts`
Expected: FAIL com `Error: Cannot find module './formState' imported from …/formState.test.ts`.

- [ ] **Step 11: Implementar o estado do formulário**

Crie `src/features/handovers/formState.ts`:

```ts
import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";

import { item, shift } from "@/db/schema/catalog";
import type { HandoverStatus } from "@/db/schema/handovers";
import { handoverItem } from "@/db/schema/handovers";
import type { Db } from "@/db/types";
import { notFoundMessage } from "@/features/admin/messages";
import { CHOICE_LIST_LIMIT } from "@/features/admin/pagination";
import { type AdminResult, fail, ok } from "@/features/admin/result";
import type { Authz } from "@/features/authz/authz";
import type { ItemKind } from "@/lib/itemKinds";

import { formModeOf, handoverCapabilities } from "./access";
import {
  findHandoverById,
  findHandoverByRef,
  type HandoverRow,
  loadSector,
  type SectorRow,
  userNames,
} from "./loaders";
import {
  DATE_OUT_OF_RANGE_MESSAGE,
  HANDOVER_NOT_FOUND_MESSAGE,
  SECTOR_INACTIVE_HANDOVER_MESSAGE,
  SHIFT_INACTIVE_MESSAGE,
} from "./messages";
import { isIsoDate, isOperationalDateAllowed } from "./saoPaulo";
import type { FormMode, HandoverRef, ItemLine, SavedMark } from "./types";

export type HandoverFormState = {
  ref: HandoverRef;
  /** null = ainda não existe rascunho (nada salvo). */
  handoverId: string | null;
  /** null junto com handoverId null. */
  status: HandoverStatus | null;
  sectorName: string;
  shiftName: string;
  occurrencesText: string;
  nextShiftText: string;
  controls: ItemLine[];
  stock: ItemLine[];
  saved: SavedMark | null;
  deliveredByName: string | null;
  deliveredAt: Date | null;
  /** null = a pessoa não pode editar (a página mostra o resumo). */
  mode: FormMode | null;
};

type ShiftRow = { id: string; name: string; active: boolean };

const ITEM_ORDER = [
  asc(item.sortOrder),
  asc(item.createdAt),
  asc(item.id),
] as const;

// Rascunho ou ainda sem linha: os itens ATIVOS do setor, com o valor salvo (se
// houver) ou 0 / "". Item desativado depois de salvo some do formulário.
async function liveLines(
  db: Db,
  sectorId: string,
  handoverId: string | null,
): Promise<ItemLine[]> {
  const rows = await db
    .select({
      itemId: item.id,
      name: item.name,
      unit: item.unit,
      kind: item.kind,
      quantity: sql<number>`coalesce(${handoverItem.quantity}, 0)`,
      note: handoverItem.note,
    })
    .from(item)
    .leftJoin(
      handoverItem,
      and(
        eq(handoverItem.itemId, item.id),
        // Sem rascunho nenhum id casa: o LEFT JOIN devolve só os itens.
        eq(
          handoverItem.handoverId,
          handoverId ?? "00000000-0000-0000-0000-000000000000",
        ),
      ),
    )
    .where(and(eq(item.sectorId, sectorId), eq(item.active, true)))
    .orderBy(...ITEM_ORDER)
    .limit(CHOICE_LIST_LIMIT);
  return rows.map((row) => ({ ...row, note: row.note ?? "" }));
}

// Entregue ou confirmada: as LINHAS da passagem, com o snapshot da entrega
// (o cadastro vivo só entra se o snapshot faltar).
async function snapshotLines(db: Db, handoverId: string): Promise<ItemLine[]> {
  const rows = await db
    .select({
      itemId: handoverItem.itemId,
      name: sql<string>`coalesce(${handoverItem.itemNameSnapshot}, ${item.name})`,
      unit: sql<string>`coalesce(${handoverItem.itemUnitSnapshot}, ${item.unit})`,
      kind: sql<ItemKind>`coalesce(${handoverItem.itemKindSnapshot}, ${item.kind})`,
      quantity: handoverItem.quantity,
      note: handoverItem.note,
    })
    .from(handoverItem)
    .innerJoin(item, eq(item.id, handoverItem.itemId))
    .where(eq(handoverItem.handoverId, handoverId))
    .orderBy(...ITEM_ORDER)
    .limit(CHOICE_LIST_LIMIT);
  return rows.map((row) => ({ ...row, note: row.note ?? "" }));
}

// Corpo comum de getHandoverFormState e getHandoverFormStateById. Só lê.
async function buildState(
  db: Db,
  actor: Authz,
  owner: SectorRow,
  target: ShiftRow,
  ref: HandoverRef,
  row: HandoverRow | null,
): Promise<HandoverFormState> {
  const lines =
    row !== null && row.status !== "draft"
      ? await snapshotLines(db, row.id)
      : await liveLines(db, owner.id, row?.id ?? null);

  const capabilities = handoverCapabilities(actor, {
    status: row?.status ?? "draft",
    sectorId: owner.id,
    deliveredBy: row?.deliveredBy ?? null,
  });

  const nameIds = [row?.updatedBy, row?.deliveredBy].filter(
    (id): id is string => typeof id === "string",
  );
  const names = await userNames(db, nameIds);
  const savedByName = row?.updatedBy ? names.get(row.updatedBy) : undefined;

  return {
    ref,
    handoverId: row?.id ?? null,
    status: row?.status ?? null,
    sectorName: owner.name,
    shiftName: row?.shiftNameSnapshot ?? target.name,
    occurrencesText: row?.occurrencesText ?? "",
    nextShiftText: row?.nextShiftText ?? "",
    controls: lines.filter((line) => line.kind === "control"),
    stock: lines.filter((line) => line.kind === "stock"),
    saved:
      row && savedByName !== undefined
        ? { at: row.updatedAt, byName: savedByName }
        : null,
    deliveredByName: row?.deliveredBy
      ? (names.get(row.deliveredBy) ?? null)
      : null,
    deliveredAt: row?.deliveredAt ?? null,
    mode: formModeOf(row?.status ?? null, capabilities),
  };
}

async function loadShift(
  db: Db,
  sectorId: string,
  shiftId: string,
): Promise<ShiftRow | null> {
  const [row] = await db
    .select({ id: shift.id, name: shift.name, active: shift.active })
    .from(shift)
    .where(and(eq(shift.id, shiftId), eq(shift.sectorId, sectorId)));
  return row ?? null;
}

/**
 * Estado do formulário de uma combinação setor + turno + dia. NUNCA escreve
 * (F3-2): sem linha, devolve os valores padrão (`0`, `""`) e `mode: "draft"`;
 * o rascunho só nasce no primeiro salvamento. Sem linha, a combinação precisa
 * poder ser criada (turno ativo, data na janela): senão `SHIFT_INACTIVE` /
 * `DATE_OUT_OF_RANGE`, os mesmos códigos que o salvamento devolveria.
 */
export async function getHandoverFormState(
  db: Db,
  actor: Authz,
  ref: HandoverRef,
  now: Date,
): Promise<AdminResult<{ state: HandoverFormState }>> {
  const owner = await loadSector(db, actor, ref.sectorId);
  if (!owner) return fail("NOT_FOUND", notFoundMessage("setor"));
  if (!owner.active) {
    return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_HANDOVER_MESSAGE);
  }
  if (!isIsoDate(ref.operationalDate)) {
    return fail("DATE_OUT_OF_RANGE", DATE_OUT_OF_RANGE_MESSAGE);
  }
  const target = await loadShift(db, owner.id, ref.shiftId);
  if (!target) return fail("NOT_FOUND", notFoundMessage("turno"));

  const row = await findHandoverByRef(db, ref);
  if (row === null) {
    if (!target.active) return fail("SHIFT_INACTIVE", SHIFT_INACTIVE_MESSAGE);
    if (!isOperationalDateAllowed(ref.operationalDate, now)) {
      return fail("DATE_OUT_OF_RANGE", DATE_OUT_OF_RANGE_MESSAGE);
    }
  }
  return ok({ state: await buildState(db, actor, owner, target, ref, row) });
}

/** Mesmo corpo, a partir do id da passagem (`/passagens/[id]?editar=1`). */
export async function getHandoverFormStateById(
  db: Db,
  actor: Authz,
  id: string,
): Promise<AdminResult<{ state: HandoverFormState }>> {
  const row = await findHandoverById(db, actor, id);
  if (!row) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);
  const owner = await loadSector(db, actor, row.sectorId);
  if (!owner) return fail("NOT_FOUND", notFoundMessage("setor"));
  if (!owner.active) {
    return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_HANDOVER_MESSAGE);
  }
  const target = await loadShift(db, owner.id, row.shiftId);
  if (!target) return fail("NOT_FOUND", notFoundMessage("turno"));

  const ref: HandoverRef = {
    sectorId: row.sectorId,
    shiftId: row.shiftId,
    operationalDate: row.operationalDate,
  };
  return ok({ state: await buildState(db, actor, owner, target, ref, row) });
}
```

- [ ] **Step 12: Ver passar e commitar a Parte B**

Run: `bunx biome check --write src/features/handovers/formState.ts src/features/handovers/formState.test.ts && bun run test -- src/features/handovers/formState.test.ts && bun run check-types && bun run lint`
Expected: PASS (15 testes); `check-types` e `lint` sem erro.

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-4-formstate.txt` e rode:
```bash
git add src/features/handovers/formState.ts src/features/handovers/formState.test.ts
git commit -F .git/sdd/msg-task-4-formstate.txt
```
Mensagem:
```text
feat(passagem): estado do formulário sem escrita (GET nunca escreve)

getHandoverFormState devolve os valores padrão (0 e vazio) quando ainda
não há rascunho e nunca grava; rascunho lê os itens ativos do setor,
entregue e confirmada leem os snapshots da entrega. O modo do formulário
(rascunho, edição, correção) vem de handoverCapabilities.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

#### Parte C: salvar campo e entregar turno

- [ ] **Step 13: Escrever o teste de `saveHandoverField`**

Crie `src/features/handovers/draft.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { item, shift } from "@/db/schema/catalog";
import {
  handover,
  handoverCorrection,
  handoverItem,
} from "@/db/schema/handovers";

import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { saveHandoverField } from "./draft";
import type { FieldChange, SaveFieldInput } from "./types";

const NOW = spDate("2026-11-21", "14:05");
const LATER = spDate("2026-11-21", "14:20");
const DAY = "2026-11-21";

describe("saveHandoverField", () => {
  let client: PGlite;
  let db: TestDb;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    await resetDb(client);
  });

  async function world() {
    const sector = await insertSector(db, "ULD");
    const turno = await insertShift(db, { sectorId: sector.id, name: "Manhã" });
    const rede = await insertItem(db, {
      sectorId: sector.id,
      name: "Rede de proteção",
      kind: "control",
    });
    const rolo = await insertItem(db, {
      sectorId: sector.id,
      name: "Rolo de fita",
      kind: "stock",
    });
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      name: "Ana Teste",
    });
    const bia = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      name: "Bia Teste",
    });
    const ref = {
      sectorId: sector.id,
      shiftId: turno.id,
      operationalDate: DAY,
    };
    const operatorAna = authzOf({
      role: "operator",
      sectorId: sector.id,
      userId: ana.id,
      name: "Ana Teste",
    });
    const operatorBia = authzOf({
      role: "operator",
      sectorId: sector.id,
      userId: bia.id,
      name: "Bia Teste",
    });
    const adminUser = await insertUser(db, {
      role: "admin",
      sectorId: null,
      name: "Admin",
    });
    const admin = authzOf({
      role: "admin",
      userId: adminUser.id,
      name: "Admin",
    });
    return {
      sector,
      turno,
      rede,
      rolo,
      ana,
      bia,
      ref,
      operatorAna,
      operatorBia,
      admin,
    };
  }

  async function counts() {
    const [h] = await db.select({ total: count() }).from(handover);
    const [i] = await db.select({ total: count() }).from(handoverItem);
    const [c] = await db.select({ total: count() }).from(handoverCorrection);
    return {
      handovers: h?.total ?? 0,
      items: i?.total ?? 0,
      corrections: c?.total ?? 0,
    };
  }

  async function onlyHandover() {
    const [row] = await db.select().from(handover);
    if (!row) throw new Error("passagem ausente");
    return row;
  }

  describe("criação e reaproveitamento do rascunho", () => {
    it("o primeiro salvamento cria o rascunho e devolve id, hora e nome; o segundo reaproveita (uma linha só)", async () => {
      const { ref, operatorAna } = await world();

      const first = await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "occurrences", value: "Chuva forte" },
        NOW,
      );
      const second = await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "nextShift", value: "Conferir a doca" },
        LATER,
      );

      expect(first).toEqual({
        ok: true,
        handoverId: expect.any(String),
        savedAt: NOW,
        savedByName: "Ana Teste",
      });
      expect(second).toMatchObject({ ok: true, savedAt: LATER });
      if (first.ok && second.ok) {
        expect(second.handoverId).toBe(first.handoverId);
      }
      expect((await counts()).handovers).toBe(1);
      const row = await onlyHandover();
      expect(row).toMatchObject({
        status: "draft",
        occurrencesText: "Chuva forte",
        nextShiftText: "Conferir a doca",
        updatedBy: operatorAna.userId,
        deliveredBy: null,
      });
      expect(row.updatedAt.toISOString()).toBe(LATER.toISOString());
    });

    it("dois operadores no mesmo rascunho: cada campo guarda o último a salvar", async () => {
      const { ref, operatorAna, operatorBia } = await world();

      await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "occurrences", value: "versão da Ana" },
        NOW,
      );
      await saveHandoverField(
        db,
        operatorBia,
        { ...ref, field: "occurrences", value: "versão da Bia" },
        LATER,
      );
      await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "nextShift", value: "só da Ana" },
        LATER,
      );

      const row = await onlyHandover();
      expect(row).toMatchObject({
        occurrencesText: "versão da Bia",
        nextShiftText: "só da Ana",
        updatedBy: operatorAna.userId,
      });
      expect((await counts()).handovers).toBe(1);
    });

    it("o admin também salva (qualquer setor)", async () => {
      const { ref, admin } = await world();

      const result = await saveHandoverField(
        db,
        admin,
        { ...ref, field: "occurrences", value: "feito pelo admin" },
        NOW,
      );

      expect(result).toMatchObject({ ok: true, savedByName: "Admin" });
    });
  });

  describe("campos", () => {
    it("quantidade cria a linha do item; o segundo valor atualiza a mesma linha", async () => {
      const { ref, operatorAna, rede } = await world();
      const save = (value: number) =>
        saveHandoverField(
          db,
          operatorAna,
          { ...ref, field: "quantity", itemId: rede.id, value },
          NOW,
        );

      expect(await save(5)).toMatchObject({ ok: true });
      expect(await save(8)).toMatchObject({ ok: true });
      expect(await save(0)).toMatchObject({ ok: true });

      const lines = await db.select().from(handoverItem);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({ itemId: rede.id, quantity: 0 });
    });

    it("quantidade no teto passa; observação guarda o texto limpo e '' vira sem observação", async () => {
      const { ref, operatorAna, rede } = await world();

      await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "quantity", itemId: rede.id, value: 99_999 },
        NOW,
      );
      await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "note", itemId: rede.id, value: "  duas   rasgadas " },
        NOW,
      );
      let [line] = await db.select().from(handoverItem);
      expect(line).toMatchObject({ quantity: 99_999, note: "duas rasgadas" });

      await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "note", itemId: rede.id, value: "   " },
        NOW,
      );
      [line] = await db.select().from(handoverItem);
      expect(line).toMatchObject({ quantity: 99_999, note: null });
    });

    it("observação sozinha cria a linha com quantidade 0", async () => {
      const { ref, operatorAna, rolo } = await world();

      await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "note", itemId: rolo.id, value: "caixa molhada" },
        NOW,
      );

      const [line] = await db.select().from(handoverItem);
      expect(line).toMatchObject({ quantity: 0, note: "caixa molhada" });
    });

    it("texto livre é guardado como digitado: NFC, quebra de linha normalizada, sem trim", async () => {
      const { ref, operatorAna } = await world();

      await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "occurrences", value: "  e\u{301}\r\nlinha 2  " },
        NOW,
      );

      expect((await onlyHandover()).occurrencesText).toBe(
        "  \u{e9}\nlinha 2  ",
      );
    });

    it("texto vazio apaga o campo", async () => {
      const { ref, operatorAna } = await world();
      await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "nextShift", value: "algo" },
        NOW,
      );

      await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "nextShift", value: "" },
        NOW,
      );

      expect((await onlyHandover()).nextShiftText).toBe("");
    });

    it("texto com 2.000 pontos de código passa", async () => {
      const { ref, operatorAna } = await world();

      const result = await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "occurrences", value: "😀".repeat(2000) },
        NOW,
      );

      expect(result).toMatchObject({ ok: true });
    });
  });

  describe("entrada inválida (revalidada no servidor) não cria nada", () => {
    const invalid: [string, FieldChange][] = [
      ["quantidade negativa", { field: "quantity", itemId: "", value: -1 }],
      ["quantidade decimal", { field: "quantity", itemId: "", value: 1.5 }],
      [
        "quantidade acima do teto",
        { field: "quantity", itemId: "", value: 100_000 },
      ],
      [
        "texto de 2.001 pontos de código",
        { field: "occurrences", value: "😀".repeat(2001) },
      ],
      [
        "observação de 201 caracteres",
        { field: "note", itemId: "", value: "a".repeat(201) },
      ],
    ];

    it.each(
      invalid,
    )("%s → INVALID_INPUT em value, sem rascunho", async (_name, change) => {
      const { ref, operatorAna, rede } = await world();
      // O itemId real entra aqui; a tabela só descreve o valor inválido.
      const input: SaveFieldInput =
        change.field === "quantity" || change.field === "note"
          ? { ...ref, ...change, itemId: rede.id }
          : { ...ref, ...change };

      const result = await saveHandoverField(db, operatorAna, input, NOW);

      expect(result).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { value: expect.any(String) },
      });
      expect(await counts()).toEqual({
        handovers: 0,
        items: 0,
        corrections: 0,
      });
    });
  });

  describe("escopo e permissão", () => {
    it("operador de outro setor: NOT_FOUND, nada criado", async () => {
      const { ref } = await world();
      const otherSector = await insertSector(db, "Outro");
      const stranger = authzOf({ role: "operator", sectorId: otherSector.id });

      const result = await saveHandoverField(
        db,
        stranger,
        { ...ref, field: "occurrences", value: "invasão" },
        NOW,
      );

      expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
      expect((await counts()).handovers).toBe(0);
    });

    it("item de outro setor e item inexistente: NOT_FOUND, e o rascunho recém-criado é desfeito", async () => {
      const { ref, operatorAna } = await world();
      const otherSector = await insertSector(db, "Outro");
      const foreign = await insertItem(db, { sectorId: otherSector.id });

      for (const itemId of [
        foreign.id,
        "00000000-0000-4000-8000-000000000000",
      ]) {
        const result = await saveHandoverField(
          db,
          operatorAna,
          { ...ref, field: "quantity", itemId, value: 3 },
          NOW,
        );
        expect(result).toMatchObject({
          ok: false,
          code: "NOT_FOUND",
          message: "Item não encontrado. Atualize a página.",
        });
      }
      expect(await counts()).toEqual({
        handovers: 0,
        items: 0,
        corrections: 0,
      });
    });

    it("item inativo não entra em rascunho: NOT_FOUND", async () => {
      const { ref, operatorAna, rede } = await world();
      await db.update(item).set({ active: false }).where(eq(item.id, rede.id));

      const result = await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "quantity", itemId: rede.id, value: 3 },
        NOW,
      );

      expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
      expect((await counts()).items).toBe(0);
    });

    it("entregue: só quem entregou e o admin salvam; outra pessoa do setor recebe FORBIDDEN; nunca gera linha de correção", async () => {
      const { sector, turno, ref, ana, rede, operatorAna, operatorBia, admin } =
        await world();
      const delivered = await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: DAY,
        status: "delivered",
        deliveredBy: ana.id,
      });
      await insertHandoverItem(db, {
        handoverId: delivered.id,
        itemId: rede.id,
        quantity: 2,
        snapshot: true,
      });
      const change = (value: number): SaveFieldInput => ({
        ...ref,
        field: "quantity",
        itemId: rede.id,
        value,
      });

      expect(await saveHandoverField(db, operatorBia, change(9), NOW)).toEqual({
        ok: false,
        code: "FORBIDDEN",
        message:
          "Só quem entregou o turno ou um administrador pode editar esta passagem.",
      });
      expect((await db.select().from(handoverItem))[0]?.quantity).toBe(2);

      expect(
        await saveHandoverField(db, operatorAna, change(5), NOW),
      ).toMatchObject({
        ok: true,
      });
      expect((await db.select().from(handoverItem))[0]?.quantity).toBe(5);
      expect(
        await saveHandoverField(db, admin, change(6), LATER),
      ).toMatchObject({
        ok: true,
      });
      expect((await db.select().from(handoverItem))[0]?.quantity).toBe(6);
      expect((await counts()).corrections).toBe(0);
      expect((await onlyHandover()).status).toBe("delivered");
    });

    it("entregue: o texto também salva direto, e item sem linha na passagem é NOT_FOUND", async () => {
      const { sector, turno, ref, ana, rolo, operatorAna } = await world();
      await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: DAY,
        status: "delivered",
        deliveredBy: ana.id,
      });

      const text = await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "nextShift", value: "corrigido na hora" },
        NOW,
      );
      const missingLine = await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "quantity", itemId: rolo.id, value: 1 },
        NOW,
      );

      expect(text).toMatchObject({ ok: true });
      expect((await onlyHandover()).nextShiftText).toBe("corrigido na hora");
      expect(missingLine).toMatchObject({ ok: false, code: "NOT_FOUND" });
      expect((await counts()).items).toBe(0);
    });

    it("confirmada: HANDOVER_LOCKED para operador E para admin; nada muda", async () => {
      const { sector, turno, ref, ana, bia, operatorAna, operatorBia, admin } =
        await world();
      await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: DAY,
        status: "confirmed",
        deliveredBy: ana.id,
        confirmedBy: bia.id,
        occurrencesText: "original",
      });

      for (const actor of [operatorAna, operatorBia, admin]) {
        const result = await saveHandoverField(
          db,
          actor,
          { ...ref, field: "occurrences", value: "adulterado" },
          NOW,
        );
        expect(result).toEqual({
          ok: false,
          code: "HANDOVER_LOCKED",
          message:
            "Esta passagem já foi confirmada. Só um administrador corrige, com motivo.",
        });
      }
      expect((await onlyHandover()).occurrencesText).toBe("original");
      expect((await counts()).corrections).toBe(0);
    });
  });

  describe("regras de criação (só ao criar)", () => {
    it("data futura, de 32 dias atrás e lixo: DATE_OUT_OF_RANGE, nada criado; 31 dias atrás passa", async () => {
      const { ref, operatorAna } = await world();
      const save = (operationalDate: string) =>
        saveHandoverField(
          db,
          operatorAna,
          { ...ref, operationalDate, field: "occurrences", value: "x" },
          NOW,
        );

      for (const operationalDate of [
        "2026-11-22",
        "2026-10-20",
        "2026-02-30",
      ]) {
        expect(await save(operationalDate)).toMatchObject({
          ok: false,
          code: "DATE_OUT_OF_RANGE",
        });
      }
      expect((await counts()).handovers).toBe(0);
      expect(await save("2026-10-21")).toMatchObject({ ok: true });
    });

    it("turno inativo ao criar: SHIFT_INACTIVE", async () => {
      const { ref, operatorAna, turno } = await world();
      await db
        .update(shift)
        .set({ active: false })
        .where(eq(shift.id, turno.id));

      const result = await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "occurrences", value: "x" },
        NOW,
      );

      expect(result).toMatchObject({ ok: false, code: "SHIFT_INACTIVE" });
      expect((await counts()).handovers).toBe(0);
    });

    it("rascunho que já existe continua salvando mesmo com turno inativo e data antiga", async () => {
      const { sector, turno, ref, operatorAna } = await world();
      await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: "2026-09-01",
      });
      await db
        .update(shift)
        .set({ active: false })
        .where(eq(shift.id, turno.id));

      const result = await saveHandoverField(
        db,
        operatorAna,
        {
          ...ref,
          operationalDate: "2026-09-01",
          field: "occurrences",
          value: "ainda vale",
        },
        NOW,
      );

      expect(result).toMatchObject({ ok: true });
      expect((await onlyHandover()).occurrencesText).toBe("ainda vale");
    });

    it("rascunho existente de setor inativo: SECTOR_INACTIVE e nada muda (setor inativo é só leitura, P26)", async () => {
      const { sector, turno, ref, operatorAna } = await world();
      await insertHandover(db, {
        sectorId: sector.id,
        shiftId: turno.id,
        operationalDate: ref.operationalDate,
      });
      await client.query("update sector set active = false where id = $1", [
        sector.id,
      ]);

      const result = await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "occurrences", value: "x" },
        NOW,
      );

      expect(result).toMatchObject({ ok: false, code: "SECTOR_INACTIVE" });
      expect((await onlyHandover()).occurrencesText).toBe("");
    });

    it("setor inativo ao criar: SECTOR_INACTIVE", async () => {
      const { sector, ref, operatorAna } = await world();
      await client.query("update sector set active = false where id = $1", [
        sector.id,
      ]);

      const result = await saveHandoverField(
        db,
        operatorAna,
        { ...ref, field: "occurrences", value: "x" },
        NOW,
      );

      expect(result).toMatchObject({ ok: false, code: "SECTOR_INACTIVE" });
    });
  });
});
```

- [ ] **Step 14: Ver falhar**

Run: `bun run test -- src/features/handovers/draft.test.ts`
Expected: FAIL com `Error: Cannot find module './draft' imported from …/draft.test.ts`.

- [ ] **Step 15: Implementar `saveHandoverField`**

Crie `src/features/handovers/draft.ts`:

```ts
import "server-only";

import { and, eq } from "drizzle-orm";

import { item } from "@/db/schema/catalog";
import { handover, handoverItem } from "@/db/schema/handovers";
import type { Db } from "@/db/types";
import { notFoundMessage } from "@/features/admin/messages";
import {
  type AdminResult,
  fail,
  INVALID_INPUT_MESSAGE,
  ok,
} from "@/features/admin/result";
import type { Authz } from "@/features/authz/authz";

import { handoverCapabilities } from "./access";
import { validateFieldChange } from "./fieldRules";
import { ensureHandover, type HandoverRow, runInTransaction } from "./loaders";
import { EDIT_FORBIDDEN_MESSAGE, HANDOVER_LOCKED_MESSAGE } from "./messages";
import type { FieldChange, SaveFieldInput } from "./types";

export type SavedField = {
  handoverId: string;
  savedAt: Date;
  savedByName: string;
};

// Quantidade e observação de um item do setor. Rascunho: o item precisa estar
// ativo e a linha nasce (ou muda) por upsert. Entregue: só muda a linha que a
// entrega já criou. Devolve false se o item não vale para esta passagem.
async function saveItemField(
  tx: Db,
  row: HandoverRow,
  change: Extract<FieldChange, { field: "quantity" | "note" }>,
): Promise<boolean> {
  const [target] = await tx
    .select({ active: item.active })
    .from(item)
    .where(and(eq(item.id, change.itemId), eq(item.sectorId, row.sectorId)));
  if (!target) return false;

  // Observação vazia é "sem observação": guardada como null.
  const values =
    change.field === "quantity"
      ? { quantity: change.value }
      : { note: change.value === "" ? null : change.value };

  if (row.status === "draft") {
    if (!target.active) return false;
    await tx
      .insert(handoverItem)
      .values({ handoverId: row.id, itemId: change.itemId, ...values })
      .onConflictDoUpdate({
        target: [handoverItem.handoverId, handoverItem.itemId],
        set: values,
      });
    return true;
  }

  const updated = await tx
    .update(handoverItem)
    .set(values)
    .where(
      and(
        eq(handoverItem.handoverId, row.id),
        eq(handoverItem.itemId, change.itemId),
      ),
    )
    .returning({ itemId: handoverItem.itemId });
  return updated.length > 0;
}

/**
 * Salvamento automático de UM campo (F3-2, F3-3, F3-4). Uma transação; o
 * rascunho nasce aqui, no primeiro salvamento que dá certo (uma falha desfaz
 * até o rascunho recém-criado). Rascunho: qualquer pessoa do setor e o admin.
 * Entregue: quem entregou e o admin, direto. Confirmada: ninguém (nem o admin:
 * só `correctHandover` altera, com motivo). Não revalida a página.
 */
export async function saveHandoverField(
  db: Db,
  actor: Authz,
  input: SaveFieldInput,
  now: Date,
): Promise<AdminResult<SavedField>> {
  const ref = {
    sectorId: input.sectorId,
    shiftId: input.shiftId,
    operationalDate: input.operationalDate,
  };

  return runInTransaction(db, async (tx) => {
    const ensured = await ensureHandover(tx, actor, ref, now);
    if (!ensured.ok) return ensured;
    const { row } = ensured;

    if (row.status === "confirmed") {
      return fail("HANDOVER_LOCKED", HANDOVER_LOCKED_MESSAGE);
    }
    if (!handoverCapabilities(actor, row).canEditDirectly) {
      return fail("FORBIDDEN", EDIT_FORBIDDEN_MESSAGE);
    }

    const validated = validateFieldChange(input);
    if (!validated.ok) {
      return fail("INVALID_INPUT", INVALID_INPUT_MESSAGE, {
        value: validated.message,
      });
    }
    const valid = validated.change;

    const stamp = { updatedAt: now, updatedBy: actor.userId };
    if (valid.field === "occurrences") {
      await tx
        .update(handover)
        .set({ occurrencesText: valid.value, ...stamp })
        .where(eq(handover.id, row.id));
    } else if (valid.field === "nextShift") {
      await tx
        .update(handover)
        .set({ nextShiftText: valid.value, ...stamp })
        .where(eq(handover.id, row.id));
    } else {
      if (!(await saveItemField(tx, row, valid))) {
        return fail("NOT_FOUND", notFoundMessage("item"));
      }
      await tx.update(handover).set(stamp).where(eq(handover.id, row.id));
    }

    return ok({ handoverId: row.id, savedAt: now, savedByName: actor.name });
  });
}
```

- [ ] **Step 16: Ver passar**

Run: `bunx biome check --write src/features/handovers/draft.ts src/features/handovers/draft.test.ts && bun run test -- src/features/handovers/draft.test.ts`
Expected: PASS (25 testes).

- [ ] **Step 17: Escrever o teste de `deliverHandover`**

Crie `src/features/handovers/deliver.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { and, count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { item, shift } from "@/db/schema/catalog";
import { handover, handoverItem } from "@/db/schema/handovers";

import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { deliverHandover } from "./deliver";
import { saveHandoverField } from "./draft";

const DAY = "2026-11-21";
const NOW = spDate(DAY, "14:05");
const LATER = spDate(DAY, "14:30");

describe("deliverHandover", () => {
  let client: PGlite;
  let db: TestDb;

  beforeAll(async () => {
    ({ client, db } = await createTestDb());
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    await resetDb(client);
  });

  async function world() {
    const sector = await insertSector(db, "ULD");
    const turno = await insertShift(db, { sectorId: sector.id, name: "Manhã" });
    const rede = await insertItem(db, {
      sectorId: sector.id,
      name: "Rede de proteção",
      unit: "rede",
      kind: "control",
    });
    const rolo = await insertItem(db, {
      sectorId: sector.id,
      name: "Rolo de fita",
      unit: "rolo",
      kind: "stock",
    });
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      name: "Ana Teste",
    });
    const bia = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      name: "Bia Teste",
    });
    const adminUser = await insertUser(db, {
      role: "admin",
      sectorId: null,
      name: "Admin Teste",
    });
    const ref = {
      sectorId: sector.id,
      shiftId: turno.id,
      operationalDate: DAY,
    };
    return {
      sector,
      turno,
      rede,
      rolo,
      ref,
      operatorAna: authzOf({
        role: "operator",
        sectorId: sector.id,
        userId: ana.id,
        name: "Ana Teste",
      }),
      operatorBia: authzOf({
        role: "operator",
        sectorId: sector.id,
        userId: bia.id,
        name: "Bia Teste",
      }),
      admin: authzOf({
        role: "admin",
        userId: adminUser.id,
        name: "Admin Teste",
      }),
    };
  }

  async function onlyHandover() {
    const [row] = await db.select().from(handover);
    if (!row) throw new Error("passagem ausente");
    return row;
  }

  async function lines() {
    return db.select().from(handoverItem);
  }

  async function handoverCount(): Promise<number> {
    const [row] = await db.select({ total: count() }).from(handover);
    return row?.total ?? 0;
  }

  it("entrega um rascunho: status, quem, quando, nome do turno; devolve id e hora", async () => {
    const { ref, operatorAna } = await world();
    const saved = await saveHandoverField(
      db,
      operatorAna,
      { ...ref, field: "occurrences", value: "Tudo certo" },
      NOW,
    );

    const result = await deliverHandover(db, operatorAna, ref, LATER);

    expect(result).toEqual({
      ok: true,
      id: saved.ok ? saved.handoverId : "?",
      deliveredAt: LATER,
    });
    const row = await onlyHandover();
    expect(row).toMatchObject({
      status: "delivered",
      deliveredBy: operatorAna.userId,
      shiftNameSnapshot: "Manhã",
      updatedBy: operatorAna.userId,
      occurrencesText: "Tudo certo",
      confirmedBy: null,
      confirmedAt: null,
    });
    expect(row.deliveredAt?.toISOString()).toBe(LATER.toISOString());
    expect(row.updatedAt.toISOString()).toBe(LATER.toISOString());
  });

  it("sem rascunho: cria e entrega na mesma transação", async () => {
    const { ref, operatorAna } = await world();

    const result = await deliverHandover(db, operatorAna, ref, NOW);

    expect(result).toMatchObject({ ok: true });
    expect(await handoverCount()).toBe(1);
    expect((await onlyHandover()).status).toBe("delivered");
  });

  it("completa com 0 todo item ativo que faltava, mantém o que foi digitado e preenche os snapshots", async () => {
    const { ref, operatorAna, rede, rolo } = await world();
    await saveHandoverField(
      db,
      operatorAna,
      { ...ref, field: "quantity", itemId: rede.id, value: 4 },
      NOW,
    );
    await saveHandoverField(
      db,
      operatorAna,
      { ...ref, field: "note", itemId: rede.id, value: "duas rasgadas" },
      NOW,
    );

    await deliverHandover(db, operatorAna, ref, LATER);

    const all = await lines();
    expect(all).toHaveLength(2);
    expect(all.find((line) => line.itemId === rede.id)).toMatchObject({
      quantity: 4,
      note: "duas rasgadas",
      itemNameSnapshot: "Rede de proteção",
      itemUnitSnapshot: "rede",
      itemKindSnapshot: "control",
    });
    expect(all.find((line) => line.itemId === rolo.id)).toMatchObject({
      quantity: 0,
      note: null,
      itemNameSnapshot: "Rolo de fita",
      itemUnitSnapshot: "rolo",
      itemKindSnapshot: "stock",
    });
  });

  it("item inativo sem linha NÃO entra; item desativado depois de digitado MANTÉM a linha, com snapshot do cadastro", async () => {
    const { sector, ref, operatorAna, rede, rolo } = await world();
    await insertItem(db, {
      sectorId: sector.id,
      name: "Item antigo",
      active: false,
    });
    await saveHandoverField(
      db,
      operatorAna,
      { ...ref, field: "quantity", itemId: rede.id, value: 6 },
      NOW,
    );
    await db.update(item).set({ active: false }).where(eq(item.id, rede.id));

    await deliverHandover(db, operatorAna, ref, LATER);

    const all = await lines();
    expect(all.map((line) => line.itemId).sort()).toEqual(
      [rede.id, rolo.id].sort(),
    );
    expect(all.find((line) => line.itemId === rede.id)).toMatchObject({
      quantity: 6,
      itemNameSnapshot: "Rede de proteção",
    });
  });

  it("item de outro setor nunca entra nas linhas", async () => {
    const { ref, operatorAna } = await world();
    const otherSector = await insertSector(db, "Outro");
    await insertItem(db, { sectorId: otherSector.id });

    await deliverHandover(db, operatorAna, ref, NOW);

    expect(await lines()).toHaveLength(2);
  });

  it("entregar tudo zerado e sem texto é permitido", async () => {
    const { ref, operatorBia } = await world();

    const result = await deliverHandover(db, operatorBia, ref, NOW);

    expect(result).toMatchObject({ ok: true });
    const row = await onlyHandover();
    expect(row).toMatchObject({
      status: "delivered",
      occurrencesText: "",
      nextShiftText: "",
    });
    expect((await lines()).every((line) => line.quantity === 0)).toBe(true);
  });

  it("setor sem itens: entrega sem nenhuma linha", async () => {
    const sector = await insertSector(db, "Vazio");
    const turno = await insertShift(db, { sectorId: sector.id });
    const operator = authzOf({ role: "operator", sectorId: sector.id });
    const user = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
    });

    const result = await deliverHandover(
      db,
      { ...operator, userId: user.id },
      { sectorId: sector.id, shiftId: turno.id, operationalDate: DAY },
      NOW,
    );

    expect(result).toMatchObject({ ok: true });
    expect(await lines()).toEqual([]);
  });

  it("o segundo 'Entregar' devolve ALREADY_DELIVERED com nome e hora de quem entregou, sem mudar nada", async () => {
    const { ref, operatorAna, operatorBia } = await world();
    await deliverHandover(db, operatorAna, ref, NOW);
    const before = await onlyHandover();

    const again = await deliverHandover(db, operatorBia, ref, LATER);
    const sameUser = await deliverHandover(db, operatorAna, ref, LATER);

    expect(again).toEqual({
      ok: false,
      code: "ALREADY_DELIVERED",
      message: "Esta passagem já foi entregue por Ana Teste às 14:05.",
    });
    expect(sameUser).toMatchObject({
      ok: false,
      code: "ALREADY_DELIVERED",
    });
    expect(await onlyHandover()).toEqual(before);
  });

  it("passagem já confirmada também recusa com ALREADY_DELIVERED", async () => {
    const { sector, turno, ref, operatorBia, operatorAna } = await world();
    await insertHandover(db, {
      sectorId: sector.id,
      shiftId: turno.id,
      operationalDate: DAY,
      status: "confirmed",
      deliveredBy: operatorAna.userId,
      deliveredAt: spDate(DAY, "13:50"),
      confirmedBy: operatorBia.userId,
    });

    const result = await deliverHandover(db, operatorBia, ref, NOW);

    expect(result).toEqual({
      ok: false,
      code: "ALREADY_DELIVERED",
      message: "Esta passagem já foi entregue por Ana Teste às 13:50.",
    });
  });

  it("admin entrega a passagem de qualquer setor", async () => {
    const { ref, admin } = await world();

    const result = await deliverHandover(db, admin, ref, NOW);

    expect(result).toMatchObject({ ok: true });
    expect((await onlyHandover()).deliveredBy).toBe(admin.userId);
  });

  it("operador de outro setor: NOT_FOUND, nada criado", async () => {
    const { ref } = await world();
    const otherSector = await insertSector(db, "Outro");
    const stranger = authzOf({ role: "operator", sectorId: otherSector.id });

    const result = await deliverHandover(db, stranger, ref, NOW);

    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await handoverCount()).toBe(0);
  });

  it("criação recusada (data futura, 32 dias, turno inativo, setor inativo) não deixa rascunho", async () => {
    const { sector, turno, ref, operatorAna } = await world();

    for (const operationalDate of ["2026-11-22", "2026-10-20"]) {
      expect(
        await deliverHandover(
          db,
          operatorAna,
          { ...ref, operationalDate },
          NOW,
        ),
      ).toMatchObject({ ok: false, code: "DATE_OUT_OF_RANGE" });
    }
    await db.update(shift).set({ active: false }).where(eq(shift.id, turno.id));
    expect(await deliverHandover(db, operatorAna, ref, NOW)).toMatchObject({
      ok: false,
      code: "SHIFT_INACTIVE",
    });
    await db.update(shift).set({ active: true }).where(eq(shift.id, turno.id));
    await client.query("update sector set active = false where id = $1", [
      sector.id,
    ]);
    expect(await deliverHandover(db, operatorAna, ref, NOW)).toMatchObject({
      ok: false,
      code: "SECTOR_INACTIVE",
    });
    expect(await handoverCount()).toBe(0);
  });

  it("rascunho existente de setor inativo: SECTOR_INACTIVE e continua rascunho (P26)", async () => {
    const { sector, turno, ref, operatorAna } = await world();
    await insertHandover(db, {
      sectorId: sector.id,
      shiftId: turno.id,
      operationalDate: DAY,
    });
    await client.query("update sector set active = false where id = $1", [
      sector.id,
    ]);

    const result = await deliverHandover(db, operatorAna, ref, NOW);

    expect(result).toMatchObject({ ok: false, code: "SECTOR_INACTIVE" });
    expect((await onlyHandover()).status).toBe("draft");
  });

  it("rascunho existente de turno inativo continua entregável", async () => {
    const { sector, turno, ref, operatorAna } = await world();
    await insertHandover(db, {
      sectorId: sector.id,
      shiftId: turno.id,
      operationalDate: DAY,
    });
    await db.update(shift).set({ active: false }).where(eq(shift.id, turno.id));

    const result = await deliverHandover(db, operatorAna, ref, NOW);

    expect(result).toMatchObject({ ok: true });
    expect((await onlyHandover()).status).toBe("delivered");
  });

  it("depois de entregue, o snapshot do turno e dos itens não acompanha renomeação", async () => {
    const { turno, ref, operatorAna, rede } = await world();
    await deliverHandover(db, operatorAna, ref, NOW);

    await db
      .update(shift)
      .set({ name: "Turno renomeado" })
      .where(eq(shift.id, turno.id));
    await db
      .update(item)
      .set({ name: "Rede renomeada" })
      .where(eq(item.id, rede.id));

    expect((await onlyHandover()).shiftNameSnapshot).toBe("Manhã");
    const [line] = await db
      .select()
      .from(handoverItem)
      .where(and(eq(handoverItem.itemId, rede.id)));
    expect(line?.itemNameSnapshot).toBe("Rede de proteção");
  });

  it("linhas de uma passagem já existente não são duplicadas (a PK protege)", async () => {
    const { sector, turno, ref, operatorAna, rede } = await world();
    const draft = await insertHandover(db, {
      sectorId: sector.id,
      shiftId: turno.id,
      operationalDate: DAY,
    });
    await insertHandoverItem(db, {
      handoverId: draft.id,
      itemId: rede.id,
      quantity: 9,
    });

    await deliverHandover(db, operatorAna, ref, NOW);

    const all = await lines();
    expect(all).toHaveLength(2);
    expect(all.find((line) => line.itemId === rede.id)?.quantity).toBe(9);
  });
});
```

- [ ] **Step 18: Ver falhar**

Run: `bun run test -- src/features/handovers/deliver.test.ts`
Expected: FAIL com `Error: Cannot find module './deliver' imported from …/deliver.test.ts`.

- [ ] **Step 19: Implementar `deliverHandover`**

Crie `src/features/handovers/deliver.ts`:

```ts
import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { item, shift } from "@/db/schema/catalog";
import { handover, handoverItem } from "@/db/schema/handovers";
import type { Db } from "@/db/types";
import { notFoundMessage } from "@/features/admin/messages";
import { type AdminResult, fail, ok } from "@/features/admin/result";
import type { Authz } from "@/features/authz/authz";

import { handoverCapabilities } from "./access";
import {
  ensureHandover,
  type HandoverRow,
  lockHandover,
  runInTransaction,
  userNames,
} from "./loaders";
import {
  alreadyDeliveredMessage,
  HANDOVER_NOT_FOUND_MESSAGE,
} from "./messages";
import type { HandoverRef } from "./types";

export type Delivered = { id: string; deliveredAt: Date };

// "Esta passagem já foi entregue por {nome} às {HH:mm}." a partir da linha atual.
async function alreadyDelivered(tx: Db, row: HandoverRow) {
  const names = await userNames(tx, row.deliveredBy ? [row.deliveredBy] : []);
  const who = row.deliveredBy ? (names.get(row.deliveredBy) ?? "alguém") : "";
  const at = row.deliveredAt ?? row.updatedAt;
  return fail("ALREADY_DELIVERED", alreadyDeliveredMessage(who, at));
}

/**
 * Entregar o turno (F3-5), numa transação: cria o rascunho se não existir,
 * trava a linha, passa de `draft` para `delivered` só se ainda for `draft`,
 * completa com `0` os itens ATIVOS do setor que faltam e grava o snapshot
 * (nome, unidade, tipo) de TODAS as linhas. Linha de item desativado depois
 * fica (o dado digitado não se perde). Sem diálogo e sem bloqueio: entregar
 * tudo zerado e sem texto é permitido ("nada aconteceu" também é informação).
 */
export async function deliverHandover(
  db: Db,
  actor: Authz,
  ref: HandoverRef,
  now: Date,
): Promise<AdminResult<Delivered>> {
  return runInTransaction(db, async (tx) => {
    const ensured = await ensureHandover(tx, actor, ref, now);
    if (!ensured.ok) return ensured;
    const { row } = ensured;

    if (row.status !== "draft") return alreadyDelivered(tx, row);
    if (!handoverCapabilities(actor, row).canDeliver) {
      return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);
    }

    const [target] = await tx
      .select({ name: shift.name })
      .from(shift)
      .where(eq(shift.id, row.shiftId));
    if (!target) return fail("NOT_FOUND", notFoundMessage("turno"));

    const updated = await tx
      .update(handover)
      .set({
        status: "delivered",
        deliveredBy: actor.userId,
        deliveredAt: now,
        shiftNameSnapshot: target.name,
        updatedAt: now,
        updatedBy: actor.userId,
      })
      .where(and(eq(handover.id, row.id), eq(handover.status, "draft")))
      .returning({ id: handover.id });
    if (updated.length === 0) {
      // Outra entrega chegou entre a leitura e a escrita: diz quem ganhou.
      const current = await lockHandover(tx, row.id);
      if (!current) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);
      return alreadyDelivered(tx, current);
    }

    await tx.execute(sql`
      insert into handover_item (handover_id, item_id, quantity)
      select ${row.id}, ${item.id}, 0
      from ${item}
      where ${item.sectorId} = ${row.sectorId} and ${item.active}
      on conflict do nothing
    `);
    await tx
      .update(handoverItem)
      .set({
        itemNameSnapshot: item.name,
        itemUnitSnapshot: item.unit,
        itemKindSnapshot: item.kind,
      })
      .from(item)
      .where(
        and(
          eq(item.id, handoverItem.itemId),
          eq(handoverItem.handoverId, row.id),
        ),
      );

    return ok({ id: row.id, deliveredAt: now });
  });
}
```

- [ ] **Step 20: Ver passar, verificar tudo da tarefa e commitar a Parte C**

Run: `bunx biome check --write src/features/handovers/deliver.ts src/features/handovers/deliver.test.ts && bun run test -- src/features/handovers/deliver.test.ts src/features/handovers/draft.test.ts && bun run check-types && bun run lint`
Expected: PASS (16 + 25 testes); `check-types` e `lint` sem erro.

Conferência final da tarefa: `bun run test -- src/features/handovers/loaders.test.ts src/features/handovers/targets.test.ts src/features/handovers/formState.test.ts src/features/handovers/draft.test.ts src/features/handovers/deliver.test.ts && bun run test`
Expected: PASS (16 + 5 + 15 + 25 + 16 = 77 testes nos cinco arquivos) e depois a suíte inteira verde (se aparecer "Timeout waiting for worker to respond", rode de novo com `--maxWorkers=4`).

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-4-draft-deliver.txt` e rode:
```bash
git add src/features/handovers/draft.ts src/features/handovers/draft.test.ts src/features/handovers/deliver.ts src/features/handovers/deliver.test.ts
git commit -F .git/sdd/msg-task-4-draft-deliver.txt
```
Mensagem:
```text
feat(passagem): salvar campo (rascunho nasce no 1º salvamento) e entregar turno

saveHandoverField faz upsert pela tripla setor + turno + dia, respeita
quem edita em cada estado (rascunho, entregue, confirmada trancada até
para o admin) e só valida turno e data ao criar. deliverHandover entrega
numa transação, completa os itens ativos com 0 e grava os snapshots; a
segunda entrega devolve ALREADY_DELIVERED com nome e hora.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 5: Recebimento: confirmar, resumo e correção com motivo

**Files:**
- Create: `src/features/handovers/confirm.ts`
- Create: `src/features/handovers/summary.ts`
- Create: `src/features/handovers/correction.ts`
- Test: `src/features/handovers/confirm.test.ts`
- Test: `src/features/handovers/summary.test.ts`
- Test: `src/features/handovers/correction.test.ts`

**Interfaces:**
- Consumes (Tarefa 1): tabelas `handover`, `handoverItem`, `handoverCorrection` e tipos `HandoverStatus`, `CorrectionField` de `@/db/schema/handovers`; fixtures `insertHandover`, `insertHandoverItem`, `insertHandoverCorrection`, `insertSector`, `insertShift`, `insertItem`, `insertUser` de `test/fixtures.ts`; `spDate(isoDate: string, hhmm: string): Date` de `test/clock.ts`; `createTestDb`/`resetDb`/`TestDb` de `test/db.ts`; `sqlErrorOf` de `test/sqlError.ts` (já existe).
- Consumes (Tarefa 2): `handoverCapabilities(actor: Authz, handover: { status; sectorId; deliveredBy }): HandoverCapabilities` e `HandoverCapabilities` de `./access`; `diffHandover(current: HandoverValues, next: HandoverValues): CorrectionChange[]` de `./diff`; `codePointLength`, `normalizeFreeText`, `normalizeOptionalText`, `normalizeReason`, `normalizeItemNote` de `./fieldRules`; limites `CONFIRMATION_NOTE_MAX_LENGTH`, `ITEM_NOTE_MAX_LENGTH`, `MAX_QUANTITY`, `REASON_MAX_LENGTH`, `TEXT_MAX_LENGTH` de `./limits`; mensagens `HANDOVER_NOT_FOUND_MESSAGE`, `NOT_DELIVERED_MESSAGE`, `OWN_HANDOVER_MESSAGE`, `NOT_CONFIRMED_MESSAGE`, `CORRECTION_FORBIDDEN_MESSAGE`, `NO_CHANGES_MESSAGE`, `REASON_REQUIRED_MESSAGE`, `REASON_TOO_LONG_MESSAGE`, `CONFIRMATION_NOTE_TOO_LONG_MESSAGE`, `QUANTITY_MESSAGE`, `TEXT_TOO_LONG_MESSAGE`, `NOTE_TOO_LONG_MESSAGE`, `DUPLICATE_ITEM_MESSAGE`, `alreadyConfirmedMessage(name, at)` de `./messages`; tipo `HandoverRef` de `./types`.
- Consumes (Tarefa 3): os 10 códigos novos em `AdminErrorCode` (`FORBIDDEN`, `NOT_DELIVERED`, `ALREADY_CONFIRMED`, `OWN_HANDOVER`, `NOT_CONFIRMED`, `NO_CHANGES`…) de `@/features/admin/result`.
- Consumes (Tarefa 4): `findHandoverById(db: Db, actor: Authz, id: string): Promise<HandoverRow | null>`, `lockHandover(tx: Db, id: string): Promise<HandoverRow | null>`, `userNames(db: Db, ids: readonly string[]): Promise<Map<string, string>>` e o tipo `HandoverRow` de `./loaders`.
- Produces:
  - `confirmHandover(db: Db, actor: Authz, input: { id: string; note: string | null }, now: Date): Promise<AdminResult<Confirmed>>` e `type Confirmed = { confirmedAt: Date }` (`./confirm`)
  - `getHandoverSummary(db: Db, actor: Authz, id: string): Promise<AdminResult<{ summary: HandoverSummary }>>` e os tipos `SummaryItem`, `SummaryCorrection`, `HandoverSummary` (`./summary`), exatamente como no contrato
  - `correctHandover(db: Db, actor: Authz, input: CorrectionInput, now: Date): Promise<AdminResult<{ changes: number }>>` e `type CorrectionInput = { id: string; reason: string; occurrencesText: string; nextShiftText: string; items: { itemId: string; quantity: number; note: string }[] }` (`./correction`)
- Chaves de `fieldErrors` que o domínio devolve (a Tarefa 3, ao montar os schemas, e as Tarefas 9 e 11, ao mostrar erro no campo, usam estas): confirmar → `note`; corrigir → `reason`, `occurrencesText`, `nextShiftText`, `items`.

> Nota de execução: os arquivos `.test.ts` e `.ts` deste plano têm texto acentuado. Crie-os com a ferramenta Write (heredoc com acento falha na ferramenta Bash).

#### Parte A: `confirmHandover`

- [ ] **Step 1: Write the failing test**

Crie `src/features/handovers/confirm.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { handover } from "@/db/schema/handovers";
import type { Authz } from "@/features/authz/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { sqlErrorOf } from "../../../test/sqlError";
import { confirmHandover } from "./confirm";

const NIL_ID = "00000000-0000-4000-8000-000000000000";
const NOW = spDate("2026-11-20", "14:30");

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
});

function operator(id: string, name: string, sectorId: string): Authz {
  return {
    userId: id,
    name,
    email: `${id}@example.test`,
    role: "operator",
    sectorId,
  };
}

function admin(id: string, name: string): Authz {
  return {
    userId: id,
    name,
    email: `${id}@example.test`,
    role: "admin",
    sectorId: null,
  };
}

// Setor ULD com Ana (entrega), Bia (confirma) e uma passagem entregue pela
// Ana; Caio é de outro setor; "Admin Teste" é administrador.
async function seed(status: "draft" | "delivered" = "delivered") {
  const uld = await insertSector(db, "ULD");
  const other = await insertSector(db, "Outro");
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Bia Teste",
  });
  const caio = await insertUser(db, {
    role: "operator",
    sectorId: other.id,
    name: "Caio Teste",
  });
  const root = await insertUser(db, {
    role: "admin",
    sectorId: null,
    name: "Admin Teste",
  });
  const turno = await insertShift(db, { sectorId: uld.id, name: "Manhã" });
  const passagem = await insertHandover(db, {
    sectorId: uld.id,
    shiftId: turno.id,
    status,
    ...(status === "delivered" ? { deliveredBy: ana.id } : {}),
  });
  return {
    uld,
    other,
    ana: operator(ana.id, "Ana Teste", uld.id),
    bia: operator(bia.id, "Bia Teste", uld.id),
    caio: operator(caio.id, "Caio Teste", other.id),
    root: admin(root.id, "Admin Teste"),
    id: passagem.id,
  };
}

async function rowOf(id: string) {
  const [row] = await db.select().from(handover).where(eq(handover.id, id));
  if (!row) throw new Error("passagem sumiu no teste");
  return row;
}

describe("confirmHandover", () => {
  it("outra pessoa do setor confirma: grava quem, quando e a observação", async () => {
    const { bia, id } = await seed();

    const result = await confirmHandover(
      db,
      bia,
      { id, note: "Tudo conferido" },
      NOW,
    );

    expect(result).toEqual({ ok: true, confirmedAt: NOW });
    const row = await rowOf(id);
    expect(row.status).toBe("confirmed");
    expect(row.confirmedBy).toBe(bia.userId);
    expect(row.confirmedAt).toEqual(NOW);
    expect(row.confirmationNote).toBe("Tudo conferido");
  });

  it("setor inativo é só leitura: SECTOR_INACTIVE e nada muda (P26)", async () => {
    const { uld, bia, id } = await seed();
    await client.query("update sector set active = false where id = $1", [
      uld.id,
    ]);

    const result = await confirmHandover(db, bia, { id, note: null }, NOW);

    expect(result).toEqual({
      ok: false,
      code: "SECTOR_INACTIVE",
      message:
        "Este setor está inativo. Peça a um administrador para reativá-lo.",
    });
    expect((await rowOf(id)).status).toBe("delivered");
  });

  it("observação vazia, só espaços ou null vira null", async () => {
    const first = await seed();
    await confirmHandover(db, first.bia, { id: first.id, note: "   " }, NOW);
    expect((await rowOf(first.id)).confirmationNote).toBeNull();

    await resetDb(client);
    const second = await seed();
    await confirmHandover(db, second.bia, { id: second.id, note: null }, NOW);
    expect((await rowOf(second.id)).confirmationNote).toBeNull();
  });

  it("observação de 501 caracteres é recusada e nada muda", async () => {
    const { bia, id } = await seed();

    const result = await confirmHandover(
      db,
      bia,
      { id, note: "a".repeat(501) },
      NOW,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { note: "A observação pode ter no máximo 500 caracteres." },
    });
    expect((await rowOf(id)).status).toBe("delivered");
  });

  it("observação de 500 pontos de código (emoji) passa", async () => {
    const { bia, id } = await seed();

    const result = await confirmHandover(
      db,
      bia,
      { id, note: "😀".repeat(500) },
      NOW,
    );

    expect(result.ok).toBe(true);
  });

  it("quem entregou não confirma: OWN_HANDOVER e a passagem continua entregue", async () => {
    const { ana, id } = await seed();

    const result = await confirmHandover(db, ana, { id, note: null }, NOW);

    expect(result).toEqual({
      ok: false,
      code: "OWN_HANDOVER",
      message:
        "Quem entregou o turno não pode confirmar o recebimento. Peça a outra pessoa do setor.",
    });
    const row = await rowOf(id);
    expect(row.status).toBe("delivered");
    expect(row.confirmedBy).toBeNull();
  });

  it("a segunda confirmação diz quem confirmou e a hora, e não muda nada", async () => {
    const { bia, root, id } = await seed();
    await confirmHandover(db, bia, { id, note: "primeira" }, NOW);

    const second = await confirmHandover(
      db,
      root,
      { id, note: "segunda" },
      spDate("2026-11-20", "15:00"),
    );

    expect(second).toEqual({
      ok: false,
      code: "ALREADY_CONFIRMED",
      message: "Esta passagem já foi confirmada por Bia Teste às 14:30.",
    });
    const row = await rowOf(id);
    expect(row.confirmedBy).toBe(bia.userId);
    expect(row.confirmationNote).toBe("primeira");
  });

  it("quem entregou, numa passagem já confirmada, recebe ALREADY_CONFIRMED (estado vence a regra de autoria)", async () => {
    const { ana, bia, id } = await seed();
    await confirmHandover(db, bia, { id, note: null }, NOW);

    const result = await confirmHandover(db, ana, { id, note: null }, NOW);

    expect(result).toMatchObject({ ok: false, code: "ALREADY_CONFIRMED" });
  });

  it("rascunho: NOT_DELIVERED", async () => {
    const { bia, id } = await seed("draft");

    const result = await confirmHandover(db, bia, { id, note: null }, NOW);

    expect(result).toEqual({
      ok: false,
      code: "NOT_DELIVERED",
      message: "Esta passagem ainda não foi entregue.",
    });
    expect((await rowOf(id)).status).toBe("draft");
  });

  it("operador de outro setor recebe NOT_FOUND, igual a um id que não existe", async () => {
    const { caio, id } = await seed();

    const foreign = await confirmHandover(db, caio, { id, note: null }, NOW);
    const missing = await confirmHandover(
      db,
      caio,
      { id: NIL_ID, note: null },
      NOW,
    );

    expect(foreign).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Passagem não encontrada. Atualize a página.",
    });
    expect(missing).toEqual(foreign);
    expect((await rowOf(id)).status).toBe("delivered");
  });

  it("administrador confirma a passagem de qualquer setor", async () => {
    const { root, id } = await seed();

    const result = await confirmHandover(db, root, { id, note: null }, NOW);

    expect(result.ok).toBe(true);
    expect((await rowOf(id)).confirmedBy).toBe(root.userId);
  });

  it("administrador que entregou também não confirma a própria passagem", async () => {
    const uld = await insertSector(db, "ULD");
    const root = await insertUser(db, {
      role: "admin",
      sectorId: null,
      name: "Admin Teste",
    });
    const turno = await insertShift(db, { sectorId: uld.id });
    const passagem = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: root.id,
    });

    const result = await confirmHandover(
      db,
      admin(root.id, "Admin Teste"),
      { id: passagem.id, note: null },
      NOW,
    );

    expect(result).toMatchObject({ ok: false, code: "OWN_HANDOVER" });
  });

  it("o banco recusa o bypass: UPDATE direto com confirmed_by = delivered_by", async () => {
    const { ana, id } = await seed();

    const error = await sqlErrorOf(
      db
        .update(handover)
        .set({ status: "confirmed", confirmedBy: ana.userId, confirmedAt: NOW })
        .where(eq(handover.id, id)),
    );

    expect(error).toEqual({
      code: "23514",
      constraint: "handover_confirmer_ne_deliverer",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/features/handovers/confirm.test.ts`
Expected: FAIL com `Error: Cannot find module './confirm' imported from …/src/features/handovers/confirm.test.ts` (nenhum teste roda).

- [ ] **Step 3: Write minimal implementation**

Crie `src/features/handovers/confirm.ts`:

```ts
import "server-only";

import { and, eq, ne } from "drizzle-orm";

import { handover } from "@/db/schema/handovers";
import type { Db } from "@/db/types";
import {
  type AdminResult,
  fail,
  INVALID_INPUT_MESSAGE,
  ok,
} from "@/features/admin/result";
import type { Authz } from "@/features/authz/authz";

import { codePointLength, normalizeOptionalText } from "./fieldRules";
import { CONFIRMATION_NOTE_MAX_LENGTH } from "./limits";
import {
  findHandoverById,
  type HandoverRow,
  loadSector,
  lockHandover,
  userNames,
} from "./loaders";
import {
  alreadyConfirmedMessage,
  CONFIRMATION_NOTE_TOO_LONG_MESSAGE,
  HANDOVER_NOT_FOUND_MESSAGE,
  NOT_DELIVERED_MESSAGE,
  OWN_HANDOVER_MESSAGE,
  SECTOR_INACTIVE_HANDOVER_MESSAGE,
} from "./messages";

export type Confirmed = { confirmedAt: Date };

// O estado da linha travada decide a mensagem. Com a linha travada (FOR
// UPDATE) a corrida perdida cai aqui com o estado do vencedor.
async function refusalFor(
  tx: Db,
  actor: Authz,
  row: HandoverRow,
): Promise<AdminResult<Confirmed> | null> {
  if (row.status === "draft") {
    return fail("NOT_DELIVERED", NOT_DELIVERED_MESSAGE);
  }
  if (row.status === "confirmed") {
    const names = await userNames(
      tx,
      row.confirmedBy === null ? [] : [row.confirmedBy],
    );
    const who =
      (row.confirmedBy && names.get(row.confirmedBy)) || "outra pessoa";
    return fail(
      "ALREADY_CONFIRMED",
      alreadyConfirmedMessage(who, row.confirmedAt ?? new Date(0)),
    );
  }
  if (row.deliveredBy === actor.userId) {
    return fail("OWN_HANDOVER", OWN_HANDOVER_MESSAGE);
  }
  return null;
}

export async function confirmHandover(
  db: Db,
  actor: Authz,
  input: { id: string; note: string | null },
  now: Date,
): Promise<AdminResult<Confirmed>> {
  const note = input.note === null ? null : normalizeOptionalText(input.note);
  if (note !== null && codePointLength(note) > CONFIRMATION_NOTE_MAX_LENGTH) {
    return fail("INVALID_INPUT", INVALID_INPUT_MESSAGE, {
      note: CONFIRMATION_NOTE_TOO_LONG_MESSAGE,
    });
  }

  return db.transaction(async (tx) => {
    const visible = await findHandoverById(tx, actor, input.id);
    if (!visible) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);

    // Setor inativo é só leitura (P26).
    const owner = await loadSector(tx, actor, visible.sectorId);
    if (!owner) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);
    if (!owner.active) {
      return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_HANDOVER_MESSAGE);
    }

    const row = await lockHandover(tx, input.id);
    if (!row) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);

    const refusal = await refusalFor(tx, actor, row);
    if (refusal) return refusal;

    const updated = await tx
      .update(handover)
      .set({
        status: "confirmed",
        confirmedBy: actor.userId,
        confirmedAt: now,
        confirmationNote: note,
      })
      .where(
        and(
          eq(handover.id, input.id),
          eq(handover.status, "delivered"),
          ne(handover.deliveredBy, actor.userId),
        ),
      )
      .returning({ id: handover.id });
    if (updated.length === 0) {
      // Defesa em profundidade: com a linha travada isto não deveria ocorrer.
      const current = await lockHandover(tx, input.id);
      const refused = current ? await refusalFor(tx, actor, current) : null;
      return refused ?? fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);
    }
    return ok({ confirmedAt: now });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx biome check --write src/features/handovers && bun run test -- src/features/handovers/confirm.test.ts`
Expected: PASS (13 testes).

#### Parte B: `getHandoverSummary`

- [ ] **Step 5: Write the failing test**

Crie `src/features/handovers/summary.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { item } from "@/db/schema/catalog";
import type { Authz } from "@/features/authz/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverCorrection,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { getHandoverSummary } from "./summary";

const NIL_ID = "00000000-0000-4000-8000-000000000000";

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
});

function operator(id: string, name: string, sectorId: string): Authz {
  return {
    userId: id,
    name,
    email: `${id}@example.test`,
    role: "operator",
    sectorId,
  };
}

async function seed() {
  const uld = await insertSector(db, "ULD");
  const other = await insertSector(db, "Outro");
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Bia Teste",
  });
  const caio = await insertUser(db, {
    role: "operator",
    sectorId: other.id,
    name: "Caio Teste",
  });
  const root = await insertUser(db, {
    role: "admin",
    sectorId: null,
    name: "Admin Teste",
  });
  const turno = await insertShift(db, { sectorId: uld.id, name: "Manhã" });
  return {
    uld,
    ana,
    bia,
    root,
    turno,
    anaAuthz: operator(ana.id, "Ana Teste", uld.id),
    biaAuthz: operator(bia.id, "Bia Teste", uld.id),
    caioAuthz: operator(caio.id, "Caio Teste", other.id),
  };
}

async function mustSummary(actor: Authz, id: string) {
  const result = await getHandoverSummary(db, actor, id);
  if (!result.ok) throw new Error(`resumo falhou: ${result.message}`);
  return result.summary;
}

describe("getHandoverSummary", () => {
  it("destaca valor diferente de zero ou observação e recolhe os zerados", async () => {
    const { uld, ana, turno, biaAuthz } = await seed();
    const redes = await insertItem(db, {
      sectorId: uld.id,
      name: "Redes danificadas",
      unit: "rede",
      kind: "control",
    });
    const cabos = await insertItem(db, {
      sectorId: uld.id,
      name: "Cabos soltos",
      kind: "control",
    });
    const lacres = await insertItem(db, {
      sectorId: uld.id,
      name: "Lacres rompidos",
      kind: "control",
    });
    const rolos = await insertItem(db, {
      sectorId: uld.id,
      name: "Rolos de fita",
      unit: "rolo",
      kind: "stock",
    });
    const paletes = await insertItem(db, {
      sectorId: uld.id,
      name: "Paletes",
      kind: "stock",
    });
    const passagem = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: ana.id,
      occurrencesText: "Chuva forte às 10h.",
      nextShiftText: "Conferir a rede 7.",
    });
    for (const [line, quantity, note] of [
      [redes, 3, null],
      [cabos, 0, null],
      [lacres, 0, "Dois lacres no chão, já recolhidos"],
      [rolos, 12, null],
      [paletes, 0, null],
    ] as const) {
      await insertHandoverItem(db, {
        handoverId: passagem.id,
        itemId: line.id,
        quantity,
        note,
        snapshot: true,
      });
    }

    const summary = await mustSummary(biaAuthz, passagem.id);

    expect(summary.highlighted.controls).toEqual([
      {
        itemId: redes.id,
        name: "Redes danificadas",
        unit: "rede",
        kind: "control",
        quantity: 3,
        note: null,
      },
      {
        itemId: lacres.id,
        name: "Lacres rompidos",
        unit: "unidade",
        kind: "control",
        quantity: 0,
        note: "Dois lacres no chão, já recolhidos",
      },
    ]);
    expect(summary.highlighted.stock.map((line) => line.name)).toEqual([
      "Rolos de fita",
    ]);
    expect(summary.zeroed).toEqual({
      count: 2,
      names: ["Cabos soltos", "Paletes"],
    });
    expect(summary.nextShiftText).toBe("Conferir a rede 7.");
    expect(summary.occurrencesText).toBe("Chuva forte às 10h.");
  });

  it("passagem sem nenhuma linha de item: tudo vazio, sem erro", async () => {
    const { uld, ana, turno, biaAuthz } = await seed();
    const passagem = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: ana.id,
    });

    const summary = await mustSummary(biaAuthz, passagem.id);

    expect(summary.highlighted).toEqual({ controls: [], stock: [] });
    expect(summary.zeroed).toEqual({ count: 0, names: [] });
    expect(summary.corrections).toEqual([]);
    expect(summary.corrected).toBe(false);
  });

  it("o snapshot vence a renomeação posterior do item e do turno", async () => {
    const { uld, ana, turno, biaAuthz } = await seed();
    const redes = await insertItem(db, {
      sectorId: uld.id,
      name: "Redes danificadas",
      unit: "rede",
    });
    const passagem = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: ana.id,
      shiftNameSnapshot: "Manhã",
    });
    await insertHandoverItem(db, {
      handoverId: passagem.id,
      itemId: redes.id,
      quantity: 2,
      snapshot: true,
    });
    await db
      .update(item)
      .set({ name: "Nome novo", unit: "peça", kind: "stock" })
      .where(eq(item.id, redes.id));

    const summary = await mustSummary(biaAuthz, passagem.id);

    expect(summary.highlighted.controls).toHaveLength(1);
    expect(summary.highlighted.stock).toHaveLength(0);
    expect(summary.highlighted.controls[0]).toMatchObject({
      name: "Redes danificadas",
      unit: "rede",
      kind: "control",
    });
    expect(summary.shiftName).toBe("Manhã");
  });

  it("sem snapshot (rascunho) usa o cadastro vivo; o nome do turno vem do cadastro", async () => {
    const { uld, turno, biaAuthz } = await seed();
    const redes = await insertItem(db, {
      sectorId: uld.id,
      name: "Redes danificadas",
      unit: "rede",
    });
    const passagem = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
    });
    await insertHandoverItem(db, {
      handoverId: passagem.id,
      itemId: redes.id,
      quantity: 4,
    });

    const summary = await mustSummary(biaAuthz, passagem.id);

    expect(summary.status).toBe("draft");
    expect(summary.situation).toBeNull();
    expect(summary.highlighted.controls[0]).toMatchObject({
      name: "Redes danificadas",
      unit: "rede",
      quantity: 4,
    });
    expect(summary.shiftName).toBe("Manhã");
  });

  it("situation: a entregue mais recente é awaiting; a mais antiga não confirmada é unconfirmed", async () => {
    const { uld, ana, root, turno, biaAuthz } = await seed();
    const tarde = await insertShift(db, { sectorId: uld.id, name: "Tarde" });
    const older = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: spDate("2026-11-20", "14:00"),
    });
    const newer = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: tarde.id,
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: spDate("2026-11-20", "22:00"),
    });
    const confirmed = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      operationalDate: "2026-11-19",
      status: "confirmed",
      deliveredBy: ana.id,
      confirmedBy: root.id,
      deliveredAt: spDate("2026-11-19", "14:00"),
      confirmedAt: spDate("2026-11-19", "14:30"),
      confirmationNote: "Recebido",
    });

    expect((await mustSummary(biaAuthz, older.id)).situation).toBe(
      "unconfirmed",
    );
    expect((await mustSummary(biaAuthz, newer.id)).situation).toBe("awaiting");
    const summary = await mustSummary(biaAuthz, confirmed.id);
    expect(summary.situation).toBe("confirmed");
    expect(summary.confirmedByName).toBe("Admin Teste");
    expect(summary.confirmationNote).toBe("Recebido");
    expect(summary.deliveredByName).toBe("Ana Teste");
  });

  it("situation: uma entregue antiga com uma confirmada mais nova no setor é unconfirmed (F3-9b)", async () => {
    const { uld, ana, root, turno, biaAuthz } = await seed();
    const tarde = await insertShift(db, { sectorId: uld.id, name: "Tarde" });
    const older = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: spDate("2026-11-20", "14:00"),
    });
    await insertHandover(db, {
      sectorId: uld.id,
      shiftId: tarde.id,
      status: "confirmed",
      deliveredBy: ana.id,
      confirmedBy: root.id,
      deliveredAt: spDate("2026-11-20", "22:00"),
      confirmedAt: spDate("2026-11-20", "22:30"),
    });

    expect((await mustSummary(biaAuthz, older.id)).situation).toBe(
      "unconfirmed",
    );
  });

  it("uma entregue mais nova de OUTRO setor não rebaixa a passagem para unconfirmed", async () => {
    const { uld, ana, turno, biaAuthz } = await seed();
    const mine = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: spDate("2026-11-20", "14:00"),
    });
    const outro = await insertSector(db, "Outro setor");
    const outroTurno = await insertShift(db, { sectorId: outro.id });
    await insertHandover(db, {
      sectorId: outro.id,
      shiftId: outroTurno.id,
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: spDate("2026-11-20", "23:00"),
    });

    expect((await mustSummary(biaAuthz, mine.id)).situation).toBe("awaiting");
  });

  it("correções em ordem, com o nome do item (snapshot) e quem corrigiu; selo corrected", async () => {
    const { uld, ana, root, turno } = await seed();
    const redes = await insertItem(db, {
      sectorId: uld.id,
      name: "Redes danificadas",
    });
    const passagem = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "confirmed",
      deliveredBy: ana.id,
      confirmedBy: root.id,
    });
    await insertHandoverItem(db, {
      handoverId: passagem.id,
      itemId: redes.id,
      quantity: 5,
      snapshot: true,
    });
    await db
      .update(item)
      .set({ name: "Renomeado" })
      .where(eq(item.id, redes.id));
    const second = await insertHandoverCorrection(db, {
      handoverId: passagem.id,
      field: "next_shift_text",
      oldValue: "a",
      newValue: "b",
      reason: "Segunda",
      correctedBy: root.id,
      correctedAt: spDate("2026-11-21", "10:00"),
    });
    const first = await insertHandoverCorrection(db, {
      handoverId: passagem.id,
      field: "item_quantity",
      itemId: redes.id,
      oldValue: "3",
      newValue: "5",
      reason: "Primeira",
      correctedBy: root.id,
      correctedAt: spDate("2026-11-21", "09:00"),
    });

    const summary = await mustSummary(
      {
        ...operator(root.id, "Admin Teste", uld.id),
        role: "admin",
        sectorId: null,
      },
      passagem.id,
    );

    expect(summary.corrected).toBe(true);
    expect(summary.corrections.map((c) => c.id)).toEqual([first.id, second.id]);
    expect(summary.corrections[0]).toMatchObject({
      field: "item_quantity",
      itemName: "Redes danificadas",
      oldValue: "3",
      newValue: "5",
      reason: "Primeira",
      correctedByName: "Admin Teste",
      correctedAt: spDate("2026-11-21", "09:00"),
    });
    expect(summary.corrections[1]).toMatchObject({
      field: "next_shift_text",
      itemName: null,
    });
  });

  it("devolve as capacidades de quem pediu", async () => {
    const { uld, ana, turno, anaAuthz, biaAuthz } = await seed();
    const passagem = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: ana.id,
    });

    expect((await mustSummary(anaAuthz, passagem.id)).capabilities).toEqual({
      canView: true,
      canEditDirectly: true,
      canDeliver: false,
      canConfirm: false,
      canCorrectWithReason: false,
    });
    expect((await mustSummary(biaAuthz, passagem.id)).capabilities).toEqual({
      canView: true,
      canEditDirectly: false,
      canDeliver: false,
      canConfirm: true,
      canCorrectWithReason: false,
    });
  });

  it("outro setor e id inexistente devolvem NOT_FOUND idêntico", async () => {
    const { uld, ana, turno, caioAuthz } = await seed();
    const passagem = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: turno.id,
      status: "delivered",
      deliveredBy: ana.id,
    });

    const foreign = await getHandoverSummary(db, caioAuthz, passagem.id);
    const missing = await getHandoverSummary(db, caioAuthz, NIL_ID);

    expect(foreign).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Passagem não encontrada. Atualize a página.",
    });
    expect(missing).toEqual(foreign);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bun run test -- src/features/handovers/summary.test.ts`
Expected: FAIL com `Error: Cannot find module './summary' imported from …/src/features/handovers/summary.test.ts`.

- [ ] **Step 7: Write minimal implementation**

Crie `src/features/handovers/summary.ts`:

```ts
import "server-only";

import { and, asc, eq, gt, inArray, or, sql } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { item, shift } from "@/db/schema/catalog";
import {
  type CorrectionField,
  type HandoverStatus,
  handover,
  handoverCorrection,
  handoverItem,
} from "@/db/schema/handovers";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import { type AdminResult, fail, ok } from "@/features/admin/result";
import type { Authz } from "@/features/authz/authz";
import type { ItemKind } from "@/lib/itemKinds";

import { type HandoverCapabilities, handoverCapabilities } from "./access";
import { findHandoverById, type HandoverRow, userNames } from "./loaders";
import { HANDOVER_NOT_FOUND_MESSAGE } from "./messages";
import type { HandoverRef } from "./types";

export type SummaryItem = {
  itemId: string;
  name: string;
  unit: string;
  kind: ItemKind;
  quantity: number;
  note: string | null;
};
export type SummaryCorrection = {
  id: string;
  field: CorrectionField;
  itemName: string | null;
  oldValue: string;
  newValue: string;
  reason: string;
  correctedByName: string;
  correctedAt: Date;
};
export type HandoverSummary = {
  id: string;
  ref: HandoverRef;
  status: HandoverStatus;
  situation: "awaiting" | "confirmed" | "unconfirmed" | null;
  corrected: boolean;
  sectorName: string;
  shiftName: string;
  nextShiftText: string;
  occurrencesText: string;
  highlighted: { controls: SummaryItem[]; stock: SummaryItem[] };
  zeroed: { count: number; names: string[] };
  deliveredByName: string | null;
  deliveredAt: Date | null;
  confirmedByName: string | null;
  confirmedAt: Date | null;
  confirmationNote: string | null;
  corrections: SummaryCorrection[];
  capabilities: HandoverCapabilities;
};

// "awaiting" é a entregue mais recente do setor entre as entregues e as
// confirmadas (a do cartão do Início); uma entregue com outra entregue ou
// confirmada mais nova no mesmo setor é "unconfirmed".
async function situationOf(
  db: Db,
  row: HandoverRow,
): Promise<HandoverSummary["situation"]> {
  if (row.status === "draft") return null;
  if (row.status === "confirmed") return "confirmed";
  if (row.deliveredAt === null) return "awaiting";
  const [newer] = await db
    .select({ id: handover.id })
    .from(handover)
    .where(
      and(
        eq(handover.sectorId, row.sectorId),
        inArray(handover.status, ["delivered", "confirmed"]),
        or(
          gt(handover.deliveredAt, row.deliveredAt),
          and(
            eq(handover.deliveredAt, row.deliveredAt),
            gt(handover.id, row.id),
          ),
        ),
      ),
    )
    .limit(1);
  return newer ? "unconfirmed" : "awaiting";
}

async function loadLines(db: Db, handoverId: string): Promise<SummaryItem[]> {
  const rows = await db
    .select({
      itemId: handoverItem.itemId,
      name: sql<string>`coalesce(${handoverItem.itemNameSnapshot}, ${item.name})`,
      unit: sql<string>`coalesce(${handoverItem.itemUnitSnapshot}, ${item.unit})`,
      kind: sql<ItemKind>`coalesce(${handoverItem.itemKindSnapshot}, ${item.kind})`,
      quantity: handoverItem.quantity,
      note: handoverItem.note,
    })
    .from(handoverItem)
    .innerJoin(item, eq(item.id, handoverItem.itemId))
    .where(eq(handoverItem.handoverId, handoverId))
    .orderBy(asc(item.sortOrder), asc(item.id));
  return rows.map((row) => ({
    ...row,
    note: row.note === null || row.note === "" ? null : row.note,
  }));
}

async function loadCorrections(
  db: Db,
  handoverId: string,
): Promise<SummaryCorrection[]> {
  return db
    .select({
      id: handoverCorrection.id,
      field: handoverCorrection.field,
      itemName: sql<
        string | null
      >`coalesce(${handoverItem.itemNameSnapshot}, ${item.name})`,
      oldValue: handoverCorrection.oldValue,
      newValue: handoverCorrection.newValue,
      reason: handoverCorrection.reason,
      correctedByName: user.name,
      correctedAt: handoverCorrection.correctedAt,
    })
    .from(handoverCorrection)
    .innerJoin(user, eq(user.id, handoverCorrection.correctedBy))
    .leftJoin(item, eq(item.id, handoverCorrection.itemId))
    .leftJoin(
      handoverItem,
      and(
        eq(handoverItem.handoverId, handoverCorrection.handoverId),
        eq(handoverItem.itemId, handoverCorrection.itemId),
      ),
    )
    .where(eq(handoverCorrection.handoverId, handoverId))
    .orderBy(asc(handoverCorrection.correctedAt), asc(handoverCorrection.id));
}

export async function getHandoverSummary(
  db: Db,
  actor: Authz,
  id: string,
): Promise<AdminResult<{ summary: HandoverSummary }>> {
  const row = await findHandoverById(db, actor, id);
  if (!row) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);

  const [names] = await db
    .select({ sectorName: sector.name, shiftName: shift.name })
    .from(sector)
    .innerJoin(shift, eq(shift.id, row.shiftId))
    .where(eq(sector.id, row.sectorId));
  if (!names) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);

  const [lines, corrections, situation, people] = await Promise.all([
    loadLines(db, row.id),
    loadCorrections(db, row.id),
    situationOf(db, row),
    userNames(
      db,
      [row.deliveredBy, row.confirmedBy].filter(
        (value): value is string => value !== null,
      ),
    ),
  ]);

  const shown = (line: SummaryItem) =>
    line.quantity !== 0 || line.note !== null;
  const highlighted = lines.filter(shown);
  const zeroed = lines.filter((line) => !shown(line));

  return ok({
    summary: {
      id: row.id,
      ref: {
        sectorId: row.sectorId,
        shiftId: row.shiftId,
        operationalDate: row.operationalDate,
      },
      status: row.status,
      situation,
      corrected: corrections.length > 0,
      sectorName: names.sectorName,
      shiftName: row.shiftNameSnapshot ?? names.shiftName,
      nextShiftText: row.nextShiftText,
      occurrencesText: row.occurrencesText,
      highlighted: {
        controls: highlighted.filter((line) => line.kind === "control"),
        stock: highlighted.filter((line) => line.kind === "stock"),
      },
      zeroed: { count: zeroed.length, names: zeroed.map((line) => line.name) },
      deliveredByName:
        row.deliveredBy === null ? null : (people.get(row.deliveredBy) ?? null),
      deliveredAt: row.deliveredAt,
      confirmedByName:
        row.confirmedBy === null ? null : (people.get(row.confirmedBy) ?? null),
      confirmedAt: row.confirmedAt,
      confirmationNote: row.confirmationNote,
      corrections,
      capabilities: handoverCapabilities(actor, row),
    },
  });
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bunx biome check --write src/features/handovers && bun run test -- src/features/handovers/summary.test.ts`
Expected: PASS (10 testes).

#### Parte C: `correctHandover`

- [ ] **Step 9: Write the failing test**

Crie `src/features/handovers/correction.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  handover,
  handoverCorrection,
  handoverItem,
} from "@/db/schema/handovers";
import type { Authz } from "@/features/authz/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { type CorrectionInput, correctHandover } from "./correction";
import { getHandoverSummary } from "./summary";

const NIL_ID = "00000000-0000-4000-8000-000000000000";
const NOW = spDate("2026-11-21", "09:00");

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
});

function operator(id: string, name: string, sectorId: string): Authz {
  return {
    userId: id,
    name,
    email: `${id}@example.test`,
    role: "operator",
    sectorId,
  };
}

// Setor ULD: Ana entregou, Bia é operadora, Admin Teste corrige. A passagem
// está confirmada com três itens: redes 3, rolos 10 (obs. "antiga"), cabos 0.
async function seed(status: "confirmed" | "delivered" | "draft" = "confirmed") {
  const uld = await insertSector(db, "ULD");
  const other = await insertSector(db, "Outro");
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Bia Teste",
  });
  const caio = await insertUser(db, {
    role: "operator",
    sectorId: other.id,
    name: "Caio Teste",
  });
  const root = await insertUser(db, {
    role: "admin",
    sectorId: null,
    name: "Admin Teste",
  });
  const turno = await insertShift(db, { sectorId: uld.id, name: "Manhã" });
  const redes = await insertItem(db, {
    sectorId: uld.id,
    name: "Redes danificadas",
    kind: "control",
  });
  const rolos = await insertItem(db, {
    sectorId: uld.id,
    name: "Rolos de fita",
    unit: "rolo",
    kind: "stock",
  });
  const cabos = await insertItem(db, {
    sectorId: uld.id,
    name: "Cabos soltos",
    kind: "control",
  });
  const passagem = await insertHandover(db, {
    sectorId: uld.id,
    shiftId: turno.id,
    status,
    occurrencesText: "Texto A",
    nextShiftText: "Próximo A",
    ...(status === "draft" ? {} : { deliveredBy: ana.id }),
    ...(status === "confirmed" ? { confirmedBy: root.id } : {}),
  });
  await insertHandoverItem(db, {
    handoverId: passagem.id,
    itemId: redes.id,
    quantity: 3,
    snapshot: true,
  });
  await insertHandoverItem(db, {
    handoverId: passagem.id,
    itemId: rolos.id,
    quantity: 10,
    note: "antiga",
    snapshot: true,
  });
  await insertHandoverItem(db, {
    handoverId: passagem.id,
    itemId: cabos.id,
    quantity: 0,
    snapshot: true,
  });
  return {
    uld,
    other,
    redes,
    rolos,
    cabos,
    id: passagem.id,
    ana: operator(ana.id, "Ana Teste", uld.id),
    bia: operator(bia.id, "Bia Teste", uld.id),
    caio: operator(caio.id, "Caio Teste", other.id),
    root: {
      userId: root.id,
      name: "Admin Teste",
      email: "admin@example.test",
      role: "admin",
      sectorId: null,
    } satisfies Authz,
    anaId: ana.id,
    rootId: root.id,
  };
}

type Seeded = Awaited<ReturnType<typeof seed>>;

// Estado igual ao atual (nenhuma mudança) + motivo; cada teste altera o que quer.
function unchanged(seeded: Seeded): CorrectionInput {
  return {
    id: seeded.id,
    reason: "Erro de contagem",
    occurrencesText: "Texto A",
    nextShiftText: "Próximo A",
    items: [
      { itemId: seeded.redes.id, quantity: 3, note: "" },
      { itemId: seeded.rolos.id, quantity: 10, note: "antiga" },
      { itemId: seeded.cabos.id, quantity: 0, note: "" },
    ],
  };
}

async function correctionRows(id: string) {
  return db
    .select()
    .from(handoverCorrection)
    .where(eq(handoverCorrection.handoverId, id))
    .orderBy(asc(handoverCorrection.field), asc(handoverCorrection.id));
}

async function lineOf(id: string, itemId: string) {
  const rows = await db
    .select()
    .from(handoverItem)
    .where(eq(handoverItem.handoverId, id));
  const line = rows.find((row) => row.itemId === itemId);
  if (!line) throw new Error("linha do item sumiu no teste");
  return line;
}

async function handoverRow(id: string) {
  const [row] = await db.select().from(handover).where(eq(handover.id, id));
  if (!row) throw new Error("passagem sumiu no teste");
  return row;
}

describe("correctHandover", () => {
  it("admin corrige texto, quantidade e observação: uma linha por campo, com antigo, novo, motivo, quem e quando", async () => {
    const seeded = await seed();
    const input = unchanged(seeded);
    input.occurrencesText = "Texto B";
    input.items = [
      { itemId: seeded.redes.id, quantity: 5, note: "" },
      { itemId: seeded.rolos.id, quantity: 10, note: "nova" },
      { itemId: seeded.cabos.id, quantity: 0, note: "" },
    ];

    const result = await correctHandover(db, seeded.root, input, NOW);

    expect(result).toEqual({ ok: true, changes: 3 });
    const rows = await correctionRows(seeded.id);
    expect(
      rows.map((row) => ({
        field: row.field,
        itemId: row.itemId,
        oldValue: row.oldValue,
        newValue: row.newValue,
        reason: row.reason,
        correctedBy: row.correctedBy,
        correctedAt: row.correctedAt,
      })),
    ).toEqual([
      {
        field: "item_note",
        itemId: seeded.rolos.id,
        oldValue: "antiga",
        newValue: "nova",
        reason: "Erro de contagem",
        correctedBy: seeded.rootId,
        correctedAt: NOW,
      },
      {
        field: "item_quantity",
        itemId: seeded.redes.id,
        oldValue: "3",
        newValue: "5",
        reason: "Erro de contagem",
        correctedBy: seeded.rootId,
        correctedAt: NOW,
      },
      {
        field: "occurrences_text",
        itemId: null,
        oldValue: "Texto A",
        newValue: "Texto B",
        reason: "Erro de contagem",
        correctedBy: seeded.rootId,
        correctedAt: NOW,
      },
    ]);
  });

  it("os valores vigentes são os corrigidos e a passagem continua confirmada", async () => {
    const seeded = await seed();
    const input = unchanged(seeded);
    input.nextShiftText = "Próximo B";
    input.items = [
      { itemId: seeded.redes.id, quantity: 5, note: "" },
      { itemId: seeded.rolos.id, quantity: 10, note: "" },
      { itemId: seeded.cabos.id, quantity: 0, note: "  cabo   novo " },
    ];

    await correctHandover(db, seeded.root, input, NOW);

    const row = await handoverRow(seeded.id);
    expect(row.status).toBe("confirmed");
    expect(row.confirmedBy).toBe(seeded.rootId);
    expect(row.nextShiftText).toBe("Próximo B");
    expect(row.updatedBy).toBe(seeded.rootId);
    expect(row.updatedAt).toEqual(NOW);
    expect((await lineOf(seeded.id, seeded.redes.id)).quantity).toBe(5);
    expect((await lineOf(seeded.id, seeded.rolos.id)).note).toBeNull();
    expect((await lineOf(seeded.id, seeded.cabos.id)).note).toBe("cabo novo");

    const summary = await getHandoverSummary(db, seeded.root, seeded.id);
    if (!summary.ok) throw new Error("resumo falhou");
    expect(summary.summary.corrected).toBe(true);
    expect(summary.summary.nextShiftText).toBe("Próximo B");
  });

  it("duas correções encadeiam: o valor antigo da segunda é o novo da primeira", async () => {
    const seeded = await seed();
    const first = unchanged(seeded);
    first.items = [
      { itemId: seeded.redes.id, quantity: 5, note: "" },
      { itemId: seeded.rolos.id, quantity: 10, note: "antiga" },
      { itemId: seeded.cabos.id, quantity: 0, note: "" },
    ];
    await correctHandover(db, seeded.root, first, NOW);
    const second = { ...first, reason: "Segunda conferência" };
    second.items = [
      { itemId: seeded.redes.id, quantity: 8, note: "" },
      { itemId: seeded.rolos.id, quantity: 10, note: "antiga" },
      { itemId: seeded.cabos.id, quantity: 0, note: "" },
    ];

    const result = await correctHandover(
      db,
      seeded.root,
      second,
      spDate("2026-11-21", "10:00"),
    );

    expect(result).toEqual({ ok: true, changes: 1 });
    const summary = await getHandoverSummary(db, seeded.root, seeded.id);
    if (!summary.ok) throw new Error("resumo falhou");
    expect(
      summary.summary.corrections.map((row) => [
        row.oldValue,
        row.newValue,
        row.reason,
      ]),
    ).toEqual([
      ["3", "5", "Erro de contagem"],
      ["5", "8", "Segunda conferência"],
    ]);
    expect((await lineOf(seeded.id, seeded.redes.id)).quantity).toBe(8);
  });

  it("nada mudou: NO_CHANGES e nenhuma linha de correção", async () => {
    const seeded = await seed();

    const result = await correctHandover(db, seeded.root, unchanged(seeded), NOW);

    expect(result).toEqual({
      ok: false,
      code: "NO_CHANGES",
      message: "Nada foi alterado. Mude algum campo para registrar a correção.",
    });
    expect(await correctionRows(seeded.id)).toEqual([]);
    expect((await handoverRow(seeded.id)).updatedAt).not.toEqual(NOW);
  });

  it("texto igual depois da normalização (\\r\\n, NFC) e observação nula contra vazia não são mudança", async () => {
    const seeded = await seed();
    await db
      .update(handover)
      .set({ occurrencesText: "Linha 1\nLinha 2 café" })
      .where(eq(handover.id, seeded.id));
    const input = unchanged(seeded);
    input.occurrencesText = "Linha 1\r\nLinha 2 cafe\u{301}";

    const result = await correctHandover(db, seeded.root, input, NOW);

    expect(result).toMatchObject({ ok: false, code: "NO_CHANGES" });
  });

  it("operador do setor, mesmo quem entregou, recebe FORBIDDEN e nada é gravado", async () => {
    const seeded = await seed();
    const input = unchanged(seeded);
    input.occurrencesText = "Texto B";

    for (const actor of [seeded.bia, seeded.ana]) {
      const result = await correctHandover(db, actor, input, NOW);
      expect(result).toEqual({
        ok: false,
        code: "FORBIDDEN",
        message: "Só um administrador pode corrigir uma passagem confirmada.",
      });
    }
    expect(await correctionRows(seeded.id)).toEqual([]);
    expect((await handoverRow(seeded.id)).occurrencesText).toBe("Texto A");
  });

  it("operador de outro setor e id inexistente recebem o mesmo NOT_FOUND", async () => {
    const seeded = await seed();
    const input = unchanged(seeded);
    input.occurrencesText = "Texto B";

    const foreign = await correctHandover(db, seeded.caio, input, NOW);
    const missing = await correctHandover(
      db,
      seeded.caio,
      { ...input, id: NIL_ID },
      NOW,
    );

    expect(foreign).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Passagem não encontrada. Atualize a página.",
    });
    expect(missing).toEqual(foreign);
    expect(await correctionRows(seeded.id)).toEqual([]);
  });

  it("setor inativo é só leitura: SECTOR_INACTIVE e nenhuma correção é gravada (P26)", async () => {
    const seeded = await seed();
    await client.query("update sector set active = false where id = $1", [
      seeded.uld.id,
    ]);
    const input = unchanged(seeded);
    input.occurrencesText = "Texto B";

    const result = await correctHandover(db, seeded.root, input, NOW);

    expect(result).toEqual({
      ok: false,
      code: "SECTOR_INACTIVE",
      message:
        "Este setor está inativo. Peça a um administrador para reativá-lo.",
    });
    expect(await correctionRows(seeded.id)).toEqual([]);
    expect((await handoverRow(seeded.id)).occurrencesText).toBe("Texto A");
  });

  it.each([
    ["vazio", ""],
    ["só espaços", "   \n "],
    ["só tabulação", "\t\t"],
  ])("motivo %s: INVALID_INPUT no campo reason", async (_label, reason) => {
    const seeded = await seed();
    const input = { ...unchanged(seeded), reason, occurrencesText: "Texto B" };

    const result = await correctHandover(db, seeded.root, input, NOW);

    expect(result).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      message: "Confira os campos e tente de novo.",
      fieldErrors: { reason: "Informe o motivo da correção." },
    });
    expect(await correctionRows(seeded.id)).toEqual([]);
  });

  it("motivo de 501 caracteres é recusado; 500 passa e é guardado sem espaços nas pontas", async () => {
    const seeded = await seed();
    const input = { ...unchanged(seeded), occurrencesText: "Texto B" };

    const long = await correctHandover(
      db,
      seeded.root,
      { ...input, reason: "m".repeat(501) },
      NOW,
    );
    expect(long).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { reason: "O motivo pode ter no máximo 500 caracteres." },
    });

    const fits = await correctHandover(
      db,
      seeded.root,
      { ...input, reason: `  ${"m".repeat(500)}  ` },
      NOW,
    );
    expect(fits).toEqual({ ok: true, changes: 1 });
    expect((await correctionRows(seeded.id))[0]?.reason).toBe("m".repeat(500));
  });

  it("ordem das checagens: operador sem motivo recebe FORBIDDEN, não o erro do motivo", async () => {
    const seeded = await seed();

    const result = await correctHandover(
      db,
      seeded.bia,
      { ...unchanged(seeded), reason: "" },
      NOW,
    );

    expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it.each(["delivered", "draft"] as const)(
    "passagem %s: NOT_CONFIRMED e nada muda",
    async (status) => {
      const seeded = await seed(status);
      const input = { ...unchanged(seeded), occurrencesText: "Texto B" };

      const result = await correctHandover(db, seeded.root, input, NOW);

      expect(result).toEqual({
        ok: false,
        code: "NOT_CONFIRMED",
        message:
          "Só passagens confirmadas passam pela correção com motivo. Edite a passagem direto.",
      });
      expect((await handoverRow(seeded.id)).occurrencesText).toBe("Texto A");
      expect(await correctionRows(seeded.id)).toEqual([]);
    },
  );

  it("item que a passagem não tem (ou de outro setor): NOT_FOUND e a transação inteira é recusada", async () => {
    const seeded = await seed();
    const stranger = await insertItem(db, {
      sectorId: seeded.other.id,
      name: "Alheio",
    });
    const input = unchanged(seeded);
    input.occurrencesText = "Texto B";
    input.items = [
      ...input.items,
      { itemId: stranger.id, quantity: 1, note: "" },
    ];

    const result = await correctHandover(db, seeded.root, input, NOW);

    expect(result).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Item não encontrado. Atualize a página.",
    });
    expect((await handoverRow(seeded.id)).occurrencesText).toBe("Texto A");
    expect(await correctionRows(seeded.id)).toEqual([]);
  });

  it.each([
    ["negativa", -1],
    ["decimal", 1.5],
    ["acima do teto", 100_000],
  ])("quantidade %s: INVALID_INPUT em items", async (_label, quantity) => {
    const seeded = await seed();
    const input = unchanged(seeded);
    input.items = [{ itemId: seeded.redes.id, quantity, note: "" }];

    const result = await correctHandover(db, seeded.root, input, NOW);

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { items: "Informe um número inteiro de 0 a 99.999." },
    });
  });

  it("quantidade no teto (99.999) passa", async () => {
    const seeded = await seed();
    const input = unchanged(seeded);
    input.items = [{ itemId: seeded.redes.id, quantity: 99_999, note: "" }];

    const result = await correctHandover(db, seeded.root, input, NOW);

    expect(result).toEqual({ ok: true, changes: 1 });
  });

  it("item repetido, observação longa e texto longo viram INVALID_INPUT", async () => {
    const seeded = await seed();

    const duplicated = unchanged(seeded);
    duplicated.items = [
      { itemId: seeded.redes.id, quantity: 4, note: "" },
      { itemId: seeded.redes.id, quantity: 5, note: "" },
    ];
    expect(await correctHandover(db, seeded.root, duplicated, NOW)).toMatchObject(
      {
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { items: "Item repetido. Atualize a página." },
      },
    );

    const longNote = unchanged(seeded);
    longNote.items = [
      { itemId: seeded.redes.id, quantity: 3, note: "n".repeat(201) },
    ];
    expect(await correctHandover(db, seeded.root, longNote, NOW)).toMatchObject({
      ok: false,
      fieldErrors: {
        items: "A observação pode ter no máximo 200 caracteres.",
      },
    });

    const longText = { ...unchanged(seeded), nextShiftText: "t".repeat(2001) };
    expect(await correctHandover(db, seeded.root, longText, NOW)).toMatchObject({
      ok: false,
      fieldErrors: {
        nextShiftText: "O texto pode ter no máximo 2.000 caracteres.",
      },
    });
    expect(await correctionRows(seeded.id)).toEqual([]);
  });

  it("item ausente do envio fica como está (só os enviados entram no diff)", async () => {
    const seeded = await seed();
    const input = unchanged(seeded);
    input.items = [{ itemId: seeded.redes.id, quantity: 4, note: "" }];

    const result = await correctHandover(db, seeded.root, input, NOW);

    expect(result).toEqual({ ok: true, changes: 1 });
    expect((await lineOf(seeded.id, seeded.rolos.id)).quantity).toBe(10);
  });

  it("limpar o texto grava a correção com novo valor vazio", async () => {
    const seeded = await seed();
    const input = { ...unchanged(seeded), occurrencesText: "" };

    await correctHandover(db, seeded.root, input, NOW);

    const [row] = await correctionRows(seeded.id);
    expect(row).toMatchObject({
      field: "occurrences_text",
      oldValue: "Texto A",
      newValue: "",
    });
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `bun run test -- src/features/handovers/correction.test.ts`
Expected: FAIL com `Error: Cannot find module './correction' imported from …/src/features/handovers/correction.test.ts`.

- [ ] **Step 11: Write minimal implementation**

Crie `src/features/handovers/correction.ts`:

```ts
import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { item } from "@/db/schema/catalog";
import {
  handover,
  handoverCorrection,
  handoverItem,
} from "@/db/schema/handovers";
import type { Db } from "@/db/types";
import { notFoundMessage } from "@/features/admin/messages";
import {
  type AdminResult,
  type FieldErrors,
  fail,
  INVALID_INPUT_MESSAGE,
  ok,
} from "@/features/admin/result";
import { type Authz, isAdmin } from "@/features/authz/authz";

import { diffHandover } from "./diff";
import {
  codePointLength,
  normalizeFreeText,
  normalizeItemNote,
  normalizeReason,
} from "./fieldRules";
import {
  ITEM_NOTE_MAX_LENGTH,
  MAX_QUANTITY,
  REASON_MAX_LENGTH,
  TEXT_MAX_LENGTH,
} from "./limits";
import { findHandoverById, loadSector, lockHandover } from "./loaders";
import {
  CORRECTION_FORBIDDEN_MESSAGE,
  DUPLICATE_ITEM_MESSAGE,
  HANDOVER_NOT_FOUND_MESSAGE,
  NO_CHANGES_MESSAGE,
  NOT_CONFIRMED_MESSAGE,
  NOTE_TOO_LONG_MESSAGE,
  QUANTITY_MESSAGE,
  REASON_REQUIRED_MESSAGE,
  REASON_TOO_LONG_MESSAGE,
  SECTOR_INACTIVE_HANDOVER_MESSAGE,
  TEXT_TOO_LONG_MESSAGE,
} from "./messages";

export type CorrectionInput = {
  id: string;
  reason: string;
  occurrencesText: string;
  nextShiftText: string;
  items: { itemId: string; quantity: number; note: string }[];
};

type CleanInput = {
  reason: string;
  occurrencesText: string;
  nextShiftText: string;
  items: { itemId: string; quantity: number; note: string | null }[];
};

// O domínio revalida tudo: a tela e o schema Zod podem ter sido contornados.
function validate(
  input: CorrectionInput,
): { ok: true; clean: CleanInput } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const reason = normalizeReason(input.reason);
  if (reason === "") errors.reason = REASON_REQUIRED_MESSAGE;
  else if (codePointLength(reason) > REASON_MAX_LENGTH) {
    errors.reason = REASON_TOO_LONG_MESSAGE;
  }

  const occurrencesText = normalizeFreeText(input.occurrencesText);
  if (codePointLength(occurrencesText) > TEXT_MAX_LENGTH) {
    errors.occurrencesText = TEXT_TOO_LONG_MESSAGE;
  }
  const nextShiftText = normalizeFreeText(input.nextShiftText);
  if (codePointLength(nextShiftText) > TEXT_MAX_LENGTH) {
    errors.nextShiftText = TEXT_TOO_LONG_MESSAGE;
  }

  const seen = new Set<string>();
  const items: CleanInput["items"] = [];
  for (const line of input.items) {
    const note = normalizeItemNote(line.note);
    if (seen.has(line.itemId)) errors.items = DUPLICATE_ITEM_MESSAGE;
    else if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 0 ||
      line.quantity > MAX_QUANTITY
    ) {
      errors.items = QUANTITY_MESSAGE;
    } else if (note !== null && codePointLength(note) > ITEM_NOTE_MAX_LENGTH) {
      errors.items = NOTE_TOO_LONG_MESSAGE;
    }
    seen.add(line.itemId);
    items.push({ itemId: line.itemId, quantity: line.quantity, note });
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    clean: { reason, occurrencesText, nextShiftText, items },
  };
}

export async function correctHandover(
  db: Db,
  actor: Authz,
  input: CorrectionInput,
  now: Date,
): Promise<AdminResult<{ changes: number }>> {
  return db.transaction(async (tx) => {
    const visible = await findHandoverById(tx, actor, input.id);
    if (!visible) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);
    if (!isAdmin(actor)) {
      return fail("FORBIDDEN", CORRECTION_FORBIDDEN_MESSAGE);
    }

    // Setor inativo é só leitura (P26).
    const owner = await loadSector(tx, actor, visible.sectorId);
    if (!owner) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);
    if (!owner.active) {
      return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_HANDOVER_MESSAGE);
    }

    const checked = validate(input);
    if (!checked.ok) {
      return fail("INVALID_INPUT", INVALID_INPUT_MESSAGE, checked.errors);
    }
    const { clean } = checked;

    const row = await lockHandover(tx, input.id);
    if (!row) return fail("NOT_FOUND", HANDOVER_NOT_FOUND_MESSAGE);
    if (row.status !== "confirmed") {
      return fail("NOT_CONFIRMED", NOT_CONFIRMED_MESSAGE);
    }

    const current = await tx
      .select({
        itemId: handoverItem.itemId,
        quantity: handoverItem.quantity,
        note: handoverItem.note,
      })
      .from(handoverItem)
      .innerJoin(item, eq(item.id, handoverItem.itemId))
      .where(eq(handoverItem.handoverId, row.id))
      .orderBy(asc(item.sortOrder), asc(item.id));
    const known = new Set(current.map((line) => line.itemId));
    if (clean.items.some((line) => !known.has(line.itemId))) {
      return fail("NOT_FOUND", notFoundMessage("item"));
    }

    const changes = diffHandover(
      {
        occurrencesText: row.occurrencesText,
        nextShiftText: row.nextShiftText,
        items: current,
      },
      clean,
    );
    if (changes.length === 0) return fail("NO_CHANGES", NO_CHANGES_MESSAGE);

    for (const change of changes) {
      if (change.itemId === null) continue;
      const where = and(
        eq(handoverItem.handoverId, row.id),
        eq(handoverItem.itemId, change.itemId),
      );
      if (change.field === "item_quantity") {
        await tx
          .update(handoverItem)
          .set({ quantity: Number(change.newValue) })
          .where(where);
      } else {
        await tx
          .update(handoverItem)
          .set({ note: change.newValue === "" ? null : change.newValue })
          .where(where);
      }
    }
    await tx
      .update(handover)
      .set({
        occurrencesText: clean.occurrencesText,
        nextShiftText: clean.nextShiftText,
        updatedAt: now,
        updatedBy: actor.userId,
      })
      .where(eq(handover.id, row.id));
    await tx.insert(handoverCorrection).values(
      changes.map((change) => ({
        handoverId: row.id,
        field: change.field,
        itemId: change.itemId,
        oldValue: change.oldValue,
        newValue: change.newValue,
        reason: clean.reason,
        correctedBy: actor.userId,
        correctedAt: now,
      })),
    );
    return ok({ changes: changes.length });
  });
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `bunx biome check --write src/features/handovers && bun run test -- src/features/handovers/correction.test.ts`
Expected: PASS (23 testes).

- [ ] **Step 13: Verify the whole task**

Run: `bun run check-types && bun run lint && bun run test -- src/features/handovers`
Expected: `check-types` e `lint` sem erro; os testes do diretório passam (os 3 arquivos desta tarefa somam 46 testes: 13 + 10 + 23). Rode também `bun run test` completo: tudo verde (se aparecer "Failed to start forks worker … Timeout waiting for worker to respond", é falha de infraestrutura do Vitest com a máquina carregada, não de teste: rode de novo).

- [ ] **Step 14: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-5.txt` (texto exato abaixo) e rode:

```bash
git add src/features/handovers/confirm.ts src/features/handovers/confirm.test.ts src/features/handovers/summary.ts src/features/handovers/summary.test.ts src/features/handovers/correction.ts src/features/handovers/correction.test.ts
git commit -F .git/sdd/msg-task-5.txt
```

Mensagem:

```text
feat(passagem): confirmar recebimento, resumo e correção com motivo

confirmHandover (OWN_HANDOVER, ALREADY_CONFIRMED com nome e hora,
NOT_DELIVERED, UPDATE condicional sob FOR UPDATE), getHandoverSummary
(zerados recolhidos, snapshot vence renomeação, situation, correções em
ordem) e correctHandover (só admin, motivo, diff calculado no servidor,
uma linha por campo na mesma transação).

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 6: Leituras: histórico (SQL com "sem passagem") e cartões do Início

**Files:**
- Create: `src/features/handovers/history.ts`
- Create: `src/features/handovers/home.ts`
- Test: `src/features/handovers/history.test.ts`
- Test: `src/features/handovers/history.parity.test.ts`
- Test: `src/features/handovers/home.test.ts`
- Modify: `src/features/admin/overview.ts` (commit separado: P26, passo 12 em diante)
- Modify: `src/features/admin/overview.test.ts` (idem)

**Interfaces:**
- Consumes (Tarefa 1): schema e fixtures como na Tarefa 5, mais `insertShift(db, { …, createdAt?: Date })` (o `createdAt` simula turno antigo) e `spDate`.
- Consumes (Tarefa 2): `HistoryFilters` de `./historyFilters`; `HistorySituation` de `./status`; `SAO_PAULO_TIME_ZONE`, `addDays` de `./saoPaulo`; `hasShiftEnded(operationalDate: string, shift: SuggestableShift, now: Date): boolean` e `suggestShift(shifts: readonly SuggestableShift[], now: Date): HandoverTarget | null` de `./shiftSuggestion`; `codePointLength` de `./fieldRules`; `NEXT_SHIFT_PREVIEW_LENGTH` de `./limits`; `SECTOR_INACTIVE_HANDOVER_MESSAGE` de `./messages`; `HandoverRef`, `SavedMark`, `ShiftChoice` de `./types`.
- Consumes (Tarefa 4): `loadSector(db, actor, sectorId): Promise<SectorRow | null>`, `findHandoverByRef(db, ref): Promise<HandoverRow | null>`, `userNames(db, ids)` de `./loaders`; `listActiveShifts(db, sectorId): Promise<ShiftChoice[]>` de `./targets`.
- Consumes (existentes): `PAGE_SIZE`, `Page<T>`, `resolvePage` de `@/features/admin/pagination`; `notFoundMessage` de `@/features/admin/messages`; `getAdminOverviewCounts` de `src/features/admin/overview.ts`.
- Produces:
  - `listHandoverHistory(db: Db, actor: Authz, input: { filters: HistoryFilters; sectorId: string | null; page: number }, now: Date): Promise<Page<HistoryRow>>` e `type HistoryRow` (`./history`), exatamente como no contrato
  - `getHomeHandovers(db: Db, actor: Authz, sectorId: string, now: Date): Promise<AdminResult<{ home: HomeHandovers }>>` e os tipos `PendingHandover`, `MyShiftState`, `HomeHandovers` (`./home`), exatamente como no contrato
  - `getAdminOverviewCounts` contando `shifts` e `items` só de setores ativos (P26)

> Nota de execução: arquivos com texto acentuado se criam com a ferramenta Write.

#### Parte A: histórico

- [ ] **Step 1: Write the failing test**

Crie `src/features/handovers/history.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { PAGE_SIZE } from "@/features/admin/pagination";
import type { Authz } from "@/features/authz/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverCorrection,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { listHandoverHistory } from "./history";
import type { HistoryFilters } from "./historyFilters";
import { addDays } from "./saoPaulo";

const NOW = spDate("2026-11-21", "14:30");
const OLD = new Date("2026-01-01T12:00:00.000Z");

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
});

function filters(overrides: Partial<HistoryFilters> = {}): HistoryFilters {
  return {
    period: "range",
    from: "2026-11-14",
    to: "2026-11-21",
    shiftId: null,
    situation: "all",
    ...overrides,
  };
}

function operator(id: string, name: string, sectorId: string): Authz {
  return {
    userId: id,
    name,
    email: `${id}@example.test`,
    role: "operator",
    sectorId,
  };
}

const ADMIN: Authz = {
  userId: "admin-1",
  name: "Admin Teste",
  email: "admin@example.test",
  role: "admin",
  sectorId: null,
};

// ULD com Ana, Bia e o administrador; três turnos antigos (Manhã 06–14,
// Tarde 14–22, Noite 22–06, que atravessa a meia-noite).
async function seed() {
  const uld = await insertSector(db, "ULD");
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Bia Teste",
  });
  const root = await insertUser(db, {
    role: "admin",
    sectorId: null,
    name: "Admin Teste",
  });
  const manha = await insertShift(db, {
    sectorId: uld.id,
    name: "Manhã",
    startsAt: "06:00",
    endsAt: "14:00",
    createdAt: OLD,
  });
  const tarde = await insertShift(db, {
    sectorId: uld.id,
    name: "Tarde",
    startsAt: "14:00",
    endsAt: "22:00",
    createdAt: OLD,
  });
  const noite = await insertShift(db, {
    sectorId: uld.id,
    name: "Noite",
    startsAt: "22:00",
    endsAt: "06:00",
    createdAt: OLD,
  });
  return {
    uld,
    ana: ana.id,
    bia: bia.id,
    root: root.id,
    manha,
    tarde,
    noite,
    anaAuthz: operator(ana.id, "Ana Teste", uld.id),
  };
}

async function history(
  actor: Authz,
  options: {
    filters?: HistoryFilters;
    sectorId?: string | null;
    page?: number;
    now?: Date;
  } = {},
) {
  return listHandoverHistory(
    db,
    actor,
    {
      filters: options.filters ?? filters(),
      sectorId: options.sectorId ?? null,
      page: options.page ?? 1,
    },
    options.now ?? NOW,
  );
}

describe("listHandoverHistory", () => {
  describe("sem passagem (missing)", () => {
    it("só pares encerrados: às 14:30 de 21/11 só a Manhã já terminou", async () => {
      const { uld, manha } = await seed();

      const page = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({ from: "2026-11-21", to: "2026-11-21" }),
      });

      expect(page.total).toBe(1);
      expect(page.rows).toEqual([
        {
          key: `${uld.id}:${manha.id}:2026-11-21`,
          operationalDate: "2026-11-21",
          shiftId: manha.id,
          shiftName: "Manhã",
          sectorId: uld.id,
          sectorName: "ULD",
          handoverId: null,
          situation: "missing",
          corrected: false,
          hasDraft: false,
          deliveredByName: null,
          deliveredAt: null,
          confirmedByName: null,
          confirmedAt: null,
        },
      ]);
    });

    it("fim igual a agora conta como encerrado; um minuto antes, não", async () => {
      const { uld } = await seed();
      const range = filters({ from: "2026-11-21", to: "2026-11-21" });

      const atEnd = await history(ADMIN, {
        sectorId: uld.id,
        filters: range,
        now: spDate("2026-11-21", "14:00"),
      });
      const before = await history(ADMIN, {
        sectorId: uld.id,
        filters: range,
        now: spDate("2026-11-21", "13:59"),
      });

      expect(atEnd.total).toBe(1);
      expect(before.total).toBe(0);
    });

    it("turno que atravessa a meia-noite: o dia operacional é o do início e só encerra às 06:00 do dia seguinte", async () => {
      const { uld, noite } = await seed();
      const range = filters({ from: "2026-11-20", to: "2026-11-20" });

      const early = await history(ADMIN, {
        sectorId: uld.id,
        filters: { ...range, shiftId: noite.id },
        now: spDate("2026-11-21", "05:59"),
      });
      const done = await history(ADMIN, {
        sectorId: uld.id,
        filters: { ...range, shiftId: noite.id },
        now: spDate("2026-11-21", "06:00"),
      });

      expect(early.total).toBe(0);
      expect(done.rows.map((row) => row.operationalDate)).toEqual([
        "2026-11-20",
      ]);
    });

    it("turno novo só gera pares a partir do dia (São Paulo) em que foi criado", async () => {
      const { uld } = await seed();
      await insertShift(db, {
        sectorId: uld.id,
        name: "Reforço",
        startsAt: "06:00",
        endsAt: "07:00",
        createdAt: spDate("2026-11-20", "23:30"),
      });

      const page = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({ from: "2026-11-15", to: "2026-11-21" }),
      });

      const reforco = page.rows.filter((row) => row.shiftName === "Reforço");
      expect(reforco.map((row) => row.operationalDate)).toEqual([
        "2026-11-21",
        "2026-11-20",
      ]);
    });

    it("turno inativo e setor inativo ficam fora; passagem entregue de turno inativo continua aparecendo", async () => {
      const { uld, ana } = await seed();
      const velho = await insertShift(db, {
        sectorId: uld.id,
        name: "Velho",
        startsAt: "06:00",
        endsAt: "07:00",
        active: false,
        createdAt: OLD,
      });
      const fechado = await insertSector(db, "Fechado", { active: false });
      const fechadoTurno = await insertShift(db, {
        sectorId: fechado.id,
        createdAt: OLD,
      });
      await insertHandover(db, {
        sectorId: fechado.id,
        shiftId: fechadoTurno.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: velho.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
      });

      const page = await history(ADMIN, {
        filters: filters({ from: "2026-11-20", to: "2026-11-20" }),
      });

      expect(page.rows.map((row) => row.sectorName)).not.toContain("Fechado");
      expect(
        page.rows.filter((row) => row.shiftName === "Velho"),
      ).toMatchObject([{ situation: "awaiting" }]);
    });

    it("par com rascunho é missing com hasDraft; rascunho de turno em andamento não aparece", async () => {
      const { uld, manha, tarde } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-21",
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-21",
      });

      const page = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({ from: "2026-11-21", to: "2026-11-21" }),
      });

      expect(page.rows).toHaveLength(1);
      expect(page.rows[0]).toMatchObject({
        shiftName: "Manhã",
        situation: "missing",
        hasDraft: true,
        handoverId: null,
      });
    });

    it("par com passagem entregue ou confirmada não é missing", async () => {
      const { uld, manha, tarde, ana, bia } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-20",
        status: "confirmed",
        deliveredBy: ana,
        confirmedBy: bia,
      });

      const page = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({
          from: "2026-11-20",
          to: "2026-11-20",
          situation: "missing",
        }),
      });

      expect(page.rows.map((row) => row.shiftName)).toEqual(["Noite"]);
    });
  });

  describe("situações das passagens reais", () => {
    it("a entregue mais recente do setor é awaiting; a anterior não confirmada é unconfirmed; cada setor tem a sua", async () => {
      const { uld, manha, tarde, ana } = await seed();
      const outro = await insertSector(db, "Outro");
      const outroTurno = await insertShift(db, {
        sectorId: outro.id,
        name: "Único",
        createdAt: OLD,
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-20", "14:05"),
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-20", "22:05"),
      });
      await insertHandover(db, {
        sectorId: outro.id,
        shiftId: outroTurno.id,
        operationalDate: "2026-11-19",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-19", "14:00"),
      });

      const page = await history(ADMIN, {
        filters: filters({ from: "2026-11-19", to: "2026-11-20" }),
      });

      const bySituation = page.rows
        .filter((row) => row.handoverId !== null)
        .map((row) => [row.sectorName, row.shiftName, row.situation]);
      expect(bySituation).toEqual([
        ["ULD", "Tarde", "awaiting"],
        ["ULD", "Manhã", "unconfirmed"],
        ["Outro", "Único", "awaiting"],
      ]);
    });

    it("uma confirmada mais nova do setor rebaixa a entregue antiga para unconfirmed", async () => {
      const { uld, manha, tarde, ana, bia } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-20", "14:05"),
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-20",
        status: "confirmed",
        deliveredBy: ana,
        confirmedBy: bia,
        deliveredAt: spDate("2026-11-20", "22:05"),
        confirmedAt: spDate("2026-11-20", "22:20"),
      });

      const page = await history(ADMIN, {
        filters: filters({ from: "2026-11-20", to: "2026-11-20" }),
      });

      const bySituation = page.rows
        .filter((row) => row.handoverId !== null)
        .map((row) => [row.shiftName, row.situation]);
      expect(bySituation).toEqual([
        ["Tarde", "confirmed"],
        ["Manhã", "unconfirmed"],
      ]);
    });

    it("confirmada traz quem entregou, quem confirmou e os horários como Date", async () => {
      const { uld, manha, ana, bia } = await seed();
      const delivered = spDate("2026-11-20", "14:05");
      const confirmed = spDate("2026-11-20", "14:40");
      const passagem = await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
        status: "confirmed",
        deliveredBy: ana,
        confirmedBy: bia,
        deliveredAt: delivered,
        confirmedAt: confirmed,
        shiftNameSnapshot: "Manhã (antigo nome)",
      });

      const page = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({
          from: "2026-11-20",
          to: "2026-11-20",
          situation: "confirmed",
        }),
      });

      expect(page.rows).toEqual([
        expect.objectContaining({
          handoverId: passagem.id,
          shiftName: "Manhã (antigo nome)",
          situation: "confirmed",
          corrected: false,
          hasDraft: false,
          deliveredByName: "Ana Teste",
          deliveredAt: delivered,
          confirmedByName: "Bia Teste",
          confirmedAt: confirmed,
        }),
      ]);
    });

    it("corrected é um selo à parte e um filtro", async () => {
      const { uld, manha, tarde, ana, bia, root } = await seed();
      const corrigida = await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
        status: "confirmed",
        deliveredBy: ana,
        confirmedBy: bia,
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-20",
        status: "confirmed",
        deliveredBy: ana,
        confirmedBy: bia,
      });
      await insertHandoverCorrection(db, {
        handoverId: corrigida.id,
        field: "occurrences_text",
        correctedBy: root,
      });

      const all = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({ from: "2026-11-20", to: "2026-11-20" }),
      });
      const onlyCorrected = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({
          from: "2026-11-20",
          to: "2026-11-20",
          situation: "corrected",
        }),
      });

      expect(
        all.rows
          .filter((row) => row.handoverId !== null)
          .map((row) => [row.shiftName, row.situation, row.corrected]),
      ).toEqual([
        ["Tarde", "confirmed", false],
        ["Manhã", "confirmed", true],
      ]);
      expect(onlyCorrected.rows.map((row) => row.handoverId)).toEqual([
        corrigida.id,
      ]);
    });
  });

  describe("filtros, ordem e paginação", () => {
    it("filtra por turno, situação e período", async () => {
      const { uld, manha, tarde, ana } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-20", "14:05"),
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-10",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-10", "22:05"),
      });

      const byShift = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({ shiftId: manha.id, from: "2026-11-20" }),
      });
      const bySituation = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({ situation: "awaiting", from: "2026-11-01" }),
      });
      const byPeriod = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({ from: "2026-11-15", to: "2026-11-20" }),
      });

      expect(new Set(byShift.rows.map((row) => row.shiftId))).toEqual(
        new Set([manha.id]),
      );
      expect(bySituation.rows.map((row) => row.shiftName)).toEqual(["Manhã"]);
      expect(bySituation.rows[0]?.situation).toBe("awaiting");
      expect(
        byPeriod.rows.every((row) => row.operationalDate <= "2026-11-20"),
      ).toBe(true);
      expect(
        byPeriod.rows.some((row) => row.operationalDate < "2026-11-15"),
      ).toBe(false);
    });

    it("ordena por dia desc, fim do turno desc e nome do setor", async () => {
      const { uld, manha, tarde, noite, ana, bia } = await seed();
      for (const turno of [manha, tarde, noite]) {
        await insertHandover(db, {
          sectorId: uld.id,
          shiftId: turno.id,
          operationalDate: "2026-11-19",
          status: "confirmed",
          deliveredBy: ana,
          confirmedBy: bia,
        });
      }

      const page = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({ from: "2026-11-19", to: "2026-11-20" }),
      });

      expect(
        page.rows.map((row) => `${row.operationalDate} ${row.shiftName}`),
      ).toEqual([
        "2026-11-20 Noite",
        "2026-11-20 Tarde",
        "2026-11-20 Manhã",
        "2026-11-19 Noite",
        "2026-11-19 Tarde",
        "2026-11-19 Manhã",
      ]);
    });

    it("pagina por linhas e clampa a página pedida", async () => {
      const sector = await insertSector(db, "ULD");
      await insertShift(db, {
        sectorId: sector.id,
        name: "Único",
        startsAt: "06:00",
        endsAt: "14:00",
        createdAt: OLD,
      });
      const range = filters({
        from: addDays("2026-11-21", -59),
        to: "2026-11-21",
      });

      const first = await history(ADMIN, {
        sectorId: sector.id,
        filters: range,
      });
      const second = await history(ADMIN, {
        sectorId: sector.id,
        filters: range,
        page: 2,
      });
      const beyond = await history(ADMIN, {
        sectorId: sector.id,
        filters: range,
        page: 99,
      });
      const zero = await history(ADMIN, {
        sectorId: sector.id,
        filters: range,
        page: 0,
      });

      expect(PAGE_SIZE).toBe(50);
      expect(first).toMatchObject({ total: 60, page: 1, pageCount: 2 });
      expect(first.rows).toHaveLength(50);
      expect(first.rows[0]?.operationalDate).toBe("2026-11-21");
      expect(second.rows).toHaveLength(10);
      expect(second.rows.at(-1)?.operationalDate).toBe("2026-09-23");
      expect(beyond.page).toBe(2);
      expect(beyond.rows).toEqual(second.rows);
      expect(zero.page).toBe(1);
    });

    it("sem nada no período: página vazia com pageCount 1", async () => {
      const { uld } = await seed();

      const page = await history(ADMIN, {
        sectorId: uld.id,
        filters: filters({ from: "2026-11-22", to: "2026-11-25" }),
      });

      expect(page).toEqual({
        rows: [],
        total: 0,
        page: 1,
        pageCount: 1,
        pageSize: 50,
      });
    });
  });

  describe("escopo", () => {
    it("operador só vê o próprio setor, mesmo pedindo outro ou todos", async () => {
      const { uld, anaAuthz } = await seed();
      const outro = await insertSector(db, "Outro");
      await insertShift(db, { sectorId: outro.id, createdAt: OLD });
      const range = filters({ from: "2026-11-20", to: "2026-11-20" });

      const own = await history(anaAuthz, { filters: range, sectorId: null });
      const foreign = await history(anaAuthz, {
        filters: range,
        sectorId: outro.id,
      });

      expect(own.total).toBe(3);
      expect(new Set(own.rows.map((row) => row.sectorId))).toEqual(
        new Set([uld.id]),
      );
      expect(foreign).toEqual(own);
    });

    it("admin vê todos os setores ativos; com sectorId filtra um", async () => {
      const { uld } = await seed();
      const outro = await insertSector(db, "Outro");
      await insertShift(db, { sectorId: outro.id, createdAt: OLD });
      const range = filters({ from: "2026-11-20", to: "2026-11-20" });

      const all = await history(ADMIN, { filters: range });
      const one = await history(ADMIN, { filters: range, sectorId: uld.id });

      expect(all.total).toBe(4);
      expect(one.total).toBe(3);
    });

    it("operador sem setor (estado inválido) não vê nada", async () => {
      await seed();

      const page = await history({
        ...ADMIN,
        role: "operator",
        sectorId: null,
      });

      expect(page.total).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/features/handovers/history.test.ts`
Expected: FAIL com `Error: Cannot find module './history' imported from …/src/features/handovers/history.test.ts`.

- [ ] **Step 3: Write minimal implementation**

Crie `src/features/handovers/history.ts`. Decisões que o código registra: a leitura é uma consulta SQL única (CTE de pares `generate_series` × turnos ativos de setores ativos, `UNION ALL` com as passagens entregues/confirmadas), sem `db.execute` (F3-9c); `generate_series` recebe `::timestamp` (a versão com `date` resolve para a sobrecarga `timestamptz` do Postgres e depende do fuso da sessão); `timestamptz` cru volta como texto e é convertido com `.mapWith(coluna)`.

```ts
import "server-only";

import { type SQL, sql } from "drizzle-orm";

import { handover } from "@/db/schema/handovers";
import type { Db } from "@/db/types";
import { PAGE_SIZE, type Page, resolvePage } from "@/features/admin/pagination";
import { type Authz, isAdmin } from "@/features/authz/authz";

import type { HistoryFilters } from "./historyFilters";
import { SAO_PAULO_TIME_ZONE } from "./saoPaulo";
import type { HistorySituation } from "./status";

export type HistoryRow = {
  key: string;
  operationalDate: string;
  shiftId: string;
  shiftName: string;
  sectorId: string;
  sectorName: string;
  handoverId: string | null;
  situation: HistorySituation;
  corrected: boolean;
  hasDraft: boolean;
  deliveredByName: string | null;
  deliveredAt: Date | null;
  confirmedByName: string | null;
  confirmedAt: Date | null;
};

type HistoryQuery = {
  filters: HistoryFilters;
  sectorId: string | null;
  page: number;
};

function emptyPage(): Page<HistoryRow> {
  return { rows: [], total: 0, page: 1, pageCount: 1, pageSize: PAGE_SIZE };
}

// Fim do turno em hora de parede (timestamp sem fuso): dia operacional (+1 dia
// se o turno atravessa a meia-noite) + hora de término. Comparado com "agora"
// em São Paulo, é a mesma regra de hasShiftEnded (shiftSuggestion.ts).
function endsLocal(day: SQL): SQL {
  return sql`((${day} + (case when s.ends_at < s.starts_at then 1 else 0 end)) + s.ends_at)`;
}

// Uma linha por par (setor, turno, dia) do período: as passagens entregues ou
// confirmadas (situação real) mais os pares já encerrados sem nenhuma delas
// ("missing"). A origem da leitura é este SELECT inteiro como tabela derivada.
function historySource(
  query: HistoryQuery,
  sectorId: string | null,
  now: Date,
) {
  const { filters } = query;
  const nowLocal = sql`(${now.toISOString()}::timestamptz at time zone ${SAO_PAULO_TIME_ZONE})`;
  const scope = sectorId === null ? sql`true` : sql`sec.id = ${sectorId}`;
  const shiftScope =
    filters.shiftId === null ? sql`true` : sql`s.id = ${filters.shiftId}`;

  return sql`(
    with pairs as (
      select
        sec.id as sector_id, sec.name as sector_name,
        s.id as shift_id, s.name as shift_name, s.sort_order as shift_order,
        d.day::date as operational_date,
        ${endsLocal(sql`d.day::date`)} as ends_local
      from generate_series(${filters.from}::timestamp, ${filters.to}::timestamp, interval '1 day') as d(day)
      cross join shift s
      join sector sec on sec.id = s.sector_id
      where s.active and sec.active
        and ${scope} and ${shiftScope}
        and d.day::date >= (s.created_at at time zone ${SAO_PAULO_TIME_ZONE})::date
    )
    select
      h.sector_id, sec.name as sector_name,
      h.shift_id, coalesce(h.shift_name_snapshot, s.name) as shift_name,
      s.sort_order as shift_order, h.operational_date,
      ${endsLocal(sql`h.operational_date`)} as ends_local,
      h.id as handover_id,
      case
        when h.status = 'confirmed' then 'confirmed'
        when not exists (
          select 1 from handover n
          where n.sector_id = h.sector_id and n.status in ('delivered', 'confirmed')
            and (n.delivered_at, n.id) > (h.delivered_at, h.id)
        ) then 'awaiting'
        else 'unconfirmed'
      end as situation,
      exists (select 1 from handover_correction c where c.handover_id = h.id) as corrected,
      false as has_draft,
      du.name as delivered_by_name, h.delivered_at,
      cu.name as confirmed_by_name, h.confirmed_at
    from handover h
    join sector sec on sec.id = h.sector_id
    join shift s on s.id = h.shift_id
    left join "user" du on du.id = h.delivered_by
    left join "user" cu on cu.id = h.confirmed_by
    where h.status in ('delivered', 'confirmed')
      and h.operational_date between ${filters.from}::date and ${filters.to}::date
      and sec.active and ${scope} and ${shiftScope}
    union all
    select
      p.sector_id, p.sector_name, p.shift_id, p.shift_name, p.shift_order,
      p.operational_date, p.ends_local,
      null::uuid, 'missing',
      false,
      exists (
        select 1 from handover d
        where d.sector_id = p.sector_id and d.shift_id = p.shift_id
          and d.operational_date = p.operational_date
      ),
      null::text, null::timestamptz, null::text, null::timestamptz
    from pairs p
    where p.ends_local <= ${nowLocal}
      and not exists (
        select 1 from handover h
        where h.sector_id = p.sector_id and h.shift_id = p.shift_id
          and h.operational_date = p.operational_date
          and h.status in ('delivered', 'confirmed')
      )
  ) as u`;
}

function situationWhere(filters: HistoryFilters): SQL {
  if (filters.situation === "all") return sql`true`;
  if (filters.situation === "corrected") return sql`u.corrected`;
  return sql`u.situation = ${filters.situation}`;
}

export async function listHandoverHistory(
  db: Db,
  actor: Authz,
  input: HistoryQuery,
  now: Date,
): Promise<Page<HistoryRow>> {
  // Operador é forçado ao próprio setor; o valor que veio da URL é ignorado.
  let sectorId: string | null;
  if (isAdmin(actor)) sectorId = input.sectorId;
  else if (actor.sectorId === null) return emptyPage();
  else sectorId = actor.sectorId;

  const source = historySource(input, sectorId, now);
  const where = situationWhere(input.filters);

  const [counted] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(source)
    .where(where);
  const total = counted?.total ?? 0;
  const { page, pageCount, offset } = resolvePage(total, input.page);

  const rows = await db
    .select({
      sectorId: sql<string>`u.sector_id`,
      sectorName: sql<string>`u.sector_name`,
      shiftId: sql<string>`u.shift_id`,
      shiftName: sql<string>`u.shift_name`,
      operationalDate: sql<string>`u.operational_date::text`,
      handoverId: sql<string | null>`u.handover_id`,
      situation: sql<HistorySituation>`u.situation`,
      corrected: sql<boolean>`u.corrected`,
      hasDraft: sql<boolean>`u.has_draft`,
      deliveredByName: sql<string | null>`u.delivered_by_name`,
      deliveredAt: sql<Date | null>`u.delivered_at`.mapWith(
        handover.deliveredAt,
      ),
      confirmedByName: sql<string | null>`u.confirmed_by_name`,
      confirmedAt: sql<Date | null>`u.confirmed_at`.mapWith(
        handover.confirmedAt,
      ),
    })
    .from(source)
    .where(where)
    .orderBy(
      sql`u.operational_date desc`,
      sql`u.ends_local desc`,
      sql`lower(u.sector_name)`,
      sql`u.shift_order`,
      sql`u.shift_id`,
    )
    .limit(PAGE_SIZE)
    .offset(offset);

  return {
    rows: rows.map((row) => ({
      ...row,
      key: `${row.sectorId}:${row.shiftId}:${row.operationalDate}`,
    })),
    total,
    page,
    pageCount,
    pageSize: PAGE_SIZE,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bunx biome check --write src/features/handovers && bun run test -- src/features/handovers/history.test.ts`
Expected: PASS (18 testes).

#### Parte B: paridade `hasShiftEnded` (JS) × SQL

- [ ] **Step 5: Write the test**

Crie `src/features/handovers/history.parity.test.ts`. O teste nasce verde (a implementação já existe); o passo seguinte prova que ele morde.

```ts
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Authz } from "@/features/authz/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertSector, insertShift } from "../../../test/fixtures";
import { listHandoverHistory } from "./history";
import { addDays } from "./saoPaulo";
import { hasShiftEnded } from "./shiftSuggestion";

// O "sem passagem" do histórico decide em SQL se o turno já terminou; a tela
// do formulário decide em JS (hasShiftEnded). Os dois têm de concordar em toda
// a grade abaixo: horários de borda, turnos que atravessam a meia-noite e a
// virada do dia em UTC (02:59Z e 03:00Z são 23:59 e 00:00 em São Paulo).
const DAY = "2026-11-21";
const OLD = new Date("2026-01-01T12:00:00.000Z");

const SHIFTS = [
  { name: "Manhã", startsAt: "06:00", endsAt: "14:00" },
  { name: "Tarde", startsAt: "14:00", endsAt: "22:00" },
  { name: "Noite", startsAt: "22:00", endsAt: "06:00" },
  { name: "Fim de tarde", startsAt: "18:00", endsAt: "00:00" },
  { name: "Madrugada", startsAt: "00:00", endsAt: "08:00" },
  { name: "Quase o dia todo", startsAt: "08:30", endsAt: "23:59" },
  { name: "Relâmpago", startsAt: "12:00", endsAt: "12:01" },
];

const CLOCKS = [
  "00:00",
  "00:01",
  "05:59",
  "06:00",
  "06:01",
  "07:59",
  "08:00",
  "12:00",
  "12:01",
  "13:59",
  "14:00",
  "14:01",
  "21:59",
  "22:00",
  "22:01",
  "23:58",
  "23:59",
];

const ADMIN: Authz = {
  userId: "admin-1",
  name: "Admin Teste",
  email: "admin@example.test",
  role: "admin",
  sectorId: null,
};

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

describe("paridade hasShiftEnded (JS) × SQL de pares encerrados", () => {
  it("concordam em todos os horários da grade, em três dias", async () => {
    await resetDb(client);
    const uld = await insertSector(db, "ULD");
    const created: { id: string; startsAt: string; endsAt: string }[] = [];
    for (const [index, shift] of SHIFTS.entries()) {
      created.push({
        ...shift,
        ...(await insertShift(db, {
          sectorId: uld.id,
          name: shift.name,
          startsAt: shift.startsAt,
          endsAt: shift.endsAt,
          sortOrder: index,
          createdAt: OLD,
        })),
      });
    }
    const days = [addDays(DAY, -1), DAY, addDays(DAY, 1)];

    const instants = [
      ...CLOCKS.map((clock) => spDate(DAY, clock)),
      // segundos não mudam o resultado: o fim do turno é sempre minuto cheio
      new Date(spDate(DAY, "14:00").getTime() + 30_000),
      new Date(spDate(DAY, "13:59").getTime() + 59_000),
      new Date("2026-11-21T02:59:00.000Z"),
      new Date("2026-11-21T03:00:00.000Z"),
    ];

    for (const now of instants) {
      const page = await listHandoverHistory(
        db,
        ADMIN,
        {
          filters: {
            period: "range",
            from: days[0] ?? DAY,
            to: days[2] ?? DAY,
            shiftId: null,
            situation: "missing",
          },
          sectorId: uld.id,
          page: 1,
        },
        now,
      );
      const fromSql = page.rows
        .map((row) => `${row.operationalDate}|${row.shiftId}`)
        .sort();
      const fromJs = days
        .flatMap((day) =>
          created
            .filter((shift) => hasShiftEnded(day, shift, now))
            .map((shift) => `${day}|${shift.id}`),
        )
        .sort();

      expect(fromSql, `agora = ${now.toISOString()}`).toEqual(fromJs);
    }
  });
});
```

- [ ] **Step 6: Run test to verify it passes, then prove it bites**

Run: `bunx biome check --write src/features/handovers && bun run test -- src/features/handovers/history.parity.test.ts`
Expected: PASS (1 teste).

Prova de que o teste detecta divergência (mutação temporária, desfaça em seguida):

```bash
cp src/features/handovers/history.ts .git/sdd/history.ts.bak
sed -i 's/p.ends_local <= /p.ends_local < /' src/features/handovers/history.ts
bun run test -- src/features/handovers/history.parity.test.ts
cp .git/sdd/history.ts.bak src/features/handovers/history.ts
cmp .git/sdd/history.ts.bak src/features/handovers/history.ts && rm .git/sdd/history.ts.bak
```
Expected (com a mutação): FAIL com `AssertionError: agora = 2026-11-21T03:00:00.000Z: expected [ …(5) ] to deeply equal [ …(6) ]`. Depois do `cp` de volta, rode o comando do início do passo e confirme PASS de novo. O `cmp` não imprime nada quando o arquivo voltou idêntico ao do backup.

#### Parte C: cartões do Início

- [ ] **Step 7: Write the failing test**

Crie `src/features/handovers/home.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { handover } from "@/db/schema/handovers";
import type { Authz } from "@/features/authz/authz";
import { spDate } from "../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertHandover,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { getHomeHandovers } from "./home";
import { NEXT_SHIFT_PREVIEW_LENGTH } from "./limits";

const NIL_ID = "00000000-0000-4000-8000-000000000000";
// 14:05: o fim mais próximo é o da Manhã (14:00), do dia 21/11.
const NOW = spDate("2026-11-21", "14:05");

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
});

function operator(id: string, name: string, sectorId: string): Authz {
  return {
    userId: id,
    name,
    email: `${id}@example.test`,
    role: "operator",
    sectorId,
  };
}

async function seed() {
  const uld = await insertSector(db, "ULD");
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Bia Teste",
  });
  const root = await insertUser(db, {
    role: "admin",
    sectorId: null,
    name: "Admin Teste",
  });
  const manha = await insertShift(db, {
    sectorId: uld.id,
    name: "Manhã",
    startsAt: "06:00",
    endsAt: "14:00",
  });
  const tarde = await insertShift(db, {
    sectorId: uld.id,
    name: "Tarde",
    startsAt: "14:00",
    endsAt: "22:00",
  });
  return {
    uld,
    manha,
    tarde,
    ana: ana.id,
    bia: bia.id,
    root: root.id,
    anaAuthz: operator(ana.id, "Ana Teste", uld.id),
    biaAuthz: operator(bia.id, "Bia Teste", uld.id),
    rootAuthz: {
      userId: root.id,
      name: "Admin Teste",
      email: "admin@example.test",
      role: "admin",
      sectorId: null,
    } satisfies Authz,
  };
}

async function homeOf(actor: Authz, sectorId: string, now = NOW) {
  const result = await getHomeHandovers(db, actor, sectorId, now);
  if (!result.ok) throw new Error(`início falhou: ${result.message}`);
  return result.home;
}

describe("getHomeHandovers", () => {
  describe("passagem para confirmar (pending)", () => {
    it("sem nenhuma entregue: null", async () => {
      const { uld, biaAuthz } = await seed();

      expect((await homeOf(biaAuthz, uld.id)).pending).toBeNull();
    });

    it("mostra a entregue mais recente do setor a quem não entregou", async () => {
      const { uld, manha, tarde, ana, biaAuthz } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-20", "14:02"),
        nextShiftText: "Velha",
      });
      const recent = await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-20", "22:03"),
        nextShiftText: "Conferir a rede 7.",
        shiftNameSnapshot: "Tarde (nome antigo)",
      });

      const { pending } = await homeOf(biaAuthz, uld.id);

      expect(pending).toEqual({
        id: recent.id,
        sectorName: "ULD",
        shiftName: "Tarde (nome antigo)",
        operationalDate: "2026-11-20",
        deliveredByName: "Ana Teste",
        deliveredAt: spDate("2026-11-20", "22:03"),
        nextShiftPreview: "Conferir a rede 7.",
      });
    });

    it("some para quem entregou e não cai para uma mais antiga", async () => {
      const { uld, manha, tarde, ana, bia, anaAuthz, biaAuthz } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: bia,
        deliveredAt: spDate("2026-11-20", "14:02"),
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-20", "22:03"),
      });

      expect((await homeOf(anaAuthz, uld.id)).pending).toBeNull();
      expect((await homeOf(biaAuthz, uld.id)).pending?.deliveredByName).toBe(
        "Ana Teste",
      );
    });

    it("uma confirmada mais nova esconde a entregue mais antiga (F3-6); rascunho não conta", async () => {
      const { uld, manha, tarde, ana, bia, biaAuthz } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-19",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-19", "14:02"),
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-19",
        status: "confirmed",
        deliveredBy: ana,
        confirmedBy: bia,
        deliveredAt: spDate("2026-11-19", "22:03"),
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
      });

      expect((await homeOf(biaAuthz, uld.id)).pending).toBeNull();
    });

    it("um rascunho mais novo não esconde a entregue: ela continua pendente", async () => {
      const { uld, manha, tarde, ana, biaAuthz } = await seed();
      const delivered = await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-19",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-19", "14:02"),
      });
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: tarde.id,
        operationalDate: "2026-11-20",
      });

      expect((await homeOf(biaAuthz, uld.id)).pending?.id).toBe(delivered.id);
    });

    it("não vaza passagem de outro setor", async () => {
      const { uld, ana, biaAuthz } = await seed();
      const outro = await insertSector(db, "Outro");
      const turno = await insertShift(db, { sectorId: outro.id });
      await insertHandover(db, {
        sectorId: outro.id,
        shiftId: turno.id,
        status: "delivered",
        deliveredBy: ana,
      });

      expect((await homeOf(biaAuthz, uld.id)).pending).toBeNull();
    });

    it("trecho do próximo turno: null se vazio ou só espaços; corta em 200 pontos de código com reticências", async () => {
      const { uld, manha, ana, biaAuthz } = await seed();
      const passagem = await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-20",
        status: "delivered",
        deliveredBy: ana,
      });
      const previewOf = async (text: string) => {
        await db
          .update(handover)
          .set({ nextShiftText: text })
          .where(eq(handover.id, passagem.id));
        return (await homeOf(biaAuthz, uld.id)).pending?.nextShiftPreview;
      };
      const exact = "😀".repeat(NEXT_SHIFT_PREVIEW_LENGTH);

      expect(await previewOf("")).toBeNull();
      expect(await previewOf(" \n ")).toBeNull();
      expect(await previewOf("  Conferir a rede 7.  ")).toBe(
        "Conferir a rede 7.",
      );
      expect(await previewOf(exact)).toBe(exact);
      expect(await previewOf(`${exact}😀`)).toBe(`${exact}…`);
    });
  });

  describe("passagem do meu turno (mine)", () => {
    it("setor sem turnos ativos: no-shifts", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, { sectorId: uld.id, active: false });
      const root = await insertUser(db, {
        role: "admin",
        sectorId: null,
      });

      const home = await homeOf(
        {
          userId: root.id,
          name: "Admin Teste",
          email: "a@example.test",
          role: "admin",
          sectorId: null,
        },
        uld.id,
      );

      expect(home.mine).toEqual({ kind: "no-shifts" });
    });

    it("start: turno sugerido pelo horário, sem passagem", async () => {
      const { uld, manha, anaAuthz } = await seed();

      const { mine } = await homeOf(anaAuthz, uld.id);

      expect(mine).toEqual({
        kind: "start",
        ref: {
          sectorId: uld.id,
          shiftId: manha.id,
          operationalDate: "2026-11-21",
        },
        shift: {
          id: manha.id,
          name: "Manhã",
          startsAt: "06:00",
          endsAt: "14:00",
        },
        saved: null,
      });
    });

    it("continue: rascunho existe e traz quem salvou por último", async () => {
      const { uld, manha, bia, anaAuthz } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-21",
        updatedBy: bia,
      });

      const { mine } = await homeOf(anaAuthz, uld.id);

      expect(mine.kind).toBe("continue");
      if (mine.kind !== "continue") throw new Error("estado inesperado");
      expect(mine.saved?.byName).toBe("Bia Teste");
      expect(mine.saved?.at).toBeInstanceOf(Date);
    });

    it("continue sem updatedBy: saved null", async () => {
      const { uld, manha, anaAuthz } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-21",
      });

      const { mine } = await homeOf(anaAuthz, uld.id);

      expect(mine).toMatchObject({ kind: "continue", saved: null });
    });

    it("delivered: traz id, quem entregou e quando", async () => {
      const { uld, manha, ana, anaAuthz } = await seed();
      const passagem = await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-21",
        status: "delivered",
        deliveredBy: ana,
        deliveredAt: spDate("2026-11-21", "14:02"),
      });

      const { mine } = await homeOf(anaAuthz, uld.id);

      expect(mine).toMatchObject({
        kind: "delivered",
        handoverId: passagem.id,
        deliveredByName: "Ana Teste",
        deliveredAt: spDate("2026-11-21", "14:02"),
        confirmedByName: null,
        confirmedAt: null,
      });
    });

    it("confirmed: traz quem confirmou e quando", async () => {
      const { uld, manha, ana, bia, anaAuthz } = await seed();
      await insertHandover(db, {
        sectorId: uld.id,
        shiftId: manha.id,
        operationalDate: "2026-11-21",
        status: "confirmed",
        deliveredBy: ana,
        confirmedBy: bia,
        deliveredAt: spDate("2026-11-21", "14:02"),
        confirmedAt: spDate("2026-11-21", "14:04"),
      });

      const { mine } = await homeOf(anaAuthz, uld.id);

      expect(mine).toMatchObject({
        kind: "confirmed",
        confirmedByName: "Bia Teste",
        confirmedAt: spDate("2026-11-21", "14:04"),
      });
    });

    it("à 00:10 o turno sugerido é a Tarde do dia anterior", async () => {
      const { uld, tarde, anaAuthz } = await seed();

      const { mine } = await homeOf(
        anaAuthz,
        uld.id,
        spDate("2026-11-21", "00:10"),
      );

      expect(mine).toMatchObject({
        kind: "start",
        ref: { shiftId: tarde.id, operationalDate: "2026-11-20" },
      });
    });

    it("turno inativo não é sugerido, mesmo com o fim mais perto de agora", async () => {
      const { uld, manha, anaAuthz } = await seed();
      await insertShift(db, {
        sectorId: uld.id,
        name: "Extra",
        startsAt: "13:00",
        endsAt: "14:08",
        active: false,
      });

      const { mine } = await homeOf(anaAuthz, uld.id);

      expect(mine).toMatchObject({ kind: "start", shift: { id: manha.id } });
    });
  });

  describe("escopo e setor", () => {
    it("admin vê qualquer setor ativo", async () => {
      const { uld, rootAuthz } = await seed();

      const home = await homeOf(rootAuthz, uld.id);

      expect(home.sector).toEqual({ id: uld.id, name: "ULD" });
    });

    it("operador de outro setor e id inexistente: NOT_FOUND", async () => {
      const { uld, rootAuthz } = await seed();
      const outro = await insertSector(db, "Outro");
      const caio = await insertUser(db, {
        role: "operator",
        sectorId: outro.id,
      });
      const actor = operator(caio.id, "Caio Teste", outro.id);

      const foreign = await getHomeHandovers(db, actor, uld.id, NOW);
      const missing = await getHomeHandovers(db, rootAuthz, NIL_ID, NOW);

      expect(foreign).toEqual({
        ok: false,
        code: "NOT_FOUND",
        message: "Setor não encontrado. Atualize a página.",
      });
      expect(missing).toEqual(foreign);
    });

    it("setor inativo: SECTOR_INACTIVE", async () => {
      const fechado = await insertSector(db, "Fechado", { active: false });
      const root = await insertUser(db, { role: "admin", sectorId: null });

      const result = await getHomeHandovers(
        db,
        {
          userId: root.id,
          name: "Admin Teste",
          email: "a@example.test",
          role: "admin",
          sectorId: null,
        },
        fechado.id,
        NOW,
      );

      expect(result).toEqual({
        ok: false,
        code: "SECTOR_INACTIVE",
        message:
          "Este setor está inativo. Peça a um administrador para reativá-lo.",
      });
    });
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `bun run test -- src/features/handovers/home.test.ts`
Expected: FAIL com `Error: Cannot find module './home' imported from …/src/features/handovers/home.test.ts`.

- [ ] **Step 9: Write minimal implementation**

Crie `src/features/handovers/home.ts`:

```ts
import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { shift } from "@/db/schema/catalog";
import { handover } from "@/db/schema/handovers";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import { notFoundMessage } from "@/features/admin/messages";
import { type AdminResult, fail, ok } from "@/features/admin/result";
import type { Authz } from "@/features/authz/authz";

import { codePointLength } from "./fieldRules";
import { NEXT_SHIFT_PREVIEW_LENGTH } from "./limits";
import { findHandoverByRef, loadSector, userNames } from "./loaders";
import { SECTOR_INACTIVE_HANDOVER_MESSAGE } from "./messages";
import { suggestShift } from "./shiftSuggestion";
import { listActiveShifts } from "./targets";
import type { HandoverRef, SavedMark, ShiftChoice } from "./types";

export type PendingHandover = {
  id: string;
  sectorName: string;
  shiftName: string;
  operationalDate: string;
  deliveredByName: string;
  deliveredAt: Date;
  nextShiftPreview: string | null;
};

export type MyShiftState =
  | { kind: "no-shifts" }
  | {
      kind: "start" | "continue";
      ref: HandoverRef;
      shift: ShiftChoice;
      saved: SavedMark | null;
    }
  | {
      kind: "delivered" | "confirmed";
      handoverId: string;
      ref: HandoverRef;
      shift: ShiftChoice;
      deliveredByName: string;
      deliveredAt: Date;
      confirmedByName: string | null;
      confirmedAt: Date | null;
    };

export type HomeHandovers = {
  sector: { id: string; name: string };
  pending: PendingHandover | null;
  mine: MyShiftState;
};

function previewOf(text: string): string | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (codePointLength(trimmed) <= NEXT_SHIFT_PREVIEW_LENGTH) return trimmed;
  return `${[...trimmed].slice(0, NEXT_SHIFT_PREVIEW_LENGTH).join("")}…`;
}

// A mais recente do setor entre as entregues e as confirmadas. O cartão só
// existe se ela ainda está entregue e não é de quem olha: uma confirmada mais
// nova esconde as entregues antigas (viram "não confirmada" no histórico), e
// ela some para quem a entregou sem cair para outra (F3-6); sem teto de idade
// (P35).
async function loadPending(
  db: Db,
  actor: Authz,
  sectorId: string,
): Promise<PendingHandover | null> {
  const [row] = await db
    .select({
      id: handover.id,
      status: handover.status,
      sectorName: sector.name,
      shiftName: shift.name,
      shiftNameSnapshot: handover.shiftNameSnapshot,
      operationalDate: handover.operationalDate,
      deliveredBy: handover.deliveredBy,
      deliveredByName: user.name,
      deliveredAt: handover.deliveredAt,
      nextShiftText: handover.nextShiftText,
    })
    .from(handover)
    .innerJoin(sector, eq(sector.id, handover.sectorId))
    .innerJoin(shift, eq(shift.id, handover.shiftId))
    .innerJoin(user, eq(user.id, handover.deliveredBy))
    .where(
      and(
        eq(handover.sectorId, sectorId),
        inArray(handover.status, ["delivered", "confirmed"]),
      ),
    )
    .orderBy(desc(handover.deliveredAt), desc(handover.id))
    .limit(1);
  if (
    !row ||
    row.status !== "delivered" ||
    row.deliveredAt === null ||
    row.deliveredBy === actor.userId
  ) {
    return null;
  }
  return {
    id: row.id,
    sectorName: row.sectorName,
    shiftName: row.shiftNameSnapshot ?? row.shiftName,
    operationalDate: row.operationalDate,
    deliveredByName: row.deliveredByName,
    deliveredAt: row.deliveredAt,
    nextShiftPreview: previewOf(row.nextShiftText),
  };
}

async function loadMine(
  db: Db,
  sectorId: string,
  now: Date,
): Promise<MyShiftState> {
  const shifts = await listActiveShifts(db, sectorId);
  const target = suggestShift(shifts, now);
  const chosen = shifts.find((candidate) => candidate.id === target?.shiftId);
  if (target === null || chosen === undefined) return { kind: "no-shifts" };

  const ref: HandoverRef = {
    sectorId,
    shiftId: target.shiftId,
    operationalDate: target.operationalDate,
  };
  const row = await findHandoverByRef(db, ref);
  if (!row) return { kind: "start", ref, shift: chosen, saved: null };

  const people = await userNames(
    db,
    [row.deliveredBy, row.confirmedBy, row.updatedBy].filter(
      (id): id is string => id !== null,
    ),
  );
  if (row.status === "draft") {
    const byName =
      row.updatedBy === null ? undefined : people.get(row.updatedBy);
    return {
      kind: "continue",
      ref,
      shift: chosen,
      saved: byName === undefined ? null : { at: row.updatedAt, byName },
    };
  }
  return {
    kind: row.status,
    handoverId: row.id,
    ref,
    shift: chosen,
    deliveredByName:
      (row.deliveredBy === null ? undefined : people.get(row.deliveredBy)) ??
      "",
    deliveredAt: row.deliveredAt ?? row.updatedAt,
    confirmedByName:
      row.confirmedBy === null ? null : (people.get(row.confirmedBy) ?? null),
    confirmedAt: row.confirmedAt,
  };
}

export async function getHomeHandovers(
  db: Db,
  actor: Authz,
  sectorId: string,
  now: Date,
): Promise<AdminResult<{ home: HomeHandovers }>> {
  const found = await loadSector(db, actor, sectorId);
  if (!found) return fail("NOT_FOUND", notFoundMessage("setor"));
  if (!found.active) {
    return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_HANDOVER_MESSAGE);
  }
  const [pending, mine] = await Promise.all([
    loadPending(db, actor, sectorId),
    loadMine(db, sectorId, now),
  ]);
  return ok({
    home: { sector: { id: found.id, name: found.name }, pending, mine },
  });
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `bunx biome check --write src/features/handovers && bun run test -- src/features/handovers/home.test.ts`
Expected: PASS (18 testes).

- [ ] **Step 11: Verify the task and commit (histórico, paridade e Início)**

Run: `bun run check-types && bun run lint && bun run test -- src/features/handovers`
Expected: tudo verde (os 3 arquivos desta tarefa somam 37 testes: 18 + 1 + 18). Rode também `bun run test` completo; se aparecer "Failed to start forks worker … Timeout waiting for worker to respond", é falha de infraestrutura do Vitest sob carga: rode de novo.

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-6.txt` (texto exato abaixo) e rode:

```bash
git add src/features/handovers/history.ts src/features/handovers/history.test.ts src/features/handovers/history.parity.test.ts src/features/handovers/home.ts src/features/handovers/home.test.ts
git commit -F .git/sdd/msg-task-6.txt
```

Mensagem:

```text
feat(passagem): histórico com "sem passagem" em SQL e cartões do Início

listHandoverHistory numa consulta única (generate_series x turnos ativos de
setores ativos, pares encerrados em America/Sao_Paulo a partir do dia de
criação do turno, NOT EXISTS, UNION ALL), com situações awaiting,
unconfirmed, confirmed e missing, selo corrigida, filtros, escopo e
paginação clampada. getHomeHandovers com o cartão "para confirmar" e os 5
estados de "meu turno". Teste de paridade entre hasShiftEnded (JS) e o SQL
numa grade de horários.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

#### Parte D: P26 nas contagens do `/admin` (commit separado)

- [ ] **Step 12: Write the failing test**

Leia `src/features/admin/overview.test.ts` e altere só o teste `conta só ativos…`: o nome, mais um item no setor inativo e o total de turnos (hoje `3` conta o turno do setor inativo; com P26 vira `2`).

Em `src/features/admin/overview.test.ts`, troque o título:

```ts
  it("conta só ativos: setor, turno, item, destino e pessoa inativos ficam de fora, e turnos e itens de setor inativo também (P26)", async () => {
```

logo depois de `await insertItem(db, { sectorId: uld.id, active: false });` acrescente:

```ts
    await insertItem(db, { sectorId: closed.id });
```

e na asserção troque `shifts: 3,` por:

```ts
      shifts: 2,
```

- [ ] **Step 13: Run test to verify it fails**

Run: `bun run test -- src/features/admin/overview.test.ts`
Expected: FAIL em `conta só ativos…` (`shifts` esperado `2`, recebido `3`); os outros 3 testes do arquivo passam.

- [ ] **Step 14: Write minimal implementation**

Leia `src/features/admin/overview.ts` e faça três mudanças. (a) Import novo logo abaixo do de `drizzle-orm`:

```ts
import type { PgColumn } from "drizzle-orm/pg-core";
```

(b) Acima do comentário `// Um único SELECT: …`, o helper:

```ts
// P26: turno e item de setor inativo não contam (o setor inteiro está fora de
// uso). A subconsulta nomeia a tabela "sector" por extenso, como em sectors.ts.
function inActiveSector(sectorId: PgColumn): SQL {
  return sql`exists (select 1 from ${sector} where ${sector.id} = ${sectorId} and ${sector.active})`;
}
```

(c) No `select`, troque as linhas de `shifts` e `items`:

```ts
      shifts: countWhere(
        sql`${shift}`,
        sql`${shift.active} and ${inActiveSector(shift.sectorId)}`,
      ),
      items: countWhere(
        sql`${item}`,
        sql`${item.active} and ${inActiveSector(item.sectorId)}`,
      ),
```

- [ ] **Step 15: Run test to verify it passes**

Run: `bunx biome check --write src/features/admin && bun run test -- src/features/admin/overview.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 16: Verify and commit (P26, commit próprio)**

Run: `bun run check-types && bun run lint && bun run test`
Expected: tudo verde (se o Vitest acusar "Failed to start forks worker", rode de novo).

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-6b.txt` (texto exato abaixo) e rode:

```bash
git add src/features/admin/overview.ts src/features/admin/overview.test.ts
git commit -F .git/sdd/msg-task-6b.txt
```

Mensagem:

```text
fix(admin): contagens de turnos e itens só de setores ativos (P26)

getAdminOverviewCounts deixa de contar turnos e itens de setor inativo, como
o resto da Fase 3 (as listas e escolhas da passagem juntam sector.active).

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

> Depois deste commit a pendência P26 só fecha na Tarefa 13 (documentação), que move a P26 de seção e acrescenta a `Atualização` datada.

---

### Task 7: Escolha de setor do admin, navegação "Passagens" e Início com os cartões

**Files:**
- Create: `src/features/handovers/sectorCookie.ts`
- Create: `src/app/(app)/actions.ts`
- Create: `src/components/passagens/SectorPicker.tsx`
- Create: `src/components/passagens/HandoverStatusBadge.tsx`
- Create: `src/components/passagens/PendingHandoverCard.tsx`
- Create: `src/components/passagens/MyShiftCard.tsx`
- Create: `src/components/passagens/HomeHandovers.tsx`
- Modify: `src/components/app-shell/navItems.ts` (ícone `ClipboardList` e o item "Passagens" logo depois de "Início")
- Modify: `src/components/app-shell/Greeting.tsx` (2º parágrafo)
- Modify: `e2e/auth.spec.ts` (linha 116, o texto do 2º parágrafo da saudação; **LER antes**)
- Modify: `src/app/(app)/page.tsx` (passa a receber `searchParams` e renderiza `HomeHandovers` num segundo `<Suspense>`)
- Modify: `src/app/actionsGuards.test.ts` (Tarefa 3 criou; **LER antes**; sobe `MIN_APP_ACTION_FILES` de 0 para 1)
- Modify: `.context/ui-registry.md` (novo bloco "Passagem de turno" + linha de histórico do `Greeting`; **LER antes**)
- Test: `src/features/handovers/sectorCookie.test.ts` (Create)
- Test: `src/app/(app)/actions.test.ts` (Create)
- Test: `src/components/passagens/SectorPicker.test.tsx` (Create)
- Test: `src/components/passagens/HandoverStatusBadge.test.tsx` (Create)
- Test: `src/components/passagens/PendingHandoverCard.test.tsx` (Create)
- Test: `src/components/passagens/MyShiftCard.test.tsx` (Create)
- Test: `src/components/passagens/HomeHandovers.test.tsx` (Create)
- Test: `src/components/app-shell/navItems.test.ts`, `src/components/app-shell/AppSidebar.test.tsx`, `src/components/app-shell/Greeting.test.tsx` (Modify; **LER antes**)

**Interfaces:**
- Consumes (Tarefas 1–6 e Fase 2, nomes e assinaturas do contrato):
  - `getHomeHandovers(db: Db, actor: Authz, sectorId: string, now: Date): Promise<AdminResult<{ home: HomeHandovers }>>` e os tipos `PendingHandover`, `MyShiftState`, `HomeHandovers` de `@/features/handovers/home` (Tarefa 6)
  - `loadSector(db: Db, actor: Authz, sectorId: string): Promise<SectorRow | null>` de `@/features/handovers/loaders` (Tarefa 4)
  - `resolveHandoverSector(sectors: readonly SectorChoice[], sources: { url: string | string[] | undefined; cookie: string | undefined }, options?: { allowAll?: boolean }): SectorSelection` e `type SectorSelection = { kind: "sector"; sector: SectorChoice } | { kind: "all" } | { kind: "none" }` de `@/features/handovers/sectorChoice` (**Tarefa 2 é a única dona**: lista vazia devolve `none`, mesmo com `?setor=todos`)
  - `chooseSectorSchema` de `@/features/handovers/schemas` (Tarefa 3); `SECTOR_PICKER_PATHS`, `chooseSectorPath`, `handoverHref`, `newHandoverHref`, `SectorPickerPath` de `urls.ts`; `ALL_SECTORS`, `SECTOR_COOKIE`, `SECTOR_COOKIE_MAX_AGE_SECONDS` de `limits.ts`; `SECTOR_INACTIVE_HANDOVER_MESSAGE` de `messages.ts`; `situationLabel`, `CORRECTED_LABEL`, `HistorySituation` de `status.ts`; `formatDateBR`, `formatTimeBR` de `saoPaulo.ts` (Tarefa 2)
  - `listActiveSectors(db)` e `SectorChoice` de `@/features/admin/sectors`; `notFoundMessage`; `AdminResult`, `fail`, `INVALID_INPUT_MESSAGE`, `INTERNAL_ERROR_MESSAGE` de `@/features/admin/result`; `EmptyState` de `@/components/admin/EmptyState`; `requireUser`, `requireAdmin` de `@/lib/auth/session` (Fases 1 e 2)
  - Fixtures `insertSector`, `insertShift`, `insertUser`, `insertHandover` e `spDate` de `test/fixtures.ts` / `test/clock.ts` (Tarefa 1); `authzOf` de `test/authz.ts`
- Produces (as Tarefas 8–10 usam):
  - `readRememberedSector(): Promise<string | undefined>` e `rememberSector(sectorId: string): Promise<void>` (`@/features/handovers/sectorCookie`, `server-only`)
  - `chooseSectorAction(input: unknown): Promise<AdminResult>` (`@/app/(app)/actions`)
  - `SectorPicker(props: { sectors: readonly SectorChoice[]; selectedId: string | typeof ALL_SECTORS; path: SectorPickerPath; allowAll?: boolean })`
  - `HandoverStatusBadge(props: { situation: HistorySituation; confirmedByName?: string | null; corrected?: boolean })`
  - `PendingHandoverCard(props: { pending: PendingHandover })`, `MyShiftCard(props: { state: MyShiftState; sectorId: string; canManageCatalog: boolean; sectorParam: string | null })`, `HomeHandovers(props: { searchParams: Promise<Record<string, string | string[] | undefined>> })`

- [ ] **Step 1: Subir o mínimo de arquivos de action no guarda (vermelho de propósito)**

Leia `src/app/actionsGuards.test.ts` e troque a linha

```ts
const MIN_APP_ACTION_FILES = 0;
```

por

```ts
const MIN_APP_ACTION_FILES = 1;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/app/actionsGuards.test.ts`
Expected: FAIL em "encontra os arquivos de actions" com `AssertionError: expected 0 to be greater than or equal to 1` (ainda não existe `src/app/(app)/actions.ts`).

- [ ] **Step 3: Write the failing test (cookie do setor)**

`src/features/handovers/sectorCookie.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.get, set: mocks.set }),
}));

import { readRememberedSector, rememberSector } from "./sectorCookie";

describe("sectorCookie", () => {
  beforeEach(() => {
    mocks.get.mockReset();
    mocks.set.mockReset();
    vi.unstubAllEnvs();
  });

  it("lê o valor do cookie closery_setor", async () => {
    mocks.get.mockReturnValue({ name: "closery_setor", value: "setor-1" });

    expect(await readRememberedSector()).toBe("setor-1");
    expect(mocks.get).toHaveBeenCalledWith("closery_setor");
  });

  it("sem cookie, devolve undefined", async () => {
    mocks.get.mockReturnValue(undefined);

    expect(await readRememberedSector()).toBeUndefined();
  });

  it("grava com os atributos de F3-15 (fora de produção, sem secure)", async () => {
    vi.stubEnv("NODE_ENV", "test");

    await rememberSector("setor-1");

    expect(mocks.set).toHaveBeenCalledWith("closery_setor", "setor-1", {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 31_536_000,
    });
  });

  it("em produção o cookie é secure", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await rememberSector("setor-1");

    expect(mocks.set).toHaveBeenCalledWith(
      "closery_setor",
      "setor-1",
      expect.objectContaining({ secure: true }),
    );
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `bun run test -- src/features/handovers/sectorCookie.test.ts`
Expected: FAIL com `Error: Cannot find module '/src/features/handovers/sectorCookie' imported from …/sectorCookie.test.ts` (o arquivo de teste usa `vi.mock`, e com mock o Vitest mostra o caminho absoluto a partir da raiz).

- [ ] **Step 5: Write minimal implementation**

`src/features/handovers/sectorCookie.ts`:

```ts
import "server-only";

import { cookies } from "next/headers";

import { SECTOR_COOKIE, SECTOR_COOKIE_MAX_AGE_SECONDS } from "./limits";

/** Setor lembrado do admin. Chame dentro de <Suspense> (lê `cookies()`). */
export async function readRememberedSector(): Promise<string | undefined> {
  return (await cookies()).get(SECTOR_COOKIE)?.value;
}

/** Só dentro de Server Action ou Route Handler: `.set` não vale em render. */
export async function rememberSector(sectorId: string): Promise<void> {
  (await cookies()).set(SECTOR_COOKIE, sectorId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SECTOR_COOKIE_MAX_AGE_SECONDS,
  });
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun run test -- src/features/handovers/sectorCookie.test.ts`
Expected: PASS (4 testes)

- [ ] **Step 7: Write the failing test (`chooseSectorAction`)**

`src/app/(app)/actions.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { authzOf } from "../../../test/authz";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertSector } from "../../../test/fixtures";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  cookieSet: vi.fn(),
  database: { current: undefined as unknown },
  touched: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.cookieSet }),
}));
vi.mock("@/db", () => ({
  get db() {
    mocks.touched();
    return mocks.database.current;
  },
}));

import { chooseSectorAction } from "./actions";

const NOT_FOUND = Object.assign(new Error("NEXT_HTTP_ERROR_FALLBACK;404"), {
  digest: "NEXT_HTTP_ERROR_FALLBACK;404",
});

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
  mocks.database.current = db;
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
  mocks.requireAdmin.mockReset();
  mocks.cookieSet.mockReset();
  mocks.touched.mockReset();
  mocks.requireAdmin.mockResolvedValue(authzOf({ role: "admin" }));
});

// redirect() lança um erro cujo `digest` carrega o destino.
async function redirectDigest(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error && "digest" in error) {
      return String(error.digest);
    }
    throw error;
  }
  throw new Error("a action devia redirecionar");
}

describe("chooseSectorAction", () => {
  it("operador recebe notFound e nada é tocado (nem banco, nem cookie)", async () => {
    mocks.requireAdmin.mockRejectedValue(NOT_FOUND);

    await expect(chooseSectorAction({ sectorId: "x", path: "/" })).rejects.toBe(
      NOT_FOUND,
    );

    expect(mocks.touched).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("grava o cookie com os atributos certos e redireciona", async () => {
    const created = await insertSector(db, "ULD");

    const digest = await redirectDigest(
      chooseSectorAction({ sectorId: created.id, path: "/passagens" }),
    );

    expect(digest).toContain(`/passagens?setor=${created.id}`);
    expect(mocks.cookieSet).toHaveBeenCalledWith("closery_setor", created.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 31_536_000,
    });
  });

  it.each([
    "/",
    "/passagens",
    "/passagens/nova",
  ] as const)("redireciona para o caminho permitido %s", async (path) => {
    const created = await insertSector(db);

    const digest = await redirectDigest(
      chooseSectorAction({ sectorId: created.id, path }),
    );

    expect(digest).toContain(`${path}?setor=${created.id}`);
  });

  it("'todos' redireciona sem gravar cookie", async () => {
    const digest = await redirectDigest(
      chooseSectorAction({ sectorId: "todos", path: "/passagens" }),
    );

    expect(digest).toContain("/passagens?setor=todos");
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("caminho fora da lista é entrada inválida (sem cookie, sem redirect)", async () => {
    const created = await insertSector(db);

    const result = await chooseSectorAction({
      sectorId: created.id,
      path: "/admin/setores",
    });

    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("id malformado é entrada inválida", async () => {
    const result = await chooseSectorAction({ sectorId: "abc", path: "/" });

    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });

  it("setor inexistente: NOT_FOUND, sem cookie", async () => {
    const result = await chooseSectorAction({
      sectorId: "99999999-9999-4999-8999-999999999999",
      path: "/",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
      message: "Setor não encontrado. Atualize a página.",
    });
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("setor inativo: SECTOR_INACTIVE, sem cookie", async () => {
    const created = await insertSector(db, "Parado", { active: false });

    const result = await chooseSectorAction({
      sectorId: created.id,
      path: "/",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "SECTOR_INACTIVE",
      message:
        "Este setor está inativo. Peça a um administrador para reativá-lo.",
    });
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 8: Run test to verify it fails**

Run: `bun run test -- "src/app/(app)/actions.test.ts"`
Expected: FAIL com `Error: Cannot find module '/src/app/(app)/actions' imported from …/actions.test.ts`.

- [ ] **Step 9: Write minimal implementation**

`src/app/(app)/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";

import { db } from "@/db";
import { notFoundMessage } from "@/features/admin/messages";
import {
  type AdminResult,
  fail,
  INVALID_INPUT_MESSAGE,
} from "@/features/admin/result";
import { ALL_SECTORS } from "@/features/handovers/limits";
import { loadSector } from "@/features/handovers/loaders";
import { SECTOR_INACTIVE_HANDOVER_MESSAGE } from "@/features/handovers/messages";
import { chooseSectorSchema } from "@/features/handovers/schemas";
import { rememberSector } from "@/features/handovers/sectorCookie";
import { chooseSectorPath } from "@/features/handovers/urls";
import { requireAdmin } from "@/lib/auth/session";

// Escolha de setor do admin (D-F3-3, F3-15): grava o cookie e navega para o
// mesmo caminho com ?setor=. Só devolve falha; o sucesso é o redirect.
export async function chooseSectorAction(input: unknown): Promise<AdminResult> {
  const actor = await requireAdmin();
  const parsed = chooseSectorSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID_INPUT", INVALID_INPUT_MESSAGE);
  const { sectorId, path } = parsed.data;

  if (sectorId !== ALL_SECTORS) {
    const found = await loadSector(db, actor, sectorId);
    if (!found) return fail("NOT_FOUND", notFoundMessage("setor"));
    if (!found.active) {
      return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_HANDOVER_MESSAGE);
    }
    await rememberSector(sectorId);
  }

  // Fora de try/catch: redirect() lança de propósito.
  redirect(chooseSectorPath(path, sectorId));
}
```

- [ ] **Step 10: Run test to verify it passes**

Run: `bun run test -- "src/app/(app)/actions.test.ts" src/app/actionsGuards.test.ts`
Expected: PASS (10 testes em `actions.test.ts`; o guarda volta a passar porque agora há 1 arquivo de action fora do admin)

- [ ] **Step 11: Write the failing test (`SectorPicker`)**

`src/components/passagens/SectorPicker.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { redirect } from "next/navigation";
import { Component, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SectorPicker } from "./SectorPicker";

const mocks = vi.hoisted(() => ({
  chooseSectorAction: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/actions", () => ({
  chooseSectorAction: mocks.chooseSectorAction,
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

const ULD = { id: "11111111-1111-4111-8111-111111111111", name: "ULD" };
const CARGA = { id: "22222222-2222-4222-8222-222222222222", name: "Carga" };

class Catcher extends Component<{ children: ReactNode }, { error: unknown }> {
  state: { error: unknown } = { error: null };
  static getDerivedStateFromError(error: unknown) {
    return { error };
  }
  render() {
    return this.state.error ? <p>capturado</p> : this.props.children;
  }
}

describe("SectorPicker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    mocks.chooseSectorAction.mockReset();
    mocks.toastError.mockReset();
  });

  it("um botão por setor, o selecionado com aria-pressed", () => {
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    expect(screen.getByRole("group", { name: "Setor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ULD" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Carga" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("clicar em outro setor chama a action com setor e caminho", async () => {
    mocks.chooseSectorAction.mockResolvedValue({ ok: true });
    render(
      <SectorPicker
        sectors={[ULD, CARGA]}
        selectedId={ULD.id}
        path="/passagens/nova"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Carga" }));

    expect(mocks.chooseSectorAction).toHaveBeenCalledWith({
      sectorId: CARGA.id,
      path: "/passagens/nova",
    });
  });

  it("clicar no setor já selecionado não chama a action", async () => {
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    await userEvent.click(screen.getByRole("button", { name: "ULD" }));

    expect(mocks.chooseSectorAction).not.toHaveBeenCalled();
  });

  it("falha da action vira toast com a mensagem", async () => {
    mocks.chooseSectorAction.mockResolvedValue({
      ok: false,
      code: "SECTOR_INACTIVE",
      message:
        "Este setor está inativo. Peça a um administrador para reativá-lo.",
    });
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Carga" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Este setor está inativo. Peça a um administrador para reativá-lo.",
      ),
    );
  });

  it("exceção de rede vira o toast genérico", async () => {
    mocks.chooseSectorAction.mockRejectedValue(new Error("Failed to fetch"));
    render(
      <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Carga" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Não foi possível concluir. Tente de novo.",
      ),
    );
  });

  it("o redirect do sucesso segue adiante: sem toast", async () => {
    mocks.chooseSectorAction.mockImplementation(async () => {
      redirect("/?setor=x");
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <Catcher>
        <SectorPicker sectors={[ULD, CARGA]} selectedId={ULD.id} path="/" />
      </Catcher>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Carga" }));

    expect(await screen.findByText("capturado")).toBeInTheDocument();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("allowAll acrescenta 'Todos os setores'", async () => {
    mocks.chooseSectorAction.mockResolvedValue({ ok: true });
    render(
      <SectorPicker
        sectors={[ULD]}
        selectedId="todos"
        path="/passagens"
        allowAll
      />,
    );

    expect(
      screen.getByRole("button", { name: "Todos os setores" }),
    ).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(screen.getByRole("button", { name: "ULD" }));
    expect(mocks.chooseSectorAction).toHaveBeenCalledWith({
      sectorId: ULD.id,
      path: "/passagens",
    });
  });

  it("sem allowAll não há 'Todos os setores'", () => {
    render(<SectorPicker sectors={[ULD]} selectedId={ULD.id} path="/" />);

    expect(
      screen.queryByRole("button", { name: "Todos os setores" }),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 12: Run test to verify it fails**

Run: `bun run test -- src/components/passagens/SectorPicker.test.tsx`
Expected: FAIL com `Error: Failed to resolve import "./SectorPicker" from "src/components/passagens/SectorPicker.test.tsx". Does the file exist?`

- [ ] **Step 13: Write minimal implementation**

`src/components/passagens/SectorPicker.tsx`:

```tsx
"use client";

import { unstable_rethrow } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { chooseSectorAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { INTERNAL_ERROR_MESSAGE } from "@/features/admin/result";
import type { SectorChoice } from "@/features/admin/sectors";
import { ALL_SECTORS } from "@/features/handovers/limits";
import type { SectorPickerPath } from "@/features/handovers/urls";

// Escolha de setor do admin: grava o cookie e navega pela Server Action
// (F3-15). Clicar no setor já selecionado não faz nada.
export function SectorPicker({
  sectors,
  selectedId,
  path,
  allowAll = false,
}: {
  sectors: readonly SectorChoice[];
  selectedId: string | typeof ALL_SECTORS;
  path: SectorPickerPath;
  allowAll?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const options: readonly SectorChoice[] = allowAll
    ? [...sectors, { id: ALL_SECTORS, name: "Todos os setores" }]
    : sectors;

  function choose(sectorId: string) {
    if (sectorId === selectedId) return;
    startTransition(async () => {
      try {
        const result = await chooseSectorAction({ sectorId, path });
        if (!result.ok) toast.error(result.message);
      } catch (error) {
        // O sucesso da action é um redirect, que chega aqui como exceção.
        unstable_rethrow(error);
        toast.error(INTERNAL_ERROR_MESSAGE);
      }
    });
  }

  return (
    <FieldSet className="flex-row flex-wrap gap-2">
      <FieldLegend className="sr-only">Setor</FieldLegend>
      {options.map((option) => {
        const selected = option.id === selectedId;
        return (
          <Button
            key={option.id}
            type="button"
            variant={selected ? "default" : "outline"}
            aria-pressed={selected}
            disabled={pending}
            onClick={() => choose(option.id)}
          >
            {option.name}
          </Button>
        );
      })}
    </FieldSet>
  );
}
```

- [ ] **Step 14: Run test to verify it passes**

Run: `bun run test -- src/components/passagens/SectorPicker.test.tsx`
Expected: PASS (8 testes)

- [ ] **Step 15: Write the failing test (`HandoverStatusBadge`)**

`src/components/passagens/HandoverStatusBadge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { HandoverStatusBadge } from "./HandoverStatusBadge";

describe("HandoverStatusBadge", () => {
  it.each([
    ["awaiting", "Aguardando recebimento"],
    ["unconfirmed", "Não confirmada"],
    ["missing", "Sem passagem"],
    ["confirmed", "Confirmada"],
  ] as const)("%s mostra o texto e um ícone (nunca só cor)", (situation, text) => {
    const { container } = render(<HandoverStatusBadge situation={situation} />);

    expect(screen.getByText(text)).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("confirmada com nome diz quem confirmou", () => {
    render(
      <HandoverStatusBadge situation="confirmed" confirmedByName="Bia Teste" />,
    );

    expect(screen.getByText("Confirmada por Bia Teste")).toBeInTheDocument();
  });

  it("sem 'corrected' não mostra o selo Corrigida", () => {
    render(<HandoverStatusBadge situation="awaiting" />);

    expect(screen.queryByText("Corrigida")).not.toBeInTheDocument();
  });

  it("com 'corrected' mostra o selo Corrigida ao lado da situação", () => {
    render(<HandoverStatusBadge situation="confirmed" corrected />);

    expect(screen.getByText("Corrigida")).toBeInTheDocument();
    expect(screen.getByText("Confirmada")).toBeInTheDocument();
  });

  it("usa só tokens de cor (sem classe crua do Tailwind)", () => {
    const { container } = render(
      <HandoverStatusBadge situation="unconfirmed" corrected />,
    );

    expect(container.innerHTML).not.toMatch(
      /\b(?:bg|text|border)-(?:red|green|blue|yellow|amber|orange|gray|slate|zinc)-\d+/,
    );
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});
```

- [ ] **Step 16: Run test to verify it fails**

Run: `bun run test -- src/components/passagens/HandoverStatusBadge.test.tsx`
Expected: FAIL com `Error: Failed to resolve import "./HandoverStatusBadge" from "src/components/passagens/HandoverStatusBadge.test.tsx". Does the file exist?`

- [ ] **Step 17: Write minimal implementation**

`src/components/passagens/HandoverStatusBadge.tsx`:

```tsx
import {
  CircleCheck,
  CircleSlash,
  Clock,
  PencilLine,
  TriangleAlert,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  CORRECTED_LABEL,
  type HistorySituation,
  situationLabel,
} from "@/features/handovers/status";

const SITUATION_STYLE = {
  awaiting: { icon: Clock, className: "bg-info text-info-foreground" },
  confirmed: {
    icon: CircleCheck,
    className: "bg-success text-success-foreground",
  },
  unconfirmed: {
    icon: TriangleAlert,
    className: "bg-warning text-warning-foreground",
  },
  missing: {
    icon: CircleSlash,
    className: "bg-muted text-muted-foreground",
  },
} as const satisfies Record<
  HistorySituation,
  { icon: typeof Clock; className: string }
>;

// Situação sempre com ícone e texto, nunca só cor.
export function HandoverStatusBadge({
  situation,
  confirmedByName,
  corrected = false,
}: {
  situation: HistorySituation;
  confirmedByName?: string | null;
  corrected?: boolean;
}) {
  const { icon: Icon, className } = SITUATION_STYLE[situation];
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary" className={`h-6 ${className}`}>
        <Icon aria-hidden="true" />
        {situationLabel(situation, confirmedByName)}
      </Badge>
      {corrected && (
        <Badge variant="outline" className="h-6">
          <PencilLine aria-hidden="true" />
          {CORRECTED_LABEL}
        </Badge>
      )}
    </span>
  );
}
```

- [ ] **Step 18: Run test to verify it passes**

Run: `bun run test -- src/components/passagens/HandoverStatusBadge.test.tsx`
Expected: PASS (8 testes)

- [ ] **Step 19: Write the failing tests (cartões do Início)**

`src/components/passagens/PendingHandoverCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PendingHandover } from "@/features/handovers/home";
import { spDate } from "../../../test/clock";
import { PendingHandoverCard } from "./PendingHandoverCard";

function pending(overrides: Partial<PendingHandover> = {}): PendingHandover {
  return {
    id: "h1",
    sectorName: "ULD",
    shiftName: "Turno Manhã",
    operationalDate: "2026-11-20",
    deliveredByName: "Ana Teste",
    deliveredAt: spDate("2026-11-20", "14:05"),
    nextShiftPreview: "Rede de proteção no box 4.",
    ...overrides,
  };
}

describe("PendingHandoverCard", () => {
  it("mostra título, turno e data, quem entregou e o que fica para o próximo turno", () => {
    render(<PendingHandoverCard pending={pending()} />);

    expect(
      screen.getByRole("heading", { name: "Passagem para confirmar" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Turno Manhã · 20/11/2026")).toBeInTheDocument();
    expect(
      screen.getByText("Entregue às 14:05 por Ana Teste"),
    ).toBeInTheDocument();
    expect(screen.getByText("Fica para o próximo turno")).toBeInTheDocument();
    expect(screen.getByText("Rede de proteção no box 4.")).toBeInTheDocument();
  });

  it("sem texto para o próximo turno, avisa que nada foi registrado", () => {
    render(
      <PendingHandoverCard pending={pending({ nextShiftPreview: null })} />,
    );

    expect(
      screen.getByText("Nada registrado para o próximo turno."),
    ).toBeInTheDocument();
  });

  it("'Ver passagem' é link para o resumo da passagem", () => {
    render(<PendingHandoverCard pending={pending({ id: "abc" })} />);

    expect(screen.getByRole("link", { name: "Ver passagem" })).toHaveAttribute(
      "href",
      "/passagens/abc",
    );
  });

  it("não tem botão de confirmar (a confirmação é no resumo)", () => {
    render(<PendingHandoverCard pending={pending()} />);

    expect(
      screen.queryByRole("button", { name: "Confirmar recebimento" }),
    ).not.toBeInTheDocument();
  });
});
```

`src/components/passagens/MyShiftCard.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MyShiftState } from "@/features/handovers/home";
import { spDate } from "../../../test/clock";
import { MyShiftCard } from "./MyShiftCard";

const SECTOR_ID = "11111111-1111-4111-8111-111111111111";
const SHIFT = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Turno Manhã",
  startsAt: "06:00",
  endsAt: "14:00",
};
const REF = {
  sectorId: SECTOR_ID,
  shiftId: SHIFT.id,
  operationalDate: "2026-11-20",
};

function renderCard(
  state: MyShiftState,
  props: { canManageCatalog?: boolean; sectorParam?: string | null } = {},
) {
  return render(
    <MyShiftCard
      state={state}
      sectorId={SECTOR_ID}
      canManageCatalog={props.canManageCatalog ?? false}
      sectorParam={props.sectorParam ?? null}
    />,
  );
}

describe("MyShiftCard", () => {
  it("start: turno, horário, data, nota de sugestão e 'Começar passagem'", () => {
    renderCard({ kind: "start", ref: REF, shift: SHIFT, saved: null });

    expect(
      screen.getByRole("heading", { name: "Passagem do meu turno" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          element.textContent === "Turno Manhã · 06:00–14:00 · 20/11/2026",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Turno sugerido pelo horário de agora."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Começar passagem" }),
    ).toHaveAttribute(
      "href",
      `/passagens/nova?turno=${SHIFT.id}&data=2026-11-20`,
    );
  });

  it("start de admin leva o setor na URL", () => {
    renderCard(
      { kind: "start", ref: REF, shift: SHIFT, saved: null },
      { sectorParam: SECTOR_ID },
    );

    expect(
      screen.getByRole("link", { name: "Começar passagem" }),
    ).toHaveAttribute(
      "href",
      `/passagens/nova?turno=${SHIFT.id}&data=2026-11-20&setor=${SECTOR_ID}`,
    );
  });

  it("continue: mostra quando e por quem o rascunho foi salvo", () => {
    renderCard({
      kind: "continue",
      ref: REF,
      shift: SHIFT,
      saved: { at: spDate("2026-11-20", "13:41"), byName: "Ana Teste" },
    });

    expect(
      screen.getByText("Rascunho salvo às 13:41 por Ana Teste"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continuar passagem" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Começar passagem" }),
    ).not.toBeInTheDocument();
  });

  it("continue sem marca de salvamento não inventa a frase", () => {
    renderCard({ kind: "continue", ref: REF, shift: SHIFT, saved: null });

    expect(screen.queryByText(/Rascunho salvo/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Continuar passagem" }),
    ).toBeInTheDocument();
  });

  it("delivered: quem entregou, aguardando recebimento e link para a passagem", () => {
    renderCard({
      kind: "delivered",
      handoverId: "h1",
      ref: REF,
      shift: SHIFT,
      deliveredByName: "Ana Teste",
      deliveredAt: spDate("2026-11-20", "14:05"),
      confirmedByName: null,
      confirmedAt: null,
    });

    expect(
      screen.getByText(
        "Entregue às 14:05 por Ana Teste. Aguardando recebimento.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver passagem" })).toHaveAttribute(
      "href",
      "/passagens/h1",
    );
    expect(
      screen.queryByRole("link", { name: "Começar passagem" }),
    ).not.toBeInTheDocument();
  });

  it("confirmed: entrega e confirmação com nomes e horas", () => {
    renderCard({
      kind: "confirmed",
      handoverId: "h1",
      ref: REF,
      shift: SHIFT,
      deliveredByName: "Ana Teste",
      deliveredAt: spDate("2026-11-20", "14:05"),
      confirmedByName: "Bia Teste",
      confirmedAt: spDate("2026-11-20", "14:20"),
    });

    expect(
      screen.getByText(
        "Entregue por Ana Teste às 14:05. Confirmada por Bia Teste às 14:20.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver passagem" })).toHaveAttribute(
      "href",
      "/passagens/h1",
    );
  });

  it.each([
    [{ kind: "start", ref: REF, shift: SHIFT, saved: null }],
    [{ kind: "continue", ref: REF, shift: SHIFT, saved: null }],
    [
      {
        kind: "delivered",
        handoverId: "h1",
        ref: REF,
        shift: SHIFT,
        deliveredByName: "Ana Teste",
        deliveredAt: spDate("2026-11-20", "14:05"),
        confirmedByName: null,
        confirmedAt: null,
      },
    ],
    [
      {
        kind: "confirmed",
        handoverId: "h1",
        ref: REF,
        shift: SHIFT,
        deliveredByName: "Ana Teste",
        deliveredAt: spDate("2026-11-20", "14:05"),
        confirmedByName: "Bia Teste",
        confirmedAt: spDate("2026-11-20", "14:20"),
      },
    ],
  ] as const satisfies readonly (readonly [
    MyShiftState,
  ])[])("estado %# tem o link secundário 'Ver todas as passagens'", (state) => {
    renderCard(state);

    expect(
      screen.getByRole("link", { name: "Ver todas as passagens" }),
    ).toHaveAttribute("href", "/passagens");
  });

  it("sem turnos, operador: pede ao administrador e não mostra link", () => {
    renderCard({ kind: "no-shifts" });

    expect(screen.getByText("Nenhum turno neste setor.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Peça a um administrador para cadastrar os turnos do setor.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ir para Turnos" }),
    ).not.toBeInTheDocument();
  });

  it("sem turnos, admin: texto próprio e link para Turnos do setor", () => {
    renderCard({ kind: "no-shifts" }, { canManageCatalog: true });

    expect(
      screen.getByText("Cadastre os turnos do setor para começar a passagem."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Turnos" }),
    ).toHaveAttribute("href", `/admin/turnos?setor=${SECTOR_ID}`);
  });

  it("o horário usa tabular-nums", () => {
    renderCard({ kind: "start", ref: REF, shift: SHIFT, saved: null });

    expect(screen.getByText("06:00–14:00")).toHaveClass("tabular-nums");
  });
});
```

- [ ] **Step 20: Run test to verify it fails**

Run: `bun run test -- src/components/passagens/PendingHandoverCard.test.tsx src/components/passagens/MyShiftCard.test.tsx`
Expected: FAIL nos dois arquivos com `Error: Failed to resolve import "./PendingHandoverCard"` e `Failed to resolve import "./MyShiftCard"`.

- [ ] **Step 21: Write minimal implementation**

`src/components/passagens/PendingHandoverCard.tsx`:

```tsx
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PendingHandover } from "@/features/handovers/home";
import { formatDateBR, formatTimeBR } from "@/features/handovers/saoPaulo";
import { handoverHref } from "@/features/handovers/urls";

// Cartão do topo do Início: a passagem mais recente do setor (entre entregues
// e confirmadas), se ainda espera recebimento (F3-6). O servidor já escondeu
// de quem entregou.
export function PendingHandoverCard({ pending }: { pending: PendingHandover }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Passagem para confirmar</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-medium">
            {pending.shiftName} · {formatDateBR(pending.operationalDate)}
          </p>
          <p className="text-sm text-muted-foreground">
            Entregue às {formatTimeBR(pending.deliveredAt)} por{" "}
            {pending.deliveredByName}
          </p>
        </div>
        <div className="flex flex-col gap-1 rounded-lg border-l-4 border-warning-foreground/40 bg-warning/40 p-3">
          <p className="text-sm font-medium">Fica para o próximo turno</p>
          <p className="text-sm whitespace-pre-line">
            {pending.nextShiftPreview ??
              "Nada registrado para o próximo turno."}
          </p>
        </div>
        <Link
          href={handoverHref(pending.id)}
          className={`${buttonVariants()} w-fit`}
        >
          Ver passagem
        </Link>
      </CardContent>
    </Card>
  );
}
```

`src/components/passagens/MyShiftCard.tsx`:

```tsx
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MyShiftState } from "@/features/handovers/home";
import { formatDateBR, formatTimeBR } from "@/features/handovers/saoPaulo";
import { handoverHref, newHandoverHref } from "@/features/handovers/urls";

function NoShifts({
  sectorId,
  canManageCatalog,
}: {
  sectorId: string;
  canManageCatalog: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Passagem do meu turno</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-medium">Nenhum turno neste setor.</p>
          <p className="text-sm text-muted-foreground">
            {canManageCatalog
              ? "Cadastre os turnos do setor para começar a passagem."
              : "Peça a um administrador para cadastrar os turnos do setor."}
          </p>
        </div>
        {canManageCatalog && (
          <Link
            href={`/admin/turnos?setor=${sectorId}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Ir para Turnos
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export function MyShiftCard({
  state,
  sectorId,
  canManageCatalog,
  sectorParam,
}: {
  state: MyShiftState;
  sectorId: string;
  canManageCatalog: boolean;
  sectorParam: string | null;
}) {
  if (state.kind === "no-shifts") {
    return <NoShifts sectorId={sectorId} canManageCatalog={canManageCatalog} />;
  }

  const { shift, ref } = state;
  const newHref = newHandoverHref(ref, sectorParam ?? undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Passagem do meu turno</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="font-medium">
            {shift.name} ·{" "}
            <span className="tabular-nums">
              {shift.startsAt}–{shift.endsAt}
            </span>{" "}
            · {formatDateBR(ref.operationalDate)}
          </p>
          <p className="text-sm text-muted-foreground">
            Turno sugerido pelo horário de agora.
          </p>
        </div>

        {state.kind === "start" && (
          <Link href={newHref} className={`${buttonVariants()} w-fit`}>
            Começar passagem
          </Link>
        )}

        {state.kind === "continue" && (
          <>
            {state.saved && (
              <p className="text-sm">
                Rascunho salvo às {formatTimeBR(state.saved.at)} por{" "}
                {state.saved.byName}
              </p>
            )}
            <Link href={newHref} className={`${buttonVariants()} w-fit`}>
              Continuar passagem
            </Link>
          </>
        )}

        {state.kind === "delivered" && (
          <>
            <p className="text-sm">
              Entregue às {formatTimeBR(state.deliveredAt)} por{" "}
              {state.deliveredByName}. Aguardando recebimento.
            </p>
            <Link
              href={handoverHref(state.handoverId)}
              className={`${buttonVariants({ variant: "outline" })} w-fit`}
            >
              Ver passagem
            </Link>
          </>
        )}

        {state.kind === "confirmed" && (
          <>
            <p className="text-sm">
              Entregue por {state.deliveredByName} às{" "}
              {formatTimeBR(state.deliveredAt)}. Confirmada por{" "}
              {state.confirmedByName ?? "outra pessoa"}
              {state.confirmedAt
                ? ` às ${formatTimeBR(state.confirmedAt)}`
                : ""}
              .
            </p>
            <Link
              href={handoverHref(state.handoverId)}
              className={`${buttonVariants({ variant: "outline" })} w-fit`}
            >
              Ver passagem
            </Link>
          </>
        )}

        <Link
          href="/passagens"
          className={`${buttonVariants({ variant: "link" })} w-fit px-0`}
        >
          Ver todas as passagens
        </Link>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 22: Run test to verify it passes**

Run: `bun run test -- src/components/passagens/PendingHandoverCard.test.tsx src/components/passagens/MyShiftCard.test.tsx`
Expected: PASS (4 + 13 = 17 testes)

- [ ] **Step 23: Write the failing test (`HomeHandovers`, com PGlite)**

`src/components/passagens/HomeHandovers.test.tsx`:

```tsx
import type { PGlite } from "@electric-sql/pglite";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { resetDb } from "../../../test/db";
import {
  insertHandover,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { HomeHandovers } from "./HomeHandovers";

const mocks = vi.hoisted(
  (): {
    requireUser: ReturnType<typeof vi.fn>;
    cookie: { value: string | undefined };
    client: PGlite | undefined;
  } => ({
    requireUser: vi.fn(),
    cookie: { value: undefined },
    client: undefined,
  }),
);

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "closery_setor" && mocks.cookie.value !== undefined
        ? { name, value: mocks.cookie.value }
        : undefined,
  }),
}));
vi.mock("@/app/(app)/actions", () => ({ chooseSectorAction: vi.fn() }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});

const TODAY = "2026-11-20";

async function renderHome(search: Record<string, string> = {}) {
  render(await HomeHandovers({ searchParams: Promise.resolve(search) }));
}

async function setup() {
  const uld = await insertSector(db, "ULD");
  const shiftRow = await insertShift(db, {
    sectorId: uld.id,
    name: "Turno Manhã",
    startsAt: "06:00",
    endsAt: "14:00",
  });
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Bia Teste",
  });
  return { uld, shiftRow, ana, bia };
}

describe("HomeHandovers", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireUser.mockReset();
    mocks.cookie.value = undefined;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(spDate(TODAY, "10:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sem sessão, propaga o redirect do requireUser", async () => {
    const redirectError = new Error("NEXT_REDIRECT");
    mocks.requireUser.mockRejectedValue(redirectError);

    await expect(
      HomeHandovers({ searchParams: Promise.resolve({}) }),
    ).rejects.toBe(redirectError);
  });

  it("operador sem passagem: só o cartão do turno, 'Começar passagem', sem seletor", async () => {
    const { uld, shiftRow, ana } = await setup();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
    );

    await renderHome();

    expect(
      screen.queryByRole("heading", { name: "Passagem para confirmar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Passagem do meu turno" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Começar passagem" }),
    ).toHaveAttribute(
      "href",
      `/passagens/nova?turno=${shiftRow.id}&data=${TODAY}`,
    );
    expect(
      screen.queryByRole("group", { name: "Setor" }),
    ).not.toBeInTheDocument();
  });

  it("não mostra cartão de solicitações nesta fase", async () => {
    const { uld, ana } = await setup();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
    );

    await renderHome();

    expect(screen.queryByText(/solicita/i)).not.toBeInTheDocument();
  });

  it("rascunho existente vira 'Continuar passagem'", async () => {
    const { uld, shiftRow, ana } = await setup();
    await insertHandover(db, {
      sectorId: uld.id,
      shiftId: shiftRow.id,
      operationalDate: TODAY,
      updatedBy: ana.id,
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
    );

    await renderHome();

    expect(
      screen.getByRole("link", { name: "Continuar passagem" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Rascunho salvo às .* por Ana Teste/),
    ).toBeInTheDocument();
  });

  it("passagem entregue por outra pessoa aparece no topo para confirmar", async () => {
    const { uld, shiftRow, ana, bia } = await setup();
    const delivered = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: shiftRow.id,
      operationalDate: "2026-11-19",
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: spDate("2026-11-19", "14:05"),
      nextShiftText: "Conferir a rede do box 4.",
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: bia.id, sectorId: uld.id }),
    );

    await renderHome();

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Passagem para confirmar",
      "Passagem do meu turno",
    ]);
    expect(screen.getByText("Conferir a rede do box 4.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver passagem" })).toHaveAttribute(
      "href",
      `/passagens/${delivered.id}`,
    );
  });

  it("quem entregou não vê o cartão de confirmar, só o próprio turno aguardando", async () => {
    const { uld, shiftRow, ana } = await setup();
    await insertHandover(db, {
      sectorId: uld.id,
      shiftId: shiftRow.id,
      operationalDate: TODAY,
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: spDate(TODAY, "09:30"),
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
    );

    await renderHome();

    expect(
      screen.queryByRole("heading", { name: "Passagem para confirmar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Entregue às 09:30 por Ana Teste. Aguardando recebimento.",
      ),
    ).toBeInTheDocument();
  });

  it("passagem entregue de outro setor não vaza para o cartão", async () => {
    const { uld, ana } = await setup();
    const carga = await insertSector(db, "Carga");
    const cargaShift = await insertShift(db, { sectorId: carga.id });
    const cargaUser = await insertUser(db, {
      role: "operator",
      sectorId: carga.id,
    });
    await insertHandover(db, {
      sectorId: carga.id,
      shiftId: cargaShift.id,
      operationalDate: "2026-11-19",
      status: "delivered",
      deliveredBy: cargaUser.id,
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
    );

    await renderHome();

    expect(
      screen.queryByRole("heading", { name: "Passagem para confirmar" }),
    ).not.toBeInTheDocument();
  });

  it("setor sem turnos: operador vê o pedido ao administrador", async () => {
    const uld = await insertSector(db, "ULD");
    const ana = await insertUser(db, { role: "operator", sectorId: uld.id });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: uld.id }),
    );

    await renderHome();

    expect(screen.getByText("Nenhum turno neste setor.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Peça a um administrador para cadastrar os turnos do setor.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ir para Turnos" }),
    ).not.toBeInTheDocument();
  });

  it("operador de setor inativo vê o aviso, sem cartões", async () => {
    const parado = await insertSector(db, "Parado", { active: false });
    const ana = await insertUser(db, { role: "operator", sectorId: parado.id });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: parado.id }),
    );

    await renderHome();

    expect(screen.getByText("Seu setor está inativo.")).toBeInTheDocument();
    expect(
      screen.getByText("Peça a um administrador para reativá-lo."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Passagem do meu turno" }),
    ).not.toBeInTheDocument();
  });

  it("admin: seletor de setor, primeiro setor por padrão e link para Turnos quando não há turno", async () => {
    const carga = await insertSector(db, "Carga");
    await insertSector(db, "ULD");
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderHome();

    expect(screen.getByRole("group", { name: "Setor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Carga" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("link", { name: "Ir para Turnos" }),
    ).toHaveAttribute("href", `/admin/turnos?setor=${carga.id}`);
  });

  it("admin: ?setor= vence o cookie e vai no link de começar", async () => {
    const carga = await insertSector(db, "Carga");
    const uld = await insertSector(db, "ULD");
    const shiftRow = await insertShift(db, { sectorId: uld.id });
    mocks.cookie.value = carga.id;
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderHome({ setor: uld.id });

    expect(screen.getByRole("button", { name: "ULD" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("link", { name: "Começar passagem" }),
    ).toHaveAttribute(
      "href",
      `/passagens/nova?turno=${shiftRow.id}&data=${TODAY}&setor=${uld.id}`,
    );
  });

  it("admin: sem ?setor=, o cookie escolhe o setor", async () => {
    await insertSector(db, "Carga");
    const uld = await insertSector(db, "ULD");
    mocks.cookie.value = uld.id;
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderHome();

    expect(screen.getByRole("button", { name: "ULD" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("admin sem setor ativo: estado vazio com link para Setores", async () => {
    await insertSector(db, "Parado", { active: false });
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderHome();

    expect(screen.getByText("Nenhum setor ativo.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Cadastre ou reative um setor para usar a passagem de turno.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Setores" }),
    ).toHaveAttribute("href", "/admin/setores");
  });
});
```

- [ ] **Step 24: Run test to verify it fails**

Run: `bun run test -- src/components/passagens/HomeHandovers.test.tsx`
Expected: FAIL com `Error: Failed to resolve import "./HomeHandovers" from "src/components/passagens/HomeHandovers.test.tsx". Does the file exist?`

- [ ] **Step 25: Write minimal implementation**

`src/components/passagens/HomeHandovers.tsx`:

```tsx
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/admin/EmptyState";
import { db } from "@/db";
import { listActiveSectors } from "@/features/admin/sectors";
import { getHomeHandovers } from "@/features/handovers/home";
import { resolveHandoverSector } from "@/features/handovers/sectorChoice";
import { readRememberedSector } from "@/features/handovers/sectorCookie";
import { requireUser } from "@/lib/auth/session";

import { MyShiftCard } from "./MyShiftCard";
import { PendingHandoverCard } from "./PendingHandoverCard";
import { SectorPicker } from "./SectorPicker";

type HomeHandoversProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Cartões do Início. Lê sessão, cookie e URL: só dentro de <Suspense>.
export async function HomeHandovers({ searchParams }: HomeHandoversProps) {
  const actor = await requireUser();
  const params = await searchParams;

  let sectorId: string;
  let picker: React.ReactNode = null;
  let sectorParam: string | null = null;

  if (actor.role === "admin") {
    const sectors = await listActiveSectors(db);
    const selection = resolveHandoverSector(sectors, {
      url: params.setor,
      cookie: await readRememberedSector(),
    });
    if (selection.kind !== "sector") {
      return (
        <EmptyState
          title="Nenhum setor ativo."
          description="Cadastre ou reative um setor para usar a passagem de turno."
          action={{ label: "Ir para Setores", href: "/admin/setores" }}
        />
      );
    }
    sectorId = selection.sector.id;
    sectorParam = selection.sector.id;
    picker = (
      <SectorPicker
        sectors={sectors}
        selectedId={selection.sector.id}
        path="/"
      />
    );
  } else {
    // Operador sempre usa o próprio setor (toAuthz garante que existe).
    if (actor.sectorId === null) notFound();
    sectorId = actor.sectorId;
  }

  const result = await getHomeHandovers(db, actor, sectorId, new Date());
  if (!result.ok) {
    if (result.code !== "SECTOR_INACTIVE") notFound();
    return (
      <EmptyState
        title="Seu setor está inativo."
        description="Peça a um administrador para reativá-lo."
      />
    );
  }

  const { home } = result;
  return (
    <div className="flex flex-col gap-4">
      {picker}
      {home.pending && <PendingHandoverCard pending={home.pending} />}
      <MyShiftCard
        state={home.mine}
        sectorId={home.sector.id}
        canManageCatalog={actor.role === "admin"}
        sectorParam={sectorParam}
      />
    </div>
  );
}
```

- [ ] **Step 26: Run test to verify it passes**

Run: `bun run test -- src/components/passagens/HomeHandovers.test.tsx`
Expected: PASS (13 testes)

- [ ] **Step 27: Write the failing tests (navegação e saudação)**

Leia os três arquivos e aplique:

`src/components/app-shell/navItems.test.ts` — troque os três blocos e acrescente um teste:

```ts
  it("operador vê Início, Passagens e Conta, sem Administração", () => {
    expect(visibleNavItems(false).map((item) => item.label)).toEqual([
      "Início",
      "Passagens",
      "Conta",
    ]);
  });

  it("admin vê também Administração, por último", () => {
    expect(visibleNavItems(true).map((item) => item.label)).toEqual([
      "Início",
      "Passagens",
      "Conta",
      "Administração",
    ]);
  });

  it("as rotas são as do contrato", () => {
    expect(NAV_ITEMS.map((item) => item.href)).toEqual([
      "/",
      "/passagens",
      "/conta",
      "/admin",
    ]);
  });
```

e, dentro de `describe("isNavItemActive", …)`, logo antes de `it("prefixo parecido que não é subrota não é ativo", …)`:

```ts
  it("Passagens fica ativo na lista, na nova passagem e no resumo", () => {
    expect(isNavItemActive("/passagens", "/passagens")).toBe(true);
    expect(isNavItemActive("/passagens/nova", "/passagens")).toBe(true);
    expect(isNavItemActive("/passagens/abc", "/passagens")).toBe(true);
    expect(isNavItemActive("/", "/passagens")).toBe(false);
  });
```

`src/components/app-shell/Greeting.test.tsx` — no teste "mostra 'Olá, {primeiro nome}' e o texto do Início", troque

```tsx
    expect(
      screen.getByText(
        "Em breve: passagem de turno, solicitações e dashboard.",
      ),
    ).toBeInTheDocument();
```

por

```tsx
    expect(
      screen.getByText("Em breve: solicitações e dashboard."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/passagem de turno/)).not.toBeInTheDocument();
```

`src/components/app-shell/AppSidebar.test.tsx` — troque o início do primeiro teste

```tsx
  it("operador vê Início e Conta, e não vê Administração", () => {
    renderSidebar({ isAdmin: false });

```

por

```tsx
  it("operador vê Início, Passagens e Conta, e não vê Administração", () => {
    renderSidebar({ isAdmin: false });

    expect(screen.getByRole("link", { name: "Passagens" })).toHaveAttribute(
      "href",
      "/passagens",
    );

```

e acrescente, imediatamente antes de `it("Início fica ativo na raiz", …)`:

```tsx
  it("Passagens fica ativo em /passagens/nova e Início não", () => {
    mocks.pathname = "/passagens/nova";
    renderSidebar();

    expect(screen.getByRole("link", { name: "Passagens" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Início" })).not.toHaveAttribute(
      "aria-current",
    );
  });

```

- [ ] **Step 28: Run test to verify it fails**

Run: `bun run test -- src/components/app-shell/navItems.test.ts src/components/app-shell/Greeting.test.tsx src/components/app-shell/AppSidebar.test.tsx`
Expected: FAIL em 6 testes: `AssertionError: expected [ 'Início', 'Conta' ] to deeply equal [ 'Início', 'Passagens', 'Conta' ]` (e o equivalente do admin e das rotas), `Unable to find an element with the text: Em breve: solicitações e dashboard.` e `Unable to find an accessible element with the role "link" and name "Passagens"`.

- [ ] **Step 29: Write minimal implementation**

`src/components/app-shell/navItems.ts` — troque o `import` e o início de `NAV_ITEMS` (o resto do arquivo não muda):

```ts
import {
  ClipboardList,
  House,
  type LucideIcon,
  ShieldCheck,
  UserRound,
} from "lucide-react";
```

```ts
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Início", icon: House, adminOnly: false },
  {
    href: "/passagens",
    label: "Passagens",
    icon: ClipboardList,
    adminOnly: false,
  },
  { href: "/conta", label: "Conta", icon: UserRound, adminOnly: false },
```

`src/components/app-shell/Greeting.tsx` — troque o texto do parágrafo:

```tsx
      <p className="text-muted-foreground">
        Em breve: solicitações e dashboard.
      </p>
```

`e2e/auth.spec.ts` (linha 116; **leia o arquivo antes**): o cenário "convite de admin" espera o texto antigo da saudação. Troque

```ts
    page.getByText("Em breve: passagem de turno, solicitações e dashboard."),
```

por

```ts
    page.getByText("Em breve: solicitações e dashboard."),
```

- [ ] **Step 30: Run test to verify it passes**

Run: `bun run test -- src/components/app-shell/navItems.test.ts src/components/app-shell/Greeting.test.tsx src/components/app-shell/AppSidebar.test.tsx`
Expected: PASS (9 + 3 + 9 = 21 testes)

- [ ] **Step 31: Início com os cartões (página)**

Não há teste novo de página (o conteúdo é coberto por `HomeHandovers.test.tsx`; o guarda de páginas aceita a página porque `Greeting` e `HomeHandovers` chamam `requireUser()`). `src/app/(app)/page.tsx` fica assim:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";

import { Greeting } from "@/components/app-shell/Greeting";
import { HomeHandovers } from "@/components/passagens/HomeHandovers";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Início" };

export default function HomePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <Suspense fallback={<GreetingSkeleton />}>
        <Greeting />
      </Suspense>
      <Suspense fallback={<HandoversSkeleton />}>
        <HomeHandovers searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

function GreetingSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-5 w-80 max-w-full" />
    </div>
  );
}

function HandoversSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
```

Run: `bun run test -- src/app/appPagesAuth.test.ts`
Expected: PASS (a página `/` continua chamando o guarda por componente importado de `@/components/...`)

- [ ] **Step 32: Registrar no `ui-registry.md`**

Leia `.context/ui-registry.md`. (a) Em `### Greeting`, acrescente ao fim da linha `- **Histórico:**` o texto: ` 2026-11-21 — Fase 3: o segundo parágrafo passa a "Em breve: solicitações e dashboard." (a passagem deixou de ser "em breve"); a página `/` ganha os cartões de `HomeHandovers`.` (b) Logo antes do cabeçalho `## 3. Componentes de domínio — …`, insira exatamente este bloco (as Tarefas 8–11 acrescentam as entradas delas **dentro** dele, antes do `## 3.`):

```markdown
### Passagem de turno — `src/components/passagens/*` (Fase 3)

Componentes da passagem. Regras comuns: só tokens de cor, tema claro e escuro, situação sempre com
ícone e texto, alvo de toque ≥ 44px no celular. Quem escolhe o setor é o admin (`SectorPicker`);
o operador usa o próprio setor e nunca vê o seletor.

### SectorPicker
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/SectorPicker.tsx`
- **Propósito:** o admin escolher o setor no Início, na Nova passagem e no Histórico (D-F3-3).
- **Como funciona:** `"use client"`; `<fieldset>` com legenda "Setor" (só para leitor de tela) e um `Button` por setor ativo (selecionado = `variant="default"` e `aria-pressed`); com `allowAll`, o último botão é "Todos os setores" (`todos`). Clicar chama `chooseSectorAction({ sectorId, path })` dentro de `useTransition`, que grava o cookie `closery_setor` e faz `redirect` para `{path}?setor={id}`; o redirect chega como exceção e segue adiante (`unstable_rethrow`). Falha da action ou exceção de rede = `toast.error`. Clicar no setor já selecionado não faz nada. O `SectorSwitcher` (links) do admin continua separado.
- **Usa:** `Button`, `FieldSet`, `FieldLegend`, `chooseSectorAction`, `sonner`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 7).

### HandoverStatusBadge
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HandoverStatusBadge.tsx`
- **Propósito:** mostrar a situação da passagem (aguardando, confirmada, não confirmada, sem passagem) e o selo "Corrigida".
- **Como funciona:** Server-safe. `Badge` com ícone e texto: `awaiting` (`Clock`, `bg-info`), `confirmed` (`CircleCheck`, `bg-success`; com `confirmedByName` diz "Confirmada por {nome}"), `unconfirmed` (`TriangleAlert`, `bg-warning`), `missing` (`CircleSlash`, `bg-muted`). `corrected` acrescenta `Badge variant="outline"` com `PencilLine` e "Corrigida". Textos vêm de `situationLabel` e `CORRECTED_LABEL`.
- **Usa:** `Badge`, tokens `info`, `success`, `warning`, `muted`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 7).

### PendingHandoverCard
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/PendingHandoverCard.tsx`
- **Propósito:** cartão do topo do Início "Passagem para confirmar".
- **Como funciona:** Server-safe. Mostra `{turno} · {dd/mm/aaaa}`, "Entregue às {HH:mm} por {nome}", o bloco "Fica para o próximo turno" em destaque (trecho do texto ou "Nada registrado para o próximo turno.") e o link-botão "Ver passagem" (`/passagens/{id}`). Não confirma aqui: a confirmação é no resumo.
- **Usa:** `Card`, `buttonVariants`, `formatDateBR`, `formatTimeBR`, `handoverHref`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 7).

### MyShiftCard
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/MyShiftCard.tsx`
- **Propósito:** cartão "Passagem do meu turno" do Início, nos cinco estados.
- **Como funciona:** Server-safe. Mostra `{turno} · {início}–{fim} · {data}` (horário com `tabular-nums`) e "Turno sugerido pelo horário de agora.". `start` → "Começar passagem"; `continue` → "Rascunho salvo às {HH:mm} por {nome}" + "Continuar passagem"; `delivered` → "Entregue às … Aguardando recebimento." + "Ver passagem"; `confirmed` → "Entregue por … Confirmada por …" + "Ver passagem"; `no-shifts` → "Nenhum turno neste setor." (admin: link "Ir para Turnos"). Todos, menos `no-shifts`, trazem o link "Ver todas as passagens". Admin leva `&setor=` no link de começar.
- **Usa:** `Card`, `buttonVariants`, `newHandoverHref`, `handoverHref`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 7).

### HomeHandovers
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HomeHandovers.tsx`
- **Propósito:** os cartões de passagem do Início.
- **Como funciona:** Server Component assíncrono, dentro de `<Suspense>` (lê sessão, `searchParams` e o cookie). Operador: setor próprio. Admin: `resolveHandoverSector` (URL → cookie → primeiro ativo) e `SectorPicker`; sem setor ativo, estado vazio com link para Setores. Setor inativo do operador: "Seu setor está inativo.". Ordem: `PendingHandoverCard` (se houver) e `MyShiftCard`. Sem cartão de solicitações (Fase 4).
- **Usa:** `getHomeHandovers`, `resolveHandoverSector`, `readRememberedSector`, `EmptyState`, `SectorPicker`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 7).

```

- [ ] **Step 33: Verificar tudo**

Run: `bun run check-types && bun run lint && bun run test`
Expected: tudo verde (nenhum teste da Fase 2 quebra; `appPagesAuth`, `actionsGuards` e `uiRegistryDoc` passam). Se o Biome reclamar de formatação, rode `bunx biome check --write src test` e confira que só mudou espaço em branco.

- [ ] **Step 34: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-7.txt` (texto exato abaixo) e rode:

```bash
git add src/features/handovers/sectorCookie.ts src/features/handovers/sectorCookie.test.ts "src/app/(app)/actions.ts" "src/app/(app)/actions.test.ts" "src/app/(app)/page.tsx" src/app/actionsGuards.test.ts src/components/passagens/SectorPicker.tsx src/components/passagens/SectorPicker.test.tsx src/components/passagens/HandoverStatusBadge.tsx src/components/passagens/HandoverStatusBadge.test.tsx src/components/passagens/PendingHandoverCard.tsx src/components/passagens/PendingHandoverCard.test.tsx src/components/passagens/MyShiftCard.tsx src/components/passagens/MyShiftCard.test.tsx src/components/passagens/HomeHandovers.tsx src/components/passagens/HomeHandovers.test.tsx src/components/app-shell/navItems.ts src/components/app-shell/navItems.test.ts src/components/app-shell/AppSidebar.test.tsx src/components/app-shell/Greeting.tsx src/components/app-shell/Greeting.test.tsx e2e/auth.spec.ts .context/ui-registry.md
git commit -F .git/sdd/msg-task-7.txt
```

Mensagem:
```text
feat(passagens): escolha de setor do admin, item Passagens e Início com cartões

O admin escolhe o setor por um seletor que grava o cookie closery_setor e
redireciona (chooseSectorAction). A navegação ganha "Passagens" e o Início
mostra "Passagem para confirmar" e "Passagem do meu turno" nos cinco
estados, sem solicitações (Fase 4).

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 8: Formulário `/passagens/nova` (contador, salvamento automático, entregar turno)

**Files:**
- Create: `src/components/passagens/QuantityCounter.tsx`
- Create: `src/components/passagens/useHandoverAutosave.ts`
- Create: `src/components/passagens/AutosaveIndicator.tsx`
- Create: `src/components/passagens/ItemLineField.tsx`
- Create: `src/components/passagens/HandoverFields.tsx`
- Create: `src/components/passagens/HandoverHeader.tsx`
- Create: `src/components/passagens/HandoverForm.tsx`
- Create: `src/components/passagens/NewHandover.tsx`
- Create: `src/app/(app)/passagens/actions.ts` (as Tarefas 9 e 11 **acrescentam** `confirmHandoverAction` e `correctHandoverAction` neste mesmo arquivo)
- Create: `src/app/(app)/passagens/nova/page.tsx`
- Modify: `src/app/appPagesAuth.test.ts` (**LER antes**; novo teste da rota `passagens/nova/page.tsx`)
- Modify: `src/app/actionsGuards.test.ts` (**LER antes**; `MIN_APP_ACTION_FILES` de 1 para 2)
- Modify: `.context/ui-registry.md` (**LER antes**; entradas dentro do bloco "Passagem de turno" criado na Tarefa 7)
- Test: `src/components/passagens/QuantityCounter.test.tsx`, `useHandoverAutosave.test.tsx`, `AutosaveIndicator.test.tsx`, `ItemLineField.test.tsx`, `HandoverFields.test.tsx`, `HandoverHeader.test.tsx`, `HandoverForm.test.tsx`, `NewHandover.test.tsx` (todos Create, em `src/components/passagens/`)
- Test: `src/app/(app)/passagens/actions.test.ts` (Create)

**Interfaces:**
- Consumes (nomes e assinaturas do contrato):
  - Tarefa 2 (puros): `MAX_QUANTITY`, `TEXT_MAX_LENGTH`, `ITEM_NOTE_MAX_LENGTH`, `AUTOSAVE_DEBOUNCE_MS`, `MAX_DAYS_BACK` (`limits.ts`); `sanitizeQuantityInput`, `parseQuantity`, `stepQuantity`, `formatQuantity` (`quantity.ts`); `FieldChange`, `FieldValues`, `FormMode`, `HandoverRef`, `ItemLine`, `SavedMark`, `SaveFieldInput`, `ShiftChoice` (`types.ts`); `isIsoDate`, `addDays`, `todayInSaoPaulo`, `formatTimeBR` (`saoPaulo.ts`); `resolveHandoverTarget` (`shiftSuggestion.ts`); `newHandoverHref`, `handoverHref` (`urls.ts`)
  - Tarefa 3: `saveFieldSchema`, `deliverHandoverSchema`, `runHandoverAction({ actor, schema, input, revalidate, run })`
  - Tarefa 4: `saveHandoverField(db, actor, input, now): Promise<AdminResult<SavedField>>`, `type SavedField = { handoverId: string; savedAt: Date; savedByName: string }`, `deliverHandover(db, actor, ref, now): Promise<AdminResult<Delivered>>`, `type Delivered = { id: string; deliveredAt: Date }`, `getHandoverFormState(db, actor, ref, now): Promise<AdminResult<{ state: HandoverFormState }>>`, `type HandoverFormState`, `listActiveShifts(db, sectorId)`, `loadSector(db, actor, sectorId)`
  - Tarefa 7: `SectorPicker`, `readRememberedSector`; Tarefa 2: `resolveHandoverSector` (dona única de `sectorChoice.ts`)
  - Fase 2: `useAdminAction`, `SelectField`, `EmptyState`, `FieldError`, `Field*`, `Input`, `Textarea`, `Button`, `Tooltip`
  - Fixtures da Tarefa 1: `insertSector`, `insertShift`, `insertItem`, `insertUser`, `insertHandover`, `insertHandoverItem`, `spDate`; `test/touchTargets.ts` (`heightUnit`, `TOUCH_UNIT`)
- Produces (as Tarefas 9–12 usam):
  - `QuantityCounter(props: { label: string; unit: string; value: number; onChange: (value: number) => void; onCommit?: (value: number) => void; disabled?: boolean })`
  - `useHandoverAutosave(options: { ref: HandoverRef; save: (input: SaveFieldInput) => Promise<AdminResult<SavedField>>; initial: SavedMark | null; debounceMs?: number }): HandoverAutosave` com `type AutosaveStatus = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: Date } | { kind: "error"; message: string }` e `type HandoverAutosave = { status; lastSaved: SavedMark | null; hasUnsaved: boolean; change(change: FieldChange): void; commit(field: FieldChange): void; flush(): Promise<boolean>; retry(): void }`
  - `AutosaveIndicator(props: { status: AutosaveStatus; lastSaved: SavedMark | null; onRetry: () => void })`
  - `ItemLineField(props: { line: ItemLine; quantity: number; note: string; onQuantityChange; onQuantityCommit; onNoteChange; onNoteCommit; disabled?: boolean })` (renderiza um `<li>`)
  - `HandoverFields(props: { controls: readonly ItemLine[]; stock: readonly ItemLine[]; values: FieldValues; onChange: (change: FieldChange) => void; onCommit: (change: FieldChange) => void; disabled?: boolean; canManageCatalog: boolean; itemsHref: string })` (a Tarefa 11 reaproveita)
  - `HandoverHeader(props: { sectorId: string; sectorName: string; shifts: readonly ShiftChoice[]; shiftId: string; operationalDate: string; today: string; minDate: string; sectorParam: string | null; beforeNavigate?: () => Promise<boolean> })` (o texto `SWITCH_FAILED_MESSAGE` vive em `messages.ts`, Tarefa 2)
  - `HandoverForm(props: { state: HandoverFormState & { mode: FormMode }; shifts: readonly ShiftChoice[]; today: string; minDate: string; sectorParam: string | null; canManageCatalog: boolean })` (o texto `UNSAVED_DELIVER_MESSAGE` vive em `messages.ts`, Tarefa 2)
  - `NewHandover(props: { searchParams: Promise<Record<string, string | string[] | undefined>> })`
  - `saveHandoverFieldAction(input: unknown): Promise<AdminResult<SavedField>>` (`revalidate: false`) e `deliverHandoverAction(input: unknown): Promise<AdminResult<Delivered>>` (`revalidate: true`) em `@/app/(app)/passagens/actions`

- [ ] **Step 1: Write the failing test (`QuantityCounter`)**

`src/components/passagens/QuantityCounter.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { heightUnit, TOUCH_UNIT } from "../../../test/touchTargets";
import { QuantityCounter } from "./QuantityCounter";

const LABEL = "Rede de proteção";

// O contador é controlado: o pai guarda o valor, como no formulário.
function setup(props: { initial?: number; disabled?: boolean } = {}) {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  function Harness() {
    const [value, setValue] = useState(props.initial ?? 0);
    return (
      <TooltipProvider>
        <QuantityCounter
          label={LABEL}
          unit="rolo"
          value={value}
          disabled={props.disabled}
          onChange={(next) => {
            setValue(next);
            onChange(next);
          }}
          onCommit={onCommit}
        />
      </TooltipProvider>
    );
  }
  render(<Harness />);
  return { onChange, onCommit };
}

const input = () =>
  screen.getByRole("textbox", { name: `Quantidade de ${LABEL}` });
const minus = () => screen.getByRole("button", { name: `Diminuir ${LABEL}` });
const plus = () => screen.getByRole("button", { name: `Aumentar ${LABEL}` });

function hover(element: HTMLElement) {
  fireEvent.pointerEnter(element, { pointerType: "mouse" });
  fireEvent.mouseEnter(element);
  fireEvent.pointerMove(element, { pointerType: "mouse" });
  fireEvent.mouseMove(element);
}

describe("QuantityCounter", () => {
  it("começa em 0 (nunca em branco), com a unidade ao lado e o grupo nomeado", () => {
    setup();

    expect(input()).toHaveValue("0");
    expect(screen.getByText("rolo")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: LABEL })).toBeInTheDocument();
  });

  it("+ e − mudam o valor e salvam já (onChange e onCommit)", async () => {
    const { onChange, onCommit } = setup({ initial: 3 });

    await userEvent.click(plus());
    expect(input()).toHaveValue("4");
    await userEvent.click(minus());
    await userEvent.click(minus());

    expect(input()).toHaveValue("2");
    expect(onChange.mock.calls.map(([value]) => value)).toEqual([4, 3, 2]);
    expect(onCommit.mock.calls.map(([value]) => value)).toEqual([4, 3, 2]);
  });

  it("− trava em 0", async () => {
    const { onChange } = setup({ initial: 0 });

    expect(minus()).toBeDisabled();
    await userEvent.click(minus());
    expect(onChange).not.toHaveBeenCalled();
    expect(input()).toHaveValue("0");
  });

  it("+ trava em 99.999", async () => {
    const { onChange } = setup({ initial: 99_999 });

    expect(plus()).toBeDisabled();
    await userEvent.click(plus());
    expect(onChange).not.toHaveBeenCalled();
    expect(minus()).toBeEnabled();
  });

  it("digitar substitui o valor (o campo seleciona tudo ao receber foco)", async () => {
    const { onChange } = setup({ initial: 8 });

    await userEvent.click(input());
    await userEvent.keyboard("12");

    expect(input()).toHaveValue("12");
    expect(onChange).toHaveBeenLastCalledWith(12);
  });

  it("letras e símbolos são ignorados e nunca viram NaN", async () => {
    const { onChange } = setup({ initial: 5 });

    await userEvent.click(input());
    await userEvent.keyboard("abc-.,");

    expect(onChange).not.toHaveBeenCalled();
    expect(input()).not.toHaveValue("NaN");
  });

  it("zeros à esquerda somem: 007 vira 7", async () => {
    const { onChange } = setup({ initial: 1 });

    await userEvent.click(input());
    await userEvent.keyboard("007");

    expect(input()).toHaveValue("7");
    expect(onChange).toHaveBeenLastCalledWith(7);
  });

  it("aceita no máximo 5 dígitos", async () => {
    setup({ initial: 1 });

    await userEvent.click(input());
    await userEvent.keyboard("1234567");

    expect(input()).toHaveValue("12345");
  });

  it("campo vazio ao sair vira 0 e esse 0 é salvo", async () => {
    const { onChange, onCommit } = setup({ initial: 6 });

    await userEvent.clear(input());
    expect(input()).toHaveValue("");
    // Esvaziar enquanto digita não salva nada.
    expect(onCommit).not.toHaveBeenCalled();

    await userEvent.tab();

    expect(input()).toHaveValue("0");
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(0);
  });

  it("sair do campo depois de digitar salva o valor digitado", async () => {
    const { onCommit } = setup({ initial: 0 });

    await userEvent.click(input());
    await userEvent.keyboard("5");
    await userEvent.tab();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(5);
  });

  it("passar pelo campo sem digitar não salva nada", async () => {
    const { onChange, onCommit } = setup({ initial: 4 });

    await userEvent.click(input());
    await userEvent.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("desabilitado trava os três controles", () => {
    setup({ initial: 3, disabled: true });

    expect(minus()).toBeDisabled();
    expect(plus()).toBeDisabled();
    expect(input()).toBeDisabled();
  });

  it("botões e campo têm alvo de 44px no celular e texto de 16px", () => {
    setup();

    for (const button of [minus(), plus()]) {
      expect(heightUnit(button.className, "max-md:")).toBe(TOUCH_UNIT);
    }
    expect(heightUnit(input().className, "max-md:")).toBe(TOUCH_UNIT);
    expect(input()).toHaveClass("text-base", "tabular-nums", "text-center");
    expect(input()).toHaveAttribute("inputmode", "numeric");
  });

  it("mostra os tooltips 'Diminuir' e 'Aumentar'", async () => {
    setup({ initial: 2 });
    expect(screen.queryByText("Aumentar")).not.toBeInTheDocument();

    hover(plus());
    await waitFor(() =>
      expect(screen.getByText("Aumentar")).toBeInTheDocument(),
    );
    hover(minus());
    await waitFor(() =>
      expect(screen.getByText("Diminuir")).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/components/passagens/QuantityCounter.test.tsx`
Expected: FAIL com `Error: Failed to resolve import "./QuantityCounter" from "src/components/passagens/QuantityCounter.test.tsx". Does the file exist?`

- [ ] **Step 3: Write minimal implementation**

`src/components/passagens/QuantityCounter.tsx`:

```tsx
"use client";

import { Minus, Plus } from "lucide-react";
import { type ChangeEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MAX_QUANTITY } from "@/features/handovers/limits";
import {
  parseQuantity,
  sanitizeQuantityInput,
  stepQuantity,
} from "@/features/handovers/quantity";

// Contador de uma contagem inteira de 0 a 99.999 (ui-rules §2.2: número nunca
// em branco). Só dígitos; o campo pode ficar vazio enquanto a pessoa digita
// (buffer local), mas ao sair vira 0 e o 0 é o valor salvo.
export function QuantityCounter({
  label,
  unit,
  value,
  onChange,
  onCommit,
  disabled = false,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  disabled?: boolean;
}) {
  // null = o campo mostra `value`; texto = a pessoa está digitando.
  const [draft, setDraft] = useState<string | null>(null);

  function step(delta: 1 | -1) {
    const next = stepQuantity(value, delta);
    setDraft(null);
    onChange(next);
    onCommit?.(next);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const text = sanitizeQuantityInput(event.target.value);
    setDraft(text);
    const parsed = parseQuantity(text);
    if (parsed !== null) onChange(parsed);
  }

  function handleBlur() {
    if (draft === null) return;
    const final = parseQuantity(draft) ?? 0;
    setDraft(null);
    onChange(final);
    onCommit?.(final);
  }

  return (
    <fieldset className="flex min-w-0 items-center gap-1.5">
      <legend className="sr-only">{label}</legend>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Diminuir ${label}`}
              disabled={disabled || value <= 0}
              onClick={() => step(-1)}
            />
          }
        >
          <Minus />
        </TooltipTrigger>
        <TooltipContent>Diminuir</TooltipContent>
      </Tooltip>
      <Input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={String(MAX_QUANTITY).length}
        autoComplete="off"
        className="w-20 text-center text-base tabular-nums md:text-base"
        aria-label={`Quantidade de ${label}`}
        value={draft ?? String(value)}
        disabled={disabled}
        onFocus={(event) => event.currentTarget.select()}
        onChange={handleChange}
        onBlur={handleBlur}
      />
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Aumentar ${label}`}
              disabled={disabled || value >= MAX_QUANTITY}
              onClick={() => step(1)}
            />
          }
        >
          <Plus />
        </TooltipTrigger>
        <TooltipContent>Aumentar</TooltipContent>
      </Tooltip>
      <span className="text-sm text-muted-foreground">{unit}</span>
    </fieldset>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- src/components/passagens/QuantityCounter.test.tsx`
Expected: PASS (14 testes)

- [ ] **Step 5: Write the failing test (`useHandoverAutosave`, relógio falso)**

`src/components/passagens/useHandoverAutosave.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type AdminResult, fail, ok } from "@/features/admin/result";
import type { SavedField } from "@/features/handovers/draft";
import type { SaveFieldInput } from "@/features/handovers/types";
import { spDate } from "../../../test/clock";
import { useHandoverAutosave } from "./useHandoverAutosave";

const REF = {
  sectorId: "11111111-1111-4111-8111-111111111111",
  shiftId: "22222222-2222-4222-8222-222222222222",
  operationalDate: "2026-11-20",
};
const ITEM_A = "33333333-3333-4333-8333-333333333333";
const ITEM_B = "44444444-4444-4444-8444-444444444444";

type Deferred = { resolve: (result: AdminResult<SavedField>) => void };

// Cada chamada da action fica pendente até o teste resolver: dá para provar a
// fila serial e a ordem.
function setup(initial: { at: Date; byName: string } | null = null) {
  const calls: SaveFieldInput[] = [];
  const pending: Deferred[] = [];
  const save = vi.fn((input: SaveFieldInput) => {
    calls.push(input);
    return new Promise<AdminResult<SavedField>>((resolve) => {
      pending.push({ resolve });
    });
  });
  const view = renderHook(() =>
    useHandoverAutosave({ ref: REF, save, initial }),
  );
  return { ...view, save, calls, pending };
}

const saved = (hour = "10:00") =>
  ok({
    handoverId: "h1",
    savedAt: spDate("2026-11-20", hour),
    savedByName: "Ana Teste",
  });

const quantity = (itemId: string, value: number) =>
  ({ field: "quantity", itemId, value }) as const;

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function settle(
  pending: Deferred[],
  index: number,
  result: AdminResult<SavedField>,
) {
  await act(async () => {
    pending[index]?.resolve(result);
    await Promise.resolve();
  });
}

describe("useHandoverAutosave", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("começa parado, com o último salvamento vindo do servidor", () => {
    const initial = { at: spDate("2026-11-20", "09:00"), byName: "Bia Teste" };
    const { result } = setup(initial);

    expect(result.current.status).toEqual({ kind: "idle" });
    expect(result.current.lastSaved).toEqual(initial);
    expect(result.current.hasUnsaved).toBe(false);
  });

  it("agrupa a digitação: só o último valor sai, 800 ms depois", async () => {
    const { result, save, calls, pending } = setup();

    act(() => result.current.change(quantity(ITEM_A, 1)));
    await advance(300);
    act(() => result.current.change(quantity(ITEM_A, 12)));
    await advance(799);
    expect(save).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ kind: "saving" });

    await advance(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(calls[0]).toEqual({
      ...REF,
      field: "quantity",
      itemId: ITEM_A,
      value: 12,
    });

    await settle(pending, 0, saved());
    expect(result.current.status).toEqual({
      kind: "saved",
      at: spDate("2026-11-20", "10:00"),
    });
    expect(result.current.lastSaved).toEqual({
      at: spDate("2026-11-20", "10:00"),
      byName: "Ana Teste",
    });
    expect(result.current.hasUnsaved).toBe(false);
  });

  it("commit envia já e cancela o debounce do campo", async () => {
    const { result, save, calls, pending } = setup();

    act(() => result.current.change(quantity(ITEM_A, 3)));
    act(() => result.current.commit(quantity(ITEM_A, 4)));
    expect(save).toHaveBeenCalledTimes(1);
    expect(calls[0]).toMatchObject({ field: "quantity", value: 4 });

    await settle(pending, 0, saved());
    await advance(2000);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("fila serial: a segunda requisição só sai depois da primeira", async () => {
    const { result, save, calls, pending } = setup();

    act(() => result.current.commit(quantity(ITEM_A, 1)));
    act(() => result.current.commit({ field: "occurrences", value: "Texto" }));
    expect(save).toHaveBeenCalledTimes(1);

    await settle(pending, 0, saved("10:00"));
    expect(save).toHaveBeenCalledTimes(2);
    expect(calls.map((call) => call.field)).toEqual([
      "quantity",
      "occurrences",
    ]);
  });

  it("o valor mais novo do mesmo campo vence: o intermediário nunca sai", async () => {
    const { result, save, calls, pending } = setup();

    act(() => result.current.commit(quantity(ITEM_A, 1)));
    act(() => result.current.change(quantity(ITEM_A, 2)));
    await advance(400);
    act(() => result.current.change(quantity(ITEM_A, 3)));
    await advance(800);
    // O 1 ainda está em voo: nada mais sai.
    expect(save).toHaveBeenCalledTimes(1);

    await settle(pending, 0, saved());
    expect(save).toHaveBeenCalledTimes(2);
    expect(
      calls.map((call) => call.field === "quantity" && call.value),
    ).toEqual([1, 3]);
  });

  it("campos diferentes têm debounce independente e saem em fila", async () => {
    const { result, calls, pending } = setup();

    act(() => result.current.change(quantity(ITEM_A, 1)));
    act(() => result.current.change(quantity(ITEM_B, 2)));
    await advance(800);
    expect(calls).toHaveLength(1);

    await settle(pending, 0, saved());
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => "itemId" in call && call.itemId)).toEqual([
      ITEM_A,
      ITEM_B,
    ]);
  });

  it("falha: mostra o erro, mantém o digitado e para a fila até o retry", async () => {
    const { result, save, calls, pending } = setup();

    act(() => result.current.commit(quantity(ITEM_A, 5)));
    await settle(
      pending,
      0,
      fail("INTERNAL", "Não foi possível concluir. Tente de novo."),
    );

    expect(result.current.status).toEqual({
      kind: "error",
      message: "Não foi possível concluir. Tente de novo.",
    });
    expect(result.current.hasUnsaved).toBe(true);

    // Outro campo não passa enquanto a fila está parada.
    act(() => result.current.commit({ field: "nextShift", value: "Aviso" }));
    expect(save).toHaveBeenCalledTimes(1);

    act(() => result.current.retry());
    expect(save).toHaveBeenCalledTimes(2);
    expect(calls[1]).toMatchObject({ field: "quantity", value: 5 });

    await settle(pending, 1, saved("10:05"));
    expect(save).toHaveBeenCalledTimes(3);
    expect(calls[2]).toMatchObject({ field: "nextShift", value: "Aviso" });
    await settle(pending, 2, saved("10:06"));
    expect(result.current.status.kind).toBe("saved");
    expect(result.current.hasUnsaved).toBe(false);
  });

  it("depois da falha, um valor mais novo do campo substitui o que falhou", async () => {
    const { result, calls, pending } = setup();

    act(() => result.current.commit(quantity(ITEM_A, 5)));
    await settle(pending, 0, fail("INTERNAL", "Falhou."));
    act(() => result.current.change(quantity(ITEM_A, 9)));
    act(() => result.current.retry());

    expect(calls[1]).toMatchObject({ field: "quantity", value: 9 });
  });

  it("exceção da action vira erro sem lançar", async () => {
    const calls: SaveFieldInput[] = [];
    const save = vi.fn(async (input: SaveFieldInput) => {
      calls.push(input);
      throw new Error("Failed to fetch");
    });
    const { result } = renderHook(() =>
      useHandoverAutosave({ ref: REF, save, initial: null }),
    );

    await act(async () => {
      result.current.commit({ field: "occurrences", value: "x" });
      await Promise.resolve();
    });

    expect(result.current.status).toEqual({
      kind: "error",
      message: "Não foi possível concluir. Tente de novo.",
    });
    expect(result.current.hasUnsaved).toBe(true);
  });

  it("falha de permissão (ok:false) mostra a mensagem da action", async () => {
    const { result, pending } = setup();

    act(() => result.current.commit(quantity(ITEM_A, 1)));
    await settle(
      pending,
      0,
      fail(
        "HANDOVER_LOCKED",
        "Esta passagem já foi confirmada. Só um administrador corrige, com motivo.",
      ),
    );

    expect(result.current.status).toEqual({
      kind: "error",
      message:
        "Esta passagem já foi confirmada. Só um administrador corrige, com motivo.",
    });
  });

  it("flush envia o pendente sem esperar o debounce e devolve true", async () => {
    const { result, save, pending } = setup();

    act(() => result.current.change(quantity(ITEM_A, 7)));
    let outcome: boolean | undefined;
    await act(async () => {
      const done = result.current.flush().then((value) => {
        outcome = value;
      });
      await Promise.resolve();
      pending[0]?.resolve(saved());
      await done;
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(outcome).toBe(true);
    expect(result.current.hasUnsaved).toBe(false);
  });

  it("flush sem nada pendente devolve true na hora", async () => {
    const { result, save } = setup();

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.flush();
    });

    expect(outcome).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it("flush devolve false quando o salvamento falha", async () => {
    const { result, pending } = setup();

    act(() => result.current.change(quantity(ITEM_A, 7)));
    let outcome: boolean | undefined;
    await act(async () => {
      const done = result.current.flush().then((value) => {
        outcome = value;
      });
      await Promise.resolve();
      pending[0]?.resolve(fail("INTERNAL", "Falhou."));
      await done;
    });

    expect(outcome).toBe(false);
    expect(result.current.status.kind).toBe("error");
  });

  it("o evento online reenvia o que falhou", async () => {
    const { result, save, pending } = setup();

    act(() => result.current.commit(quantity(ITEM_A, 2)));
    await settle(pending, 0, fail("INTERNAL", "Sem rede."));
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(2);
  });

  it("beforeunload só avisa enquanto houver algo não salvo", async () => {
    const { result, pending } = setup();
    const unload = () => {
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };

    expect(unload()).toBe(false);

    act(() => result.current.change(quantity(ITEM_A, 1)));
    expect(unload()).toBe(true);

    await advance(800);
    expect(unload()).toBe(true);

    await settle(pending, 0, saved());
    expect(unload()).toBe(false);
  });

  it("beforeunload também avisa depois de uma falha", async () => {
    const { result, pending } = setup();

    act(() => result.current.commit(quantity(ITEM_A, 1)));
    await settle(pending, 0, fail("INTERNAL", "Falhou."));

    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("ao desmontar, envia o pendente sem esperar o debounce", async () => {
    const { result, save, calls, unmount } = setup();

    act(() =>
      result.current.change({ field: "occurrences", value: "Rascunho" }),
    );
    expect(save).not.toHaveBeenCalled();

    unmount();

    expect(save).toHaveBeenCalledTimes(1);
    expect(calls[0]).toEqual({
      ...REF,
      field: "occurrences",
      value: "Rascunho",
    });
  });

  it("depois de desmontar, o timer velho não envia de novo", async () => {
    const { result, save, pending, unmount } = setup();

    act(() =>
      result.current.change({ field: "occurrences", value: "Rascunho" }),
    );
    unmount();
    await settle(pending, 0, saved());
    await advance(2000);

    expect(save).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bun run test -- src/components/passagens/useHandoverAutosave.test.tsx`
Expected: FAIL com `Error: Failed to resolve import "./useHandoverAutosave" from "src/components/passagens/useHandoverAutosave.test.tsx". Does the file exist?`

- [ ] **Step 7: Write minimal implementation**

`src/components/passagens/useHandoverAutosave.ts`:

```ts
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  type AdminResult,
  INTERNAL_ERROR_MESSAGE,
} from "@/features/admin/result";
import type { SavedField } from "@/features/handovers/draft";
import { AUTOSAVE_DEBOUNCE_MS } from "@/features/handovers/limits";
import type {
  FieldChange,
  HandoverRef,
  SavedMark,
  SaveFieldInput,
} from "@/features/handovers/types";

export type AutosaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: Date }
  | { kind: "error"; message: string };

export type HandoverAutosave = {
  status: AutosaveStatus;
  lastSaved: SavedMark | null;
  hasUnsaved: boolean;
  change(change: FieldChange): void;
  commit(field: FieldChange): void;
  flush(): Promise<boolean>;
  retry(): void;
};

type View = {
  status: AutosaveStatus;
  lastSaved: SavedMark | null;
  hasUnsaved: boolean;
};

function keyOf(change: FieldChange): string {
  return change.field === "quantity" || change.field === "note"
    ? `${change.field}:${change.itemId}`
    : change.field;
}

// Estado mutável do motor, fora do ciclo de render (refs). Uma só requisição
// em voo por vez: duas Server Actions simultâneas não têm ordem garantida, e o
// valor velho poderia sobrescrever o novo.
function createCore(initial: SavedMark | null) {
  return {
    pending: new Map<string, FieldChange>(), // último valor de cada campo
    ready: new Set<string>(), // campos prontos para enviar (debounce vencido)
    timers: new Map<string, ReturnType<typeof setTimeout>>(),
    inFlight: null as string | null,
    running: false,
    stopped: false, // fila parada por falha, até retry()
    errorMessage: "",
    savedAt: null as Date | null,
    lastSaved: initial,
    waiters: [] as Array<() => void>,
    mounted: true,
  };
}

export function useHandoverAutosave(options: {
  ref: HandoverRef;
  save: (input: SaveFieldInput) => Promise<AdminResult<SavedField>>;
  initial: SavedMark | null;
  debounceMs?: number;
}): HandoverAutosave {
  const [core] = useState(() => createCore(options.initial));
  const [view, setView] = useState<View>({
    status: { kind: "idle" },
    lastSaved: options.initial,
    hasUnsaved: false,
  });

  // O motor lê sempre a versão mais recente das opções (a action é injetável).
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const api = useMemo(() => {
    function publish() {
      if (!core.mounted) return;
      const unsaved =
        core.pending.size > 0 || core.inFlight !== null || core.stopped;
      let status: AutosaveStatus = { kind: "idle" };
      if (core.stopped) status = { kind: "error", message: core.errorMessage };
      else if (unsaved) status = { kind: "saving" };
      else if (core.savedAt) status = { kind: "saved", at: core.savedAt };
      setView({ status, lastSaved: core.lastSaved, hasUnsaved: unsaved });
    }

    async function pump(): Promise<void> {
      if (core.running || core.stopped) return;
      core.running = true;
      try {
        for (;;) {
          const key = core.ready.values().next().value;
          if (key === undefined) break;
          core.ready.delete(key);
          const change = core.pending.get(key);
          if (change === undefined) continue;

          core.pending.delete(key);
          core.inFlight = key;
          publish();

          let failure: string | null = null;
          try {
            const { ref, save } = optionsRef.current;
            const result = await save({ ...ref, ...change });
            if (result.ok) {
              core.savedAt = result.savedAt;
              core.lastSaved = {
                at: result.savedAt,
                byName: result.savedByName,
              };
            } else {
              failure = result.message;
            }
          } catch {
            failure = INTERNAL_ERROR_MESSAGE;
          }
          core.inFlight = null;

          if (failure !== null) {
            // Mantém o digitado: um valor mais novo do campo vence o que falhou.
            if (!core.pending.has(key)) core.pending.set(key, change);
            core.ready.add(key);
            core.stopped = true;
            core.errorMessage = failure;
            break;
          }
        }
      } finally {
        core.running = false;
        publish();
        for (const resolve of core.waiters.splice(0)) resolve();
      }
    }

    function change(next: FieldChange) {
      const key = keyOf(next);
      core.pending.set(key, next);
      core.ready.delete(key);
      const old = core.timers.get(key);
      if (old) clearTimeout(old);
      core.timers.set(
        key,
        setTimeout(() => {
          core.timers.delete(key);
          core.ready.add(key);
          void pump();
        }, optionsRef.current.debounceMs ?? AUTOSAVE_DEBOUNCE_MS),
      );
      publish();
    }

    function commit(next: FieldChange) {
      const key = keyOf(next);
      const old = core.timers.get(key);
      if (old) clearTimeout(old);
      core.timers.delete(key);
      core.pending.set(key, next);
      core.ready.add(key);
      publish();
      void pump();
    }

    async function flush(): Promise<boolean> {
      for (const timer of core.timers.values()) clearTimeout(timer);
      core.timers.clear();
      for (const key of core.pending.keys()) core.ready.add(key);
      core.stopped = false;
      const done = new Promise<void>((resolve) => core.waiters.push(resolve));
      void pump();
      await done;
      return core.pending.size === 0 && core.inFlight === null && !core.stopped;
    }

    function retry() {
      void flush();
    }

    return { change, commit, flush, retry };
  }, [core]);

  // Reenvia o que falhou quando a rede volta.
  useEffect(() => {
    window.addEventListener("online", api.retry);
    return () => window.removeEventListener("online", api.retry);
  }, [api]);

  // Só avisa ao sair da página enquanto houver algo não salvo.
  useEffect(() => {
    if (!view.hasUnsaved) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [view.hasUnsaved]);

  // Ao desmontar (trocar de turno, navegar) envia o pendente sem esperar.
  useEffect(() => {
    core.mounted = true;
    return () => {
      core.mounted = false;
      void api.flush();
    };
  }, [core, api]);

  return { ...view, ...api };
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun run test -- src/components/passagens/useHandoverAutosave.test.tsx`
Expected: PASS (18 testes)

- [ ] **Step 9: Write the failing test (`AutosaveIndicator`)**

`src/components/passagens/AutosaveIndicator.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { spDate } from "../../../test/clock";
import { AutosaveIndicator } from "./AutosaveIndicator";

const LAST = { at: spDate("2026-11-20", "09:10"), byName: "Bia Teste" };

describe("AutosaveIndicator", () => {
  it("é uma região de status educada (leitor de tela)", () => {
    render(
      <AutosaveIndicator
        status={{ kind: "idle" }}
        lastSaved={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("sem nada salvo e sem rascunho: 'Nada salvo ainda.'", () => {
    render(
      <AutosaveIndicator
        status={{ kind: "idle" }}
        lastSaved={null}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Nada salvo ainda.")).toBeInTheDocument();
  });

  it("parado, com rascunho do servidor: último salvamento e quem salvou", () => {
    render(
      <AutosaveIndicator
        status={{ kind: "idle" }}
        lastSaved={LAST}
        onRetry={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Último salvamento às 09:10 por Bia Teste"),
    ).toBeInTheDocument();
  });

  it("salvando: 'Salvando…'", () => {
    render(
      <AutosaveIndicator
        status={{ kind: "saving" }}
        lastSaved={LAST}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Salvando…")).toBeInTheDocument();
    expect(screen.queryByText(/Último salvamento/)).not.toBeInTheDocument();
  });

  it("salvo: 'Salvo às HH:mm' no fuso de São Paulo", () => {
    render(
      <AutosaveIndicator
        status={{ kind: "saved", at: spDate("2026-11-20", "23:59") }}
        lastSaved={LAST}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText("Salvo às 23:59")).toBeInTheDocument();
  });

  it("erro: 'Não salvo.', a mensagem e o botão 'Tentar de novo'", async () => {
    const onRetry = vi.fn();
    render(
      <AutosaveIndicator
        status={{ kind: "error", message: "Sem conexão." }}
        lastSaved={LAST}
        onRetry={onRetry}
      />,
    );

    expect(screen.getByText("Não salvo.")).toBeInTheDocument();
    expect(screen.getByText("Sem conexão.")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Tentar de novo" }),
    );
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("fora do erro não há botão de tentar de novo", () => {
    render(
      <AutosaveIndicator
        status={{ kind: "saving" }}
        lastSaved={null}
        onRetry={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Tentar de novo" }),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `bun run test -- src/components/passagens/AutosaveIndicator.test.tsx`
Expected: FAIL com `Error: Failed to resolve import "./AutosaveIndicator" from "src/components/passagens/AutosaveIndicator.test.tsx". Does the file exist?`

- [ ] **Step 11: Write minimal implementation**

`src/components/passagens/AutosaveIndicator.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { formatTimeBR } from "@/features/handovers/saoPaulo";
import type { SavedMark } from "@/features/handovers/types";
import type { AutosaveStatus } from "./useHandoverAutosave";

// Estado do salvamento automático, sempre em texto (nunca só cor). O contêiner
// (<output>, papel status) é uma região viva fixa: o leitor de tela anuncia só o que muda.
export function AutosaveIndicator({
  status,
  lastSaved,
  onRetry,
}: {
  status: AutosaveStatus;
  lastSaved: SavedMark | null;
  onRetry: () => void;
}) {
  return (
    <output
      aria-live="polite"
      className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
    >
      {status.kind === "saving" && <span>Salvando…</span>}
      {status.kind === "saved" && (
        <span>Salvo às {formatTimeBR(status.at)}</span>
      )}
      {status.kind === "idle" &&
        (lastSaved ? (
          <span>
            Último salvamento às {formatTimeBR(lastSaved.at)} por{" "}
            {lastSaved.byName}
          </span>
        ) : (
          <span>Nada salvo ainda.</span>
        ))}
      {status.kind === "error" && (
        <>
          <span className="font-medium text-destructive">Não salvo.</span>
          <span>{status.message}</span>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            Tentar de novo
          </Button>
        </>
      )}
    </output>
  );
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `bun run test -- src/components/passagens/AutosaveIndicator.test.tsx`
Expected: PASS (7 testes)

- [ ] **Step 13: Write the failing test (`ItemLineField`)**

`src/components/passagens/ItemLineField.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { ItemLine } from "@/features/handovers/types";
import { ItemLineField } from "./ItemLineField";

const LINE: ItemLine = {
  itemId: "a1",
  name: "Rede de proteção",
  unit: "rolo",
  kind: "control",
  quantity: 0,
  note: "",
};

function setup(props: { quantity?: number; note?: string } = {}) {
  const handlers = {
    onQuantityChange: vi.fn(),
    onQuantityCommit: vi.fn(),
    onNoteChange: vi.fn(),
    onNoteCommit: vi.fn(),
  };
  render(
    <TooltipProvider>
      <ul>
        <ItemLineField
          line={LINE}
          quantity={props.quantity ?? 0}
          note={props.note ?? ""}
          {...handlers}
        />
      </ul>
    </TooltipProvider>,
  );
  return handlers;
}

describe("ItemLineField", () => {
  it("mostra o nome, o contador e a unidade", () => {
    setup({ quantity: 3 });

    expect(
      screen.getByText("Rede de proteção", { selector: "span" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
    ).toHaveValue("3");
    expect(screen.getByText("rolo")).toBeInTheDocument();
  });

  it("a observação começa recolhida atrás de 'Adicionar observação'", async () => {
    setup();

    expect(
      screen.queryByLabelText("Observação de Rede de proteção"),
    ).not.toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", {
        name: "Adicionar observação em Rede de proteção",
      }),
    );

    expect(
      screen.getByLabelText("Observação de Rede de proteção"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Adicionar observação/ }),
    ).not.toBeInTheDocument();
  });

  it("observação já existente abre sozinha", () => {
    setup({ note: "box 4" });

    expect(screen.getByLabelText("Observação de Rede de proteção")).toHaveValue(
      "box 4",
    );
    expect(
      screen.queryByRole("button", { name: /Adicionar observação/ }),
    ).not.toBeInTheDocument();
  });

  it("a observação aceita 200 caracteres, com fonte de 16px", () => {
    setup({ note: "x" });

    const field = screen.getByLabelText("Observação de Rede de proteção");
    expect(field).toHaveAttribute("maxlength", "200");
    expect(field).toHaveClass("text-base");
  });

  it("digitar chama onNoteChange; sair do campo chama onNoteCommit", async () => {
    const { onNoteChange, onNoteCommit } = setup({ note: "a" });

    await userEvent.type(
      screen.getByLabelText("Observação de Rede de proteção"),
      "b",
    );
    expect(onNoteChange).toHaveBeenLastCalledWith("ab");

    await userEvent.tab();
    expect(onNoteCommit).toHaveBeenCalledWith("a");
  });
});
```

- [ ] **Step 14: Run test to verify it fails**

Run: `bun run test -- src/components/passagens/ItemLineField.test.tsx`
Expected: FAIL com `Error: Failed to resolve import "./ItemLineField" from "src/components/passagens/ItemLineField.test.tsx". Does the file exist?`

- [ ] **Step 15: Write minimal implementation**

`src/components/passagens/ItemLineField.tsx`:

```tsx
"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ITEM_NOTE_MAX_LENGTH } from "@/features/handovers/limits";
import type { ItemLine } from "@/features/handovers/types";
import { QuantityCounter } from "./QuantityCounter";

// Uma linha de item: nome, contador e observação opcional (recolhida até a
// pessoa pedir; já abre sozinha quando existe uma).
export function ItemLineField({
  line,
  quantity,
  note,
  onQuantityChange,
  onQuantityCommit,
  onNoteChange,
  onNoteCommit,
  disabled = false,
}: {
  line: ItemLine;
  quantity: number;
  note: string;
  onQuantityChange: (value: number) => void;
  onQuantityCommit: (value: number) => void;
  onNoteChange: (value: string) => void;
  onNoteCommit: (value: string) => void;
  disabled?: boolean;
}) {
  const [noteOpen, setNoteOpen] = useState(note !== "");

  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="font-medium">{line.name}</span>
        <QuantityCounter
          label={line.name}
          unit={line.unit}
          value={quantity}
          onChange={onQuantityChange}
          onCommit={onQuantityCommit}
          disabled={disabled}
        />
      </div>
      {noteOpen ? (
        <Input
          type="text"
          autoComplete="off"
          maxLength={ITEM_NOTE_MAX_LENGTH}
          className="text-base md:text-base"
          aria-label={`Observação de ${line.name}`}
          value={note}
          disabled={disabled}
          onChange={(event) => onNoteChange(event.target.value)}
          onBlur={(event) => onNoteCommit(event.target.value)}
        />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit"
          aria-label={`Adicionar observação em ${line.name}`}
          disabled={disabled}
          onClick={() => setNoteOpen(true)}
        >
          <Plus aria-hidden="true" />
          Adicionar observação
        </Button>
      )}
    </li>
  );
}
```

- [ ] **Step 16: Run test to verify it passes**

Run: `bun run test -- src/components/passagens/ItemLineField.test.tsx`
Expected: PASS (5 testes)

- [ ] **Step 17: Write the failing test (`HandoverFields`)**

`src/components/passagens/HandoverFields.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { FieldValues, ItemLine } from "@/features/handovers/types";
import { HandoverFields } from "./HandoverFields";

const REDE: ItemLine = {
  itemId: "a1",
  name: "Rede de proteção",
  unit: "rolo",
  kind: "control",
  quantity: 0,
  note: "",
};
const FITA: ItemLine = {
  itemId: "b1",
  name: "Fita adesiva",
  unit: "rolo",
  kind: "stock",
  quantity: 0,
  note: "",
};

const EMPTY_VALUES: FieldValues = {
  occurrencesText: "",
  nextShiftText: "",
  quantities: { a1: 0, b1: 0 },
  notes: { a1: "", b1: "" },
};

function setup(props: Partial<Parameters<typeof HandoverFields>[0]> = {}) {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  render(
    <TooltipProvider>
      <HandoverFields
        controls={[REDE]}
        stock={[FITA]}
        values={EMPTY_VALUES}
        onChange={onChange}
        onCommit={onCommit}
        canManageCatalog={false}
        itemsHref="/admin/itens?setor=s1"
        {...props}
      />
    </TooltipProvider>,
  );
  return { onChange, onCommit };
}

describe("HandoverFields", () => {
  it("mostra as quatro seções, na ordem do briefing, com as ajudas", () => {
    setup();

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(headings).toEqual(["Controles", "Estoque"]);
    expect(
      screen.getByText("Soma no período, como redes danificadas."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Contagem de agora. Vale a última, nunca a soma."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Ocorrências do turno")).toBeInTheDocument();
    expect(
      screen.getByText("Opcional. Conte o que saiu do normal."),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Fica para o próximo turno"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Opcional. O que quem recebe precisa saber primeiro."),
    ).toBeInTheDocument();
  });

  it("controles ficam antes do estoque, e as ocorrências depois dos dois", () => {
    setup();

    const text = document.body.textContent ?? "";
    expect(text.indexOf("Controles")).toBeLessThan(text.indexOf("Estoque"));
    expect(text.indexOf("Estoque")).toBeLessThan(
      text.indexOf("Ocorrências do turno"),
    );
    expect(text.indexOf("Ocorrências do turno")).toBeLessThan(
      text.lastIndexOf("Fica para o próximo turno"),
    );
  });

  it("os números chegam como estão em `values`, nunca em branco", () => {
    setup({
      values: { ...EMPTY_VALUES, quantities: { a1: 12, b1: 0 } },
    });

    expect(
      screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
    ).toHaveValue("12");
    expect(
      screen.getByRole("textbox", { name: "Quantidade de Fita adesiva" }),
    ).toHaveValue("0");
  });

  it("item sem entrada em values cai em 0 (nunca vazio)", () => {
    setup({ values: { ...EMPTY_VALUES, quantities: {}, notes: {} } });

    expect(
      screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
    ).toHaveValue("0");
  });

  it("digitar nas ocorrências chama onChange; sair do campo chama onCommit", async () => {
    const { onChange, onCommit } = setup();

    await userEvent.type(screen.getByLabelText("Ocorrências do turno"), "A");
    expect(onChange).toHaveBeenLastCalledWith({
      field: "occurrences",
      value: "A",
    });

    await userEvent.tab();
    expect(onCommit).toHaveBeenCalledWith({ field: "occurrences", value: "" });
  });

  it("'Fica para o próximo turno' manda o campo nextShift", async () => {
    const { onChange } = setup();

    await userEvent.type(
      screen.getByLabelText("Fica para o próximo turno"),
      "B",
    );

    expect(onChange).toHaveBeenLastCalledWith({
      field: "nextShift",
      value: "B",
    });
  });

  it("+ do item manda quantity com o itemId; observação manda note", async () => {
    const { onChange, onCommit } = setup();

    await userEvent.click(
      screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
    );
    expect(onChange).toHaveBeenCalledWith({
      field: "quantity",
      itemId: "a1",
      value: 1,
    });
    expect(onCommit).toHaveBeenCalledWith({
      field: "quantity",
      itemId: "a1",
      value: 1,
    });

    await userEvent.click(
      screen.getByRole("button", {
        name: "Adicionar observação em Fita adesiva",
      }),
    );
    await userEvent.type(
      screen.getByLabelText("Observação de Fita adesiva"),
      "x",
    );
    expect(onChange).toHaveBeenLastCalledWith({
      field: "note",
      itemId: "b1",
      value: "x",
    });
  });

  it("o campo de texto limita 2.000 caracteres e usa fonte de 16px", () => {
    setup();

    const field = screen.getByLabelText("Ocorrências do turno");
    expect(field).toHaveAttribute("maxlength", "2000");
    expect(field).toHaveClass("text-base");
  });

  it("o contador de caracteres só aparece perto do limite", () => {
    setup({
      values: { ...EMPTY_VALUES, occurrencesText: "a".repeat(1799) },
    });
    expect(screen.queryByText(/de 2\.000 caracteres/)).not.toBeInTheDocument();
  });

  it("a partir de 90% mostra quantos caracteres já tem", () => {
    setup({
      values: { ...EMPTY_VALUES, occurrencesText: "a".repeat(1800) },
    });

    expect(screen.getByText("1.800 de 2.000 caracteres")).toBeInTheDocument();
  });

  it("desabilitado trava os campos e os contadores", () => {
    setup({ disabled: true });

    expect(screen.getByLabelText("Ocorrências do turno")).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
    ).toBeDisabled();
  });

  it("sem controles, só Estoque aparece", () => {
    setup({ controls: [] });

    expect(
      screen.queryByRole("heading", { name: "Controles" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Estoque" }),
    ).toBeInTheDocument();
  });

  describe("setor sem itens", () => {
    it("operador: pede ao administrador e ainda deixa entregar com ocorrências", () => {
      setup({ controls: [], stock: [] });

      expect(screen.getByText("Nenhum item neste setor.")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Peça a um administrador para cadastrar os itens. Você ainda pode entregar o turno com as ocorrências.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Ir para Itens" }),
      ).not.toBeInTheDocument();
      expect(screen.getByLabelText("Ocorrências do turno")).toBeInTheDocument();
    });

    it("admin: texto próprio e link para os itens do setor", () => {
      setup({ controls: [], stock: [], canManageCatalog: true });

      expect(
        screen.getByText(
          "Cadastre os itens do setor para contá-los na passagem.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Ir para Itens" }),
      ).toHaveAttribute("href", "/admin/itens?setor=s1");
    });

    it("sem itens não há seção Controles nem Estoque", () => {
      setup({ controls: [], stock: [] });

      expect(
        screen.queryByRole("heading", { name: "Controles" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Estoque" }),
      ).not.toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 18: Run test to verify it fails**

Run: `bun run test -- src/components/passagens/HandoverFields.test.tsx`
Expected: FAIL com `Error: Failed to resolve import "./HandoverFields" from "src/components/passagens/HandoverFields.test.tsx". Does the file exist?`

- [ ] **Step 19: Write minimal implementation**

`src/components/passagens/HandoverFields.tsx`:

```tsx
"use client";

import { TriangleAlert } from "lucide-react";
import { useId } from "react";

import { EmptyState } from "@/components/admin/EmptyState";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { TEXT_MAX_LENGTH } from "@/features/handovers/limits";
import { formatQuantity } from "@/features/handovers/quantity";
import type {
  FieldChange,
  FieldValues,
  ItemLine,
} from "@/features/handovers/types";
import { ItemLineField } from "./ItemLineField";

const COUNTER_THRESHOLD = Math.floor(TEXT_MAX_LENGTH * 0.9);

function ItemSection({
  title,
  help,
  lines,
  values,
  onChange,
  onCommit,
  disabled,
}: {
  title: string;
  help: string;
  lines: readonly ItemLine[];
  values: FieldValues;
  onChange: (change: FieldChange) => void;
  onCommit: (change: FieldChange) => void;
  disabled: boolean;
}) {
  const headingId = useId();
  if (lines.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-1">
      <h2 id={headingId} className="text-lg font-semibold">
        {title}
      </h2>
      <p className="text-sm text-muted-foreground">{help}</p>
      <ul className="flex flex-col divide-y">
        {lines.map((line) => (
          <ItemLineField
            key={line.itemId}
            line={line}
            quantity={values.quantities[line.itemId] ?? 0}
            note={values.notes[line.itemId] ?? ""}
            disabled={disabled}
            onQuantityChange={(value) =>
              onChange({ field: "quantity", itemId: line.itemId, value })
            }
            onQuantityCommit={(value) =>
              onCommit({ field: "quantity", itemId: line.itemId, value })
            }
            onNoteChange={(value) =>
              onChange({ field: "note", itemId: line.itemId, value })
            }
            onNoteCommit={(value) =>
              onCommit({ field: "note", itemId: line.itemId, value })
            }
          />
        ))}
      </ul>
    </section>
  );
}

function TextSection({
  title,
  description,
  value,
  onChange,
  onCommit,
  disabled,
  emphasized = false,
}: {
  title: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
  disabled: boolean;
  emphasized?: boolean;
}) {
  const id = useId();
  return (
    <section
      className={
        emphasized
          ? "rounded-lg border-2 border-warning-foreground/40 bg-warning/30 p-4"
          : undefined
      }
    >
      <Field>
        <FieldLabel htmlFor={id} className="text-lg font-semibold">
          {emphasized && (
            <TriangleAlert aria-hidden="true" className="size-4" />
          )}
          {title}
        </FieldLabel>
        <FieldDescription>{description}</FieldDescription>
        <Textarea
          id={id}
          rows={4}
          maxLength={TEXT_MAX_LENGTH}
          className="text-base md:text-base"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => onCommit(event.target.value)}
        />
        {value.length >= COUNTER_THRESHOLD && (
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatQuantity(value.length)} de {formatQuantity(TEXT_MAX_LENGTH)}{" "}
            caracteres
          </p>
        )}
      </Field>
    </section>
  );
}

// Corpo do formulário da passagem, sem estado próprio: valores e eventos vêm
// do pai (que decide salvar sozinho ou só ao registrar a correção).
export function HandoverFields({
  controls,
  stock,
  values,
  onChange,
  onCommit,
  disabled = false,
  canManageCatalog,
  itemsHref,
}: {
  controls: readonly ItemLine[];
  stock: readonly ItemLine[];
  values: FieldValues;
  onChange: (change: FieldChange) => void;
  onCommit: (change: FieldChange) => void;
  disabled?: boolean;
  canManageCatalog: boolean;
  itemsHref: string;
}) {
  const noItems = controls.length === 0 && stock.length === 0;

  return (
    <FieldGroup className="gap-8">
      {noItems ? (
        <EmptyState
          title="Nenhum item neste setor."
          description={
            canManageCatalog
              ? "Cadastre os itens do setor para contá-los na passagem."
              : "Peça a um administrador para cadastrar os itens. Você ainda pode entregar o turno com as ocorrências."
          }
          action={
            canManageCatalog
              ? { label: "Ir para Itens", href: itemsHref }
              : undefined
          }
        />
      ) : (
        <>
          <ItemSection
            title="Controles"
            help="Soma no período, como redes danificadas."
            lines={controls}
            values={values}
            onChange={onChange}
            onCommit={onCommit}
            disabled={disabled}
          />
          <ItemSection
            title="Estoque"
            help="Contagem de agora. Vale a última, nunca a soma."
            lines={stock}
            values={values}
            onChange={onChange}
            onCommit={onCommit}
            disabled={disabled}
          />
        </>
      )}
      <TextSection
        title="Ocorrências do turno"
        description="Opcional. Conte o que saiu do normal."
        value={values.occurrencesText}
        disabled={disabled}
        onChange={(value) => onChange({ field: "occurrences", value })}
        onCommit={(value) => onCommit({ field: "occurrences", value })}
      />
      <TextSection
        title="Fica para o próximo turno"
        description="Opcional. O que quem recebe precisa saber primeiro."
        value={values.nextShiftText}
        disabled={disabled}
        emphasized
        onChange={(value) => onChange({ field: "nextShift", value })}
        onCommit={(value) => onCommit({ field: "nextShift", value })}
      />
    </FieldGroup>
  );
}
```

- [ ] **Step 20: Run test to verify it passes**

Run: `bun run test -- src/components/passagens/HandoverFields.test.tsx`
Expected: PASS (15 testes)

- [ ] **Step 21: Write the failing test (`HandoverHeader`)**

`src/components/passagens/HandoverHeader.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { HandoverHeader } from "./HandoverHeader";

const mocks = vi.hoisted(() => ({ push: vi.fn(), toastError: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("sonner", () => ({ toast: { error: mocks.toastError } }));

const SECTOR_ID = "11111111-1111-4111-8111-111111111111";
const MANHA = "22222222-2222-4222-8222-222222222222";
const TARDE = "33333333-3333-4333-8333-333333333333";
const SHIFTS = [
  { id: MANHA, name: "Turno Manhã", startsAt: "06:00", endsAt: "14:00" },
  { id: TARDE, name: "Turno Tarde", startsAt: "14:00", endsAt: "22:00" },
];

function setup(props: Partial<Parameters<typeof HandoverHeader>[0]> = {}) {
  render(
    <HandoverHeader
      sectorId={SECTOR_ID}
      sectorName="ULD"
      shifts={SHIFTS}
      shiftId={MANHA}
      operationalDate="2026-11-20"
      today="2026-11-20"
      minDate="2026-10-20"
      sectorParam={null}
      beforeNavigate={vi.fn().mockResolvedValue(true)}
      {...props}
    />,
  );
}

describe("HandoverHeader", () => {
  beforeEach(() => {
    mocks.push.mockReset();
    mocks.toastError.mockReset();
  });

  it("mostra o setor em texto, o turno escolhido e a data", () => {
    setup();

    expect(screen.getByText("Setor")).toBeInTheDocument();
    expect(screen.getByText("ULD")).toBeInTheDocument();
    expect(screen.getByLabelText("Turno")).toHaveValue(MANHA);
    expect(
      screen.getByRole("option", { name: "Turno Tarde (14:00–22:00)" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Data")).toHaveValue("2026-11-20");
  });

  it("a data só aceita de hoje até 31 dias atrás (min e max do campo)", () => {
    setup();

    expect(screen.getByLabelText("Data")).toHaveAttribute("min", "2026-10-20");
    expect(screen.getByLabelText("Data")).toHaveAttribute("max", "2026-11-20");
  });

  it("trocar o turno salva e navega mantendo a data", async () => {
    const beforeNavigate = vi.fn().mockResolvedValue(true);
    setup({ beforeNavigate });

    await userEvent.selectOptions(screen.getByLabelText("Turno"), TARDE);

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        `/passagens/nova?turno=${TARDE}&data=2026-11-20`,
      ),
    );
    expect(beforeNavigate).toHaveBeenCalledTimes(1);
  });

  it("trocar a data navega mantendo o turno", async () => {
    setup();

    fireEvent.change(screen.getByLabelText("Data"), {
      target: { value: "2026-11-19" },
    });

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        `/passagens/nova?turno=${MANHA}&data=2026-11-19`,
      ),
    );
  });

  it("o admin leva o setor na URL", async () => {
    setup({ sectorParam: SECTOR_ID });

    await userEvent.selectOptions(screen.getByLabelText("Turno"), TARDE);

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        `/passagens/nova?turno=${TARDE}&data=2026-11-20&setor=${SECTOR_ID}`,
      ),
    );
  });

  it("se não conseguir salvar, não navega e avisa", async () => {
    setup({ beforeNavigate: vi.fn().mockResolvedValue(false) });

    await userEvent.selectOptions(screen.getByLabelText("Turno"), TARDE);

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Não foi possível salvar. Tente de novo antes de trocar de turno.",
      ),
    );
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Turno")).toHaveValue(MANHA);
  });

  it("sem beforeNavigate navega direto", async () => {
    setup({ beforeNavigate: undefined });

    await userEvent.selectOptions(screen.getByLabelText("Turno"), TARDE);

    await waitFor(() => expect(mocks.push).toHaveBeenCalledTimes(1));
  });

  it("data futura, antiga demais ou vazia é ignorada", () => {
    setup();
    const date = screen.getByLabelText("Data");

    for (const value of ["2026-11-21", "2026-10-19", ""]) {
      fireEvent.change(date, { target: { value } });
    }

    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("escolher o que já está escolhido não navega", async () => {
    setup();

    fireEvent.change(screen.getByLabelText("Data"), {
      target: { value: "2026-11-20" },
    });
    await userEvent.selectOptions(screen.getByLabelText("Turno"), MANHA);

    expect(mocks.push).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 22: Run test to verify it fails**

Run: `bun run test -- src/components/passagens/HandoverHeader.test.tsx`
Expected: FAIL com `Error: Failed to resolve import "./HandoverHeader" from "src/components/passagens/HandoverHeader.test.tsx". Does the file exist?`

- [ ] **Step 23: Write minimal implementation**

`src/components/passagens/HandoverHeader.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { SelectField } from "@/components/admin/SelectField";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SWITCH_FAILED_MESSAGE } from "@/features/handovers/messages";
import { isIsoDate } from "@/features/handovers/saoPaulo";
import type { ShiftChoice } from "@/features/handovers/types";
import { newHandoverHref } from "@/features/handovers/urls";

// Cabeçalho do formulário: setor (texto), turno e data. Trocar turno ou data
// abre o rascunho DAQUELE turno e dia (D-F3-2): salva o que está pendente e
// navega; a troca de turno mantém a data e a de data mantém o turno.
export function HandoverHeader({
  sectorId,
  sectorName,
  shifts,
  shiftId,
  operationalDate,
  today,
  minDate,
  sectorParam,
  beforeNavigate,
}: {
  sectorId: string;
  sectorName: string;
  shifts: readonly ShiftChoice[];
  shiftId: string;
  operationalDate: string;
  today: string;
  minDate: string;
  sectorParam: string | null;
  beforeNavigate?: () => Promise<boolean>;
}) {
  const router = useRouter();
  const uid = useId();
  const [navigating, startNavigation] = useTransition();
  const [saving, setSaving] = useState(false);

  async function go(next: { shiftId: string; operationalDate: string }) {
    setSaving(true);
    const canLeave = beforeNavigate ? await beforeNavigate() : true;
    setSaving(false);
    if (!canLeave) {
      toast.error(SWITCH_FAILED_MESSAGE);
      return;
    }
    startNavigation(() => {
      router.push(
        newHandoverHref({ sectorId, ...next }, sectorParam ?? undefined),
      );
    });
  }

  function handleDate(value: string) {
    // Campo limpo ou fora da janela: ignora (o campo volta ao valor atual).
    if (!isIsoDate(value) || value < minDate || value > today) return;
    if (value !== operationalDate) void go({ shiftId, operationalDate: value });
  }

  const busy = saving || navigating;

  return (
    <FieldGroup className="gap-4 sm:grid sm:grid-cols-3">
      <Field>
        <FieldLabel>Setor</FieldLabel>
        <p className="flex h-9 items-center text-base max-md:h-11">
          {sectorName}
        </p>
      </Field>
      <SelectField
        label="Turno"
        value={shiftId}
        disabled={busy}
        options={shifts.map((shift) => ({
          value: shift.id,
          label: `${shift.name} (${shift.startsAt}–${shift.endsAt})`,
        }))}
        onValueChange={(value) => {
          if (value !== shiftId) void go({ shiftId: value, operationalDate });
        }}
      />
      <Field>
        <FieldLabel htmlFor={`${uid}-date`}>Data</FieldLabel>
        <Input
          id={`${uid}-date`}
          type="date"
          min={minDate}
          max={today}
          value={operationalDate}
          disabled={busy}
          onChange={(event) => handleDate(event.target.value)}
        />
      </Field>
    </FieldGroup>
  );
}
```

- [ ] **Step 24: Run test to verify it passes**

Run: `bun run test -- src/components/passagens/HandoverHeader.test.tsx`
Expected: PASS (9 testes)

- [ ] **Step 24b: Subir o mínimo de actions no guarda (vermelho de propósito)**

Em `src/app/actionsGuards.test.ts` (**LER antes**) troque `const MIN_APP_ACTION_FILES = 1;` por:

```ts
const MIN_APP_ACTION_FILES = 2;
```

Run: `bun run test -- src/app/actionsGuards.test.ts`
Expected: FAIL em "encontra os arquivos de actions" com `AssertionError: expected 1 to be greater than or equal to 2` (só existe `src/app/(app)/actions.ts`; o `passagens/actions.ts` nasce no Step 27).

- [ ] **Step 25: Write the failing test (Server Actions, PGlite)**

`src/app/(app)/passagens/actions.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { handover, handoverItem } from "@/db/schema/handovers";
import { authzOf } from "../../../../test/authz";
import { spDate } from "../../../../test/clock";
import { createTestDb, resetDb, type TestDb } from "../../../../test/db";
import {
  insertHandover,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../../test/fixtures";

// O banco de verdade (PGlite) entra no lugar de "@/db" por um getter; o
// guarda de acesso é simulado: sem sessão o requireUser redireciona.
const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  revalidatePath: vi.fn(),
  database: { current: undefined as unknown },
  touched: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", () => ({
  get db() {
    mocks.touched();
    return mocks.database.current;
  },
}));

import { deliverHandoverAction, saveHandoverFieldAction } from "./actions";

const TODAY = "2026-11-20";
const REDIRECT = Object.assign(new Error("NEXT_REDIRECT"), {
  digest: "NEXT_REDIRECT;replace;/entrar;307;",
});

let client: PGlite;
let db: TestDb;

beforeAll(async () => {
  ({ client, db } = await createTestDb());
  mocks.database.current = db;
});

afterAll(async () => {
  await client.close();
});

beforeEach(async () => {
  await resetDb(client);
  mocks.requireUser.mockReset();
  mocks.revalidatePath.mockReset();
  mocks.touched.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(spDate(TODAY, "10:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

async function scenario() {
  const uld = await insertSector(db, "ULD");
  const shiftRow = await insertShift(db, { sectorId: uld.id });
  const rede = await insertItem(db, {
    sectorId: uld.id,
    name: "Rede de proteção",
  });
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Ana Teste",
  });
  const ref = {
    sectorId: uld.id,
    shiftId: shiftRow.id,
    operationalDate: TODAY,
  };
  return { uld, shiftRow, rede, ana, ref };
}

describe("sem sessão", () => {
  beforeEach(() => {
    mocks.requireUser.mockRejectedValue(REDIRECT);
  });

  it("saveHandoverFieldAction redireciona e não toca o banco", async () => {
    await expect(
      saveHandoverFieldAction({ field: "occurrences", value: "x" }),
    ).rejects.toBe(REDIRECT);

    expect(mocks.touched).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("deliverHandoverAction redireciona e não toca o banco", async () => {
    await expect(deliverHandoverAction({})).rejects.toBe(REDIRECT);

    expect(mocks.touched).not.toHaveBeenCalled();
  });
});

describe("saveHandoverFieldAction", () => {
  it("operador do setor salva; o rascunho nasce e a tela não é revalidada", async () => {
    const { ana, ref, rede } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({
        role: "operator",
        userId: ana.id,
        sectorId: ref.sectorId,
        name: "Ana Teste",
      }),
    );

    const result = await saveHandoverFieldAction({
      ...ref,
      field: "quantity",
      itemId: rede.id,
      value: 4,
    });

    expect(result).toMatchObject({ ok: true, savedByName: "Ana Teste" });
    const rows = await db.select().from(handover);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "draft", updatedBy: ana.id });
    const items = await db.select().from(handoverItem);
    expect(items).toMatchObject([{ itemId: rede.id, quantity: 4 }]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("texto é normalizado pelo schema (NFC, quebra de linha)", async () => {
    const { ana, ref } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: ref.sectorId }),
    );

    await saveHandoverFieldAction({
      ...ref,
      field: "occurrences",
      value: "Cafe\u{301}\r\nfim",
    });

    const [row] = await db.select().from(handover);
    expect(row?.occurrencesText).toBe("Caf\u{e9}\nfim");
  });

  it.each([
    [-1],
    [1.5],
    [100_000],
    ["3"],
  ])("quantidade %j é entrada inválida e não cria rascunho", async (value) => {
    const { ana, ref, rede } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: ref.sectorId }),
    );

    const result = await saveHandoverFieldAction({
      ...ref,
      field: "quantity",
      itemId: rede.id,
      value,
    });

    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(await db.select().from(handover)).toEqual([]);
  });

  it("limite exato: 99.999 passa, 2.000 pontos de código passam e 2.001 não", async () => {
    const { ana, ref, rede } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: ref.sectorId }),
    );

    expect(
      await saveHandoverFieldAction({
        ...ref,
        field: "quantity",
        itemId: rede.id,
        value: 99_999,
      }),
    ).toMatchObject({ ok: true });
    expect(
      await saveHandoverFieldAction({
        ...ref,
        field: "occurrences",
        value: "\u{1F600}".repeat(2000),
      }),
    ).toMatchObject({ ok: true });

    const tooLong = await saveHandoverFieldAction({
      ...ref,
      field: "occurrences",
      value: "\u{1F600}".repeat(2001),
    });
    expect(tooLong).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "O texto pode ter no máximo 2.000 caracteres.",
      fieldErrors: { value: "O texto pode ter no máximo 2.000 caracteres." },
    });
  });

  it("data malformada: INVALID_INPUT com 'Data inválida.'", async () => {
    const { ana, ref } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: ref.sectorId }),
    );

    const result = await saveHandoverFieldAction({
      ...ref,
      operationalDate: "2026-02-30",
      field: "occurrences",
      value: "x",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Data inválida.",
    });
  });

  it("operador de outro setor recebe NOT_FOUND e nada é gravado", async () => {
    const { ref } = await scenario();
    const carga = await insertSector(db, "Carga");
    const intruso = await insertUser(db, {
      role: "operator",
      sectorId: carga.id,
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: intruso.id, sectorId: carga.id }),
    );

    const result = await saveHandoverFieldAction({
      ...ref,
      field: "occurrences",
      value: "invasão",
    });

    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await db.select().from(handover)).toEqual([]);
  });

  it("passagem confirmada recusa até o admin (HANDOVER_LOCKED)", async () => {
    const { uld, shiftRow, ana } = await scenario();
    const bia = await insertUser(db, { role: "operator", sectorId: uld.id });
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    await insertHandover(db, {
      sectorId: uld.id,
      shiftId: shiftRow.id,
      operationalDate: TODAY,
      status: "confirmed",
      deliveredBy: ana.id,
      confirmedBy: bia.id,
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "admin", userId: admin.id }),
    );

    const result = await saveHandoverFieldAction({
      sectorId: uld.id,
      shiftId: shiftRow.id,
      operationalDate: TODAY,
      field: "occurrences",
      value: "tentativa",
    });

    expect(result).toMatchObject({ ok: false, code: "HANDOVER_LOCKED" });
  });

  it("falha inesperada do banco vira INTERNAL sem vazar o texto", async () => {
    const { ana, ref } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: ref.sectorId }),
    );
    mocks.database.current = {
      transaction: async () => {
        throw new Error('relation "handover" does not exist');
      },
    };
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await saveHandoverFieldAction({
      ...ref,
      field: "occurrences",
      value: "x",
    });
    mocks.database.current = db;
    consoleError.mockRestore();

    expect(result).toEqual({
      ok: false,
      code: "INTERNAL",
      message: "Não foi possível concluir. Tente de novo.",
    });
  });
});

describe("deliverHandoverAction", () => {
  it("entrega, devolve o id e revalida a tela", async () => {
    const { ana, ref, rede } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: ref.sectorId }),
    );

    const result = await deliverHandoverAction(ref);

    expect(result).toMatchObject({ ok: true });
    const [row] = await db.select().from(handover);
    expect(row).toMatchObject({ status: "delivered", deliveredBy: ana.id });
    // Item ativo que faltava entra com 0.
    const items = await db
      .select()
      .from(handoverItem)
      .where(eq(handoverItem.itemId, rede.id));
    expect(items).toMatchObject([{ quantity: 0 }]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)", "layout");
  });

  it("segunda entrega: ALREADY_DELIVERED com nome e hora, sem revalidar", async () => {
    const { ana, ref } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: ref.sectorId }),
    );
    await deliverHandoverAction(ref);
    mocks.revalidatePath.mockReset();

    const result = await deliverHandoverAction(ref);

    expect(result).toMatchObject({
      ok: false,
      code: "ALREADY_DELIVERED",
      message: "Esta passagem já foi entregue por Ana Teste às 10:00.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("operador de outro setor recebe NOT_FOUND", async () => {
    const { ref } = await scenario();
    const carga = await insertSector(db, "Carga");
    const intruso = await insertUser(db, {
      role: "operator",
      sectorId: carga.id,
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: intruso.id, sectorId: carga.id }),
    );

    const result = await deliverHandoverAction(ref);

    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await db.select().from(handover)).toEqual([]);
  });

  it("entrada inválida: id fora do formato", async () => {
    const { ana, ref } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: ref.sectorId }),
    );

    const result = await deliverHandoverAction({ ...ref, shiftId: "abc" });

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Registro inválido. Atualize a página.",
    });
  });

  it("data futura: DATE_OUT_OF_RANGE e nada é criado", async () => {
    const { ana, ref } = await scenario();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: ana.id, sectorId: ref.sectorId }),
    );

    const result = await deliverHandoverAction({
      ...ref,
      operationalDate: "2026-11-21",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "DATE_OUT_OF_RANGE",
      message: "Escolha uma data de hoje ou dos últimos 31 dias.",
    });
    expect(await db.select().from(handover)).toEqual([]);
  });
});
```

- [ ] **Step 26: Run test to verify it fails**

Run: `bun run test -- "src/app/(app)/passagens/actions.test.ts"`
Expected: FAIL com `Error: Cannot find module '/src/app/(app)/passagens/actions' imported from …/actions.test.ts` (o teste usa `vi.mock`, e com mock o Vitest mostra o caminho absoluto a partir da raiz).

- [ ] **Step 27: Write minimal implementation**

`src/app/(app)/passagens/actions.ts`:

```ts
"use server";

import type { AdminResult } from "@/features/admin/result";
import type { Delivered } from "@/features/handovers/deliver";
import { deliverHandover } from "@/features/handovers/deliver";
import type { SavedField } from "@/features/handovers/draft";
import { saveHandoverField } from "@/features/handovers/draft";
import { runHandoverAction } from "@/features/handovers/runHandoverAction";
import {
  deliverHandoverSchema,
  saveFieldSchema,
} from "@/features/handovers/schemas";
import { requireUser } from "@/lib/auth/session";

// Salvamento automático: nunca revalida (re-renderizaria a tela enquanto a
// pessoa digita).
export async function saveHandoverFieldAction(
  input: unknown,
): Promise<AdminResult<SavedField>> {
  const actor = await requireUser();
  return runHandoverAction({
    actor,
    schema: saveFieldSchema,
    input,
    revalidate: false,
    run: ({ db, now, actor: who, input: data }) =>
      saveHandoverField(db, who, data, now),
  });
}

export async function deliverHandoverAction(
  input: unknown,
): Promise<AdminResult<Delivered>> {
  const actor = await requireUser();
  return runHandoverAction({
    actor,
    schema: deliverHandoverSchema,
    input,
    revalidate: true,
    run: ({ db, now, actor: who, input: data }) =>
      deliverHandover(db, who, data, now),
  });
}
```

- [ ] **Step 28: Run test to verify it passes**

Run: `bun run test -- "src/app/(app)/passagens/actions.test.ts" src/app/actionsGuards.test.ts`
Expected: PASS (18 testes em `actions.test.ts`; o `actionsGuards.test.ts` volta a passar: agora há 2 arquivos de actions)

- [ ] **Step 29: Write the failing test (`HandoverForm`)**

`src/components/passagens/HandoverForm.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { type AdminResult, fail, ok } from "@/features/admin/result";
import type { SavedField } from "@/features/handovers/draft";
import type { HandoverFormState } from "@/features/handovers/formState";
import { UNSAVED_DELIVER_MESSAGE } from "@/features/handovers/messages";
import type { FormMode } from "@/features/handovers/types";
import { spDate } from "../../../test/clock";
import { HandoverForm } from "./HandoverForm";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  deliver: vi.fn(),
  push: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/passagens/actions", () => ({
  saveHandoverFieldAction: mocks.save,
  deliverHandoverAction: mocks.deliver,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const SECTOR_ID = "11111111-1111-4111-8111-111111111111";
const MANHA = "22222222-2222-4222-8222-222222222222";
const TARDE = "33333333-3333-4333-8333-333333333333";
const REDE_ID = "44444444-4444-4444-8444-444444444444";
const FITA_ID = "55555555-5555-4555-8555-555555555555";
const SHIFTS = [
  { id: MANHA, name: "Turno Manhã", startsAt: "06:00", endsAt: "14:00" },
  { id: TARDE, name: "Turno Tarde", startsAt: "14:00", endsAt: "22:00" },
];

const REDE = {
  itemId: REDE_ID,
  name: "Rede de proteção",
  unit: "rolo",
  kind: "control",
  quantity: 0,
  note: "",
} as const;

const STATE: HandoverFormState & { mode: FormMode } = {
  ref: { sectorId: SECTOR_ID, shiftId: MANHA, operationalDate: "2026-11-20" },
  handoverId: null,
  status: null,
  sectorName: "ULD",
  shiftName: "Turno Manhã",
  occurrencesText: "",
  nextShiftText: "",
  controls: [REDE],
  stock: [
    {
      itemId: FITA_ID,
      name: "Fita adesiva",
      unit: "rolo",
      kind: "stock",
      quantity: 0,
      note: "",
    },
  ],
  saved: null,
  deliveredByName: null,
  deliveredAt: null,
  mode: "draft",
};

function renderForm(
  state: HandoverFormState & { mode: FormMode } = STATE,
  props: { sectorParam?: string | null } = {},
) {
  render(
    <TooltipProvider>
      <HandoverForm
        state={state}
        shifts={SHIFTS}
        today="2026-11-20"
        minDate="2026-10-20"
        sectorParam={props.sectorParam ?? null}
        canManageCatalog={false}
      />
    </TooltipProvider>,
  );
}

const savedOk = (hour = "10:00") =>
  ok({
    handoverId: "h1",
    savedAt: spDate("2026-11-20", hour),
    savedByName: "Ana Teste",
  });

const deliverButton = () =>
  screen.getByRole("button", { name: /Entregar turno|Entregando…/ });

describe("HandoverForm", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.save.mockResolvedValue(savedOk());
    mocks.deliver.mockResolvedValue(ok({ id: "h1", deliveredAt: new Date() }));
  });

  it("nunca começa em branco: números em 0, textos vazios e 'Nada salvo ainda.'", () => {
    renderForm();

    expect(
      screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
    ).toHaveValue("0");
    expect(
      screen.getByRole("textbox", { name: "Quantidade de Fita adesiva" }),
    ).toHaveValue("0");
    expect(screen.getByLabelText("Ocorrências do turno")).toHaveValue("");
    expect(screen.getByText("Nada salvo ainda.")).toBeInTheDocument();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("mostra o último salvamento de um rascunho que já existe", () => {
    renderForm({
      ...STATE,
      handoverId: "h1",
      status: "draft",
      saved: { at: spDate("2026-11-20", "09:10"), byName: "Bia Teste" },
    });

    expect(
      screen.getByText("Último salvamento às 09:10 por Bia Teste"),
    ).toBeInTheDocument();
  });

  it("começa com os valores do rascunho salvo", () => {
    renderForm({
      ...STATE,
      occurrencesText: "Rede rasgada no box 4.",
      controls: [{ ...REDE, quantity: 7, note: "box 4" }],
    });

    expect(
      screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
    ).toHaveValue("7");
    expect(screen.getByLabelText("Observação de Rede de proteção")).toHaveValue(
      "box 4",
    );
    expect(screen.getByLabelText("Ocorrências do turno")).toHaveValue(
      "Rede rasgada no box 4.",
    );
  });

  it("+ salva na hora e mostra 'Salvo às HH:mm'", async () => {
    renderForm();

    await userEvent.click(
      screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
    );

    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith({
        sectorId: SECTOR_ID,
        shiftId: MANHA,
        operationalDate: "2026-11-20",
        field: "quantity",
        itemId: REDE_ID,
        value: 1,
      }),
    );
    expect(await screen.findByText("Salvo às 10:00")).toBeInTheDocument();
  });

  it("texto digitado salva sozinho depois do debounce, uma vez só", async () => {
    renderForm();

    // Um único evento de change: digitar letra por letra numa máquina lenta
    // pode estourar os 800 ms entre teclas e salvar antes da hora.
    fireEvent.change(screen.getByLabelText("Ocorrências do turno"), {
      target: { value: "Aviso" },
    });
    expect(mocks.save).not.toHaveBeenCalled();

    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1), {
      timeout: 3000,
    });
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({ field: "occurrences", value: "Aviso" }),
    );
  });

  it("'Entregar turno' salva o pendente ANTES de entregar", async () => {
    const order: string[] = [];
    let finishSave: (result: AdminResult<SavedField>) => void = () => {};
    mocks.save.mockImplementation(() => {
      order.push("save");
      return new Promise((resolve) => {
        finishSave = resolve;
      });
    });
    mocks.deliver.mockImplementation(async () => {
      order.push("deliver");
      return ok({ id: "h1", deliveredAt: new Date() });
    });
    renderForm();

    // Um único change: com o debounce real, digitar letra por letra pode
    // disparar um salvamento intermediário e o teste depende da velocidade.
    fireEvent.change(screen.getByLabelText("Ocorrências do turno"), {
      target: { value: "Aviso" },
    });
    await userEvent.click(deliverButton());

    await waitFor(() => expect(order).toEqual(["save"]));
    expect(mocks.deliver).not.toHaveBeenCalled();

    finishSave(savedOk());
    await waitFor(() => expect(order).toEqual(["save", "deliver"]));
  });

  it("entrega com sucesso: toast e navegação para o resumo", async () => {
    renderForm();

    await userEvent.click(deliverButton());

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith("/passagens/h1"),
    );
    expect(mocks.deliver).toHaveBeenCalledWith({
      sectorId: SECTOR_ID,
      shiftId: MANHA,
      operationalDate: "2026-11-20",
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Turno entregue.");
    // Depois de entregar o botão fica travado até a navegação terminar.
    expect(screen.getByRole("button", { name: "Entregando…" })).toBeDisabled();
  });

  it("entregar com tudo zerado e sem texto é permitido (nada bloqueia)", async () => {
    renderForm();

    await userEvent.click(deliverButton());

    await waitFor(() => expect(mocks.deliver).toHaveBeenCalledTimes(1));
  });

  it("falha ao salvar bloqueia a entrega e mostra o texto de aviso", async () => {
    mocks.save.mockResolvedValue(fail("INTERNAL", "Sem rede."));
    renderForm();

    await userEvent.click(
      screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
    );
    await userEvent.click(deliverButton());

    expect(
      await screen.findByText(UNSAVED_DELIVER_MESSAGE),
    ).toBeInTheDocument();
    expect(UNSAVED_DELIVER_MESSAGE).toBe(
      "Há alterações sem salvar. Toque em “Tentar de novo” e entregue de novo.",
    );
    expect(mocks.deliver).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(screen.getByText("Não salvo.")).toBeInTheDocument();
    // O digitado fica.
    expect(
      screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
    ).toHaveValue("1");
  });

  it("'Tentar de novo' reenvia e depois dá para entregar", async () => {
    mocks.save.mockResolvedValueOnce(fail("INTERNAL", "Sem rede."));
    renderForm();

    await userEvent.click(
      screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Tentar de novo" }),
    );

    expect(await screen.findByText("Salvo às 10:00")).toBeInTheDocument();
    expect(mocks.save).toHaveBeenCalledTimes(2);

    await userEvent.click(deliverButton());
    await waitFor(() => expect(mocks.deliver).toHaveBeenCalledTimes(1));
  });

  it("segunda entrega: a mensagem do servidor aparece no formulário, sem perder o digitado", async () => {
    mocks.deliver.mockResolvedValue(
      fail(
        "ALREADY_DELIVERED",
        "Esta passagem já foi entregue por Bia Teste às 14:05.",
      ),
    );
    renderForm();

    await userEvent.type(
      screen.getByLabelText("Ocorrências do turno"),
      "Aviso",
    );
    await userEvent.click(deliverButton());

    expect(
      await screen.findByText(
        "Esta passagem já foi entregue por Bia Teste às 14:05.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Ocorrências do turno")).toHaveValue("Aviso");
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("enquanto entrega, o botão fica desabilitado como 'Entregando…'", async () => {
    let finish: (
      result: AdminResult<{ id: string; deliveredAt: Date }>,
    ) => void = () => {};
    mocks.deliver.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    renderForm();

    await userEvent.click(deliverButton());

    expect(
      await screen.findByRole("button", { name: "Entregando…" }),
    ).toBeDisabled();
    finish(ok({ id: "h1", deliveredAt: new Date() }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
  });

  it("mostra a ajuda de que dá para corrigir até alguém confirmar", () => {
    renderForm();

    expect(
      screen.getByText(
        "Você ainda pode corrigir até alguém confirmar o recebimento.",
      ),
    ).toBeInTheDocument();
  });

  it("trocar de turno salva o pendente e navega com turno, data e setor", async () => {
    renderForm(STATE, { sectorParam: SECTOR_ID });

    await userEvent.click(
      screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
    );
    await userEvent.selectOptions(screen.getByLabelText("Turno"), TARDE);

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(
        `/passagens/nova?turno=${TARDE}&data=2026-11-20&setor=${SECTOR_ID}`,
      ),
    );
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });

  it("trocar de turno com falha de salvamento não navega e avisa", async () => {
    mocks.save.mockResolvedValue(fail("INTERNAL", "Sem rede."));
    renderForm();

    await userEvent.click(
      screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
    );
    await userEvent.selectOptions(screen.getByLabelText("Turno"), TARDE);

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Não foi possível salvar. Tente de novo antes de trocar de turno.",
      ),
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });

  describe("passagem entregue (mode edit)", () => {
    const EDIT = {
      ...STATE,
      handoverId: "h1",
      status: "delivered" as const,
      mode: "edit" as const,
    };

    it("sem cabeçalho de troca nem botão de entregar; com link para o resumo", () => {
      renderForm(EDIT);

      expect(screen.queryByLabelText("Turno")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Entregar turno" }),
      ).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Ver resumo" })).toHaveAttribute(
        "href",
        "/passagens/h1",
      );
    });

    it("continua salvando sozinho", async () => {
      renderForm(EDIT);

      await userEvent.click(
        screen.getByRole("button", { name: "Aumentar Fita adesiva" }),
      );

      await waitFor(() =>
        expect(mocks.save).toHaveBeenCalledWith(
          expect.objectContaining({ field: "quantity", itemId: FITA_ID }),
        ),
      );
    });
  });
});
```

- [ ] **Step 30: Run test to verify it fails**

Run: `bun run test -- src/components/passagens/HandoverForm.test.tsx`
Expected: FAIL com `Error: Failed to resolve import "./HandoverForm" from "src/components/passagens/HandoverForm.test.tsx". Does the file exist?`

- [ ] **Step 31: Write minimal implementation**

`src/components/passagens/HandoverForm.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  deliverHandoverAction,
  saveHandoverFieldAction,
} from "@/app/(app)/passagens/actions";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button, buttonVariants } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import type { HandoverFormState } from "@/features/handovers/formState";
import { UNSAVED_DELIVER_MESSAGE } from "@/features/handovers/messages";
import type {
  FieldChange,
  FieldValues,
  FormMode,
  ShiftChoice,
} from "@/features/handovers/types";
import { handoverHref } from "@/features/handovers/urls";
import { AutosaveIndicator } from "./AutosaveIndicator";
import { HandoverFields } from "./HandoverFields";
import { HandoverHeader } from "./HandoverHeader";
import { useHandoverAutosave } from "./useHandoverAutosave";

function initialValues(state: HandoverFormState): FieldValues {
  const lines = [...state.controls, ...state.stock];
  return {
    occurrencesText: state.occurrencesText,
    nextShiftText: state.nextShiftText,
    quantities: Object.fromEntries(
      lines.map((line) => [line.itemId, line.quantity]),
    ),
    notes: Object.fromEntries(lines.map((line) => [line.itemId, line.note])),
  };
}

function applyChange(values: FieldValues, change: FieldChange): FieldValues {
  switch (change.field) {
    case "occurrences":
      return { ...values, occurrencesText: change.value };
    case "nextShift":
      return { ...values, nextShiftText: change.value };
    case "quantity":
      return {
        ...values,
        quantities: { ...values.quantities, [change.itemId]: change.value },
      };
    case "note":
      return {
        ...values,
        notes: { ...values.notes, [change.itemId]: change.value },
      };
  }
}

// Formulário da passagem com salvamento automático por campo. O chamador põe
// `key={`${shiftId}:${operationalDate}`}` para remontar ao trocar turno/data.
export function HandoverForm({
  state,
  shifts,
  today,
  minDate,
  sectorParam,
  canManageCatalog,
}: {
  state: HandoverFormState & { mode: FormMode };
  shifts: readonly ShiftChoice[];
  today: string;
  minDate: string;
  sectorParam: string | null;
  canManageCatalog: boolean;
}) {
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [values, setValues] = useState(() => initialValues(state));
  const [delivering, setDelivering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autosave = useHandoverAutosave({
    ref: state.ref,
    save: saveHandoverFieldAction,
    initial: state.saved,
  });
  const drafting = state.mode === "draft";

  function handleChange(change: FieldChange) {
    setValues((current) => applyChange(current, change));
    autosave.change(change);
  }

  function handleCommit(change: FieldChange) {
    setValues((current) => applyChange(current, change));
    autosave.commit(change);
  }

  // Devolve a mensagem de falha, ou null quando entregou (e já navegou).
  async function submit(): Promise<string | null> {
    // Nada pendente fica para trás: entrega só depois de salvar tudo.
    if (!(await autosave.flush())) return UNSAVED_DELIVER_MESSAGE;
    const result = await run(() => deliverHandoverAction(state.ref), {
      showError: false,
      success: "Turno entregue.",
    });
    if (!result.ok) return result.message;
    router.push(handoverHref(result.id));
    return null;
  }

  async function deliver() {
    if (delivering || pending) return;
    setError(null);
    setDelivering(true);
    const failure = await submit();
    // Com sucesso o botão fica travado até a navegação: sem segunda entrega.
    if (failure !== null) {
      setError(failure);
      setDelivering(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {drafting && (
        <HandoverHeader
          sectorId={state.ref.sectorId}
          sectorName={state.sectorName}
          shifts={shifts}
          shiftId={state.ref.shiftId}
          operationalDate={state.ref.operationalDate}
          today={today}
          minDate={minDate}
          sectorParam={sectorParam}
          beforeNavigate={autosave.flush}
        />
      )}

      <HandoverFields
        controls={state.controls}
        stock={state.stock}
        values={values}
        onChange={handleChange}
        onCommit={handleCommit}
        canManageCatalog={canManageCatalog}
        itemsHref={`/admin/itens?setor=${state.ref.sectorId}`}
      />

      <div className="flex flex-col gap-3">
        <AutosaveIndicator
          status={autosave.status}
          lastSaved={autosave.lastSaved}
          onRetry={autosave.retry}
        />
        {error && <FieldError>{error}</FieldError>}
        {drafting ? (
          <div className="flex flex-col items-start gap-2">
            <Button
              type="button"
              size="lg"
              disabled={delivering || pending}
              onClick={deliver}
            >
              {delivering || pending ? "Entregando…" : "Entregar turno"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Você ainda pode corrigir até alguém confirmar o recebimento.
            </p>
          </div>
        ) : (
          state.handoverId && (
            <Link
              href={handoverHref(state.handoverId)}
              className={`${buttonVariants({ variant: "outline" })} w-fit`}
            >
              Ver resumo
            </Link>
          )
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 32: Run test to verify it passes**

Run: `bun run test -- src/components/passagens/HandoverForm.test.tsx`
Expected: PASS (17 testes)

- [ ] **Step 33: Write the failing tests (página `/passagens/nova`, guardas)**

`src/components/passagens/NewHandover.test.tsx`:

```tsx
import type { PGlite } from "@electric-sql/pglite";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { db } from "@/db";
import { handover } from "@/db/schema/handovers";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { resetDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { NewHandover } from "./NewHandover";

const mocks = vi.hoisted(
  (): {
    requireUser: ReturnType<typeof vi.fn>;
    cookie: { value: string | undefined };
    client: PGlite | undefined;
  } => ({
    requireUser: vi.fn(),
    cookie: { value: undefined },
    client: undefined,
  }),
);

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "closery_setor" && mocks.cookie.value !== undefined
        ? { name, value: mocks.cookie.value }
        : undefined,
  }),
}));
// redirect() e notFound() ficam de verdade (lançam); só o useRouter, que
// precisa do roteador montado, é trocado.
vi.mock("next/navigation", async () => ({
  ...(await vi.importActual<typeof import("next/navigation")>(
    "next/navigation",
  )),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/app/(app)/actions", () => ({ chooseSectorAction: vi.fn() }));
vi.mock("@/app/(app)/passagens/actions", () => ({
  saveHandoverFieldAction: vi.fn(),
  deliverHandoverAction: vi.fn(),
}));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});

const TODAY = "2026-11-20";

async function renderPage(search: Record<string, string> = {}) {
  render(
    <TooltipProvider>
      {await NewHandover({ searchParams: Promise.resolve(search) })}
    </TooltipProvider>,
  );
}

async function setup() {
  const uld = await insertSector(db, "ULD");
  const manha = await insertShift(db, {
    sectorId: uld.id,
    name: "Turno Manhã",
    startsAt: "06:00",
    endsAt: "14:00",
  });
  const rede = await insertItem(db, {
    sectorId: uld.id,
    name: "Rede de proteção",
    unit: "rolo",
    kind: "control",
  });
  const fita = await insertItem(db, {
    sectorId: uld.id,
    name: "Fita adesiva",
    unit: "rolo",
    kind: "stock",
  });
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: uld.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, { role: "operator", sectorId: uld.id });
  return { uld, manha, rede, fita, ana, bia };
}

function asOperator(userId: string, sectorId: string) {
  mocks.requireUser.mockResolvedValue(
    authzOf({ role: "operator", userId, sectorId }),
  );
}

async function redirectDigest(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof Error && "digest" in error) {
      return String(error.digest);
    }
    throw error;
  }
  throw new Error("devia redirecionar");
}

describe("NewHandover", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireUser.mockReset();
    mocks.cookie.value = undefined;
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(spDate(TODAY, "10:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sem sessão, propaga o redirect do requireUser", async () => {
    const redirectError = new Error("NEXT_REDIRECT");
    mocks.requireUser.mockRejectedValue(redirectError);

    await expect(
      NewHandover({ searchParams: Promise.resolve({}) }),
    ).rejects.toBe(redirectError);
  });

  it("abre o formulário do turno sugerido, em branco de verdade: 0 e textos vazios", async () => {
    const { uld, ana } = await setup();
    asOperator(ana.id, uld.id);

    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Passagem de turno" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Registre o que aconteceu no turno. Tudo é salvo sozinho.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("ULD")).toBeInTheDocument();
    expect(screen.getByLabelText("Turno")).toHaveDisplayValue(
      "Turno Manhã (06:00–14:00)",
    );
    expect(screen.getByLabelText("Data")).toHaveValue(TODAY);
    expect(
      screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
    ).toHaveValue("0");
    expect(
      screen.getByRole("textbox", { name: "Quantidade de Fita adesiva" }),
    ).toHaveValue("0");
    expect(screen.getByLabelText("Ocorrências do turno")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Entregar turno" }),
    ).toBeInTheDocument();
  });

  it("GET nunca escreve: abrir e recarregar não criam rascunho", async () => {
    const { uld, ana } = await setup();
    asOperator(ana.id, uld.id);

    await renderPage();
    await renderPage();

    expect(await db.select().from(handover)).toEqual([]);
  });

  it("não mostra item inativo", async () => {
    const { uld, ana } = await setup();
    await insertItem(db, {
      sectorId: uld.id,
      name: "Item velho",
      active: false,
    });
    asOperator(ana.id, uld.id);

    await renderPage();

    expect(screen.queryByText("Item velho")).not.toBeInTheDocument();
  });

  it("rascunho existente volta com o que foi salvo", async () => {
    const { uld, manha, rede, ana } = await setup();
    const draft = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: manha.id,
      operationalDate: TODAY,
      occurrencesText: "Rede rasgada.",
      nextShiftText: "Conferir o box 4.",
      updatedBy: ana.id,
    });
    await insertHandoverItem(db, {
      handoverId: draft.id,
      itemId: rede.id,
      quantity: 6,
      note: "box 4",
    });
    asOperator(ana.id, uld.id);

    await renderPage();

    expect(
      screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
    ).toHaveValue("6");
    expect(screen.getByLabelText("Observação de Rede de proteção")).toHaveValue(
      "box 4",
    );
    expect(screen.getByLabelText("Ocorrências do turno")).toHaveValue(
      "Rede rasgada.",
    );
    expect(screen.getByLabelText("Fica para o próximo turno")).toHaveValue(
      "Conferir o box 4.",
    );
    expect(
      screen.getByText(/Último salvamento às .* por Ana Teste/),
    ).toBeInTheDocument();
  });

  it("turno e data da URL valem quando são válidos", async () => {
    const { uld, ana } = await setup();
    const tarde = await insertShift(db, {
      sectorId: uld.id,
      name: "Turno Tarde",
      startsAt: "14:00",
      endsAt: "22:00",
    });
    asOperator(ana.id, uld.id);

    await renderPage({ turno: tarde.id, data: "2026-11-19" });

    expect(screen.getByLabelText("Turno")).toHaveDisplayValue(
      "Turno Tarde (14:00–22:00)",
    );
    expect(screen.getByLabelText("Data")).toHaveValue("2026-11-19");
  });

  it.each([
    ["data futura", { data: "2026-11-21" }],
    ["data de 32 dias atrás", { data: "2026-10-19" }],
    ["data impossível", { data: "2026-02-30" }],
    ["só a data, sem o turno", { data: "2026-11-19" }],
  ])("%s: volta à sugestão", async (_name, extra) => {
    const { uld, manha, ana } = await setup();
    asOperator(ana.id, uld.id);

    await renderPage(extra);

    expect(screen.getByLabelText("Turno")).toHaveValue(manha.id);
    expect(screen.getByLabelText("Data")).toHaveValue(TODAY);
  });

  it("turno de outro setor na URL é ignorado (volta à sugestão)", async () => {
    const { uld, manha, ana } = await setup();
    const carga = await insertSector(db, "Carga");
    const alheio = await insertShift(db, { sectorId: carga.id });
    asOperator(ana.id, uld.id);

    await renderPage({ turno: alheio.id, data: TODAY });

    expect(screen.getByLabelText("Turno")).toHaveValue(manha.id);
  });

  it("turno inativo na URL é ignorado", async () => {
    const { uld, manha, ana } = await setup();
    const velho = await insertShift(db, { sectorId: uld.id, active: false });
    asOperator(ana.id, uld.id);

    await renderPage({ turno: velho.id, data: TODAY });

    expect(screen.getByLabelText("Turno")).toHaveValue(manha.id);
  });

  it("operador não vê o seletor de setor e ?setor= de outro setor não vale", async () => {
    const { uld, ana } = await setup();
    const carga = await insertSector(db, "Carga");
    await insertShift(db, { sectorId: carga.id, name: "Turno Carga" });
    asOperator(ana.id, uld.id);

    await renderPage({ setor: carga.id });

    expect(
      screen.queryByRole("group", { name: "Setor" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("ULD")).toBeInTheDocument();
    expect(
      screen.queryByText("Turno Carga", { exact: false }),
    ).not.toBeInTheDocument();
  });

  it.each([
    "delivered",
    "confirmed",
  ] as const)("combinação já %s: redireciona para o resumo", async (status) => {
    const { uld, manha, ana, bia } = await setup();
    const row = await insertHandover(db, {
      sectorId: uld.id,
      shiftId: manha.id,
      operationalDate: TODAY,
      status,
      deliveredBy: ana.id,
      confirmedBy: status === "confirmed" ? bia.id : undefined,
    });
    asOperator(bia.id, uld.id);

    const digest = await redirectDigest(
      NewHandover({ searchParams: Promise.resolve({}) }),
    );

    expect(digest).toContain(`/passagens/${row.id}`);
  });

  it("setor sem turnos: operador vê o pedido ao administrador", async () => {
    const uld = await insertSector(db, "ULD");
    const ana = await insertUser(db, { role: "operator", sectorId: uld.id });
    asOperator(ana.id, uld.id);

    await renderPage();

    expect(screen.getByText("Nenhum turno neste setor.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Peça a um administrador para cadastrar os turnos do setor.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Entregar turno" }),
    ).not.toBeInTheDocument();
  });

  it("operador de setor inativo vê o aviso", async () => {
    const parado = await insertSector(db, "Parado", { active: false });
    const ana = await insertUser(db, { role: "operator", sectorId: parado.id });
    asOperator(ana.id, parado.id);

    await renderPage();

    expect(screen.getByText("Seu setor está inativo.")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Entregar turno" }),
    ).not.toBeInTheDocument();
  });

  it("admin: seletor de setor e o setor vai na URL das trocas", async () => {
    const { uld } = await setup();
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderPage({ setor: uld.id });

    expect(screen.getByRole("group", { name: "Setor" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ULD" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Turno")).toHaveDisplayValue(
      "Turno Manhã (06:00–14:00)",
    );
  });

  it("admin: o cookie escolhe o setor quando a URL não diz", async () => {
    await setup();
    const carga = await insertSector(db, "Carga");
    await insertShift(db, { sectorId: carga.id, name: "Turno Carga" });
    mocks.cookie.value = carga.id;
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderPage();

    expect(screen.getByRole("button", { name: "Carga" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Turno")).toHaveDisplayValue(/Turno Carga/);
  });

  it("admin: setor sem turnos tem link para Turnos", async () => {
    const vazio = await insertSector(db, "Vazio");
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderPage({ setor: vazio.id });

    expect(
      screen.getByRole("link", { name: "Ir para Turnos" }),
    ).toHaveAttribute("href", `/admin/turnos?setor=${vazio.id}`);
  });

  it("admin sem setor ativo: estado vazio com link para Setores", async () => {
    await insertSector(db, "Parado", { active: false });
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderPage();

    expect(screen.getByText("Nenhum setor ativo.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Setores" }),
    ).toHaveAttribute("href", "/admin/setores");
  });
});
```

`src/app/appPagesAuth.test.ts` — **LER antes**; dentro do `describe("toda página do grupo (app) chama requireUser ou requireAdmin", …)`, logo antes de `it("nenhuma página de /admin exporta metadata (T12)", …)`, acrescente (as Tarefas 9 e 10 vão acrescentar as rotas delas a **esta** lista; não crie outra):

```ts
  it("inclui a página de cada rota de /passagens", () => {
    const routes = pages.map((file) =>
      relative(APP_GROUP, file).replaceAll("\\", "/"),
    );
    for (const route of ["passagens/nova/page.tsx"]) {
      expect(routes).toContain(route);
    }
  });
```

- [ ] **Step 34: Run test to verify it fails**

Run: `bun run test -- src/components/passagens/NewHandover.test.tsx src/app/appPagesAuth.test.ts`
Expected: FAIL em dois arquivos: `Error: Failed to resolve import "./NewHandover" from "src/components/passagens/NewHandover.test.tsx". Does the file exist?`; `AssertionError: expected [ 'admin/destinos/page.tsx', … ] to include 'passagens/nova/page.tsx'`.

- [ ] **Step 35: Write minimal implementation**

`src/components/passagens/NewHandover.tsx`:

```tsx
import { notFound, redirect } from "next/navigation";

import { EmptyState } from "@/components/admin/EmptyState";
import { db } from "@/db";
import { listActiveSectors } from "@/features/admin/sectors";
import { getHandoverFormState } from "@/features/handovers/formState";
import { MAX_DAYS_BACK } from "@/features/handovers/limits";
import { loadSector } from "@/features/handovers/loaders";
import { addDays, todayInSaoPaulo } from "@/features/handovers/saoPaulo";
import { resolveHandoverSector } from "@/features/handovers/sectorChoice";
import { readRememberedSector } from "@/features/handovers/sectorCookie";
import { resolveHandoverTarget } from "@/features/handovers/shiftSuggestion";
import { listActiveShifts } from "@/features/handovers/targets";
import { handoverHref } from "@/features/handovers/urls";
import { requireUser } from "@/lib/auth/session";

import { HandoverForm } from "./HandoverForm";
import { SectorPicker } from "./SectorPicker";

type NewHandoverProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function PageTitle() {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">
        Passagem de turno
      </h1>
      <p className="text-muted-foreground">
        Registre o que aconteceu no turno. Tudo é salvo sozinho.
      </p>
    </header>
  );
}

// Lê sessão, URL e cookie: só dentro de <Suspense>. GET nunca escreve: o
// rascunho nasce no primeiro salvamento.
export async function NewHandover({ searchParams }: NewHandoverProps) {
  const actor = await requireUser();
  const params = await searchParams;
  const now = new Date();
  const isAdmin = actor.role === "admin";

  let sectorId: string;
  let picker: React.ReactNode = null;

  if (isAdmin) {
    const sectors = await listActiveSectors(db);
    const selection = resolveHandoverSector(sectors, {
      url: params.setor,
      cookie: await readRememberedSector(),
    });
    if (selection.kind !== "sector") {
      return (
        <div className="flex flex-col gap-6">
          <PageTitle />
          <EmptyState
            title="Nenhum setor ativo."
            description="Cadastre ou reative um setor para usar a passagem de turno."
            action={{ label: "Ir para Setores", href: "/admin/setores" }}
          />
        </div>
      );
    }
    sectorId = selection.sector.id;
    picker = (
      <SectorPicker
        sectors={sectors}
        selectedId={selection.sector.id}
        path="/passagens/nova"
      />
    );
  } else {
    if (actor.sectorId === null) notFound();
    sectorId = actor.sectorId;
  }

  const sector = await loadSector(db, actor, sectorId);
  if (!sector) notFound();
  if (!sector.active) {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle />
        <EmptyState
          title="Seu setor está inativo."
          description="Peça a um administrador para reativá-lo."
        />
      </div>
    );
  }

  const shifts = await listActiveShifts(db, sector.id);
  const target = resolveHandoverTarget(shifts, now, {
    shiftId: params.turno,
    date: params.data,
  });
  if (!target) {
    return (
      <div className="flex flex-col gap-6">
        <PageTitle />
        {picker}
        <EmptyState
          title="Nenhum turno neste setor."
          description={
            isAdmin
              ? "Cadastre os turnos do setor para começar a passagem."
              : "Peça a um administrador para cadastrar os turnos do setor."
          }
          action={
            isAdmin
              ? {
                  label: "Ir para Turnos",
                  href: `/admin/turnos?setor=${sector.id}`,
                }
              : undefined
          }
        />
      </div>
    );
  }

  const ref = {
    sectorId: sector.id,
    shiftId: target.shiftId,
    operationalDate: target.operationalDate,
  };
  const result = await getHandoverFormState(db, actor, ref, now);
  if (!result.ok) notFound();
  const { state } = result;

  // Já entregue (ou confirmada): o lugar dela é o resumo.
  if (state.handoverId && state.status && state.status !== "draft") {
    redirect(handoverHref(state.handoverId));
  }
  if (state.mode === null) notFound();

  const today = todayInSaoPaulo(now);
  return (
    <div className="flex flex-col gap-6">
      <PageTitle />
      {picker}
      <HandoverForm
        // Remonta ao trocar turno ou data: cada combinação tem o seu rascunho.
        key={`${ref.shiftId}:${ref.operationalDate}`}
        state={{ ...state, mode: state.mode }}
        shifts={shifts}
        today={today}
        minDate={addDays(today, -MAX_DAYS_BACK)}
        sectorParam={isAdmin ? sector.id : null}
        canManageCatalog={isAdmin}
      />
    </div>
  );
}
```

`src/app/(app)/passagens/nova/page.tsx` (título estático; o guarda de páginas aceita porque `NewHandover` chama `requireUser()`):

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";

import { NewHandover } from "@/components/passagens/NewHandover";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Nova passagem" };

export default function NewHandoverPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewHandover searchParams={props.searchParams} />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
```

- [ ] **Step 36: Run test to verify it passes**

Run: `bun run test -- src/components/passagens/NewHandover.test.tsx src/app/appPagesAuth.test.ts src/app/actionsGuards.test.ts`
Expected: PASS (21 testes em `NewHandover.test.tsx`; `appPagesAuth` verde com o teste novo; `actionsGuards` verde com `MIN_APP_ACTION_FILES = 2`, já subido no Step 24b)

- [ ] **Step 37: Registrar no `ui-registry.md`**

Leia `.context/ui-registry.md` e insira, **dentro** do bloco `### Passagem de turno — …` criado na Tarefa 7, depois da entrada `### HomeHandovers` e antes de `## 3. Componentes de domínio`, exatamente:

```markdown
### QuantityCounter
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/QuantityCounter.tsx`
- **Propósito:** contagem inteira de 0 a 99.999 com −/+ e digitação (ui-rules §2.2: número nunca em branco).
- **Como funciona:** `"use client"`, controlado (`value`, `onChange`, `onCommit`). `<fieldset>` com legenda do item (só para leitor de tela); botão − (`aria-label` `Diminuir {item}`, tooltip "Diminuir", trava em 0), campo (`inputMode="numeric"`, `maxLength={5}`, `text-base tabular-nums text-center`, `aria-label` `Quantidade de {item}`, seleciona tudo ao receber foco) e botão + (`Aumentar {item}`, tooltip "Aumentar", trava no teto). Só dígitos; zeros à esquerda somem. O campo pode ficar vazio só no buffer enquanto se digita: ao sair vira 0 e chama `onChange(0)` e `onCommit(0)`. −/+ chamam `onChange` e `onCommit`. Alvos `size-9 max-md:size-11` (campo `h-9 max-md:h-11`). A unidade fica em texto ao lado.
- **Usa:** `Button` (`icon`), `Input`, `Tooltip`, `sanitizeQuantityInput`, `parseQuantity`, `stepQuantity`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 8).

### useHandoverAutosave
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/useHandoverAutosave.ts`
- **Propósito:** salvamento automático por campo da passagem (F3-3).
- **Como funciona:** `"use client"`. `change(campo)` agenda o envio com debounce de 800 ms por campo; `commit(campo)` envia já (onBlur, −/+). **Fila serial**: uma requisição em voo por vez, e o valor mais novo de cada campo vence (chave `occurrences`, `nextShift`, `quantity:{item}`, `note:{item}`). Falha (`ok: false` ou exceção) vira `status: error`, mantém o digitado e **para a fila** até `retry()`; o evento `online` também reenvia. `flush()` envia tudo e devolve `true` só se nada ficou sem salvar (o botão "Entregar turno" e a troca de turno/data dependem disso). `beforeunload` só enquanto houver algo não salvo; ao desmontar, envia o pendente sem esperar. Nunca lança. Não revalida a tela: a action de salvar não chama `revalidatePath`.
- **Usa:** `saveHandoverFieldAction` (injetada), `AUTOSAVE_DEBOUNCE_MS`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 8).

### AutosaveIndicator
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/AutosaveIndicator.tsx`
- **Propósito:** dizer, em texto, o estado do salvamento automático.
- **Como funciona:** `"use client"`. `<output aria-live="polite">` (papel `status`) com "Salvando…", "Salvo às {HH:mm}", "Último salvamento às {HH:mm} por {nome}" (estado inicial vindo do servidor), "Nada salvo ainda." ou, no erro, "Não salvo." + a mensagem + botão "Tentar de novo" (`outline`, `sm`).
- **Usa:** `Button`, `formatTimeBR`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 8).

### ItemLineField
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/ItemLineField.tsx`
- **Propósito:** uma linha de item da passagem: nome, contador e observação opcional.
- **Como funciona:** `"use client"`; renderiza um `<li>` (a lista é do `HandoverFields`). Nome em `font-medium`, `QuantityCounter` e o botão "Adicionar observação" (`aria-label` `Adicionar observação em {item}`) que revela o campo `Observação de {item}` (`maxLength` 200, `text-base`); a observação já vem aberta quando existe. Digitar chama `onNoteChange`; sair do campo chama `onNoteCommit`.
- **Usa:** `QuantityCounter`, `Button`, `Input`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 8).

### HandoverFields
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HandoverFields.tsx`
- **Propósito:** o corpo do formulário da passagem, sem estado próprio (reaproveitado pela correção com motivo).
- **Como funciona:** `"use client"`. Seções Controles ("Soma no período, como redes danificadas.") e Estoque ("Contagem de agora. Vale a última, nunca a soma."), só as que têm itens; sem nenhum item, `EmptyState` "Nenhum item neste setor." (admin: link "Ir para Itens"). Depois "Ocorrências do turno" e "Fica para o próximo turno" (`Textarea` `text-base`, `maxLength` 2.000, contador "{n} de 2.000 caracteres" só a partir de 90%; a segunda com destaque `border-warning-foreground/40 bg-warning/30` e ícone). Valores e eventos (`onChange`, `onCommit`) vêm do pai.
- **Usa:** `ItemLineField`, `EmptyState`, `Field*`, `Textarea`, tokens `warning`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 8).

### HandoverHeader
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HandoverHeader.tsx`
- **Propósito:** setor, turno e data do formulário (D-F3-2).
- **Como funciona:** `"use client"`. Setor em texto; `SelectField` "Turno" (`{nome} ({início}–{fim})`) e `<input type="date">` "Data" (`min` = hoje − 31 dias, `max` = hoje; valor vazio ou fora da janela é ignorado). Trocar turno ou data chama `beforeNavigate` (o `flush` do salvamento) e só então `router.push` para `/passagens/nova?turno=&data=` (+ `&setor=` do admin); a troca de turno mantém a data e vice-versa. Se não deu para salvar, toast "Não foi possível salvar. Tente de novo antes de trocar de turno." e não navega. Campos desabilitados enquanto salva ou navega.
- **Usa:** `SelectField`, `Field*`, `Input`, `newHandoverHref`, `sonner`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 8).

### HandoverForm
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HandoverForm.tsx`
- **Propósito:** formulário da passagem com salvamento automático e "Entregar turno".
- **Como funciona:** `"use client"`; o chamador põe `key={turno:data}` para remontar ao trocar. Estado controlado dos valores (nunca em branco: `0` e textos vazios), `useHandoverAutosave`, `HandoverHeader` (modo `draft`), `HandoverFields` e `AutosaveIndicator`. **Entregar turno** faz `flush()` antes; se algo ficou sem salvar, mostra "Há alterações sem salvar. Toque em “Tentar de novo” e entregue de novo." e não entrega; com sucesso, toast "Turno entregue." e navega para o resumo (o botão fica travado até a navegação); `ALREADY_DELIVERED` e outras falhas aparecem no próprio formulário, sem perder o digitado. Sem diálogo de confirmação. No modo `edit` (passagem entregue) não há cabeçalho nem botão, só o link "Ver resumo".
- **Usa:** `useHandoverAutosave`, `useAdminAction`, `saveHandoverFieldAction`, `deliverHandoverAction`, `HandoverHeader`, `HandoverFields`, `AutosaveIndicator`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 8).

### NewHandover
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/NewHandover.tsx`
- **Propósito:** a página `/passagens/nova`.
- **Como funciona:** Server Component assíncrono, dentro de `<Suspense>`. `requireUser()`; operador usa o próprio setor, admin escolhe (`resolveHandoverSector` + `SectorPicker`). Turno e data vêm de `resolveHandoverTarget` (URL válida ou sugestão pelo horário). **GET nunca escreve**: o rascunho nasce no primeiro salvamento. Combinação já entregue ou confirmada redireciona para o resumo. Estados vazios: sem setor ativo, setor inativo, sem turnos (admin: link "Ir para Turnos").
- **Usa:** `getHandoverFormState`, `listActiveShifts`, `resolveHandoverTarget`, `HandoverForm`, `SectorPicker`, `EmptyState`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 8).

```

- [ ] **Step 38: Verificar tudo**

Run: `bun run check-types && bun run lint && bun run test`
Expected: tudo verde. O `bun run build` também passa (`/passagens/nova` aparece como `◐` Partial Prerender: a leitura de sessão, URL e cookie está dentro do `<Suspense>`). Se o Biome reclamar de formatação, rode `bunx biome check --write src test`.

- [ ] **Step 39: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-8.txt` (texto exato abaixo) e rode:

```bash
git add src/components/passagens/QuantityCounter.tsx src/components/passagens/QuantityCounter.test.tsx src/components/passagens/useHandoverAutosave.ts src/components/passagens/useHandoverAutosave.test.tsx src/components/passagens/AutosaveIndicator.tsx src/components/passagens/AutosaveIndicator.test.tsx src/components/passagens/ItemLineField.tsx src/components/passagens/ItemLineField.test.tsx src/components/passagens/HandoverFields.tsx src/components/passagens/HandoverFields.test.tsx src/components/passagens/HandoverHeader.tsx src/components/passagens/HandoverHeader.test.tsx src/components/passagens/HandoverForm.tsx src/components/passagens/HandoverForm.test.tsx src/components/passagens/NewHandover.tsx src/components/passagens/NewHandover.test.tsx "src/app/(app)/passagens/actions.ts" "src/app/(app)/passagens/actions.test.ts" "src/app/(app)/passagens/nova/page.tsx" src/app/appPagesAuth.test.ts src/app/actionsGuards.test.ts .context/ui-registry.md
git commit -F .git/sdd/msg-task-8.txt
```

Mensagem:
```text
feat(passagens): formulário da passagem com salvamento automático e entrega

Contador −/+ (0 a 99.999), salvamento por campo com fila serial e
debounce de 800 ms, indicador de estado, cabeçalho que troca turno e data,
"Entregar turno" que salva tudo antes e a página /passagens/nova (GET nunca
escreve; combinação já entregue vai para o resumo).

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 9: Resumo `/passagens/[id]` e Confirmar recebimento

**Files:**
- Create: `src/components/passagens/SummaryItemList.tsx`
- Create: `src/components/passagens/CorrectionsTimeline.tsx`
- Create: `src/components/passagens/ConfirmReceiptForm.tsx`
- Create: `src/components/passagens/HandoverDetail.tsx`
- Create: `src/app/(app)/passagens/[id]/page.tsx`
- Modify: `src/app/(app)/passagens/actions.ts` (criado pela Tarefa 8; acrescenta `confirmHandoverAction` e dois imports; LER antes)
- Modify: `src/app/appPagesAuth.test.ts` (acrescenta a rota `passagens/[id]/page.tsx` à lista de rotas esperadas; LER antes)
- Modify: `.context/ui-registry.md` (quatro componentes novos, imediatamente antes de `## 3. Componentes de domínio`)
- Test: `src/components/passagens/SummaryItemList.test.tsx`
- Test: `src/components/passagens/CorrectionsTimeline.test.tsx`
- Test: `src/components/passagens/ConfirmReceiptForm.test.tsx`
- Test: `src/components/passagens/HandoverDetail.test.tsx`
- Test: `src/app/(app)/passagens/confirmAction.test.ts`

**Interfaces:**
- Consumes (pelo contrato; Tarefas 1 a 8):
  - `requireUser(): Promise<Authz>` de `@/lib/auth/session`; `db` de `@/db`.
  - `getHandoverSummary(db: Db, actor: Authz, id: string): Promise<AdminResult<{ summary: HandoverSummary }>>` e os tipos `HandoverSummary`, `SummaryItem`, `SummaryCorrection` de `@/features/handovers/summary` (Tarefa 5). `summary.capabilities` é `HandoverCapabilities` (`access.ts`, Tarefa 2).
  - `confirmHandover(db: Db, actor: Authz, input: { id: string; note: string | null }, now: Date): Promise<AdminResult<Confirmed>>` e `Confirmed` de `@/features/handovers/confirm` (Tarefa 5).
  - `runHandoverAction({ actor, schema, input, revalidate, run })` de `@/features/handovers/runHandoverAction` e `confirmHandoverSchema` de `@/features/handovers/schemas` (Tarefa 3).
  - `HandoverStatusBadge(props: { situation: HistorySituation; confirmedByName?: string | null; corrected?: boolean })` de `@/components/passagens/HandoverStatusBadge` (Tarefa 7, a mesma do histórico).
  - `formatDateBR`, `formatTimeBR`, `saoPauloParts` de `saoPaulo.ts`; `formatQuantity` de `quantity.ts`; `correctionFieldLabel`, `displayCorrectionValue` de `diff.ts`; `handoverHref`, `newHandoverHref` de `urls.ts`; `CONFIRMATION_NOTE_MAX_LENGTH` de `limits.ts` (Tarefa 2).
  - `useAdminAction` de `@/components/admin/useAdminAction`; `firstFieldErrors`, `idSchema` de `@/features/admin/schemas`; `FieldErrors` de `@/features/admin/result`; `formatDateTimeBR` de `@/lib/dateTime`.
  - Ajudantes de teste: `createTestDb`/`resetDb` (`test/db.ts`), `insertSector`, `insertShift`, `insertItem`, `insertUser`, `insertHandover`, `insertHandoverItem`, `insertHandoverCorrection` (`test/fixtures.ts`), `spDate` (`test/clock.ts`), `authzOf` (`test/authz.ts`).
- Produces (Tarefa 11 e a 12 usam):
  - `confirmHandoverAction(input: unknown): Promise<AdminResult<Confirmed>>` em `src/app/(app)/passagens/actions.ts`.
  - `SummaryItemList(props: { title: string; items: readonly SummaryItem[] })` (server-safe), `CorrectionsTimeline(props: { corrections: readonly SummaryCorrection[] })` (server-safe), `ConfirmReceiptForm(props: { id: string })` (client).
  - `HandoverDetail(props: { id: string; searchParams: Promise<Record<string, string | string[] | undefined>> })` (server, async). Nesta tarefa ele ignora `searchParams`; a Tarefa 11 passa a lê-lo para `?editar=1`.
  - A rota `/passagens/[id]` (a página já repassa `searchParams`, então a Tarefa 11 não mexe nela).

- [ ] **Step 1: Ler o que já existe**

Leia `src/app/(app)/passagens/actions.ts` (criado pela Tarefa 8: tem `saveHandoverFieldAction` e `deliverHandoverAction`), `src/app/appPagesAuth.test.ts` e confirme que `src/components/passagens/HandoverStatusBadge.tsx` existe (Tarefa 7).

Run: `ls src/components/passagens/HandoverStatusBadge.tsx "src/app/(app)/passagens/actions.ts"`
Expected: os dois caminhos são listados.

- [ ] **Step 2: Write the failing test (SummaryItemList)**

Crie `src/components/passagens/SummaryItemList.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SummaryItem } from "@/features/handovers/summary";
import { SummaryItemList } from "./SummaryItemList";

function line(overrides: Partial<SummaryItem> = {}): SummaryItem {
  return {
    itemId: "item-1",
    name: "Rede de proteção",
    unit: "unidade",
    kind: "control",
    quantity: 3,
    note: null,
    ...overrides,
  };
}

describe("SummaryItemList", () => {
  it("lista título, nome e quantidade com a unidade", () => {
    render(<SummaryItemList title="Controles" items={[line()]} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Controles" }),
    ).toBeInTheDocument();
    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Rede de proteção")).toBeInTheDocument();
    expect(within(row).getByText("3 unidade")).toBeInTheDocument();
  });

  it("formata milhar em pt-BR e alinha o número com tabular-nums", () => {
    render(
      <SummaryItemList
        title="Estoque"
        items={[line({ quantity: 1234, unit: "rolo" })]}
      />,
    );

    const value = screen.getByText("1.234 rolo");
    expect(value).toHaveClass("tabular-nums");
  });

  it("mostra a observação abaixo do item", () => {
    render(
      <SummaryItemList
        title="Controles"
        items={[line({ quantity: 0, note: "Faltou fita" })]}
      />,
    );

    expect(screen.getByText("Faltou fita")).toBeInTheDocument();
    expect(screen.getByText("0 unidade")).toBeInTheDocument();
  });

  it("não escreve nada quando não há itens", () => {
    const { container } = render(
      <SummaryItemList title="Controles" items={[]} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("mantém a ordem recebida", () => {
    render(
      <SummaryItemList
        title="Controles"
        items={[
          line({ itemId: "a", name: "Primeiro" }),
          line({ itemId: "b", name: "Segundo" }),
        ]}
      />,
    );

    const names = screen
      .getAllByRole("listitem")
      .map(
        (row) => within(row).getAllByText(/Primeiro|Segundo/)[0]?.textContent,
      );
    expect(names).toEqual(["Primeiro", "Segundo"]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test -- src/components/passagens/SummaryItemList.test.tsx`
Expected: FAIL com `Failed to resolve import "./SummaryItemList" from "src/components/passagens/SummaryItemList.test.tsx". Does the file exist?`

- [ ] **Step 4: Write minimal implementation (SummaryItemList)**

Crie `src/components/passagens/SummaryItemList.tsx`:

```tsx
import { useId } from "react";

import { formatQuantity } from "@/features/handovers/quantity";
import type { SummaryItem } from "@/features/handovers/summary";

export function SummaryItemList({
  title,
  items,
}: {
  title: string;
  items: readonly SummaryItem[];
}) {
  const headingId = useId();
  if (items.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h2 id={headingId} className="text-lg font-semibold">
        {title}
      </h2>
      <ul className="flex flex-col divide-y rounded-lg border">
        {items.map((line) => (
          <li key={line.itemId} className="flex flex-col gap-1 px-4 py-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium">{line.name}</span>
              <span className="shrink-0 text-right tabular-nums">
                {`${formatQuantity(line.quantity)} ${line.unit}`}
              </span>
            </div>
            {line.note && (
              <p className="text-sm text-muted-foreground">{line.note}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test -- src/components/passagens/SummaryItemList.test.tsx`
Expected: PASS (5 testes)

- [ ] **Step 6: Write the failing test (CorrectionsTimeline)**

Crie `src/components/passagens/CorrectionsTimeline.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SummaryCorrection } from "@/features/handovers/summary";
import { spDate } from "../../../test/clock";
import { CorrectionsTimeline } from "./CorrectionsTimeline";

function correction(
  overrides: Partial<SummaryCorrection> = {},
): SummaryCorrection {
  return {
    id: "c-1",
    field: "item_quantity",
    itemName: "Rede de proteção",
    oldValue: "3",
    newValue: "5",
    reason: "Contagem errada",
    correctedByName: "Ana Teste",
    correctedAt: spDate("2026-11-21", "09:30"),
    ...overrides,
  };
}

describe("CorrectionsTimeline", () => {
  it("mostra campo, antigo → novo, motivo, quem e quando", () => {
    render(<CorrectionsTimeline corrections={[correction()]} />);

    const row = screen.getByRole("listitem");
    expect(
      within(row).getByText("Rede de proteção: quantidade"),
    ).toBeInTheDocument();
    expect(within(row).getByText("3 → 5")).toBeInTheDocument();
    expect(
      within(row).getByText("Motivo: Contagem errada"),
    ).toBeInTheDocument();
    expect(
      within(row).getByText("Ana Teste · 21/11/2026, 09:30"),
    ).toBeInTheDocument();
  });

  it("valor vazio aparece como (vazio)", () => {
    render(
      <CorrectionsTimeline
        corrections={[
          correction({
            field: "occurrences_text",
            itemName: null,
            oldValue: "",
            newValue: "Chuva forte",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Ocorrências do turno")).toBeInTheDocument();
    expect(screen.getByText("(vazio) → Chuva forte")).toBeInTheDocument();
  });

  it("usa o rótulo do texto do próximo turno e o da observação do item", () => {
    render(
      <CorrectionsTimeline
        corrections={[
          correction({
            id: "c-2",
            field: "next_shift_text",
            itemName: null,
            oldValue: "a",
            newValue: "b",
          }),
          correction({
            id: "c-3",
            field: "item_note",
            oldValue: "",
            newValue: "ok",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Fica para o próximo turno")).toBeInTheDocument();
    expect(
      screen.getByText("Rede de proteção: observação"),
    ).toBeInTheDocument();
  });

  it("é uma lista ordenada e mantém a ordem recebida", () => {
    render(
      <CorrectionsTimeline
        corrections={[
          correction({ id: "c-1", reason: "Primeira" }),
          correction({ id: "c-2", reason: "Segunda" }),
        ]}
      />,
    );

    const reasons = screen
      .getAllByRole("listitem")
      .map((row) => within(row).getByText(/^Motivo: /).textContent);
    expect(reasons).toEqual(["Motivo: Primeira", "Motivo: Segunda"]);
    expect(screen.getByRole("list").tagName).toBe("OL");
  });

  it("não escreve nada sem correções", () => {
    const { container } = render(<CorrectionsTimeline corrections={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `bun run test -- src/components/passagens/CorrectionsTimeline.test.tsx`
Expected: FAIL com `Failed to resolve import "./CorrectionsTimeline" from "src/components/passagens/CorrectionsTimeline.test.tsx". Does the file exist?`

- [ ] **Step 8: Write minimal implementation (CorrectionsTimeline)**

Crie `src/components/passagens/CorrectionsTimeline.tsx`:

```tsx
import {
  correctionFieldLabel,
  displayCorrectionValue,
} from "@/features/handovers/diff";
import type { SummaryCorrection } from "@/features/handovers/summary";
import { formatDateTimeBR } from "@/lib/dateTime";

// Linha do tempo (dado ordenado no tempo não é tabela): uma entrada por campo.
export function CorrectionsTimeline({
  corrections,
}: {
  corrections: readonly SummaryCorrection[];
}) {
  if (corrections.length === 0) return null;

  return (
    <ol className="flex flex-col gap-4 border-l pl-4">
      {corrections.map((correction) => (
        <li key={correction.id} className="flex flex-col gap-1">
          <span className="font-medium">
            {correctionFieldLabel(correction.field, correction.itemName)}
          </span>
          <span className="whitespace-pre-wrap">
            {`${displayCorrectionValue(correction.oldValue)} → ${displayCorrectionValue(correction.newValue)}`}
          </span>
          <span className="text-sm text-muted-foreground">
            {`Motivo: ${correction.reason}`}
          </span>
          <span className="text-sm text-muted-foreground">
            {`${correction.correctedByName} · ${formatDateTimeBR(correction.correctedAt)}`}
          </span>
        </li>
      ))}
    </ol>
  );
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `bun run test -- src/components/passagens/CorrectionsTimeline.test.tsx`
Expected: PASS (5 testes)

- [ ] **Step 10: Write the failing test (confirmHandoverAction)**

Crie `src/app/(app)/passagens/confirmAction.test.ts` (projeto `node`, PGlite real; o teste fica num arquivo próprio para não depender da estrutura do `actions.test.ts` da Tarefa 8):

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { db } from "@/db";
import { handover } from "@/db/schema/handovers";
import { authzOf } from "../../../../test/authz";
import { resetDb } from "../../../../test/db";
import {
  insertHandover,
  insertSector,
  insertShift,
  insertUser,
} from "../../../../test/fixtures";
import { confirmHandoverAction } from "./actions";

const mocks = vi.hoisted(
  (): {
    requireUser: Mock;
    revalidatePath: Mock;
    client: PGlite | undefined;
  } => ({
    requireUser: vi.fn(),
    revalidatePath: vi.fn(),
    client: undefined,
  }),
);

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});

const REDIRECT = new Error("NEXT_REDIRECT;/entrar");

// Setor com turno, quem entregou (Ana) e quem pode receber (Bia), mais uma
// passagem entregue.
async function seedDelivered() {
  const sector = await insertSector(db, "ULD");
  const shift = await insertShift(db, { sectorId: sector.id, name: "Manhã" });
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Bia Teste",
  });
  const created = await insertHandover(db, {
    sectorId: sector.id,
    shiftId: shift.id,
    status: "delivered",
    deliveredBy: ana.id,
  });
  const asUser = (userId: string, name: string) =>
    authzOf({ role: "operator", userId, sectorId: sector.id, name });
  return { sector, shift, ana, bia, id: created.id, asUser };
}

async function statusOf(id: string) {
  const [row] = await db.select().from(handover).where(eq(handover.id, id));
  return row;
}

describe("confirmHandoverAction", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireUser.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("sem sessão: requireUser redireciona e nada muda", async () => {
    const { id } = await seedDelivered();
    mocks.requireUser.mockRejectedValue(REDIRECT);

    await expect(confirmHandoverAction({ id, note: "" })).rejects.toBe(
      REDIRECT,
    );

    expect((await statusOf(id))?.status).toBe("delivered");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("outra pessoa do setor confirma, grava quem e quando e revalida", async () => {
    const { id, bia, asUser } = await seedDelivered();
    mocks.requireUser.mockResolvedValue(asUser(bia.id, "Bia Teste"));

    const result = await confirmHandoverAction({ id, note: "  Recebi tudo " });

    expect(result).toMatchObject({ ok: true });
    const row = await statusOf(id);
    expect(row).toMatchObject({
      status: "confirmed",
      confirmedBy: bia.id,
      confirmationNote: "Recebi tudo",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)", "layout");
  });

  it("observação só com espaços vira nula", async () => {
    const { id, bia, asUser } = await seedDelivered();
    mocks.requireUser.mockResolvedValue(asUser(bia.id, "Bia Teste"));

    await confirmHandoverAction({ id, note: "   " });

    expect((await statusOf(id))?.confirmationNote).toBeNull();
  });

  it("quem entregou não confirma (OWN_HANDOVER) e não revalida", async () => {
    const { id, ana, asUser } = await seedDelivered();
    mocks.requireUser.mockResolvedValue(asUser(ana.id, "Ana Teste"));

    const result = await confirmHandoverAction({ id, note: "" });

    expect(result).toMatchObject({ ok: false, code: "OWN_HANDOVER" });
    expect((await statusOf(id))?.status).toBe("delivered");
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("a segunda confirmação recebe ALREADY_CONFIRMED com nome e hora", async () => {
    const { id, bia, asUser } = await seedDelivered();
    mocks.requireUser.mockResolvedValue(asUser(bia.id, "Bia Teste"));
    await confirmHandoverAction({ id, note: "" });

    const second = await confirmHandoverAction({ id, note: "" });

    expect(second).toMatchObject({
      ok: false,
      code: "ALREADY_CONFIRMED",
      message: expect.stringMatching(
        /^Esta passagem já foi confirmada por Bia Teste às \d{2}:\d{2}\.$/,
      ),
    });
  });

  it("operador de outro setor recebe NOT_FOUND e nada muda", async () => {
    const { id } = await seedDelivered();
    const other = await insertSector(db, "Outro");
    const stranger = await insertUser(db, {
      role: "operator",
      sectorId: other.id,
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", userId: stranger.id, sectorId: other.id }),
    );

    const result = await confirmHandoverAction({ id, note: "" });

    expect(result).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
      message: "Passagem não encontrada. Atualize a página.",
    });
    expect((await statusOf(id))?.status).toBe("delivered");
  });

  it("admin confirma a passagem de qualquer setor", async () => {
    const { id } = await seedDelivered();
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "admin", userId: admin.id }),
    );

    const result = await confirmHandoverAction({ id, note: "" });

    expect(result).toMatchObject({ ok: true });
    expect((await statusOf(id))?.confirmedBy).toBe(admin.id);
  });

  it("rascunho não se confirma (NOT_DELIVERED)", async () => {
    const { sector, shift, bia, asUser } = await seedDelivered();
    const draft = await insertHandover(db, {
      sectorId: sector.id,
      shiftId: shift.id,
      operationalDate: "2026-11-19",
    });
    mocks.requireUser.mockResolvedValue(asUser(bia.id, "Bia Teste"));

    const result = await confirmHandoverAction({ id: draft.id, note: "" });

    expect(result).toMatchObject({ ok: false, code: "NOT_DELIVERED" });
  });

  it.each([
    ["id que não é uuid", { id: "abc", note: "" }],
    ["sem a observação", { id: "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b" }],
    [
      "observação que não é texto",
      {
        id: "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b",
        note: 5,
      },
    ],
  ])("entrada inválida (%s): INVALID_INPUT sem tocar o banco", async (_name, input) => {
    const { bia, asUser } = await seedDelivered();
    mocks.requireUser.mockResolvedValue(asUser(bia.id, "Bia Teste"));

    const result = await confirmHandoverAction(input);

    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("observação com 501 caracteres: erro no campo note; com 500 passa", async () => {
    const { id, bia, asUser } = await seedDelivered();
    mocks.requireUser.mockResolvedValue(asUser(bia.id, "Bia Teste"));

    const tooLong = await confirmHandoverAction({ id, note: "a".repeat(501) });
    expect(tooLong).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { note: "A observação pode ter no máximo 500 caracteres." },
    });
    expect((await statusOf(id))?.status).toBe("delivered");

    const exact = await confirmHandoverAction({ id, note: "a".repeat(500) });
    expect(exact).toMatchObject({ ok: true });
  });
});
```

- [ ] **Step 11: Run test to verify it fails**

Run: `bun run test -- "src/app/(app)/passagens/confirmAction.test.ts"`
Expected: FAIL (12 testes) com `TypeError: confirmHandoverAction is not a function`

- [ ] **Step 12: Write minimal implementation (confirmHandoverAction)**

Em `src/app/(app)/passagens/actions.ts` acrescente estes imports (o Biome reordena; se `@/features/handovers/schemas` já é importado, só acrescente `confirmHandoverSchema` ao bloco existente):

```ts
import { type Confirmed, confirmHandover } from "@/features/handovers/confirm";
import { confirmHandoverSchema } from "@/features/handovers/schemas";
```

e acrescente ao **fim** do arquivo (depois de `deliverHandoverAction`):

```ts
export async function confirmHandoverAction(
  input: unknown,
): Promise<AdminResult<Confirmed>> {
  const actor = await requireUser();
  return runHandoverAction({
    actor,
    schema: confirmHandoverSchema,
    input,
    revalidate: true,
    run: ({ db, now, actor, input }) => confirmHandover(db, actor, input, now),
  });
}
```

Depois rode `bunx biome check --write "src/app/(app)/passagens/actions.ts"`.

- [ ] **Step 13: Run test to verify it passes**

Run: `bun run test -- "src/app/(app)/passagens/confirmAction.test.ts"`
Expected: PASS (12 testes)

- [ ] **Step 14: Write the failing test (ConfirmReceiptForm)**

Crie `src/components/passagens/ConfirmReceiptForm.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail, ok } from "@/features/admin/result";
import { ConfirmReceiptForm } from "./ConfirmReceiptForm";

const HANDOVER_ID = "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b";

const mocks = vi.hoisted(() => ({
  confirmHandoverAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/passagens/actions", () => ({
  confirmHandoverAction: mocks.confirmHandoverAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const noteField = () =>
  screen.getByRole("textbox", { name: "Observação do recebimento (opcional)" });
const submit = () =>
  screen.getByRole("button", {
    name: /^Confirmar recebimento$|^Confirmando…$/,
  });

describe("ConfirmReceiptForm", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("começa com a observação vazia e o botão com o nome do resultado", () => {
    render(<ConfirmReceiptForm id={HANDOVER_ID} />);

    expect(noteField()).toHaveValue("");
    expect(submit()).toHaveTextContent("Confirmar recebimento");
    expect(submit()).toBeEnabled();
  });

  it("confirma sem observação: manda texto vazio e mostra o toast", async () => {
    mocks.confirmHandoverAction.mockResolvedValue(
      ok({ confirmedAt: new Date() }),
    );
    const user = userEvent.setup();
    render(<ConfirmReceiptForm id={HANDOVER_ID} />);

    await user.click(submit());

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith(
        "Recebimento confirmado.",
      ),
    );
    expect(mocks.confirmHandoverAction).toHaveBeenCalledWith({
      id: HANDOVER_ID,
      note: "",
    });
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("manda a observação digitada", async () => {
    mocks.confirmHandoverAction.mockResolvedValue(
      ok({ confirmedAt: new Date() }),
    );
    const user = userEvent.setup();
    render(<ConfirmReceiptForm id={HANDOVER_ID} />);

    await user.type(noteField(), "Recebi as redes");
    await user.click(submit());

    await waitFor(() =>
      expect(mocks.confirmHandoverAction).toHaveBeenCalledWith({
        id: HANDOVER_ID,
        note: "Recebi as redes",
      }),
    );
  });

  it("enquanto confirma: botão 'Confirmando…' desabilitado e um clique só", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.confirmHandoverAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<ConfirmReceiptForm id={HANDOVER_ID} />);

    await user.click(submit());

    await waitFor(() => expect(submit()).toHaveTextContent("Confirmando…"));
    expect(submit()).toBeDisabled();
    await user.click(submit());
    expect(mocks.confirmHandoverAction).toHaveBeenCalledTimes(1);

    finish(ok({ confirmedAt: new Date() }));
    await waitFor(() => expect(mocks.toastSuccess).toHaveBeenCalled());
  });

  it("falha de domínio: erro inline, sem toast, e a observação digitada fica", async () => {
    mocks.confirmHandoverAction.mockResolvedValue(
      fail(
        "OWN_HANDOVER",
        "Quem entregou o turno não pode confirmar o recebimento. Peça a outra pessoa do setor.",
      ),
    );
    const user = userEvent.setup();
    render(<ConfirmReceiptForm id={HANDOVER_ID} />);

    await user.type(noteField(), "Tudo certo");
    await user.click(submit());

    expect(
      await screen.findByText(
        "Quem entregou o turno não pode confirmar o recebimento. Peça a outra pessoa do setor.",
      ),
    ).toBeInTheDocument();
    expect(noteField()).toHaveValue("Tudo certo");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(submit()).toBeEnabled();
  });

  it("erro no campo da observação aparece no campo e marca como inválido", async () => {
    mocks.confirmHandoverAction.mockResolvedValue(
      fail("INVALID_INPUT", "A observação pode ter no máximo 500 caracteres.", {
        note: "A observação pode ter no máximo 500 caracteres.",
      }),
    );
    const user = userEvent.setup();
    render(<ConfirmReceiptForm id={HANDOVER_ID} />);

    await user.click(submit());

    expect(
      await screen.findByText(
        "A observação pode ter no máximo 500 caracteres.",
      ),
    ).toBeInTheDocument();
    expect(noteField()).toHaveAttribute("aria-invalid", "true");
  });

  it("exceção da action (rede) vira a mensagem genérica inline", async () => {
    mocks.confirmHandoverAction.mockRejectedValue(new Error("rede caiu"));
    const user = userEvent.setup();
    render(<ConfirmReceiptForm id={HANDOVER_ID} />);

    await user.click(submit());

    expect(
      await screen.findByText("Não foi possível concluir. Tente de novo."),
    ).toBeInTheDocument();
    expect(screen.queryByText("rede caiu")).not.toBeInTheDocument();
  });

  it("depois de um erro, um novo envio limpa o erro anterior", async () => {
    mocks.confirmHandoverAction
      .mockResolvedValueOnce(
        fail("INTERNAL", "Não foi possível concluir. Tente de novo."),
      )
      .mockResolvedValueOnce(ok({ confirmedAt: new Date() }));
    const user = userEvent.setup();
    render(<ConfirmReceiptForm id={HANDOVER_ID} />);

    await user.click(submit());
    await screen.findByText("Não foi possível concluir. Tente de novo.");
    await user.click(submit());

    await waitFor(() =>
      expect(
        screen.queryByText("Não foi possível concluir. Tente de novo."),
      ).not.toBeInTheDocument(),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Recebimento confirmado.");
  });
});
```

- [ ] **Step 15: Run test to verify it fails**

Run: `bun run test -- src/components/passagens/ConfirmReceiptForm.test.tsx`
Expected: FAIL com `Failed to resolve import "./ConfirmReceiptForm" from "src/components/passagens/ConfirmReceiptForm.test.tsx". Does the file exist?`

- [ ] **Step 16: Write minimal implementation (ConfirmReceiptForm)**

Crie `src/components/passagens/ConfirmReceiptForm.tsx`:

```tsx
"use client";

import { type FormEvent, useId, useState } from "react";

import { confirmHandoverAction } from "@/app/(app)/passagens/actions";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { FieldErrors } from "@/features/admin/result";
import { firstFieldErrors } from "@/features/admin/schemas";
import { CONFIRMATION_NOTE_MAX_LENGTH } from "@/features/handovers/limits";
import { confirmHandoverSchema } from "@/features/handovers/schemas";

// Observação opcional; o servidor normaliza e a confirmação revalida a página
// sozinha (a action chama revalidatePath), então nada de router.refresh aqui.
export function ConfirmReceiptForm({ id }: { id: string }) {
  const uid = useId();
  const { pending, run } = useAdminAction();
  const [note, setNote] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFieldErrors({});
    setFormError(null);

    const parsed = confirmHandoverSchema.safeParse({ id, note });
    if (!parsed.success) {
      setFieldErrors(firstFieldErrors(parsed.error));
      return;
    }

    const result = await run(() => confirmHandoverAction({ id, note }), {
      showError: false,
      success: "Recebimento confirmado.",
    });
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.fieldErrors?.note ? null : result.message);
    }
  }

  const noteError = fieldErrors.note;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={noteError ? true : undefined}>
          <FieldLabel htmlFor={`${uid}-note`}>
            Observação do recebimento (opcional)
          </FieldLabel>
          <Textarea
            id={`${uid}-note`}
            maxLength={CONFIRMATION_NOTE_MAX_LENGTH}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            aria-invalid={noteError ? true : undefined}
            aria-describedby={noteError ? `${uid}-note-error` : undefined}
          />
          {noteError && (
            <FieldError id={`${uid}-note-error`}>{noteError}</FieldError>
          )}
        </Field>

        {formError && <FieldError>{formError}</FieldError>}

        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Confirmando…" : "Confirmar recebimento"}
        </Button>
      </FieldGroup>
    </form>
  );
}
```

- [ ] **Step 17: Run test to verify it passes**

Run: `bun run test -- src/components/passagens/ConfirmReceiptForm.test.tsx`
Expected: PASS (8 testes)

- [ ] **Step 18: Write the failing test (HandoverDetail)**

Crie `src/components/passagens/HandoverDetail.test.tsx` (projeto `dom`; o componente é servidor assíncrono, então o teste faz `render(await HandoverDetail(...))` com a sessão mockada e PGlite real, como o `ItemsAdmin.test.tsx` da Fase 2):

```tsx
import type { PGlite } from "@electric-sql/pglite";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { db } from "@/db";
import type { Authz } from "@/features/authz/authz";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { resetDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverCorrection,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { HandoverDetail } from "./HandoverDetail";

const NOT_FOUND = new Error("NEXT_HTTP_ERROR_FALLBACK;404");

const mocks = vi.hoisted(
  (): {
    requireUser: Mock;
    notFound: Mock;
    redirect: Mock;
    client: PGlite | undefined;
  } => ({
    requireUser: vi.fn(),
    notFound: vi.fn(),
    redirect: vi.fn(),
    client: undefined,
  }),
);

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/navigation", () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});
vi.mock("@/app/(app)/passagens/actions", () => ({
  confirmHandoverAction: vi.fn(),
  saveHandoverFieldAction: vi.fn(),
  deliverHandoverAction: vi.fn(),
  correctHandoverAction: vi.fn(),
}));

type World = Awaited<ReturnType<typeof seed>>;

// Setor ULD com turno Manhã, três itens, Ana (entregou) e Bia (colega).
async function seed() {
  const sector = await insertSector(db, "ULD");
  const shift = await insertShift(db, {
    sectorId: sector.id,
    name: "Manhã",
    startsAt: "06:00",
    endsAt: "14:00",
  });
  const nets = await insertItem(db, {
    sectorId: sector.id,
    name: "Rede de proteção",
    unit: "unidade",
    kind: "control",
  });
  const tape = await insertItem(db, {
    sectorId: sector.id,
    name: "Fita adesiva",
    unit: "rolo",
    kind: "stock",
  });
  const cones = await insertItem(db, {
    sectorId: sector.id,
    name: "Cone",
    unit: "unidade",
    kind: "stock",
  });
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Bia Teste",
  });
  const admin = await insertUser(db, {
    role: "admin",
    sectorId: null,
    name: "Admin Teste",
  });
  const actor = (who: { id: string }, name: string): Authz =>
    authzOf({ role: "operator", userId: who.id, sectorId: sector.id, name });
  return {
    sector,
    shift,
    nets,
    tape,
    cones,
    ana,
    bia,
    admin,
    asAna: actor(ana, "Ana Teste"),
    asBia: actor(bia, "Bia Teste"),
    asAdmin: authzOf({ role: "admin", userId: admin.id, name: "Admin Teste" }),
  };
}

async function deliveredHandover(world: World) {
  const created = await insertHandover(db, {
    sectorId: world.sector.id,
    shiftId: world.shift.id,
    status: "delivered",
    deliveredBy: world.ana.id,
    deliveredAt: spDate("2026-11-20", "14:05"),
    occurrencesText: "Chuva forte no pátio.",
    nextShiftText: "Conferir as redes do galpão 2.",
    shiftNameSnapshot: "Manhã",
  });
  await insertHandoverItem(db, {
    handoverId: created.id,
    itemId: world.nets.id,
    quantity: 3,
    snapshot: true,
  });
  await insertHandoverItem(db, {
    handoverId: created.id,
    itemId: world.tape.id,
    quantity: 1234,
    note: "Pedir mais",
    snapshot: true,
  });
  await insertHandoverItem(db, {
    handoverId: created.id,
    itemId: world.cones.id,
    quantity: 0,
    snapshot: true,
  });
  return created.id;
}

async function confirmedHandover(world: World) {
  const created = await insertHandover(db, {
    sectorId: world.sector.id,
    shiftId: world.shift.id,
    operationalDate: "2026-11-19",
    status: "confirmed",
    deliveredBy: world.ana.id,
    deliveredAt: spDate("2026-11-19", "14:05"),
    confirmedBy: world.bia.id,
    confirmedAt: spDate("2026-11-19", "14:20"),
    confirmationNote: "Tudo conferido",
    shiftNameSnapshot: "Manhã",
  });
  await insertHandoverItem(db, {
    handoverId: created.id,
    itemId: world.nets.id,
    quantity: 2,
    snapshot: true,
  });
  return created.id;
}

async function renderDetail(id: string, search: Record<string, string> = {}) {
  render(
    <TooltipProvider>
      {await HandoverDetail({ id, searchParams: Promise.resolve(search) })}
    </TooltipProvider>,
  );
}

const headingNames = () =>
  screen.getAllByRole("heading").map((heading) => heading.textContent);

describe("HandoverDetail", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    for (const mock of [mocks.requireUser, mocks.notFound, mocks.redirect]) {
      mock.mockReset();
    }
    mocks.notFound.mockImplementation(() => {
      throw NOT_FOUND;
    });
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error(`NEXT_REDIRECT;${url}`);
    });
  });

  describe("acesso", () => {
    it("sem sessão: requireUser redireciona e nada é lido", async () => {
      const redirectError = new Error("NEXT_REDIRECT;/entrar");
      mocks.requireUser.mockRejectedValue(redirectError);

      await expect(
        HandoverDetail({
          id: "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b",
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toBe(redirectError);
    });

    it("id que não é uuid → notFound, sem consultar o banco", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asBia);

      await expect(
        HandoverDetail({ id: "abc", searchParams: Promise.resolve({}) }),
      ).rejects.toBe(NOT_FOUND);
    });

    it("uuid que não existe → notFound", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asBia);

      await expect(
        HandoverDetail({
          id: "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b",
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toBe(NOT_FOUND);
    });

    it("operador de outro setor → notFound (não revela que existe)", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      const other = await insertSector(db, "Outro setor");
      const stranger = await insertUser(db, {
        role: "operator",
        sectorId: other.id,
      });
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "operator", userId: stranger.id, sectorId: other.id }),
      );

      await expect(
        HandoverDetail({ id, searchParams: Promise.resolve({}) }),
      ).rejects.toBe(NOT_FOUND);
    });

    it("rascunho: redireciona para a nova passagem daquele turno e dia", async () => {
      const world = await seed();
      const draft = await insertHandover(db, {
        sectorId: world.sector.id,
        shiftId: world.shift.id,
        operationalDate: "2026-11-18",
      });
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await expect(
        HandoverDetail({
          id: draft.id,
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toThrow(
        `NEXT_REDIRECT;/passagens/nova?turno=${world.shift.id}&data=2026-11-18&setor=${world.sector.id}`,
      );
    });
  });

  describe("resumo na ordem do briefing", () => {
    it("título, subtítulo e as seções na ordem", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      expect(
        screen.getByRole("heading", { level: 1, name: "Passagem de turno" }),
      ).toBeInTheDocument();
      expect(screen.getByText("ULD · Manhã · 20/11/2026")).toBeInTheDocument();
      expect(headingNames()).toEqual([
        "Passagem de turno",
        "Fica para o próximo turno",
        "Controles",
        "Estoque",
        "Ocorrências do turno",
        "Entrega",
      ]);
    });

    it("'Fica para o próximo turno' vem em destaque com o texto", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      const section = screen
        .getByRole("heading", { name: "Fica para o próximo turno" })
        .closest("section");
      expect(section).toHaveClass("border-warning");
      expect(
        within(section as HTMLElement).getByText(
          "Conferir as redes do galpão 2.",
        ),
      ).toBeInTheDocument();
    });

    it("itens com valor ou observação aparecem; os zerados ficam recolhidos", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      expect(screen.getByText("Rede de proteção")).toBeInTheDocument();
      expect(screen.getByText("3 unidade")).toBeInTheDocument();
      expect(screen.getByText("Fita adesiva")).toBeInTheDocument();
      expect(screen.getByText("1.234 rolo")).toBeInTheDocument();
      expect(screen.getByText("Pedir mais")).toBeInTheDocument();

      const summary = screen.getByText("Demais itens: 0 (1)");
      const details = summary.closest("details");
      expect(details).not.toBeNull();
      expect(details).not.toHaveAttribute("open");
      expect(
        within(details as HTMLElement).getByText("Cone"),
      ).toBeInTheDocument();
    });

    it("item zerado com observação é destacado, não recolhido", async () => {
      const world = await seed();
      const created = await insertHandover(db, {
        sectorId: world.sector.id,
        shiftId: world.shift.id,
        operationalDate: "2026-11-17",
        status: "delivered",
        deliveredBy: world.ana.id,
      });
      await insertHandoverItem(db, {
        handoverId: created.id,
        itemId: world.cones.id,
        quantity: 0,
        note: "Sem cones no pátio",
        snapshot: true,
      });
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(created.id);

      expect(screen.getByText("Cone")).toBeInTheDocument();
      expect(screen.getByText("Sem cones no pátio")).toBeInTheDocument();
      expect(screen.queryByText(/Demais itens/)).not.toBeInTheDocument();
    });

    it("sem nada destacado: avisa e mostra só os zerados recolhidos", async () => {
      const world = await seed();
      const created = await insertHandover(db, {
        sectorId: world.sector.id,
        shiftId: world.shift.id,
        status: "delivered",
        deliveredBy: world.ana.id,
      });
      await insertHandoverItem(db, {
        handoverId: created.id,
        itemId: world.nets.id,
        snapshot: true,
      });
      await insertHandoverItem(db, {
        handoverId: created.id,
        itemId: world.tape.id,
        snapshot: true,
      });
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(created.id);

      expect(
        screen.getByText("Nenhum item com valor ou observação."),
      ).toBeInTheDocument();
      expect(screen.getByText("Demais itens: 0 (2)")).toBeInTheDocument();
      expect(screen.queryByRole("heading", { name: "Controles" })).toBeNull();
    });

    it("textos vazios mostram a frase de vazio", async () => {
      const world = await seed();
      const created = await insertHandover(db, {
        sectorId: world.sector.id,
        shiftId: world.shift.id,
        status: "delivered",
        deliveredBy: world.ana.id,
      });
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(created.id);

      expect(
        screen.getByText("Nada registrado para o próximo turno."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Nenhuma ocorrência registrada."),
      ).toBeInTheDocument();
    });

    it("a snapshot vence a renomeação posterior do item", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      await mocks.client?.exec(
        "update item set name = 'Rede nova', unit = 'caixa' where name = 'Rede de proteção'",
      );
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      expect(screen.getByText("Rede de proteção")).toBeInTheDocument();
      expect(screen.getByText("3 unidade")).toBeInTheDocument();
      expect(screen.queryByText("Rede nova")).not.toBeInTheDocument();
    });
  });

  describe("entrega e recebimento", () => {
    it("entregue: 'Entregue por {nome} em {data} às {hora}.' e selo Aguardando", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      expect(
        screen.getByText("Entregue por Ana Teste em 20/11/2026 às 14:05."),
      ).toBeInTheDocument();
      expect(screen.getByText("Aguardando recebimento")).toBeInTheDocument();
      expect(screen.queryByText(/Recebido por/)).not.toBeInTheDocument();
    });

    it("outra pessoa do setor vê o formulário de confirmar recebimento", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      expect(
        screen.getByRole("button", { name: "Confirmar recebimento" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("textbox", {
          name: "Observação do recebimento (opcional)",
        }),
      ).toBeInTheDocument();
    });

    it("quem entregou não vê o botão e lê o aviso", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      mocks.requireUser.mockResolvedValue(world.asAna);

      await renderDetail(id);

      expect(
        screen.queryByRole("button", { name: "Confirmar recebimento" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByText(
          "Você entregou este turno. Outra pessoa do setor confirma o recebimento.",
        ),
      ).toBeInTheDocument();
    });

    it("admin que não entregou também confirma", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await renderDetail(id);

      expect(
        screen.getByRole("button", { name: "Confirmar recebimento" }),
      ).toBeInTheDocument();
    });

    it("confirmada: mostra quem recebeu e a observação, sem botão de confirmar", async () => {
      const world = await seed();
      const id = await confirmedHandover(world);
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await renderDetail(id);

      expect(
        screen.getByText("Entregue por Ana Teste em 19/11/2026 às 14:05."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Recebido por Bia Teste em 19/11/2026 às 14:20."),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Observação do recebimento: Tudo conferido"),
      ).toBeInTheDocument();
      expect(screen.getByText("Confirmada por Bia Teste")).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Confirmar recebimento" }),
      ).not.toBeInTheDocument();
    });

    it("confirmada sem observação não escreve a linha da observação", async () => {
      const world = await seed();
      const created = await insertHandover(db, {
        sectorId: world.sector.id,
        shiftId: world.shift.id,
        status: "confirmed",
        deliveredBy: world.ana.id,
        confirmedBy: world.bia.id,
      });
      mocks.requireUser.mockResolvedValue(world.asAna);

      await renderDetail(created.id);

      expect(
        screen.queryByText(/Observação do recebimento:/),
      ).not.toBeInTheDocument();
    });

    it("entregue que não é a mais recente do setor aparece como Não confirmada", async () => {
      const world = await seed();
      const old = await deliveredHandover(world);
      await insertHandover(db, {
        sectorId: world.sector.id,
        shiftId: world.shift.id,
        operationalDate: "2026-11-21",
        status: "delivered",
        deliveredBy: world.ana.id,
        deliveredAt: spDate("2026-11-21", "14:05"),
      });
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(old);

      expect(screen.getByText("Não confirmada")).toBeInTheDocument();
      expect(
        screen.queryByText("Aguardando recebimento"),
      ).not.toBeInTheDocument();
    });
  });

  describe("selo Corrigida, correções e links", () => {
    it("sem correção não há selo nem seção Correções", async () => {
      const world = await seed();
      const id = await confirmedHandover(world);
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await renderDetail(id);

      expect(screen.queryByText("Corrigida")).not.toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: "Correções" }),
      ).not.toBeInTheDocument();
    });

    it("com correções: selo Corrigida e linha do tempo em ordem", async () => {
      const world = await seed();
      const id = await confirmedHandover(world);
      await insertHandoverCorrection(db, {
        handoverId: id,
        field: "item_quantity",
        itemId: world.nets.id,
        oldValue: "1",
        newValue: "2",
        reason: "Contagem errada",
        correctedBy: world.admin.id,
        correctedAt: spDate("2026-11-20", "08:00"),
      });
      await insertHandoverCorrection(db, {
        handoverId: id,
        field: "occurrences_text",
        oldValue: "",
        newValue: "Chuva",
        reason: "Esqueceram de anotar",
        correctedBy: world.admin.id,
        correctedAt: spDate("2026-11-20", "09:00"),
      });
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      expect(screen.getByText("Corrigida")).toBeInTheDocument();
      expect(
        screen.getByRole("heading", { name: "Correções" }),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Rede de proteção: quantidade"),
      ).toBeInTheDocument();
      expect(screen.getByText("1 → 2")).toBeInTheDocument();
      expect(screen.getByText("(vazio) → Chuva")).toBeInTheDocument();
      expect(screen.getByText("Motivo: Contagem errada")).toBeInTheDocument();
      expect(
        screen.getAllByText("Admin Teste · 20/11/2026, 08:00"),
      ).toHaveLength(1);
      const reasons = screen
        .getAllByText(/^Motivo: /)
        .map((node) => node.textContent);
      expect(reasons).toEqual([
        "Motivo: Contagem errada",
        "Motivo: Esqueceram de anotar",
      ]);
    });

    it("quem entregou vê o link Corrigir na entregue", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);

      mocks.requireUser.mockResolvedValue(world.asAna);
      await renderDetail(id);
      expect(screen.getByRole("link", { name: "Corrigir" })).toHaveAttribute(
        "href",
        `/passagens/${id}?editar=1`,
      );
    });

    it("outro operador não vê Corrigir na entregue", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      expect(
        screen.queryByRole("link", { name: /^Corrigir/ }),
      ).not.toBeInTheDocument();
    });

    it("operador não vê link de correção na confirmada", async () => {
      const world = await seed();
      const id = await confirmedHandover(world);

      mocks.requireUser.mockResolvedValue(world.asBia);
      await renderDetail(id);
      expect(
        screen.queryByRole("link", { name: /^Corrigir/ }),
      ).not.toBeInTheDocument();
    });

    it("admin: link 'Corrigir com motivo' aponta para ?editar=1", async () => {
      const world = await seed();
      const id = await confirmedHandover(world);
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await renderDetail(id);

      expect(
        screen.getByRole("link", { name: "Corrigir com motivo" }),
      ).toHaveAttribute("href", `/passagens/${id}?editar=1`);
    });

    it("sempre oferece 'Ver todas as passagens'", async () => {
      const world = await seed();
      const id = await deliveredHandover(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id);

      expect(
        screen.getByRole("link", { name: "Ver todas as passagens" }),
      ).toHaveAttribute("href", "/passagens");
    });
  });
});
```

- [ ] **Step 19: Run test to verify it fails**

Run: `bun run test -- src/components/passagens/HandoverDetail.test.tsx`
Expected: FAIL com `Failed to resolve import "./HandoverDetail" from "src/components/passagens/HandoverDetail.test.tsx". Does the file exist?`

- [ ] **Step 20: Write minimal implementation (HandoverDetail)**

Crie `src/components/passagens/HandoverDetail.tsx`. O id é validado aqui (e não só na página) para que o teste cubra o `notFound()`; um id que não é uuid nunca chega ao Postgres. O rascunho redireciona **com** `setor` para o admin cair no setor certo:

```tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { db } from "@/db";
import { idSchema } from "@/features/admin/schemas";
import {
  formatDateBR,
  formatTimeBR,
  saoPauloParts,
} from "@/features/handovers/saoPaulo";
import { getHandoverSummary } from "@/features/handovers/summary";
import { handoverHref, newHandoverHref } from "@/features/handovers/urls";
import { requireUser } from "@/lib/auth/session";

import { ConfirmReceiptForm } from "./ConfirmReceiptForm";
import { CorrectionsTimeline } from "./CorrectionsTimeline";
import { HandoverStatusBadge } from "./HandoverStatusBadge";
import { SummaryItemList } from "./SummaryItemList";

type HandoverDetailProps = {
  id: string;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function dateAndTime(value: Date): string {
  return `em ${formatDateBR(saoPauloParts(value).date)} às ${formatTimeBR(value)}`;
}

export async function HandoverDetail({ id }: HandoverDetailProps) {
  const actor = await requireUser();
  // Id malformado nem chega ao banco (uuid inválido estouraria no Postgres).
  if (!idSchema.safeParse(id).success) notFound();

  const result = await getHandoverSummary(db, actor, id);
  if (!result.ok) notFound();
  const { summary } = result;

  // Rascunho não tem resumo: o lugar dele é o formulário daquele turno e dia.
  if (summary.status === "draft") {
    redirect(newHandoverHref(summary.ref, summary.ref.sectorId));
  }

  const { capabilities } = summary;
  const hasHighlighted =
    summary.highlighted.controls.length > 0 ||
    summary.highlighted.stock.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Passagem de turno
        </h1>
        <p className="text-muted-foreground">
          {`${summary.sectorName} · ${summary.shiftName} · ${formatDateBR(summary.ref.operationalDate)}`}
        </p>
        {summary.situation && (
          <HandoverStatusBadge
            situation={summary.situation}
            confirmedByName={summary.confirmedByName}
            corrected={summary.corrected}
          />
        )}
      </header>

      <section
        aria-labelledby="next-shift-heading"
        className="flex flex-col gap-2 rounded-lg border border-warning p-4"
      >
        <h2 id="next-shift-heading" className="text-lg font-semibold">
          Fica para o próximo turno
        </h2>
        {summary.nextShiftText === "" ? (
          <p className="text-muted-foreground">
            Nada registrado para o próximo turno.
          </p>
        ) : (
          <p className="whitespace-pre-wrap">{summary.nextShiftText}</p>
        )}
      </section>

      <SummaryItemList title="Controles" items={summary.highlighted.controls} />
      <SummaryItemList title="Estoque" items={summary.highlighted.stock} />
      {!hasHighlighted && (
        <p className="text-muted-foreground">
          Nenhum item com valor ou observação.
        </p>
      )}
      {summary.zeroed.count > 0 && (
        <details className="rounded-lg border px-4 py-3">
          <summary className="cursor-pointer font-medium">
            {`Demais itens: 0 (${summary.zeroed.count})`}
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-muted-foreground">
            {summary.zeroed.names.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </details>
      )}

      <section
        aria-labelledby="occurrences-heading"
        className="flex flex-col gap-2"
      >
        <h2 id="occurrences-heading" className="text-lg font-semibold">
          Ocorrências do turno
        </h2>
        {summary.occurrencesText === "" ? (
          <p className="text-muted-foreground">
            Nenhuma ocorrência registrada.
          </p>
        ) : (
          <p className="whitespace-pre-wrap">{summary.occurrencesText}</p>
        )}
      </section>

      <section
        aria-labelledby="delivery-heading"
        className="flex flex-col gap-3"
      >
        <h2 id="delivery-heading" className="text-lg font-semibold">
          Entrega
        </h2>
        {summary.deliveredAt && (
          <p>
            {`Entregue por ${summary.deliveredByName ?? "—"} ${dateAndTime(summary.deliveredAt)}.`}
          </p>
        )}
        {summary.confirmedAt && (
          <p>
            {`Recebido por ${summary.confirmedByName ?? "—"} ${dateAndTime(summary.confirmedAt)}.`}
          </p>
        )}
        {summary.confirmationNote && (
          <p className="whitespace-pre-wrap">
            {`Observação do recebimento: ${summary.confirmationNote}`}
          </p>
        )}
        {capabilities.canConfirm && <ConfirmReceiptForm id={summary.id} />}
        {summary.status === "delivered" && !capabilities.canConfirm && (
          <p className="text-muted-foreground">
            Você entregou este turno. Outra pessoa do setor confirma o
            recebimento.
          </p>
        )}
      </section>

      {summary.corrections.length > 0 && (
        <section
          aria-labelledby="corrections-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="corrections-heading" className="text-lg font-semibold">
            Correções
          </h2>
          <CorrectionsTimeline corrections={summary.corrections} />
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        {summary.status === "delivered" && capabilities.canEditDirectly && (
          <Link
            href={handoverHref(summary.id, { edit: true })}
            className={buttonVariants({ variant: "outline" })}
          >
            Corrigir
          </Link>
        )}
        {capabilities.canCorrectWithReason && (
          <Link
            href={handoverHref(summary.id, { edit: true })}
            className={buttonVariants({ variant: "outline" })}
          >
            Corrigir com motivo
          </Link>
        )}
        <Link
          href="/passagens"
          className={buttonVariants({ variant: "ghost" })}
        >
          Ver todas as passagens
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 21: Run test to verify it passes**

Run: `bun run test -- src/components/passagens/HandoverDetail.test.tsx`
Expected: PASS (26 testes)

- [ ] **Step 22: Criar a página `/passagens/[id]`**

Crie `src/app/(app)/passagens/[id]/page.tsx` (página fina: `metadata` estático, leitura de `params` e `searchParams` só dentro do `<Suspense>`; o portão `requireUser()` está no `HandoverDetail`, importado de `@/components`, o que satisfaz o guarda `appPagesAuth.test.ts`):

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";

import { HandoverDetail } from "@/components/passagens/HandoverDetail";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Passagem" };

type HandoverPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// params e searchParams são dinâmicos: só se leem dentro do <Suspense>. A
// validação do id (uuid) e o 404 de passagem inexistente ou de outro setor
// ficam no HandoverDetail.
export default function HandoverPage({
  params,
  searchParams,
}: HandoverPageProps) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HandoverContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function HandoverContent({ params, searchParams }: HandoverPageProps) {
  const { id } = await params;
  return <HandoverDetail id={id} searchParams={searchParams} />;
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-5 w-80 max-w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
```

- [ ] **Step 23: Acrescentar a rota ao guarda de páginas**

Em `src/app/appPagesAuth.test.ts`, no array de rotas esperadas (o do `it("inclui a página de cada rota de /passagens")`, criado na Tarefa 8, com `"passagens/nova/page.tsx",`), acrescente uma linha depois da última rota existente (**não** na lista de `/admin`):

```ts
      "passagens/[id]/page.tsx",
```

Run: `bun run test -- src/app/appPagesAuth.test.ts`
Expected: PASS (todos os testes do arquivo; a página nova entra sozinha no `it.each` e exige `requireUser` via `HandoverDetail`)

- [ ] **Step 24: Registrar os componentes no ui-registry**

Em `.context/ui-registry.md`, insira os quatro blocos abaixo imediatamente antes da linha que começa com `## 3. Componentes de domínio`. Os blocos entram depois da última entrada do bloco `### Passagem de turno — \`src/components/passagens/*\` (Fase 3)` (criado na Tarefa 7; não repita o cabeçalho) e antes de `## 3. Componentes de domínio`:

````markdown
### SummaryItemList
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/SummaryItemList.tsx`
- **Propósito:** lista de itens de uma seção do resumo da passagem (Controles ou Estoque).
- **Como funciona:** server-safe; `<section aria-labelledby>` com `<h2>` e `<ul>`; cada linha mostra o nome, `{quantidade} {unidade}` à direita com `tabular-nums` (milhar em pt-BR) e a observação em `text-muted-foreground`; sem itens não escreve nada (nem o título).
- **Usa:** tokens `border`, `muted-foreground`; `formatQuantity`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 9).

### CorrectionsTimeline
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/CorrectionsTimeline.tsx`
- **Propósito:** mostrar as correções de uma passagem confirmada (D13) como linha do tempo.
- **Como funciona:** server-safe; `<ol>` com uma entrada por campo corrigido: rótulo (`correctionFieldLabel`), `antigo → novo` (`(vazio)` para texto vazio), `Motivo: …` e `{nome} · {dd/mm/aaaa, HH:mm}`; ordem recebida (a consulta já ordena por data); sem correções não escreve nada.
- **Usa:** tokens `border`, `muted-foreground`; `formatDateTimeBR`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 9).

### ConfirmReceiptForm
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/ConfirmReceiptForm.tsx`
- **Propósito:** confirmar o recebimento de uma passagem entregue, com observação opcional.
- **Como funciona:** `"use client"`; formulário controlado: `Textarea` "Observação do recebimento (opcional)" (500 caracteres) e botão "Confirmar recebimento" (pendente: "Confirmando…", desabilitado, um envio só); valida com `confirmHandoverSchema` antes de chamar `confirmHandoverAction`; sucesso = toast "Recebimento confirmado." (a action revalida a página, que passa a mostrar a passagem confirmada); recusa aparece inline (no campo, se for da observação; senão abaixo dele) sem toast, e o que foi digitado fica.
- **Usa:** `useAdminAction`, `Button`, `Field*`, `Textarea`, `sonner`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 9).

### HandoverDetail
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HandoverDetail.tsx`
- **Propósito:** resumo de `/passagens/[id]` na ordem do briefing (F3-10).
- **Como funciona:** server (async); `requireUser()` primeiro; id que não é uuid, passagem inexistente ou de outro setor = `notFound()`; rascunho redireciona para `/passagens/nova` do mesmo turno e dia (com `setor`). Ordem: título e subtítulo (`{setor} · {turno} · {data}`) com `HandoverStatusBadge` (+ selo "Corrigida") → "Fica para o próximo turno" (borda `border-warning`) → Controles → Estoque (só itens com valor ≠ 0 ou observação; os demais recolhidos em `<details>` "Demais itens: 0 (n)") → "Ocorrências do turno" → "Entrega" (quem entregou, quem recebeu, observação, `ConfirmReceiptForm` para quem pode confirmar ou o aviso para quem entregou) → "Correções" (`CorrectionsTimeline`) → links "Corrigir" (entregue; quem entregou e admin), "Corrigir com motivo" (confirmada; admin) e "Ver todas as passagens".
- **Usa:** `getHandoverSummary`, `SummaryItemList`, `CorrectionsTimeline`, `ConfirmReceiptForm`, `HandoverStatusBadge`, `buttonVariants`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 9).
````

(Os quatro blocos vão sem a cerca de código; ela acima é só para delimitar o texto.)

- [ ] **Step 25: Formatar e rodar as verificações da tarefa**

Run: `bunx biome check --write src/components/passagens "src/app/(app)/passagens" src/app/appPagesAuth.test.ts && bun run check-types && bun run lint && bun run test`
Expected: Biome sem erros; `check-types` e `lint` sem saída de erro; Vitest com todos os arquivos passando (inclusive os 56 testes novos desta tarefa: 5 + 5 + 12 + 8 + 26).

- [ ] **Step 26: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-9.txt` (texto exato abaixo) e rode:

```bash
git add src/components/passagens/SummaryItemList.tsx src/components/passagens/SummaryItemList.test.tsx \
  src/components/passagens/CorrectionsTimeline.tsx src/components/passagens/CorrectionsTimeline.test.tsx \
  src/components/passagens/ConfirmReceiptForm.tsx src/components/passagens/ConfirmReceiptForm.test.tsx \
  src/components/passagens/HandoverDetail.tsx src/components/passagens/HandoverDetail.test.tsx \
  "src/app/(app)/passagens/[id]/page.tsx" "src/app/(app)/passagens/actions.ts" \
  "src/app/(app)/passagens/confirmAction.test.ts" src/app/appPagesAuth.test.ts .context/ui-registry.md
git commit -F .git/sdd/msg-task-9.txt
```

Mensagem:

```text
feat(passagens): resumo da passagem e confirmação de recebimento

Página /passagens/[id] na ordem do briefing, com selo Corrigida, itens
zerados recolhidos e linha do tempo das correções. Quem não entregou
confirma o recebimento (observação opcional) por confirmHandoverAction;
rascunho redireciona para a nova passagem; id inválido e outro setor
viram "Página não encontrada".

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 10: Histórico de passagens (`/passagens`)

**Files:**
- Create: `src/features/handovers/historyUrl.test.ts`
- Create: `src/components/passagens/HistoryRowItem.tsx`
- Create: `src/components/passagens/HistoryFilters.tsx`
- Create: `src/components/passagens/HandoverHistory.tsx`
- Create: `src/app/(app)/passagens/page.tsx`
- Modify: `src/app/appPagesAuth.test.ts` (LER antes: sobe o mínimo de páginas de 9 para 12 e acrescenta o teste das rotas de `/passagens`)
- Modify: `.context/ui-registry.md` (LER antes: três entradas novas, antes da seção `## 3. Componentes de domínio`; as demais entradas de `src/components/passagens` pertencem às Tarefas 7, 8, 9 e 11)
- Test: `src/components/passagens/HistoryRowItem.test.tsx`
- Test: `src/components/passagens/HistoryFilters.test.tsx`
- Test: `src/components/passagens/HandoverHistory.test.tsx`

**Interfaces:**
- Consumes (todas pelo contrato, de tarefas anteriores):
  - `parseHistoryFilters(params: Record<string, string | string[] | undefined>, today: string): HistoryFilters` e `buildHistoryHref(filters: HistoryFilters, extras?: { sector?: string; page?: number }): string` (`@/features/handovers/historyFilters`, Tarefa 2).
  - `listHandoverHistory(db: Db, actor: Authz, input: { filters: HistoryFilters; sectorId: string | null; page: number }, now: Date): Promise<Page<HistoryRow>>` e o tipo `HistoryRow` (`@/features/handovers/history`, Tarefa 6).
  - `resolveHandoverSector(sectors, { url, cookie }, { allowAll })`, `readRememberedSector()`, `listActiveShifts(db, sectorId)`, `loadSector(db, actor, sectorId)`, `todayInSaoPaulo`, `formatDateBR`, `formatTimeBR`, `newHandoverHref(ref, sector?)`, `handoverHref(id)`, `ALL_SECTORS`.
  - `SectorPicker` (props `{ sectors, selectedId, path, allowAll? }`) e `HandoverStatusBadge` (props `{ situation, confirmedByName?, corrected? }`), Tarefa 7; `AdminListRow`, `EmptyState`, `Pagination`, `SelectField`, `parsePage` (Fase 2); `spDate` (`test/clock.ts`), `insertHandover`, `insertHandoverCorrection`, `insertShift({ createdAt })` (Tarefa 1); `requireUser` (`@/lib/auth/session`).
  - As páginas `passagens/nova/page.tsx` e `passagens/[id]/page.tsx` já existem (Tarefas 8 e 9): o mínimo de 12 páginas só fecha com elas.
- Produces:
  - `HistoryRowItem(props: { row: HistoryRow; showSector: boolean; sectorParam: string | null })`: server-safe. `sectorParam` é o `?setor=` que o admin está vendo (id ou `"todos"`) e `null` para operador; o setor da **linha** (nunca `"todos"`) é o que vai no link "Entregar turno" do admin.
  - `HistoryFilters(props: { filters: HistoryFilters; shifts: readonly ShiftChoice[]; sectorParam: string | null })`: client.
  - `HandoverHistory(props: { searchParams: Promise<Record<string, string | string[] | undefined>> })`: server (async), chama `requireUser()`.
  - `src/app/(app)/passagens/page.tsx`: página fina com `metadata` `Passagens` e `<Suspense>`.

- [ ] **Step 1: Write the characterization test of the URL round trip**

Este módulo (Tarefa 2) já existe: o teste prova que o que a tela monta (`buildHistoryHref`) volta igual pelo servidor (`parseHistoryFilters`), então passa de primeira.

Create `src/features/handovers/historyUrl.test.ts`:
```ts
import { describe, expect, it } from "vitest";

import {
  buildHistoryHref,
  type HistoryFilters,
  parseHistoryFilters,
} from "./historyFilters";

const TODAY = "2026-11-21";
const SHIFT = "11111111-1111-4111-8111-111111111111";

function paramsOf(href: string): Record<string, string> {
  return Object.fromEntries(new URL(href, "http://closery.local").searchParams);
}

// O que a tela monta (buildHistoryHref) tem de voltar igual pelo servidor
// (parseHistoryFilters): a URL é a única memória dos filtros.
describe("filtros do histórico: ida e volta pela URL", () => {
  const cases: [string, HistoryFilters][] = [
    [
      "padrão (7 dias, todas, sem turno)",
      {
        period: "7",
        from: "2026-11-15",
        to: TODAY,
        shiftId: null,
        situation: "all",
      },
    ],
    [
      "30 dias",
      {
        period: "30",
        from: "2026-10-23",
        to: TODAY,
        shiftId: null,
        situation: "all",
      },
    ],
    [
      "intervalo com turno e situação",
      {
        period: "range",
        from: "2026-11-01",
        to: "2026-11-10",
        shiftId: SHIFT,
        situation: "unconfirmed",
      },
    ],
    [
      "7 dias só com situação corrigida",
      {
        period: "7",
        from: "2026-11-15",
        to: TODAY,
        shiftId: null,
        situation: "corrected",
      },
    ],
    [
      "intervalo de um dia",
      {
        period: "range",
        from: "2026-11-21",
        to: "2026-11-21",
        shiftId: null,
        situation: "missing",
      },
    ],
  ];

  it.each(cases)("%s", (_name, filters) => {
    const href = buildHistoryHref(filters);
    expect(parseHistoryFilters(paramsOf(href), TODAY)).toEqual(filters);
  });

  it("o padrão vira /passagens sem parâmetros", () => {
    expect(buildHistoryHref(parseHistoryFilters({}, TODAY))).toBe("/passagens");
  });

  it("o setor e a página acompanham os filtros, e a página 1 some", () => {
    const filters = parseHistoryFilters({ periodo: "30" }, TODAY);
    const href = buildHistoryHref(filters, { sector: "todos", page: 3 });
    expect(paramsOf(href)).toEqual({
      periodo: "30",
      setor: "todos",
      pagina: "3",
    });
    expect(paramsOf(buildHistoryHref(filters, { page: 1 }))).toEqual({
      periodo: "30",
    });
  });

  it("intervalo invertido volta na ordem certa depois de ida e volta", () => {
    const parsed = parseHistoryFilters(
      { periodo: "intervalo", de: "2026-11-10", ate: "2026-11-01" },
      TODAY,
    );
    expect(parsed.from).toBe("2026-11-01");
    expect(
      parseHistoryFilters(paramsOf(buildHistoryHref(parsed)), TODAY),
    ).toEqual(parsed);
  });
});
```

- [ ] **Step 2: Run it**

Run: `bun run test -- src/features/handovers/historyUrl.test.ts`
Expected: PASS (8 testes). Se falhar, o defeito está nas funções da Tarefa 2 (não corrija aqui: volte à Tarefa 2).

- [ ] **Step 3: Write the failing component tests (linha do histórico)**

Create `src/components/passagens/HistoryRowItem.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { HistoryRow } from "@/features/handovers/history";
import { spDate } from "../../../test/clock";
import { HistoryRowItem } from "./HistoryRowItem";

const SECTOR = "22222222-2222-4222-8222-222222222222";
const SHIFT = "33333333-3333-4333-8333-333333333333";
const HANDOVER = "44444444-4444-4444-8444-444444444444";

function row(overrides: Partial<HistoryRow> = {}): HistoryRow {
  return {
    key: `${SECTOR}:${SHIFT}:2026-11-20`,
    operationalDate: "2026-11-20",
    shiftId: SHIFT,
    shiftName: "Turno Manhã",
    sectorId: SECTOR,
    sectorName: "Setor Teste",
    handoverId: HANDOVER,
    situation: "confirmed",
    corrected: false,
    hasDraft: false,
    deliveredByName: "Ana Teste",
    deliveredAt: spDate("2026-11-20", "14:05"),
    confirmedByName: "Bia Teste",
    confirmedAt: spDate("2026-11-20", "14:20"),
    ...overrides,
  };
}

function renderRow(props: Parameters<typeof HistoryRowItem>[0]) {
  render(
    <ul>
      <HistoryRowItem {...props} />
    </ul>,
  );
}

describe("HistoryRowItem", () => {
  it("confirmada: dia, turno, quem entregou, selo com o nome e link Abrir", () => {
    renderRow({ row: row(), showSector: false, sectorParam: null });

    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("20/11/2026 · Turno Manhã");
    expect(item).toHaveTextContent("Entregue por Ana Teste às 14:05");
    expect(item).toHaveTextContent("Confirmada por Bia Teste");
    expect(item).not.toHaveTextContent("Corrigida");
    expect(item).not.toHaveTextContent("Setor Teste");
    expect(
      screen.getByRole("link", {
        name: "Abrir passagem de Turno Manhã em 20/11/2026",
      }),
    ).toHaveAttribute("href", `/passagens/${HANDOVER}`);
  });

  it("corrigida: o selo 'Corrigida' aparece ao lado da situação", () => {
    renderRow({
      row: row({ corrected: true }),
      showSector: false,
      sectorParam: null,
    });

    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Confirmada por Bia Teste");
    expect(item).toHaveTextContent("Corrigida");
  });

  it("aguardando e não confirmada mostram o texto da situação (nunca só cor)", () => {
    renderRow({
      row: row({
        situation: "awaiting",
        confirmedByName: null,
        confirmedAt: null,
      }),
      showSector: false,
      sectorParam: null,
    });
    expect(screen.getByText("Aguardando recebimento")).toBeInTheDocument();
  });

  it("não confirmada", () => {
    renderRow({
      row: row({
        situation: "unconfirmed",
        confirmedByName: null,
        confirmedAt: null,
      }),
      showSector: false,
      sectorParam: null,
    });
    expect(screen.getByText("Não confirmada")).toBeInTheDocument();
  });

  it("admin em 'Todos os setores' vê o setor na linha", () => {
    renderRow({ row: row(), showSector: true, sectorParam: "todos" });
    expect(screen.getByRole("listitem")).toHaveTextContent(
      "Setor Teste · Entregue por Ana Teste às 14:05",
    );
  });

  it("sem passagem: sem 'Entregue por' e com o link 'Entregar turno' para aquele turno e dia", () => {
    renderRow({
      row: row({
        handoverId: null,
        situation: "missing",
        deliveredByName: null,
        deliveredAt: null,
        confirmedByName: null,
        confirmedAt: null,
      }),
      showSector: false,
      sectorParam: null,
    });

    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Sem passagem");
    expect(item).not.toHaveTextContent("Entregue por");
    expect(
      screen.getByRole("link", {
        name: "Entregar turno de Turno Manhã em 20/11/2026",
      }),
    ).toHaveAttribute("href", `/passagens/nova?turno=${SHIFT}&data=2026-11-20`);
    expect(
      screen.queryByRole("link", { name: /Abrir/ }),
    ).not.toBeInTheDocument();
  });

  it("sem passagem para o admin: o link leva o setor da linha, não 'todos'", () => {
    renderRow({
      row: row({ handoverId: null, situation: "missing", deliveredAt: null }),
      showSector: true,
      sectorParam: "todos",
    });
    expect(
      screen.getByRole("link", { name: /Entregar turno/ }),
    ).toHaveAttribute(
      "href",
      `/passagens/nova?turno=${SHIFT}&data=2026-11-20&setor=${SECTOR}`,
    );
  });

  it("sem passagem com rascunho: o link é 'Continuar passagem'", () => {
    renderRow({
      row: row({
        handoverId: null,
        situation: "missing",
        hasDraft: true,
        deliveredByName: null,
        deliveredAt: null,
      }),
      showSector: false,
      sectorParam: null,
    });

    expect(
      screen.getByRole("link", {
        name: "Continuar passagem de Turno Manhã em 20/11/2026",
      }),
    ).toHaveAttribute("href", `/passagens/nova?turno=${SHIFT}&data=2026-11-20`);
    expect(
      screen.queryByRole("link", { name: /Entregar turno/ }),
    ).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Write the failing tests of the filters form**

Create `src/components/passagens/HistoryFilters.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type HistoryFilters as Filters,
  parseHistoryFilters,
} from "@/features/handovers/historyFilters";
import { HistoryFilters } from "./HistoryFilters";

const mocks = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));

const SHIFT_A = "11111111-1111-4111-8111-111111111111";
const SHIFT_B = "22222222-2222-4222-8222-222222222222";
const SECTOR = "33333333-3333-4333-8333-333333333333";
const SHIFTS = [
  { id: SHIFT_A, name: "Turno Manhã", startsAt: "06:00", endsAt: "14:00" },
  { id: SHIFT_B, name: "Turno Noite", startsAt: "22:00", endsAt: "06:00" },
];

const DEFAULTS: Filters = parseHistoryFilters({}, "2026-11-21");

describe("HistoryFilters", () => {
  beforeEach(() => mocks.push.mockReset());

  it("nunca começa em branco: período 7 dias, todos os turnos, todas as situações", () => {
    render(
      <HistoryFilters filters={DEFAULTS} shifts={SHIFTS} sectorParam={null} />,
    );

    expect(screen.getByLabelText("Período")).toHaveValue("7");
    expect(screen.getByLabelText("Turno")).toHaveValue("all");
    expect(screen.getByLabelText("Situação")).toHaveValue("all");
    expect(screen.queryByLabelText("De")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Até")).not.toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Todos os turnos" }),
    ).toBeInTheDocument();
  });

  it("começa com o que a URL já escolheu", () => {
    render(
      <HistoryFilters
        filters={parseHistoryFilters(
          {
            periodo: "intervalo",
            de: "2026-11-01",
            ate: "2026-11-10",
            turno: SHIFT_B,
            situacao: "nao-confirmada",
          },
          "2026-11-21",
        )}
        shifts={SHIFTS}
        sectorParam={null}
      />,
    );

    expect(screen.getByLabelText("Período")).toHaveValue("range");
    expect(screen.getByLabelText("De")).toHaveValue("2026-11-01");
    expect(screen.getByLabelText("Até")).toHaveValue("2026-11-10");
    expect(screen.getByLabelText("Turno")).toHaveValue(SHIFT_B);
    expect(screen.getByLabelText("Situação")).toHaveValue("unconfirmed");
  });

  it("'Todos os setores' (sem turnos para escolher): o campo Turno não aparece", () => {
    render(
      <HistoryFilters filters={DEFAULTS} shifts={[]} sectorParam="todos" />,
    );
    expect(screen.queryByLabelText("Turno")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Período")).toBeInTheDocument();
  });

  it("escolher Intervalo mostra De e Até já preenchidos com os últimos 7 dias", async () => {
    const user = userEvent.setup();
    render(
      <HistoryFilters filters={DEFAULTS} shifts={SHIFTS} sectorParam={null} />,
    );

    await user.selectOptions(screen.getByLabelText("Período"), "range");

    expect(screen.getByLabelText("De")).toHaveValue("2026-11-15");
    expect(screen.getByLabelText("Até")).toHaveValue("2026-11-21");
  });

  it("'Aplicar filtros' navega para a URL dos filtros (volta à página 1)", async () => {
    const user = userEvent.setup();
    render(
      <HistoryFilters filters={DEFAULTS} shifts={SHIFTS} sectorParam={null} />,
    );

    await user.selectOptions(screen.getByLabelText("Período"), "30");
    await user.selectOptions(screen.getByLabelText("Turno"), SHIFT_A);
    await user.selectOptions(screen.getByLabelText("Situação"), "missing");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(mocks.push).toHaveBeenCalledTimes(1);
    expect(mocks.push).toHaveBeenCalledWith(
      `/passagens?periodo=30&turno=${SHIFT_A}&situacao=sem-passagem`,
    );
  });

  it("o intervalo digitado vai na URL e o setor do admin é preservado", async () => {
    const user = userEvent.setup();
    render(
      <HistoryFilters
        filters={DEFAULTS}
        shifts={SHIFTS}
        sectorParam={SECTOR}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Período"), "range");
    await user.clear(screen.getByLabelText("De"));
    await user.type(screen.getByLabelText("De"), "2026-11-01");
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));

    expect(mocks.push).toHaveBeenCalledWith(
      `/passagens?periodo=intervalo&de=2026-11-01&ate=2026-11-21&setor=${SECTOR}`,
    );
  });

  it("aplicar sem mexer em nada vai para o histórico padrão", async () => {
    const user = userEvent.setup();
    render(
      <HistoryFilters filters={DEFAULTS} shifts={SHIFTS} sectorParam={null} />,
    );
    await user.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    expect(mocks.push).toHaveBeenCalledWith("/passagens");
  });

  it("'Limpar filtros' é um link para o histórico sem filtros", () => {
    render(
      <HistoryFilters filters={DEFAULTS} shifts={SHIFTS} sectorParam={null} />,
    );
    expect(
      screen.getByRole("link", { name: "Limpar filtros" }),
    ).toHaveAttribute("href", "/passagens");
  });

  it("'Limpar filtros' preserva só o setor do admin", () => {
    render(
      <HistoryFilters
        filters={DEFAULTS}
        shifts={SHIFTS}
        sectorParam={SECTOR}
      />,
    );
    expect(
      screen.getByRole("link", { name: "Limpar filtros" }),
    ).toHaveAttribute("href", `/passagens?setor=${SECTOR}`);
  });
});
```

- [ ] **Step 5: Write the failing test of the page component (PGlite real, relógio só do `Date`)**

Create `src/components/passagens/HandoverHistory.test.tsx`:
```tsx
import type { PGlite } from "@electric-sql/pglite";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { resetDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverCorrection,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { HandoverHistory } from "./HandoverHistory";

const mocks = vi.hoisted(
  (): {
    requireUser: ReturnType<typeof vi.fn>;
    readRememberedSector: ReturnType<typeof vi.fn>;
    client: PGlite | undefined;
  } => ({
    requireUser: vi.fn(),
    readRememberedSector: vi.fn(),
    client: undefined,
  }),
);

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/features/handovers/sectorCookie", () => ({
  readRememberedSector: mocks.readRememberedSector,
}));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});
vi.mock("@/app/(app)/actions", () => ({ chooseSectorAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

// 21/11/2026 14:30 em São Paulo. Só o Date é falso: o PGlite continua real.
const NOW = spDate("2026-11-21", "14:30");
const LONG_AGO = new Date("2026-01-01T00:00:00Z");

async function renderHistory(search: Record<string, string> = {}) {
  render(await HandoverHistory({ searchParams: Promise.resolve(search) }));
}

async function seed() {
  const sector = await insertSector(db, "Setor Teste");
  const other = await insertSector(db, "Setor Outro");
  const morning = await insertShift(db, {
    sectorId: sector.id,
    name: "Turno Manhã",
    startsAt: "06:00",
    endsAt: "14:00",
    createdAt: LONG_AGO,
  });
  const otherShift = await insertShift(db, {
    sectorId: other.id,
    name: "Turno Outro",
    startsAt: "06:00",
    endsAt: "14:00",
    createdAt: LONG_AGO,
  });
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Bia Teste",
  });
  return { sector, other, morning, otherShift, ana, bia };
}

describe("HandoverHistory", () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireUser.mockReset();
    mocks.readRememberedSector.mockReset();
    mocks.readRememberedSector.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("operador: título, só o próprio setor, sem seletor, e cada situação com o selo certo", async () => {
    const { sector, morning, otherShift, other, ana, bia } = await seed();
    const confirmed = await insertHandover(db, {
      sectorId: sector.id,
      shiftId: morning.id,
      operationalDate: "2026-11-19",
      status: "confirmed",
      deliveredBy: ana.id,
      confirmedBy: bia.id,
      deliveredAt: new Date("2026-11-19T17:00:00Z"),
    });
    await insertHandoverCorrection(db, {
      handoverId: confirmed.id,
      field: "occurrences_text",
      correctedBy: bia.id,
    });
    await insertHandover(db, {
      sectorId: sector.id,
      shiftId: morning.id,
      operationalDate: "2026-11-20",
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: new Date("2026-11-20T17:00:00Z"),
    });
    // Passagem de outro setor: nunca aparece para o operador.
    await insertHandover(db, {
      sectorId: other.id,
      shiftId: otherShift.id,
      operationalDate: "2026-11-20",
      status: "delivered",
      deliveredBy: ana.id,
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", sectorId: sector.id, userId: bia.id }),
    );

    await renderHistory({ setor: other.id });

    expect(
      screen.getByRole("heading", { level: 1, name: "Passagens" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Histórico de passagens de turno, do dia mais recente ao mais antigo.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Setor" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Turno Outro")).not.toBeInTheDocument();
    expect(screen.getByText(/Período:/)).toHaveTextContent(
      "Período: 15/11/2026 a 21/11/2026",
    );

    const items = screen.getAllByRole("listitem");
    const text = items.map((item) => item.textContent ?? "");
    // 21/11 (sem passagem, encerrado às 14:00), 20/11 (a mais recente
    // entregue do setor: aguardando) e 19/11 (confirmada e corrigida).
    expect(text[0]).toContain("21/11/2026");
    expect(text[0]).toContain("Sem passagem");
    expect(text[1]).toContain("20/11/2026");
    expect(text[1]).toContain("Aguardando recebimento");
    expect(text[2]).toContain("19/11/2026");
    expect(text[2]).toContain("Confirmada por Bia Teste");
    expect(text[2]).toContain("Corrigida");
    expect(
      screen.getByRole("link", {
        name: "Entregar turno de Turno Manhã em 21/11/2026",
      }),
    ).toHaveAttribute(
      "href",
      `/passagens/nova?turno=${morning.id}&data=2026-11-21`,
    );
  });

  it("admin: seletor de setor com 'Todos os setores', e em 'todos' as linhas mostram o setor", async () => {
    const { sector, other, otherShift, ana } = await seed();
    await insertHandover(db, {
      sectorId: other.id,
      shiftId: otherShift.id,
      operationalDate: "2026-11-20",
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: new Date("2026-11-20T17:00:00Z"),
    });
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderHistory({ setor: "todos", situacao: "aguardando" });

    const picker = screen.getByRole("group", { name: "Setor" });
    expect(
      within(picker).getByRole("button", { name: "Todos os setores" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(picker).getByRole("button", { name: sector.name }),
    ).toHaveAttribute("aria-pressed", "false");
    // Em "todos os setores" não há filtro de turno.
    expect(screen.queryByLabelText("Turno")).not.toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent(
      "Setor Outro · Entregue por Ana Teste",
    );
  });

  it("admin com setor escolhido (cookie): filtra o setor e oferece os turnos dele", async () => {
    const { sector, other } = await seed();
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));
    mocks.readRememberedSector.mockResolvedValue(other.id);

    await renderHistory({ situacao: "sem-passagem" });

    expect(
      within(screen.getByRole("group", { name: "Setor" })).getByRole("button", {
        name: other.name,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Turno")).toBeInTheDocument();
    expect(
      within(screen.getByLabelText("Turno")).getByRole("option", {
        name: "Turno Outro",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Turno Manhã")).not.toBeInTheDocument();
    expect(sector.id).not.toBe(other.id);
  });

  it("sem nenhuma passagem no período: estado vazio com a dica", async () => {
    const { sector } = await seed();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", sectorId: sector.id }),
    );

    await renderHistory({ situacao: "corrigida" });

    expect(
      screen.getByText("Nenhuma passagem neste período."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Mude o período ou os filtros para ver mais."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Paginação" }),
    ).not.toBeInTheDocument();
  });

  it("a filtragem de turno e de situação chega às linhas", async () => {
    const { sector, morning, ana } = await seed();
    const night = await insertShift(db, {
      sectorId: sector.id,
      name: "Turno Noite",
      startsAt: "22:00",
      endsAt: "06:00",
      createdAt: LONG_AGO,
    });
    await insertHandover(db, {
      sectorId: sector.id,
      shiftId: night.id,
      operationalDate: "2026-11-20",
      status: "delivered",
      deliveredBy: ana.id,
      deliveredAt: new Date("2026-11-21T09:00:00Z"),
    });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", sectorId: sector.id }),
    );

    await renderHistory({ turno: morning.id, situacao: "sem-passagem" });

    const items = screen.getAllByRole("listitem");
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item).toHaveTextContent("Turno Manhã");
      expect(item).toHaveTextContent("Sem passagem");
    }
  });

  it("paginação: 50 por página e os filtros e o setor seguem nos links", async () => {
    const { sector } = await seed();
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    // 1 turno antigo × 93 dias (o máximo) = 93 linhas "sem passagem" (2 páginas).
    await renderHistory({
      setor: sector.id,
      periodo: "intervalo",
      de: "2026-08-21",
      ate: "2026-11-21",
      situacao: "sem-passagem",
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(50);
    const nav = screen.getByRole("navigation", { name: "Paginação" });
    expect(within(nav).getByText("Página 1 de 2")).toBeInTheDocument();
    const href = within(nav).getByRole("link", { name: "Próxima" });
    const url = new URL(href.getAttribute("href") ?? "", "http://x");
    expect(url.pathname).toBe("/passagens");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      periodo: "intervalo",
      de: "2026-08-21",
      ate: "2026-11-21",
      situacao: "sem-passagem",
      setor: sector.id,
      pagina: "2",
    });
  });

  it("página fora do intervalo é clampada: nunca lista vazia por engano", async () => {
    const { sector } = await seed();
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", sectorId: sector.id }),
    );

    await renderHistory({ pagina: "99", periodo: "30" });

    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(0);
  });

  it("operador com setor inativo vê o aviso e nenhuma lista", async () => {
    const parado = await insertSector(db, "Setor Parado", { active: false });
    mocks.requireUser.mockResolvedValue(
      authzOf({ role: "operator", sectorId: parado.id }),
    );

    await renderHistory();

    expect(screen.getByText("Seu setor está inativo.")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("admin sem setor ativo vê o estado vazio com link para Setores", async () => {
    await insertSector(db, "Setor Parado", { active: false });
    mocks.requireUser.mockResolvedValue(authzOf({ role: "admin" }));

    await renderHistory();

    expect(screen.getByText("Nenhum setor ativo.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Setores" }),
    ).toHaveAttribute("href", "/admin/setores");
  });
});
```

- [ ] **Step 6: Run the component tests to verify they fail**

Run: `bun run test -- src/components/passagens/HistoryRowItem.test.tsx src/components/passagens/HistoryFilters.test.tsx src/components/passagens/HandoverHistory.test.tsx`
Expected: FAIL nos três arquivos com `Failed to resolve import "./HistoryRowItem"` (idem `./HistoryFilters` e `./HandoverHistory`; são testes `.tsx`, projeto dom).

- [ ] **Step 7: Write `HistoryRowItem`**

Create `src/components/passagens/HistoryRowItem.tsx`:
```tsx
import Link from "next/link";

import { AdminListRow } from "@/components/admin/AdminListRow";
import { HandoverStatusBadge } from "@/components/passagens/HandoverStatusBadge";
import { buttonVariants } from "@/components/ui/button";
import type { HistoryRow } from "@/features/handovers/history";
import { formatDateBR, formatTimeBR } from "@/features/handovers/saoPaulo";
import { handoverHref, newHandoverHref } from "@/features/handovers/urls";

// Uma linha do histórico. `sectorParam` é o que o admin está vendo no `?setor=`
// (id ou "todos"); o operador não tem seletor e passa `null`. O setor da linha,
// não o valor "todos", é o que vai no link de "Entregar turno".
export function HistoryRowItem({
  row,
  showSector,
  sectorParam,
}: {
  row: HistoryRow;
  showSector: boolean;
  sectorParam: string | null;
}) {
  const date = formatDateBR(row.operationalDate);

  const details: string[] = [];
  if (showSector) details.push(row.sectorName);
  if (row.deliveredByName !== null && row.deliveredAt !== null) {
    details.push(
      `Entregue por ${row.deliveredByName} às ${formatTimeBR(row.deliveredAt)}`,
    );
  }

  let action: { href: string; label: string; ariaLabel: string };
  if (row.handoverId !== null) {
    action = {
      href: handoverHref(row.handoverId),
      label: "Abrir",
      ariaLabel: `Abrir passagem de ${row.shiftName} em ${date}`,
    };
  } else {
    const label = row.hasDraft ? "Continuar passagem" : "Entregar turno";
    action = {
      href: newHandoverHref(
        {
          sectorId: row.sectorId,
          shiftId: row.shiftId,
          operationalDate: row.operationalDate,
        },
        sectorParam === null ? undefined : row.sectorId,
      ),
      label,
      ariaLabel: `${label} de ${row.shiftName} em ${date}`,
    };
  }

  return (
    <AdminListRow
      title={
        <>
          <span className="tabular-nums">{date}</span> · {row.shiftName}
        </>
      }
      subtitle={details.length > 0 ? details.join(" · ") : undefined}
      badges={
        <HandoverStatusBadge
          situation={row.situation}
          confirmedByName={row.confirmedByName}
          corrected={row.corrected}
        />
      }
      actions={
        <Link
          href={action.href}
          aria-label={action.ariaLabel}
          className={buttonVariants({
            variant: row.handoverId === null ? "default" : "outline",
          })}
        >
          {action.label}
        </Link>
      }
    />
  );
}
```

- [ ] **Step 8: Write `HistoryFilters`**

Create `src/components/passagens/HistoryFilters.tsx`:
```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SelectField } from "@/components/admin/SelectField";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  buildHistoryHref,
  type HistoryFilters as Filters,
  type HistoryPeriod,
  type HistorySituationFilter,
} from "@/features/handovers/historyFilters";
import type { ShiftChoice } from "@/features/handovers/types";

const PERIOD_OPTIONS: readonly { value: HistoryPeriod; label: string }[] = [
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "range", label: "Intervalo" },
];

const SITUATION_OPTIONS: readonly {
  value: HistorySituationFilter;
  label: string;
}[] = [
  { value: "all", label: "Todas" },
  { value: "awaiting", label: "Aguardando" },
  { value: "confirmed", label: "Confirmada" },
  { value: "unconfirmed", label: "Não confirmada" },
  { value: "missing", label: "Sem passagem" },
  { value: "corrected", label: "Corrigida" },
];

const ALL_SHIFTS = "all";

function isPeriod(value: string): value is HistoryPeriod {
  return PERIOD_OPTIONS.some((option) => option.value === value);
}

function isSituation(value: string): value is HistorySituationFilter {
  return SITUATION_OPTIONS.some((option) => option.value === value);
}

// Filtros do histórico, controlados. Os valores iniciais vêm da URL já
// interpretada no servidor, então nunca começam em branco. "Aplicar filtros"
// monta a URL (volta à página 1); "Limpar filtros" é um link.
export function HistoryFilters({
  filters,
  shifts,
  sectorParam,
}: {
  filters: Filters;
  shifts: readonly ShiftChoice[];
  sectorParam: string | null;
}) {
  const router = useRouter();
  const [period, setPeriod] = useState<HistoryPeriod>(filters.period);
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  const [shiftId, setShiftId] = useState(filters.shiftId ?? ALL_SHIFTS);
  const [situation, setSituation] = useState<HistorySituationFilter>(
    filters.situation,
  );

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(
      buildHistoryHref(
        {
          period,
          from,
          to,
          shiftId: shiftId === ALL_SHIFTS ? null : shiftId,
          situation,
        },
        sectorParam === null ? {} : { sector: sectorParam },
      ),
    );
  }

  const clearHref =
    sectorParam === null
      ? "/passagens"
      : `/passagens?setor=${encodeURIComponent(sectorParam)}`;

  return (
    <form
      onSubmit={apply}
      aria-label="Filtros do histórico"
      className="flex flex-col gap-4 rounded-lg border bg-card p-3 text-card-foreground"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          label="Período"
          value={period}
          onValueChange={(value) => {
            if (isPeriod(value)) setPeriod(value);
          }}
          options={PERIOD_OPTIONS}
        />
        {shifts.length > 0 && (
          <SelectField
            label="Turno"
            value={shiftId}
            onValueChange={setShiftId}
            options={[
              { value: ALL_SHIFTS, label: "Todos os turnos" },
              ...shifts.map((shift) => ({
                value: shift.id,
                label: shift.name,
              })),
            ]}
          />
        )}
        <SelectField
          label="Situação"
          value={situation}
          onValueChange={(value) => {
            if (isSituation(value)) setSituation(value);
          }}
          options={SITUATION_OPTIONS}
        />
        {period === "range" && (
          <>
            <Field>
              <FieldLabel htmlFor="history-from">De</FieldLabel>
              <Input
                id="history-from"
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="history-to">Até</FieldLabel>
              <Input
                id="history-to"
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </Field>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit">Aplicar filtros</Button>
        <Link href={clearHref} className={buttonVariants({ variant: "ghost" })}>
          Limpar filtros
        </Link>
      </div>
    </form>
  );
}
```

- [ ] **Step 9: Write `HandoverHistory` and the page**

Create `src/components/passagens/HandoverHistory.tsx`:
```tsx
import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";
import { HistoryFilters } from "@/components/passagens/HistoryFilters";
import { HistoryRowItem } from "@/components/passagens/HistoryRowItem";
import { SectorPicker } from "@/components/passagens/SectorPicker";
import { db } from "@/db";
import { parsePage } from "@/features/admin/pagination";
import { listActiveSectors } from "@/features/admin/sectors";
import { isAdmin } from "@/features/authz/authz";
import { listHandoverHistory } from "@/features/handovers/history";
import {
  buildHistoryHref,
  parseHistoryFilters,
} from "@/features/handovers/historyFilters";
import { ALL_SECTORS } from "@/features/handovers/limits";
import { loadSector } from "@/features/handovers/loaders";
import { formatDateBR, todayInSaoPaulo } from "@/features/handovers/saoPaulo";
import { resolveHandoverSector } from "@/features/handovers/sectorChoice";
import { readRememberedSector } from "@/features/handovers/sectorCookie";
import { listActiveShifts } from "@/features/handovers/targets";
import { requireUser } from "@/lib/auth/session";

type HandoverHistoryProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const TITLE = "Passagens";
const DESCRIPTION =
  "Histórico de passagens de turno, do dia mais recente ao mais antigo.";

function Header() {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{TITLE}</h1>
      <p className="text-muted-foreground">{DESCRIPTION}</p>
    </header>
  );
}

// Os filtros que a Pagination preserva: a mesma URL que buildHistoryHref monta.
function paginationParams(href: string): Record<string, string> {
  return Object.fromEntries(new URL(href, "http://closery.local").searchParams);
}

export async function HandoverHistory({ searchParams }: HandoverHistoryProps) {
  const actor = await requireUser();
  const params = await searchParams;
  const now = new Date();
  const filters = parseHistoryFilters(params, todayInSaoPaulo(now));
  const admin = isAdmin(actor);

  // Admin escolhe o setor (ou "Todos os setores", sem cookie); operador usa o
  // próprio setor e nunca vê o seletor.
  let sectorId: string | null = null;
  let sectorParam: string | null = null;
  let picker: React.ReactNode = null;

  if (admin) {
    const sectors = await listActiveSectors(db);
    const selection = resolveHandoverSector(
      sectors,
      { url: params.setor, cookie: await readRememberedSector() },
      { allowAll: true },
    );
    if (selection.kind === "none") {
      return (
        <div className="flex flex-col gap-6">
          <Header />
          <EmptyState
            title="Nenhum setor ativo."
            description="Cadastre ou reative um setor para usar a passagem de turno."
            action={{ label: "Ir para Setores", href: "/admin/setores" }}
          />
        </div>
      );
    }
    sectorId = selection.kind === "sector" ? selection.sector.id : null;
    sectorParam =
      selection.kind === "sector" ? selection.sector.id : ALL_SECTORS;
    picker = (
      <SectorPicker
        sectors={sectors}
        selectedId={sectorParam}
        path="/passagens"
        allowAll
      />
    );
  } else {
    const own = actor.sectorId
      ? await loadSector(db, actor, actor.sectorId)
      : null;
    if (!own?.active) {
      return (
        <div className="flex flex-col gap-6">
          <Header />
          <EmptyState
            title="Seu setor está inativo."
            description="Peça a um administrador para reativá-lo."
          />
        </div>
      );
    }
    sectorId = own.id;
  }

  const [history, shifts] = await Promise.all([
    listHandoverHistory(
      db,
      actor,
      { filters, sectorId, page: parsePage(params.pagina) },
      now,
    ),
    sectorId === null ? Promise.resolve([]) : listActiveShifts(db, sectorId),
  ]);

  const extras = sectorParam === null ? {} : { sector: sectorParam };
  const showSector = admin && sectorId === null;

  return (
    <div className="flex flex-col gap-6">
      <Header />
      {picker}
      <HistoryFilters
        filters={filters}
        shifts={shifts}
        sectorParam={sectorParam}
      />
      <p className="text-sm text-muted-foreground">
        Período:{" "}
        <span className="tabular-nums">
          {formatDateBR(filters.from)} a {formatDateBR(filters.to)}
        </span>
      </p>
      {history.rows.length === 0 ? (
        <EmptyState
          title="Nenhuma passagem neste período."
          description="Mude o período ou os filtros para ver mais."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {history.rows.map((row) => (
            <HistoryRowItem
              key={row.key}
              row={row}
              showSector={showSector}
              sectorParam={sectorParam}
            />
          ))}
        </ul>
      )}
      <Pagination
        page={history.page}
        pageCount={history.pageCount}
        pathname="/passagens"
        params={paginationParams(buildHistoryHref(filters, extras))}
      />
    </div>
  );
}
```

Create `src/app/(app)/passagens/page.tsx`:
```tsx
import type { Metadata } from "next";
import { Suspense } from "react";

import { HandoverHistory } from "@/components/passagens/HandoverHistory";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Passagens" };

// A leitura da sessão e do banco vive dentro do <Suspense> (Cache Components).
export default function HandoversHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <HandoverHistory searchParams={searchParams} />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-80 max-w-full" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </div>
  );
}
```

- [ ] **Step 10: Raise the page guard to 12 pages**

LER `src/app/appPagesAuth.test.ts`. Duas mudanças:

(1) Em `it("encontra as páginas do grupo", …)` troque `toBeGreaterThanOrEqual(9)` por `toBeGreaterThanOrEqual(12)`.

(2) No `it("inclui a página de cada rota de /passagens")` (criado na Tarefa 8 e estendido na 9), acrescente `"passagens/page.tsx",` como **primeiro** item da lista. Ao final a lista fica:
```ts
    for (const route of [
      "passagens/page.tsx",
      "passagens/nova/page.tsx",
      "passagens/[id]/page.tsx",
    ]) {
      expect(routes).toContain(route);
    }
```

- [ ] **Step 11: Register the three components in `ui-registry.md`**

LER `.context/ui-registry.md` e inserir, imediatamente **antes** da linha `## 3. Componentes de domínio — \`src/features/<domínio>/components\``, o bloco abaixo (se a Tarefa 7 já criou o cabeçalho `### Passagem de turno — …`, não o repita: só acrescente as três entradas depois das dela):
```markdown
### Passagem de turno — `src/components/passagens/*` (Fase 3)

### HandoverHistory
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HandoverHistory.tsx` (server, async)
- **Propósito:** conteúdo de `/passagens`: o histórico de passagens, do dia mais recente ao mais antigo.
- **Como funciona:** chama `requireUser()`, interpreta os filtros da URL (`parseHistoryFilters`, dia de hoje em São Paulo) e lê `listHandoverHistory` (50 por página, `?pagina=` clampada). Operador usa o próprio setor e nunca vê o seletor; admin vê o `SectorPicker` com "Todos os setores" (que não grava cookie) e o setor vem de `?setor=`, do cookie ou do primeiro ativo. Ordem na tela: título, seletor (admin), `HistoryFilters`, "Período: dd/mm/aaaa a dd/mm/aaaa", lista de `HistoryRowItem` (ou o estado vazio "Nenhuma passagem neste período.") e `Pagination` com os filtros e o setor preservados. Setor inativo (operador) ou nenhum setor ativo (admin) mostram `EmptyState`.
- **Usa:** `HistoryFilters`, `HistoryRowItem`, `SectorPicker`, `EmptyState`, `Pagination`, `listHandoverHistory`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 10).

### HistoryFilters
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HistoryFilters.tsx`
- **Propósito:** filtros do histórico (período, turno, situação) que vivem na URL.
- **Como funciona:** `"use client"`; formulário controlado que nunca começa em branco (os valores vêm da URL já interpretada: 7 dias, todos os turnos, todas as situações). `SelectField` "Período" (Últimos 7 dias, Últimos 30 dias, Intervalo), "Turno" (só quando há turnos do setor: some em "Todos os setores"), "Situação" e, no Intervalo, `De` e `Até` (`type="date"`, já preenchidos com o período atual). "Aplicar filtros" navega com `router.push(buildHistoryHref(…))` (volta à página 1 e preserva o setor do admin); "Limpar filtros" é um `<Link>` para `/passagens` (preserva só `?setor=`).
- **Usa:** `SelectField`, `Field`, `Input`, `Button`, `buttonVariants`, `buildHistoryHref`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 10).

### HistoryRowItem
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HistoryRowItem.tsx` (server-safe)
- **Propósito:** uma linha do histórico: o dia, o turno, quem entregou e a situação.
- **Como funciona:** reaproveita `AdminListRow`. Título `dd/mm/aaaa · {turno}` (data com `tabular-nums`); subtítulo com o setor (só quando `showSector`) e "Entregue por {nome} às {HH:mm}" (ausente em "sem passagem"); `HandoverStatusBadge` com o selo "Corrigida" quando há correção. Link da linha: "Abrir" (`aria-label` "Abrir passagem de {turno} em {data}") para a passagem; em "sem passagem" o link é "Entregar turno" ou, se há rascunho, "Continuar passagem", para o turno e o dia daquela linha (o setor da linha vai em `?setor=` só para o admin).
- **Usa:** `AdminListRow`, `HandoverStatusBadge`, `buttonVariants`, `handoverHref`, `newHandoverHref`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 10).
```

- [ ] **Step 12: Run the tests to verify they pass**

Run: `bunx biome check --write src` e depois `bun run test -- src/features/handovers/historyUrl.test.ts src/components/passagens/HistoryRowItem.test.tsx src/components/passagens/HistoryFilters.test.tsx src/components/passagens/HandoverHistory.test.tsx src/app/appPagesAuth.test.ts`
Expected: PASS (os 4 arquivos desta tarefa somam 34 testes: 8 + 8 + 9 + 9; mais o `appPagesAuth.test.ts`, que passa a exigir 12 páginas e ganha 1 teste).

- [ ] **Step 13: Run the gates**

Run: `bun run check-types && bun run lint && bun run test`
Expected: tipos limpos, `Checked N files … No fixes applied.` e suíte verde. (Sob carga o Vitest pode reclamar de "Timeout waiting for worker to respond"; rode de novo com a máquina ociosa antes de investigar.)

- [ ] **Step 14: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-10.txt` (texto exato abaixo) e rode:
```bash
git add src/features/handovers/historyUrl.test.ts src/components/passagens/HistoryRowItem.tsx src/components/passagens/HistoryRowItem.test.tsx src/components/passagens/HistoryFilters.tsx src/components/passagens/HistoryFilters.test.tsx src/components/passagens/HandoverHistory.tsx src/components/passagens/HandoverHistory.test.tsx "src/app/(app)/passagens/page.tsx" src/app/appPagesAuth.test.ts .context/ui-registry.md
git commit -F .git/sdd/msg-task-10.txt
```
Mensagem:
```text
feat(passagens): histórico de passagens com filtros na URL

Página /passagens com situação de cada turno (aguardando, confirmada, não
confirmada, sem passagem) e selo Corrigida, filtros de período, turno e
situação que vivem na URL, seletor de setor do admin com "Todos os setores",
link para entregar ou continuar o turno sem passagem e paginação que preserva
os filtros. O guarda de páginas passa a exigir 12 páginas.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

---

### Task 11: Editar antes da confirmação e corrigir com motivo (`?editar=1`)

**Files:**
- Create: `src/components/passagens/CorrectionForm.tsx`
- Modify: `src/components/passagens/HandoverDetail.tsx` (criado na Tarefa 9; trata `?editar=1`; LER antes)
- Modify: `src/app/(app)/passagens/actions.ts` (acrescenta `correctHandoverAction`; LER antes)
- Modify: `.context/ui-registry.md` (bloco novo `CorrectionForm` e histórico do `HandoverDetail`)
- Test: `src/components/passagens/CorrectionForm.test.tsx`
- Test: `src/components/passagens/HandoverDetail.edit.test.tsx`
- Test: `src/app/(app)/passagens/correctAction.test.ts`

**Interfaces:**
- Consumes (pelo contrato; Tarefas 1 a 9):
  - `getHandoverFormStateById(db: Db, actor: Authz, id: string): Promise<AdminResult<{ state: HandoverFormState }>>` e o tipo `HandoverFormState` de `@/features/handovers/formState` (Tarefa 4). Para a entregue o `mode` é `"edit"` (quem entregou ou admin) e para a confirmada é `"correction"` (só admin); sem permissão é `null`.
  - `correctHandover(db: Db, actor: Authz, input: CorrectionInput, now: Date): Promise<AdminResult<{ changes: number }>>` de `@/features/handovers/correction` (Tarefa 5): `FORBIDDEN` para operador do setor, `NOT_FOUND` para outro setor, `NOT_CONFIRMED`, `NO_CHANGES`, `INVALID_INPUT` em `reason`.
  - `correctHandoverSchema`, `runHandoverAction` (Tarefa 3); `HANDOVER_NOT_FOUND_MESSAGE` de `messages.ts`; `REASON_MAX_LENGTH`, `MAX_DAYS_BACK` de `limits.ts`; `addDays`, `todayInSaoPaulo` de `saoPaulo.ts`; `handoverHref` de `urls.ts` (Tarefa 2).
  - `HandoverFields(props: { controls; stock; values: FieldValues; onChange; onCommit; disabled?; canManageCatalog; itemsHref })` de `@/components/passagens/HandoverFields` (Tarefa 8). Os testes desta tarefa dependem dos nomes acessíveis do contrato: caixas de texto `Ocorrências do turno` e `Fica para o próximo turno`, contador `Quantidade de {nome}`, botões `Aumentar {nome}` e `Adicionar observação em {nome}`, campo `Observação de {nome}`.
  - `HandoverForm(props: { state: HandoverFormState & { mode: FormMode }; shifts; today; minDate; sectorParam; canManageCatalog })` de `@/components/passagens/HandoverForm` (Tarefa 8): no modo `edit` mostra os campos, o indicador de salvamento e o link "Ver resumo", sem cabeçalho de troca nem "Entregar turno", e salva por `saveHandoverFieldAction`.
  - `HandoverDetail`, `SummaryItemList`, `CorrectionsTimeline` e `confirmHandoverAction` da Tarefa 9; `useAdminAction`, `firstFieldErrors`, `FieldErrors`, `INVALID_INPUT_MESSAGE`.
- Produces (Tarefa 12 usa pelo texto da tela):
  - `correctHandoverAction(input: unknown): Promise<AdminResult<{ changes: number }>>` em `src/app/(app)/passagens/actions.ts`.
  - `CorrectionForm(props: { state: HandoverFormState & { mode: "correction" } })` (client).
  - `HandoverDetail` passa a tratar `?editar=1` (mesma rota, sem rota nova, F3-16).

- [ ] **Step 1: Ler o que já existe**

Leia `src/components/passagens/HandoverDetail.tsx` (Tarefa 9) e `src/app/(app)/passagens/actions.ts` (Tarefas 8 e 9) e confirme que `HandoverForm.tsx`, `HandoverFields.tsx` e `src/features/handovers/formState.ts` existem.

Run: `ls src/components/passagens/HandoverForm.tsx src/components/passagens/HandoverFields.tsx src/features/handovers/formState.ts`
Expected: os três caminhos são listados.

- [ ] **Step 2: Write the failing test (correctHandoverAction)**

Crie `src/app/(app)/passagens/correctAction.test.ts` (projeto `node`, PGlite real; arquivo próprio para não depender da estrutura do `actions.test.ts` da Tarefa 8):

```ts
import type { PGlite } from "@electric-sql/pglite";
import { asc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { db } from "@/db";
import {
  handover,
  handoverCorrection,
  handoverItem,
} from "@/db/schema/handovers";
import { authzOf } from "../../../../test/authz";
import { resetDb } from "../../../../test/db";
import {
  insertHandover,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../../test/fixtures";
import { correctHandoverAction } from "./actions";

const mocks = vi.hoisted(
  (): {
    requireUser: Mock;
    revalidatePath: Mock;
    client: PGlite | undefined;
  } => ({
    requireUser: vi.fn(),
    revalidatePath: vi.fn(),
    client: undefined,
  }),
);

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});

const REDIRECT = new Error("NEXT_REDIRECT;/entrar");

// Passagem confirmada de Ana (entregou) e Bia (recebeu), com dois itens:
// Rede = 2 (sem nota) e Fita = 10 (nota "Pedir mais").
async function seed() {
  const sector = await insertSector(db, "ULD");
  const shift = await insertShift(db, { sectorId: sector.id, name: "Manhã" });
  const nets = await insertItem(db, {
    sectorId: sector.id,
    name: "Rede de proteção",
    kind: "control",
  });
  const tape = await insertItem(db, {
    sectorId: sector.id,
    name: "Fita adesiva",
    unit: "rolo",
    kind: "stock",
  });
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Bia Teste",
  });
  const admin = await insertUser(db, {
    role: "admin",
    sectorId: null,
    name: "Admin Teste",
  });
  const confirmed = await insertHandover(db, {
    sectorId: sector.id,
    shiftId: shift.id,
    status: "confirmed",
    deliveredBy: ana.id,
    confirmedBy: bia.id,
    occurrencesText: "Chuva",
    nextShiftText: "Conferir redes",
    shiftNameSnapshot: "Manhã",
  });
  await insertHandoverItem(db, {
    handoverId: confirmed.id,
    itemId: nets.id,
    quantity: 2,
    snapshot: true,
  });
  await insertHandoverItem(db, {
    handoverId: confirmed.id,
    itemId: tape.id,
    quantity: 10,
    note: "Pedir mais",
    snapshot: true,
  });
  return {
    sector,
    shift,
    nets,
    tape,
    ana,
    bia,
    admin,
    id: confirmed.id,
    asAdmin: authzOf({ role: "admin", userId: admin.id, name: "Admin Teste" }),
    asOperator: (who: { id: string }) =>
      authzOf({ role: "operator", userId: who.id, sectorId: sector.id }),
  };
}

type World = Awaited<ReturnType<typeof seed>>;

// Estado atual como o formulário o manda, com ajustes por cima.
function input(
  world: World,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: world.id,
    reason: "Contagem errada",
    occurrencesText: "Chuva",
    nextShiftText: "Conferir redes",
    items: [
      { itemId: world.nets.id, quantity: 2, note: "" },
      { itemId: world.tape.id, quantity: 10, note: "Pedir mais" },
    ],
    ...overrides,
  };
}

async function corrections() {
  return db
    .select()
    .from(handoverCorrection)
    .orderBy(asc(handoverCorrection.correctedAt), asc(handoverCorrection.id));
}

async function quantities(id: string) {
  const rows = await db
    .select()
    .from(handoverItem)
    .where(eq(handoverItem.handoverId, id));
  return Object.fromEntries(rows.map((row) => [row.itemId, row.quantity]));
}

describe("correctHandoverAction", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireUser.mockReset();
    mocks.revalidatePath.mockReset();
  });

  it("sem sessão: requireUser redireciona e nada muda", async () => {
    const world = await seed();
    mocks.requireUser.mockRejectedValue(REDIRECT);

    await expect(
      correctHandoverAction(
        input(world, {
          items: [
            { itemId: world.nets.id, quantity: 9, note: "" },
            { itemId: world.tape.id, quantity: 10, note: "Pedir mais" },
          ],
        }),
      ),
    ).rejects.toBe(REDIRECT);

    expect(await corrections()).toHaveLength(0);
    expect((await quantities(world.id))[world.nets.id]).toBe(2);
  });

  describe("permissão negada", () => {
    it("operador do setor: FORBIDDEN, nada muda, nenhuma linha de correção", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asOperator(world.bia));

      const result = await correctHandoverAction(
        input(world, { occurrencesText: "Hackeado" }),
      );

      expect(result).toMatchObject({
        ok: false,
        code: "FORBIDDEN",
        message: "Só um administrador pode corrigir uma passagem confirmada.",
      });
      const [row] = await db
        .select()
        .from(handover)
        .where(eq(handover.id, world.id));
      expect(row?.occurrencesText).toBe("Chuva");
      expect(await corrections()).toHaveLength(0);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("quem entregou também não corrige a confirmada", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asOperator(world.ana));

      const result = await correctHandoverAction(input(world));

      expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    });

    it("operador de outro setor: NOT_FOUND (não revela que existe)", async () => {
      const world = await seed();
      const other = await insertSector(db, "Outro");
      const stranger = await insertUser(db, {
        role: "operator",
        sectorId: other.id,
      });
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "operator", userId: stranger.id, sectorId: other.id }),
      );

      const result = await correctHandoverAction(input(world));

      expect(result).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
        message: "Passagem não encontrada. Atualize a página.",
      });
      expect(await corrections()).toHaveLength(0);
    });
  });

  describe("admin corrige", () => {
    it("muda texto, quantidade e nota: uma linha por campo, com motivo, quem e quando", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(
        input(world, {
          occurrencesText: "Chuva e vento",
          items: [
            { itemId: world.nets.id, quantity: 5, note: "" },
            { itemId: world.tape.id, quantity: 10, note: "" },
          ],
        }),
      );

      expect(result).toMatchObject({ ok: true, changes: 3 });
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)", "layout");
      const rows = await corrections();
      expect(
        rows.map((row) => [row.field, row.oldValue, row.newValue]).sort(),
      ).toEqual(
        [
          ["occurrences_text", "Chuva", "Chuva e vento"],
          ["item_quantity", "2", "5"],
          ["item_note", "Pedir mais", ""],
        ].sort(),
      );
      for (const row of rows) {
        expect(row).toMatchObject({
          handoverId: world.id,
          reason: "Contagem errada",
          correctedBy: world.admin.id,
        });
        expect(row.correctedAt).toBeInstanceOf(Date);
      }
      expect(rows.find((row) => row.field === "item_quantity")?.itemId).toBe(
        world.nets.id,
      );
      const [current] = await db
        .select()
        .from(handover)
        .where(eq(handover.id, world.id));
      expect(current).toMatchObject({
        occurrencesText: "Chuva e vento",
        status: "confirmed",
        updatedBy: world.admin.id,
      });
      expect((await quantities(world.id))[world.nets.id]).toBe(5);
      const [tape] = await db
        .select()
        .from(handoverItem)
        .where(eq(handoverItem.itemId, world.tape.id));
      expect(tape?.note).toBeNull();
    });

    it("só o texto do próximo turno: uma linha só", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(
        input(world, { nextShiftText: "Nada pendente" }),
      );

      expect(result).toMatchObject({ ok: true, changes: 1 });
      expect((await corrections()).map((row) => row.field)).toEqual([
        "next_shift_text",
      ]);
    });

    it("motivo com espaços nas pontas é guardado sem eles", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await correctHandoverAction(
        input(world, { reason: "  Digitei errado  ", nextShiftText: "x" }),
      );

      expect((await corrections())[0]?.reason).toBe("Digitei errado");
    });

    it("corrigir duas vezes encadeia o valor antigo", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);
      const withNets = (quantity: number) => [
        { itemId: world.nets.id, quantity, note: "" },
        { itemId: world.tape.id, quantity: 10, note: "Pedir mais" },
      ];

      await correctHandoverAction(input(world, { items: withNets(5) }));
      await correctHandoverAction(
        input(world, { reason: "Outra vez", items: withNets(7) }),
      );

      const rows = (await corrections()).filter(
        (row) => row.field === "item_quantity",
      );
      expect(rows.map((row) => [row.oldValue, row.newValue])).toEqual([
        ["2", "5"],
        ["5", "7"],
      ]);
      expect((await quantities(world.id))[world.nets.id]).toBe(7);
    });

    it("item de nota nula ganha nota: antigo vazio, novo o texto", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await correctHandoverAction(
        input(world, {
          items: [
            { itemId: world.nets.id, quantity: 2, note: "  Rasgada  " },
            { itemId: world.tape.id, quantity: 10, note: "Pedir mais" },
          ],
        }),
      );

      const rows = await corrections();
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        field: "item_note",
        oldValue: "",
        newValue: "Rasgada",
        itemId: world.nets.id,
      });
    });
  });

  describe("recusas do domínio", () => {
    it("nada mudou: NO_CHANGES, zero linhas e sem revalidar", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(input(world));

      expect(result).toMatchObject({
        ok: false,
        code: "NO_CHANGES",
        message:
          "Nada foi alterado. Mude algum campo para registrar a correção.",
      });
      expect(await corrections()).toHaveLength(0);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("passagem só entregue: NOT_CONFIRMED (edita-se direto, sem motivo)", async () => {
      const world = await seed();
      const delivered = await insertHandover(db, {
        sectorId: world.sector.id,
        shiftId: world.shift.id,
        operationalDate: "2026-11-18",
        status: "delivered",
        deliveredBy: world.ana.id,
      });
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(
        input(world, { id: delivered.id, items: [] }),
      );

      expect(result).toMatchObject({ ok: false, code: "NOT_CONFIRMED" });
      expect(await corrections()).toHaveLength(0);
    });

    it("item que a passagem não tem: NOT_FOUND e nada é gravado", async () => {
      const world = await seed();
      const stranger = await insertItem(db, {
        sectorId: world.sector.id,
        name: "Item novo",
      });
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(
        input(world, {
          occurrencesText: "Mudou",
          items: [{ itemId: stranger.id, quantity: 4, note: "" }],
        }),
      );

      expect(result).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
        message: "Item não encontrado. Atualize a página.",
      });
      expect(await corrections()).toHaveLength(0);
      const [row] = await db
        .select()
        .from(handover)
        .where(eq(handover.id, world.id));
      expect(row?.occurrencesText).toBe("Chuva");
    });

    it("passagem que não existe: NOT_FOUND", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(
        input(world, { id: "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b" }),
      );

      expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    });
  });

  describe("entrada inválida (nada é gravado)", () => {
    it.each([
      [
        "motivo vazio",
        { reason: "" },
        "reason",
        "Informe o motivo da correção.",
      ],
      [
        "motivo só com espaços",
        { reason: "   \n " },
        "reason",
        "Informe o motivo da correção.",
      ],
      [
        "motivo com 501 caracteres",
        { reason: "a".repeat(501) },
        "reason",
        "O motivo pode ter no máximo 500 caracteres.",
      ],
      [
        "texto com mais de 2.000 caracteres",
        { occurrencesText: "a".repeat(2001) },
        "occurrencesText",
        "O texto pode ter no máximo 2.000 caracteres.",
      ],
    ])("%s", async (_name, overrides, field, message) => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(input(world, overrides));

      expect(result).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { [field]: message },
      });
      expect(await corrections()).toHaveLength(0);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it.each([
      ["negativa", -1],
      ["decimal", 1.5],
      ["acima do máximo", 100_000],
    ])("quantidade %s", async (_name, quantity) => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(
        input(world, {
          items: [{ itemId: world.nets.id, quantity, note: "" }],
        }),
      );

      expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
      expect((await quantities(world.id))[world.nets.id]).toBe(2);
    });

    it("item repetido", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(
        input(world, {
          items: [
            { itemId: world.nets.id, quantity: 3, note: "" },
            { itemId: world.nets.id, quantity: 4, note: "" },
          ],
        }),
      );

      expect(result).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { items: "Item repetido. Atualize a página." },
      });
    });

    it("id que não é uuid", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(input(world, { id: "abc" }));

      expect(result).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { id: "Registro inválido. Atualize a página." },
      });
    });

    it("limite: motivo com exatamente 500 caracteres passa", async () => {
      const world = await seed();
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      const result = await correctHandoverAction(
        input(world, { reason: "a".repeat(500), nextShiftText: "novo" }),
      );

      expect(result).toMatchObject({ ok: true, changes: 1 });
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `bun run test -- "src/app/(app)/passagens/correctAction.test.ts"`
Expected: FAIL (23 testes) com `TypeError: correctHandoverAction is not a function`

- [ ] **Step 4: Write minimal implementation (correctHandoverAction)**

Em `src/app/(app)/passagens/actions.ts` acrescente estes imports (o Biome reordena; se `@/features/handovers/schemas` já é importado, só acrescente `correctHandoverSchema` ao bloco existente):

```ts
import { correctHandover } from "@/features/handovers/correction";
import { correctHandoverSchema } from "@/features/handovers/schemas";
```

e acrescente ao **fim** do arquivo:

```ts
export async function correctHandoverAction(
  input: unknown,
): Promise<AdminResult<{ changes: number }>> {
  const actor = await requireUser();
  return runHandoverAction({
    actor,
    schema: correctHandoverSchema,
    input,
    revalidate: true,
    run: ({ db, now, actor, input }) => correctHandover(db, actor, input, now),
  });
}
```

Depois rode `bunx biome check --write "src/app/(app)/passagens/actions.ts"`.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test -- "src/app/(app)/passagens/correctAction.test.ts"`
Expected: PASS (23 testes)

- [ ] **Step 6: Write the failing test (CorrectionForm)**

Crie `src/components/passagens/CorrectionForm.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { fail, ok } from "@/features/admin/result";
import type { HandoverFormState } from "@/features/handovers/formState";
import { CorrectionForm } from "./CorrectionForm";

const HANDOVER_ID = "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b";
const NETS_ID = "7a2e3b4c-5d6e-4f70-8b9c-1d2e3f4a5b6c";
const TAPE_ID = "8b3f4c5d-6e7f-4081-9cad-2e3f4a5b6c7d";

const mocks = vi.hoisted(() => ({
  correctHandoverAction: vi.fn(),
  push: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/passagens/actions", () => ({
  correctHandoverAction: mocks.correctHandoverAction,
  saveHandoverFieldAction: vi.fn(),
  deliverHandoverAction: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

type CorrectionState = HandoverFormState & { mode: "correction" };

function makeState(overrides: Partial<CorrectionState> = {}): CorrectionState {
  return {
    ref: {
      sectorId: "9c4a5d6e-7f80-4192-8dbe-3f4a5b6c7d8e",
      shiftId: "ad5b6e7f-8091-42a3-9ecf-4a5b6c7d8e9f",
      operationalDate: "2026-11-19",
    },
    handoverId: HANDOVER_ID,
    status: "confirmed",
    sectorName: "ULD",
    shiftName: "Manhã",
    occurrencesText: "Chuva forte",
    nextShiftText: "Conferir as redes",
    controls: [
      {
        itemId: NETS_ID,
        name: "Rede de proteção",
        unit: "unidade",
        kind: "control",
        quantity: 2,
        note: "",
      },
    ],
    stock: [
      {
        itemId: TAPE_ID,
        name: "Fita adesiva",
        unit: "rolo",
        kind: "stock",
        quantity: 10,
        note: "Pedir mais",
      },
    ],
    saved: null,
    deliveredByName: "Ana Teste",
    deliveredAt: new Date("2026-11-19T17:05:00Z"),
    mode: "correction",
    ...overrides,
  };
}

function setup(state: CorrectionState = makeState()) {
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      <CorrectionForm state={state} />
    </TooltipProvider>,
  );
  return { user };
}

const reasonField = () =>
  screen.getByRole("textbox", { name: "Motivo da correção" });
const occurrencesField = () =>
  screen.getByRole("textbox", { name: "Ocorrências do turno" });
const nextShiftField = () =>
  screen.getByRole("textbox", { name: "Fica para o próximo turno" });
const quantityField = (name: string) =>
  screen.getByRole("textbox", { name: `Quantidade de ${name}` });
const submit = () =>
  screen.getByRole("button", { name: /^Registrar correção$|^Registrando…$/ });

describe("CorrectionForm", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("começa com os valores vigentes, o motivo vazio e o botão com o nome do resultado", () => {
    setup();

    expect(occurrencesField()).toHaveValue("Chuva forte");
    expect(nextShiftField()).toHaveValue("Conferir as redes");
    expect(quantityField("Rede de proteção")).toHaveValue("2");
    expect(quantityField("Fita adesiva")).toHaveValue("10");
    expect(
      screen.getByRole("textbox", { name: "Observação de Fita adesiva" }),
    ).toHaveValue("Pedir mais");
    expect(reasonField()).toHaveValue("");
    expect(reasonField()).toHaveAttribute("maxlength", "500");
    expect(
      screen.getByText("Obrigatório. Aparece na lista de correções."),
    ).toBeInTheDocument();
    expect(submit()).toHaveTextContent("Registrar correção");
    expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute(
      "href",
      `/passagens/${HANDOVER_ID}`,
    );
  });

  it("sem motivo: erro no campo, a action não é chamada e o digitado fica", async () => {
    const { user } = setup();

    await user.type(occurrencesField(), " e granizo");
    await user.click(
      screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
    );
    await user.click(submit());

    expect(
      await screen.findByText("Informe o motivo da correção."),
    ).toBeInTheDocument();
    expect(reasonField()).toHaveAttribute("aria-invalid", "true");
    expect(mocks.correctHandoverAction).not.toHaveBeenCalled();
    expect(occurrencesField()).toHaveValue("Chuva forte e granizo");
    expect(quantityField("Rede de proteção")).toHaveValue("3");
  });

  it("motivo só com espaços também é recusado", async () => {
    const { user } = setup();

    await user.type(reasonField(), "     ");
    await user.click(submit());

    expect(
      await screen.findByText("Informe o motivo da correção."),
    ).toBeInTheDocument();
    expect(mocks.correctHandoverAction).not.toHaveBeenCalled();
  });

  it("envia o estado completo desejado e o motivo; sucesso mostra o toast e volta ao resumo", async () => {
    mocks.correctHandoverAction.mockResolvedValue(ok({ changes: 2 }));
    const { user } = setup();

    await user.click(
      screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
    );
    await user.clear(nextShiftField());
    await user.type(nextShiftField(), "Nada pendente");
    await user.type(reasonField(), "Contagem errada");
    await user.click(submit());

    await waitFor(() =>
      expect(mocks.push).toHaveBeenCalledWith(`/passagens/${HANDOVER_ID}`),
    );
    expect(mocks.correctHandoverAction).toHaveBeenCalledWith({
      id: HANDOVER_ID,
      reason: "Contagem errada",
      occurrencesText: "Chuva forte",
      nextShiftText: "Nada pendente",
      items: [
        { itemId: NETS_ID, quantity: 3, note: "" },
        { itemId: TAPE_ID, quantity: 10, note: "Pedir mais" },
      ],
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Correção registrada.");
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("a observação do item entra na correção", async () => {
    mocks.correctHandoverAction.mockResolvedValue(ok({ changes: 1 }));
    const { user } = setup();

    await user.click(
      screen.getByRole("button", {
        name: "Adicionar observação em Rede de proteção",
      }),
    );
    await user.type(
      screen.getByRole("textbox", { name: "Observação de Rede de proteção" }),
      "Rasgada",
    );
    await user.type(reasonField(), "Faltou anotar");
    await user.click(submit());

    await waitFor(() => expect(mocks.correctHandoverAction).toHaveBeenCalled());
    expect(mocks.correctHandoverAction.mock.calls[0]?.[0]).toMatchObject({
      items: [
        { itemId: NETS_ID, quantity: 2, note: "Rasgada" },
        { itemId: TAPE_ID, quantity: 10, note: "Pedir mais" },
      ],
    });
  });

  it("NO_CHANGES: mostra a mensagem, não navega e mantém tudo", async () => {
    mocks.correctHandoverAction.mockResolvedValue(
      fail(
        "NO_CHANGES",
        "Nada foi alterado. Mude algum campo para registrar a correção.",
      ),
    );
    const { user } = setup();

    await user.type(reasonField(), "Só conferindo");
    await user.click(submit());

    expect(
      await screen.findByText(
        "Nada foi alterado. Mude algum campo para registrar a correção.",
      ),
    ).toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(reasonField()).toHaveValue("Só conferindo");
    expect(submit()).toBeEnabled();
  });

  it("erro do servidor no motivo aparece no campo", async () => {
    mocks.correctHandoverAction.mockResolvedValue(
      fail("INVALID_INPUT", "O motivo pode ter no máximo 500 caracteres.", {
        reason: "O motivo pode ter no máximo 500 caracteres.",
      }),
    );
    const { user } = setup();

    await user.type(reasonField(), "Motivo");
    await user.click(submit());

    expect(
      await screen.findByText("O motivo pode ter no máximo 500 caracteres."),
    ).toBeInTheDocument();
    expect(reasonField()).toHaveAttribute("aria-invalid", "true");
    expect(reasonField()).toHaveValue("Motivo");
  });

  it("recusa de domínio (FORBIDDEN) aparece inline e o digitado fica", async () => {
    mocks.correctHandoverAction.mockResolvedValue(
      fail(
        "FORBIDDEN",
        "Só um administrador pode corrigir uma passagem confirmada.",
      ),
    );
    const { user } = setup();

    await user.click(
      screen.getByRole("button", { name: "Aumentar Fita adesiva" }),
    );
    await user.type(reasonField(), "Tentativa");
    await user.click(submit());

    expect(
      await screen.findByText(
        "Só um administrador pode corrigir uma passagem confirmada.",
      ),
    ).toBeInTheDocument();
    expect(quantityField("Fita adesiva")).toHaveValue("11");
    expect(reasonField()).toHaveValue("Tentativa");
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("exceção da action vira a mensagem genérica, sem vazar o texto", async () => {
    mocks.correctHandoverAction.mockRejectedValue(new Error("rede caiu"));
    const { user } = setup();

    await user.type(reasonField(), "Motivo");
    await user.click(submit());

    expect(
      await screen.findByText("Não foi possível concluir. Tente de novo."),
    ).toBeInTheDocument();
    expect(screen.queryByText("rede caiu")).not.toBeInTheDocument();
  });

  it("enquanto registra: 'Registrando…' desabilitado e um envio só", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.correctHandoverAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { user } = setup();

    await user.type(reasonField(), "Motivo");
    await user.click(submit());

    await waitFor(() => expect(submit()).toHaveTextContent("Registrando…"));
    expect(submit()).toBeDisabled();
    await user.click(submit());
    expect(mocks.correctHandoverAction).toHaveBeenCalledTimes(1);

    finish(ok({ changes: 1 }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
  });

  it("sem itens no setor: corrige só os textos", async () => {
    mocks.correctHandoverAction.mockResolvedValue(ok({ changes: 1 }));
    const { user } = setup(makeState({ controls: [], stock: [] }));

    await user.clear(occurrencesField());
    await user.type(occurrencesField(), "Sem ocorrências");
    await user.type(reasonField(), "Texto errado");
    await user.click(submit());

    await waitFor(() => expect(mocks.correctHandoverAction).toHaveBeenCalled());
    expect(mocks.correctHandoverAction.mock.calls[0]?.[0]).toMatchObject({
      occurrencesText: "Sem ocorrências",
      items: [],
    });
  });

  it("sem id de passagem (estado impossível): recusa sem chamar a action", async () => {
    const { user } = setup(makeState({ handoverId: null }));

    await user.type(reasonField(), "Motivo");
    await user.click(submit());

    expect(
      await screen.findByText("Passagem não encontrada. Atualize a página."),
    ).toBeInTheDocument();
    expect(mocks.correctHandoverAction).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute(
      "href",
      "/passagens",
    );
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `bun run test -- src/components/passagens/CorrectionForm.test.tsx`
Expected: FAIL com `Failed to resolve import "./CorrectionForm" from "src/components/passagens/CorrectionForm.test.tsx". Does the file exist?`

- [ ] **Step 8: Write minimal implementation (CorrectionForm)**

Crie `src/components/passagens/CorrectionForm.tsx`. O formulário reaproveita `HandoverFields` com estado local (sem salvamento automático: nada é gravado antes do envio) e manda o estado **completo** desejado; quem calcula o que mudou é o servidor (F3-7):

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState } from "react";

import { correctHandoverAction } from "@/app/(app)/passagens/actions";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  type FieldErrors,
  INVALID_INPUT_MESSAGE,
} from "@/features/admin/result";
import { firstFieldErrors } from "@/features/admin/schemas";
import type { HandoverFormState } from "@/features/handovers/formState";
import { REASON_MAX_LENGTH } from "@/features/handovers/limits";
import { HANDOVER_NOT_FOUND_MESSAGE } from "@/features/handovers/messages";
import { correctHandoverSchema } from "@/features/handovers/schemas";
import type { FieldChange, FieldValues } from "@/features/handovers/types";
import { handoverHref } from "@/features/handovers/urls";

import { HandoverFields } from "./HandoverFields";

function initialValues(state: HandoverFormState): FieldValues {
  const lines = [...state.controls, ...state.stock];
  return {
    occurrencesText: state.occurrencesText,
    nextShiftText: state.nextShiftText,
    quantities: Object.fromEntries(
      lines.map((line) => [line.itemId, line.quantity]),
    ),
    notes: Object.fromEntries(lines.map((line) => [line.itemId, line.note])),
  };
}

function applyChange(values: FieldValues, change: FieldChange): FieldValues {
  switch (change.field) {
    case "occurrences":
      return { ...values, occurrencesText: change.value };
    case "nextShift":
      return { ...values, nextShiftText: change.value };
    case "quantity":
      return {
        ...values,
        quantities: { ...values.quantities, [change.itemId]: change.value },
      };
    case "note":
      return {
        ...values,
        notes: { ...values.notes, [change.itemId]: change.value },
      };
  }
}

// Correção de passagem confirmada (D13): sem salvamento automático. Tudo vai
// de uma vez, com o motivo, e é o servidor que calcula o que mudou.
export function CorrectionForm({
  state,
}: {
  state: HandoverFormState & { mode: "correction" };
}) {
  const uid = useId();
  const router = useRouter();
  const { pending, run } = useAdminAction();
  const [values, setValues] = useState(() => initialValues(state));
  const [reason, setReason] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const lines = [...state.controls, ...state.stock];
  const backHref = state.handoverId
    ? handoverHref(state.handoverId)
    : "/passagens";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFieldErrors({});
    setFormError(null);

    const id = state.handoverId;
    if (id === null) {
      setFormError(HANDOVER_NOT_FOUND_MESSAGE);
      return;
    }

    const input = {
      id,
      reason,
      occurrencesText: values.occurrencesText,
      nextShiftText: values.nextShiftText,
      items: lines.map((line) => ({
        itemId: line.itemId,
        quantity: values.quantities[line.itemId] ?? line.quantity,
        note: values.notes[line.itemId] ?? "",
      })),
    };
    const parsed = correctHandoverSchema.safeParse(input);
    if (!parsed.success) {
      const errors = firstFieldErrors(parsed.error);
      setFieldErrors(errors);
      setFormError(
        errors.reason
          ? null
          : (parsed.error.issues[0]?.message ?? INVALID_INPUT_MESSAGE),
      );
      return;
    }

    const result = await run(() => correctHandoverAction(input), {
      showError: false,
      success: "Correção registrada.",
    });
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.fieldErrors?.reason ? null : result.message);
      return;
    }
    router.push(handoverHref(id));
  }

  const reasonError = fieldErrors.reason;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <HandoverFields
          controls={state.controls}
          stock={state.stock}
          values={values}
          onChange={(change) =>
            setValues((current) => applyChange(current, change))
          }
          onCommit={() => {}}
          disabled={pending}
          canManageCatalog={false}
          itemsHref={`/admin/itens?setor=${state.ref.sectorId}`}
        />

        <Field data-invalid={reasonError ? true : undefined}>
          <FieldLabel htmlFor={`${uid}-reason`}>Motivo da correção</FieldLabel>
          <FieldDescription>
            Obrigatório. Aparece na lista de correções.
          </FieldDescription>
          <Textarea
            id={`${uid}-reason`}
            maxLength={REASON_MAX_LENGTH}
            value={reason}
            disabled={pending}
            onChange={(event) => setReason(event.target.value)}
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={reasonError ? `${uid}-reason-error` : undefined}
          />
          {reasonError && (
            <FieldError id={`${uid}-reason-error`}>{reasonError}</FieldError>
          )}
        </Field>

        {formError && <FieldError>{formError}</FieldError>}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Registrando…" : "Registrar correção"}
          </Button>
          <Link
            href={backHref}
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Cancelar
          </Link>
        </div>
      </FieldGroup>
    </form>
  );
}
```

- [ ] **Step 9: Run test to verify it passes**

Run: `bun run test -- src/components/passagens/CorrectionForm.test.tsx`
Expected: PASS (12 testes)

- [ ] **Step 10: Write the failing test (HandoverDetail com ?editar=1)**

Crie `src/components/passagens/HandoverDetail.edit.test.tsx` (arquivo próprio; o `HandoverDetail.test.tsx` da Tarefa 9 não muda):

```tsx
import type { PGlite } from "@electric-sql/pglite";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { db } from "@/db";
import { ok } from "@/features/admin/result";
import type { Authz } from "@/features/authz/authz";
import { authzOf } from "../../../test/authz";
import { spDate } from "../../../test/clock";
import { resetDb } from "../../../test/db";
import {
  insertHandover,
  insertHandoverItem,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { HandoverDetail } from "./HandoverDetail";

const mocks = vi.hoisted(
  (): {
    requireUser: Mock;
    saveHandoverFieldAction: Mock;
    client: PGlite | undefined;
  } => ({
    requireUser: vi.fn(),
    saveHandoverFieldAction: vi.fn(),
    client: undefined,
  }),
);

vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT;${url}`);
  },
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});
vi.mock("@/app/(app)/passagens/actions", () => ({
  saveHandoverFieldAction: mocks.saveHandoverFieldAction,
  deliverHandoverAction: vi.fn(),
  confirmHandoverAction: vi.fn(),
  correctHandoverAction: vi.fn(),
}));

// Setor ULD, turno Manhã, Rede (controle) e Fita (estoque), Ana e Bia.
async function seed() {
  const sector = await insertSector(db, "ULD");
  const shift = await insertShift(db, {
    sectorId: sector.id,
    name: "Manhã",
    startsAt: "06:00",
    endsAt: "14:00",
  });
  const nets = await insertItem(db, {
    sectorId: sector.id,
    name: "Rede de proteção",
    kind: "control",
  });
  const tape = await insertItem(db, {
    sectorId: sector.id,
    name: "Fita adesiva",
    unit: "rolo",
    kind: "stock",
  });
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
    name: "Bia Teste",
  });
  const admin = await insertUser(db, {
    role: "admin",
    sectorId: null,
    name: "Admin Teste",
  });
  const actor = (who: { id: string }, name: string): Authz =>
    authzOf({ role: "operator", userId: who.id, sectorId: sector.id, name });
  return {
    sector,
    shift,
    nets,
    tape,
    ana,
    bia,
    admin,
    asAna: actor(ana, "Ana Teste"),
    asBia: actor(bia, "Bia Teste"),
    asAdmin: authzOf({ role: "admin", userId: admin.id, name: "Admin Teste" }),
  };
}

type World = Awaited<ReturnType<typeof seed>>;

async function addLines(world: World, handoverId: string) {
  await insertHandoverItem(db, {
    handoverId,
    itemId: world.nets.id,
    quantity: 3,
    snapshot: true,
  });
  await insertHandoverItem(db, {
    handoverId,
    itemId: world.tape.id,
    quantity: 0,
    snapshot: true,
  });
}

async function delivered(world: World) {
  const created = await insertHandover(db, {
    sectorId: world.sector.id,
    shiftId: world.shift.id,
    status: "delivered",
    deliveredBy: world.ana.id,
    deliveredAt: spDate("2026-11-20", "14:05"),
    occurrencesText: "Chuva forte",
    nextShiftText: "Conferir as redes",
    shiftNameSnapshot: "Manhã",
  });
  await addLines(world, created.id);
  return created.id;
}

async function confirmed(world: World) {
  const created = await insertHandover(db, {
    sectorId: world.sector.id,
    shiftId: world.shift.id,
    operationalDate: "2026-11-19",
    status: "confirmed",
    deliveredBy: world.ana.id,
    confirmedBy: world.bia.id,
    occurrencesText: "Chuva forte",
    shiftNameSnapshot: "Manhã",
  });
  await addLines(world, created.id);
  return created.id;
}

async function renderDetail(id: string, search: Record<string, string>) {
  const user = userEvent.setup();
  render(
    <TooltipProvider>
      {await HandoverDetail({ id, searchParams: Promise.resolve(search) })}
    </TooltipProvider>,
  );
  return { user };
}

const EDIT = { editar: "1" };
const isSummary = () =>
  screen.getByRole("heading", { level: 1, name: "Passagem de turno" });
const isEditPage = () =>
  screen.getByRole("heading", { level: 1, name: "Corrigir passagem" });

describe("HandoverDetail com ?editar=1", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireUser.mockReset();
    mocks.saveHandoverFieldAction.mockReset();
  });

  describe("passagem entregue (edição direta com salvamento automático)", () => {
    it("quem entregou vê o formulário com o que já foi salvo", async () => {
      const world = await seed();
      const id = await delivered(world);
      mocks.requireUser.mockResolvedValue(world.asAna);

      await renderDetail(id, EDIT);

      isEditPage();
      expect(
        screen.getByText(
          "As alterações valem na hora. Quem recebe vê a versão atual.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("ULD · Manhã · 20/11/2026")).toBeInTheDocument();
      expect(
        screen.getByRole("textbox", { name: "Ocorrências do turno" }),
      ).toHaveValue("Chuva forte");
      expect(
        screen.getByRole("textbox", { name: "Fica para o próximo turno" }),
      ).toHaveValue("Conferir as redes");
      expect(
        screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
      ).toHaveValue("3");
      expect(
        screen.getByRole("textbox", { name: "Quantidade de Fita adesiva" }),
      ).toHaveValue("0");
      expect(screen.getByRole("link", { name: "Ver resumo" })).toHaveAttribute(
        "href",
        `/passagens/${id}`,
      );
      expect(
        screen.queryByRole("button", { name: "Entregar turno" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("textbox", { name: "Motivo da correção" }),
      ).not.toBeInTheDocument();
    });

    it("mexer num campo salva na hora, pela mesma action do rascunho", async () => {
      const world = await seed();
      const id = await delivered(world);
      mocks.requireUser.mockResolvedValue(world.asAna);
      mocks.saveHandoverFieldAction.mockResolvedValue(
        ok({ handoverId: id, savedAt: new Date(), savedByName: "Ana Teste" }),
      );
      const { user } = await renderDetail(id, EDIT);

      await user.click(
        screen.getByRole("button", { name: "Aumentar Rede de proteção" }),
      );

      await waitFor(() =>
        expect(mocks.saveHandoverFieldAction).toHaveBeenCalledWith({
          sectorId: world.sector.id,
          shiftId: world.shift.id,
          operationalDate: "2026-11-20",
          field: "quantity",
          itemId: world.nets.id,
          value: 4,
        }),
      );
    });

    it("o admin também edita a entregue", async () => {
      const world = await seed();
      const id = await delivered(world);
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await renderDetail(id, EDIT);

      isEditPage();
      expect(
        screen.getByRole("textbox", { name: "Ocorrências do turno" }),
      ).toBeInTheDocument();
    });

    it("outro operador do setor cai no resumo, sem formulário", async () => {
      const world = await seed();
      const id = await delivered(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id, EDIT);

      isSummary();
      expect(
        screen.queryByRole("textbox", { name: "Ocorrências do turno" }),
      ).not.toBeInTheDocument();
    });

    it("sem o parâmetro (ou com outro valor) mostra o resumo", async () => {
      const world = await seed();
      const id = await delivered(world);
      mocks.requireUser.mockResolvedValue(world.asAna);

      await renderDetail(id, {});
      isSummary();
    });

    it("editar=0 também mostra o resumo", async () => {
      const world = await seed();
      const id = await delivered(world);
      mocks.requireUser.mockResolvedValue(world.asAna);

      await renderDetail(id, { editar: "0" });
      isSummary();
    });
  });

  describe("passagem confirmada (correção com motivo, só admin)", () => {
    it("admin vê o formulário de correção com os valores vigentes", async () => {
      const world = await seed();
      const id = await confirmed(world);
      mocks.requireUser.mockResolvedValue(world.asAdmin);

      await renderDetail(id, EDIT);

      isEditPage();
      expect(
        screen.getByText(
          "Esta passagem já foi confirmada. A correção fica registrada com o motivo.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("textbox", { name: "Motivo da correção" }),
      ).toHaveValue("");
      expect(
        screen.getByRole("button", { name: "Registrar correção" }),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute(
        "href",
        `/passagens/${id}`,
      );
      expect(
        screen.getByRole("textbox", { name: "Ocorrências do turno" }),
      ).toHaveValue("Chuva forte");
      expect(
        screen.getByRole("textbox", { name: "Quantidade de Rede de proteção" }),
      ).toHaveValue("3");
    });

    it("quem recebeu (operador) cai no resumo", async () => {
      const world = await seed();
      const id = await confirmed(world);
      mocks.requireUser.mockResolvedValue(world.asBia);

      await renderDetail(id, EDIT);

      isSummary();
      expect(
        screen.queryByRole("textbox", { name: "Motivo da correção" }),
      ).not.toBeInTheDocument();
    });

    it("quem entregou (operador) cai no resumo: depois da confirmação só o admin corrige", async () => {
      const world = await seed();
      const id = await confirmed(world);
      mocks.requireUser.mockResolvedValue(world.asAna);

      await renderDetail(id, EDIT);

      isSummary();
      expect(
        screen.queryByRole("textbox", { name: "Ocorrências do turno" }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "Registrar correção" }),
      ).not.toBeInTheDocument();
    });

    it("operador de outro setor: notFound mesmo com ?editar=1", async () => {
      const world = await seed();
      const id = await confirmed(world);
      const other = await insertSector(db, "Outro");
      const stranger = await insertUser(db, {
        role: "operator",
        sectorId: other.id,
      });
      mocks.requireUser.mockResolvedValue(
        authzOf({ role: "operator", userId: stranger.id, sectorId: other.id }),
      );

      await expect(
        HandoverDetail({ id, searchParams: Promise.resolve(EDIT) }),
      ).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    });
  });

  it("rascunho com ?editar=1 continua redirecionando para a nova passagem", async () => {
    const world = await seed();
    const draft = await insertHandover(db, {
      sectorId: world.sector.id,
      shiftId: world.shift.id,
      operationalDate: "2026-11-18",
    });
    mocks.requireUser.mockResolvedValue(world.asAdmin);

    await expect(
      HandoverDetail({ id: draft.id, searchParams: Promise.resolve(EDIT) }),
    ).rejects.toThrow("NEXT_REDIRECT;/passagens/nova?turno=");
  });
});
```

- [ ] **Step 11: Run test to verify it fails**

Run: `bun run test -- src/components/passagens/HandoverDetail.edit.test.tsx`
Expected: FAIL (4 de 11 testes: os que esperam o formulário) com `Unable to find an accessible element with the role "heading" and name "Corrigir passagem"`; os 7 que esperam o resumo já passam.

- [ ] **Step 12: Modify HandoverDetail para tratar ?editar=1**

Em `src/components/passagens/HandoverDetail.tsx`, aplique estas cinco substituições (leia o arquivo antes; os trechos `old` existem uma única vez na versão da Tarefa 9).

(a) Import do `ReactNode`. Troque

```tsx
import { notFound, redirect } from "next/navigation";
```

por

```tsx
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
```

(b) Imports de `authz`, `formState`, `limits` e o fuso. Troque

```tsx
import { idSchema } from "@/features/admin/schemas";
import {
  formatDateBR,
  formatTimeBR,
  saoPauloParts,
} from "@/features/handovers/saoPaulo";
```

por

```tsx
import { idSchema } from "@/features/admin/schemas";
import { isAdmin } from "@/features/authz/authz";
import { getHandoverFormStateById } from "@/features/handovers/formState";
import { MAX_DAYS_BACK } from "@/features/handovers/limits";
import {
  addDays,
  formatDateBR,
  formatTimeBR,
  saoPauloParts,
  todayInSaoPaulo,
} from "@/features/handovers/saoPaulo";
```

(c) Imports dos dois formulários. Troque

```tsx
import { ConfirmReceiptForm } from "./ConfirmReceiptForm";
import { CorrectionsTimeline } from "./CorrectionsTimeline";
import { HandoverStatusBadge } from "./HandoverStatusBadge";
```

por

```tsx
import { ConfirmReceiptForm } from "./ConfirmReceiptForm";
import { CorrectionForm } from "./CorrectionForm";
import { CorrectionsTimeline } from "./CorrectionsTimeline";
import { HandoverForm } from "./HandoverForm";
import { HandoverStatusBadge } from "./HandoverStatusBadge";
```

(d) Moldura da edição e assinatura. Troque

```tsx
export async function HandoverDetail({ id }: HandoverDetailProps) {
```

por

```tsx
function EditShell({
  description,
  context,
  children,
}: {
  description: string;
  context: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          Corrigir passagem
        </h1>
        <p className="text-muted-foreground">{description}</p>
        <p className="text-sm text-muted-foreground">{context}</p>
      </header>
      {children}
    </div>
  );
}

export async function HandoverDetail({
  id,
  searchParams,
}: HandoverDetailProps) {
```

(e) O ramo `?editar=1`, logo antes do resumo. Troque

```tsx
  const { capabilities } = summary;
```

por

```tsx
  // ?editar=1: o formulário só aparece para quem pode (quem entregou e o admin
  // na entregue; só o admin, com motivo, na confirmada). Quem não pode cai no
  // resumo, sem aviso de que a opção existe.
  const params = await searchParams;
  if (params.editar === "1") {
    const editable = await getHandoverFormStateById(db, actor, id);
    if (editable.ok) {
      const { state } = editable;
      const context = `${state.sectorName} · ${state.shiftName} · ${formatDateBR(state.ref.operationalDate)}`;
      if (state.mode === "edit") {
        const today = todayInSaoPaulo(new Date());
        return (
          <EditShell
            description="As alterações valem na hora. Quem recebe vê a versão atual."
            context={context}
          >
            <HandoverForm
              key={`${state.ref.shiftId}:${state.ref.operationalDate}`}
              state={{ ...state, mode: state.mode }}
              shifts={[]}
              today={today}
              minDate={addDays(today, -MAX_DAYS_BACK)}
              sectorParam={null}
              canManageCatalog={isAdmin(actor)}
            />
          </EditShell>
        );
      }
      if (state.mode === "correction") {
        return (
          <EditShell
            description="Esta passagem já foi confirmada. A correção fica registrada com o motivo."
            context={context}
          >
            <CorrectionForm state={{ ...state, mode: state.mode }} />
          </EditShell>
        );
      }
    }
  }

  const { capabilities } = summary;
```

Depois rode `bunx biome check --write src/components/passagens/HandoverDetail.tsx`.

- [ ] **Step 13: Run tests to verify they pass**

Run: `bun run test -- src/components/passagens/HandoverDetail.edit.test.tsx src/components/passagens/HandoverDetail.test.tsx`
Expected: PASS (37 testes: 11 desta tarefa e os 26 do resumo, que continuam verdes)

- [ ] **Step 14: Registrar no ui-registry**

Em `.context/ui-registry.md` faça duas mudanças.

(a) No bloco `### HandoverDetail`, troque a linha `- **Usa:**` e a linha `- **Histórico:**` (as duas últimas do bloco) por:

````markdown
- **Usa:** `getHandoverSummary`, `getHandoverFormStateById`, `SummaryItemList`, `CorrectionsTimeline`, `ConfirmReceiptForm`, `HandoverForm`, `CorrectionForm`, `HandoverStatusBadge`, `buttonVariants`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 9). 2026-11-21 — Fase 3 (Tarefa 11): `?editar=1` troca o resumo pelo formulário quando a pessoa pode editar (título "Corrigir passagem"): `HandoverForm` em modo `edit` para a entregue (quem entregou e admin, salvamento automático) e `CorrectionForm` para a confirmada (só admin); quem não pode cai no resumo.
````

(b) Imediatamente antes da linha que começa com `## 3. Componentes de domínio` acrescente:

````markdown
### CorrectionForm
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/CorrectionForm.tsx`
- **Propósito:** o admin corrige uma passagem já confirmada, com motivo e rastro (D13).
- **Como funciona:** `"use client"`; reaproveita `HandoverFields` com estado local (sem salvamento automático: nada é gravado até o envio) e acrescenta `Textarea` "Motivo da correção" (obrigatório, 500 caracteres); "Registrar correção" (pendente: "Registrando…") valida com `correctHandoverSchema` e manda o estado completo desejado; o servidor calcula o diff. Sucesso = toast "Correção registrada." e volta ao resumo (que mostra o selo "Corrigida"); recusa (motivo, `NO_CHANGES`, `FORBIDDEN`) aparece inline, sem toast, e nada do que foi digitado se perde. Link "Cancelar" volta ao resumo.
- **Usa:** `HandoverFields`, `useAdminAction`, `Button`, `Field*`, `Textarea`, `sonner`, `useRouter`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 11).
````

(Os blocos vão sem a cerca de código; ela acima é só para delimitar o texto.)

- [ ] **Step 15: Formatar e rodar as verificações da tarefa**

Run: `bunx biome check --write src/components/passagens "src/app/(app)/passagens" && bun run check-types && bun run lint && bun run test`
Expected: Biome sem erros; `check-types` e `lint` sem saída de erro; Vitest com todos os arquivos passando (inclusive os 46 testes novos desta tarefa: 23 + 12 + 11).

- [ ] **Step 16: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-11.txt` (texto exato abaixo) e rode:

```bash
git add src/components/passagens/CorrectionForm.tsx src/components/passagens/CorrectionForm.test.tsx \
  src/components/passagens/HandoverDetail.tsx src/components/passagens/HandoverDetail.edit.test.tsx \
  "src/app/(app)/passagens/actions.ts" "src/app/(app)/passagens/correctAction.test.ts" \
  .context/ui-registry.md
git commit -F .git/sdd/msg-task-11.txt
```

Mensagem:

```text
feat(passagens): edição da entregue e correção com motivo em ?editar=1

Quem entregou e o admin editam a passagem entregue com o mesmo
salvamento automático. Na confirmada só o admin vê o CorrectionForm
(motivo obrigatório, NO_CHANGES inline, digitado preservado) e
correctHandoverAction grava uma linha de correção por campo. Operador
na action recebe FORBIDDEN; quem não pode cai no resumo.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 12: E2E da passagem (Playwright)

**Files:**
- Modify: `e2e/db.ts` (LER antes: imports, reexportação das fixtures e três funções novas no fim)
- Modify: `test/e2eDb.test.ts` (LER antes: acrescenta os testes dos helpers novos)
- Create: `e2e/passagem.spec.ts`
- Test: `test/e2eDb.test.ts`, `e2e/passagem.spec.ts`

**Interfaces:**
- Consumes: tudo o que as Tarefas 1 a 11 entregam pelo contrato: fixtures `insertSector`, `insertShift`, `insertItem`, `insertUser`, `insertInvite`, `insertHandover`, `insertHandoverItem`; `todayInSaoPaulo`; as rotas `/`, `/passagens`, `/passagens/nova` e `/passagens/[id]`; os textos da seção "Textos de interface"; `playwright.config.ts` e `e2e/start-db.ts` (sem mudança; as migrações do `./drizzle` já trazem a `0003`).
- Produces (`e2e/db.ts`; os dois primeiros são os do contrato, o terceiro e os campos de texto em `handoverOf` são acréscimos):
  - `handoverOf(db: Db, ref: HandoverRef): Promise<{ id: string; status: HandoverStatus; deliveredBy: string | null; confirmedBy: string | null; occurrencesText: string; nextShiftText: string } | null>`
  - `countCorrections(db: Db, handoverId: string): Promise<number>`
  - `userIdByEmail(db: Db, email: string): Promise<string>` (lança `Pessoa {email} não encontrada.`)
  - reexporta `insertShift, insertItem, insertHandover, insertHandoverItem` de `../test/fixtures`.

- [ ] **Step 1: Write the failing tests of the new E2E helpers**

LER `test/e2eDb.test.ts`. Troque os três imports de `../e2e/db`, `./db` e `./fixtures` por:
```ts
import {
  countCorrections,
  countSessionsByEmail,
  handoverOf,
  userIdByEmail,
} from "../e2e/db";
import { createTestDb, resetDb, type TestDb } from "./db";
import {
  insertHandover,
  insertHandoverCorrection,
  insertSector,
  insertSession,
  insertShift,
  insertUser,
} from "./fixtures";
```
(mantenha o import de `type { PGlite }`, o de `vitest` e o resto do arquivo) e acrescente no fim do arquivo:
```ts
describe("helpers da passagem no E2E", () => {
  async function seed() {
    const sector = await insertSector(db, "Setor Teste");
    const shift = await insertShift(db, { sectorId: sector.id });
    const ana = await insertUser(db, {
      role: "operator",
      sectorId: sector.id,
      email: "ana@example.test",
    });
    const bia = await insertUser(db, { role: "operator", sectorId: sector.id });
    return { sector, shift, ana, bia };
  }

  it("userIdByEmail devolve o id e lança para e-mail desconhecido", async () => {
    const { ana } = await seed();
    expect(await userIdByEmail(db, "ana@example.test")).toBe(ana.id);
    await expect(userIdByEmail(db, "ninguem@example.test")).rejects.toThrow(
      "Pessoa ninguem@example.test não encontrada.",
    );
  });

  it("handoverOf acha a passagem pela tripla e devolve null quando não existe", async () => {
    const { sector, shift, ana, bia } = await seed();
    const ref = {
      sectorId: sector.id,
      shiftId: shift.id,
      operationalDate: "2026-11-20",
    };
    expect(await handoverOf(db, ref)).toBeNull();

    const created = await insertHandover(db, {
      sectorId: sector.id,
      shiftId: shift.id,
      operationalDate: "2026-11-20",
      status: "confirmed",
      deliveredBy: ana.id,
      confirmedBy: bia.id,
      nextShiftText: "Conferir o lacre",
    });
    expect(await handoverOf(db, ref)).toEqual({
      id: created.id,
      status: "confirmed",
      deliveredBy: ana.id,
      confirmedBy: bia.id,
      occurrencesText: "",
      nextShiftText: "Conferir o lacre",
    });
    expect(
      await handoverOf(db, { ...ref, operationalDate: "2026-11-19" }),
    ).toBeNull();
  });

  it("countCorrections conta só as correções daquela passagem", async () => {
    const { sector, shift, ana, bia } = await seed();
    const first = await insertHandover(db, {
      sectorId: sector.id,
      shiftId: shift.id,
      operationalDate: "2026-11-20",
      status: "confirmed",
      deliveredBy: ana.id,
      confirmedBy: bia.id,
    });
    const second = await insertHandover(db, {
      sectorId: sector.id,
      shiftId: shift.id,
      operationalDate: "2026-11-19",
      status: "confirmed",
      deliveredBy: ana.id,
      confirmedBy: bia.id,
    });
    await insertHandoverCorrection(db, {
      handoverId: first.id,
      field: "occurrences_text",
      correctedBy: bia.id,
    });
    await insertHandoverCorrection(db, {
      handoverId: first.id,
      field: "next_shift_text",
      correctedBy: bia.id,
    });

    expect(await countCorrections(db, first.id)).toBe(2);
    expect(await countCorrections(db, second.id)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test -- test/e2eDb.test.ts`
Expected: FAIL (3 falham, 4 passam, de 7) com `TypeError: userIdByEmail is not a function` e, nos outros dois, `TypeError: handoverOf is not a function` e `TypeError: countCorrections is not a function`: no Vitest um export nomeado ausente vira `undefined` e só falha na chamada (os 4 testes antigos continuam passando).

- [ ] **Step 3: Write the helpers in `e2e/db.ts`**

LER `e2e/db.ts`. Quatro mudanças:

(1) Primeira linha: `import { count, eq } from "drizzle-orm";` vira `import { and, count, eq } from "drizzle-orm";`.

(2) Troque `import { session, user } from "@/db/schema";` por:
```ts
import {
  type HandoverStatus,
  handover,
  handoverCorrection,
  session,
  user,
} from "@/db/schema";
```
e, logo depois de `import type { Db } from "@/db/types";`, acrescente `import type { HandoverRef } from "@/features/handovers/types";`.

(3) Troque a linha `export { insertInvite, insertSector, insertUser } from "../test/fixtures";` por:
```ts
export {
  insertHandover,
  insertHandoverItem,
  insertInvite,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../test/fixtures";
```

(4) No fim do arquivo, acrescente:
```ts

// Id da pessoa pelo e-mail (quem entregou ou confirmou uma passagem).
export async function userIdByEmail(db: Db, email: string): Promise<string> {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email));
  if (!row) throw new Error(`Pessoa ${email} não encontrada.`);
  return row.id;
}

// A passagem da tripla setor + turno + dia, como o banco a guarda.
export async function handoverOf(
  db: Db,
  ref: HandoverRef,
): Promise<{
  id: string;
  status: HandoverStatus;
  deliveredBy: string | null;
  confirmedBy: string | null;
  occurrencesText: string;
  nextShiftText: string;
} | null> {
  const [row] = await db
    .select({
      id: handover.id,
      status: handover.status,
      deliveredBy: handover.deliveredBy,
      confirmedBy: handover.confirmedBy,
      occurrencesText: handover.occurrencesText,
      nextShiftText: handover.nextShiftText,
    })
    .from(handover)
    .where(
      and(
        eq(handover.sectorId, ref.sectorId),
        eq(handover.shiftId, ref.shiftId),
        eq(handover.operationalDate, ref.operationalDate),
      ),
    );
  return row ?? null;
}

export async function countCorrections(
  db: Db,
  handoverId: string,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(handoverCorrection)
    .where(eq(handoverCorrection.handoverId, handoverId));
  return row?.total ?? 0;
}
```

- [ ] **Step 4: Run the helper tests to verify they pass**

Run: `bunx biome check --write e2e test` e depois `bun run test -- test/e2eDb.test.ts`
Expected: PASS (7 testes: 4 antigos + 3 novos).

- [ ] **Step 5: Write the E2E spec**

Notas de projeto (já aplicadas no código): turno `00:00–23:59` e `?turno=&data=` de hoje em São Paulo (F3-14); só o cenário (f) usa o cartão do Início e só com um turno. O Next 16 mantém a página anterior **escondida** ao navegar, e `getByText` também casa texto escondido, então o modo estrito reprova: o helper `text()` filtra `visible: true`; `{ exact: true }` onde um texto contém o outro ("2 rolo" × "12 rolo"). Consultas por papel (`getByRole`) já ignoram o escondido.

Create `e2e/passagem.spec.ts`:
```ts
import { randomUUID } from "node:crypto";

import { test as base, expect, type Page } from "@playwright/test";
import type { Pool } from "pg";

import type { Db } from "@/db/types";
import { todayInSaoPaulo } from "@/features/handovers/saoPaulo";

import {
  buildInviteUrl,
  countCorrections,
  E2E_BASE_URL,
  handoverOf,
  insertHandover,
  insertHandoverItem,
  insertInvite,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
  openE2eDb,
  userIdByEmail,
} from "./db";

const PASSWORD = "senha-de-teste-123";

// Determinismo (F3-14): o servidor do E2E usa o relógio de verdade, então todo
// cenário usa um turno 00:00–23:59 e abre /passagens/nova com ?turno=&data= de
// hoje em São Paulo. Só o cenário (f) passa pelo cartão do Início (que sugere o
// turno pelo relógio) e funciona com um único turno, em qualquer hora.
const SHIFT_START = "00:00";
const SHIFT_END = "23:59";

// Mesma estratégia dos outros specs: o app roda em produção (`next start`) com
// rate limit, então cada teste usa um IP próprio (x-forwarded-for). A base
// aleatória evita colidir com os IPs de auth.spec.ts e cadastros.spec.ts.
const ipPrefix = `10.${Math.floor(Math.random() * 200) + 20}.${Math.floor(Math.random() * 250)}`;
let nextClientIp = 1;

const test = base.extend<{ clientIp: string }>({
  // biome-ignore lint/correctness/noEmptyPattern: o Playwright exige o padrão de desestruturação.
  clientIp: async ({}, use) => {
    await use(`${ipPrefix}.${nextClientIp++}`);
  },
  extraHTTPHeaders: async ({ clientIp }, use) => {
    await use({ "x-forwarded-for": clientIp });
  },
});

let pool: Pool;
let db: Db;

test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});

test.afterAll(async () => {
  await pool.end();
});

// O Next mantém a página anterior escondida na navegação (Activity): getByText
// também casa texto escondido e o modo estrito reprova. Sempre só o visível.
function text(page: Page, ...args: Parameters<Page["getByText"]>) {
  return page.getByText(...args).filter({ visible: true });
}

function unique(): string {
  return randomUUID().slice(0, 8);
}

function uniqueEmail(): string {
  return `e2e-${randomUUID()}@example.com`;
}

async function signUpWithInviteToken(
  page: Page,
  token: string,
  person: { name: string; email: string },
) {
  await page.goto(buildInviteUrl(E2E_BASE_URL, token));
  await expect(
    page.getByRole("heading", { name: "Você foi convidado" }),
  ).toBeVisible();
  await page.getByLabel("Nome").fill(person.name);
  await page.getByLabel("E-mail").fill(person.email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/bem-vindo$/);
}

// Cadastra um operador do setor pelo convite e deixa a sessão aberta no Início.
async function signUpOperator(
  page: Page,
  sectorId: string,
  name: string,
): Promise<string> {
  const email = uniqueEmail();
  const { token } = await insertInvite(db, { role: "operator", sectorId });
  await signUpWithInviteToken(page, token, { name, email });
  await page.getByRole("link", { name: "Agora não" }).click();
  await expect(page).toHaveURL(/\/$/);
  return email;
}

async function signUpAdmin(page: Page, name: string): Promise<void> {
  const { token } = await insertInvite(db, { role: "admin" });
  await signUpWithInviteToken(page, token, { name, email: uniqueEmail() });
  await page.getByRole("link", { name: "Agora não" }).click();
  await expect(page).toHaveURL(/\/$/);
}

// Setor com um turno 00:00–23:59 e três itens: dois de controle e um de estoque.
async function seedSector() {
  const sector = await insertSector(db, `Setor ${unique()}`);
  const shift = await insertShift(db, {
    sectorId: sector.id,
    name: "Turno Dia",
    startsAt: SHIFT_START,
    endsAt: SHIFT_END,
  });
  const net = await insertItem(db, {
    sectorId: sector.id,
    name: "Rede de proteção",
    unit: "rolo",
    kind: "control",
  });
  const tape = await insertItem(db, {
    sectorId: sector.id,
    name: "Fita de arqueação",
    unit: "unidade",
    kind: "control",
  });
  const stretch = await insertItem(db, {
    sectorId: sector.id,
    name: "Stretch",
    unit: "rolo",
    kind: "stock",
  });
  return {
    sector,
    shift,
    net,
    tape,
    stretch,
    today: todayInSaoPaulo(new Date()),
  };
}

function newHandoverPath(data: {
  shift: { id: string };
  today: string;
}): string {
  return `/passagens/nova?turno=${data.shift.id}&data=${data.today}`;
}

const HANDOVER_PATH = /\/passagens\/[0-9a-f-]{36}$/;

// Passagem entregue por `deliveredBy` com uma contagem e os dois textos.
async function seedDeliveredHandover(
  data: Awaited<ReturnType<typeof seedSector>>,
  deliveredBy: string,
  extra: { confirmedBy?: string } = {},
) {
  const status = extra.confirmedBy ? "confirmed" : "delivered";
  const created = await insertHandover(db, {
    sectorId: data.sector.id,
    shiftId: data.shift.id,
    operationalDate: data.today,
    status,
    deliveredBy,
    ...(extra.confirmedBy ? { confirmedBy: extra.confirmedBy } : {}),
    nextShiftText: "Conferir o lacre do ULD 12",
    occurrencesText: "Carga atrasada no portão 3",
    shiftNameSnapshot: "Turno Dia",
  });
  await insertHandoverItem(db, {
    handoverId: created.id,
    itemId: data.net.id,
    quantity: 2,
    note: "Rasgada na ponta",
    snapshot: true,
  });
  await insertHandoverItem(db, {
    handoverId: created.id,
    itemId: data.tape.id,
    quantity: 0,
    snapshot: true,
  });
  await insertHandoverItem(db, {
    handoverId: created.id,
    itemId: data.stretch.id,
    quantity: 12,
    snapshot: true,
  });
  return created;
}

test("(a) operador preenche, recarrega e vê tudo salvo, e entrega o turno", async ({
  page,
}) => {
  const data = await seedSector();
  const email = await signUpOperator(page, data.sector.id, "Ana Teste");

  await page.goto(newHandoverPath(data));
  await expect(
    page.getByRole("heading", { name: "Passagem de turno" }),
  ).toBeVisible();
  // Abrir o formulário não cria nada (GET nunca escreve) e nada começa vazio.
  await expect(page.getByRole("status")).toContainText("Nada salvo ainda.");
  expect(
    await handoverOf(db, {
      sectorId: data.sector.id,
      shiftId: data.shift.id,
      operationalDate: data.today,
    }),
  ).toBeNull();
  const net = page.getByLabel("Quantidade de Rede de proteção");
  await expect(net).toHaveValue("0");
  await expect(
    page.getByRole("button", { name: "Diminuir Rede de proteção" }),
  ).toBeDisabled();

  // Controle: −/+ e observação.
  await page.getByRole("button", { name: "Aumentar Rede de proteção" }).click();
  await page.getByRole("button", { name: "Aumentar Rede de proteção" }).click();
  await page.getByRole("button", { name: "Aumentar Rede de proteção" }).click();
  await page.getByRole("button", { name: "Diminuir Rede de proteção" }).click();
  await expect(net).toHaveValue("2");
  await page
    .getByRole("button", { name: "Adicionar observação em Rede de proteção" })
    .click();
  await page
    .getByLabel("Observação de Rede de proteção")
    .fill("Rasgada na ponta");

  // Estoque: digitado, e o campo vazio ao sair vira 0.
  const stretch = page.getByLabel("Quantidade de Stretch");
  await stretch.fill("12");
  await stretch.blur();
  const tape = page.getByLabel("Quantidade de Fita de arqueação");
  await tape.fill("");
  await tape.blur();
  await expect(tape).toHaveValue("0");

  // Os dois textos.
  await page
    .getByLabel("Ocorrências do turno")
    .fill("Carga atrasada no portão 3");
  const nextShift = page.getByLabel("Fica para o próximo turno");
  await nextShift.fill("Conferir o lacre do ULD 12");
  await nextShift.blur();
  await expect(page.getByRole("status")).toContainText("Salvo às");

  // Salvou de verdade: o banco já tem o rascunho com os textos.
  const ref = {
    sectorId: data.sector.id,
    shiftId: data.shift.id,
    operationalDate: data.today,
  };
  await expect
    .poll(async () => (await handoverOf(db, ref))?.nextShiftText)
    .toBe("Conferir o lacre do ULD 12");
  expect((await handoverOf(db, ref))?.status).toBe("draft");

  // Recarrega: tudo continua lá, e a observação já vem aberta.
  await page.reload();
  await expect(page.getByLabel("Quantidade de Rede de proteção")).toHaveValue(
    "2",
  );
  await expect(page.getByLabel("Observação de Rede de proteção")).toHaveValue(
    "Rasgada na ponta",
  );
  await expect(page.getByLabel("Quantidade de Stretch")).toHaveValue("12");
  await expect(page.getByLabel("Ocorrências do turno")).toHaveValue(
    "Carga atrasada no portão 3",
  );
  await expect(page.getByLabel("Fica para o próximo turno")).toHaveValue(
    "Conferir o lacre do ULD 12",
  );
  await expect(page.getByRole("status")).toContainText("Último salvamento às");

  // Entrega: vai para o resumo, na ordem do briefing.
  await page.getByRole("button", { name: "Entregar turno" }).click();
  await expect(page).toHaveURL(HANDOVER_PATH);
  await expect(text(page, "Aguardando recebimento")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Fica para o próximo turno" }),
  ).toBeVisible();
  await expect(text(page, "Conferir o lacre do ULD 12")).toBeVisible();
  await expect(text(page, "Rasgada na ponta")).toBeVisible();
  await expect(text(page, "Carga atrasada no portão 3")).toBeVisible();
  // O item zerado fica recolhido.
  await expect(text(page, "Demais itens: 0 (1)")).toBeVisible();

  const delivered = await handoverOf(db, ref);
  expect(delivered?.status).toBe("delivered");
  expect(delivered?.deliveredBy).toBe(await userIdByEmail(db, email));
});

test("(b) outra pessoa do setor vê a passagem no Início, lê o resumo e confirma o recebimento", async ({
  page,
}) => {
  const data = await seedSector();
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: data.sector.id,
    name: "Ana Teste",
  });
  const created = await seedDeliveredHandover(data, ana.id);
  const bia = await signUpOperator(page, data.sector.id, "Bia Teste");

  // Início: o cartão no topo, com o que fica para o próximo turno.
  await expect(
    page.getByRole("heading", { name: "Passagem para confirmar" }),
  ).toBeVisible();
  // Âncoras: a mesma frase aparece no cartão "Passagem do meu turno" com
  // ". Aguardando recebimento." no fim, quando o turno sugerido é o de hoje.
  await expect(
    text(page, /^Entregue às \d{2}:\d{2} por Ana Teste$/),
  ).toBeVisible();
  await expect(text(page, "Conferir o lacre do ULD 12")).toBeVisible();
  await page.getByRole("link", { name: "Ver passagem" }).first().click();
  await expect(page).toHaveURL(`/passagens/${created.id}`);

  // Resumo: quem recebe pode confirmar.
  await expect(text(page, "Aguardando recebimento")).toBeVisible();
  await expect(text(page, "Rede de proteção")).toBeVisible();
  await expect(text(page, "2 rolo", { exact: true })).toBeVisible();
  await page
    .getByLabel("Observação do recebimento (opcional)")
    .fill("Tudo conferido");
  await page.getByRole("button", { name: "Confirmar recebimento" }).click();
  await expect(text(page, "Recebimento confirmado.")).toBeVisible();
  await expect(text(page, "Confirmada por Bia Teste")).toBeVisible();
  await expect(
    text(page, "Observação do recebimento: Tudo conferido"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar recebimento" }),
  ).toHaveCount(0);

  const confirmed = await handoverOf(db, {
    sectorId: data.sector.id,
    shiftId: data.shift.id,
    operationalDate: data.today,
  });
  expect(confirmed?.status).toBe("confirmed");
  expect(confirmed?.confirmedBy).toBe(await userIdByEmail(db, bia));

  // Confirmada: o cartão sai do Início.
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Passagem para confirmar" }),
  ).toHaveCount(0);
});

test("(c) quem entregou o turno não vê 'Confirmar recebimento' nem o cartão no Início", async ({
  page,
}) => {
  const data = await seedSector();
  const email = await signUpOperator(page, data.sector.id, "Ana Teste");
  const created = await seedDeliveredHandover(
    data,
    await userIdByEmail(db, email),
  );

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Passagem do meu turno" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Passagem para confirmar" }),
  ).toHaveCount(0);

  await page.goto(`/passagens/${created.id}`);
  await expect(
    text(
      page,
      "Você entregou este turno. Outra pessoa do setor confirma o recebimento.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar recebimento" }),
  ).toHaveCount(0);
  // Quem entregou ainda corrige, até alguém confirmar.
  await expect(page.getByRole("link", { name: "Corrigir" })).toBeVisible();
});

test("(d) operador de outro setor não vê a passagem nem o setor alheio", async ({
  page,
}) => {
  const mine = await seedSector();
  const theirs = await seedSector();
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: theirs.sector.id,
    name: "Ana Teste",
  });
  const created = await seedDeliveredHandover(theirs, ana.id);
  await signUpOperator(page, mine.sector.id, "Caio Teste");

  // A passagem de outro setor é "Página não encontrada", nunca "sem permissão".
  await page.goto(`/passagens/${created.id}`);
  await expect(
    page.getByRole("heading", { name: "Página não encontrada" }),
  ).toBeVisible();
  await expect(text(page, "Conferir o lacre do ULD 12")).toHaveCount(0);

  // Montar a URL de nova passagem com o setor e o turno alheios não funciona:
  // a tela é do setor dele.
  await page.goto(
    `/passagens/nova?turno=${theirs.shift.id}&data=${theirs.today}&setor=${theirs.sector.id}`,
  );
  await expect(
    page.getByRole("heading", { name: "Passagem de turno" }),
  ).toBeVisible();
  await expect(text(page, mine.sector.name)).toBeVisible();
  await expect(text(page, theirs.sector.name)).toHaveCount(0);

  // O histórico também é só do setor dele, e não tem seletor de setor.
  await page.goto(`/passagens?setor=${theirs.sector.id}&situacao=aguardando`);
  await expect(page.getByRole("heading", { name: "Passagens" })).toBeVisible();
  await expect(text(page, /Entregue por Ana Teste/)).toHaveCount(0);
  await expect(page.getByRole("group", { name: "Setor" })).toHaveCount(0);
});

test("(e) admin escolhe o setor, corrige a confirmada com motivo e o histórico mostra 'Corrigida'", async ({
  page,
}) => {
  const data = await seedSector();
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: data.sector.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: data.sector.id,
    name: "Bia Teste",
  });
  const created = await seedDeliveredHandover(data, ana.id, {
    confirmedBy: bia.id,
  });
  // Outro setor ativo, aberto primeiro: clicar no setor já selecionado não faz
  // nada, e sem isso o teste dependeria da ordem alfabética dos nomes.
  const decoy = await insertSector(db, `Setor ${unique()}`);
  await signUpAdmin(page, "Dora Admin");
  await page.goto(`/?setor=${decoy.id}`);

  // O seletor de setor fica no Início; a escolha é lembrada no histórico.
  const picker = page.getByRole("group", { name: "Setor" });
  await expect(
    picker.getByRole("button", { name: decoy.name }),
  ).toHaveAttribute("aria-pressed", "true");
  await picker.getByRole("button", { name: data.sector.name }).click();
  await expect(page).toHaveURL(`/?setor=${data.sector.id}`);
  await expect(
    page
      .getByRole("group", { name: "Setor" })
      .getByRole("button", { name: data.sector.name }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.goto("/passagens");
  await expect(
    page
      .getByRole("group", { name: "Setor" })
      .getByRole("button", { name: data.sector.name }),
  ).toHaveAttribute("aria-pressed", "true");
  const row = page
    .getByRole("main")
    .getByRole("listitem")
    .filter({ hasText: "Confirmada por Bia Teste" });
  await expect(row).toContainText("Entregue por Ana Teste");
  await expect(row).not.toContainText("Corrigida");
  await row.getByRole("link", { name: /^Abrir passagem/ }).click();
  await expect(page).toHaveURL(`/passagens/${created.id}`);

  // Corrigir com motivo: sem o motivo a correção não passa e o digitado fica.
  await page.getByRole("link", { name: "Corrigir com motivo" }).click();
  await expect(
    text(
      page,
      "Esta passagem já foi confirmada. A correção fica registrada com o motivo.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Aumentar Rede de proteção" }).click();
  await page
    .getByLabel("Fica para o próximo turno")
    .fill("Lacre do ULD 12 conferido");
  await page.getByRole("button", { name: "Registrar correção" }).click();
  await expect(text(page, "Informe o motivo da correção.")).toBeVisible();
  await expect(page.getByLabel("Quantidade de Rede de proteção")).toHaveValue(
    "3",
  );
  expect(await countCorrections(db, created.id)).toBe(0);

  await page.getByLabel("Motivo da correção").fill("Contagem errada");
  await page.getByRole("button", { name: "Registrar correção" }).click();
  await expect(text(page, "Correção registrada.")).toBeVisible();
  await expect(page).toHaveURL(`/passagens/${created.id}`);

  // O resumo mostra os valores corrigidos, o selo e a linha do tempo.
  await expect(text(page, "Corrigida", { exact: true })).toBeVisible();
  await expect(text(page, "3 rolo", { exact: true })).toBeVisible();
  await expect(text(page, "Lacre do ULD 12 conferido").first()).toBeVisible();
  await expect(text(page, "Rede de proteção: quantidade")).toBeVisible();
  await expect(text(page, "2 → 3")).toBeVisible();
  await expect(text(page, "Motivo: Contagem errada").first()).toBeVisible();
  expect(await countCorrections(db, created.id)).toBe(2);

  // O histórico também mostra "Corrigida".
  await page.goto("/passagens");
  await expect(
    page
      .getByRole("main")
      .getByRole("listitem")
      .filter({ hasText: "Confirmada por Bia Teste" }),
  ).toContainText("Corrigida");
});

test("(f) o cartão do Início vai de 'Começar passagem' a 'Continuar passagem' depois do primeiro salvamento", async ({
  page,
}) => {
  const data = await seedSector();
  await signUpOperator(page, data.sector.id, "Davi Teste");

  await expect(
    page.getByRole("heading", { name: "Passagem do meu turno" }),
  ).toBeVisible();
  await expect(
    text(page, "Turno sugerido pelo horário de agora."),
  ).toBeVisible();
  await expect(text(page, "Turno Dia")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Continuar passagem" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Começar passagem" }).click();

  await expect(
    page.getByRole("heading", { name: "Passagem de turno" }),
  ).toBeVisible();
  const occurrences = page.getByLabel("Ocorrências do turno");
  await occurrences.fill("Primeiro registro do turno");
  await occurrences.blur();
  await expect(page.getByRole("status")).toContainText("Salvo às");

  // Risco aceito: entre 11:59 e 12:00 (São Paulo) a sugestão troca de dia.
  await page.goto("/");
  await expect(text(page, /Rascunho salvo às/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Começar passagem" }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Continuar passagem" }).click();
  await expect(page.getByLabel("Ocorrências do turno")).toHaveValue(
    "Primeiro registro do turno",
  );
});
```

- [ ] **Step 6: Run only the new spec**

Run: `bunx biome check --write e2e` e depois `bun run test:e2e -- e2e/passagem.spec.ts`
Expected: o Playwright sobe o banco (`pglite-socket pronto`), faz `next build` (cerca de 3 a 6 min na primeira vez) e termina com `6 passed`. Se um cenário reprovar por "strict mode violation", troque o `getByText` por `text(page, …)` (ou acrescente `{ exact: true }`); se reprovar por `heading … not found`, confira se o título do cartão é um `<h2>` (o `CardTitle` do shadcn é um `div`; os cartões do Início devem ter `<h2>` dentro dele).

- [ ] **Step 7: Run the whole E2E suite**

Run: `bun run test:e2e`
Expected: `19 passed` (7 de acesso, 6 de cadastros e 6 de passagem).

- [ ] **Step 8: Run the gates**

Run: `bun run check-types && bun run lint && bun run test`
Expected: tudo verde (`lint` também confere `e2e/`).

- [ ] **Step 9: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-12.txt` e rode:
```bash
git add e2e/db.ts e2e/passagem.spec.ts test/e2eDb.test.ts
git commit -F .git/sdd/msg-task-12.txt
```
Mensagem:
```text
test(e2e): cobre a passagem de turno de ponta a ponta

Seis cenários: operador preenche, recarrega e entrega; outra pessoa confirma
pelo cartão do Início; quem entregou não confirma; operador de outro setor
recebe "Página não encontrada"; admin escolhe o setor, corrige a confirmada com
motivo e o histórico mostra "Corrigida"; o cartão do Início vai de começar a
continuar. Turno 00:00-23:59 e data de hoje na URL para não depender do relógio.
Helpers novos em e2e/db.ts com teste.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 13: Documentação de contexto, pendências, verificação final e walkthrough

**Files:**
- Modify: `test/pendenciasDoc.test.ts` (LER antes: dois testes novos no fim do `describe`)
- Modify: `test/uiRegistryDoc.test.ts` (LER antes: passa a cobrir `src/components/passagens`)
- Modify: `.context/architecture.md`, `.context/library-docs.md`, `.context/progress-tracker.md`, `.context/pendencias.md`, `.context/build-plan.md`, `.context/code-standards.md`, `memory.md` (LER cada um antes; os textos exatos estão no Step 3)
- Modify: `.context/ui-registry.md` (só se o guarda do Step 4 apontar componente sem entrada)
- Test: `test/pendenciasDoc.test.ts`, `test/uiRegistryDoc.test.ts`

**Interfaces:**
- Consumes: o código das Tarefas 1 a 12 (rotas, módulos e testes que a documentação descreve) e o formato de `pendencias.md` (`Estado`, seções 1 a 5, `Atualização` datada, índice e "Próximo id livre").
- Produces: documentação coerente com o código, `P26` e `P27` em Resolvido (seção 5), `P33` a `P36` em Aberto, próximo id `P37`, e o walkthrough no chat.

- [ ] **Step 1: Write the failing doc guards**

LER `test/pendenciasDoc.test.ts`. Dentro do `describe(".context/pendencias.md", …)`, logo depois do último `it` (o de "Editar o nome de uma pessoa"), acrescente:
```ts
  it("Fase 3: P26 e P27 resolvidas em 2026-11-21", () => {
    for (const id of ["P26", "P27"]) {
      const entry = entries.get(id);
      expect(entry?.state, id).toBe("Resolvido");
      expect(entry?.section, id).toBe("5");
      expect(entry?.updates, id).toContain("2026-11-21");
    }
  });

  it("Fase 3: P33 a P36 entraram como Aberto, não triado", () => {
    for (const id of ["P33", "P34", "P35", "P36"]) {
      const entry = entries.get(id);
      expect(entry?.state, id).toBe("Aberto, não triado");
      expect(entry?.section, id).toBe("1");
    }
  });
```
LER `test/uiRegistryDoc.test.ts` e faça três trocas: (1) logo antes de `const primitiveFiles`, acrescente `const handoverFiles = sourceFiles(join("src", "components", "passagens"));`; (2) `[...adminFiles, ...primitiveFiles]` vira `[...adminFiles, ...handoverFiles, ...primitiveFiles]`; (3) o título `describe("ui-registry.md cobre os componentes da Fase 2", …)` vira `describe("ui-registry.md cobre os componentes das Fases 2 e 3", …)`. Rode `bunx biome check --write test`.

- [ ] **Step 2: Run the guards to verify they fail**

Run: `bun run test -- test/pendenciasDoc.test.ts test/uiRegistryDoc.test.ts`
Expected: FAIL. `pendenciasDoc`: `P26: expected 'Aberto, não triado' to be 'Resolvido'` e `P33: expected undefined to be 'Aberto, não triado'`. `uiRegistryDoc`: um `× src\components\passagens\<Nome>.tsx está no catálogo` para cada componente sem entrada (`nenhuma menção a "<Nome>" em .context/ui-registry.md`).

- [ ] **Step 3: Apply the documentation edits**

Para cada item abaixo: abra o arquivo com Read, localize o trecho **exato** (`Procure`) e troque-o pelo texto de `Troque por` (Edit). Cada `Procure` ocorre uma única vez no arquivo. Cheque no fim com `git diff --stat`: 7 arquivos de documentação modificados.

**3.1 `.context/architecture.md`**

(a) Procure:
```text
## 6. Modelo de dados · 🟡 em construção (acesso, convite e cadastros ✅ até a Fase 2)
```
Troque por:
```text
## 6. Modelo de dados · 🟡 em construção (acesso, convite, cadastros e passagem ✅ até a Fase 3)
```

(b) Procure:
```text
**Tabelas criadas até a Fase 2** (migrações versionadas em `drizzle/`):
```
Troque por:
```text
**Tabelas criadas até a Fase 3** (migrações versionadas em `drizzle/`):
```

(c) Procure:
```text
| `destination` | destino de solicitação, global: `name`, `active`; índice único `lower(name)` | `uuid` |
```
Troque por:
```text
| `destination` | destino de solicitação, global: `name`, `active`; índice único `lower(name)` | `uuid` |
| `handover` | passagem: `sector_id`, `shift_id`, `operational_date` (`date`, o dia em que o turno **começou**), `status` (`draft`, `delivered` ou `confirmed`), `shift_name_snapshot`, `occurrences_text`, `next_shift_text`, `delivered_by`/`delivered_at`, `confirmed_by`/`confirmed_at`, `confirmation_note`, `updated_by`/`updated_at` (alimentam "Salvo às HH:mm por {nome}"); único `(sector_id, shift_id, operational_date)`; índice `(sector_id, operational_date)` para o histórico e um índice por FK; checks `handover_status_valid`, `handover_confirmer_ne_deliverer` (quem confirma não é quem entregou) e `handover_state_consistent` (rascunho sem entrega nem confirmação; entregue com entrega e sem confirmação; confirmada com os quatro campos) | `uuid` |
| `handover_item` | valor de um item na passagem: `quantity` (inteiro ≥ 0, check `handover_item_quantity_nonneg`; o teto de 99.999 é do domínio), `note`, `item_name_snapshot`, `item_unit_snapshot`, `item_kind_snapshot` (congelados na entrega, D1); check do tipo do snapshot | `(handover_id, item_id)` |
| `handover_correction` | uma linha por campo corrigido depois da confirmação (D13): `field` (`occurrences_text`, `next_shift_text`, `item_quantity` ou `item_note`), `item_id` (só nos campos de item, check `handover_correction_item_matches_field`), `old_value`, `new_value`, `reason` (não vazio), `corrected_by`, `corrected_at` | `uuid` |
```

(d) Procure:
```text
As demais entidades acima (passagem, valores por item, solicitações) chegam nas Fases 3 e 4.
```
Troque por:
```text
- **Datas da passagem:** `operational_date` é `date` e trafega como texto `"YYYY-MM-DD"` (o dia operacional de um turno que atravessa a meia-noite é o dia em que ele **começou**); `delivered_at`, `confirmed_at` e `updated_at` são `timestamptz`. O fuso da operação é `America/Sao_Paulo`, calculado com `Intl` (`src/features/handovers/saoPaulo.ts`), sem somar offset fixo.
- **Nada é apagado nem sobrescrito em silêncio:** as FKs da passagem são `restrict`; nome e unidade do item e o nome do turno ficam **congelados** na entrega (renomear o cadastro depois não muda a passagem) e, depois da confirmação, só `handover_correction` registra mudança.

As solicitações (com histórico de status e comentários) chegam na Fase 4.
```

(e) Procure (a linha de abertura da seção 8) e troque pelo bloco novo da seção 7 seguido da mesma linha:
```text
## 8. Dados pessoais (LGPD) · 🟢 baseline
```
Troque por:
```text
### Como ficou implementado (Fase 3)

- **Portão em três camadas.** (1) Toda página de `src/app/(app)/**` chama `requireUser()` ou `requireAdmin()` por um componente importado de `@/components/...`; as páginas sob `admin/` só valem com `requireAdmin` (P27; guarda `appPagesAuth.test.ts`, mínimo de 12 páginas). (2) Toda Server Action exportada chama `requireUser()` (ou `requireAdmin()`) como **primeira instrução**; `src/app/actionsGuards.test.ts` varre todo arquivo de `src` com `"use server"` (de arquivo ou inline), exige que se chame `actions.ts` sob `src/app/(app)/**` (exceção documentada: `(auth)/convite/[token]/actions.ts`) e que `admin/**` use `requireAdmin()`. (3) O domínio não confia na tela: revalida escopo de setor, papel, estado e limites, e o operador que monta a URL ou a action de outro setor recebe `NOT_FOUND` ("Página não encontrada"), nunca "sem permissão" (não revela o que existe).
- **GET nunca escreve.** Abrir, recarregar e pré-carregar `/passagens/nova` não cria linha: o rascunho nasce no primeiro salvamento. A identidade do rascunho é a tripla setor + turno + dia operacional (nunca um id que o cliente teria de guardar); criar é `INSERT … ON CONFLICT DO NOTHING RETURNING` e, se não voltou linha, `SELECT … FOR UPDATE` da existente.
- **Quem edita (`handoverCapabilities`, função pura usada pelo domínio e pela tela):** rascunho = qualquer pessoa do setor e o admin; entregue = só quem entregou e o admin, direto (sem linha de correção); confirmada = o salvamento automático recusa todos, inclusive o admin (`HANDOVER_LOCKED`); só `correctHandover` (admin, com motivo) altera.
- **Transições** são `UPDATE … WHERE status = '<esperado>'` conferindo as linhas afetadas, dentro de `db.transaction()` e com a linha travada por `FOR UPDATE` antes de decidir a mensagem; a corrida perdida devolve quem venceu e quando. O PGlite não prova concorrência: a atomicidade vai no SQL e o teste prova a invariante em sequência.
- **Entregar** cria o rascunho se faltar, completa com `0` os itens ativos e congela os snapshots de todas as linhas. **Receber:** o cartão do Início é a passagem mais recente do setor entre as entregues e as confirmadas (`delivered_at desc, id desc`); só aparece se ela ainda estiver entregue e não for de quem olha (uma confirmada mais nova esconde as entregues antigas), sem cair para outra e sem teto de idade (P35). **Corrigir:** o servidor calcula o diff (`diffHandover`) e grava uma linha de `handover_correction` por campo alterado, na mesma transação.
- **Turno sugerido (spec §6.2):** `suggestShift` escolhe o turno ativo cujo fim está mais próximo de agora (entre as ocorrências que começam ontem ou hoje: um turno que só começa amanhã não pode ter passagem e a data seria recusada); empate: o que já terminou, depois a ordem do setor.
- **Histórico `/passagens`:** uma consulta SQL (`generate_series` × turnos ativos de setores ativos, `NOT EXISTS`, `UNION ALL` com as passagens reais), paginada por linhas (50). Situações `awaiting`, `confirmed`, `unconfirmed` e `missing`, mais o selo "Corrigida"; passagem já entregue de turno depois desativado continua no histórico (só os pares "sem passagem" exigem turno ativo). "Sem passagem" só existe para pares já encerrados e a partir do dia em que o turno foi criado (P34).
- **Setor do admin:** `?setor=` na URL e o cookie `closery_setor`, gravado só pela Server Action `chooseSectorAction` e lido dentro de `<Suspense>`; "Todos os setores" (só no histórico) não grava o cookie.

## 8. Dados pessoais (LGPD) · 🟢 baseline
```

(f) Procure:
```text
## 9. Rotas · 🟢 rotas das Fases 1 e 2 prontas (as seguintes entram a cada marco)
```
Troque por:
```text
## 9. Rotas · 🟢 rotas das Fases 1, 2 e 3 prontas (as seguintes entram a cada marco)
```

(g) Procure:
```text
| `/` | Início: saudação (a passagem de turno entra na Fase 3) | ✅ Fase 1 |
```
Troque por:
```text
| `/` | Início: saudação, "Passagem para confirmar" (a mais recente entregue do setor, para quem não a entregou) e "Passagem do meu turno" (começar, continuar, entregue ou confirmada); o admin escolhe o setor (`?setor=`) | ✅ Fase 3 |
```

(h) Procure:
```text
| `/api/auth/[...all]` | handler do Better Auth. Pública | ✅ Fase 1 |
```
Troque por:
```text
| `/passagens` | histórico de passagens, do dia mais recente ao mais antigo: filtros na URL (`periodo`, `de`, `ate`, `turno`, `situacao`, `setor`, `pagina`), situação de cada turno (aguardando, confirmada, não confirmada, sem passagem) e selo "Corrigida". Admin escolhe o setor ou "Todos os setores" | ✅ Fase 3 |
| `/passagens/nova` | formulário da passagem (`?turno=&data=&setor=`): salvamento automático, contadores −/+ e "Entregar turno". Já entregue ou confirmada redireciona para o resumo | ✅ Fase 3 |
| `/passagens/[id]` | resumo na ordem do briefing, "Confirmar recebimento" e correções; `?editar=1` abre o formulário de edição (entregue) ou de correção com motivo (confirmada, só admin). Outro setor ou id inexistente: "Página não encontrada" | ✅ Fase 3 |
| `/api/auth/[...all]` | handler do Better Auth. Pública | ✅ Fase 1 |
```

(i) Procure (última linha do log da Fase 2):
```text
- **Verificado:** `check-types`, `lint`, `test`, `test:e2e` (13 passed) e `build` verdes. P11 e P18 resolvidas; P23 (editar o nome de uma pessoa) e P24 (ordem alfabética ignora acento) registradas.
```
Troque por (a mesma linha seguida da entrada nova):
```text
- **Verificado:** `check-types`, `lint`, `test`, `test:e2e` (13 passed) e `build` verdes. P11 e P18 resolvidas; P23 (editar o nome de uma pessoa) e P24 (ordem alfabética ignora acento) registradas.

### 2026-11-21 — Fase 3: passagem de turno

- **Decisão:** a passagem de ponta a ponta — rascunho com salvamento automático, entregar, receber (confirmar), corrigir com motivo e histórico — em `/`, `/passagens`, `/passagens/nova` e `/passagens/[id]`. Regra de negócio em `src/features/handovers/*` (funções que recebem `db` e `now` e devolvem `AdminResult`); lógica pura (fuso, dia operacional, turno sugerido, quantidade, permissões, diff, filtros) sem I/O; Server Actions finas em `src/app/(app)/passagens/actions.ts` sobre o `runHandoverAction`, irmão do `runAdminAction` que **não** revalida no salvamento automático. Migração `0003_fase3_passagem` (`handover`, `handover_item`, `handover_correction`). Decisões do dono: solicitações ficam para a Fase 4; trocar turno ou data abre o rascunho daquele turno e dia; o admin escolhe o setor na tela (URL + cookie).
- **Por quê:** a passagem tem de ser mais rápida no sistema do que na planilha (regra de ouro): o formulário abre pronto (turno e dia sugeridos, números em `0`), salva sozinho e entrega com um toque; quem recebe lê o resumo na ordem do briefing e confirma com outro toque. Confirmada não muda em silêncio (D13): o servidor calcula o diff e grava o rastro, nunca o cliente. O histórico de "sem passagem" é uma consulta SQL, nunca subtração em JS.
- **Trade-offs aceitos:** (1) O PGlite não prova concorrência: a atomicidade (entregar, confirmar, corrigir) vai no SQL com `UPDATE … WHERE status = …` e `FOR UPDATE`, provada em sequência. (2) Dois operadores no mesmo rascunho: o último a salvar vence por campo, sem aviso (P36). (3) "Sem passagem" usa os horários atuais do turno e some quando o turno é desativado (P34). (4) O cartão "Passagem para confirmar" não tem teto de idade (P35). (5) O runner novo duplica cerca de 25 linhas do `runAdminAction` em troca de não mexer na Fase 2 junto de uma feature (P33). (6) O E2E usa um turno 00:00–23:59 e a data de hoje em São Paulo na URL para não depender do relógio.
- **Desvios e detalhes registrados:** (a) o histórico pagina por linhas (50), não por dia: com filtros uma página de "dias" ficaria vazia ou desigual, e a ordem já agrupa por dia. (b) A leitura SQL seleciona colunas tipadas com `sql<string>` sobre um CTE (sem `db.execute`) e `timestamptz` cru volta como texto nos dois drivers: `.mapWith(handover.deliveredAt)` devolve `Date`. (c) O Next mantém a página anterior escondida ao navegar: no Playwright o texto escondido também casa, e o modo estrito reprova (use `.filter({ visible: true })`). (d) O cookie do setor só é gravado por Server Action; o `proxy.ts` não grava (o Next pré-carrega cada link de setor e o cookie viraria o último setor pré-carregado).
- **Verificado:** `check-types`, `lint`, `test`, `test:e2e` (19 passed: 7 de acesso, 6 de cadastros e 6 de passagem) e `build` verdes. P26 e P27 resolvidas; P33 a P36 registradas.
```

**3.2 `.context/library-docs.md`**

(a) Procure:
```text
  (páginas), `actionsAuth.test.ts` e `actionsInventory.test.ts` (actions), `pendenciasDoc.test.ts`
  (índice, seções e próximo id de `pendencias.md`) e `uiRegistryDoc.test.ts` (todo componente de
  `/admin` aparece em `ui-registry.md`).
```
Troque por:
```text
  (páginas), `actionsAuth.test.ts`, `actionsInventory.test.ts` e `actionsGuards.test.ts` (actions e
  qualquer `"use server"`), `pendenciasDoc.test.ts` (índice, seções e próximo id de `pendencias.md`) e
  `uiRegistryDoc.test.ts` (todo componente de `/admin` e de `/passagens` aparece em `ui-registry.md`).
```

(b) Procure:
```text
## Como adicionar uma biblioteca nova
```
Troque por:
```text
## 13. Passagem de turno (Fase 3)

- **Onde:** domínio em `src/features/handovers/*` (recebe `db: Db` e, quando o tempo importa, `now: Date`; devolve `AdminResult` com mensagem pt-BR pronta); Server Actions em `src/app/(app)/passagens/actions.ts` e `src/app/(app)/actions.ts`; telas em `src/components/passagens/*`. O arquivo `actions.ts` só exporta funções `async`; tipos, constantes e schemas vivem fora dele.
- **`runHandoverAction`** (`src/features/handovers/runHandoverAction.ts`, `server-only`): irmão do `runAdminAction` (§12). `schema.safeParse` → `run({ db, now, actor, input })` → `unstable_rethrow` (deixa `redirect` e `notFound` passarem) → `INTERNAL` com texto fixo. A diferença é o parâmetro `revalidate`: `false` no salvamento automático (revalidar re-renderizaria a tela enquanto a pessoa digita), `true` em entregar, confirmar e corrigir (`revalidatePath("/(app)", "layout")`, só quando `ok`). Cada action começa por `requireUser()` (a do setor, `requireAdmin()`).
- **Salvamento automático** (`useHandoverAutosave`): debounce de 800 ms **por campo**, **fila serial** (uma requisição em voo, porque duas Server Actions não têm ordem garantida e o valor velho poderia sobrescrever o novo) e coalescência (o valor mais novo de cada campo vence). `onBlur` envia já; falha mantém o que foi digitado, para a fila e mostra "Não salvo." com "Tentar de novo"; o evento `online` reenvia; `beforeunload` só enquanto houver algo não salvo; ao desmontar envia o pendente. "Entregar turno" e a troca de turno ou dia chamam `flush()` antes.
- **SQL do histórico** (`history.ts`): ``db.select({ … sql<string>`u.col` }).from(sql`(WITH … SELECT * FROM u) as u`)``, sem `db.execute` (o `Db` genérico não tipa o resultado). `timestamptz` cru volta como texto (`"2026-11-21 11:54:27.517+00"`) nos dois drivers: mapeie com ``sql<Date | null>`u.delivered_at`.mapWith(handover.deliveredAt)`` (a coluna do schema traz o decoder); `date` e `timestamp` sem fuso voltam como texto. O total (`count()`) e a página saem do mesmo CTE. O teste de paridade compara `hasShiftEnded` (JS) com o SQL de pares encerrados numa grade de horários (fim == agora conta como encerrado).
- **Cookie do setor** (`sectorCookie.ts`): `cookies().set` só em Server Function ou Route Handler, nunca em Server Component nem no `proxy.ts`; a leitura (`readRememberedSector`) fica dentro de `<Suspense>`. `chooseSectorAction` grava o cookie (`httpOnly`, `sameSite: "lax"`, `secure` em produção, `path: "/"`, 1 ano) e faz `redirect` **fora** de `try/catch`; "Todos os setores" não grava.
- **Fuso e datas:** `America/Sao_Paulo` via `Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23" }).formatToParts` (`saoPaulo.ts`); `operational_date` é texto `"YYYY-MM-DD"`. Teste de tempo usa o relógio injetado (`spDate()` em `test/clock.ts`), nunca o relógio real; o E2E usa turno `00:00–23:59` e a data de hoje na URL.
- **P27 (guardas):** `test/actionGuards.ts` guarda a varredura de actions (extraída de `actionsAuth.test.ts`); `actionsGuards.test.ts` reprova `"use server"` fora de `actions.ts`, action sem `requireUser`/`requireAdmin` na primeira instrução e `admin/**` sem `requireAdmin`; `appPagesAuth.test.ts` exige `requireAdmin` nas páginas de `admin/`.
- **E2E (`e2e/passagem.spec.ts`):** o Next mantém a página anterior escondida ao navegar; `getByText` também casa texto escondido e o modo estrito reprova. Use consultas por papel ou o helper `text()` do spec (`.filter({ visible: true })`) e `{ exact: true }` quando um texto contém o outro ("2 rolo" × "12 rolo").

## Como adicionar uma biblioteca nova
```

**3.3 `.context/progress-tracker.md`**

(a) Procure:
```text
- **2026-11-21 — Fases 0, 1 e 2 concluídas. Próximo: plano de implementação da Fase 3 (Passagem:
  rascunho, entregar, receber, corrigir, histórico)** com a skill `writing-plans`, a partir da spec
  §13 (`docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md`). Os cadastros que a
  passagem usa (setores, turnos, itens, destinos) e a equipe já existem em `/admin`; falta a tela do
  operador que os usa.
```
Troque por:
```text
- **2026-11-21 — Fases 0, 1, 2 e 3 concluídas. Próximo: plano de implementação da Fase 4
  (Solicitações: quadro · lista · tabela, detalhe, comentários e a ligação com a passagem)** com a
  skill `writing-plans`, a partir da spec §13
  (`docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md`). A passagem já está
  inteira (formulário, receber, corrigir e histórico) e **não** mostra solicitações (D-F3-1): a
  Fase 4 acrescenta a seção "Solicitações abertas" ao formulário e ao resumo e a ligação passagem →
  solicitação.
```

(b) Procure:
```text
## Histórico
```
Troque por:
```text
## Fase 3 — Passagem · ✅

- ✅ Schema: `handover`, `handover_item`, `handover_correction`, CHECKs de estado e de quantidade, um índice por FK e migração `0003_fase3_passagem` (2026-11-21)
- ✅ Lógica pura: fuso de São Paulo, dia operacional, turno sugerido, quantidade, permissões (`handoverCapabilities`), diff de correção, situações, filtros do histórico, links e escolha de setor (2026-11-21)
- ✅ Contrato das actions: 10 códigos novos em `AdminErrorCode`, `runHandoverAction` e os guardas da P27 (`actionsGuards.test.ts`, `requireAdmin` em `admin/`) (2026-11-21)
- ✅ Domínio: rascunho sem escrita no GET, salvamento por campo, entregar, confirmar, resumo, correção com motivo e rastro, histórico com "sem passagem" no SQL e cartões do Início (2026-11-21)
- ✅ Telas: Início com os dois cartões, formulário com salvamento automático, resumo com confirmação, correção, histórico com filtros e seletor de setor do admin (2026-11-21)
- ✅ P26 e P27 resolvidas; pendências novas P33–P36 (2026-11-21)
- ✅ Testes: Vitest (node + dom) com PGlite e Testing Library; E2E com 19 cenários (7 de acesso, 6 de cadastros e 6 de passagem). Verificado: `check-types`, `lint`, `test`, `test:e2e` (19 passed) e `build` verdes (2026-11-21)
- ⬜ Solicitações na passagem: Fase 4

## Histórico
```

(c) Procure (última linha do arquivo):
```text
- **2026-11-21** — Fase 2 concluída: cadastros e equipe em `/admin` (setores, turnos, itens, destinos, pessoas e convites), P11 e P18 resolvidas. Plano em `docs/superpowers/plans/2026-11-21-fase-2-cadastros.md`.
```
Troque por:
```text
- **2026-11-21** — Fase 2 concluída: cadastros e equipe em `/admin` (setores, turnos, itens, destinos, pessoas e convites), P11 e P18 resolvidas. Plano em `docs/superpowers/plans/2026-11-21-fase-2-cadastros.md`.
- **2026-11-21** — Fase 3 concluída: passagem de turno de ponta a ponta (rascunho com salvamento automático, entregar, receber, corrigir com motivo e histórico), P26 e P27 resolvidas. Plano em `docs/superpowers/plans/2026-11-21-fase-3-passagem.md`.
```

**3.4 `.context/build-plan.md`**

Procure:
```text
| **3 — Passagem** | rascunho, entregar, receber, corrigir, histórico | ⬜ |
```
Troque por:
```text
| **3 — Passagem** | rascunho, entregar, receber, corrigir, histórico | ✅ |
```

**3.5 `.context/code-standards.md`**

Procure:
```text
  (cerca de 1 min) e cobre os fluxos críticos: acesso por convite, passkey, permissão por papel e,
  nas próximas fases, entregar um turno, receber/confirmar e ver o dashboard. Rode antes de fechar
```
Troque por:
```text
  (cerca de 1 min) e cobre os fluxos críticos: acesso por convite, passkey, permissão por papel,
  cadastros e a passagem (entregar, receber/confirmar, corrigir com motivo e histórico) e, nas
  próximas fases, o dashboard. Rode antes de fechar
```

Procure:
```text
  implementação). **Nunca `bun test`** (é o runner do Bun, não o Vitest).
```
Troque por:
```text
  implementação). **Nunca `bun test`** (é o runner do Bun, não o Vitest). Se o Vitest acusar
  "Timeout waiting for worker to respond" com a máquina carregada, rode `bun run test -- --maxWorkers=4`.
```

**3.6 `.context/pendencias.md`** (P26 e P27 mudam de seção e ganham `Atualização`; P33 a P36 entram; nada é apagado)

(a) Procure:
```text
**Ids:** `P<N>` em sequência, nunca renumerados. **Próximo id livre: P33.**
```
Troque por:
```text
**Ids:** `P<N>` em sequência, nunca renumerados. **Próximo id livre: P37.**
```

(b) Procure as duas linhas do índice:
```text
| P26 | Visão geral conta turnos e itens de setores inativos; listas da Fase 3 precisam filtrar setor ativo | 🟡 | Aberto, não triado |
| P27 | Guardas de teste aceitam menos do que deveriam | 🟡 | Aberto, não triado |
```
Troque por:
```text
| P26 | Visão geral conta turnos e itens de setores inativos; listas da Fase 3 precisam filtrar setor ativo | 🟡 | Resolvido |
| P27 | Guardas de teste aceitam menos do que deveriam | 🟡 | Resolvido |
```

(c) Procure a última linha do índice:
```text
| P32 | Mensagens no feminino e select vazio sem setor ativo | ⚪ | Aberto, não triado |
```
Troque por:
```text
| P32 | Mensagens no feminino e select vazio sem setor ativo | ⚪ | Aberto, não triado |
| P33 | Dois runners de Server Action quase iguais (admin e passagem) | ⚪ | Aberto, não triado |
| P34 | "Sem passagem" usa os horários atuais do turno e some com o turno desativado | 🟡 | Aberto, não triado |
| P35 | Cartão "Passagem para confirmar" não tem teto de idade | 🟡 | Aberto, não triado |
| P36 | Dois operadores no mesmo rascunho: o último a salvar vence, sem aviso | 🟡 | Aberto, não triado |
```

(d) **Saída da seção 1:** procure o bloco abaixo (de `#### P26` até a linha `**Registrado em:** 2026-11-21` do P27, mais a linha em branco que o segue) e troque por **nada** (apague-o; as duas pendências reaparecem na seção 5 no item (f)):
```text
#### P26 — Visão geral conta turnos e itens de setores inativos; listas da Fase 3 precisam filtrar setor ativo 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/features/admin/overview.ts:39-40` · `src/app/(app)/admin/turnos` · `src/app/(app)/admin/itens`
**Impacto:** as contagens do `/admin` incluem turnos e itens ativos de setores inativos, que `/admin/turnos` e `/admin/itens` não conseguem mostrar (o seletor lista só setores ativos). As listas de escolha da Fase 3 (passagem) também precisam filtrar `sector.active`.
**Correção:** — (opção: juntar `sector` e filtrar `sector.active` nas contagens; registrar o filtro no plano da Fase 3)
**Registrado em:** 2026-11-21

#### P27 — Guardas de teste aceitam menos do que deveriam 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/app/appPagesAuth.test.ts:13` · teste de inventário das actions (`actionsAuth`)
**Impacto:** a guarda de páginas aceita `requireUser` em páginas de `admin/` (basta `require(User|Admin)`), então uma página admin que só chamasse `requireUser` passaria; a guarda das actions só varre arquivos chamados `actions.ts`, e um `"use server"` em outro nome ou inline escaparia.
**Correção:** — (opção: exigir `requireAdmin` para arquivos sob `admin/`; ampliar a varredura a qualquer `.ts/.tsx` com `"use server"` de arquivo ou inline, na primeira tarefa da Fase 3)
**Registrado em:** 2026-11-21

```

(e) **Entradas novas na seção 1:** procure o bloco do P32 inteiro e troque pelo mesmo bloco seguido de P33 a P36:
```text
#### P32 — Mensagens no feminino e select vazio sem setor ativo ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/components/admin/ActiveToggleButton.tsx` · `src/components/admin/team/PersonForm.tsx`
**Impacto:** `ActiveToggleButton` fixa o masculino (`${entity} desativado/reativado`): serve para Setor, Turno, Item e Destino, mas erra a concordância com uma entidade feminina futura (ex.: Pessoa → "Pessoa desativada."), então não pode ser reaproveitado na Equipe; com nenhum setor ativo o select de setor do operador aparece vazio.
**Correção:** — (opção: gênero como parâmetro do botão; com 0 setores ativos, mostrar a explicação e o atalho para Setores como no `InviteForm`)
**Registrado em:** 2026-11-21
```
Troque por:
```text
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
```

(f) **Entradas na seção 5:** o texto abaixo é uma linha só no arquivo (fim da `Atualização` do P18). Procure este trecho (sem espaços antes):
```text
o teste de schema prova que o banco recusa um papel fora de `admin`/`operator` (SQLSTATE 23514).
```
Troque por (o mesmo trecho seguido de P26 e P27 já resolvidos):
```text
o teste de schema prova que o banco recusa um papel fora de `admin`/`operator` (SQLSTATE 23514).

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
```

**3.7 `memory.md`**

(a) Procure:
```text
# Memory — Fases 0, 1 e 2 concluídas; o próximo passo é o plano da Fase 3
```
Troque por:
```text
# Memory — Fases 0 a 3 concluídas; o próximo passo é o plano da Fase 4
```

(b) Procure:
```text
Plano executado em `docs/superpowers/plans/2026-11-21-fase-2-cadastros.md`.
```
Troque por:
```text
Plano executado em `docs/superpowers/plans/2026-11-21-fase-2-cadastros.md`.

**Passagem pronta (Fase 3).** O Início (`/`) mostra "Passagem para confirmar" (a mais recente entregue do
setor, para quem não a entregou) e "Passagem do meu turno"; `/passagens/nova` abre o formulário do turno
certo sem digitar nada (turno e dia sugeridos pelo relógio de São Paulo, números em `0`) com salvamento
automático por campo e "Entregar turno"; `/passagens/[id]` é o resumo na ordem do briefing com "Confirmar
recebimento" (quem entregou não confirma); quem entregou ainda edita até a confirmação, depois só o admin
corrige, com motivo e uma linha de rastro por campo; `/passagens` é o histórico com filtros na URL, "sem
passagem", "não confirmada" e o selo "Corrigida". O admin escolhe o setor na tela (URL + cookie). Solicitações
não aparecem (Fase 4). Plano executado em `docs/superpowers/plans/2026-11-21-fase-3-passagem.md`.
```

(c) Procure:
```text
- **Plano da Fase 3 (skill `writing-plans`):** Passagem — rascunho, entregar, receber, corrigir,
  histórico. Usa os setores, turnos e itens já cadastrados; ainda não há tela de operador para eles.
```
Troque por:
```text
- **Plano da Fase 4 (skill `writing-plans`):** Solicitações — quadro · lista · tabela, detalhe,
  comentários e a ligação passagem → solicitação (a passagem já existe e não mostra solicitações, D-F3-1).
- **P33–P36 (Fase 3):** unificar os runners das actions (P33); "sem passagem" usa os horários atuais do
  turno (P34); o cartão "Passagem para confirmar" não tem teto de idade (P35); dois operadores no mesmo
  rascunho: o último a salvar vence (P36).
```

(d) Procure (última linha do arquivo):
```text
  sem diferença de caixa também em produção.
```
Troque por:
```text
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
```

- [ ] **Step 4: Check the registry guard and the pending guard**

Run: `bun run test -- test/pendenciasDoc.test.ts test/uiRegistryDoc.test.ts`
Expected: PASS (`pendenciasDoc.test.ts`: 8 testes). Se o `uiRegistryDoc` ainda listar `× src\components\passagens\<Nome>.tsx está no catálogo`, o componente `<Nome>` ficou sem entrada: acrescente-a em `.context/ui-registry.md`, depois da última entrada de `### Passagem de turno — …` e antes de `## 3.`, no template do arquivo (`### <Nome>` com `Status`, `Local`, `Propósito`, `Como funciona`, `Usa`, `Histórico: 2026-11-21 — criado na Fase 3 (Tarefa N)`) e rode de novo. As entradas de `HandoverHistory`, `HistoryFilters` e `HistoryRowItem` vêm da Tarefa 10.

- [ ] **Step 5: Final verification (todos os comandos, relatar a saída real)**

Run, nesta ordem:
```bash
bun run check-types
bun run lint
bun run test
bun run test:e2e
bun run build
```
Expected: `check-types` e `lint` limpos; `test` com todos os arquivos verdes (sem "Timeout waiting for worker": se aparecer, é carga da máquina; rode de novo ociosa); `test:e2e` com `19 passed` (7 de acesso + 6 de cadastros + 6 de passagem); `build` termina e lista `/passagens`, `/passagens/[id]` e `/passagens/nova` (parciais, `◐`). Se algum número for diferente, **não** copie os 19 do texto: ajuste `architecture.md §10` e `progress-tracker.md` para o número real.

- [ ] **Step 6: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-13.txt` e rode:
```bash
git add .context/architecture.md .context/library-docs.md .context/progress-tracker.md .context/pendencias.md .context/build-plan.md .context/code-standards.md .context/ui-registry.md memory.md test/pendenciasDoc.test.ts test/uiRegistryDoc.test.ts
git commit -F .git/sdd/msg-task-13.txt
```
Mensagem:
```text
docs: fecha a Fase 3 (passagem) no contexto do projeto

Tabelas, rotas, log e regras da passagem em architecture e library-docs;
progress-tracker e memory apontam para o plano da Fase 4; P26 e P27 viram
Resolvido (seção 5) e P33 a P36 entram como Aberto, não triado; os guardas de
documentação passam a cobrir pendências da Fase 3 e os componentes de
src/components/passagens.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

- [ ] **Step 7: Walkthrough didático (entregar no chat; não é arquivo)**

Escreva no chat, em pt-BR, curto, com as quatro partes de `code-standards.md §9`, de modo que o desenvolvedor explique a fase sem abrir o código:

1. **O que foi construído e onde vivem as peças.** Fluxo: o operador abre `/passagens/nova` (turno e dia sugeridos por `suggestShift`, números em `0`), o formulário salva sozinho (`useHandoverAutosave` → `saveHandoverFieldAction` → `saveHandoverField`) e "Entregar turno" chama `deliverHandover`; outra pessoa do setor vê o cartão no Início (`getHomeHandovers`), abre `/passagens/[id]` (`getHandoverSummary`) e confirma (`confirmHandover`); quem entregou ainda edita (`?editar=1`); depois da confirmação só o admin corrige, com motivo (`correctHandover` + `diffHandover` → `handover_correction`); `/passagens` lista tudo (`listHandoverHistory`, uma consulta SQL). Mapa de pastas: `src/db/schema/handovers.ts` e `drizzle/0003_fase3_passagem.sql`; `src/features/handovers/*` (puro: `saoPaulo`, `shiftSuggestion`, `quantity`, `fieldRules`, `access`, `diff`, `status`, `historyFilters`, `urls`, `sectorChoice`, `messages`; com banco: `loaders`, `targets`, `formState`, `draft`, `deliver`, `confirm`, `summary`, `correction`, `history`, `home`, `sectorCookie`, `runHandoverAction`); `src/app/(app)/passagens/actions.ts` e `(app)/actions.ts`; `src/components/passagens/*`; testes em `*.test.ts[x]`, `test/clock.ts`, `test/fixtures.ts` e `e2e/passagem.spec.ts`.
2. **Decisões e trade-offs.** GET nunca escreve e o rascunho se identifica por setor + turno + dia (idempotente); salvamento por campo com fila serial e sem `revalidatePath`; `handoverCapabilities` como fonte única de "quem pode o quê"; confirmada só muda por `correctHandover` com rastro; "sem passagem" calculado no SQL; runner irmão em vez de generalizar o da Fase 2 (P33); cookie do setor gravado só por Server Action; E2E sem depender do relógio. Descartados: gravar o cookie no `proxy.ts`, paginar por dia, mexer no `runAdminAction` junto da feature. Limites aceitos: P34, P35, P36 e o PGlite que não prova corrida.
3. **Como debugar.** Entrada por camada: tela que não salva → `useHandoverAutosave` (status `error`) e `saveHandoverField`; mensagem de recusa → o código em `AdminErrorCode` e `messages.ts`; "sem passagem" errado → `history.ts` (CTE) e o teste de paridade com `hasShiftEnded`; turno sugerido estranho → `shiftSuggestion.ts` com `spDate()`; permissão → `handoverCapabilities` e os guardas `actionsGuards.test.ts`/`appPagesAuth.test.ts`; E2E que reprova por "strict mode" → página anterior escondida (`text()`); migração → `drizzle/0003_fase3_passagem.sql` e `migration0003.test.ts`.
4. **O que entender antes de aprovar.** (a) dia operacional = dia em que o turno começou; (b) por que `UPDATE … WHERE status = '<esperado>'` mais `FOR UPDATE` é a garantia, e o teste prova só a invariante em sequência; (c) snapshots congelam nome, unidade e tipo na entrega; (d) o `AdminResult` com código e mensagem pt-BR pronta; (e) `Cache Components`: sessão, cookie e `searchParams` só dentro de `<Suspense>`.

