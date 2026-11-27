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
  countSessionsByEmail,
  E2E_BASE_URL,
  insertInvite,
  insertSector,
  insertUser,
  openE2eDb,
} from "./db";

const PASSWORD = "senha-de-teste-123";

// Os dados de cada cenário (poucos registros por tela) cabem na página 1
// (PAGE_SIZE = 50): o E2E não percorre a paginação, que os testes de componente
// e de domínio já provam.

// Mesma estratégia do auth.spec.ts: o app roda em produção (`next start`) com
// rate limit; cada teste usa um IP próprio (x-forwarded-for, como chegaria atrás
// da Vercel). A base aleatória evita colidir com os IPs do auth.spec.ts.
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

// Cada teste cria os próprios dados: e-mail e nomes únicos, todos fictícios.
function unique(): string {
  return randomUUID().slice(0, 8);
}

function uniqueEmail(): string {
  return `e2e-${randomUUID()}@example.com`;
}

async function signUpAtInviteUrl(
  page: Page,
  inviteUrl: string,
  person: { name: string; email: string },
) {
  await page.goto(inviteUrl);
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

function signUpWithInviteToken(
  page: Page,
  token: string,
  person: { name: string; email: string },
) {
  return signUpAtInviteUrl(page, buildInviteUrl(E2E_BASE_URL, token), person);
}

async function registerAdmin(page: Page, name: string, email: string) {
  const { token } = await insertInvite(db, { role: "admin" });
  await signUpWithInviteToken(page, token, { name, email });
}

// Linha da lista (<li>) do conteúdo (<main>, fora da barra lateral) que contém
// o texto: o nome do setor, o e-mail da pessoa.
function rowWith(page: Page, text: string) {
  return page.getByRole("main").getByRole("listitem").filter({ hasText: text });
}

// O seletor de setor de Turnos e Itens é uma <nav aria-label="Setor">.
async function chooseSector(page: Page, sectorName: string) {
  await page
    .getByRole("navigation", { name: "Setor", exact: true })
    .getByRole("link", { name: sectorName })
    .click();
  await expect(page).toHaveURL(/setor=/);
}

test("(a) admin cria setor, turno, item e destino e os vê nas listas", async ({
  page,
}) => {
  await registerAdmin(page, "Ana Cadastros", uniqueEmail());
  const sectorName = `Setor ${unique()}`;
  const destinationName = `Almoxarifado ${unique()}`;

  // Setor.
  await page.goto("/admin/setores");
  await expect(page.getByRole("heading", { name: "Setores" })).toBeVisible();
  // A cor já vem marcada (sugestão do servidor): o formulário nunca começa em branco.
  const colorChoice = page.getByRole("radiogroup", { name: "Cor" });
  await expect(colorChoice.getByRole("radio", { checked: true })).toHaveCount(
    1,
  );
  await page.getByLabel("Nome do setor").fill(sectorName);
  await colorChoice.getByRole("radio", { name: "Rosa" }).click();
  await expect(colorChoice.getByRole("radio", { name: "Rosa" })).toBeChecked();
  await page.getByRole("button", { name: "Criar setor" }).click();
  await expect(page.getByText("Setor criado.")).toBeVisible();
  await expect(rowWith(page, sectorName)).toContainText("0 pessoas ativas");
  // Formulário limpo depois de criar com sucesso.
  await expect(page.getByLabel("Nome do setor")).toHaveValue("");

  // A cor escolhida foi gravada: o diálogo de edição abre com ela marcada.
  await rowWith(page, sectorName)
    .getByRole("button", { name: `Editar ${sectorName}` })
    .click();
  const editDialog = page.getByRole("dialog", { name: "Editar setor" });
  await expect(editDialog.getByRole("radio", { name: "Rosa" })).toBeChecked();
  // Troca só a cor e salva.
  await editDialog.getByRole("radio", { name: "Azul" }).click();
  await editDialog.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Alterações salvas.")).toBeVisible();
  await expect(editDialog).toBeHidden();
  // Depois de recarregar (veio do banco): a cor nova persiste.
  await page.reload();
  await rowWith(page, sectorName)
    .getByRole("button", { name: `Editar ${sectorName}` })
    .click();
  await expect(
    page
      .getByRole("dialog", { name: "Editar setor" })
      .getByRole("radio", { name: "Azul" }),
  ).toBeChecked();
  await page.keyboard.press("Escape");

  // Turno: o nome e os horários já vêm preenchidos (Turno 1, 06:00–14:00).
  await page.goto("/admin/turnos");
  await expect(page.getByRole("heading", { name: "Turnos" })).toBeVisible();
  await chooseSector(page, sectorName);
  await expect(page.getByText("Nenhum turno neste setor.")).toBeVisible();
  await expect(page.getByLabel("Nome do turno")).toHaveValue("Turno 1");
  await expect(page.getByLabel("Início", { exact: true })).toHaveValue("06:00");
  await expect(page.getByLabel("Fim", { exact: true })).toHaveValue("14:00");
  await page.getByLabel("Nome do turno").fill("Turno Manhã");
  await page.getByRole("button", { name: "Criar turno" }).click();
  await expect(page.getByText("Turno criado.")).toBeVisible();
  const shiftRow = rowWith(page, "Turno Manhã");
  await expect(shiftRow).toContainText("06:00–14:00");

  // Item: unidade padrão "Unidade", tipo padrão "Controle"; aqui escolhemos Rolo.
  await page.goto("/admin/itens");
  await expect(page.getByRole("heading", { name: "Itens" })).toBeVisible();
  await chooseSector(page, sectorName);
  await expect(page.getByText("Nenhum item neste setor.")).toBeVisible();
  await expect(page.getByLabel("Unidade", { exact: true })).toHaveValue(
    "unidade",
  );
  await page.getByLabel("Nome do item").fill("Rede de proteção");
  await page.getByLabel("Unidade", { exact: true }).selectOption("rolo");
  await page.getByRole("button", { name: "Criar item" }).click();
  await expect(page.getByText("Item criado.")).toBeVisible();
  const itemRow = rowWith(page, "Rede de proteção");
  await expect(itemRow).toContainText("Rolo");
  await expect(itemRow).toContainText("Controle");

  // Destino (global, não depende de setor).
  await page.goto("/admin/destinos");
  await expect(page.getByRole("heading", { name: "Destinos" })).toBeVisible();
  await page.getByLabel("Nome do destino").fill(destinationName);
  await page.getByRole("button", { name: "Criar destino" }).click();
  await expect(page.getByText("Destino criado.")).toBeVisible();
  await expect(rowWith(page, destinationName)).toBeVisible();

  // Tudo aparece de novo depois de recarregar (veio do banco, não do estado).
  await page.goto("/admin/setores");
  await expect(rowWith(page, sectorName)).toBeVisible();
  await page.goto("/admin/destinos");
  await expect(rowWith(page, destinationName)).toBeVisible();
});

test("(b) convite de operador para o setor novo: ele se cadastra e a Equipe mostra o setor", async ({
  page,
  browser,
  clientIp,
}) => {
  await registerAdmin(page, "Bruno Cadastros", uniqueEmail());
  const sector = await insertSector(db, `Setor ${unique()}`);
  const operatorEmail = uniqueEmail();

  await page.goto("/admin/equipe");
  await expect(page.getByRole("heading", { name: "Equipe" })).toBeVisible();
  await page.getByLabel("Nome de referência (opcional)").fill("Davi da ULD");
  // Papel já vem em Operador; o setor é escolhido pelo nome, não pelo id.
  await page.getByLabel("Setor", { exact: true }).selectOption({
    label: sector.name,
  });
  await page.getByRole("button", { name: "Gerar convite" }).click();

  // O link só aparece agora (o banco guarda só o hash do token).
  await expect(page.getByLabel("Link do convite")).toBeVisible();
  const link = await page.getByLabel("Link do convite").inputValue();
  expect(link).toContain("/convite/");
  await expect(page.getByRole("button", { name: "Copiar link" })).toBeVisible();

  // O convite já aparece na lista de pendentes, com o setor.
  await page.goto("/admin/equipe");
  await expect(rowWith(page, "Davi da ULD")).toContainText(sector.name);

  // O operador abre o link num navegador à parte e cria a conta.
  const other = await visitor(browser, clientIp);
  const operatorPage = await other.newPage();
  await signUpAtInviteUrl(operatorPage, link, {
    name: "Davi Operador",
    email: operatorEmail,
  });
  await other.close();

  // A linha dele na Equipe mostra o setor do convite; o convite sai dos pendentes.
  await page.goto("/admin/equipe");
  const personRow = rowWith(page, operatorEmail);
  await expect(personRow).toContainText("Operador");
  await expect(personRow).toContainText(sector.name);
  await expect(rowWith(page, "Davi da ULD")).toHaveCount(0);
});

test("(c) admin desativa o operador: as sessões caem e a próxima navegação vai para /entrar", async ({
  page,
  browser,
  clientIp,
}) => {
  await registerAdmin(page, "Carla Cadastros", uniqueEmail());
  const sector = await insertSector(db, `Setor ${unique()}`);
  const { token } = await insertInvite(db, {
    role: "operator",
    sectorId: sector.id,
  });
  const operatorEmail = uniqueEmail();

  const other = await visitor(browser, clientIp);
  const operatorPage = await other.newPage();
  await signUpWithInviteToken(operatorPage, token, {
    name: "Eduardo Operador",
    email: operatorEmail,
  });
  await operatorPage.getByRole("link", { name: "Agora não" }).click();
  await expect(operatorPage).toHaveURL(/\/$/);
  expect(await countSessionsByEmail(db, operatorEmail)).toBeGreaterThan(0);

  await page.goto("/admin/equipe");
  await rowWith(page, operatorEmail)
    .getByRole("button", { name: "Desativar Eduardo Operador" })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Desativar Eduardo Operador?" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Desativar", exact: true }).click();
  await expect(page.getByText("Pessoa desativada.")).toBeVisible();
  await expect(rowWith(page, operatorEmail)).toContainText("Inativo");

  // P11: as sessões foram apagadas na mesma transação.
  expect(await countSessionsByEmail(db, operatorEmail)).toBe(0);
  await operatorPage.goto("/");
  await expect(operatorPage).toHaveURL(/\/entrar$/);
  await other.close();

  // Reativar volta a pessoa para ativa (o banco não apaga ninguém).
  await rowWith(page, operatorEmail)
    .getByRole("button", { name: "Reativar Eduardo Operador" })
    .click();
  await expect(page.getByText("Pessoa reativada.")).toBeVisible();
});

