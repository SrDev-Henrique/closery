# UI Tokens — Closery

> **Documento vivo + lei do design.** Toda cor, raio, tipografia e espaçamento sai daqui.
> **Proibido** hex ou classe de cor crua (`bg-[#...]`, `text-emerald-500`) em qualquer `.tsx`
> (guarda `src/app/rawColors.test.ts`). Se um valor não existe como token, **adicione o token**, não burle.
> Fonte de verdade dos valores: `src/app/globals.css`.

---

## 1. Direção visual · 🟢 definido (visual novo, 2026-11-27; spec `docs/superpowers/specs/2026-11-27-visual-inicio-design.md`)

Fundo escuro quente (**o tema escuro é o padrão**, com um switch para o claro), títulos em **Satoshi**
muito pesada, botões e badges em **pílula**, cards grandes de 32px em cores pastel, controles no estilo
Apple (seletor deslizante e switch de tema). Vale para **todas** as telas (D-V1); só o Início e o shell
mudam de layout por enquanto.

Os tokens continuam com os nomes do shadcn (`background`, `card`, `primary`...). O protótipo do
handoff usa outros nomes; a ponte é a tabela do §2.

Restrições que valem sempre:
- **Legível em ambiente operacional:** todo texto passa no AA (4,5:1) nos dois temas; o guarda
  `src/app/themeContrast.test.ts` mede os pares de superfície, status, `destructive` e pastéis listados nele (o guarda só lê `#hex` e `rgba()`; um token em `oklch` fica fora da medição e faz o teste falhar alto). Uso provável no celular, em área de carga, com pressa.
- **Cor carrega significado, não decoração:** status (ok / atenção / problema) e entidades do
  dashboard têm cor fixa; o amarelo `highlight` é só o "Passagem para confirmar" (precisa de atenção).
- **Sobre os pastéis a tinta é sempre `on-pastel`** (nunca `foreground`, que muda com o tema).
- **Marca de terceiros** (logo/cores da LATAM) só com autorização, ver `pendencias.md`.

## 2. Cores do tema (mudam entre claro e escuro)

`:root` é o claro; `.dark` é o escuro. A coluna "Protótipo" é o nome do handoff.

| Protótipo | Tokens que recebem o valor | Claro | Escuro |
|---|---|---|---|
| `bg` | `background`, `sidebar` | `#f4f1ea` | `#1c1b19` |
| `surface` | `card`, `popover`, `secondary`, `muted` | `#ffffff` | `#282724` |
| `surface2` | `accent`, `sidebar-accent` | `#ebe7de` | `#34332f` |
| `ink` | `foreground` e todo `*-foreground` de superfície (card, popover, secondary, accent, sidebar) | `#1c1b19` | `#f2efe8` |
| `muted` | `muted-foreground` (e `ring`, `sidebar-ring`) | `#67635b` | `#a9a49a` |
| `line` | `border`, `sidebar-border` | `rgba(28,27,25,.09)` | `rgba(255,255,255,.08)` |
| (campos) | `input` | `rgba(28,27,25,.15)` | `rgba(255,255,255,.15)` |
| `btn` / `btnInk` | `primary` / `primary-foreground` e `sidebar-primary` / `sidebar-primary-foreground` | `#1c1b19` / `#f4f1ea` | `#f2efe8` / `#1c1b19` |
| `seg` | `seg`: trilho do seletor deslizante | `#e4e0d6` | `#282724` |
| `thumb` / `thumbInk` | `thumb` / `thumb-foreground`: o botão que desliza | `#ffffff` / `#1c1b19` | `#f2efe8` / `#1c1b19` |
| `frame` | `frame`: moldura dos avatares | `#1c1b19` | `#0f0e0d` |
| `warn`, `info`, `succ` | `warning`, `info`, `success` e os `*-foreground` | sem mudança | sem mudança |
| (erro) | `destructive` | `#b80000` | `#ff9393` |

| Token de status | Claro | Escuro |
|---|---|---|
| `success` / `-foreground` | `#d3eedd` / `#1f5131` | `#1d3526` / `#75d799` |
| `warning` / `-foreground` | `#f5e0bc` / `#6a451b` | `#372d1b` / `#e4bb67` |
| `info` / `-foreground` | `#cbe4f6` / `#1d4a72` | `#1b2a37` / `#74b1e7` |

