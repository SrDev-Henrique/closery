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
- **Cabeçalhos e robots (Fase 6).** `next.config.ts` envia os seis cabeçalhos de segurança em `/:path*`
  (`nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `frame-ancestors 'none'`,
  `X-Frame-Options: DENY`, `Permissions-Policy` sem câmera, microfone e geolocalização, e
  `X-Robots-Tag: noindex, nofollow`) e `Referrer-Policy: no-referrer` em `/convite/:path*` **e** `/redefinir-senha/:path*`; a regra
  posterior vence a global, então a ordem importa (`nextConfig.test.ts`). **Sem CSP de scripts** (nonce
  obriga renderização dinâmica e derruba o shell estático do `cacheComponents`) e **sem HSTS** (a
  Vercel já envia em `*.vercel.app`). `publickey-credentials-*` ficam fora da `Permissions-Policy` de
  propósito: o padrão `self` mantém as passkeys. Noindex em três camadas: `src/app/robots.ts`
  (`Disallow: /`), `metadata.robots` no layout raiz e o `X-Robots-Tag`.
- **`vercel.json` (Fase 6).** `regions: ["gru1"]`, `installCommand` com `bunx bun@<packageManager>`,
  `buildCommand: "bun run build"` e `git.deploymentEnabled: { "**": false, "main": true }` (previews
  desligados; `"**"` e não `"*"`, que não casa `/`). Sem `bunVersion` (é o runtime das funções, que
  rodam em Node). `engines.node` é `"22.x"`: `>=22.12` faria a Vercel subir para a major mais recente.
  `test/vercelConfig.test.ts` amarra `vercel.json`, `engines` e o Node do CI.
- **Rotas paralelas sob validação estrita (PR B, P81).** O 16.4 liga `experimental.strictRouteMatching` por padrão: o
  `next dev` monta as rotas a partir de `normalizeCatchAllRoutes` e apaga a rota **inteira** quando um slot irmão não tem
  página que case nem `default`. Um catch-all na raiz de um slot (`@detalhe/[...catchAll]`, que normaliza para
  `/[...catchAll]`) é pendurado em **toda** rota, inclusive nas de fora do grupo: derrubava `/entrar`, `/convite/[token]`,
  `/redefinir-senha` e `/privacidade` no dev (o build de produção servia as quatro). Por isso o slot `@detalhe` é um
  **espelho por segmento** de `(app)` (§14): **segmento novo de primeiro nível em `(app)` ganha
  `@detalhe/<segmento>/page.tsx` nula e, se tiver subrotas, `@detalhe/<segmento>/[...rest]/page.tsx`**, no mesmo commit.
  Proibidos: `(app)/default.tsx` (cria a rota `/[...catchAll]`: toda URL desconhecida renderiza o shell em vez do 404) e
  `deprecated.looseRouteMatching` (esconde o defeito). O guarda `src/app/routeStructure.test.ts` roda o validador interno
  sobre a árvore real; os caminhos são fixos da 16.4.6 (`next/dist/server/lib/router-utils/normalize-catchall-routes` e
  `next/dist/shared/lib/router/utils/app-paths`): se uma atualização do Next os mover, o import quebra com mensagem clara e
  a correção é atualizar o caminho.

## 2. shadcn/ui (`base-nova`) + Base UI

- **É Base UI, não Radix.** Composição pela **prop `render`**
  (`<DialogTrigger render={<Button />}>`), **não** `asChild`. Não copie padrões Radix.
- Primitivos em `src/components/ui` (kebab-case), **adicionados pelo CLI**:
  `bunx shadcn@latest add <componente>`. Não escreva primitivo à mão.
- Ajuste visual de primitivo → **edite o primitivo** e registre no `ui-registry.md`; nunca crie
  um paralelo.
- `cn` vem do pacote **`cn`** (utilitário oficial do shadcn, substitui `clsx` + `tailwind-merge`),
  reexportado em `@/lib/utils`.
- **Fase 2: `toggle-group` (traz `toggle`), `native-select` e `dialog`.** Comando:
  `bunx shadcn add toggle-group native-select dialog --yes --overwrite` e depois
  `git checkout -- src/components/ui/button.tsx`. O `dialog` reinstala o `button.tsx` e o CLI
  pergunta se pode sobrescrever mesmo com `--yes`: sem `--overwrite` o comando trava, e o
  `button.tsx` sobrescrito perde a customização da P3. Os gerados saem com `h-8`/`h-7` e `"Close"`
  em inglês: ajuste para `h-9 max-md:h-11` (ou `size-9 max-md:size-11`), `text-base md:text-sm` no
  select nativo e `"Fechar"` (`touchTargets.test.tsx` e `ptBrLabels.test.tsx` guardam). Não usamos
  `select` (Base UI), `radio-group` nem `alert-dialog`: lista em linhas, `<select>` nativo
  (abre o seletor do aparelho, 16px) e `Dialog` para confirmar.
- **`table` (Fase 4).** A Tabela de `/solicitacoes` é a primeira tabela do projeto e vem pelo CLI:
  `bunx shadcn@latest add table --yes`, depois `git status` e `git checkout -- src/components/ui/<arquivo>.tsx`
  para qualquer outro primitivo que o CLI tenha tocado, e `bun run format`. O primitivo traz o contêiner com
  rolagem horizontal própria (a página nunca rola na horizontal, nem no celular); números ficam à direita com
  `text-right tabular-nums` e a legenda é `<TableCaption className="sr-only">`. Listas de cadastro e de histórico
  continuam em linhas (`AdminListRow`): a tabela é só para o arquivo de solicitações.
- **Diálogos e Sheet da Fase 4 usam `showCloseButton={false}`** e um botão com texto ("Voltar" nos diálogos,
  "Fechar" no Sheet): o X só com ícone do primitivo não tem tooltip, e todo controle só com ícone precisa de um
  (P47 registra o `EditDialog` da Fase 2, único uso restante).
- **`chart` (Fase 5).** A linha do Estoque usa o primitivo `chart` (recharts 3.8.0, exato). O comando é
  `echo n | bunx shadcn@latest add chart --yes`: o `--yes` sozinho aborta no prompt "The file card.tsx already
  exists. Would you like to overwrite?" e não grava nada (não existe `--skip-existing`); o `n` recusa, o CLI grava só
  `src/components/ui/chart.tsx` e relata `Skipped 1 file: card.tsx`. Depois, `git diff --quiet -- src/components/ui/card.tsx`
  (sai 0) e `git status` mostrando só `chart.tsx`, `package.json` e `bun.lock`; qualquer outro primitivo que o CLI tenha
  tocado volta com `git checkout -- src/components/ui/<arquivo>.tsx`. **`react-is` 19.3.0 exato** entra no mesmo commit
  (`bun add --exact react-is@19.3.0`): o que o Bun iça sozinho é o 17.0.2 do `pretty-format`, que satisfaz o peer do
  recharts mas não reconhece elementos do React 19 (o `isFragment` do recharts falharia em silêncio). Edições no primitivo,
  registradas no `ui-registry`: `// biome-ignore lint/security/noDangerouslySetInnerHtml: …` dentro da tag do `ChartStyle`
  (acima de `dangerouslySetInnerHTML=`; nunca desligar a regra no `biome.json`), `formatInteger` no lugar de
  `item.value.toLocaleString()` e `tabular-nums` no lugar de `font-mono` no `ChartTooltipContent`. O `chart.tsx` importa
  `cn` de `"cn"`, como todo primitivo. No gráfico: `accessibilityLayer`, altura explícita, `isAnimationActive` falso com
  `prefers-reduced-motion` e uma tabela `sr-only` com o número de cada dia. Nunca `Fragment` dentro de `LineChart`.

## 3. Tailwind CSS v4

- Configuração **CSS-first** em `src/app/globals.css` (`@theme inline`, `@custom-variant dark`).
  Não existe `tailwind.config.js`. Token novo entra lá (claro **e** escuro) e é documentado no
  `ui-tokens.md`.
- Só classes semânticas (`bg-background`, `text-muted-foreground`…). Proibido cor crua.
- Fonte: `next/font` define `--font-sans` (Geist), `--font-geist-mono` e `--font-satoshi` (§17) no `<html>`;
  o CSS lê essas variáveis (`--font-heading: var(--font-satoshi)`, utilitário `font-heading`). Mudou a fonte?
  Mude o `variable` no `layout.tsx` junto.
- **Armadilhas que custaram rodadas no visual novo** (prove foco, contraste e tamanho por estilo calculado
  no navegador, nunca só pela string da classe):
  - `outline-none` na base mais `focus-visible:outline-2` não desenha nada: o `outline-none` grava
    `--tw-outline-style: none`, e o `outline-2` usa essa variável. Junte `focus-visible:outline-solid`.
  - O merge do `cn` descarta o `focus-visible:ring-3` da base quando um `focus-visible:ring-0` vem depois,
    mas mantém os dois com `ring-0!` (o `!` muda a chave do conflito); quem apaga o anel, nos dois
    caminhos (pelo `cn` e no `buttonVariants` cru), é o `!important`.
  - O merge do `cn` descarta um `leading-*` que vem **antes** de um `text-*` (o tamanho de texto também
    define a altura de linha): ponha o `leading-*` depois.
  - `buttonVariants` cru num `<Link>` não passa pelo `cn`, e quem decide entre duas classes do mesmo
    grupo é a ordem do CSS gerado, não a da string. Foi assim que o `border-transparent` da base apagava
    a borda do `outline`; por isso cada variante declara a própria cor de borda.
  - Na paleta nova `--muted` = `--card` = `--popover`: `bg-muted` (e `hover:bg-muted`) dentro de cartão,
    diálogo ou Sheet não aparece. Use `accent` (`ui-rules.md §6`).

## 4. Biome 2.4

- `bun run lint` = `biome check` (só verifica). `bun run format` grava a formatação.
- Para corrigir só alguns arquivos: `bunx biome check --write <arquivos>`.
- Domínios `next` e `react` ligados no lint.
- A pasta `drizzle/` (migrações geradas) fica **fora** do Biome: o drizzle-kit reescreve esses
  arquivos e não segue a formatação do projeto.
- `biome.json` tem `overrides` que desligam 7 regras (`noDocumentCookie`, `noDoubleEquals`,
  `noArrayIndexKey`, `useSemanticElements`, `useKeyWithClickEvents`, `noLabelWithoutControl`,
  `useExhaustiveDependencies`) **só** em `src/components/ui/**` e `src/hooks/use-mobile.ts`
  (código gerado pelo shadcn). Depois de `bunx shadcn add`, rode `bun run format && bunx biome check --write`.
  O `sonner.tsx` gerado tem dois `as` (`ToasterProps["theme"]`, `React.CSSProperties`): é código
  gerado, fica como está.
- `.gitattributes` força LF (`* text=auto eol=lf`): o Git desta máquina tem `core.autocrlf=true`
  e CRLF reprova o `biome check`.

## 5. Drizzle ORM 0.45 + Neon

- **Driver (D18): `drizzle-orm/node-postgres`** + `Pool` do `pg`, registrado com
  **`attachDatabasePool`** do `@vercel/functions` (recomendação da skill oficial do Neon para
  Vercel Fluid compute). Escrita multi-statement em **`db.transaction()`**. Schema em
  `src/db/schema/` (um arquivo por área, reexportado por `index.ts`; passado ao `drizzle()` para a query relacional). O domínio recebe `db: Db` por parâmetro (`src/db/types.ts`); só `src/db/index.ts` importa `server-only` (scripts e E2E usam `src/db/client.ts`).
- **Não troque para `@neondatabase/serverless`** sem motivo: ele é a escolha do Neon para edge e
  serverless sem pool reutilizável, não para a Vercel com Fluid compute.
- **URLs:** `resolveDatabaseUrls()` (`src/db/databaseUrl.ts`) decide — pooler para o app, direta
  para o drizzle-kit — e aceita as duas convenções de nome do Neon. Sempre `sslmode=verify-full`.
- **Channel binding** é `enableChannelBinding: true` no `Pool` — o `pg` não lê o
  `channel_binding=require` da URL.
- **Datas do Better Auth:** as tabelas dele usam `timestamp` sem fuso; o Drizzle grava e lê em UTC (`toISOString`), então não há deslocamento; `defaultNow()` nessas colunas depende do `TimeZone` da sessão do Postgres (o Neon usa UTC).
- **Local = branch de desenvolvimento do Neon;** produção só na Vercel.
- **Pool em dev** fica no `globalThis` para o HMR não vazar conexões.
- **Testes: `drizzle-orm/pglite`** (`@electric-sql/pglite`), Postgres em processo, aplicando as
  migrações de `drizzle/` com o migrator do PGlite. Mesma API de `db.transaction()` — o módulo de
  banco é trocado no teste, o código de domínio não muda.
- **Não use `db.batch`**: ele não existe no driver de teste.
- **`time` é texto.** O Drizzle e o `pg` devolvem `time` como `"HH:mm:ss"` e aceitam `"HH:mm"` na
  entrada; o app trafega `"HH:mm"` (`fromDbTime`/`toDbTime` em `src/features/admin/timeOfDay.ts`).
  `CHECK` violado = SQLSTATE `23514`; índice único violado = `23505`.
- **Erro do driver embrulhado.** O Drizzle 0.45 coloca o erro do driver em `error.cause`: o SQLSTATE
  e o nome do índice estão em `error.cause.code` e `error.cause.constraint`. Use `sqlStateOf`,
  `constraintOf` e `isUniqueViolation` (`src/features/admin/dbErrors.ts`), nunca `error.code` direto.
- **Nome único sem diferença de caixa** = ``uniqueIndex("…").on(sql`lower(${t.name})`)``; composto por
  setor: ``.on(t.sectorId, sql`lower(${t.name})`)`` (esse índice já cobre a FK `sector_id`, então não
  há `index()` separado). Verificado no Neon de dev: `datcollate = datctype = C.UTF-8` e
  `lower('ÁGUA') = lower('água')`, então "Água" e "ÁGUA" colidem em produção como no PGlite.
- **`FOR UPDATE`:** `tx.select(…).from(t).where(…).for("update")` roda no `pg` e no PGlite; o domínio
  usa para trancar os administradores ativos (último admin) e as linhas de um setor (reordenar).
- **O dashboard lê a mesma fonte do histórico (Fase 5).** `historySource` e `historyPairsSql` (`features/handovers/history.ts`, extraídas
  em commit só de refatoração) alimentam a lista `/passagens`, os números das Passagens e o CSV: esperadas, situação e "sem passagem"
  nunca têm SQL próprio, então número e lista não divergem. A coluna `u.expected` marca o par encerrado. `endsLocalSql(dia)` e
  `nowLocalSql(now)` escrevem o fim do turno e o "agora" em São Paulo (o `now` injetado entra como `${now.toISOString()}::timestamptz`).
- **Zeros e dias sem contagem vêm do SQL, nunca do JS:** `generate_series(from::date, to::date, '1 day')` para a série diária dos
  Controles (2N dias, os zeros incluídos) e para os pontos do Estoque (`null` no dia sem contagem); `DISTINCT ON (item_id)` com
  `ORDER BY operational_date desc, ends_local desc, delivered_at desc, id desc` para "a última contagem"; `count(*) filter (where …)`
  para as situações. `bigint` e `sum` voltam como texto: `.mapWith(Number)`; `avg` e `extract(epoch …)` ganham `::float8`. Nunca
  `rows.length` como número do painel e nunca soma de pontos ou de fatias em JS.
- **Tabela `request` sem alias** nas consultas do dashboard: os fragmentos de `features/requests/sql.ts` escrevem `"request"` por extenso;
  `request r` falha com `missing FROM-clause entry for table "request"`.
- **`db.select({ … })` sem `.from()` não executa** nesta versão do Drizzle (o builder não é
  "thenable"). Para um SELECT só de subconsultas use ``.from(sql`(values (1)) as one(n)`)``
  (`getAdminOverviewCounts`). `count(*)` volta como `bigint` (texto no driver): converta com
  `.mapWith(Number)` ou use o `count()` do `drizzle-orm`.
- **Subconsulta correlacionada:** num `SELECT` de uma tabela só o Drizzle tira o prefixo das colunas; dentro de
  ``sql`(select … where u.sector_id = ${sector.id})` `` o `"id"` resolveria para a tabela de dentro. Escreva
  a coluna externa por extenso (`"sector"."id"`) ou use JOIN/GROUP BY, e teste com dois registros de
  contagens diferentes (`listSectors`).
- **`FOR SHARE`:** a checagem de "setor ativo" (`updatePerson`, `setPersonActive`, `createTeamInvite`,
  `createShift`, `createItem` e, na Fase 4, `createRequest`, `moveRequest`, `cancelRequest`, `addComment` e `deleteComment`) lê o setor com `.for("share")` dentro de `db.transaction`; serializa com o
  `FOR UPDATE` de `setSectorActive`. Fora de transação a trava some no fim do statement. Nas solicitações a leitura é `lockSectorShare` (`features/requests/loaders.ts`), e `createRequest` lê também o destino da lista e os itens de estoque com `.for("share")`.
- **Identity `ALWAYS` para ordem total (`request_status_event.seq`).** `integer("seq").notNull().generatedAlwaysAsIdentity()`: o
  banco atribui a ordem de inserção. `changed_at` empata o tempo todo (criação e primeiro movimento com o mesmo `now`; os
  testes injetam o mesmo relógio) e o `id` é uuid aleatório, então **toda** ordenação de eventos é `changed_at, seq`, nunca
  `id` (verificado: `DISTINCT ON … ORDER BY changed_at DESC, id DESC` errou o status em 26 de 50 execuções). Na migração
  gerada a identity fica dentro do `CREATE TABLE` (nenhum `CREATE SEQUENCE` solto) e valor explícito em `seq` é recusado
  (`428C9`).
- **`DISTINCT ON` para "o último até um instante"** (`listOpenRequestsAtDelivery`): CTE com
  `db.$with("last").as(db.selectDistinctOn([requestStatusEvent.requestId], { … }) … .orderBy(requestId, desc(changedAt), desc(seq)))`
  filtrada por `changed_at <= T`; o filtro "aberta" (`to_status in (…)`) fica na consulta **externa**, nunca dentro do `DISTINCT ON`
  (dentro, pegaria o último evento aberto de uma solicitação já entregue antes de T). As colunas do CTE entram nos fragmentos
  de SQL (`daysInStatusSql`, `staleSql`) como colunas, sem `.as()`.
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

- O registry vem declarado no `components.json` (`"registries": { "@kokonutui": "https://kokonutui.com/r/{name}.json" }`).
  Sem essa chave, `bunx shadcn@latest add @kokonutui/<nome>` falha (registry não configurado).
- Entram **pelo CLI**: `bunx shadcn@latest view @kokonutui/<nome>` mostra o código e
  `bunx shadcn@latest add @kokonutui/metric-card @kokonutui/spending-ring --yes` grava em
  `src/components/kokonutui/` (os dois não trazem dependência nova). Depois de todo `add`, rode
  `git status` e restaure (`git checkout -- src/components/ui/<arquivo>.tsx`) qualquer primitivo
  que o CLI tenha tocado: o CLI nunca decide sozinho sobre um arquivo que já existe.
- O primitivo `chart` (recharts) puxa o `card.tsx`, que já existe: `echo n | bunx shadcn@latest add chart --yes`.
  O `--yes` **não** responde o prompt "overwrite?" (sem stdin o CLI aborta e não grava nada; não
  existe `--skip-existing`); o `n` recusa e o CLI grava só `src/components/ui/chart.tsx`,
  acrescenta `"recharts": "3.8.0"` ao `package.json` e relata `Skipped 1 file: card.tsx`.
  Fixe junto, no mesmo commit, `bun add --exact react-is@19.3.0`: o `react-is` que o Bun içou é o
  17.0.2 (do `pretty-format`), que satisfaz o peer do recharts mas não reconhece elementos do
  React 19, e o `isFragment` do recharts falharia em silêncio. Nunca `Fragment` dentro de um
  gráfico do recharts.
- **Adaptação obrigatória na instalação** (o código vem em inglês e com cor crua):
  1. trocar `zinc-*`/`emerald-*`/`rose-*`/`orange-*`/`sky-*`… por tokens (`foreground`,
     `muted-foreground`, `border`, `muted`, `card`, `chart-1..4`, `*-foreground` das situações);
     a cor pertence à entidade (turno, situação) e nunca cicla; `chart-5` e acima são proibidos
     (guarda em `chartPalette.test.ts`);
  2. textos e `Intl.NumberFormat`/datas em **pt-BR** (`formatInteger`, `formatDecimal`, `formatDateBR`);
  3. número com unidade, sem moeda; `export default` vira export nomeado (`MetricCard`, `SpendingRing`);
  4. `metric-card`: período **controlado** pelo dashboard (prop), sem as pílulas internas; os
     dados cobrem **2× o período** (ele compara com o período anterior); o cartão **nunca soma**:
     o total, o total anterior, o total de cada dia e o de cada turno vêm do SQL;
  5. estados: vazio ensina (sem passagens, sem fatia), um segmento só, mais de quatro turnos
     (do 5º em diante a cor neutra, cada turno com a própria linha);
  6. `motion-reduce:` nas transições CSS e `prefers-reduced-motion` nas animações em JS; alvo de
     toque ≥ 44px abaixo de `md`; alternativa em texto (`aria-valuetext`, tabela `sr-only`);
  7. **React Compiler**: o `spending-ring` cru faz o Compiler desistir do componente inteiro, em
     silêncio (o `bun run build` não avisa). Evite parâmetro padrão que lê ref, função que se
     reagenda dentro do próprio `useCallback` e `let` reatribuído dentro de `useMemo`; confira
     com `bun scripts/rc-check.mjs <arquivos>` (cada arquivo com `compiled` ≥ 1 e nenhum `CompileError`; o script é do repositório e sai com código 1 se algum arquivo falhar).
- São `"use client"` com animação própria (respeitam `prefers-reduced-motion`). Recebem dados
  já agregados no servidor — nunca buscam nada.
- Registre cada um no `ui-registry.md`, com as adaptações feitas.

## 7. Zod 4 · instalado na Fase 1

- Fonte da verdade dos contratos das Server Actions; tipos com `z.infer`.
- O **mesmo** schema valida no servidor e dá feedback no client.
- Em uso: `parseAuthEnv` (`src/lib/auth/env.ts`). API do Zod 4: `z.url()` (não `z.string().url()`) e mensagem por `{ error: "…" }`.
- **Fase 2:** os schemas das Server Actions de `/admin` ficam em `src/features/admin/schemas.ts` (sem
  `server-only`): o mesmo schema valida no formulário e na action. `firstFieldErrors(error)` percorre
  `error.issues` e guarda a 1ª mensagem por campo (`issue.path[0]`; `z.flattenError` tiparia `fieldErrors` como `{}`); `.refine` com `path` marca o campo certo
  (`endsAt`, `sectorId`, `unitOther`).

## 8. Better Auth 1.7 + passkey

> A doc atual é https://www.better-auth.com/docs e o código em `node_modules/better-auth/dist`. A CLI atual é o pacote `auth` (`bunx auth …`), **não** `@better-auth/cli` (defasado). Versão fixada em `1.7.27` junto com `@better-auth/passkey` e `@better-auth/core`.

- **Fábrica, não singleton (T1).** `createAuth(db, env)` recebe o banco; o singleton `auth` de `src/lib/auth/index.ts` só existe no app. Teste e E2E usam a fábrica.
- **Schema à mão + guarda (T3).** `src/db/schema/auth.ts` copia a saída da CLI, trocando `user.sector_id` por `uuid` com FK. A CLI não consegue importar a config (cadeia `server-only` + schema), então o teste guarda com `getAuthTables` compara o schema com o que a lib espera: ao atualizar o Better Auth, rode a CLI numa pasta à parte, compare e ajuste o arquivo.
- **Convite no `user.create.before` (T4, T5).** Consome o convite lido do cookie e injeta `role` e `sectorId` (`inviteSignupData`); **não** força `emailVerified` (o convite não prova o e-mail: fica `false` no e-mail e senha e com o valor do provedor no social); o `after` grava `used_by`. Sem `ctx` o hook recusa. Cadastro por e-mail já existente falha **antes** do hook e não gasta convite (há teste).
- **Adapter sem `transaction` (T6).** Ligado, o hook consultaria fora da transação e o PGlite (uma conexão) travaria.
- **`APIError` com `code`.** Em hook, todo `throw` é `APIError` de `better-auth/api` com `code`; `Error` comum vira 500 sem corpo, e no callback OAuth só `APIError` com `code` vira redirect `?error=<code>`. Na tela, **nunca** renderize `error_description` (texto do servidor na URL): use só `authErrorMessage(code)` (mapa `AUTH_ERROR_MESSAGES`, com fallback).
- **Sem `cookieCache` e sem `nextCookies()` (T7).** Desativação vale na hora. Cadastro, login e passkey vão pelo `authClient` (HTTP, onde o rate limit atua); nenhum `auth.api.sign*` roda em Server Action.
- **Rate limit (T8).** Better Auth com `storage: "database"` (tabela `rate_limit`), ligado só em produção: `/sign-in/email` 30 por 60 s e `/sign-up/email` 10 por 60 s (`customRules` da `createAuth`); os demais `/sign-in*` e `/sign-up*` (social) seguem o padrão do Better Auth, 3 por 10 s; os endpoints de passkey ficam em `/passkey/*` e caem no padrão geral de 100 por 10 s. A janela conta a partir da **última** requisição permitida (cada requisição aceita move `lastRequest`). IP: sem `trustedProxies`, o Better Auth só confia em `x-forwarded-for` quando ele tem **um único valor**; com vários valores todos caem num balde compartilhado por caminho (`no-trusted-ip|<path>`); na Vercel o cabeçalho tem um valor só. No bloqueio (429) a tela mostra `Muitas tentativas nesta rede. Espere um minuto e tente de novo.` (código `RATE_LIMITED`, deduzido de `status === 429` em `errorCodeOf`). Atua só no router HTTP (`/api/auth/*`), nunca em `auth.api.*` chamado direto. Uma `customRules` com a mesma path sobrescreve a regra especial padrão.
- **Endurecimento da Fase 6 (`createAuth.ts`).** (1) `advanced.ipAddress.ipAddressHeaders: ["x-forwarded-for"]`, só ele: a Vercel o sobrescreve com o IP do cliente; `x-real-ip` e `x-vercel-forwarded-for` seriam forjáveis fora dela (P22). (2) `verification.storeIdentifier` com `overrides: { "reset-password:": "hashed" }` (`RESET_PASSWORD_PREFIX`): o banco guarda só o hash do token de redefinição; o resto continua `plain`. (3) `emailAndPassword.revokeSessionsOnPasswordReset: true`; continua **sem** `sendResetPassword` (`POST /request-password-reset` responde `RESET_PASSWORD_DISABLED`). (4) `user.create.after` apaga o cookie `closery_invite` com `setCookie(..., { ...inviteCookieOptions(...), maxAge: 0 })` (P16). (5) `logger: { log }`: o logger padrão imprime o erro cru e o erro do Drizzle carrega o SQL e os parâmetros; só o nível `error` (com o `Error` dos argumentos ou `null`) e o aviso `Rate limiting could not determine a client IP` passam, os dois por `logServerError` (contextos `better-auth` e `better-auth:ip-desconhecido`); os outros avisos são descartados. (6) `onAPIError: { throw: true }` + o embrulho do route handler: sem isso o roteador do `better-call` imprime `# SERVER_ERROR: <erro>` com `console.error` por conta própria quando a exceção não é `APIError` (o erro do Drizzle carrega o SQL e os parâmetros), fora do alcance do logger. Com `throw: true` o `onError` do Better Auth relança; o `catch` do roteador devolve a resposta normal para `APIError` (nada muda para ele: 401 e o código de erro de sempre) e relança o resto, então aquela linha nunca roda. `src/app/api/auth/[...all]/route.ts` embrulha `GET` e `POST` de `toNextJsHandler(auth)` em `try/catch`: `unstable_rethrow(error)`, `logServerError(error, "better-auth")` e `Response` 500 sem corpo (não cria rota nova). **Resíduo (P75):** só o `⨯ Error` que o próprio Next imprime para erro não tratado de Server Component e de rota.
- **Redefinição pelo admin (Fase 6, T5).** O `POST /reset-password` só procura a `verification` `reset-password:<token>` (hash, por causa do `storeIdentifier`) com `value = userId`; a exigência de `sendResetPassword` existe só no `/request-password-reset`. Quem grava é sempre o `(await auth.$context).internalAdapter.createVerificationValue` (respeita o hash): nunca `db.insert(verification)` com o token cru. O erro de token vencido, usado ou inexistente é `INVALID_TOKEN` (400; mapeado em `AUTH_ERROR_MESSAGES`). Os testes do `createPasswordResetLink` fazem o reset de verdade pelo `auth.handler` (precisa do cabeçalho `origin`) e são o guarda contra mudança do formato interno em upgrade do Better Auth.
- **Teste de IP (`ipUnknown.test.ts`).** O Better Auth decide "é teste?" quando o módulo carrega (`NODE_ENV=test` ou `TEST` verdadeiro; o Vitest define `TEST=true`) e, sendo teste, devolve `127.0.0.1` em vez de cair no balde `no-trusted-ip`. Para provar o comportamento de produção o teste fixa `NODE_ENV=production` e `TEST` vazio dentro de `vi.hoisted`, em arquivo próprio (o aviso de IP sai uma vez por processo).
- **Vínculo implícito desligado (T13).** `account.accountLinking.disableImplicitLinking: true`; o código `account_not_linked` está no mapa de mensagens.
- **Códigos do WebAuthn (T14).** `signIn.passkey` e `addPasskey` devolvem o código cru do `@simplewebauthn/browser` quando a cerimônia falha no navegador; traduza com `passkeyErrorCode(code, "authenticate" | "register")` antes de `authFormError`. Não acrescente esses códigos ao `AUTH_ERROR_MESSAGES` (os testes da Tarefa 6 comparam as chaves por igualdade).
- **Social (T9).** `disableImplicitSignUp: true`. Em `/entrar` use `requestSignUp: false` (sem conta: `?error=signup_disabled`); no convite use `requestSignUp: true` com o cookie já gravado. Facebook sem e-mail volta `email_not_found`. Apple só na Fase 6 (P6).
- **Cookie do convite (T10).** `closery_invite`, `httpOnly`, `SameSite=Lax` (Strict não volta no callback OAuth), `Secure` em produção, `path=/`, 1 h; gravado por `armInvite`, nunca por página; apagado no `user.create.after` depois do cadastro (P16).
- **Campos adicionais** (`role`, `sectorId`, `deactivatedAt`) com `input: false`: o valor enviado pelo cliente é descartado (ou dá 400); só o hook define `role` e `sectorId`.
- **Sessão no servidor.** `getAuthz()` (`cache()` do React) dentro de `<Suspense>` (Cache Components); nunca em função `"use cache"`; Server Component não grava cookie: por isso `getAuthz` lê com `query: { disableRefresh: true }` (sem renovar; a checagem de expiração vem antes) e a única renovação é do `SessionKeepAlive` (cliente, no layout `(app)`): `authClient.getSession()` uma vez ao montar, e o `/api/auth/get-session` HTTP regrava banco e cookie juntos quando a sessão passa do `updateAge` (1 dia). Conferido em `better-auth/dist/api/routes/session.mjs`: expiração ~linhas 156-166, `disableRefresh` ~linhas 171-182 e 187, ramo `needsRefresh` → `updateSession` + `setSessionCookie` ~linhas 201-216.
- **Passkey.** `addPasskey` exige sessão recente (`SESSION_NOT_FRESH`); `rpID` e origem derivam de `BETTER_AUTH_URL`; passkey de `localhost` não vale em produção e o domínio de preview da Vercel é outro. Login: `autoComplete="username webauthn"` + `signIn.passkey({ autoFill: true })` e o botão.
- **Env.** `BETTER_AUTH_SECRET` (≥ 32 caracteres) e `BETTER_AUTH_URL` precisam existir também no build e na Vercel.

## 9. Vitest + PGlite + Testing Library

- **Comandos:** `bun run test` (= `vitest run`) e `bun run test:watch`. **Nunca `bun test`** (é o runner do Bun). Node ≥ 22.12 (exigência do Vitest 5).
- **`vitest.config.ts`** usa `test.projects`: `node` (`src/**/*.test.ts`, `test/**/*.test.ts`, globalSetup) e `dom` (`src/**/*.test.tsx`, jsdom, setup do Testing Library). `resolve.tsconfigPaths: true` resolve `@/*` (sem `vite-tsconfig-paths`) e não há `@vitejs/plugin-react`. Filtrar: `bunx vitest run --project node`.
- **`server-only`** é trocado por `test/empty.ts` com `test.alias` (caminho absoluto via `fileURLToPath`; `URL.pathname` gera `/C:/…` no Windows).
- **Dump migrado.** `test/global-setup.ts` migra `./drizzle` uma vez e grava `node_modules/.cache/closery-test/migrated.tar`; `createTestDb()` carrega o dump (~1,4 s contra 3 a 6 s de `initdb` + migrate) e é regerado a cada execução. Um PGlite por arquivo de teste (`beforeAll`/`afterAll`).
- **`resetDb(client)`** apaga as linhas de `TABLES` com `session_replication_role = replica`; o teste `test/db.test.ts` compara `TABLES` com `pg_tables`: tabela nova no schema exige atualizar `TABLES`.
- **PGlite não prova concorrência.** É uma conexão só e serializa tudo: `Promise.all` de dois consumos passa até com `SELECT` + `UPDATE` não atômico. Escreva a atomicidade no SQL (um `UPDATE … RETURNING`), teste a invariante em sequência (o segundo consumo devolve 0 linhas) e revise a forma da query; corrida real só contra um Postgres de verdade (branch do Neon), registrada como limite aceito.
- **Injeção de `db`** é o padrão; `vi.mock("@/db", async () => …createTestDb)` (factory assíncrona, `vi.mock` é içado) para a camada fina (actions e route handlers) e para os Server Components de lista que leem o PGlite (`ShiftsAdmin`, `ItemsAdmin`); o projeto `dom` roda o mesmo `globalSetup`, com timeouts de 15 s/30 s.
- **Componentes:** `@testing-library/react` + `user-event` + `@testing-library/jest-dom/vitest`, com `cleanup()` no `afterEach` (sem `globals`). Página assíncrona não renderiza no Vitest; folha assíncrona pode ser testada com `render(await Componente())` e sessão mockada; a composição fica no Playwright.
- **jsdom 28** (o 31 exige Node ≥ 22.22.2). jsdom não tem `window.matchMedia`, que o `useIsMobile` do sidebar chama: `test/setup-dom.ts` faz o polyfill (desktop por padrão). O `hover` do user-event não abre o Tooltip do Base UI: use `fireEvent.pointerEnter` + `mouseEnter`.
- **Auth em teste:** `createTestAuth(db)` e `signUpWithInvite(auth, token, …)` (o convite vai no header `cookie: closery_invite=…`). O rate limit não afeta `auth.api.*`.
- **Permissão em teste de domínio e de action:** `authzOf({ role, … })` (`test/authz.ts`) monta o
  `Authz` (admin sempre com `sectorId` nulo); a action de operador, com `requireAdmin` mockado para
  lançar `notFound`, não toca o banco. **Guardas estáticos** que leem arquivos: `appPagesAuth.test.ts`
  (páginas), `actionsAuth.test.ts`, `actionsInventory.test.ts` e `actionsGuards.test.ts` (actions e
  qualquer `"use server"`), `pendenciasDoc.test.ts` (índice, seções e próximo id de `pendencias.md`) e
  `uiRegistryDoc.test.ts` (todo componente de `/admin`, `/passagens` e `/solicitacoes` e cada primitivo novo aparece em `ui-registry.md`). Na Fase 4 o `appPagesAuth.test.ts` ganhou a lista fechada `NULL_SLOT_PAGES` (páginas do slot `@detalhe` que só devolvem `null`: desde o PR B, `@detalhe/page.tsx` e as nove do espelho por segmento, §14) e o harness dos testes de migração é `test/migrations.ts`. No PR B entrou `src/app/routeStructure.test.ts`, que roda o validador de rotas do próprio Next sobre a árvore real de `src/app` (§1).
- **Route Handler (Fase 5).** Testa-se chamando `GET(new Request("http://closery.local/api/dashboard/export?periodo=7"))` com
  `@/lib/auth/session` (`requireUser`), `@/db` (getter que registra o toque no banco) e `next/headers` (`cookies`) mockados e o
  relógio falso. **O BOM se prova em bytes:** `new Uint8Array(await res.arrayBuffer())` e os 3 primeiros bytes `239, 187, 191`;
  `res.text()` remove o BOM e esconderia o defeito. Sem sessão, `requireUser` lança o `NEXT_REDIRECT` e o banco não é tocado. O teto
  (413) se prova num arquivo à parte que mocka o domínio (`route.tooLarge.test.ts`): o teto real não se alcança com dados de teste.
  `src/app/routeHandlersAuth.test.ts` varre todo `route.ts` de `src/app` (lista fechada `PUBLIC_ROUTE_HANDLERS`: `api/auth/[...all]`
  e `api/health`): só `GET`, `requireUser()`/`requireAdmin()` na primeira instrução, sem `"use cache"`.
- **O mundo do critério de pronto (Fase 5).** `test/dashboardWorld.ts` (`seedDashboardWorld`) semeia um cenário só (2 setores ativos e 1
  inativo, turnos, passagens confirmadas, aguardando, não confirmadas, sem passagem, uma correção feita por `correctHandover` e 12
  solicitações) com os números esperados escritos à mão; `dashboardWorld.test.ts` os confere com leitores crus e oráculos em JS
  (`rawHandovers`, `oracle*`: nunca a mesma SQL do painel) antes de os blocos e o CSV dependerem deles; `criterioDePronto.test.ts` tem um
  `describe` por bloco (Passagens, Controles e Estoque, Solicitações, CSV). Caso que precisa de dado fora do mundo (5º turno, fim do turno
  == agora, outro `now`) semeia o próprio cenário no próprio arquivo.
- **Gráficos no jsdom.** O recharts 3.8 com o `ChartContainer` renderiza sem `ResizeObserver` (usa `initialDimension`): não substitua; só
  um teste que precise medir largura faz `vi.stubGlobal` no próprio arquivo, nunca em `test/setup-dom.ts`. O limite de erro de bloco
  (`catchError` de `next/error`) roda no jsdom (só lê contextos que valem `null` fora do App Router): teste o limite real, com
  `console.error` espionado e silenciado. Componente servidor async (`DashboardScreen`, os quatro blocos): `render(await Componente(props))`.
- **Relógio em componente servidor:** `RequestsScreen`, `RequestDetail`, `NewHandover`, `HandoverDetail` e `HomeHandovers` leem `new Date()` (janela de 30 dias, "parada", turno sugerido). O teste usa `vi.useFakeTimers({ toFake: ["Date"] })` + `vi.setSystemTime(spDate(…))` (só o `Date` é falso: PGlite e o resto seguem reais) e restaura com `vi.useRealTimers()` no `afterEach`; nunca depende do dia em que roda.

## 10. Playwright + pglite-socket

- **Comando:** `bun run test:e2e` (= `playwright test`); Chromium (`bunx playwright install chromium`; no CI Linux, `--with-deps`).
- **`playwright.config.ts`:** `webServer` em **array** e em ordem: (1) `bun e2e/start-db.ts` com `port: 54329` (espera TCP; `port` consta como obsoleto na doc, mas o banco não fala HTTP), `reuseExistingServer: false`; (2) `bun run build && bun run start -p 3200` com `url` em `/api/health`, timeout de 300 s. `use.baseURL` explícito (obrigatório com array) e `workers: 1` (um PGlite serializa tudo).
- **Env do `webServer`** é mesclado a `process.env` e o Next não sobrescreve variável já definida (nem string vazia): `DATABASE_URL` e `DATABASE_URL_POOLED` apontam para o socket (o E2E nunca toca o Neon) e `GOOGLE_*`/`FACEBOOK_*` = `""` desligam o social mesmo com credenciais no `.env.local`.
- **pglite-socket:** `maxConnections` precisa ser maior que o `max` do Pool do app (10) mais as conexões do teste (usamos 20); com o padrão (1), a segunda conexão cai com `Connection terminated unexpectedly`. Banco em memória, descartado a cada execução.
- **Produção no E2E.** O app roda com `next start` (`NODE_ENV=production`), então o rate limit está ligado (cadastro por e-mail: 10 por 60 s por IP): cada teste manda `x-forwarded-for` próprio (fixture `clientIp`, repetida em `auth.spec.ts` e `cadastros.spec.ts`) e nenhum faz mais de 2 cadastros.
- **Passkey:** autenticador virtual via CDP (`e2e/virtual-authenticator.ts`), só Chromium, criado **antes** do clique que dispara o WebAuthn. Com ele o autofill de `/entrar` entra sozinho ao abrir a página; o teste do botão desliga `isConditionalMediationAvailable` com `addInitScript`.
- **Base UI:** navegação com cara de botão é `<Link className={buttonVariants()}>` (role link); `Button render={<Link />}` daria role=button e não é usado para navegação. No spec: `getByRole("link")` para "Agora não" e para os itens da sidebar.
- **`/admin` do operador:** confira o texto "Página não encontrada" e o `<title>`, nunca o status (com streaming é 200).
- **`e2e/solicitacoes.spec.ts` (Fase 4).** `/solicitacoes` sem `visao` renderiza o Quadro **e** a Lista (a que não é a do tamanho
  da tela fica `display: none`): o spec abre `?visao=quadro` ou `?visao=lista` e acha colunas e grupos por CSS
  (`section:visible` com `h2`). Com o Sheet aberto o Base UI põe `aria-hidden` no resto da página e `getByRole` deixa de
  enxergar o que está por baixo: **dentro** do Sheet use `page.getByRole("dialog").getBy…`; **por baixo**, `page.locator(…)` e
  `getByLabel`. `getByText` de um título também casa o `#__next-route-announcer__`: use `locator("h1", { hasText })`. O botão
  do cartão e o ↗ têm nomes que se contêm: `getByRole("link", { name, exact: true })`. Toda `insertRequest` do E2E passa
  `createdAt` e `statusChangedAt` relativos a `Date.now()` (o padrão fixo da fixture é para o Vitest e sairia da janela de 30
  dias). Fechar o Sheet é o botão "Fechar"; depois `getByRole("dialog")` conta 0 e a URL volta à do Quadro. `/nao-existe`
  logado responde 404 com "Página não encontrada": o espelho do slot (§14) não cria rota para URL desconhecida (nenhuma
  rota começa com `/[...`; `routeStructure.test.ts`).
- **`e2e/dashboard.spec.ts` (Fase 5).** Os helpers (`PASSWORD`, `test` com `clientIp`, `text`, `unique`, `uniqueEmail`, `ago`,
  `signUpOperator(page, db, sectorId, name)`, `signUpAdmin`, `seedSector(db, { shiftCreatedAt })`) estão em `e2e/helpers.ts`; os quatro specs
  antigos continuam com as cópias deles (P55). `seedSector({ shiftCreatedAt: ago(10 * DAY_MS) })` cria o turno 00:00–23:59 no passado, para os
  dias do período terem pares encerrados e virarem "Sem passagem"; nunca se afirma o par de hoje (só encerra às 23:59). Números se acham
  **dentro da lista ou da região dele**: `getByRole("list", { name: "Números das passagens" })` e `getByRole("region", { name: "Solicitações" })`
  (cada situação aparece duas vezes nas Passagens, no número e na legenda do anel, e `/Entregues/` também casa `Entregues no período`).
  **Download:** `const downloading = page.waitForEvent("download")`, o clique em `Exportar CSV`, `download.path()` e `readFileSync` para
  conferir os bytes do BOM (`EF BB BF`); o navegador sugere o nome do `filename*` (UTF-8, o setor como está), não o ASCII. Para o CSV de
  outro escopo use `page.request.get("/api/dashboard/export?…")` (leva os cookies e o `x-forwarded-for` da página). Dentro de `(app)`, "Página não
  encontrada" se afirma pelo texto, pela barra lateral e por um só `main` (`getByRole("main")` com `toHaveCount(1)`), nunca por `response.status()` (o `notFound()` dentro do `<Suspense>` responde 200).
- **Pool do app no E2E (P49).** O dashboard faz várias leituras em paralelo e isso aumenta o `portal "" does not exist` do `pglite-socket` no log
  do `[app]` (é infraestrutura do E2E, não de produção). O resultado do spike da Fase 5 (3 execuções com o pool padrão e 3 com
  `DATABASE_POOL_MAX=1` só no `webServer` do app) está na `Atualização` de P49. A variável nunca existe na Vercel nem no `.env.local`.
- Cada teste cria os próprios dados (e-mail único, nomes fictícios). Login social ao vivo é checklist manual.
- **`e2e/cadastros.spec.ts`:** a linha de uma lista é um `<li>` dentro de `<main>` (`rowWith(page, texto)`),
  para não casar com a barra lateral; o link do convite sai do campo `Link do convite`;
  `countSessionsByEmail` (`e2e/db.ts`) prova que desativar apaga as sessões (P11). Setor, turno, item
  e destino de cada teste têm nome único (sufixo aleatório): o banco só é limpo entre execuções.
- **`e2e/touch-targets.spec.ts` (Fase 6, P12).** Viewport 390x844 com `hasTouch`; `smallTargets(page)` espera 500 ms (diálogo e menu em
  animação medem 43 px) e lista todo controle visível com menos de 44 px. Isenta só o link `inline` dentro de `p`/`li`/`label` com mais texto
  que ele (sem esse ancestral não há isenção: um `<a>` em `div`, `td` ou `span` é medido) e o link esticado (`after:inset-0`). `expect.soft` por
  tela: o relatório lista todos os achados de uma vez. O operador precisa de uma passagem entregue **ontem** com contagem (sem ela o
  `/dashboard` mostra o estado vazio e nem o link da última contagem nem o total do anel aparecem) e de uma solicitação; o admin abre o
  diálogo `Link de nova senha`. Tela nova entra na lista do spec.
- **`e2e/hydration.spec.ts` (PR B, guarda de hidratação).** No `next start`, antes de qualquer interação: cada página abre
  com `page.goto` (documento novo: depois de uma navegação no cliente a `Activity` deixa a página anterior escondida no
  DOM, e tudo pareceria duplicado), espera o título de nível 1 e o `networkidle`, tira o instantâneo com `snapshotDom` e
  reprova pelo `hydrationProblems` (os dois em `test/hydrationCheck.ts`, testados em `test/hydrationCheck.test.ts`):
  nenhum ou mais de um `main`, número de `h1` por `main` diferente do esperado, id repetido, id ou referência (`for`,
  `aria-labelledby`, `aria-describedby`, `aria-controls`) no formato do cliente (`_r_…_`; o do servidor é `_R_…_`) e erro
  de hidratação. `snapshotDom` vai como texto para o navegador: não pode usar nada de fora da função. Na produção o
  React 19 minifica o erro, e o Next o manda ao `reportError`: ele chega como `pageerror` com `react.dev/errors/418` (ou
  419, 422, 423, 424), não como `console.error` com "hydrat"; o spec escuta os dois e o verificador casa os dois. Nas
  telas de auth o título é o `CardTitle` com `role="heading"` (0 `h1`). Componente que só existe no cliente de propósito
  e gera `_r_` entra na lista fechada `CLIENT_ONLY_IDS` do spec (página, seletor, motivo), nunca num filtro genérico.
  Página principal nova entra na tabela do spec, com o `h1` conferido no código.
- Duração: cerca de 1 min com o cache do Turbopack; 3 a 4 min na primeira vez.

## 11. GitHub Actions (CI)

- **Arquivo:** `.github/workflows/ci.yml`. Roda em todo `pull_request` e em `push` na `main`;
  `permissions: contents: read`; um push novo cancela a execução anterior do mesmo ref.
- **Dois jobs em paralelo (Ubuntu):** `checks` (`check-types`, `lint`, `test`) e `e2e`
  (`playwright install --with-deps chromium` + `test:e2e`, que já inclui o `next build`). O
  relatório do Playwright vira artefato por 7 dias.
- **Versões:** Bun `1.3.3` (igual ao `packageManager`) e Node 22 (Vitest 5 exige ≥ 22.12).
  Ações do GitHub pela tag de major (`checkout@v7`, `setup-node@v7`, `cache@v6`,
  `upload-artifact@v7`); ação de terceiro (`oven-sh/setup-bun`) **fixada por SHA de commit**.
  Ao atualizar, troque o SHA e o comentário da versão juntos.
- **Sem segredos.** O CI não usa o Neon nem credencial nenhuma: os testes usam PGlite e o E2E usa o
  `env` do `playwright.config.ts`. Nunca adicione `DATABASE_URL` real como secret do CI para
  testes.
- **Cache:** `~/.bun/install/cache` e `~/.cache/ms-playwright` pela hash do `bun.lock`;
  `.next/cache` pela hash de `bun.lock` + `src/**` + `next.config.ts`.
- **Linux pega o que o Windows esconde:** caminho de import com caixa errada passa no Windows e
  quebra no CI. Se o CI falhar e local passar, desconfie primeiro disso.

## 12. Server Actions do admin (Fase 2)

- **Onde:** `src/app/(app)/admin/<cadastro>/actions.ts` (`"use server"`), uma por página; a regra de
  negócio fica em `src/features/admin/<cadastro>.ts` (recebe `db` e `now`). O arquivo só exporta
  funções `async`: tipos, constantes e schemas vivem fora dele.
- **Padrão de cada função exportada:** `requireAdmin()` na **primeira linha** (guarda
  `actionsAuth.test.ts`), depois `runAdminAction`:

  ```ts
  export async function createSectorAction(input: unknown) {
    const actor = await requireAdmin();
    return runAdminAction({
      actor,
      schema: createSectorSchema,
      input,
      run: ({ db, input }) => createSector(db, input),
    });
  }
  ```

- **`runAdminAction`** (`src/features/admin/runAdminAction.ts`, `server-only`) é, desde a Fase 4, um embrulho fino do **runner único `runAction`** (`src/features/admin/runAction.ts`, P33) com `revalidate: "/(app)/admin"`; o fluxo abaixo é o do `runAction`: `schema.safeParse` →
  falha vira `INVALID_INPUT` com `fieldErrors`; `run({ db, now, actor, input })`; `revalidatePath("/(app)/admin",
  "layout")` só quando `ok` (com route group o caminho é o do arquivo, como em `revalidatePath.md`); exceção inesperada passa por `unstable_rethrow` (deixa `redirect` e
  `notFound` seguirem) e, se for outra, vira `INTERNAL` com `logServerError(error, "runAction")` (uma linha JSON sem mensagem; code-standards §6) e texto fixo. Nunca devolve
  texto do banco.
- **Erro esperado volta como `AdminResult`** (`ok: false`, `code`, `message` pt-BR pronta); `throw` só para
  falha interna. Erro de nome repetido (23505) consulta o registro conflitante para dizer se ele está
  inativo.
- **Formulário controlado:** o componente guarda o estado, chama a action com um **objeto tipado** dentro de
  `useAdminAction` e só limpa o campo no sucesso; erro de campo vem de `fieldErrors`. Não use
  `useActionState`/`FormData` aqui: o React 19 limpa o formulário não controlado depois do envio.
- **Tempo e paginação:** o domínio recebe `now: Date` quando o tempo importa; listas usam `PAGE_SIZE = 50`
  e `?pagina=`, e a página fora do intervalo é clampada.

## 13. Passagem de turno (Fase 3)

- **Onde:** domínio em `src/features/handovers/*` (recebe `db: Db` e, quando o tempo importa, `now: Date`; devolve `AdminResult` com mensagem pt-BR pronta); Server Actions em `src/app/(app)/passagens/actions.ts` e `src/app/(app)/actions.ts`; telas em `src/components/passagens/*`. O arquivo `actions.ts` só exporta funções `async`; tipos, constantes e schemas vivem fora dele.
- **`runHandoverAction`** (`src/features/handovers/runHandoverAction.ts`, `server-only`): embrulho fino do `runAction` (§12) com `revalidate ? "/(app)" : null`. `schema.safeParse` → `run({ db, now, actor, input })` → `unstable_rethrow` (deixa `redirect` e `notFound` passarem) → `INTERNAL` com texto fixo. A diferença é o parâmetro `revalidate`: `false` no salvamento automático (revalidar re-renderizaria a tela enquanto a pessoa digita), `true` em entregar, confirmar e corrigir (`revalidatePath("/(app)", "layout")`, só quando `ok`). Cada action começa por `requireUser()` (a do setor, `requireAdmin()`).
- **Salvamento automático** (`useHandoverAutosave`): debounce de 800 ms **por campo**, **fila serial** (uma requisição em voo, porque duas Server Actions não têm ordem garantida e o valor velho poderia sobrescrever o novo) e coalescência (o valor mais novo de cada campo vence). `onBlur` envia já; falha mantém o que foi digitado, para a fila e mostra "Não salvo." com "Tentar de novo"; o evento `online` reenvia; `beforeunload` só enquanto houver algo não salvo; ao desmontar envia o pendente. "Entregar turno" e a troca de turno ou dia chamam `flush()` antes.
- **SQL do histórico** (`history.ts`): ``db.select({ … sql<string>`u.col` }).from(sql`(WITH … SELECT * FROM u) as u`)``, sem `db.execute` (o `Db` genérico não tipa o resultado). `timestamptz` cru volta como texto (`"2026-11-21 11:54:27.517+00"`) nos dois drivers: mapeie com ``sql<Date | null>`u.delivered_at`.mapWith(handover.deliveredAt)`` (a coluna do schema traz o decoder); `date` e `timestamp` sem fuso voltam como texto. O total (`count()`) e a página saem do mesmo CTE. O teste de paridade compara `hasShiftEnded` (JS) com o SQL de pares encerrados numa grade de horários (fim == agora conta como encerrado).
- **Cookie do setor** (`sectorCookie.ts`): `cookies().set` só em Server Function ou Route Handler, nunca em Server Component nem no `proxy.ts`; a leitura (`readRememberedSector`) fica dentro de `<Suspense>`. `chooseSectorAction` grava o cookie (`httpOnly`, `sameSite: "lax"`, `secure` em produção, `path: "/"`, 1 ano) e faz `redirect` **fora** de `try/catch`; "Todos os setores" não grava.
- **Fuso e datas:** `America/Sao_Paulo` via `Intl.DateTimeFormat("en-CA", { timeZone, hourCycle: "h23" }).formatToParts` (`saoPaulo.ts`); `operational_date` é texto `"YYYY-MM-DD"`. Teste de tempo usa o relógio injetado (`spDate()` em `test/clock.ts`), nunca o relógio real; o E2E usa turno `00:00–23:59` e a data de hoje na URL.
- **P27 (guardas):** `test/actionGuards.ts` guarda a varredura de actions (extraída de `actionsAuth.test.ts`); `actionsGuards.test.ts` reprova `"use server"` fora de `actions.ts`, action sem `requireUser`/`requireAdmin` na primeira instrução e `admin/**` sem `requireAdmin`; `appPagesAuth.test.ts` exige `requireAdmin` nas páginas de `admin/`.
- **E2E (`e2e/passagem.spec.ts`):** o Next mantém a página anterior escondida ao navegar; `getByText` também casa texto escondido e o modo estrito reprova. Use consultas por papel ou o helper `text()` do spec (`.filter({ visible: true })`) e `{ exact: true }` quando um texto contém o outro ("2 rolo" × "12 rolo").

## 14. Solicitações (Fase 4)

- **Onde:** domínio em `src/features/requests/*` (recebe `db: Db` e, quando o tempo importa, `now: Date`; devolve `AdminResult` com mensagem pt-BR pronta). A lógica pura (status, "parada", permissões, filtros da URL, busca, textos, linha do tempo, `applyMove`, mensagens, links, schemas) não faz I/O e o cliente a importa; leituras e escritas são `server-only`. Server Actions em `src/app/(app)/solicitacoes/actions.ts`: `requireUser()` na primeira instrução e `runAction({ …, revalidate: "/(app)" })`, que só revalida em `ok`. Telas em `src/components/solicitacoes/*`. O arquivo `actions.ts` só exporta funções `async`.
- **Detalhe rápido = rota interceptada.** O slot `@detalhe` do layout de `(app)` tem `@detalhe/(.)solicitacoes/[id]/page.tsx` (um `Sheet` com o `RequestDetail`), `default.tsx` e `page.tsx` (rota `/`) e, desde o PR B, o **espelho por segmento**: uma página nula por segmento de primeiro nível de `(app)` (`admin`, `bem-vindo`, `conta`, `dashboard`, `passagens`, `solicitacoes`) e um `[...rest]/page.tsx` nulo em cada segmento com subrotas (`admin`, `passagens`, `solicitacoes`). Tudo que não é a interceptada só devolve `null`. As páginas nulas são **obrigatórias**: numa navegação no cliente o slot mantém a última página ativa e o Sheet ficaria aberto sobre a próxima tela. **Segmento novo em `(app)` ganha o espelho no mesmo commit** (o `routeStructure.test.ts` reprova o esquecimento; a página nula entra no `NULL_SLOT_PAGES`). Nada de catch-all na raiz do slot: a validação estrita o pendurava nas rotas de fora de `(app)` e o `next dev` dava 404 nelas (§1, P81). **Não** existe `(app)/default.tsx` (com ele uma URL desconhecida viraria página em branco em vez do 404). `(.)` conta segmentos de rota, não `@slot` nem grupo. O layout usa `LayoutProps<"/">`, que já tipa `detalhe`. Páginas do slot não exportam `metadata`; as de `/solicitacoes` exportam `metadata` estático.
- **Links do detalhe.** `<Link href={requestHref(id)} scroll={false}>` abre o Sheet. A página completa (↗, "Abrir página completa", "Ver comentários anteriores") é `<a href>` comum, navegação de documento: um `<Link>` para a mesma URL seria interceptado de novo. A interceptação depende do cabeçalho `next-url` (P44). O `RequestSheet` mantém `open` constante e fecha com `router.back()` com trava contra fechar duas vezes (estado local de `open` não reabriria sob a `Activity`).
- **`useOptimistic` (`useRequestMove`, Quadro e Lista).** O `setOptimistic` roda **dentro** de `startTransition(async () => …)`, de forma síncrona, **antes** do primeiro `await` (fora disso o React loga "An optimistic state update occurred outside a transition"). O estado otimista volta sozinho quando a transição termina; `revalidatePath` só em `ok` (o RSC novo chega antes do fim da transição e o cartão não pisca). O reducer `applyMove` é puro: o cartão muda de coluna e as duas contagens mudam juntas. Falha: `toast.error` e, em `STATUS_CONFLICT`, `NO_CHANGES` ou `NOT_FOUND`, `router.refresh()` (o runner não revalida em falha). Exceção: `unstable_rethrow` e `INTERNAL`. jsdom não tem RSC: o sucesso se prova com `rerender` com as props novas e `console.error` sem chamadas.
- **Transição de status.** `UPDATE request … WHERE id AND status = <o que a pessoa viu>` e `INSERT request_status_event` na mesma transação; 0 linhas → `lockRequest` (`FOR UPDATE`) + `lastChange` devolvem quem e quando venceu (`STATUS_CONFLICT`, ou `NO_CHANGES` quando o vencedor foi para o mesmo alvo). Cancelar também grava o motivo como comentário ligado ao evento. Solicitação não se edita (D-F4-1).
- **Agregação no SQL.** Contagem de coluna e de grupo (`count(*) filter`), abertas, paradas, "dias no status", itens e comentários vêm do SQL (subconsulta correlata com `"request"."id"` por extenso, §5); "Carregar mais" é `?mais_<status>=N` (20 a 200). O `now` injetado entra no SQL como `${now.toISOString()}::timestamptz` (nunca `now()`), e `staleSql`/`daysInStatusSql` têm teste de paridade com `stale.ts` numa grade (72 h exatas não é parada; 72 h + 1 ms é).
- **Busca.** `translate(lower(col), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')` + `ILIKE` com `\` como escape (`%`, `_` e `\` escapados no padrão); as duas strings têm 24 caracteres e o resultado é igual no PGlite e no Neon, sem extensão (`unaccent` não entra). `foldForSearch` (JS) espelha o SQL e a paridade é testada com palavras acentuadas.
- **"Abertas na entrega".** Sem tabela de snapshot: o status no instante T é o último evento com `changed_at <= T` (`DISTINCT ON`, §5); dias e "parada" contam desse evento até T, nunca de `request.status_changed_at` (que é o valor de agora). A seção não junta `sector.active` (o resumo de um setor inativo continua legível).
- **GET nunca escreve; origem.** Abrir o quadro, o detalhe, a passagem ou o Início não cria linha. `createRequest` com `originRef` chama `ensureHandover` **dentro** da transação (escrita iniciada pela pessoa; efeito aceito: o Início passa a "Continuar passagem"); passagem confirmada → `HANDOVER_LOCKED`, nada gravado e o digitado fica no formulário.
- **Setor inativo é só leitura.** Criar, mover, cancelar, comentar e apagar comentário recusam com `SECTOR_INACTIVE`; o detalhe e o resumo da passagem continuam legíveis, sem botões de escrita e com `ReadOnlySectorNotice`. Listas, escolhas, "quem criou", "abertas agora" e o cartão do Início juntam `sector.active = true` (padrão P26).
- **Cache Components.** `cookies()`, `headers()`, `await params`/`searchParams` e a sessão só dentro de `<Suspense>`; nada de `"use cache"` em dado escopado por usuário.

## 15. Dashboard (Fase 5)

- **Onde:** domínio em `src/features/dashboard/*` (`server-only`: `scope`, `sql`, `passages`, `controls`, `stock`, `requests`, `exportCsv`; recebe `db: Db`, o escopo e, quando o tempo importa, `now: Date`); lógica pura sem I/O (`limits`, `types`, `period`, `delta`, `format`, `links`, `csv`, `src/lib/numberFormat.ts`) que o cliente importa; componentes em `src/components/dashboard/*` (blocos, `StatLink`, `BarList`, `StockTrendChart`, `chartColors`) e `src/components/kokonutui/*` (`MetricCard`, `SpendingRing`); o CSV em `src/app/api/dashboard/export/route.ts`.
- **Escopo e período numa função só.** `resolveDashboardScope(db, actor, params, now)` serve a página **e** o CSV; cada função de domínio refaz o escopo com `sectorScopeOf(actor, sectorId)` e exige setor ativo (nunca confia na tela). Operador que monta o `?setor=` de outro setor vê o próprio.
- **Todo número é um `<Link>` gerado por `links.ts`** (nunca uma query montada à mão) para a lista que conta exatamente aquilo; o CSV é `<a href download>` comum, nunca `next/link`. Teste de paridade: o número do painel é o total da lista, **depois da mesma validação que a tela faz** (`itemId` em `listHistoryItems`/`listFilterItems`, `destinationId` em `listFilterDestinations`), senão a tela descartaria o filtro e a paridade mentiria.
- **Agregação no SQL** (`§5`): o cliente só recebe números e strings; o total, o total anterior e o dos segmentos de um turno em foco vêm do servidor (o cartão nunca soma partes).
- **KokonutUI e chart:** `components.json` registra `@kokonutui`; o CLI baixa e o conteúdo final é o código adaptado do plano (tokens, pt-BR, período por prop, estado vazio, `motion-reduce`, alvo de 44 px, número exato acessível, sem dados de demonstração). **React Compiler:** o `spending-ring` cru faz o Compiler desistir do componente inteiro, em silêncio (`bun run build` não avisa); `bun scripts/rc-check.mjs <arquivos>` confere que os arquivos compilam.
- **Cores por entidade**, num módulo só (`chartColors.ts`): turno no slot 1–4 = `chart-1..4`, do 5º em diante `foreground`; situação = o `-foreground` do token do selo, `muted-foreground` para "sem passagem"; série única = `foreground`. Nunca `chart-5` ou acima, nunca cor crua; o guarda `chartPalette.test.ts` mede o que a tela pinta.
- **Blocos que não se derrubam:** `<Suspense>` externa na página (sessão e `searchParams`) e, por bloco, `catchError` de `next/error` com `key` do período e do setor no limite e a `<Suspense>` com esqueleto dentro dele (o `catchError` só limpa o erro quando muda o pathname). Carregando é esqueleto, nunca zero.
- **Teto em toda lista:** 30 cartões por bloco, 8 barras de destino, 12 itens pedidos, 10.000 linhas no CSV, período de até 93 dias; o que passa do teto mostra "Mostrando {n} de {total} …" com o total do SQL.
- **CSV:** BOM, `;`, CRLF em toda linha (inclusive a última), aspas RFC 4180, neutralização de fórmula (`'` antes de `= + - @`, TAB ou CR) só em texto de pessoa, datas `dd/mm/aaaa`, item que a passagem não tem = célula vazia (não `0`); `Content-Disposition` com `filename` ASCII e `filename*` UTF-8.

## 16. Sentry (`@sentry/nextjs`) · Fase 6

- **Versão exata `11.18.0`** (`bun add --exact`). Antes de mexer, a skill instalada do Sentry (se
  houver) e a doc atual (context7): a v11 mudou o que a doc antiga ensina. `withSentryConfig`
  saiu do pacote raiz (`import { withSentryConfig } from "@sentry/nextjs/config"`); `sendDefaultPii`
  **não existe mais** e o padrão de `dataCollection` coleta **tudo** (cookies, cabeçalhos, corpos,
  query, variáveis de pilha, usuário); `tunnelRoute` está obsoleto (e criaria um `route.ts`).
- **Desligado por padrão.** Uma variável só, `NEXT_PUBLIC_SENTRY_DSN` (público por natureza; gravada
  no build: trocar o DSN exige novo deploy). Sem ela `enabled: false` e nada é iniciado nem enviado
  (dev, CI e E2E rodam assim; `playwright.config.ts` fixa DSN e `SENTRY_AUTH_TOKEN` vazios).
- **Opções num lugar só:** `sentryOptions()` em `src/lib/sentry/options.ts` (servidor e navegador):
  `tracesSampleRate: 0`, `maxBreadcrumbs: 0`, sem Replay, `sendClientReports: false`,
  `dataCollection` todo desligado, `beforeSend: scrubEvent`. No navegador, `instrumentation-client.ts`
  tira as integrações `BrowserSession` (manda um envelope de sessão a cada página, com IP e
  navegador, mesmo sem erro) e `BrowserTracing` (sem ela e sem client reports, uma página sem erro
  não manda nenhum envelope: só erros saem). `onRouterTransitionStart` fica, inofensivo sem a
  integração.
  `register()` só inicia com `NEXT_RUNTIME === "nodejs"` (o `proxy.ts` do Next 16 roda em Node).
- **Um ponto de captura para erro tratado:** `logServerError` (escreve a linha de log e chama
  `Sentry.captureException(error, { tags: { context } })`; pula `null`/`undefined` e erro com
  `digest`). Erro **lançado** no servidor chega pelo `onRequestError` do `instrumentation.ts`.
  Ninguém mais importa `@sentry/nextjs` (guarda `test/logGuard.test.ts`: só `src/lib/sentry/*`,
  `src/instrumentation.ts`, `src/instrumentation-client.ts` e `src/lib/logServerError.ts`).
- **`scrubEvent` é a última barreira, não a primeira:** apaga usuário, `request`, servidor,
  breadcrumbs, extras, `logentry`, dados do mecanismo, variáveis de pilha, contextos (menos `trace`)
  e tags com `url` (o valor das demais tags e o `filename`, `abs_path` e `module` de cada frame passam pelo `scrubText`); força `sdk.settings.infer_ip = "never"` (o core mescla a metadata do cliente depois
  do `beforeSend`: apagar a chave não adianta e o Relay inferiria o IP); higieniza `message`, `transaction` e o valor de **toda** exceção (inclusive as
  causas do `linkedErrors`): o SQL e os `params` do Drizzle (`Failed query:` / `params:`), o valor que o
  Postgres repete, token de caminho e de fragmento, query string e e-mail. O que escapar desses
  padrões sai (P69).
- **Build:** sem `SENTRY_AUTH_TOKEN` não há upload nem arquivo `.map` (`sourcemaps.disable`);
  `telemetry: false`; o plugin liga `experimental.clientTraceMetadata` sozinho (aparece em
  "Experiments" no build). `SENTRY_AUTH_TOKEN` nunca entra no CI nem no `.env.local`. Custo medido:
  +67 KB gzip de JS no cliente mesmo desligado (P68).
- **Teste:** nunca fale com o Sentry de verdade. A captura se prova com DSN falso e transporte falso
  (`options.test.ts`: o envelope vira texto e o teste afirma sobre ele); o resto troca o SDK por espião
  (`vi.mock("@sentry/nextjs")`). Se um dia houver CSP, liberar `connect-src https://*.ingest.sentry.io`.

## 17. Satoshi (fonte de display) · visual novo

- **Licença (ITF Free Font License, §01 e §02):** servir a fonte no próprio site é permitido; **disponibilizar os arquivos
  num repositório publicamente acessível é proibido** (o repositório é público). Por isso o `.woff2` **nunca** entra no git
  (`/src/fonts/satoshi/` no `.gitignore`). Também é proibido **subset e conversão**: o script grava os bytes como vieram.
- **Como chega ao app:** `bun run fonts` (`scripts/fetchFonts.mjs`) lê o CSS de
  `https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&display=swap`, pega a URL do `woff2` de cada peso (só
  `cdn.fontshare.com`), baixa, **confere o SHA-256** contra `SATOSHI_SHA256` em `scripts/fontsCheck.mjs`, e só então grava
  `src/fonts/satoshi/Satoshi-{500,700,900}.woff2`. Pula o download quando os 3 arquivos já estão lá com o hash certo.
  Hash diferente ou sem rede: código 1 e uma mensagem que diz o que fazer. As regras puras são testadas em
  `test/fontsCheck.test.ts` e a orquestração (com `fetch` e disco falsos) em `test/fetchFonts.test.ts`.
- **Ganchos:** `predev` e `prebuild` chamam `bun run fonts` (o Bun roda os scripts `pre*`, conferido em 2026-11-27). Na Vercel o
  `bun run build` roda o `prebuild`, e a pasta não sobrevive entre builds: **todo build e todo redeploy baixam a fonte do Fontshare**
  e conferem o SHA-256 (o runbook avisa no B5 e no B17; com o Fontshare fora, o build para: P102). No CI o job do E2E guarda
  `src/fonts/satoshi` em cache (`satoshi-<hash de scripts/fontsCheck.mjs>`), porque o E2E faz `bun run build`; o job `checks` não
  precisa da fonte (nenhum teste importa o `RootLayout`). O script também roda pelo Node (`node scripts/fetchFonts.mjs`): no Node 22
  o `import.meta.main` não existe, e a guarda do CLI compara o `process.argv[1]` com o caminho do módulo.
- **Mudou o hash?** Não aceite no automático. A Fontshare pode ter trocado o arquivo: confira a licença da versão nova, baixe,
  calcule o SHA-256 (`sha256sum`) e atualize `SATOSHI_SHA256` num commit só dele (a chave do cache do CI muda junto).
- **`next/font/local`:** `localFont` em `src/app/layout.tsx` com os 3 pesos (`src` em array, `path` **literal** e relativo ao
  `layout.tsx`), `variable: "--font-satoshi"`, `display: "swap"`, `fallback: ["Geist", "system-ui", "sans-serif"]`. O Next gera o
  ajuste de fallback (Arial) sozinho (`adjustFontFallback`). `globals.css`: `--font-heading: var(--font-satoshi)`; o utilitário é `font-heading`.
- **Artefato público:** o trace do Playwright 1.65 grava o corpo de cada resposta (o `.woff2` entra, em `resources/`) pelo `HarTracer`,
  que só liga junto com os snapshots do DOM. Por isso, no CI, `playwright.config.ts` grava o trace com
  `{ mode: "retain-on-failure", snapshots: false, screenshots: true, sources: false }`: ficam os quadros, os passos e o console, e
  somem o DOM e a aba de rede. Nada de `.woff2` em artefato público. Fora do CI o trace continua completo. Travado em
  `test/playwrightTrace.test.ts`, que avalia a config de verdade com `CI` ligado e desligado (inverter o ternário reprova).
- **Glifos:** `ª` e `º` **não existem** na Satoshi e caem na próxima fonte da pilha (Geist). Nada a fazer; só não conte com eles no display (P93).

## 18. Tema (próprio, sem next-themes) · visual novo

- **Por que não `next-themes`:** o `<script>` anti-flash que ele renderiza dentro de um componente client, acima dos `<Suspense>`,
  faz o React 19 (com Cache Components) refazer no cliente os trechos dinâmicos da página; a cópia do servidor, que chega depois
  pelo streaming, sobra e o conteúdo aparece duplicado (provado no E2E: dois "Nome" em `/convite/<token>`, ids `_r_` e `_R_`).
  O `next-themes` não tem opção para não renderizar o script. O pacote foi removido.
- **Módulo próprio:** `src/lib/theme.ts` (puro) tem `THEME_STORAGE_KEY = "closery-tema"`, `THEME_INIT_SCRIPT`, `readTheme`, `setTheme`
  e `subscribeTheme` (inscritos locais + evento `storage` da chave, que sincroniza abas); `src/lib/useTheme.ts` (`"use client"`) tem o
  hook `useTheme()` -> `{ theme, setTheme }` sobre `useSyncExternalStore` (snapshot do servidor = `"dark"`). **Escuro padrão e sem
  seguir o sistema** (C-V4): só o valor exato `"light"` guardado vale como claro; a escolha fica no navegador, nunca no banco.
- **O script mora no `<head>` do `RootLayout`** (Server Component), via `<script dangerouslySetInnerHTML>`, como o guia
  "Preventing flash before hydration" do Next 16 manda. Ele roda antes da pintura: alterna a classe `dark` do `<html>` e põe o
  `colorScheme`. O `<html>` leva `suppressHydrationWarning`. O `@custom-variant dark (&:is(.dark *))` do `globals.css` continua; o
  claro é a ausência da classe `dark` (não existe classe `light`). A CSP do projeto é só `frame-ancestors 'none'`; se um dia houver
  `script-src`, o script precisa de `nonce`.
- **Não leia o tema no render sem o hook:** no servidor não existe `localStorage`. O visual que depende do tema usa as variantes
  `dark:` do Tailwind (o script decide a classe antes da pintura); o que precisa do valor em JS (`aria-checked`, texto de tooltip,
  tema do Sonner) usa `useTheme()`, que hidrata como `"dark"` e relê o `<html>` logo depois.
- **Sem `disableTransitionOnChange`** (decisão do dono): o knob do `ThemeSwitch` desliza, e as cores com transição também mudam devagar
  na troca de tema.
- **Dev (Strict Mode):** o React pode limpar a classe do `<html>` na remontagem de desenvolvimento, e o switch mostra o claro até recarregar;
  em produção isso não acontece (P101).
- **Teste:** `src/lib/theme.test.ts` executa o script num jsdom. Nos testes de componente, `new Function(THEME_INIT_SCRIPT)()` faz o
  papel do script do `<head>`; limpe `localStorage` e `document.documentElement.className` em `beforeEach`.

## 19. DiceBear (`@dicebear/core` 10.7.0 + `@dicebear/styles` 10.6.0) · visual novo

- **Versões exatas, sem `^`** (`bun add ... --exact`). A 10.7.0 de `styles` não existe; a 11.0.0 (2026-11-25) é nova demais
  para a regra das duas semanas. Trocar de versão exige rodar `src/lib/avatar.test.ts`: ele fixa o SHA-256 da saída de uma semente,
  então uma versão que mude a arte ou os metadados falha alto (a saída é JS puro, sem data, locale ou sorteio, e vale igual no CI).
- **API (conferida no `node_modules` em 2026-11-27):** `import { Avatar, Style } from "@dicebear/core"`,
  `import notionists from "@dicebear/styles/notionists.json" with { type: "json" }`, `new Style(notionists)` uma vez por módulo e
  `new Avatar(style, { seed, backgroundColor: [...] }).toDataUri()` por semente.
- **Só no servidor:** `src/lib/avatar.ts` tem `import "server-only"` e cache em `Map` por semente. Cada data URI tem de 12 a 38 KB (cerca
  de 16 KB na mediana, medido com 40 sementes em 2026-11-27) e sai no HTML e no payload RSC (P92). A semente é
  o **id do usuário** (o avatar não muda quando o nome muda); semente vazia lança erro (o DiceBear sozinho geraria um avatar).
  Os componentes recebem o data URI pronto (`UserAvatar src=...`); nenhum client importa `@/lib/avatar`.
- **Sem rede:** nada de `api.dicebear.com`; o SVG nasce no processo do servidor.
- **Cores:** os 4 fundos (`AVATAR_BACKGROUNDS`) são dados da arte, a única exceção de cor crua do projeto (`ui-tokens.md`);
  o arquivo é `.ts`, fora do guarda `rawColors`.
- **Licença:** código MIT; a arte `notionists` é CC0 1.0 (remix de Notionists, de Zoish). Nada a atribuir na interface.
- **`<img>`:** data URI de SVG não passa pelo `next/image`; o `UserAvatar` usa `<img alt="">` com `biome-ignore
  lint/performance/noImgElement` e o motivo.

## 20. Container queries do Tailwind 4 · visual novo

- **Nativas no Tailwind 4**, sem plugin: `@container/<nome>` marca o contêiner; `@min-[<largura>]/<nome>:` e
  `@max-[<largura>]/<nome>:` aplicam a classe pela largura **dele**, não da janela. Dá para empilhar
  (`@min-[1040px]/main:@max-[1239px]/main:`) e misturar com mídia (`md:@max-[899px]/main:`).
- **O contêiner do app é `@container/main`**, no `src/app/(app)/layout.tsx`, num `div` **sem padding e sem max-width** que
  ocupa a largura toda do `SidebarInset`. A medida é a "área útil" da spec §4.4: a tela menos a sidebar (280px aberta, 0
  recolhida), igual ao `mainW` do protótipo, que conta os 40px de padding. O `div` de dentro é que centra em
  `max-w-[1240px]` e leva `px-10 pb-12 max-md:px-4`.
- **Cortes do Início (spec §4.4):** `@min-[1040px]/main:` (grids em 2 colunas), `@min-[1040px]/main:@max-[1239px]/main:`
  (horário 52px e contador 60px em 2 colunas), `md:@max-[899px]/main:` (saudação 60px). O celular continua no `max-md:`
  (abaixo de 860px), que vence: os tamanhos do celular nunca dependem do contêiner.
- **Armadilha:** `container-type: inline-size` faz o elemento não medir pelo conteúdo; o contêiner precisa de largura dada
  pelo pai (`w-full` dentro do `SidebarInset`, que é `flex-col`). Classe de container query fora de um descendente do
  `@container/main` (um portal, um `Sheet`) não casa com nada: o slot `detalhe` fica fora dele de propósito.
- **Teste:** o jsdom não calcula layout; os testes conferem a string da classe. A medida real é conferida na verificação
  visual (spec §10). Na de 2026-11-27 (Task 16), os pares de 1440px (área útil de 1160px: 2 colunas, horário de 52px) e de 390px
  bateram com o protótipo, e nenhum corte mudou; o corte de 899px não foi medido em captura.

## 21. `pixelmatch` 7.2.0 + `pngjs` 7.0.0 · processo visual

- **Versões exatas, sem `^`, só em `devDependencies`** (`bun add -d -E pixelmatch@7.2.0 pngjs@7.0.0`). São as mesmas das
  ferramentas do PR A, com que os números do `pixel.md` do Início foram medidos: trocar de versão exige rerodar os pares do
  Início (`bun run visual:pairs --screen=inicio`) e comparar com eles.
- **Só em `scripts/visual/` e nos testes dele** (`test/visual/`). Nunca em `src/`: nada disso entra no bundle do app.
- **API (conferida no `node_modules` em 2026-11-27):** `import pixelmatch from "pixelmatch"` (ESM, com tipos próprios) e
  `import { PNG } from "pngjs"` (CommonJS, sem `@types`). `pixelmatch(a.data, b.data, saida.data, largura, altura, { threshold })`
  devolve o número de pixels diferentes e **lança** se as duas imagens não têm o mesmo tamanho: quem chama recorta antes
  (`cropTo` de `scripts/visual/image.mjs`). `PNG.sync.read`/`PNG.sync.write` leem e gravam; `PNG.bitblt` recorta;
  `new PNG({ width, height })` nasce transparente (`createPng` preenche).
- **Threshold 0.1** (`PIXELMATCH_THRESHOLD` em `diff.mjs`), com os padrões da biblioteca para o anti-aliasing
  (`includeAA: false`: o pixel de anti-aliasing detectado não conta). É o mesmo de todos os números desde o PR A.
- **Testes:** os `.ts` de `test/visual/` **não importam** `pngjs` nem `pixelmatch` (sem `@types` no `pngjs`, o `tsc` reprovaria):
  montam as imagens com `createPng` e medem com `diffImages`/`regionDiff`. Nada disso roda no CI além desses testes puros
  (sem navegador, rede, servidor nem a lista de nomes).

## 22. Ferramentas do processo visual (`scripts/visual/`) · PR B

O motor da verificação visual das telas do Claude Design é versionado; tudo o que tem original do protótipo (mapa de
trocas, cópias, capturas e a lista de nomes) fica em `.git/sdd/`. O processo que usa as ferramentas é a skill
`/handoff-visual` (`.claude/skills/handoff-visual/`). Decisão: `architecture.md §10` (2026-11-27, "Processo visual").

- **Saída só em `.git/sdd/`.** O caminho sai de `git rev-parse --path-format=absolute --git-common-dir` mais `/sdd`
  (vale em worktree, onde `.git` é um arquivo), pelo `scripts/visual/paths.mjs`: todo destino passa por
  `assertInsideSdd`, e um `--out` fora dele sai com código 1. Duas exceções, declaradas: `registry.mjs` grava só
  `.context/ui-registry.md`, e `install-hooks.mjs` grava só o `pre-commit` de `git rev-parse --git-path
  hooks/pre-commit` (fora da árvore).
- **Node para o Chromium, Bun para o banco e o seed.** O Chromium do Playwright não abre pelo Bun no Windows: tudo o que
  abre navegador é `.mjs` rodado com `node` (os atalhos `visual:*` já chamam o certo); `db.ts` e `seed/*.ts` rodam com
  `bun`.
- **Portas fixas** (`config.mjs`): banco PGlite em `127.0.0.1:54332`, app em `localhost:3202`; outra URL de banco ou de
  app é recusada. As portas 3000 (outro projeto), 3200 e 54329 (E2E) e 3201 e 54331 (o dono) nunca são usadas.
- **Pessoas e textos inventados.** `scripts/visual/vocabulary.mjs` é a fonte única: Ana, Bruno, Carla e Diego Teste
  (`@example.com`, senha `senha-de-teste-123`), os setores ULD, Carga, Operações e Rampa, os turnos, itens, destinos e
  textos. O seed escreve com ele, e o mapa de trocas do protótipo troca os originais por ele: o pixel compara texto
  igual com texto igual. Texto novo entra ali, e nunca um texto do protótipo.
- **Puro tem teste** em `test/visual/*.test.ts` (o padrão `scripts/smokeChecks.mjs`): sem navegador, rede, servidor nem
  a lista de nomes (o caso que precisa dela usa `it.skipIf`); os testes não importam `pngjs` nem `pixelmatch` direto
  (usam `createPng` e as funções de `image.mjs` e `diff.mjs`). Os CLIs do git e do registro (`check-names`,
  `install-hooks`, `registry`, `registry-diff`) são testados num repositório temporário (`test/visual/tempRepo.ts`),
  sem a configuração global do git. **Nada mais das ferramentas roda no CI.**
- **Um servidor e um navegador por vez**; cada CLI fecha o navegador ao fim de cada estado. As capturas rodam sempre
  com `reducedMotion: "reduce"` e esperam as animações e o `style` pararem (§23).
- **Segredo:** o do ambiente visual é gerado em `.git/sdd/visual-db/secret` e só o `env.sh` o lê; nada o imprime.
- **devDependencies exatas:** `pixelmatch` e `pngjs` (§21), só em `scripts/visual/` e nos testes dele.

**Pastas fora do git:**

```
.git/sdd/
  nomes-proibidos.txt     lista de nomes, e-mails e textos dos protótipos (global, acumula por branch)
  visual-db/              banco visual compartilhado: pgdata/, secret, world.json, state.json, avatars.json
  processo/               o PR B: ledger, proto.config.mjs, proto/, pares/, interacoes/, legibilidade/, medidas/
  visual-<slug>/          cada branch de tela, com a mesma forma
```

**As ferramentas:**

| Ferramenta | O que faz | Como chamar |
|---|---|---|
| `paths.mjs`, `config.mjs`, `vocabulary.mjs` | caminhos conferidos; portas, URLs e argumentos; o vocabulário | importados |
| `db.ts` (bun) | PGlite em disco com as migrações de `./drizzle`, servido na 54332; porta de pé com o banco visual: avisa e sai 0 | `bun run visual:db` |
| `env.sh` | exporta `DATABASE_URL` e `DATABASE_URL_POOLED` (54332), `DATABASE_POOL_MAX=1`, `BETTER_AUTH_URL` (3202) e o segredo; esvazia social e Sentry | `. scripts/visual/env.sh` |
| `seed/index.ts` (bun) | `base` (`world.json`), `state <tela>:<estado> [--setor=<nome>]` (`state.json`), `reopen-invites`, `avatars` (`avatars.json`) | `bun run visual:seed …` |
| `people.mjs` | cadastra as 4 pessoas pela API, com o cookie do convite; "já existe" conta como sucesso | `bun run visual:people` |
| `proto.mjs` | cópias do protótipo: as trocas na ordem (erro pelo número da troca), os `default` do `data-props`, sobra de termo da lista = erro | `bun run visual:proto --config=<relativo a .git/sdd>` |
| `capture.mjs` | captura avulsa do app ou de uma cópia | `node scripts/visual/capture.mjs app <caminho> <LxA> <dark\|light> <saída> [pessoa]` · `… proto <arquivo> <LxA> <saída>` |
| `pairs.mjs` | semeia cada estado, roda os passos, captura os dois lados na mesma altura, mascara e mede página e regiões | `bun run visual:pairs --screen=<tela> --out=<pasta> [estado …] [--sizes=] [--sufixo=]` |
| `measure.mjs` | caixa, tipografia, cor, fundo, raio e padding pelo texto, app contra protótipo; `--so-proto` extrai os px do protótipo | `node scripts/visual/measure.mjs --screen=<tela> --state=<estado> --width=<L> --out=<pasta> [--root=<css>] [--all] [--so-proto]` |
| `probe.mjs` | avalia uma expressão nas duas páginas (ou só no app) depois dos passos: a prova por estilo computado | `node scripts/visual/probe.mjs --screen=<tela> --state=<estado> --width=<L> (--out=<pasta> \| --app-only) "<expressão>"` |
| `interact.mjs` | roda os passos (inclusive a falha de rede) e registra em `<pasta>/interacoes/<estado>-<L>.json`; código 1 se o `expect` do estado falhar | `node scripts/visual/interact.mjs --screen=<tela> --state=<estado> --out=<pasta> [--width=1440]` |
| `audit.mjs` | contraste de texto, alvo de toque abaixo de 860px, rolagem horizontal, borda de campo, fundo que some no do pai | `bun run visual:audit --screen=legibilidade --out=<pasta> [--only=] [--themes=] [--sizes=] [--dir=]` |
| `diff.mjs` | `pixelmatch` (threshold 0.1), recorte ao menor tamanho comum, máscaras iguais nos dois lados | `node scripts/visual/diff.mjs <a.png> <b.png> <saída.png> [máscaras.json]` |
| `sheet.mjs`, `sbs.mjs`, `crop.mjs` | folha de contato; protótipo, app e diferença empilhados com zoom; recorte em tamanho real | `node scripts/visual/<ferramenta>.mjs … --dir=<relativo a .git/sdd>` |
| `check-names.mjs`, `install-hooks.mjs` | a guarda de nomes e o hook (abaixo) | `bun run visual:names …` · `bun run visual:hooks [--remove]` |
| `registry.mjs`, `registry-diff.mjs` | uma entrada do registro; os cabeçalhos entre commits (abaixo) | `node scripts/visual/registry.mjs …` · `node scripts/visual/registry-diff.mjs …` |

Onde a tabela diz `--screen=<tela>`, vale também `--config=<arquivo relativo a .git/sdd>` (uma configuração de rascunho,
fora do git). O `pairs`, o `measure`, o `probe` e o `interact` semeiam o estado de cada par antes de abrir o app (o
`measure --so-proto` não abre o app nem semeia); o `audit` usa o estado que estiver no banco (semeie `geral:rico` antes).
O `visual:proto` lê os avatares do `.git/sdd/visual-db/avatars.json` (`bun run visual:seed avatars`).

**Configuração de tela:** `scripts/visual/screens/<tela>.mjs`, um `export default` validado por `validateScreen`
(`test/visual/screens.test.ts` valida todas e confere cada `seed` em `STATES`), com os estados, o `patch` e as `masks`
do que depende do agora, as regiões e a lista `audit`. Sem nenhum nome: o que identifica pessoa mora no mapa de trocas,
fora do git. Cada branch acrescenta `seed/states/<tela>.ts` e o registra em `seed/states/index.ts`. Os passos de
interação (`steps.mjs`): `click`, `hover`, `focus`, `tab`, `press`, `fill`, `drag`, `wait`, `waitFor`, `failRequests`,
`restoreRequests` e `sample`; a Server Action é `{ method: "POST", header: "next-action" }`.

**`check-names` e o hook** (spec §7):

- **A lista** (`.git/sdd/nomes-proibidos.txt`): uma entrada por linha; linha vazia e `#` não contam; `!<frase>` é
  permitida (sai do texto antes da busca: para a pessoa fictícia que contém um nome da lista). A busca ignora caixa e
  acento; palavra e frase casam só inteiras; e-mail (tem `@`) casa como trecho. Entram os nomes e e-mails do protótipo e
  das screenshots **e os textos operacionais** (descrições, frases, observações, itens e destinos próprios); a palavra
  genérica do domínio que já está no código (setor, ULD, pátio) fica de fora.
- **Os modos:** `--staged` (linhas acrescentadas e caminhos de `git diff --cached`: o `pre-commit`), `--range=<a>...<b>`
  (o diff da branch e as mensagens de `git log <a>..<b>`: o portão, `--range=main...HEAD`) e `--file=<caminho>` (o
  arquivo inteiro, ex.: uma cópia do protótipo).
- **A saída** é `arquivo:linha — termo nº N da lista (linha L)`, `caminho nº K do diff — …` ou `mensagem do commit
  <sha>, linha L — …`: **nunca o termo**, e o caminho que contém um termo vira o número dele. Códigos: 0 limpo, 1 achou,
  2 lista ausente ou vazia ou uso errado (a mensagem diz como criar a lista ou tirar o hook). Falso positivo vira uma
  linha `!<frase>`.
- **O hook:** `bun run visual:hooks` grava em `git rev-parse --git-path hooks/pre-commit` (respeita o `core.hooksPath`)
  um script que primeiro confere se `scripts/visual/check-names.mjs` existe (sem ele: aviso no stderr e código 0; com ele:
  `exec node scripts/visual/check-names.mjs --staged` decide), marcado com `# closery:check-names`; regravar é
  idempotente; um `pre-commit` sem a marca é recusado (código 1) e fica para juntar à mão; `--remove` apaga só o nosso.
  Um achado é texto a trocar, nunca hook a contornar.
- **Branch sem `scripts/visual/`** (uma branch antiga, ou a `main` antes do merge do PR B): o hook não acha o script,
  avisa no stderr e **deixa o commit passar** (decisão 9 do controlador). Não há o que tirar nem reinstalar; o portão
  `--range=main...HEAD` continua valendo na branch que tem as ferramentas.
- **Testes:** `test/visual/names.test.ts` e `test/visual/installHooks.test.ts`.

**O registro:** `node scripts/visual/registry.mjs <Componente> historico "<frase>"` acrescenta a frase ao fim do
`Histórico` da entrada; `… <Componente> troca "<de>" "<para>"` troca um trecho que aparece uma vez só na entrada; os dois
recusam sumir ou criar um cabeçalho `###`. `node scripts/visual/registry-diff.mjs <base> [head]` compara os `###` do
`ui-registry.md` e os `####` do `pendencias.md` entre dois commits e sai com 1 se algum sumiu (um título renomeado
aparece como SUMIU e NOVO): é a conferência de toda revisão por tarefa. Teste: `test/visual/docs.test.ts`.

## 23. Motion (`motion` 14.14.0) · emenda do PR B

Decisão: `architecture.md §10` (2026-11-27, PB-D10 a PB-D15) e a spec do PR B §16. Regras de interface: `ui-rules.md §9`;
valores: `ui-tokens.md §8` (a fonte é `src/lib/motion.ts`).

- **Versão exata, sem `^`** (`bun add -E motion@14.14.0`, de 2026-11-13: passa a regra das duas semanas). O pacote fixa o
  `framer-motion` 14.14.0 por dentro. API: https://motion.dev/docs/react (context7 `/websites/motion_dev`). Trocar de versão
  exige rodar os testes de componente que usam o Motion (a lista do `motionUsage.test.ts`) e o `e2e/motion.spec.ts`.
- **Peso: `LazyMotion` + `m`.** O `MotionProvider` (`src/components/motion/MotionProvider.tsx`) carrega o `domAnimation`
  (animações, saídas e os gestos de toque, foco e hover; **sem layout nem arrasto**) com `strict`: um `motion.div` dentro
  dele lança. Componente importa `import * as m from "motion/react-m"`. Fora do provider (um teste sem a `MotionTree`), o
  `m` renderiza o `initial` e nunca anima.
- **Sem animação de layout.** O `domAnimation` não traz `layout` nem `layoutId` (só o `domMax`, que dobra o peso). O que
  desliza guarda o repouso no CSS e anima só a troca, por FLIP com `useSpring`: mede antes e depois (`offsetLeft`, ou a
  diferença de índice vezes a largura), `jump` para a diferença e `set(0)`. Em repouso o `x` é 0 (`transform: none`).
- **Só contexto na raiz, sem script.** O `MotionProvider` fica no `<body>` do `RootLayout`, por fora do `TooltipProvider` e
  do `Toaster`, e não renderiza elemento nem `<script>` (a lição do §18): o `renderToString` dele é o dos filhos.
  `MotionConfig reducedMotion="user"` (o aparelho que pede menos movimento desliga as transformações sozinho) e
  `transition={MOTION_DEFAULT_TRANSITION}`.
- **Hidratação.** O que vem do servidor sai do HTML no lugar: repouso no CSS com o `x` em 0, `initial={false}`, ou nenhum
  valor (o aperto do `Button` é só gesto). Valor em `initial` só em quem monta no cliente depois de uma ação (o painel do
  Sheet, o tooltip, a camada de cor). O ramo reduzido nunca muda o HTML: muda transição, gesto e o `initial` de quem
  monta no cliente.
- **Movimento reduzido: `usePrefersReducedMotion`** (`src/lib/usePrefersReducedMotion.ts`; `useSyncExternalStore` sobre
  `(prefers-reduced-motion: reduce)`, snapshot do servidor `false`). Cada componente escolhe o ramo por ele, com os presets
  puros de `src/lib/motion.ts` (`sheetMotion`, `overlayMotion`, `tooltipMotion`). O `useReducedMotion` do Motion lê o
  `matchMedia("(prefers-reduced-motion)")` **uma vez por módulo** e avisa no console: não serve para escolher ramo em
  teste. Todo stub de `matchMedia` precisa de `addEventListener` e `removeEventListener` (o Motion e o hook os chamam).
- **Base UI (Dialog/Sheet, Tooltip).** O `render` do `Popup`/`Backdrop` recebe uma função `(props, state) => <m.div
  {...(props as HTMLMotionProps<"div">)} initial={…} animate={state.open ? … : …} />`. O Base UI só espera a saída antes
  de desmontar se ela tiver **opacidade** (a Motion a roda pela Web Animations API, que o `getAnimations()` vê); saída só
  de `transform` desmonta na hora (para isso há o desmonte manual com `actionsRef`, handbook "Animation" em
  `node_modules/@base-ui/react/docs/react/handbook/animation.md`). **Sem `keepMounted`** no portal: o popup montaria
  depois da hidratação, com ids `_r_`, e o `e2e/hydration.spec.ts` reprovaria. O tooltip anima só a entrada.
- **CSS e Motion não dividem propriedade.** O Motion escreve `transform` e `opacity` no `style` a cada quadro; uma
  `transition` de CSS na mesma propriedade corre atrás de cada quadro e atrasa tudo. Elemento com Motion não tem
  `transition-all` nem `transition` de `transform`/`opacity`, nem classes `data-starting-style`/`data-ending-style` ou
  `animate-in` do tw-animate-css.
- **Testes** (`test/motion.tsx`): `MotionTree` (o `MotionProvider` com `reducedMotion="never"`, para o Motion não reduzir
  pelo estado global dele), `stubReducedMotion(reduce)`, `recordStyle` (os valores do `style` quadro a quadro: o ramo
  normal tem valor no meio, o reduzido pula direto ao fim), `styleOnInsert` (o `style` no instante em que o elemento entra
  no DOM, antes do primeiro quadro), `translateOf`, `scaleOf` e `wait` (dentro de `act`). O jsdom não tem Web Animations:
  o Motion anima em JS pelo `requestAnimationFrame` (o Vitest liga o `pretendToBeVisual`), e o Base UI desmonta na hora
  (não há `getAnimations`). O que só o Chromium vê (a saída esperada pelo Base UI, o `transform` calculado) fica no
  `e2e/motion.spec.ts`.
- **Capturas do processo visual** (`scripts/visual/capture.mjs`, §22): todo contexto com `reducedMotion: "reduce"`
  (`CAPTURE_REDUCED_MOTION` de `scripts/visual/settle.mjs`, sem opção para desligar: o `newContext` do `capture.mjs` e o
  contexto que o `audit.mjs` monta); o `settle` (que o `shoot` e o `audit.mjs` chamam) espera as fontes, o
  `getAnimations()` e depois 200 ms sem escrita no `style` de nenhum elemento (`styleQuietScript`, até 3 s), mais os 300 ms.
- **Guarda:** `src/app/motionUsage.test.ts`: só `m`, nada de `framer-motion` nem de `motion/react-client`; nos arquivos que
  importam o Motion, nenhum número de duração ou mola e nenhuma curva fora de `src/lib/motion.ts`; o `RootLayout` com o
  provider e um script só.
- **ArcUI como referência, não dependência** (https://uiarc.dev/llms.txt; itens livres sob MIT): distribui itens do
  registry do shadcn sobre Radix e CSS modules com tokens próprios, e não se instala aqui. O comportamento de movimento (o
  que anima, a mola, o ramo reduzido) é portado para os nossos componentes (Base UI, Tailwind e `src/lib/motion.ts`), nunca
  o estilo nem os valores dela; trecho de código copiado leva o aviso de copyright MIT num comentário. O que as branches C
  a G vão olhar nela:
  - Dialog: o véu em fade; o painel sobe uns pixels e cresce de perto de 1 numa mola sem sobra; fecha mais rápido e volta
    de onde está; reduzido, só fade.
  - Select: o valor novo entra na direção da lista (o de baixo sobe, o de cima desce); reduzido, troca com fade.
  - Toast: entra subindo e crescendo; sai descendo com fade; arrasto para dispensar; reduzido, fades e sem arrasto.
  - Switch e Segmented control: o knob e a pílula numa mola rápida; reduzido, na hora. Gatilho de popup não encolhe ao
    apertar (responde com a cor).

## Como adicionar uma biblioteca nova

1. Justifique (o que resolve que o stack atual não resolve?) — YAGNI.
2. Instale com `bun add` e registre aqui uma seção com as regras do projeto.
3. Registre a decisão no `architecture.md §10`.
