# Closery — Passagem de Turno

> **Documento vivo.** Visão de produto, domínio e o que a planilha atual ensina. Seções marcadas
> `🟡 a confirmar` são interpretação nossa e ainda não foram validadas com quem opera; seções
> `🟢 definido` já foram acordadas. Ao confirmar algo, troque o selo e registre a data.

---

## Visão

Um sistema **simples e detalhado** de passagem de turno para a operação de carga aérea. Quem
entrega o turno registra em poucos minutos o que aconteceu; quem recebe sabe em segundos o que
está recebendo; e cada passagem vira **dado estruturado** que alimenta um dashboard de
quantidades e solicitações — sem ninguém redigitar nada.

Não é "mais uma planilha". A planilha atual já tenta ser formulário, histórico e dashboard ao
mesmo tempo, e falha nas emendas entre os três (ver "O que a planilha ensina").

## Para quem 🟡 a confirmar

- **Usuário de origem:** um colaborador da **LATAM Cargo**, setor **ULD**, que tentou resolver o
  problema com uma planilha e não ficou satisfeito.
- **Quem preenche:** a equipe de cada turno do setor (o histórico da planilha mostra **1º e 2º
  turno**). O pedido é explícito: **todos os turnos** precisam do sistema, não só o dele.
- **Quem consome o dashboard:** presumivelmente supervisão/liderança do setor — quem precisa
  rastrear quantidades (avarias, insumos) e o andamento das solicitações.
- A lista de setores da planilha prevê **ULD, CARGA e OUTROS** — sinal de que outros setores
  podem querer usar depois.

## Dores que o sistema resolve

- Passagem de turno **desorganizada** e sem padrão entre turnos.
- **Falta de um sistema** — hoje é planilha (e antes dela, provavelmente conversa/papel).
- O formulário **não grava nada**: o histórico depende de alguém redigitar os números.
- **Nenhuma rastreabilidade** de quem entregou, quem recebeu e se o recebedor de fato confirmou.
- Ocorrências, observações e fotos **se perdem** — só os números chegam ao histórico.
- Sem visão confiável de **quantidades ao longo do tempo** e do **status das solicitações**.

---

## A planilha atual · 🟢 analisada em 2026-11-20

Arquivo `Latam_Cargo_Controle_ULD_v4.xlsx` (compartilhado via OneDrive, sem dados reais
relevantes — o histórico tem 5 linhas de exemplo). **Não versionamos o arquivo** nem os nomes de
pessoas que aparecem nele. Quatro abas:

### Aba 1 — "Formulário de Passagem"

Título: *Passagem de Turno | Controle Operacional - ULD*.

| Bloco | Campo | Tipo na planilha | Valor inicial |
|---|---|---|---|
| Informações do turno | Data | texto (`___/___/______`) | — |
| | Entregue por | texto livre | "Digite o nome do responsável" |
| | Recebido por | texto livre | "Digite o nome do responsável" |
| | Setor | lista: ULD · CARGA · OUTROS | ULD |
| Controles realizados (item · quantidade/situação · observações) | Total de redes danificadas | número | 0 |
| | Fitas enroladas | número | 0 |
| | Fitas recolhidas no terminal de exportação | número | 0 |
| Estoque (item · quantidade/status · observações) | Quantidade de rolos stretch | número | 0 |
| | Quantidade de sacos plásticos | número | 0 |
| | Quantidade de sacos de cebola | número | 0 |
| | Solicitação semanal de insumos | lista (ver aba 2) | Não solicitada |
| Registro fotográfico | Foto | imagem colada na célula | — |
| Ocorrências / observações gerais | Texto | texto livre | — |

Cada item de "Controles" e "Estoque" tem uma coluna de **observações** própria.

### Aba 2 — "Opções" (listas de validação)

- **Setor:** ULD · CARGA · OUTROS
- **Status / Situação:** OK · Danificado · Faltante · Pendente *(não é usada por nenhum campo)*
- **Solicitação semanal:** Não solicitada · Solicitada · Em separação / Trânsito · Entregue

### Aba 3 — "Histórico de Turnos"

Tabela preenchida **à mão**, uma linha por turno, com teto fixo de 30 linhas (`A5:L34`):
Data · **Turno** (1º Turno / 2º Turno) · Setor · Entregue por · Recebido por · Redes danificadas ·
Fitas enroladas · Fitas recolhidas (exp.) · Rolos stretch (est.) · Sacos plásticos (est.) ·
**Sacos de ráfia** (est.) · Solicitação semanal.

Linha de rodapé: **soma** para os controles; **último valor preenchido** (`LOOKUP(2,1/(…<>""))`)
para estoque e solicitação — ou seja, estoque é tratado como **saldo** (fotografia), não como
movimento.

### Aba 4 — "Dashboard Semanal e Mensal"

- **Resumo operacional:** turnos registrados, total de redes danificadas, fitas enroladas e fitas
  recolhidas — acumulado de 7 dias e de 30 dias.
- **Médias por turno** e total geral de cada controle; data do último registro; nº de registros.
- **Último saldo de estoque:** rolos stretch (rolos), sacos plásticos (un.), sacos de ráfia (un.)
  e o status da solicitação semanal.
- **Dois gráficos de barras:** controles semanal × mensal; último saldo de insumos.

### O que a planilha ensina (problemas encontrados)

1. **Formulário e histórico são desconectados.** Preencher o formulário não grava nada; alguém
   precisa copiar os números para o histórico. Dupla digitação → erro e esquecimento.
2. **"Turno" existe no histórico mas não no formulário.** A informação que identifica a
   passagem nem é capturada na origem.
