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
- **Como funciona:** `@base-ui/react/button` + `cva`. Variantes `default`, `outline`, `secondary`,
  `ghost`, `destructive`, `link`; tamanhos `default`, `xs`, `sm`, `lg` (h-11), `icon`, `icon-xs`,
  `icon-sm`, `icon-lg`. Composição com `render`, não `asChild`.
- **Atenção:** todo tamanho tem h-9 / size-9 no desktop e `max-md:h-11` / `max-md:size-11` no
  celular (`lg` e `icon-lg` são 44px sempre). Teste: `button.test.ts`. Para navegação use
  `<Link className={buttonVariants()}>` (continua role link); `render={<Link />}` (com
  `nativeButton={false}`) vira role=button e só serve quando o papel de botão é o desejado.
- **Usa:** tokens `primary`, `border`, `muted`, `ring`, `destructive`.
- **Histórico:** 2026-11-20 — gerado pelo `shadcn init` (sem alteração). 2026-11-20 — P3: alvos de
  toque (h-9 desktop, 44px no celular). 2026-11-21 — Fase 2: `shadcn add dialog` sobrescreve o arquivo; restaurado com `git checkout` (F2-24).

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
- **Usa:** `Label`, `Separator`; tokens `destructive`, `muted-foreground`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

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
  `CardContent`, `CardFooter`; HTML puro.
- **Usa:** tokens `card`, `card-foreground`, `border`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

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
  após navegar. Breakpoint do celular: 768px (igual ao `md`). O primeiro render é sempre desktop
  (`useIsMobile` começa `false`). Exige `TooltipProvider` acima. Ler `cookies()` para
  `defaultOpen` exigiria `Suspense`; use `defaultOpen` fixo.
- **Usa:** `Button`, `Input`, `Separator`, `Sheet`, `Skeleton`, `Tooltip`; tokens `sidebar-*`.
- **Histórico:** 2026-11-20 — `shadcn add`; `SidebarMenuButton` default sobe de h-8 para
  `h-9 max-md:h-11` (P3); textos acessíveis em pt-BR ("Alternar menu", gaveta "Menu").

### Sheet
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/sheet.tsx`
- **Propósito:** painel que desliza da borda (gaveta de navegação no celular, painéis laterais).
- **Como funciona:** `@base-ui/react/dialog`; `side` = `top|right|bottom|left`; `SheetHeader`,
  `SheetTitle`, `SheetDescription`, `SheetFooter`, `SheetClose`. O botão de fechar usa
  `Button size="icon-sm"` (44px no celular).
- **Usa:** `Button`; tokens `background`, `border`.
- **Histórico:** 2026-11-20 — `shadcn add`; o `sr-only` do botão de fechar passa a "Fechar".

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
  `sonner`. Lê o tema via `next-themes` (sem `ThemeProvider` cai em `system`).
- **Usa:** tokens `popover`, `border`.
- **Histórico:** 2026-11-20 — `shadcn add` (traz `sonner` e `next-themes`).

### Avatar
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/ui/avatar.tsx`
- **Propósito:** foto ou iniciais de uma pessoa.
- **Como funciona:** `Avatar`, `AvatarImage`, `AvatarFallback`, `AvatarGroup`, `AvatarBadge`;
  `size` = `default|sm|lg`.
- **Usa:** `@base-ui/react/avatar`; tokens `muted`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

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
- **Como funciona:** `div` pulsante; dê o tamanho por `className`.
- **Usa:** token `muted`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

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
- **Como funciona:** variantes `default`, `secondary`, `destructive`, `outline`, `ghost`, `link`;
  aceita `render`.
- **Usa:** tokens `primary`, `secondary`, `destructive`.
- **Histórico:** 2026-11-20 — `shadcn add`, sem alteração.

