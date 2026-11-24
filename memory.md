# Memory — Fases 0 a 4 concluídas; o próximo passo é o plano da Fase 5

Last updated: 2026-11-24 (UTC-3)

---

## Onde o projeto está

**Fundação de testes e acesso prontos.** O app Next.js 16.4.6 tem testes automatizados de verdade
(Vitest com PGlite e Testing Library; Playwright com banco efêmero via pglite-socket) e acesso completo: cadastro só
por convite (e-mail e senha, Google e Facebook condicionais ao env), login com passkey, papéis
admin/operador escopados por setor, telas `/entrar`, `/convite/[token]`, `/bem-vindo`, `/conta`,
Início, `/admin` e o shell com sidebar.

**Cadastros prontos (Fase 2).** `/admin` tem os cinco cartões e as telas `/admin/setores`,
`/admin/turnos`, `/admin/itens`, `/admin/destinos` e `/admin/equipe`: nada se apaga (só desativa),
turno avisa sobreposição, ordem por botões ↑ ↓, unidade do item por escolha com "Outro", equipe com
papel, setor, desativação (que derruba as sessões, P11) e convites com link para copiar ou compartilhar.
Plano executado em `docs/superpowers/plans/2026-11-21-fase-2-cadastros.md`.

**Passagem pronta (Fase 3).** O Início (`/`) mostra "Passagem para confirmar" (a mais recente entregue do
setor, para quem não a entregou) e "Passagem do meu turno"; `/passagens/nova` abre o formulário do turno
certo sem digitar nada (turno e dia sugeridos pelo relógio de São Paulo, números em `0`) com salvamento
automático por campo e "Entregar turno"; `/passagens/[id]` é o resumo na ordem do briefing com "Confirmar
recebimento" (quem entregou não confirma); quem entregou ainda edita até a confirmação, depois só o admin
corrige, com motivo e uma linha de rastro por campo; `/passagens` é o histórico com filtros na URL, "sem
passagem", "não confirmada" e o selo "Corrigida". O admin escolhe o setor na tela (URL + cookie). Plano executado em
`docs/superpowers/plans/2026-11-21-fase-3-passagem.md`.

**Solicitações prontas (Fase 4).** `/solicitacoes` mostra as solicitações do setor em Quadro (três colunas com a
contagem do servidor e "Carregar mais"), Lista (quatro grupos; padrão no celular) e Tabela (paginada), com filtros
na URL; "Nova solicitação" é um diálogo que nunca começa em branco (destino da lista ou "Outro", itens de estoque
com quantidade); "Mover para …" troca o cartão de coluna antes da resposta (`useOptimistic`) e cancelar exige o
motivo. Clicar numa solicitação abre o detalhe num Sheet sobre a tela (rota interceptada `@detalhe`); recarregar abre a
página completa. A passagem mostra "Solicitações abertas": no formulário, as de agora (com "Nova solicitação" ligada
à passagem); no resumo, as que estavam abertas **no instante da entrega**, com o status daquele instante. O Início
ganhou o cartão "Solicitações". Solicitação não se edita (D-F4-1). Plano executado em
`docs/superpowers/plans/2026-11-23-fase-4-solicitacoes.md`.

O design do produto está na spec (`docs/superpowers/specs/2026-11-20-closery-passagem-de-turno-design.md`,
18 decisões em `.context/build-plan.md §5`) e o plano executado em
`docs/superpowers/plans/2026-11-20-fase-0-1-fundacao-e-acesso.md`.

## O que está esperando

- **Plano da Fase 5 (skill `writing-plans`):** Dashboard — consultas de quantidades e de solicitações
  (abertas, paradas, tempo até a entrega), `metric-card` e `spending-ring` adaptados e exportação CSV (spec §13).
  A Fase 5 só lê: o histórico de status (`request_status_event`) e a passagem já guardam o que ela conta.
- **P34–P36 (Fase 3):** "sem passagem" usa os horários atuais do turno (P34); o cartão "Passagem para
  confirmar" não tem teto de idade (P35); dois operadores no mesmo rascunho: o último a salvar vence (P36).