Uso do status: estados de solicitação e de passagem, sempre com texto; o ícone acompanha o selo em todas as telas, menos no cartão de Solicitações do Início (`showIcon`/`badgeIcons` desligados, decisão do dono de 2026-11-27).

`destructive` foi ajustado para AA (decisão do dono, 2026-11-27): o `oklch` antigo dava menos de 4,5:1 para `text-destructive`, e o primeiro ajuste (`#d60000` / `#ff8a8a`) ainda reprovava o botão sobre o fundo da página no claro (4,04:1, o "Cancelar solicitação" de `/solicitacoes/[id]`) e os hovers (3,36–4,18:1). Os hex acima, com o fundo do botão `destructive` em `/10` → hover `/15` no claro e `/15` → hover `/18` no escuro (era `/20`; sobre o rodapé `accent/50` o `/20` dava 4,38:1), passam 4,5:1 em `text-destructive` sobre `background`, `card` e `popover` e sobre o fundo do botão em repouso **e** no hover, composto sobre `background`, sobre `card` e sobre o rodapé (`accent/50` sobre `popover`), nos dois temas. O guarda lê os percentuais da própria classe da variante (`buttonVariants`) e mede todos esses pares (tabela abaixo).

## 3. Cores fixas (iguais nos dois temas)

Só em `:root` (o `.dark` herda e o guarda confere que não as redefine). Utilitários: `bg-highlight`,
`text-on-pastel`, `bg-sector-lilac`, `bg-on-pastel-soft`...

| Token | Valor | Uso |
|---|---|---|
| `on-pastel` | `#1c1b19` | tinta sobre os cards coloridos; fundo do botão primário e do chip de setor dentro deles |
| `on-pastel-ink` | `#f2efe8` | texto do botão primário e do chip dentro dos cards coloridos |
| `on-pastel-muted` | `#33302a` | texto secundário no cartão de turno |
| `on-pastel-soft` | `rgba(28,27,25,.08)` | bloco interno dos cards coloridos |
| `on-pastel-secondary` / `-hover` | `rgba(28,27,25,.10)` / `rgba(28,27,25,.16)` | botão secundário dentro dos cards coloridos |
| `on-pastel-track` | `rgba(28,27,25,.14)` | trilho da barra do turno |
| `on-pastel-line` | `rgba(28,27,25,.12)` | divisória das linhas de Cadastros |
| `highlight` | `#ffd23f` | só o "Passagem para confirmar" |
| `on-highlight-muted` / `on-highlight-soft` | `#3b3628` / `#4a4332` | texto e eyebrow sobre o amarelo |
| `invite` | `#f2a7c6` | só o "Convide sua equipe" |
| `on-invite-muted` / `on-invite-soft` | `#3a2730` / `#4a2c3a` | texto e eyebrow sobre o rosa |
| `sector-lilac` `sector-peach` `sector-sky` `sector-green` `sector-pink` | `#b3a6e6` `#f6b48f` `#8ecae6` `#a7d49b` `#f2a7c6` | cor do setor (coluna `sector.color`, `src/features/sectors/colors.ts`); **nunca ciclada** |
| `on-pastel-success-soft` / `on-pastel-success` | `rgba(46,125,79,.22)` / `#123b27` | bloco "Confirmada" do cartão de turno (spec §6.4.1). O `#14402a` do handoff dava 4,41:1 no lilás e foi escurecido até passar |

**Bloco "Aguardando recebimento"** (spec §6.4.1): `bg-on-pastel/10`, o `on-pastel` com 10% de opacidade (= `rgba(28,27,25,.10)`), sem token próprio; o texto é `text-on-pastel`.

**Sombras e véu** (tokens do `@theme`; valores literais só no `globals.css`): `shadow-thumb`
(`0 2px 8px rgba(0,0,0,.18), 0 0 0 .5px rgba(0,0,0,.06)`, só o thumb do seletor), `shadow-drawer`
(`20px 0 60px rgba(0,0,0,.35)`, só o drawer do celular) e `bg-scrim` (`rgba(0,0,0,.45)`, o véu do drawer).
Fora isso nada usa sombra: os cards se separam pela cor.