### Toggle / ToggleGroup
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/ui/toggle.tsx`, `src/components/ui/toggle-group.tsx`
- **Propósito:** controle segmentado para um conjunto pequeno e fechado de respostas (papel, tipo do item).
- **Como funciona:** `@base-ui/react/toggle-group`; `ToggleGroup` (`variant`, `size`, `spacing`) + `ToggleGroupItem`; o item marcado tem `aria-pressed="true"`. No uso do projeto: `variant="outline"`, `size="lg"`. Clicar no item já marcado **desmarca** (lista vazia em `onValueChange`): quem precisa de "nunca vazio" usa o `ChoiceGroup`.
- **Atenção:** todo tamanho tem `h-9` / `min-w-9` no desktop e `max-md:h-11` / `max-md:min-w-11` no celular. Teste: `touchTargets.test.tsx`.
- **Usa:** tokens `muted`, `input`, `ring`.
- **Histórico:** 2026-11-21 — `shadcn add toggle-group` (traz `toggle`); alturas `h-8`/`h-7` viram `h-9 max-md:h-11` (P3).

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
- **Usa:** `Button`; tokens `popover`, `muted`.
- **Histórico:** 2026-11-21 — `shadcn add dialog`; os dois "Close" viram "Fechar" (P12). O CLI sobrescreve `button.tsx` (pergunta mesmo com `--yes`): rode com `--overwrite` e depois `git checkout -- src/components/ui/button.tsx` (F2-24).

### Table (TableHeader, TableBody, TableRow, TableHead, TableCell, TableCaption…)
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/ui/table.tsx`
- **Propósito:** a primeira tabela do projeto: a visão Tabela das solicitações (dado que se compara em colunas).
- **Como funciona:** adicionado pelo CLI (`bunx shadcn@latest add table --yes`); o contêiner `data-slot="table-container"` tem `overflow-x-auto`, então a tabela rola na horizontal sozinha e a página nunca rola. Ajustes depois do CLI: sem `"use client"` (é server-safe) e formatação do Biome. Quem usa põe `text-right tabular-nums` nas colunas numéricas e `TableCaption className="sr-only"` com o nome da tabela.
- **Usa:** tokens `border`, `muted`, `foreground`.
- **Histórico:** 2026-11-24 — `shadcn add table` na Fase 4 (Tarefa 11).

## 2. Componentes de aplicação — `src/components/<área>`

### AppSidebar
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/AppSidebar.tsx` (itens em `navItems.ts`)
- **Propósito:** navegação lateral do app autenticado: Início, Conta e, só para admin, Administração.
- **Como funciona:** `"use client"`; recebe `isAdmin`, `userName`, `userEmail`. Item ativo por
  `usePathname` (`/` só na raiz exata; os demais valem para a rota e subrotas) com `isActive` +
  `aria-current="page"`. Cada item é `SidebarMenuButton render={<Link />}`; ao navegar fecha a
  gaveta do celular (`setOpenMobile(false)`). Rodapé com nome e e-mail truncados. O Início fica
  atrás de `<Suspense>` no layout (o `usePathname` suspende em rota dinâmica).
- **Usa:** `Sidebar*`, `lucide-react`; tokens `sidebar-*`.
- **Histórico:** 2026-11-20 — criado na Fase 1.

### AuthedSidebar
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/AuthedSidebar.tsx`
- **Propósito:** liga a sessão ao menu.
- **Como funciona:** Server Component assíncrono; `requireUser()` e devolve `<AppSidebar />`.
  Sempre dentro de `<Suspense fallback={<SidebarSkeleton />}>` no layout `(app)`.
- **Usa:** `AppSidebar`, `requireUser`.
- **Histórico:** 2026-11-20 — criado na Fase 1. 2026-11-20 — o `RequireUser` (portão no layout) foi tentado e removido na re-revisão: o Next não deixa o layout controlar a página; o portão é `requireUser`/`requireAdmin` em cada página, guardado por `appPagesAuth.test.ts`.

### SidebarSkeleton
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/SidebarSkeleton.tsx`
- **Propósito:** reserva o espaço da barra lateral enquanto a sessão carrega.
- **Como funciona:** só no desktop (`hidden md:flex`), `aria-hidden`, largura `--sidebar-width`.
- **Usa:** `Skeleton`; token `sidebar`.
- **Histórico:** 2026-11-20 — criado na Fase 1.

### MenuToggle
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/MenuToggle.tsx`
- **Propósito:** botão do cabeçalho que abre e fecha a barra lateral.
- **Como funciona:** `"use client"`; `SidebarTrigger` (só ícone) dentro de `TooltipTrigger render`,
  com `aria-label` e tooltip "Alternar menu". Testado com `fireEvent.pointerEnter/mouseEnter`.
- **Usa:** `SidebarTrigger`, `Tooltip*`.
- **Histórico:** 2026-11-20 — criado na Fase 1.

