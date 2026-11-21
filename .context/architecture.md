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
| Banco | **Neon** (Postgres serverless) | driver `pg` 8.23 + `@vercel/functions` 3.11 (D18) |
| ORM / migrações | **Drizzle ORM** + drizzle-kit | 0.45.4 · 0.31.11 |
| Lint/format | **Biome** | 2.4.2 |
| Gerenciador | **Bun** | 1.3.3 |
| Validação | **Zod 4** (env de acesso, contratos das Server Actions) | 4.x |
| Testes (unidade, integração, componente) | **Vitest** (projects `node` e `dom`) + jsdom + Testing Library + **PGlite** (Postgres em processo, com as migrações reais) | Vitest 5.1.1 · jsdom 28 (sem `matchMedia`: polyfill em `test/setup-dom.ts`) · Testing Library react 16.3 · PGlite 0.5.17 |
| Testes E2E | **Playwright** (Chromium) + PGlite servido por **pglite-socket** | Playwright 1.65.1 · pglite-socket 0.2.20 |
| CI | **GitHub Actions** (`.github/workflows/ci.yml`): tipos, lint, Vitest e E2E em todo PR e push na `main` | Ubuntu · Bun 1.3.3 · Node 22 |
| Auth | **Better Auth** (adapter Drizzle) + plugin **passkey** | better-auth 1.7.27 · @better-auth/passkey 1.7.27 |
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
scripts/                  scripts do desenvolvedor (admin:invite)
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

## 6. Modelo de dados · 🟡 em construção (acesso e convite ✅ na Fase 1)

Entidades que as decisões já implicam: **setor**, **turno** (por setor, com horário — D9),
**item** (por setor, com unidade e tipo controle/estoque — D1), **destino** de solicitação (D7),
**passagem** (setor + turno + dia operacional, única; quem entregou; confirmação de quem recebeu
— D5), **valores da passagem por item** (quantidade + observação, com nome e unidade do item
**congelados** na entrega — D1), **solicitação** + **histórico de status** + **comentários**
(D6–D8), e as tabelas do Better Auth + **convite** (D2–D4). Sem fotos (D10).

**Tabelas criadas até a Fase 1** (migrações versionadas em `drizzle/`):

| Tabela | O que guarda | Chave |
|---|---|---|
| `sector` | setor: nome único, `active` | `uuid` |
| `user` | pessoa (Better Auth) + `role` (`admin`/`operator`), `sector_id` (FK `sector`, `restrict`), `deactivated_at`; check `user_operator_needs_sector` (operador exige setor) | `text` |
| `session`, `account`, `verification`, `passkey`, `rate_limit` | tabelas do Better Auth, cópia fiel da CLI 1.7.27 | `text` |
| `invite` | convite: `token_hash` único, `role`, `sector_id`, `invitee_label`, `invited_by`, `expires_at`, `used_at`, `used_by`, `cancelled_at`; check `invite_operator_needs_sector` | `uuid` |

