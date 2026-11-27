# Visual novo: Início e app shell (design)

- **Data:** 2026-11-27
- **Status:** desenho aprovado pelo dono no chat; esta spec registra o que foi aprovado.
- **Origem:** handoff do Claude Design `design_handoff_inicio`, com README, protótipos `.dc.html` e 19 screenshots.
  - Ele fica fora do repositório. A cópia local de trabalho, não versionada, está em `.git/sdd/visual/handoff/`.
  - O protótipo e as screenshots usam um nome e um e-mail de exemplo que parecem de pessoa real. **Nada disso entra no repositório:** nem screenshot, nem nome, nem e-mail. Nos testes e na comparação visual, os nomes são fictícios (`architecture.md §8`).

## 1. Objetivo

Recriar no código, pixel a pixel, o visual novo da tela **Início** e do **app shell** (sidebar e cabeçalho).

O estilo:
- fundo escuro quente;
- títulos em Satoshi muito pesada;
- botões em pílula;
- cards grandes com cantos de 32px e cores pastel;
- controles no estilo Apple: o seletor deslizante e o switch de tema.

O tema escuro passa a ser o padrão, com um switch para o claro. A regra de ouro continua mandando: nada do visual novo pode deixar a passagem mais lenta que hoje.

## 2. Decisões

**Do dono (tomadas no chat de 2026-11-27):**

- **D-V1, paleta global.** As cores, as fontes e o tema escuro padrão valem para **todas** as telas já nesta entrega. Só o Início e o shell mudam de layout. As outras telas recebem o layout novo em handoffs próprios.
- **D-V2, Satoshi baixada no build.**
  - A licença da Satoshi (ITF Free Font License, §01 e §02) permite servir a fonte no próprio site.
  - Ela proíbe disponibilizar os arquivos "through … repository … publicly accessible servers". O repositório é público.
  - Então um script baixa a fonte do Fontshare antes do `dev` e do `build`, para uma pasta fora do git, e o app a serve do próprio domínio.
- **D-V3, cor numa coluna do setor.**
  - O setor ganha a coluna `color`, com uma paleta fechada de 5 cores, escolhida na criação e editável na tela Setores.
  - A alternativa de derivar a cor da ordem foi descartada: a cor mudaria com a lista e ficaria ciclada, contrariando `ui-rules.md §4`.

**Do controlador (aceitas no desenho):**

- **C-V1, tokens e variantes no que já existe.**
  - O caminho é `globals.css`, variantes novas em `Button`, `Card` e `Badge`, e a sidebar do shadcn restilizada.
  - Componentes novos só onde não existe peça.
  - Nada de colar o HTML do protótipo nem espalhar valores crus.
- **C-V2, formas.**
  - Botões e badges viram pílula (`rounded-full`) no app inteiro.
  - Os tamanhos grandes (48px), os cards de raio 32px e a tipografia display ficam só no Início e no shell por enquanto.
- **C-V3, "celular" é abaixo de 860px no app inteiro.** Vale para o `md` do Tailwind e para o `MOBILE_BREAKPOINT` da sidebar.
- **C-V4, tema.**
  - Tema próprio (`src/lib/theme.ts` + `useTheme`), sem `next-themes`: o script dele, dentro de componente client, duplicava o conteúdo dinâmico da página (trocado em 2026-11-27).
  - Escuro é o padrão, e o tema não segue o sistema.
  - A escolha fica no navegador.
- **C-V5, avatares DiceBear `notionists` gerados no servidor.**
  - Usa `@dicebear/core` + `@dicebear/styles`. A arte é CC0 1.0 (remix de Notionists, de Zoish) e o código é MIT.
  - A versão fica fixada na última estável com pelo menos duas semanas. Hoje é a **10.7.0**; a 11.0.0 saiu em 2026-11-25.
  - A API é conferida no `node_modules` na implementação.
  - Nenhuma requisição a terceiros.
- **C-V6, "Agora não" do cartão de convite** grava um cookie, assim o servidor sabe e a tela não pisca.
- **C-V7, sem teste de screenshot no CI.** A fonte renderiza diferente no Linux do CI e no Windows de desenvolvimento. A fidelidade visual é conferida na implementação (§10).
- **C-V8, um seletor de setor só.**
  - O `SectorPicker` é o mesmo componente no Início, no Histórico, na Nova passagem, em Solicitações e no Dashboard.
  - Ele vira o seletor deslizante (segmented) em todas essas telas.
  - Manter dois seletores para o mesmo conceito duplicaria a lógica e o teste.

## 3. Escopo

**Dentro:**
- os tokens, o tema, as fontes, o breakpoint e as formas (`§4`);
- a cor do setor, com migração e a tela Setores (`§5.1`);
- a barra do turno, o primeiro acesso e os avatares (`§5.2`–`§5.4`);
- o shell, o Início com todos os estados e o `SectorPicker` (`§6`);
- os esqueletos do Início;
- um passe de legibilidade nas outras telas no tema escuro, que corrige só o que ficar ilegível ou quebrado.