### Greeting
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/Greeting.tsx`
- **Propósito:** título "Olá, {primeiro nome}" e texto do Início.
- **Como funciona:** Server Component assíncrono (`requireUser`); usa `greetingTitle` de
  `src/lib/names.ts`. Dentro de `<Suspense>` na página.
- **Usa:** `requireUser`, `greetingTitle`.
- **Histórico:** 2026-11-20 — criado na Fase 1 (substitui o texto provisório do scaffold). 2026-11-21 — Fase 3: o segundo parágrafo passa a "Em breve: solicitações e dashboard." (a passagem deixou de ser "em breve"); a página `/` ganha os cartões de `HomeHandovers`. 2026-11-24 — Fase 4 (Tarefa 13): o segundo parágrafo passa a "Em breve: dashboard." (as solicitações chegaram) e o esqueleto de `/` ganha o terceiro cartão.

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
  `bg-muted/50`). O título fica dentro do `<Suspense>` para o operador não ver "Administração"
  antes do 404, e a página não exporta `metadata` (o `<title>` revelaria a rota; T12); enquanto
  carrega, `page.tsx` mostra um esqueleto (título e cinco cartões).
- **Usa:** `requireAdmin`, `getAdminOverviewCounts`, `pluralize`, `Card*`, `next/link`.
- **Histórico:** 2026-11-20 — criado na Fase 1 (placeholder). 2026-11-21 — Fase 2: cartões dos cinco cadastros e contagens.

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
- **Histórico:** 2026-11-20 — criado na Fase 1.

### SignInPanel
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/auth/SignInPanel.tsx`
- **Propósito:** tela de entrada (e-mail e senha, passkey, social).
- **Como funciona:** `"use client"`; autofill condicional de passkey no mount (silencioso, não
  trava botões); botão "Entrar com passkey"; social com `requestSignUp: false`; erro inicial de
  `?error=`; erros por `authFormError(errorCodeOf(erro))`/`passkeyErrorCode`. O formulário vem primeiro porque o
  autofill de passkey vive no campo de e-mail.
- **Usa:** `Card*`, `Field*`, `Input`, `Button`, `SocialButtons`.
- **Histórico:** 2026-11-20 — criado na Fase 1.

### PasskeyOffer
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/auth/PasskeyOffer.tsx`
- **Propósito:** oferta de passkey em `/bem-vindo`.
- **Como funciona:** `"use client"`; "Criar passkey" (toast "Passkey criada." e vai para `/`);
  "Agora não" é `<Link className={buttonVariants()}>` (role link); erros por
  `passkeyErrorCode(…, "register")` + `authFormError`.
- **Usa:** `Card*`, `Button`, `buttonVariants`, `FieldError`, `sonner`.
- **Histórico:** 2026-11-20 — criado na Fase 1.

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
- **Como funciona:** `<Badge variant="secondary">Inativo</Badge>`; sempre texto, nunca só cor.
- **Usa:** `Badge`.
- **Histórico:** 2026-11-21 — criado na Fase 2.

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
- **Histórico:** 2026-11-21 — criado na Fase 2.

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
- **Histórico:** 2026-11-21 — criado na Fase 2. Exceção documentada a "nunca em branco" (F2-9): o nome é a identidade do registro.

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
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 6).

### SectorCreateForm
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/sectors/SectorCreateForm.tsx`
- **Propósito:** criar setor ("Criar setor").
- **Como funciona:** `"use client"`; `NameForm` (entity "setor", nome começa vazio por ser a identidade do registro) → `createSectorAction`; toast "Setor criado."; erro de nome repetido inline (com o aviso "Ele está inativo: reative-o na lista." quando for o caso).
- **Usa:** `NameForm`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 6).

