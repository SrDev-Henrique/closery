import { readFileSync } from "node:fs";

import { expect } from "@playwright/test";
import type { Pool } from "pg";

import type { Db } from "@/db/types";
import { formatPeriodLabel } from "@/features/dashboard/period";
import {
  addDays,
  formatDateBR,
  todayInSaoPaulo,
} from "@/features/handovers/saoPaulo";

import {
  insertHandover,
  insertHandoverItem,
  insertRequest,
  insertRequestItem,
  insertUser,
  openE2eDb,
} from "./db";
import {
  ago,
  seedSector,
  signUpAdmin,
  signUpOperator,
  test,
  text,
  unique,
} from "./helpers";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

// O turno é 00:00–23:59 e nasce 10 dias antes (shiftCreatedAt): os dias
// passados do período têm pares encerrados e viram "Sem passagem". O par de
// hoje só encerra às 23:59 e nenhum cenário o afirma.
const OLD_SHIFT = { shiftCreatedAt: ago(10 * DAY_MS) };

const CSV_HEADER = [
  "Dia",
  "Turno",
  "Setor",
  "Entregue por",
  "Recebido por",
  "Situação",
  "Corrigida",
  "Rede de proteção (rolo)",
  "Stretch (rolo)",
  "Observações dos itens",
  "Fica para o próximo turno",
  "Ocorrências do turno",
].join(";");

let pool: Pool;
let db: Db;

test.beforeAll(() => {
  ({ pool, db } = openE2eDb());
});

test.afterAll(async () => {
  await pool.end();
});

type SectorWorld = Awaited<ReturnType<typeof seedSector>>;

// Passagem entregue (ou confirmada, com `confirmedBy`) de `daysAgo` dias atrás,
// com as quantidades dos dois itens do setor.
async function seedHandover(
  data: SectorWorld,
  input: {
    daysAgo: number;
    deliveredBy: string;
    confirmedBy?: string;
    net: number;
    stretch: number;
  },
): Promise<{ id: string }> {
  const created = await insertHandover(db, {
    sectorId: data.sector.id,
    shiftId: data.shift.id,
    operationalDate: addDays(data.today, -input.daysAgo),
    status: input.confirmedBy ? "confirmed" : "delivered",
    deliveredBy: input.deliveredBy,
    deliveredAt: ago(input.daysAgo * DAY_MS),
    ...(input.confirmedBy ? { confirmedBy: input.confirmedBy } : {}),
  });
  await insertHandoverItem(db, {
    handoverId: created.id,
    itemId: data.net.id,
    quantity: input.net,
    snapshot: true,
  });
  await insertHandoverItem(db, {
    handoverId: created.id,
    itemId: data.stretch.id,
    quantity: input.stretch,
    snapshot: true,
  });
  return created;
}

async function seedPeople(data: SectorWorld) {
  const ana = await insertUser(db, {
    role: "operator",
    sectorId: data.sector.id,
    name: "Ana Teste",
  });
  const bia = await insertUser(db, {
    role: "operator",
    sectorId: data.sector.id,
    name: "Bia Teste",
  });
  return { ana, bia };
}

// O texto de um CSV sem o BOM do começo.
function withoutBom(bytes: Buffer): string {
  return bytes.toString("utf8").replace(/^\u{feff}/u, "");
}