**Fora:**
- o layout novo das outras telas, que espera os handoffs delas;
- o tema seguindo o sistema;
- a animação "ao vivo" da barra do turno (ela é calculada a cada carga da página);
- teste de screenshot no CI;
- qualquer passo da Parte B (go-live).

**Sem mudança de regra de negócio.** As consultas do Início continuam as mesmas. Só entram campos a mais no `select`, como o id de quem entregou ou salvou, para a semente do avatar.

## 4. Fundação (todas as telas)

### 4.1 Tokens (`src/app/globals.css`)

A coluna "Protótipo" usa os nomes do handoff. O escuro vai em `.dark`; o claro, em `:root`.

| Protótipo | Tokens do shadcn que recebem o valor | Escuro | Claro |
|---|---|---|---|
| `bg` | `--background`, `--sidebar` | `#1c1b19` | `#f4f1ea` |
| `surface` | `--card`, `--popover`, `--secondary`, `--muted` | `#282724` | `#ffffff` |
| `surface2` | `--accent`, `--sidebar-accent` | `#34332f` | `#ebe7de` |
| `ink` | `--foreground` e todos os `*-foreground` de superfície (card, popover, secondary, accent, sidebar) | `#f2efe8` | `#1c1b19` |
| `muted` | `--muted-foreground` | `#a9a49a` | `#67635b` |
| `line` | `--border`, `--sidebar-border` | `rgba(255,255,255,.08)` | `rgba(28,27,25,.09)` |
| `btn` / `btnInk` | `--primary` / `--primary-foreground` e `--sidebar-primary` / `--sidebar-primary-foreground` | `#f2efe8` / `#1c1b19` | `#1c1b19` / `#f4f1ea` |
| `seg` | `--seg` (novo) | `#282724` | `#e4e0d6` |
| `thumb` / `thumbInk` | `--thumb` / `--thumb-foreground` (novos) | `#f2efe8` / `#1c1b19` | `#ffffff` / `#1c1b19` |
| `frame` | `--frame` (novo) | `#0f0e0d` | `#1c1b19` |
| `warn`, `info`, `succ` | `--warning`, `--info`, `--success` e os `*-foreground` | sem mudança (os valores do handoff são os de hoje) | sem mudança |

Alguns valores não estão no handoff:
- `--input` fica em `rgba(255,255,255,.15)` no escuro e `rgba(28,27,25,.15)` no claro, para os campos das outras telas continuarem visíveis.
- `--ring` recebe o valor de `muted`.
- `--destructive` fica como está.

**Cores fixas, iguais nos dois temas.** Viram tokens com estes nomes:

| Token | Valor | Uso |
|---|---|---|
| `--on-pastel` | `#1c1b19` | tinta sobre os cards coloridos; fundo do botão primário e do chip de setor dentro deles |
| `--on-pastel-ink` | `#f2efe8` | texto do botão primário e do chip dentro dos cards coloridos |
| `--on-pastel-muted` | `#33302a` | texto secundário no cartão de turno |
| `--on-pastel-soft` | `rgba(28,27,25,.08)` | bloco interno dos cards coloridos |
| `--on-pastel-secondary` / `--on-pastel-secondary-hover` | `rgba(28,27,25,.10)` / `rgba(28,27,25,.16)` | botão secundário dentro dos cards coloridos |
| `--on-pastel-track` | `rgba(28,27,25,.14)` | trilho da barra do turno |
| `--on-pastel-line` | `rgba(28,27,25,.12)` | divisória das linhas de Cadastros |
| `--highlight` | `#ffd23f` | só o "Passagem para confirmar" (amarelo = precisa de atenção) |
| `--invite` | `#f2a7c6` | só o "Convide sua equipe" |
| `--sector-lilac`, `--sector-peach`, `--sector-sky`, `--sector-green`, `--sector-pink` | `#b3a6e6`, `#f6b48f`, `#8ecae6`, `#a7d49b`, `#f2a7c6` | cor do setor (`§5.1`) |
| `--pastel-pending` / `-foreground` | `#cbe4f6` / `#1d4a72` | badge "Aguardando recebimento" no cartão de turno |
| `--pastel-confirmed` / `-foreground` | `#d3eedd` / `#1f5131` | badge "Confirmada" no cartão de turno |

Os textos secundários dos cards amarelo e rosa são `#3b3628`/`#4a4332` e `#3a2730`/`#4a2c3a`. Eles entram como `--on-highlight-muted`, `--on-highlight-soft`, `--on-invite-muted` e `--on-invite-soft`, com os valores na ordem do handoff.

**Os gráficos do dashboard mantêm as cores deles.**
- O `--chart-5` continua igual ao `--foreground` (P13), então segue os valores novos de `ink`.
- O guarda `src/app/chartPalette.test.ts` continua verde. Se uma cor de série perder contraste contra o fundo novo, ela é ajustada dentro das regras do guarda, e o motivo vai para `ui-tokens.md`.

### 4.2 Tema

