# Arquitetura — Closery

> **Documento vivo.** Registra a arquitetura e evolui com a execução do `build-plan.md`. Cada
> marco concluído atualiza as seções relevantes (rotas, tabelas, módulos) e registra a decisão no
> **Log de evolução** (§10).
>
> `🟢 definido` = acordado. `🟡 a preencher` = depende do brainstorm ou do marco correspondente.

---

## 1. Visão geral · 🟢 definido

Aplicação **Next.js única** (front e back no mesmo projeto, sem monorepo, sem API separada).
Leitura em **Server Components**, escrita em **Server Actions**; Route Handlers só quando algo
externo precisar chamar o sistema (ex.: exportação CSV). Banco **Postgres no Neon**, acessado
via **Drizzle**.

Princípios estruturais:
- **Servidor primeiro.** Dado nasce e é validado no servidor; o client só renderiza e interage.
- **Fatias por domínio** (`src/features/<domínio>/`), arquivos pequenos e focados.
- **Fonte única de verdade:** schema Drizzle → tipos inferidos → schemas Zod nos limites → UI.

## 2. Stack · 🟢 definido (2026-11-20)

| Camada | Escolha | Versão instalada |
|---|---|---|
| Framework | Next.js (App Router, Turbopack, **Cache Components** ligado) | 16.4.6 |
| UI runtime | React + **React Compiler** | 19.3.0 |
| Componentes | **shadcn/ui** estilo `base-nova` sobre **Base UI** (`@base-ui/react`) | shadcn 4.23 · Base UI 1.9 |
| Estilo | Tailwind CSS v4 (CSS-first) + `tw-animate-css` + `cn` | 4.3.3 |
| Ícones | `lucide-react` | 1.77 |
| Gráficos | **recharts** (pelo primitivo `chart` do shadcn) + KokonutUI `metric-card` e `spending-ring` (D17), adaptados | recharts 3.8.0 · react-is 19.3.0 (exatos) |
| Banco | **Neon** (Postgres serverless) | driver `pg` 8.23 + `@vercel/functions` 3.11 (D18) |
| ORM / migrações | **Drizzle ORM** + drizzle-kit | 0.45.4 · 0.31.11 |
| Lint/format | **Biome** | 2.4.2 |
| Gerenciador | **Bun** | 1.3.3 |
| Validação | **Zod 4** (env de acesso, contratos das Server Actions) | 4.x |
| Testes (unidade, integração, componente) | **Vitest** (projects `node` e `dom`) + jsdom + Testing Library + **PGlite** (Postgres em processo, com as migrações reais) | Vitest 5.1.1 · jsdom 28 (sem `matchMedia`: polyfill em `test/setup-dom.ts`) · Testing Library react 16.3 · PGlite 0.5.17 |
| Testes E2E | **Playwright** (Chromium) + PGlite servido por **pglite-socket** | Playwright 1.65.1 · pglite-socket 0.2.20 |
| CI | **GitHub Actions** (`.github/workflows/ci.yml`): tipos, lint, Vitest e E2E em todo PR e push na `main` | Ubuntu · Bun 1.3.3 · Node 22 |
| Auth | **Better Auth** (adapter Drizzle) + plugin **passkey** | better-auth 1.7.27 · @better-auth/passkey 1.7.27 |
| Monitoramento de erros | **Sentry** (`@sentry/nextjs`), desligado sem `NEXT_PUBLIC_SENTRY_DSN`; um ponto de captura (`logServerError`) + `onRequestError`; `scrubEvent` antes do envio (Fase 6) | 11.18.0 (exata) |
| Hospedagem | *🟡 provável Vercel (par natural de Next + Neon) — confirmar* | — |

## 3. Princípios de domínio · 🟢 definido

1. **Passagem confirmada não muda em silêncio (D13).** Até a confirmação do recebimento, quem
   entregou corrige livremente. Depois, só o administrador corrige, com motivo obrigatório, e
   cada correção fica registrada (valor antigo, novo, quem, quando); a passagem exibe "corrigida".
   É o que torna o histórico confiável para o dashboard e para quem confirmou.
2. **Capturar uma vez, contar sempre.** O que a pessoa preenche na passagem **é** o dado do
   dashboard — não existe etapa de consolidação manual (o defeito nº 1 da planilha).
3. **Item tem nome canônico.** Cada item contável (redes, fitas, stretch…) existe uma vez, com
   unidade; telas e relatórios leem o mesmo registro (o defeito nº 3 da planilha).
4. **Janelas de tempo pelo calendário,** no fuso da operação (`America/Sao_Paulo`), nunca
   ancoradas no "último registro" (o defeito nº 6).
5. **Pessoas são escolhidas, não digitadas** (o defeito nº 8).

## 4. Estrutura de pastas · 🟢 definido

```
src/
  app/                    rotas (App Router); entry files em minúsculo (page.tsx, layout.tsx)
  components/
    ui/                   primitivos shadcn (kebab-case, mantidos pelo CLI)
    <área>/               componentes de aplicação compartilhados (PascalCase)
  features/
    <domínio>/            fatia vertical: queries, actions, schemas Zod, componentes do domínio
  db/
    index.ts              singleton do pool + db (server-only)
    client.ts             createPool/createDb (sem server-only: scripts e E2E)
    types.ts              Db (tipo comum a pg e PGlite)
    schema/               tabelas por área (sectors, auth, invites) + index.ts
  lib/                    utilitários puros (camelCase)
    auth/                 Better Auth: createAuth, env, erros, cliente, sessão
drizzle/                  migrações SQL geradas (versionadas)
test/                     helpers do Vitest (PGlite, fixtures, auth de teste)
e2e/                      Playwright (banco efêmero, autenticador virtual, specs)
scripts/                  scripts do desenvolvedor (admin:invite, db:hosts)
.context/                 documentação viva do projeto
```

## 5. Banco de dados e conexão · 🟢 definido

- **Neon** com duas connection strings, resolvidas por `src/db/databaseUrl.ts`: **com pooler**
  para a aplicação e **direta** para o drizzle-kit. Aceita as duas convenções de nome —
  `DATABASE_URL` (direta) + `DATABASE_URL_POOLED` (a do `.env.local` atual) e `DATABASE_URL`
  (pooler) + `DATABASE_URL_UNPOOLED` (a do `neon env pull`). **`sslmode=verify-full`** nas duas
  (o `pg` v9 rebaixa `require` para a semântica do libpq, sem verificar o certificado) e
  **channel binding** ligado no pool (`enableChannelBinding: true` — o `pg` ignora o
  `channel_binding=require` da URL).
- **Branches do Neon:** o `.env.local` aponta para a branch de **desenvolvimento**
  (`sa-east-1`). A branch **production** só existe nas variáveis da Vercel —
  migração local nunca toca produção. Migração nova é testada na branch de desenvolvimento antes
  de ir para produção (recomendação da skill `neon-postgres`).
- **Driver (D18): `node-postgres` (`pg`)** com `Pool` (`max: 10`) + **`attachDatabasePool`**
  (`@vercel/functions`, libera conexões ociosas antes de a função suspender no Fluid compute),
  com `db.transaction()` interativa — exigida por entregar, corrigir e mudar status. Em dev o
  pool fica no `globalThis` (o HMR não abre pool novo a cada edição). **Nos testes, PGlite**
  (Postgres em processo), com a mesma API de transação e as migrações reais.
- `src/db/index.ts` importa `server-only`: importar o banco num Client Component quebra o build.
- **Migrações:** `bun run db:generate` → revisar o SQL em `drizzle/` → `bun run db:migrate`.
  `db:push` só em banco de dev descartável.

## 6. Modelo de dados · 🟡 em construção (acesso, convite, cadastros, passagem e solicitações ✅ até a Fase 4)

Entidades que as decisões já implicam: **setor**, **turno** (por setor, com horário — D9),
**item** (por setor, com unidade e tipo controle/estoque — D1), **destino** de solicitação (D7),
**passagem** (setor + turno + dia operacional, única; quem entregou; confirmação de quem recebeu
— D5), **valores da passagem por item** (quantidade + observação, com nome e unidade do item
**congelados** na entrega — D1), **solicitação** + **histórico de status** + **comentários**
(D6–D8), e as tabelas do Better Auth + **convite** (D2–D4). Sem fotos (D10).

**Tabelas criadas até a Fase 4** (migrações versionadas em `drizzle/`):

