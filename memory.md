# Memory — Fases 0 e 1 concluídas; o próximo passo é o plano da Fase 2

Last updated: 2026-11-20 (UTC-3)

---

## Onde o projeto está

**Fundação de testes e acesso prontos.** O app Next.js 16.4.6 tem testes automatizados de verdade
(Vitest com PGlite e Testing Library; Playwright com banco efêmero via pglite-socket) e acesso completo: cadastro só
por convite (e-mail e senha, Google e Facebook condicionais ao env), login com passkey, papéis
admin/operador escopados por setor, telas `/entrar`, `/convite/[token]`, `/bem-vindo`, `/conta`,
Início, `/admin` (placeholder) e o shell com sidebar.

O design do produto está na spec (`docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md`,
18 decisões em `.context/build-plan.md §5`) e o plano executado em
`docs/superpowers/plans/2026-11-20-fase-0-1-fundacao-e-acesso.md`.

## O que está esperando

- **Plano da Fase 2 (skill `writing-plans`):** Cadastros — setores, turnos, itens, destinos de
  solicitação, equipe. O `/admin` já existe como placeholder.
- **P10:** credenciais OAuth do Google não criadas (login social sem teste ao vivo).
  **P6/P7/P8:** Apple Developer, app da Meta, provedor de e-mail — só travam Apple, Facebook e "esqueci a senha".
- **Suposições a validar com o usuário final:** spec §15 (glossário, horários dos turnos, o que é
  solicitação, passagem feita no fim do turno, quem recebe).
- **Remoto:** `origin` = GitHub (`main`, repositório **público**). Commit e push só com pedido do dono;
  nunca `.env.local` nem segredo em commit.

## Coisas que vão te morder se ninguém avisar

- **Testes:** `bun run test` (Vitest) e `bun run test:e2e` (Playwright). **Nunca `bun test`.** Node ≥ 22.12.
- **PGlite não prova corrida:** uma conexão só, serializa tudo. Atomicidade vai no SQL (`UPDATE … RETURNING`).
- **`next build` exige `BETTER_AUTH_URL` e `BETTER_AUTH_SECRET`** (≥ 32 caracteres) no `.env.local` e
  na Vercel; sem eles falha com `Failed to collect page data for /api/health`.
- **O E2E roda o app em produção:** o rate limit do Better Auth está ligado (`/sign-up/email` 10 por
  60 s e `/sign-in/email` 30 por 60 s, por IP); cada teste manda um `x-forwarded-for` próprio. O env do
  `webServer` vence o `.env.local`, então o E2E nunca toca o Neon.
- **Better Auth:** schema de auth escrito à mão (`src/db/schema/auth.ts`) com teste guarda; erro de
  hook é sempre `APIError` com `code`; sem `cookieCache` e sem `nextCookies()`; cadastro e login pelo
  `authClient` (HTTP). Nunca renderizar `error_description` da URL.
- **Cache Components:** sessão (`getAuthz`) só dentro de `<Suspense>`, nunca em `"use cache"`.
- **Base UI, não Radix:** `render`, não `asChild`; navegação com cara de botão é
  `<Link className={buttonVariants()}>`, porque `Button render={<Link />}` vira `role="button"`.
- **jsdom 28 + polyfill de `matchMedia`** (`test/setup-dom.ts`); `check-types` roda `next typegen` antes.
- **Passkey cancelada** chega como `ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY`: traduza com `passkeyErrorCode`.
- **Passkey:** `rpID` vem de `BETTER_AUTH_URL`; passkey de `localhost` não vale em produção.
- **Primeiro administrador:** `bun run admin:invite` imprime o link do convite.
- **Driver é `pg` + `attachDatabasePool`** (D18), não `neon-serverless`. Escrita multi-statement em
  `db.transaction()`; nada de `db.batch`.
- **`.env.local` aponta para a branch de DESENVOLVIMENTO do Neon** (`ep-blue-voice-…`); as URLs de
  produção estão comentadas até irem para a Vercel. Usa `DATABASE_URL` (direta) + `DATABASE_URL_POOLED`
  (o contrário da convenção do `neon env pull`); `src/db/databaseUrl.ts` aceita as duas. Sempre `sslmode=verify-full`.
- **A CLI `neon` está com a sessão expirada** (`neon login` resolve).
- **Componentes KokonutUI vêm com cor crua e em inglês** — adaptar na instalação (`library-docs.md §6`).
- O Playwright MCP grava artefatos em `.playwright-mcp/` (ignorado no git).
- **Nenhum dado real da planilha** (nomes das pessoas) entra em commit, seed ou teste.
