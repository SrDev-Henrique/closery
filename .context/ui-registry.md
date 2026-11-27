# UI Registry — Closery

> **Documento vivo + catálogo único de componentes.** Antes de criar **qualquer** componente,
> consulte este arquivo. Todo componente segue o `ui-tokens.md` (valores) e o `ui-rules.md`
> (construção).

---

## Regra anti-duplicação (a regra mais importante)

**Não crie componentes parecidos com os que já existem.**

1. **Existe algo igual ou parecido?** → Estenda o atual (nova `variant`, prop opcional,
   composição) e registre a mudança no "Histórico" do item.
2. **Não existe?** → Crie seguindo `ui-tokens.md` + `ui-rules.md` e documente aqui.

## Como documentar um componente (template)

```
### <Nome>
- **Status:** ✅ pronto | 🟡 a construir | ✏️ estendido
- **Local:** src/components/<...>.tsx
- **Propósito:** o que resolve.
- **Como funciona:** comportamento, variações, responsividade.
- **Usa:** primitivos/tokens que compõe.
- **Histórico:** mudanças relevantes (datadas).
```

---

## 1. Primitivos (shadcn `base-nova` / Base UI) — `src/components/ui`

Adicionados pelo CLI (`bunx shadcn add <nome>`), em kebab-case.