- Tema próprio (2026-11-27, no lugar do `next-themes`, cujo script dentro de componente client duplicava o conteúdo dinâmico): script inline no `<head>` do `RootLayout` que alterna a classe `dark` (escuro padrão, sem seguir o sistema) e hook `useTheme`; sem `disableTransitionOnChange` (o dono preferiu o deslize do knob; as cores com transição também mudam suavemente na troca).
- O `<html>` recebe `suppressHydrationWarning`.
- O `@custom-variant dark` atual continua.
- **Switch de tema** (`ThemeSwitch`, client):
  - trilho de 76×44 em `--card`, com knob de 36px em `--primary` e ícone de 16px em `--primary-foreground`;
  - no escuro, o knob fica à direita com `Moon`; no claro, à esquerda com `Sun`;
  - `transition: left .3s cubic-bezier(.2,.8,.2,1)`;
  - `role="switch"`, `aria-checked` (ligado = escuro), `aria-label="Tema escuro"` e tooltip "Mudar para o tema claro"/"Mudar para o tema escuro";
  - antes de montar no cliente, mostra o estado escuro sem animar, para não piscar.

### 4.3 Fontes

- **Display:** Satoshi 500/700/900, com `next/font/local` em `--font-heading`. Usada em títulos, rótulos de botão, itens da nav e no seletor.
- **Texto:** Geist (já é `--font-sans`), pesos 400/500/600.
- **Mono:** Geist Mono (já é `--font-mono`). Usada em eyebrows, datas, horários da barra e chips de setor e papel.
- **Script `scripts/fetchFonts.mjs`:**
  - lê `https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&display=swap`;
  - pega a URL `woff2` de cada peso e baixa para `src/fonts/satoshi/Satoshi-{500,700,900}.woff2`, uma pasta no `.gitignore`;
  - confere o **SHA-256** de cada arquivo contra valores fixados no script;
  - pula o download quando os arquivos já estão lá com o hash certo;
  - com hash diferente ou sem rede, sai com código 1 e uma mensagem que diz o que fazer;
  - não altera os arquivos (a licença proíbe subset e conversão).
- **Ganchos:** `predev` e `prebuild` no `package.json`. O Bun roda os scripts `pre*`; isso foi conferido em 2026-11-27.
- **No CI**, o job do E2E guarda a pasta em cache, com uma chave tirada do hash do script.
- **Na Vercel**, o `bun run build` roda o `prebuild`.
- **No Vitest**, nenhum teste importa o `RootLayout` hoje, que é onde as fontes são carregadas. O tema fica em módulo próprio (`src/lib/theme.ts`), testável sem a fonte.
- O texto da `/privacidade` não muda: a fonte é servida pelo próprio app.

### 4.4 Breakpoints

- **Celular** é abaixo de 860px: `--breakpoint-md: 53.75rem` no `@theme` e `MOBILE_BREAKPOINT = 860` em `src/hooks/use-mobile.ts`.
- As regras `max-md:` de alvo de toque passam a valer até 860px.
- O conteúdo do Início usa **container queries** com `@container/main`. Os limites são de **área útil**: a tela menos a sidebar, **incluindo** o padding lateral de 40px, como o protótipo calcula (`mainW = largura − 280`). Por isso o `@container/main` fica num invólucro **sem padding**, e o padding e o `max-width` ficam num elemento de dentro.
  - abaixo de 1040px, os grids viram 1 coluna;
  - a partir de 1040px, turno e solicitações ficam em `minmax(0,1.3fr) minmax(0,1fr)`;
  - em 2 colunas com área útil abaixo de 1240px, o horário cai para 52px e o contador para 60px;
  - abaixo de 900px no desktop, a saudação cai para 60px.

### 4.5 Formas e variantes

- **`Button`:**
  - `rounded-full` em todas as variantes, no app inteiro;
  - tamanho novo `pill`: 48px de altura, Satoshi 16px/700, `padding 0 22px`, `gap 10px`, ícone de 18px. Como no protótipo, os botões neutros ("Ver o dashboard" em `--card` e "Ver solicitações" em `--primary`) usam `padding 0 20px`;
  - variantes novas: `surface` (fundo `--card`, hover `--accent`), `on-pastel` (fundo `--on-pastel`, texto `--on-pastel-ink`, `active:scale-[.97]`) e `on-pastel-secondary` (fundo e hover `--on-pastel-secondary`/`-hover`);
  - o `focus-visible:ring` atual continua em todas.
- **`Badge`:**
  - `rounded-full` e `whitespace-nowrap` no app inteiro;
  - variantes `warning`, `info`, `success`, `neutral` (`--accent`/`--foreground`), `pastel-pending` e `pastel-confirmed`;
  - Geist 12–13px/600, altura 24px.
- **`Card`:** variante `feature`, com raio 32px, padding 32px (22px no celular), sem borda, sem ring e sem sombra. Os cards se separam pela cor. O `Card` padrão das outras telas não muda.
- **Raios:**
  - cards 32;
  - grupos da nav 28;
  - card do usuário 24;
  - blocos internos 22;
  - linha de solicitação 18;
  - pílula 999.
- **Avatares:** a moldura e a imagem 3px menor, com os raios de cada tamanho:

  | Tamanho | Raio da moldura |
  |---|---|
  | 34px | 12px (o handoff não dá o raio; segue o de 36px) |
  | 36px | 12px |
  | 44px | 15px |
  | 52px | 17px |
  | 84px | 26px |