| Tabela | O que guarda | Chave |
|---|---|---|
| `sector` | setor: `name` único sem diferença de caixa (índice `sector_name_lower_uq` em `lower(name)`), `active` | `uuid` |
| `user` | pessoa (Better Auth) + `role` (`admin`/`operator`), `sector_id` (FK `sector`, `restrict`), `deactivated_at`; checks `user_operator_needs_sector` (operador exige setor) e `user_role_valid` (papel só `admin` ou `operator`) | `text` |
| `session`, `account`, `verification`, `passkey`, `rate_limit` | tabelas do Better Auth, cópia fiel da CLI 1.7.27 | `text` |
| `invite` | convite: `token_hash` único, `role`, `sector_id`, `invitee_label`, `invited_by`, `expires_at`, `used_at`, `used_by`, `cancelled_at`; checks `invite_operator_needs_sector` e `invite_role_valid` | `uuid` |
| `shift` | turno de um setor: `name`, `starts_at` e `ends_at` (`time`; atravessar a meia-noite é permitido), `sort_order`, `active`; índice único `(sector_id, lower(name))`; check `shift_starts_ne_ends` | `uuid` |
| `item` | item de um setor: `name`, `unit` (texto: a unidade da lista ou o "Outro" digitado), `kind` (`control` ou `stock`; check `item_kind_valid`), `sort_order`, `active`; índice único `(sector_id, lower(name))` | `uuid` |
| `destination` | destino de solicitação, global: `name`, `active`; índice único `lower(name)` | `uuid` |
| `handover` | passagem: `sector_id`, `shift_id`, `operational_date` (`date`, o dia em que o turno **começou**), `status` (`draft`, `delivered` ou `confirmed`), `shift_name_snapshot`, `occurrences_text`, `next_shift_text`, `delivered_by`/`delivered_at`, `confirmed_by`/`confirmed_at`, `confirmation_note`, `updated_by`/`updated_at` (alimentam "Salvo às HH:mm por {nome}"); único `(sector_id, shift_id, operational_date)`; índice `(sector_id, operational_date)` para o histórico e um índice por FK; checks `handover_status_valid`, `handover_confirmer_ne_deliverer` (quem confirma não é quem entregou) e `handover_state_consistent` (rascunho sem entrega nem confirmação; entregue com entrega e sem confirmação; confirmada com os quatro campos) | `uuid` |
| `handover_item` | valor de um item na passagem: `quantity` (inteiro ≥ 0, check `handover_item_quantity_nonneg`; o teto de 99.999 é do domínio), `note`, `item_name_snapshot`, `item_unit_snapshot`, `item_kind_snapshot` (congelados na entrega, D1); check do tipo do snapshot | `(handover_id, item_id)` |
| `handover_correction` | uma linha por campo corrigido depois da confirmação (D13): `field` (`occurrences_text`, `next_shift_text`, `item_quantity` ou `item_note`), `item_id` (só nos campos de item, check `handover_correction_item_matches_field`), `old_value`, `new_value`, `reason` (não vazio), `corrected_by`, `corrected_at` | `uuid` |
| `request` | solicitação: `sector_id`, `destination_id` (destino da lista) **ou** `destination_other` (o "Outro" digitado; exatamente um dos dois, check `request_destination_exactly_one`), `description`, `status` (`requested`, `in_transit`, `delivered` ou `cancelled`), `created_by`, `created_at`, `status_changed_at` (alimenta "parada" e "dias no status"), `origin_handover_id` (a passagem em cujo formulário ela nasceu, opcional); checks `request_status_valid`, `request_destination_exactly_one`, `request_destination_other_not_blank`, `request_description_not_blank` e `request_status_changed_after_created`; índices por (setor, status, `status_changed_at`), (setor, `created_at`) e um por FK | `uuid` |
| `request_item` | item pedido: `quantity` (inteiro > 0, check `request_item_quantity_positive`; o teto de 99.999 é do domínio), `item_name_snapshot` e `item_unit_snapshot` (nome e unidade congelados na criação: "12 rolos" precisa da unidade da época) | `(request_id, item_id)` |
| `request_status_event` | uma linha por mudança de status (D8): `from_status` (nulo só na criação), `to_status`, `changed_by`, `changed_at` e `seq` (identity `ALWAYS`: a ordem total dos eventos é `changed_at, seq`, nunca o `id`); checks `request_status_event_from_valid`, `request_status_event_to_valid`, `request_status_event_changes` (`from` ≠ `to`) e `request_status_event_creation_requested` (sem `from` só para `requested`) | `uuid` |
| `request_comment` | comentário: `author_id`, `body` (não vazio), `deleted_at` (apagar é só `UPDATE … SET deleted_at`), `status_event_id` (único): o comentário que é o **motivo de um cancelamento** fica ligado ao evento e não se apaga (check `request_comment_reason_not_deleted`) | `uuid` |

As tabelas do Better Auth usam `timestamp` sem fuso (é o que a CLI gera); as do domínio (`sector`, `invite`, `shift`, `item`, `destination` e as da passagem e das solicitações) usam `timestamptz`.

- **Horário de turno** é `time` (sem fuso: o relógio da parede do setor) e trafega no app como texto `"HH:mm"`; o banco devolve `"HH:mm:ss"`.
- **Nome único sem diferença de caixa** vale por índice em `lower(name)`: global em `sector` e `destination`, por setor em `shift` e `item`. O domínio normaliza o nome (NFC, `trim`, espaços colapsados) antes de gravar.
- **Nada se apaga:** o cadastro só desativa (`active = false`); as listas de escolha das fases seguintes usam só os ativos, e as FKs para `sector` são `restrict`.

- **Datas da passagem:** `operational_date` é `date` e trafega como texto `"YYYY-MM-DD"` (o dia operacional de um turno que atravessa a meia-noite é o dia em que ele **começou**); `delivered_at`, `confirmed_at` e `updated_at` são `timestamptz`. O fuso da operação é `America/Sao_Paulo`, calculado com `Intl` (`src/features/handovers/saoPaulo.ts`), sem somar offset fixo.
- **Nada é apagado nem sobrescrito em silêncio:** as FKs da passagem são `restrict`; nome e unidade do item e o nome do turno ficam **congelados** na entrega (renomear o cadastro depois não muda a passagem) e, depois da confirmação, só `handover_correction` registra mudança.

**Solicitações (Fase 4):**

- **Solicitação não se edita (D-F4-1).** Depois de criada, só muda o status e recebe comentários; erro de digitação se corrige por comentário, ou cancelando com motivo e criando outra. Nenhuma função faz `UPDATE` de `description`, `destination_id`, `destination_other` ou `origin_handover_id`, e `request_item` só recebe `INSERT` na criação.
- **Status só muda com evento (D8).** `moveRequest` e `cancelRequest` fazem `UPDATE request … WHERE id AND status = <o que a pessoa viu>` e `INSERT request_status_event` na mesma transação; cancelar grava também o motivo como comentário ligado ao evento. Qualquer status vai para qualquer outro (reabrir é mover).
- **"Parada"** é solicitação aberta (`requested` ou `in_transit`) há mais de 72 h no status (intervalo, sem fuso); "dias no status" é `floor` das 24 h completas, nunca negativo. A conta mora no SQL, com o `now` injetado, e tem teste de paridade com `features/requests/stale.ts`.
- **A passagem mostra solicitações em dois momentos (D-F4-2).** O formulário do rascunho lista as abertas **agora**; o resumo (entregue ou confirmada) lista as que estavam abertas **no instante `delivered_at`**, com o status daquele instante calculado pelos eventos (sem tabela de snapshot) e "Agora: …" quando mudou depois.
- **Janelas e escopo:** Quadro e Lista mostram Entregue e Cancelada só dos últimos 30 dias (sem período escolhido); a Tabela é o arquivo (paginada, sem janela). Operador só enxerga o próprio setor; setor inativo é só leitura.

**Dashboard (Fase 5):** nenhuma tabela, coluna ou índice novo e nenhuma migração: o dashboard e o CSV só leem.

- **Valor vigente.** A quantidade lida é `handover_item.quantity` (a correção grava no lugar); `handover_correction` é só auditoria e não entra em soma nenhuma. Nome, unidade e tipo do item vêm dos snapshots (`item_*_snapshot`), o nome do turno de `shift_name_snapshot`.
- **Uma fonte para os números e a lista.** Esperadas, situações e "sem passagem" saem só de `historySource`/`historyPairsSql` (`features/handovers/history.ts`), a mesma fonte da lista `/passagens` e do CSV; por isso o número do dashboard é o total da lista que o link abre. A coluna `expected` da fonte marca o par encerrado (turno ativo × dia, setor ativo, dia ≥ criação do turno, fim ≤ agora em São Paulo). Herda P34.
- **Solicitações.** Abertas e paradas valem **agora**; "entregues no período" conta pela **primeira** entrega (`min(changed_at)` do evento `delivered`, no dia de São Paulo); a quantidade pedida soma por item das solicitações **criadas** no período, sem as canceladas.