test("(d) operador em /admin/setores, /admin/equipe e nas outras rotas vê Página não encontrada", async ({
  page,
}) => {
  const sector = await insertSector(db, `Setor ${unique()}`);
  const { token } = await insertInvite(db, {
    role: "operator",
    sectorId: sector.id,
  });
  await signUpWithInviteToken(page, token, {
    name: "Fábio Operador",
    email: uniqueEmail(),
  });
  await page.getByRole("link", { name: "Agora não" }).click();
  await expect(page.getByRole("heading", { name: "Olá, Fábio" })).toBeVisible();

  for (const route of [
    "/admin/setores",
    "/admin/turnos",
    "/admin/itens",
    "/admin/destinos",
    "/admin/equipe",
  ]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: "Página não encontrada" }),
    ).toBeVisible();
    // P19: o 404 da raiz vinha dentro do <main> do SidebarInset (dois <main>
    // aninhados); o (app)/not-found.tsx deixa um só e a barra lateral ao lado.
    await expect(page.getByRole("main")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Passagens" })).toBeVisible();
    await expect(page.getByLabel("Nome do setor")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Gerar convite" }),
    ).toHaveCount(0);
    // O <title> também não revela a rota (T12).
    await expect(page).not.toHaveTitle(
      /Administração|Setores|Turnos|Itens|Destinos|Equipe/,
    );
  }
});

