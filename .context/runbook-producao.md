# Runbook de produção — Closery

> **Passo a passo do go-live e da semana de piloto.** É a Parte B da Fase 6: o que acontece
> **depois** que o código da Fase 6 está na `main`. Nada daqui roda em teste automatizado nem em
> tarefa de subagente. Decisões que mandam aqui (do dono, D-F6, e do controlador, C6):
>
> - **D-F6-1:** só `*.vercel.app` no piloto; o `rpID` das passkeys é esse host (trocar de domínio
>   depois invalida as passkeys); sem domínio próprio não há e-mail transacional (P8 segue aberta).
> - **D-F6-2:** a recuperação de senha é um link gerado pelo administrador em `/admin/equipe`,
>   compartilhado como o convite; sem provedor de e-mail.
> - **D-F6-3:** Vercel Hobby (riscos aceitos em P65: uso não comercial nos termos, logs de 1 hora,
>   rollback só para o deploy anterior, uma região).
> - **D-F6-4:** Neon Free (100 CU-h por mês, restore de 6 horas); mitigações: projeto de produção
>   próprio, teto de 0,25 CU, scale-to-zero, nenhum monitor, CSV diário e planilha em paralelo.
> - **D-F6-5:** Sentry grátis, ligado só com o DSN no ambiente; sem dado de pessoa no evento.
> - **C6-1:** login no piloto por e-mail, senha e passkey; Google, Apple e Facebook desligados.
> - **C6-2:** previews da Vercel desligados; a validação local usa a porta 3201.
> - **C6-3:** migração de produção manual, com conferência do host e branch de segurança antes.
> - **C6-4:** banco de produção num projeto Neon novo em `sa-east-1`.
> - **C6-5:** página `/privacidade` com texto aprovado pelo dono; a empresa aprova antes dos convites.
> - **C6-6:** tempo da passagem medido com cronômetro e observador.
> - **C6-7:** toda ação voltada para fora só com o "sim" explícito do dono na hora.
> - **C6-8:** itens antes do piloto (região `gru1`, Node 22, cabeçalhos, log sanitizado, P22, P16,
>   trava de host, P12, proteção da `main`) e itens medidos durante o piloto (B15).
>
> **O repositório é público:** este arquivo nunca leva host de banco, connection string, DSN,
> domínio real de produção nem link de convite. Onde falta um valor, aparece `<projeto>.vercel.app`
> ou `<host do pooler>`.

---

## Regras que nunca mudam

1. **Confirmação na hora.** Todo passo marcado **[confirma]** (deploy, variável, migração de
   produção, `admin:invite` em produção, proteção da `main`, rollback, rotação de segredo, convite
   real) só acontece com o "sim" explícito do dono **naquele momento** (C6-7). Um "sim" antigo não
   vale.
2. **Quem digita o quê.** O **Dono** abre um Git Bash **fora da sessão do agente** e digita os
   comandos que o **Controlador** (o agente) dita. O Controlador **nunca** roda os comandos que
   carregam segredo pela ferramenta Bash (ela não é interativa: o `read -rs` recebe EOF) e **nunca**
   recebe a saída do `openssl` nem a do `admin:invite` com sucesso (o link de convite é um segredo).
   O Dono repassa só o host impresso e o código de saída.
3. **A URL de produção só no shell que o Dono abre** e fecha no fim (`exit`). Lida com
   `read -rs` para não ir ao histórico. Nunca em arquivo, nunca no `.env.local`, nunca em chat.
4. **Nunca `BETTER_AUTH_SECRETS`** (o Better Auth a lê sozinha do ambiente e passaria a aceitar
   segredos antigos). Só `BETTER_AUTH_SECRET`.
5. **Nunca "Reset from parent"** no Neon levando dado real de produção para a branch de dev.
6. **Nenhuma passagem de teste em produção.** O ensaio funcional é local, contra a branch de dev
   (passo B11).
7. **Nunca a porta 3000.** Ela pertence a outro processo; as verificações locais usam a 3201.
8. **Segredo nunca é impresso.** Nem connection string, nem `BETTER_AUTH_SECRET`, nem DSN, nem
   token, nem link de convite ou de nova senha, nem o `.env.local`.

