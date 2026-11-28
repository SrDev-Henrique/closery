# Pixel perfect do visual de `<slug>` (`feat/visual-<slug>`, <data>)

Você conduz o passe de pixel: compara o protótipo renderizado com o app, estado por estado, e corrige o que difere.
A referência é o protótipo renderizado (`.git/sdd/visual-<slug>/ref/`), nunca as screenshots do handoff.

## Ambiente (um servidor e um navegador por vez)

1. Portas livres: `netstat -ano | grep -E ':(3202|54332)\s' | grep LISTEN` (de pé com o banco visual, o script avisa e
   segue).
2. Banco visual, em segundo plano: `bun run visual:db`.
3. App de produção, em segundo plano: `. scripts/visual/env.sh && bun run build && bunx next start -H localhost -p 3202`
   (para iterar numa correção, `. scripts/visual/env.sh && bunx next dev -H localhost -p 3202`; os números finais são do
   build). O `-H localhost` deixa o app fora da rede local.
4. Mundo e pessoas, só na primeira vez (o banco visual fica em disco e é compartilhado entre as branches):
   `bun run visual:seed base` e `bun run visual:people`; depois, `bun run visual:seed avatars`. O estado de cada par o
   `visual:pairs` (e o `measure`, o `probe` e o `interact`) semeia sozinho.
5. Cópias do protótipo: `bun run visual:proto --config=visual-<slug>/proto.config.mjs` (sem sobra da lista).

## Pares

- A configuração da tela é `scripts/visual/screens/<slug>.mjs`: estados (semente, setor, pessoa, tema, caminho,
  larguras, cópia, passos), `patch` e `masks` do que depende do agora, regiões.
- Antes de mexer: `bun run visual:pairs --screen=<slug> --out=visual-<slug> --sufixo=-antes`.
- Cada estado × 1440×900 e 390×844 × escuro e claro, mais:
  - a terceira largura, entre os cortes de área útil da tela (`<largura>`), só nos estados cujo layout muda no corte;
  - a tela com a sidebar recolhida, em um estado;
  - os estados de interação e de falha, com os passos (`click`, `hover`, `focus`, `tab`, `drag`, `failRequests`…) dos
    dois lados.
- Diferença acima da meta: `node scripts/visual/measure.mjs --screen=<slug> --state=<estado> --width=<L> --out=visual-<slug>` (caixa,
  tipografia, cor, raio e padding pelo texto), `node scripts/visual/sbs.mjs` (protótipo, app e diferença empilhados com
  zoom), `node scripts/visual/crop.mjs` e `node scripts/visual/probe.mjs --out=visual-<slug>` (uma expressão nas duas
  páginas; `--app-only` dispensa o `--out`).
- As correções saem como `fix(visual): …`, uma por causa, com o teste. Divergência que pede escolha (ícone, texto,
  comportamento) vai ao dono; texto diferente entre os lados é defeito da cópia ou do seed.
- Regressão: mexeu numa peça de outra tela? Rerode os pares da tela dona dela (ex.: `--screen=inicio`).

## Meta e resíduos

- Até cerca de 0,1 a 0,2% por par, com a mesma altura nos dois lados.
- Resíduos aceitos, cada um com a causa: anti-aliasing do texto, versão do lucide, truncamento intencional, a gaveta em
  escala de cinza.

## Saída

`.git/sdd/visual-<slug>/pixel.md`:

| Par | Largura | Tema | Antes | Depois | Altura (app / protótipo) | O que sobra e por quê |
|---|---:|---|---:|---:|---|---|

Mais: os commits de correção, as decisões pedidas ao dono e os servidores derrubados pelo PID no fim. A resposta
final é curta: o maior par, quantos commits e as decisões pendentes.