## 7. Autenticação e autorização · 🟢 implementado na Fase 1 (Apple na Fase 6)

- **Better Auth** (self-hosted, adapter Drizzle, tabelas no mesmo Neon).
- **Cadastro só por convite.** O bloqueio mora num ponto único:
  `databaseHooks.user.create.before` recusa a criação de usuário sem convite válido — vale para
  e-mail e para os provedores sociais. Nos provedores sociais, `disableImplicitSignUp: true`
  (login social de quem não tem conta não cria conta; o cadastro chama `requestSignUp: true`
  a partir da página do convite).
- **Métodos:** e-mail + senha · Google · Apple · Facebook · **passkey** (`@better-auth/passkey`;
  a pessoa registra a passkey depois do primeiro login e passa a entrar com ela).
- **Exigências externas:** Apple exige Apple Developer Program e domínio HTTPS (não testa em
  localhost); Facebook exige app da Meta publicado com política de privacidade e instrução de
  exclusão de dados; "esqueci a senha" exige um provedor de e-mail transacional. Ver
  `pendencias.md` P6–P8.
- **Convite (D3):** um por pessoa, **uso único**, expira em **7 dias**, carrega **setor e papel**,
  cancelável, guarda quem convidou. O token do convite é **aleatório e opaco** (nunca um id
  sequencial) e é guardado **com hash** no banco. O primeiro convite (administrador inicial) sai
  de um script do desenvolvedor.
- **Papéis (D4):** `admin` e `operator`. Toda leitura e escrita de operador é **escopada pelo
  setor dele no servidor** (nunca pelo filtro da tela). Só `admin` convida, desativa e mexe em
  setores e itens. Usuário desativado não loga, mas continua referenciado pelas passagens.

### Como ficou implementado (Fase 1)

- **Fábrica única.** `createAuth(db, env)` (`src/lib/auth/createAuth.ts`) monta o Better Auth; o app (`src/lib/auth/index.ts`, `server-only`), os testes (`test/auth.ts`) e o E2E usam a mesma fábrica. O env passa por `parseAuthEnv` (Zod): `BETTER_AUTH_SECRET` (mínimo 32 caracteres) e `BETTER_AUTH_URL` são obrigatórios e **o `next build` falha sem eles**; Google e Facebook só ligam com `*_CLIENT_ID` + `*_CLIENT_SECRET` (os dois ou nenhum).
- **Ids.** As tabelas do Better Auth usam `text` (32 caracteres gerados pela lib); as do domínio usam `uuid`. `user.sector_id` é `uuid` com FK para `sector`, por isso o schema de auth é escrito à mão em `src/db/schema/auth.ts` (copiando a saída da CLI `auth generate` 1.7.27) e um teste guarda, com `getAuthTables`, prova que ele bate com o que a lib espera.
- **Consumo do convite.** No `databaseHooks.user.create.before`: `UPDATE invite SET used_at … WHERE token_hash = … AND used_at IS NULL AND cancelled_at IS NULL AND expires_at > now RETURNING role, sector_id` (atômico no banco). O hook injeta `role` e `sector_id` (`inviteSignupData`) e **não** mexe em `emailVerified`: fica `false` no cadastro por e-mail e senha e com o valor do provedor no login social, porque o convite não é atrelado a um endereço; `user.create.after` grava `used_by`. O cadastro por e-mail checa e-mail repetido **antes** do hook, então e-mail já cadastrado não gasta convite. Sem `ctx` (fora de uma requisição) o hook recusa (fail-closed). Todo erro de hook é `APIError` com `code` (`SIGNUP_INVITE_ONLY`, `ACCOUNT_DEACTIVATED`).
- **Cookie `closery_invite`.** Token bruto, `httpOnly`, `SameSite=Lax` (volta no callback OAuth), `Secure` em produção, `path=/`, 1 h. Só a Server Action `armInvite` grava; a página `/convite/[token]` apenas lê (prefetch e scanner de link não gastam convite). A rota responde com `Referrer-Policy: no-referrer`.
- **Sessão renovada pelo navegador.** `SessionKeepAlive` (cliente, no layout `(app)`) chama `authClient.getSession()` uma vez ao montar: o `GET /api/auth/get-session` regrava banco e cookie juntos quando a sessão passa do `updateAge` (1 dia). O servidor só lê: `getAuthz` passa `query: { disableRefresh: true }`, porque Server Component descarta o `Set-Cookie` e uma renovação ali estenderia o banco sem renovar o cookie (e a chamada HTTP seguinte nunca mais renovaria). Sessão continua em 7 dias; quem usa o app não é deslogado 7 dias após o login.
- **Sem `cookieCache`.** A sessão é lida do banco a cada requisição (`getAuthz`, com `cache()` do React) para que desativação e mudança de papel ou setor valham na hora; `session.create.before` barra usuário desativado em e-mail, social e passkey. Sem `nextCookies()`: cadastro e login vão pelo `authClient` (HTTP), onde o rate limit atua.
- **Rate limit** do Better Auth com `storage: "database"` (tabela `rate_limit`), ligado só em produção: `/sign-in/email` 30 por 60 s e `/sign-up/email` 10 por 60 s (`customRules` da `createAuth`); os demais `/sign-in*` e `/sign-up*` (social) seguem o padrão do Better Auth, 3 por 10 s; os endpoints de passkey ficam em `/passkey/*` e caem no padrão geral de 100 por 10 s. A janela conta a partir da **última** requisição permitida (cada requisição aceita move `lastRequest`). IP: sem `trustedProxies`, o Better Auth só confia em `x-forwarded-for` quando ele tem **um único valor**; com vários valores todos caem num balde compartilhado por caminho (`no-trusted-ip|<path>`); na Vercel o cabeçalho tem um valor só. No bloqueio (429) a tela mostra `Muitas tentativas nesta rede. Espere um minuto e tente de novo.` (código `RATE_LIMITED`, deduzido de `status === 429` em `errorCodeOf`).
- **Autorização.** `toAuthz` (puro) produz `Authz`; `requireUser()` redireciona para `/entrar`; `requireAdmin()` chama `notFound()` para operador, que vê "Página não encontrada" (com streaming o status HTTP é 200 e o HTML traz `noindex`; `/admin` não exporta `metadata`, para o `<title>` não revelar a rota); `scopeToSector(authz, coluna)` escopa as queries por setor. `src/proxy.ts` só faz o redirecionamento otimista pelo cookie; a regra real vive no servidor. Regra do grupo `(app)`: toda página ou folha do grupo `(app)` que mostra ou lê dados chama `requireUser`/`requireAdmin` dentro de `<Suspense>` (o layout não protege a página: o Next roda a página mesmo que o layout troque o conteúdo, e o layout não re-renderiza na navegação no cliente); `src/app/appPagesAuth.test.ts` reprova página sem a chamada; toda Server Action e todo route handler autoriza por conta própria (`requireUser`/`requireAdmin` ou `getAuthz`, e `scopeToSector`/`canAccessSector`), porque podem ser chamados de qualquer rota e `/api` não passa pelo proxy.
- **Passkey.** `rpID` e origem vêm de `BETTER_AUTH_URL` (passkey de `localhost` não vale em produção); criada em `/bem-vindo` ou `/conta` (exige sessão recente); login pelo autofill do campo de e-mail e pelo botão "Entrar com passkey".
- **Redefinição de senha pelo administrador (Fase 6, D-F6-2).** Sem e-mail transacional (P8), o admin gera o link em `/admin/equipe` (`createPasswordResetLinkAction`, `requireAdmin()` na primeira instrução; o domínio `createPasswordResetLink` confere o papel de novo). O token (`randomBytes(32)`, base64url) vai pelo `internalAdapter.createVerificationValue` do Better Auth como `reset-password:<token>` com `value = userId` e **só o hash** fica no banco (`verification.storeIdentifier`); vale **24 h**, uso único, e o link novo derruba o anterior. Desativar a pessoa apaga as `verification` dela (`setPersonActive`, na mesma transação), então reativar não ressuscita um link que circulava. A URL é `/redefinir-senha#token=…`: o token fica no **fragmento**, que o navegador nunca envia (fora do log da Vercel e do `Referer`; a rota ainda manda `Referrer-Policy: no-referrer`). A página pública e estática `ResetPasswordForm` lê o fragmento, apaga-o da barra e chama `POST /api/auth/reset-password`; o Better Auth troca a senha (cria a conta `credential` de quem só tinha passkey) e revoga todas as sessões (`revokeSessionsOnPasswordReset`). Admin pode gerar para si e para outro admin; não para conta desativada. **Exceção à regra de `db.transaction()`:** a criação passa pelo adapter do Better Auth, que não entra numa transação nossa; por isso o domínio apaga os links antigos **antes** de criar o novo (falha fechado). Risco residual: o link fica no histórico do WhatsApp por até 24 h (8 h é uma constante só) e não há registro de quem gerou o link de quem (P76).
- **Primeiro administrador.** `bun run admin:invite --confirmar-host=<host>` (`scripts/adminInvite.ts`) gera o link do convite de administrador. **Trava de host (Fase 6):** antes de qualquer escrita o script imprime só `Banco de destino: <host>` e `BETTER_AUTH_URL:  <url>` e exige a flag igual ao host que ele vai usar (o do pooler, se houver; comparação exata, sem diferença de caixa); sem a flag ou com host diferente sai com `Erro: …`, código 1, sem abrir conexão. Vale também em desenvolvimento. O script não recusa um segundo administrador: é o caminho de recuperação se o único admin perder o acesso; a defesa é a trava de host e o convite de uso único por 7 dias. `bun run db:hosts` imprime o host da aplicação e o das migrações (o `drizzle-kit` não tem trava): é a conferência antes do `db:migrate` de produção.
- **Vínculo de contas desligado.** `account.accountLinking.disableImplicitLinking: true`: o e-mail de quem cadastrou por e-mail e senha não é verificado, e vincular login social pelo e-mail abriria tomada de conta. Quem criou conta por e-mail e tenta Google recebe `account_not_linked` ("Entre como da primeira vez").
- **Erros do WebAuthn.** O cliente de passkey repassa o código do `@simplewebauthn/browser` (fechar o diálogo = `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`); `passkeyErrorCode` (`src/components/auth/passkeyErrorCode.ts`) traduz para `AUTH_CANCELLED`/`REGISTRATION_CANCELLED`/`PREVIOUSLY_REGISTERED` antes do mapa de mensagens.

