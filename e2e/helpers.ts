import { randomUUID } from "node:crypto";

import { test as base, expect, type Page } from "@playwright/test";

import type { Db } from "@/db/types";
import { todayInSaoPaulo } from "@/features/handovers/saoPaulo";

import {
  buildInviteUrl,
  E2E_BASE_URL,
  insertDestination,
  insertInvite,
  insertItem,
  insertSector,
  insertShift,
} from "./db";

// Helpers do e2e/dashboard.spec.ts, copiados dos quatro specs antigos (que
// continuam com as cópias deles: migrá-los seria refatoração no commit de
// feature, vira pendência). Nada aqui abre conexão: quem precisa do banco
// recebe `db` por parâmetro e o spec abre e fecha o pool.

export const PASSWORD = "senha-de-teste-123";

// Mesma estratégia dos outros specs: o app roda em produção (`next start`) com
// rate limit, então cada teste usa um IP próprio (x-forwarded-for). A base
// aleatória evita colidir com os IPs dos outros specs.
const ipPrefix = `10.${Math.floor(Math.random() * 200) + 20}.${Math.floor(Math.random() * 250)}`;
let nextClientIp = 1;

export const test = base.extend<{ clientIp: string }>({
  // biome-ignore lint/correctness/noEmptyPattern: o Playwright exige o padrão de desestruturação.
  clientIp: async ({}, use) => {
    await use(`${ipPrefix}.${nextClientIp++}`);
  },
  extraHTTPHeaders: async ({ clientIp }, use) => {
    await use({ "x-forwarded-for": clientIp });
  },
});

// O Next mantém a página anterior escondida na navegação (Activity): getByText
// também casa texto escondido e o modo estrito reprova. Sempre só o visível.
export function text(page: Page, ...args: Parameters<Page["getByText"]>) {
  return page.getByText(...args).filter({ visible: true });
}

export function unique(): string {
  return randomUUID().slice(0, 8);
}

export function uniqueEmail(): string {
  return `e2e-${randomUUID()}@example.com`;
}

// Datas das fixtures sempre relativas a Date.now(): uma data fixa sairia da
// janela do período com o tempo e o teste passaria a depender do dia em que roda.
export function ago(milliseconds: number): Date {
  return new Date(Date.now() - milliseconds);
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
}

// Cadastra um operador do setor pelo convite e deixa a sessão aberta no Início.
export async function signUpOperator(
  page: Page,
  db: Db,
  sectorId: string,
  name: string,
): Promise<void> {
  const { token } = await insertInvite(db, { role: "operator", sectorId });
  await signUpWithInviteToken(page, token, { name, email: uniqueEmail() });
  await page.getByRole("link", { name: "Agora não" }).click();
  await expect(page).toHaveURL(/\/$/);
}

export async function signUpAdmin(
  page: Page,
  db: Db,
  name: string,
): Promise<void> {
  const { token } = await insertInvite(db, { role: "admin" });
  await signUpWithInviteToken(page, token, { name, email: uniqueEmail() });
  await page.getByRole("link", { name: "Agora não" }).click();
  await expect(page).toHaveURL(/\/$/);
}

// Setor com o turno "Turno Dia" 00:00–23:59, um item de estoque (Stretch, em
// rolo), um de controle (Rede de proteção, em rolo) e um destino de nome único
// (o destino é global). `shiftCreatedAt` põe a criação do turno no passado: o
// histórico só gera "Sem passagem" a partir do dia em que o turno existe.
export async function seedSector(
  db: Db,
  options: { shiftCreatedAt?: Date } = {},
) {
  const sector = await insertSector(db, `Setor ${unique()}`);
  const shift = await insertShift(db, {
    sectorId: sector.id,
    name: "Turno Dia",
    startsAt: "00:00",
    endsAt: "23:59",
    ...(options.shiftCreatedAt ? { createdAt: options.shiftCreatedAt } : {}),
  });
  const stretch = await insertItem(db, {
    sectorId: sector.id,
    name: "Stretch",
    unit: "rolo",
    kind: "stock",
  });
  const net = await insertItem(db, {
    sectorId: sector.id,
    name: "Rede de proteção",
    unit: "rolo",
    kind: "control",
  });
  const destination = await insertDestination(db, {
    name: `Doca ${unique()}`,
  });
  return {
    sector,
    shift,
    stretch,
    net,
    destination,
    today: todayInSaoPaulo(new Date()),
  };
}