- **Sombras:** só o thumb do seletor (`0 2px 8px rgba(0,0,0,.18), 0 0 0 .5px rgba(0,0,0,.06)`) e o drawer do celular (`20px 0 60px rgba(0,0,0,.35)`, scrim `rgba(0,0,0,.45)`). Viram os tokens `--shadow-thumb`, `--shadow-drawer` e `--color-scrim`, para nenhum `.tsx` ter cor em valor arbitrário.
- **Regra geral:** nenhum `.tsx` tem cor literal (hex, `rgb()`, `rgba()`). Os tons translúcidos de `#1c1b19` (as bordas tracejadas do cartão de convite, por exemplo) usam o token com modificador de opacidade, como `border-on-pastel/40`.
- **Quando a spec e o protótipo divergirem num valor fino** (padding, raio interno de avatar), o protótipo manda, porque é a referência do pixel perfect. Por exemplo, o avatar de 84px tem a imagem interna com raio de 22px.

## 5. Dados

### 5.1 Cor do setor

- **Migração versionada** (`db:generate` → revisar → `db:migrate` no banco de dev, com o host conferido):
  - `sector.color text not null`, com `check (color in ('lilac','peach','sky','green','pink'))`;
  - os setores que já existem recebem cor **uma vez**, pela ordem de `created_at`, seguindo a ordem da paleta;
  - depois disso a cor é do setor e só muda pela tela Setores.
- **Cor sugerida para um setor novo** (função pura, testada):
  - a primeira cor, na ordem da paleta, que nenhum setor **ativo** usa;
  - se todas estiverem em uso, a menos usada entre os ativos, com o empate decidido pela ordem da paleta.
- **Tela Setores:**
  - o formulário de criação e o de edição ganham a escolha "Cor", com 5 opções: Lilás, Pêssego, Azul, Verde e Rosa;
  - cada opção mostra uma amostra de 16px **e o nome**, nunca só a cor (`ui-rules.md §2.1`);
  - na criação, a opção marcada é a cor sugerida (formulário nunca começa em branco);
  - a validação do servidor aceita só as 5 chaves.
- **Leitura:** os tipos de escolha de setor, o `SectorChoice` e o setor do `HomeHandovers`, passam a levar `color`. O mapa chave → token (`--sector-*`) fica num lugar só, `src/features/sectors/colors.ts`.

### 5.2 Progresso do turno

- Função pura `shiftProgress(shift, now)` em `src/features/handovers/`. O turno vem como `{ startsAt: "HH:MM:SS", endsAt: "HH:MM:SS" }`.
- Ela devolve `{ startLabel: "06:00", endLabel: "14:00", nowLabel: "08:42", pct }`, com `pct` entre 0 e 100.
- Trata o turno que cruza a meia-noite (`22:00–06:00`) e o "agora" antes do início ou depois do fim. Usa o fuso de São Paulo (`saoPaulo.ts`).
- Só aparece nos estados `start` e `continue`. É calculada no servidor a cada carga da página.

### 5.3 Primeiro acesso do admin

- **O cartão "Convide sua equipe" aparece quando** o perfil é admin, `getAdminOverviewCounts` dá `people === 1 && pendingInvites === 0`, e o cookie de dispensa não existe.
- **"Agora não":**
  - uma Server Action guardada como as outras (`actionsGuards.test.ts`) grava o cookie `closery-convite-dispensado=1`, com `path=/`, 1 ano, `SameSite=Lax` e `HttpOnly`;
  - depois disso a tela atualiza sem o cartão.
- **"Gerar convites"** leva a `/admin/equipe`.

### 5.4 Avatares

- `src/lib/avatar.ts` (`server-only`) expõe `avatarDataUri(seed)`.
  - Usa o estilo `notionists` com os fundos `b6e3f4`, `ffdfbf`, `ffd5dc` e `d1d4f9`. Essas quatro cores ficam só nesse módulo, como exceção documentada em `ui-tokens.md`: são dados da arte, não tokens de interface.
  - A semente é o **id do usuário**, então o avatar não muda quando o nome muda.
  - O resultado é determinístico, e o módulo tem teste.
- O componente `UserAvatar` (servidor) recebe `{ src, size, tilt }` e desenha a moldura `--frame` (ou `--on-pastel` sobre os cards coloridos) com um `<img alt="">` decorativo, porque o nome sempre aparece ao lado.
- **Onde aparece:**

  | Lugar | Pessoa | Tamanho e inclinação |
  |---|---|---|
  | card do usuário na sidebar | quem está logado | 44px, −4° |
  | "Passagem para confirmar" | quem entregou | 36px, 3° |
  | estado `continue` | quem salvou | 34px |
  | "Solicitações" vazio | quem está logado | 84px, −5° |
  | "Convide sua equipe" | o admin | 52px, −5° |

- Para isso, as consultas do Início passam a levar `deliveredById` e o id de quem salvou. O `AppSidebar` (client) recebe o data URI pronto do `AuthedSidebar` (servidor).

## 6. Telas e componentes

### 6.1 App shell (`(app)/layout.tsx`, `AppSidebar`, `MenuToggle`, `ThemeSwitch`)