### SectorRowActions
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/sectors/SectorRowActions.tsx`
- **Propósito:** ações da linha de um setor: "Editar" e "Desativar"/"Reativar".
- **Como funciona:** `"use client"`; `EditDialog` "Editar setor" com `NameForm` ("Salvar alterações", toast "Alterações salvas.", fecha ao salvar) e `ActiveToggleButton` → `setSectorActiveAction`. Desativar setor com pessoas ativas ou convites pendentes volta `SECTOR_IN_USE` e a mensagem com as contagens aparece em toast.
- **Usa:** `EditDialog`, `NameForm`, `ActiveToggleButton`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 6).

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
- **Como funciona:** Server Component async; chama `requireAdmin()` e lê `listPeople` (`?pagina=`), `listPendingInvites` (`?convites=`) e `listActiveSectors`. Ordem na tela: `InviteForm`, "Convites pendentes" (só válidos, com `PendingInviteActions`) e "Pessoas". A própria conta mostra o selo "Você" e o texto de ajuda, **sem botões**; pessoa inativa fica esmaecida (`InactiveBadge`) com "Reativar"; setor inativo aparece como "(inativo)"; duas `Pagination` independentes (cada uma preserva o parâmetro da outra); estados vazios.
- **Usa:** `AdminPageHeader`, `AdminListRow`, `EmptyState`, `Pagination`, `Badge`, `InviteForm`, `PendingInviteActions`, `PersonRowActions`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 9, só Pessoas); Tarefa 10 acrescenta convites.

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
- **Propósito:** ações de uma linha de pessoa: editar, desativar (com confirmação) e reativar.
- **Como funciona:** `"use client"`; `EditDialog` "Editar pessoa" com `PersonForm`; "Desativar" abre `ConfirmDialog` (texto: perde o acesso agora, sessões encerradas, histórico continua) e mostra a recusa do servidor dentro do diálogo; "Reativar" age direto e leva o erro para o toast. `aria-label` com o nome da pessoa em todos os botões.
- **Usa:** `EditDialog`, `ConfirmDialog`, `PersonForm`, `useAdminAction`, `Button`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 9).

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
- **Usa:** `Button`, `Input`, `sonner`, `formatDateTimeBR`.
- **Histórico:** 2026-11-21 — criado na Fase 2 (Tarefa 10). 2026-11-24 — Fase 4 (Tarefa 3, P29): foco no título ao montar.

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
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/SectorPicker.tsx`
- **Propósito:** o admin escolher o setor no Início, na Nova passagem e no Histórico (D-F3-3).
- **Como funciona:** `"use client"`; `<fieldset>` com legenda "Setor" (só para leitor de tela) e um `Button` por setor ativo (selecionado = `variant="default"` e `aria-pressed`); com `allowAll`, o último botão é "Todos os setores" (`todos`). Clicar chama `chooseSectorAction({ sectorId, path })` dentro de `useTransition`, que grava o cookie `closery_setor` e faz `redirect` para `{path}?setor={id}`; o redirect chega como exceção e segue adiante (`unstable_rethrow`). Falha da action ou exceção de rede = `toast.error`. Clicar no setor já selecionado não faz nada. O `SectorSwitcher` (links) do admin continua separado.
- **Usa:** `Button`, `FieldSet`, `FieldLegend`, `chooseSectorAction`, `sonner`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 7).

### HandoverStatusBadge
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HandoverStatusBadge.tsx`
- **Propósito:** mostrar a situação da passagem (aguardando, confirmada, não confirmada, sem passagem) e o selo "Corrigida".
- **Como funciona:** Server-safe. `Badge` com ícone e texto: `awaiting` (`Clock`, `bg-info`), `confirmed` (`CircleCheck`, `bg-success`; com `confirmedByName` diz "Confirmada por {nome}"), `unconfirmed` (`TriangleAlert`, `bg-warning`), `missing` (`CircleSlash`, `bg-muted`). `corrected` acrescenta `Badge variant="outline"` com `PencilLine` e "Corrigida". Textos vêm de `situationLabel` e `CORRECTED_LABEL`.
- **Usa:** `Badge`, tokens `info`, `success`, `warning`, `muted`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 7).

### PendingHandoverCard
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/PendingHandoverCard.tsx`
- **Propósito:** cartão do topo do Início "Passagem para confirmar".
- **Como funciona:** Server-safe. Mostra `{turno} · {dd/mm/aaaa}`, "Entregue às {HH:mm} por {nome}", o bloco "Fica para o próximo turno" em destaque (trecho do texto ou "Nada registrado para o próximo turno.") e o link-botão "Ver passagem" (`/passagens/{id}`). Não confirma aqui: a confirmação é no resumo.
- **Usa:** `Card`, `buttonVariants`, `formatDateBR`, `formatTimeBR`, `handoverHref`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 7).

