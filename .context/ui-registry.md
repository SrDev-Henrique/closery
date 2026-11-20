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

Adicionados pelo CLI (`bunx shadcn@latest add <nome>`), em kebab-case.

### Button
- **Status:** ✅ pronto (scaffold, 2026-11-20)
- **Local:** `src/components/ui/button.tsx`
- **Propósito:** toda ação clicável.
- **Como funciona:** `@base-ui/react/button` + `cva`. Variantes `default`, `outline`, `secondary`,
  `ghost`, `destructive`, `link`; tamanhos `default`, `xs`, `sm`, `lg` (h-9), `icon`, `icon-xs`,
  `icon-sm`, `icon-lg`. Composição com `render`, não `asChild`.
- **Atenção:** os tamanhos gerados (`default`, `xs`, `sm`, `icon`) ficam abaixo do mínimo do
  `ui-rules.md §1.4` (h-9+, 44px no celular) — ajuste pendente (P3 em `pendencias.md`).
- **Usa:** tokens `primary`, `border`, `muted`, `ring`, `destructive`.
- **Histórico:** 2026-11-20 — gerado pelo `shadcn init` (sem alteração).

## 2. Componentes de aplicação — `src/components/<área>`

*(nenhum ainda)*

## 3. Componentes de domínio — `src/features/<domínio>/components`

*(nenhum ainda)*
