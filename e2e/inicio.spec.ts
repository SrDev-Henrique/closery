import { expect } from "@playwright/test";
import type { Pool } from "pg";

import type { Db } from "@/db/types";

import { isolateFirstAccess, openE2eDb } from "./db";
import { seedSector, signUpAdmin, signUpOperator, test } from "./helpers";

// Início novo: primeiro acesso do admin (cartão "Convide sua equipe", dispensa
// por cookie) e o tema (escuro por padrão, switch, persistência). Os dois
// primeiros testes isolam o banco compartilhado com `isolateFirstAccess`; o
// `afterAll` devolve o banco como estava (os specs seguintes rodam depois deste,
// no mesmo banco: `workers: 1`, `fullyParallel: false`).

const INVITE_COOKIE = "closery-convite-dispensado";
const FIRST_ACCESS_LINE =
  "Os pedidos da equipe aparecem aqui assim que alguém registrar o primeiro.";

let pool: Pool;
let db: Db;
// Um `restore` por chamada de `isolateFirstAccess`, desfeitos em ordem inversa.
const restores: (() => Promise<void>)[] = [];

test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});

test.afterAll(async () => {
  for (const restore of restores.reverse()) await restore();
  await pool.end();
});

test("primeiro acesso: o cartão aparece, 'Agora não' o esconde e a dispensa sobrevive ao recarregar", async ({
  page,
  context,
}) => {
  const world = await seedSector(db);
  restores.push(await isolateFirstAccess(db));
  await signUpAdmin(page, db, "Ana Teste");
  // O setor do teste na URL: as solicitações abertas dos outros specs ficam em
  // outros setores, então o cartão de solicitações aparece vazio.
  await page.goto(`/?setor=${world.sector.id}`);

  const invite = page.getByRole("heading", {
    level: 2,
    name: "Convide sua equipe",
  });
  await expect(invite).toBeVisible();
  await expect(page.getByText("Último passo")).toBeVisible();
  await expect(page.getByText("1 pessoa ativa")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Gerar convites" }),
  ).toHaveAttribute("href", "/admin/equipe");
  await expect(page.getByText(FIRST_ACCESS_LINE)).toBeVisible();
  // O cartão de turno e o de solicitações continuam na tela.
  await expect(
    page.getByRole("heading", { name: "Passagem do meu turno" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Agora não" }).click();
  await expect(invite).toHaveCount(0);

  // O cookie é HttpOnly (o servidor lê; o JS da página não), vale 1 ano e é Lax.
  const cookie = (await context.cookies()).find(
    (candidate) => candidate.name === INVITE_COOKIE,
  );
  expect(cookie).toMatchObject({
    value: "1",
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
  });
  expect(cookie?.expires ?? 0).toBeGreaterThan(
    Date.now() / 1000 + 300 * 24 * 3600,
  );

  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Passagem do meu turno" }),
  ).toBeVisible();
  await expect(invite).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agora não" })).toHaveCount(0);
  // Dispensar esconde o cartão, não muda o primeiro acesso.
  await expect(page.getByText(FIRST_ACCESS_LINE)).toBeVisible();
});

test("operador sozinho no banco nunca vê o cartão 'Convide sua equipe'", async ({
  page,
}) => {
  const world = await seedSector(db);
  restores.push(await isolateFirstAccess(db));
  await signUpOperator(page, db, world.sector.id, "Bruno Teste");

  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Passagem do meu turno" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Convide sua equipe" }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Agora não" })).toHaveCount(0);
  await expect(page.getByText(FIRST_ACCESS_LINE)).toHaveCount(0);
});

test("tema: escuro por padrão, o switch troca e a escolha sobrevive ao recarregar", async ({
  page,
}) => {
  const html = page.locator("html");
  // Até na tela pública o padrão é o escuro (o tema não segue o sistema).
  await page.goto("/entrar");
  await expect(html).toHaveClass(/\bdark\b/);

  const world = await seedSector(db);
  await signUpOperator(page, db, world.sector.id, "Carla Teste");
  await page.goto("/");

  const toggle = page.getByRole("switch", { name: "Tema escuro" });
  await expect(html).toHaveClass(/\bdark\b/);
  await expect(toggle).toHaveAttribute("aria-checked", "true");

  await toggle.click();
  await expect(html).not.toHaveClass(/\bdark\b/);
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  expect(await page.evaluate(() => localStorage.getItem("closery-tema"))).toBe(
    "light",
  );

  await page.reload();
  await expect(html).not.toHaveClass(/\bdark\b/);
  await expect(
    page.getByRole("switch", { name: "Tema escuro" }),
  ).toHaveAttribute("aria-checked", "false");

  // E de volta ao escuro, também persistido.
  await page.getByRole("switch", { name: "Tema escuro" }).click();
  await expect(html).toHaveClass(/\bdark\b/);
  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);
  await expect(
    page.getByRole("switch", { name: "Tema escuro" }),
  ).toHaveAttribute("aria-checked", "true");
});
