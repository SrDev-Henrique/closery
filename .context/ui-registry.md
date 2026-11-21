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
- **Histórico:** 2026-11-20 — criado na Fase 1 (substitui o texto provisório do scaffold).

### AdminOverview
- **Status:** ✅ pronto (2026-11-20)
- **Local:** `src/components/app-shell/AdminOverview.tsx`
- **Propósito:** conteúdo provisório de `/admin` e portão de acesso.
- **Como funciona:** Server Component assíncrono; `requireAdmin()` (operador cai em `notFound()`).
  O título fica dentro do `<Suspense>` para o operador não ver "Administração" antes do 404, e a
  página não exporta `metadata` (o `<title>` revelaria a rota; T12).
- **Usa:** `requireAdmin`.
- **Histórico:** 2026-11-20 — criado na Fase 1.

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
- **Status:** ✅ pronto (2026-11-21)
- **Local:** `src/components/admin/Pagination.tsx` (server-safe)
- **Propósito:** paginação das listas (toda lista é paginada).
- **Como funciona:** `<nav aria-label="Paginação">` com "Anterior", "Página {n} de {m}" (`tabular-nums`) e "Próxima"; `param` (padrão `pagina`; `convites` na Equipe) e `params` preservam os demais parâmetros da URL via `buildPageHref`; página 1 remove o parâmetro. Na borda o botão é um `<span aria-disabled="true">` (não é link). Com `pageCount <= 1` renderiza `null`.
- **Usa:** `buttonVariants`, `buildPageHref`, `next/link`.
- **Histórico:** 2026-11-21 — criado na Fase 2.

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

## 3. Componentes de domínio — `src/features/<domínio>/components`

*(nenhum ainda)*
