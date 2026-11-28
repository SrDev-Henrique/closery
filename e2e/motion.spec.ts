import { expect, type Page } from "@playwright/test";
import type { Pool } from "pg";

import type { Db } from "@/db/types";

import { insertSector, openE2eDb } from "./db";
import { seedSector, signUpAdmin, test, unique } from "./helpers";

// Prova do Motion no Chromium (emenda do Motion do PR B, library-docs §23). O jsdom não tem a Web
// Animations API: lá o Base UI desmonta na hora e não há `transform` calculado. Aqui: o aperto do
// botão, a gaveta que entra da borda e ainda está no DOM depois do Escape (o Base UI esperou o fade),
// o ramo de movimento reduzido e a camada de cor na troca de setor (que remonta o cartão). Celular
// (390x844): o menu é a gaveta.
test.use({ viewport: { width: 390, height: 844 } });

let pool: Pool;
let db: Db;
test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});
test.afterAll(async () => {
  await pool.end();
});

const DRAWER = '[data-slot="sidebar"][data-mobile="true"]';
const FADE = '[data-slot="sector-color-fade"]';
const PRESSED = "matrix(0.97, 0, 0, 0.97, 0, 0)";

type Watched = { __motionWatch?: Promise<string> };

/** Arma a observação: resolve com o `transform` calculado ou a classe do primeiro `selector` que entrar no DOM. */
async function watchInsert(
  page: Page,
  selector: string,
  read: "transform" | "className",
): Promise<void> {
  await page.evaluate(
    ({ target, what }) => {
      (window as Watched).__motionWatch = new Promise<string>((resolve) => {
        const observer = new MutationObserver(() => {
          const element = document.querySelector(target);
          if (!element) return;
          observer.disconnect();
          resolve(
            what === "transform"
              ? getComputedStyle(element).transform
              : element.className,
          );
        });
        observer.observe(document.body, { childList: true, subtree: true });
      });
    },
    { target: selector, what: read },
  );
}

function watched(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      (window as Watched).__motionWatch ??
      Promise.reject(new Error("observação não armada")),
  );
}

function transformOf(page: Page, selector: string): Promise<string | null> {
  return page.evaluate((target) => {
    const element = document.querySelector(target);
    return element ? getComputedStyle(element).transform : null;
  }, selector);
}

test("o botão encolhe ao apertar, a gaveta entra da borda pela mola e sai antes de desmontar", async ({
  page,
}) => {
  await signUpAdmin(page, db, "Bruno Teste");
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Alternar menu" });

  await toggle.hover();
  await page.mouse.down();
  await expect
    .poll(() =>
      toggle.evaluate((element) => getComputedStyle(element).transform),
    )
    .toBe(PRESSED);

  await watchInsert(page, DRAWER, "transform");
  await page.mouse.up();
  // No instante em que monta, a gaveta está fora da tela (−105% de 280px), não no lugar.
  expect(await watched(page)).not.toBe("none");
  await expect(page.locator(DRAWER)).toBeVisible();
  await expect.poll(() => transformOf(page, DRAWER)).toBe("none");

  await page.keyboard.press("Escape");
  // Quatro quadros depois do Escape a gaveta ainda está no DOM, já mais transparente: o Base UI
  // esperou o fade da saída (sem opacidade na saída, ela desmontaria na hora).
  const leaving = await page.evaluate(async (target) => {
    for (let frame = 0; frame < 4; frame++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const element = document.querySelector(target);
    return element ? Number(getComputedStyle(element).opacity) : null;
  }, DRAWER);
  expect(leaving, "a gaveta desmontou sem a animação de saída").not.toBeNull();
  expect(leaving).toBeLessThan(1);
  await expect(page.locator(DRAWER)).toHaveCount(0);
});

test("com movimento reduzido: o botão não encolhe e a gaveta aparece sem deslizar", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signUpAdmin(page, db, "Carla Teste");
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Alternar menu" });

  await toggle.hover();
  await page.mouse.down();
  await page.waitForTimeout(250);
  expect(
    await toggle.evaluate((element) => getComputedStyle(element).transform),
  ).toBe("none");

  await watchInsert(page, DRAWER, "transform");
  await page.mouse.up();
  expect(await watched(page)).toBe("none");
  await expect(page.locator(DRAWER)).toBeVisible();
});

test("trocar de setor no Início: a cor de antes fica por cima do cartão do turno e some", async ({
  page,
}) => {
  const before = await seedSector(db); // lilás (a cor padrão do fixture)
  const after = await insertSector(db, `Setor ${unique()}`, {
    color: "peach",
  });
  await signUpAdmin(page, db, "Diego Teste");
  await page.goto(`/?setor=${before.sector.id}`);
  await expect(
    page.getByRole("heading", { name: "Passagem do meu turno" }),
  ).toBeVisible();

  await watchInsert(page, FADE, "className");
  await page.getByRole("radio", { name: after.name }).click();
  expect(await watched(page)).toContain("bg-sector-lilac");
  await expect(page).toHaveURL(new RegExp(`setor=${after.id}`));
  await expect(page.locator(FADE)).toHaveCount(0);
});