**Sidebar, a partir de 860px:**
- 280px de largura, fundo `--background` sem borda, padding `22px 16px 16px`, coluna com gap 20.
- De cima para baixo:
  1. **Wordmark** "Closery": Satoshi 900, 28px, line-height 1, `-0.03em`, padding lateral 8px.
  2. **Grupo principal:**
     - fundo `--card`, raio 28, padding 8, gap 2;
     - itens de 48px, `padding 0 18px`, em pílula, com ícone lucide de 18px (`strokeWidth 2.2`), gap 12 e Satoshi 16/700;
     - o item ativo usa `--primary`/`--primary-foreground`; o hover usa `--accent` em 150ms;
     - os itens vêm de `navItems.ts`: Início, Passagens, Solicitações, Dashboard e Conta.
  3. **Grupo "Administração"** (só admin): o mesmo container, separado, com `ShieldCheck`.
  4. Um espaçador.
  5. **Card do usuário:**
     - fundo `--card`, raio 24, padding 12, gap 12;
     - avatar de 44px;
     - nome em Satoshi 700/15px e e-mail em 12.5px `--muted-foreground` com reticências;
     - chip "ADMIN" ou "COLEGA" em Geist Mono 11px, altura 24, fundo `--accent`.

**Cabeçalho:**
- 76px de altura, `justify-between`, **sem** a borda inferior de hoje.
- À esquerda, um botão redondo de 44px (`--card`, hover `--accent`):
  - no desktop, ícone `PanelLeft`, que recolhe e expande a sidebar (o `SidebarProvider` já guarda isso em cookie);
  - no celular, ícone `Menu`, que abre o drawer, com o wordmark de 24px ao lado.
- À direita, o `ThemeSwitch`.
- Os dois controles levam `aria-label` e tooltip.

**Celular (abaixo de 860px):**
- a sidebar vira drawer (o mobile do `Sidebar` do shadcn), com `transform .35s cubic-bezier(.2,.8,.2,1)`, a sombra do `§4.5` e o scrim;
- quando aberto, ganha um botão de fechar (`X`) ao lado do wordmark;
- fecha ao tocar no scrim ou num item.

**Conteúdo:** `max-width: 1240px`, centralizado, padding horizontal de 40px (16px no celular) e padding inferior de 48px.

### 6.2 Saudação (`Greeting`) e seletor de setor (`SectorPicker`)

- **Eyebrow:** a data por extenso em pt-BR, no fuso de São Paulo, em caixa alta, com o dia em dois dígitos, por exemplo "SEXTA-FEIRA · 27 NOV 2026" (o protótipo diz "QUINTA-FEIRA", mas 27/11/2026 é sexta). Geist Mono 13px/500, `--muted-foreground`, `.06em`.
- **`h1`** com `greetingTitle`: Satoshi 900, 72px (60px com área útil abaixo de 900px; 44px no celular), line-height .95, `-0.04em`.
- **Hero:** padding `28px 0 40px` (no celular, `12px 0 28px`), gap 32 (24 no celular).
- **Linha de baixo** (`flex-wrap`, `justify-between`, gap 16):
  - **Admin: `SectorPicker` como seletor deslizante.**
    - Trilho de 480px (100% no celular), altura 48, padding 4, `--seg`, em pílula.
    - Thumb absoluto, largura `calc((100% - 8px)/N)`, `left: calc(4px + i*((100% - 8px)/N))`, fundo `--thumb`, com a sombra do `§4.5` e `transition: left .4s cubic-bezier(.3,1.25,.4,1)`.
    - Cada segmento tem `flex: 1`, a bolinha de 8px na cor do setor e o nome em Satoshi 15px (700 no ativo, com `--thumb-foreground`; 500 nos outros).
    - Semântica de `radiogroup`, com `aria-label="Setor"` e `radio`/`aria-checked`; as setas do teclado trocam de opção.
    - A lógica atual continua: `chooseSectorAction`, `useTransition`, e durante o `pending` os segmentos ficam com opacidade menor e não aceitam clique.
    - Com mais de 4 setores, o trilho ganha `overflow-x: auto` e os segmentos um `min-width`.
  - **Operador:** pílula só de leitura, 48px, `--card`, com a bolinha de 10px, "SETOR" (mono 12px, `--muted-foreground`) e o nome (Satoshi 700, 16px).
  - **"Ver o dashboard":** `Button` `surface` `pill` com `ChartColumn`, link para `/dashboard`.

### 6.3 "Passagem para confirmar" (`PendingHandoverCard`)

- Aparece quando `home.pending` existe; a regra atual não muda.
- `Card feature` em `--highlight`, tinta `--on-pastel`.
- Grid `minmax(0,1fr) minmax(0,1.2fr)` com gap 24; vira 1 coluna com área útil abaixo de 1040px.
- **Coluna 1:**
  - `h2` "Passagem para confirmar": Satoshi 900, 26px (22px no celular), line-height 1, `-0.025em`;
  - "{turno} · {dd/mm/aaaa}" em Satoshi 700/19px;
  - avatar de 36px e "Entregue às {HH:MM} por {nome}" em 15px;
  - `Button` `on-pastel` `pill` "Ver passagem" com `ArrowRight`, no fim da coluna (`margin-top: auto`).
