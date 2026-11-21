# Fase 2 — Cadastros — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao administrador as seis telas de `/admin` — visão geral, setores, turnos, itens, destinos e equipe — para que a passagem de turno (Fase 3) tenha o que escolher: cadastros que nunca apagam (só desativam), turnos que avisam sobreposição, ordem por botões, unidade do item por escolha, equipe com papel, setor, desativação (que derruba as sessões) e convites com link para copiar ou compartilhar. Fecha as pendências P11 e P18.

**Architecture:** Next.js 16 server-first, igual à Fase 1. Regra de negócio em funções de domínio (`src/features/admin/*`) que recebem `db: Db` e, quando o tempo importa, `now: Date`, e devolvem `AdminResult` (resultado tipado com mensagem pt-BR pronta). Lógica pura (normalização de nome, horário, sobreposição à meia-noite, unidade, paginação, reordenação) em módulos sem I/O. Cada página tem um `actions.ts` (`"use server"`) fino: `requireAdmin()` → `runAdminAction` (Zod → domínio → `revalidatePath`). Páginas leem no servidor dentro de `<Suspense>` e passam dados a formulários controlados no cliente, que chamam as actions com objetos tipados. Migração versionada `0002`, gerada pelo drizzle-kit.

**Tech Stack:** Next.js 16.4.6 · React 19.3 · TypeScript 5.9 · Bun 1.3.3 · Drizzle 0.45.4 + `pg` 8.23 (Neon) · Better Auth 1.7.27 · Zod 4 · shadcn/ui `base-nova` (Base UI) · Tailwind 4 · Vitest 5.1.1 + jsdom 28 + Testing Library · PGlite 0.5.17 (+ `pglite-socket` 0.2.20 no E2E) · Playwright 1.65.1 · Biome 2.4. Nenhuma biblioteca nova.

**Spec:** `docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md` (§4.1 papéis, §4.2 convites, §5 Cadastros, §9 Modelo de dados, §10 Arquitetura, §11 UI, §12 Testes, §13 Fases). Escopo e decisões do dono: `.git/sdd/fase2-decisions.md`.

## Global Constraints

- Leia `AGENTS.md` e os arquivos de `.context/` antes de começar; as regras de lá valem em toda tarefa. Antes de escrever código de Next, confira o guia em `node_modules/next/dist/docs/` (esta versão tem quebras).
- Node **≥ 22.12**. Bun é o gerenciador e o runner de scripts; **nunca** `bun test` — use `bun run test`.
- Biome é a lei de formatação: espaços (2), aspas duplas, ponto e vírgula. Depois de qualquer `shadcn add` ou código gerado rode `bunx biome check --write src` (o `bun run format` sozinho **não** corrige `useImportType` nem `organizeImports` dos arquivos gerados).
- TypeScript strict: sem `any`, sem `!` non-null de conveniência, sem `as` para calar erro (exceto o cast documentado em teste de contrato).
- Named exports em tudo, exceto entry files do Next (`page.tsx`, `layout.tsx`, `route.ts`, `error.tsx`, `not-found.tsx`, `proxy.ts`). Componentes em `PascalCase.tsx`; utilitários em `camelCase.ts`; primitivos shadcn em `kebab-case.tsx`. Arquivo `actions.ts` só exporta funções `async` (regra do `"use server"`); tipos e constantes vivem fora dele.
- Base UI, não Radix: composição pela prop `render`. Navegação com cara de botão é `<Link className={buttonVariants({ … })}>` (continua role `link`). Só tokens de cor (`bg-background`, `text-muted-foreground`, `text-warning-foreground`…); nunca hex nem cor crua do Tailwind; tema claro **e** escuro.
- Cache Components ligado: `cookies()`, `headers()`, `await params`/`searchParams` e qualquer leitura de sessão **só dentro de `<Suspense>`**; nunca em função `"use cache"`. Páginas de `/admin/**` **não exportam `metadata`** (o `<title>` sairia antes do portão e revelaria a página ao operador; T12 da Fase 1) e o `<h1>` fica dentro do `<Suspense>`.
- **Portão em três camadas:** (1) toda página de `src/app/(app)/admin/**` chama `requireAdmin()` por um componente importado de `@/components/...` (guarda `appPagesAuth.test.ts`); (2) toda Server Action exportada chama `requireAdmin()` como primeira linha (guarda novo `actionsAuth.test.ts`); (3) o domínio nunca confia na tela e revalida regra de negócio (último admin, setor ativo, autoedição).
- Erro esperado é **retornado** (`AdminResult` com `ok: false`); `throw` só para falha interna. Mensagem de erro é texto pt-BR pronto para a tela, nunca texto cru do banco.
- Textos de interface em pt-BR, exatamente como na seção **Textos de interface** abaixo (testes e E2E dependem deles). Rótulos de ação nomeiam o resultado; conjunto conhecido de respostas é escolha; formulário nunca começa em branco (`ui-rules.md §2`); controle só com ícone ganha tooltip **e** `aria-label`.
- Toda lista é paginada (`PAGE_SIZE = 50`, `?pagina=`); agregação (contagens) no SQL; escrita de vários statements em `db.transaction()`; listas de escolha (setores ativos) com teto `CHOICE_LIST_LIMIT = 200`.
- Mudança de schema só por migração versionada (`bun run db:generate -- --name <nome>` → revisar o SQL → `bun run db:migrate`); nunca `db:push`.
- Datas: `timestamptz` no domínio; funções de domínio recebem `now: Date` por parâmetro. Horário de turno é `time` (sem fuso) e trafega como texto `"HH:mm"`.
- Nenhum nome real de funcionário, foto ou dado da planilha em código, seed, teste ou fixture; use nomes fictícios ("Turno Manhã", "Rede de proteção", "Almoxarifado").
- **Teste:** erro, limites (vazio, `0`, máximo, unicode, meia-noite) e permissão negada sempre; PGlite não prova concorrência — a atomicidade vai no SQL e o teste prova a invariante em sequência (`library-docs.md §9`).
- Toda tarefa termina com: `bun run check-types`, `bun run lint`, `bun run test` verdes e commit na branch `feat/fase-2-cadastros`. Mensagens em pt-BR (`tipo(escopo): resumo`) terminando com a linha `Co-Authored-By:` do modelo que executou (hoje `Claude Sonnet 5.5 <noreply@anthropic.com>`); mensagem escrita com a ferramenta Write em `.git/sdd/msg-task-N.txt` e `git commit -F .git/sdd/msg-task-N.txt` (heredoc com acento falha na ferramenta Bash); nunca `--no-verify`. O PR só abre com o CI (`checks` + `e2e`) verde.
- **Shell:** comandos deste plano são bash (Git Bash), nunca PowerShell. Arquivos com texto acentuado se criam com a ferramenta Write, não com heredoc. Em código que testa NFC, travessão ou espaço sem quebra, escreva o caractere com chaves (`\u{301}`, `\u{2013}`, `\u{a0}`, `\u{1F600}`): as ferramentas de escrita convertem `\uXXXX` de 4 dígitos no caractere literal e o teste perde o sentido.
- **Worktree:** se a execução usar `git worktree`, copie o `.env.local` do checkout principal antes da Tarefa 1 (`db:migrate` e `build` precisam dele). Em worktree, `.git` é arquivo: use `$(git rev-parse --git-common-dir)/sdd/` no lugar de `.git/sdd/` (mensagens de commit e scripts da Tarefa 13), ou execute no checkout principal.

---

## Decisões técnicas deste plano (complementam a spec)

`D-F2-n` = decisão do dono (vinculante). `F2-n` = decisão do controlador, mantida ou refinada aqui (o "Por quê" diz o que mudou). "Verificado" = conferido num clone de trabalho com Drizzle 0.45.4, drizzle-kit 0.31, PGlite 0.5.17 e shadcn CLI 4.23.

| # | Decisão | Por quê |
|---|---|---|
| D-F2-1 | Unidade do item = escolha fechada `unidade, rolo, par, pacote, caixa, saco, metro, kg` + **"Outro"** com texto livre; grava texto em `item.unit` | Dono. Escolha em vez de texto (`ui-rules.md §2.1`); padrão `unidade` |
| D-F2-2 | Desativar setor com operadores ativos ou convites pendentes (válidos) **bloqueia** e devolve `{ ok: false, code: "SECTOR_IN_USE", message }` com as contagens | Dono. Evita operador num setor inativo e convite que nasceria órfão |
| D-F2-3 | Ordem de turnos e itens por botões ↑ ↓ (primeiro ↑ e último ↓ desabilitados), troca feita no servidor numa transação | Dono. Sem biblioteca de drag-and-drop; funciona no celular |
| D-F2-4 | Entram **P11** (desativar pessoa apaga as sessões na mesma transação) e **P18** (`CHECK` de papel em `user` e `invite`) | Dono |
| F2-1 | Migração `0002_fase2_cadastros`, gerada pelo drizzle-kit: tabelas `shift`, `item`, `destination`; índices únicos em `lower(name)` (composto com `sector_id` em `shift` e `item`; global em `sector` e `destination`); `CHECK` de papel (`user_role_valid`, `invite_role_valid`), de tipo do item (`item_kind_valid`) e de horário (`shift_starts_ne_ends`). **Refina:** **sem** `index()` separado em `shift.sector_id`/`item.sector_id` | **Verificado:** `uniqueIndex("…").on(sql\`lower(${t.name})\`)` e `.on(t.sectorId, sql\`lower(${t.name})\`)` geram `CREATE UNIQUE INDEX … USING btree ("sector_id",lower("name"))`; tirar o `.unique()` de `sector.name` gera `ALTER TABLE "sector" DROP CONSTRAINT "sector_name_unique"` + o índice novo; `check("user_role_valid", sql\`${t.role} in ('admin', 'operator')\`)` gera `ADD CONSTRAINT … CHECK ("user"."role" in ('admin', 'operator'))`. O índice composto começa por `sector_id` e já cobre a FK (regra "índice em toda FK") sem custo de escrita dobrado |
| F2-2 | Nada se apaga: só desativar/reativar; listas mostram ativos e inativos (selo "Inativo", botão "Reativar"); listas de escolha das fases seguintes usam só ativos | Spec §5 |
| F2-3 | Sobreposição de turnos **avisa, não bloqueia** (spec §5). Função pura cobre a meia-noite; intervalos que só se encostam (`fim == início`) **não** sobrepõem; só turnos **ativos** do mesmo setor entram na conta. Salvar devolve `{ ok: true, warnings }`; o aviso persiste na linha da lista | Turno de 22:00 a 06:00 vira os segmentos `[1320,1440)` e `[0,360)` |
| F2-4 | Equipe — pessoas: **uma** ação `updatePerson` ("Editar": papel + setor juntos) e `setPersonActive`. **Refina** "mudar papel" + "mudar setor" separados | Um formulário e uma transação evitam o estado intermediário "operador sem setor" e cabem num diálogo só. Operador exige setor ativo; admin grava `sector_id = null`. Nunca desativar nem rebaixar o último admin ativo; ninguém desativa nem rebaixa a **própria** conta |
| F2-5 | Convites: `createTeamInvite` usa `createInvite` (com `invitedBy` = admin atual) e devolve o link **uma vez**; `cancelInvite(db, id, now)` **não existe ainda** e é criado em `inviteQueries.ts` com `UPDATE` condicional | O token bruto nunca fica no banco; link perdido = cancelar e gerar outro |
| F2-6 | Rotas: `/admin`, `/admin/setores`, `/admin/turnos`, `/admin/itens`, `/admin/destinos`, `/admin/equipe`. Turnos e itens filtram por setor em `?setor=<id>` (padrão = primeiro setor ativo; id inválido ou inativo cai no padrão). **Sem** `layout.tsx` em `/admin` e **sem** sub-navegação: cada página mostra um link "Voltar para Administração" | Um layout renderizaria a navegação do admin para o operador antes do `notFound()` da página. A sidebar já marca "Administração" ativa nas subrotas (`isNavItemActive`), então `navItems.ts` **não muda** |
| F2-7 | Server Actions: `requireAdmin()` na primeira linha de **cada** função exportada, depois `runAdminAction({ actor, schema, input, run })` (Zod → domínio → `revalidatePath("/(app)/admin", "layout")` só em sucesso). **Refina:** o guarda `actionsAuth.test.ts` confere **cada função exportada**, não só o arquivo | `requireAdmin` explícito em cada action mantém o guarda estático simples; o wrapper tira a repetição de Zod/try/revalidate. `redirect`/`notFound` lançados por `requireAdmin` são re-lançados com `unstable_rethrow` (existe em `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_rethrow.md`) |
| F2-8 | Paginação: `PAGE_SIZE = 50`, parâmetro `?pagina=`; a Equipe tem duas listas (`?pagina=` para pessoas, `?convites=` para convites pendentes). Página fora do intervalo é **clampada** (nunca vazia por engano) | Regra "toda lista paginada" |
| F2-9 | Nunca em branco: ordem automática (`max+1` no setor, num único `INSERT … SELECT`); tipo do item = "Controle"; unidade = "unidade"; horário do turno novo começa no fim do último turno **ativo** (por ordem) ou `06:00` e termina 8 h depois; **nome do turno sugerido** `Turno N`; setor padrão = o da URL; convite: papel Operador e setor = primeiro ativo. **Exceção documentada:** nome de setor, item e destino e nome de referência do convite são a identidade do registro e começam vazios (não há valor padrão sensato) | `ui-rules.md §2.2` |
| F2-10 | E2E refinado: no E2E, a linha da própria conta do admin **não tem botões**, só "Você" e o texto de ajuda; o "último admin não se desativa" é provado por teste de domínio e de action (recusa no servidor) e, no E2E, pela ausência dos botões | Botão que sempre falha é atrito (regra de ouro); a regra continua no servidor |
| F2-11 | shadcn: adicionar **`toggle-group`** (traz `toggle`), **`native-select`** e **`dialog`**. **Não** usar `table`, `select` (Base UI), `radio-group` nem `alert-dialog` | **Verificado:** nenhum dos três existia em `src/components/ui`; os cinco extras também instalam (`--dry-run`). Lista em linhas (não tabela) funciona melhor no celular; `<select>` nativo abre o seletor do aparelho, tem 16px e é testável com `user-event`; `ChoiceGroup` (toggle-group) é o controle segmentado para 2 opções; confirmação usa `Dialog` |
| F2-12 | Formulários são **controlados** e chamam a Server Action com **objeto tipado** dentro de `useAdminAction` (sem `useActionState`/`FormData`). **Refina** `code-standards.md §6` | React 19 limpa formulário não controlado depois do submit e a pessoa perderia o que digitou quando o servidor recusa (padrão já usado em `InviteSignup`); o mesmo schema Zod (`schemas.ts`) valida no cliente e no servidor |
| F2-13 | Ativar/desativar para o estado em que o registro já está é **sucesso sem mudança** (idempotente), nunca erro | Clique duplo e duas abas não geram mensagem de falha |
| F2-14 | Reordenar: `moveId` (puro) + transação que lê as linhas do setor `ORDER BY sort_order, created_at, id` com `FOR UPDATE` e **renumera 1..n** só o que mudou. Empate de `sort_order` (dois criados juntos) se desfaz sozinho e nunca quebra | Troca simples de dois valores falharia com duplicados |
| F2-15 | Último admin: dentro da transação, `SELECT id FROM "user" WHERE role = 'admin' AND deactivated_at IS NULL FOR UPDATE`; ordem de checagem: pessoa existe → autoedição (`SELF_CHANGE`) → último admin (`LAST_ADMIN`) | **Verificado** que `.for("update")` roda no PGlite e compila (`tx.select(...).from(user).where(...).for("update")`). O lock serializa dois admins que se desativam ao mesmo tempo (o segundo relê e vê um só) |
| F2-16 | P11: `setPersonActive({ active: false })` faz `UPDATE "user" SET deactivated_at` **e** `DELETE FROM session WHERE user_id = …` na mesma transação | **Verificado** nomes em `src/db/schema/auth.ts`: tabela `session`, coluna `user_id` (`session.userId`). A sessão é lida fresca do banco, então a pessoa cai na próxima requisição |
| F2-17 | Horário: o banco devolve `time` como texto `"HH:mm:ss"` e aceita `"HH:mm"` na entrada; o contrato do app usa `"HH:mm"` (`fromDbTime`/`toDbTime` convertem) | **Verificado** no PGlite: `.returning()` do Drizzle e `client.query` dão `"22:00:00"`; o driver `pg` também não converte `time` (devolve texto). `CHECK` violado = SQLSTATE `23514` |
| F2-18 | `AdminResult` com `code` (união fechada) e `message` pt-BR; erro de nome repetido (23505) consulta o registro conflitante para dizer se ele está **inativo** | **Verificado:** o Drizzle 0.45 embrulha o erro do driver; o SQLSTATE e o nome do índice estão em `error.cause.code` e `error.cause.constraint` (`sector_name_lower_uq`, `shift_sector_name_lower_uq`…). O índice em `lower(name)` pega "uld" vs "ULD" e "Água" vs "ÁGUA" (23505 no PGlite) |
| F2-19 | Data na tela: `formatDateTimeBR(date)` → `"28/11/2026, 14:30"` em `America/Sao_Paulo` | Verificado com `Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" })` |
| F2-20 | O link do convite é montado na action com `authEnv.baseURL` (`buildInviteUrl`) e devolvido junto de `expiresAt: Date`; o cliente guarda só em estado | Só o hash fica no banco; recarregar a página apaga o link |
| F2-21 | Papel e setor mudam por `UPDATE` direto no Drizzle (não pela API do Better Auth) | A sessão é lida fresca (sem `cookieCache`), então vale na próxima requisição |
| F2-22 | `lower()` do Postgres decide o "mesmo nome"; o domínio normaliza com NFC + `trim` + espaços colapsados antes de gravar | Acentos em UTF-8 funcionam (verificado no PGlite); se o Neon rodar com collation `C`, só ASCII dobra caixa (ver Perguntas em aberto). `lower()` dobra caixa; a ordem alfabética com acento não é garantida ("Álvaro" vem depois de "Zé" por ponto de código; P24) |
| F2-23 | Limites aceitos: concorrência (dois admins, duas abas) só é provada em sequência no PGlite; a garantia está no SQL (`UPDATE … WHERE`, índice único, `FOR UPDATE`); a checagem de setor ativo usa `FOR SHARE`, que serializa com o `FOR UPDATE` de `setSectorActive` | `library-docs.md §9` |
| F2-24 | `shadcn add dialog` reinstala `button.tsx` e o CLI **pergunta** "button.tsx already exists. Would you like to overwrite?" mesmo com `--yes`. Rodar `bunx shadcn add toggle-group native-select dialog --yes --overwrite`, depois `git checkout -- src/components/ui/button.tsx` (restaura a customização P3) | **Verificado** no clone: sem `--overwrite` o comando trava no prompt; com `--overwrite`, `toggle.tsx` é criado e só `button.tsx` é sobrescrito. Os gerados saem com `h-8`/`h-7` e `"Close"` em inglês: precisam de `max-md:h-11`, `text-base` no select nativo e `"Fechar"` (P3/P12) |

---

## Estrutura de arquivos

```
drizzle/0002_fase2_cadastros.sql                         (gerar)  + drizzle/meta/0002_snapshot.json, _journal.json   [1]
src/db/schema/sectors.ts                                 (modificar) unique → uniqueIndex lower(name)               [1]
src/lib/itemKinds.ts                                     (criar)  ITEM_KINDS, ItemKind                              [1]
src/db/schema/catalog.ts                                 (criar)  shift, item, destination (reexporta ITEM_KINDS)   [1]
src/db/schema/auth.ts                                    (modificar) check user_role_valid (P18)                    [1]
src/db/schema/invites.ts                                 (modificar) check invite_role_valid (P18)                  [1]
src/db/schema/index.ts                                   (modificar) + export catalog                               [1]
src/db/schema/catalog.test.ts                            (criar)                                                    [1]
src/db/schema/sectors.test.ts                            (modificar) + caso "Uld" vs "ULD"                          [1]
test/sqlError.ts                                         (criar)  sqlErrorOf                                        [1]
src/db/schema/migration0002.test.ts                      (criar)                                                    [1]
test/db.ts                                               (modificar) TABLES + shift, item, destination              [1]
test/fixtures.ts                                         (modificar) insertSector(active), insertShift, insertItem, insertDestination, insertSession [1]
test/authz.ts                                            (criar)  authzOf                                           [3]
src/features/admin/{result,dbErrors}.test.ts, test/authz.test.ts (criar)                                            [3]
src/lib/plural.ts                                        (criar)  pluralize                                         [2]
src/lib/dateTime.ts                                      (criar)  formatDateTimeBR                                  [2]
src/features/admin/names.ts                              (criar)  normalizeName, validateName                       [2]
src/features/admin/timeOfDay.ts                          (criar)                                                    [2]
src/features/admin/shiftRules.ts                         (criar)  sobreposição, sugestões                           [2]
src/features/admin/itemOptions.ts                        (criar)  unidades, tipos, resolveUnit, splitUnit           [2]
src/features/admin/pagination.ts                         (criar)                                                    [2]
src/features/admin/reorder.ts                            (criar)  moveId, planSortUpdates                           [2]
src/features/admin/messages.ts                           (criar)  textos de erro de domínio                         [2]
src/features/admin/result.ts                             (criar)  AdminResult, ok, fail                             [3]
src/features/admin/dbErrors.ts                           (criar)  sqlStateOf, isUniqueViolation                     [3]
src/features/admin/schemas.ts                            (criar)  schemas Zod das actions                           [3]
src/features/admin/runAdminAction.ts                     (criar)  server-only                                       [3]
src/app/(app)/admin/actionsAuth.test.ts                  (criar)  guarda: toda action chama requireAdmin            [3, 11]
src/app/appPagesAuth.test.ts                             (modificar) mínimo de páginas 4 → 9                        [11]
test/setup-dom.ts, vitest.config.ts                      (modificar) timeout do findBy; globalSetup e timeouts do dom [5]
src/components/ui/toggle.tsx, toggle-group.tsx           (criar via shadcn add) + alvos de toque                    [4]
src/components/ui/native-select.tsx                      (criar via shadcn add) + alvos de toque, 16px              [4]
src/components/ui/dialog.tsx                             (criar via shadcn add) + "Fechar"                          [4]
src/components/ui/ptBrLabels.test.tsx                    (modificar) + Dialog                                       [4]
src/components/ui/touchTargets.test.tsx                  (criar)  toggle-group e native-select ≥ 44px no celular    [4]
src/components/admin/AdminPageHeader.tsx                 (criar)                                                    [5]
src/components/admin/AdminListRow.tsx                    (criar)                                                    [5]
src/components/admin/AdminListSkeleton.tsx               (criar)                                                    [5]
src/components/admin/EmptyState.tsx                      (criar)                                                    [5]
src/components/admin/InactiveBadge.tsx                   (criar)                                                    [5]
src/components/admin/Pagination.tsx                      (criar)                                                    [5]
src/components/admin/SectorSwitcher.tsx                  (criar)                                                    [5]
src/components/admin/MoveButtons.tsx                     (criar)  client                                            [5]
src/components/admin/ChoiceGroup.tsx                     (criar)  client                                            [5]
src/components/admin/SelectField.tsx                     (criar)  client                                            [5]
src/components/admin/EditDialog.tsx                      (criar)  client                                            [5]
src/components/admin/ConfirmDialog.tsx                   (criar)  client                                            [5]
src/components/admin/NameForm.tsx                        (criar)  client                                            [5]
src/components/admin/ActiveToggleButton.tsx              (criar)  client                                            [5]
src/components/admin/useAdminAction.ts                   (criar)  client                                            [5]
src/features/admin/sectors.ts                            (criar) SectorChoice [5]; domínio [6]                      [5, 6]
src/features/admin/destinations.ts                       (criar)                                                    [6]
src/app/(app)/admin/setores/page.tsx, actions.ts         (criar)                                                    [6]
src/app/(app)/admin/destinos/page.tsx, actions.ts        (criar)                                                    [6]
src/components/admin/sectors/SectorsAdmin.tsx            (criar)  server                                            [6]
src/components/admin/sectors/SectorCreateForm.tsx        (criar)  client                                            [6]
src/components/admin/sectors/SectorRowActions.tsx        (criar)  client                                            [6]
src/components/admin/destinations/DestinationsAdmin.tsx  (criar)  server                                            [6]
src/components/admin/destinations/DestinationCreateForm.tsx (criar) client                                          [6]
src/components/admin/destinations/DestinationRowActions.tsx (criar) client                                          [6]
src/features/admin/shifts.ts                             (criar)                                                    [7]
src/app/(app)/admin/turnos/page.tsx, actions.ts          (criar)                                                    [7]
src/components/admin/shifts/ShiftsAdmin.tsx              (criar)  server                                            [7]
src/components/admin/shifts/ShiftForm.tsx                (criar)  client (criar e editar)                           [7]
src/components/admin/shifts/ShiftRowActions.tsx          (criar)  client                                            [7]
src/features/admin/items.ts                              (criar)                                                    [8]
src/app/(app)/admin/itens/page.tsx, actions.ts           (criar)                                                    [8]
src/components/admin/items/ItemsAdmin.tsx                (criar)  server                                            [8]
src/components/admin/items/ItemForm.tsx                  (criar)  client (criar e editar)                           [8]
src/components/admin/items/ItemRowActions.tsx            (criar)  client                                            [8]
src/features/admin/people.ts                             (criar)                                                    [9]
src/app/(app)/admin/equipe/page.tsx                      (criar)                                                    [9]
src/app/(app)/admin/equipe/actions.ts                    (criar)  updatePerson/setPersonActive [9]; createInvite/cancelInvite [10]
src/components/admin/team/TeamAdmin.tsx                  (criar)  server                                            [9, 10]
src/components/admin/team/PersonForm.tsx                 (criar)  client                                            [9]
src/components/admin/team/PersonRowActions.tsx           (criar)  client                                            [9]
src/components/admin/team/roleOptions.ts                 (criar)  ROLE_LABELS, ROLE_OPTIONS                         [9]
src/features/invites/inviteQueries.ts                    (modificar) + cancelInvite                                 [10]
src/features/invites/inviteQueries.test.ts               (modificar)                                                [10]
src/app/(app)/admin/equipe/inviteActions.test.ts         (criar)                                                    [10]
src/features/admin/teamInvites.ts                        (criar)                                                    [10]
src/components/admin/team/InviteForm.tsx                 (criar)  client                                            [10]
src/components/admin/team/InviteLinkCard.tsx             (criar)  client                                            [10]
src/components/admin/team/PendingInviteActions.tsx       (criar)  client                                            [10]
src/features/admin/overview.ts                           (criar)  getAdminOverviewCounts                            [11]
src/components/app-shell/AdminOverview.tsx               (modificar) cartões dos 5 cadastros                        [11]
src/components/app-shell/AdminOverview.test.tsx          (modificar)                                                [11]
src/app/(app)/admin/page.tsx                             (modificar) fallback de skeleton                           [11]
src/app/(app)/admin/{page.test.tsx,actionsInventory.test.ts} (criar)                                                [11]
e2e/db.ts                                                (modificar) + countSessionsByEmail, reexporta insertUser   [12]
test/e2eDb.test.ts                                       (criar)                                                    [12]
e2e/cadastros.spec.ts                                    (criar)                                                    [12]
.context/{progress-tracker,ui-registry,pendencias,architecture,library-docs,build-plan,code-standards}.md (modificar) [13]
test/{pendenciasDoc,uiRegistryDoc}.test.ts               (criar)                                                    [13]
memory.md                                                (modificar)                                                [13]
```

Os números entre colchetes são as tarefas que criam ou mudam o arquivo. Arquivos de teste (`*.test.ts[x]`) ficam ao lado do código e aparecem na lista **Files** de cada tarefa. `navItems.ts` **não muda** (F2-6).

---

## Contrato de interfaces

Toda tarefa usa **exatamente** estes nomes e assinaturas. Uma tarefa que precise de algo fora daqui o declara no bloco **Interfaces → Produces** dela. Componentes de cliente importam dos módulos de domínio **só tipos** (`import type`); nunca código de banco.

### Dependências

Nenhuma nova. shadcn (Tarefa 4): `toggle-group` (traz `toggle`), `native-select`, `dialog` — ver F2-24 para o comando.

### Schema (`src/db/schema/*`, migração `0002_fase2_cadastros`)

```ts
// src/db/schema/sectors.ts — sector.name perde .unique()
uniqueIndex("sector_name_lower_uq").on(sql`lower(${t.name})`)

// src/lib/itemKinds.ts (sem I/O, como roles.ts: cliente e schemas.ts importam de @/lib/itemKinds)
export const ITEM_KINDS = ["control", "stock"] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];

// src/db/schema/catalog.ts reexporta ITEM_KINDS e ItemKind
```
- `shift`: `id uuid pk defaultRandom`, `sectorId uuid not null FK sector (restrict)` (`sector_id`), `name text not null`, `startsAt time not null` (`starts_at`), `endsAt time not null` (`ends_at`), `sortOrder integer not null` (`sort_order`), `active boolean not null default true`, `createdAt timestamptz not null default now` (`created_at`). Índice `uniqueIndex("shift_sector_name_lower_uq").on(t.sectorId, sql\`lower(${t.name})\`)`; `check("shift_starts_ne_ends", sql\`${t.startsAt} <> ${t.endsAt}\`)`. Atravessar a meia-noite é permitido (`ends_at < starts_at`).
- `item`: `id`, `sectorId` FK restrict, `name text not null`, `unit text not null`, `kind text enum ITEM_KINDS not null`, `sortOrder integer not null`, `active`, `createdAt`. Índice `item_sector_name_lower_uq` (`sector_id`, `lower(name)`); `check("item_kind_valid", sql\`${t.kind} in ('control', 'stock')\`)`.
- `destination`: `id`, `name text not null`, `active`, `createdAt`. Índice `destination_name_lower_uq` (`lower(name)`).
- `src/db/schema/auth.ts`: `check("user_role_valid", sql\`${t.role} in ('admin', 'operator')\`)` em `user`. `src/db/schema/invites.ts`: `check("invite_role_valid", …)` em `invite`.
- `src/db/schema/index.ts` reexporta `./catalog`.

### Resultado e erros — `src/features/admin/result.ts` (sem `server-only`; importável no cliente)

```ts
export type AdminErrorCode =
  | "INVALID_INPUT" | "NAME_TAKEN" | "NOT_FOUND" | "SECTOR_REQUIRED" | "SECTOR_INACTIVE"
  | "SECTOR_IN_USE" | "SELF_CHANGE" | "LAST_ADMIN" | "INVITE_NOT_PENDING" | "INTERNAL";
export type FieldErrors = Partial<Record<string, string>>; // chave = nome do campo do formulário
export type AdminFailure = { ok: false; code: AdminErrorCode; message: string; fieldErrors?: FieldErrors };
export type AdminResult<T extends object = object> = ({ ok: true } & T) | AdminFailure;
export function ok(): { ok: true };
export function ok<T extends object>(data: T): { ok: true } & T;
export function fail(code: AdminErrorCode, message: string, fieldErrors?: FieldErrors): AdminFailure;
export const INTERNAL_ERROR_MESSAGE: string; // "Não foi possível concluir. Tente de novo."
export const INVALID_INPUT_MESSAGE: string;  // "Confira os campos e tente de novo."
```

### `src/features/admin/dbErrors.ts` (puro)

```ts
export function sqlStateOf(error: unknown): string | undefined;  // error.code ou error.cause.code
export function constraintOf(error: unknown): string | undefined; // error.constraint ou error.cause.constraint
export function isUniqueViolation(error: unknown): boolean;       // SQLSTATE 23505
```

### Lógica pura (`src/features/admin/*`, `src/lib/*`) — Tarefa 2

```ts
// src/lib/plural.ts
export function pluralize(count: number, singular: string, plural: string): string; // 1 → "1 pessoa", 0|3 → "3 pessoas"
// src/lib/dateTime.ts
export function formatDateTimeBR(date: Date): string; // "28/11/2026, 14:30", America/Sao_Paulo

// names.ts
export const NAME_MAX_LENGTH = 60;
export function normalizeName(raw: string): string; // NFC + trim + /\s+/g → " "
export function validateName(raw: string): { ok: true; name: string } | { ok: false; message: string };
// "Informe o nome." (vazio) · "O nome pode ter no máximo 60 caracteres." (conta pontos de código, não unidades UTF-16)

// timeOfDay.ts
export const MINUTES_PER_DAY = 1440;
export const TIME_INPUT_PATTERN: RegExp;                  // /^([01]\d|2[0-3]):([0-5]\d)$/
export function parseTimeOfDay(value: string): number | null; // "HH:mm" ou "HH:mm:00" → minutos 0..1439; "24:00", "6:00", "06:00:30" → null
export function formatTimeOfDay(minutes: number): string;     // módulo 1440 → "HH:mm"
export function toDbTime(value: string): string;              // "06:00" → "06:00:00"; lança RangeError se inválido
export function fromDbTime(value: string): string;            // "06:00:00" → "06:00"; "06:00" → "06:00"

// shiftRules.ts
export type ShiftRange = { startsAt: string; endsAt: string }; // "HH:mm"
export type NamedShiftRange = ShiftRange & { id: string; name: string };
export type OverlapWarning = { shiftId: string; name: string; startsAt: string; endsAt: string };
export function crossesMidnight(range: ShiftRange): boolean;   // endsAt < startsAt
export function shiftSegments(range: ShiftRange): ReadonlyArray<readonly [number, number]>;
// [[ini, fim]] ou, ao atravessar, [[ini, 1440], [0, fim]] (minutos; intervalos semiabertos)
export function rangesOverlap(a: ShiftRange, b: ShiftRange): boolean; // encostar (fim == início) NÃO sobrepõe
export function findOverlaps(
  candidate: ShiftRange & { id?: string },
  others: readonly NamedShiftRange[], // o chamador passa só os ativos do setor
): OverlapWarning[];                  // ignora others com id == candidate.id; preserva a ordem de `others`
export function formatOverlapWarning(warning: OverlapWarning): string; // "Sobrepõe o turno Manhã (06:00–14:00)" (travessão curto U+2013)
export function suggestShiftTimes(activeInOrder: readonly ShiftRange[]): ShiftRange;
// início = endsAt do último; sem turnos = "06:00"; fim = início + 8 h (módulo 24 h)
export function suggestShiftName(existingNames: readonly string[]): string;
// "Turno N", N = existingNames.length + 1, sobe enquanto o nome existir (sem diferença de caixa)

// itemOptions.ts
export const ITEM_UNITS = ["unidade", "rolo", "par", "pacote", "caixa", "saco", "metro", "kg"] as const;
export type ItemUnit = (typeof ITEM_UNITS)[number];
export const OTHER_UNIT = "outro" as const;
export type UnitChoice = ItemUnit | typeof OTHER_UNIT;
export const DEFAULT_UNIT: ItemUnit; // "unidade"
export const UNIT_MAX_LENGTH = 20;
export const ITEM_UNIT_LABELS: Readonly<Record<ItemUnit, string>>; // Unidade, Rolo, Par, Pacote, Caixa, Saco, Metro, kg
export const ITEM_KIND_LABELS: Readonly<Record<ItemKind, string>>; // control: "Controle", stock: "Estoque"
export const ITEM_KIND_HELP: Readonly<Record<ItemKind, string>>;   // ver Textos de interface
export type ItemFormValues = { name: string; unitChoice: UnitChoice; unitOther: string; kind: ItemKind };
export const ITEM_FORM_DEFAULTS: ItemFormValues; // { name: "", unitChoice: "unidade", unitOther: "", kind: "control" }
export function resolveUnit(
  choice: string,
  other: string,
): { ok: true; unit: string } | { ok: false; field: "unitChoice" | "unitOther"; message: string };
// choice da lista → o próprio valor; "outro": normalizeName(other); vazio → "Informe a unidade."; > 20 → "A unidade pode ter no máximo 20 caracteres.";
// "outro" cujo texto (sem caixa) já é uma unidade da lista → devolve o valor da lista; choice desconhecido → "Escolha uma unidade."
export function splitUnit(unit: string): { choice: UnitChoice; other: string }; // fora da lista → { choice: "outro", other: unit }

// pagination.ts
export const PAGE_SIZE = 50;
export const CHOICE_LIST_LIMIT = 200;
export const MAX_PAGE = 10_000;
export type Page<T> = { rows: T[]; total: number; page: number; pageCount: number; pageSize: number };
export function parsePage(raw: string | string[] | undefined): number; // inteiro ≥ 1 (≤ MAX_PAGE), senão 1
export function resolvePage(total: number, requested: number): { page: number; pageCount: number; offset: number }; // pageCount ≥ 1; page clampada
export function buildPageHref(pathname: string, params: Record<string, string | undefined>, param: string, page: number): string;
// os outros parâmetros na ordem de params; o da página por último; undefined ignorado; página 1 omite o parâmetro; valores codificados

// reorder.ts
export type SortDirection = "up" | "down";
export function moveId(ids: readonly string[], id: string, direction: SortDirection): string[] | null; // null: id ausente ou já na borda
export function planSortUpdates(
  current: readonly { id: string; sortOrder: number }[], // na ordem de leitura
  nextIds: readonly string[],
): { id: string; sortOrder: number }[]; // só quem muda, com sortOrder = índice + 1

// messages.ts
export type AdminEntity = "setor" | "turno" | "item" | "destino" | "pessoa";
export function nameTakenMessage(entity: Exclude<AdminEntity, "pessoa">, inactive: boolean): string;
export function notFoundMessage(entity: AdminEntity): string;
export function sectorBlockedMessage(people: number, invites: number): string;
export const SELF_DEACTIVATE_MESSAGE: string;
export const SELF_ROLE_MESSAGE: string;
export const LAST_ADMIN_MESSAGE: string;
export const SECTOR_REQUIRED_MESSAGE: string;
export const SECTOR_INACTIVE_MESSAGE: string;
export const INVITE_NOT_PENDING_MESSAGE: string;
export const INVITE_LABEL_TOO_LONG_MESSAGE: string;   // "O nome de referência pode ter no máximo 80 caracteres."
export const PERSON_SECTOR_INACTIVE_MESSAGE: string;  // "O setor desta pessoa está inativo. Edite a pessoa e escolha outro setor antes de reativar."
```

### Schemas Zod — `src/features/admin/schemas.ts` (sem `server-only`; o mesmo schema valida no cliente e no servidor)

```ts
export const idSchema: z.ZodUUID;                 // erro: "Registro inválido. Atualize a página."
export const nameSchema: z.ZodType<string>;       // normalizeName + validateName (mesmas mensagens)
export const timeSchema: z.ZodType<string>;       // TIME_INPUT_PATTERN, erro: "Informe um horário válido, como 06:00."
export const createSectorSchema      = z.object({ name: nameSchema });
export const renameSectorSchema      = z.object({ id: idSchema, name: nameSchema });
export const createDestinationSchema = z.object({ name: nameSchema });
export const renameDestinationSchema = z.object({ id: idSchema, name: nameSchema });
export const setActiveSchema         = z.object({ id: idSchema, active: z.boolean() });
export const moveSchema              = z.object({ id: idSchema, direction: z.enum(["up", "down"]) });
export const createShiftSchema       = z.object({ sectorId: idSchema, name: nameSchema, startsAt: timeSchema, endsAt: timeSchema }); // refine: início ≠ fim, erro em `endsAt`: "O início e o fim não podem ser iguais."
export const updateShiftSchema       = z.object({ id: idSchema, name: nameSchema, startsAt: timeSchema, endsAt: timeSchema });          // mesmo refine
export const createItemSchema        = z.object({ sectorId: idSchema, name: nameSchema, unitChoice: z.string(), unitOther: z.string(), kind: z.enum(ITEM_KINDS) }); // refine: resolveUnit, erro no campo que ele indicar
export const updateItemSchema        = z.object({ id: idSchema, name: nameSchema, unitChoice: z.string(), unitOther: z.string(), kind: z.enum(ITEM_KINDS) });
export const updatePersonSchema      = z.object({ userId: z.string().min(1), role: z.enum(ROLES), sectorId: idSchema.nullable() }); // refine: operator exige sectorId (erro em `sectorId`: SECTOR_REQUIRED_MESSAGE)
export const setPersonActiveSchema   = z.object({ userId: z.string().min(1), active: z.boolean() }); // `user.id` é text, não uuid
export const createInviteSchema      = z.object({ inviteeLabel: z.string(), role: z.enum(ROLES), sectorId: idSchema.nullable() }); // inviteeLabel: trim + espaços colapsados; ≤ 80 ("O nome de referência pode ter no máximo 80 caracteres."); vazio vira null no domínio
export const cancelInviteSchema      = z.object({ id: idSchema });
// tipos: export type CreateSectorInput = z.infer<typeof createSectorSchema>; … um `<Nome>Input` por schema
export function firstFieldErrors(error: z.ZodError): FieldErrors; // 1ª mensagem por campo (issue.path[0]); issue sem caminho fica de fora
export const INVITE_LABEL_MAX_LENGTH = 80;       // o teste confere que é igual a ADMIN_INVITE_LABEL_MAX_LENGTH
```

### `src/features/admin/runAdminAction.ts` (`server-only`)

```ts
export async function runAdminAction<S extends z.ZodType, T extends object = object>(args: {
  actor: Authz;
  schema: S;
  input: unknown;
  run: (ctx: { db: Db; now: Date; actor: Authz; input: z.output<S> }) => Promise<AdminResult<T>>;
}): Promise<AdminResult<T>>;
```
Fluxo: `schema.safeParse(input)` → falha vira `fail("INVALID_INPUT", <1ª mensagem ou INVALID_INPUT_MESSAGE>, firstFieldErrors(error))` · `run({ db, now: new Date(), actor, input })` · se `ok`, `revalidatePath("/(app)/admin", "layout")` (com route group o caminho é o do arquivo) · exceção inesperada: `unstable_rethrow(error)` (deixa `redirect`/`notFound` passarem), senão `console.error` e `fail("INTERNAL", INTERNAL_ERROR_MESSAGE)`. Nunca devolve texto do banco. Imports: `db` de `@/db`, `revalidatePath` de `next/cache`, `unstable_rethrow` de `next/navigation`.

### Domínio — Setores e destinos (`sectors.ts`, `destinations.ts`) — Tarefa 6

```ts
// sectors.ts
export type SectorRow = { id: string; name: string; active: boolean; activePeople: number; pendingInvites: number };
export type SectorChoice = { id: string; name: string };
export async function listSectors(db: Db, input: { page: number }, now: Date): Promise<Page<SectorRow>>;
// ordem: active desc, lower(name), id; contagens por subconsulta no SQL (pessoa ativa = user.deactivated_at IS NULL; convite pendente = used_at/cancelled_at nulos e expires_at > now)
export async function listActiveSectors(db: Db): Promise<SectorChoice[]>; // ativos, lower(name), até CHOICE_LIST_LIMIT
export function resolveSectorFilter(sectors: readonly SectorChoice[], raw: string | string[] | undefined): SectorChoice | null; // puro: id da URL se estiver na lista, senão o primeiro, senão null
export async function createSector(db: Db, input: { name: string }): Promise<AdminResult<{ id: string }>>;
export async function renameSector(db: Db, input: { id: string; name: string }): Promise<AdminResult>;
export async function setSectorActive(db: Db, input: { id: string; active: boolean }, now: Date): Promise<AdminResult>;
// desativar: em transação, conta pessoas ativas e convites pendentes do setor; se qualquer um > 0 → fail("SECTOR_IN_USE", sectorBlockedMessage(p, i)); reativar sempre passa
// destinations.ts
export type DestinationRow = { id: string; name: string; active: boolean };
export async function listDestinations(db: Db, input: { page: number }): Promise<Page<DestinationRow>>; // active desc, lower(name), id
export async function createDestination(db: Db, input: { name: string }): Promise<AdminResult<{ id: string }>>;
export async function renameDestination(db: Db, input: { id: string; name: string }): Promise<AdminResult>;
export async function setDestinationActive(db: Db, input: { id: string; active: boolean }): Promise<AdminResult>;
```
Regras comuns: nome validado por `validateName`; 23505 → `fail("NAME_TAKEN", nameTakenMessage(entity, inactive), { name: <mesma mensagem> })`; id inexistente → `fail("NOT_FOUND", notFoundMessage(entity))`.

### Domínio — Turnos (`shifts.ts`) — Tarefa 7

```ts
export type ShiftRow = {
  id: string; sectorId: string; name: string; startsAt: string; endsAt: string; // "HH:mm"
  crossesMidnight: boolean; sortOrder: number; active: boolean;
  canMoveUp: boolean; canMoveDown: boolean; // posição absoluta na lista do setor (inclui outras páginas)
  overlaps: OverlapWarning[];               // [] se a linha estiver inativa
};
export type ShiftFormDefaults = { name: string; startsAt: string; endsAt: string };
export async function listShifts(db: Db, input: { sectorId: string; page: number }): Promise<Page<ShiftRow>>; // ORDER BY sort_order, created_at, id
export async function getShiftFormDefaults(db: Db, sectorId: string): Promise<ShiftFormDefaults>; // suggestShiftTimes + suggestShiftName
export async function createShift(db: Db, input: { sectorId: string; name: string; startsAt: string; endsAt: string }): Promise<AdminResult<{ id: string; warnings: OverlapWarning[] }>>;
// setor inexistente → NOT_FOUND; setor inativo → SECTOR_INACTIVE "Este setor está inativo. Reative-o para cadastrar turnos."; início == fim → INVALID_INPUT em `endsAt`
// o setor é lido com `FOR SHARE` na mesma transação do INSERT (F2-23)
// sortOrder via um único INSERT … (select coalesce(max(sort_order), 0) + 1 from shift where sector_id = …)
export async function updateShift(db: Db, input: { id: string; name: string; startsAt: string; endsAt: string }): Promise<AdminResult<{ warnings: OverlapWarning[] }>>;
export async function setShiftActive(db: Db, input: { id: string; active: boolean }): Promise<AdminResult<{ warnings: OverlapWarning[] }>>; // warnings ao reativar
export async function moveShift(db: Db, input: { id: string; direction: SortDirection }): Promise<AdminResult>; // F2-14; na borda: ok sem mudança
```

### Domínio — Itens (`items.ts`) — Tarefa 8

```ts
export type ItemRow = {
  id: string; sectorId: string; name: string; unit: string; kind: ItemKind;
  sortOrder: number; active: boolean; canMoveUp: boolean; canMoveDown: boolean;
};
export async function listItems(db: Db, input: { sectorId: string; page: number }): Promise<Page<ItemRow>>; // ORDER BY sort_order, created_at, id
export async function createItem(db: Db, input: { sectorId: string; name: string; unit: string; kind: ItemKind }): Promise<AdminResult<{ id: string }>>;
// `unit` já resolvido por resolveUnit (a action resolve); o domínio revalida: 1..20 caracteres normalizados, com o erro de unidade em `fieldErrors.unitOther`; setor inativo → SECTOR_INACTIVE "Este setor está inativo. Reative-o para cadastrar itens."
// o setor é lido com `FOR SHARE` na mesma transação do INSERT (F2-23)
export async function updateItem(db: Db, input: { id: string; name: string; unit: string; kind: ItemKind }): Promise<AdminResult>;
export async function setItemActive(db: Db, input: { id: string; active: boolean }): Promise<AdminResult>;
export async function moveItem(db: Db, input: { id: string; direction: SortDirection }): Promise<AdminResult>;
```

### Domínio — Equipe: pessoas (`people.ts`) — Tarefa 9

```ts
export type PersonRow = {
  id: string; name: string; email: string; role: Role;
  sectorId: string | null; sectorName: string | null; sectorActive: boolean | null; // null = sem setor (admin)
  active: boolean; // deactivated_at IS NULL
};
export async function listPeople(db: Db, input: { page: number }): Promise<Page<PersonRow>>; // active desc, lower(name), id
export async function updatePerson(db: Db, input: { actorId: string; userId: string; role: Role; sectorId: string | null }): Promise<AdminResult>;
export async function setPersonActive(db: Db, input: { actorId: string; userId: string; active: boolean }, now: Date): Promise<AdminResult>;
```
`updatePerson` (uma transação): pessoa existe (`NOT_FOUND`) → `role === "operator"`: `sectorId` obrigatório (`SECTOR_REQUIRED`) e setor existente (`NOT_FOUND`, `notFoundMessage("setor")`) e **ativo** (`SECTOR_INACTIVE`), lido com `FOR SHARE` → se o alvo é admin ativo e o novo papel é operador: `actorId === userId` → `SELF_CHANGE`; senão trava os admins ativos e, se o alvo for o único, `LAST_ADMIN` → `UPDATE "user" SET role, sector_id` (`admin` grava `null`). Sem mudança real = `ok`.
`setPersonActive`: `active: false`: `actorId === userId` → `SELF_CHANGE` (`SELF_DEACTIVATE_MESSAGE`); trava admins ativos; alvo admin ativo e único → `LAST_ADMIN`; `UPDATE "user" SET deactivated_at = now WHERE id = … AND deactivated_at IS NULL` e `DELETE FROM session WHERE user_id = …` **na mesma transação** (P11; as sessões saem mesmo se a pessoa já estava desativada). `active: true`: operador com setor inativo (lido com `FOR SHARE`) → `SECTOR_INACTIVE` (`PERSON_SECTOR_INACTIVE_MESSAGE`, de `messages.ts`: `"O setor desta pessoa está inativo. Edite a pessoa e escolha outro setor antes de reativar."`); `UPDATE … SET deactivated_at = NULL`.

### Domínio — Equipe: convites (`teamInvites.ts`, `inviteQueries.ts`) — Tarefa 10

```ts
// src/features/invites/inviteQueries.ts (modificar)
export async function cancelInvite(db: Db, id: string, now: Date): Promise<boolean>;
// UPDATE invite SET cancelled_at = now WHERE id = $id AND used_at IS NULL AND cancelled_at IS NULL AND expires_at > now RETURNING id → true se uma linha

// src/features/admin/teamInvites.ts
export type PendingInviteRow = {
  id: string; inviteeLabel: string | null; role: Role; sectorName: string | null;
  inviterName: string | null; expiresAt: Date; createdAt: Date;
};
export async function listPendingInvites(db: Db, input: { page: number }, now: Date): Promise<Page<PendingInviteRow>>; // só estado "valid"; created_at desc, id
export async function createTeamInvite(
  db: Db,
  input: { actorId: string; inviteeLabel: string | null; role: Role; sectorId: string | null; baseURL: string; now: Date },
): Promise<AdminResult<{ id: string; url: string; expiresAt: Date }>>;
// admin: sectorId forçado a null; operator: SECTOR_REQUIRED / NOT_FOUND (setor inexistente, `notFoundMessage("setor")`) / SECTOR_INACTIVE; rótulo normalizado (vazio → null, ≤ ADMIN_INVITE_LABEL_MAX_LENGTH; erro: INVITE_LABEL_TOO_LONG_MESSAGE de messages.ts);
// a checagem do setor (SELECT … FOR SHARE) e o createInvite({ …, invitedBy: actorId, now }) rodam na mesma `db.transaction`; buildInviteUrl(baseURL, token)
export async function cancelPendingInvite(db: Db, input: { id: string }, now: Date): Promise<AdminResult>; // false → fail("INVITE_NOT_PENDING", INVITE_NOT_PENDING_MESSAGE)
```

### Visão geral (`overview.ts`) — Tarefa 11

```ts
export type AdminOverviewCounts = { sectors: number; shifts: number; items: number; destinations: number; people: number; pendingInvites: number }; // todos "ativos"/"pendentes"
export async function getAdminOverviewCounts(db: Db, now: Date): Promise<AdminOverviewCounts>; // um SELECT com subconsultas `count(*)` sobre `.from(sql`(values (1)) as one(n)`)` (sem `.from()` o Drizzle 0.45 não executa)
```

### Server Actions (`src/app/(app)/admin/<rota>/actions.ts`, `"use server"`)

Cada função: `const actor = await requireAdmin();` → `return runAdminAction({ actor, schema, input, run })`. `input: unknown` é o objeto do formulário; o tipo `*Input` documenta o formato.

| Arquivo | Função | Input (schema) | Retorno |
|---|---|---|---|
| `setores/actions.ts` | `createSectorAction` | `createSectorSchema` | `AdminResult<{ id: string }>` |
| | `renameSectorAction` | `renameSectorSchema` | `AdminResult` |
| | `setSectorActiveAction` | `setActiveSchema` | `AdminResult` |
| `destinos/actions.ts` | `createDestinationAction` | `createDestinationSchema` | `AdminResult<{ id: string }>` |
| | `renameDestinationAction` | `renameDestinationSchema` | `AdminResult` |
| | `setDestinationActiveAction` | `setActiveSchema` | `AdminResult` |
| `turnos/actions.ts` | `createShiftAction` | `createShiftSchema` | `AdminResult<{ id: string; warnings: OverlapWarning[] }>` |
| | `updateShiftAction` | `updateShiftSchema` | `AdminResult<{ warnings: OverlapWarning[] }>` |
| | `setShiftActiveAction` | `setActiveSchema` | `AdminResult<{ warnings: OverlapWarning[] }>` |
| | `moveShiftAction` | `moveSchema` | `AdminResult` |
| `itens/actions.ts` | `createItemAction` | `createItemSchema` (resolve a unidade com `resolveUnit`) | `AdminResult<{ id: string }>` |
| | `updateItemAction` | `updateItemSchema` | `AdminResult` |
| | `setItemActiveAction` | `setActiveSchema` | `AdminResult` |
| | `moveItemAction` | `moveSchema` | `AdminResult` |
| `equipe/actions.ts` | `updatePersonAction` | `updatePersonSchema` | `AdminResult` |
| | `setPersonActiveAction` | `setPersonActiveSchema` | `AdminResult` |
| | `createInviteAction` | `createInviteSchema` (baseURL de `authEnv.baseURL` de `@/lib/auth`) | `AdminResult<{ id: string; url: string; expiresAt: Date }>` |
| | `cancelInviteAction` | `cancelInviteSchema` | `AdminResult` |

### Guarda de actions — `src/app/(app)/admin/actionsAuth.test.ts`

```ts
export function actionsMissingAdminGuard(source: string): string[];
// nomes de toda `export async function` cujo corpo não começa por `await requireAdmin()` (com ou sem `const x =`) e de todo export de runtime que não seja `export async function`; `export type` é permitido; comentários removidos; [] = ok
// o teste varre `src/app/(app)/admin/**/actions.ts` e exige: começa com "use server"; ≥ 5 arquivos (`MIN_ACTION_FILES`: 0 na Tarefa 3, 5 na Tarefa 11); lista vazia
// casos negativos: action sem guarda → nome na lista; guarda só em comentário → nome na lista; um export sem guarda entre dois com guarda
```

### Primitivos shadcn (Tarefa 4)

`ToggleGroup`/`ToggleGroupItem` (`variant="outline"`, `size="lg"` no uso), `NativeSelect`/`NativeSelectOption`, `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`, `DialogClose`. Ajustes: toda altura de `toggle`/`toggle-group`/`native-select` vira `h-9 max-md:h-11` (ou `size-9 max-md:size-11`); `native-select` com `text-base md:text-sm` (`size="sm"` deixa de ser mais baixo: o `data-[size=sm]:h-7` sai, porque venceria o `max-md:h-11` por especificidade); `DialogContent` com botão "Fechar" (`sr-only`), em pt-BR, no mesmo padrão do `Sheet`.

### Componentes compartilhados (`src/components/admin/*`) — Tarefa 5

Server-safe = sem `"use client"`.

```ts
AdminPageHeader(props: { title: string; description: string; backHref?: "/admin" })           // server-safe; <h1>; link "Voltar para Administração" (ícone ChevronLeft aria-hidden) quando backHref
AdminListRow(props: { title: ReactNode; subtitle?: ReactNode; badges?: ReactNode; notes?: ReactNode; actions?: ReactNode; inactive?: boolean }) // server-safe; <li>; inactive esmaece o título e mostra <InactiveBadge />
AdminListSkeleton(props: { rows?: number })                                                    // server-safe; padrão 4; aria-busy
EmptyState(props: { title: string; description?: string; action?: { label: string; href: string } }) // server-safe; action vira <Link className={buttonVariants({ variant: "outline" })}>
InactiveBadge()                                                                                // server-safe; <Badge variant="secondary">Inativo</Badge>
Pagination(props: { page: number; pageCount: number; pathname: string; params: Record<string, string | undefined>; param?: string }) // server-safe; param padrão "pagina"; retorna null se pageCount ≤ 1; na borda, `<span aria-disabled="true">` (não é link)
SectorSwitcher(props: { sectors: readonly SectorChoice[]; selectedId: string; pathname: "/admin/turnos" | "/admin/itens" }) // server-safe; <nav aria-label="Setor"> com links `?setor=<id>`; o selecionado tem aria-current="page"
MoveButtons(props: { label: string; canMoveUp: boolean; canMoveDown: boolean; pending?: boolean; onMove: (direction: SortDirection) => void }) // "use client"; 2 botões ícone (ChevronUp/ChevronDown), aria-label `Subir ${label}` / `Descer ${label}`, tooltip "Subir"/"Descer"; desabilitados na borda
ChoiceGroup<T extends string>(props: { legend: string; value: T; onValueChange: (value: T) => void; options: readonly { value: T; label: string }[]; description?: string; disabled?: boolean }) // "use client"; ToggleGroup single, nunca fica sem seleção (clicar no selecionado não desmarca); <fieldset> com <legend>; opções são toggles com `aria-pressed`
SelectField(props: { id?: string; label: string; value: string; onValueChange: (value: string) => void; options: readonly { value: string; label: string }[]; description?: string; error?: string; disabled?: boolean }) // "use client"; NativeSelect dentro de Field/FieldLabel/FieldError
EditDialog(props: { title: string; name: string; children: (close: () => void) => ReactNode }) // "use client"; gatilho <Button variant="outline" size="sm">Editar</Button> com aria-label `Editar ${name}`; `title` = DialogTitle (nome do dialog); `name` = DialogDescription e aria-label `Editar ${name}`; `children(close)` dentro do DialogContent
ConfirmDialog(props: { trigger: ReactElement; title: string; description: string; confirmLabel: string; cancelLabel?: string; destructive?: boolean; onConfirm: () => Promise<AdminResult> }) // "use client"; cancelLabel padrão "Voltar"; role dialog nomeado por `title`; `DialogContent showCloseButton={false}`; falha ou exceção → `role=alert` dentro do diálogo, sem fechar e sem toast; fecha só no sucesso; `trigger` aceita `render` e traz aria-label próprio quando o texto não cita o nome
NameForm(props: { entity: "setor" | "destino"; initialName: string; submitLabel: string; onSubmit: (name: string) => Promise<AdminResult<object>>; successMessage?: string; onDone?: () => void }) // "use client"; controlado; rótulo "Nome do setor"/"Nome do destino"; limpa só no sucesso; erro inline (FieldError role="alert")
ActiveToggleButton(props: { entity: "Setor" | "Turno" | "Item" | "Destino"; name: string; active: boolean; onToggle: (nextActive: boolean) => Promise<AdminResult<object>> }) // "use client"; "Desativar" (outline) / "Reativar" (default), aria-label `Desativar ${name}`/`Reativar ${name}`; toast `${entity} desativado.`/`${entity} reativado.`; erro em toast
useAdminAction(): {                                                                            // "use client" (arquivo .ts)
  pending: boolean;
  run: <T extends object>(
    action: () => Promise<AdminResult<T>>,
    options?: { success?: string; showError?: boolean },  // showError padrão true → toast.error(message); formulários passam false e mostram o erro inline
  ) => Promise<AdminResult<T>>;                           // exceção de rede/servidor → fail("INTERNAL", INTERNAL_ERROR_MESSAGE)
}
```

### Componentes por cadastro (`src/components/admin/<área>/*`)

```ts
// sectors/SectorsAdmin.tsx        (server, async)  SectorsAdmin(props: { searchParams: Promise<Record<string, string | string[] | undefined>> })
// destinations/DestinationsAdmin.tsx (server, async)  DestinationsAdmin(props: { searchParams: <idem> })
// shifts/ShiftsAdmin.tsx          (server, async)  ShiftsAdmin(props: { searchParams: <idem> })
// items/ItemsAdmin.tsx            (server, async)  ItemsAdmin(props: { searchParams: <idem> })
// team/TeamAdmin.tsx              (server, async)  TeamAdmin(props: { searchParams: <idem> })
// cada um: `await requireAdmin()` (passa a `actor`), lê os dados, monta AdminPageHeader + formulário de criação + lista + Pagination; estado vazio com EmptyState

SectorCreateForm()                                                   // client; <NameForm entity="setor" submitLabel="Criar setor" …/> → createSectorAction
SectorRowActions(props: { sector: SectorRow })                       // client; EditDialog (NameForm → renameSectorAction) + ActiveToggleButton (setSectorActiveAction)
DestinationCreateForm()                                              // client; submitLabel "Criar destino"
DestinationRowActions(props: { destination: DestinationRow })        // client
ShiftForm(props: { sectorId: string; initial: ShiftFormDefaults & { id?: string }; submitLabel: string; onDone?: () => void })
// client; com `initial.id` chama updateShiftAction, sem id chama createShiftAction; campos "Nome do turno", "Início", "Fim" (<Input type="time" step={60}>); dica ao vivo "Atravessa a meia-noite." quando fim < início; depois de criar ou editar, um `toast.warning` por aviso de sobreposição (máx. 3)
ShiftRowActions(props: { shift: ShiftRow })                          // client; MoveButtons (moveShiftAction) + EditDialog (ShiftForm) + ActiveToggleButton; reativar mostra os avisos em `toast.warning` (máx. 3)
ItemForm(props: { sectorId: string; initial: ItemFormValues & { id?: string }; submitLabel: string; onDone?: () => void })
// client; SelectField "Unidade" (ITEM_UNITS + "Outro…") com campo "Outra unidade" quando "outro"; ChoiceGroup "Tipo" (opções de `ITEM_KINDS` de `@/lib/itemKinds`) com `description={ITEM_KIND_HELP[kind]}` (só a ajuda do tipo escolhido); erros por campo vêm de `fieldErrors`
ItemRowActions(props: { item: ItemRow })                             // client; MoveButtons + EditDialog (initial com splitUnit) + ActiveToggleButton
PersonForm(props: { person: PersonRow; sectors: readonly SectorChoice[]; onDone: () => void })  // client; ChoiceGroup "Papel" (Operador | Administrador) + SelectField "Setor" (só operador)
PersonRowActions(props: { person: PersonRow; sectors: readonly SectorChoice[] })                // client; EditDialog (PersonForm) + "Desativar" (ConfirmDialog) | "Reativar"
InviteForm(props: { sectors: readonly SectorChoice[] })              // client; campos "Nome de referência (opcional)", "Papel", "Setor"; depois do sucesso mostra <InviteLinkCard/>
InviteLinkCard(props: { url: string; expiresAt: Date; onReset: () => void }) // client; "Copiar link", "Compartilhar" (só se `navigator.share` existir; AbortError é silencioso), "Gerar outro convite"
PendingInviteActions(props: { id: string; label: string })           // client; ConfirmDialog → cancelInviteAction
```

### Helpers de teste

```ts
// test/db.ts
export const TABLES: readonly string[]; // + "shift", "item", "destination" (test/db.test.ts compara com pg_tables)

// test/fixtures.ts
export async function insertSector(db: Db, name?: string, options?: { active?: boolean }): Promise<{ id: string; name: string }>;
export async function insertShift(db: Db, input: { sectorId: string; name?: string; startsAt?: string; endsAt?: string; sortOrder?: number; active?: boolean }): Promise<{ id: string; name: string }>;
// defaults: name único `Turno ${uuid8}`, "06:00", "14:00", sortOrder = max do setor + 1, active true
export async function insertItem(db: Db, input: { sectorId: string; name?: string; unit?: string; kind?: ItemKind; sortOrder?: number; active?: boolean }): Promise<{ id: string; name: string }>;
// defaults: "unidade", "control"
export async function insertDestination(db: Db, input?: { name?: string; active?: boolean }): Promise<{ id: string; name: string }>;
export async function insertSession(db: Db, input: { userId: string; expiresAt?: Date }): Promise<{ id: string; token: string }>;
// session.updatedAt é notNull sem default: a fixture preenche; expiresAt padrão = daqui a 7 dias

// test/authz.ts
export function authzOf(input: { role: Role; userId?: string; sectorId?: string | null; name?: string; email?: string }): Authz; // admin sempre sai com sectorId null; operador sem sectorId ganha "00000000-0000-4000-8000-0000000000a1" (sem linha no banco: com FK, passe o id de insertSector); sectorId null lança

// e2e/db.ts
export async function countSessionsByEmail(db: Db, email: string): Promise<number>;
export { insertUser } from "../test/fixtures";
```

### Rotas e nomes fixos

- Rotas novas: `/admin/setores`, `/admin/turnos`, `/admin/itens`, `/admin/destinos`, `/admin/equipe`. Parâmetros: `?pagina=`, `?setor=<uuid>`, `?convites=` (só em equipe).
- Todas exigem sessão pelo `proxy.ts` (nenhuma é pública) e `requireAdmin()` na página.
- E2E: a mesma infraestrutura da Fase 1 (app em `http://localhost:3200`, banco em `54329`).

---

## Textos de interface (exatos — testes e E2E dependem deles)

**Comuns:** link `Voltar para Administração` · selo `Inativo` · botões de linha `Editar`, `Desativar`, `Reativar` (aria-label `Editar {nome}`, `Desativar {nome}`, `Reativar {nome}`) · botões de diálogo `Salvar alterações`, `Voltar` (fecha sem agir) · botão do `Dialog` `Fechar` (sr-only) · paginação: `<nav aria-label="Paginação">`, links `Anterior` e `Próxima`, texto `Página {n} de {m}` · toasts de criação `Setor criado.`, `Turno criado.`, `Item criado.`, `Destino criado.` · toast de edição `Alterações salvas.` · toasts de estado `{Setor|Turno|Item|Destino} desativado.` / `reativado.` · mover: botões `Subir {nome}` / `Descer {nome}` com tooltip `Subir` / `Descer`, sem toast no sucesso.

**`/admin` (visão geral):** título `Administração` · texto `Cadastros que a passagem de turno usa.` · cartões (link, título, descrição, contagem):
`Setores` — `Onde cada pessoa trabalha.` — `{n} ativos` (singular `1 ativo`) · `Turnos` — `Horários de cada setor.` — `{n} ativos` · `Itens` — `O que se conta na passagem.` — `{n} ativos` · `Destinos` — `Para onde os pedidos vão.` — `{n} ativos` · `Equipe` — `Pessoas, papéis e convites.` — `{n} pessoas ativas · {m} convites pendentes` (singulares `1 pessoa ativa`, `1 convite pendente`).

**`/admin/setores`:** título `Setores` · texto `Onde cada pessoa trabalha. Turnos e itens são cadastrados por setor.` · cartão `Novo setor` · campo `Nome do setor` · botão `Criar setor` · linha: nome, selo `Inativo`, detalhe `{n} pessoas ativas · {m} convites pendentes` (`1 pessoa ativa`, `1 convite pendente`, `0 pessoas ativas`) · diálogo `Editar setor` · vazio: título `Nenhum setor ainda.`, texto `Crie o primeiro setor acima para cadastrar turnos, itens e convidar operadores.`

**`/admin/turnos`:** título `Turnos` · texto `Horários de cada setor. Um turno pode passar da meia-noite.` · seletor de setor (nav `Setor`) · cartão `Novo turno` · campos `Nome do turno` (padrão `Turno N`), `Início`, `Fim` (padrões de F2-9) · dica `Fim menor que o início atravessa a meia-noite.` · dica ao vivo `Atravessa a meia-noite.` · botão `Criar turno` · linha: nome, `{início}–{fim}` (`tabular-nums`), selo `Atravessa a meia-noite`, aviso `Sobrepõe o turno {nome} ({início}–{fim})` (ícone de alerta + texto, `text-warning-foreground`) · diálogo `Editar turno` · vazio: `Nenhum turno neste setor.` / `Crie o primeiro turno acima. A passagem de turno usa esses horários.` · sem setor ativo: `Nenhum setor ativo.` / `Cadastre ou reative um setor para criar turnos.` com link `Ir para Setores`.

**`/admin/itens`:** título `Itens` · texto `O que se conta na passagem de cada setor.` · seletor de setor · cartão `Novo item` · campos `Nome do item`, `Unidade` (opções `Unidade`, `Rolo`, `Par`, `Pacote`, `Caixa`, `Saco`, `Metro`, `kg`, `Outro…`), `Outra unidade` (só com `Outro…`), `Tipo` (`Controle` | `Estoque`) · ajudas do tipo: `Controle: soma no período, como redes danificadas.` / `Estoque: vale a última contagem, nunca a soma.` · botão `Criar item` · linha: nome, unidade (rótulo da lista, como `Rolo`, ou o texto de Outro), selo do tipo (`Controle`/`Estoque`), `Inativo` · diálogo `Editar item` · vazio: `Nenhum item neste setor.` / `Crie o primeiro item acima. É o que o operador conta na passagem.` · sem setor ativo: `Nenhum setor ativo.` / `Cadastre ou reative um setor para criar itens.` com link `Ir para Setores`.

**`/admin/destinos`:** título `Destinos` · texto `Para onde os pedidos de material vão. Valem para todos os setores.` · cartão `Novo destino` · campo `Nome do destino` · botão `Criar destino` · diálogo `Editar destino` · vazio: `Nenhum destino ainda.` / `Crie o primeiro destino acima, por exemplo o almoxarifado.`

**`/admin/equipe`:** título `Equipe` · texto `Pessoas, papéis e convites.`
- **Convidar:** cartão `Convidar pessoa` · campos `Nome de referência (opcional)` (ajuda `Só para você reconhecer o convite na lista.`), `Papel` (`Operador` | `Administrador`, padrão Operador), `Setor` (só para Operador; padrão = primeiro setor ativo) · botão `Gerar convite` · sem setor ativo e papel Operador: texto `Cadastre um setor antes de convidar um operador.` com link `Ir para Setores`.
- **Link gerado:** título `Convite gerado` · campo somente leitura (aria-label `Link do convite`) · botões `Copiar link`, `Compartilhar`, `Gerar outro convite` · texto `Válido até {data}. O link aparece só agora: se perder, cancele o convite e gere outro.` · toasts `Link copiado.` / `Não foi possível copiar. Selecione o link e copie.` · texto do compartilhamento: título `Convite para o Closery`, texto `Você foi convidado para o Closery.`.
- **Convites pendentes:** seção `Convites pendentes` · vazio `Nenhum convite pendente.` · linha: `{nome de referência}` ou `Sem nome de referência`, selo `Operador · {setor}` ou `Administrador`, `Válido até {data}`, `Convidado por {nome}` (sem convidante: `Convidado pelo sistema`) · botão `Cancelar convite` (aria-label `Cancelar convite {nome de referência ou "sem nome"}`) · confirmação: título `Cancelar convite?`, texto `O link deixa de funcionar. Não dá para desfazer.`, botões `Cancelar convite` e `Voltar` · toast `Convite cancelado.`
- **Pessoas:** seção `Pessoas` · linha: nome, e-mail, selo de papel (`Administrador`/`Operador`), setor (`{setor}` ou `{setor} (inativo)`), `Inativo` · própria conta: selo `Você` e texto `Peça a outro administrador para mudar a sua conta.` (sem botões) · diálogo `Editar pessoa` (descrição = nome) com `Papel`, `Setor`, e para Administrador o texto `Administradores veem todos os setores.` · confirmação de desativar: título `Desativar {nome}?`, texto `A pessoa perde o acesso agora e as sessões abertas são encerradas. O histórico dela continua. Você pode reativar depois.`, botões `Desativar` e `Voltar` · toasts `Pessoa desativada.` / `Pessoa reativada.` / `Convite gerado.`

**Mensagens de domínio (`message` do `AdminResult`):**

| Código / origem | Mensagem |
|---|---|
| `INVALID_INPUT` (geral) | `Confira os campos e tente de novo.` |
| nome vazio / longo | `Informe o nome.` · `O nome pode ter no máximo 60 caracteres.` |
| horário inválido | `Informe um horário válido, como 06:00.` |
| início == fim | `O início e o fim não podem ser iguais.` (campo `endsAt`) |
| unidade | `Escolha uma unidade.` · `Informe a unidade.` · `A unidade pode ter no máximo 20 caracteres.` |
| rótulo do convite longo | `O nome de referência pode ter no máximo 80 caracteres.` |
| id malformado | `Registro inválido. Atualize a página.` |
| papel inválido | `Escolha o papel.` |
| tipo do item inválido | `Escolha o tipo do item.` |
| qualquer outro campo de tipo errado (`userId`, `active`, `direction`, `inviteeLabel`) | `Confira os campos e tente de novo.` (`INVALID_INPUT_MESSAGE`) |
| `NAME_TAKEN` | setor: `Já existe um setor com este nome.` · turno: `Já existe um turno com este nome neste setor.` · item: `Já existe um item com este nome neste setor.` · destino: `Já existe um destino com este nome.` · se o conflitante estiver inativo, acrescenta ` Ele está inativo: reative-o na lista.` (campo `name`) |
| `NOT_FOUND` | `{Setor\|Turno\|Item\|Destino} não encontrado. Atualize a página.` · `Pessoa não encontrada. Atualize a página.` |
| `SECTOR_REQUIRED` | `Escolha o setor do operador.` |
| `SECTOR_INACTIVE` | `Este setor está inativo. Escolha outro.` (pessoa e convite) · `Este setor está inativo. Reative-o para cadastrar turnos.` · `… cadastrar itens.` · `O setor desta pessoa está inativo. Edite a pessoa e escolha outro setor antes de reativar.` |
| `SECTOR_IN_USE` | pessoas e convites: `Este setor tem {p} pessoas ativas e {i} convites pendentes. Mova, desative ou cancele antes.` · só pessoas: `Este setor tem {p} pessoas ativas. Mova ou desative antes.` · só convites: `Este setor tem {i} convites pendentes. Cancele antes.` (singular: `1 pessoa ativa`, `1 convite pendente`) |
| `SELF_CHANGE` | desativar: `Você não pode desativar a sua própria conta. Peça a outro administrador.` · papel: `Você não pode mudar o seu próprio papel. Peça a outro administrador.` |
| `LAST_ADMIN` | `Este é o último administrador ativo. Nomeie outro antes.` |
| `INVITE_NOT_PENDING` | `Este convite não está mais pendente. Atualize a página.` |
| `INTERNAL` | `Não foi possível concluir. Tente de novo.` |

---

## Tarefas

| # | Tarefa | Depende de |
|---|---|---|
| 1 | Schema e migração `0002`: `shift`, `item`, `destination`, índices `lower(name)`, `CHECK`s (P18), fixtures e `TABLES` | — |
| 2 | Lógica pura: nome, horário, sobreposição, unidades, paginação, reordenação, mensagens, `pluralize`, `formatDateTimeBR` | 1 |
| 3 | Contrato das actions: `AdminResult`, `dbErrors`, schemas Zod, `runAdminAction`, `authzOf`, guarda `actionsAuth.test.ts` | 1, 2 |
| 4 | Primitivos shadcn (`toggle-group`, `native-select`, `dialog`) com alvos de toque e "Fechar" | — |
| 5 | UI compartilhada do admin (`src/components/admin/*`) | 2, 3, 4 |
| 6 | Setores e Destinos: domínio, actions, páginas | 1, 2, 3, 5 |
| 7 | Turnos: domínio (sobreposição, ordem), actions, página | 1, 2, 3, 5, 6 |
| 8 | Itens: domínio (unidade "Outro", ordem), actions, página | 1, 2, 3, 5, 6 |
| 9 | Equipe — pessoas: papel, setor, desativar (derruba sessões, P11), último admin | 1, 2, 3, 5, 6 |
| 10 | Equipe — convites: gerar, copiar/compartilhar, listar pendentes, cancelar | 3, 5, 6, 9 |
| 11 | Visão geral `/admin` e guarda de páginas (mínimo de 9 páginas) | 2, 5, 6–10 |
| 12 | E2E Playwright dos cadastros e da equipe | 6–11 |
| 13 | Documentação de contexto, pendências (P11, P18 fechadas) e verificação final | 1–12 |

**Casos que cada tarefa precisa provar (além do feliz):**
1. CHECK de papel e de horário recusam (`23514`); `lower(name)` recusa `"Uld"` vs `"ULD"` e `"Água"` vs `"ÁGUA"` (`23505`); mesmo nome em **setores diferentes** passa em `shift` e `item`; `TABLES` bate com `pg_tables`; a migração aplica sobre os dados da 0001.
2. Cada função pura com vazio, zero, máximo, unicode e meia-noite (22:00–06:00 × 05:00–07:00 sobrepõe; 06:00–14:00 × 14:00–22:00 não; 23:00–01:00 × 00:00–02:00 sobrepõe); `parsePage("abc" | "0" | "-1" | ["2"] | undefined)`; `moveId` nas duas bordas e com id ausente; `buildPageHref` preserva `setor`.
3. `runAdminAction`: entrada inválida, falha de domínio repassada, exceção inesperada vira `INTERNAL` sem vazar texto, `notFound`/`redirect` passam intactos, `revalidatePath` só em sucesso; guarda `actionsAuth` reprova action sem `requireAdmin(`.
4. `Dialog`, `ToggleGroup`, `NativeSelect` com alvo ≥ 44px abaixo de `md` e textos em pt-BR.
5. Cada componente compartilhado: estados (carregando, vazio, erro), teclado, `aria-label` + tooltip dos ícones, `ChoiceGroup` não desmarca, `ConfirmDialog` não fecha em erro, `NameForm` preserva o que foi digitado quando o servidor recusa.
6. Setor: criar, renomear, nome repetido (com caixa diferente e inativo), desativar bloqueado por pessoa ativa **e** por convite pendente (válido; um expirado **não** bloqueia), reativar, paginação; cada action: operador → `notFound` sem tocar o banco.
7. Turno: horários que atravessam a meia-noite, `warnings` ao criar/editar/reativar, setor inativo, mover nas bordas e com `sort_order` duplicado, padrões de `getShiftFormDefaults`, `canMoveUp/Down` entre páginas.
8. Item: unidade da lista, "Outro" válido/vazio/longo/igual a uma da lista, `splitUnit` de unidade antiga, tipo, mover, mesmo nome em outro setor passa.
9. Pessoa: operador sem setor, setor inativo, admin→operador e operador→admin, autoedição, **último admin** (dois admins que se desativam em sequência: o segundo é recusado), desativar apaga **todas** as sessões e só as dela (P11), reativar operador com setor inativo, idempotência.
10. Convite: operador exige setor ativo, admin ignora setor, rótulo vazio/longo, o link tem o token que `findInviteByToken` aceita, `cancelInvite` (pendente → `true`; usado, expirado, já cancelado, inexistente → `false`), lista só mostra convites válidos e paginados, convite cancelado/usado some da lista.
11. `getAdminOverviewCounts` conta só ativos/pendentes; o cartão mostra singular e plural; operador recebe `notFound`; `appPagesAuth.test.ts` passa com as 9 páginas.
12. Cenários E2E (cada um com dados próprios e IP próprio, como na Fase 1): (a) admin cria setor, turno, item e destino e os vê nas listas; (b) admin gera convite de operador para o setor novo, o operador se cadastra e a linha dele na Equipe mostra esse setor; (c) admin desativa o operador, `countSessionsByEmail` = 0 e a próxima navegação do operador vai para `/entrar`; (d) operador em `/admin/setores` e `/admin/equipe` vê `Página não encontrada`; (e) a linha da própria conta do admin mostra `Você`, o texto de ajuda e nenhum botão; (f) setor com operador ativo não desativa (mensagem de `SECTOR_IN_USE`).
13. Todos os comandos verdes, `build` e `test:e2e` verdes, docs coerentes com o código.

**Fatias de redação sugeridas** (para redatores em paralelo): [1, 2, 3] · [4, 5] · [6] · [7, 8] · [9, 10] · [11, 12, 13]. As tarefas 7 e 8 só dependem do contrato (`listActiveSectors`, `resolveSectorFilter`, `SectorSwitcher`) e não do código da 6.

<!-- As tarefas detalhadas entram abaixo. -->

### Task 1: Schema e migração 0002 (shift, item, destination, lower(name), CHECKs de papel), fixtures e TABLES

**Files:**
- Create: `src/lib/itemKinds.ts`
- Create: `src/db/schema/catalog.ts`
- Create: `drizzle/0002_fase2_cadastros.sql` (gerado pelo drizzle-kit), `drizzle/meta/0002_snapshot.json` (gerado)
- Create: `test/sqlError.ts`
- Modify: `src/db/schema/sectors.ts` (troca `.unique()` de `name` por `uniqueIndex("sector_name_lower_uq")`)
- Modify: `src/db/schema/auth.ts` (+ `check("user_role_valid", …)` em `user`)
- Modify: `src/db/schema/invites.ts` (+ `check("invite_role_valid", …)` em `invite`)
- Modify: `src/db/schema/index.ts` (+ `export * from "./catalog";`)
- Modify: `drizzle/meta/_journal.json` (gerado: entrada `0002_fase2_cadastros`)
- Modify: `test/db.ts` (`TABLES` + `"shift"`, `"item"`, `"destination"`)
- Modify: `test/fixtures.ts` (imports; `insertSector` com `options.active`; novos `insertShift`, `insertItem`, `insertDestination`, `insertSession`)
- Test: `src/db/schema/catalog.test.ts` (novo), `src/db/schema/migration0002.test.ts` (novo), `src/db/schema/sectors.test.ts` (modificar), `test/db.test.ts` (já existe; passa a provar o novo `TABLES`)

**Interfaces:**
- Consumes: `ROLES` de `@/lib/roles`; `createTestDb`, `resetDb`, `TestDb` de `test/db.ts`; `insertUser` de `test/fixtures.ts`.
- Produces:
  - `ITEM_KINDS`, `ItemKind` em `src/lib/itemKinds.ts` **e reexportados** por `src/db/schema/catalog.ts` (o código de cliente importa de `@/lib/itemKinds`; ver contractIssues).
  - Tabelas `shift`, `item`, `destination` (`@/db/schema`), índices `sector_name_lower_uq`, `shift_sector_name_lower_uq`, `item_sector_name_lower_uq`, `destination_name_lower_uq`, CHECKs `user_role_valid`, `invite_role_valid`, `item_kind_valid`, `shift_starts_ne_ends`.
  - `test/fixtures.ts`: `insertSector(db, name?, options?: { active?: boolean })`, `insertShift(db, { sectorId; name?; startsAt?; endsAt?; sortOrder?; active? })`, `insertItem(db, { sectorId; name?; unit?; kind?; sortOrder?; active? })`, `insertDestination(db, input?: { name?; active? })`, `insertSession(db, { userId; expiresAt? })` — todos devolvem `Promise<{ id: string; … }>` como no contrato.
  - `test/sqlError.ts`: `sqlErrorOf(operation: PromiseLike<unknown>): Promise<{ code?: string; constraint?: string }>` (lê `error.cause`, F2-18; lança se a operação não falhar).
  - Fato verificado: `ON DELETE restrict` falha com SQLSTATE **23001** (restrict_violation), não 23503; FK para linha inexistente é 23503.

- [ ] **Step 1: Write the failing tests**

Crie `test/sqlError.ts` (helper dos testes de constraint):

```ts
// Roda uma operação que deve falhar e devolve o SQLSTATE e o nome da
// constraint. O Drizzle 0.45 embrulha o erro do driver: o original fica em
// `error.cause` (F2-18). Se a operação não falhar, lança.
export type SqlError = { code?: string; constraint?: string };

function pick(source: unknown, key: "code" | "constraint"): string | undefined {
  if (typeof source !== "object" || source === null || !(key in source)) {
    return undefined;
  }
  const value: unknown = Reflect.get(source, key);
  return typeof value === "string" ? value : undefined;
}

export async function sqlErrorOf(
  operation: PromiseLike<unknown>,
): Promise<SqlError> {
  try {
    await operation;
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined;
    const source = typeof cause === "object" && cause !== null ? cause : error;
    return {
      code: pick(source, "code"),
      constraint: pick(source, "constraint"),
    };
  }
  throw new Error("a operação deveria ter falhado");
}
```

Crie `src/db/schema/catalog.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ITEM_KINDS } from "@/lib/itemKinds";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertDestination,
  insertItem,
  insertSector,
  insertSession,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { sqlErrorOf } from "../../../test/sqlError";
import { session, user } from "./auth";
import { destination, item, shift } from "./catalog";
import { invite } from "./invites";
import { sector } from "./sectors";

describe("tabelas do cadastro", () => {
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

  describe("shift", () => {
    it("grava e devolve o horário como texto HH:mm:ss", async () => {
      const setor = await insertSector(db, "ULD");
      const [row] = await db
        .insert(shift)
        .values({
          sectorId: setor.id,
          name: "Turno Noite",
          startsAt: "22:00",
          endsAt: "06:00",
          sortOrder: 1,
        })
        .returning();
      expect(row?.startsAt).toBe("22:00:00");
      expect(row?.endsAt).toBe("06:00:00");
      expect(row?.active).toBe(true);
    });

    it("aceita atravessar a meia-noite (fim menor que o início)", async () => {
      const setor = await insertSector(db);
      const created = await insertShift(db, {
        sectorId: setor.id,
        startsAt: "23:30",
        endsAt: "00:30",
      });
      expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("recusa início igual ao fim com 23514 (shift_starts_ne_ends)", async () => {
      const setor = await insertSector(db);
      const failure = await sqlErrorOf(
        insertShift(db, {
          sectorId: setor.id,
          startsAt: "06:00",
          endsAt: "06:00",
        }),
      );
      expect(failure).toEqual({
        code: "23514",
        constraint: "shift_starts_ne_ends",
      });
    });

    it("recusa nome repetido no mesmo setor, sem diferença de caixa (23505)", async () => {
      const setor = await insertSector(db);
      await insertShift(db, { sectorId: setor.id, name: "Manhã" });
      const failure = await sqlErrorOf(
        insertShift(db, { sectorId: setor.id, name: "MANHÃ" }),
      );
      expect(failure).toEqual({
        code: "23505",
        constraint: "shift_sector_name_lower_uq",
      });
    });

    it("aceita o mesmo nome em setores diferentes", async () => {
      const a = await insertSector(db, "Setor A");
      const b = await insertSector(db, "Setor B");
      await insertShift(db, { sectorId: a.id, name: "Manhã" });
      const outro = await insertShift(db, { sectorId: b.id, name: "Manhã" });
      expect(outro.name).toBe("Manhã");
    });

    it("recusa setor inexistente com 23503 (FK)", async () => {
      const failure = await sqlErrorOf(
        insertShift(db, { sectorId: "00000000-0000-4000-8000-000000000000" }),
      );
      expect(failure.code).toBe("23503");
    });

    it("recusa apagar o setor que tem turno com 23001 (restrict)", async () => {
      const setor = await insertSector(db);
      await insertShift(db, { sectorId: setor.id });
      const failure = await sqlErrorOf(
        client.query("DELETE FROM sector WHERE id = $1", [setor.id]),
      );
      expect(failure.code).toBe("23001");
    });

    it("a fixture numera a ordem como o maior do setor + 1", async () => {
      const setor = await insertSector(db);
      const outro = await insertSector(db);
      await insertShift(db, { sectorId: setor.id });
      await insertShift(db, { sectorId: setor.id });
      await insertShift(db, { sectorId: outro.id });
      const rows = await db.select().from(shift);
      const orders = (id: string) =>
        rows
          .filter((row) => row.sectorId === id)
          .map((row) => row.sortOrder)
          .sort();
      expect(orders(setor.id)).toEqual([1, 2]);
      expect(orders(outro.id)).toEqual([1]);
    });
  });

  describe("item", () => {
    it("grava com os padrões da fixture", async () => {
      const setor = await insertSector(db);
      const created = await insertItem(db, { sectorId: setor.id });
      const [row] = await db.select().from(item);
      expect(row?.id).toBe(created.id);
      expect(row?.unit).toBe("unidade");
      expect(row?.kind).toBe("control");
      expect(row?.sortOrder).toBe(1);
      expect(row?.active).toBe(true);
    });

    it("aceita todos os tipos de ITEM_KINDS (a CHECK acompanha a lista)", async () => {
      const setor = await insertSector(db);
      for (const kind of ITEM_KINDS) {
        await insertItem(db, { sectorId: setor.id, kind });
      }
      const rows = await db.select({ kind: item.kind }).from(item);
      expect(rows.map((row) => row.kind).sort()).toEqual(
        [...ITEM_KINDS].sort(),
      );
    });

    it("recusa tipo fora de control/stock com 23514 (item_kind_valid)", async () => {
      const setor = await insertSector(db);
      const failure = await sqlErrorOf(
        client.query(
          "INSERT INTO item (sector_id, name, unit, kind, sort_order) VALUES ($1, 'Rede', 'unidade', 'outro', 1)",
          [setor.id],
        ),
      );
      expect(failure).toEqual({ code: "23514", constraint: "item_kind_valid" });
    });

    it("recusa nome repetido no mesmo setor, com acento e caixa diferentes (23505)", async () => {
      const setor = await insertSector(db);
      await insertItem(db, { sectorId: setor.id, name: "Água" });
      const failure = await sqlErrorOf(
        insertItem(db, { sectorId: setor.id, name: "ÁGUA" }),
      );
      expect(failure).toEqual({
        code: "23505",
        constraint: "item_sector_name_lower_uq",
      });
    });

    it("aceita o mesmo nome em setores diferentes", async () => {
      const a = await insertSector(db, "Setor A");
      const b = await insertSector(db, "Setor B");
      await insertItem(db, { sectorId: a.id, name: "Rede de proteção" });
      const outro = await insertItem(db, {
        sectorId: b.id,
        name: "Rede de proteção",
      });
      expect(outro.name).toBe("Rede de proteção");
    });

    it("recusa unidade nula (23502)", async () => {
      const setor = await insertSector(db);
      const failure = await sqlErrorOf(
        client.query(
          "INSERT INTO item (sector_id, name, unit, kind, sort_order) VALUES ($1, 'Rede', NULL, 'control', 1)",
          [setor.id],
        ),
      );
      expect(failure.code).toBe("23502");
    });
  });

  describe("destination", () => {
    it("grava com id, active=true e createdAt", async () => {
      const created = await insertDestination(db, { name: "Almoxarifado" });
      const [row] = await db.select().from(destination);
      expect(row?.id).toBe(created.id);
      expect(row?.active).toBe(true);
      expect(row?.createdAt).toBeInstanceOf(Date);
    });

    it("recusa nome repetido sem diferença de caixa (23505)", async () => {
      await insertDestination(db, { name: "Almoxarifado" });
      const failure = await sqlErrorOf(
        insertDestination(db, { name: "ALMOXARIFADO" }),
      );
      expect(failure).toEqual({
        code: "23505",
        constraint: "destination_name_lower_uq",
      });
    });

    it("a fixture respeita active=false", async () => {
      await insertDestination(db, { active: false });
      const [row] = await db.select().from(destination);
      expect(row?.active).toBe(false);
    });
  });

  describe("sector (índice em lower(name))", () => {
    it('recusa "Uld" depois de "ULD" (23505, sector_name_lower_uq)', async () => {
      await insertSector(db, "ULD");
      const failure = await sqlErrorOf(insertSector(db, "Uld"));
      expect(failure).toEqual({
        code: "23505",
        constraint: "sector_name_lower_uq",
      });
    });

    it('recusa "Água" depois de "ÁGUA" (acento em UTF-8)', async () => {
      await insertSector(db, "ÁGUA");
      const failure = await sqlErrorOf(insertSector(db, "Água"));
      expect(failure.code).toBe("23505");
    });

    it("aceita nomes diferentes", async () => {
      await insertSector(db, "ULD");
      const outro = await insertSector(db, "Carga geral");
      expect(outro.name).toBe("Carga geral");
    });

    it("a fixture cria setor inativo com options.active=false", async () => {
      const setor = await insertSector(db, "Inativo", { active: false });
      const [row] = await db.select().from(sector);
      expect(row?.id).toBe(setor.id);
      expect(row?.active).toBe(false);
    });
  });

  describe("CHECK de papel (P18)", () => {
    it("user recusa papel desconhecido com 23514 (user_role_valid)", async () => {
      const setor = await insertSector(db);
      const failure = await sqlErrorOf(
        client.query(
          `INSERT INTO "user" (id, name, email, role, sector_id) VALUES ('u1', 'Pessoa', 'u1@example.test', 'gerente', $1)`,
          [setor.id],
        ),
      );
      expect(failure).toEqual({ code: "23514", constraint: "user_role_valid" });
    });

    it("user recusa mudar o papel para valor desconhecido", async () => {
      const setor = await insertSector(db);
      const pessoa = await insertUser(db, {
        role: "operator",
        sectorId: setor.id,
      });
      const failure = await sqlErrorOf(
        client.query(`UPDATE "user" SET role = 'root' WHERE id = $1`, [
          pessoa.id,
        ]),
      );
      expect(failure.code).toBe("23514");
    });

    it("user aceita admin e operator", async () => {
      const setor = await insertSector(db);
      await insertUser(db, { role: "admin", sectorId: null });
      await insertUser(db, { role: "operator", sectorId: setor.id });
      const rows = await db.select({ role: user.role }).from(user);
      expect(rows.map((row) => row.role).sort()).toEqual(["admin", "operator"]);
    });

    it("invite recusa papel desconhecido com 23514 (invite_role_valid)", async () => {
      const setor = await insertSector(db);
      const failure = await sqlErrorOf(
        client.query(
          `INSERT INTO invite (token_hash, role, sector_id, expires_at) VALUES ('h1', 'gerente', $1, now())`,
          [setor.id],
        ),
      );
      expect(failure).toEqual({
        code: "23514",
        constraint: "invite_role_valid",
      });
    });

    it("invite aceita admin sem setor", async () => {
      await client.query(
        `INSERT INTO invite (token_hash, role, expires_at) VALUES ('h2', 'admin', now())`,
      );
      const rows = await db.select().from(invite);
      expect(rows).toHaveLength(1);
    });
  });

  describe("insertSession", () => {
    it("cria sessão com updatedAt preenchido e validade de 7 dias", async () => {
      const pessoa = await insertUser(db, { role: "admin", sectorId: null });
      const antes = Date.now();
      const created = await insertSession(db, { userId: pessoa.id });
      const [row] = await db
        .select()
        .from(session)
        .where(eq(session.id, created.id));
      expect(row?.updatedAt).toBeInstanceOf(Date);
      const dias = ((row?.expiresAt.getTime() ?? 0) - antes) / 86_400_000;
      expect(dias).toBeGreaterThan(6.99);
      expect(dias).toBeLessThan(7.01);
    });

    it("respeita expiresAt informado e recusa usuário inexistente", async () => {
      const pessoa = await insertUser(db, { role: "admin", sectorId: null });
      const expiresAt = new Date("2030-01-01T00:00:00Z");
      const created = await insertSession(db, { userId: pessoa.id, expiresAt });
      const [row] = await db
        .select()
        .from(session)
        .where(eq(session.id, created.id));
      expect(row?.expiresAt.getTime()).toBe(expiresAt.getTime());

      const failure = await sqlErrorOf(
        insertSession(db, { userId: "fantasma" }),
      );
      expect(failure.code).toBe("23503");
    });
  });
});
```

Crie `src/db/schema/migration0002.test.ts` (prova que a 0002 aplica **sobre dados já existentes da 0001**, que é o que o `db:migrate` faz no Neon, e o que a bloqueia):

```ts
import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it } from "vitest";

import { sqlErrorOf } from "../../../test/sqlError";

// Aplica as migrações na ordem, parando antes da 0002, e insere dados "da
// produção" (Fase 1). Depois aplica a 0002 por cima: é o que o db:migrate faz
// no Neon.
const MIGRATIONS = readdirSync("drizzle")
  .filter((file) => file.endsWith(".sql"))
  .sort();

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

function migrationFile(prefix: string): string {
  const file = MIGRATIONS.find((name) => name.startsWith(prefix));
  if (!file) throw new Error(`migração ${prefix} não encontrada`);
  return file;
}

describe("migração 0002 sobre os dados da 0001", () => {
  let client: PGlite | undefined;

  afterEach(async () => {
    await client?.close();
    client = undefined;
  });

  async function dbAtPhase1(): Promise<PGlite> {
    const created = new PGlite();
    client = created;
    await created.waitReady;
    await applyMigration(created, migrationFile("0000"));
    await applyMigration(created, migrationFile("0001"));
    await created.exec(`
      INSERT INTO sector (id, name) VALUES ('11111111-1111-4111-8111-111111111111', 'ULD');
      INSERT INTO "user" (id, name, email, role, sector_id)
        VALUES ('u-admin', 'Admin Teste', 'admin@example.test', 'admin', NULL),
               ('u-op', 'Operador Teste', 'op@example.test', 'operator', '11111111-1111-4111-8111-111111111111');
      INSERT INTO invite (token_hash, role, sector_id, expires_at)
        VALUES ('hash-1', 'operator', '11111111-1111-4111-8111-111111111111', now() + interval '7 days');
    `);
    return created;
  }

  it("aplica e preserva setor, usuários e convites existentes", async () => {
    const pg = await dbAtPhase1();
    await applyMigration(pg, migrationFile("0002"));

    const sectors = await pg.query("SELECT name FROM sector");
    const users = await pg.query(`SELECT id FROM "user"`);
    const invites = await pg.query("SELECT role FROM invite");
    expect(sectors.rows).toEqual([{ name: "ULD" }]);
    expect(users.rows).toHaveLength(2);
    expect(invites.rows).toEqual([{ role: "operator" }]);

    const tables = await pg.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('shift', 'item', 'destination')",
    );
    expect(tables.rows).toHaveLength(3);
  });

  it("troca a constraint unique do setor pelo índice em lower(name)", async () => {
    const pg = await dbAtPhase1();
    await applyMigration(pg, migrationFile("0002"));

    const failure = await sqlErrorOf(
      pg.query("INSERT INTO sector (name) VALUES ('uld')"),
    );
    expect(failure).toEqual({
      code: "23505",
      constraint: "sector_name_lower_uq",
    });
  });

  it("falha, sem aplicar nada do que vem depois, se já houver setores que só diferem na caixa", async () => {
    const pg = await dbAtPhase1();
    await pg.exec("INSERT INTO sector (name) VALUES ('Uld')");

    const failure = await sqlErrorOf(applyMigration(pg, migrationFile("0002")));
    expect(failure.code).toBe("23505");

    const roleCheck = await pg.query(
      "SELECT 1 FROM pg_constraint WHERE conname = 'user_role_valid'",
    );
    expect(roleCheck.rows).toHaveLength(0);
  });

  it("falha se já houver usuário com papel fora de admin/operator", async () => {
    const pg = await dbAtPhase1();
    await pg.exec(
      `INSERT INTO "user" (id, name, email, role, sector_id) VALUES ('u-x', 'Fora', 'x@example.test', 'gerente', '11111111-1111-4111-8111-111111111111')`,
    );

    const failure = await sqlErrorOf(applyMigration(pg, migrationFile("0002")));
    expect(failure.code).toBe("23514");
  });
});
```

Em `src/db/schema/sectors.test.ts`, acrescente este teste logo **antes** de `it("recusa nome nulo", …)`:

```ts
  it('recusa nome que só difere na caixa: "Uld" depois de "ULD" (23505)', async () => {
    await db.insert(sector).values({ name: "ULD" });
    const attempt = await db
      .insert(sector)
      .values({ name: "Uld" })
      .then(
        () => null,
        (error: unknown) => error,
      );
    expect(sqlState(attempt)).toBe("23505");
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/db/schema test/db.test.ts`
Expected: FAIL. `catalog.test.ts` com `Cannot find package '@/lib/itemKinds'` (o primeiro import que falha; depois vem `./catalog`); `migration0002.test.ts` com `Error: migração 0002 não encontrada`; `sectors.test.ts` com `expected undefined to be '23505'` (hoje só o `unique` exato existe).

- [ ] **Step 3: Write the schema**

Crie `src/lib/itemKinds.ts` (fora de `src/db` para o cliente importar sem arrastar o drizzle; mesmo padrão de `roles.ts`):

```ts
// Fora de src/db para o cliente poder importar sem arrastar o drizzle
// (mesmo padrão de roles.ts). O schema reexporta de catalog.ts.
export const ITEM_KINDS = ["control", "stock"] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];
```

Crie `src/db/schema/catalog.ts`:

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { ITEM_KINDS } from "@/lib/itemKinds";

import { sector } from "./sectors";

// Item de controle soma no período; item de estoque vale a última contagem.
export { ITEM_KINDS, type ItemKind } from "@/lib/itemKinds";

// Turno do setor. Atravessar a meia-noite é permitido (ends_at < starts_at);
// só início igual ao fim é recusado.
export const shift = pgTable(
  "shift",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectorId: uuid("sector_id")
      .notNull()
      .references(() => sector.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    startsAt: time("starts_at").notNull(),
    endsAt: time("ends_at").notNull(),
    sortOrder: integer("sort_order").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Começa por sector_id: já cobre a FK.
    uniqueIndex("shift_sector_name_lower_uq").on(
      table.sectorId,
      sql`lower(${table.name})`,
    ),
    check("shift_starts_ne_ends", sql`${table.startsAt} <> ${table.endsAt}`),
  ],
);

export const item = pgTable(
  "item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sectorId: uuid("sector_id")
      .notNull()
      .references(() => sector.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    unit: text("unit").notNull(),
    kind: text("kind", { enum: ITEM_KINDS }).notNull(),
    sortOrder: integer("sort_order").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("item_sector_name_lower_uq").on(
      table.sectorId,
      sql`lower(${table.name})`,
    ),
    check("item_kind_valid", sql`${table.kind} in ('control', 'stock')`),
  ],
);

// Destino de pedido de material; vale para todos os setores.
export const destination = pgTable(
  "destination",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("destination_name_lower_uq").on(sql`lower(${table.name})`),
  ],
);
```

Substitua **todo** o conteúdo de `src/db/schema/sectors.ts`:

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// Setor da operação (primeiro: ULD). Operador pertence a um setor; admin vê todos.
// Nome único sem diferença de caixa: "Uld" e "ULD" são o mesmo setor.
export const sector = pgTable(
  "sector",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("sector_name_lower_uq").on(sql`lower(${table.name})`),
  ],
);
```

Em `src/db/schema/auth.ts`, no array de restrições da tabela `user`, acrescente a linha marcada (logo abaixo do `index("user_sector_id_idx")`; `sql` e `check` já estão importados):

```ts
  (table) => [
    index("user_sector_id_idx").on(table.sectorId),
    check("user_role_valid", sql`${table.role} in ('admin', 'operator')`),
    check(
      "user_operator_needs_sector",
      sql`${table.role} = 'admin' or ${table.sectorId} is not null`,
    ),
  ],
```

Em `src/db/schema/invites.ts`, no array de restrições de `invite`, acrescente a linha marcada (logo abaixo do `index("invite_used_by_idx")`):

```ts
    index("invite_used_by_idx").on(table.usedBy),
    check("invite_role_valid", sql`${table.role} in ('admin', 'operator')`),
    check(
      "invite_operator_needs_sector",
```

Em `src/db/schema/index.ts`, entre `./auth` e `./invites`:

```ts
// Schema do banco (Drizzle). Mudou aqui? bun run db:generate → revisar o SQL
// → bun run db:migrate.
export * from "./auth";
export * from "./catalog";
export * from "./invites";
export * from "./sectors";
```

- [ ] **Step 4: Generate the migration and review the SQL**

Run: `bun run db:generate -- --name fase2_cadastros`
Expected: `[✓] Your SQL migration file ➜ drizzle\0002_fase2_cadastros.sql`, `11 tables`, e mudanças em `drizzle/meta/_journal.json` (a entrada nova tem um `when` próprio da sua máquina: não copie o de outro lugar) e `drizzle/meta/0002_snapshot.json`.

Abra `drizzle/0002_fase2_cadastros.sql` e confira **item a item** (foi exatamente isto que o clone gerou; a ordem dos statements pode variar, o conteúdo não):

```sql
CREATE TABLE "destination" (... "created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE "item" (... CONSTRAINT "item_kind_valid" CHECK ("item"."kind" in ('control', 'stock')));
CREATE TABLE "shift" (... "starts_at" time NOT NULL, "ends_at" time NOT NULL, ...
  CONSTRAINT "shift_starts_ne_ends" CHECK ("shift"."starts_at" <> "shift"."ends_at"));
ALTER TABLE "sector" DROP CONSTRAINT "sector_name_unique";
ALTER TABLE "item" ADD CONSTRAINT "item_sector_id_sector_id_fk" FOREIGN KEY ("sector_id") REFERENCES "public"."sector"("id") ON DELETE restrict ON UPDATE no action;
ALTER TABLE "shift" ADD CONSTRAINT "shift_sector_id_sector_id_fk" FOREIGN KEY ... ON DELETE restrict ON UPDATE no action;
CREATE UNIQUE INDEX "destination_name_lower_uq" ON "destination" USING btree (lower("name"));
CREATE UNIQUE INDEX "item_sector_name_lower_uq" ON "item" USING btree ("sector_id",lower("name"));
CREATE UNIQUE INDEX "shift_sector_name_lower_uq" ON "shift" USING btree ("sector_id",lower("name"));
CREATE UNIQUE INDEX "sector_name_lower_uq" ON "sector" USING btree (lower("name"));
ALTER TABLE "user" ADD CONSTRAINT "user_role_valid" CHECK ("user"."role" in ('admin', 'operator'));
ALTER TABLE "invite" ADD CONSTRAINT "invite_role_valid" CHECK ("invite"."role" in ('admin', 'operator'));
```

O que revisar antes de aplicar: (a) **nenhum** `DROP TABLE`/`DROP COLUMN`; o único `DROP` é `sector_name_unique`; (b) `ON DELETE restrict` nas duas FKs; (c) os quatro `CREATE UNIQUE INDEX` usam `lower("name")` (os de `shift` e `item` começam por `"sector_id"`); (d) as duas CHECKs de papel; (e) o arquivo termina sem statement quebrado (`--> statement-breakpoint` entre todos). A migração **falha** se já houver dois setores que só diferem na caixa ou um `user`/`invite` com papel fora de `admin`/`operator` (provado em `migration0002.test.ts`); antes do `db:migrate` real, rode no banco de dev: `SELECT lower(name), count(*) FROM sector GROUP BY 1 HAVING count(*) > 1;` e `SELECT DISTINCT role FROM "user" UNION SELECT DISTINCT role FROM invite;` (esperado: nenhuma linha e só `admin`/`operator`).

- [ ] **Step 5: Update TABLES and the fixtures**

Em `test/db.ts`, acrescente as três tabelas ao fim de `TABLES`:

```ts
export const TABLES: readonly string[] = [
  "sector",
  "user",
  "session",
  "account",
  "verification",
  "passkey",
  "rate_limit",
  "invite",
  "shift",
  "item",
  "destination",
];
```

Em `test/fixtures.ts`, troque o bloco de imports (do topo até `import type { Role } …`) por:

```ts
import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { session, user } from "@/db/schema/auth";
import { destination, type ItemKind, item, shift } from "@/db/schema/catalog";
import { invite } from "@/db/schema/invites";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import type { CreateInviteInput } from "@/features/invites/inviteQueries";
import { INVITE_TTL_MS } from "@/features/invites/inviteState";
import { generateInviteToken } from "@/features/invites/token";
import type { Role } from "@/lib/roles";
```

Substitua a função `insertSector` atual por este bloco e deixe `insertUser` e `insertInvite` onde estão (o bloco novo vem **entre** `insertSector` e `insertUser`):

```ts
export async function insertSector(
  db: Db,
  name = `Setor ${randomUUID().slice(0, 8)}`,
  options: { active?: boolean } = {},
): Promise<{ id: string; name: string }> {
  const [created] = await db
    .insert(sector)
    .values({ name, active: options.active ?? true })
    .returning({ id: sector.id, name: sector.name });
  if (!created) throw new Error("fixture: setor não criado");
  return created;
}

// Turno do setor. Padrões: nome único, 06:00–14:00, ordem = maior do setor + 1.
export async function insertShift(
  db: Db,
  input: {
    sectorId: string;
    name?: string;
    startsAt?: string;
    endsAt?: string;
    sortOrder?: number;
    active?: boolean;
  },
): Promise<{ id: string; name: string }> {
  const [created] = await db
    .insert(shift)
    .values({
      sectorId: input.sectorId,
      name: input.name ?? `Turno ${randomUUID().slice(0, 8)}`,
      startsAt: input.startsAt ?? "06:00",
      endsAt: input.endsAt ?? "14:00",
      sortOrder:
        input.sortOrder ??
        sql`(select coalesce(max(${shift.sortOrder}), 0) + 1 from ${shift} where ${shift.sectorId} = ${input.sectorId})`,
      active: input.active ?? true,
    })
    .returning({ id: shift.id, name: shift.name });
  if (!created) throw new Error("fixture: turno não criado");
  return created;
}

// Item do setor. Padrões: nome único, "unidade", "control", ordem = maior + 1.
export async function insertItem(
  db: Db,
  input: {
    sectorId: string;
    name?: string;
    unit?: string;
    kind?: ItemKind;
    sortOrder?: number;
    active?: boolean;
  },
): Promise<{ id: string; name: string }> {
  const [created] = await db
    .insert(item)
    .values({
      sectorId: input.sectorId,
      name: input.name ?? `Item ${randomUUID().slice(0, 8)}`,
      unit: input.unit ?? "unidade",
      kind: input.kind ?? "control",
      sortOrder:
        input.sortOrder ??
        sql`(select coalesce(max(${item.sortOrder}), 0) + 1 from ${item} where ${item.sectorId} = ${input.sectorId})`,
      active: input.active ?? true,
    })
    .returning({ id: item.id, name: item.name });
  if (!created) throw new Error("fixture: item não criado");
  return created;
}

export async function insertDestination(
  db: Db,
  input: { name?: string; active?: boolean } = {},
): Promise<{ id: string; name: string }> {
  const [created] = await db
    .insert(destination)
    .values({
      name: input.name ?? `Destino ${randomUUID().slice(0, 8)}`,
      active: input.active ?? true,
    })
    .returning({ id: destination.id, name: destination.name });
  if (!created) throw new Error("fixture: destino não criado");
  return created;
}

// session.updatedAt é notNull sem default: a fixture preenche.
// expiresAt padrão = daqui a 7 dias.
export async function insertSession(
  db: Db,
  input: { userId: string; expiresAt?: Date },
): Promise<{ id: string; token: string }> {
  const id = randomUUID().replaceAll("-", "");
  const token = randomUUID().replaceAll("-", "");
  const now = new Date();
  const [created] = await db
    .insert(session)
    .values({
      id,
      token,
      userId: input.userId,
      expiresAt:
        input.expiresAt ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      updatedAt: now,
    })
    .returning({ id: session.id, token: session.token });
  if (!created) throw new Error("fixture: sessão não criada");
  return created;
}
```

Rode `bunx biome check --write src test` (organiza imports e quebras de linha; nada deve mudar além de espaços).

- [ ] **Step 6: Run test to verify it passes**

Run: `bun run test -- src/db/schema test/db.test.ts`
Expected: PASS (40 testes: `catalog.test.ts` 28, `migration0002.test.ts` 4, `sectors.test.ts` 6, `test/db.test.ts` 2). O `global-setup` migra 0000, 0001 e 0002 num PGlite novo a cada execução, então `TABLES` é conferido contra o schema real.

- [ ] **Step 7: Apply the migration to the dev Neon branch (manual, fora do clone)**

No checkout principal (que tem `.env.local`), depois de rodar as duas consultas de pré-condição do Step 4: `bun run db:migrate`
Expected: termina sem erro e sem `error:`; confirme com `bun run db:studio` (ou o console do Neon) que existem `shift`, `item`, `destination`. **Não** rode `db:migrate` em clone/worktree sem `.env.local`, e **nunca** `db:push`.

- [ ] **Step 8: Typecheck, lint, suite and commit**

Run: `bun run check-types && bun run lint && bun run test`
Expected: tudo verde (a suíte inteira, sem falhas).

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-1.txt` (texto exato abaixo) e rode:
```bash
git add drizzle/0002_fase2_cadastros.sql drizzle/meta/0002_snapshot.json drizzle/meta/_journal.json src/lib/itemKinds.ts src/db/schema/auth.ts src/db/schema/catalog.ts src/db/schema/catalog.test.ts src/db/schema/index.ts src/db/schema/invites.ts src/db/schema/migration0002.test.ts src/db/schema/sectors.ts src/db/schema/sectors.test.ts test/db.ts test/fixtures.ts test/sqlError.ts
git commit -F .git/sdd/msg-task-1.txt
```
Mensagem:
```text
feat(db): turnos, itens, destinos e nomes únicos sem caixa (migração 0002)

Cria shift, item e destination; troca o unique de sector.name por índice em
lower(name); CHECK de papel em user e invite (P18). Fixtures insertShift,
insertItem, insertDestination, insertSession e insertSector(active).

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

(Esta tarefa não cria componente de UI: `ui-registry.md` não muda.)

---

### Task 2: Lógica pura (nome, horário, sobreposição, unidade, paginação, reordenação, mensagens)

**Files:**
- Create: `src/lib/plural.ts`, `src/lib/dateTime.ts`
- Create: `src/features/admin/names.ts`, `timeOfDay.ts`, `shiftRules.ts`, `itemOptions.ts`, `pagination.ts`, `reorder.ts`, `messages.ts`
- Test: `src/lib/plural.test.ts`, `src/lib/dateTime.test.ts`, `src/features/admin/names.test.ts`, `timeOfDay.test.ts`, `shiftRules.test.ts`, `itemOptions.test.ts`, `pagination.test.ts`, `reorder.test.ts`, `messages.test.ts`

**Interfaces:**
- Consumes: `ItemKind` de `@/lib/itemKinds` (Tarefa 1).
- Produces: exatamente as assinaturas do contrato (`pluralize`, `formatDateTimeBR`, `NAME_MAX_LENGTH`, `normalizeName`, `validateName`, `MINUTES_PER_DAY`, `TIME_INPUT_PATTERN`, `parseTimeOfDay`, `formatTimeOfDay`, `toDbTime`, `fromDbTime`, `ShiftRange`, `NamedShiftRange`, `OverlapWarning`, `crossesMidnight`, `shiftSegments`, `rangesOverlap`, `findOverlaps`, `formatOverlapWarning`, `suggestShiftTimes`, `suggestShiftName`, `ITEM_UNITS`, `ItemUnit`, `OTHER_UNIT`, `UnitChoice`, `DEFAULT_UNIT`, `UNIT_MAX_LENGTH`, `ITEM_UNIT_LABELS`, `ITEM_KIND_LABELS`, `ITEM_KIND_HELP`, `ItemFormValues`, `ITEM_FORM_DEFAULTS`, `resolveUnit`, `splitUnit`, `PAGE_SIZE`, `CHOICE_LIST_LIMIT`, `MAX_PAGE`, `Page<T>`, `parsePage`, `resolvePage`, `buildPageHref`, `SortDirection`, `moveId`, `planSortUpdates`, `AdminEntity`, `nameTakenMessage`, `notFoundMessage`, `sectorBlockedMessage`, `SELF_DEACTIVATE_MESSAGE`, `SELF_ROLE_MESSAGE`, `LAST_ADMIN_MESSAGE`, `SECTOR_REQUIRED_MESSAGE`, `SECTOR_INACTIVE_MESSAGE`, `INVITE_NOT_PENDING_MESSAGE`, `INVITE_LABEL_TOO_LONG_MESSAGE`, `PERSON_SECTOR_INACTIVE_MESSAGE`).
- Comportamentos que as tarefas seguintes herdam: `parseTimeOfDay` aceita `"HH:mm"` e `"HH:mm:00"`; `fromDbTime`/`toDbTime`/`crossesMidnight`/`shiftSegments` lançam `RangeError` para horário inválido; `shiftSegments` descarta segmento vazio (`22:00–00:00` = `[[1320, 1440]]`; início == fim = `[]`); `parsePage` devolve 1 também **acima** de `MAX_PAGE`; `sectorBlockedMessage(0, 0)` lança `RangeError`; `resolveUnit("outro", "Rolo")` devolve a unidade da lista (`"rolo"`); `splitUnit("Rolo")` (caixa diferente) devolve `{ choice: "outro", other: "Rolo" }`.
- Nota de escape: o código usa `\u{2013}`, `\u{301}` e `\u{a0}` (forma com chaves), nunca `–`/`́`, porque algumas ferramentas de escrita convertem a forma de 4 dígitos em caractere literal (o combinante some a olho nu e o teste de NFC perde o sentido).

- [ ] **Step 1: Write the failing tests**

`src/lib/plural.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { pluralize } from "@/lib/plural";

describe("pluralize", () => {
  it("usa o singular só para 1", () => {
    expect(pluralize(1, "pessoa", "pessoas")).toBe("1 pessoa");
  });

  it("usa o plural para 0, 2 e números grandes", () => {
    expect(pluralize(0, "pessoa", "pessoas")).toBe("0 pessoas");
    expect(pluralize(2, "pessoa", "pessoas")).toBe("2 pessoas");
    expect(pluralize(1000, "pessoa", "pessoas")).toBe("1000 pessoas");
  });

  it("aceita expressões com mais de uma palavra", () => {
    expect(pluralize(1, "convite pendente", "convites pendentes")).toBe(
      "1 convite pendente",
    );
    expect(pluralize(3, "convite pendente", "convites pendentes")).toBe(
      "3 convites pendentes",
    );
  });
});
```

`src/lib/dateTime.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { formatDateTimeBR } from "@/lib/dateTime";

describe("formatDateTimeBR", () => {
  it("formata dia/mês/ano e hora no fuso de São Paulo", () => {
    expect(formatDateTimeBR(new Date("2026-11-28T17:30:00Z"))).toBe(
      "28/11/2026, 14:30",
    );
  });

  it("meia-noite em São Paulo é 03:00 UTC: 00:00 do mesmo dia", () => {
    expect(formatDateTimeBR(new Date("2026-11-28T03:00:00Z"))).toBe(
      "28/11/2026, 00:00",
    );
  });

  it("um minuto antes da meia-noite ainda é o dia anterior", () => {
    expect(formatDateTimeBR(new Date("2026-11-28T02:59:00Z"))).toBe(
      "27/11/2026, 23:59",
    );
  });

  it("vira o ano no fuso de São Paulo, não no UTC", () => {
    expect(formatDateTimeBR(new Date("2027-01-01T02:00:00Z"))).toBe(
      "31/12/2026, 23:00",
    );
  });
});
```

`src/features/admin/names.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  NAME_MAX_LENGTH,
  normalizeName,
  validateName,
} from "@/features/admin/names";

describe("normalizeName", () => {
  it("tira espaços das pontas e colapsa os do meio", () => {
    expect(normalizeName("  Rede   de \t proteção \n")).toBe(
      "Rede de proteção",
    );
  });

  it("converte para NFC: 'e' + acento combinante vira 'é'", () => {
    const decomposed = "Cafe\u{301}";
    expect(decomposed).toHaveLength(5);
    expect(normalizeName(decomposed)).toBe("Café");
    expect(normalizeName(decomposed)).toHaveLength(4);
  });

  it("devolve vazio para vazio ou só espaços", () => {
    expect(normalizeName("")).toBe("");
    expect(normalizeName("   \n\t ")).toBe("");
  });

  it("colapsa espaço não separável e outros espaços Unicode", () => {
    expect(normalizeName("Carga\u{a0}\u{a0}geral")).toBe("Carga geral");
  });
});

describe("validateName", () => {
  it("aceita um nome e devolve o normalizado", () => {
    expect(validateName("  Carga   geral ")).toEqual({
      ok: true,
      name: "Carga geral",
    });
  });

  it("recusa vazio e só espaços com 'Informe o nome.'", () => {
    expect(validateName("")).toEqual({ ok: false, message: "Informe o nome." });
    expect(validateName("   ")).toEqual({
      ok: false,
      message: "Informe o nome.",
    });
  });

  it("aceita exatamente 60 caracteres e recusa 61", () => {
    expect(NAME_MAX_LENGTH).toBe(60);
    expect(validateName("a".repeat(60)).ok).toBe(true);
    expect(validateName("a".repeat(61))).toEqual({
      ok: false,
      message: "O nome pode ter no máximo 60 caracteres.",
    });
  });

  it("conta pontos de código: 60 emojis cabem, 61 não", () => {
    const emoji = "\u{1F600}";
    expect(emoji).toHaveLength(2);
    expect(validateName(emoji.repeat(60)).ok).toBe(true);
    expect(validateName(emoji.repeat(61)).ok).toBe(false);
  });

  it("mede depois de normalizar: espaços sobrando e acento decomposto não pesam", () => {
    const decomposed = "e\u{301}".repeat(60);
    expect(validateName(`  ${decomposed}  `)).toEqual({
      ok: true,
      name: "é".repeat(60),
    });
  });
});
```

`src/features/admin/timeOfDay.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  formatTimeOfDay,
  fromDbTime,
  MINUTES_PER_DAY,
  parseTimeOfDay,
  TIME_INPUT_PATTERN,
  toDbTime,
} from "@/features/admin/timeOfDay";

describe("parseTimeOfDay", () => {
  it("converte HH:mm em minutos, nos limites do dia", () => {
    expect(parseTimeOfDay("00:00")).toBe(0);
    expect(parseTimeOfDay("06:00")).toBe(360);
    expect(parseTimeOfDay("23:59")).toBe(1439);
  });

  it("aceita HH:mm:00 (o formato do banco)", () => {
    expect(parseTimeOfDay("06:00:00")).toBe(360);
    expect(parseTimeOfDay("00:00:00")).toBe(0);
  });

  it("recusa 24:00, hora sem zero, minuto 60, segundos e lixo", () => {
    for (const value of [
      "24:00",
      "6:00",
      "06:60",
      "06:00:30",
      "06:00:00:00",
      "0600",
      "ab:cd",
      "",
      " 06:00",
    ]) {
      expect(parseTimeOfDay(value), value).toBeNull();
    }
  });
});

describe("TIME_INPUT_PATTERN", () => {
  it("só casa HH:mm", () => {
    expect(TIME_INPUT_PATTERN.test("22:15")).toBe(true);
    expect(TIME_INPUT_PATTERN.test("22:15:00")).toBe(false);
    expect(TIME_INPUT_PATTERN.test("2:15")).toBe(false);
  });
});

describe("formatTimeOfDay", () => {
  it("formata com zeros à esquerda", () => {
    expect(formatTimeOfDay(0)).toBe("00:00");
    expect(formatTimeOfDay(65)).toBe("01:05");
    expect(formatTimeOfDay(1439)).toBe("23:59");
  });

  it("dá a volta no dia (módulo 1440), inclusive para negativos", () => {
    expect(MINUTES_PER_DAY).toBe(1440);
    expect(formatTimeOfDay(1440)).toBe("00:00");
    expect(formatTimeOfDay(1440 + 90)).toBe("01:30");
    expect(formatTimeOfDay(-60)).toBe("23:00");
  });
});

describe("toDbTime / fromDbTime", () => {
  it("toDbTime acrescenta os segundos", () => {
    expect(toDbTime("06:00")).toBe("06:00:00");
    expect(toDbTime("23:59")).toBe("23:59:00");
  });

  it("toDbTime lança RangeError para horário inválido", () => {
    expect(() => toDbTime("24:00")).toThrow(RangeError);
    expect(() => toDbTime("")).toThrow(RangeError);
  });

  it("fromDbTime tira os segundos e deixa HH:mm como está", () => {
    expect(fromDbTime("06:00:00")).toBe("06:00");
    expect(fromDbTime("22:00:00")).toBe("22:00");
    expect(fromDbTime("06:00")).toBe("06:00");
  });

  it("fromDbTime lança RangeError para o que não é horário", () => {
    expect(() => fromDbTime("lixo")).toThrow(RangeError);
    expect(() => fromDbTime("06:00:30")).toThrow(RangeError);
  });

  it("ida e volta preserva o horário", () => {
    expect(fromDbTime(toDbTime("13:45"))).toBe("13:45");
  });
});
```

`src/features/admin/shiftRules.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  crossesMidnight,
  findOverlaps,
  formatOverlapWarning,
  type NamedShiftRange,
  rangesOverlap,
  shiftSegments,
  suggestShiftName,
  suggestShiftTimes,
} from "@/features/admin/shiftRules";

function range(startsAt: string, endsAt: string) {
  return { startsAt, endsAt };
}

describe("crossesMidnight", () => {
  it("é verdadeiro quando o fim é menor que o início", () => {
    expect(crossesMidnight(range("22:00", "06:00"))).toBe(true);
    expect(crossesMidnight(range("23:59", "00:00"))).toBe(true);
  });

  it("é falso no mesmo dia", () => {
    expect(crossesMidnight(range("06:00", "14:00"))).toBe(false);
    expect(crossesMidnight(range("00:00", "23:59"))).toBe(false);
  });

  it("lança RangeError para horário inválido", () => {
    expect(() => crossesMidnight(range("25:00", "06:00"))).toThrow(RangeError);
  });
});

describe("shiftSegments", () => {
  it("um segmento no mesmo dia", () => {
    expect(shiftSegments(range("06:00", "14:00"))).toEqual([[360, 840]]);
  });

  it("dois segmentos ao atravessar a meia-noite", () => {
    expect(shiftSegments(range("22:00", "06:00"))).toEqual([
      [1320, 1440],
      [0, 360],
    ]);
  });

  it("termina exatamente à meia-noite: um segmento só, sem segmento vazio", () => {
    expect(shiftSegments(range("22:00", "00:00"))).toEqual([[1320, 1440]]);
  });

  it("início == fim não tem duração: nenhum segmento", () => {
    expect(shiftSegments(range("06:00", "06:00"))).toEqual([]);
  });
});

describe("rangesOverlap", () => {
  it("22:00–06:00 e 05:00–07:00 sobrepõem (meia-noite)", () => {
    expect(
      rangesOverlap(range("22:00", "06:00"), range("05:00", "07:00")),
    ).toBe(true);
  });

  it("23:00–01:00 e 00:00–02:00 sobrepõem, nos dois sentidos", () => {
    expect(
      rangesOverlap(range("23:00", "01:00"), range("00:00", "02:00")),
    ).toBe(true);
    expect(
      rangesOverlap(range("00:00", "02:00"), range("23:00", "01:00")),
    ).toBe(true);
  });

  it("encostar não sobrepõe: 06:00–14:00 e 14:00–22:00", () => {
    expect(
      rangesOverlap(range("06:00", "14:00"), range("14:00", "22:00")),
    ).toBe(false);
    expect(
      rangesOverlap(range("14:00", "22:00"), range("06:00", "14:00")),
    ).toBe(false);
  });

  it("encostar na meia-noite não sobrepõe: 22:00–06:00 e 06:00–14:00", () => {
    expect(
      rangesOverlap(range("22:00", "06:00"), range("06:00", "14:00")),
    ).toBe(false);
  });

  it("um minuto de sobreposição conta", () => {
    expect(
      rangesOverlap(range("06:00", "14:01"), range("14:00", "22:00")),
    ).toBe(true);
  });

  it("um dentro do outro sobrepõe", () => {
    expect(
      rangesOverlap(range("06:00", "22:00"), range("10:00", "12:00")),
    ).toBe(true);
  });

  it("intervalos separados não sobrepõem", () => {
    expect(
      rangesOverlap(range("06:00", "10:00"), range("12:00", "14:00")),
    ).toBe(false);
  });

  it("22:00–00:00 não sobrepõe 00:00–06:00", () => {
    expect(
      rangesOverlap(range("22:00", "00:00"), range("00:00", "06:00")),
    ).toBe(false);
  });
});

describe("findOverlaps", () => {
  const manha: NamedShiftRange = {
    id: "a",
    name: "Manhã",
    startsAt: "06:00",
    endsAt: "14:00",
  };
  const tarde: NamedShiftRange = {
    id: "b",
    name: "Tarde",
    startsAt: "14:00",
    endsAt: "22:00",
  };
  const noite: NamedShiftRange = {
    id: "c",
    name: "Noite",
    startsAt: "22:00",
    endsAt: "06:00",
  };

  it("devolve vazio sem outros turnos", () => {
    expect(findOverlaps(range("06:00", "14:00"), [])).toEqual([]);
  });

  it("devolve vazio quando os turnos só se encostam", () => {
    expect(findOverlaps(range("06:00", "14:00"), [tarde, noite])).toEqual([]);
  });

  it("devolve o aviso com o turno que sobrepõe, na ordem de entrada", () => {
    expect(
      findOverlaps(range("13:00", "23:00"), [noite, manha, tarde]),
    ).toEqual([
      { shiftId: "c", name: "Noite", startsAt: "22:00", endsAt: "06:00" },
      { shiftId: "a", name: "Manhã", startsAt: "06:00", endsAt: "14:00" },
      { shiftId: "b", name: "Tarde", startsAt: "14:00", endsAt: "22:00" },
    ]);
  });

  it("ignora o próprio turno ao editar (mesmo id)", () => {
    expect(
      findOverlaps({ id: "a", ...range("07:00", "15:00") }, [manha, tarde]),
    ).toEqual([
      { shiftId: "b", name: "Tarde", startsAt: "14:00", endsAt: "22:00" },
    ]);
  });

  it("sem id no candidato, nenhum turno é ignorado", () => {
    expect(findOverlaps(range("06:00", "14:00"), [manha])).toHaveLength(1);
  });

  it("pega a sobreposição pela meia-noite", () => {
    expect(
      findOverlaps(range("05:00", "07:00"), [manha, tarde, noite]).map(
        (warning) => warning.name,
      ),
    ).toEqual(["Manhã", "Noite"]);
  });
});

describe("formatOverlapWarning", () => {
  it("usa travessão curto entre os horários", () => {
    expect(
      formatOverlapWarning({
        shiftId: "a",
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      }),
    ).toBe("Sobrepõe o turno Manhã (06:00\u{2013}14:00)");
  });
});

describe("suggestShiftTimes", () => {
  it("sem turnos: 06:00 às 14:00", () => {
    expect(suggestShiftTimes([])).toEqual(range("06:00", "14:00"));
  });

  it("começa onde o último termina e dura 8 h", () => {
    expect(
      suggestShiftTimes([range("06:00", "14:00"), range("14:00", "22:00")]),
    ).toEqual(range("22:00", "06:00"));
  });

  it("usa o último da lista recebida, não o maior horário", () => {
    expect(
      suggestShiftTimes([range("14:00", "22:00"), range("06:00", "10:00")]),
    ).toEqual(range("10:00", "18:00"));
  });

  it("passa da meia-noite com módulo 24 h", () => {
    expect(suggestShiftTimes([range("20:00", "23:00")])).toEqual(
      range("23:00", "07:00"),
    );
  });

  it("último termina à meia-noite: próximo começa 00:00", () => {
    expect(suggestShiftTimes([range("16:00", "00:00")])).toEqual(
      range("00:00", "08:00"),
    );
  });
});

describe("suggestShiftName", () => {
  it("sem turnos: Turno 1", () => {
    expect(suggestShiftName([])).toBe("Turno 1");
  });

  it("quantidade + 1", () => {
    expect(suggestShiftName(["Manhã", "Tarde"])).toBe("Turno 3");
  });

  it("sobe enquanto o nome existir, sem diferença de caixa", () => {
    expect(suggestShiftName(["Turno 2", "Manhã"])).toBe("Turno 3");
    expect(suggestShiftName(["turno 3", "TURNO 4", "Manhã"])).toBe("Turno 5");
  });
});
```

`src/features/admin/itemOptions.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  DEFAULT_UNIT,
  ITEM_FORM_DEFAULTS,
  ITEM_KIND_HELP,
  ITEM_KIND_LABELS,
  ITEM_UNIT_LABELS,
  ITEM_UNITS,
  OTHER_UNIT,
  resolveUnit,
  splitUnit,
  UNIT_MAX_LENGTH,
} from "@/features/admin/itemOptions";

describe("listas e rótulos", () => {
  it("a lista de unidades é a decidida pelo dono, na ordem", () => {
    expect([...ITEM_UNITS]).toEqual([
      "unidade",
      "rolo",
      "par",
      "pacote",
      "caixa",
      "saco",
      "metro",
      "kg",
    ]);
  });

  it("toda unidade tem rótulo; só 'kg' fica em minúsculas", () => {
    for (const unit of ITEM_UNITS) {
      expect(ITEM_UNIT_LABELS[unit]).toBeTruthy();
    }
    expect(ITEM_UNIT_LABELS.unidade).toBe("Unidade");
    expect(ITEM_UNIT_LABELS.kg).toBe("kg");
  });

  it("rótulos e ajudas dos tipos", () => {
    expect(ITEM_KIND_LABELS).toEqual({ control: "Controle", stock: "Estoque" });
    expect(ITEM_KIND_HELP.control).toBe(
      "Controle: soma no período, como redes danificadas.",
    );
    expect(ITEM_KIND_HELP.stock).toBe(
      "Estoque: vale a última contagem, nunca a soma.",
    );
  });

  it("o formulário nunca começa em branco: unidade e tipo vêm preenchidos", () => {
    expect(DEFAULT_UNIT).toBe("unidade");
    expect(OTHER_UNIT).toBe("outro");
    expect(UNIT_MAX_LENGTH).toBe(20);
    expect(ITEM_FORM_DEFAULTS).toEqual({
      name: "",
      unitChoice: "unidade",
      unitOther: "",
      kind: "control",
    });
  });
});

describe("resolveUnit", () => {
  it("unidade da lista vale por ela mesma e ignora o texto de 'Outro'", () => {
    expect(resolveUnit("rolo", "")).toEqual({ ok: true, unit: "rolo" });
    expect(resolveUnit("kg", "lixo")).toEqual({ ok: true, unit: "kg" });
  });

  it("'Outro' com texto grava o texto normalizado", () => {
    expect(resolveUnit("outro", "  Bobina   grande ")).toEqual({
      ok: true,
      unit: "Bobina grande",
    });
  });

  it("'Outro' vazio ou só espaços: 'Informe a unidade.' no campo do texto", () => {
    expect(resolveUnit("outro", "")).toEqual({
      ok: false,
      field: "unitOther",
      message: "Informe a unidade.",
    });
    expect(resolveUnit("outro", "   ")).toEqual({
      ok: false,
      field: "unitOther",
      message: "Informe a unidade.",
    });
  });

  it("'Outro' aceita 20 caracteres e recusa 21", () => {
    expect(resolveUnit("outro", "a".repeat(20))).toEqual({
      ok: true,
      unit: "a".repeat(20),
    });
    expect(resolveUnit("outro", "a".repeat(21))).toEqual({
      ok: false,
      field: "unitOther",
      message: "A unidade pode ter no máximo 20 caracteres.",
    });
  });

  it("conta pontos de código: 20 emojis cabem", () => {
    expect(resolveUnit("outro", "\u{1F600}".repeat(20)).ok).toBe(true);
    expect(resolveUnit("outro", "\u{1F600}".repeat(21)).ok).toBe(false);
  });

  it("'Outro' igual a uma da lista (sem caixa) vira o valor da lista", () => {
    expect(resolveUnit("outro", "Rolo")).toEqual({ ok: true, unit: "rolo" });
    expect(resolveUnit("outro", " KG ")).toEqual({ ok: true, unit: "kg" });
  });

  it("escolha desconhecida ou vazia: 'Escolha uma unidade.' no campo da escolha", () => {
    const expected = {
      ok: false,
      field: "unitChoice",
      message: "Escolha uma unidade.",
    };
    expect(resolveUnit("litro", "")).toEqual(expected);
    expect(resolveUnit("", "")).toEqual(expected);
    expect(resolveUnit("Rolo", "")).toEqual(expected);
  });
});

describe("splitUnit", () => {
  it("unidade da lista volta como escolha, sem texto extra", () => {
    expect(splitUnit("pacote")).toEqual({ choice: "pacote", other: "" });
  });

  it("unidade antiga fora da lista vira 'Outro' com o texto", () => {
    expect(splitUnit("Bobina grande")).toEqual({
      choice: "outro",
      other: "Bobina grande",
    });
  });

  it("caixa diferente da lista também cai em 'Outro' (o dado antigo é preservado)", () => {
    expect(splitUnit("Rolo")).toEqual({ choice: "outro", other: "Rolo" });
  });

  it("ida e volta: o que splitUnit devolve, resolveUnit aceita", () => {
    for (const unit of ["rolo", "Bobina grande"]) {
      const { choice, other } = splitUnit(unit);
      expect(resolveUnit(choice, other)).toEqual({ ok: true, unit });
    }
  });
});
```

`src/features/admin/pagination.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  buildPageHref,
  CHOICE_LIST_LIMIT,
  MAX_PAGE,
  PAGE_SIZE,
  parsePage,
  resolvePage,
} from "@/features/admin/pagination";

describe("constantes", () => {
  it("valem o que o contrato diz", () => {
    expect(PAGE_SIZE).toBe(50);
    expect(CHOICE_LIST_LIMIT).toBe(200);
    expect(MAX_PAGE).toBe(10_000);
  });
});

describe("parsePage", () => {
  it("lê um inteiro positivo, inclusive dentro de um array", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage(["2"])).toBe(2);
    expect(parsePage(["2", "5"])).toBe(2);
    expect(parsePage(String(MAX_PAGE))).toBe(MAX_PAGE);
  });

  it("lixo, zero, negativo, decimal, vazio e ausente viram 1", () => {
    for (const raw of [
      "abc",
      "0",
      "-1",
      "2.5",
      "1e3",
      " 2",
      "2 ",
      "",
      "+3",
      "٣",
      undefined,
      [],
    ]) {
      expect(parsePage(raw), String(raw)).toBe(1);
    }
  });

  it("acima do teto vira 1 (e um número gigante também)", () => {
    expect(parsePage(String(MAX_PAGE + 1))).toBe(1);
    expect(parsePage("99999999999999999999999")).toBe(1);
  });
});

describe("resolvePage", () => {
  it("sem registros: página 1 de 1", () => {
    expect(resolvePage(0, 1)).toEqual({ page: 1, pageCount: 1, offset: 0 });
  });

  it("exatamente uma página cheia: 50 registros = 1 página; 51 = 2", () => {
    expect(resolvePage(50, 1).pageCount).toBe(1);
    expect(resolvePage(51, 1).pageCount).toBe(2);
  });

  it("calcula o deslocamento da página pedida", () => {
    expect(resolvePage(120, 3)).toEqual({ page: 3, pageCount: 3, offset: 100 });
    expect(resolvePage(120, 2).offset).toBe(50);
  });

  it("página além do fim é clampada para a última (nunca vazia por engano)", () => {
    expect(resolvePage(120, 99)).toEqual({
      page: 3,
      pageCount: 3,
      offset: 100,
    });
    expect(resolvePage(0, 5)).toEqual({ page: 1, pageCount: 1, offset: 0 });
  });

  it("página abaixo de 1 e total negativo são tratados como o mínimo", () => {
    expect(resolvePage(120, 0).page).toBe(1);
    expect(resolvePage(120, -4).page).toBe(1);
    expect(resolvePage(-10, 1)).toEqual({ page: 1, pageCount: 1, offset: 0 });
  });
});

describe("buildPageHref", () => {
  it("página 1 remove o parâmetro", () => {
    expect(buildPageHref("/admin/setores", {}, "pagina", 1)).toBe(
      "/admin/setores",
    );
  });

  it("página 2 acrescenta o parâmetro", () => {
    expect(buildPageHref("/admin/setores", {}, "pagina", 2)).toBe(
      "/admin/setores?pagina=2",
    );
  });

  it("preserva o setor e os outros parâmetros", () => {
    expect(
      buildPageHref(
        "/admin/turnos",
        { setor: "abc-123", pagina: "9" },
        "pagina",
        3,
      ),
    ).toBe("/admin/turnos?setor=abc-123&pagina=3");
    expect(
      buildPageHref(
        "/admin/turnos",
        { setor: "abc-123", pagina: "9" },
        "pagina",
        1,
      ),
    ).toBe("/admin/turnos?setor=abc-123");
  });

  it("ignora parâmetros indefinidos", () => {
    expect(
      buildPageHref("/admin/turnos", { setor: undefined }, "pagina", 2),
    ).toBe("/admin/turnos?pagina=2");
  });

  it("codifica os valores", () => {
    expect(
      buildPageHref("/admin/equipe", { busca: "a&b=c d" }, "convites", 2),
    ).toBe("/admin/equipe?busca=a%26b%3Dc+d&convites=2");
  });

  it("na Equipe, trocar uma lista mantém a página da outra", () => {
    expect(buildPageHref("/admin/equipe", { pagina: "2" }, "convites", 3)).toBe(
      "/admin/equipe?pagina=2&convites=3",
    );
  });
});
```

`src/features/admin/reorder.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { moveId, planSortUpdates } from "@/features/admin/reorder";

describe("moveId", () => {
  const ids = ["a", "b", "c"];

  it("sobe um passo", () => {
    expect(moveId(ids, "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveId(ids, "c", "up")).toEqual(["a", "c", "b"]);
  });

  it("desce um passo", () => {
    expect(moveId(ids, "a", "down")).toEqual(["b", "a", "c"]);
    expect(moveId(ids, "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("devolve null nas bordas: primeiro não sobe, último não desce", () => {
    expect(moveId(ids, "a", "up")).toBeNull();
    expect(moveId(ids, "c", "down")).toBeNull();
  });

  it("devolve null para id ausente e para lista vazia", () => {
    expect(moveId(ids, "x", "up")).toBeNull();
    expect(moveId([], "a", "down")).toBeNull();
  });

  it("lista de um só: nenhum movimento", () => {
    expect(moveId(["a"], "a", "up")).toBeNull();
    expect(moveId(["a"], "a", "down")).toBeNull();
  });

  it("não altera a lista recebida", () => {
    moveId(ids, "b", "up");
    expect(ids).toEqual(["a", "b", "c"]);
  });
});

describe("planSortUpdates", () => {
  it("não muda nada quando a ordem já está certa", () => {
    const current = [
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
    ];
    expect(planSortUpdates(current, ["a", "b"])).toEqual([]);
  });

  it("troca de dois vizinhos atualiza só os dois", () => {
    const current = [
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
      { id: "c", sortOrder: 3 },
    ];
    expect(planSortUpdates(current, ["b", "a", "c"])).toEqual([
      { id: "b", sortOrder: 1 },
      { id: "a", sortOrder: 2 },
    ]);
  });

  it("renumera 1..n quando há buracos (ordens 5, 9, 12)", () => {
    const current = [
      { id: "a", sortOrder: 5 },
      { id: "b", sortOrder: 9 },
      { id: "c", sortOrder: 12 },
    ];
    expect(planSortUpdates(current, ["a", "b", "c"])).toEqual([
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 2 },
      { id: "c", sortOrder: 3 },
    ]);
  });

  it("desfaz empate de sort_order (dois com o mesmo valor)", () => {
    const current = [
      { id: "a", sortOrder: 1 },
      { id: "b", sortOrder: 1 },
    ];
    expect(planSortUpdates(current, ["b", "a"])).toEqual([
      { id: "a", sortOrder: 2 },
    ]);
  });

  it("lista vazia não gera atualização", () => {
    expect(planSortUpdates([], [])).toEqual([]);
  });
});
```

`src/features/admin/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  INVITE_LABEL_TOO_LONG_MESSAGE,
  INVITE_NOT_PENDING_MESSAGE,
  LAST_ADMIN_MESSAGE,
  nameTakenMessage,
  notFoundMessage,
  PERSON_SECTOR_INACTIVE_MESSAGE,
  SECTOR_INACTIVE_MESSAGE,
  SECTOR_REQUIRED_MESSAGE,
  SELF_DEACTIVATE_MESSAGE,
  SELF_ROLE_MESSAGE,
  sectorBlockedMessage,
} from "@/features/admin/messages";

describe("nameTakenMessage", () => {
  it("diz o que já existe, por entidade", () => {
    expect(nameTakenMessage("setor", false)).toBe(
      "Já existe um setor com este nome.",
    );
    expect(nameTakenMessage("turno", false)).toBe(
      "Já existe um turno com este nome neste setor.",
    );
    expect(nameTakenMessage("item", false)).toBe(
      "Já existe um item com este nome neste setor.",
    );
    expect(nameTakenMessage("destino", false)).toBe(
      "Já existe um destino com este nome.",
    );
  });

  it("acrescenta a dica de reativar quando o conflitante está inativo", () => {
    expect(nameTakenMessage("setor", true)).toBe(
      "Já existe um setor com este nome. Ele está inativo: reative-o na lista.",
    );
    expect(nameTakenMessage("turno", true)).toBe(
      "Já existe um turno com este nome neste setor. Ele está inativo: reative-o na lista.",
    );
  });
});

describe("notFoundMessage", () => {
  it("uma mensagem por entidade", () => {
    expect(notFoundMessage("setor")).toBe(
      "Setor não encontrado. Atualize a página.",
    );
    expect(notFoundMessage("turno")).toBe(
      "Turno não encontrado. Atualize a página.",
    );
    expect(notFoundMessage("item")).toBe(
      "Item não encontrado. Atualize a página.",
    );
    expect(notFoundMessage("destino")).toBe(
      "Destino não encontrado. Atualize a página.",
    );
    expect(notFoundMessage("pessoa")).toBe(
      "Pessoa não encontrada. Atualize a página.",
    );
  });
});

describe("sectorBlockedMessage", () => {
  it("pessoas e convites, no plural", () => {
    expect(sectorBlockedMessage(3, 2)).toBe(
      "Este setor tem 3 pessoas ativas e 2 convites pendentes. Mova, desative ou cancele antes.",
    );
  });

  it("pessoas e convites, no singular", () => {
    expect(sectorBlockedMessage(1, 1)).toBe(
      "Este setor tem 1 pessoa ativa e 1 convite pendente. Mova, desative ou cancele antes.",
    );
  });

  it("só pessoas", () => {
    expect(sectorBlockedMessage(3, 0)).toBe(
      "Este setor tem 3 pessoas ativas. Mova ou desative antes.",
    );
    expect(sectorBlockedMessage(1, 0)).toBe(
      "Este setor tem 1 pessoa ativa. Mova ou desative antes.",
    );
  });

  it("só convites", () => {
    expect(sectorBlockedMessage(0, 2)).toBe(
      "Este setor tem 2 convites pendentes. Cancele antes.",
    );
    expect(sectorBlockedMessage(0, 1)).toBe(
      "Este setor tem 1 convite pendente. Cancele antes.",
    );
  });

  it("sem pessoas nem convites não há o que dizer: lança RangeError", () => {
    expect(() => sectorBlockedMessage(0, 0)).toThrow(RangeError);
  });
});

describe("mensagens fixas", () => {
  it("são os textos da tabela de mensagens de domínio", () => {
    expect(SELF_DEACTIVATE_MESSAGE).toBe(
      "Você não pode desativar a sua própria conta. Peça a outro administrador.",
    );
    expect(SELF_ROLE_MESSAGE).toBe(
      "Você não pode mudar o seu próprio papel. Peça a outro administrador.",
    );
    expect(LAST_ADMIN_MESSAGE).toBe(
      "Este é o último administrador ativo. Nomeie outro antes.",
    );
    expect(SECTOR_REQUIRED_MESSAGE).toBe("Escolha o setor do operador.");
    expect(SECTOR_INACTIVE_MESSAGE).toBe(
      "Este setor está inativo. Escolha outro.",
    );
    expect(INVITE_NOT_PENDING_MESSAGE).toBe(
      "Este convite não está mais pendente. Atualize a página.",
    );
    expect(INVITE_LABEL_TOO_LONG_MESSAGE).toBe(
      "O nome de referência pode ter no máximo 80 caracteres.",
    );
    expect(PERSON_SECTOR_INACTIVE_MESSAGE).toBe(
      "O setor desta pessoa está inativo. Edite a pessoa e escolha outro setor antes de reativar.",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/lib/plural src/lib/dateTime src/features/admin/names src/features/admin/timeOfDay src/features/admin/shiftRules src/features/admin/itemOptions src/features/admin/pagination src/features/admin/reorder src/features/admin/messages`
Expected: FAIL, 9 arquivos, todos com `Cannot find package '@/lib/plural'` (e equivalentes: `@/lib/dateTime`, `@/features/admin/names`, …). Nenhum teste chega a rodar.

- [ ] **Step 3: Write minimal implementation**

`src/lib/plural.ts`:

```ts
/** "1 pessoa", "0 pessoas", "3 pessoas": só o 1 usa o singular. */
export function pluralize(
  count: number,
  singular: string,
  plural: string,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}
```

`src/lib/dateTime.ts`:

```ts
const formatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

/** "28/11/2026, 14:30" no fuso de São Paulo, qualquer que seja o fuso do servidor. */
export function formatDateTimeBR(date: Date): string {
  return formatter.format(date);
}
```

`src/features/admin/names.ts`:

```ts
export const NAME_MAX_LENGTH = 60;

/** NFC + espaços colapsados + trim: o nome que vai para o banco. */
export function normalizeName(raw: string): string {
  return raw.normalize("NFC").replace(/\s+/g, " ").trim();
}

export function validateName(
  raw: string,
): { ok: true; name: string } | { ok: false; message: string } {
  const name = normalizeName(raw);
  if (name === "") return { ok: false, message: "Informe o nome." };
  // Conta pontos de código, não unidades UTF-16: um emoji vale 1.
  if ([...name].length > NAME_MAX_LENGTH) {
    return {
      ok: false,
      message: `O nome pode ter no máximo ${NAME_MAX_LENGTH} caracteres.`,
    };
  }
  return { ok: true, name };
}
```

`src/features/admin/timeOfDay.ts`:

```ts
export const MINUTES_PER_DAY = 1440;

export const TIME_INPUT_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "HH:mm" ou "HH:mm:00" → minutos desde 00:00 (0..1439); inválido → null. */
export function parseTimeOfDay(value: string): number | null {
  const hhmm =
    value.endsWith(":00") && value.length === 8 ? value.slice(0, 5) : value;
  const match = TIME_INPUT_PATTERN.exec(hhmm);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Minutos → "HH:mm", módulo 24 h (1440 → "00:00"; -60 → "23:00"). */
export function formatTimeOfDay(minutes: number): string {
  const wrapped =
    ((Math.trunc(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) %
    MINUTES_PER_DAY;
  const hours = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const mins = String(wrapped % 60).padStart(2, "0");
  return `${hours}:${mins}`;
}

/** "06:00" → "06:00:00" (o que o banco recebe). Lança RangeError se inválido. */
export function toDbTime(value: string): string {
  const minutes = parseTimeOfDay(value);
  if (minutes === null) {
    throw new RangeError(`Horário inválido: "${value}"`);
  }
  return `${formatTimeOfDay(minutes)}:00`;
}

/** "06:00:00" → "06:00"; "06:00" → "06:00". Lança RangeError se inválido. */
export function fromDbTime(value: string): string {
  const minutes = parseTimeOfDay(value);
  if (minutes === null) {
    throw new RangeError(`Horário inválido: "${value}"`);
  }
  return formatTimeOfDay(minutes);
}
```

`src/features/admin/shiftRules.ts`:

```ts
import { formatTimeOfDay, MINUTES_PER_DAY, parseTimeOfDay } from "./timeOfDay";

export type ShiftRange = { startsAt: string; endsAt: string }; // "HH:mm"
export type NamedShiftRange = ShiftRange & { id: string; name: string };
export type OverlapWarning = {
  shiftId: string;
  name: string;
  startsAt: string;
  endsAt: string;
};

const DEFAULT_START = "06:00";
const SUGGESTED_DURATION_MINUTES = 8 * 60;

function minutesOf(value: string): number {
  const minutes = parseTimeOfDay(value);
  if (minutes === null) throw new RangeError(`Horário inválido: "${value}"`);
  return minutes;
}

/** Atravessa a meia-noite quando o fim é menor que o início. */
export function crossesMidnight(range: ShiftRange): boolean {
  return minutesOf(range.endsAt) < minutesOf(range.startsAt);
}

/**
 * Intervalos semiabertos [início, fim) em minutos. Ao atravessar a meia-noite,
 * 22:00–06:00 vira [1320, 1440) e [0, 360). Segmento vazio some (22:00–00:00
 * é só [1320, 1440)).
 */
export function shiftSegments(
  range: ShiftRange,
): ReadonlyArray<readonly [number, number]> {
  const start = minutesOf(range.startsAt);
  const end = minutesOf(range.endsAt);
  const segments: Array<readonly [number, number]> =
    end >= start
      ? [[start, end]]
      : [
          [start, MINUTES_PER_DAY],
          [0, end],
        ];
  return segments.filter(([from, to]) => to > from);
}

/** Encostar (fim de um == início do outro) não sobrepõe. */
export function rangesOverlap(a: ShiftRange, b: ShiftRange): boolean {
  const segmentsOfB = shiftSegments(b);
  return shiftSegments(a).some(([aStart, aEnd]) =>
    segmentsOfB.some(([bStart, bEnd]) => aStart < bEnd && bStart < aEnd),
  );
}

/** `others` deve ter só os turnos ativos do setor; a ordem de entrada é preservada. */
export function findOverlaps(
  candidate: ShiftRange & { id?: string },
  others: readonly NamedShiftRange[],
): OverlapWarning[] {
  return others
    .filter(
      (other) =>
        (candidate.id === undefined || other.id !== candidate.id) &&
        rangesOverlap(candidate, other),
    )
    .map((other) => ({
      shiftId: other.id,
      name: other.name,
      startsAt: other.startsAt,
      endsAt: other.endsAt,
    }));
}

export function formatOverlapWarning(warning: OverlapWarning): string {
  return `Sobrepõe o turno ${warning.name} (${warning.startsAt}\u{2013}${warning.endsAt})`;
}

/** Começa onde o último turno ativo termina (ou 06:00) e dura 8 h. */
export function suggestShiftTimes(
  activeInOrder: readonly ShiftRange[],
): ShiftRange {
  const last = activeInOrder.at(-1);
  const startsAt = last
    ? formatTimeOfDay(minutesOf(last.endsAt))
    : DEFAULT_START;
  const endsAt = formatTimeOfDay(
    minutesOf(startsAt) + SUGGESTED_DURATION_MINUTES,
  );
  return { startsAt, endsAt };
}

/** "Turno N" com N = quantidade + 1; sobe enquanto o nome existir (sem diferença de caixa). */
export function suggestShiftName(existingNames: readonly string[]): string {
  const taken = new Set(existingNames.map((name) => name.toLowerCase()));
  let next = existingNames.length + 1;
  while (taken.has(`turno ${next}`)) next += 1;
  return `Turno ${next}`;
}
```

`src/features/admin/itemOptions.ts`:

```ts
import type { ItemKind } from "@/lib/itemKinds";

import { normalizeName } from "./names";

export const ITEM_UNITS = [
  "unidade",
  "rolo",
  "par",
  "pacote",
  "caixa",
  "saco",
  "metro",
  "kg",
] as const;
export type ItemUnit = (typeof ITEM_UNITS)[number];

export const OTHER_UNIT = "outro" as const;
export type UnitChoice = ItemUnit | typeof OTHER_UNIT;

export const DEFAULT_UNIT: ItemUnit = "unidade";
export const UNIT_MAX_LENGTH = 20;

export const ITEM_UNIT_LABELS: Readonly<Record<ItemUnit, string>> = {
  unidade: "Unidade",
  rolo: "Rolo",
  par: "Par",
  pacote: "Pacote",
  caixa: "Caixa",
  saco: "Saco",
  metro: "Metro",
  kg: "kg",
};

export const ITEM_KIND_LABELS: Readonly<Record<ItemKind, string>> = {
  control: "Controle",
  stock: "Estoque",
};

export const ITEM_KIND_HELP: Readonly<Record<ItemKind, string>> = {
  control: "Controle: soma no período, como redes danificadas.",
  stock: "Estoque: vale a última contagem, nunca a soma.",
};

export type ItemFormValues = {
  name: string;
  unitChoice: UnitChoice;
  unitOther: string;
  kind: ItemKind;
};

export const ITEM_FORM_DEFAULTS: ItemFormValues = {
  name: "",
  unitChoice: DEFAULT_UNIT,
  unitOther: "",
  kind: "control",
};

function isItemUnit(value: string): value is ItemUnit {
  return ITEM_UNITS.some((unit) => unit === value);
}

export function resolveUnit(
  choice: string,
  other: string,
):
  | { ok: true; unit: string }
  | { ok: false; field: "unitChoice" | "unitOther"; message: string } {
  if (isItemUnit(choice)) return { ok: true, unit: choice };

  if (choice !== OTHER_UNIT) {
    return { ok: false, field: "unitChoice", message: "Escolha uma unidade." };
  }

  const text = normalizeName(other);
  if (text === "") {
    return { ok: false, field: "unitOther", message: "Informe a unidade." };
  }
  if ([...text].length > UNIT_MAX_LENGTH) {
    return {
      ok: false,
      field: "unitOther",
      message: `A unidade pode ter no máximo ${UNIT_MAX_LENGTH} caracteres.`,
    };
  }

  // "Rolo" digitado em "Outro" é o "rolo" da lista: uma só grafia no banco.
  const known = ITEM_UNITS.find((unit) => unit === text.toLowerCase());
  return { ok: true, unit: known ?? text };
}

/** Unidade gravada → o que o formulário mostra; fora da lista vira "Outro". */
export function splitUnit(unit: string): { choice: UnitChoice; other: string } {
  if (isItemUnit(unit)) return { choice: unit, other: "" };
  return { choice: OTHER_UNIT, other: unit };
}
```

`src/features/admin/pagination.ts`:

```ts
export const PAGE_SIZE = 50;
export const CHOICE_LIST_LIMIT = 200;
export const MAX_PAGE = 10_000;

export type Page<T> = {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
  pageSize: number;
};

/** Lixo, zero, negativo, decimal, fora do teto ou ausente → 1. */
export function parsePage(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return page >= 1 && page <= MAX_PAGE ? page : 1;
}

/** Página fora do intervalo é clampada: a lista nunca fica vazia por engano. */
export function resolvePage(
  total: number,
  requested: number,
): { page: number; pageCount: number; offset: number } {
  const safeTotal = Math.max(0, total);
  const pageCount = Math.max(1, Math.ceil(safeTotal / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(requested)), pageCount);
  return { page, pageCount, offset: (page - 1) * PAGE_SIZE };
}

/** Mantém os outros parâmetros (ex.: setor); a página 1 remove o parâmetro. */
export function buildPageHref(
  pathname: string,
  params: Record<string, string | undefined>,
  param: string,
  page: number,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key !== param && value !== undefined) search.set(key, value);
  }
  if (page > 1) search.set(param, String(Math.floor(page)));
  const query = search.toString();
  return query === "" ? pathname : `${pathname}?${query}`;
}
```

`src/features/admin/reorder.ts`:

```ts
export type SortDirection = "up" | "down";

/** Nova ordem dos ids com `id` um passo para cima/baixo; null se ausente ou já na borda. */
export function moveId(
  ids: readonly string[],
  id: string,
  direction: SortDirection,
): string[] | null {
  const from = ids.indexOf(id);
  if (from === -1) return null;
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= ids.length) return null;
  const next = [...ids];
  next[from] = ids[to] ?? id;
  next[to] = id;
  return next;
}

/** Renumera 1..n e devolve só quem muda (empates de sort_order se desfazem). */
export function planSortUpdates(
  current: readonly { id: string; sortOrder: number }[],
  nextIds: readonly string[],
): { id: string; sortOrder: number }[] {
  const currentOrder = new Map(current.map((row) => [row.id, row.sortOrder]));
  return nextIds
    .map((id, index) => ({ id, sortOrder: index + 1 }))
    .filter((update) => currentOrder.get(update.id) !== update.sortOrder);
}
```

`src/features/admin/messages.ts`:

```ts
import { pluralize } from "@/lib/plural";

export type AdminEntity = "setor" | "turno" | "item" | "destino" | "pessoa";

const NAME_TAKEN: Record<Exclude<AdminEntity, "pessoa">, string> = {
  setor: "Já existe um setor com este nome.",
  turno: "Já existe um turno com este nome neste setor.",
  item: "Já existe um item com este nome neste setor.",
  destino: "Já existe um destino com este nome.",
};

const NOT_FOUND: Record<AdminEntity, string> = {
  setor: "Setor não encontrado. Atualize a página.",
  turno: "Turno não encontrado. Atualize a página.",
  item: "Item não encontrado. Atualize a página.",
  destino: "Destino não encontrado. Atualize a página.",
  pessoa: "Pessoa não encontrada. Atualize a página.",
};

/** `inactive`: o registro que já tem o nome está desativado; a tela diz onde reativar. */
export function nameTakenMessage(
  entity: Exclude<AdminEntity, "pessoa">,
  inactive: boolean,
): string {
  const base = NAME_TAKEN[entity];
  return inactive ? `${base} Ele está inativo: reative-o na lista.` : base;
}

export function notFoundMessage(entity: AdminEntity): string {
  return NOT_FOUND[entity];
}

/** Só faz sentido com pelo menos uma pessoa ou um convite; com zero e zero lança. */
export function sectorBlockedMessage(people: number, invites: number): string {
  const peopleText = pluralize(people, "pessoa ativa", "pessoas ativas");
  const invitesText = pluralize(
    invites,
    "convite pendente",
    "convites pendentes",
  );
  if (people > 0 && invites > 0) {
    return `Este setor tem ${peopleText} e ${invitesText}. Mova, desative ou cancele antes.`;
  }
  if (people > 0)
    return `Este setor tem ${peopleText}. Mova ou desative antes.`;
  if (invites > 0) return `Este setor tem ${invitesText}. Cancele antes.`;
  throw new RangeError(
    "O setor não tem pessoas nem convites: nada o bloqueia.",
  );
}

export const SELF_DEACTIVATE_MESSAGE =
  "Você não pode desativar a sua própria conta. Peça a outro administrador.";
export const SELF_ROLE_MESSAGE =
  "Você não pode mudar o seu próprio papel. Peça a outro administrador.";
export const LAST_ADMIN_MESSAGE =
  "Este é o último administrador ativo. Nomeie outro antes.";
export const SECTOR_REQUIRED_MESSAGE = "Escolha o setor do operador.";
export const SECTOR_INACTIVE_MESSAGE =
  "Este setor está inativo. Escolha outro.";
export const INVITE_NOT_PENDING_MESSAGE =
  "Este convite não está mais pendente. Atualize a página.";
export const INVITE_LABEL_TOO_LONG_MESSAGE =
  "O nome de referência pode ter no máximo 80 caracteres.";
export const PERSON_SECTOR_INACTIVE_MESSAGE =
  "O setor desta pessoa está inativo. Edite a pessoa e escolha outro setor antes de reativar.";
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- src/lib/plural src/lib/dateTime src/features/admin/names src/features/admin/timeOfDay src/features/admin/shiftRules src/features/admin/itemOptions src/features/admin/pagination src/features/admin/reorder src/features/admin/messages`
Expected: PASS (107 testes em 9 arquivos: plural 3, dateTime 4, names 9, timeOfDay 11, shiftRules 30, itemOptions 15, pagination 15, reorder 11, messages 9).

- [ ] **Step 5: Biome, typecheck, lint, suite and commit**

Run: `bunx biome check --write src && bun run check-types && bun run lint && bun run test`
Expected: tudo verde; o Biome não deve alterar nada (o código acima já está formatado).

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-2.txt` (texto exato abaixo) e rode:
```bash
git add src/lib/plural.ts src/lib/plural.test.ts src/lib/dateTime.ts src/lib/dateTime.test.ts src/features/admin/names.ts src/features/admin/names.test.ts src/features/admin/timeOfDay.ts src/features/admin/timeOfDay.test.ts src/features/admin/shiftRules.ts src/features/admin/shiftRules.test.ts src/features/admin/itemOptions.ts src/features/admin/itemOptions.test.ts src/features/admin/pagination.ts src/features/admin/pagination.test.ts src/features/admin/reorder.ts src/features/admin/reorder.test.ts src/features/admin/messages.ts src/features/admin/messages.test.ts
git commit -F .git/sdd/msg-task-2.txt
```
Mensagem:
```text
feat(admin): lógica pura dos cadastros (nome, horário, sobreposição, unidade, paginação)

Funções puras com testes de limite: meia-noite, encostar não sobrepõe, NFC,
pontos de código, parsePage com lixo, buildPageHref preservando o setor,
reordenação com empate, mensagens de domínio, pluralize e formatDateTimeBR.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

(Sem componente de UI: `ui-registry.md` não muda.)

---

### Task 3: Contrato das actions (AdminResult, dbErrors, schemas Zod, runAdminAction, authzOf) e guarda actionsAuth

**Files:**
- Create: `src/features/admin/result.ts`, `src/features/admin/dbErrors.ts`, `src/features/admin/schemas.ts`, `src/features/admin/runAdminAction.ts`
- Create: `test/authz.ts`
- Create: `src/app/(app)/admin/actionsAuth.test.ts` (guarda; define e exporta `actionsMissingAdminGuard`)
- Test: `src/features/admin/result.test.ts`, `dbErrors.test.ts`, `schemas.test.ts`, `runAdminAction.test.ts`, `test/authz.test.ts`, `src/app/(app)/admin/actionsAuth.test.ts`

**Interfaces:**
- Consumes: `normalizeName`, `validateName` (`names.ts`), `resolveUnit` (`itemOptions.ts`), `SECTOR_REQUIRED_MESSAGE` (`messages.ts`), `TIME_INPUT_PATTERN` (`timeOfDay.ts`), `ITEM_KINDS` (`@/lib/itemKinds`), `ROLES` (`@/lib/roles`), `Authz`/`toAuthz` (`@/features/authz/authz`), `Db` (`@/db/types`), `db` (`@/db`), tabela `sector` e `createTestDb` (Tarefa 1).
- Produces (assinaturas do contrato, com os acréscimos marcados):
  - `result.ts`: `AdminErrorCode`, `FieldErrors`, `AdminFailure`, `AdminResult<T>`, `ok()`, `ok(data)`, `fail(code, message, fieldErrors?)`, `INTERNAL_ERROR_MESSAGE`, `INVALID_INPUT_MESSAGE`. `ok(data)` põe `ok: true` **depois** do espalhamento (os dados não sobrescrevem `ok`).
  - `dbErrors.ts`: `sqlStateOf`, `constraintOf`, `isUniqueViolation` (olham o erro e até 2 níveis de `cause`; só aceitam `code` com 5 caracteres `[0-9A-Z]`, então `ECONNRESET` não conta).
  - `schemas.ts`: `idSchema`, `nameSchema`, `timeSchema`, os 14 schemas do contrato, os 14 tipos `*Input`, `firstFieldErrors(error: z.ZodError): FieldErrors`; **mais** `INVITE_LABEL_MAX_LENGTH = 80`. Mensagens novas, fora da tabela do esqueleto: papel inválido = `Escolha o papel.`; tipo de item inválido = `Escolha o tipo do item.`; qualquer outro campo de tipo errado (`userId`, `active`, `direction`, `inviteeLabel`) = `Confira os campos e tente de novo.`.
  - `runAdminAction.ts` (`server-only`): `runAdminAction({ actor, schema, input, run })`. Entrada que nem é objeto (problema sem caminho) vira `INVALID_INPUT` com `INVALID_INPUT_MESSAGE` e `fieldErrors: {}`.
  - `test/authz.ts`: `authzOf({ role; userId?; sectorId?; name?; email? }): Authz`. Admin sempre com `sectorId: null`; operador sem `sectorId` ganha `"00000000-0000-4000-8000-0000000000a1"` (id fictício, sem FK); operador com `sectorId: null` **lança**. `userId` padrão `user-${role}`; `email` padrão `${userId}@example.test`.
  - `actionsAuth.test.ts`: `actionsMissingAdminGuard(source: string): string[]`. Exige `requireAdmin()` como **primeira instrução** do corpo (`await requireAdmin();` ou `const x = await requireAdmin();`) e devolve também o nome de qualquer export de runtime que não seja `export async function` (`const`, `let`, `var`, `class`, `function` síncrona, `default`, `{`). `export type`/`export interface` não entram. Constante `MIN_ACTION_FILES = 0` na Tarefa 3 (nenhum `actions.ts` existe ainda); a Tarefa 11 a sobe para 5.

- [ ] **Step 1: Write the failing tests**

`src/features/admin/result.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  fail,
  INTERNAL_ERROR_MESSAGE,
  INVALID_INPUT_MESSAGE,
  ok,
} from "@/features/admin/result";

describe("ok", () => {
  it("sem dados: só { ok: true }", () => {
    expect(ok()).toEqual({ ok: true });
  });

  it("com dados: espalha os campos ao lado de ok", () => {
    expect(ok({ id: "abc", warnings: [] })).toEqual({
      ok: true,
      id: "abc",
      warnings: [],
    });
  });

  it("ok não pode ser sobrescrito pelos dados", () => {
    expect(ok({ ok: false, id: "abc" }).ok).toBe(true);
  });
});

describe("fail", () => {
  it("monta a falha com código e mensagem, sem fieldErrors quando não há", () => {
    const failure = fail(
      "NOT_FOUND",
      "Setor não encontrado. Atualize a página.",
    );
    expect(failure).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Setor não encontrado. Atualize a página.",
    });
    expect("fieldErrors" in failure).toBe(false);
  });

  it("carrega os erros por campo", () => {
    expect(fail("NAME_TAKEN", "Já existe.", { name: "Já existe." })).toEqual({
      ok: false,
      code: "NAME_TAKEN",
      message: "Já existe.",
      fieldErrors: { name: "Já existe." },
    });
  });
});

describe("mensagens fixas", () => {
  it("são as do contrato", () => {
    expect(INTERNAL_ERROR_MESSAGE).toBe(
      "Não foi possível concluir. Tente de novo.",
    );
    expect(INVALID_INPUT_MESSAGE).toBe("Confira os campos e tente de novo.");
  });
});
```

`src/features/admin/dbErrors.test.ts` (usa o erro **real** do Drizzle + PGlite, que é o que prova o `error.cause` de F2-18):

```ts
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { sector } from "@/db/schema";
import {
  constraintOf,
  isUniqueViolation,
  sqlStateOf,
} from "@/features/admin/dbErrors";

import { createTestDb, resetDb, type TestDb } from "../../../test/db";

describe("com o erro real do Drizzle + PGlite", () => {
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

  async function duplicateInsertError(): Promise<unknown> {
    await db.insert(sector).values({ name: "ULD" });
    try {
      await db.insert(sector).values({ name: "uld" });
    } catch (error) {
      return error;
    }
    throw new Error("o segundo insert deveria falhar");
  }

  it("acha o SQLSTATE e a constraint dentro de error.cause", async () => {
    const error = await duplicateInsertError();
    expect(sqlStateOf(error)).toBe("23505");
    expect(constraintOf(error)).toBe("sector_name_lower_uq");
    expect(isUniqueViolation(error)).toBe(true);
  });

  it("reconhece o 23514 de uma CHECK como outro erro, não como duplicado", async () => {
    let error: unknown;
    try {
      await client.query(
        `INSERT INTO "user" (id, name, email, role, sector_id) VALUES ('u1', 'Pessoa', 'u1@example.test', 'gerente', NULL)`,
      );
    } catch (caught) {
      error = caught;
    }
    expect(sqlStateOf(error)).toBe("23514");
    expect(isUniqueViolation(error)).toBe(false);
  });
});

describe("com objetos sintéticos", () => {
  it("lê o código no próprio erro", () => {
    expect(sqlStateOf({ code: "23505" })).toBe("23505");
    expect(constraintOf({ constraint: "x_uq" })).toBe("x_uq");
  });

  it("lê o código na cause, e na cause da cause", () => {
    expect(sqlStateOf(new Error("x", { cause: { code: "23503" } }))).toBe(
      "23503",
    );
    const deep = new Error("a", {
      cause: new Error("b", { cause: { code: "23505", constraint: "k" } }),
    });
    expect(sqlStateOf(deep)).toBe("23505");
    expect(constraintOf(deep)).toBe("k");
  });

  it("código do Node (ECONNRESET) não é SQLSTATE", () => {
    expect(sqlStateOf({ code: "ECONNRESET" })).toBeUndefined();
    expect(isUniqueViolation({ code: "ECONNRESET" })).toBe(false);
  });

  it("devolve undefined para o que não é erro de banco", () => {
    for (const value of [
      undefined,
      null,
      "23505",
      23505,
      {},
      [],
      new Error("x"),
    ]) {
      expect(sqlStateOf(value), String(value)).toBeUndefined();
      expect(constraintOf(value), String(value)).toBeUndefined();
      expect(isUniqueViolation(value), String(value)).toBe(false);
    }
  });

  it("não entra em loop com cause circular", () => {
    const error: { cause?: unknown } = {};
    error.cause = error;
    expect(sqlStateOf(error)).toBeUndefined();
  });
});
```

`src/features/admin/schemas.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { z } from "zod";

import { ADMIN_INVITE_LABEL_MAX_LENGTH } from "@/features/invites/adminInvite";

import {
  cancelInviteSchema,
  createDestinationSchema,
  createInviteSchema,
  createItemSchema,
  createSectorSchema,
  createShiftSchema,
  firstFieldErrors,
  INVITE_LABEL_MAX_LENGTH,
  idSchema,
  moveSchema,
  nameSchema,
  renameDestinationSchema,
  renameSectorSchema,
  setActiveSchema,
  setPersonActiveSchema,
  timeSchema,
  updateItemSchema,
  updatePersonSchema,
  updateShiftSchema,
} from "./schemas";

const ID = "11111111-1111-4111-8111-111111111111";

function errorsOf(schema: z.ZodType, input: unknown) {
  const parsed = schema.safeParse(input);
  if (parsed.success) throw new Error("a entrada deveria ser recusada");
  return firstFieldErrors(parsed.error);
}

describe("idSchema", () => {
  it("aceita uuid", () => {
    expect(idSchema.safeParse(ID).success).toBe(true);
  });

  it("recusa o que não é uuid, com a mensagem pt-BR", () => {
    for (const value of ["abc", "", 42, null, undefined]) {
      const parsed = idSchema.safeParse(value);
      expect(parsed.success, String(value)).toBe(false);
      expect(parsed.error?.issues[0]?.message).toBe(
        "Registro inválido. Atualize a página.",
      );
    }
  });
});

describe("nameSchema", () => {
  it("normaliza o nome", () => {
    expect(nameSchema.parse("  Carga   geral ")).toBe("Carga geral");
  });

  it("vazio, só espaços e ausente: 'Informe o nome.'", () => {
    for (const value of ["", "   ", undefined, null, 7]) {
      const parsed = nameSchema.safeParse(value);
      expect(parsed.success, String(value)).toBe(false);
      expect(parsed.error?.issues[0]?.message).toBe("Informe o nome.");
    }
  });

  it("60 passa, 61 não", () => {
    expect(nameSchema.safeParse("a".repeat(60)).success).toBe(true);
    const parsed = nameSchema.safeParse("a".repeat(61));
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toBe(
      "O nome pode ter no máximo 60 caracteres.",
    );
  });
});

describe("timeSchema", () => {
  it("aceita HH:mm nos limites do dia", () => {
    expect(timeSchema.safeParse("00:00").success).toBe(true);
    expect(timeSchema.safeParse("23:59").success).toBe(true);
  });

  it("recusa 24:00, hora sem zero, com segundos e lixo", () => {
    for (const value of [
      "24:00",
      "6:00",
      "06:00:00",
      "06:60",
      "",
      "abc",
      600,
      undefined,
    ]) {
      const parsed = timeSchema.safeParse(value);
      expect(parsed.success, String(value)).toBe(false);
      expect(parsed.error?.issues[0]?.message).toBe(
        "Informe um horário válido, como 06:00.",
      );
    }
  });
});

describe("setores e destinos", () => {
  it("criar: nome normalizado; sobra de chave é descartada", () => {
    expect(createSectorSchema.parse({ name: " ULD ", admin: true })).toEqual({
      name: "ULD",
    });
    expect(createDestinationSchema.parse({ name: "Almoxarifado" })).toEqual({
      name: "Almoxarifado",
    });
  });

  it("renomear exige id e nome", () => {
    expect(renameSectorSchema.safeParse({ id: ID, name: "ULD" }).success).toBe(
      true,
    );
    expect(errorsOf(renameSectorSchema, { id: "x", name: "" })).toEqual({
      id: "Registro inválido. Atualize a página.",
      name: "Informe o nome.",
    });
    expect(errorsOf(renameDestinationSchema, { id: ID, name: "" })).toEqual({
      name: "Informe o nome.",
    });
  });

  it("ativar/desativar exige boolean de verdade (string 'true' não vale)", () => {
    expect(setActiveSchema.safeParse({ id: ID, active: false }).success).toBe(
      true,
    );
    expect(setActiveSchema.safeParse({ id: ID, active: "true" }).success).toBe(
      false,
    );
  });

  it("mover aceita só up e down", () => {
    expect(moveSchema.safeParse({ id: ID, direction: "up" }).success).toBe(
      true,
    );
    expect(moveSchema.safeParse({ id: ID, direction: "down" }).success).toBe(
      true,
    );
    expect(moveSchema.safeParse({ id: ID, direction: "left" }).success).toBe(
      false,
    );
  });
});

describe("turnos", () => {
  const valid = {
    sectorId: ID,
    name: "Manhã",
    startsAt: "06:00",
    endsAt: "14:00",
  };

  it("aceita um turno comum e um que atravessa a meia-noite", () => {
    expect(createShiftSchema.safeParse(valid).success).toBe(true);
    expect(
      createShiftSchema.safeParse({
        ...valid,
        startsAt: "22:00",
        endsAt: "06:00",
      }).success,
    ).toBe(true);
  });

  it("início igual ao fim: erro no campo endsAt", () => {
    expect(errorsOf(createShiftSchema, { ...valid, endsAt: "06:00" })).toEqual({
      endsAt: "O início e o fim não podem ser iguais.",
    });
    expect(
      errorsOf(updateShiftSchema, {
        id: ID,
        name: "Manhã",
        startsAt: "00:00",
        endsAt: "00:00",
      }),
    ).toEqual({ endsAt: "O início e o fim não podem ser iguais." });
  });

  it("horário inválido: erro no campo certo, só o primeiro de cada campo", () => {
    expect(
      errorsOf(createShiftSchema, {
        ...valid,
        startsAt: "25:00",
        endsAt: "xx",
      }),
    ).toEqual({
      startsAt: "Informe um horário válido, como 06:00.",
      endsAt: "Informe um horário válido, como 06:00.",
    });
  });

  it("setor inválido e nome vazio", () => {
    expect(
      errorsOf(createShiftSchema, { ...valid, sectorId: "x", name: " " }),
    ).toEqual({
      sectorId: "Registro inválido. Atualize a página.",
      name: "Informe o nome.",
    });
  });
});

describe("itens", () => {
  const valid = {
    sectorId: ID,
    name: "Rede de proteção",
    unitChoice: "unidade",
    unitOther: "",
    kind: "control",
  };

  it("aceita uma unidade da lista e 'Outro' com texto", () => {
    expect(createItemSchema.safeParse(valid).success).toBe(true);
    expect(
      createItemSchema.safeParse({
        ...valid,
        unitChoice: "outro",
        unitOther: "Bobina",
      }).success,
    ).toBe(true);
  });

  it("'Outro' sem texto: erro em unitOther", () => {
    expect(
      errorsOf(createItemSchema, { ...valid, unitChoice: "outro" }),
    ).toEqual({
      unitOther: "Informe a unidade.",
    });
  });

  it("'Outro' com 21 caracteres: erro em unitOther", () => {
    expect(
      errorsOf(createItemSchema, {
        ...valid,
        unitChoice: "outro",
        unitOther: "a".repeat(21),
      }),
    ).toEqual({ unitOther: "A unidade pode ter no máximo 20 caracteres." });
  });

  it("escolha desconhecida: erro em unitChoice", () => {
    expect(
      errorsOf(createItemSchema, { ...valid, unitChoice: "litro" }),
    ).toEqual({
      unitChoice: "Escolha uma unidade.",
    });
  });

  it("tipo fora de control/stock: erro em kind", () => {
    expect(errorsOf(createItemSchema, { ...valid, kind: "outro" })).toEqual({
      kind: "Escolha o tipo do item.",
    });
  });

  it("editar usa as mesmas regras, com id no lugar do setor", () => {
    const edit = {
      id: ID,
      name: "Rede",
      unitChoice: "kg",
      unitOther: "",
      kind: "stock",
    };
    expect(updateItemSchema.safeParse(edit).success).toBe(true);
    expect(errorsOf(updateItemSchema, { ...edit, unitChoice: "" })).toEqual({
      unitChoice: "Escolha uma unidade.",
    });
  });
});

describe("pessoas", () => {
  it("operador com setor passa; sem setor: erro em sectorId", () => {
    expect(
      updatePersonSchema.safeParse({
        userId: "u1",
        role: "operator",
        sectorId: ID,
      }).success,
    ).toBe(true);
    expect(
      errorsOf(updatePersonSchema, {
        userId: "u1",
        role: "operator",
        sectorId: null,
      }),
    ).toEqual({ sectorId: "Escolha o setor do operador." });
  });

  it("administrador passa com ou sem setor (o domínio grava null)", () => {
    expect(
      updatePersonSchema.safeParse({
        userId: "u1",
        role: "admin",
        sectorId: null,
      }).success,
    ).toBe(true);
    expect(
      updatePersonSchema.safeParse({
        userId: "u1",
        role: "admin",
        sectorId: ID,
      }).success,
    ).toBe(true);
  });

  it("papel desconhecido e userId vazio", () => {
    expect(
      errorsOf(updatePersonSchema, {
        userId: "",
        role: "gerente",
        sectorId: null,
      }),
    ).toEqual({
      userId: "Confira os campos e tente de novo.",
      role: "Escolha o papel.",
    });
  });

  it("userId é texto livre (não uuid)", () => {
    expect(
      setPersonActiveSchema.safeParse({ userId: "abc123", active: true })
        .success,
    ).toBe(true);
    expect(
      setPersonActiveSchema.safeParse({ userId: "", active: true }).success,
    ).toBe(false);
  });
});

describe("convites", () => {
  const valid = {
    inviteeLabel: "Turno da noite",
    role: "operator",
    sectorId: ID,
  };

  it("rótulo é normalizado; vazio continua vazio (o domínio vira null)", () => {
    expect(
      createInviteSchema.parse({ ...valid, inviteeLabel: "  Maria   Souza " }),
    ).toMatchObject({ inviteeLabel: "Maria Souza" });
    expect(
      createInviteSchema.parse({ ...valid, inviteeLabel: "   " }),
    ).toMatchObject({
      inviteeLabel: "",
    });
  });

  it("80 caracteres passa; 81 não, no campo inviteeLabel", () => {
    expect(INVITE_LABEL_MAX_LENGTH).toBe(ADMIN_INVITE_LABEL_MAX_LENGTH);
    expect(
      createInviteSchema.safeParse({ ...valid, inviteeLabel: "a".repeat(80) })
        .success,
    ).toBe(true);
    expect(
      errorsOf(createInviteSchema, { ...valid, inviteeLabel: "a".repeat(81) }),
    ).toEqual({
      inviteeLabel: "O nome de referência pode ter no máximo 80 caracteres.",
    });
  });

  it("papel inválido; setor pode ser null (admin)", () => {
    expect(errorsOf(createInviteSchema, { ...valid, role: "x" })).toEqual({
      role: "Escolha o papel.",
    });
    expect(
      createInviteSchema.safeParse({ ...valid, role: "admin", sectorId: null })
        .success,
    ).toBe(true);
  });

  it("cancelar exige id", () => {
    expect(cancelInviteSchema.safeParse({ id: ID }).success).toBe(true);
    expect(cancelInviteSchema.safeParse({ id: "x" }).success).toBe(false);
  });
});

describe("nenhuma mensagem sai em inglês", () => {
  const schemas = {
    createSectorSchema,
    renameSectorSchema,
    createDestinationSchema,
    renameDestinationSchema,
    setActiveSchema,
    moveSchema,
    createShiftSchema,
    updateShiftSchema,
    createItemSchema,
    updateItemSchema,
    updatePersonSchema,
    setPersonActiveSchema,
    createInviteSchema,
    cancelInviteSchema,
  };
  const ENGLISH = /invalid|expected|required|received/i;

  it.each(
    Object.entries(schemas),
  )("%s com {} e com campos de tipo errado", (_name, schema) => {
    const wrongTypes = {
      id: 1,
      sectorId: 1,
      userId: 1,
      name: 1,
      startsAt: 1,
      endsAt: 1,
      unitChoice: 1,
      unitOther: 1,
      kind: 1,
      role: 1,
      direction: 1,
      active: 1,
      inviteeLabel: 1,
    };
    for (const input of [{}, wrongTypes]) {
      const parsed = schema.safeParse(input);
      expect(parsed.success).toBe(false);
      for (const issue of parsed.error?.issues ?? []) {
        expect(issue.message, issue.message).not.toMatch(ENGLISH);
      }
    }
  });
});

describe("firstFieldErrors", () => {
  it("ignora problema sem campo (entrada que nem é objeto)", () => {
    const parsed = createSectorSchema.safeParse(null);
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(firstFieldErrors(parsed.error)).toEqual({});
  });

  it("devolve só a primeira mensagem de cada campo", () => {
    const parsed = createSectorSchema.safeParse({ name: "a".repeat(100) });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(firstFieldErrors(parsed.error)).toEqual({
        name: "O nome pode ter no máximo 60 caracteres.",
      });
    }
  });
});
```

`src/features/admin/runAdminAction.test.ts` (só `next/cache` e `@/db` são mockados; `notFound`/`redirect`/`unstable_rethrow` são os **reais** do Next, o que prova a passagem intacta):

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

const { runAdminAction } = await import("./runAdminAction");

const schema = z.object({
  name: z
    .string({ error: "Informe o nome." })
    .min(1, { error: "Informe o nome." }),
});
const actor = authzOf({ role: "admin" });

type RunContext = { db: unknown; now: Date; actor: Authz; input: unknown };

describe("runAdminAction", () => {
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

    const result = await runAdminAction({
      actor,
      schema,
      input: { name: "" },
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
      const result = await runAdminAction({ actor, schema, input, run });
      expect(result).toEqual({
        ok: false,
        code: "INVALID_INPUT",
        message: "Confira os campos e tente de novo.",
        fieldErrors: {},
      });
    }
    expect(run).not.toHaveBeenCalled();
  });

  it("sucesso: passa db, now, actor e a entrada já validada; revalida /admin (layout) uma vez", async () => {
    const run = vi.fn(async (_ctx: RunContext) => ok({ id: "abc" }));
    const before = Date.now();

    const result = await runAdminAction({
      actor,
      schema: z.object({ name: z.string().transform((value) => value.trim()) }),
      input: { name: "  ULD  ", extra: "descartado" },
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
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
  });

  it("falha de domínio é repassada como veio e não revalida", async () => {
    const failure = fail("NAME_TAKEN", "Já existe um setor com este nome.", {
      name: "Já existe um setor com este nome.",
    });

    const result = await runAdminAction({
      actor,
      schema,
      input: { name: "ULD" },
      run: async () => failure,
    });

    expect(result).toBe(failure);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("exceção inesperada vira INTERNAL sem vazar o texto do erro", async () => {
    const secret =
      'duplicate key value violates unique constraint "sector_name_lower_uq" (senha=hunter2)';

    const result = await runAdminAction({
      actor,
      schema,
      input: { name: "ULD" },
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
    const result = await runAdminAction({
      actor,
      schema,
      input: { name: "ULD" },
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
      runAdminAction({
        actor,
        schema,
        input: { name: "ULD" },
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
      runAdminAction({
        actor,
        schema,
        input: { name: "ULD" },
        run: async () => {
          throw thrown;
        },
      }),
    ).rejects.toBe(thrown);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
```

`test/authz.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { toAuthz } from "@/features/authz/authz";

import { authzOf } from "./authz";

describe("authzOf", () => {
  it("admin sai sem setor, mesmo que um setor seja informado", () => {
    expect(authzOf({ role: "admin" }).sectorId).toBeNull();
    expect(authzOf({ role: "admin", sectorId: "s1" }).sectorId).toBeNull();
  });

  it("operador sai com o setor informado", () => {
    expect(authzOf({ role: "operator", sectorId: "s1" })).toMatchObject({
      role: "operator",
      sectorId: "s1",
    });
  });

  it("operador sem setor informado ganha um setor padrão (nunca null)", () => {
    expect(authzOf({ role: "operator" }).sectorId).toEqual(expect.any(String));
  });

  it("operador com sectorId null lança: esse estado não existe de verdade", () => {
    expect(() => authzOf({ role: "operator", sectorId: null })).toThrow(
      "operador exige um setor",
    );
  });

  it("usa os campos informados e tem padrões estáveis", () => {
    expect(
      authzOf({
        role: "admin",
        userId: "u9",
        name: "Ana Teste",
        email: "ana@example.test",
      }),
    ).toEqual({
      userId: "u9",
      name: "Ana Teste",
      email: "ana@example.test",
      role: "admin",
      sectorId: null,
    });
    const padrao = authzOf({ role: "admin" });
    expect(padrao.userId).toBe("user-admin");
    expect(padrao.email).toBe("user-admin@example.test");
  });

  it("o resultado é o mesmo que toAuthz devolveria para a sessão correspondente", () => {
    const operator = authzOf({ role: "operator", sectorId: "s1" });
    expect(
      toAuthz({
        id: operator.userId,
        name: operator.name,
        email: operator.email,
        role: "operator",
        sectorId: "s1",
      }),
    ).toEqual(operator);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/features/admin/result src/features/admin/dbErrors src/features/admin/schemas src/features/admin/runAdminAction test/authz.test.ts`
Expected: FAIL, 5 arquivos (projeto `node`, então a mensagem é `Cannot find module`/`Cannot find package`, não `Failed to resolve import`): `result.test.ts` com `Cannot find package '@/features/admin/result'`; `dbErrors.test.ts` com `Cannot find package '@/features/admin/dbErrors'`; `schemas.test.ts` com `Cannot find module './schemas'`; `runAdminAction.test.ts` com `Cannot find package '@/features/admin/result'`; `test/authz.test.ts` com `Cannot find module './authz'`.

- [ ] **Step 3: Write minimal implementation**

`src/features/admin/result.ts`:

```ts
export type AdminErrorCode =
  | "INVALID_INPUT"
  | "NAME_TAKEN"
  | "NOT_FOUND"
  | "SECTOR_REQUIRED"
  | "SECTOR_INACTIVE"
  | "SECTOR_IN_USE"
  | "SELF_CHANGE"
  | "LAST_ADMIN"
  | "INVITE_NOT_PENDING"
  | "INTERNAL";

/** Chave = nome do campo do formulário; valor = mensagem pt-BR do campo. */
export type FieldErrors = Partial<Record<string, string>>;

export type AdminFailure = {
  ok: false;
  code: AdminErrorCode;
  message: string;
  fieldErrors?: FieldErrors;
};

export type AdminResult<T extends object = object> =
  | ({ ok: true } & T)
  | AdminFailure;

export const INTERNAL_ERROR_MESSAGE =
  "Não foi possível concluir. Tente de novo.";
export const INVALID_INPUT_MESSAGE = "Confira os campos e tente de novo.";

export function ok(): { ok: true };
export function ok<T extends object>(data: T): { ok: true } & T;
export function ok(data?: object): { ok: true } {
  return { ...data, ok: true };
}

export function fail(
  code: AdminErrorCode,
  message: string,
  fieldErrors?: FieldErrors,
): AdminFailure {
  return fieldErrors === undefined
    ? { ok: false, code, message }
    : { ok: false, code, message, fieldErrors };
}
```

`src/features/admin/dbErrors.ts`:

```ts
// O Drizzle 0.45 embrulha o erro do driver: o SQLSTATE e o nome da constraint
// ficam em `error.cause` (F2-18). Olhamos o erro e até dois níveis de `cause`.
const MAX_DEPTH = 3;
const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/;

function read(error: unknown, key: "code" | "constraint"): string | undefined {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    if (typeof current !== "object" || current === null) return undefined;
    const value: unknown = Reflect.get(current, key);
    if (typeof value === "string") {
      // Códigos do Node ("ECONNRESET") não são SQLSTATE: seguem para a cause.
      if (key !== "code" || SQLSTATE_PATTERN.test(value)) return value;
    }
    current = Reflect.get(current, "cause");
  }
  return undefined;
}

export function sqlStateOf(error: unknown): string | undefined {
  return read(error, "code");
}

export function constraintOf(error: unknown): string | undefined {
  return read(error, "constraint");
}

/** SQLSTATE 23505: índice ou constraint única violada. */
export function isUniqueViolation(error: unknown): boolean {
  return sqlStateOf(error) === "23505";
}
```

`src/features/admin/schemas.ts` (Zod 4.6.7; **não** usa `z.flattenError`, que com `z.ZodError` sem tipo de entrada devolve `fieldErrors` tipado como `{}` e quebra o `check-types`):

```ts
import { z } from "zod";

import { ITEM_KINDS } from "@/lib/itemKinds";
import { ROLES } from "@/lib/roles";

import { resolveUnit } from "./itemOptions";
import {
  INVITE_LABEL_TOO_LONG_MESSAGE,
  SECTOR_REQUIRED_MESSAGE,
} from "./messages";
import { normalizeName, validateName } from "./names";
import { type FieldErrors, INVALID_INPUT_MESSAGE } from "./result";
import { TIME_INPUT_PATTERN } from "./timeOfDay";

// Sem importar de features/invites (arrastaria o banco para o cliente); o teste
// confere que este valor é o mesmo de ADMIN_INVITE_LABEL_MAX_LENGTH.
export const INVITE_LABEL_MAX_LENGTH = 80;

const INVALID_ID_MESSAGE = "Registro inválido. Atualize a página.";
const INVALID_TIME_MESSAGE = "Informe um horário válido, como 06:00.";
const SAME_TIME_MESSAGE = "O início e o fim não podem ser iguais.";

// Todo campo tem mensagem em pt-BR própria: o texto padrão do Zod é inglês e
// nunca pode chegar à tela.
export const idSchema = z.uuid({ error: INVALID_ID_MESSAGE });

export const nameSchema = z
  .string({ error: "Informe o nome." })
  .transform((raw, ctx) => {
    const result = validateName(raw);
    if (!result.ok) {
      ctx.addIssue({ code: "custom", message: result.message });
      return z.NEVER;
    }
    return result.name;
  });

export const timeSchema = z
  .string({ error: INVALID_TIME_MESSAGE })
  .regex(TIME_INPUT_PATTERN, { error: INVALID_TIME_MESSAGE });

const userIdSchema = z
  .string({ error: INVALID_INPUT_MESSAGE })
  .min(1, { error: INVALID_INPUT_MESSAGE });
const activeSchema = z.boolean({ error: INVALID_INPUT_MESSAGE });
const roleSchema = z.enum(ROLES, { error: "Escolha o papel." });
const kindSchema = z.enum(ITEM_KINDS, { error: "Escolha o tipo do item." });
const textSchema = z.string({ error: INVALID_INPUT_MESSAGE });

export const createSectorSchema = z.object({ name: nameSchema });
export const renameSectorSchema = z.object({ id: idSchema, name: nameSchema });
export const createDestinationSchema = z.object({ name: nameSchema });
export const renameDestinationSchema = z.object({
  id: idSchema,
  name: nameSchema,
});
export const setActiveSchema = z.object({ id: idSchema, active: activeSchema });
export const moveSchema = z.object({
  id: idSchema,
  direction: z.enum(["up", "down"], { error: INVALID_INPUT_MESSAGE }),
});

export const createShiftSchema = z
  .object({
    sectorId: idSchema,
    name: nameSchema,
    startsAt: timeSchema,
    endsAt: timeSchema,
  })
  .refine((value) => value.startsAt !== value.endsAt, {
    error: SAME_TIME_MESSAGE,
    path: ["endsAt"],
  });

export const updateShiftSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    startsAt: timeSchema,
    endsAt: timeSchema,
  })
  .refine((value) => value.startsAt !== value.endsAt, {
    error: SAME_TIME_MESSAGE,
    path: ["endsAt"],
  });

function refineUnit(
  value: { unitChoice: string; unitOther: string },
  ctx: z.RefinementCtx,
): void {
  const unit = resolveUnit(value.unitChoice, value.unitOther);
  if (!unit.ok) {
    ctx.addIssue({ code: "custom", message: unit.message, path: [unit.field] });
  }
}

export const createItemSchema = z
  .object({
    sectorId: idSchema,
    name: nameSchema,
    unitChoice: textSchema,
    unitOther: textSchema,
    kind: kindSchema,
  })
  .superRefine(refineUnit);

export const updateItemSchema = z
  .object({
    id: idSchema,
    name: nameSchema,
    unitChoice: textSchema,
    unitOther: textSchema,
    kind: kindSchema,
  })
  .superRefine(refineUnit);

export const updatePersonSchema = z
  .object({
    userId: userIdSchema,
    role: roleSchema,
    sectorId: idSchema.nullable(),
  })
  .refine((value) => value.role !== "operator" || value.sectorId !== null, {
    error: SECTOR_REQUIRED_MESSAGE,
    path: ["sectorId"],
  });

// `user.id` é text, não uuid.
export const setPersonActiveSchema = z.object({
  userId: userIdSchema,
  active: activeSchema,
});

const inviteeLabelSchema = z
  .string({ error: INVALID_INPUT_MESSAGE })
  .transform((raw, ctx) => {
    const label = normalizeName(raw);
    if ([...label].length > INVITE_LABEL_MAX_LENGTH) {
      ctx.addIssue({
        code: "custom",
        message: INVITE_LABEL_TOO_LONG_MESSAGE,
      });
      return z.NEVER;
    }
    // Vazio continua "": é o domínio que o transforma em null.
    return label;
  });

export const createInviteSchema = z.object({
  inviteeLabel: inviteeLabelSchema,
  role: roleSchema,
  sectorId: idSchema.nullable(),
});

export const cancelInviteSchema = z.object({ id: idSchema });

export type CreateSectorInput = z.infer<typeof createSectorSchema>;
export type RenameSectorInput = z.infer<typeof renameSectorSchema>;
export type CreateDestinationInput = z.infer<typeof createDestinationSchema>;
export type RenameDestinationInput = z.infer<typeof renameDestinationSchema>;
export type SetActiveInput = z.infer<typeof setActiveSchema>;
export type MoveInput = z.infer<typeof moveSchema>;
export type CreateShiftInput = z.infer<typeof createShiftSchema>;
export type UpdateShiftInput = z.infer<typeof updateShiftSchema>;
export type CreateItemInput = z.infer<typeof createItemSchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;
export type UpdatePersonInput = z.infer<typeof updatePersonSchema>;
export type SetPersonActiveInput = z.infer<typeof setPersonActiveSchema>;
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
export type CancelInviteInput = z.infer<typeof cancelInviteSchema>;

/**
 * Primeira mensagem de cada campo (o primeiro segmento do caminho do problema);
 * problemas sem campo (raiz) ficam de fora. Não usa z.flattenError: com
 * `z.ZodError` sem tipo de entrada, o fieldErrors dele sai tipado como `{}`.
 */
export function firstFieldErrors(error: z.ZodError): FieldErrors {
  const result: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (field === undefined) continue;
    const key = String(field);
    if (result[key] === undefined) result[key] = issue.message;
  }
  return result;
}
```

`src/features/admin/runAdminAction.ts`:

```ts
import "server-only";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";

import { db } from "@/db";
import type { Db } from "@/db/types";
import type { Authz } from "@/features/authz/authz";
import {
  type AdminResult,
  fail,
  INTERNAL_ERROR_MESSAGE,
  INVALID_INPUT_MESSAGE,
} from "./result";
import { firstFieldErrors } from "./schemas";

// Problema na raiz (entrada que nem é objeto) cai na mensagem genérica: o texto
// padrão do Zod é inglês e nunca pode chegar à tela.
function firstIssueMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue && issue.path.length > 0 ? issue.message : INVALID_INPUT_MESSAGE;
}

// Zod → domínio → revalidatePath. Quem chama (a Server Action) já fez
// `requireAdmin()`; aqui só entra o que vem depois.
export async function runAdminAction<
  S extends z.ZodType,
  T extends object = object,
>(args: {
  actor: Authz;
  schema: S;
  input: unknown;
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
    console.error("runAdminAction: falha inesperada", error);
    // Nunca devolve o texto do erro (pode ser do banco).
    return fail("INTERNAL", INTERNAL_ERROR_MESSAGE);
  }

  // Com route group o caminho é o do arquivo (revalidatePath.md).
  if (result.ok) revalidatePath("/(app)/admin", "layout");
  return result;
}
```

`test/authz.ts`:

```ts
import type { Authz } from "@/features/authz/authz";
import type { Role } from "@/lib/roles";

const DEFAULT_OPERATOR_SECTOR_ID = "00000000-0000-4000-8000-0000000000a1";

// Quem está logado, para testes de domínio e de action. Admin sempre sai sem
// setor (como o toAuthz de verdade); operador sem setor não existe: lança.
export function authzOf(input: {
  role: Role;
  userId?: string;
  sectorId?: string | null;
  name?: string;
  email?: string;
}): Authz {
  const userId = input.userId ?? `user-${input.role}`;
  const base = {
    userId,
    name: input.name ?? "Pessoa Teste",
    email: input.email ?? `${userId}@example.test`,
  };

  if (input.role === "admin") return { ...base, role: "admin", sectorId: null };

  const sectorId =
    input.sectorId === undefined ? DEFAULT_OPERATOR_SECTOR_ID : input.sectorId;
  if (sectorId === null) {
    throw new Error(
      "authzOf: operador exige um setor (sectorId não pode ser null)",
    );
  }
  return { ...base, role: "operator", sectorId };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- src/features/admin/result src/features/admin/dbErrors src/features/admin/schemas src/features/admin/runAdminAction test/authz.test.ts`
Expected: PASS (72 testes em 5 arquivos: result 6, dbErrors 7, schemas 45, runAdminAction 8, authz 6).

- [ ] **Step 5: Mutation check of runAdminAction (prova que os testes de passagem e de revalidação pegam o defeito)**

Edite `src/features/admin/runAdminAction.ts` temporariamente: troque `unstable_rethrow(error);` por `// mutante` e `if (result.ok) revalidatePath` por `if (true) revalidatePath`. Run: `bun run test -- src/features/admin/runAdminAction`
Expected: FAIL em 3 testes ("falha de domínio é repassada como veio e não revalida", "notFound() passa intacto…", "redirect() passa intacto"). Desfaça as duas edições (`git checkout -- src/features/admin/runAdminAction.ts` só serve se já commitado; senão reescreva as duas linhas) e rode de novo: 8 passando.

- [ ] **Step 6: Write the actions guard**

Crie `src/app/(app)/admin/actionsAuth.test.ts`. Ele é autocontido (a função e os testes vivem no mesmo arquivo, como `pageCallsAuthGuard` em `appPagesAuth.test.ts`), então não há fase vermelha separada: os casos negativos são a prova de que o guarda de fato falha.

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Guarda das Server Actions do admin. Uma Server Action é um endpoint público:
// pode ser chamada de qualquer rota, então cada função exportada autoriza por
// conta própria, com `requireAdmin()` como PRIMEIRA instrução (F2-7).

const ROOT = process.cwd();
const ADMIN_DIR = join(ROOT, "src", "app", "(app)", "admin");

// Sobe para 5 na Tarefa 11, quando existirem os cinco actions.ts (setores,
// destinos, turnos, itens, equipe).
const MIN_ACTION_FILES = 0;

const FIRST_STATEMENT_GUARD =
  /^\s*(?:const\s+[\w$]+\s*=\s*)?await\s+requireAdmin\s*\(\s*\)/;

function stripComments(source: string): string {
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

/**
 * Nomes dos exports de um actions.ts que não cumprem o contrato: função
 * `export async function` cujo corpo não começa com `requireAdmin()` (comentários
 * removidos), ou qualquer outro export em tempo de execução (`const`,
 * `function` síncrona, `default`, `{ … }`). [] = tudo certo.
 */
export function actionsMissingAdminGuard(source: string): string[] {
  const code = stripComments(source);
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
    if (!FIRST_STATEMENT_GUARD.test(body)) offenders.push(match[2]);
  }
  return offenders;
}

function startsWithUseServer(source: string): boolean {
  return /^\s*(["'])use server\1/.test(stripComments(source));
}

function findActionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return findActionFiles(full);
    return name === "actions.ts" ? [full] : [];
  });
}

describe("todo actions.ts do admin chama requireAdmin() primeiro", () => {
  const files = findActionFiles(ADMIN_DIR);

  it("encontra os arquivos de actions", () => {
    expect(files.length).toBeGreaterThanOrEqual(MIN_ACTION_FILES);
  });

  it.each(
    files.map((file) => [relative(ROOT, file).replaceAll("\\", "/"), file]),
  )("%s", (name, file) => {
    const source = readFileSync(file as string, "utf8");
    expect(
      startsWithUseServer(source),
      `${name} precisa começar com "use server".`,
    ).toBe(true);
    expect(
      actionsMissingAdminGuard(source),
      `${name}: toda função exportada começa com requireAdmin() e só exporta funções async.`,
    ).toEqual([]);
  });
});

describe("actionsMissingAdminGuard (o guarda de fato falha)", () => {
  it("action com requireAdmin na primeira linha → []", () => {
    const source = `"use server";
export async function createSectorAction(input: unknown) {
  const actor = await requireAdmin();
  return runAdminAction({ actor, schema, input, run });
}`;
    expect(actionsMissingAdminGuard(source)).toEqual([]);
  });

  it("aceita `await requireAdmin();` sem atribuição", () => {
    const source = `export async function a() {\n  await requireAdmin();\n  return 1;\n}`;
    expect(actionsMissingAdminGuard(source)).toEqual([]);
  });

  it("action sem requireAdmin → o nome dela", () => {
    const source = `"use server";
export async function createSectorAction(input: unknown) {
  return runAdminAction({ input });
}`;
    expect(actionsMissingAdminGuard(source)).toEqual(["createSectorAction"]);
  });

  it("requireAdmin só em comentário não conta", () => {
    const source = `export async function a() {
  // const actor = await requireAdmin();
  /* await requireAdmin(); */
  return 1;
}`;
    expect(actionsMissingAdminGuard(source)).toEqual(["a"]);
  });

  it("um export sem guarda entre dois com guarda → só o do meio", () => {
    const source = `export async function first() {
  await requireAdmin();
}
export async function middle() {
  return 1;
}
export async function last() {
  await requireAdmin();
}`;
    expect(actionsMissingAdminGuard(source)).toEqual(["middle"]);
  });

  it("requireAdmin em função auxiliar fora da action não salva a action", () => {
    const source = `export async function a() {
  return 1;
}
async function helper() {
  await requireAdmin();
}`;
    expect(actionsMissingAdminGuard(source)).toEqual(["a"]);
  });

  it("requireAdmin depois de outro trabalho não vale: tem de ser a primeira instrução", () => {
    const source = `export async function a(input: unknown) {
  await writeSomething(input);
  await requireAdmin();
}`;
    expect(actionsMissingAdminGuard(source)).toEqual(["a"]);
  });

  it("entende parâmetros e retorno com chaves: tipos de objeto não enganam", () => {
    const source = `export async function a(input: { id: string }): Promise<AdminResult<{ id: string }>> {
  return runAdminAction({ input });
}
export async function b(input: { id: string }): Promise<AdminResult<{ id: string }>> {
  const actor = await requireAdmin();
  return runAdminAction({ actor, input });
}`;
    expect(actionsMissingAdminGuard(source)).toEqual(["a"]);
  });

  it("chaves dentro de strings não confundem o corpo", () => {
    const source = `export async function a() {
  await requireAdmin();
  return "}";
}
export async function b() {
  return "{";
}`;
    expect(actionsMissingAdminGuard(source)).toEqual(["b"]);
  });

  it("export que não é `export async function` é recusado", () => {
    const source = `export const createAction = async () => { await requireAdmin(); };
export function syncAction() { return 1; }
export default async function () {}
export { foo };`;
    expect(actionsMissingAdminGuard(source)).toEqual([
      "createAction",
      "syncAction",
      "default",
      "{",
    ]);
  });

  it("função não exportada sem guarda é ignorada", () => {
    const source = `async function helper() { return 1; }
export async function a() {
  await requireAdmin();
}`;
    expect(actionsMissingAdminGuard(source)).toEqual([]);
  });

  it("arquivo sem nenhuma action → []", () => {
    expect(actionsMissingAdminGuard(`"use server";`)).toEqual([]);
  });
});

describe("startsWithUseServer", () => {
  it("aceita aspas simples e duplas, depois de comentário", () => {
    expect(startsWithUseServer(`"use server";\nexport {}`)).toBe(true);
    expect(startsWithUseServer(`// ações\n'use server'\n`)).toBe(true);
  });

  it("recusa arquivo sem a diretiva ou com ela fora do topo", () => {
    expect(startsWithUseServer(`export async function a() {}`)).toBe(false);
    expect(startsWithUseServer(`import x from "y";\n"use server";`)).toBe(
      false,
    );
  });
});
```

- [ ] **Step 7: Run the guard test**

Run: `bun run test -- actionsAuth`
Expected: PASS (15 testes: 1 de varredura com 0 arquivos hoje + 12 de `actionsMissingAdminGuard` + 2 de `startsWithUseServer`). Prova de que o guarda morde: troque temporariamente `FIRST_STATEMENT_GUARD` por `/./` e rode de novo; os casos "action sem requireAdmin", "só em comentário", "depois de outro trabalho", "entre dois" e "tipos de objeto" devem falhar. Desfaça.

- [ ] **Step 8: Typecheck, lint, suite and commit**

Run: `bunx biome check --write src test && bun run check-types && bun run lint && bun run test`
Expected: tudo verde; o Biome não deve alterar nada. Total deste grupo: 87 testes em 6 arquivos (72 do Step 4 + 15 do guarda).

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-3.txt` (texto exato abaixo) e rode:
```bash
git add src/features/admin/result.ts src/features/admin/result.test.ts src/features/admin/dbErrors.ts src/features/admin/dbErrors.test.ts src/features/admin/schemas.ts src/features/admin/schemas.test.ts src/features/admin/runAdminAction.ts src/features/admin/runAdminAction.test.ts test/authz.ts test/authz.test.ts "src/app/(app)/admin/actionsAuth.test.ts"
git commit -F .git/sdd/msg-task-3.txt
```
Mensagem:
```text
feat(admin): contrato das Server Actions (AdminResult, schemas Zod, runAdminAction)

AdminResult com código e mensagem pt-BR, leitura de SQLSTATE em error.cause,
schemas Zod 4 com mensagens em português, runAdminAction (Zod, domínio,
revalidatePath só no sucesso, notFound/redirect intactos, erro interno sem
vazar texto), authzOf para testes e guarda que exige requireAdmin() como
primeira instrução em todo actions.ts do admin.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

(Sem componente de UI: `ui-registry.md` não muda.)

---

### Task 4: Primitivos shadcn (toggle-group, native-select, dialog) com alvos de toque e "Fechar"

**Files:**
- Create: `src/components/ui/touchTargets.test.tsx`
- Create (via shadcn CLI, depois ajustados): `src/components/ui/toggle.tsx`, `src/components/ui/toggle-group.tsx`, `src/components/ui/native-select.tsx`, `src/components/ui/dialog.tsx`
- Modify: `src/components/ui/ptBrLabels.test.tsx` (importar `Dialog*` e acrescentar 2 casos no fim do `describe`)
- Modify: `.context/ui-registry.md` (3 primitivos novos + histórico do `Button`)
- Não muda: `src/components/ui/button.tsx` (o CLI o sobrescreve; `git checkout` restaura a customização P3, F2-24)

**Interfaces:**
- Consumes: `heightUnit`, `MIN_DESKTOP_UNIT`, `TOUCH_UNIT` de `test/touchTargets.ts` (já existem); `Button` (`src/components/ui/button.tsx`, P3).
- Produces (usados pela Tarefa 5 e pelas 7–10):
  - `ToggleGroup`, `ToggleGroupItem` de `@/components/ui/toggle-group` (`variant="outline"`, `size="lg"` no uso; item marcado = `aria-pressed="true"`); `Toggle`, `toggleVariants` de `@/components/ui/toggle`
  - `NativeSelect` (prop `size?: "sm" | "default"`; `className` vai no wrapper, o resto no `<select>`), `NativeSelectOption`, `NativeSelectOptGroup` de `@/components/ui/native-select`
  - `Dialog`, `DialogTrigger`, `DialogContent` (prop `showCloseButton`, padrão `true`), `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` (prop `showCloseButton`, padrão `false`), `DialogClose`, `DialogPortal`, `DialogOverlay` de `@/components/ui/dialog`; os dois botões de fechar se chamam `Fechar`

- [ ] **Step 1: Write the failing tests**

Crie `src/components/ui/touchTargets.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  heightUnit,
  MIN_DESKTOP_UNIT,
  TOUCH_UNIT,
} from "../../../test/touchTargets";

describe("ToggleGroup — alvos de toque (ui-rules §1.4)", () => {
  it.each([
    "default",
    "sm",
    "lg",
  ] as const)("o item de tamanho %s tem pelo menos 36px no desktop e 44px abaixo de md", (size) => {
    render(
      <ToggleGroup defaultValue={["a"]} variant="outline" size={size}>
        <ToggleGroupItem value="a">Operador</ToggleGroupItem>
        <ToggleGroupItem value="b">Administrador</ToggleGroupItem>
      </ToggleGroup>,
    );

    for (const name of ["Operador", "Administrador"]) {
      const className = screen.getByRole("button", { name }).className;
      expect(heightUnit(className, "")).toBeGreaterThanOrEqual(
        MIN_DESKTOP_UNIT,
      );
      expect(heightUnit(className, "max-md:")).toBe(TOUCH_UNIT);
    }
  });

  it("marca o item escolhido com aria-pressed", () => {
    render(
      <ToggleGroup defaultValue={["b"]}>
        <ToggleGroupItem value="a">Operador</ToggleGroupItem>
        <ToggleGroupItem value="b">Administrador</ToggleGroupItem>
      </ToggleGroup>,
    );

    expect(
      screen.getByRole("button", { name: "Administrador" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Operador" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

describe("NativeSelect — alvos de toque e texto de 16px", () => {
  it.each([
    "default",
    "sm",
  ] as const)("o select de tamanho %s tem 36px no desktop e 44px abaixo de md", (size) => {
    render(
      <NativeSelect aria-label="Unidade" size={size}>
        <NativeSelectOption value="unidade">Unidade</NativeSelectOption>
      </NativeSelect>,
    );

    const className = screen.getByRole("combobox", {
      name: "Unidade",
    }).className;
    expect(heightUnit(className, "")).toBeGreaterThanOrEqual(MIN_DESKTOP_UNIT);
    expect(heightUnit(className, "max-md:")).toBe(TOUCH_UNIT);
  });

  it("mantém o texto de 16px no celular (evita zoom do iOS)", () => {
    render(
      <NativeSelect aria-label="Unidade">
        <NativeSelectOption value="unidade">Unidade</NativeSelectOption>
      </NativeSelect>,
    );

    const classes = screen
      .getByRole("combobox", { name: "Unidade" })
      .className.split(" ");
    expect(classes).toContain("text-base");
    expect(classes).toContain("md:text-sm");
  });
});

describe("Dialog — botão de fechar", () => {
  it("tem 44px abaixo de md", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Título</DialogTitle>
          <DialogDescription>Descrição</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    const className = screen.getByRole("button", { name: "Fechar" }).className;
    expect(heightUnit(className, "")).toBeGreaterThanOrEqual(MIN_DESKTOP_UNIT);
    expect(heightUnit(className, "max-md:")).toBe(TOUCH_UNIT);
  });
});
```

Em `src/components/ui/ptBrLabels.test.tsx`, acrescente o import do `Dialog` **antes** do import de `Sheet` (a ordem alfabética é a que o Biome exige):

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
```

e, dentro do `describe("rótulos acessíveis dos primitivos em pt-BR", …)`, depois do último `it` (o do `Sheet`) e antes do `});` que fecha o `describe`:

```tsx
  it("o botão de fechar do Dialog se chama 'Fechar'", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Título</DialogTitle>
          <DialogDescription>Descrição</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    expect(screen.queryByText("Close")).not.toBeInTheDocument();
  });

  it("o botão de fechar do rodapé do Dialog se chama 'Fechar'", () => {
    render(
      <Dialog open>
        <DialogContent showCloseButton={false}>
          <DialogTitle>Título</DialogTitle>
          <DialogDescription>Descrição</DialogDescription>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
    expect(screen.queryByText("Close")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/components/ui/touchTargets.test.tsx src/components/ui/ptBrLabels.test.tsx`
Expected: FAIL com `Failed to resolve import "@/components/ui/dialog"` (e `toggle-group`, `native-select`): os primitivos ainda não existem. Se aparecer `Timeout waiting for worker to respond` (máquina Windows lenta), repita com `--maxWorkers=2`.

- [ ] **Step 3: Gerar os primitivos com o CLI do shadcn**

`dialog` reinstala `button.tsx`, e o CLI pergunta se pode sobrescrever mesmo com `--yes`; por isso `--overwrite`, e depois restauramos o `button.tsx` (F2-24). Rode:

```bash
bunx shadcn add toggle-group native-select dialog --yes --overwrite
git checkout -- src/components/ui/button.tsx
bunx biome check --write src
git status --short
```

Expected (verificado num clone): o CLI lista `Created 4 files` (`native-select.tsx`, `toggle.tsx`, `toggle-group.tsx`, `dialog.tsx`) e `Updated 1 file` (`button.tsx`); o Biome diz `Fixed 4 files`; o `git status` mostra **só** os 4 arquivos novos como `??` (nenhum ` M src/components/ui/button.tsx`: o checkout restaurou o P3, `h-9`/`max-md:h-11`). Se `button.tsx` aparecer modificado, rode o `git checkout` de novo.

- [ ] **Step 4: Run test to verify it still fails (alvos de toque e "Close" em inglês)**

Run: `bun run test -- src/components/ui/touchTargets.test.tsx src/components/ui/ptBrLabels.test.tsx`
Expected: FAIL, 9 testes falhando e 3 passando (os 2 antigos do `ptBrLabels` e o `aria-pressed`). Mensagens típicas: `expected 8 to be greater than or equal to 9` (toggle `default` é `h-8`, `sm` é `h-7`), `expected null to be 11` (toggle `lg` não tem `max-md:`), `expected [ 'h-8', … ] to include 'text-base'` e o botão `Fechar` não encontrado no `Dialog`.

- [ ] **Step 5: Aplicar os ajustes (diff exato sobre o código gerado e formatado pelo Biome)**

Rode da raiz do repositório (o patch só tem ASCII, então o heredoc é seguro). Ele troca as alturas por `h-9 max-md:h-11` (toggle: também `min-w`), põe `text-base md:text-sm` no `<select>` (16px, ui-rules §2.3), remove o `data-[size=sm]:h-7` (que venceria o `max-md:h-11` por especificidade) e traduz os dois "Close":

```bash
git apply <<'EOF'
diff --git a/src/components/ui/dialog.tsx b/src/components/ui/dialog.tsx
--- a/src/components/ui/dialog.tsx
+++ b/src/components/ui/dialog.tsx
@@ -70,7 +70,7 @@ function DialogContent({
             }
           >
             <XIcon />
-            <span className="sr-only">Close</span>
+            <span className="sr-only">Fechar</span>
           </DialogPrimitive.Close>
         )}
       </DialogPrimitive.Popup>
@@ -108,7 +108,7 @@ function DialogFooter({
       {children}
       {showCloseButton && (
         <DialogPrimitive.Close render={<Button variant="outline" />}>
-          Close
+          Fechar
         </DialogPrimitive.Close>
       )}
     </div>
diff --git a/src/components/ui/native-select.tsx b/src/components/ui/native-select.tsx
--- a/src/components/ui/native-select.tsx
+++ b/src/components/ui/native-select.tsx
@@ -23,7 +23,7 @@ function NativeSelect({
       <select
         data-slot="native-select"
         data-size={size}
-        className="h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-sm transition-colors outline-none select-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-[size=sm]:py-0.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
+        className="h-9 w-full min-w-0 max-md:h-11 appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-base md:text-sm transition-colors outline-none select-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-[size=sm]:py-0.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
         {...props}
       />
       <ChevronDownIcon
diff --git a/src/components/ui/toggle.tsx b/src/components/ui/toggle.tsx
--- a/src/components/ui/toggle.tsx
+++ b/src/components/ui/toggle.tsx
@@ -14,9 +14,9 @@ const toggleVariants = cva(
       },
       size: {
         default:
-          "h-8 min-w-8 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
-        sm: "h-7 min-w-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
-        lg: "h-9 min-w-9 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
+          "h-9 min-w-9 px-2.5 max-md:h-11 max-md:min-w-11 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
+        sm: "h-9 min-w-9 max-md:h-11 max-md:min-w-11 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
+        lg: "h-9 min-w-9 max-md:h-11 max-md:min-w-11 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
       },
     },
     defaultVariants: {
EOF
bunx biome check src/components/ui
```

Expected: o `git apply` não imprime nada; o `biome check` termina sem erros. Se o `git apply` reclamar de contexto, o CLI do shadcn gerou outra versão dos arquivos: refaça as mesmas trocas à mão (as 3 classes do `toggle.tsx`, a `className` do `<select>`, os dois "Close") e siga.

- [ ] **Step 6: Run test to verify it passes**

Run: `bun run test -- src/components/ui/touchTargets.test.tsx src/components/ui/ptBrLabels.test.tsx`
Expected: PASS (12 testes: 8 em `touchTargets.test.tsx` e 4 em `ptBrLabels.test.tsx`)

- [ ] **Step 7: Registrar os primitivos no `ui-registry.md`**

Em `.context/ui-registry.md`, com a ferramenta Edit, substitua a linha `## 2. Componentes de aplicação — \`src/components/<área>\`` por todo o bloco abaixo (os 3 primitivos entram no fim da seção 1, e o título da seção 2 continua depois):

```markdown
### Toggle / ToggleGroup
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/ui/toggle.tsx`, `src/components/ui/toggle-group.tsx`
- **Propósito:** controle segmentado para um conjunto pequeno e fechado de respostas (papel, tipo do item).
- **Como funciona:** `@base-ui/react/toggle-group`; `ToggleGroup` (`variant`, `size`, `spacing`) + `ToggleGroupItem`; o item marcado tem `aria-pressed="true"`. No uso do projeto: `variant="outline"`, `size="lg"`. Clicar no item já marcado **desmarca** (lista vazia em `onValueChange`): quem precisa de "nunca vazio" usa o `ChoiceGroup`.
- **Atenção:** todo tamanho tem `h-9` / `min-w-9` no desktop e `max-md:h-11` / `max-md:min-w-11` no celular. Teste: `touchTargets.test.tsx`.
- **Usa:** tokens `muted`, `input`, `ring`.
- **Histórico:** 2026-11-21 — `shadcn add toggle-group` (traz `toggle`); alturas `h-8`/`h-7` viram `h-9 max-md:h-11` (P3).

### NativeSelect
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/ui/native-select.tsx`
- **Propósito:** escolha de um conjunto conhecido com o seletor do próprio aparelho.
- **Como funciona:** `<select>` nativo num wrapper com ícone (`NativeSelect`, `NativeSelectOption`, `NativeSelectOptGroup`). `className` vai para o wrapper; as demais props (`id`, `value`, `onChange`, `aria-*`) vão para o `<select>`. Texto `text-base md:text-sm` (16px no celular, sem zoom do iOS); altura `h-9 max-md:h-11`.
- **Usa:** tokens `input`, `ring`, `destructive`.
- **Histórico:** 2026-11-21 — `shadcn add native-select`; altura `h-8` vira `h-9 max-md:h-11` e o texto ganha `text-base` (P3); removido o `data-[size=sm]:h-7` (venceria o `max-md:` por especificidade).

### Dialog
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/ui/dialog.tsx`
- **Propósito:** diálogo modal (editar um registro, confirmar uma ação sem volta fácil).
- **Como funciona:** `@base-ui/react/dialog`; `Dialog`, `DialogTrigger`, `DialogContent` (botão `Fechar` `sr-only` com `size="icon-sm"`, 44px no celular; `showCloseButton={false}` o remove), `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter` (`showCloseButton` acrescenta um "Fechar" `outline`), `DialogClose`. Gatilho por `render`: `<DialogTrigger render={<Button … />}>`. Foco entra no diálogo e volta ao gatilho; `Esc` fecha. Funciona no jsdom sem polyfill.
- **Usa:** `Button`; tokens `popover`, `muted`.
- **Histórico:** 2026-11-21 — `shadcn add dialog`; os dois "Close" viram "Fechar" (P12). O CLI sobrescreve `button.tsx` (pergunta mesmo com `--yes`): rode com `--overwrite` e depois `git checkout -- src/components/ui/button.tsx` (F2-24).

## 2. Componentes de aplicação — `src/components/<área>`
```

E em `### Button`, no campo **Histórico** (que ocupa duas linhas; a segunda é única no arquivo), com a ferramenta Edit:

- `old_string`: `  toque (h-9 desktop, 44px no celular).`
- `new_string`: `  toque (h-9 desktop, 44px no celular). 2026-11-21 — Fase 2: \`shadcn add dialog\` sobrescreve o arquivo; restaurado com \`git checkout\` (F2-24).`

- [ ] **Step 8: Verificação completa**

Run: `bun run check-types && bun run lint && bun run test`
Expected: tipos e Biome sem erro; Vitest todo verde (nenhum teste anterior quebra: `button.tsx` está intacto). Se o Vitest falhar com `Timeout waiting for worker to respond` em alguns arquivos, repita com `bun run test -- --maxWorkers=3`.

- [ ] **Step 9: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-4.txt` (texto exato abaixo) e rode:

```bash
git add src/components/ui/toggle.tsx src/components/ui/toggle-group.tsx src/components/ui/native-select.tsx src/components/ui/dialog.tsx src/components/ui/touchTargets.test.tsx src/components/ui/ptBrLabels.test.tsx .context/ui-registry.md
git commit -F .git/sdd/msg-task-4.txt
```

Mensagem:

```text
feat(ui): primitivos toggle-group, native-select e dialog

Adicionados com o CLI do shadcn (button.tsx restaurado, F2-24). Alvos de
toque h-9/max-md:h-11, texto de 16px no select nativo e "Fechar" em pt-BR
no Dialog; testes de alvo de toque e de rótulo acessível.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 5: UI compartilhada do admin (`src/components/admin/*`)

**Files:**
- Create: `src/features/admin/sectors.ts` (**só** o tipo `SectorChoice`; a Tarefa 6 acrescenta o resto no mesmo arquivo — ver nota abaixo)
- Create: `src/components/admin/InactiveBadge.tsx`, `AdminPageHeader.tsx`, `AdminListRow.tsx`, `AdminListSkeleton.tsx`, `EmptyState.tsx`, `Pagination.tsx`, `SectorSwitcher.tsx` (server-safe)
- Create: `src/components/admin/MoveButtons.tsx`, `ChoiceGroup.tsx`, `SelectField.tsx`, `useAdminAction.ts`, `EditDialog.tsx`, `ConfirmDialog.tsx`, `NameForm.tsx`, `ActiveToggleButton.tsx` (`"use client"`)
- Test (um por componente, todos em `src/components/admin/`): `InactiveBadge.test.tsx`, `AdminPageHeader.test.tsx`, `AdminListRow.test.tsx`, `AdminListSkeleton.test.tsx`, `EmptyState.test.tsx`, `Pagination.test.tsx`, `SectorSwitcher.test.tsx`, `MoveButtons.test.tsx`, `ChoiceGroup.test.tsx`, `SelectField.test.tsx`, `EditDialog.test.tsx`, `ConfirmDialog.test.tsx`, `NameForm.test.tsx`, `ActiveToggleButton.test.tsx`, `useAdminAction.test.tsx`
- Modify: `test/setup-dom.ts` (import de `configure` e uma chamada no fim; ver Step 9)
- Modify: `vitest.config.ts` (projeto `dom`: `globalSetup` e timeouts; ver Step 9)
- Modify: `.context/ui-registry.md` (15 componentes novos, antes da seção 3)

> **Nota de dependência:** `SectorSwitcher` precisa do **tipo** `SectorChoice` (contrato: `src/features/admin/sectors.ts`, criado na Tarefa 6). Como a tabela põe a 5 antes da 6, esta tarefa cria o arquivo só com o tipo; a Tarefa 6 passa a **modificar** o arquivo (acrescenta `listSectors`, `createSector`… mantendo o `export type SectorChoice` idêntico).

**Interfaces:**
- Consumes (Tarefas 2, 3 e 4; os nomes são os do contrato):
  - `AdminResult<T extends object = object>`, `fail(code, message, fieldErrors?)`, `INTERNAL_ERROR_MESSAGE` ("Não foi possível concluir. Tente de novo.") e `ok()`/`ok(data)` de `@/features/admin/result` (os testes usam `ok` e `fail`)
  - `validateName(raw): { ok: true; name } | { ok: false; message }` de `@/features/admin/names` (mensagens `"Informe o nome."` e `"O nome pode ter no máximo 60 caracteres."`)
  - `buildPageHref(pathname, params, param, page): string` de `@/features/admin/pagination` — **a ordem do resultado importa para os testes**: os demais parâmetros na ordem em que chegam, o parâmetro da página por último, `undefined` ignorado, página 1 sem parâmetro (ex.: `buildPageHref("/admin/equipe", { pagina: "4" }, "convites", 3)` = `"/admin/equipe?pagina=4&convites=3"`)
  - `SortDirection` (`"up" | "down"`) de `@/features/admin/reorder`
  - `Button`/`buttonVariants`, `Badge`, `Skeleton`, `Field*`, `Input`, `Tooltip*` (já existem) e `ToggleGroup`, `NativeSelect`, `Dialog*` (Tarefa 4)
- Produces (assinaturas exatas do contrato; usadas pelas Tarefas 6–10):

```ts
InactiveBadge()
AdminPageHeader(props: { title: string; description: string; backHref?: "/admin" })
AdminListRow(props: { title: ReactNode; subtitle?: ReactNode; badges?: ReactNode; notes?: ReactNode; actions?: ReactNode; inactive?: boolean })
AdminListSkeleton(props: { rows?: number })
EmptyState(props: { title: string; description?: string; action?: { label: string; href: string } })
Pagination(props: { page: number; pageCount: number; pathname: string; params: Record<string, string | undefined>; param?: string })
SectorSwitcher(props: { sectors: readonly SectorChoice[]; selectedId: string; pathname: "/admin/turnos" | "/admin/itens" })
MoveButtons(props: { label: string; canMoveUp: boolean; canMoveDown: boolean; pending?: boolean; onMove: (direction: SortDirection) => void })
ChoiceGroup<T extends string>(props: { legend: string; value: T; onValueChange: (value: T) => void; options: readonly { value: T; label: string }[]; description?: string; disabled?: boolean })
SelectField(props: { id?: string; label: string; value: string; onValueChange: (value: string) => void; options: readonly { value: string; label: string }[]; description?: string; error?: string; disabled?: boolean })
EditDialog(props: { title: string; name: string; children: (close: () => void) => ReactNode })
ConfirmDialog(props: { trigger: ReactElement; title: string; description: string; confirmLabel: string; cancelLabel?: string; destructive?: boolean; onConfirm: () => Promise<AdminResult> })
NameForm(props: { entity: "setor" | "destino"; initialName: string; submitLabel: string; onSubmit: (name: string) => Promise<AdminResult<object>>; successMessage?: string; onDone?: () => void })
ActiveToggleButton(props: { entity: "Setor" | "Turno" | "Item" | "Destino"; name: string; active: boolean; onToggle: (nextActive: boolean) => Promise<AdminResult<object>> })
useAdminAction(): { pending: boolean; run: <T extends object>(action: () => Promise<AdminResult<T>>, options?: { success?: string; showError?: boolean }) => Promise<AdminResult<T>> }
```

Pré-requisito (confira antes de começar): `ls src/features/admin/result.ts src/features/admin/names.ts src/features/admin/pagination.ts src/features/admin/reorder.ts src/components/ui/dialog.tsx src/components/ui/toggle-group.tsx src/components/ui/native-select.tsx` lista os sete arquivos (Tarefas 2, 3 e 4 concluídas).

#### Parte A — componentes server-safe (sem `"use client"`)

- [ ] **Step 1: Write the failing tests (lista, cabeçalho, paginação, seletor de setor)**

Crie `src/components/admin/InactiveBadge.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InactiveBadge } from "./InactiveBadge";

describe("InactiveBadge", () => {
  it("mostra o texto 'Inativo' (nunca só cor)", () => {
    render(<InactiveBadge />);
    expect(screen.getByText("Inativo")).toBeInTheDocument();
  });
});
```

Crie `src/components/admin/AdminPageHeader.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminPageHeader } from "./AdminPageHeader";

describe("AdminPageHeader", () => {
  it("mostra o título como h1 e a descrição", () => {
    render(
      <AdminPageHeader title="Setores" description="Onde cada um trabalha." />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Setores" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Onde cada um trabalha.")).toBeInTheDocument();
  });

  it("sem backHref não mostra o link de voltar", () => {
    render(<AdminPageHeader title="Administração" description="Cadastros." />);

    expect(
      screen.queryByRole("link", { name: "Voltar para Administração" }),
    ).not.toBeInTheDocument();
  });

  it("com backHref mostra o link 'Voltar para Administração' para /admin", () => {
    render(
      <AdminPageHeader
        title="Setores"
        description="Onde cada um trabalha."
        backHref="/admin"
      />,
    );

    expect(
      screen.getByRole("link", { name: "Voltar para Administração" }),
    ).toHaveAttribute("href", "/admin");
  });
});
```

Crie `src/components/admin/AdminListRow.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminListRow } from "./AdminListRow";

function renderRow(props: Parameters<typeof AdminListRow>[0]) {
  return render(
    <ul>
      <AdminListRow {...props} />
    </ul>,
  );
}

describe("AdminListRow", () => {
  it("é um item de lista com título, subtítulo, selos, avisos e ações", () => {
    renderRow({
      title: "Turno Manhã",
      subtitle: "06:00–14:00",
      badges: <span>Atravessa a meia-noite</span>,
      notes: <p>Sobrepõe o turno Tarde (13:00–21:00)</p>,
      actions: <button type="button">Editar</button>,
    });

    const item = screen.getByRole("listitem");
    expect(within(item).getByText("Turno Manhã")).toBeInTheDocument();
    expect(within(item).getByText("06:00–14:00")).toBeInTheDocument();
    expect(
      within(item).getByText("Atravessa a meia-noite"),
    ).toBeInTheDocument();
    expect(
      within(item).getByText("Sobrepõe o turno Tarde (13:00–21:00)"),
    ).toBeInTheDocument();
    expect(
      within(item).getByRole("button", { name: "Editar" }),
    ).toBeInTheDocument();
  });

  it("ativo não mostra o selo 'Inativo'", () => {
    renderRow({ title: "Almoxarifado" });

    expect(screen.queryByText("Inativo")).not.toBeInTheDocument();
    expect(screen.getByText("Almoxarifado")).not.toHaveClass(
      "text-muted-foreground",
    );
  });

  it("inativo mostra o selo 'Inativo' e esmaece o título", () => {
    renderRow({ title: "Almoxarifado", inactive: true });

    expect(screen.getByText("Inativo")).toBeInTheDocument();
    expect(screen.getByText("Almoxarifado")).toHaveClass(
      "text-muted-foreground",
    );
  });

  it("só com o título não renderiza regiões vazias", () => {
    renderRow({ title: "Almoxarifado" });

    expect(screen.getByRole("listitem").textContent).toBe("Almoxarifado");
  });
});
```

Crie `src/components/admin/AdminListSkeleton.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AdminListSkeleton } from "./AdminListSkeleton";

describe("AdminListSkeleton", () => {
  it("mostra 4 linhas por padrão e avisa que está ocupado", () => {
    render(<AdminListSkeleton />);

    const list = screen.getByRole("list", { name: "Carregando" });
    expect(list).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("respeita a quantidade pedida", () => {
    render(<AdminListSkeleton rows={2} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("com zero linhas não renderiza itens", () => {
    render(<AdminListSkeleton rows={0} />);
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});
```

Crie `src/components/admin/EmptyState.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("mostra título e descrição", () => {
    render(
      <EmptyState
        title="Nenhum setor ainda."
        description="Crie o primeiro setor acima."
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Nenhum setor ainda." }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Crie o primeiro setor acima."),
    ).toBeInTheDocument();
  });

  it("sem ação não mostra link", () => {
    render(<EmptyState title="Nenhum setor ainda." />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("a ação é um link (role link) para o destino", () => {
    render(
      <EmptyState
        title="Nenhum setor ativo."
        action={{ label: "Ir para Setores", href: "/admin/setores" }}
      />,
    );

    expect(
      screen.getByRole("link", { name: "Ir para Setores" }),
    ).toHaveAttribute("href", "/admin/setores");
  });
});
```

Crie `src/components/admin/Pagination.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("não renderiza nada com uma página só (ou zero)", () => {
    const { container, rerender } = render(
      <Pagination
        page={1}
        pageCount={1}
        pathname="/admin/setores"
        params={{}}
      />,
    );
    expect(container).toBeEmptyDOMElement();

    rerender(
      <Pagination
        page={1}
        pageCount={0}
        pathname="/admin/setores"
        params={{}}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("na primeira página 'Anterior' não é link e 'Próxima' vai para a página 2", () => {
    render(
      <Pagination
        page={1}
        pageCount={3}
        pathname="/admin/setores"
        params={{}}
      />,
    );

    expect(
      screen.getByRole("navigation", { name: "Paginação" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Anterior" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Anterior")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/admin/setores?pagina=2",
    );
  });

  it("no meio os dois links existem e voltar à página 1 remove o parâmetro", () => {
    const { rerender } = render(
      <Pagination
        page={2}
        pageCount={3}
        pathname="/admin/setores"
        params={{}}
      />,
    );

    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/admin/setores",
    );
    expect(screen.getByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/admin/setores?pagina=3",
    );

    rerender(
      <Pagination
        page={3}
        pageCount={3}
        pathname="/admin/setores"
        params={{}}
      />,
    );
    expect(
      screen.queryByRole("link", { name: "Próxima" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Próxima")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/admin/setores?pagina=2",
    );
  });

  it("preserva os outros parâmetros, como o setor", () => {
    render(
      <Pagination
        page={1}
        pageCount={2}
        pathname="/admin/turnos"
        params={{ setor: "abc-123", pagina: "1", vazio: undefined }}
      />,
    );

    expect(screen.getByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/admin/turnos?setor=abc-123&pagina=2",
    );
  });

  it("usa o parâmetro pedido (lista de convites da Equipe)", () => {
    render(
      <Pagination
        page={2}
        pageCount={3}
        pathname="/admin/equipe"
        params={{ pagina: "4" }}
        param="convites"
      />,
    );

    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/admin/equipe?pagina=4",
    );
    expect(screen.getByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/admin/equipe?pagina=4&convites=3",
    );
  });
});
```

Crie `src/components/admin/SectorSwitcher.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SectorSwitcher } from "./SectorSwitcher";

const uld = { id: "11111111-1111-4111-8111-111111111111", name: "ULD" };
const gelo = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Água & Gelo",
};
const sectors = [uld, gelo];

describe("SectorSwitcher", () => {
  it("é uma navegação 'Setor' com um link por setor", () => {
    render(
      <SectorSwitcher
        sectors={sectors}
        selectedId={uld.id}
        pathname="/admin/turnos"
      />,
    );

    const nav = screen.getByRole("navigation", { name: "Setor" });
    expect(within(nav).getAllByRole("link")).toHaveLength(2);
    expect(within(nav).getByRole("link", { name: "ULD" })).toHaveAttribute(
      "href",
      `/admin/turnos?setor=${uld.id}`,
    );
  });

  it("marca só o setor escolhido com aria-current", () => {
    render(
      <SectorSwitcher
        sectors={sectors}
        selectedId={gelo.id}
        pathname="/admin/itens"
      />,
    );

    expect(screen.getByRole("link", { name: "Água & Gelo" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "ULD" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "ULD" })).toHaveAttribute(
      "href",
      `/admin/itens?setor=${uld.id}`,
    );
  });

  it("não marca ninguém quando o id escolhido não está na lista", () => {
    render(
      <SectorSwitcher
        sectors={sectors}
        selectedId="inexistente"
        pathname="/admin/turnos"
      />,
    );

    for (const link of screen.getAllByRole("link")) {
      expect(link).not.toHaveAttribute("aria-current");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --project dom src/components/admin/InactiveBadge src/components/admin/AdminPageHeader src/components/admin/AdminListRow src/components/admin/AdminListSkeleton src/components/admin/EmptyState src/components/admin/Pagination src/components/admin/SectorSwitcher`
Expected: FAIL com `Failed to resolve import "./InactiveBadge"` (e os demais) nos 7 arquivos.

- [ ] **Step 3: Write minimal implementation (componentes server-safe)**

Crie `src/features/admin/sectors.ts` (só o tipo; a Tarefa 6 acrescenta o resto):

```ts
export type SectorChoice = { id: string; name: string };
```

Crie `src/components/admin/InactiveBadge.tsx`:

```tsx
import { Badge } from "@/components/ui/badge";

export function InactiveBadge() {
  return <Badge variant="secondary">Inativo</Badge>;
}
```

Crie `src/components/admin/AdminPageHeader.tsx`:

```tsx
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AdminPageHeader({
  title,
  description,
  backHref,
}: {
  title: string;
  description: string;
  backHref?: "/admin";
}) {
  return (
    <header className="flex flex-col gap-2">
      {backHref && (
        <Link
          href={backHref}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2.5 w-fit",
          )}
        >
          <ChevronLeft aria-hidden="true" />
          Voltar para Administração
        </Link>
      )}
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">{description}</p>
    </header>
  );
}
```

Crie `src/components/admin/AdminListRow.tsx`:

```tsx
import type { ReactNode } from "react";

import { InactiveBadge } from "@/components/admin/InactiveBadge";
import { cn } from "@/lib/utils";

export function AdminListRow({
  title,
  subtitle,
  badges,
  notes,
  actions,
  inactive = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  notes?: ReactNode;
  actions?: ReactNode;
  inactive?: boolean;
}) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-card p-3 text-card-foreground sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-medium break-words",
              inactive && "text-muted-foreground",
            )}
          >
            {title}
          </span>
          {badges}
          {inactive && <InactiveBadge />}
        </div>
        {subtitle && (
          <div className="text-sm text-muted-foreground">{subtitle}</div>
        )}
        {notes}
      </div>
      {actions && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </li>
  );
}
```

Crie `src/components/admin/AdminListSkeleton.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export function AdminListSkeleton({ rows = 4 }: { rows?: number }) {
  const keys = Array.from({ length: rows }, (_, index) => `linha-${index}`);

  return (
    <ul
      aria-busy="true"
      aria-label="Carregando"
      className="flex flex-col gap-2"
    >
      {keys.map((key) => (
        <li key={key}>
          <Skeleton className="h-16 w-full" />
        </li>
      ))}
    </ul>
  );
}
```

Crie `src/components/admin/EmptyState.tsx`:

```tsx
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-medium">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <Link
          href={action.href}
          className={buttonVariants({ variant: "outline" })}
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
```

Crie `src/components/admin/Pagination.tsx`:

```tsx
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { buildPageHref } from "@/features/admin/pagination";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageCount,
  pathname,
  params,
  param = "pagina",
}: {
  page: number;
  pageCount: number;
  pathname: string;
  params: Record<string, string | undefined>;
  param?: string;
}) {
  if (pageCount <= 1) return null;

  const previous =
    page > 1 ? buildPageHref(pathname, params, param, page - 1) : null;
  const next =
    page < pageCount ? buildPageHref(pathname, params, param, page + 1) : null;
  const buttonClass = buttonVariants({ variant: "outline" });

  return (
    <nav
      aria-label="Paginação"
      className="flex items-center justify-between gap-2"
    >
      {previous ? (
        <Link href={previous} className={buttonClass}>
          Anterior
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className={cn(buttonClass, "pointer-events-none opacity-50")}
        >
          Anterior
        </span>
      )}
      <span className="text-sm text-muted-foreground tabular-nums">
        Página {page} de {pageCount}
      </span>
      {next ? (
        <Link href={next} className={buttonClass}>
          Próxima
        </Link>
      ) : (
        <span
          aria-disabled="true"
          className={cn(buttonClass, "pointer-events-none opacity-50")}
        >
          Próxima
        </span>
      )}
    </nav>
  );
}
```

Crie `src/components/admin/SectorSwitcher.tsx`:

```tsx
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import type { SectorChoice } from "@/features/admin/sectors";

export function SectorSwitcher({
  sectors,
  selectedId,
  pathname,
}: {
  sectors: readonly SectorChoice[];
  selectedId: string;
  pathname: "/admin/turnos" | "/admin/itens";
}) {
  return (
    <nav aria-label="Setor">
      <ul className="flex flex-wrap gap-2">
        {sectors.map((sector) => {
          const selected = sector.id === selectedId;
          return (
            <li key={sector.id}>
              <Link
                href={`${pathname}?setor=${encodeURIComponent(sector.id)}`}
                aria-current={selected ? "page" : undefined}
                className={buttonVariants({
                  variant: selected ? "default" : "outline",
                })}
              >
                {sector.name}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- --project dom src/components/admin/InactiveBadge src/components/admin/AdminPageHeader src/components/admin/AdminListRow src/components/admin/AdminListSkeleton src/components/admin/EmptyState src/components/admin/Pagination src/components/admin/SectorSwitcher`
Expected: PASS (22 testes: 1 + 3 + 4 + 3 + 3 + 5 + 3)

#### Parte B — controles de cliente (movimento, escolha, seletor)

- [ ] **Step 5: Write the failing tests (MoveButtons, ChoiceGroup, SelectField)**

Crie `src/components/admin/MoveButtons.test.tsx` (o tooltip é provado com o mesmo `fireEvent` de `MenuToggle.test.tsx`; o `TooltipProvider` é obrigatório no Base UI):

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { MoveButtons } from "./MoveButtons";

function setup(props: Partial<Parameters<typeof MoveButtons>[0]> = {}) {
  const onMove = vi.fn();
  render(
    <TooltipProvider>
      <MoveButtons
        label="Turno Manhã"
        canMoveUp
        canMoveDown
        onMove={onMove}
        {...props}
      />
    </TooltipProvider>,
  );
  return { onMove };
}

function hover(element: HTMLElement) {
  fireEvent.pointerEnter(element, { pointerType: "mouse" });
  fireEvent.mouseEnter(element);
  fireEvent.pointerMove(element, { pointerType: "mouse" });
  fireEvent.mouseMove(element);
}

describe("MoveButtons", () => {
  it("tem dois botões com aria-label que citam o item", () => {
    setup();

    expect(
      screen.getByRole("button", { name: "Subir Turno Manhã" }),
    ).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Descer Turno Manhã" }),
    ).toBeEnabled();
  });

  it("clicar chama onMove com a direção", async () => {
    const { onMove } = setup();

    await userEvent.click(
      screen.getByRole("button", { name: "Subir Turno Manhã" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Descer Turno Manhã" }),
    );

    expect(onMove).toHaveBeenNthCalledWith(1, "up");
    expect(onMove).toHaveBeenNthCalledWith(2, "down");
  });

  it("funciona pelo teclado (Tab e Enter)", async () => {
    const { onMove } = setup();

    await userEvent.tab();
    expect(
      screen.getByRole("button", { name: "Subir Turno Manhã" }),
    ).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    await userEvent.tab();
    expect(
      screen.getByRole("button", { name: "Descer Turno Manhã" }),
    ).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    expect(onMove).toHaveBeenNthCalledWith(1, "up");
    expect(onMove).toHaveBeenNthCalledWith(2, "down");
  });

  it("o primeiro item não sobe", async () => {
    const { onMove } = setup({ canMoveUp: false });
    const up = screen.getByRole("button", { name: "Subir Turno Manhã" });

    expect(up).toBeDisabled();
    await userEvent.click(up);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("o último item não desce", async () => {
    const { onMove } = setup({ canMoveDown: false });
    const down = screen.getByRole("button", { name: "Descer Turno Manhã" });

    expect(down).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Subir Turno Manhã" }),
    ).toBeEnabled();
    await userEvent.click(down);
    expect(onMove).not.toHaveBeenCalled();
  });

  it("pendente desabilita os dois botões", () => {
    setup({ pending: true });

    expect(
      screen.getByRole("button", { name: "Subir Turno Manhã" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Descer Turno Manhã" }),
    ).toBeDisabled();
  });

  it("mostra o tooltip 'Subir' e 'Descer' ao passar o mouse", async () => {
    setup();
    expect(screen.queryByText("Subir")).not.toBeInTheDocument();

    hover(screen.getByRole("button", { name: "Subir Turno Manhã" }));
    await waitFor(() => expect(screen.getByText("Subir")).toBeInTheDocument());

    hover(screen.getByRole("button", { name: "Descer Turno Manhã" }));
    await waitFor(() => expect(screen.getByText("Descer")).toBeInTheDocument());
  });
});
```

Crie `src/components/admin/ChoiceGroup.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ChoiceGroup } from "./ChoiceGroup";

type Role = "operator" | "admin";

const options = [
  { value: "operator", label: "Operador" },
  { value: "admin", label: "Administrador" },
] as const;

function Harness({
  onChange,
  disabled,
  description,
}: {
  onChange: (value: Role) => void;
  disabled?: boolean;
  description?: string;
}) {
  const [value, setValue] = useState<Role>("operator");
  return (
    <ChoiceGroup<Role>
      legend="Papel"
      value={value}
      options={options}
      description={description}
      disabled={disabled}
      onValueChange={(next) => {
        onChange(next);
        setValue(next);
      }}
    />
  );
}

describe("ChoiceGroup", () => {
  it("é um grupo nomeado pela legenda, com a opção escolhida marcada", () => {
    render(<Harness onChange={vi.fn()} />);

    expect(screen.getByRole("group", { name: "Papel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Operador" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Administrador" }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("clicar em outra opção troca a seleção e avisa", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Administrador" }),
    );

    expect(onChange).toHaveBeenCalledExactlyOnceWith("admin");
    expect(
      screen.getByRole("button", { name: "Administrador" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Operador" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("clicar na opção já escolhida não desmarca nem avisa", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: "Operador" }));
    await userEvent.click(screen.getByRole("button", { name: "Operador" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Operador" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("escolhe pelo teclado (Tab até a opção e Espaço)", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    await userEvent.keyboard(" ");

    expect(onChange).toHaveBeenCalledExactlyOnceWith("admin");
  });

  it("mostra a descrição ligada ao grupo", () => {
    render(
      <Harness onChange={vi.fn()} description="Quem pode mudar cadastros." />,
    );

    const description = screen.getByText("Quem pode mudar cadastros.");
    expect(screen.getByRole("group", { name: "Papel" })).toHaveAttribute(
      "aria-describedby",
      description.id,
    );
  });

  it("desabilitado não aceita clique", async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} disabled />);

    await userEvent.click(
      screen.getByRole("button", { name: "Administrador" }),
    );

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Operador" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
```

Crie `src/components/admin/SelectField.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SelectField } from "./SelectField";

const options = [
  { value: "unidade", label: "Unidade" },
  { value: "rolo", label: "Rolo" },
  { value: "outro", label: "Outro…" },
];

describe("SelectField", () => {
  it("o rótulo nomeia o seletor e mostra a opção atual", () => {
    render(
      <SelectField
        label="Unidade"
        value="rolo"
        options={options}
        onValueChange={vi.fn()}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Unidade" });
    expect(select).toHaveValue("rolo");
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("escolher outra opção avisa com o valor", async () => {
    const onValueChange = vi.fn();
    render(
      <SelectField
        label="Unidade"
        value="unidade"
        options={options}
        onValueChange={onValueChange}
      />,
    );

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Unidade" }),
      "outro",
    );

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith("outro");
  });

  it("respeita o id recebido para ligar o rótulo", () => {
    render(
      <SelectField
        id="unidade-do-item"
        label="Unidade"
        value="unidade"
        options={options}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Unidade" })).toHaveAttribute(
      "id",
      "unidade-do-item",
    );
  });

  it("mostra a descrição ligada ao seletor", () => {
    render(
      <SelectField
        label="Setor"
        value="unidade"
        options={options}
        description="Só para operador."
        onValueChange={vi.fn()}
      />,
    );

    const description = screen.getByText("Só para operador.");
    expect(screen.getByRole("combobox", { name: "Setor" })).toHaveAttribute(
      "aria-describedby",
      description.id,
    );
  });

  it("com erro marca o seletor inválido e anuncia a mensagem", () => {
    render(
      <SelectField
        label="Setor"
        value="unidade"
        options={options}
        error="Escolha o setor do operador."
        onValueChange={vi.fn()}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Setor" });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Escolha o setor do operador.");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveAttribute(
      "aria-describedby",
      expect.stringContaining(alert.id),
    );
  });

  it("sem erro não marca inválido", () => {
    render(
      <SelectField
        label="Setor"
        value="unidade"
        options={options}
        onValueChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("combobox", { name: "Setor" })).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("desabilitado não aceita escolha", async () => {
    const onValueChange = vi.fn();
    render(
      <SelectField
        label="Setor"
        value="unidade"
        options={options}
        disabled
        onValueChange={onValueChange}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Setor" });
    expect(select).toBeDisabled();
    await userEvent.selectOptions(select, "rolo");
    expect(onValueChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bun run test -- --project dom src/components/admin/MoveButtons src/components/admin/ChoiceGroup src/components/admin/SelectField`
Expected: FAIL com `Failed to resolve import "./MoveButtons"` (e `./ChoiceGroup`, `./SelectField`).

- [ ] **Step 7: Write minimal implementation (MoveButtons, ChoiceGroup, SelectField)**

Crie `src/components/admin/MoveButtons.tsx`:

```tsx
"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SortDirection } from "@/features/admin/reorder";

// Botões só com ícone: aria-label (cita o item) + tooltip (regra do AGENTS.md).
export function MoveButtons({
  label,
  canMoveUp,
  canMoveDown,
  pending = false,
  onMove,
}: {
  label: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  pending?: boolean;
  onMove: (direction: SortDirection) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Subir ${label}`}
              disabled={!canMoveUp || pending}
              onClick={() => onMove("up")}
            />
          }
        >
          <ChevronUp />
        </TooltipTrigger>
        <TooltipContent>Subir</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Descer ${label}`}
              disabled={!canMoveDown || pending}
              onClick={() => onMove("down")}
            />
          }
        >
          <ChevronDown />
        </TooltipTrigger>
        <TooltipContent>Descer</TooltipContent>
      </Tooltip>
    </div>
  );
}
```

Crie `src/components/admin/ChoiceGroup.tsx`:

```tsx
"use client";

import { useId } from "react";

import { FieldDescription, FieldLegend, FieldSet } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

// Controle segmentado para um conjunto pequeno e fechado de respostas
// (ui-rules §2.1). Nunca fica sem seleção: clicar no item já escolhido não faz nada.
export function ChoiceGroup<T extends string>({
  legend,
  value,
  onValueChange,
  options,
  description,
  disabled = false,
}: {
  legend: string;
  value: T;
  onValueChange: (value: T) => void;
  options: readonly { value: T; label: string }[];
  description?: string;
  disabled?: boolean;
}) {
  const descriptionId = useId();

  return (
    <FieldSet aria-describedby={description ? descriptionId : undefined}>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <ToggleGroup
        variant="outline"
        size="lg"
        value={[value]}
        disabled={disabled}
        onValueChange={(next) => {
          // Clicar no item já escolhido chega aqui como lista vazia: ignora.
          const picked = options.find((option) => option.value === next[0]);
          if (picked) onValueChange(picked.value);
        }}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {description && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
    </FieldSet>
  );
}
```

Crie `src/components/admin/SelectField.tsx`:

```tsx
"use client";

import { useId } from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";

// Escolha de um conjunto conhecido: <select> nativo (abre o seletor do aparelho).
export function SelectField({
  id,
  label,
  value,
  onValueChange,
  options,
  description,
  error,
  disabled = false,
}: {
  id?: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  description?: string;
  error?: string;
  disabled?: boolean;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const descriptionId = `${fieldId}-description`;
  const errorId = `${fieldId}-error`;
  const describedBy =
    [description ? descriptionId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;

  return (
    <Field data-invalid={error ? "true" : undefined}>
      <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
      <NativeSelect
        id={fieldId}
        className="w-full"
        value={value}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        onChange={(event) => onValueChange(event.target.value)}
      >
        {options.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {description && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </Field>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun run test -- --project dom src/components/admin/MoveButtons src/components/admin/ChoiceGroup src/components/admin/SelectField`
Expected: PASS (20 testes: 7 + 6 + 7)

#### Parte C — diálogos, formulário, ação e hook

- [ ] **Step 9: Ajustar o tempo dos utilitários assíncronos do Testing Library e a configuração do projeto `dom`**

Com a suíte inteira em paralelo (PGlite incluso) o padrão de 1 s do `findBy*`/`waitFor` dá falha intermitente nos diálogos e formulários (visto num clone: `findByRole("alert")` estourando). Em `test/setup-dom.ts`, com a ferramenta Edit:

1. Troque `import { cleanup } from "@testing-library/react";` por:

```ts
import { cleanup, configure } from "@testing-library/react";
```

2. Acrescente no fim do arquivo (depois do bloco do `matchMedia`):

```ts

// Com a suíte inteira rodando em paralelo (PGlite incluso) a máquina fica lenta;
// o padrão de 1s do findBy*/waitFor gera falha intermitente em diálogos e formulários.
configure({ asyncUtilTimeout: 4000 });
```

3. Em `vitest.config.ts`, no projeto `dom` (o que tem `name: "dom"`), logo depois de `setupFiles: ["./test/setup-dom.ts"],`, acrescente:

```ts
          globalSetup: ["./test/global-setup.ts"],
          testTimeout: 15_000,
          hookTimeout: 30_000,
```

Por quê: a partir da Tarefa 7 há testes do projeto `dom` que usam `createTestDb` (PGlite real, `ShiftsAdmin` e `ItemsAdmin`). `createTestDb` lê o dump que o `globalSetup` gera, e o Vitest só roda o `globalSetup` dos projetos que têm arquivo na execução: sem ele aqui, rodar um `.test.tsx` sozinho dá `ENOENT … migrated.tar` (ou lê um dump velho). Os timeouts de 15 s/30 s são os do projeto `node`; o padrão de 5 s estoura com dezenas de `INSERT` no PGlite e esconde a mensagem do Testing Library.

- [ ] **Step 10: Write the failing tests (useAdminAction, EditDialog, ConfirmDialog, NameForm, ActiveToggleButton)**

O Dialog do Base UI roda no jsdom **sem polyfill** (portal em `document.body`, foco entra no diálogo e volta ao gatilho, `Esc` fecha); o que precisou foi só o `asyncUtilTimeout` do passo anterior e `userEvent.paste` em vez de digitar 61 caracteres. `sonner` é mockado como em `PasskeyManager.test.tsx`.

Crie `src/components/admin/useAdminAction.test.tsx`:

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail, ok } from "@/features/admin/result";
import { useAdminAction } from "./useAdminAction";

const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAdminAction", () => {
  it("começa sem pendência", () => {
    const { result } = renderHook(() => useAdminAction());
    expect(result.current.pending).toBe(false);
  });

  it("devolve o resultado de sucesso e avisa só se houver mensagem", async () => {
    const { result } = renderHook(() => useAdminAction());

    let quiet: unknown;
    await act(async () => {
      quiet = await result.current.run(async () => ok({ id: "1" }));
    });
    expect(quiet).toEqual({ ok: true, id: "1" });
    expect(mocks.success).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.run(async () => ok(), { success: "Setor criado." });
    });
    expect(mocks.success).toHaveBeenCalledExactlyOnceWith("Setor criado.");
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("falha devolve o resultado e mostra a mensagem em toast de erro", async () => {
    const { result } = renderHook(() => useAdminAction());
    const failure = fail(
      "NOT_FOUND",
      "Setor não encontrado. Atualize a página.",
    );

    let returned: unknown;
    await act(async () => {
      returned = await result.current.run(async () => failure, {
        success: "Nunca aparece.",
      });
    });

    expect(returned).toEqual(failure);
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith(
      "Setor não encontrado. Atualize a página.",
    );
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("showError: false não mostra toast (o formulário mostra o erro)", async () => {
    const { result } = renderHook(() => useAdminAction());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.run(
        async () => fail("NAME_TAKEN", "Já existe um setor com este nome."),
        { showError: false },
      );
    });

    expect(returned).toMatchObject({ ok: false, code: "NAME_TAKEN" });
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it("exceção vira falha INTERNAL com a mensagem padrão, sem texto cru", async () => {
    const { result } = renderHook(() => useAdminAction());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.run(async () => {
        throw new Error("ECONNRESET");
      });
    });

    expect(returned).toEqual({
      ok: false,
      code: "INTERNAL",
      message: "Não foi possível concluir. Tente de novo.",
    });
    expect(mocks.error).toHaveBeenCalledExactlyOnceWith(
      "Não foi possível concluir. Tente de novo.",
    );
  });

  it("pending fica true durante a ação e volta a false depois (inclusive na falha)", async () => {
    const { result } = renderHook(() => useAdminAction());
    let finish: (value: ReturnType<typeof ok>) => void = () => {};

    let pendingRun: Promise<unknown> = Promise.resolve();
    act(() => {
      pendingRun = result.current.run(
        () =>
          new Promise<ReturnType<typeof ok>>((resolve) => {
            finish = resolve;
          }),
      );
    });
    await waitFor(() => expect(result.current.pending).toBe(true));

    await act(async () => {
      finish(ok());
      await pendingRun;
    });
    expect(result.current.pending).toBe(false);

    await act(async () => {
      await result.current.run(async () => {
        throw new Error("x");
      });
    });
    expect(result.current.pending).toBe(false);
  });
});
```

Crie `src/components/admin/EditDialog.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { EditDialog } from "./EditDialog";

function setup() {
  render(
    <EditDialog title="Editar setor" name="Almoxarifado">
      {(close) => (
        <div>
          <label htmlFor="campo">Nome do setor</label>
          <input id="campo" defaultValue="Almoxarifado" />
          <button type="button" onClick={close}>
            Salvar alterações
          </button>
        </div>
      )}
    </EditDialog>,
  );
  return screen.getByRole("button", { name: "Editar Almoxarifado" });
}

describe("EditDialog", () => {
  it("o gatilho mostra 'Editar' e se chama 'Editar {nome}'", () => {
    const trigger = setup();

    expect(trigger).toHaveTextContent("Editar");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre o diálogo com título, nome como descrição e o formulário", async () => {
    const trigger = setup();

    await userEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Editar setor" });
    expect(dialog).toHaveAccessibleDescription("Almoxarifado");
    expect(screen.getByLabelText("Nome do setor")).toBeInTheDocument();
  });

  it("move o foco para dentro do diálogo", async () => {
    const trigger = setup();

    await userEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Editar setor" });
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true),
    );
  });

  it("a função recebida fecha o diálogo", async () => {
    const trigger = setup();
    await userEvent.click(trigger);
    await screen.findByRole("dialog", { name: "Editar setor" });

    await userEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("Esc fecha e devolve o foco ao gatilho", async () => {
    const trigger = setup();
    await userEvent.click(trigger);
    await screen.findByRole("dialog", { name: "Editar setor" });

    await userEvent.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("o botão 'Fechar' fecha sem salvar", async () => {
    const trigger = setup();
    await userEvent.click(trigger);
    await screen.findByRole("dialog", { name: "Editar setor" });

    await userEvent.click(screen.getByRole("button", { name: "Fechar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("ao abrir de novo o formulário volta ao valor salvo", async () => {
    const trigger = setup();
    await userEvent.click(trigger);
    const field = await screen.findByLabelText("Nome do setor");
    await userEvent.clear(field);
    await userEvent.type(field, "Outro nome");
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await userEvent.click(trigger);

    expect(await screen.findByLabelText("Nome do setor")).toHaveValue(
      "Almoxarifado",
    );
  });
});
```

Crie `src/components/admin/ConfirmDialog.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Button } from "@/components/ui/button";
import { fail, ok } from "@/features/admin/result";
import { ConfirmDialog } from "./ConfirmDialog";

function setup(
  onConfirm: Parameters<typeof ConfirmDialog>[0]["onConfirm"],
  props: { cancelLabel?: string; destructive?: boolean } = {},
) {
  render(
    <ConfirmDialog
      trigger={<Button variant="outline">Desativar Ana</Button>}
      title="Desativar Ana?"
      description="A pessoa perde o acesso agora."
      confirmLabel="Desativar"
      onConfirm={onConfirm}
      {...props}
    />,
  );
  return screen.getByRole("button", { name: "Desativar Ana" });
}

async function openDialog(trigger: HTMLElement) {
  await userEvent.click(trigger);
  return screen.findByRole("dialog", { name: "Desativar Ana?" });
}

describe("ConfirmDialog", () => {
  it("o gatilho abre o diálogo com título, descrição e os dois botões", async () => {
    const trigger = setup(vi.fn());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const dialog = await openDialog(trigger);

    expect(dialog).toHaveAccessibleDescription(
      "A pessoa perde o acesso agora.",
    );
    expect(screen.getByRole("button", { name: "Desativar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeEnabled();
  });

  it("'Voltar' fecha sem chamar a ação", async () => {
    const onConfirm = vi.fn();
    const trigger = setup(onConfirm);
    await openDialog(trigger);

    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("aceita outro rótulo para o botão que desiste", async () => {
    const trigger = setup(vi.fn(), { cancelLabel: "Manter convite" });
    await openDialog(trigger);

    expect(
      screen.getByRole("button", { name: "Manter convite" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Voltar" }),
    ).not.toBeInTheDocument();
  });

  it("sucesso chama a ação uma vez e fecha o diálogo", async () => {
    const onConfirm = vi.fn().mockResolvedValue(ok());
    const trigger = setup(onConfirm);
    await openDialog(trigger);

    await userEvent.click(screen.getByRole("button", { name: "Desativar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("falha mostra a mensagem no diálogo e NÃO fecha", async () => {
    const onConfirm = vi
      .fn()
      .mockResolvedValue(
        fail(
          "LAST_ADMIN",
          "Este é o último administrador ativo. Nomeie outro antes.",
        ),
      );
    const trigger = setup(onConfirm);
    const dialog = await openDialog(trigger);

    await userEvent.click(screen.getByRole("button", { name: "Desativar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este é o último administrador ativo. Nomeie outro antes.",
    );
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desativar" })).toBeEnabled();
  });

  it("exceção (rede, servidor) vira a mensagem genérica e não fecha", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("boom"));
    const trigger = setup(onConfirm);
    await openDialog(trigger);

    await userEvent.click(screen.getByRole("button", { name: "Desativar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir. Tente de novo.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
  });

  it("depois de uma falha dá para tentar de novo e fechar no sucesso", async () => {
    const onConfirm = vi
      .fn()
      .mockResolvedValueOnce(
        fail("INTERNAL", "Não foi possível concluir. Tente de novo."),
      )
      .mockResolvedValueOnce(ok());
    const trigger = setup(onConfirm);
    await openDialog(trigger);

    await userEvent.click(screen.getByRole("button", { name: "Desativar" }));
    await screen.findByRole("alert");
    await userEvent.click(screen.getByRole("button", { name: "Desativar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("enquanto a ação roda os botões ficam travados e o clique duplo não repete", async () => {
    let finish: (value: ReturnType<typeof ok>) => void = () => {};
    const onConfirm = vi.fn(
      () =>
        new Promise<ReturnType<typeof ok>>((resolve) => {
          finish = resolve;
        }),
    );
    const trigger = setup(onConfirm);
    await openDialog(trigger);

    const confirm = screen.getByRole("button", { name: "Desativar" });
    await userEvent.click(confirm);
    await userEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();

    finish(ok());
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("ao reabrir, a mensagem de erro anterior não aparece", async () => {
    const onConfirm = vi
      .fn()
      .mockResolvedValue(fail("INTERNAL", "Erro antigo."));
    const trigger = setup(onConfirm);
    await openDialog(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Desativar" }));
    await screen.findByText("Erro antigo.");
    await userEvent.click(screen.getByRole("button", { name: "Voltar" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await openDialog(trigger);

    expect(screen.queryByText("Erro antigo.")).not.toBeInTheDocument();
  });

  it("Esc fecha sem agir", async () => {
    const onConfirm = vi.fn();
    const trigger = setup(onConfirm);
    await openDialog(trigger);

    await userEvent.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
```

Crie `src/components/admin/NameForm.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail, ok } from "@/features/admin/result";
import { NameForm } from "./NameForm";

const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function setup(
  props: Partial<Parameters<typeof NameForm>[0]> & {
    onSubmit?: Parameters<typeof NameForm>[0]["onSubmit"];
  } = {},
) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(ok());
  render(
    <NameForm
      entity="setor"
      initialName=""
      submitLabel="Criar setor"
      successMessage="Setor criado."
      {...props}
      onSubmit={onSubmit}
    />,
  );
  return { onSubmit };
}

describe("NameForm", () => {
  it("o rótulo do campo depende da entidade", () => {
    const { unmount } = render(
      <NameForm
        entity="destino"
        initialName=""
        submitLabel="Criar destino"
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Nome do destino")).toBeInTheDocument();
    unmount();

    setup();
    expect(screen.getByLabelText("Nome do setor")).toBeInTheDocument();
  });

  it("começa com o nome inicial e o botão nomeia o resultado", () => {
    setup({ initialName: "Almoxarifado", submitLabel: "Salvar alterações" });

    expect(screen.getByLabelText("Nome do setor")).toHaveValue("Almoxarifado");
    expect(
      screen.getByRole("button", { name: "Salvar alterações" }),
    ).toBeEnabled();
  });

  it("envia o nome sem espaços sobrando, avisa com toast e limpa só no sucesso", async () => {
    const onDone = vi.fn();
    const { onSubmit } = setup({ onDone });

    await userEvent.type(
      screen.getByLabelText("Nome do setor"),
      "  Rede   de proteção ",
    );
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith("Rede de proteção");
    await waitFor(() =>
      expect(screen.getByLabelText("Nome do setor")).toHaveValue(""),
    );
    expect(mocks.success).toHaveBeenCalledWith("Setor criado.");
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("Enter no campo envia o formulário", async () => {
    const { onSubmit } = setup();

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD{Enter}");

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith("ULD"));
  });

  it("nome vazio ou só espaços mostra o erro e nem chama o servidor", async () => {
    const { onSubmit } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Informe o nome.",
    );

    await userEvent.type(screen.getByLabelText("Nome do setor"), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Informe o nome.");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("nome com 61 caracteres é recusado no cliente, com 60 passa", async () => {
    const { onSubmit } = setup();
    const field = screen.getByLabelText("Nome do setor");

    await userEvent.click(field);
    await userEvent.paste("a".repeat(61));
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O nome pode ter no máximo 60 caracteres.",
    );
    expect(onSubmit).not.toHaveBeenCalled();

    await userEvent.type(field, "{Backspace}");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it("quando o servidor recusa mantém o que foi digitado e mostra o erro do campo", async () => {
    const onDone = vi.fn();
    const onSubmit = vi.fn().mockResolvedValue(
      fail("NAME_TAKEN", "Já existe um setor com este nome.", {
        name: "Já existe um setor com este nome. Ele está inativo: reative-o na lista.",
      }),
    );
    setup({ onSubmit, onDone });

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(
      "Já existe um setor com este nome. Ele está inativo: reative-o na lista.",
    );
    const field = screen.getByLabelText("Nome do setor");
    expect(field).toHaveValue("ULD");
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveAttribute("aria-describedby", alert.id);
    expect(mocks.success).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Criar setor" })).toBeEnabled();
  });

  it("falha sem erro de campo mostra a mensagem geral e mantém o texto", async () => {
    const onSubmit = vi
      .fn()
      .mockResolvedValue(
        fail("NOT_FOUND", "Setor não encontrado. Atualize a página."),
      );
    setup({ onSubmit });

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Setor não encontrado. Atualize a página.",
    );
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("ULD");
  });

  it("exceção do servidor vira a mensagem genérica e mantém o texto", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("rede caiu"));
    setup({ onSubmit });

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir. Tente de novo.",
    );
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("ULD");
    expect(screen.queryByText("rede caiu")).not.toBeInTheDocument();
  });

  it("o erro some quando a pessoa volta a digitar", async () => {
    setup();

    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));
    await screen.findByRole("alert");

    await userEvent.type(screen.getByLabelText("Nome do setor"), "U");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Nome do setor")).not.toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("trava o botão enquanto envia e não envia duas vezes", async () => {
    let finish: (value: ReturnType<typeof ok>) => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<ReturnType<typeof ok>>((resolve) => {
          finish = resolve;
        }),
    );
    setup({ onSubmit });

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD");
    const button = screen.getByRole("button", { name: "Criar setor" });
    await userEvent.click(button);
    await userEvent.click(button);

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    finish(ok());
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("sem successMessage não mostra toast de sucesso", async () => {
    const { onSubmit } = setup({ successMessage: undefined });

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
```

Crie `src/components/admin/ActiveToggleButton.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail, ok } from "@/features/admin/result";
import { ActiveToggleButton } from "./ActiveToggleButton";

const mocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { success: mocks.success, error: mocks.error },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ActiveToggleButton", () => {
  it("ativo mostra 'Desativar' com aria-label que cita o nome", async () => {
    const onToggle = vi.fn().mockResolvedValue(ok());
    render(
      <ActiveToggleButton
        entity="Setor"
        name="Almoxarifado"
        active
        onToggle={onToggle}
      />,
    );

    const button = screen.getByRole("button", {
      name: "Desativar Almoxarifado",
    });
    expect(button).toHaveTextContent("Desativar");

    await userEvent.click(button);

    expect(onToggle).toHaveBeenCalledExactlyOnceWith(false);
    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith("Setor desativado."),
    );
  });

  it("inativo mostra 'Reativar' e pede o estado ativo", async () => {
    const onToggle = vi.fn().mockResolvedValue(ok());
    render(
      <ActiveToggleButton
        entity="Turno"
        name="Turno Manhã"
        active={false}
        onToggle={onToggle}
      />,
    );

    const button = screen.getByRole("button", { name: "Reativar Turno Manhã" });
    expect(button).toHaveTextContent("Reativar");

    await userEvent.click(button);

    expect(onToggle).toHaveBeenCalledExactlyOnceWith(true);
    await waitFor(() =>
      expect(mocks.success).toHaveBeenCalledWith("Turno reativado."),
    );
  });

  it.each([
    ["Item", "Item desativado."],
    ["Destino", "Destino desativado."],
  ] as const)("o toast de %s diz '%s'", async (entity, message) => {
    render(
      <ActiveToggleButton
        entity={entity}
        name="X"
        active
        onToggle={vi.fn().mockResolvedValue(ok())}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Desativar X" }));

    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(message));
  });

  it("falha mostra a mensagem em toast de erro e não celebra", async () => {
    const onToggle = vi
      .fn()
      .mockResolvedValue(
        fail(
          "SECTOR_IN_USE",
          "Este setor tem 1 pessoa ativa. Mova ou desative antes.",
        ),
      );
    render(
      <ActiveToggleButton
        entity="Setor"
        name="ULD"
        active
        onToggle={onToggle}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Desativar ULD" }),
    );

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        "Este setor tem 1 pessoa ativa. Mova ou desative antes.",
      ),
    );
    expect(mocks.success).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Desativar ULD" })).toBeEnabled();
  });

  it("exceção vira toast de erro genérico", async () => {
    render(
      <ActiveToggleButton
        entity="Setor"
        name="ULD"
        active
        onToggle={vi.fn().mockRejectedValue(new Error("boom"))}
      />,
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Desativar ULD" }),
    );

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        "Não foi possível concluir. Tente de novo.",
      ),
    );
  });

  it("fica travado enquanto a ação roda e não repete no clique duplo", async () => {
    let finish: (value: ReturnType<typeof ok>) => void = () => {};
    const onToggle = vi.fn(
      () =>
        new Promise<ReturnType<typeof ok>>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <ActiveToggleButton
        entity="Setor"
        name="ULD"
        active
        onToggle={onToggle}
      />,
    );

    const button = screen.getByRole("button", { name: "Desativar ULD" });
    await userEvent.click(button);
    await userEvent.click(button);

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();

    finish(ok());
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("funciona pelo teclado", async () => {
    const onToggle = vi.fn().mockResolvedValue(ok());
    render(
      <ActiveToggleButton
        entity="Setor"
        name="ULD"
        active
        onToggle={onToggle}
      />,
    );

    await userEvent.tab();
    expect(screen.getByRole("button", { name: "Desativar ULD" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");

    await waitFor(() => expect(onToggle).toHaveBeenCalledWith(false));
  });
});
```

- [ ] **Step 11: Run test to verify it fails**

Run: `bun run test -- --project dom src/components/admin/useAdminAction src/components/admin/EditDialog src/components/admin/ConfirmDialog src/components/admin/NameForm src/components/admin/ActiveToggleButton`
Expected: FAIL com `Failed to resolve import "./useAdminAction"` (e `./EditDialog`, `./ConfirmDialog`, `./NameForm`, `./ActiveToggleButton`).

- [ ] **Step 12: Write minimal implementation (hook, diálogos, formulário, botão)**

Crie `src/components/admin/useAdminAction.ts`:

```ts
"use client";

import { useState } from "react";
import { toast } from "sonner";

import {
  type AdminResult,
  fail,
  INTERNAL_ERROR_MESSAGE,
} from "@/features/admin/result";

type RunOptions = {
  /** Toast de sucesso; sem texto, sucesso é silencioso. */
  success?: string;
  /** Padrão true: erro vira toast. Formulários passam false e mostram o erro no campo. */
  showError?: boolean;
};

// Envolve a chamada a uma Server Action: controla `pending`, converte exceção
// (rede, servidor) em falha INTERNAL e cuida dos toasts. Nunca lança.
export function useAdminAction() {
  const [pending, setPending] = useState(false);

  async function run<T extends object>(
    action: () => Promise<AdminResult<T>>,
    options: RunOptions = {},
  ): Promise<AdminResult<T>> {
    setPending(true);
    let result: AdminResult<T>;
    try {
      result = await action();
    } catch {
      result = fail("INTERNAL", INTERNAL_ERROR_MESSAGE);
    } finally {
      setPending(false);
    }

    if (result.ok) {
      if (options.success) toast.success(options.success);
    } else if (options.showError ?? true) {
      toast.error(result.message);
    }
    return result;
  }

  return { pending, run };
}
```

Crie `src/components/admin/EditDialog.tsx`:

```tsx
"use client";

import { type ReactNode, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Gatilho "Editar" + diálogo. O formulário filho recebe `close` para se fechar
// quando salvar; fechar sem salvar descarta o que foi digitado (o conteúdo
// desmonta e volta ao valor salvo na próxima abertura).
export function EditDialog({
  title,
  name,
  children,
}: {
  title: string;
  name: string;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Editar ${name}`}
          />
        }
      >
        Editar
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{name}</DialogDescription>
        </DialogHeader>
        {children(() => setOpen(false))}
      </DialogContent>
    </Dialog>
  );
}
```

Crie `src/components/admin/ConfirmDialog.tsx`:

```tsx
"use client";

import { type ReactElement, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import {
  type AdminResult,
  fail,
  INTERNAL_ERROR_MESSAGE,
} from "@/features/admin/result";

// Confirmação de ação sem volta fácil. Só fecha no sucesso: se o servidor
// recusar, a mensagem aparece aqui dentro e a pessoa decide o que fazer.
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel = "Voltar",
  destructive = false,
  onConfirm,
}: {
  trigger: ReactElement;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<AdminResult>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    if (pending) return;
    if (next) setError(null);
    setOpen(next);
  }

  async function handleConfirm() {
    if (pending) return;
    setPending(true);
    setError(null);
    let result: AdminResult;
    try {
      result = await onConfirm();
    } catch {
      result = fail("INTERNAL", INTERNAL_ERROR_MESSAGE);
    }
    setPending(false);
    if (result.ok) {
      setOpen(false);
    } else {
      setError(result.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <FieldError>{error}</FieldError>
        <DialogFooter>
          <DialogClose
            disabled={pending}
            render={<Button type="button" variant="outline" />}
          >
            {cancelLabel}
          </DialogClose>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

Crie `src/components/admin/NameForm.tsx`:

```tsx
"use client";

import { type FormEvent, useId, useState } from "react";

import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { validateName } from "@/features/admin/names";
import type { AdminResult } from "@/features/admin/result";

const LABELS = {
  setor: "Nome do setor",
  destino: "Nome do destino",
} as const;

// Formulário controlado de um único nome (criar ou renomear setor/destino).
// O texto só é limpo no sucesso: se o servidor recusar, a pessoa não perde o
// que digitou (ui-rules §3).
export function NameForm({
  entity,
  initialName,
  submitLabel,
  onSubmit,
  successMessage,
  onDone,
}: {
  entity: "setor" | "destino";
  initialName: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<AdminResult<object>>;
  successMessage?: string;
  onDone?: () => void;
}) {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const { pending, run } = useAdminAction();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const checked = validateName(name);
    if (!checked.ok) {
      setError(checked.message);
      return;
    }

    const result = await run(() => onSubmit(checked.name), {
      success: successMessage,
      showError: false,
    });
    if (result.ok) {
      setError(null);
      setName(initialName === "" ? "" : checked.name);
      onDone?.();
    } else {
      setError(result.fieldErrors?.name ?? result.message);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col items-start gap-3"
    >
      <Field data-invalid={error ? "true" : undefined} className="max-w-md">
        <FieldLabel htmlFor={fieldId}>{LABELS[entity]}</FieldLabel>
        <Input
          id={fieldId}
          name="name"
          value={name}
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setName(event.target.value);
            setError(null);
          }}
        />
        {error && <FieldError id={errorId}>{error}</FieldError>}
      </Field>
      <Button type="submit" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
```

Crie `src/components/admin/ActiveToggleButton.tsx`:

```tsx
"use client";

import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import type { AdminResult } from "@/features/admin/result";

// "Desativar" / "Reativar" de uma linha de cadastro. Nada se apaga (F2-2).
export function ActiveToggleButton({
  entity,
  name,
  active,
  onToggle,
}: {
  entity: "Setor" | "Turno" | "Item" | "Destino";
  name: string;
  active: boolean;
  onToggle: (nextActive: boolean) => Promise<AdminResult<object>>;
}) {
  const { pending, run } = useAdminAction();
  const label = active ? "Desativar" : "Reativar";

  return (
    <Button
      type="button"
      size="sm"
      variant={active ? "outline" : "default"}
      aria-label={`${label} ${name}`}
      disabled={pending}
      onClick={() => {
        void run(() => onToggle(!active), {
          success: `${entity} ${active ? "desativado" : "reativado"}.`,
        });
      }}
    >
      {label}
    </Button>
  );
}
```

- [ ] **Step 13: Run test to verify it passes**

Run: `bun run test -- --project dom src/components/admin`
Expected: PASS (15 arquivos, 85 testes: 22 da Parte A + 20 da Parte B + 43 da Parte C = 6 + 7 + 10 + 12 + 8 em `useAdminAction`/`EditDialog`/`ConfirmDialog`/`NameForm`/`ActiveToggleButton`). Se vier `Timeout waiting for worker to respond`, repita com `--maxWorkers=2`.

- [ ] **Step 14: Registrar os componentes no `ui-registry.md`**

Em `.context/ui-registry.md`, com a ferramenta Edit, substitua a linha `## 3. Componentes de domínio — \`src/features/<domínio>/components\`` por todo o bloco abaixo (a linha da seção 3 continua no fim, e o `*(nenhum ainda)*` dela fica como está):

```markdown
### Cadastros do admin — `src/components/admin/*` (Fase 2)

Os 15 abaixo são a base das telas `/admin/setores`, `/turnos`, `/itens`, `/destinos` e `/equipe`. "Server-safe" = sem `"use client"`. Antes de criar outro componente de lista ou formulário de cadastro, estenda estes.

### AdminPageHeader
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/AdminPageHeader.tsx` (server-safe)
- **Propósito:** cabeçalho de toda página de `/admin/**`: título, descrição e, nas subpáginas, o caminho de volta.
- **Como funciona:** `<h1>` + texto; com `backHref="/admin"` mostra o link "Voltar para Administração" (`buttonVariants` ghost, ícone `ChevronLeft` `aria-hidden`). O `<h1>` fica dentro do `<Suspense>` da página (o operador não pode ver o título antes do `notFound()`).
- **Usa:** `buttonVariants`, `next/link`.
- **Histórico:** 2026-11-21 — criado na Fase 2.

### AdminListRow
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/AdminListRow.tsx` (server-safe)
- **Propósito:** linha de lista de cadastro (no lugar de tabela: funciona no celular).
- **Como funciona:** `<li>` card com título, selos (`badges`), subtítulo, avisos (`notes`) e ações à direita (embaixo no celular). `inactive` esmaece o título (`text-muted-foreground`) e mostra o `InactiveBadge`.
- **Usa:** `InactiveBadge`; tokens `card`, `border`, `muted-foreground`.
- **Histórico:** 2026-11-21 — criado na Fase 2.

### AdminListSkeleton
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/AdminListSkeleton.tsx` (server-safe)
- **Propósito:** fallback de `<Suspense>` das listas do admin.
- **Como funciona:** `<ul aria-busy="true" aria-label="Carregando">` com `rows` (padrão 4) `Skeleton h-16`.
- **Usa:** `Skeleton`.
- **Histórico:** 2026-11-21 — criado na Fase 2.

### EmptyState
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/EmptyState.tsx` (server-safe)
- **Propósito:** lista vazia que explica o que é e oferece o próximo passo (ui-rules §3).
- **Como funciona:** caixa tracejada com `<h2>`, descrição e, opcional, `action` como `<Link className={buttonVariants({ variant: "outline" })}>` (role link).
- **Usa:** `buttonVariants`, `next/link`.
- **Histórico:** 2026-11-21 — criado na Fase 2.

### InactiveBadge
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/InactiveBadge.tsx` (server-safe)
- **Propósito:** selo "Inativo" (nada se apaga; só desativa).
- **Como funciona:** `<Badge variant="secondary">Inativo</Badge>`; sempre texto, nunca só cor.
- **Usa:** `Badge`.
- **Histórico:** 2026-11-21 — criado na Fase 2.

### Pagination
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/Pagination.tsx` (server-safe)
- **Propósito:** paginação das listas (toda lista é paginada).
- **Como funciona:** `<nav aria-label="Paginação">` com "Anterior", "Página {n} de {m}" (`tabular-nums`) e "Próxima"; `param` (padrão `pagina`; `convites` na Equipe) e `params` preservam os demais parâmetros da URL via `buildPageHref`; página 1 remove o parâmetro. Na borda o botão é um `<span aria-disabled="true">` (não é link). Com `pageCount <= 1` renderiza `null`.
- **Usa:** `buttonVariants`, `buildPageHref`, `next/link`.
- **Histórico:** 2026-11-21 — criado na Fase 2.

### SectorSwitcher
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/SectorSwitcher.tsx` (server-safe)
- **Propósito:** escolher o setor das telas por setor (Turnos e Itens) pela URL (`?setor=<id>`).
- **Como funciona:** `<nav aria-label="Setor">` com um link por setor ativo; o escolhido é `default` com `aria-current="page"`, os demais `outline`. Navegação real (link), então funciona sem JS e preserva o histórico.
- **Usa:** `buttonVariants`, `next/link`, tipo `SectorChoice`.
- **Histórico:** 2026-11-21 — criado na Fase 2.

### MoveButtons
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/MoveButtons.tsx` (client)
- **Propósito:** ordem de turnos e itens por botões ↑ ↓ (D-F2-3), sem arrastar.
- **Como funciona:** dois botões `icon` (`ChevronUp`/`ChevronDown`) com `aria-label` "Subir {nome}"/"Descer {nome}" e tooltip "Subir"/"Descer"; desabilitados na borda (`canMoveUp`/`canMoveDown`) e enquanto `pending`.
- **Usa:** `Button`, `Tooltip*`, `SortDirection`.
- **Histórico:** 2026-11-21 — criado na Fase 2.

### ChoiceGroup
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/ChoiceGroup.tsx` (client)
- **Propósito:** escolha entre poucas opções (Papel: Operador | Administrador; Tipo do item: Controle | Estoque).
- **Como funciona:** `<fieldset>` com `<legend>` + `ToggleGroup` único (`outline`, `lg`); **nunca fica sem seleção**: clicar no item escolhido é ignorado. Genérico no tipo do valor (sem `as`). `description` liga ao grupo por `aria-describedby`.
- **Usa:** `FieldSet`, `FieldLegend`, `FieldDescription`, `ToggleGroup`.
- **Histórico:** 2026-11-21 — criado na Fase 2.

### SelectField
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/SelectField.tsx` (client)
- **Propósito:** escolha de um conjunto maior (setor, unidade) com o seletor do aparelho.
- **Como funciona:** `Field` + `FieldLabel htmlFor` + `NativeSelect` + `FieldDescription` + `FieldError` (`role="alert"`); `aria-invalid` e `aria-describedby` ligados (descrição e erro). `id` opcional (senão `useId`).
- **Usa:** `Field*`, `NativeSelect`.
- **Histórico:** 2026-11-21 — criado na Fase 2.

### EditDialog
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/EditDialog.tsx` (client)
- **Propósito:** "Editar" de uma linha em diálogo.
- **Como funciona:** gatilho `<Button variant="outline" size="sm">Editar</Button>` com `aria-label` "Editar {nome}"; o diálogo tem título e o nome como descrição; `children(close)` recebe a função que fecha (o formulário a chama ao salvar). Fechar sem salvar descarta o digitado (o conteúdo desmonta). Foco entra no diálogo e volta ao gatilho; `Esc` fecha.
- **Usa:** `Dialog*`, `Button`.
- **Histórico:** 2026-11-21 — criado na Fase 2.

### ConfirmDialog
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/ConfirmDialog.tsx` (client)
- **Propósito:** confirmar ação sem volta fácil (desativar pessoa, cancelar convite).
- **Como funciona:** `trigger` é o elemento do gatilho (via `render`); botões `confirmLabel` (`destructive` opcional) e `cancelLabel` (padrão "Voltar"). Só fecha no **sucesso**: se `onConfirm` devolver falha ou lançar, mostra a mensagem (`FieldError`) dentro do diálogo e continua aberto; trava os botões e o `Esc` enquanto roda; reabrir limpa o erro. Sem botão X (os dois botões bastam).
- **Usa:** `Dialog*`, `Button`, `FieldError`, `AdminResult`.
- **Histórico:** 2026-11-21 — criado na Fase 2.

### NameForm
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/NameForm.tsx` (client)
- **Propósito:** criar ou renomear setor e destino (um único campo de nome).
- **Como funciona:** controlado; rótulo "Nome do setor"/"Nome do destino"; valida no cliente com `validateName` (as mesmas mensagens do servidor); `onSubmit(nomeNormalizado)`. **Limpa só no sucesso** (criar: volta a vazio; editar: mantém o nome salvo) e chama `onDone`. Se o servidor recusar mostra `fieldErrors.name` (ou a mensagem geral) em `FieldError` ligado ao campo e **preserva o que foi digitado**; o erro some ao digitar; botão travado enquanto envia.
- **Usa:** `Field*`, `Input`, `Button`, `useAdminAction`, `validateName`.
- **Histórico:** 2026-11-21 — criado na Fase 2. Exceção documentada a "nunca em branco" (F2-9): o nome é a identidade do registro.

### ActiveToggleButton
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/ActiveToggleButton.tsx` (client)
- **Propósito:** "Desativar"/"Reativar" de uma linha de cadastro.
- **Como funciona:** ativo = botão `outline` "Desativar"; inativo = `default` "Reativar"; `aria-label` "{ação} {nome}"; chama `onToggle(!active)`; toast `{Setor|Turno|Item|Destino} desativado.`/`reativado.` no sucesso, toast de erro com a mensagem do servidor na falha; travado enquanto roda.
- **Usa:** `Button`, `useAdminAction`.
- **Histórico:** 2026-11-21 — criado na Fase 2.

### useAdminAction
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/useAdminAction.ts` (client)
- **Propósito:** chamar uma Server Action de cadastro com `pending`, toasts e erro tratado.
- **Como funciona:** `run(action, { success?, showError? })` devolve sempre um `AdminResult` (nunca lança): exceção vira `fail("INTERNAL", INTERNAL_ERROR_MESSAGE)`. `success` dispara `toast.success`; erro vira `toast.error(message)` a menos que `showError: false` (formulários mostram o erro inline).
- **Usa:** `sonner`, `AdminResult`.
- **Histórico:** 2026-11-21 — criado na Fase 2.

## 3. Componentes de domínio — `src/features/<domínio>/components`
```

- [ ] **Step 15: Verificação completa**

Run: `bun run check-types && bun run lint && bun run test`
Expected: tipos e Biome sem erro; Vitest todo verde. Se alguns arquivos falharem só com `Timeout waiting for worker to respond` (sintoma de máquina Windows lenta, não de código), repita com `bun run test -- --maxWorkers=3`.

- [ ] **Step 16: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-5.txt` (texto exato abaixo) e rode:

```bash
git add src/components/admin src/features/admin/sectors.ts test/setup-dom.ts vitest.config.ts .context/ui-registry.md
git commit -F .git/sdd/msg-task-5.txt
```

Mensagem:

```text
feat(admin): componentes compartilhados das telas de cadastro

Cabeçalho, linha, esqueleto, vazio, selo Inativo, paginação, seletor de
setor, botões subir/descer, escolha segmentada, select, diálogos de
edição e confirmação, formulário de nome, ativar/desativar e o hook
useAdminAction. Diálogo não fecha em erro; formulário preserva o digitado.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 6: Setores e Destinos

**Files:**
- Modify: `src/features/admin/sectors.ts` (criado na Tarefa 5 só com o tipo `SectorChoice`; leia-o e substitua o conteúdo inteiro, mantendo `export type SectorChoice` idêntico)
- Create: `src/features/admin/destinations.ts`
- Create: `src/app/(app)/admin/setores/actions.ts`
- Create: `src/app/(app)/admin/setores/page.tsx`
- Create: `src/app/(app)/admin/destinos/actions.ts`
- Create: `src/app/(app)/admin/destinos/page.tsx`
- Create: `src/components/admin/sectors/SectorsAdmin.tsx`
- Create: `src/components/admin/sectors/SectorCreateForm.tsx`
- Create: `src/components/admin/sectors/SectorRowActions.tsx`
- Create: `src/components/admin/destinations/DestinationsAdmin.tsx`
- Create: `src/components/admin/destinations/DestinationCreateForm.tsx`
- Create: `src/components/admin/destinations/DestinationRowActions.tsx`
- Modify: `.context/ui-registry.md` (6 entradas novas, inseridas logo antes da linha `## 3. Componentes de domínio — ...`)
- Test: `src/features/admin/sectors.test.ts`
- Test: `src/features/admin/destinations.test.ts`
- Test: `src/app/(app)/admin/setores/actions.test.ts`
- Test: `src/app/(app)/admin/setores/page.test.tsx`
- Test: `src/app/(app)/admin/destinos/actions.test.ts`
- Test: `src/app/(app)/admin/destinos/page.test.tsx`
- Test: `src/components/admin/sectors/SectorsAdmin.test.tsx`
- Test: `src/components/admin/sectors/SectorCreateForm.test.tsx`
- Test: `src/components/admin/sectors/SectorRowActions.test.tsx`
- Test: `src/components/admin/destinations/DestinationsAdmin.test.tsx`
- Test: `src/components/admin/destinations/DestinationCreateForm.test.tsx`
- Test: `src/components/admin/destinations/DestinationRowActions.test.tsx`

**Interfaces:**
- Consumes (Tarefas 1–5, exatamente como no contrato):
  - Schema/fixtures (T1): `sector` (`@/db/schema/sectors`, índice `sector_name_lower_uq`), `destination` (`@/db/schema/catalog`), `TABLES` com `destination`; `insertSector(db, name?, { active? })`, `insertDestination(db, { name?, active? })`, `insertUser`, `insertInvite` (`test/fixtures.ts`).
  - Lógica pura (T2): `validateName`, `nameTakenMessage`, `notFoundMessage`, `sectorBlockedMessage`, `PAGE_SIZE`, `CHOICE_LIST_LIMIT`, `Page<T>`, `parsePage`, `resolvePage`, `buildPageHref`, `pluralize`.
  - Contrato das actions (T3): `AdminResult`, `ok`, `fail`, `isUniqueViolation`, `createSectorSchema`, `renameSectorSchema`, `createDestinationSchema`, `renameDestinationSchema`, `setActiveSchema`, `runAdminAction`, `authzOf` (`test/authz.ts`).
  - Primitivos e UI compartilhada (T4–T5): `Dialog*`, `Card*`, `Skeleton`; `AdminPageHeader`, `AdminListRow`, `AdminListSkeleton`, `EmptyState`, `Pagination`, `EditDialog`, `NameForm`, `ActiveToggleButton`, `useAdminAction`.
- Produces (usadas pelas Tarefas 7–11):
  - `listActiveSectors(db: Db): Promise<SectorChoice[]>` e `resolveSectorFilter(sectors: readonly SectorChoice[], raw: string | string[] | undefined): SectorChoice | null` (Tarefas 7 e 8: seletor de setor de Turnos e Itens)
  - `listSectors(db: Db, input: { page: number }, now: Date): Promise<Page<SectorRow>>`
  - `createSector(db, { name })`, `renameSector(db, { id, name })`, `setSectorActive(db, { id, active }, now)` — erro `SECTOR_IN_USE` com as 3 variantes de mensagem
  - `listDestinations`, `createDestination`, `renameDestination`, `setDestinationActive` (assinaturas do contrato)
  - Tipos `SectorRow`, `SectorChoice`, `DestinationRow`
  - Server Actions `createSectorAction`, `renameSectorAction`, `setSectorActiveAction`, `createDestinationAction`, `renameDestinationAction`, `setDestinationActiveAction`, todas `(input: unknown) => Promise<AdminResult<...>>`, com `requireAdmin()` na primeira linha
  - Páginas `/admin/setores` e `/admin/destinos`

Notas de implementação (valem para as Tarefas 7–10 também):
- As contagens de pessoas e convites são **subconsultas correlacionadas no SQL**, escritas com `"sector"."id"` por extenso. O Drizzle tira o prefixo da tabela das colunas num `SELECT` de uma tabela só; um `${sector.id}` dentro do `sql` viraria `"id"` e, na subconsulta, apontaria para `"user"."id"` (contagem errada, sem erro). O teste "conta pessoas ativas e convites pendentes de cada setor" prova que cada setor recebe a própria contagem.
- `setSectorActive` roda numa transação: `SELECT … FOR UPDATE` do setor, contagem e `UPDATE`. Estar já no estado pedido é sucesso (F2-13). Reativar nunca consulta as contagens. As funções que checam "setor ativo" antes de gravar (`createShift`, `createItem`, `updatePerson`, `setPersonActive`, `createTeamInvite`; Tarefas 7–10) leem o setor com `.for("share")` na mesma transação da escrita, para serializar com este `FOR UPDATE` (F2-23).
- Convite pendente = `used_at IS NULL AND cancelled_at IS NULL AND expires_at > now` (convite que expira exatamente em `now` não conta). `now` entra como `now.toISOString()::timestamptz`.
- Mensagem de erro de nome aparece junto do campo (`fieldErrors.name`); `SECTOR_IN_USE` aparece em toast (`ActiveToggleButton` mostra o erro em toast).
- Os testes de componente rodam no projeto `dom` e **mockam** as Server Actions (`vi.mock("@/app/(app)/admin/setores/actions", …)`) e o `sonner`; o domínio e as actions rodam no projeto `node` contra PGlite.

- [ ] **Step 1: Write the failing test (domínio de setores)**

Crie `src/features/admin/sectors.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { sector } from "@/db/schema/sectors";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertInvite, insertSector, insertUser } from "../../../test/fixtures";
import { PAGE_SIZE } from "./pagination";
import {
  createSector,
  listActiveSectors,
  listSectors,
  renameSector,
  resolveSectorFilter,
  setSectorActive,
} from "./sectors";

const NOW = new Date("2026-11-21T12:00:00.000Z");
const DAY = 86_400_000;
const MISSING_ID = "00000000-0000-4000-8000-000000000000";

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

async function readSector(id: string) {
  const [row] = await db.select().from(sector).where(eq(sector.id, id));
  if (!row) throw new Error("setor não encontrado");
  return row;
}

describe("createSector", () => {
  it("cria o setor ativo e devolve o id", async () => {
    const result = await createSector(db, { name: "Almoxarifado" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const row = await readSector(result.id);
    expect(row).toMatchObject({ name: "Almoxarifado", active: true });
  });

  it("normaliza o nome antes de gravar", async () => {
    const result = await createSector(db, { name: "  Carga   Aérea  " });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((await readSector(result.id)).name).toBe("Carga Aérea");
  });

  it("recusa nome vazio ou só com espaços, com o erro no campo name", async () => {
    for (const name of ["", "   "]) {
      expect(await createSector(db, { name })).toEqual({
        ok: false,
        code: "INVALID_INPUT",
        message: "Informe o nome.",
        fieldErrors: { name: "Informe o nome." },
      });
    }
    expect(await db.select().from(sector)).toEqual([]);
  });

  it("aceita 60 caracteres e recusa 61", async () => {
    expect((await createSector(db, { name: "a".repeat(60) })).ok).toBe(true);

    const tooLong = await createSector(db, { name: "b".repeat(61) });
    expect(tooLong).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "O nome pode ter no máximo 60 caracteres.",
    });
  });

  it("recusa nome repetido sem diferença de caixa", async () => {
    await createSector(db, { name: "ULD" });

    expect(await createSector(db, { name: "uld" })).toEqual({
      ok: false,
      code: "NAME_TAKEN",
      message: "Já existe um setor com este nome.",
      fieldErrors: { name: "Já existe um setor com este nome." },
    });
  });

  it("recusa nome repetido com acento em caixa diferente", async () => {
    await createSector(db, { name: "Água" });

    const result = await createSector(db, { name: "ÁGUA" });

    expect(result).toMatchObject({ ok: false, code: "NAME_TAKEN" });
  });

  it("avisa que o setor de mesmo nome está inativo", async () => {
    await insertSector(db, "Antigo", { active: false });

    const result = await createSector(db, { name: "antigo" });

    expect(result).toMatchObject({
      ok: false,
      code: "NAME_TAKEN",
      message:
        "Já existe um setor com este nome. Ele está inativo: reative-o na lista.",
    });
  });
});

describe("renameSector", () => {
  it("renomeia e normaliza", async () => {
    const created = await insertSector(db, "Velho");

    const result = await renameSector(db, {
      id: created.id,
      name: "  Novo   nome ",
    });

    expect(result).toEqual({ ok: true });
    expect((await readSector(created.id)).name).toBe("Novo nome");
  });

  it("deixa trocar só a caixa do próprio nome", async () => {
    const created = await insertSector(db, "uld");

    expect(await renameSector(db, { id: created.id, name: "ULD" })).toEqual({
      ok: true,
    });
    expect((await readSector(created.id)).name).toBe("ULD");
  });

  it("recusa o nome de outro setor", async () => {
    await insertSector(db, "ULD");
    const other = await insertSector(db, "Pátio");

    const result = await renameSector(db, { id: other.id, name: "uld" });

    expect(result).toMatchObject({ ok: false, code: "NAME_TAKEN" });
    expect((await readSector(other.id)).name).toBe("Pátio");
  });

  it("recusa nome vazio sem tocar no registro", async () => {
    const created = await insertSector(db, "Pátio");

    const result = await renameSector(db, { id: created.id, name: " " });

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Informe o nome.",
    });
    expect((await readSector(created.id)).name).toBe("Pátio");
  });

  it("id inexistente é NOT_FOUND", async () => {
    expect(await renameSector(db, { id: MISSING_ID, name: "X" })).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Setor não encontrado. Atualize a página.",
    });
  });
});

describe("setSectorActive", () => {
  it("desativa um setor sem pessoas nem convites", async () => {
    const created = await insertSector(db, "Vazio");

    expect(
      await setSectorActive(db, { id: created.id, active: false }, NOW),
    ).toEqual({ ok: true });
    expect((await readSector(created.id)).active).toBe(false);
  });

  it("bloqueia com pessoas ativas e convites pendentes e mostra as contagens", async () => {
    const busy = await insertSector(db, "Ocupado");
    for (let index = 0; index < 3; index++) {
      await insertUser(db, { role: "operator", sectorId: busy.id });
    }
    await insertInvite(db, { role: "operator", sectorId: busy.id, now: NOW });

    const result = await setSectorActive(
      db,
      { id: busy.id, active: false },
      NOW,
    );

    expect(result).toEqual({
      ok: false,
      code: "SECTOR_IN_USE",
      message:
        "Este setor tem 3 pessoas ativas e 1 convite pendente. Mova, desative ou cancele antes.",
    });
    expect((await readSector(busy.id)).active).toBe(true);
  });

  it("bloqueia só por pessoa ativa (singular)", async () => {
    const busy = await insertSector(db, "Ocupado");
    await insertUser(db, { role: "operator", sectorId: busy.id });

    const result = await setSectorActive(
      db,
      { id: busy.id, active: false },
      NOW,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "SECTOR_IN_USE",
      message: "Este setor tem 1 pessoa ativa. Mova ou desative antes.",
    });
  });

  it("bloqueia só por convites pendentes (plural)", async () => {
    const busy = await insertSector(db, "Ocupado");
    await insertInvite(db, { role: "operator", sectorId: busy.id, now: NOW });
    await insertInvite(db, { role: "operator", sectorId: busy.id, now: NOW });

    const result = await setSectorActive(
      db,
      { id: busy.id, active: false },
      NOW,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "SECTOR_IN_USE",
      message: "Este setor tem 2 convites pendentes. Cancele antes.",
    });
  });

  it("não bloqueia por pessoa desativada nem por convite expirado, usado ou cancelado", async () => {
    const calm = await insertSector(db, "Calmo");
    await insertUser(db, {
      role: "operator",
      sectorId: calm.id,
      deactivatedAt: new Date(NOW.getTime() - DAY),
    });
    const invites = { role: "operator", sectorId: calm.id, now: NOW } as const;
    await insertInvite(db, {
      ...invites,
      expiresAt: new Date(NOW.getTime() - 1),
    });
    await insertInvite(db, { ...invites, usedAt: NOW });
    await insertInvite(db, { ...invites, cancelledAt: NOW });

    expect(
      await setSectorActive(db, { id: calm.id, active: false }, NOW),
    ).toEqual({ ok: true });
    expect((await readSector(calm.id)).active).toBe(false);
  });

  it("convite que expira exatamente em `now` já não bloqueia", async () => {
    const edge = await insertSector(db, "Limite");
    await insertInvite(db, {
      role: "operator",
      sectorId: edge.id,
      now: NOW,
      expiresAt: NOW,
    });

    expect(
      await setSectorActive(db, { id: edge.id, active: false }, NOW),
    ).toEqual({ ok: true });
  });

  it("pessoa e convite de outro setor não bloqueiam este", async () => {
    const mine = await insertSector(db, "Meu");
    const other = await insertSector(db, "Outro");
    await insertUser(db, { role: "operator", sectorId: other.id });
    await insertInvite(db, { role: "operator", sectorId: other.id, now: NOW });

    expect(
      await setSectorActive(db, { id: mine.id, active: false }, NOW),
    ).toEqual({ ok: true });
  });

  it("reativar sempre passa", async () => {
    const off = await insertSector(db, "Desligado", { active: false });

    expect(
      await setSectorActive(db, { id: off.id, active: true }, NOW),
    ).toEqual({ ok: true });
    expect((await readSector(off.id)).active).toBe(true);
  });

  it("repetir o mesmo estado é sucesso sem mudança (idempotente)", async () => {
    const on = await insertSector(db, "Ligado");
    const off = await insertSector(db, "Desligado", { active: false });

    expect(await setSectorActive(db, { id: on.id, active: true }, NOW)).toEqual(
      { ok: true },
    );
    expect(
      await setSectorActive(db, { id: off.id, active: false }, NOW),
    ).toEqual({ ok: true });
  });

  it("id inexistente é NOT_FOUND", async () => {
    expect(
      await setSectorActive(db, { id: MISSING_ID, active: false }, NOW),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("listSectors", () => {
  it("lista vazia: nenhuma linha, uma página", async () => {
    expect(await listSectors(db, { page: 1 }, NOW)).toEqual({
      rows: [],
      total: 0,
      page: 1,
      pageCount: 1,
      pageSize: PAGE_SIZE,
    });
  });

  it("ordena ativos primeiro e depois por nome sem diferença de caixa", async () => {
    await insertSector(db, "bravo");
    await insertSector(db, "Alfa");
    await insertSector(db, "Zulu", { active: false });
    await insertSector(db, "Charlie");

    const page = await listSectors(db, { page: 1 }, NOW);

    expect(page.rows.map((row) => row.name)).toEqual([
      "Alfa",
      "bravo",
      "Charlie",
      "Zulu",
    ]);
    expect(page.rows.map((row) => row.active)).toEqual([
      true,
      true,
      true,
      false,
    ]);
  });

  it("conta pessoas ativas e convites pendentes de cada setor, só os válidos", async () => {
    const alfa = await insertSector(db, "Alfa");
    const bravo = await insertSector(db, "Bravo");
    await insertUser(db, { role: "operator", sectorId: alfa.id });
    await insertUser(db, { role: "operator", sectorId: alfa.id });
    await insertUser(db, {
      role: "operator",
      sectorId: alfa.id,
      deactivatedAt: NOW,
    });
    await insertUser(db, { role: "admin", sectorId: null });
    await insertInvite(db, { role: "operator", sectorId: alfa.id, now: NOW });
    await insertInvite(db, {
      role: "operator",
      sectorId: alfa.id,
      now: NOW,
      expiresAt: new Date(NOW.getTime() - 1),
    });
    await insertInvite(db, {
      role: "operator",
      sectorId: bravo.id,
      now: NOW,
      cancelledAt: NOW,
    });
    await insertInvite(db, { role: "admin", sectorId: null, now: NOW });

    const page = await listSectors(db, { page: 1 }, NOW);

    expect(page.rows).toEqual([
      {
        id: alfa.id,
        name: "Alfa",
        active: true,
        activePeople: 2,
        pendingInvites: 1,
      },
      {
        id: bravo.id,
        name: "Bravo",
        active: true,
        activePeople: 0,
        pendingInvites: 0,
      },
    ]);
  });

  it("pagina de 50 em 50 e prende a página pedida no intervalo", async () => {
    for (let index = 0; index < PAGE_SIZE + 1; index++) {
      await insertSector(db, `Setor ${String(index).padStart(3, "0")}`);
    }

    const first = await listSectors(db, { page: 1 }, NOW);
    expect(first).toMatchObject({ total: 51, page: 1, pageCount: 2 });
    expect(first.rows).toHaveLength(PAGE_SIZE);

    const second = await listSectors(db, { page: 2 }, NOW);
    expect(second.rows.map((row) => row.name)).toEqual(["Setor 050"]);

    const beyond = await listSectors(db, { page: 99 }, NOW);
    expect(beyond).toMatchObject({ page: 2, pageCount: 2 });
    expect(beyond.rows).toHaveLength(1);
  });
});

describe("listActiveSectors", () => {
  it("devolve só os ativos, por nome sem diferença de caixa", async () => {
    await insertSector(db, "bravo");
    await insertSector(db, "Alfa");
    await insertSector(db, "Inativo", { active: false });

    expect((await listActiveSectors(db)).map((choice) => choice.name)).toEqual([
      "Alfa",
      "bravo",
    ]);
  });

  it("devolve só id e name", async () => {
    const created = await insertSector(db, "Alfa");

    expect(await listActiveSectors(db)).toEqual([
      { id: created.id, name: "Alfa" },
    ]);
  });

  it("sem setores devolve lista vazia", async () => {
    expect(await listActiveSectors(db)).toEqual([]);
  });
});

describe("resolveSectorFilter", () => {
  const alfa = { id: "a", name: "Alfa" };
  const bravo = { id: "b", name: "Bravo" };

  it("usa o id da URL quando ele está na lista", () => {
    expect(resolveSectorFilter([alfa, bravo], "b")).toBe(bravo);
  });

  it("cai no primeiro setor sem parâmetro, com id desconhecido ou inativo", () => {
    expect(resolveSectorFilter([alfa, bravo], undefined)).toBe(alfa);
    expect(resolveSectorFilter([alfa, bravo], "x")).toBe(alfa);
    expect(resolveSectorFilter([alfa, bravo], "")).toBe(alfa);
  });

  it("usa o primeiro valor quando o parâmetro se repete", () => {
    expect(resolveSectorFilter([alfa, bravo], ["b", "a"])).toBe(bravo);
    expect(resolveSectorFilter([alfa, bravo], [])).toBe(alfa);
  });

  it("sem setores devolve null", () => {
    expect(resolveSectorFilter([], "a")).toBeNull();
    expect(resolveSectorFilter([], undefined)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/features/admin/sectors.test.ts`
Expected: FAIL nos 33 testes com `TypeError: … is not a function` (`createSector`, `listSectors`, `renameSector`, `setSectorActive`, `listActiveSectors`, `resolveSectorFilter`): o arquivo existe desde a Tarefa 5, só com `SectorChoice`.

- [ ] **Step 3: Write minimal implementation**

Leia `src/features/admin/sectors.ts` (a Tarefa 5 o criou só com o tipo) e substitua todo o conteúdo por:

```ts
import "server-only";

import { asc, count, desc, eq, sql } from "drizzle-orm";

import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import { isUniqueViolation } from "./dbErrors";
import {
  nameTakenMessage,
  notFoundMessage,
  sectorBlockedMessage,
} from "./messages";
import { validateName } from "./names";
import {
  CHOICE_LIST_LIMIT,
  PAGE_SIZE,
  type Page,
  resolvePage,
} from "./pagination";
import { type AdminResult, fail, ok } from "./result";

export type SectorRow = {
  id: string;
  name: string;
  active: boolean;
  activePeople: number;
  pendingInvites: number;
};

export type SectorChoice = { id: string; name: string };

// Subconsultas correlacionadas escritas com a tabela "sector" por extenso: o
// Drizzle tira o prefixo das colunas num SELECT de uma tabela só, e um "id"
// sem prefixo dentro da subconsulta apontaria para "user".
function activePeopleSql() {
  return sql<number>`(
    select count(*)::int from "user" u
    where u.sector_id = "sector"."id" and u.deactivated_at is null
  )`;
}

function pendingInvitesSql(now: Date) {
  return sql<number>`(
    select count(*)::int from "invite" i
    where i.sector_id = "sector"."id"
      and i.used_at is null
      and i.cancelled_at is null
      and i.expires_at > ${now.toISOString()}::timestamptz
  )`;
}

export async function listSectors(
  db: Db,
  input: { page: number },
  now: Date,
): Promise<Page<SectorRow>> {
  const [totals] = await db.select({ total: count() }).from(sector);
  const total = totals?.total ?? 0;
  const { page, pageCount, offset } = resolvePage(total, input.page);

  const rows = await db
    .select({
      id: sector.id,
      name: sector.name,
      active: sector.active,
      activePeople: activePeopleSql(),
      pendingInvites: pendingInvitesSql(now),
    })
    .from(sector)
    .orderBy(desc(sector.active), sql`lower(${sector.name})`, asc(sector.id))
    .limit(PAGE_SIZE)
    .offset(offset);

  return { rows, total, page, pageCount, pageSize: PAGE_SIZE };
}

export async function listActiveSectors(db: Db): Promise<SectorChoice[]> {
  return db
    .select({ id: sector.id, name: sector.name })
    .from(sector)
    .where(eq(sector.active, true))
    .orderBy(sql`lower(${sector.name})`, asc(sector.id))
    .limit(CHOICE_LIST_LIMIT);
}

// Setor do filtro `?setor=`: o da URL se estiver na lista (de ativos); senão o
// primeiro; sem setores, null.
export function resolveSectorFilter(
  sectors: readonly SectorChoice[],
  raw: string | string[] | undefined,
): SectorChoice | null {
  const wanted = Array.isArray(raw) ? raw[0] : raw;
  const found = wanted ? sectors.find((choice) => choice.id === wanted) : null;
  return found ?? sectors[0] ?? null;
}

async function nameTakenFailure(db: Db, name: string) {
  const [existing] = await db
    .select({ active: sector.active })
    .from(sector)
    .where(sql`lower(${sector.name}) = lower(${name})`)
    .limit(1);
  const message = nameTakenMessage("setor", existing?.active === false);
  return fail("NAME_TAKEN", message, { name: message });
}

export async function createSector(
  db: Db,
  input: { name: string },
): Promise<AdminResult<{ id: string }>> {
  const checked = validateName(input.name);
  if (!checked.ok) {
    return fail("INVALID_INPUT", checked.message, { name: checked.message });
  }
  try {
    const [created] = await db
      .insert(sector)
      .values({ name: checked.name })
      .returning({ id: sector.id });
    if (!created) throw new Error("setor não criado");
    return ok({ id: created.id });
  } catch (error) {
    if (isUniqueViolation(error)) return nameTakenFailure(db, checked.name);
    throw error;
  }
}

export async function renameSector(
  db: Db,
  input: { id: string; name: string },
): Promise<AdminResult> {
  const checked = validateName(input.name);
  if (!checked.ok) {
    return fail("INVALID_INPUT", checked.message, { name: checked.message });
  }
  try {
    const updated = await db
      .update(sector)
      .set({ name: checked.name })
      .where(eq(sector.id, input.id))
      .returning({ id: sector.id });
    if (updated.length === 0) {
      return fail("NOT_FOUND", notFoundMessage("setor"));
    }
    return ok();
  } catch (error) {
    if (isUniqueViolation(error)) return nameTakenFailure(db, checked.name);
    throw error;
  }
}

// Desativar com gente dentro é bloqueado (D-F2-2): operador ativo ou convite
// pendente ficaria num setor inativo. Reativar sempre passa. Contagem, trava da
// linha e UPDATE rodam na mesma transação.
export async function setSectorActive(
  db: Db,
  input: { id: string; active: boolean },
  now: Date,
): Promise<AdminResult> {
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ active: sector.active })
      .from(sector)
      .where(eq(sector.id, input.id))
      .for("update");
    if (!current) return fail("NOT_FOUND", notFoundMessage("setor"));
    if (current.active === input.active) return ok();

    if (!input.active) {
      const [counts] = await tx
        .select({
          people: activePeopleSql(),
          invites: pendingInvitesSql(now),
        })
        .from(sector)
        .where(eq(sector.id, input.id));
      const people = counts?.people ?? 0;
      const invites = counts?.invites ?? 0;
      if (people > 0 || invites > 0) {
        return fail("SECTOR_IN_USE", sectorBlockedMessage(people, invites));
      }
    }

    await tx
      .update(sector)
      .set({ active: input.active })
      .where(eq(sector.id, input.id));
    return ok();
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- src/features/admin/sectors.test.ts`
Expected: PASS (33 testes)

- [ ] **Step 5: Write the failing test (domínio de destinos)**

Crie `src/features/admin/destinations.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { destination } from "@/db/schema/catalog";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertDestination } from "../../../test/fixtures";
import {
  createDestination,
  listDestinations,
  renameDestination,
  setDestinationActive,
} from "./destinations";
import { PAGE_SIZE } from "./pagination";

const MISSING_ID = "00000000-0000-4000-8000-000000000000";

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

async function readDestination(id: string) {
  const [row] = await db
    .select()
    .from(destination)
    .where(eq(destination.id, id));
  if (!row) throw new Error("destino não encontrado");
  return row;
}

describe("createDestination", () => {
  it("cria o destino ativo e normaliza o nome", async () => {
    const result = await createDestination(db, {
      name: "  Almoxarifado   Central ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(await readDestination(result.id)).toMatchObject({
      name: "Almoxarifado Central",
      active: true,
    });
  });

  it("recusa nome vazio e nome com 61 caracteres; aceita 60", async () => {
    expect(await createDestination(db, { name: "  " })).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      message: "Informe o nome.",
      fieldErrors: { name: "Informe o nome." },
    });
    expect(await createDestination(db, { name: "x".repeat(61) })).toMatchObject(
      {
        ok: false,
        code: "INVALID_INPUT",
        message: "O nome pode ter no máximo 60 caracteres.",
      },
    );
    expect((await createDestination(db, { name: "x".repeat(60) })).ok).toBe(
      true,
    );
  });

  it("recusa nome repetido sem diferença de caixa", async () => {
    await createDestination(db, { name: "Almoxarifado" });

    expect(await createDestination(db, { name: "ALMOXARIFADO" })).toEqual({
      ok: false,
      code: "NAME_TAKEN",
      message: "Já existe um destino com este nome.",
      fieldErrors: { name: "Já existe um destino com este nome." },
    });
  });

  it("avisa que o destino de mesmo nome está inativo", async () => {
    await insertDestination(db, { name: "Antigo", active: false });

    expect(await createDestination(db, { name: "antigo" })).toMatchObject({
      ok: false,
      code: "NAME_TAKEN",
      message:
        "Já existe um destino com este nome. Ele está inativo: reative-o na lista.",
    });
  });
});

describe("renameDestination", () => {
  it("renomeia, inclusive só a caixa do próprio nome", async () => {
    const created = await insertDestination(db, { name: "almoxarifado" });

    expect(
      await renameDestination(db, { id: created.id, name: "Almoxarifado" }),
    ).toEqual({ ok: true });
    expect((await readDestination(created.id)).name).toBe("Almoxarifado");
  });

  it("recusa o nome de outro destino e nome vazio", async () => {
    await insertDestination(db, { name: "Almoxarifado" });
    const other = await insertDestination(db, { name: "Oficina" });

    expect(
      await renameDestination(db, { id: other.id, name: "almoxarifado" }),
    ).toMatchObject({ ok: false, code: "NAME_TAKEN" });
    expect(
      await renameDestination(db, { id: other.id, name: "" }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect((await readDestination(other.id)).name).toBe("Oficina");
  });

  it("id inexistente é NOT_FOUND", async () => {
    expect(await renameDestination(db, { id: MISSING_ID, name: "X" })).toEqual({
      ok: false,
      code: "NOT_FOUND",
      message: "Destino não encontrado. Atualize a página.",
    });
  });
});

describe("setDestinationActive", () => {
  it("desativa e reativa", async () => {
    const created = await insertDestination(db, { name: "Oficina" });

    expect(
      await setDestinationActive(db, { id: created.id, active: false }),
    ).toEqual({ ok: true });
    expect((await readDestination(created.id)).active).toBe(false);

    expect(
      await setDestinationActive(db, { id: created.id, active: true }),
    ).toEqual({ ok: true });
    expect((await readDestination(created.id)).active).toBe(true);
  });

  it("repetir o mesmo estado é sucesso sem mudança", async () => {
    const created = await insertDestination(db, { name: "Oficina" });

    expect(
      await setDestinationActive(db, { id: created.id, active: true }),
    ).toEqual({ ok: true });
  });

  it("id inexistente é NOT_FOUND", async () => {
    expect(
      await setDestinationActive(db, { id: MISSING_ID, active: false }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});

describe("listDestinations", () => {
  it("lista vazia: nenhuma linha, uma página", async () => {
    expect(await listDestinations(db, { page: 1 })).toEqual({
      rows: [],
      total: 0,
      page: 1,
      pageCount: 1,
      pageSize: PAGE_SIZE,
    });
  });

  it("ordena ativos primeiro e depois por nome sem diferença de caixa", async () => {
    await insertDestination(db, { name: "bravo" });
    await insertDestination(db, { name: "Alfa" });
    await insertDestination(db, { name: "Zulu", active: false });

    const page = await listDestinations(db, { page: 1 });

    expect(page.rows.map((row) => [row.name, row.active])).toEqual([
      ["Alfa", true],
      ["bravo", true],
      ["Zulu", false],
    ]);
  });

  it("pagina de 50 em 50 e prende a página pedida no intervalo", async () => {
    for (let index = 0; index < PAGE_SIZE + 1; index++) {
      await insertDestination(db, {
        name: `Destino ${String(index).padStart(3, "0")}`,
      });
    }

    const first = await listDestinations(db, { page: 1 });
    expect(first).toMatchObject({ total: 51, page: 1, pageCount: 2 });
    expect(first.rows).toHaveLength(PAGE_SIZE);

    const beyond = await listDestinations(db, { page: 99 });
    expect(beyond).toMatchObject({ page: 2, pageCount: 2 });
    expect(beyond.rows.map((row) => row.name)).toEqual(["Destino 050"]);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bun run test -- src/features/admin/destinations.test.ts`
Expected: FAIL com `Cannot find module './destinations' imported from …/src/features/admin/destinations.test.ts`.

- [ ] **Step 7: Write minimal implementation**

Crie `src/features/admin/destinations.ts`:

```ts
import "server-only";

import { asc, count, desc, eq, sql } from "drizzle-orm";

import { destination } from "@/db/schema/catalog";
import type { Db } from "@/db/types";
import { isUniqueViolation } from "./dbErrors";
import { nameTakenMessage, notFoundMessage } from "./messages";
import { validateName } from "./names";
import { PAGE_SIZE, type Page, resolvePage } from "./pagination";
import { type AdminResult, fail, ok } from "./result";

export type DestinationRow = { id: string; name: string; active: boolean };

export async function listDestinations(
  db: Db,
  input: { page: number },
): Promise<Page<DestinationRow>> {
  const [totals] = await db.select({ total: count() }).from(destination);
  const total = totals?.total ?? 0;
  const { page, pageCount, offset } = resolvePage(total, input.page);

  const rows = await db
    .select({
      id: destination.id,
      name: destination.name,
      active: destination.active,
    })
    .from(destination)
    .orderBy(
      desc(destination.active),
      sql`lower(${destination.name})`,
      asc(destination.id),
    )
    .limit(PAGE_SIZE)
    .offset(offset);

  return { rows, total, page, pageCount, pageSize: PAGE_SIZE };
}

async function nameTakenFailure(db: Db, name: string) {
  const [existing] = await db
    .select({ active: destination.active })
    .from(destination)
    .where(sql`lower(${destination.name}) = lower(${name})`)
    .limit(1);
  const message = nameTakenMessage("destino", existing?.active === false);
  return fail("NAME_TAKEN", message, { name: message });
}

export async function createDestination(
  db: Db,
  input: { name: string },
): Promise<AdminResult<{ id: string }>> {
  const checked = validateName(input.name);
  if (!checked.ok) {
    return fail("INVALID_INPUT", checked.message, { name: checked.message });
  }
  try {
    const [created] = await db
      .insert(destination)
      .values({ name: checked.name })
      .returning({ id: destination.id });
    if (!created) throw new Error("destino não criado");
    return ok({ id: created.id });
  } catch (error) {
    if (isUniqueViolation(error)) return nameTakenFailure(db, checked.name);
    throw error;
  }
}

export async function renameDestination(
  db: Db,
  input: { id: string; name: string },
): Promise<AdminResult> {
  const checked = validateName(input.name);
  if (!checked.ok) {
    return fail("INVALID_INPUT", checked.message, { name: checked.message });
  }
  try {
    const updated = await db
      .update(destination)
      .set({ name: checked.name })
      .where(eq(destination.id, input.id))
      .returning({ id: destination.id });
    if (updated.length === 0) {
      return fail("NOT_FOUND", notFoundMessage("destino"));
    }
    return ok();
  } catch (error) {
    if (isUniqueViolation(error)) return nameTakenFailure(db, checked.name);
    throw error;
  }
}

// Idempotente: já estar no estado pedido é sucesso (clique duplo, duas abas).
export async function setDestinationActive(
  db: Db,
  input: { id: string; active: boolean },
): Promise<AdminResult> {
  const updated = await db
    .update(destination)
    .set({ active: input.active })
    .where(eq(destination.id, input.id))
    .returning({ id: destination.id });
  if (updated.length === 0) {
    return fail("NOT_FOUND", notFoundMessage("destino"));
  }
  return ok();
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun run test -- src/features/admin/destinations.test.ts`
Expected: PASS (13 testes)

- [ ] **Step 9: Write the failing tests (Server Actions)**

Os testes trocam `@/db` pelo PGlite por um getter (`touched` prova que o banco não foi lido) e simulam o `requireAdmin` do operador com o mesmo erro do `notFound()`. Crie `src/app/(app)/admin/setores/actions.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { sector } from "@/db/schema/sectors";
import { authzOf } from "../../../../../test/authz";
import { createTestDb, resetDb, type TestDb } from "../../../../../test/db";
import {
  insertInvite,
  insertSector,
  insertUser,
} from "../../../../../test/fixtures";

// O banco de verdade (PGlite) entra no lugar de "@/db" por um getter; o
// guarda de acesso é simulado: operador recebe o mesmo 404 do requireAdmin.
const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  database: { current: undefined as unknown },
  touched: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", () => ({
  get db() {
    mocks.touched();
    return mocks.database.current;
  },
}));

import {
  createSectorAction,
  renameSectorAction,
  setSectorActiveAction,
} from "./actions";

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
  mocks.revalidatePath.mockReset();
  mocks.touched.mockReset();
  mocks.requireAdmin.mockResolvedValue(authzOf({ role: "admin" }));
});

describe("actions de setor: operador", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockRejectedValue(NOT_FOUND);
  });

  it("createSectorAction recebe notFound e não toca o banco", async () => {
    await expect(createSectorAction({ name: "Novo" })).rejects.toBe(NOT_FOUND);

    expect(mocks.touched).not.toHaveBeenCalled();
    expect(await db.select().from(sector)).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("renameSectorAction recebe notFound e não toca o banco", async () => {
    const created = await insertSector(db, "Original");

    await expect(
      renameSectorAction({ id: created.id, name: "Trocado" }),
    ).rejects.toBe(NOT_FOUND);

    expect(mocks.touched).not.toHaveBeenCalled();
    const [row] = await db
      .select()
      .from(sector)
      .where(eq(sector.id, created.id));
    expect(row?.name).toBe("Original");
  });

  it("setSectorActiveAction recebe notFound e não toca o banco", async () => {
    const created = await insertSector(db, "Ativo");

    await expect(
      setSectorActiveAction({ id: created.id, active: false }),
    ).rejects.toBe(NOT_FOUND);

    expect(mocks.touched).not.toHaveBeenCalled();
    const [row] = await db
      .select()
      .from(sector)
      .where(eq(sector.id, created.id));
    expect(row?.active).toBe(true);
  });
});

describe("createSectorAction", () => {
  it("cria o setor e revalida o /admin", async () => {
    const result = await createSectorAction({ name: "  Almoxarifado " });

    expect(result.ok).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
    const rows = await db.select().from(sector);
    expect(rows.map((row) => row.name)).toEqual(["Almoxarifado"]);
  });

  it("entrada inválida volta com a mensagem no campo e sem gravar", async () => {
    expect(await createSectorAction({ name: "   " })).toEqual({
      ok: false,
      code: "INVALID_INPUT",
      message: "Informe o nome.",
      fieldErrors: { name: "Informe o nome." },
    });
    expect(await createSectorAction({})).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
    });
    expect(await createSectorAction(null)).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
    });
    expect(await db.select().from(sector)).toEqual([]);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("nome repetido volta NAME_TAKEN e não revalida", async () => {
    await insertSector(db, "ULD");

    expect(await createSectorAction({ name: "uld" })).toMatchObject({
      ok: false,
      code: "NAME_TAKEN",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("renameSectorAction", () => {
  it("renomeia o setor", async () => {
    const created = await insertSector(db, "Velho");

    expect(await renameSectorAction({ id: created.id, name: "Novo" })).toEqual({
      ok: true,
    });
    const [row] = await db
      .select()
      .from(sector)
      .where(eq(sector.id, created.id));
    expect(row?.name).toBe("Novo");
  });

  it("id malformado é recusado antes do banco", async () => {
    expect(await renameSectorAction({ id: "abc", name: "Novo" })).toMatchObject(
      {
        ok: false,
        code: "INVALID_INPUT",
        message: "Registro inválido. Atualize a página.",
      },
    );
  });
});

describe("setSectorActiveAction", () => {
  it("desativa um setor vazio e reativa", async () => {
    const created = await insertSector(db, "Vazio");

    expect(
      await setSectorActiveAction({ id: created.id, active: false }),
    ).toEqual({ ok: true });
    expect(
      await setSectorActiveAction({ id: created.id, active: true }),
    ).toEqual({ ok: true });
  });

  it("setor com operador ativo e convite pendente devolve SECTOR_IN_USE", async () => {
    const busy = await insertSector(db, "Ocupado");
    await insertUser(db, { role: "operator", sectorId: busy.id });
    await insertInvite(db, { role: "operator", sectorId: busy.id });

    expect(await setSectorActiveAction({ id: busy.id, active: false })).toEqual(
      {
        ok: false,
        code: "SECTOR_IN_USE",
        message:
          "Este setor tem 1 pessoa ativa e 1 convite pendente. Mova, desative ou cancele antes.",
      },
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("active que não é booleano é recusado", async () => {
    const created = await insertSector(db, "Qualquer");

    expect(
      await setSectorActiveAction({ id: created.id, active: "false" }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });
});

describe("falha inesperada", () => {
  it("vira INTERNAL sem vazar o texto do erro", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.database.current = {
      transaction: () => {
        throw new Error("senha do banco: segredo");
      },
    };
    try {
      const created = await insertSector(db, "Qualquer");
      const result = await setSectorActiveAction({
        id: created.id,
        active: false,
      });

      expect(result).toEqual({
        ok: false,
        code: "INTERNAL",
        message: "Não foi possível concluir. Tente de novo.",
      });
    } finally {
      mocks.database.current = db;
      vi.restoreAllMocks();
    }
  });
});
```

Crie `src/app/(app)/admin/destinos/actions.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { destination } from "@/db/schema/catalog";
import { authzOf } from "../../../../../test/authz";
import { createTestDb, resetDb, type TestDb } from "../../../../../test/db";
import { insertDestination } from "../../../../../test/fixtures";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  database: { current: undefined as unknown },
  touched: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", () => ({
  get db() {
    mocks.touched();
    return mocks.database.current;
  },
}));

import {
  createDestinationAction,
  renameDestinationAction,
  setDestinationActiveAction,
} from "./actions";

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
  mocks.revalidatePath.mockReset();
  mocks.touched.mockReset();
  mocks.requireAdmin.mockResolvedValue(authzOf({ role: "admin" }));
});

describe("actions de destino: operador", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockRejectedValue(NOT_FOUND);
  });

  it("nenhuma action toca o banco quando o guarda recusa", async () => {
    const created = await insertDestination(db, { name: "Oficina" });

    await expect(createDestinationAction({ name: "Novo" })).rejects.toBe(
      NOT_FOUND,
    );
    await expect(
      renameDestinationAction({ id: created.id, name: "Trocado" }),
    ).rejects.toBe(NOT_FOUND);
    await expect(
      setDestinationActiveAction({ id: created.id, active: false }),
    ).rejects.toBe(NOT_FOUND);

    expect(mocks.touched).not.toHaveBeenCalled();
    const rows = await db.select().from(destination);
    expect(rows).toMatchObject([{ name: "Oficina", active: true }]);
  });
});

describe("createDestinationAction", () => {
  it("cria o destino e revalida o /admin", async () => {
    const result = await createDestinationAction({ name: " Almoxarifado " });

    expect(result.ok).toBe(true);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
    const rows = await db.select().from(destination);
    expect(rows.map((row) => row.name)).toEqual(["Almoxarifado"]);
  });

  it("entrada inválida e nome repetido não gravam nem revalidam", async () => {
    await insertDestination(db, { name: "Oficina" });

    expect(await createDestinationAction({ name: "" })).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Informe o nome.",
    });
    expect(await createDestinationAction({ name: "OFICINA" })).toMatchObject({
      ok: false,
      code: "NAME_TAKEN",
    });
    expect(await db.select().from(destination)).toHaveLength(1);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("renameDestinationAction e setDestinationActiveAction", () => {
  it("renomeia e desativa", async () => {
    const created = await insertDestination(db, { name: "Velho" });

    expect(
      await renameDestinationAction({ id: created.id, name: "Novo" }),
    ).toEqual({ ok: true });
    expect(
      await setDestinationActiveAction({ id: created.id, active: false }),
    ).toEqual({ ok: true });
    const [row] = await db
      .select()
      .from(destination)
      .where(eq(destination.id, created.id));
    expect(row).toMatchObject({ name: "Novo", active: false });
  });

  it("id malformado é recusado antes do banco", async () => {
    expect(
      await setDestinationActiveAction({ id: "abc", active: false }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });
});
```

- [ ] **Step 10: Run tests to verify they fail**

Run: `bun run test -- "src/app/(app)/admin/setores/actions.test.ts" "src/app/(app)/admin/destinos/actions.test.ts"`
Expected: FAIL com `Cannot find module './actions' imported from …/src/app/(app)/admin/setores/actions.test.ts` (e o mesmo para `destinos`).

- [ ] **Step 11: Write minimal implementation (Server Actions)**

Cada função exportada começa por `requireAdmin()` (guarda `actionsAuth.test.ts` da Tarefa 3). Operador recebe o `notFound()` do `requireAdmin` antes de qualquer leitura de entrada ou de banco.

Crie `src/app/(app)/admin/setores/actions.ts`:

```ts
"use server";

import type { AdminResult } from "@/features/admin/result";
import { runAdminAction } from "@/features/admin/runAdminAction";
import {
  createSectorSchema,
  renameSectorSchema,
  setActiveSchema,
} from "@/features/admin/schemas";
import {
  createSector,
  renameSector,
  setSectorActive,
} from "@/features/admin/sectors";
import { requireAdmin } from "@/lib/auth/session";

export async function createSectorAction(
  input: unknown,
): Promise<AdminResult<{ id: string }>> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: createSectorSchema,
    input,
    run: ({ db, input: data }) => createSector(db, data),
  });
}

export async function renameSectorAction(input: unknown): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: renameSectorSchema,
    input,
    run: ({ db, input: data }) => renameSector(db, data),
  });
}

export async function setSectorActiveAction(
  input: unknown,
): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: setActiveSchema,
    input,
    run: ({ db, now, input: data }) => setSectorActive(db, data, now),
  });
}
```

Crie `src/app/(app)/admin/destinos/actions.ts`:

```ts
"use server";

import {
  createDestination,
  renameDestination,
  setDestinationActive,
} from "@/features/admin/destinations";
import type { AdminResult } from "@/features/admin/result";
import { runAdminAction } from "@/features/admin/runAdminAction";
import {
  createDestinationSchema,
  renameDestinationSchema,
  setActiveSchema,
} from "@/features/admin/schemas";
import { requireAdmin } from "@/lib/auth/session";

export async function createDestinationAction(
  input: unknown,
): Promise<AdminResult<{ id: string }>> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: createDestinationSchema,
    input,
    run: ({ db, input: data }) => createDestination(db, data),
  });
}

export async function renameDestinationAction(
  input: unknown,
): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: renameDestinationSchema,
    input,
    run: ({ db, input: data }) => renameDestination(db, data),
  });
}

export async function setDestinationActiveAction(
  input: unknown,
): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: setActiveSchema,
    input,
    run: ({ db, input: data }) => setDestinationActive(db, data),
  });
}
```

- [ ] **Step 12: Run tests to verify they pass**

Run: `bun run test -- "src/app/(app)/admin/setores/actions.test.ts" "src/app/(app)/admin/destinos/actions.test.ts"`
Expected: PASS (17 testes: 12 em `setores`, 5 em `destinos`)

- [ ] **Step 13: Write the failing tests (componentes e página de Setores)**

Crie `src/components/admin/sectors/SectorCreateForm.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SectorCreateForm } from "@/components/admin/sectors/SectorCreateForm";

const mocks = vi.hoisted(() => ({
  createSectorAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/setores/actions", () => ({
  createSectorAction: mocks.createSectorAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

describe("SectorCreateForm", () => {
  beforeEach(() => {
    mocks.createSectorAction.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
  });

  it("mostra o campo 'Nome do setor' vazio e o botão 'Criar setor'", () => {
    render(<SectorCreateForm />);

    expect(screen.getByLabelText("Nome do setor")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Criar setor" }),
    ).toBeInTheDocument();
  });

  it("cria o setor, avisa com toast e limpa o campo", async () => {
    mocks.createSectorAction.mockResolvedValue({ ok: true, id: "s1" });
    render(<SectorCreateForm />);

    await userEvent.type(screen.getByLabelText("Nome do setor"), "  Pátio ");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Setor criado."),
    );
    expect(mocks.createSectorAction).toHaveBeenCalledWith({ name: "Pátio" });
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("");
  });

  it("nome vazio mostra o erro sem chamar o servidor", async () => {
    render(<SectorCreateForm />);

    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Informe o nome.",
    );
    expect(mocks.createSectorAction).not.toHaveBeenCalled();
  });

  it("nome com 61 caracteres mostra o erro de tamanho", async () => {
    render(<SectorCreateForm />);

    await userEvent.click(screen.getByLabelText("Nome do setor"));
    await userEvent.paste("a".repeat(61));
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O nome pode ter no máximo 60 caracteres.",
    );
    expect(mocks.createSectorAction).not.toHaveBeenCalled();
  });

  it("quando o servidor recusa, mostra a mensagem e preserva o que foi digitado", async () => {
    mocks.createSectorAction.mockResolvedValue({
      ok: false,
      code: "NAME_TAKEN",
      message: "Já existe um setor com este nome.",
      fieldErrors: { name: "Já existe um setor com este nome." },
    });
    render(<SectorCreateForm />);

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe um setor com este nome.",
    );
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("ULD");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("falha de rede mostra a mensagem genérica e preserva o texto", async () => {
    mocks.createSectorAction.mockRejectedValue(new Error("fetch failed"));
    render(<SectorCreateForm />);

    await userEvent.type(screen.getByLabelText("Nome do setor"), "ULD");
    await userEvent.click(screen.getByRole("button", { name: "Criar setor" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir. Tente de novo.",
    );
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("ULD");
  });
});
```

Crie `src/components/admin/sectors/SectorRowActions.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SectorRowActions } from "@/components/admin/sectors/SectorRowActions";
import type { SectorRow } from "@/features/admin/sectors";

const mocks = vi.hoisted(() => ({
  renameSectorAction: vi.fn(),
  setSectorActiveAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/setores/actions", () => ({
  renameSectorAction: mocks.renameSectorAction,
  setSectorActiveAction: mocks.setSectorActiveAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const SECTOR: SectorRow = {
  id: "s1",
  name: "Pátio",
  active: true,
  activePeople: 0,
  pendingInvites: 0,
};

describe("SectorRowActions", () => {
  beforeEach(() => {
    mocks.renameSectorAction.mockReset();
    mocks.setSectorActiveAction.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
  });

  it("setor ativo: botões 'Editar Pátio' e 'Desativar Pátio'", () => {
    render(<SectorRowActions sector={SECTOR} />);

    expect(
      screen.getByRole("button", { name: "Editar Pátio" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Desativar Pátio" }),
    ).toBeInTheDocument();
  });

  it("setor inativo: botão 'Reativar Pátio' e nenhum 'Desativar'", () => {
    render(<SectorRowActions sector={{ ...SECTOR, active: false }} />);

    expect(
      screen.getByRole("button", { name: "Reativar Pátio" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Desativar Pátio" }),
    ).not.toBeInTheDocument();
  });

  it("desativar chama a action e avisa 'Setor desativado.'", async () => {
    mocks.setSectorActiveAction.mockResolvedValue({ ok: true });
    render(<SectorRowActions sector={SECTOR} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Desativar Pátio" }),
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Setor desativado."),
    );
    expect(mocks.setSectorActiveAction).toHaveBeenCalledWith({
      id: "s1",
      active: false,
    });
  });

  it("reativar chama a action e avisa 'Setor reativado.'", async () => {
    mocks.setSectorActiveAction.mockResolvedValue({ ok: true });
    render(<SectorRowActions sector={{ ...SECTOR, active: false }} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Reativar Pátio" }),
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Setor reativado."),
    );
    expect(mocks.setSectorActiveAction).toHaveBeenCalledWith({
      id: "s1",
      active: true,
    });
  });

  it("desativar bloqueado mostra a mensagem de SECTOR_IN_USE em toast, sem aviso de sucesso", async () => {
    const message =
      "Este setor tem 3 pessoas ativas e 1 convite pendente. Mova, desative ou cancele antes.";
    mocks.setSectorActiveAction.mockResolvedValue({
      ok: false,
      code: "SECTOR_IN_USE",
      message,
    });
    render(<SectorRowActions sector={SECTOR} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Desativar Pátio" }),
    );

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith(message));
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Desativar Pátio" }),
    ).toBeEnabled();
  });

  it("Editar abre o diálogo 'Editar setor' com o nome atual e salva", async () => {
    mocks.renameSectorAction.mockResolvedValue({ ok: true });
    render(<SectorRowActions sector={SECTOR} />);

    await userEvent.click(screen.getByRole("button", { name: "Editar Pátio" }));

    const dialog = await screen.findByRole("dialog", { name: "Editar setor" });
    const field = screen.getByLabelText("Nome do setor");
    expect(field).toHaveValue("Pátio");

    await userEvent.clear(field);
    await userEvent.type(field, "Pátio Norte");
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Alterações salvas."),
    );
    expect(mocks.renameSectorAction).toHaveBeenCalledWith({
      id: "s1",
      name: "Pátio Norte",
    });
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("nome repetido na edição mantém o diálogo aberto com o erro", async () => {
    mocks.renameSectorAction.mockResolvedValue({
      ok: false,
      code: "NAME_TAKEN",
      message: "Já existe um setor com este nome.",
      fieldErrors: { name: "Já existe um setor com este nome." },
    });
    render(<SectorRowActions sector={SECTOR} />);

    await userEvent.click(screen.getByRole("button", { name: "Editar Pátio" }));
    const field = await screen.findByLabelText("Nome do setor");
    await userEvent.clear(field);
    await userEvent.type(field, "ULD");
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe um setor com este nome.",
    );
    expect(
      screen.getByRole("dialog", { name: "Editar setor" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("ULD");
  });
});
```

Crie `src/components/admin/sectors/SectorsAdmin.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SectorsAdmin } from "@/components/admin/sectors/SectorsAdmin";
import type { SectorRow } from "@/features/admin/sectors";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listSectors: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/features/admin/sectors", () => ({
  listSectors: mocks.listSectors,
}));
// Os componentes de cliente importam as Server Actions; aqui só a tela importa.
vi.mock("@/app/(app)/admin/setores/actions", () => ({
  createSectorAction: vi.fn(),
  renameSectorAction: vi.fn(),
  setSectorActiveAction: vi.fn(),
}));

function row(overrides: Partial<SectorRow> = {}): SectorRow {
  return {
    id: "s1",
    name: "ULD",
    active: true,
    activePeople: 3,
    pendingInvites: 1,
    ...overrides,
  };
}

function page(
  rows: SectorRow[],
  extra: Partial<{ page: number; pageCount: number }> = {},
) {
  return {
    rows,
    total: rows.length,
    page: extra.page ?? 1,
    pageCount: extra.pageCount ?? 1,
    pageSize: 50,
  };
}

const NO_PARAMS = Promise.resolve({});

describe("SectorsAdmin", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset();
    mocks.listSectors.mockReset();
    mocks.requireAdmin.mockResolvedValue({ role: "admin" });
  });

  it("mostra título, texto, link de volta e o cartão 'Novo setor'", async () => {
    mocks.listSectors.mockResolvedValue(page([row()]));

    render(await SectorsAdmin({ searchParams: NO_PARAMS }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Setores" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Onde cada pessoa trabalha. Turnos e itens são cadastrados por setor.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para Administração" }),
    ).toHaveAttribute("href", "/admin");
    expect(screen.getByText("Novo setor")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do setor")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Criar setor" }),
    ).toBeInTheDocument();
  });

  it("cada linha mostra o nome e as contagens, com singular e plural", async () => {
    mocks.listSectors.mockResolvedValue(
      page([
        row({ id: "a", name: "ULD", activePeople: 3, pendingInvites: 1 }),
        row({ id: "b", name: "Pátio", activePeople: 1, pendingInvites: 2 }),
        row({ id: "c", name: "Cargas", activePeople: 0, pendingInvites: 0 }),
      ]),
    );

    render(await SectorsAdmin({ searchParams: NO_PARAMS }));

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(
      screen.getByText("3 pessoas ativas · 1 convite pendente"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("1 pessoa ativa · 2 convites pendentes"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("0 pessoas ativas · 0 convites pendentes"),
    ).toBeInTheDocument();
  });

  it("setor inativo ganha o selo 'Inativo' e o botão 'Reativar'", async () => {
    mocks.listSectors.mockResolvedValue(
      page([row({ name: "Antigo", active: false })]),
    );

    render(await SectorsAdmin({ searchParams: NO_PARAMS }));

    expect(screen.getByText("Inativo")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reativar Antigo" }),
    ).toBeInTheDocument();
  });

  it("sem setores mostra o estado vazio e o formulário de criação", async () => {
    mocks.listSectors.mockResolvedValue(page([]));

    render(await SectorsAdmin({ searchParams: NO_PARAMS }));

    expect(screen.getByText("Nenhum setor ainda.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Crie o primeiro setor acima para cadastrar turnos, itens e convidar operadores.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Criar setor" }),
    ).toBeInTheDocument();
  });

  it("lê ?pagina= e mostra a paginação", async () => {
    mocks.listSectors.mockResolvedValue(
      page([row()], { page: 2, pageCount: 3 }),
    );

    render(
      await SectorsAdmin({ searchParams: Promise.resolve({ pagina: "2" }) }),
    );

    expect(mocks.listSectors).toHaveBeenCalledWith(
      {},
      { page: 2 },
      expect.any(Date),
    );
    expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/admin/setores",
    );
    expect(screen.getByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/admin/setores?pagina=3",
    );
  });

  it("?pagina= inválida cai na página 1 e uma página só não mostra paginação", async () => {
    mocks.listSectors.mockResolvedValue(page([row()]));

    render(
      await SectorsAdmin({ searchParams: Promise.resolve({ pagina: "abc" }) }),
    );

    expect(mocks.listSectors).toHaveBeenCalledWith(
      {},
      { page: 1 },
      expect.any(Date),
    );
    expect(
      screen.queryByRole("navigation", { name: "Paginação" }),
    ).not.toBeInTheDocument();
  });

  it("operador: requireAdmin lança (notFound), nada é lido nem renderizado", async () => {
    mocks.requireAdmin.mockRejectedValue(
      new Error("NEXT_HTTP_ERROR_FALLBACK;404"),
    );

    await expect(SectorsAdmin({ searchParams: NO_PARAMS })).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
    expect(mocks.listSectors).not.toHaveBeenCalled();
  });
});
```

Crie `src/app/(app)/admin/setores/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { use } from "react";
import { describe, expect, it, vi } from "vitest";

import SetoresPage from "./page";

// A tela nunca resolve: o que a página mostra enquanto espera é o esqueleto,
// sem título (o <h1> só existe depois do portão).
vi.mock("@/components/admin/sectors/SectorsAdmin", () => ({
  SectorsAdmin: () => use(new Promise<never>(() => {})),
}));

describe("página /admin/setores", () => {
  it("enquanto carrega mostra o esqueleto e nenhum título", () => {
    const { container } = render(
      <SetoresPage searchParams={Promise.resolve({})} />,
    );

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 14: Run tests to verify they fail**

Run: `bun run test -- src/components/admin/sectors "src/app/(app)/admin/setores/page.test.tsx"`
Expected: FAIL com `Failed to resolve import "@/components/admin/sectors/SectorCreateForm"` (e o mesmo para `SectorRowActions`, `SectorsAdmin` e `./page`).

- [ ] **Step 15: Write minimal implementation (componentes e página de Setores)**

Crie `src/components/admin/sectors/SectorCreateForm.tsx`:

```tsx
"use client";

import { createSectorAction } from "@/app/(app)/admin/setores/actions";
import { NameForm } from "@/components/admin/NameForm";

export function SectorCreateForm() {
  return (
    <NameForm
      entity="setor"
      initialName=""
      submitLabel="Criar setor"
      successMessage="Setor criado."
      onSubmit={(name) => createSectorAction({ name })}
    />
  );
}
```

Crie `src/components/admin/sectors/SectorRowActions.tsx`:

```tsx
"use client";

import {
  renameSectorAction,
  setSectorActiveAction,
} from "@/app/(app)/admin/setores/actions";
import { ActiveToggleButton } from "@/components/admin/ActiveToggleButton";
import { EditDialog } from "@/components/admin/EditDialog";
import { NameForm } from "@/components/admin/NameForm";
import type { SectorRow } from "@/features/admin/sectors";

export function SectorRowActions({ sector }: { sector: SectorRow }) {
  return (
    <>
      <EditDialog title="Editar setor" name={sector.name}>
        {(close) => (
          <NameForm
            entity="setor"
            initialName={sector.name}
            submitLabel="Salvar alterações"
            successMessage="Alterações salvas."
            onSubmit={(name) => renameSectorAction({ id: sector.id, name })}
            onDone={close}
          />
        )}
      </EditDialog>
      <ActiveToggleButton
        entity="Setor"
        name={sector.name}
        active={sector.active}
        onToggle={(active) => setSectorActiveAction({ id: sector.id, active })}
      />
    </>
  );
}
```

Crie `src/components/admin/sectors/SectorsAdmin.tsx`:

```tsx
import { AdminListRow } from "@/components/admin/AdminListRow";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";
import { SectorCreateForm } from "@/components/admin/sectors/SectorCreateForm";
import { SectorRowActions } from "@/components/admin/sectors/SectorRowActions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { parsePage } from "@/features/admin/pagination";
import { listSectors } from "@/features/admin/sectors";
import { requireAdmin } from "@/lib/auth/session";
import { pluralize } from "@/lib/plural";

type SectorsAdminProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// Lê tudo dentro do <Suspense> da página: o portão (requireAdmin) vem antes de
// qualquer leitura, e o título só aparece para quem passa por ele.
export async function SectorsAdmin({ searchParams }: SectorsAdminProps) {
  await requireAdmin();
  const params = await searchParams;
  const data = await listSectors(
    db,
    { page: parsePage(params.pagina) },
    new Date(),
  );

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Setores"
        description="Onde cada pessoa trabalha. Turnos e itens são cadastrados por setor."
        backHref="/admin"
      />

      <Card>
        <CardHeader>
          <CardTitle>Novo setor</CardTitle>
        </CardHeader>
        <CardContent>
          <SectorCreateForm />
        </CardContent>
      </Card>

      {data.total === 0 ? (
        <EmptyState
          title="Nenhum setor ainda."
          description="Crie o primeiro setor acima para cadastrar turnos, itens e convidar operadores."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.rows.map((row) => (
            <AdminListRow
              key={row.id}
              title={row.name}
              inactive={!row.active}
              subtitle={`${pluralize(row.activePeople, "pessoa ativa", "pessoas ativas")} · ${pluralize(row.pendingInvites, "convite pendente", "convites pendentes")}`}
              actions={<SectorRowActions sector={row} />}
            />
          ))}
        </ul>
      )}

      <Pagination
        page={data.page}
        pageCount={data.pageCount}
        pathname="/admin/setores"
        params={{}}
      />
    </div>
  );
}
```

Crie `src/app/(app)/admin/setores/page.tsx` (sem `metadata`; `<h1>` dentro do Suspense; `searchParams` só é lido dentro do Suspense):

```tsx
import { Suspense } from "react";

import { AdminListSkeleton } from "@/components/admin/AdminListSkeleton";
import { SectorsAdmin } from "@/components/admin/sectors/SectorsAdmin";
import { Skeleton } from "@/components/ui/skeleton";

// Sem `metadata` de propósito (o <title> sairia antes do portão) e com o <h1>
// dentro do Suspense: o operador vê "Página não encontrada" sem ver "Setores".
export default function SetoresPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SectorsAdmin searchParams={props.searchParams} />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-32 w-full" />
      <AdminListSkeleton />
    </div>
  );
}
```

- [ ] **Step 16: Run tests to verify they pass**

Run: `bun run test -- src/components/admin/sectors "src/app/(app)/admin/setores/page.test.tsx"`
Expected: PASS (21 testes: 6 `SectorCreateForm`, 7 `SectorRowActions`, 7 `SectorsAdmin`, 1 `page`). Se o Vitest acusar `Timeout waiting for worker to respond` com a máquina carregada, repita com `--maxWorkers=2`.

- [ ] **Step 17: Write the failing tests (componentes e página de Destinos)**

Crie `src/components/admin/destinations/DestinationCreateForm.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DestinationCreateForm } from "@/components/admin/destinations/DestinationCreateForm";

const mocks = vi.hoisted(() => ({
  createDestinationAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/destinos/actions", () => ({
  createDestinationAction: mocks.createDestinationAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

describe("DestinationCreateForm", () => {
  beforeEach(() => {
    mocks.createDestinationAction.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
  });

  it("mostra o campo 'Nome do destino' vazio e o botão 'Criar destino'", () => {
    render(<DestinationCreateForm />);

    expect(screen.getByLabelText("Nome do destino")).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Criar destino" }),
    ).toBeInTheDocument();
  });

  it("cria o destino, avisa com toast e limpa o campo", async () => {
    mocks.createDestinationAction.mockResolvedValue({ ok: true, id: "d1" });
    render(<DestinationCreateForm />);

    await userEvent.type(
      screen.getByLabelText("Nome do destino"),
      "Almoxarifado",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Criar destino" }),
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Destino criado."),
    );
    expect(mocks.createDestinationAction).toHaveBeenCalledWith({
      name: "Almoxarifado",
    });
    expect(screen.getByLabelText("Nome do destino")).toHaveValue("");
  });

  it("nome vazio mostra o erro sem chamar o servidor", async () => {
    render(<DestinationCreateForm />);

    await userEvent.click(
      screen.getByRole("button", { name: "Criar destino" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Informe o nome.",
    );
    expect(mocks.createDestinationAction).not.toHaveBeenCalled();
  });

  it("servidor recusa nome repetido: mostra a mensagem e preserva o texto", async () => {
    mocks.createDestinationAction.mockResolvedValue({
      ok: false,
      code: "NAME_TAKEN",
      message:
        "Já existe um destino com este nome. Ele está inativo: reative-o na lista.",
      fieldErrors: {
        name: "Já existe um destino com este nome. Ele está inativo: reative-o na lista.",
      },
    });
    render(<DestinationCreateForm />);

    await userEvent.type(screen.getByLabelText("Nome do destino"), "Oficina");
    await userEvent.click(
      screen.getByRole("button", { name: "Criar destino" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Ele está inativo: reative-o na lista.",
    );
    expect(screen.getByLabelText("Nome do destino")).toHaveValue("Oficina");
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
```

Crie `src/components/admin/destinations/DestinationRowActions.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DestinationRowActions } from "@/components/admin/destinations/DestinationRowActions";
import type { DestinationRow } from "@/features/admin/destinations";

const mocks = vi.hoisted(() => ({
  renameDestinationAction: vi.fn(),
  setDestinationActiveAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/destinos/actions", () => ({
  renameDestinationAction: mocks.renameDestinationAction,
  setDestinationActiveAction: mocks.setDestinationActiveAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const DESTINATION: DestinationRow = {
  id: "d1",
  name: "Oficina",
  active: true,
};

describe("DestinationRowActions", () => {
  beforeEach(() => {
    mocks.renameDestinationAction.mockReset();
    mocks.setDestinationActiveAction.mockReset();
    mocks.toastSuccess.mockReset();
    mocks.toastError.mockReset();
  });

  it("destino ativo: 'Editar Oficina' e 'Desativar Oficina'", () => {
    render(<DestinationRowActions destination={DESTINATION} />);

    expect(
      screen.getByRole("button", { name: "Editar Oficina" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Desativar Oficina" }),
    ).toBeInTheDocument();
  });

  it("destino inativo: 'Reativar Oficina'", () => {
    render(
      <DestinationRowActions destination={{ ...DESTINATION, active: false }} />,
    );

    expect(
      screen.getByRole("button", { name: "Reativar Oficina" }),
    ).toBeInTheDocument();
  });

  it("desativar chama a action e avisa 'Destino desativado.'", async () => {
    mocks.setDestinationActiveAction.mockResolvedValue({ ok: true });
    render(<DestinationRowActions destination={DESTINATION} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Desativar Oficina" }),
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Destino desativado."),
    );
    expect(mocks.setDestinationActiveAction).toHaveBeenCalledWith({
      id: "d1",
      active: false,
    });
  });

  it("falha ao desativar mostra o erro em toast", async () => {
    mocks.setDestinationActiveAction.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Destino não encontrado. Atualize a página.",
    });
    render(<DestinationRowActions destination={DESTINATION} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Desativar Oficina" }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Destino não encontrado. Atualize a página.",
      ),
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("Editar abre 'Editar destino' com o nome atual e salva", async () => {
    mocks.renameDestinationAction.mockResolvedValue({ ok: true });
    render(<DestinationRowActions destination={DESTINATION} />);

    await userEvent.click(
      screen.getByRole("button", { name: "Editar Oficina" }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Editar destino",
    });
    const field = screen.getByLabelText("Nome do destino");
    expect(field).toHaveValue("Oficina");

    await userEvent.clear(field);
    await userEvent.type(field, "Oficina Central");
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Alterações salvas."),
    );
    expect(mocks.renameDestinationAction).toHaveBeenCalledWith({
      id: "d1",
      name: "Oficina Central",
    });
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });
});
```

Crie `src/components/admin/destinations/DestinationsAdmin.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DestinationsAdmin } from "@/components/admin/destinations/DestinationsAdmin";
import type { DestinationRow } from "@/features/admin/destinations";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listDestinations: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/features/admin/destinations", () => ({
  listDestinations: mocks.listDestinations,
}));
vi.mock("@/app/(app)/admin/destinos/actions", () => ({
  createDestinationAction: vi.fn(),
  renameDestinationAction: vi.fn(),
  setDestinationActiveAction: vi.fn(),
}));

function page(
  rows: DestinationRow[],
  extra: Partial<{ page: number; pageCount: number }> = {},
) {
  return {
    rows,
    total: rows.length,
    page: extra.page ?? 1,
    pageCount: extra.pageCount ?? 1,
    pageSize: 50,
  };
}

const NO_PARAMS = Promise.resolve({});

describe("DestinationsAdmin", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset();
    mocks.listDestinations.mockReset();
    mocks.requireAdmin.mockResolvedValue({ role: "admin" });
  });

  it("mostra título, texto, link de volta e o cartão 'Novo destino'", async () => {
    mocks.listDestinations.mockResolvedValue(
      page([{ id: "d1", name: "Almoxarifado", active: true }]),
    );

    render(await DestinationsAdmin({ searchParams: NO_PARAMS }));

    expect(
      screen.getByRole("heading", { level: 1, name: "Destinos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Para onde os pedidos de material vão. Valem para todos os setores.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para Administração" }),
    ).toHaveAttribute("href", "/admin");
    expect(screen.getByText("Novo destino")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do destino")).toHaveValue("");
    expect(screen.getByText("Almoxarifado")).toBeInTheDocument();
  });

  it("destino inativo ganha o selo 'Inativo' e o botão 'Reativar'", async () => {
    mocks.listDestinations.mockResolvedValue(
      page([{ id: "d1", name: "Antigo", active: false }]),
    );

    render(await DestinationsAdmin({ searchParams: NO_PARAMS }));

    expect(screen.getByText("Inativo")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reativar Antigo" }),
    ).toBeInTheDocument();
  });

  it("sem destinos mostra o estado vazio", async () => {
    mocks.listDestinations.mockResolvedValue(page([]));

    render(await DestinationsAdmin({ searchParams: NO_PARAMS }));

    expect(screen.getByText("Nenhum destino ainda.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Crie o primeiro destino acima, por exemplo o almoxarifado.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("lê ?pagina= e mostra a paginação", async () => {
    mocks.listDestinations.mockResolvedValue(
      page([{ id: "d1", name: "Oficina", active: true }], {
        page: 2,
        pageCount: 2,
      }),
    );

    render(
      await DestinationsAdmin({
        searchParams: Promise.resolve({ pagina: "2" }),
      }),
    );

    expect(mocks.listDestinations).toHaveBeenCalledWith({}, { page: 2 });
    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/admin/destinos",
    );
  });

  it("operador: requireAdmin lança (notFound) e nada é lido", async () => {
    mocks.requireAdmin.mockRejectedValue(
      new Error("NEXT_HTTP_ERROR_FALLBACK;404"),
    );

    await expect(
      DestinationsAdmin({ searchParams: NO_PARAMS }),
    ).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.listDestinations).not.toHaveBeenCalled();
  });
});
```

Crie `src/app/(app)/admin/destinos/page.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { use } from "react";
import { describe, expect, it, vi } from "vitest";

import DestinosPage from "./page";

vi.mock("@/components/admin/destinations/DestinationsAdmin", () => ({
  DestinationsAdmin: () => use(new Promise<never>(() => {})),
}));

describe("página /admin/destinos", () => {
  it("enquanto carrega mostra o esqueleto e nenhum título", () => {
    const { container } = render(
      <DestinosPage searchParams={Promise.resolve({})} />,
    );

    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 18: Run tests to verify they fail**

Run: `bun run test -- src/components/admin/destinations "src/app/(app)/admin/destinos/page.test.tsx"`
Expected: FAIL com `Failed to resolve import "@/components/admin/destinations/DestinationCreateForm"` (e o mesmo para `DestinationRowActions`, `DestinationsAdmin` e `./page`).

- [ ] **Step 19: Write minimal implementation (componentes e página de Destinos)**

Crie `src/components/admin/destinations/DestinationCreateForm.tsx`:

```tsx
"use client";

import { createDestinationAction } from "@/app/(app)/admin/destinos/actions";
import { NameForm } from "@/components/admin/NameForm";

export function DestinationCreateForm() {
  return (
    <NameForm
      entity="destino"
      initialName=""
      submitLabel="Criar destino"
      successMessage="Destino criado."
      onSubmit={(name) => createDestinationAction({ name })}
    />
  );
}
```

Crie `src/components/admin/destinations/DestinationRowActions.tsx`:

```tsx
"use client";

import {
  renameDestinationAction,
  setDestinationActiveAction,
} from "@/app/(app)/admin/destinos/actions";
import { ActiveToggleButton } from "@/components/admin/ActiveToggleButton";
import { EditDialog } from "@/components/admin/EditDialog";
import { NameForm } from "@/components/admin/NameForm";
import type { DestinationRow } from "@/features/admin/destinations";

export function DestinationRowActions({
  destination,
}: {
  destination: DestinationRow;
}) {
  return (
    <>
      <EditDialog title="Editar destino" name={destination.name}>
        {(close) => (
          <NameForm
            entity="destino"
            initialName={destination.name}
            submitLabel="Salvar alterações"
            successMessage="Alterações salvas."
            onSubmit={(name) =>
              renameDestinationAction({ id: destination.id, name })
            }
            onDone={close}
          />
        )}
      </EditDialog>
      <ActiveToggleButton
        entity="Destino"
        name={destination.name}
        active={destination.active}
        onToggle={(active) =>
          setDestinationActiveAction({ id: destination.id, active })
        }
      />
    </>
  );
}
```

Crie `src/components/admin/destinations/DestinationsAdmin.tsx`:

```tsx
import { AdminListRow } from "@/components/admin/AdminListRow";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { DestinationCreateForm } from "@/components/admin/destinations/DestinationCreateForm";
import { DestinationRowActions } from "@/components/admin/destinations/DestinationRowActions";
import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { listDestinations } from "@/features/admin/destinations";
import { parsePage } from "@/features/admin/pagination";
import { requireAdmin } from "@/lib/auth/session";

type DestinationsAdminProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function DestinationsAdmin({
  searchParams,
}: DestinationsAdminProps) {
  await requireAdmin();
  const params = await searchParams;
  const data = await listDestinations(db, { page: parsePage(params.pagina) });

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Destinos"
        description="Para onde os pedidos de material vão. Valem para todos os setores."
        backHref="/admin"
      />

      <Card>
        <CardHeader>
          <CardTitle>Novo destino</CardTitle>
        </CardHeader>
        <CardContent>
          <DestinationCreateForm />
        </CardContent>
      </Card>

      {data.total === 0 ? (
        <EmptyState
          title="Nenhum destino ainda."
          description="Crie o primeiro destino acima, por exemplo o almoxarifado."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.rows.map((row) => (
            <AdminListRow
              key={row.id}
              title={row.name}
              inactive={!row.active}
              actions={<DestinationRowActions destination={row} />}
            />
          ))}
        </ul>
      )}

      <Pagination
        page={data.page}
        pageCount={data.pageCount}
        pathname="/admin/destinos"
        params={{}}
      />
    </div>
  );
}
```

Crie `src/app/(app)/admin/destinos/page.tsx`:

```tsx
import { Suspense } from "react";

import { AdminListSkeleton } from "@/components/admin/AdminListSkeleton";
import { DestinationsAdmin } from "@/components/admin/destinations/DestinationsAdmin";
import { Skeleton } from "@/components/ui/skeleton";

// Sem `metadata` de propósito (o <title> sairia antes do portão) e com o <h1>
// dentro do Suspense: o operador vê "Página não encontrada" sem ver "Destinos".
export default function DestinosPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DestinationsAdmin searchParams={props.searchParams} />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-32 w-full" />
      <AdminListSkeleton />
    </div>
  );
}
```

- [ ] **Step 20: Run tests to verify they pass**

Run: `bun run test -- src/components/admin/destinations "src/app/(app)/admin/destinos/page.test.tsx"`
Expected: PASS (15 testes: 4 `DestinationCreateForm`, 5 `DestinationRowActions`, 5 `DestinationsAdmin`, 1 `page`)

- [ ] **Step 21: Atualizar `.context/ui-registry.md`**

Use a ferramenta Edit em `.context/ui-registry.md`. Âncora: a linha `## 3. Componentes de domínio — \`src/features/<domínio>/components\``. As entradas das Tarefas 5, 7–10 também entram antes dessa linha; se o arquivo já tiver entradas novas ali, insira estas logo depois delas, ainda antes da âncora.

`old_string`:

```text
## 3. Componentes de domínio — `src/features/<domínio>/components`
```

`new_string`:

````text
### SectorsAdmin
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/sectors/SectorsAdmin.tsx`
- **Propósito:** conteúdo de `/admin/setores` (Server Component async).
- **Como funciona:** `await requireAdmin()` primeiro (operador cai no `notFound()`), lê `?pagina=` e `listSectors` (contagens de pessoas ativas e convites pendentes por subconsulta no SQL), monta `AdminPageHeader` + cartão "Novo setor" + lista de `AdminListRow` (detalhe `{n} pessoas ativas · {m} convites pendentes`, selo "Inativo") + `Pagination`; vazio vira `EmptyState`. A página (`page.tsx`) só embrulha em `<Suspense>` com esqueleto, sem `metadata`.
- **Usa:** `AdminPageHeader`, `AdminListRow`, `EmptyState`, `Pagination`, `Card*`, `pluralize`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 6).

### SectorCreateForm
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/sectors/SectorCreateForm.tsx`
- **Propósito:** criar setor ("Criar setor").
- **Como funciona:** `"use client"`; `NameForm` (entity "setor", nome começa vazio por ser a identidade do registro) → `createSectorAction`; toast "Setor criado."; erro de nome repetido inline (com o aviso "Ele está inativo: reative-o na lista." quando for o caso).
- **Usa:** `NameForm`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 6).

### SectorRowActions
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/sectors/SectorRowActions.tsx`
- **Propósito:** ações da linha de um setor: "Editar" e "Desativar"/"Reativar".
- **Como funciona:** `"use client"`; `EditDialog` "Editar setor" com `NameForm` ("Salvar alterações", toast "Alterações salvas.", fecha ao salvar) e `ActiveToggleButton` → `setSectorActiveAction`. Desativar setor com pessoas ativas ou convites pendentes volta `SECTOR_IN_USE` e a mensagem com as contagens aparece em toast.
- **Usa:** `EditDialog`, `NameForm`, `ActiveToggleButton`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 6).

### DestinationsAdmin
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/destinations/DestinationsAdmin.tsx`
- **Propósito:** conteúdo de `/admin/destinos` (Server Component async).
- **Como funciona:** igual a `SectorsAdmin`, sem contagens: `requireAdmin()` → `listDestinations` → cabeçalho + cartão "Novo destino" + lista + `Pagination`; vazio vira `EmptyState`.
- **Usa:** `AdminPageHeader`, `AdminListRow`, `EmptyState`, `Pagination`, `Card*`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 6).

### DestinationCreateForm
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/destinations/DestinationCreateForm.tsx`
- **Propósito:** criar destino ("Criar destino").
- **Como funciona:** `"use client"`; `NameForm` (entity "destino") → `createDestinationAction`; toast "Destino criado.".
- **Usa:** `NameForm`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 6).

### DestinationRowActions
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/destinations/DestinationRowActions.tsx`
- **Propósito:** ações da linha de um destino: "Editar" e "Desativar"/"Reativar".
- **Como funciona:** `"use client"`; `EditDialog` "Editar destino" com `NameForm` e `ActiveToggleButton` → `setDestinationActiveAction` (idempotente).
- **Usa:** `EditDialog`, `NameForm`, `ActiveToggleButton`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 6).

## 3. Componentes de domínio — `src/features/<domínio>/components`
````

- [ ] **Step 22: Formatar, checar tipos, lint e rodar a suíte**

Run: `bunx biome check --write src test`
Expected: `Checked N files … No fixes applied.` (o código acima já está formatado; se algo mudar, mantenha o resultado do Biome)

Run: `bun run check-types`
Expected: sai sem erros (`✓ Types generated successfully` e `tsc` sem saída)

Run: `bun run lint`
Expected: `Checked N files … No fixes applied.`

Run: `bun run test -- --maxWorkers=2`
Expected: PASS em todos os arquivos da suíte (inclui `appPagesAuth.test.ts` e o guarda `actionsAuth.test.ts` da Tarefa 3, que passam a varrer `setores` e `destinos`). Na máquina de validação o total foi 66 arquivos / 697 testes com as Tarefas 1–5 em versão mínima; o número da suíte real depende das outras tarefas.

- [ ] **Step 23: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-6.txt` (texto exato abaixo) e rode:

```bash
git add src/features/admin/sectors.ts src/features/admin/sectors.test.ts src/features/admin/destinations.ts src/features/admin/destinations.test.ts "src/app/(app)/admin/setores" "src/app/(app)/admin/destinos" src/components/admin/sectors src/components/admin/destinations .context/ui-registry.md
git commit -F .git/sdd/msg-task-6.txt
```

Mensagem:

```text
feat(admin): setores e destinos com contagens e bloqueio ao desativar

Domínio com PGlite (contagens de pessoas ativas e convites pendentes por
subconsulta no SQL, SECTOR_IN_USE com as três mensagens, NAME_TAKEN com
sufixo de inativo, listActiveSectors e resolveSectorFilter), Server Actions
com requireAdmin na primeira linha e as páginas /admin/setores e
/admin/destinos com Suspense e esqueleto.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 7: Turnos — domínio, actions, página e componentes

**Files:**
- Create: `src/features/admin/shifts.ts`
- Create: `src/app/(app)/admin/turnos/actions.ts`
- Create: `src/app/(app)/admin/turnos/page.tsx`
- Create: `src/components/admin/shifts/ShiftsAdmin.tsx`
- Create: `src/components/admin/shifts/ShiftForm.tsx`
- Create: `src/components/admin/shifts/ShiftRowActions.tsx`
- Modify: `.context/ui-registry.md` (inserir três itens no fim da seção `## 2. Componentes de aplicação`, imediatamente antes da linha `## 3. Componentes de domínio — \`src/features/<domínio>/components\``)
- Test: `src/features/admin/shifts.test.ts`
- Test: `src/app/(app)/admin/turnos/actions.test.ts`
- Test: `src/components/admin/shifts/ShiftForm.test.tsx`
- Test: `src/components/admin/shifts/ShiftRowActions.test.tsx`
- Test: `src/components/admin/shifts/ShiftsAdmin.test.tsx`

**Interfaces:**
- Consumes (Tarefa 1): tabelas `shift` e `sector` (`@/db/schema/catalog`, `@/db/schema/sectors`); fixtures `insertSector(db, name?, { active? })` e `insertShift(db, { sectorId, name?, startsAt?, endsAt?, sortOrder?, active? })`; `createTestDb`/`resetDb`.
- Consumes (Tarefa 2): `normalizeName`/`validateName` (`names.ts`); `parseTimeOfDay`, `toDbTime`, `fromDbTime`, `TIME_INPUT_PATTERN` (`timeOfDay.ts`); `crossesMidnight`, `findOverlaps`, `formatOverlapWarning`, `suggestShiftTimes`, `suggestShiftName`, `NamedShiftRange`, `OverlapWarning` (`shiftRules.ts`); `PAGE_SIZE`, `CHOICE_LIST_LIMIT`, `Page<T>`, `resolvePage`, `parsePage` (`pagination.ts`); `moveId`, `planSortUpdates`, `SortDirection` (`reorder.ts`); `nameTakenMessage`, `notFoundMessage` (`messages.ts`).
- Consumes (Tarefa 3): `AdminResult`, `AdminFailure`, `FieldErrors`, `fail`, `ok`, `INVALID_INPUT_MESSAGE` (`result.ts`); `isUniqueViolation` (`dbErrors.ts`); `createShiftSchema`, `updateShiftSchema`, `setActiveSchema`, `moveSchema`, `firstFieldErrors` (`schemas.ts`); `runAdminAction` (`runAdminAction.ts`); `authzOf` (`test/authz.ts`).
- Consumes (Tarefa 4): `Dialog*` (`@/components/ui/dialog`).
- Consumes (Tarefa 5): `AdminPageHeader`, `AdminListRow`, `AdminListSkeleton`, `EmptyState`, `Pagination`, `SectorSwitcher`, `MoveButtons`, `EditDialog`, `ActiveToggleButton`, `useAdminAction` (`@/components/admin/*`).
- Consumes (Tarefa 6): `listActiveSectors(db): Promise<SectorChoice[]>` e `resolveSectorFilter(sectors, raw): SectorChoice | null` (`@/features/admin/sectors`).
- Produces:
  - `src/features/admin/shifts.ts`: `ShiftRow`, `ShiftFormDefaults`, `listShifts(db, { sectorId, page })`, `getShiftFormDefaults(db, sectorId)`, `createShift(db, { sectorId, name, startsAt, endsAt })`, `updateShift(db, { id, name, startsAt, endsAt })`, `setShiftActive(db, { id, active })`, `moveShift(db, { id, direction })` (assinaturas do contrato).
  - `src/app/(app)/admin/turnos/actions.ts`: `createShiftAction`, `updateShiftAction`, `setShiftActiveAction`, `moveShiftAction` (todas `(input: unknown) => Promise<AdminResult<…>>`).
  - `ShiftsAdmin(props: { searchParams: Promise<Record<string, string | string[] | undefined>> })`, `ShiftForm(props: { sectorId; initial: ShiftFormDefaults & { id?: string }; submitLabel; onDone? })`, `ShiftRowActions(props: { shift: ShiftRow })`.
  - A rota `/admin/turnos` (a Tarefa 11 conta esta página no guarda `appPagesAuth.test.ts`; a Tarefa 12 a usa no E2E).

- [ ] **Step 1: Write the failing test do domínio**

Crie `src/features/admin/shifts.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertSector, insertShift } from "../../../test/fixtures";
import { PAGE_SIZE } from "./pagination";
import {
  createShift,
  getShiftFormDefaults,
  listShifts,
  moveShift,
  setShiftActive,
  updateShift,
} from "./shifts";

const NIL_ID = "00000000-0000-4000-8000-000000000000";

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("valor ausente no teste");
  return value;
}

describe("turnos (domínio)", () => {
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

  async function orderOf(sectorId: string): Promise<string[]> {
    const page = await listShifts(db, { sectorId, page: 1 });
    return page.rows.map((row) => row.name);
  }

  describe("listShifts", () => {
    it("lista só o setor pedido, por ordem, com horário em HH:mm", async () => {
      const uld = await insertSector(db, "ULD");
      const other = await insertSector(db, "Outro");
      await insertShift(db, {
        sectorId: uld.id,
        name: "Tarde",
        startsAt: "14:00",
        endsAt: "22:00",
      });
      await insertShift(db, {
        sectorId: uld.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
        sortOrder: 0,
      });
      await insertShift(db, { sectorId: other.id, name: "Alheio" });

      const page = await listShifts(db, { sectorId: uld.id, page: 1 });

      expect(page.total).toBe(2);
      expect(page.rows.map((row) => row.name)).toEqual(["Manhã", "Tarde"]);
      expect(page.rows[0]).toMatchObject({
        startsAt: "06:00",
        endsAt: "14:00",
        crossesMidnight: false,
        active: true,
      });
    });

    it("setor sem turnos devolve página vazia com pageCount 1", async () => {
      const uld = await insertSector(db, "ULD");
      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      expect(page).toMatchObject({ rows: [], total: 0, page: 1, pageCount: 1 });
    });

    it("marca o turno que atravessa a meia-noite", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, {
        sectorId: uld.id,
        name: "Noite",
        startsAt: "22:00",
        endsAt: "06:00",
      });
      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      expect(page.rows[0]?.crossesMidnight).toBe(true);
    });

    it("sobreposição só entre ativos: aviso nos dois lados, inativo sem aviso", async () => {
      const uld = await insertSector(db, "ULD");
      const noite = await insertShift(db, {
        sectorId: uld.id,
        name: "Noite",
        startsAt: "22:00",
        endsAt: "06:00",
      });
      const madrugada = await insertShift(db, {
        sectorId: uld.id,
        name: "Madrugada",
        startsAt: "05:00",
        endsAt: "07:00",
      });
      await insertShift(db, {
        sectorId: uld.id,
        name: "Dia",
        startsAt: "06:00",
        endsAt: "14:00",
        active: false,
      });

      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      const byName = new Map(page.rows.map((row) => [row.name, row]));

      expect(byName.get("Noite")?.overlaps).toEqual([
        {
          shiftId: madrugada.id,
          name: "Madrugada",
          startsAt: "05:00",
          endsAt: "07:00",
        },
      ]);
      expect(byName.get("Madrugada")?.overlaps).toEqual([
        {
          shiftId: noite.id,
          name: "Noite",
          startsAt: "22:00",
          endsAt: "06:00",
        },
      ]);
      expect(byName.get("Dia")?.overlaps).toEqual([]);
    });

    it("turnos que só se encostam não geram aviso", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, {
        sectorId: uld.id,
        startsAt: "06:00",
        endsAt: "14:00",
      });
      await insertShift(db, {
        sectorId: uld.id,
        startsAt: "14:00",
        endsAt: "22:00",
      });
      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      expect(page.rows.every((row) => row.overlaps.length === 0)).toBe(true);
    });

    it("canMoveUp/canMoveDown valem para a lista inteira, não para a página", async () => {
      const uld = await insertSector(db, "ULD");
      for (let n = 1; n <= PAGE_SIZE + 2; n += 1) {
        await insertShift(db, {
          sectorId: uld.id,
          name: `T${String(n).padStart(3, "0")}`,
          startsAt: "06:00",
          endsAt: "07:00",
        });
      }

      const first = await listShifts(db, { sectorId: uld.id, page: 1 });
      const second = await listShifts(db, { sectorId: uld.id, page: 2 });

      expect(first.rows).toHaveLength(PAGE_SIZE);
      expect(second.rows).toHaveLength(2);
      expect(first.pageCount).toBe(2);
      expect(first.rows[0]).toMatchObject({
        canMoveUp: false,
        canMoveDown: true,
      });
      expect(first.rows.at(-1)).toMatchObject({
        canMoveUp: true,
        canMoveDown: true,
      });
      expect(second.rows[0]).toMatchObject({
        canMoveUp: true,
        canMoveDown: true,
      });
      expect(second.rows.at(-1)).toMatchObject({
        canMoveUp: true,
        canMoveDown: false,
      });
    });

    it("turno único não sobe nem desce", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, { sectorId: uld.id });
      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      expect(page.rows[0]).toMatchObject({
        canMoveUp: false,
        canMoveDown: false,
      });
    });

    it("página além do fim é clampada para a última", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, { sectorId: uld.id });
      const page = await listShifts(db, { sectorId: uld.id, page: 99 });
      expect(page.page).toBe(1);
      expect(page.rows).toHaveLength(1);
    });
  });

  describe("getShiftFormDefaults", () => {
    it("setor sem turnos: Turno 1, 06:00–14:00", async () => {
      const uld = await insertSector(db, "ULD");
      expect(await getShiftFormDefaults(db, uld.id)).toEqual({
        name: "Turno 1",
        startsAt: "06:00",
        endsAt: "14:00",
      });
    });

    it("começa no fim do último turno ativo e dura 8 horas", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, {
        sectorId: uld.id,
        startsAt: "06:00",
        endsAt: "14:00",
      });
      await insertShift(db, {
        sectorId: uld.id,
        startsAt: "14:00",
        endsAt: "22:00",
      });
      expect(await getShiftFormDefaults(db, uld.id)).toEqual({
        name: "Turno 3",
        startsAt: "22:00",
        endsAt: "06:00",
      });
    });

    it("ignora turno inativo no horário, mas não no nome", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, {
        sectorId: uld.id,
        startsAt: "06:00",
        endsAt: "14:00",
      });
      await insertShift(db, {
        sectorId: uld.id,
        name: "Turno 2",
        startsAt: "14:00",
        endsAt: "22:00",
        active: false,
      });
      expect(await getShiftFormDefaults(db, uld.id)).toEqual({
        name: "Turno 3",
        startsAt: "14:00",
        endsAt: "22:00",
      });
    });

    it("pula um nome sugerido que já existe", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, { sectorId: uld.id, name: "Manhã" });
      await insertShift(db, { sectorId: uld.id, name: "TURNO 2" });
      expect((await getShiftFormDefaults(db, uld.id)).name).toBe("Turno 3");
    });
  });

  describe("createShift", () => {
    it("cria no fim da ordem e devolve id e warnings vazios", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, { sectorId: uld.id, name: "Manhã" });

      const result = await createShift(db, {
        sectorId: uld.id,
        name: "Tarde",
        startsAt: "14:00",
        endsAt: "22:00",
      });

      expect(result).toMatchObject({ ok: true, warnings: [] });
      expect(await orderOf(uld.id)).toEqual(["Manhã", "Tarde"]);
    });

    it("o primeiro turno do setor recebe sortOrder 1; a ordem é por setor", async () => {
      const uld = await insertSector(db, "ULD");
      const other = await insertSector(db, "Outro");
      await insertShift(db, { sectorId: other.id, sortOrder: 7 });
      await createShift(db, {
        sectorId: uld.id,
        name: "A",
        startsAt: "06:00",
        endsAt: "07:00",
      });
      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      expect(page.rows[0]?.sortOrder).toBe(1);
    });

    it("grava turno que atravessa a meia-noite", async () => {
      const uld = await insertSector(db, "ULD");
      await createShift(db, {
        sectorId: uld.id,
        name: "Noite",
        startsAt: "22:00",
        endsAt: "06:00",
      });
      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      expect(page.rows[0]).toMatchObject({
        startsAt: "22:00",
        endsAt: "06:00",
        crossesMidnight: true,
      });
    });

    it("avisa a sobreposição com turno ativo, sem bloquear", async () => {
      const uld = await insertSector(db, "ULD");
      const manha = await insertShift(db, {
        sectorId: uld.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      await insertShift(db, {
        sectorId: uld.id,
        name: "Antigo",
        startsAt: "10:00",
        endsAt: "12:00",
        active: false,
      });

      const result = await createShift(db, {
        sectorId: uld.id,
        name: "Extra",
        startsAt: "13:00",
        endsAt: "15:00",
      });

      expect(result).toMatchObject({ ok: true });
      if (!result.ok) return;
      expect(result.warnings).toEqual([
        {
          shiftId: manha.id,
          name: "Manhã",
          startsAt: "06:00",
          endsAt: "14:00",
        },
      ]);
    });

    it("avisa sobreposição que só existe por causa da meia-noite", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, {
        sectorId: uld.id,
        name: "Noite",
        startsAt: "23:00",
        endsAt: "01:00",
      });
      const result = await createShift(db, {
        sectorId: uld.id,
        name: "Virada",
        startsAt: "00:00",
        endsAt: "02:00",
      });
      expect(result.ok && result.warnings.map((w) => w.name)).toEqual([
        "Noite",
      ]);
    });

    it("normaliza o nome (espaços e Unicode)", async () => {
      const uld = await insertSector(db, "ULD");
      await createShift(db, {
        sectorId: uld.id,
        name: "  Turno   Manhã ",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      expect(await orderOf(uld.id)).toEqual(["Turno Manhã"]);
    });

    it("início igual ao fim vira INVALID_INPUT no campo endsAt", async () => {
      const uld = await insertSector(db, "ULD");
      const result = await createShift(db, {
        sectorId: uld.id,
        name: "X",
        startsAt: "06:00",
        endsAt: "06:00",
      });
      expect(result).toEqual({
        ok: false,
        code: "INVALID_INPUT",
        message: "O início e o fim não podem ser iguais.",
        fieldErrors: { endsAt: "O início e o fim não podem ser iguais." },
      });
    });

    it.each([
      ["24:00"],
      ["6:00"],
      ["06:00:30"],
      [""],
    ])("horário inválido %j vira INVALID_INPUT", async (bad) => {
      const uld = await insertSector(db, "ULD");
      const result = await createShift(db, {
        sectorId: uld.id,
        name: "X",
        startsAt: bad,
        endsAt: "14:00",
      });
      expect(result).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { startsAt: "Informe um horário válido, como 06:00." },
      });
    });

    it("nome vazio e nome longo viram INVALID_INPUT no campo name", async () => {
      const uld = await insertSector(db, "ULD");
      const empty = await createShift(db, {
        sectorId: uld.id,
        name: "   ",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      const long = await createShift(db, {
        sectorId: uld.id,
        name: "x".repeat(61),
        startsAt: "06:00",
        endsAt: "14:00",
      });
      expect(empty).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { name: "Informe o nome." },
      });
      expect(long).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { name: "O nome pode ter no máximo 60 caracteres." },
      });
    });

    it("setor inexistente é NOT_FOUND", async () => {
      const result = await createShift(db, {
        sectorId: NIL_ID,
        name: "X",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      expect(result).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
        message: "Setor não encontrado. Atualize a página.",
      });
    });

    it("setor inativo é SECTOR_INACTIVE e nada é gravado", async () => {
      const off = await insertSector(db, "Parado", { active: false });
      const result = await createShift(db, {
        sectorId: off.id,
        name: "X",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      expect(result).toMatchObject({
        ok: false,
        code: "SECTOR_INACTIVE",
        message: "Este setor está inativo. Reative-o para cadastrar turnos.",
      });
      expect((await listShifts(db, { sectorId: off.id, page: 1 })).total).toBe(
        0,
      );
    });

    it("nome repetido no setor (outra caixa) é NAME_TAKEN", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, { sectorId: uld.id, name: "Água" });
      const result = await createShift(db, {
        sectorId: uld.id,
        name: "ÁGUA",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      expect(result).toEqual({
        ok: false,
        code: "NAME_TAKEN",
        message: "Já existe um turno com este nome neste setor.",
        fieldErrors: { name: "Já existe um turno com este nome neste setor." },
      });
    });

    it("avisa quando o nome repetido é de um turno inativo", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, { sectorId: uld.id, name: "Manhã", active: false });
      const result = await createShift(db, {
        sectorId: uld.id,
        name: "manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      expect(result).toMatchObject({
        ok: false,
        code: "NAME_TAKEN",
        message:
          "Já existe um turno com este nome neste setor. Ele está inativo: reative-o na lista.",
      });
    });

    it("o mesmo nome em outro setor passa", async () => {
      const uld = await insertSector(db, "ULD");
      const other = await insertSector(db, "Outro");
      await insertShift(db, { sectorId: other.id, name: "Manhã" });
      const result = await createShift(db, {
        sectorId: uld.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      expect(result.ok).toBe(true);
    });
  });

  describe("updateShift", () => {
    it("altera nome e horários e não avisa de si mesmo", async () => {
      const uld = await insertSector(db, "ULD");
      const manha = await insertShift(db, {
        sectorId: uld.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      });

      const result = await updateShift(db, {
        id: manha.id,
        name: "Manhã longa",
        startsAt: "06:00",
        endsAt: "15:00",
      });

      expect(result).toEqual({ ok: true, warnings: [] });
      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      expect(page.rows[0]).toMatchObject({
        name: "Manhã longa",
        endsAt: "15:00",
      });
    });

    it("avisa sobreposição criada pela edição", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, {
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

      const result = await updateShift(db, {
        id: tarde.id,
        name: "Tarde",
        startsAt: "13:00",
        endsAt: "22:00",
      });

      expect(result.ok && result.warnings.map((w) => w.name)).toEqual([
        "Manhã",
      ]);
    });

    it("editar um turno inativo não avisa", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, {
        sectorId: uld.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      const antigo = await insertShift(db, {
        sectorId: uld.id,
        name: "Antigo",
        startsAt: "07:00",
        endsAt: "09:00",
        active: false,
      });
      const result = await updateShift(db, {
        id: antigo.id,
        name: "Antigo",
        startsAt: "07:00",
        endsAt: "10:00",
      });
      expect(result).toEqual({ ok: true, warnings: [] });
    });

    it("trocar só a caixa do próprio nome é permitido", async () => {
      const uld = await insertSector(db, "ULD");
      const manha = await insertShift(db, { sectorId: uld.id, name: "manhã" });
      const result = await updateShift(db, {
        id: manha.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      expect(result.ok).toBe(true);
    });

    it("nome de outro turno do setor é NAME_TAKEN", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, { sectorId: uld.id, name: "Manhã" });
      const tarde = await insertShift(db, { sectorId: uld.id, name: "Tarde" });
      const result = await updateShift(db, {
        id: tarde.id,
        name: "MANHÃ",
        startsAt: "14:00",
        endsAt: "22:00",
      });
      expect(result).toMatchObject({ ok: false, code: "NAME_TAKEN" });
    });

    it("id inexistente é NOT_FOUND", async () => {
      const result = await updateShift(db, {
        id: NIL_ID,
        name: "X",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      expect(result).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
        message: "Turno não encontrado. Atualize a página.",
      });
    });

    it("início igual ao fim é recusado e o turno não muda", async () => {
      const uld = await insertSector(db, "ULD");
      const manha = await insertShift(db, {
        sectorId: uld.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      const result = await updateShift(db, {
        id: manha.id,
        name: "Manhã",
        startsAt: "08:00",
        endsAt: "08:00",
      });
      expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      expect(page.rows[0]).toMatchObject({
        startsAt: "06:00",
        endsAt: "14:00",
      });
    });
  });

  describe("setShiftActive", () => {
    it("desativar e reativar; reativar avisa a sobreposição", async () => {
      const uld = await insertSector(db, "ULD");
      const manha = await insertShift(db, {
        sectorId: uld.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      });
      await insertShift(db, {
        sectorId: uld.id,
        name: "Extra",
        startsAt: "10:00",
        endsAt: "12:00",
      });

      expect(await setShiftActive(db, { id: manha.id, active: false })).toEqual(
        { ok: true, warnings: [] },
      );
      const reactivated = await setShiftActive(db, {
        id: manha.id,
        active: true,
      });

      expect(reactivated.ok && reactivated.warnings.map((w) => w.name)).toEqual(
        ["Extra"],
      );
    });

    it("é idempotente: desativar de novo é sucesso sem mudança", async () => {
      const uld = await insertSector(db, "ULD");
      const manha = await insertShift(db, { sectorId: uld.id, active: false });
      expect(await setShiftActive(db, { id: manha.id, active: false })).toEqual(
        { ok: true, warnings: [] },
      );
    });

    it("id inexistente é NOT_FOUND", async () => {
      expect(
        await setShiftActive(db, { id: NIL_ID, active: true }),
      ).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
      });
    });
  });

  describe("moveShift", () => {
    async function seed(names: string[]) {
      const uld = await insertSector(db, "ULD");
      const ids: string[] = [];
      for (const name of names) {
        ids.push((await insertShift(db, { sectorId: uld.id, name })).id);
      }
      return { sectorId: uld.id, ids };
    }

    it("sobe e desce trocando com o vizinho", async () => {
      const { sectorId, ids } = await seed(["A", "B", "C"]);
      await moveShift(db, { id: must(ids[2]), direction: "up" });
      expect(await orderOf(sectorId)).toEqual(["A", "C", "B"]);
      await moveShift(db, { id: must(ids[0]), direction: "down" });
      expect(await orderOf(sectorId)).toEqual(["C", "A", "B"]);
    });

    it("no topo ou no fim é sucesso sem mudança", async () => {
      const { sectorId, ids } = await seed(["A", "B"]);
      expect(
        await moveShift(db, { id: must(ids[0]), direction: "up" }),
      ).toEqual({ ok: true });
      expect(
        await moveShift(db, { id: must(ids[1]), direction: "down" }),
      ).toEqual({ ok: true });
      expect(await orderOf(sectorId)).toEqual(["A", "B"]);
    });

    it("com sortOrder duplicado renumera 1..n e move", async () => {
      const uld = await insertSector(db, "ULD");
      await insertShift(db, {
        sectorId: uld.id,
        name: "A",
        sortOrder: 1,
      });
      const b = await insertShift(db, {
        sectorId: uld.id,
        name: "B",
        sortOrder: 1,
      });
      await insertShift(db, { sectorId: uld.id, name: "C", sortOrder: 2 });

      await moveShift(db, { id: b.id, direction: "up" });

      const page = await listShifts(db, { sectorId: uld.id, page: 1 });
      expect(page.rows.map((row) => [row.name, row.sortOrder])).toEqual([
        ["B", 1],
        ["A", 2],
        ["C", 3],
      ]);
    });

    it("não mexe na ordem de outro setor", async () => {
      const { ids } = await seed(["A", "B"]);
      const other = await insertSector(db, "Outro");
      await insertShift(db, { sectorId: other.id, name: "X", sortOrder: 5 });
      await insertShift(db, { sectorId: other.id, name: "Y", sortOrder: 9 });
      await moveShift(db, { id: must(ids[1]), direction: "up" });
      const page = await listShifts(db, { sectorId: other.id, page: 1 });
      expect(page.rows.map((row) => [row.name, row.sortOrder])).toEqual([
        ["X", 5],
        ["Y", 9],
      ]);
    });

    it("id inexistente é NOT_FOUND", async () => {
      expect(
        await moveShift(db, { id: NIL_ID, direction: "up" }),
      ).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
        message: "Turno não encontrado. Atualize a página.",
      });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/features/admin/shifts.test.ts`
Expected: FAIL com `Cannot find module './shifts' imported from …/src/features/admin/shifts.test.ts`.

- [ ] **Step 3: Write minimal implementation do domínio**

Crie `src/features/admin/shifts.ts`:

```ts
import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { shift } from "@/db/schema/catalog";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";

import { isUniqueViolation } from "./dbErrors";
import { nameTakenMessage, notFoundMessage } from "./messages";
import { validateName } from "./names";
import {
  CHOICE_LIST_LIMIT,
  PAGE_SIZE,
  type Page,
  resolvePage,
} from "./pagination";
import { moveId, planSortUpdates, type SortDirection } from "./reorder";
import {
  type AdminFailure,
  type AdminResult,
  type FieldErrors,
  fail,
  INVALID_INPUT_MESSAGE,
  ok,
} from "./result";
import {
  crossesMidnight,
  findOverlaps,
  type NamedShiftRange,
  type OverlapWarning,
  suggestShiftName,
  suggestShiftTimes,
} from "./shiftRules";
import {
  fromDbTime,
  parseTimeOfDay,
  TIME_INPUT_PATTERN,
  toDbTime,
} from "./timeOfDay";

export type ShiftRow = {
  id: string;
  sectorId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  crossesMidnight: boolean;
  sortOrder: number;
  active: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  overlaps: OverlapWarning[];
};

export type ShiftFormDefaults = {
  name: string;
  startsAt: string;
  endsAt: string;
};

const SECTOR_INACTIVE_FOR_SHIFTS =
  "Este setor está inativo. Reative-o para cadastrar turnos.";
const TIME_MESSAGE = "Informe um horário válido, como 06:00.";
const SAME_TIME_MESSAGE = "O início e o fim não podem ser iguais.";

const READ_ORDER = [asc(shift.sortOrder), asc(shift.createdAt), asc(shift.id)];

// Turnos ativos do setor, na ordem da lista, já com horário "HH:mm".
async function activeRanges(
  db: Db,
  sectorId: string,
): Promise<NamedShiftRange[]> {
  const rows = await db
    .select({
      id: shift.id,
      name: shift.name,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
    })
    .from(shift)
    .where(and(eq(shift.sectorId, sectorId), eq(shift.active, true)))
    .orderBy(...READ_ORDER)
    .limit(CHOICE_LIST_LIMIT);
  return rows.map((row) => ({
    ...row,
    startsAt: fromDbTime(row.startsAt),
    endsAt: fromDbTime(row.endsAt),
  }));
}

export async function listShifts(
  db: Db,
  input: { sectorId: string; page: number },
): Promise<Page<ShiftRow>> {
  const inSector = eq(shift.sectorId, input.sectorId);
  const [counted] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(shift)
    .where(inSector);
  const total = counted?.total ?? 0;
  const { page, pageCount, offset } = resolvePage(total, input.page);

  const [rows, ranges, firstRow, lastRow] = await Promise.all([
    db
      .select()
      .from(shift)
      .where(inSector)
      .orderBy(...READ_ORDER)
      .limit(PAGE_SIZE)
      .offset(offset),
    activeRanges(db, input.sectorId),
    db
      .select({ id: shift.id })
      .from(shift)
      .where(inSector)
      .orderBy(...READ_ORDER)
      .limit(1),
    db
      .select({ id: shift.id })
      .from(shift)
      .where(inSector)
      .orderBy(desc(shift.sortOrder), desc(shift.createdAt), desc(shift.id))
      .limit(1),
  ]);
  const firstId = firstRow[0]?.id;
  const lastId = lastRow[0]?.id;

  return {
    rows: rows.map((row) => {
      const range = {
        startsAt: fromDbTime(row.startsAt),
        endsAt: fromDbTime(row.endsAt),
      };
      return {
        id: row.id,
        sectorId: row.sectorId,
        name: row.name,
        ...range,
        crossesMidnight: crossesMidnight(range),
        sortOrder: row.sortOrder,
        active: row.active,
        canMoveUp: row.id !== firstId,
        canMoveDown: row.id !== lastId,
        overlaps: row.active
          ? findOverlaps({ id: row.id, ...range }, ranges)
          : [],
      };
    }),
    total,
    page,
    pageCount,
    pageSize: PAGE_SIZE,
  };
}

export async function getShiftFormDefaults(
  db: Db,
  sectorId: string,
): Promise<ShiftFormDefaults> {
  const [ranges, names] = await Promise.all([
    activeRanges(db, sectorId),
    db
      .select({ name: shift.name })
      .from(shift)
      .where(eq(shift.sectorId, sectorId))
      .limit(CHOICE_LIST_LIMIT),
  ]);
  const times = suggestShiftTimes(ranges);
  return {
    name: suggestShiftName(names.map((row) => row.name)),
    ...times,
  };
}

type ShiftFields = { name: string; startsAt: string; endsAt: string };

function minutesOrNull(value: string): number | null {
  return TIME_INPUT_PATTERN.test(value) ? parseTimeOfDay(value) : null;
}

// O domínio revalida o que a tela já validou: nunca confia no cliente.
function validateFields(
  input: ShiftFields,
):
  | { ok: true; name: string }
  | { ok: false; message: string; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};
  const name = validateName(input.name);
  if (!name.ok) fieldErrors.name = name.message;
  const start = minutesOrNull(input.startsAt);
  const end = minutesOrNull(input.endsAt);
  if (start === null) fieldErrors.startsAt = TIME_MESSAGE;
  if (end === null) fieldErrors.endsAt = TIME_MESSAGE;
  else if (start === end) fieldErrors.endsAt = SAME_TIME_MESSAGE;
  if (name.ok && Object.keys(fieldErrors).length === 0) {
    return { ok: true, name: name.name };
  }
  return {
    ok: false,
    message: Object.values(fieldErrors)[0] ?? INVALID_INPUT_MESSAGE,
    fieldErrors,
  };
}

async function nameTakenFailure(
  db: Db,
  sectorId: string,
  name: string,
): Promise<AdminFailure> {
  const [existing] = await db
    .select({ active: shift.active })
    .from(shift)
    .where(
      and(
        eq(shift.sectorId, sectorId),
        sql`lower(${shift.name}) = lower(${name})`,
      ),
    )
    .limit(1);
  const message = nameTakenMessage("turno", existing?.active === false);
  return fail("NAME_TAKEN", message, { name: message });
}

export async function createShift(
  db: Db,
  input: { sectorId: string; name: string; startsAt: string; endsAt: string },
): Promise<AdminResult<{ id: string; warnings: OverlapWarning[] }>> {
  const checked = validateFields(input);
  if (!checked.ok) {
    return fail("INVALID_INPUT", checked.message, checked.fieldErrors);
  }
  try {
    // Leitura do setor e INSERT na mesma transação: o FOR SHARE segura o setor
    // até o INSERT e serializa com o FOR UPDATE de setSectorActive (F2-23).
    return await db.transaction(async (tx) => {
      const [owner] = await tx
        .select({ active: sector.active })
        .from(sector)
        .where(eq(sector.id, input.sectorId))
        .for("share");
      if (!owner) return fail("NOT_FOUND", notFoundMessage("setor"));
      if (!owner.active) {
        return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_FOR_SHIFTS);
      }
      const [created] = await tx
        .insert(shift)
        .values({
          sectorId: input.sectorId,
          name: checked.name,
          startsAt: toDbTime(input.startsAt),
          endsAt: toDbTime(input.endsAt),
          sortOrder: sql`(select coalesce(max(${shift.sortOrder}), 0) + 1 from ${shift} where ${shift.sectorId} = ${input.sectorId})`,
        })
        .returning({ id: shift.id });
      if (!created) throw new Error("Falha ao criar o turno.");
      const warnings = findOverlaps(
        { id: created.id, startsAt: input.startsAt, endsAt: input.endsAt },
        await activeRanges(tx, input.sectorId),
      );
      return ok({ id: created.id, warnings });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return nameTakenFailure(db, input.sectorId, checked.name);
    }
    throw error;
  }
}

export async function updateShift(
  db: Db,
  input: { id: string; name: string; startsAt: string; endsAt: string },
): Promise<AdminResult<{ warnings: OverlapWarning[] }>> {
  const checked = validateFields(input);
  if (!checked.ok) {
    return fail("INVALID_INPUT", checked.message, checked.fieldErrors);
  }
  const [current] = await db
    .select({ sectorId: shift.sectorId, active: shift.active })
    .from(shift)
    .where(eq(shift.id, input.id));
  if (!current) return fail("NOT_FOUND", notFoundMessage("turno"));

  try {
    await db
      .update(shift)
      .set({
        name: checked.name,
        startsAt: toDbTime(input.startsAt),
        endsAt: toDbTime(input.endsAt),
      })
      .where(eq(shift.id, input.id));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return nameTakenFailure(db, current.sectorId, checked.name);
    }
    throw error;
  }
  if (!current.active) return ok({ warnings: [] });
  const warnings = findOverlaps(
    { id: input.id, startsAt: input.startsAt, endsAt: input.endsAt },
    await activeRanges(db, current.sectorId),
  );
  return ok({ warnings });
}

export async function setShiftActive(
  db: Db,
  input: { id: string; active: boolean },
): Promise<AdminResult<{ warnings: OverlapWarning[] }>> {
  const [updated] = await db
    .update(shift)
    .set({ active: input.active })
    .where(eq(shift.id, input.id))
    .returning({
      sectorId: shift.sectorId,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
    });
  if (!updated) return fail("NOT_FOUND", notFoundMessage("turno"));
  if (!input.active) return ok({ warnings: [] });
  const warnings = findOverlaps(
    {
      id: input.id,
      startsAt: fromDbTime(updated.startsAt),
      endsAt: fromDbTime(updated.endsAt),
    },
    await activeRanges(db, updated.sectorId),
  );
  return ok({ warnings });
}

export async function moveShift(
  db: Db,
  input: { id: string; direction: SortDirection },
): Promise<AdminResult> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ sectorId: shift.sectorId })
      .from(shift)
      .where(eq(shift.id, input.id));
    if (!target) return fail("NOT_FOUND", notFoundMessage("turno"));

    // FOR UPDATE serializa dois cliques seguidos (ou duas abas) no mesmo setor.
    const rows = await tx
      .select({ id: shift.id, sortOrder: shift.sortOrder })
      .from(shift)
      .where(eq(shift.sectorId, target.sectorId))
      .orderBy(...READ_ORDER)
      .for("update");
    const next = moveId(
      rows.map((row) => row.id),
      input.id,
      input.direction,
    );
    if (next === null) return ok();

    for (const update of planSortUpdates(rows, next)) {
      await tx
        .update(shift)
        .set({ sortOrder: update.sortOrder })
        .where(eq(shift.id, update.id));
    }
    return ok();
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- src/features/admin/shifts.test.ts`
Expected: PASS (44 testes)

- [ ] **Step 5: Write the failing test das actions**

Crie `src/app/(app)/admin/turnos/actions.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { db } from "@/db";
import { listShifts } from "@/features/admin/shifts";
import { authzOf } from "../../../../../test/authz";
import { resetDb } from "../../../../../test/db";
import { insertSector, insertShift } from "../../../../../test/fixtures";
import {
  createShiftAction,
  moveShiftAction,
  setShiftActiveAction,
  updateShiftAction,
} from "./actions";

const mocks = vi.hoisted(
  (): {
    requireAdmin: Mock;
    revalidatePath: Mock;
    client: PGlite | undefined;
  } => ({
    requireAdmin: vi.fn(),
    revalidatePath: vi.fn(),
    client: undefined,
  }),
);

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});

const NOT_FOUND = new Error("NEXT_HTTP_ERROR_FALLBACK;404");

describe("actions de turnos", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireAdmin.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.requireAdmin.mockResolvedValue(authzOf({ role: "admin" }));
  });

  describe("operador (permissão negada)", () => {
    beforeEach(() => {
      mocks.requireAdmin.mockRejectedValue(NOT_FOUND);
    });

    it("nenhuma action toca o banco nem revalida", async () => {
      const sector = await insertSector(db, "ULD");
      const shiftId = (await insertShift(db, { sectorId: sector.id })).id;
      const valid = {
        sectorId: sector.id,
        name: "Intruso",
        startsAt: "06:00",
        endsAt: "14:00",
      };

      await expect(createShiftAction(valid)).rejects.toBe(NOT_FOUND);
      await expect(updateShiftAction({ ...valid, id: shiftId })).rejects.toBe(
        NOT_FOUND,
      );
      await expect(
        setShiftActiveAction({ id: shiftId, active: false }),
      ).rejects.toBe(NOT_FOUND);
      await expect(
        moveShiftAction({ id: shiftId, direction: "down" }),
      ).rejects.toBe(NOT_FOUND);

      const page = await listShifts(db, { sectorId: sector.id, page: 1 });
      expect(page.rows.map((row) => [row.name, row.active])).toEqual([
        [expect.any(String), true],
      ]);
      expect(page.rows[0]?.name).not.toBe("Intruso");
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
  });

  it("createShiftAction cria, devolve os avisos e revalida /admin", async () => {
    const sector = await insertSector(db, "ULD");
    await insertShift(db, {
      sectorId: sector.id,
      name: "Manhã",
      startsAt: "06:00",
      endsAt: "14:00",
    });

    const result = await createShiftAction({
      sectorId: sector.id,
      name: "  Extra ",
      startsAt: "13:00",
      endsAt: "15:00",
    });

    expect(result).toMatchObject({ ok: true });
    expect(result.ok && result.warnings).toHaveLength(1);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
    const page = await listShifts(db, { sectorId: sector.id, page: 1 });
    expect(page.rows.map((row) => row.name)).toEqual(["Manhã", "Extra"]);
  });

  it("entrada inválida volta INVALID_INPUT sem gravar nem revalidar", async () => {
    const sector = await insertSector(db, "ULD");

    const result = await createShiftAction({
      sectorId: sector.id,
      name: "X",
      startsAt: "06:00",
      endsAt: "06:00",
    });

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "O início e o fim não podem ser iguais.",
      fieldErrors: { endsAt: "O início e o fim não podem ser iguais." },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect((await listShifts(db, { sectorId: sector.id, page: 1 })).total).toBe(
      0,
    );
  });

  it("id malformado volta INVALID_INPUT", async () => {
    const result = await setShiftActiveAction({
      id: "nao-e-uuid",
      active: true,
    });
    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Registro inválido. Atualize a página.",
    });
  });

  it("falha de domínio é repassada e não revalida", async () => {
    const off = await insertSector(db, "Parado", { active: false });

    const result = await createShiftAction({
      sectorId: off.id,
      name: "X",
      startsAt: "06:00",
      endsAt: "14:00",
    });

    expect(result).toMatchObject({ ok: false, code: "SECTOR_INACTIVE" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("updateShiftAction, setShiftActiveAction e moveShiftAction funcionam", async () => {
    const sector = await insertSector(db, "ULD");
    const a = await insertShift(db, { sectorId: sector.id, name: "A" });
    const b = await insertShift(db, { sectorId: sector.id, name: "B" });

    expect(
      await updateShiftAction({
        id: a.id,
        name: "A2",
        startsAt: "06:00",
        endsAt: "07:00",
      }),
    ).toMatchObject({ ok: true });
    expect(
      await setShiftActiveAction({ id: b.id, active: false }),
    ).toMatchObject({ ok: true });
    expect(await moveShiftAction({ id: b.id, direction: "up" })).toMatchObject({
      ok: true,
    });

    const page = await listShifts(db, { sectorId: sector.id, page: 1 });
    expect(page.rows.map((row) => [row.name, row.active])).toEqual([
      ["B", false],
      ["A2", true],
    ]);
  });

  it("setor inexistente volta NOT_FOUND (erro esperado, não INTERNAL)", async () => {
    const result = await createShiftAction({
      sectorId: "00000000-0000-4000-8000-000000000000",
      name: "X",
      startsAt: "06:00",
      endsAt: "14:00",
    });
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bun run test -- "src/app/(app)/admin/turnos/actions.test.ts"`
Expected: FAIL com `Cannot find module './actions' imported from …/src/app/(app)/admin/turnos/actions.test.ts`.

- [ ] **Step 7: Write minimal implementation das actions**

Crie `src/app/(app)/admin/turnos/actions.ts`:

```ts
"use server";

import type { AdminResult } from "@/features/admin/result";
import { runAdminAction } from "@/features/admin/runAdminAction";
import {
  createShiftSchema,
  moveSchema,
  setActiveSchema,
  updateShiftSchema,
} from "@/features/admin/schemas";
import type { OverlapWarning } from "@/features/admin/shiftRules";
import {
  createShift,
  moveShift,
  setShiftActive,
  updateShift,
} from "@/features/admin/shifts";
import { requireAdmin } from "@/lib/auth/session";

export async function createShiftAction(
  input: unknown,
): Promise<AdminResult<{ id: string; warnings: OverlapWarning[] }>> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: createShiftSchema,
    input,
    run: ({ db, input: data }) => createShift(db, data),
  });
}

export async function updateShiftAction(
  input: unknown,
): Promise<AdminResult<{ warnings: OverlapWarning[] }>> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: updateShiftSchema,
    input,
    run: ({ db, input: data }) => updateShift(db, data),
  });
}

export async function setShiftActiveAction(
  input: unknown,
): Promise<AdminResult<{ warnings: OverlapWarning[] }>> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: setActiveSchema,
    input,
    run: ({ db, input: data }) => setShiftActive(db, data),
  });
}

export async function moveShiftAction(input: unknown): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: moveSchema,
    input,
    run: ({ db, input: data }) => moveShift(db, data),
  });
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun run test -- "src/app/(app)/admin/turnos/actions.test.ts"`
Expected: PASS (7 testes)

- [ ] **Step 9: Write the failing test do ShiftForm**

Crie `src/components/admin/shifts/ShiftForm.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ShiftForm } from "./ShiftForm";

const SECTOR_ID = "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b";
const SHIFT_ID = "7a2e3b4c-5d6e-4f70-8b9c-1d2e3f4a5b6c";

const mocks = vi.hoisted(() => ({
  createShiftAction: vi.fn(),
  updateShiftAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/turnos/actions", () => ({
  createShiftAction: mocks.createShiftAction,
  updateShiftAction: mocks.updateShiftAction,
}));
vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    warning: mocks.toastWarning,
    error: mocks.toastError,
  },
}));

const DEFAULTS = { name: "Turno 2", startsAt: "14:00", endsAt: "22:00" };

function setup(props: Partial<ComponentProps<typeof ShiftForm>> = {}) {
  const onDone = vi.fn();
  render(
    <ShiftForm
      sectorId={SECTOR_ID}
      initial={DEFAULTS}
      submitLabel="Criar turno"
      onDone={onDone}
      {...props}
    />,
  );
  return { onDone };
}

const nameField = () => screen.getByLabelText("Nome do turno");
const startField = () => screen.getByLabelText("Início");
const endField = () => screen.getByLabelText("Fim");
const submit = () => screen.getByRole("button", { name: "Criar turno" });

describe("ShiftForm", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("nunca começa em branco: traz nome, início e fim sugeridos", () => {
    setup();
    expect(nameField()).toHaveValue("Turno 2");
    expect(startField()).toHaveValue("14:00");
    expect(endField()).toHaveValue("22:00");
    expect(
      screen.getByText("Fim menor que o início atravessa a meia-noite."),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Atravessa a meia-noite."),
    ).not.toBeInTheDocument();
  });

  it("mostra a dica ao vivo quando o fim é menor que o início", () => {
    setup();
    fireEvent.change(startField(), { target: { value: "22:00" } });
    fireEvent.change(endField(), { target: { value: "06:00" } });
    expect(screen.getByText("Atravessa a meia-noite.")).toBeInTheDocument();
    fireEvent.change(endField(), { target: { value: "23:00" } });
    expect(
      screen.queryByText("Atravessa a meia-noite."),
    ).not.toBeInTheDocument();
  });

  it("criar: chama a action com os valores, avisa e entrega onDone", async () => {
    mocks.createShiftAction.mockResolvedValue({
      ok: true,
      id: "x",
      warnings: [],
    });
    const { onDone } = setup();

    await userEvent.clear(nameField());
    await userEvent.type(nameField(), "Tarde longa");
    await userEvent.click(submit());

    await waitFor(() =>
      expect(mocks.createShiftAction).toHaveBeenCalledWith({
        sectorId: SECTOR_ID,
        name: "Tarde longa",
        startsAt: "14:00",
        endsAt: "22:00",
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Turno criado.");
    expect(mocks.toastWarning).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("mostra um toast de aviso por sobreposição, no máximo três", async () => {
    const warnings = ["A", "B", "C", "D"].map((name) => ({
      shiftId: `id-${name}`,
      name,
      startsAt: "06:00",
      endsAt: "14:00",
    }));
    mocks.createShiftAction.mockResolvedValue({ ok: true, id: "x", warnings });
    setup();

    await userEvent.click(submit());

    await waitFor(() => expect(mocks.toastWarning).toHaveBeenCalledTimes(3));
    expect(mocks.toastWarning).toHaveBeenNthCalledWith(
      1,
      "Sobrepõe o turno A (06:00–14:00)",
    );
  });

  it("nome vazio: erro no campo, sem chamar a action", async () => {
    setup();
    await userEvent.clear(nameField());
    await userEvent.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Informe o nome.",
    );
    expect(nameField()).toHaveAttribute("aria-invalid", "true");
    expect(mocks.createShiftAction).not.toHaveBeenCalled();
  });

  it("início igual ao fim: erro no campo Fim, sem chamar a action", async () => {
    setup();
    fireEvent.change(endField(), { target: { value: "14:00" } });
    await userEvent.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O início e o fim não podem ser iguais.",
    );
    expect(endField()).toHaveAttribute("aria-invalid", "true");
    expect(mocks.createShiftAction).not.toHaveBeenCalled();
  });

  it("horário apagado: erro no campo Início", async () => {
    setup();
    fireEvent.change(startField(), { target: { value: "" } });
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Informe um horário válido, como 06:00.",
    );
    expect(mocks.createShiftAction).not.toHaveBeenCalled();
  });

  it("recusa do servidor: mostra o erro no campo e preserva o digitado", async () => {
    mocks.createShiftAction.mockResolvedValue({
      ok: false,
      code: "NAME_TAKEN",
      message: "Já existe um turno com este nome neste setor.",
      fieldErrors: { name: "Já existe um turno com este nome neste setor." },
    });
    const { onDone } = setup();
    await userEvent.clear(nameField());
    await userEvent.type(nameField(), "Manhã");
    await userEvent.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe um turno com este nome neste setor.",
    );
    expect(nameField()).toHaveValue("Manhã");
    expect(onDone).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("erro sem campo (setor inativo) aparece no formulário", async () => {
    mocks.createShiftAction.mockResolvedValue({
      ok: false,
      code: "SECTOR_INACTIVE",
      message: "Este setor está inativo. Reative-o para cadastrar turnos.",
    });
    setup();
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este setor está inativo. Reative-o para cadastrar turnos.",
    );
  });

  it("falha de rede vira a mensagem genérica no formulário", async () => {
    mocks.createShiftAction.mockRejectedValue(new Error("fetch failed"));
    setup();
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir. Tente de novo.",
    );
    expect(screen.queryByText("fetch failed")).not.toBeInTheDocument();
  });

  it("trava o botão enquanto a action está em andamento", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.createShiftAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    setup();
    await userEvent.click(submit());
    expect(submit()).toBeDisabled();
    finish({ ok: true, id: "x", warnings: [] });
    await waitFor(() => expect(submit()).toBeEnabled());
  });

  it("editar: chama updateShiftAction com o id e avisa 'Alterações salvas.'", async () => {
    mocks.updateShiftAction.mockResolvedValue({ ok: true, warnings: [] });
    const { onDone } = setup({
      initial: { id: SHIFT_ID, ...DEFAULTS },
      submitLabel: "Salvar alterações",
    });

    fireEvent.change(endField(), { target: { value: "23:00" } });
    await userEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    await waitFor(() =>
      expect(mocks.updateShiftAction).toHaveBeenCalledWith({
        id: SHIFT_ID,
        name: "Turno 2",
        startsAt: "14:00",
        endsAt: "23:00",
      }),
    );
    expect(mocks.createShiftAction).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Alterações salvas.");
    expect(onDone).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `bun run test -- src/components/admin/shifts/ShiftForm.test.tsx`
Expected: FAIL com `Failed to resolve import "./ShiftForm" from "src/components/admin/shifts/ShiftForm.test.tsx". Does the file exist?`

- [ ] **Step 11: Write minimal implementation do ShiftForm**

Crie `src/components/admin/shifts/ShiftForm.tsx`:

```tsx
"use client";

import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";

import {
  createShiftAction,
  updateShiftAction,
} from "@/app/(app)/admin/turnos/actions";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { FieldErrors } from "@/features/admin/result";
import {
  createShiftSchema,
  firstFieldErrors,
  updateShiftSchema,
} from "@/features/admin/schemas";
import {
  formatOverlapWarning,
  type OverlapWarning,
} from "@/features/admin/shiftRules";
import type { ShiftFormDefaults } from "@/features/admin/shifts";
import { parseTimeOfDay } from "@/features/admin/timeOfDay";

type ShiftFormProps = {
  sectorId: string;
  initial: ShiftFormDefaults & { id?: string };
  submitLabel: string;
  onDone?: () => void;
};

const MAX_WARNING_TOASTS = 3;

function toastWarnings(warnings: readonly OverlapWarning[]): void {
  for (const warning of warnings.slice(0, MAX_WARNING_TOASTS)) {
    toast.warning(formatOverlapWarning(warning));
  }
}

export function ShiftForm({
  sectorId,
  initial,
  submitLabel,
  onDone,
}: ShiftFormProps) {
  const uid = useId();
  const { pending, run } = useAdminAction();
  const [name, setName] = useState(initial.name);
  const [startsAt, setStartsAt] = useState(initial.startsAt);
  const [endsAt, setEndsAt] = useState(initial.endsAt);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const start = parseTimeOfDay(startsAt);
  const end = parseTimeOfDay(endsAt);
  const crosses = start !== null && end !== null && end < start;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFieldErrors({});
    setFormError(null);

    const values = { name, startsAt, endsAt };
    const parsed = initial.id
      ? updateShiftSchema.safeParse({ id: initial.id, ...values })
      : createShiftSchema.safeParse({ sectorId, ...values });
    if (!parsed.success) {
      setFieldErrors(firstFieldErrors(parsed.error));
      return;
    }

    const result = await run<{ warnings: OverlapWarning[] }>(
      () =>
        initial.id
          ? updateShiftAction({ id: initial.id, ...values })
          : createShiftAction({ sectorId, ...values }),
      { showError: false },
    );
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.fieldErrors ? null : result.message);
      return;
    }
    toast.success(initial.id ? "Alterações salvas." : "Turno criado.");
    toastWarnings(result.warnings);
    onDone?.();
  }

  const errorId = (field: string) => `${uid}-${field}-error`;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={fieldErrors.name ? true : undefined}>
          <FieldLabel htmlFor={`${uid}-name`}>Nome do turno</FieldLabel>
          <Input
            id={`${uid}-name`}
            type="text"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={fieldErrors.name ? true : undefined}
            aria-describedby={fieldErrors.name ? errorId("name") : undefined}
          />
          {fieldErrors.name && (
            <FieldError id={errorId("name")}>{fieldErrors.name}</FieldError>
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={fieldErrors.startsAt ? true : undefined}>
            <FieldLabel htmlFor={`${uid}-startsAt`}>Início</FieldLabel>
            <Input
              id={`${uid}-startsAt`}
              type="time"
              step={60}
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              aria-invalid={fieldErrors.startsAt ? true : undefined}
              aria-describedby={
                fieldErrors.startsAt ? errorId("startsAt") : undefined
              }
            />
            {fieldErrors.startsAt && (
              <FieldError id={errorId("startsAt")}>
                {fieldErrors.startsAt}
              </FieldError>
            )}
          </Field>
          <Field data-invalid={fieldErrors.endsAt ? true : undefined}>
            <FieldLabel htmlFor={`${uid}-endsAt`}>Fim</FieldLabel>
            <Input
              id={`${uid}-endsAt`}
              type="time"
              step={60}
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              aria-invalid={fieldErrors.endsAt ? true : undefined}
              aria-describedby={
                fieldErrors.endsAt ? errorId("endsAt") : undefined
              }
            />
            {fieldErrors.endsAt && (
              <FieldError id={errorId("endsAt")}>
                {fieldErrors.endsAt}
              </FieldError>
            )}
          </Field>
        </div>

        <FieldDescription>
          Fim menor que o início atravessa a meia-noite.
        </FieldDescription>
        {crosses && (
          <output className="text-sm font-medium">
            Atravessa a meia-noite.
          </output>
        )}

        {formError && <FieldError>{formError}</FieldError>}

        <Button type="submit" size="lg" disabled={pending}>
          {submitLabel}
        </Button>
      </FieldGroup>
    </form>
  );
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `bun run test -- src/components/admin/shifts/ShiftForm.test.tsx`
Expected: PASS (12 testes)

- [ ] **Step 13: Write the failing test do ShiftRowActions**

Crie `src/components/admin/shifts/ShiftRowActions.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { ShiftRow } from "@/features/admin/shifts";
import { ShiftRowActions } from "./ShiftRowActions";

const mocks = vi.hoisted(() => ({
  createShiftAction: vi.fn(),
  updateShiftAction: vi.fn(),
  setShiftActiveAction: vi.fn(),
  moveShiftAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastWarning: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/turnos/actions", () => ({
  createShiftAction: mocks.createShiftAction,
  updateShiftAction: mocks.updateShiftAction,
  setShiftActiveAction: mocks.setShiftActiveAction,
  moveShiftAction: mocks.moveShiftAction,
}));
vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
    warning: mocks.toastWarning,
    error: mocks.toastError,
  },
}));

const SHIFT: ShiftRow = {
  id: "7a2e3b4c-5d6e-4f70-8b9c-1d2e3f4a5b6c",
  sectorId: "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b",
  name: "Manhã",
  startsAt: "06:00",
  endsAt: "14:00",
  crossesMidnight: false,
  sortOrder: 2,
  active: true,
  canMoveUp: true,
  canMoveDown: true,
  overlaps: [],
};

function setup(shift: Partial<ShiftRow> = {}) {
  render(
    <TooltipProvider>
      <ShiftRowActions shift={{ ...SHIFT, ...shift }} />
    </TooltipProvider>,
  );
}

describe("ShiftRowActions", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.moveShiftAction.mockResolvedValue({ ok: true });
  });

  it("primeiro da lista não sobe; último não desce", () => {
    setup({ canMoveUp: false });
    expect(screen.getByRole("button", { name: "Subir Manhã" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descer Manhã" })).toBeEnabled();
  });

  it("último da lista não desce", () => {
    setup({ canMoveDown: false });
    expect(screen.getByRole("button", { name: "Subir Manhã" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Descer Manhã" })).toBeDisabled();
  });

  it("mostra o tooltip 'Subir' ao passar o mouse", async () => {
    setup();
    const up = screen.getByRole("button", { name: "Subir Manhã" });
    fireEvent.pointerEnter(up, { pointerType: "mouse" });
    fireEvent.mouseEnter(up);
    fireEvent.pointerMove(up, { pointerType: "mouse" });
    fireEvent.mouseMove(up);
    expect(await screen.findByText("Subir")).toBeInTheDocument();
  });

  it("descer chama a action sem toast de sucesso", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Descer Manhã" }));
    await waitFor(() =>
      expect(mocks.moveShiftAction).toHaveBeenCalledWith({
        id: SHIFT.id,
        direction: "down",
      }),
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("erro ao mover aparece em toast", async () => {
    mocks.moveShiftAction.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Turno não encontrado. Atualize a página.",
    });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Subir Manhã" }));
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Turno não encontrado. Atualize a página.",
      ),
    );
  });

  it("Editar abre o diálogo com o turno preenchido", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Editar Manhã" }));
    const dialog = await screen.findByRole("dialog", { name: "Editar turno" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do turno")).toHaveValue("Manhã");
    expect(screen.getByLabelText("Início")).toHaveValue("06:00");
    expect(screen.getByLabelText("Fim")).toHaveValue("14:00");
    expect(
      screen.getByRole("button", { name: "Salvar alterações" }),
    ).toBeInTheDocument();
  });

  it("salvar a edição chama updateShiftAction e fecha o diálogo", async () => {
    mocks.updateShiftAction.mockResolvedValue({ ok: true, warnings: [] });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Editar Manhã" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Salvar alterações" }),
    );
    await waitFor(() =>
      expect(mocks.updateShiftAction).toHaveBeenCalledWith({
        id: SHIFT.id,
        name: "Manhã",
        startsAt: "06:00",
        endsAt: "14:00",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("Desativar chama a action e avisa 'Turno desativado.'", async () => {
    mocks.setShiftActiveAction.mockResolvedValue({ ok: true, warnings: [] });
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Desativar Manhã" }),
    );
    await waitFor(() =>
      expect(mocks.setShiftActiveAction).toHaveBeenCalledWith({
        id: SHIFT.id,
        active: false,
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Turno desativado.");
  });

  it("Reativar avisa a sobreposição e 'Turno reativado.'", async () => {
    mocks.setShiftActiveAction.mockResolvedValue({
      ok: true,
      warnings: [
        { shiftId: "x", name: "Tarde", startsAt: "12:00", endsAt: "20:00" },
      ],
    });
    setup({ active: false });
    await userEvent.click(
      screen.getByRole("button", { name: "Reativar Manhã" }),
    );
    await waitFor(() =>
      expect(mocks.toastWarning).toHaveBeenCalledWith(
        "Sobrepõe o turno Tarde (12:00–20:00)",
      ),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Turno reativado.");
  });

  it("falha ao desativar mostra o erro e não avisa sucesso", async () => {
    mocks.setShiftActiveAction.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Turno não encontrado. Atualize a página.",
    });
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Desativar Manhã" }),
    );
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 14: Run test to verify it fails**

Run: `bun run test -- src/components/admin/shifts/ShiftRowActions.test.tsx`
Expected: FAIL com `Failed to resolve import "./ShiftRowActions" from "src/components/admin/shifts/ShiftRowActions.test.tsx". Does the file exist?`

- [ ] **Step 15: Write minimal implementation do ShiftRowActions**

Crie `src/components/admin/shifts/ShiftRowActions.tsx`:

```tsx
"use client";

import { toast } from "sonner";

import {
  moveShiftAction,
  setShiftActiveAction,
} from "@/app/(app)/admin/turnos/actions";
import { ActiveToggleButton } from "@/components/admin/ActiveToggleButton";
import { EditDialog } from "@/components/admin/EditDialog";
import { MoveButtons } from "@/components/admin/MoveButtons";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { formatOverlapWarning } from "@/features/admin/shiftRules";
import type { ShiftRow } from "@/features/admin/shifts";

import { ShiftForm } from "./ShiftForm";

type ShiftRowActionsProps = { shift: ShiftRow };

export function ShiftRowActions({ shift }: ShiftRowActionsProps) {
  const { pending, run } = useAdminAction();

  return (
    <>
      <MoveButtons
        label={shift.name}
        canMoveUp={shift.canMoveUp}
        canMoveDown={shift.canMoveDown}
        pending={pending}
        onMove={(direction) =>
          run(() => moveShiftAction({ id: shift.id, direction }))
        }
      />
      <EditDialog title="Editar turno" name={shift.name}>
        {(close) => (
          <ShiftForm
            sectorId={shift.sectorId}
            initial={{
              id: shift.id,
              name: shift.name,
              startsAt: shift.startsAt,
              endsAt: shift.endsAt,
            }}
            submitLabel="Salvar alterações"
            onDone={close}
          />
        )}
      </EditDialog>
      <ActiveToggleButton
        entity="Turno"
        name={shift.name}
        active={shift.active}
        onToggle={async (nextActive) => {
          const result = await setShiftActiveAction({
            id: shift.id,
            active: nextActive,
          });
          if (result.ok) {
            for (const warning of result.warnings.slice(0, 3)) {
              toast.warning(formatOverlapWarning(warning));
            }
          }
          return result;
        }}
      />
    </>
  );
}
```

- [ ] **Step 16: Run test to verify it passes**

Run: `bun run test -- src/components/admin/shifts/ShiftRowActions.test.tsx`
Expected: PASS (10 testes)

- [ ] **Step 17: Write the failing test do ShiftsAdmin**

Crie `src/components/admin/shifts/ShiftsAdmin.test.tsx`:

```tsx
import type { PGlite } from "@electric-sql/pglite";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { db } from "@/db";
import { authzOf } from "../../../../test/authz";
import { resetDb } from "../../../../test/db";
import { insertSector, insertShift } from "../../../../test/fixtures";
import { ShiftsAdmin } from "./ShiftsAdmin";

const NOT_FOUND = new Error("NEXT_HTTP_ERROR_FALLBACK;404");

const mocks = vi.hoisted(
  (): {
    requireAdmin: ReturnType<typeof vi.fn>;
    client: PGlite | undefined;
  } => ({ requireAdmin: vi.fn(), client: undefined }),
);

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});
vi.mock("@/app/(app)/admin/turnos/actions", () => ({
  createShiftAction: vi.fn(),
  updateShiftAction: vi.fn(),
  setShiftActiveAction: vi.fn(),
  moveShiftAction: vi.fn(),
}));

async function renderPage(search: Record<string, string> = {}) {
  render(
    <TooltipProvider>
      {await ShiftsAdmin({ searchParams: Promise.resolve(search) })}
    </TooltipProvider>,
  );
}

describe("ShiftsAdmin", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireAdmin.mockReset();
    mocks.requireAdmin.mockResolvedValue(authzOf({ role: "admin" }));
  });

  it("operador: requireAdmin lança (notFound) e nada é lido", async () => {
    mocks.requireAdmin.mockRejectedValue(NOT_FOUND);
    await expect(
      ShiftsAdmin({ searchParams: Promise.resolve({}) }),
    ).rejects.toBe(NOT_FOUND);
  });

  it("sem setor ativo: título, estado vazio e link para Setores", async () => {
    await insertSector(db, "Parado", { active: false });
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Turnos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nenhum setor ativo.")).toBeInTheDocument();
    expect(
      screen.getByText("Cadastre ou reative um setor para criar turnos."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Setores" }),
    ).toHaveAttribute("href", "/admin/setores");
    expect(screen.queryByLabelText("Nome do turno")).not.toBeInTheDocument();
  });

  it("setor sem turnos: formulário com padrões e estado vazio", async () => {
    await insertSector(db, "ULD");
    await renderPage();

    expect(screen.getByText("Novo turno")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do turno")).toHaveValue("Turno 1");
    expect(screen.getByLabelText("Início")).toHaveValue("06:00");
    expect(screen.getByLabelText("Fim")).toHaveValue("14:00");
    expect(screen.getByText("Nenhum turno neste setor.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Criar turno" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para Administração" }),
    ).toHaveAttribute("href", "/admin");
  });

  it("lista turnos com horário, meia-noite, aviso de sobreposição e inativo", async () => {
    const uld = await insertSector(db, "ULD");
    await insertShift(db, {
      sectorId: uld.id,
      name: "Noite",
      startsAt: "22:00",
      endsAt: "06:00",
    });
    await insertShift(db, {
      sectorId: uld.id,
      name: "Madrugada",
      startsAt: "05:00",
      endsAt: "07:00",
    });
    await insertShift(db, {
      sectorId: uld.id,
      name: "Antigo",
      startsAt: "10:00",
      endsAt: "12:00",
      active: false,
    });
    await renderPage();

    const byName = (name: string): HTMLElement => {
      const row = screen.getByText(name).closest("li");
      if (!row) throw new Error(`linha ${name} ausente`);
      return row;
    };

    expect(
      within(byName("Noite")).getByText("22:00–06:00"),
    ).toBeInTheDocument();
    expect(
      within(byName("Noite")).getByText("Atravessa a meia-noite"),
    ).toBeInTheDocument();
    expect(
      within(byName("Noite")).getByText(
        "Sobrepõe o turno Madrugada (05:00–07:00)",
      ),
    ).toBeInTheDocument();
    expect(
      within(byName("Madrugada")).getByText(
        "Sobrepõe o turno Noite (22:00–06:00)",
      ),
    ).toBeInTheDocument();
    expect(within(byName("Antigo")).getByText("Inativo")).toBeInTheDocument();
    expect(
      within(byName("Antigo")).queryByText(/Sobrepõe/),
    ).not.toBeInTheDocument();
    expect(
      within(byName("Antigo")).getByRole("button", { name: "Reativar Antigo" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do turno")).toHaveValue("Turno 4");
  });

  it("filtro ?setor= mostra só o setor pedido e marca o seletor", async () => {
    const almox = await insertSector(db, "Almoxarifado");
    const uld = await insertSector(db, "ULD");
    await insertShift(db, { sectorId: almox.id, name: "Só do almoxarifado" });
    await insertShift(db, { sectorId: uld.id, name: "Só da ULD" });

    await renderPage({ setor: uld.id });
    expect(screen.getByText("Só da ULD")).toBeInTheDocument();
    expect(screen.queryByText("Só do almoxarifado")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ULD" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("setor inválido ou inativo cai no primeiro setor ativo", async () => {
    const almox = await insertSector(db, "Almoxarifado");
    const off = await insertSector(db, "Parado", { active: false });
    await insertShift(db, { sectorId: almox.id, name: "Do almoxarifado" });
    await insertShift(db, { sectorId: off.id, name: "Do parado" });

    await renderPage({ setor: off.id });
    expect(screen.getByText("Do almoxarifado")).toBeInTheDocument();
    expect(screen.queryByText("Do parado")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Parado" }),
    ).not.toBeInTheDocument();
  });

  it("pagina: a segunda página mostra Anterior e 'Página 2 de 2' mantendo o setor", async () => {
    const uld = await insertSector(db, "ULD");
    for (let n = 1; n <= 51; n += 1) {
      await insertShift(db, {
        sectorId: uld.id,
        name: `T${String(n).padStart(2, "0")}`,
        startsAt: "06:00",
        endsAt: "07:00",
      });
    }
    await renderPage({ setor: uld.id, pagina: "2" });

    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      `/admin/turnos?setor=${uld.id}`,
    );
    expect(screen.getByText("T51")).toBeInTheDocument();
    expect(screen.queryByText("T01")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 18: Run test to verify it fails**

Run: `bun run test -- src/components/admin/shifts/ShiftsAdmin.test.tsx`
Expected: FAIL com `Failed to resolve import "./ShiftsAdmin" from "src/components/admin/shifts/ShiftsAdmin.test.tsx". Does the file exist?`

- [ ] **Step 19: Write minimal implementation do ShiftsAdmin**

Crie `src/components/admin/shifts/ShiftsAdmin.tsx`:

```tsx
import { TriangleAlert } from "lucide-react";

import { AdminListRow } from "@/components/admin/AdminListRow";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";
import { SectorSwitcher } from "@/components/admin/SectorSwitcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import { parsePage } from "@/features/admin/pagination";
import {
  listActiveSectors,
  resolveSectorFilter,
} from "@/features/admin/sectors";
import { formatOverlapWarning } from "@/features/admin/shiftRules";
import { getShiftFormDefaults, listShifts } from "@/features/admin/shifts";
import { requireAdmin } from "@/lib/auth/session";

import { ShiftForm } from "./ShiftForm";
import { ShiftRowActions } from "./ShiftRowActions";

type ShiftsAdminProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const TITLE = "Turnos";
const DESCRIPTION =
  "Horários de cada setor. Um turno pode passar da meia-noite.";

export async function ShiftsAdmin({ searchParams }: ShiftsAdminProps) {
  await requireAdmin();
  const params = await searchParams;
  const sectors = await listActiveSectors(db);
  const selected = resolveSectorFilter(sectors, params.setor);

  if (!selected) {
    return (
      <div className="flex flex-col gap-6">
        <AdminPageHeader
          title={TITLE}
          description={DESCRIPTION}
          backHref="/admin"
        />
        <EmptyState
          title="Nenhum setor ativo."
          description="Cadastre ou reative um setor para criar turnos."
          action={{ label: "Ir para Setores", href: "/admin/setores" }}
        />
      </div>
    );
  }

  const [page, defaults] = await Promise.all([
    listShifts(db, { sectorId: selected.id, page: parsePage(params.pagina) }),
    getShiftFormDefaults(db, selected.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title={TITLE}
        description={DESCRIPTION}
        backHref="/admin"
      />
      <SectorSwitcher
        sectors={sectors}
        selectedId={selected.id}
        pathname="/admin/turnos"
      />

      <Card>
        <CardHeader>
          <CardTitle>Novo turno</CardTitle>
        </CardHeader>
        <CardContent>
          <ShiftForm
            // Novo padrão depois de cada criação: remonta o formulário.
            key={`${selected.id}-${defaults.name}-${defaults.startsAt}-${defaults.endsAt}`}
            sectorId={selected.id}
            initial={defaults}
            submitLabel="Criar turno"
          />
        </CardContent>
      </Card>

      {page.rows.length === 0 ? (
        <EmptyState
          title="Nenhum turno neste setor."
          description="Crie o primeiro turno acima. A passagem de turno usa esses horários."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {page.rows.map((shift) => (
            <AdminListRow
              key={shift.id}
              title={shift.name}
              inactive={!shift.active}
              subtitle={
                <span className="tabular-nums">
                  {shift.startsAt}–{shift.endsAt}
                </span>
              }
              badges={
                shift.crossesMidnight ? (
                  <Badge variant="outline">Atravessa a meia-noite</Badge>
                ) : undefined
              }
              notes={
                shift.overlaps.length > 0 ? (
                  <ul className="flex flex-col gap-1">
                    {shift.overlaps.map((warning) => (
                      <li
                        key={warning.shiftId}
                        className="flex items-center gap-1.5 text-sm text-warning-foreground"
                      >
                        <TriangleAlert aria-hidden="true" className="size-4" />
                        {formatOverlapWarning(warning)}
                      </li>
                    ))}
                  </ul>
                ) : undefined
              }
              actions={<ShiftRowActions shift={shift} />}
            />
          ))}
        </ul>
      )}

      <Pagination
        page={page.page}
        pageCount={page.pageCount}
        pathname="/admin/turnos"
        params={{ setor: selected.id }}
      />
    </div>
  );
}
```

- [ ] **Step 20: Run test to verify it passes**

Run: `bun run test -- src/components/admin/shifts/ShiftsAdmin.test.tsx`
Expected: PASS (7 testes)

Este teste usa o PGlite real (`createTestDb`). O projeto `dom` roda o mesmo `globalSetup` do projeto `node` (Tarefa 5, Step 9), que gera o dump do schema, então o arquivo funciona sozinho, inclusive num clone ou worktree novo.

- [ ] **Step 21: Criar a página `/admin/turnos`**

Crie `src/app/(app)/admin/turnos/page.tsx` (sem `metadata`; `<h1>` dentro do `Suspense`; o guarda `appPagesAuth.test.ts` aceita porque `ShiftsAdmin`, importado de `@/components/...`, chama `requireAdmin()`):

```tsx
import { Suspense } from "react";

import { AdminListSkeleton } from "@/components/admin/AdminListSkeleton";
import { ShiftsAdmin } from "@/components/admin/shifts/ShiftsAdmin";
import { Skeleton } from "@/components/ui/skeleton";

// Sem `metadata` de propósito (o <title> sairia antes do portão) e com o <h1>
// dentro do Suspense: quem não é admin vê "Página não encontrada" e nada mais.
export default function ShiftsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ShiftsAdmin searchParams={searchParams} />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <AdminListSkeleton />
    </div>
  );
}
```

- [ ] **Step 22: Run test do guarda de páginas**

Run: `bun run test -- src/app/appPagesAuth.test.ts`
Expected: PASS (todos os testes do arquivo, incluindo o caso `src/app/(app)/admin/turnos/page.tsx`)

- [ ] **Step 23: Atualizar `.context/ui-registry.md`**

Com a ferramenta Edit, em `.context/ui-registry.md`, troque a linha `## 3. Componentes de domínio — \`src/features/<domínio>/components\`` por este bloco seguido da mesma linha (isto é, insira os três itens antes dela, no fim da seção 2):

```markdown
### ShiftsAdmin
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/shifts/ShiftsAdmin.tsx`
- **Propósito:** conteúdo da página `/admin/turnos`: cadastro e lista de turnos por setor.
- **Como funciona:** Server Component async; chama `requireAdmin()`, lê `?setor=` e `?pagina=`, mostra o seletor de setor
  (`SectorSwitcher`), o cartão "Novo turno" com os padrões de `getShiftFormDefaults` e a lista paginada. Cada linha mostra
  nome, `{início}–{fim}` (`tabular-nums`), selo "Atravessa a meia-noite", o aviso persistente "Sobrepõe o turno …" (ícone de
  alerta + texto) e "Inativo". Sem setor ativo, mostra o estado vazio com link "Ir para Setores". O formulário remonta (`key`)
  a cada criação para trazer o próximo padrão.
- **Usa:** `AdminPageHeader`, `SectorSwitcher`, `AdminListRow`, `EmptyState`, `Pagination`, `Card`, `Badge`, token `warning-foreground`.
- **Histórico:** 2026-11-21 — criado (Fase 2).

### ShiftForm
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/shifts/ShiftForm.tsx`
- **Propósito:** criar e editar turno (mesmo formulário).
- **Como funciona:** client, controlado; `initial.id` presente = edição (`updateShiftAction`), ausente = criação
  (`createShiftAction`). Valida com o mesmo schema Zod do servidor antes de enviar; erros por campo (`fieldErrors`) e erro geral
  ficam inline e o digitado nunca se perde. `<Input type="time" step={60}>` (≥16px); dica fixa "Fim menor que o início atravessa
  a meia-noite." e dica ao vivo "Atravessa a meia-noite.". Depois do sucesso: toast ("Turno criado." / "Alterações salvas.") e
  um `toast.warning` por sobreposição (máximo 3).
- **Usa:** `Field`, `Input`, `Button`, `useAdminAction`, `sonner`.
- **Histórico:** 2026-11-21 — criado (Fase 2).

### ShiftRowActions
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/shifts/ShiftRowActions.tsx`
- **Propósito:** ações de uma linha de turno.
- **Como funciona:** client; `MoveButtons` (↑ ↓ pela posição absoluta no setor; sem toast no sucesso), `EditDialog` "Editar turno"
  com `ShiftForm` e `ActiveToggleButton` (reativar mostra os avisos de sobreposição em toast).
- **Usa:** `MoveButtons`, `EditDialog`, `ActiveToggleButton`, `ShiftForm`.
- **Histórico:** 2026-11-21 — criado (Fase 2).

## 3. Componentes de domínio — `src/features/<domínio>/components`
```

(O Step só edita o arquivo; o último título acima é a linha original, mantida.)

- [ ] **Step 24: Rodar check-types, lint e a suíte inteira**

Run: `bun run check-types && bun run lint && bun run test`
Expected: os três verdes (nenhum erro de tipo, Biome sem achados, Vitest sem falhas). Se um teste de componente antigo estourar o tempo limite de 5 s com a máquina carregada, rode o arquivo sozinho para confirmar que é lentidão e não regressão.

- [ ] **Step 25: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-7.txt` (texto exato abaixo) e rode:
```bash
git add src/features/admin/shifts.ts src/features/admin/shifts.test.ts "src/app/(app)/admin/turnos" src/components/admin/shifts .context/ui-registry.md
git commit -F .git/sdd/msg-task-7.txt
```
Mensagem:
```text
feat(admin): turnos com aviso de sobreposição e ordem por botões

Domínio (listar, sugerir padrões, criar, editar, ativar, mover), actions,
página /admin/turnos, formulário e ações de linha. Horário "HH:mm" no app e
"HH:mm:ss" no banco, sobreposição à meia-noite só entre turnos ativos do
mesmo setor, renumeração 1..n ao mover.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 8: Itens — domínio, actions, página e componentes

**Files:**
- Create: `src/features/admin/items.ts`
- Create: `src/app/(app)/admin/itens/actions.ts`
- Create: `src/app/(app)/admin/itens/page.tsx`
- Create: `src/components/admin/items/ItemsAdmin.tsx`
- Create: `src/components/admin/items/ItemForm.tsx`
- Create: `src/components/admin/items/ItemRowActions.tsx`
- Modify: `.context/ui-registry.md` (inserir três itens no fim da seção `## 2. Componentes de aplicação`, imediatamente antes da linha `## 3. Componentes de domínio — \`src/features/<domínio>/components\``, depois dos itens da Tarefa 7)
- Test: `src/features/admin/items.test.ts`
- Test: `src/app/(app)/admin/itens/actions.test.ts`
- Test: `src/components/admin/items/ItemForm.test.tsx`
- Test: `src/components/admin/items/ItemRowActions.test.tsx`
- Test: `src/components/admin/items/ItemsAdmin.test.tsx`

**Interfaces:**
- Consumes (Tarefa 1): tabelas `item` e `sector`, `ItemKind`; fixtures `insertSector`, `insertItem(db, { sectorId, name?, unit?, kind?, sortOrder?, active? })`.
- Consumes (Tarefa 2): `validateName`, `normalizeName`; `ITEM_UNITS`, `ITEM_UNIT_LABELS`, `ITEM_KIND_LABELS`, `ITEM_KIND_HELP`, `ITEM_FORM_DEFAULTS`, `OTHER_UNIT`, `UNIT_MAX_LENGTH`, `UnitChoice`, `ItemFormValues`, `resolveUnit`, `splitUnit` (`itemOptions.ts`); `PAGE_SIZE`, `Page<T>`, `resolvePage`, `parsePage`; `moveId`, `planSortUpdates`, `SortDirection`; `nameTakenMessage`, `notFoundMessage`.
- Consumes (Tarefa 3): `AdminResult`, `AdminFailure`, `FieldErrors`, `fail`, `ok`, `INVALID_INPUT_MESSAGE`; `isUniqueViolation`; `createItemSchema`, `updateItemSchema`, `setActiveSchema`, `moveSchema`, `firstFieldErrors`; `runAdminAction`; `authzOf`.
- Consumes (Tarefa 4): `NativeSelect`, `ToggleGroup` (via `SelectField`/`ChoiceGroup`), `Dialog` (via `EditDialog`).
- Consumes (Tarefa 5): `AdminPageHeader`, `AdminListRow`, `EmptyState`, `Pagination`, `SectorSwitcher`, `MoveButtons`, `ChoiceGroup`, `SelectField`, `EditDialog`, `ActiveToggleButton`, `useAdminAction`.
- Consumes (Tarefa 6): `listActiveSectors`, `resolveSectorFilter` (`@/features/admin/sectors`).
- Produces:
  - `src/features/admin/items.ts`: `ItemRow`, `listItems(db, { sectorId, page })`, `createItem(db, { sectorId, name, unit, kind })`, `updateItem(db, { id, name, unit, kind })`, `setItemActive(db, { id, active })`, `moveItem(db, { id, direction })` (assinaturas do contrato). Erros de unidade no domínio usam o campo `unitOther`.
  - `src/app/(app)/admin/itens/actions.ts`: `createItemAction`, `updateItemAction`, `setItemActiveAction`, `moveItemAction`. As duas primeiras resolvem a unidade com `resolveUnit` (escolha da lista, ou texto de "Outro…", que vira o valor da lista se for igual a uma unidade dela).
  - `ItemsAdmin(props: { searchParams: Promise<Record<string, string | string[] | undefined>> })`, `ItemForm(props: { sectorId; initial: ItemFormValues & { id?: string }; submitLabel; onDone? })`, `ItemRowActions(props: { item: ItemRow })`.
  - A rota `/admin/itens`.

- [ ] **Step 1: Write the failing test do domínio**

Crie `src/features/admin/items.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertItem, insertSector } from "../../../test/fixtures";
import {
  createItem,
  listItems,
  moveItem,
  setItemActive,
  updateItem,
} from "./items";
import { PAGE_SIZE } from "./pagination";

const NIL_ID = "00000000-0000-4000-8000-000000000000";

function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("valor ausente no teste");
  return value;
}

describe("itens (domínio)", () => {
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

  async function orderOf(sectorId: string): Promise<string[]> {
    const page = await listItems(db, { sectorId, page: 1 });
    return page.rows.map((row) => row.name);
  }

  describe("listItems", () => {
    it("lista só o setor pedido, por ordem, com unidade e tipo", async () => {
      const uld = await insertSector(db, "ULD");
      const other = await insertSector(db, "Outro");
      await insertItem(db, {
        sectorId: uld.id,
        name: "Estoque de rolos",
        unit: "rolo",
        kind: "stock",
      });
      await insertItem(db, {
        sectorId: uld.id,
        name: "Redes danificadas",
        sortOrder: 0,
      });
      await insertItem(db, { sectorId: other.id, name: "Alheio" });

      const page = await listItems(db, { sectorId: uld.id, page: 1 });

      expect(page.total).toBe(2);
      expect(page.rows.map((row) => row.name)).toEqual([
        "Redes danificadas",
        "Estoque de rolos",
      ]);
      expect(page.rows[1]).toMatchObject({
        unit: "rolo",
        kind: "stock",
        active: true,
      });
    });

    it("setor sem itens devolve página vazia com pageCount 1", async () => {
      const uld = await insertSector(db, "ULD");
      expect(await listItems(db, { sectorId: uld.id, page: 1 })).toMatchObject({
        rows: [],
        total: 0,
        page: 1,
        pageCount: 1,
      });
    });

    it("lista ativos e inativos", async () => {
      const uld = await insertSector(db, "ULD");
      await insertItem(db, { sectorId: uld.id, name: "A" });
      await insertItem(db, { sectorId: uld.id, name: "B", active: false });
      const page = await listItems(db, { sectorId: uld.id, page: 1 });
      expect(page.rows.map((row) => row.active)).toEqual([true, false]);
    });

    it("canMoveUp/canMoveDown valem para a lista inteira, não para a página", async () => {
      const uld = await insertSector(db, "ULD");
      for (let n = 1; n <= PAGE_SIZE + 2; n += 1) {
        await insertItem(db, {
          sectorId: uld.id,
          name: `I${String(n).padStart(3, "0")}`,
        });
      }
      const first = await listItems(db, { sectorId: uld.id, page: 1 });
      const second = await listItems(db, { sectorId: uld.id, page: 2 });

      expect(first.rows).toHaveLength(PAGE_SIZE);
      expect(second.rows).toHaveLength(2);
      expect(first.rows[0]).toMatchObject({
        canMoveUp: false,
        canMoveDown: true,
      });
      expect(first.rows.at(-1)).toMatchObject({
        canMoveUp: true,
        canMoveDown: true,
      });
      expect(second.rows[0]).toMatchObject({
        canMoveUp: true,
        canMoveDown: true,
      });
      expect(second.rows.at(-1)).toMatchObject({
        canMoveUp: true,
        canMoveDown: false,
      });
    });

    it("item único não sobe nem desce", async () => {
      const uld = await insertSector(db, "ULD");
      await insertItem(db, { sectorId: uld.id });
      const page = await listItems(db, { sectorId: uld.id, page: 1 });
      expect(page.rows[0]).toMatchObject({
        canMoveUp: false,
        canMoveDown: false,
      });
    });

    it("página além do fim é clampada para a última", async () => {
      const uld = await insertSector(db, "ULD");
      await insertItem(db, { sectorId: uld.id });
      const page = await listItems(db, { sectorId: uld.id, page: 99 });
      expect(page.page).toBe(1);
      expect(page.rows).toHaveLength(1);
    });
  });

  describe("createItem", () => {
    it("cria no fim da ordem com unidade e tipo", async () => {
      const uld = await insertSector(db, "ULD");
      await insertItem(db, { sectorId: uld.id, name: "Primeiro" });

      const result = await createItem(db, {
        sectorId: uld.id,
        name: "  Rede   de proteção ",
        unit: "unidade",
        kind: "control",
      });

      expect(result).toMatchObject({ ok: true });
      expect(await orderOf(uld.id)).toEqual(["Primeiro", "Rede de proteção"]);
    });

    it("o primeiro item do setor recebe sortOrder 1; a ordem é por setor", async () => {
      const uld = await insertSector(db, "ULD");
      const other = await insertSector(db, "Outro");
      await insertItem(db, { sectorId: other.id, sortOrder: 7 });
      await createItem(db, {
        sectorId: uld.id,
        name: "A",
        unit: "kg",
        kind: "stock",
      });
      const page = await listItems(db, { sectorId: uld.id, page: 1 });
      expect(page.rows[0]).toMatchObject({
        sortOrder: 1,
        unit: "kg",
        kind: "stock",
      });
    });

    it("aceita unidade livre (Outro) com Unicode e 20 caracteres", async () => {
      const uld = await insertSector(db, "ULD");
      const unit = "ç".repeat(20);
      const result = await createItem(db, {
        sectorId: uld.id,
        name: "A",
        unit,
        kind: "control",
      });
      expect(result.ok).toBe(true);
      expect(
        (await listItems(db, { sectorId: uld.id, page: 1 })).rows[0]?.unit,
      ).toBe(unit);
    });

    it("unidade vazia, só espaços ou com 21 caracteres é INVALID_INPUT em unitOther", async () => {
      const uld = await insertSector(db, "ULD");
      const empty = await createItem(db, {
        sectorId: uld.id,
        name: "A",
        unit: "   ",
        kind: "control",
      });
      const long = await createItem(db, {
        sectorId: uld.id,
        name: "B",
        unit: "x".repeat(21),
        kind: "control",
      });
      expect(empty).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        message: "Informe a unidade.",
        fieldErrors: { unitOther: "Informe a unidade." },
      });
      expect(long).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: {
          unitOther: "A unidade pode ter no máximo 20 caracteres.",
        },
      });
      expect((await listItems(db, { sectorId: uld.id, page: 1 })).total).toBe(
        0,
      );
    });

    it("nome vazio e nome longo viram INVALID_INPUT no campo name", async () => {
      const uld = await insertSector(db, "ULD");
      const empty = await createItem(db, {
        sectorId: uld.id,
        name: " ",
        unit: "kg",
        kind: "control",
      });
      const long = await createItem(db, {
        sectorId: uld.id,
        name: "x".repeat(61),
        unit: "kg",
        kind: "control",
      });
      expect(empty).toMatchObject({
        ok: false,
        fieldErrors: { name: "Informe o nome." },
      });
      expect(long).toMatchObject({
        ok: false,
        fieldErrors: { name: "O nome pode ter no máximo 60 caracteres." },
      });
    });

    it("setor inexistente é NOT_FOUND", async () => {
      const result = await createItem(db, {
        sectorId: NIL_ID,
        name: "A",
        unit: "kg",
        kind: "control",
      });
      expect(result).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
        message: "Setor não encontrado. Atualize a página.",
      });
    });

    it("setor inativo é SECTOR_INACTIVE e nada é gravado", async () => {
      const off = await insertSector(db, "Parado", { active: false });
      const result = await createItem(db, {
        sectorId: off.id,
        name: "A",
        unit: "kg",
        kind: "control",
      });
      expect(result).toMatchObject({
        ok: false,
        code: "SECTOR_INACTIVE",
        message: "Este setor está inativo. Reative-o para cadastrar itens.",
      });
      expect((await listItems(db, { sectorId: off.id, page: 1 })).total).toBe(
        0,
      );
    });

    it("nome repetido no setor (outra caixa) é NAME_TAKEN", async () => {
      const uld = await insertSector(db, "ULD");
      await insertItem(db, { sectorId: uld.id, name: "Água" });
      const result = await createItem(db, {
        sectorId: uld.id,
        name: "ÁGUA",
        unit: "kg",
        kind: "control",
      });
      expect(result).toEqual({
        ok: false,
        code: "NAME_TAKEN",
        message: "Já existe um item com este nome neste setor.",
        fieldErrors: { name: "Já existe um item com este nome neste setor." },
      });
    });

    it("avisa quando o nome repetido é de um item inativo", async () => {
      const uld = await insertSector(db, "ULD");
      await insertItem(db, { sectorId: uld.id, name: "Rede", active: false });
      const result = await createItem(db, {
        sectorId: uld.id,
        name: "rede",
        unit: "kg",
        kind: "control",
      });
      expect(result).toMatchObject({
        ok: false,
        code: "NAME_TAKEN",
        message:
          "Já existe um item com este nome neste setor. Ele está inativo: reative-o na lista.",
      });
    });

    it("o mesmo nome em outro setor passa", async () => {
      const uld = await insertSector(db, "ULD");
      const other = await insertSector(db, "Outro");
      await insertItem(db, { sectorId: other.id, name: "Rede" });
      const result = await createItem(db, {
        sectorId: uld.id,
        name: "Rede",
        unit: "kg",
        kind: "control",
      });
      expect(result.ok).toBe(true);
    });
  });

  describe("updateItem", () => {
    it("altera nome, unidade e tipo", async () => {
      const uld = await insertSector(db, "ULD");
      const rede = await insertItem(db, { sectorId: uld.id, name: "Rede" });

      const result = await updateItem(db, {
        id: rede.id,
        name: "Rede nova",
        unit: "pç grande",
        kind: "stock",
      });

      expect(result).toEqual({ ok: true });
      expect(
        (await listItems(db, { sectorId: uld.id, page: 1 })).rows[0],
      ).toMatchObject({
        name: "Rede nova",
        unit: "pç grande",
        kind: "stock",
      });
    });

    it("trocar só a caixa do próprio nome é permitido", async () => {
      const uld = await insertSector(db, "ULD");
      const rede = await insertItem(db, { sectorId: uld.id, name: "rede" });
      expect(
        await updateItem(db, {
          id: rede.id,
          name: "Rede",
          unit: "unidade",
          kind: "control",
        }),
      ).toEqual({ ok: true });
    });

    it("nome de outro item do setor é NAME_TAKEN e o item não muda", async () => {
      const uld = await insertSector(db, "ULD");
      await insertItem(db, { sectorId: uld.id, name: "Rede" });
      const rolo = await insertItem(db, { sectorId: uld.id, name: "Rolo" });
      const result = await updateItem(db, {
        id: rolo.id,
        name: "REDE",
        unit: "kg",
        kind: "control",
      });
      expect(result).toMatchObject({ ok: false, code: "NAME_TAKEN" });
      expect(await orderOf(uld.id)).toEqual(["Rede", "Rolo"]);
    });

    it("unidade inválida é recusada", async () => {
      const uld = await insertSector(db, "ULD");
      const rede = await insertItem(db, { sectorId: uld.id, name: "Rede" });
      expect(
        await updateItem(db, {
          id: rede.id,
          name: "Rede",
          unit: "",
          kind: "control",
        }),
      ).toMatchObject({
        ok: false,
        code: "INVALID_INPUT",
        fieldErrors: { unitOther: "Informe a unidade." },
      });
    });

    it("id inexistente é NOT_FOUND", async () => {
      expect(
        await updateItem(db, {
          id: NIL_ID,
          name: "A",
          unit: "kg",
          kind: "control",
        }),
      ).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
        message: "Item não encontrado. Atualize a página.",
      });
    });
  });

  describe("setItemActive", () => {
    it("desativa e reativa", async () => {
      const uld = await insertSector(db, "ULD");
      const rede = await insertItem(db, { sectorId: uld.id });
      expect(await setItemActive(db, { id: rede.id, active: false })).toEqual({
        ok: true,
      });
      expect(
        (await listItems(db, { sectorId: uld.id, page: 1 })).rows[0]?.active,
      ).toBe(false);
      expect(await setItemActive(db, { id: rede.id, active: true })).toEqual({
        ok: true,
      });
      expect(
        (await listItems(db, { sectorId: uld.id, page: 1 })).rows[0]?.active,
      ).toBe(true);
    });

    it("é idempotente: desativar de novo é sucesso sem mudança", async () => {
      const uld = await insertSector(db, "ULD");
      const rede = await insertItem(db, { sectorId: uld.id, active: false });
      expect(await setItemActive(db, { id: rede.id, active: false })).toEqual({
        ok: true,
      });
    });

    it("id inexistente é NOT_FOUND", async () => {
      expect(
        await setItemActive(db, { id: NIL_ID, active: true }),
      ).toMatchObject({
        ok: false,
        code: "NOT_FOUND",
      });
    });
  });

  describe("moveItem", () => {
    async function seed(names: string[]) {
      const uld = await insertSector(db, "ULD");
      const ids: string[] = [];
      for (const name of names) {
        ids.push((await insertItem(db, { sectorId: uld.id, name })).id);
      }
      return { sectorId: uld.id, ids };
    }

    it("sobe e desce trocando com o vizinho", async () => {
      const { sectorId, ids } = await seed(["A", "B", "C"]);
      await moveItem(db, { id: must(ids[2]), direction: "up" });
      expect(await orderOf(sectorId)).toEqual(["A", "C", "B"]);
      await moveItem(db, { id: must(ids[0]), direction: "down" });
      expect(await orderOf(sectorId)).toEqual(["C", "A", "B"]);
    });

    it("no topo ou no fim é sucesso sem mudança", async () => {
      const { sectorId, ids } = await seed(["A", "B"]);
      expect(await moveItem(db, { id: must(ids[0]), direction: "up" })).toEqual(
        { ok: true },
      );
      expect(
        await moveItem(db, { id: must(ids[1]), direction: "down" }),
      ).toEqual({ ok: true });
      expect(await orderOf(sectorId)).toEqual(["A", "B"]);
    });

    it("com sortOrder duplicado renumera 1..n e move", async () => {
      const uld = await insertSector(db, "ULD");
      await insertItem(db, { sectorId: uld.id, name: "A", sortOrder: 1 });
      const b = await insertItem(db, {
        sectorId: uld.id,
        name: "B",
        sortOrder: 1,
      });
      await insertItem(db, { sectorId: uld.id, name: "C", sortOrder: 2 });

      await moveItem(db, { id: b.id, direction: "up" });

      const page = await listItems(db, { sectorId: uld.id, page: 1 });
      expect(page.rows.map((row) => [row.name, row.sortOrder])).toEqual([
        ["B", 1],
        ["A", 2],
        ["C", 3],
      ]);
    });

    it("não mexe na ordem de outro setor", async () => {
      const { ids } = await seed(["A", "B"]);
      const other = await insertSector(db, "Outro");
      await insertItem(db, { sectorId: other.id, name: "X", sortOrder: 5 });
      await insertItem(db, { sectorId: other.id, name: "Y", sortOrder: 9 });
      await moveItem(db, { id: must(ids[1]), direction: "up" });
      const page = await listItems(db, { sectorId: other.id, page: 1 });
      expect(page.rows.map((row) => [row.name, row.sortOrder])).toEqual([
        ["X", 5],
        ["Y", 9],
      ]);
    });

    it("id inexistente é NOT_FOUND", async () => {
      expect(await moveItem(db, { id: NIL_ID, direction: "up" })).toMatchObject(
        {
          ok: false,
          code: "NOT_FOUND",
          message: "Item não encontrado. Atualize a página.",
        },
      );
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/features/admin/items.test.ts`
Expected: FAIL com `Cannot find module './items' imported from …/src/features/admin/items.test.ts`.

- [ ] **Step 3: Write minimal implementation do domínio**

Crie `src/features/admin/items.ts`:

```ts
import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { type ItemKind, item } from "@/db/schema/catalog";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";

import { isUniqueViolation } from "./dbErrors";
import { UNIT_MAX_LENGTH } from "./itemOptions";
import { nameTakenMessage, notFoundMessage } from "./messages";
import { normalizeName, validateName } from "./names";
import { PAGE_SIZE, type Page, resolvePage } from "./pagination";
import { moveId, planSortUpdates, type SortDirection } from "./reorder";
import {
  type AdminFailure,
  type AdminResult,
  type FieldErrors,
  fail,
  INVALID_INPUT_MESSAGE,
  ok,
} from "./result";

export type ItemRow = {
  id: string;
  sectorId: string;
  name: string;
  unit: string;
  kind: ItemKind;
  sortOrder: number;
  active: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
};

const SECTOR_INACTIVE_FOR_ITEMS =
  "Este setor está inativo. Reative-o para cadastrar itens.";

const READ_ORDER = [asc(item.sortOrder), asc(item.createdAt), asc(item.id)];

export async function listItems(
  db: Db,
  input: { sectorId: string; page: number },
): Promise<Page<ItemRow>> {
  const inSector = eq(item.sectorId, input.sectorId);
  const [counted] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(item)
    .where(inSector);
  const total = counted?.total ?? 0;
  const { page, pageCount, offset } = resolvePage(total, input.page);

  const [rows, firstRow, lastRow] = await Promise.all([
    db
      .select()
      .from(item)
      .where(inSector)
      .orderBy(...READ_ORDER)
      .limit(PAGE_SIZE)
      .offset(offset),
    db
      .select({ id: item.id })
      .from(item)
      .where(inSector)
      .orderBy(...READ_ORDER)
      .limit(1),
    db
      .select({ id: item.id })
      .from(item)
      .where(inSector)
      .orderBy(desc(item.sortOrder), desc(item.createdAt), desc(item.id))
      .limit(1),
  ]);
  const firstId = firstRow[0]?.id;
  const lastId = lastRow[0]?.id;

  return {
    rows: rows.map((row) => ({
      id: row.id,
      sectorId: row.sectorId,
      name: row.name,
      unit: row.unit,
      kind: row.kind,
      sortOrder: row.sortOrder,
      active: row.active,
      canMoveUp: row.id !== firstId,
      canMoveDown: row.id !== lastId,
    })),
    total,
    page,
    pageCount,
    pageSize: PAGE_SIZE,
  };
}

type ItemFields = { name: string; unit: string };

// O domínio revalida o que a action já resolveu: nunca confia na tela.
function validateFields(
  input: ItemFields,
):
  | { ok: true; name: string; unit: string }
  | { ok: false; message: string; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {};
  const name = validateName(input.name);
  if (!name.ok) fieldErrors.name = name.message;
  const unit = normalizeName(input.unit);
  if (unit === "") {
    fieldErrors.unitOther = "Informe a unidade.";
  } else if ([...unit].length > UNIT_MAX_LENGTH) {
    fieldErrors.unitOther = `A unidade pode ter no máximo ${UNIT_MAX_LENGTH} caracteres.`;
  }
  if (name.ok && Object.keys(fieldErrors).length === 0) {
    return { ok: true, name: name.name, unit };
  }
  return {
    ok: false,
    message: Object.values(fieldErrors)[0] ?? INVALID_INPUT_MESSAGE,
    fieldErrors,
  };
}

async function nameTakenFailure(
  db: Db,
  sectorId: string,
  name: string,
): Promise<AdminFailure> {
  const [existing] = await db
    .select({ active: item.active })
    .from(item)
    .where(
      and(
        eq(item.sectorId, sectorId),
        sql`lower(${item.name}) = lower(${name})`,
      ),
    )
    .limit(1);
  const message = nameTakenMessage("item", existing?.active === false);
  return fail("NAME_TAKEN", message, { name: message });
}

export async function createItem(
  db: Db,
  input: { sectorId: string; name: string; unit: string; kind: ItemKind },
): Promise<AdminResult<{ id: string }>> {
  const checked = validateFields(input);
  if (!checked.ok) {
    return fail("INVALID_INPUT", checked.message, checked.fieldErrors);
  }
  try {
    // Leitura do setor e INSERT na mesma transação: o FOR SHARE segura o setor
    // até o INSERT e serializa com o FOR UPDATE de setSectorActive (F2-23).
    return await db.transaction(async (tx) => {
      const [owner] = await tx
        .select({ active: sector.active })
        .from(sector)
        .where(eq(sector.id, input.sectorId))
        .for("share");
      if (!owner) return fail("NOT_FOUND", notFoundMessage("setor"));
      if (!owner.active) {
        return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_FOR_ITEMS);
      }
      const [created] = await tx
        .insert(item)
        .values({
          sectorId: input.sectorId,
          name: checked.name,
          unit: checked.unit,
          kind: input.kind,
          sortOrder: sql`(select coalesce(max(${item.sortOrder}), 0) + 1 from ${item} where ${item.sectorId} = ${input.sectorId})`,
        })
        .returning({ id: item.id });
      if (!created) throw new Error("Falha ao criar o item.");
      return ok({ id: created.id });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return nameTakenFailure(db, input.sectorId, checked.name);
    }
    throw error;
  }
}

export async function updateItem(
  db: Db,
  input: { id: string; name: string; unit: string; kind: ItemKind },
): Promise<AdminResult> {
  const checked = validateFields(input);
  if (!checked.ok) {
    return fail("INVALID_INPUT", checked.message, checked.fieldErrors);
  }
  const [current] = await db
    .select({ sectorId: item.sectorId })
    .from(item)
    .where(eq(item.id, input.id));
  if (!current) return fail("NOT_FOUND", notFoundMessage("item"));

  try {
    await db
      .update(item)
      .set({ name: checked.name, unit: checked.unit, kind: input.kind })
      .where(eq(item.id, input.id));
    return ok();
  } catch (error) {
    if (isUniqueViolation(error)) {
      return nameTakenFailure(db, current.sectorId, checked.name);
    }
    throw error;
  }
}

export async function setItemActive(
  db: Db,
  input: { id: string; active: boolean },
): Promise<AdminResult> {
  const [updated] = await db
    .update(item)
    .set({ active: input.active })
    .where(eq(item.id, input.id))
    .returning({ id: item.id });
  if (!updated) return fail("NOT_FOUND", notFoundMessage("item"));
  return ok();
}

export async function moveItem(
  db: Db,
  input: { id: string; direction: SortDirection },
): Promise<AdminResult> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ sectorId: item.sectorId })
      .from(item)
      .where(eq(item.id, input.id));
    if (!target) return fail("NOT_FOUND", notFoundMessage("item"));

    // FOR UPDATE serializa dois cliques seguidos (ou duas abas) no mesmo setor.
    const rows = await tx
      .select({ id: item.id, sortOrder: item.sortOrder })
      .from(item)
      .where(eq(item.sectorId, target.sectorId))
      .orderBy(...READ_ORDER)
      .for("update");
    const next = moveId(
      rows.map((row) => row.id),
      input.id,
      input.direction,
    );
    if (next === null) return ok();

    for (const update of planSortUpdates(rows, next)) {
      await tx
        .update(item)
        .set({ sortOrder: update.sortOrder })
        .where(eq(item.id, update.id));
    }
    return ok();
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- src/features/admin/items.test.ts`
Expected: PASS (29 testes)

- [ ] **Step 5: Write the failing test das actions**

Crie `src/app/(app)/admin/itens/actions.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { db } from "@/db";
import { listItems } from "@/features/admin/items";
import { authzOf } from "../../../../../test/authz";
import { resetDb } from "../../../../../test/db";
import { insertItem, insertSector } from "../../../../../test/fixtures";
import {
  createItemAction,
  moveItemAction,
  setItemActiveAction,
  updateItemAction,
} from "./actions";

const mocks = vi.hoisted(
  (): {
    requireAdmin: Mock;
    revalidatePath: Mock;
    client: PGlite | undefined;
  } => ({
    requireAdmin: vi.fn(),
    revalidatePath: vi.fn(),
    client: undefined,
  }),
);

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});

const NOT_FOUND = new Error("NEXT_HTTP_ERROR_FALLBACK;404");

function itemInput(sectorId: string, overrides: Record<string, string> = {}) {
  return {
    sectorId,
    name: "Rede de proteção",
    unitChoice: "unidade",
    unitOther: "",
    kind: "control",
    ...overrides,
  };
}

describe("actions de itens", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireAdmin.mockReset();
    mocks.revalidatePath.mockReset();
    mocks.requireAdmin.mockResolvedValue(authzOf({ role: "admin" }));
  });

  describe("operador (permissão negada)", () => {
    beforeEach(() => {
      mocks.requireAdmin.mockRejectedValue(NOT_FOUND);
    });

    it("nenhuma action toca o banco nem revalida", async () => {
      const sector = await insertSector(db, "ULD");
      const existing = await insertItem(db, {
        sectorId: sector.id,
        name: "Antigo",
      });

      await expect(createItemAction(itemInput(sector.id))).rejects.toBe(
        NOT_FOUND,
      );
      await expect(
        updateItemAction({
          id: existing.id,
          ...itemInput(sector.id, { name: "Hackeado" }),
        }),
      ).rejects.toBe(NOT_FOUND);
      await expect(
        setItemActiveAction({ id: existing.id, active: false }),
      ).rejects.toBe(NOT_FOUND);
      await expect(
        moveItemAction({ id: existing.id, direction: "down" }),
      ).rejects.toBe(NOT_FOUND);

      const page = await listItems(db, { sectorId: sector.id, page: 1 });
      expect(page.rows.map((row) => [row.name, row.active])).toEqual([
        ["Antigo", true],
      ]);
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
  });

  it("createItemAction com unidade da lista grava o valor da lista e revalida", async () => {
    const sector = await insertSector(db, "ULD");

    const result = await createItemAction(
      itemInput(sector.id, { unitChoice: "rolo", kind: "stock" }),
    );

    expect(result).toMatchObject({ ok: true });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
    const page = await listItems(db, { sectorId: sector.id, page: 1 });
    expect(page.rows[0]).toMatchObject({
      name: "Rede de proteção",
      unit: "rolo",
      kind: "stock",
    });
  });

  it("'Outro' grava o texto normalizado", async () => {
    const sector = await insertSector(db, "ULD");
    await createItemAction(
      itemInput(sector.id, {
        unitChoice: "outro",
        unitOther: "  folha   grande ",
      }),
    );
    const page = await listItems(db, { sectorId: sector.id, page: 1 });
    expect(page.rows[0]?.unit).toBe("folha grande");
  });

  it("'Outro' igual a uma unidade da lista grava o valor da lista", async () => {
    const sector = await insertSector(db, "ULD");
    await createItemAction(
      itemInput(sector.id, { unitChoice: "outro", unitOther: "ROLO" }),
    );
    const page = await listItems(db, { sectorId: sector.id, page: 1 });
    expect(page.rows[0]?.unit).toBe("rolo");
  });

  it("'Outro' vazio ou longo volta INVALID_INPUT em unitOther, sem gravar", async () => {
    const sector = await insertSector(db, "ULD");
    const empty = await createItemAction(
      itemInput(sector.id, { unitChoice: "outro", unitOther: "  " }),
    );
    const long = await createItemAction(
      itemInput(sector.id, { unitChoice: "outro", unitOther: "x".repeat(21) }),
    );
    expect(empty).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { unitOther: "Informe a unidade." },
    });
    expect(long).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { unitOther: "A unidade pode ter no máximo 20 caracteres." },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect((await listItems(db, { sectorId: sector.id, page: 1 })).total).toBe(
      0,
    );
  });

  it("unidade desconhecida volta INVALID_INPUT em unitChoice", async () => {
    const sector = await insertSector(db, "ULD");
    const result = await createItemAction(
      itemInput(sector.id, { unitChoice: "tonelada" }),
    );
    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { unitChoice: "Escolha uma unidade." },
    });
  });

  it("tipo fora de Controle/Estoque volta INVALID_INPUT", async () => {
    const sector = await insertSector(db, "ULD");
    const result = await createItemAction(
      itemInput(sector.id, { kind: "outro" }),
    );
    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });

  it("nome vazio volta INVALID_INPUT no campo name", async () => {
    const sector = await insertSector(db, "ULD");
    const result = await createItemAction(itemInput(sector.id, { name: "  " }));
    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: { name: "Informe o nome." },
    });
  });

  it("falha de domínio é repassada e não revalida", async () => {
    const off = await insertSector(db, "Parado", { active: false });
    const result = await createItemAction(itemInput(off.id));
    expect(result).toMatchObject({ ok: false, code: "SECTOR_INACTIVE" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("updateItemAction resolve a unidade e grava", async () => {
    const sector = await insertSector(db, "ULD");
    const existing = await insertItem(db, {
      sectorId: sector.id,
      name: "Rede",
    });

    const result = await updateItemAction({
      id: existing.id,
      name: "Rede nova",
      unitChoice: "outro",
      unitOther: "pç grande",
      kind: "stock",
    });

    expect(result).toEqual({ ok: true });
    const page = await listItems(db, { sectorId: sector.id, page: 1 });
    expect(page.rows[0]).toMatchObject({
      name: "Rede nova",
      unit: "pç grande",
      kind: "stock",
    });
  });

  it("setItemActiveAction e moveItemAction funcionam", async () => {
    const sector = await insertSector(db, "ULD");
    await insertItem(db, { sectorId: sector.id, name: "A" });
    const b = await insertItem(db, { sectorId: sector.id, name: "B" });

    expect(await setItemActiveAction({ id: b.id, active: false })).toEqual({
      ok: true,
    });
    expect(await moveItemAction({ id: b.id, direction: "up" })).toEqual({
      ok: true,
    });

    const page = await listItems(db, { sectorId: sector.id, page: 1 });
    expect(page.rows.map((row) => [row.name, row.active])).toEqual([
      ["B", false],
      ["A", true],
    ]);
  });

  it("id malformado volta INVALID_INPUT", async () => {
    expect(await moveItemAction({ id: "x", direction: "up" })).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Registro inválido. Atualize a página.",
    });
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bun run test -- "src/app/(app)/admin/itens/actions.test.ts"`
Expected: FAIL com `Cannot find module './actions' imported from …/src/app/(app)/admin/itens/actions.test.ts`.

- [ ] **Step 7: Write minimal implementation das actions**

Crie `src/app/(app)/admin/itens/actions.ts`:

```ts
"use server";

import { resolveUnit } from "@/features/admin/itemOptions";
import {
  createItem,
  moveItem,
  setItemActive,
  updateItem,
} from "@/features/admin/items";
import {
  type AdminFailure,
  type AdminResult,
  fail,
} from "@/features/admin/result";
import { runAdminAction } from "@/features/admin/runAdminAction";
import {
  createItemSchema,
  moveSchema,
  setActiveSchema,
  updateItemSchema,
} from "@/features/admin/schemas";
import { requireAdmin } from "@/lib/auth/session";

// Os schemas já recusam unidade inválida; isto mantém a action segura sozinha.
function unitOf(data: {
  unitChoice: string;
  unitOther: string;
}): { ok: true; unit: string } | { ok: false; failure: AdminFailure } {
  const resolved = resolveUnit(data.unitChoice, data.unitOther);
  if (resolved.ok) return resolved;
  return {
    ok: false,
    failure: fail("INVALID_INPUT", resolved.message, {
      [resolved.field]: resolved.message,
    }),
  };
}

export async function createItemAction(
  input: unknown,
): Promise<AdminResult<{ id: string }>> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: createItemSchema,
    input,
    run: async ({ db, input: data }) => {
      const unit = unitOf(data);
      if (!unit.ok) return unit.failure;
      return createItem(db, {
        sectorId: data.sectorId,
        name: data.name,
        unit: unit.unit,
        kind: data.kind,
      });
    },
  });
}

export async function updateItemAction(input: unknown): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: updateItemSchema,
    input,
    run: async ({ db, input: data }) => {
      const unit = unitOf(data);
      if (!unit.ok) return unit.failure;
      return updateItem(db, {
        id: data.id,
        name: data.name,
        unit: unit.unit,
        kind: data.kind,
      });
    },
  });
}

export async function setItemActiveAction(
  input: unknown,
): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: setActiveSchema,
    input,
    run: ({ db, input: data }) => setItemActive(db, data),
  });
}

export async function moveItemAction(input: unknown): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: moveSchema,
    input,
    run: ({ db, input: data }) => moveItem(db, data),
  });
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun run test -- "src/app/(app)/admin/itens/actions.test.ts"`
Expected: PASS (12 testes)

- [ ] **Step 9: Write the failing test do ItemForm**

Crie `src/components/admin/items/ItemForm.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ITEM_FORM_DEFAULTS } from "@/features/admin/itemOptions";
import { ItemForm } from "./ItemForm";

const SECTOR_ID = "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b";
const ITEM_ID = "7a2e3b4c-5d6e-4f70-8b9c-1d2e3f4a5b6c";

const mocks = vi.hoisted(() => ({
  createItemAction: vi.fn(),
  updateItemAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/itens/actions", () => ({
  createItemAction: mocks.createItemAction,
  updateItemAction: mocks.updateItemAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

function setup(props: Partial<ComponentProps<typeof ItemForm>> = {}) {
  const onDone = vi.fn();
  render(
    <ItemForm
      sectorId={SECTOR_ID}
      initial={ITEM_FORM_DEFAULTS}
      submitLabel="Criar item"
      onDone={onDone}
      {...props}
    />,
  );
  return { onDone };
}

const nameField = () => screen.getByLabelText("Nome do item");
const unitField = () => screen.getByLabelText("Unidade");
const submit = () => screen.getByRole("button", { name: "Criar item" });

describe("ItemForm", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
  });

  it("começa com os padrões: Unidade 'Unidade' e tipo Controle com a ajuda", () => {
    setup();
    expect(nameField()).toHaveValue("");
    expect(unitField()).toHaveValue("unidade");
    expect(screen.queryByLabelText("Outra unidade")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Controle" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByText("Controle: soma no período, como redes danificadas."),
    ).toBeInTheDocument();
  });

  it("oferece as unidades da lista e 'Outro…'", () => {
    setup();
    const labels = Array.from(
      unitField().querySelectorAll("option"),
      (option) => option.textContent,
    );
    expect(labels).toEqual([
      "Unidade",
      "Rolo",
      "Par",
      "Pacote",
      "Caixa",
      "Saco",
      "Metro",
      "kg",
      "Outro…",
    ]);
  });

  it("escolher Estoque troca a ajuda; clicar de novo no selecionado não desmarca", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Estoque" }));
    expect(
      screen.getByText("Estoque: vale a última contagem, nunca a soma."),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Estoque" }));
    expect(screen.getByRole("button", { name: "Estoque" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("criar com unidade da lista envia as escolhas e avisa 'Item criado.'", async () => {
    mocks.createItemAction.mockResolvedValue({ ok: true, id: "x" });
    const { onDone } = setup();

    await userEvent.type(nameField(), "Rede de proteção");
    await userEvent.selectOptions(unitField(), "rolo");
    await userEvent.click(screen.getByRole("button", { name: "Estoque" }));
    await userEvent.click(submit());

    await waitFor(() =>
      expect(mocks.createItemAction).toHaveBeenCalledWith({
        sectorId: SECTOR_ID,
        name: "Rede de proteção",
        unitChoice: "rolo",
        unitOther: "",
        kind: "stock",
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Item criado.");
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("'Outro…' mostra o campo 'Outra unidade' e envia o texto", async () => {
    mocks.createItemAction.mockResolvedValue({ ok: true, id: "x" });
    setup();

    await userEvent.type(nameField(), "Folha");
    await userEvent.selectOptions(unitField(), "outro");
    await userEvent.type(
      screen.getByLabelText("Outra unidade"),
      "folha grande",
    );
    await userEvent.click(submit());

    await waitFor(() =>
      expect(mocks.createItemAction).toHaveBeenCalledWith({
        sectorId: SECTOR_ID,
        name: "Folha",
        unitChoice: "outro",
        unitOther: "folha grande",
        kind: "control",
      }),
    );
  });

  it("voltar para uma unidade da lista esconde 'Outra unidade'", async () => {
    setup();
    await userEvent.selectOptions(unitField(), "outro");
    expect(screen.getByLabelText("Outra unidade")).toBeInTheDocument();
    await userEvent.selectOptions(unitField(), "kg");
    expect(screen.queryByLabelText("Outra unidade")).not.toBeInTheDocument();
  });

  it("nome vazio: erro no campo, sem chamar a action", async () => {
    setup();
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Informe o nome.",
    );
    expect(nameField()).toHaveAttribute("aria-invalid", "true");
    expect(mocks.createItemAction).not.toHaveBeenCalled();
  });

  it("'Outro…' vazio: erro em 'Outra unidade', sem chamar a action", async () => {
    setup();
    await userEvent.type(nameField(), "Folha");
    await userEvent.selectOptions(unitField(), "outro");
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Informe a unidade.",
    );
    expect(screen.getByLabelText("Outra unidade")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(mocks.createItemAction).not.toHaveBeenCalled();
  });

  it("'Outro…' com 21 caracteres: erro de tamanho", async () => {
    setup();
    await userEvent.type(nameField(), "Folha");
    await userEvent.selectOptions(unitField(), "outro");
    await userEvent.type(
      screen.getByLabelText("Outra unidade"),
      "x".repeat(21),
    );
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A unidade pode ter no máximo 20 caracteres.",
    );
    expect(mocks.createItemAction).not.toHaveBeenCalled();
  });

  it("recusa do servidor: mostra o erro e preserva o digitado", async () => {
    mocks.createItemAction.mockResolvedValue({
      ok: false,
      code: "NAME_TAKEN",
      message: "Já existe um item com este nome neste setor.",
      fieldErrors: { name: "Já existe um item com este nome neste setor." },
    });
    const { onDone } = setup();
    await userEvent.type(nameField(), "Rede");
    await userEvent.selectOptions(unitField(), "caixa");
    await userEvent.click(submit());

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Já existe um item com este nome neste setor.",
    );
    expect(nameField()).toHaveValue("Rede");
    expect(unitField()).toHaveValue("caixa");
    expect(onDone).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("erro sem campo (setor inativo) aparece no formulário", async () => {
    mocks.createItemAction.mockResolvedValue({
      ok: false,
      code: "SECTOR_INACTIVE",
      message: "Este setor está inativo. Reative-o para cadastrar itens.",
    });
    setup();
    await userEvent.type(nameField(), "Rede");
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este setor está inativo. Reative-o para cadastrar itens.",
    );
  });

  it("falha de rede vira a mensagem genérica", async () => {
    mocks.createItemAction.mockRejectedValue(new Error("fetch failed"));
    setup();
    await userEvent.type(nameField(), "Rede");
    await userEvent.click(submit());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir. Tente de novo.",
    );
  });

  it("editar com unidade fora da lista abre em 'Outro…' com o texto", async () => {
    mocks.updateItemAction.mockResolvedValue({ ok: true });
    const { onDone } = setup({
      initial: {
        id: ITEM_ID,
        name: "Folha",
        unitChoice: "outro",
        unitOther: "folha grande",
        kind: "stock",
      },
      submitLabel: "Salvar alterações",
    });

    expect(unitField()).toHaveValue("outro");
    expect(screen.getByLabelText("Outra unidade")).toHaveValue("folha grande");
    expect(screen.getByRole("button", { name: "Estoque" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await userEvent.click(
      screen.getByRole("button", { name: "Salvar alterações" }),
    );

    await waitFor(() =>
      expect(mocks.updateItemAction).toHaveBeenCalledWith({
        id: ITEM_ID,
        name: "Folha",
        unitChoice: "outro",
        unitOther: "folha grande",
        kind: "stock",
      }),
    );
    expect(mocks.createItemAction).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Alterações salvas.");
    expect(onDone).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `bun run test -- src/components/admin/items/ItemForm.test.tsx`
Expected: FAIL com `Failed to resolve import "./ItemForm" from "src/components/admin/items/ItemForm.test.tsx". Does the file exist?`

- [ ] **Step 11: Write minimal implementation do ItemForm**

Crie `src/components/admin/items/ItemForm.tsx`:

```tsx
"use client";

import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";

import {
  createItemAction,
  updateItemAction,
} from "@/app/(app)/admin/itens/actions";
import { ChoiceGroup } from "@/components/admin/ChoiceGroup";
import { SelectField } from "@/components/admin/SelectField";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  ITEM_KIND_HELP,
  ITEM_KIND_LABELS,
  ITEM_UNIT_LABELS,
  ITEM_UNITS,
  type ItemFormValues,
  OTHER_UNIT,
  type UnitChoice,
} from "@/features/admin/itemOptions";
import type { FieldErrors } from "@/features/admin/result";
import {
  createItemSchema,
  firstFieldErrors,
  updateItemSchema,
} from "@/features/admin/schemas";
import { ITEM_KINDS } from "@/lib/itemKinds";

type ItemFormProps = {
  sectorId: string;
  initial: ItemFormValues & { id?: string };
  submitLabel: string;
  onDone?: () => void;
};

const UNIT_OPTIONS = [
  ...ITEM_UNITS.map((unit) => ({ value: unit, label: ITEM_UNIT_LABELS[unit] })),
  { value: OTHER_UNIT, label: "Outro…" },
];

const KIND_OPTIONS = ITEM_KINDS.map((kind) => ({
  value: kind,
  label: ITEM_KIND_LABELS[kind],
}));

function isUnitChoice(value: string): value is UnitChoice {
  return UNIT_OPTIONS.some((option) => option.value === value);
}

export function ItemForm({
  sectorId,
  initial,
  submitLabel,
  onDone,
}: ItemFormProps) {
  const uid = useId();
  const { pending, run } = useAdminAction();
  const [name, setName] = useState(initial.name);
  const [unitChoice, setUnitChoice] = useState<UnitChoice>(initial.unitChoice);
  const [unitOther, setUnitOther] = useState(initial.unitOther);
  const [kind, setKind] = useState(initial.kind);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFieldErrors({});
    setFormError(null);

    const values = { name, unitChoice, unitOther, kind };
    const parsed = initial.id
      ? updateItemSchema.safeParse({ id: initial.id, ...values })
      : createItemSchema.safeParse({ sectorId, ...values });
    if (!parsed.success) {
      setFieldErrors(firstFieldErrors(parsed.error));
      return;
    }

    const result = await run<object>(
      () =>
        initial.id
          ? updateItemAction({ id: initial.id, ...values })
          : createItemAction({ sectorId, ...values }),
      { showError: false },
    );
    if (!result.ok) {
      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.fieldErrors ? null : result.message);
      return;
    }
    toast.success(initial.id ? "Alterações salvas." : "Item criado.");
    onDone?.();
  }

  const nameError = fieldErrors.name;
  const otherError = fieldErrors.unitOther;

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={nameError ? true : undefined}>
          <FieldLabel htmlFor={`${uid}-name`}>Nome do item</FieldLabel>
          <Input
            id={`${uid}-name`}
            type="text"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${uid}-name-error` : undefined}
          />
          {nameError && (
            <FieldError id={`${uid}-name-error`}>{nameError}</FieldError>
          )}
        </Field>

        <SelectField
          label="Unidade"
          value={unitChoice}
          onValueChange={(value) => {
            if (isUnitChoice(value)) setUnitChoice(value);
          }}
          options={UNIT_OPTIONS}
          error={fieldErrors.unitChoice}
        />

        {unitChoice === OTHER_UNIT && (
          <Field data-invalid={otherError ? true : undefined}>
            <FieldLabel htmlFor={`${uid}-unitOther`}>Outra unidade</FieldLabel>
            <Input
              id={`${uid}-unitOther`}
              type="text"
              autoComplete="off"
              value={unitOther}
              onChange={(event) => setUnitOther(event.target.value)}
              aria-invalid={otherError ? true : undefined}
              aria-describedby={
                otherError ? `${uid}-unitOther-error` : undefined
              }
            />
            {otherError && (
              <FieldError id={`${uid}-unitOther-error`}>
                {otherError}
              </FieldError>
            )}
          </Field>
        )}

        <ChoiceGroup
          legend="Tipo"
          value={kind}
          onValueChange={setKind}
          options={KIND_OPTIONS}
          description={ITEM_KIND_HELP[kind]}
        />

        {formError && <FieldError>{formError}</FieldError>}

        <Button type="submit" size="lg" disabled={pending}>
          {submitLabel}
        </Button>
      </FieldGroup>
    </form>
  );
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `bun run test -- src/components/admin/items/ItemForm.test.tsx`
Expected: PASS (13 testes)

- [ ] **Step 13: Write the failing test do ItemRowActions**

Crie `src/components/admin/items/ItemRowActions.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import type { ItemRow } from "@/features/admin/items";
import { ItemRowActions } from "./ItemRowActions";

const mocks = vi.hoisted(() => ({
  createItemAction: vi.fn(),
  updateItemAction: vi.fn(),
  setItemActiveAction: vi.fn(),
  moveItemAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/itens/actions", () => ({
  createItemAction: mocks.createItemAction,
  updateItemAction: mocks.updateItemAction,
  setItemActiveAction: mocks.setItemActiveAction,
  moveItemAction: mocks.moveItemAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const ITEM: ItemRow = {
  id: "7a2e3b4c-5d6e-4f70-8b9c-1d2e3f4a5b6c",
  sectorId: "6f1d2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b",
  name: "Rede",
  unit: "rolo",
  kind: "control",
  sortOrder: 2,
  active: true,
  canMoveUp: true,
  canMoveDown: true,
};

function setup(item: Partial<ItemRow> = {}) {
  render(
    <TooltipProvider>
      <ItemRowActions item={{ ...ITEM, ...item }} />
    </TooltipProvider>,
  );
}

describe("ItemRowActions", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.moveItemAction.mockResolvedValue({ ok: true });
  });

  it("primeiro da lista não sobe", () => {
    setup({ canMoveUp: false });
    expect(screen.getByRole("button", { name: "Subir Rede" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Descer Rede" })).toBeEnabled();
  });

  it("último da lista não desce", () => {
    setup({ canMoveDown: false });
    expect(screen.getByRole("button", { name: "Subir Rede" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Descer Rede" })).toBeDisabled();
  });

  it("subir chama a action sem toast de sucesso", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Subir Rede" }));
    await waitFor(() =>
      expect(mocks.moveItemAction).toHaveBeenCalledWith({
        id: ITEM.id,
        direction: "up",
      }),
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("erro ao mover aparece em toast", async () => {
    mocks.moveItemAction.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Item não encontrado. Atualize a página.",
    });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Descer Rede" }));
    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Item não encontrado. Atualize a página.",
      ),
    );
  });

  it("Editar abre o diálogo com a unidade da lista selecionada", async () => {
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Editar Rede" }));
    expect(
      await screen.findByRole("dialog", { name: "Editar item" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do item")).toHaveValue("Rede");
    expect(screen.getByLabelText("Unidade")).toHaveValue("rolo");
    expect(screen.queryByLabelText("Outra unidade")).not.toBeInTheDocument();
  });

  it("Editar um item com unidade antiga abre em 'Outro…' (splitUnit)", async () => {
    setup({ unit: "folha grande" });
    await userEvent.click(screen.getByRole("button", { name: "Editar Rede" }));
    await screen.findByRole("dialog", { name: "Editar item" });
    expect(screen.getByLabelText("Unidade")).toHaveValue("outro");
    expect(screen.getByLabelText("Outra unidade")).toHaveValue("folha grande");
  });

  it("salvar a edição chama updateItemAction e fecha o diálogo", async () => {
    mocks.updateItemAction.mockResolvedValue({ ok: true });
    setup();
    await userEvent.click(screen.getByRole("button", { name: "Editar Rede" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Salvar alterações" }),
    );
    await waitFor(() =>
      expect(mocks.updateItemAction).toHaveBeenCalledWith({
        id: ITEM.id,
        name: "Rede",
        unitChoice: "rolo",
        unitOther: "",
        kind: "control",
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("Desativar chama a action e avisa 'Item desativado.'", async () => {
    mocks.setItemActiveAction.mockResolvedValue({ ok: true });
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Desativar Rede" }),
    );
    await waitFor(() =>
      expect(mocks.setItemActiveAction).toHaveBeenCalledWith({
        id: ITEM.id,
        active: false,
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Item desativado.");
  });

  it("item inativo mostra Reativar e avisa 'Item reativado.'", async () => {
    mocks.setItemActiveAction.mockResolvedValue({ ok: true });
    setup({ active: false });
    await userEvent.click(
      screen.getByRole("button", { name: "Reativar Rede" }),
    );
    await waitFor(() =>
      expect(mocks.setItemActiveAction).toHaveBeenCalledWith({
        id: ITEM.id,
        active: true,
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Item reativado.");
  });

  it("falha ao desativar mostra o erro e não avisa sucesso", async () => {
    mocks.setItemActiveAction.mockResolvedValue({
      ok: false,
      code: "NOT_FOUND",
      message: "Item não encontrado. Atualize a página.",
    });
    setup();
    await userEvent.click(
      screen.getByRole("button", { name: "Desativar Rede" }),
    );
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled());
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 14: Run test to verify it fails**

Run: `bun run test -- src/components/admin/items/ItemRowActions.test.tsx`
Expected: FAIL com `Failed to resolve import "./ItemRowActions" from "src/components/admin/items/ItemRowActions.test.tsx". Does the file exist?`

- [ ] **Step 15: Write minimal implementation do ItemRowActions**

Crie `src/components/admin/items/ItemRowActions.tsx`:

```tsx
"use client";

import {
  moveItemAction,
  setItemActiveAction,
} from "@/app/(app)/admin/itens/actions";
import { ActiveToggleButton } from "@/components/admin/ActiveToggleButton";
import { EditDialog } from "@/components/admin/EditDialog";
import { MoveButtons } from "@/components/admin/MoveButtons";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { splitUnit } from "@/features/admin/itemOptions";
import type { ItemRow } from "@/features/admin/items";

import { ItemForm } from "./ItemForm";

type ItemRowActionsProps = { item: ItemRow };

export function ItemRowActions({ item }: ItemRowActionsProps) {
  const { pending, run } = useAdminAction();
  const { choice, other } = splitUnit(item.unit);

  return (
    <>
      <MoveButtons
        label={item.name}
        canMoveUp={item.canMoveUp}
        canMoveDown={item.canMoveDown}
        pending={pending}
        onMove={(direction) =>
          run(() => moveItemAction({ id: item.id, direction }))
        }
      />
      <EditDialog title="Editar item" name={item.name}>
        {(close) => (
          <ItemForm
            sectorId={item.sectorId}
            initial={{
              id: item.id,
              name: item.name,
              unitChoice: choice,
              unitOther: other,
              kind: item.kind,
            }}
            submitLabel="Salvar alterações"
            onDone={close}
          />
        )}
      </EditDialog>
      <ActiveToggleButton
        entity="Item"
        name={item.name}
        active={item.active}
        onToggle={(nextActive) =>
          setItemActiveAction({ id: item.id, active: nextActive })
        }
      />
    </>
  );
}
```

- [ ] **Step 16: Run test to verify it passes**

Run: `bun run test -- src/components/admin/items/ItemRowActions.test.tsx`
Expected: PASS (10 testes)

- [ ] **Step 17: Write the failing test do ItemsAdmin**

Crie `src/components/admin/items/ItemsAdmin.test.tsx`:

```tsx
import type { PGlite } from "@electric-sql/pglite";
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/ui/tooltip";
import { db } from "@/db";
import { authzOf } from "../../../../test/authz";
import { resetDb } from "../../../../test/db";
import { insertItem, insertSector } from "../../../../test/fixtures";
import { ItemsAdmin } from "./ItemsAdmin";

const NOT_FOUND = new Error("NEXT_HTTP_ERROR_FALLBACK;404");

const mocks = vi.hoisted(
  (): {
    requireAdmin: ReturnType<typeof vi.fn>;
    client: PGlite | undefined;
  } => ({ requireAdmin: vi.fn(), client: undefined }),
);

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../../test/db");
  const { client, db } = await createTestDb();
  mocks.client = client;
  return { db };
});
vi.mock("@/app/(app)/admin/itens/actions", () => ({
  createItemAction: vi.fn(),
  updateItemAction: vi.fn(),
  setItemActiveAction: vi.fn(),
  moveItemAction: vi.fn(),
}));

async function renderPage(search: Record<string, string> = {}) {
  render(
    <TooltipProvider>
      {await ItemsAdmin({ searchParams: Promise.resolve(search) })}
    </TooltipProvider>,
  );
}

function rowOf(name: string): HTMLElement {
  const row = screen.getByText(name).closest("li");
  if (!row) throw new Error(`linha ${name} ausente`);
  return row;
}

describe("ItemsAdmin", () => {
  beforeEach(async () => {
    if (mocks.client) await resetDb(mocks.client);
    mocks.requireAdmin.mockReset();
    mocks.requireAdmin.mockResolvedValue(authzOf({ role: "admin" }));
  });

  it("operador: requireAdmin lança (notFound) e nada é lido", async () => {
    mocks.requireAdmin.mockRejectedValue(NOT_FOUND);
    await expect(
      ItemsAdmin({ searchParams: Promise.resolve({}) }),
    ).rejects.toBe(NOT_FOUND);
  });

  it("sem setor ativo: título, estado vazio e link para Setores", async () => {
    await insertSector(db, "Parado", { active: false });
    await renderPage();

    expect(
      screen.getByRole("heading", { level: 1, name: "Itens" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nenhum setor ativo.")).toBeInTheDocument();
    expect(
      screen.getByText("Cadastre ou reative um setor para criar itens."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Setores" }),
    ).toHaveAttribute("href", "/admin/setores");
    expect(screen.queryByLabelText("Nome do item")).not.toBeInTheDocument();
  });

  it("setor sem itens: formulário com padrões e estado vazio", async () => {
    await insertSector(db, "ULD");
    await renderPage();

    expect(screen.getByText("Novo item")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do item")).toHaveValue("");
    expect(screen.getByLabelText("Unidade")).toHaveValue("unidade");
    expect(screen.getByText("Nenhum item neste setor.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Crie o primeiro item acima. É o que o operador conta na passagem.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Criar item" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para Administração" }),
    ).toHaveAttribute("href", "/admin");
  });

  it("lista itens com unidade, tipo e selo de inativo", async () => {
    const uld = await insertSector(db, "ULD");
    await insertItem(db, {
      sectorId: uld.id,
      name: "Redes danificadas",
      unit: "unidade",
      kind: "control",
    });
    await insertItem(db, {
      sectorId: uld.id,
      name: "Rolos de fita",
      unit: "rolo",
      kind: "stock",
    });
    await insertItem(db, {
      sectorId: uld.id,
      name: "Antigo",
      unit: "folha grande",
      active: false,
    });
    await renderPage();

    expect(
      within(rowOf("Redes danificadas")).getByText("Controle"),
    ).toBeInTheDocument();
    expect(
      within(rowOf("Redes danificadas")).getByText("Unidade"),
    ).toBeInTheDocument();
    expect(
      within(rowOf("Rolos de fita")).getByText("Estoque"),
    ).toBeInTheDocument();
    expect(
      within(rowOf("Rolos de fita")).getByText("Rolo"),
    ).toBeInTheDocument();
    expect(within(rowOf("Antigo")).getByText("Inativo")).toBeInTheDocument();
    expect(
      within(rowOf("Antigo")).getByText("folha grande"),
    ).toBeInTheDocument();
    expect(
      within(rowOf("Antigo")).getByRole("button", { name: "Reativar Antigo" }),
    ).toBeInTheDocument();
    expect(
      within(rowOf("Redes danificadas")).getByRole("button", {
        name: "Subir Redes danificadas",
      }),
    ).toBeDisabled();
  });

  it("filtro ?setor= mostra só o setor pedido e marca o seletor", async () => {
    const almox = await insertSector(db, "Almoxarifado");
    const uld = await insertSector(db, "ULD");
    await insertItem(db, { sectorId: almox.id, name: "Só do almoxarifado" });
    await insertItem(db, { sectorId: uld.id, name: "Só da ULD" });

    await renderPage({ setor: uld.id });

    expect(screen.getByText("Só da ULD")).toBeInTheDocument();
    expect(screen.queryByText("Só do almoxarifado")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ULD" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Almoxarifado" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("setor inativo na URL cai no primeiro setor ativo", async () => {
    const almox = await insertSector(db, "Almoxarifado");
    const off = await insertSector(db, "Parado", { active: false });
    await insertItem(db, { sectorId: almox.id, name: "Do almoxarifado" });
    await insertItem(db, { sectorId: off.id, name: "Do parado" });

    await renderPage({ setor: off.id });

    expect(screen.getByText("Do almoxarifado")).toBeInTheDocument();
    expect(screen.queryByText("Do parado")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Parado" }),
    ).not.toBeInTheDocument();
  });

  it("pagina: a segunda página mostra Anterior e 'Página 2 de 2' mantendo o setor", async () => {
    const uld = await insertSector(db, "ULD");
    for (let n = 1; n <= 51; n += 1) {
      await insertItem(db, {
        sectorId: uld.id,
        name: `I${String(n).padStart(2, "0")}`,
      });
    }

    await renderPage({ setor: uld.id, pagina: "2" });

    expect(screen.getByText("Página 2 de 2")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      `/admin/itens?setor=${uld.id}`,
    );
    expect(screen.getByText("I51")).toBeInTheDocument();
    expect(screen.queryByText("I01")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 18: Run test to verify it fails**

Run: `bun run test -- src/components/admin/items/ItemsAdmin.test.tsx`
Expected: FAIL com `Failed to resolve import "./ItemsAdmin" from "src/components/admin/items/ItemsAdmin.test.tsx". Does the file exist?`

- [ ] **Step 19: Write minimal implementation do ItemsAdmin**

Crie `src/components/admin/items/ItemsAdmin.tsx`:

```tsx
import { AdminListRow } from "@/components/admin/AdminListRow";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";
import { SectorSwitcher } from "@/components/admin/SectorSwitcher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/db";
import {
  ITEM_FORM_DEFAULTS,
  ITEM_KIND_LABELS,
  ITEM_UNIT_LABELS,
  OTHER_UNIT,
  splitUnit,
} from "@/features/admin/itemOptions";
import { listItems } from "@/features/admin/items";
import { parsePage } from "@/features/admin/pagination";
import {
  listActiveSectors,
  resolveSectorFilter,
} from "@/features/admin/sectors";
import { requireAdmin } from "@/lib/auth/session";

import { ItemForm } from "./ItemForm";
import { ItemRowActions } from "./ItemRowActions";

// Mostra o rótulo da lista ("Rolo"), igual ao select; "Outro" mostra o texto gravado.
function unitLabel(unit: string): string {
  const { choice } = splitUnit(unit);
  return choice === OTHER_UNIT ? unit : ITEM_UNIT_LABELS[choice];
}

type ItemsAdminProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const TITLE = "Itens";
const DESCRIPTION = "O que se conta na passagem de cada setor.";

export async function ItemsAdmin({ searchParams }: ItemsAdminProps) {
  await requireAdmin();
  const params = await searchParams;
  const sectors = await listActiveSectors(db);
  const selected = resolveSectorFilter(sectors, params.setor);

  if (!selected) {
    return (
      <div className="flex flex-col gap-6">
        <AdminPageHeader
          title={TITLE}
          description={DESCRIPTION}
          backHref="/admin"
        />
        <EmptyState
          title="Nenhum setor ativo."
          description="Cadastre ou reative um setor para criar itens."
          action={{ label: "Ir para Setores", href: "/admin/setores" }}
        />
      </div>
    );
  }

  const page = await listItems(db, {
    sectorId: selected.id,
    page: parsePage(params.pagina),
  });

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title={TITLE}
        description={DESCRIPTION}
        backHref="/admin"
      />
      <SectorSwitcher
        sectors={sectors}
        selectedId={selected.id}
        pathname="/admin/itens"
      />

      <Card>
        <CardHeader>
          <CardTitle>Novo item</CardTitle>
        </CardHeader>
        <CardContent>
          <ItemForm
            // Formulário limpo (nome vazio, padrões) depois de cada criação.
            key={`${selected.id}-${page.total}`}
            sectorId={selected.id}
            initial={ITEM_FORM_DEFAULTS}
            submitLabel="Criar item"
          />
        </CardContent>
      </Card>

      {page.rows.length === 0 ? (
        <EmptyState
          title="Nenhum item neste setor."
          description="Crie o primeiro item acima. É o que o operador conta na passagem."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {page.rows.map((item) => (
            <AdminListRow
              key={item.id}
              title={item.name}
              inactive={!item.active}
              subtitle={unitLabel(item.unit)}
              badges={
                <Badge variant="outline">{ITEM_KIND_LABELS[item.kind]}</Badge>
              }
              actions={<ItemRowActions item={item} />}
            />
          ))}
        </ul>
      )}

      <Pagination
        page={page.page}
        pageCount={page.pageCount}
        pathname="/admin/itens"
        params={{ setor: selected.id }}
      />
    </div>
  );
}
```

- [ ] **Step 20: Run test to verify it passes**

Run: `bun run test -- src/components/admin/items/ItemsAdmin.test.tsx`
Expected: PASS (7 testes)

Este teste usa o PGlite real (`createTestDb`); o `globalSetup` do projeto `dom` (Tarefa 5, Step 9) gera o dump do schema, então o arquivo funciona sozinho.

- [ ] **Step 21: Criar a página `/admin/itens`**

Crie `src/app/(app)/admin/itens/page.tsx`:

```tsx
import { Suspense } from "react";

import { AdminListSkeleton } from "@/components/admin/AdminListSkeleton";
import { ItemsAdmin } from "@/components/admin/items/ItemsAdmin";
import { Skeleton } from "@/components/ui/skeleton";

// Sem `metadata` de propósito (o <title> sairia antes do portão) e com o <h1>
// dentro do Suspense: quem não é admin vê "Página não encontrada" e nada mais.
export default function ItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ItemsAdmin searchParams={searchParams} />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <AdminListSkeleton />
    </div>
  );
}
```

- [ ] **Step 22: Run test do guarda de páginas**

Run: `bun run test -- src/app/appPagesAuth.test.ts`
Expected: PASS (todos os testes do arquivo, incluindo o caso `src/app/(app)/admin/itens/page.tsx`)

- [ ] **Step 23: Atualizar `.context/ui-registry.md`**

Com a ferramenta Edit, em `.context/ui-registry.md`, troque a linha `## 3. Componentes de domínio — \`src/features/<domínio>/components\`` por este bloco seguido da mesma linha (insira os três itens antes dela, depois dos itens da Tarefa 7):

```markdown
### ItemsAdmin
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/items/ItemsAdmin.tsx`
- **Propósito:** conteúdo da página `/admin/itens`: cadastro e lista de itens por setor.
- **Como funciona:** Server Component async; chama `requireAdmin()`, lê `?setor=` e `?pagina=`, mostra o seletor de setor, o
  cartão "Novo item" (padrões de `ITEM_FORM_DEFAULTS`) e a lista paginada. Cada linha mostra nome, unidade, selo do tipo
  ("Controle"/"Estoque") e "Inativo". Sem setor ativo, mostra o estado vazio com link "Ir para Setores". O formulário remonta
  (`key`) a cada criação para voltar limpo.
- **Usa:** `AdminPageHeader`, `SectorSwitcher`, `AdminListRow`, `EmptyState`, `Pagination`, `Card`, `Badge`.
- **Histórico:** 2026-11-21 — criado (Fase 2).

### ItemForm
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/items/ItemForm.tsx`
- **Propósito:** criar e editar item (mesmo formulário).
- **Como funciona:** client, controlado; `initial.id` presente = edição. "Unidade" é `SelectField` (unidade, rolo, par, pacote,
  caixa, saco, metro, kg e "Outro…"); com "Outro…" aparece "Outra unidade" (texto livre, ≤ 20). "Tipo" é `ChoiceGroup`
  (Controle | Estoque, nunca fica vazio) com a ajuda do tipo escolhido. Valida com o mesmo schema Zod do servidor; erros por
  campo e erro geral ficam inline e o digitado nunca se perde.
- **Usa:** `Field`, `Input`, `Button`, `SelectField`, `ChoiceGroup`, `useAdminAction`, `sonner`.
- **Histórico:** 2026-11-21 — criado (Fase 2).

### ItemRowActions
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/items/ItemRowActions.tsx`
- **Propósito:** ações de uma linha de item.
- **Como funciona:** client; `MoveButtons` (↑ ↓ pela posição absoluta no setor), `EditDialog` "Editar item" com `ItemForm`
  (a unidade vem de `splitUnit`: fora da lista abre em "Outro…" com o texto) e `ActiveToggleButton`.
- **Usa:** `MoveButtons`, `EditDialog`, `ActiveToggleButton`, `ItemForm`.
- **Histórico:** 2026-11-21 — criado (Fase 2).

## 3. Componentes de domínio — `src/features/<domínio>/components`
```

- [ ] **Step 24: Rodar check-types, lint e a suíte inteira**

Run: `bun run check-types && bun run lint && bun run test`
Expected: os três verdes. Se um teste de componente antigo (por exemplo `InviteSignup.test.tsx`) estourar o tempo limite de 5 s com a máquina carregada, rode o arquivo sozinho para confirmar que é lentidão e não regressão.

- [ ] **Step 25: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-8.txt` (texto exato abaixo) e rode:
```bash
git add src/features/admin/items.ts src/features/admin/items.test.ts "src/app/(app)/admin/itens" src/components/admin/items .context/ui-registry.md
git commit -F .git/sdd/msg-task-8.txt
```
Mensagem:
```text
feat(admin): itens com unidade por escolha e ordem por botões

Domínio (listar, criar, editar, ativar, mover), actions que resolvem a
unidade (lista ou "Outro…"), página /admin/itens, formulário e ações de
linha. Mesmo nome em outro setor passa; nome repetido no setor avisa se o
conflitante está inativo.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 9: Equipe — pessoas

**Files:**
- Create: `src/features/admin/people.ts`
- Create: `src/app/(app)/admin/equipe/actions.ts` (`updatePersonAction`, `setPersonActiveAction`; a Tarefa 10 acrescenta as de convite)
- Create: `src/app/(app)/admin/equipe/page.tsx`
- Create: `src/components/admin/team/roleOptions.ts`
- Create: `src/components/admin/team/TeamAdmin.tsx` (só a seção Pessoas; a Tarefa 10 acrescenta convites)
- Create: `src/components/admin/team/PersonForm.tsx`
- Create: `src/components/admin/team/PersonRowActions.tsx`
- Modify: `.context/ui-registry.md` (três entradas novas no fim da seção 2, antes de `## 3. Componentes de domínio`)
- Test: `src/features/admin/people.test.ts`
- Test: `src/app/(app)/admin/equipe/actions.test.ts`
- Test: `src/components/admin/team/PersonForm.test.tsx`
- Test: `src/components/admin/team/PersonRowActions.test.tsx`
- Test: `src/components/admin/team/TeamAdmin.test.tsx`

**Interfaces:**
- Consumes (das Tarefas 1 a 6, exatamente como no contrato):
  - `test/fixtures.ts`: `insertSector(db, name?, { active? })`, `insertUser(db, { role, sectorId, name?, email?, deactivatedAt? })`, `insertSession(db, { userId, expiresAt? }): Promise<{ id: string; token: string }>`
  - `test/authz.ts`: `authzOf({ role, userId?, sectorId?, name?, email? }): Authz`; `test/db.ts`: `createTestDb`, `resetDb`
  - `src/features/admin/result.ts`: `AdminResult`, `ok`, `fail`, `FieldErrors`
  - `src/features/admin/messages.ts`: `notFoundMessage`, `LAST_ADMIN_MESSAGE`, `SELF_DEACTIVATE_MESSAGE`, `SELF_ROLE_MESSAGE`, `SECTOR_REQUIRED_MESSAGE`, `SECTOR_INACTIVE_MESSAGE`
  - `src/features/admin/pagination.ts`: `PAGE_SIZE`, `Page<T>`, `resolvePage`, `parsePage`, `buildPageHref`
  - `src/features/admin/schemas.ts`: `updatePersonSchema`, `setPersonActiveSchema`, `firstFieldErrors`
  - `src/features/admin/runAdminAction.ts`: `runAdminAction({ actor, schema, input, run })` (importa `db` de `@/db`; os testes das actions trocam esse módulo por PGlite)
  - `src/features/admin/sectors.ts`: `listActiveSectors(db): Promise<SectorChoice[]>`, tipo `SectorChoice`
  - `src/components/admin/*`: `AdminPageHeader`, `AdminListRow`, `EmptyState`, `Pagination`, `ChoiceGroup`, `SelectField`, `EditDialog`, `ConfirmDialog`, `useAdminAction`
  - `src/lib/auth/session.ts`: `requireAdmin(): Promise<Authz>`
- Produces:
  - `src/features/admin/people.ts`: `type PersonRow`, `listPeople(db, { page })`, `updatePerson(db, { actorId, userId, role, sectorId })`, `setPersonActive(db, { actorId, userId, active }, now)` (assinaturas do contrato); a mensagem `PERSON_SECTOR_INACTIVE_MESSAGE` vem de `messages.ts` (Tarefa 2)
  - `updatePersonAction(input: unknown): Promise<AdminResult>` e `setPersonActiveAction(input: unknown): Promise<AdminResult>` em `equipe/actions.ts`
  - `src/components/admin/team/roleOptions.ts` (arquivo novo, fora do contrato): `ROLE_LABELS: Readonly<Record<Role, string>>` e `ROLE_OPTIONS: readonly { value: Role; label: string }[]` (Operador primeiro)
  - `PersonForm(props: { person: PersonRow; sectors: readonly SectorChoice[]; onDone: () => void })`, `PersonRowActions(props: { person: PersonRow; sectors: readonly SectorChoice[] })`, `TeamAdmin(props: { searchParams: Promise<Record<string, string | string[] | undefined>> })`

- [ ] **Step 1: Write the failing test do domínio (`people.test.ts`)**

Crie `src/features/admin/people.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { session, user } from "@/db/schema/auth";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertSector,
  insertSession,
  insertUser,
} from "../../../test/fixtures";
import {
  LAST_ADMIN_MESSAGE,
  PERSON_SECTOR_INACTIVE_MESSAGE,
  SECTOR_INACTIVE_MESSAGE,
  SECTOR_REQUIRED_MESSAGE,
  SELF_DEACTIVATE_MESSAGE,
  SELF_ROLE_MESSAGE,
} from "./messages";
import { PAGE_SIZE } from "./pagination";
import { listPeople, setPersonActive, updatePerson } from "./people";

const NOW = new Date("2026-11-21T12:00:00.000Z");

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

async function readUser(id: string) {
  const [row] = await db.select().from(user).where(eq(user.id, id));
  if (!row) throw new Error("usuário não encontrado");
  return row;
}

async function countSessions(userId: string): Promise<number> {
  const rows = await db
    .select({ id: session.id })
    .from(session)
    .where(eq(session.userId, userId));
  return rows.length;
}

describe("listPeople", () => {
  it("lista ativos antes de inativos, depois por nome sem diferença de caixa", async () => {
    const setor = await insertSector(db, "Almoxarifado");
    await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
      name: "bruno Fictício",
    });
    await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
      name: "Ana Fictícia",
      deactivatedAt: NOW,
    });
    await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
      name: "Alvaro Fictício",
    });
    await insertUser(db, {
      role: "admin",
      sectorId: null,
      name: "Carla Admin",
    });

    const page = await listPeople(db, { page: 1 });

    expect(page.rows.map((row) => row.name)).toEqual([
      "Alvaro Fictício",
      "bruno Fictício",
      "Carla Admin",
      "Ana Fictícia",
    ]);
    expect(page.rows.map((row) => row.active)).toEqual([
      true,
      true,
      true,
      false,
    ]);
    expect(page.total).toBe(4);
    expect(page.pageSize).toBe(PAGE_SIZE);
  });

  it("traz setor e se ele está ativo; admin vem sem setor", async () => {
    const ativo = await insertSector(db, "Ativo");
    const inativo = await insertSector(db, "Inativo", { active: false });
    await insertUser(db, {
      role: "operator",
      sectorId: ativo.id,
      name: "A Operadora",
    });
    await insertUser(db, {
      role: "operator",
      sectorId: inativo.id,
      name: "B Operador",
    });
    await insertUser(db, { role: "admin", sectorId: null, name: "C Admin" });

    const { rows } = await listPeople(db, { page: 1 });

    expect(rows[0]).toMatchObject({
      sectorName: "Ativo",
      sectorActive: true,
      role: "operator",
    });
    expect(rows[1]).toMatchObject({
      sectorName: "Inativo",
      sectorActive: false,
    });
    expect(rows[2]).toMatchObject({
      sectorId: null,
      sectorName: null,
      sectorActive: null,
      role: "admin",
    });
  });

  it("banco vazio: página 1 de 1 sem linhas", async () => {
    const page = await listPeople(db, { page: 1 });
    expect(page).toMatchObject({ rows: [], total: 0, page: 1, pageCount: 1 });
  });

  it("pagina de 50 em 50 e limita a página pedida ao intervalo", async () => {
    const setor = await insertSector(db);
    for (let index = 0; index < PAGE_SIZE + 1; index++) {
      await insertUser(db, {
        role: "operator",
        sectorId: setor.id,
        name: `Pessoa ${String(index).padStart(3, "0")}`,
      });
    }

    const first = await listPeople(db, { page: 1 });
    const second = await listPeople(db, { page: 2 });
    const beyond = await listPeople(db, { page: 99 });

    expect(first.rows).toHaveLength(PAGE_SIZE);
    expect(first.pageCount).toBe(2);
    expect(second.rows).toHaveLength(1);
    expect(second.rows[0]?.name).toBe("Pessoa 050");
    expect(beyond.page).toBe(2);
    expect(beyond.rows).toHaveLength(1);
  });
});

describe("updatePerson", () => {
  it("operador troca de setor", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const a = await insertSector(db, "A");
    const b = await insertSector(db, "B");
    const person = await insertUser(db, { role: "operator", sectorId: a.id });

    const result = await updatePerson(db, {
      actorId: admin.id,
      userId: person.id,
      role: "operator",
      sectorId: b.id,
    });

    expect(result).toEqual({ ok: true });
    expect((await readUser(person.id)).sectorId).toBe(b.id);
  });

  it("operador vira administrador e o setor é limpo", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
    });

    const result = await updatePerson(db, {
      actorId: admin.id,
      userId: person.id,
      role: "admin",
      sectorId: setor.id,
    });

    expect(result).toEqual({ ok: true });
    const saved = await readUser(person.id);
    expect(saved.role).toBe("admin");
    expect(saved.sectorId).toBeNull();
  });

  it("administrador vira operador com setor ativo (há outro admin)", async () => {
    const actor = await insertUser(db, { role: "admin", sectorId: null });
    const other = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);

    const result = await updatePerson(db, {
      actorId: actor.id,
      userId: other.id,
      role: "operator",
      sectorId: setor.id,
    });

    expect(result).toEqual({ ok: true });
    expect(await readUser(other.id)).toMatchObject({
      role: "operator",
      sectorId: setor.id,
    });
  });

  it("operador sem setor é recusado (SECTOR_REQUIRED) e nada muda", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
    });

    const result = await updatePerson(db, {
      actorId: admin.id,
      userId: person.id,
      role: "operator",
      sectorId: null,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "SECTOR_REQUIRED",
      message: SECTOR_REQUIRED_MESSAGE,
    });
    expect((await readUser(person.id)).sectorId).toBe(setor.id);
  });

  it("setor inativo é recusado (SECTOR_INACTIVE)", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const ativo = await insertSector(db);
    const inativo = await insertSector(db, "Fechado", { active: false });
    const person = await insertUser(db, {
      role: "operator",
      sectorId: ativo.id,
    });

    const result = await updatePerson(db, {
      actorId: admin.id,
      userId: person.id,
      role: "operator",
      sectorId: inativo.id,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "SECTOR_INACTIVE",
      message: SECTOR_INACTIVE_MESSAGE,
    });
    expect((await readUser(person.id)).sectorId).toBe(ativo.id);
  });

  it("setor inexistente é recusado (NOT_FOUND)", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
    });

    const result = await updatePerson(db, {
      actorId: admin.id,
      userId: person.id,
      role: "operator",
      sectorId: "00000000-0000-4000-8000-000000000000",
    });

    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("pessoa inexistente é recusada (NOT_FOUND)", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });

    const result = await updatePerson(db, {
      actorId: admin.id,
      userId: "nao-existe",
      role: "admin",
      sectorId: null,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
      message: "Pessoa não encontrada. Atualize a página.",
    });
  });

  it("o admin não rebaixa a própria conta (SELF_CHANGE), mesmo havendo outro admin", async () => {
    const me = await insertUser(db, { role: "admin", sectorId: null });
    await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);

    const result = await updatePerson(db, {
      actorId: me.id,
      userId: me.id,
      role: "operator",
      sectorId: setor.id,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "SELF_CHANGE",
      message: SELF_ROLE_MESSAGE,
    });
    expect((await readUser(me.id)).role).toBe("admin");
  });

  it("não rebaixa o último admin ativo (LAST_ADMIN), ainda que haja admin inativo", async () => {
    const lonely = await insertUser(db, { role: "admin", sectorId: null });
    await insertUser(db, {
      role: "admin",
      sectorId: null,
      deactivatedAt: NOW,
    });
    const setor = await insertSector(db);

    const result = await updatePerson(db, {
      actorId: "outra-conta",
      userId: lonely.id,
      role: "operator",
      sectorId: setor.id,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "LAST_ADMIN",
      message: LAST_ADMIN_MESSAGE,
    });
    expect((await readUser(lonely.id)).role).toBe("admin");
  });

  it("sem mudança real devolve ok e não altera a pessoa", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
    });

    const result = await updatePerson(db, {
      actorId: admin.id,
      userId: person.id,
      role: "operator",
      sectorId: setor.id,
    });

    expect(result).toEqual({ ok: true });
    expect(await readUser(person.id)).toMatchObject({
      role: "operator",
      sectorId: setor.id,
    });
  });

  it("editar-se sem mudar o papel é permitido", async () => {
    const me = await insertUser(db, { role: "admin", sectorId: null });

    const result = await updatePerson(db, {
      actorId: me.id,
      userId: me.id,
      role: "admin",
      sectorId: null,
    });

    expect(result).toEqual({ ok: true });
  });
});

describe("setPersonActive", () => {
  it("desativa o operador e grava a hora", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
    });

    const result = await setPersonActive(
      db,
      { actorId: admin.id, userId: person.id, active: false },
      NOW,
    );

    expect(result).toEqual({ ok: true });
    expect((await readUser(person.id)).deactivatedAt).toEqual(NOW);
  });

  it("P11: apaga TODAS as sessões da pessoa e só as dela", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
    });
    const bystander = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
    });
    await insertSession(db, { userId: person.id });
    await insertSession(db, { userId: person.id });
    await insertSession(db, { userId: person.id });
    await insertSession(db, { userId: bystander.id });
    await insertSession(db, { userId: admin.id });

    await setPersonActive(
      db,
      { actorId: admin.id, userId: person.id, active: false },
      NOW,
    );

    expect(await countSessions(person.id)).toBe(0);
    expect(await countSessions(bystander.id)).toBe(1);
    expect(await countSessions(admin.id)).toBe(1);
  });

  it("recusa não apaga sessões (SELF_CHANGE)", async () => {
    const me = await insertUser(db, { role: "admin", sectorId: null });
    await insertUser(db, { role: "admin", sectorId: null });
    await insertSession(db, { userId: me.id });

    const result = await setPersonActive(
      db,
      { actorId: me.id, userId: me.id, active: false },
      NOW,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "SELF_CHANGE",
      message: SELF_DEACTIVATE_MESSAGE,
    });
    expect(await countSessions(me.id)).toBe(1);
    expect((await readUser(me.id)).deactivatedAt).toBeNull();
  });

  it("dois admins que se desativam em sequência: o segundo é recusado (LAST_ADMIN)", async () => {
    const a = await insertUser(db, { role: "admin", sectorId: null });
    const b = await insertUser(db, { role: "admin", sectorId: null });
    await insertSession(db, { userId: a.id });

    const first = await setPersonActive(
      db,
      { actorId: a.id, userId: b.id, active: false },
      NOW,
    );
    const second = await setPersonActive(
      db,
      { actorId: b.id, userId: a.id, active: false },
      NOW,
    );

    expect(first).toEqual({ ok: true });
    expect(second).toMatchObject({
      ok: false,
      code: "LAST_ADMIN",
      message: LAST_ADMIN_MESSAGE,
    });
    expect((await readUser(a.id)).deactivatedAt).toBeNull();
    expect(await countSessions(a.id)).toBe(1);
  });

  it("não desativa o único admin ativo (LAST_ADMIN)", async () => {
    const lonely = await insertUser(db, { role: "admin", sectorId: null });

    const result = await setPersonActive(
      db,
      { actorId: "outra-conta", userId: lonely.id, active: false },
      NOW,
    );

    expect(result).toMatchObject({ ok: false, code: "LAST_ADMIN" });
    expect((await readUser(lonely.id)).deactivatedAt).toBeNull();
  });

  it("pessoa inexistente: NOT_FOUND", async () => {
    const result = await setPersonActive(
      db,
      { actorId: "x", userId: "nao-existe", active: false },
      NOW,
    );
    expect(result).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });

  it("idempotente: desativar quem já está inativo é ok, mantém a hora e limpa sessões que sobraram", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const earlier = new Date("2026-11-01T00:00:00.000Z");
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
      deactivatedAt: earlier,
    });
    await insertSession(db, { userId: person.id });

    const result = await setPersonActive(
      db,
      { actorId: admin.id, userId: person.id, active: false },
      NOW,
    );

    expect(result).toEqual({ ok: true });
    expect((await readUser(person.id)).deactivatedAt).toEqual(earlier);
    expect(await countSessions(person.id)).toBe(0);
  });

  it("idempotente: desativar admin já inativo não cai em LAST_ADMIN", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const gone = await insertUser(db, {
      role: "admin",
      sectorId: null,
      deactivatedAt: NOW,
    });

    const result = await setPersonActive(
      db,
      { actorId: admin.id, userId: gone.id, active: false },
      NOW,
    );

    expect(result).toEqual({ ok: true });
  });

  it("reativa o operador (setor ativo)", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
      deactivatedAt: NOW,
    });

    const result = await setPersonActive(
      db,
      { actorId: admin.id, userId: person.id, active: true },
      NOW,
    );

    expect(result).toEqual({ ok: true });
    expect((await readUser(person.id)).deactivatedAt).toBeNull();
  });

  it("reativar operador com setor inativo é recusado (SECTOR_INACTIVE)", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db, "Fechado", { active: false });
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
      deactivatedAt: NOW,
    });

    const result = await setPersonActive(
      db,
      { actorId: admin.id, userId: person.id, active: true },
      NOW,
    );

    expect(result).toMatchObject({
      ok: false,
      code: "SECTOR_INACTIVE",
      message: PERSON_SECTOR_INACTIVE_MESSAGE,
    });
    expect((await readUser(person.id)).deactivatedAt).toEqual(NOW);
  });

  it("reativar admin não olha setor", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const gone = await insertUser(db, {
      role: "admin",
      sectorId: null,
      deactivatedAt: NOW,
    });

    const result = await setPersonActive(
      db,
      { actorId: admin.id, userId: gone.id, active: true },
      NOW,
    );

    expect(result).toEqual({ ok: true });
    expect((await readUser(gone.id)).deactivatedAt).toBeNull();
  });

  it("idempotente: reativar quem já está ativo é ok", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);
    const person = await insertUser(db, {
      role: "operator",
      sectorId: setor.id,
    });

    const result = await setPersonActive(
      db,
      { actorId: admin.id, userId: person.id, active: true },
      NOW,
    );

    expect(result).toEqual({ ok: true });
  });
});
```

Nota: os nomes do teste de ordenação são sem acento na inicial ("Alvaro") de propósito: o PGlite e o Neon (`C.UTF-8`) ordenam por ponto de código, então "Á" iria depois de "z". `lower()` dobra a caixa; a ordem alfabética com acento não é garantida e não faz parte do contrato.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/features/admin/people.test.ts`
Expected: FAIL com `Cannot find module './people' imported from …/src/features/admin/people.test.ts`

- [ ] **Step 3: Write minimal implementation (`people.ts`)**

Crie `src/features/admin/people.ts`:

```ts
import "server-only";

import { and, asc, count, eq, isNull, sql } from "drizzle-orm";

import { session, user } from "@/db/schema/auth";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import type { Role } from "@/lib/roles";
import {
  LAST_ADMIN_MESSAGE,
  notFoundMessage,
  PERSON_SECTOR_INACTIVE_MESSAGE,
  SECTOR_INACTIVE_MESSAGE,
  SECTOR_REQUIRED_MESSAGE,
  SELF_DEACTIVATE_MESSAGE,
  SELF_ROLE_MESSAGE,
} from "./messages";
import { PAGE_SIZE, type Page, resolvePage } from "./pagination";
import { type AdminResult, fail, ok } from "./result";

export type PersonRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  sectorId: string | null;
  sectorName: string | null;
  sectorActive: boolean | null;
  active: boolean;
};

export async function listPeople(
  db: Db,
  input: { page: number },
): Promise<Page<PersonRow>> {
  const [totalRow] = await db.select({ value: count() }).from(user);
  const total = totalRow?.value ?? 0;
  const { page, pageCount, offset } = resolvePage(total, input.page);

  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      sectorId: user.sectorId,
      sectorName: sector.name,
      sectorActive: sector.active,
      deactivatedAt: user.deactivatedAt,
    })
    .from(user)
    .leftJoin(sector, eq(user.sectorId, sector.id))
    .orderBy(
      sql`(${user.deactivatedAt} is null) desc`,
      asc(sql`lower(${user.name})`),
      asc(user.id),
    )
    .limit(PAGE_SIZE)
    .offset(offset);

  return {
    rows: rows.map(({ deactivatedAt, ...row }) => ({
      ...row,
      active: deactivatedAt === null,
    })),
    total,
    page,
    pageCount,
    pageSize: PAGE_SIZE,
  };
}

// Trava as linhas dos admins ativos até o fim da transação: dois admins que se
// desativam ao mesmo tempo são serializados e o segundo relê só um admin (F2-15).
async function lockActiveAdmins(
  tx: Pick<Db, "select">,
): Promise<{ id: string }[]> {
  return tx
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.role, "admin"), isNull(user.deactivatedAt)))
    .for("update");
}

export async function updatePerson(
  db: Db,
  input: {
    actorId: string;
    userId: string;
    role: Role;
    sectorId: string | null;
  },
): Promise<AdminResult> {
  return db.transaction(async (tx): Promise<AdminResult> => {
    const [target] = await tx
      .select({
        id: user.id,
        role: user.role,
        deactivatedAt: user.deactivatedAt,
      })
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1);
    if (!target) {
      return fail("NOT_FOUND", notFoundMessage("pessoa"));
    }

    let nextSectorId: string | null = null;
    if (input.role === "operator") {
      if (!input.sectorId) {
        return fail("SECTOR_REQUIRED", SECTOR_REQUIRED_MESSAGE, {
          sectorId: SECTOR_REQUIRED_MESSAGE,
        });
      }
      const [chosen] = await tx
        .select({ id: sector.id, active: sector.active })
        .from(sector)
        .where(eq(sector.id, input.sectorId))
        .limit(1)
        .for("share");
      if (!chosen) {
        return fail("NOT_FOUND", notFoundMessage("setor"));
      }
      if (!chosen.active) {
        return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_MESSAGE, {
          sectorId: SECTOR_INACTIVE_MESSAGE,
        });
      }
      nextSectorId = chosen.id;
    }

    const demotesActiveAdmin =
      target.role === "admin" &&
      target.deactivatedAt === null &&
      input.role === "operator";
    if (demotesActiveAdmin) {
      if (input.actorId === input.userId) {
        return fail("SELF_CHANGE", SELF_ROLE_MESSAGE);
      }
      const admins = await lockActiveAdmins(tx);
      if (admins.length <= 1) {
        return fail("LAST_ADMIN", LAST_ADMIN_MESSAGE);
      }
    }

    await tx
      .update(user)
      .set({ role: input.role, sectorId: nextSectorId })
      .where(eq(user.id, input.userId));
    return ok();
  });
}

export async function setPersonActive(
  db: Db,
  input: { actorId: string; userId: string; active: boolean },
  now: Date,
): Promise<AdminResult> {
  return db.transaction(async (tx): Promise<AdminResult> => {
    const [target] = await tx
      .select({
        id: user.id,
        role: user.role,
        sectorId: user.sectorId,
        deactivatedAt: user.deactivatedAt,
      })
      .from(user)
      .where(eq(user.id, input.userId))
      .limit(1);
    if (!target) {
      return fail("NOT_FOUND", notFoundMessage("pessoa"));
    }

    if (!input.active) {
      if (input.actorId === input.userId) {
        return fail("SELF_CHANGE", SELF_DEACTIVATE_MESSAGE);
      }
      if (target.role === "admin" && target.deactivatedAt === null) {
        const admins = await lockActiveAdmins(tx);
        if (admins.length <= 1) {
          return fail("LAST_ADMIN", LAST_ADMIN_MESSAGE);
        }
      }
      await tx
        .update(user)
        .set({ deactivatedAt: now })
        .where(and(eq(user.id, input.userId), isNull(user.deactivatedAt)));
      // P11: sem isto a pessoa desativada seguiria logada até a sessão vencer.
      // Apaga mesmo se ela já estava desativada (sobra de antes da P11).
      await tx.delete(session).where(eq(session.userId, input.userId));
      return ok();
    }

    if (target.deactivatedAt === null) return ok();

    if (target.role === "operator") {
      const [own] = target.sectorId
        ? await tx
            .select({ active: sector.active })
            .from(sector)
            .where(eq(sector.id, target.sectorId))
            .limit(1)
            .for("share")
        : [];
      if (!own?.active) {
        return fail("SECTOR_INACTIVE", PERSON_SECTOR_INACTIVE_MESSAGE);
      }
    }
    await tx
      .update(user)
      .set({ deactivatedAt: null })
      .where(eq(user.id, input.userId));
    return ok();
  });
}
```

Notas de projeto: `lockActiveAdmins` é o `SELECT … FOR UPDATE` do F2-15 (a invariante "nunca zerar os admins ativos" está no SQL; o PGlite não prova concorrência, só a sequência). A ordem de checagem é: pessoa existe, autoedição (`SELF_CHANGE`), último admin (`LAST_ADMIN`). Em `setPersonActive`, o `UPDATE … WHERE deactivated_at IS NULL` mantém a hora original quando já estava inativo (F2-13) e o `DELETE` de sessões roda na mesma transação (P11, F2-16).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- src/features/admin/people.test.ts`
Expected: PASS (27 testes)

- [ ] **Step 5: Write the failing test das actions (`actions.test.ts`)**

Crie `src/app/(app)/admin/equipe/actions.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { session, user } from "@/db/schema/auth";
import { authzOf } from "../../../../../test/authz";
import { resetDb } from "../../../../../test/db";
import {
  insertSector,
  insertSession,
  insertUser,
} from "../../../../../test/fixtures";
import { setPersonActiveAction, updatePersonAction } from "./actions";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  client: null as PGlite | null,
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../../../test/db");
  const created = await createTestDb();
  mocks.client = created.client;
  return { db: created.db };
});

const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";

beforeEach(async () => {
  if (!mocks.client) throw new Error("PGlite não iniciou");
  await resetDb(mocks.client);
  mocks.requireAdmin.mockReset();
  mocks.revalidatePath.mockReset();
});

async function setup() {
  const admin = await insertUser(db, { role: "admin", sectorId: null });
  const sector = await insertSector(db);
  const person = await insertUser(db, {
    role: "operator",
    sectorId: sector.id,
  });
  mocks.requireAdmin.mockResolvedValue(
    authzOf({ role: "admin", userId: admin.id }),
  );
  return { admin, sector, person };
}

describe("updatePersonAction", () => {
  it("operador: requireAdmin lança notFound e o banco não é tocado", async () => {
    const { sector, person } = await setup();
    const other = await insertSector(db);
    mocks.requireAdmin.mockRejectedValue(new Error(NOT_FOUND));

    await expect(
      updatePersonAction({
        userId: person.id,
        role: "operator",
        sectorId: other.id,
      }),
    ).rejects.toThrow(NOT_FOUND);

    const [row] = await db.select().from(user).where(eq(user.id, person.id));
    expect(row?.sectorId).toBe(sector.id);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("entrada inválida volta INVALID_INPUT com o erro no campo", async () => {
    const { person } = await setup();

    const result = await updatePersonAction({
      userId: person.id,
      role: "operator",
      sectorId: null,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Escolha o setor do operador.",
      fieldErrors: { sectorId: "Escolha o setor do operador." },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("lixo no lugar do objeto também volta INVALID_INPUT", async () => {
    await setup();
    const result = await updatePersonAction(null);
    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });

  it("admin muda o setor e a tela é revalidada", async () => {
    const { person } = await setup();
    const other = await insertSector(db);

    const result = await updatePersonAction({
      userId: person.id,
      role: "operator",
      sectorId: other.id,
    });

    expect(result).toEqual({ ok: true });
    const [row] = await db.select().from(user).where(eq(user.id, person.id));
    expect(row?.sectorId).toBe(other.id);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
  });

  it("o admin não rebaixa a si mesmo (SELF_CHANGE) e nada é revalidado", async () => {
    const { admin, sector } = await setup();
    await insertUser(db, { role: "admin", sectorId: null });

    const result = await updatePersonAction({
      userId: admin.id,
      role: "operator",
      sectorId: sector.id,
    });

    expect(result).toMatchObject({ ok: false, code: "SELF_CHANGE" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("setPersonActiveAction", () => {
  it("operador: requireAdmin lança notFound e a pessoa continua ativa com a sessão", async () => {
    const { person } = await setup();
    await insertSession(db, { userId: person.id });
    mocks.requireAdmin.mockRejectedValue(new Error(NOT_FOUND));

    await expect(
      setPersonActiveAction({ userId: person.id, active: false }),
    ).rejects.toThrow(NOT_FOUND);

    const [row] = await db.select().from(user).where(eq(user.id, person.id));
    expect(row?.deactivatedAt).toBeNull();
    const sessions = await db
      .select()
      .from(session)
      .where(eq(session.userId, person.id));
    expect(sessions).toHaveLength(1);
  });

  it("desativa, apaga as sessões e revalida", async () => {
    const { person } = await setup();
    await insertSession(db, { userId: person.id });

    const result = await setPersonActiveAction({
      userId: person.id,
      active: false,
    });

    expect(result).toEqual({ ok: true });
    const [row] = await db.select().from(user).where(eq(user.id, person.id));
    expect(row?.deactivatedAt).not.toBeNull();
    const sessions = await db
      .select()
      .from(session)
      .where(eq(session.userId, person.id));
    expect(sessions).toHaveLength(0);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
  });

  it("quem age vem da sessão: um actorId forjado na entrada é ignorado", async () => {
    const { admin } = await setup();
    const other = await insertUser(db, { role: "admin", sectorId: null });

    const result = await setPersonActiveAction({
      userId: admin.id,
      active: false,
      actorId: other.id,
    });

    expect(result).toMatchObject({ ok: false, code: "SELF_CHANGE" });
    const [row] = await db.select().from(user).where(eq(user.id, admin.id));
    expect(row?.deactivatedAt).toBeNull();
  });

  it("entrada inválida (active não booleano) volta INVALID_INPUT", async () => {
    const { person } = await setup();
    const result = await setPersonActiveAction({
      userId: person.id,
      active: "sim",
    });
    expect(result).toMatchObject({ ok: false, code: "INVALID_INPUT" });
  });

  it("último admin ativo não se desativa (LAST_ADMIN)", async () => {
    const { admin } = await setup();
    mocks.requireAdmin.mockResolvedValue(
      authzOf({ role: "admin", userId: "outra-conta" }),
    );

    const result = await setPersonActiveAction({
      userId: admin.id,
      active: false,
    });

    expect(result).toMatchObject({ ok: false, code: "LAST_ADMIN" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bun run test -- "src/app/(app)/admin/equipe/actions.test.ts"`
Expected: FAIL com `Cannot find module './actions' imported from …/src/app/(app)/admin/equipe/actions.test.ts`

- [ ] **Step 7: Write minimal implementation (`actions.ts`)**

Crie `src/app/(app)/admin/equipe/actions.ts`:

```ts
"use server";

import { setPersonActive, updatePerson } from "@/features/admin/people";
import type { AdminResult } from "@/features/admin/result";
import { runAdminAction } from "@/features/admin/runAdminAction";
import {
  setPersonActiveSchema,
  updatePersonSchema,
} from "@/features/admin/schemas";
import { requireAdmin } from "@/lib/auth/session";

// `input: unknown` é o objeto do formulário (UpdatePersonInput); o schema Zod
// valida de novo no servidor, então o cliente nunca é a fonte da verdade.
export async function updatePersonAction(input: unknown): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: updatePersonSchema,
    input,
    run: ({ db, actor: current, input: data }) =>
      updatePerson(db, { actorId: current.userId, ...data }),
  });
}

export async function setPersonActiveAction(
  input: unknown,
): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: setPersonActiveSchema,
    input,
    run: ({ db, now, actor: current, input: data }) =>
      setPersonActive(db, { actorId: current.userId, ...data }, now),
  });
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun run test -- "src/app/(app)/admin/equipe/actions.test.ts"`
Expected: PASS (10 testes)

- [ ] **Step 9: Write the failing tests de `PersonForm` e `PersonRowActions`**

Crie `src/components/admin/team/PersonForm.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PersonRow } from "@/features/admin/people";
import { fail } from "@/features/admin/result";
import type { SectorChoice } from "@/features/admin/sectors";
import { PersonForm } from "./PersonForm";

const mocks = vi.hoisted(() => ({
  updatePersonAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/equipe/actions", () => ({
  updatePersonAction: mocks.updatePersonAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const SECTOR_A: SectorChoice = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Almoxarifado",
};
const SECTOR_B: SectorChoice = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Recebimento",
};

function person(overrides: Partial<PersonRow> = {}): PersonRow {
  return {
    id: "pessoa-1",
    name: "Bruno Fictício",
    email: "bruno@example.test",
    role: "operator",
    sectorId: SECTOR_A.id,
    sectorName: SECTOR_A.name,
    sectorActive: true,
    active: true,
    ...overrides,
  };
}

function setup(
  props: { person?: PersonRow; sectors?: SectorChoice[] } = {},
  onDone = vi.fn(),
) {
  const user = userEvent.setup();
  render(
    <PersonForm
      person={props.person ?? person()}
      sectors={props.sectors ?? [SECTOR_A, SECTOR_B]}
      onDone={onDone}
    />,
  );
  return { user, onDone };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.updatePersonAction.mockResolvedValue({ ok: true });
});

describe("PersonForm", () => {
  it("começa com o papel e o setor atuais, nunca em branco", () => {
    setup();

    expect(screen.getByRole("button", { name: "Operador" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Administrador" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("Setor")).toHaveValue(SECTOR_A.id);
    expect(
      screen.getByRole("button", { name: "Salvar alterações" }),
    ).toBeEnabled();
  });

  it("salvar sem mexer envia os valores atuais", async () => {
    const { user, onDone } = setup();

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(mocks.updatePersonAction).toHaveBeenCalledWith({
      userId: "pessoa-1",
      role: "operator",
      sectorId: SECTOR_A.id,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Alterações salvas.");
  });

  it("troca o setor e envia o novo", async () => {
    const { user } = setup();

    await user.selectOptions(screen.getByLabelText("Setor"), SECTOR_B.id);
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    await waitFor(() =>
      expect(mocks.updatePersonAction).toHaveBeenCalledWith({
        userId: "pessoa-1",
        role: "operator",
        sectorId: SECTOR_B.id,
      }),
    );
  });

  it("virar Administrador esconde o setor, explica e envia setor nulo", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Administrador" }));

    expect(screen.queryByLabelText("Setor")).not.toBeInTheDocument();
    expect(
      screen.getByText("Administradores veem todos os setores."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() =>
      expect(mocks.updatePersonAction).toHaveBeenCalledWith({
        userId: "pessoa-1",
        role: "admin",
        sectorId: null,
      }),
    );
  });

  it("administrador que volta a Operador já vem com o primeiro setor", async () => {
    const { user } = setup({
      person: person({
        role: "admin",
        sectorId: null,
        sectorName: null,
        sectorActive: null,
      }),
    });

    await user.click(screen.getByRole("button", { name: "Operador" }));

    expect(screen.getByLabelText("Setor")).toHaveValue(SECTOR_A.id);
  });

  it("setor atual inativo (fora da lista) cai no primeiro setor ativo", () => {
    setup({
      person: person({ sectorId: "outro-id", sectorActive: false }),
    });
    expect(screen.getByLabelText("Setor")).toHaveValue(SECTOR_A.id);
  });

  it("clicar no papel já escolhido não o desmarca", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Operador" }));

    expect(screen.getByRole("button", { name: "Operador" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("operador sem nenhum setor ativo: recusa no cliente e não chama a action", async () => {
    const { user, onDone } = setup({ sectors: [] });

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Escolha o setor do operador.",
    );
    expect(mocks.updatePersonAction).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("recusa do servidor com erro de campo aparece no setor e preserva a escolha", async () => {
    mocks.updatePersonAction.mockResolvedValue(
      fail("SECTOR_INACTIVE", "Este setor está inativo. Escolha outro.", {
        sectorId: "Este setor está inativo. Escolha outro.",
      }),
    );
    const { user, onDone } = setup();

    await user.selectOptions(screen.getByLabelText("Setor"), SECTOR_B.id);
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este setor está inativo. Escolha outro.",
    );
    expect(screen.getByLabelText("Setor")).toHaveValue(SECTOR_B.id);
    expect(onDone).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("recusa sem campo (último admin) aparece no pé do formulário", async () => {
    mocks.updatePersonAction.mockResolvedValue(
      fail(
        "LAST_ADMIN",
        "Este é o último administrador ativo. Nomeie outro antes.",
      ),
    );
    const { user, onDone } = setup({
      person: person({
        role: "admin",
        sectorId: null,
        sectorName: null,
        sectorActive: null,
      }),
    });

    await user.click(screen.getByRole("button", { name: "Operador" }));
    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este é o último administrador ativo. Nomeie outro antes.",
    );
    expect(onDone).not.toHaveBeenCalled();
  });

  it("erro inesperado de rede vira a mensagem padrão, sem fechar", async () => {
    mocks.updatePersonAction.mockRejectedValue(new Error("falhou"));
    const { user, onDone } = setup();

    await user.click(screen.getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir. Tente de novo.",
    );
    expect(onDone).not.toHaveBeenCalled();
  });

  it("trava o botão enquanto a action não responde e não envia duas vezes", async () => {
    let finish: (value: { ok: true }) => void = () => {};
    mocks.updatePersonAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { user } = setup();
    const submit = screen.getByRole("button", { name: "Salvar alterações" });

    await user.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    await user.click(submit);
    expect(mocks.updatePersonAction).toHaveBeenCalledTimes(1);

    finish({ ok: true });
    await waitFor(() => expect(submit).toBeEnabled());
  });
});
```

Crie `src/components/admin/team/PersonRowActions.test.tsx`:

```tsx
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PersonRow } from "@/features/admin/people";
import { fail } from "@/features/admin/result";
import type { SectorChoice } from "@/features/admin/sectors";
import { PersonRowActions } from "./PersonRowActions";

const mocks = vi.hoisted(() => ({
  setPersonActiveAction: vi.fn(),
  updatePersonAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/equipe/actions", () => ({
  setPersonActiveAction: mocks.setPersonActiveAction,
  updatePersonAction: mocks.updatePersonAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const SECTOR: SectorChoice = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Almoxarifado",
};

function person(overrides: Partial<PersonRow> = {}): PersonRow {
  return {
    id: "pessoa-1",
    name: "Bruno Fictício",
    email: "bruno@example.test",
    role: "operator",
    sectorId: SECTOR.id,
    sectorName: SECTOR.name,
    sectorActive: true,
    active: true,
    ...overrides,
  };
}

function setup(row: PersonRow = person()) {
  const user = userEvent.setup();
  render(<PersonRowActions person={row} sectors={[SECTOR]} />);
  return { user };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.setPersonActiveAction.mockResolvedValue({ ok: true });
  mocks.updatePersonAction.mockResolvedValue({ ok: true });
});

describe("PersonRowActions", () => {
  it("pessoa ativa: Editar e Desativar, sem Reativar", () => {
    setup();

    expect(
      screen.getByRole("button", { name: "Editar Bruno Fictício" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Desativar Bruno Fictício" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reativar Bruno Fictício" }),
    ).not.toBeInTheDocument();
  });

  it("pessoa inativa: Editar e Reativar, sem Desativar", () => {
    setup(person({ active: false }));

    expect(
      screen.getByRole("button", { name: "Reativar Bruno Fictício" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Desativar Bruno Fictício" }),
    ).not.toBeInTheDocument();
  });

  it("Editar abre o diálogo com o nome da pessoa e o formulário", async () => {
    const { user } = setup();

    await user.click(
      screen.getByRole("button", { name: "Editar Bruno Fictício" }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Editar pessoa" });
    expect(within(dialog).getByText("Bruno Fictício")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Salvar alterações" }),
    ).toBeInTheDocument();
  });

  it("salvar a edição fecha o diálogo", async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole("button", { name: "Editar Bruno Fictício" }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Editar pessoa" });
    await user.click(
      within(dialog).getByRole("button", { name: "Salvar alterações" }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Editar pessoa" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("Desativar pede confirmação com o texto exato e só então age", async () => {
    const { user } = setup();

    await user.click(
      screen.getByRole("button", { name: "Desativar Bruno Fictício" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Desativar Bruno Fictício?",
    });
    expect(
      within(dialog).getByText(
        "A pessoa perde o acesso agora e as sessões abertas são encerradas. O histórico dela continua. Você pode reativar depois.",
      ),
    ).toBeInTheDocument();
    expect(mocks.setPersonActiveAction).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Desativar" }));

    await waitFor(() =>
      expect(mocks.setPersonActiveAction).toHaveBeenCalledWith({
        userId: "pessoa-1",
        active: false,
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Pessoa desativada.");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("Voltar fecha a confirmação sem desativar", async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole("button", { name: "Desativar Bruno Fictício" }),
    );

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Voltar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mocks.setPersonActiveAction).not.toHaveBeenCalled();
  });

  it("recusa do servidor aparece no diálogo, que continua aberto, sem toast", async () => {
    mocks.setPersonActiveAction.mockResolvedValue(
      fail(
        "LAST_ADMIN",
        "Este é o último administrador ativo. Nomeie outro antes.",
      ),
    );
    const { user } = setup(person({ role: "admin", sectorId: null }));
    await user.click(
      screen.getByRole("button", { name: "Desativar Bruno Fictício" }),
    );

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Desativar" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Este é o último administrador ativo. Nomeie outro antes.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("Reativar age direto e avisa", async () => {
    const { user } = setup(person({ active: false }));

    await user.click(
      screen.getByRole("button", { name: "Reativar Bruno Fictício" }),
    );

    await waitFor(() =>
      expect(mocks.setPersonActiveAction).toHaveBeenCalledWith({
        userId: "pessoa-1",
        active: true,
      }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Pessoa reativada.");
  });

  it("Reativar recusado mostra o motivo num toast", async () => {
    mocks.setPersonActiveAction.mockResolvedValue(
      fail(
        "SECTOR_INACTIVE",
        "O setor desta pessoa está inativo. Edite a pessoa e escolha outro setor antes de reativar.",
      ),
    );
    const { user } = setup(person({ active: false }));

    await user.click(
      screen.getByRole("button", { name: "Reativar Bruno Fictício" }),
    );

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "O setor desta pessoa está inativo. Edite a pessoa e escolha outro setor antes de reativar.",
      ),
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 10: Run tests to verify they fail**

Run: `bun run test -- src/components/admin/team/PersonForm.test.tsx src/components/admin/team/PersonRowActions.test.tsx`
Expected: FAIL com `Failed to resolve import "./PersonForm"` e `Failed to resolve import "./PersonRowActions"`

- [ ] **Step 11: Write minimal implementation (`roleOptions.ts`, `PersonForm.tsx`, `PersonRowActions.tsx`)**

Crie `src/components/admin/team/roleOptions.ts`:

```ts
import type { Role } from "@/lib/roles";

export const ROLE_LABELS: Readonly<Record<Role, string>> = {
  admin: "Administrador",
  operator: "Operador",
};

// Operador primeiro: é o papel mais comum (formulário nunca começa em branco).
export const ROLE_OPTIONS: readonly { value: Role; label: string }[] = [
  { value: "operator", label: ROLE_LABELS.operator },
  { value: "admin", label: ROLE_LABELS.admin },
];
```

Crie `src/components/admin/team/PersonForm.tsx`:

```tsx
"use client";

import { type FormEvent, useState } from "react";

import { updatePersonAction } from "@/app/(app)/admin/equipe/actions";
import { ChoiceGroup } from "@/components/admin/ChoiceGroup";
import { SelectField } from "@/components/admin/SelectField";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import { FieldError, FieldGroup } from "@/components/ui/field";
import type { PersonRow } from "@/features/admin/people";
import type { FieldErrors } from "@/features/admin/result";
import { firstFieldErrors, updatePersonSchema } from "@/features/admin/schemas";
import type { SectorChoice } from "@/features/admin/sectors";
import type { Role } from "@/lib/roles";
import { ROLE_OPTIONS } from "./roleOptions";

export function PersonForm({
  person,
  sectors,
  onDone,
}: {
  person: PersonRow;
  sectors: readonly SectorChoice[];
  onDone: () => void;
}) {
  const { pending, run } = useAdminAction();
  // Nunca em branco: quem já tem setor ativo o mantém; senão, o primeiro da lista.
  const [role, setRole] = useState<Role>(person.role);
  const [sectorId, setSectorId] = useState(
    sectors.some((sector) => sector.id === person.sectorId)
      ? (person.sectorId ?? "")
      : (sectors[0]?.id ?? ""),
  );
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setFormError(null);

    const values = {
      userId: person.id,
      role,
      sectorId: role === "operator" && sectorId !== "" ? sectorId : null,
    };
    const parsed = updatePersonSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(firstFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});

    const result = await run(() => updatePersonAction(values), {
      success: "Alterações salvas.",
      showError: false,
    });
    if (result.ok) {
      onDone();
      return;
    }
    setFieldErrors(result.fieldErrors ?? {});
    // Erro de um campo já aparece no campo; o resto vai no pé do formulário.
    if (!result.fieldErrors || Object.keys(result.fieldErrors).length === 0) {
      setFormError(result.message);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        <ChoiceGroup
          legend="Papel"
          value={role}
          onValueChange={setRole}
          options={ROLE_OPTIONS}
          disabled={pending}
        />

        {role === "operator" ? (
          <SelectField
            label="Setor"
            value={sectorId}
            onValueChange={setSectorId}
            options={sectors.map((sector) => ({
              value: sector.id,
              label: sector.name,
            }))}
            error={fieldErrors.sectorId}
            disabled={pending}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Administradores veem todos os setores.
          </p>
        )}

        {formError && <FieldError>{formError}</FieldError>}

        <Button type="submit" size="lg" disabled={pending}>
          Salvar alterações
        </Button>
      </FieldGroup>
    </form>
  );
}
```

Crie `src/components/admin/team/PersonRowActions.tsx`:

```tsx
"use client";

import { setPersonActiveAction } from "@/app/(app)/admin/equipe/actions";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { EditDialog } from "@/components/admin/EditDialog";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";
import type { PersonRow } from "@/features/admin/people";
import type { SectorChoice } from "@/features/admin/sectors";
import { PersonForm } from "./PersonForm";

export function PersonRowActions({
  person,
  sectors,
}: {
  person: PersonRow;
  sectors: readonly SectorChoice[];
}) {
  const { pending, run } = useAdminAction();

  return (
    <>
      <EditDialog title="Editar pessoa" name={person.name}>
        {(close) => (
          <PersonForm person={person} sectors={sectors} onDone={close} />
        )}
      </EditDialog>

      {person.active ? (
        <ConfirmDialog
          trigger={
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`Desativar ${person.name}`}
            >
              Desativar
            </Button>
          }
          title={`Desativar ${person.name}?`}
          description="A pessoa perde o acesso agora e as sessões abertas são encerradas. O histórico dela continua. Você pode reativar depois."
          confirmLabel="Desativar"
          destructive
          onConfirm={() =>
            run(
              () => setPersonActiveAction({ userId: person.id, active: false }),
              { success: "Pessoa desativada.", showError: false },
            )
          }
        />
      ) : (
        <Button
          type="button"
          size="sm"
          aria-label={`Reativar ${person.name}`}
          disabled={pending}
          onClick={() =>
            run(
              () => setPersonActiveAction({ userId: person.id, active: true }),
              { success: "Pessoa reativada." },
            )
          }
        >
          Reativar
        </Button>
      )}
    </>
  );
}
```

Notas: o formulário é **controlado** (F2-12) e valida com o mesmo `updatePersonSchema` do servidor; o erro de campo (`fieldErrors.sectorId`) aparece no campo e o resto no pé do formulário, sem perder o que a pessoa escolheu. A confirmação de desativar usa `showError: false` porque o `ConfirmDialog` mostra a mensagem dentro do diálogo (e não fecha); "Reativar" não tem diálogo, então o erro vai para o toast.

- [ ] **Step 12: Run tests to verify they pass**

Run: `bun run test -- src/components/admin/team/PersonForm.test.tsx src/components/admin/team/PersonRowActions.test.tsx`
Expected: PASS (21 testes: 12 em `PersonForm.test.tsx` e 9 em `PersonRowActions.test.tsx`)

- [ ] **Step 13: Write the failing test de `TeamAdmin` (seção Pessoas)**

Crie `src/components/admin/team/TeamAdmin.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Page } from "@/features/admin/pagination";
import type { PersonRow } from "@/features/admin/people";
import { TeamAdmin } from "./TeamAdmin";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listPeople: vi.fn(),
  listActiveSectors: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/features/admin/people", () => ({ listPeople: mocks.listPeople }));
vi.mock("@/features/admin/sectors", () => ({
  listActiveSectors: mocks.listActiveSectors,
}));
vi.mock("@/app/(app)/admin/equipe/actions", () => ({
  updatePersonAction: vi.fn(),
  setPersonActiveAction: vi.fn(),
}));

const SECTOR_ID = "11111111-1111-4111-8111-111111111111";
const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";

function person(overrides: Partial<PersonRow> = {}): PersonRow {
  return {
    id: "pessoa-1",
    name: "Bruno Fictício",
    email: "bruno@example.test",
    role: "operator",
    sectorId: SECTOR_ID,
    sectorName: "Almoxarifado",
    sectorActive: true,
    active: true,
    ...overrides,
  };
}

function page(rows: PersonRow[], overrides: Partial<Page<PersonRow>> = {}) {
  return {
    rows,
    total: rows.length,
    page: 1,
    pageCount: 1,
    pageSize: 50,
    ...overrides,
  } satisfies Page<PersonRow>;
}

async function renderTeam(
  searchParams: Record<string, string | string[]> = {},
) {
  render(await TeamAdmin({ searchParams: Promise.resolve(searchParams) }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    userId: "admin-1",
    role: "admin",
    name: "Admin",
    email: "admin@example.test",
    sectorId: null,
  });
  mocks.listPeople.mockResolvedValue(page([person()]));
  mocks.listActiveSectors.mockResolvedValue([
    { id: SECTOR_ID, name: "Almoxarifado" },
  ]);
});

describe("TeamAdmin", () => {
  it("mostra título, texto, seção Pessoas e o link de volta", async () => {
    await renderTeam();

    expect(
      screen.getByRole("heading", { level: 1, name: "Equipe" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pessoas, papéis e convites.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Pessoas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para Administração" }),
    ).toHaveAttribute("href", "/admin");
  });

  it("linha de operador: nome, e-mail, papel, setor e os botões", async () => {
    await renderTeam();

    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Bruno Fictício")).toBeInTheDocument();
    expect(within(row).getByText("bruno@example.test")).toBeInTheDocument();
    expect(within(row).getByText("Operador")).toBeInTheDocument();
    expect(within(row).getByText("Almoxarifado")).toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: "Editar Bruno Fictício" }),
    ).toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: "Desativar Bruno Fictício" }),
    ).toBeInTheDocument();
    expect(within(row).queryByText("Inativo")).not.toBeInTheDocument();
  });

  it("a própria conta mostra Você e o texto de ajuda, sem nenhum botão", async () => {
    mocks.listPeople.mockResolvedValue(
      page([
        person({
          id: "admin-1",
          name: "Carla Admin",
          role: "admin",
          sectorId: null,
          sectorName: null,
          sectorActive: null,
        }),
      ]),
    );

    await renderTeam();

    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Você")).toBeInTheDocument();
    expect(within(row).getByText("Administrador")).toBeInTheDocument();
    expect(
      within(row).getByText(
        "Peça a outro administrador para mudar a sua conta.",
      ),
    ).toBeInTheDocument();
    expect(within(row).queryByRole("button")).not.toBeInTheDocument();
  });

  it("pessoa inativa mostra o selo e Reativar", async () => {
    mocks.listPeople.mockResolvedValue(page([person({ active: false })]));

    await renderTeam();

    const row = screen.getByRole("listitem");
    expect(within(row).getByText("Inativo")).toBeInTheDocument();
    expect(
      within(row).getByRole("button", { name: "Reativar Bruno Fictício" }),
    ).toBeInTheDocument();
  });

  it("setor inativo da pessoa aparece com (inativo)", async () => {
    mocks.listPeople.mockResolvedValue(page([person({ sectorActive: false })]));

    await renderTeam();

    expect(screen.getByText("Almoxarifado (inativo)")).toBeInTheDocument();
  });

  it("sem pessoas: estado vazio", async () => {
    mocks.listPeople.mockResolvedValue(page([]));

    await renderTeam();

    expect(screen.getByText("Nenhuma pessoa ainda.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("lê a página de ?pagina=, cai na 1 se for inválida e usa o primeiro valor repetido", async () => {
    await renderTeam({ pagina: "3" });
    expect(mocks.listPeople).toHaveBeenLastCalledWith({}, { page: 3 });

    await renderTeam({ pagina: "abc" });
    expect(mocks.listPeople).toHaveBeenLastCalledWith({}, { page: 1 });

    await renderTeam({ pagina: ["2", "3"] });
    expect(mocks.listPeople).toHaveBeenLastCalledWith({}, { page: 2 });
  });

  it("com mais de uma página mostra a paginação com links", async () => {
    mocks.listPeople.mockResolvedValue(
      page([person()], { page: 2, pageCount: 3, total: 120 }),
    );

    await renderTeam({ pagina: "2" });

    const nav = screen.getByRole("navigation", { name: "Paginação" });
    expect(within(nav).getByText("Página 2 de 3")).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Anterior" })).toHaveAttribute(
      "href",
      "/admin/equipe",
    );
    expect(within(nav).getByRole("link", { name: "Próxima" })).toHaveAttribute(
      "href",
      "/admin/equipe?pagina=3",
    );
  });

  it("operador: requireAdmin lança notFound e nada é lido", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error(NOT_FOUND));

    await expect(
      TeamAdmin({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow(NOT_FOUND);
    expect(mocks.listPeople).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 14: Run test to verify it fails**

Run: `bun run test -- src/components/admin/team/TeamAdmin.test.tsx`
Expected: FAIL com `Failed to resolve import "./TeamAdmin"`

- [ ] **Step 15: Write minimal implementation (`TeamAdmin.tsx` e `page.tsx`)**

Crie `src/components/admin/team/TeamAdmin.tsx`:

```tsx
import { AdminListRow } from "@/components/admin/AdminListRow";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { parsePage } from "@/features/admin/pagination";
import { listPeople, type PersonRow } from "@/features/admin/people";
import { listActiveSectors } from "@/features/admin/sectors";
import { requireAdmin } from "@/lib/auth/session";
import { PersonRowActions } from "./PersonRowActions";
import { ROLE_LABELS } from "./roleOptions";

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function sectorText(person: PersonRow): string | null {
  if (!person.sectorName) return null;
  return person.sectorActive === false
    ? `${person.sectorName} (inativo)`
    : person.sectorName;
}

export async function TeamAdmin({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireAdmin();
  const params = await searchParams;
  const [people, sectors] = await Promise.all([
    listPeople(db, { page: parsePage(params.pagina) }),
    listActiveSectors(db),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Equipe"
        description="Pessoas, papéis e convites."
        backHref="/admin"
      />

      <section className="flex flex-col gap-3" aria-labelledby="people-title">
        <h2 id="people-title" className="text-base font-medium">
          Pessoas
        </h2>
        {people.rows.length === 0 ? (
          <EmptyState title="Nenhuma pessoa ainda." />
        ) : (
          <ul className="flex flex-col gap-2">
            {people.rows.map((person) => {
              const isSelf = person.id === actor.userId;
              const sector = sectorText(person);
              return (
                <AdminListRow
                  key={person.id}
                  title={person.name}
                  inactive={!person.active}
                  subtitle={
                    <div className="flex flex-col">
                      <span>{person.email}</span>
                      {sector && <span>{sector}</span>}
                    </div>
                  }
                  badges={
                    <>
                      <Badge variant="outline">
                        {ROLE_LABELS[person.role]}
                      </Badge>
                      {isSelf && <Badge>Você</Badge>}
                    </>
                  }
                  notes={
                    isSelf ? (
                      <p className="text-sm text-muted-foreground">
                        Peça a outro administrador para mudar a sua conta.
                      </p>
                    ) : undefined
                  }
                  actions={
                    isSelf ? undefined : (
                      <PersonRowActions person={person} sectors={sectors} />
                    )
                  }
                />
              );
            })}
          </ul>
        )}
        <Pagination
          page={people.page}
          pageCount={people.pageCount}
          pathname="/admin/equipe"
          params={{ pagina: single(params.pagina) }}
        />
      </section>
    </div>
  );
}
```

Crie `src/app/(app)/admin/equipe/page.tsx`:

```tsx
import { Suspense } from "react";

import { AdminListSkeleton } from "@/components/admin/AdminListSkeleton";
import { TeamAdmin } from "@/components/admin/team/TeamAdmin";
import { Skeleton } from "@/components/ui/skeleton";

// Sem `metadata` de propósito (T12 da Fase 1): o <title> sairia antes do portão.
// O <h1> fica dentro do Suspense, em TeamAdmin, depois de requireAdmin().
export default function TeamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<TeamSkeleton />}>
      <TeamAdmin searchParams={searchParams} />
    </Suspense>
  );
}

function TeamSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <AdminListSkeleton />
    </div>
  );
}
```

Notas: a página só passa a Promise de `searchParams` para dentro do `<Suspense>` (nada de `await` fora dele); `requireAdmin()` está em `TeamAdmin`, importado de `@/components/...`, o que satisfaz o guarda `appPagesAuth.test.ts`. A própria conta nunca recebe botões (F2-10): o servidor continua recusando por `SELF_CHANGE`/`LAST_ADMIN`.

- [ ] **Step 16: Run test to verify it passes**

Run: `bun run test -- src/components/admin/team/TeamAdmin.test.tsx`
Expected: PASS (9 testes)

- [ ] **Step 17: Atualizar `.context/ui-registry.md`**

Com a ferramenta Edit, em `.context/ui-registry.md`, troque a linha da seção 3 por três entradas novas seguidas da própria linha (as entradas ficam no fim da seção 2):

`old_string`:
```text
## 3. Componentes de domínio — `src/features/<domínio>/components`
```

`new_string`:
```text
### TeamAdmin
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/team/TeamAdmin.tsx` (+ `roleOptions.ts`: `ROLE_LABELS`, `ROLE_OPTIONS`)
- **Propósito:** conteúdo de `/admin/equipe`: as pessoas do sistema com papel, setor e situação.
- **Como funciona:** Server Component async; chama `requireAdmin()` e lê `listPeople` (`?pagina=`) e `listActiveSectors`. A própria conta mostra o selo "Você" e o texto de ajuda, **sem botões**; pessoa inativa fica esmaecida (`InactiveBadge`) com "Reativar"; setor inativo aparece como "(inativo)"; estado vazio e `Pagination`.
- **Usa:** `AdminPageHeader`, `AdminListRow`, `EmptyState`, `Pagination`, `Badge`, `PersonRowActions`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 9).

### PersonForm
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/team/PersonForm.tsx`
- **Propósito:** editar o papel e o setor de uma pessoa num só passo (diálogo "Editar pessoa").
- **Como funciona:** `"use client"`; formulário controlado; `ChoiceGroup` "Papel" (Operador | Administrador) e `SelectField` "Setor" só para Operador (administrador mostra "Administradores veem todos os setores."); nunca em branco (setor atual ou o primeiro ativo); valida com o mesmo `updatePersonSchema` do servidor; erro de campo no campo, o resto no pé do formulário; trava o botão enquanto salva.
- **Usa:** `ChoiceGroup`, `SelectField`, `useAdminAction`, `FieldError`, `Button`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 9).

### PersonRowActions
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/team/PersonRowActions.tsx`
- **Propósito:** ações de uma linha de pessoa: editar, desativar (com confirmação) e reativar.
- **Como funciona:** `"use client"`; `EditDialog` "Editar pessoa" com `PersonForm`; "Desativar" abre `ConfirmDialog` (texto: perde o acesso agora, sessões encerradas, histórico continua) e mostra a recusa do servidor dentro do diálogo; "Reativar" age direto e leva o erro para o toast. `aria-label` com o nome da pessoa em todos os botões.
- **Usa:** `EditDialog`, `ConfirmDialog`, `PersonForm`, `useAdminAction`, `Button`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 9).

## 3. Componentes de domínio — `src/features/<domínio>/components`
```

- [ ] **Step 18: Rodar a verificação completa**

Run: `bun run check-types && bun run lint && bun run test`
Expected: tipos sem erro, Biome sem achados e toda a suíte verde (inclui `appPagesAuth.test.ts` com a página nova e o guarda `actionsAuth.test.ts` da Tarefa 3, que confere que cada função de `equipe/actions.ts` chama `requireAdmin(`). Se o `bun run test` acusar `Timeout waiting for worker to respond` ou um teste de 5 s estourado em máquina carregada, rode de novo o arquivo isolado antes de investigar.

- [ ] **Step 19: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-9.txt` (texto exato abaixo) e rode:
```bash
git add src/features/admin/people.ts src/features/admin/people.test.ts "src/app/(app)/admin/equipe/actions.ts" "src/app/(app)/admin/equipe/actions.test.ts" "src/app/(app)/admin/equipe/page.tsx" src/components/admin/team/roleOptions.ts src/components/admin/team/PersonForm.tsx src/components/admin/team/PersonForm.test.tsx src/components/admin/team/PersonRowActions.tsx src/components/admin/team/PersonRowActions.test.tsx src/components/admin/team/TeamAdmin.tsx src/components/admin/team/TeamAdmin.test.tsx .context/ui-registry.md
git commit -F .git/sdd/msg-task-9.txt
```
Mensagem:
```text
feat(equipe): pessoas com papel, setor e desativação que derruba sessões

Lista paginada de pessoas em /admin/equipe, edição de papel e setor numa
transação e desativar/reativar. Desativar apaga todas as sessões da pessoa na
mesma transação (P11). Nunca desativa nem rebaixa o último admin ativo
(SELECT FOR UPDATE) nem a própria conta; reativar operador exige setor ativo.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 10: Equipe — convites

**Files:**
- Modify: `src/features/invites/inviteQueries.ts` (acrescentar `cancelInvite` no fim do arquivo)
- Modify: `src/features/invites/inviteQueries.test.ts` (acrescentar `cancelInvite` ao import e um `describe("cancelInvite")` no fim)
- Create: `src/features/admin/teamInvites.ts`
- Modify: `src/app/(app)/admin/equipe/actions.ts` (arquivo inteiro substituído: acrescenta `createInviteAction` e `cancelInviteAction`)
- Modify: `src/app/(app)/admin/equipe/actions.test.ts` (acrescentar o mock de `@/lib/auth`)
- Create: `src/components/admin/team/InviteLinkCard.tsx`
- Create: `src/components/admin/team/InviteForm.tsx`
- Create: `src/components/admin/team/PendingInviteActions.tsx`
- Modify: `src/components/admin/team/TeamAdmin.tsx` (arquivo inteiro substituído: acrescenta formulário de convite e convites pendentes)
- Modify: `src/components/admin/team/TeamAdmin.test.tsx` (arquivo inteiro substituído)
- Modify: `.context/ui-registry.md` (três entradas novas e a entrada `TeamAdmin` reescrita)
- Test: `src/features/admin/teamInvites.test.ts`
- Test: `src/app/(app)/admin/equipe/inviteActions.test.ts`
- Test: `src/components/admin/team/InviteLinkCard.test.tsx`
- Test: `src/components/admin/team/InviteForm.test.tsx`
- Test: `src/components/admin/team/PendingInviteActions.test.tsx`

**Interfaces:**
- Consumes:
  - Da Tarefa 9: `equipe/actions.ts`, `TeamAdmin.tsx`, `PersonRowActions`, `ROLE_LABELS`/`ROLE_OPTIONS` de `roleOptions.ts`
  - Do código existente: `createInvite(db, { role, sectorId, inviteeLabel, invitedBy, now }): Promise<{ id: string; token: string; expiresAt: Date }>` e `findInviteByToken(db, token, now)` de `src/features/invites/inviteQueries.ts`; `buildInviteUrl(baseURL, token)` e `isHttpUrl(value)` de `src/features/invites/inviteUrl.ts`; `ADMIN_INVITE_LABEL_MAX_LENGTH` (80) de `src/features/invites/adminInvite.ts`; `insertInvite(db, { role?, sectorId?, inviteeLabel?, invitedBy?, now?, usedAt?, cancelledAt?, expiresAt? })` de `test/fixtures.ts`
  - Das Tarefas 2, 3, 5 e 6: `normalizeName`, `notFoundMessage`, `INVITE_NOT_PENDING_MESSAGE`, `SECTOR_REQUIRED_MESSAGE`, `SECTOR_INACTIVE_MESSAGE`, `PAGE_SIZE`, `Page<T>`, `resolvePage`, `parsePage`, `createInviteSchema`, `cancelInviteSchema`, `firstFieldErrors`, `runAdminAction`, `AdminResult`/`ok`/`fail`, `formatDateTimeBR`, `listActiveSectors`/`SectorChoice`, `ConfirmDialog`, `ChoiceGroup`, `SelectField`, `useAdminAction`, `AdminListRow`, `EmptyState`, `Pagination`, `authEnv` de `@/lib/auth`
- Produces:
  - `cancelInvite(db: Db, id: string, now: Date): Promise<boolean>` em `inviteQueries.ts`
  - `src/features/admin/teamInvites.ts`: `type PendingInviteRow`, `listPendingInvites(db, { page }, now)`, `createTeamInvite(db, { actorId, inviteeLabel, role, sectorId, baseURL, now })`, `cancelPendingInvite(db, { id }, now)`; a mensagem `INVITE_LABEL_TOO_LONG_MESSAGE` vem de `messages.ts` (Tarefa 2)
  - `createInviteAction(input: unknown): Promise<AdminResult<{ id: string; url: string; expiresAt: Date }>>` e `cancelInviteAction(input: unknown): Promise<AdminResult>` em `equipe/actions.ts`
  - `InviteForm(props: { sectors: readonly SectorChoice[] })`, `InviteLinkCard(props: { url: string; expiresAt: Date; onReset: () => void })`, `PendingInviteActions(props: { id: string; label: string })`

- [ ] **Step 1: Write the failing test de `cancelInvite`**

Em `src/features/invites/inviteQueries.test.ts`, faça duas edições.

(a) No import de `./inviteQueries`, acrescente `cancelInvite` antes de `consumeInvite` (Edit):

`old_string`:
```text
import {
  consumeInvite,
  createInvite,
```

`new_string`:
```text
import {
  cancelInvite,
  consumeInvite,
  createInvite,
```

(b) Acrescente no **fim** do arquivo (depois do último `});`):

```ts

describe("cancelInvite", () => {
  it("cancela convite pendente, grava a hora e devolve true", async () => {
    const { id } = await insertInvite(db, { now: NOW });

    expect(await cancelInvite(db, id, NOW)).toBe(true);

    expect((await readInvite(id)).cancelledAt).toEqual(NOW);
  });

  it("depois de cancelar, o link deixa de funcionar", async () => {
    const { id, token } = await insertInvite(db, { now: NOW });

    await cancelInvite(db, id, NOW);

    expect((await findInviteByToken(db, token, NOW))?.state).toBe("cancelled");
    expect(await consumeInvite(db, token, NOW)).toBeNull();
  });

  it("segundo cancelamento devolve false e mantém a primeira hora", async () => {
    const { id } = await insertInvite(db, { now: NOW });
    const later = new Date(NOW.getTime() + ONE_MINUTE);

    expect(await cancelInvite(db, id, NOW)).toBe(true);
    expect(await cancelInvite(db, id, later)).toBe(false);

    expect((await readInvite(id)).cancelledAt).toEqual(NOW);
  });

  it("convite já usado não é cancelado", async () => {
    const { id } = await insertInvite(db, { now: NOW, usedAt: NOW });

    expect(await cancelInvite(db, id, NOW)).toBe(false);
    expect((await readInvite(id)).cancelledAt).toBeNull();
  });

  it("convite expirado não é cancelado, nem no instante exato da expiração", async () => {
    const expiresAt = new Date(NOW.getTime() + ONE_MINUTE);
    const { id } = await insertInvite(db, { now: NOW, expiresAt });

    expect(await cancelInvite(db, id, expiresAt)).toBe(false);
    expect(await cancelInvite(db, id, new Date(expiresAt.getTime() + 1))).toBe(
      false,
    );
    expect((await readInvite(id)).cancelledAt).toBeNull();
  });

  it("um instante antes de expirar ainda cancela", async () => {
    const expiresAt = new Date(NOW.getTime() + ONE_MINUTE);
    const { id } = await insertInvite(db, { now: NOW, expiresAt });

    expect(await cancelInvite(db, id, new Date(expiresAt.getTime() - 1))).toBe(
      true,
    );
  });

  it("id inexistente devolve false", async () => {
    expect(
      await cancelInvite(db, "00000000-0000-4000-8000-000000000000", NOW),
    ).toBe(false);
  });

  it("só cancela o convite pedido", async () => {
    const target = await insertInvite(db, { now: NOW });
    const other = await insertInvite(db, { now: NOW });

    await cancelInvite(db, target.id, NOW);

    expect((await readInvite(other.id)).cancelledAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/features/invites/inviteQueries.test.ts`
Expected: FAIL com `cancelInvite is not a function` (os 8 testes novos falham; os 30 antigos seguem verdes)

- [ ] **Step 3: Write minimal implementation (`cancelInvite`)**

Acrescente no **fim** de `src/features/invites/inviteQueries.ts` (os imports `and`, `eq`, `gt`, `isNull` e `invite` já existem no topo):

```ts

// Cancelamento atômico: um único UPDATE condicional (mesma regra de validade de
// consumeInvite). `false` = não estava pendente (usado, expirado, cancelado ou
// inexistente): quem chama decide a mensagem.
export async function cancelInvite(
  db: Db,
  id: string,
  now: Date,
): Promise<boolean> {
  const [cancelled] = await db
    .update(invite)
    .set({ cancelledAt: now })
    .where(
      and(
        eq(invite.id, id),
        isNull(invite.usedAt),
        isNull(invite.cancelledAt),
        gt(invite.expiresAt, now),
      ),
    )
    .returning({ id: invite.id });

  return cancelled !== undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- src/features/invites/inviteQueries.test.ts`
Expected: PASS (38 testes no arquivo: 30 já existentes + 8 novos de `cancelInvite`)

- [ ] **Step 5: Write the failing test do domínio de convites (`teamInvites.test.ts`)**

Crie `src/features/admin/teamInvites.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { invite } from "@/db/schema/invites";
import { findInviteByToken } from "@/features/invites/inviteQueries";
import { INVITE_TTL_MS } from "@/features/invites/inviteState";
import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import { insertInvite, insertSector, insertUser } from "../../../test/fixtures";
import {
  INVITE_LABEL_TOO_LONG_MESSAGE,
  INVITE_NOT_PENDING_MESSAGE,
  SECTOR_INACTIVE_MESSAGE,
  SECTOR_REQUIRED_MESSAGE,
} from "./messages";
import { PAGE_SIZE } from "./pagination";
import {
  cancelPendingInvite,
  createTeamInvite,
  listPendingInvites,
} from "./teamInvites";

const NOW = new Date("2026-11-21T12:00:00.000Z");
const BASE_URL = "https://closery.example.test";

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

async function readInvite(id: string) {
  const [row] = await db.select().from(invite).where(eq(invite.id, id));
  if (!row) throw new Error("convite não encontrado");
  return row;
}

function tokenOf(url: string): string {
  const token = url.split("/convite/")[1];
  if (!token) throw new Error(`link sem token: ${url}`);
  return token;
}

describe("createTeamInvite", () => {
  it("convite de operador: grava setor, rótulo e quem convidou, e o link tem um token que findInviteByToken aceita", async () => {
    const admin = await insertUser(db, {
      role: "admin",
      sectorId: null,
      name: "Carla Admin",
    });
    const setor = await insertSector(db, "Almoxarifado");

    const result = await createTeamInvite(db, {
      actorId: admin.id,
      inviteeLabel: "  Maria   do Turno  ",
      role: "operator",
      sectorId: setor.id,
      baseURL: BASE_URL,
      now: NOW,
    });

    if (!result.ok) throw new Error(result.message);
    expect(result.url).toMatch(
      new RegExp(`^${BASE_URL}/convite/[A-Za-z0-9_-]{43}$`),
    );
    expect(result.expiresAt).toEqual(new Date(NOW.getTime() + INVITE_TTL_MS));

    const found = await findInviteByToken(db, tokenOf(result.url), NOW);
    expect(found).toMatchObject({
      state: "valid",
      role: "operator",
      sectorName: "Almoxarifado",
      inviterName: "Carla Admin",
      inviteeLabel: "Maria do Turno",
    });

    const row = await readInvite(result.id);
    expect(row.invitedBy).toBe(admin.id);
    expect(row.sectorId).toBe(setor.id);
  });

  it("convite de admin ignora o setor enviado e grava null", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db);

    const result = await createTeamInvite(db, {
      actorId: admin.id,
      inviteeLabel: null,
      role: "admin",
      sectorId: setor.id,
      baseURL: BASE_URL,
      now: NOW,
    });

    if (!result.ok) throw new Error(result.message);
    expect((await readInvite(result.id)).sectorId).toBeNull();
    const found = await findInviteByToken(db, tokenOf(result.url), NOW);
    expect(found).toMatchObject({ role: "admin", sectorName: null });
  });

  it("operador sem setor: SECTOR_REQUIRED e nenhum convite gravado", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });

    const result = await createTeamInvite(db, {
      actorId: admin.id,
      inviteeLabel: null,
      role: "operator",
      sectorId: null,
      baseURL: BASE_URL,
      now: NOW,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "SECTOR_REQUIRED",
      message: SECTOR_REQUIRED_MESSAGE,
      fieldErrors: { sectorId: SECTOR_REQUIRED_MESSAGE },
    });
    expect(await db.select().from(invite)).toHaveLength(0);
  });

  it("setor inativo: SECTOR_INACTIVE e nenhum convite gravado", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const setor = await insertSector(db, "Fechado", { active: false });

    const result = await createTeamInvite(db, {
      actorId: admin.id,
      inviteeLabel: null,
      role: "operator",
      sectorId: setor.id,
      baseURL: BASE_URL,
      now: NOW,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "SECTOR_INACTIVE",
      message: SECTOR_INACTIVE_MESSAGE,
    });
    expect(await db.select().from(invite)).toHaveLength(0);
  });

  it("setor inexistente: NOT_FOUND", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });

    const result = await createTeamInvite(db, {
      actorId: admin.id,
      inviteeLabel: null,
      role: "operator",
      sectorId: "00000000-0000-4000-8000-000000000000",
      baseURL: BASE_URL,
      now: NOW,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "NOT_FOUND",
      message: "Setor não encontrado. Atualize a página.",
    });
  });

  it("rótulo vazio ou só espaços vira null", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });

    for (const label of ["", "   ", null]) {
      const result = await createTeamInvite(db, {
        actorId: admin.id,
        inviteeLabel: label,
        role: "admin",
        sectorId: null,
        baseURL: BASE_URL,
        now: NOW,
      });
      if (!result.ok) throw new Error(result.message);
      expect((await readInvite(result.id)).inviteeLabel).toBeNull();
    }
  });

  it("rótulo com 80 caracteres passa; com 81 é recusado (conta pontos de código)", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });
    const input = {
      actorId: admin.id,
      role: "admin",
      sectorId: null,
      baseURL: BASE_URL,
      now: NOW,
    } as const;

    const accepted = await createTeamInvite(db, {
      ...input,
      inviteeLabel: "ã".repeat(80),
    });
    const refused = await createTeamInvite(db, {
      ...input,
      inviteeLabel: "😀".repeat(81),
    });

    expect(accepted.ok).toBe(true);
    expect(refused).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: INVITE_LABEL_TOO_LONG_MESSAGE,
      fieldErrors: { inviteeLabel: INVITE_LABEL_TOO_LONG_MESSAGE },
    });
    expect(await db.select().from(invite)).toHaveLength(1);
  });

  it("URL base inválida lança antes de gravar o convite", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });

    await expect(
      createTeamInvite(db, {
        actorId: admin.id,
        inviteeLabel: null,
        role: "admin",
        sectorId: null,
        baseURL: "localhost:3000",
        now: NOW,
      }),
    ).rejects.toThrow("BETTER_AUTH_URL");
    expect(await db.select().from(invite)).toHaveLength(0);
  });

  it("barra final ou caminho na URL base não duplicam a barra do link", async () => {
    const admin = await insertUser(db, { role: "admin", sectorId: null });

    const result = await createTeamInvite(db, {
      actorId: admin.id,
      inviteeLabel: null,
      role: "admin",
      sectorId: null,
      baseURL: `${BASE_URL}/`,
      now: NOW,
    });

    if (!result.ok) throw new Error(result.message);
    expect(result.url.startsWith(`${BASE_URL}/convite/`)).toBe(true);
  });
});

describe("listPendingInvites", () => {
  it("lista só os válidos e esconde usado, cancelado e expirado", async () => {
    const setor = await insertSector(db, "Almoxarifado");
    const admin = await insertUser(db, {
      role: "admin",
      sectorId: null,
      name: "Carla Admin",
    });
    await insertInvite(db, {
      role: "operator",
      sectorId: setor.id,
      inviteeLabel: "Válido",
      invitedBy: admin.id,
      now: NOW,
    });
    await insertInvite(db, {
      inviteeLabel: "Usado",
      usedAt: NOW,
      now: NOW,
    });
    await insertInvite(db, {
      inviteeLabel: "Cancelado",
      cancelledAt: NOW,
      now: NOW,
    });
    await insertInvite(db, {
      inviteeLabel: "Expirado",
      expiresAt: new Date(NOW.getTime() - 1),
      now: NOW,
    });
    await insertInvite(db, {
      inviteeLabel: "Expira agora",
      expiresAt: NOW,
      now: NOW,
    });

    const page = await listPendingInvites(db, { page: 1 }, NOW);

    expect(page.total).toBe(1);
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]).toMatchObject({
      inviteeLabel: "Válido",
      role: "operator",
      sectorName: "Almoxarifado",
      inviterName: "Carla Admin",
    });
    expect(page.rows[0]?.expiresAt).toEqual(
      new Date(NOW.getTime() + INVITE_TTL_MS),
    );
  });

  it("convite do sistema (sem convidante) e de admin (sem setor) vêm com nulos", async () => {
    await insertInvite(db, { now: NOW });

    const { rows } = await listPendingInvites(db, { page: 1 }, NOW);

    expect(rows[0]).toMatchObject({
      inviteeLabel: null,
      role: "admin",
      sectorName: null,
      inviterName: null,
    });
  });

  it("convite cancelado some da lista", async () => {
    const { id } = await insertInvite(db, { now: NOW });
    expect((await listPendingInvites(db, { page: 1 }, NOW)).total).toBe(1);

    await cancelPendingInvite(db, { id }, NOW);

    expect((await listPendingInvites(db, { page: 1 }, NOW)).total).toBe(0);
  });

  it("do mais novo para o mais antigo", async () => {
    for (const label of ["primeiro", "segundo", "terceiro"]) {
      await insertInvite(db, { inviteeLabel: label, now: NOW });
    }

    const { rows } = await listPendingInvites(db, { page: 1 }, NOW);

    expect(rows.map((row) => row.inviteeLabel)).toEqual([
      "terceiro",
      "segundo",
      "primeiro",
    ]);
  });

  it("vazio: página 1 de 1 sem linhas", async () => {
    expect(await listPendingInvites(db, { page: 1 }, NOW)).toMatchObject({
      rows: [],
      total: 0,
      page: 1,
      pageCount: 1,
    });
  });

  it("pagina de 50 em 50 e limita a página pedida ao intervalo", async () => {
    for (let index = 0; index < PAGE_SIZE + 1; index++) {
      await insertInvite(db, { now: NOW });
    }

    const first = await listPendingInvites(db, { page: 1 }, NOW);
    const second = await listPendingInvites(db, { page: 2 }, NOW);
    const beyond = await listPendingInvites(db, { page: 40 }, NOW);

    expect(first.rows).toHaveLength(PAGE_SIZE);
    expect(first.pageCount).toBe(2);
    expect(second.rows).toHaveLength(1);
    expect(beyond.page).toBe(2);
    expect(beyond.rows).toHaveLength(1);
  });
});

describe("cancelPendingInvite", () => {
  it("cancela o convite pendente", async () => {
    const { id } = await insertInvite(db, { now: NOW });

    expect(await cancelPendingInvite(db, { id }, NOW)).toEqual({ ok: true });
    expect((await readInvite(id)).cancelledAt).toEqual(NOW);
  });

  it.each([
    ["usado", { usedAt: NOW }],
    ["já cancelado", { cancelledAt: NOW }],
    ["expirado", { expiresAt: new Date(NOW.getTime() - 1) }],
  ])("convite %s: INVITE_NOT_PENDING", async (_name, state) => {
    const { id } = await insertInvite(db, { now: NOW, ...state });

    expect(await cancelPendingInvite(db, { id }, NOW)).toMatchObject({
      ok: false,
      code: "INVITE_NOT_PENDING",
      message: INVITE_NOT_PENDING_MESSAGE,
    });
  });

  it("id inexistente: INVITE_NOT_PENDING", async () => {
    expect(
      await cancelPendingInvite(
        db,
        { id: "00000000-0000-4000-8000-000000000000" },
        NOW,
      ),
    ).toMatchObject({ ok: false, code: "INVITE_NOT_PENDING" });
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bun run test -- src/features/admin/teamInvites.test.ts`
Expected: FAIL com `Cannot find module './teamInvites' imported from …/src/features/admin/teamInvites.test.ts`

- [ ] **Step 7: Write minimal implementation (`teamInvites.ts`)**

Crie `src/features/admin/teamInvites.ts`:

```ts
import "server-only";

import { and, count, desc, eq, gt, isNull } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { invite } from "@/db/schema/invites";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";
import { ADMIN_INVITE_LABEL_MAX_LENGTH } from "@/features/invites/adminInvite";
import { cancelInvite, createInvite } from "@/features/invites/inviteQueries";
import { buildInviteUrl, isHttpUrl } from "@/features/invites/inviteUrl";
import type { Role } from "@/lib/roles";
import {
  INVITE_LABEL_TOO_LONG_MESSAGE,
  INVITE_NOT_PENDING_MESSAGE,
  notFoundMessage,
  SECTOR_INACTIVE_MESSAGE,
  SECTOR_REQUIRED_MESSAGE,
} from "./messages";
import { normalizeName } from "./names";
import { PAGE_SIZE, type Page, resolvePage } from "./pagination";
import { type AdminResult, fail, ok } from "./result";

export type PendingInviteRow = {
  id: string;
  inviteeLabel: string | null;
  role: Role;
  sectorName: string | null;
  inviterName: string | null;
  expiresAt: Date;
  createdAt: Date;
};

// Pendente = mesma regra de consumeInvite/cancelInvite (estado "valid").
function pendingWhere(now: Date) {
  return and(
    isNull(invite.usedAt),
    isNull(invite.cancelledAt),
    gt(invite.expiresAt, now),
  );
}

export async function listPendingInvites(
  db: Db,
  input: { page: number },
  now: Date,
): Promise<Page<PendingInviteRow>> {
  const [totalRow] = await db
    .select({ value: count() })
    .from(invite)
    .where(pendingWhere(now));
  const total = totalRow?.value ?? 0;
  const { page, pageCount, offset } = resolvePage(total, input.page);

  const rows = await db
    .select({
      id: invite.id,
      inviteeLabel: invite.inviteeLabel,
      role: invite.role,
      sectorName: sector.name,
      inviterName: user.name,
      expiresAt: invite.expiresAt,
      createdAt: invite.createdAt,
    })
    .from(invite)
    .leftJoin(sector, eq(invite.sectorId, sector.id))
    .leftJoin(user, eq(invite.invitedBy, user.id))
    .where(pendingWhere(now))
    .orderBy(desc(invite.createdAt), desc(invite.id))
    .limit(PAGE_SIZE)
    .offset(offset);

  return { rows, total, page, pageCount, pageSize: PAGE_SIZE };
}

export async function createTeamInvite(
  db: Db,
  input: {
    actorId: string;
    inviteeLabel: string | null;
    role: Role;
    sectorId: string | null;
    baseURL: string;
    now: Date;
  },
): Promise<AdminResult<{ id: string; url: string; expiresAt: Date }>> {
  const label = normalizeName(input.inviteeLabel ?? "");
  if ([...label].length > ADMIN_INVITE_LABEL_MAX_LENGTH) {
    return fail("INVALID_INPUT", INVITE_LABEL_TOO_LONG_MESSAGE, {
      inviteeLabel: INVITE_LABEL_TOO_LONG_MESSAGE,
    });
  }

  // A checagem do setor e o INSERT do convite rodam na mesma transação: o
  // FOR SHARE segura o setor e serializa com o FOR UPDATE de setSectorActive.
  return db.transaction(async (tx) => {
    let sectorId: string | null = null;
    if (input.role === "operator") {
      if (!input.sectorId) {
        return fail("SECTOR_REQUIRED", SECTOR_REQUIRED_MESSAGE, {
          sectorId: SECTOR_REQUIRED_MESSAGE,
        });
      }
      const [chosen] = await tx
        .select({ id: sector.id, active: sector.active })
        .from(sector)
        .where(eq(sector.id, input.sectorId))
        .limit(1)
        .for("share");
      if (!chosen) {
        return fail("NOT_FOUND", notFoundMessage("setor"));
      }
      if (!chosen.active) {
        return fail("SECTOR_INACTIVE", SECTOR_INACTIVE_MESSAGE, {
          sectorId: SECTOR_INACTIVE_MESSAGE,
        });
      }
      sectorId = chosen.id;
    }

    // Valida a URL antes de gravar: senão o convite nasceria sem link para mostrar.
    if (!isHttpUrl(input.baseURL)) {
      throw new Error(
        `BETTER_AUTH_URL não é uma URL absoluta: "${input.baseURL}".`,
      );
    }

    const { id, token, expiresAt } = await createInvite(tx, {
      role: input.role,
      sectorId,
      inviteeLabel: label === "" ? null : label,
      invitedBy: input.actorId,
      now: input.now,
    });

    return ok({ id, url: buildInviteUrl(input.baseURL, token), expiresAt });
  });
}

export async function cancelPendingInvite(
  db: Db,
  input: { id: string },
  now: Date,
): Promise<AdminResult> {
  const cancelled = await cancelInvite(db, input.id, now);
  if (!cancelled) {
    return fail("INVITE_NOT_PENDING", INVITE_NOT_PENDING_MESSAGE);
  }
  return ok();
}
```

Notas: o admin forçado a `sectorId = null` e o operador exigindo setor **ativo** vêm do contrato; o domínio revalida mesmo que o formulário já tenha escolhido. `invitedBy` é sempre o admin da sessão (a action passa `actor.userId`). O link usa só a origem de `authEnv.baseURL` (`buildInviteUrl`), e o teste prova que o token do link passa por `findInviteByToken` (o convite gerado é de fato utilizável).

- [ ] **Step 8: Run test to verify it passes**

Run: `bun run test -- src/features/admin/teamInvites.test.ts`
Expected: PASS (20 testes)

- [ ] **Step 9: Write the failing test das actions de convite**

(a) Em `src/app/(app)/admin/equipe/actions.test.ts`, `actions.ts` passará a importar `@/lib/auth` (que exige variáveis de ambiente); acrescente o mock logo depois do mock de sessão (Edit):

`old_string`:
```text
vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
```

`new_string`:
```text
vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/auth", () => ({
  authEnv: { baseURL: "https://closery.example.test" },
}));
```

(b) Crie `src/app/(app)/admin/equipe/inviteActions.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { invite } from "@/db/schema/invites";
import { findInviteByToken } from "@/features/invites/inviteQueries";
import { authzOf } from "../../../../../test/authz";
import { resetDb } from "../../../../../test/db";
import {
  insertInvite,
  insertSector,
  insertUser,
} from "../../../../../test/fixtures";
import { cancelInviteAction, createInviteAction } from "./actions";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  client: null as PGlite | null,
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/auth", () => ({
  authEnv: { baseURL: "https://closery.example.test" },
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("../../../../../test/db");
  const created = await createTestDb();
  mocks.client = created.client;
  return { db: created.db };
});

const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";

beforeEach(async () => {
  if (!mocks.client) throw new Error("PGlite não iniciou");
  await resetDb(mocks.client);
  mocks.requireAdmin.mockReset();
  mocks.revalidatePath.mockReset();
});

async function setup() {
  const admin = await insertUser(db, {
    role: "admin",
    sectorId: null,
    name: "Carla Admin",
  });
  const sector = await insertSector(db, "Almoxarifado");
  mocks.requireAdmin.mockResolvedValue(
    authzOf({ role: "admin", userId: admin.id }),
  );
  return { admin, sector };
}

describe("createInviteAction", () => {
  it("operador: requireAdmin lança notFound e nenhum convite é criado", async () => {
    const { sector } = await setup();
    mocks.requireAdmin.mockRejectedValue(new Error(NOT_FOUND));

    await expect(
      createInviteAction({
        inviteeLabel: "",
        role: "operator",
        sectorId: sector.id,
      }),
    ).rejects.toThrow(NOT_FOUND);

    expect(await db.select().from(invite)).toHaveLength(0);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("devolve o link com a URL do ambiente, aceito por findInviteByToken, convidado pelo admin da sessão", async () => {
    const { admin, sector } = await setup();

    const result = await createInviteAction({
      inviteeLabel: "  Maria  ",
      role: "operator",
      sectorId: sector.id,
    });

    if (!result.ok) throw new Error(result.message);
    expect(result.url.startsWith("https://closery.example.test/convite/")).toBe(
      true,
    );
    expect(result.expiresAt).toBeInstanceOf(Date);
    const token = result.url.split("/convite/")[1] ?? "";
    expect(await findInviteByToken(db, token, new Date())).toMatchObject({
      state: "valid",
      role: "operator",
      sectorName: "Almoxarifado",
      inviterName: "Carla Admin",
      inviteeLabel: "Maria",
    });
    const [row] = await db
      .select()
      .from(invite)
      .where(eq(invite.id, result.id));
    expect(row?.invitedBy).toBe(admin.id);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
  });

  it("convite de administrador não precisa de setor", async () => {
    await setup();

    const result = await createInviteAction({
      inviteeLabel: "",
      role: "admin",
      sectorId: null,
    });

    expect(result.ok).toBe(true);
  });

  it("operador sem setor volta SECTOR_REQUIRED no campo", async () => {
    await setup();

    const result = await createInviteAction({
      inviteeLabel: "",
      role: "operator",
      sectorId: null,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "SECTOR_REQUIRED",
      fieldErrors: { sectorId: "Escolha o setor do operador." },
    });
    expect(await db.select().from(invite)).toHaveLength(0);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("nome de referência acima de 80 caracteres volta INVALID_INPUT no campo", async () => {
    await setup();

    const result = await createInviteAction({
      inviteeLabel: "a".repeat(81),
      role: "admin",
      sectorId: null,
    });

    expect(result).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      fieldErrors: {
        inviteeLabel: "O nome de referência pode ter no máximo 80 caracteres.",
      },
    });
  });

  it("papel desconhecido e lixo voltam INVALID_INPUT", async () => {
    await setup();

    expect(
      await createInviteAction({
        inviteeLabel: "",
        role: "dono",
        sectorId: null,
      }),
    ).toMatchObject({ ok: false, code: "INVALID_INPUT" });
    expect(await createInviteAction(undefined)).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
    });
  });
});

describe("cancelInviteAction", () => {
  it("operador: requireAdmin lança notFound e o convite continua pendente", async () => {
    await setup();
    const { id } = await insertInvite(db);
    mocks.requireAdmin.mockRejectedValue(new Error(NOT_FOUND));

    await expect(cancelInviteAction({ id })).rejects.toThrow(NOT_FOUND);

    const [row] = await db.select().from(invite).where(eq(invite.id, id));
    expect(row?.cancelledAt).toBeNull();
  });

  it("cancela o convite pendente e revalida", async () => {
    await setup();
    const { id } = await insertInvite(db);

    const result = await cancelInviteAction({ id });

    expect(result).toEqual({ ok: true });
    const [row] = await db.select().from(invite).where(eq(invite.id, id));
    expect(row?.cancelledAt).not.toBeNull();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/(app)/admin", "layout");
  });

  it("cancelar de novo volta INVITE_NOT_PENDING sem revalidar", async () => {
    await setup();
    const { id } = await insertInvite(db, { cancelledAt: new Date() });

    const result = await cancelInviteAction({ id });

    expect(result).toMatchObject({ ok: false, code: "INVITE_NOT_PENDING" });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("id malformado volta INVALID_INPUT sem consultar o banco", async () => {
    await setup();

    expect(await cancelInviteAction({ id: "não-é-uuid" })).toMatchObject({
      ok: false,
      code: "INVALID_INPUT",
      message: "Registro inválido. Atualize a página.",
    });
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `bun run test -- "src/app/(app)/admin/equipe/inviteActions.test.ts"`
Expected: FAIL com `createInviteAction is not a function` (a action ainda não existe em `actions.ts`)

- [ ] **Step 11: Write minimal implementation (`actions.ts` completo)**

Substitua **todo** o conteúdo de `src/app/(app)/admin/equipe/actions.ts` por:

```ts
"use server";

import { setPersonActive, updatePerson } from "@/features/admin/people";
import type { AdminResult } from "@/features/admin/result";
import { runAdminAction } from "@/features/admin/runAdminAction";
import {
  cancelInviteSchema,
  createInviteSchema,
  setPersonActiveSchema,
  updatePersonSchema,
} from "@/features/admin/schemas";
import {
  cancelPendingInvite,
  createTeamInvite,
} from "@/features/admin/teamInvites";
import { authEnv } from "@/lib/auth";
import { requireAdmin } from "@/lib/auth/session";

// `input: unknown` é o objeto do formulário (UpdatePersonInput); o schema Zod
// valida de novo no servidor, então o cliente nunca é a fonte da verdade.
export async function updatePersonAction(input: unknown): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: updatePersonSchema,
    input,
    run: ({ db, actor: current, input: data }) =>
      updatePerson(db, { actorId: current.userId, ...data }),
  });
}

export async function setPersonActiveAction(
  input: unknown,
): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: setPersonActiveSchema,
    input,
    run: ({ db, now, actor: current, input: data }) =>
      setPersonActive(db, { actorId: current.userId, ...data }, now),
  });
}

// O link nasce aqui e volta uma vez só: o banco guarda apenas o hash do token.
export async function createInviteAction(
  input: unknown,
): Promise<AdminResult<{ id: string; url: string; expiresAt: Date }>> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: createInviteSchema,
    input,
    run: ({ db, now, actor: current, input: data }) =>
      createTeamInvite(db, {
        actorId: current.userId,
        inviteeLabel: data.inviteeLabel,
        role: data.role,
        sectorId: data.sectorId,
        baseURL: authEnv.baseURL,
        now,
      }),
  });
}

export async function cancelInviteAction(input: unknown): Promise<AdminResult> {
  const actor = await requireAdmin();
  return runAdminAction({
    actor,
    schema: cancelInviteSchema,
    input,
    run: ({ db, now, input: data }) =>
      cancelPendingInvite(db, { id: data.id }, now),
  });
}
```

- [ ] **Step 12: Run tests to verify they pass**

Run: `bun run test -- "src/app/(app)/admin/equipe"`
Expected: PASS (20 testes: 10 em `actions.test.ts` e 10 em `inviteActions.test.ts`)

- [ ] **Step 13: Write the failing test de `InviteLinkCard`**

Crie `src/components/admin/team/InviteLinkCard.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InviteLinkCard } from "./InviteLinkCard";

const mocks = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  writeText: vi.fn(),
  share: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const URL_OF_INVITE = "https://closery.example.test/convite/token-de-teste";
// 17:30 UTC = 14:30 em São Paulo (UTC-3, sem horário de verão em 2026).
const EXPIRES_AT = new Date("2026-11-28T17:30:00.000Z");

function defineNavigator(name: "clipboard" | "share", value: unknown) {
  Object.defineProperty(navigator, name, { configurable: true, value });
}

function setup(onReset = vi.fn()) {
  render(
    <InviteLinkCard
      url={URL_OF_INVITE}
      expiresAt={EXPIRES_AT}
      onReset={onReset}
    />,
  );
  return { onReset };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.writeText.mockResolvedValue(undefined);
  mocks.share.mockResolvedValue(undefined);
  defineNavigator("clipboard", { writeText: mocks.writeText });
});

afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
  Reflect.deleteProperty(navigator, "share");
});

describe("InviteLinkCard", () => {
  it("mostra o título, o link somente leitura e a validade", () => {
    setup();

    expect(
      screen.getByRole("heading", { name: "Convite gerado" }),
    ).toBeInTheDocument();
    const field = screen.getByLabelText("Link do convite");
    expect(field).toHaveValue(URL_OF_INVITE);
    expect(field).toHaveAttribute("readonly");
    expect(
      screen.getByText(
        "Válido até 28/11/2026, 14:30. O link aparece só agora: se perder, cancele o convite e gere outro.",
      ),
    ).toBeInTheDocument();
  });

  it("Copiar link copia o link e avisa", async () => {
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));

    await waitFor(() =>
      expect(mocks.toastSuccess).toHaveBeenCalledWith("Link copiado."),
    );
    expect(mocks.writeText).toHaveBeenCalledWith(URL_OF_INVITE);
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("copiar recusado pelo navegador avisa como copiar à mão", async () => {
    mocks.writeText.mockRejectedValue(
      new DOMException("negado", "NotAllowedError"),
    );
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Não foi possível copiar. Selecione o link e copie.",
      ),
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("sem navigator.clipboard (contexto inseguro) também avisa, sem quebrar", async () => {
    Reflect.deleteProperty(navigator, "clipboard");
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith(
        "Não foi possível copiar. Selecione o link e copie.",
      ),
    );
  });

  it("sem navigator.share não mostra Compartilhar", () => {
    setup();
    expect(
      screen.queryByRole("button", { name: "Compartilhar" }),
    ).not.toBeInTheDocument();
  });

  it("com navigator.share mostra Compartilhar e envia título, texto e link", async () => {
    defineNavigator("share", mocks.share);
    setup();

    fireEvent.click(
      await screen.findByRole("button", { name: "Compartilhar" }),
    );

    await waitFor(() =>
      expect(mocks.share).toHaveBeenCalledWith({
        title: "Convite para o Closery",
        text: "Você foi convidado para o Closery.",
        url: URL_OF_INVITE,
      }),
    );
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.writeText).not.toHaveBeenCalled();
  });

  it("fechar a folha de compartilhamento (AbortError) é silencioso", async () => {
    mocks.share.mockRejectedValue(new DOMException("fechou", "AbortError"));
    defineNavigator("share", mocks.share);
    setup();

    fireEvent.click(
      await screen.findByRole("button", { name: "Compartilhar" }),
    );

    await waitFor(() => expect(mocks.share).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.writeText).not.toHaveBeenCalled();
  });

  it("falha real ao compartilhar cai para copiar o link", async () => {
    mocks.share.mockRejectedValue(
      new DOMException("sem app", "NotAllowedError"),
    );
    defineNavigator("share", mocks.share);
    setup();

    fireEvent.click(
      await screen.findByRole("button", { name: "Compartilhar" }),
    );

    await waitFor(() =>
      expect(mocks.writeText).toHaveBeenCalledWith(URL_OF_INVITE),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Link copiado.");
  });

  it("Gerar outro convite chama onReset", () => {
    const { onReset } = setup();

    fireEvent.click(
      screen.getByRole("button", { name: "Gerar outro convite" }),
    );

    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
```

Nota de teste: o jsdom não tem `navigator.clipboard` nem `navigator.share`; o teste define e remove as propriedades com `Object.defineProperty`/`Reflect.deleteProperty`. Os cliques usam `fireEvent` (e não `userEvent.setup()`) porque o `user-event` instala o próprio `navigator.clipboard` e esconderia o mock.

- [ ] **Step 14: Run test to verify it fails**

Run: `bun run test -- src/components/admin/team/InviteLinkCard.test.tsx`
Expected: FAIL com `Failed to resolve import "./InviteLinkCard"`

- [ ] **Step 15: Write minimal implementation (`InviteLinkCard.tsx`)**

Crie `src/components/admin/team/InviteLinkCard.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDateTimeBR } from "@/lib/dateTime";

export function InviteLinkCard({
  url,
  expiresAt,
  onReset,
}: {
  url: string;
  expiresAt: Date;
  onReset: () => void;
}) {
  // Só depois de montar: no servidor `navigator` não existe e o HTML inicial
  // precisa ser igual ao do cliente.
  const [canShare, setCanShare] = useState(false);
  useEffect(() => {
    setCanShare(typeof navigator.share === "function");
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie.");
    }
  }

  async function share() {
    try {
      await navigator.share({
        title: "Convite para o Closery",
        text: "Você foi convidado para o Closery.",
        url,
      });
    } catch (error) {
      // Fechar a folha de compartilhamento não é erro.
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copy();
    }
  }

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="invite-link-title"
    >
      <h3 id="invite-link-title" className="text-base font-medium">
        Convite gerado
      </h3>
      <Input
        readOnly
        value={url}
        aria-label="Link do convite"
        onFocus={(event) => event.currentTarget.select()}
      />
      <p className="text-sm text-muted-foreground">
        Válido até {formatDateTimeBR(expiresAt)}. O link aparece só agora: se
        perder, cancele o convite e gere outro.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={copy}>
          Copiar link
        </Button>
        {canShare && (
          <Button type="button" variant="outline" onClick={share}>
            Compartilhar
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onReset}>
          Gerar outro convite
        </Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 16: Run test to verify it passes**

Run: `bun run test -- src/components/admin/team/InviteLinkCard.test.tsx`
Expected: PASS (9 testes)

- [ ] **Step 17: Write the failing tests de `InviteForm` e `PendingInviteActions`**

Crie `src/components/admin/team/InviteForm.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail } from "@/features/admin/result";
import type { SectorChoice } from "@/features/admin/sectors";
import { InviteForm } from "./InviteForm";

const mocks = vi.hoisted(() => ({
  createInviteAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/equipe/actions", () => ({
  createInviteAction: mocks.createInviteAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const SECTOR_A: SectorChoice = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Almoxarifado",
};
const SECTOR_B: SectorChoice = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Recebimento",
};
const LINK = "https://closery.example.test/convite/token-de-teste";
const EXPIRES_AT = new Date("2026-11-28T17:30:00.000Z");
const LABEL = "Nome de referência (opcional)";

function setup(sectors: SectorChoice[] = [SECTOR_A, SECTOR_B]) {
  const user = userEvent.setup();
  render(<InviteForm sectors={sectors} />);
  return { user };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createInviteAction.mockResolvedValue({
    ok: true,
    id: "convite-1",
    url: LINK,
    expiresAt: EXPIRES_AT,
  });
});

describe("InviteForm", () => {
  it("nunca começa em branco: Operador e o primeiro setor já escolhidos", () => {
    setup();

    expect(screen.getByText("Convidar pessoa")).toBeInTheDocument();
    expect(screen.getByLabelText(LABEL)).toHaveValue("");
    expect(
      screen.getByText("Só para você reconhecer o convite na lista."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Operador" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Setor")).toHaveValue(SECTOR_A.id);
    expect(screen.getByRole("button", { name: "Gerar convite" })).toBeEnabled();
  });

  it("gera o convite de operador e mostra o link no lugar do formulário", async () => {
    const { user } = setup();

    await user.type(screen.getByLabelText(LABEL), "Maria do Turno");
    await user.selectOptions(screen.getByLabelText("Setor"), SECTOR_B.id);
    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    expect(
      await screen.findByRole("heading", { name: "Convite gerado" }),
    ).toBeInTheDocument();
    expect(mocks.createInviteAction).toHaveBeenCalledWith({
      inviteeLabel: "Maria do Turno",
      role: "operator",
      sectorId: SECTOR_B.id,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Convite gerado.");
    expect(screen.getByLabelText("Link do convite")).toHaveValue(LINK);
    expect(
      screen.queryByRole("button", { name: "Gerar convite" }),
    ).not.toBeInTheDocument();
  });

  it("Administrador esconde o setor e envia setor nulo", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Administrador" }));
    expect(screen.queryByLabelText("Setor")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    await waitFor(() =>
      expect(mocks.createInviteAction).toHaveBeenCalledWith({
        inviteeLabel: "",
        role: "admin",
        sectorId: null,
      }),
    );
  });

  it("Gerar outro convite volta ao formulário, limpa o nome e mantém papel e setor", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText(LABEL), "Maria");
    await user.selectOptions(screen.getByLabelText("Setor"), SECTOR_B.id);
    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    await user.click(
      await screen.findByRole("button", { name: "Gerar outro convite" }),
    );

    expect(screen.getByLabelText(LABEL)).toHaveValue("");
    expect(screen.getByLabelText("Setor")).toHaveValue(SECTOR_B.id);
    expect(
      screen.queryByRole("heading", { name: "Convite gerado" }),
    ).not.toBeInTheDocument();
  });

  it("nome de referência acima de 80 caracteres: recusa no cliente", async () => {
    const { user } = setup();

    await user.click(screen.getByLabelText(LABEL));
    await user.paste("a".repeat(81));
    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "O nome de referência pode ter no máximo 80 caracteres.",
    );
    expect(mocks.createInviteAction).not.toHaveBeenCalled();
  });

  it("80 caracteres exatos passam", async () => {
    const { user } = setup();

    await user.click(screen.getByLabelText(LABEL));
    await user.paste("a".repeat(80));
    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    await waitFor(() =>
      expect(mocks.createInviteAction).toHaveBeenCalledTimes(1),
    );
  });

  it("recusa do servidor no campo setor aparece nele e preserva o que foi digitado", async () => {
    mocks.createInviteAction.mockResolvedValue(
      fail("SECTOR_INACTIVE", "Este setor está inativo. Escolha outro.", {
        sectorId: "Este setor está inativo. Escolha outro.",
      }),
    );
    const { user } = setup();

    await user.type(screen.getByLabelText(LABEL), "Maria");
    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Este setor está inativo. Escolha outro.",
    );
    expect(screen.getByLabelText(LABEL)).toHaveValue("Maria");
    expect(screen.getByLabelText("Setor")).toHaveValue(SECTOR_A.id);
    expect(
      screen.queryByRole("heading", { name: "Convite gerado" }),
    ).not.toBeInTheDocument();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("erro inesperado vira a mensagem padrão no formulário", async () => {
    mocks.createInviteAction.mockRejectedValue(new Error("rede"));
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Gerar convite" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Não foi possível concluir. Tente de novo.",
    );
    expect(screen.getByRole("button", { name: "Gerar convite" })).toBeEnabled();
  });

  it("sem setor ativo: explica, leva a Setores e não oferece gerar para operador", async () => {
    const { user } = setup([]);

    expect(
      screen.getByText("Cadastre um setor antes de convidar um operador."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ir para Setores" }),
    ).toHaveAttribute("href", "/admin/setores");
    expect(
      screen.queryByRole("button", { name: "Gerar convite" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Administrador" }));

    expect(
      screen.queryByRole("link", { name: "Ir para Setores" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Gerar convite" }),
    ).toBeInTheDocument();
  });

  it("trava o botão enquanto gera e não envia duas vezes", async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.createInviteAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { user } = setup();
    const submit = screen.getByRole("button", { name: "Gerar convite" });

    await user.click(submit);
    await waitFor(() => expect(submit).toBeDisabled());
    await user.click(submit);
    expect(mocks.createInviteAction).toHaveBeenCalledTimes(1);

    finish({ ok: true, id: "c", url: LINK, expiresAt: EXPIRES_AT });
    expect(
      await screen.findByRole("heading", { name: "Convite gerado" }),
    ).toBeInTheDocument();
  });
});
```

Crie `src/components/admin/team/PendingInviteActions.test.tsx`:

```tsx
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fail } from "@/features/admin/result";
import { PendingInviteActions } from "./PendingInviteActions";

const mocks = vi.hoisted(() => ({
  cancelInviteAction: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/app/(app)/admin/equipe/actions", () => ({
  cancelInviteAction: mocks.cancelInviteAction,
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

const ID = "33333333-3333-4333-8333-333333333333";

function setup(label = "Maria do Turno") {
  const user = userEvent.setup();
  render(<PendingInviteActions id={ID} label={label} />);
  return { user };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.cancelInviteAction.mockResolvedValue({ ok: true });
});

describe("PendingInviteActions", () => {
  it("o botão nomeia o convite para quem usa leitor de tela", () => {
    setup();
    expect(
      screen.getByRole("button", { name: "Cancelar convite Maria do Turno" }),
    ).toHaveTextContent("Cancelar convite");
  });

  it("sem nome de referência o rótulo vira 'sem nome'", () => {
    setup("sem nome");
    expect(
      screen.getByRole("button", { name: "Cancelar convite sem nome" }),
    ).toBeInTheDocument();
  });

  it("pede confirmação com o texto exato e não age antes", async () => {
    const { user } = setup();

    await user.click(
      screen.getByRole("button", { name: "Cancelar convite Maria do Turno" }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Cancelar convite?",
    });
    expect(
      within(dialog).getByText(
        "O link deixa de funcionar. Não dá para desfazer.",
      ),
    ).toBeInTheDocument();
    expect(mocks.cancelInviteAction).not.toHaveBeenCalled();
  });

  it("confirmar cancela, avisa e fecha o diálogo", async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole("button", { name: "Cancelar convite Maria do Turno" }),
    );

    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Cancelar convite" }),
    );

    await waitFor(() =>
      expect(mocks.cancelInviteAction).toHaveBeenCalledWith({ id: ID }),
    );
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Convite cancelado.");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("Voltar fecha sem cancelar", async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole("button", { name: "Cancelar convite Maria do Turno" }),
    );

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Voltar" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mocks.cancelInviteAction).not.toHaveBeenCalled();
  });

  it("convite que já não está pendente: mostra o motivo no diálogo e não fecha", async () => {
    mocks.cancelInviteAction.mockResolvedValue(
      fail(
        "INVITE_NOT_PENDING",
        "Este convite não está mais pendente. Atualize a página.",
      ),
    );
    const { user } = setup();
    await user.click(
      screen.getByRole("button", { name: "Cancelar convite Maria do Turno" }),
    );

    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Cancelar convite" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Este convite não está mais pendente. Atualize a página.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 18: Run tests to verify they fail**

Run: `bun run test -- src/components/admin/team/InviteForm.test.tsx src/components/admin/team/PendingInviteActions.test.tsx`
Expected: FAIL com `Failed to resolve import "./InviteForm"` e `Failed to resolve import "./PendingInviteActions"`

- [ ] **Step 19: Write minimal implementation (`InviteForm.tsx` e `PendingInviteActions.tsx`)**

Crie `src/components/admin/team/InviteForm.tsx`:

```tsx
"use client";

import Link from "next/link";
import { type FormEvent, useId, useState } from "react";

import { createInviteAction } from "@/app/(app)/admin/equipe/actions";
import { ChoiceGroup } from "@/components/admin/ChoiceGroup";
import { SelectField } from "@/components/admin/SelectField";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { FieldErrors } from "@/features/admin/result";
import { createInviteSchema, firstFieldErrors } from "@/features/admin/schemas";
import type { SectorChoice } from "@/features/admin/sectors";
import type { Role } from "@/lib/roles";
import { InviteLinkCard } from "./InviteLinkCard";
import { ROLE_OPTIONS } from "./roleOptions";

type CreatedInvite = { url: string; expiresAt: Date };

export function InviteForm({ sectors }: { sectors: readonly SectorChoice[] }) {
  const uid = useId();
  const { pending, run } = useAdminAction();
  // Nunca em branco: papel Operador (o mais comum) e o primeiro setor ativo.
  const [label, setLabel] = useState("");
  const [role, setRole] = useState<Role>("operator");
  const [sectorId, setSectorId] = useState(sectors[0]?.id ?? "");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedInvite | null>(null);

  const needsSector = role === "operator";
  const noSector = needsSector && sectors.length === 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || noSector) return;
    setFormError(null);

    const values = {
      inviteeLabel: label,
      role,
      sectorId: needsSector && sectorId !== "" ? sectorId : null,
    };
    const parsed = createInviteSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(firstFieldErrors(parsed.error));
      return;
    }
    setFieldErrors({});

    const result = await run(() => createInviteAction(values), {
      success: "Convite gerado.",
      showError: false,
    });
    if (result.ok) {
      setCreated({ url: result.url, expiresAt: result.expiresAt });
      return;
    }
    setFieldErrors(result.fieldErrors ?? {});
    if (!result.fieldErrors || Object.keys(result.fieldErrors).length === 0) {
      setFormError(result.message);
    }
  }

  function handleReset() {
    setCreated(null);
    setLabel("");
    setFieldErrors({});
    setFormError(null);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Convidar pessoa</CardTitle>
      </CardHeader>
      <CardContent>
        {created ? (
          <InviteLinkCard
            url={created.url}
            expiresAt={created.expiresAt}
            onReset={handleReset}
          />
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              <Field data-invalid={fieldErrors.inviteeLabel ? true : undefined}>
                <FieldLabel htmlFor={`${uid}-label`}>
                  Nome de referência (opcional)
                </FieldLabel>
                <Input
                  id={`${uid}-label`}
                  value={label}
                  disabled={pending}
                  autoComplete="off"
                  aria-invalid={fieldErrors.inviteeLabel ? true : undefined}
                  aria-describedby={
                    fieldErrors.inviteeLabel ? `${uid}-label-error` : undefined
                  }
                  onChange={(event) => setLabel(event.target.value)}
                />
                <FieldDescription>
                  Só para você reconhecer o convite na lista.
                </FieldDescription>
                {fieldErrors.inviteeLabel && (
                  <FieldError id={`${uid}-label-error`}>
                    {fieldErrors.inviteeLabel}
                  </FieldError>
                )}
              </Field>

              <ChoiceGroup
                legend="Papel"
                value={role}
                onValueChange={setRole}
                options={ROLE_OPTIONS}
                disabled={pending}
              />

              {needsSector && !noSector && (
                <SelectField
                  label="Setor"
                  value={sectorId}
                  onValueChange={setSectorId}
                  options={sectors.map((sector) => ({
                    value: sector.id,
                    label: sector.name,
                  }))}
                  error={fieldErrors.sectorId}
                  disabled={pending}
                />
              )}

              {noSector && (
                <div className="flex flex-col items-start gap-2">
                  <p className="text-sm text-muted-foreground">
                    Cadastre um setor antes de convidar um operador.
                  </p>
                  <Link
                    href="/admin/setores"
                    className={buttonVariants({ variant: "outline" })}
                  >
                    Ir para Setores
                  </Link>
                </div>
              )}

              {formError && <FieldError>{formError}</FieldError>}

              {!noSector && (
                <Button type="submit" size="lg" disabled={pending}>
                  Gerar convite
                </Button>
              )}
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
```

Crie `src/components/admin/team/PendingInviteActions.tsx`:

```tsx
"use client";

import { cancelInviteAction } from "@/app/(app)/admin/equipe/actions";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminAction } from "@/components/admin/useAdminAction";
import { Button } from "@/components/ui/button";

export function PendingInviteActions({
  id,
  label,
}: {
  id: string;
  label: string;
}) {
  const { run } = useAdminAction();

  return (
    <ConfirmDialog
      trigger={
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Cancelar convite ${label}`}
        >
          Cancelar convite
        </Button>
      }
      title="Cancelar convite?"
      description="O link deixa de funcionar. Não dá para desfazer."
      confirmLabel="Cancelar convite"
      destructive
      onConfirm={() =>
        run(() => cancelInviteAction({ id }), {
          success: "Convite cancelado.",
          showError: false,
        })
      }
    />
  );
}
```

- [ ] **Step 20: Run tests to verify they pass**

Run: `bun run test -- src/components/admin/team/InviteForm.test.tsx src/components/admin/team/PendingInviteActions.test.tsx`
Expected: PASS (16 testes: 10 em `InviteForm.test.tsx` e 6 em `PendingInviteActions.test.tsx`)

- [ ] **Step 21: Write the failing test de `TeamAdmin` com convites**

Substitua **todo** o conteúdo de `src/components/admin/team/TeamAdmin.test.tsx` por:

```tsx
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Page } from "@/features/admin/pagination";
import type { PersonRow } from "@/features/admin/people";
import type { PendingInviteRow } from "@/features/admin/teamInvites";
import { TeamAdmin } from "./TeamAdmin";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listPeople: vi.fn(),
  listPendingInvites: vi.fn(),
  listActiveSectors: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/features/admin/people", () => ({ listPeople: mocks.listPeople }));
vi.mock("@/features/admin/teamInvites", () => ({
  listPendingInvites: mocks.listPendingInvites,
}));
vi.mock("@/features/admin/sectors", () => ({
  listActiveSectors: mocks.listActiveSectors,
}));
vi.mock("@/app/(app)/admin/equipe/actions", () => ({
  updatePersonAction: vi.fn(),
  setPersonActiveAction: vi.fn(),
  createInviteAction: vi.fn(),
  cancelInviteAction: vi.fn(),
}));

const SECTOR_ID = "11111111-1111-4111-8111-111111111111";
const NOT_FOUND = "NEXT_HTTP_ERROR_FALLBACK;404";
// 17:30 UTC = 14:30 em São Paulo.
const EXPIRES_AT = new Date("2026-11-28T17:30:00.000Z");

function person(overrides: Partial<PersonRow> = {}): PersonRow {
  return {
    id: "pessoa-1",
    name: "Bruno Fictício",
    email: "bruno@example.test",
    role: "operator",
    sectorId: SECTOR_ID,
    sectorName: "Almoxarifado",
    sectorActive: true,
    active: true,
    ...overrides,
  };
}

function pendingInvite(
  overrides: Partial<PendingInviteRow> = {},
): PendingInviteRow {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    inviteeLabel: "Maria do Turno",
    role: "operator",
    sectorName: "Almoxarifado",
    inviterName: "Carla Admin",
    expiresAt: EXPIRES_AT,
    createdAt: new Date("2026-11-21T17:30:00.000Z"),
    ...overrides,
  };
}

function page<T>(rows: T[], overrides: Partial<Page<T>> = {}): Page<T> {
  return {
    rows,
    total: rows.length,
    page: 1,
    pageCount: 1,
    pageSize: 50,
    ...overrides,
  };
}

async function renderTeam(
  searchParams: Record<string, string | string[]> = {},
) {
  render(await TeamAdmin({ searchParams: Promise.resolve(searchParams) }));
}

function peopleSection() {
  return within(screen.getByRole("region", { name: "Pessoas" }));
}

function invitesSection() {
  return within(screen.getByRole("region", { name: "Convites pendentes" }));
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    userId: "admin-1",
    role: "admin",
    name: "Admin",
    email: "admin@example.test",
    sectorId: null,
  });
  mocks.listPeople.mockResolvedValue(page([person()]));
  mocks.listPendingInvites.mockResolvedValue(page([pendingInvite()]));
  mocks.listActiveSectors.mockResolvedValue([
    { id: SECTOR_ID, name: "Almoxarifado" },
  ]);
});

describe("TeamAdmin", () => {
  it("mostra título, texto, link de volta e as três seções", async () => {
    await renderTeam();

    expect(
      screen.getByRole("heading", { level: 1, name: "Equipe" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pessoas, papéis e convites.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para Administração" }),
    ).toHaveAttribute("href", "/admin");
    expect(screen.getByText("Convidar pessoa")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Gerar convite" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Convites pendentes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Pessoas" }),
    ).toBeInTheDocument();
  });

  it("o formulário de convite oferece os setores ativos", async () => {
    await renderTeam();
    expect(screen.getByLabelText("Setor")).toHaveValue(SECTOR_ID);
  });

  describe("convites pendentes", () => {
    it("linha de operador: nome, papel · setor, validade, quem convidou e cancelar", async () => {
      await renderTeam();

      const row = invitesSection().getByRole("listitem");
      expect(within(row).getByText("Maria do Turno")).toBeInTheDocument();
      expect(
        within(row).getByText("Operador · Almoxarifado"),
      ).toBeInTheDocument();
      expect(
        within(row).getByText("Válido até 28/11/2026, 14:30"),
      ).toBeInTheDocument();
      expect(
        within(row).getByText("Convidado por Carla Admin"),
      ).toBeInTheDocument();
      expect(
        within(row).getByRole("button", {
          name: "Cancelar convite Maria do Turno",
        }),
      ).toBeInTheDocument();
    });

    it("convite de administrador sem nome e sem convidante", async () => {
      mocks.listPendingInvites.mockResolvedValue(
        page([
          pendingInvite({
            inviteeLabel: null,
            role: "admin",
            sectorName: null,
            inviterName: null,
          }),
        ]),
      );

      await renderTeam();

      const row = invitesSection().getByRole("listitem");
      expect(
        within(row).getByText("Sem nome de referência"),
      ).toBeInTheDocument();
      expect(within(row).getByText("Administrador")).toBeInTheDocument();
      expect(
        within(row).getByText("Convidado pelo sistema"),
      ).toBeInTheDocument();
      expect(
        within(row).getByRole("button", {
          name: "Cancelar convite sem nome",
        }),
      ).toBeInTheDocument();
    });

    it("sem convites: estado vazio", async () => {
      mocks.listPendingInvites.mockResolvedValue(page([]));

      await renderTeam();

      expect(
        invitesSection().getByText("Nenhum convite pendente."),
      ).toBeInTheDocument();
      expect(invitesSection().queryByRole("list")).not.toBeInTheDocument();
    });

    it("lê a página de ?convites= (com a hora atual) e cai na 1 se for inválida", async () => {
      await renderTeam({ convites: "2" });
      expect(mocks.listPendingInvites).toHaveBeenLastCalledWith(
        {},
        { page: 2 },
        expect.any(Date),
      );

      await renderTeam({ convites: "0" });
      expect(mocks.listPendingInvites).toHaveBeenLastCalledWith(
        {},
        { page: 1 },
        expect.any(Date),
      );
    });

    it("a paginação dos convites usa ?convites= e preserva ?pagina=", async () => {
      mocks.listPendingInvites.mockResolvedValue(
        page([pendingInvite()], { page: 1, pageCount: 2, total: 60 }),
      );

      await renderTeam({ pagina: "3" });

      const nav = invitesSection().getByRole("navigation", {
        name: "Paginação",
      });
      expect(
        within(nav).getByRole("link", { name: "Próxima" }),
      ).toHaveAttribute("href", "/admin/equipe?pagina=3&convites=2");
    });
  });

  describe("pessoas", () => {
    it("linha de operador: nome, e-mail, papel, setor e os botões", async () => {
      await renderTeam();

      const row = peopleSection().getByRole("listitem");
      expect(within(row).getByText("Bruno Fictício")).toBeInTheDocument();
      expect(within(row).getByText("bruno@example.test")).toBeInTheDocument();
      expect(within(row).getByText("Operador")).toBeInTheDocument();
      expect(within(row).getByText("Almoxarifado")).toBeInTheDocument();
      expect(
        within(row).getByRole("button", { name: "Editar Bruno Fictício" }),
      ).toBeInTheDocument();
      expect(
        within(row).getByRole("button", { name: "Desativar Bruno Fictício" }),
      ).toBeInTheDocument();
      expect(within(row).queryByText("Inativo")).not.toBeInTheDocument();
    });

    it("a própria conta mostra Você e o texto de ajuda, sem nenhum botão", async () => {
      mocks.listPeople.mockResolvedValue(
        page([
          person({
            id: "admin-1",
            name: "Carla Admin",
            role: "admin",
            sectorId: null,
            sectorName: null,
            sectorActive: null,
          }),
        ]),
      );

      await renderTeam();

      const row = peopleSection().getByRole("listitem");
      expect(within(row).getByText("Você")).toBeInTheDocument();
      expect(within(row).getByText("Administrador")).toBeInTheDocument();
      expect(
        within(row).getByText(
          "Peça a outro administrador para mudar a sua conta.",
        ),
      ).toBeInTheDocument();
      expect(within(row).queryByRole("button")).not.toBeInTheDocument();
    });

    it("pessoa inativa mostra o selo e Reativar", async () => {
      mocks.listPeople.mockResolvedValue(page([person({ active: false })]));

      await renderTeam();

      const row = peopleSection().getByRole("listitem");
      expect(within(row).getByText("Inativo")).toBeInTheDocument();
      expect(
        within(row).getByRole("button", { name: "Reativar Bruno Fictício" }),
      ).toBeInTheDocument();
    });

    it("setor inativo da pessoa aparece com (inativo)", async () => {
      mocks.listPeople.mockResolvedValue(
        page([person({ sectorActive: false })]),
      );

      await renderTeam();

      expect(
        peopleSection().getByText("Almoxarifado (inativo)"),
      ).toBeInTheDocument();
    });

    it("sem pessoas: estado vazio", async () => {
      mocks.listPeople.mockResolvedValue(page([]));

      await renderTeam();

      expect(
        peopleSection().getByText("Nenhuma pessoa ainda."),
      ).toBeInTheDocument();
      expect(peopleSection().queryByRole("list")).not.toBeInTheDocument();
    });

    it("lê a página de ?pagina=, cai na 1 se for inválida e usa o primeiro valor repetido", async () => {
      await renderTeam({ pagina: "3" });
      expect(mocks.listPeople).toHaveBeenLastCalledWith({}, { page: 3 });

      await renderTeam({ pagina: "abc" });
      expect(mocks.listPeople).toHaveBeenLastCalledWith({}, { page: 1 });

      await renderTeam({ pagina: ["2", "3"] });
      expect(mocks.listPeople).toHaveBeenLastCalledWith({}, { page: 2 });
    });

    it("a paginação das pessoas usa ?pagina= e preserva ?convites=", async () => {
      mocks.listPeople.mockResolvedValue(
        page([person()], { page: 2, pageCount: 3, total: 120 }),
      );

      await renderTeam({ pagina: "2", convites: "4" });

      const nav = peopleSection().getByRole("navigation", {
        name: "Paginação",
      });
      expect(within(nav).getByText("Página 2 de 3")).toBeInTheDocument();
      expect(
        within(nav).getByRole("link", { name: "Anterior" }),
      ).toHaveAttribute("href", "/admin/equipe?convites=4");
      expect(
        within(nav).getByRole("link", { name: "Próxima" }),
      ).toHaveAttribute("href", "/admin/equipe?convites=4&pagina=3");
    });
  });

  it("operador: requireAdmin lança notFound e nada é lido", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error(NOT_FOUND));

    await expect(
      TeamAdmin({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow(NOT_FOUND);
    expect(mocks.listPeople).not.toHaveBeenCalled();
    expect(mocks.listPendingInvites).not.toHaveBeenCalled();
    expect(mocks.listActiveSectors).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 22: Run test to verify it fails**

Run: `bun run test -- src/components/admin/team/TeamAdmin.test.tsx`
Expected: FAIL (os testes de convites e o de "três seções" falham com `Unable to find an accessible element with the role "region" and name "Convites pendentes"` e `Unable to find an accessible element with the role "button" and name "Gerar convite"`)

- [ ] **Step 23: Write minimal implementation (`TeamAdmin.tsx` completo)**

Substitua **todo** o conteúdo de `src/components/admin/team/TeamAdmin.tsx` por:

```tsx
import { AdminListRow } from "@/components/admin/AdminListRow";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import { Pagination } from "@/components/admin/Pagination";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { parsePage } from "@/features/admin/pagination";
import { listPeople, type PersonRow } from "@/features/admin/people";
import { listActiveSectors } from "@/features/admin/sectors";
import {
  listPendingInvites,
  type PendingInviteRow,
} from "@/features/admin/teamInvites";
import { requireAdmin } from "@/lib/auth/session";
import { formatDateTimeBR } from "@/lib/dateTime";
import { InviteForm } from "./InviteForm";
import { PendingInviteActions } from "./PendingInviteActions";
import { PersonRowActions } from "./PersonRowActions";
import { ROLE_LABELS } from "./roleOptions";

type SearchParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function sectorText(person: PersonRow): string | null {
  if (!person.sectorName) return null;
  return person.sectorActive === false
    ? `${person.sectorName} (inativo)`
    : person.sectorName;
}

function inviteRoleText(invite: PendingInviteRow): string {
  return invite.role === "admin" || !invite.sectorName
    ? ROLE_LABELS.admin
    : `${ROLE_LABELS.operator} · ${invite.sectorName}`;
}

export async function TeamAdmin({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const actor = await requireAdmin();
  const params = await searchParams;
  // Depois do portão: a hora só é lida em render dinâmico.
  const now = new Date();
  const [people, invites, sectors] = await Promise.all([
    listPeople(db, { page: parsePage(params.pagina) }),
    listPendingInvites(db, { page: parsePage(params.convites) }, now),
    listActiveSectors(db),
  ]);
  const pageParams = {
    pagina: single(params.pagina),
    convites: single(params.convites),
  };

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="Equipe"
        description="Pessoas, papéis e convites."
        backHref="/admin"
      />

      <InviteForm sectors={sectors} />

      <section
        className="flex flex-col gap-3"
        aria-labelledby="pending-invites-title"
      >
        <h2 id="pending-invites-title" className="text-base font-medium">
          Convites pendentes
        </h2>
        {invites.rows.length === 0 ? (
          <EmptyState title="Nenhum convite pendente." />
        ) : (
          <ul className="flex flex-col gap-2">
            {invites.rows.map((invite) => (
              <AdminListRow
                key={invite.id}
                title={invite.inviteeLabel ?? "Sem nome de referência"}
                badges={
                  <Badge variant="outline">{inviteRoleText(invite)}</Badge>
                }
                subtitle={
                  <div className="flex flex-col">
                    <span>Válido até {formatDateTimeBR(invite.expiresAt)}</span>
                    <span>
                      {invite.inviterName
                        ? `Convidado por ${invite.inviterName}`
                        : "Convidado pelo sistema"}
                    </span>
                  </div>
                }
                actions={
                  <PendingInviteActions
                    id={invite.id}
                    label={invite.inviteeLabel ?? "sem nome"}
                  />
                }
              />
            ))}
          </ul>
        )}
        <Pagination
          page={invites.page}
          pageCount={invites.pageCount}
          pathname="/admin/equipe"
          params={pageParams}
          param="convites"
        />
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="people-title">
        <h2 id="people-title" className="text-base font-medium">
          Pessoas
        </h2>
        {people.rows.length === 0 ? (
          <EmptyState title="Nenhuma pessoa ainda." />
        ) : (
          <ul className="flex flex-col gap-2">
            {people.rows.map((person) => {
              const isSelf = person.id === actor.userId;
              const sector = sectorText(person);
              return (
                <AdminListRow
                  key={person.id}
                  title={person.name}
                  inactive={!person.active}
                  subtitle={
                    <div className="flex flex-col">
                      <span>{person.email}</span>
                      {sector && <span>{sector}</span>}
                    </div>
                  }
                  badges={
                    <>
                      <Badge variant="outline">
                        {ROLE_LABELS[person.role]}
                      </Badge>
                      {isSelf && <Badge>Você</Badge>}
                    </>
                  }
                  notes={
                    isSelf ? (
                      <p className="text-sm text-muted-foreground">
                        Peça a outro administrador para mudar a sua conta.
                      </p>
                    ) : undefined
                  }
                  actions={
                    isSelf ? undefined : (
                      <PersonRowActions person={person} sectors={sectors} />
                    )
                  }
                />
              );
            })}
          </ul>
        )}
        <Pagination
          page={people.page}
          pageCount={people.pageCount}
          pathname="/admin/equipe"
          params={pageParams}
        />
      </section>
    </div>
  );
}
```

Notas: a hora (`new Date()`) é lida **depois** de `requireAdmin()` (que lê cookies e já torna o render dinâmico), nunca em função `"use cache"`. As duas paginações compartilham `pageParams` e cada uma troca só o seu parâmetro (`pagina` ou `convites`), preservando o outro.

- [ ] **Step 24: Run test to verify it passes**

Run: `bun run test -- src/components/admin/team/TeamAdmin.test.tsx`
Expected: PASS (15 testes)

- [ ] **Step 25: Atualizar `.context/ui-registry.md`**

(a) Troque a entrada `TeamAdmin` escrita na Tarefa 9 (Edit):

`old_string`:
```text
- **Propósito:** conteúdo de `/admin/equipe`: as pessoas do sistema com papel, setor e situação.
- **Como funciona:** Server Component async; chama `requireAdmin()` e lê `listPeople` (`?pagina=`) e `listActiveSectors`. A própria conta mostra o selo "Você" e o texto de ajuda, **sem botões**; pessoa inativa fica esmaecida (`InactiveBadge`) com "Reativar"; setor inativo aparece como "(inativo)"; estado vazio e `Pagination`.
- **Usa:** `AdminPageHeader`, `AdminListRow`, `EmptyState`, `Pagination`, `Badge`, `PersonRowActions`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 9).

### PersonForm
```

`new_string`:
```text
- **Propósito:** conteúdo de `/admin/equipe`: convidar, acompanhar convites pendentes e gerir as pessoas do sistema.
- **Como funciona:** Server Component async; chama `requireAdmin()` e lê `listPeople` (`?pagina=`), `listPendingInvites` (`?convites=`) e `listActiveSectors`. Ordem na tela: `InviteForm`, "Convites pendentes" (só válidos, com `PendingInviteActions`) e "Pessoas". A própria conta mostra o selo "Você" e o texto de ajuda, **sem botões**; pessoa inativa fica esmaecida (`InactiveBadge`) com "Reativar"; setor inativo aparece como "(inativo)"; duas `Pagination` independentes (cada uma preserva o parâmetro da outra); estados vazios.
- **Usa:** `AdminPageHeader`, `AdminListRow`, `EmptyState`, `Pagination`, `Badge`, `InviteForm`, `PendingInviteActions`, `PersonRowActions`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 9, só Pessoas); Tarefa 10 acrescenta convites.

### PersonForm
```

(b) Acrescente três entradas, imediatamente antes da linha `## 3. Componentes de domínio — \`src/features/<domínio>/components\`` (Edit nessa linha, mantendo-a no fim do `new_string`):

`old_string`:
```text
## 3. Componentes de domínio — `src/features/<domínio>/components`
```

`new_string`:
```text
### InviteForm
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/team/InviteForm.tsx`
- **Propósito:** gerar convite de entrada (operador ou administrador) em `/admin/equipe`.
- **Como funciona:** `"use client"`; cartão "Convidar pessoa"; formulário controlado e nunca em branco (papel Operador, setor = primeiro ativo, nome de referência opcional); `ChoiceGroup` "Papel", `SelectField` "Setor" só para Operador; valida com `createInviteSchema`; erro de campo no campo, o resto no pé; sem setor ativo e papel Operador mostra o aviso e o link "Ir para Setores" no lugar do botão; no sucesso troca o formulário por `InviteLinkCard`; "Gerar outro convite" limpa só o nome (mantém papel e setor).
- **Usa:** `Card`, `Field*`, `Input`, `ChoiceGroup`, `SelectField`, `InviteLinkCard`, `useAdminAction`, `buttonVariants`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 10).

### InviteLinkCard
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/team/InviteLinkCard.tsx`
- **Propósito:** mostrar o link do convite **uma vez** (só o hash fica no banco) para copiar ou compartilhar.
- **Como funciona:** `"use client"`; campo somente leitura "Link do convite" (seleciona ao focar); "Copiar link" usa `navigator.clipboard` e avisa por toast (falha ou contexto sem clipboard = toast com instrução de copiar à mão); "Compartilhar" só aparece se `navigator.share` existir (detectado depois de montar, sem divergir do HTML do servidor), `AbortError` é silencioso e qualquer outra falha cai em copiar; mostra a validade em horário de Brasília e o aviso de que o link não volta; "Gerar outro convite" chama `onReset`.
- **Usa:** `Button`, `Input`, `sonner`, `formatDateTimeBR`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 10).

### PendingInviteActions
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/team/PendingInviteActions.tsx`
- **Propósito:** cancelar um convite pendente na lista da Equipe.
- **Como funciona:** `"use client"`; botão "Cancelar convite" (`aria-label` `Cancelar convite {nome ou "sem nome"}`) abre `ConfirmDialog` ("O link deixa de funcionar. Não dá para desfazer."); sucesso = toast "Convite cancelado." e diálogo fechado; recusa (convite que já não está pendente) aparece no diálogo, que fica aberto.
- **Usa:** `ConfirmDialog`, `useAdminAction`, `Button`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 10).

## 3. Componentes de domínio — `src/features/<domínio>/components`
```

- [ ] **Step 26: Rodar a verificação completa**

Run: `bun run check-types && bun run lint && bun run test`
Expected: tipos sem erro, Biome sem achados e toda a suíte verde (inclui o guarda `actionsAuth.test.ts` da Tarefa 3, que agora confere as quatro funções de `equipe/actions.ts`, e o `appPagesAuth.test.ts`). Se aparecer `Timeout waiting for worker to respond` ou teste de 5 s estourado em máquina carregada, rode o arquivo isolado antes de investigar.

- [ ] **Step 27: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-10.txt` (texto exato abaixo) e rode:
```bash
git add src/features/invites/inviteQueries.ts src/features/invites/inviteQueries.test.ts src/features/admin/teamInvites.ts src/features/admin/teamInvites.test.ts "src/app/(app)/admin/equipe/actions.ts" "src/app/(app)/admin/equipe/actions.test.ts" "src/app/(app)/admin/equipe/inviteActions.test.ts" src/components/admin/team/InviteLinkCard.tsx src/components/admin/team/InviteLinkCard.test.tsx src/components/admin/team/InviteForm.tsx src/components/admin/team/InviteForm.test.tsx src/components/admin/team/PendingInviteActions.tsx src/components/admin/team/PendingInviteActions.test.tsx src/components/admin/team/TeamAdmin.tsx src/components/admin/team/TeamAdmin.test.tsx .context/ui-registry.md
git commit -F .git/sdd/msg-task-10.txt
```
Mensagem:
```text
feat(equipe): convites com link para copiar ou compartilhar

O admin gera convite de operador ou administrador em /admin/equipe e recebe o
link uma única vez (copiar, compartilhar com fallback). Lista de convites
pendentes paginada (?convites=) e cancelamento por UPDATE condicional
(cancelInvite). O token do link é aceito por findInviteByToken.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 11: Visão geral `/admin` e guarda de páginas e de actions

**Files:**
- Create: `src/features/admin/overview.ts`
- Create: `src/features/admin/overview.test.ts`
- Modify: `src/components/app-shell/AdminOverview.tsx` (troca o texto provisório pelos cinco cartões)
- Modify: `src/components/app-shell/AdminOverview.test.tsx` (reescrito)
- Modify: `src/app/(app)/admin/page.tsx` (fallback do `<Suspense>` vira esqueleto de título e cinco cartões)
- Create: `src/app/(app)/admin/page.test.tsx`
- Modify: `src/app/appPagesAuth.test.ts` (mínimo de páginas 4 → 9, teste das seis rotas de `/admin` e teste de que nenhuma página de `/admin` exporta `metadata`)
- Modify: `src/app/(app)/admin/actionsAuth.test.ts` (`MIN_ACTION_FILES` 0 → 5)
- Create: `src/app/(app)/admin/actionsInventory.test.ts` (mínimo final do guarda de actions: 5 arquivos, 18 funções)
- Modify: `.context/ui-registry.md` (entrada `AdminOverview`)
- Test: os `*.test.ts[x]` acima

**Interfaces:**
- Consumes (já existem quando esta tarefa roda):
  - Tarefa 1: tabelas `shift`, `item`, `destination` (`@/db/schema/catalog`); fixtures `insertSector(db, name?, { active? })`, `insertShift(db, { sectorId, name?, active? })`, `insertItem(db, { sectorId, name?, active? })`, `insertDestination(db, { name?, active? })` (`test/fixtures.ts`); `TABLES` com as três tabelas.
  - Tarefa 2: `pluralize(count: number, singular: string, plural: string): string` (`@/lib/plural`).
  - Tarefas 6–10: as cinco páginas `src/app/(app)/admin/{setores,turnos,itens,destinos,equipe}/page.tsx` e os cinco `actions.ts`.
  - Existentes: `requireAdmin(): Promise<Authz>` (`@/lib/auth/session`), `db` (`@/db`), `Card`, `CardHeader`, `CardTitle`, `CardDescription` (`@/components/ui/card`), `Skeleton`.
- Produces:
  - `export type AdminOverviewCounts = { sectors: number; shifts: number; items: number; destinations: number; people: number; pendingInvites: number }`
  - `export async function getAdminOverviewCounts(db: Db, now: Date): Promise<AdminOverviewCounts>` (só conta ativos e convites pendentes; usada só por `AdminOverview`).
  - `AdminOverview(): Promise<JSX.Element>` mantém o nome e o caminho (a página `/admin` continua importando de `@/components/app-shell/AdminOverview`).

- [ ] **Step 1: Write the failing test (contagens no banco)**

Crie `src/features/admin/overview.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createTestDb, resetDb, type TestDb } from "../../../test/db";
import {
  insertDestination,
  insertInvite,
  insertItem,
  insertSector,
  insertShift,
  insertUser,
} from "../../../test/fixtures";
import { getAdminOverviewCounts } from "./overview";

const NOW = new Date("2026-11-21T12:00:00.000Z");
const ONE_DAY = 24 * 60 * 60 * 1000;

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

describe("getAdminOverviewCounts", () => {
  it("banco vazio: tudo zero, sem erro e sem null", async () => {
    expect(await getAdminOverviewCounts(db, NOW)).toEqual({
      sectors: 0,
      shifts: 0,
      items: 0,
      destinations: 0,
      people: 0,
      pendingInvites: 0,
    });
  });

  it("conta só ativos: setor, turno, item, destino e pessoa inativos ficam de fora", async () => {
    const uld = await insertSector(db, "ULD");
    const closed = await insertSector(db, "Fechado", { active: false });
    await insertShift(db, { sectorId: uld.id });
    await insertShift(db, { sectorId: uld.id });
    await insertShift(db, { sectorId: uld.id, active: false });
    await insertShift(db, { sectorId: closed.id });
    await insertItem(db, { sectorId: uld.id });
    await insertItem(db, { sectorId: uld.id, active: false });
    await insertDestination(db);
    await insertDestination(db);
    await insertDestination(db, { active: false });
    await insertUser(db, { role: "admin", sectorId: null });
    await insertUser(db, { role: "operator", sectorId: uld.id });
    await insertUser(db, {
      role: "operator",
      sectorId: uld.id,
      deactivatedAt: NOW,
    });

    expect(await getAdminOverviewCounts(db, NOW)).toEqual({
      sectors: 1,
      shifts: 3,
      items: 1,
      destinations: 2,
      people: 2,
      pendingInvites: 0,
    });
  });

  it("convite pendente é só o válido: usado, cancelado e expirado não contam", async () => {
    const sector = await insertSector(db);
    const base = { role: "operator", sectorId: sector.id, now: NOW } as const;
    await insertInvite(db, base);
    await insertInvite(db, base);
    await insertInvite(db, { ...base, usedAt: NOW });
    await insertInvite(db, { ...base, cancelledAt: NOW });
    await insertInvite(db, { ...base, expiresAt: new Date(NOW.getTime() - 1) });
    // Expira exatamente agora: já conta como expirado (expires_at > now).
    await insertInvite(db, { ...base, expiresAt: NOW });
    await insertInvite(db, {
      ...base,
      expiresAt: new Date(NOW.getTime() + ONE_DAY),
    });

    const counts = await getAdminOverviewCounts(db, NOW);

    expect(counts.pendingInvites).toBe(3);
  });

  it("a hora decide: o mesmo convite deixa de contar depois de expirar", async () => {
    const sector = await insertSector(db);
    await insertInvite(db, {
      role: "operator",
      sectorId: sector.id,
      expiresAt: new Date(NOW.getTime() + ONE_DAY),
      now: NOW,
    });

    const before = await getAdminOverviewCounts(db, NOW);
    const after = await getAdminOverviewCounts(
      db,
      new Date(NOW.getTime() + ONE_DAY),
    );

    expect([before.pendingInvites, after.pendingInvites]).toEqual([1, 0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- src/features/admin/overview.test.ts`
Expected: FAIL com `Cannot find module './overview' imported from …/src/features/admin/overview.test.ts` (o módulo ainda não existe).

- [ ] **Step 3: Write minimal implementation**

Crie `src/features/admin/overview.ts`. O Drizzle 0.45 só executa `db.select({ … })` com `.from(…)` (sem ele o builder não é "thenable" e o `await` devolve o próprio builder), por isso o FROM é uma tabela de uma linha; e `db.$count()` dentro do `select` também não serve (devolve o objeto). As contagens são subconsultas `count(*)` escritas com `sql` e convertidas com `mapWith(Number)` (`count(*)` volta como `bigint`, texto no driver).

```ts
import "server-only";

import { type SQL, sql } from "drizzle-orm";

import { user } from "@/db/schema/auth";
import { destination, item, shift } from "@/db/schema/catalog";
import { invite } from "@/db/schema/invites";
import { sector } from "@/db/schema/sectors";
import type { Db } from "@/db/types";

export type AdminOverviewCounts = {
  sectors: number;
  shifts: number;
  items: number;
  destinations: number;
  people: number;
  pendingInvites: number;
};

// count(*) volta como bigint (texto no driver): mapWith(Number) converte.
function countWhere(from: SQL, where: SQL): SQL<number> {
  return sql<number>`(select count(*) from ${from} where ${where})`.mapWith(
    Number,
  );
}

// Um único SELECT: cada contagem é uma subconsulta count(*) no SQL (a visão
// geral nunca soma linhas em JS). O FROM é uma tabela de uma linha
// (`values (1)`) porque o Drizzle 0.45 só executa select com FROM. "Ativo" =
// active true; pessoa ativa = sem deactivated_at; convite pendente = válido
// agora (mesma regra de expiração do consumeInvite: expires_at > now).
export async function getAdminOverviewCounts(
  db: Db,
  now: Date,
): Promise<AdminOverviewCounts> {
  const [row] = await db
    .select({
      sectors: countWhere(sql`${sector}`, sql`${sector.active}`),
      shifts: countWhere(sql`${shift}`, sql`${shift.active}`),
      items: countWhere(sql`${item}`, sql`${item.active}`),
      destinations: countWhere(sql`${destination}`, sql`${destination.active}`),
      people: countWhere(sql`${user}`, sql`${user.deactivatedAt} is null`),
      pendingInvites: countWhere(
        sql`${invite}`,
        sql`${invite.usedAt} is null and ${invite.cancelledAt} is null and ${invite.expiresAt} > ${now.toISOString()}::timestamptz`,
      ),
    })
    .from(sql`(values (1)) as one(n)`);
  if (!row) throw new Error("Contagens da visão geral não retornaram.");
  return row;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- src/features/admin/overview.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Write the failing test (cartões da visão geral)**

Substitua todo o conteúdo de `src/components/app-shell/AdminOverview.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AdminOverview } from "@/components/app-shell/AdminOverview";
import type { AdminOverviewCounts } from "@/features/admin/overview";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getAdminOverviewCounts: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/db", () => ({ db: { marca: "db" } }));
vi.mock("@/features/admin/overview", () => ({
  getAdminOverviewCounts: mocks.getAdminOverviewCounts,
}));

function counts(
  overrides: Partial<AdminOverviewCounts> = {},
): AdminOverviewCounts {
  return {
    sectors: 3,
    shifts: 7,
    items: 12,
    destinations: 4,
    people: 9,
    pendingInvites: 2,
    ...overrides,
  };
}

async function renderOverview(overrides: Partial<AdminOverviewCounts> = {}) {
  mocks.requireAdmin.mockResolvedValue({ role: "admin" });
  mocks.getAdminOverviewCounts.mockResolvedValue(counts(overrides));
  render(await AdminOverview());
}

describe("AdminOverview", () => {
  beforeEach(() => {
    mocks.requireAdmin.mockReset();
    mocks.getAdminOverviewCounts.mockReset();
  });

  it("admin vê o título, o texto e um cartão link para cada cadastro", async () => {
    await renderOverview();

    expect(
      screen.getByRole("heading", { level: 1, name: "Administração" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Cadastros que a passagem de turno usa."),
    ).toBeInTheDocument();

    const expected = [
      ["Setores", "/admin/setores", "Onde cada pessoa trabalha.", "3 ativos"],
      ["Turnos", "/admin/turnos", "Horários de cada setor.", "7 ativos"],
      ["Itens", "/admin/itens", "O que se conta na passagem.", "12 ativos"],
      ["Destinos", "/admin/destinos", "Para onde os pedidos vão.", "4 ativos"],
      [
        "Equipe",
        "/admin/equipe",
        "Pessoas, papéis e convites.",
        "9 pessoas ativas · 2 convites pendentes",
      ],
    ] as const;
    for (const [title, href, description, count] of expected) {
      const link = screen.getByRole("link", { name: new RegExp(`^${title}`) });
      expect(link).toHaveAttribute("href", href);
      expect(within(link).getByText(description)).toBeInTheDocument();
      expect(within(link).getByText(count)).toBeInTheDocument();
    }
    expect(screen.getAllByRole("link")).toHaveLength(5);
  });

  it("consulta as contagens com o banco e a hora atual", async () => {
    await renderOverview();

    expect(mocks.getAdminOverviewCounts).toHaveBeenCalledTimes(1);
    const [db, now] = mocks.getAdminOverviewCounts.mock.calls[0] ?? [];
    expect(db).toEqual({ marca: "db" });
    expect(now).toBeInstanceOf(Date);
  });

  it("zero: tudo no plural, nunca vazio", async () => {
    await renderOverview({
      sectors: 0,
      shifts: 0,
      items: 0,
      destinations: 0,
      people: 0,
      pendingInvites: 0,
    });

    expect(screen.getAllByText("0 ativos")).toHaveLength(4);
    expect(
      screen.getByText("0 pessoas ativas · 0 convites pendentes"),
    ).toBeInTheDocument();
  });

  it("um: singular em cada cartão", async () => {
    await renderOverview({
      sectors: 1,
      shifts: 1,
      items: 1,
      destinations: 1,
      people: 1,
      pendingInvites: 1,
    });

    expect(screen.getAllByText("1 ativo")).toHaveLength(4);
    expect(
      screen.getByText("1 pessoa ativa · 1 convite pendente"),
    ).toBeInTheDocument();
  });

  it("mistura singular e plural na Equipe", async () => {
    await renderOverview({ people: 1, pendingInvites: 5 });

    expect(
      screen.getByText("1 pessoa ativa · 5 convites pendentes"),
    ).toBeInTheDocument();
  });

  it("operador: requireAdmin lança (notFound), nada é renderizado e o banco não é lido", async () => {
    mocks.requireAdmin.mockRejectedValue(
      new Error("NEXT_HTTP_ERROR_FALLBACK;404"),
    );

    await expect(AdminOverview()).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404",
    );
    expect(mocks.getAdminOverviewCounts).not.toHaveBeenCalled();
  });

  it("falha ao ler as contagens propaga o erro (vai para o error boundary)", async () => {
    mocks.requireAdmin.mockResolvedValue({ role: "admin" });
    mocks.getAdminOverviewCounts.mockRejectedValue(new Error("banco fora"));

    await expect(AdminOverview()).rejects.toThrow("banco fora");
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `bun run test -- src/components/app-shell/AdminOverview.test.tsx`
Expected: FAIL com `Unable to find an element with the text: Cadastros que a passagem de turno usa.` (o componente ainda mostra o texto provisório) e `expected "vi.fn()" to be called 1 times, but got 0 times`.

- [ ] **Step 7: Write minimal implementation**

Substitua todo o conteúdo de `src/components/app-shell/AdminOverview.tsx`. O componente continua chamando `requireAdmin()` (guarda `appPagesAuth.test.ts`) e só depois lê o banco; `new Date()` fica depois do `await` de sessão, já dentro do `<Suspense>` da página (Cache Components).

```tsx
import Link from "next/link";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db } from "@/db";
import { getAdminOverviewCounts } from "@/features/admin/overview";
import { requireAdmin } from "@/lib/auth/session";
import { pluralize } from "@/lib/plural";

type OverviewCard = {
  href: string;
  title: string;
  description: string;
  count: string;
};

export async function AdminOverview() {
  await requireAdmin();
  const counts = await getAdminOverviewCounts(db, new Date());

  const active = (n: number) => pluralize(n, "ativo", "ativos");
  const cards: OverviewCard[] = [
    {
      href: "/admin/setores",
      title: "Setores",
      description: "Onde cada pessoa trabalha.",
      count: active(counts.sectors),
    },
    {
      href: "/admin/turnos",
      title: "Turnos",
      description: "Horários de cada setor.",
      count: active(counts.shifts),
    },
    {
      href: "/admin/itens",
      title: "Itens",
      description: "O que se conta na passagem.",
      count: active(counts.items),
    },
    {
      href: "/admin/destinos",
      title: "Destinos",
      description: "Para onde os pedidos vão.",
      count: active(counts.destinations),
    },
    {
      href: "/admin/equipe",
      title: "Equipe",
      description: "Pessoas, papéis e convites.",
      count: `${pluralize(counts.people, "pessoa ativa", "pessoas ativas")} · ${pluralize(counts.pendingInvites, "convite pendente", "convites pendentes")}`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Administração</h1>
        <p className="text-muted-foreground">
          Cadastros que a passagem de turno usa.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <li key={card.href}>
            <Link
              href={card.href}
              className="group block h-full rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors group-hover:bg-muted/50">
                <CardHeader>
                  <CardTitle>{card.title}</CardTitle>
                  <CardDescription>{card.description}</CardDescription>
                  <p className="pt-2 text-sm font-medium tabular-nums">
                    {card.count}
                  </p>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `bun run test -- src/components/app-shell/AdminOverview.test.tsx`
Expected: PASS (7 testes).

- [ ] **Step 9: Write the failing test (esqueleto da página)**

Crie `src/app/(app)/admin/page.test.tsx`. O conteúdo real é assíncrono (sessão e banco); o mock lança uma promessa que nunca resolve, então o `<Suspense>` mantém o fallback na tela.

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminPage, * as pageModule from "./page";

// O conteúdo real é async (sessão e banco); aqui ele nunca resolve, então o
// Suspense mantém o fallback na tela.
vi.mock("@/components/app-shell/AdminOverview", () => ({
  AdminOverview: () => {
    throw new Promise(() => {});
  },
}));

describe("/admin (página)", () => {
  it("enquanto carrega, mostra o esqueleto dos 5 cartões e nenhum título", () => {
    const { container } = render(<AdminPage />);

    expect(container.querySelectorAll('[data-slot="skeleton"]')).toHaveLength(
      7,
    );
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("não exporta metadata (o <title> revelaria a página ao operador)", () => {
    expect(Object.keys(pageModule)).toEqual(["default"]);
  });
});
```

- [ ] **Step 10: Run test to verify it fails**

Run: `bun run test -- "src/app/(app)/admin/page.test.tsx"`
Expected: FAIL com `expected 2 to have a length of 7` (o esqueleto atual tem 2 blocos; o segundo teste já passa).

- [ ] **Step 11: Write minimal implementation**

Substitua todo o conteúdo de `src/app/(app)/admin/page.tsx` (continua sem `metadata` e com o `<h1>` dentro do `<Suspense>`, via `AdminOverview`):

```tsx
import { Suspense } from "react";

import { AdminOverview } from "@/components/app-shell/AdminOverview";
import { Skeleton } from "@/components/ui/skeleton";

// Sem `metadata` de propósito: o <title> sai antes do portão e diria
// "Administração | Closery" ao operador (T12). O título visível fica dentro do
// Suspense: quem não é admin vê "Página não encontrada" sem ver "Administração"
// piscar antes (spec §4.1: não revelar o que existe).
export default function AdminPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminOverview />
    </Suspense>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {["setores", "turnos", "itens", "destinos", "equipe"].map((card) => (
          <Skeleton key={card} className="h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 12: Run test to verify it passes**

Run: `bun run test -- "src/app/(app)/admin/page.test.tsx"`
Expected: PASS (2 testes).

- [ ] **Step 13: Raise the page guard to 9 pages and pin the six `/admin` routes**

Em `src/app/appPagesAuth.test.ts`, troque o primeiro teste do `describe("toda página do grupo (app) chama requireUser ou requireAdmin", …)`:

Antes:
```ts
  it("encontra as páginas do grupo", () => {
    expect(pages.length).toBeGreaterThanOrEqual(4);
  });
```

Depois:
```ts
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
    const adminPages = pages.filter((file) =>
      relative(APP_GROUP, file).replaceAll("\\", "/").startsWith("admin/"),
    );
    for (const file of adminPages) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(
        /export\s+(const\s+metadata|(async\s+)?function\s+generateMetadata)\b/,
      );
    }
  });
```

Run: `bun run test -- src/app/appPagesAuth.test.ts`
Expected: PASS (17 testes: as 9 páginas por nome, "encontra as páginas", "inclui a página de cada rota", "nenhuma página de /admin exporta metadata" e os 5 casos de `pageCallsAuthGuard`). Este teste é um trinco: ele só passa porque as Tarefas 6–10 já criaram as páginas; se uma faltar, falha com `expected [ … ] to include 'admin/<rota>/page.tsx'` (ou `expected 8 to be greater than or equal to 9`), e se uma página perder o `requireAdmin` o caso `%s` dela falha.

- [ ] **Step 14: Pin the final minimum of the actions guard (5 files, 18 functions)**

O guarda `actionsAuth.test.ts` (Tarefa 3) exige "≥ 5 arquivos", mas na Tarefa 3 ainda não existia nenhum `actions.ts`, então ele nasceu com `const MIN_ACTION_FILES = 0;`. Agora que os cinco existem, em `src/app/(app)/admin/actionsAuth.test.ts`, com a ferramenta Edit, troque `const MIN_ACTION_FILES = 0;` por `const MIN_ACTION_FILES = 5;`. Confira:

```bash
grep -n "MIN_ACTION_FILES = " "src/app/(app)/admin/actionsAuth.test.ts"
```
Expected: `14:const MIN_ACTION_FILES = 5;` (o número da linha pode variar em uma ou duas linhas; o valor é 5).

Agora crie `src/app/(app)/admin/actionsInventory.test.ts`, que fixa o inventário completo (o contrato lista 18 funções em 5 arquivos; action nova ou sumida muda esta lista de propósito):

```ts
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// Inventário das Server Actions de /admin: o contrato da Fase 2 lista 18
// funções em 5 arquivos. Action nova ou sumida muda esta lista de propósito,
// para quem revisa ver (o guarda actionsAuth.test.ts confere o requireAdmin).

const ADMIN_DIR = join(process.cwd(), "src", "app", "(app)", "admin");

const EXPECTED: Record<string, string[]> = {
  "destinos/actions.ts": [
    "createDestinationAction",
    "renameDestinationAction",
    "setDestinationActiveAction",
  ],
  "equipe/actions.ts": [
    "cancelInviteAction",
    "createInviteAction",
    "setPersonActiveAction",
    "updatePersonAction",
  ],
  "itens/actions.ts": [
    "createItemAction",
    "moveItemAction",
    "setItemActiveAction",
    "updateItemAction",
  ],
  "setores/actions.ts": [
    "createSectorAction",
    "renameSectorAction",
    "setSectorActiveAction",
  ],
  "turnos/actions.ts": [
    "createShiftAction",
    "moveShiftAction",
    "setShiftActiveAction",
    "updateShiftAction",
  ],
};

function findActionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return findActionFiles(full);
    return name === "actions.ts" ? [full] : [];
  });
}

function exportedFunctions(source: string): string[] {
  return [...source.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)]
    .map((match) => match[1] ?? "")
    .sort();
}

describe("Server Actions de /admin", () => {
  const files = findActionFiles(ADMIN_DIR).map((file) =>
    relative(ADMIN_DIR, file).replaceAll("\\", "/"),
  );

  it("há exatamente 5 arquivos actions.ts, um por cadastro", () => {
    expect([...files].sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(
    Object.entries(EXPECTED),
  )("%s exporta só as actions do contrato", (file, names) => {
    const source = readFileSync(join(ADMIN_DIR, file), "utf8");

    expect(source.trimStart().startsWith('"use server"')).toBe(true);
    expect(exportedFunctions(source)).toEqual(names);
    // Toda export é função async: arquivo "use server" não exporta mais nada.
    expect(source).not.toMatch(
      /^export\s+(?:const|let|type|interface|class)\b/m,
    );
  });
});
```

Run: `bun run test -- "src/app/(app)/admin/actionsInventory.test.ts" "src/app/(app)/admin/actionsAuth.test.ts"`
Expected: PASS (`actionsInventory`: 6 testes — 1 de arquivos e 5 de exports; o `actionsAuth` continua verde com o mínimo 5).

- [ ] **Step 15: Register the change in `ui-registry.md`**

Em `.context/ui-registry.md`, troque a entrada `AdminOverview` inteira (use a ferramenta Edit; o texto antigo é único no arquivo).

Antes:
```markdown
### AdminOverview
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/AdminOverview.tsx`
- **Propósito:** conteúdo provisório de `/admin` e portão de acesso.
- **Como funciona:** Server Component assíncrono; `requireAdmin()` (operador cai em `notFound()`).
  O título fica dentro do `<Suspense>` para o operador não ver "Administração" antes do 404, e a
  página não exporta `metadata` (o `<title>` revelaria a rota; T12).
- **Usa:** `requireAdmin`.
- **Histórico:** 2026-11-20 — criado na Fase 1.
```

Depois:
```markdown
### AdminOverview
- **Status:** ✏️ estendido (2026-11-21)
- **Local:** `src/components/app-shell/AdminOverview.tsx`
- **Propósito:** visão geral de `/admin` (cartões dos cadastros) e portão de acesso.
- **Como funciona:** Server Component assíncrono; `requireAdmin()` (operador cai em `notFound()`),
  depois `getAdminOverviewCounts(db, new Date())` (um SELECT com subconsultas). Mostra o título
  "Administração", o texto "Cadastros que a passagem de turno usa." e cinco cartões-link (Setores,
  Turnos, Itens, Destinos, Equipe) com título, descrição e contagem (`{n} ativos`; Equipe:
  `{n} pessoas ativas · {m} convites pendentes`), singular e plural por `pluralize`. Grade de uma
  coluna no celular, duas em `sm` e três em `lg`; o cartão inteiro é o link (foco visível, hover
  `bg-muted/50`). O título fica dentro do `<Suspense>` para o operador não ver "Administração"
  antes do 404, e a página não exporta `metadata` (o `<title>` revelaria a rota; T12); enquanto
  carrega, `page.tsx` mostra um esqueleto (título e cinco cartões).
- **Usa:** `requireAdmin`, `getAdminOverviewCounts`, `pluralize`, `Card*`, `next/link`.
- **Histórico:** 2026-11-20 — criado na Fase 1 (placeholder). 2026-11-21 — Fase 2: cartões dos cinco cadastros e contagens.
```

- [ ] **Step 16: Run the gate**

Run: `bunx biome check --write src test && bun run check-types && bun run lint && bun run test`
Expected: `check-types` termina com `✓ Types generated successfully` e sem erro do `tsc`; `lint` com `Checked N files … No fixes applied.`; `test` com todos os arquivos passando e nenhum teste falhando.

- [ ] **Step 17: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-11.txt` (texto exato abaixo) e rode:
```bash
git add src/features/admin/overview.ts src/features/admin/overview.test.ts src/components/app-shell/AdminOverview.tsx src/components/app-shell/AdminOverview.test.tsx "src/app/(app)/admin/page.tsx" "src/app/(app)/admin/page.test.tsx" src/app/appPagesAuth.test.ts "src/app/(app)/admin/actionsInventory.test.ts" "src/app/(app)/admin/actionsAuth.test.ts" .context/ui-registry.md
git commit -F .git/sdd/msg-task-11.txt
```

Mensagem:
```text
feat(admin): visão geral com os cinco cartões e guardas de páginas e actions

getAdminOverviewCounts conta ativos e convites pendentes num único SELECT
com subconsultas. AdminOverview mostra os cartões de Setores, Turnos,
Itens, Destinos e Equipe com singular e plural; a página ganha esqueleto.
appPagesAuth passa a exigir 9 páginas e as seis rotas de /admin;
actionsInventory fixa as 18 actions dos 5 arquivos.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 12: E2E dos cadastros e da equipe

**Files:**
- Modify: `e2e/db.ts` (importa `count` e `session`; reexporta `insertUser`; novo `countSessionsByEmail` no fim)
- Create: `e2e/cadastros.spec.ts`
- Create: `test/e2eDb.test.ts` (teste do helper `countSessionsByEmail` com PGlite)
- Test: `test/e2eDb.test.ts`, `e2e/cadastros.spec.ts`

**Interfaces:**
- Consumes:
  - Fase 1: `openE2eDb()`, `insertInvite`, `insertSector`, `buildInviteUrl`, `E2E_BASE_URL` (`e2e/db.ts`); playwright.config.ts (app em `http://localhost:3200`, banco PGlite via socket em `54329`); o padrão `clientIp`/`x-forwarded-for` de `e2e/auth.spec.ts`.
  - Tarefa 1: `insertUser(db, { role, sectorId, name?, email?, deactivatedAt? })` e `insertSession(db, { userId, expiresAt? })` (`test/fixtures.ts`).
  - Tarefas 6–11: as telas de `/admin` com os textos exatos da seção "Textos de interface" do esqueleto (campos `Nome do setor`, `Nome do turno`, `Início`, `Fim`, `Nome do item`, `Unidade`, `Nome do destino`, `Nome de referência (opcional)`, `Setor`, `Link do convite`; botões `Criar setor`, `Criar turno`, `Criar item`, `Criar destino`, `Gerar convite`, `Copiar link`, `Desativar {nome}`, `Reativar {nome}`; toasts `Setor criado.`, `Turno criado.`, `Item criado.`, `Destino criado.`, `Pessoa desativada.`, `Pessoa reativada.`; `<nav aria-label="Setor">` com links; cada linha de lista é um `<li>` dentro de `<main>`).
- Produces:
  - `export async function countSessionsByEmail(db: Db, email: string): Promise<number>` (`e2e/db.ts`; e-mail comparado como foi gravado).
  - `export { insertInvite, insertSector, insertUser } from "../test/fixtures"` em `e2e/db.ts` (`insertUser` é novo).

- [ ] **Step 1: Write the failing test (helper `countSessionsByEmail`)**

O helper faz parte da infraestrutura do E2E, mas é código com SQL: ele ganha teste de unidade no projeto `node`, com PGlite real. Crie `test/e2eDb.test.ts`:

```ts
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { countSessionsByEmail } from "../e2e/db";
import { createTestDb, resetDb, type TestDb } from "./db";
import { insertSession, insertUser } from "./fixtures";

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

describe("countSessionsByEmail (helper do E2E)", () => {
  it("conta só as sessões da pessoa com aquele e-mail", async () => {
    const ana = await insertUser(db, {
      role: "admin",
      sectorId: null,
      email: "ana@example.test",
    });
    const davi = await insertUser(db, {
      role: "admin",
      sectorId: null,
      email: "davi@example.test",
    });
    await insertSession(db, { userId: ana.id });
    await insertSession(db, { userId: ana.id });
    await insertSession(db, { userId: davi.id });

    expect(await countSessionsByEmail(db, "ana@example.test")).toBe(2);
    expect(await countSessionsByEmail(db, "davi@example.test")).toBe(1);
  });

  it("zero quando a pessoa não tem sessão", async () => {
    await insertUser(db, {
      role: "admin",
      sectorId: null,
      email: "sem-sessao@example.test",
    });

    expect(await countSessionsByEmail(db, "sem-sessao@example.test")).toBe(0);
  });

  it("zero quando o e-mail não existe (nunca lança)", async () => {
    expect(await countSessionsByEmail(db, "ninguem@example.test")).toBe(0);
  });

  it("a caixa do e-mail conta: o e-mail é comparado como foi gravado", async () => {
    const ana = await insertUser(db, {
      role: "admin",
      sectorId: null,
      email: "ana@example.test",
    });
    await insertSession(db, { userId: ana.id });

    expect(await countSessionsByEmail(db, "ANA@example.test")).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- test/e2eDb.test.ts`
Expected: FAIL com `TypeError: countSessionsByEmail is not a function` (4 testes falham; o helper ainda não existe).

- [ ] **Step 3: Write minimal implementation**

Em `e2e/db.ts`, faça três trocas e um acréscimo.

1. Troque a primeira linha de import:
```ts
import { count, eq } from "drizzle-orm";
```
2. Troque o import do schema:
```ts
import { session, user } from "@/db/schema";
```
3. Troque a reexportação das fixtures:
```ts
export { insertInvite, insertSector, insertUser } from "../test/fixtures";
```
4. Acrescente no fim do arquivo:
```ts

// Quantas sessões abertas a pessoa tem: desativar apaga todas (P11).
export async function countSessionsByEmail(
  db: Db,
  email: string,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(session)
    .innerJoin(user, eq(session.userId, user.id))
    .where(eq(user.email, email));
  return row?.total ?? 0;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- test/e2eDb.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 5: Write the E2E spec**

Crie `e2e/cadastros.spec.ts`. Cada teste cria os próprios dados (e-mail e nomes únicos, tudo fictício) e usa um IP próprio (`x-forwarded-for`), como em `auth.spec.ts`; nenhum faz mais de 2 cadastros por IP (limite do Better Auth: 10 por 60 s). A fixture `clientIp` e os auxiliares de cadastro são repetidos de `auth.spec.ts` de propósito: extraí-los seria um refactor, que não entra no mesmo commit de uma feature.

```ts
import { randomUUID } from "node:crypto";

import {
  type Browser,
  test as base,
  expect,
  type Page,
} from "@playwright/test";
import type { Pool } from "pg";

import type { Db } from "@/db/types";

import {
  buildInviteUrl,
  countSessionsByEmail,
  E2E_BASE_URL,
  insertInvite,
  insertSector,
  insertUser,
  openE2eDb,
} from "./db";

const PASSWORD = "senha-de-teste-123";

// Os dados de cada cenário (poucos registros por tela) cabem na página 1
// (PAGE_SIZE = 50): o E2E não percorre a paginação, que os testes de componente
// e de domínio já provam.

// Mesma estratégia do auth.spec.ts: o app roda em produção (`next start`) com
// rate limit; cada teste usa um IP próprio (x-forwarded-for, como chegaria atrás
// da Vercel). A base aleatória evita colidir com os IPs do auth.spec.ts.
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

function visitor(browser: Browser, clientIp: string) {
  return browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": clientIp },
  });
}

let pool: Pool;
let db: Db;

test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});

test.afterAll(async () => {
  await pool.end();
});

// Cada teste cria os próprios dados: e-mail e nomes únicos, todos fictícios.
function unique(): string {
  return randomUUID().slice(0, 8);
}

function uniqueEmail(): string {
  return `e2e-${randomUUID()}@example.com`;
}

async function signUpAtInviteUrl(
  page: Page,
  inviteUrl: string,
  person: { name: string; email: string },
) {
  await page.goto(inviteUrl);
  await expect(
    page.getByRole("heading", { name: "Você foi convidado" }),
  ).toBeVisible();
  await page.getByLabel("Nome").fill(person.name);
  await page.getByLabel("E-mail").fill(person.email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/bem-vindo$/);
  await expect(
    page.getByRole("heading", { name: "Conta criada" }),
  ).toBeVisible();
}

function signUpWithInviteToken(
  page: Page,
  token: string,
  person: { name: string; email: string },
) {
  return signUpAtInviteUrl(page, buildInviteUrl(E2E_BASE_URL, token), person);
}

async function registerAdmin(page: Page, name: string, email: string) {
  const { token } = await insertInvite(db, { role: "admin" });
  await signUpWithInviteToken(page, token, { name, email });
}

// Linha da lista (<li>) do conteúdo (<main>, fora da barra lateral) que contém
// o texto: o nome do setor, o e-mail da pessoa.
function rowWith(page: Page, text: string) {
  return page.getByRole("main").getByRole("listitem").filter({ hasText: text });
}

// O seletor de setor de Turnos e Itens é uma <nav aria-label="Setor">.
async function chooseSector(page: Page, sectorName: string) {
  await page
    .getByRole("navigation", { name: "Setor", exact: true })
    .getByRole("link", { name: sectorName })
    .click();
  await expect(page).toHaveURL(/setor=/);
}

test("(a) admin cria setor, turno, item e destino e os vê nas listas", async ({
  page,
}) => {
  await registerAdmin(page, "Ana Cadastros", uniqueEmail());
  const sectorName = `Setor ${unique()}`;
  const destinationName = `Almoxarifado ${unique()}`;

  // Setor.
  await page.goto("/admin/setores");
  await expect(page.getByRole("heading", { name: "Setores" })).toBeVisible();
  await page.getByLabel("Nome do setor").fill(sectorName);
  await page.getByRole("button", { name: "Criar setor" }).click();
  await expect(page.getByText("Setor criado.")).toBeVisible();
  await expect(rowWith(page, sectorName)).toContainText("0 pessoas ativas");
  // Formulário limpo depois de criar com sucesso.
  await expect(page.getByLabel("Nome do setor")).toHaveValue("");

  // Turno: o nome e os horários já vêm preenchidos (Turno 1, 06:00–14:00).
  await page.goto("/admin/turnos");
  await expect(page.getByRole("heading", { name: "Turnos" })).toBeVisible();
  await chooseSector(page, sectorName);
  await expect(page.getByText("Nenhum turno neste setor.")).toBeVisible();
  await expect(page.getByLabel("Nome do turno")).toHaveValue("Turno 1");
  await expect(page.getByLabel("Início", { exact: true })).toHaveValue("06:00");
  await expect(page.getByLabel("Fim", { exact: true })).toHaveValue("14:00");
  await page.getByLabel("Nome do turno").fill("Turno Manhã");
  await page.getByRole("button", { name: "Criar turno" }).click();
  await expect(page.getByText("Turno criado.")).toBeVisible();
  const shiftRow = rowWith(page, "Turno Manhã");
  await expect(shiftRow).toContainText("06:00–14:00");

  // Item: unidade padrão "Unidade", tipo padrão "Controle"; aqui escolhemos Rolo.
  await page.goto("/admin/itens");
  await expect(page.getByRole("heading", { name: "Itens" })).toBeVisible();
  await chooseSector(page, sectorName);
  await expect(page.getByText("Nenhum item neste setor.")).toBeVisible();
  await expect(page.getByLabel("Unidade", { exact: true })).toHaveValue(
    "unidade",
  );
  await page.getByLabel("Nome do item").fill("Rede de proteção");
  await page.getByLabel("Unidade", { exact: true }).selectOption("rolo");
  await page.getByRole("button", { name: "Criar item" }).click();
  await expect(page.getByText("Item criado.")).toBeVisible();
  const itemRow = rowWith(page, "Rede de proteção");
  await expect(itemRow).toContainText("Rolo");
  await expect(itemRow).toContainText("Controle");

  // Destino (global, não depende de setor).
  await page.goto("/admin/destinos");
  await expect(page.getByRole("heading", { name: "Destinos" })).toBeVisible();
  await page.getByLabel("Nome do destino").fill(destinationName);
  await page.getByRole("button", { name: "Criar destino" }).click();
  await expect(page.getByText("Destino criado.")).toBeVisible();
  await expect(rowWith(page, destinationName)).toBeVisible();

  // Tudo aparece de novo depois de recarregar (veio do banco, não do estado).
  await page.goto("/admin/setores");
  await expect(rowWith(page, sectorName)).toBeVisible();
  await page.goto("/admin/destinos");
  await expect(rowWith(page, destinationName)).toBeVisible();
});

test("(b) convite de operador para o setor novo: ele se cadastra e a Equipe mostra o setor", async ({
  page,
  browser,
  clientIp,
}) => {
  await registerAdmin(page, "Bruno Cadastros", uniqueEmail());
  const sector = await insertSector(db, `Setor ${unique()}`);
  const operatorEmail = uniqueEmail();

  await page.goto("/admin/equipe");
  await expect(page.getByRole("heading", { name: "Equipe" })).toBeVisible();
  await page.getByLabel("Nome de referência (opcional)").fill("Davi da ULD");
  // Papel já vem em Operador; o setor é escolhido pelo nome, não pelo id.
  await page.getByLabel("Setor", { exact: true }).selectOption({
    label: sector.name,
  });
  await page.getByRole("button", { name: "Gerar convite" }).click();

  // O link só aparece agora (o banco guarda só o hash do token).
  await expect(page.getByLabel("Link do convite")).toBeVisible();
  const link = await page.getByLabel("Link do convite").inputValue();
  expect(link).toContain("/convite/");
  await expect(page.getByRole("button", { name: "Copiar link" })).toBeVisible();

  // O convite já aparece na lista de pendentes, com o setor.
  await page.goto("/admin/equipe");
  await expect(rowWith(page, "Davi da ULD")).toContainText(sector.name);

  // O operador abre o link num navegador à parte e cria a conta.
  const other = await visitor(browser, clientIp);
  const operatorPage = await other.newPage();
  await signUpAtInviteUrl(operatorPage, link, {
    name: "Davi Operador",
    email: operatorEmail,
  });
  await other.close();

  // A linha dele na Equipe mostra o setor do convite; o convite sai dos pendentes.
  await page.goto("/admin/equipe");
  const personRow = rowWith(page, operatorEmail);
  await expect(personRow).toContainText("Operador");
  await expect(personRow).toContainText(sector.name);
  await expect(rowWith(page, "Davi da ULD")).toHaveCount(0);
});

test("(c) admin desativa o operador: as sessões caem e a próxima navegação vai para /entrar", async ({
  page,
  browser,
  clientIp,
}) => {
  await registerAdmin(page, "Carla Cadastros", uniqueEmail());
  const sector = await insertSector(db, `Setor ${unique()}`);
  const { token } = await insertInvite(db, {
    role: "operator",
    sectorId: sector.id,
  });
  const operatorEmail = uniqueEmail();

  const other = await visitor(browser, clientIp);
  const operatorPage = await other.newPage();
  await signUpWithInviteToken(operatorPage, token, {
    name: "Eduardo Operador",
    email: operatorEmail,
  });
  await operatorPage.getByRole("link", { name: "Agora não" }).click();
  await expect(operatorPage).toHaveURL(/\/$/);
  expect(await countSessionsByEmail(db, operatorEmail)).toBeGreaterThan(0);

  await page.goto("/admin/equipe");
  await rowWith(page, operatorEmail)
    .getByRole("button", { name: "Desativar Eduardo Operador" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Desativar Eduardo Operador?" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Desativar", exact: true }).click();
  await expect(page.getByText("Pessoa desativada.")).toBeVisible();
  await expect(rowWith(page, operatorEmail)).toContainText("Inativo");

  // P11: as sessões foram apagadas na mesma transação.
  expect(await countSessionsByEmail(db, operatorEmail)).toBe(0);
  await operatorPage.goto("/");
  await expect(operatorPage).toHaveURL(/\/entrar$/);
  await other.close();

  // Reativar volta a pessoa para ativa (o banco não apaga ninguém).
  await rowWith(page, operatorEmail)
    .getByRole("button", { name: "Reativar Eduardo Operador" })
    .click();
  await expect(page.getByText("Pessoa reativada.")).toBeVisible();
});

test("(d) operador em /admin/setores, /admin/equipe e nas outras rotas vê Página não encontrada", async ({
  page,
}) => {
  const sector = await insertSector(db, `Setor ${unique()}`);
  const { token } = await insertInvite(db, {
    role: "operator",
    sectorId: sector.id,
  });
  await signUpWithInviteToken(page, token, {
    name: "Fábio Operador",
    email: uniqueEmail(),
  });
  await page.getByRole("link", { name: "Agora não" }).click();
  await expect(page.getByRole("heading", { name: "Olá, Fábio" })).toBeVisible();

  for (const route of [
    "/admin/setores",
    "/admin/turnos",
    "/admin/itens",
    "/admin/destinos",
    "/admin/equipe",
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: "Página não encontrada" }),
    ).toBeVisible();
    await expect(page.getByLabel("Nome do setor")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Gerar convite" }),
    ).toHaveCount(0);
    // O <title> também não revela a rota (T12).
    await expect(page).not.toHaveTitle(
      /Administração|Setores|Turnos|Itens|Destinos|Equipe/,
    );
  }
});

test("(e) a linha da própria conta do admin mostra Você, a ajuda e nenhum botão", async ({
  page,
}) => {
  const email = uniqueEmail();
  await registerAdmin(page, "Gabriela Cadastros", email);

  await page.goto("/admin/equipe");
  const ownRow = rowWith(page, email);
  await expect(ownRow).toContainText("Você");
  await expect(ownRow).toContainText(
    "Peça a outro administrador para mudar a sua conta.",
  );
  await expect(ownRow.getByRole("button")).toHaveCount(0);
});

test("(f) setor com operador ativo não se desativa e mostra o motivo", async ({
  page,
}) => {
  await registerAdmin(page, "Hélio Cadastros", uniqueEmail());
  const sector = await insertSector(db, `Setor ${unique()}`);
  await insertUser(db, { role: "operator", sectorId: sector.id });

  await page.goto("/admin/setores");
  const row = rowWith(page, sector.name);
  await expect(row).toContainText("1 pessoa ativa");
  await row.getByRole("button", { name: `Desativar ${sector.name}` }).click();

  await expect(
    page.getByText("Este setor tem 1 pessoa ativa. Mova ou desative antes."),
  ).toBeVisible();
  // Nada mudou: continua ativo, com o botão de desativar.
  await expect(row).not.toContainText("Inativo");
  await expect(
    row.getByRole("button", { name: `Desativar ${sector.name}` }),
  ).toBeVisible();
});
```

- [ ] **Step 6: Check types, lint and that Playwright sees the six scenarios**

Run: `bunx biome check --write e2e test && bun run check-types && bun run lint && bunx playwright test --list`
Expected: `check-types` verde; `lint` com `No fixes applied.`; `playwright test --list` termina com `Total: 13 tests in 2 files` e lista os seis cenários `cadastros.spec.ts › (a)` a `(f)` depois dos sete de `auth.spec.ts`.

- [ ] **Step 7: Run the E2E scenarios**

Run: `bun run test:e2e -- cadastros.spec.ts`
Expected: PASS (6 passed). A primeira execução sobe o banco, roda `next build` e `next start -p 3200` (1 a 4 minutos). Se um cenário falhar, abra o rastro com `bunx playwright show-trace test-results/<pasta>/trace.zip` e corrija a **tela** (Tarefas 6–10) ou o seletor, nunca o texto contratual. Pontos de atenção por cenário: (b) o `<select>` "Setor" do formulário de convite precisa listar o setor criado direto no banco por `insertSector`; (c) o botão de desativar da pessoa tem `aria-label` `Desativar {nome}` e o diálogo tem o título `Desativar {nome}?`; (e) a linha da própria conta mostra o e-mail e nenhum botão; (f) o erro de `SECTOR_IN_USE` aparece em toast.

- [ ] **Step 8: Run the whole E2E suite**

Run: `bun run test:e2e`
Expected: PASS (13 passed: 7 de `auth.spec.ts` e 6 de `cadastros.spec.ts`).

- [ ] **Step 9: Commit**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-12.txt` (texto exato abaixo) e rode:
```bash
git add e2e/db.ts e2e/cadastros.spec.ts test/e2eDb.test.ts
git commit -F .git/sdd/msg-task-12.txt
```

Mensagem:
```text
test(e2e): cadastros e equipe de ponta a ponta

Seis cenários no navegador: admin cria setor, turno, item e destino;
convite de operador cai no setor certo; desativar derruba as sessões
(P11); operador vê página não encontrada; a própria conta do admin não
tem botões; setor com operador ativo não desativa. countSessionsByEmail
ganha teste de unidade com PGlite.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

---

### Task 13: Documentação de contexto, pendências e verificação final

**Files:**
- Create: `test/pendenciasDoc.test.ts` (guarda de consistência de `.context/pendencias.md`)
- Create: `test/uiRegistryDoc.test.ts` (guarda: todo componente de `/admin` e os primitivos novos estão em `ui-registry.md`)
- Modify: `.context/pendencias.md` (P11 e P18 → Resolvido e movidas para a seção 5; P23 nova; próximo id P24)
- Modify: `.context/architecture.md` (§6 tabelas, §7 "Como ficou implementado (Fase 2)", §9 rotas, §10 log)
- Modify: `.context/library-docs.md` (§2, §5, §7, §9, §10 e novo §12)
- Modify: `.context/code-standards.md` (§ de Server Action e de formulários: exceção do admin)
- Modify: `.context/progress-tracker.md` (Fase 2 ✅; próximo passo = plano da Fase 3)
- Modify: `.context/build-plan.md` (tabela de fases: 0, 1 e 2 ✅)
- Modify: `memory.md` (handoff)
- Verify: `.context/ui-registry.md` (conferido pelo guarda)

**Interfaces:**
- Consumes: tudo das Tarefas 1–12 (a documentação descreve o que foi construído: nomes de arquivos, `runAdminAction`, `AdminResult`, `actionsAuth.test.ts`, `actionsInventory.test.ts`, `authzOf`, `countSessionsByEmail`, rotas).
- Produces: nada de código; os dois guardas de documentação ficam no `bun run test`.

- [ ] **Step 1: Write the failing tests (guardas dos documentos)**

Crie `test/pendenciasDoc.test.ts`. Ele checa a estrutura (índice, seção e campo Estado coerentes; próximo id certo; resolvida tem Atualização datada) e as duas mudanças da Fase 2. Linhas dentro de blocos de código (o template `P999`) não contam.

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Guarda de consistência de .context/pendencias.md: o índice, a seção e o campo
// Estado de cada pendência dizem a mesma coisa, o próximo id livre é o certo e
// uma pendência fechada ganha uma Atualização datada (nunca é apagada).

const SECTION_STATE: Record<string, string> = {
  "1": "Aberto, não triado",
  "2": "Triado, plano pronto",
  "3": "Bloqueado no dono",
  "4": "Teto aceito",
  "5": "Resolvido",
};

type Entry = {
  id: string;
  section: string;
  state: string;
  updates: string[];
};

const source = readFileSync(".context/pendencias.md", "utf8");
// Só as linhas fora de blocos de código: o template "P999" do arquivo não conta.
const lines: string[] = [];
let inFence = false;
for (const line of source.split(/\r?\n/)) {
  if (line.startsWith("```")) {
    inFence = !inFence;
    continue;
  }
  if (!inFence) lines.push(line);
}

const index = new Map<string, string>();
for (const line of lines) {
  const match = /^\| (P\d+) \| .+ \| \S+ \| (.+) \|$/.exec(line);
  if (match?.[1] && match[2]) index.set(match[1], match[2]);
}

const entries = new Map<string, Entry>();
let section = "";
let current: Entry | null = null;
for (const line of lines) {
  const sectionMatch = /^## (\d)\. /.exec(line);
  if (sectionMatch?.[1]) {
    section = sectionMatch[1];
    current = null;
    continue;
  }
  const headingMatch = /^#### (P\d+) — /.exec(line);
  if (headingMatch?.[1]) {
    current = { id: headingMatch[1], section, state: "", updates: [] };
    entries.set(current.id, current);
    continue;
  }
  const stateMatch = /^\*\*Estado:\*\* (.+)$/.exec(line);
  if (stateMatch?.[1] && current) current.state = stateMatch[1];
  const updateMatch = /^\*\*Atualização \((\d{4}-\d{2}-\d{2})\):\*\*/.exec(
    line,
  );
  if (updateMatch?.[1] && current) current.updates.push(updateMatch[1]);
}

function idNumber(id: string): number {
  return Number(id.slice(1));
}

describe(".context/pendencias.md", () => {
  it("o índice e as seções listam as mesmas pendências", () => {
    expect([...index.keys()].sort()).toEqual([...entries.keys()].sort());
  });

  it("cada pendência está na seção do seu estado, igual ao índice", () => {
    for (const entry of entries.values()) {
      expect(entry.state, `${entry.id}: campo Estado`).toBe(
        SECTION_STATE[entry.section],
      );
      expect(index.get(entry.id), `${entry.id}: índice`).toBe(entry.state);
    }
  });

  it("o próximo id livre é o maior id mais um", () => {
    const max = Math.max(...[...entries.keys()].map(idNumber));
    expect(source).toContain(`**Próximo id livre: P${max + 1}.**`);
  });

  it("pendência resolvida tem ao menos uma Atualização datada", () => {
    for (const entry of entries.values()) {
      if (entry.state === "Resolvido") {
        expect(
          entry.updates.length,
          `${entry.id} sem Atualização`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("Fase 2: P11 e P18 resolvidas em 2026-11-21", () => {
    for (const id of ["P11", "P18"]) {
      const entry = entries.get(id);
      expect(entry?.state, id).toBe("Resolvido");
      expect(entry?.section, id).toBe("5");
      expect(entry?.updates, id).toContain("2026-11-21");
    }
  });

  it("Fase 2: 'Editar o nome de uma pessoa' entrou como Aberto, não triado", () => {
    const titles = lines.filter(
      (line) =>
        line.startsWith("#### P") &&
        line.includes("Editar o nome de uma pessoa"),
    );
    expect(titles).toHaveLength(1);
    const id = /^#### (P\d+)/.exec(titles[0] ?? "")?.[1] ?? "";
    expect(entries.get(id)?.state).toBe("Aberto, não triado");
  });
});
```

Crie `test/uiRegistryDoc.test.ts`. A busca é pelo nome do arquivo (sem diferença de caixa: `useAdminAction.ts` casa com `useAdminAction` no catálogo):

```ts
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";

// Guarda de .context/ui-registry.md: todo componente da Fase 2 (a pasta
// src/components/admin e os primitivos novos do shadcn) precisa estar no
// catálogo, para ninguém criar um componente parecido sem saber que existe. A
// busca é pelo nome do arquivo (sem diferença de caixa, `useAdminAction` casa
// com `UseAdminAction`).

const registry = readFileSync(".context/ui-registry.md", "utf8");

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)
      ? [full]
      : [];
  });
}

function pascalCase(kebab: string): string {
  return kebab
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function nameOf(file: string): string {
  return pascalCase(basename(file).replace(/\.(ts|tsx)$/, ""));
}

const adminFiles = sourceFiles(join("src", "components", "admin"));
const primitiveFiles = ["toggle", "toggle-group", "native-select", "dialog"]
  .map((name) => join("src", "components", "ui", `${name}.tsx`))
  .filter((file) => existsSync(file));

describe("ui-registry.md cobre os componentes da Fase 2", () => {
  it.each(
    [...adminFiles, ...primitiveFiles].map((file) => [file, nameOf(file)]),
  )("%s está no catálogo", (file, name) => {
    expect(
      new RegExp(String.raw`\b${name}\b`, "i").test(registry),
      `${file}: nenhuma menção a "${name}" em .context/ui-registry.md`,
    ).toBe(true);
  });

  it("AdminOverview descreve os cartões da Fase 2", () => {
    expect(registry).toContain(
      "2026-11-21 — Fase 2: cartões dos cinco cadastros",
    );
  });
});
```

- [ ] **Step 2: Run tests to verify the pendências guard fails**

Run: `bun run test -- test/pendenciasDoc.test.ts test/uiRegistryDoc.test.ts`
Expected: FAIL em `pendenciasDoc.test.ts`: `P11: expected 'Aberto, não triado' to be 'Resolvido'` e `expected [] to have a length of 1 but got +0` (2 falhas, 4 testes estruturais passam). O `uiRegistryDoc.test.ts` deve passar; se ele reprovar com `nenhuma menção a "<Nome>" em .context/ui-registry.md`, uma tarefa anterior esqueceu de catalogar o componente: acrescente a entrada no template do arquivo (Status, Local, Propósito, Como funciona, Usa, Histórico) antes de seguir.

- [ ] **Step 3: Update `pendencias.md`**

Crie `.git/sdd/docs-pendencias.mjs` com a ferramenta Write (o script falha com a mensagem `não achou: …` se o arquivo não estiver como esperado, em vez de gravar errado):

````js
import { readFileSync, writeFileSync } from "node:fs";
const f = ".context/pendencias.md";
let s = readFileSync(f, "utf8").replace(/\r\n/g, "\n");
function rep(a, b) {
  if (!s.includes(a)) throw new Error("não achou: " + a.slice(0, 60));
  s = s.replace(a, b);
}
rep("**Próximo id livre: P23.**", "**Próximo id livre: P25.**");
rep("| P11 | Sessões abertas de usuário desativado continuam aceitas por /api/auth/* | 🟠 | Aberto, não triado |", "| P11 | Sessões abertas de usuário desativado continuam aceitas por /api/auth/* | 🟠 | Resolvido |");
rep("| P18 | user.role e invite.role sem CHECK no banco | 🟡 | Aberto, não triado |", "| P18 | user.role e invite.role sem CHECK no banco | 🟡 | Resolvido |");
rep("| P22 | Limite de tentativas no piloto: confirmar IP e números | 🟡 | Aberto, não triado |\n", "| P22 | Limite de tentativas no piloto: confirmar IP e números | 🟡 | Aberto, não triado |\n| P23 | Editar o nome de uma pessoa: falta em /admin/equipe e em /conta | 🟡 | Aberto, não triado |\n| P24 | Ordem alfabética das listas do admin ignora acento | 🟡 | Aberto, não triado |\n");
const p11 = s.slice(s.indexOf("#### P11 — "), s.indexOf("#### P12 — "));
const p18 = s.slice(s.indexOf("#### P18 — "), s.indexOf("#### P19 — "));
s = s.replace(p11, "").replace(p18, "");
const p11r = p11.trimEnd().replace("**Estado:** Aberto, não triado", "**Estado:** Resolvido") + "\n**Atualização (2026-11-21):** resolvida na Fase 2. `setPersonActive({ active: false })` (`src/features/admin/people.ts`) preenche `deactivated_at` e apaga todas as linhas de `session` da pessoa na mesma transação; as sessões saem até quando a pessoa já estava desativada. Teste de domínio (só as sessões dela somem) e E2E (`countSessionsByEmail` = 0 e a próxima navegação vai para `/entrar`).\n\n";
const p18r = p18.trimEnd().replace("**Estado:** Aberto, não triado", "**Estado:** Resolvido") + "\n**Atualização (2026-11-21):** resolvida na Fase 2. A migração `0002_fase2_cadastros` acrescenta `CHECK` de papel em `user` (`user_role_valid`) e em `invite` (`invite_role_valid`); o teste de schema prova que o banco recusa um papel fora de `admin`/`operator` (SQLSTATE 23514).\n\n";
const p23 = `#### P23 — Editar o nome de uma pessoa: falta em /admin/equipe e em /conta 🟡
**Estado:** Aberto, não triado
**Arquivos:** \`src/features/admin/people.ts\` · \`src/components/admin/team/PersonForm.tsx\` · \`src/app/(app)/conta/page.tsx\`
**Impacto:** o nome vem do cadastro por convite e ninguém o corrige depois: nome digitado errado fica na lista da Equipe, na saudação e nas passagens futuras; nem a pessoa (em \`/conta\`) nem o administrador (em \`/admin/equipe\`) têm tela para isso.
**Correção:** — (opção: \`renamePerson\` no domínio com auditoria quando a Fase 3 passar a citar o nome nas passagens; campo "Nome" no diálogo "Editar pessoa" para o admin e em \`/conta\` para a própria pessoa)
**Registrado em:** 2026-11-21

`;
const p24 = `#### P24 — Ordem alfabética das listas do admin ignora acento 🟡
**Estado:** Aberto, não triado
**Arquivos:** \`src/features/admin/people.ts\` · \`src/features/admin/sectors.ts\` · \`src/features/admin/destinations.ts\`
**Impacto:** com collation \`C.UTF-8\`, \`lower(name)\` ordena por ponto de código: nomes com inicial acentuada (Á, É, Ó) vão para o fim das listas e da escolha de setor.
**Correção:** — (opção: \`ORDER BY name COLLATE "pt-BR-x-icu"\` se o Neon tiver ICU, ou coluna normalizada sem acento)
**Registrado em:** 2026-11-21

`;
rep("## 2. Triado, plano pronto", p23 + p24 + "## 2. Triado, plano pronto");
s = s.trimEnd() + "\n\n" + p11r.trimEnd() + "\n\n" + p18r.trimEnd() + "\n";
writeFileSync(f, s);
console.log("pendencias.md atualizado");
````

Run: `node .git/sdd/docs-pendencias.mjs`
Expected: `pendencias.md atualizado`.

Run: `bun run test -- test/pendenciasDoc.test.ts`
Expected: PASS (6 testes).

- [ ] **Step 4: Update `architecture.md`**

Crie `.git/sdd/docs-architecture.mjs` com a ferramenta Write:

````js
import { readFileSync, writeFileSync } from "node:fs";

const file = ".context/architecture.md";
let text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");

function replaceOnce(oldText, newText) {
  if (text.split(oldText).length !== 2) {
    throw new Error(`Trecho não encontrado (ou repetido): ${oldText.slice(0, 70)}`);
  }
  text = text.replace(oldText, () => newText);
}

// §6 — modelo de dados
replaceOnce(
  "## 6. Modelo de dados · 🟡 em construção (acesso e convite ✅ na Fase 1)",
  "## 6. Modelo de dados · 🟡 em construção (acesso, convite e cadastros ✅ até a Fase 2)",
);
replaceOnce(
  "**Tabelas criadas até a Fase 1** (migrações versionadas em `drizzle/`):",
  "**Tabelas criadas até a Fase 2** (migrações versionadas em `drizzle/`):",
);
replaceOnce(
  "| `sector` | setor: nome único, `active` | `uuid` |",
  "| `sector` | setor: `name` único sem diferença de caixa (índice `sector_name_lower_uq` em `lower(name)`), `active` | `uuid` |",
);
replaceOnce(
  "check `user_operator_needs_sector` (operador exige setor) | `text` |",
  "checks `user_operator_needs_sector` (operador exige setor) e `user_role_valid` (papel só `admin` ou `operator`) | `text` |",
);
replaceOnce(
  "`used_by`, `cancelled_at`; check `invite_operator_needs_sector` | `uuid` |",
  [
    "`used_by`, `cancelled_at`; checks `invite_operator_needs_sector` e `invite_role_valid` | `uuid` |",
    "| `shift` | turno de um setor: `name`, `starts_at` e `ends_at` (`time`; atravessar a meia-noite é permitido), `sort_order`, `active`; índice único `(sector_id, lower(name))`; check `shift_starts_ne_ends` | `uuid` |",
    "| `item` | item de um setor: `name`, `unit` (texto: a unidade da lista ou o \"Outro\" digitado), `kind` (`control` ou `stock`; check `item_kind_valid`), `sort_order`, `active`; índice único `(sector_id, lower(name))` | `uuid` |",
    "| `destination` | destino de solicitação, global: `name`, `active`; índice único `lower(name)` | `uuid` |",
  ].join("\n"),
);
replaceOnce(
  "As tabelas do Better Auth usam `timestamp` sem fuso (é o que a CLI gera); as do domínio (`sector`, `invite`) usam `timestamptz`. As demais entidades acima chegam nas Fases 2 a 4.",
  [
    "As tabelas do Better Auth usam `timestamp` sem fuso (é o que a CLI gera); as do domínio (`sector`, `invite`, `shift`, `item`, `destination`) usam `timestamptz`.",
    "",
    "- **Horário de turno** é `time` (sem fuso: o relógio da parede do setor) e trafega no app como texto `\"HH:mm\"`; o banco devolve `\"HH:mm:ss\"`.",
    "- **Nome único sem diferença de caixa** vale por índice em `lower(name)`: global em `sector` e `destination`, por setor em `shift` e `item`. O domínio normaliza o nome (NFC, `trim`, espaços colapsados) antes de gravar.",
    "- **Nada se apaga:** o cadastro só desativa (`active = false`); as listas de escolha das fases seguintes usam só os ativos, e as FKs para `sector` são `restrict`.",
    "",
    "As demais entidades acima (passagem, valores por item, solicitações) chegam nas Fases 3 e 4.",
  ].join("\n"),
);

// §7 — como ficou implementado na Fase 2
replaceOnce(
  "## 8. Dados pessoais (LGPD) · 🟢 baseline",
  [
    "### Como ficou implementado (Fase 2)",
    "",
    "- **Portão em três camadas.** (1) Toda página de `src/app/(app)/admin/**` chama `requireAdmin()` por um componente importado de `@/components/...` (guarda `appPagesAuth.test.ts`, mínimo de 9 páginas). (2) Toda Server Action exportada de `src/app/(app)/admin/**/actions.ts` chama `requireAdmin()` na primeira linha (guarda `actionsAuth.test.ts`; `actionsInventory.test.ts` fixa as 18 actions dos 5 arquivos). (3) O domínio (`src/features/admin/*`) não confia na tela e revalida a regra de negócio: setor ativo, autoedição e último administrador.",
    "- **Resultado tipado.** O domínio devolve `AdminResult` (`{ ok: true, … }` ou `{ ok: false, code, message, fieldErrors? }`) com mensagem pt-BR pronta, nunca texto do banco. `runAdminAction` faz Zod → domínio → `revalidatePath(\"/(app)/admin\", \"layout\")` só em sucesso (com route group o caminho é o do arquivo); exceção inesperada vira `INTERNAL`, e `redirect`/`notFound` passam intactos (`unstable_rethrow`).",
    "- **Equipe.** `updatePerson` muda papel e setor juntos numa transação (operador exige setor ativo; admin grava `sector_id = null`). Nunca se desativa nem se rebaixa o **último administrador ativo**: dentro da transação, `SELECT … FOR UPDATE` nos administradores ativos serializa dois admins que se desativam ao mesmo tempo. Ninguém desativa nem rebaixa a **própria** conta (`SELF_CHANGE`). Desativar apaga as sessões da pessoa na mesma transação (P11). Mudar papel ou setor não encerra sessões: a sessão é lida fresca e vale na próxima requisição.",
    "- **Convites do admin.** `createTeamInvite` usa `createInvite` com `invitedBy` = admin atual e devolve o link **uma vez** (só o hash fica no banco; link perdido = cancelar e gerar outro). `cancelInvite` é um `UPDATE … WHERE` condicional: só cancela convite ainda pendente.",
    "- **Desativar setor.** Setor com pessoa ativa ou convite pendente (válido) **não** desativa (`SECTOR_IN_USE`, com as contagens). Turno, item e convite não nascem em setor inativo.",
    "- **Sem `layout.tsx` e sem `metadata` em `/admin`.** Um layout renderizaria a navegação do admin para o operador antes do `notFound()` da página, e o `<title>` revelaria a rota. Cada página tem o link \"Voltar para Administração\"; a sidebar já marca \"Administração\" ativa nas subrotas.",
    "",
    "## 8. Dados pessoais (LGPD) · 🟢 baseline",
  ].join("\n"),
);

// §9 — rotas
replaceOnce(
  "## 9. Rotas · 🟢 rotas da Fase 1 prontas (as seguintes entram a cada marco)",
  "## 9. Rotas · 🟢 rotas das Fases 1 e 2 prontas (as seguintes entram a cada marco)",
);
replaceOnce(
  "| `/admin` | Administração (placeholder até a Fase 2); operador vê \"Página não encontrada\" | ✅ Fase 1 |",
  [
    "| `/admin` | Administração: cinco cartões (setores, turnos, itens, destinos, equipe) com as contagens de ativos e pendentes; operador vê \"Página não encontrada\" | ✅ Fase 2 |",
    "| `/admin/setores` | setores: criar, renomear, desativar e reativar (bloqueia com pessoas ou convites). Admin | ✅ Fase 2 |",
    "| `/admin/turnos` | turnos por setor (`?setor=`): horário que pode passar da meia-noite, aviso de sobreposição, ordem por botões. Admin | ✅ Fase 2 |",
    "| `/admin/itens` | itens por setor (`?setor=`): unidade por escolha com \"Outro\", tipo controle ou estoque, ordem por botões. Admin | ✅ Fase 2 |",
    "| `/admin/destinos` | destinos de solicitação (valem para todos os setores). Admin | ✅ Fase 2 |",
    "| `/admin/equipe` | pessoas (papel, setor, desativar) e convites (gerar, copiar ou compartilhar, cancelar); `?pagina=` pagina as pessoas e `?convites=` os convites pendentes. Admin | ✅ Fase 2 |",
  ].join("\n"),
);

// §10 — log
text = `${text.trimEnd()}

### 2026-11-21 — Fase 2: cadastros e equipe

- **Decisão:** seis telas em \`/admin\` (visão geral, setores, turnos, itens, destinos, equipe). Regra de negócio em funções de domínio que recebem \`db\` e \`now\` e devolvem \`AdminResult\`; lógica pura (nome, horário, sobreposição, unidade, paginação, reordenação) em módulos sem I/O; Server Action fina por página (\`requireAdmin\` → \`runAdminAction\`). Nada se apaga (só desativa); nome único sem diferença de caixa por índice em \`lower(name)\`; turnos avisam sobreposição (inclusive à meia-noite) sem bloquear; ordem de turnos e itens por botões ↑ ↓; unidade do item por escolha com \"Outro\"; desativar setor com gente é bloqueado; equipe com papel, setor, desativação e convites com link. Migração \`0002_fase2_cadastros\` (tabelas \`shift\`, \`item\`, \`destination\`, índices \`lower(name)\`, CHECKs de papel, tipo e horário).
- **Por quê:** a passagem de turno (Fase 3) precisa de setores, turnos e itens para escolher, e de um administrador que consiga gerir a equipe sem mexer no banco. Desativar em vez de apagar preserva o histórico das passagens futuras; bloquear a desativação de setor evita operador num setor inativo e convite órfão; o aviso (e não bloqueio) de sobreposição segue a spec §5.
- **Trade-offs aceitos:** (1) PGlite não prova concorrência: o \"último admin\" (\`FOR UPDATE\`) e o nome repetido (índice único) são garantidos no SQL e provados em sequência. (2) Lista em linhas, não tabela, para funcionar no celular. (3) ↑ ↓ andam entre ativos e inativos; se incomodar na Fase 3, mover só entre ativos. (4) Mudar papel ou setor não encerra sessões (só desativar encerra). (5) A sobreposição de turnos lê até 200 turnos ativos do setor.
- **Desvios e detalhes registrados:** (a) \"mudar papel\" e \"mudar setor\" viraram uma ação \`updatePerson\` (\"Editar\"): uma transação evita o estado \"operador sem setor\". (b) A linha da própria conta do admin não tem botões (botão que sempre falha é atrito); a regra continua no servidor. (c) Formulários controlados chamam a action com objeto tipado, em vez de \`useActionState\`, para a pessoa não perder o que digitou quando o servidor recusa. (d) O Drizzle 0.45 embrulha o erro do driver: SQLSTATE e nome do índice ficam em \`error.cause\`. (e) \`time\` volta como \`\"HH:mm:ss\"\`. (f) \`db.select({ … })\` sem \`.from()\` não executa nesta versão do Drizzle; a visão geral seleciona de uma tabela de uma linha (\`values (1)\`) com subconsultas \`count(*)\`. (g) Verificado no branch de dev do Neon: collation \`C.UTF-8\` e \`lower('ÁGUA') = lower('água')\`, então \"Água\" e \"ÁGUA\" colidem em produção como no PGlite.
- **Verificado:** \`check-types\`, \`lint\`, \`test\`, \`test:e2e\` (13 passed) e \`build\` verdes. P11 e P18 resolvidas; P23 (editar o nome de uma pessoa) e P24 (ordem alfabética ignora acento) registradas.
`;

writeFileSync(file, text);
console.log("architecture.md atualizado");
````

Run: `node .git/sdd/docs-architecture.mjs`
Expected: `architecture.md atualizado`.

- [ ] **Step 5: Update `library-docs.md` and `code-standards.md`**

Crie `.git/sdd/docs-library.mjs` com a ferramenta Write (usa fence de quatro crases porque o texto contém um bloco de código):

`````js
import { readFileSync, writeFileSync } from "node:fs";

function edit(file, changes) {
  let text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  for (const [oldText, newText] of changes) {
    if (text.split(oldText).length !== 2) {
      throw new Error(`${file}: trecho não encontrado (ou repetido): ${oldText.slice(0, 70)}`);
    }
    text = text.replace(oldText, () => newText);
  }
  writeFileSync(file, text);
  console.log(`${file} atualizado`);
}

edit(".context/library-docs.md", [
  // §2 shadcn
  [
    "- `cn` vem do pacote **`cn`** (utilitário oficial do shadcn, substitui `clsx` + `tailwind-merge`),\n  reexportado em `@/lib/utils`.",
    [
      "- `cn` vem do pacote **`cn`** (utilitário oficial do shadcn, substitui `clsx` + `tailwind-merge`),",
      "  reexportado em `@/lib/utils`.",
      "- **Fase 2: `toggle-group` (traz `toggle`), `native-select` e `dialog`.** Comando:",
      "  `bunx shadcn add toggle-group native-select dialog --yes --overwrite` e depois",
      "  `git checkout -- src/components/ui/button.tsx`. O `dialog` reinstala o `button.tsx` e o CLI",
      "  pergunta se pode sobrescrever mesmo com `--yes`: sem `--overwrite` o comando trava, e o",
      "  `button.tsx` sobrescrito perde a customização da P3. Os gerados saem com `h-8`/`h-7` e `\"Close\"`",
      "  em inglês: ajuste para `h-9 max-md:h-11` (ou `size-9 max-md:size-11`), `text-base md:text-sm` no",
      "  select nativo e `\"Fechar\"` (`touchTargets.test.tsx` e `ptBrLabels.test.tsx` guardam). Não usamos",
      "  `table`, `select` (Base UI), `radio-group` nem `alert-dialog`: lista em linhas, `<select>` nativo",
      "  (abre o seletor do aparelho, 16px) e `Dialog` para confirmar.",
    ].join("\n"),
  ],
  // §5 Drizzle
  [
    "- **Não use `db.batch`**: ele não existe no driver de teste.",
    [
      "- **Não use `db.batch`**: ele não existe no driver de teste.",
      "- **`time` é texto.** O Drizzle e o `pg` devolvem `time` como `\"HH:mm:ss\"` e aceitam `\"HH:mm\"` na",
      "  entrada; o app trafega `\"HH:mm\"` (`fromDbTime`/`toDbTime` em `src/features/admin/timeOfDay.ts`).",
      "  `CHECK` violado = SQLSTATE `23514`; índice único violado = `23505`.",
      "- **Erro do driver embrulhado.** O Drizzle 0.45 coloca o erro do driver em `error.cause`: o SQLSTATE",
      "  e o nome do índice estão em `error.cause.code` e `error.cause.constraint`. Use `sqlStateOf`,",
      "  `constraintOf` e `isUniqueViolation` (`src/features/admin/dbErrors.ts`), nunca `error.code` direto.",
      "- **Nome único sem diferença de caixa** = ``uniqueIndex(\"…\").on(sql`lower(${t.name})`)``; composto por",
      "  setor: ``.on(t.sectorId, sql`lower(${t.name})`)`` (esse índice já cobre a FK `sector_id`, então não",
      "  há `index()` separado). Verificado no Neon de dev: `datcollate = datctype = C.UTF-8` e",
      "  `lower('ÁGUA') = lower('água')`, então \"Água\" e \"ÁGUA\" colidem em produção como no PGlite.",
      "- **`FOR UPDATE`:** `tx.select(…).from(t).where(…).for(\"update\")` roda no `pg` e no PGlite; o domínio",
      "  usa para trancar os administradores ativos (último admin) e as linhas de um setor (reordenar).",
      "- **`db.select({ … })` sem `.from()` não executa** nesta versão do Drizzle (o builder não é",
      "  \"thenable\"). Para um SELECT só de subconsultas use ``.from(sql`(values (1)) as one(n)`)``",
      "  (`getAdminOverviewCounts`). `count(*)` volta como `bigint` (texto no driver): converta com",
      "  `.mapWith(Number)` ou use o `count()` do `drizzle-orm`.",
      "- **Subconsulta correlacionada:** num `SELECT` de uma tabela só o Drizzle tira o prefixo das colunas; dentro de",
      "  ``sql`(select … where u.sector_id = ${sector.id})` `` o `\"id\"` resolveria para a tabela de dentro. Escreva",
      "  a coluna externa por extenso (`\"sector\".\"id\"`) ou use JOIN/GROUP BY, e teste com dois registros de",
      "  contagens diferentes (`listSectors`).",
      "- **`FOR SHARE`:** a checagem de \"setor ativo\" (`updatePerson`, `setPersonActive`, `createTeamInvite`,",
      "  `createShift`, `createItem`) lê o setor com `.for(\"share\")` dentro de `db.transaction`; serializa com o",
      "  `FOR UPDATE` de `setSectorActive`. Fora de transação a trava some no fim do statement.",
    ].join("\n"),
  ],
  // §7 Zod
  [
    "- Em uso: `parseAuthEnv` (`src/lib/auth/env.ts`). API do Zod 4: `z.url()` (não `z.string().url()`) e mensagem por `{ error: \"…\" }`.",
    [
      "- Em uso: `parseAuthEnv` (`src/lib/auth/env.ts`). API do Zod 4: `z.url()` (não `z.string().url()`) e mensagem por `{ error: \"…\" }`.",
      "- **Fase 2:** os schemas das Server Actions de `/admin` ficam em `src/features/admin/schemas.ts` (sem",
      "  `server-only`): o mesmo schema valida no formulário e na action. `firstFieldErrors(error)` percorre",
      "  `error.issues` e guarda a 1ª mensagem por campo (`issue.path[0]`; `z.flattenError` tiparia `fieldErrors` como `{}`); `.refine` com `path` marca o campo certo",
      "  (`endsAt`, `sectorId`, `unitOther`).",
    ].join("\n"),
  ],
  // §9 Vitest
  [
    "O rate limit não afeta `auth.api.*`.",
    [
      "O rate limit não afeta `auth.api.*`.",
      "- **Permissão em teste de domínio e de action:** `authzOf({ role, … })` (`test/authz.ts`) monta o",
      "  `Authz` (admin sempre com `sectorId` nulo); a action de operador, com `requireAdmin` mockado para",
      "  lançar `notFound`, não toca o banco. **Guardas estáticos** que leem arquivos: `appPagesAuth.test.ts`",
      "  (páginas), `actionsAuth.test.ts` e `actionsInventory.test.ts` (actions), `pendenciasDoc.test.ts`",
      "  (índice, seções e próximo id de `pendencias.md`) e `uiRegistryDoc.test.ts` (todo componente de",
      "  `/admin` aparece em `ui-registry.md`).",
    ].join("\n"),
  ],
  [
    "só para a camada fina (actions e route handlers).",
    "para a camada fina (actions e route handlers) e para os Server Components de lista que leem o PGlite (`ShiftsAdmin`, `ItemsAdmin`); o projeto `dom` roda o mesmo `globalSetup`, com timeouts de 15 s/30 s.",
  ],
  // §10 Playwright
  [
    "(cadastro por e-mail: 10 por 60 s por IP; a suíte faz 6 cadastros): cada teste manda `x-forwarded-for` próprio (fixture `clientIp`).",
    "(cadastro por e-mail: 10 por 60 s por IP): cada teste manda `x-forwarded-for` próprio (fixture `clientIp`, repetida em `auth.spec.ts` e `cadastros.spec.ts`) e nenhum faz mais de 2 cadastros.",
  ],
  [
    "- Cada teste cria os próprios dados (e-mail único, nomes fictícios). Login social ao vivo é checklist manual.",
    [
      "- Cada teste cria os próprios dados (e-mail único, nomes fictícios). Login social ao vivo é checklist manual.",
      "- **`e2e/cadastros.spec.ts`:** a linha de uma lista é um `<li>` dentro de `<main>` (`rowWith(page, texto)`),",
      "  para não casar com a barra lateral; o link do convite sai do campo `Link do convite`;",
      "  `countSessionsByEmail` (`e2e/db.ts`) prova que desativar apaga as sessões (P11). Setor, turno, item",
      "  e destino de cada teste têm nome único (sufixo aleatório): o banco só é limpo entre execuções.",
    ].join("\n"),
  ],
  // novo §12
  [
    "## Como adicionar uma biblioteca nova",
    [
      "## 12. Server Actions do admin (Fase 2)",
      "",
      "- **Onde:** `src/app/(app)/admin/<cadastro>/actions.ts` (`\"use server\"`), uma por página; a regra de",
      "  negócio fica em `src/features/admin/<cadastro>.ts` (recebe `db` e `now`). O arquivo só exporta",
      "  funções `async`: tipos, constantes e schemas vivem fora dele.",
      "- **Padrão de cada função exportada:** `requireAdmin()` na **primeira linha** (guarda",
      "  `actionsAuth.test.ts`), depois `runAdminAction`:",
      "",
      "  ```ts",
      "  export async function createSectorAction(input: unknown) {",
      "    const actor = await requireAdmin();",
      "    return runAdminAction({",
      "      actor,",
      "      schema: createSectorSchema,",
      "      input,",
      "      run: ({ db, input }) => createSector(db, input),",
      "    });",
      "  }",
      "  ```",
      "",
      "- **`runAdminAction`** (`src/features/admin/runAdminAction.ts`, `server-only`): `schema.safeParse` →",
      "  falha vira `INVALID_INPUT` com `fieldErrors`; `run({ db, now, actor, input })`; `revalidatePath(\"/(app)/admin\",",
      "  \"layout\")` só quando `ok` (com route group o caminho é o do arquivo, como em `revalidatePath.md`); exceção inesperada passa por `unstable_rethrow` (deixa `redirect` e",
      "  `notFound` seguirem) e, se for outra, vira `INTERNAL` com `console.error` e texto fixo. Nunca devolve",
      "  texto do banco.",
      "- **Erro esperado volta como `AdminResult`** (`ok: false`, `code`, `message` pt-BR pronta); `throw` só para",
      "  falha interna. Erro de nome repetido (23505) consulta o registro conflitante para dizer se ele está",
      "  inativo.",
      "- **Formulário controlado:** o componente guarda o estado, chama a action com um **objeto tipado** dentro de",
      "  `useAdminAction` e só limpa o campo no sucesso; erro de campo vem de `fieldErrors`. Não use",
      "  `useActionState`/`FormData` aqui: o React 19 limpa o formulário não controlado depois do envio.",
      "- **Tempo e paginação:** o domínio recebe `now: Date` quando o tempo importa; listas usam `PAGE_SIZE = 50`",
      "  e `?pagina=`, e a página fora do intervalo é clampada.",
      "",
      "## Como adicionar uma biblioteca nova",
    ].join("\n"),
  ],
]);

edit(".context/code-standards.md", [
  [
    "dentro de `src/features/<domínio>/actions.ts`.\n  Toda action:",
    "dentro de `src/features/<domínio>/actions.ts` (exceção: as de `/admin` ficam ao lado\n  da página, ver `library-docs.md §12`).\n  Toda action:",
  ],
  [
    "- **Formulários:** Server Action + `useActionState`; validação Zod no servidor (e no client só\n  para feedback imediato, com o **mesmo** schema).",
    "- **Formulários:** Server Action + `useActionState`; validação Zod no servidor (e no client só\n  para feedback imediato, com o **mesmo** schema). Quando o servidor pode recusar e a pessoa não\n  pode perder o que digitou (cadastros do admin), o formulário é **controlado** e chama a action\n  com um objeto tipado (`library-docs.md §12`).",
  ],
]);
`````

Run: `node .git/sdd/docs-library.mjs`
Expected: `.context/library-docs.md atualizado` e `.context/code-standards.md atualizado`.

- [ ] **Step 6: Update `progress-tracker.md`, `build-plan.md` and `memory.md`**

Crie `.git/sdd/docs-estado.mjs` com a ferramenta Write:

````js
import { readFileSync, writeFileSync } from "node:fs";

function edit(file, changes, append = "") {
  let text = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  for (const [oldText, newText] of changes) {
    if (text.split(oldText).length !== 2) {
      throw new Error(`${file}: trecho não encontrado (ou repetido): ${oldText.slice(0, 70)}`);
    }
    text = text.replace(oldText, () => newText);
  }
  if (append) text = `${text.trimEnd()}\n${append}\n`;
  writeFileSync(file, text);
  console.log(`${file} atualizado`);
}

edit(".context/progress-tracker.md", [
  [
    "- **2026-11-20 — Fases 0 e 1 concluídas. Próximo: plano de implementação da Fase 2 (Cadastros:\n  setores, turnos, itens, destinos, equipe)** com a skill `writing-plans`, a partir da spec §13\n  (`docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md`). O `/admin` já existe\n  como placeholder e recebe as telas; o convite de operador já exige setor (`sector`).",
    "- **2026-11-21 — Fases 0, 1 e 2 concluídas. Próximo: plano de implementação da Fase 3 (Passagem:\n  rascunho, entregar, receber, corrigir, histórico)** com a skill `writing-plans`, a partir da spec\n  §13 (`docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md`). Os cadastros que a\n  passagem usa (setores, turnos, itens, destinos) e a equipe já existem em `/admin`; falta a tela do\n  operador que os usa.",
  ],
  [
    "## Histórico",
    [
      "## Fase 2 — Cadastros · ✅",
      "",
      "- ✅ Schema: `shift`, `item`, `destination`, índices únicos em `lower(name)`, CHECKs de papel (P18), de tipo do item e de horário + migração `0002_fase2_cadastros` (2026-11-21)",
      "- ✅ Lógica pura e contrato das actions: nome, horário, sobreposição à meia-noite, unidade, paginação, reordenação, `AdminResult`, `runAdminAction` e os guardas `actionsAuth` e `actionsInventory` (2026-11-21)",
      "- ✅ Primitivos `toggle-group`, `native-select` e `dialog` com alvos de toque e \"Fechar\", e a UI compartilhada de `/admin` (2026-11-21)",
      "- ✅ Setores, destinos, turnos (aviso de sobreposição, ordem por botões) e itens (unidade por escolha com \"Outro\") (2026-11-21)",
      "- ✅ Equipe: papel e setor, desativar (derruba as sessões, P11), último admin protegido e convites com link para copiar ou compartilhar (2026-11-21)",
      "- ✅ Visão geral `/admin` com os cinco cartões e guarda de 9 páginas (2026-11-21)",
      "- ✅ P11 e P18 resolvidas; pendências novas P23 (editar o nome de uma pessoa) e P24 (ordem alfabética ignora acento) (2026-11-21)",
      "- ✅ Testes: Vitest (node + dom) com PGlite e Testing Library; E2E com 13 cenários (7 de acesso e 6 de cadastros). Verificado: `check-types`, `lint`, `test`, `test:e2e` (13 passed) e `build` verdes (2026-11-21)",
      "",
      "## Histórico",
    ].join("\n"),
  ],
  [
    "guarda de páginas `appPagesAuth.test.ts` (no lugar do `RequireUser`) e pendências P11–P22.",
    "guarda de páginas `appPagesAuth.test.ts` (no lugar do `RequireUser`) e pendências P11–P22.\n- **2026-11-21** — Fase 2 concluída: cadastros e equipe em `/admin` (setores, turnos, itens, destinos, pessoas e convites), P11 e P18 resolvidas. Plano em `docs/superpowers/plans/2026-11-21-fase-2-cadastros.md`.",
  ],
]);

edit(".context/build-plan.md", [
  [
    "· PGlite + Vitest + Playwright · tokens da D16 | 🟡 em andamento |",
    "· PGlite + Vitest + Playwright ✅ · tokens da D16 ✅ | ✅ |",
  ],
  [
    "convites, `admin:invite`, shell de navegação, escopo por setor | ⬜ |",
    "convites, `admin:invite`, shell de navegação, escopo por setor | ✅ |",
  ],
  [
    "| **2 — Cadastros** | setores, turnos, itens, destinos, equipe | ⬜ |",
    "| **2 — Cadastros** | setores, turnos, itens, destinos, equipe | ✅ |",
  ],
]);

edit("memory.md", [
  [
    "# Memory — Fases 0 e 1 concluídas; o próximo passo é o plano da Fase 2",
    "# Memory — Fases 0, 1 e 2 concluídas; o próximo passo é o plano da Fase 3",
  ],
  ["Last updated: 2026-11-20 (UTC-3)", "Last updated: 2026-11-21 (UTC-3)"],
  [
    "Início, `/admin` (placeholder) e o shell com sidebar.",
    [
      "Início, `/admin` e o shell com sidebar.",
      "",
      "**Cadastros prontos (Fase 2).** `/admin` tem os cinco cartões e as telas `/admin/setores`,",
      "`/admin/turnos`, `/admin/itens`, `/admin/destinos` e `/admin/equipe`: nada se apaga (só desativa),",
      "turno avisa sobreposição, ordem por botões ↑ ↓, unidade do item por escolha com \"Outro\", equipe com",
      "papel, setor, desativação (que derruba as sessões, P11) e convites com link para copiar ou compartilhar.",
      "Plano executado em `docs/superpowers/plans/2026-11-21-fase-2-cadastros.md`.",
    ].join("\n"),
  ],
  [
    "- **Plano da Fase 2 (skill `writing-plans`):** Cadastros — setores, turnos, itens, destinos de\n  solicitação, equipe. O `/admin` já existe como placeholder.",
    [
      "- **Plano da Fase 3 (skill `writing-plans`):** Passagem — rascunho, entregar, receber, corrigir,",
      "  histórico. Usa os setores, turnos e itens já cadastrados; ainda não há tela de operador para eles.",
      "- **P23:** editar o nome de uma pessoa (o admin em `/admin/equipe`, a própria pessoa em `/conta`).",
      "- **P24:** a ordem alfabética das listas do admin ignora acento (`C.UTF-8` ordena por ponto de código).",
    ].join("\n"),
  ],
], [
  "- **Server Actions de `/admin`:** `requireAdmin()` na primeira linha de **cada** função exportada (guarda",
  "  `actionsAuth.test.ts`); `actions.ts` só exporta funções `async`; o formulário é controlado e chama a action",
  "  com objeto tipado; `runAdminAction` devolve `AdminResult` (`library-docs.md §12`).",
  "- **`/admin` não tem `layout.tsx` nem `metadata`:** os dois sairiam antes do `notFound()` e revelariam a",
  "  rota ao operador. `<h1>` sempre dentro do `<Suspense>`.",
  "- **`shadcn add dialog` reinstala `button.tsx`** e trava no prompt sem `--overwrite`: rode com `--overwrite`",
  "  e depois `git checkout -- src/components/ui/button.tsx` (customização da P3).",
  "- **`time` é texto** (`\"HH:mm:ss\"` do banco, `\"HH:mm\"` no app) e o erro do driver vem embrulhado em",
  "  `error.cause` (SQLSTATE em `error.cause.code`).",
  "- **PGlite não prova o \"último admin\"**: a garantia é `SELECT … FOR UPDATE` no SQL, provada em sequência.",
  "- **Neon de dev:** collation `C.UTF-8`; `lower('ÁGUA') = lower('água')`, então nomes acentuados colidem",
  "  sem diferença de caixa também em produção.",
].join("\n"));
````

Run: `node .git/sdd/docs-estado.mjs`
Expected: três linhas `… atualizado` (`progress-tracker.md`, `build-plan.md`, `memory.md`).

- [ ] **Step 7: Run the documentation guards**

Run: `bun run test -- test/pendenciasDoc.test.ts test/uiRegistryDoc.test.ts`
Expected: PASS (`pendenciasDoc.test.ts`: 6 testes; `uiRegistryDoc.test.ts`: 1 teste por componente de `src/components/admin/**` mais os quatro primitivos novos, mais o teste do `AdminOverview`). Se o `uiRegistryDoc` reprovar com `nenhuma menção a "<Nome>"`, acrescente a entrada do componente em `.context/ui-registry.md` no template do arquivo e rode de novo (é a "conferência do ui-registry" da fase).

- [ ] **Step 8: Final verification gate (nada de commit se algo falhar)**

Rode, nesta ordem, e confira a saída de cada um:

```bash
bun run check-types
bun run lint
bun run test
bun run test:e2e
bun run build
```
Expected:
- `check-types`: `✓ Types generated successfully` e nenhum erro do `tsc`.
- `lint`: `Checked N files … No fixes applied.`
- `test`: todos os arquivos passando (`Test Files  N passed (N)`), nenhum falhando e nenhum `Unhandled Error`.
- `test:e2e`: `13 passed` (7 de `auth.spec.ts` e 6 de `cadastros.spec.ts`).
- `build`: termina sem erro e a tabela de rotas lista `/admin`, `/admin/destinos`, `/admin/equipe`, `/admin/itens`, `/admin/setores` e `/admin/turnos`, todas parcialmente pré-renderizadas (`◐`).

Se qualquer um falhar, corrija a causa na tarefa a que ela pertence (não afrouxe teste) e rode o gate inteiro de novo. As linhas "Verificado" escritas nos documentos só valem com este gate verde.

- [ ] **Step 9: Commit final (sem push)**

Escreva a mensagem com a ferramenta Write em `.git/sdd/msg-task-13.txt` (texto exato abaixo) e rode:
```bash
git add test/pendenciasDoc.test.ts test/uiRegistryDoc.test.ts .context/pendencias.md .context/architecture.md .context/library-docs.md .context/code-standards.md .context/progress-tracker.md .context/build-plan.md .context/ui-registry.md memory.md
git commit -F .git/sdd/msg-task-13.txt
git status --short
```
Expected do `git status --short`: vazio (os scripts de `.git/sdd/` não entram no índice). Não rode `git push`: o PR só abre com o CI (`checks` + `e2e`) verde.

Mensagem:
```text
docs: fecha a Fase 2 (cadastros) no contexto do projeto

architecture (tabelas, portão em três camadas, rotas, log), library-docs
(padrão de Server Action do admin, time como texto, índice lower(name),
collation C.UTF-8 verificada), tracker, build-plan e memory. P11 e P18
resolvidas; novas pendências P23 (editar o nome de uma pessoa) e P24 (ordem
alfabética ignora acento). Guardas de documento: pendenciasDoc e uiRegistryDoc.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
```

- [ ] **Step 10: Walkthrough didático da Fase 2 (`code-standards.md §9`)**

Entregue no chat (não em arquivo), nas quatro partes da regra:
1. **O que foi construído e onde vivem as peças:** migração `0002` e `src/db/schema/catalog.ts`; lógica pura em `src/features/admin/{names,timeOfDay,shiftRules,itemOptions,pagination,reorder,messages}.ts`; contrato das actions (`result.ts`, `dbErrors.ts`, `schemas.ts`, `runAdminAction.ts`); domínio (`sectors`, `destinations`, `shifts`, `items`, `people`, `teamInvites`, `overview`); actions e páginas em `src/app/(app)/admin/*`; componentes em `src/components/admin/**`; guardas (`appPagesAuth`, `actionsAuth`, `actionsInventory`, `pendenciasDoc`, `uiRegistryDoc`).
2. **Decisões e trade-offs:** D-F2-1..4 e F2-1..24, com destaque para:
   - nada se apaga;
   - a sobreposição avisa, não bloqueia;
   - `updatePerson` roda numa transação só;
   - último admin protegido por `FOR UPDATE` (o PGlite não prova concorrência);
   - formulário controlado em vez de `useActionState`;
   - `/admin` sem `layout.tsx` e sem `metadata`.
3. **Como debugar:**
   - recusa → o `code` do `AdminResult` e a mensagem em `messages.ts`;
   - `INTERNAL` → o `console.error` de `runAdminAction`;
   - nome repetido → `constraintOf(error)` (está em `error.cause`);
   - horário → `fromDbTime`/`toDbTime`;
   - tela não atualiza → `revalidatePath` só roda em sucesso;
   - E2E → `bunx playwright show-trace`.
4. **O que entender antes de aprovar:** o portão em três camadas; `unstable_rethrow`; o índice em `lower(name)` e a ordem por ponto de código do `C.UTF-8`; os segmentos semiabertos da meia-noite.


---

## Perguntas resolvidas (2026-11-21)

1. **Collation do Neon e `lower()`.** **Verificado** no branch de dev do Neon: `datcollate = datctype = C.UTF-8` e `lower('ÁGUA Ç') = 'água ç'` (`lower('ÁGUA') = lower('água')` é `true`). `lower(name)` vale para nomes acentuados também em produção (mesmo projeto Neon); nenhum passo manual na Tarefa 1.
2. **Nome do turno sugerido `Turno N`:** mantido (F2-9).
3. **Teto de itens e turnos por setor:** nenhum agora (YAGNI); a sobreposição lê até `CHOICE_LIST_LIMIT` (200) turnos ativos do setor.
4. **Editar o nome de uma pessoa:** fora desta fase; a Tarefa 13 registra pendência nova (`Aberto, não triado`) junto com "edição do próprio nome em `/conta`".
5. **↑ ↓ entre ativos e inativos:** mantido (a lista do admin mostra os dois); se incomodar na Fase 3, mover só entre ativos.
6. **Mudar papel/setor não encerra sessões:** mantido; a sessão é lida fresca e vale na próxima requisição. Só desativar encerra sessões (P11).