3. **O mesmo item tem dois nomes:** "sacos de cebola" no formulário, "sacos de ráfia" no
   histórico e no dashboard. Item precisa ter **um nome canônico**.
4. **Observações por item, foto e ocorrências não chegam ao histórico** — o "detalhado" se perde;
   só os números sobrevivem.
5. **Teto de 30 linhas** nas fórmulas (~15 dias com 2 turnos). Depois disso o dashboard
   silenciosamente ignora dados.
6. **"Semanal" e "mensal" contam a partir da última data registrada**, não do calendário. Se
   ninguém registrar por uma semana, o dashboard continua mostrando a semana antiga como atual.
7. **"Recebido por" é texto digitado por quem entrega.** Não há aceite de quem recebe — não dá
   para provar que a passagem foi recebida.
8. **Nomes digitados à mão** quebram qualquer contagem por pessoa ("Maria Souza" ≠ "Maria S.").
9. **Data como texto** com máscara de sublinhados — não é data, não ordena, não filtra.
10. **A lista Status/Situação (OK/Danificado/Faltante/Pendente) existe e não é usada** — indica
    uma intenção não realizada de marcar a situação de itens.
11. **Estoque é saldo contado a cada turno**, sem entrada/consumo e sem mínimo. Não há alerta de
    estoque baixo; a "solicitação semanal" é o único sinal de reposição.
12. **Foto colada no Excel** não escala, não tem data/autor e pesa o arquivo.
13. A planilha **não tem pendências que atravessam turnos** — se algo ficou por fazer, depende do
    texto livre de ocorrências.

**O que ela acerta e devemos manter:** números começam em **0** (não vazios); listas fechadas
para setor e solicitação; separação clara entre **controles** (o que aconteceu no turno) e
**estoque** (o que há agora); observação ao lado de cada item; dashboard com janelas
**semanal e mensal** e **média por turno**.

---

## Glossário operacional · 🟡 a confirmar com quem opera

- **ULD (Unit Load Device):** palete ou contêiner aeronáutico onde a carga é montada para embarque.
  O setor ULD cuida desses equipamentos e dos acessórios de montagem.
- **Redes (de palete):** redes que prendem a carga sobre o palete. "Redes danificadas" = quantas
  foram encontradas/retiradas com avaria no turno.
- **Fitas:** cintas/fitas de amarração da carga. "Fitas enroladas" = fitas recolhidas e enroladas
  para reuso no turno. "Fitas recolhidas no terminal de exportação" = fitas trazidas de volta do
  terminal de exportação.
- **Stretch:** filme plástico esticável para envolver a carga; contado em **rolos**.
- **Sacos plásticos:** sacos/coberturas plásticas usados na proteção da carga; contados em unidades.
- **Sacos de ráfia ("sacos de cebola"):** sacos de trama de ráfia; o mesmo item aparece com os
  dois nomes na planilha.
- **Solicitação semanal de insumos:** pedido semanal de reposição dos insumos acima; ciclo
  Não solicitada → Solicitada → Em separação / Trânsito → Entregue.
- **Entregue por / Recebido por:** quem fecha o turno e quem o assume.

## Perguntas em aberto (respondidas no brainstorm — ver `build-plan.md §5`)

- ~~Quantos turnos existem e em que horários?~~ *Decidido em D9: cadastrados por setor, com
  horário; o sistema deduz o turno corrente.* (Os horários reais ainda precisam vir do usuário final.)
- Só o setor ULD, ou CARGA/OUTROS também desde o início? *(itens por setor: decidido em D1 —
  cadastráveis por setor)*
- Onde a passagem é feita: celular pessoal, celular/tablet do setor, PC compartilhado?
- ~~Cada pessoa terá login próprio?~~ *Decidido em D2: conta individual via Better Auth, só por
  convite.*
- Quem recebe precisa **confirmar** o recebimento no sistema?
- ~~"Solicitações" = só a solicitação semanal, ou outros pedidos?~~ *Decidido em D6: registro
  próprio com ciclo de vida, tela dedicada (quadro · lista · tabela) e comentários (D8).*
- ~~Itens precisam de situação?~~ *Decidido em D11: não; quantidade + observação, estoque só como
  contagem (sem mínimo — inventário não cabe numa iniciativa própria).*
- ~~Foto é obrigatória?~~ *Decidido em D10: sem imagens.*
- ~~O que ficou pendente deve aparecer para o próximo turno?~~ *Decidido em D12 (campo "Fica
  para o próximo turno" em destaque) e D6 (solicitações abertas aparecem em toda passagem).*
- A marca LATAM pode aparecer no sistema? (uso de marca depende de autorização da empresa)

---

## Fora do escopo (por enquanto)

- Integração com sistemas internos da LATAM.
- Gestão de escala/folgas, ponto ou RH.
- Controle de estoque com entradas, consumo, mínimo ou fornecedores — o sistema trabalha com
  **saldo contado**, como a planilha (D11: montar estoque exigiria inventário, e o projeto é
  iniciativa do usuário, não demanda da liderança).
- Multi-empresa (SaaS). O sistema nasce para **uma operação**; a estrutura não deve impedir
  setores novos.

## Como me ajudar neste projeto

Projeto **mais simples** que o klauve, feito para um amigo, e o pedido chegou abstrato. Ao ajudar:

- Transforme pedido vago em decisão concreta, **com uma recomendação** — e marque o que é
  suposição até ser confirmado.
- **YAGNI** com rigor: o valor está em substituir a planilha de verdade, rápido.
- Pense em quem preenche na correria do fim de turno: poucos toques, nada em branco, nada a
  lembrar de cabeça.
- O dashboard é cidadão de primeira classe: todo campo capturado deve ser **contável**.