### Button
- **Status:** ✅ pronto (scaffold, 2026-11-20)
- **Local:** `src/components/ui/button.tsx`
- **Propósito:** toda ação clicável.
- **Como funciona:** `@base-ui/react/button` + `cva`. Pílula (`rounded-full`) em todas as variantes e
  tamanhos (C-V2, 2026-11-27). Variantes `default`, `outline`, `secondary`, `ghost`, `destructive`,
  `link`, mais `surface` (`bg-card`, hover `bg-accent`: botão sobre o fundo da página),
  `on-pastel` (`bg-on-pastel text-on-pastel-ink`, `active:scale-[.97]`: primário dentro de card
  colorido) e `on-pastel-secondary` (`bg-on-pastel-secondary`, hover `-hover`: secundário dentro de
  card colorido). Tamanhos `default`, `xs`, `sm`, `lg` (h-11), `icon`, `icon-xs`, `icon-sm`,
  `icon-lg`, `pill` (48px, `font-heading` 16px/700, `px-[22px]`, `gap-2.5`, ícone 18px) e
  `icon-pill` (44px redondo); os dois sem a borda transparente de 1px da base (`border-0`: com o `bg-clip-padding` ela deixava o fundo visível com 46/42px e 2px mais largo). As variantes `on-pastel` e `on-pastel-secondary` trocam o anel `ring/50` (invisível sobre os pastéis) por contorno sólido de 2px (`outline-offset-2`) na tinta `on-pastel`: `focus-visible:outline-solid` é obrigatório (o `outline-none` da base grava `--tw-outline-style: none`, e sem ele o `outline-2` não desenha nada) e `focus-visible:ring-0!` apaga o anel da base tanto no `buttonVariants` cru num `<Link>` quanto pelo `cn`. Prova pelo estilo calculado no Chromium em `e2e/inicio.spec.ts` (`expectPastelFocusRing`). Composição com `render`, não `asChild`. O tamanho do texto fica em
  cada `size` (não na base) para `buttonVariants` usado cru em `<Link>` não ter dois `font-size`.
  Padding do `pill` (protótipo): 22px nos primários `on-pastel`; 20px no `surface` ("Ver o
  dashboard"), no `default` ("Ver solicitações") e nos secundários `on-pastel-secondary`, sempre por
  `cn(buttonVariants({ variant, size: "pill" }), "px-5")` (o `cn` resolve o conflito com o
  `px-[22px]`; nunca concatene as duas classes sem ele).
- **Atenção:** todo tamanho tem h-9 / size-9 no desktop e `max-md:h-11` / `max-md:size-11` no
  celular (`lg`, `icon-lg` e `icon-pill` são 44px sempre; `pill` é 48px sempre). Teste: `button.test.ts`. Para navegação use
  `<Link className={buttonVariants()}>` (continua role link); `render={<Link />}` (com
  `nativeButton={false}`) vira role=button e só serve quando o papel de botão é o desejado.
- **Usa:** tokens `primary`, `input`, `accent`, `card`, `ring`, `destructive`, `on-pastel*`.
- **Histórico:** 2026-11-20 — gerado pelo `shadcn init` (sem alteração). 2026-11-20 — P3: alvos de
  toque (h-9 desktop, 44px no celular). 2026-11-21 — Fase 2: `shadcn add dialog` sobrescreve o arquivo; restaurado com `git checkout` (F2-24). 2026-11-27 — Visual do Início (Task 4): `rounded-full` em tudo (sai o `rounded-lg` e os `rounded-[min(...)]`, e o `in-data-[slot=button-group]:rounded-lg`); variantes `surface`, `on-pastel`, `on-pastel-secondary`; tamanhos `pill` e `icon-pill`; `text-sm font-medium` saiu da base para cada `size`. 2026-11-27 — Task 16 (pixel): `pill` e `icon-pill` com `border-0` (o fundo visível era 46×(largura+2) e 42px; agora 48 e 44px, iguais ao protótipo). 2026-11-27 — Task 15 (legibilidade): `outline` com a borda `border-input` nos dois temas (era `border-border`, que no claro some no fundo da página: "Corrigir", "Sair" e afins pareciam texto solto). 2026-11-27 — Task 15 (legibilidade): `border-transparent` saiu da base para cada variante menos o `outline` (no CSS gerado `.border-transparent` vem depois de `.border-input` e, com `buttonVariants` cru num `<Link>`, apagava a borda do outline no tema claro). 2026-11-27 — Segunda rodada de correções (G1): `on-pastel` e `on-pastel-secondary` com `focus-visible:outline-solid` e `focus-visible:ring-0!` (a F1 só pedia `outline-2`, que com o `outline-none` da base resolvia para `outline-style: none`; pelo `cn`, "Agora não" e "Ver todas as passagens" ficavam sem indicador nenhum); E2E mede `outline-style: solid`, 2px, offset 2px, cor `rgb(28, 27, 25)` e nenhum anel. 2026-11-27 — Segunda rodada (G2): `destructive` com fundo `/10` → hover `/15` no claro e `/15` → hover `/20` no escuro (era `/10`→`/20` e `/20`→`/30`), junto com o `--destructive` `#b80000` / `#ff9393`: `text-destructive` passa 4,5:1 sobre o fundo do botão em repouso e no hover, sobre `background` e `card`; o `themeContrast.test.ts` lê os percentuais desta variante. 2026-11-27 — PR B (P83): `outline` e `ghost` com hover e `aria-expanded` em `bg-accent` (e `dark:hover:bg-accent/50` no `ghost`); eram `bg-muted`, igual ao card na paleta nova, e o hover sumia dentro de cartão, diálogo e Sheet. Guarda: `src/app/mutedBackground.test.ts`.

### Input
- **Status:** ✏️ estendido
- **Local:** `src/components/ui/input.tsx`
- **Propósito:** campo de texto de uma linha.
- **Como funciona:** `@base-ui/react/input`; `text-base` no celular (16px, sem zoom do iOS) e
  `md:text-sm`; estilo `aria-invalid` pronto. Altura `h-9 max-md:h-11`.
- **Usa:** tokens `input`, `ring`, `destructive`, `muted-foreground`.
- **Histórico:** 2026-11-20 — `shadcn add`; altura sobe de h-8 para `h-9 max-md:h-11` (P3).

### Label
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/label.tsx`
- **Propósito:** rótulo de campo (`<label>` simples).
- **Como funciona:** HTML puro; use `htmlFor` casando com o `id` do campo. Dentro de formulário,
  prefira `FieldLabel`.
- **Usa:** tokens de texto.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### Field (FieldGroup, FieldLabel, FieldDescription, FieldError…)
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/field.tsx`
- **Propósito:** estrutura de formulário acessível: rótulo, campo, ajuda e erro.
- **Como funciona:** HTML puro; **não** liga `id`/`aria-*` sozinho — passe `htmlFor`/`id`,
  `aria-invalid` no `Input` e `aria-describedby` apontando para o `FieldError`. `Field
  data-invalid` pinta o rótulo de `destructive`. `FieldError` renderiza `role="alert"` e retorna
  `null` se vazio.
- **Usa:** `Label`, `Separator`; tokens `destructive`, `muted-foreground`, `accent`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração. 2026-11-27 — PR B (P83): o hover do `FieldLabel` que envolve um campo em `bg-accent/50` (era `bg-muted/50`, igual ao card).

### InputGroup
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/input-group.tsx` (traz `textarea.tsx`)
- **Propósito:** campo com adornos (ícone, texto, botão) dentro da mesma borda.
- **Como funciona:** `InputGroup`, `InputGroupAddon`, `InputGroupButton`, `InputGroupText`,
  `InputGroupInput`, `InputGroupTextarea`. O `InputGroupButton` sobrescreve a altura do `Button`,
  mas o `max-md:` do P3 sobrevive: no celular o botão pode ficar mais alto que o campo.
- **Usa:** `Button`, `Input`, `Textarea`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### Textarea
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/textarea.tsx`
- **Propósito:** campo de texto de várias linhas (veio como dependência do `InputGroup`).
- **Como funciona:** `<textarea>` estilizado igual ao `Input`.
- **Usa:** tokens `input`, `ring`, `destructive`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### Card
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/card.tsx`
- **Propósito:** superfície que agrupa um bloco de conteúdo.
- **Como funciona:** `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`,
  `CardContent`, `CardFooter`; HTML puro. `Card` aceita `variant="default" | "feature"` (escreve
  `data-variant`). `feature` = raio 32px, padding 32px (22px abaixo de 860px, via `--card-spacing`),
  `gap-0`, sem `ring`, sem borda e sem sombra; o fundo vem do `className` (`bg-highlight`, etc.).
  Num `feature` o conteúdo vai direto nos filhos: `CardHeader`/`CardContent` somariam o `px` deles.
- **Usa:** tokens `card`, `card-foreground`, `border`, `accent`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração. 2026-11-27 — Visual do Início (Task 4): variante `feature`; o `default` não mudou. 2026-11-27 — PR B (P83): `CardFooter` com `bg-accent/50` (era `bg-muted/50`: o rodapé não se separava do corpo).

### Separator
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/separator.tsx`
- **Propósito:** linha divisória horizontal ou vertical.
- **Como funciona:** `@base-ui/react/separator`; prop `orientation`.
- **Usa:** token `border`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### Sidebar
- **Status:** ✏️ estendido
- **Local:** `src/components/ui/sidebar.tsx` (traz `src/hooks/use-mobile.ts`)
- **Propósito:** navegação lateral do app; vira gaveta (`Sheet`) no celular.
- **Como funciona:** `SidebarProvider` > `Sidebar` > `SidebarHeader`/`SidebarContent`/
  `SidebarFooter`, com `SidebarInset` ao lado e `SidebarTrigger` (Ctrl/Cmd+B). `SidebarMenuButton`
  aceita `isActive` e `render={<Link />}`; `useSidebar().setOpenMobile(false)` fecha a gaveta
  após navegar. Breakpoint do celular: 860px (igual ao `md`, Task 1 do visual novo); largura 17,5rem (280px), sem borda no desktop; a gaveta do celular tem a sombra `data-[side=left]:shadow-drawer` (token, `20px 0 60px`), o scrim `bg-scrim` (token, preto a 45%, sem blur) e desliza 350ms com `cubic-bezier(.2,.8,.2,1)` (`motion-reduce` desliga). O primeiro render é sempre desktop
  (`useIsMobile` começa `false`). Exige `TooltipProvider` acima. Ler `cookies()` para
  `defaultOpen` exigiria `Suspense`; use `defaultOpen` fixo.
- **Usa:** `Button`, `Input`, `Separator`, `Sheet`, `Skeleton`, `Tooltip`; tokens `sidebar-*`.
- **Histórico:** 2026-11-20 — `shadcn add`; `SidebarMenuButton` default sobe de h-8 para
  `h-9 max-md:h-11` (P3); textos acessíveis em pt-BR ("Alternar menu", gaveta "Menu").
  2026-11-27 — visual novo (Task 9): `SIDEBAR_WIDTH` e `SIDEBAR_WIDTH_MOBILE` 17.5rem; some a borda lateral do desktop; o `SheetContent` da gaveta ganha largura pelo token (a `w-3/4` do Sheet perdia para a classe sem variante), `border-r-0`, sombra, curva e deslize de −105% sem fade; `overlayClassName` troca o scrim. O visual dos itens (pílula de 48px) vem por `className` no `AppSidebar`; o `default` de `SidebarMenuButton` não mudou.

### Sheet
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/sheet.tsx`
- **Propósito:** painel que desliza da borda (gaveta de navegação no celular, painéis laterais).
- **Como funciona:** `@base-ui/react/dialog`; `side` = `top|right|bottom|left`; `SheetHeader`,
  `SheetTitle`, `SheetDescription`, `SheetFooter`, `SheetClose`. O botão de fechar usa
  `Button size="icon-sm"` (44px no celular).
- **Usa:** `Button`; tokens `background`, `border`.
- **Histórico:** 2026-11-20 — `shadcn add`; o `sr-only` do botão de fechar passa a "Fechar". 2026-11-27 — visual novo (Task 9): `SheetContent` aceita `overlayClassName` (o padrão `bg-black/10` + blur continua para os outros Sheets); só a gaveta do menu usa.

### Tooltip
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/tooltip.tsx`
- **Propósito:** rótulo curto de controle só com ícone (regra do `AGENTS.md`).
- **Como funciona:** `@base-ui/react/tooltip`; `TooltipProvider` uma vez no layout raiz
  (sem ele o Base UI lança erro); `TooltipTrigger render={<Button … />}`.
- **Usa:** tokens `foreground`, `background`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### Sonner (Toaster)
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/sonner.tsx`
- **Propósito:** toasts de confirmação ("Passkey criada.").
- **Como funciona:** um `<Toaster />` no layout raiz; dispare com `toast.success(...)` de
  `sonner`. Lê o tema via `useTheme` (`src/lib/useTheme.ts`).
- **Usa:** tokens `popover`, `border`.
- **Histórico:** 2026-11-20 — `shadcn add` (traz `sonner` e `next-themes`). 2026-11-27 — visual novo (Tarefa 3): agora existe `ThemeProvider` no layout raiz e o toast segue o tema do app (escuro padrão), não mais "system". 2026-11-27 — fix(tema): o tema vem do `useTheme` próprio (sem `next-themes`).

### Avatar
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/avatar.tsx`
- **Propósito:** foto ou iniciais de uma pessoa.
- **Como funciona:** `Avatar`, `AvatarImage`, `AvatarFallback`, `AvatarGroup`, `AvatarBadge`;
  `size` = `default|sm|lg`.
- **Usa:** `@base-ui/react/avatar`; tokens `accent`, `muted-foreground`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração. 2026-11-27 — PR B (P83): fundo do `AvatarFallback` e do `AvatarGroupCount` em `bg-accent` (era `bg-muted`, igual ao card; primitivo sem uso hoje).

### DropdownMenu
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/dropdown-menu.tsx`
- **Propósito:** menu de ações de um botão.
- **Como funciona:** `@base-ui/react/menu`. `DropdownMenuLabel` precisa estar dentro de
  `DropdownMenuGroup`. `DropdownMenuItem` aceita `render={<Link />}` direto (não é nativo).
- **Usa:** tokens `popover`, `accent`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### Skeleton
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/skeleton.tsx`
- **Propósito:** estado de carregamento (fallback de `Suspense`).
- **Como funciona:** `div` pulsante com `bg-accent` (o `muted` é igual ao card na paleta nova); dê o tamanho por `className`, e troque o fundo por `className` quando o esqueleto estiver sobre outro fundo (o Início usa `bg-card`).
- **Usa:** token `accent`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração. 2026-11-27 — Task 15 (legibilidade): fundo `bg-accent` (era `bg-muted`, igual ao card na paleta nova: o esqueleto sumia dentro dos cards e do Sheet do detalhe); quem precisa de outro fundo troca pelo `className` (o Início usa `bg-card`). Teste novo.

### Alert
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/alert.tsx`
- **Propósito:** aviso em linha dentro da tela (erro de formulário, informação).
- **Como funciona:** `Alert`, `AlertTitle`, `AlertDescription`, `AlertAction`; variantes
  `default` e `destructive` apenas. Status `success`/`warning`/`info` pedem classes com os tokens
  novos, sempre com ícone + texto.
- **Usa:** tokens `card`, `destructive`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### Badge
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/badge.tsx`
- **Propósito:** etiqueta curta de estado ou papel.
- **Como funciona:** pílula (`rounded-full`, `whitespace-nowrap`). Variantes `default`, `secondary`,
  `destructive`, `outline`, `ghost`, `link`, mais `warning`, `info`, `success` (tokens de estado),
  `neutral` (`bg-accent text-foreground`). `size`: `default` (h-5, `font-medium`) e `md` (h-6, `px-2.5`,
  `font-semibold`, `border-0` e `leading-[normal]`: sem a borda de 1px da base e com a altura de linha da fonte, como no protótipo; quem passa outro `text-*` no `className` repete o `leading-[normal]` depois dele, porque o twMerge descarta o `leading` que vem antes de um `text-*`). Aceita `render`.
- **Usa:** tokens `primary`, `secondary`, `destructive`, `warning`, `info`, `success`, `accent`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração. 2026-11-27 — Visual do Início (Task 4): `rounded-full` (era `rounded-4xl`), `whitespace-nowrap` já existia; variantes e `size="md"` novos. 2026-11-27 — Task 16 (pixel): `md` com `border-0` (era 2px mais largo) e `leading-[normal]` (o texto ficava até 0,8px acima do centro do protótipo). 2026-11-27 — Pack de correção do Início (Task 18, spec §6.4.1): saem as variantes `pastel-pending` e `pastel-confirmed` e os tokens delas (o cartão de turno passou a usar blocos de largura inteira). 2026-11-27 — PR B (P83): `outline` (`[a]:hover:`) e `ghost` (hover e `dark:hover:`) em `bg-accent`, com a mesma opacidade (eram `bg-muted`, igual ao card).

### Toggle / ToggleGroup
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/ui/toggle.tsx`, `src/components/ui/toggle-group.tsx`
- **Propósito:** controle segmentado para um conjunto pequeno e fechado de respostas (papel, tipo do item).
- **Como funciona:** `@base-ui/react/toggle-group`; `ToggleGroup` (`variant`, `size`, `spacing`) + `ToggleGroupItem`; o item marcado tem `aria-pressed="true"`. No uso do projeto: `variant="outline"`, `size="lg"`. Clicar no item já marcado **desmarca** (lista vazia em `onValueChange`): quem precisa de "nunca vazio" usa o `ChoiceGroup`.
- **Atenção:** todo tamanho tem `h-9` / `min-w-9` no desktop e `max-md:h-11` / `max-md:min-w-11` no celular. Teste: `touchTargets.test.tsx`.
- **Usa:** tokens `primary` / `primary-foreground` (marcado), `accent` (hover), `input`, `ring`.
- **Histórico:** 2026-11-21 — `shadcn add toggle-group` (traz `toggle`); alturas `h-8`/`h-7` viram `h-9 max-md:h-11` (P3). 2026-11-27 — Task 15 (legibilidade): marcado (`aria-pressed`) com `bg-primary text-primary-foreground` e hover `bg-accent` (eram `bg-muted`, igual ao card na paleta nova: no formulário a opção escolhida não se distinguia).

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
- **Usa:** `Button`; tokens `popover`, `accent`.
- **Histórico:** 2026-11-21 — `shadcn add dialog`; os dois "Close" viram "Fechar" (P12). O CLI sobrescreve `button.tsx` (pergunta mesmo com `--yes`): rode com `--overwrite` e depois `git checkout -- src/components/ui/button.tsx` (F2-24). 2026-11-27 — PR B (P83): `DialogFooter` com `bg-accent/50` (era `bg-muted/50`; o `popover` tem o valor do card e o rodapé não se separava).

### Table (TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption…)
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/ui/table.tsx`
- **Propósito:** a primeira tabela do projeto: a visão Tabela das solicitações (dado que se compara em colunas).
- **Como funciona:** adicionado pelo CLI (`bunx shadcn@latest add table --yes`); o contêiner `data-slot="table-container"` tem `overflow-x-auto`, então a tabela rola na horizontal sozinha e a página nunca rola. Ajustes depois do CLI: sem `"use client"` (é server-safe) e formatação do Biome. Quem usa põe `text-right tabular-nums` nas colunas numéricas e `TableCaption className="sr-only"` com o nome da tabela.
- **Usa:** tokens `border`, `accent`, `foreground`.
- **Histórico:** 2026-11-24 — `shadcn add table` na Fase 4 (Tarefa 11). 2026-11-27 — PR B (P83): rodapé, hover e linha aberta (`has-aria-expanded`) em `bg-accent/50` e linha selecionada em `bg-accent` (eram `bg-muted`, igual ao card).

### Chart (ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent)
- **Status:** ✅ pronto (2026-11-25)
- **Local:** `src/components/ui/chart.tsx` (`"use client"`)
- **Propósito:** o primitivo de gráfico do shadcn sobre o recharts 3.8.0 (a linha da evolução do estoque).
- **Como funciona:** adicionado pelo CLI (`echo n | bunx shadcn@latest add chart --yes`: o `n` recusa sobrescrever o `card.tsx`). O `ChartContainer` injeta as cores do `ChartConfig` como `--color-<chave>` nos dois temas (aceita `var(--foreground)`) e quem usa dá altura explícita (`className="aspect-auto h-48 w-full"`); no jsdom ele renderiza sem `ResizeObserver` (usa `initialDimension`). Ajustes depois do CLI: `organizeImports` e formatação do Biome; `biome-ignore lint/security/noDangerouslySetInnerHtml` dentro da tag `<style>` do `ChartStyle` (CSS gerado só do `ChartConfig` do código, nunca de entrada de pessoa; a regra segue ligada no `biome.json`); no `ChartTooltipContent`, `formatInteger` (pt-BR) no lugar de `toLocaleString()` e `tabular-nums` no lugar de `font-mono`. Nunca `Fragment` dentro de um gráfico do recharts. O peer `react-is@19.3.0` é fixado junto com o `recharts` no `package.json`.
- **Usa:** `cn`, `formatInteger`, `recharts`.
- **Histórico:** 2026-11-25 — `shadcn add chart` na Fase 5 (Tarefa 10).

## 2. Componentes de aplicação — `src/components/<área>`

### AppSidebar
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/AppSidebar.tsx` (itens em `navItems.ts`)
- **Propósito:** navegação lateral do app autenticado: Início, Passagens, Solicitações (ícone `PackageOpen`), Dashboard (ícone `ChartColumn`), Conta e, só para admin, Administração.
- **Como funciona:** `"use client"`; recebe `isAdmin`, `userName`, `userEmail`, `avatarSrc` (data URI pronto do `AuthedSidebar`). Item ativo por
  `usePathname` (`/` só na raiz exata; os demais valem para a rota e subrotas) com `isActive` +
  `aria-current="page"`. Cada item é `SidebarMenuButton render={<Link />}`; ao navegar fecha a
  gaveta do celular (`setOpenMobile(false)`). Wordmark "Closery" (Satoshi 900, 28px) no topo; no celular o botão X ("Fechar menu", `Button surface icon-pill` com tooltip) fica ao lado dele. Dois grupos em `nav` (raio 28, `bg-card`): "Principal" (`mainNavItems`) e, só para admin, "Administração" (`adminNavItems`); itens de 48px em pílula, Satoshi 16/700, ativo em `bg-primary`, hover `bg-accent` em 150ms. Card do usuário (raio 24) com `UserAvatar` de 44px a −4°, nome e e-mail truncados e o chip ADMIN/COLEGA (Geist Mono 11px). O Início fica
  atrás de `<Suspense>` no layout (o `usePathname` suspende em rota dinâmica).
- **Usa:** `Sidebar*`, `UserAvatar`, `Button` (`surface`, `icon-pill`), `Tooltip`, `lucide-react`; tokens `sidebar-*`, `card`, `primary`, `accent`.
- **Histórico:** 2026-11-20 — criado na Fase 1. 2026-11-24 — Fase 4 (revisão final): o menu lista o item Solicitações (`/solicitacoes`, ícone `PackageOpen`) entre Passagens e Conta; o registro não o mencionava. 2026-11-25 — Fase 5 (Tarefa 12): o menu ganha o item Dashboard (`/dashboard`, ícone `ChartColumn`) entre Solicitações e Conta. 2026-11-27 — visual novo (Task 9): sidebar de 280px sem borda, dois grupos, card do usuário com avatar e chip de papel, X no drawer; `navItems.ts` separa `mainNavItems` e `adminNavItems` (`NAV_ITEMS` e `visibleNavItems` continuam). 2026-11-27 — Task 16 (pixel): nome e e-mail do card do usuário com `leading-[normal]` (eram 22,5 e 18,75px de linha; o nome ficava 1px acima do protótipo).

### AuthedSidebar
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/AuthedSidebar.tsx`
- **Propósito:** liga a sessão ao menu.
- **Como funciona:** Server Component assíncrono; `requireUser()` e devolve `<AppSidebar />` com `avatarSrc = avatarDataUri(userId)` (semente = id).
  Sempre dentro de `<Suspense fallback={<SidebarSkeleton />}>` no layout `(app)`.
- **Usa:** `AppSidebar`, `requireUser`.
- **Histórico:** 2026-11-20 — criado na Fase 1. 2026-11-20 — o `RequireUser` (portão no layout) foi tentado e removido na re-revisão: o Next não deixa o layout controlar a página; o portão é `requireUser`/`requireAdmin` em cada página, guardado por `appPagesAuth.test.ts`. 2026-11-27 — visual novo (Task 9): passa `avatarSrc` ao `AppSidebar`.

### SidebarSkeleton
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/SidebarSkeleton.tsx`
- **Propósito:** reserva o espaço da barra lateral enquanto a sessão carrega.
- **Como funciona:** só no desktop (`hidden md:flex`), `aria-hidden`, largura `--sidebar-width`, sem borda. Três blocos: wordmark, grupo de navegação (264px, raio 28) e card do usuário (68px, raio 24) colado embaixo.
- **Usa:** `Skeleton`; token `sidebar`.
- **Histórico:** 2026-11-20 — criado na Fase 1. 2026-11-27 — visual novo (Task 9): forma nova, sem `border-r`.

### MenuToggle
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/MenuToggle.tsx`
- **Propósito:** botão do cabeçalho que abre e fecha a barra lateral.
- **Como funciona:** `"use client"`; `Button variant="surface" size="icon-pill"` (44px, redondo) dentro de
  `TooltipTrigger render`, com `aria-label`, `sr-only` e tooltip "Alternar menu", chamando
  `useSidebar().toggleSidebar`. Os dois ícones (`PanelLeft` e `Menu`) estão sempre no HTML e o CSS
  escolhe: `PanelLeft` com `max-md:hidden`, `Menu` com `hidden max-md:block` (abaixo de 860px abre a
  gaveta). `aria-expanded` segue o que o botão abre: a gaveta (`openMobile`) no celular, a barra
  (`open`) no desktop. Testado com `fireEvent.pointerEnter/mouseEnter` e, no celular, com
  `window.innerWidth` 390.
- **Usa:** `Button`, `useSidebar`, `Tooltip*`.
- **Histórico:** 2026-11-20 — criado na Fase 1. 2026-11-27 — visual novo (Task 9): deixa de usar o
  `SidebarTrigger` (ghost, `icon-sm`) e vira o botão redondo de 44px com ícone por viewport.
  2026-11-27 — Revisão final (F11): `aria-expanded` (`isMobile ? openMobile : open`). 2026-11-27 —
  Segunda rodada (G5): teste do ramo do celular.

### AppHeader
- **Status:** ✅ pronto (2026-11-27)
- **Local:** `src/components/app-shell/AppHeader.tsx`
- **Propósito:** cabeçalho do app autenticado: botão de menu à esquerda e switch de tema à direita.
- **Como funciona:** `"use client"` (não usa hooks; só compõe `MenuToggle` e `ThemeSwitch`). `<header>` de
  76px (`h-[76px]`), `justify-between`, **sem borda**. O wordmark "Closery" (Satoshi 900, 24px) usa
  `hidden max-md:inline`: só aparece abaixo de 860px, onde a sidebar fixa não está na tela. Vive dentro
  do div centrado (1240px, 40px/16px de padding) que fica dentro do `@container/main` do `(app)/layout.tsx`.
- **Usa:** `MenuToggle`, `ThemeSwitch`.
- **Histórico:** 2026-11-27 — criado no visual novo (Task 9); substitui o `<header>` com `border-b` do layout.

### ThemeSwitch
- **Status:** ✅ pronto (2026-11-27)
- **Local:** `src/components/app-shell/ThemeSwitch.tsx`
- **Propósito:** switch estilo Apple que alterna entre o tema escuro e o claro (vai no cabeçalho).
- **Como funciona:** `"use client"`; `<button role="switch" aria-checked aria-label="Tema escuro">` em `TooltipTrigger render`, com
  tooltip "Mudar para o tema claro" / "Mudar para o tema escuro". Trilho 76x44 em `card`, knob de 36px em `primary` com `Moon` (escuro,
  à direita) ou `Sun` (claro, à esquerda); a posição e o ícone saem do CSS (`dark:`), que o script do `<head>` (`src/lib/theme.ts`) resolve antes da
  pintura (sem piscar), e `transition: left .3s cubic-bezier(.2,.8,.2,1)` (desligada em `motion-reduce`). O `aria-checked` e o texto
  do tooltip vêm do `useTheme` (`useSyncExternalStore`, snapshot do servidor "escuro", igual ao HTML). Testado
  com `renderToString` (hidratação), teclado e tooltip com `fireEvent` como o `MenuToggle`.
- **Usa:** `useTheme` (`src/lib/useTheme.ts`), `Tooltip*`; tokens `card`, `primary`, `primary-foreground`, `ring`.
- **Histórico:** 2026-11-27 — criado no visual novo (Tarefa 3). 2026-11-27 — fix(tema): saiu do `next-themes` para o módulo de tema próprio; o `ThemeProvider` foi removido (o script do `next-themes` duplicava conteúdo).

### Greeting
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/Greeting.tsx`
- **Propósito:** o topo do hero do Início: eyebrow com a data por extenso (São Paulo, caixa alta) e o título "Olá, {primeiro nome}".
- **Como funciona:** Server Component assíncrono (`requireUser`); usa `greetingTitle` de
  `src/lib/names.ts`. Dentro de `<Suspense>` na página.
- **Usa:** `requireUser`, `greetingTitle`, `formatEyebrowDateBR`.
- **Histórico:** 2026-11-20 — criado na Fase 1 (substitui o texto provisório do scaffold). 2026-11-21 — Fase 3: o segundo parágrafo passa a "Em breve: solicitações e dashboard." (a passagem deixou de ser "em breve"); a página `/` ganha os cartões de `HomeHandovers`. 2026-11-24 — Fase 4 (Tarefa 13): o segundo parágrafo passa a "Em breve: dashboard." (as solicitações chegaram) e o esqueleto de `/` ganha o terceiro cartão. 2026-11-25 — Fase 5 (Tarefa 12): o segundo parágrafo vira o link "Ver o dashboard" (`/dashboard`); o "Em breve" saiu. 2026-11-26 — Fase 6 (Tarefa 7, P12): o link ganha `max-md:inline-flex max-md:min-h-11 max-md:items-center` (alvo de toque de 44 px no celular; o desktop não muda). 2026-11-27 — visual novo do Início (Tarefa 11): eyebrow mono 13px com a data e `h1` Satoshi 900 de 72px (60px com área útil abaixo de 900px, 44px no celular); o link "Ver o dashboard" saiu daqui e virou o botão `surface` da linha do hero no `HomeHandovers`; topo do hero `pt-7` (`max-md:pt-3`), gap de 14px entre eyebrow e título.

### UserAvatar
- **Status:** ✅ pronto (2026-11-27)
- **Local:** `src/components/app-shell/UserAvatar.tsx` (sem `"use client"`, sem `server-only`: só desenha)
- **Propósito:** avatar decorativo da pessoa (sidebar, "Passagem para confirmar", turno, solicitações vazias, convite).
- **Como funciona:** props `{ src, size: 34 | 36 | 44 | 52 | 84, tilt?, frame?: "default" | "on-pastel", className? }`. `src` é o data URI de `avatarDataUri(userId)` (`src/lib/avatar.ts`, `server-only`, DiceBear `notionists`, semente = id do usuário, cache por semente; semente vazia lança erro). Moldura de tamanho cheio com padding e raios do protótipo (34 → 2,5px e 11px; 36 → 2,5px e 12px; 44 → 3px e 15px; 52 → 3px e 17px; 84 → 4px e 26px), imagem com o raio que acompanha a moldura (9, 10, 12, 14 e 22px); `bg-frame` (padrão) ou `bg-on-pastel` sobre os cards coloridos; `tilt` em graus via `style.transform` (geometria, não cor). `<img alt="" draggable={false}>` com `width`/`height`: o nome da pessoa sempre aparece ao lado, então a imagem não entra na árvore de acessibilidade. `biome-ignore noImgElement` com motivo (SVG em data URI não passa pelo `next/image`).
- **Usa:** tokens `frame`, `on-pastel`; `avatarDataUri` (quem chama, no servidor).
- **Histórico:** 2026-11-27 — criado no visual novo do Início (Task 8). 2026-11-27 — Pack de correção (Task 18): também na linha de entrega do `MyShiftCard` (36 px, +3° quem entregou, −4° quem confirmou), pelo `AvatarStack`.

### AvatarStack
- **Status:** ✅ pronto (2026-11-27)
- **Local:** `src/components/app-shell/AvatarStack.tsx` (sem `"use client"`, sem `server-only`: só desenha)
- **Propósito:** avatares sobrepostos de mais de uma pessoa numa linha de texto (hoje, quem entregou e quem confirmou, no `MyShiftCard`).
- **Como funciona:** props `{ avatars: { id, src, tilt? }[], size: UserAvatarSize, frame?: "default" | "on-pastel", className? }`. Invólucro `flex flex-none items-center` (`data-slot="avatar-stack"`) com um `UserAvatar` por item, na ordem recebida: o primeiro com `relative z-1` (fica por cima, como o `z-index: 1` do protótipo) e cada um depois dele com `-ml-2` (8 px por baixo do anterior). `id` é a chave React (estável e única na pilha: o papel ou o id da pessoa). Lista vazia não desenha nada. Decorativo: as imagens têm `alt=""` e o nome das pessoas está no texto ao lado.
- **Usa:** `UserAvatar`.
- **Histórico:** 2026-11-27 — criado no pack de correção do Início (Task 18).

### InviteTeamCard
- **Status:** ✅ pronto (2026-11-27)
- **Local:** `src/components/app-shell/InviteTeamCard.tsx` (server-safe)
- **Propósito:** cartão "Convide sua equipe" do primeiro acesso do admin: o último passo é gerar os convites.
- **Como funciona:** `Card variant="feature"` rosa (`bg-invite`, tinta `text-on-pastel`), grid `minmax(0,1fr) minmax(0,1.2fr)` só a partir de 1040 px de área útil (container query). Coluna 1: quatro tiles de 52 px (o `UserAvatar` do admin a −5° e três tracejados, o primeiro com `Plus`; decorativos, `aria-hidden`), eyebrow "Último passo", `<h2>` "Convide sua equipe" (26 px; 22 px no celular), o texto (máx. 440 px), o link `on-pastel` "Gerar convites" (`/admin/equipe`) e o botão `on-pastel-secondary` "Agora não" (20px de padding; um `<form action={dismissInviteCardAction}>`: a ação da Task 10 devolve `void`, grava o cookie `closery-convite-dispensado` e atualiza a tela; nada de `"use server"` inline no componente, que o `actionsGuards.test.ts` recusaria). Coluna 2: bloco `bg-on-pastel-soft` "Cadastros" com 5 linhas de no mínimo 44 px (Setores, Turnos, Itens, Destinos com "{n} ativo(s)"; Equipe "{n} pessoa(s) ativa(s)", via `pluralize`). O indicador de 24 px vem preenchido com `Check` quando o cadastro tem ao menos um ativo (`data-done`) e tracejado vazio quando não (a Equipe nunca vem marcada); o texto "Feito"/"Falta fazer" é só para leitor de tela.
- **Usa:** `Card`, `Button`, `buttonVariants`, `UserAvatar`, `pluralize`, tokens `invite`, `on-pastel*`, `on-invite-*`.
- **Histórico:** 2026-11-27 — criado no visual novo do Início (Task 14). 2026-11-27 — Task 16 (pixel): linhas de Cadastros com `box-content` (os 44px mínimos são do conteúdo e a divisória soma 1px por fora, como no protótipo; com o `border-box` do reset cada linha tinha 1px a menos e o cartão, 4px).

### AppError e AppNotFound
- **Status:** ✅ pronto (2026-11-25)
- **Local:** `src/app/(app)/error.tsx` (`"use client"`) e `src/app/(app)/not-found.tsx` (arquivos de convenção do Next, não componentes de `src/components`)
- **Propósito:** o erro e o 404 de uma página de `(app)` aparecem dentro do shell: a barra lateral continua na tela (P19).
- **Como funciona:** os mesmos textos da raiz, em `<div>` e nunca em `<main>` (o `SidebarInset` já é o `<main>`): `Algo deu errado` com o botão `Tentar de novo` (`retry()`; o erro vai para `logServerError(error, "error-boundary")`, que escreve só o resumo, e a mensagem nunca aparece) e `Página não encontrada` com o link `Voltar ao início` (`buttonVariants`, `href="/"`). O `notFound()` de uma página de `(app)` (inclusive o `requireAdmin` do operador) renderiza aqui. O 404 da raiz já aparecia dentro do shell, mas com o `<main>` dele dentro do `<main>` do `SidebarInset`; agora há um `<main>` só. O erro é o que trocava o shell de verdade: o `error.tsx` da raiz envolve o layout de `(app)` e o de `(app)` envolve só a página. URL sem rota continua no `not-found` da raiz, com status 404. O `error.tsx` de `(app)` também envolve o slot `@detalhe` (o `not-found` só envolve `children`): um erro dentro do Sheet do detalhe rápido mostra o fallback no lugar do slot, fora do Sheet; aceito nesta fase.
- **Usa:** `Button`, `buttonVariants`, `logServerError`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 3, P19). 2026-11-26 — Fase 6 (Tarefa 2): o `useEffect` deste arquivo e o do `error.tsx` da raiz chamam `logServerError(error, "error-boundary")` no lugar de `console.error(error)`; a tela não muda. 2026-11-26 — Fase 6 (Tarefa 6): a captura no Sentry mora dentro do `logServerError`; este arquivo não muda. 2026-11-26 — revisão final da Fase 6: o `Usa:` passa a citar `logServerError` (o componente já o usava).

### GlobalError
- **Status:** ✅ pronto (2026-11-26)
- **Local:** `src/app/global-error.tsx` (`"use client"`; arquivo de convenção do Next, não componente de `src/components`)
- **Propósito:** o último limite de erro: aparece quando o próprio layout raiz quebra (a barra lateral, o tema e o CSS do layout não existem mais).
- **Como funciona:** substitui o layout raiz, então traz o próprio `<html lang="pt-BR">` e `<body className="flex min-h-full flex-col">` e importa `./globals.css`. O `<title>Algo deu errado</title>` é o do React 19 (limite de erro não aceita `metadata`). `<main>` com o título `Algo deu errado` e o `Button` `Tentar de novo` (`retry()`, o nome da prop no Next 16.4). O `useEffect` chama `logServerError(error, "global-error")` (a linha de log e o Sentry; erro com `digest` não vai de novo ao Sentry); a mensagem do erro nunca aparece. Testado no jsdom: o React 19 renderiza `<html>`/`<body>` nos singletons do `document`, e o único `console.error` aceito é o aviso `In HTML, %s cannot be a child of <%s>`. `bun scripts/rc-check.mjs src/app/global-error.tsx` confere que o React Compiler o compila.
- **Usa:** `Button`, `logServerError`.
- **Histórico:** 2026-11-26 — criado na Fase 6 (Tarefa 6).

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
  `bg-accent`, opaco). O título fica dentro do `<Suspense>` para o operador não ver "Administração"
  antes do 404, e a página não exporta `metadata` (o `<title>` revelaria a rota; T12); enquanto
  carrega, `page.tsx` mostra um esqueleto (título e cinco cartões).
- **Usa:** `requireAdmin`, `getAdminOverviewCounts`, `pluralize`, `Card*`, `next/link`.
- **Histórico:** 2026-11-20 — criado na Fase 1 (placeholder). 2026-11-21 — Fase 2: cartões dos cinco cadastros e contagens. 2026-11-27 — PR B (P83): hover do cartão em `group-hover:bg-accent`, opaco (era `bg-muted/50`, igual ao card; com `accent/50` sobre a página escura o resultado seria o próprio `--card` e o hover sumiria de novo).

### SessionKeepAlive
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/SessionKeepAlive.tsx`
- **Propósito:** única renovação da sessão de quem usa o app: o servidor lê sem renovar
  (`disableRefresh`) e esta chamada HTTP regrava banco e cookie juntos, passado o `updateAge`.
- **Como funciona:** `"use client"`; `useEffect` chama `authClient.getSession()` uma vez ao montar;
  erros em silêncio; renderiza `null`. Montado em `src/app/(app)/layout.tsx`, fora de `<Suspense>`.
- **Usa:** `authClient`.
- **Histórico:** 2026-11-20 — criado na revisão final da Fase 1.

### SocialButtons
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/auth/SocialButtons.tsx`
- **Propósito:** botões "Continuar com Google/Facebook", só dos provedores habilitados no env.
- **Como funciona:** `"use client"`; props `providers`, `onSelect`, `disabled`; lista vazia não
  renderiza nada; separador "ou".
- **Usa:** `Button` (`outline`, `lg`), `FieldSeparator`.
- **Histórico:** 2026-11-20 — criado na Fase 1.

### InviteUnavailable
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/auth/InviteUnavailable.tsx`
- **Propósito:** convite expirado, usado, cancelado ou inexistente.
- **Como funciona:** Server Component; `reason` → texto de `inviteMessages.ts` + "Peça um novo
  convite a quem te convidou." + "Já tem conta?" e o link `Entrar` (para `/entrar`, com cara de
  botão `outline` `lg`); sem formulário.
