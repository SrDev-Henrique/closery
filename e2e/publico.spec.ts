import { expect } from "@playwright/test";
import type { Pool } from "pg";

import type { Db } from "@/db/types";

import { buildInviteUrl, E2E_BASE_URL, insertInvite, openE2eDb } from "./db";
import { seedSector, signUpOperator, test } from "./helpers";

// Páginas e cabeçalhos públicos da Fase 6: /privacidade, os cabeçalhos de
// segurança, o noindex e o Referrer-Policy das páginas que carregam token.

let pool: Pool;
let db: Db;

test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});

test.afterAll(async () => {
  await pool.end();
});

test("(a) /privacidade abre sem sessão e é linkada de /entrar, do convite e de /conta", async ({
  page,
}) => {
  // Visita cinco páginas e cadastra um operador: com a máquina carregada os 30 s
  // padrão não bastam.
  test.slow();
  // Direto, sem sessão: o proxy não redireciona para /entrar.
  await page.goto("/privacidade");
  await expect(page).toHaveURL(/\/privacidade$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Privacidade e seus dados" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "Onde ficam" }),
  ).toBeVisible();

  // De /entrar.
  await page.goto("/entrar");
  await page.getByRole("link", { name: "Privacidade e seus dados" }).click();
  await expect(page).toHaveURL(/\/privacidade$/);
  await page.getByRole("link", { name: "Voltar" }).click();
  await expect(page).toHaveURL(/\/entrar$/);

  // Do convite válido (o convite não é usado: só se abre a página).
  const { token } = await insertInvite(db, { role: "admin" });
  await page.goto(buildInviteUrl(E2E_BASE_URL, token));
  await expect(
    page.getByRole("heading", { name: "Você foi convidado" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Privacidade e seus dados" }).click();
  await expect(page).toHaveURL(/\/privacidade$/);

  // De /conta, logado.
  const world = await seedSector(db);
  await signUpOperator(page, db, world.sector.id, "Ana Teste");
  await page.goto("/conta");
  await page.getByRole("link", { name: "Privacidade e seus dados" }).click();
  await expect(page).toHaveURL(/\/privacidade$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Privacidade e seus dados" }),
  ).toBeVisible();
});

test("(a2) o Voltar da privacidade leva de volta ao convite aberto", async ({
  page,
}) => {
  const { token } = await insertInvite(db, { role: "admin" });
  await page.goto(buildInviteUrl(E2E_BASE_URL, token));
  await expect(
    page.getByRole("heading", { name: "Você foi convidado" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Privacidade e seus dados" }).click();
  await expect(page).toHaveURL(/\/privacidade$/);
  await page.getByRole("link", { name: "Voltar" }).click();
  await expect(page).toHaveURL(/\/convite\//);
  await expect(
    page.getByRole("heading", { name: "Você foi convidado" }),
  ).toBeVisible();
});

test("(b) cabeçalhos de segurança, noindex e sem Referer no convite e na redefinição", async ({
  request,
}) => {
  const entrar = await request.get("/entrar", { maxRedirects: 0 });
  expect(entrar.status()).toBe(200);
  const headers = entrar.headers();
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["content-security-policy"]).toBe("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["permissions-policy"]).toBe(
    "camera=(), microphone=(), geolocation=()",
  );
  expect(headers["x-robots-tag"]).toBe("noindex, nofollow");
  // A meta robots do layout raiz é a terceira camada do noindex.
  expect(await entrar.text()).toContain(
    '<meta name="robots" content="noindex, nofollow"/>',
  );

  // Páginas cujo endereço carrega um token: nada de Referer para fora.
  for (const path of ["/convite/token-que-nao-existe", "/redefinir-senha"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(200);
    expect(response.headers()["referrer-policy"], path).toBe("no-referrer");
    // A regra global continua valendo junto da específica.
    expect(response.headers()["x-frame-options"], path).toBe("DENY");
  }
});

test("(c) /robots.txt bloqueia todos os buscadores", async ({ request }) => {
  const response = await request.get("/robots.txt", { maxRedirects: 0 });
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body).toContain("User-Agent: *");
  expect(body).toContain("Disallow: /");
});
