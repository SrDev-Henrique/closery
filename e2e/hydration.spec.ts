import { type ConsoleMessage, expect, type Page } from "@playwright/test";
import type { Pool } from "pg";

import type { Db } from "@/db/types";
import { addDays } from "@/features/handovers/saoPaulo";

import {
  CLIENT_ID_PATTERN,
  hydrationProblems,
  snapshotDom,
  withoutIds,
} from "../test/hydrationCheck";
import {
  buildInviteUrl,
  E2E_BASE_URL,
  insertHandover,
  insertHandoverItem,
  insertInvite,
  insertUser,
  openE2eDb,
} from "./db";
import { ago, seedSector, signUpAdmin, signUpOperator, test } from "./helpers";

// Guarda de hidratação (PR B, spec §8). O PR A perdeu horas com conteúdo
// duplicado: um <script> num componente client acima dos <Suspense> fazia o
// React refazer a página no cliente, com o console vazio. O que denunciou foram
// os ids de useId: `_R_…_` (servidor, hidratado) contra `_r_…_` (cliente).
// Cada página abre com page.goto (documento novo: depois de uma navegação no
// cliente a Activity deixa a página anterior escondida no DOM) e é conferida
// antes de qualquer interação. O h1 esperado foi conferido lendo cada página:
// nas de auth o título é um CardTitle com role="heading" (0 <h1>).

type PageCheck = { label: string; url: string; h1: number };

/** Quanto cada página tem para a rede parar (o `networkidle`: 500 ms sem pedido). */
const NETWORK_IDLE_MS = 15_000;

const DAY_MS = 24 * 3_600_000;

/**
 * Ids `_r_…_` legítimos: componente que só existe no cliente, montado depois da
 * hidratação de propósito. Lista fechada por página (o `label` da tabela), com
 * o seletor do elemento e o motivo; nunca um filtro genérico. Uma entrada cujo
 * seletor não acha mais um id do cliente reprova (e a página da entrada tem que
 * mostrar o elemento em toda rodada, ou a exceção não diz nada).
 */
const CLIENT_ONLY_IDS: Record<
  string,
  readonly { selector: string; reason: string }[]
> = {
  // P119. O Recharts 3 não renderiza o <svg> no servidor: o tamanho do gráfico
  // no store começa em 0 e só é gravado num useEffect (ReportChartSize), e o
  // MainChartSurface devolve null até lá. O servidor manda o .recharts-wrapper
  // vazio, e o <Line> monta depois da hidratação: o useId dele é sempre do
  // cliente, e o id vai para o <path> da linha.
  "/dashboard?setor=<id>": [
    {
      selector:
        'section[aria-labelledby="dashboard-stock-title"] [data-slot="chart"] path.recharts-line-curve',
      reason:
        "o Recharts só monta o <svg> do gráfico de estoque no cliente, depois da hidratação",
    },
  ],
};

/** Quanto a exceção espera o elemento aparecer (depois do `networkidle` ele já está lá). */
const CLIENT_ONLY_LOOKUP_MS = 5_000;

let pool: Pool;
let db: Db;

test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});

test.afterAll(async () => {
  await pool.end();
});

async function clientOnlyIds(page: Page, label: string): Promise<string[]> {
  const ids: string[] = [];
  for (const { selector, reason } of CLIENT_ONLY_IDS[label] ?? []) {
    // Sem o limite, um elemento que sumiu só acabava no timeout do teste.
    const id =
      (await page
        .locator(selector)
        .getAttribute("id", { timeout: CLIENT_ONLY_LOOKUP_MS })) ?? "";
    expect(
      CLIENT_ID_PATTERN.test(id),
      `${label}: a exceção "${reason}" (${selector}) não acha mais um id do cliente; tire-a da lista`,
    ).toBe(true);
    ids.push(id);
  }
  return ids;
}

