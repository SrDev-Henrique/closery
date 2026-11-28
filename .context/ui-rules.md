# UI Rules — Closery

> **Documento vivo + lei de construção de UI.** Como componentes e telas são feitos. Vale junto
> com `ui-tokens.md` (valores) e `ui-registry.md` (catálogo). Herdado do klauve, enxugado para
> o que este projeto usa.

---

## 1. Princípios

1. **Mais rápido que a planilha.** Passar o turno no fim do expediente, com pressa, no celular.
   Poucos toques, nada em branco, nada a lembrar de cabeça.
2. **Briefing primeiro.** Quem recebe o turno precisa entender em segundos o que recebeu: o que
   saiu do normal aparece antes do que está normal.
3. **Informação precisa.** Todo total ou contagem permite ver o detalhe (tooltip, popover ou
   link). Nenhum número opaco.
4. **Confortável de ler e tocar.** Corpo `text-sm`+, botões `h-9`+; abaixo de `md` (860px, §6),
   alvo de toque ≥ 44px.
   - **Link solto** (sozinho numa linha ou célula, não dentro de uma frase): mantém a classe do desktop
     e ganha `max-md:inline-flex max-md:min-h-11 max-md:items-center`; `max-md:min-w-11` quando o
     conteúdo é curto (um número) e `max-md:justify-end` quando ele se alinha à direita.
   - **Isentos:** o link `inline` no meio de uma frase (dentro de `p`, `li` ou `label` com mais texto
     que ele) e o link esticado do cartão (`after:inset-0`), cuja área de toque é o cartão inteiro.
   - **Guarda:** `e2e/touch-targets.spec.ts` mede as telas a 390x844 e reprova controle visível abaixo
     de 44px; tela nova entra na lista dele. Os testes de classe de `ui/` só cobrem primitivos.
5. **Código limpo.** Componentes pequenos, tipados, compostos a partir dos primitivos existentes.

## 2. Formulários e dados

### 2.1. Escolha, não texto
Um conjunto conhecido de respostas é **escolha** (select, chips, combobox), nunca campo de texto:
pessoas, setor, turno, status de solicitação, situação de item. Onde uma exceção for possível,
ofereça **"Outro"** com texto livre.

### 2.2. Nunca em branco
- Usuário → **usuário atual**.
- Número → **`0`**, nunca vazio. Contagem tem botões −/+ além da digitação.
- Conjunto fechado → valor **mais comum** (ou o último usado, quando fizer mais sentido).
- Data/turno → **o turno corrente**, deduzido do horário.
- Consentimento nunca vem marcado.

### 2.3. Campos de digitação ≥ 16px
Todo valor digitável usa no mínimo `text-base` em todos os breakpoints (legibilidade + evita o
zoom automático do iOS).

### 2.4. Rótulos de ação nomeiam o resultado
"Entregar turno", "Confirmar recebimento", "Marcar como entregue" — nunca "Enviar", "Avançar",
"OK". Ação que muda estado usa a cor do estado de destino.

### 2.5. Mostre o que a pessoa reconhece
Nome, foto, rótulo — nunca id, matrícula ou código que ela teria que lembrar.

### 2.6. Números e tabelas
Números alinhados à direita com `tabular-nums`. Unidade sempre visível (rolos, un.). Dado ordenado
no tempo é **linha do tempo**, não tabela.

## 3. Estados obrigatórios

Toda tela/componente com dado trata:
- **Carregando** — skeleton com o formato do conteúdo (nunca spinner solto em tela cheia).
- **Vazio** — explica o que é e oferece o próximo passo ("Nenhuma passagem hoje. Entregar turno").
- **Erro** — diz o que falhou e como recuperar; o que foi digitado **não se perde**.
- **Sucesso** de ação — feedback curto e claro (toast ou estado no próprio botão).

## 4. Gráficos e dashboard

- A **forma segue a pergunta**: comparação entre categorias → barra; evolução no tempo → linha ou
  barra por período; parte do todo só com poucas partes.
- Escala rotulada sempre que o gráfico responde "quanto"; um eixo de valor só.
- Legenda para ≥ 2 séries. **A cor pertence à entidade** (o mesmo item tem a mesma cor em todo o
  dashboard) e **nunca é ciclada**.
- Todo gráfico tem o número exato acessível (tooltip ou tabela ao lado).
- Período visível e explícito ("últimos 7 dias · 13–19 nov"), contado pelo calendário no fuso
  da operação.

## 5. Acessibilidade e responsividade