### Como ficou implementado (Fase 2)

- **Portão em três camadas.** (1) Toda página de `src/app/(app)/admin/**` chama `requireAdmin()` por um componente importado de `@/components/...` (guarda `appPagesAuth.test.ts`, mínimo de 9 páginas). (2) Toda Server Action exportada de `src/app/(app)/admin/**/actions.ts` chama `requireAdmin()` na primeira linha (guarda `actionsAuth.test.ts`; `actionsInventory.test.ts` fixa as 18 actions dos 5 arquivos). (3) O domínio (`src/features/admin/*`) não confia na tela e revalida a regra de negócio: setor ativo, autoedição e último administrador.
- **Resultado tipado.** O domínio devolve `AdminResult` (`{ ok: true, … }` ou `{ ok: false, code, message, fieldErrors? }`) com mensagem pt-BR pronta, nunca texto do banco. `runAdminAction` faz Zod → domínio → `revalidatePath("/(app)/admin", "layout")` só em sucesso (com route group o caminho é o do arquivo); exceção inesperada vira `INTERNAL`, e `redirect`/`notFound` passam intactos (`unstable_rethrow`).
- **Equipe.** `updatePerson` muda papel e setor juntos numa transação (operador exige setor ativo; admin grava `sector_id = null`). Nunca se desativa nem se rebaixa o **último administrador ativo**: dentro da transação, `SELECT … FOR UPDATE` nos administradores ativos serializa dois admins que se desativam ao mesmo tempo. Ninguém desativa nem rebaixa a **própria** conta (`SELF_CHANGE`). Desativar apaga as sessões da pessoa na mesma transação (P11). Mudar papel ou setor não encerra sessões: a sessão é lida fresca e vale na próxima requisição.
- **Convites do admin.** `createTeamInvite` usa `createInvite` com `invitedBy` = admin atual e devolve o link **uma vez** (só o hash fica no banco; link perdido = cancelar e gerar outro). `cancelInvite` é um `UPDATE … WHERE` condicional: só cancela convite ainda pendente.
- **Desativar setor.** Setor com pessoa ativa ou convite pendente (válido) **não** desativa (`SECTOR_IN_USE`, com as contagens). Turno, item e convite não nascem em setor inativo.
- **Sem `layout.tsx` e sem `metadata` em `/admin`.** Um layout renderizaria a navegação do admin para o operador antes do `notFound()` da página, e o `<title>` revelaria a rota. Cada página tem o link "Voltar para Administração"; a sidebar já marca "Administração" ativa nas subrotas.

### Como ficou implementado (Fase 3)

- **Portão em três camadas.** (1) Toda página de `src/app/(app)/**` chama `requireUser()` ou `requireAdmin()` por um componente importado de `@/components/...`; as páginas sob `admin/` só valem com `requireAdmin` (P27; guarda `appPagesAuth.test.ts`, mínimo de 12 páginas). (2) Toda Server Action exportada chama `requireUser()` (ou `requireAdmin()`) como **primeira instrução**; `src/app/actionsGuards.test.ts` varre todo arquivo de `src` com `"use server"` (de arquivo ou inline), exige que se chame `actions.ts` sob `src/app/(app)/**` (exceção documentada: `(auth)/convite/[token]/actions.ts`) e que `admin/**` use `requireAdmin()`. (3) O domínio não confia na tela: revalida escopo de setor, papel, estado e limites, e o operador que monta a URL ou a action de outro setor recebe `NOT_FOUND` ("Página não encontrada"), nunca "sem permissão" (não revela o que existe).
- **GET nunca escreve.** Abrir, recarregar e pré-carregar `/passagens/nova` não cria linha: o rascunho nasce no primeiro salvamento. A identidade do rascunho é a tripla setor + turno + dia operacional (nunca um id que o cliente teria de guardar); criar é `INSERT … ON CONFLICT DO NOTHING RETURNING` e, se não voltou linha, `SELECT … FOR UPDATE` da existente.
- **Quem edita (`handoverCapabilities`, função pura usada pelo domínio e pela tela):** rascunho = qualquer pessoa do setor e o admin; entregue = só quem entregou e o admin, direto (sem linha de correção); confirmada = o salvamento automático recusa todos, inclusive o admin (`HANDOVER_LOCKED`); só `correctHandover` (admin, com motivo) altera.
- **Transições** são `UPDATE … WHERE status = '<esperado>'` conferindo as linhas afetadas, dentro de `db.transaction()` e com a linha travada por `FOR UPDATE` antes de decidir a mensagem; a corrida perdida devolve quem venceu e quando. O PGlite não prova concorrência: a atomicidade vai no SQL e o teste prova a invariante em sequência.
- **Entregar** cria o rascunho se faltar, completa com `0` os itens ativos e congela os snapshots de todas as linhas. **Receber:** o cartão do Início é a passagem mais recente do setor entre as entregues e as confirmadas (`delivered_at desc, id desc`); só aparece se ela ainda estiver entregue e não for de quem olha (uma confirmada mais nova esconde as entregues antigas), sem cair para outra e sem teto de idade (P35). **Corrigir:** o servidor calcula o diff (`diffHandover`) e grava uma linha de `handover_correction` por campo alterado, na mesma transação.
- **Turno sugerido (spec §6.2):** `suggestShift` escolhe o turno ativo cujo fim está mais próximo de agora (entre as ocorrências que começam ontem ou hoje: um turno que só começa amanhã não pode ter passagem e a data seria recusada); empate: o que já terminou, depois a ordem do setor.
- **Histórico `/passagens`:** uma consulta SQL (`generate_series` × turnos ativos de setores ativos, `NOT EXISTS`, `UNION ALL` com as passagens reais), paginada por linhas (50). Situações `awaiting`, `confirmed`, `unconfirmed` e `missing`, mais o selo "Corrigida"; passagem já entregue de turno depois desativado continua no histórico (só os pares "sem passagem" exigem turno ativo). "Sem passagem" só existe para pares já encerrados e a partir do dia em que o turno foi criado (P34).
- **Setor do admin:** `?setor=` na URL e o cookie `closery_setor`, gravado só pela Server Action `chooseSectorAction` e lido dentro de `<Suspense>`; "Todos os setores" (só no histórico) não grava o cookie.

