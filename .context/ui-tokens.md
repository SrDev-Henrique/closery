# UI Tokens — Closery

> **Documento vivo + lei do design.** Toda cor, raio, tipografia e espaçamento sai daqui.
> **Proibido** hex ou classe de cor crua (`bg-[#...]`, `text-emerald-500`) em qualquer componente.
> Se um valor não existe como token, **adicione o token** — não burle.
> Fonte de verdade dos valores: `src/app/globals.css`.

---

## 1. Direção visual · 🟢 definido (D14, 2026-11-20)

**Tokens padrão do shadcn** — preset `base-nova`, base **neutral** (cinzas OKLCH, claro e
escuro), como o `shadcn init` gerou. Sem cor de assinatura própria e sem herdar a paleta do
klauve; do klauve vem só a **anatomia** das telas (`ui-rules.md §6`). Mudar o padrão exige nova
decisão registrada no `build-plan.md §5`.

**Exceção (D16):** os tokens que o shadcn padrão não tem vêm do klauve
(`klauve/packages/ui/src/styles/globals.css`) — `chart-1..4`, `success`, `warning`, `info` e os
`-foreground` deles, claro e escuro. Os hex são copiados como estão, **não** ajustados a olho.

Restrições que valem mesmo com o padrão:
- **Legível em ambiente operacional:** contraste alto, nada de cinza-claro sobre branco para
  informação que importa; uso provável no celular, em área de carga, com pressa.
- **Cor carrega significado, não decoração:** status (ok / atenção / problema) e entidades do
  dashboard têm cor fixa; o resto é neutro.
- **Marca de terceiros** (logo/cores da LATAM) só com autorização — ver `pendencias.md`.

## 2. Cores (tokens existentes)

Semânticos do shadcn, definidos em `:root` (claro) e `.dark` (escuro) no `globals.css`:

| Token | Uso |
|---|---|
| `background` / `foreground` | canvas e texto principal |
| `card` / `card-foreground` | superfícies de conteúdo |
| `popover` / `popover-foreground` | menus, popovers |
| `primary` / `primary-foreground` | ação principal |
| `secondary` / `secondary-foreground` | ação secundária |
| `muted` / `muted-foreground` | fundo discreto, texto auxiliar |
| `accent` / `accent-foreground` | hover, realce |
| `destructive` | erro, ação destrutiva |
| `border` / `input` / `ring` | bordas, campos, foco |
| `chart-1..4` | séries de gráfico — **vêm do klauve** (D16); a ordem é a ordem de uso. Máx. 4 séries |
| `chart-5` | cinza do shadcn — só para "Outros", nunca série com identidade |
| `sidebar-*` | navegação lateral |

**A adicionar com a primeira tela que usar (D16, valores do klauve):** `success` / `success-foreground`,
`warning` / `warning-foreground`, `info` / `info-foreground` — claro e escuro, expostos no
`@theme inline`. Uso: estados de solicitação e de passagem, sempre com ícone + texto junto.

| Token | Claro | Escuro |
|---|---|---|
| `chart-1` | `#8d3e0f` | `#c3550c` |
| `chart-2` | `#2c8faf` | `#56badd` |
| `chart-3` | `#7235a6` | `#836b9f` |
| `chart-4` | `#738c57` | `#95b278` |
| `success` / `-foreground` | `#d3eedd` / `#1f5131` | `#1d3526` / `#75d799` |
| `warning` / `-foreground` | `#f5e0bc` / `#6a451b` | `#372d1b` / `#e4bb67` |
| `info` / `-foreground` | `#cbe4f6` / `#1d4a72` | `#1b2a37` / `#74b1e7` |

A validação da série `chart-1..4` no klauve foi medida contra as superfícies **do klauve**; aqui as
superfícies são as do shadcn neutral (P9).

## 3. Raio

Base `--radius: 0.625rem`; escala `rounded-sm` … `rounded-4xl` derivada dela. Superfícies nunca
com canto reto.

## 4. Tipografia

- **Geist** (sans) via `next/font` → `--font-sans`; **Geist Mono** → `--font-geist-mono`.
- Corpo `text-sm`+ (nunca `text-xs` para conteúdo); campos de digitação `text-base` (16px).
- Números de contagem e do dashboard com `tabular-nums`.

## 5. Como usar

✅ `bg-background`, `text-foreground`, `bg-muted`, `text-muted-foreground`, `bg-card`,
`border-border`, `bg-primary text-primary-foreground`, `rounded-lg`, `ring-ring`.

❌ `bg-[#F5F5F6]`, `text-zinc-500`, `bg-green-500`, `border-gray-200`, `shadow-[...]` cru,
`z-[...]` arbitrário.

🔁 **Faltou um token?** Adicione no `globals.css` (claro **e** escuro), exponha no
`@theme inline` e documente aqui.
