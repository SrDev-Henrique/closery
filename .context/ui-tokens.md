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
| `success` / `success-foreground` | estado ok (item conferido, solicitação atendida) — sempre com ícone + texto |
| `warning` / `warning-foreground` | atenção (pendente, em andamento) — sempre com ícone + texto |
| `info` / `info-foreground` | informação neutra (solicitação aberta) — sempre com ícone + texto |
| `border` / `input` / `ring` | bordas, campos, foco |
| `chart-1..4` | séries de gráfico — **vêm do klauve** (D16); a ordem é a ordem de uso. Máx. 4 séries |
| `chart-5` | cinza do shadcn — só para "Outros", nunca série com identidade |
| `sidebar-*` | navegação lateral |

**Existem desde 2026-11-20 (D16, valores do klauve; P4 resolvida):** `chart-1..4`, `success`,
`warning`, `info` e os `-foreground`, claro e escuro, expostos no `@theme inline`
(`bg-success text-success-foreground`). Uso: estados de solicitação e de passagem, sempre com
ícone + texto junto.

| Token | Claro | Escuro |
|---|---|---|
| `chart-1` | `#8d3e0f` | `#c3550c` |
| `chart-2` | `#2c8faf` | `#56badd` |
| `chart-3` | `#7235a6` | `#836b9f` |
| `chart-4` | `#738c57` | `#95b278` |
| `success` / `-foreground` | `#d3eedd` / `#1f5131` | `#1d3526` / `#75d799` |
| `warning` / `-foreground` | `#f5e0bc` / `#6a451b` | `#372d1b` / `#e4bb67` |
| `info` / `-foreground` | `#cbe4f6` / `#1d4a72` | `#1b2a37` / `#74b1e7` |

**Guarda de paleta (P9, resolvida 2026-11-20):** `src/app/chartPalette.test.ts` lê o `globals.css`
(hex e `oklch`) e reprova, nos dois temas, série fora da banda de lightness OKLCH 0,43–0,77, croma
< 0,06, contraste < 3:1 sobre `--card`, ΔE2000 < 15 entre qualquer par (visão normal, deuteranopia,
protanopia, tritanopia) e `-foreground` de status < 4,5:1 sobre o fundo do par. Medido contra os
cards do shadcn neutral (`oklch(1 0 0)` claro, `oklch(0.205 0 0)` escuro):

| | Claro | Escuro |
|---|---|---|
| contraste `chart-1..4` sobre o card | 7,42 · 3,71 · 7,57 · 3,74 | 3,95 · 8,07 · 3,90 · 7,61 |
| ΔE2000 mínimo (normal / deuter. / protan. / tritan.) | 34,5 / 17,6 / 23,2 / 17,7 | 35,6 / 17,5 / 22,4 / 17,6 |
| `success` / `warning` / `info` (`-foreground` sobre o fundo) | 7,48 · 6,56 · 7,02 | 7,51 · 7,47 · 6,41 |

Mudou um valor de cor? Rode `bun run test -- src/app/chartPalette.test.ts`; piso que reprova se
corrige no token, nunca no teste. `VITEST_PRINT_PALETTE=1` imprime a matriz.

**Fora da série:** `chart-5` (cinza do shadcn, "Outros") **não** é medido pelo guarda. No tema
escuro ele tem 1,19:1 sobre o card — some. Antes de qualquer gráfico usar uma fatia "Outros",
escolher e medir um neutro que passe 3:1 sobre o card e ΔE ≥ 15 da série.

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