- **Usa:** `Card*`, `buttonVariants`, `next/link`.
- **Histórico:** 2026-11-20 — criado na Fase 1.

### InviteSignup
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/auth/InviteSignup.tsx`
- **Propósito:** cadastro por convite (nome, e-mail, senha e social).
- **Como funciona:** `"use client"`; estado controlado; `armInvite` antes de
  `signUp.email`/`signIn.social` (`requestSignUp: true`); erros do cadastro por
  `authFormError(errorCodeOf(erro))` (429 vira `RATE_LIMITED`), os de estado do convite vêm do
  `message` do `armInvite`; `aria-invalid`/`aria-describedby` no campo; trava duplo clique. Com
  `USER_ALREADY_EXISTS*` mostra o link `Entrar` (para `/entrar`) abaixo da mensagem.
- **Usa:** `Field*`, `Input`, `Button`, `buttonVariants`, `SocialButtons`.
- **Histórico:** 2026-11-20 — criado na Fase 1. 2026-11-26 — Fase 6 (Tarefa 8): o componente não muda; a página do convite válido (`/convite/[token]`) ganha um `CardFooter` com o `PrivacyLink`.

### SignInPanel
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/auth/SignInPanel.tsx`
- **Propósito:** tela de entrada (e-mail e senha, passkey, social).
- **Como funciona:** `"use client"`; autofill condicional de passkey no mount (silencioso, não
  trava botões); botão "Entrar com passkey"; social com `requestSignUp: false`; erro inicial de
  `?error=`; erros por `authFormError(errorCodeOf(erro))`/`passkeyErrorCode`. O formulário vem primeiro porque o
  autofill de passkey vive no campo de e-mail. O rodapé tem dois parágrafos, nesta ordem: "O acesso é só por convite." e (Fase 6) "Esqueceu a senha? Peça ao administrador um link para criar outra." (nunca "Esqueci a senha": não há e-mail, o link vem do admin).
- **Usa:** `Card*`, `Field*`, `Input`, `Button`, `SocialButtons`, `PrivacyLink`.
- **Histórico:** 2026-11-20 — criado na Fase 1. 2026-11-26 — Fase 6 (Tarefa 5): aviso de senha esquecida no rodapé. 2026-11-26 — Fase 6 (Tarefa 8): o rodapé termina com o `PrivacyLink` (`Privacidade e seus dados`), depois de `O acesso é só por convite.` e de `Esqueceu a senha? Peça ao administrador um link para criar outra.`. 2026-11-26 — revisão final da Fase 6: o `Usa:` passa a citar o `PrivacyLink`.

### ResetPasswordForm
- **Status:** ✅ pronto (2026-11-26)
- **Local:** `src/components/auth/ResetPasswordForm.tsx` (página estática `src/app/(auth)/redefinir-senha/page.tsx`)
- **Propósito:** a pessoa criar a senha nova com o link que o administrador mandou.
- **Como funciona:** `"use client"`; `takeTokenFromLocation(location, history)` lê o token do **fragmento** (`#token=`, 16 a 256 caracteres `A-Za-z0-9_-`) e apaga o fragmento da barra com `history.replaceState`; o fragmento nunca chega ao servidor (fora do log e do `Referer`). Fases: lendo (cartão vazio com `aria-busy`), sem token ("Link incompleto" e o link-botão "Ir para a entrada"), formulário ("Criar uma senha nova", campo "Senha nova", `type="password"`, `autoComplete="new-password"`, 8 a 128, botão "Trocar a senha") e feito ("Senha alterada" e o link-botão "Entrar"; não entra sozinho, as sessões foram revogadas). Chama `authClient.resetPassword({ newPassword, token })`; o erro vira `authErrorMessage(errorCodeOf(error))` e a exceção de rede a mensagem genérica. Em StrictMode o segundo efeito não acha o fragmento e não zera o token.
- **Usa:** `Card*`, `Field*`, `Input`, `Button`, `buttonVariants`, `authClient`, `authErrorMessage`, `errorCodeOf`.
- **Histórico:** 2026-11-26 — criado na Fase 6 (Tarefa 5). 2026-11-26 — revisão final da Fase 6: a lista de `Usa:` passa a citar `errorCodeOf` (o componente já o usava).

### PasskeyOffer
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/auth/PasskeyOffer.tsx`
- **Propósito:** oferta de passkey em `/bem-vindo`.
- **Como funciona:** `"use client"`; "Criar passkey" (toast "Passkey criada." e vai para `/`);
  "Agora não" é `<Link className={buttonVariants()}>` (role link); erros por
  `passkeyErrorCode(…, "register")` + `authFormError`.
- **Usa:** `Card*`, `Button`, `buttonVariants`, `FieldError`, `sonner`.
- **Histórico:** 2026-11-20 — criado na Fase 1. 2026-11-26 — Fase 6 (Tarefa 8): a descrição diz que a passkey é a forma mais rápida de entrar e que a recuperação é pelo administrador (`A passkey é a forma mais rápida de entrar: você usa a digital, o rosto ou o PIN do aparelho, sem digitar senha. Se esquecer a senha, peça ao administrador um link para criar outra.`); botões e comportamento iguais.

### PrivacyLink
- **Status:** ✅ pronto (2026-11-26)
- **Local:** `src/components/privacy/PrivacyLink.tsx`
- **Propósito:** o link `Privacidade e seus dados` para a página pública `/privacidade`.
- **Como funciona:** Server Component (sem estado); `<Link href="/privacidade">` com `className` opcional (`cn`). Fica sozinho numa linha, então usa o padrão do link solto (`max-md:inline-flex max-md:min-h-11 max-md:items-center`, ui-rules §1.4). Aparece em três lugares: o rodapé do `SignInPanel` (`/entrar`), o `CardFooter` do convite válido (`/convite/[token]`) e `/conta` (depois de "Sair"). Não aparece no convite inválido nem dentro do shell (`/privacidade` é pública e tem o próprio controle `Voltar`, o `BackLink`).
- **Usa:** `next/link`, `cn`.
- **Histórico:** 2026-11-26 — criado na Fase 6 (Tarefa 8). 2026-11-26 — revisão final da Fase 6: o `Usa:` do `SignInPanel` passa a citá-lo; o controle de volta da página é o `BackLink`.

### BackLink
- **Status:** ✅ pronto (2026-11-26)
- **Local:** `src/components/privacy/BackLink.tsx`
- **Propósito:** o controle `Voltar` no fim da página pública `/privacidade`; leva a pessoa para onde ela estava (o convite, `/entrar`, `/conta`), sem perder o convite aberto.
- **Como funciona:** `"use client"`; um `<Link href="/entrar">` sempre presente (funciona sem JavaScript e é o destino de quem abriu a página direto, sem histórico). No clique simples, se `window.history.length > 1`, cancela o link e chama `router.back()`; clique com Ctrl/Cmd/Shift/Alt ou outro botão segue o link (abrir em outra aba), como no `next/link`. Padrão do link solto (`max-md:inline-flex max-md:min-h-11 max-md:min-w-11 max-md:items-center`, ui-rules §1.4; o texto é curto, então também tem largura mínima); só tokens, claro e escuro. A página continua estática (`○ /privacidade`).
- **Usa:** `next/link`, `useRouter` (`next/navigation`).
- **Histórico:** 2026-11-26 — criado na revisão final da Fase 6; substitui o link `Voltar para a entrada`, que levava quem veio do convite para `/entrar` (que não cria conta). 2026-11-26 — re-revisão da Fase 6: o clique com modificador não é mais interceptado.

### PasskeyManager
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/auth/PasskeyManager.tsx`
- **Propósito:** lista, cria e remove passkeys em `/conta`.
- **Como funciona:** `"use client"`; `authClient.useListPasskeys()` (atualiza sozinho pelo sinal
  do plugin); estados carregando/vazio/erro com "Tentar de novo"; remover = botão de ícone com
  `aria-label` + Tooltip "Remover passkey"; ações travadas enquanto pendentes; toasts.
- **Usa:** `Button`, `Tooltip*`, `Skeleton`, `FieldError`, `sonner`.
- **Histórico:** 2026-11-20 — criado na Fase 1.

### SignOutButton
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/auth/SignOutButton.tsx`
- **Propósito:** botão "Sair".
- **Como funciona:** `"use client"`; `authClient.signOut()` → `/entrar` + `router.refresh()`; erro
  mostra o fallback.
- **Usa:** `Button`, `FieldError`.
- **Histórico:** 2026-11-20 — criado na Fase 1.

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
- **Como funciona:** `<Badge variant="neutral">Inativo</Badge>` (fundo `accent`, visível sobre o card); sempre texto, nunca só cor.
- **Usa:** `Badge` (variante `neutral`), token `accent`.
- **Histórico:** 2026-11-21 — criado na Fase 2. 2026-11-27 — Task 15 (legibilidade): variante `neutral` (era `secondary`, igual ao card na paleta nova: a pílula sumia na linha).

### Pagination
- **Status:** ✏️ estendido (2026-11-24)
- **Local:** `src/components/admin/Pagination.tsx` (server-safe)
- **Propósito:** paginação das listas (toda lista é paginada).
- **Como funciona:** `<nav aria-label={label}>` (`label` opcional, padrão "Paginação"; a Equipe usa "Paginação dos convites pendentes" e "Paginação das pessoas" para as duas listas terem nomes distintos) com "Anterior", "Página {n} de {m}" (`tabular-nums`) e "Próxima"; `param` (padrão `pagina`; `convites` na Equipe) e `params` preservam os demais parâmetros da URL via `buildPageHref`; página 1 remove o parâmetro. Na borda o lado sem destino é um `<Button type="button" variant="outline" disabled>` (botão desativado, nem link nem texto solto). Com `pageCount <= 1` renderiza `null`.
- **Usa:** `Button`, `buttonVariants`, `buildPageHref`, `next/link`.
- **Histórico:** 2026-11-21 — criado na Fase 2. 2026-11-24 — Fase 4 (Tarefa 3, P29): prop `label` e desativado como `<Button disabled>`.

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
- **Histórico:** 2026-11-21 — criado na Fase 2. 2026-11-27 — Task 15 (legibilidade): a opção escolhida volta a aparecer (Toggle marcado em `primary`); teste novo.

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
- **Histórico:** 2026-11-21 — criado na Fase 2. Exceção documentada a "nunca em branco" (F2-9): o nome é a identidade do registro. 2026-11-27 — `children` opcional, renderizado entre o campo e o botão (a escolha de cor do setor); destinos não usam.

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

### SectorsAdmin
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/sectors/SectorsAdmin.tsx`
- **Propósito:** conteúdo de `/admin/setores` (Server Component async).
- **Como funciona:** `await requireAdmin()` primeiro (operador cai no `notFound()`), lê `?pagina=` e `listSectors` (contagens de pessoas ativas e convites pendentes por subconsulta no SQL), monta `AdminPageHeader` + cartão "Novo setor" + lista de `AdminListRow` (detalhe `{n} pessoas ativas · {m} convites pendentes`, selo "Inativo") + `Pagination`; vazio vira `EmptyState`. A página (`page.tsx`) só embrulha em `<Suspense>` com esqueleto, sem `metadata`.
- **Usa:** `AdminPageHeader`, `AdminListRow`, `EmptyState`, `Pagination`, `Card*`, `pluralize`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 6). 2026-11-27 — lê também `suggestColorForNewSector` (em paralelo com `listSectors`, depois do portão) e passa `suggestedColor` ao `SectorCreateForm` (visual novo, Task 6).

### SectorCreateForm
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/sectors/SectorCreateForm.tsx`
- **Propósito:** criar setor ("Criar setor").
- **Como funciona:** `"use client"`; `NameForm` (entity "setor", nome começa vazio por ser a identidade do registro) + `SectorColorChoice` com a cor sugerida pelo servidor (`suggestedColor`, de `suggestColorForNewSector`) marcada → `createSectorAction({ name, color })`; toast "Setor criado."; erro de nome repetido inline (com o aviso "Ele está inativo: reative-o na lista." quando for o caso). A cor é derivada a cada renderização: a escolha da pessoa (`chosen`) ou, se ela não tocou, a sugestão **atual** do servidor; uma sugestão nova (tela revalidada) só muda a marcada enquanto a pessoa não escolheu. Depois de criar, `onDone` limpa a escolha e soma o `resets` (a `key` `{sugestão}-{resets}` remonta o grupo): a marcada volta à sugestão atual, chegue a tela revalidada antes ou depois do fim do envio (o `onDone` é o da renderização em que o envio começou, então nunca copia a sugestão). Se o servidor recusar, nome e cor escolhidos ficam.
- **Usa:** `NameForm`, `SectorColorChoice`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 6). 2026-11-27 — ganha a escolha de cor e a prop `suggestedColor` (visual novo, Task 6). 2026-11-27 — Revisão final (F6): a cor escolhida não volta à sugestão quando a página revalida (`touched`); o `onDone` volta a acompanhar a sugestão. 2026-11-27 — Segunda rodada (G9): a cor passa a ser derivada (`chosen ?? suggestedColor`), sem cópia da sugestão em estado; com a tela revalidada chegando antes do `onDone`, a sugestão velha voltava e nunca mais sincronizava.

### SectorRowActions
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/sectors/SectorRowActions.tsx`
- **Propósito:** ações da linha de um setor: "Editar" e "Desativar"/"Reativar".
- **Como funciona:** `"use client"`; `EditDialog` "Editar setor" com `NameForm` ("Salvar alterações", toast "Alterações salvas.", fecha ao salvar) e a `SectorColorChoice` já na cor atual do setor, e `ActiveToggleButton` → `setSectorActiveAction`. O formulário de edição (`SectorEditForm`, interno) monta quando o diálogo abre, então fechar sem salvar descarta a cor trocada. `renameSectorAction({ id, name, color })`. Desativar setor com pessoas ativas ou convites pendentes volta `SECTOR_IN_USE` e a mensagem com as contagens aparece em toast.
- **Usa:** `EditDialog`, `NameForm`, `SectorColorChoice`, `ActiveToggleButton`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 6). 2026-11-27 — a edição ganha a escolha de cor (visual novo, Task 6).

### SectorColorChoice
- **Status:** ✅ pronto (2026-11-27)
- **Local:** `src/components/admin/sectors/SectorColorChoice.tsx` (client)
- **Propósito:** escolher a cor do setor entre as cinco da paleta (Lilás, Pêssego, Azul, Verde, Rosa), na criação e na edição do setor.
- **Como funciona:** `<fieldset>` com `<legend>` "Cor" + `RadioGroup`/`Radio.Root` do Base UI (`@base-ui/react/radio-group`, `@base-ui/react/radio`; `role="radiogroup"` nomeado pela legenda, `role="radio"` por opção). Cada opção é uma pílula (`group/color`, `h-9`, `max-md:h-11`, borda `border-input`, hover `bg-accent`) com a amostra de 16px (`size-4 rounded-full`, borda `border-foreground/20`, classe `SECTOR_COLOR_BG[cor]`, `aria-hidden`) **e o nome escrito**: a cor nunca é a única pista (`ui-rules.md §2.1`). A marcada ganha `data-checked` e vira pílula `primary` (`border-primary bg-primary text-primary-foreground`, hover também `bg-primary`), como o `Toggle`; a amostra dela troca a borda para `primary-foreground` (`group-data-checked/color:`), que contrasta com a pílula nos dois temas (15,26:1 claro, 14,99:1 escuro; no escuro a pílula é creme e a borda `foreground/20` sumia, com a amostra pastel a 1,46–1,92:1). O par é medido no `themeContrast.test.ts` (≥3:1). Props: `defaultValue: SectorColor` (sempre há uma marcada), `onValueChange?(cor)`, `name` (padrão `"color"`), `legend` (padrão "Cor"), `disabled`. Clicar na marcada não a desmarca. Não é controlado: quem usa guarda a escolha em `onValueChange` e remonta pela `key` para voltar ao padrão (o `SectorCreateForm` faz isso depois de criar). Por que não o `ChoiceGroup`: ele é um `ToggleGroup` com rótulo `string`, sem lugar para a amostra, e botões `aria-pressed` não são um `radiogroup`.
- **Usa:** `FieldSet`, `FieldLegend`, `RadioGroup`, `Radio`, `SECTOR_COLORS`, `SECTOR_COLOR_LABELS`, `SECTOR_COLOR_BG`, tokens `bg-sector-*`.
- **Histórico:** 2026-11-27 — criado no visual novo (Task 6). 2026-11-27 — Revisão final (F7): a marcada passa de `border-foreground bg-muted` (muted = card na paleta nova; só a borda de 1px separava) para pílula `primary`; hover `accent`. 2026-11-27 — Segunda rodada (G3): a amostra da marcada ganha borda `primary-foreground` (`group/color` na pílula).

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

