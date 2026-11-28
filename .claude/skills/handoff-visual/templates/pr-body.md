## Resumo

Visual novo de **`<slug>`**, a partir do handoff do Claude Design (spec
`docs/superpowers/specs/<data>-visual-<slug>-design.md`, plano `docs/superpowers/plans/<data>-visual-<slug>.md`),
sobre a `main` em `<base>`.

```text
<caminho>   # o que mudou ali, numa linha
```

## Decisões

- **`<decisão>`** (dono | controlador): `<o que e por quê>`.

## Desvios da spec

- `<desvio>`: `<por quê; onde está registrado>`.

## Pixel perfect

Contra o protótipo renderizado, com `pixelmatch` (threshold 0.1) e as máscaras do que depende do agora.

| Par | 1440 | `<terceira>` | 390 |
|---|---:|---:|---:|
| `<estado>` | `<antes → depois>` | | |

Resíduos aceitos: `<anti-aliasing, lucide, truncamento>`.

## Plano de teste

- [x] `bun run check-types` e `bun run lint`
- [x] Vitest em partes: `<arquivos · testes>`
- [x] `bun run test:e2e`: `<N passed>`
- [x] `bun run build`
- [x] `bun run visual:names --range=main...HEAD`: 0
- [x] Legibilidade: `<telas e capturas>`, `<correções>`
- [ ] CI verde no PR

## Pendências

- Fechadas: `<Pnn>`. Com `Atualização`: `<Pnn>`. Novas: `<Pnn a Pmm>`.

## Merge

`<migração? ordem de deploy? o que o dono confere>`. O merge é do dono, com o CI verde.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