**Exceção documentada, os fundos de avatar:** `b6e3f4`, `ffdfbf`, `ffd5dc` e `d1d4f9` ficam só em
`src/lib/avatar.ts` (`.ts`, fora do guarda de cor crua). São dados da arte do DiceBear, não tokens de interface.

### Contraste medido (AA, texto normal ≥ 4,5:1)

Medido por `src/app/themeContrast.test.ts` contra o `globals.css` (rode com `VITEST_PRINT_THEME_CONTRAST=1`
para reimprimir). Piso nunca se afrouxa: reprovou, ajuste o token.

| Par (texto sobre fundo) | Claro | Escuro |
|---|---|---|
| `foreground` / `background` | 15,26 | 14,99 |
| `card-foreground` / `card` | 17,21 | 13,01 |
| `accent-foreground` / `accent` | 13,95 | 11,01 |
| `muted-foreground` / `background` · `card` · `accent` · `seg` | 5,30 · 5,98 · 4,84 · 4,54 | 6,94 · 6,02 · 5,10 · 6,02 |
| `primary-foreground` / `primary` | 15,26 | 14,99 |
| `thumb-foreground` / `thumb` | 17,21 | 14,99 |
| `success` · `warning` · `info` (`-foreground` sobre o fundo) | 7,48 · 6,56 · 7,02 | 7,51 · 7,47 · 6,41 |
| `destructive` / `background` · `card` · `popover` | 6,13 · 6,91 · 6,91 | 8,07 · 7,00 · 7,00 |
| `destructive` sobre o fundo do botão em repouso (`/10` claro, `/15` escuro), composto em `background` · `card` · rodapé | 5,10 · 5,72 · 5,18 | 6,09 · 5,24 · 4,85 |
| `destructive` sobre o fundo do botão no hover (`/15` claro, `/18` escuro), composto em `background` · `card` · rodapé | 4,63 · 5,19 · 4,71 | 5,71 · 4,92 · 4,56 |

Rodapé = `bg-accent/50` do `DialogFooter` (composto no popover) e do `CardFooter` (no card), com o alfa lido da classe de cada um (P109, 2026-11-28); o hover escuro do botão `destructive` caiu de `/20` para `/18` porque sobre o rodapé o `/20` media 4,38:1 (T3 do processo visual, 2026-11-27).

### Fundos de estado (piso de perceptibilidade ≥ 1,1:1)

Razão entre o fundo com o estado e o de repouso (ou entre o rodapé e o corpo), com o token e o alfa lidos das
classes que cada componente renderiza. O piso (`STATE_MIN`, 1,1:1) é escolha de desenho do P109, não número da
WCAG. Marcado com \* = hoje abaixo do piso, listado no guarda (`belowFloor`) e no P109 (troca em aberto).

| Fundo de estado | Claro | Escuro |
|---|---|---|
| `Button` `outline` no hover · aberto, dentro de cartão | 1,09\* · 1,09\* | 1,10 · 1,03\* |
| `Button` `outline` no hover, sobre o rodapé do `DialogFooter` | 1,09\* | 1,10 |
| `Button` e `Badge` `ghost` no hover, dentro de cartão · sobre a página | 1,23 · 1,09\* | 1,08\* · 1,15 |
| `Button` `ghost` no hover, sobre o rodapé do `CardFooter` | 1,11 | 1,04\* |
| rodapé do `CardFooter` e do `DialogFooter` contra o corpo | 1,11 | 1,08\* |
| linha da tabela e rótulo com campo no hover, dentro de cartão · sobre a página | 1,11 · 1,05\* | 1,08\* · 1,15 |
| linha do `BarList`, `StatLink` e cartão da `AdminOverview` no hover | 1,23 | 1,18 |
| trilho do `BarList` contra a linha, em repouso e no hover | 1,23 | 1,18 |
| "Agora não" do `PasskeyOffer` no hover, sobre o rodapé (hover local no escuro) | 1,11 | 1,26 |