## Variáveis da Vercel (só o ambiente Production)

| Variável | Valor | Observação |
|---|---|---|
| `DATABASE_URL_POOLED` | URL **com pooler** do projeto Neon de produção, `sslmode=verify-full` | Sensitive. É a única URL de banco na Vercel |
| `BETTER_AUTH_SECRET` | 32 bytes aleatórios em base64 | Sensitive. O Dono gera e cola direto no campo (B5) |
| `BETTER_AUTH_URL` | `https://<projeto>.vercel.app`, sem barra final | O host vira o `rpID` das passkeys (P66) |
| `NEXT_PUBLIC_SENTRY_DSN` | DSN do projeto no Sentry | Público por natureza; gravado no build: trocar exige novo deploy |

**Nunca na Vercel:** `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (a URL direta só existe no shell da
migração), `BETTER_AUTH_SECRETS`, `SENTRY_AUTH_TOKEN`, `GOOGLE_*`, `FACEBOOK_*` (o Google e o
Facebook ficam desligados no piloto, C6-1) e `DATABASE_POOL_MAX` (é só do E2E).

---

## Passos

### B0. PR da Fase 6

- **Controlador:** abre o PR da `feat/fase-6-producao` na `main` com os desvios no corpo: domínio
  `*.vercel.app`, recuperação de senha pelo link do administrador (P8 segue aberta), Hobby, Neon
  Free, sem CSP de scripts, Sentry fora do país.
- Espera o CI (`Tipos, lint e testes` e `E2E (Playwright)`) verde.
- **Dono:** lê e aprova o texto de `/privacidade` (C6-5) e aprova o merge. **[confirma]** Ainda não
  há Vercel ligada: o merge não publica nada.

### B1. Proteção da `main` (P62)

Antes de ligar a Vercel (a integração publica todo push na `main`).

- **Controlador** escreve `.git/sdd/f6/protecao-main.json` com a ferramenta Write:

```json
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "Tipos, lint e testes" },
      { "context": "E2E (Playwright)" }
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": null,
  "restrictions": null
}
```

- **[confirma]**, depois:

```bash
gh api -X PUT "repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/branches/main/protection" --input .git/sdd/f6/protecao-main.json
gh api "repos/$(gh repo view --json nameWithOwner -q .nameWithOwner)/branches/main/protection" -q '.required_status_checks.checks[].context'
```

Esperado: os dois nomes de check impressos.

### B2. Neon de produção

**Dono**, no console do Neon:

1. Projeto **novo** de produção (C6-4), plano Free, região AWS São Paulo (`sa-east-1`), a mesma
   versão do Postgres da dev.
2. Autoscaling 0,25–0,25 CU, scale-to-zero ligado, nenhum monitor que consulte o banco (D-F6-4).
3. Copiar as duas connection strings (pooler e direta) trocando `sslmode=require` por
   `sslmode=verify-full` e guardar **só** no gerenciador de senhas.
4. Tirar do `.env.local` as URLs de produção comentadas (o Dono edita; ninguém imprime o arquivo).

### B3. Sentry

**Dono:** conta grátis, projeto Next.js, copiar o DSN. Em Security & Privacy: Data Scrubber e
Default Scrubbers ligados, "Prevent Storing of IP Addresses" ligado. Anotar a região de dados da
organização (fora do Brasil, como diz `/privacidade`).

### B4. Migração de produção (C6-3)

Nunca no build nem no CI. O `drizzle-kit` não tem trava de host: a trava é conferir o host impresso
pelo `db:hosts` antes do `db:migrate`.

**Ordem com o visual novo:** a migração `0005_cor_do_setor` (a coluna `sector.color`, `NOT NULL` com
o check `sector_color_valid`) é aplicada **antes** do deploy do código que lê `sector.color` (B5).
Código novo num banco sem a coluna dá erro em toda tela que lê setor (`column "color" does not
exist`). Código antigo num banco com a coluna só falha ao criar setor (a coluna não tem valor
padrão). No go-live, a ordem B4 → B5 já garante isso. Se a `0005` um dia chegar a um banco que já
está no ar, aplique-a fora do horário da passagem e só então faça o deploy. No dev, rode o
`db:migrate` antes de subir o `bun run dev`.

1. **Dono**, no console do Neon: uma branch de segurança a partir da `main` do projeto novo.
2. **Dono** abre um Git Bash novo, na pasta do repositório, **fora da sessão do agente**, e cola a
   URL **direta** (não imprime nada):

```bash
read -rs DATABASE_URL_UNPOOLED
export DATABASE_URL_UNPOOLED DATABASE_URL="$DATABASE_URL_UNPOOLED"
bun run db:hosts
```

3. O Dono compara **só a linha `Banco das migrações (drizzle-kit)`** com o host do console do Neon.
   A linha `Banco da aplicação (runtime)` mostra o pooler de **dev** do `.env.local`: é esperado,
   ignore. Se o host das migrações não for o do projeto novo: **pare** e `exit`.
4. **[confirma]**, depois:

```bash
bun run db:migrate
```

5. No SQL Editor do Neon (projeto de produção): `select count(*) from drizzle.__drizzle_migrations;`
   deve dar **6** (da `0000` à `0005`, com a cor do setor do visual novo). Se a branch do visual novo
   ainda não estiver na `main`, são **5**.
6. `exit` (a URL some com o shell).

### B5. Vercel

**Dono**, no painel da Vercel:

1. Plano Hobby (D-F6-3; riscos aceitos em P65). Importar o repositório; Framework Next.js. Os
   comandos de instalação e de build e a região (`gru1`) vêm do `vercel.json`. Conferir Node 22.x e
   Fluid compute ligado (padrão). **[confirma]** o botão Deploy da importação: ele já é o primeiro
   deploy.
2. **[confirma]** Variáveis **só de Production**, as da tabela acima. Para o segredo, no próprio
   Git Bash do Dono, fora da sessão do agente: `openssl rand -base64 32` e colar direto no campo da
   Vercel (marcar Sensitive). O Controlador não vê o valor. Se a tela de importação não deixar
   escolher Production e Sensitive, importe sem variáveis (o build falha fechado: o env é
   validado), depois adicione as quatro em Settings → Environment Variables (só Production;
   Sensitive como na tabela) e **[confirma]** o redeploy.
3. Deployment Protection no padrão.
4. **[confirma]** o deploy com as quatro variáveis, com o Dono olhando o painel.

**Todo build e todo redeploy baixam a Satoshi do Fontshare** no `prebuild` (`api.fontshare.com` e
`cdn.fontshare.com`) e conferem o SHA-256 de cada peso; a Vercel não guarda a fonte entre builds. Se
o log do build mostrar `Não consegui preparar a fonte Satoshi`, siga "Se algo der errado no meio".

### B6. O domínio de produção é o `BETTER_AUTH_URL`

**Dono:** conferir o domínio que a Vercel atribuiu. Se for diferente do `BETTER_AUTH_URL`,
corrigir a variável e fazer redeploy **antes de qualquer conta** (o `rpID` das passkeys é esse
host, D-F6-1 e P66). **[confirma]** o redeploy.

Use e divulgue só `https://<projeto>.vercel.app` (o mesmo do `BETTER_AUTH_URL`): os aliases
`<projeto>-<escopo>.vercel.app` e `<projeto>-git-main-<escopo>.vercel.app` não servem para entrar
(o login e as passkeys só valem no host do `BETTER_AUTH_URL`).

