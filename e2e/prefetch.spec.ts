import { expect, type Page } from "@playwright/test";
import type { Pool } from "pg";

import type { Db } from "@/db/types";

import { openE2eDb } from "./db";
import { seedSector, signUpAdmin, test } from "./helpers";

// Laço de prefetch (revisão final do PR B). Com o espelho do slot @detalhe
// feito de catch-alls (`passagens/[...rest]`, `admin/[...rest]`), o segundo
// link para o mesmo caminho com outra busca (os "Entregar turno" do histórico,
// o seletor de setor do /admin/itens) era pedido de novo, em série, sem parar:
// cerca de 50 renderizações por segundo no servidor enquanto a aba ficasse
// aberta. A causa é a previsão de rota do cliente do Next 16.4.6: a segunda URL
// reaproveita a árvore da primeira (sem pedir a dela) e só resolve os
// parâmetros do ramo que casou a URL; o catch-all do slot ficava sem valor, e a
// chave do segmento nunca batia com a resposta. O espelho exato (mesmo caminho,
// mesmos nomes de parâmetro, nenhum catch-all no slot) não tem o defeito; a
// regra é do routeStructure.test.ts, e aqui fica a prova no build de produção.
//
// O prefetch sai do próprio router (`window.next.router.prefetch`, o mesmo que
// um <Link> visível chama), uma URL de cada vez: a primeira resolve a rota no
// servidor e a segunda, pedida depois, sai da previsão.

type RouterWindow = Window & {
  next: { router: { prefetch(href: string): void } };
};

/** As rotas que tinham catch-all no slot e são linkadas com buscas diferentes. */
const PATHS = [
  "/passagens/nova",
  "/admin/destinos",
  "/admin/equipe",
  "/admin/itens",
  "/admin/setores",
  "/admin/turnos",
];

// Um laço passa de 50 pedidos por segundo; uma URL que só sai da previsão faz
// no máximo o pedido do conteúdo dela (o shell em comum já está no cache).
const MAX_REQUESTS = 3;

let pool: Pool;
let db: Db;

test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});

test.afterAll(async () => {
  await pool.end();
});

function prefetch(page: Page, href: string): Promise<void> {
  return page.evaluate((url) => {
    (window as unknown as RouterWindow).next.router.prefetch(url);
  }, href);
}

test("(a) admin: o segundo prefetch do mesmo caminho com outra busca não entra em laço", async ({
  page,
}) => {
  // Um cadastro e seis pares de 3,5 s cada.
  test.slow();
  await seedSector(db);
  await signUpAdmin(page, db, "Ana Teste");
  await page.goto("/conta");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

  // Pedidos de prefetch por URL (sem o `_rsc`), e os da árvore de rota à parte.
  const requests = new Map<string, number>();
  const trees = new Map<string, number>();
  page.on("request", (request) => {
    const headers = request.headers();
    if (!headers["next-router-prefetch"]) return;
    const url = new URL(request.url());
    url.searchParams.delete("_rsc");
    const key = `${url.pathname}${url.search}`;
    const map =
      headers["next-router-segment-prefetch"] === "/_tree" ? trees : requests;
    map.set(key, (map.get(key) ?? 0) + 1);
  });

  for (const path of PATHS) {
    const first = `${path}?e2e=primeira`;
    const second = `${path}?e2e=segunda`;
    await prefetch(page, first);
    await expect.poll(() => requests.get(first) ?? 0, first).toBeGreaterThan(0);
    // A árvore da primeira chega e vira o padrão conhecido do caminho.
    await page.waitForTimeout(1_500);
    await prefetch(page, second);
    await page.waitForTimeout(2_000);
    expect(
      trees.get(second) ?? 0,
      `${second}: pediu a própria árvore, não saiu da previsão (o teste não provaria o laço)`,
    ).toBe(0);
    expect
      .soft(requests.get(second) ?? 0, `${second}: pedidos de prefetch em 2 s`)
      .toBeLessThanOrEqual(MAX_REQUESTS);
  }
});