### TeamAdmin
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/team/TeamAdmin.tsx` (+ `roleOptions.ts`: `ROLE_LABELS`, `ROLE_OPTIONS`)
- **Propósito:** conteúdo de `/admin/equipe`: convidar, acompanhar convites pendentes e gerir as pessoas do sistema.
- **Como funciona:** Server Component async; chama `requireAdmin()` e lê `listPeople` (`?pagina=`), `listPendingInvites` (`?convites=`) e `listActiveSectors`. Ordem na tela: `InviteForm`, "Convites pendentes" (só válidos, com `PendingInviteActions`) e "Pessoas". A própria conta mostra o selo "Você", o texto de ajuda e **só** o `PasswordResetLinkButton` ("Nova senha": é a única ação que vale para si mesmo e dá ao admin sem e-mail um caminho de recuperação); pessoa inativa fica esmaecida (`InactiveBadge`) com "Reativar"; setor inativo aparece como "(inativo)"; duas `Pagination` independentes (cada uma preserva o parâmetro da outra); estados vazios.
- **Usa:** `AdminPageHeader`, `AdminListRow`, `EmptyState`, `Pagination`, `Badge`, `InviteForm`, `PendingInviteActions`, `PersonRowActions`, `PasswordResetLinkButton`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 9, só Pessoas); Tarefa 10 acrescenta convites. 2026-11-26 — Fase 6 (Tarefa 5): a linha da própria conta ganha o botão "Nova senha" (antes ficava sem botões).

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
- **Propósito:** ações de uma linha de pessoa: editar, gerar link de nova senha, desativar (com confirmação) e reativar.
- **Como funciona:** `"use client"`; `EditDialog` "Editar pessoa" com `PersonForm`; "Desativar" abre `ConfirmDialog` (texto: perde o acesso agora, sessões encerradas, histórico continua) e mostra a recusa do servidor dentro do diálogo; "Reativar" age direto e leva o erro para o toast. `aria-label` com o nome da pessoa em todos os botões. Fase 6: pessoa **ativa** ganha o `PasswordResetLinkButton` entre "Editar" e "Desativar" (a inativa não: o domínio recusaria).
- **Usa:** `EditDialog`, `ConfirmDialog`, `PersonForm`, `PasswordResetLinkButton`, `useAdminAction`, `Button`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 9). 2026-11-26 — Fase 6 (Tarefa 5): botão "Nova senha".

### PasswordResetLinkButton
- **Status:** ✅ pronto (2026-11-26)
- **Local:** `src/components/admin/team/PasswordResetLinkButton.tsx`
- **Propósito:** o admin gerar o link de nova senha de uma pessoa (sem e-mail, D-F6-2) e mandá-lo como o convite, por cópia ou WhatsApp.
- **Como funciona:** `"use client"`; botão "Nova senha" (`variant="outline"`, `size="sm"`, `aria-label` `Gerar link de nova senha para {nome}`, desabilitado enquanto a action roda). Um clique chama `createPasswordResetLinkAction({ userId })` por `useAdminAction` (o erro vira toast, nenhum diálogo abre). No sucesso abre um `Dialog` "Link de nova senha" (descrição = o nome) com o campo somente leitura `Link para copiar` (seleciona ao focar), o texto "Válido até {data e hora}, uma vez só…", "Copiar link" e "Compartilhar" (só com `navigator.share`, pelo `useShareLink`). Fechar o diálogo descarta o link: ele aparece uma vez só e gerar outro derruba o anterior.
- **Usa:** `useAdminAction`, `useShareLink`, `Dialog*`, `Input`, `Button`, `formatDateTimeBR`.
- **Histórico:** 2026-11-26 — criado na Fase 6 (Tarefa 5).

### InviteForm
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/team/InviteForm.tsx`
- **Propósito:** gerar convite de entrada (operador ou administrador) em `/admin/equipe`.
- **Como funciona:** `"use client"`; cartão com o título "Convidar pessoa" (`h2`); formulário controlado e nunca em branco (papel Operador, setor = primeiro ativo, nome de referência opcional); `ChoiceGroup` "Papel", `SelectField` "Setor" só para Operador; valida com `createInviteSchema`; erro de campo no campo, o resto no pé; sem setor ativo e papel Operador mostra o aviso e o link "Ir para Setores" no lugar do botão; no sucesso troca o formulário por `InviteLinkCard`; "Gerar outro convite" limpa só o nome (mantém papel e setor) e devolve o foco ao campo "Nome de referência (opcional)".
- **Usa:** `Card`, `Field*`, `Input`, `ChoiceGroup`, `SelectField`, `InviteLinkCard`, `useAdminAction`, `buttonVariants`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 10). 2026-11-24 — Fase 4 (Tarefa 3, P29): título em `h2` e foco devolvido ao campo depois de "Gerar outro convite".

### InviteLinkCard
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/team/InviteLinkCard.tsx`
- **Propósito:** mostrar o link do convite **uma vez** (só o hash fica no banco) para copiar ou compartilhar.
- **Como funciona:** `"use client"`; campo somente leitura "Link do convite" (seleciona ao focar); "Copiar link" usa `navigator.clipboard` e avisa por toast (falha ou contexto sem clipboard = toast com instrução de copiar à mão); "Compartilhar" só aparece se `navigator.share` existir (detectado depois de montar, sem divergir do HTML do servidor), `AbortError` é silencioso e qualquer outra falha cai em copiar; mostra a validade em horário de Brasília e o aviso de que o link não volta; "Gerar outro convite" chama `onReset`; ao montar, o foco vai ao título "Convite gerado" (`h3`, `tabIndex={-1}`).
- **Usa:** `Button`, `Input`, `useShareLink`, `formatDateTimeBR`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 10). 2026-11-24 — Fase 4 (Tarefa 3, P29): foco no título ao montar. 2026-11-26 — Fase 6 (Tarefa 5): copiar e compartilhar passaram para o `useShareLink` (refatoração, o comportamento e o teste não mudaram).

### useShareLink
- **Status:** ✅ pronto (2026-11-26)
- **Local:** `src/components/admin/team/useShareLink.ts`
- **Propósito:** copiar e compartilhar um link que aparece uma vez só (convite e, a partir da Tarefa 5 da Fase 6, nova senha), sem repetir a lógica em cada cartão.
- **Como funciona:** `"use client"`; `useShareLink({ url, shareTitle, shareText })` devolve `{ canShare, copy, share }`. `canShare` é falso no servidor e antes de montar e só vira `true` num `useEffect` quando `navigator.share` existe (o HTML do servidor não diverge do cliente). `copy` usa `navigator.clipboard.writeText` e avisa por toast (`Link copiado.`; falha ou contexto sem clipboard = `Não foi possível copiar. Selecione o link e copie.`). `share` chama `navigator.share({ title, text, url })`; `AbortError` (fechar a folha) é silencioso e qualquer outra falha cai em `copy`.
- **Usa:** `sonner`.
- **Histórico:** 2026-11-26 — extraído do `InviteLinkCard` na Fase 6 (Tarefa 5, commit de refatoração).

### PendingInviteActions
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/team/PendingInviteActions.tsx`
- **Propósito:** cancelar um convite pendente na lista da Equipe.
- **Como funciona:** `"use client"`; botão "Cancelar convite" (`aria-label` `Cancelar convite {nome ou "sem nome"}`) abre `ConfirmDialog` ("O link deixa de funcionar. Não dá para desfazer."); sucesso = toast "Convite cancelado." e diálogo fechado; recusa (convite que já não está pendente) aparece no diálogo, que fica aberto.
- **Usa:** `ConfirmDialog`, `useAdminAction`, `Button`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 10).

### Passagem de turno — `src/components/passagens/*` (Fase 3)

Componentes da passagem. Regras comuns: só tokens de cor, tema claro e escuro, situação sempre com
ícone e texto, alvo de toque ≥ 44px no celular. Quem escolhe o setor é o admin (`SectorPicker`);
o operador usa o próprio setor e nunca vê o seletor.

### SectorPicker
- **Status:** ✏️ estendido (2026-11-27)
- **Local:** `src/components/passagens/SectorPicker.tsx`
- **Propósito:** o admin escolher o setor no Início, na Nova passagem, no Histórico, em Solicitações e no Dashboard (D-F3-3, C-V8: um seletor só).
- **Como funciona:** `"use client"`; seletor deslizante (segmented control). `RadioGroup` e `Radio.Root` do Base UI: `role="radiogroup"` com `aria-label="Setor"` e um `role="radio"` (`aria-checked`, `aria-label` = nome) por setor ativo; com `allowAll`, o último é "Todos os setores" (`todos`, sem bolinha; texto visível "Todos", `aria-label` "Todos os setores"). As setas do teclado trocam de setor (radio nativo), Tab entra no marcado. Trilho `h-12 p-1 rounded-full bg-seg`, largura `min(100%, max(30rem, N*6.5rem + 0.5rem))` (480px com 4 opções; cresce com mais; rola em `overflow-x-auto` só quando nem o espaço da tela comporta); até 4 opções os segmentos dividem o trilho (`flex-1 min-w-0`; no celular cabem nos 100%, como no protótipo), com mais de 4 cada segmento tem `min-w-[6.5rem]` e o trilho rola; padding de 6px (`px-1.5`, o do botão do protótipo), altura de linha `normal`; bolinha de 8px na cor do setor (`SECTOR_COLOR_BG[color]`), nome em Satoshi 15px (`truncate`; 700 no marcado com `text-thumb-foreground`, 500 nos outros). O thumb (`bg-thumb`, `shadow-thumb`: a sombra única do app, token da Task 1) fica em `left: calc(i * 100% / N)` por variáveis CSS (`--i`, `--n`) e desliza em `.4s cubic-bezier(.3,1.25,.4,1)`; `motion-reduce:transition-none` tira o deslize. Clicar chama `chooseSectorAction({ sectorId, path })` dentro de `useTransition`, que grava o cookie `closery_setor` e faz `redirect` para `{path}?setor={id}`; com a prop `query` (o query canônico dos filtros da tela, sem o setor) o payload é `{ sectorId, path, query }` e o servidor o reinterpreta pelo parse da tela (P45); o redirect chega como exceção e segue adiante (`unstable_rethrow`). `useOptimistic` leva o thumb ao setor novo na hora e o devolve se a action falhar. Falha da action ou exceção de rede = `toast.error`. Durante o `pending` o grupo fica `disabled` (`aria-disabled`, sem clique) e os segmentos em `opacity-60`. Clicar no setor já selecionado não faz nada. Selecionado fora da lista: nenhum marcado e thumb oculto. Alvo de toque: o segmento tem 40px acima de 860px e `max-md:h-11` (44px, centrado sobre o padding do trilho) abaixo, para o guarda `e2e/touch-targets.spec.ts`. Com mais de 4 opções e o trilho transbordando, um efeito centraliza a opção marcada rolando **só o `radiogroup`** (`group.scrollTo({ left, behavior })`, `left` com piso 0; `auto` com `prefers-reduced-motion`, senão `smooth`), ao montar e a cada troca; a janela nunca rola e sem a API (`scrollTo` ausente) nada acontece. O rótulo (que trunca) tem `title` com o nome inteiro. O `SectorSwitcher` (links) das telas Turnos e Itens continua separado.
- **Usa:** `RadioGroup`, `Radio` (`@base-ui/react`), `SECTOR_COLOR_BG`, tokens `seg`, `thumb`, `thumb-foreground`, `shadow-thumb`, `ring`, `chooseSectorAction`, `sonner`. Recebe `SectorChoice` (agora com `color`).
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 7). 2026-11-25 — Fase 5 (Tarefa 3, P45): prop opcional `query`; sem ela o payload continua exatamente `{ sectorId, path }`. 2026-11-27 — visual novo (Task 7): vira o seletor deslizante em todas as telas (era `fieldset` com um `Button` por setor e `aria-pressed`); semântica `radiogroup`/`radio`; a bolinha usa a `color` que `listActiveSectors` passou a levar na Task 5; sem mudança na lógica nem na assinatura. 2026-11-27 — Task 16 (pixel): a largura mínima de 6.5rem só com mais de 4 opções (com 4, no celular de 390px o trilho rolava e cortava "Carga"); padding do segmento 12 → 6px e `leading-[normal]` (rótulo 0,8px acima do protótipo). 2026-11-27 — "Todos" no seletor: com `allowAll` o texto visível da última opção é "Todos" (com 5 opções cada segmento tem 104px e "Todos os setores" truncava), e o `aria-label` segue "Todos os setores" (contém o texto visível, WCAG 2.5.3). Com o trilho rolando (mais de 4 opções) um `useEffect` rola só o `radiogroup` (`scrollTo({ left })`, centralizando o radio marcado, só quando `scrollWidth > clientWidth`; `behavior: "auto"` com `prefers-reduced-motion`, senão `smooth`) ao montar e a cada troca; antes usava `scrollIntoView`, que também rolava a janela na vertical. O nome truncado tem `title` com o nome inteiro; o contêiner interno ganhou `shrink-0` para o primeiro segmento começar inteiro em `scrollLeft` 0. 2026-11-27 — Revisão final (F2, F11): o `scrollIntoView` (que também rolava a janela e não existe no jsdom) virou o `scrollTo` só no grupo, com guarda de API e de transbordo; `title` no rótulo, inclusive "Todos" → "Todos os setores". 2026-11-27 — Segunda rodada (G4): testes da rolagem com espiões na janela, o `left` calculado afirmado e o caso de menos movimento separado da chamada do Base UI.

### HandoverStatusBadge
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HandoverStatusBadge.tsx`
- **Propósito:** mostrar a situação da passagem (aguardando, confirmada, não confirmada, sem passagem) e o selo "Corrigida".
- **Como funciona:** Server-safe. `Badge` com ícone e texto: `awaiting` (`Clock`, `bg-info`), `confirmed` (`CircleCheck`, `bg-success`; com `confirmedByName` diz "Confirmada por {nome}"), `unconfirmed` (`TriangleAlert`, `bg-warning`), `missing` (`CircleSlash`, `bg-accent`). `corrected` acrescenta `Badge variant="outline"` com `PencilLine` e "Corrigida". Textos vêm de `situationLabel` e `CORRECTED_LABEL`.
- **Usa:** `Badge`, tokens `info`, `success`, `warning`, `accent`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 7). 2026-11-25 — Fase 5 (Tarefa 11): exporta `SITUATION_STYLE` (ícone e classe de cada situação), que o anel do dashboard reusa para o ícone das fatias; nada mais muda. 2026-11-27 — Task 15 (legibilidade): "Sem passagem" com `bg-accent` (era `bg-muted`, igual ao card na paleta nova: a pílula sumia na linha do histórico); teste novo recusa fundo igual ao do card.

### PendingHandoverCard
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/PendingHandoverCard.tsx`
- **Propósito:** cartão do topo do Início "Passagem para confirmar".
- **Como funciona:** Server-safe, só desenha (recebe `avatarSrc` pronto). `Card feature` amarelo (`--highlight`, tinta `--on-pastel`), em grid de uma coluna que vira duas (`minmax(0,1fr) minmax(0,1.2fr)`) só com área útil de 1040px ou mais. Coluna da esquerda: título "Passagem para confirmar", `{turno} · {dd/mm/aaaa}`, o avatar de quem entregou com "Entregue às {HH:mm} por {nome}" e o botão `on-pastel` "Ver passagem" (`/passagens/{id}`) no fim. Coluna da direita: o bloco "Fica para o próximo turno" (trecho do texto ou "Nada registrado para o próximo turno."). Não confirma aqui: a confirmação é no resumo.
- **Usa:** `Card` (`feature`), `buttonVariants` (`on-pastel`, `pill`), `UserAvatar`, `formatDateBR`, `formatTimeBR`, `handoverHref`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 7). 2026-11-27 — visual novo (Tarefa 11): prop nova `avatarSrc` (data URI de quem entregou, gerado por quem chama: o cartão só desenha); `Card feature` em `--highlight` com tinta `--on-pastel`, grid `minmax(0,1fr) minmax(0,1.2fr)` só com área útil ≥ 1040px, avatar de 36px (inclinado 3°) de quem entregou, bloco `--on-pastel-soft` "Fica para o próximo turno" e botão `on-pastel` "Ver passagem" com `ArrowRight` no fim da coluna; sem mudança de regra. 2026-11-27 — Task 16 (pixel): "{turno} · {data}" e "Entregue às…" com `leading-[normal]` (a linha de 27,1px empurrava o botão e o fim do cartão 1px para baixo).

### SectorPill
- **Status:** ✅ pronto (2026-11-27)
- **Local:** `src/components/passagens/SectorPill.tsx`
- **Propósito:** o setor do operador no hero do Início, só para leitura (o admin troca pelo `SectorPicker`).
- **Como funciona:** Server-safe. Pílula de 48px em `bg-card`: bolinha de 10px na cor do setor (`SECTOR_COLOR_BG`, `aria-hidden`), "Setor" em mono 12px `text-muted-foreground` e o nome em Satoshi 700/16px com reticências. Não é botão nem link.
- **Usa:** `SECTOR_COLOR_BG`.
- **Histórico:** 2026-11-27 — criado no visual novo do Início (Tarefa 11).

