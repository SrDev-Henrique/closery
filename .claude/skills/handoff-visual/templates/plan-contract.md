# Contrato do plano: visual de `<slug>` (`feat/visual-<slug>`, base `<base>`)

Você vai **redigir** tarefas de um plano de implementação, não implementar. O plano final junta os rascunhos de vários
redatores; por isso todos seguem **este contrato** (nomes, tipos, props, arquivos, comandos e ordem). Se um nome daqui
não servir, siga com o nome do contrato e registre o problema em "Dúvidas para o controlador" no seu rascunho.

## Fontes de verdade (leia antes)

- **Spec:** `docs/superpowers/specs/<data>-visual-<slug>-design.md`. **A spec manda.** As seções que cada tarefa
  implementa estão na tabela de tarefas.
- **Handoff** (fora do git): `.git/sdd/visual-<slug>/handoff/README.md`, o protótipo `.dc.html` (leia como TEXTO: CSS
  e marcação de referência) e as screenshots (escala reduzida; só para entender o visual). Os valores finos vêm do
  protótipo renderizado (`.git/sdd/visual-<slug>/ref/`) e das medidas da spec.
- **Roteiro e mapa** (fora do git): `.git/sdd/roadmap/roteiro.md` (§3, as peças compartilhadas) e
  `.git/sdd/visual-<slug>/mapa-atual.md`. Contexto, não fonte de nomes: os nomes são os deste contrato.
- **Regras:** `AGENTS.md` (no seu contexto), `.context/ui-rules.md`, `.context/ui-tokens.md`, `.context/ui-registry.md`,
  `.context/code-standards.md`, `.context/library-docs.md`, `.context/architecture.md`, `.context/pendencias.md`
  (cabeçalho "Como adicionar").
- **Next.js:** para qualquer API do Next, leia `node_modules/next/dist/docs/`.
- **O código atual:** leia CADA arquivo que a sua tarefa toca antes de escrever o passo que o muda.

## Proibições

- Pessoas e textos: só Ana, Bruno, Carla e Diego Teste e o vocabulário de `scripts/visual/vocabulary.mjs`. Nome de
  pessoa, e-mail ou texto operacional (descrição, frase, item, destino) do protótipo e das screenshots nunca entra no
  rascunho.
- Sem suíte inteira, build, E2E nem servidor (pouca memória). Pode rodar `git`, `grep`, `ls` e, para confirmar uma API,
  um teste de UM arquivo (`bunx vitest run <arquivo>`).
- O seu único arquivo de saída é o rascunho: nenhum arquivo do repositório muda.
- Porta 3000 nunca. Segredo e `.env.local` nunca impressos.
- Só tokens em `.tsx` (nenhum hex cru nem classe de cor crua do Tailwind).

## Global Constraints

As de `.git/sdd/visual-<slug>/global-constraints.md` (vão no cabeçalho do plano e em todo brief).

## Formato de cada tarefa (obrigatório)

````markdown
### Task N: <título curto>

**Spec:** §x.y · **Redator:** Rx · **Depende de:** Tn

**Files:**
- Create: `caminho/exato`
- Modify: `caminho/exato` (o que muda)
- Delete: `caminho/exato`
- Test: `caminho/exato.test.ts(x)`

**Interfaces:**
- Consumes: <nomes e assinaturas exatas de tarefas anteriores, deste contrato>
- Produces: <nomes e assinaturas exatas que tarefas seguintes usam, deste contrato>

- [ ] **Step 1: Escrever o teste que falha**