### B7. Smoke

**Controlador** (só `GET`, sem credencial):

```bash
bun run smoke https://<projeto>.vercel.app
```

Esperado: `Resultado: 10 OK, 0 FALHOU, 0 PULADO.` O smoke não confere o schema: o B4.5 tem de
ter dado **5**. Sempre (não só quando `region` falha), rode também
`curl -sI https://<projeto>.vercel.app/api/health | grep -i x-vercel-id` e anote o valor cru em
P63 (confirma o formato `<borda>::<região>::<id>`).

Depois de uma tentativa de login feita pelo **Dono**, no navegador, com um e-mail fictício (ex.
`smoke@exemplo.test`; o Controlador só faz `GET`), nos logs da Vercel (guardam só 1 hora no
Hobby): **nenhuma** linha com `better-auth:ip-desconhecido` (P22; o aviso do Better Auth sobre IP
foi trocado por esse contexto). Anotar o resultado em P63. Depois do primeiro PR pós-go-live,
conferir que a branch dele **não** gerou deployment (previews desligados). Procure também no log
da Vercel linhas com `SERVER_ERROR` ou `Failed query`: depois da rodada de correções da revisão
final o `# SERVER_ERROR` do `better-call` não sai mais; o que sobra é o `⨯ Error` do próprio Next
(P75). Registre em P75 **só** a data e a hora, a rota, o nome ou código do erro e quantas linhas;
**nunca** cole a linha do log (ela traz e-mail, IP e o texto da passagem, e `pendencias.md` é
público). Se precisar de detalhe, use o canal privado da equipe (B15).