test("(a) uma solicitação levada até Entregue aparece no dashboard, e o número abre a lista", async ({
  page,
}) => {
  const data = await seedSector(db);
  const caio = await insertUser(db, {
    role: "operator",
    sectorId: data.sector.id,
    name: "Caio Teste",
  });
  const description = `Repor stretch ${unique()}`;
  const seeded = await insertRequest(db, {
    sectorId: data.sector.id,
    createdBy: caio.id,
    destinationId: data.destination.id,
    description,
    createdAt: ago(2 * HOUR_MS),
  });
  await insertRequestItem(db, {
    requestId: seeded.id,
    itemId: data.stretch.id,
    quantity: 12,
  });
  await signUpOperator(page, db, data.sector.id, "Ana Teste");

  // Do cartão até Entregue, pelos botões do Quadro (`visao=quadro` explícito:
  // sem ela o Quadro e a Lista estão os dois no DOM).
  await page.goto("/solicitacoes?visao=quadro");
  await page
    .getByRole("button", { name: "Mover para Em separação / Trânsito" })
    .click();
  await page.getByRole("button", { name: "Mover para Entregue" }).click();
  await expect(page.getByRole("button", { name: /^Mover para/ })).toHaveCount(
    0,
  );

  // No dashboard: 1 entregue no período e a linha do destino com "1 entregue".
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { level: 1, name: "Dashboard" }),
  ).toBeVisible();
  const region = page.getByRole("region", { name: "Solicitações" });
  const delivered = region.getByRole("link", { name: /Entregues no período/ });
  await expect(delivered).toHaveAccessibleName(/^1\s+Entregues no período/);
  await expect(
    region
      .getByRole("list", { name: "Tempo até a entrega por destino" })
      .getByRole("listitem")
      .filter({ hasText: data.destination.name }),
  ).toContainText("1 entregue");

  // O número clicado abre a Tabela filtrada pela data da entrega, com a solicitação.
  await delivered.click();
  await expect(page).toHaveURL("/solicitacoes?visao=tabela&entrega=7");
  await expect(text(page, description)).toBeVisible();
});

test("(b) o operador que monta a URL de outro setor vê o próprio setor, no dashboard e no CSV", async ({
  page,
}) => {
  const mine = await seedSector(db, OLD_SHIFT);
  const theirs = await seedSector(db, OLD_SHIFT);
  const minePeople = await seedPeople(mine);
  const theirPeople = await seedPeople(theirs);
  await seedHandover(mine, {
    daysAgo: 1,
    deliveredBy: minePeople.ana.id,
    net: 3,
    stretch: 5,
  });
  await seedHandover(theirs, {
    daysAgo: 1,
    deliveredBy: theirPeople.ana.id,
    net: 4,
    stretch: 6,
  });
  await seedHandover(theirs, {
    daysAgo: 2,
    deliveredBy: theirPeople.ana.id,
    confirmedBy: theirPeople.bia.id,
    net: 1,
    stretch: 2,
  });
  await signUpOperator(page, db, mine.sector.id, "Caio Teste");

  // Entregues = 1 (a do próprio setor); as duas do outro setor nunca entram.
  await page.goto(`/dashboard?setor=${theirs.sector.id}`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Dashboard" }),
  ).toBeVisible();
  const numbers = page.getByRole("list", { name: "Números das passagens" });
  await expect(
    numbers.getByRole("link", { name: /^\d+\s+Entregues/ }),
  ).toHaveAccessibleName(/^1\s+Entregues/);
  await expect(text(page, theirs.sector.name)).toHaveCount(0);

  // O CSV com o ?setor= do outro setor também é só do próprio: nunca vazio
  // (a passagem e os "Sem passagem" estão lá) e toda linha é do setor dele.
  const response = await page.request.get(
    `/api/dashboard/export?setor=${theirs.sector.id}`,
  );
  expect(response.status()).toBe(200);
  const lines = withoutBom(await response.body())
    .split("\r\n")
    .filter((line) => line !== "");
  expect(lines.length).toBeGreaterThan(2);
  for (const line of lines.slice(1)) {
    expect(line.split(";")[2]).toBe(mine.sector.name);
  }
  expect(lines.join("\n")).not.toContain(theirs.sector.name);
});

test("(c) Exportar CSV baixa o arquivo com BOM, o cabeçalho do contrato e as linhas dos dias", async ({
  page,
}) => {
  const data = await seedSector(db, OLD_SHIFT);
  const { ana, bia } = await seedPeople(data);
  await seedHandover(data, {
    daysAgo: 1,
    deliveredBy: ana.id,
    net: 3,
    stretch: 12,
  });
  await seedHandover(data, {
    daysAgo: 2,
    deliveredBy: ana.id,
    confirmedBy: bia.id,
    net: 2,
    stretch: 7,
  });
  await signUpOperator(page, db, data.sector.id, "Caio Teste");
  await page.goto("/dashboard");

  const downloading = page.waitForEvent("download");
  await page.getByRole("link", { name: "Exportar CSV" }).click();
  const download = await downloading;
  // O navegador usa o filename* (UTF-8, o setor como está) e não o ASCII.
  expect(download.suggestedFilename()).toBe(
    `passagens-${data.sector.name}-${addDays(data.today, -6)}_a_${data.today}.csv`,
  );

  const path = await download.path();
  const bytes = readFileSync(path);
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const lines = withoutBom(bytes)
    .split("\r\n")
    .filter((line) => line !== "");
  expect(lines[0]).toBe(CSV_HEADER);
  const yesterday = formatDateBR(addDays(data.today, -1));
  const dayBefore = formatDateBR(addDays(data.today, -2));
  const sector = data.sector.name;
  expect(lines).toContain(
    `${yesterday};Turno Dia;${sector};Ana Teste;;Aguardando recebimento;Não;3;12;;;`,
  );
  expect(lines).toContain(
    `${dayBefore};Turno Dia;${sector};Ana Teste;Bia Teste;Confirmada;Não;2;7;;;`,
  );
  // Os dias sem passagem entram como "Sem passagem", com as células vazias.
  expect(lines.some((line) => line.includes(";Sem passagem;"))).toBe(true);
});

