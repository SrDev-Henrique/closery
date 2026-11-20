# Library Docs — Closery

> **Documento vivo + regras por biblioteca.** Aqui ficam as **regras específicas do projeto** para
> cada dependência — não a doc geral da lib. Versões reais: `package.json`.

---

## 0. Protocolo (antes de usar qualquer biblioteca)

1. **Carregue a skill instalada da biblioteca**, quando existir.
2. **Busque a doc atual** para API/sintaxe:
   - **`node_modules/next/dist/docs/`** para Next.js — leia antes de escrever.
   - **context7 MCP** para as demais (Drizzle, Neon, Base UI, Tailwind, Zod…).
3. **Aplique as regras deste arquivo.** O conhecimento prévio pode estar desatualizado; a doc
   instalada é a verdade.

## 1. Next.js 16.4 + React 19.3

- App Router, Turbopack, **React Compiler ligado** (`reactCompiler: true`): não semeie
  `useMemo`/`useCallback`/`memo` por reflexo — só com motivo medido.
- **Cache Components ligado** (`cacheComponents: true` + `partialPrefetching: true`):
  - Dado é **dinâmico por padrão**; nada é cacheado sem pedir. Cache é opt-in com a diretiva
    `"use cache"` (página, componente ou função) + `cacheTag`/`cacheLife`; invalide com
    `revalidateTag` depois de uma escrita.
  - Partial Prerendering é o padrão: a casca estática sai na hora e o dinâmico chega por
    streaming — **acesso a dado dinâmico (cookies, headers, query sem cache) fica dentro de
    `<Suspense>`**.
  - Exige runtime Node.js: **não** exporte `runtime` em segmento de rota.
  - Navegação usa `<Activity>`: a rota anterior fica escondida com estado preservado — efeitos são
    limpos ao esconder e recriados ao voltar. Formulário de passagem meio preenchido sobrevive a
    ir e voltar, mas não a recarregar a página.
  - Guias: `01-app/01-getting-started/08-caching.md`, `09-revalidating.md`,
    `02-guides/authentication-with-cache-components.md`.
- `LayoutProps<"/">` / `PageProps<"/rota">` são tipos globais gerados pelo Next (typed routes).

## 2. shadcn/ui (`base-nova`) + Base UI

- **É Base UI, não Radix.** Composição pela **prop `render`**
  (`<DialogTrigger render={<Button />}>`), **não** `asChild`. Não copie padrões Radix.
- Primitivos em `src/components/ui` (kebab-case), **adicionados pelo CLI**:
  `bunx shadcn@latest add <componente>`. Não escreva primitivo à mão.
- Ajuste visual de primitivo → **edite o primitivo** e registre no `ui-registry.md`; nunca crie
  um paralelo.
- `cn` vem do pacote **`cn`** (utilitário oficial do shadcn, substitui `clsx` + `tailwind-merge`),
  reexportado em `@/lib/utils`.

## 3. Tailwind CSS v4

- Configuração **CSS-first** em `src/app/globals.css` (`@theme inline`, `@custom-variant dark`).
  Não existe `tailwind.config.js`. Token novo entra lá (claro **e** escuro) e é documentado no
  `ui-tokens.md`.
- Só classes semânticas (`bg-background`, `text-muted-foreground`…). Proibido cor crua.
- Fonte: `next/font` define `--font-sans` (Geist) e `--font-geist-mono` no `<html>`; o CSS lê
  essas variáveis. Mudou a fonte? Mude o `variable` no `layout.tsx` junto.

## 4. Biome 2.4

- `bun run lint` = `biome check` (só verifica). `bun run format` grava a formatação.
- Para corrigir só alguns arquivos: `bunx biome check --write <arquivos>`.
- Domínios `next` e `react` ligados no lint.
- A pasta `drizzle/` (migrações geradas) fica **fora** do Biome: o drizzle-kit reescreve esses
  arquivos e não segue a formatação do projeto.

## 5. Drizzle ORM 0.45 + Neon