### Como ficou implementado (Fase 4)

- **Portão em três camadas, de novo.** (1) `appPagesAuth.test.ts` passa a guardar 15 páginas (as de `solicitacoes/` e a interceptada `@detalhe/(.)solicitacoes/[id]`) e tem uma lista fechada `NULL_SLOT_PAGES` (`@detalhe/page.tsx` e `@detalhe/[...catchAll]/page.tsx`): páginas de slot que só devolvem `null` (o teste `rendersNothing` confere); uma página nula fora da lista reprova. (2) `MIN_APP_ACTION_FILES` sobe para 3: `solicitacoes/actions.ts` chama `requireUser()` na primeira instrução de cada função e passa pelo `runAction`. (3) O domínio revalida escopo de setor, setor ativo, destino ativo, item de estoque ativo do setor, passagem de origem não confirmada, status esperado e limites.
- **Quem pode o quê:** criar, mover, cancelar e comentar = qualquer pessoa do setor e o admin; apagar comentário = só o autor, só o próprio, nunca o motivo de cancelamento (nem o admin apaga o de outra pessoa). Operador que monta a URL ou a action de outro setor recebe `NOT_FOUND` ("não encontrada"), nunca "sem permissão". Setor inativo: toda escrita devolve `SECTOR_INACTIVE` e a tela só lê.
- **Escrita serializa com a desativação do setor:** toda escrita lê o setor com `FOR SHARE` dentro da transação (`lockSectorShare`), o mesmo padrão da Fase 2 (`library-docs.md §5`).

### Como ficou implementado (Fase 5)

- **Portão em quatro camadas.** (1) `appPagesAuth.test.ts` passa a guardar 16 páginas (a de `/dashboard` entra). (2) Nenhuma Server Action nova (`chooseSectorAction` só ganhou o campo `query`). (3) **Todo `route.ts` fora da lista fechada** `PUBLIC_ROUTE_HANDLERS` (`api/auth/[...all]` e `api/health`) exporta só `GET` e chama `requireUser()`/`requireAdmin()` como primeira instrução, sem `"use cache"`: guarda `src/app/routeHandlersAuth.test.ts`. O `/api` não passa pelo proxy, então o handler se autentica sozinho. (4) O domínio não confia na tela: cada função de `features/dashboard/*` refaz o escopo com `sectorScopeOf`, exige setor ativo e ignora o `?setor=` do operador (que vê o próprio setor, no dashboard e no CSV).
- **Escopo único.** `resolveDashboardScope` (por cima de `resolveScreenSector`) resolve setor e período para a página e para o CSV; o padrão do admin é o setor do cookie (ou o primeiro ativo) e "Todos os setores" só com `?setor=todos`.
- **GET nunca escreve.** Nenhuma função da fase faz `INSERT`/`UPDATE`/`DELETE`; o dashboard nunca toca `handover`, `handover_item` ou `handover_correction`.
- **Período.** `?periodo=7|30|intervalo&de=&ate=`, no calendário de São Paulo, máximo de 93 dias, com o mesmo `parseHistoryPeriod` do histórico; o período anterior são os N dias imediatamente antes. O rótulo (`últimos 7 dias · 14–20 nov`) é `formatPeriodLabel`, texto sobre texto ISO, sem `Date`.
- **Todo número é um link** (D-F5-3) para a lista que conta exatamente aquilo, gerado por `features/dashboard/links.ts`; os filtros que faltavam nasceram na fase: em `/passagens` as situações `entregues` e `esperadas` e o `item=`; em `/solicitacoes` `status=`, `parada=1`, `entrega=` (com `entrega_de`/`entrega_ate`) e `item=`. Teste de paridade: número × total da lista.
- **Blocos independentes.** A página é síncrona com uma `<Suspense>` externa (sessão e `searchParams`); cada bloco fica num `catchError` (`next/error`) com `key` do período e do setor e, dentro, a sua `<Suspense>` com esqueleto: um bloco que quebra não derruba os outros. `(app)/error.tsx` e `(app)/not-found.tsx` (P19) mantêm o shell.

## 8. Dados pessoais (LGPD) · 🟢 baseline

- O sistema guarda **nome e e-mail de funcionários**, **autoria de passagens** e **comentários**.
  Coletar só o necessário; nada de documento pessoal (CPF, RG) sem motivo explícito.
- **Nenhum dado real** da planilha original (nomes) entra em commit, seed, teste ou
  fixture — só dados fictícios.
- **Sem upload de arquivos** no MVP (D10) — nenhum armazenamento de mídia.

## 9. Rotas · 🟢 rotas das Fases 1 a 5 prontas (as seguintes entram a cada marco)

| Rota | O que é | Status |
|---|---|---|
| `/entrar` | login: e-mail e senha, passkey (autofill e botão), Google/Facebook se habilitados. Pública | ✅ Fase 1 |
| `/convite/[token]` | convite (válido, expirado, usado, cancelado, inexistente) + cadastro; `armInvite` grava o cookie. Pública | ✅ Fase 1 |
| `/redefinir-senha` | criar a senha nova com o link do administrador (`#token=` no fragmento; sem fragmento mostra "Link incompleto"). Estática e pública; `Referrer-Policy: no-referrer` | ✅ Fase 6 |
| `/bem-vindo` | oferta de passkey logo depois do cadastro | ✅ Fase 1 |
| `/` | Início: saudação, "Passagem para confirmar" (a mais recente entregue do setor, para quem não a entregou) e "Passagem do meu turno" (começar, continuar, entregue ou confirmada) e, depois deles, o cartão "Solicitações" (abertas, paradas e as paradas há mais tempo); o admin escolhe o setor (`?setor=`) | ✅ Fases 3 e 4 |
| `/conta` | passkeys (criar e remover) e "Sair" | ✅ Fase 1 |
| `/admin` | Administração: cinco cartões (setores, turnos, itens, destinos, equipe) com as contagens de ativos e pendentes; operador vê "Página não encontrada" | ✅ Fase 2 |
| `/admin/setores` | setores: criar, renomear, desativar e reativar (bloqueia com pessoas ou convites). Admin | ✅ Fase 2 |
| `/admin/turnos` | turnos por setor (`?setor=`): horário que pode passar da meia-noite, aviso de sobreposição, ordem por botões. Admin | ✅ Fase 2 |
| `/admin/itens` | itens por setor (`?setor=`): unidade por escolha com "Outro", tipo controle ou estoque, ordem por botões. Admin | ✅ Fase 2 |
| `/admin/destinos` | destinos de solicitação (valem para todos os setores). Admin | ✅ Fase 2 |
| `/admin/equipe` | pessoas (papel, setor, desativar) e convites (gerar, copiar ou compartilhar, cancelar); `?pagina=` pagina as pessoas e `?convites=` os convites pendentes. Admin | ✅ Fase 2 |
| `/passagens` | histórico de passagens, do dia mais recente ao mais antigo: filtros na URL (`periodo`, `de`, `ate`, `turno`, `situacao` (`todas`, `entregues`, `esperadas`, `aguardando`, `confirmada`, `nao-confirmada`, `sem-passagem`, `corrigida`), `item`, `setor`, `pagina`), situação de cada turno (aguardando, confirmada, não confirmada, sem passagem) e selo "Corrigida". Admin escolhe o setor ou "Todos os setores" | ✅ Fase 3 |
| `/passagens/nova` | formulário da passagem (`?turno=&data=&setor=`): salvamento automático, contadores −/+, a seção "Solicitações abertas" (as abertas de agora, com "Nova solicitação" ligada à passagem) e "Entregar turno". Já entregue ou confirmada redireciona para o resumo | ✅ Fases 3 e 4 |
| `/passagens/[id]` | resumo na ordem do briefing (com a seção "Solicitações abertas", as abertas na entrega, logo depois de "Fica para o próximo turno"), "Confirmar recebimento" e correções; `?editar=1` abre o formulário de edição (entregue) ou de correção com motivo (confirmada, só admin). Outro setor ou id inexistente: "Página não encontrada" | ✅ Fases 3 e 4 |
| `/solicitacoes` | solicitações do setor em três visões: Quadro (3 colunas com contagem do servidor e "Carregar mais"), Lista (4 grupos; padrão no celular) e Tabela (paginada); `?visao=quadro\|lista\|tabela`, filtros na URL (`destino`, `periodo`, `de`, `ate`, `criador`, `busca`, `status`, `parada`, `entrega`, `entrega_de`, `entrega_ate`, `item`, `setor`, `pagina`, `mais_<status>`). "Nova solicitação" abre um diálogo; "Mover para …" muda o status com o cartão trocando de coluna antes da resposta. Admin escolhe o setor ou "Todos os setores" | ✅ Fase 4 |
| `/solicitacoes/[id]` | página completa da solicitação (propriedades, itens, ações de status, "Cancelar solicitação" com motivo, linha do tempo e comentários; `?comentarios=50..500`). Outro setor ou id inexistente: "Página não encontrada" | ✅ Fase 4 |
| slot `@detalhe` (não é URL) | o detalhe rápido: clicar numa solicitação a partir de qualquer tela (Quadro, Lista, Tabela, formulário e resumo da passagem, Início) abre `/solicitacoes/[id]` num Sheet sobre a tela de baixo (rota interceptada `@detalhe/(.)solicitacoes/[id]`); recarregar ou abrir o link direto mostra a página completa | ✅ Fase 4 |
| `/api/auth/[...all]` | handler do Better Auth. Pública | ✅ Fase 1 |
| `/api/health` | `GET` — `select 1` dentro de transação; `200 {status:"ok"}` ou `503 {status:"error"}` sem detalhe (o erro vai só para o log). Pública | ✅ 2026-11-20 |
| `/dashboard` | dashboard de todos os papéis: período (`periodo`, `de`, `ate`) no topo, quatro blocos (Passagens com o anel de 4 fatias, Controles com um `metric-card` por item, Estoque com a última contagem e a linha do período, Solicitações com abertas, paradas, entregues e tempo até a entrega por destino) e "Exportar CSV"; todo número é um link para a lista filtrada. Operador vê o próprio setor; admin escolhe o setor ou "Todos os setores" (`setor`) | ✅ Fase 5 |
| `/api/dashboard/export` | `GET` autenticado (`requireUser` na primeira instrução): CSV das passagens do período e do escopo da tela (`periodo`, `de`, `ate`, `setor`); UTF-8 com BOM, `;`, CRLF, sem injeção de fórmula; `404` sem setor e `413` acima de 10.000 linhas; sem sessão redireciona para `/entrar` (307) | ✅ Fase 5 |