test("(d) o número 'Sem passagem' abre a lista com o mesmo número de linhas", async ({
  page,
}) => {
  const data = await seedSector(db, OLD_SHIFT);
  const { ana } = await seedPeople(data);
  await seedHandover(data, {
    daysAgo: 1,
    deliveredBy: ana.id,
    net: 3,
    stretch: 5,
  });
  await signUpOperator(page, db, data.sector.id, "Caio Teste");
  await page.goto("/dashboard");

  // O mesmo rótulo aparece na legenda do anel: só o número da lista de números.
  const link = page
    .getByRole("list", { name: "Números das passagens" })
    .getByRole("link", { name: /Sem passagem/ });
  const missing = Number(/\d+/.exec(await link.innerText())?.[0]);
  expect(missing).toBeGreaterThanOrEqual(1);

  await link.click();
  await expect(page).toHaveURL("/passagens?situacao=sem-passagem");
  await expect(
    page
      .getByRole("main")
      .getByRole("listitem")
      .filter({ hasText: "Sem passagem" }),
  ).toHaveCount(missing);
});

test("(e) P19: o 404 de uma solicitação de outro setor aparece dentro do shell", async ({
  page,
}) => {
  const mine = await seedSector(db);
  const theirs = await seedSector(db);
  const dono = await insertUser(db, {
    role: "operator",
    sectorId: theirs.sector.id,
    name: "Dona Teste",
  });
  const foreign = await insertRequest(db, {
    sectorId: theirs.sector.id,
    createdBy: dono.id,
    destinationId: theirs.destination.id,
    description: `Pedido alheio ${unique()}`,
    createdAt: ago(HOUR_MS),
  });
  await signUpOperator(page, db, mine.sector.id, "Caio Teste");

  await page.goto(`/solicitacoes/${foreign.id}`);
  await expect(
    page.getByRole("heading", { name: "Página não encontrada" }),
  ).toBeVisible();
  // A barra lateral continua lá: o 404 não derrubou o shell.
  await expect(
    page.getByRole("link", { name: "Passagens", exact: true }),
  ).toBeVisible();
  // Só um <main>, o do SidebarInset: sem (app)/not-found.tsx o 404 da raiz
  // trazia o próprio <main> aninhado e a contagem era 2.
  await expect(page.getByRole("main")).toHaveCount(1);
});

test("(f) P45: trocar de setor mantém o período escolhido", async ({
  page,
}) => {
  const first = await seedSector(db);
  const second = await seedSector(db);
  await signUpAdmin(page, db, "Dora Admin");

  await page.goto(`/dashboard?periodo=30&setor=${first.sector.id}`);
  const picker = page.getByRole("radiogroup", { name: "Setor" });
  await expect(
    picker.getByRole("radio", { name: first.sector.name }),
  ).toBeChecked();
  await picker.getByRole("radio", { name: second.sector.name }).click();
  await expect(page).toHaveURL(
    `/dashboard?periodo=30&setor=${second.sector.id}`,
  );
});

test("(g) o rótulo do período no topo é o de hoje", async ({ page }) => {
  const data = await seedSector(db);
  await signUpOperator(page, db, data.sector.id, "Caio Teste");
  await page.goto("/dashboard");

  const today = todayInSaoPaulo(new Date());
  const label = formatPeriodLabel(
    { period: "7", from: addDays(today, -6), to: today },
    today,
  );
  await expect(text(page, label, { exact: true })).toBeVisible();
});