### MyShiftCard
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/MyShiftCard.tsx`
- **Propósito:** cartão "Passagem do meu turno" do Início, nos cinco estados.
- **Como funciona:** Server-safe. Mostra `{turno} · {início}–{fim} · {data}` (horário com `tabular-nums`) e "Turno sugerido pelo horário de agora.". `start` → "Começar passagem"; `continue` → "Rascunho salvo às {HH:mm} por {nome}" + "Continuar passagem"; `delivered` → "Entregue às … Aguardando recebimento." + "Ver passagem"; `confirmed` → "Entregue por … Confirmada por …" + "Ver passagem"; `no-shifts` → "Nenhum turno neste setor." (admin: link "Ir para Turnos"). Todos, menos `no-shifts`, trazem o link "Ver todas as passagens". Admin leva `&setor=` no link de começar.
- **Usa:** `Card`, `buttonVariants`, `newHandoverHref`, `handoverHref`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 7).

### HomeHandovers
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HomeHandovers.tsx`
- **Propósito:** os cartões de passagem do Início.
- **Como funciona:** Server Component assíncrono, dentro de `<Suspense>` (lê sessão, `searchParams` e o cookie). Operador: setor próprio. Admin: `resolveHandoverSector` (URL → cookie → primeiro ativo) e `SectorPicker`; sem setor ativo, estado vazio com link para Setores. Setor inativo do operador: "Seu setor está inativo.". Ordem: `PendingHandoverCard` (se houver) e `MyShiftCard`. Depois deles vem o `RequestsHomeCard` (Fase 4: `getHomeRequests` com o mesmo `now` do `getHomeHandovers`; o link "Ver solicitações" leva `?setor=` para o admin). Setor inativo e admin sem setor ativo: só o estado vazio, sem o cartão.
- **Usa:** `getHomeHandovers`, `resolveHandoverSector`, `readRememberedSector`, `EmptyState`, `SectorPicker`. Também: `getHomeRequests`, `RequestsHomeCard`, `requestsHref`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 7). 2026-11-24 — Fase 4 (Tarefa 13): cartão de solicitações depois de "Passagem do meu turno".

### QuantityCounter
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/QuantityCounter.tsx`
- **Propósito:** contagem inteira de `min` (padrão 0) a 99.999 com −/+ e digitação (ui-rules §2.2: número nunca em branco).
- **Como funciona:** `"use client"`, controlado (`value`, `onChange`, `onCommit`). `<fieldset>` com legenda do item (só para leitor de tela); botão − (`aria-label` `Diminuir {item}`, tooltip "Diminuir", trava em 0), campo (`inputMode="numeric"`, `maxLength={5}`, `text-base tabular-nums text-center`, `aria-label` `Quantidade de {item}`, seleciona tudo ao receber foco) e botão + (`Aumentar {item}`, tooltip "Aumentar", trava no teto). Só dígitos; zeros à esquerda somem. O campo pode ficar vazio só no buffer enquanto se digita: ao sair vira 0 e chama `onChange(0)` e `onCommit(0)`. −/+ chamam `onChange` e `onCommit`. Alvos `size-9 max-md:size-11` (campo `h-9 max-md:h-11`). A unidade fica em texto ao lado.
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
- **Como funciona:** Server Component assíncrono, dentro de `<Suspense>`. `requireUser()`; operador usa o próprio setor, admin escolhe (`resolveHandoverSector` + `SectorPicker`). Turno e data vêm de `resolveHandoverTarget` (URL válida ou sugestão pelo horário). **GET nunca escreve**: o rascunho nasce no primeiro salvamento. Combinação já entregue ou confirmada redireciona para o resumo. Estados vazios: sem setor ativo, setor inativo, sem turnos (admin: link "Ir para Turnos"). No rascunho (`mode: "draft"`) lê as abertas de agora (`listOpenRequests`) e as escolhas do formulário (`getRequestFormChoices`) e passa ao `HandoverForm` a seção `OpenRequestsNowSection` com o `NewRequestDialog` (`originRef` = a tripla setor + turno + dia da tela, `sectors={null}`, `triggerVariant="outline"`); o rascunho só nasce se a pessoa criar a solicitação (escrita iniciada por ela, nunca pelo GET).
- **Usa:** `getHandoverFormState`, `listActiveShifts`, `resolveHandoverTarget`, `HandoverForm`, `SectorPicker`, `EmptyState`. Também: `listOpenRequests`, `getRequestFormChoices`, `OpenRequestsNowSection`, `NewRequestDialog`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 8). 2026-11-24 — Fase 4 (Tarefa 13): seção "Solicitações abertas" no formulário do rascunho.

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
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 9). 2026-11-21 — Fase 3 (Tarefa 11): `?editar=1` troca o resumo pelo formulário quando a pessoa pode editar (título "Corrigir passagem"): `HandoverForm` em modo `edit` para a entregue (quem entregou e admin, salvamento automático) e `CorrectionForm` para a confirmada (só admin); quem não pode cai no resumo. 2026-11-24 — Fase 4 (Tarefa 3, P37): setor inativo é só leitura, com `ReadOnlySectorNotice`. 2026-11-24 — Fase 4 (Tarefa 13): seção "Solicitações abertas" (as abertas na entrega) logo depois de "Fica para o próximo turno".

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
- **Como funciona:** chama `requireUser()`, interpreta os filtros da URL (`parseHistoryFilters`, dia de hoje em São Paulo) e lê `listHandoverHistory` (50 por página, `?pagina=` clampada). Operador usa o próprio setor e nunca vê o seletor; admin vê o `SectorPicker` com "Todos os setores" (que não grava cookie) e o setor vem de `?setor=`, do cookie ou do primeiro ativo. Ordem na tela: título, seletor (admin), `HistoryFilters`, "Período: dd/mm/aaaa a dd/mm/aaaa", lista de `HistoryRowItem` (ou o estado vazio "Nenhuma passagem neste período.") e `Pagination` com os filtros e o setor preservados. Setor inativo (operador) ou nenhum setor ativo (admin) mostram `EmptyState`.
- **Usa:** `HistoryFilters`, `HistoryRowItem`, `SectorPicker`, `EmptyState`, `Pagination`, `listHandoverHistory`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 10).

### HistoryFilters
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/passagens/HistoryFilters.tsx`
- **Propósito:** filtros do histórico (período, turno, situação) que vivem na URL.
- **Como funciona:** `"use client"`; formulário controlado que nunca começa em branco (os valores vêm da URL já interpretada: 7 dias, todos os turnos, todas as situações). `SelectField` "Período" (Últimos 7 dias, Últimos 30 dias, Intervalo), "Turno" (só quando há turnos do setor: some em "Todos os setores"), "Situação" e, no Intervalo, `De` e `Até` (`type="date"`, já preenchidos com o período atual). "Aplicar filtros" navega com `router.push(buildHistoryHref(…))` (volta à página 1 e preserva o setor do admin); "Limpar filtros" é um `<Link>` para `/passagens` (preserva só `?setor=`).
- **Usa:** `SelectField`, `Field`, `Input`, `Button`, `buttonVariants`, `buildHistoryHref`.
- **Histórico:** 2026-11-21 — criado na Fase 3 (Tarefa 10).

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