test("(e) a linha da própria conta do admin mostra Você, a ajuda e só o botão Nova senha", async ({
  page,
}) => {
  const email = uniqueEmail();
  await registerAdmin(page, "Gabriela Cadastros", email);

  await page.goto("/admin/equipe");
  const ownRow = rowWith(page, email);
  await expect(ownRow).toContainText("Você");
  await expect(ownRow).toContainText(
    "Peça a outro administrador para mudar a sua conta.",
  );
  await expect(ownRow.getByRole("button")).toHaveCount(1);
  await expect(
    ownRow.getByRole("button", { name: /^Gerar link de nova senha para / }),
  ).toBeVisible();
});

test("(f) setor com operador ativo não se desativa e mostra o motivo", async ({
  page,
}) => {
  await registerAdmin(page, "Hélio Cadastros", uniqueEmail());
  const sector = await insertSector(db, `Setor ${unique()}`);
  await insertUser(db, { role: "operator", sectorId: sector.id });

  await page.goto("/admin/setores");
  const row = rowWith(page, sector.name);
  await expect(row).toContainText("1 pessoa ativa");
  await row.getByRole("button", { name: `Desativar ${sector.name}` }).click();

  await expect(
    page.getByText("Este setor tem 1 pessoa ativa. Mova ou desative antes."),
  ).toBeVisible();
  // Nada mudou: continua ativo, com o botão de desativar.
  await expect(row).not.toContainText("Inativo");
  await expect(
    row.getByRole("button", { name: `Desativar ${sector.name}` }),
  ).toBeVisible();
});