### MyShiftCard
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/MyShiftCard.tsx`
- **Propósito:** cartão "Passagem do meu turno" do Início, nos cinco estados.
- **Como funciona:** Server-safe. `Card variant="feature"` na cor do setor (`SECTOR_COLOR_BG[sectorColor]`; crossfade de .45 s, desligado com `prefers-reduced-motion`) e tinta `text-on-pastel`. Topo: `<h2>` "Passagem do meu turno" e o chip do setor (`sectorName`, Geist Mono 12 px, reticências se longo). Corpo: nome do turno (Satoshi 700, 20 px), horário `{início}–{fim}` (Satoshi 900, `tabular-nums`, 64 px; 52 px em 2 colunas com área útil < 1240 px e 44 px no celular, por container query de `@container/main`) e a data em mono. `start`/`continue`: `ShiftProgressBar` e "Turno sugerido pelo horário de agora.". `start` → "Começar passagem"; `continue` → pílula `bg-on-pastel-soft` com `UserAvatar` de 34 px (`avatarSrc`, de quem salvou) e "Rascunho salvo às … por …" + "Continuar passagem"; `delivered` → bloco de largura inteira "Aguardando recebimento" (`<p>` `self-stretch`, raio 22 px, padding 18/22 px, Satoshi 700/16 px, `Clock` de 18 px `aria-hidden`, `bg-on-pastel/10` e `text-on-pastel`) e, 12 px abaixo, a linha de entrega (`flex items-center gap-2.5`: `AvatarStack` de 36 px com quem entregou a +3°, de `deliveredAvatarSrc`, e "Entregue às … Aguardando recebimento." em 15 px/1,5, numa string só, um nó de texto como no protótipo) + "Ver passagem"; `confirmed` → o mesmo bloco em verde, "Confirmada" com `CircleCheck` (`bg-on-pastel-success-soft` e `text-on-pastel-success`), e a linha com a pilha (quem entregou a +3°, por cima; quem confirmou a −4°, de `confirmedAvatarSrc`, 8 px sobreposto) e "Entregue por … Confirmada por …" + "Ver passagem"; sem avatar, a frase aparece sozinha; `no-shifts` → "Nenhum turno neste setor." (Satoshi 900, 32 px) e, só para o admin, "Ir para Turnos". Rodapé (`mt-auto`): o primário (`on-pastel`, `pill`, 22px de padding, com `ArrowRight`) e o secundário "Ver todas as passagens" (`on-pastel-secondary`, `pill` com `px-5` pelo `cn`: 20px, como no protótipo), em todos os estados. Admin leva `&setor=` no link de começar.
- **Usa:** `Card`, `buttonVariants`, `UserAvatar`, `AvatarStack`, `ShiftProgressBar`, `SECTOR_COLOR_BG`, `newHandoverHref`, `handoverHref`; tokens `on-pastel`, `on-pastel-success`, `on-pastel-success-soft`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 7). 2026-11-27 — visual novo do Início (Task 12): cor do setor, chip, horário grande, barra do turno, avatar do rascunho, selos pastel e rodapé com secundário; props novas `sectorName`, `sectorColor` e `avatarSrc`; o `no-shifts` passou a ter o link "Ver todas as passagens". 2026-11-27 — Task 16 (pixel): título, nome do turno, data, "Turno sugerido…", texto do rascunho e do sem-turnos com `leading-[normal]` (a barra descia 4px); selos de estado com `leading-[normal]` depois do `text-[13px]` (o twMerge do Badge descarta o `leading` que vem antes). 2026-11-27 — Pack de correção do Início (Task 18, spec §6.4.1): `delivered` e `confirmed` trocam o selo pastel por um bloco de largura inteira (neutro `on-pastel/10` e verde `on-pastel-success*`) e ganham avatar na linha de entrega (pilha de dois no `confirmed`); props novas `deliveredAvatarSrc` e `confirmedAvatarSrc`. 2026-11-27 — Pixel do pack de correção: a frase da linha de entrega (`delivered` e `confirmed`) vai montada numa string só; partida em vários nós de texto (com os comentários do SSR entre eles), o Chromium posicionava alguns glifos diferente do protótipo (cartão de 0,004–0,019% para 0,000–0,002%). 2026-11-27 — Segunda rodada (G10): `STATUS_TONE` exportado para o `themeContrast.test.ts` ler o alfa do bloco "Aguardando recebimento" e os tokens do "Confirmada" do próprio componente (uma fonte só); testes do traço 2.2 dos ícones dos blocos, da pilha só com quem confirmou e do avatar com "outra pessoa".

### ShiftProgressBar
- **Status:** ✅ pronto (2026-11-27)
- **Local:** `src/components/passagens/ShiftProgressBar.tsx` (server-safe)
- **Propósito:** barra de quanto do turno já passou, nos estados `start` e `continue` do `MyShiftCard`.
- **Como funciona:** recebe o `ShiftProgress` já calculado no servidor (`shiftProgress`). Trilho de 10 px (`bg-on-pastel-track`) com o preenchimento `bg-on-pastel` na largura `pct` (presa entre 0 e 100; `NaN` vira 0); abaixo, em Geist Mono 12 px com `tabular-nums`: início · "agora HH:MM" · fim. O trilho é uma `progressbar` (`aria-label` "Progresso do turno", `aria-valuenow` arredondado e `aria-valuetext`).
- **Usa:** tokens `on-pastel`, `on-pastel-track`, `on-pastel-muted`; tipo `ShiftProgress`.
- **Histórico:** 2026-11-27 — criado no visual novo do Início (Task 12).

### HomeCards
- **Status:** ✅ pronto (2026-11-27)
- **Local:** `src/components/passagens/HomeCards.tsx` (server-safe)
- **Propósito:** os cartões do Início depois do hero, numa peça só (o `HomeHandovers` lê os dados; este desenha).
- **Como funciona:** coluna com gap 16: `InviteTeamCard` (se `inviteCounts` não for nulo), `PendingHandoverCard` (se houver) e uma linha em grid com `MyShiftCard` e `RequestsHomeCard`. A linha é `grid-cols-[minmax(0,1fr)]` e vira `minmax(0,1.3fr) minmax(0,1fr)` com `@min-[1040px]/main:` (área útil do `@container/main`, não a janela). Gera no servidor os avatares (`avatarDataUri`): quem entregou a passagem pendente (`pending.deliveredById`), quem salvou o rascunho (`saved.byId`), quem entregou e quem confirmou a passagem do meu turno (`mine.deliveredById`, `mine.confirmedById`; id vazio ou nulo não vira avatar) e quem está logado (`actorId`: convite e solicitações vazias). Admin leva `?setor=` nos links.
- **Usa:** `InviteTeamCard`, `PendingHandoverCard`, `MyShiftCard`, `RequestsHomeCard`, `avatarDataUri`, `requestsHref`.
- **Histórico:** 2026-11-27 — criado no visual novo do Início (Task 14). 2026-11-27 — Pack de correção (Task 18): avatares de quem entregou e de quem confirmou para o `MyShiftCard` (`deliveredAvatarSrc`, `confirmedAvatarSrc`).

### HomeHandovers
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HomeHandovers.tsx`
- **Propósito:** os cartões de passagem do Início.
- **Como funciona:** Server Component assíncrono, dentro de `<Suspense>` (lê sessão, `searchParams` e o cookie). Operador: setor próprio. Admin: `resolveScreenSector` (URL → cookie → primeiro ativo) e `SectorPicker` (sem `allowAll`: no Início não há "Todos"); sem setor ativo, estado vazio com link para Setores. Setor inativo do operador: "Seu setor está inativo.". Ordem (no `HomeCards`): `InviteTeamCard` (admin sozinho, sem convites e sem o cookie de dispensa), `PendingHandoverCard` (se houver) e, lado a lado, `MyShiftCard` e `RequestsHomeCard` (Fase 4: `getHomeRequests` com o mesmo `now` do `getHomeHandovers`; o link "Ver solicitações" leva `?setor=` para o admin). Setor inativo e admin sem setor ativo: só o estado vazio, sem o cartão.
- **Usa:** `requireUser`, `resolveScreenSector`, `getHomeHandovers`, `getHomeRequests`, `getAdminOverviewCounts` e `readInviteCardDismissed` (só admin), `shouldShowInviteCard`, `HomeCards` (que monta os cartões e os avatares: `RequestsHomeCard`, `requestsHref` e `avatarDataUri` são dele), `SectorPicker`, `SectorPill`, `EmptyState`, `buttonVariants` e o ícone `ChartColumn` ("Ver o dashboard").
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 7). 2026-11-24 — Fase 4 (Tarefa 13): cartão de solicitações depois de "Passagem do meu turno". 2026-11-25 — Fase 5 (Tarefa 1, P48): a resolução do setor vem de `resolveScreenSector` (sem mudar o comportamento). 2026-11-27 — visual novo (Tarefa 11): devolve a linha do hero (`data-slot="home-hero-row"`: o seletor do admin ou o `SectorPill` do operador, e o botão "Ver o dashboard") e, depois, os cartões em `data-slot="home-cards"` (`gap-4`, ponto de extensão do convite e do grid). Os ramos de erro (setor inativo, sem setor ativo) também levam a linha, só com o botão do dashboard. Espaçamento do hero: `pt-8 pb-10` (`max-md:pt-6 max-md:pb-7`). 2026-11-27 — visual novo do Início (Task 12): passa `sectorName`, `sectorColor` e o avatar do rascunho ao `MyShiftCard`. 2026-11-27 — visual novo do Início (Task 14): lê `getAdminOverviewCounts` (só admin) e o cookie de dispensa, calcula o primeiro acesso com `shouldShowInviteCard` e entrega o JSX dos cartões ao `HomeCards`; o cartão "Convide sua equipe" abre a lista. 2026-11-27 — Task 16 (pixel): o `ml-auto` do "Ver o dashboard" só vale sem o seletor/pílula (ramos de erro, à direita); com eles, o `justify-between` o põe à direita no desktop e, quando a linha quebra no celular, ele fica à esquerda, como no protótipo (screenshot 13). 2026-11-27 — Segunda rodada (G6): "Usa" em dia com os imports (o `RequestsHomeCard`, o `requestsHref` e o `avatarDataUri` passaram ao `HomeCards` na Task 14).

### QuantityCounter
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/QuantityCounter.tsx`
- **Propósito:** contagem inteira de `min` (padrão 0) a 99.999 com −/+ e digitação (ui-rules §2.2: número nunca em branco).
- **Como funciona:** `"use client"`, controlado (`value`, `onChange`, `onCommit`). `<fieldset>` com legenda do item (só para leitor de tela); botão − (`aria-label` `Diminuir {item}`, tooltip "Diminuir", trava em `min`, padrão 0), campo (`inputMode="numeric"`, `maxLength={5}`, `text-base tabular-nums text-center`, `aria-label` `Quantidade de {item}`, seleciona tudo ao receber foco) e botão + (`Aumentar {item}`, tooltip "Aumentar", trava no teto). Só dígitos; zeros à esquerda somem. O campo pode ficar vazio só no buffer enquanto se digita: ao sair vira `min` e chama `onChange(min)` e `onCommit(min)`. −/+ chamam `onChange` e `onCommit`. Alvos `size-9 max-md:size-11` (campo `h-9 max-md:h-11`). A unidade fica em texto ao lado.
- **Usa:** `Button` (`icon`), `Input`, `Tooltip`, `sanitizeQuantityInput`, `parseQuantity`, `stepQuantity`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 8); 2026-11-24 — prop `min` (padrão 0, comportamento anterior intacto): − desativa em `value <= min`, digitar abaixo do mínimo fica só no campo e sair com vazio ou abaixo dele salva o mínimo; `stepQuantity(value, delta, min = 0)`. A solicitação usa `min={1}` (Fase 4, Tarefa 10).

### useHandoverAutosave
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/useHandoverAutosave.ts`
- **Propósito:** salvamento automático por campo da passagem (F3-3).
- **Como funciona:** `"use client"`. `change(campo)` agenda o envio com debounce de 800 ms por campo; `commit(campo)` envia já (onBlur, −/+). **Fila serial**: uma requisição em voo por vez, e o valor mais novo de cada campo vence (chave `occurrences`, `nextShift`, `quantity:{item}`, `note:{item}`). Falha (`ok: false` ou exceção) vira `status: error`, mantém o digitado e **para a fila** até `retry()`; o evento `online` também reenvia. `flush()` envia tudo e devolve `true` só se nada ficou sem salvar (o botão "Entregar turno" e a troca de turno/data dependem disso). `beforeunload` só enquanto houver algo não salvo; ao desmontar, envia o pendente sem esperar. Nunca lança. Não revalida a tela: a action de salvar não chama `revalidatePath`.
- **Usa:** `saveHandoverFieldAction` (injetada), `AUTOSAVE_DEBOUNCE_MS`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 8).

### AutosaveIndicator
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/AutosaveIndicator.tsx`
- **Propósito:** dizer, em texto, o estado do salvamento automático.
- **Como funciona:** `"use client"`. `<output aria-live="polite">` (papel `status`) com "Salvando…", "Salvo às {HH:mm}", "Último salvamento às {HH:mm} por {nome}" (estado inicial vindo do servidor), "Nada salvo ainda." ou, no erro, "Não salvo." + a mensagem + botão "Tentar de novo" (`outline`, `sm`). Cada estado leva um ícone decorativo (`aria-hidden`) ao lado do texto.
- **Usa:** `Button`, `formatTimeBR`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 8); 2026-11-21 — ícones por estado (revisão final).

### ItemLineField
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/ItemLineField.tsx`
- **Propósito:** uma linha de item da passagem: nome, contador e observação opcional.
- **Como funciona:** `"use client"`; renderiza um `<li>` (a lista é do `HandoverFields`). Nome em `font-medium`, `QuantityCounter` e o botão "Adicionar observação" (`aria-label` `Adicionar observação em {item}`) que revela o campo `Observação de {item}` (`maxLength` 200, `text-base`); a observação já vem aberta quando existe. Digitar chama `onNoteChange`; sair do campo chama `onNoteCommit`.
- **Usa:** `QuantityCounter`, `Button`, `Input`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 8).

### HandoverFields
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HandoverFields.tsx`
- **Propósito:** o corpo do formulário da passagem, sem estado próprio (reaproveitado pela correção com motivo).
- **Como funciona:** `"use client"`. Seções Controles ("Soma no período, como redes danificadas.") e Estoque ("Contagem de agora. Vale a última, nunca a soma."), só as que têm itens; sem nenhum item, `EmptyState` "Nenhum item neste setor." (admin: link "Ir para Itens"). Depois "Ocorrências do turno" e "Fica para o próximo turno" (`Textarea` `text-base`, `maxLength` 2.000, contador "{n} de 2.000 caracteres" só a partir de 90%; a segunda com destaque `border-warning-foreground/40 bg-warning/30` e ícone). Valores e eventos (`onChange`, `onCommit`) vêm do pai. Prop opcional `afterItems` (nó): renderizada depois de Controles/Estoque (ou do estado vazio de itens) e antes de "Ocorrências do turno"; sem ela nada muda.
- **Usa:** `ItemLineField`, `EmptyState`, `Field*`, `Textarea`, tokens `warning`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 8). 2026-11-24 — Fase 4 (Tarefa 13): slot `afterItems` para a seção de solicitações abertas.

### HandoverHeader
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HandoverHeader.tsx`
- **Propósito:** setor, turno e data do formulário (D-F3-2).
- **Como funciona:** `"use client"`. Setor em texto (`FieldTitle`, nunca `<label>` sem controle); `SelectField` "Turno" (`{nome} ({início}–{fim})`) e `<input type="date">` "Data" (`min` = hoje − 31 dias, `max` = hoje; valor vazio ou fora da janela é ignorado). Trocar turno ou data chama `beforeNavigate` (o `flush` do salvamento) e só então `router.push` para `/passagens/nova?turno=&data=` (+ `&setor=` do admin); a troca de turno mantém a data e vice-versa. A data só vale ao sair do campo, com Enter ou depois de 700 ms sem digitar (digitar "15" pelo teclado não salta para o dia 01). Prop `onPendingChange(pending)` avisa o formulário enquanto uma troca está em andamento. Se não deu para salvar, toast "Não foi possível salvar. Tente de novo antes de trocar de turno." e não navega. Campos desabilitados enquanto salva ou navega.
- **Usa:** `SelectField`, `Field*`, `Input`, `newHandoverHref`, `sonner`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 8). 2026-11-22 — revisão final: data por blur/Enter/pausa de 700 ms e `onPendingChange`. 2026-11-24 — Fase 4 (Tarefa 3, P29): "Setor" com `FieldTitle` no lugar do `FieldLabel` órfão.

### HandoverForm
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HandoverForm.tsx`
- **Propósito:** formulário da passagem com salvamento automático e "Entregar turno".
- **Como funciona:** `"use client"`; o chamador põe `key={turno:data}` para remontar ao trocar. Estado controlado dos valores (nunca em branco: `0` e textos vazios), `useHandoverAutosave`, `HandoverHeader` (modo `draft`), `HandoverFields` e `AutosaveIndicator`. **Entregar turno** faz `flush()` antes; se algo ficou sem salvar, mostra "Há alterações sem salvar. Toque em “Tentar de novo” e entregue de novo." e não entrega; com sucesso, toast "Turno entregue." e navega para o resumo (o botão fica travado até a navegação); `ALREADY_DELIVERED` e outras falhas aparecem no próprio formulário, sem perder o digitado. Sem diálogo de confirmação. Enquanto uma troca de turno ou data está em andamento, os campos e "Entregar turno" ficam travados e `deliver()` recusa. No modo `edit` (passagem entregue) não há cabeçalho nem botão, só o botão "Ver resumo" (espera o `flush()` e então navega; se o salvamento falhar, fica na tela e mostra "Há alterações sem salvar. Toque em “Tentar de novo” antes de ver o resumo."). Prop opcional `requestsSection` (nó) repassada ao slot `afterItems` do `HandoverFields`: só o rascunho a recebe (a edição da entregue e a correção com motivo não mostram solicitações).
- **Usa:** `useHandoverAutosave`, `useAdminAction`, `saveHandoverFieldAction`, `deliverHandoverAction`, `HandoverHeader`, `HandoverFields`, `AutosaveIndicator`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 8). 2026-11-22 — revisão final: trava durante a troca de turno/data; "Ver resumo" com mensagem própria. 2026-11-24 — Fase 4 (Tarefa 13): prop `requestsSection`.

### NewHandover
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/NewHandover.tsx`
- **Propósito:** a página `/passagens/nova`.
- **Como funciona:** Server Component assíncrono, dentro de `<Suspense>`. `requireUser()`; operador usa o próprio setor, admin escolhe (`resolveScreenSector` + `SectorPicker`). Turno e data vêm de `resolveHandoverTarget` (URL válida ou sugestão pelo horário). **GET nunca escreve**: o rascunho nasce no primeiro salvamento. Combinação já entregue ou confirmada redireciona para o resumo. Estados vazios: sem setor ativo, setor inativo, sem turnos (admin: link "Ir para Turnos"). No rascunho (`mode: "draft"`) lê as abertas de agora (`listOpenRequests`) e as escolhas do formulário (`getRequestFormChoices`) e passa ao `HandoverForm` a seção `OpenRequestsNowSection` com o `NewRequestDialog` (`originRef` = a tripla setor + turno + dia da tela, `sectors={null}`, `triggerVariant="outline"`); o rascunho só nasce se a pessoa criar a solicitação (escrita iniciada por ela, nunca pelo GET).
- **Usa:** `getHandoverFormState`, `listActiveShifts`, `resolveHandoverTarget`, `resolveScreenSector`, `HandoverForm`, `SectorPicker`, `EmptyState`. Também: `listOpenRequests`, `getRequestFormChoices`, `OpenRequestsNowSection`, `NewRequestDialog`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 8). 2026-11-24 — Fase 4 (Tarefa 13): seção "Solicitações abertas" no formulário do rascunho. 2026-11-25 — Fase 5 (Tarefa 1, P48): a resolução do setor vem de `resolveScreenSector` (sem mudar o comportamento).

### SummaryItemList
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/SummaryItemList.tsx`
- **Propósito:** lista de itens de uma seção do resumo da passagem (Controles ou Estoque).
- **Como funciona:** server-safe; `<section aria-labelledby>` com `<h2>` e `<ul>`; cada linha mostra o nome, `{quantidade} {unidade}` à direita com `tabular-nums` (milhar em pt-BR) e a observação em `text-muted-foreground`; sem itens não escreve nada (nem o título).
- **Usa:** tokens `border`, `muted-foreground`; `formatQuantity`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 9).

### CorrectionsTimeline
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/CorrectionsTimeline.tsx`
- **Propósito:** mostrar as correções de uma passagem confirmada (D13) como linha do tempo.
- **Como funciona:** server-safe; `<ol>` com uma entrada por campo corrigido: rótulo (`correctionFieldLabel`), `antigo → novo` (`(vazio)` para texto vazio), `Motivo: …` e `{nome} · {dd/mm/aaaa, HH:mm}`; ordem recebida (a consulta já ordena por data); sem correções não escreve nada.
- **Usa:** tokens `border`, `muted-foreground`; `formatDateTimeBR`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 9).