Selos, formulário de criação, quadro, lista, tabela e detalhe das solicitações. Status sempre com ícone e texto (a cor pertence ao status e nunca é ciclada); ação que muda status usa a cor do status de destino.

### statusStyle
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/statusStyle.ts` (server-safe)
- **Propósito:** o ícone e as classes de cor de cada status de solicitação, num lugar só.
- **Como funciona:** `REQUEST_STATUS_STYLE[status]` devolve `{ icon, badgeClass, buttonClass }`. Solicitada `CircleDot` + `bg-info text-info-foreground`; Em separação / Trânsito `Truck` + `bg-warning text-warning-foreground`; Entregue `CircleCheck` + `bg-success text-success-foreground`; Cancelada `CircleX` + `bg-muted text-muted-foreground`. `buttonClass` = `badgeClass` + `border-transparent hover:bg-{token}/80`: é a cor do botão "Mover para {status}" (o de cancelar usa `variant="destructive"`). Classes sempre inteiras no texto, para o Tailwind enxergá-las.
- **Usa:** tokens `info`, `warning`, `success`, `muted`; ícones do lucide.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 10).

### RequestStatusBadge
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestStatusBadge.tsx` (server-safe)
- **Propósito:** selo do status da solicitação (cartão, linha, tabela, detalhe, passagem).
- **Como funciona:** `<Badge variant="secondary" className="h-6 …">` com o ícone (`aria-hidden`) e o rótulo (`Solicitada`, `Em separação / Trânsito`, `Entregue`, `Cancelada`) do `REQUEST_STATUS_STYLE`. Nunca só cor.
- **Usa:** `Badge`, `statusStyle`, `REQUEST_STATUS_LABEL`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 10).