- **P44–P47 (Fase 4):** o detalhe rápido depende do cabeçalho `next-url` (P44); trocar de setor em
  `/solicitacoes` perde os filtros da URL (P45); um cartão movido para uma coluna aberta e truncada só aparece
  depois da revalidação (P46); o X só com ícone do `EditDialog` continua sem tooltip (P47).
- **P48–P52 (revisão final da Fase 4):** refatorações para o início da Fase 5, a de maior prioridade é extrair
  `resolveScreenSector`/`paginationParams` antes do painel (P48); higiene de testes e o erro `portal "" does not exist`
  do `pglite-socket` no log do E2E (P49); UX (P50); FK composta do comentário (P51); CTE `last` das abertas (P52).
  Próximo id livre: P53.
- **P23:** editar o nome de uma pessoa (o admin em `/admin/equipe`, a própria pessoa em `/conta`).
- **P24:** a ordem alfabética das listas do admin ignora acento (`C.UTF-8` ordena por ponto de código).
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
- **`.env.local` aponta para a branch de DESENVOLVIMENTO do Neon**; as URLs de
  produção estão comentadas até irem para a Vercel. Usa `DATABASE_URL` (direta) + `DATABASE_URL_POOLED`
  (o contrário da convenção do `neon env pull`); `src/db/databaseUrl.ts` aceita as duas. Sempre `sslmode=verify-full`.
- **A CLI `neon` está com a sessão expirada** (`neon login` resolve).
- **Componentes KokonutUI vêm com cor crua e em inglês** — adaptar na instalação (`library-docs.md §6`).
- O Playwright MCP grava artefatos em `.playwright-mcp/` (ignorado no git).
- **Nenhum dado real da planilha** (nomes das pessoas) entra em commit, seed ou teste.
- **Server Actions de `/admin`:** `requireAdmin()` na primeira linha de **cada** função exportada (guarda
  `actionsAuth.test.ts`); `actions.ts` só exporta funções `async`; o formulário é controlado e chama a action
  com objeto tipado; `runAdminAction` devolve `AdminResult` (`library-docs.md §12`).
- **`/admin` não tem `layout.tsx` nem `metadata`:** os dois sairiam antes do `notFound()` e revelariam a
  rota ao operador. `<h1>` sempre dentro do `<Suspense>`.
- **`shadcn add dialog` reinstala `button.tsx`** e trava no prompt sem `--overwrite`: rode com `--overwrite`
  e depois `git checkout -- src/components/ui/button.tsx` (customização da P3).
- **`time` é texto** (`"HH:mm:ss"` do banco, `"HH:mm"` no app) e o erro do driver vem embrulhado em
  `error.cause` (SQLSTATE em `error.cause.code`).
- **PGlite não prova o "último admin"**: a garantia é `SELECT … FOR UPDATE` no SQL, provada em sequência.
- **Neon de dev:** collation `C.UTF-8`; `lower('ÁGUA') = lower('água')`, então nomes acentuados colidem
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
- **Solicitações (Fase 4):** o detalhe rápido é o slot `@detalhe` do layout de `(app)`: ele **precisa** de
  `default.tsx`, `page.tsx` e `[...catchAll]/page.tsx` que só devolvem `null` (sem as duas páginas nulas o Sheet fica
  aberto sobre a tela seguinte) e **não** pode haver `(app)/default.tsx` (a URL desconhecida deixaria de dar 404).
  `<Link scroll={false}>` abre o Sheet; a página completa (↗) é `<a href>`, senão a navegação seria interceptada de novo.
- **`useOptimistic` só dentro de `startTransition`**, antes do primeiro `await`; `revalidatePath` só em `ok`; em conflito
  o cliente faz `router.refresh()`. Eventos de status se ordenam por `changed_at, seq` (nunca por `id`): `seq` é identity.
- **Escrita de solicitação lê o setor com `FOR SHARE`** (`lockSectorShare`); setor inativo é só leitura (`SECTOR_INACTIVE`).
  Operador de outro setor recebe "não encontrada", nunca "sem permissão".
- **E2E das solicitações:** abra `?visao=quadro` ou `?visao=lista` (sem `visao` as duas visões estão no DOM); com o Sheet
  aberto só `page.getByRole("dialog")` enxerga dentro e o resto da página vira `aria-hidden` (use `page.locator` por baixo);
  fixture sempre com datas relativas a `Date.now()`.
