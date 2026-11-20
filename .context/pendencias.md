# Pendências — Closery

> **Índice único de tudo que está devido e não feito** — defeito, débito, decisão bloqueada.
> Organizado por estado, depois por severidade. Uma pendência **nunca é apagada**: ao mudar de
> estado, ela **muda de seção** e ganha uma `Atualização` datada.

---

## Como adicionar

**Estados** (strings exatas):

| Estado | O que manda fazer |
|---|---|
| `Aberto, não triado` | Triar |
| `Triado, plano pronto` | Implementar |
| `Bloqueado no dono` | Perguntar ao dono (ou ao usuário final) |
| `Teto aceito` | Nada, salvo se o custo mudar |
| `Resolvido` | Nada, é histórico |

**Severidade:** 🔴 Crítico · 🟠 Alto · 🟡 Médio · ⚪ Baixo (o emoji do título é só severidade).

**Ids:** `P<N>` em sequência, nunca renumerados. **Próximo id livre: P10.**

```markdown
#### P999 — Título que nomeia o defeito, não a área 🟠
**Estado:** Aberto, não triado
**Arquivos:** `src/x.ts:12`
**Impacto:** o que quebra, e para quem
**Correção:** o plano — `—` enquanto não triado
**Registrado em:** 2026-11-20
```

---

## Índice

| Id | Título | Sev. | Estado |
|---|---|---|---|
| P1 | Banco Neon não provisionado | 🟠 | Resolvido |
| P2 | Uso da marca LATAM sem autorização confirmada | 🟡 | Bloqueado no dono |
| P3 | Tamanhos do Button abaixo do alvo mínimo de toque | 🟡 | Aberto, não triado |
| P4 | Paleta de gráficos em cinza e sem tokens de status | 🟡 | Triado, plano pronto |
| P5 | Glossário do domínio ULD é interpretação, não confirmação | 🟡 | Bloqueado no dono |
| P6 | Login com Apple exige conta paga de desenvolvedor e domínio HTTPS | 🟡 | Bloqueado no dono |
| P7 | Login com Facebook exige app da Meta publicado | 🟡 | Bloqueado no dono |
| P8 | Sem provedor de e-mail, "esqueci a senha" não funciona | 🟠 | Bloqueado no dono |
| P9 | Paleta de gráficos do klauve não foi validada contra as superfícies do shadcn | ⚪ | Aberto, não triado |

---

## 1. Aberto, não triado

#### P3 — Tamanhos do Button abaixo do alvo mínimo de toque 🟡
**Estado:** Aberto, não triado
**Arquivos:** `src/components/ui/button.tsx:22-32`
**Impacto:** `default` (h-8), `xs`, `sm` e `icon` ficam abaixo de h-9 / 44px no celular
(`ui-rules.md §1.4`) — toque errado na correria do fim de turno.
**Correção:** —
**Registrado em:** 2026-11-20

#### P9 — Paleta de gráficos do klauve não foi validada contra as superfícies do shadcn ⚪
**Estado:** Aberto, não triado
**Arquivos:** `src/app/globals.css` (quando os tokens da D16 entrarem)
**Impacto:** no klauve, `chart-1..4` passou por teste de contraste ≥3:1 sobre o card e de
distinção para daltonismo, medido contra os cards **do klauve** (`#fefefe` / `#1e1e21`). Os cards
do shadcn neutral são próximos (branco / `oklch(0.205 0 0)`), mas não iguais — a garantia não se
transfere automaticamente.
**Correção:** — (opção: portar o `chartPaletteGuard.test.ts` do klauve e rodar contra o
`globals.css` daqui)
**Registrado em:** 2026-11-20

## 2. Triado, plano pronto

#### P4 — Paleta de gráficos em cinza e sem tokens de status 🟡
**Estado:** Triado, plano pronto
**Arquivos:** `src/app/globals.css` (`--chart-1..5`)
**Impacto:** o dashboard é central e os tokens `chart-*` do preset são tons de cinza — séries
indistinguíveis. Não existem `success`/`warning` para status de item e de solicitação.
**Correção:** copiar do klauve `chart-1..4`, `success`, `warning`, `info` (+ `-foreground`), claro e
escuro, para o `globals.css` e o `@theme inline` (D16; valores em `ui-tokens.md §2`).
**Registrado em:** 2026-11-20
**Atualização (2026-11-20):** triada no brainstorm — D14 manteve o shadcn padrão e D16 trouxe do
klauve os tokens que faltavam.