### StaleBadge
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/StaleBadge.tsx` (server-safe)
- **Propósito:** selo "Parada há N dias" das solicitações abertas há mais de 72 h no mesmo status.
- **Como funciona:** `<Badge variant="secondary" className="h-6 bg-warning text-warning-foreground">` com `ClockAlert` (`aria-hidden`) e `staleLabel(days)` (`Parada há 1 dia`, `Parada há 5 dias`). Quem decide se a solicitação está parada é o SQL (`stale`); o selo só mostra.
- **Usa:** `Badge`, `staleLabel`, token `warning`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 10).

### RequestForm
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestForm.tsx`
- **Propósito:** formulário de nova solicitação, o MESMO na tela de solicitações e na passagem.
- **Como funciona:** `"use client"`, controlado, nunca começa em branco: `Destino` (`SelectField` com os destinos ativos e `Outro` por último) já vem no destino mais usado do setor (sem destinos ativos, em `Outro`); `Outro` revela `Qual destino?` (`maxLength` 80, `text-base`); `Descrição` (`Textarea`, 500, obrigatória); grupo `Itens` (opcional): `Adicionar item` acrescenta o primeiro item de estoque ainda não escolhido com quantidade 1, cada linha tem `<select>` "Item" (só as opções que ninguém escolheu, mais a própria), `QuantityCounter` com `min={1}` e `Remover {item}` (ícone `Trash2`, tooltip "Remover item"); sem itens de estoque, o texto "Nenhum item de estoque neste setor.". `Setor` só aparece para o admin em "Todos os setores" (`sectors` não nulo); trocar o setor limpa os itens e mantém o destino. Valida com `createRequestSchema` antes da action (erro vai para o campo, a action não é chamada); `useAdminAction` com `showError: false` e toast "Solicitação criada."; erro do servidor vai para o campo de `fieldErrors` e, sem campo (ex.: passagem confirmada), para um `FieldError` no pé; nada do digitado se perde. Botões `Criar solicitação` (pendente `Criando…`) e `Voltar`.
- **Usa:** `SelectField`, `QuantityCounter`, `Field*`, `Input`, `Textarea`, `NativeSelect`, `Button`, `Tooltip`, `useAdminAction`, `createRequestAction`, `createRequestSchema`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 10).

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
- **Como funciona:** server component async (dentro do `<Suspense>` da página). Lê a sessão, os filtros da URL (`parseRequestFilters`) e o setor (admin: `SectorPicker` com "Todos os setores"; operador: o próprio, nunca o seletor). `?criador=` e `?destino=` (uuid) fora das escolhas viram "todos" antes da consulta. Sem `visao` renderiza o Quadro (`hidden md:block`) e a Lista (`md:hidden`) com os mesmos dados e dois `RequestViewSwitcher` (um por largura, para o `aria-current` dizer a verdade). O subtítulo vem do servidor (`boardSummary`/`tableSummary`). Vazio novo × vazio filtrado; operador de setor inativo e admin sem setor ativo têm estado vazio próprio.
- **Usa:** `RequestFiltersForm`, `RequestViewSwitcher`, `RequestBoard`, `RequestList`, `RequestTable`, `NewRequestDialog`, `SectorPicker`, `EmptyState`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 11).

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
- **Propósito:** busca, destino, período e quem criou, na URL.
- **Como funciona:** `"use client"`, controlado, valores iniciais da URL (nunca em branco); `key` = a URL dos filtros. "Aplicar filtros" monta a URL (`buildRequestsHref(resetPaging(...))`, mantém visão e setor); "Limpar filtros" é um `<Link>`. Escolhas, não texto: destinos (inativo marcado "(inativo)" e "Outro"), pessoas, períodos; "De"/"Até" só em "Intervalo". Busca `type="search"`, `text-base`, 80 caracteres.
- **Usa:** `SelectField`, `Input`, `Field`, `Button`, `buttonVariants`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 11).

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
- **Como funciona:** `<section aria-labelledby>` com o id de `useId()` (sem `visao` o Quadro e a Lista estão os dois no DOM); contagem `tabular-nums` com "solicitações" só para leitor de tela; vazio "Nenhuma solicitação."; nota opcional.
- **Usa:** `RequestCard`, `LoadMoreButton`, `REQUEST_STATUS_STYLE`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 11).

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
- **Como funciona:** `"use client"`; mesmo `useRequestMove` do Quadro; uma `<section>` por status (id de `useId()` em um componente interno); vazio "Nenhuma solicitação."; nota "Últimos 30 dias" em Entregue e Cancelada só sem período; "Carregar mais" por grupo.
- **Usa:** `RequestListRow`, `LoadMoreButton`, `useRequestMove`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 11).

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
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 11).