Rotas públicas: `/entrar`, `/convite/[token]`, `/redefinir-senha`, `/api/auth/*` e `/api/health`. Todo o resto exige sessão (`src/proxy.ts` + `requireUser()`).

## 10. Log de evolução (ADR leve)

### 2026-11-20 — Scaffold e stack

- **Decisão:** Next.js 16 (App Router) único para front e back; shadcn `base-nova` (Base UI);
  Neon + Drizzle com driver `neon-http`; Bun; Biome. React Compiler e Cache Components ligados
  (padrão do `create-next-app` 16.4).
- **Por quê:** projeto pequeno — um app só elimina a camada de API separada que o klauve tem.
  Drizzle e Base UI repetem o que já se conhece do klauve. `neon-http` dispensa pool em serverless.
- **Trade-off aceito:** sem transação interativa no `neon-http` (usar `db.batch`). Reavaliar se um
  fluxo exigir.
- **Atualização (D18, 2026-11-20):** o brainstorm desenhou fluxos que leem e decidem dentro da
  transação; o trade-off do `neon-http` deixou de ser aceitável. Troca para `neon-serverless`
  + PGlite nos testes.
- **Correções no scaffold:** a fonte do shadcn lia `--font-sans`, mas o layout definia
  `--font-geist-sans` (variável circular → fonte padrão do navegador) — o layout passou a definir
  `--font-sans`. `lang` do HTML → `pt-BR`. Página inicial do template (cores cruas) trocada por um
  placeholder com tokens.

### 2026-11-20 — Neon ligado (D18 atualizada)

- **Decisão:** driver `pg` + `Pool` + `attachDatabasePool` em vez de `neon-serverless`.
- **Por quê:** a skill oficial do Neon (`neon-postgres`, plugin instalado pelo `neon init`) indica
  `node-postgres` com `attachDatabasePool` para Vercel Fluid compute; `@neondatabase/serverless`
  fica para edge/serverless sem pool reutilizável (ex.: Netlify). Os dois têm transação
  interativa, então nada do design muda. `@neondatabase/serverless` removido.
- **Env:** `.env.local` preenchido pelo dono (a CLI `neon` falhou no login — sessão expirada —,
  então `neon init`/`neon deploy` não rodaram; não existe `neon.ts`). `sslmode` trocado de
  `require` para `verify-full`.
- **Verificado:** `check-types` e `lint` limpos, `build` verde (`/api/health` dinâmica), app em
  produção respondendo `200` com o banco (874 ms na primeira conexão, ~25 ms com o pool aberto) e `503` sem detalhe com o
  banco inacessível; URLs com pooler e direta conectam com `verify-full`.
- **Branch de desenvolvimento (mesmo dia):** o dono criou uma branch de dev no Neon; o `.env.local`
  passou a apontar para ela (URL direta derivada da com pooler, sem o `-pooler`), com as URLs de
  produção **comentadas** no arquivo até irem para a Vercel. Channel binding ligado no pool.
  Verificado de novo: as duas URLs da branch conectam com `verify-full` + channel binding; `build`
  verde; `/api/health` 200 (168 ms na primeira conexão, 22 ms com o pool aberto).

### 2026-11-20 — Fase 0 + Fase 1: fundação de testes e acesso

- **Decisão:** Vitest 5 com dois projects (`node` para domínio e servidor, `dom` para componentes) e PGlite com as migrações reais (dump migrado uma vez por execução); Playwright com o app em `next build` + `next start` sobre PGlite servido por pglite-socket. Better Auth 1.7.27 com cadastro só por convite (cookie `closery_invite` + hook `user.create.before` que consome o convite com `UPDATE … RETURNING`), e-mail e senha, passkey e Google/Facebook condicionais ao env; papéis `admin`/`operator` escopados por setor no servidor.
- **Por quê:** o domínio recebe `db` por parâmetro, então os mesmos testes valem com PGlite e com `pg`; o convite consumido no banco é atômico e não depende de estado da aplicação; ler a sessão fresca do banco faz a desativação valer na hora (spec §4.1).
- **Trade-offs aceitos:** (1) PGlite tem uma conexão só e serializa tudo, então os testes provam lógica, SQL e constraints, **não** corrida; a atomicidade vem do `UPDATE … RETURNING` e é revisada na forma da query. (2) Sem `cookieCache`: uma ida ao banco por requisição em troca de desativação imediata. (3) O E2E compila e sobe o app de produção (cerca de 1 min), por isso o rate limit está ligado (cadastro: 10 por 60 s por IP) e cada teste usa um IP próprio. (4) Apple fica para a Fase 6 (P6); Google sem credenciais (P10), então o login social não tem teste ao vivo (checklist manual da spec §12).
- **Desvios e detalhes registrados:** (a) `/entrar` mostra o formulário de e-mail primeiro, e não a passkey como na spec §4.3: o autofill de passkey vive no campo de e-mail, então a passkey continua sendo a primeira oferta. (b) As tabelas do Better Auth usam `timestamp` sem fuso (fiel à CLI); o Drizzle grava `toISOString()` e lê como UTC, então não há deslocamento por fuso do processo. (c) `/admin` para operador responde 200 com "Página não encontrada" (streaming), não 404 de status. (d) `Db = PgDatabase<PgQueryResultHKT, Schema>`: a união `NodePgDatabase | PgliteDatabase` quebra `.returning({ … })`. (e) jsdom 28 (o 31 exige Node ≥ 22.22.2) e `package.json` com `"type": "module"`. (f) `check-types` = `next typegen && tsc --noEmit` e `.gitattributes` com LF.
- **Verificado:** `check-types`, `lint`, `test`, `test:e2e` (7 passed) e `build` verdes.

### 2026-11-21 — Fase 2: cadastros e equipe