As tabelas do Better Auth usam `timestamp` sem fuso (é o que a CLI gera); as do domínio (`sector`, `invite`) usam `timestamptz`. As demais entidades acima chegam nas Fases 2 a 4.

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
- **Consumo do convite.** No `databaseHooks.user.create.before`: `UPDATE invite SET used_at … WHERE token_hash = … AND used_at IS NULL AND cancelled_at IS NULL AND expires_at > now RETURNING role, sector_id` (atômico no banco). O hook injeta `role`, `sector_id` e `emailVerified: true`; `user.create.after` grava `used_by`. O cadastro por e-mail checa e-mail repetido **antes** do hook, então e-mail já cadastrado não gasta convite. Sem `ctx` (fora de uma requisição) o hook recusa (fail-closed). Todo erro de hook é `APIError` com `code` (`SIGNUP_INVITE_ONLY`, `ACCOUNT_DEACTIVATED`).
- **Cookie `closery_invite`.** Token bruto, `httpOnly`, `SameSite=Lax` (volta no callback OAuth), `Secure` em produção, `path=/`, 1 h. Só a Server Action `armInvite` grava; a página `/convite/[token]` apenas lê (prefetch e scanner de link não gastam convite). A rota responde com `Referrer-Policy: no-referrer`.
- **Sessão renovada pelo navegador.** `SessionKeepAlive` (cliente, no layout `(app)`) chama `authClient.getSession()` uma vez ao montar: o `GET /api/auth/get-session` regrava banco e cookie juntos quando a sessão passa do `updateAge` (1 dia). O servidor só lê: `getAuthz` passa `query: { disableRefresh: true }`, porque Server Component descarta o `Set-Cookie` e uma renovação ali estenderia o banco sem renovar o cookie (e a chamada HTTP seguinte nunca mais renovaria). Sessão continua em 7 dias; quem usa o app não é deslogado 7 dias após o login.
- **Sem `cookieCache`.** A sessão é lida do banco a cada requisição (`getAuthz`, com `cache()` do React) para que desativação e mudança de papel ou setor valham na hora; `session.create.before` barra usuário desativado em e-mail, social e passkey. Sem `nextCookies()`: cadastro e login vão pelo `authClient` (HTTP), onde o rate limit atua.
- **Rate limit** do Better Auth com `storage: "database"` (tabela `rate_limit`), ligado só em produção: `/sign-in/email` 30 por 60 s e `/sign-up/email` 10 por 60 s (`customRules` da `createAuth`); os demais `/sign-in*` e `/sign-up*` (social) seguem o padrão do Better Auth, 3 por 10 s; os endpoints de passkey ficam em `/passkey/*` e caem no padrão geral de 100 por 10 s. A janela conta a partir da **última** requisição permitida (cada requisição aceita move `lastRequest`). IP: sem `trustedProxies`, o Better Auth só confia em `x-forwarded-for` quando ele tem **um único valor**; com vários valores todos caem num balde compartilhado por caminho (`no-trusted-ip|<path>`); na Vercel o cabeçalho tem um valor só. No bloqueio (429) a tela mostra `Muitas tentativas nesta rede. Espere um minuto e tente de novo.` (código `RATE_LIMITED`, deduzido de `status === 429` em `errorCodeOf`).
- **Autorização.** `toAuthz` (puro) produz `Authz`; `requireUser()` redireciona para `/entrar`; `requireAdmin()` chama `notFound()` para operador, que vê "Página não encontrada" (com streaming o status HTTP é 200 e o HTML traz `noindex`; `/admin` não exporta `metadata`, para o `<title>` não revelar a rota); `scopeToSector(authz, coluna)` escopa as queries por setor. `src/proxy.ts` só faz o redirecionamento otimista pelo cookie; a regra real vive no servidor. Regra do grupo `(app)`: toda página ou folha do grupo `(app)` que mostra ou lê dados chama `requireUser`/`requireAdmin` dentro de `<Suspense>` (o layout não protege a página: o Next roda a página mesmo que o layout troque o conteúdo, e o layout não re-renderiza na navegação no cliente); `src/app/appPagesAuth.test.ts` reprova página sem a chamada; toda Server Action e todo route handler autoriza por conta própria (`requireUser`/`requireAdmin` ou `getAuthz`, e `scopeToSector`/`canAccessSector`), porque podem ser chamados de qualquer rota e `/api` não passa pelo proxy.
- **Passkey.** `rpID` e origem vêm de `BETTER_AUTH_URL` (passkey de `localhost` não vale em produção); criada em `/bem-vindo` ou `/conta` (exige sessão recente); login pelo autofill do campo de e-mail e pelo botão "Entrar com passkey".
- **Primeiro administrador.** `bun run admin:invite` (`scripts/adminInvite.ts`) gera o link do convite de administrador.
- **Vínculo de contas desligado.** `account.accountLinking.disableImplicitLinking: true`: o convite marca o e-mail como verificado, e vincular login social pelo e-mail abriria tomada de conta. Quem criou conta por e-mail e tenta Google recebe `account_not_linked` ("Entre como da primeira vez").
- **Erros do WebAuthn.** O cliente de passkey repassa o código do `@simplewebauthn/browser` (fechar o diálogo = `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`); `passkeyErrorCode` (`src/components/auth/passkeyErrorCode.ts`) traduz para `AUTH_CANCELLED`/`REGISTRATION_CANCELLED`/`PREVIOUSLY_REGISTERED` antes do mapa de mensagens.

## 8. Dados pessoais (LGPD) · 🟢 baseline

- O sistema guarda **nome e e-mail de funcionários**, **autoria de passagens** e **comentários**.
  Coletar só o necessário; nada de documento pessoal (CPF, RG) sem motivo explícito.
- **Nenhum dado real** da planilha original (nomes) entra em commit, seed, teste ou
  fixture — só dados fictícios.
- **Sem upload de arquivos** no MVP (D10) — nenhum armazenamento de mídia.

## 9. Rotas · 🟢 rotas da Fase 1 prontas (as seguintes entram a cada marco)

| Rota | O que é | Status |
|---|---|---|
| `/entrar` | login: e-mail e senha, passkey (autofill e botão), Google/Facebook se habilitados. Pública | ✅ Fase 1 |
| `/convite/[token]` | convite (válido, expirado, usado, cancelado, inexistente) + cadastro; `armInvite` grava o cookie. Pública | ✅ Fase 1 |
| `/bem-vindo` | oferta de passkey logo depois do cadastro | ✅ Fase 1 |
| `/` | Início: saudação (a passagem de turno entra na Fase 3) | ✅ Fase 1 |
| `/conta` | passkeys (criar e remover) e "Sair" | ✅ Fase 1 |
| `/admin` | Administração (placeholder até a Fase 2); operador vê "Página não encontrada" | ✅ Fase 1 |
| `/api/auth/[...all]` | handler do Better Auth. Pública | ✅ Fase 1 |
| `/api/health` | `GET` — `select 1` dentro de transação; `200 {status:"ok"}` ou `503 {status:"error"}` sem detalhe (o erro vai só para o log). Pública | ✅ 2026-11-20 |

Rotas públicas: `/entrar`, `/convite/[token]`, `/api/auth/*` e `/api/health`. Todo o resto exige sessão (`src/proxy.ts` + `requireUser()`).

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