- Mobile-first: a passagem precisa funcionar bem no celular; o dashboard, bem no desktop.
- Todo controle só com ícone tem `aria-label` **e** tooltip.
- Foco visível; navegação por teclado nos formulários. Sobre os cartões coloridos, o foco é o
  contorno sólido do §6.
- Nada depende só de cor — status tem texto ou ícone junto (o texto sempre; o ícone sai só nas
  linhas do cartão de Solicitações do Início, D-V5).

## 6. Visual: tema, formas e cor (desde 2026-11-27)

Valores em `ui-tokens.md`; a decisão e os desvios no `architecture.md §10` (2026-11-27).

- **Tema escuro é o padrão, com um switch para o claro.** O `ThemeSwitch` fica no cabeçalho; o tema
  não segue o sistema e a escolha fica no navegador. Todo componente funciona nos dois temas. O visual
  que depende do tema usa tokens ou as variantes `dark:`; o valor em JS (rótulo, `aria-checked`) vem
  só do `useTheme()` (`library-docs.md §18`).
- **Pílula.** Botões e selos são `rounded-full` no app inteiro. Os tamanhos do Início e do shell
  (`pill`, 48px, e `icon-pill`, 44px, no `Button`; `md` no `Badge`) não têm a borda transparente de
  1px da base, que muda o tamanho medido; os outros tamanhos ainda a têm. Os tamanhos grandes, os
  cards de raio 32 e a tipografia display (Satoshi, `font-heading`) ficam no Início e no shell até
  cada tela receber o handoff dela.
- **"Celular" é abaixo de 860px** no app inteiro: o `md` do Tailwind (`53.75rem`) e o
  `MOBILE_BREAKPOINT` da sidebar. A faixa de 768 a 859px é celular. Dentro do conteúdo do Início, os
  cortes acima do celular são container queries da área útil (`@container/main`,
  `library-docs.md §20`), nunca da janela; o celular continua no `max-md:`.