// Abre cada página, espera o título e a rede parar e confere o instantâneo.
// `expect.soft`: o relatório lista os problemas de todas as páginas de uma vez.
async function expectHydrated(page: Page, checks: readonly PageCheck[]) {
  const errors: string[] = [];
  const onConsole = (message: ConsoleMessage) => {
    if (message.type() === "error") errors.push(message.text());
  };
  // Na produção o Next manda o erro recuperável de hidratação ao reportError:
  // ele chega como pageerror, não como console.error.
  const onPageError = (error: Error) => {
    errors.push(`${error.name}: ${error.message}`);
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);
  try {
    for (const { label, url, h1 } of checks) {
      errors.length = 0;
      await page.goto(url);
      await expect(
        page.getByRole("heading", { level: 1 }).first(),
        label,
      ).toBeVisible();
      // Limite próprio, com a página na mensagem: sem ele, uma rede que nunca
      // para (o laço de prefetch do e2e/prefetch.spec.ts) só acabava no timeout
      // do teste, sem dizer onde.
      await page
        .waitForLoadState("networkidle", { timeout: NETWORK_IDLE_MS })
        .catch((error: unknown) => {
          throw new Error(
            `${label}: a rede não ficou ociosa em ${NETWORK_IDLE_MS / 1000} s (laço de prefetch?)`,
            { cause: error },
          );
        });
      const snapshot = withoutIds(
        await page.evaluate(snapshotDom),
        await clientOnlyIds(page, label),
      );
      expect.soft(hydrationProblems(snapshot, h1, errors), label).toEqual([]);
    }
  } finally {
    page.off("console", onConsole);
    page.off("pageerror", onPageError);
  }
}

test("(a) sem sessão: entrada, redefinição, convite e privacidade", async ({
  page,
}) => {
  const { token } = await insertInvite(db, { role: "admin" });
  // A ordem importa: dois goto seguidos que só mudam o fragmento (#token=…) não
  // recarregam a página, então as duas visitas da redefinição ficam separadas.
  await expectHydrated(page, [
    { label: "/redefinir-senha", url: "/redefinir-senha", h1: 0 },
    { label: "/entrar", url: "/entrar", h1: 0 },
    // Com um token no fragmento a página mostra o formulário (o único estado
    // dela com ids de useId). O token só é conferido no envio, que não acontece.
    {
      label: "/redefinir-senha#token",
      url: "/redefinir-senha#token=token-de-teste-0123456789",
      h1: 0,
    },
    {
      label: "/convite/<token>",
      url: buildInviteUrl(E2E_BASE_URL, token),
      h1: 0,
    },
    { label: "/privacidade", url: "/privacidade", h1: 1 },
  ]);
});

test("(b) admin: Início, Passagens, Solicitações, Dashboard, Conta e Administração", async ({
  page,
}) => {
  // Um cadastro e sete páginas: com a máquina carregada os 30 s padrão não bastam.
  test.slow();
  // Sem `?setor=` o dashboard do admin abre o primeiro setor ativo em ordem
  // alfabética, e os nomes do E2E são sorteados (`Setor <uuid>`): o gráfico de
  // estoque aparecia ou não conforme o setor que caía primeiro (P119). Este
  // setor, com uma contagem de ontem, garante o gráfico em toda rodada.
  const world = await seedSector(db, { shiftCreatedAt: ago(10 * DAY_MS) });
  const counter = await insertUser(db, {
    role: "operator",
    sectorId: world.sector.id,
    name: "Bia Teste",
  });
  const counted = await insertHandover(db, {
    sectorId: world.sector.id,
    shiftId: world.shift.id,
    operationalDate: addDays(world.today, -1),
    status: "delivered",
    deliveredBy: counter.id,
    deliveredAt: ago(DAY_MS),
  });
  await insertHandoverItem(db, {
    handoverId: counted.id,
    itemId: world.stretch.id,
    quantity: 12,
    snapshot: true,
  });
  await signUpAdmin(page, db, "Ana Teste");
  await expectHydrated(page, [
    { label: "/", url: "/", h1: 1 },
    { label: "/passagens", url: "/passagens", h1: 1 },
    // Sem `visao` a tela renderiza o Quadro e a Lista (uma escondida): ids
    // repetidos de propósito. A guarda olha uma visão só.
    {
      label: "/solicitacoes?visao=lista",
      url: "/solicitacoes?visao=lista",
      h1: 1,
    },
    {
      label: "/dashboard?setor=<id>",
      url: `/dashboard?setor=${world.sector.id}`,
      h1: 1,
    },
    { label: "/conta", url: "/conta", h1: 1 },
    { label: "/admin", url: "/admin", h1: 1 },
    { label: "/admin/equipe", url: "/admin/equipe", h1: 1 },
  ]);
});

test("(c) operador: Início e Passagens", async ({ page }) => {
  const world = await seedSector(db);
  await signUpOperator(page, db, world.sector.id, "Bruno Teste");
  await expectHydrated(page, [
    { label: "/", url: "/", h1: 1 },
    { label: "/passagens", url: "/passagens", h1: 1 },
  ]);
});
