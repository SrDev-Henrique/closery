# Closery

[![CI](https://github.com/SrDev-Henrique/closery/actions/workflows/ci.yml/badge.svg)](https://github.com/SrDev-Henrique/closery/actions/workflows/ci.yml)

Passagem de turno simples, detalhada e rastreável para a operação de carga aérea (setor ULD).
Substitui a planilha de passagem e alimenta um dashboard de quantidades e solicitações.

**Antes de mexer no código, leia o [`AGENTS.md`](./AGENTS.md)** — ele lista os documentos de
contexto em `.context/` e as regras do projeto.

## Stack

Next.js 16 (App Router) · React 19 · shadcn/ui (Base UI) · Tailwind CSS 4 · Neon (Postgres) ·
Drizzle ORM · Biome · Bun

## Rodando localmente

```bash
bun install
cp .env.example .env.local   # preencha com as connection strings do Neon
bun run db:migrate           # aplica as migrações
bun run dev                  # http://localhost:3000
```

## Scripts

| Script | O que faz |
|---|---|
| `bun run dev` | servidor de desenvolvimento |
| `bun run build` | build de produção |
| `bun run check-types` | type-check (tsc) |
| `bun run lint` | Biome (verifica) |
| `bun run format` | Biome (formata) |
| `bun run db:generate` | gera migração a partir do schema |
| `bun run db:migrate` | aplica migrações |
| `bun run db:studio` | inspeciona o banco |