## 3. Bloqueado no dono

#### P2 — Uso da marca LATAM sem autorização confirmada 🟡
**Estado:** Bloqueado no dono
**Arquivos:** —
**Impacto:** a planilha usa logo e cores da LATAM Cargo. Reproduzir a marca num sistema não
oficial pode criar problema para quem usa.
**Correção:** perguntar se há autorização; sem ela, identidade própria e neutra (o sistema
continua servindo a operação).
**Registrado em:** 2026-11-20

#### P5 — Glossário do domínio ULD é interpretação, não confirmação 🟡
**Estado:** Bloqueado no dono
**Arquivos:** `.context/about.md` › Glossário operacional
**Impacto:** redes, fitas, stretch, sacos de ráfia — se a interpretação estiver errada, rótulos e
agrupamentos do sistema confundem quem opera.
**Correção:** validar o glossário com o usuário final.
**Registrado em:** 2026-11-20

#### P6 — Login com Apple exige conta paga de desenvolvedor e domínio HTTPS 🟡
**Estado:** Bloqueado no dono
**Arquivos:** — (configuração do Better Auth, ainda não instalado)
**Impacto:** "Entrar com Apple" depende do Apple Developer Program (anuidade paga), de um Services
ID com domínio verificado e de URL de retorno HTTPS — não funciona em `localhost`. Sem isso, o
botão não pode ir ao ar.
**Correção:** decidir se a conta Apple Developer existe ou será criada; se não, lançar sem Apple
e adicionar depois (o resto não depende dela).
**Registrado em:** 2026-11-20

#### P7 — Login com Facebook exige app da Meta publicado 🟡
**Estado:** Bloqueado no dono
**Arquivos:** — (configuração do Better Auth, ainda não instalado)
**Impacto:** o app da Meta só aceita usuários fora da lista de testadores em modo Live, que exige
URL de política de privacidade e instrução de exclusão de dados. Contas do Facebook podem não ter
e-mail — o cadastro precisa tratar e-mail ausente.
**Correção:** criar o app na Meta, publicar as duas páginas (privacidade, exclusão de dados) e
tratar `email` nulo no cadastro.
**Registrado em:** 2026-11-20

#### P8 — Sem provedor de e-mail, "esqueci a senha" não funciona 🟠
**Estado:** Bloqueado no dono
**Arquivos:** — (configuração do Better Auth, ainda não instalado)
**Impacto:** quem cadastrou com e-mail + senha e esqueceu a senha fica trancado para fora (a
passkey ajuda, mas não cobre aparelho novo). Verificação de e-mail também depende disso.
**Correção:** escolher um provedor transacional (sugestão: Resend, plano gratuito cobre o volume)
e um domínio remetente.
**Registrado em:** 2026-11-20

## 4. Teto aceito

*(nenhuma)*

## 5. Resolvido

#### P1 — Banco Neon não provisionado 🟠
**Estado:** Resolvido
**Arquivos:** `.env.example` · `src/db/index.ts` · `drizzle.config.ts`
**Impacto:** sem `DATABASE_URL` nenhuma migração roda e qualquer import de `@/db` lança erro.
**Correção:** criar o projeto no Neon (região `sa-east-1`, São Paulo, se disponível), copiar as
connection strings (com e sem pooler) para `.env.local`.
**Registrado em:** 2026-11-20
**Atualização (2026-11-20):** o dono preencheu o `.env.local` (`DATABASE_URL` direta +
`DATABASE_URL_POOLED`); `sslmode` trocado para `verify-full`; driver `pg` + `attachDatabasePool`
(D18); `/api/health` responde 200 com o banco. **Na Vercel**, cadastrar as mesmas duas variáveis,
também com `verify-full`.
**Atualização (2026-11-20):** o local passou para a branch de **desenvolvimento** do Neon; as URLs de
produção ficaram comentadas no `.env.local` — mover para a Vercel e apagar de lá.