- **Driver (D18): `drizzle-orm/node-postgres`** + `Pool` do `pg`, registrado com
  **`attachDatabasePool`** do `@vercel/functions` (recomendação da skill oficial do Neon para
  Vercel Fluid compute). Escrita multi-statement em **`db.transaction()`**. Schema em
  `src/db/schema.ts` (passado ao `drizzle()` para a query relacional).
- **Não troque para `@neondatabase/serverless`** sem motivo: ele é a escolha do Neon para edge e
  serverless sem pool reutilizável, não para a Vercel com Fluid compute.
- **URLs:** `resolveDatabaseUrls()` (`src/db/databaseUrl.ts`) decide — pooler para o app, direta
  para o drizzle-kit — e aceita as duas convenções de nome do Neon. Sempre `sslmode=verify-full`.
- **Channel binding** é `enableChannelBinding: true` no `Pool` — o `pg` não lê o
  `channel_binding=require` da URL.
- **Local = branch de desenvolvimento do Neon;** produção só na Vercel.
- **Pool em dev** fica no `globalThis` para o HMR não vazar conexões.
- **Testes: `drizzle-orm/pglite`** (`@electric-sql/pglite`), Postgres em processo, aplicando as
  migrações de `drizzle/` com o migrator do PGlite. Mesma API de `db.transaction()` — o módulo de
  banco é trocado no teste, o código de domínio não muda.
- **Não use `db.batch`**: ele não existe no driver de teste.
- Convenções de schema: ids `uuid` com `defaultRandom()` (ou `text` se houver motivo); timestamps
  `timestamptz` com `defaultNow()`; `index()` em toda FK e coluna de filtro; nomes de tabela e
  coluna em `snake_case` no banco (`casing: "snake_case"` se adotado — decidir na primeira tabela).
- **Migrações:** `bun run db:generate` → revisar o SQL em `drizzle/` → `bun run db:migrate`
  (usa `DATABASE_URL_UNPOOLED`). `db:push` só em banco de dev descartável. `db:studio` para
  inspecionar.
- `drizzle.config.ts` carrega `.env`/`.env.local` com `@next/env` — mesmas regras do Next — e usa
  a URL **direta** via `resolveDatabaseUrls()`.
- Branch do Neon para dev/preview é a forma barata de ter banco descartável.

## 6. Componentes de registry de terceiros (KokonutUI) — D17

- Entram **pelo CLI**: `bunx shadcn@latest add @kokonutui/<nome>` → `src/components/kokonutui/`.
  Antes de instalar, `bunx shadcn@latest view @kokonutui/<nome>` mostra o código.
- **Adaptação obrigatória na instalação** (o código vem em inglês e com cor crua):
  1. trocar `zinc-*`/`emerald-*`/`rose-*`/`orange-*`/`sky-*`… por tokens (`foreground`,
     `muted-foreground`, `border`, `muted`, `success`, `destructive`, `warning`, `chart-1..4`);
  2. textos e `Intl.NumberFormat`/datas em **pt-BR**;
  3. formato numérico com unidade (o `spending-ring` só formata moeda; o `metric-card` aceita
     `format: "number"`);
  4. `metric-card`: período **controlado** pelo dashboard (prop), sem as pílulas internas; os
     dados precisam cobrir **2× o período** (ele compara com o período anterior).
- São `"use client"` com animação própria (respeitam `prefers-reduced-motion`). Recebem dados
  já agregados no servidor — nunca buscam nada.
- Registre cada um no `ui-registry.md`, com as adaptações feitas.

## 7. Zod · a instalar com o primeiro formulário

- Fonte da verdade dos contratos das Server Actions; tipos com `z.infer`.
- O **mesmo** schema valida no servidor e dá feedback no client.

## Como adicionar uma biblioteca nova

1. Justifique (o que resolve que o stack atual não resolve?) — YAGNI.
2. Instale com `bun add` e registre aqui uma seção com as regras do projeto.
3. Registre a decisão no `architecture.md §10`.