- **Cartão de destaque (`Card variant="feature"`):** raio 32, padding 32 (22 no celular), sem borda,
  sem ring e sem sombra; os cartões se separam pela cor. As cores dele são **fixas**, iguais nos dois
  temas, e a tinta é sempre `--on-pastel` (e as `on-pastel-*`), com os botões `on-pastel` e
  `on-pastel-secondary`.
  - **Amarelo (`--highlight`) só para "precisa de atenção"**: hoje, só o "Passagem para confirmar".
    Nenhum outro cartão, selo ou destaque usa o `--highlight` (o selo `warning`, de "Parada há N
    dias", é âmbar e tem token próprio).
  - Rosa (`--invite`) só para o "Convide sua equipe"; o cartão do turno usa a cor do setor. O
    `--sector-pink` tem o mesmo valor do `--invite` (P108).
- **A cor do setor vem de `sector.color`**, numa paleta fechada de 5 cores (lilás, pêssego, azul,
  verde e rosa), escolhida na criação e editável na tela Setores. O mapa chave → token mora só em
  `src/features/sectors/colors.ts`. Nunca derive a cor da ordem da lista nem a cicle (§4), e mostre
  sempre o nome do setor ao lado da cor.
- **Foco visível com contorno sólido sobre pastel.** O anel `ring-ring/50` some sobre os cartões
  coloridos (1,06 a 1,9:1). Ali o foco é um contorno sólido de 2px na tinta `--on-pastel`, 2px para
  fora: `focus-visible:outline-solid outline-2 outline-offset-2 outline-on-pastel`, com `ring-0!`.
  Sem o `outline-solid`, o `outline-none` da base faz o contorno não aparecer. Foco, contraste e
  tamanho se provam por estilo calculado no navegador (E2E com Tab), nunca só pela classe.
- **Nunca `bg-muted` dentro de card** (nem `hover:bg-muted`, `aria-expanded:bg-muted` ou
  `data-checked:bg-muted`). Na paleta nova, `--muted` tem o valor de `--card` e de `--popover`, e no
  claro o fundo some. Use `accent` para hover e estado, e `primary` para o marcado. O guarda
  `src/app/mutedBackground.test.ts` recusa `bg-muted` em `src/`, com lista fechada de exceções (P83).
- **Contraste medido sobre cada fundo real e em cada estado.** Texto ≥ 4,5:1 e indicador de estado
  ≥ 3:1, sobre o fundo onde a peça realmente fica (página, card, popover, cada pastel) e em repouso e
  hover, com o translúcido composto sobre a superfície. O guarda é `src/app/themeContrast.test.ts`.
- **Valor fino é do protótipo.** Onde a spec e o protótipo divergem num padding, raio ou altura de
  linha, vale o protótipo (por exemplo, `leading-[normal]` onde ele não declara `line-height`).

## 7. Referência visual

O **board de ocorrências do klauve** é a referência para a tela de solicitações (D6):
`klauve/.context/ui-screens.md §8.1` (anatomia: cabeçalho com contagens do servidor + CTA,
segmentado Quadro · Lista · Tabela, colunas por status com ícone + nome + contagem, card que muda
de coluna, transição de status na cor do destino com "Mover para {status}", detalhe rápido sem
sair da tela, lista agrupada por status no celular) e
`klauve/apps/web/src/components/occurrences/` (implementação). Copie a **anatomia e as leis**, não
o código: o klauve tem infraestrutura (oRPC, realtime, mídia) que este projeto não tem.

## 8. Checklist do componente (Definition of Done)

- [ ] Consultou o `ui-registry.md` — não duplica nada existente.
- [ ] Só tokens; funciona em claro **e** escuro (o escuro é o padrão).
- [ ] Nenhum `bg-muted` dentro de card; contraste e foco medidos sobre o fundo real (§6).
- [ ] Estados carregando / vazio / erro tratados.
- [ ] Formulário segue §2 (escolha, nunca em branco, 16px, rótulo de resultado).
- [ ] Alvos de toque ≥ 44px no celular; ícone-só com tooltip.
- [ ] Registrado no `ui-registry.md`.
- [ ] Movimento (§9): curto, nada na carga nem na hidratação, o ramo reduzido testado e só os tokens.

## 9. Movimento (Motion, desde 2026-11-27)

Valores em `src/lib/motion.ts` (`ui-tokens.md §8`); a biblioteca e a integração com o Base UI no `library-docs.md §23`.

- **Curto e nunca no caminho da passagem.** Nenhuma duração ou mola passa de 0,45 s (`MOTION_MAX_SECONDS`), a saída é
  mais curta que a entrada, e nada espera uma animação para liberar um clique, um envio ou uma navegação (regra de ouro).
- **Nada anima na carga nem na hidratação.** O que vem do servidor sai do HTML no lugar: o repouso fica no CSS e só a
  troca anima (FLIP), ou o elemento usa `initial={false}`. `initial` com valores só em quem monta no cliente depois de uma
  ação (o painel do Sheet, o tooltip, a camada de cor).
- **Sempre respeita o movimento reduzido.** Todo efeito tem o ramo reduzido, pelo `usePrefersReducedMotion`: sem deslize,
  sem escala, sem mola; no máximo um fade curto (`MOTION_DURATION.instant`) ou a troca na hora. O
  `MotionConfig reducedMotion="user"` da raiz é a rede, não a regra.
- **O que se move.** Só `transform` e `opacity`; a cor troca por uma camada com opacidade. Mola no que pode voltar no meio
  (thumb, knob, aperto, painel); tween no fade. O `Button` encolhe para 0,97 ao apertar (`PRESS_SCALE`), menos o gatilho
  de popup (`aria-haspopup`), que responde só com a cor.
- **Um dono por propriedade.** Elemento que o Motion anima não tem `transition` de CSS na mesma propriedade (o CSS
  correria atrás de cada quadro): troque `transition-all` por uma lista sem `transform` e tire as classes de entrada e
  saída de CSS (`data-starting-style`, `animate-in`).
- **Só `m`, só tokens.** `import * as m from "motion/react-m"`, dentro do `MotionProvider` (o `strict` recusa o `motion`
  pronto); duração, curva e mola só pelos nomes de `src/lib/motion.ts`. Guarda: `src/app/motionUsage.test.ts`.
- **Prova.** Teste de componente com a `MotionTree` e o `stubReducedMotion` (`test/motion.tsx`): os dois ramos, o primeiro
  quadro, um valor no meio e o fim no lugar; o que o jsdom não vê (a saída que o Base UI espera, o `transform` calculado)
  vai para o `e2e/motion.spec.ts`. As capturas do processo visual rodam com movimento reduzido e esperam as animações
  (`library-docs.md §22` e §23).
- **Referência de comportamento: a ArcUI** (https://uiarc.dev, MIT): o que anima e como reduz, nunca o estilo nem os
  valores dela; trecho de código copiado leva o aviso de copyright MIT num comentário.
