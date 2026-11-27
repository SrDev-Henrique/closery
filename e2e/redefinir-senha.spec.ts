import { type Browser, expect, type Page } from "@playwright/test";
import type { Pool } from "pg";

import type { Db } from "@/db/types";

import { countSessionsByEmail, openE2eDb } from "./db";
import {
  PASSWORD,
  seedSector,
  signUpAdmin,
  signUpOperator,
  test,
  unique,
} from "./helpers";

// Redefinição de senha pelo link do admin (D-F6-2): sem e-mail, o admin gera o
// link em /admin/equipe e a pessoa troca a senha em /redefinir-senha. O token
// viaja no fragmento (#token=...), que nunca chega ao servidor.

const NEW_PASSWORD = "outra-senha-de-teste-456";
const EXPIRED_MESSAGE =
  "Este link de redefinição venceu ou já foi usado. Peça outro ao administrador.";

let pool: Pool;
let db: Db;

test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});

test.afterAll(async () => {
  await pool.end();
});

// Navegador sem sessão e com o IP do teste (o app roda em produção, com rate
// limit por IP).
function visitor(browser: Browser, clientIp: string) {
  return browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": clientIp },
  });
}

// O admin abre a Equipe e gera o link de nova senha da pessoa. As pessoas ativas
// vêm em ordem alfabética (50 por página): nomes que começam com "Aa" ficam na
// primeira página mesmo com o banco cheio dos outros testes.
async function generateResetLink(
  adminPage: Page,
  person: { name: string; email: string },
): Promise<string> {
  await adminPage.goto("/admin/equipe");
  const row = adminPage
    .getByRole("main")
    .getByRole("listitem")
    .filter({ hasText: person.email });
  await row
    .getByRole("button", {
      name: `Gerar link de nova senha para ${person.name}`,
    })
    .click();
  const dialog = adminPage.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Link de nova senha" }),
  ).toBeVisible();
  await expect(dialog).toContainText("Válido até");
  const url = await dialog.getByLabel("Link para copiar").inputValue();
  expect(url).toMatch(/\/redefinir-senha#token=[A-Za-z0-9_-]{43}$/);
  return url;
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

async function resetWithLink(page: Page, url: string, password: string) {
  await page.goto(url);
  await expect(
    page.getByRole("heading", { name: "Criar uma senha nova" }),
  ).toBeVisible();
  await page.getByLabel("Senha nova").fill(password);
  await page.getByRole("button", { name: "Trocar a senha" }).click();
}

test("(a) admin gera o link de nova senha e o operador troca a senha: a nova entra e a antiga não", async ({
  page,
  browser,
  clientIp,
}) => {
  // Cada teste cadastra duas pessoas e abre até quatro navegadores: com a máquina
  // carregada os 30 s padrão não bastam.
  test.slow();
  const world = await seedSector(db);
  const operator = { name: `Aa Reset ${unique()}`, email: "" };
  const operatorContext = await visitor(browser, clientIp);
  operator.email = await signUpOperator(
    await operatorContext.newPage(),
    db,
    world.sector.id,
    operator.name,
  );
  await operatorContext.close();
  await signUpAdmin(page, db, `Aa Admin ${unique()}`);

  const url = await generateResetLink(page, operator);

  // Outro navegador, sem sessão, abre o link: o fragmento some da barra de
  // endereço assim que o formulário lê o token.
  const other = await visitor(browser, clientIp);
  const otherPage = await other.newPage();
  await resetWithLink(otherPage, url, NEW_PASSWORD);
  await expect(otherPage).toHaveURL(/\/redefinir-senha$/);
  await expect(
    otherPage.getByRole("heading", { name: "Senha alterada" }),
  ).toBeVisible();

  // A senha nova entra pelo link "Entrar" da própria tela.
  await otherPage.getByRole("link", { name: "Entrar", exact: true }).click();
  await expect(otherPage).toHaveURL(/\/entrar$/);
  await signIn(otherPage, operator.email, NEW_PASSWORD);
  await expect(otherPage).toHaveURL(/\/$/);
  await other.close();

  // A antiga não entra mais.
  const old = await visitor(browser, clientIp);
  const oldPage = await old.newPage();
  await signIn(oldPage, operator.email, PASSWORD);
  await expect(oldPage.getByText("E-mail ou senha incorretos.")).toBeVisible();
  await expect(oldPage).toHaveURL(/\/entrar$/);
  await old.close();
});

test("(b) o link usado de novo diz que venceu ou já foi usado, e sem o fragmento diz Link incompleto", async ({
  page,
  browser,
  clientIp,
}) => {
  // Cada teste cadastra duas pessoas e abre até quatro navegadores: com a máquina
  // carregada os 30 s padrão não bastam.
  test.slow();
  const world = await seedSector(db);
  const operator = { name: `Aa Reset ${unique()}`, email: "" };
  const operatorContext = await visitor(browser, clientIp);
  operator.email = await signUpOperator(
    await operatorContext.newPage(),
    db,
    world.sector.id,
    operator.name,
  );
  await operatorContext.close();
  await signUpAdmin(page, db, `Aa Admin ${unique()}`);
  const url = await generateResetLink(page, operator);

  const first = await visitor(browser, clientIp);
  const firstPage = await first.newPage();
  await resetWithLink(firstPage, url, NEW_PASSWORD);
  await expect(
    firstPage.getByRole("heading", { name: "Senha alterada" }),
  ).toBeVisible();
  await first.close();

  // O mesmo link de novo: o formulário abre (o token é lido do fragmento), mas
  // o servidor o recusa. O campo continua habilitado para o caso de typo.
  const again = await visitor(browser, clientIp);
  const againPage = await again.newPage();
  await resetWithLink(againPage, url, "mais-uma-senha-789");
  await expect(againPage.getByText(EXPIRED_MESSAGE)).toBeVisible();
  await expect(againPage.getByLabel("Senha nova")).toBeEnabled();
  await again.close();

  // A senha da primeira troca continua valendo.
  const check = await visitor(browser, clientIp);
  const checkPage = await check.newPage();
  await signIn(checkPage, operator.email, NEW_PASSWORD);
  await expect(checkPage).toHaveURL(/\/$/);
  await check.close();

  // Sem o fragmento não há o que trocar.
  const bare = await visitor(browser, clientIp);
  const barePage = await bare.newPage();
  await barePage.goto("/redefinir-senha");
  await expect(
    barePage.getByRole("heading", { name: "Link incompleto" }),
  ).toBeVisible();
  await expect(barePage.getByLabel("Senha nova")).toHaveCount(0);
  await expect(
    barePage.getByRole("link", { name: "Ir para a entrada" }),
  ).toHaveAttribute("href", "/entrar");
  await bare.close();
});

test("(c) trocar a senha pelo link encerra a sessão aberta em outro navegador", async ({
  page,
  browser,
  clientIp,
}) => {
  // Cada teste cadastra duas pessoas e abre até quatro navegadores: com a máquina
  // carregada os 30 s padrão não bastam.
  test.slow();
  const world = await seedSector(db);
  const operator = { name: `Aa Reset ${unique()}`, email: "" };
  // O operador fica com a sessão aberta neste navegador.
  const operatorContext = await visitor(browser, clientIp);
  const operatorPage = await operatorContext.newPage();
  operator.email = await signUpOperator(
    operatorPage,
    db,
    world.sector.id,
    operator.name,
  );
  expect(await countSessionsByEmail(db, operator.email)).toBe(1);

  await signUpAdmin(page, db, `Aa Admin ${unique()}`);
  const url = await generateResetLink(page, operator);

  const other = await visitor(browser, clientIp);
  const otherPage = await other.newPage();
  await resetWithLink(otherPage, url, NEW_PASSWORD);
  await expect(
    otherPage.getByRole("heading", { name: "Senha alterada" }),
  ).toBeVisible();
  await other.close();

  // A troca apagou a sessão do outro navegador (revokeSessionsOnPasswordReset).
  expect(await countSessionsByEmail(db, operator.email)).toBe(0);
  await operatorPage.goto("/");
  await expect(operatorPage).toHaveURL(/\/entrar$/);
  await operatorContext.close();
});