```ts
// código COMPLETO do teste
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `bunx vitest run caminho/arquivo.test.ts`
Expected: FAIL com "<mensagem>"

- [ ] **Step 3: Implementar**

```tsx
// código COMPLETO do arquivo (ou do trecho, com o contexto para achar o lugar exato)
```

- [ ] **Step 4: Rodar e ver passar**
...
- [ ] **Step N: Commit**

Mensagem gravada com Write em `.git/sdd/visual-<slug>/msg-task-N.txt`;
`git add <arquivos> && git commit -F .git/sdd/visual-<slug>/msg-task-N.txt`.
Mensagem: `<tipo>(<escopo>): <resumo em pt-BR>` + corpo curto + linha final
`Co-Authored-By: Claude <modelo> <noreply@anthropic.com>` (o `<modelo>` é o de quem implementar a tarefa; o
controlador o preenche no brief).
````

Regras do formato:
- Passos de 2 a 5 minutos. TDD: teste antes do código. **Código completo em todo passo que muda código** ("igual à
  tarefa X", "adicione validação", "TODO" e "TBD" não contam como código).
- Testes cobrem erro, limite (vazio, zero, máximo, nome longo, 5 setores) e permissão negada (`code-standards.md §7`),
  além do caminho feliz. Teste de componente segue o `*.test.tsx` vizinho.
- Foco, contraste e tamanho ganham prova por estilo computado (E2E ou `probe`), além do teste de classe.
- Cada tarefa lista os testes existentes que mudam (`grep -rl <nome> src test e2e`) e mostra a mudança.
- Componente visual novo ou mudado: entrada nova ou `Histórico` datado (<data>) no `ui-registry.md`, no mesmo commit.
- Arquivo com acento: a ferramenta Write.

## Tarefas, donos e dependências

As extrações de peça que já existe vêm primeiro, como tarefas `refactor` próprias, cada uma com os pares da tela dona
rerodados. Uma tarefa cria o estado do seed (`scripts/visual/seed/states/<slug>.ts`, registrado no `STATES` de
`scripts/visual/seed/states/index.ts`) e promove o rascunho `.git/sdd/visual-<slug>/screen.mjs` para
`scripts/visual/screens/<slug>.mjs` (skill, Etapa 3). As tarefas do controlador (C1 a C6, sem número de Task) ficam no
fim da tabela, na ordem da skill; a coluna "Depende de" diz em que ponto cada uma roda: o E2E completo com build roda
três vezes (depois das tarefas de fundação, na metade do plano e antes dos passes visuais), depois vêm o pixel, a
legibilidade e os documentos com o portão.

| # | Tarefa | Spec | Redator | Depende de | Commit |
|---|---|---|---|---|---|
| 1 | `<extração>` | §x | R1 | — | `refactor(<escopo>): …` |
| 2 | `<tarefa>` | §x | R1 | 1 | `feat(<escopo>): …` |
| C1 | E2E completo com build, depois da fundação (tokens, primitivos, layout) | §x | controlador | `<última tarefa de fundação>` | nenhum |
| C2 | E2E completo com build, na metade do plano | §x | controlador | `<tarefa da metade>` | nenhum |
| C3 | E2E completo com build, antes dos passes visuais | §x | controlador | `<N>` | nenhum |
| C4 | Pixel perfect (Etapa 5) | §x | controlador | C3 | `fix(visual): …` |
| C5 | Passe de legibilidade (Etapa 6) | §x | controlador | C4 | `fix(visual): …` por tela |
| C6 | Documentos e portão (Etapas 9 e 10) | §x | controlador | C5 | `docs: …` |

Rascunhos: R1 → `.git/sdd/visual-<slug>/draft-R1.md` (`<tarefas>`); R2 → `draft-R2.md` (`<tarefas>`).

## Interfaces (nomes exatos)

### Task `<N>` — `<título>`

- **`<caminho>`:**
  ```ts
  export function <Nome>(props: <Props>): <Retorno>;
  ```
- Props, tokens novos (`--<token>` e o utilitário `bg-<token>`), estados (`data-state`), textos de interface.
- Testes que a tarefa cria e os existentes que muda.

## Rascunho: o que entregar

Um arquivo markdown no caminho do seu pedido, com:
1. As tarefas no formato acima, completas, em ordem.
2. "Dúvidas para o controlador": conflitos entre spec, contrato e código; nomes que não existem.
3. "Arquivos lidos": a lista do que você leu.

A sua resposta final é curta: o caminho do rascunho, quantos passos e as dúvidas em uma linha cada.