- **Coluna 2:**
  - bloco `--on-pastel-soft`, raio 22, padding `20px 22px`;
  - eyebrow "FICA PARA O PRÓXIMO TURNO";
  - o `nextShiftPreview` em 16px com `white-space: pre-line`, ou "Nada registrado para o próximo turno." quando vazio.

### 6.4 "Passagem do meu turno" (`MyShiftCard`)

- `Card feature` com fundo na cor do setor (`transition: background-color .45s`), tinta `--on-pastel`, coluna com gap 22.
- **Topo:** título em Satoshi 18/700 e chip do setor (`--on-pastel`/`--on-pastel-ink`, Geist Mono 12px, altura 28).
- **Turno:**
  - nome em Satoshi 700/20px;
  - horário "06:00–14:00" com meia-risca, Satoshi 900, `tabular-nums`, 64px (52px no `§4.4`; 44px no celular), line-height 1, `-0.035em`;
  - data em Geist Mono 14px, `--on-pastel-muted`.
- **Barra** (estados `start` e `continue`):
  - trilho de 10px em `--on-pastel-track`, com o preenchimento em `--on-pastel` na largura `pct` (`§5.2`);
  - embaixo, em mono 12px: início · "agora HH:MM" · fim;
  - depois, "Turno sugerido pelo horário de agora." em 15px `--on-pastel-muted`.
- **Estados** (`MyShiftState.kind`):
  - `start`: a barra e o primário "Começar passagem".
  - `continue`: a barra, uma pílula `--on-pastel-soft` (raio 18) com avatar de 34px e "Rascunho salvo às {HH:MM} por {nome}", e o primário "Continuar passagem".
  - `delivered`: badge `pastel-pending` com `Clock`, "Aguardando recebimento", o texto "Entregue às {HH:MM} por {nome}. Aguardando recebimento." e o primário "Ver passagem".
  - `confirmed`: badge `pastel-confirmed` com `CircleCheck`, "Confirmada", o texto "Entregue por {nome} às {HH:MM}. Confirmada por {nome} às {HH:MM}." e o primário "Ver passagem".
  - `no-shifts`: "Nenhum turno neste setor." (Satoshi 900/32px, line-height 1.05, `-0.02em`) e o texto de hoje para cada papel. Só o admin vê "Ir para Turnos", que leva a `/admin/turnos?setor=…`.
- **Rodapé** (`margin-top: auto`, gap 10, `wrap`): o primário (`on-pastel`) e o secundário "Ver todas as passagens" (`on-pastel-secondary`, que leva a `/passagens`).

### 6.5 "Solicitações" (`RequestsHomeCard`, `OpenRequestItem`)

- `Card feature` em `--card`, coluna com gap 20, título em Satoshi 18/700.
- **Com abertas:**
  - **Contador:** `{openCount}` em Satoshi 900, `tabular-nums`, 76px (60px no `§4.4`; 52px no celular), line-height .85, `-0.04em`.
  - **Ao lado do contador:**
    - "abertas" ou "aberta" em Satoshi 700/18px;
    - o badge `warning` com `TriangleAlert` e "{n} paradas", omitido quando não há paradas.
  - **Lista:** o eyebrow "PARADAS HÁ MAIS TEMPO" e até 5 itens (`home.stale`).
  - **Cada item:**
    - é um link na linha inteira, com padding `14px 10px` e margem lateral de −10px, raio 18, hover `--accent` e `border-top: 1px --border`;
    - mostra o `requestPreview` (Geist 600/15px) e "Para {destino}" (13px, `--muted-foreground`);
    - leva os badges de status ("Solicitada" em `neutral`; "Em separação / Trânsito" em `info`) e o `StaleBadge` (`warning`, com o texto atual de `staleLabel`). O `RequestStatusBadge` e o `StaleBadge` são os mesmos em todas as telas de Solicitações, então o visual novo vale para todas (D-V1). "Cancelada" usa `--accent`, porque no claro o `--muted` novo é igual ao `--card`;
    - fecha com o `ChevronRight` de 18px em `--muted-foreground`;
    - mantém `scroll={false}` e a rota interceptada do detalhe.
- **Sem abertas:**
  - avatar de 84px e "Nenhuma solicitação aberta." (Satoshi 900/28px, line-height 1.1, `-0.02em`);
  - no primeiro acesso do admin (`§5.3`), também a linha "Os pedidos da equipe aparecem aqui assim que alguém registrar o primeiro." em 15px `--muted-foreground`.
- **Rodapé:** `Button` `default` `pill` "Ver solicitações" com `ArrowRight`, que leva a `requestsHref(sectorParam)`.

### 6.6 "Convide sua equipe" (`InviteTeamCard`, novo)

