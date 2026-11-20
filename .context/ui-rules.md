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
4. **Confortável de ler e tocar.** Corpo `text-sm`+, botões `h-9`+; abaixo de `md`, alvo de toque
   ≥ 44px.
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
- Foco visível; navegação por teclado nos formulários.
- Nada depende só de cor — status tem texto ou ícone junto.

## 6. Referência visual

O **board de ocorrências do klauve** é a referência para a tela de solicitações (D6):
`klauve/.context/ui-screens.md §8.1` (anatomia: cabeçalho com contagens do servidor + CTA,
segmentado Quadro · Lista · Tabela, colunas por status com ícone + nome + contagem, card que muda
de coluna, transição de status na cor do destino com "Mover para {status}", detalhe rápido sem
sair da tela, lista agrupada por status no celular) e
`klauve/apps/web/src/components/occurrences/` (implementação). Copie a **anatomia e as leis**, não
o código: o klauve tem infraestrutura (oRPC, realtime, mídia) que este projeto não tem.

## 7. Checklist do componente (Definition of Done)

- [ ] Consultou o `ui-registry.md` — não duplica nada existente.
- [ ] Só tokens; funciona em claro **e** escuro.
- [ ] Estados carregando / vazio / erro tratados.
- [ ] Formulário segue §2 (escolha, nunca em branco, 16px, rótulo de resultado).
- [ ] Alvos de toque ≥ 44px no celular; ícone-só com tooltip.
- [ ] Registrado no `ui-registry.md`.