| Par fixo (iguais nos dois temas) | Contraste |
|---|---|
| `on-pastel` sobre lilás · pêssego · azul · verde · rosa | 7,80 · 9,71 · 9,62 · 10,27 · 9,11 |
| `on-pastel` sobre `highlight` · `invite` | 11,92 · 9,11 |
| `on-pastel-muted` sobre lilás · pêssego · azul · verde · rosa | 5,96 · 7,42 · 7,35 · 7,85 · 6,96 |
| `on-highlight-muted` · `-soft` sobre `highlight` | 8,34 · 6,80 |
| `on-invite-muted` · `-soft` sobre `invite` | 7,35 · 6,49 |
| `on-pastel-ink` sobre `on-pastel` | 14,99 |
| `on-pastel` sobre `on-pastel/10` (bloco "Aguardando recebimento") em lilás · pêssego · azul · verde · rosa | 6,56 · 8,08 · 8,02 · 8,54 · 7,61 |
| `on-pastel-success` sobre `on-pastel-success-soft` (bloco "Confirmada") em lilás · pêssego · azul · verde · rosa | 4,71 · 5,61 · 5,69 · 6,01 · 5,29 |
| o menor par sobre bloco translúcido (`on-pastel-success` sobre `on-pastel-success-soft` em lilás) | 4,71 |

## 4. Gráficos (D16, valores do klauve, inalterados no visual novo)

`chart-1..4` são as séries (ordem de uso; máx. 4); `chart-5` é o neutro de "Outros" e do 5º turno em
diante: **o mesmo valor de `foreground`** (P13, hoje `#1c1b19` no claro e `#f2efe8` no escuro); nunca série com
identidade. Ninguém usa `chart-5` como série: quem precisa do neutro usa `foreground` direto.

| Token | Claro | Escuro |
|---|---|---|
| `chart-1` | `#8d3e0f` | `#c3550c` |
| `chart-2` | `#2c8faf` | `#56badd` |
| `chart-3` | `#7235a6` | `#836b9f` |
| `chart-4` | `#738c57` | `#95b278` |

**Guarda de paleta (P9):** `src/app/chartPalette.test.ts` lê o `globals.css` e reprova, nos dois temas, série
fora da banda de lightness OKLCH 0,43–0,77, croma < 0,06, contraste < 3:1 sobre `--card`, ΔE2000 < 15 entre
qualquer par (visão normal, deuteranopia, protanopia, tritanopia) e `-foreground` de status < 4,5:1 sobre o
fundo do par. Medido contra os cards do visual novo (`#ffffff` claro, `#282724` escuro):

| | Claro | Escuro |
|---|---|---|
| contraste `chart-1..4` sobre o card | 7,42 · 3,71 · 7,57 · 3,74 | 3,29 · 6,73 · 3,25 · 6,34 |
| ΔE2000 mínimo entre as séries (normal / deuter. / protan. / tritan.) | 34,5 / 17,6 / 23,2 / 17,7 | 35,6 / 17,5 / 22,4 / 17,6 |
| contraste de `chart-5` (= `foreground`) sobre o card | 17,21 | 13,01 |
| ΔE2000 mínimo de `chart-5` contra `chart-1..4` (normal / deuter. / protan. / tritan.) | 30,4 / 30,0 / 23,7 / 20,1 | 25,5 / 22,4 / 22,2 / 19,6 |

No escuro, `chart-1` e `chart-3` ficaram a 3,29:1 e 3,25:1 do card novo (eram 3,95 e 3,90 sobre o card
antigo): ainda acima do piso de 3:1, mas com pouca folga; qualquer card mais claro exige reajustar a série
dentro das regras do guarda.

**Por que "Outros" é o `foreground`:** o `muted-foreground` do shadcn antigo (`oklch(0.556 0 0)` claro,
`oklch(0.708 0 0)` escuro) reprovava a separação de `chart-4` em tritanopia (ΔE 8,6 e 6,8). O `muted-foreground`
quente de hoje passa no claro (ΔE 16,1) e continua reprovando no escuro (ΔE 11,0), então o neutro segue sendo
o `foreground`. O caso negativo do guarda mede o cinza antigo.

## 5. Raio e formas

