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
| Validação | Zod — *a instalar com o primeiro formulário* | — |
| Testes | Vitest + Testing Library; Playwright para E2E — *a instalar na Fase 0* | — |
| Auth | *🟡 decidir no brainstorm* | — |
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
    index.ts              conexão Drizzle + Neon (server-only)
    schema.ts             tabelas (quebrar em schema/ quando crescer)
  lib/                    utilitários puros (camelCase)
drizzle/                  migrações SQL geradas (versionadas)
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
  (`ep-blue-voice-…`, `sa-east-1`). A branch **production** só existe nas variáveis da Vercel —
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

## 6. Modelo de dados · 🟡 a fechar na spec (decisões em `build-plan.md §5`)

Entidades que as decisões já implicam: **setor**, **turno** (por setor, com horário — D9),
**item** (por setor, com unidade e tipo controle/estoque — D1), **destino** de solicitação (D7),
**passagem** (setor + turno + dia operacional, única; quem entregou; confirmação de quem recebeu
— D5), **valores da passagem por item** (quantidade + observação, com nome e unidade do item
**congelados** na entrega — D1), **solicitação** + **histórico de status** + **comentários**
(D6–D8), e as tabelas do Better Auth + **convite** (D2–D4). Sem fotos (D10).

## 7. Autenticação e autorização · 🟢 métodos definidos (D2) / 🟡 convite e papéis em aberto

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

## 8. Dados pessoais (LGPD) · 🟢 baseline

- O sistema guarda **nome e e-mail de funcionários**, **autoria de passagens** e **comentários**.
  Coletar só o necessário; nada de documento pessoal (CPF, RG) sem motivo explícito.
- **Nenhum dado real** da planilha original (nomes) entra em commit, seed, teste ou
  fixture — só dados fictícios.
- **Sem upload de arquivos** no MVP (D10) — nenhum armazenamento de mídia.

## 9. Rotas · 🟡 a preencher conforme os marcos

| Rota | O que é | Status |
|---|---|---|
| `/` | placeholder | ✅ scaffold |
| `/api/health` | `GET` — `select 1` dentro de transação; `200 {status:"ok"}` ou `503 {status:"error"}` sem detalhe (o erro vai só para o log). Pública | ✅ 2026-11-20 |

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