### B8. `admin:invite` em produção

1. **Dono** abre um Git Bash novo, na pasta do repositório, **fora da sessão do agente**, e cola a
   URL do **pooler**:

```bash
read -rs DATABASE_URL_POOLED
export DATABASE_URL_POOLED BETTER_AUTH_URL=https://<projeto>.vercel.app
bun run admin:invite
```

2. Sem a flag, o script imprime `Banco de destino: <host>` e `BETTER_AUTH_URL: <url>` e para com
   erro. O Dono repassa **só o host**; o Dono compara o host impresso com o host do pooler no
   console do Neon (ou repassa os dois ao Controlador). Confira também que a linha
   `BETTER_AUTH_URL:` é exatamente `https://<projeto>.vercel.app`. Host diferente, ou URL
   diferente (ex.: sobrou o `http://localhost:3000` do `.env.local` por erro no `export`): **pare**
   e `exit` (o link do convite apontaria para outra aplicação).
3. **[confirma]**, depois:

```bash
bun run admin:invite --confirmar-host=<host impresso> --label "Administrador"
```

4. O link de convite aparece **só** na tela do Dono (vale 7 dias, uma conta só). O Dono repassa
   apenas o código de saída (`echo $?`). `exit`. O Controlador nunca recebe a saída de sucesso.

### B9. Primeiro administrador

**Dono** (o Controlador guia, sem ver senha nem link):

1. Abre o link, cadastra e-mail e senha e cria a passkey no celular; cria uma **segunda** passkey em
   outro aparelho (`/conta` mostra 2).
2. Autoteste da redefinição: `/admin/equipe` → `Nova senha` na própria linha → abre o link numa
   janela anônima → troca a senha → `Senha alterada` → todas as sessões caem → entra de novo com a
   passkey e com a senha nova.
3. Conferir no DevTools que o cookie de sessão é o `__Secure-…session_token`.

### B10. Cadastro inicial

**Dono** (administrador), **pela interface**: setor ULD, turnos reais, itens e destinos validados
com o usuário final (P5, spec §15). Nada vem do repositório. **Nenhuma passagem de teste em
produção.**

### B11. Ensaio funcional

**Controlador + Dono**, localmente (nunca a 3000), contra a branch de **dev** do Neon:

Os comandos num shell só, com o `BETTER_AUTH_URL` da porta do ensaio (o `.env.local` aponta para
a 3000, e o `trustedOrigins`, o `origin` das passkeys e os links usam o `BETTER_AUTH_URL`; um valor
exportado vence o `.env.local`):

```bash
export BETTER_AUTH_URL=http://localhost:3201 NEXT_PUBLIC_SENTRY_DSN=""
bun run build && bun run start -p 3201
```

O Controlador sobe o servidor em segundo plano (export, build e start na mesma chamada) e o
derruba pelo PID de quem escuta a 3201, nunca a 3000. Convites e links de senha gerados no ensaio
apontam para a 3201. Erro genérico de login no ensaio quase sempre é `BETTER_AUTH_URL` diferente da
porta.