Base `--radius: 0.625rem`; escala `rounded-sm` … `rounded-4xl` derivada dela (telas antigas). Formas do visual novo:

| Elemento | Raio |
|---|---|
| botão, badge, seletor, thumb, switch de tema | pílula (`rounded-full`), **no app inteiro** (C-V2) |
| card `feature` | 32px (padding 32px, 22px abaixo de 860px) |
| grupo da nav | 28px |
| card do usuário | 24px |
| bloco interno de card colorido | 22px |
| linha clicável de solicitação | 18px |
| avatar 34 / 36 / 44 / 52 / 84px | moldura 11 / 12 / 15 / 17 / 26px, padding 2,5 / 2,5 / 3 / 3 / 4px, imagem interna 9 / 10 / 12 / 14 / 22px (o protótipo vence a spec nesses valores) |

Celular é **abaixo de 860px** no app inteiro (`md:` e `max-md:` valem em 860px; C-V3).

## 6. Tipografia

- **Display:** **Satoshi** 500/700/900 (`next/font/local`, baixada por `bun run fonts`; licença em
  `library-docs.md`) em `--font-heading` (`font-heading`). Títulos, rótulos de botão, itens da nav, seletor.
- **Texto:** **Geist** via `next/font` em `--font-sans`, pesos 400/500/600.
- **Mono:** **Geist Mono** em `--font-geist-mono` (`font-mono`): eyebrows, datas, horários da barra, chips de setor e papel.
- Corpo `text-sm`+ (nunca `text-xs` para conteúdo, exceto badges e eyebrows); campos de digitação `text-base` (16px).
- Números de contagem e do dashboard com `tabular-nums`.
- Os tamanhos display do Início (saudação 72px, horário 64px, contador 76px) estão na spec §6.

## 7. Como usar

✅ `bg-background`, `text-foreground`, `bg-accent` (hover e estado), `text-muted-foreground`, `bg-card`,
`border-border`, `bg-primary text-primary-foreground`, `rounded-full`, `ring-ring`,
`bg-highlight text-on-pastel`, `bg-sector-sky`, `shadow-thumb`.

❌ `bg-[#F5F5F6]`, `text-zinc-500`, `bg-green-500`, `border-gray-200`, `shadow-[0_2px_8px_rgba(...)]`,
`z-[...]` arbitrário, `bg-muted` (tem o valor do `card`: use `bg-accent`; `mutedBackground.test.ts`).

🔁 **Faltou um token?** Adicione no `globals.css` (claro **e** escuro, ou só `:root` se for fixo), exponha no
`@theme inline`, mede o contraste em `themeContrast.test.ts` e documente aqui.

## 8. Movimento (Motion, desde 2026-11-27)

A fonte única é `src/lib/motion.ts` (o guarda `src/app/motionUsage.test.ts` recusa número fora dela); as regras, no
`ui-rules.md §9`.

| Nome | Valor | Onde |
|---|---|---|
| `MOTION_MAX_SECONDS` | 0,45 s | teto de qualquer duração de tween ou `visualDuration` de mola (a mola assenta depois: até 0,58 s no `thumb`, com menos de um pixel de cauda) |
| `MOTION_DURATION.instant` · `fast` · `exit` · `base` · `fade` | 0,1 · 0,15 · 0,18 · 0,2 · 0,4 s | fade do ramo reduzido · opacidade de entrada do painel · saída · tooltip, véu e padrão · cor do cartão do turno |
| `MOTION_EASE.out` · `in` · `inOut` | `cubic-bezier(.2,.8,.2,1)` · `(.4,0,1,1)` · `(.65,0,.35,1)` | entrada · saída · o que muda na tela |
| `MOTION_SPRING.press` · `knob` · `thumb` · `panel` | mola com tempo visual de 0,15 s sem sobra · 0,3 s, sobra 0,15 · 0,35 s, sobra 0,2 · 0,3 s sem sobra | aperto · knob do `ThemeSwitch` · thumb do `SectorPicker` · Sheet e gaveta |
| `PRESS_SCALE` | 0,97 | aperto do `Button` |
| deslocamentos dos presets | painel 40px · gaveta 105% · tooltip 4px e escala 0,96 | `sheetMotion`, `tooltipMotion` |