- Aparece no topo da lista de cards, nas condições do `§5.3`.
- O mesmo grid do `§6.3`, em `--invite`, com tinta `--on-pastel`.
- **Coluna 1:**
  - quatro tiles de 52px com gap 10:
    - o avatar do admin, inclinado −5°;
    - um tile tracejado com `Plus` (`2px dashed rgba(28,27,25,.4)`, 4°);
    - dois tracejados vazios (opacidade da borda .3 e .2, −3° e 5°);
  - eyebrow "ÚLTIMO PASSO";
  - `h2` "Convide sua equipe", no estilo do `§6.3`;
  - o texto, com no máximo 440px de largura: "Gere um link de convite para cada pessoa. Operadores entram no setor que você escolher; administradores veem todos os setores.";
  - o primário "Gerar convites" com `ArrowRight` e o secundário "Agora não".
- **Coluna 2:**
  - bloco `--on-pastel-soft`, raio 22, padding `18px 22px`, com o eyebrow "CADASTROS";
  - 5 linhas de no mínimo 44px, separadas por `--on-pastel-line`;
  - cada linha tem o indicador de 24px, o nome (Satoshi 700/16px) e a contagem (Geist Mono 13px) à direita, com o `pluralize` como no `AdminOverview`;
  - Setores, Turnos, Itens e Destinos têm o indicador preenchido em `--on-pastel`, com `Check` (`strokeWidth 3`) na cor do card, **quando a contagem é maior que zero**; com zero, o indicador fica vazio como o da Equipe, porque um "feito" ao lado de "0 ativos" enganaria;
  - Equipe tem o indicador vazio (`2px dashed rgba(28,27,25,.45)`) e "1 pessoa ativa".

No primeiro acesso, a tela não tem "Passagem para confirmar", o cartão de turno fica em `start` e "Solicitações" fica vazio.

### 6.7 Esqueletos (`(app)/page.tsx`)

- O `GreetingSkeleton` vira dois blocos: o eyebrow com 14px de altura e o título com cerca de 72px, raio 16.
- O `HandoversSkeleton` vira os cards com raio 32 em `--card`, no grid do `§4.4`.

## 7. Interação e acessibilidade

- **Troca de setor (admin):** o thumb desliza e o cartão de turno faz crossfade da cor. Os dados recarregam pela Server Action atual.
- **Hover:** os itens da nav, os botões `surface` e as linhas de solicitação vão para `--accent` em 150ms; os secundários `on-pastel` vão para o `-hover`. **Active:** os primários `on-pastel` usam `scale(.97)`.
- **`prefers-reduced-motion`** desliga o deslize do thumb, o crossfade, o knob do tema e o drawer.
- **Alvos de toque:** botões de 48px, controles redondos de 44px e linhas de no mínimo 44px. O guarda `e2e/touch-targets.spec.ts` continua verde.
- **Contraste:**
  - todo texto passa no AA nos dois temas;
  - sobre os pastéis, a tinta é sempre `--on-pastel`;
  - o conjunto de pares texto/fundo do `§4.1` ganha teste de contraste (o padrão do guarda de paleta).
- **Controles só com ícone** levam `aria-label` e tooltip.
- **Ícones** lucide de 12 a 18px com `strokeWidth 2.2` (3 no `Check`), sempre `aria-hidden`.

## 8. Erros e limites

- **Nome do turno e do setor:**
  - nome longo de turno ou setor: reticências no seletor e no chip, e quebra de linha nos títulos;
  - setor de nome curto ou longo e mais de 4 setores: o `§6.2` cobre.
- **Nome da pessoa:** com uma palavra só, o `greetingTitle` já trata.
- **Contagens:**
  - `openCount` 0, 1 e acima de 99: o contador não quebra o layout;
  - nenhuma parada: o badge some.
- **Turno:**
  - turno sem horário válido não acontece, porque o banco garante;
  - o `pct` fica preso entre 0 e 100.
- **Cookie de dispensa** ausente ou com outro valor: o cartão aparece.
- **Fonte:**
  - sem rede ou com hash errado no `prebuild`, o build falha alto com a instrução;
  - em produção, a fonte de reserva só aparece no instante do carregamento (`next/font` com `adjustFontFallback`).
- **Avatar:** não depende de rede e não falha. Uma semente vazia não acontece, porque todo usuário tem id.
- **Migração:** o setor desativado mantém a cor. Reativar não troca a cor.

## 9. Testes (`code-standards.md §7`)

- **Unidade:**
  - `shiftProgress`: turno do dia, turno que cruza a meia-noite, antes do início, depois do fim, exatamente no início e no fim;
  - cor sugerida: nenhum setor, todas as cores livres, todas usadas, empate, setores inativos ignorados;
  - `avatarDataUri`: determinístico, sementes diferentes dão saídas diferentes;
  - condição do primeiro acesso: 1 pessoa e 0 convites, 2 pessoas, 1 convite pendente, operador, cookie presente;
  - Server Action da dispensa: grava o cookie e recusa quem não está logado.
- **Componentes (Testing Library):**
  - os 5 estados do `MyShiftCard`;
  - pendente com e sem prévia;
  - solicitações com abertas, sem paradas e vazio (com e sem primeiro acesso);
  - `InviteTeamCard`;
  - `SectorPicker`: radiogroup, `aria-checked`, teclado, `pending` e mais de 4 setores;
  - `ThemeSwitch`: `role`, `aria-checked`, rótulo e troca;
  - sidebar: item ativo e grupo de administração só para o admin.