- **Decisão:** seis telas em `/admin` (visão geral, setores, turnos, itens, destinos, equipe). Regra de negócio em funções de domínio que recebem `db` e `now` e devolvem `AdminResult`; lógica pura (nome, horário, sobreposição, unidade, paginação, reordenação) em módulos sem I/O; Server Action fina por página (`requireAdmin` → `runAdminAction`). Nada se apaga (só desativa); nome único sem diferença de caixa por índice em `lower(name)`; turnos avisam sobreposição (inclusive à meia-noite) sem bloquear; ordem de turnos e itens por botões ↑ ↓; unidade do item por escolha com "Outro"; desativar setor com gente é bloqueado; equipe com papel, setor, desativação e convites com link. Migração `0002_fase2_cadastros` (tabelas `shift`, `item`, `destination`, índices `lower(name)`, CHECKs de papel, tipo e horário).
- **Por quê:** a passagem de turno (Fase 3) precisa de setores, turnos e itens para escolher, e de um administrador que consiga gerir a equipe sem mexer no banco. Desativar em vez de apagar preserva o histórico das passagens futuras; bloquear a desativação de setor evita operador num setor inativo e convite órfão; o aviso (e não bloqueio) de sobreposição segue a spec §5.
- **Trade-offs aceitos:** (1) PGlite não prova concorrência: o "último admin" (`FOR UPDATE`) e o nome repetido (índice único) são garantidos no SQL e provados em sequência. (2) Lista em linhas, não tabela, para funcionar no celular. (3) ↑ ↓ andam entre ativos e inativos; se incomodar na Fase 3, mover só entre ativos. (4) Mudar papel ou setor não encerra sessões (só desativar encerra). (5) A sobreposição de turnos lê até 200 turnos ativos do setor. (6) O ator não é revalidado dentro da transação: um admin desativado milissegundos antes ainda pode concluir uma ação em curso (limite aceito).
- **Desvios e detalhes registrados:** (a) "mudar papel" e "mudar setor" viraram uma ação `updatePerson` ("Editar"): uma transação evita o estado "operador sem setor". (b) A linha da própria conta do admin não tem botões (botão que sempre falha é atrito); a regra continua no servidor. (c) Formulários controlados chamam a action com objeto tipado, em vez de `useActionState`, para a pessoa não perder o que digitou quando o servidor recusa. (d) O Drizzle 0.45 embrulha o erro do driver: SQLSTATE e nome do índice ficam em `error.cause`. (e) `time` volta como `"HH:mm:ss"`. (f) `db.select({ … })` sem `.from()` não executa nesta versão do Drizzle; a visão geral seleciona de uma tabela de uma linha (`values (1)`) com subconsultas `count(*)`. (g) Verificado no branch de dev do Neon: collation `C.UTF-8` e `lower('ÁGUA') = lower('água')`, então "Água" e "ÁGUA" colidem em produção como no PGlite.
- **Verificado:** `check-types`, `lint`, `test`, `test:e2e` (13 passed) e `build` verdes. P11 e P18 resolvidas; P23 (editar o nome de uma pessoa) e P24 (ordem alfabética ignora acento) registradas.

### 2026-11-21 — Fase 3: passagem de turno

- **Decisão:** a passagem de ponta a ponta — rascunho com salvamento automático, entregar, receber (confirmar), corrigir com motivo e histórico — em `/`, `/passagens`, `/passagens/nova` e `/passagens/[id]`. Regra de negócio em `src/features/handovers/*` (funções que recebem `db` e `now` e devolvem `AdminResult`); lógica pura (fuso, dia operacional, turno sugerido, quantidade, permissões, diff, filtros) sem I/O; Server Actions finas em `src/app/(app)/passagens/actions.ts` sobre o `runHandoverAction`, irmão do `runAdminAction` que **não** revalida no salvamento automático. Migração `0003_fase3_passagem` (`handover`, `handover_item`, `handover_correction`). Decisões do dono: solicitações ficam para a Fase 4; trocar turno ou data abre o rascunho daquele turno e dia; o admin escolhe o setor na tela (URL + cookie).
- **Por quê:** a passagem tem de ser mais rápida no sistema do que na planilha (regra de ouro): o formulário abre pronto (turno e dia sugeridos, números em `0`), salva sozinho e entrega com um toque; quem recebe lê o resumo na ordem do briefing e confirma com outro toque. Confirmada não muda em silêncio (D13): o servidor calcula o diff e grava o rastro, nunca o cliente. O histórico de "sem passagem" é uma consulta SQL, nunca subtração em JS.
- **Trade-offs aceitos:** (1) O PGlite não prova concorrência: a atomicidade (entregar, confirmar, corrigir) vai no SQL com `UPDATE … WHERE status = …` e `FOR UPDATE`, provada em sequência. (2) Dois operadores no mesmo rascunho: o último a salvar vence por campo, sem aviso (P36). (3) "Sem passagem" usa os horários atuais do turno e some quando o turno é desativado (P34). (4) O cartão "Passagem para confirmar" não tem teto de idade (P35). (5) O runner novo duplica cerca de 25 linhas do `runAdminAction` em troca de não mexer na Fase 2 junto de uma feature (P33). (6) O E2E usa um turno 00:00–23:59 e a data de hoje em São Paulo na URL para não depender do relógio.
- **Desvios e detalhes registrados:** (a) o histórico pagina por linhas (50), não por dia: com filtros uma página de "dias" ficaria vazia ou desigual, e a ordem já agrupa por dia. (b) A leitura SQL seleciona colunas tipadas com `sql<string>` sobre um CTE (sem `db.execute`) e `timestamptz` cru volta como texto nos dois drivers: `.mapWith(handover.deliveredAt)` devolve `Date`. (c) O Next mantém a página anterior escondida ao navegar: no Playwright o texto escondido também casa, e o modo estrito reprova (use `.filter({ visible: true })`). (d) O cookie do setor só é gravado por Server Action; o `proxy.ts` não grava (o Next pré-carrega cada link de setor e o cookie viraria o último setor pré-carregado).
- **Verificado:** `check-types`, `lint`, `test`, `test:e2e` (19 passed: 7 de acesso, 6 de cadastros e 6 de passagem) e `build` verdes. P26 e P27 resolvidas; P33 a P36 registradas.

### 2026-11-24 — Fase 4: solicitações

- **Decisão:** as solicitações de ponta a ponta — criar sem digitar o que se escolhe (destino da lista ou "Outro", itens de estoque com quantidade), acompanhar no Quadro (três colunas com a contagem do servidor e "Carregar mais"), na Lista (quatro grupos; padrão no celular) e na Tabela (paginada), mover o status com o cartão trocando de coluna antes da resposta (`useOptimistic`), cancelar com motivo, comentar e apagar o próprio comentário; detalhe rápido num Sheet (rota interceptada) ou na página completa. A passagem mostra "Solicitações abertas": no formulário do rascunho as de agora (com "Nova solicitação" ligada à passagem) e no resumo as que estavam abertas **no instante da entrega**. Regra de negócio em `src/features/requests/*` (funções que recebem `db` e `now` e devolvem `AdminResult`; lógica pura sem I/O); Server Actions em `src/app/(app)/solicitacoes/actions.ts` sobre o **runner único** `runAction`. Migração `0004_fase4_solicitacoes` (`request`, `request_item`, `request_status_event`, `request_comment`). Decisões do dono: solicitação não se edita (D-F4-1); o resumo mostra as abertas na entrega (D-F4-2); P33, P40, P29 e P37 se resolvem antes, cada uma no seu commit (D-F4-3).
- **Por quê:** quem passa o turno precisa registrar o pedido sem digitar o que já está cadastrado, e quem recebe precisa saber em segundos o que está parado e o que estava aberto quando o colega entregou. Cada mudança de status vira um evento (de, para, quem, quando) na mesma transação do `UPDATE`, então o dashboard da Fase 5 conta abertas, paradas e tempo até a entrega sem reconstruir nada. O cartão que muda de coluna na hora é a regra de ouro aplicada ao quadro: mover não pode esperar a ida e volta.
- **Trade-offs aceitos:** (1) O PGlite não prova concorrência: a transição é `UPDATE … WHERE status = <visto>` com conferência de linhas e o teste prova a invariante em sequência (dois "Mover" com o mesmo `from`, cancelar duas vezes). (2) O detalhe rápido depende do cabeçalho `next-url`: um CDN que o descarte abre a página completa, sem perder nada (P44). (3) Trocar de setor em `/solicitacoes` perde os filtros da URL (P45). (4) Um cartão movido para uma coluna aberta e truncada só aparece depois da revalidação (P46). (5) O X só com ícone do `EditDialog` continua sem tooltip (P47; os diálogos e o Sheet da Fase 4 usam botão com texto). (6) Sem editar solicitação: erro de digitação se corrige por comentário ou cancelando.
- **Desvios e detalhes registrados:** (a) `request_status_event.seq` (identity `ALWAYS`) dá a ordem total dos eventos; `changed_at` empata o tempo todo (criação e primeiro movimento com o mesmo `now`) e o `id` é uuid aleatório (verificado: o desempate por `id` errou o status em 26 de 50 execuções). (b) O teto de 99.999 da quantidade fica no domínio, não no banco (mudar o teto não exige migração), como na passagem. (c) `request_item.item_unit_snapshot` acrescenta a unidade ao snapshot da spec §9: "12 rolos" precisa da unidade da época. (d) O slot `@detalhe` precisa de `default.tsx`, de `page.tsx` (rota `/`) e de `[...catchAll]/page.tsx` que só devolvem `null`: sem as duas páginas nulas o Sheet fica aberto sobre a tela seguinte numa navegação no cliente; e **não** existe `(app)/default.tsx` (uma URL desconhecida viraria página em branco em vez do 404). (e) A página completa (↗, "Abrir página completa") é `<a href>` comum: um `<Link>` para a mesma URL seria interceptado de novo. (f) A busca usa `translate(lower(…))` + `ILIKE` com escape, sem extensão `unaccent`, com teste de paridade contra `foldForSearch`. (g) A Tabela não aplica a janela de 30 dias (é onde se procura o antigo). (h) O status na entrega vem de `DISTINCT ON (request_id)` sobre os eventos com `changed_at ≤ delivered_at`; o filtro "aberta" fica fora do `DISTINCT ON`, e dias e "parada" contam do evento daquele instante, nunca de `request.status_changed_at`. (i) Ligar uma solicitação a uma passagem **confirmada** é recusado (`HANDOVER_LOCKED`); a entregue aceita (só liga, não escreve em `handover`). (j) `runAdminAction` e `runHandoverAction` continuam existindo como embrulhos finos do `runAction` (P33); `firstValue`, o harness de migração, `runInTransaction` e `ensureHandover` saíram para módulos próprios (P40).
- **Verificado:** `check-types`, `lint`, `test`, `build` e `test:e2e` (28 passed: 7 de acesso, 6 de cadastros, 6 de passagem e 9 de solicitações) verdes. P29, P33, P37 e P40 resolvidas; P44 a P47 registradas.