### RequestDetail
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestDetail.tsx`
- **Propósito:** o detalhe da solicitação: a página completa `/solicitacoes/[id]` e o conteúdo do Sheet do detalhe rápido.
- **Como funciona:** server component async, `variant="page" | "sheet"`. `page`: título `<h1>` "Solicitação para {destino}", seções `h2`, link "Ver todas as solicitações", `notFound()` para id malformado, inexistente ou de outro setor. `sheet`: título pelo `SheetTitle`, seções `h3`, link `<a href>` "Abrir página completa" (navegação de documento: uma navegação no cliente para a mesma URL seria interceptada de novo), e o estado "Solicitação não encontrada." dentro do Sheet (um `notFound()` no slot derrubaria a tela). Mostra o aviso `ReadOnlySectorNotice` em setor inativo, propriedades (`<dl>`: status e selo de parada, setor só para o admin, destino, quem criou, origem com link para a passagem), itens com quantidade e unidade, "Mudar status" (só com `canMove`), linha do tempo e comentários; "Ver comentários anteriores" é sempre `<a href>` e some no teto de 500.
- **Usa:** `getRequestDetail`, `RequestStatusBadge`, `StaleBadge`, `RequestStatusActions`, `RequestTimeline`, `RequestComments`, `ReadOnlySectorNotice`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 12).

### RequestSheet
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/RequestSheet.tsx`
- **Propósito:** o Sheet do detalhe rápido (rota interceptada `@detalhe/(.)solicitacoes/[id]`).
- **Como funciona:** `"use client"`. `open` é constante: o slot só existe enquanto a URL é a do detalhe, e estado local não reabriria sob a Activity. Fechar (Escape, fundo ou o botão com texto "Fechar") chama `router.back()` uma vez só: a trava `closing` (um `ref` liberado no efeito de montagem) impede dois `back()` antes de a navegação terminar. O X só com ícone do primitivo fica desligado (`showCloseButton={false}`): o botão "Fechar" tem texto.
- **Usa:** `Sheet`, `SheetContent`, `SheetClose`, `Button`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 12).

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
- **Como funciona:** `"use client"`; `moveTargets(status)` (Cancelada reabre para qualquer um); todos os botões ficam desativados enquanto um movimento está em voo. Sucesso: toast "“{prévia}” movida para {status}."; falha: toast de erro nomeando a solicitação e `router.refresh()` em `STATUS_CONFLICT`, `NO_CHANGES` e `NOT_FOUND`.
- **Usa:** `MoveStatusButton`, `CancelRequestDialog`, `useAdminAction`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 12).

### CancelRequestDialog
- **Status:** ✅ pronto (2026-11-24)
- **Local:** `src/components/solicitacoes/CancelRequestDialog.tsx`
- **Propósito:** cancelar a solicitação com motivo obrigatório (≤ 500 caracteres).
- **Como funciona:** `"use client"`; `Dialog` com `Textarea` "Motivo do cancelamento"; valida com `cancelRequestSchema` antes da action (erro no campo, sem chamar o servidor); "Voltar" fecha; o motivo não volta na próxima abertura. Só fecha sozinho no sucesso (toast "Solicitação cancelada."); `fieldErrors.reason` fica no campo, `STATUS_CONFLICT`/`NO_CHANGES`/`NOT_FOUND` viram toast + fecha + `router.refresh()` (o botão de cancelar some depois do refresh), qualquer outra falha fica no pé do diálogo, aberto, com o texto.
- **Usa:** `Dialog`, `Textarea`, `Field*`, `useAdminAction`, `cancelRequestSchema`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 12).

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
- **Como funciona:** `<li>` com a prévia da descrição (`requestPreview`: 1ª linha, até 60 pontos de código) num `<Link href={requestHref(id)} scroll={false}>` (abre o detalhe rápido no Sheet), "Para {destino}", `RequestStatusBadge` e, se parada, `StaleBadge`. Com `statusNow` diferente do status mostra "Agora: {status}" (só o resumo da entrega passa a prop). O link tem alvo ≥ 44px no celular.
- **Usa:** `RequestStatusBadge`, `StaleBadge`, `requestPreview`, `requestHref`, `REQUEST_STATUS_LABEL`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 13).

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
- **Como funciona:** `Card` com `<h2>` "Solicitações"; linha "{n abertas} · {m paradas}" (`tabular-nums`, singular em 1) ou "Nenhuma solicitação aberta."; havendo paradas, o rótulo `<h3>` "Paradas há mais tempo" e até 5 `OpenRequestItem` (as mais antigas no status); link-botão "Ver solicitações" (`allHref`; o admin leva `?setor=`).
- **Usa:** `Card`, `OpenRequestItem`, `openCountLabel`, `staleCountLabel`, `buttonVariants`.
- **Histórico:** 2026-11-24 — criado na Fase 4 (Tarefa 13).

## 3. Componentes de domínio — `src/features/<domínio>/components`

*(nenhum ainda)*
