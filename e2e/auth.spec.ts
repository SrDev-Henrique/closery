import { randomUUID } from "node:crypto";

import {
  type Browser,
  test as base,
  expect,
  type Page,
} from "@playwright/test";
import type { Pool } from "pg";

import type { Db } from "@/db/types";

import {
  buildInviteUrl,
  deactivateUserByEmail,
  E2E_BASE_URL,
  insertInvite,
  insertSector,
  openE2eDb,
} from "./db";
import { addVirtualAuthenticator } from "./virtual-authenticator";

const PASSWORD = "senha-de-teste-123";

// O app roda em produção (`next start`), então o rate limit do Better Auth
// (cadastro: 10 por 60 s por IP; login por e-mail: 30 por 60 s) está ligado. O
// IP próprio de cada teste (x-forwarded-for, como chegaria atrás da Vercel)
// mantém os cenários independentes do limite, qualquer que seja a contagem.
// A base aleatória evita reaproveitar um IP já contado numa execução anterior.
const ipPrefix = `10.${Math.floor(Math.random() * 200) + 20}.${Math.floor(Math.random() * 250)}`;
let nextClientIp = 1;

const test = base.extend<{ clientIp: string }>({
  // biome-ignore lint/correctness/noEmptyPattern: o Playwright exige o padrão de desestruturação.
  clientIp: async ({}, use) => {
    await use(`${ipPrefix}.${nextClientIp++}`);
  },
  extraHTTPHeaders: async ({ clientIp }, use) => {
    await use({ "x-forwarded-for": clientIp });
  },
});

function visitor(browser: Browser, clientIp: string) {
  return browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": clientIp },
  });
}

let pool: Pool;
let db: Db;

test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});

test.afterAll(async () => {
  await pool.end();
});

// Cada teste cria os próprios dados: e-mail único, nome fictício.
function uniqueEmail(): string {
  return `e2e-${randomUUID()}@example.com`;
}

async function signUpWithInviteToken(
  page: Page,
  token: string,
  person: { name: string; email: string },
) {
  await page.goto(buildInviteUrl(E2E_BASE_URL, token));
  await expect(
    page.getByRole("heading", { name: "Você foi convidado" }),
  ).toBeVisible();
  await page.getByLabel("Nome").fill(person.name);
  await page.getByLabel("E-mail").fill(person.email);
  await page.getByLabel("Senha").fill(PASSWORD);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).toHaveURL(/\/bem-vindo$/);
  await expect(
    page.getByRole("heading", { name: "Conta criada" }),
  ).toBeVisible();
}

async function registerAdmin(page: Page, name: string, email: string) {
  const { token } = await insertInvite(db, { role: "admin" });
  await signUpWithInviteToken(page, token, { name, email });
  return { token };
}

async function signInWithPassword(page: Page, email: string, password: string) {
  await page.goto("/entrar");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

test("sem sessão, / redireciona para /entrar", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(
    page.getByRole("heading", { name: "Entrar no Closery" }),
  ).toBeVisible();
  await expect(page.getByText("O acesso é só por convite.")).toBeVisible();
});

test("convite de admin: cadastro por e-mail e senha, Início e Administração", async ({
  page,
}) => {
  await registerAdmin(page, "Ana Teste", uniqueEmail());

  await page.getByRole("link", { name: "Agora não" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Olá, Ana" })).toBeVisible();
  await expect(
    page.getByText("Em breve: passagem de turno, solicitações e dashboard."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Administração" })).toBeVisible();
});

test("convite já usado mostra que não está mais disponível", async ({
  page,
  browser,
  clientIp,
}) => {
  const { token } = await registerAdmin(page, "Bruno Teste", uniqueEmail());

  const other = await visitor(browser, clientIp);
  const otherPage = await other.newPage();
  await otherPage.goto(buildInviteUrl(E2E_BASE_URL, token));

  await expect(
    otherPage.getByRole("heading", { name: "Convite indisponível" }),
  ).toBeVisible();
  await expect(otherPage.getByText("Este convite já foi usado.")).toBeVisible();
  await expect(
    otherPage.getByText("Peça um novo convite a quem te convidou."),
  ).toBeVisible();
  await other.close();
});

test("login com senha errada mostra a mensagem em português", async ({
  page,
  browser,
  clientIp,
}) => {
  const email = uniqueEmail();
  await registerAdmin(page, "Carla Teste", email);

  const other = await visitor(browser, clientIp);
  const otherPage = await other.newPage();
  await signInWithPassword(otherPage, email, "senha-errada-999");

  await expect(
    otherPage.getByText("E-mail ou senha incorretos."),
  ).toBeVisible();
  await expect(otherPage).toHaveURL(/\/entrar$/);
  await other.close();
});

test("operador cadastra, não vê Administração e /admin responde página não encontrada", async ({
  page,
}) => {
  const sector = await insertSector(db);
  const { token } = await insertInvite(db, {
    role: "operator",
    sectorId: sector.id,
  });
  await signUpWithInviteToken(page, token, {
    name: "Davi Teste",
    email: uniqueEmail(),
  });

  await page.getByRole("link", { name: "Agora não" }).click();
  await expect(page.getByRole("heading", { name: "Olá, Davi" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Conta" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Administração" })).toHaveCount(
    0,
  );

  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Página não encontrada" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Administração" }),
  ).toHaveCount(0);
  // O <title> também não pode revelar a rota (T12: /admin não exporta metadata).
  await expect(page).not.toHaveTitle(/Administração/);
});

test("passkey: criar em /conta, sair e entrar com a passkey", async ({
  page,
  context,
}) => {
  // Com um autenticador virtual, o preenchimento automático (conditional UI) de
  // /entrar entra sozinho assim que a página abre e corre contra o clique. Aqui
  // queremos exercitar o botão, então o navegador "não oferece" o autofill.
  await context.addInitScript(() => {
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isConditionalMediationAvailable = async () => false;
    }
  });
  const authenticator = await addVirtualAuthenticator(context, page);
  await registerAdmin(page, "Elisa Teste", uniqueEmail());
  await page.getByRole("link", { name: "Agora não" }).click();
  await expect(page.getByRole("heading", { name: "Olá, Elisa" })).toBeVisible();

  await page.getByRole("link", { name: "Conta" }).click();
  await expect(page.getByRole("heading", { name: "Conta" })).toBeVisible();
  await expect(page.getByText("Nenhuma passkey ainda.")).toBeVisible();

  await page.getByRole("button", { name: "Criar passkey" }).click();
  await expect(
    page.getByRole("button", { name: "Remover passkey" }),
  ).toBeVisible();
  await expect(page.getByText("Nenhuma passkey ainda.")).toHaveCount(0);
  expect(await authenticator.credentials()).toHaveLength(1);

  await page.getByRole("button", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/entrar$/);

  await page.getByRole("button", { name: "Entrar com passkey" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Olá, Elisa" })).toBeVisible();

  await authenticator.remove();
});

test("usuário desativado não entra", async ({ page, browser, clientIp }) => {
  const email = uniqueEmail();
  await registerAdmin(page, "Fábio Teste", email);

  await deactivateUserByEmail(db, email);

  // A sessão que já existia também deixa de valer na hora (sem cookieCache).
  await page.goto("/");
  await expect(page).toHaveURL(/\/entrar$/);

  const other = await visitor(browser, clientIp);
  const otherPage = await other.newPage();
  await signInWithPassword(otherPage, email, PASSWORD);
  await expect(
    otherPage.getByText("Esta conta foi desativada. Fale com o administrador."),
  ).toBeVisible();
  await expect(otherPage).toHaveURL(/\/entrar$/);
  await other.close();
});