### ConfirmReceiptForm
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/ConfirmReceiptForm.tsx`
- **Propósito:** confirmar o recebimento de uma passagem entregue, com observação opcional.
- **Como funciona:** `"use client"`; formulário controlado: `Textarea` "Observação do recebimento (opcional)" (500 caracteres) e botão "Confirmar recebimento" (pendente: "Confirmando…", desabilitado, um envio só); valida com `confirmHandoverSchema` antes de chamar `confirmHandoverAction`; sucesso = toast "Recebimento confirmado." (a action revalida a página, que passa a mostrar a passagem confirmada); recusa aparece inline (no campo, se for da observação; senão abaixo dele) sem toast, e o que foi digitado fica.
- **Usa:** `useAdminAction`, `Button`, `Field*`, `Textarea`, `sonner`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 9).

### HandoverDetail
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HandoverDetail.tsx`
- **Propósito:** resumo de `/passagens/[id]` na ordem do briefing (F3-10).
- **Como funciona:** server (async); `requireUser()` primeiro; id que não é uuid, passagem inexistente ou de outro setor = `notFound()`; rascunho redireciona para `/passagens/nova` do mesmo turno e dia (com `setor`). Ordem: título e subtítulo (`{setor} · {turno} · {data}`) com `HandoverStatusBadge` (+ selo "Corrigida") → "Fica para o próximo turno" (borda `border-warning`) → "Solicitações abertas" (`OpenRequestsAtDeliverySection`: as abertas no instante da entrega, com o status daquele instante e "Agora: …"; só no resumo, nunca em `?editar=1`) → Controles → Estoque (só itens com valor ≠ 0 ou observação; os demais recolhidos em `<details>` "Demais itens: 0 (n)") → "Ocorrências do turno" → "Entrega" (quem entregou, quem recebeu, observação, `ConfirmReceiptForm` para quem pode confirmar ou o aviso para quem entregou) → "Correções" (`CorrectionsTimeline`) → links "Corrigir" (entregue; quem entregou e admin), "Corrigir com motivo" (confirmada; admin) e "Ver todas as passagens". Setor inativo (`summary.sectorActive` falso): `ReadOnlySectorNotice` logo depois do cabeçalho e nenhuma ação de escrita (sem `ConfirmReceiptForm`, sem a frase "Você entregou este turno…", sem "Corrigir" nem "Corrigir com motivo"); `?editar=1` cai no resumo.
- **Usa:** `getHandoverSummary`, `getHandoverFormStateById`, `SummaryItemList`, `CorrectionsTimeline`, `ConfirmReceiptForm`, `HandoverForm`, `CorrectionForm`, `HandoverStatusBadge`, `buttonVariants`. Também: `listOpenRequestsAtDelivery`, `OpenRequestsAtDeliverySection`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 9). 2026-11-21 — Fase 3 (Tarefa 11): `?editar=1` troca o resumo pelo formulário quando a pessoa pode editar (título "Corrigir passagem"): `HandoverForm` em modo `edit` para a entregue (quem entregou e admin, salvamento automático) e `CorrectionForm` para a confirmada (só admin); quem não pode cai no resumo. 2026-11-24 — Fase 4 (Tarefa 3, P37): setor inativo é só leitura, com `ReadOnlySectorNotice`. 2026-11-24 — Fase 4 (Tarefa 13): seção "Solicitações abertas" (as abertas na entrega) logo depois de "Fica para o próximo turno". 2026-11-25 — Fase 5 (Tarefa 1, P48): "em {data} às {hora}" vem de `formatDateAtTimeBR` (a cópia local `dateAndTime` saiu; o texto é o mesmo).

### ReadOnlySectorNotice
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/passagens/ReadOnlySectorNotice.tsx` (server-safe)
- **Propósito:** avisar que o setor está inativo e que a tela é só leitura (P37); a Fase 4 o reutiliza no detalhe da solicitação.
- **Como funciona:** `<Alert>` com o ícone `Lock` (decorativo), título "Setor inativo: só leitura." e descrição "Peça a um administrador para reativá-lo.". Sem props: quem usa decide quando mostrar (`!summary.sectorActive`) e esconde as ações de escrita.
- **Usa:** `Alert`, `AlertTitle`, `AlertDescription`, ícone `Lock` (lucide).
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 3, P37).

### HandoverHistory
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HandoverHistory.tsx` (server, async)
- **Propósito:** conteúdo de `/passagens`: o histórico de passagens, do dia mais recente ao mais antigo.
- **Como funciona:** chama `requireUser()`, interpreta os filtros da URL (`parseHistoryFilters`, dia de hoje em São Paulo) e lê `listHandoverHistory` (50 por página, `?pagina=` clampada). Operador usa o próprio setor e nunca vê o seletor; admin vê o `SectorPicker` com "Todos os setores" (que não grava cookie) e o setor vem de `?setor=`, do cookie ou do primeiro ativo. Ordem na tela: título, seletor (admin), `HistoryFilters`, "Período: dd/mm/aaaa a dd/mm/aaaa", lista de `HistoryRowItem` (ou o estado vazio "Nenhuma passagem neste período.") e `Pagination` com os filtros e o setor preservados. Setor inativo (operador) ou nenhum setor ativo (admin) mostram `EmptyState`. Fase 5: as escolhas de Turno e Item vêm de `listHistoryShifts` e `listHistoryItems` (o turno ou o item inativo que a URL escolheu entra no fim como "(inativo)"); `?item=` fora das escolhas (inexistente, de outro setor, ou em "Todos os setores") vira "todos" antes da consulta.
- **Usa:** `HistoryFilters`, `HistoryRowItem`, `SectorPicker`, `EmptyState`, `Pagination`, `listHandoverHistory`, `listHistoryShifts`, `listHistoryItems`, `resolveScreenSector`, `paginationParams`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 10). 2026-11-25 — Fase 5 (Tarefa 1, P48): o setor vem de `resolveScreenSector` e os parâmetros da `Pagination` de `paginationParams` (`src/lib/searchParams.ts`); sem mudança de comportamento. 2026-11-25 — Fase 5 (Tarefa 3, P45): o `SectorPicker` recebe `query={hrefQuery(buildHistoryHref(filters))}`: trocar de setor mantém o período e a situação e solta o turno e a página. 2026-11-25 — Fase 5 (Tarefa 6): filtro de item e turno/item inativos no formulário.

### HistoryFilters
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HistoryFilters.tsx`
- **Propósito:** filtros do histórico (período, turno, situação e item) que vivem na URL.
- **Como funciona:** `"use client"`; formulário controlado que nunca começa em branco (os valores vêm da URL já interpretada: 7 dias, todos os turnos, todas as situações). `SelectField` "Período" (Últimos 7 dias, Últimos 30 dias, Intervalo), "Turno" (só quando há turnos do setor: some em "Todos os setores"), "Situação" e, no Intervalo, `De` e `Até` (`type="date"`, já preenchidos com o período atual). "Aplicar filtros" navega com `router.push(buildHistoryHref(…))` (volta à página 1 e preserva o setor do admin); "Limpar filtros" é um `<Link>` para `/passagens` (preserva só `?setor=`). Fase 5: "Situação" ganha Entregues (logo depois de Todas) e Esperadas (logo depois de Entregues); "Item" (só com itens, logo depois de "Turno"; prop opcional `items`, `Todos os itens` por padrão); o turno e o item inativos que a URL escolheu aparecem selecionados como "{nome} (inativo)" e "{nome} ({unidade}) (inativo)" (prop `shifts` com `active?`), nunca como "Todos os …".
- **Usa:** `SelectField`, `Field`, `Input`, `Button`, `buttonVariants`, `buildHistoryHref`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 10). 2026-11-25 — Fase 5 (Tarefa 6): situações Entregues e Esperadas, Item e o inativo escolhido (D-F5-3, C-1, C-4).

### HistoryRowItem
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HistoryRowItem.tsx` (server-safe)
- **Propósito:** uma linha do histórico: o dia, o turno, quem entregou e a situação.
- **Como funciona:** reaproveita `AdminListRow`. Título `dd/mm/aaaa · {turno}` (data com `tabular-nums`); subtítulo com o setor (só quando `showSector`) e "Entregue por {nome} às {HH:mm}" (ausente em "sem passagem"); `HandoverStatusBadge` com o selo "Corrigida" quando há correção. Link da linha: "Abrir" (`aria-label` "Abrir passagem de {turno} em {data}") para a passagem; em "sem passagem" o link é "Entregar turno" ou, se há rascunho, "Continuar passagem", para o turno e o dia daquela linha (o setor da linha vai em `?setor=` só para o admin). Com `minDate` (hoje − 31 dias) a linha "sem passagem" mais antiga que isso não mostra ação, porque o link cairia no turno sugerido de hoje.
- **Usa:** `AdminListRow`, `HandoverStatusBadge`, `buttonVariants`, `handoverHref`, `newHandoverHref`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 10); 2026-11-21 — prop `minDate` (revisão final).

