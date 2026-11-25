# Code Standards — Closery

> **Documento vivo + lei de engenharia.** Como escrevemos código aqui. Vale junto com
> `architecture.md` (estrutura), `ui-rules.md`/`ui-tokens.md` (UI) e `library-docs.md`
> (bibliotecas). Adaptado do klauve para um projeto menor: um app Next.js só, sem monorepo e sem
> API separada.

---

## 1. Mindset (pense antes de construir)

1. **Reuso antes de criar.** Procure o que já existe (função, componente, padrão). Não duplique —
   estenda. Na UI, consulte o `ui-registry.md` primeiro.
2. **Unidades pequenas e isoladas.** Cada arquivo/função tem um propósito, interface clara e
   dependências explícitas. Arquivo grande é sinal de que faz coisas demais.
3. **YAGNI.** Resolva o problema de hoje. O sistema tem que ser **mais rápido que a planilha**.
4. **Type-safety ponta a ponta.** Drizzle → tipos inferidos → Zod nos limites → componentes. Sem
   redefinir tipo à mão.
5. **Autorização no servidor.** A UI esconde o que a pessoa não pode fazer; a regra real vive na
   Server Action / query.
6. **Validação nos limites.** Toda Server Action valida a entrada com Zod. Dado do client nunca é
   confiável — inclusive quem é o "usuário atual".
7. **Estados completos.** Carregando, vazio (que ensina o próximo passo) e erro (com recuperação).
   Falha de rede **nunca** perde o que a pessoa digitou numa passagem.
8. **Leia antes de escrever.** Next 16 diverge do conhecimento prévio — consulte
   `node_modules/next/dist/docs/` e o `library-docs.md`.

## 2. TypeScript

- **Strict sempre.** Sem `any` (use `unknown` + narrowing), sem `as` para calar erro, sem `!`
  non-null de conveniência — trate o caso.
- **Prefira inferência:** `typeof table.$inferSelect`, `z.infer<typeof schema>`.
- **Uniões discriminadas** para estados; `switch` exaustivo com `never` no default.
- Literais fixos com `as const`; evite `enum` (prefira união de literais).

## 3. Convenções Next.js

- **Server Components por padrão.** `"use client"` só para estado, efeitos, eventos e APIs do
  navegador — fronteira client a menor possível.
- **Escrita = Server Action** (`"use server"`) dentro de `src/features/<domínio>/actions.ts` (exceção: as de `/admin` ficam ao lado
  da página, ver `library-docs.md §12`).
  Toda action: valida com Zod → checa permissão → grava → `revalidatePath`/`revalidateTag` →
  devolve resultado tipado (`{ ok: true, ... } | { ok: false, error }`). Erro esperado (entrada
  inválida, sem permissão) volta como resultado; `throw` fica para falha interna de verdade.
- **Cache Components ligado** (`next.config.ts`): dado é **dinâmico por padrão**. Cache é opt-in
  com `"use cache"` + `cacheTag`/`cacheLife`. Acesso a dado dinâmico fica dentro de `<Suspense>`.
  Detalhes em `library-docs.md §1`.
- **Portão de autenticação.** Toda página ou folha do grupo `(app)` que mostra ou lê dados chama `requireUser`/`requireAdmin` dentro de `<Suspense>` (o layout não protege a página: o Next roda a página mesmo que o layout troque o conteúdo, e o layout não re-renderiza na navegação no cliente); `src/app/appPagesAuth.test.ts` reprova página sem a chamada; toda Server Action e todo route handler autoriza por conta própria (`requireUser`/`requireAdmin` ou `getAuthz`, e `scopeToSector`/`canAccessSector`), porque podem ser chamados de qualquer rota e `/api` não passa pelo proxy.
- Entry files de rota (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`) usam default export;
  o resto, named export.
- Código de banco só em módulo servidor — `src/db` importa `server-only`.

## 4. Nomeação de arquivos e pastas

| Item | Convenção | Exemplo |
|---|---|---|
| Pastas | `kebab-case` | `shift-handover/` |
| Componentes de aplicação | `PascalCase` | `HandoverForm.tsx` |
| Utilitários, queries, actions, schemas | `camelCase` | `formatDate.ts`, `handoverQueries.ts` |
| Primitivos shadcn (`components/ui`) | `kebab-case` (mantidos pelo CLI) | `button.tsx` |
| Entry files de rota | minúsculo fixo | `page.tsx` |

Componentes/tipos em `PascalCase`; funções/variáveis em `camelCase`; constantes globais em
`UPPER_SNAKE_CASE`; booleanos com `is/has/should`.

## 5. Estrutura de um componente

Ordem: `"use client"` (se precisar) → imports externos → imports internos (`@/…`) → tipos → o
componente. O Biome organiza os imports — não brigue com ele.

```tsx
"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ItemCounterProps = {
  label: string;
  defaultValue?: number;
};