Uma passagem completa (rascunho → entregar → outra conta confirma) e uma solicitação.

### B12. LGPD (P64)

1. **Dono:** aprovação **por escrito** da empresa (controladora dos dados). Antes dela, o Dono
   leva à empresa o que a página ainda não diz e que só ela pode dizer: quem é a controladora, o
   contato do encarregado (LGPD art. 41), a base legal (art. 7º) e por quanto tempo ficam as
   cópias diárias do CSV e os relatórios do Sentry. Essas linhas entram no texto no mesmo PR do
   `PRIVACY_DRAFT = false`.
2. **Controlador:** PR curto com `PRIVACY_DRAFT = false` e `PRIVACY_UPDATED_AT` do dia em
   `src/features/privacy/privacyContent.ts`, CI verde. **[confirma]** o merge (vira deploy).

**Sem essa aprovação, ninguém é convidado.**

### B13. Calendário do piloto

**Dono**, com a liderança do setor:

- Dia −2: linha de base na planilha, com cronômetro (C6-6).
- Dia −1: convites.
- Dias 0 a 7: o app **e** a planilha em paralelo; observador nos dias 1, 3 e 5.
- Corte para a planilha se o app ficar fora por mais de 15 minutos no horário da passagem.
- Revisão de saída no dia 7 ou 8 (B18).

### B14. Convites reais (dia −1)

**Dono** (administrador): um convite por operador em `/admin/equipe`, entregue em mãos ou por
WhatsApp; cada pessoa cria a passkey no próprio celular. **[confirma]** antes do primeiro convite.

Cartão de treinamento, 6 linhas: como entregar o turno; como receber; o dia operacional é o dia em
que o turno **começou**; "Esqueceu a senha? Peça o link ao administrador"; onde ver a página
`/privacidade`; o endereço do app é só `https://<projeto>.vercel.app` (nunca os aliases
`-<escopo>` e `-git-main-`, onde o login e as passkeys não funcionam).

### B15. Rotina diária (10 minutos)

**Dono/administrador:**

- `/dashboard` (últimos 7 dias): esperadas × entregues × confirmadas, sem passagem, não
  confirmadas, paradas.
- Baixar o CSV do dia para uma pasta privada **fora do repositório** (cópia diária; mitigação do
  restore de 6 horas do Free).
- Sentry: eventos novos; revisar se algum traz dado de pessoa (P69).
- Neon: consumo de CU-h do mês (100 no Free); acima de 70% avisar o Controlador.
- Problemas no canal privado da equipe, **nunca** em issue pública.
- Na primeira solicitação real do piloto, abrir o detalhe rápido e conferir que abre no painel
  lateral; anotar em P44/P63.

**Durante o piloto (C6-8):** anotar cada ocorrência de P23, P34, P35, P36, P44 e P53 numa
`Atualização`. P57: um `EXPLAIN ANALYZE` das consultas do dashboard no SQL Editor do Neon, uma vez,
fora do horário da passagem (gasta CU-h).

### B16. Rollback

- **App:** Instant Rollback da Vercel (no Hobby, só para o deploy imediatamente anterior); depois
  promover o deploy bom (a atribuição automática do domínio desliga até alguém promover). O deploy
  antigo roda com as variáveis **do build dele**: depois de qualquer mudança de variável seguida
  de redeploy (B6, B17), não use rollback; corrija a variável e faça redeploy.
- **Banco:** restaurar apaga **tudo** o que foi gravado depois do ponto escolhido. Use só para
  desfazer uma migração que acabou de rodar, a partir da branch de segurança criada logo antes
  dela (nunca a do B4.1 depois que o piloto começou). Erro só do app: basta o rollback da Vercel.
  Antes de restaurar, baixe o CSV do dia. Migração futura sempre expand-then-contract, com branch
  de segurança antes.
- **[confirma]** em qualquer rollback.

### B17. Rotação de segredos

**[confirma]** em cada um:

Cada redeploy daqui baixa a Satoshi do Fontshare de novo e confere o SHA-256 (B5): com o Fontshare
fora, o redeploy falha e a rotação não se completa. Na rotação da senha do Neon, que derruba as
conexões até o redeploy terminar, confira antes que o Fontshare responde (ver "Se algo der errado no
meio").

- `BETTER_AUTH_SECRET`: valor novo na Vercel + redeploy (desloga todos; senhas e passkeys não
  dependem dele).
- Senha do Neon: reset no console, atualizar `DATABASE_URL_POOLED` na Vercel, redeploy. Conexões
  novas ao banco falham até o redeploy terminar: faça fora do horário da passagem.
- DSN do Sentry: trocar na Vercel e fazer redeploy (o DSN vai no build).

### B18. Revisão de saída (dia 7 ou 8)

**Dono + equipe:** tempo (mediana da planilha × a do app), perda de informação, dias sem passagem,
go/no-go. **Controlador:** registra cada achado em `.context/pendencias.md` como
`Aberto, não triado` e revisa P65 (Pro e Launch).

---

## Se algo der errado no meio

- O host impresso não confere: **pare**, `exit`, nada foi escrito (o `db:migrate` e o
  `admin:invite` só rodam depois da conferência).
- O smoke reprova: leia a linha `[FALHOU]`; o `x-vercel-id` cru entra em P63. Não convide ninguém
  antes de o smoke dar `10 OK`.
- O link de nova senha de alguém vazou e **ainda não foi usado**: gere outro (o anterior deixa de
  valer na hora). Desativar a conta também derruba o link.
- A pessoa abre o link e vê `Este link de redefinição venceu ou já foi usado` sem ter usado: trate
  como conta tomada (quem usou o link trocou a senha, entrou e pode ter criado uma passkey, que a
  redefinição e a desativação não apagam; P77). **[confirma]** cada passo:
  1. Desative a conta na hora em `/admin/equipe` (derruba sessões e o login por passkey).
  2. Reative e entregue um link novo **em mãos**, nunca pelo mesmo chat.
  3. A pessoa troca a senha, entra com ela e, em `/conta`, remove **todas** as passkeys (todas
     aparecem como "Passkey"; não dá para saber qual é a do intruso).
  4. Desative e reative de novo (derruba sessão aberta no intervalo); a pessoa entra com a senha e
     cria uma passkey nova no próprio celular. Confira em `/conta` que aparece **só** a passkey que
     ela acabou de criar; se houver outra, repita do passo 1.
  5. Revise as passagens e solicitações que a conta entregou ou confirmou no período: o que estiver
     errado, o administrador corrige com motivo (D13).

  Na conta do próprio administrador (não dá para se desativar): remova as passkeys em `/conta`, use
  `Nova senha` na própria linha, entre com a senha nova, remova de novo **todas** as passkeys, crie
  a sua e confira que aparece só uma.
- Suspeita de segredo exposto: B17 e, se for a URL do banco, resetar a senha no Neon primeiro.
- O build ou o redeploy falha com `Não consegui preparar a fonte Satoshi`. O deploy que já está no
  ar continua servindo (a fonte vai dentro do build dele). Leia o resto da linha:
  - **Rede** (`sem resposta de …` ou `… respondeu 5xx`): o Fontshare está fora ou lento. Espere e
    **[confirma]** o redeploy de novo. Para saber se ele voltou, no Git Bash do Dono:
    `curl -gsI "https://api.fontshare.com/v2/css?f[]=satoshi@500,700,900&display=swap"` deve
    responder `200`. Na rotação da senha do Neon (B17), faça essa conferência **antes** do reset:
    com o Fontshare fora, o app fica sem banco até o build passar.
  - **SHA-256** (`o arquivo do peso … veio com SHA-256 … e o esperado é …`): o Fontshare trocou o
    arquivo. **Não aceite** e não troque o hash no meio do incidente: siga "Mudou o hash?" em
    `.context/library-docs.md §17` (conferir a licença da versão nova e atualizar `SATOSHI_SHA256`
    num commit só dele, com PR e CI verde). Até lá, não há deploy novo; a saída definitiva é o
    espelho privado da P102.