### CorrectionForm
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/CorrectionForm.tsx`
- **Propósito:** o admin corrige uma passagem já confirmada, com motivo e rastro (D13).
- **Como funciona:** `"use client"`; reaproveita `HandoverFields` com estado local (sem salvamento automático: nada é gravado até o envio) e acrescenta `Textarea` "Motivo da correção" (obrigatório, 500 caracteres); "Registrar correção" (pendente: "Registrando…") valida com `correctHandoverSchema` e manda o estado completo desejado; o servidor calcula o diff. Sucesso = toast "Correção registrada." e volta ao resumo (que mostra o selo "Corrigida"); recusa (motivo, `NO_CHANGES`, `FORBIDDEN`) aparece inline, sem toast, e nada do que foi digitado se perde. Link "Cancelar" volta ao resumo.
- **Usa:** `HandoverFields`, `useAdminAction`, `Button`, `Field*`, `Textarea`, `sonner`, `useRouter`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 11).

### Solicitações — `src/components/solicitacoes/*` (Fase 4)

Selos, formulário de criação, quadro, lista, tabela e detalhe das solicitações. Status sempre com texto (a cor pertence ao status e nunca é ciclada) e com ícone em todas as telas, menos nas linhas do cartão de Solicitações do Início, onde os selos de status e de parada saem só com texto, como no protótipo (D-V5, decisão do dono de 2026-11-27; `showIcon`/`badgeIcons`). Ação que muda status usa a cor do status de destino.

### statusStyle
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/statusStyle.ts` (server-safe)
- **Propósito:** o ícone e as classes de cor de cada status de solicitação, num lugar só.
- **Como funciona:** `REQUEST_STATUS_STYLE[status]` devolve `{ icon, badgeClass, buttonClass }`. Solicitada `CircleDot` + `bg-accent text-foreground` (neutro); Em separação / Trânsito `Truck` + `bg-info text-info-foreground`; Entregue `CircleCheck` + `bg-success text-success-foreground`; Cancelada `CircleX` + `bg-accent text-muted-foreground` (`bg-muted` some no tema novo, onde `--muted` = `--card`). `buttonClass` = `badgeClass` + `border-transparent hover:bg-{token}/80`: é a cor do botão "Mover para {status}" (o de cancelar usa `variant="destructive"`). Classes sempre inteiras no texto, para o Tailwind enxergá-las.
- **Usa:** tokens `accent`, `info`, `success`; ícones do lucide.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 10). 2026-11-27 — visual novo do Início (Task 13): Solicitada passa a neutra, Em separação / Trânsito a azul (`info`) e Cancelada a `bg-accent`; a parada continua em `warning`, só no `StaleBadge`. Vale para o botão "Mover para …", a Timeline e os grupos da Lista.

### RequestStatusBadge
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestStatusBadge.tsx` (server-safe)
- **Propósito:** selo do status da solicitação (cartão, linha, tabela, detalhe, passagem).
- **Como funciona:** `<Badge variant="secondary" size="md" className="…">` (pílula de 24 px, `whitespace-nowrap`, vindo do `Badge`) com o ícone (`aria-hidden`) e o rótulo do `REQUEST_STATUS_STYLE`. Nunca só cor: o texto vem sempre. `showIcon={false}` (padrão `true`) tira o ícone; só as linhas do cartão do Início usam (D-V5, decisão do dono de 2026-11-27, como no protótipo).
- **Usa:** `Badge`, `statusStyle`, `REQUEST_STATUS_LABEL`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 10). 2026-11-27 — visual novo (Task 13): pílula `size="md"`; as cores de Solicitada, Em separação / Trânsito e Cancelada mudam (ver `statusStyle`). 2026-11-27 — Task 16 (D-V5, decisão do dono de 2026-11-27): prop `showIcon` (padrão `true`); `false` só nas linhas do `RequestsHomeCard`.

### StaleBadge
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/StaleBadge.tsx` (server-safe)
- **Propósito:** selo "Parada há N dias" das solicitações abertas há mais de 72 h no mesmo status.
- **Como funciona:** `<Badge variant="warning" size="md">` com `ClockAlert` (`aria-hidden`; `showIcon={false}` o tira, só nas linhas do cartão do Início) e `staleLabel(days)` (`Parada há 1 dia`, `Parada há 5 dias`). Quem decide se a solicitação está parada é o SQL (`stale`); o selo só mostra.
- **Usa:** `Badge`, `staleLabel`, token `warning`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 10). 2026-11-27 — visual novo (Task 13): usa a variante `warning` e `size="md"` do `Badge` (mesma cor de antes, agora em pílula). 2026-11-27 — Task 16 (D-V5, decisão do dono de 2026-11-27): prop `showIcon` (padrão `true`); `false` só nas linhas do `RequestsHomeCard`.

### RequestForm
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestForm.tsx`
- **Propósito:** formulário de nova solicitação, o MESMO na tela de solicitações e na passagem.
- **Como funciona:** `"use client"`, controlado, nunca começa em branco: `Destino` (`SelectField` com os destinos ativos e `Outro` por último) já vem no destino mais usado do setor, se ele estiver entre as opções (senão, no primeiro ativo; sem destinos ativos, em `Outro`); `Outro` revela `Qual destino?` (`maxLength` 80, `text-base`); `Descrição` (`Textarea`, 500, obrigatória); grupo `Itens` (opcional): `Adicionar item` acrescenta o primeiro item de estoque ainda não escolhido com quantidade 1, cada linha tem `<select>` "Item" (só as opções que ninguém escolheu, mais a própria), `QuantityCounter` com `min={1}` e `Remover {item}` (ícone `Trash2`, tooltip "Remover item"); sem itens de estoque, o texto "Nenhum item de estoque neste setor.". `Setor` só aparece para o admin em "Todos os setores" (`sectors` não nulo); trocar o setor limpa os itens e mantém o destino. Valida com `createRequestSchema` antes da action (erro vai para o campo, a action não é chamada); `useAdminAction` com `showError: false` e toast "Solicitação criada."; erro do servidor vai para o campo de `fieldErrors` e, sem campo (ex.: passagem confirmada), para um `FieldError` no pé; nada do digitado se perde. Botões `Criar solicitação` (pendente `Criando…`) e `Voltar`.
- **Usa:** `SelectField`, `QuantityCounter`, `Field*`, `Input`, `Textarea`, `NativeSelect`, `Button`, `Tooltip`, `useAdminAction`, `createRequestAction`, `createRequestSchema`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 10). 2026-11-24 — revisão final: cada linha de item tem uma chave do cliente (fora do payload), então trocar o item mantém foco e quantidade; a `Descrição` ganha `text-base md:text-base`; o destino padrão só vale se estiver entre as opções (senão, o primeiro ativo).

### NewRequestDialog
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/NewRequestDialog.tsx`
- **Propósito:** gatilho "Nova solicitação" + diálogo com o `RequestForm`.
- **Como funciona:** `"use client"`. Gatilho `Button` (`Plus` + "Nova solicitação"; `triggerVariant` `default` ou `outline`, o da passagem). O conteúdo desmonta ao fechar, então cada abertura começa com o estado novo. `DialogContent showCloseButton={false}` (o X só com ícone do primitivo não tem tooltip; "Voltar" fecha), `max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg`. Sucesso fecha (o toast vem do formulário); erro mantém o diálogo aberto.
- **Usa:** `Dialog`, `Button`, `RequestForm`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 10).

### RequestsScreen
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestsScreen.tsx`
- **Propósito:** a tela `/solicitacoes`: cabeçalho, filtros, seletor de visão e a visão escolhida (Quadro, Lista ou Tabela).
- **Como funciona:** server component async (dentro do `<Suspense>` da página). Lê a sessão, os filtros da URL (`parseRequestFilters`) e o setor (admin: `SectorPicker` com "Todos os setores"; operador: o próprio, nunca o seletor). `?criador=` e `?destino=` (uuid) fora das escolhas viram "todos" antes da consulta. Sem `visao` renderiza o Quadro (`hidden md:block`) e a Lista (`md:hidden`) com os mesmos dados e dois `RequestViewSwitcher` (um por largura, para o `aria-current` dizer a verdade). O subtítulo vem do servidor (`boardSummary`/`tableSummary`). Vazio novo × vazio filtrado; operador de setor inativo e admin sem setor ativo têm estado vazio próprio. Fase 5: `?item=` vale se existe nas solicitações do escopo (`listFilterItems`, mesmo além do teto de escolhas) e senão vira "todos" antes da consulta; a janela de 30 dias do Quadro e da Lista some também com filtro de entrega (`closedWindowApplies`); o intervalo de entrega abre com a última semana, nunca em branco.
- **Usa:** `RequestFiltersForm`, `RequestViewSwitcher`, `RequestBoard`, `RequestList`, `RequestTable`, `NewRequestDialog`, `SectorPicker`, `EmptyState`, `resolveScreenSector`, `paginationParams`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 11). 2026-11-25 — Fase 5 (Tarefa 1, P48): o setor vem de `resolveScreenSector` e os parâmetros da `Pagination` de `paginationParams`; sem mudança de comportamento. 2026-11-25 — Fase 5 (Tarefa 3, P45): o `SectorPicker` recebe `query={hrefQuery(buildRequestsHref(filters))}` (os filtros já validados, depois das escolhas de criador e destino): trocar de setor mantém a visão, o destino, o período e a busca e solta o criador e a paginação. 2026-11-25 — Fase 5 (Tarefa 5): filtros de status, parada, entrega e item. Correção: com `?status=cancelada` o Quadro (sem coluna de canceladas) cede o lugar à Lista, em qualquer largura.

### RequestViewSwitcher
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestViewSwitcher.tsx`
- **Propósito:** trocar entre Quadro, Lista e Tabela sem perder os filtros.
- **Como funciona:** `<nav aria-label="Visão">` com três `<Link className={buttonVariants(...)}>` (ícones `SquareKanban`, `List`, `Table2`); o da visão atual é `default` e tem `aria-current="page"`. Aceita `className` (a tela usa `md:hidden` / `hidden md:flex`).
- **Usa:** `buttonVariants`, `Link`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 11).

### RequestFiltersForm
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestFiltersForm.tsx`
- **Propósito:** busca, destino, período, quem criou, status, paradas, entrega e item, na URL.
- **Como funciona:** `"use client"`, controlado, valores iniciais da URL (nunca em branco); `key` = a URL dos filtros. "Aplicar filtros" monta a URL (`buildRequestsHref(resetPaging(...))`, mantém visão e setor); "Limpar filtros" é um `<Link>`. Escolhas, não texto: destinos (inativo marcado "(inativo)" e "Outro"), pessoas, períodos; "De"/"Até" só em "Intervalo". Busca `type="search"`, `text-base`, 80 caracteres. Fase 5: quatro controles novos, para os números do dashboard abrirem a lista exata — "Status" (Todos os status, Abertas, Não canceladas e cada status), "Paradas" (Todas, Só as paradas), "Entregue em" (Qualquer data, Últimos 7 dias, Últimos 30 dias, Intervalo; "Entregue de" e "Entregue até" só em Intervalo) e "Item" (só quando há itens: prop opcional `items`). Nenhum começa em branco.
- **Usa:** `SelectField`, `Input`, `Field`, `Button`, `buttonVariants`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 11). 2026-11-25 — Fase 5 (Tarefa 5): Status, Paradas, Entregue em e Item (D-F5-3).

### useRequestMove
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/useRequestMove.ts`
- **Propósito:** mover a solicitação no Quadro e na Lista com o cartão mudando de coluna antes da resposta.
- **Como funciona:** `useRequestMove(groups)` devolve `{ groups, move(request, to) }`. `useOptimistic(toGroupView(groups), applyMove)`; `move` roda o `setOptimistic` DENTRO de `startTransition(async …)`, antes do primeiro `await`, e chama `moveRequestAction({ id, from, to })`. `ok` → `toast.success`; falha → `toast.error` com a prévia da descrição, e `router.refresh()` quando `isStaleScreenCode(code)` (`STATUS_CONFLICT`, `NO_CHANGES`, `NOT_FOUND`); exceção → `unstable_rethrow` e `INTERNAL`. O estado otimista volta sozinho ao fim da transição.
- **Usa:** `moveRequestAction`, `applyMove`, `toGroupView`, `sonner`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 11).

### RequestBoard
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestBoard.tsx`
- **Propósito:** o Quadro: três colunas (Solicitada, Em separação / Trânsito, Entregue).
- **Como funciona:** `"use client"`. Lado a lado a partir de `lg`, empilhadas entre `md` e `lg`; abaixo de `md` o grupo "Coluna" (botões `aria-pressed` com a contagem) escolhe uma coluna e as outras ganham `max-md:hidden` (só CSS: as três ficam montadas; nada de `matchMedia`). Entregue mostra "Últimos 30 dias" só sem período.
- **Usa:** `useRequestMove`, `RequestColumn`, `FieldSet`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 11).

### RequestColumn
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestColumn.tsx`
- **Propósito:** uma coluna do Quadro: cabeçalho com ícone do status, contagem do servidor, cartões e "Carregar mais".
- **Como funciona:** desde a Fase 5 é só a `className` da coluna (`min-w-0`, borda, `bg-muted/30`, `p-3`) e um `<li><RequestCard/></li>` por linha, sobre `RequestGroupSection`; o cabeçalho, a contagem, o vazio, a nota e o "Carregar mais" são dela.
- **Usa:** `RequestGroupSection`, `RequestCard`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 11). 2026-11-25 — Fase 5 (Tarefa 1, P48): o miolo (cabeçalho, contagem, nota, vazio, `LoadMoreButton`) sai para `RequestGroupSection`; mesmo HTML e mesmos testes.

### RequestCard
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestCard.tsx`
- **Propósito:** o cartão da solicitação; também exporta `RequestHeadline` e `RequestMeta`, que a linha da Lista reaproveita.
- **Como funciona:** a descrição (2 linhas) é um `<Link href={requestHref(id)} scroll={false}>` esticado pelo cartão (`after:absolute after:inset-0`): abre o detalhe rápido no Sheet. O ↗ é um `<a href>` comum (página completa), com `aria-label` "Abrir página completa de {prévia}" e tooltip. Mostra "Para {destino}", setor (admin em Todos os setores), itens, comentários (ícone + número, "{n} comentários" só para leitor de tela), "Criada por {nome} em {data}", o selo de parada e o botão do próximo passo (`MoveStatusButton`, acima do link esticado).
- **Usa:** `MoveStatusButton`, `StaleBadge`, `Tooltip`, `buttonVariants`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 11).

### MoveStatusButton
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/MoveStatusButton.tsx`
- **Propósito:** a ação "Mover para {status}" na cor do status de destino (regra: o rótulo nomeia o resultado).
- **Como funciona:** `"use client"`; ícone e `buttonClass` de `REQUEST_STATUS_STYLE[to]`; `size` `default` ou `sm`; `className` extra.
- **Usa:** `Button`, `REQUEST_STATUS_STYLE`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 11).

### LoadMoreButton
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/LoadMoreButton.tsx`
- **Propósito:** "Carregar mais" de uma coluna ou grupo, com "{mostradas} de {total}".
- **Como funciona:** `"use client"`; `useTransition` + `router.replace(href, { scroll: false })` (o limite cresce pela URL, `?mais_<status>=`); pendente "Carregando…"; contador em `<p aria-live="polite">`.
- **Usa:** `Button`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 11).

### RequestList
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestList.tsx`
- **Propósito:** a Lista agrupada por status (os quatro, com Cancelada): a visão padrão no celular.
- **Como funciona:** `"use client"`; mesmo `useRequestMove` do Quadro; uma `RequestGroupSection` por status (cada grupo com `className="flex flex-col gap-2"` e uma `RequestListRow` por linha); nota "Últimos 30 dias" em Entregue e Cancelada só sem período.
- **Usa:** `RequestGroupSection`, `RequestListRow`, `useRequestMove`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 11). 2026-11-25 — Fase 5 (Tarefa 1, P48): o `ListGroup` local passa a usar `RequestGroupSection`; mesmo HTML e mesmos testes.

### RequestListRow
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestListRow.tsx`
- **Propósito:** a linha da Lista: o conteúdo do cartão em linha, com o mesmo próximo passo (no celular é onde se avança).
- **Usa:** `RequestHeadline`, `RequestMeta`, `MoveStatusButton`, `StaleBadge`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 11).

### RequestTable
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestTable.tsx`
- **Propósito:** a Tabela: lista plana paginada (50 por página), sem a janela de 30 dias.
- **Como funciona:** server-safe; `TableCaption` "Solicitações" só para leitor de tela; colunas Descrição (link com `scroll={false}`) · Setor (admin em Todos os setores) · Destino · Itens · Quem criou · Criada em · Status (selo, mais o de parada) · Dias no status; as numéricas à direita com `tabular-nums`; o contêiner do primitivo rola na horizontal. Paginação que preserva os filtros.
- **Usa:** `Table`, `Pagination`, `RequestStatusBadge`, `StaleBadge`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 11). 2026-11-24 — revisão final: o corte de 2 linhas da descrição (`line-clamp-2`) fica num `span` dentro do Link `inline-flex`.

### RequestDetail
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestDetail.tsx`
- **Propósito:** o detalhe da solicitação: a página completa `/solicitacoes/[id]` e o conteúdo do Sheet do detalhe rápido.
- **Como funciona:** server component async, `variant="page" | "sheet"`. `page`: título `<h1>` "Solicitação para {destino}", seções `h2`, link "Ver todas as solicitações", `notFound()` para id malformado, inexistente ou de outro setor. `sheet`: título pelo `SheetTitle`, seções `h3`, link `<a href>` "Abrir página completa" (navegação de documento: uma navegação no cliente para a mesma URL seria interceptada de novo), e o estado "Solicitação não encontrada." dentro do Sheet (um `notFound()` no slot derrubaria a tela). Mostra o aviso `ReadOnlySectorNotice` em setor inativo, propriedades (`<dl>`: status e selo de parada, setor só para o admin, destino, quem criou, origem com link para a passagem), itens com quantidade e unidade, "Mudar status" (só com `canMove`), linha do tempo e comentários; "Ver comentários anteriores" é sempre `<a href>` e some no teto de 500.
- **Usa:** `getRequestDetail`, `RequestStatusBadge`, `StaleBadge`, `RequestStatusActions`, `RequestTimeline`, `RequestComments`, `ReadOnlySectorNotice`, `formatDateAtTimeBR`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 12). 2026-11-25 — Fase 5 (Tarefa 1, P48): "Criada por {nome} em {data} às {hora}" vem de `formatDateAtTimeBR` (a cópia local `dateAndTime` saiu; o texto é o mesmo). 2026-11-26 — Fase 6 (Tarefa 7, P12): "Ver todas as solicitações" ganha `max-md:inline-flex max-md:min-h-11 max-md:items-center` (era 159x20 no celular).

### RequestSheet
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestSheet.tsx`
- **Propósito:** o Sheet do detalhe rápido (rota interceptada `@detalhe/(.)solicitacoes/[id]`).
- **Como funciona:** `"use client"`. `open` é constante: o slot só existe enquanto a URL é a do detalhe, e estado local não reabriria sob a Activity. Fechar (Escape, fundo ou o botão com texto "Fechar") chama `router.back()` uma vez só: a trava `closing` (um `ref` liberado no efeito de montagem) impede dois `back()` antes de a navegação terminar. O X só com ícone do primitivo fica desligado (`showCloseButton={false}`): o botão "Fechar" tem texto. Largura: `data-[side=right]:w-full` (tela inteira no celular) e `data-[side=right]:sm:max-w-xl` a partir de 640px (o `cn` descarta o `sm:max-w-sm` da base do Sheet; 384px apertava o detalhe no desktop).
- **Usa:** `Sheet`, `SheetContent`, `SheetClose`, `Button`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 12). 2026-11-24 — revisão final: o teste da trava usa `Activity` com a mesma instância; Escape num diálogo de dentro do Sheet (cancelar, apagar comentário) fecha só o diálogo, coberto pelo E2E (b), sem mudança no código. O fallback de carregamento do slot `@detalhe/(.)solicitacoes/[id]` ganha `SheetTitle` `sr-only` "Carregando solicitação". 2026-11-27 — Task 15 (legibilidade): `data-[side=right]:w-full` no `SheetContent` (o `w-3/4` do Sheet vencia o `w-full`; em 390px o painel tinha 290px e "Mover para Em separação / Trânsito" ficava cortado na borda). 2026-11-27 — Revisão final (F8): `data-[side=right]:sm:max-w-xl` no `SheetContent` (o detalhe ficava em 384px no desktop).

### RequestDetailSkeleton
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestDetailSkeleton.tsx`
- **Propósito:** esqueleto do detalhe (`aria-busy`) enquanto a página completa ou o Sheet leem o banco.
- **Usa:** `Skeleton`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 12).

### RequestStatusActions
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestStatusActions.tsx`
- **Propósito:** "Mudar status" no detalhe: um botão por status alvo (na cor do destino) e "Cancelar solicitação".
- **Como funciona:** `"use client"`; `moveTargets(status)` (Cancelada reabre para qualquer um); todos os botões, o gatilho de "Cancelar solicitação" inclusive (`disabled={pending}` repassado ao `CancelRequestDialog`), ficam desativados enquanto um movimento está em voo. Sucesso: toast "“{prévia}” movida para {status}."; falha: toast de erro nomeando a solicitação e `router.refresh()` em `STATUS_CONFLICT`, `NO_CHANGES` e `NOT_FOUND`.
- **Usa:** `MoveStatusButton`, `CancelRequestDialog`, `useAdminAction`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 12). 2026-11-24 — revisão final: "Cancelar solicitação" também fica desativado durante um movimento.

### CancelRequestDialog
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/CancelRequestDialog.tsx`
- **Propósito:** cancelar a solicitação com motivo obrigatório (≤ 500 caracteres).
- **Como funciona:** `"use client"`; `Dialog` com `Textarea` "Motivo do cancelamento"; valida com `cancelRequestSchema` antes da action (erro no campo, sem chamar o servidor); "Voltar" fecha; o motivo não volta na próxima abertura. Só fecha sozinho no sucesso (toast "Solicitação cancelada."); `fieldErrors.reason` fica no campo, `STATUS_CONFLICT`/`NO_CHANGES`/`NOT_FOUND` viram toast + fecha + `router.refresh()` (o botão de cancelar some depois do refresh), qualquer outra falha fica no pé do diálogo, aberto, com o texto.
- **Usa:** `Dialog`, `Textarea`, `Field*`, `useAdminAction`, `cancelRequestSchema`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 12). 2026-11-24 — revisão final: prop `disabled` (padrão `false`) no gatilho, usada pelo `RequestStatusActions` durante um movimento.

### RequestTimeline
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestTimeline.tsx`
- **Propósito:** a linha do tempo dos status (mais antigo primeiro): "Criada por X", "X moveu para Y", "X cancelou" com "Motivo: …", "X reabriu como Y".
- **Como funciona:** server-safe; `<ol>` com o ícone do status de destino (nunca só cor), a frase de `timelineSentence`, a data e hora de São Paulo em `<time>`.
- **Usa:** `REQUEST_STATUS_STYLE`, `timelineSentence`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 12).

### RequestComments
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestComments.tsx`
- **Propósito:** os comentários da solicitação (mais antigo primeiro, os últimos 50).
- **Como funciona:** server-safe; título "Comentários (n)" no nível `headingLevel` (2 na página, 3 no Sheet); "Ver comentários anteriores" (`<a href>`) acima da lista; o motivo de cancelamento aparece com o rótulo "Motivo do cancelamento" e sem "Apagar"; `DeleteCommentButton` só onde `canDelete`; `CommentComposer` só com `canComment`; vazio em uma linha.
- **Usa:** `CommentComposer`, `DeleteCommentButton`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 12).

### CommentComposer
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/CommentComposer.tsx`
- **Propósito:** escrever um comentário.
- **Como funciona:** `"use client"`; `Textarea` "Novo comentário" (`text-base`, 2.000 caracteres) + "Comentar" (pendente "Comentando…"); valida com `addCommentSchema` antes da action; limpa só no sucesso (toast "Comentário adicionado."); o erro fica no campo e o texto digitado nunca se perde.
- **Usa:** `useAdminAction`, `Textarea`, `Field*`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 12).

### DeleteCommentButton
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/DeleteCommentButton.tsx`
- **Propósito:** apagar o próprio comentário, com confirmação.
- **Como funciona:** `"use client"`; botão "Apagar" com `aria-label` "Apagar comentário de {data}"; `ConfirmDialog` destrutivo ("Apagar comentário?" / "Ele some da solicitação para todos."); sucesso: toast "Comentário apagado."; falha: a mensagem fica no diálogo.
- **Usa:** `ConfirmDialog`, `deleteCommentAction`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 12).

### OpenRequestItem
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/OpenRequestItem.tsx` (server-safe)
- **Propósito:** uma solicitação aberta nas seções da passagem e no cartão do Início.
- **Como funciona:** `<li class="border-t">` com uma linha (`data-slot="open-request-row"`, raio 18, margem lateral −10 px, `hover:bg-accent` em 150 ms) inteira clicável: o `<Link href={requestHref(id)} scroll={false}>` com a prévia (`requestPreview`, Geist 600/15 px) é esticado por `after:inset-0` (o nome acessível continua sendo a prévia; o foco desenha o anel no `::after`). Abaixo, "Para {destino}" (13 px), `RequestStatusBadge`, `StaleBadge` e, com `statusNow` diferente, "Agora: {status}". Fecha com o `ChevronRight` de 18 px. A divisória é o `border-t` da `<li>` (as seções não usam mais `divide-y`).
- **Usa:** `RequestStatusBadge`, `StaleBadge`, `requestPreview`, `requestHref`, `REQUEST_STATUS_LABEL`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 13). 2026-11-27 — visual novo do Início (Task 13): linha inteira clicável com chevron; vale também para as seções da passagem. 2026-11-27 — Task 16 (pixel): "Para {destino}" com `leading-[normal]` (a linha de 18,6px deixava cada linha 1,6px mais alta que a do protótipo). 2026-11-27 — Task 16 (D-V5, decisão do dono de 2026-11-27): prop `badgeIcons` (padrão `true`); `false` tira o ícone dos selos de status e de parada (o chevron fica). Só o `RequestsHomeCard` usa; as seções da passagem mantêm os ícones.

### OpenRequestsNowSection
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/OpenRequestsNowSection.tsx` (server-safe)
- **Propósito:** seção "Solicitações abertas" do formulário do rascunho: as abertas de agora do setor.
- **Como funciona:** `<section>` com `<h2>` "Solicitações abertas" e a ajuda "Do setor, agora. As paradas há mais tempo aparecem primeiro."; lista de `OpenRequestItem` (até 20, a mais antiga no status primeiro) ou "Nenhuma solicitação aberta."; com mais do que o listado, "Mostrando {n} de {total}."; no pé o nó `newRequest` (o `NewRequestDialog` do rascunho, que leva a tripla da passagem como `originRef`; `null` não mostra botão) e o link "Ver todas as solicitações" (`allHref`).
- **Usa:** `OpenRequestItem`, `buttonVariants`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 13).

### OpenRequestsAtDeliverySection
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/OpenRequestsAtDeliverySection.tsx` (server-safe)
- **Propósito:** seção "Solicitações abertas" do resumo da passagem: como estavam NA ENTREGA (D-F4-2).
- **Como funciona:** `<section>` com `<h2>` "Solicitações abertas" e "Como estavam na entrega, em {dd/mm/aaaa} às {HH:mm}." (hora de São Paulo); cada `OpenRequestItem` mostra o status e o selo de parada **daquele instante** e "Agora: {status}" quando o status mudou depois; vazio "Nenhuma solicitação aberta na entrega."; "Mostrando {n} de {total}." acima de 20; link "Ver todas as solicitações". Só leitura (sem botão de criar).
- **Usa:** `OpenRequestItem`, `formatDateBR`, `formatTimeBR`, `saoPauloParts`, `buttonVariants`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 13).

### RequestsHomeCard
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestsHomeCard.tsx` (server-safe)
- **Propósito:** cartão "Solicitações" do Início, depois de "Passagem do meu turno".
- **Como funciona:** `Card variant="feature"` com `<h2>` "Solicitações" (Satoshi 700/18 px). Com abertas: o contador `{openCount}` (Satoshi 900, `tabular-nums`, 76 px; 60 px em 2 colunas com área útil < 1240 px; 52 px no celular), ao lado "aberta"/"abertas" e o `Badge warning` com `TriangleAlert` "{n} paradas" (some sem paradas); com paradas, o `<h3>` "Paradas há mais tempo" (mono, caixa alta) e até 5 `OpenRequestItem`. Vazio: `UserAvatar` de 84 px (`avatarSrc`, quem está logado) e "Nenhuma solicitação aberta."; com `firstAccess`, a linha "Os pedidos da equipe aparecem aqui assim que alguém registrar o primeiro.". Rodapé: link `default` `pill` "Ver solicitações" com `ArrowRight` e 20px de padding (`cn(..., "px-5")`, como no protótipo) (`allHref`; o admin leva `?setor=`).
- **Usa:** `Card`, `Badge`, `UserAvatar`, `OpenRequestItem`, `staleCountLabel`, `buttonVariants`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 13). 2026-11-27 — visual novo do Início (Task 13): contador grande + selo de paradas no lugar da linha "{n abertas} · {m paradas}"; props novas `avatarSrc` e `firstAccess`. 2026-11-27 — Task 16 (pixel): título "Solicitações" com `leading-[normal]` (a linha de 28px empurrava o contador e a lista 4px para baixo); selo "{n} paradas" com `leading-[normal]` depois do `text-[12.5px]`. 2026-11-27 — Task 16 (D-V5, decisão do dono de 2026-11-27): as linhas das paradas usam `OpenRequestItem badgeIcons={false}` (selos só com texto, como no protótipo); o selo "{n} paradas" do contador mantém o `TriangleAlert`.

### RequestGroupSection
- **Status:** ✅ pronto (2026-11-25)
- **Local:** `src/components/solicitacoes/RequestGroupSection.tsx` (client-safe: sem `"use client"` próprio, usado dentro de componentes de cliente)
- **Propósito:** a seção de um status que o Quadro (`RequestColumn`) e a Lista (`RequestList`) compartilham (P48).
- **Como funciona:** `<section aria-labelledby>` (o id vem de `useId()`: sem `visao` o Quadro e a Lista estão os dois no DOM) com `className` dada pelo chamador; `<header>` com o ícone do status (`REQUEST_STATUS_STYLE`, decorativo), `<h2>` com o rótulo e, ao lado dele (fora do `<h2>`), o total do servidor (`tabular-nums`, com " solicitações" só para leitor de tela); nota opcional (`text-xs`); vazio "Nenhuma solicitação."; `<ul>` com o que `renderRow(row)` devolve (o chamador devolve o `<li>` já com `key`); `LoadMoreButton` só com `moreHref`.
- **Usa:** `LoadMoreButton`, `REQUEST_STATUS_STYLE`, `REQUEST_STATUS_LABEL`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 1, P48), extraído de `RequestColumn` e do `ListGroup` de `RequestList`.

### Dashboard — `src/components/dashboard/*` e `src/components/kokonutui/*` (Fase 5)

Gráficos e blocos do dashboard. Os componentes de gráfico são Client Components que recebem só números e strings já agregados no servidor (nunca somam, nunca buscam). A cor pertence à entidade (turno, situação) e nunca cicla: classes literais em `chartColors.ts`, medidas por `chartPalette.test.ts`. Número com `tabular-nums`; animação com `motion-reduce:`; tema claro e escuro.

### MetricCard
- **Status:** ✅ pronto (2026-11-25)
- **Local:** `src/components/kokonutui/metric-card.tsx` (`"use client"`; KokonutUI `metric-card` 2.0.0 adaptado)
- **Propósito:** o cartão de um item de controle: total do período, média por turno, variação contra o período anterior, detalhamento por turno e a linha diária (atual e anterior).
- **Como funciona:** props `label`, `unit`, `context` (setor, admin em "Todos os setores"), `periodDays`, `total`, `average`, `handoverCount`, `delta`, `segments` (um por turno, todos com `href`), `series` (2N dias; cada ponto traz o `total` do dia e as `parts` por turno), `href`. O número grande e a legenda `{n} passagens` são `Link` para a lista que o total conta; `handoverCount` 0 mostra "Sem passagens no período", sem gráfico. A variação é neutra (ícone `ArrowUp`/`ArrowDown`/`Minus` e texto de `deltaText`, sem verde nem vermelho). A escala vai de 0 ao maior valor desenhado, rotulada com a unidade. O `slider` lê um dia por vez (setas, Home, End, Escape; `aria-valuetext` `dd/mm/aaaa: n unidade`) e o botão "Voltar ao período" volta à leitura do período. Com 2 ou mais segmentos aparece "Por turno": barra de participação, uma linha por turno (cor fixa, total como `Link`, `sharePercent`) e o botão "Mostrar só {turno}" / "Mostrar todos os turnos" (`aria-pressed`); em foco o número e a variação são do turno (`segment.total` e `previousTotal` vindos do SQL), a linha usa a cor do turno e **nenhuma classe de swatch muda**. Nada é somado no cliente.
- **Adaptações do original:** só tokens (`border-border bg-card`, `stroke-foreground`, `stroke-muted-foreground/50` tracejado…); pt-BR e unidade; export nomeado; período por prop e sem pílulas, sem dados de demonstração, sem Shift/intervalo; escala a partir de 0 (saiu o `mínimo × 0,85`); vazio; `clipId` com `useId().replace(/[^a-zA-Z0-9_-]/g, "")`; `motion-reduce` no `RollingNumber`, nas barras e no morph em JS; alvos `max-md:min-h-11`; resumo `sr-only` e `<output>` anunciando só a troca de foco.
- **Usa:** `Link`, `computeDelta`/`deltaText`/`deltaAriaLabel`, `sharePercent`, `formatInteger`/`formatDecimal`, `formatDateBR`, `pluralize`, `cn`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 10); `bun scripts/rc-check.mjs` com `compiled: 4` e nenhum `CompileError`. 2026-11-27 — Task 15 (legibilidade): turno em foco e hovers com `bg-accent` (eram `bg-muted`, igual ao card na paleta nova).

### SpendingRing
- **Status:** ✅ pronto (2026-11-25)
- **Local:** `src/components/kokonutui/spending-ring.tsx` (`"use client"`; KokonutUI `spending-ring` 1.0.0 adaptado; exporta também `ringSpans`)
- **Propósito:** o anel de parte-do-todo das Passagens (4 fatias: confirmadas, aguardando recebimento, não confirmadas, sem passagem).
- **Como funciona:** props `title`, `legendLabel`, `total` (do SQL; o anel não soma as fatias), `totalHref` (obrigatório: o total do cabeçalho, e o `0` do vazio, são um `Link` com nome `{n} passagens: ver a lista`), `slices` (`key`, `label`, `value`, `href`, `strokeClass`, `dotClass`, `icon?`), `emptyText`. `ringSpans` (pura) desenha só as fatias com valor, com sweep mínimo de 3° e soma de 360° menos os vãos. O anel é um `slider` (setas, Home, End, arrastar, tocar na fatia; `aria-valuetext` `{rótulo}: {n} ({p}%)`) e o centro mostra o valor, o rótulo e `{p}% do total` da fatia selecionada. A legenda é uma `<ul aria-label={legendLabel}>` com um `Link` por fatia (todas, inclusive as zeradas): ponto, ícone, rótulo, valor e porcentagem; foco ou passagem do mouse numa linha seleciona a fatia. `total` 0 mostra `emptyText` no lugar do anel e mantém a legenda.
- **Adaptações do original:** só tokens; pt-BR, sem moeda; export nomeado; `legendLabel` e links; vazio e fatia minúscula (sem arco invertido); `motion-reduce:transition-none`; linhas da legenda `max-md:min-h-11`; `touch-none` só no anel. **React Compiler:** o original o fazia desistir em silêncio; corrigido com `turnTo(restAt?)` (padrão resolvido no corpo), `tickRef` (o `tick` se reagenda por ref), `ringSpans` com `reduce` (sem `let` reatribuído) e `transform` inicial calculado dos `spans`; `bun scripts/rc-check.mjs` com `compiled: 3`.
- **Usa:** `Link`, `sharePercent`, `formatInteger`, `cn`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 10). 2026-11-26 — Fase 6 (Tarefa 7, P12): o total do cabeçalho (`TOTAL_LINK`) ganha `max-md:min-w-11 max-md:justify-end` (um número curto como `1` ou `0` media 9x44 no celular). 2026-11-27 — Task 15 (legibilidade): linha selecionada da legenda com `bg-accent` e hover `bg-accent/60` (eram `bg-muted`, igual ao card na paleta nova).

### chartColors
- **Status:** ✅ pronto (2026-11-25)
- **Local:** `src/components/dashboard/chartColors.ts` (server-safe e client-safe)
- **Propósito:** a única fonte das classes de cor dos gráficos, lida pelo guarda de paleta.
- **Como funciona:** `SHIFT_SWATCHES`/`SHIFT_STROKES` (turno nos slots 1 a 4 = `chart-1..4`), `OTHERS_SWATCH`/`OTHERS_STROKE` (turno do 5º em diante = `foreground`, sem número agregado "Outros turnos"), `segmentSwatch(slot)`/`segmentStroke(slot)`, `SITUATION_CHART` (o `-foreground` do selo de cada situação e `muted-foreground` para "sem passagem"), `SINGLE_SERIES_COLOR` (`var(--foreground)`) e `SINGLE_BAR_CLASS`. Classes literais (o Tailwind só gera o que aparece escrito inteiro). Nunca `chart-5` ou acima.
- **Usa:** os tokens de `globals.css`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 10).

### usePrefersReducedMotion
- **Status:** ✅ pronto (2026-11-25)
- **Local:** `src/components/dashboard/usePrefersReducedMotion.ts` (`"use client"`)
- **Propósito:** saber se a pessoa pediu menos movimento, para desligar animação em JS (o recharts).
- **Como funciona:** `useSyncExternalStore` sobre `matchMedia("(prefers-reduced-motion: reduce)")`; acompanha a mudança sem recarregar; o snapshot do servidor é `false`.
- **Usa:** `matchMedia`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 10).

### StockTrendChart
- **Status:** ✅ pronto (2026-11-25)
- **Local:** `src/components/dashboard/StockTrendChart.tsx` (`"use client"`)
- **Propósito:** a evolução da contagem de um item de estoque no período, numa linha.
- **Como funciona:** props `label`, `unit`, `points` (um por dia; dia sem contagem = `quantity: null`, a linha liga os pontos). `ChartContainer` com altura `h-48`, `LineChart accessibilityLayer`, série única em `var(--foreground)`, eixo X `dd/mm`, eixo Y inteiro, tooltip `{n} {unidade}` em `tabular-nums` com a data `dd/mm/aaaa`, `isAnimationActive` desligado com movimento reduzido. Uma `<table className="sr-only">` (legenda `{label} por dia`, colunas `Dia` e `Contagem ({unidade})`, `sem contagem`) traz o número exato de cada dia. Sem nenhuma contagem no período mostra "Sem contagem no período." no lugar do gráfico.
- **Usa:** `Chart` (`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`), `usePrefersReducedMotion`, `chartColors`, `formatDateBR`, `formatInteger`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 10).

### StatLink
- **Status:** ✅ pronto (2026-11-25)
- **Local:** `src/components/dashboard/StatLink.tsx` (server-safe)
- **Propósito:** um número do dashboard que é sempre um link para a lista que conta exatamente aquilo (D-F5-3).
- **Como funciona:** props `label`, `value`, `href`, `icon` (ícone do lucide, decorativo) e `caption` opcional. `<Link>` com `min-h-11`, número em `text-3xl tabular-nums` (`formatInteger`), ícone + rótulo e legenda em `text-xs`. O nome acessível é número + rótulo + legenda ("19 Esperadas turnos já encerrados"); zero é escrito, nunca vazio. Ícone e texto, nunca só cor.
- **Usa:** `Link`, tokens `card`, `accent`, `ring`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 11). 2026-11-27 — PR B (P83): hover em `bg-accent` (era `bg-muted`, igual ao card).

### BarList
- **Status:** ✅ pronto (2026-11-25)
- **Local:** `src/components/dashboard/BarList.tsx` (server-safe)
- **Propósito:** linhas com o valor escrito ao lado e, opcionalmente, uma barra proporcional: o tempo até a entrega por destino (com barras) e a quantidade pedida por item (só números, porque as unidades diferem).
- **Como funciona:** `<ul aria-label>` com um `<Link>` por linha (`min-h-11`): rótulo (+ contexto, o setor, em "Todos os setores"), `valueText` em `tabular-nums` e `detail`. Com `bars`, a barra tem `width = barPercent(value, max)%` (`max` = maior valor mostrado; valor maior que zero nunca some, piso de 2%) e a cor `SINGLE_BAR_CLASS` (`bg-foreground`); a barra é decorativa, o número escrito é a escala. Sem linhas mostra `emptyText`; `moreText` ("Mostrando 8 de 11 destinos.") fica abaixo da lista.
- **Usa:** `Link`, `barPercent`, `chartColors`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 11). 2026-11-27 — Task 15 (legibilidade): trilho da barra com `bg-accent` (o `bg-muted` é igual ao card na paleta nova e o trilho sumia). 2026-11-27 — PR B (P83): hover da linha em `bg-accent` (era `bg-muted`).

### DashboardBlockSkeleton
- **Status:** ✅ pronto (2026-11-25)
- **Local:** `src/components/dashboard/DashboardBlockSkeleton.tsx` (server-safe; exporta também `DashboardSkeleton`)
- **Propósito:** o que aparece enquanto um bloco (ou a página inteira) carrega: carregando é esqueleto, nunca zero.
- **Como funciona:** `DashboardBlockSkeleton({ title })` é uma `<section aria-busy="true" aria-label={title}>` com o `<h2>` do bloco já visível e três `Skeleton`; nenhum dígito. `DashboardSkeleton()` é o fallback da página: título, rótulo do período, o seletor e os quatro blocos.
- **Usa:** `Skeleton`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 11).

### DashboardBlockBoundary
- **Status:** ✅ pronto (2026-11-25)
- **Local:** `src/components/dashboard/DashboardBlockBoundary.tsx` (`"use client"`)
- **Propósito:** um bloco que quebra não derruba os outros.
- **Como funciona:** `DashboardBlockBoundary = catchError(DashboardBlockError)` (`next/error`). O fallback mostra o `<h2>` do bloco, "Não foi possível carregar este bloco." num `Alert` e o botão "Tentar de novo" (`retry()`, que busca o bloco de novo sem perder o estado de fora). O `catchError` só limpa o erro quando muda o **pathname**; como `?periodo=` e `?setor=` não mudam o pathname, quem usa passa uma `key` (título + href do período e do setor) **no limite**, para trocar o período remontar o limite e a `<Suspense>` dele. Roda no jsdom (só lê contextos que valem `null` fora do App Router).
- **Usa:** `catchError`, `Alert`, `Button`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 11).

### DashboardPassages
- **Status:** ✅ pronto (2026-11-25)
- **Local:** `src/components/dashboard/DashboardPassages.tsx` (Server Component assíncrono)
- **Propósito:** o bloco Passagens: esperadas, entregues, confirmadas, aguardando recebimento, não confirmadas e sem passagem, e o anel das 4 situações.
- **Como funciona:** `getPassagesData` (uma consulta sobre a mesma fonte da lista de `/passagens`) com o escopo e o `now` por prop. Seis `StatLink` numa `<ul aria-label="Números das passagens">` (cada um leva a `/passagens?…&situacao=<esperadas|entregues|confirmada|aguardando|nao-confirmada|sem-passagem>` com o período e o `setor` do admin) e o `SpendingRing` com as quatro fatias na ordem fixa da entidade (cores `SITUATION_CHART`, ícone do selo `SITUATION_STYLE`, total = `listed` do SQL, link para `passagesListHref(período, "all")`). Sem turno encerrado nem passagem no período mostra o `EmptyState` "Nenhum turno encerrado no período.".
- **Usa:** `StatLink`, `SpendingRing`, `SITUATION_STYLE`, `SITUATION_CHART`, `EmptyState`, `passagesListHref`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 11).

### DashboardControls
- **Status:** ✅ pronto (2026-11-25)
- **Local:** `src/components/dashboard/DashboardControls.tsx` (Server Component assíncrono)
- **Propósito:** o bloco Controles: um `MetricCard` por item de controle.
- **Como funciona:** `getControlsData` (agregado no SQL). Um cartão por item (`key` = item + período), com o total, a média por turno, `computeDelta(total, previousTotal)`, um segmento por turno (cor `segmentSwatch`/`segmentStroke` pelo slot; todos com link, inclusive o turno inativo) e a série de 2N dias. Links (C-1): total e legenda `{n} passagens` = `/passagens?…&situacao=entregues&item=<id>`, cada segmento + `turno=<id>`; em "Todos os setores" o `setor` é o do item, nunca `todos`. Sem item mostra o `EmptyState` (o admin ganha "Ir para Itens"); acima de 30 mostra "Mostrando 30 de {total} itens.".
- **Usa:** `MetricCard`, `chartColors`, `passagesListHref`, `computeDelta`, `EmptyState`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 11).

### DashboardStock
- **Status:** ✅ pronto (2026-11-25)
- **Local:** `src/components/dashboard/DashboardStock.tsx` (Server Component assíncrono)
- **Propósito:** o bloco Estoque: a última contagem de cada item e a evolução no período.
- **Como funciona:** `getStockData`. Um `Card` por item: nome, unidade (e setor em "Todos os setores"), a última contagem como link para a passagem (`/passagens/<id>`, "{n} {unidade}") com "Contado em {dd/mm/aaaa}, {turno}" (+ " · antes do período") ou "Sem contagem"; a evolução é sempre o `StockTrendChart`, que mostra "Sem contagem no período." quando nenhum dia tem contagem (o bloco não repete o texto). Sem item mostra o `EmptyState`; acima de 30 mostra "Mostrando 30 de {total} itens.".
- **Usa:** `Card`, `StockTrendChart`, `lastCountHref`, `EmptyState`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 11). 2026-11-26 — Fase 6 (Tarefa 7, P12): o link da última contagem ganha `max-md:inline-flex max-md:min-h-11 max-md:items-center` (era 80x32 no celular).

### DashboardRequests
- **Status:** ✅ pronto (2026-11-25)
- **Local:** `src/components/dashboard/DashboardRequests.tsx` (Server Component assíncrono)
- **Propósito:** o bloco Solicitações: abertas e paradas agora, entregues no período, tempo até a entrega por destino e quantidade pedida por item.
- **Como funciona:** `getRequestsData`. Três `StatLink` (links da Tabela de `/solicitacoes`), o `BarList` com barras do tempo médio por destino (top 8, "Outro" é um destino, link `destino=`) e o `BarList` sem barras da quantidade pedida (`{n} {unidade}` · `em {n} solicitações`, link `status=nao-canceladas&item=`). **Sem anel** (desvio registrado da spec §8, C-2): itens têm unidades diferentes e somar ou fatiar rolos com peças mentiria.
- **Usa:** `StatLink`, `BarList`, `formatDuration`, `links` do dashboard.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 11).

### DashboardScreen
- **Status:** ✅ pronto (2026-11-25)
- **Local:** `src/components/dashboard/DashboardScreen.tsx` (Server Component assíncrono, dentro do `<Suspense>` da página)
- **Propósito:** a tela `/dashboard`: título, período, exportar, setor, seletor de período e os quatro blocos.
- **Como funciona:** `requireUser()` na primeira instrução, depois `await searchParams`, `now = new Date()` e `resolveDashboardScope` (a mesma resolução do CSV). Admin sem setor ativo e operador de setor inativo têm o estado vazio próprio. Com escopo: `<h1>Dashboard</h1>`, o rótulo do período (`formatPeriodLabel`, ex. "últimos 7 dias · 14–20 nov"), `ExportCsvLink` com os mesmos período e setor da tela, `SectorPicker` (só admin: `path="/dashboard"`, `allowAll`, `query` com o período, para trocar de setor manter o período), `DashboardPeriodPicker` e os quatro blocos na ordem Passagens, Controles, Estoque, Solicitações. Cada bloco fica num `DashboardBlockBoundary` com `key` = título + `buildDashboardHref(período, setor)` e, dentro dele, a `<Suspense>` com o `DashboardBlockSkeleton`: um bloco quebrado não derruba os outros e trocar o período ou o setor remonta limite e `<Suspense>`. O operador nunca recebe o `?setor=` de outro setor.
- **Usa:** `resolveDashboardScope`, `SectorPicker`, `DashboardPeriodPicker`, `ExportCsvLink`, `DashboardBlockBoundary`, `DashboardBlockSkeleton`, os quatro blocos, `EmptyState`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 12).

### DashboardPeriodPicker
- **Status:** ✅ pronto (2026-11-25)
- **Local:** `src/components/dashboard/DashboardPeriodPicker.tsx` (`"use client"`)
- **Propósito:** trocar o período do dashboard: últimos 7 dias, últimos 30 dias ou um intervalo de até 93 dias.
- **Como funciona:** `<nav aria-label="Período">` com dois `<Link className={buttonVariants(...)}>` (o do período ativo é `default` e tem `aria-current="page"`) e o botão "Intervalo", um disclosure (`aria-expanded`, `aria-controls` do formulário, sem `aria-pressed`). O formulário "Intervalo do período" começa com as datas atuais (nunca em branco; aberto de início quando o período ativo é um intervalo) e dois `<input type="date">` com `max` em hoje e `text-base`. "Aplicar intervalo" valida com `validateRangeInput` **antes** de navegar: o erro aparece no campo (`FieldError`, `aria-invalid`) e nada navega; ok → `router.push(buildDashboardHref(...))` levando o `setor` do admin. Nunca volta em silêncio para outro período (o servidor continua corrigindo o que chegar, por defesa).
- **Usa:** `Button`, `buttonVariants`, `Field`, `Input`, `validateRangeInput`, `buildDashboardHref`, `dashboardPresetHref`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 12); `bun scripts/rc-check.mjs` com `compiled: 1` e nenhum `CompileError`.

### ExportCsvLink
- **Status:** ✅ pronto (2026-11-25)
- **Local:** `src/components/dashboard/ExportCsvLink.tsx` (server-safe)
- **Propósito:** baixar as passagens do período em CSV.
- **Como funciona:** um `<a href download>` comum com `buttonVariants({ variant: "outline" })` (`max-md:h-11` vem do botão), ícone `Download` decorativo e o texto "Exportar CSV" (o rótulo nomeia o resultado). Nunca `next/link`: o link não navega nem faz prefetch, baixa o arquivo do Route Handler `GET /api/dashboard/export`.
- **Usa:** `buttonVariants`, `lucide-react`.
- **Histórico:** 2026-11-25 — criado na Fase 5 (Tarefa 12).

## 3. Componentes de domínio — `src/features/<domínio>/components`

*(nenhum ainda)*