### 2026-11-25 — Fase 5: dashboard

- **Decisão:** o dashboard (`/dashboard`) e o CSV (`GET /api/dashboard/export`) de ponta a ponta, só leitura e sem migração. Quatro blocos com período (últimos 7 dias, últimos 30 dias ou intervalo de até 93 dias no calendário de São Paulo) e comparação com o período anterior: **Passagens** (esperadas, entregues, confirmadas, aguardando recebimento, não confirmadas e sem passagem, com o `spending-ring` de 4 fatias), **Controles** (um `metric-card` por item: total, média por turno, variação, um segmento por turno), **Estoque** (última contagem com data e turno e a linha do período, pelo `chart` do shadcn) e **Solicitações** (abertas e paradas agora, entregues no período, tempo até a entrega por destino, quantidade pedida por item). Todo número é um link para a lista filtrada que conta exatamente aquilo. Regra de negócio em `src/features/dashboard/*` (`server-only`; funções que recebem `db`, o escopo e, quando o tempo importa, `now`; agregação toda no SQL); lógica pura (período, variação, duração, CSV, links) sem I/O; componentes em `src/components/dashboard/*` e `src/components/kokonutui/*`. Decisões do dono: P48 (refatorações, só em commits de refatoração), P45, P13 e P19 (correções com teste) se resolvem antes (D-F5-1); o anel tem 4 fatias (D-F5-2); todo número é clicável e os filtros que faltavam nascem na fase (D-F5-3). Decisões do controlador: C-1 (filtro `item=` em `/passagens`), C-2 (Solicitações sem anel), C-3 (um segmento por turno, sem "Outros turnos"), C-4 (turno e item inativos escolhidos pela URL aparecem no formulário), C-5 (`react-is` 19.3.0 junto do recharts), C-6 (os números do mundo do critério são conferidos por um teste próprio) e C-7 (plano autocontido).
- **Por quê:** o dono quer ver, sem abrir a planilha, quantas passagens saíram, quantas faltaram, quanto de cada item passou por turno e o que está parado. Um número que não abre a lista que o gerou não é auditável; por isso número e lista saem da mesma fonte SQL e há teste de paridade entre os dois. O oráculo do critério de pronto (spec §12) é JS sobre leitores crus do banco, nunca a mesma SQL do painel, para provar também a geração dos pares, o fim do turno e o "aguardando".
- **Trade-offs aceitos:** (1) "Sem passagem" herda a definição do histórico (P34). (2) Item que muda de unidade ou de tipo no período não é tratado (P53). (3) O erro do detalhe rápido aparece fora do Sheet, porque `(app)/error.tsx` também cobre o slot `@detalhe` (P54). (4) Os helpers do E2E ficaram repetidos (P55). (5) O filtro de destino cai com mais de 200 destinos (P56). (6) Nenhum índice novo: só sob medição no Neon (P57). (7) A cor das situações do anel não separa em daltonismo; a identidade fica no ícone e no texto (P58). (8) O CSV se monta em memória, com teto de 10.000 linhas (P59). (9) Do 5º turno em diante os segmentos dividem a cor neutra (`foreground`), cada um com a própria linha, o próprio total e o próprio link; não existe um "Outros turnos" agregado.
- **Desvio registrado da spec §8 (C-2, decisão do controlador):** a spec pede `spending-ring` "para parte-do-todo (até 4 fatias + Outros)" no bloco Solicitações. O plano **não** põe anel ali: a "quantidade pedida por item" mistura unidades (rolos, peças), e somar ou fatiar "12 rolos" com "30 peças" violaria a regra de quantidade com unidade declarada; um "Outros" também não teria lista que o conte exatamente (D-F5-3). Fica uma lista de números com unidade, ordenada por número de solicitações (comparável entre unidades), com teto de 12 e "Mostrando … de …". O `spending-ring` fica no bloco Passagens e o `metric-card` nos Controles, então a D17 continua atendida. O desvio também vai no corpo do PR.
- **Desvios e detalhes registrados:** (a) `--chart-5` passou a valer `--foreground` em cada tema (P13): "Outros" e o 5º turno em diante usam `foreground` direto (contraste 19,79 no claro e 17,16 no escuro; ΔE mínimo 20,6 nas quatro visões), porque `muted-foreground` reprova o ΔE em tritanopia; nenhum componente usa `chart-5` (o guarda de paleta reprova). (b) As fatias do anel usam o `-foreground` do token do selo de cada situação (o fundo pastel do selo não passa 3:1 sobre o card). (c) O React Compiler desiste em silêncio do `spending-ring` cru do KokonutUI (default param lendo ref, auto-referência em `useCallback`, `let` reatribuído em `useMemo`): o componente adaptado corrige as três causas e o `scripts/rc-check.mjs` (`bun scripts/rc-check.mjs <arquivos>`) confere que os arquivos adaptados compilam. (d) `react-is` 19.3.0 fixado com o recharts no mesmo commit: o içado pelo Bun é o 17.0.2 do `pretty-format`, que satisfaz o peer mas não reconhece elementos do React 19. (e) `GET /api/dashboard/export` fica fora de `(app)` (um `route.ts` ao lado de `page.tsx` quebra o build, e um subcaminho de `(app)` convive mal com o slot `@detalhe/[...catchAll]`); `new Headers()` lança com caractere acima de 255 em `filename=`, então o nome ASCII vai em `filename` e o UTF-8 em `filename*` (o navegador usa o `filename*`). (f) O BOM do CSV se prova em bytes (`arrayBuffer`), nunca por `res.text()`, que o remove. (g) `catchError` só limpa o erro quando muda o pathname (`?periodo=` e `?setor=` não mudam): a `key` do período e do setor fica no limite de cada bloco, e a `<Suspense>` do bloco mora dentro dele. (h) `requestFilterSql` passou a receber `now` (o filtro "parada" precisa dele) e a janela de 30 dias do Quadro e da Lista some também com filtro de entrega. (i) Média por turno = total ÷ passagens do período **que têm linha do item** (não deflaciona item criado ou desativado no meio). (j) A cor de cada turno é a posição dele no setor com os ativos primeiro, na ordem da tela de Turnos: turno ativo nunca perde a cor por causa de turnos aposentados.
- **Verificado:** `check-types`, `lint`, `test`, `build` e `test:e2e` (35 passed) verdes. P13, P19, P45 e P48 resolvidas; P53 a P61 registradas; P24 e P34 ganharam `Atualização`.