- **Banco (PGlite):**
  - migração: check da paleta, backfill pela ordem e `not null`;
  - criar e editar setor com cor;
  - recusar uma cor fora da paleta.
- **E2E:**
  - os seletores `getByRole("group", { name: "Setor" })` viram `radiogroup`;
  - o guarda de 44px mede o Início novo;
  - um cenário do primeiro acesso: o cartão aparece, "Agora não" esconde e a dispensa continua depois de recarregar;
  - um cenário do switch de tema: o escuro é o padrão, a troca funciona e continua depois de recarregar.
- **Guardas que precisam continuar verdes:** `chartPalette.test.ts`, `uiRegistryDoc.test.ts`, `routeHandlersAuth`, `actionsGuards` e `pendenciasDoc.test.ts`.
- **Guarda novo:** um teste lê os `.tsx` de `src/components` e `src/app` (fora os `*.test.tsx`) e recusa hex cru (`#rgb`/`#rrggbb`) e classes de cor crua do Tailwind (`text-red-500` e afins). A única exceção é `src/components/ui/chart.tsx`, cujos `[stroke='#ccc']` e `[stroke='#fff']` são seletores do recharts, não cor nossa. O `src/lib/avatar.ts` é `.ts` e fica fora do guarda. Hoje a regra do `AGENTS.md` não tem teste, e esta entrega cria muitas cores novas.

## 10. Verificação visual (pixel perfect)

1. **A referência é o protótipo `Inicio.dc.html`**, renderizado no Chromium do Playwright, e não as screenshots. As screenshots do handoff estão em escala reduzida.
   - Uma cópia do protótipo fica em `.git/sdd/visual/`, com os nomes e e-mails trocados por fictícios.
   - Os estados se controlam pelas props do protótipo: `tema`, `tela`, `perfil`, `primeiroAcesso`, `turno`, `pendente` e `solicitacoes`.
2. **O app roda no `next dev`**, em porta própria (nunca a 3000), contra o banco de teste local (PGlite em disco).
   - O banco tem os mesmos dados do protótipo: setores ULD, Carga, Operações e Eco, nas cores do protótipo, e turnos, passagens e solicitações iguais.
3. **Os dois lados são capturados no mesmo tamanho:**
   - desktop de 1440×900 e celular de 390×844;
   - nos dois temas;
   - nos estados das screenshots 01–19: com pendente, primeiro acesso, `continue` sem solicitações, `delivered`, `confirmed` visto pelo operador, `no-shifts` e o celular com o menu aberto.
4. **A comparação é lado a lado e por diferença de pixels**, com as áreas que dependem do "agora" mascaradas (horário e barra). Cada diferença é corrigida até sumir, ou registrada com o motivo, por exemplo o anti-aliasing da fonte.
5. **As capturas ficam em `.git/sdd/visual/`**, fora do git.

## 11. Documentos a atualizar

- `ui-tokens.md`: tabela nova, cores fixas, a exceção dos fundos de avatar e as fontes.
- `ui-rules.md`: pílula, tema escuro padrão, celular abaixo de 860 e cor do setor.
- `ui-registry.md`: `ThemeSwitch`, `UserAvatar`, `InviteTeamCard`, o `SectorPicker` novo, `Button`/`Badge`/`Card` e o `Histórico` datado dos componentes tocados.
- `library-docs.md`: `next-themes`, DiceBear (versão fixada e API), Satoshi (licença e script) e container queries.
- `architecture.md`: ADR com D-V1–3, C-V1–8 e a coluna `sector.color`.
- `AGENTS.md`: a linha do `fetchFonts` na tabela de comandos.
- `progress-tracker.md`, `pendencias.md` (o que ficar para os próximos handoffs) e `memory.md`.

## 12. Riscos

- **Outras telas na paleta nova com o layout antigo**, até os próximos handoffs. O passe de legibilidade do `§3` corrige só o que estiver quebrado.
- **O build depende do Fontshare** (pela CDN). Mitigações: o cache no CI, o download que pula quando os arquivos já estão certos, e uma mensagem clara na falha.
- **DiceBear numa linha major nova:** a versão é fixada exata, e o teste de determinismo trava uma mudança de saída.
- **Memória da máquina de desenvolvimento:** a verificação visual sobe o `next dev`, o banco e o Chromium. Fechar outros projetos ou rodar o Claude Code com `CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP=1`.
- **"Celular abaixo de 860px"** muda o layout das outras telas na faixa de 768 a 860px. É intencional (C-V3) e entra no passe de legibilidade.

## 13. Critério de pronto

- [ ] Os pares da `§10` batem com o protótipo nos dois temas, em desktop e celular, com as diferenças restantes registradas.
- [ ] `check-types`, `lint`, `test`, `build` e `test:e2e` estão verdes.
- [ ] O CI está verde no PR.
- [ ] A migração foi aplicada no banco de dev (host conferido).
- [ ] Os documentos do `§11` estão atualizados.
- [ ] Nenhum `.woff2`, screenshot, nome real ou e-mail do handoff está no git.