export function ItemCounter({ label, defaultValue = 0 }: ItemCounterProps) {
  // ...
}
```

Lógica fora da UI: queries e regras em módulos próprios da feature; o componente cuida de
apresentação e interação.

## 6. Dados, estado e consistência

- **Estado de servidor** vem de Server Components; estado local com `useState`. Sem store global.
- **Formulários:** Server Action + `useActionState`; validação Zod no servidor (e no client só
  para feedback imediato, com o **mesmo** schema). Quando o servidor pode recusar e a pessoa não
  pode perder o que digitou (cadastros do admin), o formulário é **controlado** e chama a action
  com um objeto tipado (`library-docs.md §12`).
- **Toda lista é paginada** (limite com teto no servidor). Proibido `SELECT` sem limite em tabela
  que cresce (passagens, solicitações, comentários).
- **Agregação no SQL** (`count`, `sum`, `avg`, `GROUP BY`, janelas de data) — o dashboard nunca
  carrega linhas para somar em JS.
- **Índice** para toda FK e coluna de filtro nova, na mesma migração.
- **Sem N+1:** use join/`inArray`.
- **Escrita multi-statement roda em `db.transaction()`** (`library-docs.md §5`, D18).
- **Corrida é o caso normal** (dois turnos, duas abas): transição de estado com `UPDATE …
  WHERE status = 'esperado'` e conferência de linhas afetadas; unique constraint como guarda;
  reenvio idempotente (chave gerada no client) para não duplicar passagem.
- **Datas:** gravar em UTC (`timestamptz`); converter para `America/Sao_Paulo` só na borda e nos
  cálculos de "dia operacional" e janelas do dashboard.

## 7. Testes

Tudo que é construído ganha teste que roda no terminal e reporta pass/fail.

- **Vitest** — `bun run test` (= `vitest run`; `bun run test:watch` enquanto desenvolve). Project `node`
  (`*.test.ts`: domínio, schemas, queries de agregação, Server Actions, sempre com PGlite e as
  migrações reais) e project `dom` (`*.test.tsx`: Testing Library — comportamento e estados, não
  implementação). **Nunca `bun test`** (é o runner do Bun, não o Vitest). Se o Vitest acusar
  "Timeout waiting for worker to respond" com a máquina carregada, rode `bun run test -- --maxWorkers=4`.
- **PGlite não prova concorrência** (uma conexão, tudo serializado): a atomicidade vai no SQL
  (`UPDATE … RETURNING`) e o teste prova a invariante em sequência. Ver `library-docs.md §9`.
- **Playwright** — `bun run test:e2e`: sobe PGlite (pglite-socket) + `next build` + `next start`
  (cerca de 1 min) e cobre os fluxos críticos: acesso por convite, passkey, permissão por papel,
  cadastros, a passagem (entregar, receber/confirmar, corrigir com motivo e histórico) e as
  solicitações (Quadro com movimento otimista, detalhe em Sheet, cancelar com motivo e a ligação com a
  passagem) e o dashboard (o número abre a lista filtrada certa, o CSV baixa com BOM, o operador não vê outro setor). Rode antes de fechar
  qualquer fase que mexa em rota, login ou permissão. Ver `library-docs.md §10`.
- **Relógio:** função de domínio e função pura recebem `now: Date`; componente servidor que lê
  `new Date()` (`RequestsScreen`, `RequestDetail`, `NewHandover`, `HandoverDetail`, `HomeHandovers`, `DashboardScreen`) é testado com
  `vi.useFakeTimers({ toFake: ["Date"] })` + `vi.setSystemTime(spDate(…))`. Nenhum teste depende do dia em que roda;
  fixture de E2E usa datas relativas a `Date.now()` (`library-docs.md §9` e `§10`).
- **Número de painel se prova contra um oráculo independente** (JS sobre leitores crus do banco, regras escritas no teste) **e** contra a
  lista que o link abre (número = total da lista); nunca contra a mesma SQL que o painel roda (`library-docs.md §9` e `§15`).
- **Profundidade mínima por fluxo novo:** caminho feliz **+** entrada inválida **+** limites
  (vazio, `0`, máximo, texto longo/unicode, virada de dia no fuso) **+** permissão negada
  **+** corrida quando houver trava. **Teste que só cobre o caminho feliz não conta.**
- Ao terminar, **rode os testes e relate** o resultado real.

## 8. Estilo e ferramentas

- **Biome** é a lei de formatação e lint (espaços, aspas duplas, imports organizados).
  `bun run lint` limpo antes de considerar pronto; `bun run format` formata.
- **`bun run check-types`** limpo.
- **Tokens, não cor crua** (`ui-tokens.md`).
- **Comente o porquê, não o quê.** Sem código morto, sem `TODO` vago.
- **Refatoração muda estrutura, nunca comportamento:** testes verdes antes e depois; refactor e
  feature em commits separados.

## 9. Walkthrough didático por feature

Ao concluir cada feature, entregue no chat um walkthrough curto:

1. **O que foi construído e onde vivem as peças.**
2. **Decisões e trade-offs** (o que foi escolhido, o que foi descartado, por quê).
3. **Como debugar** (por onde entrar quando quebrar).
4. **O que entender antes de aprovar** (conceito ou padrão novo).

Meta: o desenvolvedor consegue explicar a feature sem abrir o código.

## 10. Definition of Done

- [ ] `bun run check-types` e `bun run lint` limpos; `bun run build` passa.
- [ ] Teste existe e passa, cobrindo erro + limites (§7) — não só o feliz.
- [ ] Reusa o que existe; unidades pequenas.
- [ ] Listas paginadas; agregação no SQL; índice para FK/filtro novo (§6).
- [ ] Escrita multi-statement atômica; ação concorrente com trava ou idempotência (§6).
- [ ] Zod nos limites; permissão checada no servidor.
- [ ] Estados carregando/vazio/erro tratados.
- [ ] Tokens (zero cor crua); fronteira `"use client"` mínima.
- [ ] Migração versionada gerada e revisada se o schema mudou.
- [ ] `progress-tracker.md`, `ui-registry.md` e `pendencias.md` atualizados.
- [ ] Walkthrough didático entregue (§9).
