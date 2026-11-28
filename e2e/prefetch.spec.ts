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

/** As telas do SectorSwitcher: um <Link> por setor ativo, todos para o caminho da própria tela. */
const SWITCHER_PATHS = ["/admin/itens", "/admin/turnos"];
// A revisão viu o laço do seletor com 5 ou mais links; o teste cria 6 setores.
const SWITCHER_SECTORS = 6;

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

/** Várias URLs no mesmo tique, como uma lista de links que entra na tela de uma vez. */
function prefetchAll(page: Page, hrefs: string[]): Promise<void> {
  return page.evaluate((urls) => {
    const { router } = (window as unknown as RouterWindow).next;
    for (const url of urls) router.prefetch(url);
  }, hrefs);
}

/**
 * Conta os pedidos de prefetch por URL (sem o `_rsc`), com os da árvore de rota à parte.
 * `expectNoLoop` confere a janela desde o último `reset` e zera a contagem.
 */
function trackPrefetches(page: Page) {
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
  const reset = () => {
    requests.clear();
    trees.clear();
  };
  return {
    trees,
    reset,
    expectNoLoop(label: string) {
      for (const [url, total] of requests) {
        expect
          .soft(total, `${label}: ${url}, pedidos de prefetch na janela`)
          .toBeLessThanOrEqual(MAX_REQUESTS);
      }
      reset();
    },
  };
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

// O SectorSwitcher de /admin/itens e /admin/turnos (um <Link> por setor ativo,
// `?setor=<id>`) entrava no mesmo laço em três jeitos de uso, medidos no build
// de produção com o `admin/[...rest]` no slot e 7 setores: trocar de setor
// (cerca de 800 pedidos em 5 s), um link novo depois da carga (cerca de 950) e
// vários links pedidos de uma vez a partir de outra tela (cerca de 230). Com o
// espelho exato, no máximo 1 pedido por URL nos três. Este caso guarda os três.
test("(b) admin: o SectorSwitcher com 6 setores não entra em laço (troca de setor, link novo, vários de uma vez)", async ({
  page,
}) => {
  // Seis setores, um cadastro e, por tela, cinco janelas de 1 a 2,5 s.
  test.slow();
  const sectors: { id: string }[] = [];
  for (let index = 0; index < SWITCHER_SECTORS; index += 1) {
    sectors.push((await seedSector(db)).sector);
  }
  await signUpAdmin(page, db, "Ana Teste");
  const prefetches = trackPrefetches(page);

  for (const path of SWITCHER_PATHS) {
    await page.goto(path);
    const switcher = page.getByRole("navigation", { name: "Setor" });
    await expect
      .poll(
        () => switcher.getByRole("link").count(),
        `${path}: links do seletor`,
      )
      .toBeGreaterThanOrEqual(SWITCHER_SECTORS);
    await page.waitForTimeout(1_500);
    prefetches.expectNoLoop(`${path}, carga`);

    // Trocar de setor: navegação no cliente para o mesmo caminho com outra busca.
    await switcher.locator("a:not([aria-current])").first().click();
    await expect(page).toHaveURL(
      (url) => url.pathname === path && url.searchParams.has("setor"),
    );
    await page.waitForTimeout(2_500);
    prefetches.expectNoLoop(`${path}, depois de trocar de setor`);

    // Um link novo depois da carga sai da previsão (nenhuma árvore própria).
    const fresh = `${path}?setor=${sectors[0]?.id}&e2e=novo`;
    await prefetch(page, fresh);
    await page.waitForTimeout(2_000);
    expect(
      prefetches.trees.get(fresh) ?? 0,
      `${fresh}: pediu a própria árvore, não saiu da previsão (o teste não provaria o laço)`,
    ).toBe(0);
    prefetches.expectNoLoop(`${path}, link novo depois da carga`);
  }

  // Vários links de uma vez, de outra tela e com o cache do cliente vazio: as
  // primeiras URLs resolvem a rota no servidor, e as outras saem da previsão.
  for (const path of SWITCHER_PATHS) {
    await page.goto("/conta");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.waitForTimeout(1_000);
    prefetches.reset();
    const batch = sectors.map(
      (sector) => `${path}?setor=${sector.id}&e2e=lote`,
    );
    await prefetchAll(page, batch);
    await page.waitForTimeout(2_500);
    expect(
      batch.filter((url) => (prefetches.trees.get(url) ?? 0) === 0).length,
      `${path}: todas as URLs do lote pediram a própria árvore (o teste não provaria o laço)`,
    ).toBeGreaterThan(0);
    prefetches.expectNoLoop(`${path}, ${SWITCHER_SECTORS} links de uma vez`);
  }
});
